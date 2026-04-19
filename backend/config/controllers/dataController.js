const { Beneficiary, Transaction, MlResult, CaseAssignment, Scheme } = require('../models');
const { fetchFromHadoop } = require('../services/hadoopService');
const { analyzeBatch } = require('../services/mlService');
const redis = require('../config/redis');
const { logger } = require('../utils/helpers');
const crypto = require('crypto');

function hashAadhaar(aadhaarStr) {
  return crypto.createHash('sha256').update(String(aadhaarStr)).digest('hex');
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function normalizeFlatCsvRow(row) {
  return {
    transaction_id: row.transaction_id,
    beneficiary_id: row.beneficiary_id,
    aadhaar: row.aadhaar || row.aadhaar_hash || '',
    name: row.name || 'UNKNOWN',
    name_normalized: row.name_normalized || null,
    district: row.district || 'UNKNOWN',
    scheme: row.scheme,
    amount: Number.parseFloat(row.amount || 0),
    transaction_date: row.transaction_date || null,
    timestamp: row.transaction_date || null,
    withdrawn: normalizeBoolean(row.withdrawn),
    is_deceased: normalizeBoolean(row.is_deceased || false),
    status: row.status || 'Success',
    withdrawal_channel: row.withdrawal_channel || null,
    device_id: row.device_id || null,
    time_to_withdraw_hours: row.time_to_withdraw_hours ? Number.parseFloat(row.time_to_withdraw_hours) : null,
    linked_bank_account: row.linked_bank_account || null,
    linked_mobile: row.linked_mobile || null,
    ifsc_code: row.ifsc_code || null,
    kyc_last_update: row.kyc_last_update || null,
    csc_operator_id: row.csc_operator_id || null,
    beneficiary_ref: row.beneficiary_ref || null,
  };
}

/**
 * Helper to ensure Scheme exist in database and return ID mapping.
 */
async function getSchemeMap() {
  const schemes = await Scheme.findAll();
  const map = new Map();
  schemes.forEach(s => map.set(s.name, s.id));
  return map;
}

/**
 * POST /api/load-from-hadoop
 */
const loadFromHadoop = async (req, res) => {
  try {
    const data = await fetchFromHadoop();

    if (Array.isArray(data)) {
      return res.status(200).json({
        success: true,
        message: 'Successfully verified merged CSV records in Hadoop. Ready for analysis.',
        records_count: data.length,
      });
    }

    const beneficiaries = data.beneficiaries || [];
    const transactions = data.transactions || [];
    return res.status(200).json({
      success: true,
      message: `Successfully verified records in Hadoop. Ready for analysis.`,
      beneficiaries_count: beneficiaries.length,
      transactions_count: transactions.length,
    });
  } catch (error) {
    logger.error('LoadFromHadoop', 'Failed to read data from Hadoop', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/analyze
 */
const analyze = async (req, res) => {
  try {
    logger.info('Analyze', 'Fetching all data from Hadoop...');
    const data = await fetchFromHadoop();
    const shouldPersist =
      req.query.persist === 'true' ||
      req.body?.persist === true ||
      process.env.ANALYZE_PERSIST_RESULTS === 'true';

    const isMergedCsv = Array.isArray(data);
    const mergedRows = isMergedCsv ? data.map(normalizeFlatCsvRow) : [];
    const beneficiariesData = isMergedCsv ? [] : (data.beneficiaries || []);
    const transactionsData = isMergedCsv ? [] : (data.transactions || []);

    const sourceTransactions = isMergedCsv ? mergedRows : transactionsData;

    // 1. Ensure Schemes exist in database
    const schemeSet = new Set(sourceTransactions.map(tx => tx.scheme).filter(Boolean));
    for (const sName of schemeSet) {
      await Scheme.findOrCreate({ where: { name: sName } });
    }
    const schemeMap = await getSchemeMap();

    const beneficiaryMap = new Map();
    beneficiariesData.forEach(b => {
      beneficiaryMap.set(b.beneficiary_id, b);
    });

    const flatTransactions = isMergedCsv
      ? mergedRows
      : transactionsData.map(tx => {
          const bObj = beneficiaryMap.get(tx.beneficiary_id) || {};
          return {
            beneficiary_id: tx.beneficiary_id,
            aadhaar: bObj.aadhaar || '000000000000',
            name: bObj.name || 'UNKNOWN',
            scheme: tx.scheme,
            district: bObj.district || 'UNKNOWN',
            amount: tx.amount,
            timestamp: tx.transaction_date,
            transaction_date: tx.transaction_date || null,
            withdrawn: normalizeBoolean(tx.withdrawn),
            is_deceased: normalizeBoolean(tx.is_deceased || bObj.is_deceased || false),
            status: tx.status || 'Success',
            withdrawal_channel: tx.withdrawal_channel || null,
            device_id: tx.device_id || null,
            time_to_withdraw_hours: tx.time_to_withdraw_hours || null,
            linked_bank_account: bObj.linked_bank_account || null,
            linked_mobile: bObj.linked_mobile || null,
            ifsc_code: bObj.ifsc_code || null,
            kyc_last_update: bObj.kyc_last_update || null,
            csc_operator_id: bObj.csc_operator_id || null,
            name_normalized: bObj.name_normalized || null,
            transaction_id: tx.transaction_id || null,
          };
        });

    // 2. ML Analysis
    logger.time('ML-Analysis');
    const mlResults = await analyzeBatch(flatTransactions);
    logger.timeEnd('ML-Analysis');

    if (!Array.isArray(mlResults) || mlResults.length !== flatTransactions.length) {
      throw new Error(
        `ML analysis returned ${Array.isArray(mlResults) ? mlResults.length : 0} results for ${flatTransactions.length} transactions.`
      );
    }

    if (!shouldPersist) {
      const totalFlagged = mlResults.filter(result => result.is_flagged).length;

      return res.status(200).json({
        success: true,
        message: 'Analysis completed through Redis microservice. Results were not persisted to PostgreSQL.',
        mode: 'redis_only',
        total_analyzed: flatTransactions.length,
        total_flagged: totalFlagged,
        sample_result: mlResults[0] || null,
      });
    }

    // 3. Database Insertion
    logger.time('DB-RelationalInsert');
    let highRiskCount = 0;
    const pipeline = redis.pipeline();

    for (let i = 0; i < flatTransactions.length; i++) {
       const flatTx = flatTransactions[i];
       const bData = isMergedCsv ? flatTx : (beneficiaryMap.get(flatTx.beneficiary_id) || {});
       const txData = isMergedCsv ? flatTx : transactionsData[i];
       const mlRes = mlResults[i];

       // Process Beneficiary
       const aadhaarHash = hashAadhaar(bData.aadhaar || bData.aadhaar_hash || '000000000000');
       let [beneficiary] = await Beneficiary.findOrCreate({
         where: { beneficiary_id: bData.beneficiary_id || `UNKNOWN_${i}` },
         defaults: {
           aadhaar_hash: aadhaarHash,
           name: bData.name,
           name_normalized: bData.name_normalized,
           district: bData.district,
           bank_account: bData.linked_bank_account,
           phone_number: bData.linked_mobile,
           kyc_last_update: bData.kyc_last_update || null,
           csc_operator_id: bData.csc_operator_id,
         }
       });

       // Process Transaction
       let [transaction] = await Transaction.findOrCreate({
         where: { transaction_id: txData.transaction_id || `TX_UNKNOWN_${Date.now()}_${i}` },
         defaults: {
           beneficiary_ref: beneficiary.id,
           scheme_id: schemeMap.get(txData.scheme),
           amount: txData.amount,
           timestamp: txData.transaction_date || txData.timestamp || null,
           status: txData.status || 'Success',
           withdrawn: normalizeBoolean(txData.withdrawn),
           withdrawal_channel: txData.withdrawal_channel,
           device_id: txData.device_id,
           time_to_withdraw_hours: txData.time_to_withdraw_hours ? Number.parseFloat(txData.time_to_withdraw_hours) : null,
         }
       });

       // Insert ML Result
       const [mlResultModel, created] = await MlResult.findOrCreate({
         where: { beneficiary_ref: beneficiary.id, transaction_ref: transaction.id },
         defaults: {
           aadhaar_masked: mlRes.aadhaar_masked,
           risk_score: mlRes.risk_score,
           is_flagged: mlRes.is_flagged,
           leakage_category: mlRes.leakage_category,
           evidence: mlRes.evidence,
         }
       });

       // Create Case if flagged
       if (created && mlRes.is_flagged) {
         await CaseAssignment.create({
           result_ref: mlResultModel.id,
           district: beneficiary.district,
           status: 'unassigned', // Initial state
           assigned_to: null
         });

         pipeline.set(
            `fraud:${transaction.id}`,
            JSON.stringify({ ...mlRes, transaction, beneficiary }),
            'EX', 86400
         );
         pipeline.zadd('high_risk_frauds', mlRes.risk_score, transaction.id);
         highRiskCount++;
       }
    }
    logger.timeEnd('DB-RelationalInsert');

    if (highRiskCount > 0) {
      await pipeline.exec();
    }

    return res.status(200).json({
      success: true,
      message: 'Analysis completed. PostgreSQL normalized and aligned.',
      total_analyzed: flatTransactions.length,
      total_cases_created: highRiskCount,
    });
  } catch (error) {
    logger.error('Analyze', 'Analysis pipeline failed', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { loadFromHadoop, analyze };

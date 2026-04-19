const { MlResult, Beneficiary, Transaction, Scheme, CaseAssignment, FieldVerification, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');

/**
 * GET /api/audit/stats
 * Returns: totalFlagged, totalAmount, confirmedFraud, recovered
 */
const getAuditStats = async (req, res) => {
  try {
    const totalFlagged = await MlResult.count({ where: { is_flagged: true } });

    // Sum of flagged transaction amounts
    const [amountResult] = await sequelize.query(
      `SELECT COALESCE(SUM(t.amount), 0) as total 
       FROM transactions t 
       INNER JOIN ml_results m ON m.transaction_ref = t.id 
       WHERE m.is_flagged = true`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const totalAmount = parseFloat(amountResult?.total) || 0;

    // Confirmed fraud = field verifications where is_fraud = true
    const confirmedFraud = await FieldVerification.count({
      where: { is_fraud: true }
    });

    // Recovered = sum of amounts for confirmed fraud cases
    const [recoveredResult] = await sequelize.query(
      `SELECT COALESCE(SUM(t.amount), 0) as total
       FROM transactions t
       INNER JOIN ml_results m ON m.transaction_ref = t.id
       INNER JOIN case_assignments ca ON ca.result_ref = m.id
       INNER JOIN field_verifications fv ON fv.assignment_ref = ca.id
       WHERE fv.is_fraud = true`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const recovered = parseFloat(recoveredResult?.total) || 0;

    return res.status(200).json({
      success: true,
      data: { totalFlagged, totalAmount, confirmedFraud, recovered }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/audit/duplicates
 * Returns duplicate/flagged cases for audit review.
 */
const getDuplicateFlags = async (req, res) => {
  try {
    const flaggedResults = await MlResult.findAll({
      where: { is_flagged: true },
      include: [
        { model: Beneficiary, attributes: ['id', 'aadhaar_hash', 'name', 'district'] },
        { model: Transaction, include: [{ model: Scheme, attributes: ['name'], required: false }] },
        { model: CaseAssignment, required: false }
      ],
      order: [['risk_score', 'DESC']],
      limit: 200
    });

    // Group by beneficiary to find duplicates
    const grouped = {};
    flaggedResults.forEach(r => {
      const benId = r.Beneficiary?.id;
      if (!benId) return;
      if (!grouped[benId]) grouped[benId] = [];
      grouped[benId].push(r);
    });

    const duplicates = [];
    let idCounter = 1;

    for (const [benId, records] of Object.entries(grouped)) {
      if (records.length >= 2) {
        const r1 = records[0];
        const r2 = records[1];

        duplicates.push({
          id: String(idCounter++),
          mlResultId1: r1.id,
          mlResultId2: r2.id,
          aadhaar: r1.aadhaar_masked || '********0000',
          name1: r1.Beneficiary?.name || 'Unknown',
          scheme1: r1.Transaction?.Scheme?.name || 'Unknown',
          amount1: parseFloat(r1.Transaction?.amount) || 0,
          name2: r2.Beneficiary?.name || 'Unknown',
          scheme2: r2.Transaction?.Scheme?.name || 'Unknown',
          amount2: parseFloat(r2.Transaction?.amount) || 0,
          district: r1.Beneficiary?.district || 'Unknown',
          status: r1.CaseAssignment?.status === 'completed' ? 'confirmed' : 
                  r1.CaseAssignment?.status === 'assigned' ? 'investigating' : 'flagged'
        });
      } else {
        const r1 = records[0];
        duplicates.push({
          id: String(idCounter++),
          mlResultId1: r1.id,
          aadhaar: r1.aadhaar_masked || '********0000',
          name1: r1.Beneficiary?.name || 'Unknown',
          scheme1: r1.Transaction?.Scheme?.name || 'Unknown',
          amount1: parseFloat(r1.Transaction?.amount) || 0,
          name2: r1.Beneficiary?.name || 'Unknown',
          scheme2: r1.leakage_category || 'Flagged',
          amount2: 0,
          district: r1.Beneficiary?.district || 'Unknown',
          status: r1.CaseAssignment?.status === 'completed' ? 'confirmed' : 
                  r1.CaseAssignment?.status === 'assigned' ? 'investigating' : 'flagged'
        });
      }
    }

    return res.status(200).json({ success: true, data: duplicates });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/audit/compliance
 */
const getComplianceSummary = async (req, res) => {
  try {
    const schemes = await Scheme.findAll();
    const results = [];

    for (const scheme of schemes) {
      const total = await Transaction.count({ where: { scheme_id: scheme.id } });
      const flagged = await MlResult.count({
        where: { is_flagged: true },
        include: [{ model: Transaction, where: { scheme_id: scheme.id }, required: true }]
      });
      
      results.push({
        scheme: scheme.name,
        total_transactions: total,
        flagged_count: flagged,
        compliance_score: total > 0 ? ((total - flagged) / total) * 100 : 100
      });
    }

    return res.status(200).json({ success: true, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/audit/analysis/:type
 */
const getTemporalAnalysis = async (req, res) => {
  try {
    // Get actual peak days from transaction data
    const [peakDays] = await sequelize.query(
      `SELECT EXTRACT(DOW FROM timestamp) as day, COUNT(*) as cnt
       FROM transactions t
       INNER JOIN ml_results m ON m.transaction_ref = t.id
       WHERE m.is_flagged = true AND t.timestamp IS NOT NULL
       GROUP BY day ORDER BY cnt DESC LIMIT 3`,
      { type: sequelize.QueryTypes.SELECT }
    ).catch(() => [[]]); 
    
    const peak_days = peakDays ? [peakDays].flat().map(d => parseInt(d?.day) || 0) : [1, 5];

    // Get anomaly distribution by leakage category
    const categories = await MlResult.findAll({
      attributes: [
        'leakage_category',
        [fn('COUNT', col('id')), 'count']
      ],
      where: { is_flagged: true },
      group: ['leakage_category'],
      raw: true
    });

    return res.status(200).json({
      success: true,
      data: {
        peak_days,
        anomaly_frequency: categories.map(c => parseInt(c.count) || 0),
        categories: categories.map(c => c.leakage_category || 'Unknown')
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getAuditStats,
  getDuplicateFlags,
  getComplianceSummary,
  getTemporalAnalysis,
};

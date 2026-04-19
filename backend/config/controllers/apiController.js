const { Op } = require('sequelize');
const { MlResult, Transaction, Beneficiary } = require('../models');
const redis = require('../config/redis');
const { logger } = require('../utils/helpers');

/**
 * GET /dashboard
 * Returns aggregated stats for the main dashboard.
 */
const getDashboard = async (req, res) => {
  try {
    const totalBeneficiaries = await Beneficiary.count();
    const totalTransactions = await Transaction.count();
    const totalMlResults = await MlResult.count();
    const totalFlagged = await MlResult.count({ where: { is_flagged: true } });

    const highCount = await MlResult.count({
      where: { risk_score: { [Op.gte]: 80 } },
    });
    const mediumCount = await MlResult.count({
      where: { risk_score: { [Op.gte]: 50, [Op.lt]: 80 } },
    });
    const lowCount = await MlResult.count({
      where: { risk_score: { [Op.lt]: 50 } },
    });

    return res.status(200).json({
      success: true,
      total_beneficiaries: totalBeneficiaries,
      total_transactions: totalTransactions,
      total_ml_results: totalMlResults,
      total_flagged: totalFlagged,
      risk_breakdown: {
        high: highCount,
        medium: mediumCount,
        low: lowCount,
      },
    });
  } catch (error) {
    logger.error('Dashboard', 'Failed to fetch dashboard data', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /fraud-cases
 * Returns all flagged fraud cases with full relational data.
 * Priority: Redis cache → PostgreSQL fallback.
 */
const getFraudCases = async (req, res) => {
  try {
    // Step 1: Try Redis cache first
    const cachedIds = await redis.zrevrange('high_risk_frauds', 0, -1);

    if (cachedIds && cachedIds.length > 0) {
      const pipeline = redis.pipeline();
      cachedIds.forEach((txId) => pipeline.get(`fraud:${txId}`));
      const rawResults = await pipeline.exec();

      const cachedData = rawResults
        .map(([err, val]) => (val ? JSON.parse(val) : null))
        .filter(Boolean);

      if (cachedData.length > 0) {
        logger.info('FraudCases', `Returning ${cachedData.length} results from Redis`);
        return res.status(200).json({
          success: true,
          source: 'redis',
          count: cachedData.length,
          data: cachedData,
        });
      }
    }

    // Step 2: Fallback to PostgreSQL with full JOINs
    const fraudCases = await MlResult.findAll({
      where: { is_flagged: true },
      order: [['risk_score', 'DESC']],
      include: [
        { model: Transaction },
        { model: Beneficiary },
      ],
    });

    logger.info('FraudCases', `Returning ${fraudCases.length} results from PostgreSQL`);
    return res.status(200).json({
      success: true,
      source: 'postgres',
      count: fraudCases.length,
      data: fraudCases,
    });
  } catch (error) {
    logger.error('FraudCases', 'Failed to fetch fraud cases', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /fraud/:id
 * Returns a single ML result by its transaction_ref ID.
 * Includes: Transaction, Beneficiary, Explanation (evidence).
 */
const getFraudCaseById = async (req, res) => {
  const { id } = req.params;

  try {
    // Step 1: Try Redis cache
    const cached = await redis.get(`fraud:${id}`);
    if (cached) {
      logger.info('FraudById', `Cache hit for ${id}`);
      return res.status(200).json({
        success: true,
        source: 'redis',
        data: JSON.parse(cached),
      });
    }

    // Step 2: Fallback to PostgreSQL
    const fraudCase = await MlResult.findOne({
      where: { transaction_ref: id },
      include: [
        { model: Transaction },
        { model: Beneficiary },
      ],
    });

    if (!fraudCase) {
      return res.status(404).json({
        success: false,
        message: `No ML result found for transaction_ref: ${id}`,
      });
    }

    logger.info('FraudById', `DB hit for transaction_ref ${id}`);
    return res.status(200).json({
      success: true,
      source: 'postgres',
      data: fraudCase,
    });
  } catch (error) {
    logger.error('FraudById', `Failed to fetch fraud case ${id}`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /beneficiary/:beneficiaryId
 * Looks up a specific beneficiary by their beneficiary_id (e.g. B37938).
 * Returns: identity + all transactions + all ML results + explanations.
 */
const getBeneficiary = async (req, res) => {
  const { beneficiaryId } = req.params;

  try {
    const beneficiary = await Beneficiary.findOne({
      where: { beneficiary_id: beneficiaryId },
      include: [
        {
          model: Transaction,
          include: [
            {
              model: MlResult,
            },
          ],
        },
      ],
    });

    if (!beneficiary) {
      return res.status(404).json({
        success: false,
        message: `Beneficiary not found: ${beneficiaryId}`,
      });
    }

    return res.status(200).json({
      success: true,
      data: beneficiary,
    });
  } catch (error) {
    logger.error('Beneficiary', `Failed to fetch ${beneficiaryId}`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /search?q=<query>
 * Searches beneficiaries by name or beneficiary_id (partial match).
 * Returns matching beneficiaries with their latest ML results.
 */
const searchBeneficiaries = async (req, res) => {
  const { q } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Query parameter "q" is required.' });
  }

  try {
    const results = await Beneficiary.findAll({
      where: {
        [Op.or]: [
          { beneficiary_id: { [Op.iLike]: `%${q}%` } },
          { name: { [Op.iLike]: `%${q}%` } },
        ],
      },
      include: [
        {
          model: MlResult,
        },
      ],
      limit: 50,
    });

    return res.status(200).json({
      success: true,
      query: q,
      count: results.length,
      data: results,
    });
  } catch (error) {
    logger.error('Search', `Search failed for query: ${q}`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /admin/analytics
 * Returns advanced analytics for the admin dashboard:
 *   - Leakage category breakdown
 *   - District-wise fraud distribution
 *   - Top flagged beneficiaries
 */
const getAdminAnalytics = async (req, res) => {
  try {
    const { sequelize } = require('../config/db');

    // 1. Leakage category breakdown
    const categoryBreakdown = await MlResult.findAll({
      attributes: [
        'leakage_category',
        [sequelize.fn('COUNT', sequelize.col('MlResult.id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('risk_score')), 'avg_risk_score'],
      ],
      where: { is_flagged: true },
      group: ['leakage_category'],
      order: [[sequelize.literal('count'), 'DESC']],
      raw: true,
    });

    // 2. District-wise fraud count
    const districtBreakdown = await MlResult.findAll({
      attributes: [
        [sequelize.col('Beneficiary.district'), 'district'],
        [sequelize.fn('COUNT', sequelize.col('MlResult.id')), 'fraud_count'],
      ],
      where: { is_flagged: true },
      include: [{ model: Beneficiary, attributes: [] }],
      group: [sequelize.col('Beneficiary.district')],
      order: [[sequelize.literal('fraud_count'), 'DESC']],
      raw: true,
    });

    // 3. Top 10 flagged beneficiaries (highest cumulative risk)
    const topFlagged = await MlResult.findAll({
      attributes: [
        'beneficiary_ref',
        [sequelize.fn('COUNT', sequelize.col('MlResult.id')), 'flagged_count'],
        [sequelize.fn('MAX', sequelize.col('risk_score')), 'max_risk_score'],
      ],
      where: { is_flagged: true },
      include: [{ model: Beneficiary, attributes: ['beneficiary_id', 'name', 'district'] }],
      group: ['beneficiary_ref', 'Beneficiary.id'],
      order: [[sequelize.literal('flagged_count'), 'DESC']],
      limit: 10,
      raw: true,
      nest: true,
    });

    return res.status(200).json({
      success: true,
      analytics: {
        leakage_categories: categoryBreakdown,
        district_fraud_distribution: districtBreakdown,
        top_flagged_beneficiaries: topFlagged,
      },
    });
  } catch (error) {
    logger.error('AdminAnalytics', 'Failed to fetch analytics', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getDashboard,
  getFraudCases,
  getFraudCaseById,
  getBeneficiary,
  searchBeneficiaries,
  getAdminAnalytics,
};

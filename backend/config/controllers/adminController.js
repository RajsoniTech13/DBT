const { Op, fn, col, literal } = require('sequelize');
const { MlResult, Beneficiary, Transaction, SystemConfig, AuditLog, sequelize } = require('../models');
const { logger } = require('../utils/helpers');

/**
 * GET /api/admin/summary
 * Returns camelCase keys matching frontend:
 * { globalFlags, activeRules, syncHealth, detectionRate, totalSavings, accuracyScore }
 */
const getAdminSummary = async (req, res) => {
  try {
    const totalTransactions = await Transaction.count();
    const flaggedTransactions = await MlResult.count({ where: { is_flagged: true } });
    
    const activeRules = await SystemConfig.count({ where: { is_enabled: true } });

    // SUM of amount where is_flagged is true — using raw query to avoid GROUP BY issues
    const [savingsResult] = await sequelize.query(
      `SELECT COALESCE(SUM(t.amount), 0) as total 
       FROM transactions t 
       INNER JOIN ml_results m ON m.transaction_ref = t.id 
       WHERE m.is_flagged = true`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const totalSavings = parseFloat(savingsResult?.total) || 0;

    // Detection rate = flagged / total
    const detectionRate = totalTransactions > 0 
      ? ((flaggedTransactions / totalTransactions) * 100).toFixed(1) + '%' 
      : '0%';

    const accuracyScore = 94.5; // Example static for demo

    return res.status(200).json({
      success: true,
      data: {
        globalFlags: flaggedTransactions,
        activeRules,
        syncHealth: '99.2%',
        detectionRate,
        totalSavings,
        accuracyScore
      }
    });
  } catch (error) {
    logger.error('AdminController', 'Summary fetch failed', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/admin/heatmap
 * District name + Risk level (0-1) for map visualization.
 */
const getHeatmapData = async (req, res) => {
  try {
    const data = await MlResult.findAll({
      attributes: [
        [col('Beneficiary.district'), 'district'],
        [fn('AVG', col('risk_score')), 'avg_risk'],
      ],
      where: { is_flagged: true },
      include: [{ 
        model: Beneficiary, 
        attributes: [],
        required: true 
      }],
      group: ['Beneficiary.district'],
      raw: true,
    });

    const heatmap = {};
    data.forEach(item => {
      heatmap[item.district] = parseFloat((item.avg_risk / 100).toFixed(2));
    });

    return res.status(200).json({ success: true, data: heatmap });
  } catch (error) {
    logger.error('AdminController', 'Heatmap fetch failed', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/admin/rules
 * Returns Rule objects matching frontend interface:
 * { id, name, description, threshold, enabled, severity }
 */
const getSystemRules = async (req, res) => {
  try {
    const configs = await SystemConfig.findAll();
    
    // Transform SystemConfig rows to frontend Rule shape
    const data = configs.map(config => ({
      id: String(config.id),
      name: config.name,
      description: config.description || '',
      threshold: config.threshold_value ? JSON.stringify(config.threshold_value) : 'N/A',
      enabled: config.is_enabled,
      severity: (config.severity || 'medium').toLowerCase()
    }));

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PATCH /api/admin/rules/:id
 * Toggle a rule (On/Off) or update its severity level.
 * Accepts both 'enabled' (frontend) and 'is_enabled' (original).
 */
const updateSystemRule = async (req, res) => {
  const { id } = req.params;
  const { severity, is_enabled, enabled, threshold_value } = req.body;
  try {
    const config = await SystemConfig.findByPk(id);
    if (!config) {
      return res.status(404).json({ success: false, error: 'Rule not found' });
    }

    if (severity !== undefined) config.severity = severity;
    // Accept both 'enabled' (camelCase from frontend) and 'is_enabled' (original)
    if (enabled !== undefined) config.is_enabled = enabled;
    if (is_enabled !== undefined) config.is_enabled = is_enabled;
    if (threshold_value !== undefined) config.threshold_value = threshold_value;

    await config.save();

    return res.status(200).json({ success: true, message: `Rule ${config.name} updated successfully` });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getAdminSummary,
  getHeatmapData,
  getSystemRules,
  updateSystemRule,
};

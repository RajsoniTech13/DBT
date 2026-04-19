const { MlResult, CaseAssignment, Beneficiary, Transaction, User, AuditLog, Scheme } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/dfo/stats
 * Dashboard counts for DFO.
 * Returns camelCase keys matching frontend: totalCases, highRisk, inProgress, resolved
 */
const getDfoStats = async (req, res) => {
  const { district } = req.user;

  try {
    const benWhere = district && district !== 'Default District' ? { district } : {};

    const totalCases = await MlResult.count({
      where: { is_flagged: true },
      include: [{ model: Beneficiary, where: benWhere, required: Object.keys(benWhere).length > 0 }]
    });

    const highRisk = await MlResult.count({
      where: { risk_score: { [Op.gte]: 80 }, is_flagged: true },
      include: [{ model: Beneficiary, where: benWhere, required: Object.keys(benWhere).length > 0 }]
    });

    const inProgress = await CaseAssignment.count({
      where: { 
        status: 'assigned',
        ...(district && district !== 'Default District' ? { district } : {})
      }
    });

    const resolved = await CaseAssignment.count({
      where: { 
        status: 'completed',
        ...(district && district !== 'Default District' ? { district } : {})
      }
    });

    return res.status(200).json({
      success: true,
      data: { totalCases, highRisk, inProgress, resolved }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/dfo/cases
 * Returns flat Case objects matching frontend interface:
 * { id, beneficiary, aadhaar, scheme, amount, anomalyType, riskScore, district, status, assignedTo, date }
 */
const getCases = async (req, res) => {
  const { district } = req.user;
  const { page = 1, limit = 50, status, search } = req.query;
  const offset = (page - 1) * limit;

  try {
    const whereClause = { is_flagged: true };
    const benWhere = district && district !== 'Default District' ? { district } : {};

    if (search) {
      benWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { beneficiary_id: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const caseWhere = status ? { status } : {};

    const { count, rows } = await MlResult.findAndCountAll({
      where: whereClause,
      include: [
        { model: Beneficiary, where: Object.keys(benWhere).length > 0 ? benWhere : undefined, required: Object.keys(benWhere).length > 0 },
        { model: Transaction, include: [{ model: Scheme, attributes: ['name'], required: false }] },
        { model: CaseAssignment, where: Object.keys(caseWhere).length > 0 ? caseWhere : undefined, required: Object.keys(caseWhere).length > 0 }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['risk_score', 'DESC']]
    });

    // Transform nested Sequelize results into flat frontend-compatible Case objects
    const data = rows.map(row => {
      const ben = row.Beneficiary || {};
      const tx = row.Transaction || {};
      const ca = row.CaseAssignment || {};
      const scheme = tx.Scheme || {};

      return {
        id: String(row.id),
        beneficiary: ben.name || 'Unknown',
        aadhaar: row.aadhaar_masked || '********0000',
        scheme: scheme.name || tx.scheme || 'Unknown',
        amount: parseFloat(tx.amount) || 0,
        anomalyType: row.leakage_category || 'None',
        riskScore: Math.round(row.risk_score || 0),
        district: ben.district || 'Unknown',
        status: ca.status || 'unassigned',
        assignedTo: ca.assigned_to ? String(ca.assigned_to) : undefined,
        date: tx.timestamp || row.created_at || new Date().toISOString()
      };
    });

    return res.status(200).json({
      success: true,
      total: count,
      page: parseInt(page),
      data
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/dfo/verifiers
 */
const getDistrictVerifiers = async (req, res) => {
  const { district } = req.user;
  try {
    const verifiers = await User.findAll({
      where: { 
        role: 'VERIFIER',
        ...(district && district !== 'Default District' ? { district } : {})
      },
      attributes: ['id', 'name', 'email', 'district']
    });
    return res.status(200).json({ success: true, data: verifiers });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/cases/:id/assign
 * Accepts both verifier_id (snake_case) and verifierId (camelCase) from request body.
 */
const assignCase = async (req, res) => {
  const { id: ml_result_id } = req.params;
  const verifier_id = req.body.verifier_id || req.body.verifierId;
  const admin_id = req.user.id;

  try {
    const verifier = await User.findOne({ where: { id: verifier_id, role: 'VERIFIER' } });
    if (!verifier) {
      return res.status(404).json({ success: false, error: 'Verifier not found' });
    }

    const [assignment, created] = await CaseAssignment.findOrCreate({
      where: { result_ref: ml_result_id },
      defaults: {
        assigned_by: admin_id,
        assigned_to: verifier_id,
        district: req.user.district,
        status: 'assigned'
      }
    });

    if (!created) {
      assignment.assigned_to = verifier_id;
      assignment.status = 'assigned';
      await assignment.save();
    }

    // Log activity
    await AuditLog.create({
      user_id: admin_id,
      action: 'CASE_ASSIGNED',
      entity_type: 'CaseAssignment',
      entity_id: assignment.id,
      metadata: { verifier_id, ml_result_id }
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Case assigned successfully',
      case: { assignedTo: verifier.name }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/dfo/activity
 */
const getDfoActivity = async (req, res) => {
  try {
    const activities = await AuditLog.findAll({
      limit: 20,
      order: [['created_at', 'DESC']],
      include: [{ model: User, attributes: ['name'] }]
    });
    return res.status(200).json({ success: true, data: activities });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getDfoStats,
  getCases,
  getDistrictVerifiers,
  assignCase,
  getDfoActivity,
};

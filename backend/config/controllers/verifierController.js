const { CaseAssignment, FieldVerification, MlResult, Beneficiary, Transaction, AuditLog, Scheme, User } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/verifier/stats
 * Returns camelCase keys: assigned, pending, completed
 */
const getVerifierStats = async (req, res) => {
  const verifier_id = req.user.id;

  try {
    const assigned = await CaseAssignment.count({
      where: { assigned_to: verifier_id }
    });

    const pending = await CaseAssignment.count({
      where: { assigned_to: verifier_id, status: 'assigned' }
    });

    const completed = await CaseAssignment.count({
      where: { assigned_to: verifier_id, status: 'completed' }
    });

    return res.status(200).json({
      success: true,
      data: { assigned, pending, completed }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/verifier/inbox
 * Returns cases assigned to this verifier that are still pending.
 */
const getVerifierInbox = async (req, res) => {
  const verifier_id = req.user.id;

  try {
    const tasks = await CaseAssignment.findAll({
      where: { 
        assigned_to: verifier_id,
        status: 'assigned'
      },
      include: [
        {
          model: MlResult,
          include: [
            { model: Beneficiary },
            { model: Transaction, include: [{ model: Scheme, attributes: ['name'], required: false }] }
          ]
        },
        { model: User, as: 'Assigner', attributes: ['name'], required: false }
      ],
      order: [['created_at', 'DESC']]
    });

    const data = tasks.map(task => {
      const mlResult = task.MlResult || {};
      const ben = mlResult.Beneficiary || {};
      const tx = mlResult.Transaction || {};
      const scheme = tx.Scheme || {};
      const assigner = task.Assigner || {};

      return {
        id: String(task.id),
        beneficiary: ben.name || 'Unknown',
        aadhaar: mlResult.aadhaar_masked || '********0000',
        scheme: scheme.name || 'Unknown',
        amount: parseFloat(tx.amount) || 0,
        anomalyType: mlResult.leakage_category || 'None',
        riskScore: Math.round(mlResult.risk_score || 0),
        assignedDate: task.created_at ? new Date(task.created_at).toLocaleDateString('en-IN') : 'N/A',
        district: ben.district || 'Unknown',
        address: `${ben.district || 'Unknown'}, Gujarat`,
        phone: ben.phone_number || 'N/A',
        assignedBy: assigner.name || 'System',
        // Beneficiary lat/lng for GPS navigation
        latitude: ben.latitude || 23.0225,
        longitude: ben.longitude || 72.5714
      };
    });

    return res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/cases/:id/verify
 * Submits field verification — marks assignment as completed.
 */
const submitVerification = async (req, res) => {
  const assignment_id = req.params.id;
  const is_fraud = req.body.is_fraud || req.body.isFraud || false;
  const remarks = req.body.remarks || req.body.notes || '';
  const latitude = req.body.latitude || null;
  const longitude = req.body.longitude || null;
  const photo_url = req.body.photo_url || null;
  const verification_status = req.body.verification_status || 'completed';
  const verifier_id = req.user.id;

  try {
    const assignment = await CaseAssignment.findByPk(assignment_id);
    if (!assignment || assignment.assigned_to !== verifier_id) {
      return res.status(403).json({ success: false, error: 'Assignment not found or unauthorized' });
    }

    const verification = await FieldVerification.create({
      assignment_ref: assignment_id,
      verifier_id,
      is_fraud,
      remarks,
      latitude,
      longitude,
      photo_url,
      verification_status
    });

    // Mark assignment as completed
    assignment.status = 'completed';
    await assignment.save();

    // Log activity
    await AuditLog.create({
      user_id: verifier_id,
      action: is_fraud ? 'FRAUD_CONFIRMED' : 'VERIFIED_LEGITIMATE',
      entity_type: 'CaseAssignment',
      entity_id: assignment_id,
      metadata: { is_fraud, remarks, latitude, longitude }
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Verification submitted successfully',
      data: { verificationId: verification.id }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getVerifierStats,
  getVerifierInbox,
  submitVerification,
};

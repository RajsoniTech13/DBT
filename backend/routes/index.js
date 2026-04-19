const express = require('express');
const router = express.Router();

const { authenticate, authorize } = require('../middleware/auth');

const { register, login } = require('../controllers/authController');
const { loadFromHadoop, analyze } = require('../controllers/dataController');

const {
  getDfoStats,
  getCases,
  getDistrictVerifiers,
  assignCase,
  getDfoActivity,
} = require('../controllers/dfoController');

const {
  getVerifierStats,
  getVerifierInbox,
  submitVerification,
} = require('../controllers/verifierController');

const {
  getAuditStats,
  getDuplicateFlags,
  getComplianceSummary,
  getTemporalAnalysis,
} = require('../controllers/auditController');

const {
  getAdminSummary,
  getHeatmapData,
  getSystemRules,
  updateSystemRule,
} = require('../controllers/adminController');

// --- Health ---
router.get('/health', (req, res) => res.status(200).json({ status: 'UP' }));

// --- Public Auth ---
router.post('/auth/register', register);
router.post('/auth/login', login);

// --- Data Pipeline (Admin Only) ---
router.post('/analyze', authenticate, authorize('ADMIN'), analyze);
router.post('/load-from-hadoop', authenticate, authorize('ADMIN'), loadFromHadoop);

// --- 🏛️ District Finance Officer (DFO) ---
router.get('/dfo/stats', authenticate, authorize('DFO', 'ADMIN'), getDfoStats);
router.get('/dfo/cases', authenticate, authorize('DFO', 'ADMIN'), getCases);
router.get('/dfo/verifiers', authenticate, authorize('DFO', 'ADMIN'), getDistrictVerifiers);
router.post('/cases/:id/assign', authenticate, authorize('DFO', 'ADMIN'), assignCase);
router.get('/dfo/activity', authenticate, authorize('DFO', 'ADMIN'), getDfoActivity);

// --- 🔍 Scheme Verifier ---
router.get('/verifier/stats', authenticate, authorize('VERIFIER', 'ADMIN'), getVerifierStats);
router.get('/verifier/inbox', authenticate, authorize('VERIFIER', 'ADMIN'), getVerifierInbox);
router.post('/cases/:id/verify', authenticate, authorize('VERIFIER', 'ADMIN'), submitVerification);

// --- 📊 Audit Team Member ---
router.get('/audit/stats', authenticate, authorize('AUDITOR', 'ADMIN'), getAuditStats);
router.get('/audit/duplicates', authenticate, authorize('AUDITOR', 'ADMIN'), getDuplicateFlags);
router.get('/audit/compliance', authenticate, authorize('AUDITOR', 'ADMIN'), getComplianceSummary);
router.get('/audit/analysis/:type', authenticate, authorize('AUDITOR', 'ADMIN'), getTemporalAnalysis);
// router.post('/audit/query', authenticate, authorize('AUDITOR', 'ADMIN'), advancedSearch); // Link to search if needed

// --- 🛡️ State DBT Admin ---
router.get('/admin/summary', authenticate, authorize('ADMIN'), getAdminSummary);
router.get('/admin/rules', authenticate, authorize('ADMIN'), getSystemRules);
router.patch('/admin/rules/:id', authenticate, authorize('ADMIN'), updateSystemRule);
router.get('/admin/heatmap', authenticate, authorize('ADMIN'), getHeatmapData);

module.exports = router;

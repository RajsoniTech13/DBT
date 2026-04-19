const { sequelize } = require('../config/db');
const User = require('./User');
const Beneficiary = require('./Beneficiary');
const Transaction = require('./Transaction');
const MlResult = require('./MlResult');
const CaseAssignment = require('./CaseAssignment');
const FieldVerification = require('./FieldVerification');
const AuditLog = require('./AuditLog');
const AnalyticsSummary = require('./AnalyticsSummary');
const SystemConfig = require('./SystemConfig');
const Scheme = require('./Scheme');

// --- Define Relationships ---

// Beneficiary -> Transaction (1:Many)
Beneficiary.hasMany(Transaction, { foreignKey: 'beneficiary_ref' });
Transaction.belongsTo(Beneficiary, { foreignKey: 'beneficiary_ref' });

// Beneficiary -> MlResult (1:Many)
Beneficiary.hasMany(MlResult, { foreignKey: 'beneficiary_ref' });
MlResult.belongsTo(Beneficiary, { foreignKey: 'beneficiary_ref' });

// Transaction -> MlResult (1:1)
Transaction.hasOne(MlResult, { foreignKey: 'transaction_ref' });
MlResult.belongsTo(Transaction, { foreignKey: 'transaction_ref' });

// Scheme -> Transaction (1:Many)
Scheme.hasMany(Transaction, { foreignKey: 'scheme_id' });
Transaction.belongsTo(Scheme, { foreignKey: 'scheme_id' });

// MlResult -> CaseAssignment (1:Many usually, or 1:1 if 1 case per result)
MlResult.hasOne(CaseAssignment, { foreignKey: 'result_ref' });
CaseAssignment.belongsTo(MlResult, { foreignKey: 'result_ref' });

// User -> CaseAssignment (1:Many for assignment routing)
User.hasMany(CaseAssignment, { foreignKey: 'assigned_by', as: 'CreatedCases' });
CaseAssignment.belongsTo(User, { foreignKey: 'assigned_by', as: 'Assigner' });

User.hasMany(CaseAssignment, { foreignKey: 'assigned_to', as: 'Tasks' });
CaseAssignment.belongsTo(User, { foreignKey: 'assigned_to', as: 'Assignee' });

// CaseAssignment -> FieldVerification (1:1 usually, or 1:Many)
CaseAssignment.hasMany(FieldVerification, { foreignKey: 'assignment_ref' });
FieldVerification.belongsTo(CaseAssignment, { foreignKey: 'assignment_ref' });

// User -> FieldVerification (Verifiers logging results)
User.hasMany(FieldVerification, { foreignKey: 'verifier_id' });
FieldVerification.belongsTo(User, { foreignKey: 'verifier_id' });

// User -> AuditLog (1:Many)
User.hasMany(AuditLog, { foreignKey: 'user_id' });
AuditLog.belongsTo(User, { foreignKey: 'user_id' });


const syncDB = async () => {
  try {
    await sequelize.sync({ alter: true }); // Automatically updates schema if changed
    console.log('Database synchronized.');
  } catch (error) {
    console.error('Failed to sync DB:', error);
  }
};

module.exports = {
  sequelize,
  User,
  Beneficiary,
  Transaction,
  MlResult,
  CaseAssignment,
  FieldVerification,
  AuditLog,
  AnalyticsSummary,
  SystemConfig,
  Scheme,
  syncDB,
};

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const MlResult = sequelize.define('MlResult', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  beneficiary_ref: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  transaction_ref: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  aadhaar_masked: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  risk_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  is_flagged: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  leakage_category: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  evidence: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'ml_results',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [
    {
      unique: true,
      fields: ['beneficiary_ref', 'transaction_ref'],
    }
  ]
});

module.exports = MlResult;

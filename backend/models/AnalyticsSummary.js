const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const AnalyticsSummary = sequelize.define('AnalyticsSummary', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  scheme: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  total_transactions: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  flagged_cases: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  avg_risk_score: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  last_updated: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'analytics_summary',
  timestamps: false,
});

module.exports = AnalyticsSummary;

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const CaseAssignment = sequelize.define('CaseAssignment', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  result_ref: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  assigned_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  assigned_to: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'assigned',
  },
}, {
  tableName: 'case_assignments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = CaseAssignment;

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SystemConfig = sequelize.define('SystemConfig', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  severity: {
    type: DataTypes.STRING(20),
    allowNull: true, // Low, Medium, High
  },
  is_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  threshold_value: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'system_configs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SystemConfig;

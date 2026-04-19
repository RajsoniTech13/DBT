const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Scheme = sequelize.define('Scheme', {
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
  min_eligibility_age: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  max_income_threshold: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },
}, {
  tableName: 'schemes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Scheme;

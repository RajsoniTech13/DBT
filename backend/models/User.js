const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
  },
  password_hash: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING(20),
    validate: {
      isIn: [['DFO', 'VERIFIER', 'AUDITOR', 'ADMIN']],
    },
    allowNull: true,
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  employeeId: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = User;

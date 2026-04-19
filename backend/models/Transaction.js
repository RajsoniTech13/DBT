const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  transaction_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  beneficiary_ref: {
    type: DataTypes.INTEGER,
    allowNull: true, // Will build relationship constraint
  },
  scheme_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  amount: {
    type: DataTypes.NUMERIC,
    allowNull: true,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: 'Success',
  },
  withdrawn: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  withdrawal_channel: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  device_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  time_to_withdraw_hours: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
}, {
  tableName: 'transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Transaction;

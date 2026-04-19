const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Beneficiary = sequelize.define('Beneficiary', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  beneficiary_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  aadhaar_hash: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  name_normalized: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  district: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  bank_account: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  phone_number: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },
  kyc_last_update: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  csc_operator_id: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'beneficiaries',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Beneficiary;

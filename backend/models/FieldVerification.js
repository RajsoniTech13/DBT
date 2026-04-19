const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const FieldVerification = sequelize.define('FieldVerification', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  assignment_ref: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  verifier_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  is_fraud: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  photo_url: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  verification_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'field_verifications',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = FieldVerification;

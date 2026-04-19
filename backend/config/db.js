const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'dbthackathon',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 10,
      min: 2,
      acquire: 60000,
      idle: 10000,
    },
    // Optimizations for bulk operations on 10,000 records
    dialectOptions: {
      statement_timeout: 60000,
    },
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log(' PostgreSQL connected successfully.');
  } catch (error) {
    console.error(' Unable to connect to PostgreSQL:', error.message);
    throw error;
  }
};

module.exports = { sequelize, connectDB };

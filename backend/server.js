const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { connectDB } = require('./config/db');
const { syncDB } = require('./models');
const routes = require('./routes');
const { logger } = require('./utils/helpers');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Request Logger (see every API call in docker logs) ─────────────────────
app.use((req, res, next) => {
  logger.info('HTTP', `${req.method} ${req.url}`);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP', `${req.method} ${req.url} → ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ─── Routes (mounted at /api) ────────────────────────────────────────────────
app.use('/api', routes);

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'DBT Leakage Detection Backend',
    timestamp: new Date().toISOString(),
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await connectDB();
    await syncDB();
    app.listen(PORT, () => {
      logger.info('Server', `Backend running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Server', 'Failed to start server', err);
    process.exit(1);
  }
};

startServer();

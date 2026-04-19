const jwt = require('jsonwebtoken');
require('dotenv').config();
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'dbt_secret_key_2026';

/**
 * Middleware to authenticate JWT token.
 * Attaches user object to request.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
  }
};

/**
 * Middleware to authorize specific roles.
 * Must be used AFTER authenticate middleware.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(500).json({ success: false, error: 'Authorize middleware called before Authenticate' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: `Forbidden: Access restricted to ${roles.join(' or ')} role(s)` 
      });
    }

    next();
  };
};

module.exports = { authenticate, authorize };

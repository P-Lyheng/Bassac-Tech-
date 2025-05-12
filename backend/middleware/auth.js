const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  // Get token from header or cookies
  const token = req.cookies.token || 
                (req.headers.authorization && req.headers.authorization.split(' ')[1]);

  // Check if token exists
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists
    const [users] = await pool.query(
      'SELECT user_id, username, email, role FROM users WHERE user_id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid token: user not found' });
    }

    // Add user info to request
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware to check role permissions
const authorizeRole = (roles = []) => {
  // Convert single role to array
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized: No user found' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Forbidden: ${req.user.role} role is not allowed to access this resource` 
      });
    }

    next();
  };
};

// Middleware to verify user owns the resource or is admin
const authorizeResource = (resourceIdPath) => {
  return async (req, res, next) => {
    try {
      // No authorization needed for admins
      if (req.user.role === 'admin') {
        return next();
      }

      // Get resource ID from request based on path (e.g., 'params.userId')
      const parts = resourceIdPath.split('.');
      let resourceId = req;
      for (const part of parts) {
        resourceId = resourceId[part];
      }

      // Check if user owns resource
      if (resourceId == req.user.id) {
        return next();
      }

      res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
    } catch (error) {
      console.error('Resource authorization error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };
};

module.exports = { 
  authenticateToken,
  authorizeRole,
  authorizeResource
};
// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRole('admin'));

// Get admin dashboard stats
router.get('/stats', adminController.getStats);

// Get admin logs
router.get('/logs', adminController.getAdminLogs);

// Get system status
router.get('/system-status', adminController.getSystemStatus);

// Reset user password
router.post('/reset-password/:userId', adminController.resetUserPassword);

// Force verify user
router.post('/verify-user/:userId', adminController.verifyUser);

module.exports = router;
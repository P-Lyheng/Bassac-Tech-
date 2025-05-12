const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);

// Protected routes
router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authenticateToken, authController.logout);
router.post('/class-login', authenticateToken, authController.classLogin);
router.post('/class-logout', authenticateToken, authController.classLogout);

// Admin-only routes
router.post('/force-login', authenticateToken, authController.forceLogin);

module.exports = router;
// routes/teacher.routes.js
const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacher');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All routes require authentication and teacher/instructor role
router.use(authenticateToken);
router.use(authorizeRole(['instructor', 'teacher', 'admin']));

// Get teacher dashboard stats
router.get('/stats', teacherController.getStats);

// Get active sessions for teacher
router.get('/sessions/active', teacherController.getActiveSessions);

// Get upcoming sessions for teacher
router.get('/sessions/upcoming', teacherController.getUpcomingSessions);

// Get recent class activities
router.get('/activities', teacherController.getRecentActivities);

module.exports = router;
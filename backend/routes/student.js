// routes/student.routes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/student');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All routes require authentication and student role
router.use(authenticateToken);
router.use(authorizeRole(['student']));

// Get student dashboard stats
router.get('/stats', studentController.getStats);

// Get active sessions for student
router.get('/sessions/active', studentController.getActiveSessions);

// Get upcoming sessions for student
router.get('/sessions/upcoming', studentController.getUpcomingSessions);

// Get enrolled classes
router.get('/classes/enrolled', studentController.getEnrolledClasses);

// Get available learning materials
router.get('/materials', studentController.getLearningMaterials);

// Get completed session history
router.get('/sessions/history', studentController.getSessionHistory);

// Join a class with class code
router.post('/classes/join', studentController.joinClass);

module.exports = router;
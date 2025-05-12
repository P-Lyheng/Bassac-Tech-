const express = require('express');
const router = express.Router();
const classController = require('../controllers/class');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Create a new class (instructor/admin only)
router.post('/', 
  authenticateToken, 
  authorizeRole(['instructor', 'admin']), 
  classController.createClass
);

// Get all classes (admin only)
router.get('/all', 
  authenticateToken, 
  authorizeRole('admin'), 
  classController.getAllClasses
);

// Get instructor's classes
router.get('/instructor', 
  authenticateToken, 
  authorizeRole(['instructor', 'teacher']), 
  classController.getInstructorClasses
);

// Get student's classes
router.get('/student', 
  authenticateToken, 
  classController.getStudentClasses
);

// Get class by ID
router.get('/:classId', 
  authenticateToken, 
  classController.getClassById
);

// Update class
router.patch('/:classId', 
  authenticateToken, 
  classController.updateClass
);

// Update class password
router.post('/:classId/password', 
  authenticateToken, 
  classController.updateClassPassword
);

// Delete class
router.delete('/:classId', 
  authenticateToken, 
  classController.deleteClass
);

// Enroll in class
router.post('/enroll', 
  authenticateToken, 
  classController.enrollInClass
);

// Get class enrollments (instructor/admin only)
router.get('/:classId/enrollments', 
  authenticateToken, 
  classController.getClassEnrollments
);

// Update enrollment status (instructor/admin only)
router.patch('/enrollments/:enrollmentId', 
  authenticateToken, 
  classController.updateEnrollmentStatus
);

// Drop enrollment
router.delete('/:classId/enroll', 
  authenticateToken, 
  classController.dropEnrollment
);

module.exports = router;
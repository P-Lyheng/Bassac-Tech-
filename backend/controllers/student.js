const bcrypt = require('bcryptjs');

// controllers/student.controller.js

const { pool } = require('../config/db');

// Get student dashboard stats
const getStats = async (req, res) => {
  const studentId = req.user.id;

  try {
    // Get enrolled classes count
    const [classesResult] = await pool.query(
      `SELECT COUNT(*) as count 
       FROM class_enrollments 
       WHERE student_id = ? AND status = 'approved'`,
      [studentId]
    );
    
    // Get completed sessions count
    const [completedSessionsResult] = await pool.query(
      `SELECT COUNT(DISTINCT cs.session_id) as count
       FROM class_sessions cs
       JOIN class_login_sessions cls ON cs.session_id = cls.session_id
       JOIN class_enrollments ce ON cs.class_id = ce.class_id
       WHERE ce.student_id = ? 
       AND cs.session_status = 'completed' 
       AND cls.student_id = ?`,
      [studentId, studentId]
    );
    
    // Get upcoming sessions count
    const [upcomingSessionsResult] = await pool.query(
      `SELECT COUNT(*) as count
       FROM class_sessions cs
       JOIN class_enrollments ce ON cs.class_id = ce.class_id
       WHERE ce.student_id = ? 
       AND cs.session_status = 'scheduled' 
       AND cs.scheduled_start > NOW()`,
      [studentId]
    );
    
    // Get active sessions count
    const [activeSessionsResult] = await pool.query(
      `SELECT COUNT(*) as count
       FROM class_sessions cs
       JOIN class_enrollments ce ON cs.class_id = ce.class_id
       WHERE ce.student_id = ? 
       AND cs.session_status = 'active'`,
      [studentId]
    );
    
    // Get available learning materials count
    const [materialsResult] = await pool.query(
      `SELECT COUNT(*) as count
       FROM class_materials cm
       JOIN class_enrollments ce ON cm.class_id = ce.class_id
       WHERE ce.student_id = ? AND ce.status = 'approved'`,
      [studentId]
    );
    
    res.json({
      enrolledClassesCount: classesResult[0].count,
      completedSessionsCount: completedSessionsResult[0].count,
      upcomingSessionsCount: upcomingSessionsResult[0].count,
      activeSessionsCount: activeSessionsResult[0].count,
      materialsCount: materialsResult[0].count
    });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get active sessions for student
const getActiveSessions = async (req, res) => {
  const studentId = req.user.id;

  try {
    const [sessions] = await pool.query(
      `SELECT s.*, c.title as class_name, c.class_id,
       (SELECT COUNT(*) FROM class_login_sessions WHERE session_id = s.session_id AND is_active = TRUE) as participants_count,
       u.username as instructor_name
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id
       JOIN class_enrollments ce ON c.class_id = ce.class_id
       LEFT JOIN users u ON c.instructor_id = u.user_id
       WHERE ce.student_id = ? AND s.session_status = 'active' AND ce.status = 'approved'
       ORDER BY s.actual_start DESC`,
      [studentId]
    );
    
    res.json(sessions);
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get upcoming sessions for student
const getUpcomingSessions = async (req, res) => {
  const studentId = req.user.id;

  try {
    const [sessions] = await pool.query(
      `SELECT s.*, c.title as class_name
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id
       JOIN class_enrollments ce ON c.class_id = ce.class_id
       WHERE ce.student_id = ? AND s.session_status = 'scheduled' AND s.scheduled_start > NOW() AND ce.status = 'approved'
       ORDER BY s.scheduled_start ASC
       LIMIT 10`,
      [studentId]
    );
    
    res.json(sessions);
  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get enrolled classes for student
const getEnrolledClasses = async (req, res) => {
  const studentId = req.user.id;

  try {
    const [classes] = await pool.query(
      `SELECT c.*, ce.enrollment_date, ce.status as enrollment_status,
       u.username as instructor_name,
       (SELECT COUNT(*) FROM class_enrollments WHERE class_id = c.class_id AND status = 'approved') as enrolled_count
       FROM classes c
       JOIN class_enrollments ce ON c.class_id = ce.class_id
       LEFT JOIN users u ON c.instructor_id = u.user_id
       WHERE ce.student_id = ?
       ORDER BY ce.enrollment_date DESC`,
      [studentId]
    );
    
    res.json(classes);
  } catch (error) {
    console.error('Get enrolled classes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get available learning materials for student
const getLearningMaterials = async (req, res) => {
  const studentId = req.user.id;
  const classId = req.query.classId; // Optional filter by class

  try {
    let query = `
      SELECT cm.*, c.title as class_name, u.username as uploaded_by
      FROM class_materials cm
      JOIN classes c ON cm.class_id = c.class_id
      JOIN class_enrollments ce ON c.class_id = ce.class_id
      LEFT JOIN users u ON cm.uploaded_by = u.user_id
      WHERE ce.student_id = ? AND ce.status = 'approved'
    `;
    
    const queryParams = [studentId];
    
    // Add class filter if provided
    if (classId) {
      query += ` AND cm.class_id = ?`;
      queryParams.push(classId);
    }
    
    query += ` ORDER BY cm.upload_date DESC`;
    
    const [materials] = await pool.query(query, queryParams);
    
    res.json(materials);
  } catch (error) {
    console.error('Get learning materials error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get completed sessions history
const getSessionHistory = async (req, res) => {
  const studentId = req.user.id;

  try {
    const [sessions] = await pool.query(
      `SELECT s.*, c.title as class_name, cls.join_time, cls.leave_time,
       TIMESTAMPDIFF(MINUTE, cls.join_time, COALESCE(cls.leave_time, s.actual_end)) as attendance_minutes
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id
       JOIN class_enrollments ce ON c.class_id = ce.class_id
       LEFT JOIN class_login_sessions cls ON s.session_id = cls.session_id AND cls.student_id = ?
       WHERE ce.student_id = ? AND s.session_status = 'completed' AND ce.status = 'approved'
       ORDER BY s.actual_end DESC
       LIMIT 20`,
      [studentId, studentId]
    );
    
    res.json(sessions);
  } catch (error) {
    console.error('Get session history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Join a class with class code
const joinClass = async (req, res) => {
  const studentId = req.user.id;
  const { classCode, classPassword } = req.body;
  try {
    // Find class by code
    const [classResults] = await pool.query(
      'SELECT * FROM classes WHERE class_code = ?',
      [classCode]
    );
    
    if (classResults.length === 0) {
      return res.status(404).json({ message: 'Class not found with this code' });
    }
    
    const classData = classResults[0];
    
    // Verify password
    const isMatch = await bcrypt.compare(classData.class_password, classPassword);
    if ( isMatch) {

      return res.status(401).json({ message: 'Incorrect class password' , ismatch : isMatch});
    }
    
    // Check if already enrolled
    const [enrollmentCheck] = await pool.query(
      'SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ?',
      [classData.class_id, studentId]
    );
    
    if (enrollmentCheck.length > 0) {
      return res.status(400).json({ 
        message: 'You are already enrolled in this class', 
        status: enrollmentCheck[0].status 
      });
    }
    
    // Check if class is full
    const [enrollmentCount] = await pool.query(
      'SELECT COUNT(*) as count FROM class_enrollments WHERE class_id = ? AND status = "approved"',
      [classData.class_id]
    );
    
    if (enrollmentCount[0].count >= classData.capacity) {
      return res.status(400).json({ message: 'This class is already full' });
    }
    
    // Create enrollment
    const [enrolled] = await pool.query(
      `INSERT INTO class_enrollments (class_id, student_id, enrolled_at, status) 
       VALUES (?, ?, NOW(), ?)`,
      [classData.class_id, studentId, classData.auto_approve ? 'approved' : 'pending']
    );
    
    res.status(201).json({ 
      message: `Successfully joined class. ${classData.auto_approve ? 'You are now enrolled.' : 'Your enrollment is pending approval.'}`,
      classId: classData.class_id,
      status: classData.auto_approve ? 'approved' : 'pending'
    });
  } catch (error) {
    console.error('Join class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getStats,
  getActiveSessions,
  getUpcomingSessions,
  getEnrolledClasses,
  getLearningMaterials,
  getSessionHistory,
  joinClass
};
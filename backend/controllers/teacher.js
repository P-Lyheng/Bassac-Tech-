// controllers/teacher.controller.js
const { pool } = require('../config/db');

// Get teacher dashboard stats
const getStats = async (req, res) => {
  const teacherId = req.user.id;

  try {
    // Get classes count
    const [classesResult] = await pool.query(
      'SELECT COUNT(*) as count FROM classes WHERE instructor_id = ? OR teacher_id = ?',
      [teacherId, teacherId]
    );
    
    // Get students count
    const [studentsResult] = await pool.query(
      `SELECT COUNT(DISTINCT student_id) as count 
       FROM class_enrollments e
       JOIN classes c ON e.class_id = c.class_id
       WHERE (c.instructor_id = ? OR c.teacher_id = ?) AND e.status = 'approved'`,
      [teacherId, teacherId]
    );
    
    // Get sessions count
    const [sessionsResult] = await pool.query(
      `SELECT COUNT(*) as count
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id
       WHERE c.instructor_id = ? OR c.teacher_id = ?`,
      [teacherId, teacherId]
    );
    
    // Get active sessions count
    const [activeSessionsResult] = await pool.query(
      `SELECT COUNT(*) as count
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id
       WHERE (c.instructor_id = ? OR c.teacher_id = ?) AND s.session_status = 'active'`,
      [teacherId, teacherId]
    );
    
    res.json({
      classesCount: classesResult[0].count,
      studentsCount: studentsResult[0].count,
      sessionsCount: sessionsResult[0].count,
      activeSessionsCount: activeSessionsResult[0].count
    });
  } catch (error) {
    console.error('Get teacher stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get active sessions for teacher
const getActiveSessions = async (req, res) => {
  
  const teacherId = req.user.id;

  try {
    const [sessions] = await pool.query(
      `SELECT s.*, c.title as class_name, c.class_id,
       (SELECT COUNT(*) FROM class_login_sessions WHERE session_id = s.session_id AND is_active = TRUE) as participants_count,
       u.username as instructor_name
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id
       LEFT JOIN users u ON c.instructor_id = u.user_id
       WHERE (c.instructor_id = ? OR c.teacher_id = ?) AND s.session_status = 'active'
       ORDER BY s.actual_start DESC`,
      [teacherId, teacherId]
    );
    
    res.json(sessions);
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get upcoming sessions for teacher
const getUpcomingSessions = async (req, res) => {
  const teacherId = req.user.id;

  try {
    await pool.query(`
        UPDATE class_sessions
        SET session_status = 
          CASE 
            WHEN NOW() < scheduled_start THEN 'scheduled'
            WHEN NOW() >= scheduled_start AND NOW() <= scheduled_end THEN 'active'
            WHEN NOW() > scheduled_end THEN 'cancelled'
            ELSE session_status
          END
      `);
  

    const [sessions] = await pool.query(
      `SELECT s.*, c.title as class_name
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id
       WHERE (c.instructor_id = ? OR c.teacher_id = ?) AND s.session_status = 'scheduled'
       ORDER BY s.scheduled_start ASC
       LIMIT 10`,
      [teacherId, teacherId]
    );

    
    console.log('Upcoming sessions:', sessions);
    res.json(sessions);
    
  } catch (error) {
    console.error('Get upcoming sessions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get recent class activities
const getRecentActivities = async (req, res) => {
  const teacherId = req.user.id;

  try {
    // Get recent enrollments
    const [enrollments] = await pool.query(
      `SELECT e.*, c.title as class_name, u.username
       FROM class_enrollments e
       JOIN classes c ON e.class_id = c.class_id
       JOIN users u ON e.student_id = u.user_id
       WHERE c.instructor_id = ? OR c.teacher_id = ?
       ORDER BY e.enrollment_date DESC
       LIMIT 5`,
      [teacherId, teacherId]
    );
    
    // Combine and sort activities
    const activities = enrollments.map(e => ({
      type: 'enrollment',
      date: e.enrollment_date,
      data: e
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
    
    res.json(activities);
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getStats,
  getActiveSessions,
  getUpcomingSessions,
  getRecentActivities
};
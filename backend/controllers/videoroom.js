// controllers/videoroom.controller.js
const { pool } = require('../config/db');

// Get session details for video room
const getSessionDetails = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Get session information
    const [sessions] = await pool.query(
      `SELECT s.*, c.class_name, c.instructor_id, c.class_id 
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id 
       WHERE s.session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessions[0];

    // Check if user has access to this session
    const isInstructor = session.instructor_id == userId;
    
    if (req.user.role !== 'admin' && !isInstructor) {
      // Check if student is enrolled
      const [enrollments] = await pool.query(
        'SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ? AND status = "approved"',
        [session.class_id, userId]
      );

      if (enrollments.length === 0) {
        return res.status(403).json({ 
          message: 'You do not have access to this session' 
        });
      }
    }

    // Get participants count
    const [participants] = await pool.query(
      'SELECT COUNT(*) as count FROM class_login_sessions WHERE session_id = ? AND is_active = TRUE',
      [sessionId]
    );

    // Return session details with room ID
    res.json({
      sessionId: session.session_id,
      sessionName: session.session_name,
      className: session.class_name,
      status: session.session_status,
      roomId: session.room_id,
      scheduledStart: session.scheduled_start,
      scheduledEnd: session.scheduled_end,
      actualStart: session.actual_start,
      actualEnd: session.actual_end,
      participantsCount: participants[0].count
    });

  } catch (error) {
    console.error('Get session details error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Record user joining video room
const joinVideoRoom = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Get session information
    const [sessions] = await pool.query(
      `SELECT s.*, c.class_id 
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id 
       WHERE s.session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessions[0];

    // Create or update login session
    // First, check if user already has an active session
    const [loginSessions] = await pool.query(
      'SELECT * FROM class_login_sessions WHERE student_id = ? AND session_id = ? AND is_active = TRUE',
      [userId, sessionId]
    );

    if (loginSessions.length === 0) {
      // Create new login session
      await pool.query(
        `INSERT INTO class_login_sessions 
        (student_id, class_id, session_id, ip_address, user_agent) 
        VALUES (?, ?, ?, ?, ?)`,
        [userId, session.class_id, sessionId, req.ip, req.headers['user-agent']]
      );
    }

    // Update attendance record if session is active
    if (session.session_status === 'active') {
      // Check if attendance record exists
      const [attendance] = await pool.query(
        'SELECT * FROM session_attendance WHERE session_id = ? AND student_id = ?',
        [sessionId, userId]
      );

      if (attendance.length > 0) {
        // Update existing record
        await pool.query(
          'UPDATE session_attendance SET join_time = NOW(), attendance_status = "present" WHERE session_id = ? AND student_id = ?',
          [sessionId, userId]
        );
      } else {
        // Create new attendance record
        await pool.query(
          'INSERT INTO session_attendance (session_id, student_id, join_time, attendance_status) VALUES (?, ?, NOW(), "present")',
          [sessionId, userId]
        );
      }
    }

    res.json({ 
      message: 'Joined video room successfully',
      sessionId: session.session_id,
      roomId: session.room_id
    });

  } catch (error) {
    console.error('Join video room error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Record user leaving video room
const leaveVideoRoom = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Update login session
    await pool.query(
      'UPDATE class_login_sessions SET logout_time = NOW(), is_active = FALSE WHERE session_id = ? AND student_id = ? AND is_active = TRUE',
      [sessionId, userId]
    );

    // Update attendance record if exists
    await pool.query(
      'UPDATE session_attendance SET leave_time = NOW() WHERE session_id = ? AND student_id = ? AND leave_time IS NULL',
      [sessionId, userId]
    );

    res.json({ message: 'Left video room successfully' });

  } catch (error) {
    console.error('Leave video room error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Save chat message to database
const saveChatMessage = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;
  const { message, isPrivate, recipientId } = req.body;

  try {
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // Store message in database
    await pool.query(
      `INSERT INTO chat_messages 
       (session_id, sender_id, message_text, is_private, recipient_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        sessionId,
        userId,
        message,
        isPrivate || false,
        isPrivate ? recipientId : null
      ]
    );

    res.status(201).json({ message: 'Message saved successfully' });

  } catch (error) {
    console.error('Save chat message error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get chat history for a session
const getChatHistory = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Get chat messages
    const [messages] = await pool.query(
      `SELECT m.*, u.username as sender_name, u.role as sender_role
       FROM chat_messages m
       JOIN users u ON m.sender_id = u.user_id
       WHERE m.session_id = ? AND (
         m.is_private = FALSE OR 
         m.sender_id = ? OR 
         m.recipient_id = ?
       )
       ORDER BY m.sent_at ASC`,
      [sessionId, userId, userId]
    );

    res.json(messages);

  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getSessionDetails,
  joinVideoRoom,
  leaveVideoRoom,
  saveChatMessage,
  getChatHistory
};
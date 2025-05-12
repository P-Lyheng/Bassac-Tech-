const { pool } = require("../config/db");
const { generateRoomId, formatDate, formatTime } = require("../utils/helpers");

// Create a class session
const createSession = async (req, res) => {
  const { classId, sessionName, description, scheduledStart, scheduledEnd } =
    req.body;

  const userId = req.user.id;

  try {
    // Check if class exists and user is instructor
    const [classes] = await pool.query(
      "SELECT * FROM classes WHERE class_id = ?",
      [classId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Check if user is instructor or admin
    if (req.user.role !== "admin" && classes[0].instructor_id != userId) {
      return res.status(403).json({
        message: "You are not authorized to create sessions for this class",
      });
    }

    // Validate scheduled times
    const startDate = new Date(scheduledStart);
    const endDate = new Date(scheduledEnd);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    if (startDate >= endDate) {
      return res.status(400).json({
        message: "End time must be after start time",
      });
    }

    // Generate unique room ID
    const roomId = generateRoomId(10);
    console.log("Generated room ID:", roomId);
    // Insert session
    const [result] = await pool.query(
      `INSERT INTO class_sessions 
      (class_id, title, description, room_id, scheduled_start, 
       scheduled_end, session_status, created_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        classId,
        sessionName,
        description,
        roomId,
        scheduledStart,
        scheduledEnd,
        "scheduled",
        userId,
      ]
    );

    res.status(201).json({
      message: "Session created successfully",
      sessionId: result.insertId,
      roomId,
    });
  } catch (error) {
    console.error("Create session error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get class sessions
const getClassSessions = async (req, res) => {
  const classId = req.params.classId;
  const userId = req.user.id;

  try {
    // Check if class exists
    const [classes] = await pool.query(
      "SELECT * FROM classes WHERE class_id = ?",
      [classId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Check access permission
    const isInstructor = classes[0].instructor_id == userId;

    if (req.user.role !== "admin" && !isInstructor) {
      // Check if student is enrolled
      const [enrollments] = await pool.query(
        'SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ? AND status = "approved"',
        [classId, userId]
      );

      if (enrollments.length === 0) {
        return res.status(403).json({
          message: "You do not have access to this class",
        });
      }
    }

    // Get sessions
    const [sessions] = await pool.query(
      `SELECT * FROM class_sessions 
       WHERE class_id = ? 
       ORDER BY scheduled_start DESC`,
      [classId]
    );

    // Format response
    const formattedSessions = sessions.map((session) => {
      return {
        ...session,
        scheduledStart:
          formatDate(session.scheduled_start) +
          " " +
          formatTime(session.scheduled_start),
        scheduledEnd:
          formatDate(session.scheduled_end) +
          " " +
          formatTime(session.scheduled_end),
        actualStart: session.actual_start
          ? formatDate(session.actual_start) +
            " " +
            formatTime(session.actual_start)
          : null,
        actualEnd: session.actual_end
          ? formatDate(session.actual_end) +
            " " +
            formatTime(session.actual_end)
          : null,
      };
    });

    res.json(formattedSessions);
  } catch (error) {
    console.error("Get class sessions error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get session by ID
const getSessionById = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Get session
    const [sessions] = await pool.query(
      `SELECT s.*, c.class_name, c.instructor_id 
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id 
       WHERE s.session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    const session = sessions[0];

    // Check access permission
    const isInstructor = session.instructor_id == userId;

    if (req.user.role !== "admin" && !isInstructor) {
      // Check if student is enrolled
      const [enrollments] = await pool.query(
        'SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ? AND status = "approved"',
        [session.class_id, userId]
      );

      if (enrollments.length === 0) {
        return res.status(403).json({
          message: "You do not have access to this session",
        });
      }
    }

    // Get attendance stats for instructor view
    if (isInstructor || req.user.role === "admin") {
      const [attendanceStats] = await pool.query(
        `SELECT 
          COUNT(*) as total_students,
          SUM(CASE WHEN attendance_status = 'present' THEN 1 ELSE 0 END) as present_count,
          SUM(CASE WHEN attendance_status = 'late' THEN 1 ELSE 0 END) as late_count,
          SUM(CASE WHEN attendance_status = 'absent' THEN 1 ELSE 0 END) as absent_count,
          SUM(CASE WHEN attendance_status = 'excused' THEN 1 ELSE 0 END) as excused_count
        FROM session_attendance
        WHERE session_id = ?`,
        [sessionId]
      );

      session.attendanceStats = attendanceStats[0];
    }

    // Get student's own attendance if applicable
    if (req.user.role === "student") {
      const [attendance] = await pool.query(
        "SELECT * FROM session_attendance WHERE session_id = ? AND student_id = ?",
        [sessionId, userId]
      );

      session.userAttendance = attendance.length > 0 ? attendance[0] : null;
    }

    // Format dates
    session.scheduledStart =
      formatDate(session.scheduled_start) +
      " " +
      formatTime(session.scheduled_start);
    session.scheduledEnd =
      formatDate(session.scheduled_end) +
      " " +
      formatTime(session.scheduled_end);
    session.actualStart = session.actual_start
      ? formatDate(session.actual_start) +
        " " +
        formatTime(session.actual_start)
      : null;
    session.actualEnd = session.actual_end
      ? formatDate(session.actual_end) + " " + formatTime(session.actual_end)
      : null;

    res.json(session);
  } catch (error) {
    console.error("Get session error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update session
const updateSession = async (req, res) => {
  const {
    sessionName,
    description,
    scheduledStart,
    scheduledEnd,
    sessionStatus,
  } = req.body;

  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Check if session exists and user is instructor
    const [sessions] = await pool.query(
      `SELECT s.*, c.instructor_id 
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id 
       WHERE s.session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Check if user is instructor or admin
    if (req.user.role !== "admin" && sessions[0].instructor_id != userId) {
      return res.status(403).json({
        message: "You are not authorized to update this session",
      });
    }

    // Prevent updating if session is completed or cancelled
    if (["completed", "cancelled"].includes(sessions[0].session_status)) {
      return res.status(400).json({
        message: `Cannot update a ${sessions[0].session_status} session`,
      });
    }

    // Create update query based on provided fields
    let updateFields = [];
    let updateValues = [];

    if (sessionName) {
      updateFields.push("title = ?");
      updateValues.push(sessionName);
    }

    if (description !== undefined) {
      updateFields.push("description = ?");
      updateValues.push(description);
    }

    if (scheduledStart) {
      updateFields.push("scheduled_start = ?");
      updateValues.push(scheduledStart);
    }

    if (scheduledEnd) {
      updateFields.push("scheduled_end = ?");
      updateValues.push(scheduledEnd);
    }

    if (
      sessionStatus &&
      ["scheduled", "active", "completed", "cancelled"].includes(sessionStatus)
    ) {
      updateFields.push("session_status = ?");
      updateValues.push(sessionStatus);

      // Add actual start/end times for status changes
      if (
        sessionStatus === "active" &&
        sessions[0].session_status !== "active"
      ) {
        updateFields.push("actual_start = NOW()");
      }

      if (
        sessionStatus === "completed" &&
        sessions[0].session_status !== "completed"
      ) {
        updateFields.push("actual_end = NOW()");
      }
    }

    // No fields to update
    if (updateFields.length === 0) {
      return res
        .status(400)
        .json({ message: "No valid fields to update provided" });
    }

    // Add sessionId to values array
    updateValues.push(sessionId);

    // Update session
    await pool.query(
      `UPDATE class_sessions SET ${updateFields.join(
        ", "
      )} WHERE session_id = ?`,
      updateValues
    );

    res.json({ message: "Session updated successfully" });
  } catch (error) {
    console.error("Update session error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete session
const deleteSession = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Check if session exists and user is instructor
    const [sessions] = await pool.query(
      `SELECT s.*, c.instructor_id 
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id 
       WHERE s.session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Check if user is instructor or admin
    if (req.user.role !== "admin" && sessions[0].instructor_id != userId) {
      return res.status(403).json({
        message: "You are not authorized to delete this session",
      });
    }

    // Delete session
    await pool.query("DELETE FROM class_sessions WHERE session_id = ?", [
      sessionId,
    ]);

    res.json({ message: "Session deleted successfully" });
  } catch (error) {
    console.error("Delete session error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Start session (activate it)
const startSession = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Check if session exists and user is instructor
    const [sessions] = await pool.query(
      `SELECT s.*, c.instructor_id, c.class_id 
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id 
       WHERE s.session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Check if user is instructor or admin
    if (req.user.role !== "admin" && sessions[0].instructor_id != userId) {
      return res.status(403).json({
        message: "You are not authorized to start this session",
      });
    }

    // Check if session status is valid
    if (sessions[0].session_status !== "scheduled") {
      return res.status(400).json({
        message: `Cannot start a session with status: ${sessions[0].session_status}`,
      });
    }

    // Check if another session is already active
    const [activeSessions] = await pool.query(
      `SELECT * FROM class_sessions 
       WHERE class_id = ? AND session_status = 'active' AND session_id != ?`,
      [sessions[0].class_id, sessionId]
    );

    if (activeSessions.length > 0) {
      return res.status(400).json({
        message: "Another session is already active for this class",
      });
    }

    // Update session status
    await pool.query(
      `UPDATE class_sessions 
       SET session_status = 'active', actual_start = NOW() 
       WHERE session_id = ?`,
      [sessionId]
    );

    // Get all enrolled students
    const [enrollments] = await pool.query(
      `SELECT student_id FROM class_enrollments 
       WHERE class_id = ? AND status = 'approved'`,
      [sessions[0].class_id]
    );

    // Initialize attendance records for all enrolled students
    if (enrollments.length > 0) {
      const values = enrollments.map((enrollment) => [
        sessionId,
        enrollment.student_id,
        "absent",
      ]);

      // Batch insert attendance records
      await pool.query(
        `INSERT INTO session_attendance 
         (session_id, student_id, attendance_status) VALUES ?`,
        [values]
      );
    }

    res.json({
      message: "Session started successfully",
      roomId: sessions[0].room_id,
    });
  } catch (error) {
    console.error("Start session error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// End session
const endSession = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Check if session exists and user is instructor
    const [sessions] = await pool.query(
      `SELECT s.*, c.instructor_id 
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id 
       WHERE s.session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Check if user is instructor or admin
    if (req.user.role !== "admin" && sessions[0].instructor_id != userId) {
      return res.status(403).json({
        message: "You are not authorized to end this session",
      });
    }

    // Check if session status is valid
    if (sessions[0].session_status !== "active") {
      return res.status(400).json({
        message: `Cannot end a session with status: ${sessions[0].session_status}`,
      });
    }

    // Update session status
    await pool.query(
      `UPDATE class_sessions 
       SET session_status = 'completed', actual_end = NOW() 
       WHERE session_id = ?`,
      [sessionId]
    );

    // Update all active attendance records with leave time
    await pool.query(
      `UPDATE session_attendance 
       SET leave_time = NOW()
       WHERE session_id = ? AND leave_time IS NULL AND join_time IS NOT NULL`,
      [sessionId]
    );

    res.json({ message: "Session ended successfully" });
  } catch (error) {
    console.error("End session error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get session attendance
const getSessionAttendance = async (req, res) => {
  const sessionId = req.params.sessionId;
  const userId = req.user.id;

  try {
    // Check if session exists and user is instructor
    const [sessions] = await pool.query(
      `SELECT s.*, c.instructor_id 
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id 
       WHERE s.session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Check if user is instructor or admin
    if (req.user.role !== "admin" && sessions[0].instructor_id != userId) {
      return res.status(403).json({
        message: "You are not authorized to view attendance for this session",
      });
    }

    // Get attendance with student information
    const [attendance] = await pool.query(
      `SELECT a.*, u.username, u.email, u.profile_picture 
       FROM session_attendance a
       JOIN users u ON a.student_id = u.user_id
       WHERE a.session_id = ?
       ORDER BY u.username`,
      [sessionId]
    );

    res.json(attendance);
  } catch (error) {
    console.error("Get session attendance error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update student attendance status
const updateAttendanceStatus = async (req, res) => {
  const { attendanceStatus } = req.body;
  const sessionId = req.params.sessionId;
  const studentId = req.params.studentId;
  const userId = req.user.id;

  try {
    // Check if session exists and user is instructor
    const [sessions] = await pool.query(
      `SELECT s.*, c.instructor_id 
       FROM class_sessions s
       JOIN classes c ON s.class_id = c.class_id 
       WHERE s.session_id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ message: "Session not found" });
    }

    // Check if user is instructor or admin
    if (req.user.role !== "admin" && sessions[0].instructor_id != userId) {
      return res.status(403).json({
        message: "You are not authorized to update attendance for this session",
      });
    }

    // Validate attendance status
    if (!["present", "absent", "late", "excused"].includes(attendanceStatus)) {
      return res.status(400).json({ message: "Invalid attendance status" });
    }

    // Check if attendance record exists
    const [attendance] = await pool.query(
      "SELECT * FROM session_attendance WHERE session_id = ? AND student_id = ?",
      [sessionId, studentId]
    );

    if (attendance.length === 0) {
      // Create attendance record if it doesn't exist
      await pool.query(
        `INSERT INTO session_attendance 
         (session_id, student_id, attendance_status) 
         VALUES (?, ?, ?)`,
        [sessionId, studentId, attendanceStatus]
      );
    } else {
      // Update existing attendance record
      await pool.query(
        `UPDATE session_attendance 
         SET attendance_status = ? 
         WHERE session_id = ? AND student_id = ?`,
        [attendanceStatus, sessionId, studentId]
      );
    }

    res.json({ message: "Attendance status updated successfully" });
  } catch (error) {
    console.error("Update attendance status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createSession,
  getClassSessions,
  getSessionById,
  updateSession,
  deleteSession,
  startSession,
  endSession,
  getSessionAttendance,
  updateAttendanceStatus,
};

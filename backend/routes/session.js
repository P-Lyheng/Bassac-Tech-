const express = require("express");
const router = express.Router();
const sessionController = require("../controllers/sessioner");
const { authenticateToken, authorizeRole } = require("../middleware/auth");

// Create a new session (instructor/admin only)
router.post(
  "/",
  authenticateToken,
  authorizeRole(["instructor", "teacher"]),
  sessionController.createSession
);

// Get sessions for a class
router.get(
  "/class/:classId",
  authenticateToken,
  sessionController.getClassSessions
);

// Get session by ID
router.get("/:sessionId", authenticateToken, sessionController.getSessionById);

// Update session (instructor/admin only)
router.patch("/:sessionId", authenticateToken, sessionController.updateSession);

// Delete session (instructor/admin only)
router.delete(
  "/:sessionId",
  authenticateToken,
  sessionController.deleteSession
);

// Start a session (instructor/admin only)
router.post(
  "/:sessionId/start",
  authenticateToken,
  authorizeRole(["instructor", "teacher"]),
  sessionController.startSession
);

// End a session (instructor/admin only)
router.post(
  "/:sessionId/end",
  authenticateToken,
  authorizeRole(["instructor", "teacher"]),
  sessionController.endSession
);

// Get attendance for a session (instructor/admin only)
router.get(
  "/:sessionId/attendance",
  authenticateToken,
  sessionController.getSessionAttendance
);

// Update attendance status (instructor/admin only)
router.patch(
  "/:sessionId/attendance/:studentId",
  authenticateToken,
  authorizeRole(["instructor", "teacher"]),
  sessionController.updateAttendanceStatus
);

module.exports = router;

// routes/videoroom.routes.js
const express = require('express');
const router = express.Router();
const videoRoomController = require('../controllers/videoroom');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Get session details for video room
router.get('/session/:sessionId', videoRoomController.getSessionDetails);

// Join video room
router.post('/join/:sessionId', videoRoomController.joinVideoRoom);

// Leave video room
router.post('/leave/:sessionId', videoRoomController.leaveVideoRoom);

// Save chat message
router.post('/chat/:sessionId', videoRoomController.saveChatMessage);

// Get chat history
router.get('/chat/:sessionId', videoRoomController.getChatHistory);

module.exports = router;
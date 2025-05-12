const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

module.exports = (io) => {
  // Map to track active users in rooms
  const rooms = new Map();

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: ' + error.message));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}, User ID: ${socket.user.id}`);
    
    // Join room
    socket.on('join-room', async (roomId, callback) => {
      try {
        // Leave previous room if any
        if (socket.roomId) {
          leaveRoom(socket);
        }
        
        // Join new room
        socket.join(roomId);
        socket.roomId = roomId;
        
        // Initialize room if it doesn't exist
        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }
        
        // Add user to room
        const room = rooms.get(roomId);
        const userInfo = {
          socketId: socket.id,
          userId: socket.user.id,
          role: socket.user.role,
          username: socket.user.username || 'Anonymous'
        };
        room.set(socket.id, userInfo);
        
        // Get session info if available
        const [sessions] = await pool.query(
          'SELECT * FROM class_sessions WHERE room_id = ?',
          [roomId]
        );
        
        const sessionInfo = sessions.length > 0 ? sessions[0] : null;
        
        // Update attendance if session is active
        if (sessionInfo && sessionInfo.session_status === 'active' && socket.user.role === 'student') {
          const [attendance] = await pool.query(
            'SELECT * FROM session_attendance WHERE session_id = ? AND student_id = ?',
            [sessionInfo.session_id, socket.user.id]
          );
          
          if (attendance.length > 0) {
            // Update existing record
            await pool.query(
              'UPDATE session_attendance SET join_time = NOW(), attendance_status = ? WHERE session_id = ? AND student_id = ?',
              ['present', sessionInfo.session_id, socket.user.id]
            );
          } else {
            // Create new attendance record
            await pool.query(
              'INSERT INTO session_attendance (session_id, student_id, join_time, attendance_status) VALUES (?, ?, NOW(), ?)',
              [sessionInfo.session_id, socket.user.id, 'present']
            );
          }
        }
        
        // Get all users in the room
        const users = Array.from(room.values());
        
        // Notify everyone about the new user
        socket.to(roomId).emit('user-joined', userInfo);
        
        // Send callback with room information
        callback({
          success: true,
          users,
          sessionInfo
        });
        
        console.log(`User ${socket.user.id} joined room ${roomId}`);
      } catch (error) {
        console.error('Join room error:', error);
        callback({
          success: false,
          error: error.message
        });
      }
    });
    
    // WebRTC signaling: Offer
    socket.on('offer', (data) => {
      const { targetId, sdp } = data;
      
      // Forward offer to target user
      socket.to(targetId).emit('offer', {
        sourceId: socket.id,
        userId: socket.user.id,
        sdp
      });
    });
    
    // WebRTC signaling: Answer
    socket.on('answer', (data) => {
      const { targetId, sdp } = data;
      
      // Forward answer to target user
      socket.to(targetId).emit('answer', {
        sourceId: socket.id,
        userId: socket.user.id,
        sdp
      });
    });
    
    // WebRTC signaling: ICE Candidate
    socket.on('ice-candidate', (data) => {
      const { targetId, candidate } = data;
      
      // Forward ICE candidate to target user
      socket.to(targetId).emit('ice-candidate', {
        sourceId: socket.id,
        userId: socket.user.id,
        candidate
      });
    });
    
    // Toggle media
    socket.on('toggle-media', (data) => {
      const { audioEnabled, videoEnabled } = data;
      
      if (!socket.roomId) return;
      
      const room = rooms.get(socket.roomId);
      if (!room) return;
      
      const user = room.get(socket.id);
      if (!user) return;
      
      // Update user's media state
      user.audioEnabled = audioEnabled;
      user.videoEnabled = videoEnabled;
      
      // Notify everyone in the room
      socket.to(socket.roomId).emit('user-media-update', {
        socketId: socket.id,
        userId: socket.user.id,
        audioEnabled,
        videoEnabled
      });
    });
    
    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      leaveRoom(socket);
    });
  });
  
  // Helper function to handle room leaving
  const leaveRoom = async (socket) => {
    try {
      if (!socket.roomId) return;
      
      const roomId = socket.roomId;
      const room = rooms.get(roomId);
      
      // Update session attendance if applicable
      const [sessions] = await pool.query(
        'SELECT * FROM class_sessions WHERE room_id = ?',
        [roomId]
      );
      
      if (sessions.length > 0 && sessions[0].session_status === 'active' && socket.user.role === 'student') {
        await pool.query(
          'UPDATE session_attendance SET leave_time = NOW() WHERE session_id = ? AND student_id = ? AND leave_time IS NULL',
          [sessions[0].session_id, socket.user.id]
        );
      }
      
      if (room) {
        // Remove user from room
        room.delete(socket.id);
        
        // Delete room if empty
        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
      
      // Notify others that user has left
      socket.to(roomId).emit('user-left', {
        socketId: socket.id,
        userId: socket.user.id
      });
      
      // Leave the socket.io room
      socket.leave(roomId);
      socket.roomId = null;
      
      console.log(`User ${socket.user.id} left room ${roomId}`);
    } catch (error) {
      console.error('Leave room error:', error);
    }
  };
};
// utils/helpers.js

// Generate a random alphanumeric code of specified length
const generateRoomId=() => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

module.exports = {
  generateRoomId
};
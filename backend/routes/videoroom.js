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
      
      // Check if this is a class token with class-specific info
      if (decoded.classId) {
        // Verify class login is valid
        const [loginSessions] = await pool.query(
          'SELECT * FROM class_login_sessions WHERE student_id = ? AND class_id = ? AND is_active = TRUE',
          [decoded.userId, decoded.classId]
        );
        
        if (loginSessions.length === 0) {
          return next(new Error('Authentication error: Invalid class login'));
        }
        
        socket.classId = decoded.classId;
        socket.sessionId = decoded.sessionId;
      }
      
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
          username: socket.user.username || 'Anonymous',
          joined: new Date()
        };
        room.set(socket.id, userInfo);
        
        // Get current session info if available
        let sessionInfo = null;
        if (socket.sessionId) {
          const [sessions] = await pool.query(
            'SELECT * FROM class_sessions WHERE session_id = ?',
            [socket.sessionId]
          );
          
          if (sessions.length > 0) {
            sessionInfo = sessions[0];
            
            // Update attendance if student joined active session
            if (socket.user.role === 'student' && sessionInfo.session_status === 'active') {
              // Check if attendance record exists
              const [attendance] = await pool.query(
                'SELECT * FROM session_attendance WHERE session_id = ? AND student_id = ?',
                [socket.sessionId, socket.user.id]
              );
              
              if (attendance.length > 0) {
                // Update existing record
                await pool.query(
                  'UPDATE session_attendance SET join_time = NOW(), attendance_status = ? WHERE session_id = ? AND student_id = ?',
                  ['present', socket.sessionId, socket.user.id]
                );
              } else {
                // Create new attendance record
                await pool.query(
                  'INSERT INTO session_attendance (session_id, student_id, join_time, attendance_status) VALUES (?, ?, NOW(), ?)',
                  [socket.sessionId, socket.user.id, 'present']
                );
              }
            }
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
    
    // Leave room
    socket.on('leave-room', () => {
      leaveRoom(socket);
    });
    
    // WebRTC signaling: Offer
    socket.on('signal:offer', (data) => {
      const { targetId, sdp } = data;
      
      // Forward offer to target user
      socket.to(targetId).emit('signal:offer', {
        sourceId: socket.id,
        userId: socket.user.id,
        sdp
      });
    });
    
    // WebRTC signaling: Answer
    socket.on('signal:answer', (data) => {
      const { targetId, sdp } = data;
      
      // Forward answer to target user
      socket.to(targetId).emit('signal:answer', {
        sourceId: socket.id,
        userId: socket.user.id,
        sdp
      });
    });
    
    // WebRTC signaling: ICE Candidate
    socket.on('signal:ice-candidate', (data) => {
      const { targetId, candidate } = data;
      
      // Forward ICE candidate to target user
      socket.to(targetId).emit('signal:ice-candidate', {
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
    
    // Chat message
    socket.on('chat-message', async (data) => {
      try {
        const { message, isPrivate, recipientId } = data;
        
        if (!socket.roomId) return;
        
        // Store message in database if session exists
        if (socket.sessionId) {
          await pool.query(
            `INSERT INTO chat_messages 
            (session_id, sender_id, message_text, is_private, recipient_id) 
            VALUES (?, ?, ?, ?, ?)`,
            [
              socket.sessionId,
              socket.user.id,
              message,
              isPrivate || false,
              isPrivate ? recipientId : null
            ]
          );
        }
        
        const messageData = {
          senderId: socket.user.id,
          senderName: socket.user.username || 'Anonymous',
          senderRole: socket.user.role,
          message,
          timestamp: new Date(),
          isPrivate: isPrivate || false
        };
        
        if (isPrivate && recipientId) {
          // Find recipient's socket ID
          const room = rooms.get(socket.roomId);
          let recipientSocketId = null;
          
          if (room) {
            for (const [id, user] of room.entries()) {
              if (user.userId == recipientId) {
                recipientSocketId = id;
                break;
              }
            }
          }
          
          if (recipientSocketId) {
            // Send private message only to recipient
            socket.to(recipientSocketId).emit('chat-message', messageData);
          }
        } else {
          // Broadcast message to everyone in the room
          socket.to(socket.roomId).emit('chat-message', messageData);
        }
      } catch (error) {
        console.error('Chat message error:', error);
      }
    });
    
    // Raise/lower hand
    socket.on('toggle-hand', (raised) => {
      if (!socket.roomId) return;
      
      const room = rooms.get(socket.roomId);
      if (!room) return;
      
      const user = room.get(socket.id);
      if (!user) return;
      
      // Update user's hand state
      user.handRaised = raised;
      
      // Notify everyone in the room
      socket.to(socket.roomId).emit('user-hand-update', {
        socketId: socket.id,
        userId: socket.user.id,
        handRaised: raised
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
      
      if (room) {
        // Remove user from room
        room.delete(socket.id);
        
        // Delete room if empty
        if (room.size === 0) {
          rooms.delete(roomId);
        }
      }
      
      // Update attendance if student leaves an active session
      if (socket.user.role === 'student' && socket.sessionId) {
        const [sessions] = await pool.query(
          'SELECT session_status FROM class_sessions WHERE session_id = ?',
          [socket.sessionId]
        );
        
        if (sessions.length > 0 && sessions[0].session_status === 'active') {
          await pool.query(
            'UPDATE session_attendance SET leave_time = NOW() WHERE session_id = ? AND student_id = ? AND leave_time IS NULL',
            [socket.sessionId, socket.user.id]
          );
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
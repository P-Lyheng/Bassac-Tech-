const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const setupWebRTCSignaling = require('./utils/webrtc-signaling');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Setup socket event handling
const setupSocketEvents = (socket) => {
  console.log('A user connected:', socket.id);
  
  // Handle room joining
  socket.on('join-room', (roomId, callback) => {
    socket.join(roomId);
    // Implementation here
    callback({ success: true });
  });
  
  // Add other socket event handlers here
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
};

// Register connection handler
io.on('connection', setupSocketEvents);

// Setup WebRTC signaling
setupWebRTCSignaling(io);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
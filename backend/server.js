const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { connectDB } = require('./config/db');
const cookieParser = require('cookie-parser');
const { sanitizeInputs, validateParams } = require('./middleware/validation');
const setupWebRTCSignaling = require('./utils/webrtc-signaling');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Handle room joining
  socket.on('join-room', (roomId, callback) => {
    socket.join(roomId);
    // Implementation here
    callback({ success: true });
  });
  
  // Other event handlers
});


// Connect to Database
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInputs);
app.use(validateParams);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!require('fs').existsSync(uploadsDir)) {
  require('fs').mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/classes', require('./routes/class'));
app.use('/api/sessions', require('./routes/session'));
// Add this line with your other routes
app.use('/api/videoroom', require('./routes/videoroom'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/student', require('./routes/student'));


// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve HTML pages
app.get('/videoroom', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'videoroom.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

// Add teacher dashboard route
app.get('/dashboard/teacher', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'teacher-dashboard.html'));
});

// Add student dashboard route
app.get('/dashboard/student', (req, res) => {
  console.log( "im here")
  res.sendFile(path.join(__dirname, '../frontend', 'student-dashboard.html'));
});

// Add admin dashboard route
app.get('/dashboard/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'admin-dashboard.html'));
});

// Add this line with your other routes in server.js

// WebRTC Signaling Server
setupWebRTCSignaling(io);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
    
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    message: err.message || 'Server Error', 
    error: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.stack
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Don't exit the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});
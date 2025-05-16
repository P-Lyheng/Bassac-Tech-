const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

// Import local modules
const { connectDB } = require('./config/db');
const { sanitizeInputs, validateParams } = require('./middleware/validation');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Connect to Database
connectDB();

// Configure middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sanitizeInputs);
app.use(validateParams);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/classes', require('./routes/class'));
app.use('/api/sessions', require('./routes/session'));
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

// Configure static file serving
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Configure frontend routes
const frontendPages = {
  '/': 'index.html',
  '/videoroom': 'videoroom.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/verify-email': 'verify-email.html',
  '/dashboard/teacher': 'teacher-dashboard.html',
  '/dashboard/student': 'student-dashboard.html',
  '/dashboard/admin': 'admin-dashboard.html'
};

// Setup route handlers for frontend pages
Object.entries(frontendPages).forEach(([route, page]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', page));
  });
});

// Production setup
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../client', 'build', 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ 
    message: err.message || 'Server Error', 
    error: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.stack
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Don't exit the process in production
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Export the configured Express app
module.exports = app;
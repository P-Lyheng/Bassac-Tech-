// controllers/admin.controller.js
const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');
const os = require('os');

// Get admin dashboard stats
const getStats = async (req, res) => {
  try {
    // Get users count
    const [usersResult] = await pool.query('SELECT COUNT(*) as count FROM users');
    
    // Get classes count
    const [classesResult] = await pool.query('SELECT COUNT(*) as count FROM classes');
    
    // Get sessions count
    const [sessionsResult] = await pool.query('SELECT COUNT(*) as count FROM class_sessions');
    
    // Get active sessions count
    const [activeSessionsResult] = await pool.query(
      "SELECT COUNT(*) as count FROM class_sessions WHERE session_status = 'active'"
    );
    
    res.json({
      usersCount: usersResult[0].count,
      classesCount: classesResult[0].count,
      sessionsCount: sessionsResult[0].count,
      activeSessionsCount: activeSessionsResult[0].count
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get admin logs
const getAdminLogs = async (req, res) => {
  try {
    const [logs] = await pool.query(
      `SELECT l.*, a.username as admin_username, u.username as target_username
       FROM admin_logs l
       LEFT JOIN users a ON l.admin_id = a.user_id
       LEFT JOIN users u ON l.target_user_id = u.user_id
       ORDER BY l.timestamp DESC
       LIMIT 10`
    );
    
    res.json(logs);
  } catch (error) {
    console.error('Get admin logs error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get system status
const getSystemStatus = async (req, res) => {
  try {
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    
    // Get database size
    const [dbSizeResult] = await pool.query(
      `SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb 
       FROM information_schema.tables 
       WHERE table_schema = ?`,
      [process.env.DB_NAME]
    );
    
    // Get server uptime
    const uptime = os.uptime();
    const uptimeDays = Math.floor(uptime / 86400);
    const uptimeHours = Math.floor((uptime % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);
    
    // Get memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = Math.round(usedMemory / 1024 / 1024);
    
    // Get storage used by uploads
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    let storageUsed = 0;
    
    if (fs.existsSync(uploadsDir)) {
      storageUsed = await getDirectorySize(uploadsDir);
    }
    
    // Get stats
    const [usersCount] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [classesCount] = await pool.query('SELECT COUNT(*) as count FROM classes');
    const [sessionsCount] = await pool.query('SELECT COUNT(*) as count FROM class_sessions');
    const [activeSessionsCount] = await pool.query(
      "SELECT COUNT(*) as count FROM class_sessions WHERE session_status = 'active'"
    );
    
    res.json({
      database: {
        connected: dbConnected,
        name: process.env.DB_NAME,
        size: `${dbSizeResult[0].size_mb || 0} MB`
      },
      server: {
        uptime: `${uptimeDays} days, ${uptimeHours} hours, ${uptimeMinutes} minutes`,
        memoryUsage: `${memoryUsage} MB`,
        version: process.env.npm_package_version || '1.0.0'
      },
      statistics: {
        usersCount: usersCount[0].count,
        classesCount: classesCount[0].count,
        sessionsCount: sessionsCount[0].count,
        activeSessionsCount: activeSessionsCount[0].count,
        storageUsed: `${Math.round(storageUsed / 1024 / 1024 * 100) / 100} MB`
      }
    });
  } catch (error) {
    console.error('Get system status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Reset user password
const resetUserPassword = async (req, res) => {
  const userId = req.params.userId;
  const { newPassword } = req.body;
  
  try {
    // Input validation
    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }
    
    // Find user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    await pool.query(
      'UPDATE users SET password = ? WHERE user_id = ?',
      [hashedPassword, userId]
    );
    
    // Log admin action
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action, target_user_id, details) VALUES (?, ?, ?, ?)',
      [req.user.id, 'RESET_PASSWORD', userId, 'Admin password reset']
    );
    
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Force verify user
const verifyUser = async (req, res) => {
  const userId = req.params.userId;
  
  try {
    // Find user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update verification status
    await pool.query(
      'UPDATE users SET is_verified = TRUE, verification_otp = NULL, otp_expires = NULL WHERE user_id = ?',
      [userId]
    );
    
    // Log admin action
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action, target_user_id, details) VALUES (?, ?, ?, ?)',
      [req.user.id, 'VERIFY_USER', userId, 'Admin forced verification']
    );
    
    res.json({ message: 'User verified successfully' });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper functions
async function checkDatabaseConnection() {
  try {
    const [result] = await pool.query('SELECT 1');
    return result.length > 0;
  } catch (error) {
    console.error('Database connection check error:', error);
    return false;
  }
}

async function getDirectorySize(directory) {
  const fs = require('fs').promises;
  const path = require('path');
  
  async function getSize(directory) {
    let size = 0;
    const files = await fs.readdir(directory);
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const stat = await fs.stat(filePath);
      
      if (stat.isDirectory()) {
        size += await getSize(filePath);
      } else {
        size += stat.size;
      }
    }
    
    return size;
  }
  
  return getSize(directory);
}

module.exports = {
  getStats,
  getAdminLogs,
  getSystemStatus,
  resetUserPassword,
  verifyUser
};
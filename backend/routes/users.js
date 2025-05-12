const express = require('express');
const router = express.Router();
const userController = require('../controllers/users');
const { authenticateToken, authorizeRole, authorizeResource } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up multer storage for profile pictures
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'profile');
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and userId
    const userId = req.params.userId;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `user_${userId}_${timestamp}${ext}`);
  }
});

// File filter function for images
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

// Initialize multer upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: fileFilter
});

// Get all users (admin only)
router.get('/', authenticateToken, authorizeRole('admin'), userController.getAllUsers);

// Get user by ID
router.get('/:userId', authenticateToken, userController.getUserById);

// Update user
router.patch('/:userId', authenticateToken, authorizeResource('params.userId'), userController.updateUser);

// Change password
router.post('/:userId/change-password', authenticateToken, authorizeResource('params.userId'), userController.changePassword);

// Upload profile picture
router.post('/:userId/profile-picture', 
  authenticateToken, 
  authorizeResource('params.userId'),
  upload.single('profilePicture'), 
  userController.uploadProfilePicture
);

// Delete user (admin only)
router.delete('/:userId', authenticateToken, authorizeRole('admin'), userController.deleteUser);

module.exports = router;
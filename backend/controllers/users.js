const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT user_id, username, email, role, profile_picture, bio, created_at, is_verified FROM users'
    );

    res.json(users);
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT user_id, username, email, role, profile_picture, bio, created_at FROM users WHERE user_id = ?',
      [req.params.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update user
const updateUser = async (req, res) => {
  const { username, bio } = req.body;
  const userId = req.params.userId;

  // Ensure the user can only update their own profile unless admin
  if (req.user.role !== 'admin' && req.user.id != userId) {
    return res.status(403).json({ message: 'Not authorized to update this user' });
  }

  try {
    // Check if username is already taken (if username is provided)
    if (username) {
      const [existingUsers] = await pool.query(
        'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
        [username, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    // Create update query based on provided fields
    let updateFields = [];
    let updateValues = [];

    if (username) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }

    if (bio !== undefined) {
      updateFields.push('bio = ?');
      updateValues.push(bio);
    }

    // No fields to update
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update provided' });
    }

    // Add userId to values array
    updateValues.push(userId);

    // Update user
    await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
      updateValues
    );

    // Get updated user
    const [updatedUsers] = await pool.query(
      'SELECT user_id, username, email, role, profile_picture, bio, created_at FROM users WHERE user_id = ?',
      [userId]
    );

    res.json({
      message: 'User updated successfully',
      user: updatedUsers[0]
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Change password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.params.userId;

  // Ensure the user can only change their own password unless admin
  if (req.user.role !== 'admin' && req.user.id != userId) {
    return res.status(403).json({ message: 'Not authorized to change this user\'s password' });
  }

  try {
    // Get user
    const [users] = await pool.query(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = users[0];

    // If not admin, verify current password
    if (req.user.role !== 'admin') {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
    }

    // Validate new password
    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    // Password strength validation
    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({message : "Password must contain at least one lowercase letter."});
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({message : "Password must contain at least one uppercase letter."});
    }
    if (!/\d/.test(newPassword)) {
      return res.status(400).json({message : "Password must contain at least one digit."});
    }
    if (!/[@$!%*?&]/.test(newPassword)) {
      return res.status(400).json({message : "Password must contain at least one special character (@$!%*?&)."});
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await pool.query(
      'UPDATE users SET password = ? WHERE user_id = ?',
      [hashedPassword, userId]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Upload profile picture
const uploadProfilePicture = async (req, res) => {
  const userId = req.params.userId;

  // Ensure the user can only update their own profile unless admin
  if (req.user.role !== 'admin' && req.user.id != userId) {
    return res.status(403).json({ message: 'Not authorized to update this user' });
  }

  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Update profile picture path
    const filePath = `/uploads/profile/${req.file.filename}`;
    
    await pool.query(
      'UPDATE users SET profile_picture = ? WHERE user_id = ?',
      [filePath, userId]
    );

    res.json({
      message: 'Profile picture updated successfully',
      profilePicture: filePath
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  const userId = req.params.userId;

  try {
    // Delete user
    const [result] = await pool.query(
      'DELETE FROM users WHERE user_id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Log admin action
    await pool.query(
      'INSERT INTO admin_logs (admin_id, action, target_user_id, details) VALUES (?, ?, ?, ?)',
      [req.user.id, 'DELETE_USER', userId, `User ID ${userId} deleted by admin ID ${req.user.id}`]
    );

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  changePassword,
  uploadProfilePicture,
  deleteUser
};
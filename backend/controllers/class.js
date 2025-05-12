const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { generateRoomId } = require('../utils/helpers');

// Create a new class
// Create a new class
// Create a new class
const createClass = async (req, res) => {
  const { className, description, capacity, classPassword } = req.body;
  const instructorId = req.user.id;

  try {
    // Validate input
    if (!className || !classPassword) {
      return res.status(400).json({ message: 'Class name and password are required' });
    }

    // Generate unique class code
    const classCode = generateRoomId();
    console.log('Generated class code:', classCode);

    // Hash class password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(classPassword, salt);

    // Insert with ALL required fields
    const [result] = await pool.query(
      'INSERT INTO classes (title, class_name, class_code, class_password, description, teacher_id, instructor_id, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [className, className, classCode, hashedPassword, description, instructorId, instructorId, capacity || 30]
    );

    res.status(201).json({
      message: 'Class created successfully',
      classId: result.insertId,
      classCode
    });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Get all classes (admin only)
const getAllClasses = async (req, res) => {
  try {
    const [classes] = await pool.query(`
      SELECT c.*, u.username as instructor_name, 
      (SELECT COUNT(*) FROM class_enrollments WHERE class_id = c.class_id AND status = 'approved') as enrolled_count
      FROM classes c
      JOIN users u ON c.instructor_id = u.user_id
    `);

    res.json(classes);
  } catch (error) {
    console.error('Get all classes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get classes for instructor
const getInstructorClasses = async (req, res) => {
  const instructorId = req.user.id;

  try {
    const [classes] = await pool.query(`
      SELECT c.*, 
      (SELECT COUNT(*) FROM class_enrollments WHERE class_id = c.class_id AND status = 'approved') as enrolled_count
      FROM classes c
      WHERE c.instructor_id = ?
    `, [instructorId]);

    res.json(classes);
  } catch (error) {
    console.error('Get instructor classes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get classes for student
const getStudentClasses = async (req, res) => {
  const studentId = req.user.id;

  try {
    const [classes] = await pool.query(`
      SELECT c.*, u.username as instructor_name, e.enrollment_date, e.status as enrollment_status
      FROM classes c
      JOIN users u ON c.instructor_id = u.user_id
      JOIN class_enrollments e ON c.class_id = e.class_id
      WHERE e.student_id = ?
    `, [studentId]);

    res.json(classes);
  } catch (error) {
    console.error('Get student classes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get class by ID
const getClassById = async (req, res) => {
  const classId = req.params.classId;
  const userId = req.user.id;

  try {
    // Get class
    const [classes] = await pool.query(`
      SELECT c.*, u.username as instructor_name
      FROM classes c
      JOIN users u ON c.instructor_id = u.user_id
      WHERE c.class_id = ?
    `, [classId]);

    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    const classData = classes[0];
    
    // Check access permission
    if (req.user.role !== 'admin' && classData.instructor_id != userId) {
      // Check if student is enrolled
      const [enrollments] = await pool.query(
        'SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ? AND status = "approved"',
        [classId, userId]
      );

      if (enrollments.length === 0) {
        return res.status(403).json({ message: 'You do not have access to this class' });
      }
    }

    // Get enrollment count
    const [enrollmentCount] = await pool.query(
      'SELECT COUNT(*) as count FROM class_enrollments WHERE class_id = ? AND status = "approved"',
      [classId]
    );

    // Remove password from response
    delete classData.class_password;

    res.json({
      ...classData,
      enrolledCount: enrollmentCount[0].count
    });
  } catch (error) {
    console.error('Get class by ID error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update class
const updateClass = async (req, res) => {
  const { className, description, capacity, isActive } = req.body;
  const classId = req.params.classId;
  const userId = req.user.id;

  try {
    // Check if class exists and user is instructor
    const [classes] = await pool.query(
      'SELECT * FROM classes WHERE class_id = ?',
      [classId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Check if user is instructor or admin
    if (req.user.role !== 'admin' && classes[0].instructor_id != userId) {
      return res.status(403).json({ message: 'You are not authorized to update this class' });
    }

    // Create update query based on provided fields
    let updateFields = [];
    let updateValues = [];

    if (className) {
      updateFields.push('class_name = ?');
      updateValues.push(className);
    }

    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }

    if (capacity) {
      updateFields.push('capacity = ?');
      updateValues.push(capacity);
    }

    if (isActive !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(isActive);
    }

    // No fields to update
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No fields to update provided' });
    }

    // Add classId to values array
    updateValues.push(classId);

    // Update class
    await pool.query(
      `UPDATE classes SET ${updateFields.join(', ')} WHERE class_id = ?`,
      updateValues
    );

    res.json({ message: 'Class updated successfully' });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update class password
const updateClassPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const classId = req.params.classId;
  const userId = req.user.id;

  try {
    // Check if class exists and user is instructor
    const [classes] = await pool.query(
      'SELECT * FROM classes WHERE class_id = ?',
      [classId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Check if user is instructor or admin
    if (req.user.role !== 'admin' && classes[0].instructor_id != userId) {
      return res.status(403).json({ message: 'You are not authorized to update this class' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, classes[0].class_password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await pool.query(
      'UPDATE classes SET class_password = ? WHERE class_id = ?',
      [hashedPassword, classId]
    );

    res.json({ message: 'Class password updated successfully' });
  } catch (error) {
    console.error('Update class password error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete class
const deleteClass = async (req, res) => {
  const classId = req.params.classId;
  const userId = req.user.id;

  try {
    // Check if class exists and user is instructor
    const [classes] = await pool.query(
      'SELECT * FROM classes WHERE class_id = ?',
      [classId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Check if user is instructor or admin
    if (req.user.role !== 'admin' && classes[0].instructor_id != userId) {
      return res.status(403).json({ message: 'You are not authorized to delete this class' });
    }

    // Delete class
    await pool.query(
      'DELETE FROM classes WHERE class_id = ?',
      [classId]
    );

    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Enroll in class
const enrollInClass = async (req, res) => {
  const { classCode } = req.body;
  const studentId = req.user.id;

  try {
    // Check if class exists
    const [classes] = await pool.query(
      'SELECT * FROM classes WHERE class_code = ? AND is_active = TRUE',
      [classCode]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found or inactive' });
    }

    const classId = classes[0].class_id;

    // Check if already enrolled
    const [enrollments] = await pool.query(
      'SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ?',
      [classId, studentId]
    );

    if (enrollments.length > 0) {
      return res.status(400).json({ 
        message: 'You are already enrolled in this class',
        status: enrollments[0].status
      });
    }

    // Check if class is full
    const [enrollmentCount] = await pool.query(
      'SELECT COUNT(*) as count FROM class_enrollments WHERE class_id = ? AND status = "approved"',
      [classId]
    );
    
    if (enrollmentCount[0].count >= classes[0].capacity) {
      return res.status(400).json({ message: 'Class is full' });
    }

    // Create enrollment
    let status = 'pending';
    
    // If instructor allows auto-enrollment
    if (!classes[0].require_approval) {
      status = 'approved';
    }
    
    await pool.query(
      'INSERT INTO class_enrollments (class_id, student_id, status) VALUES (?, ?, ?)',
      [classId, studentId, status]
    );

    res.status(201).json({
      message: status === 'approved' 
        ? 'Enrolled successfully' 
        : 'Enrollment request submitted. Waiting for instructor approval.',
      status: status
    });
  } catch (error) {
    console.error('Enroll in class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get class enrollments
const getClassEnrollments = async (req, res) => {
  const classId = req.params.classId;
  const userId = req.user.id;

  try {
    // Check if class exists and user is instructor
    const [classes] = await pool.query(
      'SELECT * FROM classes WHERE class_id = ?',
      [classId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Check if user is instructor or admin
    if (req.user.role !== 'admin' && classes[0].instructor_id != userId) {
      return res.status(403).json({ message: 'You are not authorized to view enrollments for this class' });
    }

    // Get enrollments
    const [enrollments] = await pool.query(`
      SELECT e.*, u.username, u.email, u.profile_picture
      FROM class_enrollments e
      JOIN users u ON e.student_id = u.user_id
      WHERE e.class_id = ?
      ORDER BY e.status, e.enrollment_date DESC
    `, [classId]);

    res.json(enrollments);
  } catch (error) {
    console.error('Get class enrollments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update enrollment status
const updateEnrollmentStatus = async (req, res) => {
  const { status } = req.body;
  const enrollmentId = req.params.enrollmentId;
  const userId = req.user.id;

  try {
    // Get enrollment details
    const [enrollments] = await pool.query(
      'SELECT e.*, c.instructor_id FROM class_enrollments e JOIN classes c ON e.class_id = c.class_id WHERE e.enrollment_id = ?',
      [enrollmentId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({ message: 'Enrollment not found' });
    }

    // Check if user is instructor or admin
    if (req.user.role !== 'admin' && enrollments[0].instructor_id != userId) {
      return res.status(403).json({ message: 'You are not authorized to update this enrollment' });
    }

    // Validate status
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status provided' });
    }

    // Update enrollment
    await pool.query(
      'UPDATE class_enrollments SET status = ? WHERE enrollment_id = ?',
      [status, enrollmentId]
    );

    res.json({ message: `Enrollment ${status}` });
  } catch (error) {
    console.error('Update enrollment status error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Drop enrollment
const dropEnrollment = async (req, res) => {
  const classId = req.params.classId;
  const studentId = req.user.id;

  try {
    // Check if enrolled
    const [enrollments] = await pool.query(
      'SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ?',
      [classId, studentId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({ message: 'You are not enrolled in this class' });
    }

    // Delete enrollment
    await pool.query(
      'DELETE FROM class_enrollments WHERE class_id = ? AND student_id = ?',
      [classId, studentId]
    );

    res.json({ message: 'Dropped from class successfully' });
  } catch (error) {
    console.error('Drop enrollment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Export all controllers
module.exports = {
  createClass,
  getAllClasses,
  getInstructorClasses,
  getStudentClasses,
  getClassById,
  updateClass,
  updateClassPassword,
  deleteClass,
  enrollInClass,
  getClassEnrollments,
  updateEnrollmentStatus,
  dropEnrollment
};
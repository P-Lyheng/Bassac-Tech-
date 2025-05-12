-- Create database if not exists
CREATE DATABASE IF NOT EXISTS bassac_academy;
USE bassac_academy;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'instructor', 'admin') NOT NULL DEFAULT 'student',
  is_verified BOOLEAN DEFAULT FALSE,
  verification_otp VARCHAR(6),
  otp_expires DATETIME,
  profile_picture VARCHAR(255),
  bio TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_username (username)
);

-- Administrative logs table
CREATE TABLE IF NOT EXISTS admin_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_user_id INT,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  class_id INT AUTO_INCREMENT PRIMARY KEY,
  class_name VARCHAR(100) NOT NULL,
  class_code VARCHAR(20) NOT NULL UNIQUE,
  class_password VARCHAR(255) NOT NULL,
  description TEXT,
  instructor_id INT NOT NULL,
  capacity INT DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_class_code (class_code)
);

-- Class enrollments table
CREATE TABLE IF NOT EXISTS class_enrollments (
  enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  student_id INT NOT NULL,
  enrollment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_enrollment (class_id, student_id)
);

-- Class sessions table
CREATE TABLE IF NOT EXISTS class_sessions (
  session_id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  session_name VARCHAR(100) NOT NULL,
  description TEXT,
  room_id VARCHAR(50) NOT NULL,
  scheduled_start DATETIME NOT NULL,
  scheduled_end DATETIME NOT NULL,
  actual_start DATETIME,
  actual_end DATETIME,
  session_status ENUM('scheduled', 'active', 'completed', 'cancelled') DEFAULT 'scheduled',
  created_by INT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Session attendance table
CREATE TABLE IF NOT EXISTS session_attendance (
  attendance_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  student_id INT NOT NULL,
  join_time DATETIME,
  leave_time DATETIME,
  attendance_status ENUM('absent', 'present', 'late', 'excused') DEFAULT 'absent',
  FOREIGN KEY (session_id) REFERENCES class_sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
  UNIQUE KEY unique_attendance (session_id, student_id)
);

-- Class login sessions table
CREATE TABLE IF NOT EXISTS class_login_sessions (
  login_id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  class_id INT NOT NULL,
  session_id INT,
  login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  logout_time DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  ip_address VARCHAR(50),
  user_agent TEXT,
  FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES class_sessions(session_id) ON DELETE SET NULL
);

-- Learning materials table
CREATE TABLE IF NOT EXISTS learning_materials (
  material_id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  file_path VARCHAR(255),
  file_type VARCHAR(50),
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  uploaded_by INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Class assignments table
CREATE TABLE IF NOT EXISTS assignments (
  assignment_id INT AUTO_INCREMENT PRIMARY KEY,
  class_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  due_date DATETIME,
  points INT DEFAULT 100,
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(class_id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Assignment submissions table
CREATE TABLE IF NOT EXISTS assignment_submissions (
  submission_id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  student_id INT NOT NULL,
  submission_text TEXT,
  file_path VARCHAR(255),
  submit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  grade INT,
  feedback TEXT,
  graded_by INT,
  graded_at DATETIME,
  FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (graded_by) REFERENCES users(user_id) ON DELETE SET NULL,
  UNIQUE KEY unique_submission (assignment_id, student_id)
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT,
  sender_id INT NOT NULL,
  message_text TEXT NOT NULL,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  message_type ENUM('text', 'file', 'system') DEFAULT 'text',
  is_private BOOLEAN DEFAULT FALSE,
  recipient_id INT,
  FOREIGN KEY (session_id) REFERENCES class_sessions(session_id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Creating admin user (password: Admin123!)
-- Password hash for "Admin123!" which meets the password requirements
INSERT INTO users (username, email, password, role, is_verified) 
VALUES ('admin', 'admin@bassac-academy.com', '$2a$12$7Hl.OhLD8.Q0rN9g2Ay9/O7V.S1SHG9wYg7cFJiG6/VXnf3ZcuTjG', 'admin', TRUE);

CREATE TABLE IF NOT EXISTS admin_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_user_id INT,
  details TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);


ALTER TABLE classes 
ADD COLUMN class_name VARCHAR(100) NOT NULL,
ADD COLUMN instructor_id INT NOT NULL,
ADD COLUMN capacity INT DEFAULT 30,
ADD INDEX idx_class_code (class_code);



-- Make teacher_id accept NULL values
ALTER TABLE classes MODIFY COLUMN teacher_id INT NULL;

-- Add a trigger to keep both columns synchronized
DELIMITER //
CREATE TRIGGER sync_teacher_instructor_insert BEFORE INSERT ON classes
FOR EACH ROW
BEGIN
    IF NEW.instructor_id IS NOT NULL AND NEW.teacher_id IS NULL THEN
        SET NEW.teacher_id = NEW.instructor_id;
    ELSEIF NEW.teacher_id IS NOT NULL AND NEW.instructor_id IS NULL THEN
        SET NEW.instructor_id = NEW.teacher_id;
    END IF;
END//

CREATE TRIGGER sync_teacher_instructor_update BEFORE UPDATE ON classes
FOR EACH ROW
BEGIN
    IF NEW.instructor_id != OLD.instructor_id THEN
        SET NEW.teacher_id = NEW.instructor_id;
    ELSEIF NEW.teacher_id != OLD.teacher_id THEN
        SET NEW.instructor_id = NEW.teacher_id;
    END IF;
END//
DELIMITER ;
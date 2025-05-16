const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const nodemailer = require("nodemailer");
const xss = require("xss"); // Add this for sanitizing inputs

const setupEmailTransporter = async () => {
  // Check if we're in development mode and if real email credentials aren't provided
  if (
    process.env.NODE_ENV !== "production" &&
    (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD)
  ) {
    // Create a test account for development
    const testAccount = await nodemailer.createTestAccount();
    console.log("Using Ethereal test account:", testAccount.user);

    return {
      transporter: nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      }),
      sender: testAccount.user,
      isDev: true,
      testAccount,
    };
  }

  // Use real credentials for production or if provided in development
  return {
    transporter: nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    }),
    sender: process.env.EMAIL_USER,
    isDev: false,
  };
};

// Send OTP email - works in both dev and production
const sendOtpEmail = async (email, username, otp) => {
  try {
    // Security: Ensure email and username are sanitized
    const safeEmail = xss(email);
    const safeUsername = xss(username);

    // Set up the email transporter (will use Ethereal in dev if no real credentials)
    const { transporter, sender, isDev, testAccount } =
      await setupEmailTransporter();

    // Email content
    const mailOptions = {
      from: `"Bassac Academy" <${sender}>`,
      to: safeEmail,
      subject: "Your Verification Code - Bassac Academy",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${safeUsername}!</h2>
          <p>Thank you for registering with Bassac Academy. Please use the verification code below to complete your registration:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 15px; background-color: #f4f4f4; border-radius: 5px;">${otp}</div>
          </div>
          <p>This code will expire in 15 minutes.</p>
          <p>If you did not create an account, please ignore this email.</p>
          <p>Best regards,<br>The Bassac Academy Team</p>
        </div>
      `,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log("OTP email sent to:", safeEmail);

    // For Ethereal emails, log the preview URL
    if (isDev) {
      console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      console.log("DEV OTP Code:", otp);
    }

    return { success: true, isDev };
  } catch (error) {
    console.error("Email sending error:", error);

    // In development, we return success even on failure, so testing can continue
    if (process.env.NODE_ENV !== "production") {
      console.log("DEV MODE: Continuing despite email failure");
      console.log("DEV OTP Code:", otp);
      return { success: false, isDev: true, otp };
    }

    throw new Error("Failed to send verification email");
  }
};

// Register user
const register = async (req, res) => {
  try {
    // Get inputs and sanitize
    const username = xss(req.body.username?.trim());
    const email = xss(req.body.email?.trim().toLowerCase());
    const password = req.body.password;
    const role = xss(req.body.role?.trim());

    // Input validation
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide username, email and password" });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid email address" });
    }

    // Password strength validation
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long." });
    }
    if (!/[a-z]/.test(password)) {
      return res
        .status(400)
        .json({
          message: "Password must contain at least one lowercase letter.",
        });
    }
    if (!/[A-Z]/.test(password)) {
      return res
        .status(400)
        .json({
          message: "Password must contain at least one uppercase letter.",
        });
    }
    if (!/\d/.test(password)) {
      return res
        .status(400)
        .json({ message: "Password must contain at least one digit." });
    }
    if (!/[@$!%*?&]/.test(password)) {
      return res
        .status(400)
        .json({
          message:
            "Password must contain at least one special character (@$!%*?&).",
        });
    }

    // Role validation
    const allowedRoles = ["student", "teacher", "instructor", "admin"];
    const userRole = role || "student";
    if (!allowedRoles.includes(userRole)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    // Check if user already exists
    const [existingUsers] = await pool.query(
      "SELECT * FROM users WHERE email = ? OR username = ?",
      [email, username]
    );

    if (existingUsers.length > 0) {
      const isEmailTaken = existingUsers.some((user) => user.email === email);
      const isUsernameTaken = existingUsers.some(
        (user) => user.username === username
      );

      if (isEmailTaken && isUsernameTaken) {
        return res
          .status(400)
          .json({ message: "Both email and username are already taken" });
      } else if (isEmailTaken) {
        return res.status(400).json({ message: "Email is already registered" });
      } else {
        return res.status(400).json({ message: "Username is already taken" });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP expiration (15 minutes from now)
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Insert new user
    const [result] = await pool.query(
      "INSERT INTO users (username, email, password, role, is_verified, verification_otp, otp_expires, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
      [username, email, hashedPassword, userRole, false, otp, otpExpires]
    );

    // Send OTP email
    const emailResult = await sendOtpEmail(email, username, otp);

    // Response with or without OTP based on environment
    const response = {
      message:
        "Registration successful! Please check your email for the verification code.",
      user_id: result.insertId,
    };

    // Only in development, or if email failed, include OTP in response
    if (emailResult.isDev) {
      response._dev_note =
        "DEVELOPMENT MODE: Verification code included in response";
      response._verification_code = otp;
    }

    res.status(201).json(response);
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ message: "Username or email already exists" });
    }

    const errorMessage =
      process.env.NODE_ENV === "production"
        ? "An error occurred during registration"
        : error.message;

    res.status(500).json({ message: "Server error", error: errorMessage });
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  try {
    const email = xss(req.body.email?.trim().toLowerCase());
    const otp = xss(req.body.otp?.trim());

    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "Please provide email and verification code" });
    }

    // Find user with this email and OTP that hasn't expired
    const [users] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND verification_otp = ? AND otp_expires > NOW() AND is_verified = false",
      [email, otp]
    );

    if (users.length === 0) {
      return res.status(400).json({
        message:
          "Invalid or expired verification code. Please try again or request a new code.",
      });
    }

    const user = users[0];

    // Update user to verified status and clear OTP
    await pool.query(
      "UPDATE users SET is_verified = true, verification_otp = NULL, otp_expires = NULL WHERE user_id = ?",
      [user.user_id]
    );

    // Generate JWT token for auto-login
    const jwtToken = jwt.sign(
      {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
        issuer: "bassac-academy",
      }
    );

    // For security, set HTTP-only cookie with the token
    res.cookie("token", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    // Return user data without sensitive fields
    const userData = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
      profile_picture: user.profile_picture,
      bio: user.bio,
      created_at: user.created_at,
    };

    res.status(200).json({
      message: "Email verification successful! Your account is now active.",
      token: jwtToken,
      user: userData,
    });
  } catch (error) {
    console.error("OTP verification error:", error);

    const errorMessage =
      process.env.NODE_ENV === "production"
        ? "An error occurred during verification"
        : error.message;

    res.status(500).json({ message: "Server error", error: errorMessage });
  }
};

const resendOtp = async (req, res) => {
  try {
    // Sanitize input
    const email = xss(req.body.email?.trim().toLowerCase());
    
    // Input validation
    if (!email) {
      return res.status(400).json({ message: 'Please provide email address' });
    }
    
    // Find user with this email (both verified and unverified users)
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ 
        message: 'No account found with this email address' 
      });
    }
    
    const user = users[0];
    
    // Check if already verified
    if (user.is_verified) {
      return res.status(400).json({ 
        message: 'This email is already verified. Please log in.' 
      });
    }
    
    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set OTP expiration (15 minutes from now)
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    
    // Update user with new OTP
    await pool.query(
      'UPDATE users SET verification_otp = ?, otp_expires = ? WHERE user_id = ?',
      [otp, otpExpires, user.user_id]
    );
    
    // Send OTP email
    try {
      await sendOtpEmail(email, user.username, otp);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      
      // In development, return the OTP in the response
      if (process.env.NODE_ENV === 'development') {
        return res.status(200).json({
          message: 'A new verification code has been generated but email sending failed. Use the code below for testing.',
          user_id: user.user_id,
          _dev_verification_code: otp
        });
      } else {
        // In production, still let them know a code was generated
        return res.status(200).json({
          message: 'A new verification code has been generated, but we encountered an issue sending the email. Please try again later or contact support.',
          user_id: user.user_id
        });
      }
    }

    // Success response
    const response = {
      message: 'A new verification code has been sent to your email.',
      user_id: user.user_id
    };
    
    // Include OTP in development response
    if (process.env.NODE_ENV === 'development') {
      response._dev_verification_code = otp;
    }
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('Resend OTP error:', error);
    
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'An error occurred while resending the verification code' 
      : error.message;
      
    res.status(500).json({ message: 'Server error', error: errorMessage });
  }
};

const forceLogin = async (req, res) => {
  try {
    // Check if the requester is an admin
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const [admins] = await pool.query(
      'SELECT * FROM users WHERE user_id = ? AND role = "admin"',
      [adminId]
    );

    if (admins.length === 0) {
      return res.status(403).json({
        message: "Forbidden: Admin privileges required",
      });
    }

    // Get the target user ID from request
    const targetUserId = parseInt(req.body.targetUserId);

    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({
        message: "Valid target user ID is required",
      });
    }

    // Find the target user
    const [users] = await pool.query("SELECT * FROM users WHERE user_id = ?", [
      targetUserId,
    ]);

    if (users.length === 0) {
      return res.status(404).json({
        message: "Target user not found",
      });
    }

    const targetUser = users[0];

    // Log this administrative action for audit purposes
    await pool.query(
      "INSERT INTO admin_logs (admin_id, action, target_user_id, timestamp) VALUES (?, ?, ?, NOW())",
      [adminId, "FORCE_LOGIN", targetUserId]
    );

    // Generate JWT token for the target user
    const token = jwt.sign(
      {
        id: targetUser.user_id,
        role: targetUser.role,
        originalAdmin: adminId, // Include original admin ID for audit trail
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Shorter expiration for force logins
    );

    // Remove password from user object
    delete targetUser.password;

    // Set the cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Secure in production
      sameSite: "strict", // Helps prevent CSRF
      maxAge: 3600000, // 1 hour
    });

    res.json({
      message: `Admin force login successful as user ${targetUser.email}`,
      token,
      user: targetUser,
      isForceLogin: true,
      expiresIn: "1h",
    });
  } catch (error) {
    console.error("Force login error:", error);
    res.status(500).json({
      message: "Server error",
      error:
        process.env.NODE_ENV === "production"
          ? "An error occurred"
          : error.message,
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    // Sanitize inputs
    const email = xss(req.body.email?.trim().toLowerCase());
    const password = req.body.password; // Don't sanitize passwords

    // Input validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide email and password" });
    }

    // Find user by email
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (users.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = users[0];

    // Check if account is verified
    // Check if account is verified
    if (!user.is_verified) {
      return res.status(401).json({
        message: "Please verify your email before logging in",
        needsVerification: true,
        email: user.email,
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Use same error message to prevent account enumeration
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.user_id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    // Remove password from user object
    delete user.password;

    // Set secure cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use true in production
      sameSite: "strict", // Helps prevent CSRF
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server error",
      error:
        process.env.NODE_ENV === "production"
          ? "An error occurred"
          : error.message,
    });
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const [users] = await pool.query(
      "SELECT user_id, username, email, role, profile_picture, bio, created_at FROM users WHERE user_id = ?",
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(users[0]);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      message: "Server error",
      error:
        process.env.NODE_ENV === "production"
          ? "An error occurred"
          : error.message,
    });
  }
};

// Class login (second authentication level)
const classLogin = async (req, res) => {
  try {
    // Sanitize inputs
    const classId = parseInt(req.body.classId);
    const classCode = xss(req.body.classCode?.trim());
    const classPassword = req.body.classPassword; // Don't sanitize passwords

    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userId = req.user.id;

    // Input validation
    if (!classId || isNaN(classId) || !classCode || !classPassword) {
      return res
        .status(400)
        .json({ message: "Please provide valid class ID, code and password" });
    }

    // Check if class exists
    const [classes] = await pool.query(
      "SELECT * FROM classes WHERE class_id = ?",
      [classId]
    );

    if (classes.length === 0) {
      return res.status(404).json({ message: "Class not found" });
    }

    const classData = classes[0];

    // Verify class code
    if (classData.class_code !== classCode) {
      return res.status(400).json({ message: "Invalid class code" });
    }

    // Verify class password
    const isMatch = await bcrypt.compare(
      classPassword,
      classData.class_password
    );
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid class password" });
    }

    // Check if user is enrolled in the class
    const [enrollments] = await pool.query(
      'SELECT * FROM class_enrollments WHERE class_id = ? AND student_id = ? AND status = "approved"',
      [classId, userId]
    );

    if (enrollments.length === 0 && req.user.role !== "teacher") {
      return res
        .status(403)
        .json({ message: "You are not enrolled in this class" });
    }

    // Find active session
    const [sessions] = await pool.query(
      'SELECT * FROM class_sessions WHERE class_id = ? AND session_status = "active"',
      [classId]
    );

    let sessionId = null;
    if (sessions.length > 0) {
      sessionId = sessions[0].session_id;
    }

    // Create class login session (use sanitized client IP)
    const clientIp = xss(req.ip || "0.0.0.0");
    const userAgent = xss(req.headers["user-agent"] || "Unknown");

    await pool.query(
      "INSERT INTO class_login_sessions (student_id, class_id, session_id, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)",
      [userId, classId, sessionId, clientIp, userAgent]
    );

    // Generate class session token
    const classToken = jwt.sign(
      {
        userId,
        classId,
        sessionId,
        role: req.user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "4h" }
    );

    // Update attendance if there's an active session
    if (sessionId) {
      // Check if attendance record exists
      const [attendance] = await pool.query(
        "SELECT * FROM session_attendance WHERE session_id = ? AND student_id = ?",
        [sessionId, userId]
      );

      if (attendance.length > 0) {
        // Update existing record
        await pool.query(
          'UPDATE session_attendance SET join_time = NOW(), attendance_status = "present" WHERE session_id = ? AND student_id = ?',
          [sessionId, userId]
        );
      } else {
        // Create new attendance record
        await pool.query(
          'INSERT INTO session_attendance (session_id, student_id, join_time, attendance_status) VALUES (?, ?, NOW(), "present")',
          [sessionId, userId]
        );
      }
    }

    res.json({
      message: "Class login successful",
      classToken,
      roomId: sessions.length > 0 ? sessions[0].room_id : null,
    });
  } catch (error) {
    console.error("Class login error:", error);
    res.status(500).json({
      message: "Server error",
      error:
        process.env.NODE_ENV === "production"
          ? "An error occurred"
          : error.message,
    });
  }
};

// Class logout
const classLogout = async (req, res) => {
  try {
    const loginId = parseInt(req.body.loginId);

    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userId = req.user.id;

    // Validate login ID
    if (!loginId || isNaN(loginId)) {
      return res.status(400).json({ message: "Valid login ID is required" });
    }

    // Update class login session
    const [updateResult] = await pool.query(
      "UPDATE class_login_sessions SET logout_time = NOW(), is_active = FALSE WHERE login_id = ? AND student_id = ?",
      [loginId, userId]
    );

    if (updateResult.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "Login session not found or already ended" });
    }

    // Update attendance if needed
    const [loginSessions] = await pool.query(
      "SELECT * FROM class_login_sessions WHERE login_id = ?",
      [loginId]
    );

    if (loginSessions.length > 0 && loginSessions[0].session_id) {
      await pool.query(
        "UPDATE session_attendance SET leave_time = NOW() WHERE session_id = ? AND student_id = ?",
        [loginSessions[0].session_id, userId]
      );
    }

    res.json({ message: "Logged out of class successfully" });
  } catch (error) {
    console.error("Class logout error:", error);
    res.status(500).json({
      message: "Server error",
      error:
        process.env.NODE_ENV === "production"
          ? "An error occurred"
          : error.message,
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  classLogin,
  classLogout,
  verifyOtp,
  resendOtp,
  forceLogin,
};

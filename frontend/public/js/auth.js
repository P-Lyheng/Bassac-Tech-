// public/js/auth.js

/**
 * Token storage with localStorage and cookie fallback
 */
const tokenStorage = {
  /**
   * Store authentication token
   * @param {string} token - JWT token
   * @param {number} expiryDays - Days until token expires
   */
  setToken: function(token, expiryDays = 1) {
    try {
      localStorage.setItem('token', token);
    } catch (e) {
      // Fallback to cookies if localStorage is not available
      setCookie('token', token, { days: expiryDays });
    }
  },
  
  /**
   * Get authentication token
   * @returns {string|null} - The stored token or null
   */
  getToken: function() {
    try {
      // Try localStorage first
      const token = localStorage.getItem('token');
      if (token) return token;
      
      // Fallback to cookies
      return getCookie('token');
    } catch (e) {
      // If localStorage is not available, try cookies
      return getCookie('token');
    }
  },
  
  /**
   * Remove authentication token
   */
  removeToken: function() {
    try {
      localStorage.removeItem('token');
    } catch (e) {
      // Ignore localStorage errors
    }
    
    // Also remove from cookies to be safe
    deleteCookie('token');
  },

  /**
   * Store user data
   * @param {Object} user - User object
   */
  setUser: function(user) {
    try {
      localStorage.setItem('user', JSON.stringify(user));
    } catch (e) {
      // User data is less critical, only log error
      console.warn('Failed to store user data in localStorage:', e);
    }
  },

  /**
   * Get user data
   * @returns {Object|null} - User object or null
   */
  getUser: function() {
    try {
      const userJson = localStorage.getItem('user');
      return userJson ? JSON.parse(userJson) : null;
    } catch (e) {
      console.warn('Failed to get user data from localStorage:', e);
      return null;
    }
  },

  /**
   * Remove user data
   */
  removeUser: function() {
    try {
      localStorage.removeItem('user');
    } catch (e) {
      // Ignore localStorage errors
    }
  }
};

/**
 * Cookie management functions
 */

/**
 * Get a cookie value by name
 * @param {string} name - Name of the cookie to retrieve
 * @returns {string|null} - Cookie value or null if not found
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

/**
 * Set a cookie with options
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {Object} options - Cookie options
 * @param {number} options.days - Expiration in days
 * @param {string} options.path - Cookie path
 * @param {boolean} options.secure - Cookie secure flag
 * @param {boolean} options.sameSite - Cookie sameSite attribute
 */
function setCookie(name, value, options = {}) {
  const defaults = {
    days: 7,
    path: '/',
    secure: window.location.protocol === 'https:',
    sameSite: 'strict'
  };
  
  const opts = { ...defaults, ...options };
  
  // Set expiration
  let expires = '';
  if (opts.days) {
    const date = new Date();
    date.setTime(date.getTime() + (opts.days * 24 * 60 * 60 * 1000));
    expires = `; expires=${date.toUTCString()}`;
  }
  
  // Set path
  const path = `; path=${opts.path}`;
  
  // Set secure flag
  const secure = opts.secure ? '; secure' : '';
  
  // Set same site attribute
  const sameSite = opts.sameSite ? `; samesite=${opts.sameSite}` : '';
  
  // Set the cookie
  document.cookie = `${name}=${value}${expires}${path}${secure}${sameSite}`;
}

/**
 * Delete a cookie
 * @param {string} name - Name of the cookie to delete
 * @param {string} path - Path of the cookie (must match the path used to set)
 */
function deleteCookie(name, path = '/') {
  setCookie(name, '', { days: -1, path: path });
}

/**
 * Public authentication functions
 */

/**
 * Checks if the user is authenticated
 * @returns {Promise<Object|null>} User object if authenticated, null otherwise
 */
async function checkAuth() {
  try {
    // We don't need to manually send a token since the cookie will be sent automatically
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Important: This ensures cookies are sent
    });
    
    if (!response.ok) {
      console.log('Authentication failed:', response.status);
      tokenStorage.removeUser(); // Still clear any stored user data
      return null;
    }
    
    // Parse and return user data
    const userData = await response.json();
    
    // Update stored user data
    tokenStorage.setUser(userData);
    
    return userData;
  } catch (error) {
    console.error('Auth check failed:', error);
    return null;
  }
}

/**
 * Redirects to login page if not authenticated
 * @returns {Promise<Object|null>} User object if authenticated, redirects otherwise
 */
async function requireAuth() {
  const user = await checkAuth();
  
  if (!user) {
     window.location.href = '/login';
    return null;
  }
  
  return user;
}

/**
 * Gets the authentication token
 * @returns {string|null} Token if exists, null otherwise
 */
function getToken() {
  return tokenStorage.getToken();
}

/**
 * Gets the current user from storage
 * @returns {Object|null} User object if exists, null otherwise
 */
function getCurrentUser() {
  return tokenStorage.getUser();
}

/**
 * Logs out the current user
 * @returns {Promise<void>}
 */
async function logout() {
  try {
    // Call logout endpoint
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Clear storage regardless of server response
    tokenStorage.removeToken();
    tokenStorage.removeUser();
    
    // Redirect to login page
    window.location.href = '/login';
  }
}

/**
 * Login function
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Login result with success status and user data
 */
async function login(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Login failed'
      };
    }

    // Store token and user data
    if (data.token) {
      tokenStorage.setToken(data.token);
      
      if (data.user) {
        tokenStorage.setUser(data.user);
      }
    }

    return {
      success: true,
      user: data.user
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Network error. Please try again.'
    };
  }
}

// Export all functions
exports ={
  checkAuth,
  requireAuth,
  getToken,
  getCurrentUser,
  logout,
  login,
  getCookie,
  setCookie,
  deleteCookie
};
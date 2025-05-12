// public/js/auth.js

/**
 * Checks if the user is authenticated
 * @returns {Promise<Object|null>} User object if authenticated, null otherwise
 */
async function checkAuth() {
    try {
      // Check if token exists in localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.log('No token found in localStorage');
        return null;
      }
      
      // Verify token with backend
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.log('Token validation failed:', response.status);
        // Clear invalid token
        localStorage.removeItem('token');
        return null;
      }
      
      // Parse and return user data
      const userData = await response.json();
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
      window.location.href = '/login.html';
      return null;
    }
    
    return user;
  }
  
  /**
   * Gets the authentication token
   * @returns {string|null} Token if exists, null otherwise
   */
  function getToken() {
    return localStorage.getItem('token');
  }
  
  /**
   * Gets the current user from localStorage
   * @returns {Object|null} User object if exists, null otherwise
   */
  function getCurrentUser() {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
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
      // Clear local storage regardless of server response
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Redirect to login page
      window.location.href = '/login.html';
    }
  }
  
  /**
   * Gets cookie by name
   * @param {string} name Cookie name
   * @returns {string|null} Cookie value if exists, null otherwise
   */
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }
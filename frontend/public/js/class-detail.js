// js/class-details.js
document.addEventListener('DOMContentLoaded', async function() {
    try {
      // Check authentication
      const user = await checkAuth();
      
      // Redirect if not student
      if (!user || user.role !== 'student') {
        window.location.href = '/login.html';
        return;
      }
      
      // Update user info in navbar
      const usernameDisplay = document.getElementById('username-display');
      if (usernameDisplay) {
        usernameDisplay.textContent = user.username;
      }
      
      // Get class ID from URL
      const urlParams = new URLSearchParams(window.location.search);
      const classId = urlParams.get('id');
      
      if (!classId) {
        window.location.href = '/student-dashboard.html';
        return;
      }
      
      // Load class details
      await loadClassDetails(classId);
      
      // Set up event listeners
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
      }
    } catch (error) {
      console.error('Initialization error:', error);
      // Show a friendly error message to the user
      const container = document.querySelector('.container');
      if (container) {
        container.innerHTML = `
          <div class="alert alert-danger mt-4">
            <h4 class="alert-heading">Error</h4>
            <p>There was a problem loading the page: ${error.message}</p>
            <hr>
            <p class="mb-0">
              <a href="/student-dashboard.html" class="btn btn-outline-danger">Return to Dashboard</a>
            </p>
          </div>
        `;
      }
    }
  });
  
  /**
   * Helper function for formatting file size
   */
  function formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = parseInt(bytes, 10) || 0;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
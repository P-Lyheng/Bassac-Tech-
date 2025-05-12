// Admin Dashboard JavaScript

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = await requireAuth();
    
    // Redirect if not admin
    if (!user || user.role !== 'admin') {
        window.location.href = '/login.html';
        return;
    }
    
    // Update user info in navbar
    document.getElementById('username-display').textContent = user.username;
    document.getElementById('admin-name').textContent = user.username;
    
    // Initialize dashboard
    initializeDashboard();
    
    // Set up event listeners
    setupEventListeners();
});

/**
 * Initialize the dashboard by loading all necessary data
 */
async function initializeDashboard() {
    try {
        // Load stats
        await loadStats();
        
        // Load recent users
        await loadRecentUsers();
        
        // Load active sessions
        await loadActiveSessions();
        
        // Load admin logs
        await loadAdminLogs();
        
        // Load users for dropdowns
        await loadUsersForDropdowns();
        
        // Load instructors for class creation
        await loadInstructorsForDropdown();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

/**
 * Load statistics
 */
async function loadStats() {
    try {
        const response = await fetch('/api/admin/stats', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load statistics');
        }
        
        const stats = await response.json();
        
        // Update stats cards
        document.getElementById('users-count').textContent = stats.usersCount || 0;
        document.getElementById('classes-count').textContent = stats.classesCount || 0;
        document.getElementById('sessions-count').textContent = stats.sessionsCount || 0;
        document.getElementById('active-count').textContent = stats.activeSessionsCount || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
        // Show fallback stats (don't show error to user)
    }
}

/**
 * Load recent users
 */
async function loadRecentUsers() {
    try {
        // Show loading
        document.getElementById('recent-users-loading').style.display = 'block';
        
        const response = await fetch('/api/users', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        
        const users = await response.json();
        
        // Hide loading
        document.getElementById('recent-users-loading').style.display = 'none';
        
        // Get only the most recent users (up to 10)
        const recentUsers = users.slice(0, 10);
        
        // Populate recent users table
        const tableBody = document.getElementById('recent-users-table-body');
        tableBody.innerHTML = '';
        
        recentUsers.forEach(user => {
            // Format date
            const createdDate = new Date(user.created_at);
            const formattedDate = createdDate.toLocaleDateString();
            
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${user.user_id}</td>
                <td>${user.username}</td>
                <td>${user.email}</td>
                <td><span class="badge bg-secondary">${user.role}</span></td>
                <td>${formattedDate}</td>
                <td>
                    <span class="badge ${user.is_verified ? 'bg-success' : 'bg-warning'}">
                        ${user.is_verified ? 'Verified' : 'Pending'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-primary view-user-btn" data-id="${user.user_id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-warning edit-user-btn" data-id="${user.user_id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger delete-user-btn" data-id="${user.user_id}">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners
        addUserButtonListeners();
    } catch (error) {
        console.error('Error loading recent users:', error);
        document.getElementById('recent-users-loading').style.display = 'none';
    }
}

/**
 * Load active sessions
 */
async function loadActiveSessions() {
    try {
        // Show loading
        document.getElementById('active-sessions-loading').style.display = 'block';
        document.getElementById('active-sessions-empty').classList.add('d-none');
        
        const response = await fetch('/api/sessions/active', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load active sessions');
        }
        
        const sessions = await response.json();
        
        // Hide loading
        document.getElementById('active-sessions-loading').style.display = 'none';
        
        // Check if no sessions
        if (sessions.length === 0) {
            document.getElementById('active-sessions-empty').classList.remove('d-none');
            return;
        }
        
        // Populate active sessions table
        const tableBody = document.getElementById('active-sessions-table-body');
        tableBody.innerHTML = '';
        
        sessions.forEach(session => {
            // Format date
            const startTime = new Date(session.actual_start);
            const formattedStart = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${session.session_name}</td>
                <td>${session.class_name}</td>
                <td>${session.instructor_name}</td>
                <td>${formattedStart}</td>
                <td>${session.participants_count || 0}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-primary join-session-btn" 
                            data-id="${session.session_id}" 
                            data-room="${session.room_id}">
                            <i class="fas fa-video"></i>
                        </button>
                        <button class="btn btn-danger end-session-btn" data-id="${session.session_id}">
                            <i class="fas fa-times-circle"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners
        document.querySelectorAll('.join-session-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const sessionId = this.getAttribute('data-id');
                const roomId = this.getAttribute('data-room');
                
                window.location.href = `/videoroom.html?session=${sessionId}&room=${roomId}`;
            });
        });
        
        document.querySelectorAll('.end-session-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const sessionId = this.getAttribute('data-id');
                
                if (confirm('Are you sure you want to end this session? This will disconnect all participants.')) {
                    endSession(sessionId);
                }
            });
        });
    } catch (error) {
        console.error('Error loading active sessions:', error);
        document.getElementById('active-sessions-loading').style.display = 'none';
    }
}

/**
 * Load admin logs
 */
async function loadAdminLogs() {
    try {
        // Show loading
        document.getElementById('admin-logs-loading').style.display = 'block';
        
        const response = await fetch('/api/admin/logs', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load admin logs');
        }
        
        const logs = await response.json();
        
        // Hide loading
        document.getElementById('admin-logs-loading').style.display = 'none';
        
        // Populate logs table
        const tableBody = document.getElementById('admin-logs-table-body');
        tableBody.innerHTML = '';
        
        llogs.forEach(log => {
            // Format date
            const timestamp = new Date(log.timestamp);
            const formattedTimestamp = timestamp.toLocaleString();
            
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${log.log_id}</td>
                <td>${log.admin_username}</td>
                <td>${log.action}</td>
                <td>${log.target_username || 'N/A'}</td>
                <td>${formattedTimestamp}</td>
                <td>
                    <button class="btn btn-sm btn-info view-log-details-btn" data-id="${log.log_id}">
                        <i class="fas fa-info-circle"></i> Details
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners for log details
        document.querySelectorAll('.view-log-details-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const logId = this.getAttribute('data-id');
                viewLogDetails(logId);
            });
        });
    } catch (error) {
        console.error('Error loading admin logs:', error);
        document.getElementById('admin-logs-loading').style.display = 'none';
    }
}

/**
 * Load users for dropdowns
 */
async function loadUsersForDropdowns() {
    try {
        const response = await fetch('/api/users', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        
        const users = await response.json();
        
        // Populate force login user dropdown
        const forceLoginSelect = document.getElementById('force-login-user');
        forceLoginSelect.innerHTML = '';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.user_id;
            option.textContent = `${user.username} (${user.email}) - ${user.role}`;
            forceLoginSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading users for dropdowns:', error);
    }
}

/**
 * Load instructors for class dropdown
 */
async function loadInstructorsForDropdown() {
    try {
        const response = await fetch('/api/users?role=instructor', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load instructors');
        }
        
        const instructors = await response.json();
        
        // Populate instructor dropdown
        const instructorSelect = document.getElementById('class-instructor');
        instructorSelect.innerHTML = '';
        
        instructors.forEach(instructor => {
            const option = document.createElement('option');
            option.value = instructor.user_id;
            option.textContent = `${instructor.username} (${instructor.email})`;
            instructorSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading instructors for dropdown:', error);
    }
}

/**
 * Add event listeners to user buttons
 */
function addUserButtonListeners() {
    // View user
    document.querySelectorAll('.view-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            window.location.href = `/user-details.html?id=${userId}`;
        });
    });
    
    // Edit user
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            window.location.href = `/edit-user.html?id=${userId}`;
        });
    });
    
    // Delete user
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-id');
            
            if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                deleteUser(userId);
            }
        });
    });
}

/**
 * Delete a user
 */
async function deleteUser(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete user');
        }
        
        // Reload users
        await loadRecentUsers();
        
        // Reload stats
        await loadStats();
        
        // Show success message
        alert('User deleted successfully');
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user: ' + error.message);
    }
}

/**
 * End a session
 */
async function endSession(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}/end`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to end session');
        }
        
        // Reload sessions
        await loadActiveSessions();
        
        // Reload stats
        await loadStats();
        
        // Show success message
        alert('Session ended successfully');
    } catch (error) {
        console.error('Error ending session:', error);
        alert('Error ending session: ' + error.message);
    }
}

/**
 * View log details
 */
function viewLogDetails(logId) {
    // In a real implementation, you would fetch the log details from the server
    // For now, just show an alert
    alert(`Viewing details for log ID: ${logId}`);
}

/**
 * Create a new user
 */
async function createUser() {
    const username = document.getElementById('user-username').value;
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const isVerified = document.getElementById('user-verified').checked;
    const errorElement = document.getElementById('create-user-error');
    
    // Hide previous errors
    errorElement.classList.add('d-none');
    
    // Validate form
    if (!username || !email || !password || !role) {
        errorElement.textContent = 'All fields are required';
        errorElement.classList.remove('d-none');
        return;
    }
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                email,
                password,
                role,
                isVerified
            }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to create user');
        }
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createUserModal'));
        modal.hide();
        
        // Show success message
        alert('User created successfully');
        
        // Reset form
        document.getElementById('create-user-form').reset();
        
        // Reload users
        await loadRecentUsers();
        
        // Reload stats
        await loadStats();
        
        // Reload users for dropdowns
        await loadUsersForDropdowns();
    } catch (error) {
        console.error('Error creating user:', error);
        errorElement.textContent = error.message;
        errorElement.classList.remove('d-none');
    }
}

/**
 * Create a new class
 */
async function createClass() {
    const className = document.getElementById('class-name').value;
    const instructorId = document.getElementById('class-instructor').value;
    const description = document.getElementById('class-description').value;
    const capacity = document.getElementById('class-capacity').value;
    const password = document.getElementById('class-password').value;
    const errorElement = document.getElementById('create-class-error');
    
    // Hide previous errors
    errorElement.classList.add('d-none');
    
    // Validate form
    if (!className || !instructorId || !password) {
        errorElement.textContent = 'Class name, instructor, and password are required';
        errorElement.classList.remove('d-none');
        return;
    }
    
    try {
        const response = await fetch('/api/classes', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                className,
                instructorId,
                description,
                capacity: parseInt(capacity),
                classPassword: password
            }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to create class');
        }
        
        const data = await response.json();
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createClassModal'));
        modal.hide();
        
        // Show success message
        alert(`Class created successfully!\nClass Code: ${data.classCode}`);
        
        // Reset form
        document.getElementById('create-class-form').reset();
        
        // Reload stats
        await loadStats();
    } catch (error) {
        console.error('Error creating class:', error);
        errorElement.textContent = error.message;
        errorElement.classList.remove('d-none');
    }
}

/**
 * Force login as user
 */
async function forceLogin() {
    const targetUserId = document.getElementById('force-login-user').value;
    const errorElement = document.getElementById('force-login-error');
    
    // Hide previous errors
    errorElement.classList.add('d-none');
    
    // Validate form
    if (!targetUserId) {
        errorElement.textContent = 'Please select a user';
        errorElement.classList.remove('d-none');
        return;
    }
    
    try {
        const response = await fetch('/api/auth/force-login', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                targetUserId
            }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to force login');
        }
        
        const data = await response.json();
        
        // Store new token and user
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('forceLoginModal'));
        modal.hide();
        
        // Show success message and redirect based on role
        alert(`Successfully logged in as ${data.user.username} (${data.user.role})`);
        
        // Redirect based on role
        if (data.user.role === 'instructor' || data.user.role === 'teacher') {
            window.location.href = '/dashboard/teacher';
        } else if (data.user.role === 'student') {
            window.location.href = '/dashboard/student';
        } else {
            // Reload page to refresh admin view
            window.location.reload();
        }
    } catch (error) {
        console.error('Error forcing login:', error);
        errorElement.textContent = error.message;
        errorElement.classList.remove('d-none');
    }
}

/**
 * Load system status
 */
async function loadSystemStatus() {
    try {
        const response = await fetch('/api/admin/system-status', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load system status');
        }
        
        const status = await response.json();
        
        // Update system status modal
        document.getElementById('db-status').textContent = status.database.connected ? 'Connected' : 'Disconnected';
        document.getElementById('db-status').className = status.database.connected ? 'text-success' : 'text-danger';
        document.getElementById('db-name').textContent = status.database.name;
        document.getElementById('db-size').textContent = status.database.size;
        
        document.getElementById('server-uptime').textContent = status.server.uptime;
        document.getElementById('memory-usage').textContent = status.server.memoryUsage;
        document.getElementById('server-version').textContent = status.server.version;
        
        document.getElementById('stat-users').textContent = status.statistics.usersCount;
        document.getElementById('stat-classes').textContent = status.statistics.classesCount;
        document.getElementById('stat-sessions').textContent = status.statistics.sessionsCount;
        document.getElementById('stat-active-sessions').textContent = status.statistics.activeSessionsCount;
        document.getElementById('stat-storage').textContent = status.statistics.storageUsed;
    } catch (error) {
        console.error('Error loading system status:', error);
        alert('Error loading system status: ' + error.message);
    }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Refresh buttons
    document.getElementById('refresh-active-sessions').addEventListener('click', loadActiveSessions);
    
    // Create user button
    document.getElementById('create-user-btn').addEventListener('click', createUser);
    
    // Create class button
    document.getElementById('create-class-btn').addEventListener('click', createClass);
    
    // Force login button
    document.getElementById('force-login-btn').addEventListener('click', function() {
        const modal = new bootstrap.Modal(document.getElementById('forceLoginModal'));
        modal.show();
    });
    
    document.getElementById('force-login-submit-btn').addEventListener('click', forceLogin);
    
    // System status button
    document.getElementById('system-status-btn').addEventListener('click', function() {
        loadSystemStatus();
        const modal = new bootstrap.Modal(document.getElementById('systemStatusModal'));
        modal.show();
    });
    
    document.getElementById('refresh-status-btn').addEventListener('click', loadSystemStatus);
}
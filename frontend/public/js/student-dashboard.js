/**
 * Student Dashboard JavaScript
 * Handles functionality for the student dashboard page
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = await requireAuth();
    
    // Redirect if not student
    if (!user || user.role !== 'student') {
        window.location.href = '/login.html';
        return;
    }
    
    // Update user info in navbar
    document.getElementById('username-display').textContent = user.username;
    document.getElementById('student-name').textContent = user.username;
    
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
        
        // Load active sessions
        await loadActiveSessions();
        
        // Load upcoming sessions
        await loadUpcomingSessions();
        
        // Load enrolled classes
        await loadEnrolledClasses();
        
        // Load recent learning materials
        await loadRecentMaterials();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

/**
 * Load statistics
 */
async function loadStats() {
    try {
        const response = await fetch('/api/student/stats', {
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
        document.getElementById('classes-count').textContent = stats.enrolledClassesCount || 0;
        document.getElementById('completed-count').textContent = stats.completedSessionsCount || 0;
        document.getElementById('upcoming-count').textContent = stats.upcomingSessionsCount || 0;
        document.getElementById('materials-count').textContent = stats.materialsCount || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
        // Show fallback stats (don't show error to user)
    }
}

/**
 * Load active sessions
 */
async function loadActiveSessions() {
    try {
        // Show loading
        document.getElementById('active-sessions-loading').classList.remove('d-none');
        document.getElementById('active-sessions-container').innerHTML = '';
        document.getElementById('active-sessions-empty').classList.add('d-none');
        
        const response = await fetch('/api/student/sessions/active', {
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
        document.getElementById('active-sessions-loading').classList.add('d-none');
        
        // Check if no sessions
        if (sessions.length === 0) {
            document.getElementById('active-sessions-empty').classList.remove('d-none');
            return;
        }
        
        // Populate active sessions
        const container = document.getElementById('active-sessions-container');
        
        sessions.forEach(session => {
            // Format dates
            const startTime = new Date(session.actual_start || session.scheduled_start);
            const formattedStart = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // Create card
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4';
            
            col.innerHTML = `
                <div class="card h-100 active-session-card">
                    <div class="card-body session-card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <h5 class="card-title">${session.title || session.session_name}</h5>
                            <span class="badge bg-success">Active</span>
                        </div>
                        <h6 class="card-subtitle mb-2 text-muted">${session.class_name}</h6>
                        <p class="card-text small">Started at ${formattedStart}</p>
                        <p class="card-text small">
                            <i class="fas fa-chalkboard-teacher me-1"></i> 
                            <span>${session.instructor_name || 'Instructor'}</span>
                        </p>
                        <p class="card-text">
                            <i class="fas fa-users me-1"></i> 
                            <span>${session.participants_count || 0}</span> participants
                        </p>
                        <div class="session-card-actions d-grid gap-2">
                            <button class="btn btn-primary join-session-btn" 
                                data-id="${session.session_id}" 
                                data-room="${session.room_id}">
                                <i class="fas fa-video me-1"></i> Join Session
                            </button>
                            <button class="btn btn-outline-secondary view-session-details-btn" 
                                data-id="${session.session_id}">
                                <i class="fas fa-info-circle me-1"></i> View Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(col);
        });
        
        // Add event listeners
        document.querySelectorAll('.join-session-btn').forEach(btn => {
            btn.addEventListener('click', joinSession);
        });
        
        document.querySelectorAll('.view-session-details-btn').forEach(btn => {
            btn.addEventListener('click', viewSessionDetails);
        });
    } catch (error) {
        console.error('Error loading active sessions:', error);
        document.getElementById('active-sessions-loading').classList.add('d-none');
        document.getElementById('active-sessions-empty').classList.remove('d-none');
        document.getElementById('active-sessions-empty').innerHTML = `
            <i class="fas fa-exclamation-circle fa-2x text-danger mb-3"></i>
            <p>Error loading active sessions. Please try again later.</p>
        `;
    }
}

/**
 * Load upcoming sessions
 */
async function loadUpcomingSessions() {
    try {
        // Show loading
        document.getElementById('upcoming-sessions-loading').classList.remove('d-none');
        document.getElementById('upcoming-sessions-table-body').innerHTML = '';
        document.getElementById('upcoming-sessions-empty').classList.add('d-none');
        
        const response = await fetch('/api/student/sessions/upcoming', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load upcoming sessions');
        }
        
        const sessions = await response.json();
        
        // Hide loading
        document.getElementById('upcoming-sessions-loading').classList.add('d-none');
        
        // Check if no sessions
        if (sessions.length === 0) {
            document.getElementById('upcoming-sessions-empty').classList.remove('d-none');
            return;
        }
        
        // Populate upcoming sessions table
        const tableBody = document.getElementById('upcoming-sessions-table-body');
        
        sessions.forEach(session => {
            // Format dates
            const startDate = new Date(session.scheduled_start);
            const formattedDate = startDate.toLocaleDateString();
            const formattedTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${session.title || session.session_name}</td>
                <td>${session.class_name}</td>
                <td>${formattedDate} ${formattedTime}</td>
                <td>${session.instructor_name || 'Instructor'}</td>
                <td>
                    <button class="btn btn-sm btn-outline-secondary view-session-details-btn" data-id="${session.session_id}">
                        <i class="fas fa-info-circle me-1"></i> Details
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners
        document.querySelectorAll('.view-session-details-btn').forEach(btn => {
            btn.addEventListener('click', viewSessionDetails);
        });
    } catch (error) {
        console.error('Error loading upcoming sessions:', error);
        document.getElementById('upcoming-sessions-loading').classList.add('d-none');
        document.getElementById('upcoming-sessions-empty').classList.remove('d-none');
        document.getElementById('upcoming-sessions-empty').innerHTML = `
            <i class="fas fa-exclamation-circle text-danger me-2"></i>
            Error loading upcoming sessions. Please try again later.
        `;
    }
}

/**
 * Load enrolled classes
 */
async function loadEnrolledClasses() {
    try {
        // Show loading
        document.getElementById('enrolled-classes-loading').classList.remove('d-none');
        document.getElementById('enrolled-classes-container').innerHTML = '';
        document.getElementById('enrolled-classes-empty').classList.add('d-none');
        
        const response = await fetch('/api/student/classes/enrolled', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load enrolled classes');
        }
        
        const classes = await response.json();
        
        // Hide loading
        document.getElementById('enrolled-classes-loading').classList.add('d-none');
        
        // Check if no classes
        if (classes.length === 0) {
            document.getElementById('enrolled-classes-empty').classList.remove('d-none');
            return;
        }
        
        // Get only the most recent classes (up to 6)
        const recentClasses = classes.slice(0, 6);
        
        // Populate enrolled classes
        const container = document.getElementById('enrolled-classes-container');
        
        recentClasses.forEach(classItem => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4';
            
            // Set card status based on enrollment
            let statusBadge = '';
            if (classItem.enrollment_status === 'approved') {
                statusBadge = '<span class="badge bg-success">Enrolled</span>';
            } else if (classItem.enrollment_status === 'pending') {
                statusBadge = '<span class="badge bg-warning">Pending</span>';
            } else {
                statusBadge = '<span class="badge bg-secondary">Inactive</span>';
            }
            
            col.innerHTML = `
                <div class="card h-100 class-card">
                    <div class="card-body">
                        <h5 class="card-title">${classItem.title || classItem.class_name}</h5>
                        <p class="card-text small">${classItem.description || 'No description provided'}</p>
                        <p class="card-text small">
                            <i class="fas fa-chalkboard-teacher me-1"></i> 
                            ${classItem.instructor_name || 'Instructor'}
                        </p>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            ${statusBadge}
                            <span class="text-muted small">
                                <i class="fas fa-users me-1"></i> ${classItem.enrolled_count || 0} students
                            </span>
                        </div>
                    </div>
                    <div class="card-footer bg-transparent">
                        <a href="class-details.html?id=${classItem.class_id}" class="btn btn-sm btn-outline-primary w-100">
                            <i class="fas fa-info-circle me-1"></i> View Class
                        </a>
                    </div>
                </div>
            `;
            
            container.appendChild(col);
        });
    } catch (error) {
        console.error('Error loading enrolled classes:', error);
        document.getElementById('enrolled-classes-loading').classList.add('d-none');
        document.getElementById('enrolled-classes-empty').classList.remove('d-none');
        document.getElementById('enrolled-classes-empty').innerHTML = `
            <i class="fas fa-exclamation-circle text-danger me-2"></i>
            Error loading classes. Please try again later.
        `;
    }
}

/**
 * Load recent learning materials
 */
async function loadRecentMaterials() {
    try {
        // Show loading
        document.getElementById('materials-loading').classList.remove('d-none');
        document.getElementById('materials-table-body').innerHTML = '';
        document.getElementById('materials-empty').classList.add('d-none');
        
        const response = await fetch('/api/student/materials', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load learning materials');
        }
        
        const materials = await response.json();
        
        // Hide loading
        document.getElementById('materials-loading').classList.add('d-none');
        
        // Check if no materials
        if (materials.length === 0) {
            document.getElementById('materials-empty').classList.remove('d-none');
            return;
        }
        
        // Show only the 5 most recent materials
        const recentMaterials = materials.slice(0, 5);
        
        // Populate materials table
        const tableBody = document.getElementById('materials-table-body');
        
        recentMaterials.forEach(material => {
            // Format date
            const uploadDate = new Date(material.upload_date);
            const formattedDate = uploadDate.toLocaleDateString();
            
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${material.title}</td>
                <td>${material.class_name}</td>
                <td>${formattedDate}</td>
                <td>
                    <a href="/api/materials/${material.material_id}/download" class="btn btn-sm btn-success" target="_blank">
                        <i class="fas fa-download me-1"></i> Download
                    </a>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading learning materials:', error);
        document.getElementById('materials-loading').classList.add('d-none');
        document.getElementById('materials-empty').classList.remove('d-none');
        document.getElementById('materials-empty').innerHTML = `
            <i class="fas fa-exclamation-circle text-danger me-2"></i>
            Error loading materials. Please try again later.
        `;
    }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Refresh buttons
    document.getElementById('refresh-active-sessions').addEventListener('click', function() {
        loadActiveSessions();
    });
    
    // Join class button
    document.getElementById('join-class-btn').addEventListener('click', joinClass);
}

/**
 * Join a class with class code and password
 */
async function joinClass() {
    const classCode = document.getElementById('class-code').value;
    const classPassword = document.getElementById('class-password').value;
    const errorElement = document.getElementById('join-class-error');
    const successElement = document.getElementById('join-class-success');
    
    // Hide previous messages
    errorElement.classList.add('d-none');
    successElement.classList.add('d-none');
    
    // Validate form
    if (!classCode || !classPassword) {
        errorElement.textContent = 'Class code and password are required';
        errorElement.classList.remove('d-none');
        return;
    }
    
    try {
        const response = await fetch('/api/student/classes/join', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                classCode,
                classPassword
            }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to join class');
        }
        
        // Show success message
        successElement.textContent = data.message;
        successElement.classList.remove('d-none');
        
        // Disable the join button temporarily
        const joinButton = document.getElementById('join-class-btn');
        joinButton.disabled = true;
        
        // Reset form after 3 seconds and reload dashboard data
        setTimeout(() => {
            // Reset form
            document.getElementById('join-class-form').reset();
            successElement.classList.add('d-none');
            joinButton.disabled = false;
            
            // Hide modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('joinClassModal'));
            modal.hide();
            
            // Reload dashboard data
            loadStats();
            loadEnrolledClasses();
            loadUpcomingSessions();
            loadRecentMaterials();
        }, 3000);
    } catch (error) {
        console.error('Error joining class:', error);
        errorElement.textContent = error.message;
        errorElement.classList.remove('d-none');
    }
}

/**
 * Join a session
 */
function joinSession(event) {
    const sessionId = event.currentTarget.getAttribute('data-id');
    const roomId = event.currentTarget.getAttribute('data-room');
    
    // Redirect to video room
    joinVideoRoom(sessionId, roomId);
}

/**
 * Join a video room
 */
function joinVideoRoom(sessionId, roomId) {
    window.location.href = `/videoroom?session=${sessionId}&room=${roomId}&role=student`;
}

/**
 * View session details
 */
async function viewSessionDetails(event) {
    const sessionId = event.currentTarget.getAttribute('data-id');
    
    try {
        // Fetch session details
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load session details');
        }
        
        const session = await response.json();
        
        // Populate modal
        document.getElementById('session-details-title').textContent = session.title || session.session_name;
        
        // Format dates
        const scheduledStartDate = new Date(session.scheduled_start);
        const scheduledEndDate = new Date(session.scheduled_end);
        const formattedStartDate = scheduledStartDate.toLocaleDateString();
        const formattedStartTime = scheduledStartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const formattedEndTime = scheduledEndDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Check if session is active
        const isActive = session.session_status === 'active';
        const joinButton = document.getElementById('join-session-from-details-btn');
        
        if (isActive) {
            joinButton.classList.remove('d-none');
            joinButton.setAttribute('data-id', session.session_id);
            joinButton.setAttribute('data-room', session.room_id);
            
            // Add event listener
            joinButton.addEventListener('click', function() {
                joinVideoRoom(session.session_id, session.room_id);
            });
        } else {
            joinButton.classList.add('d-none');
        }
        
        // Prepare content
        let content = `
            <div class="mb-3">
                <h6>Class:</h6>
                <p>${session.class_name}</p>
            </div>
            <div class="mb-3">
                <h6>Description:</h6>
                <p>${session.description || 'No description provided'}</p>
            </div>
            <div class="mb-3">
                <h6>Scheduled Time:</h6>
                <p>${formattedStartDate} (${formattedStartTime} - ${formattedEndTime})</p>
            </div>
            <div class="mb-3">
                <h6>Instructor:</h6>
                <p>${session.instructor_name || 'Not specified'}</p>
            </div>
            <div class="mb-3">
                <h6>Status:</h6>
                <p>
                    <span class="badge ${isActive ? 'bg-success' : 'bg-primary'}">
                        ${isActive ? 'Active' : 'Scheduled'}
                    </span>
                </p>
            </div>
        `;
        
        // If session is active, add more information
        if (isActive) {
            const actualStartDate = new Date(session.actual_start);
            const formattedActualStart = actualStartDate.toLocaleString();
            
            content += `
                <div class="mb-3">
                    <h6>Started at:</h6>
                    <p>${formattedActualStart}</p>
                </div>
                <div class="mb-3">
                    <h6>Participants:</h6>
                    <p>${session.participants_count || '0'} student(s) currently in session</p>
                </div>
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    You can join this active session by clicking the "Join Session" button below.
                </div>
            `;
        } else {
            content += `
                <div class="alert alert-secondary">
                    <i class="fas fa-clock me-2"></i>
                    This session is not yet active. Check back at the scheduled time.
                </div>
            `;
        }
        
        document.getElementById('session-details-content').innerHTML = content;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('sessionDetailsModal'));
        modal.show();
        
    } catch (error) {
        console.error('Error loading session details:', error);
        alert('Failed to load session details: ' + error.message);
    }
}
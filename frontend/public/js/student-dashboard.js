// ../js/student-dashboard.js

document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Check authentication
        const user = await requireAuth();
        
        // If user is not a student, redirect to appropriate dashboard
        if (user.role !== 'student') {
            window.location.href = user.role === 'teacher' ? '/teacher-dashboard' : '/login';
            return;
        }
        
        // Update user info in navbar and welcome message
        document.getElementById('username-display').textContent = user.username;
        document.getElementById('student-name').textContent = user.username;
        
        // Initialize dashboard
        initializeDashboard();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        // Show error notification
        showNotification('Error', 'Failed to load dashboard. Please refresh the page.', 'danger');
    }
});

/**
 * Initialize the dashboard by loading all necessary data
 */
async function initializeDashboard() {
    try {
        // Load all dashboard data in parallel
        await Promise.all([
            loadStats(),
            loadActiveSessions(),
            loadUpcomingSessions(),
            loadEnrolledClasses(),
            loadRecentMaterials()
        ]);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Error', 'Some dashboard components failed to load.', 'warning');
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
        document.getElementById('classes-count').textContent = stats.classesCount||0;
        document.getElementById('active-sessions-count').textContent = stats.activeSessionsCount || 0;
        document.getElementById('materials-count').textContent = stats.materialsCount || 0;
        console.log(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
        // Don't show visible error for stats, just log it
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
            
            const sessionCard = document.createElement('div');
            sessionCard.className = 'card session-card active-session mb-3';
            
            sessionCard.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="card-title">${session.title}</h5>
                            <h6 class="card-subtitle mb-2 text-muted">${session.class_name}</h6>
                            <p class="card-text small">
                                <i class="fas fa-user-tie me-1"></i> Instructor: ${session.instructor_name || 'Unknown'}
                            </p>
                            <p class="card-text small">
                                <i class="fas fa-clock me-1"></i> Started at ${formattedStart}
                            </p>
                            <p class="card-text small">
                                <i class="fas fa-users me-1"></i> ${session.participants_count || 0} participants
                            </p>
                        </div>
                        <div>
                            <span class="badge bg-success mb-2">Live Now</span>
                        </div>
                    </div>
                    <button class="btn btn-primary join-session-btn mt-2" 
                        data-id="${session.session_id}" 
                        data-room="${session.room_id}">
                        <i class="fas fa-video me-1"></i> Join Session
                    </button>
                </div>
            `;
            
            container.appendChild(sessionCard);
        });
        
        // Add event listeners
        document.querySelectorAll('.join-session-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const sessionId = this.getAttribute('data-id');
                const roomId = this.getAttribute('data-room');
                joinSession(sessionId, roomId);
            });
        });
    } catch (error) {
        console.error('Error loading active sessions:', error);
        document.getElementById('active-sessions-loading').classList.add('d-none');
        document.getElementById('active-sessions-empty').classList.remove('d-none');
        document.getElementById('active-sessions-empty').innerHTML = `
            <div class="text-danger mb-3">
                <i class="fas fa-exclamation-circle fa-2x"></i>
            </div>
            <p>Error loading active sessions. Please try again later.</p>
            <button class="btn btn-sm btn-outline-primary mt-2" id="retry-active-sessions">
                <i class="fas fa-sync-alt me-1"></i> Retry
            </button>
        `;
        
        // Add retry button event listener
        document.getElementById('retry-active-sessions')?.addEventListener('click', loadActiveSessions);
    }
}

/**
 * Load upcoming sessions
 */
async function loadUpcomingSessions() {
    try {
        // Show loading
        document.getElementById('upcoming-sessions-loading').classList.remove('d-none');
        document.getElementById('upcoming-sessions-container').innerHTML = '';
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
        
        // Populate upcoming sessions
        const container = document.getElementById('upcoming-sessions-container');
        
        sessions.forEach(session => {
            // Format dates
            const startDate = new Date(session.scheduled_start);
            const formattedDate = startDate.toLocaleDateString();
            const formattedTime = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const sessionCard = document.createElement('div');
            sessionCard.className = 'card session-card scheduled-session mb-3';
            
            sessionCard.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h5 class="card-title">${session.title}</h5>
                            <h6 class="card-subtitle mb-2 text-muted">${session.class_name}</h6>
                            <p class="card-text small">
                                <i class="fas fa-user-tie me-1"></i> Instructor: ${session.instructor_name || 'Unknown'}
                            </p>
                            <p class="card-text small">
                                <i class="fas fa-calendar-alt me-1"></i> ${formattedDate} at ${formattedTime}
                            </p>
                        </div>
                        <div>
                            <span class="badge bg-primary mb-2">Upcoming</span>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center mt-2">
                        <div>
                            <button class="btn btn-sm btn-outline-secondary add-to-calendar-btn" 
                                data-id="${session.session_id}" 
                                data-title="${session.title}"
                                data-start="${session.scheduled_start}">
                                <i class="fas fa-calendar-plus me-1"></i> Add to Calendar
                            </button>
                        </div>
                        <div>
                            <span class="text-muted session-time">
                                ${getTimeUntil(startDate)}
                            </span>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(sessionCard);
        });
        
        // Add event listeners
        document.querySelectorAll('.add-to-calendar-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const sessionId = this.getAttribute('data-id');
                const title = this.getAttribute('data-title');
                const startDate = new Date(this.getAttribute('data-start'));
                
                addToCalendar(title, startDate);
            });
        });
    } catch (error) {
        console.error('Error loading upcoming sessions:', error);
        document.getElementById('upcoming-sessions-loading').classList.add('d-none');
        document.getElementById('upcoming-sessions-empty').classList.remove('d-none');
        document.getElementById('upcoming-sessions-empty').innerHTML = `
            <div class="text-danger mb-3">
                <i class="fas fa-exclamation-circle fa-2x"></i>
            </div>
            <p>Error loading upcoming sessions. Please try again later.</p>
            <button class="btn btn-sm btn-outline-primary mt-2" id="retry-upcoming-sessions">
                <i class="fas fa-sync-alt me-1"></i> Retry
            </button>
        `;
        
        // Add retry button event listener
        document.getElementById('retry-upcoming-sessions')?.addEventListener('click', loadUpcomingSessions);
    }
}

/**
 * Load enrolled classes
 */
async function loadEnrolledClasses() {
    try {
        // Show loading
        document.getElementById('classes-loading').classList.remove('d-none');
        document.getElementById('classes-container').innerHTML = '';
        document.getElementById('classes-empty').classList.add('d-none');
        
        const response = await fetch('/api/student/classes/enrolled', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load classes');
        }
        
        const classes = await response.json();
        
        // Hide loading
        document.getElementById('classes-loading').classList.add('d-none');
        
        // Check if no classes
        if (classes.length === 0) {
            document.getElementById('classes-empty').classList.remove('d-none');
            return;
        }
        
        // Get a subset of classes (up to 4)
        const recentClasses = classes.slice(0, 4);
        
        // Populate classes
        const container = document.getElementById('classes-container');
        
        recentClasses.forEach(classItem => {
            const col = document.createElement('div');
            col.className = 'col';
            
            col.innerHTML = `
                <div class="class-card">
                    <div class="card-body">
                        <span class="class-badge badge ${classItem.is_active ? 'bg-success' : 'bg-secondary'}">
                            ${classItem.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <h5 class="card-title">${classItem.class_name}</h5>
                        <p class="card-text small">${classItem.description || 'No description provided'}</p>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <span class="text-muted small">
                                <i class="fas fa-user-tie me-1"></i> ${classItem.instructor_name || 'Unknown instructor'}
                            </span>
                            <span class="text-muted small">
                                <i class="fas fa-users me-1"></i> ${classItem.enrolled_count || 0} students
                            </span>
                        </div>
                    </div>
                    <div class="card-footer bg-transparent">
                        <div class="d-flex justify-content-between">
                            <span class="badge ${classItem.upcoming_sessions > 0 ? 'bg-primary' : 'bg-secondary'}">
                                <i class="fas fa-calendar-alt me-1"></i> ${classItem.upcoming_sessions} upcoming
                            </span>
                            <span class="badge bg-info">
                                <i class="fas fa-file-alt me-1"></i> ${classItem.materials_count} materials
                            </span>
                            <a href="class-details?id=${classItem.class_id}" class="btn btn-sm btn-outline-primary">
                                <i class="fas fa-info-circle me-1"></i> Details
                            </a>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(col);
        });
    } catch (error) {
        console.error('Error loading classes:', error);
        document.getElementById('classes-loading').classList.add('d-none');
        document.getElementById('classes-empty').classList.remove('d-none');
        document.getElementById('classes-empty').innerHTML = `
            <div class="text-danger mb-3">
                <i class="fas fa-exclamation-circle fa-2x"></i>
            </div>
            <p>Error loading classes. Please try again later.</p>
            <button class="btn btn-sm btn-outline-primary mt-2" id="retry-classes">
                <i class="fas fa-sync-alt me-1"></i> Retry
            </button>
        `;
        
        // Add retry button event listener
        document.getElementById('retry-classes')?.addEventListener('click', loadEnrolledClasses);
    }
}

/**
 * Load recent materials
 */
async function loadRecentMaterials() {
    try {
        // Show loading
        document.getElementById('materials-loading').classList.remove('d-none');
        document.getElementById('materials-container').innerHTML = '';
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
            throw new Error('Failed to load materials');
        }
        
        const materials = await response.json();
        
        // Hide loading
        document.getElementById('materials-loading').classList.add('d-none');
        
        // Check if no materials
        if (materials.length === 0) {
            document.getElementById('materials-empty').classList.remove('d-none');
            return;
        }
        
        // Get recent materials (up to 5)
        const recentMaterials = materials.slice(0, 5);
        
        // Populate materials
        const container = document.getElementById('materials-container');
        
        recentMaterials.forEach(material => {
            // Format date
            const uploadDate = new Date(material.upload_date);
            const formattedDate = uploadDate.toLocaleDateString();
            
            // Get icon based on file type
            let fileIcon = 'file-alt';
            if (material.file_type === 'pdf') fileIcon = 'file-pdf';
            else if (material.file_type === 'docx' || material.file_type === 'doc') fileIcon = 'file-word';
            else if (material.file_type === 'xlsx' || material.file_type === 'xls') fileIcon = 'file-excel';
            else if (material.file_type === 'pptx' || material.file_type === 'ppt') fileIcon = 'file-powerpoint';
            else if (material.file_type === 'zip' || material.file_type === 'rar') fileIcon = 'file-archive';
            
            const materialItem = document.createElement('div');
            materialItem.className = 'material-item';
            
            materialItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <div class="me-3">
                            <i class="fas fa-${fileIcon} fa-2x text-primary"></i>
                        </div>
                        <div>
                            <h6 class="mb-0">${material.title}</h6>
                            <small class="text-muted">${material.class_name}</small>
                            <div class="d-flex align-items-center mt-1">
                                <small class="text-muted me-3">
                                    <i class="fas fa-calendar-alt me-1"></i> ${formattedDate}
                                </small>
                                <small class="text-muted">
                                    <i class="fas fa-weight-hanging me-1"></i> ${formatFileSize(material.file_size)}
                                </small>
                            </div>
                        </div>
                    </div>
                    <div>
                        <a href="/api/student/materials/${material.material_id}/download" class="btn btn-sm btn-outline-primary" download>
                            <i class="fas fa-download"></i>
                        </a>
                    </div>
                </div>
            `;
            
            container.appendChild(materialItem);
        });
    } catch (error) {
        console.error('Error loading materials:', error);
        document.getElementById('materials-loading').classList.add('d-none');
        document.getElementById('materials-empty').classList.remove('d-none');
        document.getElementById('materials-empty').innerHTML = `
            <div class="text-danger mb-3">
                <i class="fas fa-exclamation-circle fa-2x"></i>
            </div>
            <p>Error loading materials. Please try again later.</p>
            <button class="btn btn-sm btn-outline-primary mt-2" id="retry-materials">
                <i class="fas fa-sync-alt me-1"></i> Retry
            </button>
        `;
        
        // Add retry button event listener
        document.getElementById('retry-materials')?.addEventListener('click', loadRecentMaterials);
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', logout);
    
    // Refresh buttons
    document.getElementById('refresh-active-sessions').addEventListener('click', loadActiveSessions);
    document.getElementById('refresh-upcoming-sessions').addEventListener('click', loadUpcomingSessions);
    
    // Join class button
    document.getElementById('join-class-btn').addEventListener('click', joinClass);
}

/**
 * Join an active session
 */
function joinSession(sessionId, roomId) {
    // Mark attendance first
    fetch(`/api/student/sessions/${sessionId}/attend`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    })
    .then(response => {
        // Navigate to video room regardless of attendance response
        window.location.href = `/videoroom?session=${sessionId}&room=${roomId}`;
    })
    .catch(error => {
        console.error('Error marking attendance:', error);
        // Still navigate to video room even if marking attendance fails
        window.location.href = `/videoroom?session=${sessionId}&room=${roomId}`;
    });
}

/**
 * Add a session to calendar
 */
function addToCalendar(title, startDate) {
    // Default end time: 1 hour after start
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    // Format dates for calendar
    const formatDateForCalendar = (date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
    };
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatDateForCalendar(startDate)}/${formatDateForCalendar(endDate)}&details=${encodeURIComponent('Class session from Bassac Academy')}`;
    
    // Open calendar in new tab
    window.open(calendarUrl, '_blank');
    
    // Show success notification
    showNotification('Success', 'Event added to calendar', 'success');
}

/**
 * Join a class
 */
async function joinClass() {
    const classCode = document.getElementById('class-code').value;
    const classPassword = document.getElementById('class-password').value;
    const errorElement = document.getElementById('join-class-error');
    
    // Hide previous errors
    errorElement.classList.add('d-none');
    
    // Validate form
    if (!classCode || !classPassword) {
        errorElement.textContent = 'Class code and password are required';
        errorElement.classList.remove('d-none');
        return;
    }
    
    // Show loading state
    const joinButton = document.getElementById('join-class-btn');
    const originalButtonText = joinButton.innerHTML;
    joinButton.disabled = true;
    joinButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Joining...';
    
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
        
        // Reset button
        joinButton.disabled = false;
        joinButton.innerHTML = originalButtonText;
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to join class');
        }
        
        const data = await response.json();
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('joinClassModal'));
        modal.hide();
        
        // Show success notification
        showNotification('Success', 'Successfully joined the class!', 'success');
        
        // Reset form
        document.getElementById('join-class-form').reset();
        
        // Reload dashboard data
        await Promise.all([
            loadStats(),
            loadEnrolledClasses()
        ]);
    } catch (error) {
        console.error('Error joining class:', error);
        errorElement.textContent = error.message;
        errorElement.classList.remove('d-none');
        
        // Reset button if not already reset
        joinButton.disabled = false;
        joinButton.innerHTML = originalButtonText;
    }
}

/**
 * Show notification toast
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, info, warning, danger)
 */
function showNotification(title, message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '1050';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${type} border-0`;
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    
    // Create toast content
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}</strong>: ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    // Add to container
    toastContainer.appendChild(toastEl);
    
    // Initialize and show toast
    const toast = new bootstrap.Toast(toastEl, {
        autohide: true,
        delay: 5000
    });
    toast.show();
    
    // Remove from DOM after hidden
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
        
        // Remove container if empty
        if (toastContainer.children.length === 0) {
            toastContainer.remove();
        }
    });
}

/**
 * Format file size
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

/**
 * Get time until date
 */
function getTimeUntil(date) {
    const now = new Date();
    const diff = date - now;
    
    // If date is in the past
    if (diff < 0) {
        return 'Passed';
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 0) {
        return `in ${days} day${days > 1 ? 's' : ''}`;
    } else if (hours > 0) {
        return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
        return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
}
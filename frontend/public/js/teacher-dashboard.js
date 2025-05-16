/**
 * Teacher Dashboard JavaScript
 * Handles functionality for the teacher dashboard page
 */


document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    const user = await requireAuth();
    
    // Redirect if not instructor/teacher
    if (!user || (user.role !== 'instructor' && user.role !== 'teacher' && user.role !== 'admin')) {
        window.location.href = '/login';
        return;
    }
    
    // Update user info in navbar
    document.getElementById('username-display').textContent = user.username;
    document.getElementById('teacher-name').textContent = user.username;
    
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
        
        // Load recent classes
        await loadRecentClasses();
        
        // Load classes for dropdowns
        await loadClassesForDropdowns();
    } catch (error) {
        console.error('Error initializing dashboard:', error);
    }
}

/**
 * Load statistics
 */
async function loadStats() {
    try {
        const response = await fetch('/api/teacher/stats', {
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
        document.getElementById('classes-count').textContent = stats.classesCount || 0;
        document.getElementById('students-count').textContent = stats.studentsCount || 0;
        document.getElementById('sessions-count').textContent = stats.sessionsCount || 0;
        document.getElementById('active-count').textContent = stats.activeSessionsCount || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
        // Show fallback stats (don't show error to user)
    }
}

/**
 * Load active sessions
 */
/**
 * Load active sessions from the API
 */
async function loadActiveSessions() {
    try {
        // Show loading
        document.getElementById('active-sessions-loading').classList.remove('d-none');
        document.getElementById('active-sessions-container').innerHTML = '';
        document.getElementById('active-sessions-empty').classList.add('d-none');
        
        // Get the API endpoint URL 
        const apiUrl = '/api/teacher/sessions/active';
        
        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
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
                            <p class="card-text">
                                <i class="fas fa-users me-1"></i> 
                                <span id="participants-count-${session.session_id}">${session.participants_count || 0}</span> participants
                            </p>
                            <div class="session-card-actions d-grid gap-2">
                                <button class="btn btn-primary join-session-btn" 
                                    data-id="${session.session_id}" 
                                    data-room="${session.room_id}">
                                    <i class="fas fa-video me-1"></i> Join Video Room
                                </button>
                                <button class="btn btn-outline-danger end-session-btn" 
                                    data-id="${session.session_id}">
                                    <i class="fas fa-times-circle me-1"></i> End Session
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
            
            document.querySelectorAll('.end-session-btn').forEach(btn => {
                btn.addEventListener('click', confirmEndSession);
            });
        } catch (error) {
            console.error('API request failed:', error.message);
            
            // Only show error, don't use mock data in production
            document.getElementById('active-sessions-loading').classList.add('d-none');
            document.getElementById('active-sessions-empty').classList.remove('d-none');
            document.getElementById('active-sessions-empty').innerHTML = `
                <i class="fas fa-exclamation-circle text-danger me-2"></i>
                Error loading active sessions. Please check your API endpoint.
            `;
        }
    } catch (error) {
        console.error('Error in loadActiveSessions:', error);
        document.getElementById('active-sessions-loading').classList.add('d-none');
        document.getElementById('active-sessions-empty').classList.remove('d-none');
        document.getElementById('active-sessions-empty').innerHTML = `
            <i class="fas fa-exclamation-circle fa-2x text-danger mb-3"></i>
            <p>Error loading active sessions. Please try again later.</p>
        `;
    }
}

/**
 * Load upcoming sessions from the API
 */
async function loadUpcomingSessions() {
    try {
        // Show loading
        document.getElementById('upcoming-sessions-loading').classList.remove('d-none');
        document.getElementById('upcoming-sessions-table-body').innerHTML = '';
        document.getElementById('upcoming-sessions-empty').classList.add('d-none');
        
        // Get the API endpoint URL
        const apiUrl = '/api/teacher/sessions/upcoming';
        
        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
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
                    <td><span class="badge bg-primary">Scheduled</span></td>
                    <td>
                        <button class="btn btn-sm btn-success start-session-btn" data-id="${session.session_id}">
                            <i class="fas fa-play-circle me-1"></i> Start
                        </button>
                        <button class="btn btn-sm btn-outline-danger cancel-session-btn" data-id="${session.session_id}">
                            <i class="fas fa-times-circle me-1"></i>
                        </button>
                    </td>
                `;
                
                tableBody.appendChild(row);
            });
            
            // Add event listeners
            document.querySelectorAll('.start-session-btn').forEach(btn => {
                btn.addEventListener('click', startSession);
            });
            
            document.querySelectorAll('.cancel-session-btn').forEach(btn => {
                btn.addEventListener('click', confirmCancelSession);
            });
        } catch (error) {
            console.error('API request failed:', error.message);
            
            // Only show error, don't use mock data in production
            document.getElementById('upcoming-sessions-loading').classList.add('d-none');
            document.getElementById('upcoming-sessions-empty').classList.remove('d-none');
            document.getElementById('upcoming-sessions-empty').innerHTML = `
                <i class="fas fa-exclamation-circle text-danger me-2"></i>
                Error loading upcoming sessions. Please check your API endpoint.
            `;
        }
    } catch (error) {
        console.error('Error in loadUpcomingSessions:', error);
        document.getElementById('upcoming-sessions-loading').classList.add('d-none');
        document.getElementById('upcoming-sessions-empty').classList.remove('d-none');
        document.getElementById('upcoming-sessions-empty').innerHTML = `
            <i class="fas fa-exclamation-circle text-danger me-2"></i>
            Error loading upcoming sessions. Please try again later.
        `;
    }
}
/**
 * Load recent classes
 */
async function loadRecentClasses() {
    try {
        // Show loading
        document.getElementById('recent-classes-loading').classList.remove('d-none');
        document.getElementById('recent-classes-container').innerHTML = '';
        document.getElementById('recent-classes-empty').classList.add('d-none');
        
        const response = await fetch('/api/classes/instructor', {
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
        document.getElementById('recent-classes-loading').classList.add('d-none');
        
        // Check if no classes
        if (classes.length === 0) {
            document.getElementById('recent-classes-empty').classList.remove('d-none');
            return;
        }
        
        // Get only the most recent classes (up to 6)
        const recentClasses = classes.slice(0, 6);
        
        // Populate recent classes
        const container = document.getElementById('recent-classes-container');
        
        recentClasses.forEach(classItem => {
            const col = document.createElement('div');
            col.className = 'col-md-6 col-lg-4';
            
            col.innerHTML = `
                <div class="card h-100 class-card">
                    <div class="card-body">
                        <h5 class="card-title">${classItem.class_name}</h5>
                        <p class="card-text small">${classItem.description || 'No description provided'}</p>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <span class="badge ${classItem.is_active ? 'bg-success' : 'bg-secondary'}">
                                ${classItem.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <span class="text-muted small">
                                <i class="fas fa-users me-1"></i> ${classItem.enrolled_count || 0} students
                            </span>
                        </div>
                    </div>
                    <div class="card-footer bg-transparent">
                        <div class="d-flex justify-content-between">
                            <a href="class-details?id=${classItem.class_id}" class="btn btn-sm btn-outline-primary">
                                <i class="fas fa-info-circle me-1"></i> Details
                            </a>
                            <button class="btn btn-sm btn-success create-session-for-class-btn" 
                                data-id="${classItem.class_id}" 
                                data-name="${classItem.class_name}">
                                <i class="fas fa-video me-1"></i> New Session
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(col);
        });
        
        // Add event listeners for new session buttons
        document.querySelectorAll('.create-session-for-class-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const classId = this.getAttribute('data-id');
                const className = this.getAttribute('data-name');
                
                // Populate session modal with class info
                const classSelect = document.getElementById('class-select');
                
                // Select the correct option
                for (let i = 0; i < classSelect.options.length; i++) {
                    if (classSelect.options[i].value == classId) {
                        classSelect.selectedIndex = i;
                        break;
                    }
                }
                
                // Set default session name based on class
                document.getElementById('session-name').value = `${className} - Session`;
                
                // Set default times (now + 1 hour)
                const now = new Date();
                const later = new Date(now.getTime() + 60 * 60 * 1000);
                
                // Format for datetime-local input
                const formatDate = (date) => {
                    return date.toISOString().slice(0, 16);
                };
                
                document.getElementById('scheduled-start').value = formatDate(now);
                document.getElementById('scheduled-end').value = formatDate(later);
                
                // Show modal
                const modal = new bootstrap.Modal(document.getElementById('createSessionModal'));
                modal.show();
            });
        });
    } catch (error) {
        console.error('Error loading recent classes:', error);
        document.getElementById('recent-classes-loading').classList.add('d-none');
        document.getElementById('recent-classes-empty').classList.remove('d-none');
        document.getElementById('recent-classes-empty').innerHTML = `
            <i class="fas fa-exclamation-circle text-danger me-2"></i>
            Error loading classes. Please try again later.
        `;
    }
}

/**
 * Load classes for select dropdowns
 */
async function loadClassesForDropdowns() {
    try {
        const response = await fetch('/api/classes/instructor', {
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
        
        // Populate class select dropdowns
        const classSelect = document.getElementById('class-select');
        const materialClassSelect = document.getElementById('material-class-select');
        
        // Clear existing options
        classSelect.innerHTML = '';
        materialClassSelect.innerHTML = '';
        
        // Add options
        classes.forEach(classItem => {
            // For session modal
            const option1 = document.createElement('option');
            option1.value = classItem.class_id;
            option1.textContent = classItem.class_name;
            classSelect.appendChild(option1);
            
            // For material modal
            const option2 = document.createElement('option');
            option2.value = classItem.class_id;
            option2.textContent = classItem.class_name;
            materialClassSelect.appendChild(option2);
        });
    } catch (error) {
        console.error('Error loading classes for dropdowns:', error);
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
    
    // Create class button
    document.getElementById('create-class-btn').addEventListener('click', createClass);
    
    // Create session button
    document.getElementById('create-session-btn').addEventListener('click', createSession);
    
    // Upload material button
    document.getElementById('upload-material-btn').addEventListener('click', uploadMaterial);
}

/**
 * Create a new class
 */
async function createClass() {
    const className = document.getElementById('class-name').value;
    const description = document.getElementById('class-description').value;
    const capacity = document.getElementById('class-capacity').value;
    const password = document.getElementById('class-password').value;
    const errorElement = document.getElementById('create-class-error');
    
    // Hide previous errors
    errorElement.classList.add('d-none');
    
    // Validate form
    if (!className || !password) {
        errorElement.textContent = 'Class name and password are required';
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
        
        // Show success message (you can add a toast notification here)
        alert('Class created successfully!\nClass Code: ' + data.classCode);
        
        // Reset form
        document.getElementById('create-class-form').reset();
        
        // Reload dashboard data
        await loadStats();
        await loadRecentClasses();
        await loadClassesForDropdowns();
    } catch (error) {
        console.error('Error creating class:', error);
        errorElement.textContent = error.message;
        errorElement.classList.remove('d-none');
    }
}

/**
 * Create a new session
 */
async function createSession() {
    const classId = document.getElementById('class-select').value;
    const sessionName = document.getElementById('session-name').value;
    const description = document.getElementById('session-description').value;
    const scheduledStart = document.getElementById('scheduled-start').value;
    const scheduledEnd = document.getElementById('scheduled-end').value;
    const errorElement = document.getElementById('create-session-error');
    
    // Hide previous errors
    errorElement.classList.add('d-none');
    
    // Validate form
    if (!classId || !sessionName || !scheduledStart || !scheduledEnd) {
        errorElement.textContent = 'All fields except description are required';
        errorElement.classList.remove('d-none');
        return;
    }
    
    try {
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                classId,
                sessionName,
                description,
                scheduledStart,
                scheduledEnd
            }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to create session');
        }
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('createSessionModal'));
        modal.hide();
        
        // Show success message
        alert('Session created successfully!');
        
        // Reset form
        document.getElementById('create-session-form').reset();
        
        // Reload dashboard data
        await loadStats();
        await loadUpcomingSessions();
    } catch (error) {
        console.error('Error creating session:', error);
        errorElement.textContent = error.message;
        errorElement.classList.remove('d-none');
    }
}

/**
 * Upload learning material
 */
async function uploadMaterial() {
    const classId = document.getElementById('material-class-select').value;
    const title = document.getElementById('material-title').value;
    const description = document.getElementById('material-description').value;
    const fileInput = document.getElementById('material-file');
    const errorElement = document.getElementById('upload-material-error');
    
    // Hide previous errors
    errorElement.classList.add('d-none');
    
    // Validate form
    if (!classId || !title || !fileInput.files[0]) {
        errorElement.textContent = 'Class, title, and file are required';
        errorElement.classList.remove('d-none');
        return;
    }
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('classId', classId);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('file', fileInput.files[0]);
        
        const response = await fetch('/api/materials', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData,
            credentials: 'include'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to upload material');
        }
        
        // Hide modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('uploadMaterialModal'));
        modal.hide();
        
        // Show success message
        alert('Material uploaded successfully!');
        
        // Reset form
        document.getElementById('upload-material-form').reset();
    } catch (error) {
        console.error('Error uploading material:', error);
        errorElement.textContent = error.message;
        errorElement.classList.remove('d-none');
    }
}

/**
 * Start a session
 */
async function startSession(event) {
    const sessionId = event.currentTarget.getAttribute('data-id');
    
    if (!confirm('Are you sure you want to start this session now?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/sessions/${sessionId}/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to start session');
        }
        
        const data = await response.json();
        
        // Ask if user wants to join the video room now
        if (confirm('Session started successfully! Do you want to join the video room now?')) {
            joinVideoRoom(sessionId, data.roomId);
        } else {
            // Reload dashboard data
            await loadStats();
            await loadActiveSessions();
            await loadUpcomingSessions();
        }
    } catch (error) {
        console.error('Error starting session:', error);
        alert('Failed to start session: ' + error.message);
    }
}

/**
 * Join an active session
 */
function joinSession(event) {
    const sessionId = event.currentTarget.getAttribute('data-id');
    const roomId = event.currentTarget.getAttribute('data-room');
    
    joinVideoRoom(sessionId, roomId);
}

/**
 * Join a video room
 */
function joinVideoRoom(sessionId, roomId) {
    window.location.href = `/videoroom?session=${sessionId}&room=${roomId}`;
}

/**
 * Confirm ending a session
 */
function confirmEndSession(event) {
    const sessionId = event.currentTarget.getAttribute('data-id');
    
    if (confirm('Are you sure you want to end this session? This will disconnect all participants.')) {
        endSession(sessionId);
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
            const data = await response.json();
            throw new Error(data.message || 'Failed to end session');
        }
        
        // Show success message
        alert('Session ended successfully');
        
        // Reload dashboard data
        await loadStats();
        await loadActiveSessions();
    } catch (error) {
        console.error('Error ending session:', error);
        alert('Failed to end session: ' + error.message);
    }
}

/**
 * Confirm cancelling a session
 */
function confirmCancelSession(event) {
    const sessionId = event.currentTarget.getAttribute('data-id');
    
    if (confirm('Are you sure you want to cancel this session?')) {
        cancelSession(sessionId);
    }
}

/**
 * Cancel a scheduled session
 */
async function cancelSession(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}/cancel`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to cancel session');
        }
        
        // Show success message
        alert('Session cancelled successfully');
        
        // Reload dashboard data
        await loadStats();
        await loadUpcomingSessions();
    } catch (error) {
        console.error('Error cancelling session:', error);
        alert('Failed to cancel session: ' + error.message);
    }
}
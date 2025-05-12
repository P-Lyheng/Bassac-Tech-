// Global variables
let localStream;
let screenStream;
let isScreenSharing = false;
let currentUser;
let isAudioEnabled = true;
let isVideoEnabled = true;
let isChatOpen = false;

// Force development mode since Socket.IO is not available
const DEVELOPMENT_MODE = true;
const token = getCookie('token');

// Initialize
async function initialize() {
  try {
    // Safe element access with error handling
    const videoGrid = document.getElementById("video-grid");
    const roomNameDisplay =
      document.getElementById("room-name") ||
      document.getElementById("session-title");
    const sessionStatus = document.getElementById("session-status");

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get("room");
    const sessionId = urlParams.get("session");

    if (!roomId || !sessionId) {
      displayError(
        "Missing room or session ID in URL. Please return to the dashboard and try again."
      );
      return;
    }

    // Check if critical elements exist
    if (!videoGrid) {
      displayError(
        "Critical UI elements not found. The page may be missing required HTML elements."
      );
      return;
    }

    // Development mode notice
    showDevelopmentModeNotice();

  
    // Mock user data in development mode
  
    if (usernameDisplay) usernameDisplay.textContent = userData.username;
   
    // Update UI with session information
    if (roomNameDisplay) {
      roomNameDisplay.textContent = `Video Room - Session #${sessionId} (Room: ${roomId})`;
    }

    if (sessionStatus) {
      sessionStatus.innerHTML =
        '<span class="badge bg-warning">Development Mode</span>';
    }

    // Update user display
    const usernameDisplay =
      document.getElementById("username-display") ||
      document.getElementById("user-name");
    if (usernameDisplay) {
      usernameDisplay.textContent = currentUser.username || "User";
    }

    // Setup local media if permissions are granted
    await setupLocalMediaWithFallback();

    // Create mock participants for development
    createMockParticipants();

    // Set up event listeners for UI controls
    setupEventListenersWithFallback();

    console.log("Video room initialized successfully in development mode");
  } catch (error) {
    console.error("Initialization error:", error);
    displayError(`Error initializing video room: ${error.message}`);
  }
}

// Show development mode notice
function showDevelopmentModeNotice() {
  const container = document.querySelector(".container");
  if (!container) return;

  const notice = document.createElement("div");
  notice.className = "alert alert-info alert-dismissible fade show";
  notice.innerHTML = `
        <strong>Development Mode</strong>: Running without Socket.IO. Real-time communication is simulated.
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

  container.prepend(notice);
}

// Setup local media with fallback
async function setupLocalMediaWithFallback() {
  const videoGrid = document.getElementById("video-grid");

  if (!videoGrid) {
    console.error("Video grid element not found");
    return;
  }

  try {
    // Request user media
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    // Add local video to grid
    addVideoStream("local", localStream, currentUser.username, true);
  } catch (error) {
    console.error("Media error:", error);

    // Create fallback content for development
    const fallbackDiv = document.createElement("div");
    fallbackDiv.className = "col-md-6";
    fallbackDiv.innerHTML = `
            <div class="video-card">
                <div class="placeholder-video bg-dark d-flex align-items-center justify-content-center" style="height: 240px; border-radius: 8px;">
                    <div class="text-center text-light">
                        <i class="fas fa-video-slash fa-3x mb-2"></i>
                        <p>Camera access denied or unavailable.<br>Check permissions and try again.</p>
                    </div>
                </div>
                <div class="video-controls mt-2 d-flex justify-content-center">
                    <button class="btn btn-sm btn-light mx-1 disabled">
                        <i class="fas fa-microphone-slash"></i>
                    </button>
                    <button class="btn btn-sm btn-light mx-1 disabled">
                        <i class="fas fa-video-slash"></i>
                    </button>
                </div>
            </div>
        `;

    videoGrid.appendChild(fallbackDiv);

    // Try audio only as fallback
    try {
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      isVideoEnabled = false;
    } catch (audioError) {
      console.error("Audio fallback error:", audioError);
      localStream = new MediaStream(); // Empty stream as last resort
      isAudioEnabled = false;
      isVideoEnabled = false;
    }
  }

  // Update UI to reflect media state
  updateUIForMediaState();
}

// Create mock participants for development/testing
function createMockParticipants() {
  const videoGrid = document.getElementById("video-grid");

  if (!videoGrid) return;

  // Generate a few mock participants
  const mockParticipants = [
    {
      id: "student1",
      name: "Student 1",
      hasAudio: true,
      hasVideo: true,
    },
    {
      id: "student2",
      name: "Student 2",
      hasAudio: false,
      hasVideo: true,
    },
  ];

  // Add mock participants to grid
  mockParticipants.forEach((participant) => {
    const mockDiv = document.createElement("div");
    mockDiv.className = "col-md-6 mb-3";
    mockDiv.innerHTML = `
            <div class="card h-100">
                <div class="card-body p-0 position-relative">
                    <div class="bg-dark text-light d-flex align-items-center justify-content-center" 
                         style="height: 240px; border-radius: 8px;">
                        <div class="text-center">
                            <i class="fas fa-user-circle fa-4x mb-3"></i>
                            <h5>${participant.name}</h5>
                            <p class="small text-muted">Development Mode</p>
                        </div>
                    </div>
                    <div class="position-absolute bottom-0 start-0 p-2 text-white">
                        <div class="d-flex">
                            <span id="mic-${participant.id}" class="me-2">
                                <i class="fas fa-${
                                  participant.hasAudio
                                    ? "microphone"
                                    : "microphone-slash"
                                }"></i>
                            </span>
                            <span id="cam-${participant.id}">
                                <i class="fas fa-${
                                  participant.hasVideo ? "video" : "video-slash"
                                }"></i>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;

    videoGrid.appendChild(mockDiv);
  });

  // Add simulated interaction for development demonstration
  setTimeout(() => {
    simulateParticipantAction("student1", "muted");
  }, 10000);

  setTimeout(() => {
    simulateParticipantAction("student2", "video-on");
  }, 15000);
}

// Simulate a participant action (for development)
function simulateParticipantAction(participantId, action) {
  if (!DEVELOPMENT_MODE) return;

  const actionMessages = {
    muted: "Student 1 muted their microphone",
    unmuted: "Student 1 unmuted their microphone",
    "video-off": "Student 2 turned off their camera",
    "video-on": "Student 2 turned on their camera",
    message: "Student 1 sent a message",
  };

  // Update the participant's UI
  if (action === "muted") {
    const micIndicator = document.getElementById(`mic-${participantId}`);
    if (micIndicator) {
      micIndicator.innerHTML = '<i class="fas fa-microphone-slash"></i>';
    }
  } else if (action === "video-on") {
    const camIndicator = document.getElementById(`cam-${participantId}`);
    if (camIndicator) {
      camIndicator.innerHTML = '<i class="fas fa-video"></i>';
    }
  }

  // Show a notification
  const message = actionMessages[action];
  if (message) {
    showNotification(message);
  }

  // Add a simulated message
  if (action === "message") {
    const mockMessage = {
      senderName: "Student 1",
      message: "Hello, can everyone hear me?",
      timestamp: new Date(),
    };
    addMessageToChat(mockMessage);
  }
}

// Show notification
function showNotification(message) {
  const container = document.querySelector(".container");
  if (!container) return;

  const notification = document.createElement("div");
  notification.className = "position-fixed bottom-0 end-0 p-3";
  notification.style.zIndex = "1050";

  notification.innerHTML = `
        <div class="toast show" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <i class="fas fa-info-circle me-2 text-primary"></i>
                <strong class="me-auto">Notification</strong>
                <small>Just now</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;

  container.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Add video stream to grid
function addVideoStream(userId, stream, username, isLocal) {
  const videoGrid = document.getElementById("video-grid");

  if (!videoGrid) {
    console.error("Video grid element not found");
    return;
  }

  // Check if video already exists
  const existingVideo = document.getElementById(`video-${userId}`);
  if (existingVideo) {
    existingVideo.srcObject = stream;
    return;
  }

  // Create video wrapper
  const videoWrapper = document.createElement("div");
  videoWrapper.className = "col-md-6 mb-3";

  // Create video card with better styling
  const videoCard = document.createElement("div");
  videoCard.className = "card h-100";

  // Create card body
  const cardBody = document.createElement("div");
  cardBody.className = "card-body p-0 position-relative";

  // Create video element
  const video = document.createElement("video");
  video.id = `video-${userId}`;
  video.className = "w-100 h-100 bg-dark";
  video.style.borderRadius = "8px";
  video.style.objectFit = "cover";
  video.srcObject = stream;
  video.autoplay = true;
  video.playsInline = true;
  if (isLocal) video.muted = true;

  // Create video overlay with user info
  const overlay = document.createElement("div");
  overlay.className = "position-absolute bottom-0 start-0 p-2 text-white";
  overlay.innerHTML = `
        <div>${username}${isLocal ? " (You)" : ""}</div>
        <div class="d-flex">
            <span id="mic-${userId}" class="me-2">${
    isAudioEnabled
      ? '<i class="fas fa-microphone"></i>'
      : '<i class="fas fa-microphone-slash"></i>'
  }</span>
            <span id="cam-${userId}">${
    isVideoEnabled
      ? '<i class="fas fa-video"></i>'
      : '<i class="fas fa-video-slash"></i>'
  }</span>
        </div>
    `;

  // Assemble video card
  cardBody.appendChild(video);
  cardBody.appendChild(overlay);
  videoCard.appendChild(cardBody);

  // Add controls for local video only
  if (isLocal) {
    const cardFooter = document.createElement("div");
    cardFooter.className = "card-footer bg-light";
    cardFooter.innerHTML = `
            <div class="d-flex justify-content-center">
                <button id="toggle-mic" class="btn btn-sm ${
                  isAudioEnabled ? "btn-light" : "btn-danger"
                } mx-1">
                    <i class="fas fa-${
                      isAudioEnabled ? "microphone" : "microphone-slash"
                    }"></i>
                </button>
                <button id="toggle-camera" class="btn btn-sm ${
                  isVideoEnabled ? "btn-light" : "btn-danger"
                } mx-1">
                    <i class="fas fa-${
                      isVideoEnabled ? "video" : "video-slash"
                    }"></i>
                </button>
                <button id="toggle-screen" class="btn btn-sm btn-light mx-1">
                    <i class="fas fa-desktop"></i>
                </button>
            </div>
        `;
    videoCard.appendChild(cardFooter);
  }

  videoWrapper.appendChild(videoCard);

  // Add to grid
  videoGrid.appendChild(videoWrapper);

  // Handle video play event
  video.addEventListener("loadedmetadata", () => {
    video.play().catch((err) => console.error("Error playing video:", err));
  });

  // If local video, set up control buttons again
  if (isLocal) {
    setupVideoControls();
  }
}

// Set up video control buttons
function setupVideoControls() {
  const toggleMicBtn = document.getElementById("toggle-mic");
  const toggleCameraBtn = document.getElementById("toggle-camera");
  const toggleScreenBtn = document.getElementById("toggle-screen");

  if (toggleMicBtn) {
    toggleMicBtn.addEventListener("click", toggleAudio);
  }

  if (toggleCameraBtn) {
    toggleCameraBtn.addEventListener("click", toggleVideo);
  }

  if (toggleScreenBtn) {
    toggleScreenBtn.addEventListener("click", toggleScreenShare);
  }
}

// Set up event listeners with fallback
function setupEventListenersWithFallback() {
  // Setup video controls
  setupVideoControls();

  // Toggle chat button
  const toggleChatBtn = document.getElementById("toggle-chat");
  if (toggleChatBtn) {
    toggleChatBtn.addEventListener("click", toggleChat);
  }

  // Close chat button
  const closeChat = document.getElementById("close-chat");
  if (closeChat) {
    closeChat.addEventListener("click", toggleChat);
  }

  // Send message button
  const sendMessageBtn = document.getElementById("send-message");
  const messageInput =
    document.getElementById("message-input") ||
    document.getElementById("chat-input");
  if (sendMessageBtn && messageInput) {
    sendMessageBtn.addEventListener("click", sendMessage);
    messageInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });
  }

  // Leave room button
  const leaveBtn =
    document.getElementById("leave-room-btn") ||
    document.getElementById("leave-btn");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", confirmLeaveRoom);
  }

  // Chat form
  const chatForm = document.getElementById("chat-form");
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });
  }

  // Add event for development mode - simulate student message
  setTimeout(() => {
    simulateParticipantAction("student1", "message");
  }, 5000);
}

// Toggle audio
function toggleAudio() {
  if (!localStream) return;

  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;

  isAudioEnabled = !isAudioEnabled;
  audioTrack.enabled = isAudioEnabled;

  // Update UI
  updateUIForMediaState();

  // Show notification in development mode
  if (DEVELOPMENT_MODE) {
    showNotification(
      `You ${isAudioEnabled ? "unmuted" : "muted"} your microphone`
    );
  }
}

// Toggle video
function toggleVideo() {
  if (!localStream) return;

  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;

  isVideoEnabled = !isVideoEnabled;
  videoTrack.enabled = isVideoEnabled;

  // Update UI
  updateUIForMediaState();

  // Show notification in development mode
  if (DEVELOPMENT_MODE) {
    showNotification(`You turned ${isVideoEnabled ? "on" : "off"} your camera`);
  }
}

// Toggle screen sharing
async function toggleScreenShare() {
  try {
    if (!isScreenSharing) {
      // Start screen sharing
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });

      // Update UI
      isScreenSharing = true;
      const toggleScreenBtn = document.getElementById("toggle-screen");
      if (toggleScreenBtn) {
        toggleScreenBtn.innerHTML = '<i class="fas fa-desktop"></i>';
        toggleScreenBtn.classList.add("btn-warning");
        toggleScreenBtn.classList.remove("btn-light");
      }

      // For development, just replace the local video
      const localVideo = document.getElementById("video-local");
      if (localVideo) {
        localVideo.srcObject = screenStream;
      }

      // Handle end of screen sharing
      screenStream.getVideoTracks()[0].onended = () => {
        toggleScreenShare();
      };

      // Show notification in development mode
      if (DEVELOPMENT_MODE) {
        showNotification("You started sharing your screen");
      }
    } else {
      // Stop screen sharing
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }

      // Update UI
      isScreenSharing = false;
      const toggleScreenBtn = document.getElementById("toggle-screen");
      if (toggleScreenBtn) {
        toggleScreenBtn.innerHTML = '<i class="fas fa-desktop"></i>';
        toggleScreenBtn.classList.remove("btn-warning");
        toggleScreenBtn.classList.add("btn-light");
      }

      // Replace with local video stream
      const localVideo = document.getElementById("video-local");
      if (localVideo && localStream) {
        localVideo.srcObject = localStream;
      }

      // Show notification in development mode
      if (DEVELOPMENT_MODE) {
        showNotification("You stopped sharing your screen");
      }
    }
  } catch (error) {
    console.error("Screen sharing error:", error);
    alert("Screen sharing failed: " + error.message);
  }
}

// Toggle chat
function toggleChat() {
  const chatPanel = document.getElementById("chat-panel");
  if (!chatPanel) return;

  isChatOpen = !isChatOpen;
  chatPanel.classList.toggle("open", isChatOpen);

  const toggleChatBtn = document.getElementById("toggle-chat");
  if (toggleChatBtn) {
    toggleChatBtn.classList.toggle("active", isChatOpen);
  }
}

// Add message to chat
function addMessageToChat(data) {
  const messagesContainer =
    document.getElementById("messages") ||
    document.getElementById("chat-messages");
  if (!messagesContainer) return;

  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${
    data.senderName.includes("You") ? "own-message" : ""
  }`;

  const timestamp = data.timestamp
    ? new Date(data.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender">${data.senderName}</span>
            <span class="timestamp">${timestamp}</span>
        </div>
        <div class="message-content">${data.message}</div>
    `;

  messagesContainer.appendChild(messageDiv);

  // Auto-scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Show chat panel if it's not already open
  if (!isChatOpen) {
    toggleChat();
  }
}

// Send message
function sendMessage() {
  const messageInput =
    document.getElementById("message-input") ||
    document.getElementById("chat-input");
  if (!messageInput) return;

  const message = messageInput.value.trim();
  if (!message) return;

  // Create message data
  const messageData = {
    senderName: currentUser.username + " (You)",
    message: message,
    timestamp: new Date(),
  };

  // Add to chat
  addMessageToChat(messageData);

  // Clear input
  messageInput.value = "";

  // In development mode, simulate a response
  if (DEVELOPMENT_MODE) {
    setTimeout(() => {
      const responses = [
        "I can hear you clearly, thanks!",
        "Could you explain that again?",
        "That makes sense, I'll try it.",
        "When is the assignment due?",
        "Thanks for the explanation!",
      ];

      const randomResponse =
        responses[Math.floor(Math.random() * responses.length)];

      addMessageToChat({
        senderName: "Student 1",
        message: randomResponse,
        timestamp: new Date(),
      });
    }, 2000 + Math.random() * 3000);
  }
}

// Update UI for media state
function updateUIForMediaState() {
  // Update audio button
  const toggleMicBtn = document.getElementById("toggle-mic");
  if (toggleMicBtn) {
    toggleMicBtn.innerHTML = `<i class="fas fa-${
      isAudioEnabled ? "microphone" : "microphone-slash"
    }"></i>`;
    toggleMicBtn.classList.remove("btn-light", "btn-danger");
    toggleMicBtn.classList.add(isAudioEnabled ? "btn-light" : "btn-danger");
  }

  // Update video button
  const toggleVideoBtn = document.getElementById("toggle-camera");
  if (toggleVideoBtn) {
    toggleVideoBtn.innerHTML = `<i class="fas fa-${
      isVideoEnabled ? "video" : "video-slash"
    }"></i>`;
    toggleVideoBtn.classList.remove("btn-light", "btn-danger");
    toggleVideoBtn.classList.add(isVideoEnabled ? "btn-light" : "btn-danger");
  }

  // Update local indicators
  const micIndicator = document.getElementById("mic-local");
  if (micIndicator) {
    micIndicator.innerHTML = `<i class="fas fa-${
      isAudioEnabled ? "microphone" : "microphone-slash"
    }"></i>`;
  }

  const camIndicator = document.getElementById("cam-local");
  if (camIndicator) {
    camIndicator.innerHTML = `<i class="fas fa-${
      isVideoEnabled ? "video" : "video-slash"
    }"></i>`;
  }
}

// Confirm leaving room
function confirmLeaveRoom() {
  if (confirm("Are you sure you want to leave this video room?")) {
    leaveRoom();
  }
}

// Leave room
function leaveRoom() {
  // Stop all media
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }

  if (screenStream) {
    screenStream.getTracks().forEach((track) => track.stop());
  }

  // Redirect to dashboard
  window.location.href = "teacher-dashboard.html";
}

// Display error message
function displayError(message) {
  console.error(message);

  // Create error alert
  const errorDiv = document.createElement("div");
  errorDiv.className = "alert alert-danger mt-4";
  errorDiv.innerHTML = `
        <h4 class="alert-heading">Error</h4>
        <p>${message}</p>
        <hr>
        <p class="mb-0">
            <a href="teacher-dashboard.html" class="btn btn-outline-danger btn-sm">
                <i class="fas fa-arrow-left"></i> Return to Dashboard
            </a>
        </p>
    `;

  // Find a suitable container
  const container = document.querySelector(".container");
  if (container) {
    // Clear container
    container.innerHTML = "";
    container.appendChild(errorDiv);
  } else {
    // Fallback to body
    document.body.insertBefore(errorDiv, document.body.firstChild);
  }
}

// Helper function to get cookie
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

// Start the application
document.addEventListener("DOMContentLoaded", initialize);

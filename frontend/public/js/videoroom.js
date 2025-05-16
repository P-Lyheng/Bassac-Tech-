// Global variables

let socket;
let localStream;
let screenStream;
let isScreenSharing = false;
let currentUser;
let isAudioEnabled = true;
let isVideoEnabled = true;
let isChatOpen = false;
let peerConnections = {}; // Store RTCPeerConnection objects
let remoteStreams = {}; // Store remote streams
function gettoken() {
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
}
const token = gettoken()

const themeCookie = getCookie('theme');
console.log('Token from cookie:', token);
console.log('Theme from cookie:', themeCookie);
// Initialize
async function initialize() {
  try {
    // Safe element access with error handling
    const videoGrid = document.getElementById("video-grid");
    const roomNameDisplay =
      document.getElementById("room-name") ||
      document.getElementById("session-title");
    const sessionStatus = document.getElementById("session-status");
    
    // Check if critical elements exist
    if (!videoGrid) {
      displayError(
        "Critical UI elements not found. The page may be missing required HTML elements."
      );
      return;
    }

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

    // Get user information from token
    try {
      // Simple JWT decoding to get user info (not for security, just to display user info)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      currentUser = JSON.parse(window.atob(base64));
    } catch (e) {
      console.error("Error parsing token:", e);
      currentUser = { username: "User" };
    }

    // Update user display
    const usernameDisplay = document.getElementById("username-display");
    if (usernameDisplay) {
      usernameDisplay.textContent = currentUser.username || "User";
    }

    // Update UI with session information
    if (roomNameDisplay) {
      roomNameDisplay.textContent = `Video Room - Session #${sessionId} (Room: ${roomId})`;
    }

    if (sessionStatus) {
      sessionStatus.innerHTML = '<span class="badge bg-warning">Connecting...</span>';
    }

    // Setup local media
    await setupLocalMedia();

    // Connect to Socket.IO server
    await connectToSocketServer(token, roomId);

    // Set up event listeners for UI controls
    setupEventListeners();

    console.log("Video room initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
    displayError(`Error initializing video room: ${error.message}`);
  }
}

// Connect to Socket.IO server
async function connectToSocketServer(token, roomId) {
  try {
    // Initialize Socket.IO connection with auth token
    socket = io('/', {
      auth: {
        token: token
      }
    });

    // Handle connection events
    socket.on('connect', () => {
      console.log('Connected to signaling server');
      
      const sessionStatus = document.getElementById("session-status");
      if (sessionStatus) {
        sessionStatus.innerHTML = '<span class="badge bg-success">Connected</span>';
      }
      
      // Join the room
      socket.emit('join-room', roomId, (response) => {
        if (response.success) {
          console.log('Successfully joined room', response);
          
          // Add existing users
          if (response.users && response.users.length > 0) {
            response.users.forEach(user => {
              if (user.userId !== currentUser.id) {
                console.log('Creating peer connection for existing user:', user);
                createPeerConnection(user.socketId, user.userId, user.username, false);
              }
            });
          }
        } else {
          displayError(`Failed to join room: ${response.error}`);
        }
      });
    });

    // Handle connection error
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      displayError(`Failed to connect to server: ${error.message}`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log('Disconnected from signaling server:', reason);
      const sessionStatus = document.getElementById("session-status");
      if (sessionStatus) {
        sessionStatus.innerHTML = '<span class="badge bg-danger">Disconnected</span>';
      }
    });

    // Handle new user joining
    socket.on('user-joined', (user) => {
      console.log('User joined:', user);
      // Create a new peer connection for the joined user
      createPeerConnection(user.socketId, user.userId, user.username, true);
    });

    // Handle user leaving
    socket.on('user-left', (user) => {
      console.log('User left:', user);
      
      // Close and clean up the peer connection
      if (peerConnections[user.socketId]) {
        peerConnections[user.socketId].close();
        delete peerConnections[user.socketId];
      }
      
      // Remove the video element
      const videoElement = document.getElementById(`video-${user.socketId}`);
      if (videoElement) {
        const parentCol = videoElement.closest('.col-md-6');
        if (parentCol) {
          parentCol.remove();
        }
      }
      
      showNotification(`${user.username || 'A user'} has left the room`);
    });

    // Handle WebRTC signaling events
    socket.on('signal:offer', async (data) => {
      console.log('Received offer from:', data.sourceId);
      
      try {
        // Make sure we have a peer connection for this user
        if (!peerConnections[data.sourceId]) {
          createPeerConnection(data.sourceId, data.userId, 'Remote User', false);
        }
        
        const peerConnection = peerConnections[data.sourceId];
        
        // Set the remote description
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        
        // Create and send answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('signal:answer', {
          targetId: data.sourceId,
          sdp: answer
        });
      } catch (error) {
        console.error('Error handling offer:', error);
      }
    });

    socket.on('signal:answer', async (data) => {
      console.log('Received answer from:', data.sourceId);
      
      try {
        const peerConnection = peerConnections[data.sourceId];
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    socket.on('signal:ice-candidate', async (data) => {
      console.log('Received ICE candidate from:', data.sourceId);
      
      try {
        const peerConnection = peerConnections[data.sourceId];
        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });

    // Handle media updates
    socket.on('user-media-update', (data) => {
      console.log('User media update:', data);
      
      // Update the UI to reflect the user's media state
      const micIndicator = document.getElementById(`mic-${data.socketId}`);
      if (micIndicator) {
        micIndicator.innerHTML = `<i class="fas fa-${data.audioEnabled ? 'microphone' : 'microphone-slash'}"></i>`;
      }
      
      const camIndicator = document.getElementById(`cam-${data.socketId}`);
      if (camIndicator) {
        camIndicator.innerHTML = `<i class="fas fa-${data.videoEnabled ? 'video' : 'video-slash'}"></i>`;
      }
    });

    // Handle hand raising
    socket.on('user-hand-update', (data) => {
      console.log('User hand update:', data);
      
      // Update UI to show hand raised status
      const videoElement = document.getElementById(`video-${data.socketId}`);
      if (videoElement) {
        const videoCard = videoElement.closest('.card');
        if (videoCard) {
          if (data.handRaised) {
            // Add hand raised indicator
            if (!document.getElementById(`hand-${data.socketId}`)) {
              const handIndicator = document.createElement('div');
              handIndicator.id = `hand-${data.socketId}`;
              handIndicator.className = 'position-absolute top-0 end-0 p-2';
              handIndicator.innerHTML = '<span class="badge bg-warning"><i class="fas fa-hand-paper"></i> Hand Raised</span>';
              videoCard.appendChild(handIndicator);
            }
          } else {
            // Remove hand raised indicator
            const handIndicator = document.getElementById(`hand-${data.socketId}`);
            if (handIndicator) {
              handIndicator.remove();
            }
          }
        }
      }
    });

    // Handle chat messages
    socket.on('chat-message', (data) => {
      console.log('Received chat message:', data);
      addMessageToChat(data);
    });

  } catch (error) {
    console.error("Socket connection error:", error);
    displayError(`Failed to connect to video server: ${error.message}`);
  }
}

// Create a new peer connection
function createPeerConnection(socketId, userId, username, isInitiator) {
  try {
    console.log(`Creating ${isInitiator ? 'initiator' : 'receiver'} peer connection for:`, socketId);
    
    // Configure ICE servers (STUN/TURN)
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add your TURN servers here if needed for NAT traversal
        // { urls: 'turn:your-turn-server.com', username: 'username', credential: 'credential' }
      ]
    };
    
    // Create the peer connection
    const peerConnection = new RTCPeerConnection(configuration);
    peerConnections[socketId] = peerConnection;
    
    // Add local tracks to the peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', socketId);
        socket.emit('signal:ice-candidate', {
          targetId: socketId,
          candidate: event.candidate
        });
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = (event) => {
      console.log(`Connection state changed to ${peerConnection.connectionState} for peer ${socketId}`);
      if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected' || peerConnection.connectionState === 'closed') {
        console.log('Peer connection closed or failed:', socketId);
      }
    };
    
    // Handle track events (when remote stream becomes available)
    peerConnection.ontrack = (event) => {
      console.log('Received remote track from:', socketId);
      
      // Store the remote stream
      if (!remoteStreams[socketId]) {
        remoteStreams[socketId] = new MediaStream();
      }
      
      // Add the track to the remote stream
      event.track.onunmute = () => {
        if (!remoteStreams[socketId].getTracks().includes(event.track)) {
          remoteStreams[socketId].addTrack(event.track);
        }
      };
      
      // Add video to the grid
      addVideoStream(socketId, remoteStreams[socketId], username, false);
    };
    
    // If we're the initiator, create and send an offer
    if (isInitiator) {
      createAndSendOffer(peerConnection, socketId);
    }
    
    return peerConnection;
  } catch (error) {
    console.error('Error creating peer connection:', error);
    return null;
  }
}

// Create and send an offer
async function createAndSendOffer(peerConnection, targetId) {
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    console.log('Sending offer to:', targetId);
    socket.emit('signal:offer', {
      targetId: targetId,
      sdp: peerConnection.localDescription
    });
  } catch (error) {
    console.error('Error creating offer:', error);
  }
}

// Setup local media
async function setupLocalMedia() {
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
    addVideoStream("local", localStream, currentUser.username || "You", true);
  } catch (error) {
    console.error("Media error:", error);

    // Create fallback content
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
    isLocal ? (isAudioEnabled
      ? '<i class="fas fa-microphone"></i>'
      : '<i class="fas fa-microphone-slash"></i>')
      : '<i class="fas fa-microphone"></i>'
  }</span>
            <span id="cam-${userId}">${
    isLocal ? (isVideoEnabled
      ? '<i class="fas fa-video"></i>'
      : '<i class="fas fa-video-slash"></i>')
      : '<i class="fas fa-video"></i>'
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
                <button id="toggle-hand" class="btn btn-sm btn-light mx-1">
                    <i class="fas fa-hand-paper"></i>
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
  
  // Show notification for remote users
  if (!isLocal) {
    showNotification(`${username} joined the room`);
  }
}

// Set up video control buttons
function setupVideoControls() {
  const toggleMicBtn = document.getElementById("toggle-mic");
  const toggleCameraBtn = document.getElementById("toggle-camera");
  const toggleScreenBtn = document.getElementById("toggle-screen");
  const toggleHandBtn = document.getElementById("toggle-hand");

  if (toggleMicBtn) {
    toggleMicBtn.addEventListener("click", toggleAudio);
  }

  if (toggleCameraBtn) {
    toggleCameraBtn.addEventListener("click", toggleVideo);
  }

  if (toggleScreenBtn) {
    toggleScreenBtn.addEventListener("click", toggleScreenShare);
  }
  
  if (toggleHandBtn) {
    toggleHandBtn.addEventListener("click", toggleHandRaising);
  }
}

// Set up event listeners
function setupEventListeners() {
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

  // Chat form
  const chatForm = document.getElementById("chat-form");
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });
  }

  // Leave room button
  const leaveBtn = document.getElementById("leave-room-btn");
  if (leaveBtn) {
    leaveBtn.addEventListener("click", confirmLeaveRoom);
  }
  
  // Add logout event listener
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to logout?")) {
        // Clear token cookie
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        // Redirect to login page
        window.location.href = "login";
      }
    });
  }
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
  
  // Notify server about media state change
  if (socket && socket.connected) {
    socket.emit('toggle-media', {
      audioEnabled: isAudioEnabled,
      videoEnabled: isVideoEnabled
    });
  }

  showNotification(`You ${isAudioEnabled ? "unmuted" : "muted"} your microphone`);
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
  
  // Notify server about media state change
  if (socket && socket.connected) {
    socket.emit('toggle-media', {
      audioEnabled: isAudioEnabled,
      videoEnabled: isVideoEnabled
    });
  }

  showNotification(`You turned ${isVideoEnabled ? "on" : "off"} your camera`);
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

      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      
      if (videoTrack) {
        for (const socketId in peerConnections) {
          const senders = peerConnections[socketId].getSenders();
          const videoSender = senders.find(sender => 
            sender.track && sender.track.kind === 'video'
          );
          
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          }
        }
        
        // Replace local video display
        const localVideo = document.getElementById("video-local");
        if (localVideo) {
          localVideo.srcObject = screenStream;
        }
      }

      // Handle end of screen sharing
      screenStream.getVideoTracks()[0].onended = () => {
        toggleScreenShare();
      };

      showNotification("You started sharing your screen");
    } else {
      // Stop screen sharing
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }

      // Update UI
      isScreenSharing = false;
      const toggleScreenBtn = document.getElementById("toggle-screen");
      if (toggleScreenBtn) {
        toggleScreenBtn.innerHTML = '<i class="fas fa-desktop"></i>';
        toggleScreenBtn.classList.remove("btn-warning");
        toggleScreenBtn.classList.add("btn-light");
      }

      // Replace screen track with camera track in all peer connections
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        
        if (videoTrack) {
          for (const socketId in peerConnections) {
            const senders = peerConnections[socketId].getSenders();
            const videoSender = senders.find(sender => 
              sender.track && sender.track.kind === 'video'
            );
            
            if (videoSender) {
              videoSender.replaceTrack(videoTrack);
            }
          }
          
          // Replace local video display
          const localVideo = document.getElementById("video-local");
          if (localVideo) {
            localVideo.srcObject = localStream;
          }
        }
      }

      showNotification("You stopped sharing your screen");
    }
  } catch (error) {
    console.error("Screen sharing error:", error);
    alert("Screen sharing failed: " + error.message);
  }
}

// Toggle hand raising
function toggleHandRaising() {
  if (!socket || !socket.connected) return;
  
  const toggleHandBtn = document.getElementById("toggle-hand");
  if (!toggleHandBtn) return;
  
  const isRaised = toggleHandBtn.classList.contains("btn-warning");
  
  // Toggle hand status
  socket.emit('toggle-hand', !isRaised);
  
  // Update UI
  toggleHandBtn.classList.toggle("btn-warning", !isRaised);
  toggleHandBtn.classList.toggle("btn-light", isRaised);
  
  // Update local UI to show hand status
  const localVideo = document.getElementById("video-local");
  if (localVideo) {
    const videoCard = localVideo.closest('.card');
    if (videoCard) {
      if (!isRaised) {
        // Add hand raised indicator
        if (!document.getElementById("hand-local")) {
          const handIndicator = document.createElement('div');
          handIndicator.id = "hand-local";
          handIndicator.className = 'position-absolute top-0 end-0 p-2';
          handIndicator.innerHTML = '<span class="badge bg-warning"><i class="fas fa-hand-paper"></i> Hand Raised</span>';
          videoCard.appendChild(handIndicator);
        }
      } else {
        // Remove hand raised indicator
        const handIndicator = document.getElementById("hand-local");
        if (handIndicator) {
          handIndicator.remove();
        }
      }
    }
  }
  
  showNotification(`You ${!isRaised ? "raised" : "lowered"} your hand`);
}

// Toggle chat
function toggleChat() {
  const chatPanel = document.getElementById("chat-panel");
  if (!chatPanel) return;

  isChatOpen = !isChatOpen;
  chatPanel.classList.toggle("open", isChatOpen);

  const toggleChatBtn = document.getElementById("toggle-chat");
  if (toggleChatBtn) {
    toggleChatBtn.innerHTML = isChatOpen
      ? '<i class="fas fa-comments me-1"></i> Close Chat'
      : '<i class="fas fa-comments me-1"></i> Open Chat';
    toggleChatBtn.classList.toggle("active", isChatOpen);
    toggleChatBtn.classList.toggle("btn-outline-primary", !isChatOpen);
    toggleChatBtn.classList.toggle("btn-primary", isChatOpen);
  }
}

// Send message
function sendMessage() {
  const messageInput = document.getElementById("chat-input");
  if (!messageInput || !socket || !socket.connected) return;

  const message = messageInput.value.trim();
  if (!message) return;

  // Send message to server
  socket.emit('chat-message', {
    message: message,
    isPrivate: false
  });

  // Add message to local chat
  addMessageToChat({
    senderId: currentUser.id,
    senderName: currentUser.username + " (You)",
    message: message,
    timestamp: new Date()
  });

  // Clear input
  messageInput.value = "";
}

// Add message to chat
function addMessageToChat(data) {
  const messagesContainer = document.getElementById("chat-messages");
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

  // Show chat panel if it's not already open and message is from someone else
  if (!isChatOpen && !data.senderName.includes("You")) {
    toggleChat();
    // Show notification
    showNotification(`New message from ${data.senderName.split(' ')[0]}`);
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

// Confirm leaving room
function confirmLeaveRoom() {
  if (confirm("Are you sure you want to leave this video room?")) {
    leaveRoom();
  }
}

// Leave room
function leaveRoom() {
  // Notify server
  if (socket && socket.connected) {
    socket.emit('leave-room');
  }
  
  // Close all peer connections
  for (const socketId in peerConnections) {
    peerConnections[socketId].close();
  }
  
  // Clear peer connections
  peerConnections = {};
  
  // Stop all media streams
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }

  if (screenStream) {
    screenStream.getTracks().forEach((track) => track.stop());
  }

  // Disconnect socket
  if (socket) {
    socket.disconnect();
  }

  // Redirect to dashboard
  window.location.href = "dashboard/teacher";
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
            <a href="teacher-dashboard" class="btn btn-outline-danger btn-sm">
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
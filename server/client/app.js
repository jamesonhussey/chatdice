// Socket.IO connection
const socket = io();

// DOM elements
const landingPage = document.getElementById('landing-page');
const chatInterface = document.getElementById('chat-interface');
const start1on1Btn = document.getElementById('start-1on1-btn');
const startGroupBtn = document.getElementById('start-group-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages-container');
const statusMessage = document.getElementById('status-message');
const chatType = document.getElementById('chat-type');
const userCount = document.getElementById('user-count');
const reportBtn = document.getElementById('report-btn');
const leaveBtn = document.getElementById('leave-btn');

// State
let currentRoom = null;
let currentRoomType = null;
let mySocketId = null;
let myColor = null;

// Get socket ID on connection
socket.on('connect', () => {
  mySocketId = socket.id;
  console.log('Connected to server:', mySocketId);
});

// Event Listeners
start1on1Btn.addEventListener('click', () => {
  start1on1Btn.classList.add('loading');
  socket.emit('start-1on1');
});

startGroupBtn.addEventListener('click', () => {
  startGroupBtn.classList.add('loading');
  socket.emit('start-group');
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

leaveBtn.addEventListener('click', () => {
  if (confirm('Are you sure you want to leave this chat?')) {
    socket.emit('leave-chat');
    resetToLanding();
  }
});

reportBtn.addEventListener('click', () => {
  const reason = prompt('Why are you reporting this user? (optional)');
  // For simplicity, we'll report the room (admin can see all participants)
  socket.emit('report-user', { 
    reportedUserId: 'room', 
    reason 
  });
});

// Socket event handlers
socket.on('queued', (data) => {
  start1on1Btn.classList.remove('loading');
  startGroupBtn.classList.remove('loading');
  
  showChatInterface();
  showStatus(`${data.message} You'll be notified when a match is found.`, 'info');
  
  currentRoomType = data.type;
  chatType.textContent = data.type === '1on1' ? '1-on-1 Chat' : 'Group Chat';
  userCount.textContent = `Position in queue: ${data.position}`;
});

socket.on('matched', (data) => {
  start1on1Btn.classList.remove('loading');
  startGroupBtn.classList.remove('loading');
  
  currentRoom = data.roomId;
  currentRoomType = data.roomType;
  myColor = data.myColor || null;
  
  showChatInterface();
  
  let statusText = 'Match found! You can start chatting now.';
  if (myColor) {
    statusText = `Match found! You are ${myColor.name}. Start chatting now!`;
  }
  showStatus(statusText, 'success');
  
  chatType.textContent = data.roomType === '1on1' ? '1-on-1 Chat' : 'Group Chat';
  userCount.textContent = `${data.userCount} ${data.userCount === 1 ? 'user' : 'users'}`;
  
  // Show browser notification if permission granted
  if (Notification.permission === 'granted') {
    new Notification('ChatDice', {
      body: 'You\'ve been matched! Start chatting now.',
      icon: '🎲'
    });
  }
  
  messageInput.focus();
});

socket.on('message', (data) => {
  displayMessage(data.message, data.userId, data.timestamp, data.userColor);
});

socket.on('user-left', (data) => {
  addSystemMessage(`A user has left the chat. ${data.remainingUsers} users remaining.`);
  userCount.textContent = `${data.remainingUsers} ${data.remainingUsers === 1 ? 'user' : 'users'}`;
});

socket.on('chat-ended', (data) => {
  showStatus(data.reason, 'info');
  messageInput.disabled = true;
  sendBtn.disabled = true;
  
  setTimeout(() => {
    if (confirm('Chat ended. Return to home?')) {
      resetToLanding();
    }
  }, 2000);
});

socket.on('error', (data) => {
  showStatus(data.message, 'error');
});

socket.on('report-sent', (data) => {
  alert(data.message);
});

socket.on('disconnect', () => {
  showStatus('Disconnected from server. Trying to reconnect...', 'error');
});

socket.on('reconnect', () => {
  showStatus('Reconnected to server!', 'success');
  setTimeout(() => {
    resetToLanding();
  }, 1500);
});

// Functions
function sendMessage() {
  const message = messageInput.value.trim();
  
  if (!message) return;
  
  if (!currentRoom) {
    showStatus('Please wait to be matched first.', 'error');
    return;
  }
  
  socket.emit('send-message', { message });
  messageInput.value = '';
}

function displayMessage(message, userId, timestamp, userColor = null) {
  const messageDiv = document.createElement('div');
  const isOwnMessage = userId === mySocketId;
  messageDiv.className = isOwnMessage ? 'message own' : 'message other';
  
  // Apply color styling for group chats
  if (userColor && currentRoomType === 'group') {
    if (isOwnMessage) {
      messageDiv.style.background = `linear-gradient(135deg, ${userColor.value} 0%, ${userColor.value}dd 100%)`;
      messageDiv.style.color = 'white';
    } else {
      messageDiv.style.borderLeft = `4px solid ${userColor.value}`;
    }
  }
  
  const messageText = document.createElement('div');
  messageText.textContent = message;
  
  const messageMeta = document.createElement('div');
  messageMeta.className = 'message-meta';
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Display username with color in group chats
  let displayName;
  if (isOwnMessage) {
    displayName = userColor ? `You (${userColor.name})` : 'You';
  } else {
    displayName = userColor ? userColor.name : 'Stranger';
  }
  
  messageMeta.textContent = `${displayName} • ${time}`;
  
  messageDiv.appendChild(messageText);
  messageDiv.appendChild(messageMeta);
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addSystemMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'system-message';
  messageDiv.textContent = text;
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message';
  
  if (type === 'success') {
    statusMessage.classList.add('success');
  }
  
  statusMessage.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.style.display = 'none';
    }, 3000);
  }
}

function showChatInterface() {
  landingPage.style.display = 'none';
  chatInterface.style.display = 'flex';
  messagesContainer.innerHTML = '';
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.value = '';
}

function resetToLanding() {
  landingPage.style.display = 'block';
  chatInterface.style.display = 'none';
  currentRoom = null;
  currentRoomType = null;
  myColor = null;
  messagesContainer.innerHTML = '';
  messageInput.value = '';
  start1on1Btn.classList.remove('loading');
  startGroupBtn.classList.remove('loading');
  statusMessage.style.display = 'none';
}

// Request notification permission on load
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Warn before leaving page if in active chat
window.addEventListener('beforeunload', (e) => {
  if (currentRoom) {
    e.preventDefault();
    e.returnValue = 'You are in an active chat. Are you sure you want to leave?';
    return e.returnValue;
  }
});

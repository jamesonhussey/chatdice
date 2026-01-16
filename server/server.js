const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const ChatDatabase = require('./database');
const Matchmaker = require('./matchmaking');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize services
const db = new ChatDatabase();
const matchmaker = new Matchmaker();

// Rate limiting map
const messageCounts = new Map();
const RATE_LIMIT = 20; // messages per minute
const RATE_WINDOW = 60000; // 1 minute

// Serve static files from client directory
app.use(express.static(path.join(__dirname, 'client')));

// Stats endpoint (optional - for monitoring)
app.get('/api/stats', (req, res) => {
  res.json(matchmaker.getStats());
});

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'client', '404.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Start 1-on-1 chat
  socket.on('start-1on1', () => {
    const result = matchmaker.addToOneOnOneQueue(socket.id);
    
    if (result.matched) {
      // Notify both users they've been matched
      result.users.forEach(userId => {
        io.to(userId).emit('matched', {
          roomId: result.roomId,
          roomType: result.roomType,
          userCount: 2
        });
      });
      
      // Join both users to the socket.io room
      result.users.forEach(userId => {
        io.sockets.sockets.get(userId)?.join(result.roomId);
      });
    } else if (result.queued) {
      socket.emit('queued', {
        type: '1on1',
        position: result.position,
        message: 'Waiting for a chat partner...'
      });
    }
  });

  // Start group chat
  socket.on('start-group', () => {
    const result = matchmaker.addToGroupQueue(socket.id);
    
    if (result.matched) {
      // Notify all users they've been matched
      result.users.forEach(userId => {
        const userColor = result.userColors[userId];
        io.to(userId).emit('matched', {
          roomId: result.roomId,
          roomType: result.roomType,
          userCount: result.users.length,
          myColor: userColor
        });
      });
      
      // Join all users to the socket.io room
      result.users.forEach(userId => {
        io.sockets.sockets.get(userId)?.join(result.roomId);
      });
    } else if (result.queued) {
      socket.emit('queued', {
        type: 'group',
        position: result.position,
        message: `Waiting for group chat... (${result.position}/10)`
      });
    }
  });

  // Send message
  socket.on('send-message', (data) => {
    const { message } = data;
    const room = matchmaker.getRoomBySocketId(socket.id);
    
    if (!room) {
      socket.emit('error', { message: 'You are not in a chat room' });
      return;
    }

    // Rate limiting
    const now = Date.now();
    const userRateData = messageCounts.get(socket.id) || { count: 0, windowStart: now };
    
    if (now - userRateData.windowStart > RATE_WINDOW) {
      // Reset window
      userRateData.count = 0;
      userRateData.windowStart = now;
    }
    
    if (userRateData.count >= RATE_LIMIT) {
      socket.emit('error', { message: 'Sending messages too fast. Please slow down.' });
      return;
    }
    
    userRateData.count++;
    messageCounts.set(socket.id, userRateData);

    // Save message to database
    db.saveMessage(room.id, socket.id, message, room.type);

    // Get user color (for group chats)
    const userColor = matchmaker.getUserColor(socket.id);

    // Broadcast message to room
    io.to(room.id).emit('message', {
      userId: socket.id,
      message,
      timestamp: Date.now(),
      userColor: userColor
    });
  });

  // Report user
  socket.on('report-user', (data) => {
    const { reportedUserId, reason } = data;
    const room = matchmaker.getRoomBySocketId(socket.id);
    
    if (!room) {
      socket.emit('error', { message: 'You are not in a chat room' });
      return;
    }

    db.saveReport(room.id, reportedUserId, socket.id, reason || 'No reason provided');
    socket.emit('report-sent', { message: 'Report submitted. Thank you.' });
  });

  // Leave chat
  socket.on('leave-chat', () => {
    handleDisconnect(socket);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    handleDisconnect(socket);
  });

  function handleDisconnect(socket) {
    // Remove from queues
    matchmaker.removeFromQueues(socket.id);
    
    // Leave room if in one
    const result = matchmaker.leaveRoom(socket.id);
    if (result && result.room) {
      // Notify remaining users
      io.to(result.roomId).emit('user-left', {
        userId: socket.id,
        remainingUsers: result.room.users.length
      });
      
      // If 1-on-1 chat partner left, end chat for other user
      if (result.room.type === '1on1' && result.room.users.length > 0) {
        io.to(result.roomId).emit('chat-ended', {
          reason: 'Your chat partner has disconnected'
        });
      }
    }
    
    // Clean up rate limiting
    messageCounts.delete(socket.id);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎲 ChatDice Server running on port ${PORT}`);
  console.log(`📊 Stats available at http://localhost:${PORT}/api/stats\n`);
});

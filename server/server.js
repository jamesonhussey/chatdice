const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const ChatDatabase = require('./database');
const Matchmaker = require('./matchmaking');
const aiChat = require('./ai-chat');

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
aiChat.initialize();

// Rate limiting map
const messageCounts = new Map();
const RATE_LIMIT = 20; // messages per minute
const RATE_WINDOW = 60000; // 1 minute

// AFK detection
const userActivity = new Map(); // Track message counts and silent chats
const AFK_SILENT_CHAT_LIMIT = 2; // Boot after 2 silent chats in a row
const INACTIVITY_TIMEOUT = 150000; // 2.5 minutes in milliseconds
const inactivityTimers = new Map(); // Track inactivity timers for all chats

// Serve static files from client directory
app.use(express.static(path.join(__dirname, 'client')));

// Stats endpoint (optional - for monitoring)
app.get('/api/stats', (req, res) => {
  res.json({
    ...matchmaker.getStats(),
    aiChat: aiChat.getStats()
  });
});

// 404 handler - must be after all other routes
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'client', '404.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  // Initialize user activity tracking
  if (!userActivity.has(socket.id)) {
    userActivity.set(socket.id, {
      messagesInCurrentChat: 0,
      consecutiveSilentChats: 0
    });
  }

  // Start 1-on-1 chat
  socket.on('start-1on1', () => {
    const activity = userActivity.get(socket.id);
    
    // Reset message counter for new chat and reset AFK counter (user is actively engaging)
    if (activity) {
      activity.messagesInCurrentChat = 0;
      
      // If user was marked as AFK, reset their counter (they're actively trying to chat now)
      if (activity.consecutiveSilentChats > 0) {
        console.log(`✓ Resetting AFK counter for user ${socket.id} (was ${activity.consecutiveSilentChats})`);
        activity.consecutiveSilentChats = 0;
      }
    }

    const result = matchmaker.addToOneOnOneQueue(socket.id);
    
    if (result.matched) {
      // Cancel any AI queue if exists
      if (aiChat.isAvailable()) {
        aiChat.cancelQueuedMatch(socket.id);
      }
      
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
        // Start inactivity timer for each user
        startInactivityTimer(userId);
      });
    } else if (result.queued) {
      socket.emit('queued', {
        type: '1on1',
        position: result.position,
        message: 'Waiting for a chat partner...'
      });
      
      // Queue for AI match if available
      if (aiChat.isAvailable()) {
        const waitTime = aiChat.queueForAIMatch(
          socket.id,
          // AI match callback
          (matchInfo) => {
            // Remove user from matchmaker queue (they're now in AI chat)
            matchmaker.removeFromQueues(socket.id);
            
            socket.emit('matched', {
              roomId: 'ai-chat',
              roomType: '1on1',
              userCount: 2
            });

            // Start inactivity timer
            startInactivityTimer(socket.id);
          },
          // Real user check callback
          () => {
            // Check if there's ANOTHER real user waiting (not self)
            const hasOtherUser = matchmaker.oneOnOneQueue.length > 0;
            
            if (hasOtherUser) {
              // Find non-recent partner in queue
              let foundPartner = null;
              
              for (let i = 0; i < matchmaker.oneOnOneQueue.length; i++) {
                const candidate = matchmaker.oneOnOneQueue[i];
                if (!matchmaker.isRecentPartner(socket.id, candidate.socketId)) {
                  foundPartner = matchmaker.oneOnOneQueue.splice(i, 1)[0];
                  break;
                }
              }
              
              // If no non-recent partner found, let AI continue (better than same person)
              if (!foundPartner) {
                return false;
              }
              
              // Cancel other user's AI queue timer (they're getting a real match now!)
              aiChat.cancelQueuedMatch(foundPartner.socketId);
              
              // Create room between current user and other user
              const result = matchmaker.createOneOnOneRoom(socket.id, foundPartner.socketId);
              
              // Notify both users of match
              result.users.forEach(userId => {
                io.to(userId).emit('matched', {
                  roomId: result.roomId,
                  roomType: result.roomType,
                  userCount: 2
                });
              });
              
              // Join both to the room
              result.users.forEach(userId => {
                io.sockets.sockets.get(userId)?.join(result.roomId);
              });
              
              return true; // Real user found and matched
            }
            return false; // No other real user yet
          },
          // Send first message callback
          (firstMessage) => {
            setTimeout(() => {
              socket.emit('message', {
                userId: 'ai-bot',
                message: firstMessage.response,
                timestamp: Date.now()
              });
            }, firstMessage.delay);
          }
        );
      }
    }
  });

  // Start group chat
  socket.on('start-group', () => {
    const activity = userActivity.get(socket.id);
    
    // Reset message counter for new chat and reset AFK counter (user is actively engaging)
    if (activity) {
      activity.messagesInCurrentChat = 0;
      
      // If user was marked as AFK, reset their counter (they're actively trying to chat now)
      if (activity.consecutiveSilentChats > 0) {
        console.log(`✓ Resetting AFK counter for user ${socket.id} (was ${activity.consecutiveSilentChats})`);
        activity.consecutiveSilentChats = 0;
      }
    }

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
        // Start inactivity timer for each user
        startInactivityTimer(userId);
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
  socket.on('send-message', async (data) => {
    const { message } = data;
    
    // Track user activity (they sent a message)
    const activity = userActivity.get(socket.id);
    if (activity) {
      activity.messagesInCurrentChat++;
      // Reset silent chat counter since they're active
      if (activity.consecutiveSilentChats > 0) {
        activity.consecutiveSilentChats = 0;
      }
    }
    
    // Reset inactivity timer since user sent a message
    resetInactivityTimer(socket.id);
    
    // Check if in AI chat
    if (aiChat.isInAIChat(socket.id)) {
      try {
        // Get AI response
        const response = await aiChat.handleUserMessage(socket.id, message);
        
        // Send user's message back to them
        socket.emit('message', {
          userId: socket.id,
          message,
          timestamp: Date.now()
        });
        
        if (response.shouldEnd) {
          // AI wants to end conversation (autonomous leaving or max time/messages)
          if (response.response) {
            // Send current message first
            setTimeout(() => {
              socket.emit('message', {
                userId: 'ai-bot',
                message: response.response,
                timestamp: Date.now()
              });
              
              // If there's an exit message (like "gtg"), send it too
              if (response.exitMessage) {
                setTimeout(() => {
                  socket.emit('message', {
                    userId: 'ai-bot',
                    message: response.exitMessage,
                    timestamp: Date.now()
                  });
                  
                  // Then disconnect
                  setTimeout(() => {
                    socket.emit('chat-ended', {
                      reason: 'Chat partner disconnected'
                    });
                    aiChat.endAIChat(socket.id, 'ai-ended');
                  }, 1000);
                }, 1500);
              } else {
                // No exit message - disconnect after current message
                setTimeout(() => {
                  socket.emit('chat-ended', {
                    reason: 'Chat partner disconnected'
                  });
                  aiChat.endAIChat(socket.id, 'ai-ended');
                }, 1000);
              }
            }, response.delay);
          } else {
            // Ghost - just disconnect (no message at all)
            setTimeout(() => {
              socket.emit('chat-ended', {
                reason: 'Chat partner disconnected'
              });
              aiChat.endAIChat(socket.id, 'ai-ghosted');
            }, 2000);
          }
        } else if (response.response) {
          // Normal AI response
          setTimeout(() => {
            socket.emit('message', {
              userId: 'ai-bot',
              message: response.response,
              timestamp: Date.now()
            });
          }, response.delay);
        }
        // If response is null and not ending, AI is ignoring (realistic)
        
      } catch (error) {
        console.error('Error handling AI message:', error);
        socket.emit('error', { message: 'Something went wrong. Please try again.' });
      }
      return;
    }
    
    // Normal chat (not AI)
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
    // Track if user was silent in this chat
    const activity = userActivity.get(socket.id);
    if (activity && activity.messagesInCurrentChat === 0) {
      // User didn't send any messages in this chat
      activity.consecutiveSilentChats++;
      console.log(`⚠️  User ${socket.id} silent chat count: ${activity.consecutiveSilentChats}`);
    }

    // Clear inactivity timer
    clearInactivityTimer(socket.id);

    // End AI chat if in one
    if (aiChat.isInAIChat(socket.id)) {
      aiChat.endAIChat(socket.id, 'user-disconnected');
    }
    
    // Cancel any queued AI match
    if (aiChat.isAvailable()) {
      aiChat.cancelQueuedMatch(socket.id);
    }
    
    // Remove from queues
    matchmaker.removeFromQueues(socket.id);
    
    // Leave room if in one
    const result = matchmaker.leaveRoom(socket.id);
    if (result && result.room) {
      // Actually remove socket from Socket.IO room
      socket.leave(result.roomId);
      
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
    
    // Clear recent partners history
    matchmaker.clearRecentPartners(socket.id);
    
    // Clean up rate limiting
    messageCounts.delete(socket.id);
  }

  /**
   * Start inactivity timer for a user
   * @param {string} userId - Socket ID
   */
  function startInactivityTimer(userId) {
    // Clear existing timer if any
    clearInactivityTimer(userId);

    // Set new timer
    const timer = setTimeout(() => {
      console.log(`⏱️  User ${userId} inactive for 2.5 minutes, redirecting to home`);
      
      const userSocket = io.sockets.sockets.get(userId);
      if (userSocket) {
        // Redirect user to home page due to inactivity
        userSocket.emit('inactivity-redirect', {
          message: 'You were inactive for too long and have been returned to the home page.'
        });

        // Clean up their session
        handleDisconnect(userSocket);
      }
    }, INACTIVITY_TIMEOUT);

    inactivityTimers.set(userId, timer);
  }

  /**
   * Reset inactivity timer for a user
   * @param {string} userId - Socket ID
   */
  function resetInactivityTimer(userId) {
    if (inactivityTimers.has(userId)) {
      startInactivityTimer(userId);
    }
  }

  /**
   * Clear inactivity timer for a user
   * @param {string} userId - Socket ID
   */
  function clearInactivityTimer(userId) {
    const timer = inactivityTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      inactivityTimers.delete(userId);
    }
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

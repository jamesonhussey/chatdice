const { v4: uuidv4 } = require('uuid');

// Color palette for group chat users
const USER_COLORS = [
  { name: 'Red', value: '#e74c3c' },
  { name: 'Orange', value: '#e67e22' },
  { name: 'Yellow', value: '#f39c12' },
  { name: 'Green', value: '#2ecc71' },
  { name: 'Blue', value: '#3498db' },
  { name: 'Purple', value: '#9b59b6' },
  { name: 'Pink', value: '#ff69b4' },
  { name: 'Teal', value: '#1abc9c' },
  { name: 'Indigo', value: '#5f27cd' },
  { name: 'Coral', value: '#ff6b6b' }
];

class Matchmaker {
  constructor() {
    this.oneOnOneQueue = [];
    this.groupQueue = [];
    this.activeRooms = new Map();
    this.userToRoom = new Map();
    this.userColors = new Map(); // Track user colors in rooms
    this.recentPartners = new Map(); // Track recent chat partners (userId -> [recent partner IDs])
    
    // Start queue cleanup job
    this.startQueueCleanup();
  }

  /**
   * Check if two users have chatted recently
   * @param {string} userId1 - First user ID
   * @param {string} userId2 - Second user ID
   * @returns {boolean} - True if they've chatted recently
   */
  isRecentPartner(userId1, userId2) {
    const user1Recent = this.recentPartners.get(userId1) || [];
    const user2Recent = this.recentPartners.get(userId2) || [];
    return user1Recent.includes(userId2) || user2Recent.includes(userId1);
  }

  /**
   * Add partner to user's recent list
   * @param {string} userId - User ID
   * @param {string} partnerId - Partner ID to remember
   */
  addRecentPartner(userId, partnerId) {
    const recent = this.recentPartners.get(userId) || [];
    
    // Add to front of list
    recent.unshift(partnerId);
    
    // Keep only last 5
    if (recent.length > 5) {
      recent.pop();
    }
    
    this.recentPartners.set(userId, recent);
  }

  addToOneOnOneQueue(socketId) {
    const queueEntry = {
      socketId,
      timestamp: Date.now(),
      type: '1on1'
    };

    // Check if there's someone waiting
    if (this.oneOnOneQueue.length > 0) {
      // Look for a non-recent partner in queue
      let partnerIndex = -1;
      
      for (let i = 0; i < this.oneOnOneQueue.length; i++) {
        const candidate = this.oneOnOneQueue[i];
        
        // Check if valid (not expired)
        if (Date.now() - candidate.timestamp >= 3600000) {
          continue; // Skip expired
        }
        
        // Check if not a recent partner
        if (!this.isRecentPartner(socketId, candidate.socketId)) {
          partnerIndex = i;
          break;
        }
      }
      
      if (partnerIndex !== -1) {
        // Found a non-recent partner
        const partner = this.oneOnOneQueue.splice(partnerIndex, 1)[0];
        return this.createOneOnOneRoom(partner.socketId, socketId);
      } else {
        // No non-recent partners available, add to queue
        // (AI will handle if no one else joins)
        this.oneOnOneQueue.push(queueEntry);
        return { queued: true, position: this.oneOnOneQueue.length };
      }
    } else {
      // No one waiting, add to queue
      this.oneOnOneQueue.push(queueEntry);
      return { queued: true, position: 1 };
    }
  }

  addToGroupQueue(socketId) {
    const queueEntry = {
      socketId,
      timestamp: Date.now(),
      type: 'group'
    };

    this.groupQueue.push(queueEntry);

    // Check if we have 10 people for a group
    if (this.groupQueue.length >= 10) {
      const groupMembers = [];
      
      // Take 10 people from queue
      for (let i = 0; i < 10; i++) {
        const member = this.groupQueue.shift();
        // Verify not expired
        if (Date.now() - member.timestamp < 3600000) {
          groupMembers.push(member.socketId);
        }
      }

      // If we got enough valid members, create room
      if (groupMembers.length >= 2) {
        return this.createGroupRoom(groupMembers);
      } else {
        // Not enough valid members, re-add current user
        this.groupQueue.push(queueEntry);
        return { queued: true, position: this.groupQueue.length };
      }
    } else {
      return { queued: true, position: this.groupQueue.length };
    }
  }

  createOneOnOneRoom(socketId1, socketId2) {
    const roomId = uuidv4();
    const room = {
      id: roomId,
      type: '1on1',
      users: [socketId1, socketId2],
      createdAt: Date.now()
    };

    this.activeRooms.set(roomId, room);
    this.userToRoom.set(socketId1, roomId);
    this.userToRoom.set(socketId2, roomId);

    // Track as recent partners (prevent immediate re-matching)
    this.addRecentPartner(socketId1, socketId2);
    this.addRecentPartner(socketId2, socketId1);

    console.log(`✓ Created 1-on-1 room: ${roomId}`);
    
    return {
      matched: true,
      roomId,
      roomType: '1on1',
      users: [socketId1, socketId2]
    };
  }

  createGroupRoom(socketIds) {
    const roomId = uuidv4();
    
    // Assign colors to users
    const userColors = {};
    socketIds.forEach((socketId, index) => {
      const color = USER_COLORS[index % USER_COLORS.length];
      userColors[socketId] = color;
      this.userColors.set(socketId, color);
    });
    
    const room = {
      id: roomId,
      type: 'group',
      users: socketIds,
      userColors: userColors,
      createdAt: Date.now()
    };

    this.activeRooms.set(roomId, room);
    socketIds.forEach(socketId => {
      this.userToRoom.set(socketId, roomId);
    });

    console.log(`✓ Created group room: ${roomId} with ${socketIds.length} users`);
    
    return {
      matched: true,
      roomId,
      roomType: 'group',
      users: socketIds,
      userColors: userColors
    };
  }

  removeFromQueues(socketId) {
    this.oneOnOneQueue = this.oneOnOneQueue.filter(entry => entry.socketId !== socketId);
    this.groupQueue = this.groupQueue.filter(entry => entry.socketId !== socketId);
  }

  leaveRoom(socketId) {
    const roomId = this.userToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.activeRooms.get(roomId);
    if (!room) return null;

    // Remove user from room
    room.users = room.users.filter(id => id !== socketId);
    this.userToRoom.delete(socketId);
    this.userColors.delete(socketId);

    // If room is empty or 1-on-1 with only 1 person, delete room
    if (room.users.length === 0 || (room.type === '1on1' && room.users.length < 2)) {
      this.activeRooms.delete(roomId);
      // Clean up remaining users
      room.users.forEach(userId => {
        this.userToRoom.delete(userId);
        this.userColors.delete(userId);
      });
      console.log(`✗ Deleted room: ${roomId}`);
    }

    // Note: Don't clear recentPartners on room leave - keeps history for rematching prevention

    return { roomId, room };
  }

  /**
   * Clear recent partners for a user (on disconnect)
   * @param {string} socketId - User ID
   */
  clearRecentPartners(socketId) {
    this.recentPartners.delete(socketId);
  }

  getRoomBySocketId(socketId) {
    const roomId = this.userToRoom.get(socketId);
    if (!roomId) return null;
    return this.activeRooms.get(roomId);
  }

  getUserColor(socketId) {
    return this.userColors.get(socketId);
  }

  startQueueCleanup() {
    // Clean expired queue entries every 5 minutes
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;
      
      const removedOneOnOne = this.oneOnOneQueue.filter(entry => entry.timestamp < oneHourAgo).length;
      const removedGroup = this.groupQueue.filter(entry => entry.timestamp < oneHourAgo).length;
      
      this.oneOnOneQueue = this.oneOnOneQueue.filter(entry => entry.timestamp >= oneHourAgo);
      this.groupQueue = this.groupQueue.filter(entry => entry.timestamp >= oneHourAgo);
      
      if (removedOneOnOne + removedGroup > 0) {
        console.log(`🧹 Cleaned ${removedOneOnOne + removedGroup} expired queue entries`);
      }
    }, 5 * 60 * 1000);
  }

  getStats() {
    return {
      oneOnOneQueue: this.oneOnOneQueue.length,
      groupQueue: this.groupQueue.length,
      activeRooms: this.activeRooms.size,
      activeUsers: this.userToRoom.size
    };
  }
}

module.exports = Matchmaker;

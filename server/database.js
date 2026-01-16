const Database = require('better-sqlite3');
const path = require('path');

class ChatDatabase {
  constructor() {
    this.db = new Database(path.join(__dirname, 'chat.db'));
    this.initDatabase();
    this.startCleanupJob();
  }

  initDatabase() {
    // Create messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        room_type TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_room_id ON messages(room_id);
    `);

    // Create reports table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        reported_user_id TEXT NOT NULL,
        reporter_user_id TEXT NOT NULL,
        reason TEXT,
        timestamp INTEGER NOT NULL
      );
    `);

    console.log('✓ Database initialized');
  }

  saveMessage(roomId, userId, message, roomType) {
    const stmt = this.db.prepare(`
      INSERT INTO messages (room_id, user_id, message, timestamp, room_type)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(roomId, userId, message, Date.now(), roomType);
  }

  saveReport(roomId, reportedUserId, reporterUserId, reason) {
    const stmt = this.db.prepare(`
      INSERT INTO reports (room_id, reported_user_id, reporter_user_id, reason, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(roomId, reportedUserId, reporterUserId, reason, Date.now());
    console.log(`⚠ Report filed: User ${reportedUserId} in room ${roomId}`);
  }

  deleteOldMessages(daysOld = 30) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const stmt = this.db.prepare('DELETE FROM messages WHERE timestamp < ?');
    const result = stmt.run(cutoffTime);
    
    if (result.changes > 0) {
      console.log(`🗑️  Deleted ${result.changes} messages older than ${daysOld} days`);
    }
    
    return result.changes;
  }

  startCleanupJob() {
    // Run cleanup every 24 hours
    setInterval(() => {
      this.deleteOldMessages(30);
    }, 24 * 60 * 60 * 1000);

    // Run initial cleanup on startup
    this.deleteOldMessages(30);
  }

  getRoomMessages(roomId) {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp ASC');
    return stmt.all(roomId);
  }

  close() {
    this.db.close();
  }
}

module.exports = ChatDatabase;

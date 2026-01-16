# 🎲 ChatDice

**Random chat platform for anonymous 1-on-1 and group conversations.**

Live at: [www.chatdice.live](https://www.chatdice.live)

---

## Features

- **1-on-1 Chat**: Get matched instantly with one random person
- **Group Chat**: Join conversations with up to 10 people
- **Smart Queue**: Wait up to 1 hour for a match with notifications
- **Color-Coded Users**: Group chat participants assigned unique colors for easy identification
- **Anonymous**: No registration or personal info required
- **Safety First**: Rate limiting, report button, 30-day message retention for moderation

---

## Tech Stack

**Backend:**
- Node.js + Express
- Socket.IO (real-time messaging)
- SQLite (message storage)

**Frontend:**
- Vanilla JavaScript
- HTML5/CSS3
- Socket.IO client

**Hosting:**
- Railway (backend + database)
- Custom domain with SSL

---

## Local Development

### Prerequisites
- Node.js 18+ 
- npm

### Setup

```bash
# Install dependencies
cd server
npm install

# Start server
npm start

# Server runs on http://localhost:3000
```

### Project Structure

```
├── server/
│   ├── server.js          # Main server + Socket.IO
│   ├── matchmaking.js     # Queue and room management
│   ├── database.js        # SQLite message storage
│   └── client/            # Frontend files
│       ├── index.html
│       ├── style.css
│       └── app.js
└── README.md
```

---

## How It Works

1. User clicks "Start 1-on-1" or "Join Group Chat"
2. Server checks for waiting users in queue
3. If match found: Creates room and connects via WebSocket
4. If no match: Adds to queue (expires after 1 hour)
5. Messages sent in real-time to all room participants
6. Messages stored for 30 days then auto-deleted

---

## Safety & Privacy

- Messages stored temporarily for moderation
- Rate limiting prevents spam (20 messages/minute)
- Report system for inappropriate behavior
- No personal data collected beyond anonymous session IDs

See [Privacy Policy](https://www.chatdice.live/privacy.html) for details.

---

## License

MIT License - feel free to fork and modify!

---

## Contributing

Pull requests welcome! For major changes, please open an issue first.

---
require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ephemera-demo-secret-key-123';

// Enable CORS and JSON parsing
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('public'));

// Initialize SQLite database
const db = new Database('./ephemera.db');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS peers (
    peer_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalid or expired' });
    req.user = user;
    next();
  });
}

// User Registration
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const userId = 'usr_' + Math.random().toString(36).substr(2, 9);
  const hash = bcrypt.hashSync(password, 8);

  try {
    const insert = db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)');
    insert.run(userId, username, hash);
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '12h' });
    return res.status(201).json({ message: 'User registered', token, userId });
  } catch (err) {
    return res.status(409).json({ error: 'Username already exists' });
  }
});

// User Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
  return res.json({ message: 'Logged in', token, userId: user.id });
});

// Create Swarm Room
app.post('/api/rooms', authenticateToken, (req, res) => {
  const { name } = req.body;
  const roomId = 'room_' + Math.random().toString(36).substr(2, 9);

  const insert = db.prepare('INSERT INTO rooms (id, name, created_by) VALUES (?, ?, ?)');
  insert.run(roomId, name || 'Demo Swarm Room', req.user.id);

  return res.status(201).json({ roomId, name: name || 'Demo Swarm Room' });
});

// Join Room & Discover Peers
app.post('/api/rooms/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const { peerId } = req.body;

  if (!peerId) {
    return res.status(400).json({ error: 'peerId is required' });
  }

  const upsertPeer = db.prepare(`
    INSERT INTO peers (peer_id, room_id) VALUES (?, ?)
    ON CONFLICT(peer_id) DO UPDATE SET room_id = excluded.room_id
  `);
  upsertPeer.run(peerId, roomId);

  const existingPeers = db.prepare(`
    SELECT peer_id FROM peers WHERE room_id = ? AND peer_id != ?
  `).all(roomId, peerId);

  return res.json({
    message: 'Joined swarm',
    roomId,
    activePeers: existingPeers.map(p => p.peer_id)
  });
});

// Mount PeerJS WebRTC Signaling
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/'
});

app.use('/peerjs', peerServer);

peerServer.on('disconnect', (client) => {
  const cleanup = db.prepare('DELETE FROM peers WHERE peer_id = ?');
  cleanup.run(client.getId());
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server online: http://localhost:${PORT}`);
  console.log(`PeerJS Signaling: ws/http://localhost:${PORT}/peerjs`);
});
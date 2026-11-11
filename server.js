// Turbo Kickoff server: serves the game and relays private online matches.
// The host's browser runs the match; this server only passes messages between
// players in the same room (room = the 5-letter match code).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MAX_PER_ROOM = 16;
const ROOM_NAME = /^[a-z0-9][a-z0-9_.-]{0,47}$/;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname === '/healthz') { res.writeHead(200).end('ok'); return; }
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(PUBLIC, pathname));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024 });
const rooms = new Map(); // room name -> Map(peerId -> { ws, presence })

function broadcast(room, msg, exceptId) {
  const text = JSON.stringify(msg);
  for (const [id, member] of room) {
    if (id !== exceptId && member.ws.readyState === 1) member.ws.send(text);
  }
}

wss.on('connection', (ws) => {
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  let room = null;
  let roomName = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'join' && !room) {
      if (typeof m.room !== 'string' || !ROOM_NAME.test(m.room)) {
        ws.send(JSON.stringify({ t: 'err', code: 'invalid_argument' })); return;
      }
      const r = rooms.get(m.room) || new Map();
      if (r.size >= MAX_PER_ROOM) { ws.send(JSON.stringify({ t: 'err', code: 'limit_reached' })); return; }
      roomName = m.room; room = r; rooms.set(roomName, room);
      room.set(id, { ws, presence: {} });
      ws.send(JSON.stringify({
        t: 'joined', you: id,
        peers: [...room].map(([peer, v]) => ({ peer, presence: v.presence })),
      }));
      broadcast(room, { t: 'pj', peer: id, presence: {} }, id);
      return;
    }
    if (!room) return;

    if (m.t === 'pres' && m.patch && typeof m.patch === 'object' && !Array.isArray(m.patch)) {
      const me = room.get(id);
      const next = { ...me.presence };
      for (const k of Object.keys(m.patch)) {
        if (m.patch[k] === null) delete next[k]; else next[k] = m.patch[k];
      }
      if (JSON.stringify(next).length > 4096) return;
      me.presence = next;
      broadcast(room, { t: 'pu', peer: id, presence: next });
      return;
    }
    if (m.t === 'emit' && typeof m.topic === 'string' && m.topic.length <= 48) {
      broadcast(room, { t: 'ev', peer: id, topic: m.topic, data: m.data });
    }
  });

  ws.on('close', () => {
    if (!room) return;
    room.delete(id);
    broadcast(room, { t: 'pl', peer: id });
    if (room.size === 0) rooms.delete(roomName);
  });
});

// Drop dead connections so players who closed their tab leave the lobby.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 20000);

server.listen(PORT, () => console.log(`Turbo Kickoff running on port ${PORT}`));

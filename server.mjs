import { randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { ROOM_CAPACITY as capacity, MAX_STATE_BYTES, parsePresenceState } from './shared/presence-state.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(process.env.BARAMUI_PUBLIC_DIR || resolve(root, 'public'));
const dbPath = resolve(process.env.BARAMUI_DB_PATH || resolve(root, 'data', 'visits.sqlite'));
const host = process.env.BARAMUI_HOST || '127.0.0.1';
const port = Number(process.env.PORT ?? 8787);
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.webp', 'image/webp'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.avif', 'image/avif'], ['.ogg', 'audio/ogg'], ['.mp3', 'audio/mpeg'], ['.m4a', 'audio/mp4'],
  ['.wav', 'audio/wav'], ['.woff2', 'font/woff2'],
]);

function isInside(parent, candidate) {
  const path = relative(parent, candidate);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function openSqlite() {
  if (isInside(publicDir, dbPath)) throw new Error('The visit database must be outside the public directory.');
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA busy_timeout = 3000;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS baramui_visits (
      id INTEGER PRIMARY KEY,
      visited_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  return {
    db,
    record: db.prepare('INSERT INTO baramui_visits DEFAULT VALUES'),
    check: db.prepare('SELECT id FROM baramui_visits LIMIT 1'),
  };
}
const sqlite = openSqlite();

function send(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 65536) {
    socket.terminate();
    return;
  }
  socket.send(message);
}

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match || (!match[1] && !match[2])) return null;
  const [, first, last] = match;
  const start = first ? Number(first) : Math.max(0, size - Number(last));
  const end = first && last ? Math.min(size - 1, Number(last)) : size - 1;
  return start <= end ? { start, end } : false;
}

const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }

  if (pathname === '/healthz') {
    try {
      sqlite.check.get();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ ok: true, capacity }));
    } catch {
      res.writeHead(503).end();
    }
    return;
  }

  if (pathname === '/') pathname = '/index.html';
  if (/[\\:\0]/.test(pathname)) {
    res.writeHead(404).end();
    return;
  }
  const path = resolve(publicDir, `.${pathname}`);
  const mime = mimeTypes.get(extname(path).toLowerCase());
  if (!mime || !isInside(publicDir, path)) {
    res.writeHead(404).end();
    return;
  }

  try {
    const file = await stat(path);
    if (!file.isFile()) {
      res.writeHead(404).end();
      return;
    }
    const headers = { 'Content-Type': mime, 'Content-Length': file.size, 'Cache-Control': 'no-cache' };
    let range;
    if (mime.startsWith('audio/')) {
      headers['Accept-Ranges'] = 'bytes';
      if (req.method === 'GET') range = byteRange(req.headers.range, file.size);
      if (range === false) {
        res.writeHead(416, { 'Content-Range': `bytes */${file.size}` }).end();
        return;
      }
      if (range) {
        headers['Content-Range'] = `bytes ${range.start}-${range.end}/${file.size}`;
        headers['Content-Length'] = range.end - range.start + 1;
      }
    }
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD') res.end();
    else await pipeline(createReadStream(path, range || undefined), res);
  } catch {
    if (!res.headersSent) res.writeHead(404).end();
    else if (!res.destroyed) res.destroy();
  }
});

const room = new Map();
const presence = new WebSocketServer({ noServer: true, maxPayload: MAX_STATE_BYTES, perMessageDeflate: false });
let snapshotPending = false;

server.on('upgrade', (req, socket, head) => {
  if (req.url !== '/presence') {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return;
  }

  try {
    const origin = new URL(req.headers.origin);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host?.toLowerCase()) {
      throw new Error('Cross-origin connection');
    }
  } catch {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }

  presence.handleUpgrade(req, socket, head, ws => presence.emit('connection', ws));
});

presence.on('connection', socket => {
  socket.on('error', () => socket.terminate());
  if (room.size >= capacity) {
    send(socket, JSON.stringify({ type: 'full' }));
    socket.close(1013, 'Room full');
    return;
  }

  const peer = { id: randomUUID(), alive: true, lastMessageAt: 0, state: null };
  room.set(socket, peer);
  send(socket, JSON.stringify({ type: 'welcome', id: peer.id, capacity }));

  const handshake = setTimeout(() => socket.close(1008, 'State required'), 10000);
  socket.on('pong', () => { peer.alive = true; });
  socket.on('close', () => {
    clearTimeout(handshake);
    room.delete(socket);
    snapshotPending = true;
  });
  socket.on('message', (raw, binary) => {
    const now = Date.now();
    if (binary || now - peer.lastMessageAt < 40) return;
    peer.lastMessageAt = now;

    const input = parsePresenceState(raw.toString());
    if (!input) return;
    if (!peer.state) {
      try {
        sqlite.record.run();
      } catch (error) {
        console.error('Unable to record a visit:', error.message);
        socket.close(1011, 'Visit log unavailable');
        return;
      }
      clearTimeout(handshake);
    }

    peer.state = { id: peer.id, ...input };
    snapshotPending = true;
  });
});

const snapshots = setInterval(() => {
  if (!snapshotPending) return;
  snapshotPending = false;
  const players = [...room.values()].flatMap(peer => peer.state ? [peer.state] : []);
  const message = JSON.stringify({ type: 'snapshot', players });
  for (const socket of room.keys()) send(socket, message);
}, 67);

const heartbeat = setInterval(() => {
  for (const [socket, peer] of room) {
    if (!peer.alive) socket.terminate();
    else if (socket.readyState === WebSocket.OPEN) {
      peer.alive = false;
      socket.ping();
    }
  }
}, 15000);

function stop() {
  clearInterval(snapshots);
  clearInterval(heartbeat);
  for (const socket of presence.clients) socket.terminate();
  presence.close();
  server.close(() => sqlite.db.close());
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
server.listen(port, host, () => {
  const address = server.address();
  const label = address.family === 'IPv6' ? `[${address.address}]` : address.address;
  console.log(`Gonggang at http://${label}:${address.port}`);
});

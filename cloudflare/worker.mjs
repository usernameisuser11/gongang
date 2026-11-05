import { DurableObject } from 'cloudflare:workers';
import { parsePresenceState, ROOM_CAPACITY } from '../shared/presence-state.mjs';

const handshakeMs = 12000;
const roomName = 'gonggang-main';

function reply(message, status, extraHeaders = {}) {
  return new Response(message, { status, headers: { 'Cache-Control': 'no-store', ...extraHeaders } });
}

async function visitHealth(database) {
  if (!database) return 'not_configured';
  try {
    await database.prepare('SELECT visit_id FROM visits LIMIT 1').first();
    return 'ready';
  } catch {
    return 'unavailable';
  }
}

async function recordVisit(database, visitId, visitedAt) {
  if (!database) return;
  const insert = () => database.prepare(
    'INSERT INTO visits (visit_id, visited_at) VALUES (?, ?) ON CONFLICT (visit_id) DO NOTHING'
  ).bind(visitId, visitedAt).run();
  try {
    await insert();
  } catch (error) {
    const transient = /network connection lost|storage caused object to be reset|reset because its code was updated|temporarily overloaded/i.test(String(error));
    if (transient) {
      try {
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 100));
        await insert();
        return;
      } catch {
        // The same visit ID makes an ambiguous successful first write safe to retry.
      }
    }
    console.error('Unable to record a presence visit in D1');
  }
}

function send(socket, message) {
  if (socket.readyState !== WebSocket.OPEN) return;
  try {
    if (socket.bufferedAmount > 65536) socket.close(1013, 'Client is too slow');
    else socket.send(message);
  } catch {
    socket.close(1011, 'Presence unavailable');
  }
}

function sameState(previous, state) {
  return previous && Object.keys(state).every(key => previous[key] === state[key]);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return reply(null, 405, { Allow: 'GET, HEAD' });
      }
      const visits = await visitHealth(env.VISITS);
      const ready = visits === 'ready';
      const body = JSON.stringify({ ok: ready, capacity: ROOM_CAPACITY, storage: 'd1', visits });
      return reply(request.method === 'HEAD' ? null : body, ready ? 200 : 503, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    }
    if (url.pathname === '/presence') {
      if (request.method !== 'GET') return reply(null, 405, { Allow: 'GET' });
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return reply('Expected WebSocket', 426);
      if (request.headers.get('Origin') !== url.origin) return reply('Forbidden', 403);
      return env.PRESENCE_ROOM.getByName(roomName).fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};

export class PresenceRoom extends DurableObject {
  #lastMessage = new WeakMap();

  async fetch() {
    const [client, server] = Object.values(new WebSocketPair());
    if (this.#reservations().count >= ROOM_CAPACITY) {
      server.accept();
      send(server, JSON.stringify({ type: 'full' }));
      server.close(1013, 'Room full');
    } else {
      const id = crypto.randomUUID();
      const expiresAt = Date.now() + handshakeMs;
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ id, visitId: crypto.randomUUID(), expiresAt, state: null });
      await this.#scheduleAlarm(expiresAt);
      send(server, JSON.stringify({ type: 'welcome', id, capacity: ROOM_CAPACITY }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket, message) {
    const now = Date.now();
    if (socket.readyState !== WebSocket.OPEN || now - (this.#lastMessage.get(socket) ?? 0) < 40) return;
    this.#lastMessage.set(socket, now);
    const state = parsePresenceState(message);
    const peer = socket.deserializeAttachment();
    if (!state || !peer) return;

    if (peer.state) {
      if (sameState(peer.state, state)) return;
      socket.serializeAttachment({ ...peer, state });
      this.#broadcast();
      return;
    }

    if (now >= peer.expiresAt) {
      socket.close(1008, 'State required');
      return;
    }

    socket.serializeAttachment({ ...peer, state });
    this.#broadcast();
    this.ctx.waitUntil(recordVisit(this.env.VISITS, peer.visitId, new Date(now).toISOString()));
  }

  webSocketClose(socket) {
    this.#broadcast(socket);
  }

  webSocketError(socket) {
    if (socket.readyState === WebSocket.OPEN) socket.close(1011, 'Presence unavailable');
    this.#broadcast(socket);
  }

  async alarm() {
    const { next } = this.#reservations();
    if (Number.isFinite(next)) await this.ctx.storage.setAlarm(next);
  }

  #reservations() {
    const now = Date.now();
    let count = 0;
    let next = Infinity;
    for (const socket of this.#openSockets()) {
      const peer = socket.deserializeAttachment();
      if (!peer || (!peer.state && peer.expiresAt <= now)) {
        socket.close(1008, 'State required');
      } else {
        count++;
        if (!peer.state) next = Math.min(next, peer.expiresAt);
      }
    }
    return { count, next };
  }

  async #scheduleAlarm(at) {
    const current = await this.ctx.storage.getAlarm();
    if (current === null || at < current) await this.ctx.storage.setAlarm(at);
  }

  #openSockets(excluded) {
    return this.ctx.getWebSockets().filter(socket => socket !== excluded && socket.readyState === WebSocket.OPEN);
  }

  #broadcast(excluded) {
    const sockets = this.#openSockets(excluded);
    const players = [];
    for (const socket of sockets) {
      const peer = socket.deserializeAttachment();
      if (peer?.state) players.push({ id: peer.id, ...peer.state });
    }
    const message = JSON.stringify({ type: 'snapshot', players });
    for (const socket of sockets) send(socket, message);
  }
}

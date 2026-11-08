import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

function waitForPort(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Local server did not start')), 10000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const port = /Gonggang at http:\/\/127\.0\.0\.1:(\d+)/.exec(output)?.[1];
      if (port) {
        clearTimeout(timer);
        resolve(Number(port));
      }
    });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Local server exited before startup: ${code}`));
    });
    child.stderr.on('data', chunk => {
      output += chunk;
    });
  });
}

function state(pose, gesture = 0) {
  return JSON.stringify({ type: 'state', x: 0, z: 0, yaw: 0, pose, gesture, signal: 0 });
}

test('rapid greeting or seat action is not lost behind a movement packet', { timeout: 20000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'gongang-presence-'));
  const child = spawn(process.execPath, ['server.mjs'], {
    env: {
      ...process.env,
      PORT: '0',
      BARAMUI_HOST: '127.0.0.1',
      BARAMUI_DB_PATH: join(directory, 'visits.sqlite'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let socket;
  t.after(async () => {
    socket?.terminate();
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        once(child, 'exit').catch(() => {}),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);
    }
    await rm(directory, { recursive: true, force: true });
  });

  const port = await waitForPort(child);
  socket = new WebSocket(`ws://127.0.0.1:${port}/presence?map=campus`, {
    headers: { Origin: `http://127.0.0.1:${port}` },
  });
  await once(socket, 'open');

  const matchingSnapshot = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Updated action was never broadcast')), 5000);
    socket.on('message', raw => {
      let packet;
      try { packet = JSON.parse(raw.toString()); } catch { return; }
      const player = packet.type === 'snapshot' && packet.players?.[0];
      if (player?.pose === 'sit' && player.gesture === 1) {
        clearTimeout(timer);
        resolve(player);
      }
    });
  });

  // Both states arrive within the server's regular 40ms position throttle.
  socket.send(state('walk', 0));
  socket.send(state('sit', 1));
  const player = await matchingSnapshot;
  assert.equal(player.pose, 'sit');
  assert.equal(player.gesture, 1);
});

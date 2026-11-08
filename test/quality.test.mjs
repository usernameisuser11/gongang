import test from 'node:test';
import assert from 'node:assert/strict';
import { createResolutionController } from '../public/render-quality.js';
import { parsePresenceState, ROOM_CAPACITY } from '../shared/presence-state.mjs';

function sampleFrames(controller, fps, count) {
  const changes = [];
  for (let i = 0; i < count; i++) {
    const changed = controller.sample(1 / fps);
    if (changed !== null) changes.push(changed);
  }
  return changes;
}

test('adaptive resolution responds to sustained poor frame rate', () => {
  const controller = createResolutionController();
  assert.equal(controller.scale, 1);
  assert.equal(sampleFrames(controller, 20, 120)[0], 0.88);
  assert.equal(controller.scale, 0.88);
  sampleFrames(controller, 20, 800);
  assert.equal(controller.scale, 0.7);
});

test('adaptive resolution recovers slowly after smooth rendering', () => {
  const controller = createResolutionController();
  sampleFrames(controller, 20, 120);
  assert.equal(controller.scale, 0.88);
  assert.equal(sampleFrames(controller, 60, 650)[0], 0.94);
  assert.equal(controller.scale, 0.94);
  controller.reset();
  assert.equal(controller.scale, 0.94);
});

test('invalid and paused frame durations are ignored', () => {
  const controller = createResolutionController();
  assert.equal(controller.sample(NaN), null);
  assert.equal(controller.sample(-1), null);
  assert.equal(controller.sample(10), null);
  assert.equal(controller.scale, 1);
});

test('presence parser accepts a normal traveler state and preserves 8-person capacity', () => {
  assert.equal(ROOM_CAPACITY, 8);
  const input = { type: 'state', x: 1.5, z: -4, yaw: Math.PI, pose: 'sit', gesture: 2, signal: 1 };
  assert.deepEqual(parsePresenceState(JSON.stringify(input)), {
    x: 1.5, z: -4, yaw: Math.PI, pose: 'sit', gesture: 2, signal: 1,
  });
});

test('presence parser rejects malformed, oversized, and impossible positions', () => {
  assert.equal(parsePresenceState('{not json'), null);
  assert.equal(parsePresenceState(' '.repeat(1025)), null);
  assert.equal(parsePresenceState(JSON.stringify({ type: 'state', x: 20000, z: 0, yaw: 0, pose: 'walk' })), null);
  assert.equal(parsePresenceState(JSON.stringify({ type: 'state', x: 0, z: 0, yaw: 0, pose: 'fly' })), null);
});

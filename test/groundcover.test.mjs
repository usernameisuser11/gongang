import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleGroundCover } from '../public/groundcover.js';

test('micro vegetation placement is deterministic for reproducible maps', () => {
  const config = { seed: 8313, count: 120, bounds: [-10,-12,10,14], allow: (x,z) => x > 0 && z < 10 };
  const first = sampleGroundCover(config);
  const second = sampleGroundCover(config);
  assert.deepEqual(first, second);
  assert.equal(first.length, 120);
  assert.ok(first.every(p => p.x > 0 && p.z < 10 && p.x <= 10 && p.z >= -12));
});

test('ground cover stays inside specified world borders and can leave a clearing', () => {
  const patches = sampleGroundCover({
    seed: 1832,count:500,bounds:[-12,-15,12,15],
    allow:(x,z)=> Math.hypot(x,z)>4
  });
  assert.equal(patches.length,500);
  assert.ok(patches.every(p => Math.hypot(p.x,p.z)>4 && p.tint>=0 && p.tint<1));
});

test('no plant instances are created if terrain is fully excluded', () => {
  const patches = sampleGroundCover({
    seed: 12,count:500,bounds:[0,0,1,1],allow:()=>false
  });
  assert.equal(patches.length,0);
});

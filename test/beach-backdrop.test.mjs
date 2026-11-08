import test from 'node:test';
import assert from 'node:assert/strict';
import { LANDMASSES, backdropHeight } from '../public/beach-backdrop.js';

test('beach horizon has a west headland and staggered distant islands', () => {
  assert.equal(LANDMASSES.length, 4);
  assert.equal(LANDMASSES[0].id, 'western-headland');
  assert.ok(LANDMASSES[0].x < -180);
  assert.ok(LANDMASSES.slice(1).every(island => island.z < -400));
  assert.ok(new Set(LANDMASSES.map(({ z }) => z)).size > 2);
});

test('all landmasses have high central ridges and submerged outer shelves', () => {
  for (const island of LANDMASSES) {
    const summit = backdropHeight(island, 0, 0);
    assert.ok(Number.isFinite(summit) && summit > 6, island.id + ' has a raised landform');
    for (const [u, v] of [[1.12, 0], [-1.12, 0], [0, 1.11], [0, -1.11]]) {
      assert.ok(backdropHeight(island, u, v) < 0, island.id + ' coastline submerges');
    }
  }
});

test('island heightfields are finite and vary naturally', () => {
  for (const island of LANDMASSES) {
    const samples = [];
    for (let u = -.9; u <= .9; u += .3) {
      for (let v = -.9; v <= .9; v += .3) {
        const value = backdropHeight(island, u, v);
        assert.ok(Number.isFinite(value));
        samples.push(value);
      }
    }
    assert.ok(Math.max(...samples) - Math.min(...samples) > island.peak * .4);
  }
});

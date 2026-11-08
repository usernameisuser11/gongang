import { fbm, noise, rng, smooth } from './nature.js';

// All land is outside the walkable beach. Soft atmospheric fog and actual
// geometry create depth without loading giant photographic background images.
export const LANDMASSES = Object.freeze([
  // An asymmetrical wooded headland frames the LEFT edge of the beach view.
  { id: 'western-headland', x: -273, z: -318, rx: 158, rz: 116, peak: 55, seed: 1.7 },
  // Small, faraway rock islands break up the otherwise vacant horizon.
  { id: 'distant-islet', x: -24, z: -515, rx: 52, rz: 62, peak: 20, seed: 5.2 },
  { id: 'eastern-island', x: 166, z: -573, rx: 77, rz: 91, peak: 29, seed: 9.5 },
  { id: 'far-horizon', x: 330, z: -790, rx: 110, rz: 90, peak: 20, seed: 12.3 },
]);

const gaussian = (u, v, x, z, sx, sz) => {
  const dx = (u - x) / sx;
  const dz = (v - z) / sz;
  return Math.exp(-dx * dx - dz * dz);
};

// Height includes a submerged shelf that avoids a floating-island silhouette.
// The broad ridges intentionally differ per island so this is not a row of cones.
export function backdropHeight(island, u, v) {
  const warp = (fbm(u * 2.1 + island.seed, v * 2.3 - island.seed) - .5) * .13
    + .055 * Math.sin(v * 8.1 + island.seed * 3.3);
  const radius = Math.hypot(u + warp, v * .97 + warp * .36);
  const coast = 1 - smooth(.72, 1.055, radius);
  const first = gaussian(u, v, -.24, -.08, .38, .52);
  const second = gaussian(u, v, .22, .17, .49, .38);
  const third = gaussian(u, v, -.11, .48, .27, .31);
  const ridge = .13 + .77 * first + .52 * second + .32 * third;
  const irregularity = (.13 * (fbm(u * 8.3 + island.seed, v * 7.5) - .5)
    + .041 * Math.sin(u * 23. + v * 11. + island.seed)) * island.peak;
  return -3.5 + coast * (island.peak * ridge + irregularity);
}

function makeLandmass(T, island, compact) {
  const columns = compact ? 48 : 72;
  const rows = compact ? 36 : 52;
  const positions = [], colors = [], indices = [];
  const slate = new T.Color('#76746c');
  const rock = new T.Color('#817d73');
  const brush = new T.Color('#4c6257');
  const canopy = new T.Color('#65715a');
  const color = new T.Color();
  for (let j = 0; j < rows; j++) {
    const v = -1.11 + j * 2.22 / (rows - 1);
    for (let i = 0; i < columns; i++) {
      const u = -1.12 + i * 2.24 / (columns - 1);
      const x = island.x + island.rx * u;
      const z = island.z + island.rz * v;
      const y = backdropHeight(island, u, v);
      positions.push(x, y, z);
      const roughness = fbm(u * 14 + island.seed * 3, v * 13 + 9.1);
      const rocky = Math.max(0, Math.min(1, .30 + .55 * roughness + y / island.peak * .28));
      color.copy(slate).lerp(rock, rocky * .65);
      const growth = smooth(.4, 5.5, y) * (.32 + .5 * roughness);
      color.lerp(brush, growth);
      color.lerp(canopy, growth * .2 + (.14 * noise(u * 43, v * 29)));
      // Gentle vertical rock striation reads as weathered coastline at a distance.
      const strata = .94 + .065 * Math.sin(y * .67 + roughness * 5.4);
      color.multiplyScalar(strata);
      colors.push(color.r, color.g, color.b);
      if (i < columns - 1 && j < rows - 1) {
        const a = j * columns + i, b = a + columns;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new T.MeshLambertMaterial({
    vertexColors: true, side: T.DoubleSide, fog: true,
  });
  const terrain = new T.Mesh(geometry, material);
  terrain.castShadow = false;
  terrain.receiveShadow = false;
  terrain.name = 'beach-backdrop-' + island.id;
  return terrain;
}

function makeForest(T, island, compact, geometry, material) {
  // Forest crowns break up ridge silhouettes into small irregular clumps.
  // One instance batch per island keeps them inexpensive on mobile.
  const random = rng(Math.floor(island.seed * 9117));
  const count = (island.id === 'western-headland' ? 175 : 72);
  const samples = [];
  for (let attempt = 0; attempt < count * 8 && samples.length < (compact ? Math.ceil(count * .57) : count); attempt++) {
    const u = (random() - .5) * 1.72;
    const v = (random() - .5) * 1.72;
    const h = backdropHeight(island, u, v);
    if (h < 5.5) continue;
    const diameter = (island.id === 'western-headland' ? 1.5 : 1.25)
      + random() * (island.id === 'western-headland' ? 3.4 : 2.6);
    samples.push({
      x: island.x + island.rx * u,
      y: h + diameter * .10,
      z: island.z + island.rz * v,
      diameter,
      green: random(),
    });
  }
  if (!samples.length) return null;
  const forest = new T.InstancedMesh(geometry, material, samples.length);
  const transform = new T.Object3D(), color = new T.Color();
  const darkGreen = new T.Color('#354d43'), paleGreen = new T.Color('#6e7860');
  samples.forEach((sample, index) => {
    transform.position.set(sample.x, sample.y, sample.z);
    transform.rotation.set(.07 * sample.green, sample.green * 6.28, 0);
    transform.scale.set(sample.diameter * 1.17, sample.diameter * .48, sample.diameter);
    transform.updateMatrix();
    forest.setMatrixAt(index, transform.matrix);
    color.copy(darkGreen).lerp(paleGreen, sample.green * .67);
    forest.setColorAt(index, color);
  });
  forest.instanceMatrix.needsUpdate = true;
  if (forest.instanceColor) forest.instanceColor.needsUpdate = true;
  forest.computeBoundingSphere();
  forest.castShadow = false;
  forest.receiveShadow = false;
  forest.name = 'beach-forest-' + island.id;
  return forest;
}

export function makeBeachBackdrop(T, scene, compact = false) {
  const foliageGeometry = new T.IcosahedronGeometry(1, 1);
  const foliageMaterial = new T.MeshLambertMaterial({ color: '#ffffff', fog: true });
  const meshes = [];
  for (const island of LANDMASSES) {
    const landmass = makeLandmass(T, island, compact);
    const trees = makeForest(T, island, compact, foliageGeometry, foliageMaterial);
    scene.add(landmass);
    meshes.push(landmass);
    if (trees) { scene.add(trees); meshes.push(trees); }
  }
  return meshes;
}

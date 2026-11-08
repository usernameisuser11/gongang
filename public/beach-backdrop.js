import { fbm, noise, shaderNoise, smooth } from './nature.js';

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
  // Per-pixel geological variation is subtler than discrete circular tree
  // clusters in a distant silhouette, and scales gracefully to mobile.
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 islandPoint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nislandPoint = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 islandPoint;\n' + shaderNoise)
      .replace('#include <color_fragment>', [
        '#include <color_fragment>',
        'float weathering = n2(islandPoint.xz * .095);',
        'float strata = sin(islandPoint.y * 1.35 + n2(islandPoint.xz * .038) * 5.);',
        'diffuseColor.rgb *= .85 + weathering * .24 + strata * .035;'
      ].join('\n'));
  };
  const terrain = new T.Mesh(geometry, material);
  terrain.castShadow = false;
  terrain.receiveShadow = false;
  terrain.name = 'beach-backdrop-' + island.id;
  return terrain;
}

export function makeBeachBackdrop(T, scene, compact = false) {
  const terrain = LANDMASSES.map(island => makeLandmass(T, island, compact));
  for (const island of terrain) scene.add(island);
  return terrain;
}

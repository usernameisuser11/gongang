import { rng } from './nature.js';

// Reusable foreground micro-vegetation for the campus lawn, shore dunes and
// roadside banks. All blades are drawn in one instanced draw call per world.
export function sampleGroundCover({ seed = 1, count, bounds, allow = () => true }) {
  const random = rng(seed);
  const [minX, minZ, maxX, maxZ] = bounds;
  const samples = [];
  for (let attempt = 0; samples.length < count && attempt < count * 18; attempt++) {
    const x = minX + (maxX - minX) * random();
    const z = minZ + (maxZ - minZ) * random();
    if (allow(x, z)) samples.push({ x, z, angle: random() * Math.PI * 2,
      size: .68 + random() * .87, tint: random() });
  }
  return samples;
}

function tuftGeometry(THREE) {
  const positions = [], indices = [];
  // Four crossed, tapered blades with an offset tip. No textures or alpha
  // overdraw; the silhouettes remain readable near the camera.
  for (let blade = 0; blade < 4; blade++) {
    const a = blade * Math.PI / 2 + .21;
    const cx = Math.cos(a), cz = Math.sin(a);
    const sx = -cz, sz = cx, offset = positions.length / 3;
    const width = .075 + .019 * (blade % 2);
    const height = .64 + .12 * (blade % 3);
    const bend = .12 + .035 * blade;
    for (const [across, y, forward] of [
      [-width, 0, 0], [width, 0, 0],
      [-width * .45, height * .62, bend * .43],
      [width * .45, height * .62, bend * .43],
      [0, height, bend],
    ]) {
      positions.push(sx * across + cx * forward, y, sz * across + cz * forward);
    }
    indices.push(offset,offset+1,offset+2,
      offset+1,offset+3,offset+2,offset+2,offset+3,offset+4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function addGroundCover(THREE, scene, {
  seed, count, bounds, allow, heightAt, colors = ['#7a8859','#a5a77c'],
}) {
  const samples = sampleGroundCover({seed,count,bounds,allow});
  if (!samples.length) return null;
  const geo = tuftGeometry(THREE);
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo,mat,samples.length);
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  const palette = colors.map(value=>new THREE.Color(value));
  for (let i=0;i<samples.length;i++) {
    const {x,z,angle,size,tint}=samples[i];
    transform.position.set(x,heightAt(x,z)+.012,z);
    transform.rotation.set(0,angle,0);
    transform.scale.set(size, .38 + .31 * size, size);
    transform.updateMatrix();
    mesh.setMatrixAt(i,transform.matrix);
    color.copy(palette[Math.min(palette.length-1, Math.floor(tint * palette.length))]);
    mesh.setColorAt(i,color);
  }
  mesh.instanceMatrix.needsUpdate=true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
  mesh.castShadow=false;
  mesh.receiveShadow=false;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  return mesh;
}

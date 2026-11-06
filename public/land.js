import * as T from 'three';
import { fbm, noise, rng, smooth, shaderNoise } from './nature.js';

export const pathX = z => -8.5 - 5.3 * Math.exp(-(((z - 3) / 16) ** 2)) + 15.5 * Math.exp(-(((z + 26) / 15) ** 2));
export const treePosition = { x:-4.0, z:-15.4 };
export const westEdge = z => -25 + 4.8 * Math.sin(z * .092 + .35) + 2.2 * Math.sin(z * .23)
  - 13 * Math.exp(-(((z + 37) / 13) ** 2)) + .8 * Math.sin(z * .63);
export function coastDistance(x, z) {
  return Math.min(x - westEdge(z), (z + 51 + 4 * Math.sin(x * .13) + 2 * Math.sin(x * .31)) * .88);
}
export function heightAt(x, z) {
  const d = coastDistance(x, z);
  const hill = 4.7 * Math.exp(-(((x - 17) / 28) ** 2 + ((z + 24) / 27) ** 2))
    + 8.3 * Math.exp(-(((x - 48) / 32) ** 2 + ((z + 1) / 41) ** 2));
  const meadow = 9.3 + hill + 1.45 * Math.sin(z * .083 - .6) + 1.2 * Math.cos(x * .105 + z * .045)
    + (fbm(x * .087, z * .087) - .5) * 2.2;
  const rock = (fbm(x * .43, z * .27) - .5) * 2.1 + .45 * Math.sin(z * 1.23);
  const profile = smooth(-3.2, 1.8, d) * .78 + smooth(-10, 1.7, d) * .22;
  return -4 + (meadow + 4) * profile + rock * (1 - smooth(-1.2, 3, d));
}
// Walkable space follows the rendered terrain rather than the grass placement area.
// A coast buffer prevents walking over the steep cliff or off the mesh.
export const canWalk = (x, z) => x > -59 && x < 70 && z > -65 && z < 59
  && coastDistance(x, z) > 2.4 && Math.hypot(x-treePosition.x,z-treePosition.z) > .88;

function landMaterial() {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  m.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 landscapePosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n landscapePosition = position;');
    shader.fragmentShader = 'varying vec3 landscapePosition;\n' + shaderNoise + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 p = landscapePosition;
      float speckle = n2(p.xz*12.0)*.55 + n2(p.xz*3.0)*.45;
      float brushing = n2(p.xz*vec2(1.7,.67));
      float stratum = sin(p.y*7.5 + p.z*.23 + n2(p.xz*.47)*2.0)*.08;
      float stone = smoothstep(.12,.65,1.0-abs(normalize(cross(dFdx(p),dFdy(p))).y));
      diffuseColor.rgb *= .73 + speckle*.31 + brushing*.28 + stratum*stone;
    `);
  };
  return m;
}

export function makeLand(scene) {
  const positions = [], colors = [], index = [];
  const moss = new T.Color('#4f6138'), newGrowth = new T.Color('#899651'), darkMoss = new T.Color('#304b3f');
  const dirt = new T.Color('#8c6e58'), clay = new T.Color('#ac865e'), rockA = new T.Color('#5d514b');
  const rockB = new T.Color('#ab9178'), algae = new T.Color('#4b645b');
  const c = new T.Color(), ground = new T.Color(), stone = new T.Color();
  const NX = 233, NZ = 222;
  for (let j = 0; j < NZ; j++) {
    const z = -77 + j * .656;
    for (let i = 0; i < NX; i++) {
      const x = -66 + i * .624;
      const y = heightAt(x, z), d = coastDistance(x, z);
      const grain = fbm(x * .12, z * .12), field = fbm(x * .034 + 45, z * .039);
      const slope = Math.hypot(heightAt(x + .26, z) - heightAt(x - .26, z),
        heightAt(x, z + .26) - heightAt(x, z - .26)) / .52;
      ground.copy(darkMoss).lerp(moss, smooth(.19,.59,field)).lerp(newGrowth, smooth(.43,.77,grain) * .82);
      const wander = (noise(x * .8 + 13, z * .7) - .5) * .77;
      const path = (1 - smooth(.74, 1.88, Math.abs(x - pathX(z) + wander))) * smooth(-36, -23, z);
      ground.lerp(dirt, path * .91).lerp(clay, path * smooth(.27,.72,grain) * .64);
      const layers = .53 + .27 * Math.sin(y * 2.18 + z * .14 + grain * 1.8) + .20 * Math.sin(y * .74 - z * .08);
      stone.copy(rockA).lerp(rockB, layers).lerp(algae, (1 - smooth(.5, 5.9, y)) * .64);
      const cliff = (1 - smooth(.4, 2.35, d)) * .53 + smooth(.56, 1.7, slope) * .47;
      const treeShade = Math.exp(-(((x - treePosition.x - 1.5 - (z + 11) * .37) / 5.3) ** 2
        + ((z - treePosition.z - 7) / 8) ** 2)) * .39;
      c.copy(ground).lerp(stone, Math.min(1,cliff * 1.27)).multiplyScalar(1 - treeShade);
      positions.push(x, y, z); colors.push(c.r, c.g, c.b);
      if (i < NX - 1 && j < NZ - 1) {
        const a = i + j * NX, b = a + NX;
        index.push(a,b,a+1,a+1,b,b+1);
      }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colors,3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const surface = new T.Mesh(geo, landMaterial());
  scene.add(surface);
  return {
    heightAt, canWalk,
    pick(raycaster) {
      return raycaster.intersectObject(surface, false)[0]?.point ?? null;
    }
  };
}

function cliffSpurs(scene,random) {
  const positions=[], colors=[];
  const ochre=new T.Color('#917862'), violet=new T.Color('#51464b'), cream=new T.Color('#aa9986');
  const base=new T.Color(), tone=new T.Color();
  const levels=[0,.09,.24,.38,.41,.64,.72,.9,1];
  const sides=8;
  for(let spur=0;spur<28;spur++){
    const z0=-44+spur*2.92+(random()-.5)*2.9;
    const x0=westEdge(z0);
    const top=heightAt(x0+1.2,z0)-(.57+random()*2.2);
    const wide=.74+random()*1.16;
    const slope=(westEdge(z0+.3)-westEdge(z0-.3))/.6;
    const xLean=random()*.65;
    const rough=Array.from({length:sides},()=>.8+random()*.39);
    const rings=levels.map((t,j)=>{
      const y=-.75+(top+.75)*t;
      const center=x0-3.8+3.67*t+xLean*Math.sin(t*3.5+spur);
      const radius=wide*(1.24-.52*t)*(j===levels.length-1?.53:1);
      return Array.from({length:sides},(_,i)=>{
        const a=(i/sides)*Math.PI*2;
        const side=Math.sin(a)*radius*rough[i];
        return [center+Math.cos(a)*radius*.67+slope*side,
          y+.30*Math.sin(a*1.2+spur)*Math.sin(Math.PI*t),z0+side];
      });
    });
    for(let j=0;j<rings.length-1;j++) {
      const layer=.36+.27*Math.sin(j*1.25+z0*.12)+.22*noise(z0*.08,j*.55);
      base.copy(violet).lerp(ochre,layer).lerp(cream,j===3?.29:.04);
      for(let i=0;i<sides;i++){
        const next=(i+1)%sides;
        tone.copy(base).multiplyScalar(.83+.32*rough[i]);
        for(const v of [rings[j][i],rings[j+1][i],rings[j][next],rings[j][next],rings[j+1][i],rings[j+1][next]]){
          positions.push(...v); colors.push(tone.r,tone.g,tone.b);
        }
      }
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();
  scene.add(new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:1})));
}

export function makeFarCoast(scene) {
  const islands = [
    { x: -175, z: -284, w: 122, d: 37, h: 36, seed: 5, hue: '#7f8582' },
    { x: -257, z: -321, w: 124, d: 26, h: 25, seed: 18, hue: '#898c90' },
    { x: -84, z: -201, w: 68, d: 27, h: 24, seed: 2, hue: '#626e67' },
    { x: 43, z: -296, w: 120, d: 49, h: 41, seed: 56, hue: '#737d82' },
    { x: -131, z: -135, w: 24, d: 7, h: 7, seed: 15, hue: '#676e66' }
  ];
  for (const { x,z,w,d,h,seed,hue } of islands) {
    const geometry = new T.PlaneGeometry(2,2,74,27).rotateX(-Math.PI / 2);
    const vertices = geometry.attributes.position;
    const colors = [], base = new T.Color(hue), tint = new T.Color();
    for (let i = 0; i < vertices.count; i++) {
      const u = vertices.getX(i), v = vertices.getZ(i);
      const contour = 1 - Math.pow(Math.abs(u), 1.83) - Math.pow(Math.abs(v * 1.05), 1.48);
      const ridges = .3 + .57 * fbm(u * 2.4 + seed, v * 2.8) + .13 * Math.sin(u * 9 + seed);
      const elevation = h * Math.max(0, contour + .17 * Math.sin(u*6+v*3)) ** .77 * ridges - 1.7;
      vertices.setXYZ(i, x + u*w + v*w*.26, elevation, z + v*d - u*d*.25);
      tint.copy(base).multiplyScalar(.83 + .35 * fbm(u*12+seed,v*6) + .09 * smooth(0, h*.5, elevation));
      colors.push(tint.r,tint.g,tint.b);
    }
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    scene.add(new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1})));
  }

  const random = rng(145);
  cliffSpurs(scene,rng(334));
  const rockGeometry = new T.IcosahedronGeometry(1, 1);
  const verts = rockGeometry.attributes.position;
  for (let i = 0; i < verts.count; i++) {
    const x = verts.getX(i), y = verts.getY(i), z = verts.getZ(i);
    const chip = .84 + .3 * noise(x*4+6,y*3+z*2);
    verts.setXYZ(i,x*chip,y*chip,z*chip);
  }
  rockGeometry.computeVertexNormals();
  const n = 96, rocks = new T.InstancedMesh(rockGeometry, new T.MeshStandardMaterial({ roughness:.97 }),n);
  const obj = new T.Object3D(), color = new T.Color();
  const rockColors = ['#63584a','#8a7967','#736554','#98826a','#59624d'];
  for(let i=0;i<n;i++) {
    const z = -46 + random()*94, off = i < 58 ? -9 + random()*7 : 3 + random()*31;
    const x = westEdge(z) + off;
    const y = heightAt(x,z), size = i < 58 ? .52 + random()*2.3 : .21 + random()*.78;
    obj.position.set(x,Math.max(y,-.65) - size*.12,z);
    obj.rotation.set(random()*.57,random()*6.28,random()*.55);
    obj.scale.set(size*(1.15+random()*.55), size*(.59+random()*.63), size*(.71+random()*.45));
    obj.updateMatrix();
    rocks.setMatrixAt(i,obj.matrix);
    rocks.setColorAt(i,color.set(rockColors[Math.floor(random()*rockColors.length)]));
  }
  scene.add(rocks);
}

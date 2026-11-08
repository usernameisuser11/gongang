import * as T from 'three';
import { rng, fbm, noise, shaderNoise, smooth } from './nature.js';

// The lawn between Sangmyung's College of Education and Academic Information Center.
// The central court stays clear between the planted edges and academic wings.
const pineSites = [
  [-14.5,9.5,4.4], [-15.3,-8.3,5.5], [-15.8,-25.1,5.6],
  [15.1,9.0,4.8], [15.8,-7.3,5.3], [15.4,-21.1,6.4],
  [-8.2,-30.4,5.8], [4.7,-31.1,6.7]
];
const deciduousSites = [[-30.5,13.2,8.3],[27.5,11.0,8.9],[-32.2,-18.5,10.2],[31.5,-24.3,9.4],[14.2,-32.8,10.0]];
const benches = [
  [-12.7,5.4,Math.PI/2], [13.2,4.0,-Math.PI/2],
  [-13.2,-18.0,Math.PI/2]
];
// Seat location matches the actual planks and backrest, not the collision box.
// The exit point is on the open side of each bench so players can walk away.
const benchSeats = benches.map(([x,z,yaw],id)=>({
  id, x:x-Math.sin(yaw)*.12, z:z-Math.cos(yaw)*.12, yaw,
  height:.43,
  exitX:x-Math.sin(yaw)*1.60, exitZ:z-Math.cos(yaw)*1.60
}));
function seatAt(x,z) {
  return benchSeats.find(seat => Math.hypot(x-seat.x,z-seat.z) < .35) ?? null;
}
const railRuns = [[-35,-7.6],[7.6,35]];
// Approximate footprints traced from the aerial image, in court coordinates.
const education = {x:-22.7,z:-10.2,yaw:.15,halfWidth:5.2,halfLength:18.6};
const library = {x:24.4,z:-12.4,yaw:.09,halfWidth:9.3,halfLength:20.8};
const C = (hex) => new T.Color(hex);
const mat = (color, extra={}) => new T.MeshStandardMaterial({color,roughness:.94,...extra});
const brick = mat('#987269');
const brickLight = mat('#b18e7e');
const cream = mat('#d9d0b8');
const white = mat('#d7dedb', {metalness:.06,roughness:.72});
const pale = mat('#b9c8c7', {metalness:.06,roughness:.65});
const dark = mat('#46505a', {metalness:.06,roughness:.65});
const glass = mat('#7fa6ae', {metalness:.17,roughness:.25});
const glassBlue = mat('#b2cdd1', {metalness:.06,roughness:.22});
const wood = mat('#625449');
const woodLight = mat('#7d6c5d');
const pathMat = mat('#c7b9a2');
const trunkMat = mat('#675347');
const unitBox = new T.BoxGeometry(1,1,1);
const unitBranch = new T.CylinderGeometry(.61,1,1,8);

function gardenRadius(x,z) {
  const taper=.94+.13*smooth(-26,12,z);
  const dx = (x - 1.1*Math.sin(z*.092))/ (13.9*taper);
  const dz = (z + 7.2 + .13*x)/20.8;
  return Math.pow(Math.pow(Math.abs(dx),3.1) + Math.pow(Math.abs(dz),3.1),1/3.1);
}
function gardenCover(x,z) {
  const edge=(noise(x*.73,z*.62)-.5)*.036;
  return 1-smooth(.94,1.03,gardenRadius(x,z)+edge);
}

const roadCenter = x => 20.2 + .047*x + 1.1*Math.sin((x-3)*.047);
const roadOffset = (x,z) => z-roadCenter(x);
const nearWalk = x => roadCenter(x)-5.9;

function heightAt(x,z) {
  const slope = .34 - .025*x + .018*(15-z);
  const uphill = smooth(22,58,-z)*3.4 + smooth(28,57,Math.abs(x))*1.4;
  const crown = (1-smooth(.51,1.23,gardenRadius(x,z)))*(.48+.18*fbm(x*.105+2,z*.12+8));
  const drainage = .085*(1-smooth(.3,4.6,Math.abs(roadOffset(x,z))));
  return slope + uphill + crown + drainage;
}

function insideBox(x,z,cx,cz,halfX,halfZ,pad=0) {
  return Math.abs(x-cx)<halfX+pad && Math.abs(z-cz)<halfZ+pad;
}
function insideBuilding(x,z,site) {
  const dx=x-site.x,dz=z-site.z;
  const sin=Math.sin(site.yaw),cos=Math.cos(site.yaw);
  return insideBox(dx*cos-dz*sin,dx*sin+dz*cos,0,0,site.halfWidth,site.halfLength,.6);
}
function canWalk(x,z) {
  if (Math.abs(x)>36 || z<-32 || z>39) return false;
  if (insideBuilding(x,z,education) || insideBuilding(x,z,library)) return false;
  for(const [bx,bz] of benches)if(insideBox(x,z,bx,bz,.53,1.10,.21))return false;
  if (Math.abs(z-nearWalk(x))<.38 && railRuns.some(([from,to])=>x>=from-.3 && x<=to+.3)) return false;
  for(const [tx,tz] of pineSites)if(Math.hypot(x-tx,z-tz)<.78)return false;
  for(const [tx,tz] of deciduousSites)if(Math.hypot(x-tx,z-tz)<.75)return false;
  return true;
}

function box(parent, material, x,y,z, w,h,d) {
  const m = new T.Mesh(unitBox,material);
  m.position.set(x,y,z);
  m.scale.set(w,h,d);
  m.castShadow = w>.24 && h>.48 && d>.19;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function terrain(scene,compact) {
  const steps = compact ? 115 : 163;
  const p=[],col=[],idx=[];
  const grassDark=C('#637346'),grassLight=C('#a49e64');
  const soil=C('#a49879'),paving=C('#a9a99d'),asphalt=C('#565d5d');
  const shadeTrees=[...pineSites,...deciduousSites];
  const shade=new T.Color();
  for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){
    const x=-57+i*114/(steps-1),z=-63+j*121/(steps-1);
    const y=heightAt(x,z), offset=Math.abs(roadOffset(x,z));
    const n=fbm(x*.17+21,z*.14+11),fine=noise(x*.93,z*1.26);
    const backBank=smooth(29,42,-z)*.94;
    const outerVerge=smooth(31,40,Math.abs(x))*(1-smooth(9,18,offset)*.35);
    const cover=Math.max(gardenCover(x,z),backBank,outerVerge);
    const planted=.12*fbm(x*.24-12,z*.41+4);
    shade.copy(paving).lerp(soil,.15+.25*n);
    shade.lerp(grassDark,cover);
    shade.lerp(grassLight,cover*(.24+.48*n+planted));
    shade.lerp(asphalt,1-smooth(4.3,4.67,offset));
    let occlusion=0;
    for(const [tx,tz,size] of shadeTrees){
      const dx=x-tx-size*.24, dz=z-tz-size*.30;
      if(Math.abs(dx)>size*.80 || Math.abs(dz)>size*.80)continue;
      const dist=Math.hypot(dx*.91,dz);
      occlusion=Math.max(occlusion,(1-smooth(size*.10,size*.72,dist))*(.16+.11*fine));
    }
    shade.multiplyScalar((.88+.17*n+.09*fine)*(1-occlusion));
    col.push(shade.r,shade.g,shade.b);p.push(x,y,z);
    if(i<steps-1&&j<steps-1){const a=j*steps+i,b=a+steps;idx.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('color',new T.Float32BufferAttribute(col,3));
  g.setIndex(idx);g.computeVertexNormals();
  const groundMat = new T.MeshStandardMaterial({vertexColors:true,roughness:1});
  // Sample grain in world space on the ground itself, with no overlay decals.
  groundMat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 groundXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ngroundXZ = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 groundXZ;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 cell = floor(groundXZ * vec2(42., 35.));
        vec3 grainHash = fract(vec3(cell.xyx) * .1031);
        grainHash += dot(grainHash, grainHash.yzx + 33.33);
        float grain = fract((grainHash.x + grainHash.y) * grainHash.z);
        float footprint = length(fwidth(groundXZ));
        float detail = 1. - smoothstep(.014, .053, footprint);
        vec2 roughCell = floor(groundXZ * 8. + grain*.34);
        float roughGrain = fract(sin(dot(roughCell, vec2(6.174,51.720))) * 43652.18);
        diffuseColor.rgb *= 1. + (grain - .5) * .24 * detail
          + (roughGrain - .5) * .076 * (1. - smoothstep(.08, .19, footprint));
      `);
  };
  const surface=new T.Mesh(g,groundMat);
  surface.receiveShadow=true;scene.add(surface);
  return surface;
}
function gradeStrip(parent,material,points,width,lift) {
  const positions=[],indices=[];
  for(let i=0;i<points.length;i++){
    const [x,z]=points[i];
    const before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
    const dx=after[0]-before[0],dz=after[1]-before[1];
    const scale=width/(2*Math.hypot(dx,dz));
    for(const side of [-1,1]){
      const px=x-dz*scale*side,pz=z+dx*scale*side;
      positions.push(px,heightAt(px,pz)+lift,pz);
    }
    if(i<points.length-1){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh=new T.Mesh(geometry,material);
  mesh.receiveShadow=true;
  parent.add(mesh);
}

function beam(parent,material,from,to,width,depth=width,geometry=unitBox) {
  const start=new T.Vector3(...from),end=new T.Vector3(...to);
  const length=start.distanceTo(end);
  const mesh=new T.Mesh(geometry,material);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.scale.set(width,length,depth);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.sub(start).divideScalar(length));
  mesh.castShadow=width>=.075;
  mesh.receiveShadow=true;
  parent.add(mesh);
  return mesh;
}

function sampleLine(from,to,count,pointAt) {
  return Array.from({length:count},(_,i)=>pointAt(from+(to-from)*i/(count-1)));
}

function pavingMaterial() {
  const material=mat('#927f74');
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec2 pavingPoint;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\npavingPoint = position.xz;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec2 pavingPoint;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec2 row = vec2(pavingPoint.x * 4.5, pavingPoint.y * 8.6);
        row.x += .5 * mod(floor(row.y), 2.);
        vec2 joint = abs(fract(row - .5) - .5);
        float seam = 1. - smoothstep(.022, .075, min(joint.x, joint.y));
        float detail = 1. - smoothstep(.04, .23, length(fwidth(pavingPoint)));
        float tint = fract(sin(dot(floor(row), vec2(19.17,44.81))) * 25738.);
        diffuseColor.rgb *= 1. + (.13 * tint - .06 - .29 * seam) * detail;
      `);
  };
  return material;
}

function siteDetails(scene) {
  const curb=mat('#b3b3a7'),pavers=pavingMaterial(),slabs=mat('#afa99b');
  const steel=mat('#444843'),yellow=mat('#bf9d49'),whiteLine=mat('#d1cbb9');
  const roadLine=offset=>sampleLine(-53,53,92,x=>[x,roadCenter(x)+offset]);
  gradeStrip(scene,pavers,roadLine(-5.75),2.25,.035);
  gradeStrip(scene,curb,roadLine(-4.62),.25,.078);
  gradeStrip(scene,slabs,roadLine(5.34),1.45,.038);
  gradeStrip(scene,curb,roadLine(4.62),.24,.073);

  // The zebra crossing and raised yellow crossing flank the road-side opening.
  for(let i=0;i<8;i++){
    const x=-6.05+i*.80;
    gradeStrip(scene,whiteLine,sampleLine(-4.24,4.24,12,d=>[x+d*.12,roadCenter(x)+d]),.44,.028);
  }
  for(let i=0;i<6;i++){
    const x=10.4+i*.91;
    gradeStrip(scene,i%2===0?yellow:whiteLine,
      sampleLine(-4.16,4.16,10,d=>[x-d*.13,roadCenter(x)+d]),.86,.029);
  }
  for(const from of [-44,-34,-24,-14,4.5,19,29,39]){
    gradeStrip(scene,yellow,sampleLine(from,from+4,6,x=>[x,roadCenter(x)]),.13,.03);
  }

  for(const [from,to] of railRuns){
    const points=sampleLine(from,to,Math.ceil((to-from)/2.45)+1,x=>[x,nearWalk(x)]);
    for(let i=0;i<points.length;i++){
      const [x,z]=points[i], y=heightAt(x,z);
      box(scene,steel,x,y+.52,z,.081,1.04,.081);
      box(scene,yellow,x,y+.96,z,.093,.085,.092);
      box(scene,yellow,x,y+.38,z,.086,.052,.086);
      if(i===points.length-1)continue;
      const [endX,endZ]=points[i+1],endY=heightAt(endX,endZ);
      for(const level of [.31,.59,.87]){
        beam(scene,steel,[x,y+level,z],[endX,endY+level,endZ],.036,.038);
      }
    }
  }

  const westWalk=z=>[-14.95+z*.081,z];
  const eastWalk=z=>[15.15+z*.035,z];
  for(const route of [westWalk,eastWalk]){
    const points=sampleLine(-34,13.9,52,route);
    gradeStrip(scene,slabs,points,2.13,.028);
    gradeStrip(scene,curb,points.map(([x,z])=>[x+Math.sign(-x)*1.09,z]),.17,.064);
  }
  gradeStrip(scene,pavers,sampleLine(5.4,15.2,18,z=>[21.1-.24*(z-5.4),z]),5.6,.04);
  gradeStrip(scene,slabs,sampleLine(-15,14,39,x=>[x,-29.6+.07*x+.006*x*x]),1.8,.047);
  const branchRoad=sampleLine(17,55,29,x=>[x,25.6-(x-17)*.17]);
  gradeStrip(scene,mat('#5e6461'),branchRoad,5.6,.038);
}

function buildingGroup(scene,site) {
  const group=new T.Group();
  group.position.set(site.x,heightAt(site.x,site.z)-.52,site.z);
  group.rotation.y=site.yaw;
  scene.add(group);
  return group;
}

function facadeLabel(parent,text,x,y,z,width,yaw=0,color='#deded5') {
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=96;
  const ctx=canvas.getContext('2d');
  ctx.font='600 57px "Malgun Gothic", sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillStyle=color;
  ctx.fillText(text,256,48,474);
  const texture=new T.CanvasTexture(canvas);
  texture.colorSpace=T.SRGBColorSpace;
  const label=new T.Mesh(new T.PlaneGeometry(width,width*96/512),
    new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));
  label.position.set(x,y,z);
  label.rotation.y=yaw;
  parent.add(label);
}

function teacherBuilding(scene) {
  const g=buildingGroup(scene,education);
  const recess=mat('#3a4d53'),brickPier=mat('#835145');
  const glassShades=[glass,glassBlue,mat('#829197'),mat('#63828f')];
  box(g,brick,0,7.05,0,10.4,16.5,37.2);
  box(g,cream,0,15.62,0,10.85,.70,37.65);
  box(g,pale,0,16.02,0,10.5,.11,37.25);
  box(g,dark,0,16.44,-10.5,4.6,.87,4.8);

  // Full-height warm piers separate broad, blue-gray glazed bays.
  const bays=11;
  const bayWidth=3.32;
  for(let bay=0;bay<bays;bay++){
    const z=(bay-(bays-1)/2)*bayWidth;
    box(g,recess,5.24,8.65,z,.11,12.92,2.98);
    box(g,brickPier,5.43,8.5,z-bayWidth*.5,.48,14.76,.33);
    box(g,brickLight,5.69,8.5,z-bayWidth*.5,.06,14.76,.17);
    for(let row=0;row<5;row++){
      const y=3.5+row*2.60;
      box(g,glassShades[(row+bay*3)%glassShades.length],5.32,y,z,.07,2.37,2.86);
      box(g,recess,5.37,y+.44,z,.072,.10,2.91);
      box(g,recess,5.38,y,z,.070,2.44,.060);
    }
    box(g,brickLight,5.47,15.65,z,.09,.61,1.45);
  }
  box(g,brickPier,5.41,8.5,18.27,.47,14.76,.33);
  box(g,cream,5.34,1.88,0,.26,.31,36.6);

  // A raised, recessed entry on the long facade with stairs below the portico.
  box(g,recess,5.45,2.93,5.7,.36,3.96,5.0);
  box(g,glassBlue,5.69,3.3,5.7,.095,2.8,3.72);
  for(const z of [3.05,8.35]){
    box(g,cream,6.13,3.27,z,1.53,4.55,.48);
  }
  box(g,cream,6.29,5.64,5.7,2.94,.38,5.91);
  box(g,cream,6.4,2.08,5.7,2.36,.21,5.50);
  for(let step=0;step<10;step++){
    const h=1.98-step*.192;
    box(g,pathMat,7.54+step*.34,h*.5,5.7,.37,h,4.45);
  }
  for(const z of [3.53,7.87]){
    beam(g,dark,[7.42,2.9,z],[10.7,.98,z],.057);
    for(let i=0;i<4;i++)box(g,dark,7.49+i*1.04,2.47-i*.58,z,.052,.91,.052);
  }
  box(g,recess,5.31,.99,12.6,.17,1.98,5.4);
  box(g,glass,5.43,1.01,12.6,.10,1.80,5.24);
  for(const z of [10.1,11.71,13.5,15.05])box(g,dark,5.51,1.03,z,.08,1.95,.067);
  box(g,cream,5.76,2.18,12.6,.85,.28,5.7);
  box(g,cream,0,7.68,18.74,10.1,15.35,.3);
  box(g,recess,0,7.76,18.93,5.7,12.18,.14);
  for(let y=2.45;y<13.8;y+=2.58)box(g,glass,0,y,19.03,5.5,2.2,.075);
  for(const x of [-2.67,-.92,.91,2.67])box(g,dark,x,7.7,19.09,.078,12,.08);
  facadeLabel(g,'사범대학관',0,14.82,18.94,5.0,0,'#554e49');
  facadeLabel(g,'A',5.68,14.68,16.64,1.9,Math.PI/2);
}

function stoneSlab(parent,material,outline,y,height) {
  const shape=new T.Shape();
  shape.moveTo(outline[0][0],-outline[0][1]);
  for(const [x,z] of outline.slice(1))shape.lineTo(x,-z);
  shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});
  geometry.rotateX(-Math.PI/2);
  const mesh=new T.Mesh(geometry,material);
  mesh.position.y=y;
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  parent.add(mesh);
}

function stonePanelMaterial() {
  const material=mat('#beb9ac');
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 panelPosition;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 panelPoint = vec4(position, 1.);
        #ifdef USE_INSTANCING
          panelPoint = instanceMatrix * panelPoint;
        #endif
        panelPosition = (modelMatrix * panelPoint).xyz;
      `);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying vec3 panelPosition;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec3 scaled = panelPosition * vec3(1.24, 1.98, 1.24);
        vec3 normalDirection = abs(normalize(cross(dFdx(panelPosition), dFdy(panelPosition))));
        float across = normalDirection.x > normalDirection.z ? scaled.z : scaled.x;
        vec2 tile = vec2(across, scaled.y);
        vec2 joints = abs(fract(tile - .5) - .5);
        float joint = min(joints.x, joints.y);
        float width = clamp(length(fwidth(tile)), .008, .19);
        float jointShade = 1. - smoothstep(.013, .013 + width, joint);
        float grain = fract(sin(dot(floor(tile), vec2(18.743,91.214))) * 31246.71);
        diffuseColor.rgb *= .92 + .12 * grain - .19 * jointShade;
      `);
  };
  return material;
}

function libraryBuilding(scene) {
  const g=buildingGroup(scene,library);
  const stone=stonePanelMaterial(), red=mat('#934d41'), frame=mat('#364449');
  const shade=mat('#536e73'), reflections=[mat('#819fa6'),glass,shade,mat('#738d94')];
  const wing=[[-8.9,17.0],[8.8,16.9],[11.4,7.5],[11.4,-15.9],[4.0,-21.0],[-7.6,-21.0],[-5.2,-9.4]];
  const inner=[[-4.55,12.8],[8.3,12.8],[10.2,6.6],[10.2,-14.8],[3.5,-19.5],[-6.2,-19.5],[-4.55,-9.4]];
  stoneSlab(g,shade,inner,-1.05,15.1);

  // The photo's diagonal corner is built out of open terraces rather than solid walls.
  for(const y of [3.8,7.4,11.0,14.6])stoneSlab(g,stone,wing,y,1.08);
  for(const [x,z] of [[-8.5,16.3],[-6.3,3.6],[-5.5,-8.0],[-6.8,-19.8],[1.5,16.1],[8.4,15.7]]){
    beam(g,red,[x,-.66,z],[x,15.84,z],.31,.31,unitBranch);
  }
  box(g,stone,3.1,16.75,-7.0,10.1,3.9,18.6);
  box(g,pale,3.1,18.79,-7.0,10.32,.22,18.84);
  box(g,stone,6.0,20.1,-12,5.8,2.56,5.9);
  for(const x of [-2,1.0,4.0,7.0])box(g,dark,x,18.91,2.30,.080,.94,.08);
  for(const y of [19.05,19.32])box(g,dark,2.5,y,2.30,9.6,.045,.061);

  for(let row=0;row<4;row++){
    const y=1.97+row*3.60;
    for(let column=0;column<12;column++){
      const z=-8.38+column*1.79;
      box(g,reflections[(column+row*3)%reflections.length],-4.60,y,z,.1,1.77,1.69);
      box(g,frame,-4.68,y,z-.877,.095,1.94,.073);
    }
    box(g,frame,-4.69,y+.45,1.46,.076,.077,21.51);
    for(let column=0;column<8;column++){
      const x=-3.79+column*1.60;
      box(g,reflections[(column+row)%reflections.length],x,y,12.89,1.52,1.77,.1);
      box(g,frame,x-.79,y,12.96,.081,1.93,.074);
    }
    box(g,frame,1.9,y+.46,12.98,12.74,.076,.079);
  }
  box(g,frame,1.4,1.59,13.0,5.3,3.15,.16);
  box(g,glass,1.4,1.4,13.13,4.9,2.68,.095);
  for(const x of [-.99,.63,2.25,3.86])box(g,frame,x,1.4,13.21,.081,2.79,.080);
  box(g,mat('#496b59'),1.4,3.08,13.18,5.2,.65,.10);
  facadeLabel(g,'학술정보관',1.4,3.07,13.245,3.72);
  facadeLabel(g,'상명대학교',-2.5,11.51,17.007,5.23,0,'#494e51');
}

function bench(scene,x,z,angle) {
  const g=new T.Group();g.position.set(x,heightAt(x,z),z);g.rotation.y=angle;scene.add(g);
  for(let i=0;i<10;i++)box(g,wood,0,.013,-.95+i*.20,3.15,.09,.192);
  for(const s of [-1,1]){
    box(g,dark,s*1.0,.29,0,.105,.59,.40);
    box(g,dark,s*1.0,.67,.31,.084,.72,.08);
  }
  for(let i=0;i<4;i++)box(g,woodLight,0,.62,-.27+i*.18,2.19,.059,.13);
  for(let i=0;i<4;i++)box(g,wood,0,.87+i*.13,.41,2.14,.07,.065);
}
const pineShadow=C('#3e532e'),pineLight=C('#86904a');
const blossomShade=C('#ad998c'),blossomLight=C('#e2d2c6');
const foliageMat=new T.MeshStandardMaterial({vertexColors:true,roughness:1});
foliageMat.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader
    .replace('#include <common>','#include <common>\nvarying vec3 leafPoint;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nleafPoint = position;');
  shader.fragmentShader=shader.fragmentShader
    .replace('#include <common>','#include <common>\nvarying vec3 leafPoint;')
    .replace('#include <color_fragment>',`#include <color_fragment>
      vec3 needle = fract(floor(leafPoint * vec3(28., 61., 27.)) * .1031);
      needle += dot(needle, needle.yzx + 33.33);
      float grain = fract((needle.x + needle.y) * needle.z);
      float detail = 1. - smoothstep(.022, .085, length(fwidth(leafPoint)));
      diffuseColor.rgb *= 1. + (grain - .5) * .36 * detail;
    `);
};
const twigBark=mat('#695b47');

function foliage(parent,clumps,compact,shade,highlight,castShadow=true) {
  const template=new T.IcosahedronGeometry(1,compact?1:3);
  const points=template.getAttribute('position');
  const positions=[],normals=[],colors=[];
  const tint=new T.Color(),normal=new T.Vector3();
  for(const {x,y,z,width,height,depth,phase} of clumps){
    for(let i=0;i<points.count;i++){
      const nx=points.getX(i),ny=points.getY(i),nz=points.getZ(i);
      const irregular=noise(nx*4+nz*1.8+phase,ny*3.6-nz*2.4+phase*.47);
      const radius=.68+.64*irregular;
      positions.push(x+nx*width*radius,y+ny*height*radius,z+nz*depth*radius);
      normal.set(nx/width,ny/height,nz/depth).normalize();
      normals.push(normal.x,normal.y,normal.z);
      tint.copy(shade).lerp(highlight,.23+.36*irregular+.28*(ny*.5+.5));
      colors.push(tint.r,tint.g,tint.b);
    }
  }
  template.dispose();
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const canopy=new T.Mesh(geometry,foliageMat);
  canopy.castShadow=castShadow;
  canopy.receiveShadow=true;
  parent.add(canopy);
  return canopy;
}

function pine(scene,x,z,height,index,compact) {
  const rand=rng(20261108+index*1171);
  const tree=new T.Group();
  tree.position.set(x,heightAt(x,z)-.06,z);
  scene.add(tree);
  const lean=(rand()-.5)*height*.32, leanZ=(rand()-.5)*height*.26;
  const base=[0,0,0], bend=[lean*.37,height*.25,leanZ*.54];
  const fork=[lean,height*.48,leanZ], apex=[lean*.6,height*.86,leanZ*.68];
  const rootRadius=.18+height*.018;
  beam(tree,trunkMat,base,bend,rootRadius,rootRadius*.83,unitBranch);
  beam(tree,trunkMat,bend,fork,rootRadius*.68,rootRadius*.60,unitBranch);
  beam(tree,trunkMat,fork,apex,rootRadius*.43,rootRadius*.34,unitBranch);

  const clumps=[];
  const count=6+Math.floor(rand()*3);
  const direction=rand()*Math.PI*2;
  for(let i=0;i<count;i++){
    const angle=direction+i*2.399+(rand()-.5)*.4;
    const length=height*(.20+rand()*.27);
    const start=i%3===0?bend:fork;
    const joint=[start[0]+Math.cos(angle)*length*.59,
      height*(.46+.24*rand()),start[2]+Math.sin(angle)*length*.56];
    const end=[joint[0]+Math.cos(angle)*length*.48,
      joint[1]+height*(.02+rand()*.12),joint[2]+Math.sin(angle)*length*.51];
    const thickness=rootRadius*(.27+rand()*.16);
    beam(tree,trunkMat,start,joint,thickness,thickness*.84,unitBranch);
    beam(tree,twigBark,joint,end,thickness*.62,thickness*.58,unitBranch);
    for(let j=0;j<4;j++){
      const side=angle+(j-1.5)*.78+(rand()-.5)*.67;
      const reach=height*(.045+.072*rand());
      const attachment=j===1||j===2?end:joint;
      const tip=[attachment[0]+Math.cos(side)*reach,
        attachment[1]+height*(.008+.058*rand()),attachment[2]+Math.sin(side)*reach];
      beam(tree,twigBark,attachment,tip,.025,.02,unitBranch);
      const width=height*(.083+rand()*.099);
      clumps.push({x:tip[0],y:tip[1]+width*.23,z:tip[2],width,
        height:width*(.34+rand()*.46),depth:width*(.74+rand()*.33),phase:rand()*71});
    }
  }
  clumps.push({x:apex[0],y:apex[1],z:apex[2],width:height*.19,height:height*.083,depth:height*.148,phase:rand()*71});
  return foliage(tree,clumps,compact,pineShadow,pineLight);
}

function deciduous(scene,x,z,height,index,compact) {
  const rand=rng(9067+index*95);
  const tree=new T.Group();
  tree.position.set(x,heightAt(x,z)-.05,z);
  scene.add(tree);
  const bend=[height*(rand()-.5)*.13,height*.42,.21];
  const fork=[bend[0]-.3,height*.73,.33];
  beam(tree,twigBark,[0,0,0],bend,height*.029,height*.024,unitBranch);
  beam(tree,twigBark,bend,fork,height*.017,height*.016,unitBranch);
  const blossom=index===3 || index===4;
  const clumps=[];
  for(let i=0;i<9;i++){
    const angle=2.399*i+index*.8, reach=height*(.14+.18*rand());
    const base=i%3===0?fork:bend;
    const joint=[base[0]+Math.cos(angle)*reach*.61,height*(.58+.23*rand()),Math.sin(angle)*reach*.68];
    const tip=[base[0]+Math.cos(angle)*reach,joint[1]+height*(.10+.12*rand()),Math.sin(angle)*reach];
    beam(tree,twigBark,base,joint,.034+.025*rand(),.036,unitBranch);
    beam(tree,twigBark,joint,tip,.026,.021,unitBranch);
    for(let j=0;j<3;j++){
      const turn=angle+(rand()-.5)*2.5;
      const branchEnd=[joint[0]+Math.cos(turn)*height*.085,joint[1]+height*(.085+.11*rand()),
        joint[2]+Math.sin(turn)*height*.083];
      beam(tree,twigBark,joint,branchEnd,.014,.011,unitBranch);
      if(blossom && (j+i)%2===0){
        const width=height*(.021+.030*rand());
        clumps.push({x:branchEnd[0],y:branchEnd[1],z:branchEnd[2],width,height:width*.67,
          depth:width*.84,phase:rand()*41});
      }
    }
  }
  if(blossom)foliage(tree,clumps,compact,blossomShade,blossomLight);
}

function edgePlanting(scene,compact) {
  const rand=rng(55817);
  const clumps=[];
  for(const [cx,cz,count,length] of [[-14,10.3,12,2.5],[14.2,11.5,11,2.7],
    [-16,-11,12,4.5],[16.7,-8.3,12,3.8],[15.4,-23,9,2.6],[-12,-30.6,8,3.0],[5,-30.3,12,4.2]]){
    for(let i=0;i<count;i++){
      const x=cx+(rand()-.5)*1.3,z=cz+(rand()-.5)*length;
      const width=.22+rand()*.35;
      clumps.push({x,y:heightAt(x,z)+width*.34,z,width,height:width*(.50+rand()*.45),
        depth:width*.88,phase:rand()*90});
    }
  }
  foliage(scene,clumps,compact,C('#52573a'),C('#878959'));
  const boulder=new T.Mesh(new T.IcosahedronGeometry(1,1),mat('#898678'));
  const x=12.6,z=10.7;
  boulder.scale.set(1.2,1.02,.74);
  boulder.position.set(x,heightAt(x,z)+.54,z);
  boulder.rotation.set(.13,.6,-.24);
  boulder.castShadow=true;
  boulder.receiveShadow=true;
  scene.add(boulder);
}

function ridge(scene,front,back,elevation,offset,rocky,compact) {
  const columns=compact?93:145,rows=compact?19:28;
  const positions=[],colors=[],indices=[];
  const forest=C(rocky?'#4e654a':'#526d4d'),leaf=C('#71815a'),granite=C('#a49f86');
  const color=new T.Color();
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){
    const x=-133+266*i/(columns-1), t=j/(rows-1);
    const z=front+(back-front)*t;
    const outline=.43+.44*fbm(x*.031+offset,5.8)+.21*Math.sin(x*.062+offset)
      +.16*Math.sin(x*.029+offset*2.7);
    const hillHeight=elevation*outline*(.05+.95*smooth(0,.75,t));
    const relief=(noise(x*.35,z*.27)-.5)*1.24 + 3.3*(fbm(x*.11,z*.077)-.38);
    const y=hillHeight+relief*smooth(0,.32,t)-1.1;
    const variegation=fbm(x*.24+offset,z*.21);
    const exposed=smooth(.48,.71,fbm(x*.12+z*.056,z*.033)) * smooth(.27,.60,t);
    color.copy(forest).lerp(leaf,.26+variegation*.47).lerp(granite,rocky?exposed*.81:exposed*.18);
    color.multiplyScalar(.88+.23*noise(x*1.25,z*.93));
    positions.push(x,y,z);
    colors.push(color.r,color.g,color.b);
    if(i<columns-1&&j<rows-1){
      const a=j*columns+i,b=a+columns;
      if(back>front)indices.push(a,b,a+1,a+1,b,b+1);
      else indices.push(a,a+1,b,a+1,b+1,b);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  scene.add(new T.Mesh(geometry,new T.MeshLambertMaterial({vertexColors:true})));
}

function hills(scene,compact) {
  ridge(scene,-108,-177,33,3.3,true,compact);
  ridge(scene,-44,-101,22,1.8,false,compact);
  ridge(scene,61,158,55,5.4,true,compact);
  const rand=rng(8265);
  const crowns=[];
  const groves=compact?18:24;
  for(let i=0;i<groves;i++){
    const x=(i/(groves-1)-.5)*118+(rand()-.5)*6;
    const z=-38-rand()*16;
    const height=1.7+rand()*3.6;
    const spread=1.4+rand()*2.5;
    const turn=rand()*Math.PI*2;
    for(let branch=0;branch<4;branch++){
      const angle=turn+branch*2.4;
      const px=x+Math.cos(angle)*spread*.58;
      const pz=z+Math.sin(angle)*spread*.47;
      const width=spread*(.53+rand()*.28);
      crowns.push({x:px,y:heightAt(px,pz)+height*(.49+rand()*.34),z:pz,width,
        height:height*(.38+rand()*.30),depth:width*(.62+rand()*.39),phase:rand()*72});
    }
  }
  foliage(scene,crowns,compact,C('#435b43'),C('#758261'),false);
}

// Windows, rails, and tree branches share their primitive geometry and material.
function batchCampusDetails(scene,root) {
  const batches=new Map();
  root.updateMatrixWorld(true);
  root.traverse(mesh=>{
    if(mesh.geometry!==unitBox && mesh.geometry!==unitBranch)return;
    let materials=batches.get(mesh.geometry);
    if(!materials){materials=new Map();batches.set(mesh.geometry,materials);}
    let instances=materials.get(mesh.material);
    if(!instances){instances=[];materials.set(mesh.material,instances);}
    instances.push(mesh);
  });
  for(const [geometry,materials] of batches){
    for(const [material,meshes] of materials){
      if(meshes.length<2)continue;
      const batch=new T.InstancedMesh(geometry,material,meshes.length);
      batch.castShadow=meshes.some(mesh=>mesh.castShadow);
      batch.receiveShadow=true;
      meshes.forEach((mesh,i)=>{
        batch.setMatrixAt(i,mesh.matrixWorld);
        mesh.removeFromParent();
      });
      batch.computeBoundingSphere();
      scene.add(batch);
    }
  }
}

function addLamp(scene,x,z) {
  const y=heightAt(x,z);
  box(scene,white,x,y+1.85,z,.10,3.7,.10);
  box(scene,pale,x,y+3.73,z,.49,.10,.42);
  box(scene,white,x,y+3.62,z,.39,.15,.34);
}

export function makeCampusSky(scene,time) {
  const sky=new T.Mesh(new T.SphereGeometry(715,36,20),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    uniforms:{time,horizon:{value:C('#c7d7e6')},zenith:{value:C('#5889bc')}},
    vertexShader:`
      varying vec3 skyPoint;
      void main() {
        skyPoint = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader:`
      varying vec3 skyPoint;
      uniform float time;
      uniform vec3 horizon;
      uniform vec3 zenith;
      ${shaderNoise}
      void main() {
        vec3 viewRay = normalize(skyPoint - cameraPosition);
        float height = max(0., viewRay.y);
        vec3 color = mix(horizon, zenith, pow(smoothstep(0., .78, height), .5));
        vec2 cloudUV = viewRay.xz / (.45 + height) * vec2(2.9, 7.1);
        cloudUV.x += time * .002;
        float cloud = smoothstep(.54, .79, fb2(cloudUV + 17.4));
        cloud *= smoothstep(.012, .16, height) * .63;
        color = mix(color, vec3(.88, .92, .96), cloud);
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  sky.renderOrder=-100;
  scene.add(sky);
}
export function makeCampus(scene,time,compact=false) {
  const ground=terrain(scene,compact);
  hills(scene,compact);
  const details=new T.Group();
  scene.add(details);
  siteDetails(details);
  teacherBuilding(details);
  libraryBuilding(details);
  benches.forEach(([x,z,a])=>bench(details,x,z,a));
  const canopies=pineSites.map(([x,z,height],i)=>pine(details,x,z,height,i,compact));
  deciduousSites.forEach(([x,z,height],i)=>deciduous(details,x,z,height,i,compact));
  edgePlanting(details,compact);
  for(const [x,z] of [[-14.5,11.8],[14.0,12.2],[-15.1,-23],[15.6,-23]])addLamp(details,x,z);
  batchCampusDetails(scene,details);
  const spawnPoints=[
    {x:-3.8,z:10.4},{x:-1.6,z:10.2},{x:.5,z:10.3},{x:2.7,z:10.1},
    {x:4.6,z:10.6},{x:-4.5,z:7.1},{x:5,z:7.0},{x:0,z:6.5}
  ];
  return {
    heightAt,canWalk,spawnPoints,
    benchSeats,
    isSeatPosition(x,z){return Boolean(seatAt(x,z));},
    seatHeightAt(x,z){return seatAt(x,z)?.height ?? 0;},
    pick(raycaster){return raycaster.intersectObject(ground,false)[0]?.point??null;},
    update(elapsed){
      canopies.forEach((canopy,i)=>{
        canopy.rotation.z=Math.sin(elapsed*.61+i*.89)*.0045;
        canopy.rotation.x=Math.cos(elapsed*.53+i*.58)*.0036;
      });
    }
  };
}

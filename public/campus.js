import * as T from 'three';
import { rng, fbm, smooth } from './nature.js';

// The lawn between Sangmyung's College of Education and Academic Information Center.
// This is a hand-built interpretation, NOT a surveyed architectural model.
// Keep the central gathering lawn compact enough that eight travelers remain visible.
const seed = rng(20261108);
const trees = [];
const benches = [
  [-8.5, -6.8, Math.PI / 2], [8.5, -5.3, -Math.PI / 2],
  [-7.8, 6.5, Math.PI / 2], [7.8, 6.5, -Math.PI / 2]
];
const treeSites = [
  [-25, 12, 5.3], [-28, -11, 6.2], [-25, -27, 5.1],
  [26, 14, 5.8], [27, -25, 6.4], [20, -33, 5.2],
  [-11, -31, 5.6], [1, -33, 6.4], [11, -31, 5.0],
  [-30, 27, 7.7], [-17, 30, 6.1], [20, 31, 6.9], [33, -2, 7.2]
];
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
const wood = mat('#92765a');
const woodLight = mat('#b69876');
const pathMat = mat('#c7b9a2');
const trunkMat = mat('#675347');
const crownMats = [
  mat('#577e61'),
  mat('#7c9c71'),
  mat('#9eae78'),
  mat('#446d59')
];

function heightAt(x,z) {
  const rimX = smooth(15,40,Math.abs(x));
  const rimFront = smooth(17,47,z);
  const rimBack = smooth(19,48,-z);
  return 1.75 * rimX * rimX + .7 * rimFront + 2.1 * rimBack
    + (rimX + rimFront + rimBack) * .17 * (fbm(x*.12,z*.11)-.5);
}
function insideBox(x,z,cx,cz,halfX,halfZ,pad=0) {
  return Math.abs(x-cx)<halfX+pad && Math.abs(z-cz)<halfZ+pad;
}
function canWalk(x,z) {
  if (Math.abs(x)>34 || z<-30 || z>36) return false;
  if (insideBox(x,z,-18.3,-12.4,5.65,18.0,.65)) return false;
  if (insideBox(x,z,18.1,-12.0,6.15,18.8,.65)) return false;
  for (const [bx,bz] of benches) if (insideBox(x,z,bx,bz,1.65,.48,.18)) return false;
  for (const [tx,tz] of treeSites) if (Math.hypot(x-tx,z-tz)<.78) return false;
  return true;
}
function box(parent, material, x,y,z, w,h,d) {
  const m = new T.Mesh(new T.BoxGeometry(w,h,d),material);
  m.position.set(x,y,z);
  m.castShadow = false;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function roundedShape(w,h,r) {
  const s=new T.Shape(), x=-w/2, y=-h/2;
  s.moveTo(x+r,y);
  s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);
  s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);
  s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
  return s;
}
function planeShape(scene,shape,color,y,z=0,x=0) {
  const mesh=new T.Mesh(new T.ShapeGeometry(shape,16),mat(color,{side:T.DoubleSide}));
  mesh.rotation.x=-Math.PI/2;
  mesh.position.set(x,y,z);
  mesh.receiveShadow=true;
  scene.add(mesh);
  return mesh;
}
function terrain(scene) {
  const nX=119,nZ=128,p=[],col=[],idx=[];
  const darkGrass=C('#6e8b64'),lightGrass=C('#a0b779'),earth=C('#b8aa8b'),tone=new T.Color();
  for(let j=0;j<nZ;j++) for(let i=0;i<nX;i++) {
    const x=-58+i*116/(nX-1),z=-70+j*135/(nZ-1);
    const y=heightAt(x,z);
    const variation=fbm(x*.12+21,z*.13);
    tone.copy(darkGrass).lerp(lightGrass,.19+.72*variation);
    const edge=Math.max(smooth(28,49,Math.abs(x)),smooth(40,68,Math.abs(z)));
    tone.lerp(earth,edge*.30);
    p.push(x,y,z);col.push(tone.r,tone.g,tone.b);
    if(i<nX-1&&j<nZ-1){const a=j*nX+i,b=a+nX;idx.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('color',new T.Float32BufferAttribute(col,3));
  g.setIndex(idx);g.computeVertexNormals();
  const mesh=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));
  mesh.receiveShadow=true;scene.add(mesh);
  return mesh;
}
function lawn(scene) {
  // Stone circulation band, generous lawn and a narrow timber deck edging the courtyard.
  planeShape(scene,roundedShape(27.2,36,3.5),'#c9bda6',.018,-1.0);
  planeShape(scene,roundedShape(21.3,29,3.0),'#82a66b',.037,-1.0);
  planeShape(scene,roundedShape(18.7,26.7,2.4),'#91b376',.040,-1.0);
  // Soft, flush color variations replace the former spike-shaped grass.
  // Keep the lawn smooth and walkable, with no black triangles or towering blades.
  const patchGeometry = new T.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  const patchMaterial = new T.MeshBasicMaterial({
    color:'#ffffff', transparent:true, opacity:.12, depthWrite:false,
    side:T.DoubleSide, polygonOffset:true, polygonOffsetFactor:-1
  });
  const patches = new T.InstancedMesh(patchGeometry, patchMaterial, compact?480:740);
  const dummy = new T.Object3D(), tint = new T.Color();
  const deep = C('#678e68'), light = C('#c1d09c');
  for(let i=0;i<patches.count;i++){
    let x=0,z=0;
    for(let attempt=0;attempt<20;attempt++){
      x=(seed()-.5)*19.8; z=-1+(seed()-.5)*26.8;
      if(Math.pow(x/10.4,8)+Math.pow((z+1)/14.3,8)<.8)break;
    }
    dummy.position.set(x,.048+seed()*.0015,z);
    dummy.rotation.set(0,seed()*Math.PI*2,0);
    const size=.32+seed()*1.3;
    dummy.scale.set(size*(.7+seed()*1.8),1,size*(.35+seed()*.8));
    dummy.updateMatrix();
    patches.setMatrixAt(i,dummy.matrix);
    tint.copy(deep).lerp(light,seed());
    patches.setColorAt(i,tint);
  }
  patches.instanceMatrix.needsUpdate=true;
  patches.computeBoundingSphere();
  patches.renderOrder=2;
  scene.add(patches);
  // Two understated wood platforms: not a raised artificial stage.
  for(const x of [-11.9,11.9]) {
    box(scene,wood,x,.065,-2,2.35,.115,26);
    for(let k=0;k<19;k++) box(scene,woodLight,x,.132,-14.15+k*1.36,2.24,.018,.045);
  }
  return patches;
}
function teacherBuilding(scene) {
  const g=new T.Group();
  scene.add(g);
  // Brick-and-stone academic wing: lateral wall faces the central lawn.
  box(g,brick,-18.3,7.15,-12.4,10.4,14.3,36);
  box(g,brickLight,-18.3,14.37,-12.4,11.1,.45,36.65);
  for(let row=0;row<4;row++){
    for(let column=0;column<12;column++){
      const z=-28.3+column*2.80,y=2.35+row*3.05;
      box(g,cream,-13.01,y,z,.105,2.10,1.74);
      box(g,glass,-12.93,y+.03,z,.05,1.78,1.43);
      box(g,white,-12.877,y+.01,z,.038,1.66,.067);
      box(g,dark,-12.85,y-.85,z,.04,.10,1.6);
    }
  }
  // South entrance faces the approach path, with a canopy and recessed glass doors.
  box(g,cream,-18.0,2.55,5.71,6.45,5.1,.4);
  box(g,dark,-18.0,1.75,5.96,3.9,3.25,.12);
  box(g,glassBlue,-18.0,1.85,6.04,3.35,2.9,.075);
  box(g,white,-18.0,1.83,6.11,.085,3.0,.09);
  box(g,cream,-18.0,5.14,6.25,7.2,.35,2.4);
  for(let i=0;i<3;i++) box(g,pathMat,-18, .10+i*.13,7.1+i*.65,7.0-i*.32,.26,.78);
  // Thin bands, pilasters and parapet give the brick facade an academic scale.
  for(let y of [3.6,6.65,9.7,12.75]) box(g,brickLight,-12.96,y,-12.4,.18,.12,35.75);
}
function libraryBuilding(scene) {
  const g=new T.Group();scene.add(g);
  // Pale structural frame with expansive blue-tinted glazing, stair/entrance mass.
  box(g,white,18.1,8.1,-12.0,12.2,16.2,37.6);
  box(g,glass,11.92,8.0,-12.0,.19,14.3,35.25);
  for(let row=0;row<5;row++){
    const y=2.12+row*2.77;
    for(let c=0;c<14;c++){
      const z=-29.6+c*2.67;
      box(g,glassBlue,11.77,y,z,.085,2.18,2.16);
      if(c%3===0)box(g,glass,11.714,y+.06,z-.48,.032,1.92,.42);
      box(g,white,11.66,y,z+1.12,.13,2.48,.11);
    }
    box(g,white,11.58,3.46+row*2.77,-12,.25,.29,35.85);
  }
  for(const z of [-29.7,-21,-12.3,-3.6,5.1]) box(g,white,11.52,8,z,.35,16.2,.29);
  box(g,white,18.1,16.37,-12.0,12.75,.6,38);
  // South elevation and welcoming glass portal.
  box(g,glassBlue,18.1,5.0,6.9,9.55,8.75,.12);
  for(let x=14.1;x<22.5;x+=2.05)box(g,white,x,5,6.99,.14,8.6,.19);
  box(g,white,18.1,9.38,7.02,10.3,.31,.32);
  box(g,dark,18.1,1.78,7.10,4.0,3.30,.1);
  box(g,glass,18.1,1.84,7.2,3.54,3.0,.05);
  box(g,white,18.1,1.85,7.29,.08,3,.06);
  for(let i=0;i<5;i++)box(g,pathMat,18.1,.09+i*.155,8.5+i*.66,10.3-i*.32,.31,.81);
}
function bench(scene,x,z,angle) {
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=angle;scene.add(g);
  for(const s of [-1,1]){
    box(g,dark,s*1.0,.32,0,.085,.61,.63);
    box(g,dark,s*1.0,.71,.34,.084,.82,.085);
  }
  for(let i=0;i<4;i++)box(g,woodLight,0,.68,-.33+i*.205,2.22,.065,.15);
  for(let i=0;i<4;i++)box(g,wood,0,.93+i*.17,.44,2.20,.09,.075);
}
function tree(scene,x,z,size,index) {
  const group=new T.Group();
  group.position.set(x,heightAt(x,z),z);
  scene.add(group);
  const trunk=new T.Mesh(new T.CylinderGeometry(.18,.39,size*.77,9,3),trunkMat);
  trunk.position.y=size*.38;group.add(trunk);
  for(let j=0;j<5;j++){
    const a=j*Math.PI*2/5+index;
    const branch=new T.Mesh(new T.CylinderGeometry(.04,.115,size*.37,6),trunkMat);
    branch.position.set(Math.cos(a)*size*.18,size*(.43+j*.047),Math.sin(a)*size*.18);
    branch.rotation.z=Math.cos(a)*.47;branch.rotation.x=Math.sin(a)*.45;
    group.add(branch);
  }
  const canopy=new T.Group();group.add(canopy);canopy.position.y=size*.77;
  const count=9+(index%4)*2;
  for(let i=0;i<count;i++) {
    const a=(i*2.39996+index*.6);
    const radius=(.16+Math.sqrt(i/count)*.55)*size;
    const geometry=new T.SphereGeometry(1,11,8);
    const p=geometry.attributes.position;
    for(let k=0;k<p.count;k++) {
      const wobble=.93+.10*Math.sin(k*1.6+i*4.1);
      p.setXYZ(k,p.getX(k)*wobble,p.getY(k)*(1+(k%3)*.05),p.getZ(k)*wobble);
    }
    geometry.computeVertexNormals();
    const leaf=new T.Mesh(geometry,crownMats[(i+index)%crownMats.length]);
    leaf.position.set(Math.cos(a)*radius*.63,(seed()-.5)*size*.48,Math.sin(a)*radius*.6);
    leaf.scale.set(size*(.23+seed()*.11),size*(.20+seed()*.11),size*(.23+seed()*.11));
    canopy.add(leaf);
  }
  trees.push({group,canopy,phase:index*.83,amount:.007+index%3*.002});
}
function shrubs(scene) {
  const green=[mat('#56735a'),mat('#708963'),mat('#8a9d70')];
  const b=new T.IcosahedronGeometry(1,1);
  for(const [cx,cz,l,d] of [
    [-9.7,-17.5,18,1], [9.7,-17.5,18,1],
    [-24,9.1,11,1.5],[24.1,10.9,11,1.5],
    [-30,-28,14,1.8],[29,-27,14,1.8]
  ]) for(let i=0;i<l;i++){
    const x=cx+(seed()-.5)*d*2,z=cz+(seed()-.5)*3.1;
    const m=new T.Mesh(b,green[i%green.length]);
    m.position.set(x,heightAt(x,z)+.34,z);
    m.scale.set(.37+seed()*.34,.34+seed()*.21,.36+seed()*.30);
    scene.add(m);
  }
}
function hills(scene) {
  const backColors=['#9bac98','#819c89','#6d8e7b'];
  const bands=[
    {z:-165,base:9,amp:18,shift:2.3,color:backColors[0]},
    {z:-117,base:2,amp:15,shift:1.0,color:backColors[1]},
    {z:-77,base:-3,amp:11,shift:4.2,color:backColors[2]}
  ];
  for(const band of bands){
    const vertices=[],colors=[],ids=[],top=C(band.color),bottom=top.clone().multiplyScalar(.61);
    for(let i=0;i<=115;i++){
      const x=-170+i*340/115;
      const peak=band.base+band.amp*(.34+.30*Math.sin(x*.023+band.shift)+.20*Math.cos(x*.047-band.shift)+.16*fbm(x*.019+band.shift,8));
      vertices.push(x,-13,band.z,x,peak,band.z);
      for(const color of [bottom,top])colors.push(color.r,color.g,color.b);
      if(i<115){const a=i*2;ids.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    geo.setIndex(ids);geo.computeVertexNormals();
    scene.add(new T.Mesh(geo,new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,depthWrite:true,fog:true})));
  }
}
function addLamp(scene,x,z) {
  box(scene,dark,x,1.9,z,.12,3.8,.12);
  box(scene,white,x,3.83,z,.62,.12,.62);
  box(scene,mat('#f2e6bf',{emissive:'#b5a17a',emissiveIntensity:.25}),x,3.70,z,.42,.19,.42);
}
export function makeCampus(scene,time,compact=false) {
  const ground=terrain(scene);
  hills(scene);
  lawn(scene);
  teacherBuilding(scene);
  libraryBuilding(scene);
  for(const [x,z,a] of benches) bench(scene,x,z,a);
  treeSites.forEach(([x,z,size],i)=>tree(scene,x,z,size,i));
  shrubs(scene);
  for(const [x,z] of [[-10.3,10],[10.3,10],[-10.2,-17],[10.2,-17]]) addLamp(scene,x,z);
  // Tiny flowers near the lawn's outer corners — no oversized game-like effects.
  const flowerGeo=new T.SphereGeometry(.045,5,4);
  const flowers=new T.InstancedMesh(flowerGeo,mat('#eee5c4'),compact?170:320);
  const dummy=new T.Object3D();
  for(let i=0;i<flowers.count;i++){
    const angle=seed()*Math.PI*2;
    const x=Math.cos(angle)*(9.0+seed()*1.0);
    const z=-1+Math.sin(angle)*(12.4+seed()*1.8);
    dummy.position.set(x,.10,z);
    dummy.scale.setScalar(.72+seed()*.8);
    dummy.updateMatrix();
    flowers.setMatrixAt(i,dummy.matrix);
  }
  flowers.computeBoundingSphere();
  scene.add(flowers);
  const spawnPoints = [
    {x:-3.7,z:8.1},{x:-2.1,z:9.8},{x:-.4,z:8.0},{x:1.7,z:9.6},
    {x:3.7,z:8.1},{x:-4.7,z:3.6},{x:4.8,z:3.8},{x:0,z:4.9}
  ];
  return {
    heightAt,canWalk,spawnPoints,
    pick(raycaster){ return raycaster.intersectObject(ground,false)[0]?.point??null; },
    update(elapsed){
      for(const t of trees){
        t.canopy.rotation.z=Math.sin(elapsed*.73+t.phase)*t.amount;
        t.canopy.rotation.x=Math.cos(elapsed*.56+t.phase)*t.amount*.66;
      }
    }
  };
}

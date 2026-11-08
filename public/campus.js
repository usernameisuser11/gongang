import * as T from 'three';
import { rng, fbm, smooth } from './nature.js';

// The lawn between Sangmyung's College of Education and Academic Information Center.
// This is a hand-built interpretation, NOT a surveyed architectural model.
// Keep the central gathering lawn compact enough that eight travelers remain visible.
const seed = rng(20261108);
const trees = [];
// Layout derived from the supplied street-view walk: a planted, raised garden
// between long brick glazing and a stepped modern building, not an empty field.
const pineSites = [
  [-7.7,-4.8,5.6], [3.7,0.4,6.2], [7.2,-10.2,5.8],
  [-5.5,-14.8,5.0], [11.0,4.6,4.9], [-1.6,7.0,4.7],
  [1.0,-22.0,5.1]
];
const bareSites = [[-15.4,-4.0,10.2],[-15.6,-22.6,11.0],[-30,18,9.1],[15.1,27.5,10.2]];
const benches = [
  [-12.2,7.0,Math.PI/2], [14.3,9.9,-Math.PI/2],
  [-12.5,-20.0,Math.PI/2]
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

function gardenRadius(x,z) {
  const dx=(x-1.4)/15.5;
  const dz=(z+6.0)/19.4;
  const angle=Math.atan2(dz,dx);
  const irregular=1+.046*Math.sin(angle*3.1+.6)+.027*Math.sin(angle*8.2);
  return Math.sqrt(dx*dx+dz*dz)/irregular;
}
function gardenCover(x,z) {
  return 1-smooth(.79,1.09,gardenRadius(x,z));
}
function heightAt(x,z) {
  const outer=smooth(26,57,Math.abs(x))*1.25+smooth(24,56,-z)*1.7;
  const cover=gardenCover(x,z);
  const mound=cover*(.85+.17*fbm(x*.09+2,z*.11+8));
  return .05+outer+mound;
}

function insideBox(x,z,cx,cz,halfX,halfZ,pad=0) {
  return Math.abs(x-cx)<halfX+pad && Math.abs(z-cz)<halfZ+pad;
}
function canWalk(x,z) {
  if (Math.abs(x)>36 || z<-32 || z>39) return false;
  if (insideBox(x,z,-22.4,-13.3,5.65,18.5,.65)) return false;
  if (insideBox(x,z,23.0,-13.0,6.45,18.4,.65)) return false;
  for(const [bx,bz] of benches)if(insideBox(x,z,bx,bz,1.70,.5,.14))return false;
  for(const [tx,tz] of pineSites)if(Math.hypot(x-tx,z-tz)<.78)return false;
  for(const [tx,tz] of bareSites)if(Math.hypot(x-tx,z-tz)<.65)return false;
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
  const nX=163,nZ=169,p=[],col=[],idx=[];
  const grassDark=C('#65865e'),grassLight=C('#a1b688');
  const soil=C('#ac9f82'),paving=C('#b5afa0'),asphalt=C('#656b6a');
  const shade=new T.Color();
  for(let j=0;j<nZ;j++)for(let i=0;i<nX;i++){
    const x=-57+i*114/(nX-1),z=-62+j*125/(nZ-1);
    const y=heightAt(x,z), cover=gardenCover(x,z);
    const n=fbm(x*.12+21,z*.14+11),fine=fbm(x*.49,z*.51);
    const road=smooth(15.2,17.0,z)*(1-smooth(30.5,33,z));
    shade.copy(paving).lerp(soil,.20+.15*n);
    shade.lerp(grassDark,cover*.85);
    shade.lerp(grassLight,cover*(.28+.37*n));
    shade.lerp(asphalt,road*.97);
    shade.multiplyScalar(.94+.09*n+.03*fine);
    col.push(shade.r,shade.g,shade.b);p.push(x,y,z);
    if(i<nX-1&&j<nZ-1){const a=j*nX+i,b=a+nX;idx.push(a,b,a+1,a+1,b,b+1);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('color',new T.Float32BufferAttribute(col,3));
  g.setIndex(idx);g.computeVertexNormals();
  const surface=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));
  surface.receiveShadow=true;scene.add(surface);
  return surface;
}
function lawn(scene,compact) {
  // The lawn is itself the raised planted earth, not a floating flat polygon.
  // Subtle patches lie flush with sampled terrain: no triangular grass spikes.
  const patchGeometry=new T.CircleGeometry(1,20).rotateX(-Math.PI/2);
  const patchMat=new T.MeshBasicMaterial({
    color:'#ffffff',transparent:true,opacity:.09,depthWrite:false,
    side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1
  });
  const patches=new T.InstancedMesh(patchGeometry,patchMat,compact?390:660);
  const dummy=new T.Object3D(),tint=new T.Color();
  const a=C('#537e5d'),b=C('#b5c79a');
  for(let i=0;i<patches.count;i++){
    let x=0,z=0;
    for(let trial=0;trial<35;trial++){
      x=-14+seed()*30;z=-27+seed()*39;
      if(gardenRadius(x,z)<.74)break;
    }
    dummy.position.set(x,heightAt(x,z)+.026,z);
    dummy.rotation.y=seed()*Math.PI*2;
    dummy.scale.set(.17+seed()*.64,1,.11+seed()*.53);
    dummy.updateMatrix();patches.setMatrixAt(i,dummy.matrix);
    patches.setColorAt(i,tint.copy(a).lerp(b,seed()));
  }
  patches.instanceMatrix.needsUpdate=true;
  patches.computeBoundingSphere();scene.add(patches);
  // Organic stone retaining edge, assembled as shallow irregular segments.
  const stone=mat('#adab99');
  const curb=mat('#c6c2b4');
  const n=92;
  for(let i=0;i<n;i++){
    const angle=(i+.5)*Math.PI*2/n;
    const x=1.4+Math.cos(angle)*15.6,z=-6+Math.sin(angle)*19.5;
    const radius=gardenRadius(x,z);
    const y=heightAt(x,z);
    const tangent=angle+Math.PI/2;
    const segment=box(scene,i%7===0?stone:curb,x,y+.025,z,1.1,.12,.23);
    segment.rotation.y=-tangent;
    segment.scale.x=.86+.18*seed();
  }
}
function siteDetails(scene) {
  const lightStone=mat('#c5bca8'),grayStone=mat('#9d9a90');
  const darkSteel=mat('#545b5a'),yellow=mat('#c9b96c'),whiteLine=mat('#d7d1bf');
  // Parallel campus approach, vehicular roadway and zebra crossing.
  for(const x of [-14.5,-11.0,-7.5,-4, -.5,3,6.5,10,13.5]){
    box(scene,(x===-4||x===3)?yellow:whiteLine,x,.095,20.4,2.0,.023,2.35);
  }
  for(let x=-35;x<35;x+=8)box(scene,yellow,x,.075,27.6,3.7,.015,.10);
  // Sidewalk separating the road from landscaped garden.
  box(scene,lightStone,0,.08,14.5,75,.09,.47);
  box(scene,grayStone,0,.085,32,75,.06,.30);
  // Slim pedestrian rail, segmented with a welcoming central gap.
  for(const [from,to] of [[-35,-6.0],[5.5,35]]){
    for(let x=from;x<to;x+=3){
      const endX=Math.min(to,x+3);
      const m=(x+endX)/2;
      box(scene,darkSteel,m,.93,13.45,endX-x,.055,.055);
      box(scene,darkSteel,m,.55,13.45,endX-x,.038,.038);
      box(scene,darkSteel,x,.58,13.45,.065,1.16,.065);
    }
  }
  // Long natural walkway by each academic facade.
  for(const x of [-14.4,14.5]){
    for(let z=-29;z<13;z+=2.6) {
      const y=heightAt(x,z);
      const slab=box(scene,lightStone,x,y+.025,z,2.4,.045,2.5);
      slab.rotation.y=(seed()-.5)*.016;
    }
  }
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
  const g=new T.Group();g.position.set(x,heightAt(x,z),z);g.rotation.y=angle;scene.add(g);
  for(const s of [-1,1]){
    box(g,dark,s*1.0,.29,0,.085,.59,.63);
    box(g,dark,s*1.0,.67,.31,.084,.72,.08);
  }
  for(let i=0;i<4;i++)box(g,woodLight,0,.62,-.27+i*.18,2.19,.059,.13);
  for(let i=0;i<4;i++)box(g,wood,0,.87+i*.13,.41,2.14,.07,.065);
}
function branch(group,material,from,to,r0,r1) {
  const start=new T.Vector3(...from),end=new T.Vector3(...to);
  const len=start.distanceTo(end);
  const mesh=new T.Mesh(new T.CylinderGeometry(r1,r0,len,7),material);
  mesh.position.copy(start).add(end).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize());
  group.add(mesh);
}
function umbrellaPine(scene,x,z,size,index){
  // Wind-shaped, umbrella-wide pine canopies with visible branching silhouettes.
  const g=new T.Group();g.position.set(x,heightAt(x,z),z);g.rotation.y=index*.23;scene.add(g);
  const bark=mat('#655648');
  const leafColors=['#527554','#6d8b65','#8aa379','#476e58','#789368'].map(s=>mat(s));
  const lean=index%2?.68:-.48;
  branch(g,bark,[0,0,0],[lean,size*.48,.23],.19,.14);
  branch(g,bark,[lean,size*.48,.23],[lean*1.4,size*.68,0],.14,.09);
  const head=new T.Group();g.add(head);
  head.position.set(lean*1.4,size*.61,0);
  for(let i=0;i<7;i++){
    const ang=i*6.283/7+index*.41,rad=size*(.25+.17*(i%3)/3);
    const px=Math.cos(ang)*rad,pz=Math.sin(ang)*rad;
    branch(g,bark,[lean,size*.5,.23],[lean*1.4+px,size*(.58+.06*(i%3)),pz],.055,.028);
    for(let j=0;j<4;j++){
      const a=i*6.283/7+j*1.71+index*.31;
      const leaf=new T.Mesh(new T.SphereGeometry(1,11,7),leafColors[(i+j+index)%leafColors.length]);
      leaf.position.set(px+Math.cos(a)*size*.15,size*(.04+.037*Math.sin(i+j)),pz+Math.sin(a)*size*.15);
      leaf.scale.set(size*(.18+seed()*.045),size*(.105+seed()*.026),size*(.17+seed()*.04));
      head.add(leaf);
    }
  }
  trees.push({canopy:head,phase:index*.83,amount:.007});
}
function bareTree(scene,x,z,size,index) {
  const g=new T.Group();g.position.set(x,heightAt(x,z),z);scene.add(g);
  const bark=mat('#736b60');
  branch(g,bark,[0,0,0],[.1,size*.55,0],.24,.15);
  branch(g,bark,[.1,size*.55,0],[.27,size*.83,0],.15,.075);
  for(let i=0;i<10;i++){
    const a=i*2.399+index,spread=size*(.19+.075*(i%3));
    const anchor=[.1,size*(.4+(i%4)*.10),0];
    const end=[Math.cos(a)*spread,size*(.63+(i%5)*.054),Math.sin(a)*spread*.69];
    branch(g,bark,anchor,end,.05,.016);
    for(let j=0;j<3;j++){
      const t=j/3;
      const root=anchor.map((v,k)=>v*(1-t)+end[k]*t);
      const twig=[root[0]+Math.cos(a+j*1.8)*size*.07,root[1]+size*(.12+j*.017),root[2]+Math.sin(a+j*1.8)*size*.09];
      branch(g,bark,root,twig,.014,.003);
    }
  }
}

function shrubs(scene) {
  const foliage=[mat('#658262'),mat('#829978'),mat('#9bad88')];
  const geo=new T.SphereGeometry(1,10,7);
  for(const [cx,cz,num,spread] of [
    [-11,-16,21,1.2],[12,-18,27,1.5],[-10,8,15,1.0],
    [11,7,14,1.3],[-15,-27,16,1.0]
  ])for(let i=0;i<num;i++){
    const x=cx+(seed()-.5)*spread*2,z=cz+(seed()-.5)*5.2;
    const radius=.24+seed()*.28;
    const m=new T.Mesh(geo,foliage[(i+Math.floor(seed()*3))%3]);
    m.position.set(x,heightAt(x,z)+radius*.5,z);
    m.scale.set(radius*1.7,radius*.8,radius*1.5);
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
  lawn(scene,compact);
  siteDetails(scene);
  teacherBuilding(scene);
  libraryBuilding(scene);
  benches.forEach(([x,z,a])=>bench(scene,x,z,a));
  pineSites.forEach(([x,z,size],i)=>umbrellaPine(scene,x,z,size,i));
  bareSites.forEach(([x,z,size],i)=>bareTree(scene,x,z,size,i));
  shrubs(scene);
  for(const [x,z] of [[-12,11.5],[13,11.5],[-11,-24],[13,-24]])addLamp(scene,x,z);
  const spawnPoints=[
    {x:-3.8,z:11.8},{x:-1.6,z:11.6},{x:.5,z:11.7},{x:2.7,z:11.5},
    {x:4.6,z:12},{x:-4.5,z:5.7},{x:5,z:5.3},{x:0,z:4.8}
  ];
  return {
    heightAt,canWalk,spawnPoints,
    pick(raycaster){return raycaster.intersectObject(ground,false)[0]?.point??null;},
    update(elapsed) {
      for(const t of trees){
        t.canopy.rotation.z=Math.sin(elapsed*.69+t.phase)*t.amount;
        t.canopy.rotation.x=Math.cos(elapsed*.54+t.phase)*t.amount*.6;
      }
    }
  };
}

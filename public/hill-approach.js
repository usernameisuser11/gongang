import * as T from 'three';
import { rng } from './nature.js';

// The very bottom of the Sangmyung commute, inspired by the supplied street-view
// frames: a road fork, bridge-side rail, uphill shopfronts, high concrete wall,
// children's protection zone and overhead utility wires. Not a surveyed map.
const mats = {
  concrete: new T.MeshStandardMaterial({color:'#bcbdb6',roughness:.96,side:T.DoubleSide}),
  wall: new T.MeshStandardMaterial({color:'#a5a9a3',roughness:.98,side:T.DoubleSide}),
  dark: new T.MeshStandardMaterial({color:'#414b4b',roughness:.88}),
  rail: new T.MeshStandardMaterial({color:'#58656a',metalness:.25,roughness:.64}),
  frames: new T.MeshStandardMaterial({color:'#d4d8d3',roughness:.84}),
  glass: new T.MeshStandardMaterial({color:'#51717a',roughness:.31,metalness:.13}),
  red: new T.MeshStandardMaterial({color:'#904d4a',roughness:.94,side:T.DoubleSide}),
  road: new T.MeshStandardMaterial({color:'#676d68',roughness:1,side:T.DoubleSide}),
  white: new T.MeshStandardMaterial({color:'#e4e4d9',roughness:.94,side:T.DoubleSide}),
  yellow: new T.MeshStandardMaterial({color:'#d2b45f',roughness:.86}),
  asphaltMark: new T.MeshBasicMaterial({color:'#eeeae0',side:T.DoubleSide,depthWrite:false}),
  foliage: new T.MeshStandardMaterial({color:'#62785a',roughness:1}),
};
const instances = new Map();
function cube(material,x,y,z,w,h,d){
  let list=instances.get(material);
  if(!list){list=[];instances.set(material,list);}
  list.push({x,y,z,w,h,d});
}
function flush(scene){
  const transform=new T.Object3D();
  for(const [material,list] of instances){
    if(!list.length)continue;
    const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,list.length);
    for(let i=0;i<list.length;i++){
      const o=list[i];
      transform.position.set(o.x,o.y,o.z);
      transform.scale.set(o.w,o.h,o.d);
      transform.rotation.set(0,0,0);
      transform.updateMatrix();
      mesh.setMatrixAt(i,transform.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.receiveShadow=true;
    scene.add(mesh);
  }
  instances.clear();
}
function raisedStrip(scene,C,H,z0,z1,from,to,material,lift=.125){
  const vertices=[],indices=[],n=36;
  for(let i=0;i<=n;i++){
    const t=i/n,z=z0+(z1-z0)*t;
    const mid=C(z);
    const a=from(t),b=to(t);
    for(const off of [a,b]){
      const x=mid+off;
      vertices.push(x,H(x,z)+lift,z);
    }
    if(i<n){
      const j=i*2;
      indices.push(j,j+1,j+2,j+1,j+3,j+2);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,material);
  mesh.receiveShadow=true;scene.add(mesh);
}
function slopeMark(scene,C,H,z,length=1.3){
  for(let j=0;j<7;j++){
    const x=C(z)-3.18+j*1.05;
    const vertices=[],indices=[0,1,2,1,3,2];
    for(const zz of [z-length*.5,z+length*.5]){
      for(const xx of [x-.28,x+.28]){
        vertices.push(xx,H(xx,zz)+.151,zz);
      }
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    scene.add(new T.Mesh(geo,mats.asphaltMark));
  }
}
function canvasSign(scene,title,subtitle,x,y,z,width=3.9,height=1.30){
  const canvas=document.createElement('canvas');
  canvas.width=768;canvas.height=256;
  const context=canvas.getContext('2d');
  context.fillStyle='#e8bb3f';context.fillRect(0,0,768,256);
  context.strokeStyle='#463d21';context.lineWidth=10;context.strokeRect(9,9,750,238);
  context.fillStyle='#272923';context.textAlign='center';context.textBaseline='middle';
  context.font='bold 65px "Malgun Gothic","Noto Sans KR",sans-serif';
  context.fillText(title,384,83,730);
  context.font='600 39px "Malgun Gothic","Noto Sans KR",sans-serif';
  context.fillText(subtitle,384,186,728);
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  // Face the downhill approach, where the arriving visitor starts.
  const sign=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));
  sign.position.set(x,y,z);scene.add(sign);
}
function cable(scene,a,b,material,r=.046){
  const delta=b.clone().sub(a),length=delta.length();
  const rail=new T.Mesh(new T.CylinderGeometry(r,r,length,7),material);
  rail.position.copy(a).addScaledVector(delta,.5);
  rail.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
  scene.add(rail);
}
function lowerStreet(scene,C,H){
  // Street-view ~00:04-00:22: calm approach with railings, not an open fan
  // of polygons beneath the feet. The main asphalt/pavement comes from hill.js.
  // The protection-zone color lives ONLY on the carriageway at the junction.
  raisedStrip(scene,C,H,181,186,()=>-3.72,()=>3.72,mats.red,.121);
  slopeMark(scene,C,H,173,1.45);
  slopeMark(scene,C,H,201,1.15);
  for(const z of [203,192,178]){
    const x=C(z)+3.95,y=H(x,z);
    cube(mats.white,x,y+.16,z,.12,.08,1.0);
  }
  // Bridge handrail follows the actual slope, not floating horizontal boxes.
  const posts=[];
  for(let z=174;z<=222;z+=3.0){
    const x=C(z)-8.05,y=H(x,z);
    posts.push({x,y,z});
    cube(mats.rail,x,y+.70,z,.09,1.40,.09);
  }
  for(let j=1;j<posts.length;j++){
    const a=posts[j-1],b=posts[j];
    for(const height of [.60,1.08]){
      cable(scene,new T.Vector3(a.x,a.y+height,a.z),
        new T.Vector3(b.x,b.y+height,b.z),mats.rail,.04);
    }
  }
}
function straightContinuation(scene,C,H){
  // The hillside commute takes the LEFT road; the RIGHT branch is scenery.
  // Narrow both ends into a taper so the secondary sidewalks cannot cross
  // the main roadway as enormous gray triangular / X-shaped surfaces.
  const taper=t=>{
    const u=Math.max(0,Math.min(1,(1-t)/.27));
    return u*u*(3-2*u);
  };
  raisedStrip(scene,C,H,102,162,t=>-3.32*taper(t),t=>3.32*taper(t),mats.road,.079);
  // Pavements stop before the asphalt reaches the primary fork. They never
  // form the giant gray slabs previously seen over the centerline.
  raisedStrip(scene,C,H,104,149,t=>-5.48*taper(t),t=>-3.89*taper(t),mats.concrete,.128);
  raisedStrip(scene,C,H,104,149,t=>3.89*taper(t),t=>5.48*taper(t),mats.concrete,.128);
  // Only the fully separated portion has an additional road marking.
  raisedStrip(scene,C,H,105,131,()=>-.045,()=>.045,mats.white,.115);
  const signZ=137,signX=C(signZ)+7.3,signY=H(signX,signZ);
  cube(mats.rail,signX,signY+1.90,signZ,.11,3.80,.11);
  canvasSign(scene,'좌측 상명대','통학로 · 서행',signX-.25,signY+3.45,signZ,3.25,1.08);
}
function rightRetainingWall(scene,C,H){
  // The tall pale right-hand wall in the second street-view photograph, with
  // repeated joints and a narrow safety rail above the pedestrian sidewalk.
  const n=65,z0=155,z1=207;
  const vertices=[],indices=[],tops=[];
  for(let i=0;i<=n;i++){
    const z=z0+(z1-z0)*i/n,x=C(z)+9.26,y=H(x,z)-.2;
    const height=3.2+.72*Math.sin(Math.PI*i/n);
    vertices.push(x,y,z,x,y+height,z);
    tops.push({x,y:y+height,z});
    if(i<n){
      const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  const wall=new T.Mesh(geo,mats.wall);wall.receiveShadow=true;scene.add(wall);
  for(let i=0;i<=n;i+=5){
    const p=tops[i],q=tops[Math.min(n,i+5)];
    cube(mats.concrete,p.x,p.y-.01,p.z,.27,.19,1.1);
    cube(mats.rail,p.x,p.y+.47,p.z,.075,.93,.075);
    if(i<n) cable(scene,
      new T.Vector3(p.x,p.y+.89,p.z),new T.Vector3(q.x,q.y+.89,q.z),mats.rail,.042);
  }
  // Slope-side trees peeking over the retaining wall.
  const random=rng(4908);
  const leaves=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),mats.foliage,16);
  const t=new T.Object3D();
  for(let i=0;i<16;i++){
    const z=158+i*2.88+random()*1.7,x=C(z)+13.8+random()*3.6,y=H(x,z);
    t.position.set(x,y+3.9,z);
    t.scale.set(1.65+random()*.9,2.6+random()*.9,2.1+random()*.7);
    t.rotation.set(.1,random()*3.0,.05);
    t.updateMatrix();leaves.setMatrixAt(i,t.matrix);
  }
  leaves.instanceMatrix.needsUpdate=true;scene.add(leaves);
}
function lowShops(scene,C,H){
  // Staggered shop and residence blocks along the left side of the first climb.
  const palettes=[
    new T.MeshStandardMaterial({color:'#c0c7be',roughness:.93}),
    new T.MeshStandardMaterial({color:'#c8bcb2',roughness:.93}),
    new T.MeshStandardMaterial({color:'#a7b8b6',roughness:.93})
  ];
  for(const [k,z,side,offset,width,depth,ht] of [
    [0,204,-1,18.7,11.0,14,9.8],
    // The former placeholder at z=176 hid the school on the fork's left.
    [2,137,1,29.0,17.0,14,11.8]
  ]){
    const x=C(z)+side*offset,ground=H(x,z);
    cube(mats.concrete,x,ground-.46,z,width+.2,1.2,depth+.25);
    cube(palettes[k],x,ground+ht*.49,z,width,ht,depth);
    cube(mats.dark,x,ground+ht+.05,z,width+.35,.24,depth+.3);
    const frontX=x-side*(width*.5+.08);
    // Exterior on the road-facing side of every building.
    for(let floor=0;floor<3;floor++){
      for(let j=0;j<4;j++){
        const zz=z+(j-1.5)*2.55,yy=ground+2.8+floor*2.33;
        if(yy>ground+ht-.8)continue;
        cube(mats.frames,frontX,yy,zz,.18,1.48,1.87);
        cube(mats.glass,frontX-side*.10,yy,zz,.19,1.28,1.68);
      }
    }
    cube(mats.dark,frontX-side*.27,ground+1.38,z,.28,2.24,depth*.74);
    cube(mats.yellow,frontX-side*.32,ground+2.65,z,.33,.26,depth*.78);
  }
}
function roadFurniture(scene,C,H){
  for(const z of [201,164,125,96]){
    const x=C(z)+9.1,y=H(x,z),h=7.4;
    cube(mats.rail,x,y+h*.5,z,.16,h,.16);
    cube(mats.rail,x-1.25,y+h-.47,z,2.65,.11,.11);
    cube(mats.white,x-2.36,y+h-.55,z,.40,.15,.22);
  }
  const poleZ=[201,164,125,96];
  for(let k=0;k<poleZ.length-1;k++){
    for(const dy of [.25,.68,1.06]){
      const za=poleZ[k],zb=poleZ[k+1];
      const ax=C(za)+9.1,ay=H(ax,za)+7.2-dy;
      const bx=C(zb)+9.1,by=H(bx,zb)+7.2-dy;
      const points=[];
      for(let j=0;j<=16;j++){
        const t=j/16,z=za+(zb-za)*t;
        const x=ax+(bx-ax)*t;
        const y=ay+(by-ay)*t-.83*Math.sin(Math.PI*t);
        points.push(new T.Vector3(x,y,z));
      }
      scene.add(new T.Line(new T.BufferGeometry().setFromPoints(points),
        new T.LineBasicMaterial({color:'#505d61',transparent:true,opacity:.64})));
    }
  }
  const signZ=180,signX=C(signZ)+8.1,signY=H(signX,signZ);
  cube(mats.rail,signX,signY+3.22,signZ,.17,6.44,.17);
  cube(mats.rail,signX-1.25,signY+6.07,signZ,2.55,.12,.12);
  canvasSign(scene,'어린이 보호구역','30 · 서행',signX-2.22,signY+5.49,signZ,3.83,1.3);
  // Separate small blue pedestrian direction plaque.
  const plate=new T.Mesh(new T.PlaneGeometry(1.65,.55),
    new T.MeshBasicMaterial({color:'#345c77',side:T.DoubleSide}));
  plate.position.set(signX-.30,signY+3.93,signZ+.16);scene.add(plate);
}
function parkedCar(scene,C,H,z,side,color){
  const x=C(z)+side*1.75;
  const group=new T.Group();
  group.position.set(x,H(x,z)+.15,z);
  // The upper end of the car tracks the road grade.
  group.rotation.x=Math.atan(z>87?.14:.25);
  const paint=new T.MeshStandardMaterial({color,roughness:.37,metalness:.12});
  const glazing=new T.MeshStandardMaterial({color:'#405762',roughness:.30,metalness:.15});
  const rubber=new T.MeshStandardMaterial({color:'#282e30',roughness:.9});
  const lamp=new T.MeshBasicMaterial({color:'#d6d0b8'});
  function part(geo,mat,x,y,z){
    const m=new T.Mesh(geo,mat);m.position.set(x,y,z);group.add(m);return m;
  }
  part(new T.BoxGeometry(1.81,.59,3.94),paint,0,.62,0);
  part(new T.BoxGeometry(1.51,.57,1.92),glazing,0,1.13,-.18);
  part(new T.BoxGeometry(1.73,.075,1.85),paint,0,1.46,-.18);
  for(const a of [-1,1]){
    for(const b of [-1.18,1.16]){
      const wheel=part(new T.CylinderGeometry(.34,.34,.15,10),rubber,a*.94,.36,b);
      wheel.rotation.z=Math.PI/2;
    }
    part(new T.BoxGeometry(.31,.13,.08),lamp,a*.58,.72,-1.99);
  }
  scene.add(group);
}
export function addLowerHillApproach(scene,{center,straightFork,heightAt,compact=false}){
  lowerStreet(scene,center,heightAt);
  straightContinuation(scene,straightFork,heightAt);
  rightRetainingWall(scene,center,heightAt);
  lowShops(scene,center,heightAt);
  roadFurniture(scene,center,heightAt);
  // No car beside the starting traveler. A stationary car remains farther up
  // the non-traversable branch as scenery; nobody can walk through it.
  if(!compact) parkedCar(scene,straightFork,heightAt,110,1,'#e8ebea');
  flush(scene);
}

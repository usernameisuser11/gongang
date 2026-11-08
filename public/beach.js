import * as T from 'three';
import { rng, fbm, smooth } from './nature.js';
import { coast } from './shore-motion.js';
import { makeBeachWater } from './beach-water.js';
import { makeBeachMoisture, applyBeachMoisture } from './beach-moisture.js';

// An open, walkable sandy shore where up to eight travelers can gather.
// +Z is inland; the sea stretches toward -Z.
function heightAt(x,z){
  const d=z-coast(x);
  const slope=Math.max(0,d);
  const dune=smooth(12,53,slope)*(.44+.47*fbm(x*.046,z*.053));
  const edge=.34*smooth(18,46,Math.abs(x))*smooth(10,38,slope);
  return -.13+.065*slope+dune+edge+(fbm(x*.14,z*.16)-.5)*.035;
}
const rocks=[[-44,3,1.4],[-46,7,2.1],[48,-1,1.5],[50,8,2.0],[-37,31,1.8],[38,34,1.5]];
const pines=[[-52,22,8.4],[-54,32,8.1],[-44,42,7.5],[54,26,8.5],[46,42,6.8],[55,43,9.0]];
function canWalk(x,z){
  if(Math.abs(x)>55||z>50||z<coast(x)+1.8)return false;
  for(const [rx,rz,scale] of rocks)if(Math.hypot(x-rx,z-rz)<scale*.57+.45)return false;
  for(const [px,pz] of pines)if(Math.hypot(x-px,z-pz)<.9)return false;
  return true;
}
function material(color,other={}){return new T.MeshStandardMaterial({color,roughness:.94,...other});}
function add(mesh,scene,x=0,y=0,z=0){mesh.position.set(x,y,z);scene.add(mesh);return mesh;}
function sand(scene, compact, moisture, light){
  const nx=compact?129:177,nz=compact?81:110,p=[],color=[],idx=[],xs=[];
  const wet=new T.Color('#a78e70'),gold=new T.Color('#d4be8f');
  const dry=new T.Color('#f0d4a2'),edge=new T.Color('#bcaa87'),t=new T.Color();
  for(let i=0;i<nx;i++)xs.push(-96+i*192/(nx-1));
  for(let j=0;j<nz;j++){
    const z=-38+j*103/(nz-1);
    for(let i=0;i<nx;i++){
      const x=xs[i],d=z-coast(x);
      const y=heightAt(x,z),n=fbm(x*.075+8,z*.095-2),fine=fbm(x*.53+12,z*.45);
      t.copy(wet).lerp(gold,smooth(.1,5.8,d)).lerp(dry,smooth(4.7,23,d)*.8);
      t.lerp(edge,smooth(37,75,Math.abs(x))*.36);
      t.multiplyScalar(.94+.08*n+.04*fine);
      p.push(x,y,z);color.push(t.r,t.g,t.b);
      if(i<nx-1&&j<nz-1){const a=j*nx+i,b=a+nx;idx.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setAttribute('color',new T.Float32BufferAttribute(color,3));
  g.setIndex(idx);g.computeVertexNormals();
  const surface=material('#ffffff',{vertexColors:true});
  applyBeachMoisture(surface,moisture,light);
  const beach=new T.Mesh(g,surface);
  scene.add(beach);
  return beach;
}
function boulder(scene,x,z,r,i){
  const geom=new T.IcosahedronGeometry(1,2);
  const a=geom.attributes.position;
  for(let j=0;j<a.count;j++){
    const px=a.getX(j),py=a.getY(j),pz=a.getZ(j);
    const n=.89+.17*fbm(px*3+i,pz*3+py);
    a.setXYZ(j,px*n,py*n,pz*n);
  }
  geom.computeVertexNormals();
  const colors=['#89857b','#a09a8a','#817f78','#a99e88'];
  const stone=new T.Mesh(geom,material(colors[i%colors.length],{flatShading:false}));
  stone.scale.set(r*1.17,r*.63,r*.91);
  stone.rotation.y=i*2.08;add(stone,scene,x,heightAt(x,z)+r*.20,z);
}
function coastalPines(scene, random) {
  // Batch timber and small irregular needle clusters into two draws.
  const branchCount=11, clusterCount=21;
  const timber=new T.InstancedMesh(new T.CylinderGeometry(.48,1,1,8),material('#746154'),pines.length*branchCount);
  const foliage=new T.IcosahedronGeometry(1,2);
  const points=foliage.attributes.position;
  for(let i=0;i<points.count;i++){
    const x=points.getX(i),y=points.getY(i),z=points.getZ(i);
    const shape=.77+.40*fbm(x*2.8+y*1.5,z*2.8-y*1.4);
    points.setXYZ(i,x*shape,y*shape,z*shape);
  }
  foliage.computeVertexNormals();
  const needles=new T.InstancedMesh(foliage,material('#ffffff'),pines.length*clusterCount);
  const greens=['#4d675a','#617b64','#70866b','#3b594e'].map(c=>new T.Color(c));
  const part=new T.Object3D(), root=new T.Vector3(), tip=new T.Vector3(), up=new T.Vector3(0,1,0);
  const axis=new T.Vector3();
  let branchIndex=0,clusterIndex=0;
  function segment(from,to,radius){
    part.position.copy(from).lerp(to,.5);
    axis.subVectors(to,from);
    part.scale.set(radius,axis.length(),radius);
    part.quaternion.setFromUnitVectors(up,axis.normalize());
    part.updateMatrix();
    timber.setMatrixAt(branchIndex++,part.matrix);
  }
  function cluster(x,y,z,sx,sy,sz,angle,color){
    part.position.set(x,y,z);part.scale.set(sx,sy,sz);
    part.rotation.set(.13*Math.sin(angle),angle,.17*Math.cos(angle));
    part.updateMatrix();needles.setMatrixAt(clusterIndex,part.matrix);
    needles.setColorAt(clusterIndex++,greens[color%greens.length]);
  }
  pines.forEach(([x,z,h],index)=>{
    const ground=heightAt(x,z),bend=index%2===0?-.48:.34;
    root.set(x,ground-.09,z);tip.set(x+bend,ground+h*.91,z+.27);
    segment(root,tip,.26);
    for(let i=0;i<10;i++){
      const angle=i*2.39996+index*.63;
      const level=.53+i*.033;
      const spread=(.93-i*.042)*(1.8+.85*random());
      const bx=Math.cos(angle)*spread,bz=Math.sin(angle)*spread;
      const branchY=ground+h*level;
      root.set(x+bend*level,branchY-.66,z+.13);
      tip.set(x+bx+bend*level,branchY+.16+random()*.52,z+bz);
      segment(root,tip,.088-i*.004);
      for(let j=0;j<2;j++){
        cluster(tip.x+bx*.25*j,tip.y+(.08+j*.26)*h*.26,tip.z+bz*.30*j,
          h*(.113+.049*random()),h*(.052+.037*random()),h*(.10+.040*random()),angle+j*.8,index+i+j);
      }
    }
    cluster(x+bend,ground+h*.92,z+.19,h*.17,h*.12,h*.15,index,index);
  });
  timber.computeBoundingSphere();needles.computeBoundingSphere();
  scene.add(timber,needles);
}
// A single quiet holiday nook at the right edge of the beach. The centre stays
// empty so visitors can still meet, walk and photograph the uninterrupted sea.
function beachRetreat(scene){
  const retreat=new T.Group();
  retreat.position.set(34,heightAt(34,20),20);
  scene.add(retreat);
  const timber=material('#ac9175',{roughness:.93});
  const frame=material('#d6c2a2',{roughness:.9});
  const linen=material('#e8e0cc',{roughness:1,side:T.DoubleSide});
  const shade=new T.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:1,side:T.DoubleSide});
  const ivory=new T.Color('#f5ecd7'),seafoam=new T.Color('#bdd2ca');
  const positions=[],colors=[],indices=[];
  const sections=20;
  // Four curved fabric bands per panel, slightly scalloped at the hem.
  const radii=[.08,.5,1.12,1.65,2.04];
  const rises=[3.12,3.10,2.98,2.77,2.46];
  for(let panel=0;panel<sections;panel++){
    const start=panel*2*Math.PI/sections;
    const end=(panel+1)*2*Math.PI/sections;
    const tone=panel%2===0?ivory:seafoam;
    const base=positions.length/3;
    for(let ring=0;ring<radii.length;ring++){
      const radius=radii[ring];
      for(const angle of [start,end]){
        const hem=ring===radii.length-1 ? .055*Math.cos((angle-start)*sections) : 0;
        positions.push(Math.cos(angle)*radius,rises[ring]+hem,Math.sin(angle)*radius);
        const light=1-.035*ring;
        colors.push(tone.r*light,tone.g*light,tone.b*light);
      }
      if(ring){
        const a=base+(ring-1)*2,b=base+ring*2;
        indices.push(a,b,a+1,a+1,b,b+1);
      }
    }
  }
  const canopyGeometry=new T.BufferGeometry();
  canopyGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  canopyGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  canopyGeometry.setIndex(indices);
  canopyGeometry.computeVertexNormals();
  const cloth=new T.Mesh(canopyGeometry,shade);
  cloth.castShadow=true;
  cloth.receiveShadow=true;
  retreat.add(cloth);

  const shaft=new T.Mesh(new T.CylinderGeometry(.065,.085,3.06,10),frame);
  shaft.position.y=1.58;shaft.castShadow=true;retreat.add(shaft);
  const cap=new T.Mesh(new T.SphereGeometry(.11,10,8),frame);
  cap.position.y=3.15;retreat.add(cap);
  const thinWood=material('#a68e74',{roughness:.95});
  const up=new T.Vector3(0,1,0);
  for(let i=0;i<sections;i++){
    const angle=i*Math.PI*2/sections,from=new T.Vector3(0,3.09,0);
    const to=new T.Vector3(Math.cos(angle)*2.01,2.45,Math.sin(angle)*2.01);
    const offset=to.clone().sub(from),rib=new T.Mesh(new T.CylinderGeometry(.014,.014,offset.length(),5),thinWood);
    rib.position.copy(from).add(to).multiplyScalar(.5);
    rib.quaternion.setFromUnitVectors(up,offset.normalize());
    rib.castShadow=false;retreat.add(rib);
  }

  // Low wooden loungers with linen cushions; no driftwood or oversized props.
  for(const side of [-1,1]){
    const chair=new T.Group();
    chair.position.set(side*1.38,.02,-1.22);
    chair.rotation.y=side*.12;
    retreat.add(chair);
    function part(w,h,d,mat,x,y,z,tilt=0){
      const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);
      mesh.position.set(x,y,z);mesh.rotation.x=tilt;
      mesh.castShadow=true;mesh.receiveShadow=true;chair.add(mesh);
      return mesh;
    }
    for(const x of [-.48,.48]){
      part(.085,.12,1.77,timber,x,.43,-.35);
      for(const z of [-1.02,.42])part(.085,.42,.09,timber,x,.23,z);
    }
    part(.94,.085,1.41,linen,0,.47,-.48);
    part(1.02,.085,.90,linen,0,.76,.52,-.86);
    part(.98,.09,.15,frame,0,.91,.81,-.86);
    part(.91,.035,.19,frame,0,.50,-1.22);
  }
  return retreat;
}

export function makeBeach(scene,time,compact,light){
  const moisture=makeBeachMoisture(time,compact);
  const ground=sand(scene,compact,moisture,light);
  makeBeachWater(scene,time,compact,heightAt,light);
  for(let i=0;i<rocks.length;i++)boulder(scene,...rocks[i],i);
  coastalPines(scene,rng(26081108));
  beachRetreat(scene);
  const spawnPoints=[
    {x:-5,z:10},{x:-2.2,z:12},{x:1,z:10},{x:4,z:12},
    {x:-7,z:17},{x:7,z:17},{x:-3,z:20},{x:3,z:20}
  ];
  return {
    heightAt,canWalk,spawnPoints,
    pick(raycaster){return raycaster.intersectObject(ground,false)[0]?.point??null;},
    update:moisture.update
  };
}

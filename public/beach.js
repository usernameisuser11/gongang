import * as T from 'three';
import { rng, fbm, smooth } from './nature.js';
import { coast } from './shore-motion.js';
import { makeBeachWater } from './beach-water.js';
import { makeBeachMoisture, applyBeachMoisture } from './beach-moisture.js';
import { addGroundCover } from './groundcover.js';

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
function logs(scene){
  const timber=material('#9b8069'),ends=material('#d0b18d');
  // Low driftwood seating beside the central sand, leaving a gathering circle open.
  for(const [x,z,a] of [[-13,7,.23],[12.5,6,-.35],[-17,22,.66],[18,20,-.65]]){
    const g=new T.Group();g.position.set(x,heightAt(x,z)+.23,z);g.rotation.y=a;scene.add(g);
    const body=new T.Mesh(new T.CylinderGeometry(.26,.31,3.9,9),timber);
    body.rotation.z=Math.PI/2;g.add(body);
    for(const sign of [-1,1]){
      const end=new T.Mesh(new T.CylinderGeometry(.272,.272,.045,12),ends);
      end.rotation.z=Math.PI/2;end.position.x=sign*1.95;g.add(end);
    }
  }
}
export function makeBeach(scene,time,compact,light){
  const moisture=makeBeachMoisture(time,compact);
  const ground=sand(scene,compact,moisture,light);
  makeBeachWater(scene,time,compact,heightAt,light);
  for(let i=0;i<rocks.length;i++)boulder(scene,...rocks[i],i);
  coastalPines(scene,rng(26081108));
  logs(scene);
  // Sparse dune grasses live on dry outer sand only, leaving the shared central
  // beach and the active swash completely open to visitors.
  addGroundCover(T,scene,{
    seed:58092,count:compact?550:1450,bounds:[-88,6,88,59],
    allow:(x,z)=>Math.abs(x)>29&&z>coast(x)+22&&z<58&&Math.abs(x)<82,
    heightAt,colors:['#a29b6c','#bbb184','#868b62','#c5ad79','#98916d']
  });
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

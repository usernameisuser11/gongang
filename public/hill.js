import * as T from 'three';
import { fbm, noise, rng, smooth } from './nature.js';
import { addHillDetails } from './hill-detail.js';
import { HILL_CHECKPOINTS, addHillCommute } from './hill-route.js';
import { addHillStreetscape, streetSurfaceMaterials } from './hill-streetscape.js';

// A painterly reinterpretation of the memorable Sangmyung uphill walk, not a survey map.
const edgeA = -112, edgeB = 108;
const center = z => 2.35*Math.sin((z+4)*.052)+1.35*Math.sin(z*.026+1.7);
const climb = z => 7.2 + (49-z)*.252 + .36*Math.sin((z+9)*.053);

function groundHeight(x,z) {
  const dx=Math.abs(x-center(z));
  const shoulder=Math.max(0,dx-7.2);
  const slope=shoulder*.17 + shoulder*shoulder*.009;
  return climb(z)+slope+(fbm(x*.13+11,z*.12)-.5)*.72*smooth(7,14,dx);
}
function canWalk(x,z) {
  // Keep the parked 7016 bus solid while the pedestrian path remains open.
  const busZ=-38, busX=center(busZ)+1.85;
  return z > -76 && z < 83 && Math.abs(x-center(z)) < 8.12
    && !(Math.abs(x-busX)<1.30 && Math.abs(z-busZ)<3.52);
}
const c = v => new T.Color(v);

function land(scene) {
  const nx=151,nz=182, positions=[],colors=[],indices=[];
  const meadow=c('#536b49'), leaf=c('#84975e'), moss=c('#355c51'), stone=c('#80776c');
  const color=new T.Color();
  for(let j=0;j<nz;j++) {
    const z=edgeA+(edgeB-edgeA)*j/(nz-1);
    for(let i=0;i<nx;i++) {
      const x=-50+100*i/(nx-1),y=groundHeight(x,z);
      const d=Math.abs(x-center(z)),grain=fbm(x*.085+12,z*.092+5);
      color.copy(meadow).lerp(leaf,.15+.6*grain).lerp(moss,.30*fbm(x*.035,z*.07));
      color.lerp(stone,Math.max(0,smooth(16,37,d))*.22);
      color.multiplyScalar(.9+noise(x*.47,z*.51)*.19);
      positions.push(x,y,z); colors.push(color.r,color.g,color.b);
      if(i<nx-1&&j<nz-1){
        const a=i+j*nx,b=a+nx; indices.push(a,a+1,b,a+1,b+1,b);
      }
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));
  scene.add(mesh);return mesh;
}

function ribbon(scene,left,right,z0,z1,mat,lift=.065) {
  const positions=[],uv=[],idx=[];
  const steps=180;
  for(let j=0;j<=steps;j++) {
    const z=z0+(z1-z0)*j/steps, mid=center(z);
    for(const off of [left,right]){
      const x=mid+off;
      positions.push(x,groundHeight(x,z)+lift,z);
      uv.push(off===left?0:1,(z-z0)/2.1);
    }
    if(j<steps){const i=j*2;idx.push(i,i+2,i+1,i+1,i+2,i+3);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(idx);g.computeVertexNormals();
  const surface=new T.Mesh(g,mat);surface.receiveShadow=true;scene.add(surface);
}

function box(scene,geometry,material,x,y,z,rot=0) {
  const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.rotation.y=rot;scene.add(m);return m;
}

function makeRoad(scene) {
  const surface=streetSurfaceMaterials();
  const road=surface.asphalt;
  const pavement=surface.sidewalk;
  const line=new T.MeshBasicMaterial({color:'#d8c49a',side:T.DoubleSide});
  const border=new T.MeshStandardMaterial({color:'#b6ac9b',roughness:.95,side:T.DoubleSide});
  ribbon(scene,-3.95,3.95,-76,86,road,.095);
  ribbon(scene,-6.7,-4.2,-76,86,pavement,.16);
  ribbon(scene,4.2,6.7,-76,86,pavement,.16);
  ribbon(scene,-4.20,-4.07,-76,86,border,.22);
  ribbon(scene,4.07,4.20,-76,86,border,.22);
  ribbon(scene,-.075,.075,-76,86,line,.111);
  // Soft roadside stones and garden strips break up the straight road edges.
  const random=rng(718);
  const stones=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:'#858579',roughness:1}),160);
  const temp=new T.Object3D();
  for(let i=0;i<160;i++){
    const z=-64+random()*112;
    const side=i%2?-1:1;
    const x=center(z)+side*(7.4+random()*5.9);
    temp.position.set(x,groundHeight(x,z)+.045,z);
    temp.rotation.set(random()*.3,random()*6.28,random()*.3);
    temp.scale.set(.12+random()*.22,.11+random()*.19,.18+random()*.27);
    temp.updateMatrix();stones.setMatrixAt(i,temp.matrix);
  }
  scene.add(stones);
}

function plants(scene,compact) {
  const random=rng(7316),stemMat=new T.MeshStandardMaterial({color:'#62554a',roughness:1});
  const foliageMat=new T.MeshStandardMaterial({vertexColors:false,roughness:.94,side:T.DoubleSide});
  const trunkGeo=new T.CylinderGeometry(.095,.19,3.35,6);
  const branchGeo=new T.CylinderGeometry(.015,.065,1.5,5);
  // Layered, irregular leaf silhouettes instead of round polygon blobs.
  const canopyGeo=new T.BufferGeometry();
  canopyGeo.setAttribute('position',new T.Float32BufferAttribute([
    0,0,0,-.52,.28,.06,-.14,.81,.08, 0,0,0,-.14,.81,.08,.47,.22,.06,
    0,.07,-.12,-.32,.44,.03,.08, 0,.07,-.12,.08,1.0,.01,.37,.40,.03,
    0,.12,.06,-.33,.31,-.22,0,.69,.05, 0,.12,.06,0,.69,.05,.36,.27,-.22
  ],3));
  canopyGeo.computeVertexNormals();
  const treeCount=compact?37:53;
  const trunk=new T.InstancedMesh(trunkGeo,stemMat,treeCount);
  const branches=new T.InstancedMesh(branchGeo,stemMat,treeCount*4);
  const foliagePerTree=compact?78:108;
  const leaves=new T.InstancedMesh(canopyGeo,foliageMat,treeCount*foliagePerTree);
  const temp=new T.Object3D(), tint=new T.Color();
  for(let k=0;k<treeCount;k++){
    const z=-67+random()*120,side=k%2?-1:1;
    // Keep the start view and the '공강' HUD free of close canopy occlusion.
    const offset=9.7+Math.pow(random(),1.65)*23;
    const cleared=side===-1 && z>26 && z<75 ? Math.max(36,offset)
      : side===-1 && z>=7 && z<=26 ? Math.max(28,offset) : offset;
    const x=center(z)+side*cleared;
    const h=groundHeight(x,z);
    const size=.84+random()*.85;
    temp.position.set(x,h+1.65*size,z);
    temp.rotation.set(.09*side,random()*.8,.12*side);
    temp.scale.set(size,size,size);
    temp.updateMatrix();trunk.setMatrixAt(k,temp.matrix);
    for(let b=0;b<4;b++){
      const a=b*Math.PI*.5+.3*random();
      temp.position.set(x+Math.cos(a)*.7*size,h+(2.5+random()*1.1)*size,z+Math.sin(a)*.7*size);
      temp.rotation.set(Math.sin(a)*.55,0,-Math.cos(a)*.65);
      temp.scale.set(size,size,size);
      temp.updateMatrix();branches.setMatrixAt(k*4+b,temp.matrix);
    }
    for(let j=0;j<foliagePerTree;j++){
      const a=(j/foliagePerTree)*Math.PI*2*4.2 + .52*random();
      const radial=j%7===0?0.32:(.53+random()*1.12);
      const cx=x+Math.cos(a)*radial*size;
      const cz=z+Math.sin(a)*radial*.74*size;
      temp.position.set(cx,h+(3.20+(j%8)*.23+random()*.33)*size,cz);
      temp.rotation.set(random()*.4,random()*6.28,random()*.45);
      temp.scale.set((.44+random()*.33)*size,(.49+random()*.32)*size,(.45+random()*.34)*size);
      temp.updateMatrix();leaves.setMatrixAt(k*foliagePerTree+j,temp.matrix);
      tint.set(['#456b58','#6d885f','#8c9b73','#536a59','#a3a178'][Math.floor(random()*5)]);
      leaves.setColorAt(k*foliagePerTree+j,tint);
    }
  }
  scene.add(trunk,branches,leaves);
  // A narrow field of wildflowers beside the pedestrian path.
  const flowers=new T.InstancedMesh(new T.TetrahedronGeometry(1,0),
    new T.MeshStandardMaterial({color:'#ead5ad',roughness:1}),compact?260:520);
  for(let i=0;i<flowers.count;i++){
    const z=-63+random()*109,side=i%2?1:-1;
    const x=center(z)+side*(7.5+random()*3.8);
    temp.position.set(x,groundHeight(x,z)+.10+random()*.17,z);
    temp.scale.set(.025+random()*.035,.045+random()*.035,.025+random()*.03);
    temp.rotation.set(0,random()*6.28,0);temp.updateMatrix();flowers.setMatrixAt(i,temp.matrix);
  }
  scene.add(flowers);
}

function buildings(scene) {
  const random=rng(2604);
  const walls=['#b4a596','#c4b7a8','#9eafa4','#ccbba0','#a7a5a0'];
  const glass=new T.MeshStandardMaterial({color:'#698890',metalness:.12,roughness:.4});
  const roof=new T.MeshStandardMaterial({color:'#79685f',roughness:.95});
  const windowGeo=new T.BoxGeometry(.75,.83,.08);
  const campusMat=new T.MeshStandardMaterial({color:'#a69f97',roughness:1});
  const addHouse=(x,z,w,h,d,index)=>{
    const floor=groundHeight(x,z);
    const wall=new T.MeshStandardMaterial({color:walls[index%walls.length],roughness:.98});
    box(scene,new T.BoxGeometry(w,h,d),wall,x,floor+h/2-.25,z);
    const cap=box(scene,new T.BoxGeometry(w+.55,.32,d+.55),roof,x,floor+h-.08,z);
    cap.rotation.z=.023*(index%2?-1:1);
    const front=x<0?1:-1;
    for(let row=0;row<2;row++)for(let col=0;col<Math.min(3,Math.floor(w/1.8));col++){
      const offset=(col-(Math.min(3,Math.floor(w/1.8))-1)/2)*1.55;
      box(scene,windowGeo,glass,x+offset,floor+1.5+row*1.5,z+front*(d*.5+.025));
    }
  };
  for(let i=0;i<12;i++){
    const z=-51+i*8.25, side=i%2?-1:1;
    const x=center(z)+side*(17.5+random()*7.8);
    addHouse(x,z,5.0+random()*2.5,4.1+random()*2,6+random()*2,i);
  }
  // The top-of-hill campus silhouette is deliberately fictionalized.
  const top=-69.5;
  addHouse(center(top)-14,top,22,10,9,0);
  addHouse(center(top)+13,top-5,18,12,10,2);
  const signMat=new T.MeshStandardMaterial({color:'#e2d7bd',roughness:.92});
  box(scene,new T.BoxGeometry(6.6,.92,.3),signMat,center(-59)-9,groundHeight(center(-59)-9,-59)+3.4,-59);
  const post=new T.MeshStandardMaterial({color:'#4f6463',roughness:.87});
  box(scene,new T.BoxGeometry(.2,3.1,.2),post,center(-59)-12,groundHeight(center(-59)-12,-59)+1.5,-59);
  box(scene,new T.BoxGeometry(.2,3.1,.2),post,center(-59)-6,groundHeight(center(-59)-6,-59)+1.5,-59);
  // Benches make the walk feel like a refuge rather than a speed challenge.
  const wood=new T.MeshStandardMaterial({color:'#91725d',roughness:.97});
  for(const z of [26,-12,-42]){
    const side=z===-12?-1:1, x=center(z)+side*8.35, y=groundHeight(x,z);
    box(scene,new T.BoxGeometry(2.05,.12,.48),wood,x,y+.57,z);
    box(scene,new T.BoxGeometry(2.05,.74,.12),wood,x,y+1.0,z+side*.24);
    for(const offset of [-.78,.78]){
      box(scene,new T.BoxGeometry(.10,.62,.14),post,x+offset,y+.30,z);
    }
  }
  // The lampposts cast small warm highlights after sunset.
  const pole=new T.MeshStandardMaterial({color:'#495b59',roughness:.9});
  const glow=new T.MeshBasicMaterial({color:'#ffe0a5'});
  for(let i=0;i<12;i++){
    const z=-58+i*9.1,side=i%2?-1:1;
    const x=center(z)+side*7.15,y=groundHeight(x,z);
    box(scene,new T.CylinderGeometry(.052,.078,4.0,7),pole,x,y+2,z);
    box(scene,new T.SphereGeometry(.165,9,7),glow,x,y+4.05,z);
  }
}

export function makeHill(scene,time,compact=false) {
  const surface=land(scene);
  makeRoad(scene);
  // The detailed roadside residences replace the earlier placeholder houses.
  plants(scene,compact);
  addHillDetails(scene,{center,heightAt:groundHeight});
  addHillStreetscape(scene,{center,heightAt:groundHeight,compact});
  addHillCommute(scene,{center,heightAt:groundHeight});
  // Keep travelers' feet aligned to the raised asphalt and pavement meshes.
  const walkingHeight=(x,z)=>{
    const offset=Math.abs(x-center(z));
    return groundHeight(x,z)+(offset<=3.95?.095:offset>=4.2&&offset<=6.7?.16:.02);
  };
  const terrain={
    spawn:{x:center(77)-5.35,z:77},
    spawnFor(id){
      const point=HILL_CHECKPOINTS.find(p=>p.id===id);
      return point ? {x:center(point.z)-5.35,z:point.z} : this.spawn;
    },
    checkpoints:HILL_CHECKPOINTS,
    heightAt:walkingHeight,canWalk,
    pick(raycaster){return raycaster.intersectObject(surface,false)[0]?.point??null}
  };
  return terrain;
}

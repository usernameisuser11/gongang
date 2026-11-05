import * as T from 'three';
import { rng } from './nature.js';

// Sculpted from recurring features in public photos of the Hongjimun 2-gil approach.
// This is an artistic, recognizable re-creation rather than a surveyed street map.
const materials={
  roadText:new T.MeshBasicMaterial({color:'#e6e4d9',roughness:1,side:T.DoubleSide}),
  stone:new T.MeshStandardMaterial({color:'#888780',roughness:1}),
  cap:new T.MeshStandardMaterial({color:'#aca99f',roughness:.95}),
  iron:new T.MeshStandardMaterial({color:'#536b68',roughness:.66,metalness:.22}),
  pale:new T.MeshStandardMaterial({color:'#d2d3cc',roughness:.92}),
  roof:new T.MeshStandardMaterial({color:'#6f726e',roughness:.94}),
  glass:new T.MeshStandardMaterial({color:'#688c9a',roughness:.31,metalness:.15}),
  dark:new T.MeshStandardMaterial({color:'#3e626f',roughness:.36,metalness:.18}),
  tactile:new T.MeshStandardMaterial({color:'#d0be78',roughness:1,side:T.DoubleSide}),
  bench:new T.MeshStandardMaterial({color:'#8d755b',roughness:.96})
};
const V=(x,y,z)=>new T.Vector3(x,y,z);
// Batch repeated windows, facade strips, stair treads and wall pieces by material.
// Hundreds of individual draw calls would otherwise overwhelm mobile GPUs.
const pendingBoxes=new Map();
function box(scene,dim,mat,x,y,z){
  if (![...dim,x,y,z].every(Number.isFinite)) return;
  let batch=pendingBoxes.get(mat);
  if (!batch){batch=[];pendingBoxes.set(mat,batch);}
  batch.push({dim,x,y,z});
}
function flushBoxes(scene) {
  const transform=new T.Object3D();
  for(const [mat,batch] of pendingBoxes){
    const mesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),mat,batch.length);
    for(let i=0;i<batch.length;i++){
      const {dim,x,y,z}=batch[i];
      transform.position.set(x,y,z);
      transform.scale.set(dim[0],dim[1],dim[2]);
      transform.updateMatrix();
      mesh.setMatrixAt(i,transform.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.receiveShadow=true;
    scene.add(mesh);
  }
  pendingBoxes.clear();
}
function slopedPlane(scene,mat,x,z,height,width,depth=.76){
  const plane=new T.Mesh(new T.PlaneGeometry(width,depth),mat);
  plane.rotation.x=-Math.PI/2+Math.atan(.252);
  plane.position.set(x,height,z);plane.renderOrder=2;scene.add(plane);
  return plane;
}
function textTexture(text,fg='#e8e9e3',background=null){
  const canvas=document.createElement('canvas');
  canvas.width=512;canvas.height=256;
  const cx=canvas.getContext('2d');
  if(background){cx.fillStyle=background;cx.fillRect(0,0,512,256);}
  cx.fillStyle=fg;
  cx.textAlign='center';cx.textBaseline='middle';
  cx.font='800 126px "Malgun Gothic", "Noto Sans KR", sans-serif';
  cx.fillText(text,256,128,490);
  const tex=new T.CanvasTexture(canvas);
  tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
  return tex;
}
function label(scene,text,x,y,z,w,h,bg='#315d77'){
  const mat=new T.MeshBasicMaterial({map:textTexture(text,'#f6f3e9',bg),side:T.DoubleSide});
  const mesh=new T.Mesh(new T.PlaneGeometry(w,h),mat);
  mesh.position.set(x,y,z);
  mesh.rotation.y=Math.PI/2;
  scene.add(mesh);
  return mesh;
}
function cylinderBetween(scene,a,b,r=.046){
  const delta=b.clone().sub(a),length=delta.length();
  const bar=new T.Mesh(new T.CylinderGeometry(r,r,length,6),materials.iron);
  bar.position.copy(a).addScaledVector(delta,.5);
  bar.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());
  scene.add(bar);
}
function markings(scene,C,H){
  // The incline's large white road warnings and two compact pedestrian crossings.
  for(const [text,z,width] of [['7016',27,4.3],['서대문08',-18,4.55],['상명대',-48,4.5]]){
    const mat=new T.MeshBasicMaterial({map:textTexture(text),transparent:true,depthWrite:false,side:T.DoubleSide});
    slopedPlane(scene,mat,C(z),z,H(C(z),z)+.145,width,2.3);
  }
  for(const z of [51,-56]){
    for(let i=0;i<8;i++){
      const xx=C(z)-3.35+i*.88;
      slopedPlane(scene,materials.roadText,xx,z,H(xx,z)+.15,.51,1.13);
    }
  }
  for(const z of [47,-8,-55]){
    for(const side of [-1,1]){
      const xx=C(z)+side*5.75;
      slopedPlane(scene,materials.tactile,xx,z,H(xx,z)+.236,1.22,.94);
    }
  }
}
function retainingWall(scene,C,H){
  const sections=[[1,-54,-12,9.6],[-1,-11,15,10]];
  for(const [side,start,end,offset] of sections){
    const count=Math.ceil((end-start)/2.7);
    let last=null;
    for(let i=0;i<count;i++){
      const z=start+(i+.5)*(end-start)/count;
      const x=C(z)+side*offset,foot=H(x,z),span=(end-start)/count;
      box(scene,[.82,2.45,span+.025],materials.stone,x,foot+1.12,z);
      box(scene,[.92,.18,span+.04],materials.cap,x,foot+2.43,z);
      // Joints, stacked masonry and a rail are more recognizable than a bare cliff.
      if(i%2===0){
        box(scene,[.04,.31,span*.52],materials.cap,x-side*.426,foot+.72,z);
        const top=V(x,foot+3.41,z);
        box(scene,[.075,1.02,.075],materials.iron,x,foot+2.92,z);
        if(last)cylinderBetween(scene,last,top,.039);
        last=top;
      }
    }
  }
}
function brickMaterial(){
  const c=document.createElement('canvas');c.width=c.height=256;
  const x=c.getContext('2d'),r=rng(3466);
  x.fillStyle='#aba197';x.fillRect(0,0,256,256);
  for(let row=0;row<9;row++)for(let col=-1;col<5;col++){
    const xx=col*70+(row%2?35:0),y=row*29;
    x.fillStyle='rgb('+(113+Math.floor(r()*50))+','+(61+Math.floor(r()*27))+','+(51+Math.floor(r()*20))+')';
    x.fillRect(xx+2,y+2,66,25);
    x.fillStyle='rgba(245,208,162,.12)';x.fillRect(xx+3,y+3,62,2);
  }
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;
  return new T.MeshStandardMaterial({map:t,roughness:.99});
}
function houses(scene,C,H){
  const brick=brickMaterial(),white=materials.pale,glass=materials.dark;
  const foundations=new T.MeshStandardMaterial({color:'#77786e',roughness:1});
  const frameDark=new T.MeshStandardMaterial({color:'#474946',roughness:.96});
  // Irregular homes overlooking the road; no mirrored symmetrical housing rows.
  const rows=[
    [43,1,15.8,8,12,9.8],[-5,-1,15.2,8,11.8,11.4],
    [4,1,16.5,9,10.7,12.4],[-20,-1,15.2,10,12.1,13.8],
    [-39,1,16.8,9.1,12.3,13.2],[-56,-1,22.9,10,11.3,12.5]
  ];
  for(let i=0;i<rows.length;i++){
    const [z,side,offset,w,d,h]=rows[i];
    const x=C(z)+side*offset,bottom=H(x,z),face=x-side*(w/2+.05);
    // Stone basement connects buildings to the steep slope on the downhill side.
    box(scene,[w+.30,3.3,d+.24],foundations,x,bottom-1.53,z);
    box(scene,[w,h,d],i%3===1?white:brick,x,bottom+h*.5,z);
    box(scene,[w+.20,.14,d+.14],materials.cap,x,bottom+.18,z);
    box(scene,[w+.55,.3,d+.55],materials.roof,x,bottom+h,z);
    for(let floor=0;floor<Math.floor((h-1)/2.1);floor++){
      for(let col=0;col<4;col++){
        const zz=z+(col-1.5)*2.23,yy=bottom+1.7+floor*2.05;
        box(scene,[.16,1.31,1.19],materials.pale,face,yy,zz);
        box(scene,[.20,1.10,1.01],glass,face-side*.047,yy,zz);
        box(scene,[.235,.05,1.03],materials.pale,face-side*.17,yy,zz);
      }
    }
    box(scene,[.2,2.03,1.14],materials.dark,face-side*.06,bottom+1.08,z);
    // Front and rear window bays: visible when the road bends toward the houses.
    for(const end of [-1,1]){
      const frontZ=z+end*(d*.5+.055);
      for(let row=0;row<Math.max(2,Math.floor((h-1)/2.3));row++){
        for(let col=0;col<Math.min(4,Math.floor((w-1)/1.65));col++){
          const xWindow=x+(col-1.5)*1.62;
          const yWindow=bottom+1.76+row*2.16;
          box(scene,[1.18,1.33,.17],materials.pale,xWindow,yWindow,frontZ);
          box(scene,[1.0,1.13,.20],glass,xWindow,yWindow,frontZ+end*.035);
          box(scene,[1.05,.09,.24],frameDark,xWindow,yWindow-0.62,frontZ+end*.065);
        }
      }
    }
    box(scene,[.52,.15,2.0],materials.roof,face-side*.25,bottom+2.35,z);
    // Small awning, concrete sill and doorway shadow make each facade less boxlike.
    box(scene,[.28,.17,2.21],foundations,face-side*.10,bottom+.30,z);
    for(let j=0;j<4;j++){
      const zz=z+(j-1.5)*2.23;
      box(scene,[.36,.14,1.28],frameDark,face-side*.12,bottom+1.18,zz);
    }
  }
}
function campus(scene,C,H){
  // Glazed upper-campus landmark and a broad stair: an evocative arrival moment.
  const z=-88,base=H(C(z),z);
  box(scene,[37.5,17.7,12.6],materials.pale,1.9,base+8.6,z);
  box(scene,[29.3,15,.34],materials.glass,1.9,base+9.4,z+6.46);
  for(let col=0;col<=18;col++){
    const x=-12.65+col*1.615;
    box(scene,[.145,15.18,.23],materials.pale,x,base+9.4,z+6.69);
  }
  for(let row=0;row<=7;row++)
    box(scene,[29.4,.17,.23],materials.pale,1.9,base+1.93+row*2.09,z+6.7);
  box(scene,[10.7,4.2,.40],materials.dark,1.9,base+2.59,z+6.8);
  box(scene,[14.4,.43,3.5],materials.pale,1.9,base+5.46,z+8.15);
  for(let i=0;i<13;i++){
    const stepZ=z+8.3+i*.63;
    box(scene,[12.9,.21,.63],materials.cap,1.9,base+.23+i*.2,stepZ);
  }
  box(scene,[39,.6,13.8],materials.pale,1.9,base+17.5,z);
}
function shelter(scene,C,H){
  // Lower bus stop; an arched, mint-tinted covered path appears on the upper slope.
  // Distinct start and final bus stops now live in hill-route.js.
  // This covered pedestrian stretch remains midway up the incline.
  const mint=new T.MeshPhysicalMaterial({color:'#80a99f',roughness:.22,metalness:.12,transparent:true,opacity:.37,depthWrite:false,side:T.DoubleSide});
  const verts=[],inds=[],along=28,across=12,z0=-52,z1=-36;
  for(let j=0;j<=along;j++){
    const zz=z0+(z1-z0)*j/along,y0=H(C(zz)+8.1,zz);
    for(let i=0;i<=across;i++){
      const a=i/across,xx=C(zz)+7.05+2.45*a;
      verts.push(xx,y0+2.48+.82*Math.sin(Math.PI*a),zz);
      if(i<across&&j<along){
        const k=j*(across+1)+i;inds.push(k,k+1,k+across+1,k+1,k+across+2,k+across+1);
      }
    }
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  geo.setIndex(inds);geo.computeVertexNormals();
  scene.add(new T.Mesh(geo,mint));
  for(let j=0;j<=7;j++){
    const zz=z0+(z1-z0)*j/7;
    for(const off of [7.05,9.5]){
      const xx=C(zz)+off;
      box(scene,[.09,2.48,.09],materials.iron,xx,H(xx,zz)+1.31,zz);
    }
  }
}
export function addHillDetails(scene,{center,heightAt}){
  markings(scene,center,heightAt);
  // The detailed textured retaining wall in hill-streetscape replaces these basic pillars.
  houses(scene,center,heightAt);
  campus(scene,center,heightAt);
  shelter(scene,center,heightAt);
  flushBoxes(scene);
}

import * as T from 'three';

// Hongjimun 2-gil commute landmarks. This is a stylized street interpretation,
// NOT a georeferenced or measured reconstruction. School (no. 1), restaurant block
// (no. 7), and university (no. 20) follow their verified address order.
export const HILL_CHECKPOINTS = Object.freeze([
  { id: 'start', name: '언덕 아래', z: 77, caption: '등굣길 시작' },
  { id: 'elementary', name: '상명사대부속초등학교', z: 52, caption: '홍지문2길 1' },
  { id: 'yungane', name: '윤가네', z: 20, caption: '홍지문2길 7' },
  { id: 'budaetong', name: '부대통령', z: 13, caption: '윤가네와 같은 건물 · B1' },
  { id: 'university', name: '학교 정류장', z: -67, caption: '상명대학교 도착' },
]);

const mat = {
  school: new T.MeshStandardMaterial({ color: '#d7d3c6', roughness: .94 }),
  schoolDark: new T.MeshStandardMaterial({ color: '#8c8b80', roughness: .98 }),
  schoolGlass: new T.MeshStandardMaterial({ color: '#647c83', roughness: .38, metalness: .09 }),
  schoolRoof: new T.MeshStandardMaterial({ color: '#7b7770', roughness: .94 }),
  schoolTrim: new T.MeshStandardMaterial({ color: '#ece3cf', roughness: .98 }),
  masonry: new T.MeshStandardMaterial({ color: '#a88c77', roughness: .97 }),
  ocher: new T.MeshStandardMaterial({ color: '#927761', roughness: .95 }),
  glass: new T.MeshStandardMaterial({ color: '#526b72', metalness: .16, roughness: .33 }),
  shade: new T.MeshStandardMaterial({ color: '#343c3b', roughness: .81 }),
  metal: new T.MeshStandardMaterial({ color: '#556360', metalness: .38, roughness: .58 }),
  post: new T.MeshStandardMaterial({ color: '#355e7a', roughness: .78 }),
  road: new T.MeshStandardMaterial({ color: '#a6a59b', roughness: .97 }),
  gold: new T.MeshStandardMaterial({ color: '#c6ac6f', roughness: .74 }),
  mint: new T.MeshPhysicalMaterial({ color: '#91aca8', roughness: .27, metalness: .13, transparent: true, opacity: .43, side: T.DoubleSide, depthWrite: false }),
};
const tmp = new T.Object3D();
const batches = new Map();
function box(scene,material,x,y,z,w,h,d,rotate=0){
  let items=batches.get(material);
  if(!items){items=[];batches.set(material,items);}
  items.push({x,y,z,w,h,d,rotate});
}
function flush(scene){
  for(const [material,items] of batches){
    if(!items.length)continue;
    const inst=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material,items.length);
    for(let i=0;i<items.length;i++){
      const e=items[i];
      tmp.position.set(e.x,e.y,e.z);
      tmp.scale.set(e.w,e.h,e.d);
      tmp.rotation.set(0,e.rotate,0);
      tmp.updateMatrix();
      inst.setMatrixAt(i,tmp.matrix);
    }
    inst.instanceMatrix.needsUpdate=true;
    inst.receiveShadow=true;
    scene.add(inst);
  }
  batches.clear();
}
function textTexture(title,subtitle='',color='#f8f1e1',background='#43615c'){
  const canvas=document.createElement('canvas');
  canvas.width=768;canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=background;ctx.fillRect(0,0,768,256);
  ctx.strokeStyle='rgba(255,255,255,.20)';ctx.lineWidth=9;
  ctx.strokeRect(11,11,746,234);
  ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=title.length>11?'700 55px "Noto Sans KR","Malgun Gothic",sans-serif':'800 85px "Noto Sans KR","Malgun Gothic",sans-serif';
  ctx.fillText(title,384,subtitle?111:133,724);
  if(subtitle){
    ctx.font='500 34px "Noto Sans KR","Malgun Gothic",sans-serif';
    ctx.fillText(subtitle,384,194,719);
  }
  const map=new T.CanvasTexture(canvas);
  map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;
  return map;
}
function facadeLabel(scene,{name,sub='',x,y,z,width=5.5,height=1.58,bg='#496b60',color='#faf1dd',face=1}){
  const texture=textTexture(name,sub,color,bg);
  const mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));
  mesh.position.set(x,y,z);
  mesh.rotation.y=face*Math.PI/2;
  mesh.renderOrder=2;
  scene.add(mesh);
  return mesh;
}
function posts(scene,xAt,yAt,zStart,zEnd,material,count=17,height=2.12){
  for(let j=0;j<=count;j++){
    const z=zStart+(zEnd-zStart)*j/count;
    const x=xAt(z),y=yAt(x,z);
    box(scene,material,x,y+height*.5,z,.105,height,.105);
  }
}
function primarySchool(scene,C,H){
  // Set back from the left-hand pavement, with a gate, brick boundary and
  // a recessed elementary building visible above the roadside wall.
  const z=53,x=C(z)-21.2;
  const ground=H(x,z);
  const height=10.7;
  box(scene,mat.school,x,ground+height*.5,z,18.8,height,29.8);
  box(scene,mat.schoolRoof,x,ground+height+.12,z,19.8,.32,30.6);
  box(scene,mat.schoolDark,x,ground+.17,z,19.2,.35,30.0);
  box(scene,mat.schoolTrim,x+9.56,ground+height*.51,z,.31,height,30.2);

  // Road-facing windows along the long facade (x axis normal).
  for(let floor=0;floor<3;floor++){
    for(let col=0;col<9;col++){
      const zz=z+(col-4)*3.0,yy=ground+2.04+floor*2.81;
      box(scene,mat.schoolTrim,x+9.73,yy,zz,.20,1.84,2.12);
      box(scene,mat.schoolGlass,x+9.87,yy,zz,.23,1.58,1.88);
      box(scene,mat.schoolDark,x+10.01,yy,zz,.23,.07,1.9);
      box(scene,mat.schoolDark,x+10.02,yy,zz,.23,1.61,.06);
    }
  }

  // A continuous wall follows the street grade; the school gate remains open.
  const wallMat=new T.MeshStandardMaterial({color:'#b29b87',side:T.DoubleSide,roughness:1});
  const buildWall=(from,to)=>{
    const verts=[],uv=[],indices=[],capVerts=[],capIndices=[],segments=Math.max(6,Math.ceil(Math.abs(to-from)/.65));
    for(let i=0;i<=segments;i++){
      const zz=from+(to-from)*i/segments,xx=C(zz)-8.8,base=H(xx,zz);
      const top=base+1.55;
      verts.push(xx,base-.11,zz,xx,top,zz);
      uv.push(i/3,0,i/3,1);
      capVerts.push(xx-.37,top+.025,zz,xx+.37,top+.025,zz);
      if(i<segments){
        const k=i*2;
        indices.push(k,k+1,k+2,k+1,k+3,k+2);
        capIndices.push(k,k+2,k+1,k+1,k+2,k+3);
      }
    }
    const wallGeo=new T.BufferGeometry();
    wallGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));
    wallGeo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    wallGeo.setIndex(indices);wallGeo.computeVertexNormals();
    const wall=new T.Mesh(wallGeo,wallMat);wall.receiveShadow=true;scene.add(wall);
    const capGeo=new T.BufferGeometry();
    capGeo.setAttribute('position',new T.Float32BufferAttribute(capVerts,3));
    capGeo.setIndex(capIndices);capGeo.computeVertexNormals();
    scene.add(new T.Mesh(capGeo,mat.schoolTrim));
  };
  buildWall(28,48.2);
  buildWall(58.8,76);
  const gateZ=53.5,gateX=C(gateZ)-8.65,gateY=H(gateX,gateZ);
  for(const gateOff of [-5.1,5.1]){
    box(scene,mat.schoolDark,gateX,gateY+1.69,gateZ+gateOff,.72,3.38,.78);
  }
  box(scene,mat.schoolRoof,gateX,gateY+3.40,gateZ,.82,.30,11.2);
  facadeLabel(scene,{name:'상명사대부속초등학교',sub:'홍지문2길 1',x:gateX+.52,y:gateY+2.78,z:gateZ,width:7.85,height:1.32,bg:'#536c66'});
  // Vertical bars only inside the gate margins, not across the walkable sidewalk.
  for(let i=0;i<18;i++){
    const zz=gateZ-4.45+i*.53;
    box(scene,mat.metal,gateX,gateY+1.06,zz,.09,2.1,.09);
  }
  box(scene,mat.schoolTrim,gateX,gateY+.15,gateZ,.34,.28,10.3);
}
function storeBlock(scene,C,H){
  // Public records place both businesses at Hongjimun 2-gil 7; Budaetongryeong
  // is registered as B1, so the two entrances deliberately share one building.
  const z=18,x=C(z)-15.6,y=H(x,z),width=9.4,depth=21.8,height=10.8;
  box(scene,mat.ocher,x,y+height*.5,z,width,height,depth);
  box(scene,mat.schoolTrim,x,y+height+.09,z,width+.56,.34,depth+.5);
  box(scene,mat.masonry,x+width*.5+.13,y+height*.62,z,.18,height*.75,depth);
  // Rows of small residential windows over the shops.
  for(let floor=0;floor<3;floor++){
    for(let k=0;k<5;k++){
      const zz=z+(k-2)*3.3,yy=y+4.64+floor*2.04;
      if(yy>y+height-1)continue;
      box(scene,mat.schoolTrim,x+width*.5+.19,yy,zz,.22,1.21,1.76);
      box(scene,mat.glass,x+width*.5+.32,yy,zz,.24,1.05,1.55);
      box(scene,mat.shade,x+width*.5+.44,yy,zz,.25,1.11,.06);
    }
  }
  const frontX=x+width*.5+.25;
  // Ground-floor 윤가네 storefront and projecting small awning.
  const yZ=21.8,bZ=13.25;
  for(const zz of [23.5,20.0]){
    box(scene,mat.schoolTrim,frontX+.13,y+2.12,zz,.24,2.10,2.98);
    box(scene,mat.glass,frontX+.27,y+2.07,zz,.27,1.92,2.73);
  }
  box(scene,mat.gold,frontX+.55,y+3.38,yZ,.84,.22,6.88);
  facadeLabel(scene,{name:'윤가네',sub:'분식 · 홍지문2길 7',x:frontX+.42,y:y+4.0,z:yZ,width:5.96,height:1.26,bg:'#6f6246'});
  // Basement entrance next to the Yungane front: black stairwell / B1 sign.
  box(scene,mat.shade,frontX+.15,y+1.75,bZ,.32,3.12,4.15);
  for(let step=0;step<7;step++){
    const zz=bZ-1.47+step*.43;
    box(scene,mat.schoolDark,frontX+.60+step*.15,y+.38-step*.115,zz,1.05,.16,.42);
  }
  for(const side of [-1,1])box(scene,mat.metal,frontX+.86,y+.92,bZ+side*1.72,.07,1.85,.07);
  facadeLabel(scene,{name:'부대통령 뚝배기',sub:'B1 · 홍지문2길 7',x:frontX+.48,y:y+3.63,z:bZ,width:5.20,height:1.32,bg:'#7e4637'});
  box(scene,mat.schoolTrim,frontX+.46,y+.12,z,.52,.26,depth+.9);
}
function upperStop(scene,C,H){
  const z=-67,x=C(z)-7.55,y=H(x,z);
  // Recognizable sheltered bus bay and blue stop pole at the end of the incline.
  box(scene,mat.post,x,y+1.70,z,.14,3.4,.14);
  box(scene,mat.post,x-1.65,y+3.14,z,3.5,.15,6.8);
  box(scene,mat.mint,x-3.36,y+2.20,z,.11,1.84,5.9);
  box(scene,mat.metal,x-2.05,y+.51,z,2.28,.17,.66);
  for(const zz of [z-2.35,z+2.35])
    box(scene,mat.metal,x-2.75,y+1.62,zz,.09,3.17,.09);
  facadeLabel(scene,{name:'상명대학교 정류장',sub:'등굣길 도착 · 홍지문2길 20',x:x+.35,y:y+2.72,z:z-3.25,width:5.1,height:1.37,bg:'#315f79'});

  // A compact stone-faced university arrival point on the *opposite side*
  // of the road: public campus imagery shows a low wall with the school name
  // and an adjoining security booth, not an elevated gate spanning the street.
  const arrivalZ=-79,arrivalX=C(arrivalZ)+9.55,arrivalY=H(arrivalX,arrivalZ);
  box(scene,mat.school,arrivalX,arrivalY+2.27,arrivalZ,1.10,4.54,7.25);
  box(scene,mat.schoolRoof,arrivalX,arrivalY+4.59,arrivalZ,1.32,.22,7.48);
  box(scene,mat.schoolDark,arrivalX-.66,arrivalY+.30,arrivalZ,.12,.63,7.40);
  facadeLabel(scene,{
    name:'상명대학교',sub:'SANGMYUNG UNIVERSITY',
    x:arrivalX-.59,y:arrivalY+2.39,z:arrivalZ,width:6.20,height:2.19,
    bg:'#d2d6d0',color:'#314b50',face:-1
  });
  // Low glazed security room with an inset roof and a modest hedge.
  const boothX=arrivalX+3.12,boothZ=arrivalZ+6.0,boothY=H(boothX,boothZ);
  box(scene,mat.schoolDark,boothX,boothY+1.66,boothZ,5.24,3.32,4.40);
  box(scene,mat.glass,boothX-2.68,boothY+1.55,boothZ,.13,2.36,3.44);
  box(scene,mat.schoolRoof,boothX,boothY+3.38,boothZ,5.94,.22,4.98);
  for(let j=0;j<5;j++){
    const zz=arrivalZ-4.8+j*1.35,xx=C(zz)+12.1,yy=H(xx,zz);
    box(scene,mat.ocher,xx,yy+.42,zz,2.0,.65,.66);
  }

  // A gentle glowing rest marker sits beyond the road edge.
  const circle=new T.Mesh(new T.RingGeometry(.83,1.03,40),
    new T.MeshBasicMaterial({color:'#ffdea7',transparent:true,opacity:.42,depthWrite:false,side:T.DoubleSide}));
  circle.position.set(C(z)-5.18,H(C(z)-5.18,z)+.10,z);
  circle.rotation.x=-Math.PI/2;scene.add(circle);
  return z;
}

export function addHillCommute(scene,{center,heightAt}){
  primarySchool(scene,center,heightAt);
  storeBlock(scene,center,heightAt);
  upperStop(scene,center,heightAt);
  flush(scene);
}

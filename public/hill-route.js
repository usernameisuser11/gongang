import * as T from 'three';

// Hongjimun 2-gil commute landmarks. This is a stylized street interpretation,
// NOT a georeferenced or measured reconstruction. School (no. 1), restaurant block
// (no. 7), and university (no. 20) follow their verified address order.
export const HILL_CHECKPOINTS = Object.freeze([
  { id: 'start', name: '언덕 맨 아래', z: 215, caption: '홍지문2길 입구에서 출발' },
  { id: 'entrance', name: '언덕 진입 삼거리', z: 177, caption: '왼쪽에 상명사대부속초등학교가 보이는 삼거리' },
  { id: 'elementary', name: '상명사대부속초등학교', z: 158, caption: '삼거리 왼편의 초등학교 건물과 교문 · 홍지문2길 1' },
  { id: 'school-turn', name: '초등학교 지나 좌회전', z: 141, caption: '학교를 지나자마자 왼쪽 급경사 오르막으로' },
  { id: 'lower-slope', name: '급경사 오르막 시작', z: 129, caption: '왼쪽 길로 들어서자마자 오르막과 첫 음식점들' },
  { id: 'steep-shops', name: '가파른 음식점 거리', z: 111, caption: '부대찌개집과 여러 식당이 이어지는 길' },
  { id: 'yungane', name: '윤가네', z: 99, caption: '홍지문2길 7 · 언덕길 식당' },
  { id: 'budaetong', name: '부대통령', z: 94, caption: '부대찌개 · 윤가네와 같은 건물 B1' },
  { id: 'university', name: '7016 정류장', z: -69, caption: '상명대학교 서울캠퍼스 도착' },
]);

const mat = {
  school: new T.MeshStandardMaterial({ color: '#d7d3c6', roughness: .94 }),
  schoolDark: new T.MeshStandardMaterial({ color: '#8c8b80', roughness: .98 }),
  schoolGlass: new T.MeshStandardMaterial({ color: '#647c83', roughness: .38, metalness: .09 }),
  schoolRoof: new T.MeshStandardMaterial({ color: '#7b7770', roughness: .94 }),
  schoolBlue: new T.MeshStandardMaterial({ color: '#355f78', roughness: .84 }),
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
  // From the downhill fork (z≈177), the school must be immediately to the
  // LEFT of the rising route. Its old location near z≈72 was much too far up
  // the hill and on the opposite side of the street.
  const z=153,x=C(z)-31.2,width=19.0,depth=27.5,height=19.4;
  // The hillside rises beneath the building: use an anchored stepped plinth
  // rather than leaving its downhill end suspended in the air.
  const terrainLevels=[
    H(x,z-14),H(x,z-7),H(x,z),H(x,z+7),H(x,z+14)
  ];
  const bottom=Math.min(...terrainLevels)-.85;
  const ground=Math.max(...terrainLevels)+.18;
  box(scene,mat.schoolDark,x,(ground+bottom)*.5,z,width+.65,ground-bottom,depth+.75);
  box(scene,mat.school,x,ground+height*.5,z,width,height,depth);
  box(scene,mat.schoolRoof,x,ground+height+.11,z,width+.7,.32,depth+.64);
  box(scene,mat.schoolTrim,x+width*.5+.10,ground+height*.50,z,.25,height,depth+.2);

  // The actual school has long blue-white classroom bands and stacked rows
  // of windows, so the facade is recognizable even from the lower junction.
  for(let floor=0;floor<6;floor++){
    const yy=ground+2.2+floor*2.88;
    for(let col=0;col<8;col++){
      const zz=z+(col-3.5)*3.13;
      box(scene,mat.schoolTrim,x+width*.5+.22,yy,zz,.22,1.82,2.54);
      box(scene,mat.schoolGlass,x+width*.5+.34,yy,zz,.25,1.62,2.32);
    }
    box(scene,mat.schoolBlue,x+width*.5+.39,ground+3.23+floor*2.88,z,.26,.32,depth-.38);
  }
  // The downhill-facing end is visible as visitors approach the fork.
  for(let floor=0;floor<5;floor++)for(let col=0;col<4;col++){
    const xx=x+(col-1.5)*4.15,yy=ground+2.28+floor*3.03;
    box(scene,mat.schoolTrim,xx,yy,z+depth*.5+.07,3.15,1.82,.20);
    box(scene,mat.schoolGlass,xx,yy,z+depth*.5+.19,2.89,1.62,.23);
  }
  const frontSign=new T.Mesh(
    new T.PlaneGeometry(12.8,1.58),
    new T.MeshBasicMaterial({
      map:textTexture('상명대학교 사범대학','부속초등학교','#f3f5f4','#36556b'),
      side:T.DoubleSide
    })
  );
  frontSign.position.set(x,ground+height-.95,z+depth*.5+.34);
  scene.add(frontSign);

  // A grade-following roadside fence frames the LEFT corner of the first
  // junction. Leave a broad opening for the school gate at z≈162.
  const wallMat=new T.MeshStandardMaterial({color:'#c6c4b9',side:T.DoubleSide,roughness:1});
  for(const [from,to] of [[136,155],[169,184]]){
    const verts=[],indices=[],sections=Math.ceil((to-from)/.8);
    for(let i=0;i<=sections;i++){
      const zz=from+(to-from)*i/sections;
      const xx=C(zz)-8.9,base=H(xx,zz);
      verts.push(xx,base-.16,zz,xx,base+1.38,zz);
      if(i<sections){const k=2*i;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    const mesh=new T.Mesh(geo,wallMat);mesh.receiveShadow=true;scene.add(mesh);
  }
  const gateZ=162,gateX=C(gateZ)-8.9,gateY=H(gateX,gateZ);
  for(const dz of [-6.4,6.4]){
    const zz=gateZ+dz,px=C(zz)-8.9,py=H(px,zz);
    box(scene,mat.schoolDark,px,py+1.66,zz,.64,3.32,.70);
  }
  // Keep the lintel shallow so the downhill view is not blocked.
  box(scene,mat.schoolRoof,gateX,gateY+3.47,gateZ,.95,.26,13.2);
  facadeLabel(scene,{
    name:'상명사대부속초등학교',sub:'홍지문2길 1',
    x:gateX+.49,y:gateY+2.62,z:gateZ,width:7.52,height:1.24,
    bg:'#42687a',face:1
  });
  for(const [from,to] of [[136,154],[170,184]]){
    for(let zz=from;zz<=to;zz+=1.32){
      const xx=C(zz)-8.94,yy=H(xx,zz);
      box(scene,mat.metal,xx,yy+1.60,zz,.07,.78,.07);
    }
  }
}
function storeBlock(scene,C,H){
  // Public records place both businesses at Hongjimun 2-gil 7; Budaetongryeong
  // is registered as B1, so the two entrances deliberately share one building.
  const z=98,x=C(z)-15.6,y=H(x,z),width=9.4,depth=21.8,height=10.8;
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
  const yZ=z+3.8,bZ=z-4.75;
  for(const zz of [z+5.5,z+2.0]){
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
  facadeLabel(scene,{name:'부대통령',sub:'부대찌개 · B1',x:frontX+.48,y:y+3.63,z:bZ,width:5.20,height:1.32,bg:'#7e4637'});
  box(scene,mat.schoolTrim,frontX+.46,y+.12,z,.52,.26,depth+.9);
}
function schoolStraightStreet(scene,C,H,F){
  // A straight side street splits from the route just AFTER the school.
  // The actual uphill walk turns LEFT, becoming steep immediately.
  const street=new T.MeshStandardMaterial({color:'#636b68',roughness:.98,side:T.DoubleSide});
  const pavement=new T.MeshStandardMaterial({color:'#afb3ad',roughness:1,side:T.DoubleSide});
  const n=78,z0=89,z1=145;
  for(const [a,b,material,lift] of [
    [-3.70,3.70,street,.079],[-5.62,-4.06,pavement,.128],[4.06,5.62,pavement,.128]
  ]){
    const points=[],indices=[];
    for(let i=0;i<=n;i++){
      const t=i/n,z=z0+(z1-z0)*t;
      const u=Math.max(0,Math.min(1,(z1-z)/15));
      const ease=u*u*(3-2*u);
      for(const off of [a*ease,b*ease]){
        const x=F(z)+off;
        points.push(x,H(x,z)+lift,z);
      }
      if(i<n){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(points,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    const m=new T.Mesh(geo,material);m.receiveShadow=true;scene.add(m);
  }
  for(const z of [93,101,109]){
    const x=F(z),y=H(x,z)+.115;
    box(scene,mat.schoolTrim,x,y,z,.08,.016,1.08);
  }
}
function shopLane(scene,C,H){
  // An intimate commercial street starts immediately after the left turn:
  // tighter low-rise fronts, glass shop windows, hanging signs and a road
  // surface which rises much faster than the lower residential approach.
  const fronts=[
    {z:127,side:1,name:'한식 · 백반',sub:'급경사 초입',tone:'#84634c',h:8.8},
    {z:113,side:1,name:'동네 식당',sub:'따뜻한 한 끼',tone:'#657a6b',h:9.6},
    {z:85,side:1,name:'작은 카페',sub:'커피와 쉼',tone:'#62777e',h:10.1},
    {z:70,side:-1,name:'상명 골목상가',sub:'오르막길',tone:'#77745e',h:8.7},
  ];
  for(const [i,entry] of fronts.entries()){
    const {z,side,name,sub,tone,h}=entry;
    const x=C(z)+side*(13.1+(i%2)*.9),y=H(x,z);
    const frontX=x-side*4.50;
    const wall=i%2?mat.school:mat.schoolTrim;
    box(scene,mat.schoolDark,x,y-.40,z,9.2,.82,11.9);
    box(scene,wall,x,y+h/2,z,8.9,h,11.8);
    box(scene,mat.schoolRoof,x,y+h+.12,z,9.3,.27,12.2);
    for(let k=-1;k<=1;k++){
      const zz=z+k*3.15;
      box(scene,mat.schoolTrim,frontX, y+1.73,zz,.23,3.10,2.65);
      box(scene,mat.glass,frontX-side*.12,y+1.73,zz,.26,2.80,2.42);
      for(let row=0;row<2;row++){
        box(scene,mat.schoolTrim,frontX,y+5.30+row*2.14,zz,.22,1.38,2.15);
        box(scene,mat.schoolGlass,frontX-side*.12,y+5.30+row*2.14,zz,.24,1.15,1.93);
      }
    }
    box(scene,mat.shade,frontX-side*.40,y+3.55,z,.78,.21,9.00);
    facadeLabel(scene,{name,sub,x:frontX-side*.24,y:y+4.22,z,width:6.3,height:1.27,bg:tone,face:-side});
  }
  // The road immediately after the turn has a short patterned safety band,
  // without painting over the footpath.
  const bar=new T.Mesh(new T.PlaneGeometry(7.05,1.3),
    new T.MeshBasicMaterial({color:'#d5bf73',side:T.DoubleSide,depthWrite:false}));
  const z=129;
  bar.rotation.x=-Math.PI/2+Math.atan(.36);
  bar.position.set(C(z),H(C(z),z)+.17,z);
  scene.add(bar);
  // Low handrails remain outside the actual pedestrian lane.
  for(const side of [-1,1])for(let z=87;z<=129;z+=4.5){
    const x=C(z)+side*7.9,y=H(x,z);
    box(scene,mat.metal,x,y+.50,z,.09,1.0,.09);
  }
}
function upperStop(scene,C,H){
  const z=-69,x=C(z)-7.55,y=H(x,z);
  // Recognizable sheltered bus bay and blue stop pole at the end of the incline.
  box(scene,mat.post,x,y+1.70,z,.14,3.4,.14);
  box(scene,mat.post,x-1.65,y+3.14,z,3.5,.15,6.8);
  box(scene,mat.mint,x-3.36,y+2.20,z,.11,1.84,5.9);
  box(scene,mat.metal,x-2.05,y+.51,z,2.28,.17,.66);
  for(const zz of [z-2.35,z+2.35])
    box(scene,mat.metal,x-2.75,y+1.62,zz,.09,3.17,.09);
  const labelX=C(z)-10.4,labelY=H(labelX,z);
  facadeLabel(scene,{name:'7016 · 상명대',sub:'버스 정류장',x:labelX,y:labelY+2.58,z:z-3.25,width:2.9,height:.88,bg:'#315f79'});

  // Forward-facing 7016 route sign matches the bus-stop sightline from below.
  const frontSign=new T.Mesh(new T.PlaneGeometry(2.60,.82),
    new T.MeshBasicMaterial({map:textTexture('7016','상명대학교 정류장','#eaf2f3','#2e6590'),side:T.DoubleSide}));
  frontSign.position.set(C(z)-9.6,H(C(z)-9.6,z)+2.77,z-2.15);
  scene.add(frontSign);
  // A compact stone-faced university arrival point on the *opposite side*
  // of the road: public campus imagery shows a low wall with the school name
  // and an adjoining security booth, not an elevated gate spanning the street.
  const arrivalZ=-92,arrivalX=C(arrivalZ)+8.85,arrivalY=H(arrivalX,arrivalZ);
  box(scene,mat.school,arrivalX,arrivalY+3.05,arrivalZ,1.10,6.10,7.25);
  box(scene,mat.schoolRoof,arrivalX,arrivalY+6.20,arrivalZ,1.32,.22,7.48);
  box(scene,mat.schoolDark,arrivalX-.66,arrivalY+.30,arrivalZ,.12,.63,7.40);
  facadeLabel(scene,{
    name:'상명대학교',sub:'SANGMYUNG UNIVERSITY',
    x:arrivalX-.59,y:arrivalY+3.32,z:arrivalZ,width:6.20,height:2.19,
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

export function addHillCommute(scene,{center,schoolFork,heightAt}){
  schoolStraightStreet(scene,center,heightAt,schoolFork);
  primarySchool(scene,center,heightAt);
  storeBlock(scene,center,heightAt);
  shopLane(scene,center,heightAt);
  upperStop(scene,center,heightAt);
  flush(scene);
}

import * as T from 'three';
import { rng } from './nature.js';

// Grounded in photographs of the Hongjimun 2-gil approach and university entrance.
// Stylized interpretation: no survey-grade layout or licensed 3D assets.
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
function texture(draw,size=384){
  const cvs=document.createElement('canvas');cvs.width=cvs.height=size;
  draw(cvs.getContext('2d'),size);
  const tex=new T.CanvasTexture(cvs);
  tex.colorSpace=T.SRGBColorSpace;
  tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.anisotropy=4;
  return tex;
}
function grain(ctx,n,seed,count=5200){
  const r=rng(seed);
  for(let i=0;i<count;i++){
    const a=r()>.48?'rgba(255,251,231,.10)':'rgba(21,29,26,.10)';
    ctx.fillStyle=a;const x=r()*n,y=r()*n,s=.6+r()*1.4;
    ctx.fillRect(x,y,s,s);
  }
}
export function streetSurfaceMaterials(){
  const roadTex=texture((ctx,n)=>{
    ctx.fillStyle='#5f6663';ctx.fillRect(0,0,n,n);
    const r=rng(1124);
    for(let i=0;i<2200;i++){
      const x=r()*n,y=r()*n;
      ctx.fillStyle=r()>.55?'rgba(222,219,203,.047)':'rgba(34,39,37,.065)';
      ctx.fillRect(x,y,r()*4+1,r()*5+1);
    }
    for(let k=0;k<13;k++){
      ctx.strokeStyle='rgba(28,36,35,'+(r()*.035+.025)+')';
      ctx.lineWidth=r()*1.5+.4;
      ctx.beginPath();
      const y=r()*n;ctx.moveTo(0,y);ctx.bezierCurveTo(n*.35,y+r()*8,n*.65,y-r()*12,n,y+r()*7);ctx.stroke();
    }
    grain(ctx,n,732);
  });
  const sidewalkTex=texture((ctx,n)=>{
    ctx.fillStyle='#b0b0a7';ctx.fillRect(0,0,n,n);
    const r=rng(2017);
    for(let row=0;row<12;row++){
      const y=row*n/12;
      ctx.fillStyle='rgba(51,57,55,.20)';ctx.fillRect(0,y,n,1.5);
      for(let col=0;col<3;col++){
        const offset=(row%2?n/6:0);
        const x=col*n/3+offset;
        ctx.fillRect(x,y,1.2,n/12);
      }
    }
    for(let i=0;i<1500;i++){
      ctx.fillStyle=r()>.45?'rgba(238,236,222,.12)':'rgba(35,40,39,.07)';
      ctx.fillRect(r()*n,r()*n,2+r()*2,2+r()*2);
    }
    grain(ctx,n,729,2200);
  });
  return {
    asphalt:new T.MeshStandardMaterial({map:roadTex,roughness:.99,side:T.DoubleSide,color:'#f0f2ec'}),
    sidewalk:new T.MeshStandardMaterial({map:sidewalkTex,roughness:1,side:T.DoubleSide,color:'#e8e7df'})
  };
}
function canvasLabel(text,light='#e9e6db',dark='#2f4140',sub=''){
  return texture((ctx,n)=>{
    ctx.clearRect(0,0,n,n);
    ctx.fillStyle=light;ctx.fillRect(0,0,n,n);
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=dark;
    ctx.font='bold 49px "Noto Sans KR","Malgun Gothic",sans-serif';
    ctx.fillText(text,n/2,sub?n*.41:n*.50,n*.91);
    if(sub){
      ctx.font='600 20px sans-serif';
      ctx.fillText(sub,n/2,n*.63,n*.92);
    }
  },512);
}
function mesh(scene,g,m,x=0,y=0,z=0){
  const o=new T.Mesh(g,m);o.position.set(x,y,z);o.receiveShadow=true;scene.add(o);return o;
}
function sign(scene,text,subtitle,x,y,z,wide=4.4){
  const tex=canvasLabel(text,'#d9dbd6','#35413d',subtitle);
  const m=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide});
  const plate=mesh(scene,new T.PlaneGeometry(wide,wide*.48),m,x,y,z);
  plate.rotation.y=Math.PI/2;
  return plate;
}
function instanced(scene,material,shapes){
  if(!shapes.length)return;
  const g=new T.BoxGeometry(1,1,1),o=new T.InstancedMesh(g,material,shapes.length),t=new T.Object3D();
  for(let i=0;i<shapes.length;i++){
    const {x,y,z,w,h,d,rotation=0}=shapes[i];
    t.position.set(x,y,z);
    t.scale.set(w,h,d);
    t.rotation.set(0,rotation,0);
    t.updateMatrix();o.setMatrixAt(i,t.matrix);
  }
  o.instanceMatrix.needsUpdate=true;o.receiveShadow=true;scene.add(o);
}
function masonryTexture(){
  return texture((ctx,n)=>{
    const r=rng(38383);
    ctx.fillStyle='#6a736b';ctx.fillRect(0,0,n,n);
    for(let row=0;row<16;row++)for(let col=-1;col<8;col++){
      const x=col*60+(row%2?29:0),y=row*n/16;
      const shade=92+Math.floor(r()*48);
      ctx.fillStyle='rgb('+shade+','+(shade+2)+','+(shade-2)+')';
      ctx.fillRect(x+2,y+2,57,n/16-4);
      ctx.fillStyle='rgba(236,237,220,.08)';
      ctx.fillRect(x+3,y+3,53,2);
    }
    grain(ctx,n,5532,1900);
  });
}
function retainingWall(scene,C,H,compact){
  const mat=new T.MeshStandardMaterial({map:masonryTexture(),roughness:1,side:T.DoubleSide});
  const cap=new T.MeshStandardMaterial({color:'#a8aaa1',roughness:1});
  const rail=new T.MeshStandardMaterial({color:'#576b63',roughness:.68,metalness:.26});
  const along=[[-1,-21,-50,8.85,2.08],[1,49,14,8.65,1.52],[1,10,-33,9.65,2.18]];
  const posts=[];
  for(const [side,begin,end,offset,wallH] of along){
    const verts=[],uv=[],inds=[],capVerts=[],capUV=[],capInd=[];
    const count=Math.ceil((begin-end)/1.6);
    for(let i=0;i<=count;i++){
      const z=begin+(end-begin)*i/count,x=C(z)+side*offset;
      const base=H(x,z),top=base+wallH+.08*Math.sin(z*.35);
      verts.push(x,base-.20,z,x,top,z);
      uv.push(i*.46,0,i*.46,wallH*.75);
      capVerts.push(x-.22,top+.025,z,x+.22,top+.025,z);
      capUV.push(0,i*.33,1,i*.33);
      if(i<count){
        const p=i*2;inds.push(p,p+1,p+2,p+1,p+3,p+2);
        capInd.push(p,p+2,p+1,p+1,p+2,p+3);
      }
      if(i%4===0){
        posts.push({x,y:top+.44,z,w:.07,h:.88,d:.07});
      }
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(verts,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    g.setIndex(inds);g.computeVertexNormals();
    const wall=mesh(scene,g,mat);wall.receiveShadow=true;
    const capGeom=new T.BufferGeometry();
    capGeom.setAttribute('position',new T.Float32BufferAttribute(capVerts,3));
    capGeom.setAttribute('uv',new T.Float32BufferAttribute(capUV,2));
    capGeom.setIndex(capInd);capGeom.computeVertexNormals();
    mesh(scene,capGeom,cap);
    for(let k=4;k<=count;k+=4){
      const za=begin+(end-begin)*(k-4)/count,zb=begin+(end-begin)*k/count;
      const aa=new T.Vector3(C(za)+side*offset,H(C(za)+side*offset,za)+wallH+.78,za);
      const bb=new T.Vector3(C(zb)+side*offset,H(C(zb)+side*offset,zb)+wallH+.78,zb);
      const d=bb.clone().sub(aa),seg=new T.Mesh(new T.CylinderGeometry(.035,.035,d.length(),6),rail);
      seg.position.copy(aa).addScaledVector(d,.5);seg.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());scene.add(seg);
    }
  }
  instanced(scene,rail,posts);
}
function lampsAndDrains(scene,C,H){
  const iron=new T.MeshStandardMaterial({color:'#435850',metalness:.38,roughness:.62});
  const lamp=new T.MeshBasicMaterial({color:'#f7dfb9'});
  const dark=new T.MeshStandardMaterial({color:'#393f3b',roughness:.96});
  const posts=[],heads=[],glows=[],drains=[],bollards=[];
  for(let i=0;i<18;i++){
    const z=50-i*6.6,side=i%3===0?-1:1,x=C(z)+side*7.55;
    if(z < -72)break;
    const base=H(x,z);
    posts.push({x,y:base+2.1,z,w:.08,h:4.2,d:.08});
    heads.push({x:x-side*.23,y:base+4.14,z,w:.55,h:.14,d:.32});
    glows.push({x:x-side*.22,y:base+4.07,z,w:.40,h:.06,d:.25});
  }
  for(let i=0;i<25;i++){
    const z=52-i*4.8,side=i%2?-1:1,x=C(z)+side*3.76,base=H(x,z)+.112;
    drains.push({x,y:base,z,w:.26,h:.009,d:.39});
  }
  // Sparse low bollards only near the crossings, not a line of tall black sticks.
  for(const z of [49,47,45,-55,-57,-59]){
    const x=C(z)-6.95;
    bollards.push({x,y:H(x,z)+.26,z,w:.10,h:.52,d:.10});
  }
  instanced(scene,iron,posts.concat(heads).concat(bollards));
  instanced(scene,lamp,glows);
  instanced(scene,dark,drains);
}
function shrubsAndSoil(scene,C,H,compact){
  const r=rng(82283),t=new T.Object3D();
  const stemGeo=new T.CylinderGeometry(.018,.032,.55,5);
  const stemMaterial=new T.MeshStandardMaterial({color:'#655e4a',roughness:1});
  const leaf=new T.BufferGeometry();
  leaf.setAttribute('position',new T.Float32BufferAttribute([
    0,0,0,-.20,.11,-.11,0,.37,0,
    0,0,0,0,.37,0,.18,.10,.11,
    0,.05,0,-.11,.17,.15,0,.44,0,
    0,.05,0,0,.44,0,.11,.18,-.14
  ],3));leaf.computeVertexNormals();
  const mat=new T.MeshLambertMaterial({side:T.DoubleSide,color:'#c5d3bd'});
  const n=compact?680:1180;
  const leaves=new T.InstancedMesh(leaf,mat,n),branches=new T.InstancedMesh(stemGeo,stemMaterial,n);
  const shades=['#47664e','#5a7e57','#748b5d','#8b9c6d','#5b7958','#9aa178'];
  const tint=new T.Color();
  for(let i=0;i<n;i++){
    const z=-74+r()*130,side=i%2?-1:1,offset=8.9+Math.pow(r(),.65)*18.0;
    const x=C(z)+side*offset,base=H(x,z),height=.32+r()*1.35;
    t.position.set(x,base+height*.26,z);
    t.rotation.set((r()-.5)*.28,r()*6.283,(r()-.5)*.22);
    t.scale.set(height*.13,height*.92,height*.13);
    t.updateMatrix();branches.setMatrixAt(i,t.matrix);
    t.position.set(x,base+height*.36,z);
    t.rotation.set((r()-.5)*.5,r()*6.283,(r()-.5)*.4);
    t.scale.set(.50+height*.8,height*1.6,.47+height*.75);
    t.updateMatrix();leaves.setMatrixAt(i,t.matrix);
    tint.set(shades[Math.floor(r()*shades.length)]);
    tint.multiplyScalar(.80+r()*.31);leaves.setColorAt(i,tint);
  }
  branches.frustumCulled=false;leaves.frustumCulled=false;scene.add(branches,leaves);
}
function entranceMarker(scene,C,H){
  // Curved light masonry plaque at the side of the upper approach; wording only,
  // no copied university crest or mascot.
  const z=-57,side=-1,x=C(z)+side*10.9;
  const wallMat=new T.MeshStandardMaterial({color:'#d4d2c9',roughness:.93,side:T.DoubleSide});
  const band=new T.MeshStandardMaterial({color:'#b3b4a9',roughness:.88});
  const vertices=[],indices=[],segments=20;
  const width=8.7;
  for(let i=0;i<=segments;i++){
    const u=i/segments,zz=z+(u-.5)*width,xx=x-.58*Math.sin(Math.PI*u);
    const base=H(xx,zz);
    vertices.push(xx,base,zz,xx,base+2.3,zz);
    if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
  mesh(scene,g,wallMat);
  const top=H(x,z)+2.35;
  const bandMesh=mesh(scene,new T.BoxGeometry(.54,.18,width),band,x,top,z);
  const frontX=x+.19;
  sign(scene,'상명대학교','SANGMYUNG UNIVERSITY',frontX,H(frontX,z)+1.44,z,5.8);
}
function bus(scene,C,H){
  // Compact Seoul green route 7016 bus near the upper bend; no animated traffic
  // or physics in the peaceful walking experience.
  const z=-38,side=1,x=C(z)+1.85;
  const group=new T.Group();
  group.position.set(x,H(x,z)+.14,z);
  const pitch=Math.atan(.252+.019*Math.cos((z+9)*.053));
  group.rotation.x=pitch;
  scene.add(group);
  const green=new T.MeshStandardMaterial({color:'#75a83e',roughness:.55,metalness:.05});
  const darkGreen=new T.MeshStandardMaterial({color:'#3b6243',roughness:.69});
  const pale=new T.MeshStandardMaterial({color:'#e6e7da',roughness:.67});
  const glass=new T.MeshStandardMaterial({color:'#3f6770',metalness:.24,roughness:.25});
  const black=new T.MeshStandardMaterial({color:'#282d2d',roughness:.78});
  const silver=new T.MeshStandardMaterial({color:'#a0aaa5',roughness:.46,metalness:.38});
  function local(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);group.add(o);return o;}
  local(new T.BoxGeometry(2.25,2.56,6.65),green,0,1.92,0);
  local(new T.BoxGeometry(2.22,.47,6.69),pale,0,1.10,0);
  local(new T.BoxGeometry(2.0,.10,6.43),darkGreen,0,3.29,0);
  for(const side of [-1,1]){
    const xx=side*1.16;
    for(let j=0;j<5;j++){
      local(new T.BoxGeometry(.039,.91,1.0),glass,xx,2.42,-2.38+j*1.17);
      local(new T.BoxGeometry(.046,.075,1.06),silver,xx,1.94,-2.38+j*1.17);
    }
    for(const zz of [-2.26,2.14]){
      const wheel=local(new T.CylinderGeometry(.43,.43,.18,14),black,xx, .48,zz);
      wheel.rotation.z=Math.PI/2;
      const hub=local(new T.CylinderGeometry(.19,.19,.20,12),silver,xx+side*.08,.48,zz);
      hub.rotation.z=Math.PI/2;
    }
  }
  local(new T.BoxGeometry(1.96,1.31,.065),glass,0,2.46,3.365);
  local(new T.BoxGeometry(1.92,.23,.07),black,0,3.17,3.38);
  local(new T.BoxGeometry(1.98,.58,.09),green,0,1.33,3.37);
  for(const xx of [-.79,.79]){
    local(new T.BoxGeometry(.28,.13,.075),pale,xx,1.39,3.43);
  }
  const signTex=canvasLabel('7016','#292d2e','#f5c84d');
  const signMat=new T.MeshBasicMaterial({map:signTex});
  const signPanel=local(new T.PlaneGeometry(1.50,.28),signMat,0,3.14,3.423);
  return group;
}
export function addHillStreetscape(scene,{center,heightAt,compact=false}){
  retainingWall(scene,center,heightAt,compact);
  lampsAndDrains(scene,center,heightAt);
  shrubsAndSoil(scene,center,heightAt,compact);
  entranceMarker(scene,center,heightAt);
  bus(scene,center,heightAt);
}

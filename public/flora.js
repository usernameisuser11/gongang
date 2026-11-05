import * as T from 'three';
import { fbm, noise, rng, smooth } from './nature.js';
import { coastDistance, heightAt, pathX, treePosition } from './land.js';

const V = (x,y,z) => new T.Vector3(x,y,z);
const TAU = Math.PI * 2;

function coloredMesh(positions, colors, material) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  return new T.Mesh(geometry,material);
}
function plantMaterial(time, kind) {
  const material = new T.MeshLambertMaterial({vertexColors:true, side:T.DoubleSide});
  material.customProgramCacheKey = () => kind;
  material.onBeforeCompile = shader => {
    shader.uniforms.gustTime = time;
    shader.vertexShader = 'uniform float gustTime;\n' + shader.vertexShader;
    const change = kind === 'grass' ? `
      vec2 root = (instanceMatrix[3]).xz;
      float gust = sin(root.x*.21+root.y*.29+gustTime*1.37)*.63 + sin(root.x*.43-root.y*.31-gustTime*2.1)*.23;
      transformed.x += position.y*position.y*(.11+.31*gust);
      transformed.z -= position.y*position.y*(.06+.15*gust);
    ` : `
      float breeze = sin(position.z*.78+position.x*.61+gustTime*1.17);
      transformed.x += breeze*.082;
      transformed.z -= breeze*.042;
    `;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + change);
  };
  return material;
}

function tuftGeometry(random, blades) {
  const p=[], c=[], idx=[];
  const color = new T.Color();
  for (let i=0;i<blades;i++) {
    const a = random()*TAU, x=(random()-.5)*.19, z=(random()-.5)*.19;
    const h=.26+random()*.48, width=.014+random()*.027;
    const cx=Math.cos(a), sz=Math.sin(a), bend=.10+random()*.37;
    const first=p.length/3;
    p.push(x-cx*width,0,z-sz*width,x+cx*width,0,z+sz*width);
    p.push(x-cx*width*.67-sz*bend*.42,h*.55,z-sz*width*.67+cx*bend*.42);
    p.push(x+cx*width*.67-sz*bend*.42,h*.55,z+sz*width*.67+cx*bend*.42);
    p.push(x-sz*bend,h,z+cx*bend);
    const tone=random();
    color.setRGB(.29+.14*tone,.36+.13*tone,.22+.11*tone);
    c.push(color.r,color.g,color.b,color.r,color.g,color.b);
    color.setRGB(.60+.27*tone,.64+.22*tone,.35+.18*tone);
    c.push(color.r,color.g,color.b,color.r,color.g,color.b);
    color.setRGB(.74+.23*tone,.72+.24*tone,.46+.28*tone);
    c.push(color.r,color.g,color.b);
    idx.push(first,first+1,first+2,first+1,first+3,first+2,first+2,first+3,first+4);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(c,3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return geometry;
}
export function makeMeadow(scene,time,compact) {
  const random=rng(14502), dummy=new T.Object3D();
  const foliage=plantMaterial(time,'grass');
  const green=new T.Color('#9bb15a'), ochre=new T.Color('#c7b370'), olive=new T.Color('#738e62'), c=new T.Color();
  const geometry=tuftGeometry(random,5);
  const target=compact?21000:34500;
  const patches=new Map();
  let placed=0;
  for(let i=0;i<target*3.5 && placed<target;i++){
    const z=-49+random()*102, x=-37+random()*85;
    const d=coastDistance(x,z), track=Math.abs(x-pathX(z));
    if(d<.3 || (track<1.34 && random()<.93)) continue;
    const field=fbm(x*.16,z*.20), shade=fbm(x*.044+10,z*.05);
    if(random()<.20+(1-field)*.36 || (d<1.7 && random()<.7)) continue;
    const size=(.55+random()*.87)*(.57+.66*field)*(.60+.4*smooth(1,2.3,track));
    dummy.position.set(x,heightAt(x,z)-.012,z);
    dummy.rotation.set((random()-.5)*.19, random()*TAU, (random()-.5)*.24);
    dummy.scale.set(size*.94,size,size*.94);
    dummy.updateMatrix();
    c.copy(olive).lerp(green,smooth(.22,.73,field)).lerp(ochre,smooth(.50,.84,shade)*.84);
    c.multiplyScalar(.78+random()*.46);
    const key=Math.floor(x/14)+','+Math.floor(z/14);
    if(!patches.has(key)) patches.set(key,[]);
    patches.get(key).push([dummy.matrix.clone(),c.clone()]);
    placed++;
  }
  for(const entries of patches.values()){
    const mesh=new T.InstancedMesh(geometry,foliage,entries.length);
    entries.forEach(([matrix,color],i)=>{
      mesh.setMatrixAt(i,matrix);
      mesh.setColorAt(i,color);
    });
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius+=.5;
    scene.add(mesh);
  }

  const p=[], col=[];
  const stem = new T.Color('#627548'), petals = ['#efe6ba','#f3d887','#d8b0c2','#b2a1cc'].map(x=>new T.Color(x));
  const heart = new T.Color('#d89e43');
  const put = (point,c) => { p.push(...point.toArray()); col.push(c.r,c.g,c.b); };
  const centers=[[-15,15,4],[-5,11,4],[-15,0,3],[-4,-12,4],[7,-14,6],[-22,-10,3],
    [-24,18,5],[0,-27,5],[-19,-24,4],[15,14,5],[19,-32,5],[-25,-35,3],[-1,25,4]];
  for(const [tx,tz,spread] of centers) {
    const species=Math.floor(random()*petals.length);
    const count=compact ? 82 : 150;
    for(let i=0;i<count;i++){
      const x=tx+(random()+random()-1)*spread, z=tz+(random()+random()-1)*spread;
      if(coastDistance(x,z)<1.5 || Math.abs(x-pathX(z))<1.43 || fbm(x*.5,z*.5)<.27) continue;
      const y=heightAt(x,z), h=.24+random()*.46;
      const head=V(x+h*.14,y+h,z+h*.09);
      put(V(x-.014,y-.03,z),stem);put(V(x+.014,y-.03,z),stem);put(head,stem);
      put(V(x,y-.03,z-.018),stem);put(V(x,y-.03,z+.018),stem);put(head,stem);
      const leaf = V(x+.038,y+h*.37,z);
      put(leaf,stem);put(V(x-.13,y+h*.55,z+.067),stem);put(V(x+.03,y+h*.31,z-.028),stem);
      const face = random()*TAU, r=.034+random()*.056;
      const count=species===0?6:5;
      const axis=V(Math.cos(face),.28,Math.sin(face));
      const cross=V(-Math.sin(face),-.33,Math.cos(face));
      for(let k=0;k<count;k++){
        const a=k*TAU/count;
        const add=(len,angle,lift) => head.clone().addScaledVector(axis,len*Math.cos(angle))
          .addScaledVector(cross,len*Math.sin(angle)).add(V(0,lift,0));
        put(add(r*.17,a,-.007),heart);
        put(add(r*.88,a-.42,.004),petals[species]);
        put(add(r*1.15,a,.016),petals[species]);
        put(add(r*.17,a,-.007),heart);
        put(add(r*1.15,a,.016),petals[species]);
        put(add(r*.86,a+.42,.009),petals[species]);
      }
    }
  }
  scene.add(coloredMesh(p,col,new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide})));
}

export function makeTree(scene,time) {
  const random=rng(131985), barkP=[], barkC=[], leafP=[], leafC=[];
  const barkDark=new T.Color('#493c34'), barkLight=new T.Color('#a18768'), barkMoss=new T.Color('#726850');
  const leafDark=new T.Color('#435842'), leafLight=new T.Color('#a7a35a'), leafGold=new T.Color('#c6a56a');
  const color=new T.Color();
  const { x:treeX, z:treeZ } = treePosition;
  const treeY=heightAt(treeX,treeZ)-.14;
  const put=(p,c,v,col) => { p.push(v.x+treeX,v.y+treeY,v.z+treeZ); c.push(col.r,col.g,col.b); };
  const wood=(points,r0,r1,seg=10) => {
    const curve=new T.CatmullRomCurve3(points);
    const n=Math.ceil(curve.getLength()*2.2)+3;
    const frame=curve.computeFrenetFrames(n,false), rings=[], shades=[];
    for(let i=0;i<=n;i++){
      const t=i/n, center=curve.getPointAt(t);
      const r=(r0-r1)*Math.pow(1-t,.91)+r1;
      const ring=[], tint=[];
      for(let s=0;s<seg;s++){
        const angle=TAU*s/seg+.18*Math.sin(t*4.1);
        const cr=r*(1+.10*Math.sin(s*3.7+i*.43)+.10*Math.cos(s*1.91));
        ring.push(center.clone().addScaledVector(frame.normals[i],Math.cos(angle)*cr)
          .addScaledVector(frame.binormals[i],Math.sin(angle)*cr));
        tint.push(barkDark.clone().lerp(barkLight,.24+.31*noise(s*1.2,i*.43))
          .lerp(barkMoss,(1-t)*.36*noise(s*2.2+8,i*.25)));
      }
      rings.push(ring); shades.push(tint);
    }
    for(let i=0;i<n;i++)for(let k=0;k<seg;k++){
      const q=(k+1)%seg;
      for(const [j,s] of [[i,k],[i+1,k],[i,q],[i,q],[i+1,k],[i+1,q]]) put(barkP,barkC,rings[j][s],shades[j][s]);
    }
  };
  const leafFan = (center,dir,energy) => {
    const axisA=V(-dir.z,.17,dir.x).normalize();
    const axisB=V(dir.x,.13,dir.z).normalize();
    for(let i=0;i<190;i++){
      const angle=random()*TAU, spread=Math.sqrt(random());
      const a=Math.cos(angle)*spread, b=Math.sin(angle)*spread;
      const tuft=center.clone().addScaledVector(axisA,a*energy*1.05).addScaledVector(axisB,b*energy*1.42);
      tuft.y+=(random()-.5)*energy*.78+(1-spread)*.32;
      const lean=random()*TAU, length=(.12+random()*.27)*(.85+energy*.18);
      const blade=V(Math.cos(lean)*length,(random()-.35)*length*1.33,Math.sin(lean)*length);
      const across=V(-Math.sin(lean)*length*.36,(random()-.5)*length*.32,Math.cos(lean)*length*.36);
      const base=tuft.clone().addScaledVector(blade,-.47), tip=tuft.clone().add(blade);
      const aSide=tuft.clone().add(across), bSide=tuft.clone().sub(across);
      const rib=tuft.clone().add(V(0,.038,0));
      const tint=leafDark.clone().lerp(leafLight,.30+random()*.63).lerp(leafGold,random()**4*.59);
      for(const [v,s] of [[base,.8],[aSide,.94],[rib,1.10],[aSide,.94],[tip,1.04],[rib,1.10],
        [rib,.95],[tip,.95],[bSide,.76],[rib,.95],[bSide,.76],[base,.80]]) {
        put(leafP,leafC,v,color.copy(tint).multiplyScalar(s));
      }
    }
  };

  const A=V(0,0,0), B=V(-.38,2.05,.1), C=V(-.14,3.72,-.17), D=V(1.02,5.20,-.31), E=V(2.03,6.44,.02);
  wood([A,B,C,D,E,V(3.0,7.40,.14)],.72,.07,16);
  for(let i=0;i<8;i++){
    const a=i*TAU/8+random()*.38, x=Math.cos(a), z=Math.sin(a), r=1.4+random()*1.65;
    const localY=heightAt(treeX+x*r,treeZ+z*r)-treeY;
    wood([V(x*.25,.7,z*.23),V(x*.84,.18,z*.82),V(x*r,localY-.15,z*r)],.25+random()*.17,.025,9);
  }
  const boughs=[
    [B,V(-1.60,3.24,.21),V(-2.85,4.83,.53),V(-4.7,6.25,.66),.30],
    [C,V(-.88,4.77,-1.10),V(-1.66,6.09,-2.06),V(-2.41,7.18,-3.21),.24],
    [C,V(1.0,4.51,1.20),V(2.80,5.46,2.06),V(4.89,6.33,2.50),.30],
    [D,V(2.17,5.71,-1.55),V(4.04,6.40,-2.84),V(6.2,7.46,-3.12),.27],
    [D,V(.51,6.09,.46),V(-.31,7.30,1.28),V(-.93,8.63,1.71),.22],
    [E,V(2.89,7.02,.38),V(4.03,7.66,.88),V(5.62,8.56,1.24),.21],
    [E,V(2.73,7.42,-.76),V(3.18,8.73,-1.05),V(3.66,9.31,-1.23),.19]
  ];
  for(const [from,mid,bend,tip,r] of boughs){
    wood([from,mid,bend,tip],r,.037,10);
    const flow=tip.clone().sub(bend).normalize();
    const side=V(-flow.z,0,flow.x).normalize();
    for(let i=0;i<7;i++){
      const progress=i/6;
      const start=i<3?mid.clone().lerp(bend,i*.36):bend.clone().lerp(tip,(i-3)*.29);
      const end=start.clone().addScaledVector(flow,1.10+random()*1.48)
        .addScaledVector(side,(i%2===0?1:-1)*(.61+random()*1.16));
      end.y+=.49+random()*.85;
      const joint=start.clone().lerp(end,.55); joint.y+=.17;
      wood([start,joint,end],r*(.46-progress*.24),.013,6);
      leafFan(end,flow,.72+random()*.46);
      for(let s=0;s<2;s++){
        const fork=joint.clone().lerp(end,s*.36);
        const bud=fork.clone().addScaledVector(flow,.76+random()*.72).addScaledVector(side,(s?1:-1)*(.27+random()*.75));
        bud.y+=.41+random()*.56;
        wood([fork,fork.clone().lerp(bud,.5).add(V(0,.095,0)),bud],.032,.006,5);
        leafFan(bud,flow,.57+random()*.53);
      }
    }
  }
  scene.add(coloredMesh(barkP,barkC,new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.98})));
  scene.add(coloredMesh(leafP,leafC,plantMaterial(time,'leaves')));
}

import * as T from 'three';
import { rng, fbm, smooth, shaderNoise } from './nature.js';
import { sunDirection } from './atmosphere.js';
import { coast,runupAt,wetReachAt,shorelineGLSL } from './shore-motion.js';

// An open, walkable sandy shore where up to eight travelers can gather.
// +Z is inland; the sea stretches toward -Z.
const random=rng(26081108);
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
function sand(scene,time){
  const nx=217,nz=134,p=[],color=[],idx=[],xs=[];
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
  const beach=new T.Mesh(g,material('#ffffff',{vertexColors:true,side:T.DoubleSide}));
  beach.receiveShadow=true;scene.add(beach);
  const base=new Float32Array(color),vertexColor=g.getAttribute('color'),positions=g.getAttribute('position');
  let lastUpdate=-Infinity;
  function updateWet(waveTime){
    if(waveTime-lastUpdate <.22 && waveTime>=lastUpdate) return;
    lastUpdate=waveTime;
    // Sample the recent 21 seconds of wave travel once per x-column. The sea
    // and beach use the same swell clock, but color recovery is not abrupt.
    const reaches=xs.map(x=>wetReachAt(x,waveTime));
    const current=xs.map(x=>runupAt(x,waveTime));
    for(let i=0;i<vertexColor.count;i++){
      const xIndex=i%nx,d=positions.getZ(i)-coast(xs[xIndex]);
      const remembered=reaches[xIndex],active=current[xIndex];
      const damp=smooth(-1.4,.85,remembered-d);
      const inWater=smooth(-.75,.35,active-d);
      const wetness=Math.max(damp*.84,inWater)*smooth(11,7,d);
      const k=i*3;
      vertexColor.setXYZ(i,
        base[k]*(1-.20*wetness),
        base[k+1]*(1-.30*wetness),
        base[k+2]*(1-.39*wetness));
    }
    vertexColor.needsUpdate=true;
  }
  updateWet(time.value);
  return {mesh:beach,updateWet};
}
function sea(scene,time,phase){
  const sea=new T.Mesh(new T.PlaneGeometry(1400,1400).rotateX(-Math.PI/2),new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{clock:time,phase,sun:{value:sunDirection}},
    vertexShader:String.raw`
      varying vec3 world;
      void main(){
        world=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }
    `,
    fragmentShader:String.raw`
      uniform float clock;
      uniform float phase;
      uniform vec3 sun;
      varying vec3 world;
      ${shaderNoise}
      ${shorelineGLSL}
      void main(){
        vec2 p=world.xz;
        float d=p.y-shCoast(p.x);
        float runup=shLine(p,clock);
        float night=smoothstep(.62,.98,phase);
        vec3 eye=normalize(cameraPosition-world);
        float distanceToEye=length(cameraPosition-world);
        float a=sin(p.x*.45+p.y*.95-clock*.98+2.*n2(p*.061));
        float b=sin(p.x*1.58-p.y*.55+clock*.83);
        float c=sin(p.y*2.43+p.x*.32-clock*1.37);
        float fresnel=pow(1.-max(0.,eye.y),3.);
        vec3 normal=normalize(vec3(a*.083+b*.035,1.,b*.061+c*.021));
        vec3 deep=mix(vec3(.035,.195,.227),vec3(.012,.035,.083),night);
        vec3 teal=mix(vec3(.10,.34,.345),vec3(.035,.095,.157),night);
        vec3 color=mix(deep,teal,fresnel*.44+.14*n2(p*.16));
        color+=(a*.014+b*.008+c*.003)*(1.-night*.44);
        float sunPath=pow(max(0.,dot(normalize(-eye.xz),normalize(sun.xz))),45.);
        float highlight=pow(max(0.,dot(reflect(-sun,normal),eye)),69.);
        color+=vec3(.91,.43,.13)*highlight*sunPath*(1.-night)*(.35+.65*n2(p*.90+clock*.14));
        float moonPath=pow(max(0.,dot(normalize(-eye.xz),normalize(vec2(.38,-.89)))),44.);
        color+=vec3(.27,.35,.50)*moonPath*night*pow(max(0.,sin(a*2.4+b)),5.)*.19;
        // Approach the sandy beach as a translucent wash instead of a cut edge.
        float depth=max(0.,runup-d);
        color=mix(color,mix(vec3(.19,.31,.30),vec3(.035,.09,.15),night),exp(-depth*.9)*.33);
        float haze=1.-exp(-distanceToEye*.0015);
        color=mix(color,mix(vec3(.40,.53,.53),vec3(.045,.08,.13),night),haze*.38);
        float opacity=smoothstep(-.35,1.20,runup-d);
        gl_FragColor=vec4(color,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  // Ocean covers only the seaward half, never the dunes behind the players.
  sea.position.set(0,0,-700);
  sea.renderOrder=1;
  scene.add(sea);
}
function foam(scene,time,phase){
  // Foam geometry follows the same coast curve and four-swell clock as the sea.
  const nx=217,nz=39,p=[],idx=[];
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=-78+i*156/(nx-1);
    const d=-1.5+j*10/(nz-1),z=coast(x)+d;
    p.push(x,Math.max(.035,heightAt(x,z)+.046),z);
    if(i<nx-1&&j<nz-1){const a=j*nx+i,b=a+nx;idx.push(a,a+1,b,a+1,b+1,b);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));
  g.setIndex(idx);g.computeVertexNormals();
  const m=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{clock:time,phase},
    vertexShader:String.raw`
      varying vec2 p;
      void main(){p=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:String.raw`
      uniform float clock;
      uniform float phase;
      varying vec2 p;
      ${shaderNoise}
      ${shorelineGLSL}
      void main(){
        float d=p.y-shCoast(p.x);
        float runup=shLine(p,clock);
        float wobble=.32*sin(p.x*.63+clock*.22)+.24*(n2(p*.88)-.5);
        float first=exp(-pow((d-runup+wobble)*1.35,2.));
        float broken=smoothstep(.29,.67,n2(p*vec2(.75,1.1)+clock*.065));
        float second=exp(-pow((d-runup+1.29+.19*sin(p.x*.9+clock*.31))*2.05,2.));
        float separated=.30+.63*broken;
        float opacity=clamp((first*.49+second*.23)*separated,0.,.76);
        opacity*=smoothstep(-72.,-60.,p.x)*(1.-smoothstep(60.,72.,p.x));
        float night=smoothstep(.62,1.,phase);
        vec3 ink=mix(vec3(.91,.95,.91),vec3(.60,.70,.79),night);
        gl_FragColor=vec4(ink,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const mesh=new T.Mesh(g,m);
  mesh.renderOrder=3;
  scene.add(mesh);
}
function seagrass(scene,compact){
  // Sparse, rounded dune plants only; never use pointed triangle billboards.
  // Keep the central sand clear for travelers to gather and take photos.
  const count=compact?130:210;
  const geometry=new T.SphereGeometry(1,12,7);
  const duneMat=material('#ffffff',{roughness:1});
  const plants=new T.InstancedMesh(geometry,duneMat,count);
  const dummy=new T.Object3D(),color=new T.Color();
  const olive=new T.Color('#9ba77c'),sage=new T.Color('#b4b28a');
  for(let i=0;i<count;i++){
    let x=0,z=0;
    for(let trial=0;trial<24;trial++){
      x=-55+random()*110;z=18+random()*38;
      // Push vegetation to the dunes and far edges, away from beach seating.
      if((Math.abs(x)>25||z>39)&&z-coast(x)>29)break;
    }
    const radius=.13+random()*.26;
    dummy.position.set(x,heightAt(x,z)+radius*.20,z);
    dummy.rotation.set(0,random()*Math.PI*2,0);
    dummy.scale.set(radius*(1+random()*.8),radius*.26,radius*(.7+random()*.9));
    dummy.updateMatrix();
    plants.setMatrixAt(i,dummy.matrix);
    plants.setColorAt(i,color.copy(olive).lerp(sage,random()));
  }
  plants.instanceMatrix.needsUpdate=true;
  plants.computeBoundingSphere();
  scene.add(plants);
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
function pine(scene,x,z,h,index){
  // Wind-shaped coastal pine, with open branching and uneven needle clusters.
  const group=new T.Group();
  group.position.set(x,heightAt(x,z),z);
  group.rotation.y=index*.37;
  scene.add(group);
  const bark=material('#6e5c50');
  const timber=new T.Mesh(new T.CylinderGeometry(.12,.29,h*.84,9,5),bark);
  timber.position.y=h*.42;timber.rotation.z=(index%2?.07:-.09);
  group.add(timber);
  const greens=['#526e5c','#6c8868','#809473','#425e50'].map(c=>material(c));
  for(let i=0;i<10;i++){
    const angle=i*2.39996+index*.51,spread=.7+Math.sqrt(i/10)*1.45;
    const bx=Math.cos(angle)*h*.18*spread,bz=Math.sin(angle)*h*.13*spread;
    const by=h*(.49+(i%5)*.066);
    const branch=new T.Mesh(new T.CylinderGeometry(.026,.074,h*.33,7),bark);
    branch.position.set(bx*.45,by-.07,bz*.48);
    branch.rotation.z=Math.cos(angle)*.72;
    branch.rotation.x=-Math.sin(angle)*.69;
    group.add(branch);
    for(let j=0;j<2;j++){
      const cloud=new T.Mesh(new T.SphereGeometry(1,10,7),greens[(i+j+index)%greens.length]);
      cloud.position.set(bx+(j-.5)*h*.13,by+(j-.5)*h*.095,bz);
      cloud.rotation.set(.12*i,.51*i,.21*j);
      cloud.scale.set(h*(.21+random()*.075),h*(.10+random()*.055),h*(.19+random()*.08));
      group.add(cloud);
    }
  }
  const crown=new T.Mesh(new T.SphereGeometry(1,12,8),greens[index%greens.length]);
  crown.position.y=h*.86;
  crown.scale.set(h*.26,h*.15,h*.23);
  group.add(crown);
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
function shorelineDetails(scene){
  for(let i=0;i<rocks.length;i++)boulder(scene,...rocks[i],i);
  pines.forEach((v,i)=>pine(scene,...v,i));
  logs(scene);
  // Scattered small shells: muted, not arcade-like collectible items.
  const geo=new T.IcosahedronGeometry(1,0),shells=new T.InstancedMesh(geo,material('#f4e1c8'),380);
  const dummy=new T.Object3D();
  for(let i=0;i<380;i++){
    const x=-45+random()*90,z=coast(x)+4+random()*24;
    dummy.position.set(x,heightAt(x,z)+.034,z);
    dummy.rotation.y=random()*6.28;dummy.scale.set(.04+random()*.11,.024,.07+random()*.08);
    dummy.updateMatrix();shells.setMatrixAt(i,dummy.matrix);
  }
  shells.computeBoundingSphere();scene.add(shells);
}
export function makeBeach(scene,time,compact=false,phase={value:0}){
  const sandSurface=sand(scene,time);
  const ground=sandSurface.mesh;
  sea(scene,time,phase);
  foam(scene,time,phase);
  seagrass(scene,compact);
  shorelineDetails(scene);
  const spawnPoints=[
    {x:-5,z:10},{x:-2.2,z:12},{x:1,z:10},{x:4,z:12},
    {x:-7,z:17},{x:7,z:17},{x:-3,z:20},{x:3,z:20}
  ];
  return {
    heightAt,canWalk,spawnPoints,
    pick(raycaster){return raycaster.intersectObject(ground,false)[0]?.point??null;},
    update(){sandSurface.updateWet(time.value);}
  };
}

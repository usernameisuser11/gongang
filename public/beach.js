import * as T from 'three';
import { rng, fbm, smooth, shaderNoise } from './nature.js';
import { sunDirection } from './atmosphere.js';

// An open, walkable sandy shore where up to eight travelers can gather.
// +Z is inland; the sea stretches toward -Z.
const random=rng(26081108);
const coast=x=>-17.8+1.35*Math.sin(x*.086+.4)+.68*Math.sin(x*.23-1.8)+.22*Math.sin(x*.53);
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
function sand(scene){
  const nx=217,nz=134,p=[],color=[],idx=[];
  const wet=new T.Color('#a78e70'),gold=new T.Color('#d4be8f'),dry=new T.Color('#f0d4a2'),edge=new T.Color('#bcaa87'),t=new T.Color();
  for(let j=0;j<nz;j++){
    const z=-38+j*103/(nz-1);
    for(let i=0;i<nx;i++){
      const x=-96+i*192/(nx-1),d=z-coast(x);
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
  return beach;
}
function sea(scene,time){
  const sea=new T.Mesh(new T.PlaneGeometry(1400,1400).rotateX(-Math.PI/2),new T.ShaderMaterial({
    uniforms:{clock:time,sun:{value:sunDirection}},
    vertexShader:String.raw`
      varying vec3 world;
      void main(){
        world=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
      }
    `,
    fragmentShader:String.raw`
      uniform float clock;
      uniform vec3 sun;
      varying vec3 world;
      ${shaderNoise}
      void main(){
        vec2 p=world.xz;
        vec3 eye=normalize(cameraPosition-world);
        float distanceToEye=length(cameraPosition-world);
        float fresnel=pow(1.-max(.0,dot(eye,vec3(0.,1.,0.))),3.);
        float a=sin(p.x*.45+p.y*.95-clock*.98+2.*n2(p*.061));
        float b=sin(p.x*1.58-p.y*.55+clock*.83);
        float c=sin(p.y*2.43+p.x*.32-clock*1.37);
        float high=(a*.52+b*.32+c*.16)*.035;
        float glitter=pow(max(0.,dot(reflect(-sun,normalize(vec3(a*.072,1.,b*.074))),eye)),80.);
        vec3 deep=vec3(.035,.195,.227);
        vec3 pale=vec3(.10,.34,.345);
        vec3 base=mix(deep,pale,fresnel*.44+.13*n2(p*.16));
        base+=high;
        float facing=max(0.,dot(normalize(-eye.xz),normalize(sun.xz)));
        float sunpath=pow(facing,52.);
        base+=vec3(1.1,.53,.18)*glitter*(.25+.75*n2(p*1.1+clock*.24))*sunpath;
        float haze=1.-exp(-distanceToEye*.0015);
        base=mix(base,vec3(.40,.53,.53),haze*.43);
        gl_FragColor=vec4(base,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  sea.position.y=0;
  scene.add(sea);
}
function foam(scene,time){
  // Geometrically follows the curved shore: no straight painted foam line.
  const nx=217,nz=23,p=[],idx=[];
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const x=-78+i*156/(nx-1);
    const d=-.5+j*6.3/(nz-1),z=coast(x)+d;
    p.push(x,Math.max(0.035,heightAt(x,z)+.042),z);
    if(i<nx-1&&j<nz-1){const a=j*nx+i,b=a+nx;idx.push(a,a+1,b,a+1,b+1,b);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{clock:time},
    vertexShader:String.raw`
      varying vec2 p;
      void main(){p=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
    `,
    fragmentShader:String.raw`
      uniform float clock;
      varying vec2 p;
      ${shaderNoise}
      float coast(float x){
        return -17.8+1.35*sin(x*.086+.4)+.68*sin(x*.23-1.8)+.22*sin(x*.53);
      }
      void main(){
        float d=p.y-coast(p.x);
        float uneven=.31*sin(p.x*.52+clock*.11)+.27*(n2(p*.48)-.5);
        float wave=1.2+1.4*sin(clock*.58+.1*sin(p.x*.12));
        float bands=exp(-pow((d-wave-uneven)*2.1,2.));
        bands+=.31*exp(-pow((d-wave-1.42-.18*sin(p.x*.7+clock*.3))*2.2,2.));
        float broken=smoothstep(.35,.64,n2(p*.7+vec2(0.,clock*.08)));
        float alpha=clamp(bands*(.53+.48*broken),0.,.80);
        alpha*=smoothstep(-73.,-62.,p.x)*(1.-smoothstep(62.,73.,p.x));
        gl_FragColor=vec4(.91,.96,.91,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const mesh=new T.Mesh(g,m);mesh.renderOrder=3;scene.add(mesh);
}
function seagrass(scene,compact){
  const count=compact?2600:4600;
  const pGeo=new T.BufferGeometry();
  pGeo.setAttribute('position',new T.Float32BufferAttribute([
    -.028,0,0, .021,.48,.01, .05,0,.02,
    -.023,0,0, -.011,.29,.09, .035,0,.014
  ],3));pGeo.computeVertexNormals();
  const tufts=new T.InstancedMesh(pGeo,material('#85936c',{side:T.DoubleSide,vertexColors:true}),count);
  const dummy=new T.Object3D(),t=new T.Color(),a=new T.Color('#a0a678'),b=new T.Color('#718e68');
  for(let i=0;i<count;i++){
    let x,z;do{x=-57+random()*114;z=3+random()*52;}while(z-coast(x)<15&&Math.abs(x)<40);
    dummy.position.set(x,heightAt(x,z)+.018,z);dummy.rotation.y=random()*6.283;
    const scale=.5+random()*1.35;dummy.scale.set(scale,scale,scale);
    dummy.updateMatrix();tufts.setMatrixAt(i,dummy.matrix);
    tufts.setColorAt(i,t.copy(a).lerp(b,random()));
  }
  tufts.computeBoundingSphere();scene.add(tufts);
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
  const trunk=new T.Mesh(new T.CylinderGeometry(.14,.32,h,8),material('#736254'));
  add(trunk,scene,x,heightAt(x,z)+h*.5,z);
  const greens=['#667c5c','#789169','#4d715e'].map(c=>material(c,{flatShading:true}));
  for(let k=0;k<5;k++){
    const layerY=h*(.48+k*.095),radius=h*(.36-k*.035);
    const layer=new T.Mesh(new T.ConeGeometry(radius,h*.33,9),greens[(index+k)%3]);
    layer.rotation.y=k*1.32+index*.44;
    add(layer,scene,x,heightAt(x,z)+layerY,z);
  }
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
export function makeBeach(scene,time,compact=false){
  const ground=sand(scene);
  sea(scene,time);
  foam(scene,time);
  seagrass(scene,compact);
  shorelineDetails(scene);
  const spawnPoints=[
    {x:-5,z:10},{x:-2.2,z:12},{x:1,z:10},{x:4,z:12},
    {x:-7,z:17},{x:7,z:17},{x:-3,z:20},{x:3,z:20}
  ];
  return {
    heightAt,canWalk,spawnPoints,
    pick(raycaster){return raycaster.intersectObject(ground,false)[0]?.point??null;}
  };
}

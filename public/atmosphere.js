import * as T from 'three';
import { shaderNoise } from './nature.js';

export const sunDirection = new T.Vector3(-.47,.105,-.883).normalize();
const vertexShader = `
  varying vec3 world;
  void main() {
    world = (modelMatrix * vec4(position,1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  }
`;

export function makeSky(scene, time) {
  const loader = new T.TextureLoader();
  function cirrusLayer(index) {
    const file = 'quiet-shore-cloud-' + index + '.png';
    const texture = loader.load(globalThis.BARAMUI_ASSETS?.[file] ?? './assets/' + file);
    texture.colorSpace = T.SRGBColorSpace;
    return texture;
  }
  const sky = new T.Mesh(new T.SphereGeometry(760,48,24),new T.ShaderMaterial({
    side:T.BackSide, depthWrite:false,
    uniforms:{ clock:time, sun:{value:sunDirection}, cirrusA:{value:cirrusLayer(1)}, cirrusB:{value:cirrusLayer(2)} }, vertexShader,
    fragmentShader: `
      varying vec3 world;
      uniform float clock;
      uniform vec3 sun;
      uniform sampler2D cirrusA;
      uniform sampler2D cirrusB;
      ${shaderNoise}

      float clouds(vec2 q) {
        vec2 curl=vec2(n2(q*.64),n2(q*.64+11.7))-.5;
        return fb2(q+curl*.89);
      }
      void main() {
        vec3 ray=normalize(world-cameraPosition);
        float elev=max(0.,ray.y);
        float nearSun=max(0.,dot(ray,sun));
        float west=pow(nearSun,4.6);
        vec3 rim=mix(vec3(.40,.49,.51),vec3(.93,.44,.22),west);
        vec3 blue=mix(vec3(.075,.22,.33),vec3(.13,.27,.42),west);
        vec3 color=mix(rim,blue,pow(smoothstep(0.,.55,elev),.49));
        color+=vec3(.40,.15,.04)*pow(nearSun,45.)*exp(-elev*3.1);
        float disc=smoothstep(.99973,.99984,nearSun);
        color+=disc*vec3(2.1,1.18,.51)+pow(nearSun,380.)*vec3(.28,.14,.05);
        vec2 d=ray.xz/(.18+elev);

        vec2 wisps=d*vec2(3.1,9.0)+vec2(-clock*.009,2.3);
        float cirrus=smoothstep(.53,.72,fb2(wisps))*.37*smoothstep(.045,.32,elev);
        color=mix(color,mix(vec3(.54,.54,.61),vec3(.91,.62,.47),west),cirrus);
        float bearing=atan(ray.x,-ray.z);
        vec2 driftA=vec2(fract(.64+bearing*.44+clock*.0004), (elev+.017)*2.27);
        vec2 driftB=vec2(fract(.48+bearing*.37+clock*.00025), (elev-.056)*2.08);
        vec4 oldCloudA=texture2D(cirrusA,driftA);
        vec4 oldCloudB=texture2D(cirrusB,driftB);
        color=mix(color,oldCloudA.rgb*.91,oldCloudA.a*.76*smoothstep(.02,.11,elev));
        color=mix(color,oldCloudB.rgb,oldCloudB.a*.58*smoothstep(.066,.17,elev));

        vec2 q=d*vec2(2.75,2.68)+vec2(clock*.018,-1.4);
        float deck=clouds(q);
        float th=.52+.045*n2(q*.25+18.);
        float volume=smoothstep(th,th+.21,deck);
        float cover=smoothstep(th-.045,th+.075,deck)*smoothstep(.016,.10,elev);
        float shade=clamp(.52+(deck-clouds(q+vec2(-.16,-.145)))*4.3,0.,1.);
        vec3 cool=mix(vec3(.21,.25,.35),vec3(.35,.235,.29),west);
        vec3 silver=mix(vec3(.62,.65,.68),vec3(1.,.57,.38),pow(nearSun,2.8));
        vec3 cloud=mix(cool,silver,clamp(.69-.58*volume+shade*.50,0.,1.));
        color=mix(color,cloud,cover*.91);

        float haze=(1.-smoothstep(-.035,.14,ray.y))*.49;
        color=mix(color,rim,haze);
        color+=(h2(gl_FragCoord.xy)-.5)*.009;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  sky.frustumCulled=false;
  sky.renderOrder=-100;
  scene.add(sky);
}

export function makeWater(scene,time) {
  const geometry = new T.PlaneGeometry(1280,1280).rotateX(-Math.PI/2);
  const water = new T.Mesh(geometry,new T.ShaderMaterial({
    uniforms:{ clock:time, sun:{value:sunDirection} },vertexShader,
    fragmentShader: `
      varying vec3 world;
      uniform float clock;
      uniform vec3 sun;
      ${shaderNoise}
      float westEdge(float z) {
        float u=(z+37.)/13.;
        return -25.+4.8*sin(z*.092+.35)+2.2*sin(z*.23)-13.*exp(-u*u)+.8*sin(z*.63);
      }
      float coast(vec2 p) {
        float tip=(p.y+51.+4.*sin(p.x*.13)+2.*sin(p.x*.31))*.88;
        return min(p.x-westEdge(p.y),tip);
      }
      // v17's four staggered swells and shared low-frequency tide clock,
      // transformed from screen-space run-up to a world-space shoal.
      float swell(float i, vec2 p) {
        float tide=clock*(.039+.006*h2(vec2(i,8.73)))+i*.263
          +.019*sin(clock*.044+i*1.31);
        return fract(tide+.011*sin(p.y*.48+i*2.3+clock*.017)
          +.005*sin(p.y*1.3-i*.79-clock*.025));
      }
      void main(){
        vec2 p=world.xz;
        vec3 eye=normalize(cameraPosition-world);
        float dist=length(cameraPosition-world);
        float angle=1.-clamp(eye.y,0.,1.);
        float farFade=1.-exp(-dist*.0038);
        float glimmer=max(0.,dot(normalize(-eye.xz),normalize(sun.xz)));
        vec3 lagoon=mix(vec3(.024,.133,.160),vec3(.071,.197,.246),pow(angle,4.));
        float coastD=-coast(p);
        lagoon=mix(lagoon,vec3(.051,.224,.213),exp(-max(0.,coastD)*.073)*.46);
        vec2 phase=vec2(p.x*.88+p.y*.44,p.y*.69-p.x*.43);
        float wave1=sin(phase.x*1.65+clock*.78+2.1*n2(p*.15));
        float wave2=sin(phase.y*2.25-clock*.86+1.8*n2(p*.23));
        float wave3=sin(p.y*4.43-p.x*1.7+clock*1.35);
        float anti=1.-smoothstep(.4,2.6,max(length(dFdx(p)),length(dFdy(p))));
        vec3 normal=normalize(vec3(.075*wave1+.033*wave2,.96,.059*wave2+.024*wave3)*vec3(anti,1.,anti));
        float gold=pow(max(0.,dot(reflect(-sun,normal),eye)),55.);
        float silk=.27+.73*n2(p*vec2(.57,1.34)+vec2(clock*.08,-clock*.28));
        lagoon+=vec3(.79,.39,.14)*gold*silk*pow(glimmer,42.);
        lagoon+=(wave1*.011+wave2*.006+wave3*.002)*anti;
        vec3 fog=mix(vec3(.29,.40,.46),vec3(.61,.37,.30),pow(glimmer,11.));
        vec3 color=mix(lagoon,fog,farFade*.77);
        float turbulence=n2(p*vec2(.8,1.72)+clock*.05);
        float foam=0.;
        for(int j=0;j<4;j++){
          float i=float(j), arrival=swell(i,p);
          float line=mix(17.5,1.1,smoothstep(.21,.92,arrival));
          float offset=sin(p.y*.55+i*1.7)*.52+.8*turbulence;
          float broken=smoothstep(.31,.68,n2(p*.83+i*4.7));
          float crest=exp(-abs(coastD-line+offset)*2.75)*broken;
          foam=max(foam,crest*smoothstep(.17,.47,arrival)*(1.-smoothstep(.84,1.,arrival)));
        }
        foam=max(foam,exp(-abs(coastD-2.0+turbulence*1.8)*1.37)*turbulence*.54);
        foam*=smoothstep(-67.,-51.,p.y)*(1.-smoothstep(48.,67.,p.y))
          *smoothstep(-67.,-56.,p.x)*(1.-smoothstep(62.,72.,p.x));
        color=mix(color,vec3(.66,.76,.69),foam*.66*(1.-farFade));
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  water.position.y=.02;
  scene.add(water);
}

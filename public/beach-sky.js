import * as T from 'three';
import { shaderNoise } from './nature.js';
import { sunDirection } from './atmosphere.js';

// Dedicated twilight-to-starlight sky for the 3D beach.
// phase: 0 = sunset, 1 = dark night; 9 minutes each direction.
const vertexShader = String.raw`
  varying vec3 world;
  void main(){
    world=(modelMatrix*vec4(position,1.)).xyz;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`;
export function makeBeachSky(scene,time,phase) {
  const sun=new T.Vector3(-.5,.15,-.84).normalize();
  const uniforms={clock:time,phase,sun:{value:sun}};
  const sky=new T.Mesh(new T.SphereGeometry(760,48,32),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,depthTest:false,
    uniforms,vertexShader,
    fragmentShader:String.raw`
      varying vec3 world;
      uniform float clock;
      uniform float phase;
      uniform vec3 sun;
      ${shaderNoise}
      void main(){
        vec3 ray=normalize(world-cameraPosition);
        float elev=max(0.,ray.y);
        float dusk=smoothstep(.27,.78,phase);
        float night=smoothstep(.66,1.,phase);
        float sunDot=max(0.,dot(ray,sun));
        vec3 top=mix(vec3(.27,.36,.50),vec3(.014,.024,.068),night);
        vec3 mid=mix(vec3(.46,.42,.56),vec3(.028,.044,.099),night);
        vec3 rim=mix(vec3(.92,.59,.42),vec3(.055,.082,.135),night);
        top=mix(top,vec3(.29,.19,.42),dusk*(1.-night)*.58);
        rim=mix(rim,vec3(.54,.28,.48),dusk*(1.-night)*.70);
        vec3 color=mix(rim,mid,smoothstep(.016,.22,elev));
        color=mix(color,top,smoothstep(.18,.7,elev));
        float sunVisible=1.-smoothstep(.28,.67,phase);
        float sunGlow=pow(sunDot,14.)*sunVisible;
        color+=vec3(.93,.38,.13)*sunGlow*.43;
        color+=vec3(1.1,.5,.20)*pow(sunDot,180.)*sunVisible*.45;
        color+=vec3(1.4,.86,.42)*smoothstep(.99977,.99987,sunDot)*sunVisible;
        vec2 p=ray.xz/max(.085,ray.y+.12);
        vec2 q=p*vec2(1.52,2.4)+vec2(-clock*.007,1.3);
        float low=fb2(q+vec2(n2(q*.32),n2(q*.29+7.))*.63);
        float cloud=smoothstep(.51,.76,low)*smoothstep(.014,.12,elev);
        vec3 cloudTint=mix(vec3(.69,.49,.52),vec3(.10,.13,.20),night);
        cloudTint=mix(cloudTint,vec3(.91,.61,.47),sunGlow*.35);
        float illumination=.59+.17*n2(q*.45+10.);
        color=mix(color,cloudTint*illumination,cloud*(.38-.10*night));
        // A quiet moon appears after the sky darkens; no artificial neon halo.
        vec3 moon=normalize(vec3(.38,.31,-.89));
        float moonDot=max(0.,dot(ray,moon));
        float moonrise=smoothstep(.72,.93,phase);
        float moonDisc=smoothstep(.99979,.99992,moonDot);
        color+=vec3(.84,.90,.98)*moonDisc*moonrise*.68;
        color+=vec3(.14,.20,.34)*pow(moonDot,95.)*moonrise*.23;
        color+=(h2(gl_FragCoord.xy)-.5)*.006;
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  sky.frustumCulled=false;
  sky.renderOrder=-100;
  scene.add(sky);
  const rng=(() => {let n=98012;return () => ((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);})();
  const position=[],brightness=[];
  for(let i=0;i<1400;i++){
    const y=.055+rng()*.90,theta=rng()*Math.PI*2;
    const r=Math.sqrt(1-y*y)*475;
    position.push(Math.sin(theta)*r,y*475,Math.cos(theta)*r);
    brightness.push(.46+rng()*.54);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(position,3));
  g.setAttribute('brightness',new T.Float32BufferAttribute(brightness,1));
  const stars=new T.Points(g,new T.ShaderMaterial({
    transparent:true,depthWrite:false,depthTest:true,
    uniforms:{phase,clock:time},
    vertexShader:String.raw`
      attribute float brightness;
      varying float starPower;
      uniform float phase;
      void main(){
        starPower=brightness*smoothstep(.67,.96,phase);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        gl_PointSize=1.1+1.3*brightness;
      }
    `,
    fragmentShader:String.raw`
      varying float starPower;
      uniform float clock;
      void main(){
        vec2 p=gl_PointCoord-.5;
        float light=exp(-dot(p,p)*28.);
        float alpha=light*starPower*.86;
        if(alpha<.012)discard;
        gl_FragColor=vec4(.80,.86,1.,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  stars.renderOrder=-95;
  stars.frustumCulled=false;
  scene.add(stars);
  return {
    update(p){
      sun.set(-.53,.15-.45*p,-.83).normalize();
      sunDirection.copy(sun);
      stars.rotation.y=p*.045;
    }
  };
}

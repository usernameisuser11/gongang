import * as T from 'three';

// Cheap procedural-free sky for the uphill map. Reuses the two painted cloud textures.
const vertex = `
varying vec3 skyWorld;
void main(){
  skyWorld = (modelMatrix * vec4(position,1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;
const fragment = `
varying vec3 skyWorld;
uniform float clock;
uniform sampler2D cloudA;
uniform sampler2D cloudB;
void main(){
  vec3 ray=normalize(skyWorld-cameraPosition);
  float altitude=ray.y;
  vec3 sun=normalize(vec3(-.47,.13,-.88));
  float toward=max(0.,dot(ray,sun));
  float glow=pow(toward,8.);
  vec3 blue=vec3(.085,.225,.37);
  vec3 high=vec3(.17,.39,.53);
  vec3 gold=mix(vec3(.43,.44,.47),vec3(.88,.50,.32),glow);
  float gradient=smoothstep(-.03,.52,altitude);
  vec3 col=mix(gold,mix(blue,high,smoothstep(.1,.78,altitude)),gradient);
  col+=vec3(.25,.11,.035)*pow(toward,56.);
  col+=vec3(1.4,.79,.37)*smoothstep(.99970,.99985,toward);
  float angle=atan(ray.x,-ray.z);
  vec2 a=vec2(fract(.62+angle*.44+clock*.00034),clamp((altitude+.016)*2.22,.001,.999));
  vec2 b=vec2(fract(.46+angle*.37-clock*.00023),clamp((altitude-.061)*2.12,.001,.999));
  vec4 ca=texture2D(cloudA,a);
  vec4 cb=texture2D(cloudB,b);
  float fadeA=smoothstep(.015,.10,altitude);
  float fadeB=smoothstep(.08,.17,altitude);
  col=mix(col,ca.rgb*.97,ca.a*.79*fadeA);
  col=mix(col,cb.rgb,cb.a*.61*fadeB);
  col=mix(col,gold,(1.-smoothstep(-.07,.13,altitude))*.31);
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function makeHillSky(scene,clock){
  const loader=new T.TextureLoader();
  const get=(i)=>{
    const filename='quiet-shore-cloud-'+i+'.png';
    const tex=loader.load(globalThis.BARAMUI_ASSETS?.[filename] ?? './assets/'+filename);
    tex.colorSpace=T.SRGBColorSpace;
    return tex;
  };
  const dome=new T.Mesh(
    new T.SphereGeometry(760,36,18),
    new T.ShaderMaterial({
      side:T.BackSide,
      depthWrite:false,
      uniforms:{clock,cloudA:{value:get(1)},cloudB:{value:get(2)}},
      vertexShader:vertex,
      fragmentShader:fragment
    })
  );
  dome.frustumCulled=false;
  dome.renderOrder=-100;
  scene.add(dome);
}

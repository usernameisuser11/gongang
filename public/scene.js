import * as T from 'three';
import { makeLand, makeFarCoast } from './land.js';
import { makeMeadow, makeTree } from './flora.js';
import { makeSky, makeWater, sunDirection } from './atmosphere.js';
import { createExperience } from './experience.js';
import { installAmbientSound } from './ambient.js';

const viewport = document.getElementById('viewport');
const loading = document.getElementById('loading');
const compact = window.matchMedia('(pointer: coarse), (max-width: 720px)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function start() {
  const renderer = new T.WebGLRenderer({antialias:!compact, alpha:false, powerPreference:'high-performance'});
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  viewport.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','걸어서 둘러보는 해안 초원');
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    loading.textContent = '풍경을 다시 불러오는 중…';
    loading.hidden = false;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => { loading.hidden = true; });

  const scene = new T.Scene();
  scene.fog = new T.FogExp2('#9baab3',.0038);
  const camera = new T.PerspectiveCamera(49,1,.13,1350);
  const time = {value:8.4};
  scene.add(new T.HemisphereLight('#c9e2ff','#94845e',1.76));
  const sunset = new T.DirectionalLight('#ffd3a1',2.66);
  sunset.position.copy(sunDirection).multiplyScalar(70);
  sunset.position.y += 16;
  scene.add(sunset);
  makeSky(scene,time);
  makeWater(scene,time);
  const terrain = makeLand(scene);
  makeFarCoast(scene);
  makeMeadow(scene,time,compact);
  makeTree(scene,time);

  const portrait = window.innerHeight > window.innerWidth;
  const experience = createExperience({
    THREE:T,scene,camera,renderer,terrain,spawn:portrait?{x:-13.3,z:19.5}:{x:-10.2,z:17.8},initialYaw:portrait?.165:.145,
    view:{distance:portrait?8.4:9.8,pitch:portrait?.135:.113,height:portrait?1.66:1.78,
      aimHeight:portrait?1.68:1.83,scale:1.01,speed:3.65}
  });
  const waveFile = 'quiet-shore-waves.m4a';
  installAmbientSound(document.getElementById('wave-sound'),globalThis.BARAMUI_ASSETS?.[waveFile] ?? './assets/'+waveFile);

  function resize() {
    const width=window.innerWidth, height=window.innerHeight;
    const isPortrait=height>width;
    camera.aspect=width/height;
    camera.fov=isPortrait?84:48;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,compact?1.38:1.35,(compact?1050:1760)/Math.max(width,height)));
    renderer.setSize(width,height,false);
  }
  window.addEventListener('resize',resize,{passive:true});
  resize();
  renderer.render(scene,camera);
  loading.hidden=true;
  viewport.dataset.ready='true';
  let previous=performance.now(), elapsed=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min(.075,Math.max(0,(now-previous)/1000));
    previous=now;
    if(document.hidden) return;
    elapsed+=dt;
    time.value=8.4+elapsed*(reducedMotion?.14:1);
    experience.update(dt,elapsed);
    renderer.render(scene,camera);
  });
}
try {
  start();
} catch (error) {
  loading.textContent='이 브라우저에서 3D 풍경을 열지 못했습니다. 하드웨어 가속이 켜진 최신 브라우저에서 다시 열어 주세요.';
  console.error(error);
}

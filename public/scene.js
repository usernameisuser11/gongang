import * as T from 'three';
import { makeLand, makeFarCoast } from './land.js';
import { makeHill } from './hill.js';
import { makeCampus } from './campus.js';
import { makeMeadow, makeTree } from './flora.js';
import { makeSky, makeWater, sunDirection } from './atmosphere.js';
import { createExperience } from './experience.js';
import { installAmbientSound } from './ambient.js';

const viewport = document.getElementById('viewport');
const loading = document.getElementById('loading');
const compact = window.matchMedia('(pointer: coarse), (max-width: 720px)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const selectedMap = new URLSearchParams(location.search).get('map');
const mapId = ['cliff','hill','campus'].includes(selectedMap) ? selectedMap : 'campus';
const requestedStop = new URLSearchParams(location.search).get('stop');
const smokeWalk = location.hostname === '127.0.0.1' && new URLSearchParams(location.search).has('smokeWalk');

function start() {
  const renderer = new T.WebGLRenderer({antialias:!compact, alpha:false, powerPreference:'high-performance'});
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = mapId === 'campus' ? 1.20 : mapId === 'hill' ? 1.12 : 1.02;
  viewport.dataset.map = mapId;
  viewport.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label',mapId === 'campus' ? '상명대 사범대학관과 학술정보관 사이 잔디 쉼터' : mapId === 'hill' ? '걸어서 오르는 상명의 언덕길' : '걸어서 둘러보는 해안 초원');
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    loading.textContent = '풍경을 다시 불러오는 중…';
    loading.hidden = false;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => { loading.hidden = true; });

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(mapId === 'campus' ? '#b4c4bd' : mapId === 'hill' ? '#a2afb0' : '#9baab3', mapId === 'campus' ? .0028 : mapId === 'hill' ? .0046 : .0038);
  const camera = new T.PerspectiveCamera(49,1,.13,1350);
  const time = {value:8.4};
  scene.add(new T.HemisphereLight('#c9e2ff','#94845e',1.76));
  const sunset = new T.DirectionalLight('#ffd3a1',2.66);
  sunset.position.copy(sunDirection).multiplyScalar(70);
  sunset.position.y += 16;
  scene.add(sunset);
  // Preserve the full painterly clouds in both worlds.
  makeSky(scene,time);
  let terrain;
  if (mapId === 'campus') {
    terrain = makeCampus(scene, time, compact);
  } else if (mapId === 'hill') {
    terrain = makeHill(scene, time, compact);
  } else {
    makeWater(scene,time);
    terrain = makeLand(scene);
    makeFarCoast(scene);
    makeMeadow(scene,time,compact);
    makeTree(scene,time);
  }

  const portrait = window.innerHeight > window.innerWidth;
  const campusSpawn = mapId === 'campus' ? terrain.spawnPoints[Math.floor(Math.random()*terrain.spawnPoints.length)] : null;
  const experience = createExperience({
    THREE:T,scene,camera,renderer,terrain,mapId,
    spawn:mapId === 'campus' ? campusSpawn : mapId === 'hill' ? terrain.spawnFor(requestedStop) : (portrait?{x:-13.3,z:19.5}:{x:-10.2,z:17.8}),
    initialYaw:mapId === 'campus' ? 0 : mapId === 'hill' ? terrain.forwardYawAt(terrain.checkpoints.find(p=>p.id===requestedStop)?.z ?? terrain.checkpoints[0].z) : (portrait?.165:.145),
    view:mapId === 'campus'
      ? {distance:portrait?10.8:13.3,pitch:.19,height:1.9,aimHeight:1.68,scale:1.08,speed:3.45}
      : mapId === 'hill'
      ? {distance:portrait?7.5:9.1,pitch:.13,height:1.65,aimHeight:1.53,scale:1.01,speed:smokeWalk?37:3.65}
      : {distance:portrait?8.4:9.8,pitch:portrait?.135:.113,height:portrait?1.66:1.78,
          aimHeight:portrait?1.68:1.83,scale:1.01,speed:3.65}
  });
  const soundControl = document.getElementById('wave-sound');
  if (mapId === 'cliff') {
    const waveFile = 'quiet-shore-waves.m4a';
    installAmbientSound(soundControl,globalThis.BARAMUI_ASSETS?.[waveFile] ?? './assets/'+waveFile);
  } else {
    soundControl.closest('.cliff-toggle').hidden = true;
  }

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
    terrain.update?.(elapsed);
    renderer.render(scene,camera);
  });
}
try {
  start();
} catch (error) {
  loading.textContent='이 브라우저에서 3D 풍경을 열지 못했습니다. 하드웨어 가속이 켜진 최신 브라우저에서 다시 열어 주세요.';
  console.error(error);
}

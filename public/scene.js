import * as T from 'three';
import { makeLand, makeFarCoast } from './land.js';
import { makeHill } from './hill.js';
import { makeCampus } from './campus.js';
import { makeBeach } from './beach.js';
import { makeBeachSky } from './beach-sky.js';
import { makeMeadow, makeTree } from './flora.js';
import { makeSky, makeWater, sunDirection } from './atmosphere.js';
import { createExperience } from './experience.js';
import { installAmbientSound } from './ambient.js';

const viewport = document.getElementById('viewport');
const loading = document.getElementById('loading');
const compact = window.matchMedia('(pointer: coarse), (max-width: 720px)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const selectedMap = new URLSearchParams(location.search).get('map');
const mapId = ['cliff','hill','campus','beach'].includes(selectedMap) ? selectedMap : 'campus';
const requestedStop = new URLSearchParams(location.search).get('stop');
const smokeWalk = location.hostname === '127.0.0.1' && new URLSearchParams(location.search).has('smokeWalk');

function start() {
  const renderer = new T.WebGLRenderer({antialias:!compact, alpha:false, powerPreference:'high-performance'});
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = mapId === 'beach' ? 1.10 : mapId === 'campus' ? 1.20 : mapId === 'hill' ? 1.12 : 1.02;
  viewport.dataset.map = mapId;
  viewport.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label',mapId === 'beach' ? '친구들과 함께 걷는 3D 모래 해변' : mapId === 'campus' ? '상명대 사범대학관과 학술정보관 사이 잔디 쉼터' : mapId === 'hill' ? '걸어서 오르는 상명의 언덕길' : '걸어서 둘러보는 해안 초원');
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    loading.textContent = '풍경을 다시 불러오는 중…';
    loading.hidden = false;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => { loading.hidden = true; });

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(mapId === 'beach' ? '#b0c2bd' : mapId === 'campus' ? '#b4c4bd' : mapId === 'hill' ? '#a2afb0' : '#9baab3', mapId === 'beach' ? .0018 : mapId === 'campus' ? .0028 : mapId === 'hill' ? .0046 : .0038);
  const camera = new T.PerspectiveCamera(49,1,.13,1350);
  const time = {value:8.4};
  const beachPhase = {value:0};
  const hemi = new T.HemisphereLight('#c9e2ff','#94845e',1.76);
  scene.add(hemi);
  const sunset = new T.DirectionalLight('#ffd3a1',2.66);
  sunset.position.copy(sunDirection).multiplyScalar(70);
  sunset.position.y += 16;
  scene.add(sunset);
  // The beach has its own dusk-to-night sky. The original worlds remain untouched.
  const beachSky = mapId === 'beach' ? makeBeachSky(scene,time,beachPhase) : null;
  if (!beachSky) makeSky(scene,time);
  const moonlight = mapId === 'beach' ? new T.DirectionalLight('#b4c9ed',0) : null;
  if (moonlight) { moonlight.position.set(14,28,-34); scene.add(moonlight); }
  const fogDusk = new T.Color('#b0c2bd');
  const fogNight = new T.Color('#14243a');
  let terrain;
  if (mapId === 'campus') {
    terrain = makeCampus(scene, time, compact);
  } else if (mapId === 'beach') {
    terrain = makeBeach(scene,time,compact,beachPhase);
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
  const gatheringSpawn = ['campus','beach'].includes(mapId) ? terrain.spawnPoints[Math.floor(Math.random()*terrain.spawnPoints.length)] : null;
  const experience = createExperience({
    THREE:T,scene,camera,renderer,terrain,mapId,
    spawn:gatheringSpawn ?? (mapId === 'hill' ? terrain.spawnFor(requestedStop) : (portrait?{x:-13.3,z:19.5}:{x:-10.2,z:17.8})),
    initialYaw:mapId === 'beach' ? 0 : mapId === 'campus' ? 0 : mapId === 'hill' ? terrain.forwardYawAt(terrain.checkpoints.find(p=>p.id===requestedStop)?.z ?? terrain.checkpoints[0].z) : (portrait?.165:.145),
    view:mapId === 'beach'
      ? {distance:portrait?11.5:14.0,pitch:.14,height:1.75,aimHeight:1.6,scale:1.08,speed:3.5}
      : mapId === 'campus'
      ? {distance:portrait?10.8:13.3,pitch:.19,height:1.9,aimHeight:1.68,scale:1.08,speed:3.45}
      : mapId === 'hill'
      ? {distance:portrait?7.5:9.1,pitch:.13,height:1.65,aimHeight:1.53,scale:1.01,speed:smokeWalk?37:3.65}
      : {distance:portrait?8.4:9.8,pitch:portrait?.135:.113,height:portrait?1.66:1.78,
          aimHeight:portrait?1.68:1.83,scale:1.01,speed:3.65}
  });
  // Quiet Shore v11 used a 9-minute sunset exploration. Offer a compact
  // 3D equivalent; wheel remains available for camera zoom.
  let beachOffset = 0;
  let scrubbing = false;
  let beachRange = null;
  let beachLabel = null;
  if (mapId === 'beach') {
    const timeline = document.createElement('section');
    timeline.className = 'beach-timeline';
    timeline.setAttribute('aria-label','해변의 저녁과 밤 시간 이동');
    timeline.innerHTML = '<div class="beach-time-head"><span>노을에서 별이 뜨는 밤까지</span><output>황금빛 저녁</output></div><input aria-label="시간 이동 · 노을에서 밤까지" type="range" min="0" max="100" step="1" value="0"><div class="beach-time-ends"><span>노을</span><span>밤하늘</span></div>';
    document.body.append(timeline);
    beachRange = timeline.querySelector('input');
    beachLabel = timeline.querySelector('output');
    beachRange.addEventListener('pointerdown',()=>{scrubbing=true;});
    for(const type of ['pointerup','pointercancel','change','blur'])
      beachRange.addEventListener(type,()=>{scrubbing=false;});
    beachRange.addEventListener('input',()=>{
      beachOffset = Number(beachRange.value)/100*540 - elapsed;
    });
  }
  const soundControl = document.getElementById('wave-sound');
  if (mapId === 'cliff' || mapId === 'beach') {
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
  let previous=performance.now(), elapsed=0, lastTimelineUpdate=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min(.075,Math.max(0,(now-previous)/1000));
    previous=now;
    if(document.hidden) return;
    elapsed+=dt;
    time.value=8.4+elapsed*(reducedMotion?.14:1);
    if (beachSky) {
      // 9 minutes to dark skies, then a gradual return to sunset.
      const cycle=((elapsed+beachOffset)%1080+1080)%1080;
      const p=cycle<=540?cycle/540:(1080-cycle)/540;
      beachPhase.value=p;
      beachSky.update(p);
      const darkness=Math.min(1,Math.max(0,(p-.45)/.55));
      hemi.intensity=1.76*(1-.78*darkness);
      sunset.intensity=2.66*(1-.98*darkness);
      sunset.position.copy(sunDirection).multiplyScalar(80);
      moonlight.intensity=.42*darkness;
      renderer.toneMappingExposure=1.10-.42*darkness;
      scene.fog.color.copy(fogDusk).lerp(fogNight,darkness);
      if (beachRange && now-lastTimelineUpdate>170) {
        lastTimelineUpdate=now;
        if (!scrubbing) beachRange.value=String(Math.round(p*100));
        beachLabel.textContent=p<.22?'황금빛 저녁':p<.47?'살구빛 노을':p<.70?'보랏빛 황혼':p<.88?'블루아워':'별이 뜨는 밤';
      }
    }
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

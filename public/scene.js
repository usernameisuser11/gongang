import * as T from 'three';
import { makeLand, makeFarCoast } from './land.js';
import { makeHill } from './hill.js';
import { makeCampus, makeCampusSky } from './campus.js';
import { makeBeach } from './beach.js';
import { makeBeachSky } from './beach-sky.js';
import { makeBeachLight } from './beach-light.js';
import { getWaveEnergy } from './shore-motion.js';
import { makeMeadow, makeTree } from './flora.js';
import { makeSky, makeWater, sunDirection } from './atmosphere.js';
import { createExperience } from './experience.js';
import { installAmbientSound, installBeachSound } from './ambient.js';

const viewport = document.getElementById('viewport');
const loading = document.getElementById('loading');
const compact = window.matchMedia('(pointer: coarse), (max-width: 720px)').matches;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const selectedMap = new URLSearchParams(location.search).get('map');
const mapId = ['cliff','hill','campus','beach'].includes(selectedMap) ? selectedMap : 'campus';
const requestedStop = new URLSearchParams(location.search).get('stop');
const smokeWalk = location.hostname === '127.0.0.1' && new URLSearchParams(location.search).has('smokeWalk');
const twilightSeconds = 9 * 60;

function start() {
  const renderer = new T.WebGLRenderer({antialias:!compact, alpha:false, powerPreference:'high-performance'});
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = mapId === 'beach' ? 1.10 : mapId === 'campus' ? 1.08 : mapId === 'hill' ? 1.12 : 1.02;
  viewport.dataset.map = mapId;
  viewport.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label',mapId === 'beach' ? '친구들과 함께 걷는 3D 모래 해변' : mapId === 'campus' ? '상명대 사범대학관과 학술정보관 사이 잔디 쉼터' : mapId === 'hill' ? '걸어서 오르는 상명의 언덕길' : '걸어서 둘러보는 해안 초원');
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    loading.textContent = '풍경을 다시 불러오는 중…';
    loading.hidden = false;
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    if (mapId === 'campus') renderer.shadowMap.needsUpdate = true;
    loading.hidden = true;
  });

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(mapId === 'beach' ? '#b0c2bd' : mapId === 'campus' ? '#b4c7d1' : mapId === 'hill' ? '#a2afb0' : '#9baab3', mapId === 'beach' ? .0018 : mapId === 'campus' ? .0036 : mapId === 'hill' ? .0046 : .0038);
  const camera = new T.PerspectiveCamera(49,1,.13,1350);
  const time = {value:8.4};
  const beachPhase = {value:0};
  const hemi = new T.HemisphereLight('#c9e2ff','#94845e',1.76);
  scene.add(hemi);
  const sunset = new T.DirectionalLight('#ffd3a1',2.66);
  sunset.position.copy(sunDirection).multiplyScalar(70);
  sunset.position.y += 16;
  scene.add(sunset);
  const beachLight = mapId === 'beach' ? makeBeachLight() : null;
  const beachSky = beachLight ? makeBeachSky(scene,time,beachPhase,beachLight) : null;
  if (mapId === 'campus') {
    makeCampusSky(scene,time);
    hemi.color.set('#dbeaff');
    hemi.groundColor.set('#908666');
    hemi.intensity = 1.56;
    sunset.color.set('#fff1d3');
    sunset.intensity = 2.02;
    sunset.position.set(26,53,37);
    // The buildings and trees are fixed, so one shadow pass covers the court.
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    sunset.castShadow = true;
    sunset.shadow.mapSize.setScalar(compact ? 1024 : 1536);
    Object.assign(sunset.shadow.camera, { left: -48, right: 48, bottom: -48, top: 48, near: 0.2, far: 130 });
    sunset.shadow.camera.updateProjectionMatrix();
    sunset.shadow.normalBias = 0.035;
    sunset.shadow.bias = -0.0002;
  } else if (!beachSky) {
    makeSky(scene,time);
  }
  const moonlight = beachLight ? new T.DirectionalLight('#b4c9ed',0) : null;
  if (moonlight) scene.add(moonlight);
  function setBeachPhase(phase) {
    beachPhase.value = phase;
    beachLight.update(phase);
    beachSky.update(phase);
    hemi.color.copy(beachLight.skyColor);
    hemi.groundColor.copy(beachLight.groundColor);
    hemi.intensity = beachLight.hemiStrength;
    sunset.color.copy(beachLight.sunColor);
    sunset.intensity = beachLight.sunStrength;
    sunset.position.copy(beachLight.sun).multiplyScalar(80);
    moonlight.color.copy(beachLight.moonColor);
    moonlight.intensity = beachLight.moonStrength;
    moonlight.position.copy(beachLight.moon).multiplyScalar(80);
    renderer.toneMappingExposure = beachLight.exposure;
    scene.fog.color.copy(beachLight.fogColor);
  }
  let terrain;
  if (mapId === 'campus') {
    terrain = makeCampus(scene, time, compact);
  } else if (mapId === 'beach') {
    terrain = makeBeach(scene,time,compact,beachLight);
    setBeachPhase(0);
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
  let elapsed = 0;
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
    const seek = () => { beachOffset = Number(beachRange.value) / 100 * twilightSeconds - elapsed; };
    beachRange.addEventListener('input', seek);
    beachRange.addEventListener('pointerdown', () => { scrubbing = true; });
    const finishScrubbing = () => {
      if (!scrubbing) return;
      scrubbing = false;
      seek();
    };
    for (const type of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(type, finishScrubbing);
  }
  const soundControl = document.getElementById('wave-sound');
  const updateSurf = beachLight ? installBeachSound(soundControl, t => getWaveEnergy(t, camera.position.x)) : null;
  if (mapId === 'cliff') {
    installAmbientSound(soundControl);
  } else if (!beachLight) {
    soundControl.closest('.cliff-toggle').hidden = true;
  }

  function resize() {
    const width=window.innerWidth, height=window.innerHeight;
    const isPortrait=height>width;
    camera.aspect=width/height;
    camera.fov=isPortrait?84:48;
    camera.updateProjectionMatrix();
    const pixelRatioCap = compact ? (beachLight ? 1.20 : 1.38) : 1.35;
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,pixelRatioCap,(compact?1050:1760)/Math.max(width,height)));
    renderer.setSize(width,height,false);
  }
  window.addEventListener('resize',resize,{passive:true});
  resize();
  renderer.render(scene,camera);
  loading.hidden=true;
  viewport.dataset.ready='true';
  const waveRate = reducedMotion ? 0.14 : 1;
  let previous=performance.now(), lastTimelineUpdate=0;
  if (beachLight) document.addEventListener('visibilitychange', () => { previous = performance.now(); });
  renderer.setAnimationLoop(now=>{
    const frameSeconds=Math.max(0,(now-previous)/1000);
    const dt=Math.min(.075,frameSeconds);
    previous=now;
    if(document.hidden) return;
    elapsed+=beachLight?frameSeconds:dt;
    time.value=8.4+elapsed*waveRate;
    if (beachLight) {
      const period = 2 * twilightSeconds;
      const cycle = ((elapsed + beachOffset) % period + period) % period;
      const phase = scrubbing ? Number(beachRange.value) / 100 : 1 - Math.abs(1 - cycle / twilightSeconds);
      setBeachPhase(phase);
      if (now-lastTimelineUpdate>170) {
        lastTimelineUpdate=now;
        if (!scrubbing) beachRange.value=String(Math.round(phase*100));
        const label = phase < .22 ? '황금빛 저녁' : phase < .51 ? '분홍빛 노을' : phase < .88 ? '블루아워' : '별이 뜨는 밤';
        if (beachLabel.textContent !== label) beachLabel.textContent = label;
      }
    }
    experience.update(dt,elapsed);
    terrain.update?.(elapsed);
    updateSurf?.(time.value, waveRate);
    renderer.render(scene,camera);
  });
}
try {
  start();
} catch (error) {
  loading.textContent='이 브라우저에서 3D 풍경을 열지 못했습니다. 하드웨어 가속이 켜진 최신 브라우저에서 다시 열어 주세요.';
  console.error(error);
}

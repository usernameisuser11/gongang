const palette = [0xd7a56d, 0x968473, 0x9c9c76, 0x8a9e9e, 0xb07d75, 0xc0a082, 0x9a889d, 0x88957c];
const actionNames = { sit: '앉기', lie: '눕기', greet: '인사', signal: '빛' };
const icons = {
  sit: '<circle cx="13" cy="5" r="1.6"/><path d="m12 9-2 4 4 2h4m-8-2-3 5h12"/>',
  lie: '<circle cx="5" cy="13" r="1.5"/><path d="m8 15 5-2 6 2M3 18h18"/>',
  greet: '<path d="M8 11V7m3 4V5m3 6V6m3 6V9m0 2v4c0 3-2 5-5 5h-1c-2 0-3-1-4-3l-2-4c-.5-1 .5-2 1.5-1.4L8 13v-3M3 8l1-2m16 0 1 2"/>',
  signal: '<path d="M12 3c0 5-3 8-8 9 5 0 8 3 8 9 0-6 3-9 8-9-5-1-8-4-8-9ZM19 3v4m-2-2h4"/>',
  settings: '<path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="17" r="2"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

function tint(id) {
  let index = 0;
  for (const char of id) index = (index * 31 + char.charCodeAt(0)) % palette.length;
  return palette[index];
}

function createTraveler(THREE, color) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const torso = new THREE.Group();
  const hips = new THREE.Group();
  group.add(body);
  body.add(hips);
  hips.add(torso);

  const cloakMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.98, side: THREE.DoubleSide });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xf8d8a0), 0.48), roughness: 0.92, side: THREE.DoubleSide });
  const tunicMaterial = new THREE.MeshStandardMaterial({ color: 0x514c42, roughness: 1 });
  const bootMaterial = new THREE.MeshStandardMaterial({ color: 0x363a39, roughness: 1 });
  const faceMaterial = new THREE.MeshStandardMaterial({ color: 0x856557, roughness: 0.98 });
  const interiorMaterial = new THREE.MeshStandardMaterial({ color: 0x403c35, roughness: 1 });
  const commonSphere = new THREE.SphereGeometry(1, 14, 9);

  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    parent.add(object);
    return object;
  }

  function oval(parent, material, x, y, z, width, height, depth) {
    const object = mesh(parent, commonSphere, material, x, y, z);
    object.scale.set(width, height, depth);
    return object;
  }

  function limb(parent, x, y, z, length, width, material) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    parent.add(pivot);
    const shape = new THREE.CapsuleGeometry(width, Math.max(0.001, length - width * 1.6), 3, 8);
    mesh(pivot, shape, material, 0, -length * 0.5, 0);
    return pivot;
  }

  // Model space faces -Z. The coat leaves a narrow opening at the front.
  const hemSegments = 36;
  const hem = new Float32Array((hemSegments + 1) * 4 * 3);
  const coatIndices = [];
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < hemSegments; column++) {
      const index = row * (hemSegments + 1) + column;
      const nextRow = index + hemSegments + 1;
      coatIndices.push(index, nextRow, index + 1, index + 1, nextRow, nextRow + 1);
    }
  }
  const coatGeometry = new THREE.BufferGeometry();
  const coatPosition = new THREE.BufferAttribute(hem, 3).setUsage(THREE.DynamicDrawUsage);
  coatGeometry.setAttribute('position', coatPosition);
  coatGeometry.setIndex(coatIndices);
  const coat = mesh(torso, coatGeometry, cloakMaterial);
  coat.frustumCulled = false;
  const coatEdge = mesh(torso, coatGeometry, trimMaterial);
  coatEdge.position.y = -0.021;
  coatEdge.scale.set(0.985, 0.987, 0.985);
  coatEdge.frustumCulled = false;
  coatEdge.castShadow = false;

  oval(torso, tunicMaterial, 0, 0.19, 0, 0.123, 0.214, 0.091);
  const hood = oval(torso, cloakMaterial, 0, 0.478, 0.023, 0.128, 0.151, 0.13);
  hood.rotation.x = 0.14;
  oval(torso, trimMaterial, 0, 0.468, -0.07, 0.095, 0.112, 0.049);
  oval(torso, interiorMaterial, 0, 0.47, -0.084, 0.085, 0.103, 0.046);
  oval(torso, faceMaterial, 0, 0.447, -0.119, 0.055, 0.066, 0.027);
  const collar = mesh(torso, new THREE.TorusGeometry(0.105, 0.023, 6, 20), trimMaterial, 0, 0.335, 0.003);
  collar.rotation.x = Math.PI * 0.5;
  collar.scale.y = 0.84;
  oval(torso, trimMaterial, 0.031, 0.305, -0.098, 0.021, 0.025, 0.01);

  const scarfGeometry = new THREE.PlaneGeometry(1, 1, 1, 12);
  const scarfPosition = scarfGeometry.attributes.position;
  scarfPosition.setUsage(THREE.DynamicDrawUsage);
  const scarf = mesh(torso, scarfGeometry, trimMaterial);
  scarf.frustumCulled = false;

  const arms = [];
  const legs = [];
  for (const side of [-1, 1]) {
    const upperArm = limb(torso, side * 0.134, 0.288, 0, 0.157, 0.043, cloakMaterial);
    const forearm = limb(upperArm, 0, -0.142, 0, 0.126, 0.031, tunicMaterial);
    oval(forearm, faceMaterial, 0, -0.124, 0, 0.029, 0.034, 0.025);
    arms.push({ upperArm, forearm, side });
    const upperLeg = limb(hips, side * 0.063, -0.003, 0, 0.236, 0.05, tunicMaterial);
    const shin = limb(upperLeg, 0, -0.22, 0, 0.23, 0.036, bootMaterial);
    oval(shin, bootMaterial, 0, -0.22, -0.034, 0.044, 0.04, 0.08);
    legs.push({ upperLeg, shin, side });
  }

  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 64;
  const context = shadowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(21,23,20,0.44)');
  gradient.addColorStop(0.4, 'rgba(21,23,20,0.28)');
  gradient.addColorStop(1, 'rgba(21,23,20,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.91, 0.79), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  shadow.rotation.x = -Math.PI * 0.5;
  shadow.position.y = 0.025;
  group.add(shadow);

  const signalMaterial = new THREE.MeshBasicMaterial({ color: 0xffe4b2, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const mote = mesh(group, new THREE.OctahedronGeometry(0.068, 1), signalMaterial);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xf8d79f, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const ring = mesh(group, new THREE.TorusGeometry(0.18, 0.006, 5, 40), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  mote.castShadow = ring.castShadow = false;
  mote.visible = ring.visible = false;
  let gestureTime = -Infinity;
  let signalTime = -Infinity;
  let sit = 0;
  let lie = 0;
  let walk = 0;

  function animate(pose, time, dt) {
    const response = 1 - Math.exp(-dt * 9);
    sit += ((pose === 'sit' ? 1 : 0) - sit) * response;
    lie += ((pose === 'lie' ? 1 : 0) - lie) * response;
    walk += ((pose === 'walk' ? 1 : 0) - walk) * response;
    const stride = Math.sin(time * 9.7);
    const breath = Math.sin(time * 2.1);
    hips.position.y = 0.474 - sit * 0.263 - lie * 0.354 + Math.abs(stride) * 0.035 * walk + breath * 0.008;
    hips.position.z = -0.24 * lie;
    hips.rotation.x = Math.PI * 0.48 * lie;
    torso.rotation.x = -0.108 * walk - 0.14 * sit;
    torso.rotation.z = stride * 0.045 * walk;
    hood.rotation.z = 0.025 * breath;
    shadow.scale.set(1 + 0.15 * sit, 1 + 0.7 * lie, 1);
    shadow.position.z = 0.22 * lie;

    for (const { upperLeg, shin, side } of legs) {
      const step = stride * side;
      upperLeg.rotation.x = 0.58 * step * walk + 1.34 * sit + 0.2 * lie;
      upperLeg.rotation.z = side * (0.055 + 0.21 * sit + 0.035 * lie);
      shin.rotation.x = (-0.075 - 0.58 * Math.max(0, -step)) * walk - 0.83 * sit - 0.09 * lie;
    }

    for (const { upperArm, forearm, side } of arms) {
      const age = time - gestureTime;
      const greeting = side === 1 && age >= 0 && age < 1.7 ? Math.sin(Math.PI * age / 1.7) ** 0.52 : 0;
      upperArm.rotation.x = -side * stride * 0.42 * walk + 0.88 * sit - 0.26 * lie;
      upperArm.rotation.z = side * (0.145 + 0.14 * sit + 0.14 * lie + greeting * 1.43);
      forearm.rotation.x = 0.23 + walk * 0.13 + sit * 0.46 - greeting * 0.2;
      forearm.rotation.z = side * greeting * (0.68 + 0.26 * Math.sin(age * 16));
    }

    for (let row = 0; row < 4; row++) {
      const span = row / 3;
      for (let column = 0; column <= hemSegments; column++) {
        const angle = 0.25 + (Math.PI * 2 - 0.5) * column / hemSegments;
        const back = (1 - Math.cos(angle)) * 0.5;
        const pleat = Math.sin(angle * 6 + time * 2.7 + span * 2) * span * (0.008 + back * 0.012);
        const width = 0.094 + 0.09 * Math.sin(span * 1.8);
        const length = 0.073 + span * 0.088 + back * 0.029;
        const y = 0.349 - span * (0.405 + back * 0.055) + pleat;
        coatPosition.setXYZ(row * (hemSegments + 1) + column, Math.sin(angle) * (width + pleat), y + sit * span * 0.075,
          -Math.cos(angle) * (length + pleat) + back * span * (0.037 + walk * 0.067 + 0.024 * breath));
      }
    }
    coatPosition.needsUpdate = true;
    coatGeometry.computeVertexNormals();

    for (let index = 0; index < scarfPosition.count; index++) {
      const span = Math.floor(index / 2) / 12;
      const side = index % 2 ? 1 : -1;
      scarfPosition.setXYZ(index, 0.07 + span * 0.09 + 0.04 * span * Math.sin(time * 4 - span * 6) + side * (0.028 - span * 0.012),
        0.337 - span * 0.147 + span * 0.049 * Math.sin(time * 4.1 - span * 5), 0.055 + span * (0.43 + 0.12 * walk));
    }
    scarfPosition.needsUpdate = true;
    scarfGeometry.computeVertexNormals();

    const age = (time - signalTime) / 2.35;
    mote.visible = ring.visible = age >= 0 && age < 1;
    if (mote.visible) {
      const fade = Math.sin(age * Math.PI);
      mote.position.set(0.17 * Math.sin(age * 3), 0.58 + age * 1.45, -0.13);
      mote.scale.setScalar(0.73 + fade * 0.47);
      mote.rotation.y = age * 5;
      signalMaterial.opacity = fade * 0.82;
      ring.position.set(mote.position.x, mote.position.y - 0.052, mote.position.z);
      ring.scale.setScalar(0.46 + age * 3.1);
      ringMaterial.opacity = fade * (1 - age) * 0.58;
    }
  }

  function dispose() {
    const assets = new Set();
    group.traverse((object) => {
      if (object.geometry) assets.add(object.geometry);
      if (object.material) assets.add(object.material);
    });
    assets.add(shadow.material.map);
    for (const asset of assets) asset.dispose();
  }

  return { group, animate, dispose, gesture: (time) => { gestureTime = time; }, signal: (time) => { signalTime = time; } };
}

function buildInterface(root) {
  const ui = document.createElement('div');
  ui.className = 'cliff-ui';
  ui.innerHTML = `
    <header class="cliff-title">
      <h1>공강</h1>
      <p class="cliff-tagline">수업과 수업 사이, 상명인을 위한 작은 쉼터</p>
      <p class="cliff-status" data-status role="status">해 질 녘 · 바다를 따라</p>
    </header>
    <div class="cliff-hint" data-hint></div>
    <button class="cliff-icon cliff-settings" type="button" data-settings aria-label="동행 및 조작 설정" aria-expanded="false">${icon('settings')}</button>
    <aside class="cliff-panel" data-panel aria-label="동행 및 조작 설정" hidden>
      <div class="cliff-panel-head"><h2>이곳에 머물기</h2><button type="button" data-close aria-label="닫기">×</button></div>
      <label class="cliff-toggle"><span>혼자 보기<small>내 풍경에만 머무르기</small></span><input type="checkbox" data-solo></label>
      <label class="cliff-toggle"><span>화면 조이스틱</span><input type="checkbox" data-stick-toggle></label>
      <div class="cliff-toggle"><span>잔잔한 파도 소리</span><button id="wave-sound" type="button" aria-label="파도 소리 재생" aria-pressed="false">켜기</button></div>
      <p class="cliff-panel-note" data-online></p>
      <ul class="cliff-companions" data-companions aria-label="현재 접속한 동행"></ul>
      <p class="cliff-panel-help">이동은 땅을 누르거나 방향키를 사용하세요. 화면을 끌면 시점이 돌아갑니다.</p>
    </aside>
    <div class="cliff-stick" data-stick hidden aria-label="화면 조이스틱"><span></span></div>
    <nav class="cliff-actions" aria-label="여행자 행동">
      ${Object.entries(actionNames).map(([action, label]) => `<button class="cliff-icon cliff-action" type="button" data-action="${action}"${action === 'sit' || action === 'lie' ? ' aria-pressed="false"' : ''}>${icon(action)}<span>${label}</span></button>`).join('')}
    </nav>`;
  root.append(ui);
  return ui;
}

function preference(key, fallback) {
  try {
    const value = localStorage.getItem(`baramui.${key}`);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function storePreference(key, value) {
  try { localStorage.setItem(`baramui.${key}`, String(value)); } catch { /* Storage can be disabled. */ }
}

function createPresence({ getState, onPlayers, onStatus, onReset }) {
  const available = /^https?:$/.test(location.protocol);
  let socket = null;
  let reconnect = null;
  let online = false;
  let solo = !available;
  let self = null;
  let full = false;
  let reconnectDelay = 1800;
  let lastCheck = 0;
  let lastSent = 0;
  let lastPayload = null;
  const blocked = new Set();
  let latest = [];

  function send(now = performance.now()) {
    if (!online || socket?.readyState !== WebSocket.OPEN) return;
    const payload = JSON.stringify({ type: 'state', ...getState() });
    if (payload === lastPayload && now - lastSent < 25000) return;
    socket.send(payload);
    lastPayload = payload;
    lastSent = now;
  }

  function start() {
    if (solo || socket) return;
    full = false;
    onStatus('connecting');
    const url = new URL('/presence', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const connection = new WebSocket(url);
    socket = connection;
    connection.addEventListener('message', (event) => {
      if (socket !== connection) return;
      const message = JSON.parse(event.data);
      if (message.type === 'welcome') {
        self = message.id;
        online = true;
        reconnectDelay = 1800;
        lastPayload = null;
        onStatus('online');
        send();
      } else if (message.type === 'snapshot') {
        latest = message.players.filter((player) => player.id !== self);
        onPlayers(latest, blocked);
      } else if (message.type === 'full') {
        full = true;
        onStatus('full');
      }
    });
    connection.addEventListener('close', () => {
      if (socket !== connection) return;
      socket = null;
      online = false;
      latest = [];
      onReset();
      if (!solo) {
        if (!full) onStatus('offline');
        reconnect = setTimeout(start, full ? 12000 : reconnectDelay);
        reconnectDelay = Math.min(15000, reconnectDelay * 1.7);
      }
    });
  }

  return {
    available,
    setSolo(value) {
      solo = value || !available;
      if (solo) {
        clearTimeout(reconnect);
        const connection = socket;
        socket = null;
        online = false;
        latest = [];
        connection?.close();
        onReset();
        onStatus(available ? 'solo' : 'local');
      } else {
        start();
      }
    },
    update() {
      const now = performance.now();
      if (now - lastCheck < 96) return;
      lastCheck = now;
      send(now);
    },
    toggleBlock(id) {
      if (blocked.has(id)) blocked.delete(id);
      else blocked.add(id);
      onPlayers(latest, blocked);
    },
  };
}

export function createExperience({ THREE, scene, camera, renderer, terrain, spawn, initialYaw = 0, root = document.body, view = {} }) {
  const element = renderer.domElement;
  element.style.touchAction = 'none';
  const ui = buildInterface(root);
  const panel = ui.querySelector('[data-panel]');
  const settings = ui.querySelector('[data-settings]');
  const hint = ui.querySelector('[data-hint]');
  const stick = ui.querySelector('[data-stick]');
  const stickThumb = stick.querySelector('span');
  const soloToggle = ui.querySelector('[data-solo]');
  const stickToggle = ui.querySelector('[data-stick-toggle]');
  const companionList = ui.querySelector('[data-companions]');
  const actionButtons = [...ui.querySelectorAll('[data-action]')];
  const local = createTraveler(THREE, 0xc99d6e);
  local.group.scale.setScalar(view.scale ?? 1.13);
  scene.add(local.group);

  let x = spawn.x;
  let z = spawn.z;
  let yaw = initialYaw;
  let pitch = view.pitch ?? 0.17;
  let zoom = view.distance ?? 6.8;
  let bodyYaw = initialYaw;
  let pose = 'idle';
  let gesture = 0;
  let signal = 0;
  let elapsed = 0;
  let initialized = false;
  let seatedView = 0;
  let reclinedView = 0;
  let destination = null;
  let transportStatus = 'connecting';
  let lastList = '';
  let hideHint;
  const keys = new Set();
  const remote = new Map();
  const raycaster = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  const aim = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const pointer = { id: null, x: 0, y: 0, total: 0 };
  const joystick = { id: null, x: 0, y: 0 };

  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xf2d8a4, transparent: true, opacity: 0.67, depthWrite: false, toneMapped: false });
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.162, 0.191, 32), markerMaterial);
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  scene.add(marker);

  const hints = {
    mouse: '땅을 눌러 이동 · 드래그로 시점 · WASD',
    touch: '땅을 눌러 이동 · 끌어서 시점 돌리기',
  };
  hint.textContent = matchMedia('(pointer: coarse)').matches ? hints.touch : hints.mouse;
  const fadeHint = () => {
    clearTimeout(hideHint);
    hideHint = setTimeout(() => hint.classList.add('cliff-hint-faded'), 4500);
  };
  hideHint = setTimeout(() => hint.classList.add('cliff-hint-faded'), 12500);

  function setPose(value) {
    if (pose === value) return;
    pose = value;
    for (const button of actionButtons) {
      if (button.hasAttribute('aria-pressed')) button.setAttribute('aria-pressed', String(button.dataset.action === pose));
    }
  }

  function doAction(action) {
    if (action === 'sit' || action === 'lie') {
      destination = null;
      setPose(pose === action ? 'idle' : action);
    } else if (action === 'greet') {
      if (pose === 'lie') setPose('sit');
      local.gesture(elapsed);
      gesture++;
    } else if (action === 'signal') {
      local.signal(elapsed);
      signal++;
    }
  }
  for (const button of actionButtons) button.addEventListener('click', () => doAction(button.dataset.action));

  function setPanel(open) {
    panel.hidden = !open;
    settings.setAttribute('aria-expanded', String(open));
    if (open) {
      keys.clear();
      joystick.id = null;
      joystick.x = joystick.y = 0;
      stickThumb.style.transform = '';
      panel.querySelector('[data-close]').focus();
    } else settings.focus();
  }
  settings.addEventListener('click', () => setPanel(panel.hidden));
  panel.querySelector('[data-close]').addEventListener('click', () => setPanel(false));

  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
  const actionKeys = { Digit1: 'sit', Digit2: 'lie', KeyE: 'greet', KeyF: 'signal' };
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && !panel.hidden) setPanel(false);
    if (event.ctrlKey || event.metaKey || event.altKey || !panel.hidden || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    if (movementKeys.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
      destination = null;
      fadeHint();
    }
    if (!event.repeat && actionKeys[event.code]) doAction(actionKeys[event.code]);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    pointer.id = null;
    joystick.id = null;
    joystick.x = joystick.y = 0;
    stickThumb.style.transform = '';
  });

  function pointOnTerrain(event) {
    const rect = element.getBoundingClientRect();
    cursor.set((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2);
    raycaster.setFromCamera(cursor, camera);
    if (terrain.pick) return terrain.pick(raycaster);
    const sample = new THREE.Vector3();
    for (let distance = 0.5; distance < 150; distance += 0.5) {
      raycaster.ray.at(distance, sample);
      if (sample.y <= terrain.heightAt(sample.x, sample.z) && terrain.canWalk(sample.x, sample.z)) return sample;
    }
    return null;
  }

  element.addEventListener('pointerdown', (event) => {
    if (!panel.hidden || pointer.id !== null || (event.button !== 0 && event.button !== 2)) return;
    pointer.id = event.pointerId;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.total = 0;
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointermove', (event) => {
    if (pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.total += Math.hypot(dx, dy);
    if (pointer.total < 5) return;
    yaw -= dx * 0.005;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.004, -0.16, 0.76);
    fadeHint();
  });
  element.addEventListener('pointerup', (event) => {
    if (pointer.id !== event.pointerId) return;
    pointer.id = null;
    if (pointer.total > 9 || event.button !== 0) return;
    const point = pointOnTerrain(event);
    if (point && terrain.canWalk(point.x, point.z)) {
      destination = { x: point.x, z: point.z };
      fadeHint();
    }
  });
  element.addEventListener('pointercancel', () => { pointer.id = null; });
  element.addEventListener('contextmenu', (event) => event.preventDefault());
  element.addEventListener('wheel', (event) => {
    if (!panel.hidden) return;
    event.preventDefault();
    zoom = THREE.MathUtils.clamp(zoom + Math.sign(event.deltaY) * 0.55, 3.8, 10.8);
  }, { passive: false });

  function moveStick(event) {
    if (joystick.id !== event.pointerId) return;
    const rect = stick.getBoundingClientRect();
    const radius = rect.width * 0.35;
    const dx = event.clientX - rect.left - rect.width * 0.5;
    const dy = event.clientY - rect.top - rect.height * 0.5;
    const divisor = Math.max(radius, Math.hypot(dx, dy));
    joystick.x = dx / divisor;
    joystick.y = dy / divisor;
    stickThumb.style.transform = `translate(${joystick.x * radius}px, ${joystick.y * radius}px)`;
  }
  stick.addEventListener('pointerdown', (event) => {
    if (joystick.id !== null) return;
    joystick.id = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    destination = null;
    fadeHint();
    moveStick(event);
  });
  stick.addEventListener('pointermove', moveStick);
  function resetStick(event) {
    if (event.pointerId !== joystick.id) return;
    joystick.id = null;
    joystick.x = joystick.y = 0;
    stickThumb.style.transform = '';
  }
  stick.addEventListener('pointerup', resetStick);
  stick.addEventListener('pointercancel', resetStick);
  stickToggle.checked = preference('stick', false);
  stick.hidden = !stickToggle.checked;
  stickToggle.addEventListener('change', () => {
    stick.hidden = !stickToggle.checked;
    joystick.id = null;
    joystick.x = joystick.y = 0;
    stickThumb.style.transform = '';
    storePreference('stick', stickToggle.checked);
  });

  const statusCopy = {
    online: ['동행 가능', '현재 이곳에 접속한 여행자만 보입니다.'],
    connecting: ['동행 연결 중', '조용히 연결을 기다리는 중입니다.'],
    offline: ['연결 대기 중', '풍경을 계속 감상할 수 있습니다. 연결을 다시 시도합니다.'],
    full: ['함께할 자리를 기다리는 중', '이곳에는 최대 8명이 머뭅니다. 자리가 나면 다시 연결합니다.'],
    solo: ['혼자 보는 중', '혼자 보기를 끄면 이곳의 여행자와 함께할 수 있습니다.'],
    local: ['혼자 보는 중', '이 파일은 오프라인으로 열려 있습니다.'],
  };
  const onlineText = ui.querySelector('[data-online]');
  const statusText = ui.querySelector('[data-status]');
  function refreshStatus() {
    statusText.textContent = transportStatus === 'online' && remote.size
      ? `해 질 녘 · ${remote.size}명과 함께`
      : `해 질 녘 · ${statusCopy[transportStatus][0]}`;
    onlineText.textContent = statusCopy[transportStatus][1];
  }

  function removeRemote(id, traveler) {
    scene.remove(traveler.model.group);
    traveler.model.dispose();
    remote.delete(id);
  }

  function updatePlayers(received, blocked) {
    const players = received.filter((player) => terrain.canWalk(player.x, player.z));
    const visible = new Set(players.filter((player) => !blocked.has(player.id)).map((player) => player.id));
    for (const [id, traveler] of remote) if (!visible.has(id)) removeRemote(id, traveler);
    for (const player of players) {
      if (!visible.has(player.id)) continue;
      let traveler = remote.get(player.id);
      if (!traveler) {
        const model = createTraveler(THREE, tint(player.id));
        model.group.scale.copy(local.group.scale);
        model.group.position.set(player.x, terrain.heightAt(player.x, player.z), player.z);
        model.group.rotation.y = player.yaw;
        scene.add(model.group);
        traveler = { model, target: player, gesture: player.gesture, signal: player.signal };
        remote.set(player.id, traveler);
      }
      traveler.target = player;
      if (player.gesture > traveler.gesture) traveler.model.gesture(elapsed);
      if (player.signal > traveler.signal) traveler.model.signal(elapsed);
      traveler.gesture = player.gesture;
      traveler.signal = player.signal;
    }
    refreshStatus();
    const listKey = players.map((player) => player.id + (blocked.has(player.id) ? '!' : '')).join(',');
    if (listKey === lastList) return;
    lastList = listKey;
    companionList.replaceChildren();
    for (const [index, player] of players.entries()) {
      const entry = document.createElement('li');
      const label = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.background = `#${tint(player.id).toString(16).padStart(6, '0')}`;
      label.append(swatch, `여행자 ${index + 1}`);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = blocked.has(player.id) ? '차단 해제' : '차단';
      button.addEventListener('click', () => presence.toggleBlock(player.id));
      entry.append(label, button);
      companionList.append(entry);
    }
  }

  const presence = createPresence({
    getState: () => ({ x, z, yaw: Math.atan2(Math.sin(bodyYaw), Math.cos(bodyYaw)), pose, gesture, signal }),
    onPlayers: updatePlayers,
    onStatus: (value) => { transportStatus = value; refreshStatus(); },
    onReset: () => updatePlayers([], new Set()),
  });
  soloToggle.checked = preference('solo', false) || !presence.available;
  soloToggle.disabled = !presence.available;
  soloToggle.addEventListener('change', () => {
    storePreference('solo', soloToggle.checked);
    presence.setSolo(soloToggle.checked);
  });
  presence.setSolo(soloToggle.checked);

  function move(dx, dz) {
    if (terrain.canWalk(x + dx, z + dz)) {
      x += dx;
      z += dz;
      return true;
    }
    if (dx && terrain.canWalk(x + dx, z)) {
      x += dx;
      return true;
    }
    if (dz && terrain.canWalk(x, z + dz)) {
      z += dz;
      return true;
    }
    return false;
  }

  function update(delta, time) {
    elapsed = time;
    const dt = Math.min(Math.max(delta, 0.001), 0.055);
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const rightX = -forwardZ;
    const rightZ = forwardX;
    const strafe = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + joystick.x;
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - joystick.y;
    let dx = strafe * rightX + forward * forwardX;
    let dz = strafe * rightZ + forward * forwardZ;
    const speed = (view.speed ?? 3.4) * dt;
    const manualLength = Math.hypot(dx, dz);
    if (manualLength > 0.08) {
      const divisor = Math.max(1, manualLength);
      dx *= speed / divisor;
      dz *= speed / divisor;
      destination = null;
    } else if (destination) {
      dx = destination.x - x;
      dz = destination.z - z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.18) destination = null;
      const step = distance > 0.001 ? Math.min(1, speed / distance) : 0;
      dx *= step;
      dz *= step;
    } else {
      dx = dz = 0;
    }

    if (Math.hypot(dx, dz) > 0.0001) {
      const oldX = x;
      const oldZ = z;
      if (move(dx, dz)) {
        const heading = Math.atan2(oldX - x, oldZ - z);
        bodyYaw += Math.atan2(Math.sin(heading - bodyYaw), Math.cos(heading - bodyYaw)) * (1 - Math.exp(-dt * 11));
        setPose('walk');
      } else {
        destination = null;
        if (pose === 'walk') setPose('idle');
      }
    } else if (pose === 'walk') {
      setPose('idle');
    }

    const floor = terrain.heightAt(x, z);
    local.group.position.set(x, floor, z);
    local.group.rotation.y = bodyYaw;
    local.animate(pose, time, dt);

    marker.visible = Boolean(destination);
    if (destination) {
      marker.position.set(destination.x, terrain.heightAt(destination.x, destination.z) + 0.035, destination.z);
      marker.scale.setScalar(1 + Math.sin(time * 4) * 0.12);
    }

    const postureBlend = 1 - Math.exp(-dt * 3.8);
    seatedView += ((pose === 'sit' ? 1 : 0) - seatedView) * postureBlend;
    reclinedView += ((pose === 'lie' ? 1 : 0) - reclinedView) * postureBlend;
    const viewDistance = Math.max(2.8, zoom - seatedView * 0.45 - reclinedView * 1.95);
    const radial = Math.cos(pitch) * viewDistance;
    const cameraHeight = (view.height ?? 1.75) - seatedView * 0.7 - reclinedView * 1.05;
    desired.set(x - forwardX * radial, floor + cameraHeight + Math.sin(pitch) * viewDistance, z - forwardZ * radial);
    desired.y = Math.max(desired.y, terrain.heightAt(desired.x, desired.z) + 0.62);
    const aimHeight = (view.aimHeight ?? 1.25) - seatedView * 0.51 + reclinedView * 2.45;
    aim.set(x + forwardX * 1.35, floor + aimHeight, z + forwardZ * 1.35);
    if (initialized) camera.position.lerp(desired, 1 - Math.exp(-dt * 8));
    else camera.position.copy(desired);
    initialized = true;
    camera.lookAt(aim);

    const interpolation = 1 - Math.exp(-dt * 11);
    for (const { model, target } of remote.values()) {
      const group = model.group;
      group.position.x += (target.x - group.position.x) * interpolation;
      group.position.z += (target.z - group.position.z) * interpolation;
      group.position.y = terrain.heightAt(group.position.x, group.position.z);
      const turn = target.yaw - group.rotation.y;
      group.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * interpolation;
      model.animate(target.pose, time, dt);
    }
    presence.update();
  }

  update(0.016, 0);
  return { update };
}

const waveTrack = 'quiet-shore-waves.m4a';

export function installAmbientSound(button, source = globalThis.BARAMUI_ASSETS?.[waveTrack] ?? `./assets/${waveTrack}`) {
  if (!button) return;

  let audio;
  let enabled = false;
  let attempt = 0;

  function showState() {
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? '끄기' : '켜기';
  }

  button.addEventListener('click', async () => {
    const playback = ++attempt;
    if (enabled) {
      enabled = false;
      audio.pause();
      showState();
      return;
    }

    if (!audio) {
      audio = new Audio(source);
      audio.preload = 'none';
      audio.loop = true;
    }

    enabled = true;
    button.removeAttribute('title');
    showState();
    try {
      await audio.play();
    } catch {
      if (playback !== attempt) return;
      enabled = false;
      button.title = '파도 소리를 재생할 수 없습니다.';
      showState();
    }
  });
}

// Quiet Shore v11 uses filtered noise with separate envelopes for the body of
// the surf, foam breaking on the sand, and the water drawing back.
export function installBeachSound(button, getEnergy) {
  let audio;
  let enabled = false;
  let attempt = 0;
  let nextUpdate = 0;
  let suspendTimer;

  function makeSurf() {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    const buffer = context.createBuffer(2, context.sampleRate * 8, context.sampleRate);
    const fade = 1024;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      let seed = 328489 + channel * 913807;
      for (let i = 0; i < samples.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        samples[i] = seed / 2147483648 - 1;
      }
      for (let i = 0; i < fade; i++) {
        const mix = i / (fade - 1);
        const end = samples.length - fade + i;
        samples[end] = samples[end] * (1 - mix) + samples[i] * mix;
      }
    }

    function layer(highpass, lowpass, offset) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = fade / context.sampleRate;
      const high = context.createBiquadFilter();
      high.type = 'highpass';
      high.frequency.value = highpass;
      high.Q.value = 0.5;
      const low = context.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = lowpass;
      low.Q.value = 0.5;
      const level = context.createGain();
      level.gain.value = 0;
      source.connect(high).connect(low).connect(level).connect(master);
      source.start(0, offset);
      return { level: level.gain, cutoff: low.frequency };
    }
    return { context, master: master.gain, surf: layer(45, 870, 0), foam: layer(620, 4500, 2.3), backwash: layer(145, 2000, 4.9) };
  }

  function updateVolume() {
    if (!audio) return;
    clearTimeout(suspendTimer);
    const audible = enabled && !document.hidden;
    audio.master.setTargetAtTime(audible ? 0.58 : 0, audio.context.currentTime, 0.075);
    if (!audible) suspendTimer = setTimeout(() => { audio.context.suspend().catch(() => {}); }, 400);
  }

  function showState() {
    button.setAttribute('aria-pressed', String(enabled));
    button.textContent = enabled ? '끄기' : '켜기';
  }

  button.addEventListener('click', async () => {
    const request = ++attempt;
    enabled = !enabled;
    button.removeAttribute('title');
    showState();
    if (!enabled) {
      updateVolume();
      return;
    }
    try {
      audio ??= makeSurf();
      clearTimeout(suspendTimer);
      await audio.context.resume();
      if (request === attempt) updateVolume();
    } catch {
      if (request !== attempt) return;
      enabled = false;
      button.title = '파도 소리를 재생할 수 없습니다.';
      updateVolume();
      showState();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (audio && enabled && !document.hidden) audio.context.resume().catch(() => {});
    updateVolume();
  });

  return (waveTime, waveRate) => {
    if (!enabled || !audio || audio.context.state !== 'running') return;
    const now = audio.context.currentTime;
    if (now < nextUpdate) return;
    nextUpdate = now + 0.045;
    const { swell, breaker, backwash, offshore } = getEnergy(waveTime + 0.075 * waveRate);
    audio.surf.level.setTargetAtTime(0.06 + 0.17 * swell + 0.06 * offshore, now, 0.14);
    audio.foam.level.setTargetAtTime(0.009 + 0.30 * breaker, now, breaker > 0.4 ? 0.08 : 0.15);
    audio.foam.cutoff.setTargetAtTime(2100 + 2300 * breaker, now, 0.12);
    audio.backwash.level.setTargetAtTime(0.012 + 0.24 * backwash, now, 0.14);
    audio.backwash.cutoff.setTargetAtTime(1300 + 1200 * backwash, now, 0.17);
  };
}

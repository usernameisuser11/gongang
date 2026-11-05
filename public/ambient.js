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

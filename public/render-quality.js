// Lightweight adaptive pixel-ratio controller. It never exceeds the
// device-specific pixel ratio chosen by the main scene.
export function createResolutionController({
  minScale = 0.7,
  windowSeconds = 2.5,
  reduceBelowFps = 27,
  restoreAboveFps = 52,
} = {}) {
  let scale = 1;
  let frames = 0;
  let seconds = 0;
  let slowWindows = 0;
  let fastWindows = 0;

  return {
    sample(frameSeconds) {
      // Discard tab-resume pauses and other non-rendering intervals.
      if (!Number.isFinite(frameSeconds) || frameSeconds <= 0 || frameSeconds > 0.25) return null;
      frames++;
      seconds += frameSeconds;
      if (seconds < windowSeconds) return null;

      const fps = frames / seconds;
      frames = 0;
      seconds = 0;
      slowWindows = fps < reduceBelowFps ? slowWindows + 1 : 0;
      fastWindows = fps > restoreAboveFps ? fastWindows + 1 : 0;

      // Require sustained load and introduce hysteresis to avoid rapid
      // resolution changes on variable mobile hardware.
      if (slowWindows >= 2 && scale > minScale) {
        scale = Math.max(minScale, Math.round((scale - 0.12) * 100) / 100);
        slowWindows = fastWindows = 0;
        return scale;
      }
      if (fastWindows >= 4 && scale < 1) {
        scale = Math.min(1, Math.round((scale + 0.06) * 100) / 100);
        slowWindows = fastWindows = 0;
        return scale;
      }
      return null;
    },
    reset() {
      frames = seconds = slowWindows = fastWindows = 0;
    },
    get scale() { return scale; },
  };
}

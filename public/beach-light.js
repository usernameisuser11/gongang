import * as T from 'three';
import { lerp, smooth } from './nature.js';

const colors = ['zenith', 'middle', 'horizon', 'cloud', 'water', 'sunColor', 'skyColor', 'groundColor', 'fogColor'];
const levels = ['sunStrength', 'hemiStrength', 'exposure'];
const twilight = [
  [0, ['#7799c4', '#d4b6b1', '#f4bc86', '#d79c8d', '#536f88', '#ffd19b', '#d1defa', '#c39872', '#cdad9a'], [2.45, 1.52, 1.10]],
  [.32, ['#736aa7', '#cd8baa', '#f3a598', '#cc83a0', '#645f83', '#ffb698', '#b6b9eb', '#ac747e', '#b58d9e'], [1.20, 1.31, 1.07]],
  [.67, ['#314581', '#645c94', '#a486a8', '#7e6b9d', '#354967', '#eca1a3', '#8da8ec', '#795f83', '#626c90'], [0, 1.05, 1.07]],
  [1, ['#122348', '#25375e', '#4a567f', '#343e64', '#253d59', '#bb9bcf', '#88a2dd', '#5a6081', '#384664'], [0, .70, 1.10]],
].map(([phase, palette, intensity]) => ({
  phase, palette: palette.map(color => new T.Color(color)), intensity,
}));

export function makeBeachLight() {
  const light = {
    sun: new T.Vector3(),
    moon: new T.Vector3(),
    moonColor: new T.Color('#c4daff'),
    moonStrength: 0,
    uniforms: {},
    update(phase) {
      const upper = twilight.findIndex((stop, i) => i > 0 && phase <= stop.phase);
      const a = twilight[upper - 1], b = twilight[upper];
      const mix = smooth(a.phase, b.phase, phase);
      colors.forEach((name, i) => light[name].copy(a.palette[i]).lerp(b.palette[i], mix));
      levels.forEach((name, i) => { light[name] = lerp(a.intensity[i], b.intensity[i], mix); });
      light.sun.set(-.25 - .09 * phase, .15 - .28 * phase, -1).normalize();
      light.moon.set(.19 + .055 * phase, .01 + .23 * phase, -1).normalize();
      const moonrise = smooth(.65, .95, phase);
      light.moonStrength = .82 * moonrise;
      light.uniforms.sunVisible.value = 1 - smooth(.36, .57, phase);
      light.uniforms.moonVisible.value = moonrise;
      light.uniforms.starsVisible.value = smooth(.66, .98, phase);
    },
  };
  for (const name of colors) light[name] = new T.Color();
  for (const name of [...colors, 'sun', 'moon', 'moonColor']) light.uniforms[name] = { value: light[name] };
  for (const name of ['sunVisible', 'moonVisible', 'starsVisible']) light.uniforms[name] = { value: 0 };
  light.update(0);
  return light;
}

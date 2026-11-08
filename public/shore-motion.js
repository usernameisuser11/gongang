import { smooth } from './nature.js';

const fract = n => n - Math.floor(n);
const unit = n => Math.max(0, Math.min(1, n));
const seeded = seed => fract(Math.sin(seed * 127.1 + 58.2) * 43758.5453123);
const swells = Array.from({ length: 4 }, (_, i) => ({
  speed: .039 + .006 * seeded(i * 8.73),
  amplitude: .75 + .24 * seeded(i * 21.6 + 8.3),
}));

// The coast curves gently; distance is measured inland (+Z) from this curve.
const coastline = [[1.35, .086, .4], [.68, .23, -1.8], [.22, .53, 0]];
export const coast = x => {
  let z = -17.8;
  for (const [amplitude, frequency, offset] of coastline) {
    z += amplitude * Math.sin(x * frequency + offset);
  }
  return z;
};
export const shoreCoastGLSL = `
  float shCoast(float x) {
    return -17.8 ${coastline.map(([a, f, offset]) => `+ ${a} * sin(x * ${f} + (${offset.toFixed(2)}))`).join(' ')};
  }
`;

function waveProgress(x, t, i) {
  return fract(t * swells[i].speed + i * .263 + .019 * Math.sin(t * .044 + i * 1.31)
    + .011 * Math.sin(x * .083 + i * 2.3 + t * .017)
    + .005 * Math.sin(x * .22 - i * .79 - t * .025));
}

export function runupAt(x, t) {
  let runup = 0;
  for (let i = 0; i < swells.length; i++) {
    const p = waveProgress(x, t, i);
    const arrival = smooth(.67, .83, p) * (1 - smooth(.87, .993, p));
    runup = Math.max(runup, arrival * swells[i].amplitude);
  }
  const swash = .13 + .79 * runup + .045 * Math.sin(t * .040 + x * .02);
  const drift = .27 * Math.sin(t * .012 - .9) + .12 * Math.sin(x * .48 + t * .07);
  return .28 + 5.4 * Math.max(.07, Math.min(.96, swash)) + drift;
}

// Quiet Shore v11 ties the surf envelope to advancing and receding water.
export function getWaveEnergy(t, x = 0) {
  let swell = 0, breaker = 0, backwash = 0;
  for (const [offset, weight] of [[-23, .17], [0, .66], [23, .17]]) {
    const sample = x + offset;
    const current = runupAt(sample, t);
    const prior = runupAt(sample, t - .38);
    const previousPeak = runupAt(sample, t - .86);
    swell += weight * unit(current / 5.1);
    breaker += weight * unit((current - prior) / .57);
    backwash += weight * unit((previousPeak - current) / 1.2);
  }
  const mood = unit(.73 + .17 * Math.sin(t * .116 + .9)
    + .08 * Math.sin(t * .041 - 1.5) + .055 * Math.sin(t * .197 + .6));
  return {
    swell: .20 + .74 * swell,
    breaker: breaker * (.88 + .12 * mood),
    backwash: backwash * .94,
    offshore: .34 + .24 * mood,
  };
}

// Run-up, breakers, and audio must agree on phase across JS and WebGL. Emit
// seeded constants once so GPU-dependent sin/hash rounding cannot change them.
export const shorelineGLSL = `
  const float shSpeeds[4] = float[4](${swells.map(({ speed }) => speed.toFixed(9)).join(',')});
  const float shAmps[4] = float[4](${swells.map(({ amplitude }) => amplitude.toFixed(9)).join(',')});
  float shProgress(float x, float t, int i) {
    float n = float(i);
    return fract(t * shSpeeds[i] + n * .263 + .019 * sin(t * .044 + n * 1.31)
      + .011 * sin(x * .083 + n * 2.3 + t * .017)
      + .005 * sin(x * .22 - n * .79 - t * .025));
  }
  float shLine(float x, float t) {
    float runup = 0.;
    for (int i = 0; i < 4; i++) {
      float p = shProgress(x, t, i);
      float arrival = smoothstep(.67, .83, p) * (1. - smoothstep(.87, .993, p));
      runup = max(runup, arrival * shAmps[i]);
    }
    float swash = .13 + .79 * runup + .045 * sin(t * .040 + x * .02);
    float drift = .27 * sin(t * .012 - .9) + .12 * sin(x * .48 + t * .07);
    return .28 + 5.4 * clamp(swash, .07, .96) + drift;
  }
`;

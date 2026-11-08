import * as T from 'three';
import { shaderNoise } from './nature.js';
import { runupAt, shoreCoastGLSL } from './shore-motion.js';

const across = 96, depth = 6.4;
const historyStep = .68, historyCount = 64;

export function makeBeachMoisture(time, compact) {
  const columns = compact ? 96 : 128, rows = 40;
  const pixels = new Uint8Array(columns * rows);
  const texture = new T.DataTexture(pixels, columns, rows, T.RedFormat);
  texture.minFilter = texture.magFilter = T.LinearFilter;
  const history = new Float32Array(columns * historyCount);
  let newest = -Infinity, lastUpdate = -Infinity;
  const index = step => ((step % historyCount + historyCount) % historyCount) * columns;
  function update() {
    const now = time.value;
    if (now >= lastUpdate && now - lastUpdate < .14) return;
    lastUpdate = now;
    const step = Math.floor(now / historyStep);
    const oldest = step - historyCount + 1;
    const begin = step < newest ? oldest : Math.max(oldest, newest + 1);
    // Cache fixed-time run-up samples. Only a new wave profile enters the
    // history each step, even though we reconstruct drying for every texel.
    for (let sample = begin; sample <= step; sample++) {
      const start = index(sample), sampleTime = sample * historyStep;
      for (let x = 0; x < columns; x++) {
        const worldX = ((x + .5) / columns * 2 - 1) * across;
        history[start + x] = runupAt(worldX, sampleTime);
      }
    }
    newest = step;
    pixels.fill(0);
    for (let x = 0; x < columns; x++) {
      const worldX = ((x + .5) / columns * 2 - 1) * across;
      let next = 0;
      const current = runupAt(worldX, now);
      for (; next < rows && (next + .5) * depth / rows <= current; next++) {
        pixels[next * columns + x] = 255;
      }
      for (let sample = step; sample >= oldest && next < rows; sample--) {
        const past = history[index(sample) + x];
        if (past < (next + .5) * depth / rows) continue;
        const age = (now - sample * historyStep) / (historyCount * historyStep);
        const wetness = Math.round(255 * Math.pow(Math.max(0, 1 - age), 1.65));
        for (; next < rows && (next + .5) * depth / rows <= past; next++) {
          pixels[next * columns + x] = wetness;
        }
      }
    }
    texture.needsUpdate = true;
  }
  update();
  return { texture, update, across, depth };
}

export function applyBeachMoisture(material, moisture, light) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, light.uniforms, { moisture: { value: moisture.texture } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 beachPoint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nbeachPoint = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 beachPoint;
        uniform sampler2D moisture;
        uniform vec3 horizon;
        float dampness;
        ${shaderNoise}
        ${shoreCoastGLSL}
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float x = beachPoint.x;
        float d = beachPoint.z - shCoast(x);
        dampness = texture2D(moisture, vec2(.5 + x / ${(2 * moisture.across).toFixed(1)}, d / ${moisture.depth.toFixed(1)})).r;
        dampness *= 1. - smoothstep(5.2, ${moisture.depth.toFixed(1)}, d);
        float fine = 1. - smoothstep(.13, .5, length(fwidth(beachPoint.xz)));
        float grain = (n2(beachPoint.xz * vec2(2.9, 7.1)) - .5) * fine;
        diffuseColor.rgb *= mix(vec3(1.), vec3(.62, .55, .49), dampness) * (1. + grain * .084);
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .34, dampness);')
      .replace('#include <opaque_fragment>', `
        float grazing = pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 2.);
        outgoingLight += horizon * dampness * (.025 + .063 * grazing);
        #include <opaque_fragment>
      `);
  };
}

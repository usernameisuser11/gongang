import * as T from 'three';
import { shaderNoise } from './nature.js';
import { coast, shorelineGLSL } from './shore-motion.js';

export function makeBeachWater(scene, time, compact, heightAt, light) {
  const width = compact ? 97 : 129;
  const xs = [-700, -236, -110];
  for (let i = 0; i < width; i++) xs.push(-96 + 192 * i / (width - 1));
  xs.push(110, 236, 700);
  const rows = [-1375, -450, -180, -95, -65];
  for (let d = -59; d < -5; d += compact ? 2.15 : 1.35) rows.push(d);
  for (let d = -5; d <= 6.5; d += .5) rows.push(d);
  const position = [], distance = [], indices = [];
  for (let j = 0; j < rows.length; j++) {
    const d = rows[j];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i], z = coast(x) + d;
      // The thin swash rides just over the same sloped surface the players walk on.
      const y = d > 1 && Math.abs(x) <= 96 ? Math.max(0, heightAt(x, z) + .042) : 0;
      position.push(x, y, z);
      distance.push(d);
      if (i < xs.length - 1 && j < rows.length - 1) {
        const a = j * xs.length + i, b = a + xs.length;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3));
  geometry.setAttribute('shoreDistance', new T.Float32BufferAttribute(distance, 1));
  geometry.setIndex(indices);
  const water = new T.Mesh(geometry, new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { ...light.uniforms, clock: time },
    vertexShader: String.raw`
      uniform float clock;
      attribute float shoreDistance;
      varying float d;
      varying vec3 world;
      void main() {
        vec3 point = position;
        // Two crossing, low-frequency swells give the offshore water genuine
        // height and a readable silhouette. Taper both near the shoreline and
        // at the distant coarse horizon to avoid shoreline mesh intersections.
        float ocean = (1. - smoothstep(-28., -7., shoreDistance))
          * smoothstep(-120., -42., shoreDistance);
        float waveA = point.z * .205 + point.x * .047 - clock * .43;
        float waveB = point.z * .145 - point.x * .069 - clock * .32 + .21 * sin(waveA);
        point.y += ocean * (.32 * sin(waveA) + .17 * sin(waveB));
        float ripples = smoothstep(-65., -10., shoreDistance) * (1. - smoothstep(-7., -.8, shoreDistance));
        point.y += ripples * (.038 * sin(point.z * 1.17 + point.x * .37 - clock * .98)
          + .028 * sin(point.z * .59 - point.x * .84 - clock * .78));
        world = point;
        d = shoreDistance;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(point, 1.);
      }
    `,
    fragmentShader: String.raw`
      uniform float clock, sunVisible, moonVisible;
      uniform vec3 sun, moon, sunColor, moonColor, horizon, middle, zenith, water;
      varying vec3 world;
      varying float d;
      ${shaderNoise}
      ${shorelineGLSL}
      float lobe(float x) { return exp(-x * x); }
      void main() {
        vec2 p = world.xz;
        float reach = d > -3. ? shLine(p.x, clock) : 1.;
        float depth = reach - d;
        if (depth < -.18) discard;

        vec3 eye = normalize(cameraPosition - world);
        float range = length(cameraPosition - world);
        float detail = 1. - smoothstep(75., 235., range);
        float footprint = max(length(dFdx(p)), length(dFdy(p)));
        float anti = (1. - smoothstep(.38, 2.4, footprint)) * detail;
        float a = 0., b = 0., c = 0.;
        if (anti > .001) {
          float skew = n2(p * .16 + vec2(-clock * .03, clock * .022));
          float shear = n2(p * vec2(.31, .17) + vec2(clock * .024, 2.2));
          a = sin(p.x * .38 + p.y * .85 - clock * .98 + skew * 6.);
          b = sin(p.x * 1.12 - p.y * .51 + clock * .83 + shear * 5.);
          c = sin(p.y * 2.43 + p.x * .32 - clock * 1.37 + skew * 9.)
            * (1. - smoothstep(.28, .92, footprint));
        }
        float broad = (1. - smoothstep(4., 31., footprint)) * (1. - smoothstep(265., 615., range));
        float swellSurface = 0.;
        if (broad > .001) {
          float drift = n2(p * vec2(.025, .021) + clock * .007);
          swellSurface = sin(p.y * .27 + p.x * .06 - clock * .43 + drift * 5.7) * broad;
        }
        // Match the specular normal to the deformed offshore surface.
        float ocean = (1. - smoothstep(-28., -7., d)) * smoothstep(-120., -42., d);
        float phaseA = p.y * .205 + p.x * .047 - clock * .43;
        float phaseB = p.y * .145 - p.x * .069 - clock * .32 + .21 * sin(phaseA);
        float slopeX = .32 * .047 * cos(phaseA) +
          .17 * (-.069 + .21 * .047 * cos(phaseA)) * cos(phaseB);
        float slopeZ = .32 * .205 * cos(phaseA) +
          .17 * (.145 + .21 * .205 * cos(phaseA)) * cos(phaseB);
        vec3 normal = normalize(vec3((a * .065 + b * .047) * anti - ocean * slopeX,
          1., (b * .045 + c * .019) * anti + swellSurface * .020 - ocean * slopeZ));
        vec3 reflected = reflect(-eye, normal);
        float fresnel = pow(1. - max(0., dot(normal, eye)), 4.);
        float elevation = max(0., reflected.y);
        vec3 reflectedSky = mix(horizon, middle, smoothstep(0., .29, elevation));
        reflectedSky = mix(reflectedSky, zenith, smoothstep(.21, .76, elevation));
        float glitter = .56 + .27 * (a * b * .65 + c * .35);
        vec3 glints = vec3(0.);
        if (sunVisible > 0.) {
          float reflection = max(0., dot(reflected, sun));
          glints += sunColor * sunVisible * (pow(reflection, 31.) * .16 + pow(reflection, 270.) * glitter * 1.25);
        }
        if (moonVisible > 0.) {
          float reflection = max(0., dot(reflected, moon));
          glints += moonColor * moonVisible * (pow(reflection, 32.) * .08 + pow(reflection, 175.) * glitter * .68);
        }
        vec3 color = mix(water * (.68 + anti * (a * .041 + b * .029) + swellSurface * .039), reflectedSky, .10 + fresnel * .25);
        color += glints * (.44 + fresnel * .56);

        float foam = 0.;
        if (d > -51. && range < 175.) {
          // Each moving front has a shaded face, a luminous shoulder and small
          // intermittent caps. Its phase is also used by the run-up and audio.
          float face = 0., lip = 0.;
          float gaps = n2(vec2(p.x * .32 + .03 * clock, d * .42));
          float bubbles = n2(vec2(p.x * 2.9, d * 2.1 - clock * .67));
          float groups = smoothstep(.37, .72, gaps * .75 + bubbles * .25);
          for (int i = 0; i < 4; i++) {
            float k = float(i);
            float progress = shProgress(p.x, clock, i);
            float lift = smoothstep(.05, .21, progress) * (1. - smoothstep(.77, .96, progress));
            float front = -49. * pow(max(0., 1. - progress / .94), 1.7) - .45;
            front += sin(p.x * .155 + clock * .081 + k * 2.1) * .62
              + sin(p.x * .37 - clock * .054 + k * .89) * .28;
            float across = d - front;
            float width = mix(1.7, .61, progress);
            face += lobe((across - .44) / width) * lift * (.42 + .58 * gaps);
            lip += lobe((across + .65) / (width * .66)) * lift;
            float breaking = smoothstep(.47, .73, progress) * (1. - smoothstep(.78, .96, progress));
            foam = max(foam, lobe((across - .22 - bubbles * .45) / .77) * breaking * groups * .65);
          }
          color *= 1. - .30 * min(1., face) * detail;
          color += mix(middle, horizon, .4) * lip * .17 * detail;
          if (d > -3.) {
            float prior = shLine(p.x, clock - .72);
            float advance = clamp((reach - prior) * 1.7, 0., 1.);
            float retreat = clamp((prior - reach) * 1.1, 0., 1.);
            float grain = n2(vec2(p.x * 1.39, d * 3.1 + clock * .33));
            float swash = lobe((depth - .35 - grain * .37) * 2.6);
            foam = max(foam, swash * groups * (.16 + .46 * advance));
            float rake = smoothstep(.49, .74, grain * .67 + gaps * .33);
            float streak = lobe((depth - 1.35 - gaps * 1.3) * 1.45);
            foam = max(foam, rake * streak * (.12 + .38 * retreat));
          }
        }
        float veil = smoothstep(78., 1120., range);
        color = mix(color, horizon * .89, veil);
        vec3 foamTint = mix(middle, vec3(.84, .88, .90), .59 - .39 * moonVisible);
        color = mix(color, foamTint, foam * detail);
        float opacity = smoothstep(-.18, 1.55, depth);
        if (d < -3.) opacity = 1.;
        gl_FragColor = vec4(color, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  water.renderOrder = 1;
  scene.add(water);
}

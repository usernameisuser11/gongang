import * as T from 'three';
import { rng, shaderNoise } from './nature.js';

function loadCloud(layer, ready) {
  const file = `quiet-shore-cloud-${layer}.png`;
  const source = globalThis.BARAMUI_ASSETS?.[file] ?? `./assets/${file}`;
  const texture = new T.TextureLoader().load(source, () => { ready.value = 1; });
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = T.MirroredRepeatWrapping;
  return texture;
}

export function makeBeachSky(scene, time, phase, light) {
  const firstReady = { value: 0 }, secondReady = { value: 0 };
  const uniforms = {
    ...light.uniforms, clock: time, firstReady, secondReady,
    cloudA: { value: loadCloud(1, firstReady) },
    cloudB: { value: loadCloud(2, secondReady) },
  };
  const sky = new T.Mesh(new T.SphereGeometry(760, 40, 24), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false,
    uniforms,
    vertexShader: String.raw`
      varying vec3 world;
      void main() {
        world = (modelMatrix * vec4(position, 1.)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: String.raw`
      varying vec3 world;
      uniform float clock, sunVisible, moonVisible, firstReady, secondReady;
      uniform vec3 sun, moon, sunColor, moonColor, horizon, middle, zenith, cloud;
      uniform sampler2D cloudA, cloudB;
      ${shaderNoise}
      void main() {
        vec3 ray = normalize(world - cameraPosition);
        float elevation = max(0., ray.y);
        float sunDot = max(0., dot(ray, sun));
        // Wide, layered atmospheric gradient: the horizon is warmer and
        // softer while the upper sky keeps its cool blue depth.
        // Rayleigh-like falloff: a true cool zenith above the golden haze.
        vec3 color = mix(zenith, middle, exp(-elevation * 8.2));
        color = mix(color, horizon, exp(-elevation * 27.) * .95);
        float solarAzimuth = max(0., dot(normalize(ray.xz), normalize(sun.xz)));
        float wideGlow = pow(solarAzimuth, 7.) * exp(-elevation * 8.5) * sunVisible;
        color += sunColor * (.065 * wideGlow + .025 * exp(-elevation * 18.) * sunVisible);
        float sunGlow = 0.;
        if (sunVisible > 0.) {
          sunGlow = pow(sunDot, 14.) * sunVisible;
          color += sunColor * (sunGlow * .24 + pow(sunDot, 170.) * sunVisible * .54);
        }

        float azimuth = atan(ray.x, -ray.z) * .63662 + .47;
        // Two cloud sheets drift at different speeds and altitudes, with
        // subtle shearing so their edges do not read as a flat panorama.
        vec2 cloudUV = vec2(azimuth + clock * .00023
          + .012 * sin(elevation * 12. + clock * .00018), elevation * 1.65);
        vec4 highDeck = texture2D(cloudA, cloudUV);
        vec4 lowDeck = texture2D(cloudB, vec2(azimuth * 1.47
          + clock * .00029 + .27, elevation * 2.1));
        float cloudWindow = smoothstep(.003, .055, elevation)
          * (1. - smoothstep(.49, .67, elevation));
        float textureLight = dot(highDeck.rgb * .72 + lowDeck.rgb * .28, vec3(.28, .57, .15));
        // Thin, broken lower cloudbank merges with the distant sea haze.
        float bank = n2(vec2(azimuth * 8.6 + clock * .00011, elevation * 19.4 + 7.2));
        float lowBank = smoothstep(.56, .75, bank)
          * smoothstep(.008, .033, elevation)
          * (1. - smoothstep(.09, .18, elevation)) * .28;
        // Broken billowing cloud masses make the sky legible even where the
        // original high-altitude photo sheets have very faint transparency.
        vec2 cloudFieldUV = vec2(azimuth * 6.7 + clock * .00015,
          elevation * 7.6 + 1.9);
        float cloudBaseNoise = n2(cloudFieldUV);
        float cloudDetailNoise = n2(cloudFieldUV * 2.33 + vec2(8.6, -3.1));
        float cloudField = cloudBaseNoise * .69 + cloudDetailNoise * .31;
        float billows = smoothstep(.47, .64, cloudField)
          * smoothstep(.018, .09, elevation)
          * (1. - smoothstep(.43, .69, elevation));
        float proceduralCover = billows * .57;
        float cloudCover = clamp(max(proceduralCover * .8,
          cloudWindow * (firstReady * highDeck.a * .70
          + secondReady * lowDeck.a * .42)) + lowBank, 0., .72);
        float sunsetTint = pow(solarAzimuth, 8.) * sunVisible;
        vec3 shadowCloud = mix(middle, cloud, .43) * (.65 + textureLight * .3);
        // Only clouds near the sun's azimuth receive a warm golden rim.
        vec3 sunlitCloud = mix(shadowCloud, sunColor * .75 + middle * .25,
          .27 * sunsetTint);
        vec3 cloudLight = mix(shadowCloud, sunlitCloud, sunVisible);
        color = mix(color, cloudLight, cloudCover);
        // Low-altitude haze smooths the hard divide between water and sky.
        color = mix(color, horizon, exp(-elevation * 34.) * .17);

        float sunDisc = smoothstep(.99979, .99988, sunDot);
        color += sunColor * sunDisc * sunVisible * (2.3 - cloudCover);
        if (moonVisible > 0.) {
          float moonDot = max(0., dot(ray, moon));
          float moonDisc = smoothstep(.99993, .999973, moonDot);
          float glow = pow(moonDot, 164.) * .105 + pow(moonDot, 30.) * .018;
          color += moonColor * (moonDisc * .98 + glow) * moonVisible * (1. - cloudCover * .48);
        }
        color += (h2(gl_FragCoord.xy) - .5) * .0014;
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  sky.frustumCulled = false;
  // Fill the background after opaque geometry so the depth test rejects sand and props.
  sky.renderOrder = 100;
  scene.add(sky);

  const random = rng(98012);
  const position = [], brightness = [];
  for (let i = 0; i < 1250; i++) {
    const y = .07 + random() * .93, theta = random() * Math.PI * 2;
    const radius = Math.sqrt(1 - y * y) * 720;
    position.push(Math.sin(theta) * radius, y * 720, Math.cos(theta) * radius);
    brightness.push(.27 + random() ** 2 * .73);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(position, 3));
  geometry.setAttribute('brightness', new T.Float32BufferAttribute(brightness, 1));
  const stars = new T.Points(geometry, new T.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      starsVisible: light.uniforms.starsVisible,
      cloudA: uniforms.cloudA, cloudB: uniforms.cloudB, firstReady, secondReady, clock: time,
    },
    vertexShader: String.raw`
      attribute float brightness;
      varying float starPower;
      varying vec3 rayDirection;
      uniform float starsVisible;
      void main() {
        starPower = brightness * starsVisible;
        rayDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        gl_PointSize = 1.25 + 1.7 * brightness;
      }
    `,
    fragmentShader: String.raw`
      varying float starPower;
      varying vec3 rayDirection;
      uniform float firstReady, secondReady, clock;
      uniform sampler2D cloudA, cloudB;
      void main() {
        vec2 point = gl_PointCoord - .5;
        float light = exp(-dot(point, point) * 19.);
        float elevation = rayDirection.y;
        float azimuth = atan(rayDirection.x, -rayDirection.z) * .63662 + .47;
        float cloudCover = firstReady * texture2D(cloudA, vec2(azimuth + clock * .00023, elevation * 1.65)).a
          + secondReady * texture2D(cloudB, vec2(azimuth * 1.5 + clock * .00034 + .27, elevation * 2.24)).a * .5;
        float cloudWindow = smoothstep(.005, .075, elevation) * (1. - smoothstep(.48, .61, elevation));
        float alpha = light * starPower * (1. - cloudCover * cloudWindow * .9) * .92;
        if (alpha < .02) discard;
        gl_FragColor = vec4(.70, .80, 1., alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  }));
  stars.renderOrder = -95;
  stars.frustumCulled = false;
  scene.add(stars);
  return { update() { stars.visible = phase.value > .66; } };
}

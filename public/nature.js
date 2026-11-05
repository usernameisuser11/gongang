export const lerp = (a,b,t) => a + (b-a)*t;
export function smooth(a,b,x) {
  const t = Math.max(0,Math.min(1,(x-a)/(b-a)));
  return t*t*(3-2*t);
}
export function rng(seed) {
  return () => {
    seed = (Math.imul(1664525,seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function hash(x,z) {
  const h = Math.imul(x ^ 0x69c8a26d,0x85ebca6b) ^ Math.imul(z,0xc2b2ae35);
  return ((h ^ h >>> 15) >>> 0) / 4294967296;
}
export function noise(x,z) {
  const i=Math.floor(x), j=Math.floor(z), u=smooth(0,1,x-i), v=smooth(0,1,z-j);
  return lerp(lerp(hash(i,j),hash(i+1,j),u),lerp(hash(i,j+1),hash(i+1,j+1),u),v);
}
export function fbm(x,z) {
  return .56*noise(x,z) + .27*noise(z*2.1+23,-x*2.1) + .12*noise(x*4.4-3,z*4.4+17) + .05*noise(z*8.9,x*8.9);
}
export const shaderNoise = `
  float h2(vec2 p) {
    vec3 p3=fract(vec3(p.xyx)*.1031);
    p3+=dot(p3,p3.yzx+33.33);
    return fract((p3.x+p3.y)*p3.z);
  }
  float n2(vec2 p) {
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);
  }
  float fb2(vec2 p) {
    mat2 turn=mat2(1.63,1.21,-1.21,1.63);
    float v=.53*n2(p);
    p=turn*p+15.3; v+=.27*n2(p);
    p=turn*p+15.3; v+=.14*n2(p);
    return v+.06*n2(turn*p+15.3);
  }
`;

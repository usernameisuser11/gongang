// Shared Quiet Shore v11-inspired swell clock for 3D water and damp sand.
// The four interacting wave sets remain independent of the sunset timeline.
const fract = n => n - Math.floor(n);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const smooth = (a,b,v) => { const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t); };
export const coast = x => -17.8+1.35*Math.sin(x*.086+.4)+.68*Math.sin(x*.23-1.8)+.22*Math.sin(x*.53);
export function swashAt(x,t) {
  let runUp=0;
  for(let i=0;i<4;i++){
    const speed=.039+.006*fract(Math.sin(i*127.1+58.2)*43758.5453123);
    const phase=fract(t*speed+i*.263+.019*Math.sin(t*.044+i*1.31)
      +.011*Math.sin(x*.083+i*2.3+t*.017)
      +.005*Math.sin(x*.22-i*.79-t*.025));
    const arrival=smooth(.67,.83,phase)*(1-smooth(.87,.993,phase));
    runUp=Math.max(runUp,arrival*(.75+.24*fract(Math.sin(i*21.6+8.3)*12345.678)));
  }
  return clamp(.13+.79*runUp+.045*Math.sin(t*.040+x*.02),.07,.96);
}
export const runupAt = (x,t) => .3+5.4*swashAt(x,t);
export function wetReachAt(x,t){
  let reach=runupAt(x,t);
  for(let i=1;i<=18;i++){
    const history=runupAt(x,t-i*1.15)*(1-i*.018);
    reach=Math.max(reach,history);
  }
  return reach;
}
// shaderNoise must be included in the enclosing fragment shader before this block.
export const shorelineGLSL = String.raw\`
  float shCoast(float x) {
    return -17.8+1.35*sin(x*.086+.4)+.68*sin(x*.23-1.8)+.22*sin(x*.53);
  }
  float shSwash(vec2 p,float t) {
    float runUp=0.;
    for(int j=0;j<4;j++){
      float i=float(j);
      float speed=.039+.006*fract(sin(i*127.1+58.2)*43758.5453123);
      float phase=fract(t*speed+i*.263+.019*sin(t*.044+i*1.31)
        +.011*sin(p.x*.083+i*2.3+t*.017)
        +.005*sin(p.x*.22-i*.79-t*.025));
      float arrival=smoothstep(.67,.83,phase)*(1.-smoothstep(.87,.993,phase));
      float amp=.75+.24*fract(sin(i*21.6+8.3)*12345.678);
      runUp=max(runUp,arrival*amp);
    }
    return clamp(.13+.79*runUp+.045*sin(t*.040+p.x*.02),.07,.96);
  }
  float shLine(vec2 p,float t) {
    return .3+5.4*shSwash(p,t);
  }
\`;

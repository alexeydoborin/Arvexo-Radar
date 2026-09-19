// GPU particle field (WebGL2). One point system drives both effects:
//   mode "main"  - a noisy ring of oriented dashes follows the cursor over a fine dot field
//   mode "morph" - dots idle as a dot field and gather into a shape while hovered
// State lives in a float texture that is ping-ponged by a simulation pass.

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const FULLSCREEN_VS = `#version 300 es
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`;

const MAIN_SIM_FS = `#version 300 es
precision highp float;
uniform sampler2D uPosition;
uniform sampler2D uPosRefs;
uniform vec2 uRingPos;
uniform float uTime;
uniform float uRingRadius;
uniform float uRingWidth;
uniform float uRingWidth2;
uniform float uRingDisplacement;
out vec4 outColor;
${NOISE}
void main(){
  ivec2 tc = ivec2(gl_FragCoord.xy);
  vec4 pFrame = texelFetch(uPosition, tc, 0);
  float scale = pFrame.z;
  float velocity = pFrame.w;
  vec2 refPos = texelFetch(uPosRefs, tc, 0).xy;

  float time = uTime * .5;
  vec2 curentPos = refPos;
  vec2 pos = pFrame.xy;
  pos *= .8;

  float dist = distance(curentPos, uRingPos);
  float noise0 = snoise(vec3(curentPos * .2 + vec2(18.4924, 72.9744), time * .5));
  float dist1 = distance(curentPos + (noise0 * .005), uRingPos);

  float t  = smoothstep(uRingRadius - (uRingWidth * 2.), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth, dist1);
  float t2 = smoothstep(uRingRadius - (uRingWidth2 * 2.), uRingRadius, dist) - smoothstep(uRingRadius, uRingRadius + uRingWidth2, dist1);
  float t3 = smoothstep(uRingRadius + uRingWidth2, uRingRadius, dist);

  t = pow(max(t, 0.), 2.);
  t2 = pow(max(t2, 0.), 3.);

  t += t2 * 3.;
  t += t3 * .4;
  t += snoise(vec3(curentPos * 30. + vec2(11.4924, 12.9744), time * .5)) * t3 * .5;

  float nS = snoise(vec3(curentPos * 2. + vec2(18.4924, 72.9744), time * .5));
  t += pow((nS + 1.5) * .5, 2.) * .6;

  float noise1 = snoise(vec3(curentPos * 4. + vec2(88.494, 32.4397), time * .35));
  float noise2 = snoise(vec3(curentPos * 4. + vec2(50.904, 120.947), time * .35));
  float noise3 = snoise(vec3(curentPos * 20. + vec2(18.4924, 72.9744), time * .5));
  float noise4 = snoise(vec3(curentPos * 20. + vec2(50.904, 120.947), time * .5));

  vec2 disp = vec2(noise1, noise2) * .03;
  disp += vec2(noise3, noise4) * .005;
  disp.x += sin((refPos.x * 20.) + (time * 4.)) * .02 * clamp(dist, 0., 1.);
  disp.y += cos((refPos.y * 20.) + (time * 3.)) * .02 * clamp(dist, 0., 1.);

  pos -= (uRingPos - (curentPos + disp)) * pow(t2, .75) * uRingDisplacement;

  scale += (t - scale) * .2;

  vec2 finalPos = curentPos + disp + (pos * .25);
  velocity *= .5;
  velocity += scale * .25;

  outColor = vec4(finalPos, scale, velocity);
}`;

const MORPH_SIM_FS = `#version 300 es
precision highp float;
uniform sampler2D uPosition;
uniform sampler2D uPosRefs;
uniform sampler2D uPosNearest;
uniform float uTime;
uniform float uIsHovering;
uniform float uSize;
out vec4 outColor;

vec2 hash(vec2 p){
  p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
  return fract(sin(p) * 43758.5453);
}

void main(){
  ivec2 tc = ivec2(gl_FragCoord.xy);
  vec2 simTexCoords = gl_FragCoord.xy / uSize;
  vec4 pFrame = texelFetch(uPosition, tc, 0);
  float scale = pFrame.z;
  float velocity = pFrame.w;
  vec2 refPos = texelFetch(uPosRefs, tc, 0).xy;
  vec2 nearestPos = texelFetch(uPosNearest, tc, 0).xy;
  float seed = hash(simTexCoords).x;
  float seed2 = hash(simTexCoords).y;

  float time = uTime * .5;
  float lifeEnd = 3. + sin(seed2 * 100.) * 1.;
  float lifeTime = mod((seed * 100.) + time, lifeEnd);

  vec2 pos = pFrame.xy;
  float distRadius = .15;

  vec2 targetPos = mix(refPos, nearestPos, uIsHovering * uIsHovering);
  vec2 direction = normalize(targetPos - pos) * .01;
  float dist = length(targetPos - pos);
  float distStrength = smoothstep(distRadius, 0., dist);
  if(dist > .005){
    pos += direction * distStrength;
  }

  if(lifeTime < .01){
    pos = refPos;
    pFrame.xy = refPos;
    scale = 0.;
  }

  float targetScale = smoothstep(.01, .5, lifeTime) - smoothstep(.5, 1., lifeTime / lifeEnd);
  targetScale += smoothstep(.1, 0., smoothstep(.001, .1, dist)) * 1.5 * uIsHovering;
  scale += (targetScale - scale) * .1;

  vec2 diff = (pos - pFrame.xy) * .2;
  velocity = smoothstep(distRadius, .001, dist) * uIsHovering;

  outColor = vec4(pFrame.xy + diff, scale, velocity);
}`;

const RENDER_VS = `#version 300 es
precision highp float;
uniform sampler2D uPosition;
uniform int uSize;
uniform float uTime;
uniform float uParticleScale;
uniform float uPixelRatio;
uniform float uAspect;
uniform float uHalfH;
uniform float uFlipY;
uniform float uMinScale;
uniform float uMorph;
uniform float uIsHovering;
uniform float uPulseProgress;
out vec2 vLocalPos;
out float vScale;
out float vVelocity;
${NOISE}
void main(){
  ivec2 tc = ivec2(gl_VertexID % uSize, gl_VertexID / uSize);
  vec4 pos = texelFetch(uPosition, tc, 0);

  if(uMorph > .5){
    float noiseX = snoise(vec3(pos.xy * 10., uTime * .2 + 100.));
    float noiseY = snoise(vec3(pos.xy * 10., uTime * .2));
    float noiseX2 = snoise(vec3(pos.xy * .5, uTime * .15 + 45.));
    float noiseY2 = snoise(vec3(pos.xy * .5, uTime * .15 + 87.));

    float cDist = length(pos.xy);
    float progress = uPulseProgress;
    float t = smoothstep(progress - .25, progress, cDist) - smoothstep(progress, progress + .25, cDist);
    t *= smoothstep(1., 0., cDist);
    pos.xy *= 1. + (t * .02);

    float dist = mix(0., smoothstep(0., .9, pos.w), uIsHovering);
    pos.y += noiseY * .005 * dist;
    pos.x += noiseX * .005 * dist;
    pos.y += noiseY2 * .02;
    pos.x += noiseX2 * .02;
  }

  vVelocity = pos.w;
  vScale = pos.z;
  vLocalPos = pos.xy;

  vec2 world = pos.xy * 5.;
  gl_Position = vec4(world.x / (uHalfH * uAspect), world.y * uFlipY / uHalfH, 0., 1.);
  gl_PointSize = ((vScale * 7.) * (uPixelRatio * .5) * uParticleScale) + (uMinScale * uPixelRatio);
}`;

const RENDER_COMMON = `#version 300 es
precision highp float;
in vec2 vLocalPos;
in float vScale;
in float vVelocity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uRingPos;
uniform float uTime;
uniform float uScheme;
out vec4 outColor;
${NOISE}
float sdRoundBox(in vec2 p, in vec2 b, in vec4 r){
  r.xy = (p.x > 0.) ? r.xy : r.zw;
  r.x = (p.y > 0.) ? r.x : r.y;
  vec2 q = abs(p) - b + r.x;
  return min(max(q.x, q.y), 0.) + length(max(q, 0.)) - r.x;
}
vec2 rotate(vec2 v, float a){
  float s = sin(a);
  float c = cos(a);
  return mat2(c, s, -s, c) * v;
}
vec3 oetf(vec3 c){
  return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(vec3(.0031308), c));
}`;

const MAIN_FS = `${RENDER_COMMON}
void main(){
  float noiseAngle = snoise(vec3(vLocalPos * 10. + vec2(18.4924, 72.9744), uTime * .85));
  float noiseColor = (snoise(vec3(vLocalPos * 2. + vec2(74.664, 91.556), uTime * .5)) + 1.) * .5;
  float angle = atan(vLocalPos.y - uRingPos.y, vLocalPos.x - uRingPos.x);

  vec2 uv = gl_PointCoord.xy - vec2(.5);
  uv.y *= -1.;
  uv = rotate(uv, -angle + (noiseAngle * .5));

  float h = .8;
  float progress = smoothstep(0., .75, pow(noiseColor, 2.));
  vec3 col = mix(mix(uColor1, uColor2, progress / h), mix(uColor2, uColor3, (progress - h) / (1. - h)), step(h, progress));

  float rounded = sdRoundBox(uv, vec2(.5, .2), vec4(.25));
  rounded = smoothstep(.1, 0., rounded);
  float a = rounded * smoothstep(.1, .2, vScale);
  if(a < .01) discard;

  col = mix(clamp(col, 0., 1.), clamp(col, 0., 1.) * clamp(vVelocity, 0., 1.), uScheme);
  outColor = vec4(oetf(col), clamp(a, 0., 1.));
}`;

const MORPH_FS = `${RENDER_COMMON}
void main(){
  vec2 uv = gl_PointCoord.xy - vec2(.5);
  uv.y *= -1.;

  float h = .8;
  float progress = vVelocity;
  vec3 col = mix(mix(uColor1, uColor2, progress / h), mix(uColor2, uColor3, (progress - h) / (1. - h)), step(h, progress));

  float disc = smoothstep(.5, .45, length(uv));
  float a = disc * smoothstep(.1, .2, vScale);
  if(a < .01) discard;

  col = mix(clamp(col, 0., 1.), clamp(col, 0., 1.) * clamp(vVelocity, 0., 1.), uScheme);
  outColor = vec4(oetf(col), clamp(a, 0., 1.));
}`;

type Vec = number[];
type Point = [number, number];

const srgbToLinear = (hex: string): Vec => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
};

const remap = (x: number, a: number, b: number, c: number, d: number) => ((x - a) * (d - c)) / (b - a) + c;
const easePower3 = (t: number) => 1 - (1 - t) ** 3;
const easePower2 = (t: number) => 1 - (1 - t) ** 2;

// Bridson poisson-disc sampling; distance to the next sample is random in [min, max].
function poissonDisc(size: number, minDist: number, maxDist: number, tries = 20): Point[] {
  const cell = minDist / Math.SQRT2;
  const cols = Math.ceil(size / cell);
  const grid = new Int32Array(cols * cols).fill(-1);
  const points: Point[] = [];
  const active: number[] = [];
  const insert = (x: number, y: number) => {
    points.push([x, y]);
    active.push(points.length - 1);
    grid[Math.floor(y / cell) * cols + Math.floor(x / cell)] = points.length - 1;
  };
  const free = (x: number, y: number) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let j = Math.max(0, cy - 2); j <= Math.min(cols - 1, cy + 2); j += 1) {
      for (let i = Math.max(0, cx - 2); i <= Math.min(cols - 1, cx + 2); i += 1) {
        const k = grid[j * cols + i];
        if (k < 0) continue;
        const dx = points[k][0] - x;
        const dy = points[k][1] - y;
        if (dx * dx + dy * dy < minDist * minDist) return false;
      }
    }
    return true;
  };
  insert(Math.random() * size, Math.random() * size);
  while (active.length) {
    const pick = Math.floor(Math.random() * active.length);
    const [px, py] = points[active[pick]];
    let placed = false;
    for (let n = 0; n < tries; n += 1) {
      const angle = Math.random() * Math.PI * 2;
      const d = minDist + Math.random() * (maxDist - minDist);
      const x = px + Math.cos(angle) * d;
      const y = py + Math.sin(angle) * d;
      if (x >= 0 && y >= 0 && x < size && y < size && free(x, y)) {
        insert(x, y);
        placed = true;
        break;
      }
    }
    if (!placed) active.splice(pick, 1);
  }
  return points;
}

// 500x500 mask of the target shape (dark = shape), image space with y down.
function drawShapeMask(shape: string): Point[] {
  const canvas = document.createElement("canvas");
  canvas.width = 500;
  canvas.height = 500;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 500, 500);
  ctx.scale(500 / 1024, 500 / 1024);
  ctx.strokeStyle = "#000";
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.lineWidth = 40;
  if (shape === "flower") {
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(512 + Math.cos(a) * 214, 511 + Math.sin(a) * 214, 58, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const brace = (mirror: boolean) => {
      const x = (v: number) => (mirror ? 1024 - v : v);
      ctx.beginPath();
      ctx.moveTo(x(431), 312);
      ctx.lineTo(x(372), 312);
      ctx.quadraticCurveTo(x(312), 312, x(312), 372);
      ctx.lineTo(x(312), 430);
      ctx.quadraticCurveTo(x(312), 500, x(257), 511);
      ctx.lineTo(x(237), 511);
      ctx.moveTo(x(257), 511);
      ctx.quadraticCurveTo(x(312), 522, x(312), 592);
      ctx.lineTo(x(312), 650);
      ctx.quadraticCurveTo(x(312), 710, x(372), 710);
      ctx.lineTo(x(431), 710);
      ctx.stroke();
    };
    brace(false);
    brace(true);
  }
  const data = ctx.getImageData(0, 0, 500, 500).data;
  const dark: Point[] = [];
  for (let y = 0; y < 500; y += 1) {
    for (let x = 0; x < 500; x += 1) {
      if (data[(y * 500 + x) * 4] < 200) dark.push([x, y]);
    }
  }
  return dark;
}

function nearestShapePoints(base: Point[], dark: Point[]): Point[] {
  const pool: Point[] = [];
  for (let i = 0; i < 6000 && dark.length; i += 1) pool.push(dark[Math.floor(Math.random() * dark.length)]);
  return base.map(([bx, by]) => {
    let best = pool[0];
    let bestD = Infinity;
    for (let j = 0; j < pool.length; j += 1) {
      if (Math.random() < 0.75) continue;
      const dx = pool[j][0] - bx;
      const dy = pool[j][1] - by;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = pool[j];
      }
    }
    return best;
  });
}

// Smooth 1D noise in [0, 1].
const lattice = (i: number) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const noise1 = (x: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lattice(i) * (1 - u) + lattice(i + 1) * u;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

type Program = { p: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

function program(gl: WebGL2RenderingContext, vs: string, fs: string): Program {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
  const uniforms: Program["u"] = {};
  const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i += 1) {
    const name = gl.getActiveUniform(p, i)!.name;
    uniforms[name] = gl.getUniformLocation(p, name);
  }
  return { p, u: uniforms };
}

function dataTexture(gl: WebGL2RenderingContext, size: number, data: Float32Array): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, size, 0, gl.RGBA, gl.FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer };

function stateTarget(gl: WebGL2RenderingContext, size: number, data: Float32Array): Target {
  const tex = dataTexture(gl, size, data);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo };
}

export type ParticleMode = "main" | "morph";
export type ParticleOptions = {
  mode?: ParticleMode;
  shape?: "braces" | "flower";
  theme?: "light" | "dark";
  reducedMotion?: boolean;
};
export type ParticleField = { setHovered(hovered: boolean): void; destroy(): void };

export function createParticleField(container: HTMLElement, options: ParticleOptions): ParticleField | null {
  const { mode = "main", shape = "braces", theme = "light", reducedMotion = false } = options;
  const dark = theme === "dark";
  const main = mode === "main";
  const density = main ? (dark ? 220 : 230) : 50;
  const particlesScale = main ? (dark ? 0.65 : 0.59) : 0.6;
  const cameraZoom = main ? 3.1 : 8.8;
  const colors = main ? (dark ? ["#7189ff", "#3074f9", "#000000"] : ["#2c64ed", "#f84242", "#ffcf03"]) : (dark ? ["#318bf7", "#bada4c", "#e35058"] : ["#676A72", "#FF4641", "#346BF1"]);
  const ringWidth = dark ? 0.15 : 0.006;
  const ringWidth2 = dark ? 0.05 : 0.107;
  const ringDisplacement = dark ? 0.23 : 0.62;
  const morph = mode === "morph";

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%";
  container.appendChild(canvas);
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
    canvas.remove();
    return null;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  let cssW = 1;
  let cssH = 1;
  const resize = () => {
    cssW = Math.max(1, container.offsetWidth);
    cssH = Math.max(1, container.offsetHeight);
    canvas.width = Math.round(cssW * pixelRatio);
    canvas.height = Math.round(cssH * pixelRatio);
  };
  resize();

  // Point set
  const minDist = remap(density, 0, 300, 10, 2);
  const maxDist = remap(density, 0, 300, 11, 3);
  const base = poissonDisc(500, minDist, maxDist);
  const count = base.length;
  const size = Math.max(16, 2 ** Math.ceil(Math.log2(Math.sqrt(count))));

  const packPositions = (points: Point[]) => {
    const data = new Float32Array(size * size * 4);
    for (let i = 0; i < count; i += 1) {
      data[i * 4] = (points[i][0] - 250) / 250;
      data[i * 4 + 1] = (points[i][1] - 250) / 250;
    }
    return data;
  };

  const refData = packPositions(base);
  const refTex = dataTexture(gl, size, refData);
  let nearestTex = refTex;
  if (morph) nearestTex = dataTexture(gl, size, packPositions(nearestShapePoints(base, drawShapeMask(shape))));

  let read = stateTarget(gl, size, refData);
  let write = stateTarget(gl, size, refData);

  const simProgram = program(gl, FULLSCREEN_VS, morph ? MORPH_SIM_FS : MAIN_SIM_FS);
  const renderProgram = program(gl, RENDER_VS, morph ? MORPH_FS : MAIN_FS);
  const vao = gl.createVertexArray();
  const linear = colors.map(srgbToLinear);

  type TweenKey = "hover" | "push";
  type Tween = { key: TweenKey; from: number; to: number; duration: number; ease: (t: number) => number; delay: number; start: number; started: boolean };
  const state: { hover: number; push: number; ring: number[]; mouse: number[] | null; tweens: Tween[] } = {
    hover: 0,
    push: 0,
    ring: [0, 0],
    mouse: null,
    tweens: [],
  };

  const tween = (key: TweenKey, to: number, duration: number, ease: (t: number) => number, delay = 0, from: number | null = null) => {
    state.tweens = state.tweens.filter((t) => t.key !== key);
    state.tweens.push({ key, from: from ?? state[key], to, duration: duration * 1000, ease, delay: delay * 1000, start: performance.now(), started: false });
  };
  const stepTweens = (now: number) => {
    state.tweens = state.tweens.filter((t) => {
      const elapsed = now - t.start - t.delay;
      if (elapsed < 0) return true;
      if (!t.started) {
        t.started = true;
        state[t.key] = t.from;
      }
      const p = Math.min(1, elapsed / t.duration);
      state[t.key] = t.from + (t.to - t.from) * t.ease(p);
      return p < 1;
    });
  };

  const onPointer = (event: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width;
    const y = (event.clientY - r.top) / r.height;
    state.mouse = x < 0 || x > 1 || y < 0 || y > 1 ? null : [x * 2 - 1, -(y * 2 - 1)];
  };
  const onLeave = () => { state.mouse = null; };
  if (!morph) {
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("pointerleave", onLeave);
  }

  const halfH = Math.tan((20 * Math.PI) / 180) * cameraZoom;
  const clockStart = performance.now();
  let lastNow = clockStart;
  let sceneTime = 0;
  let frameId = 0;
  let running = true;
  let visible = true;
  let frames = 0;

  const bindTex = (unit: number, tex: WebGLTexture) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  };

  const frame = (nowMs: number) => {
    frameId = requestAnimationFrame(frame);
    if (!running || !visible) return;
    if (reducedMotion && frames > 90) return;
    frames += 1;
    stepTweens(nowMs);
    const elapsed = (nowMs - clockStart) / 1000;
    const dt = Math.min(0.1, (nowMs - lastNow) / 1000);
    lastNow = nowMs;
    sceneTime += dt;

    if (!morph) {
      const wx = (noise1(sceneTime * 0.66 + 94.234) - 0.5) * 2;
      const wy = (noise1(sceneTime * 0.75 + 21.028) - 0.5) * 2;
      const aspect = canvas.width / canvas.height;
      let target;
      let ease;
      if (state.mouse) {
        target = [state.mouse[0] * halfH * aspect * 0.175 + wx * 0.1, state.mouse[1] * halfH * 0.175 + wy * 0.1];
        ease = 0.02;
      } else {
        target = [wx * 0.2, wy * 0.1];
        ease = 0.01;
      }
      state.ring[0] += (target[0] - state.ring[0]) * ease;
      state.ring[1] += (target[1] - state.ring[1]) * ease;
    }

    // simulation pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.viewport(0, 0, size, size);
    gl.disable(gl.BLEND);
    gl.useProgram(simProgram.p);
    gl.bindVertexArray(vao);
    bindTex(0, read.tex);
    bindTex(1, refTex);
    gl.uniform1i(simProgram.u.uPosition, 0);
    gl.uniform1i(simProgram.u.uPosRefs, 1);
    gl.uniform1f(simProgram.u.uTime, elapsed);
    if (morph) {
      bindTex(2, nearestTex);
      gl.uniform1i(simProgram.u.uPosNearest, 2);
      gl.uniform1f(simProgram.u.uIsHovering, state.hover);
      gl.uniform1f(simProgram.u.uSize, size);
    } else {
      gl.uniform2f(simProgram.u.uRingPos, state.ring[0], state.ring[1]);
      gl.uniform1f(simProgram.u.uRingRadius, 0.175 + Math.sin(sceneTime) * 0.03 + Math.cos(sceneTime * 3) * 0.02);
      gl.uniform1f(simProgram.u.uRingWidth, ringWidth);
      gl.uniform1f(simProgram.u.uRingWidth2, ringWidth2);
      gl.uniform1f(simProgram.u.uRingDisplacement, ringDisplacement);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // render pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(renderProgram.p);
    bindTex(0, write.tex);
    const u = renderProgram.u;
    gl.uniform1i(u.uPosition, 0);
    gl.uniform1i(u.uSize, size);
    gl.uniform1f(u.uTime, elapsed);
    gl.uniform1f(u.uParticleScale, (cssW / 2000) * particlesScale);
    gl.uniform1f(u.uPixelRatio, pixelRatio);
    gl.uniform1f(u.uAspect, canvas.width / canvas.height);
    gl.uniform1f(u.uHalfH, halfH);
    gl.uniform1f(u.uFlipY, morph ? -1 : 1);
    gl.uniform1f(u.uMinScale, morph ? (dark ? 0.25 : 1) : 0);
    gl.uniform1f(u.uScheme, dark ? 0 : 1);
    gl.uniform1f(u.uMorph, morph ? 1 : 0);
    gl.uniform1f(u.uIsHovering, state.hover);
    gl.uniform1f(u.uPulseProgress, state.push);
    gl.uniform2f(u.uRingPos, state.ring[0], state.ring[1]);
    gl.uniform3fv(u.uColor1, linear[0]);
    gl.uniform3fv(u.uColor2, linear[1]);
    gl.uniform3fv(u.uColor3, linear[2]);
    gl.drawArrays(gl.POINTS, 0, count);

    [read, write] = [write, read];
  };
  frameId = requestAnimationFrame(frame);

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
  io.observe(container);

  return {
    setHovered(hovered: boolean) {
      if (!morph) return;
      tween("hover", hovered ? 1 : 0, 0.5, easePower3);
      tween("push", 1, 2, easePower2, hovered ? 0.1 : 0, 0);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onLeave);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    },
  };
}

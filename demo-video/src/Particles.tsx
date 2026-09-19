import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

/**
 * CPU port of the landing page particle field (frontend/lib/particles.ts, mode "main", dark theme):
 * a fine poisson dot field plus a noisy ring of radial dashes that drifts around.
 * Everything is a pure function of the frame, so parallel Remotion workers render identical frames.
 */

// ---------- deterministic randomness ----------
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- 3D simplex noise (Gustavson) ----------
const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];
const PERM = (() => {
  const rnd = mulberry32(1337);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return Uint8Array.from({ length: 512 }, (_, i) => p[i & 255]);
})();

const snoise = (xin: number, yin: number, zin: number): number => {
  const F3 = 1 / 3;
  const G3 = 1 / 6;
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const z0 = zin - (k - t);
  let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
  else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
  else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
  const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
  const ii = i & 255, jj = j & 255, kk = k & 255;
  const corner = (x: number, y: number, z: number, gi: number) => {
    const a = 0.6 - x * x - y * y - z * z;
    if (a < 0) return 0;
    const g = GRAD3[gi % 12];
    return a * a * a * a * (g[0] * x + g[1] * y + g[2] * z);
  };
  return 32 * (
    corner(x0, y0, z0, PERM[ii + PERM[jj + PERM[kk]]]) +
    corner(x1, y1, z1, PERM[ii + i1 + PERM[jj + j1 + PERM[kk + k1]]]) +
    corner(x2, y2, z2, PERM[ii + i2 + PERM[jj + j2 + PERM[kk + k2]]]) +
    corner(x3, y3, z3, PERM[ii + 1 + PERM[jj + 1 + PERM[kk + 1]]])
  );
};

// ---------- poisson disc point set (fixed seed) ----------
type Point = [number, number];
const poissonDisc = (size: number, minDist: number, maxDist: number, rnd: () => number, tries = 20): Point[] => {
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
        const q = grid[j * cols + i];
        if (q < 0) continue;
        const dx = points[q][0] - x;
        const dy = points[q][1] - y;
        if (dx * dx + dy * dy < minDist * minDist) return false;
      }
    }
    return true;
  };
  insert(rnd() * size, rnd() * size);
  while (active.length) {
    const pick = Math.floor(rnd() * active.length);
    const [px, py] = points[active[pick]];
    let placed = false;
    for (let n = 0; n < tries; n += 1) {
      const a = rnd() * Math.PI * 2;
      const d = minDist + rnd() * (maxDist - minDist);
      const x = px + Math.cos(a) * d;
      const y = py + Math.sin(a) * d;
      if (x >= 0 && y >= 0 && x < size && y < size && free(x, y)) {
        insert(x, y);
        placed = true;
        break;
      }
    }
    if (!placed) active.splice(pick, 1);
  }
  return points;
};

let cachedPoints: Float32Array | null = null;
const getPoints = () => {
  if (cachedPoints) return cachedPoints;
  const all = poissonDisc(500, 2.5, 3.3, mulberry32(20260919));
  const kept: number[] = [];
  for (const [x, y] of all) {
    const rx = (x - 250) / 250;
    const ry = (y - 250) / 250;
    if (Math.abs(rx) < 0.55 && Math.abs(ry) < 0.62) kept.push(rx, ry);
  }
  cachedPoints = Float32Array.from(kept);
  return cachedPoints;
};

// ---------- helpers ----------
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
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

const toLinear = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
};
const toSrgb255 = (c: number) => Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
const C1 = toLinear("#7189ff");
const C2 = toLinear("#3074f9");
const C3 = toLinear("#000000");
const mix3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

// Landing "dark" ring parameters
const RING_W = 0.15;
const RING_W2 = 0.05;
const RING_DISP = 0.23;
const SCALE_L = 2400; // px per reference unit (ring radius .175 → ~420px)
const SCALE_V = 1900;

export const Particles: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pts = getPoints();
    const t = frame / 30;
    const time = t * 0.5;

    // wandering ring centre and pulsing radius (same drivers as the landing, damped to stay behind the copy)
    const ringX = (noise1(t * 0.66 + 94.234) - 0.5) * 2 * 0.2 * 0.6;
    const ringY = (noise1(t * 0.75 + 21.028) - 0.5) * 2 * 0.1 * 0.6;
    const R = 0.175 + Math.sin(t) * 0.03 + Math.cos(t * 3) * 0.02;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const SCALE = width > height ? SCALE_L : SCALE_V;
    const px0 = width / 2;
    const py0 = height / 2;
    const sizeK = 7 * 0.5 * 0.65 * 1.7 * (width > height ? 1 : 1.15);

    for (let n = 0; n < pts.length; n += 2) {
      const rx = pts[n];
      const ry = pts[n + 1];
      const dist = Math.hypot(rx - ringX, ry - ringY);

      const noise0 = snoise(rx * 0.2 + 18.4924, ry * 0.2 + 72.9744, time * 0.5);
      const dist1 = Math.hypot(rx + noise0 * 0.005 - ringX, ry + noise0 * 0.005 - ringY);

      let tt = smoothstep(R - RING_W * 2, R, dist) - smoothstep(R, R + RING_W, dist1);
      let t2 = smoothstep(R - RING_W2 * 2, R, dist) - smoothstep(R, R + RING_W2, dist1);
      const t3 = 1 - smoothstep(R, R + RING_W2, dist);
      tt = Math.max(tt, 0) ** 2;
      t2 = Math.max(t2, 0) ** 3;
      tt += t2 * 3;
      tt += t3 * 0.4;
      tt += snoise(rx * 30 + 11.4924, ry * 30 + 12.9744, time * 0.5) * t3 * 0.5;
      const nS = snoise(rx * 2 + 18.4924, ry * 2 + 72.9744, time * 0.5);
      tt += ((nS + 1.5) * 0.5) ** 2 * 0.6;

      const n1 = snoise(rx * 4 + 88.494, ry * 4 + 32.4397, time * 0.35);
      const n2 = snoise(rx * 4 + 50.904, ry * 4 + 120.947, time * 0.35);
      const n3 = snoise(rx * 20 + 18.4924, ry * 20 + 72.9744, time * 0.5);
      const n4 = snoise(rx * 20 + 50.904, ry * 20 + 120.947, time * 0.5);
      let dx = n1 * 0.03 + n3 * 0.005;
      let dy = n2 * 0.03 + n4 * 0.005;
      const cd = clamp(dist, 0, 1);
      dx += Math.sin(rx * 20 + time * 4) * 0.02 * cd;
      dy += Math.cos(ry * 20 + time * 3) * 0.02 * cd;

      // steady state of the displacement feedback (pos = pos*.8 - k → -5k, applied at .25)
      const k = t2 ** 0.75 * RING_DISP * 1.25;
      const fx = rx + dx - (ringX - (rx + dx)) * k;
      const fy = ry + dy - (ringY - (ry + dy)) * k;

      const alpha = smoothstep(0.1, 0.2, tt);
      if (alpha < 0.02) continue;
      const sx = px0 + fx * SCALE;
      const sy = py0 - fy * SCALE;
      if (sx < -30 || sx > width + 30 || sy < -30 || sy > height + 30) continue;

      const size = Math.max(1.6, tt * sizeK);
      const noiseColor = (snoise(fx * 2 + 74.664, fy * 2 + 91.556, time * 0.5) + 1) * 0.5;
      const progress = smoothstep(0, 0.75, noiseColor ** 2);
      const lin = progress < 0.8 ? mix3(C1, C2, progress / 0.8) : mix3(C2, C3, (progress - 0.8) / 0.2);
      ctx.fillStyle = `rgba(${toSrgb255(lin[0])},${toSrgb255(lin[1])},${toSrgb255(lin[2])},${alpha * (width > height ? 1 : 0.8)})`;

      if (size < 3) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        ctx.arc(sx, sy, size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const noiseAngle = snoise(fx * 10 + 18.4924, fy * 10 + 72.9744, t * 0.85);
        const angle = Math.atan2(fy - ringY, fx - ringX);
        ctx.setTransform(1, 0, 0, 1, sx, sy);
        ctx.rotate(-angle + noiseAngle * 0.5);
        ctx.beginPath();
        ctx.roundRect(-size / 2, -size * 0.2, size, size * 0.4, size * 0.2);
        ctx.fill();
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [frame, width, height]);

  return <canvas ref={ref} width={width} height={height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
};

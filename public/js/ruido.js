// Ruído simplex 2D com semente + utilidades de aleatoriedade determinística.

export function rngSemente(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// hash inteiro de coordenadas -> [0,1)
export function hash3(x, y, z, seed) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 974634131) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

export function criarRuido(seed) {
  const r = rngSemente(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function ruido2(xin, yin) {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = GRAD[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * n; // ~[-1,1]
  }

  // ruído de gradiente 3D (para cavernas): rápido e suave, ~[-1,1]
  const G3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1], [1, 1, 0], [-1, 1, 0], [0, -1, 1], [0, -1, -1]];
  const suave = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function ruido3(x, y, z) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = suave(x), v = suave(y), w = suave(z);
    const g = (h, a, b, c) => { const q = G3[h & 15]; return q[0] * a + q[1] * b + q[2] * c; };
    const A = perm[xi] + yi, AA = perm[A & 511] + zi, AB = perm[(A + 1) & 511] + zi;
    const Bq = perm[xi + 1] + yi, BA = perm[Bq & 511] + zi, BB = perm[(Bq + 1) & 511] + zi;
    const l = (a, b, t) => a + t * (b - a);
    return l(
      l(l(g(perm[AA & 511], x, y, z), g(perm[BA & 511], x - 1, y, z), u), l(g(perm[AB & 511], x, y - 1, z), g(perm[BB & 511], x - 1, y - 1, z), u), v),
      l(l(g(perm[(AA + 1) & 511], x, y, z - 1), g(perm[(BA + 1) & 511], x - 1, y, z - 1), u), l(g(perm[(AB + 1) & 511], x, y - 1, z - 1), g(perm[(BB + 1) & 511], x - 1, y - 1, z - 1), u), v),
      w);
  }

  function fbm(x, y, oit = 4) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let o = 0; o < oit; o++) { s += a * ruido2(x * f, y * f); n += a; a *= 0.5; f *= 2; }
    return s / n;
  }
  return { ruido2, ruido3, fbm };
}

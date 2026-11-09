// Arte procedural dos blocos (original, feita em código): visual "pacote HD" realista-estilizado.
// Cada tile é pintado em "unidades de 16" (u,v = 0..16), com cor + altura (relevo). Depois a altura
// vira luz (de cima/esquerda) e oclusão nas fendas. Assim o mesmo desenho sai em 32px e 64px;
// o 16px é a versão de 32px reduzida (média 2x2) e com um pouco de nitidez.
// Este arquivo não usa DOM: devolve só os bytes RGBA do atlas.
import { rngSemente } from './ruido.js';

export const COLS_ATLAS = 8, LINHAS_ATLAS = 32;

// ---------- utilidades de cor ----------
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const esc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sst = (a, b, x) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fr = (x) => x - Math.floor(x);
const TAU = Math.PI * 2;
// rampa de cores: t 0..1 -> cor
const rampa = (...cs) => { const k = cs.map(hex); return (t) => { t = cl(t) * (k.length - 1); const i = Math.min(k.length - 2, Math.floor(t)); return mix(k[i], k[i + 1], t - i); }; };

// ---------- ruídos que "dão a volta" no tile (emendam sem costura) ----------
// px, py = quantas células cabem no tile em cada direção
function ruidoP(sem, px, py) {
  const r = rngSemente(sem * 9781 + 7);
  const g = new Float32Array(px * py);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const kx = px / 16, ky = py / 16;
  return (u, v) => {
    const fx = u * kx, fy = v * ky;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const x0 = ((ix % px) + px) % px, y0 = ((iy % py) + py) % py;
    const x1 = (x0 + 1) % px, y1 = (y0 + 1) % py;
    const a = g[y0 * px + x0], b = g[y0 * px + x1], c = g[y1 * px + x0], d = g[y1 * px + x1];
    return a + (b - a) * tx + (c - a + (a - b + d - c) * tx) * ty;
  };
}
// soma de oitavas (0..1)
function fbm(sem, px, py, oct = 4, ganho = 0.5) {
  const fs = [], as = [];
  let a = 1, tot = 0;
  for (let o = 0; o < oct; o++) { fs.push(ruidoP(sem + o * 131, px << o, py << o)); as.push(a); tot += a; a *= ganho; }
  return (u, v) => { let s = 0; for (let o = 0; o < fs.length; o++) s += fs[o](u, v) * as[o]; return s / tot; };
}
// células (Voronoi) com grade e tremida, dando a volta no tile. Devolve sempre o mesmo objeto.
function voronoi(sem, gx, gy, jit = 0.85, ky = 1) {
  const r = rngSemente(sem * 7331 + 3);
  const n = gx * gy, cx = new Float32Array(n), cy = new Float32Array(n), va = new Float32Array(n), vb = new Float32Array(n);
  const cw = 16 / gx, ch = 16 / gy;
  for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) {
    const k = j * gx + i;
    cx[k] = (0.5 + (r() - 0.5) * jit) * cw; cy[k] = (0.5 + (r() - 0.5) * jit) * ch;
    va[k] = r(); vb[k] = r();
  }
  const o = { d1: 0, d2: 0, borda: 0, id: 0, val: 0, val2: 0, dx: 0, dy: 0 };
  return (u, v) => {
    const ci = Math.floor(u / cw), cj = Math.floor(v / ch);
    let d1 = 1e9, d2 = 1e9, id = 0, bx = 0, by = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj;
      const wi = ((ii % gx) + gx) % gx, wj = ((jj % gy) + gy) % gy, k = wj * gx + wi;
      const dx = u - (ii * cw + cx[k]), dy = (v - (jj * ch + cy[k])) * ky;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; id = k; bx = dx; by = dy; } else if (d < d2) d2 = d;
    }
    o.d1 = d1; o.d2 = d2; o.borda = (d2 - d1) * 0.5; o.id = id; o.val = va[id]; o.val2 = vb[id]; o.dx = bx; o.dy = by;
    return o;
  };
}

// ---------- contexto de pintura de um tile ----------
function criarCtx(T) {
  const n = T * T, S = T / 16, px = 16 / T;
  const R = new Float32Array(n), G = new Float32Array(n), Bc = new Float32Array(n), A = new Float32Array(n), H = new Float32Array(n);
  const tmp = new Float32Array(n), tmp2 = new Float32Array(n), mul = new Float32Array(n);
  const t = { T, S, px, n, R, G, B: Bc, A, H, rng: Math.random, wrapY: true };
  t.reset = (sem) => { R.fill(0); G.fill(0); Bc.fill(0); A.fill(1); H.fill(0); t.rng = rngSemente(sem); t.wrapY = true; };
  t.set = (i, c, a) => { R[i] = c[0]; G[i] = c[1]; Bc[i] = c[2]; if (a !== undefined) A[i] = a; };
  t.cor = (i) => [R[i], G[i], Bc[i]];
  // fn(u, v, i, x, y) -> cor [r,g,b] (ou [r,g,b,a 0..1]); nada = mantém
  t.cada = (fn) => {
    let i = 0;
    for (let y = 0; y < T; y++) {
      const v = (y + 0.5) * px;
      for (let x = 0; x < T; x++, i++) {
        const c = fn((x + 0.5) * px, v, i, x, y);
        if (c) { R[i] = c[0]; G[i] = c[1]; Bc[i] = c[2]; if (c.length > 3) A[i] = c[3]; }
      }
    }
  };
  // percorre os pixels perto de (cu,cv) num raio; fn(i, dx, dy) com dx,dy em unidades
  t.carimbo = (cu, cv, rad, fn) => {
    const x0 = Math.floor((cu - rad) * S), x1 = Math.ceil((cu + rad) * S);
    const y0 = Math.floor((cv - rad) * S), y1 = Math.ceil((cv + rad) * S);
    for (let y = y0; y < y1; y++) {
      let yy = y;
      if (t.wrapY) yy = ((y % T) + T) % T; else if (y < 0 || y >= T) continue;
      const dy = (y + 0.5) * px - cv;
      for (let x = x0; x < x1; x++) {
        const xx = ((x % T) + T) % T;
        fn(yy * T + xx, (x + 0.5) * px - cu, dy);
      }
    }
  };
  // traço de (u0,v0) a (u1,v1), largura (meia) w0 -> w1; fn(i, s 0..1 ao longo, d 0..1 do centro à beira)
  t.traco = (u0, v0, u1, v1, w0, w1, fn) => {
    const L = Math.hypot(u1 - u0, v1 - v0) || 1e-6, ax = (u1 - u0) / L, ay = (v1 - v0) / L;
    const mw = 0.5 * px;
    const wm = Math.max(w0, w1, mw);
    t.carimbo((u0 + u1) / 2, (v0 + v1) / 2, L / 2 + wm + px, (i, dx, dy) => {
      const rx = dx + (u1 - u0) / 2, ry = dy + (v1 - v0) / 2;
      const al = rx * ax + ry * ay;
      if (al < 0 || al > L) return;
      const s = al / L;
      const w = Math.max(w0 + (w1 - w0) * s, mw);
      const pe = Math.abs(rx * ay - ry * ax);
      if (pe < w) fn(i, s, pe / w);
    });
  };
  // elipse girada: fn(i, du, dv, d) com du,dv normalizados pelos raios e d = distância normalizada (<1)
  t.elipse = (cu, cv, ra, rb, ang, fn) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    t.carimbo(cu, cv, Math.max(ra, rb) + px, (i, dx, dy) => {
      const a = (dx * ca + dy * sa) / ra, b = (-dx * sa + dy * ca) / rb;
      const d = a * a + b * b;
      if (d < 1) fn(i, a, b, Math.sqrt(d));
    });
  };
  // desfoque de caixa que dá a volta (para a oclusão)
  const borrar = (src, dst, rp) => {
    const k = 1 / (2 * rp + 1);
    for (let y = 0; y < T; y++) {
      const o = y * T;
      let s = 0;
      for (let x = -rp; x <= rp; x++) s += src[o + ((x % T) + T) % T];
      for (let x = 0; x < T; x++) {
        tmp2[o + x] = s * k;
        s += src[o + (x + rp + 1) % T] - src[o + ((x - rp) % T + T) % T];
      }
    }
    for (let x = 0; x < T; x++) {
      let s = 0;
      for (let y = -rp; y <= rp; y++) s += tmp2[(((y % T) + T) % T) * T + x];
      for (let y = 0; y < T; y++) {
        dst[y * T + x] = s * k;
        s += tmp2[((y + rp + 1) % T) * T + x] - tmp2[(((y - rp) % T + T) % T) * T + x];
      }
    }
  };
  // relevo: luz vinda de cima/esquerda (forca) + oclusão nas fendas (ao, raio em unidades)
  const L = (() => { const l = [-0.5, -0.72, 0.9], m = Math.hypot(...l); return l.map((x) => x / m); })();
  t.relevo = (forca = 1, ao = 0, raio = 1, mascara = null) => {
    for (let y = 0; y < T; y++) {
      const ym = ((y - 1 + T) % T) * T, yp = ((y + 1) % T) * T, o = y * T;
      for (let x = 0; x < T; x++) {
        const xm = (x - 1 + T) % T, xp = (x + 1) % T;
        const gx = (H[o + xp] - H[o + xm]) * S * 0.5, gy = (H[yp + x] - H[ym + x]) * S * 0.5;
        const len = Math.sqrt(gx * gx + gy * gy + 1);
        const d = (-gx * L[0] - gy * L[1] + L[2]) / len / L[2];
        mul[o + x] = cl(1 + (d - 1) * forca, 0.3, 1.7);
      }
    }
    if (ao > 0) {
      borrar(H, tmp, Math.max(1, Math.round(raio * S)));
      for (let i = 0; i < n; i++) mul[i] *= cl(1 + (H[i] - tmp[i]) * ao, 0.35, 1.3);
    }
    for (let i = 0; i < n; i++) {
      if (mascara && !mascara(i)) continue;
      R[i] *= mul[i]; G[i] *= mul[i]; Bc[i] *= mul[i];
    }
  };
  // granulado fino (variação de pixel), amt ~0.03..0.08
  t.grao = (amt) => { amt *= 0.4; for (let i = 0; i < n; i++) { const k = 1 + (t.rng() - 0.5) * amt; R[i] *= k; G[i] *= k; Bc[i] *= k; } };
  return t;
}

// ---------- materiais reutilizáveis ----------
const corTerra = rampa(0x3f2c1f, 0x5a3f2b, 0x74553a, 0x8a6a4c);
function terra(t, sem = 200, umida = 0) {
  const n1 = fbm(sem, 3, 3, 4), n2 = fbm(sem + 1, 12, 12, 2), n3 = fbm(sem + 4, 6, 6, 3);
  const tor = voronoi(sem + 2, 7, 7, 0.95), ped = voronoi(sem + 3, 5, 5, 0.9);
  const pd = rampa(0x6b6157, 0x8e8273, 0xaa9d8a);
  t.cada((u, v, i) => {
    const a = n1(u, v), b = n2(u, v), m = n3(u, v);
    let q = tor(u + (m - 0.5) * 2, v + (a - 0.5) * 2);
    const torrao = q.val < 0.55 ? Math.sqrt(cl(1 - q.d1 / (0.9 + q.val2 * 0.6))) : 0;
    let h = torrao * 0.45 + b * 0.4 + m * 0.6 + a * 0.4;
    let c = corTerra(cl(a * 0.6 + m * 0.3 + b * 0.2 + torrao * 0.12 - 0.08 - umida * 0.35));
    q = ped(u, v);
    if (q.val < 0.32) {
      const rr = 0.28 + q.val2 * 0.45;
      if (q.d1 < rr) {
        const dome = Math.sqrt(1 - (q.d1 / rr) ** 2);
        h += 0.25 + dome * 0.45;
        c = esc(pd(q.val2 * 0.7 + b * 0.3), 0.85 + dome * 0.15);
      }
    }
    t.H[i] = h;
    return c;
  });
}
const corPedra = rampa(0x575652, 0x6c6a66, 0x807e79, 0x94918b);
function pedra(t, sem = 400, tom = 1, quente = 0.3) {
  const n1 = fbm(sem, 2, 2, 5), n2 = fbm(sem + 1, 5, 5, 4), n3 = fbm(sem + 2, 3, 3, 2), nr = fbm(sem + 6, 3, 3, 4);
  const pin = voronoi(sem + 5, 14, 14, 0.9), bl = voronoi(sem + 3, 3, 3, 0.9), gr = voronoi(sem + 7, 9, 9, 1), nf = fbm(sem + 8, 16, 16, 2);
  const morno = hex(0x8c8478), frio = hex(0x7c8088);
  t.cada((u, v, i) => {
    const a = n1(u, v), b = n2(u, v), k = n3(u, v);
    const q = bl(u + (b - 0.5) * 3, v + (a - 0.5) * 3);
    let h = a * 1.6 + b * 0.6 + sst(0, 0.7, q.borda) * 0.25;
    const g = gr(u, v);
    h += nf(u, v) * 0.3 + g.val * 0.12;
    let c = corPedra(cl(a * 0.45 + b * 0.4 + q.val * 0.12 + (g.val - 0.5) * 0.22 + (nf(u, v) - 0.5) * 0.3 - 0.1));
    c = mix(c, morno, cl(k * 1.6 - 0.75) * quente);
    c = mix(c, frio, cl(0.6 - k * 1.6) * 0.4);
    // fraturas: linhas sinuosas do ruído que somem e aparecem
    const f = Math.abs(nr(u, v) - 0.5);
    if (f < 0.014 && k > 0.6) { h -= 0.35 * (1 - f / 0.018); c = esc(c, 0.78); }
    else if (f < 0.03 && k > 0.6) h += 0.08;
    const p = pin(u, v);
    if (p.d1 < 0.2 + p.val2 * 0.15) { if (p.val < 0.1) c = esc(c, 1.15); else if (p.val < 0.2) c = esc(c, 0.84); }
    t.H[i] = h;
    return esc(c, tom);
  });
}
const RELEVO_PEDRA = [0.85, 0.9, 1.2];

// grama vista de cima: tufos de folhinhas com luz e sombra
const corGrama = rampa(0x46642a, 0x587c32, 0x6a8c3a, 0x7e9a46);
function fioGrama(t, u, v, ang, L, w, cor, alt) {
  const u1 = u + Math.cos(ang) * L, v1 = v + Math.sin(ang) * L;
  t.traco(u, v, u1, v1, w, w * 0.15, (i, s, d) => {
    const h = alt + s * 0.5 + (1 - d * d) * 0.25;
    if (h <= t.H[i]) return;
    t.H[i] = h;
    t.set(i, esc(cor, 0.9 + s * 0.22 - d * 0.08), 1);
  });
}
function gramaTopo(t, sem = 100, paleta = corGrama, seca = 0.06) {
  const n1 = fbm(sem, 3, 3, 3);
  const r = rngSemente(sem);
  const fundo = rampa(0x344920, 0x46602a);
  t.cada((u, v, i) => { t.H[i] = n1(u, v) * 0.2; return fundo(n1(u, v)); });
  const corFio = (u, v) => {
    if (r() < seca) return mix(hex(0x9c9452), hex(0xb0a462), r());
    return paleta(cl(n1(u, v) * 0.7 + r() * 0.5 - 0.1));
  };
  for (let k = 0; k < 46; k++) {
    const cu = r() * 16, cv = r() * 16, nb = 6 + Math.floor(r() * 6);
    for (let j = 0; j < nb; j++) {
      const ang = r() * TAU;
      fioGrama(t, cu + Math.cos(ang) * 0.3, cv + Math.sin(ang) * 0.3, ang, 1.1 + r() * 1.5, 0.32 + r() * 0.12, corFio(cu, cv), 0.25 + r() * 0.25);
    }
  }
  for (let k = 0; k < 170; k++) {
    const cu = r() * 16, cv = r() * 16;
    fioGrama(t, cu, cv, r() * TAU, 0.9 + r() * 1.3, 0.3 + r() * 0.1, corFio(cu, cv), r() * 0.3);
  }
}
// franja de grama (ou musgo/neve) que cai pela lateral, por cima da terra
function franjaLado(t, sem, corDe, altBase = 2.2, longos = 0.35, larg = 0.42) {
  const r = rngSemente(sem);
  const n = fbm(sem + 1, 4, 1, 2);
  const tem = new Uint8Array(t.n);
  t.wrapY = false;
  t.cada((u, v, i) => {
    const lim = altBase + (n(u, 0) - 0.5) * 1.6;
    if (v < lim) { tem[i] = 1; t.H[i] = 1.2 - v * 0.05; return esc(corDe(r(), u, v), 1.02 - v / lim * 0.12); }
    return null;
  });
  for (let k = 0; k < 70; k++) {
    const u = r() * 16, L = altBase + 0.6 + (r() < longos ? 1.5 + r() * 2.8 : r() * 1.4);
    const ang = Math.PI / 2 + (r() - 0.5) * 0.5;
    const cor = corDe(r(), u, 0);
    t.traco(u, 0, u + Math.cos(ang) * L, Math.sin(ang) * L, larg, 0.05, (i, s, d) => {
      tem[i] = 1; t.H[i] = 1.3 - d * 0.3; t.set(i, esc(cor, 1.02 - s * 0.16 - d * 0.1), 1);
    });
  }
  // sombra embaixo da franja
  const T = t.T, S = t.S;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x;
    if (tem[i]) continue;
    let k = 0;
    for (let j = 1; j <= Math.ceil(S * 1.2); j++) if (y - j >= 0 && tem[(y - j) * T + x]) { k = 1 - (j - 1) / (S * 1.3); break; }
    if (k > 0) { const m = 1 - 0.38 * k; t.R[i] *= m; t.G[i] *= m; t.B[i] *= m; t.H[i] -= 0.2 * k; }
  }
}

// folhagem: várias folhinhas sobrepostas, com vãos escuros e alguns buracos
function folhagem(t, sem, o) {
  const r = rngSemente(sem);
  const nb = fbm(sem + 1, 4, 4, 3);
  const fundo = hex(o.fundo);
  t.cada((u, v, i) => {
    const q = nb(u, v);
    if (q < o.buraco) { t.H[i] = -1; return [fundo[0] * 0.6, fundo[1] * 0.6, fundo[2] * 0.6, 0]; }
    t.H[i] = -0.6 + q * 0.4;
    return esc(fundo, 0.75 + q * 0.4);
  });
  const camadas = o.camadas || 3;
  for (let c = 0; c < camadas; c++) {
    const nf = o.n * (c === 0 ? 1 : 0.8);
    for (let k = 0; k < nf; k++) {
      const cu = r() * 16, cv = r() * 16, ang = r() * TAU;
      const ra = o.comp * (0.75 + r() * 0.5), rb = ra * o.larg;
      const tom = cl(r() * 0.7 + c / camadas * 0.45 + (nb(cu, cv) - 0.5) * 0.6);
      const cor = o.cor(tom, r);
      const base = c * 0.5;
      t.elipse(cu, cv, ra, rb, ang, (i, a, b, d) => {
        // folha pontuda nas duas pontas
        const larg = Math.sqrt(Math.max(0, 1 - a * a));
        if (Math.abs(b) > larg) return;
        const h = base + 0.4 + (1 - d) * 0.35 - a * 0.12;
        if (h <= t.H[i]) return;
        t.H[i] = h;
        let k2 = 1.04 - Math.abs(b) * 0.12 + (a < 0 ? 0.05 : 0);
        if (Math.abs(b) < 0.12 && Math.abs(a) < 0.85) k2 += 0.12; // nervura
        t.set(i, esc(cor, k2), 1);
      });
    }
  }
  t.relevo(o.forca ?? 0.7, o.ao ?? 0.9, 1.2);
}

// madeira (tábuas): veio que contorna nós
function veioMadeira(sem, base, escuro) {
  const w = fbm(sem, 2, 6, 3), w2 = fbm(sem + 1, 4, 16, 2);
  const cb = hex(base), ce = hex(escuro);
  return (u, v, desl) => {
    const g = fr(v * 0.9 + w(u, v) * 3.2 + w2(u, v) * 0.6 + desl);
    const linha = sst(0.72, 0.9, g) * (1 - sst(0.93, 1, g));
    return { c: mix(cb, ce, linha * 0.55 + w2(u, v) * 0.15), h: -linha * 0.12 };
  };
}

// metal escovado com chanfro
function metal(t, sem, cor, o = {}) {
  const n1 = fbm(sem, 2, 2, 3), n2 = fbm(sem + 1, 1, 48, 2);
  const c0 = hex(cor), ch = o.chanfro ?? 1;
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    t.H[i] = sst(0, ch, b) * 0.7;
    return esc(c0, 0.9 + n1(u, v) * 0.12 + (n2(u, v) - 0.5) * 0.14);
  });
  if (o.rebites !== false) {
    for (const [ru, rv] of [[2.2, 2.2], [13.8, 2.2], [2.2, 13.8], [13.8, 13.8]]) {
      t.carimbo(ru, rv, 0.9, (i, dx, dy) => { const d = Math.hypot(dx, dy); if (d < 0.75) { t.H[i] = 0.7 + Math.sqrt(1 - (d / 0.75) ** 2) * 0.5; t.set(i, esc(c0, 1.05)); } });
    }
  }
}

// lã: tricô (pontos em "V") e penugem
function la(t, cor, sem = 1500) {
  const nf = fbm(sem, 12, 12, 3), nl = fbm(sem + 1, 2, 2, 3);
  const c0 = hex(cor);
  t.cada((u, v, i) => {
    const lv = fr(v / 2), cu = u / 2, lu = fr(cu);
    // duas pernas inclinadas por ponto
    const p = lu < 0.5 ? Math.abs(lu - 0.25 - (lv - 0.5) * 0.28) : Math.abs(lu - 0.75 + (lv - 0.5) * 0.28);
    const perna = Math.cos(cl(p / 0.25) * Math.PI / 2);
    const h = perna * 0.18 * (0.75 + Math.sin(lv * Math.PI) * 0.25) + nf(u, v) * 0.45;
    t.H[i] = h;
    return esc(c0, 0.92 + perna * 0.05 + (nl(u, v) - 0.5) * 0.12 + (nf(u, v) - 0.5) * 0.16);
  });
  t.relevo(0.45, 0.5, 0.6);
  t.grao(0.05);
}

// minério: cristais/pepitas facetados sobre a pedra
function minerio(t, sem, cores, o = {}) {
  pedra(t, 400, o.tomPedra || 1);
  const r = rngSemente(sem);
  const [c1, c2, c3] = cores.map(hex);
  const grupos = o.grupos || 4;
  for (let g = 0; g < grupos; g++) {
    const gu = 1.5 + r() * 13, gv = 1.5 + r() * 13, nc = 4 + Math.floor(r() * 4);
    for (let k = 0; k < nc; k++) {
      const cu = gu + (r() - 0.5) * 3.2, cv = gv + (r() - 0.5) * 3.2;
      const rad = (o.tam || 1.4) * (0.7 + r() * 0.6), lados = 4 + Math.floor(r() * 3), rot = r() * TAU;
      const tons = Array.from({ length: lados }, () => r());
      t.carimbo(cu, cv, rad * 1.3, (i, dx, dy) => {
        const a = Math.atan2(dy, dx) - rot, d = Math.hypot(dx, dy);
        const seg = TAU / lados, f = ((Math.floor(((a % TAU) + TAU) % TAU / seg)) % lados);
        const am = (((a % seg) + seg) % seg) - seg / 2;
        const lim = rad * Math.cos(seg / 2) / Math.cos(am);
        if (d > lim) { if (d < lim + 0.25) t.H[i] -= 0.15; return; }
        const borda = d / lim;
        const face = tons[f];
        let c = mix(c1, c2, face);
        if (borda < 0.35) c = mix(c, c3, 0.5 + face * 0.3);
        t.H[i] = 0.9 + (1 - borda) * 0.35;
        t.set(i, esc(c, 0.8 + face * 0.4));
      });
      // brilho metálico
      if (r() < 0.8) t.carimbo(cu - rad * 0.25, cv - rad * 0.25, 0.35, (i, dx, dy) => { if (Math.hypot(dx, dy) < 0.22) t.set(i, mix(t.cor(i), c3, 0.85)); });
    }
  }
  t.relevo(...RELEVO_PEDRA);
}

// ---------- os tiles ----------
const PINT = {};

PINT[0] = (t) => { gramaTopo(t, 100); t.relevo(0.6, 0.7, 1.0); t.grao(0.04); };
const corGramaLado = (q, u, v) => corGrama(cl(0.35 + q * 0.6));
PINT[1] = (t) => { terra(t, 200); t.relevo(0.8, 1.1, 1); franjaLado(t, 101, corGramaLado); t.grao(0.05); };
PINT[2] = (t) => { terra(t, 200); t.relevo(0.8, 1.1, 1); t.grao(0.06); };
PINT[3] = (t) => { pedra(t, 400); t.relevo(...RELEVO_PEDRA); t.grao(0.05); };
// areia: grãos finos, ondinhas de vento
PINT[4] = (t) => {
  const w = fbm(501, 2, 2, 3), n = fbm(502, 4, 4, 3), gr = voronoi(503, 22, 22, 0.9);
  const c0 = rampa(0xc4ad7f, 0xd4c093, 0xe0d0a6);
  t.cada((u, v, i) => {
    const onda = Math.sin((v + w(u, v) * 6 + u * 0.15) * TAU / 2.7) * sst(0.35, 0.7, w(v, u));
    let h = onda * 0.07 + n(u, v) * 0.45;
    let c = c0(cl(n(u, v) * 0.8 + onda * 0.05 + 0.1));
    const q = gr(u, v);
    if (q.d1 < 0.17) { if (q.val < 0.1) c = esc(hex(0x9c8664), 1); else if (q.val < 0.2) c = hex(0xefe3c2); else if (q.val < 0.23) c = hex(0xa87a5a); h += 0.08; }
    t.H[i] = h;
    return c;
  });
  t.relevo(0.6, 0.6, 0.6); t.grao(0.06);
};
// água (só ícone/partícula; a água do jogo é shader): mantém o azul de sempre
PINT[5] = (t) => {
  const n = fbm(551, 3, 3, 3);
  t.cada((u, v) => esc(mix(hex(0x2f94b8), hex(0x46b2d2), n(u, v)), 1 + 0.06 * Math.sin((u + v * 0.6 + n(u, v) * 6) * 1.4)));
  t.grao(0.03);
};
// tronco visto de cima: anéis, miolo, rachaduras e casca
PINT[6] = (t) => {
  const w = fbm(601, 3, 3, 3), nb = fbm(602, 16, 4, 2), fib = fbm(603, 24, 24, 2);
  const madeira = rampa(0xb08454, 0xc49a68, 0xd2ae7c);
  const rach = [0.6, 2.4, 4.1];
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v) + (nb(u + v, Math.min(u, v)) - 0.5) * 0.8;
    if (b < 1.4) { t.H[i] = 0.6 + fib(u, v) * 0.6; return mix(hex(0x3a2b1e), hex(0x5d4632), fib(u, v)); }
    const dx = u - 7.7, dy = v - 8.2, d = Math.hypot(dx, dy) + (w(u, v) - 0.5) * 1.4;
    const a = Math.atan2(dy, dx);
    if (d < 0.55) { t.H[i] = 0.2; return hex(0x6e4c2c); }
    const anel = fr(d * 0.85);
    const tardio = sst(0.6, 0.9, anel) * (1 - sst(0.92, 1, anel));
    let c = mix(madeira(0.4 + w(u, v) * 0.6 - d * 0.02), hex(0x8d6438), tardio * 0.75);
    t.H[i] = 0.4 - tardio * 0.06 + fib(u, v) * 0.05;
    for (const ra of rach) {
      let da = Math.abs(((a - ra + Math.PI) % TAU + TAU) % TAU - Math.PI);
      if (da * d < 0.18 && d > 2 && d < 6.3) { c = hex(0x4a3322); t.H[i] = 0.05; }
    }
    if (b < 2.1) c = esc(c, 0.78 + (b - 1.4) * 0.3);
    return c;
  });
  t.relevo(0.7, 0.9, 0.8); t.grao(0.04);
};
// casca de carvalho: placas compridas com sulcos fundos (e um pouco de líquen)
function casca(t, sem, o) {
  const pl = voronoi(sem, o.gx, o.gy, 0.9, o.ky || 0.3), w = fbm(sem + 1, 6, 2, 3), nf = fbm(sem + 2, 8, 2, 3), li = fbm(sem + 3, 3, 3, 3);
  const cor = rampa(...o.cores), fi = fbm(sem + 4, 16, 2, 2);
  t.cada((u, v, i) => {
    const uu = u + (w(u, v) - 0.5) * o.torto;
    const q = pl(uu, v);
    const placa = sst(0.02, o.sulco, q.borda) * (0.7 + fi(u, v) * 0.5);
    const fib = fi(uu * 1.0, v);
    t.H[i] = placa * 0.9 + nf(u, v) * 0.3 + fib * 0.5;
    let c = mix(hex(o.funda), cor(q.val * 0.45 + nf(u, v) * 0.3 + fib * 0.5 - 0.1), cl(placa * 1.2));
    if (o.liquen && li(u, v) > 0.66 && placa > 0.5) c = mix(c, hex(0x7f8466), (li(u, v) - 0.66) * 2.2);
    return c;
  });
  t.relevo(0.85, 1.1, 1); t.grao(0.05);
}
// casca de carvalho: cristas fibrosas entrelaçadas (ruído "em crista" esticado na vertical)
PINT[7] = (t) => {
  const w = fbm(701, 2, 3, 3), w2 = fbm(702, 4, 8, 2), fi = fbm(703, 24, 3, 2), li = fbm(704, 3, 3, 3);
  const qb = voronoi(705, 5, 3, 0.9, 0.4);
  const cor = rampa(0x2e2219, 0x45362a, 0x5a4a39, 0x6c5c48);
  t.cada((u, v, i) => {
    const fase = u / 2.3 + (w(u, v) - 0.5) * 0.9 + (w2(u, v) - 0.5) * 0.35;
    let crista = Math.abs(Math.sin(fase * Math.PI));
    const q = qb(u, v);
    crista *= sst(0.02, 0.25, q.borda) * 0.5 + 0.5; // placas quebradas na horizontal
    const sulco = sst(0.08, 0.55, crista);
    t.H[i] = sulco * 1.4 + fi(u, v) * 0.5 + q.val * 0.2;
    let c = cor(cl(sulco * 0.75 + fi(u, v) * 0.35 + (q.val - 0.5) * 0.15 - 0.12));
    if (li(u, v) > 0.68 && sulco > 0.5) c = mix(c, hex(0x7f8466), (li(u, v) - 0.68) * 2.4);
    return c;
  });
  t.relevo(0.9, 1.1, 0.9); t.grao(0.05);
};
// folhas
const corFolha = rampa(0x3a5e26, 0x4f7631, 0x67903c, 0x84a84c);
PINT[8] = (t) => folhagem(t, 801, { n: 95, comp: 1.6, larg: 0.5, fundo: 0x2c4620, ao: 0.6, buraco: 0.3, cor: (k) => corFolha(k) });
// tábuas: 4 tábuas com tom próprio, veio, nós, juntas e pregos
PINT[9] = (t) => {
  const r = rngSemente(901);
  const tom = [0, 1, 2, 3].map(() => 0.88 + r() * 0.2), junta = [0, 1, 2, 3].map(() => 2 + r() * 12), des = [0, 1, 2, 3].map(() => r() * 7);
  const veio = veioMadeira(902, 0xae8556, 0x7a5532);
  const nos = [0, 1, 2, 3].map(() => (r() < 0.45 ? [r() * 16, 0.8 + r() * 2.4] : null));
  t.cada((u, v, i) => {
    const b = Math.min(3, Math.floor(v / 4)), lv = v - b * 4;
    let uu = u, vv = v;
    const no = nos[b];
    if (no) { const dx = u - no[0], dy = lv - no[1], d = Math.hypot(dx, dy * 2); if (d < 1.8) vv += (1.8 - d) * 0.5 * Math.sign(dy || 1); }
    const g = veio(uu, vv, des[b]);
    let c = esc(g.c, tom[b]);
    let h = 0.5 + g.h;
    if (no) { const d = Math.hypot(u - no[0], (lv - no[1]) * 1.8); if (d < 0.55) { c = esc(hex(0x5a3a22), 1 + d * 0.4); h -= 0.05; } }
    const dj = Math.abs(((u - junta[b]) % 16 + 24) % 16 - 8) - 8 + 8; // distância até a junta (0..8)
    const e = Math.min(lv, 4 - lv, Math.min(Math.abs(u - junta[b]), 16 - Math.abs(u - junta[b])));
    void dj;
    h *= sst(0, 0.45, e);
    if (e < 0.45) c = esc(c, 0.42 + e * 1.1);
    // pregos perto da junta
    for (const pu of [junta[b] - 0.9, junta[b] + 0.9]) {
      const d = Math.hypot(((u - pu + 24) % 16) - 8, lv - 2);
      if (d < 0.32) { c = mix(hex(0x55504a), hex(0x8a847a), d < 0.15 ? 1 : 0.3); h = 0.55; }
    }
    t.H[i] = h;
    return c;
  });
  t.relevo(0.6, 1.0, 0.7); t.grao(0.04);
};
// vidro: moldura fininha, reflexos e o resto transparente
PINT[10] = (t) => {
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 0.8) { t.H[i] = 1; return [...esc(hex(0xd8e4e8), 0.92 + b * 0.1), 1]; }
    if (b < 1.2) { t.H[i] = 0.5; return [150, 172, 182, 1]; }
    const dg = u - v + 16 - 16;
    if ((dg > -1 && dg < 0.9 && u > 3 && u < 9.5) || (dg > 1.8 && dg < 2.3 && u > 5 && u < 10)) return [236, 246, 250, 0.75];
    if (u > 12 && v > 11.5 && Math.abs(u - v - 1.2) < 0.3) return [220, 236, 244, 0.7];
    return [190, 220, 235, 0];
  });
  t.relevo(0.5, 0, 1, (i) => t.A[i] > 0.9);
};
// tijolo: argamassa recuada, tom por tijolo, cantos lascados
PINT[11] = (t) => {
  const r = rngSemente(1101);
  const tons = Array.from({ length: 16 }, () => r());
  const n = fbm(1102, 4, 4, 4), nf = fbm(1103, 16, 16, 2), arg = fbm(1104, 12, 12, 2);
  const cor = rampa(0x6e3426, 0x8a4430, 0x9c5039, 0xa8624a);
  t.cada((u, v, i) => {
    const lin = Math.floor(v / 4), desl = lin % 2 ? 4 : 0;
    const uu = (u + desl) % 16, col = Math.floor(uu / 8), lu = uu - col * 8, lv = v - lin * 4;
    const e = Math.min(lu - 0.35, 7.65 - lu, lv - 0.35, 3.65 - lv) + (n(u, v) - 0.5) * 0.45;
    const tm = tons[lin * 2 + col];
    if (e < 0) { t.H[i] = arg(u, v) * 0.2; return esc(mix(hex(0x8f877b), hex(0xb0a898), arg(u, v)), 1); }
    t.H[i] = 0.55 + sst(0, 0.35, e) * 0.3 + nf(u, v) * 0.15;
    let c = cor(cl(tm * 0.8 + n(u, v) * 0.4 - 0.1));
    if (tm > 0.88) c = esc(c, 0.75); // tijolo mais queimado
    if (nf(u, v) > 0.72) c = esc(c, 0.86); // poros
    return c;
  });
  t.relevo(0.8, 1.2, 0.6); t.grao(0.05);
};
// ---- plantas (fundo transparente) ----
function caule(t, u0, v0, u1, v1, w, cor) {
  t.traco(u0, v0, u1, v1, w, w * 0.7, (i, s, d) => { t.H[i] = 1 + (1 - d) * 0.3; t.set(i, esc(hex(cor), 1.08 - d * 0.3), 1); });
}
function folhaLonga(t, u, v, ang, L, w, cor, curva = 0.4) {
  // folha curva em 4 pedaços
  let pu = u, pv = v, a = ang;
  for (let k = 0; k < 4; k++) {
    const nu = pu + Math.cos(a) * L / 4, nv = pv + Math.sin(a) * L / 4;
    const w0 = w * (1 - k / 4), w1 = w * (1 - (k + 1) / 4) + 0.03;
    t.traco(pu, pv, nu, nv, w0, w1, (i, s, d) => { t.H[i] = 1 + (1 - d) * 0.4; t.set(i, esc(hex(cor), 1.12 - d * 0.35 + k * 0.03), 1); });
    pu = nu; pv = nv; a += curva / 4;
  }
}
function planta(t) { t.wrapY = false; t.cada((u, v, i) => { t.H[i] = 0; return [0, 0, 0, 0]; }); }
function flor(t, o) {
  planta(t);
  const r = rngSemente(o.sem);
  caule(t, 8.2, 16, 8, o.cy + 1, 0.45, 0x4a6e2c);
  folhaLonga(t, 8, 14.5, -2.3, 5, 0.9, 0x557a32, -0.5);
  folhaLonga(t, 8.2, 13, -0.9, 4.2, 0.8, 0x4e7330, 0.5);
  const np = o.petalas;
  for (let k = 0; k < np; k++) {
    const a = k / np * TAU + r() * 0.3;
    const cu = 8 + Math.cos(a) * o.dist, cv = o.cy + Math.sin(a) * o.dist * 0.8;
    const tom = r();
    t.elipse(cu, cv, o.comp, o.larg, a, (i, du, dv, d) => {
      if (o.recorte && du > 0.55 && ((du * 9 + dv * 5) % 1 + 1) % 1 < 0.35) return;
      const h = 1.5 + (1 - d) * 0.4 + k * 0.01;
      if (h <= t.H[i] && t.A[i] > 0) return;
      t.H[i] = h;
      t.set(i, esc(mix(hex(o.cor1), hex(o.cor2), tom * 0.4 + (du + 1) * 0.3), 1.06 - d * 0.18), 1);
    });
  }
  t.elipse(8, o.cy, o.miolo, o.miolo, 0, (i, a, b, d) => { t.H[i] = 2.2 + (1 - d) * 0.6; t.set(i, esc(hex(o.centro), 0.85 + (1 - d) * 0.35 + (r() - 0.5) * 0.2), 1); });
  t.relevo(0.6, 0.6, 0.5, (i) => t.A[i] > 0);
}
PINT[12] = (t) => flor(t, { sem: 1201, cy: 5.8, petalas: 5, dist: 1.6, comp: 2.1, larg: 1.9, cor1: 0x9e2420, cor2: 0xc8402e, miolo: 0.9, centro: 0x2c2a1c });
PINT[13] = (t) => flor(t, { sem: 1301, cy: 5.6, petalas: 13, dist: 2.0, comp: 1.5, larg: 0.55, cor1: 0xd8a426, cor2: 0xeccb4e, miolo: 1.2, centro: 0xa86a22 });
PINT[23] = (t) => flor(t, { sem: 2301, cy: 5.8, petalas: 9, dist: 2.0, comp: 1.6, larg: 0.8, cor1: 0x3a56b0, cor2: 0x6a86d4, miolo: 0.8, centro: 0x3a2a5a, recorte: true });
// capim: folhas compridas e curvas
function capim(t, sem, n, cor, alt = [6, 14.5]) {
  planta(t);
  const r = rngSemente(sem);
  for (let k = 0; k < n; k++) {
    const u = 1 + r() * 14, L = alt[0] + r() * (alt[1] - alt[0]);
    const ang = -Math.PI / 2 + (r() - 0.5) * 0.7, curva = (r() - 0.5) * 1.4;
    folhaLonga(t, u, 16.3, ang, L, 0.5 + r() * 0.3, cor(r()), curva);
  }
  t.relevo(0.5, 0.5, 0.5, (i) => t.A[i] > 0);
}
const corCapim = (q) => (q < 0.08 ? 0x9e9a58 : [0x3f6626, 0x4c7430, 0x5c8236, 0x6b8e3e][Math.floor(q * 4) % 4]);
PINT[14] = (t) => capim(t, 1401, 26, corCapim);
// lãs (cores naturais, de tingimento)
PINT[15] = (t) => la(t, 0xe2ded4);
PINT[16] = (t) => la(t, 0xa33a30);
PINT[17] = (t) => la(t, 0x3d5c98);
PINT[18] = (t) => la(t, 0xd2a634);
PINT[19] = (t) => la(t, 0x5a8638);
PINT[20] = (t) => la(t, 0xd38ca6);
// pedrisco: pedras arredondadas com argamassa
PINT[21] = (t) => {
  const pc = voronoi(2101, 4, 4, 0.75), n = fbm(2102, 4, 4, 3), nf = fbm(2103, 16, 16, 2), arg = fbm(2104, 10, 10, 2);
  const cores = [0x7c7a74, 0x6a6863, 0x878279, 0x5f5d5a, 0x7a7266, 0x716e69].map(hex);
  t.cada((u, v, i) => {
    const q = pc(u + (n(u, v) - 0.5) * 1.2, v + (n(v, u) - 0.5) * 1.2);
    const e = q.borda - 0.22;
    if (e < 0) { t.H[i] = arg(u, v) * 0.25; return esc(mix(hex(0x4c4944), hex(0x6a665e), arg(u, v)), 1); }
    const dome = Math.sqrt(cl(e / 1.1));
    t.H[i] = 0.3 + dome * 1.0 + nf(u, v) * 0.15;
    return esc(cores[q.id % cores.length], 0.85 + q.val * 0.2 + (nf(u, v) - 0.5) * 0.18);
  });
  t.relevo(0.6, 0.9, 0.8); t.grao(0.05);
};
// lampião: moldura de madeira, grade de ferro e luz quentinha
PINT[22] = (t) => {
  const veio = veioMadeira(2201, 0x5e4430, 0x3a291c);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 2) { t.H[i] = 0.6 + sst(0, 0.5, b) * 0.4 - sst(1.5, 2, b) * 0.3; return veio(u + v, Math.min(u, v) * 3, 0).c; }
    if (Math.abs(u - 8) < 0.45 || Math.abs(v - 8) < 0.45) { t.H[i] = 0.6; return hex(0x34322f); }
    const d = Math.hypot(u - 8, (v - 8) * 0.9);
    t.H[i] = 0;
    const k = cl(1 - d / 8);
    return mix(hex(0xe8902c), hex(0xfff2c0), k * k * 1.2);
  });
  t.relevo(0.7, 0.6, 0.6, (i) => t.H[i] > 0.05);
};
// terra de plantar: sulcos úmidos
PINT[24] = (t) => {
  terra(t, 2400, 0.55);
  const pv = fbm(2401, 4, 1, 2);
  for (let i = 0; i < t.n; i++) {
    const v = (Math.floor(i / t.T) + 0.5) * t.px, u = (i % t.T + 0.5) * t.px;
    const lv = fr((v + (pv(u, v) - 0.5) * 0.8) / 4);
    const s = Math.sin(lv * Math.PI);
    t.H[i] = t.H[i] * 0.5 + s * 1.2;
    const k = 0.72 + s * 0.35;
    t.R[i] *= k; t.G[i] *= k; t.B[i] *= k * 0.96;
  }
  t.relevo(0.8, 1, 1); t.grao(0.05);
};
// trigo: talos com espigas e barbas
PINT[25] = (t) => {
  planta(t);
  const r = rngSemente(2501);
  for (let k = 0; k < 6; k++) {
    const u = 1.6 + k * 2.55 + (r() - 0.5) * 0.8, topo = 1.2 + r() * 2.5, inc = (r() - 0.5) * 1.2;
    folhaLonga(t, u, 16, -Math.PI / 2 + (r() < 0.5 ? -0.6 : 0.6), 4 + r() * 3, 0.45, 0x8e9a46, (r() - 0.5));
    caule(t, u, 16.2, u + inc, topo + 5, 0.32, 0xb0a24e);
    for (let g = 0; g < 7; g++) {
      const gv = topo + g * 0.85, lado = g % 2 ? 1 : -1, gu = u + inc + lado * 0.45;
      t.elipse(gu, gv, 0.7, 0.42, -Math.PI / 2 + lado * 0.5, (i, a, b, d) => { t.H[i] = 2 + (1 - d) * 0.5; t.set(i, esc(mix(hex(0xb8903c), hex(0xe2c066), 1 - d), 1 - g * 0.02), 1); });
      t.traco(gu, gv - 0.5, gu + lado * 0.5, gv - 2.2, 0.08, 0.04, (i) => { t.H[i] = 2.5; t.set(i, hex(0xd8c27c), 1); });
    }
  }
  t.relevo(0.6, 0.5, 0.5, (i) => t.A[i] > 0);
};
// feno: palha cortada (topo) e fardo amarrado (lado)
function palhas(t, sem, n, angBase, angVar, comp) {
  const r = rngSemente(sem);
  const cor = rampa(0x8e6e2c, 0xb08a3a, 0xc8a24c, 0xdcbc6a);
  t.cada((u, v, i) => { t.H[i] = 0; return hex(0x5a4420); });
  for (let k = 0; k < n; k++) {
    const u = r() * 16, v = r() * 16, a = angBase + (r() - 0.5) * angVar, L = comp * (0.6 + r() * 0.8);
    const c = cor(r()), h0 = r();
    t.traco(u, v, u + Math.cos(a) * L, v + Math.sin(a) * L, 0.22 + r() * 0.08, 0.18, (i, s, d) => {
      const h = h0 + (1 - d * d) * 0.4;
      if (h <= t.H[i]) return;
      t.H[i] = h; t.set(i, esc(c, 1.05 - d * 0.25));
    });
  }
}
PINT[26] = (t) => { palhas(t, 2601, 900, 0, TAU, 2.2); t.relevo(0.7, 1, 0.8); t.grao(0.04); };
PINT[27] = (t) => {
  palhas(t, 2701, 650, 0, 0.5, 4.5);
  const n = fbm(2702, 8, 1, 2);
  for (const bv of [3.6, 12.4]) {
    t.cada((u, v, i) => {
      const d = Math.abs(v - bv - (n(u, v) - 0.5) * 0.3);
      if (d < 1.4 && d >= 0.7) { t.H[i] -= 0.3 * (1.4 - d); return esc(t.cor(i), 0.7 + (d - 0.7) * 0.4); }
      if (d >= 0.7) return null;
      t.H[i] = 1.4 + Math.cos(d / 0.7 * Math.PI / 2) * 0.3;
      const torc = fr((u + v * 1.5) / 1.1);
      return esc(mix(hex(0x5a3a22), hex(0x84603a), torc), 0.9 + (1 - d / 0.7) * 0.15);
    });
  }
  t.relevo(0.7, 1, 0.8); t.grao(0.04);
};
// cacto: gomos com espinhos (lado) e topo em estrela
PINT[28] = (t) => {
  const n = fbm(2801, 8, 1, 3), nf = fbm(2802, 6, 6, 2);
  const cor = rampa(0x2a4a24, 0x3e6630, 0x56803e);
  t.cada((u, v, i) => {
    const g = Math.cos((u - 2) / 4 * TAU);
    t.H[i] = g * 0.7 + n(u, v) * 0.2;
    return esc(cor(cl((g + 1) * 0.45 + nf(u, v) * 0.2)), 0.95 + (n(u, v) - 0.5) * 0.15);
  });
  for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) {
    const au = 2 + k * 4, av = 1.5 + j * 4 + (k % 2) * 2;
    t.carimbo(au, av, 0.6, (i, dx, dy) => { const d = Math.hypot(dx, dy); if (d < 0.45) { t.H[i] = 1.1; t.set(i, mix(hex(0xb8ad86), hex(0xd8d0aa), 1 - d / 0.45)); } });
    for (const a of [-2.4, -0.8, 0.6, 2.2]) t.traco(au, av, au + Math.cos(a) * 1.2, av + Math.sin(a) * 1.2, 0.09, 0.03, (i) => { t.H[i] = 1.4; t.set(i, hex(0xece4c4)); });
  }
  t.relevo(0.7, 0.7, 1); t.grao(0.04);
};
PINT[29] = (t) => {
  const cor = rampa(0x2a4a24, 0x426a32, 0x5e8844, 0x7a9c56);
  t.cada((u, v, i) => {
    const dx = u - 8, dy = v - 8, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const b = Math.min(u, v, 16 - u, 16 - v);
    const g = Math.cos(a * 8) * sst(1, 5, d);
    t.H[i] = g * 0.5 - d * 0.03;
    let c = cor(cl(0.75 - d * 0.05 + g * 0.2));
    if (b < 0.7) c = esc(c, 0.75);
    return c;
  });
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * TAU;
    for (const rr of [2.5, 5]) t.carimbo(8 + Math.cos(a) * rr, 8 + Math.sin(a) * rr, 0.5, (i, dx, dy) => { if (Math.hypot(dx, dy) < 0.38) { t.H[i] = 1; t.set(i, hex(0xcfc6a0)); } });
  }
  t.relevo(0.7, 0.7, 1); t.grao(0.04);
};
// cascalho: pedrinhas soltas de várias cores
PINT[30] = (t) => {
  const pc = voronoi(3001, 7, 7, 0.95), nf = fbm(3002, 16, 16, 2), w = fbm(3003, 6, 6, 2);
  const cores = [0x8b8680, 0x6f6a64, 0xa39d94, 0x5c5853, 0x8f7f6c, 0x9a9288, 0x7a6a5a].map(hex);
  t.cada((u, v, i) => {
    const q = pc(u + (w(u, v) - 0.5) * 0.8, v + (w(v, u) - 0.5) * 0.8);
    const e = q.borda - 0.1;
    if (e < 0) { t.H[i] = 0; return hex(0x3a3632); }
    const dome = Math.sqrt(cl(e / 0.7));
    t.H[i] = 0.2 + dome * 0.7 + q.val2 * 0.3;
    return esc(cores[q.id % cores.length], 0.85 + q.val * 0.25 + (nf(u, v) - 0.5) * 0.2);
  });
  t.relevo(0.85, 1.2, 0.7); t.grao(0.05);
};
// minérios
PINT[31] = (t) => minerio(t, 3101, [0x141414, 0x2e2d2c, 0x5a5856], { tam: 1.5 });
PINT[32] = (t) => minerio(t, 3201, [0xa0684a, 0xd4a07a, 0xf0ccaa]);
PINT[33] = (t) => minerio(t, 3301, [0xb07e22, 0xe8bc44, 0xfff0b0], { tam: 1.2 });
PINT[34] = (t) => minerio(t, 3401, [0x2a9aa8, 0x6ae0e4, 0xe0ffff], { tam: 1.1, grupos: 4 });
// rocha-mãe: escura, caótica e bem funda
PINT[35] = (t) => {
  const pc = voronoi(3501, 5, 5, 1), n = fbm(3502, 4, 4, 4), nf = fbm(3503, 12, 12, 2);
  const cor = rampa(0x1e1e20, 0x353538, 0x4c4c50, 0x67676b);
  t.cada((u, v, i) => {
    const q = pc(u + (n(u, v) - 0.5) * 3, v + (n(v, u) - 0.5) * 3);
    const e = sst(0, 0.6, q.borda);
    t.H[i] = e * 1.2 + n(u, v) * 1.2 + nf(u, v) * 0.3;
    return cor(cl(e * 0.4 + q.val * 0.45 + nf(u, v) * 0.3 - 0.1));
  });
  t.relevo(1, 1.3, 1); t.grao(0.06);
};
// pinheiro: casca em escamas avermelhadas
PINT[36] = (t) => casca(t, 3601, { gx: 4, gy: 5, ky: 0.6, sulco: 0.22, torto: 0.8, cores: [0x5a3626, 0x704634, 0x8a5c44], funda: 0x3a241a });
const corPinho = rampa(0x2a4630, 0x385a3a, 0x4a6e44, 0x628452);
PINT[37] = (t) => {
  const r = rngSemente(3701);
  const nb = fbm(3702, 4, 4, 3);
  t.cada((u, v, i) => { const q = nb(u, v); if (q < 0.24) { t.H[i] = -1; return [20, 30, 20, 0]; } t.H[i] = -0.5; return esc(hex(0x1e3222), 0.8 + q * 0.4); });
  for (let k = 0; k < 95; k++) {
    const u = r() * 16, v = r() * 16, a = r() * TAU, L = 2.2 + r() * 1.8, h0 = r() * 1.2;
    const cor = corPinho(r() * 0.8 + h0 * 0.2);
    const ux = Math.cos(a), uy = Math.sin(a);
    for (let s = 0; s <= 1.0; s += 0.14) {
      const pu = u + ux * L * s, pv = v + uy * L * s;
      for (const lado of [-1, 1]) {
        const na = a + lado * (0.9 + r() * 0.3), nl = 0.9 + r() * 0.5;
        t.traco(pu, pv, pu + Math.cos(na) * nl, pv + Math.sin(na) * nl, 0.13, 0.05, (i, ss, d) => {
          const h = h0 + 0.3 + ss * 0.2;
          if (h <= t.H[i]) return;
          t.H[i] = h; t.set(i, esc(cor, 0.9 + ss * 0.25), 1);
        });
      }
    }
    t.traco(u, v, u + ux * L, v + uy * L, 0.12, 0.08, (i) => { if (t.H[i] < h0 + 0.25) { t.H[i] = h0 + 0.25; t.set(i, hex(0x3a2a1e), 1); } });
  }
  t.relevo(0.6, 1, 1.2);
};
// bétula: casca branca com riscos e manchas escuras
PINT[38] = (t) => {
  const n = fbm(3801, 3, 6, 3), st = fbm(3802, 1, 24, 2), mc = fbm(3803, 4, 12, 3);
  const r = rngSemente(3804);
  t.cada((u, v, i) => {
    let c = mix(hex(0xcfc8b8), hex(0xe8e4d8), n(u, v) * 0.7 + st(u, v) * 0.5);
    let h = n(u, v) * 0.3 + st(u, v) * 0.2;
    const m = mc(u, v);
    if (m > 0.71) { c = mix(hex(0x4a453e), hex(0x2a2723), cl((m - 0.71) * 5)); h -= 0.35; }
    else if (m > 0.66) { c = mix(c, hex(0xb8957c), (m - 0.66) * 10); }
    t.H[i] = h;
    return c;
  });
  for (let k = 0; k < 28; k++) {
    const u = r() * 16, v = r() * 16, L = 0.8 + r() * 2.2;
    t.traco(u, v, u + L, v + (r() - 0.5) * 0.2, 0.16 + r() * 0.1, 0.1, (i) => { t.H[i] -= 0.3; t.set(i, hex(0x4a4238)); });
  }
  t.relevo(0.6, 0.8, 0.8); t.grao(0.04);
};
// folhas da selva: folhas largas com nervuras
const corSelva = rampa(0x22421a, 0x325e22, 0x43742a, 0x5a8836);
PINT[39] = (t) => folhagem(t, 3901, { n: 42, comp: 2.6, larg: 0.48, fundo: 0x1a3012, buraco: 0.26, cor: (k) => corSelva(k), camadas: 3 });
// arbusto seco: galhos tortos
function galho(t, u, v, a, L, w, prof, r, cor) {
  const u1 = u + Math.cos(a) * L, v1 = v + Math.sin(a) * L;
  t.traco(u, v, u1, v1, w, w * 0.7, (i, s, d) => { t.H[i] = 1 + (1 - d) * 0.3; t.set(i, esc(hex(cor), 1.05 - d * 0.3), 1); });
  if (prof <= 0) return;
  const nb = 2 + (r() < 0.4 ? 1 : 0);
  for (let k = 0; k < nb; k++) galho(t, u1, v1, a + (r() - 0.5) * 1.3, L * (0.55 + r() * 0.2), w * 0.65, prof - 1, r, cor);
}
PINT[40] = (t) => {
  planta(t);
  const r = rngSemente(4001);
  for (const a of [-1.9, -1.55, -1.2]) galho(t, 8 + (r() - 0.5), 16, a + (r() - 0.5) * 0.3, 4 + r() * 1.5, 0.42, 3, r, 0x6e5a42);
  t.relevo(0.5, 0.4, 0.5, (i) => t.A[i] > 0);
};

// ---------- engenharia (48..63) ----------
PINT[48] = (t) => {
  const n = fbm(4801, 4, 4, 2);
  t.cada((u, v, i) => { const f = fr((u + v) / 1.6), h = Math.sin(f * Math.PI); t.H[i] = h * 0.5; return esc(mix(hex(0x7a3e22), hex(0xb8703e), h), 0.9 + n(u, v) * 0.2); });
  t.relevo(0.6, 0.6, 0.5);
};
PINT[49] = (t) => {
  t.cada((u, v, i) => { const f = fr((u + v) / 1.6), h = Math.sin(f * Math.PI); t.H[i] = h * 0.5; return mix(hex(0xd0301e), hex(0xffb050), h * h); });
  t.relevo(0.3, 0.3, 0.5);
};
PINT[50] = (t) => {
  planta(t);
  t.carimbo(8, 8, 7, (i, dx, dy) => {
    const d = Math.hypot(dx, dy);
    if (d < 4.2) { t.H[i] = 1 + Math.sqrt(1 - (d / 4.2) ** 2) * 2.2; t.set(i, hex(0xc0281e), 1); }
    else if (d < 6.4) { t.H[i] = 0.6 + (6.4 - d) * 0.1; t.set(i, hex(0x5c636a), 1); }
  });
  t.relevo(0.9, 0.6, 0.8, (i) => t.A[i] > 0);
  t.carimbo(6.6, 6.6, 1.2, (i, dx, dy) => { if (Math.hypot(dx, dy) < 0.9 && t.A[i] > 0) t.set(i, mix(t.cor(i), hex(0xffd0c0), 0.6)); });
};
function lampada(t, acesa) {
  metal(t, 5101, 0x6a7178, { chanfro: 0.8, rebites: false });
  const n = fbm(5102, 6, 6, 2);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1.2) return null;
    if (Math.abs(u - 5.6) < 0.4 || Math.abs(u - 10.4) < 0.4 || Math.abs(v - 5.6) < 0.4 || Math.abs(v - 10.4) < 0.4) { t.H[i] = 0.9; return hex(acesa ? 0x8a8070 : 0x5a6168); }
    t.H[i] = 0.2;
    const d = Math.hypot(u - 8, v - 8);
    if (acesa) return mix(hex(0xffcc66), hex(0xfff6d8), cl(1 - d / 8));
    return esc(mix(hex(0xb4ae98), hex(0xd2ceba), n(u, v)), 1 - d * 0.015);
  });
  t.relevo(0.7, 0.8, 0.6, acesa ? (i) => t.H[i] > 0.3 : null);
}
PINT[51] = (t) => lampada(t, false);
PINT[52] = (t) => lampada(t, true);
PINT[53] = (t) => {
  const veio = veioMadeira(5301, 0xa07a4c, 0x6e4c2c);
  t.cada((u, v, i) => {
    const tb = Math.floor(u / 4), lu = u - tb * 4;
    const g = veio(v, u * 1.1, tb * 1.7);
    t.H[i] = 0.5 * sst(0, 0.3, Math.min(lu, 4 - lu));
    if (Math.abs(v - 3.2) < 0.9 || Math.abs(v - 12.8) < 0.9) {
      t.H[i] = 0.9;
      if (Math.hypot(lu - 2, Math.abs(v - 3.2) < 0.9 ? v - 3.2 : v - 12.8) < 0.4) { t.H[i] = 1.2; return hex(0x6a7078); }
      return hex(0x464c54);
    }
    return esc(g.c, 0.9 + (tb % 2) * 0.08);
  });
  t.relevo(0.7, 0.9, 0.7); t.grao(0.04);
};
PINT[54] = (t) => {
  const veio = veioMadeira(5301, 0xa07a4c, 0x6e4c2c);
  t.cada((u, v, i) => {
    if (u < 2 || u > 14 || v < 1 || v > 15) { t.H[i] = 0.5; return veio(v, u, 0).c; }
    t.H[i] = 0; return [0, 0, 0, 0];
  });
  t.relevo(0.6, 0.4, 0.5, (i) => t.A[i] > 0);
};
PINT[55] = (t) => { metal(t, 5501, 0x8a929a); t.relevo(0.8, 0.6, 0.6); t.grao(0.03); };
PINT[56] = (t) => {
  metal(t, 5601, 0x8a929a);
  t.cada((u, v, i) => {
    const dx = u - 8, dy = v - 8, d = Math.hypot(dx, dy);
    if (d > 7) return null;
    if (d > 6.3) { t.H[i] = 0.9; return hex(0x5a6168); }
    if (d < 1.4) { t.H[i] = 1.2 - d * 0.2; return hex(0xb08a3a); }
    const a = Math.atan2(dy, dx), pa = fr((a / TAU) * 4 + d * 0.06);
    if (pa < 0.42) { t.H[i] = 0.7 - pa; return mix(hex(0x6c8a9e), hex(0x9ab4c4), 1 - pa / 0.42); }
    t.H[i] = -0.4; return hex(0x1e2226);
  });
  t.relevo(0.8, 0.8, 0.6); t.grao(0.03);
};
PINT[57] = (t) => {
  const n = fbm(5701, 16, 16, 1);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 2) { t.H[i] = 0.6 + Math.sin(b / 2 * Math.PI) * 0.6; return esc(hex(0x31507c), 0.9 + n(u, v) * 0.2); }
    t.H[i] = 0.1 + (fr(u * 2) < 0.5 ? 0.05 : 0) + (fr(v * 2) < 0.5 ? 0.05 : 0);
    return esc(((Math.floor((u + v) / 3)) % 2) ? hex(0xc8a03a) : hex(0xa8402e), 0.92 + n(u, v) * 0.12);
  });
  t.relevo(0.6, 0.8, 0.6);
};
PINT[58] = (t) => {
  t.cada((u, v, i) => {
    if (u < 2 || u > 14) { t.H[i] = 0.8; return esc(hex(0x6a7178), 0.95 + (Math.floor(v) % 4 === 0 ? -0.15 : 0)); }
    const lv = fr(v / 2);
    t.H[i] = Math.sin(lv * Math.PI) * 0.25;
    const ay = fr(v / 8) * 8, dx = Math.abs(u - 8);
    const seta = dx < 4.5 && ay >= dx - 0.2 && ay <= dx + 2.0;
    return seta ? esc(hex(0xc8a434), 0.9 + lv * 0.15) : mix(hex(0x26282a), hex(0x3a3d40), lv);
  });
  t.relevo(0.7, 0.6, 0.5); t.grao(0.05);
};
PINT[59] = (t) => {
  metal(t, 5901, 0x7a828a);
  t.cada((u, v, i) => {
    const dx = u - 8;
    const larg = v < 2.5 ? 0.9 : v < 11 ? 2 + (v - 2.5) * 0.55 : v < 12.8 ? 6.6 : -1;
    if (Math.abs(dx) < larg) {
      const k = dx / larg;
      t.H[i] = 1 + Math.sqrt(1 - k * k) * 1.4;
      return v > 11 ? hex(0x9a7426) : mix(hex(0xb88a2e), hex(0xe8c460), 0.5 - k * 0.5);
    }
    if (v > 12.8 && v < 14.3 && Math.abs(dx) < 1.2) { t.H[i] = 1.2; return hex(0x8a6620); }
    return null;
  });
  t.relevo(0.8, 0.8, 0.6);
};
PINT[60] = (t) => {
  metal(t, 6001, 0x7a828a);
  const r = rngSemente(6002);
  const cores = [0xc8483a, 0xd8b440, 0x4a6ac0, 0x5a9a44, 0xd890aa, 0xeeeeea].map(hex);
  t.cada((u, v, i) => {
    const d = Math.hypot(u - 8, v - 8);
    if (d > 6.4) return null;
    if (d > 5) { t.H[i] = 1.2; return hex(0x2c3238); }
    t.H[i] = -0.5; return hex(0x181c20);
  });
  for (let k = 0; k < 40; k++) {
    const a = r() * TAU, d = Math.sqrt(r()) * 4.4;
    t.elipse(8 + Math.cos(a) * d, 8 + Math.sin(a) * d, 0.55, 0.28, r() * TAU, (i) => { t.H[i] = 0; t.set(i, cores[k % cores.length]); });
  }
  t.relevo(0.7, 0.8, 0.6);
};
PINT[61] = (t) => {
  metal(t, 6101, 0x6a7178, { chanfro: 0.8, rebites: false });
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1.2) return null;
    t.H[i] = 0.2;
    const d = Math.hypot(u - 7, v - 7.5), d2 = Math.hypot(u - 9.4, v - 5.8);
    if (d < 4.4 && d2 > 3.6) return mix(hex(0xd8cc90), hex(0xfff4c8), cl(1 - d / 4.4 + 0.3));
    for (const [sx, sy] of [[3.5, 12], [12.2, 12.5], [12.5, 3.6], [4, 3.2]]) if (Math.hypot(u - sx, v - sy) < 0.45) return hex(0xf0f0f0);
    const ref = Math.abs(u - v - 5) < 0.8 && u < 14 ? 1.25 : 1;
    return esc(mix(hex(0x111a38), hex(0x22305e), v / 16), ref);
  });
  t.relevo(0.6, 0.6, 0.6, (i) => t.H[i] > 0.3);
};
PINT[62] = (t) => {
  metal(t, 6201, 0x6a7178, { chanfro: 0.8, rebites: false });
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1.2) return null;
    const d = Math.hypot(u - 8, v - 8);
    t.H[i] = 0.3 + (fr(d / 1.3) - 0.5) * 0.25;
    if (d < 2.6) return mix(hex(0x7ad888), hex(0xd8ffd0), 1 - d / 2.6);
    return esc(mix(hex(0x245a2c), hex(0x347a3c), fr(d / 1.3)), 1 - d * 0.02);
  });
  t.relevo(0.6, 0.6, 0.6);
};
PINT[63] = (t) => {
  planta(t);
  t.cada((u, v, i) => {
    if (v >= 11 && v <= 15 && u >= 2.5 && u <= 13.5) { t.H[i] = 1 + Math.min(v - 11, 15 - v, u - 2.5, 13.5 - u) * 0.3; return [...esc(hex(0x7c7a74), 0.95), 1]; }
    return null;
  });
  t.traco(6.5, 12, 10, 3.5, 0.65, 0.5, (i, s, d) => { t.H[i] = 2 + (1 - d) * 0.5; t.set(i, esc(hex(0x8a6a42), 1.05 - d * 0.3), 1); });
  t.carimbo(10.2, 3.2, 2.2, (i, dx, dy) => { const d = Math.hypot(dx, dy); if (d < 2) { t.H[i] = 3 + Math.sqrt(1 - (d / 2) ** 2) * 1.5; t.set(i, hex(0xb02a20), 1); } });
  t.relevo(0.8, 0.5, 0.6, (i) => t.A[i] > 0);
};

// ---------- eras (64..112) ----------
// musgo: almofadinha fofa
const corMusgo = rampa(0x34501e, 0x4a6a28, 0x62823a, 0x7c9648);
function musgoTopo(t, sem) {
  const n = fbm(sem, 3, 3, 4), bol = voronoi(sem + 1, 10, 10, 0.95), f = fbm(sem + 2, 24, 24, 2);
  t.cada((u, v, i) => {
    const q = bol(u, v);
    const dome = Math.sqrt(cl(1 - q.d1 / 1.1));
    t.H[i] = dome * 0.6 + n(u, v) * 0.8 + f(u, v) * 0.2;
    return corMusgo(cl(dome * 0.4 + n(u, v) * 0.5 + f(u, v) * 0.3 - 0.1));
  });
}
PINT[64] = (t) => { musgoTopo(t, 6401); t.relevo(0.7, 1, 0.8); t.grao(0.06); };
PINT[65] = (t) => { terra(t, 200); t.relevo(0.8, 1.1, 1); franjaLado(t, 6501, (q) => corMusgo(0.3 + q * 0.6), 2.6, 0.2, 0.55); t.grao(0.05); };
// samambaia gigante
PINT[66] = (t) => {
  planta(t);
  const r = rngSemente(6601);
  for (const [a, L] of [[-1.57, 13], [-2.2, 10], [-0.95, 10], [-2.7, 7], [-0.45, 7]]) {
    const u0 = 8, v0 = 16;
    const n = 12;
    let pu = u0, pv = v0, ang = a;
    for (let k = 0; k < n; k++) {
      const nu = pu + Math.cos(ang) * L / n, nv = pv + Math.sin(ang) * L / n;
      t.traco(pu, pv, nu, nv, 0.28, 0.24, (i) => { t.H[i] = 1.5; t.set(i, hex(0x3e5a26), 1); });
      const fl = (1 - k / n) * 2.2 + 0.4;
      for (const lado of [-1, 1]) {
        const la2 = ang + lado * 1.2;
        t.elipse(nu + Math.cos(la2) * fl * 0.5, nv + Math.sin(la2) * fl * 0.5, fl * 0.55, 0.35, la2, (i, du, dv, d) => {
          if (t.H[i] > 1.2) return;
          t.H[i] = 1 + (1 - d) * 0.3; t.set(i, esc(mix(hex(0x3c6a2a), hex(0x6e963e), r() * 0.3 + (1 - k / n) * 0.4), 1.05 - d * 0.2), 1);
        });
      }
      pu = nu; pv = nv; ang += (a < -1.57 ? -1 : 1) * 0.04 + (a === -1.57 ? 0 : 0);
    }
  }
  t.relevo(0.5, 0.5, 0.5, (i) => t.A[i] > 0);
};
// cavalinha: caules em gomos com raminhos
PINT[67] = (t) => {
  planta(t);
  const r = rngSemente(6701);
  for (let k = 0; k < 5; k++) {
    const u = 1.8 + k * 3.1 + (r() - 0.5), topo = 1 + r() * 4;
    for (let v = topo; v < 16; v += 1.8) {
      for (const lado of [-1, 1]) t.traco(u, v, u + lado * (1.6 + r()), v - 1.2, 0.12, 0.06, (i) => { t.H[i] = 1.2; t.set(i, hex(0x6a9244), 1); });
    }
    t.traco(u, 16, u, topo, 0.5, 0.42, (i, s, d) => {
      const seg = fr((s * (16 - topo)) / 1.8) < 0.12;
      t.H[i] = 1.5 + (1 - d) * 0.3; t.set(i, seg ? hex(0x3a3a26) : esc(hex(0x6a9a46), 1.05 - d * 0.3), 1);
    });
    t.elipse(u, topo, 0.5, 0.9, 0, (i) => { t.H[i] = 2; t.set(i, hex(0x8a7a4a), 1); });
  }
  t.relevo(0.5, 0.5, 0.5, (i) => t.A[i] > 0);
};
// palmeira: topo fibroso e lado com cicatrizes em losango
PINT[68] = (t) => {
  const n = fbm(6801, 3, 3, 3), f = voronoi(6802, 24, 24, 0.9);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    const q = f(u, v);
    t.H[i] = sst(0, 0.15, q.borda) * 0.3 + (b < 1.3 ? 0.8 : 0);
    if (b < 1.3) return esc(hex(0x5a4a34), 0.9 + n(u, v) * 0.2);
    return esc(mix(hex(0x9a7c54), hex(0xc2a274), n(u, v)), 0.85 + q.val * 0.25);
  });
  t.relevo(0.7, 0.9, 0.5); t.grao(0.05);
};
PINT[69] = (t) => {
  const n = fbm(6901, 4, 4, 3), fib = fbm(6902, 24, 2, 2);
  t.cada((u, v, i) => {
    const lin = Math.floor(v / 2.67), lv = v - lin * 2.67, desl = lin % 2 ? 2.67 : 0;
    const lu = fr((u + desl) / 5.33) * 5.33;
    const dm = Math.abs(lu - 2.67) / 2.67 + Math.abs(lv - 1.33) / 1.33;
    const esc2 = sst(0.75, 1.05, dm);
    t.H[i] = (1 - esc2) * 0.8 - lv * 0.12 + fib(u, v) * 0.2;
    return esc(mix(mix(hex(0x8a6c48), hex(0xa88a5e), n(u, v)), hex(0x4a3a28), esc2 * 0.7), 0.9 + fib(u, v) * 0.15);
  });
  t.relevo(0.8, 1, 0.8); t.grao(0.04);
};
const corPalma = rampa(0x2a4a1c, 0x3e6a26, 0x568832, 0x6e9a3e);
PINT[70] = (t) => {
  const r = rngSemente(7001);
  const nb = fbm(7002, 4, 4, 3);
  t.cada((u, v, i) => { t.H[i] = -1; return esc(hex(0x1c3014), 0.8 + nb(u, v) * 0.4); });
  for (let k = 0; k < 14; k++) {
    const u = r() * 16, v = r() * 16, a = r() * TAU, L = 7 + r() * 4, h0 = k * 0.1;
    const ux = Math.cos(a), uy = Math.sin(a);
    for (let s = 0; s < 1; s += 0.07) {
      const pu = u + ux * L * s, pv = v + uy * L * s;
      for (const lado of [-1, 1]) {
        const la2 = a + lado * 0.75, fl = 2.4 * (1 - s * 0.6);
        t.traco(pu, pv, pu + Math.cos(la2) * fl, pv + Math.sin(la2) * fl, 0.32, 0.08, (i, ss, d) => {
          const h = h0 + 0.3 + (1 - d) * 0.15;
          if (h <= t.H[i]) return;
          t.H[i] = h; t.set(i, esc(corPalma(cl(0.3 + h0 * 0.4 + r() * 0.15)), 1.05 - d * 0.25 + ss * 0.08), 1);
        });
      }
    }
    t.traco(u, v, u + ux * L, v + uy * L, 0.25, 0.1, (i) => { t.H[i] = h0 + 0.5; t.set(i, hex(0x8a9a4a), 1); });
  }
  t.relevo(0.6, 0.8, 1);
};
// basalto: colunas (juntas hexagonais) e poros
PINT[71] = (t) => {
  const pc = voronoi(7101, 3, 3, 0.5), n = fbm(7102, 4, 4, 4), por = voronoi(7103, 16, 16, 0.9);
  t.cada((u, v, i) => {
    const q = pc(u, v);
    const e = sst(0, 0.35, q.borda);
    let c = esc(mix(hex(0x2c2c30), hex(0x48484e), n(u, v) * 0.7 + q.val * 0.3), 1);
    let h = e * 0.6 + n(u, v) * 0.6;
    const p = por(u, v);
    if (p.val < 0.12 && p.d1 < 0.22 + p.val2 * 0.15) { h -= 0.3; c = esc(c, 0.75); }
    t.H[i] = h;
    return esc(c, 0.75 + e * 0.25);
  });
  t.relevo(0.9, 1.1, 0.8); t.grao(0.06);
};
// pedra de lava: crosta escura e rachaduras brilhando
PINT[72] = (t) => {
  const pc = voronoi(7201, 4, 4, 0.9), n = fbm(7202, 4, 4, 4);
  t.cada((u, v, i) => {
    const q = pc(u + (n(u, v) - 0.5) * 2, v + (n(v, u) - 0.5) * 2);
    const e = q.borda;
    if (e < 0.32) { const k = 1 - e / 0.32; t.H[i] = -0.3; return mix(hex(0xb8401a), hex(0xffd060), k * k); }
    t.H[i] = sst(0.32, 0.9, e) * 0.8 + n(u, v) * 0.5;
    const brasa = sst(0.6, 0.32, e);
    return mix(esc(mix(hex(0x2a1e1c), hex(0x4a3630), n(u, v)), 0.9 + q.val * 0.2), hex(0x8a2c14), brasa * 0.6);
  });
  t.relevo(0.8, 0.9, 0.8, (i) => t.H[i] > -0.2); t.grao(0.05);
};
// ovo de dinossauro
PINT[73] = (t) => {
  planta(t);
  const r = rngSemente(7301), pin = voronoi(7302, 8, 8, 0.9);
  t.elipse(8, 9.5, 5, 6.2, Math.PI / 2, (i, a, b, d) => {
    t.H[i] = Math.sqrt(1 - d * d) * 4;
    const v = (Math.floor(i / t.T) + 0.5) * t.px, u = (i % t.T + 0.5) * t.px;
    const q = pin(u, v);
    let c = mix(hex(0xd8ccae), hex(0xece2c8), r() * 0.3 + 0.4);
    if (q.d1 < 0.3 + q.val * 0.45 && q.val2 < 0.55) c = mix(hex(0x8a6c4a), hex(0x6a7a5a), q.val);
    t.set(i, c, 1);
  });
  t.relevo(0.9, 0.3, 1, (i) => t.A[i] > 0);
};
// fóssil: amonite na pedra
PINT[74] = (t) => {
  pedra(t, 7401, 0.98);
  t.carimbo(8, 8, 6.5, (i, dx, dy) => {
    const d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (d > 5.6) return;
    const esp = fr(Math.log(Math.max(d, 0.3)) / 0.55 - a / TAU);
    const sulco = sst(0.0, 0.15, esp) * (1 - sst(0.85, 1, esp));
    const cost = 0.5 + 0.5 * Math.cos(a * 22 + d);
    t.H[i] = 0.9 + sulco * 0.5 + cost * 0.1 - sst(5, 5.6, d) * 0.4;
    t.set(i, esc(mix(hex(0xb8ac90), hex(0xddd2b8), cost * 0.5 + sulco * 0.5), 0.8 + sulco * 0.25));
  });
  t.relevo(...RELEVO_PEDRA); t.grao(0.05);
};
// neve: fofa, com sombrinhas azuladas e cristais brilhando
function neveTopo(t, sem) {
  const n = fbm(sem, 3, 3, 4), f = fbm(sem + 1, 16, 16, 2), cr = voronoi(sem + 2, 18, 18, 0.9);
  t.cada((u, v, i) => {
    t.H[i] = n(u, v) * 1.0 + f(u, v) * 0.15;
    let c = mix(hex(0xd4dce8), hex(0xf4f6fa), cl(n(u, v) * 0.6 + 0.45));
    const q = cr(u, v);
    if (q.d1 < 0.12 && q.val < 0.25) c = hex(0xffffff);
    return c;
  });
}
PINT[75] = (t) => { neveTopo(t, 7501); t.relevo(0.5, 0.8, 1.2); t.grao(0.02); };
PINT[76] = (t) => { terra(t, 200); t.relevo(0.8, 1.1, 1); franjaLado(t, 7601, (q) => mix(hex(0xdae2ec), hex(0xf6f8fb), q), 3.2, 0.15, 0.7); t.grao(0.03); };
// gelo: azulado, com rachaduras e bolhas
PINT[77] = (t) => {
  const n = fbm(7701, 2, 2, 4), rc = voronoi(7702, 3, 3, 1), bo = voronoi(7703, 9, 9, 0.9), st = fbm(7704, 2, 12, 2);
  t.cada((u, v, i) => {
    let c = mix(hex(0x7aa8c8), hex(0xb8d8ea), cl(n(u, v) * 0.8 + st(u + v, v - u) * 0.4 - 0.1));
    t.H[i] = n(u, v) * 0.2;
    const q = rc(u, v);
    if (q.borda < 0.1) c = mix(c, hex(0xe2f2fa), 0.6 * (1 - q.borda / 0.1));
    else if (q.borda < 0.2) c = esc(c, 0.94);
    const b = bo(u, v);
    if (b.val < 0.3 && b.d1 < 0.22) c = mix(c, hex(0xf4fbff), 0.6);
    return c;
  });
  t.relevo(0.3, 0.2, 1); t.grao(0.02);
};
// folhas com neve: folhagem com bolotas brancas por cima
PINT[78] = (t) => {
  folhagem(t, 7801, { n: 80, comp: 1.6, larg: 0.5, fundo: 0x1a2c18, buraco: 0.3, cor: (k) => mix(hex(0x2a4422), hex(0x4a6a36), k), forca: 0.6, ao: 0.8 });
  const n = fbm(7802, 5, 5, 3);
  t.cada((u, v, i) => {
    if (t.A[i] < 0.5) return null;
    const q = n(u, v);
    if (q > 0.55) { const k = sst(0.55, 0.65, q); return mix(t.cor(i), mix(hex(0xd8e0ea), hex(0xffffff), (q - 0.55) * 3), k); }
    return null;
  });
};
// tenda de pele: couro costurado com pelos
PINT[79] = (t) => {
  const n = fbm(7901, 3, 3, 4), pl = fbm(7902, 16, 4, 3), pt = voronoi(7903, 2, 2, 0.6);
  t.cada((u, v, i) => {
    const q = pt(u + (n(u, v) - 0.5) * 2, v);
    let c = mix(hex(0x6e4c32), hex(0x9a7452), n(u, v) * 0.7 + q.val * 0.4);
    let h = n(u, v) * 0.5 + pl(u, v) * 0.3;
    if (q.borda < 0.25) { h -= 0.3; c = esc(c, 0.7); }
    if (q.borda >= 0.25 && q.borda < 0.5 && fr((u + v) / 1.1) < 0.35) { c = hex(0xc8b088); h += 0.2; }
    t.H[i] = h;
    return esc(c, 0.9 + pl(u, v) * 0.2);
  });
  t.relevo(0.7, 0.8, 0.8); t.grao(0.05);
};
// fogueira: lenha cruzada com brasas (topo) e chamas (lado)
PINT[80] = (t) => {
  const n = fbm(8001, 4, 4, 3);
  t.cada((u, v, i) => {
    const d = Math.hypot(u - 8, v - 8);
    t.H[i] = n(u, v) * 0.3;
    if (d > 6.5) return esc(mix(hex(0x5a5650), hex(0x7a766e), n(u, v)), 0.9);
    const k = cl(1 - d / 6.5);
    return mix(mix(hex(0x3a2a22), hex(0xb83a12), k), hex(0xffc050), k * k * k * (0.7 + n(u, v) * 0.6));
  });
  for (const [a, w] of [[0.5, 1.1], [2.1, 1.1], [3.7, 1.0], [5.2, 1.0]]) {
    t.traco(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, 8 + Math.cos(a) * 1.5, 8 + Math.sin(a) * 1.5, w, w * 0.9, (i, s, d) => {
      t.H[i] = 1 + Math.sqrt(1 - d * d) * 0.8;
      t.set(i, mix(mix(hex(0x5a3e28), hex(0x7a5a3a), 1 - d), hex(0x2a1a14), s * s * 0.9));
    });
  }
  t.relevo(0.7, 0.8, 0.8); t.grao(0.05);
};
PINT[81] = (t) => {
  const n = fbm(8101, 4, 2, 4), pc = voronoi(8102, 4, 1, 0.6);
  t.wrapY = false;
  t.cada((u, v, i) => {
    if (v > 11.5) {
      const q = pc(u, v);
      t.H[i] = sst(0, 0.5, q.borda) + n(u, v) * 0.3;
      return esc(mix(hex(0x5e5a54), hex(0x8a857c), q.val * 0.6 + n(u, v) * 0.4), 1);
    }
    if (v > 9) { t.H[i] = 0.5; return esc(mix(hex(0x4a3222), hex(0x2a1a12), (v - 9) / 2.5), 0.9 + n(u, v) * 0.2); }
    const ch = n(u * 1.3, v * 0.7 + 3) * 1.4 - (9 - v) / 9 * 0.9;
    t.H[i] = 0;
    if (ch < 0.15) return [0, 0, 0, 1];
    const k = cl((ch - 0.15) * 2);
    return mix(hex(0xc03a12), hex(0xffe08a), k);
  });
  t.relevo(0.6, 0.6, 0.6, (i) => t.H[i] > 0.1);
  // fundo da chama: escuro (bloco opaco)
  for (let i = 0; i < t.n; i++) if (t.R[i] === 0 && t.G[i] === 0) { t.R[i] = 30; t.G[i] = 22; t.B[i] = 18; }
};
// palha (telhado): fileiras de feixes
PINT[82] = (t) => {
  const r = rngSemente(8201);
  const cor = rampa(0x8a7038, 0xa88a46, 0xc4a65a, 0xd6bc74);
  t.cada((u, v, i) => { t.H[i] = 0; return hex(0x6a5428); });
  for (let fil = 0; fil < 5; fil++) {
    const v0 = fil * 4 - 1;
    for (let k = 0; k < 160; k++) {
      const u = r() * 16, L = 3.5 + r() * 2, a = Math.PI / 2 + (r() - 0.5) * 0.25, c = cor(r());
      t.traco(u, v0 + r() * 0.8, u + Math.cos(a) * L, v0 + Math.sin(a) * L, 0.2, 0.17, (i, s, d) => {
        const h = fil * 0.5 + s * 0.6 + (1 - d) * 0.2;
        if (h <= t.H[i] && t.H[i] < fil * 0.5) return;
        t.H[i] = h; t.set(i, esc(c, 0.85 + s * 0.25 - d * 0.15));
      });
    }
  }
  t.relevo(0.7, 1, 0.8); t.grao(0.04);
};
// pintura da caverna: mãos e um bicho em ocre na pedra
PINT[83] = (t) => {
  pedra(t, 8301, 0.96, 0.6);
  const n = fbm(8302, 12, 12, 2);
  const pintar = (i, cor, k) => { const m = cl(k * (0.6 + n((i % t.T) * t.px, Math.floor(i / t.T) * t.px) * 0.6)); t.set(i, mix(t.cor(i), hex(cor), m)); };
  // mão
  t.elipse(4.5, 5, 1.7, 1.9, 0, (i, a, b, d) => pintar(i, 0x9a3a1e, 1));
  for (const [a, L] of [[-2.4, 2.4], [-1.95, 2.9], [-1.55, 3.0], [-1.15, 2.6], [-0.4, 2.0]]) t.traco(4.5 + Math.cos(a) * 1.2, 5 + Math.sin(a) * 1.2, 4.5 + Math.cos(a) * (1 + L), 5 + Math.sin(a) * (1 + L), 0.42, 0.34, (i) => pintar(i, 0x9a3a1e, 1));
  // bicho (corpo, cabeça, pernas, chifres)
  t.elipse(10.5, 11, 3, 1.5, 0, (i) => pintar(i, 0x6a3a1a, 0.95));
  t.elipse(13.8, 9.8, 0.9, 0.7, -0.4, (i) => pintar(i, 0x6a3a1a, 0.95));
  for (const lu of [8.4, 9.6, 11.6, 12.6]) t.traco(lu, 12, lu + 0.2, 14.6, 0.25, 0.2, (i) => pintar(i, 0x6a3a1a, 0.9));
  t.traco(13.8, 9.2, 13, 7.4, 0.15, 0.1, (i) => pintar(i, 0x2a2420, 0.9));
  t.traco(14.2, 9.2, 15, 7.6, 0.15, 0.1, (i) => pintar(i, 0x2a2420, 0.9));
  t.relevo(...RELEVO_PEDRA); t.grao(0.05);
};
// barro: liso, com rachaduras de seco
PINT[84] = (t) => {
  const n = fbm(8401, 3, 3, 4), rc = voronoi(8402, 4, 4, 0.9);
  t.cada((u, v, i) => {
    const q = rc(u + (n(u, v) - 0.5), v);
    let c = mix(hex(0x8a5a3e), hex(0xa87252), n(u, v) * 0.7 + q.val * 0.3);
    let h = n(u, v) * 0.4 + sst(0, 0.3, q.borda) * 0.3;
    if (q.borda < 0.08) { c = esc(c, 0.6); h -= 0.3; }
    t.H[i] = h;
    return c;
  });
  t.relevo(0.6, 0.9, 0.8); t.grao(0.04);
};
// arenito: topo liso, lado em camadas, entalhado
const corAren = rampa(0xb89a68, 0xcbb07c, 0xd8c08e, 0xe2cc9c);
PINT[85] = (t) => {
  const n = fbm(8501, 3, 3, 4), f = fbm(8502, 16, 16, 2);
  t.cada((u, v, i) => { t.H[i] = n(u, v) * 0.4 + f(u, v) * 0.2; return corAren(cl(n(u, v) * 0.7 + f(u, v) * 0.3 + 0.1)); });
  t.relevo(0.6, 0.6, 0.8); t.grao(0.05);
};
function arenitoLado(t, sem) {
  const n = fbm(sem, 3, 3, 3), w = fbm(sem + 1, 2, 1, 2), f = fbm(sem + 2, 16, 4, 2);
  t.cada((u, v, i) => {
    const vv = v + (w(u, v) - 0.5) * 1.2;
    const cam = fr(vv / 3.2), id = Math.floor(vv / 3.2);
    const borda = sst(0, 0.15, cam) * (1 - sst(0.88, 1, cam));
    t.H[i] = borda * 0.5 + f(u, v) * 0.25 - cam * 0.15;
    return esc(corAren(cl(n(u, v) * 0.5 + ((id * 0.37) % 1) * 0.4 + f(u, v) * 0.2)), 0.82 + borda * 0.18);
  });
}
PINT[86] = (t) => { arenitoLado(t, 8601); t.relevo(0.7, 0.9, 0.6); t.grao(0.05); };
PINT[87] = (t) => {
  arenitoLado(t, 8701);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1.4) { t.H[i] = 1; return null; }
    const dx = Math.abs(u - 8), dy = Math.abs(v - 8);
    const los = dx + dy;
    const motivo = (los > 4.4 && los < 5.6) || (los < 2) || (Math.max(dx, dy) > 5.8 && Math.max(dx, dy) < 6.4);
    t.H[i] = motivo ? 1 : 0.2;
    return motivo ? null : esc(t.cor(i), 0.85);
  });
  t.relevo(0.8, 1, 0.5); t.grao(0.04);
};
// mármore: branco com veios cinza
const marmore = (t, sem) => {
  const w = fbm(sem, 2, 2, 5), n = fbm(sem + 1, 4, 4, 3);
  t.cada((u, v, i) => {
    const s = Math.abs(Math.sin((u * 0.4 + v * 0.25 + w(u, v) * 6) * 1.3));
    const veio = Math.pow(1 - s, 6);
    t.H[i] = n(u, v) * 0.1;
    return mix(mix(hex(0xdcd8d0), hex(0xf2f0ea), n(u, v)), hex(0x8a8a8e), veio * 0.75);
  });
};
PINT[88] = (t) => { marmore(t, 8801); t.relevo(0.3, 0.2, 0.5); t.grao(0.015); };
PINT[89] = (t) => {
  marmore(t, 8901);
  t.cada((u, v, i) => {
    const d = Math.hypot(u - 8, v - 8);
    const b = Math.min(u, v, 16 - u, 16 - v);
    let h = 0.5;
    if (b < 1.2) h = 1; else if (Math.abs(d - 5.6) < 0.35) h = 0.2;
    t.H[i] = h; return null;
  });
  t.relevo(0.6, 0.6, 0.5); t.grao(0.015);
};
PINT[90] = (t) => {
  marmore(t, 9001);
  t.cada((u, v, i) => { const f = fr(u / 2.667); t.H[i] = -Math.sin(f * Math.PI) * 0.8 * (f > 0.12 ? 1 : 0.2); return null; });
  t.relevo(0.8, 0.7, 0.6); t.grao(0.015);
};
// telha de barro: fileiras de telhas curvas
PINT[91] = (t) => {
  const n = fbm(9101, 4, 4, 3), r = rngSemente(9102);
  const tons = Array.from({ length: 32 }, () => r());
  t.cada((u, v, i) => {
    const lin = Math.floor(v / 4), desl = lin % 2 ? 2 : 0;
    const col = Math.floor((u + desl) / 4) % 4, lu = fr((u + desl) / 4), lv = (v - lin * 4) / 4;
    const curva = Math.sin(lu * Math.PI);
    t.H[i] = curva * 0.6 + lv * 0.6;
    let c = mix(hex(0x8a3e22), hex(0xb05a34), cl(tons[lin * 4 + col] * 0.6 + n(u, v) * 0.5));
    c = esc(c, 0.75 + curva * 0.3);
    if (lv > 0.88) c = esc(c, 0.65);
    return c;
  });
  t.relevo(0.7, 0.8, 0.6); t.grao(0.05);
};
// bloco de ouro: polido, com chanfro e reflexos
PINT[92] = (t) => {
  const n = fbm(9201, 2, 2, 3), e = fbm(9202, 1, 32, 2);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    t.H[i] = sst(0, 1.2, b) * 0.8;
    const ref = 0.5 + 0.5 * Math.sin((u - v) * 0.35 + n(u, v) * 3);
    return mix(mix(hex(0xa87818), hex(0xe8b838), ref), hex(0xfff0a0), Math.pow(ref, 6) * 0.6 + (e(u, v) - 0.5) * 0.2);
  });
  t.relevo(0.9, 0.5, 0.8);
};
// mosaico: pastilhas de pedra com rejunte
PINT[93] = (t) => {
  const pc = voronoi(9301, 8, 8, 0.35), n = fbm(9302, 8, 8, 2);
  const cores = [0xa85a3a, 0xc8a050, 0x4a6a8a, 0xe2dccc, 0x5a7a4a].map(hex);
  t.cada((u, v, i) => {
    const q = pc(u, v);
    if (q.borda < 0.12) { t.H[i] = 0; return hex(0x8a8274); }
    t.H[i] = 0.4 + n(u, v) * 0.1;
    const dx = Math.abs(u - 8), dy = Math.abs(v - 8);
    const anel = Math.floor((dx + dy) / 2.6) % 3, canto = Math.max(dx, dy) > 6.5;
    const ci = canto ? 3 : [0, 1, 2][anel] ^ (q.val < 0.12 ? 1 : 0);
    return esc(cores[ci % cores.length], 0.88 + q.val * 0.2 + (n(u, v) - 0.5) * 0.1);
  });
  t.relevo(0.7, 1, 0.4); t.grao(0.04);
};
// pedra de castelo: blocos talhados de tamanhos diferentes
PINT[94] = (t) => {
  const n = fbm(9401, 4, 4, 4), nf = fbm(9402, 12, 12, 2), r = rngSemente(9403);
  const linhas = [0, 5, 10, 16], cortes = [[0, 7], [3, 11], [1, 9]], tons = Array.from({ length: 9 }, () => r());
  const cor = rampa(0x66645e, 0x7c7a72, 0x908d84);
  t.cada((u, v, i) => {
    let li = 0; while (v >= linhas[li + 1]) li++;
    const lv = v - linhas[li], hl = linhas[li + 1] - linhas[li];
    const cs = cortes[li]; let ci = 0, lu = 0, wl = 0;
    const uu = u; const pts = [...cs, cs[0] + 16];
    for (let k = 0; k < cs.length; k++) { const a = pts[k], b = pts[k + 1]; const x = uu < a ? uu + 16 : uu; if (x >= a && x < b) { ci = k; lu = x - a; wl = b - a; } }
    const e = Math.min(lu, wl - lu, lv, hl - lv) - 0.4 + (n(u, v) - 0.5) * 0.6;
    if (e < 0) { t.H[i] = 0; return hex(0x4e4a44); }
    t.H[i] = 0.5 + sst(0, 0.8, e) * 0.5 + n(u, v) * 0.4 + nf(u, v) * 0.2;
    return cor(cl(tons[li * 3 + ci] * 0.5 + n(u, v) * 0.5 + (nf(u, v) - 0.5) * 0.3));
  });
  t.relevo(0.8, 1.1, 0.8); t.grao(0.05);
};
// enxaimel: vigas escuras e reboco claro
PINT[95] = (t) => {
  const n = fbm(9501, 4, 4, 3), veio = veioMadeira(9502, 0x4a3422, 0x2e2016);
  t.cada((u, v, i) => {
    const viga = u < 1.6 || u > 14.4 || v < 1.6 || v > 14.4 || Math.abs(u - v) < 1.1;
    if (viga) { t.H[i] = 1; return veio(u + v, u - v, 0).c; }
    t.H[i] = n(u, v) * 0.3;
    return esc(mix(hex(0xd8cfbc), hex(0xe8e0cc), n(u, v)), 1);
  });
  t.relevo(0.7, 1, 0.6); t.grao(0.05);
};
// estandarte: tecido vermelho com faixa dourada e dobras
PINT[96] = (t) => {
  const n = fbm(9601, 2, 1, 3);
  t.cada((u, v, i) => {
    const dobra = Math.sin(u * 0.9 + n(u, v) * 3);
    t.H[i] = dobra * 0.6 + (fr(u * 2.5) < 0.5 ? 0.03 : 0) + (fr(v * 2.5) < 0.5 ? 0.03 : 0);
    const c = Math.abs(u - 8) < 1.6 ? hex(0xc89a36) : Math.abs(u - 8) < 1.9 ? hex(0x6a4a1a) : hex(0x8e2a24);
    return esc(c, 0.9 + dobra * 0.12);
  });
  t.relevo(0.6, 0.4, 1); t.grao(0.04);
};
// vitral: vidro colorido entre filetes de chumbo
PINT[97] = (t) => {
  const pc = voronoi(9701, 3, 3, 0.8), n = fbm(9702, 6, 6, 2);
  const cores = [0xb0322a, 0x2e58a8, 0xd0a42e, 0x3e8a44, 0x7a3a8a].map(hex);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    const q = pc(u, v);
    if (b < 0.8 || q.borda < 0.2) { t.H[i] = 1; return [58, 54, 50, 1]; }
    t.H[i] = 0;
    return [...esc(cores[q.id % cores.length], 0.85 + n(u, v) * 0.35), 0.67];
  });
  t.relevo(0.6, 0.4, 0.4);
};
// tijolo de fábrica: escuro, com fuligem
PINT[98] = (t) => {
  const r = rngSemente(9801);
  const tons = Array.from({ length: 32 }, () => r());
  const n = fbm(9802, 4, 4, 4), nf = fbm(9803, 16, 16, 2), fu = fbm(9804, 2, 2, 3);
  t.cada((u, v, i) => {
    const lin = Math.floor(v / 2.667), lv = v - lin * 2.667, desl = lin % 2 ? 2.667 : 0;
    const uu = (u + desl) % 16, col = Math.floor(uu / 5.333), lu = uu - col * 5.333;
    const e = Math.min(lu - 0.3, 5.03 - lu, lv - 0.3, 2.367 - lv) + (n(u, v) - 0.5) * 0.3;
    if (e < 0) { t.H[i] = 0; return hex(0x4a4440); }
    t.H[i] = 0.5 + sst(0, 0.3, e) * 0.3 + nf(u, v) * 0.15;
    const c = mix(hex(0x5a2a20), hex(0x7a3a2a), tons[lin * 3 + col] * 0.7 + n(u, v) * 0.4);
    return mix(c, hex(0x2a2220), cl(fu(u, v) * 1.4 - 0.6));
  });
  t.relevo(0.8, 1.2, 0.5); t.grao(0.05);
};
// chapa de ferro: placas rebitadas com ferrugem
PINT[99] = (t) => {
  metal(t, 9901, 0x767c82, { rebites: false });
  const fe = fbm(9902, 3, 3, 4), sc = fbm(9903, 6, 1, 2);
  t.cada((u, v, i) => {
    let h = t.H[i];
    if (Math.abs(v - 8) < 0.25) h -= 0.4;
    for (const ru of [1.5, 5.5, 10.5, 14.5]) for (const rv of [1.5, 6.5, 9.5, 14.5]) {
      const d = Math.hypot(u - ru, v - rv); if (d < 0.5) h = 0.8 + Math.sqrt(1 - (d / 0.5) ** 2) * 0.4;
    }
    t.H[i] = h;
    const fer = cl(fe(u, v) * 1.8 - 0.95 + sc(u, v) * 0.3 * (v / 16));
    return mix(t.cor(i), hex(0x8a4a24), fer);
  });
  t.relevo(0.8, 0.8, 0.6); t.grao(0.04);
};
// engrenagem em placa escura
PINT[100] = (t) => {
  metal(t, 10001, 0x4a4e54, { rebites: false });
  t.cada((u, v, i) => {
    const dx = u - 8, dy = v - 8, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const dente = fr(a / TAU * 10) < 0.5 ? 6.6 : 5.4;
    if (d > dente) return null;
    if (d < 1.2) { t.H[i] = 0.2; return hex(0x1e2024); }
    const furo = d > 2.6 && d < 4.2 && fr(a / TAU * 5) < 0.45;
    if (furo) { t.H[i] = 0.2; return hex(0x24272c); }
    t.H[i] = 1.2 + (d < 2.4 ? 0.2 : 0);
    return mix(hex(0x8a6a34), hex(0xb89048), 0.5 + 0.5 * Math.cos(a - 2.3));
  });
  t.relevo(0.9, 1, 0.6); t.grao(0.04);
};
// bloco de carvão: pedaços pretos brilhantes
PINT[101] = (t) => {
  const pc = voronoi(10101, 5, 5, 0.9), nf = fbm(10102, 12, 12, 2);
  t.cada((u, v, i) => {
    const q = pc(u, v);
    if (q.borda < 0.12) { t.H[i] = 0; return hex(0x0c0c0c); }
    const fa = Math.floor((Math.atan2(q.dy, q.dx) + Math.PI) / TAU * 5);
    const k = 0.6 + ((fa * 0.37 + q.val) % 1) * 0.6;
    t.H[i] = 0.4 + sst(0.12, 0.6, q.borda) * 0.6;
    return esc(mix(hex(0x1c1c1e), hex(0x3a3a3e), nf(u, v)), k);
  });
  t.relevo(0.9, 1, 0.6); t.grao(0.05);
};
// concreto: cinza com poros e marcas de forma
PINT[102] = (t) => {
  const n = fbm(10201, 3, 3, 4), po = voronoi(10202, 14, 14, 0.9);
  t.cada((u, v, i) => {
    let c = mix(hex(0x96948e), hex(0xb0aea8), n(u, v));
    let h = n(u, v) * 0.3;
    const q = po(u, v);
    if (q.val < 0.12 && q.d1 < 0.12 + q.val2 * 0.12) { c = esc(c, 0.75); h -= 0.25; }
    if (Math.abs(v - 8) < 0.12) { c = esc(c, 0.92); }
    t.H[i] = h;
    return c;
  });
  t.relevo(0.5, 0.8, 0.5); t.grao(0.06);
};
// asfalto: agregado miúdo
function asfalto(t, sem) {
  const n = fbm(sem, 3, 3, 3), ag = voronoi(sem + 1, 18, 18, 0.9);
  t.cada((u, v, i) => {
    let c = mix(hex(0x2c2c2e), hex(0x3c3c3e), n(u, v));
    const q = ag(u, v);
    let h = 0;
    if (q.d1 < 0.28 && q.val < 0.5) { c = esc(mix(hex(0x4a4a4c), hex(0x6a6866), q.val2), 1); h = 0.3; }
    t.H[i] = h + n(u, v) * 0.2;
    return c;
  });
}
PINT[103] = (t) => { asfalto(t, 10301); t.relevo(0.6, 0.8, 0.4); t.grao(0.06); };
PINT[104] = (t) => {
  asfalto(t, 10301);
  const n = fbm(10401, 8, 8, 2);
  t.cada((u, v, i) => {
    if (Math.abs(u - 8) < 1 && fr(v / 8) < 0.62) return mix(t.cor(i), hex(0xe2e0d6), cl(0.95 - (0.4 - n(u, v)) * 2));
    return null;
  });
  t.relevo(0.4, 0.4, 0.4); t.grao(0.04);
};
// janela azul: caixilho e vidro azulado
PINT[105] = (t) => {
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1) { t.H[i] = 1; return [...esc(hex(0xc8ccd2), 0.9 + b * 0.15), 1]; }
    t.H[i] = 0;
    const ref = Math.abs(u - v + 3) < 1.2 || Math.abs(u - v - 2) < 0.4 ? 1.35 : 1;
    return [...esc(mix(hex(0x5a8ab0), hex(0x86b4d4), v / 16), ref), 0.6];
  });
  t.relevo(0.6, 0.3, 0.4, (i) => t.A[i] > 0.9);
};
// azulejo: padrão original azul e branco, esmaltado
PINT[106] = (t) => {
  const n = fbm(10601, 6, 6, 2);
  t.cada((u, v, i) => {
    const lu = fr(u / 8) * 8, lv = fr(v / 8) * 8;
    const e = Math.min(lu, 8 - lu, lv, 8 - lv);
    if (e < 0.22) { t.H[i] = 0; return hex(0xc8c4bc); }
    t.H[i] = 0.4 + sst(0.22, 0.6, e) * 0.2;
    const dx = Math.abs(lu - 4), dy = Math.abs(lv - 4), d = Math.hypot(dx, dy);
    const petala = Math.abs(d - 2.2 - Math.cos(Math.atan2(dy, dx) * 4) * 0.8) < 0.45;
    const canto = Math.hypot(Math.min(lu, 8 - lu), Math.min(lv, 8 - lv)) < 1.6;
    const azul = petala || d < 0.7 || canto;
    return azul ? esc(mix(hex(0x1e3c84), hex(0x3a5aa8), n(u, v)), 1) : mix(hex(0xe8ecf0), hex(0xf6f8fa), n(u, v));
  });
  t.relevo(0.5, 0.8, 0.3); t.grao(0.02);
};
// LED: painel com difusor
PINT[107] = (t) => {
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1.6) { t.H[i] = 0.8; return esc(hex(0xa8acb2), 0.9 + b * 0.08); }
    t.H[i] = 0;
    return mix(hex(0xe8f0f8), hex(0xffffff), cl(b / 5));
  });
  t.relevo(0.6, 0.4, 0.4, (i) => t.H[i] > 0.3);
};
// painel solar (topo), lateral de alumínio, metal branco
PINT[108] = (t) => {
  const n = fbm(10801, 4, 4, 2);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 0.8) { t.H[i] = 1; return hex(0xb8bcc4); }
    const lu = fr(u / 4) * 4, lv = fr(v / 4) * 4;
    if (Math.min(lu, 4 - lu, lv, 4 - lv) < 0.18) { t.H[i] = 0.3; return hex(0xa0a8b4); }
    t.H[i] = 0.2;
    const fio = Math.abs(lu - 2) < 0.06 ? 1.6 : 1;
    const ref = (u + v) > 10 && (u + v) < 13 ? 1.2 : 1;
    return esc(mix(hex(0x14244c), hex(0x223a6e), n(u, v)), fio * ref);
  });
  t.relevo(0.6, 0.6, 0.4);
};
PINT[109] = (t) => { metal(t, 10901, 0xc4c8ce, { rebites: false }); t.cada((u, v, i) => { if (Math.abs(v - 8) < 0.3) { t.H[i] = 0.2; } return null; }); t.relevo(0.6, 0.6, 0.5); t.grao(0.02); };
PINT[110] = (t) => {
  metal(t, 11001, 0xe2e4e8, { rebites: false, chanfro: 0.6 });
  t.cada((u, v, i) => { if (Math.abs(u - 8) < 0.15 || Math.abs(v - 8) < 0.15) t.H[i] = 0.1; return null; });
  t.relevo(0.5, 0.6, 0.4); t.grao(0.015);
};
// neon: tubo ciano em moldura escura
PINT[111] = (t) => {
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1.6) { t.H[i] = 0.8; return esc(hex(0x2c2c3a), 0.9 + b * 0.1); }
    const d = Math.abs(b - 4.5);
    t.H[i] = 0;
    if (d < 1) return mix(hex(0x40e8d8), hex(0xe0fffc), 1 - d);
    return mix(hex(0x16202a), hex(0x2a6a6a), cl(1 - (d - 1) / 3) * 0.8);
  });
  t.relevo(0.6, 0.4, 0.4, (i) => t.H[i] > 0.3);
};
// cristal: facetas roxas
PINT[112] = (t) => {
  const r = rngSemente(11201);
  const tons = Array.from({ length: 8 }, () => r());
  t.cada((u, v, i) => {
    const dx = u - 8, dy = v - 8;
    const dm = Math.abs(dx) * 1.6 + Math.abs(dy);
    if (dm > 9) return [...hex(0x8a5ac8), 0.38];
    const f = (dx > 0 ? 1 : 0) + (dy > 0 ? 2 : 0) + (Math.abs(dx) * 1.6 > Math.abs(dy) ? 4 : 0);
    t.H[i] = 0;
    const c = mix(hex(0x7a3ab0), hex(0xd8b0ff), tons[f] * 0.8 + (1 - dm / 9) * 0.3);
    return [...c, 1];
  });
  t.carimbo(6, 5, 1.2, (i, dx, dy) => { if (Math.hypot(dx, dy) < 0.6) t.set(i, hex(0xf8f0ff)); });
};

// ---------- mecanismos das construções (41..47, 120) e bancada (128, 129) ----------
const veioPorta = veioMadeira(4101, 0xa0703e, 0x6a4524);
PINT[41] = (t) => {
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1) { t.H[i] = 1; return veioMadeira(4102, 0x5e3c20, 0x3e2614)(v, u, 0).c; }
    if (Math.abs(v - 4.5) < 0.9 || Math.abs(v - 11.5) < 0.9) { t.H[i] = 0.9; return esc(veioPorta(u * 0.3, v * 3, 2).c, 0.75); }
    const tb = Math.floor(u / 3.5), lu = u - tb * 3.5;
    t.H[i] = 0.5 * sst(0, 0.4, Math.min(lu, 3.5 - lu));
    return esc(veioPorta(v, u * 1.2, tb).c, 0.92 + (tb % 2) * 0.08);
  });
  t.carimbo(12.3, 8, 1, (i, dx, dy) => { const d = Math.hypot(dx, dy); if (d < 0.7) { t.H[i] = 1.4 + (1 - d) * 0.5; t.set(i, mix(hex(0x9a7420), hex(0xf0cc60), 1 - d / 0.7)); } });
  t.relevo(0.7, 0.9, 0.6);
};
PINT[42] = (t) => {
  const veio = veioMadeira(4201, 0x9c6a3a, 0x6a4524);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    t.H[i] = b < 1 ? 1 : 0.4;
    let c = b < 1 ? hex(0x5a3a1e) : veio(u, v, 0).c;
    const dx = u - 8, dy = v - 8, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const raio = 5 + (fr(a / TAU * 8) < 0.5 ? 1.2 : 0);
    if (d < raio) { t.H[i] = d < 1.5 ? 0.6 : 1.3; c = d < 1.5 ? hex(0x46464c) : mix(hex(0x7c828a), hex(0xbcc2ca), 0.5 + 0.5 * Math.cos(a + 2.3)); }
    return c;
  });
  t.relevo(0.8, 0.9, 0.6);
};
PINT[43] = (t) => {
  const n = fbm(4301, 4, 4, 3);
  t.cada((u, v, i) => {
    const d = Math.hypot(u - 8, v - 8), a = Math.atan2(v - 8, u - 8);
    if (d < 1.5) { t.H[i] = -0.5; return hex(0x3c3228); }
    const sulco = Math.abs(Math.sin(a * 4 + d * 0.25)) < 0.16;
    t.H[i] = (sulco ? -0.3 : 0.3) + n(u, v) * 0.6;
    return esc(mix(hex(0x8a8880), hex(0xaaa69c), n(u, v)), sulco ? 0.72 : 1);
  });
  t.relevo(0.8, 1, 0.6);
};
PINT[44] = (t) => {
  const veio = veioMadeira(4401, 0x8a5a30, 0x5a3a1e);
  t.cada((u, v, i) => {
    if (u >= 6 && u <= 10) { const k = Math.cos((u - 8) / 2 * Math.PI / 2); t.H[i] = 1 + k * 0.6; return mix(hex(0x7a3b22), hex(0xd8783a), k); }
    t.H[i] = 0.4;
    if (fr(v / 5) < 0.12 && (Math.abs(u - 5.3) < 0.6 || Math.abs(u - 10.7) < 0.6)) { t.H[i] = 1.2; return hex(0x5a5a60); }
    return veio(v, u * 2, 0).c;
  });
  t.relevo(0.7, 0.8, 0.6);
};
function fornoTile(t, aceso) {
  const n = fbm(4501, 4, 4, 3), r = rngSemente(4502);
  const tons = Array.from({ length: 16 }, () => r());
  t.cada((u, v, i) => {
    const boca = v > 6.5 && v < 15 && Math.abs(u - 8) < 4.5 && !(v < 9.5 && Math.hypot(u - 8, v - 9.5) > 4.5);
    if (boca) {
      t.H[i] = -1;
      if (!aceso) return esc(hex(0x221c1a), 1 - (15 - v) * 0.02);
      const k = cl((v - 7) / 8);
      return mix(hex(0xd04a14), hex(0xffd878), k * k + n(u * 2, v) * 0.3);
    }
    const lin = Math.floor(v / 4), desl = lin % 2 ? 4 : 0, uu = (u + desl) % 16, col = Math.floor(uu / 8);
    const e = Math.min(uu - col * 8, 8 - (uu - col * 8), v - lin * 4, 4 - (v - lin * 4)) - 0.3;
    if (e < 0) { t.H[i] = 0; return hex(0x5a5650); }
    t.H[i] = 0.5 + sst(0, 0.3, e) * 0.3 + n(u, v) * 0.3;
    return esc(mix(hex(0x8a857c), hex(0xaaa49a), tons[lin * 2 + col] * 0.6 + n(u, v) * 0.4), 1);
  });
  t.relevo(0.8, 1, 0.6, aceso ? (i) => t.H[i] > -0.5 : null);
}
PINT[45] = (t) => fornoTile(t, false);
PINT[46] = (t) => fornoTile(t, true);
PINT[47] = (t) => {
  const n = fbm(4701, 8, 8, 2);
  t.cada((u, v, i) => {
    const trama = (fr(u * 2) < 0.5 ? 0.04 : 0) + (fr(v * 2) < 0.5 ? 0.04 : 0);
    t.H[i] = Math.sin(u / 16 * Math.PI) * 0.8 + trama + n(u, v) * 0.2 - (v < 3 ? 0.2 : 0);
    if (Math.abs(v - 3) < 0.5) { t.H[i] += 0.4; return hex(0xa07a44); }
    if (v > 7.5 && v < 12 && u > 4.5 && u < 11.5) return mix(hex(0xc8a050), hex(0xd8b468), n(u, v));
    return esc(mix(hex(0xe2dac8), hex(0xf2ece0), n(u, v)), 1);
  });
  t.relevo(0.7, 0.7, 1);
};
PINT[120] = (t) => {
  const n = fbm(12001, 6, 6, 2);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1.1) { t.H[i] = 1.2; return esc(hex(0x8a5a30), 0.9 + n(u, v) * 0.2); }
    t.H[i] = (fr((u + v) / 1.2) < 0.5 ? 0.1 : 0);
    return esc(fr((u + v) / 1.2) < 0.5 ? hex(0xb08050) : hex(0x9a6c40), 0.9 + n(u, v) * 0.15);
  });
  for (const [a, b2] of [[5, 5], [10.8, 5.5], [5.5, 10.8], [10.8, 10.8]]) {
    t.elipse(a, b2, 3, 2.3, 0.3, (i, du, dv, d) => {
      t.H[i] = 1 + Math.sqrt(1 - d * d) * 1.6;
      let c = mix(hex(0xb86a28), hex(0xe8b060), 1 - d);
      if (Math.abs(du - 0.1) < 0.08 && d < 0.8) c = hex(0xf0d8a0); // corte em cima do pão
      t.set(i, c);
    });
  }
  t.relevo(0.8, 0.8, 0.8);
};
// bancada: tampo de tábuas com grade de trabalho / lado com gaveta e ferramentas
PINT[128] = (t) => {
  const veio = veioMadeira(12801, 0xb08550, 0x7a5532);
  t.cada((u, v, i) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1) { t.H[i] = 1; return hex(0x6a4828); }
    const gr = u > 4 && u < 12 && v > 4 && v < 12;
    if (gr) {
      const lu = fr((u - 4) / 2.667), lv = fr((v - 4) / 2.667);
      const linha = lu < 0.12 || lv < 0.12;
      t.H[i] = linha ? 0.2 : 0.5;
      return linha ? hex(0x5a3a1e) : esc(veio(u, v, 1).c, 1.06);
    }
    const lv = fr(v / 4);
    t.H[i] = 0.6 * sst(0, 0.1, Math.min(lv, 1 - lv));
    return veio(u, v, Math.floor(v / 4)).c;
  });
  t.relevo(0.7, 0.9, 0.6);
};
PINT[129] = (t) => {
  const veio = veioMadeira(12901, 0xa07848, 0x6e4c2c);
  t.cada((u, v, i) => {
    if (v < 2.5) { t.H[i] = 1; return esc(veio(u, v, 0).c, v > 2 ? 0.7 : 1.05); }
    if (u < 2 || u > 14) { t.H[i] = 1; return esc(veio(v, u, 3).c, 0.8); }
    if (v > 4 && v < 8 && u > 3.5 && u < 12.5) {
      t.H[i] = 0.9;
      if (Math.abs(u - 8) < 1 && Math.abs(v - 6) < 0.5) { t.H[i] = 1.3; return hex(0xc8a040); }
      return esc(veio(u, v, 5).c, 0.95);
    }
    t.H[i] = 0.3;
    return esc(veio(u, v, 2).c, 0.8);
  });
  t.traco(5, 8.8, 5, 13.5, 0.35, 0.3, (i) => { t.H[i] = 1.2; t.set(i, hex(0x8a6038)); });
  t.traco(3.8, 9.3, 6.4, 9.3, 0.5, 0.5, (i) => { t.H[i] = 1.4; t.set(i, hex(0x8c8f96)); });
  t.traco(10.5, 9.5, 10.5, 13.5, 0.35, 0.3, (i) => { t.H[i] = 1.2; t.set(i, hex(0x8a6038)); });
  t.elipse(10.5, 9.4, 1.5, 0.8, 0, (i) => { t.H[i] = 1.4; t.set(i, hex(0x9a9ca2)); });
  t.relevo(0.7, 0.9, 0.6);
};

// ---------- gera o atlas ----------
export const TILES_PINTADOS = Object.keys(PINT).map(Number);
export const TEMPOS = {}; // ms por tile na última geração (para medir)
const PARCIAL = new Set([10, 97, 105, 112]); // tiles com transparência parcial (o resto é recorte 0/1)

// devolve os bytes RGBA do atlas com tiles de T pixels (T = 32 ou 64; 16 sai de reduzir(32))
// lista = só esses tiles (para dividir o trabalho entre workers); o resto fica transparente
export function pintarAtlas(T, lista = null) {
  const W = COLS_ATLAS * T, Hh = LINHAS_ATLAS * T;
  const out = new Uint8ClampedArray(W * Hh * 4);
  const t = criarCtx(T);
  for (const idx of lista || TILES_PINTADOS) {
    if (!PINT[idx]) continue;
    const t0 = performance.now();
    t.reset(idx * 7919 + 13);
    PINT[idx](t);
    TEMPOS[idx] = performance.now() - t0;
    const ox = (idx % COLS_ATLAS) * T, oy = Math.floor(idx / COLS_ATLAS) * T;
    const parcial = PARCIAL.has(idx);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = y * T + x, j = ((oy + y) * W + ox + x) * 4;
      out[j] = t.R[i]; out[j + 1] = t.G[i]; out[j + 2] = t.B[i];
      const a = t.A[i];
      out[j + 3] = parcial ? a * 255 : a >= 0.5 ? 255 : 0;
    }
  }
  return out;
}

// reduz pela metade (média 2x2 ponderada pelo alfa) e dá um pouco de nitidez, tile por tile
export function reduzir(src, T) {
  const T2 = T / 2, W = COLS_ATLAS * T, W2 = COLS_ATLAS * T2, H2 = LINHAS_ATLAS * T2;
  const out = new Uint8ClampedArray(W2 * H2 * 4);
  const tmp = new Float32Array(T2 * T2 * 4);
  for (let idx = 0; idx < COLS_ATLAS * LINHAS_ATLAS; idx++) {
    const ox = (idx % COLS_ATLAS) * T, oy = Math.floor(idx / COLS_ATLAS) * T;
    const parcial = PARCIAL.has(idx);
    for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const j = ((oy + y * 2 + dy) * W + ox + x * 2 + dx) * 4, w = src[j + 3] / 255 + 1e-4;
        r += src[j] * w; g += src[j + 1] * w; b += src[j + 2] * w; a += w;
      }
      const k = (y * T2 + x) * 4;
      tmp[k] = r / a; tmp[k + 1] = g / a; tmp[k + 2] = b / a; tmp[k + 3] = a / 4;
    }
    const ox2 = (idx % COLS_ATLAS) * T2, oy2 = Math.floor(idx / COLS_ATLAS) * T2;
    for (let y = 0; y < T2; y++) for (let x = 0; x < T2; x++) {
      const k = (y * T2 + x) * 4, j = ((oy2 + y) * W2 + ox2 + x) * 4;
      // nitidez: realça a diferença para a média dos 4 vizinhos (dando a volta no tile)
      const viz = [((y + T2 - 1) % T2) * T2 + x, ((y + 1) % T2) * T2 + x, y * T2 + (x + T2 - 1) % T2, y * T2 + (x + 1) % T2];
      for (let c = 0; c < 3; c++) {
        let m = 0; for (const q of viz) m += tmp[q * 4 + c];
        out[j + c] = tmp[k + c] + (tmp[k + c] - m / 4) * 0.2;
      }
      const a = tmp[k + 3];
      out[j + 3] = parcial ? a * 255 : a >= 0.5 ? 255 : 0;
    }
  }
  return out;
}

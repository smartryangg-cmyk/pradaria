// Formas que não são cubos: malha (redonda de verdade), colisão, mira e ícones.
// A colisão segue a forma: dá para subir na rampa andando, ficar em cima da bola,
// passar entre as cercas só onde tem abertura, e a cerca é alta (1,5) para ninguém pular.
import { BLOCOS, OPACO, SOLIDO, BRILHO, uvTile, COLS, TILE, ICONES_ESPECIAIS } from './blocos.js';
import { F, ehForma, baseForma } from './formas-defs.js';

export { F, ehForma };
export const FORMA_NOVA = new Uint8Array(256);
for (let b = 80; b <= 99; b++) FORMA_NOVA[b] = 1;

const TRONCOS = new Set([F.TRONCO_R, F.TRONCO_R_PINHEIRO, F.TRONCO_R_BETULA]);
const ehTronco = (b) => TRONCOS.has(b);
// com o que a cerca, o vidro fino e o cano se ligam
const cheio = (b) => OPACO[b] && SOLIDO[b];
const ligaCerca = (b) => b === F.CERCA || cheio(b);
const ligaVidro = (b) => b === F.VIDRO_FINO || cheio(b);
const ligaCano = (b) => b === F.CANO;
const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------- giro das peças com direção (0: +x, 1: +z, 2: -x, 3: -z) ----------
function girarP(d, x, z) {
  switch (d & 3) {
    case 1: return [1 - z, x];
    case 2: return [1 - x, 1 - z];
    case 3: return [z, 1 - x];
    default: return [x, z];
  }
}
function girarN(d, nx, nz) {
  switch (d & 3) {
    case 1: return [-nz, nx];
    case 2: return [-nx, -nz];
    case 3: return [nz, -nx];
    default: return [nx, nz];
  }
}
function girarCaixa(d, c) {
  const [ax, az] = girarP(d, c[0], c[2]), [bx, bz] = girarP(d, c[3], c[5]);
  return [Math.min(ax, bx), c[1], Math.min(az, bz), Math.max(ax, bx), c[4], Math.max(az, bz)];
}

// ---------- montagem da malha ----------
// A: arrays do gerador de malha { P, U, C, I, N, O, L, BD }. Coordenadas locais da célula (0..1).
class Pincel {
  constructor(A, x, y, z, cor, luz, d = 0) { this.A = A; this.x = x; this.y = y; this.z = z; this.cor = cor; this.luz = luz; this.d = d; }
  v(px, py, pz, nx, ny, nz, u, w) {
    const A = this.A;
    if (this.d) { [px, pz] = girarP(this.d, px, pz); [nx, nz] = girarN(this.d, nx, nz); }
    A.P.push(this.x + px, this.y + py, this.z + pz);
    A.N.push(nx, ny, nz); A.U.push(u, w);
    A.C.push(this.cor, this.cor, this.cor); A.O.push(0); A.L.push(this.luz); A.BD.push(0);
  }
  quad() { const k = this.A.P.length / 3; this.A.I.push(k - 4, k - 3, k - 2, k - 4, k - 2, k - 1); }
  tri() { const k = this.A.P.length / 3; this.A.I.push(k - 3, k - 2, k - 1); }
}
const sub = (t, s0, s1, w0, w1) => [t[0] + (t[2] - t[0]) * s0, t[1] + (t[3] - t[1]) * w0, t[0] + (t[2] - t[0]) * s1, t[1] + (t[3] - t[1]) * w1];

// caixa com textura recortada do tamanho da face; `tapa(i)` diz se a face i (como FACES) está escondida
function caixa(p, x0, y0, z0, x1, y1, z1, tile, tapa = null) {
  const t = uvTile(tile);
  const faces = [
    [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1 - z1, 1 - z0, y0, y1]],
    [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [z0, z1, y0, y1]],
    [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [x0, x1, 1 - z1, 1 - z0]],
    [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [x0, x1, z0, z1]],
    [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [x0, x1, y0, y1]],
    [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [1 - x1, 1 - x0, y0, y1]],
  ];
  faces.forEach(([n, c, r], i) => {
    if (tapa && tapa(i)) return;
    const [u0, v0, u1, v1] = sub(t, clamp(r[0]), clamp(r[1]), clamp(r[2]), clamp(r[3]));
    const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    c.forEach((q, j) => p.v(q[0], q[1], q[2], n[0], n[1], n[2], uv[j][0], uv[j][1]));
    p.quad();
  });
}
const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// cilindro em pé (eixo y), centro (cx, cz). Cada gomo usa 1/4 da largura do tile (casca não estica).
function cilindro(p, cx, cz, r, y0, y1, tLado, tTopo, tampaCima, tampaBaixo, seg = 12) {
  const tl = uvTile(tLado), tt = uvTile(tTopo);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const q = i % 4;
    const [u0, v0, u1, v1] = sub(tl, q / 4, (q + 1) / 4, y0 % 1 || 0, y1 > 1 ? 1 : y1);
    p.v(cx + r * c1, y0, cz + r * s1, c1, 0, s1, u0, v0);
    p.v(cx + r * c0, y0, cz + r * s0, c0, 0, s0, u1, v0);
    p.v(cx + r * c0, y1, cz + r * s0, c0, 0, s0, u1, v1);
    p.v(cx + r * c1, y1, cz + r * s1, c1, 0, s1, u0, v1);
    p.quad();
    const uc = (tt[0] + tt[2]) / 2, vc = (tt[1] + tt[3]) / 2, hu = (tt[2] - tt[0]) / 2, hv = (tt[3] - tt[1]) / 2;
    if (tampaCima) {
      p.v(cx, y1, cz, 0, 1, 0, uc, vc);
      p.v(cx + r * c1, y1, cz + r * s1, 0, 1, 0, uc + c1 * hu, vc - s1 * hv);
      p.v(cx + r * c0, y1, cz + r * s0, 0, 1, 0, uc + c0 * hu, vc - s0 * hv);
      p.tri();
    }
    if (tampaBaixo) {
      p.v(cx, y0, cz, 0, -1, 0, uc, vc);
      p.v(cx + r * c0, y0, cz + r * s0, 0, -1, 0, uc + c0 * hu, vc + s0 * hv);
      p.v(cx + r * c1, y0, cz + r * s1, 0, -1, 0, uc + c1 * hu, vc + s1 * hv);
      p.tri();
    }
  }
}

// pedaço de esfera (centro c, raio r) entre as latitudes lat0..lat1 (radianos)
function esfera(p, cx, cy, cz, r, lat0, lat1, tile, nLon = 12, nLat = 8, tileInteiro = false) {
  const t = uvTile(tile);
  for (let j = 0; j < nLat; j++) {
    const f0 = lat0 + (lat1 - lat0) * (j / nLat), f1 = lat0 + (lat1 - lat0) * ((j + 1) / nLat);
    for (let i = 0; i < nLon; i++) {
      const a0 = (i / nLon) * Math.PI * 2, a1 = ((i + 1) / nLon) * Math.PI * 2;
      const pt = (a, f) => [Math.cos(f) * Math.cos(a), Math.sin(f), Math.cos(f) * Math.sin(a)];
      const q = [pt(a1, f0), pt(a0, f0), pt(a0, f1), pt(a1, f1)];
      const [u0, v0, u1, v1] = tileInteiro ? t : sub(t, (i % 4) / 4, (i % 4 + 1) / 4, (j % 2) / 2, (j % 2 + 1) / 2);
      const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
      q.forEach((n, k) => p.v(cx + n[0] * r, cy + n[1] * r, cz + n[2] * r, n[0], n[1], n[2], uv[k][0], uv[k][1]));
      p.quad();
    }
  }
}

// cilindro deitado no eixo x ou z (para o cano e a roda): faz em pé e troca os eixos
function cilindroDeitado(A, x, y, z, cor, luz, eixo, r, a0, a1, tLado, tTopo, tampas, seg = 10) {
  const T = { A: { P: [], N: [], U: [], C: [], O: [], L: [], BD: [], I: [] } };
  const p = new Pincel(T.A, 0, 0, 0, cor, luz);
  cilindro(p, 0.5, 0.5, r, a0, a1, tLado, tTopo, tampas, tampas, seg);
  const S = T.A, k0 = A.P.length / 3;
  for (let i = 0; i < S.P.length; i += 3) {
    const [px, py, pz] = [S.P[i], S.P[i + 1], S.P[i + 2]], [nx, ny, nz] = [S.N[i], S.N[i + 1], S.N[i + 2]];
    // troca cíclica (não espelha, então as faces continuam viradas para fora)
    if (eixo === 'x') { A.P.push(x + py, y + pz, z + px); A.N.push(ny, nz, nx); }
    else { A.P.push(x + pz, y + px, z + py); A.N.push(nz, nx, ny); }
  }
  A.U.push(...S.U); A.C.push(...S.C); A.O.push(...S.O); A.L.push(...S.L); A.BD.push(...S.BD);
  for (const i of S.I) A.I.push(i + k0);
}

// de que lado a roda fica de pé: encostada em algo sólido no eixo x => eixo x
function eixoRoda(get, x, y, z) {
  return SOLIDO[get(x + 1, y, z)] || SOLIDO[get(x - 1, y, z)] ? 'x' : 'z';
}
// ligações do cano (6 lados)
const V6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function ligacoesCano(get, x, y, z) {
  return V6.map(([dx, dy, dz]) => ligaCano(get(x + dx, y + dy, z + dz)));
}

// cor (luz do céu) vem do gerador de malha; luz própria do bloco = BRILHO
export function desenharFormaNova(A, get, x, y, z, b, cor = 1) {
  const def = BLOCOS[b];
  const luz = BRILHO[b];
  const base = baseForma(b);
  const p = new Pincel(A, x, y, z, cor, luz);
  const tapado = (dx, dy, dz) => OPACO[get(x + dx, y + dy, z + dz)];
  switch (def.forma) {
    case 'tronco': {
      const cima = get(x, y + 1, z), baixo = get(x, y - 1, z);
      cilindro(p, 0.5, 0.5, 0.4, 0, 1, def.tiles[2], def.tiles[0], !ehTronco(cima) && !OPACO[cima], !ehTronco(baixo) && !OPACO[baixo]);
      break;
    }
    case 'coluna': {
      const cima = get(x, y + 1, z), baixo = get(x, y - 1, z);
      // base e capitel quadrados quando a coluna começa ou termina
      const ini = cima !== b, fim = baixo !== b;
      const y0 = fim ? 0.12 : 0, y1 = ini ? 0.88 : 1;
      cilindro(p, 0.5, 0.5, 0.36, y0, y1, def.tiles[2], def.tiles[0], false, false);
      if (fim) caixa(p, 0.06, 0, 0.06, 0.94, 0.12, 0.94, def.tiles[2], (i) => i === 3 && tapado(0, -1, 0));
      if (ini) caixa(p, 0.06, 0.88, 0.06, 0.94, 1, 0.94, def.tiles[2], (i) => i === 2 && tapado(0, 1, 0));
      break;
    }
    case 'cerca': {
      cilindro(p, 0.5, 0.5, 0.13, 0, 1, def.tiles[2], def.tiles[0], !(get(x, y + 1, z) === b), get(x, y - 1, z) !== b && !tapado(0, -1, 0), 8);
      for (const [dx, dz] of H4) {
        if (!ligaCerca(get(x + dx, y, z + dz))) continue;
        const xa = dx > 0 ? 0.6 : dx < 0 ? 0 : 0.44, xb = dx > 0 ? 1 : dx < 0 ? 0.4 : 0.56;
        const za = dz > 0 ? 0.6 : dz < 0 ? 0 : 0.44, zb = dz > 0 ? 1 : dz < 0 ? 0.4 : 0.56;
        caixa(p, xa, 0.38, za, xb, 0.52, zb, def.tiles[2]);
        caixa(p, xa, 0.74, za, xb, 0.88, zb, def.tiles[2]);
      }
      break;
    }
    case 'vidrofino': {
      const lig = H4.map(([dx, dz]) => ligaVidro(get(x + dx, y, z + dz)));
      const nenhum = !lig.some(Boolean);
      const e = 0.06;
      const t = def.tiles[2];
      // o vidro inteiro de cada lado usa o tile todo (moldura + reflexo)
      if (nenhum || lig[0] || lig[1]) {
        const xa = nenhum || lig[1] ? 0 : 0.5 - e, xb = nenhum || lig[0] ? 1 : 0.5 + e;
        caixa(p, xa, 0, 0.5 - e, xb, 1, 0.5 + e, t, (i) => (i === 0 && xb === 1 && tapado(1, 0, 0)) || (i === 1 && xa === 0 && tapado(-1, 0, 0)));
      }
      if (lig[2] || lig[3]) {
        const za = lig[3] ? 0 : 0.5 - e, zb = lig[2] ? 1 : 0.5 + e;
        caixa(p, 0.5 - e, 0, za, 0.5 + e, 1, zb, t, (i) => (i === 4 && zb === 1 && tapado(0, 0, 1)) || (i === 5 && za === 0 && tapado(0, 0, -1)));
      }
      break;
    }
    case 'cano': {
      const lig = ligacoesCano(get, x, y, z);
      const nx = lig[0] || lig[1], ny = lig[2] || lig[3], nz = lig[4] || lig[5];
      const r = 0.2, t = def.tiles[2];
      const eixos = (nx ? 1 : 0) + (ny ? 1 : 0) + (nz ? 1 : 0);
      if (eixos <= 1) {
        // reto: atravessa a célula inteira no eixo ligado (em pé se não ligar em nada)
        if (nx) cilindroDeitado(A, x, y, z, cor, luz, 'x', r, 0, 1, t, t, false);
        else if (nz) cilindroDeitado(A, x, y, z, cor, luz, 'z', r, 0, 1, t, t, false);
        else cilindro(p, 0.5, 0.5, r, 0, 1, t, t, !lig[2], !lig[3], 10);
      } else {
        // curva/cruzamento: uma junta no meio e um braço para cada lado ligado
        caixa(p, 0.5 - r - 0.03, 0.5 - r - 0.03, 0.5 - r - 0.03, 0.5 + r + 0.03, 0.5 + r + 0.03, 0.5 + r + 0.03, t);
        if (lig[0]) cilindroDeitado(A, x, y, z, cor, luz, 'x', r, 0.5, 1, t, t, false);
        if (lig[1]) cilindroDeitado(A, x, y, z, cor, luz, 'x', r, 0, 0.5, t, t, false);
        if (lig[2]) cilindro(p, 0.5, 0.5, r, 0.5, 1, t, t, false, false, 10);
        if (lig[3]) cilindro(p, 0.5, 0.5, r, 0, 0.5, t, t, false, false, 10);
        if (lig[4]) cilindroDeitado(A, x, y, z, cor, luz, 'z', r, 0.5, 1, t, t, false);
        if (lig[5]) cilindroDeitado(A, x, y, z, cor, luz, 'z', r, 0, 0.5, t, t, false);
      }
      break;
    }
    case 'bola':
      esfera(p, 0.5, 0.5, 0.5, 0.5, -Math.PI / 2, Math.PI / 2, def.tiles[2]);
      break;
    case 'cupula': {
      const vidro = b === F.CUPULA_VIDRO;
      esfera(p, 0.5, 0, 0.5, 0.5, 0, Math.PI / 2, def.tiles[2], 12, vidro ? 4 : 6, vidro);
      // fundo (só aparece se não estiver em cima de bloco cheio)
      if (!tapado(0, -1, 0) && !vidro) cilindro(p, 0.5, 0.5, 0.5, 0, 0.001, def.tiles[2], def.tiles[2], false, true);
      break;
    }
    case 'laje':
      caixa(p, 0, 0, 0, 1, 0.5, 1, def.tiles[2], (i) => i !== 2 && tapadoFace(get, x, y, z, i));
      break;
    case 'rampa': {
      const d = b - F.RAMPA;
      const q = new Pincel(A, x, y, z, cor, luz, d);
      const t = uvTile(def.tiles[2]);
      const [u0, v0, u1, v1] = t, du = u1 - u0, dv = v1 - v0;
      const rotTapa = (i) => tapadoFace(get, x, y, z, faceGirada(d, i));
      // fundo
      if (!rotTapa(3)) { q.v(0, 0, 0, 0, -1, 0, u0, v0); q.v(1, 0, 0, 0, -1, 0, u1, v0); q.v(1, 0, 1, 0, -1, 0, u1, v1); q.v(0, 0, 1, 0, -1, 0, u0, v1); q.quad(); }
      // parede alta (+x)
      if (!rotTapa(0)) { q.v(1, 0, 1, 1, 0, 0, u0, v0); q.v(1, 0, 0, 1, 0, 0, u1, v0); q.v(1, 1, 0, 1, 0, 0, u1, v1); q.v(1, 1, 1, 1, 0, 0, u0, v1); q.quad(); }
      // rampa (normal para cima e para trás)
      const s = Math.SQRT1_2;
      q.v(0, 0, 1, -s, s, 0, u0, v0); q.v(1, 1, 1, -s, s, 0, u1, v0); q.v(1, 1, 0, -s, s, 0, u1, v1); q.v(0, 0, 0, -s, s, 0, u0, v1); q.quad();
      // laterais triangulares
      if (!rotTapa(4)) { q.v(0, 0, 1, 0, 0, 1, u0, v0); q.v(1, 0, 1, 0, 0, 1, u1, v0); q.v(1, 1, 1, 0, 0, 1, u1, v1); q.tri(); }
      if (!rotTapa(5)) { q.v(1, 0, 0, 0, 0, -1, u0, v0); q.v(0, 0, 0, 0, 0, -1, u1, v0); q.v(1, 1, 0, 0, 0, -1, u0, v1); q.tri(); }
      void du; void dv;
      break;
    }
    case 'escada': {
      const d = b - F.ESCADA;
      const q = new Pincel(A, x, y, z, cor, luz, d);
      caixa(q, 0, 0, 0, 1, 0.5, 1, def.tiles[2], (i) => i !== 2 && i !== 1 && tapadoFace(get, x, y, z, faceGirada(d, i)));
      caixa(q, 0.5, 0.5, 0, 1, 1, 1, def.tiles[2], (i) => i === 3 || (i !== 1 && i !== 2 && tapadoFace(get, x, y, z, faceGirada(d, i))));
      break;
    }
    case 'roda': {
      const eixo = eixoRoda(get, x, y, z);
      const t = def.tiles[2];
      // disco de madeira (16 gomos), raios em cruz saltados e o miolo de metal
      cilindroDeitado(A, x, y, z, cor, luz, eixo, 0.47, 0.42, 0.58, t, t, true, 16);
      const raio = eixo === 'x' ? [[0.4, 0.1, 0.46, 0.6, 0.9, 0.54], [0.4, 0.46, 0.1, 0.6, 0.54, 0.9]]
        : [[0.46, 0.1, 0.4, 0.54, 0.9, 0.6], [0.1, 0.46, 0.4, 0.9, 0.54, 0.6]];
      for (const c of raio) caixa(p, ...c, 21);
      cilindroDeitado(A, x, y, z, cor, luz, eixo, 0.12, 0.36, 0.64, 55, 55, true, 8);
      break;
    }
    default: break;
  }
  void base;
}
// face (na ordem de FACES: +x, -x, +y, -y, +z, -z) de uma peça girada d vezes
function faceGirada(d, i) {
  if (i === 2 || i === 3) return i;
  const n = [[1, 0], [-1, 0], null, null, [0, 1], [0, -1]][i];
  const [nx, nz] = girarN(d, n[0], n[1]);
  return nx > 0 ? 0 : nx < 0 ? 1 : nz > 0 ? 4 : 5;
}
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
function tapadoFace(get, x, y, z, i) { const n = N6[i]; return OPACO[get(x + n[0], y + n[1], z + n[2])]; }

// ---------- colisão ----------
// caixas (locais, 0..1; a cerca vai até 1,5) que cobrem a forma. Para mirar e para colidir
// nas formas "de caixa". As redondas usam o teste exato em colideForma.
export function caixasForma(b, get, x, y, z) {
  const def = BLOCOS[b];
  switch (def.forma) {
    case 'tronco': return [[0.1, 0, 0.1, 0.9, 1, 0.9]];
    case 'coluna': return [[0.06, 0, 0.06, 0.94, 1, 0.94]];
    case 'cerca': case 'vidrofino': {
      const cerca = def.forma === 'cerca';
      const e = cerca ? 0.13 : 0.06, alto = cerca ? 1.5 : 1;
      const out = [[0.5 - e, 0, 0.5 - e, 0.5 + e, alto, 0.5 + e]];
      const lig = H4.map(([dx, dz]) => (cerca ? ligaCerca : ligaVidro)(get(x + dx, y, z + dz)));
      if (!cerca && !lig.some(Boolean)) return [[0, 0, 0.5 - e, 1, 1, 0.5 + e]];
      H4.forEach(([dx, dz], i) => {
        if (!lig[i]) return;
        out.push([dx > 0 ? 0.5 : dx < 0 ? 0 : 0.5 - e, 0, dz > 0 ? 0.5 : dz < 0 ? 0 : 0.5 - e,
          dx > 0 ? 1 : dx < 0 ? 0.5 : 0.5 + e, alto, dz > 0 ? 1 : dz < 0 ? 0.5 : 0.5 + e]);
      });
      return out;
    }
    case 'cano': {
      const lig = ligacoesCano(get, x, y, z), r = 0.23;
      const eixos = (lig[0] || lig[1] ? 1 : 0) + (lig[2] || lig[3] ? 1 : 0) + (lig[4] || lig[5] ? 1 : 0);
      if (eixos <= 1) {
        if (lig[0] || lig[1]) return [[0, 0.5 - r, 0.5 - r, 1, 0.5 + r, 0.5 + r]];
        if (lig[4] || lig[5]) return [[0.5 - r, 0.5 - r, 0, 0.5 + r, 0.5 + r, 1]];
        return [[0.5 - r, 0, 0.5 - r, 0.5 + r, 1, 0.5 + r]];
      }
      const out = [[0.5 - r, 0.5 - r, 0.5 - r, 0.5 + r, 0.5 + r, 0.5 + r]];
      V6.forEach(([dx, dy, dz], i) => {
        if (!lig[i]) return;
        const a = (v) => (v > 0 ? 0.5 : v < 0 ? 0 : 0.5 - r), c = (v) => (v > 0 ? 1 : v < 0 ? 0.5 : 0.5 + r);
        out.push([a(dx), a(dy), a(dz), c(dx), c(dy), c(dz)]);
      });
      return out;
    }
    case 'bola': return [[0, 0, 0, 1, 1, 1]];
    case 'cupula': return [[0, 0, 0, 1, 0.5, 1]];
    case 'laje': return [[0, 0, 0, 1, 0.5, 1]];
    case 'rampa': return [[0, 0, 0, 1, 1, 1]];
    case 'escada': {
      const d = b - F.ESCADA;
      return [[0, 0, 0, 1, 0.5, 1], girarCaixa(d, [0.5, 0.5, 0, 1, 1, 1])];
    }
    case 'roda': return eixoRoda(get, x, y, z) === 'x' ? [[0.38, 0.03, 0.03, 0.62, 0.97, 0.97]] : [[0.03, 0.03, 0.38, 0.97, 0.97, 0.62]];
    default: return [[0, 0, 0, 1, 1, 1]];
  }
}

const sobrepoe = (c, x0, y0, z0, x1, y1, z1) => c[0] < x1 && c[3] > x0 && c[1] < y1 && c[4] > y0 && c[2] < z1 && c[5] > z0;
const dist2Caixa = (cx, cy, cz, x0, y0, z0, x1, y1, z1) => {
  const dx = cx < x0 ? x0 - cx : cx > x1 ? cx - x1 : 0;
  const dy = cy < y0 ? y0 - cy : cy > y1 ? cy - y1 : 0;
  const dz = cz < z0 ? z0 - cz : cz > z1 ? cz - z1 : 0;
  return dx * dx + dy * dy + dz * dz;
};

// a caixa (coordenadas do mundo) encosta na forma do bloco b em (bx, by, bz)?
export function colideForma(b, get, bx, by, bz, x0, y0, z0, x1, y1, z1) {
  // passa para coordenadas locais da célula
  x0 -= bx; x1 -= bx; y0 -= by; y1 -= by; z0 -= bz; z1 -= bz;
  const def = BLOCOS[b];
  switch (def.forma) {
    case 'tronco': case 'coluna': {
      const r = def.forma === 'tronco' ? 0.4 : 0.36;
      if (!(y0 < 1 && y1 > 0)) return false;
      if (def.forma === 'coluna' && ((y0 < 0.12 && get(bx, by - 1, bz) !== b) || (y1 > 0.88 && get(bx, by + 1, bz) !== b))) {
        if (x0 < 0.94 && x1 > 0.06 && z0 < 0.94 && z1 > 0.06) return true; // base/capitel
      }
      const dx = 0.5 < x0 ? x0 - 0.5 : 0.5 > x1 ? 0.5 - x1 : 0, dz = 0.5 < z0 ? z0 - 0.5 : 0.5 > z1 ? 0.5 - z1 : 0;
      return dx * dx + dz * dz < r * r;
    }
    case 'bola': return dist2Caixa(0.5, 0.5, 0.5, x0, y0, z0, x1, y1, z1) < 0.25;
    case 'cupula':
      if (y1 <= 0 || y0 >= 0.5) return false;
      return dist2Caixa(0.5, 0, 0.5, x0, Math.max(0, y0), z0, x1, y1, z1) < 0.25;
    case 'rampa': {
      if (!(x0 < 1 && x1 > 0 && z0 < 1 && z1 > 0 && y1 > 0)) return false;
      // u = quanto a rampa já subiu no ponto mais alto da caixa
      const d = b - F.RAMPA;
      const lo = (a) => Math.max(0, a), hi = (a) => Math.min(1, a);
      const u = d === 0 ? hi(x1) : d === 1 ? hi(z1) : d === 2 ? 1 - lo(x0) : 1 - lo(z0);
      return y0 < u - 0.001;
    }
    default:
      for (const c of caixasForma(b, get, bx, by, bz)) if (sobrepoe(c, x0, y0, z0, x1, y1, z1)) return true;
      return false;
  }
}

// mira: o raio (origem o, direção dir, normalizada) passa pela forma? Retorna {t, n} ou null
export function mirarForma(b, get, bx, by, bz, o, dir) {
  let melhor = null;
  for (const c of caixasForma(b, get, bx, by, bz)) {
    let t0 = -Infinity, t1 = Infinity, n = null;
    const O = [o.x - bx, o.y - by, o.z - bz], D = [dir.x, dir.y, dir.z];
    let ok = true;
    for (let a = 0; a < 3 && ok; a++) {
      const mn = c[a], mx = c[a + 3];
      if (Math.abs(D[a]) < 1e-9) { if (O[a] < mn || O[a] > mx) ok = false; continue; }
      let ta = (mn - O[a]) / D[a], tb = (mx - O[a]) / D[a];
      let na = -1;
      if (ta > tb) { [ta, tb] = [tb, ta]; na = 1; }
      if (ta > t0) { t0 = ta; n = [0, 0, 0]; n[a] = na; }
      if (tb < t1) t1 = tb;
      if (t0 > t1) ok = false;
    }
    if (!ok || t1 < 0) continue;
    if (!melhor || t0 < melhor.t) melhor = { t: Math.max(0, t0), n: n || [0, 1, 0] };
  }
  return melhor;
}

// ---------- ícones (inventário e barra) ----------
function desenharIcone(ctx, id, tam, atlas) {
  const def = BLOCOS[id];
  if (!def || !FORMA_NOVA[id]) return false;
  const tile = def.tiles[2], topo = def.tiles[0];
  const src = (t) => [(t % COLS) * TILE, Math.floor(t / COLS) * TILE];
  const s = tam / 48;
  ctx.save();
  ctx.scale(s, s);
  const preencher = (caminho, t, sombra = 0, grad = null) => {
    ctx.save();
    caminho(); ctx.clip();
    const [sx, sy] = src(t);
    ctx.drawImage(atlas, sx, sy, TILE, TILE, 0, 0, 48, 48);
    if (grad) { ctx.fillStyle = grad; ctx.fillRect(0, 0, 48, 48); }
    if (sombra) { ctx.fillStyle = `rgba(0,0,0,${sombra})`; ctx.fillRect(0, 0, 48, 48); }
    ctx.restore();
    ctx.save(); caminho(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
  };
  const poli = (pts) => () => { ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); };
  const cil = (cx, w, y0, y1, tl, tt, ry = 4) => {
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.45, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
    preencher(() => { ctx.beginPath(); ctx.moveTo(cx - w, y0); ctx.lineTo(cx - w, y1); ctx.ellipse(cx, y1, w, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + w, y0); ctx.closePath(); }, tl, 0, g);
    preencher(() => { ctx.beginPath(); ctx.ellipse(cx, y0, w, ry, 0, 0, Math.PI * 2); }, tt);
  };
  const bolaG = (cx, cy, r) => { const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); return g; };
  const base = baseForma(id);
  switch (def.forma) {
    case 'tronco': cil(24, 15, 9, 41, tile, topo, 5); break;
    case 'coluna':
      preencher(poli([[8, 36], [40, 36], [40, 43], [8, 43]]), tile, 0.2);
      cil(24, 12, 11, 37, tile, topo, 4);
      preencher(poli([[8, 5], [40, 5], [40, 11], [8, 11]]), tile, 0.05);
      break;
    case 'cerca':
      preencher(poli([[4, 17], [44, 17], [44, 22], [4, 22]]), tile, 0.1);
      preencher(poli([[4, 29], [44, 29], [44, 34], [4, 34]]), tile, 0.1);
      cil(12, 4, 8, 44, tile, topo, 1.5); cil(36, 4, 8, 44, tile, topo, 1.5);
      break;
    case 'vidrofino': preencher(poli([[14, 4], [34, 9], [34, 46], [14, 41]]), tile, 0); break;
    case 'cano':
      preencher(() => { ctx.beginPath(); ctx.moveTo(6, 16); ctx.lineTo(42, 16); ctx.ellipse(42, 24, 4, 8, 0, -Math.PI / 2, Math.PI / 2); ctx.lineTo(6, 32); ctx.closePath(); }, tile, 0,
        (() => { const g = ctx.createLinearGradient(0, 16, 0, 32); g.addColorStop(0, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); return g; })());
      preencher(() => { ctx.beginPath(); ctx.ellipse(6, 24, 4, 8, 0, 0, Math.PI * 2); }, tile, 0.3);
      break;
    case 'bola': preencher(() => { ctx.beginPath(); ctx.arc(24, 25, 19, 0, Math.PI * 2); }, tile, 0, bolaG(24, 25, 19)); break;
    case 'cupula': preencher(() => { ctx.beginPath(); ctx.moveTo(4, 38); ctx.arc(24, 38, 20, Math.PI, 0); ctx.ellipse(24, 38, 20, 5, 0, 0, Math.PI); ctx.closePath(); }, tile, 0, bolaG(24, 30, 22)); break;
    case 'laje':
      preencher(poli([[24, 18], [44, 26], [24, 34], [4, 26]]), topo);
      preencher(poli([[4, 26], [24, 34], [24, 44], [4, 36]]), tile, 0.18);
      preencher(poli([[24, 34], [44, 26], [44, 36], [24, 44]]), tile, 0.35);
      break;
    case 'rampa':
      preencher(poli([[4, 42], [32, 42], [44, 34], [44, 8]]), tile, 0.05);
      preencher(poli([[32, 42], [44, 34], [44, 8]]), tile, 0.35);
      break;
    case 'escada':
      preencher(poli([[4, 44], [4, 32], [16, 32], [16, 20], [28, 20], [28, 8], [44, 8], [44, 44]]), tile, 0.1);
      break;
    case 'roda':
      preencher(() => { ctx.beginPath(); ctx.arc(24, 24, 20, 0, Math.PI * 2); ctx.arc(24, 24, 15, 0, Math.PI * 2, true); }, tile, 0.1);
      preencher(poli([[22, 8], [26, 8], [26, 40], [22, 40]]), 21, 0.1);
      preencher(poli([[8, 22], [40, 22], [40, 26], [8, 26]]), 21, 0.1);
      preencher(() => { ctx.beginPath(); ctx.arc(24, 24, 5, 0, Math.PI * 2); }, 55, 0);
      break;
    default: ctx.restore(); return false;
  }
  void base;
  ctx.restore();
  return true;
}
ICONES_ESPECIAIS.fn = desenharIcone;

export { SOLIDO };

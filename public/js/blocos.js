// Definição dos blocos e geração procedural do atlas de texturas (arte original, feita em código).
import * as THREE from '../vendor/three.module.min.js';
import { rngSemente } from './ruido.js';

export const AR = 0;
export const B = {
  GRAMA: 1, TERRA: 2, PEDRA: 3, AREIA: 4, AGUA: 5, TRONCO: 6, FOLHAS: 7, TABUAS: 8, VIDRO: 9,
  TIJOLO: 10, FLOR_VERMELHA: 11, FLOR_AMARELA: 12, CAPIM: 13, LA_BRANCA: 14, LA_VERMELHA: 15,
  LA_AZUL: 16, LA_AMARELA: 17, LA_VERDE: 18, LA_ROSA: 19, PEDRISCO: 20, LAMPIAO: 21, FLOR_AZUL: 22,
};

// tiles: [cima, baixo, lados]
export const BLOCOS = [];
function def(id, nome, tiles, o = {}) {
  BLOCOS[id] = {
    id, nome, tiles: Array.isArray(tiles) ? tiles : [tiles, tiles, tiles],
    solido: o.solido ?? true, opaco: o.opaco ?? true, planta: !!o.planta, agua: !!o.agua,
  };
}
def(AR, 'Ar', 0, { solido: false, opaco: false });
def(B.GRAMA, 'Grama', [0, 2, 1]);
def(B.TERRA, 'Terra', 2);
def(B.PEDRA, 'Pedra', 3);
def(B.AREIA, 'Areia', 4);
def(B.AGUA, 'Água', 5, { solido: false, opaco: false, agua: true });
def(B.TRONCO, 'Tronco', [6, 6, 7]);
def(B.FOLHAS, 'Folhas', 8);
def(B.TABUAS, 'Tábuas', 9);
def(B.VIDRO, 'Vidro', 10, { opaco: false });
def(B.TIJOLO, 'Tijolo', 11);
def(B.FLOR_VERMELHA, 'Flor vermelha', 12, { solido: false, opaco: false, planta: true });
def(B.FLOR_AMARELA, 'Flor amarela', 13, { solido: false, opaco: false, planta: true });
def(B.CAPIM, 'Capim', 14, { solido: false, opaco: false, planta: true });
def(B.LA_BRANCA, 'Lã branca', 15);
def(B.LA_VERMELHA, 'Lã vermelha', 16);
def(B.LA_AZUL, 'Lã azul', 17);
def(B.LA_AMARELA, 'Lã amarela', 18);
def(B.LA_VERDE, 'Lã verde', 19);
def(B.LA_ROSA, 'Lã rosa', 20);
def(B.PEDRISCO, 'Pedrisco', 21);
def(B.LAMPIAO, 'Lampião', 22);
def(B.FLOR_AZUL, 'Flor azul', 23, { solido: false, opaco: false, planta: true });

// Água corrente: nasce das fontes (o bloco Água) e não é salva nem enviada pela rede;
// cada aparelho recalcula sozinho a partir das fontes. Nível 1 = perto da fonte, 7 = a pontinha.
export const AGUA_CORRENTE = [];
for (let n = 1; n <= 7; n++) {
  AGUA_CORRENTE[n] = 22 + n; // 23..29
  def(AGUA_CORRENTE[n], 'Água corrente', 5, { solido: false, opaco: false, agua: true });
}
export const AGUA_CAINDO = 30; // cachoeira: água que desce
def(AGUA_CAINDO, 'Cachoeira', 5, { solido: false, opaco: false, agua: true });

// tabelas rápidas para o gerador de malha
export const SOLIDO = new Uint8Array(256);
export const OPACO = new Uint8Array(256);
export const PLANTA = new Uint8Array(256);
export const AGUA = new Uint8Array(256); // qualquer água (fonte, corrente ou caindo)
// nível do líquido: 0 = fonte, 1..7 = corrente, 8 = caindo
export const NIVEL = new Uint8Array(256);
for (const b of BLOCOS) { SOLIDO[b.id] = b.solido ? 1 : 0; OPACO[b.id] = b.opaco ? 1 : 0; PLANTA[b.id] = b.planta ? 1 : 0; AGUA[b.id] = b.agua ? 1 : 0; }
for (let n = 1; n <= 7; n++) NIVEL[AGUA_CORRENTE[n]] = n;
NIVEL[AGUA_CAINDO] = 8;

// Ordem dos blocos no inventário (modo criativo)
export const INVENTARIO = [
  B.GRAMA, B.TERRA, B.PEDRA, B.PEDRISCO, B.AREIA, B.TRONCO, B.TABUAS, B.FOLHAS, B.VIDRO, B.TIJOLO,
  B.LAMPIAO, B.LA_BRANCA, B.LA_VERMELHA, B.LA_AZUL, B.LA_AMARELA, B.LA_VERDE, B.LA_ROSA,
  B.FLOR_VERMELHA, B.FLOR_AMARELA, B.FLOR_AZUL, B.CAPIM, B.AGUA,
];

export const TILE = 16;
export const COLS = 8;
export const LINHAS = 4;

function hex(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }

function pintarTile(img, idx, fn) {
  const ox = (idx % COLS) * TILE, oy = Math.floor(idx / COLS) * TILE;
  const W = COLS * TILE;
  const r = rngSemente(idx * 7919 + 13);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const c = fn(x, y, r); // [r,g,b,a]
    const i = ((oy + y) * W + ox + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = c[3] ?? 255;
  }
}
const var_ = (c, r, amt) => { const k = 1 + (r() - 0.5) * amt; return [c[0] * k, c[1] * k, c[2] * k, 255]; };

export function criarAtlas() {
  const cv = document.createElement('canvas');
  cv.width = COLS * TILE; cv.height = LINHAS * TILE;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(cv.width, cv.height);
  const verde = hex(0x6cc04a), terra = hex(0x8a5a3b), pedra = hex(0x8c8f96), areia = hex(0xecd9a0);
  // 0 grama topo
  pintarTile(img, 0, (x, y, r) => var_(r() < 0.08 ? hex(0x86d65c) : verde, r, 0.25));
  // 1 grama lado
  pintarTile(img, 1, (x, y, r) => {
    const borda = 3 + ((x * 7 + 3) % 3 === 0 ? 1 : 0);
    return var_(y < borda ? verde : terra, r, 0.25);
  });
  // 2 terra
  pintarTile(img, 2, (x, y, r) => var_(r() < 0.1 ? hex(0x6e4529) : terra, r, 0.25));
  // 3 pedra
  pintarTile(img, 3, (x, y, r) => var_(r() < 0.12 ? hex(0x767980) : pedra, r, 0.18));
  // 4 areia
  pintarTile(img, 4, (x, y, r) => var_(areia, r, 0.12));
  // 5 água
  pintarTile(img, 5, (x, y, r) => { const c = var_(hex(0x3d8fe0), r, 0.12); c[3] = 255; return c; });
  // 6 tronco topo (anéis)
  pintarTile(img, 6, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 7) return var_(hex(0x6b4a2b), r, 0.2);
    return var_(Math.floor(d) % 2 ? hex(0xc9a36b) : hex(0xb08955), r, 0.1);
  });
  // 7 tronco lado
  pintarTile(img, 7, (x, y, r) => var_(x % 4 === 0 ? hex(0x5a3d22) : hex(0x7a5634), r, 0.2));
  // 8 folhas
  pintarTile(img, 8, (x, y, r) => var_(r() < 0.25 ? hex(0x3c8a2e) : hex(0x4fa83a), r, 0.3));
  // 9 tábuas
  pintarTile(img, 9, (x, y, r) => {
    const linha = y % 4 === 3;
    const junta = (y >> 2) % 2 ? x === 4 : x === 11;
    return var_(linha || junta ? hex(0x9a7040) : hex(0xc89a5a), r, 0.12);
  });
  // 10 vidro (moldura + centro transparente)
  pintarTile(img, 10, (x, y) => {
    const borda = x === 0 || y === 0 || x === 15 || y === 15;
    if (borda) return [220, 240, 255, 255];
    if ((x === y || x === y + 1) && x > 3 && x < 9) return [255, 255, 255, 200];
    return [180, 220, 255, 0];
  });
  // 11 tijolo
  pintarTile(img, 11, (x, y, r) => {
    const argamassa = y % 4 === 3 || ((y >> 2) % 2 ? x % 8 === 3 : x % 8 === 7);
    return var_(argamassa ? hex(0xd8d0c4) : hex(0xb5523b), r, 0.15);
  });
  // flores e capim (fundo transparente)
  const flor = (cor, centro) => (x, y, r) => {
    const dx = x - 7.5, dy = y - 5.5, d = Math.hypot(dx, dy);
    if (d < 1.6) return [...hex(centro), 255];
    if (d < 3.8) return var_(hex(cor), r, 0.15);
    if ((x === 7 || x === 8) && y > 8) return var_(hex(0x3f8f2c), r, 0.2);
    if (y > 10 && ((x === 5 && y < 13) || (x === 10 && y < 12))) return var_(hex(0x4fa83a), r, 0.2);
    return [0, 0, 0, 0];
  };
  pintarTile(img, 12, flor(0xe8433f, 0xffe066));
  pintarTile(img, 13, flor(0xffd23f, 0xb5651d));
  pintarTile(img, 14, (x, y, r) => {
    const h = [9, 13, 6, 11, 14, 8, 12, 10, 5, 13, 9, 12, 7, 11, 10, 8][x];
    return 15 - y < h && (x % 2 === 0 || 15 - y < h - 3) ? var_(hex(0x5bb83f), r, 0.3) : [0, 0, 0, 0];
  });
  // lãs
  const la = (c) => (x, y, r) => var_(hex(c), r, (x + y) % 3 === 0 ? 0.18 : 0.08);
  pintarTile(img, 15, la(0xf2f2ee));
  pintarTile(img, 16, la(0xd9473c));
  pintarTile(img, 17, la(0x3f6fd9));
  pintarTile(img, 18, la(0xf2c72e));
  pintarTile(img, 19, la(0x5cb83a));
  pintarTile(img, 20, la(0xf29ac2));
  // 21 pedrisco
  pintarTile(img, 21, (x, y, r) => {
    const cx = Math.floor(x / 5), cy = Math.floor((y + (cx % 2) * 2) / 5);
    const borda = x % 5 === 4 || (y + (cx % 2) * 2) % 5 === 4;
    return var_(borda ? hex(0x5f6166) : (cx + cy) % 2 ? hex(0x9a9ca3) : hex(0x84868d), r, 0.15);
  });
  // 22 lampião
  pintarTile(img, 22, (x, y, r) => {
    const borda = x < 2 || y < 2 || x > 13 || y > 13;
    if (borda) return var_(hex(0x6b4a2b), r, 0.15);
    const d = Math.hypot(x - 7.5, y - 7.5);
    return [255, 230 - d * 8, 120 - d * 6, 255];
  });
  pintarTile(img, 23, flor(0x5a8cff, 0xffffff));
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, canvas: cv };
}

// coordenadas UV de um tile (com pequena margem para evitar sangramento)
export function uvTile(idx) {
  const e = 0.02 / TILE;
  const u0 = (idx % COLS) / COLS + e, u1 = (idx % COLS + 1) / COLS - e;
  const v1 = 1 - Math.floor(idx / COLS) / LINHAS - e, v0 = 1 - (Math.floor(idx / COLS) + 1) / LINHAS + e;
  return [u0, v0, u1, v1];
}

// desenha o ícone de um bloco em um canvas pequeno (para a barra e o inventário)
export function iconeBloco(atlasCanvas, id, tam = 40) {
  const b = BLOCOS[id];
  const cv = document.createElement('canvas');
  cv.width = cv.height = tam;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const src = (t) => [(t % COLS) * TILE, Math.floor(t / COLS) * TILE];
  if (b.planta || id === B.AGUA) {
    const [sx, sy] = src(b.tiles[2]);
    ctx.drawImage(atlasCanvas, sx, sy, TILE, TILE, tam * 0.1, tam * 0.1, tam * 0.8, tam * 0.8);
    return cv;
  }
  // cubo isométrico simples: topo + dois lados
  const s = tam / 2;
  const desenhar = (t, m, escurecer) => {
    const [sx, sy] = src(t);
    ctx.save();
    ctx.setTransform(...m);
    ctx.drawImage(atlasCanvas, sx, sy, TILE, TILE, 0, 0, 1, 1);
    if (escurecer) { ctx.fillStyle = `rgba(0,0,0,${escurecer})`; ctx.fillRect(0, 0, 1, 1); }
    ctx.restore();
  };
  const h = s * 0.58;
  desenhar(b.tiles[0], [s * 0.86, h * 0.5, -s * 0.86, h * 0.5, s, tam * 0.06], 0);
  desenhar(b.tiles[2], [s * 0.86, h * 0.5, 0, s * 0.95, tam * 0.07, tam * 0.06 + h * 0.5], 0.18);
  desenhar(b.tiles[2], [s * 0.86, -h * 0.5, 0, s * 0.95, s, tam * 0.06 + h], 0.35);
  return cv;
}

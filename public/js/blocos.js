// Definição dos blocos e geração procedural do atlas de texturas (arte original, feita em código).
import * as THREE from '../vendor/three.module.min.js';
import { rngSemente } from './ruido.js';
import { DEFS_ERAS, PINTORES } from './blocos-eras.js';

export const AR = 0;
export const B = {
  GRAMA: 1, TERRA: 2, PEDRA: 3, AREIA: 4, AGUA: 5, TRONCO: 6, FOLHAS: 7, TABUAS: 8, VIDRO: 9,
  TIJOLO: 10, FLOR_VERMELHA: 11, FLOR_AMARELA: 12, CAPIM: 13, LA_BRANCA: 14, LA_VERMELHA: 15,
  LA_AZUL: 16, LA_AMARELA: 17, LA_VERDE: 18, LA_ROSA: 19, PEDRISCO: 20, LAMPIAO: 21, FLOR_AZUL: 22,
  // 23..30 são as águas correntes (veja abaixo)
  TERRA_ARADA: 31, TRIGO: 32, FENO: 33,
};

// tiles: [cima, baixo, lados]
export const BLOCOS = [];
function def(id, nome, tiles, o = {}) {
  BLOCOS[id] = {
    id, nome, tiles: Array.isArray(tiles) ? tiles : [tiles, tiles, tiles],
    solido: o.solido ?? true, opaco: o.opaco ?? true, planta: !!o.planta, agua: !!o.agua,
    forma: o.forma || null, chao: !!o.chao, brilho: o.brilho || 0, icone: o.icone ?? null,
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
def(B.TERRA_ARADA, 'Terra de plantar', 24);
def(B.TRIGO, 'Trigo', 25, { solido: false, opaco: false, planta: true });
def(B.FENO, 'Feno', [26, 26, 27]);

// Água corrente: nasce das fontes (o bloco Água) e não é salva nem enviada pela rede;
// cada aparelho recalcula sozinho a partir das fontes. Nível 1 = perto da fonte, 7 = a pontinha.
export const AGUA_CORRENTE = [];
for (let n = 1; n <= 7; n++) {
  AGUA_CORRENTE[n] = 22 + n; // 23..29
  def(AGUA_CORRENTE[n], 'Água corrente', 5, { solido: false, opaco: false, agua: true });
}
export const AGUA_CAINDO = 30; // cachoeira: água que desce
def(AGUA_CAINDO, 'Cachoeira', 5, { solido: false, opaco: false, agua: true });

// ---------- engenharia: energia e máquinas ----------
// Números a partir de 100 (longe dos blocos comuns). Os estados "_LIGADO" das máquinas não são
// salvos nem enviados pela rede: cada aparelho recalcula a energia sozinho (veja energia.js).
// Só a alavanca, o botão e a placa de pressão guardam o estado (são o que o jogador mexe).
export const E = {
  FIO: 100, FIO_LIGADO: 101,
  ALAVANCA: 102, ALAVANCA_LIGADA: 103,
  BOTAO: 104, BOTAO_LIGADO: 105,
  PLACA: 106, PLACA_LIGADA: 107,
  LAMPADA: 108, LAMPADA_LIGADA: 109,
  PORTAO: 110, PORTAO_ABERTO: 111,
  VENTILADOR: 112, VENTILADOR_LIGADO: 113,
  SINO: 114, SINO_LIGADO: 115,
  CONFETE: 116, CONFETE_LIGADO: 117,
  SENSOR: 118, SENSOR_LIGADO: 119,
  PISCA: 120, PISCA_LIGADO: 121,
  TRAMPOLIM: 122,
  ESTEIRA: 123, // 123..126: andando para +x, +z, -x, -z
};
export const ESTEIRA_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const MAX_ID = 126;
const T = { FIO: 48, FIO_LIG: 49, BOTAO: 50, LAMP: 51, LAMP_LIG: 52, PORTAO: 53, PORTAO_ABERTO: 54, METAL: 55, VENT: 56, TRAMP: 57, ESTEIRA: 58, SINO: 59, CONFETE: 60, SENSOR: 61, PISCA: 62, ALAVANCA: 63 };
const fino = { solido: false, opaco: false, chao: true };
def(E.FIO, 'Fio', T.FIO, { ...fino, forma: 'fio' });
def(E.FIO_LIGADO, 'Fio', T.FIO_LIG, { ...fino, forma: 'fio', brilho: 1 });
def(E.ALAVANCA, 'Alavanca', [T.FIO, 21, 9], { ...fino, forma: 'alavanca', icone: T.ALAVANCA });
def(E.ALAVANCA_LIGADA, 'Alavanca', [T.FIO_LIG, 21, 9], { ...fino, forma: 'alavanca', icone: T.ALAVANCA });
def(E.BOTAO, 'Botão', T.BOTAO, { ...fino, forma: 'botao', icone: T.BOTAO });
def(E.BOTAO_LIGADO, 'Botão', T.BOTAO, { ...fino, forma: 'botao', icone: T.BOTAO, brilho: 0.6 });
def(E.PLACA, 'Placa de pisar', 21, { ...fino, forma: 'placa' });
def(E.PLACA_LIGADA, 'Placa de pisar', 21, { ...fino, forma: 'placa', brilho: 0.3 });
def(E.LAMPADA, 'Lâmpada', T.LAMP);
def(E.LAMPADA_LIGADA, 'Lâmpada', T.LAMP_LIG, { brilho: 1 });
def(E.PORTAO, 'Portão', T.PORTAO, { opaco: false });
def(E.PORTAO_ABERTO, 'Portão', T.PORTAO_ABERTO, { solido: false, opaco: false });
def(E.VENTILADOR, 'Ventilador', [T.VENT, T.METAL, T.METAL]);
def(E.VENTILADOR_LIGADO, 'Ventilador', [T.VENT, T.METAL, T.METAL], { brilho: 0.35 });
def(E.SINO, 'Sino', [T.METAL, T.METAL, T.SINO]);
def(E.SINO_LIGADO, 'Sino', [T.METAL, T.METAL, T.SINO], { brilho: 0.4 });
def(E.CONFETE, 'Canhão de confete', [T.CONFETE, T.METAL, T.METAL]);
def(E.CONFETE_LIGADO, 'Canhão de confete', [T.CONFETE, T.METAL, T.METAL], { brilho: 0.4 });
def(E.SENSOR, 'Sensor de noite', [T.SENSOR, T.METAL, T.METAL]);
def(E.SENSOR_LIGADO, 'Sensor de noite', [T.SENSOR, T.METAL, T.METAL], { brilho: 0.5 });
def(E.PISCA, 'Pisca-pisca', T.PISCA);
def(E.PISCA_LIGADO, 'Pisca-pisca', T.PISCA, { brilho: 0.8 });
def(E.TRAMPOLIM, 'Trampolim', [T.TRAMP, T.METAL, T.METAL]);
for (let d = 0; d < 4; d++) def(E.ESTEIRA + d, 'Esteira', [T.ESTEIRA, T.METAL, T.METAL], { forma: 'esteira' });


// blocos das eras (mundo Linha do Tempo): IDs 128..175, veja blocos-eras.js
for (const [id, nome, tiles, o] of DEFS_ERAS) def(id, nome, tiles, o);

// tabelas rápidas para o gerador de malha
export const SOLIDO = new Uint8Array(256);
export const OPACO = new Uint8Array(256);
export const PLANTA = new Uint8Array(256);
export const AGUA = new Uint8Array(256); // qualquer água (fonte, corrente ou caindo)
// nível do líquido: 0 = fonte, 1..7 = corrente, 8 = caindo
export const NIVEL = new Uint8Array(256);
export const BRILHO = new Float32Array(256); // quanto o bloco brilha sozinho (0..1)
export const PRECISA_CHAO = new Uint8Array(256); // some se tirar o bloco de baixo
for (const b of BLOCOS) {
  if (!b) continue;
  SOLIDO[b.id] = b.solido ? 1 : 0; OPACO[b.id] = b.opaco ? 1 : 0; PLANTA[b.id] = b.planta ? 1 : 0; AGUA[b.id] = b.agua ? 1 : 0;
  BRILHO[b.id] = b.brilho; PRECISA_CHAO[b.id] = b.planta || b.chao ? 1 : 0;
}
BRILHO[B.LAMPIAO] = 1;
for (let n = 1; n <= 7; n++) NIVEL[AGUA_CORRENTE[n]] = n;
NIVEL[AGUA_CAINDO] = 8;

// Ordem dos blocos no inventário (modo criativo)
export const INVENTARIO = [
  B.GRAMA, B.TERRA, B.PEDRA, B.PEDRISCO, B.AREIA, B.TRONCO, B.TABUAS, B.FOLHAS, B.VIDRO, B.TIJOLO,
  B.LAMPIAO, B.FENO, B.TERRA_ARADA, B.LA_BRANCA, B.LA_VERMELHA, B.LA_AZUL, B.LA_AMARELA, B.LA_VERDE, B.LA_ROSA,
  B.FLOR_VERMELHA, B.FLOR_AMARELA, B.FLOR_AZUL, B.CAPIM, B.TRIGO, B.AGUA,
];
// aba "Engenharia" do inventário
export const INVENTARIO_MAQUINAS = [
  E.ALAVANCA, E.BOTAO, E.PLACA, E.SENSOR, E.PISCA, E.FIO,
  E.LAMPADA, E.PORTAO, E.VENTILADOR, E.SINO, E.CONFETE, E.TRAMPOLIM, E.ESTEIRA,
];

export const TILE = 16;
export const COLS = 8;
export const LINHAS = 16; // tiles 64..127: eras (blocos-eras.js)

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
  // 24 terra de plantar (sulcos)
  pintarTile(img, 24, (x, y, r) => var_(y % 4 < 2 ? hex(0x5e3a22) : hex(0x7a4d2e), r, 0.18));
  // 25 trigo (fundo transparente): talos com espigas douradas
  pintarTile(img, 25, (x, y, r) => {
    const talo = x % 3 === 1;
    const topo = [5, 3, 6, 4, 2, 5, 3, 6, 4, 2, 5, 3, 6, 4, 3, 5][x];
    if (!talo || y < topo) return [0, 0, 0, 0];
    if (y < topo + 5) return var_(hex(0xe8b93c), r, 0.25);
    return var_(hex(0x9cbf4a), r, 0.2);
  });
  // 26 feno (topo) e 27 feno (lado, com amarração)
  pintarTile(img, 26, (x, y, r) => var_(r() < 0.2 ? hex(0xc99a2e) : hex(0xe6c056), r, 0.2));
  pintarTile(img, 27, (x, y, r) => var_(y === 4 || y === 11 ? hex(0x8a5a2b) : (x + y * 3) % 5 === 0 ? hex(0xc99a2e) : hex(0xe6c056), r, 0.15));
  pintarMaquinas(img);
  for (const t in PINTORES) pintarTile(img, +t, PINTORES[t]);
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, canvas: cv };
}

// arte das peças de engenharia (tiles 48..63)
function pintarMaquinas(img) {
  const metalBase = hex(0x9aa3ad), metalEsc = hex(0x6d7680);
  const metal = (x, y, r) => {
    const borda = x === 0 || y === 0 || x === 15 || y === 15;
    const rebite = (x === 2 || x === 13) && (y === 2 || y === 13);
    return var_(borda ? metalEsc : rebite ? hex(0xd7dde3) : metalBase, r, 0.08);
  };
  // 48 fio (cobre apagado) / 49 fio ligado (vermelho brilhante)
  pintarTile(img, 48, (x, y, r) => var_((x + y) % 4 === 0 ? hex(0x7a3b22) : hex(0x9b4f2c), r, 0.1));
  pintarTile(img, 49, (x, y, r) => var_((x + y) % 4 === 0 ? hex(0xffb03a) : hex(0xff4a2a), r, 0.08));
  // 50 botão vermelho
  pintarTile(img, 50, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 4.2) return var_(d < 2 && x < 8 && y < 8 ? hex(0xff9a8a) : hex(0xe23a2a), r, 0.06);
    if (d < 6.5) return var_(hex(0x5d6670), r, 0.08);
    return [0, 0, 0, 0];
  });
  // 51 lâmpada apagada / 52 acesa
  const lamp = (acesa) => (x, y, r) => {
    const borda = x < 1 || y < 1 || x > 14 || y > 14;
    if (borda) return var_(hex(0x5d6670), r, 0.08);
    const grade = x % 5 === 0 || y % 5 === 0;
    if (grade) return var_(acesa ? hex(0xffe9a8) : hex(0x7d868f), r, 0.05);
    const d = Math.hypot(x - 7.5, y - 7.5);
    return acesa ? [255, 245 - d * 4, 170 - d * 6, 255] : var_(hex(0xc7c2a8), r, 0.1);
  };
  pintarTile(img, 51, lamp(false));
  pintarTile(img, 52, lamp(true));
  // 53 portão fechado (tábuas com faixas de metal) / 54 aberto (só a moldura)
  pintarTile(img, 53, (x, y, r) => {
    if (y === 3 || y === 12) return var_(hex(0x4d5560), r, 0.08);
    return var_(x % 4 === 0 ? hex(0x8a6236) : hex(0xb98a50), r, 0.12);
  });
  pintarTile(img, 54, (x, y, r) => (x < 2 || x > 13 || y < 1 || y > 14 ? var_(hex(0x8a6236), r, 0.12) : [0, 0, 0, 0]));
  // 55 metal (lado das máquinas)
  pintarTile(img, 55, metal);
  // 56 ventilador (hélice vista de cima)
  pintarTile(img, 56, (x, y, r) => {
    const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy);
    if (d > 7.3) return metal(x, y, r);
    if (d < 1.6) return var_(hex(0xf2c72e), r, 0.05);
    const a = Math.atan2(dy, dx);
    const pa = Math.sin(a * 3 + d * 0.25) > 0.35;
    return var_(pa ? hex(0x3fa7d9) : hex(0x2b3138), r, 0.08);
  });
  // 57 trampolim (lona listrada)
  pintarTile(img, 57, (x, y, r) => {
    if (x < 2 || y < 2 || x > 13 || y > 13) return var_(hex(0x3f6fd9), r, 0.08);
    return var_(((x + y) >> 2) % 2 ? hex(0xf2c72e) : hex(0xe8433f), r, 0.06);
  });
  // 58 esteira (seta para cima da imagem)
  pintarTile(img, 58, (x, y, r) => {
    if (x < 2 || x > 13) return var_(hex(0x5d6670), r, 0.08);
    const ay = (y + 16) % 8; // duas setas
    const seta = Math.abs(x - 7.5) < 4.5 - ay * 0.0 && ay >= Math.abs(x - 7.5) - 0.5 && ay <= Math.abs(x - 7.5) + 2.5;
    return var_(seta ? hex(0xf2c72e) : y % 2 ? hex(0x2b3138) : hex(0x3a424b), r, 0.06);
  });
  // 59 sino (sino dourado no metal)
  pintarTile(img, 59, (x, y, r) => {
    const larg = y < 3 ? 1 : y < 11 ? 2 + (y - 3) * 0.55 : y < 13 ? 6.5 : -1;
    if (Math.abs(x - 7.5) < larg) return var_(y === 11 || y === 12 ? hex(0xc9962a) : hex(0xf2c72e), r, 0.08);
    if (y === 14 && Math.abs(x - 7.5) < 1.5) return var_(hex(0xc9962a), r, 0.05);
    return metal(x, y, r);
  });
  // 60 canhão de confete (pontinhos coloridos)
  const cores = [0xe8433f, 0xf2c72e, 0x3f6fd9, 0x5cb83a, 0xf29ac2, 0xffffff];
  pintarTile(img, 60, (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 6.5) return metal(x, y, r);
    if (d > 5) return var_(hex(0x2b3138), r, 0.05);
    return r() < 0.45 ? [...hex(cores[Math.floor(r() * cores.length)]), 255] : var_(hex(0x1c2228), r, 0.05);
  });
  // 61 sensor de noite (lua e estrelinhas)
  pintarTile(img, 61, (x, y, r) => {
    if (x < 1 || y < 1 || x > 14 || y > 14) return var_(hex(0x5d6670), r, 0.08);
    const d = Math.hypot(x - 7, y - 7), d2 = Math.hypot(x - 9.5, y - 5.5);
    if (d < 4.5 && d2 > 3.6) return var_(hex(0xfff1b0), r, 0.05);
    if ((x === 3 && y === 11) || (x === 12 && y === 12) || (x === 12 && y === 3)) return [255, 255, 255, 255];
    return var_(hex(0x1d2a5a), r, 0.1);
  });
  // 62 pisca-pisca (luz em faixas)
  pintarTile(img, 62, (x, y, r) => {
    if (x < 1 || y < 1 || x > 14 || y > 14) return var_(hex(0x5d6670), r, 0.08);
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 3) return var_(hex(0x7dff8a), r, 0.05);
    return var_(Math.floor(d) % 2 ? hex(0x2e7d3a) : hex(0x245f2d), r, 0.08);
  });
  // 63 alavanca (ícone)
  pintarTile(img, 63, (x, y, r) => {
    if (y >= 11 && y <= 14 && x >= 3 && x <= 12) return var_(hex(0x84868d), r, 0.1);
    const t = (14 - y) / 12; const cx = 7.5 + (1 - t) * -3 + t * 3;
    if (y < 11 && y > 3 && Math.abs(x - (5 + (11 - y) * 0.55)) < 1.1) return var_(hex(0x9a7040), r, 0.1);
    void cx;
    if (Math.hypot(x - 10, y - 3) < 2.2) return var_(hex(0xe23a2a), r, 0.06);
    return [0, 0, 0, 0];
  });
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
  if (b.planta || id === B.AGUA || b.icone !== null || b.forma === 'fio' || b.forma === 'placa') {
    const [sx, sy] = src(b.icone ?? b.tiles[2]);
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

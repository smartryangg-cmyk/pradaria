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
  TERRA_ARADA: 31, TRIGO: 32, FENO: 33, BANCADA: 34,
  // mundo clássico (biomas, cavernas e minérios): 60..79, tiles 28..40
  // (neve, grama com neve, gelo e arenito são os blocos das eras: BE.BLOCO_NEVE, BE.NEVE, BE.GELO, BE.ARENITO)
  CACTO: 63, CASCALHO: 65,
  CARVAO: 66, FERRO: 67, OURO: 68, DIAMANTE: 69, ROCHA_MAE: 70,
  TRONCO_PINHEIRO: 71, FOLHAS_PINHEIRO: 72, TRONCO_BETULA: 73, FOLHAS_SELVA: 74, ARBUSTO_SECO: 75,
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
def(B.CACTO, 'Cacto', [29, 29, 28]);
def(B.CASCALHO, 'Cascalho', 30);
def(B.CARVAO, 'Minério de carvão', 31);
def(B.FERRO, 'Minério de ferro', 32);
def(B.OURO, 'Minério de ouro', 33);
def(B.DIAMANTE, 'Diamante', 34);
def(B.ROCHA_MAE, 'Rocha-mãe', 35);
def(B.TRONCO_PINHEIRO, 'Tronco de pinheiro', [6, 6, 36]);
def(B.FOLHAS_PINHEIRO, 'Folhas de pinheiro', 37);
def(B.TRONCO_BETULA, 'Tronco de bétula', [6, 6, 38]);
def(B.FOLHAS_SELVA, 'Folhas da selva', 39);
def(B.ARBUSTO_SECO, 'Arbusto seco', 40, { solido: false, opaco: false, planta: true });
def(B.BANCADA, 'Bancada', [128, 9, 129]);

// ---------- itens (não são blocos: não vão para o mundo) ----------
// Números a partir de 1000, longe de todos os blocos (0..255). Receitas e força das ferramentas: receitas.js.
export const ITEM = {
  GRAVETO: 1000,
  PICARETA_MADEIRA: 1001, PICARETA_PEDRA: 1002,
  MACHADO_MADEIRA: 1003, MACHADO_PEDRA: 1004,
  PA_MADEIRA: 1005, PA_PEDRA: 1006,
};
export const ITENS = {
  [ITEM.GRAVETO]: { nome: 'Graveto', tile: 130 },
  [ITEM.PICARETA_MADEIRA]: { nome: 'Picareta de madeira', tile: 131 },
  [ITEM.PICARETA_PEDRA]: { nome: 'Picareta de pedra', tile: 132 },
  [ITEM.MACHADO_MADEIRA]: { nome: 'Machado de madeira', tile: 133 },
  [ITEM.MACHADO_PEDRA]: { nome: 'Machado de pedra', tile: 134 },
  [ITEM.PA_MADEIRA]: { nome: 'Pá de madeira', tile: 135 },
  [ITEM.PA_PEDRA]: { nome: 'Pá de pedra', tile: 136 },
};
export const ehItem = (id) => id >= 1000;
// nome de qualquer coisa que cabe na mão (bloco ou item)
export const nomeDe = (id) => (ehItem(id) ? ITENS[id] && ITENS[id].nome : BLOCOS[id] && BLOCOS[id].nome) || '?';

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
export const FOLHAGEM = new Uint8Array(256); // folhas que balançam com o vento
FOLHAGEM[B.FOLHAS] = FOLHAGEM[B.FOLHAS_PINHEIRO] = FOLHAGEM[B.FOLHAS_SELVA] = 1;
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
  B.LAMPIAO, B.FENO, B.BANCADA, B.TERRA_ARADA, B.LA_BRANCA, B.LA_VERMELHA, B.LA_AZUL, B.LA_AMARELA, B.LA_VERDE, B.LA_ROSA,
  B.FLOR_VERMELHA, B.FLOR_AMARELA, B.FLOR_AZUL, B.CAPIM, B.TRIGO, B.AGUA,
  B.CACTO, B.CASCALHO, B.CARVAO, B.FERRO, B.OURO, B.DIAMANTE,
  B.TRONCO_PINHEIRO, B.FOLHAS_PINHEIRO, B.TRONCO_BETULA, B.FOLHAS_SELVA, B.ARBUSTO_SECO,
];
// aba "Engenharia" do inventário
export const INVENTARIO_MAQUINAS = [
  E.ALAVANCA, E.BOTAO, E.PLACA, E.SENSOR, E.PISCA, E.FIO,
  E.LAMPADA, E.PORTAO, E.VENTILADOR, E.SINO, E.CONFETE, E.TRAMPOLIM, E.ESTEIRA,
];

export const TILE = 16;
export const COLS = 8;
export const LINHAS = 32; // tiles 64..127: eras (blocos-eras.js); 128..: bancada e itens (pintarCriacao)

function hex(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }

const var_ = (c, r, amt) => { const k = 1 + (r() - 0.5) * amt; return [c[0] * k, c[1] * k, c[2] * k, 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const esc = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const fracP = (v) => v - Math.floor(v);

// ruído suave que "dá a volta" no tile, para a textura emendar sem costura entre blocos. (u,v) em 0..1
function ruidoTile(semente, per = 4) {
  const r = rngSemente(semente);
  const g = Array.from({ length: per * per }, () => r());
  const v = (i, j) => g[((j % per + per) % per) * per + ((i % per + per) % per)];
  return (u, w) => {
    const fx = u * per, fy = w * per;
    const i = Math.floor(fx), j = Math.floor(fy);
    let tx = fx - i, ty = fy - j;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = v(i, j) + (v(i + 1, j) - v(i, j)) * tx;
    const b = v(i, j + 1) + (v(i + 1, j + 1) - v(i, j + 1)) * tx;
    return a + (b - a) * ty;
  };
}
// células (Voronoi) que também dão a volta no tile: pedrinhas, folhas, pedras do calçamento
function celulasTile(semente, n, esticaY = 1) {
  const r = rngSemente(semente);
  const c = Array.from({ length: n }, () => [r(), r(), r()]);
  return (u, w) => {
    let d1 = 9, d2 = 9, id = 0, ddx = 0, ddy = 0;
    for (let i = 0; i < n; i++) {
      let dx = u - c[i][0], dy = w - c[i][1];
      dx -= Math.round(dx); dy -= Math.round(dy);
      dy *= esticaY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; id = i; ddx = dx; ddy = dy; } else if (d < d2) d2 = d;
    }
    return { d1, d2, borda: d2 - d1, id, val: c[id][2], dx: ddx, dy: ddy };
  };
}

// Tiles "antigos" de 16px: quem pinta com pintarTile(img, idx, fn) continua funcionando;
// no atlas detalhado esses tiles são ampliados (pixelado) a partir dos 16px.
const tilesLegado = new Set();
function pintarTile(img, idx, fn) {
  tilesLegado.add(idx);
  const ox = (idx % COLS) * TILE, oy = Math.floor(idx / COLS) * TILE;
  const W = COLS * TILE;
  const r = rngSemente(idx * 7919 + 13);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const c = fn(x, y, r); // [r,g,b,a]
    const i = ((oy + y) * W + ox + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = c[3] ?? 255;
  }
}
// tiles que ainda não têm versão detalhada (desenhados em 16px com pintarTile)
function pintarLegado(img) {
  const verde = hex(0x6cc04a), terra = hex(0x8a5a3b), pedra = hex(0x8c8f96), areia = hex(0xecd9a0); // cores base usadas pelos tiles antigos
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
  // ---------- mundo clássico (tiles 28..40) ----------
  // cacto: lado com listras e espinhos, topo com miolo
  pintarTile(img, 28, (x, y, r) => {
    if (x === 0 || x === 15) return var_(hex(0x2f6b2a), r, 0.1);
    if ((x === 3 || x === 8 || x === 12) && y % 4 === 1) return [236, 236, 200, 255];
    return var_(x % 5 === 2 ? hex(0x3d8a35) : hex(0x4ea443), r, 0.12);
  });
  pintarTile(img, 29, (x, y, r) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    return var_(d > 6.5 ? hex(0x2f6b2a) : d < 3 ? hex(0x7cc56a) : hex(0x4ea443), r, 0.1);
  });
  // cascalho
  pintarTile(img, 30, (x, y, r) => { const t = r(); return var_(t < 0.25 ? hex(0x6f6c6a) : t < 0.5 ? hex(0x9a9592) : t < 0.6 ? hex(0x5a5654) : hex(0x868280), r, 0.1); });
  // minérios: pedra com pedrinhas coloridas
  const minerio = (cor, brilho) => (x, y, r) => {
    const m = ((x * 7 + y * 13) % 17 < 3 && (x + y) % 3 !== 0) || (Math.abs(x - 5) < 2 && Math.abs(y - 10) < 2) || (Math.abs(x - 11) < 2 && Math.abs(y - 4) < 2);
    if (m) return var_(r() < 0.3 ? hex(brilho) : hex(cor), r, 0.12);
    return var_(r() < 0.12 ? hex(0x767980) : pedra, r, 0.18);
  };
  pintarTile(img, 31, minerio(0x2b2b2e, 0x4a4a50));
  pintarTile(img, 32, minerio(0xc9906a, 0xe8b894));
  pintarTile(img, 33, minerio(0xf2c72e, 0xfff2a0));
  pintarTile(img, 34, minerio(0x45d6d0, 0xb8fffb));
  // rocha-mãe
  pintarTile(img, 35, (x, y, r) => { const t = r(); return var_(t < 0.3 ? hex(0x2a2a2e) : t < 0.6 ? hex(0x55565c) : hex(0x3d3e44), r, 0.1); });
  // pinheiro (casca escura) e folhas escuras
  pintarTile(img, 36, (x, y, r) => var_(x % 3 === 0 ? hex(0x3b2716) : hex(0x55391f), r, 0.18));
  pintarTile(img, 37, (x, y, r) => var_(r() < 0.3 ? hex(0x2a5a32) : hex(0x386e40), r, 0.25));
  // bétula: casca branca com manchas
  pintarTile(img, 38, (x, y, r) => {
    const mancha = (y * 5 + (x >> 2) * 3) % 7 === 0 && x % 4 !== 3;
    return var_(mancha ? hex(0x3a3a36) : hex(0xe6e2d6), r, 0.08);
  });
  // folhas da selva (verde vivo)
  pintarTile(img, 39, (x, y, r) => var_(r() < 0.25 ? hex(0x2f9a2a) : hex(0x46b83a), r, 0.3));
  // arbusto seco (fundo transparente)
  pintarTile(img, 40, (x, y, r) => {
    const galho = (x === 7 && y > 6) || (Math.abs(x - 7 - (12 - y) * 0.6) < 0.7 && y > 3 && y < 12) || (Math.abs(x - 7 + (13 - y) * 0.7) < 0.7 && y > 5 && y < 13);
    return galho ? var_(hex(0x8a6a3a), r, 0.2) : [0, 0, 0, 0];
  });
  pintarMaquinas(img);
  // tiles 64..127 (blocos das eras): neve, grama com neve, gelo e arenito do mundo clássico também vêm daqui.
  // Sem eles esses blocos ficam invisíveis e o terreno parece cheio de buracos.
  for (const t in PINTORES) pintarTile(img, +t, PINTORES[t]);
  pintarCriacao(img); // depois: se usar algum tile livre das eras, a arte nova vale
}

// Pinta o atlas com tiles de T pixels. Os desenhos são pensados em "unidades de 16" (u,v = 0..16),
// então o mesmo bloco fica igual em 16px e mais detalhado em 32px.
function gerarAtlas(T) {
  const cv = document.createElement('canvas');
  cv.width = COLS * T; cv.height = LINHAS * T;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(cv.width, cv.height);
  const W = COLS * T, S = T / 16;
  const P = (idx, fn) => {
    const ox = (idx % COLS) * T, oy = Math.floor(idx / COLS) * T;
    const r = rngSemente(idx * 7919 + 13 + T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const c = fn(x, y, r, x / S, y / S); // x,y em pixels · u,v em unidades de 16
      const i = ((oy + y) * W + ox + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, c[0])); img.data[i + 1] = Math.max(0, Math.min(255, c[1]));
      img.data[i + 2] = Math.max(0, Math.min(255, c[2])); img.data[i + 3] = c[3] ?? 255;
    }
  };
  const N = (sem, per) => { const f = ruidoTile(sem, per); return (x, y) => f(x / T, y / T); };
  const px = 1 / S; // um pixel, em unidades de 16

  // ---- grama: manchas suaves, folhinhas com luz em cima e sombra embaixo (relevo pintado) ----
  const nG = N(101, 4), nG2 = N(102, 8);
  const marcaG = new Int8Array(T * T);
  {
    const rr = rngSemente(103 + T);
    for (let k = 0; k < T * T * 0.06; k++) {
      const x = Math.floor(rr() * T), y = Math.floor(rr() * T), h = Math.max(1, Math.round(S * (1 + rr())));
      for (let j = 0; j < h; j++) marcaG[((y + j) % T) * T + x] = 1;
      marcaG[((y + h) % T) * T + x] = -1;
    }
  }
  const gramaPx = (x, y, r) => {
    const t = clamp01(nG(x, y) * 0.8 + nG2(x, y) * 0.45 - 0.12);
    let c = mix(hex(0x56a83a), hex(0x80cd52), t);
    const m = marcaG[(y % T) * T + x];
    if (m > 0) c = mix(c, hex(0xa6e57a), 0.7);
    else if (m < 0) c = esc(c, 0.8);
    return var_(c, r, 0.08);
  };
  // ---- terra: torrões e pedrinhas com luz/sombra ----
  const nT = N(201, 4), nT2 = N(202, 8), pedT = celulasTile(203, 9);
  const terraPx = (x, y, r) => {
    let c = mix(hex(0x744829), hex(0x9a6a48), clamp01(nT(x, y) * 0.8 + nT2(x, y) * 0.4 - 0.1));
    const q = pedT(x / T, y / T);
    const raio = 0.05 + q.val * 0.04;
    if (q.d1 < raio) {
      c = mix(hex(0x9d8670), hex(0xb9a48c), q.val);
      if (q.dy < -raio * 0.3) c = esc(c, 1.15); else if (q.dy > raio * 0.35) c = esc(c, 0.78);
    } else if (q.d1 < raio + 0.6 / T) c = esc(c, 0.7);
    if (r() < 0.06) c = esc(c, 0.78);
    return var_(c, r, 0.1);
  };
  P(0, (x, y, r) => gramaPx(x, y, r));
  // 1 grama lado: franja irregular que "escorre", sombrinha embaixo
  {
    const rr = rngSemente(303);
    const fr = Array.from({ length: 16 }, () => 2 + Math.floor(rr() * 2) + (rr() < 0.3 ? 2 + Math.floor(rr() * 2.5) : 0));
    const jit = Array.from({ length: T }, () => (rr() < 0.4 ? px : 0));
    P(1, (x, y, r, u, v) => {
      const h = fr[Math.floor(u)] + jit[x];
      if (v < h) { const c = gramaPx(x, (y + 5 * S) % T, r); const k = 1.05 - (v / h) * 0.25; return [c[0] * k, c[1] * k, c[2] * k, 255]; }
      const c = terraPx(x, y, r);
      if (v < h + px * Math.max(1, S)) return [c[0] * 0.66, c[1] * 0.66, c[2] * 0.66, 255];
      return c;
    });
  }
  P(2, (x, y, r) => terraPx(x, y, r));
  // 3 pedra: manchas em duas escalas, veios claros/escuros suaves e grãos (sem desenho que "repete")
  {
    const nP = N(401, 4), nP2 = N(402, 8), nP3 = N(403, 16);
    P(3, (x, y, r) => {
      const t = clamp01(nP(x, y) * 0.45 + nP2(x, y) * 0.5 + nP3(x, y) * 0.3 - 0.12);
      let c = mix(hex(0x80838b), hex(0x9fa2a9), t);
      const veio = Math.abs(nP2(x, y) - 0.5);
      if (veio < 0.025) c = esc(c, 0.86); else if (veio < 0.05) c = esc(c, 1.05);
      const q = r();
      if (q < 0.05) c = esc(c, 0.88); else if (q < 0.08) c = esc(c, 1.08);
      return var_(c, r, 0.06);
    });
  }
  // 4 areia: ondinhas de vento e grãos
  {
    const nA = N(501, 4);
    P(4, (x, y, r, u, v) => {
      const onda = Math.sin((v + nA(x, y) * 4) * 1.5) * 0.04;
      let c = esc(hex(0xecd9a0), 0.97 + onda);
      const q = r();
      if (q < 0.07) c = hex(0xd5bb80); else if (q < 0.11) c = hex(0xfbefc6); else if (q < 0.12) c = hex(0xb9a27a);
      return var_(c, r, 0.05);
    });
  }
  // 5 água (o shader da água não usa; serve para ícone)
  P(5, (x, y, r) => { const c = var_(hex(0x3aa6c8), r, 0.1); c[3] = 255; return c; });
  // 6 tronco topo: anéis tortinhos, miolo escuro, rachadura e casca na borda
  {
    const nR = N(601, 4);
    P(6, (x, y, r, u, v) => {
      const b = Math.min(u, v, 16 - u, 16 - v);
      if (b < 1.2) return var_(r() < 0.35 ? hex(0x4a3019) : hex(0x6b4a2b), r, 0.12);
      const d = Math.hypot(u - 8, v - 8) + nR(x, y) * 1.5;
      if (d < 0.9) return var_(hex(0x7d5a35), r, 0.08);
      if (Math.abs(u - 8 - (v - 8) * 0.15) < px * 0.9 && v > 9 && v < 14) return var_(hex(0x7d5a35), r, 0.1);
      const anel = fracP(d * 0.55);
      const c = anel < 0.22 ? hex(0xa77d4a) : mix(hex(0xd0aa72), hex(0xbb9460), anel);
      return var_(b < 2 ? esc(c, 0.86) : c, r, 0.06);
    });
  }
  // 7 tronco lado: casca com sulcos ondulados e placas com relevo
  {
    const nC = N(701, 4), nC2 = N(702, 8);
    P(7, (x, y, r, u, v) => {
      const onda = (nC(x, y) - 0.5) * 2.4;
      const f = fracP((u + onda) / 4); // 4 placas por bloco
      let c = esc(hex(0x7a5634), 0.85 + nC2(x, y) * 0.3);
      if (f < 0.16) c = hex(0x452b16);
      else if (f < 0.26) c = esc(c, 1.18); // beirada da placa pega luz
      else if (f > 0.86) c = esc(c, 0.8);
      if (r() < 0.05) c = esc(c, 0.85);
      return var_(c, r, 0.08);
    });
  }
  // 8 folhas: folhinhas recortadas (células) com centro claro, beirada escura e vãos
  {
    const cel = celulasTile(801, 26, 1.3);
    const nF = N(802, 4);
    P(8, (x, y, r) => {
      const q = cel(x / T, y / T);
      const luz = clamp01(nF(x, y) * 0.9 + q.val * 0.4 - 0.15);
      let c = mix(hex(0x2f7426), hex(0x63bb45), luz);
      if (q.borda < 0.012) c = hex(0x1d4f18); // vão entre folhas
      else if (q.dy < -0.02 && q.d1 > 0.025) c = esc(c, 1.12); // topo da folha pega luz
      else if (q.dy > 0.03) c = esc(c, 0.86);
      if (r() < 0.04) c = hex(0x86d264);
      return var_(c, r, 0.08);
    });
  }
  // 9 tábuas: 4 tábuas com tom próprio, veio, frestas com relevo e preguinhos
  {
    const rr = rngSemente(901);
    const tomT = [0, 1, 2, 3].map(() => 0.9 + rr() * 0.18);
    const nV = N(902, 8);
    P(9, (x, y, r, u, v) => {
      const t = Math.floor(v / 4), lv = v - t * 4;
      const junta = t % 2 ? 4 : 11;
      if (lv >= 4 - px || Math.abs(u - junta) < px * 0.6) return var_(hex(0x6e4a28), r, 0.08);
      if (Math.abs(u - (junta + 1.5)) < 0.6 && Math.abs(lv - 1.5) < 0.6) return [96, 80, 70, 255];
      if (Math.abs(u - (junta - 1.6)) < 0.6 && Math.abs(lv - 1.5) < 0.6) return [96, 80, 70, 255];
      const veio = Math.sin(u * 0.7 + nV(x, y) * 7 + t * 2.3) * 0.07 + Math.sin(u * 2.9 + t) * 0.02;
      let k = tomT[t] + veio;
      if (lv < px) k += 0.1; else if (lv > 4 - 2 * px) k -= 0.1;
      return var_(esc(hex(0xc8995a), k), r, 0.05);
    });
  }
  // 10 vidro (moldura + reflexo + centro transparente)
  P(10, (x, y, r, u, v) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 1) return [220, 240, 255, 255];
    if (b < 1 + px) return [160, 190, 210, 255];
    const dg = u - v;
    if ((dg > 0 && dg < 1.2 && u > 3 && u < 9) || (dg > 2.2 && dg < 2.8 && u > 5 && u < 10)) return [255, 255, 255, 190];
    return [180, 220, 255, 0];
  });
  // 11 tijolo: tom por tijolo, argamassa funda, luz em cima/esquerda e sombra embaixo/direita
  {
    const rr = rngSemente(1101);
    const tomB = Array.from({ length: 16 }, () => 0.84 + rr() * 0.24);
    P(11, (x, y, r, u, v) => {
      const linha = Math.floor(v / 4), desl = linha % 2 ? 4 : 0;
      const lu = (u + desl) % 8, lv = v - linha * 4;
      if (lv >= 4 - px || lu >= 8 - px) return var_(hex(0xcfc6b8), r, 0.08);
      let k = tomB[linha * 2 + (Math.floor((u + desl) / 8) & 1)];
      if (lv < px || lu < px) k *= 1.14; else if (lv >= 4 - 2 * px || lu >= 8 - 2 * px) k *= 0.82;
      const c = r() < 0.05 ? hex(0x8f3c2a) : hex(0xb5523b);
      return var_(esc(c, k), r, 0.08);
    });
  }
  // flores e capim (fundo transparente)
  const flor = (cor, centro) => (x, y, r, u, v) => {
    const dx = u - 8, dy = v - 6, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    if (d < 1.5) return var_(hex(centro), r, 0.1);
    const pet = 4.2 * (0.72 + 0.28 * Math.cos(a * 5));
    if (d < pet) return var_(esc(hex(cor), 1.08 - (d / pet) * 0.25), r, 0.08);
    if (Math.abs(u - 8) < 1 && v > 9) return var_(esc(hex(0x3f8f2c), u < 8 ? 1.1 : 0.9), r, 0.1);
    if (v > 10.5 && ((Math.abs(u - 5.5 - (v - 11) * 0.3) < 0.8 && v < 14) || (Math.abs(u - 10.5 + (v - 11) * 0.3) < 0.8 && v < 13))) return var_(hex(0x4fa83a), r, 0.15);
    return [0, 0, 0, 0];
  };
  P(12, flor(0xe8433f, 0xffe066));
  P(13, flor(0xffd23f, 0xb5651d));
  P(23, flor(0x5a8cff, 0xffffff));
  P(14, (x, y, r, u, v) => {
    const i = Math.floor(u);
    const h = [9, 13, 6, 11, 14, 8, 12, 10, 5, 13, 9, 12, 7, 11, 10, 8][i];
    const alto = 16 - v;
    if (alto < h && (i % 2 === 0 || alto < h - 3)) return var_(mix(hex(0x3f9a2c), hex(0x8ad864), alto / h), r, 0.15);
    return [0, 0, 0, 0];
  });
  // lãs: fiozinhos em diagonal
  const nL = N(1501, 8);
  const la = (c) => (x, y, r, u, v) => {
    const fio = Math.sin((u + v) * 2.2 + nL(x, y) * 4) * 0.06 + Math.sin((u - v) * 1.7) * 0.03;
    return var_(esc(hex(c), 0.97 + fio), r, 0.08);
  };
  P(15, la(0xf2f2ee));
  P(16, la(0xd9473c));
  P(17, la(0x3f6fd9));
  P(18, la(0xf2c72e));
  P(19, la(0x5cb83a));
  P(20, la(0xf29ac2));
  // 21 pedrisco: pedras arredondadas com luz em cima e sombra embaixo, rejunte escuro
  {
    const cel = celulasTile(2101, 9, 1.15);
    P(21, (x, y, r) => {
      const q = cel(x / T, y / T);
      if (q.borda < 0.03) return var_(hex(0x55575c), r, 0.1);
      const base = [hex(0x9a9ca3), hex(0x84868d), hex(0x908a83)][q.id % 3];
      let k = 1 - q.dy * 2.2 - q.dx * 0.8;
      if (q.borda < 0.055) k *= 0.85;
      return var_(esc(base, Math.max(0.7, Math.min(1.25, k))), r, 0.08);
    });
  }
  // 22 lampião: moldura de madeira, grade e luz quentinha
  P(22, (x, y, r, u, v) => {
    const b = Math.min(u, v, 16 - u, 16 - v);
    if (b < 2) return var_(b < px ? hex(0x4a3019) : hex(0x6b4a2b), r, 0.12);
    if (Math.abs(u - 8) < px * 0.8 || Math.abs(v - 8) < px * 0.8) return var_(hex(0x5a3d22), r, 0.1);
    const d = Math.hypot(u - 8, v - 8);
    return [255, 236 - d * 8, 130 - d * 7, 255];
  });
  // tiles antigos de 16px, ampliados para T
  const leg = { data: new Uint8ClampedArray(COLS * TILE * LINHAS * TILE * 4) };
  tilesLegado.clear();
  pintarLegado(leg);
  for (const idx of tilesLegado) {
    const ox = (idx % COLS) * T, oy = Math.floor(idx / COLS) * T;
    const lx = (idx % COLS) * TILE, ly = Math.floor(idx / COLS) * TILE;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = ((oy + y) * W + ox + x) * 4, j = ((ly + Math.floor(y / S)) * COLS * TILE + lx + Math.floor(x / S)) * 4;
      for (let k = 0; k < 4; k++) img.data[i + k] = leg.data[j + k];
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Atlas: 16px (leve, ícones e partículas) e 32px (mais detalhado). As coordenadas UV são as mesmas;
// trocar a resolução é só trocar a imagem da textura (tex.userData.definirHD(true/false)).
export function criarAtlas() {
  const cv16 = gerarAtlas(TILE);
  let cvHD = null;
  const tex = new THREE.CanvasTexture(cv16);
  tex.magFilter = THREE.NearestFilter;
  // mipmaps "pixelados": tira a cintilação ao longe sem borrar de perto
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.hd = false;
  tex.userData.definirHD = (hd) => {
    if (hd === tex.userData.hd) return;
    if (hd && !cvHD) cvHD = gerarAtlas(TILE * 2);
    tex.image = hd ? cvHD : cv16;
    tex.userData.hd = hd;
    tex.needsUpdate = true;
  };
  return { tex, canvas: cv16 };
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

// bancada (128 topo, 129 lado) e itens (130..136): graveto e ferramentas, desenhados na diagonal
function pintarCriacao(img) {
  const mad = hex(0xc89a5a), madEsc = hex(0x7a5634), cabo = hex(0x9a7040), caboEsc = hex(0x5a3d22);
  // 128 bancada topo: tampo de tábuas com grade de trabalho no meio
  pintarTile(img, 128, (x, y, r) => {
    const borda = x === 0 || y === 0 || x === 15 || y === 15;
    if (borda) return var_(madEsc, r, 0.1);
    const grade = x > 3 && x < 12 && y > 3 && y < 12;
    if (grade) return var_((x - 4) % 3 === 2 || (y - 4) % 3 === 2 ? madEsc : hex(0xb08955), r, 0.08);
    return var_(y % 4 === 3 ? hex(0x9a7040) : mad, r, 0.1);
  });
  // 129 bancada lado: pernas, gaveta e ferramentas penduradas
  pintarTile(img, 129, (x, y, r) => {
    if (y < 3) return var_(y === 2 ? madEsc : mad, r, 0.1);
    if (x < 2 || x > 13) return var_(madEsc, r, 0.1);
    if (y > 4 && y < 8 && x > 3 && x < 12) return var_(y === 6 && x > 6 && x < 9 ? hex(0xe6c056) : hex(0xa77a45), r, 0.08);
    if (x === 5 && y > 8 && y < 14) return var_(cabo, r, 0.1);
    if (y === 9 && x > 3 && x < 7) return var_(hex(0x8c8f96), r, 0.08);
    if (x === 10 && y > 9 && y < 14) return var_(cabo, r, 0.1);
    if (y > 8 && y < 11 && x > 9 && x < 13) return var_(hex(0x8c8f96), r, 0.08);
    return var_(y % 4 === 1 ? hex(0x8a6236) : hex(0xa77a45), r, 0.12);
  });
  // cabo diagonal (de baixo-esquerda até o meio) comum a todas as ferramentas
  const caboEm = (x, y) => (x + y === 15 || x + y === 16) && x >= 2 && x <= 10;
  const ferramenta = (cabeca) => (x, y, r) => {
    const c = cabeca(x, y);
    if (c) return var_(c, r, 0.08);
    if (caboEm(x, y)) return var_(x + y === 16 ? caboEsc : cabo, r, 0.08);
    return [0, 0, 0, 0];
  };
  const pedraC = hex(0x8c8f96), pedraE = hex(0x5f6166);
  // 130 graveto
  pintarTile(img, 130, (x, y, r) => {
    if (x + y === 15 && x >= 3 && x <= 12) return var_(cabo, r, 0.08);
    if (x + y === 16 && x >= 3 && x <= 12) return var_(caboEsc, r, 0.08);
    return [0, 0, 0, 0];
  });
  // picareta: arco no alto
  const picareta = (c, e) => (x, y) => {
    const d = Math.hypot(x - 4, y - 11.5);
    if (d > 9.6 && d < 11.8 && x >= 3 && y <= 9) return d > 11 ? e : c;
    return null;
  };
  pintarTile(img, 131, ferramenta(picareta(mad, madEsc)));
  pintarTile(img, 132, ferramenta(picareta(pedraC, pedraE)));
  // machado: lâmina larga no alto, de um lado do cabo
  const machado = (c, e) => (x, y) => {
    if (x >= 7 && x <= 13 && y >= 1 && y <= 7 && (x - 7) + (7 - y) >= 2 && x + y >= 9 && x + y <= 18) return x === 13 || y === 1 ? e : c;
    return null;
  };
  pintarTile(img, 133, ferramenta(machado(mad, madEsc)));
  pintarTile(img, 134, ferramenta(machado(pedraC, pedraE)));
  // pá: lâmina arredondada na ponta
  const pa = (c, e) => (x, y) => {
    const d = Math.hypot(x - 11.5, y - 4.5);
    if (d < 3.4) return d > 2.6 ? e : c;
    return null;
  };
  pintarTile(img, 135, ferramenta(pa(mad, madEsc)));
  pintarTile(img, 136, ferramenta(pa(pedraC, pedraE)));
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
  const cv = document.createElement('canvas');
  cv.width = cv.height = tam;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const src = (t) => [(t % COLS) * TILE, Math.floor(t / COLS) * TILE];
  if (!id) return cv; // mão vazia
  if (ehItem(id)) {
    const it = ITENS[id];
    if (it) {
      // copia o tile 1:1 antes de aumentar (senão o navegador puxa pixels do tile vizinho do atlas)
      const t = document.createElement('canvas'); t.width = t.height = TILE;
      const [sx, sy] = src(it.tile);
      t.getContext('2d').drawImage(atlasCanvas, sx, sy, TILE, TILE, 0, 0, TILE, TILE);
      ctx.drawImage(t, 0, 0, TILE, TILE, Math.round(tam * 0.08), Math.round(tam * 0.08), Math.round(tam * 0.84), Math.round(tam * 0.84));
    }
    return cv;
  }
  const b = BLOCOS[id];
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

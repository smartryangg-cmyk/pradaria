// Definição dos blocos e geração procedural do atlas de texturas (arte original, feita em código).
import * as THREE from '../vendor/three.module.min.js';
import { rngSemente } from './ruido.js';
import { DEFS_ERAS, PINTORES } from './blocos-eras.js';
import { pintarAtlas, reduzir, TILES_PINTADOS } from './texturas.js';
import { M, DEFS_MEC, PINTORES_MEC } from './blocos-mecanismos.js';
import { MV, DEFS_MOVEIS, PINTORES_MOVEIS } from './moveis.js';
export { M };
import { DEFS_FORMAS, INVENTARIO_FORMAS } from './formas-defs.js';
export { INVENTARIO_FORMAS };

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


// mecanismos das construções (portas, catavento, mó, forno...): IDs 47..59, veja blocos-mecanismos.js
for (const [id, nome, tiles, o] of DEFS_MEC) def(id, nome, tiles, o);
// formas que não são cubos (80..99): veja formas-defs.js e formas.js
for (const [id, nome, tiles, o] of DEFS_FORMAS) def(id, nome, tiles, o);
// móveis das casas (cama, cadeira, mesa, balcão, estantes): IDs 176..187, veja moveis.js
for (const [id, nome, tiles, o] of DEFS_MOVEIS) def(id, nome, tiles, o);

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
  M.PORTA, M.FORNO, M.FARINHA, M.PAO,
  MV.CAMA, MV.CADEIRA, MV.MESA, MV.BALCAO, MV.ESTANTE, MV.ESTANTE_PAO,
];
// aba "Engenharia" do inventário
export const INVENTARIO_MAQUINAS = [
  E.ALAVANCA, E.BOTAO, E.PLACA, E.SENSOR, E.PISCA, E.FIO,
  E.LAMPADA, E.PORTAO, E.VENTILADOR, E.SINO, E.CONFETE, E.TRAMPOLIM, E.ESTEIRA,
  M.CATAVENTO, M.CABO, M.MO, M.SARILHO,
];

export const TILE = 16;
export const COLS = 8;
export const LINHAS = 32; // tiles 64..127: eras (blocos-eras.js); 128..: bancada e itens (pintarCriacao)

function hex(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }

const var_ = (c, r, amt) => { const k = 1 + (r() - 0.5) * amt; return [c[0] * k, c[1] * k, c[2] * k, 255]; };

// ---------- texturas ----------
// A arte de todos os tiles está em texturas.js (pintada em "unidades de 16", com relevo).
// Resoluções: 16px (Leve, ícones, partículas, mapa), 32px (Bonita) e 64px (Linda/Ultra).
// As UVs são as mesmas em todas; trocar a resolução é só trocar a imagem da textura.

// Caminho antigo e compatível: quem quiser um tile simples de 16px pinta com pintarTile(img, idx, fn)
// dentro de pintarLegado. Esses tiles valem onde texturas.js não pinta nada e são ampliados (pixelado).
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
// tiles de 16px "à moda antiga": valem só onde texturas.js não pinta (ex.: itens 130..136)
function pintarLegado(img) {
  for (const t in PINTORES) pintarTile(img, +t, PINTORES[t]); // eras (texturas.js pinta por cima)
  pintarCriacao(img);
  for (const [t, fn] of Object.entries(PINTORES_MEC)) pintarTile(img, +t, fn);
  for (const [t, fn] of Object.entries(PINTORES_MOVEIS)) pintarTile(img, +t, fn);
}
let legado = null;
function aplicarLegado(dados, T) {
  if (!legado) { legado = { data: new Uint8ClampedArray(COLS * TILE * LINHAS * TILE * 4) }; tilesLegado.clear(); pintarLegado(legado); }
  const W = COLS * T, S = T / TILE, pintados = new Set(TILES_PINTADOS);
  for (const idx of tilesLegado) {
    if (pintados.has(idx)) continue;
    const ox = (idx % COLS) * T, oy = Math.floor(idx / COLS) * T;
    const lx = (idx % COLS) * TILE, ly = Math.floor(idx / COLS) * TILE;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const i = ((oy + y) * W + ox + x) * 4, j = ((ly + Math.floor(y / S)) * COLS * TILE + lx + Math.floor(x / S)) * 4;
      for (let k = 0; k < 4; k++) dados[i + k] = legado.data[j + k];
    }
  }
  return dados;
}
function canvasDe(dados, T) {
  const cv = document.createElement('canvas');
  cv.width = COLS * T; cv.height = LINHAS * T;
  // o 16px é lido muitas vezes (partículas, ícones, mapa)
  const ctx = cv.getContext('2d', T === TILE ? { willReadFrequently: true } : undefined);
  const img = ctx.createImageData(cv.width, cv.height);
  img.data.set(aplicarLegado(dados, T));
  ctx.putImageData(img, 0, 0);
  return cv;
}

// pinta o atlas de T px em workers (divide os tiles entre eles); sem worker, pinta aqui mesmo
function pintarEmWorkers(T) {
  const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
  let ws;
  try { ws = Array.from({ length: n }, () => new Worker(new URL('./texturas-worker.js', import.meta.url), { type: 'module' })); }
  catch { return Promise.resolve(pintarAtlas(T)); }
  // reparte por custo parecido: alterna os tiles entre os workers
  const listas = ws.map(() => []);
  TILES_PINTADOS.forEach((idx, k) => listas[k % n].push(idx));
  const W = COLS * T, total = new Uint8ClampedArray(W * LINHAS * T * 4);
  return Promise.all(ws.map((w, k) => new Promise((ok, falha) => {
    w.onmessage = (e) => {
      const { lista, dados } = e.data;
      for (const idx of lista) {
        const ox = (idx % COLS) * T, oy = Math.floor(idx / COLS) * T;
        for (let y = 0; y < T; y++) { const i = ((oy + y) * W + ox) * 4; total.set(dados.subarray(i, i + T * 4), i); }
      }
      w.terminate(); ok();
    };
    w.onerror = (e) => { w.terminate(); falha(e); };
    w.postMessage({ id: k, T, lista: listas[k] });
  }))).then(() => total, () => pintarAtlas(T));
}

// Atlas: começa em 16px (feito do 32px reduzido). tex.userData.definirResolucao(16|32|64) troca a imagem;
// 32 e 64 são gerados na primeira vez que forem pedidos (64 em workers, sem travar o jogo).
export function criarAtlas() {
  const t0 = performance.now();
  const d32 = pintarAtlas(32);
  const cv16 = canvasDe(reduzir(d32, 32), TILE);
  const canvases = { 16: cv16 };
  let d32guardado = d32, pedido64 = null;
  const tempos = { 16: performance.now() - t0 };
  const tex = new THREE.CanvasTexture(cv16);
  tex.magFilter = THREE.NearestFilter;
  // mipmaps "pixelados": tira a cintilação ao longe sem borrar de perto
  tex.minFilter = THREE.NearestMipmapNearestFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.resolucao = 16;
  tex.userData.tempos = tempos; // ms de geração por resolução (medição)
  let alvo = 16;
  const usar = (res) => {
    if (alvo !== res || !canvases[res] || tex.userData.resolucao === res) return;
    tex.dispose(); // o tamanho muda: a GPU precisa de uma textura nova (a antiga tem tamanho fixo)
    tex.image = canvases[res];
    tex.userData.resolucao = res;
    tex.needsUpdate = true;
  };
  tex.userData.definirResolucao = (res) => {
    res = res >= 64 ? 64 : res >= 32 ? 32 : 16;
    alvo = res;
    if (res === 32 && !canvases[32]) {
      const t1 = performance.now();
      canvases[32] = canvasDe(d32guardado || pintarAtlas(32), 32);
      d32guardado = null;
      tempos[32] = performance.now() - t1;
    }
    if (res === 64 && !canvases[64] && !pedido64) {
      const t1 = performance.now();
      pedido64 = pintarEmWorkers(64).then((d) => { canvases[64] = canvasDe(d, 64); tempos[64] = performance.now() - t1; usar(alvo); });
    }
    usar(res);
  };
  tex.userData.definirHD = (hd) => tex.userData.definirResolucao(hd ? 32 : 16); // nome antigo
  return { tex, canvas: cv16 };
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

// ícones feitos à mão (formas redondas): formas.js registra aqui ICONES_ESPECIAIS.fn(ctx, id, tam, atlas)
export const ICONES_ESPECIAIS = { fn: null };

// desenha o ícone de um bloco em um canvas pequeno (para a barra e o inventário)
export function iconeBloco(atlasCanvas, id, tam = 40) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = tam;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (ICONES_ESPECIAIS.fn && ICONES_ESPECIAIS.fn(ctx, id, tam, atlasCanvas)) return cv;
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

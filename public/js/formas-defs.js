// Formas que não são cubos: troncos redondos, colunas, cercas, vidro fino, canos, bolas, cúpulas,
// meio bloco, rampas, escadas e roda. Números 80..99 (reservados para as formas).
// Este arquivo não importa nada (o servidor e o worker podem usar os números).
export const F = {
  TRONCO_R: 80, TRONCO_R_PINHEIRO: 81, TRONCO_R_BETULA: 82,
  COLUNA: 83, CERCA: 84, VIDRO_FINO: 85, CANO: 86,
  BOLA: 87, CUPULA: 88, CUPULA_VIDRO: 89, LAJE: 90,
  RAMPA: 91,  // 91..94: subindo para +x, +z, -x, -z
  ESCADA: 95, // 95..98: subindo para +x, +z, -x, -z
  RODA: 99,
};
export const F_MIN = 80, F_MAX = 99;
export const ehForma = (b) => b >= F_MIN && b <= F_MAX;

// [id, nome, tiles [cima, baixo, lados], opções]  (tiles já existentes no atlas)
const forma = (tipo, extra = {}) => ({ solido: true, opaco: false, forma: tipo, ...extra });
export const DEFS_FORMAS = [
  [F.TRONCO_R, 'Tronco redondo', [6, 6, 7], forma('tronco')],
  [F.TRONCO_R_PINHEIRO, 'Tronco redondo de pinheiro', [6, 6, 36], forma('tronco')],
  [F.TRONCO_R_BETULA, 'Tronco redondo de bétula', [6, 6, 38], forma('tronco')],
  [F.COLUNA, 'Coluna redonda', [3, 3, 3], forma('coluna')],
  [F.CERCA, 'Cerca', [9, 9, 9], forma('cerca')],
  [F.VIDRO_FINO, 'Vidro fino', [10, 10, 10], forma('vidrofino')],
  [F.CANO, 'Cano', [55, 55, 55], forma('cano')],
  [F.BOLA, 'Bola de pedra', [3, 3, 3], forma('bola')],
  [F.CUPULA, 'Cúpula', [11, 11, 11], forma('cupula')],
  [F.CUPULA_VIDRO, 'Cúpula de vidro', [10, 10, 10], forma('cupula')],
  [F.LAJE, 'Meio bloco', [3, 3, 3], forma('laje')],
  ...[0, 1, 2, 3].map((d) => [F.RAMPA + d, 'Rampa', [21, 21, 21], forma('rampa')]),
  ...[0, 1, 2, 3].map((d) => [F.ESCADA + d, 'Escada', [9, 9, 9], forma('escada')]),
  [F.RODA, 'Roda', [9, 9, 9], forma('roda')],
];

// aba "Formas" do inventário (rampa e escada viram para onde o jogador olha)
export const INVENTARIO_FORMAS = [
  F.TRONCO_R, F.TRONCO_R_PINHEIRO, F.TRONCO_R_BETULA, F.COLUNA, F.CERCA, F.VIDRO_FINO, F.CANO,
  F.BOLA, F.CUPULA, F.CUPULA_VIDRO, F.LAJE, F.RAMPA, F.ESCADA, F.RODA,
];
// peças com direção: o número base e quantas variações
export const DIRECIONAL = { [F.RAMPA]: 4, [F.ESCADA]: 4 };
// base de uma peça (rampa virada para -x continua sendo "Rampa")
export const baseForma = (b) => (b >= F.RAMPA && b < F.RAMPA + 4 ? F.RAMPA : b >= F.ESCADA && b < F.ESCADA + 4 ? F.ESCADA : b);

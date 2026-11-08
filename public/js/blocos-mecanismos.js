// Blocos dos mecanismos das construções: portas, catavento que gera energia, mó do moinho,
// cabo de energia, forno, saco de farinha, pão e a manivela do poço.
// IDs 47..59 e tiles do atlas 41..47 e 120 (desenhados em 16px, como os tiles "legado").
// Este arquivo não importa nada (o servidor usa os números da farinha e do pão).

export const M = {
  PORTA: 47, PORTA_ABERTA: 48, // porta de madeira (o jogador abre e fecha; fica salvo)
  CATAVENTO: 49, CATAVENTO_GIRANDO: 50, // caixa de engrenagens com a hélice: gera energia quando venta
  MO: 51, MO_GIRANDO: 52, // pedra de moinho: gira com energia e transforma trigo em farinha
  CABO: 53, CABO_LIGADO: 54, // poste de madeira com fio de cobre (leva energia para cima e para baixo)
  FORNO: 55, FORNO_ACESO: 56, // forno a lenha: toque para acender; assa a farinha em pão
  FARINHA: 57, PAO: 58,
  SARILHO: 59, // manivela do poço: toque para tirar um balde de água
};
const T = { PORTA: 41, CAIXA: 42, MO: 43, CABO: 44, FORNO: 45, FORNO_ACESO: 46, FARINHA: 47, PAO: 120 };
export const TILES_MEC = T;

// id, nome, tiles [cima, baixo, lados], opções
export const DEFS_MEC = [
  [M.PORTA, 'Porta', T.PORTA, { opaco: false, forma: 'porta' }],
  [M.PORTA_ABERTA, 'Porta', T.PORTA, { solido: false, opaco: false, forma: 'porta' }],
  [M.CATAVENTO, 'Catavento', [9, 9, T.CAIXA], {}],
  [M.CATAVENTO_GIRANDO, 'Catavento', [9, 9, T.CAIXA], { brilho: 0.15 }],
  [M.MO, 'Pedra de moinho', [T.MO, 3, 3], { opaco: false, forma: 'mo' }],
  [M.MO_GIRANDO, 'Pedra de moinho', [T.MO, 3, 3], { opaco: false, forma: 'mo' }],
  [M.CABO, 'Cabo de energia', [6, 6, T.CABO], {}],
  [M.CABO_LIGADO, 'Cabo de energia', [6, 6, T.CABO], { brilho: 0.35 }],
  [M.FORNO, 'Forno', [3, 3, T.FORNO], {}],
  [M.FORNO_ACESO, 'Forno', [3, 3, T.FORNO_ACESO], { brilho: 0.9 }],
  [M.FARINHA, 'Saco de farinha', T.FARINHA, {}],
  [M.PAO, 'Cesta de pão', [T.PAO, 9, 9], {}],
  [M.SARILHO, 'Manivela do poço', [9, 9, 7], { solido: false, opaco: false, forma: 'sarilho', chao: false }],
];

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const vr = (c, r, a = 0.15) => { const k = 1 + (r() - 0.5) * a; return [c[0] * k, c[1] * k, c[2] * k, 255]; };

// desenhos 16x16: (x, y, r) -> [r, g, b, a]
export const PINTORES_MEC = {
  // porta: tábuas verticais com moldura, travessas e maçaneta
  [T.PORTA]: (x, y, r) => {
    if (x === 0 || x === 15 || y === 0 || y === 15) return vr(hex(0x5a3a1e), r, 0.08);
    if (y === 4 || y === 11) return vr(hex(0x6b4524), r, 0.08);
    if (x === 12 && (y === 7 || y === 8)) return [235, 196, 70, 255];
    return vr(x % 4 === 0 ? hex(0x7a5030) : hex(0xa8743f), r, 0.1);
  },
  // caixa de engrenagens do catavento (madeira com engrenagem de metal)
  [T.CAIXA]: (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5), a = Math.atan2(y - 7.5, x - 7.5);
    if (d < 1.6) return [70, 70, 76, 255];
    if (d < 5 + (Math.cos(a * 8) > 0.3 ? 1.2 : 0)) return vr(d < 3.2 ? hex(0x8a8f96) : hex(0xb4bac2), r, 0.08);
    if (x === 0 || x === 15 || y === 0 || y === 15) return vr(hex(0x5a3a1e), r, 0.08);
    return vr(y % 4 === 0 ? hex(0x7a5030) : hex(0x9c6a3a), r, 0.12);
  },
  // pedra de moinho vista de cima: sulcos em raios e furo no meio
  [T.MO]: (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5), a = Math.atan2(y - 7.5, x - 7.5);
    if (d < 1.5) return [60, 50, 40, 255];
    const sulco = Math.abs(Math.sin(a * 4 + d * 0.25)) < 0.18;
    return vr(sulco ? hex(0x6c6e72) : hex(0xa4a29a), r, 0.14);
  },
  // cabo: poste de madeira com faixa de cobre no meio
  [T.CABO]: (x, y, r) => {
    if (x >= 6 && x <= 9) return vr(x === 6 || x === 9 ? hex(0x7a3b22) : hex(0xc8642c), r, 0.08);
    if (y % 5 === 2 && (x === 5 || x === 10)) return [90, 90, 96, 255];
    return vr(x % 3 === 0 ? hex(0x6b4524) : hex(0x8a5a30), r, 0.12);
  },
  // forno de pedra com a boca arredondada (apagado e aceso)
  [T.FORNO]: (x, y, r) => forno(x, y, r, false),
  [T.FORNO_ACESO]: (x, y, r) => forno(x, y, r, true),
  // saco de farinha: pano claro amarrado em cima
  [T.FARINHA]: (x, y, r) => {
    if (y < 3 && Math.abs(x - 7.5) > 3) return vr(hex(0xd8ccb0), r, 0.06);
    if (y === 3) return vr(hex(0xb08a50), r, 0.06);
    if (x === 0 || x === 15) return vr(hex(0xcdbf9e), r, 0.06);
    if (y > 7 && y < 12 && x > 4 && x < 11) return (x + y) % 2 ? [200, 160, 60, 255] : vr(hex(0xf4ede0), r, 0.04);
    return vr(hex(0xf0e8d8), r, 0.07);
  },
  // cesta de pão vista de cima: pãezinhos dourados
  [T.PAO]: (x, y, r) => {
    if (x === 0 || x === 15 || y === 0 || y === 15) return vr(hex(0x8a5a30), r, 0.1);
    const p = [[5, 5], [10.5, 5.5], [5.5, 10.5], [10.5, 10.5]].some(([a, b]) => Math.hypot(x - a, (y - b) * 1.3) < 3);
    if (p) return vr((x + y) % 5 === 0 ? hex(0xf0c070) : hex(0xd08a38), r, 0.1);
    return vr((x + y) % 2 ? hex(0xb08050) : hex(0xc89a60), r, 0.1);
  },
};
function forno(x, y, r, aceso) {
  const boca = y > 6 && y < 15 && Math.abs(x - 7.5) < 4.5 && !(y < 9 && Math.abs(x - 7.5) > 3.5 - (8 - y));
  if (boca) {
    if (!aceso) return [34, 28, 26, 255];
    const t = (y - 7) / 8;
    return r() < 0.25 ? [255, 230, 120, 255] : [255, 120 + t * 80, 30, 255];
  }
  const tijolo = (y % 4 === 3) || ((x + (Math.floor(y / 4) % 2) * 4) % 8 === 0);
  return vr(tijolo ? hex(0x6c6a66) : hex(0xa49e94), r, 0.12);
}

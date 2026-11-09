// Móveis das casas: cama, cadeira, mesa, balcão e estantes. IDs 176..187 e tiles do atlas 160..165.
// Cama e cadeira têm 4 giros seguidos (cabeceira / frente para +x, +z, -x, -z), como as escadas.
// Usados pelas plantas de casas.js (vilas e pedreiro) e também dá para colocar com a mão.
// Este arquivo não importa nada (o servidor usa os números).

export const MV = { CAMA: 176, CADEIRA: 180, MESA: 184, BALCAO: 185, ESTANTE: 186, ESTANTE_PAO: 187 };
const T = { COLCHA: 160, LENCOL: 161, MADEIRA: 162, LIVROS: 163, PAES: 164, BALCAO: 165 };
export const TILES_MOVEIS = T;
export const ehGiravel = (b) => (b >= MV.CAMA && b < MV.CAMA + 4) || (b >= MV.CADEIRA && b < MV.CADEIRA + 4);
export const baseMovel = (b) => (b >= MV.CAMA && b < MV.CAMA + 4 ? MV.CAMA : b >= MV.CADEIRA && b < MV.CADEIRA + 4 ? MV.CADEIRA : b);

// id, nome, tiles [cima, baixo, lados], opções
export const DEFS_MOVEIS = [
  ...[0, 1, 2, 3].map((d) => [MV.CAMA + d, 'Cama', [T.COLCHA, T.MADEIRA, T.MADEIRA], { opaco: false, forma: 'movel', icone: T.COLCHA }]),
  ...[0, 1, 2, 3].map((d) => [MV.CADEIRA + d, 'Cadeira', [T.MADEIRA, T.MADEIRA, T.MADEIRA], { opaco: false, forma: 'movel', icone: T.MADEIRA }]),
  [MV.MESA, 'Mesa', [T.MADEIRA, T.MADEIRA, T.MADEIRA], { opaco: false, forma: 'movel', icone: T.MADEIRA }],
  [MV.BALCAO, 'Balcão', [T.MADEIRA, T.MADEIRA, T.BALCAO], {}],
  [MV.ESTANTE, 'Estante de livros', [T.MADEIRA, T.MADEIRA, T.LIVROS], {}],
  [MV.ESTANTE_PAO, 'Prateleira de pães', [T.MADEIRA, T.MADEIRA, T.PAES], {}],
];

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const vr = (c, r, a = 0.15) => { const k = 1 + (r() - 0.5) * a; return [c[0] * k, c[1] * k, c[2] * k, 255]; };

// desenhos 16x16: (x, y, r) -> [r, g, b, a]
export const PINTORES_MOVEIS = {
  // colcha de retalhos (vermelho e creme, com costura)
  [T.COLCHA]: (x, y, r) => {
    if (x % 8 === 0 || y % 8 === 0) return vr(hex(0xf3e6c8), r, 0.06);
    return vr(((x >> 3) + (y >> 3)) % 2 ? hex(0xc8443a) : hex(0xe0644f), r, 0.1);
  },
  // lençol/travesseiro branco
  [T.LENCOL]: (x, y, r) => vr(y % 5 === 0 ? hex(0xe2ddd2) : hex(0xf7f4ec), r, 0.05),
  // madeira escura envernizada dos móveis
  [T.MADEIRA]: (x, y, r) => vr(y % 4 === 0 ? hex(0x5c3a1f) : (x * 7 + y) % 11 === 0 ? hex(0x6b4426) : hex(0x84552e), r, 0.1),
  // estante: livros coloridos em duas prateleiras
  [T.LIVROS]: (x, y, r) => {
    if (x === 0 || x === 15 || y === 0 || y === 7 || y === 8 || y === 15) return vr(hex(0x5c3a1f), r, 0.08);
    const cores = [0xb23a3a, 0x3a6ab2, 0x3e9a4a, 0xd9a42a, 0x7a4ab2, 0xe07a3a];
    const livro = Math.floor((x - 1) / 2) + (y > 7 ? 3 : 0);
    if ((y === 1 || y === 9) && livro % 3 === 1) return vr(hex(0x3a2412), r, 0.05); // livro mais baixo
    return vr(hex(cores[livro % cores.length]), r, (x - 1) % 2 ? 0.25 : 0.08);
  },
  // prateleira de pães (pães dourados em cestinhas)
  [T.PAES]: (x, y, r) => {
    if (x === 0 || x === 15 || y === 0 || y === 7 || y === 8 || y === 15) return vr(hex(0x5c3a1f), r, 0.08);
    const cx = (x % 5) - 2, cy = (y % 8) - 4;
    if (cx * cx + cy * cy * 1.6 < 5) return vr(cy < -1 ? hex(0xe8b25a) : hex(0xc98a3a), r, 0.12);
    return vr(hex(0x3a2412), r, 0.06);
  },
  // frente do balcão: painéis de madeira com moldura
  [T.BALCAO]: (x, y, r) => {
    if (y <= 1) return vr(hex(0x5c3a1f), r, 0.06);
    if (x === 0 || x === 15 || y === 15 || ((x === 2 || x === 13) && y > 3) || ((y === 3 || y === 13) && x > 1 && x < 14)) return vr(hex(0x6b4426), r, 0.08);
    return vr(hex(0x9a6a3a), r, 0.12);
  },
};

// desenho em 3D (chamado pelo gerador de malha). caixa(x0,y0,z0,x1,y1,z1, tile, girarTopo, tileTopo)
// em coordenadas do bloco (0..1). d = giro: para onde fica a cabeceira (cama) ou para onde se olha (cadeira)
export function desenharMovel(caixa, b) {
  const g = baseMovel(b), d = b - g;
  // gira um retângulo de "olhando para +z" para a direção d (0 = +x, 1 = +z, 2 = -x, 3 = -z)
  const giro = (x0, y0, z0, x1, y1, z1, t, tt) => {
    let a = [x0, z0, x1, z1];
    if (d === 0) a = [z0, 1 - x1, z1, 1 - x0]; // +z -> +x
    else if (d === 2) a = [1 - z1, x0, 1 - z0, x1]; // +z -> -x
    else if (d === 3) a = [1 - x1, 1 - z1, 1 - x0, 1 - z0]; // +z -> -z
    caixa(a[0], y0, a[1], a[2], y1, a[3], t, 0, tt ?? t);
  };
  if (g === MV.MESA) {
    caixa(0.02, 0.8, 0.02, 0.98, 0.94, 0.98, T.MADEIRA);
    for (const [x, z] of [[0.08, 0.08], [0.8, 0.08], [0.08, 0.8], [0.8, 0.8]]) caixa(x, 0, z, x + 0.12, 0.8, z + 0.12, T.MADEIRA);
  } else if (g === MV.CADEIRA) {
    // assento, 4 pés e o encosto do lado de trás (quem senta olha para +z antes de girar)
    giro(0.18, 0.45, 0.18, 0.82, 0.55, 0.82, T.MADEIRA);
    for (const [x, z] of [[0.2, 0.2], [0.7, 0.2], [0.2, 0.7], [0.7, 0.7]]) giro(x, 0, z, x + 0.1, 0.45, z + 0.1, T.MADEIRA);
    giro(0.18, 0.55, 0.18, 0.82, 1.05, 0.28, T.MADEIRA);
  } else if (g === MV.CAMA) {
    // estrado, colchão com colcha, travesseiro e cabeceira (a cabeceira fica no lado +z antes de girar)
    giro(0.02, 0.12, 0.02, 0.98, 0.3, 0.98, T.MADEIRA);
    for (const [x, z] of [[0.04, 0.04], [0.84, 0.04], [0.04, 0.84], [0.84, 0.84]]) giro(x, 0, z, x + 0.12, 0.12, z + 0.12, T.MADEIRA);
    giro(0.06, 0.3, 0.04, 0.94, 0.52, 0.72, T.COLCHA, T.COLCHA);
    giro(0.06, 0.3, 0.72, 0.94, 0.48, 0.9, T.LENCOL, T.LENCOL);
    giro(0.14, 0.48, 0.72, 0.86, 0.62, 0.88, T.LENCOL, T.LENCOL); // travesseiro
    giro(0.02, 0.12, 0.9, 0.98, 0.95, 0.98, T.MADEIRA);
  }
}

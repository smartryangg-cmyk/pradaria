// Blocos do mundo "Linha do Tempo" (eras). IDs de bloco 128..175 e tiles do atlas 64..127
// (as máquinas usam IDs 100..126 e tiles 48..63).
// Este arquivo não importa nada (serve também para o servidor), e as texturas são desenhadas
// por funções (x, y, r) -> [r, g, b, a?] num tile de 16x16, com r() = aleatório com semente.

export const BE = {
  // Era dos Dinossauros
  MUSGO: 128, SAMAMBAIA: 129, CAVALINHA: 130, TRONCO_PALMEIRA: 131, FOLHA_PALMEIRA: 132, BASALTO: 133, PEDRA_LAVA: 134, OVO_DINO: 135, FOSSIL: 136,
  // Era do Gelo
  NEVE: 137, GELO: 138, FOLHAS_NEVE: 139, BLOCO_NEVE: 140, PELE: 141,
  // Idade da Pedra
  FOGUEIRA: 142, PALHA: 143, PINTURA_RUPESTRE: 144, BARRO: 145,
  // Antiguidade
  ARENITO: 146, ARENITO_ENTALHADO: 147, MARMORE: 148, COLUNA: 149, TERRACOTA: 150, OURO: 151, MOSAICO: 152,
  // Idade Média
  PEDRA_CASTELO: 153, ENXAIMEL: 154, ESTANDARTE: 155, VITRAL: 156,
  // Era Industrial
  TIJOLO_FABRICA: 157, FERRO: 158, ENGRENAGEM: 159, CARVAO: 160,
  // Era Moderna
  CONCRETO: 161, ASFALTO: 162, ASFALTO_FAIXA: 163, VIDRO_AZUL: 164, AZULEJO: 165, LUZ_LED: 166,
  // Futuro
  PAINEL_SOLAR: 167, METAL_BRANCO: 168, NEON: 169, CRISTAL: 170,
};

// id, nome, tiles [cima, baixo, lados] (ou um número), opções (solido, opaco, planta, brilho 0..1)
// tiles < 64 são os do jogo base (2 = terra, 3 = pedra, 4 = areia)
export const DEFS_ERAS = [
  [BE.MUSGO, 'Musgo', [64, 2, 65]],
  [BE.SAMAMBAIA, 'Samambaia gigante', 66, { solido: false, opaco: false, planta: true }],
  [BE.CAVALINHA, 'Cavalinha', 67, { solido: false, opaco: false, planta: true }],
  [BE.TRONCO_PALMEIRA, 'Tronco de palmeira', [68, 68, 69]],
  [BE.FOLHA_PALMEIRA, 'Folha de palmeira', 70],
  [BE.BASALTO, 'Pedra vulcânica', 71],
  [BE.PEDRA_LAVA, 'Pedra de lava', 72, { brilho: 1 }],
  [BE.OVO_DINO, 'Ovo de dinossauro', 73, { solido: false, opaco: false, planta: true }],
  [BE.FOSSIL, 'Fóssil', 74],
  [BE.NEVE, 'Neve', [75, 2, 76]],
  [BE.GELO, 'Gelo', 77],
  [BE.FOLHAS_NEVE, 'Folhas com neve', [113, 114, 78]],
  [BE.BLOCO_NEVE, 'Bloco de neve', 75],
  [BE.PELE, 'Tenda de pele', 79],
  [BE.FOGUEIRA, 'Fogueira', [80, 3, 81], { brilho: 1 }],
  [BE.PALHA, 'Palha', 82],
  [BE.PINTURA_RUPESTRE, 'Pintura da caverna', [3, 3, 83]],
  [BE.BARRO, 'Barro', 84],
  [BE.ARENITO, 'Arenito', [85, 85, 86]],
  [BE.ARENITO_ENTALHADO, 'Arenito entalhado', [85, 85, 87]],
  [BE.MARMORE, 'Mármore', 88],
  [BE.COLUNA, 'Coluna', [89, 89, 90]],
  [BE.TERRACOTA, 'Telha de barro', 91],
  [BE.OURO, 'Bloco de ouro', 92],
  [BE.MOSAICO, 'Mosaico', 93],
  [BE.PEDRA_CASTELO, 'Pedra de castelo', 94],
  [BE.ENXAIMEL, 'Enxaimel', 95],
  [BE.ESTANDARTE, 'Estandarte', 96],
  [BE.VITRAL, 'Vitral', 97, { opaco: false }],
  [BE.TIJOLO_FABRICA, 'Tijolo de fábrica', 98],
  [BE.FERRO, 'Chapa de ferro', 99],
  [BE.ENGRENAGEM, 'Engrenagem', 100],
  [BE.CARVAO, 'Carvão', 101],
  [BE.CONCRETO, 'Concreto', 102],
  [BE.ASFALTO, 'Asfalto', 103],
  [BE.ASFALTO_FAIXA, 'Asfalto com faixa', [104, 103, 103]],
  [BE.VIDRO_AZUL, 'Janela azul', 105, { opaco: false }],
  [BE.AZULEJO, 'Azulejo', 106],
  [BE.LUZ_LED, 'Luz de LED', 107, { brilho: 1 }],
  [BE.PAINEL_SOLAR, 'Painel solar', [108, 110, 109]],
  [BE.METAL_BRANCO, 'Metal branco', 110],
  [BE.NEON, 'Neon', 111, { brilho: 1 }],
  [BE.CRISTAL, 'Cristal', 112, { brilho: 1, opaco: false }],
];

// ---------- texturas ----------
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const vr = (c, r, amt) => { const k = 1 + (r() - 0.5) * amt; return [c[0] * k, c[1] * k, c[2] * k, 255]; };
const V = [0, 0, 0, 0]; // pixel transparente
// cor com um tom fixo (k = 1 é a cor pura): para pedras/tijolos com a mesma cor em toda a peça
const tom = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// aleatório fixo por posição (não depende da ordem em que os pixels são pintados)
const h2 = (x, y, s = 0) => {
  let n = Math.imul((x & 15) + 37 * s, 374761393) ^ Math.imul((y & 15) + 101 * s, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
// distância "que dá a volta" no tile: os desenhos emendam de um bloco para o vizinho
const dv = (a, b) => { const d = Math.abs(a - b) % 16; return Math.min(d, 16 - d); };
const distV = (x, y, cx, cy) => Math.hypot(dv(x, cx), dv(y, cy));
// mosaico de Voronoi (com a volta): devolve [índice da célula, distância até a borda]
function voronoi(pts) {
  return (x, y) => {
    let d1 = 99, d2 = 99, i1 = 0;
    pts.forEach(([px, py], i) => {
      const d = distV(x, y, px, py);
      if (d < d1) { d2 = d1; d1 = d; i1 = i; } else if (d < d2) d2 = d;
    });
    return [i1, d2 - d1];
  };
}
// risca linhas num conjunto de pixels (rachaduras, talos, contornos)
function tracar(segs) {
  const s = new Set();
  for (const [x0, y0, x1, y1] of segs) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1;
    for (let i = 0; i <= n; i++) s.add(((Math.round(y0 + ((y1 - y0) * i) / n) & 15) << 4) | (Math.round(x0 + ((x1 - x0) * i) / n) & 15));
  }
  return s;
}
const tem = (s, x, y) => s.has(((y & 15) << 4) | (x & 15));
// desenho livre: f(p) pinta com p(x, y, cor); o que sobrar fica transparente (ou vira o fundo)
function desenho(f, fundo = null, amt = 0.1) {
  const g = new Array(256).fill(null);
  const p = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && x < 16 && y >= 0 && y < 16) g[y * 16 + x] = c; };
  f(p);
  return (x, y, r) => { const c = g[y * 16 + x]; return c === null ? (fundo ? fundo(x, y, r) : V) : vr(hex(c), r, amt); };
}
// desenho em texto: uma linha por y, um caractere por pixel ('.' = fundo)
const mapa = (linhas, cores, fundo = null, amt = 0.1) => (x, y, r) => {
  const c = cores[linhas[y][x]];
  return c === undefined ? (fundo ? fundo(x, y, r) : V) : vr(hex(c), r, amt);
};

// ----- fundos que se repetem -----
const terra = (x, y, r) => vr(h2(x, y, 3) < 0.1 ? hex(0x6e4529) : hex(0x8a5a3b), r, 0.25); // igual à terra do jogo
const pedraCaverna = (x, y, r) => {
  const n = h2(x >> 1, y >> 1, 21);
  return vr(h2(x, y, 22) < 0.08 ? hex(0x7c7268) : n < 0.35 ? hex(0x8f857a) : hex(0x9b9186), r, 0.1);
};
const pedraCinza = (x, y, r) => vr(h2(x, y, 23) < 0.12 ? hex(0x767980) : hex(0x8c8f96), r, 0.18); // igual à pedra do jogo
const asfalto = (x, y, r) => { const n = h2(x, y, 24); return vr(n < 0.12 ? hex(0x56565c) : n > 0.9 ? hex(0x2c2c30) : hex(0x3c3c41), r, 0.08); };

// ----- musgo (mais escuro e amarelado que a grama, com tufinhos) -----
const MUSGO = [0x52702a, 0x64822e, 0x7a9636];
const TUFOS = [[3, 3], [10, 2], [13, 9], [6, 9], [2, 13], [10, 14]];
const musgo = (x, y, r) => {
  for (const [tx, ty] of TUFOS) {
    if (x === tx && y === ty - 1) return vr(hex(0xd2dc6c), r, 0.08);
    if (x === tx && y === ty) return vr(hex(0xb4c450), r, 0.08);
    if (Math.abs(x - tx) === 1 && y === ty) return vr(hex(0x98ac40), r, 0.08);
    if (x === tx && y === ty + 1) return vr(hex(0x3a5420), r, 0.08);
  }
  const n = h2(x >> 1, y >> 1, 1) * 0.6 + h2(x, y, 2) * 0.4;
  if (h2(x, y, 4) < 0.05) return vr(hex(0xa4b048), r, 0.1);
  return vr(hex(MUSGO[n < 0.3 ? 0 : n < 0.68 ? 1 : 2]), r, 0.12);
};
const PROF_MUSGO = [4, 5, 7, 4, 3, 5, 6, 4, 4, 8, 5, 3, 4, 6, 5, 4];

// ----- neve -----
const neve = (x, y, r) => {
  const n = h2(x >> 1, y >> 1, 5), b = h2(x, y, 6);
  if (b < 0.035) return [255, 255, 255, 255];
  if (b > 0.96) return vr(hex(0xc8daf2), r, 0.04);
  return vr(n < 0.3 ? hex(0xe2ebf7) : hex(0xf4f8fd), r, 0.03);
};
const PROF_NEVE = [3, 4, 4, 5, 3, 3, 4, 6, 5, 4, 3, 4, 5, 4, 3, 3];
// folhas de pinheiro (frias, escuras) para a era do gelo
const folhasFrias = (x, y, r) => {
  const n = h2(x, y, 8);
  return vr(n < 0.25 ? hex(0x24543a) : n > 0.88 ? hex(0x4a8a52) : hex(0x336c44), r, 0.2);
};

// ----- gelo: azul translúcido, com rachaduras claras -----
const RACHA_GELO = tracar([[1, 2, 5, 6], [5, 6, 4, 10], [4, 10, 2, 13], [5, 6, 10, 7], [10, 7, 14, 4], [10, 7, 11, 12], [11, 12, 15, 14]]);

// ----- pedra de lava: crosta escura com rachaduras brilhando -----
const VOR_LAVA = voronoi([[3, 2], [11, 3], [7, 8], [14, 10], [2, 11], [9, 14], [5, 5]]);
// ----- mármore: veios que saem de um lado e entram do outro (emendam) -----
const VEIO_FORTE = tracar([[0, 3, 4, 5], [4, 5, 8, 4], [8, 4, 12, 8], [12, 8, 16, 3], [8, 4, 7, 9], [7, 9, 4, 11]]);
const VEIO_FRACO = tracar([[0, 12, 5, 10], [5, 10, 10, 13], [10, 13, 16, 12], [12, 8, 13, 13]]);
// ----- tenda de pele: retalhos costurados -----
const VOR_PELE = voronoi([[3, 3], [12, 2], [8, 9], [2, 12], [13, 13]]);
const CORES_PELE = [0xb88a5e, 0xa07048, 0xc89e6e, 0x96663f, 0xb38257];

// ----- samambaia gigante: três folhas compridas cheias de folíolos -----
const samambaia = desenho((p) => {
  const fronde = (x0, y0, cx, cy, x1, y1, larg) => {
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      const tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy), L = Math.hypot(tx, ty);
      pts.push([x, y, tx / L, ty / L, t]);
    }
    // folíolos: maiores no meio, apontando para a ponta
    pts.forEach(([x, y, tx, ty, t], i) => {
      if (t < 0.12 || i % 9) return;
      const comp = larg * Math.sin(Math.PI * Math.min(1, 0.15 + t * 0.95));
      for (const lado of [-1, 1]) {
        const nx = -ty * lado, ny = tx * lado;
        for (let k = 1; k <= comp + 0.3; k += 0.5) p(x + (nx + tx * 0.55) * k, y + (ny + ty * 0.55) * k, k > comp - 0.8 ? 0x7cc84e : 0x4f9e38);
      }
    });
    for (const [x, y] of pts) p(x, y, 0x2f6a26);
  };
  fronde(7, 15.4, 2, 10, 0.4, 3.2, 2.6);
  fronde(9, 15.4, 14, 10, 15.4, 3.6, 2.6);
  fronde(8, 15.4, 8.4, 8, 7.4, 0.4, 3.2);
});

// ----- cavalinha: talos com gomos e anéis, alguns com "pinha" na ponta -----
const cavalinha = desenho((p) => {
  for (const [hx, topo, pinha] of [[2, 5, false], [5, 1, true], [9, 3, false], [12, 0, true], [14, 7, false]]) {
    for (let y = topo; y < 16; y++) {
      const no = (y - topo) % 3 === 2;
      p(hx, y, no ? 0x2f5e24 : (y - topo) % 3 === 0 ? 0x8ccc62 : 0x6cae48);
      if (no && y < 14) { p(hx - 1, y + 1, 0x4f9038); p(hx + 1, y + 1, 0x4f9038); if (y < 12) { p(hx - 2, y + 2, 0x5ea544); p(hx + 2, y + 2, 0x5ea544); } }
    }
    if (pinha) { p(hx, topo - 1, 0xb88a4c); p(hx, topo, 0x9a6c38); p(hx, topo + 1, 0xb88a4c); }
  }
});

// ----- ovo de dinossauro (pintadinho, num ninho de palha) -----
const PINTAS_OVO = [[7, 5, 0x4f9e86], [4, 9, 0xa8743e], [9, 8, 0x4f9e86], [6, 11, 0x4f9e86], [10, 12, 0xa8743e], [5, 7, 0xa8743e], [8, 10, 0xa8743e], [3, 12, 0x4f9e86], [11, 10, 0x4f9e86]];
const ovo = (x, y, r) => {
  const dentro = (px, py) => {
    const dx = px - 7.5, dy = py - 9.6;
    const ax = dy < 0 ? 4.4 : 4.9, ay = dy < 0 ? 6.2 : 4.4;
    return (dx / ax) ** 2 + (dy / ay) ** 2 <= 1;
  };
  if (dentro(x, y)) {
    const borda = !dentro(x - 1, y) || !dentro(x + 1, y) || !dentro(x, y - 1) || !dentro(x, y + 1);
    if (borda) return vr(hex(0xb9a57a), r, 0.06);
    if ((x === 5 && (y === 6 || y === 7)) || (x === 6 && y === 5)) return [255, 255, 255, 255];
    for (const [px, py, c] of PINTAS_OVO) if ((x === px || x === px + 1) && (y === py || (y === py + 1 && x === px))) return vr(hex(c), r, 0.08);
    return vr(mix(hex(0xfaf2dc), hex(0xe6d8b4), (x + y) / 30), r, 0.05);
  }
  if (y >= 13 && Math.abs(x - 7.5) < 7.2 && h2(x, y, 12) < 0.75) return vr((x + y) % 3 ? hex(0xd2aa58) : hex(0x9a7434), r, 0.15);
  return V;
};

// ----- fóssil: concha em espiral (amonite) presa na pedra -----
const fossil = (x, y, r) => {
  const dx = x - 7.5, dy = y - 8, d = Math.hypot(dx, dy);
  if (d < 6.6) {
    if (d > 5.8) return vr(hex(0x6e665a), r, 0.08);
    if (d < 1) return vr(hex(0x7a6c52), r, 0.08);
    const a = Math.atan2(dy, dx), b = 2.5 / (Math.PI * 2);
    const f = ((((d / b - a) / (Math.PI * 2)) % 1) + 1) % 1;
    if (f < 0.2) return vr(hex(0x8a7a5a), r, 0.08);
    const costela = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 18) % 2;
    return vr(costela ? hex(0xeee2c4) : hex(0xd6c6a0), r, 0.06);
  }
  return vr(h2(x, y, 13) < 0.12 ? hex(0x7e786e) : hex(0x9c968c), r, 0.12);
};

// ----- pintura da caverna (sol, bichão, gente acenando e uma mão, em ocre) -----
const PINTURA = [
  'y.y.y...........',
  '.yyy........k.k.',
  'yyyyy.......kRk.',
  '.yyy...RRRR.RRR.',
  'y.y.y.RRRRRRRRRR',
  '.....RRRRRRRRRR.',
  '....RRRRRRRRRR..',
  '...R..RRRRRRR...',
  '......R.R.R.R...',
  '......R.R.R.R...',
  '.R...R..........',
  'RRRRRRR...y.y.y.',
  '.R...R....y.y.y.',
  '.R...R....yyyyy.',
  'R.R.R.R..yyyyyy.',
  'R.R.R.R...yyyy..',
];
const pintura = mapa(PINTURA, { R: 0xb84a26, y: 0xd8902e, k: 0x3a2a22 }, pedraCaverna, 0.14);

// ----- arenito entalhado: moldura, zigue-zague e losango (desenho geométrico próprio) -----
const sulco = (x, y) => {
  if (x < 1 || x > 14 || y < 1 || y > 14) return false;
  if (x === 1 || x === 14 || y === 1 || y === 14) return true;
  const m = Math.abs(x - 7.5) + Math.abs(y - 7.5);
  if (m >= 3.5 && m <= 4.5) return true; // losango
  if (m < 1.5) return true; // miolo
  // triangulinhos nos cantos, apontando para o meio
  const cx = Math.min(x - 3, 12 - x), cy = Math.min(y - 3, 12 - y);
  return cx >= 0 && cy >= 0 && cx + cy <= 1;
};
const graoArenito = (x, y, r, base) => {
  const g = h2(x, y, 14);
  return vr(g < 0.1 ? tom(hex(base), 0.9) : g > 0.94 ? tom(hex(base), 1.06) : hex(base), r, 0.06);
};

// ----- engrenagem de latão sobre ferro escuro -----
const engrenagem = (x, y, r) => {
  const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  const luz = 1 + (-dx - dy) / Math.max(d, 1) * 0.12;
  const dente = d < 7.4 && d >= 5.4 && Math.cos(a * 8) > 0.25;
  if (d < 5.6 || dente) {
    if (d < 1.6) return vr(hex(0x2a2c30), r, 0.05);
    if (d < 2.6) return vr(tom(hex(0xf4d070), luz), r, 0.05);
    const furo = [0, 1, 2, 3].some((i) => Math.hypot(dx - Math.cos(i * Math.PI / 2 + Math.PI / 4) * 3.8, dy - Math.sin(i * Math.PI / 2 + Math.PI / 4) * 3.8) < 1.1);
    if (furo) return vr(hex(0x34363c), r, 0.05);
    return vr(tom(hex(d > 4.8 && !dente ? 0xb88a2c : 0xd4a43c), luz), r, 0.06);
  }
  if (Math.abs(dx) > 6 && Math.abs(dy) > 6) return vr(hex(0x8a9098), r, 0.05); // rebites nos cantos
  return vr(h2(x, y, 15) < 0.15 ? hex(0x3c4048) : hex(0x4a4f58), r, 0.06);
};

// ----- vitral: rosácea com chumbo escuro -----
const vitral = (x, y) => {
  const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  const chumbo = [56, 46, 52, 255];
  if (x === 0 || y === 0 || x === 15 || y === 15) return chumbo;
  if (Math.abs(d - 2.9) < 0.5 || Math.abs(d - 6.6) < 0.5) return chumbo;
  const setor = ((a + Math.PI) / (Math.PI * 2)) * 8;
  if (d > 3.2 && d < 6.4 && Math.abs(setor - Math.round(setor)) * (Math.PI * 2 / 8) * d < 0.55) return chumbo;
  if (d > 6.9 && (Math.abs(dx) - Math.abs(dy)) ** 2 < 0.3) return chumbo;
  let c;
  if (d < 2.6) c = 0xffd84a;
  else if (d < 6.6) c = [0xe8433f, 0x3f6fd9][Math.floor(setor) % 2];
  else c = Math.abs(dx) > Math.abs(dy) ? 0x4caf50 : 0x9a5ad0;
  const k = 1.18 - d * 0.035 + ((x + y) % 7 === 0 ? 0.12 : 0);
  return [...tom(hex(c), k), 255];
};

// ----- azulejo português (azul e branco) -----
const azulejoMancha = (px, py) => {
  const dx = px - 7, dy = py - 7, d = Math.hypot(dx, dy);
  if (d < 1.3) return 2; // miolo
  if (Math.min(Math.hypot(dx - 3, dy), Math.hypot(dx + 3, dy), Math.hypot(dx, dy - 3), Math.hypot(dx, dy + 3)) < 1.9) return 1; // pétalas
  if (Math.abs(Math.abs(dx) - 4.2) < 0.9 && Math.abs(Math.abs(dy) - 4.2) < 0.9) return 2; // folhinhas na diagonal
  const cx = Math.min(px + 0.5, 14.5 - px), cy = Math.min(py + 0.5, 14.5 - py), dc = Math.hypot(cx, cy);
  if (dc < 1.6) return 2; // pontinho no canto (vira um círculo com os vizinhos)
  if (dc > 3.4 && dc < 4.6) return 1; // arco do canto
  return 0;
};
const azulejo = (x, y, r) => {
  if (x === 15 || y === 15) return vr(hex(0xd4d8e0), r, 0.04);
  const m = azulejoMancha(x, y);
  if (m === 2) return vr(hex(0x1f3f96), r, 0.05);
  if (m === 1) {
    const borda = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => azulejoMancha(x + a, y + b) === 0);
    return vr(hex(borda ? 0x24479e : 0x5b80d2), r, 0.05);
  }
  return vr(hex(0xf6f8fc), r, 0.03);
};

// ----- pedra de castelo: blocos grandes, cada um com seu tom e chanfro -----
const JUNTAS = [[5, 13], [1, 9], [6, 14]]; // onde ficam as juntas verticais em cada fileira
const fileira = (y) => (y < 5 ? 0 : y < 10 ? 1 : 2);
const ehJunta = (x, y) => y === 4 || y === 9 || y === 15 || JUNTAS[fileira(y)].includes(x);
const pedraCastelo = (x, y, r) => {
  if (ehJunta(x, y)) return vr(hex(0x5a5c62), r, 0.08);
  const f = fileira(y), j = JUNTAS[f];
  const id = f * 3 + (x > j[0] && x <= j[1] ? 1 : 0);
  let c = tom([0x9c9ea2, 0x8a8d92, 0xa8a8a2, 0x93958e].map(hex)[Math.floor(h2(id, f, 16) * 4)], 1);
  if (ehJunta(x - 1, y) || ehJunta(x, y - 1)) c = tom(c, 1.14);
  else if (ehJunta(x + 1, y) || ehJunta(x, y + 1)) c = tom(c, 0.84);
  if (h2(x, y, 17) < 0.05) c = tom(c, 0.82);
  return vr(c, r, 0.08);
};

// ----- tijolo de fábrica: escuro, cada tijolo de um tom, argamassa escura -----
const tijoloFabrica = (x, y, r) => {
  const fila = y >> 2, desl = fila % 2 ? 4 : 0;
  if (y % 4 === 3 || (x + desl) % 8 === 7) return vr(hex(0x3e3a38), r, 0.1);
  const id = fila * 2 + (((x + desl) % 16) >> 3);
  let c = [0x8a3a2a, 0x7a3024, 0x9a4630, 0x6e2c22].map(hex)[Math.floor(h2(id, fila, 18) * 4)];
  if (y % 4 === 0) c = tom(c, 1.12);
  if (h2(x, y, 19) < 0.06) c = tom(c, 0.8);
  return vr(c, r, 0.08);
};

// ----- cristal: gema lapidada que brilha -----
const cristal = (x, y, r) => {
  const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  const base = hex(0xa868f0);
  if ((x === 5 && y === 4) || (x === 4 && y === 5) || (x === 11 && y === 11)) return [255, 255, 255, 255];
  const hexa = Math.max(Math.abs(dx), Math.abs(dx) * 0.5 + Math.abs(dy) * 0.866);
  if (Math.abs(hexa - 3.4) < 0.45) return vr(hex(0xf0e0ff), r, 0.04);
  if (hexa < 3.4) return vr(mix(hex(0xe8d4ff), hex(0xc8a0ff), (dx + dy + 6) / 12), r, 0.04);
  const s = ((a + Math.PI) / (Math.PI * 2)) * 6;
  if (Math.abs(s - Math.round(s)) * d < 0.4) return vr(hex(0xe0c8ff), r, 0.04);
  const luz = [1.2, 1.05, 0.82, 0.68, 0.8, 1.0][Math.floor(s) % 6];
  return vr(tom(base, luz * (d > 7.6 ? 0.85 : 1)), r, 0.05);
};

// ----- neon: tubo rosa arredondado e losango azul-piscina -----
const neon = (x, y, r) => {
  const px = Math.abs(x - 7.5) - 3.6, py = Math.abs(y - 7.5) - 3.6;
  const sd = Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - 1.6;
  if (Math.abs(sd) < 0.35) return [255, 214, 246, 255];
  if (Math.abs(sd) < 0.9) return vr(hex(0xff4fd2), r, 0.04);
  const m = Math.abs(x - 7.5) + Math.abs(y - 7.5);
  if (Math.abs(m - 2) < 0.5) return vr(hex(0x48f2f0), r, 0.04);
  if (Math.abs(sd) < 1.8 || Math.abs(m - 2) < 1.2) return vr(hex(0x5a2a7a), r, 0.06);
  return vr(hex(0x2a2046), r, 0.08);
};

// tile -> pintor (os tiles 64..127 do atlas são das eras)
export const PINTORES = {
  // 64 musgo (topo) / 65 musgo (lado, escorrendo sobre a terra)
  64: musgo,
  65: (x, y, r) => {
    const p = PROF_MUSGO[x];
    if (y < p - 1) return musgo(x, y + 4, r);
    if (y === p - 1) return vr(hex(0x445e22), r, 0.1);
    return terra(x, y, r);
  },
  66: samambaia,
  67: cavalinha,
  // 68 tronco de palmeira (topo, fibras) / 69 (lado, anéis)
  68: (x, y, r) => {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d > 7.1) return vr(hex(0x6a4c30), r, 0.15);
    if (d > 6.1) return vr(hex(0x8e6c44), r, 0.12);
    if (h2(x, y, 25) < 0.18) return vr(hex(0xb0905e), r, 0.08);
    return vr(Math.floor(d * 0.9) % 2 ? hex(0xdcc08c) : hex(0xccae78), r, 0.06);
  },
  69: (x, y, r) => {
    const b = y % 4, anel = y >> 2;
    if (b === 0) return vr(hex(0xb8925e), r, 0.08);
    if (b === 3) return vr(hex(0x5a3e26), r, 0.1);
    if ((x + anel * 3) % 6 === 0) return vr(hex(0x6e5034), r, 0.1);
    return vr(h2(x, anel, 26) < 0.3 ? hex(0x7e5e3c) : hex(0x8e6c46), r, 0.1);
  },
  // 70 folha de palmeira (folíolos em espinha de peixe)
  70: (x, y, r) => {
    const meio = x < 8 ? 3 : 11, dx = Math.abs(x - meio);
    if (dx === 0) return vr(hex(0xa6c040), r, 0.08);
    const f = (y + dx) % 4;
    if (f === 0) return vr(hex(0x2a6a28), r, 0.12);
    return vr(f === 1 ? hex(0x6cc84a) : hex(0x4caf3a), r, 0.12);
  },
  // 71 pedra vulcânica (escura, com furinhos)
  71: (x, y, r) => {
    if (h2(x, y, 27) < 0.07) return vr(hex(0x1c1d22), r, 0.05);
    if (h2(x, y - 1, 27) < 0.07) return vr(hex(0x5c5e68), r, 0.06);
    return vr(h2(x >> 1, y >> 1, 28) < 0.35 ? hex(0x36373e) : hex(0x42434b), r, 0.12);
  },
  // 72 pedra de lava (brilha)
  72: (x, y, r) => {
    const [, b] = VOR_LAVA(x, y);
    if (b < 0.7) return vr(hex(0xffe27a), r, 0.06);
    if (b < 1.5) return vr(hex(0xff8a1e), r, 0.08);
    if (b < 2.4) return vr(hex(0xa83416), r, 0.1);
    return vr(h2(x, y, 29) < 0.08 ? hex(0x6a2a1a) : hex(0x3a2622), r, 0.12);
  },
  73: ovo,
  74: fossil,
  // 75 neve (topo) / 76 neve (lado, sobre a terra)
  75: neve,
  76: (x, y, r) => {
    const p = PROF_NEVE[x];
    if (y < p - 1) return neve(x, y, r);
    if (y === p - 1) return vr(hex(0xcadcf2), r, 0.04);
    return terra(x, y, r);
  },
  // 77 gelo
  77: (x, y, r) => {
    let c = mix(hex(0xb4e2f8), hex(0x84c8ee), (y + (x >> 2)) / 19);
    const s = (x + y) % 16;
    if (s === 3 || s === 4) c = mix(c, [255, 255, 255], 0.2);
    else if (h2(x >> 1, y >> 1, 30) < 0.15) c = tom(c, 0.92);
    if (tem(RACHA_GELO, x, y)) c = mix(c, [255, 255, 255], 0.6);
    else if (tem(RACHA_GELO, x - 1, y) || tem(RACHA_GELO, x, y - 1)) c = tom(c, 0.94);
    return vr(c, r, 0.04);
  },
  // 78 folhas com neve (lado) / 113 (topo) / 114 (embaixo)
  78: (x, y, r) => {
    const p = PROF_NEVE[(x + 5) & 15] - 1;
    if (y < p - 1) return neve(x, y, r);
    if (y === p - 1) return vr(hex(0xcadcf2), r, 0.04);
    if (y < 12 && h2(x, y, 31) < 0.07) return vr(hex(0xf2f6fd), r, 0.04);
    return folhasFrias(x, y, r);
  },
  113: (x, y, r) => (h2(x >> 1, y >> 1, 32) < 0.22 && h2(x, y, 33) < 0.8 ? folhasFrias(x, y, r) : neve(x, y, r)),
  114: folhasFrias,
  // 79 tenda de pele (retalhos costurados)
  79: (x, y, r) => {
    const [i, b] = VOR_PELE(x, y);
    if (b < 0.9) return vr((x + y) % 2 ? hex(0x5a3a22) : hex(0xd8b88c), r, 0.06);
    if (i === 2 && h2(x >> 1, y >> 1, 34) < 0.25) return vr(hex(0x7a5234), r, 0.1);
    return vr(tom(hex(CORES_PELE[i]), h2(x, y >> 1, 35) < 0.2 ? 0.9 : 1), r, 0.08);
  },
  // 80 fogueira (topo: pedras em roda, lenha cruzada e fogo) / 81 (lado)
  80: (x, y, r) => {
    const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy);
    if (d < 1.4) return vr(hex(0xfff2b8), r, 0.04);
    if (d < 2.8) return vr(hex(0xffc83a), r, 0.06);
    if (d > 7.4) return vr(hex(0x4a3c32), r, 0.12);
    if (d > 5.4) {
      const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2) * 9;
      if (a - Math.floor(a) < 0.12 || d > 7) return vr(hex(0x4a4c52), r, 0.08);
      return vr(Math.floor(a) % 2 ? hex(0x9a9ca3) : hex(0x84868d), r, 0.1);
    }
    if (Math.abs(dx - dy) < 1.6 || Math.abs(dx + dy) < 1.6) return vr(d > 4.4 ? hex(0x4a3020) : (x + y) % 3 ? hex(0x8a6034) : hex(0x6e4a28), r, 0.1);
    return vr(h2(x, y, 36) < 0.35 ? hex(0xff7a20) : hex(0x3a2a24), r, 0.1);
  },
  81: (x, y, r) => {
    if (y >= 12) {
      const xx = (x + (y === 12 ? 0 : 0)) % 4;
      if (xx === 3 || (y === 15 && (xx === 0 || xx === 2))) return vr(hex(0x3a2e28), r, 0.08);
      return vr(y === 12 ? hex(0xa6a8ae) : (x >> 2) % 2 ? hex(0x8c8f96) : hex(0x7c7f86), r, 0.08);
    }
    if (y >= 9) {
      if ((x === 2 || x === 9) && y === 10) return vr(hex(0xd8b07a), r, 0.06);
      return vr(hex([0xa07446, 0x7a5634, 0x5a3d22][y - 9]), r, 0.1);
    }
    const alt = 5.5 + 2.4 * Math.sin(x * 0.9 + 0.6) + 1.4 * Math.sin(x * 2.3);
    const q = (8.5 - y) / alt;
    if (q < 1) return vr(hex(q < 0.3 ? 0xfff0a0 : q < 0.6 ? 0xffc030 : q < 0.85 ? 0xff7a20 : 0xe8401c), r, 0.06);
    if (h2(x, y, 37) < 0.05) return vr(hex(0xffd060), r, 0.05);
    return vr(hex(0x2e1e18), r, 0.1);
  },
  // 82 palha (feixes em camadas)
  82: (x, y, r) => {
    const camada = y >> 2, yy = y & 3;
    if (yy === 3 && h2(x, camada, 38) < 0.7) return vr(hex(0x8a6a2a), r, 0.1);
    const fio = h2(x + camada * 5, camada, 39);
    return vr(fio < 0.2 ? hex(0xf2dc8c) : fio < 0.6 ? hex(0xdcbc62) : hex(0xc8a24a), r, 0.08);
  },
  83: pintura,
  // 84 barro (marrom avermelhado, com marcas molhadas)
  84: (x, y, r) => {
    if (h2(x, y, 40) < 0.03) return vr(hex(0xd4b490), r, 0.06);
    const v = Math.sin((y + 1.5 * Math.sin((x * Math.PI) / 8)) * (Math.PI / 4));
    return vr(v > 0.75 ? hex(0xc0825a) : v < -0.8 ? hex(0x8a5032) : hex(0xa8683f), r, 0.1);
  },
  // 85 arenito (topo) / 86 (lado, em camadas) / 87 arenito entalhado
  85: (x, y, r) => {
    if (x === 0 || y === 0) return vr(hex(0xf0d8a6), r, 0.04);
    if (x === 15 || y === 15) return vr(hex(0xcaa970), r, 0.04);
    return graoArenito(x, y, r, 0xe6cc90);
  },
  86: (x, y, r) => {
    const w = Math.round(Math.sin((x * Math.PI) / 8) * 0.8);
    if (y === 4 + w || y === 9 - w || y === 13 + w) return vr(hex(0xc0a066), r, 0.05);
    const camada = y < 4 + w ? 0xecd4a0 : y < 9 - w ? 0xe0c488 : y < 13 + w ? 0xd6b676 : 0xe6cc90;
    return graoArenito(x, y, r, camada);
  },
  87: (x, y, r) => {
    if (sulco(x, y)) return vr(hex(0xae8c50), r, 0.06);
    if (sulco(x - 1, y - 1) || sulco(x - 1, y) || sulco(x, y - 1)) return vr(hex(0xf6e2b4), r, 0.04);
    return graoArenito(x, y, r, 0xe2c68a);
  },
  // 88 mármore (veios que emendam de um bloco para o outro)
  88: (x, y, r) => {
    if (tem(VEIO_FORTE, x, y)) return vr(hex(0x9c9eac), r, 0.04);
    if (tem(VEIO_FRACO, x, y)) return vr(hex(0xc6c8d2), r, 0.03);
    if (tem(VEIO_FORTE, x, y - 1) || tem(VEIO_FORTE, x - 1, y)) return vr(hex(0xdcdde4), r, 0.03);
    return vr(h2(x >> 2, y >> 2, 48) < 0.4 ? hex(0xecebe6) : hex(0xf6f4ef), r, 0.025);
  },
  // 89 coluna (topo) / 90 coluna (lado, caneluras)
  89: (x, y, r) => {
    const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy);
    if (d > 7.3) return vr(hex(0xd6d0c2), r, 0.04);
    if (d > 6.2) return vr(Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 16) % 2 ? hex(0xc4beb0) : hex(0xf2eee4), r, 0.03);
    if (d > 5.3) return vr(hex(0xdcd6c8), r, 0.03);
    return vr(d < 2.5 ? hex(0xfaf8f2) : hex(0xf0ece2), r, 0.03);
  },
  90: (x, y, r) => vr(hex([0xc4beb0, 0xddd7ca, 0xf6f2e8, 0xebe6da][x % 4]), r, 0.04),
  // 91 telha de barro (canudos arredondados)
  91: (x, y, r) => {
    const fila = y >> 2, yy = y & 3, xx = (x + (fila % 2) * 2) % 4;
    if (yy === 3) return vr(hex(0x8e3a1e), r, 0.08);
    const c = hex([0xb8522c, 0xe0784a, 0xf0945e, 0xd06438][xx]);
    return vr(yy === 0 ? tom(c, 1.06) : c, r, 0.08);
  },
  // 92 bloco de ouro (chanfrado e brilhando)
  92: (x, y, r) => {
    if ((x === 4 && y === 3) || (x === 11 && y === 10)) return [255, 255, 255, 255];
    if ((Math.abs(x - 4) + Math.abs(y - 3) === 1) || (Math.abs(x - 11) + Math.abs(y - 10) === 1)) return vr(hex(0xfff6c8), r, 0.03);
    if (x === 0 || y === 0) return vr(hex(0xfff0a0), r, 0.04);
    if (x === 15 || y === 15) return vr(hex(0xb8861c), r, 0.04);
    if (x === 1 || y === 1) return vr(hex(0xffe070), r, 0.04);
    if (x === 14 || y === 14) return vr(hex(0xd8a02a), r, 0.04);
    const s = (x + y) % 16;
    return vr(s === 5 || s === 6 ? hex(0xffe88a) : s === 11 ? hex(0xffd65e) : hex(0xf4c43a), r, 0.05);
  },
  // 93 mosaico (pastilhas com rejunte claro)
  93: (x, y, r) => {
    if (x % 4 === 3 || y % 4 === 3) return vr(hex(0xe6dcc8), r, 0.05);
    const i = x >> 2, j = y >> 2, d = Math.abs(i - 1.5) + Math.abs(j - 1.5);
    const c = tom(hex(d === 1 ? 0x2f6fd0 : d === 2 ? 0xf2c030 : 0xd0583a), 0.9 + h2(i, j, 41) * 0.2);
    return vr(x % 4 === 0 && y % 4 === 0 ? tom(c, 1.18) : c, r, 0.05);
  },
  94: pedraCastelo,
  // 95 enxaimel (vigas de madeira e reboco branco)
  95: (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15 || x + y === 14 || x + y === 15) return vr((x * 3 + y) % 5 === 0 ? hex(0x4a301a) : hex(0x5e3e22), r, 0.1);
    return vr(h2(x, y, 42) < 0.08 ? hex(0xe0d6c0) : hex(0xf2ead6), r, 0.04);
  },
  // 96 estandarte (vermelho com brasão azul e estrela dourada)
  96: (x, y, r) => {
    const dx = x - 7.5, dy = y - 7.5;
    if (x === 0 || x === 15) return vr(hex(0x8a2420), r, 0.06);
    if (x === 1 || x === 14) return vr(hex(0xf2c72e), r, 0.06);
    const larg = y < 10 ? 3.6 : 3.6 - (y - 9) * 1.15;
    if (y >= 3 && y <= 12 && Math.abs(dx) <= larg) {
      if (y === 3 || Math.abs(dx) > larg - 1) return vr(hex(0xf2c72e), r, 0.05);
      const e = Math.abs(dx), f = Math.abs(dy + 0.5);
      if ((e < 1 && f < 2.6) || (f < 1 && e < 2.6) || e + f < 2) return vr(hex(0xffe066), r, 0.04);
      return vr(hex(0x3f6fd9), r, 0.06);
    }
    return vr(tom(hex(0xd23a32), [1, 1.08, 1, 0.88][x % 4]), r, 0.06);
  },
  97: vitral,
  98: tijoloFabrica,
  // 99 chapa de ferro (rebites e emenda no meio)
  99: (x, y, r) => {
    for (const ry of [2, 13]) for (const rx of [2, 6, 9, 13]) {
      if (x === rx && y === ry) return vr(hex(0xd8dee4), r, 0.03);
      if (x === rx + 1 && y === ry + 1) return vr(hex(0x3e444c), r, 0.05);
    }
    if (y === 7 || x === 15 || y === 15) return vr(hex(0x4a5058), r, 0.05);
    if (y === 8 || x === 0 || y === 0) return vr(hex(0xa8b0ba), r, 0.04);
    if (h2(x, y, 43) < 0.025) return vr(hex(0xa86a3a), r, 0.1);
    return vr(tom(hex(0x7e8792), 0.95 + h2(0, y, 44) * 0.1), r, 0.03);
  },
  100: engrenagem,
  // 101 carvão (pedras pretas na pedra)
  101: (x, y, r) => {
    for (const [cx, cy, raio] of [[4, 4, 1.9], [11, 3, 1.5], [9, 9, 2.1], [3, 11, 1.6], [13, 13, 1.5]]) {
      const d = distV(x, y, cx, cy);
      if (d < raio) return distV(x, y, cx - 0.7, cy - 0.7) < 0.75 ? vr(hex(0x6a6a7a), r, 0.05) : vr(hex(0x222228), r, 0.1);
    }
    return pedraCinza(x, y, r);
  },
  // 102 concreto (poros e furinhos de forma)
  102: (x, y, r) => {
    for (const [cx, cy] of [[3.5, 3.5], [11.5, 3.5], [3.5, 11.5], [11.5, 11.5]]) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < 0.8) return vr(hex(0x7a7a76), r, 0.04);
      if (d < 1.5) return vr(hex(0xa4a4a0), r, 0.04);
    }
    const n = h2(x, y, 45);
    return vr(n < 0.05 ? hex(0x8a8a86) : n > 0.95 ? hex(0xcacac6) : h2(x >> 2, y >> 2, 46) < 0.4 ? hex(0xb0b0ac) : hex(0xb8b8b4), r, 0.04);
  },
  103: asfalto,
  104: (x, y, r) => (Math.abs(x - 7.5) < 1 && y >= 2 && y <= 11 ? vr(h2(x, y, 47) < 0.1 ? hex(0xc4c4bc) : hex(0xf4f4ee), r, 0.04) : asfalto(x, y, r)),
  // 105 janela azul (vidro espelhado com moldura)
  105: (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return vr(hex(0xd4d8de), r, 0.03);
    if (x === 1 || y === 1) return vr(hex(0x2c6ab0), r, 0.04);
    let c = mix(hex(0xa4dafa), hex(0x3c86d0), y / 15);
    const s = (x - y + 32) % 16;
    if (s === 6 || s === 7) c = mix(c, [255, 255, 255], 0.5);
    else if (s === 9) c = mix(c, [255, 255, 255], 0.28);
    return [...c, 255];
  },
  106: azulejo,
  // 107 luz de LED (painel com pontos de luz)
  107: (x, y, r) => {
    if (x < 2 || y < 2 || x > 13 || y > 13) return vr(x === 0 || y === 0 ? hex(0xd4d8de) : hex(0xa8aeb6), r, 0.04);
    const lx = (x - 2) % 4, ly = (y - 2) % 4;
    if (lx === 1 && ly === 1) return [255, 255, 255, 255];
    if ((lx === 1 && (ly === 0 || ly === 2)) || (ly === 1 && (lx === 0 || lx === 2))) return [238, 248, 255, 255];
    return vr(hex(0xd2e8fa), r, 0.03);
  },
  // 108 painel solar (topo) / 109 (lado) / 110 metal branco
  108: (x, y, r) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return vr(hex(0xd0d6de), r, 0.03);
    if (x === 5 || x === 10 || y === 5 || y === 10) return vr(hex(0x8a9ab0), r, 0.04);
    let c = mix(hex(0x2a4c96), hex(0x16306a), (x + y) / 30);
    const s = x + y;
    if (s >= 8 && s <= 10) c = mix(c, hex(0x6a8ad0), 0.5);
    if (x % 5 === 2 && y % 5 === 2) c = tom(c, 1.3);
    return vr(c, r, 0.04);
  },
  109: (x, y, r) => {
    if (y === 0) return vr(hex(0xd0d6de), r, 0.03);
    if (y < 3) return vr(hex(0x22408a), r, 0.05);
    if (y === 3) return vr(hex(0x9aa4b0), r, 0.04);
    if ((y === 7 || y === 9 || y === 11) && x >= 3 && x <= 12) return vr(hex(0xb4bcc8), r, 0.03);
    return vr(hex(0xe8ecf2), r, 0.03);
  },
  110: (x, y, r) => {
    if (x === 15 || y === 15) return vr(hex(0xc4cad4), r, 0.03);
    if (x === 0 || y === 0) return [255, 255, 255, 255];
    if ((x === 2 || x === 13) && (y === 2 || y === 13)) return vr(hex(0xb8bec8), r, 0.03);
    return vr(mix(hex(0xf6f8fb), hex(0xe4e8ee), y / 15), r, 0.02);
  },
  111: neon,
  112: cristal,
};

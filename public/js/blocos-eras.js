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
  [BE.FOLHAS_NEVE, 'Folhas com neve', 78],
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
const liso = (cor, amt = 0.15) => (x, y, r) => vr(hex(cor), r, amt);

// tile -> pintor. Versão simples (cores lisas com variação); a arte final substitui estes.
export const PINTORES = {
  64: liso(0x5f8f3a, 0.3), 65: (x, y, r) => vr(y < 4 ? hex(0x5f8f3a) : hex(0x7a5634), r, 0.25),
  66: (x, y, r) => (Math.abs(x - 7.5) < 1 || (y > 2 && Math.abs(x - 7.5) < (16 - y) * 0.45 && (x + y) % 3 !== 0) ? vr(hex(0x3f8f3a), r, 0.3) : [0, 0, 0, 0]),
  67: (x, y, r) => (x % 4 === 1 && y > 1 ? vr(hex(0x6aa84a), r, 0.2) : [0, 0, 0, 0]),
  68: liso(0xb08955), 69: (x, y, r) => vr(y % 3 === 0 ? hex(0x6b4a2b) : hex(0x8a6a44), r, 0.2), 70: liso(0x3c9a3a, 0.3),
  71: liso(0x3a3a40, 0.2), 72: (x, y, r) => vr(r() < 0.3 ? hex(0xffb030) : hex(0x6a2a1a), r, 0.3),
  73: (x, y, r) => (Math.hypot((x - 7.5) * 1.1, y - 9) < 5.5 ? vr(hex(0xf2e6c8), r, 0.15) : [0, 0, 0, 0]),
  74: (x, y, r) => vr(Math.abs(Math.hypot(x - 8, y - 8) - 4) < 1 ? hex(0xe8dcc0) : hex(0x8c8f96), r, 0.15),
  75: liso(0xf4f8ff, 0.06), 76: (x, y, r) => vr(y < 4 ? hex(0xf4f8ff) : hex(0x7a5634), r, 0.15), 77: liso(0xa8d8f0, 0.1),
  78: (x, y, r) => vr(r() < 0.4 ? hex(0xf4f8ff) : hex(0x2f6a3a), r, 0.2), 79: liso(0x9a7050, 0.25),
  80: (x, y, r) => vr(Math.hypot(x - 7.5, y - 7.5) < 4 ? hex(0xffa020) : hex(0x6b4a2b), r, 0.3), 81: (x, y, r) => vr(y < 6 ? hex(0xff9020) : hex(0x6b4a2b), r, 0.3),
  82: liso(0xd8b860, 0.25), 83: (x, y, r) => vr((x + y) % 7 === 0 ? hex(0xb0502a) : hex(0x8c8f96), r, 0.15), 84: liso(0xb07850, 0.2),
  85: liso(0xe0c080, 0.12), 86: (x, y, r) => vr(y % 5 === 4 ? hex(0xc8a868) : hex(0xe0c080), r, 0.12), 87: (x, y, r) => vr((x % 5 === 2 && y % 6 < 4) ? hex(0xa88848) : hex(0xe0c080), r, 0.12),
  88: liso(0xf0eee8, 0.08), 89: liso(0xeeeae0, 0.06), 90: (x, y, r) => vr(x % 4 === 0 ? hex(0xc8c4b8) : hex(0xeeeae0), r, 0.08),
  91: (x, y, r) => vr(y % 4 === 3 ? hex(0x9a4a2a) : hex(0xc8643a), r, 0.15), 92: liso(0xf2c040, 0.15),
  93: (x, y, r) => vr([0x3f6fd9, 0xf2c72e, 0xe8433f, 0xf0eee8][(x >> 2) + (y >> 2) & 3], r, 0.15),
  94: (x, y, r) => vr(y % 5 === 4 || x % 8 === (y % 10 < 5 ? 7 : 3) ? hex(0x6a6c70) : hex(0x9a9ca0), r, 0.15),
  95: (x, y, r) => vr(x < 2 || x > 13 || y < 2 || y > 13 || x === y ? hex(0x5a3d22) : hex(0xf0e8d8), r, 0.1),
  96: (x, y, r) => vr(x > 5 && x < 10 ? hex(0xf2c72e) : hex(0xd9473c), r, 0.12),
  97: (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 || x === 8 || y === 8 ? [60, 50, 40, 255] : [...hex([0xe8433f, 0x3f6fd9, 0xf2c72e, 0x4caf50][(x > 8) + (y > 8) * 2]), 170]),
  98: (x, y, r) => vr(y % 4 === 3 || x % 8 === ((y >> 2) % 2 ? 3 : 7) ? hex(0x4a3a34) : hex(0x7a3a2a), r, 0.15),
  99: (x, y, r) => vr((x === 2 || x === 13) && y % 4 === 2 ? hex(0x505660) : hex(0x80868e), r, 0.08),
  100: (x, y, r) => vr(Math.abs(Math.hypot(x - 7.5, y - 7.5) - 4.5) < 1.6 ? hex(0xa08040) : hex(0x5a5c60), r, 0.12),
  101: (x, y, r) => vr(r() < 0.3 ? hex(0x202024) : hex(0x8c8f96), r, 0.15),
  102: liso(0xb8b8b4, 0.08), 103: liso(0x3a3a3e, 0.12), 104: (x, y, r) => vr(x > 6 && x < 9 && y % 8 < 5 ? hex(0xf2f2f2) : hex(0x3a3a3e), r, 0.1),
  105: (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? [200, 205, 210, 255] : [120, 180, 230, 140]),
  106: (x, y, r) => vr((Math.abs(x - 7.5) + Math.abs(y - 7.5)) % 6 < 2 ? hex(0x2a5ab8) : hex(0xf4f6fa), r, 0.06),
  107: (x, y) => (x < 2 || y < 2 || x > 13 || y > 13 ? [180, 184, 190, 255] : [250, 252, 255, 255]),
  108: (x, y, r) => vr(x % 5 === 0 || y % 5 === 0 ? hex(0xc8ccd4) : hex(0x203a7a), r, 0.1), 109: liso(0xd8dce4, 0.06),
  110: liso(0xeef0f4, 0.04), 111: (x, y) => (x < 2 || y < 2 || x > 13 || y > 13 ? [40, 40, 60, 255] : [80, 255, 240, 255]),
  112: (x, y, r) => (Math.abs(x - 7.5) * 1.6 + Math.abs(y - 7.5) < 9 ? vr(hex(0xc070ff), r, 0.25) : [150, 90, 220, 90]),
};

// Casas de verdade: plantas com cômodos, portas, camas, mesas, cadeiras, janelas, escada e telhado.
// As mesmas plantas servem para as vilas (vilas.js carimba na geração do mundo) e para o pedreiro
// contratado (trabalho.js: ele constrói bloco a bloco, na ordem em que um pedreiro de verdade faria).
// Regras puras, sem tela: a sala online também usa este arquivo. Não importe nada que dependa do navegador.
//
// Coordenadas da planta: lx = largura (0..L-1), lz = fundo (0 = parede da frente, onde fica a porta),
// ly = altura (0 = piso). A porta da frente fica sempre no meio: lx = (L-1)/2, lz = 0.
// No mundo, `r` (0..3) diz para onde é "para dentro" da casa: +x, +z, -x, -z.

// ids dos blocos (iguais aos de blocos.js / blocos-mecanismos.js / formas-defs.js)
export const C = {
  AR: 0, GRAMA: 1, TERRA: 2, PEDRA: 3, TRONCO: 6, TABUAS: 8, VIDRO: 9, TIJOLO: 10,
  LA_BRANCA: 14, LA_VERMELHA: 15, LA_AZUL: 16, LA_AMARELA: 17, LA_VERDE: 18, LA_ROSA: 19,
  PEDRISCO: 20, LAMPIAO: 21, FENO: 33, BANCADA: 34,
  PORTA: 47, FORNO: 55, // blocos-mecanismos.js (porta abre com um toque; forno assa pão)
  CERCA: 84, MEIO: 90, ESCADA: 95, // formas-defs.js: escada 95..98 sobe para +x, +z, -x, -z
  // móveis (moveis.js): cama e cadeira têm 4 giros (cabeceira / frente para +x, +z, -x, -z)
  CAMA: 176, CADEIRA: 180, MESA: 184, BALCAO: 185, ESTANTE: 186, ESTANTE_PAO: 187,
};
// blocos que giram junto com a casa: base -> são 4 seguidos
const GIRA = new Set([C.ESCADA, C.CAMA, C.CADEIRA]);
export const baseGiro = (b) => { for (const g of GIRA) if (b >= g && b < g + 4) return g; return 0; };

// direções no mundo (na mesma ordem dos giros)
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// estilos de construção (pedreiro). As vilas passam o estilo delas (ESTILOS em vilas.js).
export const ESTILOS_OBRA = {
  madeira: { nome: 'Madeira', parede: C.TABUAS, canto: C.TRONCO, piso: C.TABUAS, telhado: C.TABUAS, faixa: C.TRONCO },
  tijolo: { nome: 'Tijolinho', parede: C.TIJOLO, canto: C.PEDRISCO, piso: C.TABUAS, telhado: C.TABUAS, faixa: C.PEDRISCO },
  pedra: { nome: 'Pedra', parede: C.PEDRISCO, canto: C.PEDRA, piso: C.TABUAS, telhado: C.TABUAS, faixa: C.TRONCO },
};

// fases da obra (ordem do pedreiro): limpar o terreno, piso, paredes (de baixo para cima), telhado, acabamento
const LIMPAR = 0, PISO = 1, PAREDE = 2, TELHADO = 3, ACABAMENTO = 4;

class Desenho {
  constructor(L, F) { this.L = L; this.F = F; this.m = new Map(); this.alto = 0; }
  set(x, y, z, b, fase = PAREDE) { this.m.set(x + ',' + y + ',' + z, [x, y, z, b, fase]); if (y > this.alto) this.alto = y; }
  tem(x, y, z) { return this.m.has(x + ',' + y + ',' + z); }
  // piso no ly 0 e paredes de ly 1 até h (cantos com outro material)
  caixa(e, y0, h, faixa) {
    const { L, F } = this;
    for (let x = 0; x < L; x++) for (let z = 0; z < F; z++) {
      if (y0 === 0) this.set(x, 0, z, e.piso, PISO);
      const bx = x === 0 || x === L - 1, bz = z === 0 || z === F - 1;
      if (!bx && !bz) continue;
      for (let y = y0 + 1; y <= y0 + h; y++) this.set(x, y, z, bx && bz ? e.canto : (faixa && y === y0 + h ? faixa : e.parede));
    }
  }
  janela(x, y, z) { this.set(x, y, z, C.VIDRO, ACABAMENTO); }
  porta(x, y, z) { this.set(x, y, z, C.PORTA, ACABAMENTO); this.set(x, y + 1, z, C.PORTA, ACABAMENTO); }
  movel(x, y, z, b, dir = 0) { this.set(x, y, z, GIRA.has(b) ? b + dir : b, ACABAMENTO); }
  // telhado: 'piramide' (4 águas) ou 'duas' (2 águas, cumeeira ao longo da largura), com beiral de 1 bloco
  // (a primeira camada é inteira: forro por dentro e beiral por fora)
  telhado(tipo, y0, mat, oitao) {
    const { L, F } = this;
    if (tipo === 'piramide') {
      for (let k = 0; ; k++) {
        const a0 = -1 + k, a1 = L - k, b0 = -1 + k, b1 = F - k;
        if (a0 > a1 || b0 > b1) break;
        for (let x = a0; x <= a1; x++) for (let z = b0; z <= b1; z++) if (x === a0 || x === a1 || z === b0 || z === b1 || k === 0) this.set(x, y0 + k, z, mat, TELHADO);
      }
      return;
    }
    for (let x = -1; x <= L; x++) for (let z = -1; z <= F; z++) this.set(x, y0, z, mat, TELHADO);
    for (let k = 1; ; k++) {
      const z0 = -1 + k, z1 = F - k;
      if (z0 > z1) break;
      for (let x = -1; x <= L; x++) { this.set(x, y0 + k, z0, mat, TELHADO); this.set(x, y0 + k, z1, mat, TELHADO); }
      // oitão: a parede em triângulo dos lados
      for (let z = z0 + 1; z < z1; z++) { this.set(0, y0 + k, z, oitao, TELHADO); this.set(L - 1, y0 + k, z, oitao, TELHADO); }
    }
  }
  // tudo o que sobrou dentro do volume da casa vira ar (tira terra, árvores e mato do caminho)
  limpar() {
    const { L, F } = this;
    for (let x = -1; x <= L; x++) for (let z = -1; z <= F; z++) for (let y = 1; y <= this.alto; y++) {
      if (!this.tem(x, y, z)) this.m.set(x + ',' + y + ',' + z, [x, y, z, C.AR, LIMPAR]);
    }
  }
  lista() {
    this.limpar();
    return [...this.m.values()].sort((a, b) => a[4] - b[4] || (a[4] === ACABAMENTO ? 0 : a[1] - b[1]));
  }
}

// ---------- as plantas ----------
// cada uma: (e = estilo, v = variação 0..1) -> Desenho. L e F são fixos por planta.
function casinha(e, v) {
  const d = new Desenho(5, 5);
  d.caixa(e, 0, 3);
  d.porta(2, 1, 0);
  d.janela(0, 2, 2); d.janela(4, 2, 2); d.janela(2, 2, 4);
  d.movel(1, 1, 3, C.CAMA, 0);
  d.movel(3, 1, 3, C.MESA);
  d.movel(3, 1, 2, C.CADEIRA, 0);
  d.movel(1, 1, 1, C.FORNO);
  d.movel(3, 3, 1, C.LAMPIAO);
  d.telhado(v < 0.5 ? 'piramide' : 'duas', 4, e.telhado, e.parede);
  return d;
}

function casa(e, v) {
  const d = new Desenho(7, 7);
  d.caixa(e, 0, 3);
  d.porta(3, 1, 0);
  // parede de dentro: sala na frente, quarto no fundo (com porta)
  for (let x = 1; x <= 5; x++) for (let y = 1; y <= 3; y++) d.set(x, y, 3, e.parede);
  d.porta(3, 1, 3);
  for (const [x, z] of [[1, 0], [5, 0], [0, 1], [6, 1], [0, 5], [6, 5], [2, 6], [4, 6]]) d.janela(x, 2, z);
  // sala e cozinha
  d.movel(1, 1, 2, C.MESA);
  d.movel(2, 1, 2, C.CADEIRA, 3);
  d.movel(1, 1, 1, C.CADEIRA, 0);
  d.movel(5, 1, 2, C.FORNO);
  d.movel(5, 1, 1, C.BANCADA);
  d.movel(4, 3, 1, C.LAMPIAO);
  // quarto
  d.movel(1, 1, 5, C.CAMA, 0);
  d.movel(5, 1, 5, C.CAMA, 0);
  d.movel(3, 1, 5, C.ESTANTE);
  d.movel(2, 3, 4, C.LAMPIAO);
  d.telhado(v < 0.5 ? 'duas' : 'piramide', 4, e.telhado, e.parede);
  return d;
}

function sobrado(e, v) {
  const d = new Desenho(7, 7);
  d.caixa(e, 0, 7, null);
  // faixa entre os andares e o piso de cima (com o buraco da escada)
  for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) {
    const borda = x === 0 || x === 6 || z === 0 || z === 6;
    if (borda) { if (!(x % 6 === 0 && z % 6 === 0)) d.set(x, 4, z, e.faixa || e.canto); continue; }
    if (x === 1 && z >= 2 && z <= 4) continue; // buraco da escada
    d.set(x, 4, z, e.piso);
  }
  d.porta(3, 1, 0);
  // escada encostada na parede da esquerda, subindo para o fundo
  for (let k = 0; k < 4; k++) d.movel(1, 1 + k, 2 + k, C.ESCADA, 0);
  // corrimão em volta do buraco
  for (const [x, z] of [[1, 1], [2, 2], [2, 3], [2, 4]]) d.movel(x, 5, z, C.CERCA);
  // janelas dos dois andares
  for (const [x, z] of [[1, 0], [5, 0], [6, 3], [0, 1], [3, 6], [5, 6]]) d.janela(x, 2, z);
  for (const [x, z] of [[1, 0], [3, 0], [5, 0], [0, 4], [6, 2], [6, 4], [3, 6]]) d.janela(x, 6, z);
  // embaixo: sala e cozinha
  d.movel(4, 1, 3, C.MESA);
  d.movel(4, 1, 2, C.CADEIRA, 0);
  d.movel(5, 1, 3, C.CADEIRA, 2 + 1);
  d.movel(4, 1, 4, C.CADEIRA, 2);
  d.movel(5, 1, 5, C.FORNO);
  d.movel(3, 1, 5, C.ESTANTE);
  d.movel(5, 3, 1, C.LAMPIAO);
  // em cima: quarto com duas camas
  d.movel(5, 5, 5, C.CAMA, 0);
  d.movel(3, 5, 5, C.CAMA, 0);
  d.movel(5, 5, 1, C.ESTANTE);
  d.movel(4, 5, 3, C.MESA);
  d.movel(4, 7, 4, C.LAMPIAO);
  d.telhado(v < 0.5 ? 'duas' : 'piramide', 8, e.telhado, e.parede);
  return d;
}

function padaria(e, v) {
  const d = new Desenho(7, 7);
  d.caixa(e, 0, 3);
  d.porta(3, 1, 0);
  // vitrine na frente
  for (const x of [1, 2, 4, 5]) d.janela(x, 2, 0);
  d.janela(0, 2, 2); d.janela(6, 2, 2);
  // balcão (com passagem do lado direito) e, atrás dele, o forno e o trigo
  for (const x of [1, 2, 3, 4]) d.movel(x, 1, 3, C.BALCAO);
  d.movel(3, 1, 5, C.FORNO);
  d.movel(4, 1, 5, C.FORNO);
  d.movel(1, 1, 5, C.FENO); d.movel(1, 2, 5, C.FENO); d.movel(2, 1, 5, C.FENO);
  d.movel(5, 1, 5, C.MESA);
  d.movel(1, 1, 4, C.ESTANTE_PAO);
  // cantinho do café para os fregueses
  d.movel(5, 1, 1, C.MESA);
  d.movel(5, 1, 2, C.CADEIRA, 2);
  d.movel(1, 1, 1, C.ESTANTE_PAO);
  d.movel(3, 3, 2, C.LAMPIAO);
  d.telhado('duas', 4, e.telhado, e.parede);
  return d;
}

function loja(e, v) {
  const d = new Desenho(7, 7);
  d.caixa(e, 0, 3);
  d.porta(3, 1, 0);
  for (const x of [1, 2, 4, 5]) d.janela(x, 2, 0);
  // caixa (balcão) na esquerda; estantes no fundo e nos lados
  d.movel(1, 1, 2, C.BALCAO); d.movel(2, 1, 2, C.BALCAO);
  for (const x of [1, 2, 3, 4, 5]) { d.movel(x, 1, 5, C.ESTANTE); d.movel(x, 2, 5, C.ESTANTE); }
  d.movel(5, 1, 3, C.ESTANTE); d.movel(5, 1, 2, C.ESTANTE_PAO);
  d.movel(1, 1, 4, C.ESTANTE_PAO);
  d.movel(3, 3, 3, C.LAMPIAO);
  d.janela(0, 2, 3); d.janela(6, 2, 4);
  d.telhado(v < 0.5 ? 'piramide' : 'duas', 4, e.telhado, e.parede);
  return d;
}

// PLANTAS: o que o pedreiro sabe construir (e o que as vilas usam)
export const PLANTAS = {
  casinha: { nome: 'Casinha', desc: 'Um cômodo com cama, mesa e fogão', ic: 'casa', L: 5, F: 5, f: casinha },
  casa: { nome: 'Casa com quarto', desc: 'Sala, cozinha e quarto com duas camas', ic: 'casa', L: 7, F: 7, f: casa },
  sobrado: { nome: 'Sobrado', desc: 'Dois andares, escada e quarto em cima', ic: 'castelo', L: 7, F: 7, f: sobrado },
  padaria: { nome: 'Padaria', desc: 'Forno, balcão e trigo. Para o padeiro trabalhar', ic: 'pao', L: 7, F: 7, f: padaria, negocio: 'padaria' },
  loja: { nome: 'Loja', desc: 'Balcão e prateleiras. Para o lojista vender', ic: 'moeda', L: 7, F: 7, f: loja, negocio: 'loja' },
};

const cache = new Map();
// lista de blocos da planta em coordenadas da planta: [lx, ly, lz, b, fase], na ordem de construir
export function desenhar(id, estilo, v = 0) {
  const p = PLANTAS[id];
  if (!p) return null;
  const e = typeof estilo === 'string' ? ESTILOS_OBRA[estilo] : estilo;
  if (!e) return null;
  const k = typeof estilo === 'string' ? id + ':' + estilo + ':' + (v < 0.5 ? 0 : 1) : null;
  if (k && cache.has(k)) return cache.get(k);
  const l = p.f(e, v).lista();
  if (k) cache.set(k, l);
  return l;
}

// de coordenadas da planta para o mundo. (x, y, z) = onde fica a porta da frente (no chão), r = para dentro
export function noMundo(id, x, y, z, r) {
  const p = PLANTAS[id];
  const [dx, dz] = DIRS[r & 3], [sx, sz] = DIRS[(r + 1) & 3];
  const meio = (p.L - 1) / 2;
  return (lx, ly, lz) => [x + (lx - meio) * sx + lz * dx, y + ly, z + (lx - meio) * sz + lz * dz];
}
export function girar(b, r) { const g = baseGiro(b); return g ? g + ((b - g + r) & 3) : b; }

// blocos da obra no mundo: [[x, y, z, b], ...] na ordem de construir
export function blocosDaObra(o) {
  const l = desenhar(o.p, o.e, o.v || 0);
  if (!l) return [];
  const pos = noMundo(o.p, o.x, o.y, o.z, o.r);
  return l.map(([lx, ly, lz, b]) => [...pos(lx, ly, lz), girar(b, o.r)]);
}

// retângulo que a obra ocupa no chão (com o beiral): [x0, z0, x1, z1]
export function areaDaObra(o) {
  const p = PLANTAS[o.p], pos = noMundo(o.p, o.x, o.y, o.z, o.r);
  const a = pos(-1, 0, -1), b = pos(p.L, 0, p.F);
  return [Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2])];
}
export const alturaDaPlanta = (id) => { const l = desenhar(id, 'madeira'); let h = 0; for (const c of l) h = Math.max(h, c[1]); return h; };

// ---------- materiais ----------
// o pedreiro faz os móveis na hora com material bruto (uma cama = tábuas + lã)
const BRUTO = {
  [C.CAMA]: [[C.TABUAS, 2], [C.LA_BRANCA, 1], [C.LA_VERMELHA, 1]],
  [C.CADEIRA]: [[C.TABUAS, 2]],
  [C.MESA]: [[C.TABUAS, 3]],
  [C.BALCAO]: [[C.TABUAS, 3]],
  [C.ESTANTE]: [[C.TABUAS, 4]],
  [C.ESTANTE_PAO]: [[C.TABUAS, 4]],
  [C.PORTA]: [[C.TABUAS, 2]],
  [C.FORNO]: [[C.PEDRA, 6], [C.PEDRISCO, 2]],
  [C.ESCADA]: [[C.TABUAS, 1]],
  [C.CERCA]: [[C.TABUAS, 1]],
  [C.MEIO]: [[C.PEDRA, 1]],
};
export function brutoDe(b) {
  if (!b) return [];
  const g = baseGiro(b) || b;
  return BRUTO[g] || [[b, 1]];
}
// { id: quantidade } para uma lista de blocos (a partir de `de`)
export function materiais(blocos, de = 0) {
  const m = {};
  for (let i = de; i < blocos.length; i++) for (const [id, n] of brutoDe(blocos[i][3])) m[id] = (m[id] || 0) + n;
  return m;
}

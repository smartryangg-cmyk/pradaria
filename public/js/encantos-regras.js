// Encantar (como no clássico), regras puras: sem tela. O jogo sem internet e a sala online usam as mesmas.
// Na mesa de encantar a pessoa põe uma ferramenta, espada ou peça de armadura e paga com pedra-azul e níveis
// de experiência. A mesa mostra 3 ofertas (1, 2 e 3 de pedra-azul); estantes em volta deixam as ofertas mais fortes.
// Os encantos:
//   Eficiência (ferramentas): quebra mais rápido (a velocidade ganha nível² + 1)
//   Afiada (espadas): golpe mais forte (meio coração a mais por nível, mais meio)
//   Proteção (armadura): cada nível tira 4% do dano de fora (até 80% somando as peças)
//   Inquebrável (todos): dura mais (ferramenta: nível + 1 vezes; armadura: um pouco menos)
// O encanto fica guardado no mesmo número do desgaste (receitas.js e.desg): usos + BASE x máscara.
// Assim ele anda junto com a coisa quando ela vai para o chão, para o baú ou para outra pessoa.
import { FERRAMENTAS, DURA } from './receitas.js';
import { ARMADURA } from './armadura-regras.js';
import { nivelDe, paraProximo } from './xp-regras.js';

export const BASE = 8192; // usos cabem abaixo disto (picareta de diamante inquebrável III: 1561 x 4)
export const PEDRA_AZUL = 1129; // o que paga o encanto (receitas.js I.PEDRA_AZUL)

// nome, nível máximo, peso (chance de sair), a faixa de "força" de cada nível [mín(l), máx(l)], e quem aceita
export const ENCANTOS = [
  { k: 'eficiencia', nome: 'Eficiência', max: 5, peso: 10, min: (l) => 1 + 10 * (l - 1), faixa: 50, para: 'ferramenta' },
  { k: 'afiada', nome: 'Afiada', max: 5, peso: 10, min: (l) => 1 + 11 * (l - 1), faixa: 20, para: 'espada' },
  { k: 'protecao', nome: 'Proteção', max: 4, peso: 10, min: (l) => 1 + 11 * (l - 1), faixa: 11, para: 'armadura' },
  { k: 'inquebravel', nome: 'Inquebrável', max: 3, peso: 5, min: (l) => 5 + 8 * (l - 1), faixa: 50, para: 'todos' },
];
const IDX = Object.fromEntries(ENCANTOS.map((x, i) => [x.k, i]));
export const ROMANO = ['', 'I', 'II', 'III', 'IV', 'V'];

const ESPADA = { 1113: 1, 1114: 2, 1115: 3, 1116: 4 }; // receitas.js I.ESPADA_* -> material
// quanto o material "aceita" encanto (madeira, pedra, ferro, diamante; couro, ferro, diamante na armadura)
const ENC_FERRAMENTA = [0, 15, 5, 14, 10];
const ENC_ARMADURA = { 0: 15, 1: 9, 2: 10 }; // couro, ferro, diamante

export function tipoEnc(id) {
  if (ESPADA[id]) return 'espada';
  if (FERRAMENTAS[id]) return 'ferramenta';
  if (ARMADURA[id]) return 'armadura';
  return null;
}
export function encantabilidade(id) {
  if (ESPADA[id]) return ENC_FERRAMENTA[ESPADA[id]];
  if (FERRAMENTAS[id]) return ENC_FERRAMENTA[FERRAMENTAS[id][2]] || 1;
  if (ARMADURA[id]) return ENC_ARMADURA[Math.floor((id - 1117) / 4)] || 1;
  return 0;
}
const aceita = (enc, tipo) => enc.para === 'todos' || enc.para === tipo;

// ---- o número do desgaste ----
export const usosDe = (v) => Math.max(0, v | 0) % BASE;
export const mascaraDe = (v) => Math.floor(Math.max(0, v | 0) / BASE);
export const nivelEnc = (v, k) => (mascaraDe(v) >> (3 * IDX[k])) & 7;
export const encantado = (v) => mascaraDe(v) > 0;
export function comEncantos(v, lista) {
  let m = 0;
  for (const [k, l] of lista) if (k in IDX) m |= Math.min(7, l | 0) << (3 * IDX[k]);
  return usosDe(v) + BASE * m;
}
export function listaEnc(v) {
  const m = mascaraDe(v), r = [];
  ENCANTOS.forEach((x, i) => { const l = (m >> (3 * i)) & 7; if (l) r.push([x.k, l]); });
  return r;
}
export const nomeEnc = (k, l) => ENCANTOS[IDX[k]].nome + ' ' + ROMANO[l];
// máscara válida para este item (o que não serve ou passa do máximo cai fora)
export function limparMascara(id, v) {
  const tipo = tipoEnc(id);
  const ok = listaEnc(v).filter(([k, l]) => tipo && aceita(ENCANTOS[IDX[k]], tipo) && l <= ENCANTOS[IDX[k]].max);
  return comEncantos(v, ok);
}

// quantos usos esta coisa aguenta (inquebrável estica)
export function duraDe(id, v) {
  const d = DURA[id] || 0, l = nivelEnc(v, 'inquebravel');
  if (!d || !l) return d;
  return ARMADURA[id] ? Math.floor(d / (0.6 + 0.4 / (l + 1))) : d * (l + 1);
}

// ---- efeitos ----
export const bonusEficiencia = (l) => (l > 0 ? l * l + 1 : 0);
export const bonusAfiada = (l) => (l > 0 ? (0.5 * l + 0.5) / 2 : 0); // em corações (o clássico soma 0,5 x nível + 0,5 de vida)
// proteção somada das peças (cada nível = 1 ponto, até 20; cada ponto tira 4%)
export function fatorProtecao(niveis) {
  const p = Math.min(20, (niveis || []).reduce((s, l) => s + (l | 0), 0));
  return 1 - p * 0.04;
}

// ---- ofertas da mesa ----
// sorteio que dá igual no jogo e na sala (semente da pessoa + coisa + estantes)
function rng(s) {
  let a = s >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const ent = (r, a, b) => a + Math.floor(r() * (b - a + 1)); // inteiro de a até b

// encantos que saem para a força m (o primeiro é o que a mesa mostra; pode vir mais de um)
function sortearEncantos(r, id, m0) {
  const tipo = tipoEnc(id), e = encantabilidade(id);
  let m = m0 + 1 + ent(r, 0, Math.floor(e / 4)) + ent(r, 0, Math.floor(e / 4));
  m = Math.max(1, Math.round(m * (1 + (r() + r() - 1) * 0.15)));
  const possiveis = () => {
    const l = [];
    for (const x of ENCANTOS) {
      if (!aceita(x, tipo)) continue;
      for (let n = x.max; n >= 1; n--) if (m >= x.min(n) && m <= x.min(n) + x.faixa) { l.push([x, n]); break; }
    }
    return l;
  };
  const tirar = (l) => { let s = l.reduce((a, [x]) => a + x.peso, 0) * r(); for (const p of l) { s -= p[0].peso; if (s < 0) return p; } return l[l.length - 1]; };
  let l = possiveis();
  if (!l.length) return [];
  const saiu = [tirar(l)];
  let extra = m;
  while (r() < (extra + 1) / 50) {
    l = l.filter(([x]) => !saiu.some(([y]) => y === x));
    if (!l.length) break;
    saiu.push(tirar(l));
    extra = Math.floor(extra / 2);
  }
  return saiu.map(([x, n]) => [x.k, n]);
}

// as 3 ofertas: [{ nivel (o mínimo para escolher e o tamanho do encanto), custo (pedra-azul e níveis), encs }]
export function ofertas(id, v, estantes, semente) {
  if (!tipoEnc(id) || encantado(v)) return [];
  const b = Math.max(0, Math.min(15, estantes | 0));
  const r = rng(Math.imul(semente | 0, 31) + Math.imul(id, 7919) + b);
  const base = ent(r, 1, 8) + Math.floor(b / 2) + ent(r, 0, b);
  const niv = [Math.floor(Math.max(base / 3, 1)), Math.floor(base * 2 / 3 + 1), Math.floor(Math.max(base, b * 2))];
  return niv.map((n, i) => {
    const encs = sortearEncantos(rng(Math.imul(semente | 0, 131) + Math.imul(id, 17) + i * 977 + n), id, n);
    return { nivel: n, custo: i + 1, encs };
  }).filter((o) => o.encs.length);
}

// tira n níveis guardando o pedaço da barra que já estava cheio (como no clássico)
export function gastarNiveis(e, n) {
  const { nivel, frac } = nivelDe(e.xp | 0);
  const alvo = Math.max(0, nivel - n);
  let xp = 0;
  for (let k = 0; k < alvo; k++) xp += paraProximo(k);
  e.xp = xp + Math.floor(frac * paraProximo(alvo));
}

// quantas estantes contam: no anel em volta da mesa a 2 blocos (5x5 sem o meio), na altura da mesa ou 1 acima,
// com o bloco entre a estante e a mesa vazio (como no clássico). bloco(x,y,z) devolve o id.
export const ESTANTE = 186;
export function contarEstantes(bloco, x, y, z) {
  let n = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2) continue;
    for (let h = 0; h <= 1; h++) {
      if (bloco(x + dx, y + h, z + dz) !== ESTANTE) continue;
      if (bloco(x + Math.trunc(dx / 2), y + h, z + Math.trunc(dz / 2))) continue; // tem algo no meio
      n++;
    }
  }
  return Math.min(15, n);
}

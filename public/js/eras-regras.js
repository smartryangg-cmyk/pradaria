// Regras do mundo "Linha do Tempo": eras, experiência (XP) e missões.
// Código puro (sem DOM): o mesmo arquivo roda no jogo (modo sem internet) e na sala do servidor,
// então os dois dão exatamente a mesma experiência para as mesmas ações.
import { BE } from './blocos-eras.js';

// xp = experiência que o mundo precisa juntar NESTA era para poder viajar para a próxima.
// fauna = bichos que aparecem (e que contam como "descoberta" no primeiro carinho).
// lugares = pontos especiais do mapa que dão experiência ao serem encontrados.
export const ERAS = [
  {
    id: 'dinos', nome: 'Era dos Dinossauros', curto: 'Dinossauros', quando: 'Há 70 milhões de anos', ic: 'dino', cor: '#7cb342', xp: 150,
    fauna: ['braquiossauro', 'triceratops', 'estegossauro', 'pterossauro', 'rexinho'],
    lugares: ['vulcao', 'ninho'],
    missoes: [
      { id: 'd1', txt: 'Faça carinho em 3 tipos de dinossauro', m: 'descobrir', n: 3, xp: 40 },
      { id: 'd2', txt: 'Encontre o vulcão', m: 'achar', r: 'vulcao', n: 1, xp: 30 },
      { id: 'd3', txt: 'Plante 8 samambaias', m: 'colocar', r: BE.SAMAMBAIA, n: 8, xp: 30 },
      { id: 'd4', txt: 'Ache um ninho de ovos de dinossauro', m: 'achar', r: 'ninho', n: 1, xp: 30 },
    ],
  },
  {
    id: 'gelo', nome: 'Era do Gelo', curto: 'Gelo', quando: 'Há 20 mil anos', ic: 'floco', cor: '#4fc3f7', xp: 300,
    fauna: ['mamute', 'preguica', 'gliptodonte', 'rena', 'coelho'],
    lugares: ['geleira'],
    missoes: [
      { id: 'g1', txt: 'Faça carinho em um mamute', m: 'carinho', r: 'mamute', n: 1, xp: 30 },
      { id: 'g2', txt: 'Construa um iglu com 20 blocos de neve', m: 'colocar', r: BE.BLOCO_NEVE, n: 20, xp: 50 },
      { id: 'g3', txt: 'Descubra 3 bichos da Era do Gelo', m: 'descobrir', n: 3, xp: 50 },
      { id: 'g4', txt: 'Ache a geleira gigante', m: 'achar', r: 'geleira', n: 1, xp: 40 },
    ],
  },
  {
    id: 'pedra', nome: 'Idade da Pedra', curto: 'Pedra', quando: 'Há 10 mil anos', ic: 'fogueira', cor: '#a1887f', xp: 450,
    fauna: ['lobinho', 'auroque', 'cavalo', 'cabra', 'coelho', 'galinha'],
    lugares: ['caverna', 'circulo'],
    missoes: [
      { id: 'p1', txt: 'Acenda 3 fogueiras', m: 'colocar', r: BE.FOGUEIRA, n: 3, xp: 40 },
      { id: 'p2', txt: 'Faça amizade com um lobinho', m: 'carinho', r: 'lobinho', n: 1, xp: 40 },
      { id: 'p3', txt: 'Ache a caverna com pinturas', m: 'achar', r: 'caverna', n: 1, xp: 50 },
      { id: 'p4', txt: 'Converse com 3 pessoas do povoado', m: 'conversa', n: 3, xp: 40 },
    ],
  },
  {
    id: 'antiga', nome: 'Antiguidade', curto: 'Antiguidade', quando: 'Há 3 mil anos', ic: 'coluna', cor: '#ffb74d', xp: 600,
    fauna: ['camelo', 'cavalo', 'gato', 'cabra', 'ovelha', 'galinha'],
    lugares: ['piramide', 'templo'],
    missoes: [
      { id: 'a1', txt: 'Visite a pirâmide', m: 'achar', r: 'piramide', n: 1, xp: 60 },
      { id: 'a2', txt: 'Construa com 10 colunas', m: 'colocar', r: BE.COLUNA, n: 10, xp: 50 },
      { id: 'a3', txt: 'Faça carinho em um camelo', m: 'carinho', r: 'camelo', n: 1, xp: 40 },
      { id: 'a4', txt: 'Faça um mosaico com 12 blocos', m: 'colocar', r: BE.MOSAICO, n: 12, xp: 40 },
    ],
  },
  {
    id: 'medieval', nome: 'Idade Média', curto: 'Idade Média', quando: 'Há 800 anos', ic: 'castelo', cor: '#9575cd', xp: 800,
    fauna: ['cavalo', 'ovelha', 'porquinho', 'vaca', 'galinha', 'pato', 'cachorro'],
    lugares: ['castelo', 'moinho'],
    missoes: [
      { id: 'm1', txt: 'Visite o castelo', m: 'achar', r: 'castelo', n: 1, xp: 60 },
      { id: 'm2', txt: 'Monte um vitral com 6 blocos', m: 'colocar', r: BE.VITRAL, n: 6, xp: 40 },
      { id: 'm3', txt: 'Converse com 5 aldeões', m: 'conversa', n: 5, xp: 50 },
      { id: 'm4', txt: 'Faça carinho em 2 cavalos', m: 'carinho', r: 'cavalo', n: 2, xp: 40 },
    ],
  },
  {
    id: 'industrial', nome: 'Era Industrial', curto: 'Industrial', quando: 'Há 150 anos', ic: 'engrenagem', cor: '#8d6e63', xp: 1000,
    fauna: ['cavalo', 'vaca', 'ovelha', 'galinha', 'gato', 'cachorro', 'pato'],
    lugares: ['fabrica', 'estacao'],
    missoes: [
      { id: 'i1', txt: 'Visite a fábrica', m: 'achar', r: 'fabrica', n: 1, xp: 60 },
      { id: 'i2', txt: 'Coloque 10 engrenagens', m: 'colocar', r: BE.ENGRENAGEM, n: 10, xp: 50 },
      { id: 'i3', txt: 'Explore 20 lugares novos', m: 'explorar', n: 20, xp: 50 },
      { id: 'i4', txt: 'Construa com 30 tijolos de fábrica', m: 'colocar', r: BE.TIJOLO_FABRICA, n: 30, xp: 50 },
    ],
  },
  {
    id: 'moderna', nome: 'Era Moderna', curto: 'Moderna', quando: 'Hoje', ic: 'predio', cor: '#29b6f6', xp: 1300,
    fauna: ['cachorro', 'gato', 'capivara', 'galinha', 'coelho', 'porquinho', 'vaca'],
    lugares: ['predio', 'estadio'],
    missoes: [
      { id: 'o1', txt: 'Visite o arranha-céu', m: 'achar', r: 'predio', n: 1, xp: 60 },
      { id: 'o2', txt: 'Faça uma rua com 30 asfaltos', m: 'colocar', r: BE.ASFALTO, n: 30, xp: 60 },
      { id: 'o3', txt: 'Decore com 12 azulejos', m: 'colocar', r: BE.AZULEJO, n: 12, xp: 50 },
      { id: 'o4', txt: 'Faça carinho em 5 bichos', m: 'carinho', n: 5, xp: 40 },
    ],
  },
  {
    id: 'futuro', nome: 'Futuro', curto: 'Futuro', quando: 'Daqui a 100 anos', ic: 'foguete', cor: '#ab47bc', xp: null,
    fauna: ['robocao', 'cachorro', 'gato', 'capivara', 'rexinho', 'coelho'],
    lugares: ['foguete', 'cupula'],
    missoes: [
      { id: 'f1', txt: 'Visite o foguete', m: 'achar', r: 'foguete', n: 1, xp: 80 },
      { id: 'f2', txt: 'Instale 8 painéis solares', m: 'colocar', r: BE.PAINEL_SOLAR, n: 8, xp: 60 },
      { id: 'f3', txt: 'Faça amizade com o robô-cão', m: 'carinho', r: 'robocao', n: 1, xp: 60 },
      { id: 'f4', txt: 'Ilumine com 10 neons', m: 'colocar', r: BE.NEON, n: 10, xp: 60 },
    ],
  },
];
export const ULTIMA = ERAS.length - 1;

// experiência de cada ação. espera = tempo mínimo (ms) entre duas vezes da mesma ação, por jogador.
export const GANHO = {
  colocar: { xp: 1, espera: 0 },
  quebrar: { xp: 1, espera: 0 },
  carinho: { xp: 2, espera: 3000 },
  conversa: { xp: 4, espera: 12000 },
  explorar: { xp: 1, espera: 1500 },
  descobrir: { xp: 25 }, // primeiro carinho numa espécie da era
  achar: { xp: 30 }, // primeira visita a um lugar especial da era
};
export const TETO_MINUTO = 60; // XP de ações comuns por jogador por minuto (descobertas e missões não contam)
export const EVENTOS = new Set(['colocar', 'quebrar', 'carinho', 'conversa', 'explorar', 'achar']);

export function estadoNovo() {
  return { era: 0, xp: 0, total: 0, desc: [], achados: [], miss: {}, feitas: [] };
}

// confere/limpa um estado vindo do armazenamento (versões antigas, dados estranhos)
export function normalizar(e) {
  const n = estadoNovo();
  if (!e || typeof e !== 'object') return n;
  n.era = Math.max(0, Math.min(ULTIMA, e.era | 0));
  n.xp = Math.max(0, +e.xp || 0);
  n.total = Math.max(n.xp, +e.total || 0);
  if (Array.isArray(e.desc)) n.desc = e.desc.filter((s) => typeof s === 'string').slice(0, 100);
  if (Array.isArray(e.achados)) n.achados = e.achados.filter((s) => ERAS[n.era].lugares.includes(s));
  if (Array.isArray(e.feitas)) n.feitas = e.feitas.filter((s) => ERAS[n.era].missoes.some((m) => m.id === s));
  if (e.miss && typeof e.miss === 'object') for (const m of ERAS[n.era].missoes) if (e.miss[m.id] > 0) n.miss[m.id] = Math.min(m.n, e.miss[m.id] | 0);
  return n;
}

export const podeAvancar = (e) => e.era < ULTIMA && e.xp >= ERAS[e.era].xp;
export const progresso = (e) => (ERAS[e.era].xp ? Math.min(1, e.xp / ERAS[e.era].xp) : 1);

// Aplica uma ação de um jogador. `jog` guarda as esperas e o teto por minuto desse jogador
// (fica na memória, não precisa salvar). ev = { m: 'carinho', r: 'mamute' }.
// Retorna { xp, novidades: [{ t: 'descoberta'|'achado'|'missao'|'pronto', ... }] } ou null se nada mudou.
export function aplicarEvento(e, jog, ev, agora = Date.now()) {
  if (!ev || !EVENTOS.has(ev.m)) return null;
  const era = ERAS[e.era];
  const g = GANHO[ev.m];
  const novidades = [];
  let xp = 0;
  const estavaPronto = podeAvancar(e);
  jog.ult ||= {};
  jog.min ||= { ini: 0, n: 0 };

  if (ev.m === 'achar') {
    if (!era.lugares.includes(ev.r) || e.achados.includes(ev.r)) return null;
    e.achados.push(ev.r);
    xp += GANHO.achar.xp;
    novidades.push({ t: 'achado', r: ev.r, xp: GANHO.achar.xp });
  } else {
    // a primeira vez com uma espécie da era é sempre descoberta (não espera nada)
    const descoberta = ev.m === 'carinho' && typeof ev.r === 'string' && era.fauna.includes(ev.r) && !e.desc.includes(ev.r);
    // esperas e teto por minuto (para ninguém "farmar" clicando sem parar)
    const cedo = g.espera && agora - (jog.ult[ev.m] || 0) < g.espera;
    if (cedo && !descoberta) return null;
    if (!cedo) {
      jog.ult[ev.m] = agora;
      if (agora - jog.min.ini > 60000) { jog.min.ini = agora; jog.min.n = 0; }
      if (jog.min.n < TETO_MINUTO) { jog.min.n += g.xp; xp += g.xp; }
    }
    if (descoberta) {
      e.desc.push(ev.r);
      xp += GANHO.descobrir.xp;
      novidades.push({ t: 'descoberta', r: ev.r, xp: GANHO.descobrir.xp });
    }
  }

  // missões da era (contadores do mundo inteiro)
  const descobriu = novidades.some((n) => n.t === 'descoberta');
  for (const m of era.missoes) {
    if (e.feitas.includes(m.id)) continue;
    let conta = false;
    if (m.m === 'descobrir') conta = descobriu;
    else if (m.m === 'achar') conta = ev.m === 'achar' && ev.r === m.r;
    else conta = ev.m === m.m && (m.r === undefined || ev.r === m.r);
    if (!conta) continue;
    e.miss[m.id] = (e.miss[m.id] || 0) + 1;
    if (e.miss[m.id] >= m.n) {
      e.miss[m.id] = m.n;
      e.feitas.push(m.id);
      xp += m.xp;
      novidades.push({ t: 'missao', id: m.id, xp: m.xp });
    }
  }
  if (!xp && !novidades.length) return null;
  e.xp += xp; e.total += xp;
  if (!estavaPronto && podeAvancar(e)) novidades.push({ t: 'pronto' });
  return { xp, novidades };
}

// viaja para a próxima era. O que sobrou de experiência passa em parte para a era nova.
export function avancar(e) {
  if (!podeAvancar(e)) return false;
  const sobra = e.xp - ERAS[e.era].xp;
  e.era++;
  e.xp = Math.min(sobra, Math.floor((ERAS[e.era].xp || 0) * 0.3));
  e.achados = []; e.miss = {}; e.feitas = [];
  return true;
}

export const missao = (era, id) => ERAS[era].missoes.find((m) => m.id === id);

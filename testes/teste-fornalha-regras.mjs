// Regras do jogo clássico: minérios com a picareta certa, fornalha (tempo, combustível) e as ações da mochila.
// node testes/teste-fornalha-regras.mjs
import { IDS as I, oQueCai, nivelFalta, receitasDoMundo, RECEITAS, receitaDaGrade, desenhoDe, guardavel, DURA, toquesCom } from '../public/js/receitas.js';
import { fornoNovo, avancar, porNoForno, tirarDoForno, normalizarForno, fornoPublico, fornoDaRede, conteudo, TEMPO_FORNO } from '../public/js/fornalha-regras.js';
import { aplicar, estadoNovo, opcoesEcon } from '../public/js/economia.js';
import { podeNoChao } from '../public/js/regras-chao.js';

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHA ') + m); if (!c) falhas++; };
const ids = (l) => l.map(([id]) => id).join(',');

// ---------- minérios e picaretas ----------
ok(oQueCai(I.PEDRA, 0, 0, 0, true, 0, true).length === 0, 'clássico: pedra com a mão não dá nada');
ok(ids(oQueCai(I.PEDRA, 0, 0, 0, true, I.PICARETA_MADEIRA, true)) === String(I.PEDRA), 'clássico: pedra com picareta de madeira dá pedra');
ok(ids(oQueCai(I.PEDRA, 0, 0, 0, true, 0, false)) === String(I.PEDRA), 'mundo com mods: pedra com a mão continua dando pedra');
ok(ids(oQueCai(66, 0, 0, 0, true, I.PICARETA_MADEIRA, true)) === String(I.CARVAO), 'carvão: picareta de madeira dá o carvão (item)');
ok(oQueCai(67, 0, 0, 0, true, I.PICARETA_MADEIRA, true).length === 0 && ids(oQueCai(67, 0, 0, 0, true, I.PICARETA_PEDRA, true)) === '67', 'ferro: precisa de picareta de pedra (cai o minério)');
ok(oQueCai(68, 0, 0, 0, true, I.PICARETA_PEDRA, true).length === 0 && ids(oQueCai(68, 0, 0, 0, true, I.PICARETA_FERRO, true)) === '68', 'ouro: precisa de picareta de ferro');
ok(oQueCai(69, 0, 0, 0, true, I.PICARETA_PEDRA, true).length === 0 && ids(oQueCai(69, 0, 0, 0, true, I.PICARETA_FERRO, true)) === String(I.DIAMANTE), 'diamante: picareta de ferro dá o diamante');
ok(nivelFalta(69, I.PICARETA_PEDRA) === 3 && nivelFalta(69, I.PICARETA_DIAMANTE) === 0 && nivelFalta(I.TERRA, 0) === 0, 'nivelFalta diz que picareta precisa');
ok(ids(oQueCai(I.FORNALHA, 0, 0, 0, false, I.PICARETA_MADEIRA, true)) === String(I.FORNALHA) && ids(oQueCai(189, 0, 0, 0, false, I.PICARETA_MADEIRA, true)) === String(I.FORNALHA), 'fornalha (acesa ou não) volta fornalha');
ok(toquesCom(30, 69, I.PICARETA_DIAMANTE) < toquesCom(30, 69, I.PICARETA_FERRO) && toquesCom(30, 69, I.PICARETA_FERRO) < toquesCom(30, 69, I.PICARETA_PEDRA), 'diamante quebra mais rápido que ferro, ferro mais que pedra');
ok([1100, 1101, 1102, 1103, 1104, 1105, 1110, 1111, 1116].every(guardavel) && !guardavel(1117) && !guardavel(1050) && podeNoChao(1103, 1), 'itens novos guardam na mochila e caem no chão');
ok(DURA[I.PICARETA_FERRO] === 250 && DURA[I.PICARETA_DIAMANTE] === 1561, 'ferro dura 250 usos, diamante 1561');

// ---------- receitas ----------
const cl = { sobrevivencia: true, dificuldade: 'normal' }, mods = { sobrevivencia: true, dificuldade: 'pacifico' };
const nomes = (o) => receitasDoMundo(o).map((r) => r.id);
ok(!nomes(cl).includes('tocha') && nomes(cl).includes('tocha-carvao') && !nomes(cl).includes('isqueiro') && nomes(cl).includes('isqueiro-ferro'), 'clássico: tocha com carvão e isqueiro com barra de ferro (sem as receitas de minério)');
ok(nomes(mods).includes('tocha') && nomes(mods).includes('isqueiro'), 'mundo com mods: as receitas antigas continuam');
const forn = RECEITAS.find((r) => r.id === 'fornalha');
const g = desenhoDe(forn).flat();
ok(receitaDaGrade(g, 3, receitasDoMundo(cl))?.id === 'fornalha', 'fornalha: 8 pedriscos em volta na bancada');
const pf = RECEITAS.find((r) => r.id === 'picareta-ferro');
ok(receitaDaGrade(desenhoDe(pf).flat(), 3, receitasDoMundo(cl))?.id === 'picareta-ferro', 'picareta de ferro: 3 barras e 2 gravetos');

// ---------- fornalha ----------
{
  const f = fornoNovo(0);
  porNoForno(f, 'e', 67, 3); porNoForno(f, 'c', I.TABUAS, 1);
  avancar(f, 9000);
  ok(f.s === null && f.p > 8.9 && f.q > 5.9, 'fornalha: 9 s depois a primeira barra está quase pronta');
  avancar(f, 10000);
  ok(f.s && f.s[0] === I.BARRA_FERRO && f.s[1] === 1, 'fornalha: 10 s = 1 barra de ferro');
  avancar(f, 60000);
  ok(f.s[1] === 1 && f.e[1] === 2 && f.q === 0 && f.p === 0, 'fornalha: uma tábua dura 15 s (a segunda barra não terminou e volta do começo)');
  porNoForno(f, 'c', I.CARVAO, 1);
  avancar(f, 60000 + 20000);
  ok(f.s[1] === 3 && !f.e && f.q > 59 && f.q < 61, 'fornalha: com carvão termina as outras 2 e o fogo continua (80 s de fogo)');
  avancar(f, 60000 + 200000);
  ok(f.q === 0, 'fornalha: sem nada para fazer, o fogo apaga sozinho');
  ok(porNoForno(f, 'e', I.PEDRA, 1) === 0 && porNoForno(f, 'c', I.PEDRA, 1) === 0 && porNoForno(f, 'e', I.AREIA, 70) === 64, 'fornalha: só aceita o que assa/queima, até 64');
  const t = tirarDoForno(f, 's');
  ok(t[0] === I.BARRA_FERRO && t[1] === 3 && !f.s, 'fornalha: tira as 3 barras');
  ok(conteudo(f).length === 1 && conteudo(f)[0][0] === I.AREIA, 'fornalha: conteúdo (cai no chão se quebrar)');
  const n = normalizarForno({ e: [I.PEDRA, 5], c: [I.CARVAO, 99], s: [1103, 2], q: 999, Q: 80, p: -3, t: 5 }, 10);
  ok(!n.e && !n.c && n.s[1] === 2 && n.q === 80 && n.p === 0, 'fornalha: estado guardado/da rede volta sempre certo');
  const r = fornoDaRede(fornoPublico(f, 1000), 50000);
  ok(r.t === 50000 - 0 && r.e[1] === 64, 'fornalha: vai e volta pela rede');
  // cozinhar 64 de uma vez com carvão suficiente: tempo justo
  const g2 = fornoNovo(0); porNoForno(g2, 'e', I.CARNE, 16); porNoForno(g2, 'c', I.CARVAO, 2);
  avancar(g2, 160000);
  ok(g2.s[1] === 16 && !g2.e && !g2.c && g2.q === 0, 'fornalha: 2 carvões assam 16 carnes em 160 s');
}

// ---------- ações da mochila (economia.js) ----------
{
  const op = opcoesEcon(cl);
  const e = estadoNovo(op);
  e.itens = { 67: 5, [I.CARVAO]: 2 };
  const f = fornoNovo(0);
  ok(aplicar(e, op, { t: 'forno-por', k: 'e', id: 67, n: 5, f, agora: 0 }).ok && !e.itens[67], 'mochila: pôs 5 minérios de ferro');
  ok(!aplicar(e, op, { t: 'forno-por', k: 'c', id: I.CARVAO, n: 9, f, agora: 0 }).ok === false && e.itens[I.CARVAO] === undefined, 'mochila: pôs só os 2 carvões que tinha');
  ok(!aplicar(e, op, { t: 'forno-por', k: 'c', id: 3, n: 1, f, agora: 0 }).ok, 'mochila: não dá para pôr o que não tem');
  const r = aplicar(e, op, { t: 'forno-tirar', k: 's', f, agora: 30000 });
  ok(r.ok && e.itens[I.BARRA_FERRO] === 3, 'mochila: 30 s depois tirou 3 barras de ferro');
  ok(!aplicar(e, op, { t: 'forno-tirar', k: 's', f, agora: 30000 }).ok, 'mochila: saída vazia não dá nada');
  ok(aplicar(e, op, { t: 'forno-tirar', k: 'e', f, agora: 30000 }).ok && e.itens[67] === 2, 'mochila: tirou de volta os 2 minérios que faltavam');
  e.itens = { 6: 1 }; e.compra = { 6: 1 };
  ok(!aplicar(e, op, { t: 'forno-por', k: 'c', id: 6, n: 1, f, agora: 30000 }).ok, 'mochila: coisa comprada não entra na fornalha');
  ok(!aplicar(e, opcoesEcon({}), { t: 'forno-por', k: 'c', id: 6, n: 1, f, agora: 0 }).ok, 'sem mochila (criativo): nada');
  // quebrar no clássico: com a mão a pedra não dá nada; com picareta dá
  e.itens = { [I.PICARETA_MADEIRA]: 1 };
  ok(aplicar(e, op, { t: 'bloco', b: 0, de: 3, x: 1, y: 2, z: 3, natural: true, mao: 0 }).cai.length === 0, 'mochila: pedra com a mão não cai nada');
  ok(aplicar(e, op, { t: 'bloco', b: 0, de: 3, x: 1, y: 2, z: 3, natural: true, mao: I.PICARETA_MADEIRA }).cai.length === 1, 'mochila: pedra com picareta cai');
  ok(aplicar(e, op, { t: 'bloco', b: 0, de: 67, x: 1, y: 2, z: 3, natural: true, mao: I.PICARETA_FERRO }).cai.length === 0, 'mochila: picareta de ferro que não está na mochila não vale');
  ok(!aplicar(e, op, { t: 'criar', r: 'tocha', bancada: true }).ok, 'mochila: a receita antiga da tocha não vale no clássico');
}

console.log(falhas ? `${falhas} falha(s)` : 'TUDO OK');
process.exit(falhas ? 1 : 0);

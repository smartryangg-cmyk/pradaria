// Armadura do jogo clássico, regras puras (conta, receitas, espaços, inventário e desgaste).
// node testes/teste-armadura-regras.mjs
import { ARMADURA, reduzir, defesa, parteDe, PROTEGE } from '../public/js/armadura-regras.js';
import { aplicar, estadoNovo, opcoesEcon } from '../public/js/economia.js';
import { IDS as I, receitaDaGrade, receitasDoMundo, guardavel, DURA, pilhaDe, espacosUsados, cabe, ESPACOS } from '../public/js/receitas.js';
import { Inventario, ARMA, TOTAL, aceita } from '../public/js/inventario.js';

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHA ') + m); if (!c) falhas++; };
const perto = (a, b) => Math.abs(a - b) < 1e-9;

// ---------- a conta ----------
const FERRO = [I.CAPACETE_FERRO, I.PEITORAL_FERRO, I.CALCA_FERRO, I.BOTAS_FERRO];
const DIA = [I.CAPACETE_DIAMANTE, I.PEITORAL_DIAMANTE, I.CALCA_DIAMANTE, I.BOTAS_DIAMANTE];
const COURO = [I.CAPACETE_COURO, I.PEITORAL_COURO, I.CALCA_COURO, I.BOTAS_COURO];
ok(defesa(COURO).d === 7 && defesa(FERRO).d === 15 && defesa(DIA).d === 20 && defesa(DIA).t === 8, 'pontos: couro 7, ferro 15, diamante 20 (dureza 8)');
ok(Object.keys(ARMADURA).length === 12 && FERRO.every((id, k) => parteDe(id) === k), '12 peças, cada uma na sua parte');
// ferro inteiro, golpe de 8: defesa efetiva max(3, 15 - 8/2) = 11 -> 8 * (1 - 11/25) = 4,48
ok(reduzir(8, FERRO, () => 0.9).dano === 4 && reduzir(8, FERRO, () => 0.1).dano === 5, 'ferro inteiro: golpe de 8 vira 4,48 (4 ou 5, sem perder a média)');
// diamante inteiro, golpe de 8: 20 - 8/(2 + 8/4) = 18 -> 8 * 0,28 = 2,24
ok(reduzir(8, DIA, () => 0.9).dano === 2, 'diamante inteiro: golpe de 8 vira 2,24');
// golpe forte atravessa: ferro, golpe de 40 -> max(3, 15 - 20) = 3 -> 40 * 0,88 = 35,2
ok(reduzir(40, FERRO, () => 0.9).dano === 35, 'golpe forte atravessa a armadura (40 vira 35)');
ok(reduzir(5, [], () => 0).dano === 5 && reduzir(5, [], () => 0).gasto === 0, 'sem armadura: dano inteiro e nada gasta');
ok(reduzir(3, [I.CAPACETE_COURO]).gasto === 1 && reduzir(9, FERRO).gasto === 2, 'cada golpe gasta as peças (1 a cada 4 de dano, no mínimo 1)');
ok(PROTEGE.has('monstro') && PROTEGE.has('lava') && !PROTEGE.has('queda') && !PROTEGE.has('fome') && !PROTEGE.has('agua'), 'protege de bicho, monstro, fogo e lava; queda, fome e afogar passam');
{ let soma = 0; const N = 20000; let s = 1; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let k = 0; k < N; k++) soma += reduzir(8, FERRO, rnd).dano; ok(Math.abs(soma / N - 4.48) < 0.05, 'a média do dano bate com a conta do clássico'); }

// ---------- itens e receitas ----------
ok([...COURO, ...FERRO, ...DIA].every((id) => guardavel(id) && pilhaDe(id) === 1 && DURA[id] === ARMADURA[id][3]), 'peças guardam na mochila, não empilham e gastam');
ok(DURA[I.CAPACETE_COURO] === 55 && DURA[I.PEITORAL_DIAMANTE] === 528, 'usos: capacete de couro 55, peitoral de diamante 528');
ok(pilhaDe(I.ESPADA_FERRO) === 1 && pilhaDe(1010) === 1, 'espada e isqueiro também não empilham (como no clássico)');
const cl = { sobrevivencia: true, dificuldade: 'normal' }, mods = { sobrevivencia: true, dificuldade: 'pacifico' };
const F = I.BARRA_FERRO, D = I.DIAMANTE, C = I.COURO;
ok(receitaDaGrade([F, F, F, F, 0, F, 0, 0, 0], 3, receitasDoMundo(cl))?.id === 'capacete-ferro', 'capacete: 5 barras em arco');
ok(receitaDaGrade([0, 0, 0, F, F, F, F, 0, F], 3, receitasDoMundo(cl))?.id === 'capacete-ferro', 'capacete também embaixo na grade');
ok(receitaDaGrade([D, 0, D, D, D, D, D, D, D], 3, receitasDoMundo(cl))?.id === 'peitoral-diamante', 'peitoral: 8 diamantes');
ok(receitaDaGrade([C, C, C, C, 0, C, C, 0, C], 3, receitasDoMundo(cl))?.id === 'calca-couro', 'calça: 7 couros');
ok(receitaDaGrade([F, 0, F, F, 0, F, 0, 0, 0], 3, receitasDoMundo(cl))?.id === 'botas-ferro', 'botas: 4 barras');
ok(!receitasDoMundo(mods).some((r) => r.grupo === 'armadura') && receitasDoMundo(cl).filter((r) => r.grupo === 'armadura').length === 12, 'armadura só no jogo clássico (nos mundos com mods ela não protegeria)');

// ---------- espaços: a peça vestida não ocupa a mochila ----------
ok(espacosUsados({ [I.PEITORAL_FERRO]: 1 }) === 0 && espacosUsados({ [I.PEITORAL_FERRO]: 2 }) === 1 && espacosUsados({ [I.PEITORAL_FERRO]: 1, [I.PEITORAL_COURO]: 1 }) === 1, 'uma peça de cada parte vai vestida (fora da mochila)');
{
  const cheio = {}; for (let k = 0; k < ESPACOS; k++) cheio[100 + k] = 64; // mochila cheia de blocos
  ok(cabe({ ...cheio }, I.CAPACETE_FERRO, 1) && !cabe({ ...cheio, [I.CAPACETE_FERRO]: 1 }, I.CAPACETE_COURO, 1), 'com a mochila cheia ainda dá para ter um capacete (vestido), não dois');
}

// ---------- inventário: os 4 espaços de vestir ----------
{
  ok(TOTAL === 41 && ARMA === 37 && aceita('s', 37, I.CAPACETE_FERRO) && !aceita('s', 37, I.BOTAS_FERRO) && !aceita('s', 38, 3) && aceita('s', 5, I.BOTAS_FERRO), 'espaço de vestir só aceita a peça da parte certa');
  const v = new Inventario();
  v.ajustar({ [I.CAPACETE_FERRO]: 1, [I.PEITORAL_COURO]: 1, 3: 10 });
  ok(v.vestido().length === 0 && v.total(I.CAPACETE_FERRO) === 1, 'peça nova entra na mochila (não veste sozinha)');
  const i = v.s.findIndex((p) => p && p.id === I.CAPACETE_FERRO);
  v.moverRapido('s', i);
  ok(v.s[ARMA] && v.s[ARMA].id === I.CAPACETE_FERRO && !v.s[i], 'mover rápido (shift) veste a peça');
  v.moverRapido('s', ARMA);
  ok(!v.s[ARMA] && v.total(I.CAPACETE_FERRO) === 1, 'mover rápido de novo tira para a mochila');
  // clique com a peça errada no espaço: nada
  const j = v.s.findIndex((p) => p && p.id === I.PEITORAL_COURO);
  v.clicar('s', j); v.clicar('s', ARMA); // peitoral no espaço da cabeça
  ok(!v.s[ARMA] && v.cursor && v.cursor.id === I.PEITORAL_COURO, 'peitoral não entra no espaço da cabeça');
  v.clicar('s', ARMA + 1);
  ok(v.s[ARMA + 1] && v.s[ARMA + 1].id === I.PEITORAL_COURO && !v.cursor, 'peitoral entra no espaço do peito');
  const pedra = v.s.findIndex((p) => p && p.id === 3);
  v.clicar('s', pedra); v.clicar('s', ARMA + 2);
  ok(!v.s[ARMA + 2] && v.cursor && v.cursor.id === 3, 'bloco não entra na armadura');
  v.devolver();
  // vestir pela mão (usar com a peça na mão): troca com a vestida
  v.ajustar({ [I.CAPACETE_FERRO]: 1, [I.PEITORAL_COURO]: 1, [I.PEITORAL_FERRO]: 1, 3: 10 });
  const k = v.s.findIndex((p, x) => p && p.id === I.PEITORAL_FERRO && x < ARMA);
  ok(v.vestir(k) && v.s[ARMA + 1].id === I.PEITORAL_FERRO && v.s[k].id === I.PEITORAL_COURO, 'vestir troca com a peça que estava vestida');
  ok(v.vestido().includes(I.PEITORAL_FERRO) && !v.vestir(ARMA + 1), 'vestido() lista as peças; o espaço de vestir não "veste" de novo');
  // perdeu tudo (morreu): sai também a vestida
  v.ajustar({});
  ok(v.vestido().length === 0 && !v.s.some(Boolean), 'morreu: a armadura vestida também cai');
  // guardado antigo (37 espaços) ainda carrega
  const w = new Inventario();
  ok(w.carregar({ v: 1, s: [[3, 5], ...new Array(36).fill(0)] }) && w.s.length === TOTAL && w.s[0].n === 5 && !w.s[ARMA], 'mochila guardada antes da armadura ainda abre');
  ok(w.carregar({ v: 1, s: [...new Array(37).fill(0), [I.BOTAS_FERRO, 1], 0, 0, 0] }) && !w.s[ARMA], 'guardado com peça no espaço errado: não entra lá');
  // mochila cheia + peça solta: a peça vai vestida em vez de sobrar
  const x = new Inventario(), cheio = {};
  for (let q = 0; q < 37; q++) cheio[100 + q] = 64;
  x.ajustar(cheio);
  x.ajustar({ ...cheio, [I.BOTAS_COURO]: 1 });
  ok(!x.extra.length && x.s[ARMA + 3] && x.s[ARMA + 3].id === I.BOTAS_COURO, 'mochila cheia: a peça nova vai direto para o pé (não fica sobrando)');
}

// ---------- desgaste (economia: vale sem internet e na sala) ----------
{
  const op = opcoesEcon(cl), e = estadoNovo(op);
  e.itens[I.COURO] = 5;
  ok(aplicar(e, op, { t: 'criar', r: 'capacete-couro', bancada: true }).ok && e.itens[I.CAPACETE_COURO] === 1 && !e.itens[I.COURO], 'criou o capacete de couro na bancada com 5 couros');
  ok(!aplicar(e, op, { t: 'criar', r: 'botas-couro', bancada: true }).ok, 'sem couro, não cria');
  e.itens[I.PEITORAL_FERRO] = 1;
  ok(aplicar(e, op, { t: 'armadura', ids: [I.CAPACETE_COURO, I.PEITORAL_FERRO], n: 2 }).ok && e.desg[I.CAPACETE_COURO][0] === 2 && e.desg[I.PEITORAL_FERRO][0] === 2, 'levou golpe: as duas peças vestidas gastam');
  ok(!aplicar(e, op, { t: 'armadura', ids: [I.BOTAS_DIAMANTE], n: 1 }).ok, 'peça que não tem: nada');
  e.itens[I.CAPACETE_FERRO] = 1;
  ok(!aplicar(e, op, { t: 'armadura', ids: [I.CAPACETE_COURO, I.CAPACETE_FERRO], n: 1 }).ok, 'dois capacetes ao mesmo tempo: não vale');
  ok(!aplicar(e, op, { t: 'armadura', ids: [3], n: 1 }).ok, 'bloco não é armadura');
  e.desg[I.CAPACETE_COURO][0] = 54;
  const r = aplicar(e, op, { t: 'armadura', ids: [I.CAPACETE_COURO], n: 1 });
  ok(r.ok && !e.itens[I.CAPACETE_COURO] && r.quebrou && r.quebrou[0] === I.CAPACETE_COURO, 'o capacete de couro quebra no 55º uso');
  const r2 = aplicar(e, op, { t: 'armadura', ids: [I.PEITORAL_FERRO], n: 999 });
  ok(r2.ok && e.desg[I.PEITORAL_FERRO][0] === 12, 'um golpe gasta no máximo 10');
  const pac = opcoesEcon(mods), e2 = estadoNovo(pac);
  e2.itens[I.CAPACETE_FERRO] = 1;
  ok(!aplicar(e2, pac, { t: 'armadura', ids: [I.CAPACETE_FERRO], n: 1 }).ok && !aplicar(e2, pac, { t: 'criar', r: 'capacete-ferro', bancada: true }).ok, 'nos mundos com mods não existe armadura');
}

console.log(falhas ? `${falhas} falha(s)` : 'TUDO OK');
process.exit(falhas ? 1 : 0);

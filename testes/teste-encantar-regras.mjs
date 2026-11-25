// Encantar do jogo clássico, regras puras (ofertas, número do desgaste, efeitos, economia, receitas, minério, estantes).
// node testes/teste-encantar-regras.mjs
import * as E from '../public/js/encantos-regras.js';
import { aplicar, estadoNovo, opcoesEcon } from '../public/js/economia.js';
import { IDS as I, receitaDaGrade, receitasDoMundo, DURA, desgLista, oQueCai } from '../public/js/receitas.js';
import { normalizarBau } from '../public/js/bau-regras.js';
import { nivelDe, paraProximo } from '../public/js/xp-regras.js';
import { tempoQuebrar } from '../public/js/quebra-regras.js';
import { reduzir } from '../public/js/armadura-regras.js';

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHA ') + m); if (!c) falhas++; };
const xpDoNivel = (n) => { let x = 0; for (let k = 0; k < n; k++) x += paraProximo(k); return x; };
const cl = { sobrevivencia: true, dificuldade: 'normal' }, mods = { sobrevivencia: true, dificuldade: 'pacifico' };
const PIC_DIA = 1108;

// ---------- quem aceita ----------
ok(E.tipoEnc(PIC_DIA) === 'ferramenta' && E.tipoEnc(1116) === 'espada' && E.tipoEnc(I.PEITORAL_FERRO) === 'armadura', 'picareta é ferramenta, espada é espada, peitoral é armadura');
ok(E.tipoEnc(I.TABUAS) === null && E.ofertas(I.TABUAS, 0, 15, 1).length === 0, 'tábua não se encanta');

// ---------- ofertas ----------
{
  const a = E.ofertas(PIC_DIA, 0, 15, 123), b = E.ofertas(PIC_DIA, 0, 15, 123);
  ok(JSON.stringify(a) === JSON.stringify(b), 'mesma semente, mesmas ofertas (o jogo e a sala calculam igual)');
  ok(a.length === 3 && a.map((o) => o.custo).join() === '1,2,3', '3 ofertas custando 1, 2 e 3');
  ok(a[2].nivel === 30, 'com 15 estantes a terceira oferta pede nível 30');
  ok(a.every((o) => o.encs.every(([k]) => k === 'eficiencia' || k === 'inquebravel')), 'picareta só recebe eficiência ou inquebrável');
  let max0 = 0, max15 = 0;
  for (let s = 0; s < 300; s++) { max0 = Math.max(max0, ...E.ofertas(PIC_DIA, 0, 0, s).map((o) => o.nivel)); max15 = Math.max(max15, ...E.ofertas(PIC_DIA, 0, 15, s).map((o) => o.nivel)); }
  ok(max0 <= 8 && max15 === 30, 'sem estantes até nível 8; com 15 estantes até 30');
  let dif = 0; for (let s = 0; s < 50; s++) if (JSON.stringify(E.ofertas(PIC_DIA, 0, 15, s)) !== JSON.stringify(a)) dif++;
  ok(dif > 40, 'sementes diferentes dão ofertas diferentes');
  const esp = new Set(); for (let s = 0; s < 200; s++) for (const o of E.ofertas(1116, 0, 15, s)) for (const [k] of o.encs) esp.add(k);
  ok(esp.has('afiada') && !esp.has('eficiencia') && !esp.has('protecao'), 'espada: afiada sim, eficiência e proteção não');
  const arm = new Set(); for (let s = 0; s < 200; s++) for (const o of E.ofertas(I.PEITORAL_FERRO, 0, 15, s)) for (const [k] of o.encs) arm.add(k);
  ok(arm.has('protecao') && !arm.has('afiada'), 'armadura: proteção sim, afiada não');
  ok(E.ofertas(PIC_DIA, E.comEncantos(0, [['eficiencia', 1]]), 15, 1).length === 0, 'o que já tem encanto não encanta de novo');
}

// ---------- o número do desgaste ----------
{
  const v = E.comEncantos(37, [['eficiencia', 4], ['inquebravel', 3]]);
  ok(E.usosDe(v) === 37 && E.nivelEnc(v, 'eficiencia') === 4 && E.nivelEnc(v, 'inquebravel') === 3 && E.nivelEnc(v, 'afiada') === 0, 'usos e encantos cabem no mesmo número');
  ok(E.duraDe(PIC_DIA, v) === DURA[PIC_DIA] * 4 && E.duraDe(PIC_DIA, 37) === DURA[PIC_DIA], 'inquebrável III: picareta dura 4 vezes');
  ok(E.duraDe(I.PEITORAL_FERRO, E.comEncantos(0, [['inquebravel', 1]])) > DURA[I.PEITORAL_FERRO], 'inquebrável na armadura também estica');
  ok(desgLista(PIC_DIA, [v], 1)[0] === v, 'a lista do desgaste guarda o encanto');
  ok(E.mascaraDe(desgLista(PIC_DIA, [E.comEncantos(0, [['afiada', 3]])], 1)[0]) === 0, 'encanto que não serve para aquilo cai fora');
  const muito = E.comEncantos(DURA[PIC_DIA] * 10, [['eficiencia', 2]]);
  ok(E.usosDe(desgLista(PIC_DIA, [muito], 1)[0]) === DURA[PIC_DIA] - 1 && E.nivelEnc(desgLista(PIC_DIA, [muito], 1)[0], 'eficiencia') === 2, 'usos demais são cortados sem perder o encanto');
  const bau = normalizarBau([[PIC_DIA, 1, 0, v]]);
  ok(bau[0] && bau[0][3] === v, 'no baú o encanto continua');
}

// ---------- efeitos ----------
ok(tempoQuebrar(3, PIC_DIA, null, 5) < tempoQuebrar(3, PIC_DIA) / 2, 'eficiência V quebra pedra muito mais rápido');
ok(tempoQuebrar(3, PIC_DIA, null, 0) === tempoQuebrar(3, PIC_DIA), 'sem eficiência nada muda');
ok(E.bonusAfiada(1) === 0.5 && E.bonusAfiada(5) === 1.5, 'afiada: I soma meio coração, V soma um e meio');
ok(Math.abs(E.fatorProtecao([4, 4, 4, 4]) - 0.36) < 1e-9 && Math.abs(E.fatorProtecao([10, 10, 10]) - 0.2) < 1e-9 && E.fatorProtecao([]) === 1, 'proteção: 4% por nível, no máximo 80%');
{ const F = [I.CAPACETE_FERRO, I.PEITORAL_FERRO, I.CALCA_FERRO, I.BOTAS_FERRO]; ok(reduzir(8, F, () => 0.9, 0.5).dano === 2 && reduzir(8, F, () => 0.9).dano === 4, 'a proteção reduz o que a armadura deixa passar'); }

// ---------- economia ----------
{
  const op = opcoesEcon(cl), e = estadoNovo(op);
  e.itens[PIC_DIA] = 1; e.desg = { [PIC_DIA]: [12] };
  e.itens[E.PEDRA_AZUL] = 5; e.xp = xpDoNivel(30) + 5; e.semEnc = 99;
  const of = E.ofertas(PIC_DIA, 12, 15, 99);
  const r = aplicar(e, op, { t: 'encantar', id: PIC_DIA, k: 0, op: 2, est: 15 });
  ok(r.ok && JSON.stringify(r.encs) === JSON.stringify(of[2].encs), 'encantou com a terceira oferta');
  ok(e.itens[E.PEDRA_AZUL] === 2 && nivelDe(e.xp).nivel === 27, 'pagou 3 pedras-azuis e 3 níveis');
  ok(E.usosDe(e.desg[PIC_DIA][0]) === 12 && E.encantado(e.desg[PIC_DIA][0]), 'a picareta ficou encantada e com o mesmo desgaste');
  ok(e.semEnc !== 99, 'a mesa sorteia ofertas novas depois');
  ok(!aplicar(e, op, { t: 'encantar', id: PIC_DIA, k: 0, op: 0, est: 15 }).ok, 'não encanta duas vezes');
  const e2 = estadoNovo(op); e2.itens[PIC_DIA] = 1; e2.itens[E.PEDRA_AZUL] = 5; e2.xp = xpDoNivel(2);
  const o2 = E.ofertas(PIC_DIA, 0, 15, 0);
  ok(!aplicar(e2, op, { t: 'encantar', id: PIC_DIA, k: 0, op: 2, est: 15 }).ok && e2.itens[E.PEDRA_AZUL] === 5, `nível 2 não paga a oferta de nível ${o2[2].nivel}`);
  const e3 = estadoNovo(op); e3.itens[PIC_DIA] = 1; e3.xp = xpDoNivel(30);
  ok(!aplicar(e3, op, { t: 'encantar', id: PIC_DIA, k: 0, op: 0, est: 15 }).ok, 'sem pedra-azul não encanta');
  ok(!aplicar(e3, op, { t: 'encantar', id: PIC_DIA, k: 1, op: 0, est: 15 }).ok && !aplicar(e3, op, { t: 'encantar', id: I.TABUAS, k: 0, op: 0 }).ok, 'coisa que não tem ou não serve não encanta');
  const om = opcoesEcon({ sobrevivencia: false }), em = estadoNovo(om); em.itens[PIC_DIA] = 1; em.itens[E.PEDRA_AZUL] = 5; em.xp = xpDoNivel(30);
  ok(!aplicar(em, om, { t: 'encantar', id: PIC_DIA, k: 0, op: 0 }).ok, 'fora da sobrevivência não tem mesa');
  // gastar níveis guarda o pedaço da barra
  const g = { xp: xpDoNivel(10) + Math.floor(paraProximo(10) / 2) }; E.gastarNiveis(g, 3);
  ok(nivelDe(g.xp).nivel === 7 && Math.abs(nivelDe(g.xp).frac - 0.5) < 0.1, 'gastar 3 níveis do 10 e meio deixa 7 e meio');
}

// ---------- receitas e minério ----------
{
  const rc = receitasDoMundo(cl), rm = receitasDoMundo(mods);
  const K = I.CANA, P = I.TABUAS, B = I.LIVRO, D = I.DIAMANTE, X = I.OBSIDIANA;
  ok(receitaDaGrade([K, K, K, 0, 0, 0, 0, 0, 0], 3, rc)?.id === 'papel', 'papel: 3 canas em fila');
  ok(receitaDaGrade([P, P, P, B, B, B, P, P, P], 3, rc)?.id === 'estante-livros', 'estante: 6 tábuas e 3 livros');
  ok(receitaDaGrade([0, B, 0, D, X, D, X, X, X], 3, rc)?.id === 'mesa-encantar', 'mesa: livro, 2 diamantes e 4 obsidianas');
  ok(rc.some((r) => r.id === 'livro') && !rc.some((r) => r.id === 'estante'), 'no clássico o livro existe e a estante velha (4 tábuas) não');
  ok(!rm.some((r) => r.id === 'mesa-encantar') && rm.some((r) => r.id === 'estante'), 'com mods a mesa não aparece e a estante velha continua');
  const op = opcoesEcon(cl), e = estadoNovo(op); e.itens[I.CANA] = 3;
  ok(aplicar(e, op, { t: 'criar', r: 'papel', bancada: true }).ok && e.itens[I.PAPEL] === 3, 'criou 3 papéis com 3 canas');
  const q = new Set(); for (let x = 0; x < 200; x++) { const c = oQueCai(I.MINERIO_AZUL, (x * 37) % 101, x % 60, (x * 13) % 97, true, PIC_DIA, true); q.add(c[0][0] === E.PEDRA_AZUL ? c[0][1] : -1); }
  ok([...q].every((n) => n >= 4 && n <= 9) && q.size === 6, 'minério azul dá de 4 a 9 pedras-azuis');
}

// ---------- estantes em volta ----------
{
  const m = new Map(); const k = (x, y, z) => x + ',' + y + ',' + z;
  const bl = (x, y, z) => m.get(k(x, y, z)) | 0;
  ok(E.contarEstantes(bl, 0, 0, 0) === 0, 'sem estantes: 0');
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.max(Math.abs(dx), Math.abs(dz)) === 2) { m.set(k(dx, 0, dz), E.ESTANTE); m.set(k(dx, 1, dz), E.ESTANTE); }
  ok(E.contarEstantes(bl, 0, 0, 0) === 15, 'anel inteiro de 2 andares conta 15 (o máximo)');
  m.clear(); m.set(k(2, 0, 0), E.ESTANTE);
  ok(E.contarEstantes(bl, 0, 0, 0) === 1, 'uma estante a 2 blocos conta');
  m.set(k(1, 0, 0), 1);
  ok(E.contarEstantes(bl, 0, 0, 0) === 0, 'com algo entre a estante e a mesa, não conta');
  m.clear(); m.set(k(3, 0, 0), E.ESTANTE); m.set(k(1, 0, 1), E.ESTANTE);
  ok(E.contarEstantes(bl, 0, 0, 0) === 0, 'longe demais ou colada não conta');
}

console.log(falhas ? `FALHOU (${falhas})` : 'TUDO OK');
process.exit(falhas ? 1 : 0);

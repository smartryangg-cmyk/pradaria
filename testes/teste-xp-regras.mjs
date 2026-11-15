// Experiência do jogo clássico: curva de níveis, de onde vem e o que perde ao morrer.
// node testes/teste-xp-regras.mjs
import { nivelDe, paraProximo, xpDoMinerio, ganharXp, normalizarXp } from '../public/js/xp-regras.js';
import { aplicar, estadoNovo, opcoesEcon, normalizar } from '../public/js/economia.js';
import { IDS as I } from '../public/js/receitas.js';
import { fornoNovo, porNoForno } from '../public/js/fornalha-regras.js';

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHA ') + m); if (!c) falhas++; };

ok(paraProximo(0) === 7 && paraProximo(15) === 37 && paraProximo(16) === 42 && paraProximo(31) === 121, 'curva: 7, 37, 42, 121 pontos');
ok(nivelDe(0).nivel === 0 && nivelDe(6).nivel === 0 && nivelDe(7).nivel === 1 && nivelDe(16).nivel === 2, 'nível 1 com 7 pontos, nível 2 com 16');
ok(nivelDe(1395).nivel === 30 && Math.abs(nivelDe(10).frac - 3 / 9) < 1e-9, 'nível 30 com 1395 pontos; barra enche aos poucos');
ok(xpDoMinerio(3, 1, 2, 3) === 0 && xpDoMinerio(67, 1, 2, 3) === 0, 'pedra e minério de ferro não dão (o ferro dá na fornalha)');
const d = xpDoMinerio(69, 5, -20, 9); ok(d >= 3 && d <= 7 && d === xpDoMinerio(69, 5, -20, 9), 'diamante dá 3 a 7, sempre igual no mesmo lugar');
const e0 = { xp: 0, xpf: 0 }; ganharXp(e0, 0.7); ganharXp(e0, 0.7);
ok(e0.xp === 1 && Math.abs(e0.xpf - 0.4) < 1e-9, 'frações somam até virar ponto');
const n = {}; normalizarXp(n, { xp: -5, xpf: 9 }); ok(n.xp === 0 && n.xpf === 0.999, 'estado ruim volta certo');

const cl = opcoesEcon({ sobrevivencia: true, dificuldade: 'normal' }), mods = opcoesEcon({ sobrevivencia: true, dificuldade: 'pacifico' });
{
  const e = estadoNovo(cl); e.itens = { [I.PICARETA_FERRO]: 1 };
  aplicar(e, cl, { t: 'bloco', b: 0, de: 69, x: 5, y: -20, z: 9, natural: true, mao: I.PICARETA_FERRO });
  ok(e.xp === d, 'clássico: tirar diamante dá a experiência');
  const antes = e.xp;
  aplicar(e, cl, { t: 'bloco', b: 0, de: 69, x: 6, y: -20, z: 9, natural: false, mao: I.PICARETA_FERRO });
  ok(e.xp === antes, 'minério posto por alguém não dá experiência');
  e.itens[67] = 10; e.itens[I.CARVAO] = 2; const f = fornoNovo(0);
  aplicar(e, cl, { t: 'forno-por', k: 'e', id: 67, n: 10, f, agora: 0 });
  aplicar(e, cl, { t: 'forno-por', k: 'c', id: I.CARVAO, n: 2, f, agora: 0 });
  aplicar(e, cl, { t: 'forno-tirar', k: 's', f, agora: 100000 });
  ok(e.xp === antes + 7, 'fornalha: 10 barras de ferro = 7 pontos');
  aplicar(e, cl, { t: 'ev', e: 'caca', b: 'vaca', f: 0 });
  ok(e.xp === antes + 9, 'caçar dá 2 pontos');
  ok(normalizar(JSON.parse(JSON.stringify(e)), cl).xp === e.xp, 'experiência fica guardada');
  const r = aplicar(e, cl, { t: 'morrer' });
  ok(r.ok && r.xpPerdido === antes + 9 && e.xp === 0 && e.xpf === 0, 'morrer perde a experiência (vira a pontuação)');
}
{
  const e = estadoNovo(mods); e.itens = { [I.PICARETA_FERRO]: 1 };
  aplicar(e, mods, { t: 'bloco', b: 0, de: 69, x: 5, y: -20, z: 9, natural: true, mao: I.PICARETA_FERRO });
  ok(!e.xp, 'mundo com mods (pacífico): sem experiência');
}
console.log(falhas ? `${falhas} falha(s)` : 'TUDO OK');
process.exit(falhas ? 1 : 0);

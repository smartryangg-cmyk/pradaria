// Monstros da noite e espadas (jogo clássico), regras puras.
// node testes/teste-monstros-regras.mjs
import { escuroPara, aranhaBrava, qualMonstro, CAI_MONSTRO, ehMonstro, MAX_MONSTROS } from '../public/js/monstros-regras.js';
import { aplicar, estadoNovo, opcoesEcon, caiDoBicho } from '../public/js/economia.js';
import { IDS as I, RECEITAS, receitaDaGrade, desenhoDe, receitasDoMundo, guardavel, DURA } from '../public/js/receitas.js';
import { ehComida, fomeNova, comer, tique, normalizarFome, ENJOO } from '../public/js/fome-regras.js';
import { INSTINTOS } from '../public/js/instintos.js';

let falhas = 0;
const ok = (c, m) => { console.log((c ? 'ok    ' : 'FALHA ') + m); if (!c) falhas++; };

ok(escuroPara(-0.5, 60, 60) && !escuroPara(0.6, 60, 60) && escuroPara(0.6, 40, 60), 'escuro: de noite na superfície, ou de dia dentro da caverna');
ok(!aranhaBrava(0.8, 64, 63) && aranhaBrava(-0.8, 64, 63), 'aranha: quieta de dia, brava de noite');
ok(qualMonstro(0.1) === 'barrento' && qualMonstro(0.9) === 'aranha' && MAX_MONSTROS > 0, 'sorteio do monstro');
ok(ehMonstro('barrento') && !ehMonstro('lobo') && INSTINTOS.barrento.monstro && INSTINTOS.aranha.monstro && INSTINTOS.barrento.fuga === 0, 'monstros não fogem');
ok(caiDoBicho('barrento')[0][0] === I.CARNE_ESTRAGADA && caiDoBicho('aranha')[0][0] === I.TEIA && CAI_MONSTRO.aranha[0][1] === 2, 'barrento deixa carne estragada, aranha 2 fios de teia');
ok(ehComida(I.CARNE_ESTRAGADA) && [1111, 1112, 1113, 1116].every(guardavel), 'carne estragada se come; itens novos guardam');
ok(DURA[I.ESPADA_MADEIRA] === 59 && DURA[I.ESPADA_DIAMANTE] === 1561, 'espadas gastam como as ferramentas');
const cl = { sobrevivencia: true, dificuldade: 'normal' };
const esp = RECEITAS.find((r) => r.id === 'espada-ferro');
ok(desenhoDe(esp).length === 3 && receitaDaGrade([0, I.BARRA_FERRO, 0, 0, I.BARRA_FERRO, 0, 0, I.GRAVETO, 0], 3, receitasDoMundo(cl))?.id === 'espada-ferro', 'espada de ferro: 2 barras em cima de 1 graveto');
const la = RECEITAS.find((r) => r.id === 'la-de-fio');
ok(receitaDaGrade([I.TEIA, I.TEIA, I.TEIA, I.TEIA], 2, receitasDoMundo(cl))?.id === 'la-de-fio' && la.faz[0] === I.LA_BRANCA, '4 fios de teia = 1 lã');
{
  const op = opcoesEcon(cl), e = estadoNovo(op);
  ok(aplicar(e, op, { t: 'ev', e: 'caca', b: 'barrento', f: 0 }).ok && e.itens[I.CARNE_ESTRAGADA] === 1 && e.xp === 5, 'derrubou o barrento: carne estragada e 5 de experiência');
  e.itens[I.ESPADA_MADEIRA] = 1; e.itens[I.MACHADO_PEDRA] = 1;
  aplicar(e, op, { t: 'golpe', mao: I.ESPADA_MADEIRA }); aplicar(e, op, { t: 'golpe', mao: I.MACHADO_PEDRA });
  ok(e.desg[I.ESPADA_MADEIRA][0] === 1 && e.desg[I.MACHADO_PEDRA][0] === 2, 'golpe: a espada gasta 1, o machado 2');
  ok(!aplicar(e, op, { t: 'golpe', mao: I.ESPADA_FERRO }).ok, 'golpe com espada que não tem: nada');
  e.desg[I.ESPADA_MADEIRA][0] = 58;
  aplicar(e, op, { t: 'golpe', mao: I.ESPADA_MADEIRA });
  ok(!e.itens[I.ESPADA_MADEIRA], 'a espada de madeira quebra com 59 golpes');
  const pac = opcoesEcon({ sobrevivencia: true, dificuldade: 'pacifico' }), e2 = estadoNovo(pac);
  ok(!aplicar(e2, pac, { t: 'ev', e: 'caca', b: 'aranha', f: 0 }).ok, 'no Pacífico (mods) não existe monstro');
}
{
  // carne estragada: 80% de chance de enjoar (a fome bate mais rápido por 30 s), como no clássico
  const f = fomeNova(); f.f = 10; f.s = 0;
  ok(comer(f, I.CARNE_ESTRAGADA, () => 0.5) === 'enjoo' && f.ej === ENJOO && f.f === 14, 'carne estragada enjoou (sorte 0,5 < 0,8)');
  const g = fomeNova(); g.f = 10; g.s = 0;
  ok(comer(g, I.CARNE_ESTRAGADA, () => 0.9) === true && !g.ej, 'às vezes não enjoa (sorte 0,9)');
  const h = fomeNova(); h.f = 10; h.s = 0; comer(h, I.CARNE, () => 0); ok(!h.ej, 'carne crua comum não enjoa');
  let soma = 0; for (let k = 0; k < 400; k++) { const x = fomeNova(); x.f = 10; if (comer(x, I.CARNE_ESTRAGADA) === 'enjoo') soma++; }
  ok(soma > 280 && soma < 360, 'enjoa mais ou menos 8 em 10 vezes (' + soma + '/400)');
  for (let t = 0; t < 400; t++) tique(f, 0.1, 20, 20, 'normal'); // 40 s
  ok(f.ej === 0, 'o enjoo passa depois de 30 s');
  const a = fomeNova(); a.f = 10; a.s = 0; a.ej = ENJOO; const b2 = fomeNova(); b2.f = 10; b2.s = 0;
  for (let t = 0; t < 300; t++) { tique(a, 0.1, 20, 20, 'normal'); tique(b2, 0.1, 20, 20, 'normal'); }
  ok(a.x + (10 - a.f) * 4 > b2.x + (10 - b2.f) * 4 + 2.9, 'enjoado cansa 3 a mais em 30 s (0,1 por segundo)');
  ok(normalizarFome({ f: 10, s: 0, ej: 99 }).ej === ENJOO && normalizarFome({ f: 10 }).ej === 0, 'o enjoo fica guardado (no máximo 30 s)');
}
console.log(falhas ? `${falhas} falha(s)` : 'TUDO OK');
process.exit(falhas ? 1 : 0);

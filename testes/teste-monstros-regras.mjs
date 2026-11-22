// Monstros da noite e espadas (jogo clássico), regras puras.
// node testes/teste-monstros-regras.mjs
import { escuroPara, aranhaBrava, qualMonstro, CAI_MONSTRO, ehMonstro, MAX_MONSTROS } from '../public/js/monstros-regras.js';
import { aplicar, estadoNovo, opcoesEcon, caiDoBicho } from '../public/js/economia.js';
import { IDS as I, RECEITAS, receitaDaGrade, desenhoDe, receitasDoMundo, guardavel, DURA } from '../public/js/receitas.js';
import { ehComida } from '../public/js/fome-regras.js';
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
console.log(falhas ? `${falhas} falha(s)` : 'TUDO OK');
process.exit(falhas ? 1 : 0);

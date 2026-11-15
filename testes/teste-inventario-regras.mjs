// Regras do inventário de espaços e da grade de criar (sem navegador): node testes/teste-inventario-regras.mjs
import { Inventario, MAO2 } from '../public/js/inventario.js';
import { RECEITAS, receitaDaGrade, arrumar, cabeNaGrade, desenhoDe, cabe, cabeQuanto, espacosUsados, ESPACOS, receita, podeCriar } from '../public/js/receitas.js';
import { aplicar, estadoNovo } from '../public/js/economia.js';
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const T = 8, G = 1000, P = 3, TR = 6;

// pilhas de 64 e a barra primeiro
const v = new Inventario();
v.ajustar({ [TR]: 70, [G]: 3 });
ok(v.s[0].id === TR && v.s[0].n === 64 && v.s[1].n === 6 && v.s[2].id === G, 'pilhas de 64, barra primeiro');
// gastar sai da mão
v.ajustar({ [TR]: 69, [G]: 3 }, 1);
ok(v.s[1].n === 5 && v.s[0].n === 64, 'colocar gasta da pilha que está na mão');
// clicar pega tudo, clicar num vazio larga
v.clicar('s', 0); ok(v.cursor && v.cursor.n === 64 && !v.s[0], 'clique pega a pilha inteira');
v.clicar('s', 20); ok(v.s[20].n === 64 && !v.cursor, 'clique num espaço vazio larga tudo');
// clique direito: metade e 1 por vez
v.clicarDireito('s', 20); ok(v.cursor.n === 32 && v.s[20].n === 32, 'clique direito pega a metade');
v.clicarDireito('s', 21); v.clicarDireito('s', 21); ok(v.s[21].n === 2 && v.cursor.n === 30, 'clique direito larga 1');
// juntar na pilha igual até 64
v.clicar('s', 20); ok(v.s[20].n === 62 && !v.cursor, 'clique na pilha igual junta');
// trocar pilhas diferentes
v.clicar('s', 2); v.clicar('s', 20); ok(v.s[20].id === G && v.cursor.id === TR && v.cursor.n === 62, 'clique em outra coisa troca');
v.clicar('s', 2);
// espalhar
v.clicar('s', 2); v.espalhar([['s', 30], ['s', 31], ['s', 32]]); ok(v.s[30].n === 20 && v.s[31].n === 20 && v.s[32].n === 20 && v.cursor.n === 2, 'arrastar reparte igual');
v.espalhar([['s', 33], ['s', 34]], true); ok(v.s[33].n === 1 && v.s[34].n === 1 && !v.cursor, 'arrastar com o direito põe 1 em cada');
// contagem continua batendo
const c = v.contagem(); ok(c[TR] === 69 && c[G] === 3, 'mexer não cria nem some nada ' + JSON.stringify(c));
// shift: mochila -> barra
v.moverRapido('s', 30); ok(!v.s[30] && v.total(TR) === 69, 'shift-clique leva da mochila para a barra');
// tecla 1..9 e segunda mão
v.trocarComBarra('s', 31, 8); ok(v.s[8] && v.s[8].id === TR && !v.s[31], 'tecla 9 em cima do espaço troca com a barra');
v.trocarMaos(8); ok(v.s[MAO2] && v.s[MAO2].id === TR && !v.s[8], 'F troca a mão com a segunda mão');
// colocar da segunda mão gasta dela
v.preferir = MAO2; const n2 = v.s[MAO2].n; v.ajustar({ [TR]: 68, [G]: 3 }, 0); ok(v.s[MAO2] ? v.s[MAO2].n === n2 - 1 : n2 === 1, 'colocar com a segunda mão gasta dela');

// grade: livro de receitas enche, criar gasta 1 de cada espaço, fechar devolve
const g = new Inventario();
g.ajustar({ [T]: 10 });
g.mudarGrade(2);
const r = receita('bancada');
const vezes = g.encher(arrumar(r, 2));
ok(vezes === 1 && receitaDaGrade(g.gradeIds(), 2) === r, 'livro põe 4 tábuas na grade 2x2 e ela vira bancada');
ok(g.total(T) === 10, 'na grade as tábuas continuam contando');
g.gastarGrade(); g.cursor = { id: 34, n: 1 }; g.ajustar({ [T]: 6, 34: 1 });
ok(g.total(T) === 6 && !g.gradeIds().some(Boolean) && g.cursor && g.cursor.id === 34, 'criou: a grade gastou e a bancada ficou no cursor');
g.devolver(); ok(!g.cursor && g.total(34) === 1, 'fechar devolve o cursor para a mochila');
const vm = g.encher(arrumar(receita('graveto'), 2), 99); ok(vm === 3, 'shift no livro enche o máximo (6 tábuas = 3 vezes graveto)');
g.devolver(); ok(g.total(T) === 6 && g.contagem()[T] === 6, 'devolver a grade não perde nada');

// receitas: desenhos batem com o que gastam e nenhuma grade faz duas coisas
let conflitos = 0;
for (const rc of RECEITAS) {
  const d = desenhoDe(rc);
  if (d) { const cc = {}; d.flat().forEach((x) => { if (x) cc[x] = (cc[x] || 0) + 1; }); if (rc.usa.some(([id, q]) => cc[id] !== q) || Object.keys(cc).length !== rc.usa.length) { conflitos++; console.log('  desenho errado', rc.id); } }
  for (const w of [2, 3]) if (cabeNaGrade(rc, w)) { const x = receitaDaGrade(arrumar(rc, w), w); if (x !== rc) { conflitos++; console.log('  conflito', w, rc.id, x && x.id); } }
  if (!cabeNaGrade(rc, 3)) { conflitos++; console.log('  não cabe', rc.id); }
}
ok(!conflitos, `todas as ${RECEITAS.length} receitas têm uma grade só delas`);
// desenho em outro lugar da grade e espelhado
const pic = [0, 0, 0, P, P, 0, P, G, 0, 0, G, 0].slice(3); // linhas: PP. / PG. / .G.
ok(receitaDaGrade([P, P, 0, P, G, 0, 0, G, 0], 3).id === 'machado-pedra', 'machado no canto');
ok(receitaDaGrade([0, P, P, 0, G, P, 0, G, 0], 3).id === 'machado-pedra', 'machado espelhado');
ok(receitaDaGrade([0, 0, 0, 0, T, 0, 0, T, 0], 3).id === 'graveto', 'graveto no meio da 3x3');
ok(receitaDaGrade([0, 0, 0, T, T, 0, 0, 0, 0], 3).id === 'cadeira', 'tábuas deitadas fazem cadeira (em pé, graveto)');
ok(receitaDaGrade([P, P, P, 0, G, 0, 0, 0, 0], 3) === null, 'desenho incompleto não faz nada');
ok(!cabeNaGrade(receita('picareta-madeira'), 2), 'picareta só na bancada (3x3)');
void pic;

// espaço da mochila (como no clássico): 37 pilhas
const cheia = {}; for (let i = 0; i < 36; i++) cheia[[1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 31, 32, 33, 34, 71, 73, 131, 47, 49, 51, 53, 55, 57, 58, 59][i]] = 64;
ok(espacosUsados(cheia) === 36 && cabeQuanto(cheia, 1000) === 64 && cabe(cheia, 1000, 64) && !cabe(cheia, 1000, 65), 'sobra 1 espaço: cabem 64 gravetos e não 65');
cheia[1000] = 64; ok(!cabe(cheia, 1000, 1) && !cabe(cheia, 5, 1), 'mochila cheia não pega mais nada');
cheia[1] = 60; ok(cabeQuanto(cheia, 1) === 4, 'mas completa a pilha incompleta (4 de terra)');
ok(ESPACOS === 37, '27 + 9 + segunda mão');
// a economia (mesma regra da sala) recusa pegar com a mochila cheia, só no modo de coletar
const e = estadoNovo(); e.itens = { ...cheia }; e.itens[1] = 64;
const pg = aplicar(e, { sobrevivencia: true }, { t: 'pegar', id: 1000, n: 1 });
ok(!pg.ok, 'coletando: com a mochila cheia não pega do chão (' + pg.erro + ')');
// só cabe parte da pilha do chão: pega o que cabe e o resto fica (como no clássico)
const ep = estadoNovo(); ep.itens = { ...cheia }; ep.itens[1] = 60;
const pp = aplicar(ep, { sobrevivencia: true }, { t: 'pegar', id: 1, n: 10, c: 6 });
ok(pp.ok && pp.pegou === 4 && ep.itens[1] === 64 && pp.restoC === 2, 'só cabem 4 de 10: pega 4, ficam 6 no chão (' + pp.pegou + ', comprados no chão ' + pp.restoC + ')');
const ec = estadoNovo(); ec.itens = { 1: 3 };
const pc = aplicar(ec, { sobrevivencia: true }, { t: 'pegar', id: 1, n: 10 });
ok(pc.ok && pc.pegou === 10 && ec.itens[1] === 13, 'com espaço pega a pilha inteira');
const e2 = estadoNovo(); e2.itens = { [T]: 4 };
ok(aplicar(e2, { sobrevivencia: true }, { t: 'criar', r: 'bancada', bancada: false }).ok && e2.itens[34] === 1, 'criar continua funcionando');
// criar que não cabe: recusa sem gastar
const e3 = estadoNovo(); e3.itens = { ...cheia, [TR]: 1 }; delete e3.itens[8]; e3.itens[8] = 64; // tudo cheio, 1 tronco
const sem = aplicar(e3, { sobrevivencia: true }, { t: 'criar', r: 'tabuas', bancada: false });
ok(sem.ok === !!podeCriar({ ...cheia, [TR]: 1, 8: 64 }, receita('tabuas'), false, true), 'criar só quando o resultado cabe (tábuas completam pilha?)');

// pilhas espalhadas (8 + 8 + 8) e a mochila enchendo: junta para caber
const j = new Inventario();
const quase = {}; [1, 3, 4, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 31, 32, 33, 71, 73, 131, 47, 49, 51, 53, 55, 57, 58, 59, 66].forEach((id) => { quase[id] = 64; });
j.ajustar({ 2: 24 }); j.clicarDireito('s', 0); j.clicarDireito('s', 0); j.clicar('s', 30); j.clicarDireito('s', 0); j.clicar('s', 31);
j.ajustar({ 2: 24, ...quase });
ok(!j.extra.length && j.total(2) === 24, 'pilhas de terra espalhadas se juntam quando a mochila enche (nada sobrando)');
console.log(falhas ? `FALHOU (${falhas})` : 'TUDO OK');
process.exit(falhas ? 1 : 0);

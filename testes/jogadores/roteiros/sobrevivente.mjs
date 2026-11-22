// Roteiro "primeiro dia" do clássico, jogado pela tela: mundo novo de sobrevivência, socar árvore, juntar troncos,
// tábuas na grade 2x2, bancada, gravetos, colocar a bancada, abrir a bancada (3x3), picareta de madeira, minerar
// pedra. Cada diferença com o clássico vira bug do tipo "clássico".
import { acharBloco, irAte, quebrarBloco, juntar, itens, craftar, inv, mirarBloco, bloco, pos, mirando, lugarParaPor, mirarEmCima } from '../acoes.mjs';
const TRONCOS = [6, 71, 73], PEDRA = 3, TABUAS = 8, BANCADA = 34, GRAVETO = 1000, PICARETA = 1001;
const soma = (it, ids) => ids.reduce((s, i) => s + (it[i] || 0), 0);

export default async function sobrevivente(j) {
  if (!(await j.jogarSozinho())) return j.bug('Jogar sem conta não abriu a tela de mundo novo');
  if (!(await j.criarMundo({ nome: 'Primeiro dia' }))) return;
  const e0 = await j.estado;
  await j.espera(e0.vida === 20, 'mundo novo começa com 10 corações (20 de vida)', { tipo: 'clássico', esperado: '20', visto: String(e0.vida) });
  await j.espera(Object.values(e0.itens).every((n) => !n), 'sobrevivência começa com a mochila vazia', { tipo: 'clássico', esperado: 'mochila vazia', visto: JSON.stringify(e0.itens) });
  const hud = await j.p.evaluate(() => ({ barra: document.querySelectorAll('#barra .slot:not(.mais)').length, fome: !!document.querySelector('#fome:not([hidden])') && getComputedStyle(document.querySelector('#fome')).display !== 'none' }));
  await j.espera(hud.barra === 9, 'a barra de baixo tem 9 espaços', { tipo: 'clássico', esperado: '9', visto: String(hud.barra) });
  await j.espera(hud.fome, 'a barra de fome aparece na sobrevivência', { tipo: 'clássico' });

  // ---- madeira: soca 4 troncos ----
  let troncos = 0; const ruins = [];
  for (let n = 0; n < 10 && troncos < 4; n++) {
    const t = await acharBloco(j, TRONCOS, 48, { fora: ruins, base: true });
    if (!t) { await j.bug('não há árvore a até 48 blocos de onde o jogador nasce', { tipo: 'clássico', esperado: 'árvores perto do começo' }); break; }
    j.passo(`viu um tronco em ${t.x},${t.y},${t.z}`);
    if (!(await irAte(j, t.x, t.z, { perto: 2.4 }))) { j.passo('não conseguiu chegar na árvore'); continue; }
    const ms = await quebrarBloco(j, t.x, t.y, t.z, { max: 40000 });
    if (ms === -2) { ruins.push(t.x + ',' + t.y + ',' + t.z); continue; }
    if (ms < 0) { await j.bug('segurar para quebrar não quebrou o tronco em 40 s', { tipo: 'jogo', esperado: 'tronco quebra com a mão em ~3 s', visto: 'bloco ' + (await bloco(j, t.x, t.y, t.z)) + ', mira: ' + JSON.stringify(await mirando(j)) + ', jogo: ' + JSON.stringify(j.diag) }); continue; }
    j.passo(`quebrou o tronco em ${(ms / 1000).toFixed(1)} s`);
    if (n === 0) await j.espera(ms < 6500, 'tronco com a mão quebra em uns 3 s, como no clássico', { tipo: 'clássico', esperado: '~3 s', visto: (ms / 1000).toFixed(1) + ' s (com o jogo lento do teste)' });
    await juntar(j, t.x, t.z);
    troncos = soma(await itens(j), TRONCOS);
  }
  if (!(await j.espera(troncos >= 3, 'juntou pelo menos 3 troncos andando por cima', { visto: troncos + ' troncos' }))) return;
  await j.print('troncos');

  // ---- mochila: tábuas na grade 2x2 ----
  if (!(await j.espera(await j.abrirInventario(), 'E / botão da mochila abre a mochila'))) return;
  const e1 = await inv(j);
  await j.espera(e1.w === 2, 'a mochila tem grade de criar 2x2', { tipo: 'clássico', visto: 'grade ' + e1.w + 'x' + e1.w });
  const idTronco = (await itens(j))[6] ? 6 : (await itens(j))[71] ? 71 : 73;
  await craftar(j, idTronco, [0]); await craftar(j, idTronco, [0]);
  let it = await itens(j);
  await j.espera((it[TABUAS] || 0) >= 8, '1 tronco na grade dá 4 tábuas (2 troncos = 8)', { tipo: 'clássico', esperado: '8 tábuas', visto: (it[TABUAS] || 0) + ' tábuas' });
  // bancada = 4 tábuas em quadrado
  const fezBancada = await craftar(j, TABUAS, [0, 1, 2, 3]);
  it = await itens(j);
  await j.espera(fezBancada && it[BANCADA] >= 1, '4 tábuas em quadrado na grade 2x2 fazem a bancada', { tipo: 'clássico', visto: JSON.stringify(it) });
  // gravetos = 2 tábuas em pé
  if ((it[TABUAS] || 0) < 2) await craftar(j, idTronco, [0]);
  await craftar(j, TABUAS, [0, 2]);
  it = await itens(j);
  await j.espera((it[GRAVETO] || 0) >= 4, '2 tábuas uma em cima da outra fazem 4 gravetos', { tipo: 'clássico', visto: (it[GRAVETO] || 0) + ' gravetos' });
  await j.print('mochila');
  await j.fecharInventario();

  // ---- coloca a bancada no chão e abre ----
  const sBancada = (await inv(j)).s.findIndex((x) => x && x[0] === BANCADA);
  if (sBancada < 0 || sBancada > 8) { await j.bug('a bancada criada não foi para a barra de baixo', { tipo: 'clássico', visto: 'espaço ' + sBancada }); return; }
  await j.escolherSlot(sBancada);
  let chao = await lugarParaPor(j);
  for (let t = 0; t < 4 && !chao; t++) { await j.andar(['frente', 'direita', 'tras', 'esquerda'][t], 1500, { pular: true }); chao = await lugarParaPor(j); }
  if (!chao) return j.passo('não achou chão firme para pôr a bancada');
  j.passo(`vai pôr a bancada em cima de ${chao.x},${chao.y},${chao.z}`);
  await mirarEmCima(j, chao.x, chao.y, chao.z);
  await j.usar(); await j.p.waitForTimeout(700);
  const colocou = (await bloco(j, chao.x, chao.y + 1, chao.z)) === BANCADA || (await acharBloco(j, [BANCADA], 5, { acimaDoChao: false }));
  if (!(await j.espera(!!colocou, 'botão direito / toque põe a bancada no chão'))) return;
  const ban = await acharBloco(j, [BANCADA], 5, { acimaDoChao: false });
  await mirarBloco(j, ban.x, ban.y, ban.z);
  await j.usar(); await j.p.waitForTimeout(600);
  const g3 = await inv(j);
  await j.espera(await j.p.isVisible('#inventario:not([hidden])') && g3.w === 3, 'usar a bancada abre a grade de criar 3x3', { tipo: 'clássico', visto: 'grade ' + g3.w });
  if (g3.w === 3) {
    const precisa = Math.max(0, 3 - ((await itens(j))[TABUAS] || 0));
    if (precisa) await craftar(j, idTronco, [0]);
    // picareta: TTT / .G. / .G.
    const ok = await craftar(j, [TABUAS, TABUAS, TABUAS, GRAVETO, GRAVETO], [0, 1, 2, 4, 7]);
    it = await itens(j);
    await j.espera(ok && it[PICARETA] >= 1, 'picareta de madeira na bancada (3 tábuas em cima, 2 gravetos no meio)', { tipo: 'clássico', visto: JSON.stringify(it) });
    await j.print('bancada');
  }
  await j.fecharInventario();

  // ---- pedra: com a mão não dá pedra; com a picareta dá ----
  const pedra = await acharBloco(j, [PEDRA], 30);
  if (!pedra) { j.passo('não achou pedra exposta perto'); return; }
  j.passo(`viu pedra em ${pedra.x},${pedra.y},${pedra.z}`);
  if (!(await irAte(j, pedra.x, pedra.z, { perto: 2.6 }))) return;
  // no clássico, pedra com a mão (sem picareta) quebra devagar e não dá nada
  const sVazio = (await inv(j)).s.findIndex((x, i) => i < 9 && !x);
  if (sVazio >= 0) {
    await j.escolherSlot(sVazio);
    const outra = await acharBloco(j, [PEDRA], 5);
    if (outra) {
      const a0 = await itens(j);
      const tm = await quebrarBloco(j, outra.x, outra.y, outra.z, { max: 25000 });
      if (tm >= 0) {
        await juntar(j, outra.x, outra.z);
        const a1 = await itens(j);
        const ganhou = Object.keys(a1).filter((k) => +k === PEDRA && (a1[k] || 0) > (a0[k] || 0)).map((k) => k + ' +' + (a1[k] - (a0[k] || 0))); // só a pedra conta (troncos largados por perto também são juntados)
        await j.espera(!ganhou.length, 'pedra quebrada com a mão não dá nada (precisa de picareta)', { tipo: 'clássico', esperado: 'nada', visto: ganhou.join(', ') });
      }
    }
  }
  const antes = (await itens(j))[PEDRA] || 0;
  const sPic = (await inv(j)).s.findIndex((x) => x && x[0] === PICARETA);
  if (sPic >= 0 && sPic < 9) await j.escolherSlot(sPic);
  const ms = await quebrarBloco(j, pedra.x, pedra.y, pedra.z, { max: 15000 });
  if (ms === -2) return j.passo('não conseguiu mirar na pedra');
  if (ms < 0) return j.bug('picareta de madeira não quebrou pedra em 15 s', { tipo: 'jogo' });
  await juntar(j, pedra.x, pedra.z);
  const depois = (await itens(j))[PEDRA] || 0;
  await j.espera(depois > antes, 'pedra quebrada com picareta cai e é juntada', { visto: `${antes} -> ${depois}` });
  await j.semErros('no primeiro dia');
}

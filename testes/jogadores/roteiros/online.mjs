// Roteiro online: Ana (PC) cria conta e mundo, lê o código no menu e passa para o Beto (tablet), que entra pelo
// código. Os dois se veem, Ana quebra um bloco e o Beto vê sumir, conversam pelo chat, o Beto fica sem internet,
// a Ana mexe no mundo enquanto isso e o Beto precisa ver tudo quando a internet volta; depois o Beto recarrega.
import { Jogador } from '../base.mjs';
import { acharBloco, quebrarBloco, bloco, irAte, juntar, itens } from '../acoes.mjs';

const ve = (j, ms) => j.p.waitForFunction(() => window.__jogo && window.__jogo.outros > 0, null, { timeout: ms }).then(() => true, () => false);

export default async function online(prefixo, perfis = ['pc', 'tablet']) {
  const ana = await new Jogador('Ana' + prefixo, perfis[0], 'online').abrir();
  const beto = await new Jogador('Beto' + prefixo, perfis[1], 'online').abrir();
  try {
    if (!(await ana.criarConta('Ana')) || !(await ana.escolherJogo())) return;
    if (!(await ana.criarMundo({ nome: 'Fazenda da Ana' }))) return;
    // Ana abre o menu (Esc) e lê o código
    ana.passo('abriu o menu do jogo');
    if (ana.toque) await ana.aperta('#bt-menu', 'menu'); else await ana.esc();
    await ana.p.waitForTimeout(500);
    if (!(await ana.p.isVisible('#pausa'))) await ana.aperta('#bt-menu', 'menu');
    const txtMenu = await ana.p.locator('#pausa-mundo').innerText().catch(() => '');
    const codigo = ((txtMenu.match(/código\s+(\w+)/) || [])[1] || (await ana.p.locator('#dono-codigo').textContent().catch(() => '')) || '').trim();
    if (!(await ana.espera(/^\w{4,}$/.test(codigo), 'o menu mostra o código do mundo para chamar amigos', { visto: JSON.stringify(txtMenu) }))) return;
    ana.passo('leu o código ' + codigo + ' e fechou o menu');
    await ana.esc(); await ana.p.waitForTimeout(300);
    if (await ana.p.isVisible('#pausa')) await ana.aperta('#pausa button:has-text("Voltar"), #pausa .fechar', 'voltar ao jogo').catch(() => {});
    if (!ana.toque) await ana.travarMouse();

    if (!(await beto.criarConta('Beto')) || !(await beto.escolherJogo())) return;
    if (!(await beto.entrarCodigo(codigo))) return;
    await beto.espera(await ve(beto, 20000), 'Beto vê a Ana no mundo');
    await ana.espera(await ve(ana, 20000), 'Ana vê o Beto no mundo');

    // Ana anda; Beto vê a Ana se mexer
    const antes = await beto.p.evaluate(() => { const o = window.__jogo.outrosLista[0]; return o && o.grupo.position.clone(); });
    await ana.andar('frente', 1500);
    await beto.p.waitForTimeout(1500);
    const depois = await beto.p.evaluate(() => { const o = window.__jogo.outrosLista[0]; return o && o.grupo.position.clone(); });
    await beto.espera(antes && depois && Math.hypot(depois.x - antes.x, depois.z - antes.z) > 0.8, 'Beto vê a Ana andando', { visto: JSON.stringify([antes, depois]) });

    // Ana quebra um bloco natural; Beto vê sumir
    const alvo = await acharBloco(ana, [1, 2, 6, 7], 6);
    if (alvo) {
      ana.passo(`vai quebrar o bloco ${alvo.b} em ${alvo.x},${alvo.y},${alvo.z}`);
      await irAte(ana, alvo.x, alvo.z, { perto: 2.5, ms: 10000 });
      const ms = await quebrarBloco(ana, alvo.x, alvo.y, alvo.z, { max: 9000 });
      if (ms === -2) ana.passo('não conseguiu mirar no bloco; pula esta parte');
      else if (await ana.espera(ms >= 0, 'Ana quebra o bloco no mundo online')) {
        await beto.p.waitForTimeout(1500);
        await beto.espera((await bloco(beto, alvo.x, alvo.y, alvo.z)) === 0, 'o bloco que a Ana quebrou some para o Beto', { visto: 'bloco ' + (await bloco(beto, alvo.x, alvo.y, alvo.z)) });
        await juntar(ana, alvo.x, alvo.z);
      }
    }

    // chat: T, escreve, Enter (Ana no PC); Beto lê
    if (!ana.toque) { await ana.tecla('KeyT', 'T (chat)'); } else await ana.aperta('#bt-chat', 'chat');
    if (await ana.espera(await ana.ve('#chat-caixa', 3000), 'o chat abre')) {
      await ana.escreve('#chat-txt', 'oi beto vem aqui', 'chat');
      await ana.tecla('Enter');
      await beto.p.waitForTimeout(1500);
      const log = await beto.p.locator('#chat-log').innerText().catch(() => '');
      await beto.espera(/oi beto vem aqui/.test(log), 'Beto recebe a mensagem do chat da Ana', { visto: log.slice(-120) });
      await ana.esc(); if (!ana.toque) await ana.travarMouse();
    }

    // Beto fica sem internet; Ana mexe no mundo enquanto isso
    const offline = beto.semInternet(9000);
    await ana.p.waitForTimeout(1500);
    const outro = await acharBloco(ana, [1, 2, 7], 5);
    let quebrouOff = null;
    if (outro && (await quebrarBloco(ana, outro.x, outro.y, outro.z, { max: 7000 })) >= 0) quebrouOff = outro;
    await offline;
    await beto.p.waitForTimeout(8000);
    await beto.espera(await ve(beto, 15000), 'Beto volta a ver a Ana depois que a internet volta', { tipo: 'online' });
    if (quebrouOff) await beto.espera((await bloco(beto, quebrouOff.x, quebrouOff.y, quebrouOff.z)) === 0, 'o que a Ana quebrou enquanto o Beto estava sem internet aparece para ele quando volta', { tipo: 'online', visto: 'bloco ' + (await bloco(beto, quebrouOff.x, quebrouOff.y, quebrouOff.z)) });
    await beto.print('depois-sem-internet');

    // Beto recarrega a página no meio do jogo: volta ao menu e entra de novo pelo código
    await beto.recarregar();
    const noMenu = await beto.ve('#m-mundos:not([hidden]), #m-jogos:not([hidden])', 15000);
    if (await beto.espera(noMenu, 'recarregar a página mantém o Beto logado (volta para a lista)')) {
      await beto.escolherJogo();
      if (await beto.ve('#lista-mundos .mundo, #lista-mundos button', 5000)) {
        const temFazenda = await beto.p.locator('#lista-mundos', { hasText: 'Fazenda da Ana' }).count();
        await beto.espera(temFazenda > 0, 'o mundo da Ana aparece na lista do Beto depois que ele entrou uma vez', { tipo: 'online' });
      }
    }
    await ana.semErros('online (Ana)'); await beto.semErros('online (Beto)');
    await ana.print('fim'); await beto.print('fim');
  } finally { await ana.fechar(); await beto.fechar(); }
}

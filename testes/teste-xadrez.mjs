// Teste real do Xadrez. Parte 1: contra o computador no tablet (pela tela de jogos, tocando nas casas) e fotos no celular.
// Parte 2: online com 2 jogadores (Ana no PC, Beto no celular): Ana chama pelo xadrez, Beto aceita o convite na tela de jogos,
// jogam tocando nas casas até o mate do pastor, servidor recusa lance errado, recarregar continua, revanche troca as cores.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/xadrez';
const URL = process.env.URL || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
const letras = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
const CEL = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const casa = (n) => (8 - +n[1]) * 8 + 'abcdefgh'.indexOf(n[0]);

async function abrir(opc, nome) {
  const ctx = await b.newContext(opc);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push('console: ' + m.text()); });
  const toque = !!opc.hasTouch;
  const j = { p, erros, nome, ctx, clica: (sel) => (toque ? p.tap(sel) : p.click(sel)), foto: async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${SAIDA}/${n}.png` }); } };
  j.lance = async (de, para) => { await j.clica(`.casa[data-i="${casa(de)}"]`); await j.clica(`.casa[data-i="${casa(para)}"]`); };
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  if (nome) {
    await j.clica('#bt-criar-conta');
    await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
    if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
    await j.clica('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  }
  return j;
}

// ---------- parte 1: contra o computador ----------
{
  const t = await abrir({ ...devices['Galaxy Tab S4 landscape'] }, 'xtab' + letras());
  await t.clica('.jogo[data-jogo=xadrez]');
  await t.p.waitForURL(/xadrez/); await t.p.waitForSelector('#x-menu:not([hidden])');
  ok(true, 'tablet: cartão Xadrez abre a página do xadrez');
  await t.foto('1-tablet-menu');
  await t.clica('.nivel[data-nivel="1"]'); await t.clica('#bt-computador');
  await t.p.waitForSelector('#x-jogo:not([hidden])');
  await t.clica(`.casa[data-i="${casa('e2')}"]`);
  const pontos = await t.p.$$eval('.casa.pode', (l) => l.map((e) => +e.dataset.i).sort());
  ok(pontos.join() === [casa('e4'), casa('e3')].sort().join(), 'tablet: tocar no peão mostra as 2 casas onde ele pode ir');
  await t.foto('2-tablet-selecionado');
  await t.clica(`.casa[data-i="${casa('e4')}"]`);
  await t.p.waitForFunction(() => window.__xadrez && window.__xadrez.e.vez === 'w' && window.__xadrez.e.n === 2, null, { timeout: 15000 }).catch(() => {});
  await t.p.waitForFunction(() => /^Sua vez/.test(document.querySelector('#x-status').textContent), null, { timeout: 15000 });
  ok(await t.p.evaluate(() => window.__xadrez.e.n === 2), 'tablet: o computador respondeu e voltou a ser a sua vez');
  // lance que não vale: torre presa
  await t.clica(`.casa[data-i="${casa('a1')}"]`);
  ok(await t.p.locator('.casa.pode').count() === 0, 'tablet: torre presa não tem para onde ir');
  await t.foto('3-tablet-jogando');
  // recarregar e continuar
  await t.p.reload(); await t.p.waitForSelector('#x-menu:not([hidden])');
  ok(await t.p.isVisible('#bt-continuar'), 'tablet: depois de recarregar aparece "Continuar a partida"');
  await t.clica('#bt-continuar');
  ok(await t.p.evaluate(() => window.__xadrez && window.__xadrez.e.n === 2), 'tablet: a partida continuou do mesmo lance');
  ok(t.erros.length === 0, 'tablet: sem erros no console ' + t.erros.join(' | ').slice(0, 300));
  await t.ctx.close();
  // fotos no celular (em pé e deitado), sem conta
  for (const [n, opc] of [['cel-retrato', CEL], ['cel-deitado', { ...CEL, viewport: { width: 740, height: 360 } }], ['cel-pequeno', { ...CEL, viewport: { width: 320, height: 568 } }]]) {
    const c = await abrir(opc, null);
    await c.p.goto(URL + '/xadrez.html#teste'); await c.p.waitForSelector('#x-menu:not([hidden])');
    ok(await c.p.isVisible('#x-sem-conta'), `${n}: sem conta pede para entrar para jogar com amigos`);
    await c.foto(`4-${n}-menu`);
    await c.clica('#bt-computador'); await c.p.waitForSelector('#x-jogo:not([hidden])');
    await c.lance('d2', 'd4');
    await c.p.waitForFunction(() => /^Sua vez/.test(document.querySelector('#x-status').textContent), null, { timeout: 15000 });
    const fora = await c.p.evaluate(() => [...document.querySelectorAll('#x-jogo button, #tabuleiro, #x-status')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1); }).map((e) => e.id || e.className));
    ok(!fora.length, `${n}: tabuleiro e botões cabem na tela (${fora.slice(0, 4)})`);
    await c.foto(`5-${n}-jogo`);
    ok(c.erros.length === 0, `${n}: sem erros no console ` + c.erros.join(' | ').slice(0, 200));
    await c.ctx.close();
  }
}

// ---------- parte 2: online com um amigo ----------
const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'xana' + letras());
const beto = await abrir(CEL, 'xbeto' + letras());
// ficam amigos pela API (a tela de amigos tem teste próprio)
await ana.p.evaluate(async (n) => { const t = localStorage.getItem('pradaria.token'); await fetch('/api/amigos/pedir', { method: 'POST', headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify({ nome: n }) }); }, beto.nome);
await beto.p.evaluate(async (n) => { const t = localStorage.getItem('pradaria.token'); await fetch('/api/amigos/pedir', { method: 'POST', headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify({ nome: n }) }); }, ana.nome);
await ana.clica('.jogo[data-jogo=xadrez]'); await ana.p.waitForURL(/xadrez/);
await ana.p.waitForSelector('#x-menu:not([hidden])');
await ana.clica('#bt-amigo');
await ana.p.waitForSelector('#amigos:not([hidden]) .chamar', { timeout: 10000 });
ok(/aguardando|Esperando/i.test(await ana.p.textContent('#x-status')), 'Ana abriu a partida e espera o amigo');
await ana.foto('6-ana-chama');
await ana.clica('#amigos-lista .chamar');
await beto.p.waitForSelector('#convite:not([hidden])', { timeout: 10000 });
ok(/Xadrez/.test(await beto.p.textContent('#convite-txt')), 'Beto recebe "chamou você para jogar Xadrez"');
await beto.foto('7-beto-convite');
await beto.clica('#convite-sim');
await beto.p.waitForURL(/xadrez\?sala=/);
await beto.p.waitForFunction(() => window.__xadrez && window.__xadrez.online && window.__xadrez.online.jogadores && window.__xadrez.online.jogadores.b, null, { timeout: 15000 });
ok(await beto.p.evaluate(() => window.__xadrez.voce) === 'b', 'Beto entrou de pretas');
await ana.p.evaluate(() => document.querySelector('#amigos-fechar').click());
await ana.p.waitForFunction(() => /^Sua vez/.test(document.querySelector('#x-status').textContent), null, { timeout: 10000 });
ok(true, 'Ana vê "Sua vez" quando o Beto chega');
// Beto tenta jogar fora da vez
await beto.lance('e7', 'e5');
ok(await beto.p.evaluate(() => window.__xadrez.e.b[12] === 'p'), 'Beto não consegue mexer na vez da Ana');
// o toque fora da vez vira pré-lance: sai sozinho quando a Ana jogar
ok(await beto.p.evaluate(() => JSON.stringify(window.__xadrez.pre)) === JSON.stringify({ de: casa('e7'), para: casa('e5') }) /* casa() roda aqui no node */ && await beto.p.locator('.casa.pre').count() === 2, 'Beto marcou o pré-lance e7-e5 (casas marcadas)');
await ana.p.waitForFunction((c) => window.__xadrez.e.vez === c, 'w', { timeout: 10000 });
await ana.lance('e2', 'e4');
await ana.p.waitForFunction((i) => window.__xadrez.e.ultimo && window.__xadrez.e.ultimo.para === i && window.__xadrez.e.vez === 'w', casa('e5'), { timeout: 10000 });
ok(true, 'pré-lance: o e5 do Beto saiu sozinho logo depois do e4 da Ana');
const jogo = [['ana', 'f1', 'c4'], ['beto', 'b8', 'c6'], ['ana', 'd1', 'h5'], ['beto', 'g8', 'f6']];
for (const [q, de, para] of jogo) {
  const j = q === 'ana' ? ana : beto, o = q === 'ana' ? beto : ana;
  await j.p.waitForFunction((c) => window.__xadrez.e.vez === c, q === 'ana' ? 'w' : 'b', { timeout: 10000 });
  await j.lance(de, para);
  await o.p.waitForFunction((i) => window.__xadrez.e.ultimo && window.__xadrez.e.ultimo.para === i, casa(para), { timeout: 10000 });
}
ok(true, '6 lances jogados tocando nas casas, cada um aparece para o outro');
ok(/1\.\s*e4\s*e5\s*2\.\s*Bc4\s*Cc6\s*3\.\s*Dh5\s*Cf6/.test(await ana.p.textContent('#x-lances')), 'lista de lances: ' + (await ana.p.textContent('#x-lances')));
await beto.foto('8-beto-jogando');
// servidor recusa lance que não vale (mandado direto pelo WebSocket)
await ana.p.evaluate(() => window.__xadrez.online.ws.send(JSON.stringify({ t: 'lance', de: 56, para: 40 })));
await ana.p.waitForFunction(() => /não vale/.test(document.querySelector('#aviso').textContent), null, { timeout: 5000 }).then(() => ok(true, 'servidor recusa lance que não vale'), () => ok(false, 'servidor recusa lance que não vale'));
// Beto recarrega no meio
await beto.p.reload();
await beto.p.waitForFunction(() => window.__xadrez && window.__xadrez.e.n === 4, null, { timeout: 15000 });
ok(true, 'Beto recarregou e a partida continuou no mesmo lugar');
await ana.lance('h5', 'f7');
await ana.p.waitForSelector('#x-fim:not([hidden])', { timeout: 10000 });
await beto.p.waitForSelector('#x-fim:not([hidden])', { timeout: 10000 });
ok((await ana.p.textContent('#fim-titulo')) === 'Você ganhou!' && (await beto.p.textContent('#fim-titulo')) === 'Você perdeu', 'xeque-mate: Ana ganhou, Beto perdeu');
await ana.foto('9-ana-ganhou'); await beto.foto('9-beto-perdeu');
await beto.clica('#bt-revanche');
await ana.p.waitForFunction(() => /quer jogar de novo/.test(document.querySelector('#fim-espera').textContent), null, { timeout: 8000 });
ok(true, 'Ana vê que o Beto quer revanche');
await ana.clica('#bt-revanche');
await ana.p.waitForFunction(() => window.__xadrez.voce === 'b' && !window.__xadrez.fim && window.__xadrez.e.n === 1, null, { timeout: 8000 });
await beto.p.waitForFunction(() => window.__xadrez.voce === 'w', null, { timeout: 8000 });
ok(true, 'revanche: partida nova com as cores trocadas');
await beto.foto('10-beto-revanche-brancas');
ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

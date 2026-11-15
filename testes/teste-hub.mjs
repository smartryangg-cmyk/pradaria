// Teste real da tela "Escolha um jogo" (plataforma): cria a conta pela tela, vê os jogos, abre o Pradaria,
// volta para os jogos, recarrega (abre direto nos jogos) e entra num mundo. PC, tablet e celular. SAIDA=pasta das fotos.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/hub';
const URL = process.env.URL || 'http://localhost:8788';
const APARELHOS = {
  pc: { viewport: { width: 1280, height: 800 } },
  tablet: { ...devices['Galaxy Tab S4 landscape'] },
  'cel-retrato': { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'cel-deitado': { viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'cel-pequeno': { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const so = process.env.SO ? process.env.SO.split(',') : Object.keys(APARELHOS);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
for (const nome of so) {
  const ctx = await b.newContext(APARELHOS[nome]);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push('console: ' + m.text()); });
  const toque = APARELHOS[nome].hasTouch;
  const clica = (sel) => (toque ? p.tap(sel) : p.click(sel));
  const foto = async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${SAIDA}/${nome}-${n}.png` }); };
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await clica('#bt-criar-conta');
  const nomeJ = ('hub' + nome.replace(/[^a-z]/g, '') + Math.floor(Math.random() * 1e4)).slice(0, 16);
  await p.fill('#c-nome', nomeJ); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await clica('#c-ok');
  await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  ok(true, `${nome}: depois de criar a conta abre "Escolha um jogo"`);
  ok((await p.textContent('#j-nome')) === nomeJ, `${nome}: mostra o nome do jogador`);
  const cartoes = await p.$$eval('#lista-jogos .jogo', (l) => l.map((e) => e.dataset.jogo));
  ok(cartoes.join() === 'pradaria,xadrez,dama,truco,arena,ilha', `${nome}: 6 jogos na lista (${cartoes})`);
  // nada saindo da tela
  const fora = await p.evaluate(() => [...document.querySelectorAll('#m-jogos .jogo, #m-jogos .bt')].filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map((e) => e.id || e.dataset.jogo));
  ok(!fora.length, `${nome}: nada sai pelos lados (${fora})`);
  await foto('1-jogos');
  await clica('.jogo[data-jogo=truco]');
  ok(/sendo feito/.test(await p.textContent('#jogos-msg')), `${nome}: jogo em breve avisa e não sai da tela`);
  ok(await p.isVisible('#m-jogos'), `${nome}: continua na lista de jogos`);
  await clica('.jogo[data-jogo=pradaria]');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  ok(true, `${nome}: Pradaria abre a lista de mundos`);
  await foto('2-mundos');
  await clica('#bt-voltar-jogos');
  await p.waitForSelector('#m-jogos:not([hidden])');
  ok(true, `${nome}: "Todos os jogos" volta para a lista`);
  await p.reload(); await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  ok(true, `${nome}: recarregar com conta abre direto nos jogos`);
  if (nome === 'pc' || nome === 'tablet') {
    // o Pradaria continua igual: cria um mundo e entra
    await clica('.jogo[data-jogo=pradaria]'); await p.waitForSelector('#m-mundos:not([hidden])');
    await clica('#bt-novo-mundo'); await p.fill('#n-nome', 'Mundo do hub'); await clica('#m-novo button[type=submit]');
    await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala && !document.querySelector('#hud').hidden, null, { timeout: 60000 });
    ok(true, `${nome}: entrou num mundo online do Pradaria`);
    await p.waitForTimeout(2500); await foto('3-jogo');
  }
  await clica('#bt-sair-conta2').catch(() => {});
  ok(erros.length === 0, `${nome}: sem erros no console ${erros.join(' | ').slice(0, 300)}`);
  await ctx.close();
}
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

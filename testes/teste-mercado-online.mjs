// Mercado e objetivos online: o servidor conta, coleta, vende, compra e entrega presentes entre amigos.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const sfx = Date.now() % 100000;
async function jogador(nome) {
  const p = await (await b.newContext({ viewport: { width: 1024, height: 700 } })).newPage();
  p.on('pageerror', (e) => erros.push(nome + ' ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123'); await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])');
  return p;
}
const est = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.mercado.e)));
const a = await jogador('Ana' + sfx);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Feirinha'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
conferir(await a.evaluate(() => window.__jogo.mercado.op.mercado && window.__jogo.mercado.op.objetivos), 'mundo novo vem com mercado e missões');
conferir((await est(a)).moedas === 10, 'servidor deu 10 moedas iniciais');
// coloca 10 blocos e quebra 3 do chão
await a.evaluate(() => {
  const { mundo, jog } = window.__jogo; const x = Math.floor(jog.pos.x) + 3, z = Math.floor(jog.pos.z);
  for (let i = 0; i < 10; i++) mundo.definir(x, 40 + i, z, 1);
  // 3 blocos sólidos do chão que ninguém mexeu ainda
  let n = 0;
  for (let i = 0; n < 3 && i < 40; i++) { const bx = x + 2 + i, h = mundo.alturaEm(bx, z + 2); const bl = mundo.bloco(bx, h, z + 2); if (bl > 0 && bl !== 5 && bl < 23) { mundo.definir(bx, h, z + 2, 0); n++; } }
});
await a.waitForTimeout(1500);
let e = await est(a);
conferir(e.feitos.includes('colocar10') && e.moedas === 15, 'servidor cumpriu o objetivo e pagou (' + e.moedas + ')');
const itens = Object.values(e.itens).reduce((s, n) => s + n, 0);
conferir(itens >= 3, 'servidor coletou os itens (o capim de cima conta junto) ' + JSON.stringify(e.itens));
// trapaça: tentar colocar bloco trancado direto pela rede
await a.evaluate(() => window.__jogo.sala.enviar({ t: 'bloco', x: 5, y: 45, z: 5, b: 9 }));
// vende tudo
for (const [bid, qtd] of Object.entries(e.itens)) await a.evaluate(([bid, qtd]) => window.__jogo.mercado.enviar({ t: 'vender', b: +bid, n: qtd }), [bid, qtd]);
await a.waitForTimeout(800);
e = await est(a);
conferir(e.moedas > 15 && !Object.keys(e.itens).length, 'vendeu no servidor (' + e.moedas + ')');
await a.evaluate(() => window.__jogo.mercado.enviar({ t: 'comprar', b: 10 }));
await a.waitForTimeout(800);
e = await est(a);
conferir(e.comprados.includes(10), 'comprou o tijolo (' + e.moedas + ' sobrando)');
const podia = e.moedas >= 20;
await a.evaluate(() => window.__jogo.mercado.enviar({ t: 'comprar', b: 21 }));
await a.waitForTimeout(800);
conferir((await est(a)).comprados.includes(21) === podia, 'lampião só sai se tiver 20 moedas');
// amigo entra e recebe presente
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await a.waitForTimeout(800);
const antes = (await est(a)).moedas;
await a.click('#econ .econ-chip');
await a.click('#mochila .econ-linha .econ-dir .bt:nth-child(2)');
await a.waitForTimeout(1000);
conferir((await est(a)).moedas === antes - 5, 'Ana deu 5 moedas');
conferir((await est(bb)).moedas === 15, 'Beto recebeu 5 moedas (' + (await est(bb)).moedas + ')');
await bb.screenshot({ path: (process.env.SAIDA || '/tmp') + '/mercado-presente.png' });
// sai e volta: continua salvo
await a.click('#mochila .caixa > .bt');
const salvo = (await est(a)).moedas;
await a.evaluate(() => window.__jogo.sala.fechar());
await a.reload(); await a.waitForSelector('#m-mundos:not([hidden])');
await a.click('#lista-mundos .mundo');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(1500);
conferir((await est(a)).moedas === salvo, 'moedas guardadas no servidor ao voltar');
const ed = await a.evaluate(() => window.__jogo.mundo.bloco(5, 45, 5));
conferir(ed !== 9, 'servidor recusou bloco trancado');
console.log(erros.join('\n') || 'sem erros');
await b.close();
if (falhas.length || erros.length) process.exit(1);

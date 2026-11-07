import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = 'http://localhost:8788/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
async function jogador(nome, toque) {
  const ctx = await b.newContext({ viewport: { width: 1024, height: 640 }, hasTouch: toque, isMobile: toque });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Fazendinha'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
console.log('codigo', codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
// A coloca um bloco; B deve receber
await a.evaluate(() => { window.__jogo.jog.pitch = -0.9; window.__jogo.quebrar(null); });
await a.waitForTimeout(1500);
const edA = await a.evaluate(() => window.__jogo.mundo.listarEdicoes());
const edB = await bb.evaluate(() => window.__jogo.mundo.listarEdicoes());
console.log('edicoes A', JSON.stringify(edA), 'B', JSON.stringify(edB));
// B anda até perto de A e olha
await bb.evaluate(async () => { });
const pa = await a.evaluate(() => window.__jogo.jog.pos);
await bb.evaluate((pa) => { const j = window.__jogo.jog; j.pos.x = pa.x + 4; j.pos.z = pa.z; j.pos.y = pa.y + 1; j.yaw = Math.PI / 2; j.pitch = -0.1; }, pa);
await bb.waitForTimeout(2500);
await bb.screenshot({ path: '' + (process.env.SAIDA || '/tmp') + '/online-b.png' });
console.log('outros A', await a.evaluate(() => window.__jogo.outros), 'outros B', await bb.evaluate(() => window.__jogo.outros));
console.log(erros.join('\n'));
await b.close();

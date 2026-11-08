import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp', URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
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
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Cidade'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
// A entra num carro e dirige
await a.evaluate(() => { const J = window.__jogo; let m = null, dm = 1e9; for (const c of J.garagem.carros.values()) { const d = Math.hypot(c.x - J.jog.pos.x, c.z - J.jog.pos.z); if (d < dm) { dm = d; m = c; } } J.jog.pos.x = m.x + Math.cos(m.yaw) * 2; J.jog.pos.z = m.z - Math.sin(m.yaw) * 2; });
await a.waitForTimeout(400);
await a.evaluate(() => window.__jogo.entrarSair());
await a.keyboard.down('KeyW'); await a.waitForTimeout(2000); await a.keyboard.up('KeyW');
await a.keyboard.press('KeyH');
// B vai para perto do carro de A
const pa = await a.evaluate(() => { const c = window.__jogo.jog.carro; return c ? { x: c.x, z: c.z } : null; });
console.log('A no carro', pa);
await bb.evaluate((pa) => { const J = window.__jogo; J.jog.pos.x = pa.x + 8; J.jog.pos.z = pa.z + 8; J.cam.yaw = Math.atan2(8, 8); }, pa);
await bb.waitForTimeout(2500);
await bb.screenshot({ path: SAIDA + '/online2-b.png' });
const escondido = await bb.evaluate(() => [...window.__jogo.garagem.carros.values()].filter((c) => !c.grupo.visible).length);
console.log('carros escondidos em B (A dirigindo)', escondido);
await a.evaluate(() => { window.__jogo.jog.carro.vel = 0; window.__jogo.entrarSair(); });
await bb.waitForTimeout(1500);
const depois = await bb.evaluate(() => [...window.__jogo.garagem.carros.values()].filter((c) => !c.grupo.visible).length);
console.log('carros escondidos em B (A desceu)', depois);
console.log('outros A', await a.evaluate(() => window.__jogo.outros), 'outros B', await bb.evaluate(() => window.__jogo.outros));
console.log(erros.length ? erros.join('\n') : 'sem erros');
await b.close();

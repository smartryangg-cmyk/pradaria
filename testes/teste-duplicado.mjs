// Mesmo login em dois lugares: o primeiro sai com aviso, e a sala não mostra o jogador duplicado.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const nome = 'Duda' + (Date.now() % 10000);
async function abrir(criar) {
  const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  await p.goto(URL);
  await p.click(criar ? '#bt-criar-conta' : '#bt-entrar');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123'); if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const a = await abrir(true);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Teste'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.sala && window.__jogo.jog, null, { timeout: 20000 });
await a.waitForTimeout(1500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const c = await abrir(false);
await c.click('#bt-codigo'); await c.fill('#n-nome', codigo); await c.click('#m-novo button[type=submit]');
await c.waitForFunction(() => window.__jogo && window.__jogo.sala && window.__jogo.jog, null, { timeout: 20000 });
await a.waitForTimeout(2500);
console.log('A voltou para a lista:', await a.isVisible('#m-mundos'), '| aviso:', await a.textContent('#mundos-erro'));
console.log('C vê outros:', await c.evaluate(() => window.__jogo.outros));
console.log(erros.length ? erros.join('\n') : 'sem erros');
await b.close();

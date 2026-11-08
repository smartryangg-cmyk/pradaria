// Versão do jogo na tela inicial e na pausa; com ?appv=1.0.N (app Android) mostra também a versão do app.
// Precisa de `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
for (const [rot, tablet, busca] of [['pc', false, ''], ['tablet', true, ''], ['app', true, '?appv=1.0.42']]) {
  const ctx = await b.newContext(tablet ? { viewport: { width: 1100, height: 800 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(rot + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(rot + ' ' + m.text()); });
  await p.goto(BASE + '/' + busca + '#teste');
  await p.waitForSelector('#m-inicio:not([hidden])');
  const ini = await p.textContent('#versao-inicio');
  conferir(/^Versão (\d+|de teste)/.test(ini) && await p.isVisible('#versao-inicio'), `${rot}: versão na tela inicial ("${ini}")`);
  if (busca) conferir(ini.includes('App Android 1.0.42'), `${rot}: mostra a versão do app`);
  else conferir(!ini.includes('App'), `${rot}: no navegador não fala de app`);
  await p.screenshot({ path: `${SAIDA}/${rot}-versao-inicio.png` });
  // joga sem conta e abre a pausa pelo botão de menu
  await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  await p.click('#bt-menu');
  await p.waitForSelector('#pausa:not([hidden])');
  await p.locator('#versao-pausa').scrollIntoViewIfNeeded();
  const pau = await p.textContent('#versao-pausa');
  conferir(pau === ini && await p.isVisible('#versao-pausa'), `${rot}: mesma versão na pausa ("${pau}")`);
  await p.screenshot({ path: `${SAIDA}/${rot}-versao-pausa.png` });
  await ctx.close();
}
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros no console');
await b.close();
if (falhas.length || erros.length) process.exit(1);

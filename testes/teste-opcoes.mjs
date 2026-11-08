// Menu de pausa: presets, opções avançadas e tela cheia.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp', URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1024, height: 700 } })).newPage();
const erros = []; p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.addInitScript(() => { window.__semAuto = true; });
await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.click('#bt-sozinho'); await p.waitForTimeout(4000);
await p.click('#bt-menu'); await p.waitForTimeout(300);
for (const v of ['ultra', 'baixa', 'media', 'alta']) { await p.selectOption('#aj-graf', v); await p.waitForTimeout(300); }
await p.click('#mais-graf summary');
await p.selectOption('#aj-sombra', '4096');
await p.uncheck('#aj-nuvens');
await p.fill('#aj-fov', '90'); await p.dispatchEvent('#aj-fov', 'input');
await p.fill('#aj-brilho', '1.3'); await p.dispatchEvent('#aj-brilho', 'input');
await p.selectOption('#aj-fpsmax', '30');
const estado = await p.evaluate(() => { const J = window.__jogo; return { graf: J.ajustes.graf, gopc: J.ajustes.gopc, fov: J.ajustes.fov, brilho: J.ajustes.brilho, fpsMax: J.ajustes.fpsMax, sombra: J.graf.q.sombra, salvo: JSON.parse(localStorage.getItem('pradaria.ajustes')).graf }; });
console.log(JSON.stringify(estado));
await p.screenshot({ path: SAIDA + '/opcoes-pausa.png', fullPage: false });
await p.click('#pausa [data-fechar]'); await p.waitForTimeout(2500);
const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
await p.screenshot({ path: SAIDA + '/opcoes-jogo.png' });
console.log('raf/s', fps, erros.length ? erros.join('\n') : 'sem erros');
await b.close();

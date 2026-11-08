// Gráficos automáticos: palpite inicial, sobe com folga, desce e trava o teto quando engasga, respeita escolha manual.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage();
const erros = []; p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
await p.goto(URL);
// quem já tinha ajustes antigos (sem escolha manual) passa para o automático
await p.evaluate(() => localStorage.setItem('pradaria.ajustes', JSON.stringify({ graf: 'media', qual: 1 })));
await p.reload();
await p.click('#bt-sozinho'); await p.waitForTimeout(500);
if (await p.isVisible('#m-novo')) await p.click('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo.jog, null, { timeout: 20000 }); await p.waitForTimeout(2000);
const st = () => p.evaluate(() => { const J = window.__jogo; return `${J.ajustes.graf} nivel=${J.opcoesGraficas().nome} teto=${J.ajustes.grafTeto} sombra=${J.graf.q.sombra}`; });
console.log('palpite:', await p.evaluate(() => window.__jogo.palpiteGrafico()), '|', await st());
const seg = (fps, n) => p.evaluate(([f, n]) => { const J = window.__jogo; for (let i = 0; i < n; i++) J.vigiarDesempenho(f); }, [fps, n]);
await seg(60, 6); // espera de carregamento
await seg(60, 30); console.log('com folga:', await st());
await seg(30, 4); console.log('engasgou:', await st());
await seg(60, 30); console.log('folga de novo (não passa do teto):', await st());
// escolha manual é respeitada
await p.click('#bt-menu'); await p.selectOption('#aj-graf', 'ultra'); await p.click('#pausa [data-fechar]');
await p.evaluate(() => { window.__jogo.ajustes.auto = false; });
await seg(20, 10); console.log('manual ultra, fps baixo, redução desligada:', await st());
await p.reload(); console.log('depois de recarregar:', await p.evaluate(() => { const a = JSON.parse(localStorage.getItem('pradaria.ajustes')); return a.graf + ' manual=' + a.grafManual; }));
console.log(erros.length ? erros.join('\n') : 'sem erros');
await b.close();

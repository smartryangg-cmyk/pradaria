// Mundo de Guerra no celular: botões de arma não podem cobrir a barra nem os slots. SAIDA=pasta das fotos.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA;
const AP = { 'cel-retrato': { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'cel-deitado': { viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'tablet': { ...devices['Galaxy Tab S4 landscape'] } };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [nome, ap] of Object.entries(AP)) {
  const ctx = await b.newContext(ap); const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  await p.goto((process.env.URL || 'http://localhost:8788') + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1000);
  await p.tap('#bt-sozinho'); await p.waitForTimeout(500);
  await p.locator('#m-novo [data-tipo=guerra]').tap(); await p.waitForTimeout(400);
  if (await p.isVisible('#idade-sim')) { await p.tap('#idade-sim'); await p.waitForTimeout(300); }
  await p.evaluate(() => document.querySelector('#m-novo button[type=submit]').scrollIntoView()); await p.tap('#m-novo button[type=submit]');
  await p.waitForTimeout(500); if (await p.isVisible('#idade-sim')) { await p.tap('#idade-sim'); }
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 40000 }); await p.waitForTimeout(4000);
  if (await p.isVisible('#bt-arsenal')) { await p.tap('#bt-arsenal'); await p.waitForTimeout(800); }
  await p.screenshot({ path: `${SAIDA}/guerra-${nome}.png` });
  const sob = await p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const els = [...document.querySelectorAll('#hud #topo > *, #hud #minimapa, #hud #barra, #hud #botoes-toque, #hud #econ, #hud #botoes-armas, #hud #armas-hud, #hud #procurado, #hud #bt-arsenal, #hud #vida')].filter(vis);
    const out = []; const W = innerWidth, H = innerHeight;
    for (const e of els) { const r = e.getBoundingClientRect(); if (r.left < -1 || r.right > W + 1 || r.bottom > H + 1) out.push('FORA ' + e.id); }
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i].getBoundingClientRect(), c = els[j].getBoundingClientRect(); const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); if (ix > 4 && iy > 4) out.push(`SOBRE ${els[i].id || els[i].className} x ${els[j].id || els[j].className}`); }
    return out;
  });
  console.log(nome, JSON.stringify(sob), erros.join(' | ') || 'sem erros');
  await ctx.close();
}
await b.close();

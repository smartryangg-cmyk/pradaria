// Marca d'água "Ryan Krano": visível, dentro da tela, sem pegar toque nem cobrir botões (menu, criar, jogo, pausa, xadrez, dama, controle; celular, tablet e TV). SAIDA=pasta das fotos.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA, URL = process.env.URL || 'http://localhost:8788';
const AP = { 'cel-pe': { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'cel-deitado': { viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'tablet': { ...devices['Galaxy Tab S4 landscape'] }, 'tv': { viewport: { width: 1920, height: 1080 } } };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [nome, ap] of Object.entries(AP)) {
  const ctx = await b.newContext(ap); const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  const q = nome === 'tv' ? '?tv=1' : '';
  const ver = async (tag) => {
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const m = document.querySelector('.marca-dagua'); if (!m) return { erro: 'sem marca' };
      const a = m.getBoundingClientRect(); const cs = getComputedStyle(m);
      const vis = a.width > 0 && cs.display !== 'none' && a.left >= 0 && a.right <= innerWidth && a.top >= 0 && a.bottom <= innerHeight;
      // botões/campos que encostam na marca
      const sob = [...document.querySelectorAll('button, a, input, select, .slot, #barra, canvas:not(#tela)')].filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); if (!r.width || s.display === 'none' || s.visibility === 'hidden') return false; return Math.min(a.right, r.right) - Math.max(a.left, r.left) > 1 && Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top) > 1; }).map((e) => e.id || e.className || e.tagName);
      return { vis, txt: m.textContent, pos: [a.left, a.top, a.right, a.bottom].map(Math.round), sob: [...new Set(sob)].slice(0, 6), toque: cs.pointerEvents };
    });
    await p.screenshot({ path: `${SAIDA}/marca-${nome}-${tag}.png` });
    console.log(nome, tag, JSON.stringify(r));
  };
  await p.goto(URL + '/' + q + '#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1000);
  await ver('menu');
  await p.click('#bt-sozinho'); await p.waitForTimeout(500);
  if (await p.isVisible('#m-novo')) { await ver('criar'); await p.click('#m-novo button[type=submit]'); }
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 40000 }); await p.waitForTimeout(2500);
  await ver('jogo');
  await p.click('#bt-menu'); await ver('pausa');
  for (const pg of ['xadrez', 'dama', 'controle.html']) { await p.goto(URL + '/' + (pg.includes('.') ? pg : pg + '.html') + q); await p.waitForTimeout(1200); await ver(pg.replace('.html', '')); }
  console.log(nome, 'erros:', erros.join(' | ') || 'nenhum');
  await ctx.close();
}
await b.close();

// Fotos do visual em vários horários e qualidades. SAIDA=pasta  TABLET=1 para tablet.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp', URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext(process.env.TABLET ? { ...devices['Galaxy Tab S4 landscape'] } : { viewport: { width: 1024, height: 640 } });
const p = await ctx.newPage();
await p.addInitScript(() => { window.__semAuto = true; });
const erros = []; p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL);
await p.evaluate((g) => { localStorage.clear(); if (g) localStorage.setItem('pradaria.ajustes', JSON.stringify({ graf: g })); }, process.env.GRAF || '');
await p.reload();
await p.click('#bt-sozinho');
// sem mundo salvo, "Jogar sem conta" abre primeiro a tela de criar mundo
if (await p.isVisible('#m-novo')) await p.click('#m-novo button[type=submit]');
await p.waitForTimeout(7000);
const tag = process.env.TAG || 'x';
for (const [nome, dia, pitch, yaw] of [['meiodia', 0.2, -0.2, 0.8], ['tarde', 0.485, -0.1, 3.3], ['noite', 0.7, -0.05, 2.0]]) {
  await p.evaluate(([d, pi, ya]) => { const J = window.__jogo; J.dia = d; J.jog.pitch = pi; J.jog.yaw = ya; }, [dia, pitch, yaw]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${SAIDA}/${tag}-${nome}.png` });
}
// lampiões de noite
await p.evaluate(() => { const J = window.__jogo, j = J.jog; j.yaw = 0; j.pitch = -0.25;
  const x = Math.floor(j.pos.x), z = Math.floor(j.pos.z);
  for (const [dx, dz] of [[-2, -4], [2, -4], [0, -7]]) { const y = J.mundo.chao(x + dx, z + dz) + 1; J.mundo.definir(x + dx, y, z + dz, 21); } });
await p.waitForTimeout(2500);
await p.screenshot({ path: `${SAIDA}/${tag}-lampiao.png` });
const info = await p.evaluate(() => { const J = window.__jogo; return { graf: J.ajustes.graf, draws: J.renderer.info.render.calls, tri: J.renderer.info.render.triangles, pos: J.jog.pos }; });
const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
console.log(JSON.stringify(info), 'fps', fps);
console.log(erros.length ? erros.slice(0, 10).join('\n') : 'sem erros');
await b.close();

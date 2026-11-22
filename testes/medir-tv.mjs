// Mede o peso da versão da TV numa "TV fraca" simulada: processador 4x mais lento (CDP),
// 2 GB de memória e placa de vídeo de TV barata (Mali-G31). Desenho por software (swiftshader),
// então os quadros por segundo daqui servem para comparar antes e depois, não são os da TV de verdade.
//   URL=http://localhost:8788 MODO=um|dois node testes/medir-tv.mjs
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8788', MODO = process.env.MODO || 'um';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: 'Mozilla/5.0 (Linux; Android 11; Smart TV Build/RTT1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' });
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 });
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const orig = C.prototype.getParameter;
    C.prototype.getParameter = function (p) { return p === 0x9246 || p === 0x1F01 ? 'Mali-G31' : orig.call(this, p); };
  }
});
const p = await ctx.newPage();
let bytes = 0; p.on('response', async (r) => { try { const h = await r.allHeaders(); bytes += +(h['content-length'] || 0) || (await r.body()).length; } catch {} });
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const t0 = Date.now();
await p.goto(URL + (MODO === 'dois' ? '/tv-dupla#teste' : '/tv#teste'));
const metades = async () => MODO === 'dois' ? p.frames().filter((f) => /p=[12]/.test(f.url())) : [p.mainFrame()];
for (let i = 0; i < 100 && (await metades()).length < (MODO === 'dois' ? 2 : 1); i++) await espera(200);
const fs = await metades();
// joga sozinho em cada metade (mundo novo), sem celular
await Promise.all(fs.map(async (f) => {
  await f.waitForSelector('#tv-pronto', { timeout: 60000 });
  await f.waitForFunction(() => !!window.__jogo, null, { timeout: 60000 });
  await f.evaluate(() => { window.__semAuto = !!window.__semAutoForcar; document.querySelector('#tv-pronto').click(); });
  await f.click('#bt-sozinho');
  if (await f.isVisible('#m-novo')) { await f.evaluate(() => { document.querySelector('#n-semente').value = 'pradaria-tv-medida'; }); await f.click('#m-novo button[type=submit]'); }
  await f.waitForFunction(() => window.__jogo.jog && !document.querySelector('#hud').hidden, null, { timeout: 120000 });
}));
const pronto = (Date.now() - t0) / 1000;
// deixa carregar e calibrar sozinho como na TV (20 s), andando para a frente voando
await Promise.all(fs.map((f) => f.evaluate(() => { const J = window.__jogo; J.jog.voando = true; J.jog.pos.y += (window.__subir ?? 4); J.jog.pitch = -0.15; setInterval(() => { J.jog.yaw += 0.01; }, 16); })));
await espera(20000);
if (process.env.FOTO) await p.screenshot({ path: process.env.FOTO });
const res = await Promise.all(fs.map((f) => f.evaluate(() => new Promise((r) => {
  const J = window.__jogo, tempos = []; let ant = performance.now();
  const fim = ant + 6000;
  const q = (t) => { tempos.push(t - ant); ant = t; if (t < fim) requestAnimationFrame(q); else {
    tempos.sort((a, b) => a - b);
    const g = J.renderer.domElement;
    r({ fps: +(tempos.length / 6).toFixed(1), p95ms: Math.round(tempos[Math.floor(tempos.length * 0.95)]),
      nivel: J.opcoesGraficas().nome, px: g.width + 'x' + g.height, draws: J.renderer.info.render.calls, tri: J.renderer.info.render.triangles,
      geo: J.renderer.info.memory.geometries, tex: J.renderer.info.memory.textures, raio: J.mundo.raio, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null });
  } };
  requestAnimationFrame(q);
}))));
if (process.env.PERFIL) {
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); await espera(5000);
  const { profile } = await cdp.send('Profiler.stop');
  const self = new Map(), dt = profile.timeDeltas, cont = new Map();
  profile.samples.forEach((id, i) => cont.set(id, (cont.get(id) || 0) + (dt[i] || 0)));
  for (const n of profile.nodes) { const cf = n.callFrame, k = (cf.functionName || '(anon)') + ' ' + cf.url.split('/').pop() + ':' + cf.lineNumber; self.set(k, (self.get(k) || 0) + (cont.get(n.id) || 0)); }
  const pai = new Map(); for (const n of profile.nodes) for (const c of n.children || []) pai.set(c, n);
  for (const n of profile.nodes) if (n.callFrame.functionName === 'setSize' && (cont.get(n.id) || 0) > 1000) { let x = n, ch = []; while (x && ch.length < 6) { ch.push(x.callFrame.functionName + ':' + x.callFrame.lineNumber + ':' + x.callFrame.url.split('/').pop()); x = pai.get(x.id); } console.log('setSize <-', ch.join(' <- ')); }
  const tot = [...self.values()].reduce((a, b) => a + b, 0);
  console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => (100 * v / tot).toFixed(1) + '% ' + k).join('\n'));
}
console.log(JSON.stringify({ modo: MODO, prontoSeg: +pronto.toFixed(1), baixadoMB: +(bytes / 1048576).toFixed(2), metades: res }));
if (erros.length) console.log('erros:', erros.slice(0, 5).join(' | '));
await b.close();

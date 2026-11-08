// Vilas e aldeões: gera o mundo, voa por cima da vila inicial, conversa com um aldeão e olha à noite.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const URL = process.env.URL || 'http://localhost:8765/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL);
await p.evaluate((sem) => { localStorage.clear(); if (sem) localStorage.setItem('pradaria.local', JSON.stringify({ semente: +sem, edicoes: [] })); }, process.env.SEMENTE || '');
await p.click('#bt-sozinho');
await p.waitForTimeout(4000);
const info = await p.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  const v = mundo.vilas.regiao(0, 0);
  const outras = [];
  for (let rx = -3; rx <= 3; rx++) for (let rz = -3; rz <= 3; rz++) { const w = mundo.vilas.regiao(rx, rz); if (w) outras.push(w.nome + ' (' + w.estilo + ')'); }
  return { vila: v && { nome: v.nome, estilo: v.estilo, x: v.x, z: v.z, y: v.y, ruas: v.ruas.length, casas: v.casas.length, fazendas: v.fazendas.length, raio: Math.round(v.raio) }, jog: jog.pos, outras };
});
console.log(JSON.stringify(info));
// de cima
await p.evaluate(() => { const { jog, mundo } = window.__jogo; const v = mundo.vilas.regiao(0, 0); jog.voando = true; Object.assign(jog.pos, { x: v.x + 0.5, y: v.y + 30, z: v.z + 26 }); jog.yaw = 0; jog.pitch = -0.85; window.__jogo.dia = 0.2; });
await p.waitForTimeout(6000);
await p.screenshot({ path: SAIDA + '/vila-cima.png' });
// no chão, na rua
await p.evaluate(() => { const { jog, mundo } = window.__jogo; const v = mundo.vilas.regiao(0, 0); const r = v.ruas[0]; jog.voando = true; Object.assign(jog.pos, { x: v.x + r.dx * 16 + 0.5, y: v.y + 2.5, z: v.z + r.dz * 16 + 0.5 }); jog.yaw = Math.atan2(r.dx, r.dz); jog.pitch = -0.08; });
await p.waitForTimeout(5000);
const al = await p.evaluate(() => window.__jogo.aldeoes.lista.map((a) => a.nome + '/' + a.oficio + ' ' + a.x.toFixed(1) + ',' + a.y.toFixed(1) + ',' + a.z.toFixed(1)));
console.log('aldeões', al.length, JSON.stringify(al));
await p.screenshot({ path: SAIDA + '/vila-rua.png' });
// conversa com o aldeão mais perto, colocado na frente da câmera
await p.evaluate(() => {
  const { jog, aldeoes } = window.__jogo;
  const a = aldeoes.lista[0];
  a.x = jog.pos.x + Math.sin(jog.yaw) * -3; a.z = jog.pos.z - Math.cos(jog.yaw) * 3;
  a.caminho = []; a.espera = 30;
  aldeoes.conversar(a, jog, false);
});
await p.evaluate(() => { const { jog } = window.__jogo; jog.pitch = -0.1; });
await p.waitForTimeout(800);
await p.screenshot({ path: SAIDA + '/vila-conversa.png' });
// noite
await p.evaluate(() => { const { jog, mundo } = window.__jogo; const v = mundo.vilas.regiao(0, 0); Object.assign(jog.pos, { x: v.x + 12.5, y: v.y + 9, z: v.z + 12.5 }); jog.yaw = Math.PI * 0.75; jog.pitch = -0.35; window.__jogo.dia = 0.8; });
await p.waitForTimeout(6000);
await p.screenshot({ path: SAIDA + '/vila-noite.png' });
const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
console.log('fps', fps);
console.log(erros.join('\n') || 'sem erros');
await b.close();

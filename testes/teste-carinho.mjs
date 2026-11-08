// Segurar o toque num bicho repete o carinho a cada 260 ms: ele deve pular só um pouquinho, nunca sair voando.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
await p.goto('http://localhost:8788/#teste');
await p.evaluate(() => localStorage.clear());
await p.click('#bt-sozinho');
await p.waitForTimeout(3000);
const r = await p.evaluate(async () => {
  const { jog, bichos, mundo } = window.__jogo;
  const x = Math.floor(jog.pos.x) + 0.5, z = Math.floor(jog.pos.z) - 4.5;
  const piso = mundo.chao(Math.floor(x), Math.floor(z)) + 1;
  const bb = bichos.criar('ovelha', x, piso, z); bb.timer = 99; bb.andando = false;
  await new Promise((r) => setTimeout(r, 800));
  const base = bb.y; let max = 0;
  const t = setInterval(() => bichos.carinho(bb), 260);
  const fim = performance.now() + 3000;
  while (performance.now() < fim) { max = Math.max(max, bb.y - base); await new Promise((r) => requestAnimationFrame(r)); }
  clearInterval(t);
  return { max };
});
console.log('altura máxima do pulo:', r.max.toFixed(2));
if (r.max > 0.6) { console.log('FALHOU: bicho voou'); process.exitCode = 1; } else console.log('ok');
console.log(erros.join('\n') || 'sem erros');
await b.close();

import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
await p.goto('http://localhost:8788/#teste');
await p.evaluate(() => localStorage.clear());
await p.click('#bt-sozinho');
// sem mundo salvo, "Jogar sem conta" abre primeiro a tela de criar mundo
if (await p.isVisible('#m-novo')) await p.click('#m-novo button[type=submit]');
await p.waitForTimeout(3000);
// cria um de cada bicho na frente do jogador
await p.evaluate(() => {
  const { jog, bichos, mundo } = window.__jogo;
  jog.voando = true; jog.yaw = 0; jog.pitch = -0.25;
  const esp = ['ovelha', 'porquinho', 'galinha', 'vaca', 'cachorro', 'capivara', 'coelho'];
  esp.forEach((e, i) => { const x = Math.floor(jog.pos.x) - 6 + i * 2 + 0.5, z = Math.floor(jog.pos.z) - 6.5; const y = mundo.chao(Math.floor(x), Math.floor(z)) + 1; const bb = bichos.criar(e, x, y, z); bb.dir = Math.PI; bb.timer = 99; bb.andando = false; });
  jog.pos.y = mundo.chao(Math.floor(jog.pos.x), Math.floor(jog.pos.z) - 6) + 2.2;
});
await p.waitForTimeout(1500);
await p.evaluate(() => { const { bichos } = window.__jogo; bichos.carinho(bichos.lista[bichos.lista.length - 3]); });
await p.waitForTimeout(400);
await p.screenshot({ path: '' + (process.env.SAIDA || '/tmp') + '/bichos.png' });
console.log(erros.join('\n') || 'sem erros');
await b.close();

// Grama como no clássico, jogando pela tela do tablet: terra colocada do lado da grama (com céu aberto em cima)
// fica verde sozinha depois de um tempinho; terra coberta por um bloco não fica verde.
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-grama.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const GRAMA = 1, TERRA = 2, PEDRA = 3;
const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await p.waitForTimeout(4000);
// um gramado plano com dois buracos; depois de pôr terra, um deles ganha teto de pedra
const base = await p.evaluate(([G, P]) => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = m.chao(x0, z0);
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) { m.definir(x0 + x, y0, z0 + z, G); for (let y = 1; y <= 6; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  m.definir(x0 + 2, y0, z0, 0); m.definir(x0 - 2, y0, z0, 0);
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0;
  J.mercado.e.itens[2] = 4; J.mercado.recebeu(J.mercado.e); J.barra[0] = 2; J.slot = 0; J.dia = 0.3;
  return [x0, y0, z0];
}, [GRAMA, PEDRA]);
const [x0, y0, z0] = base;
async function porTerra(x, z) {
  // fica na beirada do buraco (de pé na grama do lado) para enxergar o fundo
  await p.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.y = y; j.pos.z = z; j.vel.x = j.vel.y = j.vel.z = 0; }, [x + (x > x0 ? -0.62 : 1.62), y0 + 1, z + 0.5]);
  await p.waitForTimeout(300);
  // mira no fundo do buraco (o topo da pedra) e toca: a terra vai para o buraco
  await p.evaluate(([x, y, z]) => { const J = window.__jogo, j = J.jog, c = J.camera, dx = x - c.position.x, dz = z - c.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y - c.position.y, Math.hypot(dx, dz)); }, [x + 0.5, y0 + 0.001, z + 0.5]);
  await p.waitForTimeout(250);
  const m = await p.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 })); await p.touchscreen.tap(m.x, m.y);
  await p.waitForTimeout(400);
}
// buraco aberto: mira no fundo (bloco embaixo do buraco) e põe terra em cima dele, preenchendo o buraco
await p.evaluate(([x, y, z]) => window.__jogo.mundo.definir(x, y - 1, z, 3), [x0 + 2, y0, z0]);
await p.evaluate(([x, y, z]) => window.__jogo.mundo.definir(x, y - 1, z, 3), [x0 - 2, y0, z0]);
await porTerra(x0 + 2, z0);
await porTerra(x0 - 2, z0);
const logo = await p.evaluate(([x0, y0, z0]) => [window.__jogo.mundo.bloco(x0 + 2, y0, z0), window.__jogo.mundo.bloco(x0 - 2, y0, z0)], base);
ok(logo[0] === TERRA && logo[1] === TERRA, `pôs terra nos dois buracos com o toque (${logo})`);
// o segundo ganha um teto de pedra logo em cima (sem luz do céu)
await p.evaluate(([x0, y0, z0]) => window.__jogo.mundo.definir(x0 - 2, y0 + 1, z0, 3), base);
await p.screenshot({ path: SAIDA + '/grama-1-terra.png' });
await p.waitForTimeout(21000);
const depois = await p.evaluate(([x0, y0, z0]) => [window.__jogo.mundo.bloco(x0 + 2, y0, z0), window.__jogo.mundo.bloco(x0 - 2, y0, z0)], base);
ok(depois[0] === GRAMA, `a terra ao lado da grama, com céu em cima, ficou verde sozinha (${depois[0]})`);
ok(depois[1] === TERRA, `a terra embaixo do teto de pedra continua terra (${depois[1]})`);
await p.screenshot({ path: SAIDA + '/grama-2-verde.png' });
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

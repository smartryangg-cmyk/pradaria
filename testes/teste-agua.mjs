// Testa a água que corre: espalha, cai, seca, vira fonte infinita e aparece na tela.
// Uso: (cd public && python3 -m http.server 8765) e depois: node testes/teste-agua.mjs
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
const erros = [];
p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto('http://localhost:8765/#teste');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForTimeout(600);
await p.click('#bt-sozinho');
await p.waitForTimeout(3000);

// monta uma "mesa" de pedra no céu, perto do jogador
const r = await p.evaluate(async () => {
  const { mundo, jog } = window.__jogo;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const X = Math.floor(jog.pos.x) + 3, Z = Math.floor(jog.pos.z) + 3, Y = 56;
  jog.voando = true; jog.pos.y = Y + 6; jog.pitch = -0.9;
  for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) mundo.definir(X + dx, Y, Z + dz, 3);
  mundo.definir(X, Y + 1, Z, 5); // fonte no meio
  await espera(2600);
  const niv = (x, z, y = Y + 1) => mundo.bloco(x, y, z);
  const espalhou = [0, 1, 2, 3, 7, 8].map((d) => niv(X + d, Z));
  // tira a fonte: tudo seca
  mundo.definir(X, Y + 1, Z, 0);
  await espera(2600);
  const secou = [0, 1, 3, 7].map((d) => niv(X + d, Z));
  // cachoeira: fonte na beirada da mesa cai até o chão
  mundo.definir(X + 10, Y + 1, Z, 5);
  await espera(4000);
  const cachoeira = [Y, Y - 1, Y - 3].map((y) => mundo.bloco(X + 11, y, Z));
  mundo.definir(X + 10, Y + 1, Z, 0);
  // fonte infinita: valeta de 3 com fontes nas pontas
  for (let d = -1; d <= 3; d++) { mundo.definir(X + d, Y + 1, Z - 3, 3); mundo.definir(X + d, Y + 1, Z - 5, 3); }
  mundo.definir(X - 1, Y + 1, Z - 4, 3); mundo.definir(X + 3, Y + 1, Z - 4, 3);
  mundo.definir(X, Y + 1, Z - 4, 5); mundo.definir(X + 2, Y + 1, Z - 4, 5);
  await espera(1200);
  const infinita = mundo.bloco(X + 1, Y + 1, Z - 4);
  // correnteza: perto da fonte a água empurra para longe dela
  mundo.definir(X, Y + 1, Z + 4, 5);
  await espera(1500);
  const corr = mundo.correnteza(X + 2, Y + 1, Z + 4);
  return { espalhou, secou, cachoeira, infinita, corr, edicoes: mundo.listarEdicoes().filter((e) => e[3] >= 23).length };
});
console.log(JSON.stringify(r));
await p.waitForTimeout(1500);
await p.screenshot({ path: SAIDA + '/agua.png' });
const ok = r.espalhou.join() === '5,23,24,25,29,0' && r.secou.every((v) => v === 0) && r.cachoeira.every((v) => v === 30 || v === 5 || (v >= 23 && v <= 29))
  && r.infinita === 5 && r.corr[0] > 0.5 && r.edicoes === 0 && !erros.length;
console.log(ok ? 'OK' : 'FALHOU', erros.slice(0, 5).join('\n'));
await b.close();
process.exit(ok ? 0 : 1);

// Testa a engenharia: alavanca + fio acendem lâmpada, portão abre, botão solta, sensor de noite,
// ventilador levanta, esteira leva, trampolim quica, nada derivado vai para as edições salvas.
// Uso: (cd public && python3 -m http.server 8765) e depois: node testes/teste-energia.mjs
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
await p.waitForTimeout(400);
if (await p.isVisible('#m-novo')) await p.click('#m-novo button[type=submit]'); // mundo novo: opções padrão
await p.waitForTimeout(3000);

const r = await p.evaluate(async () => {
  const { mundo, jog } = window.__jogo;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const X = Math.floor(jog.pos.x) + 2, Z = Math.floor(jog.pos.z) - 6, Y = 50;
  window.__jogo.dia = 0.25;
  jog.voando = true; jog.pos.x = X + 0.5; jog.pos.z = Z + 9; jog.pos.y = Y + 3; jog.pitch = -0.35; jog.yaw = 0;
  for (let dx = -3; dx <= 12; dx++) for (let dz = -3; dz <= 12; dz++) mundo.definir(X + dx, Y, Z + dz, 3);
  for (let dx = -3; dx <= 12; dx++) for (let dz = -3; dz <= 12; dz++) for (let dy = 1; dy < 8; dy++) mundo.definir(X + dx, Y + dy, Z + dz, 0);
  // alavanca -> fio (com degrau) -> lâmpada + portão
  mundo.definir(X, Y + 1, Z, 102);
  for (let d = 1; d <= 4; d++) mundo.definir(X + d, Y + 1, Z, 100);
  mundo.definir(X + 5, Y + 1, Z, 3); mundo.definir(X + 5, Y + 2, Z, 100); // sobe um degrau
  mundo.definir(X + 6, Y + 1, Z, 3); mundo.definir(X + 6, Y + 2, Z, 100);
  mundo.definir(X + 7, Y + 2, Z, 108); mundo.definir(X + 7, Y + 3, Z, 110);
  await espera(400);
  const antes = [mundo.bloco(X + 2, Y + 1, Z), mundo.bloco(X + 7, Y + 2, Z), mundo.bloco(X + 7, Y + 3, Z)];
  mundo.definir(X, Y + 1, Z, 103); // liga
  await espera(400);
  const ligado = [mundo.bloco(X + 2, Y + 1, Z), mundo.bloco(X + 5, Y + 2, Z), mundo.bloco(X + 7, Y + 2, Z), mundo.bloco(X + 7, Y + 3, Z)];
  // corta o fio: apaga
  mundo.definir(X + 3, Y + 1, Z, 0);
  await espera(400);
  const cortado = [mundo.bloco(X + 2, Y + 1, Z), mundo.bloco(X + 7, Y + 2, Z)];
  mundo.definir(X + 3, Y + 1, Z, 100);
  await espera(400);
  const religado = mundo.bloco(X + 7, Y + 2, Z);
  // sensor de noite com lâmpada
  mundo.definir(X, Y + 1, Z + 3, 118); mundo.definir(X + 1, Y + 1, Z + 3, 108);
  await espera(400);
  const diaL = mundo.bloco(X + 1, Y + 1, Z + 3);
  window.__jogo.dia = 0.75;
  await espera(700);
  const noiteL = mundo.bloco(X + 1, Y + 1, Z + 3);
  window.__jogo.dia = 0.25;
  // edições salvas: só peças base + alavanca ligada
  const salvas = mundo.listarEdicoes().filter((e) => e[3] >= 100).map((e) => e[3]);
  const derivadoSalvo = salvas.some((v) => [101, 109, 111, 113, 115, 117, 119, 121].includes(v));
  // trampolim e esteira e ventilador
  mundo.definir(X + 10, Y + 1, Z + 8, 122);
  jog.voando = false; jog.pos.x = X + 10.5; jog.pos.z = Z + 8.5; jog.pos.y = Y + 4; jog.vel.y = 0;
  let maxY = 0; const t0 = performance.now();
  while (performance.now() - t0 < 2000) { await espera(30); maxY = Math.max(maxY, jog.pos.y); }
  const quica = maxY - (Y + 2);
  mundo.definir(X + 10, Y + 1, Z + 8, 0);
  // esteira para +x
  for (let d = 0; d < 6; d++) mundo.definir(X + d, Y + 1, Z + 10, 123);
  jog.pos.x = X + 0.5; jog.pos.z = Z + 10.5; jog.pos.y = Y + 2.05; jog.vel.x = jog.vel.z = 0;
  await espera(1200);
  const andouEsteira = jog.pos.x - (X + 0.5);
  // ventilador ligado por alavanca
  mundo.definir(X + 10, Y + 1, Z + 2, 112); mundo.definir(X + 11, Y + 1, Z + 2, 103);
  await espera(300);
  const vent = mundo.bloco(X + 10, Y + 1, Z + 2);
  jog.pos.x = X + 10.5; jog.pos.z = Z + 2.5; jog.pos.y = Y + 2.05; jog.vel.y = 0;
  await espera(2500);
  const subiu = jog.pos.y - (Y + 2);
  // sino e confete
  let eventos = [];
  const orig = mundo.energia.aoEvento;
  mundo.energia.aoEvento = (t, x, y, z) => { eventos.push(t); orig(t, x, y, z); };
  mundo.definir(X + 2, Y + 1, Z + 6, 104); mundo.definir(X + 3, Y + 1, Z + 6, 114); mundo.definir(X + 1, Y + 1, Z + 6, 116);
  await espera(300);
  jog.pos.x = X + 2.5; jog.pos.z = Z + 9; jog.pos.y = Y + 2; jog.voando = true;
  window.__jogo.usarBloco = null;
  mundo.definir(X + 2, Y + 1, Z + 6, 105);
  await espera(400);
  const sinoLig = mundo.bloco(X + 3, Y + 1, Z + 6);
  return { antes, ligado, cortado, religado, diaL, noiteL, derivadoSalvo, quica, andouEsteira, vent, subiu, eventos, sinoLig };
});
console.log(JSON.stringify(r));
await p.waitForTimeout(500);
// mostra o inventário de engenharia e uma foto da obra
await p.evaluate(() => { const { jog } = window.__jogo; jog.voando = true; });
await p.screenshot({ path: SAIDA + '/energia.png' });
await p.keyboard.press('KeyE');
await p.waitForTimeout(300);
await p.click('[data-aba="maquinas"]');
await p.waitForTimeout(300);
await p.screenshot({ path: SAIDA + '/energia-inventario.png' });
const ok = r.antes.join() === '100,108,110' && r.ligado.join() === '101,101,109,111' && r.cortado.join() === '101,108'
  && r.religado === 109 && r.diaL === 108 && r.noiteL === 109 && !r.derivadoSalvo && r.quica > 1.5 && r.andouEsteira > 1
  && r.vent === 113 && r.subiu > 4 && r.eventos.includes(114) && r.eventos.includes(116) && r.sinoLig === 115 && !erros.length;
console.log(ok ? 'OK' : 'FALHOU', erros.slice(0, 5).join('\n'));
await b.close();
process.exit(ok ? 0 : 1);

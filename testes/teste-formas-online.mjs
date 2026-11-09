// Multijogador com formas: Ana coloca (pelo jogo, mirando) rampa, cerca, bola e cúpula; Beto vê as mesmas
// formas (com a rampa virada igual), sobe na rampa dele e depois Beto quebra a bola e Ana vê sumir.
// Uso: npm run dev:sala e npm run dev, depois: node testes/teste-formas-online.mjs
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = 'http://localhost:8788/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
async function jogador(nome) {
  const p = await (await b.newContext({ viewport: { width: 1000, height: 620 } })).newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 });
  return p;
}
const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Formas');
if (await a.getAttribute('[data-opcao=sobrevivencia]', 'aria-pressed') === 'true') await a.click('[data-opcao=sobrevivencia]'); // blocos à vontade
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2000);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(1500);
const base = await a.evaluate(() => { const { jog } = window.__jogo; return { X: Math.floor(jog.pos.x), Y: 61, Z: Math.floor(jog.pos.z) }; });
// plataforma no alto e ar em cima (a sala aceita até a altura 63 e poucas edições por segundo: vai em lotes)
for (const [y, b] of [[0, 3], [1, 0], [2, 0]]) for (let dz = -5; dz <= -1; dz++) {
  await a.evaluate(({ X, Y, Z, y, b, dz }) => { const { mundo, comoJogador } = window.__jogo; for (let dx = 0; dx < 4; dx++) comoJogador(() => mundo.definir(X + dx, Y + y, Z + dz, b)); }, { ...base, y, b, dz });
  await a.waitForTimeout(400);
}
await a.waitForTimeout(1000);
// Ana escolhe na aba Formas e coloca mirando o chão (usar = clique direito/toque)
const colocar = async (indice, x) => {
  await a.evaluate(({ x, base }) => { const { jog } = window.__jogo; jog.voando = true; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.pos.x = x + 0.5; jog.pos.z = base.Z - 0.5; jog.pos.y = base.Y + 1.2; jog.yaw = 0; }, { x, base });
  await a.waitForTimeout(250);
  await a.evaluate(({ base }) => { const j = window.__jogo; const c = j.camera.position; j.jog.pitch = Math.atan2(base.Y + 0.02 - c.y, 2.2); }, { base });
  await a.click('.slot.mais'); await a.waitForTimeout(200); await a.click('[data-aba="formas"]'); await a.waitForTimeout(200);
  await a.click(`#grade button:nth-child(${indice + 1})`); await a.waitForTimeout(200);
  await a.evaluate(() => window.__jogo.usar(null)); await a.waitForTimeout(300);
};
await colocar(11, base.X);      // rampa
await colocar(4, base.X + 1);   // cerca
await colocar(7, base.X + 2);   // bola
await colocar(8, base.X + 3);   // cúpula
await a.waitForTimeout(1500);
const ler = (p) => p.evaluate(({ X, Y, Z }) => { const m = window.__jogo.mundo; const r = []; for (let dx = 0; dx < 4; dx++) { let v = 0; for (let dz = -5; dz <= -1; dz++) { const q = m.bloco(X + dx, Y + 1, Z + dz); if (q) { v = [q, Z + dz]; break; } } r.push(v); } return r; }, base);
const naAna = await ler(a), noBeto = await ler(bb);
console.log('Ana:', JSON.stringify(naAna), '| Beto:', JSON.stringify(noBeto));
const iguais = JSON.stringify(naAna) === JSON.stringify(noBeto);
const tipos = naAna.map((v) => v && v[0]);
const ok1 = iguais && tipos[0] >= 91 && tipos[0] <= 94 && tipos[1] === 84 && tipos[2] === 87 && tipos[3] === 88;
console.log(ok1 ? 'OK   Beto vê as 4 formas que a Ana colocou, iguais (rampa virada igual)' : 'FALHA formas diferentes');
// Beto sobe na rampa (anda com W)
await bb.evaluate(({ X, Y, v }) => { const { jog } = window.__jogo; jog.voando = false; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.pos.x = X + 0.5; jog.pos.z = v[1] + 1.6; jog.pos.y = Y + 1; jog.yaw = 0; }, { ...base, v: naAna[0] });
await bb.waitForTimeout(500);
console.log('plataforma Ana:', await a.evaluate(({ X, Y, Z }) => { const m = window.__jogo.mundo; const r = []; for (let dz = -5; dz <= -1; dz++) r.push(m.bloco(X, Y, Z + dz)); return JSON.stringify([r, Z]); }, base));
console.log('debaixo do Beto:', await bb.evaluate(({ X, Y, v }) => { const m = window.__jogo.mundo; const r = []; for (let dz = 0; dz <= 4; dz++) r.push(m.bloco(X, Y, v[1] + dz)); return JSON.stringify([r, window.__jogo.jog.pos, window.__jogo.jog.voando]); }, { ...base, v: naAna[0] }));
await bb.keyboard.down('KeyW');
let maxY = 0;
const traj = [];
for (let i = 0; i < 30; i++) { await bb.waitForTimeout(100); const q = await bb.evaluate(() => { const p = window.__jogo.jog.pos; return [p.y, p.z]; }); traj.push(q.map((v) => v.toFixed(2)).join('/')); maxY = Math.max(maxY, q[0]); }
console.log('Beto (y/z):', traj.join(' '));
await bb.keyboard.up('KeyW');
const ok2 = maxY - base.Y > 1.4;
console.log((ok2 ? 'OK  ' : 'FALHA') + ' Beto subiu andando na rampa da Ana (altura ' + (maxY - base.Y).toFixed(2) + ')');
// visão do Beto
await bb.evaluate(({ X, Y, Z }) => { const { jog } = window.__jogo; jog.voando = true; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.pos.x = X + 1.6; jog.pos.z = Z + 0.5; jog.pos.y = Y + 1.6; jog.yaw = 0; jog.pitch = -0.35; window.__jogo.dia = 0.3; }, base);
await bb.waitForTimeout(1500);
await bb.screenshot({ path: SAIDA + '/formas-online-beto.png' });
// Beto quebra a bola (com toques de verdade, mirando)
const vb = naAna[2];
await bb.evaluate(({ X, Y, v }) => { const { jog } = window.__jogo; jog.voando = true; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.pos.x = X + 2.5; jog.pos.z = v[1] + 2.2; jog.pos.y = Y + 0.6; jog.yaw = 0; }, { ...base, v: vb });
await bb.waitForTimeout(300);
await bb.evaluate(({ X, Y, v }) => { const j = window.__jogo; const c = j.camera.position; j.jog.pitch = Math.atan2(Y + 1.5 - c.y, Math.hypot(X + 2.5 - c.x, v[1] + 0.5 - c.z)); }, { ...base, v: vb });
await bb.waitForTimeout(300);
for (let i = 0; i < 6; i++) { await bb.evaluate(() => window.__jogo.quebrar(null)); await bb.waitForTimeout(200); }
await a.waitForTimeout(1500);
const bolaAna = await a.evaluate(({ X, Y, v }) => window.__jogo.mundo.bloco(X + 2, Y + 1, v[1]), { ...base, v: vb });
const ok3 = bolaAna === 0;
console.log((ok3 ? 'OK  ' : 'FALHA') + ' Beto quebrou a bola e ela sumiu para a Ana');
const ok = ok1 && ok2 && ok3 && !erros.length;
console.log(ok ? 'TUDO CERTO' : 'FALHOU', erros.slice(0, 5).join('\n'));
await b.close();
process.exit(ok ? 0 : 1);

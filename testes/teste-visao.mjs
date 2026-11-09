// Câmera em 3ª pessoa: alterna com R e pelo botão, mostra o boneco animado, não atravessa paredes
// e a mira continua quebrando/colocando bloco no lugar certo.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const toque = process.argv[2] === 'toque';
const ctx = await b.newContext({ viewport: { width: 1024, height: 640 }, hasTouch: toque, isMobile: toque });
const p = await ctx.newPage();
const erros = [];
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
await p.goto((process.env.URL || 'http://localhost:8788') + '/#teste');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForTimeout(500);
await p.click('#bt-sozinho');
await p.waitForSelector('#m-novo:not([hidden])');
await p.click('#m-novo button[type=submit]');
await p.waitForTimeout(5000);
let falhas = 0;
const ok = (c, t) => { console.log(c ? 'OK  ' : 'FALHA', t); if (!c) falhas++; };
const est = () => p.evaluate(() => {
  const J = window.__jogo, c = J.camera.position, j = J.jog;
  return { cam: [c.x, c.y, c.z], jog: [j.pos.x, j.pos.y, j.pos.z], yaw: j.yaw, modo: J.visao.modo, dist: J.visao.dist, vis: !!(J.visao.boneco && J.visao.boneco.grupo.parent && J.visao.boneco.grupo.visible) };
});
// abre um espaço plano: chão de pedra 9x9 e ar em cima, longe de árvores
await p.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog;
  const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.floor(j.pos.y);
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) {
    m.definir(x0 + x, y0 - 1, z0 + z, 3);
    for (let y = 0; y < 8; y++) m.definir(x0 + x, y0 + y, z0 + z, 0);
  }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.yaw = 0; j.pitch = 0; J.dia = 0.3;
  window.__base = [x0, y0, z0];
});
await p.waitForTimeout(800);
let e = await est();
ok(e.modo === 0 && !e.vis && Math.abs(e.cam[1] - e.jog[1] - 1.55) < 0.01, '1ª pessoa: câmera nos olhos, sem boneco');
await p.screenshot({ path: `${SAIDA}/visao-0-olhos.png` });
if (toque) await p.tap('#bt-visao'); else await p.keyboard.press('KeyR');
await p.waitForTimeout(900);
e = await est();
const dx = e.cam[0] - e.jog[0], dz = e.cam[2] - e.jog[2];
ok(e.modo === 1 && e.vis && dz > 3 && Math.abs(dx - 0.6) < 0.2, `de trás: câmera atrás (dz ${dz.toFixed(2)}, dx ${dx.toFixed(2)}) e boneco visível`);
await p.screenshot({ path: `${SAIDA}/visao-1-atras.png` });
// anda: as pernas balançam
await p.keyboard.down('KeyW'); await p.waitForTimeout(500);
let pernas = [0];
for (let i = 0; i < 6; i++) { const r = await p.evaluate(() => window.__jogo.visao.boneco.membros.map((m) => +m.rotation.x.toFixed(2))); if (Math.abs(r[2]) > Math.abs(pernas[2] || 0)) pernas = r; await p.waitForTimeout(37); }
await p.screenshot({ path: `${SAIDA}/visao-1-andando.png` });
await p.keyboard.up('KeyW');
ok(pernas.some((r) => Math.abs(r) > 0.2), 'andando: braços e pernas mexem ' + pernas.join(','));
// pula
// (o primeiro quadro do pulo é o impulso, agachadinho; depois vem a pose do ar)
await p.keyboard.down('Space');
let pulo = [];
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(40);
  pulo = await p.evaluate(() => window.__jogo.visao.boneco.membros.map((m) => +m.rotation.x.toFixed(2)));
  if (pulo[2] < -0.3 && pulo[3] > 0.2) break;
}
await p.keyboard.up('Space');
ok(pulo[2] < -0.3 && pulo[3] > 0.2, 'pulando: pernas abertas ' + pulo.join(','));
await p.waitForTimeout(800);
// volta ao centro e testa a mira: quebra o bloco na frente, olhando para baixo
await p.evaluate(() => { const J = window.__jogo, j = J.jog, [x0, y0, z0] = window.__base; j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.vel.x = j.vel.z = 0; j.yaw = 0; j.pitch = -0.6; J.mundo.definir(x0, y0, z0 - 2, 2); });
await p.waitForTimeout(400);
// o bloco que está no meio da tela (raio puro da câmera) é o que tem que quebrar
const alvo = await p.evaluate(() => {
  const J = window.__jogo, c = J.camera, d = c.getWorldDirection(new c.position.constructor());
  const h = J.mundo.raycast(c.position, d, 12);
  const cont = [J.mundo.bloco(h.x, h.y, h.z)];
  for (let i = 0; i < 30 && J.mundo.bloco(h.x, h.y, h.z); i++) J.quebrar(null);
  cont.push(J.mundo.bloco(h.x, h.y, h.z));
  window.__alvo = h;
  return cont;
});
const golpe = await p.evaluate(() => window.__jogo.visao.golpe);
ok(alvo[0] > 0 && alvo[1] === 0, 'de trás: quebrou o bloco que está no meio da mira ' + alvo.join(' -> '));
ok(golpe < 1, 'braço bateu (golpe ' + golpe.toFixed(2) + ')');
// e coloca um bloco no mesmo lugar (botão direito)
const pos = await p.evaluate(() => { const h = window.__alvo; window.__jogo.usar(null); return window.__jogo.mundo.bloco(h.x, h.y, h.z); });
ok(pos > 0, 'de trás: colocou bloco onde a mira aponta (' + pos + ')');
// toque na tela (tablet): quebra o bloco que o dedo tocou
const dedo = await p.evaluate(() => {
  const J = window.__jogo, [x0, y0, z0] = window.__base, m = J.mundo;
  m.definir(x0 - 1, y0, z0 - 3, 2);
  const v = J.camera.position.clone().set(x0 - 0.5, y0 + 0.5, z0 - 2.5).project(J.camera);
  const pt = { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  for (let i = 0; i < 30 && m.bloco(x0 - 1, y0, z0 - 3); i++) J.quebrar(pt);
  return m.bloco(x0 - 1, y0, z0 - 3);
});
ok(dedo === 0, 'de trás: tocar no bloco com o dedo quebra ele');
// parede atrás: a câmera chega perto e não atravessa
await p.evaluate(() => { const J = window.__jogo, j = J.jog, [x0, y0, z0] = window.__base; j.pitch = 0; for (let x = -3; x <= 3; x++) for (let y = 0; y < 5; y++) J.mundo.definir(x0 + x, y0 + y, z0 + 2, 3); });
await p.waitForTimeout(600);
e = await est();
const bl = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(Math.floor(x), Math.floor(y), Math.floor(z)), e.cam);
ok(e.cam[2] < e.jog[2] + 2 - 0.25 && bl === 0, `parede atrás: câmera em z ${(e.cam[2] - e.jog[2]).toFixed(2)} (< 1.75), bloco da câmera = ${bl}`);
await p.screenshot({ path: `${SAIDA}/visao-1-parede.png` });
// de frente
await p.evaluate(() => { const J = window.__jogo, [x0, y0, z0] = window.__base; for (let x = -3; x <= 3; x++) for (let y = 0; y < 5; y++) J.mundo.definir(x0 + x, y0 + y, z0 + 2, 0); });
if (toque) await p.tap('#bt-visao'); else await p.click('#bt-visao');
await p.waitForTimeout(900);
e = await est();
ok(e.modo === 2 && e.vis && e.jog[2] - e.cam[2] > 3, `de frente: câmera na frente (dz ${(e.jog[2] - e.cam[2]).toFixed(2)})`);
const mira = await p.evaluate(() => getComputedStyle(document.querySelector('#mira')).display);
ok(mira === 'none', 'de frente: mira some');
await p.evaluate(() => { window.__jogo.dia = 0.3; });
await p.waitForTimeout(300);
await p.screenshot({ path: `${SAIDA}/visao-2-frente.png` });
// voando
await p.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.y += 2; });
await p.waitForTimeout(300);
const voo = await p.evaluate(() => window.__jogo.visao.boneco.membros.map((m) => +m.rotation.z.toFixed(2)));
ok(voo[0] < -1 && voo[1] > 1, 'voando: braços abertos ' + voo.join(','));
await p.screenshot({ path: `${SAIDA}/visao-2-voando.png` });
await p.evaluate(() => { const j = window.__jogo.jog; j.voando = false; });
// salva a escolha
const salvo = await p.evaluate(() => JSON.parse(localStorage.getItem('pradaria.ajustes')).visao);
ok(salvo === 2, 'escolha salva nos ajustes');
// volta para 1ª pessoa
await p.keyboard.press('KeyR');
await p.waitForTimeout(300);
e = await est();
ok(e.modo === 0 && !e.vis, 'volta para os olhos e o boneco some');
// veículo: a câmera do veículo continua mandando
await p.keyboard.press('KeyR');
await p.evaluate(() => window.__jogo.garagem.novo('carro', 0));
await p.waitForTimeout(600);
const v = await p.evaluate(() => ({ dentro: !!window.__jogo.garagem.dentro, meu: !!(window.__jogo.visao.boneco.grupo.parent) }));
ok(v.dentro && !v.meu, 'no carro: câmera do veículo e sem boneco duplicado');
await p.screenshot({ path: `${SAIDA}/visao-carro.png` });
await p.keyboard.press('KeyV');
await p.waitForTimeout(500);
e = await est();
ok(e.modo === 1 && e.vis, 'saiu do carro: volta para a visão de trás');
console.log('erros:', erros.length ? erros : 'nenhum');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

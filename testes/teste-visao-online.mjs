// 3ª pessoa no online, jogando de verdade: Ana (PC) anda, pula e bate num bloco com o mouse;
// Beto (tablet, toque) liga a câmera de trás pelo botão e vê a Ana virada para o lado certo e animada.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
let falhas = 0;
const ok = (c, t) => { console.log(c ? 'OK  ' : 'FALHA', t); if (!c) falhas++; };
async function jogador(nome, tablet) {
  const ctx = await b.newContext(tablet ? { ...devices['Galaxy Tab S4 landscape'] } : { viewport: { width: 1024, height: 640 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p[tablet ? 'tap' : 'click']('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await p[tablet ? 'tap' : 'click']('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Fazendinha'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.tap('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.tap('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(1500);
// Beto fica 5 blocos ao norte da Ana, olhando para ela; Ana olha para o norte (para o Beto)
// chão plano de pedra para os dois (sem árvore no caminho); a edição vai pela rede
const pa = await a.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog;
  const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.floor(j.pos.y);
  for (let x = -4; x <= 4; x++) for (let z = -10; z <= 3; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); for (let y = 0; y < 5; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.yaw = 0; j.pitch = 0;
  return { x: j.pos.x, y: j.pos.y, z: j.pos.z };
});
await a.waitForTimeout(800);
await bb.evaluate((pa) => { const J = window.__jogo, j = J.jog; j.pos.x = pa.x; j.pos.z = pa.z - 5; j.pos.y = pa.y; j.yaw = Math.PI; j.pitch = -0.1; J.dia = 0.3; }, pa);
await a.evaluate(() => { window.__jogo.dia = 0.3; });
// gravador no navegador do Beto: guarda o que ele viu no boneco da Ana a cada quadro
const gravar = () => bb.evaluate(() => { const r = window.__rec = { golpe: 1, bracoZ: 0, perna: 0, acao: 0 }; const f = () => { const o = window.__jogo.outrosLista[0]; if (o) { r.golpe = Math.min(r.golpe, o.golpe ?? 1); r.bracoZ = Math.min(r.bracoZ, o.membros[0].rotation.z); r.perna = Math.max(r.perna, Math.abs(o.membros[2].rotation.x)); r.acao |= o.acao | 0; } if (window.__rec === r) requestAnimationFrame(f); }; f(); });
const lido = () => bb.evaluate(() => window.__rec);
// Beto liga a câmera de trás com o botão (toque de verdade)
await bb.tap('#bt-visao');
await bb.waitForTimeout(1500);
ok(await bb.evaluate(() => window.__jogo.visao.modo) === 1, 'Beto (tablet): botão da câmera ligou a visão de trás');
// Ana vira para o Beto: o rosto dela tem que apontar para ele (-z)
const rot = await bb.evaluate(() => { const g = window.__jogo.outrosLista[0]; return [Math.sin(g.grupo.rotation.y), Math.cos(g.grupo.rotation.y)]; });
ok(rot[1] < -0.9, `Ana olha para o norte e o boneco dela mostra o rosto para o norte (frente z = ${rot[1].toFixed(2)})`);
await bb.screenshot({ path: `${SAIDA}/online-beto-ve-ana-parada.png` });
// Ana anda de verdade (tecla W segurada) — anda para o Beto
await a.keyboard.down('KeyW');
await a.waitForTimeout(500);
const anda = [];
for (let i = 0; i < 6; i++) { anda.push(await bb.evaluate(() => +window.__jogo.outrosLista[0].membros[2].rotation.x.toFixed(2))); await bb.waitForTimeout(60); }
await bb.screenshot({ path: `${SAIDA}/online-beto-ve-ana-andando.png` });
await a.keyboard.up('KeyW');
ok(anda.some((r) => Math.abs(r) > 0.3), 'Beto vê as pernas da Ana andando ' + anda.join(','));
await a.waitForTimeout(600);
// Ana pula (espaço de verdade)
await gravar();
await a.keyboard.down('Space'); await a.waitForTimeout(200); await a.keyboard.up('Space');
await a.waitForTimeout(900);
let r = await lido();
ok(r.bracoZ < -0.2, 'Beto vê a Ana pulando com os braços abertos (' + r.bracoZ.toFixed(2) + ', acao ' + r.acao + ')');
await a.waitForTimeout(800);
// Ana bate num bloco com o mouse (clique de verdade, mira travada no centro)
await a.evaluate(() => { window.__jogo.jog.pitch = -0.9; });
await a.mouse.click(512, 320); // primeiro clique trava o mouse
await a.waitForTimeout(300);
const travou = await a.evaluate(() => !!document.pointerLockElement);
await gravar();
await a.mouse.down();
await a.waitForTimeout(1200);
await bb.screenshot({ path: `${SAIDA}/online-beto-ve-ana-batendo.png` });
await a.mouse.up();
r = await lido();
const golpe = r.golpe;
const edB = await bb.evaluate(() => window.__jogo.mundo.listarEdicoes().length);
ok(golpe < 1, `Beto vê o braço da Ana batendo (mouse travado: ${travou}, golpe ${golpe.toFixed(2)}, blocos mudados ${edB})`);
const beto = await bb.evaluate(() => { const b = window.__jogo.visao.boneco; return { golpe: window.__jogo.visao.golpe, braco: +b.membros[0].rotation.x.toFixed(2), noChao: window.__jogo.jog.noChao }; });
ok(beto.golpe === 1, 'o boneco do Beto não bateu sozinho ' + JSON.stringify(beto));
// Ana também liga a 3ª pessoa (tecla R) e vê o Beto de frente
await a.keyboard.press('Escape');
await a.evaluate(() => { const j = window.__jogo.jog; j.pitch = 0; j.yaw = 0; });
await a.keyboard.press('KeyR');
await a.waitForTimeout(1200);
await a.screenshot({ path: `${SAIDA}/online-ana-de-tras.png` });
ok(await a.evaluate(() => window.__jogo.visao.modo) === 1, 'Ana (PC): tecla R ligou a visão de trás');
console.log('erros:', erros.length ? erros : 'nenhum');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

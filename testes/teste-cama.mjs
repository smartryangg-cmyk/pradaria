// Cama pula a noite (como nos jogos de blocos clássicos), jogando pela tela do tablet:
// de dia, tocar na cama só explica; de noite, a tela escurece e amanhece; andar levanta da cama.
// Online: a noite só passa quando os 2 jogadores deitam (a sala conta e muda a hora para todo mundo).
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-cama.mjs
//   ONLINE=http://localhost:8788 (com a sala e o pages dev rodando) testa também 2 jogadores
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const CAMA = 176;

// mira na cama e toca no meio da tela (ou chama usar, sem tela de toque)
async function deitar(q, c, toque) {
  await q.evaluate(([x, y, z]) => {
    const J = window.__jogo, j = J.jog, cam = J.camera, dx = x + 0.5 - j.pos.x, dz = z + 0.5 - j.pos.z;
    j.yaw = Math.atan2(-dx, -dz); j.pitch = -Math.atan2(cam.position.y - (y + 0.3), Math.hypot(dx, dz));
  }, c);
  await q.waitForTimeout(250);
  if (toque) { const m = await q.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 })); await q.touchscreen.tap(m.x, m.y); }
  else await q.evaluate(() => window.__jogo.usar(null));
  await q.waitForTimeout(400);
}
const escuro = (q) => q.evaluate(() => { const s = document.getElementById('sono'); return !s.hidden && s.classList.contains('mostra'); });
const texto = (q, t) => q.evaluate((t) => document.body.innerText.includes(t), t);

// ---------- tablet, sem internet ----------
const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await p.waitForTimeout(4000);
ok(await p.evaluate(() => window.__jogo.opcoesMundo.cicloDia !== false), 'mundo novo tem dia e noite');
const cama = await p.evaluate((CAMA) => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.max(m.chao(x0, z0) + 1, 40);
  for (let x = -5; x <= 5; x++) for (let z = -6; z <= 3; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 1); for (let y = 0; y < 5; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  m.definir(x0, y0, z0 - 2, CAMA);
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.vel.x = j.vel.z = 0; j.voando = false;
  J.barra[0] = 0; J.slot = 0; J.dia = 0.3;
  return [x0, y0, z0 - 2];
}, CAMA);
await p.waitForTimeout(600);
// de dia: só explica
await deitar(p, cama, true);
const dia1 = await p.evaluate(() => window.__jogo.dia);
ok(!(await escuro(p)) && dia1 > 0.29 && dia1 < 0.35 && await texto(p, 'Só dá para dormir de noite'), `de dia, a cama explica e não dorme (hora ${dia1.toFixed(3)})`);
await p.screenshot({ path: SAIDA + '/cama-1-dia.png' });
// de noite: escurece e amanhece
await p.evaluate(() => { window.__jogo.dia = 0.7; });
await p.waitForTimeout(2200);
await deitar(p, cama, true);
const deitou = await p.evaluate(([x, y, z]) => { const j = window.__jogo.jog; return Math.abs(j.pos.x - x - 0.5) < 0.05 && Math.abs(j.pos.z - z - 0.5) < 0.05; }, cama);
await p.waitForTimeout(900);
ok(deitou && await escuro(p), 'de noite: deita na cama e a tela escurece');
await p.screenshot({ path: SAIDA + '/cama-2-dormindo.png' });
await p.waitForTimeout(3000);
const dia2 = await p.evaluate(() => window.__jogo.dia);
ok(dia2 < 0.06 && !(await escuro(p)) && await texto(p, 'Bom dia'), `amanheceu (hora ${dia2.toFixed(3)}) e levantou da cama`);
await p.waitForTimeout(900);
await p.screenshot({ path: SAIDA + '/cama-3-bom-dia.png' });
// deita de noite e anda: levanta, continua de noite
await p.evaluate(() => { window.__jogo.dia = 0.7; });
await p.waitForTimeout(2200);
await deitar(p, cama, true);
await p.waitForTimeout(500);
await p.keyboard.down('KeyS'); await p.waitForTimeout(500); await p.keyboard.up('KeyS');
await p.waitForTimeout(3000);
const dia3 = await p.evaluate(() => window.__jogo.dia);
ok(dia3 > 0.69 && dia3 < 0.75 && !(await escuro(p)), `andar levanta da cama e a noite continua (hora ${dia3.toFixed(3)})`);
await ctx.close();

if (ONLINE) {
  async function jogador(nome) {
    const c = await b.newContext({ viewport: { width: 900, height: 560 } });
    const q = await c.newPage();
    q.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); q.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
    await q.goto(ONLINE + '/#teste'); await q.evaluate(() => localStorage.clear()); await q.reload();
    await q.click('#bt-criar-conta'); await q.fill('#c-nome', nome); await q.fill('#c-senha', 'senha123');
    if (await q.isVisible('#c-adulto-ok')) await q.check('#c-adulto-ok');
    await q.click('#c-ok');
    await q.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 20000 });
    if (await q.isVisible('#m-jogos')) await q.click('.jogo[data-jogo=pradaria]');
    await q.waitForSelector('#m-mundos:not([hidden])', { timeout: 20000 });
    return q;
  }
  // cada um põe uma cama com a mão na grama do mundo, perto de onde está
  async function porCama(q, dx) {
    const alvo = await q.evaluate((dx) => {
      const M = window.__jogo.mundo, j = window.__jogo.jog, px = Math.floor(j.pos.x) + dx, pz = Math.floor(j.pos.z);
      for (let r = 0; r <= 30; r++) for (let ax = -r; ax <= r; ax++) for (const az of [-r, r]) {
        const x = px + ax, z = pz + az, y = M.chao(x, z) + 1;
        if (M.bloco(x, y - 1, z) === 1 && M.bloco(x, y, z) === 0 && M.bloco(x, y + 1, z) === 0 && M.bloco(x, y, z + 1) === 0 && M.bloco(x, y + 1, z + 1) === 0) return [x, y, z];
      }
      return null;
    }, dx);
    if (!alvo) return null;
    await q.evaluate(([x, y, z]) => { const J = window.__jogo, j = J.jog; j.voando = true; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; J.barra[0] = 176; J.slot = 0; }, alvo);
    await q.waitForTimeout(700);
    for (let i = 0; i < 4; i++) {
      await q.evaluate(([x, y, z]) => { const J = window.__jogo, c = J.camera, j = J.jog; j.yaw = 0; j.pitch = -Math.atan2(c.position.y - (y - 0.5), c.position.z - (z + 0.5)); }, alvo);
      await q.waitForTimeout(250);
      await q.evaluate(() => window.__jogo.usar(null));
      await q.waitForTimeout(600);
      const bl = await q.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), alvo);
      if (bl >= 176 && bl <= 179) break;
    }
    await q.evaluate(() => { window.__jogo.barra[0] = 0; });
    return alvo;
  }
  const sfx = Date.now() % 10000;
  const a = await jogador('Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Quarto');
  if (await a.getAttribute('[data-opcao=sobrevivencia]', 'aria-pressed') === 'true') await a.click('[data-opcao=sobrevivencia]');
  if (await a.getAttribute('[data-opcao=mercado]', 'aria-pressed') === 'true') await a.click('[data-opcao=mercado]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await a.waitForTimeout(2500);
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await bb.waitForTimeout(1500);
  const ca = await porCama(a, 0), cb = await porCama(bb, 6);
  const camas = await Promise.all([a.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), ca), bb.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), cb)]);
  ok(camas.every((c) => c >= 176 && c <= 179), `online: Ana e Beto puseram uma cama cada (${camas})`);
  await a.waitForTimeout(1200); // as posições chegam na sala
  // de dia a sala também recusa (mesmo pedindo direto)
  await a.evaluate((c) => window.__jogo.sala.enviar({ t: 'dormir', b: c }), ca);
  await a.waitForTimeout(800);
  ok(await texto(a, 'Só dá para dormir de noite'), 'online: de dia a sala não deixa dormir');
  // a dona põe de noite (vale para os dois)
  await a.evaluate(() => window.__jogo.sala.enviar({ t: 'dia', v: 0.7 }));
  await a.waitForTimeout(1500);
  const noite = await Promise.all([a, bb].map((q) => q.evaluate(() => window.__jogo.dia)));
  ok(noite.every((d) => d > 0.69 && d < 0.73), `online: noite para os dois (${noite.map((d) => d.toFixed(3))})`);
  await a.waitForTimeout(2500);
  // Ana deita: escurece para ela, Beto fica sabendo, ainda é noite
  await deitar(a, ca);
  await a.waitForTimeout(1500);
  const umaHora = await Promise.all([a, bb].map((q) => q.evaluate(() => window.__jogo.dia)));
  ok(await escuro(a) && await texto(a, '1 de 2') && umaHora.every((d) => d > 0.69 && d < 0.78), `online: Ana dormindo espera o Beto (1 de 2), continua de noite (${umaHora.map((d) => d.toFixed(3))})`);
  ok(await texto(bb, 'foi dormir'), 'online: Beto vê que a Ana foi dormir');
  await a.screenshot({ path: SAIDA + '/cama-online-ana-esperando.png' });
  // Beto deita: amanhece para os dois
  await deitar(bb, cb);
  await a.waitForTimeout(2500);
  const manha = await Promise.all([a, bb].map((q) => q.evaluate(() => window.__jogo.dia)));
  ok(manha.every((d) => d < 0.08), `online: os dois deitaram e amanheceu para os dois (${manha.map((d) => d.toFixed(3))})`);
  ok(!(await escuro(a)) && !(await escuro(bb)) && await texto(a, 'Bom dia'), 'online: os dois levantaram com "Bom dia"');
  await bb.screenshot({ path: SAIDA + '/cama-online-beto-manha.png' });
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

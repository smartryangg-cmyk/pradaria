// Pés no chão no estilo Natural 3D (print do Ryan: boneco flutuando na areia): o chão desenhado é arredondado e
// fica mais baixo que o topo do bloco nas beiradas e declives; o boneco (o nosso, na 3ª pessoa, e o do amigo)
// desce até o chão desenhado. A colisão continua nos blocos. Jogando pela tela do tablet.
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-pes.mjs
//   ONLINE=http://localhost:8788 (com a sala e o pages dev rodando) testa também o boneco do amigo
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
// procura uma beirada: topo do bloco onde o chão desenhado fica bem mais baixo (degrau para o lado)
const acharBeirada = (q) => q.evaluate(() => {
  const M = window.__jogo.mundo, j = window.__jogo.jog, px = Math.floor(j.pos.x), pz = Math.floor(j.pos.z);
  let melhor = null;
  for (let d = 0; d <= 24; d++) for (let dx = -d; dx <= d; dx++) for (const dz of [-d, d]) {
    const x = px + dx, z = pz + dz, y = M.chao(x, z) + 1;
    if (M.bloco(x, y, z) !== 0 || M.bloco(x, y + 1, z) !== 0 || [5, 23, 24, 25, 26, 27, 28, 29, 30].includes(M.bloco(x, y - 1, z))) continue;
    const h = M.alturaVisual(x + 0.5, y, z + 0.5);
    if (h !== null && y - h > 0.25 && y - h < 0.9 && (!melhor || y - h > melhor[3])) melhor = [x, y, z, y - h];
  }
  return melhor;
});
const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])');
await p.tap('#m-novo [data-estilo=suave]');
await p.tap('#n-opcoes details summary'); await p.fill('#n-semente', 'pradaria');
await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.mundo, null, { timeout: 30000 });
await p.waitForTimeout(6000);
ok(await p.evaluate(() => window.__jogo.mundo.suave), 'mundo Natural 3D');
const bei = await acharBeirada(p);
ok(!!bei, 'achou uma beirada onde o chão desenhado fica abaixo do bloco ' + JSON.stringify(bei));
if (bei) {
  const [x, y, z] = bei;
  await p.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.voando = false; j.pos.x = x + 0.5; j.pos.y = y + 0.2; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0.6; }, bei);
  await p.tap('#bt-visao'); await p.waitForTimeout(400);
  if (!(await p.evaluate(() => window.__jogo.visao.terceira))) await p.tap('#bt-visao');
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const J = window.__jogo, j = J.jog, g = J.visao.boneco && J.visao.boneco.grupo; return { pe: g ? g.position.y : null, pos: j.pos.y, noChao: j.noChao, chao: J.mundo.alturaVisual(j.pos.x, j.pos.y, j.pos.z), terceira: J.visao.terceira }; });
  ok(r.terceira && r.noChao, 'em pé no bloco, na 3ª pessoa');
  ok(r.pe !== null && Math.abs(r.pe - r.chao) < 0.06 && r.pos - r.pe > 0.2, `os pés do boneco ficam no chão desenhado e não no topo do bloco (pés ${r.pe?.toFixed(2)}, chão desenhado ${r.chao?.toFixed(2)}, bloco ${r.pos.toFixed(2)})`);
  await p.screenshot({ path: SAIDA + '/pes-1-beirada.png' });
  // andando ele continua com os pés no chão; no chão plano não muda nada
  const plano = await p.evaluate(() => { const M = window.__jogo.mundo, j = window.__jogo.jog; for (let d = 0; d < 30; d++) for (let dx = -d; dx <= d; dx++) for (const dz of [-d, d]) { const x = Math.floor(j.pos.x) + dx, z = Math.floor(j.pos.z) + dz, y = M.chao(x, z) + 1; const h = M.alturaVisual(x + 0.5, y, z + 0.5); if (M.bloco(x, y, z) === 0 && h !== null && Math.abs(h - y) < 0.01) return [x, y, z]; } return null; });
  if (plano) {
    await p.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y + 0.1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; }, plano);
    await p.waitForTimeout(1200);
    const r2 = await p.evaluate(() => { const J = window.__jogo; return [J.visao.boneco.grupo.position.y, J.jog.pos.y]; });
    ok(Math.abs(r2[0] - r2[1]) < 0.03, `no chão plano os pés ficam no topo do bloco (${r2.map((v) => v.toFixed(2))})`);
  }
  // pulando: o ajuste sai (no ar não puxa o boneco para baixo)
  await p.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y + 0.1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; }, bei);
  await p.waitForTimeout(1000);
  await p.tap('#bt-pular'); await p.waitForTimeout(250);
  const r3 = await p.evaluate(() => { const J = window.__jogo; return [J.visao.boneco.grupo.position.y, J.jog.pos.y, J.jog.noChao]; });
  ok(!r3[2] && r3[1] - r3[0] < 0.25, `pulando, o boneco acompanha o pulo (${r3.slice(0, 2).map((v) => v.toFixed(2))})`);
}
await ctx.close();

if (ONLINE) {
  async function jogador(nome) {
    const c = await b.newContext({ viewport: { width: 900, height: 560 } });
    const q = await c.newPage();
    q.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); q.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
    await q.goto(ONLINE + '/#teste'); await q.evaluate(() => localStorage.clear()); await q.reload();
    await q.click('#bt-criar-conta'); await q.fill('#c-nome', nome); await q.fill('#c-senha', 'senha123');
    if (await q.isVisible('#c-adulto-ok')) await q.check('#c-adulto-ok');
    if (await q.isVisible('#c-nasc .d-ano')) { await q.selectOption('#c-nasc .d-dia', '1'); await q.selectOption('#c-nasc .d-mes', '1'); await q.selectOption('#c-nasc .d-ano', '1990'); }
    await q.click('#c-ok');
    await q.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 20000 });
    if (await q.isVisible('#m-jogos')) await q.click('.jogo[data-jogo=pradaria]');
    await q.waitForSelector('#m-mundos:not([hidden])', { timeout: 20000 });
    return q;
  }
  const sfx = Date.now() % 10000;
  const a = await jogador('Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Dunas');
  await a.click('#m-novo [data-estilo=suave]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await a.waitForTimeout(3000);
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await bb.waitForTimeout(3000);
  ok(await bb.evaluate(() => window.__jogo.mundo.suave), 'online: Beto também vê o mundo Natural 3D');
  const be = await acharBeirada(a);
  ok(!!be, 'online: achou beirada ' + JSON.stringify(be));
  if (be) {
    await a.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.voando = false; j.pos.x = x + 0.5; j.pos.y = y + 0.1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; }, be);
    await bb.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = x + 3.5; j.pos.y = y + 1.5; j.pos.z = z + 3.5; j.vel.x = j.vel.y = j.vel.z = 0; }, be);
    await bb.waitForTimeout(3500);
    const r = await bb.evaluate(([x, y, z]) => { const J = window.__jogo, o = J.outrosLista[0]; const dx = o.grupo.position.x - J.jog.pos.x, dz = o.grupo.position.z - J.jog.pos.z; J.jog.yaw = Math.atan2(-dx, -dz); J.jog.pitch = -0.4; return { pe: o.grupo.position.y, chao: J.mundo.alturaVisual(x + 0.5, y + 0.05, z + 0.5), bloco: y }; }, be);
    ok(Math.abs(r.pe - r.chao) < 0.08 && r.bloco - r.pe > 0.2, `online: Beto vê os pés da Ana no chão desenhado (pés ${r.pe.toFixed(2)}, chão ${r.chao?.toFixed(2)}, bloco ${r.bloco})`);
    await bb.waitForTimeout(500);
    await bb.screenshot({ path: SAIDA + '/pes-online-beto.png' });
  }
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

// Fogo (como nos jogos de blocos clássicos), jogando pela tela do tablet:
// isqueiro (pedrisco + minério de ferro, na bancada) acende fogo tocando no chão; o fogo ilumina, queima a parede
// de tábuas encostada (as tábuas somem, sem cair nada) e depois apaga sozinho; no chão de pedra sem combustível
// apaga em poucos segundos; água apaga; lava acende madeira encostada; ficar no fogo machuca; um toque apaga.
// Online: o amigo vê o fogo e a madeira queimada; a sala recusa "fogo" mandado longe de fogo numa construção.
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-fogo.mjs
//   ONLINE=http://localhost:8788 (com a sala e o pages dev rodando) testa também 2 jogadores
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const PEDRA = 3, TABUAS = 8, FOGO = 222, ISQUEIRO = 1010, LAVA = 215, AGUA = 5;

async function tocarEm(q, alvo, toque = true) {
  await q.evaluate(([x, y, z]) => {
    const J = window.__jogo, j = J.jog, c = J.camera, dx = x - c.position.x, dz = z - c.position.z;
    j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y - c.position.y, Math.hypot(dx, dz));
  }, alvo);
  await q.waitForTimeout(250);
  if (toque) { const m = await q.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 })); await q.touchscreen.tap(m.x, m.y); }
  else await q.evaluate(() => window.__jogo.usar(null));
  await q.waitForTimeout(350);
}
const bl = (q, x, y, z) => q.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x, y, z]);

const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await p.waitForTimeout(4000);
ok(await p.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo é de coletar e criar');
// chão de pedra plano, de dia, com uma bancada do lado; parede de tábuas (5 de largura, 3 de altura) na frente
const base = await p.evaluate(([PEDRA, TABUAS]) => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.max(m.chao(x0, z0) + 1, 40);
  for (let x = -9; x <= 9; x++) for (let z = -9; z <= 9; z++) { m.definir(x0 + x, y0 - 1, z0 + z, PEDRA); for (let y = 0; y < 8; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  for (let x = -2; x <= 2; x++) for (let y = 0; y < 3; y++) m.definir(x0 + x, y0 + y, z0 - 4, TABUAS);
  m.definir(x0 + 3, y0, z0 + 2, 34); // bancada
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0;
  J.dia = 0.3; J.bichos.limpar(); J.bichos.tempoSpawn = 1e9;
  const me = J.mercado; me.e.itens[20] = 1; me.e.itens[67] = 1; me.recebeu(me.e);
  return [x0, y0, z0];
}, [PEDRA, TABUAS]);
const [x0, y0, z0] = base;
await p.waitForTimeout(800);
// isqueiro na bancada: pedrisco + minério de ferro
await p.evaluate(() => window.__jogo.abrirInventario('criar'));
await p.waitForSelector('#inventario:not([hidden]) [data-receita=isqueiro]');
await p.click('[data-receita=isqueiro]'); // o livro arruma a grade 3x3 da bancada
await p.click('#inv-saida', { modifiers: ['Shift'] }); // tira o resultado direto para a mochila
const it = await p.evaluate(() => { const e = window.__jogo.mercado.e.itens; return [e[20] || 0, e[67] || 0, e[1010] || 0]; });
ok(it[0] === 0 && it[1] === 0 && it[2] === 1, `criou o isqueiro na bancada com pedrisco e minério de ferro (${it})`);
await p.click('#inventario [data-fechar]');
await p.evaluate(() => { const J = window.__jogo; const i = J.barra.indexOf(1010); J.slot = i >= 0 ? i : (J.barra[0] = 1010, 0); });
// no chão de pedra, longe da madeira: acende e apaga sozinho em poucos segundos
await tocarEm(p, [x0 + 4.5, y0, z0 - 1.5]);
const f1 = await bl(p, x0 + 4, y0, z0 - 2);
ok(f1 === FOGO, `tocar no chão com o isqueiro acende fogo (${f1})`);
await p.waitForTimeout(4500);
ok(await bl(p, x0 + 4, y0, z0 - 2) === 0, 'no chão de pedra, sem nada para queimar, o fogo apaga sozinho');
// do lado da parede de tábuas: o fogo pega na parede e ela queima
await tocarEm(p, [x0 + 0.5, y0, z0 - 2.5]);
ok(await bl(p, x0, y0, z0 - 3) === FOGO, 'acendeu fogo encostado na parede de tábuas');
const tabuas = () => p.evaluate(([x0, y0, z0]) => { let n = 0; for (let x = -2; x <= 2; x++) for (let y = 0; y < 3; y++) if (window.__jogo.mundo.bloco(x0 + x, y0 + y, z0 - 4) === 8) n++; return n; }, base);
const fogos = () => p.evaluate(() => window.__jogo.mundo.fogos.size);
await p.waitForTimeout(2500);
await p.evaluate(() => { const j = window.__jogo.jog; j.yaw = 0; j.pitch = 0.05; });
await p.waitForTimeout(400);
await p.screenshot({ path: SAIDA + '/fogo-1-parede.png' });
const meio = await tabuas(), acesos = await fogos();
ok(meio < 15 && acesos > 0, `a parede pegou fogo (tábuas ${meio} de 15, fogos acesos ${acesos})`);
let fim = meio, t = 0;
for (; t < 60 && (await fogos()) > 0; t++) await p.waitForTimeout(1000);
fim = await tabuas();
const itensTabua = await p.evaluate(() => window.__jogo.mercado.e.itens[8] || 0);
ok(fim < meio && (await fogos()) === 0, `o fogo queimou a parede e apagou sozinho (sobraram ${fim} tábuas em ${t + 3} s)`);
ok(itensTabua === 0, 'madeira queimada não cai para a mochila');
await p.screenshot({ path: SAIDA + '/fogo-2-queimou.png' });
// água apaga: acende e despeja água do lado
await p.evaluate(([x0, y0, z0]) => { const j = window.__jogo.jog; j.pos.x = x0 - 3.5; j.pos.z = z0 + 4.5; j.vel.x = j.vel.z = 0; }, base);
for (let k = 0; k < 4 && (await bl(p, x0 - 6, y0, z0 + 6)) !== FOGO; k++) await tocarEm(p, [x0 - 5.5, y0, z0 + 6.5]);
const temFogoAgua = await bl(p, x0 - 6, y0, z0 + 6);
await p.evaluate(([x0, y0, z0, AGUA]) => window.__jogo.mundo.definir(x0 - 7, y0, z0 + 6, AGUA), [x0, y0, z0, AGUA]);
await p.waitForTimeout(1300);
const depoisAgua = await bl(p, x0 - 6, y0, z0 + 6);
ok(temFogoAgua === FOGO && depoisAgua !== FOGO, `água do lado apaga o fogo (${temFogoAgua} -> ${depoisAgua})`);
await p.evaluate(([x0, y0, z0]) => window.__jogo.mundo.definir(x0 - 7, y0, z0 + 6, 0), base);
// lava acende a madeira encostada
await p.evaluate(([x0, y0, z0, T, L]) => { const m = window.__jogo.mundo; m.definir(x0 + 6, y0, z0 + 6, T); m.definir(x0 + 6, y0, z0 + 5, L); }, [x0, y0, z0, TABUAS, LAVA]);
let pegou = false;
for (let k = 0; k < 10 && !pegou; k++) { await p.waitForTimeout(400); pegou = (await bl(p, x0 + 6, y0, z0 + 6)) !== TABUAS; }
ok(pegou, 'lava acende a tábua encostada nela');
// ficar dentro do fogo machuca; um toque apaga
await p.evaluate(([x0, y0, z0]) => { const J = window.__jogo; J.mundo.definir(x0 + 6, y0, z0 + 5, 0); J.mundo.definir(x0 + 5, y0, z0 - 7, 222); const j = J.jog; j.pos.x = x0 + 5.5; j.pos.z = z0 - 6.5; j.pos.y = y0; j.vel.x = j.vel.z = 0; }, base);
const v0 = await p.evaluate(() => window.__jogo.vida.atual);
await p.waitForTimeout(1800);
const v1 = await p.evaluate(() => window.__jogo.vida.atual);
ok(v1 < v0 && await p.evaluate(() => document.body.innerText.includes('Fogo queima')), `dentro do fogo machuca e avisa (vida ${v0} -> ${v1})`);
await p.evaluate(([x0, y0, z0]) => { const J = window.__jogo; J.mundo.definir(x0 + 5, y0, z0 - 7, 0); J.mundo.definir(x0, y0, z0 + 3, 222); const j = J.jog; j.pos.x = x0 + 0.5; j.pos.z = z0 + 6.5; J.barra[J.slot] = 0; }, base);
for (let k = 0; k < 4 && (await bl(p, x0, y0, z0 + 3)) === FOGO; k++) {
  await p.evaluate(([x, y, z]) => { const J = window.__jogo, j = J.jog, c = J.camera, dx = x - c.position.x, dz = z - c.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y - c.position.y, Math.hypot(dx, dz)); }, [x0 + 0.5, y0 + 0.3, z0 + 3.5]);
  await p.waitForTimeout(150); await p.evaluate(() => window.__jogo.quebrar(null)); await p.waitForTimeout(300);
}
ok(await bl(p, x0, y0, z0 + 3) !== FOGO, 'um toque apaga o fogo');
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Fogueira');
  if (await a.getAttribute('[data-modo=sobrevivencia]', 'aria-pressed') === 'true') await a.click('[data-modo=criativo]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await a.waitForTimeout(2500);
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await bb.waitForTimeout(1500);
  // Ana constrói uma coluna de tábuas no alto (com a mão) e uma segunda longe; acende fogo do lado da primeira
  const A = await a.evaluate(() => { const J = window.__jogo, j = J.jog, x = Math.floor(j.pos.x), z = Math.floor(j.pos.z); let t = 0; for (let dx = -3; dx <= 10; dx++) for (let dz = -6; dz <= 5; dz++) t = Math.max(t, J.mundo.chao(x + dx, z + dz)); return [x, t + 6, z]; }); // no ar, acima de tudo em volta
  const [ax, ay, az] = A;
  await a.evaluate(([ax, ay, az]) => { const J = window.__jogo; J.jog.voando = true; J.jog.pos.y = ay + 1; J.jog.vel.y = 0; J.comoJogador(() => { J.mundo.definir(ax, ay - 1, az - 3, 3); J.mundo.definir(ax + 1, ay - 1, az - 3, 3); J.mundo.definir(ax + 1, ay, az - 3, 8); J.mundo.definir(ax + 1, ay + 1, az - 3, 8); J.mundo.definir(ax + 8, ay, az - 3, 8); }); }, A);
  await bb.evaluate(([ax, ay, az]) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = ax + 0.5; j.pos.y = ay + 1; j.pos.z = az + 3.5; j.vel.y = 0; }, A);
  await a.waitForTimeout(1500);
  ok(await bl(bb, ax + 1, ay, az - 3) === TABUAS, 'online: Beto vê a coluna de tábuas da Ana');
  // um aparelho modificado mandando "fogo" na tábua longe de qualquer fogo: a sala recusa
  await bb.evaluate(([x, y, z]) => window.__jogo.sala.enviar({ t: 'bloco', x, y, z, b: 222, de: 8 }), [ax + 8, ay, az - 3]);
  await a.evaluate(() => { const J = window.__jogo; J.barra[0] = 1010; J.slot = 0; });
  await tocarEm(a, [ax + 0.5, ay, az - 2.5], false);
  const fA = await bl(a, ax, ay, az - 3);
  await a.waitForTimeout(1200);
  const fB = await bl(bb, ax, ay, az - 3);
  ok(fA === FOGO && (fB === FOGO || (await bl(bb, ax + 1, ay, az - 3)) !== TABUAS), `online: Ana acende com o isqueiro e Beto vê o fogo (${fA}, ${fB})`);
  await bb.evaluate(([ax, ay, az]) => { const J = window.__jogo, j = J.jog, c = J.camera, dx = ax + 1 - c.position.x, dz = az - 3 - c.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(ay - c.position.y, Math.hypot(dx, dz)); }, A);
  await bb.waitForTimeout(600);
  await bb.screenshot({ path: SAIDA + '/fogo-online-beto.png' });
  let queimou = false;
  for (let k = 0; k < 40 && !queimou; k++) { await a.waitForTimeout(1000); queimou = [await bl(bb, ax + 1, ay, az - 3), await bl(bb, ax + 1, ay + 1, az - 3)].every((v) => v !== TABUAS); }
  const longe = await bl(bb, ax + 8, ay, az - 3), longeA = await bl(a, ax + 8, ay, az - 3);
  ok(queimou, 'online: a coluna de tábuas queimou para os dois');
  ok(longe === TABUAS && longeA === TABUAS, `online: a sala recusou o "fogo" mandado longe de fogo (Ana ${longeA}, Beto ${longe})`);
  // quem entra depois vê a madeira queimada (ficou salvo)
  const c3 = await jogador('Caio' + sfx);
  await c3.click('#bt-codigo'); await c3.fill('#n-nome', codigo); await c3.click('#m-novo button[type=submit]');
  await c3.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await c3.evaluate(([ax, ay, az]) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = ax + 0.5; j.pos.y = ay + 1; j.pos.z = az + 3.5; }, A);
  await c3.waitForTimeout(3000);
  const v3 = [await bl(c3, ax + 1, ay, az - 3), await bl(c3, ax + 1, ay + 1, az - 3), await bl(c3, ax, ay, az - 3)];
  ok(v3.every((v) => v !== TABUAS && v !== FOGO), `online: quem entra depois vê a madeira queimada e o fogo apagado (${v3})`);
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

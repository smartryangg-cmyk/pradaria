// Bichos de fazenda cruzam com trigo (coletar e criar), jogando pela tela do tablet:
// segurando trigo, as vacas vêm atrás; dar trigo (tocar com trigo na mão) gasta 1 e deixa a vaca apaixonada;
// duas apaixonadas se encontram e nasce um filhote; os pais descansam (não comem de novo); o filhote cresce
// (comer trigo adianta); bicho selvagem não come trigo. Online: a sala gasta o trigo da mochila de verdade.
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-cruzar.mjs
//   ONLINE=http://localhost:8788 (com a sala e o pages dev rodando) testa também a mochila na sala
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];

const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.bichos, null, { timeout: 30000 });
await p.waitForTimeout(4000);
ok(await p.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo é de coletar e criar');
// pasto plano e cercado de ar, de dia; só as duas vacas do teste
const base = await p.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.max(m.chao(x0, z0) + 1, 40);
  for (let x = -10; x <= 10; x++) for (let z = -14; z <= 6; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 1); m.definir(x0 + x, y0 - 2, z0 + z, 3); for (let y = 0; y < 5; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.vel.x = j.vel.z = 0; j.voando = false; j.yaw = 0; j.pitch = -0.1;
  J.dia = 0.3; J.bichos.limpar(); J.bichos.tempoSpawn = 1e9;
  const me = J.mercado; me.e.itens[32] = 5; me.recebeu(me.e);
  J.barra[0] = 0; J.barra[1] = 32; J.slot = 0;
  return [x0, y0, z0];
});
const [x0, y0, z0] = base;
const vacas = () => p.evaluate(() => window.__jogo.bichos.lista.filter((v) => v.especie === 'vaca').map((v) => ({ x: +v.x.toFixed(2), z: +v.z.toFixed(2), filhote: v.filhote, amor: +v.amor.toFixed(1), cria: Math.round(v.cria), estado: v.estado })));
await p.evaluate(([x0, y0, z0]) => { const B = window.__jogo.bichos; B.criar('vaca', x0 - 2.5, y0, z0 - 6.5, { grupo: 900 }); B.criar('vaca', x0 + 3.5, y0, z0 - 6.5, { grupo: 901 }); }, base);
await p.waitForTimeout(1500);
// mão vazia: as vacas ficam por lá; com trigo na mão, vêm atrás
const distJ = () => p.evaluate(() => { const J = window.__jogo; return J.bichos.lista.filter((v) => v.especie === 'vaca').map((v) => Math.hypot(v.x - J.jog.pos.x, v.z - J.jog.pos.z)); });
const d0 = await distJ();
await p.evaluate(() => { window.__jogo.slot = 1; }); // trigo
await p.waitForTimeout(5000);
const d1 = await distJ();
ok(d1.every((d, i) => d < d0[i] - 2 && d < 4.5), `segurando trigo, as vacas vêm atrás (${d0.map((d) => d.toFixed(1))} -> ${d1.map((d) => d.toFixed(1))})`);
await p.screenshot({ path: SAIDA + '/cruzar-1-seguem.png' });
// dá trigo para cada vaca: mira nela e toca (usar)
const meio = await p.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 }));
async function darPara(i) {
  for (let k = 0; k < 8; k++) {
    const r = await p.evaluate((i) => {
      const J = window.__jogo, v = J.bichos.lista.filter((q) => q.especie === 'vaca')[i], j = J.jog, c = J.camera;
      const dx = v.x - j.pos.x, dz = v.z - j.pos.z;
      j.yaw = Math.atan2(-dx, -dz); j.pitch = -Math.atan2(c.position.y - (v.y + v.e.alt * v.esc * 0.6), Math.hypot(dx, dz));
      return v.amor > 0;
    }, i);
    if (r) return true;
    if (await p.evaluate((i) => window.__jogo.bichos.lista.filter((q) => q.especie === 'vaca')[i].cria > 0, i)) return true; // comeu e já cruzou
    await p.waitForTimeout(120);
    await p.touchscreen.tap(meio.x, meio.y);
    await p.waitForTimeout(450);
  }
  return p.evaluate((i) => { const v = window.__jogo.bichos.lista.filter((q) => q.especie === 'vaca')[i]; return v.amor > 0 || v.cria > 0; }, i);
}
const a1 = await darPara(0);
const trigo1 = await p.evaluate(() => window.__jogo.mercado.e.itens[32] || 0);
ok(a1 && trigo1 === 4, `tocou com trigo: a vaca comeu e ficou apaixonada, gastou 1 trigo (sobram ${trigo1})`);
const a2 = await darPara(1);
const trigo2 = await p.evaluate(() => window.__jogo.mercado.e.itens[32] || 0);
ok(a2 && trigo2 === 3, `a segunda vaca também (sobram ${trigo2}, comeu ${a2}) ` + JSON.stringify(await vacas()));
await p.evaluate(() => { window.__jogo.slot = 0; }); // solta o trigo: elas vão uma até a outra
await p.screenshot({ path: SAIDA + '/cruzar-2-coracoes.png' });
let nasceu = false;
for (let t = 0; t < 30 && !nasceu; t++) { await p.waitForTimeout(500); nasceu = (await vacas()).some((v) => v.filhote); }
const vs = await vacas();
ok(nasceu, 'as duas apaixonadas se encontraram e nasceu um filhote ' + JSON.stringify(vs));
ok(vs.filter((v) => !v.filhote).every((v) => v.amor === 0 && v.cria > 250), 'os pais descansam ~5 min antes de outra cria');
await p.waitForTimeout(600);
await p.screenshot({ path: SAIDA + '/cruzar-3-filhote.png' });
// pai descansando não come (e não gasta trigo)
await p.evaluate(() => { window.__jogo.slot = 1; });
await p.waitForTimeout(300);
const mae = await p.evaluate(() => window.__jogo.bichos.lista.findIndex((q) => q.especie === 'vaca' && !q.filhote));
const t0 = await p.evaluate(() => window.__jogo.mercado.e.itens[32] || 0);
for (let k = 0; k < 3; k++) {
  await p.evaluate(() => { const J = window.__jogo, v = J.bichos.lista.find((q) => q.especie === 'vaca' && !q.filhote), j = J.jog, c = J.camera, dx = v.x - j.pos.x, dz = v.z - j.pos.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = -Math.atan2(c.position.y - (v.y + v.e.alt * 0.6), Math.hypot(dx, dz)); });
  await p.waitForTimeout(120); await p.touchscreen.tap(meio.x, meio.y); await p.waitForTimeout(400);
  if (await p.evaluate(() => document.body.innerText.includes('descansando'))) break;
}
const t1 = await p.evaluate(() => window.__jogo.mercado.e.itens[32] || 0);
ok(mae >= 0 && t1 === t0 && await p.evaluate(() => document.body.innerText.includes('descansando')), `vaca descansando não come de novo (trigo ${t0} -> ${t1})`);
// filhote cresce: comer trigo adianta 10%; quando o tempo acaba vira adulta
const cresce = await p.evaluate(() => {
  const B = window.__jogo.bichos, f = B.lista.find((q) => q.especie === 'vaca' && q.filhote);
  const antes = f.crescer; B.alimentar(f); const depois = f.crescer;
  f.crescer = 0.05;
  return new Promise((r) => setTimeout(() => r({ antes: Math.round(antes), depois: Math.round(depois), virou: !f.filhote, escala: f.grupo.scale.x, vida: f.vida }), 1200));
});
ok(cresce.antes - cresce.depois >= 55 && cresce.virou && cresce.escala === 1 && cresce.vida === 6, 'filhote: trigo adianta o crescimento e ele vira vaca adulta ' + JSON.stringify(cresce));
// bicho selvagem não come trigo (o toque espanta)
const lobo = await p.evaluate(([x0, y0, z0]) => { const B = window.__jogo.bichos; const l = B.criar('lobo', x0 + 0.5, y0, z0 - 2.5, { grupo: 950 }); return B.alimentar(l); }, base);
ok(lobo === false, 'lobo não come trigo');
await ctx.close();

if (ONLINE) {
  // online, coletar e criar: a sala gasta o trigo de verdade (sem trigo na mochila da sala, recusa)
  const c = await b.newContext({ viewport: { width: 900, height: 560 } });
  const q = await c.newPage();
  q.on('pageerror', (e) => erros.push('online ' + e.message));
  await q.goto(ONLINE + '/#teste'); await q.evaluate(() => localStorage.clear()); await q.reload();
  await q.click('#bt-criar-conta'); await q.fill('#c-nome', 'Ana' + (Date.now() % 10000)); await q.fill('#c-senha', 'senha123');
  if (await q.isVisible('#c-adulto-ok')) await q.check('#c-adulto-ok');
  await q.click('#c-ok');
  await q.waitForFunction(() => ['#m-jogos', '#m-mundos'].some((k) => { const e = document.querySelector(k); return e && !e.hidden; }), null, { timeout: 30000 });
  if (await q.isVisible('#m-jogos')) await q.click('.jogo[data-jogo=pradaria]');
  await q.waitForSelector('#m-mundos:not([hidden])', { timeout: 20000 });
  await q.click('#bt-novo-mundo'); await q.fill('#n-nome', 'Fazenda');
  if (await q.getAttribute('[data-modo=sobrevivencia]', 'aria-pressed') !== 'true') await q.click('[data-modo=sobrevivencia]');
  await q.click('#m-novo button[type=submit]');
  await q.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await q.waitForTimeout(2500);
  const antes = await q.evaluate(() => JSON.stringify(window.__jogo.mercado.e.itens));
  await q.evaluate(() => window.__jogo.mercado.enviar({ t: 'alimentar' }));
  await q.waitForTimeout(1500);
  const depois = await q.evaluate(() => JSON.stringify(window.__jogo.mercado.e.itens));
  ok(antes === depois && !(JSON.parse(depois)[32] < 0), `online: sem trigo na mochila, a sala não deixa (${depois})`);
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

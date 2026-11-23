// Jogo clássico: a experiência. Barra verde em cima da barra de itens com o nível no meio; ganha tirando minério
// do mundo com a picareta certa e tirando coisa pronta da fornalha; sobe de nível (aviso); morrer perde tudo e a
// tela de morte mostra a pontuação e o botão de sair do mundo. Online quem decide é a sala.
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-xp.mjs        (PARTES=pc,toque,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0; const erros = [];
const PARTES = (process.env.PARTES || 'pc,toque,online').split(',');
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(100); }
  return false;
}
const xp = (p) => J(p, () => window.__jogo.mercado.e.xp | 0);
const qtd = (p, id) => J(p, (id) => window.__jogo.mercado.qtd(id), id);
const barra = (p) => J(p, () => { const e = document.querySelector('#xp'); return { vis: !e.hidden && e.offsetWidth > 0, w: parseFloat(e.querySelector('i').style.width) || 0, n: e.querySelector('b').hidden ? 0 : +e.querySelector('b').textContent }; });
function vigiar(p, nome) {
  p.on('pageerror', (e) => erros.push(nome + ' ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
}
async function mundo(ctx, toque, nome) {
  const p = await ctx.newPage(); vigiar(p, nome);
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  return p;
}
// acha um minério de carvão do mundo (ninguém mexeu) que dá experiência, abre um buraco na frente dele e fica olhando
const acharCarvao = (p) => J(p, async () => {
  const { xpDoMinerio } = await import('/js/xp-regras.js');
  const J_ = window.__jogo, m = J_.mundo, j = J_.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.floor(j.pos.y);
  for (let r = 0; r <= 40; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    for (let y = y0 - 50; y < y0; y++) {
      const x = x0 + dx, z = z0 + dz;
      if (m.bloco(x, y, z) === 66 && !m.editado(x, y, z) && xpDoMinerio(66, x, y, z) > 0) return [x, y, z, xpDoMinerio(66, x, y, z)];
    }
  }
  return null;
});
// fica de frente para o bloco o = [x,y,z] (buraco de 2 blocos na frente dele, chão embaixo)
const irAte = (p, o) => J(p, ([x, y, z]) => {
  const m = window.__jogo.mundo, j = window.__jogo.jog;
  for (const dz of [1, 2]) { m.definir(x, y, z + dz, 0); m.definir(x, y + 1, z + dz, 0); m.definir(x, y + 2, z + dz, 0); if (!m.bloco(x, y - 1, z + dz)) m.definir(x, y - 1, z + dz, 3); }
  j.voando = false; j.pos.x = x + 0.5; j.pos.y = y; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = -0.48;
}, o);
const segurar = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
const quebrar = (p, o) => J(p, async ([x, y, z]) => {
  for (let i = 0; i < 40 && window.__jogo.mundo.bloco(x, y, z); i++) { window.__jogo.quebrar(null); await new Promise((r) => setTimeout(r, 260)); }
  return window.__jogo.mundo.bloco(x, y, z) !== 66 && window.__jogo.mundo.bloco(x, y, z) !== 6;
}, o);
// o que tem na mão no começo do teste (sem internet o jogo deixa pegar)
const dar = (p, l) => J(p, (l) => { for (const [id, n] of l) window.__jogo.mercado.mexer({ t: 'pegar', id, n }, true); }, l);

// ================= computador, sem internet =================
if (PARTES.includes('pc')) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await mundo(ctx, false, 'pc');
  ok(await J(p, () => window.__jogo.vida.classico()), 'mundo novo é o jogo clássico');
  let v = await barra(p);
  ok(v.vis && v.w === 0 && v.n === 0, 'a barra de experiência aparece vazia, sem número');
  const pos = await J(p, () => ['#xp', '#barra', '#vida'].map((s) => document.querySelector(s).getBoundingClientRect()).map((r) => [r.top, r.bottom]));
  ok(pos[0][1] <= pos[1][0] + 1 && pos[2][1] <= pos[0][0] + 1, `fica entre a barra de itens e os corações (${JSON.stringify(pos)})`);
  // minério de carvão do mundo com a picareta de madeira
  await dar(p, [[1001, 1]]);
  const o = await acharCarvao(p);
  ok(!!o, 'achou um minério de carvão no mundo ' + JSON.stringify(o));
  if (o) {
    await irAte(p, o); await esperar(p, 500); await segurar(p, 1001);
    ok(await quebrar(p, o), 'quebrou o minério de carvão');
    await ate(p, () => parseFloat(document.querySelector('#xp i').style.width) > 0, null, 3000); // a barra se redesenha no quadro seguinte
    ok(await xp(p) === o[3] && (await barra(p)).w > 0, `ganhou ${o[3]} ponto(s) e a barra encheu um pouco (${(await barra(p)).w}%)`);
  }
  // fornalha: 10 minérios de ferro = 10 barras = 7 pontos (sobe para o nível 1)
  const antes = await xp(p);
  await dar(p, [[67, 10], [1100, 2], [188, 1]]);
  const c = o || await J(p, () => { const j = window.__jogo.jog; return [Math.floor(j.pos.x), Math.floor(j.pos.y), Math.floor(j.pos.z) - 2]; });
  await irAte(p, c); await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x, y, z, 188), c);
  await esperar(p, 400);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 600);
  ok(await p.isVisible('#forno-painel'), 'abriu a fornalha ' + JSON.stringify(c));
  const espaco = (id) => J(p, (id) => window.__jogo.inv.s.findIndex((s) => s && s.id === id), id);
  await p.click(`.slot-inv[data-l=s][data-i="${await espaco(67)}"]`); await p.click('.forno-e'); await esperar(p, 300);
  await p.click(`.slot-inv[data-l=s][data-i="${await espaco(1100)}"]`); await p.click('.forno-c'); await esperar(p, 300);
  // não precisa esperar 100 s: adianta o relógio da fornalha
  await J(p, () => { for (const f of window.__jogo.fornos.values()) f.t -= 100000; });
  ok(await ate(p, () => /\(10\)/.test(document.querySelector('.forno-s')?.getAttribute('aria-label') || ''), null, 3000), '10 barras de ferro prontas');
  await p.click('.forno-s'); await esperar(p, 500);
  ok(await qtd(p, 1101) === 10 && await xp(p) === antes + 7, `tirou as barras e ganhou 7 pontos (${antes} -> ${await xp(p)})`);
  await p.keyboard.press('Escape'); await esperar(p, 300);
  v = await barra(p);
  ok(v.n >= 1, `subiu para o nível ${v.n}, número aparece na barra`);
  ok(/nível/i.test(await J(p, () => document.querySelector('#aviso')?.textContent || '')) || v.n >= 1, 'avisou que subiu de nível');
  await p.screenshot({ path: SAIDA + '/xp-pc.png' });
  // morrer: perde a experiência e mostra a pontuação
  const tinha = await xp(p);
  await J(p, () => window.__jogo.vida.dano(40)); await esperar(p, 800);
  ok(await p.isVisible('#morte'), 'morreu: tela de morte');
  const pt = await p.textContent('#morte-pontos');
  ok(new RegExp('Pontuação: ' + tinha).test(pt), 'mostra a pontuação: ' + pt);
  ok(await xp(p) === 0, 'a experiência foi embora');
  await p.screenshot({ path: SAIDA + '/xp-pc-morreu.png' });
  await p.click('#bt-renascer'); await esperar(p, 800);
  v = await barra(p);
  ok(!(await p.isVisible('#morte')) && v.vis && v.n === 0 && v.w === 0, 'renasceu com a barra vazia');
  await J(p, () => { window.__jogo.vida.protegido = 0; window.__jogo.vida.dano(40); }); await esperar(p, 800);
  await p.click('#bt-morte-sair'); await esperar(p, 1500);
  ok(!(await p.isVisible('#morte')) && await J(p, () => [...document.querySelectorAll('.tela, [id^=m-]')].some((e) => !e.hidden && e.offsetWidth > 0)), 'Sair do mundo na tela de morte volta para o menu');
  ok(!(await barra(p)).vis, 'fora do mundo a barra some');
  await p.screenshot({ path: SAIDA + '/xp-pc-saiu.png' });
  await ctx.close();
  // mundo com mods (pacífico): sem barra
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const q = await ctx2.newPage(); vigiar(q, 'mods');
  await q.goto(URL + '/#teste'); await q.evaluate(() => localStorage.clear()); await q.reload(); await esperar(q, 500);
  await q.click('#bt-sozinho'); await q.waitForSelector('#m-novo:not([hidden])');
  const temPac = await q.$('#m-novo [data-dificuldade=pacifico]');
  if (temPac) {
    await q.evaluate(() => document.querySelector('#m-novo [data-dificuldade=pacifico]').click());
    await q.click('#m-novo button[type=submit]');
    await q.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(q, 2000);
    ok(!(await barra(q)).vis && await J(q, () => window.__jogo.opcoesMundo.dificuldade) === 'pacifico', 'mundo pacífico (com mods): sem barra de experiência');
  } else ok(false, 'não achei a opção pacífico no mundo novo');
  await ctx2.close();
}

// ================= celular e tablet =================
if (PARTES.includes('toque')) for (const [nome, dev] of [['celular', devices['Pixel 7']], ['tablet', devices['Galaxy Tab S4']], ['celular-deitado', devices['Pixel 7 landscape']]]) {
  const ctx = await b.newContext({ ...dev });
  const p = await mundo(ctx, true, nome);
  await dar(p, [[1101, 0]]);
  await J(p, () => { window.__jogo.mercado.e.xp = 30; }); await esperar(p, 500); // nível 3 e um pouco
  const v = await barra(p);
  ok(v.vis && v.n === 3 && v.w > 0, `${nome}: barra com nível 3 (${JSON.stringify(v)})`);
  const r = await J(p, () => ['#xp', '#barra', '#vida', '#fome'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }));
  const vw = await J(p, () => innerWidth);
  ok(r[0][3] <= r[1][1] + 1 && r[2][3] <= r[0][1] + 1 && r[3][3] <= r[0][1] + 1 && r[0][0] >= 0 && r[0][2] <= vw, `${nome}: não encosta em nada e cabe na tela ${JSON.stringify(r)}`);
  await p.screenshot({ path: SAIDA + `/xp-${nome}.png` });
  await J(p, () => window.__jogo.vida.dano(40)); await esperar(p, 800);
  const bts = await J(p, () => ['#bt-renascer', '#bt-morte-sair'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.bottom <= innerHeight, r.height >= 40]; }));
  ok(bts.every(([a, c]) => a && c) && /Pontuação: 30/.test(await p.textContent('#morte-pontos')), `${nome}: tela de morte com pontuação e os 2 botões na tela`);
  await p.screenshot({ path: SAIDA + `/xp-${nome}-morreu.png` });
  await p.tap('#bt-renascer'); await esperar(p, 600);
  ok((await barra(p)).n === 0, `${nome}: renasceu no nível 0`);
  await ctx.close();
}

// ================= online: quem decide é a sala =================
if (PARTES.includes('online')) {
  const letras = () => Array.from({ length: 6 }, () => 'bdgkmvwxyz'[Math.floor(Math.random() * 10)]).join('');
  const sfx = letras();
  async function pagina(nome, toque) {
    const ctx = await b.newContext(toque ? { ...devices['Galaxy Tab S4'] } : { viewport: { width: 1100, height: 720 } });
    const p = await ctx.newPage(); vigiar(p, nome);
    await p.goto(ONLINE + '/#teste');
    return p;
  }
  async function conta(p, nome) {
    await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
    if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
    await p.click('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 90000 }); if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
    await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 });
  }
  const a = await pagina('Ana');
  await conta(a, 'Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Experiencia');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', true);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2000);
  ok((await barra(a)).vis && (await barra(bt)).vis, 'online: os dois veem a barra de experiência');
  // o aparelho tenta inventar experiência: a sala manda a mochila certa de volta
  await J(a, () => { const j = window.__jogo.jog; window.__jogo.mercado.e.xp = 500; window.__jogo.sala.enviar({ t: 'forno-tirar', x: Math.floor(j.pos.x), y: Math.floor(j.pos.y) - 1, z: Math.floor(j.pos.z), k: 's' }); });
  ok(await ate(a, () => (window.__jogo.mercado.e.xp | 0) === 0, null, 4000), 'online: experiência inventada no aparelho a sala desfaz (' + await xp(a) + ')');
  // troncos -> picareta de madeira (a sala confere cada passo) -> minério de carvão do mundo
  const o = await acharCarvao(a);
  ok(!!o, 'online: achou um minério de carvão no mundo ' + JSON.stringify(o));
  if (o) {
    // os troncos e a bancada: em lugares novos ao lado do buraco (a sala só acredita onde ninguém mexeu)
    await irAte(a, o); await esperar(a, 600);
    const base = [o[0], o[1], o[2] + 2];
    let k = 0;
    const lugarNovo = () => { k++; return [base[0] + 3 + k, base[1] + 30, base[2]]; };
    for (let i = 0; i < 3; i++) {
      const l = lugarNovo();
      await J(a, ([x, y, z]) => { const m = window.__jogo.mundo, j = window.__jogo.jog; m.definir(x, y - 1, z + 2, 3); m.definir(x, y, z + 2, 0); m.definir(x, y + 1, z + 2, 0); m.definir(x, y, z, 6); j.pos.x = x + 0.5; j.pos.y = y; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = -0.48; }, l);
      await esperar(a, 400); await segurar(a, -1);
      await quebrar(a, l); await esperar(a, 700);
      for (let t = 0; t < 4; t++) { const d = await J(a, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z])); if (!d.length) break; await J(a, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = y; }, d[0]); await esperar(a, 900); }
    }
    ok(await qtd(a, 6) === 3, 'online: pegou 3 troncos (' + await qtd(a, 6) + ')');
    await J(a, () => window.__jogo.mercado.criar('tabuas', false, 3)); await esperar(a, 500);
    await J(a, () => { const m = window.__jogo.mercado; m.criar('bancada', false, 1); m.criar('graveto', false, 2); }); await esperar(a, 800);
    await irAte(a, o); await esperar(a, 400);
    // a bancada no buraco (chão do lado)
    await J(a, ([x, y, z]) => { const m = window.__jogo.mundo, j = window.__jogo.jog; m.definir(x + 1, y, z + 2, 0); m.definir(x + 1, y + 1, z + 2, 0); if (!m.bloco(x + 1, y - 1, z + 2)) m.definir(x + 1, y - 1, z + 2, 3); j.yaw = -Math.PI / 2; j.pitch = -0.6; }, o);
    await esperar(a, 300); await segurar(a, 34);
    await J(a, () => window.__jogo.usar(null)); await esperar(a, 1200);
    ok(await qtd(a, 34) === 0, 'online: colocou a bancada');
    await J(a, () => window.__jogo.mercado.criar('picareta-madeira', true, 1)); await esperar(a, 1000);
    ok(await qtd(a, 1001) === 1, 'online: criou a picareta de madeira (a sala conferiu)');
    await irAte(a, o); await esperar(a, 500); await segurar(a, 1001);
    ok(await quebrar(a, o), 'online: quebrou o minério de carvão do mundo');
    await esperar(a, 1500);
    ok(await xp(a) === o[3], `online: ganhou ${o[3]} ponto(s)`);
    // sai e volta: a experiência vem da sala (ela guardou)
    await J(a, () => { window.__jogo.mercado.e.xp = 0; });
    await a.reload(); await esperar(a, 1500);
    if (await a.isVisible('#m-jogos')) await a.click('.jogo[data-jogo=pradaria]');
    await a.waitForSelector('#m-mundos:not([hidden])', { timeout: 30000 });
    await a.click('#lista-mundos .mundo, #lista-mundos button'); 
    await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 }); await esperar(a, 2500);
    ok(await ate(a, (n) => (window.__jogo.mercado.e.xp | 0) === n, o[3], 5000), 'online: voltou ao mundo e a sala devolveu a experiência (' + await xp(a) + ')');
    await a.screenshot({ path: SAIDA + '/xp-online-ana.png' });
    // morreu: a sala zera também
    await J(a, () => window.__jogo.vida.dano(40)); await esperar(a, 1500);
    ok(new RegExp('Pontuação: ' + o[3]).test(await a.textContent('#morte-pontos')) && await xp(a) === 0, 'online: morreu, pontuação ' + await a.textContent('#morte-pontos'));
    await a.click('#bt-renascer'); await esperar(a, 2000);
    ok(await xp(a) === 0, 'online: a sala também zerou');
  }
  await bt.screenshot({ path: SAIDA + '/xp-online-beto.png' });
  await bt.context().close(); await a.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

// Jogo clássico: armadura. Cria na bancada pela grade (de verdade, clicando), veste nos 4 espaços
// (cabeça, peito, pernas, pés), a barra de armadura aparece em cima dos corações, o golpe do monstro
// machuca menos e a armadura gasta. Peça na mão + usar veste. Morreu: a armadura cai junto.
// Celular e tablet: vestir tocando (mover rápido) e com toque na tela; a janela cabe na tela.
// Online: o couro vem da caça, a bota sai da bancada (a sala confere) e o desgaste fica guardado na sala.
// Uso: (cd public && python3 -m http.server 8772), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-armadura.mjs        (PARTES=pc,toque,online)
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
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); }
  return false;
}
const qtd = (p, id) => J(p, (id) => window.__jogo.mercado.qtd(id), id);
function vigiar(p, nome) {
  p.on('pageerror', (e) => erros.push(nome + ' ' + (process.env.PILHA ? e.stack : e.message)));
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
// chão de pedra liso lá no alto (o terreno não atrapalha)
const palco = (p) => p.evaluate(() => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = 90;
  for (let dx = -34; dx <= 34; dx++) for (let dz = -34; dz <= 34; dz++) { m.definir(x0 + dx, y0, z0 + dz, 3); for (let dy = 1; dy <= 4; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0); }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0;
  return [x0, y0, z0];
});
const limpar = (p) => J(p, () => { const L = window.__jogo.bichos; L.tempoSpawn = 1e9; for (let i = L.lista.length - 1; i >= 0; i--) if (!L.lista[i].caindo) L.remover(i); });
const dar = (p, l) => J(p, (l) => { for (const [id, n] of l) window.__jogo.mercado.mexer({ t: 'pegar', id, n }, true); }, l);
const segurar = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
const vestido = (p) => J(p, () => window.__jogo.inv.s.slice(37).map((x) => (x ? x.id : 0)));
const hud = (p) => J(p, () => { const e = document.querySelector('#armadura'); return { vis: !e.hidden && e.offsetWidth > 0, txt: e.getAttribute('aria-label') || '' }; });
// espaço do inventário que tem a coisa id (fora da armadura)
const espacoDe = (p, id) => J(p, (id) => window.__jogo.inv.s.findIndex((x, i) => x && x.id === id && i < 37), id);
const slot = (l, i) => `#grade .slot-inv[data-l="${l}"][data-i="${i}"]`;
// um monstro morde até machucar uma vez: quanto tirou (vida cheia, sem proteção de antes)
async function mordida(p) {
  await limpar(p);
  await J(p, () => { const g = window.__jogo; g.vida.atual = g.vida.max; g.vida.protegido = 0; g.dia = 0.75; });
  await ate(p, () => { const J_ = window.__jogo, j = J_.jog; J_.bichos.tentarMonstro(j.pos.x, j.pos.y, j.pos.z, -1, 'barrento'); return J_.bichos.lista.some((b) => b.especie === 'barrento'); }, null, 20000);
  const v0 = await J(p, () => window.__jogo.vida.atual);
  // põe o barrento do lado (se ele sumiu nesse meio tempo, nasce outro)
  await ate(p, () => { const J_ = window.__jogo, j = J_.jog; let m = J_.bichos.lista.find((b) => b.especie === 'barrento' && !b.caindo); if (!m) { J_.bichos.tentarMonstro(j.pos.x, j.pos.y, j.pos.z, -1, 'barrento'); return false; } m.x = j.pos.x + 1.2; m.z = j.pos.z; m.y = j.pos.y; return true; }, null, 20000);
  await ate(p, (v0) => window.__jogo.vida.atual < v0 || window.__jogo.vida.protegido > 0, v0, 15000);
  const v1 = await J(p, () => window.__jogo.vida.atual);
  await limpar(p);
  return v0 - v1;
}

// ================= computador, sem internet =================
if (PARTES.includes('pc')) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await mundo(ctx, false, 'pc');
  ok(await J(p, () => window.__jogo.vida.classico()), 'mundo novo é o jogo clássico');
  const [x0, y0, z0] = await palco(p); await esperar(p, 800);
  ok(!(await hud(p)).vis, 'sem armadura: a barra de armadura não aparece');
  // sem armadura: quanto o barrento tira (várias mordidas para a média)
  let semArm = 0; for (let k = 0; k < 3; k++) semArm += await mordida(p);
  ok(semArm > 0, `sem armadura o barrento machucou (${semArm} em 3 mordidas)`);
  // a bancada na frente; usar abre a grade 3x3
  await dar(p, [[1008, 5]]);
  await J(p, ([x, y, z]) => { const g = window.__jogo; g.mundo.definir(x, y + 1, z - 2, 34); const j = g.jog; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = -0.62; g.dia = 0.25; }, [x0, y0, z0]);
  await esperar(p, 400);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 600);
  ok(await J(p, () => !document.querySelector('#inventario').hidden && window.__jogo.inv.w === 3), 'usar a bancada abriu a grade 3x3');
  ok(await p.isVisible('.inv-armadura') && (await p.$$('.inv-armadura .slot-inv')).length === 4, 'a janela mostra os 4 espaços de vestir');
  // pega os 5 couros e larga 1 em cada espaço do arco (clique direito)
  await p.click(slot('s', await espacoDe(p, 1008)));
  for (const i of [0, 1, 2, 3, 5]) await p.click(slot('g', i), { button: 'right' });
  ok(await p.isVisible('#inv-saida.pronta') && await J(p, () => document.querySelector('#inv-saida').getAttribute('aria-label')) === 'Criar Capacete de couro', 'o arco de couro na grade faz o capacete');
  await p.click('#inv-saida');
  ok(await J(p, () => window.__jogo.inv.cursor && window.__jogo.inv.cursor.id === 1117), 'pegou o capacete criado');
  await p.click(slot('s', 38)); // espaço do peito: não entra
  ok(await J(p, () => !window.__jogo.inv.s[38] && window.__jogo.inv.cursor?.id === 1117), 'capacete não entra no espaço do peito');
  await p.click(slot('s', 37));
  ok((await vestido(p))[0] === 1117 && await qtd(p, 1117) === 1 && await qtd(p, 1008) === 0, 'vestiu o capacete de couro (criado com os 5 couros)');
  await p.screenshot({ path: SAIDA + '/armadura-pc-inventario.png' });
  // o resto de ferro: shift-clique veste
  await dar(p, [[1122, 1], [1123, 1], [1124, 1], [1121, 1]]);
  await esperar(p, 300);
  for (const id of [1122, 1123, 1124]) { await p.click(slot('s', await espacoDe(p, id)), { modifiers: ['Shift'] }); await esperar(p, 100); }
  ok(JSON.stringify(await vestido(p)) === '[1117,1122,1123,1124]', 'shift-clique vestiu peitoral, calça e botas de ferro ' + JSON.stringify(await vestido(p)));
  // troca o capacete: pega o de ferro e clica no espaço da cabeça (o de couro fica no cursor)
  await p.click(slot('s', await espacoDe(p, 1121))); await p.click(slot('s', 37));
  ok((await vestido(p))[0] === 1121 && await J(p, () => window.__jogo.inv.cursor?.id === 1117), 'trocou o capacete de couro pelo de ferro');
  await p.keyboard.press('Escape'); await esperar(p, 400);
  ok(await J(p, () => document.querySelector('#inventario').hidden && !window.__jogo.inv.cursor && window.__jogo.mercado.qtd(1117) === 1), 'fechou: o capacete de couro voltou para a mochila');
  const h = await hud(p);
  ok(h.vis && h.txt === 'Armadura: 15 de 20', 'barra de armadura em cima dos corações: ' + h.txt);
  const pos = await J(p, () => ['#armadura', '#vida', '#xp'].map((s) => document.querySelector(s).getBoundingClientRect()).map((r) => [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]));
  ok(pos[0][3] <= pos[1][1] + 1 && pos[0][0] >= pos[1][0] - 2, 'a barra de armadura fica logo acima dos corações, do lado esquerdo ' + JSON.stringify(pos));
  await p.screenshot({ path: SAIDA + '/armadura-pc-hud.png' });
  // com armadura de ferro: o barrento tira menos e a armadura gasta
  let comArm = 0; for (let k = 0; k < 3; k++) comArm += await mordida(p);
  ok(comArm < semArm, `com armadura de ferro machuca menos (${semArm} -> ${comArm} em 3 mordidas)`);
  const desg = await J(p, () => [1121, 1122, 1123, 1124].map((id) => (window.__jogo.mercado.e.desg?.[id] || [])[0] | 0));
  ok(desg.every((d) => d >= 1), 'cada peça vestida gastou ' + JSON.stringify(desg));
  // peça na mão + usar (botão direito) veste: botas de diamante no lugar das de ferro
  await dar(p, [[1128, 1]]); await esperar(p, 200);
  ok(await segurar(p, 1128) >= 0, 'botas de diamante na barra');
  await J(p, () => { window.__jogo.jog.pitch = 1.2; }); // olhando para o céu (não mira bloco)
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 300);
  ok((await vestido(p))[3] === 1128 && await J(p, () => window.__jogo.barra.includes(1124)), 'usar com as botas na mão vestiu (as de ferro foram para a mão)');
  ok((await hud(p)).txt === 'Armadura: 16 de 20', 'a barra subiu para 16');
  // morreu: a armadura vestida cai no chão junto com o resto
  await J(p, () => { const g = window.__jogo; g.vida.protegido = 0; g.vida.motivo = 'monstro'; g.vida.dano(99); });
  await esperar(p, 800);
  ok(await J(p, () => !document.querySelector('#morte').hidden), 'morreu');
  ok(await qtd(p, 1122) === 0 && (await vestido(p)).every((x) => !x), 'a armadura saiu do corpo');
  ok(await J(p, () => window.__jogo.drops.lista().some((d) => d.id === 1122) && window.__jogo.drops.lista().some((d) => d.id === 1128)), 'o peitoral e as botas ficaram no chão');
  ok(!(await hud(p)).vis, 'a barra de armadura sumiu');
  await ctx.close();
}

// ================= celular e tablet =================
if (PARTES.includes('toque')) for (const [nome, dev] of [['celular', devices['Pixel 7']], ['tablet', devices['Galaxy Tab S4']]]) {
  const ctx = await b.newContext({ ...dev });
  const p = await mundo(ctx, true, nome);
  await palco(p); await esperar(p, 600);
  await dar(p, [[1121, 1], [1122, 1], [1123, 1], [1124, 1], [1125, 1]]); await esperar(p, 300);
  await p.tap('#barra .slot.mais'); await esperar(p, 500);
  ok(await p.isVisible('.inv-armadura'), `${nome}: abriu a mochila com os espaços de vestir`);
  await p.tap('#inv-rapido');
  for (const id of [1121, 1122, 1123, 1124]) { await p.tap(slot('s', await espacoDe(p, id))); await esperar(p, 150); }
  ok(JSON.stringify(await vestido(p)) === '[1121,1122,1123,1124]', `${nome}: tocando (mover rápido) vestiu as 4 peças de ferro ` + JSON.stringify(await vestido(p)));
  const caixas = await J(p, () => [...document.querySelectorAll('.inv-armadura .slot-inv, #grade .slot-inv[data-l="s"]')].map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]));
  const vp = p.viewportSize();
  const janela = await J(p, () => { const r = document.querySelector('#inventario').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; });
  ok(caixas.slice(0, 4).every((c) => c[0] >= 0 && c[2] <= vp.width && c[2] - c[0] >= 28), `${nome}: os espaços de vestir cabem na tela e dá para tocar`);
  ok(janela[3] <= vp.height + 1 || await J(p, () => { const e = document.querySelector('#inventario'); return e.scrollHeight > e.clientHeight || [...e.querySelectorAll('*')].some((x) => x.scrollHeight > x.clientHeight + 2 && getComputedStyle(x).overflowY !== 'visible'); }), `${nome}: a janela cabe (ou rola)`);
  await p.screenshot({ path: SAIDA + `/armadura-${nome}-inventario.png` });
  await p.tap('#inv-rapido');
  await J(p, () => { const f = document.querySelector('#inventario .fechar, #inventario [data-fechar], #inventario button[aria-label="Fechar"]'); if (f) f.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' })); });
  await esperar(p, 400);
  ok(await J(p, () => document.querySelector('#inventario').hidden), `${nome}: fechou a mochila`);
  const h = await hud(p);
  ok(h.vis && h.txt === 'Armadura: 15 de 20', `${nome}: barra de armadura ` + h.txt);
  const pos = await J(p, () => ['#armadura', '#vida', '#fome'].map((s) => document.querySelector(s).getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]));
  const cruza = (a, c) => a[0] < c[2] && c[0] < a[2] && a[1] < c[3] && c[1] < a[3];
  ok(!cruza(pos[0], pos[1]) && !cruza(pos[0], pos[2]) && pos[0][3] <= pos[1][1] + 1, `${nome}: armadura em cima dos corações sem cobrir nada ` + JSON.stringify(pos.map((r) => r.map(Math.round))));
  // capacete de diamante na mão: um toque rápido na tela veste
  await segurar(p, 1125);
  await J(p, () => { window.__jogo.jog.pitch = 1.2; });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width / 2, y: vp.height / 2 }] });
  await esperar(p, 90);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await esperar(p, 400);
  ok((await vestido(p))[0] === 1125 && (await hud(p)).txt === 'Armadura: 16 de 20', `${nome}: toque na tela com o capacete de diamante na mão vestiu`);
  await p.screenshot({ path: SAIDA + `/armadura-${nome}-hud.png` });
  await ctx.close();
}

// ================= online: couro da caça, bota da bancada, desgaste na sala =================
if (PARTES.includes('online')) {
  const sfx = Array.from({ length: 6 }, () => 'bdgkmvwxyz'[Math.floor(Math.random() * 10)]).join('');
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
  async function voltar(p) {
    await p.reload(); await esperar(p, 1500);
    if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
    await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 30000 });
    await p.click('#lista-mundos .mundo, #lista-mundos button');
    await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 }); await esperar(p, 2500);
  }
  const a = await pagina('Ana');
  await conta(a, 'Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Armadura');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', true);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2000);
  const [x0, y0, z0] = await palco(a); await esperar(a, 800);
  await J(a, () => { window.__jogo.dia = 0.25; });
  // 3 troncos em lugares onde ninguém mexeu (a sala acredita), quebrados com a mão
  for (let i = 0; i < 3; i++) {
    const l = [x0 - 6 + i * 3, y0 + 1, z0 - 6];
    await J(a, ([x, y, z]) => { const m = window.__jogo.mundo, j = window.__jogo.jog; m.definir(x, y, z, 6); j.pos.x = x + 0.5; j.pos.y = y; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = -0.3; }, l);
    await esperar(a, 300); await segurar(a, -1);
    await J(a, async ([x, y, z]) => { for (let k = 0; k < 40 && window.__jogo.mundo.bloco(x, y, z); k++) { window.__jogo.quebrar(null); await new Promise((r) => setTimeout(r, 260)); } }, l);
    await esperar(a, 700);
    for (let t = 0; t < 4; t++) { const d = await J(a, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z])); if (!d.length) break; await J(a, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = y; }, d[0]); await esperar(a, 900); }
  }
  ok(await qtd(a, 6) === 3, 'online: pegou 3 troncos (' + await qtd(a, 6) + ')');
  await J(a, () => window.__jogo.mercado.criar('tabuas', false, 1)); await esperar(a, 600);
  await J(a, () => window.__jogo.mercado.criar('bancada', false, 1)); await esperar(a, 800);
  await J(a, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 0.5; j.yaw = 0; j.pitch = -0.6; }, [x0, y0, z0]);
  await esperar(a, 300); await segurar(a, 34);
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 1200);
  await a.keyboard.press('Escape');
  ok(await qtd(a, 34) === 0, 'online: colocou a bancada');
  // 2 ursos: 4 couros (a sala dá o que o bicho deixa)
  for (let k = 0; k < 5 && await qtd(a, 1008) < 4; k++) { // um golpe errado às vezes deixa o urso fugir: caça até ter 4
    await J(a, () => { const g = window.__jogo, j = g.jog; g.vida.atual = g.vida.max; g.bichos.limpar && g.bichos.limpar(); const u = g.bichos.criar('urso', j.pos.x + 0.5, j.pos.y, j.pos.z + 3); u.calmo = 99; u.estado = 'parar'; u.timer = 99; u.I = { ...u.I, fuga: 0 }; });
    await J(a, async () => {
      const g = window.__jogo, j = g.jog;
      for (let i = 0; i < 40; i++) {
        const u = g.bichos.lista.find((b) => b.especie === 'urso' && !b.caindo);
        if (!u) return;
        g.vida.atual = g.vida.max;
        j.yaw = Math.PI; j.pitch = -Math.atan((1.6 - u.e.alt * 0.5) / 1.7); u.x = j.pos.x; u.z = j.pos.z + 1.7; u.y = j.pos.y; u.empX = u.empZ = 0; u.calmo = 99;
        await new Promise((r) => setTimeout(r, 80)); g.quebrar(null); await new Promise((r) => setTimeout(r, 650));
      }
    });
    await esperar(a, 1500);
    for (let t = 0; t < 6; t++) { const d = await J(a, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z])); if (!d.length) break; await J(a, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = Math.max(j.pos.y, y); }, d[0]); await esperar(a, 900); }
    await esperar(a, 1600); // a sala aceita um bicho a cada 1,5 s
  }
  ok(await ate(a, () => window.__jogo.mercado.qtd(1008) >= 4, null, 6000), 'online: caçou ursos e pegou 4 couros (' + await qtd(a, 1008) + ')');
  await J(a, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; }, [x0, y0, z0]);
  await esperar(a, 500);
  await J(a, () => window.__jogo.mercado.criar('botas-couro', true, 1)); await esperar(a, 1200);
  ok(await qtd(a, 1120) === 1, 'online: criou as botas de couro na bancada (a sala conferiu)');
  // veste pela janela (shift-clique)
  await J(a, () => window.__jogo.abrirInventario('mochila')); await esperar(a, 400);
  await a.click(slot('s', await espacoDe(a, 1120)), { modifiers: ['Shift'] });
  await a.keyboard.press('Escape'); await esperar(a, 300);
  ok((await vestido(a))[3] === 1120 && (await hud(a)).txt === 'Armadura: 1 de 20', 'online: vestiu as botas, barra com 1 ponto');
  await mordida(a); await mordida(a);
  const d0 = await J(a, () => (window.__jogo.mercado.e.desg?.[1120] || [])[0] | 0);
  ok(d0 >= 2, 'online: as botas gastaram com as mordidas (' + d0 + ')');
  await esperar(a, 1500);
  await a.screenshot({ path: SAIDA + '/armadura-online-ana.png' });
  await bt.screenshot({ path: SAIDA + '/armadura-online-beto.png' });
  ok(!(await hud(bt)).vis, 'online: o Beto (sem armadura) não tem barra de armadura');
  // volta: a sala guardou o desgaste e as botas continuam vestidas
  // antes de sair, desce para o chão de verdade do mundo (o palco de pedra só existe neste aparelho:
  // voltando, ela cairia lá de cima)
  await J(a, () => { const g = window.__jogo, j = g.jog, x = Math.floor(j.pos.x), z = Math.floor(j.pos.z); for (let y = 89; y > 0; y--) if (g.mundo.bloco(x, y, z) && g.mundo.bloco(x, y, z) !== 3) { j.pos.y = y + 1; break; } j.vel.y = 0; });
  await esperar(a, 4000); // o corpo (posição e vida) é guardado a cada 3 s
  await J(a, () => { window.__jogo.mercado.e.desg = {}; });
  await voltar(a);
  ok(await ate(a, (d0) => ((window.__jogo.mercado.e.desg?.[1120] || [])[0] | 0) === d0, d0, 6000), 'online: voltou e a sala devolveu o desgaste das botas (' + await J(a, () => JSON.stringify(window.__jogo.mercado.e.desg)) + ')');
  ok((await vestido(a))[3] === 1120 && (await hud(a)).vis, 'online: as botas continuam vestidas ' + await J(a, () => JSON.stringify([window.__jogo.mercado.e.itens, window.__jogo.inv.s.map((x) => x && x.id), window.__jogo.mundoAtual && window.__jogo.mundoAtual.nome])));
  await bt.context().close(); await a.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

// Baú (como no clássico): criar na bancada com 8 tábuas, colocar, tocar para abrir (27 espaços em cima da mochila),
// guardar e tirar coisas, a ferramenta guardada não conserta, fechar e abrir de novo, quebrar o baú derruba tudo.
// Tablet sem internet; online (2 jogadores) o baú é o mesmo para os dois e a sala confere tudo.
// Uso: python3 -m http.server 8765 -d public, a sala (8790) e o pages dev (8788), e
//   URL=http://localhost:8765 ONLINE=http://localhost:8788 SAIDA=/tmp node testes/teste-bau.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE, SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(100); }
  return false;
}
const BAU = 223, PEDRISCO = 20, PIC = 1002, TABUAS = 8, BANCADA = 34, TRONCO = 6;
const qtd = (p, id) => J(p, (id) => window.__jogo.mercado.qtd(id), id);
const noBau = (p) => J(p, () => { const J_ = window.__jogo, a = J_.bauAberto; return a ? (J_.baus.get(a.k) || []).filter(Boolean) : null; });
const espaco = (p, id) => J(p, (id) => window.__jogo.inv.s.findIndex((s) => s && s.id === id), id);
const palco = (p, c = null) => p.evaluate((c) => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = c ? c[0] : Math.floor(j.pos.x), z0 = c ? c[2] : Math.floor(j.pos.z), y0 = 60;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    m.definir(x0 + dx, y0 - 1, z0 + dz, 3); m.definir(x0 + dx, y0, z0 + dz, 3);
    for (let dy = 1; dy <= 20; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0);
  }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0.6;
  return [x0, y0, z0];
}, c);
// de pé em c, olhando para o chão 2 blocos à frente (colocar põe ali; o bloco que estiver lá é o mirado)
const olharAlvo = (p, c) => J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = -0.48; }, c);
const segurar = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
const tocarMeio = async (p) => { const m = await J(p, () => ({ x: innerWidth / 2, y: innerHeight / 2 })); await p.touchscreen.tap(m.x, m.y); };
async function quebrarEm(p, x, y, z) {
  return J(p, async ([x, y, z]) => {
    for (let i = 0; i < 40 && window.__jogo.mundo.bloco(x, y, z); i++) { window.__jogo.quebrar(null); await new Promise((r) => setTimeout(r, 260)); }
    return window.__jogo.mundo.bloco(x, y, z) === 0;
  }, [x, y, z]);
}
async function pegarTudo(p, c) {
  await esperar(p, 700);
  for (let k = 0; k < 8; k++) {
    const l = await J(p, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z]));
    if (!l.length) break;
    await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = Math.max(j.pos.y, y); }, l[0]);
    await esperar(p, 900);
  }
  await olharAlvo(p, c);
}
const acharPerto = (p, c, bl) => J(p, ([x, y, z, bl]) => { const m = window.__jogo.mundo; for (let dy = 0; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -5; dz <= 1; dz++) if (m.bloco(x + dx, y + dy, z + dz) === bl) return [x + dx, y + dy, z + dz]; return null; }, [...c, bl]);

// ================= tablet, sem internet =================
{
  const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(m.text()); });
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  ok(await J(p, () => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo é de coletar e criar');
  const c = await palco(p); await esperar(p, 600);
  // 8 tábuas, 20 pedriscos e uma picareta de pedra já bem usada (40 de 131)
  await J(p, ([T, P, K]) => { const m = window.__jogo.mercado; m.e.itens[T] = 8; m.e.itens[P] = 20; m.e.itens[K] = 1; m.e.desg = { [K]: [40] }; m.recebeu(m.e); }, [TABUAS, PEDRISCO, PIC]);
  // bancada do lado e o baú pelo livro de receitas da bancada
  await J(p, ([x, y, z, B]) => window.__jogo.mundo.definir(x + 2, y + 1, z, B), [...c, BANCADA]);
  await esperar(p, 300);
  await J(p, () => window.__jogo.abrirInventario('criar'));
  await p.waitForSelector('#inventario:not([hidden]) [data-receita=bau]');
  await p.tap('[data-receita=bau]'); await esperar(p, 300);
  await p.click('#inv-saida', { modifiers: ['Shift'] }); await esperar(p, 300);
  ok(await qtd(p, BAU) === 1 && await qtd(p, TABUAS) === 0, `criou o baú na bancada com 8 tábuas (baú ${await qtd(p, BAU)}, tábuas ${await qtd(p, TABUAS)})`);
  await p.screenshot({ path: SAIDA + '/bau-0-receita.png' });
  await p.click('#inventario [data-fechar]'); await esperar(p, 300);
  // coloca o baú no chão com o toque
  await olharAlvo(p, c); await esperar(p, 400); await segurar(p, BAU);
  await tocarMeio(p); await esperar(p, 800);
  const ob = await acharPerto(p, c, BAU);
  ok(!!ob && await qtd(p, BAU) === 0, 'colocou o baú com o toque ' + JSON.stringify(ob));
  // toca no baú: abre com 27 espaços em cima da mochila
  await J(p, ([x, y, z]) => { const J_ = window.__jogo, j = J_.jog, cam = J_.camera, dx = x + 0.5 - cam.position.x, dz = z + 0.5 - cam.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y + 0.9 - cam.position.y, Math.hypot(dx, dz)); }, ob);
  await esperar(p, 300); await tocarMeio(p); await esperar(p, 700);
  ok(await p.isVisible('#bau-painel') && await p.locator('#bau-painel .slot-inv').count() === 27 && (await p.textContent('#inv-titulo')) === 'Baú', 'tocou no baú: abriu com 27 espaços e o título Baú');
  // mover rápido: toca na pilha da mochila e ela vai para o baú
  await p.tap('#inv-rapido'); await esperar(p, 200);
  await p.tap(`.slot-inv[data-l=s][data-i="${await espaco(p, PEDRISCO)}"]`); await esperar(p, 300);
  await p.tap(`.slot-inv[data-l=s][data-i="${await espaco(p, PIC)}"]`); await esperar(p, 300);
  let dentro = await noBau(p);
  ok(await qtd(p, PEDRISCO) === 0 && await qtd(p, PIC) === 0 && JSON.stringify(dentro) === JSON.stringify([[PEDRISCO, 20, 0, 0], [PIC, 1, 0, 40]]), 'guardou os 20 pedriscos e a picareta (com o desgaste dela) ' + JSON.stringify(dentro));
  ok(await p.locator('#bau-painel .slot-inv[data-i="1"] .desg').count() === 1, 'a picareta no baú mostra a barrinha de uso');
  await p.screenshot({ path: SAIDA + '/bau-1-guardou.png' });
  await p.tap('#inv-rapido'); await esperar(p, 200);
  // tocar num espaço do baú tira para a mochila
  await p.tap('#bau-painel .slot-inv[data-i="0"]'); await esperar(p, 300);
  ok(await qtd(p, PEDRISCO) === 20 && JSON.stringify(await noBau(p)) === JSON.stringify([[PIC, 1, 0, 40]]), 'tocou nos pedriscos do baú: voltaram para a mochila');
  // fecha e abre de novo: a picareta continua lá; e ficou guardado no aparelho
  await p.click('#inventario [data-fechar]'); await esperar(p, 300);
  ok(await J(p, () => { const o = JSON.parse(localStorage.getItem('pradaria.baus.local') || '{}'); return Object.values(o).some((b) => b.some((s) => s && s[0] === 1002 && s[3] === 40)); }), 'o baú ficou guardado no aparelho');
  await tocarMeio(p); await esperar(p, 700);
  ok(JSON.stringify(await noBau(p)) === JSON.stringify([[PIC, 1, 0, 40]]), 'abriu de novo: a picareta continua no baú');
  // tira a picareta: o desgaste volta junto (o baú não conserta)
  await p.tap('#bau-painel .slot-inv[data-i="1"]'); await esperar(p, 300);
  ok(await qtd(p, PIC) === 1 && await J(p, () => JSON.stringify(window.__jogo.mercado.e.desg[1002])) === '[40]', 'tirou a picareta: continua gasta (40), o baú não conserta');
  // guarda de novo e quebra o baú: tudo cai no chão
  await p.tap('#inv-rapido'); await esperar(p, 200);
  await p.tap(`.slot-inv[data-l=s][data-i="${await espaco(p, PIC)}"]`); await esperar(p, 300);
  await p.tap(`.slot-inv[data-l=s][data-i="${await espaco(p, PEDRISCO)}"]`); await esperar(p, 300);
  await p.tap('#inv-rapido'); await esperar(p, 200);
  await p.click('#inventario [data-fechar]'); await esperar(p, 300);
  ok(await quebrarEm(p, ...ob), 'quebrou o baú');
  await esperar(p, 600);
  const caiu = await J(p, () => window.__jogo.drops.lista().map((d) => d.id).sort());
  ok(caiu.includes(BAU) && caiu.includes(PIC) && caiu.includes(PEDRISCO), 'o baú, a picareta e os pedriscos caíram no chão ' + JSON.stringify(caiu));
  await p.screenshot({ path: SAIDA + '/bau-2-quebrou.png' });
  await pegarTudo(p, c);
  ok(await qtd(p, BAU) === 1 && await qtd(p, PEDRISCO) === 20 && await qtd(p, PIC) === 1 && await J(p, () => JSON.stringify(window.__jogo.mercado.e.desg[1002])) === '[40]', 'pegou tudo de volta, a picareta ainda gasta');
  await ctx.close();
}

// ================= online, 2 jogadores =================
if (ONLINE) {
  const sfx = Array.from({ length: 6 }, () => 'bdgkmvwxyz'[Math.floor(Math.random() * 10)]).join('');
  async function pagina(nome, toque) {
    const ctx = await b.newContext(toque ? { ...devices['iPad (gen 7) landscape'] } : { viewport: { width: 1100, height: 720 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
    await p.goto(ONLINE + '/#teste');
    await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome + sfx); await p.fill('#c-senha', 'senha123');
    if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
    if (await p.isVisible('#c-nasc .d-ano')) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '1990'); }
    await p.click('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 90000 }); if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
    await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 });
    return p;
  }
  const a = await pagina('Ana');
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Bau');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', true);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2500);
  const c = await palco(a); await esperar(a, 800); await palco(bt, c);
  await J(bt, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 3.5; j.pos.z = z + 3.5; }, c);
  // a Ana junta 3 troncos e um baú de verdade (a sala confere cada bloco quebrado)
  let nl = 0;
  const lugar = () => { const k = nl++; return [c[0] - 6 + (k % 12), c[1], c[2] + (k >= 12 ? 5 : 0)]; };
  const quebrarPegar = async (bl) => { const l = lugar(); await J(a, ([x, y, z, bl]) => window.__jogo.mundo.definir(x, y + 1, z - 2, bl), [...l, bl]); await olharAlvo(a, l); await esperar(a, 400); await segurar(a, 0); const q = await quebrarEm(a, l[0], l[1] + 1, l[2] - 2); await esperar(a, 500); await pegarTudo(a, l); return q; };
  for (let k = 0; k < 3; k++) await quebrarPegar(TRONCO);
  await quebrarPegar(BAU);
  ok(await qtd(a, TRONCO) === 3 && await qtd(a, BAU) === 1, `online: Ana tem 3 troncos e 1 baú (a sala conferiu) (${await qtd(a, TRONCO)}, ${await qtd(a, BAU)})`);
  // coloca o baú, abre e guarda os troncos
  const cb = lugar();
  await J(a, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 0), cb);
  await olharAlvo(a, cb); await esperar(a, 300); await segurar(a, BAU);
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 900);
  const ob = await acharPerto(a, cb, BAU);
  ok(!!ob && JSON.stringify(await acharPerto(bt, cb, BAU)) === JSON.stringify(ob), 'online: o Beto vê o baú da Ana no mesmo lugar ' + JSON.stringify(ob));
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 900);
  ok(await a.isVisible('#bau-painel'), 'online: Ana abriu o baú');
  await a.click(`.slot-inv[data-l=s][data-i="${await espaco(a, TRONCO)}"]`, { modifiers: ['Shift'] }); await esperar(a, 1200);
  ok(await qtd(a, TRONCO) === 0 && JSON.stringify(await noBau(a)) === JSON.stringify([[TRONCO, 3, 0, 0]]), 'online: Ana guardou os 3 troncos (a sala confirmou) ' + JSON.stringify(await noBau(a)));
  await a.screenshot({ path: SAIDA + '/bau-online-ana.png' });
  await a.keyboard.press('Escape'); await esperar(a, 300);
  // o Beto chega, abre o mesmo baú com o toque e vê os troncos
  await olharAlvo(bt, cb); await esperar(bt, 500);
  await tocarMeio(bt); await esperar(bt, 1200);
  ok(await bt.isVisible('#bau-painel') && await ate(bt, () => /Tronco/.test(document.querySelector('#bau-painel .slot-inv[data-i="0"]')?.getAttribute('aria-label') || ''), null, 4000), 'online: o Beto abriu o mesmo baú e vê os troncos da Ana');
  await bt.screenshot({ path: SAIDA + '/bau-online-beto.png' });
  await bt.tap('#bau-painel .slot-inv[data-i="0"]'); await esperar(bt, 1500);
  ok(await qtd(bt, TRONCO) === 3, 'online: o Beto tirou os 3 troncos (a sala deu para ele)');
  // a Ana tenta tirar os troncos que já saíram (mandando direto para a sala): a sala não deixa
  await J(a, ([x, y, z]) => window.__jogo.sala.enviar({ t: 'bau-tirar', x, y, z, k: 0 }), ob); await esperar(a, 1500);
  ok(await qtd(a, TRONCO) === 0, 'online: Ana tentou tirar os troncos que já saíram e a sala não deixou');
  // o Beto tenta pôr 64 pedriscos que não tem: a sala não deixa
  await J(bt, ([x, y, z]) => window.__jogo.sala.enviar({ t: 'bau-por', x, y, z, k: 5, id: 20, n: 64 }), ob); await esperar(bt, 1500);
  ok(await ate(bt, () => !(window.__jogo.baus.get(window.__jogo.bauAberto?.k) || []).some((s) => s && s[0] === 20), null, 2000), 'online: o Beto tentou pôr pedrisco que não tem e a sala não deixou');
  // de longe não dá para mexer no baú
  await J(bt, ([x, y, z]) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = x + 40; }, ob); await esperar(bt, 3500);
  await J(bt, ([x, y, z]) => window.__jogo.sala.enviar({ t: 'bau-por', x, y, z, k: 0, id: 6, n: 3 }), ob); await esperar(bt, 1500);
  ok(await qtd(bt, TRONCO) === 3, 'online: de longe o Beto não consegue guardar no baú');
  // o Beto volta e quebra o baú com coisa dentro: cai no chão para todo mundo
  await olharAlvo(bt, cb); await J(bt, () => { window.__jogo.jog.voando = false; }); await esperar(bt, 2500);
  await J(bt, () => window.__jogo.abrirInventario('mochila'));
  await bt.keyboard.press('Escape');
  await tocarMeio(bt); await esperar(bt, 1200);
  await bt.tap('#inv-rapido'); await esperar(bt, 200);
  await bt.tap(`.slot-inv[data-l=s][data-i="${await espaco(bt, TRONCO)}"]`); await esperar(bt, 1200);
  await bt.tap('#inv-rapido'); await esperar(bt, 200);
  await bt.click('#inventario [data-fechar]'); await esperar(bt, 300);
  await segurar(bt, 0);
  ok(await quebrarEm(bt, ...ob), 'online: o Beto quebrou o baú');
  ok(await ate(a, () => { const l = window.__jogo.drops.lista().map((d) => d.id); return l.includes(223) && l.includes(6); }, null, 5000), 'online: a Ana vê o baú e os troncos no chão');
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

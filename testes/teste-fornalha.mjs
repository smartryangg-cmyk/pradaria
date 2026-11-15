// Jogo clássico: minérios só caem com a picareta certa, a fornalha (criar na bancada, colocar, abrir, pôr minério e
// carvão, esperar, tirar as barras), ferramentas de ferro, a barrinha de uso, quebrar a fornalha derruba o que tinha.
// Computador e celular sem internet; online (2 jogadores) a fornalha é a mesma para os dois e a sala confere tudo.
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-fornalha.mjs
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
const qtd = (p, id) => J(p, (id) => window.__jogo.mercado.qtd(id), id);
async function mundo(ctx, toque) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(m.text()); });
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  return p;
}
// um chão de pedra lá no alto (igual em qualquer semente)
const palco = (p, c = null) => p.evaluate((c) => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = c ? c[0] : Math.floor(j.pos.x), z0 = c ? c[2] : Math.floor(j.pos.z), y0 = c ? c[1] : 60;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    m.definir(x0 + dx, y0 - 1, z0 + dz, 3); m.definir(x0 + dx, y0, z0 + dz, 3);
    for (let dy = 1; dy <= 20; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0);
  }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0.6;
  return [x0, y0, z0];
}, c);
// fica de frente para o lugar do alvo (2 blocos à frente, na altura dos pés)
const olharAlvo = (p, c) => J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = -0.48; }, c);
// onde está o bloco b perto do lugar c (colocar põe na face que a mira acertou)
const acharPerto = (p, c, b) => J(p, ([x, y, z, b]) => { const m = window.__jogo.mundo; for (let dy = 0; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -5; dz <= 1; dz++) if (m.bloco(x + dx, y + dy, z + dz) === b) return [x + dx, y + dy, z + dz]; return null; }, [...c, b]);
const segurar = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
// põe o bloco no alvo e quebra com o que está na mão (cliques de verdade no jogo: quebrar())
async function quebrarAlvo(p, c, b, mao) {
  await J(p, ([x, y, z, b]) => window.__jogo.mundo.definir(x, y + 1, z - 2, b), [...c, b]);
  await olharAlvo(p, c); await esperar(p, 400);
  await segurar(p, mao);
  return J(p, async ([x, y, z]) => {
    for (let i = 0; i < 40 && window.__jogo.mundo.bloco(x, y + 1, z - 2); i++) { window.__jogo.quebrar(null); await new Promise((r) => setTimeout(r, 260)); }
    return window.__jogo.mundo.bloco(x, y + 1, z - 2) === 0;
  }, c);
}
// anda até cada coisa no chão (pega de verdade, como o jogador)
async function pegarTudo(p, c) {
  await esperar(p, 700);
  for (let k = 0; k < 6; k++) {
    const l = await J(p, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z]));
    if (!l.length) break;
    await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = Math.max(j.pos.y, y); }, l[0]);
    await esperar(p, 900);
  }
  await olharAlvo(p, c);
}

// ================= computador, sem internet =================
if (PARTES.includes('pc')) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await mundo(ctx, false);
  ok(await J(p, () => window.__jogo.vida.classico()), 'mundo novo é o jogo clássico');
  const c = await palco(p); await esperar(p, 600);

  // pedra com a mão: quebra e não dá nada, e o jogo diz que precisa de picareta
  ok(await quebrarAlvo(p, c, 3, 0), 'quebrou a pedra com a mão (demora)');
  await esperar(p, 500);
  ok(await J(p, () => window.__jogo.drops.lista().length) === 0, 'pedra com a mão não deu nada');
  const av = await J(p, () => document.querySelector('#aviso')?.textContent || '');
  ok(/picareta de madeira/i.test(av), `avisou: "${av}"`);
  await p.screenshot({ path: SAIDA + '/fornalha-pc-sem-picareta.png' });

  // com picareta de madeira: pedra e carvão saem; ferro não (precisa de pedra)
  await J(p, () => window.__jogo.mercado.mexer({ t: 'pegar', id: 1001, n: 1 }, true)); await esperar(p, 300);
  ok(await quebrarAlvo(p, c, 3, 1001), 'quebrou pedra com a picareta de madeira');
  await pegarTudo(p, c);
  ok(await qtd(p, 3) === 1, 'pegou a pedra');
  await quebrarAlvo(p, c, 66, 1001); await pegarTudo(p, c);
  ok(await qtd(p, 1100) === 1 && await qtd(p, 66) === 0, 'minério de carvão deu 1 carvão (item)');
  await quebrarAlvo(p, c, 67, 1001); await esperar(p, 600);
  ok(await J(p, () => window.__jogo.drops.lista().length) === 0, 'minério de ferro com picareta de madeira: nada');
  ok(/picareta de pedra/i.test(await J(p, () => document.querySelector('#aviso')?.textContent || '')), 'avisou que o ferro precisa de picareta de pedra');
  await J(p, () => window.__jogo.mercado.mexer({ t: 'pegar', id: 1002, n: 1 }, true)); await esperar(p, 300);
  await quebrarAlvo(p, c, 67, 1002); await pegarTudo(p, c);
  ok(await qtd(p, 67) === 1, 'minério de ferro com picareta de pedra: caiu o minério');
  // a picareta gastou: barrinha de uso na barra
  ok(await J(p, () => !!document.querySelector('#barra .slot .desg')), 'a picareta usada mostra a barrinha de uso na barra');
  await p.screenshot({ path: SAIDA + '/fornalha-pc-barrinha.png' });

  // criar a fornalha na bancada (pela tela de receitas)
  await J(p, () => window.__jogo.mercado.mexer({ t: 'pegar', id: 20, n: 8 }, true));
  await J(p, () => window.__jogo.mercado.mexer({ t: 'pegar', id: 67, n: 2 }, true));
  await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 34), c);
  await olharAlvo(p, c); await esperar(p, 400); await segurar(p, 1100);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 500);
  ok(await p.isVisible('#inventario') && (await p.textContent('#inv-titulo')) === 'Bancada', 'tocou na bancada: abriu a bancada');
  await p.click('#abas-inv button[data-aba=criar]'); await esperar(p, 300);
  await p.click('.receita[data-receita=fornalha]'); await esperar(p, 400);
  await p.click('#inv-saida'); await esperar(p, 400);
  await p.keyboard.press('Escape'); await esperar(p, 300);
  ok(await qtd(p, 188) === 1 && await qtd(p, 20) === 0, 'criou a fornalha com 8 pedriscos');

  // colocar a fornalha no chão
  await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 0), c);
  await olharAlvo(p, c); await esperar(p, 300); await segurar(p, 188);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 400);
  const onde = await acharPerto(p, c, 188);
  ok(!!onde && await qtd(p, 188) === 0, `colocou a fornalha (${onde}, ${await qtd(p, 188)}, ${JSON.stringify(await J(p, () => [...window.__jogo.fornos.keys()]))})`);
  await p.screenshot({ path: SAIDA + '/fornalha-pc-no-chao.png' });

  // abrir: tela da fornalha com a mochila embaixo
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 500);
  ok((await p.textContent('#inv-titulo')) === 'Fornalha' && await p.isVisible('#forno-painel'), 'tocou na fornalha: abriu a fornalha');
  // pôr os 3 minérios (clica na pilha, clica no espaço de cima) e o carvão (embaixo)
  const espaco = (id) => J(p, (id) => window.__jogo.inv.s.findIndex((s) => s && s.id === id), id);
  let i = await espaco(67);
  await p.click(`.slot-inv[data-l=s][data-i="${i}"]`); await p.click('.forno-e'); await esperar(p, 300);
  i = await espaco(1100);
  await p.click(`.slot-inv[data-l=s][data-i="${i}"]`); await p.click('.forno-c'); await esperar(p, 400);
  ok(await qtd(p, 67) === 0 && await qtd(p, 1100) === 0, 'pôs 3 minérios de ferro e 1 carvão');
  ok(await ate(p, () => document.querySelector('#forno-painel').classList.contains('acesa'), null, 2000), 'a fornalha acendeu');
  await esperar(p, 4000);
  await p.screenshot({ path: SAIDA + '/fornalha-pc-assando.png' });
  ok(await ate(p, () => /Barra de ferro/.test(document.querySelector('.forno-s')?.getAttribute('aria-label') || ''), null, 9000), 'depois de 10 s a primeira barra de ferro aparece');
  ok(await ate(p, () => /\(3\)/.test(document.querySelector('.forno-s')?.getAttribute('aria-label') || ''), null, 22000), 'as 3 barras ficaram prontas (30 s)');
  await p.click('.forno-s'); await esperar(p, 400);
  ok(await qtd(p, 1101) === 3, 'tirou as 3 barras de ferro para a mochila');
  ok(await J(p, () => { const f = window.__jogo.fornos.values().next().value; return f && f.q > 0; }), 'o carvão continua queimando (dura 80 s)');
  await p.screenshot({ path: SAIDA + '/fornalha-pc-pronto.png' });
  // shift + clique numa pilha manda direto para a fornalha (carne crua vai em cima)
  await J(p, () => window.__jogo.mercado.mexer({ t: 'pegar', id: 1007, n: 2 }, true)); await esperar(p, 400);
  await J(p, () => window.__jogo.abrirInventario()); await esperar(p, 300);
  i = await espaco(1007);
  await p.click(`.slot-inv[data-l=s][data-i="${i}"]`, { modifiers: ['Shift'] }); await esperar(p, 400);
  ok(await qtd(p, 1007) === 0 && /Carne/.test(await p.getAttribute('.forno-e', 'aria-label')), 'Shift no pedaço de carne: foi direto para a fornalha');
  await p.keyboard.press('Escape'); await esperar(p, 300);
  ok(await J(p, () => Object.keys(JSON.parse(localStorage.getItem('pradaria.fornos.local') || '{}')).length) === 1, 'a fornalha ficou guardada no aparelho');

  // picareta de ferro na bancada: 3 barras + 2 gravetos
  await J(p, () => window.__jogo.mercado.mexer({ t: 'pegar', id: 1000, n: 2 }, true)); await esperar(p, 200);
  await J(p, ([x, y, z]) => { window.__jogo.mundo.definir(x + 2, y + 1, z, 34); }, c); await esperar(p, 300);
  await J(p, () => window.__jogo.mercado.criar('picareta-ferro', window.__jogo.bancadaPerto(), 1)); await esperar(p, 300);
  ok(await qtd(p, 1105) === 1 && await qtd(p, 1101) === 0, 'criou a picareta de ferro');
  // ouro e diamante com ferro
  const c2 = [c[0] + 4, c[1], c[2]];
  await quebrarAlvo(p, c2, 69, 1105); await pegarTudo(p, c2);
  ok(await qtd(p, 1103) === 1, 'minério de diamante com picareta de ferro: 1 diamante');

  // quebrar a fornalha com coisa dentro: cai tudo no chão
  await olharAlvo(p, c); await esperar(p, 300); await segurar(p, 1105);
  await J(p, async ([x, y, z]) => { for (let k = 0; k < 20 && window.__jogo.mundo.bloco(x, y, z); k++) { window.__jogo.quebrar(null); await new Promise((r) => setTimeout(r, 260)); } }, onde);
  await esperar(p, 700);
  const noChao = await J(p, () => window.__jogo.drops.lista().map((d) => d.id).sort());
  ok(noChao.includes(188) && (noChao.includes(1007) || noChao.includes(1104)), `quebrou a fornalha: ela e a carne caíram no chão (${noChao})`);
  await p.screenshot({ path: SAIDA + '/fornalha-pc-quebrou.png' });
  await ctx.close();
}

// ================= celular (toque), sem internet =================
for (const [nome, dev] of PARTES.includes('toque') ? [['celular', devices['Pixel 7']], ['tablet', devices['Galaxy Tab S4']]] : []) {
  const ctx = await b.newContext({ ...dev });
  const p = await mundo(ctx, true);
  const c = await palco(p); await esperar(p, 600);
  await J(p, () => { const m = window.__jogo.mercado; m.mexer({ t: 'pegar', id: 188, n: 1 }, true); m.mexer({ t: 'pegar', id: 4, n: 2 }, true); m.mexer({ t: 'pegar', id: 8, n: 1 }, true); });
  await esperar(p, 300);
  await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 188), c);
  await olharAlvo(p, c); await esperar(p, 400);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 600);
  ok(await p.isVisible('#forno-painel'), `${nome}: abriu a fornalha`);
  const espaco = (id) => J(p, (id) => window.__jogo.inv.s.findIndex((s) => s && s.id === id), id);
  await p.tap(`.slot-inv[data-l=s][data-i="${await espaco(4)}"]`); await p.tap('.forno-e'); await esperar(p, 300);
  await p.tap(`.slot-inv[data-l=s][data-i="${await espaco(8)}"]`); await p.tap('.forno-c'); await esperar(p, 300);
  ok(await qtd(p, 4) === 0 && await qtd(p, 8) === 0, `${nome}: tocou e pôs areia e tábua`);
  const caixa = await J(p, () => { const r = document.querySelector('#inventario .caixa').getBoundingClientRect(); return [r.width, innerWidth]; });
  ok(caixa[0] <= caixa[1], `${nome}: a janela cabe na tela (${caixa})`);
  ok(await ate(p, () => /Vidro/.test(document.querySelector('.forno-s')?.getAttribute('aria-label') || ''), null, 14000), `${nome}: a areia virou vidro`);
  await p.screenshot({ path: SAIDA + `/fornalha-${nome}.png` });
  await p.tap('.forno-s'); await esperar(p, 400);
  ok(await qtd(p, 9) === 1, `${nome}: tocou e pegou o vidro`);
  await ctx.close();
}

// ================= online: a fornalha é do mundo (os dois usam a mesma) =================
if (PARTES.includes('online')) {
  const letras = () => Array.from({ length: 6 }, () => 'bdgkmvwxyz'[Math.floor(Math.random() * 10)]).join('');
  const sfx = letras();
  async function pagina(nome, toque) {
    const ctx = await b.newContext(toque ? { ...devices['Galaxy Tab S4'] } : { viewport: { width: 1100, height: 720 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Fornalha');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', true);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2500);
  const c = await palco(a); await esperar(a, 800); await palco(bt, c);
  await J(bt, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 3.5; j.pos.z = z + 3.5; }, c);
  // Ana faz tudo do começo, e a sala confere cada passo: troncos -> tábuas -> gravetos -> picareta de madeira.
  // (cada bloco num lugar novo: a sala só acredita no "o que tinha ali" do aparelho onde ninguém mexeu ainda)
  let nl = 0;
  const lugar = () => { const k = nl++; return [c[0] - 6 + (k % 12), c[1], c[2] + (k >= 12 ? 5 : 0)]; };
  const quebrarPegar = async (bl, mao) => { const l = lugar(); const q = await quebrarAlvo(a, l, bl, mao); await esperar(a, 500); await pegarTudo(a, l); return q; };
  for (let k = 0; k < 3; k++) await quebrarPegar(6, 0);
  ok(await qtd(a, 6) === 3, 'online: Ana pegou 3 troncos (' + await qtd(a, 6) + ')');
  // tábuas, a bancada (criada e colocada de verdade: a sala só conta a bancada que alguém colocou), gravetos e a picareta
  await J(a, () => { const m = window.__jogo.mercado; m.criar('tabuas', false, 3); }); await esperar(a, 500);
  await J(a, () => { const m = window.__jogo.mercado; m.criar('bancada', false, 1); m.criar('graveto', false, 2); }); await esperar(a, 800);
  const cb = lugar();
  await J(a, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 0), cb);
  await olharAlvo(a, cb); await esperar(a, 400); await segurar(a, 34);
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 1200);
  ok(!!(await acharPerto(a, cb, 34)) && await qtd(a, 34) === 0, 'online: Ana criou e colocou a bancada');
  await J(a, () => window.__jogo.mercado.criar('picareta-madeira', true, 1)); await esperar(a, 900);
  ok(await qtd(a, 1001) === 1, 'online: Ana criou a picareta de madeira (a sala conferiu)');
  // pedra com a mão não dá nada (a sala também não dá)
  await quebrarPegar(3, 0);
  ok(await qtd(a, 3) === 0, 'online: pedra com a mão não deu nada');
  for (let k = 0; k < 3; k++) await quebrarPegar(3, 1001);
  await olharAlvo(a, cb); await esperar(a, 1500); // volta para perto da bancada
  await J(a, () => window.__jogo.mercado.criar('picareta-pedra', true, 1)); await esperar(a, 800);
  ok(await qtd(a, 1002) === 1, 'online: com 3 pedras criou a picareta de pedra (' + await qtd(a, 3) + ' pedras)');
  // a fornalha de verdade: 8 pedregulhos na bancada
  for (let k = 0; k < 8; k++) await quebrarPegar(20, 1002);
  await olharAlvo(a, cb); await esperar(a, 1500);
  await J(a, () => window.__jogo.mercado.criar('fornalha', true, 1)); await esperar(a, 900);
  ok(await qtd(a, 188) === 1 && await qtd(a, 20) === 0, 'online: Ana criou a fornalha com 8 pedregulhos (' + await qtd(a, 20) + ' sobraram)');
  // a sala não acredita em fornalha "do mundo": quebrar uma que só existe no aparelho não dá nada
  await quebrarPegar(188, 1002);
  ok(await qtd(a, 188) === 1, 'online: fornalha que ninguém colocou (só no aparelho) não deu nada (' + await qtd(a, 188) + ')');
  // minério: a sala confere se ali passa um veio daquele minério (gerador.js). Diamante numa pedra qualquer: nada
  await quebrarPegar(69, 1002); await quebrarPegar(67, 1002);
  ok(await qtd(a, 69) === 0 && await qtd(a, 1103) === 0 && await qtd(a, 67) === 0, 'online: minério onde não tem veio (aparelho mentindo) não deu nada');
  // no lugar certo do veio (embaixo da Ana, sem sair do lugar no mapa), o minério sai
  const veio = (bl) => J(a, async ([bl, usados]) => {
    const { minerioPossivel } = await import('/js/gerador.js');
    const j = window.__jogo.jog, m = window.__jogo.mundo, px = Math.floor(j.pos.x), pz = Math.floor(j.pos.z), cache = new Map();
    for (let y = 8; y < 50; y++) for (let r = 0; r <= 5; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = px + dx, z = pz + dz;
      if (!usados.includes(x + ',' + y + ',' + z) && minerioPossivel(m.semente, 96, x, y, z, bl, cache)) return [x, y, z];
    }
    return null;
  }, [bl, usados]);
  const usados = [];
  const minerar = async (bl) => {
    const v = await veio(bl); if (!v) return false;
    usados.push(v.join(','));
    const l = [v[0], v[1] - 1, v[2] + 2];
    await palco(a, l); await esperar(a, 600);
    await quebrarAlvo(a, l, bl, 1002); await esperar(a, 500); await pegarTudo(a, l);
    return true;
  };
  ok(await minerar(67) && await minerar(67) && await minerar(66), 'online: achou veios de ferro e de carvão perto da Ana');
  await olharAlvo(a, c); await esperar(a, 800); // volta para cima
  ok(await qtd(a, 67) === 2 && await qtd(a, 1100) === 1 && await qtd(a, 188) === 1, 'online: Ana tem 2 minérios de ferro, 1 carvão e a fornalha (' + JSON.stringify(await J(a, () => window.__jogo.mercado.e.itens)) + ')');
  const cf = lugar();
  await J(a, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 0), cf);
  // coloca a fornalha e abre
  await olharAlvo(a, cf); await esperar(a, 300); await segurar(a, 188);
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 800);
  const fa = await acharPerto(a, cf, 188);
  ok(!!fa && JSON.stringify(await acharPerto(bt, cf, 188)) === JSON.stringify(fa), 'online: o Beto vê a fornalha da Ana no mesmo lugar ' + JSON.stringify(fa));
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 800);
  ok(await a.isVisible('#forno-painel'), 'online: Ana abriu a fornalha');
  const espaco = (p, id) => J(p, (id) => window.__jogo.inv.s.findIndex((s) => s && s.id === id), id);
  await a.click(`.slot-inv[data-l=s][data-i="${await espaco(a, 67)}"]`); await a.click('.forno-e'); await esperar(a, 400);
  await a.click(`.slot-inv[data-l=s][data-i="${await espaco(a, 1100)}"]`); await a.click('.forno-c'); await esperar(a, 1200);
  ok(await qtd(a, 67) === 0 && await qtd(a, 1100) === 0, 'online: Ana pôs os minérios e o carvão (a sala confirmou)');
  await a.screenshot({ path: SAIDA + '/fornalha-online-ana.png' });
  await a.keyboard.press('Escape'); await esperar(a, 300);
  // o Beto chega e abre a mesma fornalha: vê o que a Ana pôs
  await olharAlvo(bt, cf); await esperar(bt, 400);
  await J(bt, () => window.__jogo.usar(null)); await esperar(bt, 1200);
  ok(await bt.isVisible('#forno-painel'), 'online: o Beto abriu a mesma fornalha');
  ok(await ate(bt, () => /Barra de ferro/.test(document.querySelector('.forno-s')?.getAttribute('aria-label') || '') || /Minério de ferro/.test(document.querySelector('.forno-e')?.getAttribute('aria-label') || ''), null, 4000), 'online: o Beto vê o minério (ou a barra) da Ana');
  ok(await ate(bt, () => /\(2\)/.test(document.querySelector('.forno-s')?.getAttribute('aria-label') || ''), null, 25000), 'online: as 2 barras ficaram prontas na tela do Beto');
  await bt.screenshot({ path: SAIDA + '/fornalha-online-beto.png' });
  await bt.tap('.forno-s'); await esperar(bt, 1500);
  ok(await qtd(bt, 1101) === 2, 'online: o Beto tirou as 2 barras (a sala deu para ele)');
  // não dá para tirar de novo (a sala confere)
  await J(a, ([x, y, z]) => window.__jogo.mercado.mexer({ t: 'forno-tirar', k: 's', f: { e: null, c: null, s: [1101, 2], q: 0, Q: 0, p: 0, t: Date.now() }, agora: Date.now() }, true) && window.__jogo.sala.enviar({ t: 'forno-tirar', x, y, z, k: 's' }), fa);
  await esperar(a, 1500);
  ok(await qtd(a, 1101) === 0, 'online: Ana tentou tirar as barras que já saíram e a sala não deixou');
  await bt.context().close();
  await a.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

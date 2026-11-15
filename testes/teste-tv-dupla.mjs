// Teste real da tela dividida na TV: /tv -> "Jogar em dois" -> /tv-dupla com duas metades,
// cada uma com o seu celular e a sua conta. O Jogador 1 cria um mundo online e o Jogador 2 entra
// nele com um OK; cada celular anda só com o seu boneco.
//   URL=http://localhost:8788 SAIDA=/tmp node testes/teste-tv-dupla.mjs
import { createRequire } from 'module'; const req = createRequire(import.meta.url); const { chromium, devices } = req('playwright');
const URL = process.env.URL || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const ok = (cond, txt) => { console.log((cond ? 'OK   ' : 'FALHOU ') + txt); if (!cond) process.exitCode = 1; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// duas contas de teste (apagadas no fim)
const senha = 'senha123', contas = [];
for (let i = 0; i < 2; i++) {
  const nome = 'tvd' + Math.random().toString(36).slice(2, 7);
  const r = await fetch(URL + '/api/cadastrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, senha, cor: i, nascimento: '2000-01-01' }) });
  ok(r.ok, 'conta de teste ' + (i + 1) + ' criada (' + nome + ')');
  contas.push(nome);
}

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const tvCtx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const tv = await tvCtx.newPage();
tv.on('pageerror', (e) => erros.push('TV: ' + e.message));
tv.on('console', (m) => { if (m.type() === 'error') erros.push('TV console: ' + m.text()); });

async function celular(codigo, n) {
  const ctx = await b.newContext({ ...devices['Pixel 7 landscape'] });
  const cel = await ctx.newPage();
  cel.on('pageerror', (e) => erros.push('CEL' + n + ': ' + e.message));
  cel.on('console', (m) => { if (m.type() === 'error') erros.push('CEL' + n + ' console: ' + m.text()); });
  await cel.goto(`${URL}/controle.html?c=${codigo}`);
  await cel.waitForFunction(() => document.body.classList.contains('ligado'), null, { timeout: 15000 });
  return { ctx, cel };
}
const codigoDe = async (f) => (await f.textContent('#tv-codigo')).replace(/\s/g, '');
// setas do celular até um elemento da tela (f = a página ou a metade da TV)
async function irAte(f, cel, sel) {
  const id = await f.evaluate((s) => { const el = document.querySelector(s); el.id = el.id || 'alvo-' + Math.random().toString(36).slice(2, 7); return el.id; }, sel);
  for (let i = 0; i < 40; i++) {
    const onde = await f.evaluate((id) => {
      const el = document.querySelector('.foco-tv') || document.activeElement, alvo = document.getElementById(id);
      if (el === alvo) return 'aqui';
      if (!el || el === document.body) return 'baixo';
      const a = el.getBoundingClientRect(), b = alvo.getBoundingClientRect();
      if (Math.abs(a.top - b.top) < 20) return a.left > b.left ? 'esq' : 'dir';
      return a.top > b.top ? 'cima' : 'baixo';
    }, id);
    if (onde === 'aqui') return true;
    if (process.env.DEPURAR) console.log('  ', onde, await f.evaluate(() => { const e = document.querySelector('.foco-tv') || document.activeElement; return e.tagName + '#' + e.id + '.' + e.className + ' @' + Math.round(e.getBoundingClientRect().top); }));
    await cel.tap(`[data-nav=${onde}]`); await espera(250);
  }
  return false;
}
const okCel = async (cel) => { await cel.tap('[data-nav=ok]'); await espera(250); };
async function escrever(f, cel, sel, txt, enviar) {
  ok(await irAte(f, cel, sel), 'setas chegam em ' + sel);
  await cel.waitForFunction(() => document.body.classList.contains('com-campo'));
  await cel.fill('#txt-cel', txt); await espera(300);
  if (enviar) { await cel.tap('#campo-cel button[type=submit]'); await espera(250); }
}
async function entrarNaConta(f, cel, nome) {
  ok(await irAte(f, cel, '#bt-entrar'), 'setas chegam em "Entrar"');
  await okCel(cel);
  await f.waitForSelector('#m-conta:not([hidden])');
  await escrever(f, cel, '#c-nome', nome);
  await escrever(f, cel, '#c-senha', senha, true);
  await f.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
}
async function andar(cel, ms = 1500) {
  const cdp = await cel.context().newCDPSession(cel);
  const a = await cel.locator('#area-andar').boundingBox();
  const x = a.x + a.width / 2, y = a.y + a.height * 0.6;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 10, id: 1 }] }); await espera(30); }
  await espera(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await espera(400);
}

// 1) /tv com um celular: "Jogar em dois" leva para a tela dividida
await tv.goto(URL + '/tv#teste');
await tv.waitForSelector('#tv-painel.tv-cheia:not([hidden])');
ok(await tv.evaluate(() => !document.querySelector('#tv-dois').hidden), 'tela do código da /tv mostra "Jogar em dois (tela dividida)"');
await espera(400);
const cod1 = await codigoDe(tv);
const c1 = await celular(cod1, 1);
await tv.waitForFunction(() => document.querySelector('#tv-painel').hidden, null, { timeout: 8000 });
await c1.cel.waitForFunction(() => document.body.classList.contains('menu'));
ok(await irAte(tv, c1.cel, '#bt-dividir-inicio'), 'setas do celular chegam em "Jogar em dois" no início');
await okCel(c1.cel);
await tv.waitForURL(/\/tv-dupla/, { timeout: 10000 });
ok(true, 'abriu a tela dividida');
await tv.waitForFunction(() => [...document.querySelectorAll('iframe')].length === 2);
const metade = async (n) => { for (let i = 0; i < 60; i++) { const f = tv.frames().find((x) => x.url().includes('p=' + n)); if (f) { try { await f.waitForFunction(() => !!window.__jogo, null, { timeout: 20000 }); return f; } catch {} } await espera(300); } throw new Error('sem metade ' + n); };
const j1 = await metade(1), j2 = await metade(2);
const lados = await tv.evaluate(() => [...document.querySelectorAll('iframe')].map((f) => { const r = f.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width), Math.round(r.height)]; }));
ok(lados[0][0] === 0 && lados[1][0] > 900 && lados[0][1] > 900 && lados[1][1] > 900 && lados[0][2] === 1080, 'duas metades lado a lado (' + JSON.stringify(lados) + ')');
// o celular 1 volta sozinho para a metade do Jogador 1 (mesmo código)
await j1.waitForFunction(() => document.querySelector('#tv-painel') && document.querySelector('#tv-painel').hidden && window.__jogo.tv.celulares === 1, null, { timeout: 20000 });
ok(true, 'celular 1 religou sozinho na metade do Jogador 1');
await c1.cel.waitForFunction(() => /Jogador 1/.test(document.querySelector('#estado').textContent), null, { timeout: 5000 });
ok(true, 'celular 1 mostra "Jogador 1"');
await j2.waitForSelector('#tv-painel.tv-cheia:not([hidden])');
const cod2 = await codigoDe(j2);
ok(/^[A-Z2-9]{6}$/.test(cod2) && cod2 !== cod1, 'metade do Jogador 2 tem outro código (' + cod2 + ')');
ok(/Jogador 2/.test(await j2.textContent('#tv-titulo')), 'metade 2 pede o celular do Jogador 2');
ok(await j2.evaluate(() => { const r = document.querySelector('#tv-qr svg').getBoundingClientRect(); return r.width > 150 && r.right <= innerWidth && r.bottom <= innerHeight; }), 'QR do Jogador 2 cabe na metade');
await tv.screenshot({ path: SAIDA + '/tvd-1-dois-codigos.png' });

// 2) celular 2 liga na metade 2
const c2 = await celular(cod2, 2);
await j2.waitForFunction(() => document.querySelector('#tv-painel').hidden, null, { timeout: 8000 });
await c2.cel.waitForFunction(() => /Jogador 2/.test(document.querySelector('#estado').textContent), null, { timeout: 5000 });
ok(true, 'celular 2 ligou na metade do Jogador 2');
ok(await j1.evaluate(() => window.__jogo.tv.celulares === 1) && await j2.evaluate(() => window.__jogo.tv.celulares === 1), 'cada metade com o seu celular');

// 3) cada um entra na sua conta (contas separadas)
await entrarNaConta(j1, c1.cel, contas[0]);
ok(true, 'Jogador 1 entrou na conta ' + contas[0]);
await entrarNaConta(j2, c2.cel, contas[1]);
ok(true, 'Jogador 2 entrou na conta ' + contas[1]);
ok((await j1.textContent('#j-nome')) === contas[0] && (await j2.textContent('#j-nome')) === contas[1], 'cada metade numa conta diferente');
await tv.screenshot({ path: SAIDA + '/tvd-2-contas.png' });

// 4) Jogador 1 cria um mundo online
ok(await irAte(j1, c1.cel, '#lista-jogos .jogo[data-jogo=pradaria]'), 'J1: setas chegam no Pradaria');
await okCel(c1.cel);
await j1.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
ok(await irAte(j1, c1.cel, '#bt-novo-mundo'), 'J1: setas chegam em "Novo mundo"');
await okCel(c1.cel);
await j1.waitForSelector('#m-novo:not([hidden])');
await escrever(j1, c1.cel, '#n-nome', 'Mundo da dupla');
ok(await irAte(j1, c1.cel, '#m-novo button[type=submit]'), 'J1: setas chegam em "Criar"');
await okCel(c1.cel);
await j1.waitForFunction(() => window.__jogo.jog && !document.querySelector('#hud').hidden && window.__jogo.sala, null, { timeout: 40000 });
ok(true, 'Jogador 1 está no mundo online');

// 5) Jogador 2 vê "Entrar no mundo do Jogador 1" já escolhido e entra com OK
await j2.waitForSelector('#tv-mundo-par', { timeout: 8000 });
ok(/Jogador 1: Mundo da dupla/.test(await j2.textContent('#tv-mundo-par')), 'metade 2 mostra "Entrar no mundo do Jogador 1: Mundo da dupla"');
await espera(400);
ok(await j2.evaluate(() => document.querySelector('#tv-mundo-par').classList.contains('foco-tv')), 'o botão já vem escolhido');
await tv.screenshot({ path: SAIDA + '/tvd-3-entrar-no-mundo.png' });
await okCel(c2.cel);
await j2.waitForFunction(() => window.__jogo.jog && !document.querySelector('#hud').hidden && window.__jogo.sala, null, { timeout: 40000 });
const cods = [await j1.evaluate(() => window.__jogo.mundoAtual.codigo), await j2.evaluate(() => window.__jogo.mundoAtual.codigo)];
ok(cods[0] && cods[0] === cods[1], 'os dois no mesmo mundo (' + cods[0] + ')');
await j1.waitForFunction(() => window.__jogo.outros >= 1, null, { timeout: 15000 });
await j2.waitForFunction(() => window.__jogo.outros >= 1, null, { timeout: 15000 });
ok(true, 'cada um vê o outro jogador no mundo');
await espera(2500);

// 6) cada celular anda só com o seu boneco
for (const f of [j1, j2]) await f.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.y += 25; });
const pos = async (f) => f.evaluate(() => ({ ...window.__jogo.jog.pos }));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
let a1 = await pos(j1), a2 = await pos(j2);
await andar(c1.cel);
let b1 = await pos(j1), b2 = await pos(j2);
ok(dist(a1, b1) > 1 && dist(a2, b2) < 0.3, `celular 1 anda só com o Jogador 1 (J1 ${dist(a1, b1).toFixed(1)}, J2 ${dist(a2, b2).toFixed(1)})`);
await andar(c2.cel);
const d1 = await pos(j1), d2 = await pos(j2);
ok(dist(b2, d2) > 1 && dist(b1, d1) < 0.3, `celular 2 anda só com o Jogador 2 (J2 ${dist(b2, d2).toFixed(1)}, J1 ${dist(b1, d1).toFixed(1)})`);
await tv.screenshot({ path: SAIDA + '/tvd-4-jogando.png' });
await c1.cel.screenshot({ path: SAIDA + '/tvd-cel1.png' });
await c2.cel.screenshot({ path: SAIDA + '/tvd-cel2.png' });
ok(await j2.evaluate(() => window.__jogo.ajustes.volMusica === 0) && await j1.evaluate(() => window.__jogo.ajustes.volMusica > 0), 'só a metade do Jogador 1 toca música');

// 7) pausa do Jogador 2: "Voltar para um jogador" volta para a /tv
await c2.cel.tap('#fila [data-acao=pausa]'); await espera(500);
ok(await j2.evaluate(() => !document.querySelector('#pausa').hidden), 'Pausa pelo celular 2 só na metade 2');
ok(await j1.evaluate(() => document.querySelector('#pausa').hidden), 'metade 1 continua jogando');
ok(await irAte(j2, c2.cel, '#bt-dividir-pausa'), 'setas chegam em "Voltar para um jogador"');
await okCel(c2.cel);
await tv.waitForURL(/\/tv(#teste)?$/, { timeout: 10000 });
await tv.waitForFunction(() => window.__jogo && window.__jogo.tv.celulares >= 1, null, { timeout: 20000 });
ok(true, 'voltou para a TV inteira e o celular 1 continua ligado');

// apaga as contas de teste
for (const nome of contas) {
  const ent = await (await fetch(URL + '/api/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, senha }) })).json();
  const r = await fetch(URL + '/api/eu', { method: 'DELETE', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ent.token }, body: JSON.stringify({ senha }) });
  ok(r.ok, 'conta de teste apagada (' + nome + ')');
}
console.log(erros.filter((e) => !/vibrate/.test(e)).join('\n') || 'sem erros no console');
await b.close();

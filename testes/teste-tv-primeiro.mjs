// Teste real da versão da TV (/tv): abre já na tela de ligar o celular; depois que o celular liga,
// tudo pelo celular: entrar na conta, escolher o Pradaria, criar um mundo online e jogar.
//   URL=http://localhost:8788 SAIDA=/tmp node testes/teste-tv-primeiro.mjs
import { createRequire } from 'module'; const req = createRequire(import.meta.url); const { chromium, devices } = req('playwright');
const URL = process.env.URL || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const ok = (cond, txt) => { console.log((cond ? 'OK   ' : 'FALHOU ') + txt); if (!cond) process.exitCode = 1; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// conta de teste (a TV entra nela usando o celular)
const nome = 'tv' + Math.random().toString(36).slice(2, 8), senha = 'senha123';
const r = await fetch(URL + '/api/cadastrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, senha, cor: 0, nascimento: '2000-01-01' }) });
ok(r.ok, 'conta de teste criada (' + nome + ')');

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
// TV: um navegador comum numa tela 1920x1080, abrindo o endereço /tv
const tvCtx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const tv = await tvCtx.newPage();
tv.on('pageerror', (e) => erros.push('TV: ' + e.message));
tv.on('console', (m) => { if (m.type() === 'error') erros.push('TV console: ' + m.text()); });
await tv.goto(URL + '/tv#teste');
await tv.waitForSelector('#tv-painel.tv-cheia:not([hidden])');
ok(await tv.evaluate(() => document.body.classList.contains('modo-tv') && document.body.classList.contains('tv-primeiro')), '/tv abre no Modo TV');
ok(await tv.evaluate(() => { const r = document.querySelector('#tv-painel').getBoundingClientRect(); return r.width >= innerWidth - 2 && r.height >= innerHeight - 2; }), 'a tela de ligar o celular ocupa a TV inteira');
await espera(500);
const codigo = (await tv.textContent('#tv-codigo')).replace(/\s/g, '');
ok(/^[A-Z2-9]{6}$/.test(codigo) && await tv.evaluate(() => !!document.querySelector('#tv-qr svg path')), 'QR e código ' + codigo + ' na tela');
await tv.screenshot({ path: SAIDA + '/tvp-1-ligar.png' });

// celular abre o endereço do QR
const celCtx = await b.newContext({ ...devices['Pixel 7 landscape'] });
const cel = await celCtx.newPage();
cel.on('pageerror', (e) => erros.push('CEL: ' + e.message));
cel.on('console', (m) => { if (m.type() === 'error') erros.push('CEL console: ' + m.text()); });
await cel.goto(`${URL}/controle.html?c=${codigo}`);
await cel.waitForFunction(() => document.body.classList.contains('ligado'), null, { timeout: 15000 });
await tv.waitForFunction(() => document.querySelector('#tv-painel').hidden, null, { timeout: 8000 });
ok(true, 'celular ligou: a tela do código sai sozinha');
ok(await tv.evaluate(() => !document.querySelector('#m-inicio').hidden && document.activeElement.classList.contains('foco-tv')), 'TV mostra o início com um botão escolhido');
await cel.waitForFunction(() => document.body.classList.contains('menu'));
await tv.screenshot({ path: SAIDA + '/tvp-2-inicio.png' });
await cel.screenshot({ path: SAIDA + '/tvp-cel-1-setas.png' });

const toque = async (sel) => { await cel.tap(sel); await espera(250); };
async function irAte(sel) {
  const id = await tv.evaluate((s) => { const el = document.querySelector(s); el.id = el.id || 'alvo-' + Math.random().toString(36).slice(2, 7); return el.id; }, sel);
  for (let i = 0; i < 40; i++) {
    const onde = await tv.evaluate((id) => {
      const el = document.activeElement, alvo = document.getElementById(id);
      if (el === alvo) return 'aqui';
      if (!el || el === document.body) return 'baixo';
      const a = el.getBoundingClientRect(), b = alvo.getBoundingClientRect();
      if (Math.abs(a.top - b.top) < 20) return a.left > b.left ? 'esq' : 'dir';
      return a.top > b.top ? 'cima' : 'baixo';
    }, id);
    if (onde === 'aqui') return true;
    if (process.env.DEPURAR) console.log('  ', onde, await tv.evaluate(() => { const e = document.activeElement; return e.tagName + '#' + e.id + '.' + e.className + ' ' + (e.textContent || '').trim().slice(0, 20) + ' @' + Math.round(e.getBoundingClientRect().top); }));
    await toque(`[data-nav=${onde}]`);
  }
  return false;
}
async function escrever(sel, txt, enviar) {
  ok(await irAte(sel), 'setas do celular chegam em ' + sel);
  await cel.waitForFunction(() => document.body.classList.contains('com-campo'));
  await cel.fill('#txt-cel', txt);
  await espera(300);
  if (enviar) await toque('#campo-cel button[type=submit]');
}

// entrar na conta pelo celular
ok(await irAte('#bt-entrar'), 'setas do celular chegam em "Entrar"');
await toque('[data-nav=ok]');
await tv.waitForSelector('#m-conta:not([hidden])');
await escrever('#c-nome', nome);
ok((await tv.inputValue('#c-nome')) === nome, 'nome escrito no celular aparece na TV');
await escrever('#c-senha', senha, true);
await tv.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
ok(true, 'entrou na conta pelo celular');
const visiveis = await tv.evaluate(() => [...document.querySelectorAll('#lista-jogos .jogo')].filter((j) => j.offsetParent).map((j) => j.dataset.jogo));
ok(visiveis.length === 1 && visiveis[0] === 'pradaria', 'na TV aparece só o Pradaria (' + visiveis.join(',') + ')');
await tv.screenshot({ path: SAIDA + '/tvp-3-jogos.png' });
ok(await irAte('#lista-jogos .jogo[data-jogo=pradaria]'), 'setas chegam no Pradaria');
await toque('[data-nav=ok]');
await tv.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
ok(await irAte('#bt-novo-mundo'), 'setas chegam em "Novo mundo"');
await toque('[data-nav=ok]');
await tv.waitForSelector('#m-novo:not([hidden])');
await escrever('#n-nome', 'Mundo da sala');
ok((await tv.inputValue('#n-nome')) === 'Mundo da sala', 'nome do mundo escrito no celular');
await tv.screenshot({ path: SAIDA + '/tvp-4-novo.png' });
ok(await irAte('#m-novo button[type=submit]'), 'setas chegam em "Criar"');
await toque('[data-nav=ok]');
await tv.waitForFunction(() => window.__jogo && window.__jogo.jog && !document.querySelector('#hud').hidden && window.__jogo.sala, null, { timeout: 40000 });
ok(true, 'mundo online criado e o jogo começou');
await cel.waitForFunction(() => !document.body.classList.contains('menu'));
ok(true, 'celular virou alavanca e botões');
await espera(2500);

// jogar: andar (voando, para não depender do terreno), olhar e abrir a mochila
await tv.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.y += 25; });
const p0 = await tv.evaluate(() => ({ ...window.__jogo.jog.pos, yaw: window.__jogo.jog.yaw }));
const cdp = await celCtx.newCDPSession(cel);
const aA = await cel.locator('#area-andar').boundingBox();
const ax = aA.x + aA.width / 2, ay = aA.y + aA.height * 0.6;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ax, y: ay, id: 1 }] });
for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ax, y: ay - i * 10, id: 1 }] }); await espera(30); }
await espera(1500);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const aO = await cel.locator('#area-olhar').boundingBox();
const ox = aO.x + aO.width / 2, oy = aO.y + aO.height / 2;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ox, y: oy, id: 2 }] });
for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ox + i * 12, y: oy, id: 2 }] }); await espera(25); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await espera(500);
const p1 = await tv.evaluate(() => ({ ...window.__jogo.jog.pos, yaw: window.__jogo.jog.yaw }));
ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, 'alavanca do celular anda no mundo online');
ok(Math.abs(p1.yaw - p0.yaw) > 0.3, 'arrastar no celular gira a câmera');
await tv.screenshot({ path: SAIDA + '/tvp-5-jogando.png' });
await cel.screenshot({ path: SAIDA + '/tvp-cel-2-jogando.png' });
await toque('#fila [data-acao=mochila]');
await espera(300);
ok(await tv.evaluate(() => !document.querySelector('#inventario').hidden), 'Mochila pelo celular abre na TV');
await toque('.lado-menu [data-nav=voltar]');
ok(await tv.evaluate(() => document.querySelector('#inventario').hidden), 'Voltar fecha');

// a TV recarrega: o mesmo celular volta sozinho, sem ler o código de novo
await tv.reload();
await tv.waitForSelector('#tv-painel.tv-cheia:not([hidden])');
await tv.waitForFunction(() => document.querySelector('#tv-painel').hidden, null, { timeout: 20000 });
ok(true, 'TV recarregou: o celular religou sozinho com o mesmo código');

// apaga a conta de teste (e o mundo dela), para não deixar lixo no site publicado
const ent = await (await fetch(URL + '/api/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, senha }) })).json();
const apagou = await fetch(URL + '/api/eu', { method: 'DELETE', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ent.token }, body: JSON.stringify({ senha }) });
ok(apagou.ok, 'conta de teste apagada');
console.log(erros.filter((e) => !/vibrate/.test(e)).join('\n') || 'sem erros no console');
await b.close();

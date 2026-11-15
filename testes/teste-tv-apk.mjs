// Teste real do app da TV (pradaria-tv.apk) num emulador de Android TV, com o site publicado.
// O app já está instalado e aberto (testes/teste-tv-apk.sh). Aqui:
//  - confere que o app abriu a versão da TV (/tv) com o QR e o código;
//  - um celular (Chromium) liga como controle, entra numa conta de teste e cria um mundo;
//  - o controle remoto da TV (teclas de verdade do Android pelo adb) anda nos menus e o Voltar volta;
//  - joga com o celular e o Voltar do controle pausa; segurar o Voltar pergunta se quer sair.
//   SAIDA=/tmp node testes/teste-tv-apk.mjs   (precisa do adb e do APK com DEPURAR_WEB=1)
import { createRequire } from 'module'; const req = createRequire(import.meta.url);
const { chromium, devices, _android } = req('playwright');
import { execFileSync } from 'child_process';
const URL = process.env.URL || 'https://pradaria.pages.dev', SAIDA = process.env.SAIDA || '/tmp';
const ok = (cond, txt) => { console.log((cond ? 'OK   ' : 'FALHOU ') + txt); if (!cond) process.exitCode = 1; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8' });
const tecla = async (k, ms = 700) => { adb('shell', 'input', 'keyevent', k); await espera(ms); };
let foto = 0;
const fotoTV = (nome) => { const f = `${SAIDA}/tv-apk-${++foto}-${nome}.png`; execFileSync('sh', ['-c', `adb exec-out screencap -p > "${f}"`]); };

const nome = 'tva' + Math.random().toString(36).slice(2, 7), senha = 'senha123';
const r = await fetch(URL + '/api/cadastrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, senha, cor: 0, nascimento: '2000-01-01' }) });
ok(r.ok, 'conta de teste criada (' + nome + ')');

const erros = [];
let cel, b;
try {
  const [dev] = await _android.devices();
  ok(!!dev, 'emulador de Android TV: ' + (dev && dev.model()));
  const wv = await dev.webView({ pkg: 'dev.pradaria.tv' }, { timeout: 60000 });
  const tv = await wv.page();
  tv.on('pageerror', (e) => erros.push('TV: ' + e.message));
  tv.on('console', (m) => { if (m.type() === 'error') erros.push('TV console: ' + m.text()); });
  ok(/\/tv\?appv=/.test(tv.url()), 'o app abriu ' + tv.url());
  await tv.waitForSelector('#tv-painel.tv-cheia:not([hidden])', { timeout: 60000 });
  ok(await tv.evaluate(() => document.body.classList.contains('modo-tv')), 'Modo TV ligado');
  ok(await tv.evaluate(() => /Android TV PradariaTV\//.test(navigator.userAgent)), 'o site vê que é a TV pelo app');
  ok(await tv.evaluate(() => { const r = document.querySelector('#tv-painel').getBoundingClientRect(); return r.width >= innerWidth - 2 && r.height >= innerHeight - 2; }), 'a tela de ligar o celular ocupa a TV inteira');
  ok(await tv.evaluate(() => innerWidth > innerHeight), 'tela deitada (' + await tv.evaluate(() => innerWidth + 'x' + innerHeight) + ')');
  await espera(1500);
  const codigo = (await tv.textContent('#tv-codigo')).replace(/\s/g, '');
  ok(/^[A-Z2-9]{6}$/.test(codigo) && await tv.evaluate(() => !!document.querySelector('#tv-qr svg path')), 'QR e código ' + codigo + ' na TV');
  fotoTV('ligar-celular');

  // celular liga como controle
  b = await chromium.launch();
  const celCtx = await b.newContext({ ...devices['Pixel 7 landscape'] });
  cel = await celCtx.newPage();
  cel.on('pageerror', (e) => erros.push('CEL: ' + e.message));
  await cel.goto(`${URL}/controle.html?c=${codigo}`);
  await cel.waitForFunction(() => document.body.classList.contains('ligado'), null, { timeout: 20000 });
  await tv.waitForFunction(() => document.querySelector('#tv-painel').hidden, null, { timeout: 15000 });
  ok(true, 'celular ligou: a tela do código saiu sozinha');
  await cel.waitForFunction(() => document.body.classList.contains('menu'));
  fotoTV('inicio');

  // controle remoto de verdade: a seta muda o botão escolhido
  const focoAgora = () => tv.evaluate(() => { const e = document.activeElement; return e && e !== document.body ? (e.id || e.textContent.trim().slice(0, 20)) : ''; });
  const f0 = await focoAgora();
  await tecla('KEYCODE_DPAD_DOWN');
  const f1 = await focoAgora();
  await tecla('KEYCODE_DPAD_UP');
  ok(f0 && f1 && f0 !== f1, `seta do controle remoto anda nos botões ("${f0}" -> "${f1}")`);

  const toque = async (sel) => { await cel.tap(sel); await espera(350); };
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
      await toque(`[data-nav=${onde}]`);
    }
    return false;
  }
  async function escrever(sel, txt, enviar) {
    ok(await irAte(sel), 'chega em ' + sel);
    await cel.waitForFunction(() => document.body.classList.contains('com-campo'));
    await cel.fill('#txt-cel', txt);
    await espera(400);
    if (enviar) await toque('#campo-cel button[type=submit]');
  }

  ok(await irAte('#bt-entrar'), 'setas do celular chegam em "Entrar"');
  await toque('[data-nav=ok]');
  await tv.waitForSelector('#m-conta:not([hidden])');
  await escrever('#c-nome', nome);
  await escrever('#c-senha', senha, true);
  await tv.waitForSelector('#m-jogos:not([hidden])', { timeout: 30000 });
  ok(true, 'entrou na conta pelo celular');
  fotoTV('jogos');
  // OK do controle remoto abre o Pradaria
  ok(await irAte('#lista-jogos .jogo[data-jogo=pradaria]'), 'escolhido o Pradaria');
  await tecla('KEYCODE_DPAD_CENTER', 1500);
  ok(await tv.evaluate(() => !document.querySelector('#m-mundos').hidden), 'OK do controle remoto abre a lista de mundos');
  fotoTV('mundos');
  // Voltar do controle remoto volta para os jogos (o app manda "GoBack" para o site)
  await tecla('KEYCODE_BACK', 1500);
  ok(await tv.evaluate(() => !document.querySelector('#m-jogos').hidden && document.querySelector('#m-mundos').hidden), 'Voltar do controle remoto volta uma tela (e não fecha o app)');
  ok(adb('shell', 'dumpsys', 'activity', 'activities').includes('dev.pradaria.tv/.Principal'), 'o app continua aberto');
  if (await tv.evaluate(() => document.querySelector('#m-mundos').hidden)) {
    ok(await irAte('#lista-jogos .jogo[data-jogo=pradaria]'), 'escolhido o Pradaria de novo');
    await tecla('KEYCODE_DPAD_CENTER', 1500);
  }
  await tv.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });

  ok(await irAte('#bt-novo-mundo'), 'chega em "Novo mundo"');
  await toque('[data-nav=ok]');
  await tv.waitForSelector('#m-novo:not([hidden])');
  await escrever('#n-nome', 'Mundo da TV');
  ok(await irAte('#m-novo button[type=submit]'), 'chega em "Criar"');
  await toque('[data-nav=ok]');
  await tv.waitForFunction(() => window.__jogo && window.__jogo.jog && !document.querySelector('#hud').hidden, null, { timeout: 120000 });
  ok(true, 'mundo criado e o jogo começou na TV');
  await espera(6000);
  ok(await tv.evaluate(() => { const c = document.querySelector('canvas'); return !!c && c.width > 300; }), 'o mundo 3D aparece (WebGL no WebView da TV)');
  fotoTV('jogando');

  // andar com a alavanca do celular
  await tv.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.y += 25; });
  const p0 = await tv.evaluate(() => ({ ...window.__jogo.jog.pos }));
  const cdp = await celCtx.newCDPSession(cel);
  const aA = await cel.locator('#area-andar').boundingBox();
  const ax = aA.x + aA.width / 2, ay = aA.y + aA.height * 0.6;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ax, y: ay, id: 1 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ax, y: ay - i * 10, id: 1 }] }); await espera(30); }
  await espera(2500);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const p1 = await tv.evaluate(() => ({ ...window.__jogo.jog.pos }));
  ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, 'a alavanca do celular anda no mundo');
  fotoTV('andou');

  // Voltar do controle remoto no jogo: pausa
  await tecla('KEYCODE_BACK', 1500);
  ok(await tv.evaluate(() => !document.querySelector('#pausa').hidden), 'Voltar do controle remoto pausa o jogo');
  fotoTV('pausa');
  // segurar o Voltar: pergunta se quer sair
  adb('shell', 'input', 'keyevent', '--longpress', 'KEYCODE_BACK');
  await espera(1500);
  fotoTV('sair');
  const tela = adb('shell', 'uiautomator', 'dump', '/sdcard/t.xml') && adb('shell', 'cat', '/sdcard/t.xml');
  ok(/Sair do Pradaria/.test(tela), 'segurar o Voltar pergunta "Sair do Pradaria?"');
  await tecla('KEYCODE_BACK', 800); // fecha a pergunta
  ok(adb('shell', 'dumpsys', 'activity', 'activities').includes('dev.pradaria.tv/.Principal'), 'fechar a pergunta continua no jogo');
} catch (e) {
  ok(false, 'erro: ' + (e.stack || e.message));
  try { fotoTV('erro'); } catch {}
}

// apaga a conta de teste (e o mundo dela)
try {
  const ent = await (await fetch(URL + '/api/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, senha }) })).json();
  const apagou = await fetch(URL + '/api/eu', { method: 'DELETE', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ent.token }, body: JSON.stringify({ senha }) });
  ok(apagou.ok, 'conta de teste apagada');
} catch (e) { ok(false, 'apagar conta: ' + e.message); }
console.log(erros.filter((e) => !/vibrate/.test(e)).join('\n') || 'sem erros no console');
if (b) await b.close();
process.exit(process.exitCode || 0);

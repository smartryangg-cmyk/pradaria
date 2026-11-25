// Teste real do app do tablet (pradaria.apk) num emulador de tablet Android. O app já está instalado (teste-app-apk.sh).
//  - abre pelo ícone: o jogo vem de dentro do app (endereço do site, user agent PradariaApp), tela cheia e deitada;
//  - com internet: entra numa conta de teste (as contas e o online continuam pela internet) e o app confere se o jogo no ar é mais novo;
//  - modo avião: fecha e abre o app de novo e o jogo abre igual, avisa que está sem internet, cria um mundo sem conta e joga;
//  - segurar o dedo não abre menu de copiar; Voltar pausa e despausa; o mundo continua depois de fechar o app;
//  - na tela inicial, Voltar pergunta "Sair do Pradaria?".
//   SAIDA=/tmp node testes/teste-app-apk.mjs   (precisa do adb e do APK com DEPURAR_WEB=1)
import { createRequire } from 'module'; const req = createRequire(import.meta.url);
const { _android } = req('playwright');
import { execFileSync } from 'child_process';
const URL = process.env.URL || 'https://pradaria.pages.dev', SAIDA = process.env.SAIDA || '/tmp';
const PKG = 'dev.pradaria.jogo';
const ok = (cond, txt) => { console.log((cond ? 'OK   ' : 'FALHOU ') + txt); if (!cond) process.exitCode = 1; };
const info = (txt) => console.log('INFO ' + txt);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const adb = (...a) => { try { return execFileSync('adb', a, { encoding: 'utf8' }); } catch (e) { return String(e.stdout || '') + String(e.stderr || ''); } };
let foto = 0;
const fotoApp = (nome) => { const f = `${SAIDA}/app-${String(++foto).padStart(2, '0')}-${nome}.png`; execFileSync('sh', ['-c', `adb exec-out screencap -p > "${f}"`]); };
const telaTexto = () => { adb('shell', 'uiautomator', 'dump', '/sdcard/t.xml'); return adb('shell', 'cat', '/sdcard/t.xml'); };
const aberto = () => adb('shell', 'dumpsys', 'activity', 'activities').includes(PKG + '/.Principal');

const nome = 'apk' + Math.random().toString(36).slice(2, 7), senha = 'senha123';
const r = await fetch(URL + '/api/cadastrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, senha, cor: 0, nascimento: '2000-01-01' }) });
ok(r.ok, 'conta de teste criada (' + nome + ')');

const erros = [];
let dev;
async function abrirApp(como) {
  adb('shell', 'am', 'force-stop', PKG);
  await espera(800);
  if (como === 'icone') adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1');
  else adb('shell', 'am', 'start', '-n', PKG + '/.Principal');
  const t0 = Date.now();
  const wv = await dev.webView({ pkg: PKG }, { timeout: 60000 });
  const p = await wv.page();
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await p.waitForSelector('#m-inicio:not([hidden]), #m-jogos:not([hidden])', { timeout: 60000 });
  info(`tela inicial em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return p;
}
// toque de verdade no tablet (adb input tap) no meio do botão
async function toque(p, sel) {
  const el = p.locator(sel).first();
  await el.waitFor({ state: 'visible', timeout: 30000 });
  await el.scrollIntoViewIfNeeded();
  const c = await el.evaluate((e) => { const r = e.getBoundingClientRect(); return [(r.left + r.width / 2) * devicePixelRatio, (r.top + r.height / 2) * devicePixelRatio]; });
  adb('shell', 'input', 'tap', String(Math.round(c[0])), String(Math.round(c[1])));
  await espera(600);
}
const internet = () => /bytes from/.test(adb('shell', 'ping', '-c', '1', '-W', '3', '8.8.8.8'));

try {
  [dev] = await _android.devices();
  ok(!!dev, 'emulador: ' + (dev && dev.model()));
  ok(adb('shell', 'cmd', 'package', 'query-activities', '--brief', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER').includes(PKG), 'o app aparece na tela de apps');

  // ---------- 1. com internet, pelo ícone ----------
  let p = await abrirApp('icone');
  await espera(2500);
  fotoApp('abriu');
  ok(p.url().startsWith('https://pradaria.pages.dev/?appv='), 'abre o jogo no endereço do site (' + p.url() + ')');
  ok(await p.evaluate(() => /PradariaApp\//.test(navigator.userAgent)), 'o jogo sabe que está no app');
  ok(await p.evaluate(() => innerWidth > innerHeight), 'tela deitada (' + await p.evaluate(() => innerWidth + 'x' + innerHeight) + ')');
  ok(await p.evaluate(() => Math.abs(innerHeight * devicePixelRatio - screen.height * devicePixelRatio) < 2 || innerHeight >= screen.height - 1 || innerHeight >= screen.width - 1), 'tela cheia, sem barra (' + await p.evaluate(() => `${innerWidth}x${innerHeight} de ${screen.width}x${screen.height}`) + ')');
  ok(await p.evaluate(() => document.querySelector('#bt-tela').hidden), 'sem botão de tela cheia (o app já é tela cheia)');
  ok(await p.evaluate(() => !navigator.serviceWorker || navigator.serviceWorker.getRegistrations().then((l) => l.length === 0)), 'sem service worker (o jogo já está no app)');
  ok(await p.evaluate(() => document.querySelector('#versao-inicio').textContent.includes('App Android')), 'versão: ' + await p.textContent('#versao-inicio'));

  // entra na conta (o online usa a internet)
  await toque(p, '#bt-entrar');
  await p.waitForSelector('#m-conta:not([hidden])');
  await p.fill('#c-nome', nome);
  await p.fill('#c-senha', senha);
  await toque(p, '#c-ok');
  await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 30000 });
  ok(true, 'entrou na conta pelo app (internet)');
  fotoApp('conta');
  await toque(p, '#lista-jogos .jogo[data-jogo=pradaria]');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 30000 });
  ok(true, 'lista de mundos online abriu');
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await espera(1500);
  ok(await p.evaluate(() => !document.querySelector('#m-jogos').hidden), 'Voltar do Android volta uma tela (mundos -> jogos)');
  ok(aberto(), 'o app continua aberto');

  // o app confere se o jogo no ar é mais novo (o APK de teste tem o jogo "teste": baixa o do site)
  let log = '';
  for (let i = 0; i < 60; i++) {
    log = adb('logcat', '-d', '-s', 'PradariaPacote');
    if (/pronto|em dia|não atualizou/.test(log)) break;
    await espera(1500);
  }
  console.log(log.split('\n').filter((l) => /PradariaPacote/.test(l)).map((l) => '     ' + l.replace(/^.*PradariaPacote\s*:?\s*/, '')).join('\n'));
  const baixou = /pronto/.test(log);
  if (baixou) ok(true, 'atualização: baixou o jogo do site e conferiu cada arquivo');
  else if (/HTTP 404/.test(log)) info('o site ainda não tem app-pacote.json (só depois de publicar): sem atualização agora');
  else ok(false, 'atualização: o app não terminou de conferir o site');

  // ---------- 2. modo avião ----------
  adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'enable');
  adb('shell', 'svc', 'wifi', 'disable');
  adb('shell', 'svc', 'data', 'disable');
  await espera(4000);
  ok(!internet(), 'modo avião ligado: sem internet no tablet');

  p = await abrirApp();
  await espera(3000);
  fotoApp('sem-internet');
  ok(true, 'sem internet o app abre o jogo do mesmo jeito');
  if (baixou) ok(/Versão \d+/.test(await p.textContent('#versao-inicio')), 'abriu o jogo baixado: ' + await p.textContent('#versao-inicio'));
  ok(await p.isVisible('#inicio-sem-rede'), 'avisa na tela que está sem internet (sem janela de erro)');
  ok(await p.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0)), 'imagens do jogo carregadas sem internet');

  // novo mundo sem conta
  await toque(p, '#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])', { timeout: 15000 });
  fotoApp('novo-mundo');
  await toque(p, '#m-novo button[type=submit]');
  await p.waitForFunction(() => document.querySelector('#menu').hidden && !document.querySelector('#hud').hidden, null, { timeout: 120000 });
  await espera(8000);
  ok(await p.evaluate(() => { const c = document.querySelector('canvas'); return !!c && c.width > 300; }), 'o mundo 3D aparece sem internet');
  const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  info(`quadros por segundo no emulador (sem placa de vídeo): ${fps.toFixed(1)}`);
  fotoApp('jogando-sem-internet');

  // segurar o dedo no mundo: quebra, sem menu de copiar
  const [w, h] = (adb('shell', 'wm', 'size').match(/(\d+)x(\d+)/) || [0, 1920, 1200]).slice(1).map(Number);
  const W = Math.max(w, h), H = Math.min(w, h);
  adb('shell', 'input', 'swipe', String(Math.round(W * 0.6)), String(Math.round(H * 0.45)), String(Math.round(W * 0.6)), String(Math.round(H * 0.45)), '1800');
  await espera(800);
  ok(await p.evaluate(() => (getSelection() + '') === ''), 'segurar o dedo não seleciona texto');
  ok(!/Copiar|Copy|Selecionar|Select all/.test(telaTexto()), 'segurar o dedo não abre menu de copiar');
  fotoApp('segurou');

  // Voltar pausa e despausa
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await espera(1200);
  ok(await p.evaluate(() => !document.querySelector('#pausa').hidden), 'Voltar do Android pausa o jogo');
  fotoApp('pausa');
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await espera(1200);
  ok(await p.evaluate(() => document.querySelector('#pausa').hidden), 'Voltar de novo volta para o jogo');
  ok(aberto(), 'o app continua aberto');

  // sai do app (botão de início) e fecha: o mundo fica salvo no aparelho
  const antes = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('pradaria.local')).semente; } catch { return null; } });
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
  await espera(2500);
  p = await abrirApp();
  await espera(1500);
  const depois = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('pradaria.local')).semente; } catch { return null; } });
  ok(antes != null && antes === depois, `mundo salvo no aparelho depois de fechar o app (semente ${antes})`);
  ok(await p.evaluate(() => !!localStorage.getItem('pradaria.token')), 'continua com a conta guardada (abre sozinha quando a internet voltar)');
  await toque(p, '#bt-sozinho');
  await p.waitForFunction(() => document.querySelector('#menu').hidden && !document.querySelector('#hud').hidden, null, { timeout: 120000 });
  ok(true, '"Jogar sem conta" continua o mesmo mundo');
  await espera(5000);
  fotoApp('continuou');
  // volta para a tela inicial pela pausa
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await espera(1000);
  await toque(p, '#bt-sair-mundo');
  await espera(2500);
  ok(await p.evaluate(() => !document.querySelector('#m-inicio').hidden), 'saiu do mundo para a tela inicial');

  // ---------- 3. internet volta: a conta abre sozinha ----------
  adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
  adb('shell', 'svc', 'wifi', 'enable');
  adb('shell', 'svc', 'data', 'enable');
  let voltou = false;
  for (let i = 0; i < 30 && !voltou; i++) { await espera(1500); voltou = await p.evaluate(() => !document.querySelector('#m-jogos').hidden); }
  ok(voltou, 'a internet voltou e a conta abriu sozinha');
  fotoApp('internet-voltou');

  // Voltar na primeira tela pergunta se quer sair
  if (voltou) { await p.evaluate(() => { document.querySelector('#bt-sair-conta2').click(); }); await espera(1000); }
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await espera(1500);
  fotoApp('sair');
  ok(/Sair do Pradaria/.test(telaTexto()), 'na tela inicial, Voltar pergunta "Sair do Pradaria?"');
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await espera(800);
  ok(aberto(), 'fechar a pergunta continua no app');
} catch (e) {
  ok(false, 'erro: ' + (e.stack || e.message));
  try { fotoApp('erro'); } catch {}
}
adb('shell', 'cmd', 'connectivity', 'airplane-mode', 'disable');
adb('shell', 'svc', 'wifi', 'enable');
adb('shell', 'svc', 'data', 'enable');

// apaga a conta de teste
try {
  const ent = await (await fetch(URL + '/api/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome, senha }) })).json();
  const apagou = await fetch(URL + '/api/eu', { method: 'DELETE', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ent.token }, body: JSON.stringify({ senha }) });
  ok(apagou.ok, 'conta de teste apagada');
} catch (e) { ok(false, 'apagar conta: ' + e.message); }
const errosReais = erros.filter((e) => !/vibrate|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_NETWORK|WebSocket|Failed to load resource/.test(e));
console.log(errosReais.join('\n') || 'sem erros no console');
ok(errosReais.length === 0, 'sem erros de JavaScript');
process.exit(process.exitCode || 0);

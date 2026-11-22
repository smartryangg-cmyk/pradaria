// Quebrar como no clássico (jogo base): segurar o botão (ou o dedo) e o bloco racha em 10 estágios até quebrar.
// O tempo vem da dureza e do que está na mão (ferramenta certa é mais rápida); soltar no meio zera.
// Pedra com a mão quebra devagar e não dá nada. Mundos antigos (mod "Quebrar esculpindo") seguem esculpindo.
// Computador (mouse travado), tablet (dedo de verdade, CDP) e online (2 jogadores: o amigo vê a rachadura).
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-quebra-classica.mjs        (PARTES=regras,pc,tablet,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { tempoQuebrar, estagio } from '../public/js/quebra-regras.js';
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const PARTES = (process.env.PARTES || 'regras,pc,tablet,online').split(',');
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };

if (PARTES.includes('regras')) {
  ok(tempoQuebrar(2, 0) === 0.75 && tempoQuebrar(2, 1005) === 0.38, 'terra: 0,75 s com a mão, 0,38 s com a pá de madeira');
  ok(tempoQuebrar(3, 0) === 7.5 && tempoQuebrar(3, 1001) === 1.13 && tempoQuebrar(3, 1002) === 0.56, 'pedra: 7,5 s com a mão (não dá nada), 1,13 s picareta de madeira, 0,56 s de pedra');
  ok(tempoQuebrar(67, 1001) === 7.5 && tempoQuebrar(67, 1002) === 1.13, 'minério de ferro: picareta de madeira é fraca (devagar), de pedra quebra em 1,13 s');
  ok(tempoQuebrar(6, 0) === 3 && tempoQuebrar(6, 1003) === 1.5 && tempoQuebrar(6, 1001) === 3, 'tronco: 3 s com a mão, 1,5 s com machado de madeira, picareta não ajuda');
  ok(tempoQuebrar(11, 0) === 0 && tempoQuebrar(221, 0) === 0 && tempoQuebrar(7, 0) === 0.3, 'flor e tocha quebram na hora; folhas em 0,3 s');
  ok(tempoQuebrar(70, 1004) === Infinity && tempoQuebrar(220, 1102) > 9, 'rocha-mãe não quebra; obsidiana demora muito');
  ok(estagio(0) === 0 && estagio(0.55) === 5 && estagio(0.999) === 9, 'rachaduras em 10 estágios');
}

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(50); }
  return false;
}
function vigiar(p, nome) {
  p.on('pageerror', (e) => erros.push(nome + ' ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
}
async function mundoSozinho(ctx, toque, nome, antes = null) {
  const p = await ctx.newPage(); vigiar(p, nome);
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (antes) await antes(p);
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  return p;
}
// chão de pedra lá no alto e uma parede de alvos na frente (na altura dos olhos)
const palco = (p) => p.evaluate(() => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = 80;
  for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) { m.definir(x0 + dx, y0, z0 + dz, 3); for (let dy = 1; dy <= 6; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0); }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0;
  window.__alvo = [x0, y0 + 2, z0 - 2];
  return window.__alvo;
});
// põe o bloco b no alvo e mira no meio da frente dele
async function alvo(p, bl) {
  await J(p, (bl) => { const [x, y, z] = window.__alvo, m = window.__jogo.mundo, j = window.__jogo.jog; m.definir(x, y, z, bl); j.pos.x = x + 0.5; j.pos.z = z + 2.5; j.pos.y = y - 1; j.vel.x = j.vel.y = j.vel.z = 0; }, bl);
  await esperar(p, 200);
  await ate(p, () => { const J_ = window.__jogo; return Math.hypot(J_.camera.position.x - J_.jog.pos.x, J_.camera.position.z - J_.jog.pos.z) < 0.3 && Math.abs(J_.camera.position.y - J_.jog.pos.y - 1.55) < 0.3; }, null, 4000); // a câmera já chegou
  await J(p, () => { const [x, y, z] = window.__alvo, J_ = window.__jogo, cam = J_.camera, j = J_.jog; const dx = x + 0.5 - cam.position.x, dz = z + 1 - cam.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y + 0.5 - cam.position.y, Math.hypot(dx, dz)); });
  await esperar(p, 300);
}
const blocoAlvo = (p) => J(p, () => { const [x, y, z] = window.__alvo; return window.__jogo.mundo.bloco(x, y, z); });
const dar = (p, id, n = 1) => J(p, ([id, n]) => window.__jogo.mercado.mexer({ t: 'pegar', id, n }, true), [id, n]);
const segurarMao = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
const estagioEu = (p) => J(p, () => { const r = window.__jogo.rachas; return r ? r.estagioDe('eu') : -2; });
// segura (aperta/solta é do aparelho) e mede quanto levou até o bloco sumir
async function quebrarSegurando(p, apertar, soltar, maxMs) {
  const t0 = Date.now();
  await apertar();
  const foi = await ate(p, () => { const [x, y, z] = window.__alvo; return window.__jogo.mundo.bloco(x, y, z) === 0; }, null, maxMs);
  const ms = Date.now() - t0;
  await soltar();
  return foi ? ms / 1000 : null;
}

async function provas(p, nome, apertar, soltar) {
  // terra com a mão: uns 0,75 s
  await segurarMao(p, 0);
  await alvo(p, 2);
  let s = await quebrarSegurando(p, apertar, soltar, 4000);
  ok(s !== null && s >= 0.6 && s <= 3, `${nome}: segurando, a terra quebrou com a mão em ${s} s (clássico: 0,75 s)`);
  // pedra com a mão: devagar; as rachaduras aparecem; soltar no meio zera
  await alvo(p, 3);
  await apertar(); await esperar(p, 2500);
  const e1 = await estagioEu(p);
  ok(e1 >= 1 && e1 <= 5 && await blocoAlvo(p) === 3, `${nome}: pedra com a mão: depois de 2,5 s ainda inteira, rachadura no estágio ${e1}`);
  await p.screenshot({ path: SAIDA + `/quebra-${nome}-rachando.png` });
  await soltar(); await esperar(p, 700);
  ok(await estagioEu(p) === -1 && await blocoAlvo(p) === 3, `${nome}: soltou: a rachadura sumiu e o bloco continua`);
  await apertar(); await esperar(p, 1200);
  const e2 = await estagioEu(p);
  await soltar();
  ok(e2 >= 0 && e2 <= 2, `${nome}: segurou de novo: começou do zero (estágio ${e2})`);
  // picareta de madeira: pedra em ~1,1 s e dá pedrisco
  await dar(p, 1001); await segurarMao(p, 1001);
  const antes = await J(p, () => window.__jogo.mercado.qtd(20) + window.__jogo.mercado.qtd(3));
  await alvo(p, 3);
  s = await quebrarSegurando(p, apertar, soltar, 5000);
  ok(s !== null && s >= 0.9 && s <= 4, `${nome}: com a picareta de madeira a pedra quebrou em ${s} s (clássico: 1,13 s)`);
  await J(p, () => { const [x, y, z] = window.__alvo, j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.z = z + 0.5; j.pos.y = y; }); // vai até onde caiu
  ok(await ate(p, (a) => window.__jogo.mercado.qtd(20) + window.__jogo.mercado.qtd(3) > a, antes, 4000), `${nome}: e a pedra caiu e foi para a mochila`);
  // flor: na hora
  await segurarMao(p, 0);
  await alvo(p, 11);
  s = await quebrarSegurando(p, apertar, soltar, 2000);
  ok(s !== null && s <= 0.6, `${nome}: a flor quebrou na hora (${s} s)`);
}

if (PARTES.includes('pc')) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await mundoSozinho(ctx, false, 'pc');
  ok(await J(p, () => !window.__jogo.opcoesMundo.esculpir), 'pc: mundo novo quebra como no clássico (sem o mod de esculpir)');
  await palco(p); await esperar(p, 600);
  await p.mouse.click(640, 400); await esperar(p, 400);
  const travou = await J(p, () => !!document.pointerLockElement);
  ok(travou, 'pc: o mouse travou no jogo');
  // o navegador de teste manda um "movimento" falso do mouse junto com o clique travado: a mira fica onde o teste pôs
  await J(p, () => document.addEventListener('mousemove', (e) => e.stopImmediatePropagation(), true));
  await provas(p, 'pc', () => p.mouse.down(), () => p.mouse.up());
  await ctx.close();
  // mundo com o mod "Quebrar esculpindo": cada clique arranca um pedaço (jeito antigo)
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await mundoSozinho(ctx2, false, 'pc-mod', async (pg) => {
    await pg.evaluate(() => { const bt = [...document.querySelectorAll('#n-abas button')].find((x) => /Mods/.test(x.textContent)); if (bt) bt.click(); });
    await pg.waitForTimeout(200);
    await pg.evaluate(() => { const bt = [...document.querySelectorAll('#n-mods button, #n-mods label')].find((x) => /esculpindo/i.test(x.textContent)); if (bt) bt.click(); });
  });
  ok(await J(p2, () => window.__jogo.opcoesMundo.esculpir === true), 'pc: dá para ligar o mod "Quebrar esculpindo" ao criar o mundo');
  await palco(p2); await esperar(p2, 600);
  await alvo(p2, 3);
  await J(p2, () => window.__jogo.quebrar(null)); await esperar(p2, 300);
  ok(await J(p2, () => window.__jogo.escav.blocos.size === 1 && window.__jogo.rachas.estagioDe('eu') === -1), 'pc: com o mod, um clique arranca um pedaço (esculpe), sem rachadura');
  await ctx2.close();
}

if (PARTES.includes('tablet')) {
  const ctx = await b.newContext({ ...devices['Galaxy Tab S4'] });
  const p = await mundoSozinho(ctx, true, 'tablet');
  await palco(p); await esperar(p, 600);
  const cdp = await ctx.newCDPSession(p);
  const vp = p.viewportSize();
  const meio = { x: Math.round(vp.width / 2), y: Math.round(vp.height / 2) };
  await provas(p, 'tablet',
    () => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: meio.x, y: meio.y, id: 3 }] }),
    () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }));
  await ctx.close();
}

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
  const a = await pagina('Ana', true);
  await conta(a, 'Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Quebra');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', false);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2000);
  // o alvo: a terra de verdade embaixo da Ana (o mundo da sala; a Ana olha para o chão)
  const alvoA = await J(a, () => {
    const J_ = window.__jogo, j = J_.jog, m = J_.mundo, x = Math.floor(j.pos.x), z = Math.floor(j.pos.z) - 2;
    let y = 120; while (y > 1 && m.bloco(x, y, z) === 0) y--;
    window.__alvo = [x, y, z];
    return [x, y, z, m.bloco(x, y, z)];
  });
  await J(bt, (al) => { window.__alvo = al.slice(0, 3); const j = window.__jogo.jog; j.voando = true; j.pos.x = al[0] + 0.5; j.pos.y = al[1] + 4; j.pos.z = al[2] + 4; j.vel.x = j.vel.y = j.vel.z = 0; }, alvoA);
  await J(a, () => { const [x, y, z] = window.__alvo, J_ = window.__jogo, j = J_.jog; j.voando = true; j.pos.x = x + 0.5; j.pos.y = y + 2; j.pos.z = z + 2.6; j.vel.x = j.vel.y = j.vel.z = 0; });
  await esperar(a, 600);
  await J(a, () => { const [x, y, z] = window.__alvo, J_ = window.__jogo, cam = J_.camera, j = J_.jog; const dx = x + 0.5 - cam.position.x, dz = z + 0.5 - cam.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y + 1 - cam.position.y, Math.hypot(dx, dz)); });
  await esperar(a, 400);
  const tipo = alvoA[3];
  ok(tipo > 0, 'online: a Ana mira num bloco do chão (' + tipo + ')');
  // segura com o dedo; o Beto vê a rachadura enquanto ela quebra
  const cdp = await a.context().newCDPSession(a);
  const vp = a.viewportSize();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(vp.width / 2), y: Math.round(vp.height / 2), id: 4 }] });
  const viu = await ate(bt, (k) => { const r = window.__jogo.rachas; return r && r.lista.has(k); }, alvoA.slice(0, 3).join(','), 6000);
  ok(viu, 'online: o Beto viu a rachadura no bloco que a Ana está quebrando');
  await J(bt, () => { const [x, y, z] = window.__alvo, J_ = window.__jogo, cam = J_.camera, j = J_.jog; const dx = x + 0.5 - cam.position.x, dz = z + 0.5 - cam.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y + 1 - cam.position.y, Math.hypot(dx, dz)); });
  await esperar(bt, 300);
  if (viu) await bt.screenshot({ path: SAIDA + '/quebra-online-beto-ve.png' });
  const foi = await ate(a, () => { const [x, y, z] = window.__alvo; return window.__jogo.mundo.bloco(x, y, z) === 0; }, null, 15000);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(foi, 'online: a Ana quebrou o bloco segurando o dedo');
  ok(await ate(bt, () => { const [x, y, z] = window.__alvo; return window.__jogo.mundo.bloco(x, y, z) === 0; }, null, 5000), 'online: o bloco sumiu na tela do Beto');
  ok(await ate(bt, () => window.__jogo.rachas.lista.size === 0, null, 3000), 'online: e a rachadura sumiu para o Beto');
  await J(a, () => { const [x, y, z] = window.__alvo, j = window.__jogo.jog; j.voando = false; j.pos.x = x + 0.5; j.pos.z = z + 0.5; j.pos.y = y + 0.2; j.vel.y = 0; }); // vai pegar o que caiu
  ok(await ate(a, (t) => window.__jogo.mercado.qtd(t === 1 ? 2 : t) >= 1, tipo, 6000), 'online: a sala deu o bloco para a Ana');
  await a.screenshot({ path: SAIDA + '/quebra-online-ana.png' });
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

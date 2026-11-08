// Opções na criação do mundo: tela, tamanho (ilha com borda), bichos desligados, e o servidor guardando as opções.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
async function pagina(toque = false) {
  const ctx = await b.newContext({ viewport: { width: 1024, height: 700 }, hasTouch: toque, isMobile: toque });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await p.goto(BASE + '/#teste');
  return p;
}

// ---------- sem internet: primeira vez abre a tela de opções ----------
const p = await pagina();
await p.click('#bt-sozinho');
await p.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
conferir(await p.isHidden('#novo-rotulo'), 'sem internet não pede nome');
conferir(await p.getAttribute('[data-tamanho=medio]', 'aria-pressed') === 'true', 'médio vem marcado');
conferir(await p.getAttribute('[data-opcao=selvagens]', 'aria-pressed') === 'true', 'animais selvagens vêm ligados');
await p.click('[data-tamanho=pequeno]');
await p.click('[data-opcao=selvagens]');
await p.click('[data-opcao=animais]');
await p.click('#m-novo summary');
await p.fill('#n-semente', 'capivara');
await p.screenshot({ path: SAIDA + '/opcoes-mundo.png' });
await p.click('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
const op = await p.evaluate(() => ({ ...window.__jogo.opcoesMundo, limite: window.__jogo.mundo.limite, semente: window.__jogo.mundo.semente, raio: window.__jogo.mundo.raio }));
console.log(JSON.stringify(op));
conferir(op.tamanho === 'pequeno' && op.limite === 128, 'mundo pequeno com borda 128');
conferir(op.selvagens === false && op.animais === false, 'selvagens e bichinhos desligados');
await p.waitForTimeout(5000);
conferir(await p.evaluate(() => window.__jogo.bichos.lista.length) === 0, 'sem bichinhos quando desligado');
// borda: não passa do mar
await p.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.x = 400; j.pos.y = 40; });
await p.waitForTimeout(300);
const x = await p.evaluate(() => window.__jogo.jog.pos.x);
conferir(x <= 134.01, 'borda segura o jogador (x=' + x.toFixed(1) + ')');
await p.evaluate(() => { const j = window.__jogo.jog; j.pos.x = 110; j.pos.z = 0; j.pos.y = 45; j.yaw = -Math.PI / 2; j.pitch = -0.35; });
await p.waitForTimeout(6000);
await p.screenshot({ path: SAIDA + '/borda-ilha.png' });
// salvo: voltar continua o mesmo mundo com as mesmas opções
await p.evaluate(() => { window.__jogo.jogarLocal(); });
await p.waitForTimeout(500);
const op2 = await p.evaluate(() => ({ ...window.__jogo.opcoesMundo }));
conferir(op2.tamanho === 'pequeno' && op2.selvagens === false && op2.animais === false, 'mundo salvo guarda as opções');

// ---------- online: o servidor guarda as opções ----------
const q = await pagina(true);
const nome = 'Opc' + (Date.now() % 10000);
await q.click('#bt-criar-conta');
await q.fill('#c-nome', nome); await q.fill('#c-senha', 'senha123');
if (await q.isVisible('#c-adulto-ok')) await q.check('#c-adulto-ok');
await q.click('#c-ok');
await q.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
await q.click('#bt-novo-mundo');
await q.fill('#n-nome', 'Ilha Monstro');
await q.click('[data-tamanho=pequeno]');
await q.click('[data-opcao=selvagensMachucam]');
await q.click('[data-opcao=cicloDia]');
await q.screenshot({ path: SAIDA + '/opcoes-mundo-celular.png', fullPage: true });
await q.click('#m-novo button[type=submit]');
await q.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await q.waitForTimeout(1000);
const oo = await q.evaluate(() => ({ ...window.__jogo.opcoesMundo, dia: window.__jogo.tempoDia }));
console.log(JSON.stringify(oo));
conferir(oo.tamanho === 'pequeno' && oo.selvagens && oo.selvagensMachucam && !oo.cicloDia, 'online: opções chegam pela sala');
await q.waitForTimeout(3000);
conferir(Math.abs(await q.evaluate(() => window.__jogo.tempoDia) - 0.3) < 1e-6, 'sem dia e noite: o sol fica parado');
const lista = await q.evaluate(async () => (await (await fetch('/api/mundos', { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).mundos);
conferir(lista[0].opcoes.tamanho === 'pequeno' && lista[0].opcoes.selvagensMachucam === true && lista[0].opcoes.cicloDia === false, 'lista de mundos traz as opções');
// semente escolhida = mesmo terreno
const crie = (semente) => q.evaluate(async (s) => (await (await fetch('/api/mundos', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('pradaria.token') }, body: JSON.stringify({ nome: 'S ' + s, semente: s, opcoes: { lixo: 1, animais: 'sim' } }) })).json()), semente);
const s1 = await crie('capivara');
conferir(s1.mundo.opcoes.animais === true && !('lixo' in s1.mundo.opcoes) && s1.mundo.opcoes.tamanho === 'grande', 'servidor ignora opções inválidas');

console.log(erros.slice(0, 10).join('\n'));
conferir(erros.length === 0, 'sem erros no console');
await b.close();
process.exit(falhas.length ? 1 : 0);

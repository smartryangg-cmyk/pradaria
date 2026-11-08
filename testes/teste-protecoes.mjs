// Proteções para criança e limites do servidor (precisa de: npm run dev:sala e npm run dev, porta 8788).
// PORTA=8798 node testes/teste-protecoes.mjs
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = `http://localhost:${process.env.PORTA || 8788}`;
let falhas = 0;
// cada chamada parece vir de um aparelho diferente (os limites por IP não se acumulam entre execuções)
const ipx = () => '10.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250);
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) falhas++; };
async function api(caminho, corpo, token, metodo, ip) {
  const r = await fetch(BASE + '/api/' + caminho, {
    method: metodo || (corpo ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), 'cf-connecting-ip': ip || ipx() },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, ...d };
}
const sfx = String(Date.now() % 10000);
const cadastrar = (nome) => api('cadastrar', { nome, senha: 'senha123' }, null, null, ipx());

// nomes
for (const n of ['zap11987654321', 'Pedro12345', 'insta_fulano', 'm3rda']) ok((await cadastrar(n)).status === 400, 'nome barrado: ' + n);
ok((await api('cadastrar', { nome: { x: 1 }, senha: 'abcd' })).status === 400, 'nome que não é texto: 400 sem erro interno');
const dono = await cadastrar('Dono' + sfx); const amigo = await cadastrar('Amigo' + sfx); const chato = await cadastrar('Chato' + sfx);
ok(dono.token && amigo.token && chato.token, 'cadastro normal funciona');
ok((await api('mundos', { nome: 'me chama 11 98765 4321' }, dono.token)).status === 400, 'nome de mundo com telefone barrado');
ok((await api('mundos', { nome: 'Ilha‮texto' }, dono.token)).status === 400, 'nome de mundo com caractere estranho barrado');
const { mundo } = await api('mundos', { nome: 'Fazenda da Capivara' }, dono.token);
ok(mundo && mundo.codigo.length === 8, 'mundo criado com código de 8 letras');

// entrar com código
ok((await api('mundos/entrar', { codigo: mundo.codigo }, amigo.token)).mundo, 'amigo entra com o código');
ok((await api('mundos/entrar', { codigo: mundo.codigo }, chato.token)).mundo, 'chato entra com o código');
ok((await api('mundos/membros', { codigo: mundo.codigo }, amigo.token)).status === 403, 'só o dono vê a lista de membros');
const { membros } = await api('mundos/membros', { codigo: mundo.codigo }, dono.token);
ok(membros && membros.length === 2, 'dono vê 2 membros');

// sala: chato conectado é expulso na hora
const ws = (t, c) => new Promise((res) => {
  const w = new WebSocket(`${BASE.replace('http', 'ws')}/api/sala/${c}?t=${encodeURIComponent(t)}`);
  const msgs = []; w.onmessage = (e) => msgs.push(JSON.parse(e.data));
  w.onclose = (e) => { w.fechou = e.code; }; w.msgs = msgs; w.onopen = () => setTimeout(() => res(w), 600); w.onerror = () => res(w);
});
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const wd = await ws(dono.token, mundo.codigo);
const wc = await ws(chato.token, mundo.codigo);
ok(wc.msgs.some((m) => m.t === 'ola'), 'chato entrou na sala');
// bloco inválido não é guardado; bloco válido é
wc.send(JSON.stringify({ t: 'bloco', x: 3, y: 30, z: 3, b: 50 }));
wc.send(JSON.stringify({ t: 'bloco', x: 4, y: 30, z: 3, b: 1 }));
await espera(500);
ok(wd.msgs.some((m) => m.t === 'bloco' && m.b === 1), 'bloco válido chega ao dono');
// membro tentando se passar pelo servidor com um cabeçalho "x-admin" (antes apagava o mundo do dono)
const http = await import('node:http');
const forjado = await new Promise((res) => {
  const r = http.request(`${BASE}/api/sala/${mundo.codigo}?t=${encodeURIComponent(amigo.token)}`, {
    headers: { Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'x3JJHMbDL1EzLkh9GBhXDw==', 'x-admin': 'apagar' },
  });
  r.on('response', (resp) => { resp.resume(); res(resp.statusCode); });
  r.on('upgrade', (resp, sock) => { sock.destroy(); res(resp.statusCode); });
  r.on('error', () => res(0));
  r.end();
});
await espera(600);
ok(forjado !== 200 && !wd.msgs.some((m) => m.t === 'erro' && m.fim) && wd.fechou === undefined, `cabeçalho x-admin falso não apaga o mundo (resposta ${forjado})`);
// emotes: no máximo um a cada 0,8 s
for (let i = 0; i < 6; i++) wc.send(JSON.stringify({ t: 'emote', e: 'coracao' }));
await espera(400);
ok(wd.msgs.filter((m) => m.t === 'emote').length === 1, 'emotes em rajada: só 1 passa');
// teleporte: um pedido por pessoa a cada 10 s
const idDono = wd.msgs.find((m) => m.t === 'ola').eu;
wc.send(JSON.stringify({ t: 'tp-pedir', para: idDono, tipo: 'chamar' }));
await espera(300);
const wc2 = await ws(chato.token, mundo.codigo); // reconectar não zera a espera
wc2.send(JSON.stringify({ t: 'tp-pedir', para: idDono, tipo: 'chamar' }));
await espera(400);
ok(wd.msgs.filter((m) => m.t === 'tp-pedido').length === 1, 'pedidos de teleporte em sequência: só 1 chega');
// expulsar
const idChato = membros.find((m) => m.nome === 'Chato' + sfx).id;
ok((await api('mundos/expulsar', { codigo: mundo.codigo, uid: idChato }, dono.token)).ok, 'dono expulsa o chato');
await espera(500);
ok(wc2.fechou === 4004 && wc2.msgs.some((m) => m.t === 'erro' && m.fim), 'chato sai da sala na hora');
const wc3 = await ws(chato.token, mundo.codigo);
ok(!wc3.msgs.some((m) => m.t === 'ola'), 'chato não volta sem o código');

// trocar código: amigo sai, construção continua
const wa = await ws(amigo.token, mundo.codigo);
ok(wa.msgs.some((m) => m.t === 'ola'), 'amigo na sala');
const novo = await api('mundos/codigo-novo', { codigo: mundo.codigo }, dono.token);
ok(novo.codigo && novo.codigo !== mundo.codigo, 'código trocado');
await espera(500);
ok(wa.msgs.some((m) => m.t === 'erro' && m.fim), 'amigo sai quando o código muda');
ok(!wd.fechou, 'dono continua na sala');
ok((await api('mundos/entrar', { codigo: mundo.codigo }, amigo.token)).status === 404, 'código antigo não funciona');
ok((await api('mundos/entrar', { codigo: novo.codigo }, amigo.token)).mundo, 'código novo funciona');
const wa2 = await ws(amigo.token, novo.codigo);
const ola = wa2.msgs.find((m) => m.t === 'ola');
ok(ola && ola.edicoes.some(([x, y, z, b]) => x === 4 && b === 1), 'o que foi construído continua depois de trocar o código');

// limite de tentativas de código
let r; for (let i = 0; i < 17; i++) r = await api('mundos/entrar', { codigo: 'ZZZZZZZ' + (i % 9) }, chato.token, null, '10.7.7.7');
ok(r.status === 429, 'muitas tentativas de código: 429');
// login: errar a senha de outra pessoa de um IP não tranca ela em outro IP
for (let i = 0; i < 12; i++) await api('entrar', { nome: 'Amigo' + sfx, senha: 'errada' }, null, null, '10.9.9.9');
ok((await api('entrar', { nome: 'Amigo' + sfx, senha: 'errada' }, null, null, '10.9.9.9')).status === 429, 'quem erra muito é barrado');
ok((await api('entrar', { nome: 'Amigo' + sfx, senha: 'senha123' }, null, null, '10.1.2.3')).token, 'a dona da conta ainda entra de outro aparelho');

// apagar conta
ok((await api('eu', { senha: 'errada' }, dono.token, 'DELETE')).status === 401, 'apagar conta pede a senha certa');
ok((await api('eu', { senha: 'senha123' }, dono.token, 'DELETE')).ok, 'conta apagada');
ok((await api('eu', null, dono.token)).status === 401, 'token antigo não vale mais');
ok((await api('mundos/entrar', { codigo: novo.codigo }, amigo.token)).status === 404, 'mundos do dono somem junto');
await espera(400);
ok(wa2.msgs.some((m) => m.t === 'erro' && m.fim), 'quem estava no mundo apagado sai');
for (const w of [wd, wc, wc2, wc3, wa, wa2]) try { w.close(); } catch {}

// tela: caixa do adulto e menu do dono
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
await p.goto(BASE + '/');
await p.click('#bt-criar-conta');
ok(await p.isVisible('#c-adulto-ok'), 'criar conta mostra a caixa do adulto');
await p.fill('#c-nome', 'Tela' + sfx); await p.fill('#c-senha', 'senha123');
await p.click('#c-ok');
await espera(500);
ok(await p.isVisible('#m-conta'), 'sem a caixa marcada não cria');
await p.check('#c-adulto-ok'); await p.click('#c-ok');
await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
await p.evaluate(() => { location.hash = '#teste'; });
await p.reload();
await espera(1500);
if (await p.isVisible('#bt-entrar')) await p.click('#bt-entrar');
await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
await p.click('#bt-novo-mundo'); await p.fill('#n-nome', 'Meu Mundo'); await p.click('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.sala, null, { timeout: 30000 });
await espera(1500);
await p.keyboard.press('KeyP');
await espera(800);
const temDono = await p.evaluate(() => !document.querySelector('#pausa-dono').hidden);
ok(temDono, 'pausa do dono mostra "Quem pode entrar"');
const ignorou = await p.evaluate(() => { const m = window.__jogo.mundo; m.carregarEdicoes([[6, 30, 6, 250]]); return m.definir(5, 30, 5, 250) === false; });
await espera(800);
ok(ignorou, 'bloco que não existe (id 250) é ignorado pelo jogo');
ok(erros.length === 0, 'sem erros na página ' + erros.join(' | '));
await b.close();
console.log(falhas ? `${falhas} falha(s)` : 'tudo certo');
process.exit(falhas ? 1 : 0);

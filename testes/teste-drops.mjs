// Itens no chão (drops): o que quebra cai no chão girando, pega passando perto, larga com Q (ou o botão no tablet),
// boia na água, some depois de uns minutos e, online, todo mundo vê o mesmo (dá para passar para um amigo).
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const letras = () => Array.from({ length: 6 }, () => 'bdgkmvwxyz'[Math.floor(Math.random() * 10)]).join(''); // sem formar palavra (o filtro de nomes)
async function pagina(nome, toque = false) {
  const ctx = await b.newContext(toque ? { viewport: { width: 900, height: 600 }, hasTouch: true, isMobile: true } : { viewport: { width: 1100, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  return p;
}
const T = { PEDRA: 3, AGUA: 5, TRONCO: 6, TABUAS: 8, LA: 14 };
const qtd = (p, id) => p.evaluate((id) => window.__jogo.mercado.qtd(id), id);
const noChao = (p) => p.evaluate(() => window.__jogo.drops.lista());
const esperar = (p, ms) => p.waitForTimeout(ms);
async function ate(p, fn, arg, ms = 4000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(100); }
  return false;
}

// um palco de pedra bem lá no alto (acima de morros e lagos; 11x12, com ar em cima) para tudo ficar igual em qualquer semente
async function palco(p, centro = null) {
  return p.evaluate((c) => {
    const j = window.__jogo.jog, m = window.__jogo.mundo;
    const x0 = c ? c[0] : Math.floor(j.pos.x), z0 = c ? c[2] : Math.floor(j.pos.z), y0 = 55;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -6; dz <= 5; dz++) {
      m.definir(x0 + dx, y0 - 1, z0 + dz, 3); m.definir(x0 + dx, y0, z0 + dz, 3);
      for (let dy = 1; dy <= 6; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0);
    }
    j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = -0.48;
    return [x0, y0, z0];
  }, centro);
}
const ir = (p, x, z, yaw = 0, y = null) => p.evaluate(([x, z, yaw, y]) => {
  const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; if (y != null) j.pos.y = y; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = yaw; j.pitch = -0.48;
}, [x, z, yaw, y]);
// anda para a frente segurando W até a condição valer
async function andarAte(p, fn, arg, ms = 2500) {
  await p.keyboard.down('KeyW');
  const ok = await ate(p, fn, arg, ms);
  await p.keyboard.up('KeyW');
  return ok;
}
const bater = (p, n) => p.evaluate(async (n) => { for (let i = 0; i < n; i++) { window.__jogo.quebrar(null); await new Promise((r) => setTimeout(r, 40)); } }, n);

// ================= sem internet (computador) =================
const p = await pagina('local');
await p.click('#bt-sozinho');
await p.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
await p.click('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
await esperar(p, 2500);
let [x0, y0, z0] = await palco(p);
await esperar(p, 500);
conferir(await p.isVisible('#bt-largar') === false, 'computador: botão de largar só aparece no tablet (aqui é a tecla Q)');

// quebra um tronco: ele cai no chão, não vai direto para a mochila
await p.evaluate(([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 6), [x0, y0, z0]);
await esperar(p, 200);
await bater(p, 5);
let l = await noChao(p);
conferir(l.length === 1 && l[0].id === T.TRONCO && await qtd(p, T.TRONCO) === 0, 'quebrou o tronco: ele caiu no chão (ainda não está na mochila)');
const yAntes = l[0].y;
await ate(p, () => window.__jogo.drops.lista()[0]?.parado, null, 3000);
l = await noChao(p);
conferir(l[0].parado && Math.abs(l[0].y - (y0 + 1)) < 0.05 && yAntes > l[0].y - 0.01, `caiu com a gravidade e parou em cima do chão (y ${l[0].y})`);
await p.evaluate(() => { window.__jogo.jog.pitch = -0.7; });
await esperar(p, 600);
await p.screenshot({ path: SAIDA + '/drop-chao.png' });

// anda até ele: pega sozinho
conferir(await andarAte(p, () => window.__jogo.mercado.qtd(6) === 1), 'andou até o tronco e ele foi para a mochila');
conferir((await noChao(p)).length === 0 && await p.isVisible('#coleta .pego'), 'sumiu do chão e mostrou "+1 Tronco"');
conferir(await p.evaluate(() => window.__jogo.barra.includes(6)), 'tronco foi para a barra');

// Q larga 1 do que está na mão, jogado para a frente; quem largou não pega de volta na hora
await p.evaluate(() => { const j = window.__jogo; j.slot = j.barra.indexOf(6); });
await ir(p, x0 + 0.5, z0 + 3.5);
await p.keyboard.press('KeyQ');
await esperar(p, 700);
l = await noChao(p);
conferir(await qtd(p, T.TRONCO) === 0 && l.length === 1 && l[0].id === T.TRONCO, 'Q largou o tronco no chão');
conferir(l[0].z < z0 + 3.5 - 0.8, `foi jogado para a frente (z ${l[0].z.toFixed(2)})`);
await esperar(p, 1200);
conferir(await andarAte(p, () => window.__jogo.mercado.qtd(6) === 1), 'depois de um pouquinho dá para pegar de volta');

// Shift+Q larga a pilha inteira
await p.evaluate(() => { const j = window.__jogo; j.mercado.mexer({ t: 'pegar', id: 8, n: 5 }); j.barra[0] = 8; j.slot = 0; });
await ir(p, x0 + 0.5, z0 + 3.5);
await p.keyboard.down('Shift'); await p.keyboard.press('KeyQ'); await p.keyboard.up('Shift');
await esperar(p, 400);
l = await noChao(p);
conferir(await qtd(p, T.TABUAS) === 0 && l.length === 1 && l[0].n === 5, 'Shift+Q largou as 5 tábuas juntas');
conferir(await andarAte(p, () => window.__jogo.mercado.qtd(8) === 5, null, 3500), 'pegou as 5 de volta de uma vez');

// mão vazia: Q só avisa
await p.evaluate(() => { const j = window.__jogo; j.barra[0] = 0; j.slot = 0; });
await p.keyboard.press('KeyQ');
conferir((await noChao(p)).length === 0 && /vazia/.test(await p.textContent('#aviso')), 'Q com a mão vazia só avisa');

// boia na água
await p.evaluate(([x, y, z]) => { const m = window.__jogo.mundo; for (let a = 2; a <= 4; a++) for (let c = -4; c <= -2; c++) { m.definir(x + a, y - 1, z + c, 3); m.definir(x + a, y, z + c, 5); } }, [x0, y0, z0]);
await ir(p, x0 + 0.5, z0 + 0.5, 0.8);
await p.evaluate(([x, y, z]) => window.__jogo.mercado.enviar({ t: 'ev', e: 'la', x: x + 3.5, y: y + 3, z: z - 2.5 }, true), [x0, y0, z0]);
await esperar(p, 2500);
l = await noChao(p);
const naAgua = l.find((d) => d.id === T.LA);
conferir(naAgua && naAgua.y > y0 - 0.1 && naAgua.y < y0 + 1.4 && !naAgua.parado, `a lã boia na água (y ${naAgua && naAgua.y.toFixed(2)}, água em ${y0})`);
await p.evaluate(() => { window.__jogo.jog.pitch = -0.55; window.__jogo.jog.yaw = -0.95; });
await esperar(p, 500);
await p.screenshot({ path: SAIDA + '/drop-agua.png' });

// some depois de uns minutos (faz de conta que passou o tempo)
await p.evaluate(() => { for (const e of window.__jogo.drops.vivos.values()) e.t -= 5 * 60 * 1000 + 1000; });
await esperar(p, 300);
conferir((await noChao(p)).length === 0, 'itens velhos somem do chão');

await p.context().close();

// ================= online: dois jogadores (computador + tablet) =================
const sfx = letras();
async function conta(p, nome) {
  await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 });
}
const a = await pagina('Ana');
await conta(a, 'Ana' + sfx);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Chao');
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
await esperar(a, 2500);
conferir(await a.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'online: mundo com coletar e criar');
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bt = await pagina('Beto', true);
await conta(bt, 'Beto' + sfx);
await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
await esperar(bt, 2500);
[x0, y0, z0] = await palco(a);
await esperar(a, 800);
await palco(bt, [x0, y0, z0]);
await ir(bt, x0 + 3.5, z0 + 0.5, Math.PI / 2);
await esperar(bt, 800);
conferir(await bt.isVisible('#bt-largar'), 'tablet: tem o botão de largar');

// Ana quebra um tronco: os dois veem o tronco no chão
await a.evaluate(([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 6), [x0, y0, z0]);
await esperar(a, 500);
await ir(a, x0 + 0.5, z0 + 0.5, 0);
await bater(a, 5);
await ir(a, x0 - 3.5, z0 + 3.5, 0); // sai de perto logo (senão ela mesma pega)
conferir(await ate(a, () => window.__jogo.drops.lista().some((d) => d.id === 6)), 'online: o tronco caiu no chão para a Ana');
conferir(await ate(bt, () => window.__jogo.drops.lista().some((d) => d.id === 6)), 'online: o Beto também vê o tronco no chão');
// Beto vai até lá e pega
const tr = (await noChao(bt)).find((d) => d.id === 6);
await ir(bt, tr.x, tr.z + 2.5, 0);
conferir(await andarAte(bt, () => window.__jogo.mercado.qtd(6) === 1), 'online: Beto andou até o tronco e pegou');
await esperar(bt, 800);
conferir(await qtd(bt, T.TRONCO) === 1 && await qtd(a, T.TRONCO) === 0, 'online: a sala confirmou: o tronco é do Beto');
conferir(await ate(a, () => !window.__jogo.drops.lista().some((d) => d.id === 6)), 'online: sumiu do chão da Ana também');

// Beto passa para a Ana: vira para ela e toca no botão de largar
await ir(a, x0 + 0.5, z0 - 2.5, Math.PI);
await ir(bt, x0 + 0.5, z0 + 1.5, 0);
await bt.evaluate(() => { const j = window.__jogo; j.slot = j.barra.indexOf(6); j.jog.pitch = 0.1; });
await esperar(bt, 600);
await bt.tap('#bt-largar');
conferir(await ate(bt, () => window.__jogo.mercado.qtd(6) === 0 && window.__jogo.drops.lista().some((d) => d.id === 6)), 'online: tocou em largar e o tronco foi jogado para a Ana');
await esperar(bt, 250);
await bt.screenshot({ path: SAIDA + '/drop-passar-tablet.png' });
conferir(await ate(a, () => window.__jogo.mercado.qtd(6) === 1, null, 5000), 'online: a Ana pegou o tronco que o Beto jogou');
await esperar(a, 800);
conferir(await qtd(a, T.TRONCO) === 1 && await qtd(bt, T.TRONCO) === 0, 'online: a sala confirmou: agora é da Ana');

// lã de ovelha (o carinho manda o evento com o lugar da ovelha) aparece para os dois; quem chega depois também vê
await a.evaluate(([x, y, z]) => window.__jogo.mercado.enviar({ t: 'ev', e: 'la', x: x + 4.5, y: y + 2, z: z + 4.5 }, true), [x0, y0, z0]);
conferir(await ate(bt, () => window.__jogo.drops.lista().some((d) => d.id === 14)), 'online: a lã que caiu aparece para o Beto');
await bt.reload();
await bt.waitForSelector('#m-mundos:not([hidden])');
await bt.click('#lista-mundos .mundo');
await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala);
conferir(await ate(bt, () => window.__jogo.drops.lista().some((d) => d.id === 14), null, 6000), 'online: entrou de novo e a lã continua no chão');
// a sala não deixa pegar de longe
const la = (await noChao(a)).find((d) => d.id === 14);
await a.evaluate((i) => window.__jogo.sala.enviar({ t: 'chao-pegar', i }), la.i);
await esperar(a, 800);
conferir(await qtd(a, T.LA) === 0 && await ate(bt, () => window.__jogo.drops.lista().some((d) => d.id === 14)), 'online: a sala não deixa pegar de longe');
await a.screenshot({ path: SAIDA + '/drop-online-pc.png' });

console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros no console');
conferir(erros.length === 0, 'sem erros no console');
await b.close();
process.exit(falhas.length ? 1 : 0);

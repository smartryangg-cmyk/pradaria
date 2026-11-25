// Natureza do clássico: abóbora (bloco inteiro, machado) e cogumelos marrom e vermelho (plantinhas, quebram na hora).
// Nascem só nos mundos novos (opção escondida "natureza"; os antigos ficam com o terreno de antes).
// Regras e gerador no node, tablet e PC sem internet (o mundo novo tem cogumelo perto; abóbora posta com a mão,
// quebrada segurando e de volta na mochila) e online (a sala aceita a abóbora do terreno e o amigo vê sumir).
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-natureza.mjs        (PARTES=regras,tablet,pc,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { BLOCOS, INVENTARIO } from '../public/js/blocos.js';
import { normalizarOpcoes, PADRAO_NOVO, PADRAO_MUNDO } from '../public/js/opcoes-mundo.js';
import { tempoQuebrar } from '../public/js/quebra-regras.js';
import { criarGerador } from '../public/js/gerador.js';
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const PARTES = (process.env.PARTES || 'regras,tablet,pc,online').split(',');
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const ABOBORA = 242, MARROM = 243, VERMELHO = 244, NOVOS = [ABOBORA, MARROM, VERMELHO];

if (PARTES.includes('regras')) {
  ok(BLOCOS[ABOBORA] && BLOCOS[ABOBORA].solido && BLOCOS[ABOBORA].opaco && BLOCOS[ABOBORA].nome === 'Abóbora', 'a abóbora é um bloco inteiro (quadrado)');
  ok(BLOCOS[ABOBORA].tiles[0] !== BLOCOS[ABOBORA].tiles[2], 'a abóbora tem o topo (com o cabinho) diferente do lado (gomos)');
  ok([MARROM, VERMELHO].every((b) => BLOCOS[b] && BLOCOS[b].planta && !BLOCOS[b].solido), 'os cogumelos são plantinhas (dá para atravessar)');
  ok(NOVOS.every((b) => INVENTARIO.includes(b)), 'os três estão no inventário do criativo');
  const mao = tempoQuebrar(ABOBORA, 0, BLOCOS[ABOBORA]), mad = tempoQuebrar(ABOBORA, 1003, BLOCOS[ABOBORA]), pedra = tempoQuebrar(ABOBORA, 1004, BLOCOS[ABOBORA]);
  ok(Math.abs(mao - 1.5) < 0.01 && mad < mao && pedra < mad, `abóbora: mão ${mao} s, machado de madeira ${mad} s, de pedra ${pedra} s (clássico: 1,5 / 0,75 / 0,4)`);
  ok([MARROM, VERMELHO].every((b) => tempoQuebrar(b, 0, BLOCOS[b]) === 0), 'cogumelo quebra na hora');
  ok(normalizarOpcoes(PADRAO_NOVO).natureza === true, 'mundo novo: natureza ligada');
  ok(normalizarOpcoes({ ...PADRAO_MUNDO, natureza: undefined }).natureza === false && PADRAO_MUNDO.natureza === false, 'mundo antigo (sem a opção): natureza desligada, terreno igual ao de antes');
  // gerador: com a natureza nasce abóbora e cogumelo; sem ela, nenhum (e o resto do terreno é idêntico)
  const g = criarGerador(12345, 128, 0); const conta = { [ABOBORA]: 0, [MARROM]: 0, [VERMELHO]: 0 };
  const dif = {};
  for (let cx = -8; cx < 8; cx++) for (let cz = -8; cz < 8; cz++) {
    const t1 = g.terreno(cx, cz), t2 = g.terreno(cx, cz);
    g.decorar(t1.dados, cx, cz, t1.alturas, t1.biomas, () => false, true);
    g.decorar(t2.dados, cx, cz, t2.alturas, t2.biomas, () => false, false);
    for (let i = 0; i < t1.dados.length; i++) {
      const b = t1.dados[i], b2 = t2.dados[i];
      if (conta[b] !== undefined) conta[b]++;
      if (b !== b2) { const k = b2 + '>' + b; dif[k] = (dif[k] || 0) + 1; }
    }
  }
  const outras = Object.keys(dif).filter((k) => !/^(0|13)>24[23457]$/.test(k));
  ok(conta[ABOBORA] > 0 && conta[MARROM] > 0 && conta[VERMELHO] > 0, `256 pedaços com natureza: ${conta[ABOBORA]} abóboras, ${conta[MARROM]} cogumelos marrons, ${conta[VERMELHO]} vermelhos`);
  ok(conta[ABOBORA] < 200, 'abóbora é rara (canteirinhos aqui e ali)');
  ok(!outras.length, `sem a natureza não nasce nenhum, e com ela só troca ar ou capim (${JSON.stringify(dif)})`);
}

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
function vigiar(p, nome) {
  p.on('pageerror', (e) => erros.push(nome + ' ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
}
async function mundoSozinho(ctx, toque, nome) {
  const p = await ctx.newPage(); vigiar(p, nome);
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  await J(p, () => { window.__jogo.dia = 0.3; window.__jogo.vida.protegido = 1e9; });
  return p;
}
// chão firme na frente do jogador: devolve {x,y,z} do bloco de cima
async function chao(p) {
  return J(p, () => {
    const J_ = window.__jogo, j = J_.jog, m = J_.mundo; const x = Math.floor(j.pos.x), z = Math.floor(j.pos.z);
    let y = 120; while (y > 1 && !m.bloco(x, y, z)) y--;
    for (let dx = -1; dx <= 3; dx++) for (let dy = 1; dy <= 3; dy++) for (let dz = -1; dz <= 1; dz++) if (m.bloco(x + dx, y + dy, z + dz)) m.definir(x + dx, y + dy, z + dz, 0);
    for (let dx = 0; dx <= 3; dx++) for (let dy = -2; dy <= 0; dy++) if (m.bloco(x + dx, y + dy, z) !== 3) m.definir(x + dx, y + dy, z, 3); // chão de pedra até o alvo (o terreno podia ter buraco ou água bem ali)
    j.voando = false; j.pos.x = x + 0.5; j.pos.z = z + 0.5; j.pos.y = y + 1.05; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = -Math.PI / 2;
    return { x, y, z };
  });
}
// mira o topo do bloco (x+2, y, z) e coloca o que está na mão (usar), como o jogador faz
async function colocar(p, c, bloco) {
  await J(p, ([c, bloco]) => { const J_ = window.__jogo; J_.barra[0] = bloco; J_.slot = 0; }, [c, bloco]);
  for (let i = 0; i < 4; i++) {
    await J(p, (c) => { const J_ = window.__jogo, cam = J_.camera, j = J_.jog; j.yaw = -Math.PI / 2; j.pitch = -Math.atan2(cam.position.y - (c.y + 1), (c.x + 2.5) - cam.position.x); }, c);
    await esperar(p, 250);
    await J(p, () => window.__jogo.usar(null));
    await esperar(p, 500);
    if (await J(p, (c) => window.__jogo.mundo.bloco(c.x + 2, c.y + 1, c.z), c) === bloco) return true;
  }
  console.log('       colocar falhou:', JSON.stringify(await J(p, ([c, bloco]) => { const J_ = window.__jogo, m = J_.mundo, ach = []; for (let dx = -4; dx <= 6; dx++) for (let dy = -2; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) if (m.bloco(c.x + dx, c.y + dy, c.z + dz) === bloco) ach.push([dx, dy, dz]); return { ach, alvo: m.bloco(c.x + 2, c.y, c.z), cima: m.bloco(c.x + 2, c.y + 1, c.z), jog: [J_.jog.pos.x - c.x, J_.jog.pos.y - c.y, J_.jog.pos.z - c.z], inv: !document.querySelector('#inventario').hidden, mao: J_.barra[0], qtd: J_.mercado.qtd(bloco) }; }, [c, bloco])));
  await p.screenshot({ path: SAIDA + '/natureza-colocar-falhou.png' });
  return false;
}
// segura o "quebrar" até o bloco sumir (no clássico quebrar é segurar); devolve os segundos ou null
async function quebrarSegurando(p, c, alto = 1.5) {
  return J(p, async ([c, alto]) => {
    const J_ = window.__jogo, t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      const cam = J_.camera; J_.jog.pitch = -Math.atan2(cam.position.y - (c.y + alto), (c.x + 2.5) - cam.position.x);
      J_.quebrar(null); await new Promise((r) => setTimeout(r, 50));
      if (!J_.mundo.bloco(c.x + 2, c.y + 1, c.z)) return (performance.now() - t0) / 1000;
    }
    return null;
  }, [c, alto]);
}

async function local(nome, toque, ctx) {
  const p = await mundoSozinho(ctx, toque, nome);
  ok(await J(p, () => window.__jogo.opcoesMundo.natureza === true && window.__jogo.mercado.op.sobrevivencia), `${nome}: mundo novo de sobrevivência com a natureza ligada`);
  // o terreno de verdade em volta: tem cogumelo (floresta, taiga ou caverna) ou abóbora por perto
  const achou = await J(p, () => { const J_ = window.__jogo, m = J_.mundo, x0 = Math.floor(J_.jog.pos.x), z0 = Math.floor(J_.jog.pos.z), n = { 242: 0, 243: 0, 244: 0 };
    for (let x = x0 - 48; x <= x0 + 48; x++) for (let z = z0 - 48; z <= z0 + 48; z++) for (let y = 2; y < 110; y++) { const b = m.bloco(x, y, z); if (n[b] !== undefined) n[b]++; }
    return n; });
  ok(achou[243] + achou[244] + achou[242] > 0, `${nome}: perto de onde nasceu tem natureza no terreno (${JSON.stringify(achou)})`);
  // abóbora na mochila, posta com a mão e quebrada segurando (sem machado: 1,5 s); volta para a mochila
  await J(p, () => { const me = window.__jogo.mercado; me.e.itens[242] = 1; me.recebeu(me.e); });
  const c = await chao(p); await esperar(p, 800);
  ok(await colocar(p, c, ABOBORA), `${nome}: pôs a abóbora no chão`);
  ok(await J(p, () => !window.__jogo.mercado.qtd(242)), `${nome}: gastou a abóbora da mochila`);
  await J(p, ([c]) => { const j = window.__jogo.jog; j.yaw = -Math.PI / 2; j.pitch = -0.35; }, [c]); await esperar(p, 900);
  await p.screenshot({ path: SAIDA + `/natureza-${nome}-abobora.png` });
  await J(p, () => { window.__jogo.barra[0] = 0; });
  const s = await quebrarSegurando(p, c);
  ok(s !== null && s > 1.0 && s < 3.5, `${nome}: segurando, a abóbora quebrou com a mão em ${s && s.toFixed(2)} s (clássico: 1,5 s)`);
  await recolher(p);
  ok(await J(p, () => window.__jogo.mercado.qtd(242) === 1), `${nome}: a abóbora voltou para a mochila`);
  // cogumelo vermelho no chão de pedra (como na caverna): sai na hora e vai para a mochila
  await J(p, (c) => { const J_ = window.__jogo, j = J_.jog; J_.mundo.definir(c.x + 2, c.y + 1, c.z, 244); j.voando = false; j.pos.x = c.x + 0.5; j.pos.y = c.y + 1.05; j.pos.z = c.z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = -Math.PI / 2; }, c); await esperar(p, 800); // volta para o lugar (recolher andou até a abóbora)
  await J(p, () => { window.__jogo.barra[0] = 0; });
  const s2 = await quebrarSegurando(p, c, 1.2);
  ok(s2 !== null && s2 < 0.5, `${nome}: o cogumelo saiu na hora (${s2 && s2.toFixed(2)} s)`);
  await recolher(p);
  ok(await J(p, () => window.__jogo.mercado.qtd(244) === 1), `${nome}: o cogumelo foi para a mochila`);
  // os três lado a lado, para ver
  await J(p, (c) => { const J_ = window.__jogo, m = J_.mundo; m.definir(c.x + 2, c.y + 1, c.z, 242); m.definir(c.x + 2, c.y + 1, c.z - 1, 243); m.definir(c.x + 2, c.y + 1, c.z + 1, 244); m.definir(c.x + 2, c.y, c.z - 1, 3); m.definir(c.x + 2, c.y, c.z + 1, 3);
    const j = J_.jog; j.pos.x = c.x - 0.2; j.pos.z = c.z + 0.5; j.yaw = -Math.PI / 2; j.pitch = -0.3; }, c);
  await esperar(p, 1500);
  await p.screenshot({ path: SAIDA + `/natureza-${nome}-tres.png` });
  await ctx.close();
}
async function recolher(p) {
  await esperar(p, 1500);
  for (let t = 0; t < 4; t++) { const d = await J(p, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z])); if (!d.length) break; await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = y; }, d[0]); await esperar(p, 900); }
}

if (PARTES.includes('tablet')) await local('tablet', true, await b.newContext({ ...devices['Galaxy Tab S4'] }));
if (PARTES.includes('pc')) await local('pc', false, await b.newContext({ viewport: { width: 1280, height: 800 } }));

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
    if (await p.isVisible('#c-nasc .d-ano')) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '1990'); }
    await p.click('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 90000 }); if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
    await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 });
  }
  const a = await pagina('Ana', true);
  await conta(a, 'Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Natureza');
  await a.click('#m-novo button[type=submit]'); // sobrevivência
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  await J(a, () => { window.__jogo.dia = 0.3; window.__jogo.vida.protegido = 1e9; });
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', false);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2000);
  ok(await J(a, () => window.__jogo.opcoesMundo.natureza === true) && await J(bt, () => window.__jogo.opcoesMundo.natureza === true), 'online: o mundo novo tem natureza para a Ana e para o Beto (o terreno dos dois é igual)');
  // uma abóbora "do terreno" na frente da Ana (nos dois aparelhos, como o gerador faria): a Ana quebra segurando
  const c = await chao(a); await esperar(a, 1000);
  await J(bt, (c) => { const m = window.__jogo.mundo; for (let dx = 0; dx <= 3; dx++) for (let dy = -2; dy <= 0; dy++) m.definir(c.x + dx, c.y + dy, c.z, 3); for (let dx = -1; dx <= 3; dx++) for (let dy = 1; dy <= 3; dy++) for (let dz = -1; dz <= 1; dz++) m.definir(c.x + dx, c.y + dy, c.z + dz, 0); m.definir(c.x + 2, c.y + 1, c.z, 242);
    const j = window.__jogo.jog; j.voando = true; j.pos.x = c.x + 2.5; j.pos.y = c.y + 4; j.pos.z = c.z + 4.5; j.pitch = -0.6; j.yaw = 0; }, c);
  await J(a, (c) => window.__jogo.mundo.definir(c.x + 2, c.y + 1, c.z, 242), c);
  await esperar(a, 800);
  await bt.screenshot({ path: SAIDA + '/natureza-online-beto-antes.png' });
  await J(a, () => { window.__jogo.barra[0] = 0; });
  const s = await quebrarSegurando(a, c);
  ok(s !== null && s > 1.0, `online: a Ana quebrou a abóbora segurando (${s && s.toFixed(2)} s)`);
  let visto = 242;
  for (let i = 0; i < 20 && visto !== 0; i++) { await esperar(bt, 500); visto = await J(bt, (c) => window.__jogo.mundo.bloco(c.x + 2, c.y + 1, c.z), c); }
  ok(visto === 0, 'online: a abóbora sumiu para o Beto');
  await recolher(a);
  let tem = 0;
  for (let i = 0; i < 10 && tem !== 1; i++) { await esperar(a, 500); tem = await J(a, () => window.__jogo.mercado.qtd(242)); }
  ok(tem === 1, 'online: a sala aceitou a abóbora do terreno e ela está na mochila da Ana');
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

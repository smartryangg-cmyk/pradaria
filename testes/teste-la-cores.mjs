// Lã nas 16 cores do clássico (as 6 antigas + 10 novas, blocos 232..241). As cores novas saem misturando lãs,
// como as tintas do clássico se misturam (vermelha + amarela = 2 laranjas; branca + carvão = preta...).
// Regras no node, tablet e PC sem internet (receita tocada no livro, bloco colocado com a mão, quebrado segurando)
// e online (a sala aceita a receita e o amigo vê o bloco).
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-la-cores.mjs        (PARTES=regras,tablet,pc,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { RECEITAS, receitasDoMundo } from '../public/js/receitas.js';
import { BLOCOS, INVENTARIO } from '../public/js/blocos.js';
import { normalizarOpcoes, PADRAO_NOVO } from '../public/js/opcoes-mundo.js';
import { aplicar, opcoesEcon, estadoNovo, normalizar } from '../public/js/economia.js';
import { tempoQuebrar } from '../public/js/quebra-regras.js';
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const PARTES = (process.env.PARTES || 'regras,tablet,pc,online').split(',');
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const ANTIGAS = [14, 15, 16, 17, 18, 19], NOVAS = [232, 233, 234, 235, 236, 237, 238, 239, 240, 241];
const TODAS = [...ANTIGAS, ...NOVAS];

if (PARTES.includes('regras')) {
  ok(TODAS.every((b) => BLOCOS[b] && BLOCOS[b].solido && BLOCOS[b].opaco && /^Lã /.test(BLOCOS[b].nome)), 'as 16 lãs existem, são blocos inteiros (quadrados) e se chamam "Lã ..."');
  ok(new Set(TODAS.map((b) => BLOCOS[b].tiles[0])).size === 16, 'cada cor tem a sua textura');
  ok(NOVAS.every((b) => INVENTARIO.includes(b)), 'as 10 cores novas estão no inventário do criativo');
  const ids = new Set(receitasDoMundo(normalizarOpcoes(PADRAO_NOVO)).map((r) => r.id));
  ok(NOVAS.every((b) => RECEITAS.some((r) => r.faz[0] === b && ids.has(r.id))), 'toda cor nova tem receita no jogo base');
  const t = (b) => tempoQuebrar(b, 0, BLOCOS[b]);
  ok(NOVAS.every((b) => Math.abs(t(b) - t(14)) < 1e-9), `quebrar lã de qualquer cor leva o mesmo tempo da branca (${t(14).toFixed(2)} s)`);
  const op = opcoesEcon(normalizarOpcoes({ ...PADRAO_NOVO, sobrevivencia: true }));
  const e = normalizar({ ...estadoNovo(op), itens: { 14: 3, 1100: 1, 15: 1, 17: 1 } }, op);
  ok(aplicar(e, op, { t: 'criar', r: 'la-preta' }).ok && e.itens[241] === 1 && !e.itens[1100], 'servidor: branca + carvão = 1 lã preta');
  ok(aplicar(e, op, { t: 'criar', r: 'la-cinza' }).ok && e.itens[236] === 2, 'servidor: preta + branca = 2 cinzas');
  ok(aplicar(e, op, { t: 'criar', r: 'la-laranja' }).ok && e.itens[232] === 2 && !e.itens[15] && !e.itens[17], 'servidor: vermelha + amarela = 2 laranjas');
  ok(!aplicar(e, op, { t: 'criar', r: 'la-roxa' }).ok, 'servidor: sem lã vermelha e azul não sai roxa');
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
  await p.screenshot({ path: SAIDA + '/la-colocar-falhou.png' });
  return false;
}
// segura o "quebrar" até o bloco sumir (no clássico quebrar é segurar); devolve os segundos ou null
async function quebrarSegurando(p, c) {
  return J(p, async (c) => {
    const J_ = window.__jogo, t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      const cam = J_.camera; J_.jog.pitch = -Math.atan2(cam.position.y - (c.y + 1.5), (c.x + 2.5) - cam.position.x);
      J_.quebrar(null); await new Promise((r) => setTimeout(r, 50));
      if (!J_.mundo.bloco(c.x + 2, c.y + 1, c.z)) return (performance.now() - t0) / 1000;
    }
    return null;
  }, c);
}

async function local(nome, toque, ctx) {
  const p = await mundoSozinho(ctx, toque, nome);
  ok(await J(p, () => !window.__jogo.opcoesMundo.criativo && window.__jogo.mercado.op.sobrevivencia), `${nome}: mundo novo é sobrevivência (coletar e criar)`);
  // receita tocada no livro: vermelha + amarela = 2 laranjas; depois branca + carvão = preta
  await J(p, () => { const me = window.__jogo.mercado; me.e.itens[15] = 1; me.e.itens[17] = 1; me.e.itens[14] = 1; me.e.itens[1100] = 1; me.recebeu(me.e); });
  await esperar(p, 400);
  await J(p, () => window.__jogo.abrirInventario('criar'));
  await p.waitForSelector('#inventario:not([hidden]) [data-receita=la-laranja]', { timeout: 10000 });
  if (toque) await p.tap('[data-receita=la-laranja]'); else await p.click('[data-receita=la-laranja]');
  await esperar(p, 300);
  await p.screenshot({ path: SAIDA + `/la-${nome}-receita.png` });
  if (toque) await p.tap('#inv-saida'); else await p.click('#inv-saida');
  await esperar(p, 400);
  ok(await J(p, () => window.__jogo.mercado.qtd(232) === 2 && !window.__jogo.mercado.qtd(15) && !window.__jogo.mercado.qtd(17)), `${nome}: fez 2 lãs laranja com 1 vermelha e 1 amarela`);
  await J(p, () => window.__jogo.abrirInventario('criar')); await esperar(p, 300);
  await J(p, () => { const x = document.querySelector('[data-receita=la-preta]'); if (x) x.scrollIntoView({ block: 'center' }); });
  await p.waitForSelector('#inventario:not([hidden]) [data-receita=la-preta]', { timeout: 10000 });
  if (toque) await p.tap('[data-receita=la-preta]'); else await p.click('[data-receita=la-preta]');
  await esperar(p, 300);
  if (toque) await p.tap('#inv-saida'); else await p.click('#inv-saida');
  await esperar(p, 400);
  ok(await J(p, () => window.__jogo.mercado.qtd(241) === 1 && !window.__jogo.mercado.qtd(1100)), `${nome}: fez 1 lã preta com branca e carvão`);
  await p.keyboard.press('Escape').catch(() => {}); await J(p, () => { const x = document.querySelector('#inventario [data-fechar]'); if (x) x.click(); }); await esperar(p, 400);
  // coloca a laranja com a mão e quebra segurando: volta para a mochila
  const c = await chao(p); await esperar(p, 800);
  ok(await colocar(p, c, 232), `${nome}: colocou a lã laranja no chão`);
  ok(await J(p, () => window.__jogo.mercado.qtd(232) === 1), `${nome}: gastou 1 lã laranja da mochila`);
  await J(p, () => { window.__jogo.barra[0] = 0; });
  const s = await quebrarSegurando(p, c);
  ok(s !== null && s > 0.6, `${nome}: segurando, a lã quebrou com a mão em ${s && s.toFixed(2)} s (clássico: 1,2 s)`);
  await esperar(p, 1500);
  for (let t = 0; t < 4; t++) { const d = await J(p, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z])); if (!d.length) break; await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = y; }, d[0]); await esperar(p, 900); }
  ok(await J(p, () => window.__jogo.mercado.qtd(232) === 2), `${nome}: a lã quebrada voltou para a mochila`);
  // as 16 cores lado a lado, para ver
  await J(p, ([c, T]) => { const J_ = window.__jogo; T.forEach((b, i) => J_.mundo.definir(c.x + 3 + (i % 8), c.y + 1 + Math.floor(i / 8), c.z - 3, b)); const j = J_.jog; j.voando = true; j.pos.x = c.x + 7; j.pos.y = c.y + 2.5; j.pos.z = c.z + 3; j.yaw = 0; j.pitch = -0.1; }, [c, TODAS]);
  await esperar(p, 2500);
  await p.screenshot({ path: SAIDA + `/la-${nome}-16-cores.png` });
  await ctx.close();
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Cores');
  await a.click('[data-modo=criativo]'); // no criativo a Ana tem todas as lãs para pôr
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  await J(a, () => { window.__jogo.dia = 0.3; });
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', false);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2000);
  // a Ana põe a lã roxa e a preta com a mão; a sala aceita os blocos novos e o Beto vê
  const c = await chao(a); await esperar(a, 1000);
  ok(await colocar(a, c, 239), 'online: a Ana pôs a lã roxa com a mão');
  await J(bt, (c) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = c.x + 2.5; j.pos.y = c.y + 4; j.pos.z = c.z + 4.5; j.pitch = -0.6; j.yaw = 0; }, c);
  let visto = 0;
  for (let i = 0; i < 20 && visto !== 239; i++) { await esperar(bt, 500); visto = await J(bt, (c) => window.__jogo.mundo.bloco(c.x + 2, c.y + 1, c.z), c); }
  ok(visto === 239, `online: o Beto vê a lã roxa da Ana (${visto})`);
  await bt.screenshot({ path: SAIDA + '/la-online-beto.png' });
  // e quando a Ana tira, some para o Beto também
  await J(a, (c) => window.__jogo.comoJogador(() => window.__jogo.mundo.definir(c.x + 2, c.y + 1, c.z, 0)), c);
  for (let i = 0; i < 20 && visto !== 0; i++) { await esperar(bt, 500); visto = await J(bt, (c) => window.__jogo.mundo.bloco(c.x + 2, c.y + 1, c.z), c); }
  ok(visto === 0, 'online: a Ana tirou a lã e sumiu para o Beto');
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

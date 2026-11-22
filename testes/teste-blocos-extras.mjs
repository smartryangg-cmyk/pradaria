// Jogo base só com os blocos do clássico: moinho, forno de pão, farinha, manivela do poço, padaria, loja, cadeira,
// mesa, balcão e prateleira de pães viram o mod "Blocos extras" (ligado nos mundos antigos). Pão como no clássico:
// 3 trigos em fila na bancada; feno = 9 trigos. Regras no node, tablet sem internet (vila gerada e receita de
// verdade), mundo com o mod, e online (a sala recusa a receita extra e aceita o pão).
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-blocos-extras.mjs        (PARTES=regras,tablet,mod,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { receitasDoMundo, receita } from '../public/js/receitas.js';
import { normalizarOpcoes, PADRAO_NOVO } from '../public/js/opcoes-mundo.js';
import { aplicar, opcoesEcon, estadoNovo, normalizar } from '../public/js/economia.js';
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const PARTES = (process.env.PARTES || 'regras,tablet,mod,online').split(',');
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const EXTRAS = [49, 50, 51, 52, 53, 54, 55, 56, 57, 59, 180, 181, 182, 183, 184, 185, 187];

if (PARTES.includes('regras')) {
  const novo = normalizarOpcoes(PADRAO_NOVO), antigo = normalizarOpcoes({});
  const ids = (o) => receitasDoMundo(o).map((r) => r.id);
  ok(novo.extras === false && antigo.extras === true, 'mundo novo sem os blocos extras; mundo antigo continua com eles');
  ok(!['forno', 'manivela', 'cadeira', 'mesa', 'balcao', 'prateleira-paes'].some((i) => ids(novo).includes(i)), 'mundo novo: sem receita de forno de pão, manivela, cadeira, mesa, balcão e prateleira');
  ok(['forno', 'cadeira', 'mesa'].every((i) => ids(antigo).includes(i)), 'mundo antigo: as receitas extras continuam');
  ok(ids(novo).includes('pao') && receita('pao').bancada && receita('pao').usa[0][1] === 3, 'pão como no clássico: 3 trigos na bancada');
  ok(receita('feno').usa[0][1] === 9 && ids(novo).includes('trigo-do-feno'), 'feno = 9 trigos, e desfaz em 9 trigos');
  const opN = opcoesEcon(novo), opA = opcoesEcon({ ...antigo, sobrevivencia: true });
  const nova = (op) => normalizar({ ...estadoNovo(op), itens: { 8: 10, 3: 6, 20: 2, 32: 3 } }, op);
  let e = nova(opN);
  ok(!aplicar(e, opN, { t: 'criar', r: 'cadeira', bancada: true }).ok, 'a regra do servidor recusa criar cadeira no mundo novo');
  e = nova(opA);
  ok(aplicar(e, opA, { t: 'criar', r: 'cadeira', bancada: true }).ok, 'e aceita no mundo antigo');
  e = nova(opN);
  ok(aplicar(e, opN, { t: 'criar', r: 'pao', bancada: true }).ok && e.itens[58] === 1 && !e.itens[32], 'pão: 3 trigos viram 1 pão');
}

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
function vigiar(p, nome) {
  p.on('pageerror', (e) => erros.push(nome + ' ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
}
async function mundoSozinho(ctx, toque, nome, mod = false) {
  const p = await ctx.newPage(); vigiar(p, nome);
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  await p.evaluate(() => { const d = document.querySelector('#n-semente'); d.closest('details').open = true; d.value = 'vila42'; });
  if (mod) {
    await p.evaluate(() => { const bt = [...document.querySelectorAll('#n-abas button')].find((x) => /Mods/.test(x.textContent)); if (bt) bt.click(); });
    await esperar(p, 200);
    await p.evaluate(() => { const bt = [...document.querySelectorAll('#n-mods button, #n-mods label')].find((x) => /Blocos extras/i.test(x.textContent)); if (bt) bt.click(); });
  }
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  return p;
}
// acha a vila mais perto, vai até ela e conta os blocos extras que foram construídos de verdade
async function vila(p, nome) {
  const v = await J(p, () => {
    const m = window.__jogo.mundo;
    for (let r = 0; r <= 4; r++) for (let rx = -r; rx <= r; rx++) for (let rz = -r; rz <= r; rz++) {
      const w = m.vilas.regiao(rx, rz);
      if (w) return { x: w.x, y: w.y, z: w.z, tipos: w.estruturas.map((e) => e.tipo), r: w.estruturas.filter((e) => e.r).map((e) => e.r) };
    }
    return null;
  });
  if (!v) return null;
  await J(p, (v) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = v.x + 0.5; j.pos.y = v.y + 25; j.pos.z = v.z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.pitch = -1.2; window.__jogo.dia = 0.3; }, v);
  await esperar(p, 9000);
  const contagem = await J(p, ([v, EX]) => {
    const m = window.__jogo.mundo, ex = new Set(EX); let extras = 0, fornalha = 0, portas = 0, blocos = 0;
    for (const [x0, z0, x1, z1] of v.r) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = v.y - 4; y <= v.y + 14; y++) {
      const b = m.bloco(x, y, z); if (b) blocos++;
      if (ex.has(b)) extras++; if (b === 188) fornalha++; if (b === 47 || b === 48) portas++;
    }
    return { extras, fornalha, portas, blocos };
  }, [v, EXTRAS]);
  await p.screenshot({ path: SAIDA + `/extras-${nome}-vila.png` });
  return { ...v, ...contagem };
}

if (PARTES.includes('tablet')) {
  const ctx = await b.newContext({ ...devices['Galaxy Tab S4'] });
  const p = await mundoSozinho(ctx, true, 'tablet');
  ok(await J(p, () => window.__jogo.opcoesMundo.extras === false), 'tablet: mundo novo vem sem o mod "Blocos extras"');
  const v = await vila(p, 'tablet');
  ok(v && !v.tipos.some((t) => t === 'moinho' || t === 'padaria' || t === 'loja'), 'tablet: a vila não tem moinho, padaria nem loja ' + JSON.stringify(v && v.tipos));
  ok(v && v.blocos > 200 && v.extras === 0 && v.portas > 0, `tablet: a vila construída não tem nenhum bloco extra (${v && v.extras}) e tem casas com porta (${v && v.portas})`);
  // receita de pão de verdade: bancada colocada, 3 trigos, toque na receita
  await J(p, () => { const J_ = window.__jogo, j = J_.jog, m = J_.mundo; const x = Math.floor(j.pos.x), z = Math.floor(j.pos.z); let y = 120; while (y > 1 && !m.bloco(x + 2, y, z)) y--; m.definir(x + 2, y + 1, z, 34); j.voando = false; j.pos.x = x + 0.5; j.pos.z = z + 0.5; j.pos.y = y + 1.2; const me = J_.mercado; me.e.itens[32] = 3; me.recebeu(me.e); });
  await esperar(p, 1200);
  await J(p, () => window.__jogo.abrirInventario('criar'));
  await p.waitForSelector('#inventario:not([hidden]) [data-receita=pao]');
  ok(!(await p.isVisible('[data-receita=cadeira]')) && !(await p.isVisible('[data-receita=forno]')), 'tablet: o livro de receitas não mostra cadeira nem forno de pão');
  await p.tap('[data-receita=pao]'); await esperar(p, 300);
  await p.screenshot({ path: SAIDA + '/extras-tablet-pao.png' });
  await p.tap('#inv-saida'); await esperar(p, 400);
  ok(await J(p, () => window.__jogo.mercado.qtd(58) === 1 && window.__jogo.mercado.qtd(32) === 0), 'tablet: fez 1 pão com 3 trigos na bancada');
  await ctx.close();
}

if (PARTES.includes('mod')) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await mundoSozinho(ctx, false, 'pc-mod', true);
  ok(await J(p, () => window.__jogo.opcoesMundo.extras === true), 'pc: dá para ligar o mod "Blocos extras" ao criar o mundo');
  const v = await vila(p, 'pc-mod');
  ok(v && v.tipos.includes('padaria') && v.extras > 0, `pc: com o mod a vila tem padaria e os blocos extras (${v && v.extras}) ` + JSON.stringify(v && v.tipos));
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Extras');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', false);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2000);
  ok(await J(a, () => window.__jogo.opcoesMundo.extras === false) && await J(bt, () => window.__jogo.opcoesMundo.extras === false), 'online: o mundo novo da Ana vem sem os blocos extras (para os dois)');
  // a sala recusa uma cadeira pedida "por fora" (sem o mod não existe)
  const r = await J(a, () => new Promise((res) => { const m = window.__jogo.mercado; const antes = m.qtd(180); m.sala.enviar({ t: 'criar', r: 'cadeira', bancada: true }); setTimeout(() => res(m.qtd(180) - antes), 2500); }));
  ok(r === 0, 'online: a sala não deixa criar cadeira no mundo novo');
  const va = await vila(a, 'online-ana');
  ok(va && va.extras === 0 && va.blocos > 200, `online: a vila da Ana não tem blocos extras (${va && va.extras})`);
  await J(bt, (v) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = v.x + 3.5; j.pos.y = v.y + 25; j.pos.z = v.z + 0.5; j.pitch = -1.2; }, va);
  await esperar(bt, 8000);
  const vb = await J(bt, ([v, EX]) => { const m = window.__jogo.mundo, ex = new Set(EX); let extras = 0, blocos = 0; for (const [x0, z0, x1, z1] of v.r) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = v.y - 4; y <= v.y + 14; y++) { const b = m.bloco(x, y, z); if (b) blocos++; if (ex.has(b)) extras++; } return { extras, blocos }; }, [va, EXTRAS]);
  ok(vb.extras === 0 && vb.blocos === va.blocos, `online: o Beto vê a mesma vila, sem blocos extras (${vb.blocos} = ${va.blocos} blocos)`);
  await bt.screenshot({ path: SAIDA + '/extras-online-beto.png' });
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

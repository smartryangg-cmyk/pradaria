// Tijolo de pedra (bloco 246) e melancia (bloco 247), como no clássico, com a nossa textura.
// Tijolo de pedra: 4 pedras na grade 2x2 = 4 tijolos; só cai com picareta (com a mão quebra devagar e não dá nada).
// Melancia: nasce em canteirinhos na selva (só nos mundos novos); quebrar dá 3 a 7 fatias; 9 fatias na bancada = 1 melancia;
// a fatia é comida (2 de fome). Regras no node, tablet (toques) e PC (mouse) sem internet, e online (2 jogadores, a sala confere).
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-melancia.mjs        (PARTES=regras,tablet,pc,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { BLOCOS, INVENTARIO, ITENS, BLOCOS_EXTRAS } from '../public/js/blocos.js';
import { tempoQuebrar } from '../public/js/quebra-regras.js';
import { oQueCai, receitasDoMundo, guardavel } from '../public/js/receitas.js';
import { COMIDA } from '../public/js/fome-regras.js';
import { normalizarOpcoes, PADRAO_NOVO } from '../public/js/opcoes-mundo.js';
import { aplicar, opcoesEcon, estadoNovo, normalizar } from '../public/js/economia.js';
import { criarGerador } from '../public/js/gerador.js';
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const PARTES = (process.env.PARTES || 'regras,tablet,pc,online').split(',');
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const TIJOLO_PEDRA = 246, MELANCIA = 247, FATIA = 1013, PEDRA = 3, PICARETA_MADEIRA = 1001;

if (PARTES.includes('regras')) {
  ok(BLOCOS[TIJOLO_PEDRA] && BLOCOS[TIJOLO_PEDRA].nome === 'Tijolo de pedra' && BLOCOS[TIJOLO_PEDRA].solido && BLOCOS[TIJOLO_PEDRA].opaco, 'o tijolo de pedra existe e é um bloco inteiro');
  ok(BLOCOS[MELANCIA] && BLOCOS[MELANCIA].nome === 'Melancia' && BLOCOS[MELANCIA].solido && BLOCOS[MELANCIA].tiles[0] !== BLOCOS[MELANCIA].tiles[2], 'a melancia existe, é bloco inteiro, com topo e lados diferentes');
  ok(INVENTARIO.includes(TIJOLO_PEDRA) && INVENTARIO.includes(MELANCIA) && !BLOCOS_EXTRAS.has(TIJOLO_PEDRA) && !BLOCOS_EXTRAS.has(MELANCIA), 'os dois estão no inventário do jogo base (não são do mod)');
  ok(ITENS[FATIA] && ITENS[FATIA].nome === 'Fatia de melancia' && guardavel(FATIA) && COMIDA[FATIA] && COMIDA[FATIA].f === 2, 'a fatia de melancia é um item guardável e é comida (2 de fome)');
  const t = (b, m) => tempoQuebrar(b, m, BLOCOS[b]);
  ok(Math.abs(t(TIJOLO_PEDRA, 0) - t(PEDRA, 0)) < 1e-9 && Math.abs(t(TIJOLO_PEDRA, PICARETA_MADEIRA) - t(PEDRA, PICARETA_MADEIRA)) < 1e-9, `tijolo de pedra quebra como a pedra (mão ${t(TIJOLO_PEDRA, 0).toFixed(2)} s, picareta de madeira ${t(TIJOLO_PEDRA, PICARETA_MADEIRA).toFixed(2)} s)`);
  ok(Math.abs(t(MELANCIA, 0) - 1.5) < 1e-9 && t(MELANCIA, 1003) < 1, `melancia: mão ${t(MELANCIA, 0).toFixed(2)} s, machado de madeira ${t(MELANCIA, 1003).toFixed(2)} s (clássico: 1,5 s com a mão)`);
  ok(JSON.stringify(oQueCai(TIJOLO_PEDRA, 1, 2, 3, false, 0, true)) === '[]' && JSON.stringify(oQueCai(TIJOLO_PEDRA, 1, 2, 3, false, PICARETA_MADEIRA, true)) === JSON.stringify([[TIJOLO_PEDRA, 1]]), 'tijolo de pedra: com a mão não dá nada; com picareta volta o tijolo');
  const qs = new Set(); let soFatia = true;
  for (let i = 0; i < 300; i++) { const c = oQueCai(MELANCIA, i * 7, 60, -i * 3, true, 0, true); if (c.length !== 1 || c[0][0] !== FATIA) soFatia = false; else qs.add(c[0][1]); }
  ok(soFatia && [...qs].sort().join(',') === '3,4,5,6,7', `melancia quebrada dá só fatias, de 3 a 7 (${[...qs].sort().join(',')})`);
  const ids = new Set(receitasDoMundo(normalizarOpcoes(PADRAO_NOVO)).map((r) => r.id));
  ok(ids.has('tijolo-pedra') && ids.has('melancia'), 'as receitas do tijolo de pedra e da melancia estão no jogo base');
  const op = opcoesEcon(normalizarOpcoes({ ...PADRAO_NOVO, sobrevivencia: true }));
  const e = normalizar({ ...estadoNovo(op), itens: { [PEDRA]: 4, [FATIA]: 9 } }, op);
  ok(aplicar(e, op, { t: 'criar', r: 'tijolo-pedra' }).ok && e.itens[TIJOLO_PEDRA] === 4 && !e.itens[PEDRA], 'servidor: 4 pedras = 4 tijolos de pedra');
  ok(!aplicar(e, op, { t: 'criar', r: 'tijolo-pedra' }).ok, 'servidor: sem pedra não sai tijolo');
  const semBancada = aplicar(e, op, { t: 'criar', r: 'melancia' });
  ok(!semBancada.ok || e.itens[MELANCIA] === 1, 'servidor: 9 fatias = 1 melancia (precisa de bancada: ' + (semBancada.ok ? 'tinha' : semBancada.erro) + ')');
  // melancia nasce na selva (gerador.js), só nos mundos novos
  const g = criarGerador(12345, 128, 0); let com = 0, sem = 0;
  for (let cx = -16; cx < 16; cx++) for (let cz = -16; cz < 16; cz++) {
    const t1 = g.terreno(cx, cz), t2 = g.terreno(cx, cz);
    g.decorar(t1.dados, cx, cz, t1.alturas, t1.biomas, () => false, true);
    g.decorar(t2.dados, cx, cz, t2.alturas, t2.biomas, () => false, false);
    for (let i = 0; i < t1.dados.length; i++) {
      if (t1.dados[i] === MELANCIA) com++;
      if (t2.dados[i] === MELANCIA) sem++;
    }
  }
  ok(com > 0 && sem === 0, `melancias nascem nos mundos novos (${com} em 1024 pedaços; mundo antigo: ${sem})`);
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
  await p.screenshot({ path: SAIDA + '/melancia-colocar-falhou.png' });
  return false;
}
// segura o "quebrar" até o bloco sumir (no clássico quebrar é segurar); devolve os segundos ou null
async function quebrarSegurando(p, c, alto = 1.5) {
  return J(p, async ([c, alto]) => {
    const J_ = window.__jogo, t0 = performance.now();
    while (performance.now() - t0 < 30000) {
      const cam = J_.camera; J_.jog.pitch = -Math.atan2(cam.position.y - (c.y + alto), (c.x + 2.5) - cam.position.x);
      J_.quebrar(null); await new Promise((r) => setTimeout(r, 50));
      if (!J_.mundo.bloco(c.x + 2, c.y + 1, c.z)) return (performance.now() - t0) / 1000;
    }
    return null;
  }, [c, alto]);
}

async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); }
  return false;
}
async function recolher(p) {
  await esperar(p, 1500);
  for (let t = 0; t < 4; t++) { const d = await J(p, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z])); if (!d.length) break; await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = y; }, d[0]); await esperar(p, 900); }
}


const qtd = (p, id) => J(p, (id) => window.__jogo.mercado.qtd(id), id);
// come uma fatia: tablet um toque no meio da tela; PC segura o botão direito (olhando para o céu)
async function comerFatia(p, toque) {
  await J(p, () => { const J_ = window.__jogo, v = J_.vida; v.fome.f = 10; v.fome.s = 0; v.fome.x = 0; v.desenhar(); J_.barra[0] = 1013; J_.slot = 0; J_.jog.pitch = 1.2; });
  await esperar(p, 300);
  const vp = p.viewportSize();
  if (toque) await p.touchscreen.tap(vp.width / 2, vp.height / 2);
  else { await p.click('#tela'); await esperar(p, 300); await p.mouse.move(vp.width / 2, vp.height / 2); await p.mouse.down({ button: 'right' }); } // o clique prende o mouse na tela (como o jogador faz)
  await esperar(p, 400);
  const comendo = await p.isVisible('#comer');
  await ate(p, () => document.querySelector('#comer').hidden, null, 8000);
  if (!toque) await p.mouse.up({ button: 'right' });
  await esperar(p, 300);
  return { comendo, f: await J(p, () => window.__jogo.vida.fome.f) };
}

async function local(nome, toque, ctx) {
  const p = await mundoSozinho(ctx, toque, nome);
  ok(await J(p, () => !window.__jogo.opcoesMundo.criativo && window.__jogo.mercado.op.sobrevivencia), `${nome}: mundo novo é sobrevivência (coletar e criar)`);
  // receita tocada no livro (grade 2x2, sem bancada): 4 pedras = 4 tijolos de pedra
  await J(p, () => { const me = window.__jogo.mercado; me.e.itens[3] = 4; me.e.itens[1001] = 1; me.recebeu(me.e); });
  await esperar(p, 400);
  await J(p, () => window.__jogo.abrirInventario('criar'));
  await J(p, () => { const x = document.querySelector('[data-receita=tijolo-pedra]'); if (x) x.scrollIntoView({ block: 'center' }); });
  await p.waitForSelector('#inventario:not([hidden]) [data-receita=tijolo-pedra]', { timeout: 10000 });
  if (toque) await p.tap('[data-receita=tijolo-pedra]'); else await p.click('[data-receita=tijolo-pedra]');
  await esperar(p, 300);
  await p.screenshot({ path: SAIDA + `/melancia-${nome}-receita-tijolo.png` });
  if (toque) await p.tap('#inv-saida'); else await p.click('#inv-saida');
  await esperar(p, 400);
  ok(await qtd(p, 246) === 4 && !await qtd(p, 3), `${nome}: fez 4 tijolos de pedra com 4 pedras`);
  await p.keyboard.press('Escape').catch(() => {}); await J(p, () => { const x = document.querySelector('#inventario [data-fechar]'); if (x) x.click(); }); await esperar(p, 400);
  // coloca o tijolo e quebra com a picareta de madeira: volta
  const c = await chao(p); await esperar(p, 800);
  ok(await colocar(p, c, 246), `${nome}: colocou o tijolo de pedra`);
  await J(p, () => { const J_ = window.__jogo; J_.barra[0] = 1001; J_.slot = 0; });
  const s = await quebrarSegurando(p, c);
  ok(s !== null && s > 0.5 && s < 4, `${nome}: com a picareta de madeira o tijolo saiu em ${s && s.toFixed(2)} s (clássico: 1,1 s)`);
  await recolher(p);
  ok(await qtd(p, 246) === 4, `${nome}: o tijolo de pedra voltou para a mochila`);
  if (!toque) {
    const c2 = await chao(p);
    await J(p, (c) => { const J_ = window.__jogo; J_.mundo.definir(c.x + 2, c.y + 1, c.z, 246); J_.barra[0] = 0; J_.slot = 0; }, c2); await esperar(p, 600);
    const s2 = await quebrarSegurando(p, c2);
    ok(s2 !== null && s2 > 5, `${nome}: com a mão o tijolo de pedra levou ${s2 && s2.toFixed(1)} s (precisa de picareta)`);
    await recolher(p);
    ok(await qtd(p, 246) === 4, `${nome}: com a mão o tijolo sumiu sem dar nada`);
  }
  // melancia do mundo: quebra com a mão e dá 3 a 7 fatias
  const c3 = await chao(p);
  await J(p, (c) => { const J_ = window.__jogo; J_.mundo.definir(c.x + 2, c.y + 1, c.z, 247); J_.barra[0] = 0; J_.slot = 0; }, c3); await esperar(p, 600);
  let s3 = await quebrarSegurando(p, c3);
  if (s3 === null) { console.log('       (a melancia não saiu na 1ª mirada; mirando de novo)'); await esperar(p, 500); s3 = await quebrarSegurando(p, c3); }
  if (s3 === null) console.log('       melancia:', JSON.stringify(await J(p, (c) => { const J_ = window.__jogo; return { b: J_.mundo.bloco(c.x + 2, c.y + 1, c.z), jog: [J_.jog.pos.x - c.x, J_.jog.pos.y - c.y, J_.jog.pos.z - c.z], mao: J_.barra[J_.slot], inv: !document.querySelector('#inventario').hidden }; }, c3)));
  ok(s3 !== null && s3 > 0.8 && s3 < 4, `${nome}: segurando, a melancia quebrou com a mão em ${s3 && s3.toFixed(2)} s (clássico: 1,5 s)`);
  await recolher(p);
  const n = await qtd(p, 1013);
  ok(n >= 3 && n <= 7 && !await qtd(p, 247), `${nome}: a melancia deu ${n} fatias (3 a 7, como no clássico)`);
  const cf = await comerFatia(p, toque);
  ok(cf.comendo && cf.f === 12 && await qtd(p, 1013) === n - 1, `${nome}: comeu uma fatia ${toque ? 'tocando' : 'segurando o botão direito'} (fome 10 -> ${cf.f})`);
  await p.screenshot({ path: SAIDA + `/melancia-${nome}-comeu.png` });
  // para ver: tijolos de pedra e melancias lado a lado
  await J(p, (c) => { const J_ = window.__jogo; for (let i = 0; i < 4; i++) { J_.mundo.definir(c.x + 3 + i, c.y + 1, c.z - 3, 246); J_.mundo.definir(c.x + 3 + i, c.y + 2, c.z - 3, 246); J_.mundo.definir(c.x + 3 + i, c.y + 1, c.z - 1, 247); } const j = J_.jog; j.voando = true; j.pos.x = c.x + 5; j.pos.y = c.y + 3.2; j.pos.z = c.z + 3; j.yaw = 0; j.pitch = -0.35; }, c3);
  await esperar(p, 2500);
  await p.screenshot({ path: SAIDA + `/melancia-${nome}-perto.png` });
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Melancia');
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
  // uma melancia "da selva" na frente da Ana (nos dois aparelhos, como o gerador faria); a Ana quebra com a mão
  const c = await chao(a); await esperar(a, 1000);
  await J(bt, (c) => { const m = window.__jogo.mundo; for (let dx = 0; dx <= 3; dx++) for (let dy = -2; dy <= 0; dy++) m.definir(c.x + dx, c.y + dy, c.z, 3); for (let dx = -1; dx <= 3; dx++) for (let dy = 1; dy <= 3; dy++) for (let dz = -1; dz <= 1; dz++) m.definir(c.x + dx, c.y + dy, c.z + dz, 0); m.definir(c.x + 2, c.y + 1, c.z, 247);
    const j = window.__jogo.jog; j.voando = true; j.pos.x = c.x + 2.5; j.pos.y = c.y + 4; j.pos.z = c.z + 4.5; j.pitch = -0.6; j.yaw = 0; }, c);
  await J(a, (c) => { const J_ = window.__jogo; J_.mundo.definir(c.x + 2, c.y + 1, c.z, 247); J_.barra[0] = 0; J_.slot = 0; }, c);
  await esperar(a, 800);
  await bt.screenshot({ path: SAIDA + '/melancia-online-beto-antes.png' });
  const s = await quebrarSegurando(a, c);
  ok(s !== null && s > 0.8, `online: a Ana quebrou a melancia com a mão em ${s && s.toFixed(2)} s`);
  let visto = 247;
  for (let i = 0; i < 20 && visto !== 0; i++) { await esperar(bt, 500); visto = await J(bt, (c) => window.__jogo.mundo.bloco(c.x + 2, c.y + 1, c.z), c); }
  ok(visto === 0, 'online: a melancia sumiu para o Beto');
  const viu = await ate(a, () => window.__jogo.drops.lista().some((d) => d.id === 1013), null, 6000);
  if (!viu) console.log('       drops da Ana:', JSON.stringify(await J(a, () => window.__jogo.drops.lista().map((d) => [d.id, d.n]))));
  for (let k = 0; k < 8 && (await J(a, () => window.__jogo.drops.lista().some((d) => d.id === 1013))); k++) {
    await J(a, () => { const d = window.__jogo.drops.lista().find((q) => q.id === 1013); if (!d) return; const j = window.__jogo.jog; j.voando = true; j.pos.x = d.x; j.pos.y = d.y; j.pos.z = d.z; j.vel.x = j.vel.y = j.vel.z = 0; });
    await esperar(a, 700);
  }
  await esperar(a, 800);
  const n = await qtd(a, 1013);
  ok(n >= 3 && n <= 7, `online: a sala deu ${n} fatias para a Ana (3 a 7)`);
  const cf = await comerFatia(a, true);
  await esperar(a, 1500);
  ok(cf.comendo && cf.f === 12 && await qtd(a, 1013) === n - 1, `online: a Ana comeu uma fatia e a sala tirou da mochila (fome 10 -> ${cf.f}, sobraram ${await qtd(a, 1013)})`);
  await a.screenshot({ path: SAIDA + '/melancia-online-ana.png' });
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

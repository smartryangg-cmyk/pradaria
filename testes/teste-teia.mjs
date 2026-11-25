// Teia de aranha (bloco 245, como no clássico): quem entra fica preso (anda a um quarto e cai devagar, sem se machucar);
// com a mão leva 20 s e some sem dar nada; com espada sai em 0,4 s e dá 1 fio de teia. Nasce no teto das cavernas dos mundos novos.
// Regras no node, tablet (joystick) e PC (tecla W) sem internet, e online (a sala aceita o fio e o amigo vê a teia sumir).
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-teia.mjs        (PARTES=regras,tablet,pc,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { BLOCOS, INVENTARIO } from '../public/js/blocos.js';
import { tempoQuebrar } from '../public/js/quebra-regras.js';
import { oQueCai } from '../public/js/receitas.js';
import { criarGerador } from '../public/js/gerador.js';
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const PARTES = (process.env.PARTES || 'regras,tablet,pc,online').split(',');
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const TEIA = 245, FIO = 1111, ESPADA_PEDRA = 1114;

if (PARTES.includes('regras')) {
  ok(BLOCOS[TEIA] && BLOCOS[TEIA].nome === 'Teia' && !BLOCOS[TEIA].solido, 'a teia existe e dá para entrar nela');
  ok(INVENTARIO.includes(TEIA), 'a teia está no inventário do criativo');
  const mao = tempoQuebrar(TEIA, 0, BLOCOS[TEIA]), esp = tempoQuebrar(TEIA, ESPADA_PEDRA, BLOCOS[TEIA]), pic = tempoQuebrar(TEIA, 1002, BLOCOS[TEIA]);
  ok(mao === 20 && Math.abs(esp - 0.4) < 0.01 && pic === 20, `teia: mão ${mao} s, espada ${esp} s, picareta ${pic} s (clássico: 20 / 0,4 / 20)`);
  ok(JSON.stringify(oQueCai(TEIA, 1, 2, 3, true, 0, true)) === '[]', 'teia com a mão: some sem dar nada');
  ok(JSON.stringify(oQueCai(TEIA, 1, 2, 3, true, ESPADA_PEDRA, true)) === JSON.stringify([[FIO, 1]]), 'teia com espada: 1 fio de teia');
  const g = criarGerador(12345, 128, 0); let com = 0, sem = 0;
  for (let cx = -8; cx < 8; cx++) for (let cz = -8; cz < 8; cz++) {
    const t1 = g.terreno(cx, cz), t2 = g.terreno(cx, cz);
    g.decorar(t1.dados, cx, cz, t1.alturas, t1.biomas, () => false, true);
    g.decorar(t2.dados, cx, cz, t2.alturas, t2.biomas, () => false, false);
    for (let i = 0; i < t1.dados.length; i++) { if (t1.dados[i] === TEIA) com++; if (t2.dados[i] === TEIA) sem++; }
  }
  ok(com > 0 && com < 2000 && sem === 0, `teias no teto das cavernas só nos mundos novos (${com} em 256 pedaços; mundo antigo: ${sem})`);
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
  await p.screenshot({ path: SAIDA + '/teia-colocar-falhou.png' });
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

// corredor de pedra (12 blocos para -z) com teia do 5º ao 9º bloco; devolve {x, y, z} do começo
async function corredor(p) {
  return J(p, () => {
    const J_ = window.__jogo, m = J_.mundo, j = J_.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.max(m.chao(x0, z0) + 1, 40);
    for (let x = -3; x <= 3; x++) for (let z = -16; z <= 3; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); for (let y = 0; y < 12; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
    for (let z = 5; z <= 9; z++) for (let y = 0; y < 2; y++) for (let x = -1; x <= 1; x++) m.definir(x0 + x, y0 + y, z0 - z, 245);
    j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0;
    return { x: x0, y: y0, z: z0 };
  });
}
// anda para a frente por ms (W no PC, joystick no tablet); devolve quanto andou
async function andar(p, toque, ms) {
  const z0 = await J(p, () => window.__jogo.jog.pos.z);
  if (toque) {
    const cdp = await p.context().newCDPSession(p), vp = p.viewportSize(), x0 = vp.width * 0.18, y0 = vp.height * 0.7;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: y0 - 60, id: 1 }] });
    await esperar(p, ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else { await p.keyboard.down('KeyW'); await esperar(p, ms); await p.keyboard.up('KeyW'); }
  await esperar(p, 300);
  return z0 - await J(p, () => window.__jogo.jog.pos.z);
}

async function local(nome, toque, ctx) {
  const p = await mundoSozinho(ctx, toque, nome);
  const c = await corredor(p); await esperar(p, 800);
  const livre = await andar(p, toque, 600);
  await J(p, (c) => { const j = window.__jogo.jog; j.pos.x = c.x + 0.5; j.pos.z = c.z - 5.6; j.pos.y = c.y; j.vel.x = j.vel.z = 0; }, c); await esperar(p, 400);
  const preso = await andar(p, toque, 600);
  ok(livre > 1.5 && preso > 0.05 && preso < livre * 0.4, `${nome}: fora da teia andou ${livre.toFixed(2)} e dentro ${preso.toFixed(2)} no mesmo tempo (clássico: um quarto)`);
  await p.screenshot({ path: SAIDA + `/teia-${nome}-preso.png` });
  // cair de 8 blocos em cima da teia: desce devagar e não machuca
  await J(p, () => { window.__jogo.vida.protegido = 0; });
  const vida0 = await J(p, () => window.__jogo.vida.atual);
  await J(p, (c) => { const m = window.__jogo.mundo; for (let y = 0; y < 2; y++) m.definir(c.x + 2, c.y + y, c.z - 12, 245); const j = window.__jogo.jog; j.pos.x = c.x + 2.5; j.pos.z = c.z - 11.5; j.pos.y = c.y + 8; j.vel.x = j.vel.y = j.vel.z = 0; }, c);
  const naTeia = await J(p, async () => { const j = window.__jogo.jog, t0 = performance.now(); let vmin = 0;
    while (performance.now() - t0 < 3000) { await new Promise((r) => requestAnimationFrame(r)); if (j.naTeia) { await new Promise((r) => setTimeout(r, 300)); return { t: true, vy: j.vel.y }; } vmin = Math.min(vmin, j.vel.y); }
    return { t: false, vy: vmin }; });
  await esperar(p, 2500);
  const vida1 = await J(p, () => window.__jogo.vida.atual);
  await J(p, () => { window.__jogo.vida.protegido = 1e9; });
  ok(naTeia.t && Math.abs(naTeia.vy) < 1, `${nome}: caindo na teia fica preso e desce devagar (velocidade ${naTeia.vy.toFixed(2)})`);
  ok(vida1 === vida0, `${nome}: caiu de 8 blocos na teia e não se machucou (vida ${vida0} -> ${vida1})`);
  // com espada de pedra: corta rápido e dá fio
  await J(p, (c) => { const J_ = window.__jogo, j = J_.jog, m = J_.mundo; m.definir(c.x + 2, c.y + 1, c.z, 3); m.definir(c.x + 2, c.y, c.z, 3); }, c);
  const ch = await chao(p);
  await J(p, (c) => { const J_ = window.__jogo, me = J_.mercado; J_.mundo.definir(c.x + 2, c.y + 1, c.z, 245); me.e.itens[1114] = 1; me.recebeu(me.e); J_.barra[0] = 1114; J_.slot = 0; }, ch);
  await esperar(p, 800);
  const s = await quebrarSegurando(p, ch);
  ok(s !== null && s < 1.2, `${nome}: com a espada a teia saiu em ${s && s.toFixed(2)} s`);
  await recolher(p);
  ok(await J(p, () => window.__jogo.mercado.qtd(1111) === 1), `${nome}: a teia cortada com espada deu 1 fio de teia`);
  if (nome === 'pc') {
    // com a mão: 20 s segurando e não dá nada
    const ch2 = await chao(p);
    await J(p, (c) => { const J_ = window.__jogo; J_.mundo.definir(c.x + 2, c.y + 1, c.z, 245); J_.barra[0] = 0; }, ch2); await esperar(p, 600);
    const s2 = await quebrarSegurando(p, ch2);
    ok(s2 !== null && s2 > 15 && s2 < 26, `${nome}: com a mão a teia levou ${s2 && s2.toFixed(1)} s (clássico: 20 s)`);
    await recolher(p);
    ok(await J(p, () => window.__jogo.mercado.qtd(1111) === 1 && !window.__jogo.mercado.qtd(245)), `${nome}: com a mão a teia sumiu sem dar nada`);
  }
  // perto, para ver
  await J(p, (c) => { const J_ = window.__jogo, m = J_.mundo; for (let y = 1; y <= 2; y++) for (let z = -1; z <= 1; z++) m.definir(c.x + 2, c.y + y, c.z + z, 245); const j = J_.jog; j.pos.x = c.x - 0.3; j.pos.z = c.z + 0.5; j.pos.y = c.y + 1.05; j.yaw = -Math.PI / 2; j.pitch = -0.1; }, ch);
  await esperar(p, 1500);
  await p.screenshot({ path: SAIDA + `/teia-${nome}-perto.png` });
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Teia');
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
  // uma teia "da caverna" na frente da Ana (nos dois aparelhos, como o gerador faria); a Ana corta com a espada de pedra
  const c = await chao(a); await esperar(a, 1000);
  await J(bt, (c) => { const m = window.__jogo.mundo; for (let dx = 0; dx <= 3; dx++) for (let dy = -2; dy <= 0; dy++) m.definir(c.x + dx, c.y + dy, c.z, 3); for (let dx = -1; dx <= 3; dx++) for (let dy = 1; dy <= 3; dy++) for (let dz = -1; dz <= 1; dz++) m.definir(c.x + dx, c.y + dy, c.z + dz, 0); m.definir(c.x + 2, c.y + 1, c.z, 245);
    const j = window.__jogo.jog; j.voando = true; j.pos.x = c.x + 2.5; j.pos.y = c.y + 4; j.pos.z = c.z + 4.5; j.pitch = -0.6; j.yaw = 0; }, c);
  // a sala só conhece o que a Ana tem de verdade: sem espada, ela tira a teia com a mão (20 s) e não ganha nada
  await J(a, (c) => { const J_ = window.__jogo; J_.mundo.definir(c.x + 2, c.y + 1, c.z, 245); J_.barra[0] = 0; }, c);
  await esperar(a, 800);
  await bt.screenshot({ path: SAIDA + '/teia-online-beto-antes.png' });
  const s = await quebrarSegurando(a, c);
  ok(s !== null && s > 15, `online: a Ana tirou a teia com a mão em ${s && s.toFixed(1)} s`);
  let visto = 245;
  for (let i = 0; i < 20 && visto !== 0; i++) { await esperar(bt, 500); visto = await J(bt, (c) => window.__jogo.mundo.bloco(c.x + 2, c.y + 1, c.z), c); }
  ok(visto === 0, 'online: a teia sumiu para o Beto');
  await recolher(a); await esperar(a, 1500);
  ok(await J(a, () => !window.__jogo.mercado.qtd(1111) && !window.__jogo.mercado.qtd(245)), 'online: a sala não deu nada (teia com a mão não dá fio)');
  // o Beto entra numa teia e fica preso também
  const cb = await J(bt, (c) => { const m = window.__jogo.mundo, j = window.__jogo.jog; for (let z = 1; z <= 3; z++) m.definir(c.x, c.y + 1, c.z + z, 245), m.definir(c.x, c.y + 2, c.z + z, 245); j.voando = false; j.pos.x = c.x + 0.5; j.pos.y = c.y + 1.05; j.pos.z = c.z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; return c; }, c);
  await esperar(bt, 600);
  ok(await J(bt, () => window.__jogo.jog.naTeia), 'online: o Beto entrou na teia e ficou preso');
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

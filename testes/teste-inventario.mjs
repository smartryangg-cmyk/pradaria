// Inventário igual ao clássico, jogando pela tela: 27 + barra 9 + segunda mão, grade 2x2 na mochila e 3x3 na
// bancada, pilhas de 64, arrastar, dividir (botão direito / segurar o dedo), shift, teclas 1..9, soltar fora,
// livro de receitas que arruma a grade e mochila cheia que deixa o item no chão.
// Uso: (cd public && python3 -m http.server 8765) e node testes/teste-inventario.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };

async function mundo(ctx, toque) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await p.waitForTimeout(2500);
  return p;
}
const meio = async (p, sel) => { const r = await p.locator(sel).boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
const S = (i) => (i < 9 ? `.inv-barra [data-i="${i}"]` : i === 36 ? `.inv-mao2 [data-i="36"]` : `.inv-mochila [data-i="${i}"]`);
const G = (i) => `.grade-criar [data-i="${i}"]`;
const inv = (p) => p.evaluate(() => { const v = window.__jogo.inv; return { s: v.s.map((x) => x && [x.id, x.n]), g: v.g.map((x) => x && [x.id, x.n]), c: v.cursor && [v.cursor.id, v.cursor.n], w: v.w, itens: { ...window.__jogo.mercado.e.itens }, cont: v.contagem() }; });
const bate = (e) => JSON.stringify(Object.fromEntries(Object.entries(e.itens).filter(([, n]) => n > 0).map(([k, n]) => [k, n]).sort())) === JSON.stringify(Object.fromEntries(Object.entries(e.cont).map(([k, n]) => [k, n]).sort()));

// ---------- PC (mouse e teclado) ----------
{
  const p = await mundo(await b.newContext({ viewport: { width: 1280, height: 800 } }), false);
  await p.evaluate(() => { const m = window.__jogo.mercado; m.mexer({ t: 'pegar', id: 6, n: 3 }); m.mexer({ t: 'pegar', id: 2, n: 64 }); m.mexer({ t: 'pegar', id: 2, n: 6 }); });
  await p.waitForTimeout(300);
  let e = await inv(p);
  ok(e.s[0] && e.s[0][0] === 2 && e.s[0][1] === 64 && e.s[1][1] === 6 && e.s[2][0] === 6, 'pilhas de 64: 70 terras = 64 + 6, na barra ' + JSON.stringify(e.s.slice(0, 3)));
  await p.keyboard.press('KeyE'); await p.waitForSelector('#inventario:not([hidden]) .inv-mochila');
  ok(await p.locator('.inv-mochila .slot-inv').count() === 27 && await p.locator('.inv-barra .slot-inv').count() === 9 && await p.locator('.grade-criar .slot-inv').count() === 4 && await p.isVisible(S(36)), 'E abre a mochila: 27 + barra 9 + segunda mão + grade 2x2');
  // arrastar com o mouse: troncos da barra para a mochila
  const [ax, ay] = await meio(p, S(2)), [bx, by] = await meio(p, S(12));
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 8 }); await p.mouse.up();
  e = await inv(p);
  ok(!e.s[2] && e.s[12] && e.s[12][0] === 6 && e.s[12][1] === 3, 'arrastar a pilha leva para outro espaço');
  // clique direito: metade
  await p.click(S(0), { button: 'right' }); e = await inv(p);
  ok(e.c && e.c[1] === 32 && e.s[0][1] === 32, 'botão direito pega a metade (32 de 64)');
  // arrastar com algo preso por 4 espaços: reparte
  const alvos = await Promise.all([20, 21, 22, 23].map((i) => meio(p, S(i))));
  await p.mouse.move(...alvos[0]); await p.mouse.down(); for (const a of alvos.slice(1)) await p.mouse.move(...a, { steps: 4 }); await p.mouse.up();
  e = await inv(p);
  ok([20, 21, 22, 23].every((i) => e.s[i] && e.s[i][1] === 8) && !e.c, 'arrastar 32 terras por 4 espaços põe 8 em cada');
  // shift: da mochila para a barra
  await p.click(S(20), { modifiers: ['Shift'] }); e = await inv(p);
  ok(!e.s[20] && e.s[0][1] === 40, 'shift-clique leva da mochila para a barra (junta na pilha)');
  // tecla 1..9 em cima de um espaço
  await p.hover(S(21)); await p.keyboard.press('Digit9'); e = await inv(p);
  ok(e.s[8] && e.s[8][0] === 2 && e.s[8][1] === 8 && !e.s[21], 'tecla 9 com o mouse em cima troca com o espaço 9 da barra');
  // grade 2x2: 1 tronco -> 4 tábuas pelo resultado
  await p.click(S(12), { button: 'right' }); // pega 2 de 3
  await p.click(G(0), { button: 'right' }); // larga 1 na grade
  await p.click(S(12)); // devolve o resto
  ok(await p.isVisible('#inv-saida.pronta'), '1 tronco na grade: o resultado mostra tábuas');
  await p.click('#inv-saida'); e = await inv(p);
  ok(e.c && e.c[0] === 8 && e.c[1] === 4 && e.itens[8] === 4 && e.itens[6] === 2 && !e.g[0], 'clicar no resultado cria: 4 tábuas no cursor, gastou 1 tronco');
  // espalhar 4 tábuas nos 4 espaços da grade (1 em cada): bancada
  const gs = await Promise.all([0, 1, 2, 3].map((i) => meio(p, G(i))));
  await p.mouse.move(...gs[0]); await p.mouse.down({ button: 'right' }); for (const a of gs.slice(1)) await p.mouse.move(...a, { steps: 4 }); await p.mouse.up({ button: 'right' });
  e = await inv(p);
  ok(e.g.slice(0, 4).every((x) => x && x[0] === 8 && x[1] === 1) && !e.c, 'arrastar com o direito põe 1 tábua em cada espaço da grade');
  await p.screenshot({ path: SAIDA + '/inv-pc-bancada-na-grade.png' });
  await p.click('#inv-saida', { modifiers: ['Shift'] }); await p.waitForTimeout(200); e = await inv(p);
  ok(e.itens[34] === 1 && !e.itens[8] && e.s.some((x) => x && x[0] === 34), 'shift no resultado: a bancada vai direto para a mochila');
  ok(bate(e), 'a arrumação bate com a mochila de verdade ' + JSON.stringify(e.cont));
  // soltar fora da janela: cai no chão
  await p.click(S(1)); // 6 terras no cursor
  await p.mouse.click(30, 400);
  await p.waitForTimeout(400);
  const chao = await p.evaluate(() => window.__jogo.drops.lista().filter((d) => d.id === 2).reduce((s, d) => s + d.n, 0));
  e = await inv(p);
  ok(chao === 6 && !e.c && e.itens[2] === 64, 'clicar fora da janela larga a pilha no chão (' + chao + ')');
  // fechar com coisa na grade: volta para a mochila
  await p.click(S(12), { button: 'right' }); await p.click(G(3)); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  e = await inv(p);
  ok(!e.g.some(Boolean) && !e.c && e.itens[6] === 2 && bate(e), 'fechar a mochila devolve o que estava na grade');
  // livro de receitas: bancada colocada, tocar nela abre a 3x3
  await p.evaluate(() => {
    const J = window.__jogo, m = J.mundo, j = J.jog, X = Math.floor(j.pos.x), Z = Math.floor(j.pos.z), Y = 60;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -4; dz <= 3; dz++) { m.definir(X + dx, Y, Z + dz, 3); for (let dy = 1; dy < 5; dy++) m.definir(X + dx, Y + dy, Z + dz, 0); }
    m.definir(X, Y + 1, Z - 2, 34);
    j.voando = false; j.vel.x = j.vel.y = j.vel.z = 0; j.pos.x = X + 0.5; j.pos.z = Z + 0.5; j.pos.y = Y + 1; j.yaw = 0; j.pitch = -0.35;
    J.mercado.mexer({ t: 'pegar', id: 8, n: 3 }); J.mercado.mexer({ t: 'pegar', id: 1000, n: 2 });
  });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__jogo.usar(null)); await p.waitForTimeout(300);
  ok(await p.isVisible('#inventario:not([hidden]) .grade-criar.w3'), 'tocar na bancada abre a grade 3x3');
  await p.click('#abas-inv [data-aba=criar]'); await p.click('[data-receita=picareta-madeira]'); await p.waitForTimeout(200);
  e = await inv(p);
  ok(e.w === 3 && JSON.stringify(e.g.map((x) => (x ? x[0] : 0))) === JSON.stringify([8, 8, 8, 0, 1000, 0, 0, 1000, 0]), 'livro arruma a picareta na grade: 3 tábuas em cima, 2 gravetos no meio');
  await p.screenshot({ path: SAIDA + '/inv-pc-picareta.png' });
  await p.click('#inv-saida'); await p.click(S(30)); e = await inv(p);
  ok(e.itens[1001] === 1 && e.s[30] && e.s[30][0] === 1001, 'criou a picareta de madeira pela grade');
  await p.click('#inventario [data-fechar]'); await p.waitForTimeout(300);
  // segunda mão: mão vazia coloca o bloco da segunda mão
  await p.evaluate(() => { const v = window.__jogo.inv; const i = v.s.findIndex((x) => x && x.id === 2); v.s[36] = v.s[i]; v.s[i] = null; window.__jogo.slot = 7; window.__jogo.barra[7] = 0; });
  await p.evaluate(() => { const v = window.__jogo.inv; if (v.s[7]) { v.moverRapido('s', 7); } });
  const antes = (await inv(p)).s[36][1];
  await p.evaluate(() => { const j = window.__jogo.jog; j.yaw = Math.PI; j.pitch = -0.9; }); await p.waitForTimeout(400);
  const colocou = await p.evaluate(() => { const J = window.__jogo, j = J.jog; const a = J.mundo.raycast(J.camera.position, J.camera.getWorldDirection(new J.camera.position.constructor()), 6); J.usar(null); return [J.barra[7], J.inv.s[36] && J.inv.s[36].id, J.pausado, a && [a.b, a.x - Math.floor(j.pos.x), a.y - Math.floor(j.pos.y), a.z - Math.floor(j.pos.z)]]; });
  await p.waitForTimeout(300); e = await inv(p);
  ok(e.s[36] && e.s[36][1] === antes - 1, `com a mão vazia, colocou terra da segunda mão (${antes} -> ${e.s[36] && e.s[36][1]}, bloco ${colocou})`);
  // mochila cheia: o item fica no chão
  await p.evaluate(() => { const m = window.__jogo.mercado; const ids = [1, 3, 4, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 31, 32, 33, 71, 73, 131, 47, 49, 51, 53, 55, 57, 58, 59, 66, 67]; for (const id of ids) m.mexer({ t: 'pegar', id, n: 64 }, true); });
  await p.waitForTimeout(300);
  const cheio = await p.evaluate(() => { const m = window.__jogo.mercado; return [m.mexer({ t: 'pegar', id: 68, n: 1 }, true), Object.values(m.e.itens).length]; });
  e = await inv(p);
  ok(!cheio[0], 'mochila com os 37 espaços cheios não pega mais nada (' + cheio[1] + ' tipos)');
  ok(bate(e), 'a arrumação continua batendo com a mochila');
  await p.keyboard.press('KeyE'); await p.waitForTimeout(300);
  await p.screenshot({ path: SAIDA + '/inv-pc-cheia.png' });
  ok(!(await p.isVisible('.inv-extra')) && (await inv(p)).s.every(Boolean), 'mochila cheia: os 37 espaços ocupados e nada sobrando');
  await p.context().close();
}

// ---------- celular (toque) ----------
{
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const p = await mundo(ctx, true);
  await p.evaluate(() => { const m = window.__jogo.mercado; m.mexer({ t: 'pegar', id: 6, n: 2 }); m.mexer({ t: 'pegar', id: 1, n: 30 }); });
  await p.waitForTimeout(300);
  await p.tap('#barra .slot.mais'); await p.waitForSelector('#inventario:not([hidden]) .inv-mochila');
  const cdp = await ctx.newCDPSession(p);
  const toque = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const [ax, ay] = await meio(p, S(0)), [bx, by] = await meio(p, S(9));
  await toque('touchStart', ax, ay); for (let k = 1; k <= 8; k++) await toque('touchMove', ax + (bx - ax) * k / 8, ay + (by - ay) * k / 8); await toque('touchEnd');
  await p.waitForTimeout(200);
  let e = await inv(p);
  ok(!e.s[0] && e.s[9] && e.s[9][1] === 30, 'celular: arrastar com o dedo move a pilha');
  await toque('touchStart', bx, by); await p.waitForTimeout(700); await toque('touchEnd'); await p.waitForTimeout(200);
  e = await inv(p);
  ok(e.c && e.c[1] === 15 && e.s[9][1] === 15, 'celular: segurar o dedo pega a metade');
  await p.screenshot({ path: SAIDA + '/inv-celular-metade.png' });
  await p.tap(S(15)); e = await inv(p);
  ok(e.s[15] && e.s[15][1] === 15 && !e.c, 'celular: tocar num vazio solta');
  // mover rápido (no lugar do shift)
  await p.tap('#inv-rapido'); await p.tap(S(15)); e = await inv(p);
  ok(!e.s[15] && e.s.slice(0, 9).some((x) => x && x[0] === 1 && x[1] === 15), 'celular: com "Mover rápido" ligado, tocar leva para a barra');
  await p.tap('#inv-rapido');
  // livro de receitas e o resultado
  await p.tap('#abas-inv [data-aba=criar]'); await p.tap('[data-receita=tabuas]'); await p.waitForTimeout(200);
  await p.tap('#inv-saida'); await p.waitForTimeout(200);
  e = await inv(p);
  ok(e.itens[8] === 4 && e.itens[6] === 1, 'celular: livro de receitas + tocar no resultado cria tábuas');
  await p.screenshot({ path: SAIDA + '/inv-celular.png' });
  await ctx.close();
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'TUDO OK');
process.exit(falhas ? 1 : 0);

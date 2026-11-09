// Teste REAL das formas redondas: abre o jogo no Chromium (WebGL), escolhe as formas pela aba
// "Formas" do inventário, coloca com o clique do mouse, anda com o teclado em cima da rampa,
// da escada e do meio bloco, bate na cerca, fica em cima da bola, quebra com o mouse e tira prints.
// Uso: (cd public && python3 -m http.server 8765) e depois: node testes/teste-formas.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const URL = process.env.URL || 'http://localhost:8765';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const falhas = [];
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) falhas.push(msg); };

async function abrir(ctxOpts, criativo = true) {
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || /WebGL|GL_INVALID/.test(m.text())) erros.push(m.text()); });
  await p.goto(URL + '/#teste');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(800);
  await p.click('#bt-sozinho');
  await p.waitForTimeout(500);
  if (await p.isVisible('#m-novo')) {
    // mundo criativo (blocos à vontade) ou "Coletar e criar" (padrão)
    if (criativo && await p.getAttribute('[data-opcao=sobrevivencia]', 'aria-pressed') === 'true') await p.click('[data-opcao=sobrevivencia]');
    await p.click('#m-novo button[type=submit]');
  }
  await p.waitForTimeout(3500);
  return { ctx, p, erros };
}

// ---------------- computador ----------------
const { p, erros } = await abrir({ viewport: { width: 1280, height: 760 } });
// prepara um chão de pedra plano e vazio perto do jogador
const base = await p.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  window.__jogo.dia = 0.3;
  const X = Math.floor(jog.pos.x), Z = Math.floor(jog.pos.z), Y = 70;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -12; dz <= 8; dz++) {
    mundo.definir(X + dx, Y, Z + dz, 3);
    for (let dy = 1; dy < 10; dy++) mundo.definir(X + dx, Y + dy, Z + dz, 0);
  }
  jog.voando = false; jog.pos.x = X + 0.5; jog.pos.z = Z + 0.5; jog.pos.y = Y + 1; jog.vel.x = jog.vel.y = jog.vel.z = 0;
  jog.yaw = 0; jog.pitch = -0.6;
  return { X, Y, Z };
});
await p.waitForTimeout(800);
const { X, Y, Z } = base;

// 1) inventário de verdade: abre, aba Formas, escolhe cada forma e coloca com o botão direito
await p.keyboard.press('KeyE').catch(() => {});
await p.waitForTimeout(300);
if (!(await p.isVisible('#inventario'))) await p.click('.slot.mais');
await p.waitForTimeout(300);
await p.click('[data-aba="formas"]');
await p.waitForTimeout(300);
const titulo = await p.textContent('#inv-titulo');
const nIcones = await p.$$eval('#grade button', (bs) => bs.length);
ok(titulo === 'Formas' && nIcones === 14, `aba Formas abre com 14 formas (${titulo}, ${nIcones})`);
await p.screenshot({ path: SAIDA + '/formas-inventario.png' });

const vp = p.viewportSize();
// coloca: escolhe no inventário e clica com o botão direito no chão à frente
async function colocarComMouse(indice, alvo, yaw = 0) {
  await p.evaluate(({ alvo, yaw }) => {
    const { jog } = window.__jogo;
    // posiciona a câmera olhando para o chão onde vai a peça
    jog.voando = true; jog.vel.x = jog.vel.y = jog.vel.z = 0;
    jog.pos.x = alvo.x + 0.5 - Math.sin(yaw) * -2.2; jog.pos.z = alvo.z + 0.5 - Math.cos(yaw) * -2.2;
    jog.pos.y = alvo.y + 1.2; jog.yaw = yaw;
    const dx = alvo.x + 0.5 - jog.pos.x, dz = alvo.z + 0.5 - jog.pos.z;
    const olhos = jog.pos.y + 1.55, h = Math.hypot(dx, dz);
    jog.pitch = Math.atan2((alvo.y + 0.02) - olhos, h);
  }, { alvo, yaw });
  await p.waitForTimeout(150);
  if (!(await p.isVisible('#inventario'))) { await p.click('.slot.mais'); await p.waitForTimeout(200); await p.click('[data-aba="formas"]'); await p.waitForTimeout(200); }
  await p.click(`#grade button:nth-child(${indice + 1})`);
  await p.waitForTimeout(150);
  // o jogo usa o centro da tela para mirar com o mouse travado; aqui usamos usar() pelo centro
  await p.evaluate(() => window.__jogo.usar(null));
  await p.waitForTimeout(120);
}
// layout: fila de formas em z = Z-4, x = X-6..X+6 (2 em 2)
const nomes = ['tronco', 'pinheiro', 'betula', 'coluna', 'cerca', 'vidro', 'cano', 'bola', 'cupula', 'cupulaVidro', 'laje', 'rampa', 'escada', 'roda'];
const pos = {};
for (let i = 0; i < nomes.length; i++) {
  const x = X - 7 + i, z = Z - 6;
  pos[nomes[i]] = { x, y: Y + 1, z };
  await colocarComMouse(i, { x, y: Y, z }, 0);
}
// a mira cai na célula certa ou na vizinha (a câmera balança um pouquinho): procura na fileira
const colocados = await p.evaluate((pos) => Object.fromEntries(Object.entries(pos).map(([k, v]) => {
  for (let dz = -1; dz <= 2; dz++) { const b = window.__jogo.mundo.bloco(v.x, v.y, v.z + dz); if (b) { v.z += dz; return [k, b]; } }
  return [k, 0];
})), pos);
Object.assign(pos, await p.evaluate((pos) => { for (const v of Object.values(pos)) for (let dz = -1; dz <= 2; dz++) if (window.__jogo.mundo.bloco(v.x, v.y, v.z + dz)) { v.z += dz; break; } return pos; }, pos));
console.log('colocados:', JSON.stringify(colocados));
ok(Object.values(colocados).every((v) => v >= 80 && v <= 99), 'as 14 formas foram colocadas pelo inventário');
ok(colocados.rampa >= 91 && colocados.rampa <= 94 && colocados.escada >= 95 && colocados.escada <= 98, 'rampa e escada viraram para onde o jogador olha');

// vista geral para o print
async function vista(x, y, z, yaw, pitch, nome, dia = 0.3) {
  await p.evaluate(({ x, y, z, yaw, pitch, dia }) => { const { jog } = window.__jogo; window.__jogo.dia = dia; jog.voando = true; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.pos.x = x; jog.pos.y = y; jog.pos.z = z; jog.yaw = yaw; jog.pitch = pitch; }, { x, y, z, yaw, pitch, dia });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: SAIDA + '/' + nome + '.png' });
}
await vista(X + 0.5, Y + 2.2, Z + 0.5, 0, -0.32, 'formas-todas');

// 2) rampa: anda com a tecla W e tem que subir sem pular
const subida = await p.evaluate(async ({ X, Y, Z }) => {
  const { mundo, jog } = window.__jogo;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  // rampa subindo para -z (o jogador olha para -z com yaw 0), em cima um bloco de pedra
  const rx = X + 4, rz = Z + 2;
  mundo.definir(rx, Y + 1, rz, 94); // 91 + 3 = subindo para -z
  mundo.definir(rx, Y + 1, rz - 1, 3);
  jog.voando = false; jog.pos.x = rx + 0.5; jog.pos.z = rz + 2.5; jog.pos.y = Y + 1; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.yaw = 0;
  await espera(400);
  return { rx, rz };
}, { X, Y, Z });
await p.keyboard.down('KeyW');
let alturas = [];
for (let i = 0; i < 40; i++) { await p.waitForTimeout(100); alturas.push(await p.evaluate(() => window.__jogo.jog.pos.y)); }
await p.keyboard.up('KeyW');
const pulou = alturas.some((h, i) => i && h - alturas[i - 1] > 0.5);
console.log('alturas na rampa:', alturas.map((h) => (h - Y).toFixed(2)).join(' '));
ok(Math.max(...alturas) - Y >= 1.95, 'subiu a rampa andando até o bloco de cima');
ok(alturas.some((h) => h - Y > 1.2 && h - Y < 1.85), 'passou por alturas do meio (foi subindo, não pulou um bloco)');
ok(!pulou, 'sem pulos bruscos');

// 3) escada e meio bloco: sobe andando
const esc = await p.evaluate(async ({ X, Y, Z }) => {
  const { mundo, jog } = window.__jogo;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const ex = X - 4, ez = Z + 2;
  mundo.definir(ex, Y + 1, ez, 90); // meio bloco
  mundo.definir(ex, Y + 1, ez - 1, 98); // escada subindo para -z
  mundo.definir(ex, Y + 1, ez - 2, 3); mundo.definir(ex, Y + 2, ez - 2, 90);
  jog.voando = false; jog.pos.x = ex + 0.5; jog.pos.z = ez + 2.5; jog.pos.y = Y + 1; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.yaw = 0;
  await espera(400);
  return { ex, ez };
}, { X, Y, Z });
await p.keyboard.down('KeyW');
alturas = [];
for (let i = 0; i < 40; i++) { await p.waitForTimeout(100); alturas.push(await p.evaluate(() => window.__jogo.jog.pos.y)); }
await p.keyboard.up('KeyW');
console.log('alturas na escada:', alturas.map((h) => (h - Y).toFixed(2)).join(' '));
ok(alturas.some((h) => Math.abs(h - Y - 1.5) < 0.02), 'pisou em cima do meio bloco (altura 1,5)');
ok(Math.max(...alturas) - Y >= 2.45, 'subiu a escada até o meio bloco lá em cima (altura 2,5)');

// 4) cerca: não passa e não pula por cima
const cerca = await p.evaluate(async ({ X, Y, Z }) => {
  const { mundo, jog } = window.__jogo;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const cz = Z + 4;
  for (let dx = -3; dx <= 3; dx++) mundo.definir(X + dx, Y + 1, cz, 84);
  jog.voando = false; jog.pos.x = X + 0.5; jog.pos.z = cz + 2.5; jog.pos.y = Y + 1; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.yaw = Math.PI; // olhando para +z? yaw PI = frente +z
  await espera(300);
  jog.yaw = 0;
  return { cz };
}, { X, Y, Z });
await p.keyboard.down('KeyW');
for (let i = 0; i < 12; i++) { await p.keyboard.press('Space'); await p.waitForTimeout(90); }
await p.keyboard.up('KeyW');
const zDepois = await p.evaluate(() => window.__jogo.jog.pos.z);
ok(zDepois > cerca.cz + 0.9, `a cerca segurou o jogador, mesmo pulando (z=${(zDepois - cerca.cz).toFixed(2)} da cerca)`);

// 5) em cima da bola (fica na altura certa da esfera)
const bola = await p.evaluate(async ({ X, Y, Z }) => {
  const { mundo, jog } = window.__jogo;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  mundo.definir(X + 6, Y + 1, Z + 6, 87);
  jog.voando = false; jog.pos.x = X + 6.5; jog.pos.z = Z + 6.5; jog.pos.y = Y + 4; jog.vel.x = jog.vel.y = jog.vel.z = 0;
  await espera(1200);
  const topo = jog.pos.y - Y;
  // ao lado do topo (perto da beirada) fica mais baixo
  jog.pos.x = X + 6.95; jog.pos.z = Z + 6.95; jog.pos.y = Y + 4; jog.vel.y = 0;
  await espera(1200);
  return { topo, beira: jog.pos.y - Y, noChao: jog.noChao };
}, { X, Y, Z });
console.log('bola:', JSON.stringify(bola));
ok(Math.abs(bola.topo - 2) < 0.02, 'em pé no topo da bola (altura 2)');

// 6) mira: o raio atravessa o vão da cerca/vidro fino e quebra com o mouse
const mira = await p.evaluate(async ({ X, Y, Z }) => {
  const { mundo, jog, camera } = window.__jogo;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  // poste de cerca sozinho: mirando de lado (fora do poste) acerta o bloco de trás
  const px = X - 6, pz = Z + 6;
  mundo.definir(px, Y + 1, pz, 84);
  mundo.definir(px, Y + 1, pz - 1, 10);
  const o = { x: px + 0.85, y: Y + 1.5, z: pz + 2 }, d = { x: 0, y: 0, z: -1 };
  const h1 = mundo.raycast(o, d, 6);
  const o2 = { x: px + 0.5, y: Y + 1.5, z: pz + 2 };
  const h2 = mundo.raycast(o2, d, 6);
  return { passouDoLado: h1 && h1.b, acertouPoste: h2 && h2.b, t: h2 && h2.t };
}, { X, Y, Z });
ok(mira.passouDoLado === 10 && mira.acertouPoste === 84, `mira acerta o poste só onde ele está (${JSON.stringify(mira)})`);

// quebrar a bola da fileira mirando com a câmera de verdade (posição real da câmera)
await p.evaluate(({ v }) => {
  const { jog } = window.__jogo;
  jog.voando = true; jog.vel.x = jog.vel.y = jog.vel.z = 0;
  jog.pos.x = v.x + 0.5; jog.pos.z = v.z + 3; jog.pos.y = v.y - 0.5; jog.yaw = 0;
}, { v: pos.bola });
for (let k = 0; k < 3; k++) {
  await p.waitForTimeout(250);
  await p.evaluate(({ v }) => {
    const { jog, camera } = window.__jogo; const c = camera.position;
    jog.pitch = Math.atan2(v.y + 0.5 - c.y, Math.hypot(v.x + 0.5 - c.x, v.z + 0.5 - c.z));
  }, { v: pos.bola });
}
await p.waitForTimeout(250);
const alvoBola = await p.evaluate(() => { const { mundo, camera } = window.__jogo; const d = camera.getWorldDirection(camera.position.clone()); const h = mundo.raycast(camera.position, d, 6); return h && [h.x, h.y, h.z, h.b]; });
console.log('mirando:', JSON.stringify(alvoBola), 'bola em', JSON.stringify(pos.bola));
let toques = 0;
for (; toques < 8; toques++) {
  if (!(await p.evaluate((v) => window.__jogo.mundo.bloco(v.x, v.y, v.z), pos.bola))) break;
  await p.evaluate(() => window.__jogo.quebrar(null));
  await p.waitForTimeout(200);
  if (toques === 1) await p.screenshot({ path: SAIDA + '/formas-quebrando.png' });
}
console.log('toques para quebrar a bola:', toques);
const bolaSumiu = await p.evaluate((v) => window.__jogo.mundo.bloco(v.x, v.y, v.z), pos.bola);
ok(bolaSumiu === 0 && toques >= 2, `bola quebrou depois de ${toques} toques (fica redonda enquanto racha)`);

// 7) árvores do mundo com tronco redondo
const arvores = await p.evaluate(() => {
  const { mundo } = window.__jogo;
  let r = 0, q = 0;
  for (const c of mundo.chunks.values()) for (const b of c.dados) { if (b === 80 || b === 81 || b === 82) r++; else if (b === 6) q++; }
  return { redondos: r, quadrados: q };
});
console.log('troncos no mundo carregado:', JSON.stringify(arvores));
ok(arvores.redondos > 0, 'árvores do mundo usam tronco redondo');

// prints bonitos
await vista(X - 0.5, Y + 2.6, Z + 1.5, 0.35, -0.38, 'formas-perto');
await vista(X + 0.5, Y + 2.4, Z + 0.5, 0, -0.3, 'formas-tarde', 0.47);
// árvore com tronco redondo
await p.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  for (const c of mundo.chunks.values()) {
    for (let i = 0; i < c.dados.length; i++) if (c.dados[i] === 80 && c.dados[i - 256] !== 80) {
      const x = i % 16, z = Math.floor(i / 16) % 16, y = Math.floor(i / 256);
      jog.voando = true; jog.pos.x = c.cx * 16 + x + 0.5; jog.pos.z = c.cz * 16 + z + 5; jog.pos.y = y + 0.6; jog.yaw = 0; jog.pitch = 0.15;
      return;
    }
  }
});
await p.waitForTimeout(1500);
await p.screenshot({ path: SAIDA + '/formas-arvore.png' });

// desempenho: quadros por segundo com as formas na tela
const fps = await p.evaluate(async () => { let n = 0; const t0 = performance.now(); await new Promise((r) => { const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); }); return n / 2; });
console.log('fps (swiftshader, sem placa de vídeo):', fps.toFixed(1));
ok(erros.length === 0, 'sem erros no console (computador)' + (erros.length ? ': ' + erros.slice(0, 5).join(' | ') : ''));

// ---------------- tablet (toque) ----------------
const t = await abrir({ ...devices['Galaxy Tab S4 landscape'] });
const tb = await t.p.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  window.__jogo.dia = 0.3;
  const X = Math.floor(jog.pos.x), Z = Math.floor(jog.pos.z), Y = 70;
  for (let dx = -4; dx <= 4; dx++) for (let dz = -6; dz <= 3; dz++) { mundo.definir(X + dx, Y, Z + dz, 3); for (let dy = 1; dy < 8; dy++) mundo.definir(X + dx, Y + dy, Z + dz, 0); }
  jog.voando = true; jog.pos.x = X + 0.5; jog.pos.z = Z + 0.5; jog.pos.y = Y + 1.2; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.yaw = 0;
  jog.pitch = Math.atan2(Y + 0.02 - (Y + 1.2 + 1.55), 2.2);
  return { X, Y, Z };
});
await t.p.waitForTimeout(500);
await t.p.tap('.slot.mais');
await t.p.waitForTimeout(300);
await t.p.tap('[data-aba="formas"]');
await t.p.waitForTimeout(300);
await t.p.tap('#grade button:nth-child(8)'); // bola
await t.p.waitForTimeout(300);
const tvp = t.p.viewportSize();
await t.p.touchscreen.tap(tvp.width * 0.5, tvp.height * 0.5);
await t.p.waitForTimeout(500);
let blocoT = await t.p.evaluate(({ X, Y, Z }) => { const m = window.__jogo.mundo; for (let dz = -6; dz <= 3; dz++) for (let dx = -4; dx <= 4; dx++) { const b = m.bloco(X + dx, Y + 1, Z + dz); if (b) return b; } return 0; }, tb);
ok(blocoT === 87, 'no tablet: tocou na tela e colocou a bola escolhida na aba Formas (' + blocoT + ')');
await t.p.screenshot({ path: SAIDA + '/formas-tablet.png' });
ok(t.erros.length === 0, 'sem erros no console (tablet)' + (t.erros.length ? ': ' + t.erros.slice(0, 5).join(' | ') : ''));

// ---------------- Coletar e criar (o modo padrão) ----------------
const s = await abrir({ viewport: { width: 1280, height: 760 } }, false);
const sp = s.p;
const qtd = (id) => sp.evaluate((id) => window.__jogo.mercado.e.itens[id] || 0, id);
ok(await sp.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo no modo Coletar e criar');
// quebra um tronco redondo de árvore com a mão: cai um Tronco comum na mochila
const arv = await sp.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  let melhor = null;
  for (const c of mundo.chunks.values()) for (let i = 0; i < c.dados.length; i++) if (c.dados[i] >= 80 && c.dados[i] <= 82) {
    const x = c.cx * 16 + (i % 16), z = c.cz * 16 + (Math.floor(i / 16) % 16), y = Math.floor(i / 256);
    const tb = c.dados[i];
    if (mundo.bloco(x, y - 1, z) === tb) continue; // a base do tronco
    const d = (x - jog.pos.x) ** 2 + (z - jog.pos.z) ** 2;
    if (!melhor || d < melhor.d) melhor = { x, y, z, d, tb };
  }
  if (!melhor) return null;
  const { x, y, z, tb } = melhor;
  for (let dz = 1; dz <= 3; dz++) for (let dy = 0; dy <= 2; dy++) mundo.definir(x, y + dy, z + dz, 0);
  jog.voando = true; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.pos.x = x + 0.5; jog.pos.z = z + 2.6; jog.pos.y = y - 1.05; jog.yaw = 0; jog.pitch = 0;
  return { x, y, z, tb };
});
ok(!!arv, 'achou uma árvore de tronco redondo');
if (arv) {
  await sp.waitForTimeout(400);
  let n = 0;
  for (; n < 10 && await sp.evaluate((a) => window.__jogo.mundo.bloco(a.x, a.y, a.z), arv) === arv.tb; n++) { await sp.evaluate(() => window.__jogo.quebrar(null)); await sp.waitForTimeout(150); }
  ok(n === 5, `tronco redondo aguenta 5 toques com a mão (${n})`);
  const comum = { 80: 6, 81: 71, 82: 73 }[arv.tb];
  ok(await qtd(comum) === 1, `quebrar o tronco redondo (${arv.tb}) dá 1 tronco comum (${comum}) na mochila`);
}
// livro de receitas: grupo Formas redondas
await sp.evaluate(() => { const m = window.__jogo.mercado; m.e.itens[6] = (m.e.itens[6] || 0) + 1; m.e.itens[20] = 3; m.recebeu(m.e); });
await sp.evaluate(() => window.__jogo.abrirInventario('criar'));
await sp.waitForSelector('#inventario:not([hidden]) [data-receita=rampa]');
await sp.locator('[data-receita=rampa]').scrollIntoViewIfNeeded();
await sp.screenshot({ path: SAIDA + '/formas-receitas.png' });
await sp.click('[data-receita=tronco-redondo]');
await sp.click('[data-receita=rampa]');
ok(await qtd(80) === 1 && await qtd(91) === 2 && await qtd(20) === 0, 'criou tronco redondo (1 tronco) e 2 rampas (3 pedriscos)');
ok(await sp.getAttribute('[data-receita=bola]', 'class') === 'receita falta', 'bola precisa de bancada e pedra (fica apagada)');
await sp.click('#inventario [data-fechar]');
// coloca a rampa (gasta 1) e quebra de volta (volta 1 para a mochila)
const rp = await sp.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  const X = Math.floor(jog.pos.x), Z = Math.floor(jog.pos.z), Y = 70;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -4; dz <= 2; dz++) { mundo.definir(X + dx, Y, Z + dz, 3); for (let dy = 1; dy < 5; dy++) mundo.definir(X + dx, Y + dy, Z + dz, 0); }
  jog.voando = true; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.pos.x = X + 0.5; jog.pos.z = Z + 0.5; jog.pos.y = Y + 1.2; jog.yaw = 0;
  return { X, Y, Z };
});
await sp.waitForTimeout(300);
await sp.evaluate(() => { const j = window.__jogo; const c = j.camera.position; j.jog.pitch = Math.atan2(70.02 - c.y, 2.2); j.slot = j.barra.indexOf(91); });
await sp.waitForTimeout(300);
ok(await sp.evaluate(() => window.__jogo.barra.includes(91)), 'rampa criada apareceu na barra');
console.log('mira rampa:', await sp.evaluate(() => { const { mundo, camera, barra } = window.__jogo; const d = camera.getWorldDirection(camera.position.clone()); const h = mundo.raycast(camera.position, d, 6); return JSON.stringify([h, camera.position, barra]); }));
await sp.evaluate(() => window.__jogo.usar(null));
await sp.waitForTimeout(200);
const onde = await sp.evaluate(({ X, Y, Z }) => { const m = window.__jogo.mundo; for (let dz = -4; dz <= 2; dz++) { const b = m.bloco(X, Y + 1, Z + dz); if (b) return { b, z: Z + dz }; } return null; }, rp);
ok(onde && onde.b >= 91 && onde.b <= 94 && await qtd(91) === 1, 'colocou a rampa e gastou 1 da mochila (' + JSON.stringify(onde) + ')');
if (onde) {
  for (let k = 0; k < 6 && await sp.evaluate(({ X, Y, z }) => window.__jogo.mundo.bloco(X, Y + 1, z), { ...rp, z: onde.z }); k++) { await sp.evaluate(() => window.__jogo.quebrar(null)); await sp.waitForTimeout(150); }
  ok(await qtd(91) === 2, 'quebrou a rampa virada e voltou "Rampa" para a mochila');
}
ok(s.erros.length === 0, 'sem erros no console (Coletar e criar)' + (s.erros.length ? ': ' + s.erros.slice(0, 5).join(' | ') : ''));

await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);

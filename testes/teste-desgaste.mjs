// Desgaste das ferramentas (como no clássico), jogando pela tela do tablet:
// a picareta de madeira aguenta 59 blocos, a de pedra 131, o isqueiro 64 fogos; cada bloco quebrado com ela
// gasta 1 (flor não gasta); no fim ela quebra, some da mochila e avisa. Largar no chão e pegar de volta não conserta.
// Online: tudo a partir do zero (tronco -> tábuas -> bancada -> picareta), a sala conta o desgaste e ele vai junto
// com a picareta largada: o amigo que pega recebe a picareta gasta.
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-desgaste.mjs
//   ONLINE=http://localhost:8788 (com a sala e o pages dev rodando) testa também 2 jogadores
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const PEDRA = 3, PIC = 1001, ISQ = 1010;

const mirar = (q, [x, y, z]) => q.evaluate(([x, y, z]) => { const J = window.__jogo, j = J.jog, c = J.camera, dx = x - c.position.x, dz = z - c.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y - c.position.y, Math.hypot(dx, dz)); }, [x, y, z]);
const bl = (q, x, y, z) => q.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x, y, z]);
// bate com a mão (toque segurado = vários golpes) até o bloco sair
async function quebrarBloco(q, x, y, z, max = 40) {
  const b0 = await bl(q, x, y, z);
  for (let k = 0; k < max && (await bl(q, x, y, z)) === b0; k++) { await mirar(q, [x + 0.5, y + 0.5, z + 0.5]); await q.evaluate(() => window.__jogo.quebrar(null)); await q.waitForTimeout(260); }
  return (await bl(q, x, y, z)) !== b0;
}
const desg = (q, id) => q.evaluate((id) => { const e = window.__jogo.mercado.e; return [e.itens[id] || 0, JSON.stringify((e.desg || {})[id] || [])]; }, id);
async function naMao(q, id) { await q.evaluate((id) => { const J = window.__jogo; let i = J.barra.indexOf(id); if (i < 0) { i = 0; J.barra[0] = id; } J.slot = i; }, id); await q.waitForTimeout(200); }

const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await p.waitForTimeout(4000);
const base = await p.evaluate(([PEDRA]) => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.max(m.chao(x0, z0) + 1, 40);
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) { m.definir(x0 + x, y0 - 1, z0 + z, PEDRA); for (let y = 0; y < 30; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0;
  J.dia = 0.3; J.bichos.limpar(); J.bichos.tempoSpawn = 1e9;
  const me = J.mercado; me.e.itens[1001] = 1; me.e.desg = { 1001: [56] }; me.recebeu(me.e);
  return [x0, y0, z0];
}, [PEDRA]);
const [x0, y0, z0] = base;
await naMao(p, PIC);
ok((await desg(p, PIC)).join() === '1,[56]', 'picareta de madeira já gasta: 56 de 59');
// um bloco por vez, bem na frente (senão a mira pega outro no caminho)
const poe = (b) => p.evaluate(([x, y, z, b]) => window.__jogo.mundo.definir(x, y, z, b), [x0, y0, z0 - 2, b]);
await poe(PEDRA);
ok(await quebrarBloco(p, x0, y0, z0 - 2), 'quebrou a pedra com a picareta');
ok((await desg(p, PIC))[1] === '[57]', `cada bloco gasta 1 (${(await desg(p, PIC))[1]})`);
await poe(11);
ok(await quebrarBloco(p, x0, y0, z0 - 2) && (await desg(p, PIC))[1] === '[57]', 'quebrar flor não gasta');
await poe(PEDRA); await quebrarBloco(p, x0, y0, z0 - 2);
ok((await desg(p, PIC))[1] === '[58]', 'mais uma pedra: 58');
await poe(PEDRA); await quebrarBloco(p, x0, y0, z0 - 2);
const fim = await desg(p, PIC);
const avisou = await p.evaluate(() => document.body.innerText.includes('quebrou de tanto usar'));
await p.screenshot({ path: SAIDA + '/desgaste-1-quebrou.png' });
ok(fim[0] === 0 && avisou, `na 59ª a picareta quebra, some da mochila e avisa (${fim})`);
// com a mão vazia (sem picareta) a pedra demora mais e não gasta nada
// largar no chão e pegar de volta não conserta
await p.evaluate(() => { const me = window.__jogo.mercado; me.e.itens[1002] = 1; me.e.desg = { 1002: [30] }; me.recebeu(me.e); });
await naMao(p, 1002);
await p.evaluate(() => { const J = window.__jogo, j = J.jog; j.yaw = 0; j.pitch = -0.3; });
await p.tap('#bt-largar'); await p.waitForTimeout(400);
const largou = await desg(p, 1002);
ok(largou[0] === 0, 'largou a picareta de pedra no chão pelo botão');
const onde = await p.evaluate(() => { const l = [...window.__jogo.drops.vivos.values()].filter((e) => e.id === 1002); return l.length ? [l[0].x, l[0].z, JSON.stringify(l[0].dg)] : null; });
ok(onde && onde[2] === '[30]', 'no chão ela continua gasta ' + JSON.stringify(onde));
await p.waitForTimeout(1800);
if (onde) await p.evaluate(([x, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; }, onde);
await p.waitForTimeout(1500);
ok((await desg(p, 1002)).join() === '1,[30]', `pegou de volta e ela continua com 30 de 131 (${await desg(p, 1002)})`);
// isqueiro: 64 fogos
await p.evaluate(() => { const me = window.__jogo.mercado; me.e.itens[1010] = 1; me.e.desg = { ...me.e.desg, 1010: [62] }; me.recebeu(me.e); });
await naMao(p, ISQ);
const acende = async (x, z) => { const d0 = (await desg(p, ISQ)).join(); for (let k = 0; k < 4 && (await desg(p, ISQ)).join() === d0; k++) { await mirar(p, [x + 0.5, y0, z + 0.5]); await p.evaluate(() => window.__jogo.usar(null)); await p.waitForTimeout(300); } };
await p.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y; j.pos.z = z + 0.5; j.vel.x = j.vel.z = 0; }, base);
await acende(x0 + 2, z0 + 2);
const d1 = await desg(p, ISQ), f1 = await p.evaluate(() => window.__jogo.mundo.fogos.size);
ok(d1[1] === '[63]' && f1 > 0, `acender gasta 1 do isqueiro (${d1}, fogos acesos ${f1})`);
await acende(x0 - 2, z0 + 2);
ok((await desg(p, ISQ))[0] === 0 && await p.evaluate(() => document.body.innerText.includes('Isqueiro quebrou')), 'no 64º fogo o isqueiro acaba e avisa');
await ctx.close();

if (ONLINE) {
  async function jogador(nome) {
    const c = await b.newContext({ viewport: { width: 900, height: 560 } });
    const q = await c.newPage();
    q.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); q.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
    await q.goto(ONLINE + '/#teste'); await q.evaluate(() => localStorage.clear()); await q.reload();
    await q.click('#bt-criar-conta'); await q.fill('#c-nome', nome); await q.fill('#c-senha', 'senha123');
    if (await q.isVisible('#c-adulto-ok')) await q.check('#c-adulto-ok');
    if (await q.isVisible('#c-nasc .d-ano')) { await q.selectOption('#c-nasc .d-dia', '1'); await q.selectOption('#c-nasc .d-mes', '1'); await q.selectOption('#c-nasc .d-ano', '1990'); }
    await q.click('#c-ok');
    await q.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 20000 });
    if (await q.isVisible('#m-jogos')) await q.click('.jogo[data-jogo=pradaria]');
    await q.waitForSelector('#m-mundos:not([hidden])', { timeout: 20000 });
    return q;
  }
  const sfx = Date.now() % 10000;
  const a = await jogador('Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Mina');
  if (await a.getAttribute('[data-modo=sobrevivencia]', 'aria-pressed') !== 'true') await a.click('[data-modo=sobrevivencia]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  // a noite do jogo clássico tem monstros: no aparelho lento o teste chega na noite e a Ana desmaiava no meio
  await a.evaluate(() => { window.__jogo.vida.protegido = 1e9; window.__jogo.dia = 0.3; });
  await a.waitForTimeout(3000);
  // pega o que caiu: anda até cada item do chão
  async function juntar(q) {
    for (let k = 0; k < 6; k++) {
      const l = await q.evaluate(() => [...window.__jogo.drops.vivos.values()].map((e) => [e.x, e.y, e.z]));
      if (!l.length) break;
      for (const [x, y, z] of l) { await q.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.y = y; j.pos.z = z; j.vel.x = j.vel.z = 0; }, [x, y, z]); await q.waitForTimeout(700); }
    }
  }
  // 3 troncos de árvore de verdade, com a mão
  let troncos = [];
  for (let t = 0; t < 5 && troncos.length < 3; t++) { if (t) await a.waitForTimeout(3000); troncos = await a.evaluate(() => {
    const M = window.__jogo.mundo, j = window.__jogo.jog, px = Math.floor(j.pos.x), pz = Math.floor(j.pos.z), r = [];
    for (let d = 1; d <= 70 && r.length < 3; d++) for (let dx = -d; dx <= d && r.length < 3; dx++) for (const dz of [-d, d]) {
      const x = px + dx, z = pz + dz;
      for (let y = M.chao(x, z) + 6; y > M.chao(x, z) - 2; y--) if ([6, 71, 73].includes(M.bloco(x, y, z)) && !r.some((t) => t[0] === x && t[2] === z)) { r.push([x, y, z]); break; }
    }
    return r;
  }); }
  ok(troncos.length === 3, 'online: achou 3 árvores perto ' + JSON.stringify(troncos));
  for (const [x, y, z] of troncos) {
    await a.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = x + 0.5; j.pos.y = y - 1; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; }, [x, y, z]);
    await a.waitForTimeout(500);
    await quebrarBloco(a, x, y, z, 60);
    await a.waitForTimeout(600);
    await juntar(a);
  }
  const tr = await a.evaluate(() => { const e = window.__jogo.mercado.e.itens; return (e[6] || 0) + (e[71] || 0) + (e[73] || 0); });
  ok(tr >= 3, `online: juntou ${tr} troncos`);
  // criar: tábuas, gravetos, bancada (pela tela de criar)
  // livro de receitas: toca na receita (vai para a grade), toca no resultado
  async function criar(q, id, vezes = 1) {
    for (let i = 0; i < vezes; i++) {
      if (!(await q.isVisible('#inventario:not([hidden]) [data-receita]'))) await q.evaluate(() => window.__jogo.abrirInventario('criar'));
      await q.click(`[data-receita="${id}"]`);
      if (await q.isVisible('#inv-saida.pronta')) await q.click('#inv-saida');
      await q.waitForTimeout(400);
      if (await q.isVisible('#inv-livro:visible, #abas-inv [data-aba=criar]:visible')) await q.click('#inv-livro:visible, #abas-inv [data-aba=criar]:visible');
    }
    if (await q.isVisible('#inventario [data-fechar]')) await q.click('#inventario [data-fechar]');
  }
  const idTabua = await a.evaluate(async () => { const R = await import('/js/receitas.js'); const e = window.__jogo.mercado.e.itens; return R.RECEITAS.filter((r) => r.faz[0] === 8 && r.usa.every(([i]) => (e[i] || 0) > 0)).map((r) => r.id); });
  for (const id of idTabua) await criar(a, id, 3);
  await criar(a, 'graveto'); await criar(a, 'bancada');
  const it1 = await a.evaluate(() => { const e = window.__jogo.mercado.e.itens; return [e[8] || 0, e[1000] || 0, e[34] || 0]; });
  ok(it1[1] >= 2 && it1[2] === 1 && it1[0] >= 3, `online: criou tábuas, gravetos e bancada (tábuas, gravetos, bancada: ${it1})`);
  // chão firme e plano (3x3) para pôr a bancada e minerar do lado
  const P = await a.evaluate(() => {
    const M = window.__jogo.mundo, j = window.__jogo.jog, px = Math.floor(j.pos.x), pz = Math.floor(j.pos.z);
    for (let d = 0; d <= 50; d++) for (let dx = -d; dx <= d; dx++) for (const dz of [-d, d]) {
      const x = px + dx, z = pz + dz, y = M.chao(x, z);
      let bom = true;
      for (let a = -2; a <= 2 && bom; a++) for (let c = -2; c <= 2 && bom; c++) bom = M.chao(x + a, z + c) === y && [1, 2, 3, 4].includes(M.bloco(x + a, y, z + c)) && M.bloco(x + a, y + 1, z + c) === 0 && M.bloco(x + a, y + 2, z + c) === 0;
      if (bom) return [x, y, z];
    }
    return null;
  });
  ok(!!P, 'online: achou chão plano ' + JSON.stringify(P));
  await a.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.voando = false; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; }, P);
  await a.waitForTimeout(1200);
  // a câmera já chegou no jogador (no aparelho lento ela ainda vinha da árvore e a mira saía torta)
  await a.waitForFunction(() => { const J = window.__jogo, c = J.camera.position, j = J.jog.pos; return Math.hypot(c.x - j.x, c.z - j.z) < 0.3 && Math.abs(c.y - j.y - 1.55) < 0.3; }, null, { timeout: 8000 }).catch(() => {});
  await naMao(a, 34);
  // janela do inventário fechada, e a câmera precisa de um quadro para virar para onde a mira mandou: sem esperar,
  // o usar saía com a mira de antes e a única bancada ia parar no bloco da frente
  if (await a.isVisible('#inventario [data-fechar]')) await a.click('#inventario [data-fechar]');
  for (let k = 0; k < 4 && (await bl(a, P[0], P[1] + 1, P[2] - 2)) !== 34; k++) {
    await mirar(a, [P[0] + 0.5, P[1] + 1, P[2] - 1.5]);
    await a.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await a.evaluate(() => window.__jogo.usar(null)); await a.waitForTimeout(800);
  }
  ok((await bl(a, P[0], P[1] + 1, P[2] - 2)) === 34, 'online: pôs a bancada no chão ' + (await bl(a, P[0], P[1] + 1, P[2] - 2) === 34 ? '' : await a.evaluate(() => JSON.stringify({ morto: !document.querySelector('#morte').hidden, dia: window.__jogo.dia, vida: window.__jogo.vida.atual, qtd: window.__jogo.mercado.qtd(34), mao: window.__jogo.barra, pos: window.__jogo.jog.pos, telas: [...document.querySelectorAll('.janela:not([hidden])')].map((e) => e.id), cam: window.__jogo.camera.position, cq: !!window.__jogo.cq, b34: (() => { const M = window.__jogo.mundo, j = window.__jogo.jog, r = []; for (let x = -4; x <= 4; x++) for (let y = -3; y <= 3; y++) for (let z = -5; z <= 4; z++) { const X = Math.floor(j.pos.x) + x, Y = Math.floor(j.pos.y) + y, Z = Math.floor(j.pos.z) + z; if (M.bloco(X, Y, Z) === 34) r.push([X, Y, Z]); } return r; })() }))));
  await criar(a, 'picareta-madeira');
  ok((await desg(a, PIC))[0] === 1, 'online: criou a picareta de madeira na bancada');
  // quebra 2 blocos do chão do lado com ela
  await naMao(a, PIC);
  for (const dx of [2, -2]) { await quebrarBloco(a, P[0] + dx, P[1], P[2], 30); await a.waitForTimeout(800); }
  await a.waitForTimeout(1500);
  const dA = await desg(a, PIC);
  ok(dA[1] === '[2]', `online: dois blocos gastaram 2 da picareta (${dA})`);
  // Beto entra, Ana larga a picareta e ele pega: vem gasta (a sala guardou o desgaste junto)
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await bb.waitForTimeout(2000);
  await a.evaluate(() => { const j = window.__jogo.jog; j.pitch = -0.2; });
  await naMao(a, PIC); await a.evaluate(() => window.__jogo.largarDaMao(false));
  await a.waitForTimeout(1500);
  const noChao = await bb.evaluate(() => { const l = [...window.__jogo.drops.vivos.values()].filter((e) => e.id === 1001); return l.length ? [l[0].x, l[0].y, l[0].z] : null; });
  ok(!!noChao && (await desg(a, PIC))[0] === 0, 'online: Ana largou a picareta e Beto vê no chão');
  // vai até onde a picareta está agora (no aparelho lento ela ainda pode estar caindo/escorregando quando ele chega)
  if (noChao) await bb.waitForTimeout(1600);
  for (let k = 0; noChao && k < 6 && (await desg(bb, PIC))[0] !== 1; k++) {
    await bb.evaluate(() => { const l = [...window.__jogo.drops.vivos.values()].filter((e) => e.id === 1001); if (!l.length) return; const j = window.__jogo.jog; j.voando = false; j.pos.x = l[0].x; j.pos.y = l[0].y; j.pos.z = l[0].z; });
    await bb.waitForTimeout(1200);
  }
  await bb.waitForTimeout(1000);
  const dB = await desg(bb, PIC);
  ok(dB.join() === '1,[2]', `online: Beto pegou e a picareta continua gasta (${dB})`);
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

// Tocha (como nos jogos de blocos clássicos), jogando pela tela do tablet:
// receita 1 graveto + 1 carvão = 4 tochas (sem bancada); numa caverna escura, pôr a tocha no chão com a mão
// clareia em volta; tocha não fica no ar (precisa de chão); quebrar devolve a tocha e escurece de novo.
// Online: o amigo vê a tocha que a gente pôs (a sala aceita).
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-tocha.mjs
//   ONLINE=http://localhost:8788 (com a sala e o pages dev rodando) testa também 2 jogadores
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const PEDRA = 3, TOCHA = 221, CARVAO = 66;

async function tocarEm(q, alvo, toque = true) {
  await q.evaluate(([x, y, z]) => {
    const J = window.__jogo, j = J.jog, c = J.camera, dx = x - c.position.x, dz = z - c.position.z;
    j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y - c.position.y, Math.hypot(dx, dz));
  }, alvo);
  await q.waitForTimeout(250);
  if (toque) { const m = await q.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 })); await q.touchscreen.tap(m.x, m.y); }
  else await q.evaluate(() => window.__jogo.usar(null));
  await q.waitForTimeout(450);
}

const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await p.waitForTimeout(4000);
ok(await p.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo é de coletar e criar');
// criar pelo livro de receitas: 1 graveto + 1 carvão = 4 tochas
const GRAVETO = 1000;
await p.evaluate(([G, C]) => { const m = window.__jogo.mercado; m.e.itens[G] = 1; m.e.itens[C] = 1; m.recebeu(m.e); }, [GRAVETO, CARVAO]);
await p.evaluate(() => window.__jogo.abrirInventario('criar'));
await p.waitForSelector('#inventario:not([hidden]) [data-receita=tocha]');
await p.click('[data-receita=tocha]');
const it = await p.evaluate(([G, C, T]) => { const e = window.__jogo.mercado.e.itens; return [e[G] || 0, e[C] || 0, e[T] || 0]; }, [GRAVETO, CARVAO, TOCHA]);
ok(it[0] === 0 && it[1] === 0 && it[2] === 4, `criou 4 tochas com 1 graveto e 1 carvão, sem bancada (graveto, carvão, tochas: ${it})`);
await p.screenshot({ path: SAIDA + '/tocha-0-receita.png' });
await p.click('#inventario [data-fechar]');
// caverna fechada 20 blocos embaixo da terra
const base = await p.evaluate(([PEDRA, TOCHA]) => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), topo = m.chao(x0, z0);
  const y0 = topo - 20;
  for (let x = -7; x <= 7; x++) for (let z = -6; z <= 6; z++) for (let y = y0 - 1; y <= topo; y++) {
    const dentro = y >= y0 && y <= y0 + 3 && Math.abs(z) <= 4 && x >= -5 && x <= 5;
    m.definir(x0 + x, y, z0 + z, dentro ? 0 : PEDRA);
  }
  j.voando = false; j.pos.x = x0 - 3.5; j.pos.y = y0; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0;
  J.dia = 0.3; J.barra[0] = TOCHA; J.slot = 0;
  return [x0, y0, z0];
}, [PEDRA, TOCHA]);
const [x0, y0, z0] = base;
const claro = (x, z) => p.evaluate(([x, y, z]) => {
  const M = window.__jogo.mundo, cx = Math.floor(x / 16), cz = Math.floor(z / 16), c = M.chunks.get(cx + ',' + cz);
  if (!c || !c.malha) return -1;
  const g = c.malha.geometry, P = g.attributes.position.array, C = g.attributes.color.array, lx = x - cx * 16, lz = z - cz * 16;
  let s = 0, n = 0;
  for (let i = 0; i < P.length; i += 3) {
    if (Math.abs(P[i + 1] - (y + 1)) > 0.3 || P[i] < lx - 0.01 || P[i] > lx + 1.01 || P[i + 2] < lz - 0.01 || P[i + 2] > lz + 1.01) continue;
    s += C[i]; n++;
  }
  return n ? +(s / n).toFixed(3) : -1;
}, [x, y0 - 1, z]);
await p.waitForTimeout(3000);
const escuro = await claro(x0 + 1, z0);
ok(escuro > 0 && escuro < 0.5, `caverna funda é escura (chão ${escuro})`);
// no alto da parede, sem chão embaixo: não fica
await tocarEm(p, [x0 + 0.5, y0 + 2.5, z0 - 5 + 1.001]);
const alto = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x0, y0 + 2, z0 - 4]);
ok(alto !== TOCHA, `tocha não fica no ar, presa no alto da parede sem chão (${alto})`);
// no chão, com a mão
for (let k = 0; k < 4; k++) {
  await tocarEm(p, [x0 + 0.5, y0, z0 + 0.5]);
  if (await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x0, y0, z0]) === TOCHA) break;
}
const pos = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x0, y0, z0]);
const sobra = await p.evaluate((T) => window.__jogo.mercado.e.itens[T] || 0, TOCHA);
ok(pos === TOCHA, `pôs a tocha no chão da caverna com a mão (sobram ${sobra})`);
await p.waitForTimeout(800);
const perto = await claro(x0 + 1, z0), longe = await claro(x0 + 5, z0 + 4);
ok(perto > escuro + 0.25 && perto > longe, `a tocha clareia em volta, mais perto mais claro (perto ${perto}, longe ${longe}, antes ${escuro})`);
await p.evaluate(([x0, y0, z0]) => { const J = window.__jogo, j = J.jog; j.yaw = -Math.PI / 2; j.pitch = -0.45; }, base);
await p.waitForTimeout(600);
await p.screenshot({ path: SAIDA + '/tocha-1-caverna.png' });
// andar através da tocha (não é sólida)
const solida = await p.evaluate(async () => (await import('/js/blocos.js')).BLOCOS[221].solido);
ok(solida === false, 'tocha não é sólida (passa por ela)');
// quebra com um toque e volta para a mochila; escurece de novo
const antes = sobra;
await p.evaluate(() => { window.__jogo.barra[0] = 0; });
for (let k = 0; k < 6; k++) {
  await p.evaluate(([x, y, z]) => { const J = window.__jogo, j = J.jog, c = J.camera, dx = x - c.position.x, dz = z - c.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y - c.position.y, Math.hypot(dx, dz)); }, [x0 + 0.5, y0 + 0.4, z0 + 0.5]);
  await p.waitForTimeout(200); await p.evaluate(() => window.__jogo.quebrar(null)); await p.waitForTimeout(300);
  if (await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x0, y0, z0]) !== TOCHA) break;
}
// anda até onde ela caiu para pegar
await p.evaluate(([x0, y0, z0]) => { const j = window.__jogo.jog; j.pos.x = x0 + 0.5; j.pos.z = z0 + 1.2; }, base);
await p.waitForTimeout(2500);
const depois = await p.evaluate((T) => window.__jogo.mercado.e.itens[T] || 0, TOCHA);
const volta = await claro(x0 + 1, z0);
ok(depois === antes + 1, `quebrar devolve a tocha (${antes} -> ${depois})`);
ok(volta < perto - 0.2, `sem a tocha escurece de novo (${perto} -> ${volta})`);
await ctx.close();

if (ONLINE) {
  async function jogador(nome) {
    const c = await b.newContext({ viewport: { width: 900, height: 560 } });
    const q = await c.newPage();
    q.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); q.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
    await q.goto(ONLINE + '/#teste'); await q.evaluate(() => localStorage.clear()); await q.reload();
    await q.click('#bt-criar-conta'); await q.fill('#c-nome', nome); await q.fill('#c-senha', 'senha123');
    if (await q.isVisible('#c-adulto-ok')) await q.check('#c-adulto-ok');
    await q.click('#c-ok');
    await q.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 20000 });
    if (await q.isVisible('#m-jogos')) await q.click('.jogo[data-jogo=pradaria]');
    await q.waitForSelector('#m-mundos:not([hidden])', { timeout: 20000 });
    return q;
  }
  const sfx = Date.now() % 10000;
  const a = await jogador('Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Tochas');
  if (await a.getAttribute('[data-modo=sobrevivencia]', 'aria-pressed') === 'true') await a.click('[data-modo=criativo]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await a.waitForTimeout(2500);
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await bb.waitForTimeout(1500);
  const alvo = await a.evaluate(() => {
    const M = window.__jogo.mundo, j = window.__jogo.jog, px = Math.floor(j.pos.x), pz = Math.floor(j.pos.z);
    for (let r = 2; r <= 30; r++) for (let dx = -r; dx <= r; dx++) for (const dz of [-r, r]) {
      const x = px + dx, z = pz + dz;
      for (let y = M.chao(x, z) + 2; y > M.chao(x, z) - 3; y--) {
        if ([1, 2, 3].includes(M.bloco(x, y, z)) && [1, 2].every((k) => [0, 1, 2, 3].every((d) => M.bloco(x, y + k, z + d) === 0))) return { x, y: y + 1, z }; // ar em cima e na frente (de onde a Ana mira)
      }
    }
    return null;
  });
  ok(!!alvo, 'online: achou chão firme ' + JSON.stringify(alvo));
  if (alvo) {
    await a.evaluate(({ x, y, z }) => { const J = window.__jogo, j = J.jog; j.voando = true; j.pos.x = x + 0.5; j.pos.y = y + 1.5; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; J.barra[0] = 221; J.slot = 0; }, alvo);
    await a.waitForTimeout(1500);
    for (let i = 0; i < 4; i++) {
      await tocarEm(a, [alvo.x + 0.5, alvo.y, alvo.z + 0.5], false);
      if (await a.evaluate(({ x, y, z }) => window.__jogo.mundo.bloco(x, y, z), alvo) === TOCHA) break;
    }
    await bb.evaluate(({ x, y, z }) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = x + 3.5; j.pos.y = y + 2; j.pos.z = z + 4.5; }, alvo);
    await a.waitForTimeout(2000);
    const vA = await a.evaluate(({ x, y, z }) => window.__jogo.mundo.bloco(x, y, z), alvo), vB = await bb.evaluate(({ x, y, z }) => window.__jogo.mundo.bloco(x, y, z), alvo);
    const dbg = await a.evaluate(({ x, y, z }) => ({ aviso: (document.querySelector('#aviso') || {}).innerText, abaixo: window.__jogo.mundo.bloco(x, y - 1, z), achou: (() => { const r = []; for (let a = -3; a <= 3; a++) for (let b = -2; b <= 3; b++) for (let c = -3; c <= 3; c++) if (window.__jogo.mundo.bloco(x + a, y + b, z + c) === 221) r.push([a, b, c]); return r; })(), it: window.__jogo.mercado.e.itens[221], pos: window.__jogo.jog.pos, barra: window.__jogo.barra[0] }), alvo);
    ok(vA === TOCHA && vB === TOCHA, `online: Ana pôs a tocha e Beto vê a mesma (${vA}, ${vB}) ` + (vA === TOCHA ? '' : JSON.stringify(dbg)));
    await bb.evaluate(({ x, y, z }) => { const J = window.__jogo, j = J.jog, c = J.camera, dx = x + 0.5 - c.position.x, dz = z + 0.5 - c.position.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y - c.position.y, Math.hypot(dx, dz)); }, alvo);
    await bb.waitForTimeout(500);
    await bb.screenshot({ path: SAIDA + '/tocha-online-beto.png' });
  }
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

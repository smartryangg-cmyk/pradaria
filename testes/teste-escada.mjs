// Escada de mão (como nos jogos de blocos clássicos), jogando pela tela do tablet:
// coloca presa na parede tocada (sem parede não fica); andando para a frente sobe; soltando, escorrega
// devagar e não machuca; agachado fica parado; quebrar devolve a escada. Receita: 7 gravetos = 3 escadas.
// Online: o amigo vê a escada que a gente pôs (a sala aceita).
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-escada.mjs
//   ONLINE=http://localhost:8788 (com a sala e o pages dev rodando) testa também 2 jogadores
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const ESC = 211, ehEsc = (q) => q >= 211 && q <= 214;

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

// ---------- tablet, sem internet (coletar e criar) ----------
const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await p.waitForTimeout(4000);
ok(await p.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo é de coletar e criar');
const rec = await p.evaluate(async () => {
  const R = await import('/js/receitas.js');
  const r = R.RECEITAS ? R.RECEITAS.find((q) => q.id === 'escada-mao') : null;
  return { r, cai: R.oQueCai(213, 0, 0, 0, false), gasto: R.gastoDe(214) };
});
ok(rec.r && rec.r.faz[0] === ESC && rec.r.faz[1] === 3 && rec.r.usa[0][1] === 7, 'receita: 7 gravetos = 3 escadas de mão ' + JSON.stringify(rec.r));
ok(rec.cai[0][0] === ESC && rec.gasto === ESC, 'quebrar escada virada devolve a escada, e colocar gasta 1');
// chão plano e uma parede de pedra de 6 de altura na frente (lado -z)
const base = await p.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.max(m.chao(x0, z0) + 1, 40);
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); for (let y = 0; y < 10; y++) m.definir(x0 + x, y0 + y, z0 + z, z === -3 && y < 6 ? 3 : 0); }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0;
  const me = J.mercado; me.e.itens[211] = 8; me.recebeu(me.e);
  J.barra[0] = 211; J.slot = 0;
  return [x0, y0, z0];
});
const [x0, y0, z0] = base;
await p.waitForTimeout(500);
// no chão longe da parede: não fica
await tocarEm(p, [x0 + 0.5, y0, z0 + 2.5]);
ok(await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x0, y0, z0 + 2]) === 0 && await p.evaluate(() => document.body.innerText.includes('precisa de uma parede')), 'sem parede atrás a escada não fica e explica');
// na parede: 4 escadas, uma em cima da outra
for (let k = 0; k < 4; k++) await tocarEm(p, [x0 + 0.5, y0 + k + 0.5, z0 - 2 + 0.001]);
const pos = await p.evaluate(([x, y, z]) => [0, 1, 2, 3].map((k) => window.__jogo.mundo.bloco(x, y + k, z)), [x0, y0, z0 - 2]);
const sobra = await p.evaluate(() => window.__jogo.mercado.e.itens[211] || 0);
ok(pos.every((q) => q === 214), `4 escadas presas na parede (viradas para ela: ${pos}), gastou 4 (sobram ${sobra})`);
ok(sobra === 4, 'colocar gasta da mochila');
await p.screenshot({ path: SAIDA + '/escada-1-parede.png' });
// sobe: entra na escada e anda para a frente
await p.evaluate(([x0, y0, z0]) => { const j = window.__jogo.jog; j.pos.x = x0 + 0.5; j.pos.z = z0 - 1.5; j.pos.y = y0; j.yaw = 0; j.pitch = 0; window.__jogo.barra[0] = 0; }, base);
await p.waitForTimeout(300);
const vida0 = await p.evaluate(() => window.__jogo.vida.atual);
await p.keyboard.down('KeyW'); await p.waitForTimeout(1300);
const meio = await p.evaluate(() => window.__jogo.jog.pos.y);
await p.screenshot({ path: SAIDA + '/escada-2-subindo.png' });
await p.keyboard.up('KeyW');
ok(meio - y0 > 2, `andando para a frente sobe a escada (subiu ${(meio - y0).toFixed(2)} blocos em 1,3 s)`);
// agachado (botão de agachar da tela) fica parado
await p.tap('#bt-agachar'); await p.waitForTimeout(150);
const a1 = await p.evaluate(() => window.__jogo.jog.pos.y); await p.waitForTimeout(700);
const a2 = await p.evaluate(() => window.__jogo.jog.pos.y);
await p.tap('#bt-agachar');
ok(Math.abs(a2 - a1) < 0.05, `agachado fica parado na escada (${a1.toFixed(2)} -> ${a2.toFixed(2)})`);
// solta: escorrega devagar até o chão, sem machucar
const vel = [];
for (let k = 0; k < 6; k++) { await p.waitForTimeout(150); vel.push(await p.evaluate(() => window.__jogo.jog.vel.y)); }
await p.waitForTimeout(2000);
const fim = await p.evaluate(() => ({ y: window.__jogo.jog.pos.y, vida: window.__jogo.vida.atual, chao: window.__jogo.jog.noChao }));
ok(vel.every((v) => v >= -2.5), `solto, escorrega devagar (${vel.map((v) => v.toFixed(1))})`);
ok(Math.abs(fim.y - y0) < 0.05 && fim.chao && fim.vida === vida0, `chegou no chão sem machucar (vida ${vida0} -> ${fim.vida})`);
// sem escada, cair da mesma altura cai rápido (a escada é que segura)
await p.evaluate(([x0, y0, z0]) => { const j = window.__jogo.jog; j.pos.x = x0 + 3.5; j.pos.z = z0 + 1.5; j.pos.y = y0 + 3.5; j.vel.y = 0; }, base);
await p.waitForTimeout(450);
const vq = await p.evaluate(() => window.__jogo.jog.vel.y);
ok(vq < -4 || await p.evaluate(() => window.__jogo.jog.noChao), `sem escada cai rápido (${vq.toFixed(1)})`);
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Torre');
  if (await a.getAttribute('[data-modo=sobrevivencia]', 'aria-pressed') === 'true') await a.click('[data-modo=criativo]');
  if (await a.getAttribute('[data-opcao=mercado]', 'aria-pressed') === 'true') await a.click('[data-opcao=mercado]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await a.waitForTimeout(2500);
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await bb.waitForTimeout(1500);
  // Ana procura um bloco sólido do mundo com ar na frente (-z) e põe a escada nele com a mão
  const alvo = await a.evaluate(() => {
    const M = window.__jogo.mundo, j = window.__jogo.jog, px = Math.floor(j.pos.x), pz = Math.floor(j.pos.z);
    for (let r = 0; r <= 30; r++) for (let dx = -r; dx <= r; dx++) for (const dz of [-r, r]) {
      const x = px + dx, z = pz + dz, y = M.chao(x, z);
      if ([1, 2, 3].includes(M.bloco(x, y, z)) && M.bloco(x, y + 1, z) === 0 && M.bloco(x, y + 1, z + 1) === 0 && M.bloco(x, y + 2, z + 1) === 0 && [1, 2, 3].includes(M.bloco(x, y, z + 1)) === false) {
        // precisa de parede: uma coluna mais alta do lado -z
        if ([1, 2, 3].includes(M.bloco(x, y + 1, z - 1)) && M.bloco(x, y + 1, z) === 0) return { x, y: y + 1, z };
      }
    }
    return null;
  });
  ok(!!alvo, 'online: achou uma parede natural ' + JSON.stringify(alvo));
  if (alvo) {
    await a.evaluate(({ x, y, z }) => { const J = window.__jogo, j = J.jog; j.voando = true; j.pos.x = x + 0.5; j.pos.y = y; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; J.barra[0] = 211; J.slot = 0; }, alvo);
    await a.waitForTimeout(700);
    for (let i = 0; i < 4; i++) {
      await tocarEm(a, [alvo.x + 0.5, alvo.y + 0.5, alvo.z - 0.001], false);
      if (ehEsc(await a.evaluate(({ x, y, z }) => window.__jogo.mundo.bloco(x, y, z), alvo))) break;
    }
    await bb.evaluate(({ x, y, z }) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = x + 3.5; j.pos.y = y + 2; j.pos.z = z + 4.5; }, alvo);
    await a.waitForTimeout(2000);
    const vA = await a.evaluate(({ x, y, z }) => window.__jogo.mundo.bloco(x, y, z), alvo), vB = await bb.evaluate(({ x, y, z }) => window.__jogo.mundo.bloco(x, y, z), alvo);
    ok(ehEsc(vA) && vA === vB, `online: Ana pôs a escada e Beto vê a mesma (${vA}, ${vB})`);
    await bb.screenshot({ path: SAIDA + '/escada-online-beto.png' });
  }
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

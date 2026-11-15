// Lava e obsidiana (como nos jogos de blocos clássicos), jogando pela tela do tablet, coletar e criar:
// despejar lava com o balde (o balde volta vazio), a lava escorre devagar até 3 blocos, pegar de volta com o
// balde (a corrente seca), com água a fonte vira obsidiana e a corrente vira pedrisco, quem entra na lava se
// queima, obsidiana só sai com picareta; cavernas fundas têm lava no fundo. Online: os dois veem a mesma
// lava e a mesma obsidiana, e quem entra depois vê a obsidiana (a sala guardou).
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-lava.mjs
//   ONLINE=http://localhost:8788 LIMPAR='...' (com a sala e o pages dev rodando) testa também online
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const LAVA = 215, OBS = 220, BALDE = 1009, AGUA = 5, PEDRA = 3;
const ehLava = (q) => q >= 215 && q <= 219;

async function mirar(q, [x, y, z]) {
  await q.evaluate(([x, y, z]) => {
    const J = window.__jogo, j = J.jog, c = J.camera, dx = x - c.position.x, dz = z - c.position.z;
    j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y - c.position.y, Math.hypot(dx, dz));
  }, [x, y, z]);
  await q.waitForTimeout(250);
}
const tocar = async (q) => { const m = await q.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 })); await q.touchscreen.tap(m.x, m.y); await q.waitForTimeout(450); };
const bl = (q, c) => q.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), c);
const itens = (q) => q.evaluate(() => ({ ...window.__jogo.mercado.e.itens }));

// ---------- tablet, sem internet ----------
const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await p.waitForTimeout(4000);
ok(await p.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true && window.__jogo.vida.ligada()), 'mundo novo: coletar e criar, com corações');
// regras
const r = await p.evaluate(async () => {
  const R = await import('/js/receitas.js');
  return { lava: R.oQueCai(215, 0, 0, 0, true, 0), obsMao: R.oQueCai(220, 0, 0, 0, true, 0), obsPic: R.oQueCai(220, 0, 0, 0, true, 1002) };
});
ok(!r.lava.length && !r.obsMao.length && r.obsPic[0][0] === OBS, 'lava não se quebra; obsidiana só sai com picareta ' + JSON.stringify(r));
// cavernas fundas têm lava no fundo (procura perto do começo)
const fundo = await p.evaluate(() => {
  const M = window.__jogo.mundo, j = window.__jogo.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z);
  let lava = 0, arBaixo = 0;
  for (let x = -40; x <= 40; x++) for (let z = -40; z <= 40; z++) for (let y = 2; y <= 7; y++) { const q = M.bloco(x0 + x, y, z0 + z); if (q === 215) lava++; if (q === 0) arBaixo++; }
  return { lava, arBaixo };
});
ok(fundo.lava > 0 && fundo.arBaixo === 0, `cavernas fundas com lava no fundo (${fundo.lava} blocos de lava, ${fundo.arBaixo} de ar abaixo de 8)`);
// chão de pedra plano, aberto
const base = await p.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.max(m.chao(x0, z0) + 1, 40) + 6; // plataforma no alto: longe da água do mundo
  for (let x = -10; x <= 10; x++) for (let z = -12; z <= 6; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); m.definir(x0 + x, y0 - 2, z0 + z, 3); for (let y = 0; y < 6; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0;
  const me = J.mercado; me.e.itens[215] = 1; me.e.itens[5] = 1; me.e.itens[1009] = 0; me.recebeu(me.e);
  J.barra[0] = 215; J.barra[1] = 5; J.barra[2] = 1009; J.slot = 0; J.dia = 0.3;
  return [x0, y0, z0];
});
const [x0, y0, z0] = base;
await p.waitForTimeout(500);
// despeja a lava no chão, 6 blocos à frente
const L = [x0, y0, z0 - 4];
await mirar(p, [L[0] + 0.5, y0 - 0.001, L[2] + 0.5]); await tocar(p);
let it = await itens(p);
ok(await bl(p, L) === LAVA && !(it[215] > 0) && it[1009] === 1, `despejou a lava com o balde: o balde voltou vazio (${await bl(p, L)}, balde ${it[1009]})`);
await p.waitForTimeout(6000);
const linha = await Promise.all([1, 2, 3, 4].map((d) => bl(p, [L[0] + d, y0, L[2]])));
ok(linha[0] === 216 && linha[1] === 217 && linha[2] === 218 && linha[3] === 0, `a lava escorre devagar até 3 blocos (${linha})`);
await p.screenshot({ path: SAIDA + '/lava-1-escorre.png' });
// pega de volta com o balde (mão com balde, "segurar" = quebrar)
await p.evaluate(() => { window.__jogo.slot = window.__jogo.barra.indexOf(1009); }); // o balde vazio voltou para o espaço da mão
await mirar(p, [L[0] + 0.5, y0 + 0.5, L[2] + 0.5]);
await p.evaluate(() => window.__jogo.quebrar(null)); await p.waitForTimeout(400);
it = await itens(p);
ok(await bl(p, L) !== LAVA && it[215] === 1 && !(it[1009] > 0), `pegou a lava com o balde (balde de lava na mochila: ${it[215]})`);
await p.waitForTimeout(6000);
const seca = await Promise.all([1, 2, 3].map((d) => bl(p, [L[0] + d, y0, L[2]])));
ok(seca.every((q) => q === 0), `sem a fonte, a lava corrente seca (${seca})`);
// despeja de novo e joga água em cima da lava corrente, do lado da fonte: a fonte vira obsidiana;
// a lava corrente que encosta na água vira pedrisco
await p.evaluate(() => { window.__jogo.slot = 0; });
await mirar(p, [L[0] + 0.5, y0 - 0.001, L[2] + 0.5]); await tocar(p);
await p.waitForTimeout(4000);
await p.evaluate(() => { window.__jogo.slot = 1; });
const W = [L[0] - 1, y0, L[2]];
await mirar(p, [W[0] + 0.5, y0 - 0.001, W[2] + 0.5]); await tocar(p);
ok(await bl(p, W) === AGUA, 'despejou água perto da lava');
await p.waitForTimeout(6000);
const fonte = await bl(p, L), viz = await Promise.all([[-1, 0], [0, 1], [0, -1], [1, 0]].map(([dx, dz]) => bl(p, [L[0] + dx, y0, L[2] + dz])));
ok(fonte === OBS, `a água encostou na fonte de lava: virou obsidiana (${fonte})`);
ok(!viz.some(ehLava), `sem a fonte (virou obsidiana), a lava corrente em volta secou (${viz})`);
// a ponta da lava corrente encostando na água vira pedrisco (a água fica parada no lugar)
const P = [x0 + 5, y0, z0 - 8];
await p.evaluate((P) => window.__jogo.mundo.definir(P[0], P[1], P[2], 215), P);
await p.waitForTimeout(5000);
await p.evaluate((P) => window.__jogo.mundo.definir(P[0] - 4, P[1], P[2], 5), P);
await p.waitForTimeout(3500);
const ponta = await Promise.all([1, 2, 3].map((d) => bl(p, [P[0] - d, y0, P[2]])));
ok(ponta[2] === 20 && await bl(p, P) === LAVA, `lava corrente que encostou na água virou pedrisco (${ponta}), a fonte longe continua lava`);
await p.screenshot({ path: SAIDA + '/lava-2-obsidiana.png' });
// obsidiana com a mão: muitos toques e não cai nada; com picareta de pedra cai
// queima: entra numa poça de lava
await p.evaluate(([x0, y0, z0]) => { const m = window.__jogo.mundo; for (let x = 4; x <= 5; x++) for (let z = 1; z <= 2; z++) m.definir(x0 + x, y0, z0 + z, 215); }, base);
await p.waitForTimeout(300);
const v0 = await p.evaluate(() => window.__jogo.vida.atual);
await p.evaluate(([x0, y0, z0]) => { const j = window.__jogo.jog; j.pos.x = x0 + 5; j.pos.y = y0 + 0.2; j.pos.z = z0 + 2; j.vel.x = j.vel.y = j.vel.z = 0; }, base);
await p.waitForTimeout(1800);
const queimou = await p.evaluate(() => ({ vida: window.__jogo.vida.atual, naLava: window.__jogo.jog.naLava, aviso: document.body.innerText.includes('lava queima') }));
ok(queimou.naLava && queimou.vida <= v0 - 2 && queimou.aviso, `dentro da lava queima (vida ${v0} -> ${queimou.vida}) e avisa`);
await p.screenshot({ path: SAIDA + '/lava-3-queima.png' });
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
  const entrar = async (q, codigo) => { await q.click('#bt-codigo'); await q.fill('#n-nome', codigo); await q.click('#m-novo button[type=submit]'); await q.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 }); await q.waitForTimeout(1500); };
  const sfx = Date.now() % 10000;
  const a = await jogador('Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Vulcao');
  if (await a.getAttribute('[data-modo=sobrevivencia]', 'aria-pressed') === 'true') await a.click('[data-modo=criativo]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await a.waitForTimeout(2500);
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await entrar(bb, codigo);
  // grama plana natural com espaço em volta
  const alvo = await a.evaluate(() => {
    const M = window.__jogo.mundo, j = window.__jogo.jog, px = Math.floor(j.pos.x), pz = Math.floor(j.pos.z);
    for (let r = 3; r <= 60; r++) for (let dx = -r; dx <= r; dx++) for (const dz of [-r, r]) {
      const x = px + dx, z = pz + dz, y = M.chao(x, z);
      let plano = true;
      for (let a = -2; a <= 3 && plano; a++) for (let c = -1; c <= 1 && plano; c++) { if (M.chao(x + a, z + c) !== y || ![1, 2, 3].includes(M.bloco(x + a, y, z + c))) plano = false; for (let k = 1; k <= 3; k++) if (M.bloco(x + a, y + k, z + c) !== 0) plano = false; }
      if (plano) return { x, y: y + 1, z };
    }
    return null;
  });
  ok(!!alvo, 'online: achou chão plano natural ' + JSON.stringify(alvo));
  if (alvo) {
    const poe = async (q, id, c) => {
      await q.evaluate(({ c, id }) => { const J = window.__jogo, j = J.jog; j.voando = true; j.pos.x = c[0] + 0.5; j.pos.y = c[1] + 2.5; j.pos.z = c[2] + 3.5; j.vel.x = j.vel.y = j.vel.z = 0; J.barra[0] = id; J.slot = 0; }, { c, id });
      await q.waitForTimeout(600);
      for (let i = 0; i < 4 && await bl(q, c) !== id; i++) { await mirar(q, [c[0] + 0.5, c[1] - 0.001, c[2] + 0.5]); await q.evaluate(() => window.__jogo.usar(null)); await q.waitForTimeout(500); }
    };
    const LA = [alvo.x, alvo.y, alvo.z];
    await poe(a, LAVA, LA);
    await bb.evaluate((c) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = c[0] + 3.5; j.pos.y = c[1] + 3; j.pos.z = c[2] + 6.5; }, LA);
    await a.waitForTimeout(5000);
    const ver = (q) => q.evaluate((c) => [0, 1, 2, 3].map((d) => window.__jogo.mundo.bloco(c[0] + d, c[1], c[2])), LA);
    const la = await ver(a), lb = await ver(bb);
    ok(la[0] === LAVA && la[1] === 216 && JSON.stringify(la) === JSON.stringify(lb), `online: lava da Ana escorre igual para os dois (${la} / ${lb})`);
    await poe(a, AGUA, [LA[0] - 1, LA[1], LA[2]]);
    await a.waitForTimeout(7000);
    const oa = await bl(a, LA), ob = await bl(bb, LA);
    ok(oa === OBS && ob === OBS, `online: a água encostou e virou obsidiana para os dois (${oa}, ${ob})`);
    await bb.screenshot({ path: SAIDA + '/lava-online-beto.png' });
    if (process.env.LIMPAR) (await import('child_process')).execSync(process.env.LIMPAR, { stdio: 'ignore' });
    const c = await jogador('Caio' + sfx);
    await entrar(c, codigo);
    await c.evaluate((p) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = p[0] + 3.5; j.pos.y = p[1] + 3; j.pos.z = p[2] + 6.5; }, LA);
    await c.waitForTimeout(3000);
    ok(await bl(c, LA) === OBS, `online: Caio entrou depois e vê a obsidiana (a sala guardou: ${await bl(c, LA)})`);
  }
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

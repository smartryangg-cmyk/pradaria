// Água não se quebra: a mira atravessa a água e acerta o bloco de trás; só o balde vazio pega a água parada.
// Coletando: pegar enche o balde (Água na mochila) e despejar devolve o balde vazio; a mão troca sozinha.
// Online (coletar e criar): a sala recusa tirar água sem balde, mesmo se alguém mandar direto.
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-balde.mjs
//   ONLINE=http://localhost:8788 (com a sala e o pages dev rodando) testa também 2 jogadores
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const AGUA = 5, PEDRA = 3, BALDE = 1009;

// piscina: chão de pedra, a água parada fica 2 blocos à frente, no nível dos pés; o jogador olha para ela
const piscina = () => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.max(m.chao(x0, z0) + 1, 40);
  for (let x = -4; x <= 4; x++) for (let z = -6; z <= 3; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); m.definir(x0 + x, y0 - 2, z0 + z, 3); for (let y = 0; y < 14; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  // poço de 1 bloco (paredes de pedra em volta, para a água não escorrer)
  m.definir(x0, y0 - 1, z0 - 2, 5);
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.vel.x = j.vel.y = j.vel.z = 0; j.voando = false; j.yaw = 0; j.pitch = -0.62;
  return [x0, y0 - 1, z0 - 2];
};
const mira = (comAgua) => { const J = window.__jogo, c = J.camera, d = c.getWorldDirection(new c.position.constructor()); const h = J.mundo.raycast(c.position, d, 6, !!comAgua); return h && [h.x, h.y, h.z, h.b]; };

// ---------- tablet, sem internet, coletar e criar ----------
const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.mercado, null, { timeout: 30000 });
await p.waitForTimeout(4000);
ok(await p.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo é de coletar e criar');
const [ax, ay, az] = await p.evaluate(piscina);
await p.waitForTimeout(1200);
const h0 = await p.evaluate(mira), hA = await p.evaluate(mira, true);
ok(hA && hA[0] === ax && hA[1] === ay && hA[2] === az && h0 && h0[3] === PEDRA, 'a mira passa pela água e acerta a pedra atrás ' + JSON.stringify([hA && [hA[0] - ax, hA[1] - ay, hA[2] - az, hA[3]], h0 && [h0[0] - ax, h0[1] - ay, h0[2] - az, h0[3]]]));
const meio = await p.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 }));
// mão vazia: segurar o dedo na água bate na pedra do fundo, a água fica
await p.evaluate(() => { const J = window.__jogo; J.barra[0] = 0; J.slot = 0; });
await p.touchscreen.tap(meio.x, meio.y); await p.waitForTimeout(150);
const r1 = await p.evaluate(async ([x, y, z]) => {
  const J = window.__jogo;
  for (let i = 0; i < 3; i++) { J.quebrar(null); await new Promise((r) => setTimeout(r, 120)); }
  return { agua: J.mundo.bloco(x, y, z), agua5: J.mercado.e.itens[5] || 0 };
}, [ax, ay, az]);
ok(r1.agua === AGUA && r1.agua5 === 0, `mão vazia não quebra a água (bloco ${r1.agua}, água na mochila ${r1.agua5})`);
// Água na mão também não "quebra" a água
await p.evaluate(() => { const J = window.__jogo; J.mercado.e.itens[5] = 1; J.mercado.recebeu(J.mercado.e); J.barra[0] = 5; J.slot = 0; });
await p.evaluate(() => window.__jogo.quebrar(null)); await p.waitForTimeout(200);
ok(await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [ax, ay, az]) === AGUA, 'Água na mão não tira a água');
// receita do balde na bancada
const rec = await p.evaluate(async () => { const { RECEITAS } = await import('/js/receitas.js'); const r = RECEITAS.find((x) => x.id === 'balde'); return r && JSON.stringify([r.faz, r.usa, r.bancada]); });
ok(rec === '[[1009,1],[[8,3]],true]', 'balde: 3 tábuas na bancada ' + rec);
// balde vazio na mão: pega a água parada, o balde enche (Água na mochila) e a mão passa a segurar a Água
await p.evaluate(() => { const J = window.__jogo; J.mercado.e.itens[5] = 0; J.mercado.e.itens[1009] = 1; J.mercado.recebeu(J.mercado.e); J.barra[0] = 1009; J.barra[1] = 0; J.slot = 0; });
await p.waitForTimeout(300);
await p.screenshot({ path: SAIDA + '/balde-1-vazio.png' });
await p.touchscreen.tap(meio.x, meio.y); await p.waitForTimeout(100);
await p.evaluate(() => window.__jogo.quebrar(null)); await p.waitForTimeout(400);
const r2 = await p.evaluate(([x, y, z]) => { const J = window.__jogo; return { b: J.mundo.bloco(x, y, z), balde: J.mercado.e.itens[1009] || 0, agua: J.mercado.e.itens[5] || 0, mao: J.barra[0] }; }, [ax, ay, az]);
ok(r2.b === 0 && r2.balde === 0 && r2.agua === 1 && r2.mao === AGUA, 'balde pega a água: sai do mundo, balde cheio na mão ' + JSON.stringify(r2));
// despeja de volta: a água volta e o balde vazio volta para a mão
await p.evaluate(() => { window.__jogo.jog.pitch = -0.75; }); await p.waitForTimeout(200);
await p.evaluate(() => window.__jogo.usar(null)); await p.waitForTimeout(400);
const r3 = await p.evaluate(([x, y, z]) => { const J = window.__jogo; const h = J.mundo; let onde = null; for (let dz = -3; dz <= 0; dz++) for (let dy = 0; dy <= 1; dy++) if (h.bloco(x, y + dy, z + dz) === 5) onde = [dy, dz]; return { onde, balde: J.mercado.e.itens[1009] || 0, agua: J.mercado.e.itens[5] || 0, mao: J.barra[0] }; }, [ax, ay, az]);
ok(r3.onde && r3.balde === 1 && r3.agua === 0 && r3.mao === BALDE, 'despejou a água: balde vazio volta para a mão ' + JSON.stringify(r3));
await p.waitForTimeout(800);
await p.screenshot({ path: SAIDA + '/balde-2-despejou.png' });
await ctx.close();

// ---------- online: coletar e criar, a sala não deixa tirar água sem balde ----------
if (ONLINE) {
  async function jogador(nome) {
    const c = await b.newContext({ viewport: { width: 900, height: 560 } });
    const q = await c.newPage();
    q.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); q.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
    await q.goto(ONLINE + '/#teste'); await q.evaluate(() => localStorage.clear()); await q.reload();
    await q.click('#bt-criar-conta'); await q.fill('#c-nome', nome); await q.fill('#c-senha', 'senha123');
    if (await q.isVisible('#c-adulto-ok')) await q.check('#c-adulto-ok');
    if (await q.isVisible('#c-nasc .d-ano')) { await q.selectOption('#c-nasc .d-dia', '1'); await q.selectOption('#c-nasc .d-mes', '1'); await q.selectOption('#c-nasc .d-ano', '1990'); } await q.click('#c-ok');
    await q.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 20000 });
    if (await q.isVisible('#m-jogos')) await q.click('.jogo[data-jogo=pradaria]');
    await q.waitForSelector('#m-mundos:not([hidden])', { timeout: 20000 });
    return q;
  }
  const sfx = Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join(''); // letras: com 4 algarismos do relógio o nome repetia entre testes e a conta não era criada
  const a = await jogador('Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Lago');
  if (await a.getAttribute('[data-modo=sobrevivencia]', 'aria-pressed') !== 'true') await a.click('[data-modo=sobrevivencia]');
  if (await a.getAttribute('[data-opcao=mercado]', 'aria-pressed') === 'true') await a.click('[data-opcao=mercado]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await a.waitForTimeout(2500);
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await bb.waitForTimeout(1500);
  // a sala só aceita mudança feita pela mão (e coletando, só com o que se tem): usa um lago do próprio mundo.
  // Ana voa parada 3 blocos acima de uma água parada e olha para baixo
  const pos = await a.evaluate(async () => {
    const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z);
    let achou = null;
    for (let r = 0; r <= 120 && !achou; r += 2) for (let dx = -r; dx <= r && !achou; dx += 2) for (const dz of [-r, r]) {
      const x = x0 + dx, z = z0 + dz;
      for (let y = 70; y > 20; y--) { const k = m.bloco(x, y, z); if (!k) continue; if (k === 5 && m.bloco(x, y + 1, z) === 0) achou = [x, y, z]; break; }
      if (achou) break;
    }
    if (!achou) return null;
    const [x, y, z] = achou;
    j.voando = true; j.pos.x = x + 0.5; j.pos.z = z + 0.5; j.pos.y = y + 3; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = -1.55;
    return achou;
  });
  ok(!!pos, 'online: achou um lago perto');
  await bb.evaluate((p) => { if (!p) return; const j = window.__jogo.jog; j.voando = true; j.pos.x = p[0] + 3.5; j.pos.z = p[2] + 0.5; j.pos.y = p[1] + 4; }, pos);
  await a.waitForTimeout(2500);
  await a.waitForTimeout(1500);
  ok(await bb.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), pos) === AGUA, 'online: Beto vê a água da Ana');
  // Ana com a mão vazia bate na água: nada muda para ninguém
  await a.evaluate(async () => { const J = window.__jogo; J.barra[0] = 0; J.slot = 0; for (let i = 0; i < 3; i++) { J.quebrar(null); await new Promise((r) => setTimeout(r, 150)); } });
  await a.waitForTimeout(1200);
  const v1 = await Promise.all([a, bb].map((q) => q.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), pos)));
  ok(v1[0] === AGUA && v1[1] === AGUA, `online: mão vazia não tira a água (Ana ${v1[0]}, Beto ${v1[1]})`);
  // alguém manda direto para a sala "tirei a água" sem balde: a sala recusa
  await a.evaluate(([x, y, z]) => window.__jogo.sala.enviar({ t: 'bloco', x, y, z, b: 0, de: 5, j: 1, mao: 0 }), pos);
  await a.waitForTimeout(1500);
  ok(await bb.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), pos) === AGUA, 'online: a sala recusa tirar água sem balde');
  await bb.screenshot({ path: SAIDA + '/balde-online-beto.png' });
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

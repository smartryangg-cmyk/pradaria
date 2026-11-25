// Muda que vira árvore (coletar e criar), jogando pela tela do tablet:
// folhas às vezes soltam muda; muda só pega na grama/terra; depois de 1 min cresce sozinha e vira árvore
// (carvalho/bétula ou pinheiro), mas só com espaço em cima; e no online o amigo vê a árvore nascer igual.
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-arvore.mjs
//   ONLINE=http://localhost:8788 (com a sala e o pages dev rodando) testa também 2 jogadores
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const MUDA = 78, MUDA_P = 79, GRAMA = 1, PEDRA = 3;

// ---------- tablet, sem internet ----------
const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.plantacoes, null, { timeout: 30000 });
await p.waitForTimeout(4000);
ok(await p.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo é de coletar e criar');
// folhas soltam muda (de vez em quando), só as do mundo ou de árvore crescida
const cai = await p.evaluate(async () => {
  const { oQueCai } = await import('/js/receitas.js');
  let carv = 0, pin = 0, colocada = 0;
  for (let i = 0; i < 400; i++) {
    if (oQueCai(7, i * 3, 50, i * 7, true).some(([id]) => id === 78)) carv++;
    if (oQueCai(72, i * 5, 60, i * 2, true).some(([id]) => id === 79)) pin++;
  }
  return { carv: carv / 400, pin: pin / 400 };
});
ok(cai.carv > 0.05 && cai.carv < 0.16 && cai.pin > 0.05 && cai.pin < 0.16, `folhas soltam muda ~10% (carvalho ${cai.carv}, pinheiro ${cai.pin})`);
// chão plano: metade grama, metade pedra; o jogador olha para baixo, para o bloco 2 à frente
const base = await p.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.max(m.chao(x0, z0) + 1, 40);
  for (let x = -8; x <= 8; x++) for (let z = -12; z <= 3; z++) { m.definir(x0 + x, y0 - 1, z0 + z, x < 0 ? 3 : 1); m.definir(x0 + x, y0 - 2, z0 + z, 3); for (let y = 0; y < 16; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.vel.x = j.vel.z = 0; j.voando = false; j.yaw = 0; j.pitch = -0.75;
  const me = J.mercado; me.e.itens[78] = 3; me.e.itens[79] = 1; me.recebeu(me.e);
  return [x0, y0, z0];
});
const [x0, y0, z0] = base;
await p.waitForTimeout(800);
const meio = await p.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 }));
const tocar = async () => { await p.touchscreen.tap(meio.x, meio.y); await p.waitForTimeout(350); };
const mira = () => p.evaluate(() => { const J = window.__jogo, c = J.camera, d = c.getWorldDirection(new c.position.constructor()), h = J.mundo.raycast(c.position, d, 6); return h && [h.x, h.y, h.z, h.b]; });
// na pedra: não planta
await p.evaluate(([x0]) => { const J = window.__jogo; J.jog.pos.x = x0 - 3.5; J.barra[0] = 78; J.slot = 0; }, base);
await p.waitForTimeout(500);
let h = await mira();
await tocar();
const naPedra = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y + 1, z), h);
ok(h[3] === PEDRA && naPedra === 0 && await p.evaluate(() => document.body.innerText.includes('Plante a muda na grama')), `muda na pedra não planta e explica (${naPedra})`);
// na grama: planta e gasta 1
await p.evaluate(([x0]) => { window.__jogo.jog.pos.x = x0 + 2.5; }, base);
await p.waitForTimeout(500);
h = await mira();
await tocar();
const m1 = [h[0], h[1] + 1, h[2]];
const plantou = await p.evaluate(([x, y, z]) => [window.__jogo.mundo.bloco(x, y, z), window.__jogo.mercado.e.itens[78] || 0], m1);
ok(h[3] === GRAMA && plantou[0] === MUDA && plantou[1] === 2, `muda na grama planta e gasta 1 (${plantou})`);
await p.screenshot({ path: SAIDA + '/arvore-1-muda.png' });
// muda sem espaço: teto de pedra 3 blocos acima
const m2 = [x0 + 6, y0, z0 - 8];
await p.evaluate(([x, y, z]) => { const m = window.__jogo.mundo; m.definir(x, y, z, 78); m.definir(x, y + 3, z, 3); }, m2);
// pinheiro
const m3 = [x0 + 6, y0, z0 - 3];
await p.evaluate(([x, y, z]) => window.__jogo.mundo.definir(x, y, z, 79), m3);
// cresce sozinha: tiques de 5 s; antes de 1 min nunca cresce
const cresc = await p.evaluate(([m1, m2, m3]) => {
  const J = window.__jogo, M = J.mundo, t0 = Math.floor(Date.now() / 5000) + 2, r = { antes: false }; // tiques do relógio de verdade em diante
  J.plantacoes.tique(J.jog.pos.x, J.jog.pos.z, t0);
  for (let t = t0 + 1; t < t0 + 12; t++) { J.plantacoes.tique(J.jog.pos.x, J.jog.pos.z, t); if (M.bloco(...m1) !== 78) r.antes = true; }
  let t = t0 + 12;
  for (; t < t0 + 900 && (M.bloco(...m1) === 78 || M.bloco(...m3) === 79); t++) J.plantacoes.tique(J.jog.pos.x, J.jog.pos.z, t);
  r.tiques = t - t0;
  const alto = (x, y, z) => { let n = 0; while ([80, 81, 82].includes(M.bloco(x, y + n, z))) n++; return n; };
  const folhas = (x, y, z) => { let n = 0; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 11; dy++) if ([7, 72].includes(M.bloco(x + dx, y + dy, z + dz))) n++; return n; };
  r.carv = { tronco: M.bloco(...m1), alto: alto(...m1), folhas: folhas(...m1) };
  r.pin = { tronco: M.bloco(...m3), alto: alto(...m3), folhas: folhas(...m3) };
  r.semEspaco = M.bloco(...m2);
  if (M.bloco(...m1) === 78) r.dbg = { m1, base: [J.jog.pos.x, J.jog.pos.z], chao: M.bloco(m1[0], m1[1] - 1, m1[2]), bloq: [] };
  if (r.dbg) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 8; dy++) { const q = M.bloco(m1[0] + dx, m1[1] + dy, m1[2] + dz); if (q && q !== 72 && q !== 7 && q !== 81 && (dx || dy || dz)) r.dbg.bloq.push([dx, dy, dz, q]); }
  return r;
}, [m1, m2, m3]);
ok(!cresc.antes, 'antes de 1 minuto a muda não cresce');
if (cresc.dbg) console.log(JSON.stringify(cresc.dbg));
ok([80, 82].includes(cresc.carv.tronco) && cresc.carv.alto >= 4 && cresc.carv.folhas >= 20, `muda virou árvore com tronco e copa ${JSON.stringify(cresc.carv)} (${Math.round(cresc.tiques * 5 / 60)} min de jogo)`);
ok(cresc.pin.tronco === 81 && cresc.pin.alto >= 6 && cresc.pin.folhas >= 15, `muda de pinheiro virou pinheiro ${JSON.stringify(cresc.pin)}`);
ok(cresc.semEspaco === MUDA, 'muda com teto baixo espera (não cresce dentro da pedra)');
await p.evaluate(() => { window.__jogo.jog.pitch = 0.15; window.__jogo.jog.pos.z += 3; });
await p.waitForTimeout(1500);
await p.screenshot({ path: SAIDA + '/arvore-2-cresceu.png' });
await ctx.close();

// ---------- online: Ana planta, os dois veem a árvore nascer ----------
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Bosque');
  // criativo, sem loja: a muda é livre (o gasto de colocar já foi testado acima)
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
  // procura uma grama do mundo com espaço em cima, onde o sorteio deixa crescer daqui a 70-95 s
  // (mundo sorteado: às vezes não há grama livre com o sorteio certo agora; a janela anda a cada tique, então tenta de novo)
  let alvo = null;
  for (let tenta = 0; tenta < 8 && !alvo; tenta++) { if (tenta) { // aqui não tem grama livre (floresta, neve, areia...): anda mais para longe e procura lá
    await a.evaluate((k) => { const J = window.__jogo, j = J.jog, x = j.pos.x + (k % 2 ? 70 : 0), z = j.pos.z + (k % 2 ? 0 : 70); J.mundo.atualizar(x, z, 400); J.cmd.teleportar(x, J.mundo.chao(Math.floor(x), Math.floor(z)) + 1.02, z, j.yaw, ''); }, tenta);
    await a.waitForTimeout(5000); } alvo = await a.evaluate(async () => {
    const J = window.__jogo, M = J.mundo, j = J.jog, R = await import('/js/arvores-regras.js'), { TIQUE_MS } = await import('/js/plantacoes-regras.js');
    const T = Math.floor(Date.now() / TIQUE_MS), px = Math.floor(j.pos.x), pz = Math.floor(j.pos.z);
    for (let r = 2; r <= 40; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz += (Math.abs(dx) === r ? 1 : 2 * r)) { // a volta inteira do quadrado
      const x = px + dx, z = pz + dz, y = M.chao(x, z) + 1;
      if (M.bloco(x, y - 1, z) !== 1 || M.bloco(x, y, z) !== 0) continue;
      let t = -1; for (let k = T + 14; k <= T + 19; k++) if (R.cresceMuda(x, y, z, k)) { t = k; break; }
      if (t < 0) continue;
      if (R.formaArvore(78, x, y, z).some(([a2, b2, c2]) => (a2 || b2 || c2) && M.bloco(x + a2, y + b2, z + c2) !== 0)) continue;
      // a Ana fica 2 blocos ao sul olhando para a muda: o caminho da mira tem de estar livre (capim, flor ou morro no meio pegam o clique)
      let livre = true; for (let dz2 = 1; dz2 <= 3 && livre; dz2++) for (let dy2 = 0; dy2 <= 3; dy2++) if (M.bloco(x, y + dy2, z + dz2) !== 0) { livre = false; break; }
      if (!livre) continue;
      return { x, y, z, espera: (t + 1) * TIQUE_MS - Date.now() };
    }
    return null;
  }); }
  ok(!!alvo, 'online: achou grama livre para plantar ' + JSON.stringify(alvo));
  if (alvo) {
    // Ana fica perto, olhando para a grama, e planta com a mão (usar)
    await a.evaluate(({ x, y, z }) => {
      const J = window.__jogo, j = J.jog; j.voando = true; j.pos.x = x + 0.5; j.pos.y = y + 1.2; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0;
      const c = J.camera; j.pitch = -Math.atan2(c.position.y - (y - 0.5), 2) ; J.barra[0] = 78; J.slot = 0;
    }, alvo);
    await a.waitForTimeout(800);
    for (let i = 0; i < 4; i++) {
      await a.evaluate(({ x, y, z }) => { const J = window.__jogo, c = J.camera, j = J.jog; j.pitch = -Math.atan2(c.position.y - (y - 0.5), c.position.z - (z + 0.5)); }, alvo);
      await a.waitForTimeout(300);
      await a.evaluate(() => window.__jogo.usar(null));
      await a.waitForTimeout(700);
      if (await a.evaluate(({ x, y, z }) => window.__jogo.mundo.bloco(x, y, z), alvo) === MUDA) break;
    }
    await bb.evaluate(({ x, y, z }) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = x + 4.5; j.pos.y = y + 3; j.pos.z = z + 6.5; }, alvo);
    await a.waitForTimeout(1500);
    const vista = await bb.evaluate(({ x, y, z }) => window.__jogo.mundo.bloco(x, y, z), alvo);
    ok(vista === MUDA, `online: Beto vê a muda da Ana (${vista})`);
    console.log(`esperando a árvore crescer (~${Math.round(alvo.espera / 1000)} s)`);
    await a.waitForTimeout(alvo.espera + 6000);
    const fim = await Promise.all([a, bb].map((q) => q.evaluate(({ x, y, z }) => { const M = window.__jogo.mundo; let f = 0; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 11; dy++) if (M.bloco(x + dx, y + dy, z + dz) === 7) f++; return [M.bloco(x, y, z), M.bloco(x, y + 2, z), f]; }, alvo)));
    ok([80, 82].includes(fim[0][0]) && fim[0][2] >= 20, `online: a árvore nasceu para a Ana ${JSON.stringify(fim[0])}`);
    ok(JSON.stringify(fim[0]) === JSON.stringify(fim[1]), `online: Beto vê a mesma árvore ${JSON.stringify(fim[1])}`);
    await bb.screenshot({ path: SAIDA + '/arvore-online-beto.png' });
    // quem entra depois vê a árvore: a sala aceitou e guardou (não é só o aparelho de cada um)
    // (teste local: a conta nova tem limite por aparelho; LIMPAR = comando que zera as tentativas)
    if (process.env.LIMPAR) (await import('child_process')).execSync(process.env.LIMPAR, { stdio: 'ignore' });
    const c = await jogador('Caio' + sfx);
    await c.click('#bt-codigo'); await c.fill('#n-nome', codigo); await c.click('#m-novo button[type=submit]');
    await c.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
    await c.evaluate(({ x, y, z }) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = x + 4.5; j.pos.y = y + 3; j.pos.z = z + 6.5; }, alvo);
    await c.waitForTimeout(4000);
    const doCaio = await c.evaluate(({ x, y, z }) => { const M = window.__jogo.mundo; let f = 0; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 11; dy++) if (M.bloco(x + dx, y + dy, z + dz) === 7) f++; return [M.bloco(x, y, z), M.bloco(x, y + 2, z), f]; }, alvo);
    ok(JSON.stringify(doCaio) === JSON.stringify(fim[0]), `online: Caio entrou depois e vê a mesma árvore (a sala guardou) ${JSON.stringify(doCaio)}`);
  }
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

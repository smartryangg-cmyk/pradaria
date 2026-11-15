// Plantação de trigo (coletar e criar), jogando pela tela do tablet:
// planta na Terra de plantar (nasce broto), não planta na grama, cresce sozinho (broto -> verde -> maduro),
// perto da água cresce mais rápido, colher o maduro rende trigo, e no online o amigo vê crescer.
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-plantacao.mjs
//   ONLINE=http://localhost:8788 (com npm run dev:sala e npm run dev) testa também 2 jogadores
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const BROTO = 76, VERDE = 77, TRIGO = 32, ARADA = 31;

// ---------- tablet, sem internet ----------
const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.plantacoes, null, { timeout: 30000 });
await p.waitForTimeout(4000);
ok(await p.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo é de coletar e criar');
// chão plano de grama em volta; o jogador olha para baixo, para o bloco 2 à frente
const base = await p.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = m.chao(x0, z0) + 1;
  for (let x = -6; x <= 6; x++) for (let z = -8; z <= 3; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 1); for (let y = 0; y < 6; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.vel.x = j.vel.z = 0; j.yaw = 0; j.pitch = -0.75;
  const me = J.mercado; me.e.itens[32] = 3; me.e.itens[31] = 2; me.recebeu(me.e);
  return [x0, y0, z0];
});
await p.waitForTimeout(700);
const [x0, y0, z0] = base;
const alvo = await p.evaluate(() => { const J = window.__jogo, c = J.camera, d = c.getWorldDirection(new c.position.constructor()); return J.mundo.raycast(c.position, d, 6); });
ok(alvo && alvo.b === 1 && alvo.y === y0 - 1, 'mira na grama à frente ' + JSON.stringify(alvo && [alvo.x - x0, alvo.y - y0, alvo.z - z0, alvo.b]));
const meio = await p.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 }));
const tocar = async () => { await p.touchscreen.tap(meio.x, meio.y); await p.waitForTimeout(300); };
// trigo direto na grama: não planta
await p.evaluate(() => { const J = window.__jogo; J.barra[0] = 32; J.slot = 0; }); // trigo na mão
await tocar();
const naGrama = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [alvo.x, alvo.y + 1, alvo.z]);
const aviso = await p.evaluate(() => document.body.innerText.includes('Plante o trigo na Terra de plantar'));
ok(naGrama === 0 && aviso, `trigo na grama não planta e explica (bloco ${naGrama}, aviso ${aviso})`);
// troca a grama por Terra de plantar e planta
await p.evaluate(([x, y, z]) => { window.__jogo.mundo.definir(x, y, z, 31); }, [alvo.x, alvo.y, alvo.z]);
await p.waitForTimeout(300);
await tocar();
const plantou = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [alvo.x, alvo.y + 1, alvo.z]);
const sobrou = await p.evaluate(() => window.__jogo.mercado.e.itens[32] || 0);
ok(plantou === BROTO && sobrou === 2, `na Terra de plantar nasce broto e gasta 1 trigo (bloco ${plantou}, sobram ${sobrou})`);
await p.screenshot({ path: SAIDA + '/plantacao-1-broto.png' });
// cresce sozinho: tiques de crescimento (cada um vale 5 s de jogo)
const crescer = await p.evaluate(([x, y, z]) => {
  const J = window.__jogo, est = [J.mundo.bloco(x, y, z)];
  let t = 1e6;
  for (let i = 0; i < 400 && J.mundo.bloco(x, y, z) !== 32; i++) { J.plantacoes.tique(J.jog.pos.x, J.jog.pos.z, t++); const b2 = J.mundo.bloco(x, y, z); if (b2 !== est[est.length - 1]) est.push(b2); }
  return { est, tiques: t - 1e6 };
}, [alvo.x, alvo.y + 1, alvo.z]);
ok(crescer.est.join() === [BROTO, VERDE, TRIGO].join(), `cresce broto -> verde -> maduro (${crescer.est}) em ${crescer.tiques} tiques (~${Math.round(crescer.tiques * 5 / 60)} min)`);
// tempo médio sem e com água perto (mesmas regras, muitas plantas)
const media = await p.evaluate(([x0, y0, z0]) => {
  const J = window.__jogo, m = J.mundo;
  const medir = (agua) => {
    for (let x = -5; x <= 5; x++) for (let z = -8; z <= -4; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 31); m.definir(x0 + x, y0, z0 + z, 76); }
    if (agua) m.definir(x0, y0 - 1, z0 - 6, 5); else m.definir(x0, y0 - 1, z0 - 6, 31);
    if (!agua) m.definir(x0, y0, z0 - 6, 76); else m.definir(x0, y0, z0 - 6, 0);
    let t = 5e6 + (agua ? 1e5 : 0), soma = 0, n = 0;
    const falta = new Set();
    for (let x = -5; x <= 5; x++) for (let z = -8; z <= -4; z++) if (m.bloco(x0 + x, y0, z0 + z) === 76) falta.add(x + ',' + z);
    for (let i = 1; i <= 600 && falta.size; i++) {
      J.plantacoes.tique(J.jog.pos.x, J.jog.pos.z, t++);
      for (const k of [...falta]) { const [x, z] = k.split(',').map(Number); if (m.bloco(x0 + x, y0, z0 + z) === 32) { soma += i; n++; falta.delete(k); } }
    }
    return n ? soma / n : 999;
  };
  return { seca: medir(false), molhada: medir(true) };
}, base);
ok(media.molhada < media.seca * 0.75, `perto da água cresce mais rápido (média ${media.molhada.toFixed(1)} vs ${media.seca.toFixed(1)} tiques)`);
await p.evaluate(([x0, y0, z0]) => { const m = window.__jogo.mundo; for (let x = -5; x <= 5; x++) { m.definir(x0 + x, y0, z0 - 8, 76); m.definir(x0 + x, y0, z0 - 7, 77); } }, base);
await p.evaluate(() => { window.__jogo.jog.pitch = -0.35; });
await p.waitForTimeout(1200);
await p.screenshot({ path: SAIDA + '/plantacao-2-campo.png' });
await p.evaluate(() => { window.__jogo.jog.pitch = -0.75; });
await p.waitForTimeout(400);
// colher: segurar o dedo quebra o trigo maduro; o que cai vai para o chão e o jogador pega passando
const antes = await p.evaluate(() => window.__jogo.mercado.e.itens[32] || 0);
await p.evaluate(() => { const J = window.__jogo; J.barra[1] = 0; J.slot = 1; }); // mão vazia
const alvo2 = await p.evaluate(() => { const J = window.__jogo, c = J.camera, d = c.getWorldDirection(new c.position.constructor()); return J.mundo.raycast(c.position, d, 6); });
const quebrou = await p.evaluate(async ([x, y, z]) => { const J = window.__jogo; for (let i = 0; i < 6 && J.mundo.bloco(x, y, z); i++) { J.quebrar(null); await new Promise((r) => setTimeout(r, 120)); } return J.mundo.bloco(x, y, z); }, [alvo.x, alvo.y + 1, alvo.z]);
ok(alvo2 && alvo2.b === TRIGO && quebrou === 0, `colheu o trigo maduro mirado (${alvo2 && alvo2.b} -> ${quebrou})`);
await p.waitForTimeout(800);
await p.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.z = z + 0.5; }, [alvo.x, alvo.y + 1, alvo.z]);
await p.waitForTimeout(2500);
const depois = await p.evaluate(() => window.__jogo.mercado.e.itens[32] || 0);
ok(depois - antes >= 1, `pegou o trigo colhido do chão (+${depois - antes}; maduro dá 1 ou 2)`);
// rende: em 40 pés colhidos, a média passa de 1 (plantar 1, colher mais)
const rende = await p.evaluate(async () => { const { oQueCai } = await import('/js/receitas.js'); let s = 0; for (let i = 0; i < 40; i++) for (const [id, n] of oQueCai(32, i * 3, 20, i * 7)) if (id === 32) s += n; return s / 40; });
ok(rende > 1.5, `trigo maduro rende ${rende.toFixed(2)} por pé (broto quebrado devolve 1)`);
const brotoDa = await p.evaluate(async () => { const { oQueCai } = await import('/js/receitas.js'); return JSON.stringify([oQueCai(76), oQueCai(77)]); });
ok(brotoDa === '[[[32,1]],[[32,1]]]', 'quebrar broto/verde devolve só o trigo plantado ' + brotoDa);
await ctx.close();

// ---------- online: Ana planta, Beto vê crescer ----------
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Fazenda');
  // modo criativo (a mochila do servidor não tem trigo; o custo de plantar já foi testado acima)
  if (await a.getAttribute('[data-modo=sobrevivencia]', 'aria-pressed') === 'true') await a.click('[data-modo=criativo]');
  if (await a.getAttribute('[data-opcao=mercado]', 'aria-pressed') === 'true') await a.click('[data-opcao=mercado]'); // sem loja: trigo livre
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await a.waitForTimeout(2500);
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await bb.waitForTimeout(1500);
  const sob = await a.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia);
  // Ana prepara a terra e planta pela regra do jogo (usar com trigo na mão)
  const pos = await a.evaluate(async () => {
    const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = m.chao(x0, z0) + 1;
    for (let x = -2; x <= 2; x++) for (let z = -4; z <= 1; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); for (let y = 0; y < 14; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
    await new Promise((r) => setTimeout(r, 1500));
    m.definir(x0, y0 - 1, z0 - 2, 31);
    j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.yaw = 0; j.pitch = -0.75;
    J.barra[0] = 32; J.slot = 0;
    return [x0, y0, z0 - 2];
  });
  await a.waitForTimeout(1500);
  await a.evaluate(() => window.__jogo.usar(null));
  await a.waitForTimeout(1500);
  const daAna = await a.evaluate(([x, y, z]) => { const J = window.__jogo, c = J.camera, d = c.getWorldDirection(new c.position.constructor()), h = J.mundo.raycast(c.position, d, 6); return [J.mundo.bloco(x, y, z), J.mundo.bloco(x, y - 1, z), h && [h.x - x, h.y - y, h.z - z, h.b], J.barra[0], J.mercado.podeColocar(32), document.querySelector('#aviso') && document.querySelector('#aviso').innerText]; }, pos);
  console.log('ana:', JSON.stringify(daAna));
  const vista = await bb.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), pos);
  ok(vista === BROTO, `online (coletar ${sob}): Beto vê o broto que a Ana plantou (${vista})`);
  // Beto chega perto; os dois aparelhos fazem os mesmos tiques (mesma hora): o resultado é igual nos dois
  await bb.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 3.5; j.pos.z = z + 0.5; j.pos.y = y + 4; j.voando = true; }, pos);
  const tq = Math.floor(Date.now() / 5000) + 1e5;
  for (let i = 0; i < 300; i++) {
    const [ea, eb] = await Promise.all([a, bb].map((q) => q.evaluate(([x, y, z, t]) => { const J = window.__jogo; J.plantacoes.tique(J.jog.pos.x, J.jog.pos.z, t); return J.mundo.bloco(x, y, z); }, [...pos, tq + i])));
    if (ea === TRIGO && eb === TRIGO) break;
  }
  await a.waitForTimeout(1500);
  const fim = await Promise.all([a, bb].map((q) => q.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), pos)));
  ok(fim[0] === TRIGO && fim[1] === TRIGO, `online: cresceu e ficou maduro nos dois aparelhos (${fim})`);
  // sala guardou o maduro: quem entrar depois vê maduro
  await bb.reload(); await bb.waitForTimeout(500);
  await a.screenshot({ path: SAIDA + '/plantacao-online-ana.png' });
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

// Jogo clássico: monstros da noite (Barrento e Aranha) e as espadas. De noite eles nascem no escuro, longe de
// tocha, vêm atrás do jogador e machucam; com a espada caem e deixam o que têm (e experiência). De dia o
// barrento queima no sol e a aranha fica quieta. No Pacífico não tem monstro.
// Uso: (cd public && python3 -m http.server 8772), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-monstros.mjs        (PARTES=pc,toque,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0; const erros = [];
const PARTES = (process.env.PARTES || 'pc,toque,online').split(',');
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); }
  return false;
}
const qtd = (p, id) => J(p, (id) => window.__jogo.mercado.qtd(id), id);
function vigiar(p, nome) {
  p.on('pageerror', (e) => erros.push(nome + ' ' + (process.env.PILHA ? e.stack : e.message)));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
}
async function mundo(ctx, toque, nome, pacifico = false) {
  const p = await ctx.newPage(); vigiar(p, nome);
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (pacifico) await p.evaluate(() => document.querySelector('#m-novo [data-dificuldade=pacifico]').click());
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  return p;
}
const monstros = (p) => J(p, () => window.__jogo.bichos.lista.filter((b) => b.I.monstro && !b.caindo).map((b) => ({ e: b.especie, d: +b.distJog.toFixed(1), est: b.estado, v: b.vida })));
// um chão de pedra lá no alto, liso (o terreno não atrapalha); os monstros nascem nele (é o "chão" do mundo ali)
const palco = (p) => p.evaluate(() => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = 90;
  for (let dx = -34; dx <= 34; dx++) for (let dz = -34; dz <= 34; dz++) { m.definir(x0 + dx, y0, z0 + dz, 3); for (let dy = 1; dy <= 4; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0); }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0;
});
// tira os monstros e para de nascer sozinho (para a luta não ter visita)
const limpar = (p) => J(p, () => { const L = window.__jogo.bichos; L.tempoSpawn = 1e9; L._spawnParado = true; for (let i = L.lista.length - 1; i >= 0; i--) if (L.lista[i].I.monstro && !L.lista[i].caindo) L.remover(i); });
const voltarNascer = (p) => J(p, () => { window.__jogo.bichos.tempoSpawn = 0; });
// noite: o relógio do dia na meia-noite; o jogo tenta fazer nascer monstros sozinho (a cada 1,5 s)
const noite = (p) => J(p, () => { window.__jogo.dia = 0.75; });
const dia = (p) => J(p, () => { window.__jogo.dia = 0.25; });
const dar = (p, l) => J(p, (l) => { for (const [id, n] of l) window.__jogo.mercado.mexer({ t: 'pegar', id, n }, true); }, l);
const segurar = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
// luta: o monstro mais perto fica bem na frente da mira; bate de verdade (quebrar = clicar/segurar o dedo)
async function lutar(p, esp, max = 40) {
  return J(p, async ([esp, max]) => {
    const J_ = window.__jogo, j = J_.jog;
    for (let i = 0; i < max; i++) {
      const m = J_.bichos.lista.find((b) => b.especie === esp && !b.caindo);
      if (!m) return true;
      j.yaw = 0; j.pitch = -Math.atan((1.6 - m.e.alt * 0.5) / 1.7); // mira no meio do corpo dele
      m.x = j.pos.x; m.z = j.pos.z - 1.7; m.y = j.pos.y; m.empX = m.empZ = 0;
      await new Promise((r) => setTimeout(r, 80));
      J_.quebrar(null);
      await new Promise((r) => setTimeout(r, 700));
    }
    return !J_.bichos.lista.some((b) => b.especie === esp && !b.caindo);
  }, [esp, max]);
}
async function pegarTudo(p) {
  await limpar(p);
  await esperar(p, 1500);
  await ate(p, () => window.__jogo.drops.lista().length > 0, null, 5000); // online o que caiu vem da sala
  for (let k = 0; k < 6; k++) {
    const l = await J(p, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z]));
    if (!l.length) break;
    await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = Math.max(j.pos.y, y); }, l[0]);
    await esperar(p, 900);
  }
}
// espera nascer um monstro da espécie (força a escolha da espécie, mas o lugar e o escuro são as regras do jogo)
const nascer = (p, esp, ms = 20000) => ate(p, (esp) => { const J_ = window.__jogo, j = J_.jog; J_.bichos.tentarMonstro(j.pos.x, j.pos.y, j.pos.z, -1, esp); return J_.bichos.lista.some((b) => b.especie === esp); }, esp, ms);

// ================= computador, sem internet =================
if (PARTES.includes('pc')) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await mundo(ctx, false, 'pc');
  ok(await J(p, () => window.__jogo.vida.classico()), 'mundo novo é o jogo clássico');
  await palco(p); await esperar(p, 800);
  await dia(p); await esperar(p, 4000);
  ok((await monstros(p)).length === 0, 'de dia não nasce monstro');
  await noite(p);
  ok(await ate(p, () => window.__jogo.bichos.lista.some((b) => b.I.monstro), null, 40000), 'de noite nasceu um monstro sozinho ' + JSON.stringify(await monstros(p)));
  ok((await monstros(p)).every((m) => m.d >= 14), 'nasceu longe do jogador ' + JSON.stringify(await monstros(p)));
  // o barrento vem atrás e machuca
  await limpar(p);
  ok(await nascer(p, 'barrento'), 'nasceu um barrento');
  const v0 = await J(p, () => window.__jogo.vida.atual);
  await J(p, () => { const J_ = window.__jogo, j = J_.jog, m = J_.bichos.lista.find((b) => b.especie === 'barrento'); m.x = j.pos.x + 6; m.z = j.pos.z; m.y = j.pos.y; });
  ok(await ate(p, () => window.__jogo.bichos.lista.find((b) => b.especie === 'barrento')?.estado === 'atacar', null, 3000), 'o barrento viu e veio atrás');
  ok(await ate(p, (v0) => window.__jogo.vida.atual < v0, v0, 12000), `o barrento machucou (${v0} -> ${await J(p, () => window.__jogo.vida.atual)})`);
  await p.screenshot({ path: SAIDA + '/monstro-pc-barrento.png' });
  // a espada: cria na bancada de verdade? (as receitas têm teste próprio); aqui ela vem na mão e luta
  await dar(p, [[1115, 1]]); await segurar(p, 1115);
  const xp0 = await J(p, () => window.__jogo.mercado.e.xp | 0);
  ok(await lutar(p, 'barrento'), 'derrubou o barrento com a espada de ferro');
  await pegarTudo(p);
  ok(await qtd(p, 1112) === 1, 'pegou a carne estragada que ele deixou');
  ok(await J(p, () => window.__jogo.mercado.e.xp | 0) === xp0 + 5, 'ganhou 5 de experiência');
  const gasto = await J(p, () => (window.__jogo.mercado.e.desg?.[1115] || [])[0] | 0);
  ok(gasto >= 3, 'a espada gastou um pouco (' + gasto + ' golpes)');
  // a aranha: de dia fica quieta, de noite vem
  await limpar(p);
  ok(await nascer(p, 'aranha'), 'nasceu uma aranha');
  await dia(p);
  await J(p, () => { const J_ = window.__jogo, j = J_.jog, m = J_.bichos.lista.find((b) => b.especie === 'aranha'); m.x = j.pos.x + 6; m.z = j.pos.z; m.y = j.pos.y; m.estado = 'vagar'; });
  await esperar(p, 2000);
  ok(await J(p, () => window.__jogo.bichos.lista.find((b) => b.especie === 'aranha')?.estado !== 'atacar'), 'de dia a aranha fica quieta');
  await noite(p);
  ok(await ate(p, () => window.__jogo.bichos.lista.find((b) => b.especie === 'aranha')?.estado === 'atacar', null, 3000), 'de noite a aranha vem atrás');
  await p.screenshot({ path: SAIDA + '/monstro-pc-aranha.png' });
  ok(await lutar(p, 'aranha'), 'derrubou a aranha');
  await pegarTudo(p);
  ok(await qtd(p, 1111) === 2, 'pegou 2 fios de teia (' + await qtd(p, 1111) + ', chão ' + JSON.stringify(await J(p, () => window.__jogo.drops.lista().map((d) => [d.id, d.n, d.y]))) + ')');
  // de dia o barrento queima no sol (na superfície)
  await limpar(p);
  ok(await nascer(p, 'barrento'), 'outro barrento');
  await J(p, () => { const J_ = window.__jogo, j = J_.jog, m = J_.bichos.lista.find((b) => b.especie === 'barrento'); m.x = j.pos.x + 10; m.z = j.pos.z + 10; m.y = J_.mundo.chao(Math.floor(m.x), Math.floor(m.z)) + 1; });
  await dia(p);
  ok(await ate(p, () => !window.__jogo.bichos.lista.some((b) => b.especie === 'barrento'), null, 8000), 'de manhã o barrento queimou no sol e sumiu');
  // tocha espanta: com tocha em volta nenhum nasce perto
  ok(await J(p, () => { const J_ = window.__jogo, m = J_.mundo, j = J_.jog; const x = Math.floor(j.pos.x) + 3, z = Math.floor(j.pos.z), y = m.chao(x, z) + 1; m.definir(x, y, z, 221); return !!J_.bichos.luzPerto(x + 4, y, z, 7) && !J_.bichos.luzPerto(x + 30, y, z, 7); }), 'perto da tocha é lugar com luz (não nasce monstro)');
  await dia(p); await ctx.close();
  // Pacífico (mods): de noite nada
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const q = await mundo(ctx2, false, 'pacifico', true);
  await noite(q); await esperar(q, 8000);
  await voltarNascer(q); await esperar(q, 4000);
  ok(await J(q, () => window.__jogo.opcoesMundo.dificuldade) === 'pacifico' && (await monstros(q)).length === 0, 'no Pacífico não nasce monstro de noite');
  await ctx2.close();
}

// ================= celular e tablet =================
if (PARTES.includes('toque')) for (const [nome, dev] of [['celular', devices['Pixel 7']], ['tablet', devices['Galaxy Tab S4']]]) {
  const ctx = await b.newContext({ ...dev });
  const p = await mundo(ctx, true, nome);
  await palco(p); await esperar(p, 600);
  await noite(p); await limpar(p);
  ok(await nascer(p, 'barrento'), `${nome}: nasceu um barrento de noite`);
  await dar(p, [[1113, 1]]); await segurar(p, 1113);
  await J(p, () => { const J_ = window.__jogo, j = J_.jog, m = J_.bichos.lista.find((b) => b.especie === 'barrento'); j.yaw = 0; j.pitch = -0.2; m.x = j.pos.x; m.z = j.pos.z - 2; m.y = j.pos.y; });
  await esperar(p, 300);
  await p.screenshot({ path: SAIDA + `/monstro-${nome}.png` });
  // segurar o dedo no meio da tela bate (como o jogador faz)
  const vp = p.viewportSize();
  const vida0 = await J(p, () => window.__jogo.bichos.lista.find((b) => b.especie === 'barrento')?.vida);
  const cdp = await ctx.newCDPSession(p);
  for (let k = 0; k < 3; k++) {
    await J(p, () => { const J_ = window.__jogo, j = J_.jog, m = J_.bichos.lista.find((b) => b.especie === 'barrento' && !b.caindo); if (m) { j.yaw = 0; j.pitch = -0.2; m.x = j.pos.x; m.z = j.pos.z - 2; m.y = j.pos.y; } });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width / 2, y: vp.height / 2 }] });
    await esperar(p, 700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await esperar(p, 200);
  }
  const vida1 = await J(p, () => window.__jogo.bichos.lista.find((b) => b.especie === 'barrento')?.vida ?? 0);
  ok(vida1 < vida0, `${nome}: segurando o dedo bateu no barrento com a espada (${vida0} -> ${vida1})`);
  if (nome === 'tablet') {
    // vários monstros em volta derrubam o jogador: na hora de morrer os bravos vão embora no meio da conta dos bichos
    // (antes dava erro de página "reading 'x'"); depois renasce pelo botão
    const e0 = erros.length;
    await J(p, () => { const J_ = window.__jogo, L = J_.bichos, j = J_.jog; L.tempoSpawn = 1e9; J_.vida.protegido = 0;
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; const m = L.criar(k % 2 ? 'aranha' : 'barrento', j.pos.x + Math.cos(a) * 0.9, j.pos.y, j.pos.z + Math.sin(a) * 0.9, { grupo: 900 + k }); m.estado = 'atacar'; m.alvo = 'jog'; m.cacandoGente = true; m.timer = 4; m.mordeu = 0; }
      J_.vida.atual = 1; });
    const morreu = await ate(p, () => !document.querySelector('#morte').hidden, null, 20000);
    ok(morreu, 'tablet: os monstros derrubaram o jogador (tela de morte)');
    if (morreu) { await p.tap('#bt-renascer'); await esperar(p, 1500); }
    ok(await J(p, () => document.querySelector('#morte').hidden && window.__jogo.vida.atual > 0), 'tablet: renasceu pelo botão');
    ok(erros.length === e0, 'tablet: morrer cercado de monstros não dá erro de página ' + JSON.stringify(erros.slice(e0)));
  }
  await ctx.close();
}

// ================= online: o que o monstro deixa e a experiência passam pela sala =================
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
    await p.click('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 90000 }); if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
    await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 });
  }
  const a = await pagina('Ana');
  await conta(a, 'Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Monstros');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', true);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2000);
  await palco(a); await esperar(a, 800);
  await noite(a); await limpar(a);
  ok(await nascer(a, 'aranha'), 'online: nasceu uma aranha para a Ana');
  ok(await lutar(a, 'aranha'), 'online: a Ana derrubou a aranha (com a mão)');
  await pegarTudo(a);
  ok(await ate(a, () => window.__jogo.mercado.qtd(1111) === 2, null, 5000), 'online: pegou os 2 fios de teia (a sala deu) ' + await J(a, () => window.__jogo.mercado.qtd(1111) + JSON.stringify(window.__jogo.drops.lista().map((d) => [d.id, d.n, d.x, d.y, d.z])) + JSON.stringify(window.__jogo.jog.pos)));
  ok(await J(a, () => window.__jogo.mercado.e.xp | 0) === 5, 'online: 5 de experiência');
  // a sala confere: volta ao mundo e a mochila e a experiência vêm da sala
  // o palco lá no alto só existe neste aparelho: antes de sair desce para o chão de verdade (senão volta no ar, cai e desmaia)
  await J(a, () => { const J_ = window.__jogo, j = J_.jog, m = J_.mundo, x = Math.floor(j.pos.x), z = Math.floor(j.pos.z); let y = 88; while (y > 1 && !m.bloco(x, y, z)) y--; j.pos.y = y + 1.02; j.vel.y = 0; J_.dia = 0.25; });
  await esperar(a, 2000);
  await J(a, () => { window.__jogo.mercado.e.xp = 0; });
  await a.reload(); await esperar(a, 1500);
  if (await a.isVisible('#m-jogos')) await a.click('.jogo[data-jogo=pradaria]');
  await a.waitForSelector('#m-mundos:not([hidden])', { timeout: 30000 });
  await a.click('#lista-mundos .mundo, #lista-mundos button');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 }); await esperar(a, 2500);
  ok(await ate(a, () => window.__jogo.mercado.qtd(1111) === 2 && (window.__jogo.mercado.e.xp | 0) === 5, null, 5000), 'online: voltou e a sala guardou os fios e a experiência ' + await J(a, () => JSON.stringify([window.__jogo.mercado.qtd(1111), window.__jogo.mercado.e.xp, window.__jogo.vida.atual, !document.querySelector('#morte').hidden])));
  // inventar um monstro derrubado várias vezes seguidas: a sala não dá tudo (limite por minuto)
  await a.screenshot({ path: SAIDA + '/monstro-online-ana.png' });
  await bt.screenshot({ path: SAIDA + '/monstro-online-beto.png' });
  await bt.context().close(); await a.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

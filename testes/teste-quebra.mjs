// Quebrar por material, com conserto: madeira racha em lascas, pedra trinca e solta pedrinhas, terra esfarela,
// folhas planam, vidro estilhaça no 1º toque (e só sai inteiro com picareta); parou de bater, o bloco se refaz;
// no online o amigo vê a rachadura e ela também se conserta.
//   python3 -m http.server 8765 -d public · SAIDA=/tmp node testes/teste-quebra.mjs
//   ONLINE=http://localhost:8788 (sala e site locais) testa também 2 jogadores
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp', ONLINE = process.env.ONLINE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const espera = (q, ms) => q.waitForTimeout(ms);

const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await espera(p, 4000);
// parede de teste na frente do jogador: tronco, pedra, terra, folhas, vidro (lado a lado)
const base = await p.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = m.chao(x0, z0) + 1;
  for (let x = -5; x <= 5; x++) for (let z = -4; z <= 2; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); for (let y = 0; y < 12; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.vel.x = j.vel.z = 0; j.yaw = 0; j.pitch = 0;
  return [x0, y0, z0];
});
const [x0, y0, z0] = base;
const BL = { tronco: 6, pedra: 3, terra: 2, folhas: 7, vidro: 9 };
// mira o bloco (x0, y0 + 1, z0 - 2) e bate n vezes pelo mesmo caminho do jogo (quebrar = segurar o dedo)
const bater = (bloco, n, mao = 0) => p.evaluate(async ([x, y, z, bloco, n, mao]) => {
  const J = window.__jogo, m = J.mundo;
  m.definir(x, y, z, bloco); J.barra[0] = mao; J.slot = 0;
  await new Promise((r) => setTimeout(r, 250));
  for (let i = 0; i < n; i++) { J.quebrar(null); await new Promise((r) => setTimeout(r, 80)); }
  const e = J.escav ? null : null;
  return m.bloco(x, y, z);
}, [x0, y0 + 1, z0 - 2, bloco, n, mao]);
const estado = () => p.evaluate(([x, y, z]) => { const e = window.__escav.blocos.get(x + ',' + y + ',' + z); return e ? { toques: e.toques, restam: e.restam, tirados: e.tirados.map((t) => t.slice()) } : null; }, [x0, y0 + 1, z0 - 2]);
await p.evaluate(() => { window.__escav = window.__jogo.escav; });
ok(await p.evaluate(() => !!window.__escav), 'jogo expõe a escavação no modo de teste');
await p.evaluate(() => { window.__jogo.opcoesMundo.sobrevivencia = true; });

// madeira: lascas em pé (os cubinhos de uma batida ficam na mesma coluna)
await bater(BL.tronco, 2);
let e = await estado();
const colunas = e && e.tirados[0].map((id) => (id % 3) + ',' + Math.floor(id / 9)); // (i, k) de cada cubinho
const mesmaColuna = colunas && new Set(colunas).size <= Math.ceil(colunas.length / 2);
const lascas = await p.evaluate(() => window.__escav.parts.filter((q) => q.escala && q.escala.y > q.escala.x * 3).length);
ok(e && e.toques === 2 && mesmaColuna, `madeira: 2 batidas, lasca no sentido dos veios (colunas ${colunas && colunas.join(' ')})`);
ok(lascas > 0, `madeira: pedacinhos compridos (lascas) voando: ${lascas}`);
await p.screenshot({ path: SAIDA + '/quebra-madeira.png' });
// conserto: espera sem bater; o bloco se refaz e volta inteiro
const t0 = Date.now();
const linha = [];
for (let i = 0; i < 30; i++) { const s = await estado(); linha.push([Date.now() - t0, s && s.toques]); await espera(p, 200); }
const seq = linha.map((l) => l[1]).filter((v, i, arr) => i === 0 || v !== arr[i - 1]);
const inteiro = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 6 && !window.__jogo.mundo.escondido(x, y, z), [x0, y0 + 1, z0 - 2]);
ok(seq.join() === '2,1,', `parou de bater: espera e se refaz pedaço por pedaço (${seq.map((v) => v ?? 'inteiro')})`);
const fim = null;
ok(!fim && inteiro, 'depois volta inteiro (tronco no mundo, sem rachadura)');

// pedra: trinca torta e pedrinhas que quicam e duram mais
await bater(BL.pedra, 2, 1001);
e = await estado();
const pedrinhas = await p.evaluate(() => window.__escav.parts.filter((q) => q.quica > 0.5).length);
ok(e && e.toques === 2 && pedrinhas > 0, `pedra: rachou (${e && e.toques}) e soltou pedrinhas que quicam (${pedrinhas})`);
await p.screenshot({ path: SAIDA + '/quebra-pedra.png' });
// continuar batendo antes do conserto termina de quebrar
const quebrou = await bater(BL.pedra, 0) === 3 ? await p.evaluate(async ([x, y, z]) => { const J = window.__jogo; for (let i = 0; i < 10 && J.mundo.bloco(x, y, z); i++) { J.quebrar(null); await new Promise((r) => setTimeout(r, 80)); } return J.mundo.bloco(x, y, z); }, [x0, y0 + 1, z0 - 2]) : -1;
ok(quebrou === 0, 'pedra: batendo até o fim, quebra');

// terra: esfarela de cima para baixo (a 1ª batida tira cubinhos da camada de cima)
await bater(BL.terra, 1);
e = await estado();
const camadas = e && e.tirados[0].map((id) => Math.floor(id / 3) % 3);
ok(e && camadas.filter((j) => j === 2).length >= Math.min(9, camadas.length), `terra: esfarela por cima (camadas ${camadas})`);
// folhas: folhinhas planam (caem devagar)
await bater(BL.folhas, 1);
const planando = await p.evaluate(() => window.__escav.parts.filter((q) => q.g && q.g < 16).length);
ok(planando > 0, `folhas: folhinhas planando (${planando})`);
await espera(p, 4500);

// vidro: um toque estilhaça; coletando, com a mão vazia não sobra vidro; com picareta sai inteiro
const chao = () => p.evaluate(() => (window.__jogo.drops.lista || window.__jogo.drops.itens || []).length);
const temChao = await p.evaluate(() => { const d = window.__jogo.drops; return Object.keys(d).filter((k) => Array.isArray(d[k]) || d[k] instanceof Map).join(','); });
const pedacosAntes = await p.evaluate(() => window.__escav.parts.length);
const v1 = await bater(BL.vidro, 1);
const cacos = await p.evaluate((a) => window.__escav.parts.length - a, pedacosAntes);
await p.screenshot({ path: SAIDA + '/quebra-vidro.png' });
const caiuMao = await p.evaluate(async () => { const { oQueCai } = await import('/js/receitas.js'); return [oQueCai(9, 1, 2, 3, true, 0), oQueCai(9, 1, 2, 3, true, 1001), oQueCai(9, 1, 2, 3, true, 1003)]; });
ok(v1 === 0 && cacos >= 10, `vidro: estilhaçou no 1º toque em ${cacos} cacos`);
ok(JSON.stringify(caiuMao) === '[[],[[9,1]],[]]', `vidro: mão vazia/machado não devolve, picareta devolve ${JSON.stringify(caiuMao)} (chão: ${temChao})`);
await ctx.close();

// ---------- online ----------
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
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Pedreira');
  // coletar e criar (quebra em vários toques; no criativo quebra num toque só)
  await a.click('[data-modo=sobrevivencia]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await a.waitForTimeout(2500);
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await bb.waitForTimeout(1500);
  await bb.evaluate(() => { const s = window.__jogo.sala; const o = s.h.racha; s.h.racha = (m) => { window.__rachas = (window.__rachas || 0) + 1; o && o(m); }; });
  const pos = await a.evaluate(async () => {
    const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = m.chao(x0, z0) + 1;
    for (let x = -3; x <= 3; x++) for (let z = -4; z <= 1; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); for (let y = 0; y < 14; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
    await new Promise((r) => setTimeout(r, 2500)); // a sala aceita 25 blocos por segundo: deixa a limpeza passar
    m.definir(x0, y0 + 1, z0 - 2, 6); // tronco (5 toques com a mão)
    j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.yaw = 0; j.pitch = 0; J.barra[0] = 0; J.slot = 0;
    return [x0, y0 + 1, z0 - 2];
  });
  // o tronco foi posto "sem mão" no aparelho da Ana (a sala não repassa isso): no do Beto também, como se fosse do mundo
  await bb.evaluate(([x, y, z]) => window.__jogo.mundo.definir(x, y, z, 6), pos);
  await a.evaluate(async () => {
    const J = window.__jogo;
    await new Promise((r) => setTimeout(r, 1500));
    for (let i = 0; i < 2; i++) { J.quebrar(null); await new Promise((r) => setTimeout(r, 300)); }
  });
  await bb.waitForTimeout(700);
  const vista = await bb.evaluate(([x, y, z]) => { const e = window.__jogo.escav.blocos.get(x + ',' + y + ',' + z); return e ? e.toques : 0; }, pos);
  const daAna = await a.evaluate(([x, y, z]) => { const e = window.__jogo.escav.blocos.get(x + ',' + y + ',' + z); return e ? e.toques : 0; }, pos);
  ok(vista === daAna && vista >= 1, `online: Beto vê o tronco rachado no mesmo estágio da Ana (${vista} de ${daAna})`);
  await bb.evaluate(([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.z = z + 3.5; j.pos.y = y + 0.5; j.yaw = 0; j.pitch = -0.1; j.voando = true; }, pos);
  await bb.waitForTimeout(400);
  await bb.screenshot({ path: SAIDA + '/quebra-online-beto.png' });
  await bb.waitForTimeout(4500);
  const consertou = await Promise.all([a, bb].map((q) => q.evaluate(([x, y, z]) => !window.__jogo.escav.blocos.has(x + ',' + y + ',' + z) && window.__jogo.mundo.bloco(x, y, z) === 6, pos)));
  ok(consertou[0] && consertou[1], `online: sem bater, o tronco se consertou nos dois (${consertou})`);
}
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

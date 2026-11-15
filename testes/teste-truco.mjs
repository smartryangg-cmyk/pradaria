// Teste real do Truco. Parte 1: contra o computador no tablet (pela tela de jogos, tocando nas cartas), pedir truco,
// recarregar e continuar, fim de jogo e "Jogar de novo"; fotos no celular (em pé, deitado, pequeno) em dupla.
// Parte 2: online um contra um (Ana no PC, Beto no celular): convite, cada um só vê as próprias cartas, carta jogada
// aparece para o outro, truco pedido e aceito, servidor recusa jogar fora da vez, recarregar continua, mão termina e marca.
// Parte 3: mesa de 4 online: Beto entra pelo link, Ana começa e o computador joga nas 2 vagas.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/truco';
const URL = process.env.URL || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
const letras = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
const CEL = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function abrir(opc, nome) {
  const ctx = await b.newContext(opc);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push('console: ' + m.text()); });
  const toque = !!opc.hasTouch;
  const j = { p, erros, nome, ctx, clica: (sel) => (toque ? p.tap(sel) : p.click(sel)), foto: async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${SAIDA}/${n}.png` }); } };
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  if (nome) {
    await j.clica('#bt-criar-conta');
    await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
    if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
    if (!(await p.inputValue('#c-nasc .d-ano'))) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '2000'); } // no site no ar a data não vem preenchida
    await j.clica('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  }
  return j;
}
// espera a minha vez de jogar carta; se pedirem truco para mim ou cair mão de onze, aceita/joga (pelos botões)
async function minhaVez(j) {
  const fim = Date.now() + 25000;
  while (Date.now() < fim) {
    const s = await j.p.evaluate(() => { const v = window.__truco.v, eu = window.__truco.eu, T = window.__truco.T; if (!v || v.fim) return 'nada'; if (v.onze && v.onze.time === T.time(eu)) return 'onze'; if (v.aposta && T.time(v.aposta.lugar) !== T.time(eu)) return 'aposta'; if (!v.aposta && !v.onze && v.vez === eu && document.querySelector('#t-minhas.pode')) return 'vez'; return 'nada'; });
    if (s === 'vez') return;
    if (s === 'onze' || s === 'aposta') await j.clica('#t-acoes .verde').catch(() => {});
    await j.p.waitForTimeout(300);
  }
  throw new Error('não chegou a vez de ' + (j.nome || 'local'));
}
const cabe = (j, sels) => j.p.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1); }).map((e) => e.id || e.className), sels);

// ---------- parte 1: contra o computador ----------
{
  const t = await abrir({ ...devices['Galaxy Tab S4 landscape'] }, 'ttab' + letras());
  await t.clica('.jogo[data-jogo=truco]');
  await t.p.waitForURL(/truco/); await t.p.waitForSelector('#x-menu:not([hidden])');
  ok(true, 'tablet: cartão Truco abre a página do truco');
  await t.foto('1-tablet-menu');
  await t.clica('.qtd[data-n="2"]'); await t.clica('#bt-computador');
  await t.p.waitForSelector('#t-jogo:not([hidden])');
  ok(await t.p.locator('#t-minhas .minha').count() === 3, 'tablet: recebeu 3 cartas');
  ok(await t.p.evaluate(() => { const v = window.__truco.v; return v.vira && v.manilha === window.__truco.T.manilhaDe(v.vira); }), 'tablet: vira na mesa e a manilha é a carta seguinte');
  await minhaVez(t);
  await t.foto('2-tablet-mesa');
  // pede truco: o computador responde (aceita, corre ou aumenta)
  const antes = await t.p.evaluate(() => window.__truco.e.seq);
  await t.clica('#t-acoes .grito');
  await t.p.waitForFunction(() => /TRUCO|Aceito|correu|SEIS/i.test(document.querySelector('#t-fala').textContent) && window.__truco.e.eventos.some((x) => x.t === 'pediu' && x.lugar === 0), null, { timeout: 3000 }).then(() => ok(true, 'tablet: pediu truco e a fala aparece'), () => ok(false, 'tablet: pediu truco e a fala aparece'));
  await t.p.waitForFunction((s) => { const e = window.__truco.e; return !e.mao.aposta && e.seq > s + 1; }, antes, { timeout: 10000 });
  const resp = await t.p.evaluate(() => window.__truco.e.eventos.slice(-4).map((x) => x.t));
  ok(resp.some((x) => ['aceitou', 'correu', 'pediu'].includes(x)), 'tablet: o computador respondeu o truco (' + resp + ')');
  if (await t.p.evaluate(() => window.__truco.v.aposta)) { await t.clica('#t-acoes .verde'); } // computador pediu seis: aceita
  // joga uma carta tocando
  await minhaVez(t);
  const n0 = await t.p.locator('#t-minhas .minha').count();
  await t.clica('#t-minhas .minha');
  await t.p.waitForFunction((n) => document.querySelectorAll('#t-minhas .minha').length === n - 1 || window.__truco.e.mao.vazas.length === 0, n0, { timeout: 5000 });
  ok(true, 'tablet: tocar na carta joga ela na mesa');
  await t.foto('3-tablet-jogou');
  await t.p.waitForTimeout(2500);
  await t.p.reload(); await t.p.waitForSelector('#x-menu:not([hidden])');
  ok(await t.p.isVisible('#bt-continuar'), 'tablet: depois de recarregar aparece "Continuar a partida"');
  const pontos = await t.p.evaluate(() => JSON.parse(localStorage.getItem('pradaria.truco')).e.pontos.join());
  await t.clica('#bt-continuar');
  ok(await t.p.evaluate(() => window.__truco.e.pontos.join()) === pontos, 'tablet: a partida continuou com o mesmo placar (' + pontos + ')');
  // termina o jogo (o computador joga pelos dois) e confere a janela do fim
  await t.p.evaluate(() => { const { e, T } = window.__truco; for (let i = 0; i < 5000 && !e.fim; i++) { const l = T.quemAge(e)[0]; T.agir(e, l, T.robo(e, l)); } window.__truco.atualizar(); });
  await t.p.waitForSelector('#x-fim:not([hidden])', { timeout: 5000 });
  const fim = await t.p.evaluate(() => window.__truco.e.pontos);
  ok(Math.max(...fim) >= 12 && /Você (ganhou|perdeu)/.test(await t.p.textContent('#fim-titulo')), 'tablet: fim de jogo com 12 pontos (' + fim + ')');
  await t.foto('4-tablet-fim');
  await t.clica('#bt-revanche');
  await t.p.waitForFunction(() => !window.__truco.e.fim && window.__truco.e.pontos.join() === '0,0', null, { timeout: 5000 });
  ok(await t.p.isHidden('#x-fim'), 'tablet: "Jogar de novo" começa outra partida do zero');
  ok(t.erros.length === 0, 'tablet: sem erros no console ' + t.erros.join(' | ').slice(0, 300));
  await t.ctx.close();
  for (const [n, opc] of [['cel-retrato', CEL], ['cel-deitado', { ...CEL, viewport: { width: 740, height: 360 } }], ['cel-pequeno', { ...CEL, viewport: { width: 320, height: 568 } }]]) {
    const c = await abrir(opc, null);
    await c.p.goto(URL + '/truco'); await c.p.waitForSelector('#x-menu:not([hidden])');
    await c.foto(`5-${n}-menu`);
    await c.clica('.qtd[data-n="4"]'); await c.clica('#bt-computador'); await c.p.waitForSelector('#t-jogo:not([hidden])');
    ok(await c.p.locator('.t-lugar:not([hidden])').count() === 3, `${n}: em dupla aparecem os outros 3 lugares`);
    await minhaVez(c);
    const fora = await cabe(c, '#t-jogo button, #t-minhas .carta, #t-vira, #t-placar, .t-lugar:not([hidden])');
    ok(!fora.length, `${n}: mesa, cartas e botões cabem na tela (${fora.slice(0, 4)})`);
    await c.foto(`6-${n}-jogo`);
    await c.clica('#t-minhas .minha');
    await c.p.waitForFunction(() => window.__truco.e.mao.mesa.some((j) => j.lugar === 0) || window.__truco.e.mao.vazas.length > 0, null, { timeout: 5000 });
    ok(true, `${n}: tocar na carta joga`);
    ok(c.erros.length === 0, `${n}: sem erros no console ` + c.erros.join(' | ').slice(0, 200));
    await c.ctx.close();
  }
}

// ---------- parte 2: online um contra um ----------
const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'tana' + letras());
const beto = await abrir(CEL, 'tbeto' + letras());
for (const [x, y] of [[ana, beto], [beto, ana]]) await x.p.evaluate(async (n) => { const t = localStorage.getItem('pradaria.token'); await fetch('/api/amigos/pedir', { method: 'POST', headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify({ nome: n }) }); }, y.nome);
await ana.clica('.jogo[data-jogo=truco]'); await ana.p.waitForURL(/truco/);
await ana.p.waitForSelector('#x-menu:not([hidden])');
await ana.clica('.qtd[data-n="2"]'); await ana.clica('#bt-amigo');
await ana.p.waitForSelector('#amigos:not([hidden]) .chamar', { timeout: 10000 });
await ana.clica('#amigos-lista .chamar');
await beto.p.waitForSelector('#convite:not([hidden])', { timeout: 10000 });
ok(/Truco/.test(await beto.p.textContent('#convite-txt')), 'Beto recebe "chamou você para jogar Truco"');
await beto.clica('#convite-sim');
await beto.p.waitForURL(/truco\?sala=/);
await beto.p.waitForSelector('#t-jogo:not([hidden])', { timeout: 15000 });
await ana.p.waitForSelector('#t-jogo:not([hidden])', { timeout: 15000 });
if (await ana.p.isVisible('#amigos')) await ana.clica('#amigos-fechar');
ok(true, 'os dois estão na mesa');
const ve = (j) => j.p.evaluate(() => window.__truco.v);
let va = await ve(ana), vb = await ve(beto);
ok(va.minhas.length === 3 && vb.minhas.length === 3 && !va.minhas.some((c) => vb.minhas.includes(c)), 'cada um tem 3 cartas diferentes');
const segredo = await beto.p.evaluate((cs) => cs.some((c) => JSON.stringify(window.__truco.v).includes('"' + c + '"')), va.minhas);
ok(!segredo, 'Beto não recebe as cartas da Ana');
// quem é a vez?
const daVez = async () => { va = await ve(ana); return va.vez === (await ana.p.evaluate(() => window.__truco.eu)) ? ana : beto; };
let j1 = await daVez(), j2 = j1 === ana ? beto : ana;
// fora da vez o servidor recusa
const cartaJ2 = (await ve(j2)).minhas[0];
await j2.p.evaluate((c) => window.__truco.online.ws.send(JSON.stringify({ t: 'agir', a: { t: 'jogar', carta: c } })), cartaJ2);
await j2.p.waitForFunction(() => /vez/i.test(document.querySelector('#aviso').textContent), null, { timeout: 5000 }).then(() => ok(true, 'servidor recusa jogar fora da vez'), () => ok(false, 'servidor recusa jogar fora da vez'));
// truco pedido e aceito
await minhaVez(j1);
await j1.foto(j1 === ana ? '7-ana-vez' : '7-beto-vez');
await j1.clica('#t-acoes .grito');
await j2.p.waitForFunction(() => /Aceita\?/.test(document.querySelector('#t-status').textContent), null, { timeout: 8000 });
ok(true, (j2 === ana ? 'Ana' : 'Beto') + ' vê "Pediram truco! Aceita?"');
await j2.foto(j2 === ana ? '8-ana-pediram-truco' : '8-beto-pediram-truco');
await j2.clica('#t-acoes .verde');
await j1.p.waitForFunction(() => window.__truco.v.valor === 3 && !window.__truco.v.aposta, null, { timeout: 8000 });
ok((await ve(j2)).valor === 3, 'truco aceito: a mão vale 3 para os dois');
// joga uma carta: aparece na mesa do outro
await minhaVez(j1);
const carta = (await ve(j1)).minhas[0];
await j1.clica(`#t-minhas .minha[data-c="${carta}"]`);
await j2.p.waitForFunction((c) => window.__truco.v.mesa.some((x) => x.carta === c), carta, { timeout: 8000 });
ok(true, 'a carta jogada aparece na mesa do outro');
// Beto recarrega e continua
await beto.p.reload();
await beto.p.waitForFunction(() => window.__truco && window.__truco.v && window.__truco.online && window.__truco.online.comecou, null, { timeout: 15000 });
ok(await beto.p.evaluate((c) => window.__truco.v.mesa.some((x) => x.carta === c) || window.__truco.v.vazas.length > 0, carta), 'Beto recarregou e a mesa continuou igual');
// jogam até a mão acabar (quem tiver a vez joga a primeira carta)
const total0 = (await ve(ana)).pontos.reduce((a, x) => a + x, 0);
for (let i = 0; i < 12; i++) {
  const v = await ve(ana);
  if (v.pontos.reduce((a, x) => a + x, 0) > total0) break;
  const j = v.vez === (await ana.p.evaluate(() => window.__truco.eu)) ? ana : beto;
  try { await minhaVez(j); } catch { continue; }
  await j.clica('#t-minhas .minha');
  await j.p.waitForTimeout(1900);
}
va = await ve(ana); vb = await ve(beto);
ok(va.pontos.reduce((a, x) => a + x, 0) === total0 + 3 && va.pontos.join() === [...vb.pontos].join(), 'a mão acabou e marcou 3 pontos igual para os dois (' + va.pontos + ')');
await ana.foto('9-ana-placar');
ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));

// ---------- parte 3: mesa de 4 com o computador nas vagas ----------
await ana.p.goto(URL + '/truco'); await ana.p.waitForSelector('#x-menu:not([hidden])');
await ana.clica('.qtd[data-n="4"]'); await ana.clica('#bt-amigo');
await ana.p.waitForSelector('#t-espera:not([hidden])');
await ana.p.waitForSelector('#amigos:not([hidden])', { timeout: 5000 }).then(() => ana.clica('#amigos-fechar'), () => {});
await ana.p.waitForFunction(() => window.__truco.online && window.__truco.online.dono, null, { timeout: 10000 });
const cod = await ana.p.evaluate(() => window.__truco.online.codigo);
await beto.p.goto(URL + '/truco?sala=' + cod);
await ana.p.waitForFunction(() => document.querySelectorAll('#espera-lista .espera-lugar.tem').length === 2, null, { timeout: 10000 });
ok(await ana.p.isVisible('#bt-comecar') && !(await beto.p.isVisible('#bt-comecar')), 'mesa de 4: só quem criou vê "Começar"');
await ana.foto('10-ana-espera-4');
await ana.clica('#bt-comecar');
await beto.p.waitForSelector('#t-jogo:not([hidden])', { timeout: 10000 });
const outros = await beto.p.evaluate(() => document.querySelectorAll('.t-lugar:not([hidden])').length);
ok(outros === 3, 'mesa de 4: cada um vê os outros 3 lugares');
// joga até alguém do computador jogar uma carta no servidor
let roboJogou = false;
for (let i = 0; i < 10 && !roboJogou; i++) {
  const v = await ve(ana);
  roboJogou = v.eventos.some((x) => ['jogou', 'pediu', 'aceitou', 'correu'].includes(x.t) && x.lugar >= 2) || v.mesa.some((x) => x.lugar >= 2) || v.vazas.length > 0;
  if (roboJogou) break;
  const eus = [[ana, await ana.p.evaluate(() => window.__truco.eu)], [beto, await beto.p.evaluate(() => window.__truco.eu)]];
  const ag = eus.find(([, l]) => v.vez === l && !v.aposta && !v.onze);
  if (ag) { try { await minhaVez(ag[0]); await ag[0].clica('#t-minhas .minha'); } catch {} }
  await ana.p.waitForTimeout(2000);
}
ok(roboJogou, 'mesa de 4: o computador joga nas vagas');
// segue a mão: quem for humano responde/joga pela tela; o computador tem que jogar uma carta no servidor
let cartaRobo = false;
for (let i = 0; i < 20 && !cartaRobo; i++) {
  const v = await ve(ana);
  cartaRobo = v.eventos.some((x) => x.t === 'jogou' && x.lugar >= 2) || v.vazas.length > 0;
  if (cartaRobo || v.fim) break;
  for (const j of [ana, beto]) {
    const s = await j.p.evaluate(() => { const v = window.__truco.v, eu = window.__truco.eu, T = window.__truco.T; if (v.onze && v.onze.time === T.time(eu)) return 'r'; if (v.aposta && T.time(v.aposta.lugar) !== T.time(eu) && v.age.includes(eu)) return 'r'; if (!v.aposta && !v.onze && v.vez === eu && document.querySelector('#t-minhas.pode')) return 'j'; return ''; });
    if (s === 'r') await j.clica('#t-acoes .verde').catch(() => {});
    if (s === 'j') await j.clica('#t-minhas .minha').catch(() => {});
  }
  await ana.p.waitForTimeout(1500);
}
ok(cartaRobo, 'mesa de 4: o computador joga carta na mesa');
await beto.foto('11-beto-mesa-4');
ok(ana.erros.length === 0 && beto.erros.length === 0, 'mesa de 4: sem erros no console ' + [...ana.erros, ...beto.erros].join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

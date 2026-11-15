// Teste real da Dama. Parte 1: contra o computador no tablet (pela tela de jogos, tocando nas casas) e fotos no celular.
// Parte 2: online com 2 jogadores (Ana no PC, Beto no celular): convite, captura obrigatória (não deixa fazer outro lance),
// comer e ser comido, servidor recusa lance errado, recarregar continua, desistir e revanche trocando as cores.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/dama';
const URL = process.env.URL || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
const letras = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
const CEL = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const casa = (n) => (8 - +n[1]) * 8 + 'abcdefgh'.indexOf(n[0]);

async function abrir(opc, nome) {
  const ctx = await b.newContext(opc);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push('console: ' + m.text()); });
  const toque = !!opc.hasTouch;
  const j = { p, erros, nome, ctx, clica: (sel) => (toque ? p.tap(sel) : p.click(sel)), foto: async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${SAIDA}/${n}.png` }); } };
  j.lance = async (de, para) => { await j.clica(`.casa[data-i="${casa(de)}"]`); await j.clica(`.casa[data-i="${casa(para)}"]`); };
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  if (nome) {
    await j.clica('#bt-criar-conta');
    await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
    if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
    await j.clica('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  }
  return j;
}

// ---------- parte 1: contra o computador ----------
{
  const t = await abrir({ ...devices['Galaxy Tab S4 landscape'] }, 'dtab' + letras());
  await t.clica('.jogo[data-jogo=dama]');
  await t.p.waitForURL(/dama/); await t.p.waitForSelector('#x-menu:not([hidden])');
  ok(true, 'tablet: cartão Dama abre a página da dama');
  await t.foto('1-tablet-menu');
  await t.clica('.nivel[data-nivel="1"]'); await t.clica('#bt-computador');
  await t.p.waitForSelector('#x-jogo:not([hidden])');
  ok(await t.p.evaluate(() => window.__dama.e.b.filter(Boolean).length) === 24, 'tablet: 24 peças no começo');
  await t.clica(`.casa[data-i="${casa('c3')}"]`);
  const pontos = await t.p.$$eval('.casa.pode', (l) => l.map((e) => +e.dataset.i).sort());
  ok(pontos.join() === [casa('b4'), casa('d4')].sort().join(), 'tablet: tocar na peça mostra as 2 casas para a frente');
  await t.foto('2-tablet-selecionado');
  await t.clica(`.casa[data-i="${casa('d4')}"]`);
  await t.p.waitForFunction(() => /^(Sua vez|Tem que comer)/.test(document.querySelector('#x-status').textContent) && window.__dama.e.n === 2, null, { timeout: 15000 });
  ok(true, 'tablet: o computador respondeu e voltou a ser a sua vez');
  await t.foto('3-tablet-jogando');
  await t.p.reload(); await t.p.waitForSelector('#x-menu:not([hidden])');
  ok(await t.p.isVisible('#bt-continuar'), 'tablet: depois de recarregar aparece "Continuar a partida"');
  await t.clica('#bt-continuar');
  ok(await t.p.evaluate(() => window.__dama && window.__dama.e.n === 2), 'tablet: a partida continuou do mesmo lance');
  ok(t.erros.length === 0, 'tablet: sem erros no console ' + t.erros.join(' | ').slice(0, 300));
  await t.ctx.close();
  for (const [n, opc] of [['cel-retrato', CEL], ['cel-deitado', { ...CEL, viewport: { width: 740, height: 360 } }], ['cel-pequeno', { ...CEL, viewport: { width: 320, height: 568 } }]]) {
    const c = await abrir(opc, null);
    await c.p.goto(URL + '/dama'); await c.p.waitForSelector('#x-menu:not([hidden])');
    await c.foto(`4-${n}-menu`);
    await c.clica('#bt-computador'); await c.p.waitForSelector('#x-jogo:not([hidden])');
    await c.lance('e3', 'f4');
    await c.p.waitForFunction(() => /^(Sua vez|Tem que comer)/.test(document.querySelector('#x-status').textContent) && window.__dama.e.n === 2, null, { timeout: 15000 });
    const fora = await c.p.evaluate(() => [...document.querySelectorAll('#x-jogo button, #tabuleiro, #x-status')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1); }).map((e) => e.id || e.className));
    ok(!fora.length, `${n}: tabuleiro e botões cabem na tela (${fora.slice(0, 4)})`);
    await c.foto(`5-${n}-jogo`);
    ok(c.erros.length === 0, `${n}: sem erros no console ` + c.erros.join(' | ').slice(0, 200));
    await c.ctx.close();
  }
}

// ---------- parte 2: online com um amigo ----------
const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'dana' + letras());
const beto = await abrir(CEL, 'dbeto' + letras());
// ficam amigos pela API (a tela de amigos tem teste próprio)
await ana.p.evaluate(async (n) => { const t = localStorage.getItem('pradaria.token'); await fetch('/api/amigos/pedir', { method: 'POST', headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify({ nome: n }) }); }, beto.nome);
await beto.p.evaluate(async (n) => { const t = localStorage.getItem('pradaria.token'); await fetch('/api/amigos/pedir', { method: 'POST', headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify({ nome: n }) }); }, ana.nome);
await ana.clica('.jogo[data-jogo=dama]'); await ana.p.waitForURL(/dama/);
await ana.p.waitForSelector('#x-menu:not([hidden])');
await ana.clica('#bt-amigo');
await ana.p.waitForSelector('#amigos:not([hidden]) .chamar', { timeout: 10000 });
await ana.clica('#amigos-lista .chamar');
await beto.p.waitForSelector('#convite:not([hidden])', { timeout: 10000 });
ok(/Dama/.test(await beto.p.textContent('#convite-txt')), 'Beto recebe "chamou você para jogar Dama"');
await beto.clica('#convite-sim');
await beto.p.waitForURL(/dama\?sala=/);
await beto.p.waitForFunction(() => window.__dama && window.__dama.online && window.__dama.online.jogadores && window.__dama.online.jogadores.b, null, { timeout: 15000 });
ok(await beto.p.evaluate(() => window.__dama.voce) === 'b', 'Beto entrou de vermelhas');
await ana.p.evaluate(() => document.querySelector('#amigos-fechar').click());
const espera = (j, c) => j.p.waitForFunction((c) => window.__dama.e.vez === c, c, { timeout: 10000 });
const chegou = (j, n) => j.p.waitForFunction((n) => window.__dama.e.n === n.n && window.__dama.e.vez === n.vez, n, { timeout: 10000 });
await espera(ana, 'w'); await ana.lance('c3', 'd4'); await chegou(beto, { n: 1, vez: 'b' });
await espera(beto, 'b'); await beto.lance('f6', 'e5'); await chegou(ana, { n: 2, vez: 'w' });
ok(/Tem que comer/.test(await ana.p.textContent('#x-status')), 'Ana vê "Tem que comer!"');
await ana.clica(`.casa[data-i="${casa('a3')}"]`);
ok(await ana.p.locator('.casa.pode').count() === 0, 'captura obrigatória: outra peça não pode andar');
await ana.p.waitForFunction(() => /comer com outra peça/.test(document.querySelector('#aviso').textContent), null, { timeout: 3000 }).then(() => ok(true, 'aviso "tem que comer com outra peça"'), () => ok(false, 'aviso "tem que comer com outra peça"'));
// servidor recusa lance que não vale mandado direto
await ana.p.evaluate((c) => window.__dama.online.ws.send(JSON.stringify({ t: 'lance', caminho: [c, c - 7] })), casa('a3'));
await ana.p.waitForFunction(() => /não vale/.test(document.querySelector('#aviso').textContent), null, { timeout: 5000 }).then(() => ok(true, 'servidor recusa lance sem comer'), () => ok(false, 'servidor recusa lance sem comer'));
await ana.clica(`.casa[data-i="${casa('d4')}"]`);
await ana.foto('6-ana-tem-que-comer');
await ana.clica(`.casa[data-i="${casa('f6')}"]`);
await chegou(beto, { n: 2, vez: 'b' });
ok(await beto.p.evaluate(() => window.__dama.e.b.filter((x) => x === 'b').length) === 11, 'Ana comeu: Beto ficou com 11 peças');
await beto.p.reload();
await beto.p.waitForFunction(() => window.__dama && window.__dama.e.n === 2 && window.__dama.e.vez === 'b', null, { timeout: 15000 });
ok(true, 'Beto recarregou e a partida continuou');
await beto.lance('g7', 'e5'); await chegou(ana, { n: 3, vez: 'w' });
ok(await ana.p.evaluate(() => window.__dama.e.b.filter((x) => x === 'w').length) === 11, 'Beto comeu de volta: Ana com 11 peças');
await beto.foto('7-beto-comeu');
await ana.clica('#bt-desistir'); await ana.clica('#bt-desistir');
await beto.p.waitForSelector('#x-fim:not([hidden])', { timeout: 10000 });
ok((await beto.p.textContent('#fim-titulo')) === 'Você ganhou!' && /desistiu/.test(await beto.p.textContent('#fim-txt')), 'Ana desistiu: Beto ganhou');
await beto.foto('8-beto-ganhou');
await beto.clica('#bt-revanche'); await ana.p.waitForSelector('#x-fim:not([hidden])'); await ana.clica('#bt-revanche');
await ana.p.waitForFunction(() => window.__dama.voce === 'b' && !window.__dama.fim && window.__dama.e.n === 1, null, { timeout: 8000 });
ok(true, 'revanche: partida nova com as cores trocadas');
ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

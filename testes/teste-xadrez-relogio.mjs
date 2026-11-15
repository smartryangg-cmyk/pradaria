// Teste real do relógio, da lista de lances e do pré-lance do xadrez.
// Parte 1: contra o computador no tablet: pré-lance feito enquanto o computador pensa sai sozinho; lista de lances.
// Parte 2: online Blitz 3+2 (Ana no PC, Beto no celular): os dois relógios começam em 3:00, só andam depois do
// primeiro lance das pretas, anda o de quem tem a vez e ganha 2 s a cada lance.
// Parte 3: ritmo curto de teste (8 s, só existe com TESTE=1 na sala local): o tempo da Ana acaba e o Beto ganha.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/xadrez-relogio';
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
    if (!(await p.inputValue('#c-nasc .d-ano'))) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '2000'); }
    await j.clica('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  }
  return j;
}
const relogios = (j) => j.p.$$eval('.relogio', (l) => Object.fromEntries(l.map((e) => [e.dataset.cor, { t: e.textContent, anda: e.classList.contains('anda') }])));
const esperaVez = (j, c) => j.p.waitForFunction((c) => window.__xadrez.e.vez === c, c, { timeout: 10000 });
const chegou = (j, n) => j.p.waitForFunction((n) => (window.__xadrez.e.hist || []).length === n, n, { timeout: 10000 });

// ---------- parte 1: pré-lance contra o computador ----------
{
  const t = await abrir({ ...devices['Galaxy Tab S4 landscape'] }, null);
  await t.p.goto(URL + '/xadrez'); await t.p.waitForSelector('#x-menu:not([hidden])');
  await t.clica('.nivel[data-nivel="3"]'); await t.clica('.cor-peca[data-cor="w"]'); await t.clica('#bt-computador');
  await t.p.waitForSelector('#x-jogo:not([hidden])');
  ok(/Os lances aparecem aqui/.test(await t.p.evaluate(() => getComputedStyle(document.querySelector('#x-lances'), '::before').content)), 'tablet: lista de lances vazia avisa onde eles aparecem');
  await t.p.evaluate(() => { window.__xadrez.demoraPC = 2500; });
  await t.lance('e2', 'e4');
  // enquanto o computador pensa, marca o pré-lance d2-d4
  await t.lance('d2', 'd4');
  await t.p.waitForFunction(() => (window.__xadrez.e.hist || []).length >= 3, null, { timeout: 20000 });
  const h = await t.p.evaluate(() => window.__xadrez.e.hist);
  ok(await t.p.evaluate(() => window.__xadrez.preFeitos) === 1 && h[2] === 'd4', 'tablet: pré-lance d4 feito enquanto o computador pensava saiu sozinho (' + h.join(' ') + ')');
  await t.p.waitForFunction(() => (window.__xadrez.e.hist || []).length >= 4, null, { timeout: 20000 });
  const txt = await t.p.textContent('#x-lances');
  ok(/^1\.e4.+2\.d4.+/.test(txt), 'tablet: lista mostra os lances numerados (' + txt + ')');
  await t.foto('1-tablet-lances');
  ok(t.erros.length === 0, 'tablet: sem erros no console ' + t.erros.join(' | ').slice(0, 300));
  await t.ctx.close();
}

// ---------- parte 2: Blitz 3+2 online ----------
const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'rana' + letras());
const beto = await abrir(CEL, 'rbeto' + letras());
async function partida(ritmoUI, ritmoTeste) {
  await ana.p.goto(URL + '/xadrez'); await ana.p.waitForSelector('#x-menu:not([hidden])');
  await ana.clica(`.ritmo[data-ritmo="${ritmoUI}"]`);
  if (ritmoTeste) await ana.p.evaluate((r) => { window.__xadrez.ritmo = r; }, ritmoTeste);
  await ana.clica('#bt-amigo');
  await ana.p.waitForFunction(() => window.__xadrez.online && window.__xadrez.online.jogadores, null, { timeout: 10000 });
  await ana.p.waitForSelector('#amigos:not([hidden])', { timeout: 5000 }).then(() => ana.clica('#amigos-fechar'), () => {});
  const cod = await ana.p.evaluate(() => window.__xadrez.online.codigo);
  await beto.p.goto(URL + '/xadrez?sala=' + cod);
  await beto.p.waitForFunction(() => window.__xadrez && window.__xadrez.voce === 'b' && window.__xadrez.online && window.__xadrez.online.jogadores, null, { timeout: 15000 });
  await ana.p.waitForFunction(() => window.__xadrez.online.jogadores && window.__xadrez.online.jogadores.b, null, { timeout: 10000 });
}
await partida('3+2');
ok(await ana.p.evaluate(() => document.querySelector('.ritmo.sel').dataset.ritmo) === '3+2', 'Ana escolheu Blitz 3+2 no menu');
let ra = await relogios(ana), rb = await relogios(beto);
ok(ra.w.t === '3:00' && ra.b.t === '3:00' && rb.w.t === '3:00' && rb.b.t === '3:00' && !ra.w.anda && !ra.b.anda, 'os dois veem 3:00 nos dois relógios, parados antes do primeiro lance');
await esperaVez(ana, 'w'); await ana.lance('e2', 'e4'); await chegou(beto, 1);
ok(!(await relogios(beto)).b.anda, 'depois do primeiro lance das brancas o relógio ainda não anda');
await esperaVez(beto, 'b'); await beto.lance('e7', 'e5'); await chegou(ana, 2);
await ana.p.waitForTimeout(1600);
ra = await relogios(ana);
ok(ra.w.anda && !ra.b.anda && /^2:5[789]$/.test(ra.w.t) && ra.b.t === '3:00', 'depois do e5 anda só o relógio da Ana (' + ra.w.t + ' x ' + ra.b.t + ')');
await ana.foto('2-ana-relogio-andando');
await ana.lance('g1', 'f3'); await chegou(beto, 3);
const srv = await beto.p.evaluate(() => window.__xadrez.relogio);
ok(srv.w > 178000 && srv.w <= 181000 && srv.anda === 'b', 'Ana jogou e ganhou 2 s: ficou com ' + (srv.w / 1000).toFixed(1) + ' s; agora anda o do Beto');
await beto.p.waitForTimeout(1200);
rb = await relogios(beto);
ok(rb.b.anda && rb.b.t !== '3:00', 'no celular do Beto o relógio dele anda (' + rb.b.t + ')');
await beto.foto('3-beto-celular-relogio');
const fora = await beto.p.evaluate(() => [...document.querySelectorAll('#x-jogo .relogio, #x-lances, #tabuleiro, #x-botoes .bt:not([hidden])')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1); }).map((e) => e.id || e.className));
ok(!fora.length, 'celular: relógios, lances, tabuleiro e botões cabem na tela (' + fora + ')');
ok(/1\.\s*e4\s*e5\s*2\.\s*Cf3/.test(await beto.p.textContent('#x-lances')), 'lista de lances do Beto: ' + await beto.p.textContent('#x-lances'));

// ---------- parte 3: o tempo acaba ----------
await partida('1+0', 'teste');
const curto = await ana.p.evaluate(() => window.__xadrez.relogio && window.__xadrez.relogio.base);
if (curto !== 8000 && !/localhost|127\.0\.0\.1/.test(URL)) ok(!curto, 'no site no ar o ritmo de teste não existe (partida sem relógio)');
else if (curto !== 8000) ok(false, 'sala local sem TESTE=1: rode a sala com --var TESTE:1 (base ' + curto + ')');
else {
  await esperaVez(ana, 'w'); await ana.lance('d2', 'd4'); await chegou(beto, 1);
  await esperaVez(beto, 'b'); await beto.lance('d7', 'd5'); await chegou(ana, 2);
  // a Ana não joga: o tempo dela acaba (o servidor decide sozinho pelo alarme)
  await beto.p.waitForSelector('#x-fim:not([hidden])', { timeout: 15000 });
  ok((await beto.p.textContent('#fim-titulo')) === 'Você ganhou!' && /tempo do seu amigo acabou/.test(await beto.p.textContent('#fim-txt')), 'Beto ganhou: "O tempo do seu amigo acabou."');
  await ana.p.waitForSelector('#x-fim:not([hidden])', { timeout: 5000 });
  ok((await ana.p.textContent('#fim-titulo')) === 'Você perdeu' && /Seu tempo acabou/.test(await ana.p.textContent('#fim-txt')), 'Ana perdeu: "Seu tempo acabou."');
  ok((await relogios(beto)).w.t === '0.0', 'o relógio da Ana parou em 0.0');
  await beto.foto('4-beto-ganhou-no-tempo');
  // depois do fim o servidor não aceita lance
  await ana.p.evaluate((c) => window.__xadrez.online.ws.send(JSON.stringify({ t: 'lance', de: c[0], para: c[1] })), [casa('g1'), casa('f3')]);
  await ana.p.waitForTimeout(800);
  ok((await beto.p.evaluate(() => window.__xadrez.e.hist.length)) === 2, 'depois do tempo acabar o servidor não aceita lance');
}
ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

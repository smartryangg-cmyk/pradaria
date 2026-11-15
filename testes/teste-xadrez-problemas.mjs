// Teste real dos problemas de xadrez (celular e tablet).
// 1. Todos os problemas: a resposta é um lance que vale, está entre os aceitos, e "dê xeque-mate" termina em mate.
// 2. Celular: menu mostra os pontos de problemas e os níveis do computador com pontos; abre um problema;
//    resolve certo (Certo!, pontos sobem); próximo; erra (aviso, volta a posição, pontos descem); ver a resposta.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
import * as X from '../public/js/xadrez-regras.js';
import { PROBLEMAS } from '../public/js/xadrez-problemas.js';
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/xadrez-problemas';
const URL = process.env.URL || 'http://localhost:8788';
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };

// ---------- 1. os problemas em si ----------
const pos = (p) => ({ b: p.b.split('').map((c) => (c === '.' ? '' : c)), vez: p.vez, roque: p.roque, ep: p.ep, meio: 0, n: 1, rep: {}, hist: [] });
let ruins = [];
for (const p of PROBLEMAS) {
  const e = pos(p);
  const m = X.lances(e).find((x) => X.notacao(e, x) === p.sol);
  const n = m && X.jogar(e, m);
  const mate = n && X.emXeque(n) && X.lances(n).length === 0;
  if (!m || !p.ok.includes(p.sol) || (p.tipo === 'mate1' && !mate) || !p.ok.every((t) => X.lances(e).some((x) => X.notacao(e, x) === t))) ruins.push(p.id);
}
ok(PROBLEMAS.length >= 100 && !ruins.length, `${PROBLEMAS.length} problemas, todos com resposta que vale (${ruins.join(',') || 'nenhum com defeito'})`);
ok(new Set(PROBLEMAS.map((p) => p.id)).size === PROBLEMAS.length, 'cada problema tem um id diferente');

// ---------- 2. na tela ----------
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [nomeAp, opc] of [['celular', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['tablet', { ...devices['Galaxy Tab S4 landscape'] }]]) {
  const ctx = await b.newContext(opc);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push('console: ' + m.text()); });
  const clica = (sel) => (opc.hasTouch ? p.tap(sel) : p.click(sel));
  const jogar = async (t) => {
    const [de, para] = await p.evaluate((t) => { const x = window.__xadrez; const m = x.X.lances(x.e).find((m) => x.X.notacao(x.e, m) === t); return [m.de, m.para]; }, t);
    await clica(`.casa[data-i="${de}"]`); await clica(`.casa[data-i="${para}"]`);
    if (await p.isVisible('#promo')) await clica('#promo-pecas button');
  };
  await p.goto(URL + '/xadrez'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForSelector('#x-menu:not([hidden])');
  ok(/Seus pontos de problemas: 800\? · 0 de 0 certos/.test(await p.textContent('#x-prob-pontos')), `${nomeAp}: menu mostra os pontos de problemas (${await p.textContent('#x-prob-pontos')})`);
  ok(/uns 400 pontos/.test(await p.textContent('.nivel[data-nivel="1"]')) && /uns 1200 pontos/.test(await p.textContent('.nivel[data-nivel="3"]')), `${nomeAp}: níveis do computador mostram os pontos aproximados`);
  if (nomeAp === 'celular') await p.screenshot({ path: `${SAIDA}/1-celular-menu.png` });
  await clica('#bt-problemas');
  await p.waitForSelector('#x-jogo:not([hidden])');
  // primeiro problema: resolve certo
  let pr = await p.evaluate(() => window.__xadrez.prob.p);
  const st = await p.textContent('#x-status');
  ok((pr.tipo === 'mate1' ? /dê xeque-mate/ : /ganhe material/).test(st) && await p.isVisible('#bt-prob-resposta') && await p.isHidden('#bt-desistir'), `${nomeAp}: problema ${pr.id} (nível ${pr.r}): "${st}", com "Ver a resposta"`);
  if (nomeAp === 'celular') await p.screenshot({ path: `${SAIDA}/2-celular-problema.png` });
  await jogar(pr.sol);
  await p.waitForFunction(() => /^Certo!/.test(document.querySelector('#x-status').textContent), null, { timeout: 5000 });
  const certo = await p.textContent('#x-status');
  ok(/Certo! \(\+\d+\)/.test(certo) && await p.isVisible('#bt-prob-prox'), `${nomeAp}: resposta certa: "${certo}" e aparece "Próximo problema"`);
  if (nomeAp === 'celular') await p.screenshot({ path: `${SAIDA}/3-celular-certo.png` });
  const depois1 = await p.evaluate(() => JSON.parse(localStorage.getItem('pradaria.xadrez.problemas')));
  ok(depois1.r > 800 && depois1.feitos === 1 && depois1.certos === 1, `${nomeAp}: pontos de problemas subiram para ${Math.round(depois1.r)}`);
  // próximo: erra de propósito
  await clica('#bt-prob-prox');
  await p.waitForFunction((id) => window.__xadrez.prob && window.__xadrez.prob.p.id !== id && !window.__xadrez.prob.resolvido, pr.id);
  pr = await p.evaluate(() => window.__xadrez.prob.p);
  const errado = await p.evaluate((okl) => { const x = window.__xadrez; return x.X.lances(x.e).map((m) => x.X.notacao(x.e, m)).find((t) => !okl.includes(t)); }, pr.ok);
  const b0 = await p.evaluate(() => window.__xadrez.e.b.join(','));
  await jogar(errado);
  await p.waitForFunction(() => /não resolve/.test(document.querySelector('#aviso').textContent), null, { timeout: 3000 });
  await p.waitForFunction((b0) => window.__xadrez.e.b.join(',') === b0 && !window.__xadrez.prob.voltando, b0, { timeout: 5000 });
  const depois2 = await p.evaluate(() => JSON.parse(localStorage.getItem('pradaria.xadrez.problemas')));
  ok(depois2.r < depois1.r && depois2.feitos === 2 && depois2.certos === 1, `${nomeAp}: lance errado (${errado}) avisa, volta a posição e os pontos descem (${Math.round(depois1.r)} → ${Math.round(depois2.r)})`);
  // ver a resposta (não conta de novo)
  await clica('#bt-prob-resposta');
  await p.waitForFunction(() => /^Resposta:/.test(document.querySelector('#x-status').textContent));
  const depois3 = await p.evaluate(() => JSON.parse(localStorage.getItem('pradaria.xadrez.problemas')));
  ok(await p.locator('.casa.resposta').count() === 2 && depois3.feitos === 2 && Math.round(depois3.r) === Math.round(depois2.r), `${nomeAp}: "Ver a resposta" mostra ${pr.sol} marcado e não desconta de novo`);
  if (nomeAp === 'celular') await p.screenshot({ path: `${SAIDA}/4-celular-resposta.png` });
  else await p.screenshot({ path: `${SAIDA}/5-tablet-resposta.png` });
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${nomeAp}: cabe na largura da tela`);
  await clica('#bt-sair');
  await p.waitForSelector('#x-menu:not([hidden])');
  ok(/1 de 2 certos/.test(await p.textContent('#x-prob-pontos')), `${nomeAp}: voltando ao menu: "${await p.textContent('#x-prob-pontos')}"`);
  ok(erros.length === 0, `${nomeAp}: sem erros no console ` + erros.join(' | ').slice(0, 300));
  await ctx.close();
}
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

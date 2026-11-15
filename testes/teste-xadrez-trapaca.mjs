// Teste real das regras contra trapaça nos pontos do xadrez (e do "pedir a vitória" quando o adversário some).
// Ana (PC) e Beto (celular). No servidor de teste a "internet" de cada um vem de ?rede= na página; no site publicado
// os dois saem mesmo do mesmo IP (então lá eles SÃO da mesma internet).
//  1. mesma internet: a busca não junta os dois;
//  2. mesma internet: partida com amigo "Valendo pontos" termina "anulada (mesma internet)" e os pontos não mudam;
//  3. (servidor de teste) desistir antes de 10 lances de cada lado: anulada;
//  4. (servidor de teste) só 3 partidas valendo pontos por dia entre as mesmas duas contas;
//  5. o adversário fecha a página: aparece "Adversário saiu", e depois do prazo o botão "Pedir a vitória" dá a vitória.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium } = pw;
const SAIDA = process.env.SAIDA || '/tmp/xadrez-trapaca';
const URL = process.env.URL || 'http://localhost:8788';
const NO_AR = !/localhost|127\.0\.0\.1/.test(URL);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
const letras = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
const CEL = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const casa = (n) => (8 - +n[1]) * 8 + 'abcdefgh'.indexOf(n[0]);

async function abrir(opc, nome, rede) {
  const ctx = await b.newContext(opc);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|WebSocket/.test(m.text())) erros.push('console: ' + m.text()); });
  const toque = !!opc.hasTouch;
  const j = { p, erros, nome, ctx, rede, clica: (sel) => (toque ? p.tap(sel) : p.click(sel)), foto: async (n) => { await j.p.waitForTimeout(300); await j.p.screenshot({ path: `${SAIDA}/${n}.png` }); } };
  j.lance = async (de, para) => { await j.clica(`.casa[data-i="${casa(de)}"]`); await j.clica(`.casa[data-i="${casa(para)}"]`); };
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  await j.clica('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  if (!(await p.inputValue('#c-nasc .d-ano'))) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '2000'); }
  await j.clica('#c-ok');
  await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  await menu(j);
  return j;
}
async function menu(j) { await j.p.goto(URL + '/xadrez?rede=' + j.rede); await j.p.waitForSelector('#x-menu:not([hidden])'); }
const pontos = (j) => j.p.evaluate(async () => (await (await fetch('/api/xadrez/pontos', { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).pontos);
const vez = (j, c) => j.p.waitForFunction((c) => window.__xadrez.e.vez === c && !window.__xadrez.fim, c, { timeout: 10000 });
// partida com amigo (Ana de brancas, Beto de pretas). comoAcaba: 'mate' (o Beto ganha), 'desistir' (Ana desiste no 2º lance) ou null
async function comAmigo(ana, beto, tipo, comoAcaba) {
  await menu(ana); await menu(beto);
  await ana.clica('.ritmo[data-ritmo="10+0"]'); await ana.clica(`.tipo-amigo[data-tipo=${tipo}]`); await ana.clica('#bt-amigo');
  await ana.p.waitForFunction(() => window.__xadrez.online && window.__xadrez.online.jogadores, null, { timeout: 10000 });
  await ana.p.waitForSelector('#amigos:not([hidden])', { timeout: 5000 }).then(() => ana.clica('#amigos-fechar'), () => {});
  const cod = await ana.p.evaluate(() => window.__xadrez.online.codigo);
  await beto.p.goto(URL + '/xadrez?sala=' + cod + '&rede=' + beto.rede);
  await beto.p.waitForFunction(() => window.__xadrez && window.__xadrez.voce === 'b' && window.__xadrez.online.jogadores && window.__xadrez.online.jogadores.w, null, { timeout: 15000 });
  if (comoAcaba === 'mate') {
    await vez(ana, 'w'); await ana.lance('f2', 'f3'); await vez(beto, 'b'); await beto.lance('e7', 'e5');
    await vez(ana, 'w'); await ana.lance('g2', 'g4'); await vez(beto, 'b'); await beto.lance('d8', 'h4');
  } else {
    await vez(ana, 'w'); await ana.lance('e2', 'e4'); await vez(beto, 'b'); await beto.lance('e7', 'e5');
    if (comoAcaba === 'desistir') { await vez(ana, 'w'); await ana.clica('#bt-desistir'); await ana.clica('#bt-desistir'); }
  }
  if (!comoAcaba) return;
  await beto.p.waitForSelector('#x-fim:not([hidden])', { timeout: 10000 });
  await beto.p.waitForFunction(() => { const t = document.querySelector('#fim-pontos').textContent; return t && !/Contando/.test(t); }, null, { timeout: 10000 });
  return beto.p.textContent('#fim-pontos');
}

const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'tana' + letras(), 'casa');
const beto = await abrir(CEL, 'tbeto' + letras(), 'casa');

// 1. mesma internet: a busca não junta
for (const j of [ana, beto]) { await j.clica('.ritmo[data-ritmo="1+0"]'); await j.clica('#bt-procurar'); }
await ana.p.waitForTimeout(7000);
ok(await ana.p.evaluate(() => !!window.__xadrez.busca && window.__xadrez.modo !== 'online') && await beto.p.evaluate(() => !!window.__xadrez.busca && window.__xadrez.modo !== 'online'), 'mesma internet: depois de 7 s a busca ainda não juntou os dois');
for (const j of [ana, beto]) await j.clica('#bt-busca-cancelar');

// 2. mesma internet: "Valendo pontos" com amigo não vale
const t2 = await comAmigo(ana, beto, 'pontos', 'mate');
ok(/mesma internet/.test(t2) && (await pontos(beto)).rapida.jogos === 0, 'mesma internet: partida "Valendo pontos" anulada, pontos iguais (' + t2 + ')');
await beto.foto('1-mesma-internet');

if (!NO_AR) {
  // daqui em diante cada um na sua internet
  beto.rede = 'outra';
  // 3. desistir antes de 10 lances de cada lado
  const t3 = await comAmigo(ana, beto, 'pontos', 'desistir');
  ok(/antes de 10 lances/.test(t3) && (await pontos(beto)).rapida.jogos === 0, 'desistir no 2º lance: anulada, pontos iguais (' + t3 + ')');
  // 4. só 3 por dia entre os dois
  for (let k = 1; k <= 3; k++) {
    const t = await comAmigo(ana, beto, 'pontos', 'mate');
    ok(/→/.test(t) && (await pontos(beto)).rapida.jogos === k, `partida ${k} valendo pontos entre os dois: conta (${t})`);
  }
  const t4 = await comAmigo(ana, beto, 'pontos', 'mate');
  ok(/já jogaram 3 partidas/.test(t4) && (await pontos(beto)).rapida.jogos === 3, '4ª partida do dia entre os dois: não vale (' + t4 + ')');
  await beto.foto('2-limite-do-dia');
}

// 5. o adversário some: pedir a vitória
await comAmigo(ana, beto, 'amistosa', null);
const prazo = await ana.p.evaluate(() => window.__xadrez.online.prazoFora);
await beto.p.close();
await ana.p.waitForFunction(() => /Adversário saiu/.test(document.querySelector('#x-status').textContent), null, { timeout: 10000 });
ok(await ana.p.isHidden('#bt-vitoria'), 'Beto fechou a página: Ana vê "' + await ana.p.textContent('#x-status') + '" e ainda não pode pedir a vitória');
await ana.p.waitForSelector('#bt-vitoria:not([hidden])', { timeout: prazo + 5000 });
ok(true, `depois de ${prazo / 1000} s aparece "Pedir a vitória"`);
await ana.foto('3-pedir-vitoria');
await ana.clica('#bt-vitoria');
await ana.p.waitForSelector('#x-fim:not([hidden])', { timeout: 10000 });
ok(/Você ganhou/.test(await ana.p.textContent('#fim-titulo')) && /adversário saiu/.test(await ana.p.textContent('#fim-txt')), 'Ana ganhou: "' + await ana.p.textContent('#fim-txt') + '"');
ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

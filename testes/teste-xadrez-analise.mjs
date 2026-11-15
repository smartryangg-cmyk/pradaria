// Teste real do perfil e da análise do xadrez.
// Parte 1 (tablet deitado, sem conta): partida contra o computador -> "Analisar a partida" -> cada lance ganha uma
//   classe, a precisão aparece, os botões andam pelos lances; a partida fica no perfil (guardada no aparelho).
// Parte 2 (Ana no PC, Beto no celular, com conta): partida com amigo valendo pontos, mate do louco. A análise da Ana
//   mostra o g4 como erro grave e o melhor lance; o perfil dos dois mostra a partida (servidor) com o resultado e os pontos.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/xadrez-analise';
const URL = process.env.URL || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
const letras = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
const CEL = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const casa = (n) => (8 - +n[1]) * 8 + 'abcdefgh'.indexOf(n[0]);

async function abrir(opc, nome, rede = '') {
  const ctx = await b.newContext(opc);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push('console: ' + m.text()); });
  const toque = !!opc.hasTouch;
  const j = { p, erros, nome, ctx, clica: (sel) => (toque ? p.tap(sel) : p.click(sel)), foto: async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${SAIDA}/${n}.png` }); } };
  j.lance = async (de, para) => { await j.clica(`#tabuleiro .casa[data-i="${casa(de)}"]`); await j.clica(`#tabuleiro .casa[data-i="${casa(para)}"]`); };
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  if (nome) {
    await j.clica('#bt-criar-conta');
    await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
    if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
    if (!(await p.inputValue('#c-nasc .d-ano'))) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '2000'); }
    await j.clica('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  }
  // (servidor de teste: cada conta na sua "internet", senão a partida valendo pontos é anulada)
  await p.goto(URL + '/xadrez' + (rede ? '?rede=' + rede : '')); await p.waitForSelector('#x-menu:not([hidden])');
  return j;
}
const analisada = (j) => j.p.waitForFunction(() => { const a = window.__xadrez.analise.estado; return a && a.res.length === a.lances.length; }, null, { timeout: 60000 });

// ---------- parte 1: contra o computador, sem conta ----------
{
  const t = await abrir({ ...devices['Galaxy Tab S4 landscape'] }, null);
  await t.clica('.nivel[data-nivel="1"]'); await t.clica('.cor-peca[data-cor="w"]'); await t.clica('#bt-computador');
  await t.p.waitForSelector('#x-jogo:not([hidden])');
  for (const [de, para] of [['e2', 'e4'], ['d2', 'd4'], ['g1', 'f3']]) {
    await t.p.waitForFunction(() => window.__xadrez.e.vez === 'w' && !window.__xadrez.fim, null, { timeout: 15000 });
    const pode = await t.p.evaluate(([de, para]) => !!window.__xadrez.X.achar(window.__xadrez.e, de, para), [casa(de), casa(para)]);
    if (pode) await t.lance(de, para); else await t.p.evaluate(() => { const x = window.__xadrez; const m = x.X.lances(x.e)[0]; x.fazer(m.de, m.para, 'Q'); });
  }
  await t.p.waitForFunction(() => window.__xadrez.e.vez === 'w', null, { timeout: 15000 });
  const nLances = await t.p.evaluate(() => window.__xadrez.e.hist.length);
  await t.clica('#bt-desistir'); await t.clica('#bt-desistir');
  await t.p.waitForSelector('#x-fim:not([hidden])');
  ok(await t.p.isVisible('#bt-analisar'), 'fim da partida: aparece "Analisar a partida"');
  await t.clica('#bt-analisar');
  await t.p.waitForSelector('#x-analise:not([hidden])');
  await analisada(t);
  const classes = await t.p.$$eval('#a-lances .lance', (ls) => ls.map((l) => [...l.classList].find((c) => c.startsWith('c-'))));
  ok(classes.length === nLances && classes.every(Boolean), `cada um dos ${nLances} lances ganhou uma classe (${classes.join(' ')})`);
  ok(/Precisão/.test(await t.p.textContent('#a-precisao')) && /Você\s*\d+%/.test(await t.p.textContent('#a-precisao')), 'aparece a precisão de cada um (' + (await t.p.textContent('#a-precisao')).replace(/\s+/g, ' ').slice(0, 120) + ')');
  // anda pelos lances
  await t.clica('#a-inicio');
  ok(await t.p.evaluate(() => window.__xadrez.analise.estado.k === 0) && /Começo/.test(await t.p.textContent('#a-nota-txt')) && await t.p.isDisabled('#a-ant'), 'começo: posição inicial, "Anterior" desligado');
  await t.clica('#a-prox');
  ok(await t.p.evaluate(() => window.__xadrez.analise.estado.k === 1) && /e4/.test(await t.p.textContent('#a-info')) && await t.p.locator('#a-tabuleiro .casa.ultimo').count() === 2, 'Próximo: mostra o 1º lance (e4) marcado no tabuleiro e a classe dele (' + await t.p.textContent('#a-info') + ')');
  await t.clica('#a-lances .lance[data-k="3"]');
  ok(await t.p.evaluate(() => window.__xadrez.analise.estado.k === 3), 'tocar num lance da lista vai direto para ele');
  await t.foto('1-tablet-analise');
  await t.clica('#a-voltar');
  ok(await t.p.isVisible('#x-fim') && await t.p.isHidden('#x-analise'), 'sair da análise volta para o fim da partida');
  await t.clica('#bt-menu-fim'); await t.clica('#bt-perfil');
  await t.p.waitForSelector('#x-perfil:not([hidden]) .partida-item');
  const item = await t.p.textContent('#perfil-lista .partida-item');
  ok(/Derrota/.test(item) && /Computador \(fácil\)/.test(item) && /Contra o computador/.test(item), 'perfil sem conta: a partida contra o computador aparece (' + item.replace(/\s+/g, ' ') + ')');
  await t.foto('2-tablet-perfil');
  await t.clica('#perfil-lista .partida-item');
  await t.p.waitForSelector('#x-analise:not([hidden])');
  ok(await t.p.evaluate((n) => window.__xadrez.analise.estado.lances.length === n, nLances), 'do perfil dá para analisar a partida de novo');
  await t.clica('#a-voltar');
  ok(await t.p.isVisible('#x-perfil'), 'sair da análise aberta pelo perfil volta para o perfil');
  ok(t.erros.length === 0, 'tablet: sem erros no console ' + t.erros.join(' | ').slice(0, 300));
}

// ---------- parte 2: online, com conta ----------
const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'aana' + letras(), 'a');
const beto = await abrir(CEL, 'abeto' + letras(), 'b');
await ana.clica('.ritmo[data-ritmo="10+0"]'); await ana.clica('.tipo-amigo[data-tipo=pontos]'); await ana.clica('#bt-amigo');
await ana.p.waitForFunction(() => window.__xadrez.online && window.__xadrez.online.jogadores, null, { timeout: 10000 });
await ana.p.waitForSelector('#amigos:not([hidden])', { timeout: 5000 }).then(() => ana.clica('#amigos-fechar'), () => {});
const cod = await ana.p.evaluate(() => window.__xadrez.online.codigo);
await beto.p.goto(URL + '/xadrez?sala=' + cod + '&rede=b');
await beto.p.waitForFunction(() => window.__xadrez && window.__xadrez.voce === 'b' && window.__xadrez.online.jogadores && window.__xadrez.online.jogadores.w, null, { timeout: 15000 });
const vez = (j, c) => j.p.waitForFunction((c) => window.__xadrez.e.vez === c && !window.__xadrez.fim, c, { timeout: 10000 });
await vez(ana, 'w'); await ana.lance('f2', 'f3');
await vez(beto, 'b'); await beto.lance('e7', 'e5');
await vez(ana, 'w'); await ana.lance('g2', 'g4');
await vez(beto, 'b'); await beto.lance('d8', 'h4');
for (const j of [ana, beto]) await j.p.waitForSelector('#x-fim:not([hidden])', { timeout: 10000 });
await ana.p.waitForFunction(() => /→/.test(document.querySelector('#fim-pontos').textContent), null, { timeout: 10000 });
await ana.clica('#bt-analisar');
await analisada(ana);
await ana.clica('#a-lances .lance[data-k="3"]');
const info = await ana.p.textContent('#a-info');
ok(/Erro grave/.test(info) && /Você jogou g4/.test(info) && /O melhor era/.test(info), 'Ana: g4 aparece como "Erro grave" com o melhor lance (' + info + ')');
ok(await ana.p.locator('#a-tabuleiro .casa.melhor').count() === 2, 'o melhor lance fica marcado no tabuleiro');
await ana.foto('3-pc-analise-erro-grave');
await beto.clica('#bt-analisar');
await analisada(beto);
const infoB = await beto.p.textContent('#a-info');
ok(/Melhor lance/.test(infoB) && /Dh4#/.test(infoB), 'Beto: o mate Dh4# é "Melhor lance" (' + infoB + ')');
ok(await beto.p.evaluate(() => { const r = document.querySelector('#x-analise').getBoundingClientRect(); const t = document.querySelector('#a-tabuleiro').getBoundingClientRect(); return t.right <= innerWidth + 1 && t.left >= -1 && document.documentElement.scrollWidth <= innerWidth + 1 && r.width <= innerWidth + 1; }), 'celular: a análise cabe na largura da tela');
await beto.foto('4-celular-analise-mate');
// perfil (servidor)
for (const [j, res, sinal] of [[ana, 'Derrota', '-'], [beto, 'Vitória', '+']]) {
  await j.clica('#a-voltar'); await j.clica('#bt-menu-fim'); await j.clica('#bt-perfil');
  await j.p.waitForSelector('#x-perfil:not([hidden]) .partida-item', { timeout: 10000 });
  const t = (await j.p.textContent('#perfil-lista .partida-item')).replace(/\s+/g, ' ');
  ok(t.includes(res) && /Rápida · valendo pontos/.test(t) && t.includes(sinal) && /2 lances/.test(t) && t.includes(j === ana ? beto.nome : ana.nome), `${j === ana ? 'Ana' : 'Beto'}: perfil mostra a partida online (${t})`);
  const pp = (await j.p.textContent('#perfil-pontos')).replace(/\s+/g, ' ');
  ok(/Rápida\s?1\d{3}\?/.test(pp) && (j === beto ? /1V 0D 0E/.test(pp) : /0V 1D 0E/.test(pp)), `${j === ana ? 'Ana' : 'Beto'}: pontos no perfil (${pp})`);
}
await beto.foto('5-celular-perfil');
await beto.clica('#perfil-lista .partida-item');
await beto.p.waitForSelector('#x-analise:not([hidden])');
ok(await beto.p.evaluate(() => window.__xadrez.analise.estado.lances.length === 4 && window.__xadrez.analise.estado.cor === 'b'), 'Beto analisa a partida a partir do perfil (de pretas)');
ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

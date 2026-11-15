// Teste real dos pontos do xadrez (rating que sobe e desce) e da busca de adversário.
// Ana (PC) e Beto (celular): os dois começam com 1200? (provisório), procuram Blitz e caem na mesma partida,
// quem ganha sobe e quem perde desce (tela do fim e API); partida com menos de 2 lances é anulada (não vale);
// partida com amigo "Valendo pontos" conta; "Amistosa" não; cancelar a busca sai da fila.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium } = pw;
const SAIDA = process.env.SAIDA || '/tmp/xadrez-pontos';
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
  await j.clica('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  if (!(await p.inputValue('#c-nasc .d-ano'))) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '2000'); }
  await j.clica('#c-ok');
  await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  await p.goto(URL + '/xadrez'); await p.waitForSelector('#x-menu:not([hidden])');
  return j;
}
const pontos = (j) => j.p.evaluate(async () => (await (await fetch('/api/xadrez/pontos', { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).pontos);
const vez = (j, c) => j.p.waitForFunction((c) => window.__xadrez.e.vez === c && !window.__xadrez.fim, c, { timeout: 10000 });
const cor = (j) => j.p.evaluate(() => window.__xadrez.voce);
async function menu(j) { await j.p.goto(URL + '/xadrez'); await j.p.waitForSelector('#x-menu:not([hidden])'); }
async function procurarOs2(ana, beto) {
  for (const j of [ana, beto]) { await j.clica('.ritmo[data-ritmo="3+2"]'); await j.clica('#bt-procurar'); }
  for (const j of [ana, beto]) await j.p.waitForFunction(() => window.__xadrez.modo === 'online' && window.__xadrez.online && window.__xadrez.online.jogadores && window.__xadrez.online.jogadores.w && window.__xadrez.online.jogadores.b, null, { timeout: 30000 });
  const ca = await cor(ana);
  return ca === 'w' ? [ana, beto] : [beto, ana];
}

const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'pana' + letras());
const beto = await abrir(CEL, 'pbeto' + letras());
await ana.clica('.ritmo[data-ritmo="3+2"]');
await ana.p.waitForFunction(() => /1200\?/.test(document.querySelector('#x-meus-pontos').textContent), null, { timeout: 8000 });
ok(/Seus pontos no Blitz: 1200\?/.test(await ana.p.textContent('#x-meus-pontos')), 'conta nova: "Seus pontos no Blitz: 1200?" (provisório)');
await ana.clica('.ritmo[data-ritmo=""]');
ok(await ana.p.isDisabled('#bt-procurar') && await ana.p.isDisabled('.tipo-amigo[data-tipo=pontos]'), 'sem relógio não dá para procurar nem jogar valendo pontos');
// cancelar a busca
await ana.clica('.ritmo[data-ritmo="1+0"]'); await ana.clica('#bt-procurar');
await ana.p.waitForSelector('#x-busca:not([hidden])');
await ana.foto('1-ana-procurando');
await ana.p.waitForTimeout(1200);
ok(/0:0[12]/.test(await ana.p.textContent('#busca-tempo')) && /Bullet 1 min/.test(await ana.p.textContent('#busca-txt')), 'procurando: mostra o ritmo e o tempo de espera');
await ana.clica('#bt-busca-cancelar');
ok(await ana.p.isHidden('#x-busca') && await ana.p.evaluate(() => !window.__xadrez.busca), 'cancelar sai da fila');

// ---------- partida valendo pontos pela busca ----------
let [w, p] = await procurarOs2(ana, beto);
ok(true, 'a busca juntou a Ana e o Beto na mesma partida (Blitz)');
ok(await w.p.textContent('#x-cima .pts') === ' 1200?' && await w.p.textContent('#x-baixo .pts') === ' 1200?', 'os pontos aparecem do lado dos nomes (1200?)');
ok(await w.p.evaluate(() => window.__xadrez.relogio && window.__xadrez.relogio.base === 180000 && window.__xadrez.online.ranqueada), 'partida da busca: Blitz com relógio e valendo pontos');
await beto.foto('2-beto-partida-pontos');
// mate do louco: as pretas ganham
await vez(w, 'w'); await w.lance('f2', 'f3');
await vez(p, 'b'); await p.lance('e7', 'e5');
await vez(w, 'w'); await w.lance('g2', 'g4');
await vez(p, 'b'); await p.lance('d8', 'h4');
for (const j of [w, p]) await j.p.waitForFunction(() => /→/.test(document.querySelector('#fim-pontos').textContent), null, { timeout: 10000 });
const tw = await w.p.textContent('#fim-pontos'), tp = await p.p.textContent('#fim-pontos');
ok(/1200 → 1\d{3}\? \(\+\d+\)/.test(tp) && /1200 → \d{3,4}\? \(-\d+\)/.test(tw), `fim: quem ganhou sobe (${tp}), quem perdeu desce (${tw})`);
await (p === beto ? beto : ana).foto('3-ganhou-pontos');
const pp = await pontos(p), pw2 = await pontos(w);
ok(pp.blitz.jogos === 1 && pp.blitz.v === 1 && pp.blitz.r > 1200 && pw2.blitz.d === 1 && pw2.blitz.r < 1200 && pp.bullet.jogos === 0, `API: Blitz do vencedor ${pp.blitz.r} (1 vitória), do perdedor ${pw2.blitz.r} (1 derrota); Bullet não mudou`);
const rVence = pp.blitz.r, rPerde = pw2.blitz.r;
await p.clica('#bt-menu-fim');
await p.p.waitForFunction((r) => document.querySelector('#x-meus-pontos').textContent.includes(String(r)), rVence, { timeout: 8000 });
ok(true, 'no menu os pontos novos aparecem (' + await p.p.textContent('#x-meus-pontos') + ')');

// ---------- anulada: desistir antes de 2 lances não vale ----------
await menu(ana); await menu(beto);
[w, p] = await procurarOs2(ana, beto);
await w.clica('#bt-desistir'); await w.clica('#bt-desistir');
for (const j of [w, p]) await j.p.waitForFunction(() => /anulada/.test(document.querySelector('#fim-pontos').textContent), null, { timeout: 10000 });
ok(true, 'desistir antes de 2 lances: "Partida anulada", não vale pontos');
const depoisAnulada = [(await pontos(ana)).blitz.r, (await pontos(beto)).blitz.r].sort().join();
ok(depoisAnulada === [rVence, rPerde].sort().join(), 'pontos iguais depois da anulada (' + depoisAnulada + ')');

// ---------- com amigo: valendo pontos conta, amistosa não ----------
async function comAmigo(tipo) {
  await menu(ana); await menu(beto);
  await ana.clica('.ritmo[data-ritmo="10+0"]'); await ana.clica(`.tipo-amigo[data-tipo=${tipo}]`); await ana.clica('#bt-amigo');
  await ana.p.waitForFunction(() => window.__xadrez.online && window.__xadrez.online.jogadores, null, { timeout: 10000 });
  await ana.p.waitForSelector('#amigos:not([hidden])', { timeout: 5000 }).then(() => ana.clica('#amigos-fechar'), () => {});
  const cod = await ana.p.evaluate(() => window.__xadrez.online.codigo);
  await beto.p.goto(URL + '/xadrez?sala=' + cod);
  await beto.p.waitForFunction(() => window.__xadrez && window.__xadrez.voce === 'b' && window.__xadrez.online.jogadores && window.__xadrez.online.jogadores.w, null, { timeout: 15000 });
  await vez(ana, 'w'); await ana.lance('e2', 'e4'); await vez(beto, 'b'); await beto.lance('e7', 'e5');
  await vez(ana, 'w'); await ana.clica('#bt-desistir'); await ana.clica('#bt-desistir');
  await beto.p.waitForSelector('#x-fim:not([hidden])', { timeout: 10000 });
  await beto.p.waitForTimeout(600);
  return beto.p.evaluate(() => window.__xadrez.online.ranqueada);
}
const antesR = (await pontos(beto)).rapida.jogos;
ok((await comAmigo('amistosa')) === false && (await pontos(beto)).rapida.jogos === antesR && await beto.p.isHidden('#fim-pontos'), 'com amigo "Amistosa": não mexe nos pontos');
ok((await comAmigo('pontos')) === true && (await pontos(beto)).rapida.jogos === antesR + 1 && /→/.test(await beto.p.textContent('#fim-pontos')), 'com amigo "Valendo pontos" (Rápida): conta pontos (' + await beto.p.textContent('#fim-pontos') + ')');
ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

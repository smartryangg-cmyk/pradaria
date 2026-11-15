// Teste real da Dama online como no xadrez: ritmos com relógio, pontos (rating) da dama separados dos do xadrez,
// busca de adversário (não junta quem procura xadrez com quem procura dama), partida valendo pontos,
// prazo do primeiro lance, lista de lances e "Pedir a vitória" quando o adversário sai.
// Ana (PC) e Beto (celular); Carla (tablet) procura xadrez ao mesmo tempo.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/dama-pontos';
const URL = process.env.URL || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
const letras = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
const CEL = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
// no site publicado cada conexão pode sair por um IP diferente e não dá para escolher a "internet": a busca é conferida só aqui
const NO_AR = !/localhost|127\.0\.0\.1/.test(URL);

async function abrir(opc, nome, rede) {
  const ctx = await b.newContext(opc);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push('console: ' + m.text()); });
  const toque = !!opc.hasTouch;
  const j = { p, erros, nome, ctx, rede, clica: (sel) => (toque ? p.tap(sel) : p.click(sel)), foto: async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${SAIDA}/${n}.png` }); } };
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
async function menu(j, pag = 'dama') { await j.p.goto(URL + '/' + pag + '?rede=' + j.rede); await j.p.waitForSelector('#x-menu:not([hidden])'); }
const pontos = (j, jogo = 'dama') => j.p.evaluate(async (jogo) => (await (await fetch('/api/xadrez/pontos' + (jogo === 'dama' ? '?jogo=dama' : ''), { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).pontos, jogo);
const cor = (j) => j.p.evaluate(() => window.__dama.voce);
const juntos = (j) => j.p.waitForFunction(() => window.__dama.modo === 'online' && window.__dama.online && window.__dama.online.jogadores && window.__dama.online.jogadores.w && window.__dama.online.jogadores.b, null, { timeout: 30000 });
// joga o primeiro lance que vale (pela mesma função da tela, que manda para o servidor), alternando, até n meio-lances
async function jogarAte(w, p, n) {
  for (let k = 0; k < 200; k++) {
    const st = await w.p.evaluate(() => ({ h: (window.__dama.e.hist || []).length, vez: window.__dama.e.vez, fim: !!window.__dama.fim }));
    if (st.fim || st.h >= n) return st.h;
    const j = st.vez === 'w' ? w : p;
    await j.p.waitForFunction((c) => window.__dama.e.vez === c && window.__dama.voce === c, st.vez, { timeout: 10000 });
    await j.p.evaluate(() => { const d = window.__dama, ls = d.X.lances(d.e); d.fazer(ls[0]); });
    await w.p.waitForFunction((h) => (window.__dama.e.hist || []).length > h || window.__dama.fim, st.h, { timeout: 10000 });
  }
}
// sai sem fechar: o cartão de amigos abre sozinho ao criar a partida
const fecharAmigos = (j) => j.p.waitForSelector('#amigos:not([hidden])', { timeout: 5000 }).then(() => j.clica('#amigos-fechar'), () => {});

const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'dana' + letras(), 'a');
const beto = await abrir(CEL, 'dbeto' + letras(), 'b');

// ---------- menu ----------
await ana.clica('.ritmo[data-ritmo="3+2"]');
await ana.p.waitForFunction(() => /1200\?/.test(document.querySelector('#x-meus-pontos').textContent), null, { timeout: 8000 });
ok(/Seus pontos de dama no Blitz: 1200\?/.test(await ana.p.textContent('#x-meus-pontos')), 'menu da dama: "Seus pontos de dama no Blitz: 1200?"');
await ana.clica('.ritmo[data-ritmo=""]');
ok(await ana.p.isDisabled('#bt-procurar') && await ana.p.isDisabled('.tipo-amigo[data-tipo=pontos]'), 'sem relógio: não procura nem joga valendo pontos');
await ana.clica('.ritmo[data-ritmo="3+2"]');
await beto.foto('1-celular-menu-dama');
ok(await beto.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'celular: o menu cabe na largura');

if (!NO_AR) {
  // ---------- quem procura xadrez não cai com quem procura dama ----------
  const carla = await abrir({ ...devices['Galaxy Tab S4 landscape'] }, 'dcarla' + letras(), 'c');
  await menu(carla, 'xadrez');
  await carla.clica('.ritmo[data-ritmo="3+2"]'); await carla.clica('#bt-procurar');
  await ana.clica('#bt-procurar');
  await ana.p.waitForSelector('#x-busca:not([hidden])');
  ok(/Dama Blitz 3 min \+2s/.test(await ana.p.textContent('#busca-txt')), 'procurando: "' + await ana.p.textContent('#busca-txt') + '"');
  await ana.foto('2-ana-procurando');
  await ana.p.waitForTimeout(5000);
  ok(await ana.p.evaluate(() => !!window.__dama.busca && window.__dama.modo !== 'online') && await carla.p.evaluate(() => !!window.__xadrez.busca), 'Ana (dama) e Carla (xadrez), mesmo ritmo: a busca não junta jogos diferentes');
  await carla.clica('#bt-busca-cancelar');
  ok(carla.erros.length === 0, 'Carla sem erros no console ' + carla.erros.join(' | ').slice(0, 300));
  await carla.ctx.close();

  // ---------- busca de dama: Beto entra e cai com a Ana ----------
  await beto.clica('.ritmo[data-ritmo="3+2"]'); await beto.clica('#bt-procurar');
  await juntos(ana); await juntos(beto);
  let [w, p] = (await cor(ana)) === 'w' ? [ana, beto] : [beto, ana];
  ok(true, 'a busca da dama juntou a Ana e o Beto');
  ok(await w.p.evaluate(() => window.__dama.relogio && window.__dama.relogio.base === 180000 && window.__dama.online.ranqueada), 'partida da busca: Blitz com relógio, valendo pontos');
  ok(await w.p.textContent('#x-cima .pts') === ' 1200?' && await w.p.textContent('#x-baixo .pts') === ' 1200?', 'os pontos aparecem do lado dos nomes (1200?)');
  await w.p.waitForFunction(() => /^Sua vez: \d+s$/.test(document.querySelector('#x-status').textContent), null, { timeout: 5000 });
  ok(/^Adversário: \d+s$/.test(await p.p.textContent('#x-status')), 'prazo do primeiro lance: "' + await w.p.textContent('#x-status') + '" / "' + await p.p.textContent('#x-status') + '"');
  await jogarAte(w, p, 4);
  await w.p.waitForTimeout(1500);
  const rel = await w.p.evaluate(() => ({ anda: window.__dama.relogio.anda, txt: [...document.querySelectorAll('.relogio')].map((e) => e.textContent) }));
  ok(rel.anda === 'w' && rel.txt.length === 2 && rel.txt.every((t) => /^\d:\d\d$/.test(t)), 'depois dos primeiros lances o relógio anda (' + rel.txt.join(' / ') + ')');
  ok(/1\.\s*\w\d[-x]\w\d/.test(await w.p.textContent('#x-lances')), 'lista de lances: "' + (await w.p.textContent('#x-lances')).slice(0, 40) + '"');
  await beto.foto('3-celular-dama-relogio');
  ok(await beto.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'celular: a partida com relógio cabe na largura');
  const h = await jogarAte(w, p, 20);
  // quem tem a vez desiste (com 20 meio-lances ou mais vale pontos)
  const st = await w.p.evaluate(() => ({ vez: window.__dama.e.vez, fim: window.__dama.fim }));
  const perde = st.fim ? null : st.vez === 'w' ? w : p, ganha = perde === w ? p : w;
  if (perde) { await perde.clica('#bt-desistir'); await perde.clica('#bt-desistir'); }
  for (const j of [w, p]) await j.p.waitForFunction(() => /→/.test(document.querySelector('#fim-pontos').textContent), null, { timeout: 10000 });
  const tg = await ganha.p.textContent('#fim-pontos'), tp = await perde.p.textContent('#fim-pontos');
  ok(/1200 → 1\d{3}\? \(\+\d+\)/.test(tg) && /1200 → \d{3,4}\? \(-\d+\)/.test(tp), `fim (${h} meio-lances, desistiu): quem ganhou sobe (${tg}), quem perdeu desce (${tp})`);
  await beto.foto('4-celular-dama-pontos');
  const pg = await pontos(ganha), pd = await pontos(perde), px = await pontos(ganha, 'xadrez');
  ok(pg['dama-blitz'].v === 1 && pg['dama-blitz'].r > 1200 && pd['dama-blitz'].d === 1 && pd['dama-blitz'].r < 1200 && px.blitz.jogos === 0, `API: dama Blitz ${pg['dama-blitz'].r} / ${pd['dama-blitz'].r}; os pontos do xadrez não mudaram`);

  // ---------- desistir antes de 10 lances de cada um: anulada ----------
  await menu(ana); await menu(beto);
  await ana.clica('#bt-procurar'); await beto.clica('#bt-procurar');
  await juntos(ana); await juntos(beto);
  [w, p] = (await cor(ana)) === 'w' ? [ana, beto] : [beto, ana];
  await jogarAte(w, p, 4);
  await w.clica('#bt-desistir'); await w.clica('#bt-desistir');
  for (const j of [w, p]) await j.p.waitForFunction(() => /anulada/.test(document.querySelector('#fim-pontos').textContent), null, { timeout: 10000 });
  ok(/antes de 10 lances/.test(await p.p.textContent('#fim-pontos')), 'desistir com 4 meio-lances: "' + await p.p.textContent('#fim-pontos') + '"');
  ok((await pontos(ana))['dama-blitz'].jogos === 1, 'a anulada não conta nos pontos');
}

// ---------- com amigo (amistosa, Rápida): o adversário sai e quem fica pede a vitória ----------
await menu(ana); await menu(beto);
await ana.clica('.ritmo[data-ritmo="10+0"]'); await ana.clica('.tipo-amigo[data-tipo=amistosa]'); await ana.clica('#bt-amigo');
await ana.p.waitForFunction(() => window.__dama.online && window.__dama.online.jogadores, null, { timeout: 10000 });
await fecharAmigos(ana);
const cod = await ana.p.evaluate(() => window.__dama.online.codigo);
await beto.p.goto(URL + '/dama?sala=' + cod + '&rede=' + beto.rede);
await juntos(beto); await juntos(ana);
ok(await ana.p.evaluate(() => window.__dama.relogio && window.__dama.relogio.base === 600000 && !window.__dama.online.ranqueada), 'com amigo: Rápida (10 min) com relógio, amistosa');
await jogarAte(ana, beto, 2);
await beto.p.goto('about:blank');
await ana.p.waitForFunction(() => /^Adversário saiu/.test(document.querySelector('#x-status').textContent), null, { timeout: 10000 });
ok(true, 'o Beto fechou a página: a Ana vê "' + await ana.p.textContent('#x-status') + '"');
const prazo = await ana.p.evaluate(() => window.__dama.online.prazoFora);
await ana.p.waitForSelector('#bt-vitoria:not([hidden])', { timeout: prazo + 8000 });
await ana.foto('5-pedir-vitoria');
await ana.clica('#bt-vitoria');
await ana.p.waitForSelector('#x-fim:not([hidden])', { timeout: 10000 });
ok(/Você ganhou/.test(await ana.p.textContent('#fim-titulo')) && /adversário saiu/.test(await ana.p.textContent('#fim-txt')), `depois de ${prazo / 1000} s aparece "Pedir a vitória" e a Ana ganha ("${await ana.p.textContent('#fim-txt')}")`);

ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

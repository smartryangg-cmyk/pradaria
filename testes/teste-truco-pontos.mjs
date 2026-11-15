// Teste real do Truco um contra um valendo pontos: pontos da conta no menu (1200?), busca de adversário que junta
// a Ana (PC) e o Beto (celular), pontos do adversário do lado do nome, quem ganha sobe e quem perde desce (tela e API),
// com amigo "Valendo pontos" conta e "Amistosa" não; em dupla não tem "valendo pontos".
// Para o jogo acabar rápido, a primeira mão sobe até doze (truco, seis, nove, doze) e quem ganhar a mão faz 12.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium } = pw;
const SAIDA = process.env.SAIDA || '/tmp/truco-pontos';
const URL = process.env.URL || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
const letras = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
const CEL = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
// no site publicado as conexões saem por IPs diferentes e a "internet" não dá para escolher: a busca é conferida só aqui
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
async function menu(j) { await j.p.goto(URL + '/truco?rede=' + j.rede); await j.p.waitForSelector('#x-menu:not([hidden])'); }
const pontos = (j) => j.p.evaluate(async () => (await (await fetch('/api/xadrez/pontos?jogo=truco', { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).pontos.truco);
const naMesa = (j) => j.p.waitForFunction(() => window.__truco && window.__truco.v && window.__truco.online && window.__truco.online.comecou, null, { timeout: 30000 });
// joga até o fim: sobe a aposta até doze e depois cada um joga a primeira carta
async function jogarAteOFim(x, y) {
  for (let k = 0; k < 400; k++) {
    const st = await x.p.evaluate(() => ({ fim: !!window.__truco.v.fim, age: window.__truco.v.age }));
    if (st.fim) return true;
    for (const j of [x, y]) {
      await j.p.evaluate(() => {
        const t = window.__truco, v = t.v;
        if (!v || v.fim || !v.age.includes(t.eu)) return;
        const meuTime = t.eu % 2;
        if (v.onze) t.agir({ t: 'onze', jogar: true });
        else if (v.aposta) t.agir({ t: v.aposta.valor < 12 ? 'aumentar' : 'aceitar' });
        else if (v.valor < 12 && v.subiu !== meuTime && !v.ferro && v.pontos[0] < 11 && v.pontos[1] < 11) t.agir({ t: 'truco' });
        else if (v.vez === t.eu && v.minhas.length) t.agir({ t: 'jogar', carta: v.minhas[0] });
      });
    }
    await x.p.waitForTimeout(250);
  }
  return false;
}

const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'pana' + letras(), 'a');
const beto = await abrir(CEL, 'pbeto' + letras(), 'b');

// ---------- menu ----------
await ana.p.waitForFunction(() => /1200\?/.test(document.querySelector('#x-meus-pontos').textContent), null, { timeout: 8000 });
ok(/Seus pontos no truco: 1200\?/.test(await ana.p.textContent('#x-meus-pontos')), 'menu: "Seus pontos no truco: 1200?"');
await ana.clica('.qtd[data-n="4"]');
ok(await ana.p.isHidden('#x-tipo-amigo'), 'em dupla não aparece "Valendo pontos"');
await ana.clica('.qtd[data-n="2"]');
ok(await ana.p.isVisible('#x-tipo-amigo'), 'um contra um: dá para escolher "Amistosa" ou "Valendo pontos"');
await beto.foto('1-celular-menu-truco');
ok(await beto.p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'celular: o menu cabe na largura');

let rG = 0, rP = 0, jogosAntes = 0;
if (!NO_AR) {
  // ---------- busca ----------
  await ana.clica('#bt-procurar');
  await ana.p.waitForSelector('#x-busca:not([hidden])');
  ok(/Truco um contra um/.test(await ana.p.textContent('#busca-txt')), 'procurando: "' + await ana.p.textContent('#busca-txt') + '"');
  await ana.foto('2-ana-procurando-truco');
  await beto.clica('#bt-procurar');
  await naMesa(ana); await naMesa(beto);
  ok(await ana.p.evaluate(() => window.__truco.v.n === 2 && window.__truco.online.ranqueada), 'a busca juntou a Ana e o Beto num um contra um valendo pontos');
  await beto.p.waitForSelector('.t-nome .pts', { timeout: 5000 });
  ok(/1200\?/.test(await beto.p.textContent('.t-nome .pts')), 'os pontos do adversário aparecem do lado do nome (' + await beto.p.textContent('.t-nome .pts') + ')');
  await beto.foto('3-celular-truco-pontos');
  ok(await jogarAteOFim(ana, beto), 'jogaram até alguém fazer 12');
  for (const j of [ana, beto]) await j.p.waitForFunction(() => /→/.test(document.querySelector('#fim-pontos').textContent), null, { timeout: 10000 });
  const anaGanhou = await ana.p.evaluate(() => window.__truco.v.fim.vencedor === window.__truco.eu % 2);
  const [g, p] = anaGanhou ? [ana, beto] : [beto, ana];
  const tg = await g.p.textContent('#fim-pontos'), tp = await p.p.textContent('#fim-pontos');
  ok(/1200 → 1\d{3}\? \(\+\d+\)/.test(tg) && /1200 → \d{3,4}\? \(-\d+\)/.test(tp), `fim: quem ganhou sobe (${tg}), quem perdeu desce (${tp})`);
  await beto.foto('4-celular-truco-fim');
  const pg = await pontos(g), pp = await pontos(p);
  ok(pg.v === 1 && pg.r > 1200 && pp.d === 1 && pp.r < 1200, `API: ${pg.r} (1 vitória) / ${pp.r} (1 derrota)`);
  rG = pg.r; rP = pp.r; jogosAntes = 1;
}

// ---------- com amigo: amistosa não conta; valendo pontos conta ----------
async function comAmigo(tipo) {
  await menu(ana); await menu(beto);
  await ana.clica('.qtd[data-n="2"]'); await ana.clica(`.tipo-amigo[data-tipo=${tipo}]`); await ana.clica('#bt-amigo');
  await ana.p.waitForFunction(() => window.__truco.online && window.__truco.online.codigo, null, { timeout: 10000 });
  await ana.p.waitForSelector('#amigos:not([hidden])', { timeout: 5000 }).then(() => ana.clica('#amigos-fechar'), () => {});
  const cod = await ana.p.evaluate(() => window.__truco.online.codigo);
  await beto.p.goto(URL + '/truco?sala=' + cod + '&rede=' + beto.rede);
  await naMesa(beto); await naMesa(ana);
  const r = await beto.p.evaluate(() => window.__truco.online.ranqueada);
  ok(await jogarAteOFim(ana, beto), `com amigo (${tipo}): jogaram até alguém fazer 12`);
  await beto.p.waitForSelector('#x-fim:not([hidden])', { timeout: 10000 });
  await beto.p.waitForTimeout(800);
  return r;
}
ok((await comAmigo('amistosa')) === false && (await pontos(beto)).jogos === jogosAntes && await beto.p.isHidden('#fim-pontos'), 'com amigo "Amistosa": não mexe nos pontos');
const rq = await comAmigo('pontos');
await beto.p.waitForFunction(() => !/Contando/.test(document.querySelector('#fim-pontos').textContent), null, { timeout: 10000 });
const txt = await beto.p.textContent('#fim-pontos');
// (no site publicado as duas contas podem sair pelo mesmo IP: aí o jogo é anulado por "mesma internet", o que também está certo)
ok(rq === true && (/→/.test(txt) ? (await pontos(beto)).jogos === jogosAntes + 1 : NO_AR && /mesma internet/.test(txt)), 'com amigo "Valendo pontos": ' + txt);
void rG; void rP;
ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

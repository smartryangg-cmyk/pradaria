// Teste real do tempo de cada jogada no Truco online: a tela mostra quanto falta; se a pessoa demorar, o computador
// joga por ela (e todo mundo fica sabendo); quem sai da mesa tem o lugar coberto pelo computador bem rápido; ao voltar,
// o prazo volta ao normal. Ana (PC) e Beto (celular), um contra um. No servidor de teste o prazo é 15 s (no site, 30 s).
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium } = pw;
const SAIDA = process.env.SAIDA || '/tmp/truco-prazo';
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
  await j.clica('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  if (!(await p.inputValue('#c-nasc .d-ano'))) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '2000'); }
  await j.clica('#c-ok');
  await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  return j;
}
const ve = (j) => j.p.evaluate(() => ({ v: window.__truco.v, eu: window.__truco.eu, prazo: window.__truco.prazo }));
const naMesa = (j) => j.p.waitForFunction(() => window.__truco && window.__truco.v && window.__truco.online && window.__truco.online.comecou, null, { timeout: 15000 });

const ana = await abrir({ viewport: { width: 1280, height: 800 } }, 'tana' + letras());
const beto = await abrir(CEL, 'tbeto' + letras());
await ana.p.goto(URL + '/truco'); await ana.p.waitForSelector('#x-menu:not([hidden])');
await ana.clica('.qtd[data-n="2"]'); await ana.clica('#bt-amigo');
await ana.p.waitForFunction(() => window.__truco.online && window.__truco.online.codigo, null, { timeout: 10000 });
await ana.p.waitForSelector('#amigos:not([hidden])', { timeout: 5000 }).then(() => ana.clica('#amigos-fechar'), () => {});
const cod = await ana.p.evaluate(() => window.__truco.online.codigo);
await beto.p.goto(URL + '/truco?sala=' + cod);
await naMesa(ana); await naMesa(beto);
const total = (await ve(ana)).prazo && (await ve(ana)).prazo.total;
ok(total >= 15000, `a jogada tem prazo (${total / 1000} s)`);

// ---------- quanto falta aparece para os dois ----------
let a = await ve(ana);
const [j1, j2] = a.v.age.includes(a.eu) ? [ana, beto] : [beto, ana];
await j1.p.waitForFunction(() => /^Sua vez: \d+s$/.test(document.querySelector('#t-status').textContent), null, { timeout: 5000 });
const st2 = await j2.p.textContent('#t-status');
ok(/^Vez de .+: \d+s$/.test(st2), `quem joga vê "${await j1.p.textContent('#t-status')}", o outro vê "${st2}"`);
await beto.foto(j1 === beto ? '1-celular-sua-vez-prazo' : '1-celular-vez-do-outro');
{ const cabe = await beto.p.evaluate(() => { const s = document.querySelector('#t-status'); return s.scrollWidth <= s.clientWidth + 1; }); ok(cabe, 'celular: o aviso com os segundos cabe inteiro'); }

// ---------- ninguém joga: o computador joga por quem demorou ----------
const seq0 = (await ve(j1)).v.seq;
const t0 = Date.now();
await j1.p.waitForFunction(() => /Seu tempo acabou/.test(document.querySelector('#aviso').textContent), null, { timeout: total + 8000 });
const levou = Date.now() - t0;
ok((await ve(j1)).v.seq > seq0, `depois de ~${Math.round(levou / 1000)} s sem jogar o computador jogou por ${j1 === ana ? 'Ana' : 'Beto'} ("Seu tempo acabou: o computador jogou por você")`);
await j2.p.waitForFunction(() => /demorou: o computador jogou no lugar/.test(document.querySelector('#aviso').textContent), null, { timeout: 5000 }).then(
  async () => ok(true, `o outro fica sabendo: "${await j2.p.textContent('#aviso')}"`), () => ok(false, 'o outro fica sabendo que o computador jogou'));
await j1.foto(j1 === ana ? '2-ana-tempo-acabou' : '2-beto-tempo-acabou');

// ---------- Beto sai da mesa: na vez dele o computador joga logo ----------
const betoLugar = (await ve(beto)).eu;
await beto.p.goto('about:blank');
let viuCurto = false, tempoFora = 0;
for (let i = 0; i < 60 && !viuCurto; i++) {
  a = await ve(ana);
  if (a.v.fim) break;
  if (a.v.age.includes(a.eu) && !a.v.aposta && !a.v.onze) { await ana.clica('#t-minhas .minha').catch(() => {}); await ana.p.waitForTimeout(900); continue; }
  if (a.v.age.includes(a.eu)) { await ana.clica('#t-acoes .bt').catch(() => {}); await ana.p.waitForTimeout(900); continue; }
  if (a.v.age.includes(betoLugar) && a.prazo && a.prazo.total <= 5000) {
    viuCurto = true;
    const s0 = a.v.seq, t1 = Date.now();
    await ana.p.waitForFunction((s) => window.__truco.v.seq > s, s0, { timeout: 10000 });
    tempoFora = Date.now() - t1;
  }
  await ana.p.waitForTimeout(500);
}
ok(viuCurto && tempoFora < 7000, `Beto fora da mesa: na vez dele o computador jogou em ${(tempoFora / 1000).toFixed(1)} s (prazo curto para quem saiu)`);

// ---------- Beto volta e continua ----------
await beto.p.goto(URL + '/truco?sala=' + cod);
await naMesa(beto);
const vb = await ve(beto), va2 = await ve(ana);
ok(vb.v.pontos.join() === va2.v.pontos.join() && vb.v.minhas.length >= 0, 'Beto voltou para a mesma mesa (placar ' + vb.v.pontos.join(' x ') + ')');
// se é a vez dele, o prazo volta a ser o normal
for (let i = 0; i < 40; i++) {
  a = await ve(ana);
  if (a.v.fim || a.v.age.includes(betoLugar)) break;
  if (a.v.age.includes(a.eu)) { await ana.clica(a.v.aposta || a.v.onze ? '#t-acoes .bt' : '#t-minhas .minha').catch(() => {}); }
  await ana.p.waitForTimeout(900);
}
const pb = await ve(beto);
if (!pb.v.fim) ok(pb.v.age.includes(betoLugar) && pb.prazo && pb.prazo.total >= 15000, `de volta, na vez dele o prazo é o normal (${pb.prazo && pb.prazo.total / 1000} s)`);
await beto.foto('3-celular-de-volta');

ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

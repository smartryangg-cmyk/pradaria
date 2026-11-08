// "Monstros machucam": corações, dano leve, recuperar, desmaiar e acordar no começo, luz afasta, toque espanta.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const p = await (await b.newContext({ viewport: { width: 1024, height: 700 } })).newPage();
p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(BASE + '/#teste');
await p.click('#bt-sozinho');
await p.waitForSelector('#n-opcoes:not([hidden])');
// ligar "machucam" liga os monstrinhos junto; desligar monstrinhos desliga "machucam"
await p.click('[data-opcao=monstrosMachucam]');
conferir(await p.getAttribute('[data-opcao=monstros]', 'aria-pressed') === 'true', 'machucam liga os monstrinhos');
await p.click('[data-opcao=monstros]');
conferir(await p.getAttribute('[data-opcao=monstrosMachucam]', 'aria-pressed') === 'false', 'desligar monstrinhos desliga machucam');
await p.click('[data-opcao=monstrosMachucam]');
await p.click('[data-tamanho=pequeno]');
await p.click('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
await p.waitForTimeout(3000);
conferir(await p.isVisible('#vida'), 'corações aparecem');
conferir(await p.locator('#vida .coracao.cheio').count() === 5, '5 corações cheios');

const J = (f, a) => p.evaluate(f, a);
// noite e um monstrinho encostando: perde meio coração
await J(() => { window.__jogo.dia = 0.75; window.__jogo.monstros.tempoSpawn = 99; });
const buu = () => J(() => { const g = window.__jogo, j = g.jog; let m = g.monstros.lista[0] || g.monstros.criar('resmungao', j.pos.x + 0.6, j.pos.y, j.pos.z); m.x = j.pos.x + 0.6; m.z = j.pos.z; m.y = j.pos.y; m.susto = 0; m.luz = null; m.olhaLuz = 9; });
await buu();
await p.waitForTimeout(300);
conferir(await J(() => window.__jogo.vida.atual) === 9, 'Buu tira meio coração');
conferir(await p.locator('#vida .coracao.meio').count() === 1, 'mostra meio coração');
await p.screenshot({ path: SAIDA + '/coracoes.png' });
// recupera sozinho depois de um tempo sem dano
await J(() => { const v = window.__jogo.vida; v.semDano = 20; v.acumCura = 10; });
await p.waitForTimeout(300);
conferir(await J(() => window.__jogo.vida.atual) === 10, 'recupera sozinho');
// cura vinda de fora (comida etc.)
await J(() => { window.__jogo.vida.atual = 4; window.__jogo.vida.curar(2); });
conferir(await J(() => window.__jogo.vida.atual) === 6, 'vida.curar funciona');
// desmaiar: volta para o começo com vida cheia e sem monstrinhos
const antes = await J(() => { const j = window.__jogo.jog; j.pos.x += 40; return { x: j.pos.x, z: j.pos.z }; });
await J(() => { window.__jogo.vida.atual = 1; });
await buu();
await p.waitForTimeout(400);
await p.screenshot({ path: SAIDA + '/desmaio.png' });
await p.waitForTimeout(1500);
const depois = await J(() => ({ x: window.__jogo.jog.pos.x, v: window.__jogo.vida.atual, n: window.__jogo.monstros.lista.length, prot: window.__jogo.vida.protegido }));
conferir(depois.v === 10 && Math.abs(depois.x - antes.x) > 20, 'desmaia e acorda no começo com vida cheia');
conferir(depois.n === 0, 'monstrinhos vão embora no desmaio');
// protegido logo depois de acordar
await buu();
await p.waitForTimeout(300);
conferir(await J(() => window.__jogo.vida.atual) === 10, 'protegido logo depois de acordar');
// luz afasta: lampião do lado, o monstrinho foge e não machuca
await J(() => { window.__jogo.vida.protegido = 0; window.__jogo.monstros.limpar(); });
const luz = await J(() => {
  const g = window.__jogo, j = g.jog, x = Math.floor(j.pos.x), z = Math.floor(j.pos.z), y = Math.floor(j.pos.y);
  g.mundo.definir(x + 2, y, z, 21); // lampião
  const m = g.monstros.criar('bolotinha', j.pos.x + 4, j.pos.y, j.pos.z);
  m.susto = 0;
  return { x: m.x };
});
await p.waitForTimeout(2500);
const longe = await J(() => { const g = window.__jogo, m = g.monstros.lista[0]; return { x: m && m.x, px: g.jog.pos.x, v: g.vida.atual }; });
conferir(longe.v === 10 && longe.x > luz.x, 'luz afasta o monstrinho (' + (longe.x - luz.x).toFixed(1) + ')');
// mundo sem "machucam": sem corações
await J(() => { window.__jogo.opcoesMundo.monstrosMachucam = false; window.__jogo.vida.desenhar(); });
conferir(!(await p.isVisible('#vida')), 'sem a opção não tem corações');
conferir(await J(() => window.__jogo.vida.dano(1)) === false, 'sem a opção não machuca');
console.log(erros.slice(0, 10).join('\n'));
conferir(erros.length === 0, 'sem erros no console');
await b.close();
process.exit(falhas.length ? 1 : 0);

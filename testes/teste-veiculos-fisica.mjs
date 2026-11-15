// Física dos veículos andando de verdade no navegador (segurando W): sobe degrau de 1 bloco, meio bloco e rampa
// sem travar, não sobe parede de 2 nem cerca, desce escada colado no chão (sem voar), raspa na parede de lado
// em vez de parar seco, sobe morro de degraus, e veículos diferentes (carro, moto, bicicleta, ônibus, tanque).
// Precisa de `npm run dev` rodando (porta 8788). TOQUE=1 roda como tablet; CEL=1 como celular.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const toque = !!process.env.TOQUE || !!process.env.CEL;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const ctx = await b.newContext(process.env.CEL ? { ...devices['Pixel 7'] } : { viewport: { width: 1024, height: 640 }, hasTouch: toque, isMobile: toque });
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
const falhas = [];
const ok = (c, msg) => { console.log((c ? 'OK    ' : 'FALHA ') + msg); if (!c) falhas.push(msg); };
const ev = (f, a) => p.evaluate(f, a);
const tocar = (sel) => (toque ? p.tap(sel) : p.click(sel));
let cdp = null;

await p.goto((process.env.URL || 'http://localhost:8788') + '/#teste');
await p.waitForTimeout(400);
await tocar('#bt-sozinho');
await p.waitForSelector('#m-novo:not([hidden])');
await tocar('[data-opcao=mercado]'); // sem mercado: as chaves saem de graça
await tocar('#m-novo summary'); await p.fill('#n-semente', 'estrada');
await tocar('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.garagem.veic, null, { timeout: 20000 });
await p.waitForTimeout(2500);

// ---------- percurso no alto (Y = 70), cada faixa com um obstáculo ----------
const Y = 70, X0 = 220, Z0 = 200;
const FAIXA = { degrau: 0, laje: 8, rampa: 16, escada: 24, parede2: 32, cerca: 40, morro: 48, lado: 60 };
await ev(() => { const j = window.__jogo.jog; j.pos.x = 260; j.pos.y = 85; j.pos.z = 235; j.voando = true; });
await p.waitForTimeout(3500);
async function construir() {
  await ev(({ Y, X0, Z0, FAIXA }) => {
    const m = window.__jogo.mundo, T = 8, P = 3, LAJE = 90, RAMPA = 91, CERCA = 84;
    for (let x = X0 - 6; x < X0 + 80; x++) for (let z = Z0 - 4; z <= Z0 + 72; z++) {
      m.definir(x, Y, z, T);
      for (let y = Y + 1; y < Y + 10; y++) m.definir(x, y, z, 0);
    }
    const linha = (z0, f) => { for (let z = z0 - 2; z <= z0 + 2; z++) f(z); };
    // degrau de 1 bloco em x = X0+20 (continua no alto)
    linha(Z0 + FAIXA.degrau, (z) => { for (let x = X0 + 20; x < X0 + 80; x++) m.definir(x, Y + 1, z, T); });
    // meio bloco em x = X0+20 (continua no meio bloco)
    linha(Z0 + FAIXA.laje, (z) => { for (let x = X0 + 20; x < X0 + 80; x++) m.definir(x, Y + 1, z, LAJE); });
    // rampa em x = X0+20 e depois chão 1 acima
    linha(Z0 + FAIXA.rampa, (z) => { m.definir(X0 + 20, Y + 1, z, RAMPA); for (let x = X0 + 21; x < X0 + 80; x++) m.definir(x, Y + 1, z, T); });
    // escada descendo: começa 4 acima e desce 1 a cada 3 blocos (o carro desce colado no chão)
    linha(Z0 + FAIXA.escada, (z) => { for (let x = X0 - 6; x < X0 + 80; x++) { const h = Math.max(0, 4 - Math.max(0, Math.floor((x - X0 - 10) / 3))); for (let y = Y + 1; y <= Y + h; y++) m.definir(x, y, z, T); } });
    // parede de 2 blocos em x = X0+20
    linha(Z0 + FAIXA.parede2, (z) => { for (let y = Y + 1; y <= Y + 2; y++) m.definir(X0 + 20, y, z, P); });
    // cerca (1,5 de altura) em x = X0+20
    linha(Z0 + FAIXA.cerca, (z) => m.definir(X0 + 20, Y + 1, z, CERCA));
    // morro: sobe 1 bloco a cada 2 até 6 blocos de altura
    linha(Z0 + FAIXA.morro, (z) => { for (let x = X0 + 15; x < X0 + 80; x++) { const h = Math.min(6, Math.floor((x - X0 - 15) / 2) + 1); for (let y = Y + 1; y <= Y + h; y++) m.definir(x, y, z, T); } });
    // parede comprida ao longo de x (em z = Z0+FAIXA.lado+4): o carro vem torto e raspa
    for (let x = X0 - 6; x < X0 + 80; x++) for (let y = Y + 1; y <= Y + 3; y++) m.definir(x, y, Z0 + FAIXA.lado + 4, P);
  }, { Y, X0, Z0, FAIXA });
}
for (let i = 0; i < 3; i++) { await construir(); await p.waitForTimeout(2000); }
await ev(({ Y, X0, Z0 }) => { const j = window.__jogo.jog; j.pos.x = X0; j.pos.y = Y + 1.05; j.pos.z = Z0 - 3; j.voando = false; }, { Y, X0, Z0 });
await p.waitForTimeout(800);

const dentro = () => ev(() => { const d = window.__jogo.garagem.dentro; return d ? { tipo: d.v.tipo, x: d.v.x, y: d.v.y, z: d.v.z, vel: d.v.vel, noChao: d.v.noChao, dano: d.v.dano } : null; });
async function pegar(tipo) {
  await ev(() => { if (window.__jogo.garagem.dentro) window.__jogo.garagem.sair(); });
  await p.waitForTimeout(200);
  await ev((t) => { const m = window.__jogo.mercado; if (m && !m.e.veiculos.includes(t)) { m.e.veiculos.push(t); } window.__jogo.garagem.novo(t, 0); }, tipo);
  await p.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 5000 }).catch(() => {});
  const d = await dentro();
  if (!d) console.log('      aviso:', await ev(() => document.querySelector('#aviso') && document.querySelector('#aviso').textContent), JSON.stringify(await ev(() => { const j = window.__jogo.jog; return [j.pos.x, j.pos.y, j.pos.z, window.__jogo.mundo.bloco(Math.floor(j.pos.x), Math.floor(j.pos.y) - 1, Math.floor(j.pos.z))]; })));
  ok(d && d.tipo === tipo, 'entrou no ' + tipo);
}
// põe o veículo parado na faixa, virado para +x (ou com um ângulo)
const por = (x, y, z, yaw = -Math.PI / 2) => ev(([x, y, z, yaw]) => { const v = window.__jogo.garagem.dentro.v; v.x = x; v.y = y; v.z = z; v.yVis = y; v.yaw = yaw; v.vel = 0; v.vy = 0; v.dano = 0; v.comb = 1; v.noChao = true; window.__jogo.garagem._esperado = null; }, [x, y, z, yaw]);
// segura W (de verdade, pelo teclado) e vai anotando: tempo no ar, maior y, para quando passar de xFim
async function dirigir(ms, xFim) {
  await ev(() => { const g = window.__jogo.garagem; g._reg = { ar: 0, n: 0, ymax: -1e9, vmin: 1e9, vmaxv: 0, t0: performance.now() }; const v = g.dentro.v;
    g._regTimer = setInterval(() => { const r = g._reg; if (!g.dentro) return; r.n++; if (!v.noChao) r.ar++; r.ymax = Math.max(r.ymax, v.y); r.vmaxv = Math.max(r.vmaxv, v.vel); }, 30); });
  // no tablet/celular: dedo no joystick (lado esquerdo da tela) empurrado para cima; no computador: tecla W
  const vp = p.viewportSize(), jx = vp.width * 0.18, jy = vp.height * 0.7;
  if (toque) {
    cdp = cdp || await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx, y: jy - 50, id: 1 }] });
  } else await p.keyboard.down('KeyW');
  const t0 = Date.now();
  let lento = 0;
  while (Date.now() - t0 < ms * 4) {
    await p.waitForTimeout(150);
    const d = await dentro();
    if (xFim && d.x > xFim) break;
    if (Date.now() - t0 > ms) break;
  }
  if (toque) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await p.keyboard.up('KeyW');
  await p.waitForTimeout(300);
  const reg = await ev(() => { const g = window.__jogo.garagem; clearInterval(g._regTimer); return g._reg; });
  return { ...(await dentro()), reg };
}

await pegar('carro');
const yBase = Y + 1;
// 1) degrau de 1 bloco
await por(X0 + 0.5, yBase, Z0 + FAIXA.degrau + 0.5);
let r = await dirigir(5000, X0 + 40);
console.log('      degrau:', r.x.toFixed(1), r.y.toFixed(2), 'vel max', r.reg.vmaxv.toFixed(1));
ok(r.x > X0 + 30 && Math.abs(r.y - (yBase + 1)) < 0.05, `carro sobe o degrau de 1 bloco e segue (x ${r.x.toFixed(1)}, y ${r.y.toFixed(2)})`);
// 2) meio bloco: sobe e fica em cima do meio bloco (y + 0,5), sem flutuar
await por(X0 + 0.5, yBase, Z0 + FAIXA.laje + 0.5);
r = await dirigir(5000, X0 + 40);
ok(r.x > X0 + 30 && Math.abs(r.y - (yBase + 0.5)) < 0.05, `carro sobe o meio bloco e anda em cima dele (y ${r.y.toFixed(2)})`);
// 3) rampa
await por(X0 + 0.5, yBase, Z0 + FAIXA.rampa + 0.5);
r = await dirigir(5000, X0 + 40);
ok(r.x > X0 + 30 && Math.abs(r.y - (yBase + 1)) < 0.05, `carro sobe a rampa (y ${r.y.toFixed(2)})`);
// 4) parede de 2 blocos: não sobe, bate
await por(X0 + 0.5, yBase, Z0 + FAIXA.parede2 + 0.5);
r = await dirigir(4000);
ok(r.x < X0 + 20 && r.y < yBase + 0.1, `parede de 2 blocos segura o carro (x ${r.x.toFixed(1)}, y ${r.y.toFixed(2)})`);
// 5) cerca: alta demais para subir
await por(X0 + 0.5, yBase, Z0 + FAIXA.cerca + 0.5);
r = await dirigir(4000);
ok(r.x < X0 + 20 && r.y < yBase + 0.1, `cerca segura o carro (x ${r.x.toFixed(1)}, y ${r.y.toFixed(2)})`);
// 6) escada descendo: desce colado no chão (quase sem tempo no ar e sem pular acima do topo)
await por(X0 + 0.5, yBase + 4, Z0 + FAIXA.escada + 0.5);
r = await dirigir(5000, X0 + 40);
const fracAr = r.reg.ar / Math.max(1, r.reg.n);
console.log('      escada: no ar', (fracAr * 100).toFixed(0) + '%', 'y', r.y.toFixed(2));
ok(r.x > X0 + 30 && Math.abs(r.y - yBase) < 0.05 && fracAr < 0.25, `desce a escada colado no chão (no ar ${(fracAr * 100).toFixed(0)}% do tempo)`);
// 7) morro de degraus: chega no alto
await por(X0 + 0.5, yBase, Z0 + FAIXA.morro + 0.5);
r = await dirigir(7000, X0 + 50);
ok(r.x > X0 + 35 && Math.abs(r.y - (yBase + 6)) < 0.05, `sobe o morro até o alto (y ${r.y.toFixed(2)})`);
await p.screenshot({ path: SAIDA + '/fisica-morro.png' });
// 8) vem torto contra a parede comprida: raspa e continua andando ao longo dela
await por(X0 + 0.5, yBase, Z0 + FAIXA.lado + 0.5, -Math.PI / 2 - 0.45); // ~25° virado para a parede
r = await dirigir(5000, X0 + 45);
console.log('      raspando:', r.x.toFixed(1), r.z.toFixed(1), 'vel', r.vel.toFixed(1), 'dano', r.dano.toFixed(2));
ok(r.x > X0 + 25, `raspa na parede de lado e continua andando (x ${r.x.toFixed(1)})`);
ok(r.dano < 0.15, `raspar de lado amassa pouco (dano ${r.dano.toFixed(2)})`);

// outros veículos no degrau e no morro
for (const tipo of ['moto', 'bicicleta', 'onibus', 'tanque']) {
  await pegar(tipo);
  await por(X0 + 0.5, yBase, Z0 + FAIXA.degrau + 0.5);
  r = await dirigir(6000, X0 + 40);
  ok(r.x > X0 + 28 && Math.abs(r.y - (yBase + 1)) < 0.05, `${tipo} sobe o degrau (x ${r.x.toFixed(1)}, y ${r.y.toFixed(2)})`);
  await por(X0 + 0.5, yBase, Z0 + FAIXA.morro + 0.5);
  r = await dirigir(9000, X0 + 50);
  ok(r.x > X0 + 33 && Math.abs(r.y - (yBase + 6)) < 0.05, `${tipo} sobe o morro (y ${r.y.toFixed(2)})`);
}
await p.screenshot({ path: SAIDA + '/fisica-tanque.png' });

console.log(erros.length ? 'ERROS: ' + erros.slice(0, 5).join(' | ') : 'sem erros no console');
ok(!erros.length, 'sem erros no console');
await b.close();
console.log(falhas.length ? falhas.length + ' FALHA(S)' : 'TUDO OK');
process.exit(falhas.length ? 1 : 0);

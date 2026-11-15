// Posto de combustível de verdade, jogando: as bombas e colunas são sólidas (a pé e de carro), a pé do lado da
// bomba o jogo explica como abastecer, o carro chega dirigindo e para na vaga, aparece Abastecer (com o preço),
// paga com moedas, o marcador enche aos poucos com o carro parado, e depois mostra "Tanque cheio".
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
await tocar('#m-novo summary'); await p.fill('#n-semente', 'estrada');
await tocar('[data-opcao=veiculos]'); await tocar('[data-opcao=mercado]'); // mods (desligados nos mundos novos): o posto cobra em moedas
await tocar('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.garagem.veic, null, { timeout: 20000 });
await p.waitForTimeout(2500);

// vai até o posto da vila
const plan = await ev(() => window.__jogo.garagem.lugares.perto(0, 0, 400).postos[0]);
ok(!!plan, 'a vila tem posto');
await ev((pt) => { const j = window.__jogo.jog; j.pos.x = pt.x + 2; j.pos.z = pt.z + 2; j.pos.y = window.__jogo.mundo.chao(Math.floor(pt.x + 2), Math.floor(pt.z + 2)) + 1.05; j.voando = false; window.__jogo.garagem.tempoLugares = 0; }, plan);
await p.waitForFunction(() => window.__jogo.garagem.postos.size > 0, null, { timeout: 15000 }).catch(() => {});
const P = await ev(() => { const q = [...window.__jogo.garagem.postos.values()][0]; return q && { x: q.x, y: q.y, z: q.z, yaw: q.yaw }; });
ok(!!P, 'o posto foi construído no mundo');
// local do posto -> mundo
const mundo = (lx, lz) => [P.x + lx * Math.cos(P.yaw) + lz * Math.sin(P.yaw), P.z - lx * Math.sin(P.yaw) + lz * Math.cos(P.yaw)];
const local = (wx, wz) => { const dx = wx - P.x, dz = wz - P.z, c = Math.cos(P.yaw), s = Math.sin(P.yaw); return [dx * c - dz * s, dx * s + dz * c]; };
// nenhum bloco furando o piso, e o chão embaixo no máximo 1 abaixo (a base de concreto cobre)
const piso = await ev((pts) => pts.map(([x, z]) => { const m = window.__jogo.mundo, bx = Math.floor(x), bz = Math.floor(z); for (let y = 100; y > 0; y--) if (m.bloco(bx, y, bz)) return y + 1; return 0; }),
  [...Array(15).keys()].flatMap((i) => [-3, 0, 3].map((lz) => mundo(i - 9.5, lz))));
ok(piso.every((g) => g <= P.y && g >= P.y - 1), `piso do posto rente ao chão, sem bloco furando (${Math.min(...piso)}..${Math.max(...piso)}, piso ${P.y})`);

async function segurar(tecla, ms) {
  if (toque && (tecla === 'KeyW' || tecla === 'KeyS')) {
    const vp = p.viewportSize(), jx = vp.width * 0.18, jy = vp.height * 0.7;
    cdp = cdp || await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx, y: jy + (tecla === 'KeyW' ? -50 : 50), id: 1 }] });
    await p.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else { await p.keyboard.down(tecla); await p.waitForTimeout(ms); await p.keyboard.up(tecla); }
}

// ---- a pé: a ilha das bombas é sólida e o jogo explica como abastecer ----
const [ax, az] = mundo(2.6, 0);
await ev(([x, z, y, yaw]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = y; j.yaw = yaw; j.vel.x = j.vel.z = 0; }, [ax, az, P.y + 0.01, P.yaw + Math.PI / 2]);
await p.waitForTimeout(600);
await segurar('KeyW', 1800);
const pe = await ev(() => { const j = window.__jogo.jog; return [j.pos.x, j.pos.z, document.querySelector('#aviso') && document.querySelector('#aviso').textContent]; });
const [plx] = local(pe[0], pe[1]);
ok(plx > 0.7 && plx < 2.0, `a pé, a bomba é sólida: a pessoa para encostada nela (x local ${plx.toFixed(2)})`);
ok(/venha com o veículo/.test(pe[2] || ''), 'a pé do lado da bomba o jogo explica como abastecer: "' + pe[2] + '"');

// ---- carro com tanque baixo, vindo pela rua até a vaga ----
await ev(() => { const m = window.__jogo.mercado; if (!m.e.veiculos.includes('carro')) m.e.veiculos.push('carro'); m.e.moedas = 50; m.salvarLocal(); });
await ev(() => window.__jogo.garagem.novo('carro', 2));
await p.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 5000 }).catch(() => {});
ok(!!(await ev(() => !!window.__jogo.garagem.dentro)), 'entrou no carro');
const [cx, cz] = mundo(1.75, 7); // na rua, chegando no pátio
await ev(([x, z, yaw]) => { const g = window.__jogo.garagem, v = g.dentro.v, y = window.__jogo.mundo.chao(Math.floor(x), Math.floor(z)) + 1; v.x = x; v.y = y; v.z = z; v.yVis = y; v.yaw = yaw; v.vel = 0; v.vy = 0; v.comb = 0.3; v.dano = 0; g._esperado = null; }, [cx, cz, P.yaw]);
await p.waitForTimeout(400);
if (process.env.DBG) console.log(await ev(() => { const g = window.__jogo.garagem, v = g.dentro.v, V = g.veic; return JSON.stringify({ y: v.y, col: V.colide(v, v.x, v.y, v.z, v.yaw), colx: V.extraColide && V.extraColide(v.x - 0.5, v.y + 0.001, v.z - 0.5, v.x + 0.5, v.y + 1, v.z + 0.5), ench: !!g.enchendo, a: g.dentro.a, comb: v.comb, dano: v.dano }); }));
// dirige até a vaga e freia
const carro = () => ev(() => { const v = window.__jogo.garagem.dentro.v; return { x: v.x, z: v.z, vel: v.vel, comb: v.comb }; });
// acelera pela rua, solta perto da bomba, freia; se passou ou ficou curto, manobra devagar (como uma pessoa)
// freia segurando o joystick (ou a tecla) para trás até parar, como uma pessoa faz
async function frear() {
  const c0 = await carro(); if (Math.abs(c0.vel) < 0.3) return;
  const tras = c0.vel > 0, tecla = tras ? 'KeyS' : 'KeyW';
  if (toque) {
    const vp = p.viewportSize(), jx = vp.width * 0.18, jy = vp.height * 0.7;
    cdp = cdp || await ctx.newCDPSession(p);
    await p.waitForTimeout(420); // longe de um toque duplo (que é correr)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx, y: jy + (tras ? 50 : -50), id: 1 }] });
  } else await p.keyboard.down(tecla);
  for (let i = 0; i < 200; i++) { const c = await carro(); if (Math.abs(c.vel) < 0.3 || (c.vel > 0) !== tras) break; await p.waitForTimeout(25); }
  if (toque) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await p.keyboard.up(tecla);
}
await (async () => {
  const pedal = async (sim) => {
    if (toque) {
      const vp = p.viewportSize(), jx = vp.width * 0.18, jy = vp.height * 0.7;
      cdp = cdp || await ctx.newCDPSession(p);
      if (sim) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 1 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx, y: jy - 50, id: 1 }] }); }
      else await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else if (sim) await p.keyboard.down('KeyW'); else await p.keyboard.up('KeyW');
  };
  await pedal(true);
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    const c = await carro(), lz = local(c.x, c.z)[1];
    if (lz < 4.5) break;
    if (Date.now() - t0 > 2500 && Math.abs(c.vel) < 0.1) { await pedal(false); await p.waitForTimeout(200); await pedal(true); }
    await p.waitForTimeout(50);
  }
  await pedal(false);
})();
for (let k = 0; k < 8; k++) {
  await frear(); await p.waitForTimeout(300);
  const c = await carro(), lz = local(c.x, c.z)[1];
  if (lz > -2 && lz < 2) break;
  await p.waitForTimeout(420);
  await segurar(lz >= 2 ? 'KeyW' : 'KeyS', 250);
}
await p.waitForTimeout(800);
let c = await carro();
const [vlx, vlz] = local(c.x, c.z);
console.log('      carro na vaga:', vlx.toFixed(2), vlz.toFixed(2), 'vel', c.vel.toFixed(2));
ok(Math.abs(vlx) > 0.5 && Math.abs(vlx) < 3.1 && Math.abs(vlz) < 3.4, 'o carro chegou dirigindo e parou na vaga do lado da bomba');
ok(await p.isVisible('#bt-abastecer'), 'parado na bomba aparece o botão Abastecer');
const txt = await p.textContent('#bt-abastecer');
ok(/Abastecer/.test(txt) && /\d/.test(txt), 'o botão mostra o preço em moedas: "' + txt.trim() + '"');
await p.screenshot({ path: SAIDA + '/posto-vaga.png' });

// ---- abastece: paga e o marcador sobe aos poucos, com o carro parado ----
const largura = () => ev(() => parseFloat(document.querySelector('#med-comb u').style.width));
const m0 = await ev(() => window.__jogo.mercado.e.moedas);
const w0 = await largura();
await tocar('#bt-abastecer');
await p.waitForTimeout(500);
const w1 = await largura();
const xAntes = (await carro()).x;
await segurar('KeyW', 700); // tenta sair no meio: o carro fica parado na bomba
const w2 = await largura();
const xDurante = (await carro()).x;
await p.waitForFunction(() => !window.__jogo.garagem.enchendo, null, { timeout: 15000 });
await p.waitForTimeout(400);
const w3 = await largura();
const m1 = await ev(() => window.__jogo.mercado.e.moedas);
console.log('      marcador:', w0, w1, w2, w3, 'moedas', m0, '->', m1);
ok(w0 <= 31 && w1 > w0 && w1 < 100 && w2 > w1 && w3 === 100, `o marcador enche aos poucos (${w0}% -> ${w1}% -> ${w2}% -> ${w3}%)`);
ok(Math.abs(xDurante - xAntes) < 0.05, 'enquanto abastece o carro fica parado na bomba');
ok(m1 < m0, `pagou com moedas (${m0} -> ${m1})`);
ok((await carro()).comb === 1, 'tanque cheio de verdade');
const txt2 = await p.textContent('#bt-abastecer');
ok(/Tanque cheio/.test(txt2) && await ev(() => document.querySelector('#bt-abastecer').disabled), 'depois mostra "Tanque cheio" (não deixa pagar de novo)');
await p.screenshot({ path: SAIDA + '/posto-cheio.png' });

// ---- o carro bate na ilha das bombas (não atravessa) ----
const [ix, iz] = mundo(0, 8);
await ev(([x, y, z, yaw]) => { const g = window.__jogo.garagem, v = g.dentro.v; v.x = x; v.y = y; v.z = z; v.yVis = y; v.yaw = yaw; v.vel = 0; g._esperado = null; }, [ix, P.y, iz, P.yaw]);
await segurar('KeyW', 3500);
c = await carro();
const [, blz] = local(c.x, c.z);
ok(blz > 1.3, `o carro bate na ilha das bombas e não atravessa (z local ${blz.toFixed(2)})`);
// e nas colunas da cobertura
const [kx, kz] = mundo(3.1, 8);
await ev(([x, y, z, yaw]) => { const g = window.__jogo.garagem, v = g.dentro.v; v.x = x; v.y = y; v.z = z; v.yVis = y; v.yaw = yaw; v.vel = 0; g._esperado = null; }, [kx, P.y, kz, P.yaw]);
await segurar('KeyW', 3500);
c = await carro();
ok(local(c.x, c.z)[1] > 2.8, `o carro bate na coluna da cobertura (z local ${local(c.x, c.z)[1].toFixed(2)})`);

console.log(erros.length ? 'ERROS: ' + erros.slice(0, 5).join(' | ') : 'sem erros no console');
ok(!erros.length, 'sem erros no console');
await b.close();
console.log(falhas.length ? falhas.length + ' FALHA(S)' : 'TUDO OK');
process.exit(falhas.length ? 1 : 0);

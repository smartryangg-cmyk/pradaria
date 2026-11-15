// Skate de verdade no navegador: a pessoa fica EM PÉ em cima da prancha (pés na prancha, não enterrados),
// anda, faz curva, sobe meio bloco, não atravessa teto baixo com a cabeça, desce e fica em pé no chão.
// Precisa de `npm run dev` rodando (porta 8788). TOQUE=1 tablet; CEL=1 celular. SAIDA=pasta das fotos.
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
const nome = process.env.CEL ? 'cel' : toque ? 'tablet' : 'pc';

await p.goto((process.env.URL || 'http://localhost:8788') + '/#teste');
await p.waitForTimeout(400);
await tocar('#bt-sozinho');
await p.waitForSelector('#m-novo:not([hidden])');
await tocar('#m-novo summary'); await p.fill('#n-semente', 'estrada');
await tocar('[data-opcao=veiculos]'); // mod (desligado nos mundos novos)
await tocar('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.garagem.veic, null, { timeout: 20000 });
await p.waitForTimeout(2500);

// pista plana no alto
const Y = 70, X0 = 220, Z0 = 200;
await ev(() => { const j = window.__jogo.jog; j.pos.x = 235; j.pos.y = 85; j.pos.z = 205; j.voando = true; });
await p.waitForTimeout(3000);
await ev(({ Y, X0, Z0 }) => {
  const m = window.__jogo.mundo, T = 8, LAJE = 90;
  for (let x = X0 - 6; x < X0 + 40; x++) for (let z = Z0 - 6; z <= Z0 + 14; z++) { m.definir(x, Y, z, T); for (let y = Y + 1; y < Y + 8; y++) m.definir(x, y, z, 0); }
  // faixa 0: meio bloco em x = X0+12; faixa 8: teto baixo (bloco a 2 de altura) em x = X0+12
  for (let z = Z0 - 1; z <= Z0 + 1; z++) m.definir(X0 + 12, Y + 1, z, LAJE);
  for (let z = Z0 + 7; z <= Z0 + 9; z++) for (let x = X0 + 12; x < X0 + 15; x++) m.definir(x, Y + 2, z, T);
}, { Y, X0, Z0 });
await p.waitForTimeout(800);

await ev(({ Y, X0, Z0 }) => { const j = window.__jogo.jog; j.voando = false; j.pos.x = X0 + 0.5; j.pos.y = Y + 1; j.pos.z = Z0 + 0.5; j.yaw = -Math.PI / 2; }, { Y, X0, Z0 });
await p.waitForTimeout(500);
await ev(() => window.__jogo.garagem.novo('skate', 0));
await p.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 5000 }).catch(() => {});
ok(!!(await ev(() => !!window.__jogo.garagem.dentro)), 'subiu no skate');
const por = (x, z, yaw) => ev(([x, y, z, yaw]) => { const g = window.__jogo.garagem, v = g.dentro.v; v.x = x; v.y = y; v.z = z; v.yVis = y; v.yaw = yaw; v.vel = 0; v.vy = 0; g._esperado = null; window.__jogo.jog.yaw = 0; window.__jogo.jog.pitch = -0.2; }, [x, Y + 1, z, yaw]);
await por(X0 + 3.5, Z0 + 0.5, -Math.PI / 2);
await p.waitForTimeout(800);

// onde estão os pés e a cabeça do boneco, e onde está a prancha
const medir = () => ev(() => {
  const g = window.__jogo.garagem, v = g.dentro.v, bon = v.bonecos[0];
  if (!bon) return null;
  const T = bon.grupo.parent.constructor; // THREE.Group
  const box = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
  bon.grupo.updateMatrixWorld(true);
  bon.grupo.traverse((o) => { if (!o.geometry) return; o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) { const pt = o.localToWorld(bb.min.clone().set(cx, cy, cz)); const a = [pt.x, pt.y, pt.z]; for (let i = 0; i < 3; i++) { box.min[i] = Math.min(box.min[i], a[i]); box.max[i] = Math.max(box.max[i], a[i]); } } });
  return { pes: box.min[1], cabeca: box.max[1], chao: v.y, yVis: v.yVis, prancha: v.yVis + 0.2, x: v.x, rot: [v.corpo.rotation.x, v.corpo.rotation.z, v.grupo.position.y] };
});
let m = await medir();
console.log('      ', JSON.stringify(m));
ok(m && m.pes > m.prancha - 0.08 && m.pes < m.prancha + 0.12, `pés em cima da prancha (pés ${m && (m.pes - m.chao).toFixed(2)} acima do chão, prancha ${m && (m.prancha - m.chao).toFixed(2)})`);
ok(m && m.cabeca - m.chao > 1.6, `a pessoa fica em pé (cabeça ${m && (m.cabeca - m.chao).toFixed(2)} acima do chão)`);
await p.screenshot({ path: `${SAIDA}/skate-${nome}-parado.png` });

// anda reto e sobe o meio bloco
async function andar(ms) {
  if (toque) {
    const vp = p.viewportSize(), jx = vp.width * 0.18, jy = vp.height * 0.7, cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx, y: jy - 50, id: 1 }] });
    await p.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else { await p.keyboard.down('KeyW'); await p.waitForTimeout(ms); await p.keyboard.up('KeyW'); }
}
const pos = () => ev(() => { const v = window.__jogo.garagem.dentro.v; return { x: v.x, y: v.y, z: v.z, vel: v.vel }; });
await andar(1200);
await p.screenshot({ path: `${SAIDA}/skate-${nome}-andando.png` });
m = await medir();
console.log('      ', JSON.stringify(m));
ok(m && m.pes > m.prancha - 0.08 && m.pes < m.prancha + 0.12, `andando, os pés continuam na prancha (${m && (m.pes - m.prancha).toFixed(2)})`);
await andar(1800);
let q = await pos();
ok(q.x > X0 + 13, `o skate andou e passou pelo meio bloco (x ${(q.x - X0).toFixed(1)})`);
console.log('      ', JSON.stringify(await medir()));

// teto baixo: a cabeça da pessoa não atravessa o bloco
await por(X0 + 6.5, Z0 + 8.5, -Math.PI / 2);
await p.waitForTimeout(400);
await andar(2500);
q = await pos();
ok(q.x < X0 + 12, `o skate para no teto baixo, a cabeça não atravessa o bloco (x ${(q.x - X0).toFixed(1)})`);

// desce e fica em pé no chão
await ev(() => window.__jogo.garagem.sair && window.__jogo.garagem.sair());
await p.waitForTimeout(800);
const j = await ev(() => { const j = window.__jogo.jog, g = window.__jogo.garagem; return { dentro: !!g.dentro, y: j.pos.y }; });
ok(!j.dentro && Math.abs(j.y - (Y + 1)) < 0.1, `desceu do skate e ficou em pé no chão (y ${j.y.toFixed(2)})`);

ok(erros.length === 0, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
console.log(falhas.length ? `${falhas.length} falharam` : 'todos passaram');
await b.close();
process.exit(falhas.length ? 1 : 0);

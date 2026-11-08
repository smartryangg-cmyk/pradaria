// Ilha de Aventura: moinhos da Colina dos Cata-ventos, portão do castelo que abre ao pisar,
// fábrica com esteiras e alavanca, farol que acende de noite. Navegador de verdade (WebGL).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const URL = process.env.URL || 'http://localhost:8765/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
const falhas = [];
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas.push(t); };
await p.goto(URL);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pradaria.local', JSON.stringify({ semente: 777, edicoes: [], opcoes: { tipo: 'aventura', mercado: true } })); });
await p.click('#bt-sozinho');
await p.waitForTimeout(5000);
const lug = await p.evaluate(() => window.__jogo.mundo.aventura.lugares.map((L) => ({ tipo: L.tipo, x: L.x, z: L.z, y: L.y, nome: L.nome, pecas: L.pecas.filter((q) => ['catavento', 'castelo', 'esteiras', 'torre', 'galpao'].includes(q.tipo)) })));
const tipos = lug.map((l) => l.tipo);
console.log('lugares:', tipos.join(', '));
const ir = (x, y, z, yaw, pitch) => p.evaluate(([x, y, z, yaw, pitch]) => { const { jog } = window.__jogo; jog.voando = true; Object.assign(jog.pos, { x, y, z }); jog.yaw = yaw; jog.pitch = pitch; }, [x, y, z, yaw, pitch]);
await p.evaluate(() => { window.__jogo.dia = 0.3; });
// moinhos
const col = lug.find((l) => l.tipo === 'catavento');
if (col) {
  const c = col.pecas[0];
  await ir(c.x + 0.5 + c.fx * 14, c.y + 7, c.z + 0.5 + c.fz * 14, Math.atan2(c.fx, c.fz), -0.1);
  await p.waitForTimeout(6000);
  const st = await p.evaluate(([c]) => { const m = window.__jogo.mundo; const P = (f, s, k) => m.bloco(c.x + c.fx * f - c.fz * s, c.y + k, c.z + c.fz * f + c.fx * s); return { cat: P(2, 0, 8), mo: P(0, 1, 1), lamp: P(1, 1, 1), helices: [...window.__jogo.mecanismos.ativos.values()].filter((a) => a.tipo === 'helice').length }; }, [c]);
  ok(st.cat === 50 && st.mo === 52 && st.lamp === 109, 'moinho da colina gerando energia e moendo ' + JSON.stringify(st));
  ok(st.helices >= 2, 'hélices girando na colina: ' + st.helices);
  await p.screenshot({ path: SAIDA + '/ilha-cataventos.png' });
} else ok(false, 'ilha sem Colina dos Cata-ventos');
// castelo: pisar na placa abre o portão
const cas = lug.find((l) => l.tipo === 'castelo');
if (cas) {
  const r = cas.pecas[0].r, xm = (r[0] + r[2]) >> 1, y = cas.y;
  const antes = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [xm, y + 1, r[1]]);
  await ir(xm + 0.5, y + 1.05, r[1] - 3.5, Math.PI, -0.1);
  await p.evaluate(() => { window.__jogo.jog.voando = false; });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: SAIDA + '/castelo-fechado.png' });
  await p.keyboard.down('w'); await p.waitForTimeout(900); await p.keyboard.up('w');
  await p.waitForTimeout(400);
  const dep = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [xm, y + 1, r[1]]);
  await p.screenshot({ path: SAIDA + '/castelo-aberto.png' });
  ok(antes === 110 && dep === 111, `portão do castelo abre ao pisar na placa (${antes} -> ${dep})`);
  await p.keyboard.down('w'); await p.waitForTimeout(1800); await p.keyboard.up('w');
  const pos = await p.evaluate(() => window.__jogo.jog.pos.z);
  ok(pos > r[1] + 1, 'passou pelo portão para dentro do castelo (z ' + pos.toFixed(1) + ' > ' + (r[1] + 1) + ')');
}
// fábrica: esteiras e alavanca
const fab = lug.find((l) => l.tipo === 'fabrica');
if (fab) {
  const e = fab.pecas.find((q) => q.tipo === 'esteiras');
  const [x0, z0, x1, z1] = e.r, y = e.y + 1, xm = (x0 + x1) >> 1;
  const blocos = await p.evaluate(([x0, y, z0]) => window.__jogo.mundo.bloco(x0 + 2, y, z0), [x0, y, z0]);
  ok(blocos >= 123 && blocos <= 126, 'fábrica tem esteira (' + blocos + ')');
  // liga a alavanca tocando nela
  await ir(xm + 0.5, y + 0.2, z1 - 0.5, 0, -0.75);
  await p.waitForTimeout(800);
  const sino0 = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [xm + 2, y + 1, z1 - 2]);
  await p.evaluate(() => window.__jogo.usar());
  await p.waitForTimeout(600);
  const r2 = await p.evaluate(([x, y, z]) => [window.__jogo.mundo.bloco(x, y, z), window.__jogo.mundo.bloco(x + 2, y, z)], [xm, y + 1, z1 - 2]);
  ok(r2[0] === 103 && r2[1] === 115, `alavanca da fábrica liga o sino (alavanca ${r2[0]}, sino ${sino0} -> ${r2[1]})`);
  await p.screenshot({ path: SAIDA + '/fabrica.png' });
  // anda na esteira: fica parado em cima e a esteira leva
  await ir(x0 + 3.5, y + 1.1, z0 + 0.5, Math.PI / 2, -0.3);
  await p.evaluate(() => { window.__jogo.jog.voando = false; });
  await p.waitForTimeout(400);
  const a = await p.evaluate(() => window.__jogo.jog.pos.x);
  await p.waitForTimeout(1500);
  const bpos = await p.evaluate(() => window.__jogo.jog.pos.x);
  ok(bpos - a > 0.5, 'esteira carrega o jogador (' + (bpos - a).toFixed(2) + ' blocos)');
}
// farol de noite
const far = lug.find((l) => l.tipo === 'farol');
if (far) {
  const t = far.pecas.find((q) => q.tipo === 'torre');
  const yp = t.y + t.alto + 1;
  await ir(t.x + 0.5 + 14, yp + 3, t.z + 0.5 + 14, Math.PI * 0.25, -0.15);
  await p.evaluate(() => { window.__jogo.dia = 0.82; });
  await p.waitForTimeout(5000);
  const l = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [t.x, yp + 1, t.z]);
  ok(l === 109, 'farol aceso de noite (' + l + ')');
  await p.screenshot({ path: SAIDA + '/farol-noite.png' });
}
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
console.log(falhas.length ? 'FALHAS: ' + falhas.length : 'TUDO OK');
await b.close();
process.exit(falhas.length ? 1 : 0);

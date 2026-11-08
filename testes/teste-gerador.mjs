// Mundo clássico: confere os ids, gera pedaços no worker e tira fotos de cada bioma e de uma caverna.
//   python3 -m http.server 8765 -d public   (em outro terminal)   ·   SAIDA=/tmp node testes/teste-gerador.mjs
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const URL = process.env.URL || 'http://localhost:8765/#teste';
const SEMENTE = +(process.env.SEMENTE || 20261108);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL);
// ids iguais nos dois arquivos
const ids = await p.evaluate(async () => {
  const { B } = await import('/js/blocos.js'); const { BE } = await import('/js/blocos-eras.js'); const { G } = await import('/js/gerador.js');
  const T = { ...B, NEVE: BE.BLOCO_NEVE, GRAMA_NEVE: BE.NEVE, GELO: BE.GELO, ARENITO: BE.ARENITO };
  return Object.entries(G).filter(([k, v]) => k !== 'AR' && T[k] !== v).map(([k]) => k);
});
console.log('ids diferentes:', ids.length ? ids.join(',') : 'nenhum');
await p.evaluate(([s, tam]) => {
  localStorage.clear();
  localStorage.setItem('pradaria.local', JSON.stringify({ semente: s, edicoes: [], opcoes: { gerador: 'classico', tamanho: tam } }));
}, [SEMENTE, process.env.TAMANHO || 'grande']);
await p.click('#bt-sozinho');
await p.waitForTimeout(5000);
const info = await p.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  return { gerador: mundo.opcoes.gerador, nivel: mundo.nivelAgua, pos: [jog.pos.x, jog.pos.y, jog.pos.z].map(Math.round), chunks: mundo.chunks.size, temGen: !!mundo.gen };
});
console.log(JSON.stringify(info));

// acha um lugar de cada bioma (perto da origem)
const lugares = await p.evaluate(() => {
  const { mundo } = window.__jogo;
  const achou = {};
  for (let r = 0; r < 2400; r += 24) for (let a = 0; a < 24; a++) {
    const x = Math.round(Math.cos(a / 24 * 6.283) * r), z = Math.round(Math.sin(a / 24 * 6.283) * r);
    const c = mundo.gen.coluna(x, z);
    if (achou[c.b] === undefined) achou[c.b] = [x, z, c.h];
  }
  return achou;
});
const NOMES = ['oceano', 'oceano-gelado', 'praia', 'rio', 'planicie', 'floresta', 'taiga', 'neve', 'deserto', 'savana', 'selva', 'montanha', 'rio-gelado'];
console.log('biomas achados:', Object.keys(lugares).map((k) => NOMES[k]).join(', '));

async function ir(x, y, z, yaw, pitch, nome, espera = 7000) {
  await p.evaluate(([x, y, z, yaw, pitch]) => { const { jog } = window.__jogo; jog.voando = true; Object.assign(jog.pos, { x, y, z }); jog.vel && Object.assign(jog.vel, { x: 0, y: 0, z: 0 }); jog.yaw = yaw; jog.pitch = pitch; window.__jogo.dia = 0.3; }, [x, y, z, yaw, pitch]);
  await p.waitForTimeout(espera);
  await p.screenshot({ path: `${SAIDA}/classico-${nome}.png` });
}
for (const k of [4, 5, 6, 7, 8, 9, 10, 11, 0]) {
  if (!lugares[k]) continue;
  const [x, z, h] = lugares[k];
  await ir(x + 0.5, Math.max(h, 40) + 14, z + 20.5, 0, -0.45, NOMES[k]);
}
// caverna: procura ar debaixo da terra perto do jogador
const cav = await p.evaluate(() => {
  const { mundo } = window.__jogo;
  for (let x = -60; x < 60; x += 3) for (let z = -60; z < 60; z += 3) {
    const h = mundo.alturaEm(x, z);
    for (let y = 8; y < h - 8; y++) if (mundo.bloco(x, y, z) === 0 && mundo.bloco(x, y + 1, z) === 0 && mundo.bloco(x, y - 1, z) !== 0) return [x, y, z];
  }
  return null;
});
console.log('caverna em', JSON.stringify(cav));
if (cav) {
  await p.evaluate(() => { window.__jogo.dia = 0.3; });
  await ir(cav[0] + 0.5, cav[1] + 0.2, cav[2] + 0.5, 0.8, -0.1, 'caverna');
}
// conta minérios no pedaço do jogador e vê se o worker trabalhou
const conta = await p.evaluate(() => {
  const { mundo } = window.__jogo;
  const n = {};
  for (const c of mundo.chunks.values()) for (const b of c.dados) if (b >= 60) n[b] = (n[b] || 0) + 1;
  return { n, pedidos: mundo.pedidos.size, chunks: mundo.chunks.size };
});
console.log(JSON.stringify(conta));
// tempo de quadro andando (o worker tem que evitar travadas)
const quadros = await p.evaluate(() => new Promise((r) => {
  const { jog } = window.__jogo; jog.voando = true; let n = 0, pior = 0, t0 = performance.now(), ult = t0;
  const f = () => { const t = performance.now(); pior = Math.max(pior, t - ult); ult = t; n++; jog.pos.x += 0.6; if (t - t0 < 5000) requestAnimationFrame(f); else r({ fps: n / 5, pior: Math.round(pior) }); };
  requestAnimationFrame(f);
}));
console.log('andando', JSON.stringify(quadros));
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros');
await b.close();

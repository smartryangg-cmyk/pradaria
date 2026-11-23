// Luz dos blocos se espalhando (como nos jogos de blocos clássicos), jogando pela tela do tablet:
// numa caverna funda e fechada está escuro; colocar um lampião com a mão clareia o chão em volta
// (mais perto, mais claro), a luz não atravessa parede de pedra, e tirar o lampião escurece de novo.
//   python3 -m http.server 8765 -d public   ·   SAIDA=/tmp node testes/teste-luz.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, t) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + t); if (!c) falhas++; };
const erros = [];
const PEDRA = 3, LAMPIAO = 21;

const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload();
await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await p.waitForTimeout(4000);
// duas salas fechadas, 20 blocos embaixo da terra, separadas por uma parede de pedra
const base = await p.evaluate(([PEDRA, LAMPIAO]) => {
  const J = window.__jogo, m = J.mundo, j = J.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), topo = m.chao(x0, z0);
  // 20 blocos abaixo do ponto mais baixo do terreno original em volta: perto de um barranco, o jogo só desenha
  // paredes de caverna fundas quando o jogador está mesmo embaixo da terra (mundo.js FUNDO_CAVERNA)
  let baixo = topo;
  if (m.gen) for (let x = -8; x <= 13; x++) for (let z = -7; z <= 7; z++) baixo = Math.min(baixo, m.gen.alturaEm(x0 + x, z0 + z));
  const y0 = Math.max(4, baixo - 20);
  for (let x = -7; x <= 12; x++) for (let z = -6; z <= 6; z++) for (let y = y0 - 1; y <= topo; y++) {
    const dentro = y >= y0 && y <= y0 + 3 && Math.abs(z) <= 4 && ((x >= -5 && x <= 4) || (x >= 6 && x <= 10));
    m.definir(x0 + x, y, z0 + z, dentro ? 0 : PEDRA);
  }
  j.voando = false; j.pos.x = x0 - 3.5; j.pos.y = y0; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = -Math.PI / 2; j.pitch = -0.55;
  J.dia = 0.3; J.barra[0] = LAMPIAO; J.slot = 0;
  const me = J.mercado; me.e.itens[LAMPIAO] = 2; me.recebeu(me.e);
  return [x0, y0, z0];
}, [PEDRA, LAMPIAO]);
const [x0, y0, z0] = base;
// claridade (cor dos cantos) do topo do bloco de chão em (x, y0-1, z)
const claro = (x, z) => p.evaluate(([x, y, z]) => {
  const M = window.__jogo.mundo, cx = Math.floor(x / 16), cz = Math.floor(z / 16), c = M.chunks.get(cx + ',' + cz);
  if (!c || !c.malha) return -1;
  const g = c.malha.geometry, P = g.attributes.position.array, C = g.attributes.color.array, lx = x - cx * 16, lz = z - cz * 16;
  let s = 0, n = 0;
  for (let i = 0; i < P.length; i += 3) {
    if (Math.abs(P[i + 1] - (y + 1)) > 0.3 || P[i] < lx - 0.01 || P[i] > lx + 1.01 || P[i + 2] < lz - 0.01 || P[i + 2] > lz + 1.01) continue;
    s += C[i]; n++;
  }
  return n ? +(s / n).toFixed(3) : -1;
}, [x, y0 - 1, z]);
// espera as malhas dos pedaços da caverna serem refeitas (no aparelho lento leva mais que um tempo fixo)
const assentar = () => p.waitForFunction(([x0, z0]) => {
  const M = window.__jogo.mundo;
  for (let cx = Math.floor((x0 - 8) / 16); cx <= Math.floor((x0 + 13) / 16); cx++) for (let cz = Math.floor((z0 - 7) / 16); cz <= Math.floor((z0 + 7) / 16); cz++) {
    const c = M.chunks.get(cx + ',' + cz); if (!c || !c.malha || c.sujo || c.prioridade || (M.montagem && M.montagem.c === c)) return false;
  }
  return true;
}, [x0, z0], { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(1500); await assentar();
const perto0 = await claro(x0 + 1, z0), longe0 = await claro(x0 - 4, z0 + 3), outra0 = await claro(x0 + 7, z0);
ok(perto0 > 0 && perto0 < 0.5 && outra0 > 0 && outra0 < 0.5, `caverna funda e fechada é escura (chão ${perto0}, sala do lado ${outra0})`);
await p.screenshot({ path: SAIDA + '/luz-1-escuro.png' });
// põe o lampião no chão com a mão (toque no meio da tela, mirando o chão em x0, z0)
const meio = await p.evaluate(() => ({ x: innerWidth / 2, y: innerHeight / 2 }));
for (let k = 0; k < 4; k++) {
  await p.evaluate(([x0, y0, z0]) => { const J = window.__jogo, j = J.jog, c = J.camera, dx = x0 + 0.5 - j.pos.x, dz = z0 + 0.5 - j.pos.z; j.yaw = Math.atan2(-dx, -dz); j.pitch = -Math.atan2(c.position.y - y0, Math.hypot(dx, dz)); }, base);
  await p.waitForTimeout(250);
  await p.touchscreen.tap(meio.x, meio.y);
  await p.waitForTimeout(500);
  if (await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x0, y0, z0]) === LAMPIAO) break;
}
const pos = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x0, y0, z0]);
ok(pos === LAMPIAO, 'colocou o lampião no chão da caverna com a mão');
await p.waitForTimeout(1200); await assentar();
const perto1 = await claro(x0 + 1, z0), meio1 = await claro(x0 - 3, z0), longe1 = await claro(x0 - 5, z0 + 4), outra1 = await claro(x0 + 7, z0);
ok(perto1 > perto0 + 0.25, `o lampião clareia o chão do lado (${perto0} -> ${perto1})`);
ok(perto1 > meio1 && meio1 > perto0, `a luz vai diminuindo com a distância (1 bloco ${perto1}, 3 blocos ${meio1})`);
ok(Math.abs(outra1 - outra0) < 0.02, `a luz não atravessa a parede de pedra (sala do lado ${outra0} -> ${outra1})`);
void longe0; void longe1;
await p.evaluate(() => { window.__jogo.dia = 0.75; });
await p.waitForTimeout(800);
await p.screenshot({ path: SAIDA + '/luz-2-lampiao.png' });
// tira o lampião: escurece de novo
await p.evaluate(([x, y, z]) => window.__jogo.mundo.definir(x, y, z, 0), [x0, y0, z0]);
await p.waitForTimeout(1200); await assentar();
const perto2 = await claro(x0 + 1, z0);
ok(Math.abs(perto2 - perto0) < 0.02, `tirou o lampião: escurece de novo (${perto2})`);
// na superfície, de dia, nada mudou: o chão ao ar livre continua claro
const fora = await p.evaluate(([x0, z0]) => { const M = window.__jogo.mundo; return M.chao(x0 + 30, z0 + 30); }, base);
ok(fora > 0, 'superfície carregada');
ok(!erros.length, 'console sem erros ' + erros.slice(0, 3).join(' | '));
await b.close();
console.log(falhas ? `FALHOU (${falhas})` : 'tudo certo');
process.exit(falhas ? 1 : 0);

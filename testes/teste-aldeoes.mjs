// Aldeões sem bugs, jogando de verdade online: Ana (PC) cria o mundo, Beto (tablet, toque) entra pelo código.
// Os dois ficam na praça da vila e observam os moradores por um tempo (de dia e à noite):
// ninguém pode se teletransportar, entrar em bloco, flutuar, andar dentro do outro, nem passar pelo jogador.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const SEG = +(process.env.SEG || 40);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
let falhas = 0;
const ok = (c, t) => { console.log(c ? 'OK  ' : 'FALHA', t); if (!c) falhas++; };
async function jogador(nome, tablet) {
  const ctx = await b.newContext(tablet ? { ...devices['Galaxy Tab S4 landscape'] } : { viewport: { width: 1024, height: 640 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p[tablet ? 'tap' : 'click']('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await p[tablet ? 'tap' : 'click']('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Vilinha'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.tap('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.tap('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });

// os dois na praça da vila, olhando para uma rua
const irPraca = (p, lado) => p.evaluate((lado) => {
  const { jog, mundo } = window.__jogo; const v = mundo.vilas.regiao(0, 0); const r = v.ruas[0];
  jog.voando = true; Object.assign(jog.pos, { x: v.x + 0.5 + r.dz * 2 * lado, y: v.y + 4, z: v.z + 0.5 - r.dx * 2 * lado });
  jog.yaw = Math.atan2(-r.dx, -r.dz); jog.pitch = -0.35; window.__jogo.dia = 0.25;
}, lado);
await irPraca(a, 1); await irPraca(bb, -1);
await a.waitForTimeout(3000);

// mede em cada navegador, quadro a quadro
const medir = (p, seg) => p.evaluate(async (seg) => {
  const { aldeoes, mundo, jog } = window.__jogo;
  const { SOLIDO } = await import('/js/blocos.js');
  const c = { teleporte: 0, dentroBloco: 0, juntos: 0, noJogador: 0, quadros: 0, andou: 0 };
  const ult = new Map(); const t0 = performance.now();
  await new Promise((fim) => {
    const f = () => {
      if (performance.now() - t0 > seg * 1000) return fim();
      c.quadros++;
      const L = aldeoes.lista.filter((x) => x.grupo.visible);
      for (const x of L) {
        const u = ult.get(x);
        if (u) { const d = Math.hypot(x.x - u.x, x.z - u.z); if (d > 0.6) c.teleporte++; c.andou += d; }
        ult.set(x, { x: x.x, z: x.z });
        if (SOLIDO[mundo.bloco(Math.floor(x.x), Math.floor(x.y + 0.05), Math.floor(x.z))] || SOLIDO[mundo.bloco(Math.floor(x.x), Math.floor(x.y + 1.2), Math.floor(x.z))]) c.dentroBloco++;
        if (Math.hypot(x.x - jog.pos.x, x.z - jog.pos.z) < 0.45 && Math.abs(x.y - jog.pos.y) < 1.5) c.noJogador++;
      }
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z) < 0.45 && Math.abs(L[i].y - L[j].y) < 1) c.juntos++;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  c.andou = Math.round(c.andou); c.n = aldeoes.lista.length;
  return c;
}, seg);
const [ca, cb] = await Promise.all([medir(a, SEG), medir(bb, SEG)]);
console.log('dia  Ana (PC)', JSON.stringify(ca)); console.log('dia  Beto (tablet)', JSON.stringify(cb));
for (const [quem, c] of [['Ana (PC)', ca], ['Beto (tablet)', cb]]) {
  ok(c.n >= 2 && c.andou > 10, `${quem}: ${c.n} moradores passeando (${c.andou} blocos andados)`);
  ok(c.teleporte === 0, `${quem}: nenhum morador se teletransportou (${c.teleporte})`);
  ok(c.dentroBloco === 0, `${quem}: nenhum morador dentro de bloco (${c.dentroBloco})`);
  ok(c.juntos <= 3, `${quem}: moradores não andam um dentro do outro (${c.juntos} quadros)`);
  ok(c.noJogador === 0, `${quem}: moradores não atravessam o jogador (${c.noJogador})`);
}
await a.screenshot({ path: `${SAIDA}/aldeoes-pc.png` });
await bb.screenshot({ path: `${SAIDA}/aldeoes-tablet.png` });

// noite: quem tem casa entra (abrindo a porta) e vai dormir
await a.evaluate(() => { window.__jogo.dia = 0.75; }); await bb.evaluate(() => { window.__jogo.dia = 0.75; });
const [na] = await Promise.all([medir(a, SEG * 1.5), medir(bb, SEG * 1.5)]);
const casa = await a.evaluate(() => window.__jogo.aldeoes.lista.filter((x) => x.casa).map((x) => Math.hypot(x.x - x.casa.dentro[0] - 0.5, x.z - x.casa.dentro[1] - 0.5) < 1.2));
console.log('noite Ana (PC)', JSON.stringify(na), JSON.stringify(casa));
ok(na.teleporte === 0 && na.dentroBloco === 0, `à noite também sem teleporte nem bloco (${na.teleporte}/${na.dentroBloco})`);
ok(casa.filter(Boolean).length >= Math.ceil(casa.length / 2), `à noite os moradores entram em casa (${casa.filter(Boolean).length} de ${casa.length})`);
await a.evaluate(() => { const { jog, mundo } = window.__jogo; const v = mundo.vilas.regiao(0, 0); Object.assign(jog.pos, { x: v.x + 12.5, y: v.y + 9, z: v.z + 12.5 }); jog.yaw = Math.PI * 0.75; jog.pitch = -0.35; });
await a.waitForTimeout(2000);
await a.screenshot({ path: `${SAIDA}/aldeoes-noite.png` });

ok(erros.length === 0, 'console sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK');
process.exit(falhas ? 1 : 0);

// Movimentos no online, dois jogadores de verdade (precisa do servidor local: npm run dev:sala e npm run dev).
// Ana anda (W), corre (Shift+W) e agacha (Z) no teclado; Beto vê o boneco dela animado na velocidade
// das posições recebidas e com as flags novas (16 = correndo, 32 = agachado).
// Uso: URL=http://localhost:8788 node testes/teste-movimentos-online.mjs
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
let falhas = 0;
const ok = (c, t) => { console.log(c ? 'OK  ' : 'FALHA', t); if (!c) falhas++; };
async function jogador(nome) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 20000 });
  return p;
}
const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Corrida'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
await bb.waitForTimeout(1500);
// chão plano de pedra (vai pela rede); Ana no meio olhando para o sul (+z), Beto 7 blocos a leste olhando para ela
const pa = await a.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog;
  const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.floor(j.pos.y) + 1;
  for (let x = -4; x <= 9; x++) for (let z = -3; z <= 22; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); for (let y = 0; y < 5; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.yaw = Math.PI; j.pitch = 0; J.dia = 0.3;
  return { x: j.pos.x, y: j.pos.y, z: j.pos.z };
});
await a.waitForTimeout(1000);
await bb.evaluate((pa) => {
  const J = window.__jogo, j = J.jog;
  j.pos.x = pa.x + 7; j.pos.z = pa.z + 4; j.pos.y = pa.y; j.yaw = Math.PI / 2; j.pitch = -0.15; J.dia = 0.3;
  // só para os prints: a câmera do Beto acompanha a Ana de lado
  const v = J.visao, orig = v.quadro.bind(v);
  v.quadro = (...arg) => {
    const r = orig(...arg), o = J.outrosLista[0];
    if (r && o) { const g = o.grupo.position; J.camera.position.set(g.x + 5, g.y + 1.8, g.z); J.camera.lookAt(g.x, g.y + 0.8, g.z); }
    return r;
  };
}, pa);
// gravador no navegador do Beto: o que ele viu no boneco da Ana
const gravar = () => bb.evaluate(() => {
  const r = window.__rec = { acao: 0, perna: 0, tronco: 0, quadril: 0, antebraco: 0, v: 0 };
  const f = () => {
    const o = window.__jogo.outrosLista[0];
    if (o && o.anim) {
      r.acao |= o.acao | 0; r.perna = Math.max(r.perna, Math.abs(o.membros[2].rotation.x)); r.tronco = Math.max(r.tronco, o.tronco.rotation.x);
      r.quadril = Math.min(r.quadril, o.quadril.position.y); r.antebraco = Math.min(r.antebraco, o.antebracos[0].rotation.x); r.v = Math.max(r.v, Math.hypot(o.vAnim.x, o.vAnim.z));
    }
    if (window.__rec === r) requestAnimationFrame(f);
  };
  f();
});
const lido = () => bb.evaluate(() => { const r = window.__rec; window.__rec = null; return r; });
const voltar = () => a.evaluate((pa) => { const j = window.__jogo.jog; j.pos.x = pa.x; j.pos.z = pa.z; j.pos.y = pa.y; j.vel.x = j.vel.z = 0; j.yaw = Math.PI; }, pa);
const fmt = (r) => Object.entries(r).map(([k, v]) => k + ' ' + (+v).toFixed(2)).join(', ');

// anda
await gravar();
await a.keyboard.down('KeyW'); await a.waitForTimeout(1400);
await bb.screenshot({ path: `${SAIDA}/online-ana-andando.png` });
await a.keyboard.up('KeyW');
let r = await lido();
// (a passada segue a velocidade que chega pela rede: com a máquina carregada a Ana anda menos por segundo)
ok(r.v > 0.5 && r.perna > Math.min(0.5, r.v * 0.2) * 0.7 && !(r.acao & 48), `Beto vê a Ana andando: ${fmt(r)}`);
await voltar(); await a.waitForTimeout(1200);
// corre
await gravar();
await a.keyboard.down('ShiftLeft'); await a.keyboard.down('KeyW'); await a.waitForTimeout(1400);
await bb.screenshot({ path: `${SAIDA}/online-ana-correndo.png` });
await a.keyboard.up('KeyW'); await a.keyboard.up('ShiftLeft');
r = await lido();
ok(r.acao & 16 && r.tronco > 0.2 && r.antebraco < -1 && r.perna > Math.min(0.85, r.v * 0.2) * 0.7, `Beto vê a Ana correndo (flag 16 chegou pela sala): ${fmt(r)}`);
await voltar(); await a.waitForTimeout(1200);
// agacha (e anda agachada)
await gravar();
await a.keyboard.down('KeyZ'); await a.waitForTimeout(700); await a.keyboard.down('KeyW'); await a.waitForTimeout(1200);
await bb.screenshot({ path: `${SAIDA}/online-ana-agachada.png` });
await a.keyboard.up('KeyW'); await a.keyboard.up('KeyZ');
r = await lido();
ok(r.acao & 32 && r.quadril < -0.35, `Beto vê a Ana agachada (flag 32 chegou pela sala): ${fmt(r)}`);
console.log('erros:', erros.length ? erros : 'nenhum');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

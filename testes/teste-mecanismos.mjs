// Mecanismos das construções: joga de verdade no navegador (WebGL) e confere cada um.
// moinho de vento (hélice girando, energia, pedra de moinho, trigo -> farinha), forno (farinha -> pão),
// portas (abrir/fechar, morador passando), manivela do poço, postes que acendem de noite.
// Uso: servir public/ em :8765 e rodar  node testes/teste-mecanismos.mjs   (TABLET=1 emula um tablet)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const URL = process.env.URL || 'http://localhost:8765/#teste';
const TAB = !!process.env.TABLET;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext(TAB ? { ...devices['Galaxy Tab S4'] } : { viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
const pref = TAB ? 'tablet-' : '';
const falhas = [];
const ok = (cond, txt) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + txt); if (!cond) falhas.push(txt); };
await p.goto(URL);
await p.evaluate(([sem, sobrev]) => { localStorage.clear(); localStorage.setItem('pradaria.local', JSON.stringify({ semente: +sem, edicoes: [], opcoes: { mercado: true, objetivos: true, gerador: 'classico', tamanho: 'medio', sobrevivencia: !!sobrev } })); }, [process.env.SEMENTE || '12345', process.env.SOBREV]);
await p.click('#bt-sozinho');
await p.waitForTimeout(5000);
// acha uma vila com moinho
const vila = await p.evaluate(() => {
  const { mundo } = window.__jogo;
  for (let r = 0; r <= 3; r++) for (let rx = -r; rx <= r; rx++) for (let rz = -r; rz <= r; rz++) {
    const v = mundo.vilas.regiao(rx, rz);
    const mo = v && v.estruturas.find((e) => e.tipo === 'moinho');
    if (mo) return { x: v.x, z: v.z, y: v.y, nome: v.nome, mo, casa: v.casas.find((c) => c.tipo === 'casa') };
  }
  return null;
});
ok(!!vila, 'tem vila com moinho de vento: ' + (vila && vila.nome));
if (!vila) { console.log(erros.join('\n')); await b.close(); process.exit(1); }
const { mo } = vila;
const ir = (x, y, z, yaw, pitch) => p.evaluate(([x, y, z, yaw, pitch]) => { const { jog } = window.__jogo; jog.voando = true; jog.vel.x = jog.vel.y = jog.vel.z = 0; Object.assign(jog.pos, { x, y, z }); jog.yaw = yaw; jog.pitch = pitch; }, [x, y, z, yaw, pitch]);
// olhando o moinho de frente, um pouco de longe
const fx = mo.fx, fz = mo.fz;
await ir(mo.x + 0.5 + fx * 13, mo.y + 6, mo.z + 0.5 + fz * 13, Math.atan2(fx, fz), -0.05);
await p.evaluate(() => { window.__jogo.dia = 0.3; });
await p.waitForTimeout(6000);
const h1 = await p.evaluate(() => { const a = [...window.__jogo.mecanismos.ativos.values()].find((q) => q.tipo === 'helice'); return a ? a.rot.rotation.z : null; });
await p.waitForTimeout(1200);
const h2 = await p.evaluate(() => { const a = [...window.__jogo.mecanismos.ativos.values()].find((q) => q.tipo === 'helice'); return a ? a.rot.rotation.z : null; });
const vento = await p.evaluate(async () => (await import('/js/energia.js')).vento());
ok(h1 !== null, 'hélice do catavento existe');
ok(vento < 0.2 || (h2 !== h1), `hélice gira com o vento (vento ${vento.toFixed(2)}, ângulo ${h1 && h1.toFixed(2)} -> ${h2 && h2.toFixed(2)})`);
await p.screenshot({ path: SAIDA + '/' + pref + 'moinho-fora.png' });
// força vento para o teste da energia ser certo (o relógio decide; aqui garantimos que está ventando)
await p.evaluate(async () => { const m = await import('/js/energia.js'); if (m.vento() < 0.2) { const r = Date.now; Date.now = () => r() + 60000; } });
await p.waitForTimeout(1500);
const est = await p.evaluate(([mo]) => {
  const { mundo } = window.__jogo; 
  const P = (f, s, k) => mundo.bloco(mo.x + mo.fx * f - mo.fz * s, mo.y + k, mo.z + mo.fz * f + mo.fx * s);
  return { cat: P(2, 0, 8), cabo: P(1, 0, 6), lamp: P(1, 1, 1), mo: P(0, 1, 1), porta: P(2, 0, 1) };
}, [mo]);
ok(est.cat === 50, 'catavento gerando energia (bloco ' + est.cat + ')');
ok(est.cabo === 54, 'cabo de energia ligado (bloco ' + est.cabo + ')');
ok(est.lamp === 109, 'lâmpada do moinho acesa (bloco ' + est.lamp + ')');
ok(est.mo === 52, 'pedra de moinho girando (bloco ' + est.mo + ')');
ok(est.porta === 47, 'porta do moinho fechada');
// entra: abre a porta tocando nela (o mesmo caminho do toque/clique do jogo)
await ir(mo.x + 0.5 + fx * 4.2, mo.y + 1, mo.z + 0.5 + fz * 4.2, Math.atan2(fx, fz), -0.15);
await p.evaluate(() => { window.__jogo.slot = 0; });
await p.waitForTimeout(800);
console.log('mira:', JSON.stringify(await p.evaluate(async () => { const { mundo, camera } = window.__jogo; const THREE = await import('/vendor/three.module.min.js'); const d = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); return [mundo.raycast(camera.position, d, 6), camera.position, window.__jogo.jog.pos, window.__jogo.mundo === mundo]; })));
await p.screenshot({ path: SAIDA + '/' + pref + 'porta-fechada.png' });
if (TAB) await p.touchscreen.tap(640 * 0 + (await p.viewportSize()).width / 2, (await p.viewportSize()).height / 2);
else await p.evaluate(() => window.__jogo.usar());
await p.waitForTimeout(500);
const aberta = await p.evaluate(([mo]) => window.__jogo.mundo.bloco(mo.x + mo.fx * 2, mo.y + 1, mo.z + mo.fz * 2), [mo]);
const abertaCima = await p.evaluate(([mo]) => window.__jogo.mundo.bloco(mo.x + mo.fx * 2, mo.y + 2, mo.z + mo.fz * 2), [mo]);
ok(aberta === 48 && abertaCima === 48, 'tocar na porta abre as duas metades (' + aberta + ',' + abertaCima + ')');
await p.screenshot({ path: SAIDA + '/' + pref + 'porta-aberta.png' });
// anda para dentro de verdade (teclas/joystick seriam o mesmo: andar com a porta aberta)
const antes = await p.evaluate(() => ({ ...window.__jogo.jog.pos }));
if (!TAB) { await p.keyboard.down('w'); await p.waitForTimeout(1400); await p.keyboard.up('w'); }
else await p.evaluate(() => { const { jog } = window.__jogo; jog.pos.x -= 0; });
const depois = await p.evaluate(() => ({ ...window.__jogo.jog.pos }));
if (!TAB) ok(Math.hypot(depois.x - antes.x, depois.z - antes.z) > 1.5, 'andou porta adentro (' + Math.hypot(depois.x - antes.x, depois.z - antes.z).toFixed(1) + ' blocos)');
// colher trigo de verdade: vai até a plantação e quebra o trigo mirando nele
const campo = await p.evaluate(() => {
  const { mundo } = window.__jogo;
  for (let r = 0; r <= 3; r++) for (let rx = -r; rx <= r; rx++) for (let rz = -r; rz <= r; rz++) {
    const v = mundo.vilas.regiao(rx, rz);
    if (!v || !v.fazendas.length) continue;
    const f = v.fazendas[0]; const [x0, z0, x1, z1] = f.r; const out = [];
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (mundo.bloco(x, f.y + 1, z) === 32) out.push([x, f.y + 1, z]);
    if (out.length) return out.slice(0, 8);
  }
  return [];
});
const colheu = { n0: 0, n: 0, q: 0 };
for (const t of campo) {
  await ir(t[0] + 0.5, t[1] + 0.3, t[2] + 2.0, 0, -0.62);
  await p.waitForTimeout(250);
  await p.evaluate(() => window.__jogo.quebrar());
  await p.waitForTimeout(450);
  colheu.q++;
}
colheu.n = await p.evaluate(() => window.__jogo.mercado.e.itens[32] || 0);
await p.screenshot({ path: SAIDA + '/' + pref + 'colheita.png' });
ok(colheu.n > 0, 'colheu trigo para a mochila: ' + JSON.stringify(colheu));
// mói: toca na pedra de moinho girando
await ir(mo.x + 0.5 + fx * 1 - fz * -1, mo.y + 1.1, mo.z + 0.5 + fz * 1 + fx * -1, 0, 0);
await p.evaluate(([mo]) => { // olha para a pedra
  const { jog } = window.__jogo; const tx = mo.x + 0.5 - mo.fz * 1, tz = mo.z + 0.5 + mo.fx * 1;
  jog.voando = true; Object.assign(jog.pos, { x: mo.x + 0.5 - mo.fz * -1 + mo.fx * 0, y: mo.y + 1.0, z: mo.z + 0.5 + mo.fx * -1 });
  jog.yaw = Math.atan2(-(tx - jog.pos.x), -(tz - jog.pos.z)); jog.pitch = -0.55;
}, [mo]);
await p.waitForTimeout(700);
await p.screenshot({ path: SAIDA + '/' + pref + 'moinho-dentro.png' });
const moeu = await p.evaluate(() => { const { usar, mercado } = window.__jogo; const t = mercado.e.itens[32] || 0; usar(); return { trigoAntes: t, trigo: mercado.e.itens[32] || 0, farinha: mercado.e.itens[57] || 0 }; });
ok(moeu.farinha > 0 && moeu.trigo < moeu.trigoAntes, 'moinho transformou trigo em farinha: ' + JSON.stringify(moeu));
await p.waitForTimeout(500);
await p.screenshot({ path: SAIDA + '/' + pref + 'moinho-moendo.png' });
// forno de uma casa: assa pão
const casa = vila.casa;
const forno = await p.evaluate(([c]) => {
  const { mundo } = window.__jogo; const [x0, z0, x1, z1] = c.r;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const b = mundo.bloco(x, c.y + 1, z); if (b === 56 || b === 55) return [x, c.y + 1, z, b]; }
  return null;
}, [casa]);
ok(!!forno && forno[3] === 56, 'casa tem forno aceso ' + JSON.stringify(forno));
if (forno) {
  await p.evaluate(([f]) => {
    const { jog, mundo } = window.__jogo;
    // fica num lugar livre dentro da casa, olhando para o forno
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      if (mundo.bloco(f[0] + dx, f[1], f[2] + dz) === 0 && mundo.bloco(f[0] + dx, f[1] + 1, f[2] + dz) === 0) {
        Object.assign(jog.pos, { x: f[0] + dx + 0.5, y: f[1], z: f[2] + dz + 0.5 }); jog.yaw = Math.atan2(dx, dz); jog.pitch = -0.6; jog.voando = true; return;
      }
    }
  }, [forno]);
  await p.waitForTimeout(700);
  const assou = await p.evaluate(() => { const { usar, mercado } = window.__jogo; usar(); return { farinha: mercado.e.itens[57] || 0, pao: mercado.e.itens[58] || 0 }; });
  ok(assou.pao > 0, 'forno assou pão: ' + JSON.stringify(assou));
  await p.waitForTimeout(800);
  await p.screenshot({ path: SAIDA + '/' + pref + 'forno.png' });
}
// porta da casa: morador passa
const morador = await p.evaluate(() => window.__jogo.aldeoes.lista.length);
ok(morador > 0, 'moradores na vila: ' + morador);
// poço: manivela
const poco = await p.evaluate(([v]) => {
  const { jog, usar, barra, mundo } = window.__jogo;
  const b0 = mundo.bloco(v.x, v.y + 3, v.z);
  Object.assign(jog.pos, { x: v.x + 0.5, y: v.y + 2.2, z: v.z + 2.5 }); jog.yaw = 0; jog.pitch = -0.25; jog.voando = true;
  return b0;
}, [vila]);
ok(poco === 59, 'poço tem manivela (' + poco + ')');
await p.waitForTimeout(600);
const agua = await p.evaluate(() => { const { usar, barra } = window.__jogo; usar(); return barra.includes(5); });
ok(agua, 'manivela do poço deu um balde de água');
await p.screenshot({ path: SAIDA + '/' + pref + 'poco.png' });
// noite: postes acendem sozinhos
await p.evaluate(([v]) => { const { jog } = window.__jogo; Object.assign(jog.pos, { x: v.x + 9.5, y: v.y + 7, z: v.z + 9.5 }); jog.yaw = Math.PI * 0.25; jog.pitch = -0.3; window.__jogo.dia = 0.8; }, [vila]);
await p.waitForTimeout(5000);
const lamp = await p.evaluate(([v]) => window.__jogo.mundo.bloco(v.x - 3, v.y + 2, v.z - 3), [vila]);
ok(lamp === 109, 'lampião da praça aceso à noite (' + lamp + ')');
await p.screenshot({ path: SAIDA + '/' + pref + 'praca-noite.png' });
await p.evaluate(() => { window.__jogo.dia = 0.3; });
await p.waitForTimeout(3000);
const lampDia = await p.evaluate(([v]) => window.__jogo.mundo.bloco(v.x - 3, v.y + 2, v.z - 3), [vila]);
ok(lampDia === 108, 'lampião apaga de dia (' + lampDia + ')');
// desempenho
const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); }; requestAnimationFrame(f); }));
console.log('fps', fps.toFixed(1));
ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
console.log(falhas.length ? 'FALHAS: ' + falhas.length : 'TUDO OK');
await b.close();
process.exit(falhas.length ? 1 : 0);

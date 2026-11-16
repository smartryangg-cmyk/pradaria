// A câmera nunca entra nos blocos: encostado em paredes e quinas, pulando em teto baixo, agachando
// para passar em vão baixo e levantando, subindo escada e meio bloco com teto, e nas formas redondas.
// Em cada quadro desenhado confere o plano de perto da câmera (os 4 cantos e o meio): se algum ponto
// cair dentro de um bloco sólido, a tela mostra o lado de dentro do bloco ("a cabeça entrou").
// Joga de verdade com o teclado (1ª pessoa e as duas 3ª pessoas) e também no tablet com os botões.
// Uso: (cd public && python3 -m http.server 8771) e depois: node testes/teste-cabeca.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8771';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg, extra = '') => { console.log((ok ? 'OK    ' : 'FALHA ') + msg + (extra !== '' ? '  ' + JSON.stringify(extra) : '')); if (!ok) falhas.push(msg); };

async function abrir(ctx, toque) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await p.goto(BASE + '/#teste');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(600);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 20000 });
  await p.waitForTimeout(2500);
  await p.evaluate(async () => {
    const g = window.__jogo, M = g.mundo;
    const { B, SOLIDO } = await import('/js/blocos.js');
    const { F } = await import('/js/formas-defs.js');
    const { FORMA_NOVA, colideForma } = await import('/js/formas.js');
    const quadros = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    // lugar baixo e limpo
    const X = Math.floor(g.jog.pos.x) + 40, Z = Math.floor(g.jog.pos.z), Y = 50;
    const cubo = (x0, x1, y0, y1, z0, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (M.bloco(x, y, z) !== id) M.definir(x, y, z, id); };
    cubo(X - 8, X + 24, Y, 95, Z - 8, Z + 24, 0);
    cubo(X - 8, X + 24, Y, Y, Z - 8, Z + 24, B.PEDRA);
    const get = (a, b2, c) => M.bloco(a, b2, c);
    // o ponto está dentro de algo sólido?
    const dentro = (x, y, z) => {
      const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
      for (let dy = -1; dy <= 0; dy++) { // a cerca (1,5) passa para a célula de cima
        const k = M.bloco(bx, by + dy, bz);
        if (!SOLIDO[k]) continue;
        if (!FORMA_NOVA[k]) { if (dy === 0) return k; continue; }
        const e = 0.002;
        if (colideForma(k, get, bx, by + dy, bz, x - e, y - e, z - e, x + e, y + e, z + e)) return k;
      }
      return 0;
    };
    // cantos do plano de perto da câmera (em coordenadas do mundo)
    const cam = g.camera, V = cam.position.constructor;
    const pts = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(() => new V());
    const NDC = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]];
    const ruins = [];
    let olhando = false, nome = '';
    const conferirCamera = () => {
      if (!olhando || g.garagem.dentro) return;
      cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      for (let i = 0; i < 5; i++) {
        const p = pts[i].set(NDC[i][0], NDC[i][1], -1).unproject(cam);
        const k = dentro(p.x, p.y, p.z);
        if (k) { ruins.push({ nome, k, i, cam: [cam.position.x - X, cam.position.y - Y, cam.position.z - Z].map((v) => +v.toFixed(3)), pe: [g.jog.pos.x - X, g.jog.pos.y - Y, g.jog.pos.z - Z].map((v) => +v.toFixed(3)), agachado: g.jog.agachado, olhos: +g.jog.alturaOlhos.toFixed(3), visao: +g.visao.alturaOlhos.toFixed(3), modo: g.visao.modo }); return; }
      }
    };
    const r = g.renderer, render = r.render.bind(r);
    r.render = (sc, c) => { if (c === cam) conferirCamera(); return render(sc, c); };
    if (g.pos && g.pos.render) { const pr = g.pos.render.bind(g.pos); g.pos.render = (...a) => { conferirCamera(); return pr(...a); }; }
    const tecla = (tipo, code) => dispatchEvent(new KeyboardEvent(tipo, { code, key: code === 'Space' ? ' ' : code }));
    const segurar = async (codes, ms) => { for (const c of codes) tecla('keydown', c); await espera(ms); for (const c of codes) tecla('keyup', c); };
    const por = (x, y, z, yaw = 0, pitch = 0) => { const j = g.jog; j.voando = false; j.planando = false; j.vel.x = j.vel.y = j.vel.z = 0; j.pos.x = x; j.pos.y = y; j.pos.z = z; j.yaw = yaw; j.pitch = pitch; };
    const calmo = () => { g.dia = 0.3; if (g.monstros) g.monstros.tempoSpawn = 1e9; };
    window.__t = { B, F, X, Y, Z, cubo, por, segurar, tecla, espera, quadros, calmo, ruins, dentro,
      olhar(v, n) { olhando = v; if (n) nome = n; }, nomear(n) { nome = n; } };
    calmo();
    for (let i = 0; i < 20; i++) { const t0 = performance.now(); await quadros(10); if (performance.now() - t0 < 1000) break; }
  });
  return p;
}

// monta os lugares de teste (iguais nos dois aparelhos)
const montar = (p) => p.evaluate(() => {
  const { B, F, X, Y, Z, cubo } = window.__t;
  // 1. parede comprida em z = Z + 0 (de X-6 a X+6), 3 de altura, e uma quina em X+6
  cubo(X - 6, X + 6, Y + 1, Y + 3, Z, Z, B.PEDRA);
  cubo(X + 6, X + 6, Y + 1, Y + 3, Z, Z + 6, B.PEDRA);
  // 2. túnel de 2 de altura (teto em Y+3), em x de X+10 a X+12, z de Z a Z+8
  cubo(X + 10, X + 12, Y + 3, Y + 3, Z, Z + 8, B.PEDRA);
  // 3. vão baixo: chão de meio bloco e teto em Y+3 (sobra 1,5): só passa agachado
  cubo(X + 16, X + 18, Y + 1, Y + 1, Z, Z + 8, F.LAJE);
  cubo(X + 16, X + 18, Y + 3, Y + 3, Z + 3, Z + 8, B.PEDRA);
  // 4. escada subindo para +z com teto 2 blocos acima de cada degrau
  for (let i = 0; i < 4; i++) {
    cubo(X - 2, X, Y + 1, Y + i, Z + 12 + i, Z + 12 + i, B.PEDRA);
    cubo(X - 2, X, Y + 1 + i, Y + 1 + i, Z + 12 + i, Z + 12 + i, F.ESCADA + 1);
    cubo(X - 2, X, Y + 4 + i, Y + 4 + i, Z + 11 + i, Z + 12 + i, B.PEDRA);
  }
  // 5. formas redondas: tronco, coluna, cerca, bola e cúpula no teto
  cubo(X + 4, X + 4, Y + 1, Y + 3, Z + 14, Z + 14, F.TRONCO_R);
  cubo(X + 7, X + 7, Y + 1, Y + 3, Z + 14, Z + 14, F.COLUNA);
  cubo(X + 10, X + 12, Y + 1, Y + 1, Z + 14, Z + 14, F.CERCA);
  cubo(X + 15, X + 15, Y + 1, Y + 1, Z + 14, Z + 14, F.BOLA);
  cubo(X + 14, X + 16, Y + 3, Y + 3, Z + 18, Z + 20, F.CUPULA);
  cubo(X + 18, X + 20, Y + 3, Y + 3, Z + 18, Z + 20, F.LAJE);
});

// os passeios: cada um põe o jogador num lugar, segura teclas e olha para os lados
async function passear(p, rotulo) {
  return p.evaluate(async (rotulo) => {
    const t = window.__t, { X, Y, Z, por, segurar, espera, tecla } = t;
    const j = window.__jogo.jog, PI = Math.PI;
    const ir = async (n, x, y, z, yaw, pitch, teclas, ms) => { t.nomear(rotulo + ' ' + n); por(x, y, z, yaw, pitch); await espera(150); await segurar(teclas, ms); };
    t.ruins.length = 0; t.olhar(true);
    // parede: encosta vindo de 8 direções, olhando reto, para cima e para baixo; pula encostado
    for (let a = 0; a < 8; a++) for (const pitch of [0, 1.2, -1.2]) {
      const yaw = PI * (0.25 + a * 0.0625) * (a % 2 ? -1 : 1); // olha mais ou menos para a parede (-z)
      await ir('parede', X + 0.5 + (a - 4) * 0.7, Y + 1, Z + 2.5, yaw, pitch, ['KeyW'], 450);
    }
    await ir('parede pulando', X + 0.5, Y + 1, Z + 1.5, 0, 0.3, ['KeyW', 'Space'], 900);
    await ir('quina', X + 4.5, Y + 1, Z + 2.5, -PI / 4, 0, ['KeyW'], 900);
    await ir('quina olhando de lado', X + 4.5, Y + 1, Z + 2.5, -PI / 4, 0.8, ['KeyW', 'KeyD'], 700);
    // túnel: pulando e andando, olhando para cima
    for (const pitch of [0, 0.8, 1.5]) await ir('túnel pulando', X + 11.5, Y + 1, Z + 0.6, PI, pitch, ['KeyW', 'Space'], 900);
    await ir('túnel correndo', X + 11.5, Y + 1, Z + 0.6, PI, 0.5, ['KeyW', 'Space', 'ControlLeft'], 900);
    // vão baixo: agacha e já entra andando; dentro, solta o agachar e tenta pular
    for (const pitch of [0, 1.0, 1.5]) {
      await ir('vão baixo agachando', X + 17.5, Y + 1.5, Z + 1.5, PI, pitch, ['KeyZ', 'KeyW'], 1400);
      t.nomear(rotulo + ' vão baixo soltou'); await segurar(['KeyW', 'Space'], 600);
    }
    // escada com teto
    for (const pitch of [0, 1.0]) await ir('escada com teto', X - 0.5, Y + 1, Z + 10.5, PI, pitch, ['KeyW', 'Space'], 1600);
    // formas redondas: encosta e pula
    for (const [n, x, z] of [['tronco', 4, 12.5], ['coluna', 7, 12.5], ['cerca', 11, 12.5], ['bola', 15, 12.5]])
      for (const pitch of [0, -1.3, 1.0]) await ir(n, X + x + 0.5, Y + 1, Z + z, PI, pitch, ['KeyW', 'Space'], 700);
    for (const pitch of [0.5, 1.5]) await ir('cúpula no teto', X + 15.5, Y + 1, Z + 17, PI, pitch, ['KeyW', 'Space'], 1200);
    for (const pitch of [0.5, 1.5]) await ir('meio bloco no teto', X + 19.5, Y + 1, Z + 17, PI, pitch, ['KeyW', 'Space'], 1200);
    t.olhar(false);
    return t.ruins.slice(0, 12).concat(t.ruins.length > 12 ? [{ mais: t.ruins.length - 12 }] : []);
  }, rotulo);
}

const resumo = (rs) => [...new Set(rs.filter((r) => r.nome).map((r) => r.nome))];

// ===================== computador =====================
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await abrir(ctx, false);
await montar(p);
for (const [modo, rot] of [[0, '1ª pessoa'], [1, '3ª pessoa (ombro)'], [2, '3ª pessoa (de frente)']]) {
  await p.evaluate((m) => { window.__jogo.visao.modo = m; }, modo);
  const rs = await passear(p, rot);
  conferir(rs.length === 0, `${rot}: câmera nunca entra nos blocos`, rs.length ? { onde: resumo(rs), exemplos: rs.slice(0, 3) } : '');
}
// celular deitado (tela bem larga) com o campo de visão no máximo (100°): os cantos da tela ficam mais longe
await p.setViewportSize({ width: 1560, height: 700 });
await p.evaluate(() => { window.__jogo.ajustes.fov = 100; });
await p.waitForTimeout(500);
conferir(await p.evaluate(() => Math.round(window.__jogo.camera.fov)) >= 100, 'campo de visão em 100°');
for (const [modo, rot] of [[0, 'tela larga 100° 1ª pessoa'], [1, 'tela larga 100° ombro']]) {
  await p.evaluate((m) => { window.__jogo.visao.modo = m; }, modo);
  const rs = await passear(p, rot);
  conferir(rs.length === 0, `${rot}: câmera nunca entra nos blocos`, rs.length ? { onde: resumo(rs), exemplos: rs.slice(0, 3) } : '');
}
await p.evaluate(() => { window.__jogo.ajustes.fov = 72; });
await p.setViewportSize({ width: 1280, height: 720 });
// foto: agachado no vão baixo, olhando para cima
await p.evaluate(async () => { const t = window.__t; window.__jogo.visao.modo = 0; t.por(t.X + 17.5, t.Y + 1.5, t.Z + 1.5, Math.PI, 1.2); await t.espera(100); t.tecla('keydown', 'KeyZ'); t.tecla('keydown', 'KeyW'); await t.espera(1200); t.tecla('keyup', 'KeyW'); });
await p.screenshot({ path: SAIDA + '/cabeca-vao-baixo.png' });
await p.evaluate(() => window.__t.tecla('keyup', 'KeyZ'));
await p.evaluate(async () => { const t = window.__t; t.por(t.X + 0.5, t.Y + 1, t.Z + 1.5, 0, 0.9); t.tecla('keydown', 'KeyW'); await t.espera(800); t.tecla('keyup', 'KeyW'); });
await p.screenshot({ path: SAIDA + '/cabeca-parede.png' });
await ctx.close();

// ===================== tablet (botões de toque) =====================
const ctxT = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const pt = await abrir(ctxT, true);
await montar(pt);
// vão baixo com o botão de agachar e o joystick de toque
const rsT = await pt.evaluate(async () => {
  const t = window.__t; t.ruins.length = 0;
  t.olhar(true, 'tablet vão baixo');
  t.por(t.X + 17.5, t.Y + 1.5, t.Z + 1.5, Math.PI, 1.3);
  await t.espera(200);
  return null;
});
const bt = await pt.$('#bt-agachar');
const bb = bt && await bt.boundingBox();
const joy = await pt.evaluate(() => { const e = document.querySelector('#joy, #joystick, .joystick'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
conferir(!!bb && !!joy, 'tablet: tem botão de agachar e joystick');
if (bb && joy) {
  const cdp = await ctxT.newCDPSession(pt);
  const ag = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  const toque = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await toque('touchStart', [{ x: ag.x, y: ag.y, id: 1 }]);
  await toque('touchStart', [{ x: ag.x, y: ag.y, id: 1 }, { x: joy.x, y: joy.y, id: 2 }]);
  for (let i = 1; i <= 6; i++) await toque('touchMove', [{ x: ag.x, y: ag.y, id: 1 }, { x: joy.x, y: joy.y - i * 10, id: 2 }]);
  await pt.waitForTimeout(1600);
  await toque('touchEnd', []);
  await pt.waitForTimeout(400);
}
const fimT = await pt.evaluate(() => { const t = window.__t, j = window.__jogo.jog; t.olhar(false); return { ruins: t.ruins.slice(0, 3), n: t.ruins.length, z: j.pos.z - t.Z, agachado: j.agachado }; });
conferir(fimT.z > 3.5, 'tablet: entrou no vão baixo agachado', fimT.z);
conferir(fimT.n === 0, 'tablet: câmera não entra no teto do vão baixo', fimT);
await pt.screenshot({ path: SAIDA + '/cabeca-tablet.png' });
const rsT2 = await passear(pt, 'tablet');
conferir(rsT2.length === 0, 'tablet: câmera nunca entra nos blocos (1ª pessoa)', rsT2.length ? { onde: resumo(rsT2), exemplos: rsT2.slice(0, 3) } : '');
await ctxT.close();

conferir(erros.length === 0, 'sem erros no console', erros.slice(0, 5));
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);

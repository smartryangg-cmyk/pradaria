// Estilo "Natural 3D" (suave.js): cria o mundo pela tela, quebra/coloca blocos, anda morro acima,
// troca para Blocos pela janela "Editar o mundo" e mede o tempo de montar a malha. Computador e tablet.
//   python3 -m http.server 8765 -d public   (em outro terminal)   ·   SAIDA=/tmp node testes/teste-suave.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const URL = process.env.URL || 'http://localhost:8765';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); if (!cond) falhas++; };

async function rodar(nome, ctxOpc, toque) {
  console.log(`\n== ${nome} ==`);
  const ctx = await b.newContext(ctxOpc);
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  const clicar = (sel) => (toque ? p.tap(sel) : p.click(sel));
  await p.goto(URL + '/#teste');
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pradaria.ajustes', JSON.stringify({ graf: 'media', grafManual: true })); });
  await p.reload();
  // tela de criar mundo (sem mundo salvo, "Jogar sem internet" abre ela)
  await clicar('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  ok(await p.isVisible('#n-estilos [data-estilo=suave]'), 'criação mostra "Jeito do mundo" com Natural 3D');
  await clicar('#n-estilos [data-estilo=suave]');
  ok(await p.getAttribute('#n-estilos [data-estilo=suave]', 'aria-checked') === 'true', 'Natural 3D marcado');
  await p.screenshot({ path: `${SAIDA}/${nome}-criar.png` });
  if (!toque) await clicar('#n-lista [data-opcao=sobrevivencia]'); // no PC: modo criativo (quebra e coloca na hora)
  await clicar('#n-opcoes details summary');
  await p.fill('#n-semente', 'pradaria'); // mesmo terreno sempre
  await clicar('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.mundo, null, { timeout: 30000 });
  await p.waitForTimeout(6000);
  const info = await p.evaluate(() => ({ suave: window.__jogo.mundo.suave, estilo: window.__jogo.opcoesMundo.estilo, salvo: JSON.parse(localStorage.getItem('pradaria.local') || '{}').opcoes?.estilo }));
  ok(info.suave && info.estilo === 'suave' && info.salvo === 'suave', 'mundo abriu no estilo suave e ficou salvo ' + JSON.stringify(info));

  // vértices fora da grade = terreno liso de verdade; malha sem NaN
  const malha = await p.evaluate(() => {
    let fora = 0, total = 0, nan = 0;
    for (const c of window.__jogo.mundo.chunks.values()) {
      if (!c.malha) continue;
      const a = c.malha.geometry.attributes.position.array;
      for (let i = 0; i < a.length; i++) { total++; if (Number.isNaN(a[i])) nan++; else if (Math.abs(a[i] - Math.round(a[i])) > 0.01) fora++; }
    }
    return { fora, total, nan };
  });
  ok(malha.nan === 0 && malha.fora / malha.total > 0.05, `malha lisa: ${(100 * malha.fora / malha.total).toFixed(1)}% das coordenadas fora da grade, ${malha.nan} NaN`);

  // vai até um morro: acha uma direção que sobe pelo menos 3 blocos em 12
  const subida = await p.evaluate(() => {
    const { jog, mundo } = window.__jogo;
    const x0 = Math.floor(jog.pos.x), z0 = Math.floor(jog.pos.z);
    for (let r = 0; r < 40; r += 4) for (let a = 0; a < 16; a++) {
      const sx = x0 + Math.round(Math.cos(a / 16 * 6.283) * r * 2), sz = z0 + Math.round(Math.sin(a / 16 * 6.283) * r * 2);
      for (let d = 0; d < 8; d++) {
        const yaw = d / 8 * 6.283, dx = -Math.sin(yaw), dz = -Math.cos(yaw);
        const h0 = mundo.chao(sx, sz), h1 = mundo.chao(Math.round(sx + dx * 12), Math.round(sz + dz * 12));
        let livre = true, ant = h0; // sem árvore nem água no caminho, degraus de 1 bloco no máximo
        for (let k = 0; k <= 12; k++) {
          const bx = Math.round(sx + dx * k), bz = Math.round(sz + dz * k), y = mundo.chao(bx, bz), bb = mundo.bloco(bx, y, bz);
          if ((![1, 2, 3, 4].includes(bb) && bb < 130) || y - ant > 1 || y < ant || mundo.bloco(bx, y + 1, bz) || mundo.bloco(bx, y + 2, bz) || mundo.bloco(bx, y + 3, bz)) livre = false;
          ant = y;
        }
        if (livre && h1 - h0 >= 3 && h1 - h0 <= 7) return { sx, sz, yaw, h0, h1 };
      }
    }
    return null;
  });
  ok(!!subida, 'achou um morro para subir ' + JSON.stringify(subida));
  if (subida) {
    await p.evaluate(({ sx, sz, yaw, h0 }) => { const { jog } = window.__jogo; jog.voando = false; Object.assign(jog.pos, { x: sx + 0.5, y: h0 + 1.05, z: sz + 0.5 }); Object.assign(jog.vel, { x: 0, y: 0, z: 0 }); jog.yaw = yaw; jog.pitch = -0.15; window.__jogo.dia = 0.3; }, subida);
    await p.waitForTimeout(2500);
    await p.evaluate(() => { const j = window.__jogo.jog; window.__pulos = 0; window.__ys = []; const f = () => { if (j.vel.y > 1) window.__pulos++; window.__ys.push(+(j.pos.y + j.degrau).toFixed(2)); if (window.__ys.length < 400) requestAnimationFrame(f); }; f(); });
    const y0 = await p.evaluate(() => window.__jogo.jog.pos.y);
    if (toque) {
      const vp = p.viewportSize(); const cdp = await ctx.newCDPSession(p);
      const x0 = vp.width * 0.2, yy = vp.height * 0.6;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: yy, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: yy - 70, id: 1 }] });
      await p.waitForFunction((y0) => window.__jogo.jog.pos.y >= y0 + 3, y0, { timeout: 12000 }).catch(() => {});
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await p.keyboard.down('w');
      await p.waitForFunction((y0) => window.__jogo.jog.pos.y >= y0 + 3, y0, { timeout: 12000 }).catch(() => {});
      await p.keyboard.up('w');
    }
    const r = await p.evaluate(() => ({ y: window.__jogo.jog.pos.y, pulos: window.__pulos, ys: window.__ys }));
    const saltos = r.ys.slice(1).map((v, i) => v - r.ys[i]).filter((d) => d > 0.9).length; // câmera dando tranco de um bloco inteiro num quadro
    ok(r.y - y0 >= 3, `subiu o morro andando: ${y0.toFixed(1)} -> ${r.y.toFixed(1)}`);
    ok(r.pulos === 0, `sem pulinho em cada degrau (quadros pulando: ${r.pulos})`);
    ok(saltos === 0, `câmera sobe liso (trancos de um bloco inteiro num quadro: ${saltos})`);
    await p.screenshot({ path: `${SAIDA}/${nome}-morro.png` });
  }

  // quebrar e colocar com o mouse/toque de verdade, olhando para o chão na frente
  const vp = p.viewportSize();
  if (!toque) { await p.mouse.click(vp.width / 2, vp.height / 2); await p.waitForTimeout(500); } // primeiro clique trava o mouse
  await p.evaluate(() => { const { jog } = window.__jogo; jog.pitch = -0.9; });
  await p.waitForTimeout(400);
  const alvo = await p.evaluate(() => { const { jog, mundo, camera } = window.__jogo; const d = new (camera.position.constructor)(); camera.getWorldDirection(d); const h = mundo.raycast(camera.position, d, 6); return h && [h.x, h.y, h.z, h.b]; });
  const ed0 = await p.evaluate(() => window.__jogo.mundo.listarEdicoes().length);
  if (process.env.DEPURAR) await p.evaluate(() => { const v = window.__jogo.visao; const o = v.bater.bind(v); window.__n = 0; v.bater = (...a) => { window.__n++; return o(...a); }; });
  if (process.env.DEPURAR) console.log('mira', await p.evaluate(() => [!!document.pointerLockElement, window.__jogo.jog.pitch, document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.id]));
  if (toque) {
    // no tablet: segurar quebra (com Coletar e criar ligado leva uns toques)
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: vp.width * 0.5, y: vp.height * 0.5, id: 2 }] });
    await p.waitForFunction(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 0, alvo, { timeout: 15000 }).catch(() => {});
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    // o Chromium sem tela manda movimentos de mouse falsos com o mouse travado (a mira sobe sozinha):
    // aqui a "mão" segura a mira parada, como uma pessoa faria
    await p.evaluate(() => { const j = window.__jogo.jog, pt = j.pitch, yw = j.yaw; const f = () => { j.pitch = pt; j.yaw = yw; if (window.__segurar !== false) requestAnimationFrame(f); }; window.__segurar = true; f(); });
    await p.mouse.down(); // segurando: bate até cair
    await p.waitForFunction(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 0, alvo, { timeout: 15000 }).catch(() => {});
    await p.mouse.up();
  }
  await p.waitForTimeout(800);
  if (process.env.DEPURAR) console.log('batidas', await p.evaluate(() => [window.__n, window.__jogo.jog.pitch, !!document.pointerLockElement]));
  const quebrou = alvo && await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), alvo) === 0;
  ok(quebrou, `quebrou o bloco mirado ${JSON.stringify(alvo)}`);
  const furo = await p.evaluate(([x, y, z]) => {
    // a malha do pedaço foi refeita e tem faces dentro do buraco (paredes visíveis)
    const { mundo } = window.__jogo; const c = mundo.chunks.get(Math.floor(x / 16) + ',' + Math.floor(z / 16));
    const a = c.malha.geometry.attributes.position.array, lx = x - c.cx * 16, lz = z - c.cz * 16;
    let n = 0; for (let i = 0; i < a.length; i += 3) if (a[i] > lx - 0.01 && a[i] < lx + 1.01 && a[i + 2] > lz - 0.01 && a[i + 2] < lz + 1.01 && a[i + 1] < y + 0.6 && a[i + 1] > y - 1.2) n++;
    return { sujo: c.sujo, n };
  }, alvo);
  ok(!furo.sujo && furo.n >= 4, `buraco aparece na malha (${furo.n} vértices dentro dele)`);
  await p.screenshot({ path: `${SAIDA}/${nome}-buraco.png` });
  if (!toque) {
    await p.mouse.down({ button: 'right' }); await p.waitForTimeout(80); await p.mouse.up({ button: 'right' });
    await p.waitForTimeout(800);
    await p.evaluate(() => { window.__segurar = false; });
    const ed1 = await p.evaluate(() => window.__jogo.mundo.listarEdicoes());
    ok(ed1.some((e) => e[3] !== 0), `colocou um bloco com o botão direito (${ed1.filter((e) => e[3] !== 0).length} colocado)`);
    // bloco colocado pelo jogador fica quadrado: os 8 cantos dele estão na grade
    const quadrado = await p.evaluate(([x, y, z, bb]) => {
      const { mundo } = window.__jogo; const ed = mundo.listarEdicoes().filter((e) => e[3] !== 0).pop();
      if (!ed) return null;
      const [ex, ey, ez] = ed; const c = mundo.chunks.get(Math.floor(ex / 16) + ',' + Math.floor(ez / 16));
      const a = c.malha.geometry.attributes.position.array, lx = ex - c.cx * 16, lz = ez - c.cz * 16;
      let cantos = 0;
      for (let i = 0; i < a.length; i += 3) {
        for (const [qx, qy, qz] of [[0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]]) if (Math.abs(a[i] - lx - qx) < 1e-4 && Math.abs(a[i + 1] - ey - qy) < 1e-4 && Math.abs(a[i + 2] - lz - qz) < 1e-4) cantos++;
      }
      return { pos: [ex, ey, ez], cantos };
    }, alvo);
    ok(quadrado && quadrado.cantos >= 4, `bloco colocado ficou quadrado (cantos de cima no lugar: ${quadrado && quadrado.cantos})`);
    await p.screenshot({ path: `${SAIDA}/${nome}-colocado.png` });
    await p.evaluate(() => document.exitPointerLock()); // o Esc do navegador solta o mouse (o headless não faz sozinho)
    await p.waitForTimeout(300);
  }

  // foto de comparação no mesmo lugar: Natural 3D e depois Blocos (trocando pela janela Editar o mundo)
  const lugar = await p.evaluate(() => { const { jog, mundo } = window.__jogo; const x = Math.floor(jog.pos.x) + 4, z = Math.floor(jog.pos.z) + 4; return { x: x + 0.5, y: mundo.chao(x, z) + 9, z: z + 0.5, yaw: 0.6, pitch: -0.42 }; });
  const posicionar = (l) => p.evaluate((l) => { const { jog } = window.__jogo; jog.voando = true; Object.assign(jog.pos, { x: l.x, y: l.y, z: l.z }); Object.assign(jog.vel, { x: 0, y: 0, z: 0 }); jog.yaw = l.yaw; jog.pitch = l.pitch; window.__jogo.dia = 0.3; }, l);
  await posicionar(lugar);
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${SAIDA}/${nome}-comparar-natural.png` });

  // tempo de montar a malha (mesmos pedaços), com a CPU 4x mais lenta no tablet
  const cdpT = toque ? await ctx.newCDPSession(p) : null;
  if (cdpT) await cdpT.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // os mesmos 12 pedaços montados nos três jeitos, 3 rodadas (vale a melhor de cada, sem o aquecimento do JIT)
  const tempos = await p.evaluate(() => {
    const { mundo } = window.__jogo; const cs = [...mundo.chunks.values()].filter((c) => c.temMalha).slice(0, 12);
    const jeitos = { blocos: [false, false], natural: [true, false], leve: [true, true] }, r = {};
    for (let k = 0; k < 3; k++) for (const [n, [sv, simp]] of Object.entries(jeitos)) {
      mundo.suave = sv; mundo.suaveSimples = simp;
      const t0 = performance.now(); for (const c of cs) mundo.construir(c);
      const t = (performance.now() - t0) / cs.length; r[n] = Math.min(r[n] ?? 1e9, +t.toFixed(1));
    }
    mundo.suave = true; mundo.suaveSimples = false; for (const c of cs) mundo.construir(c);
    return r;
  });
  if (cdpT) await cdpT.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  await clicar('#bt-menu');
  await p.waitForTimeout(400);
  await clicar('#bt-editar-mundo');
  await p.waitForSelector('#editar-mundo:not([hidden])');
  ok(await p.getAttribute('#e-estilos [data-estilo=suave]', 'aria-checked') === 'true', 'Editar o mundo mostra Natural 3D marcado');
  await clicar('#e-estilos [data-estilo=blocos]');
  await p.screenshot({ path: `${SAIDA}/${nome}-editar.png` });
  await clicar('#e-salvar');
  await p.waitForTimeout(6000);
  const depois = await p.evaluate(() => ({ suave: window.__jogo.mundo.suave, salvo: JSON.parse(localStorage.getItem('pradaria.local') || '{}').opcoes?.estilo }));
  ok(!depois.suave && depois.salvo === 'blocos', 'trocou para Blocos depois de criado ' + JSON.stringify(depois));
  if (await p.isVisible('#m-pausa')) await clicar('#m-pausa [data-voltar], #bt-continuar').catch(() => {});
  await posicionar(lugar);
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${SAIDA}/${nome}-comparar-blocos.png` });
  console.log(`tempo para montar um pedaço${toque ? ' (CPU 4x mais lenta)' : ''}: blocos ${tempos.blocos} ms · natural ${tempos.natural} ms · natural no gráfico Leve ${tempos.leve} ms`);
  ok(tempos.leve <= tempos.blocos * 1.6 + 1, 'Natural 3D no gráfico Leve custa perto do de blocos');
  ok(erros.length === 0, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}

await rodar('pc', { viewport: { width: 1280, height: 720 } }, false);
if (!process.env.SO_PC) await rodar('tablet', { ...devices['Galaxy Tab S4 landscape'] }, true);
await b.close();
console.log(falhas ? `\n${falhas} falha(s)` : '\ntudo certo');
process.exit(falhas ? 1 : 0);

// Teste jogando de verdade (Chromium com WebGL): tablet com toque e computador com teclado e mouse.
// Cria o mundo pela tela, anda com o joystick/teclado até os bichos, toca neles na tela e confere
// o que aparece (aviso, corações, bicho fugindo). Os bichos são colocados perto para não esperar o sorteio.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };

async function abrir(ctxOpts, nome) {
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  await p.evaluate(() => localStorage.clear());
  // guarda todos os avisos que aparecerem na tela
  await p.evaluate(() => { window.__avisos = []; const el = document.querySelector('#aviso'); new MutationObserver(() => { const t = el.textContent.trim(); if (t && window.__avisos.at(-1) !== t) window.__avisos.push(t); }).observe(el, { childList: true, subtree: true, characterData: true, attributes: true }); });
  return { ctx, p };
}
// preparação do palco (gramado plano) e funções de ajuda dentro da página
async function preparar(p) {
  await p.evaluate(() => {
    const g = window.__jogo, j = g.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y = Math.max(30, g.mundo.chao(x0, z0));
    for (let dx = -22; dx <= 22; dx++) for (let dz = -22; dz <= 22; dz++) {
      g.mundo.definir(x0 + dx, y, z0 + dz, 1);
      for (let h = 1; h <= 40; h++) if (g.mundo.bloco(x0 + dx, y + h, z0 + dz)) g.mundo.definir(x0 + dx, y + h, z0 + dz, 0);
    }
    j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y + 1; j.yaw = 0; j.pitch = -0.15;
    window.__centro = [x0 + 0.5, y + 1, z0 + 0.5];
    window.__criar = (esp, dx, dz, o = {}) => { const x = Math.floor(j.pos.x + dx), z = Math.floor(j.pos.z + dz); return g.bichos.criar(esp, x + 0.5, g.mundo.chao(x, z) + 1, z + 0.5, o); };
    window.__dist = (bb) => Math.hypot(bb.x - j.pos.x, bb.z - j.pos.z);
    // onde o bicho aparece na tela (para tocar nele de verdade)
    window.__tela = (bb) => { const v = bb.grupo.position.clone(); v.y += bb.e.alt * bb.esc * 0.5; v.project(g.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, frente: v.z < 1 }; };
    // limpa os bichos e volta o jogador para o meio do palco
    window.__limpar = () => { [j.pos.x, j.pos.y, j.pos.z] = window.__centro; j.vel.x = j.vel.z = 0; g.bichos.tempoSpawn = 1e9; g.bichos.limpar(); g.vida.protegido = 0; g.vida.reiniciar(); };
  });
  await p.waitForTimeout(1500);
}
// gira a câmera para o bicho (como o jogador arrastando o dedo/mouse)
const olharPara = (p, i = 0) => p.evaluate((i) => {
  // a partir dos olhos do jogador (a câmera só acompanha no próximo quadro, e depois de um teleporte ainda está no lugar antigo)
  const g = window.__jogo, bb = g.bichos.lista[i], c = { x: g.jog.pos.x, y: g.jog.pos.y + 1.6, z: g.jog.pos.z };
  g.jog.yaw = Math.atan2(-(bb.x - c.x), -(bb.z - c.z)); g.jog.pitch = Math.atan2(bb.y + 0.5 - c.y, Math.hypot(bb.x - c.x, bb.z - c.z));
}, i);

// ================= TABLET (toque) =================
{
  const { ctx, p } = await abrir({ ...devices['iPad (gen 7) landscape'], hasTouch: true, isMobile: true }, 'tablet');
  await p.tap('#bt-sozinho');
  await p.waitForSelector('#n-opcoes:not([hidden])');
  await p.tap('[data-opcao=selvagensMachucam]');
  conferir(await p.getAttribute('[data-opcao=selvagens]', 'aria-pressed') === 'true' && await p.getAttribute('[data-opcao=selvagensMachucam]', 'aria-pressed') === 'true', 'tablet: liga "Animais podem machucar" tocando na opção');
  await p.screenshot({ path: SAIDA + '/real-tablet-opcoes.png' });
  await p.tap('[data-tamanho=pequeno]');
  await p.tap('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
  await p.waitForTimeout(3000);
  conferir(await p.locator('#vida .coracao.cheio').count() === 5, 'tablet: 5 corações na tela');
  await preparar(p);
  const cdp = await ctx.newCDPSession(p);
  const vp = p.viewportSize();
  // anda com o joystick (dedo no canto esquerdo, arrastando para cima) por `ms`
  async function andar(ms) {
    const x = vp.width * 0.15, y = vp.height * 0.75;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - k * 12, id: 1 }] });
    await p.waitForTimeout(ms);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(300);
    const joy = await p.evaluate(() => getComputedStyle(document.getElementById('joy')).display);
    if (joy !== 'none') console.log('joystick ficou preso:', joy);
  }

  // 1. anda até um veado: ele foge antes de você chegar
  await p.evaluate(() => { window.__limpar(); window.__jogo.dia = 0.3; const v = window.__criar('veado', 0, -14); v.estado = 'pastar'; v.timer = 99; });
  await olharPara(p);
  const d0 = await p.evaluate(() => window.__dist(window.__jogo.bichos.lista[0]));
  await andar(3500);
  const v1 = await p.evaluate(() => { const v = window.__jogo.bichos.lista[0]; return { d: window.__dist(v), e: v.estado }; });
  conferir(v1.e === 'fugir' || v1.d > 11, `tablet: andando com o joystick até o veado, ele foge (${v1.e}, ${d0.toFixed(1)} -> ${v1.d.toFixed(1)})`);
  await p.screenshot({ path: SAIDA + '/real-tablet-veado-foge.png' });

  // 2. ursa com filhote: chegar perto do filhote dá aviso; ficar lá, ela morde (perde um coração na tela)
  await p.evaluate(() => { window.__limpar(); const u = window.__criar('urso', 2, -9, { grupo: 9 }); window.__criar('urso', 0.5, -7, { grupo: 9, filhote: true, mae: u }); });
  await olharPara(p);
  await p.evaluate(() => { window.__vidaMin = 10; clearInterval(window.__vigia); window.__trilha = []; window.__vigia = setInterval(() => { window.__vidaMin = Math.min(window.__vidaMin, window.__jogo.vida.atual); const u = window.__jogo.bichos.lista[0]; if (u) { const t = u.estado + ':' + window.__dist(u).toFixed(1) + ':' + (u.y - window.__jogo.jog.pos.y).toFixed(1); if (window.__trilha.at(-1) !== t) window.__trilha.push(t); } }, 100); });
  await andar(900);
  await p.waitForFunction(() => window.__avisos.some((t) => /filhotes/.test(t)), null, { timeout: 8000 }).catch(() => {});
  const aviso = await p.evaluate(() => window.__avisos.find((t) => /filhotes/.test(t)) || window.__avisos.join(' | '));
  conferir(/protegendo os filhotes/.test(aviso), 'tablet: aviso na tela "' + aviso + '"');
  await p.screenshot({ path: SAIDA + '/real-tablet-ursa-avisa.png' });
  await p.waitForFunction(() => window.__vidaMin < 10, null, { timeout: 10000 }).catch(() => {});
  const vmin = await p.evaluate(() => window.__vidaMin);
  conferir(vmin === 8, 'tablet: a ursa morde e some um coração da tela (vida ' + vmin / 2 + ' de 5)');
  if (vmin === 10) console.log('trilha da ursa:', (await p.evaluate(() => window.__trilha)).join(' '));
  await p.screenshot({ path: SAIDA + '/real-tablet-mordida.png' });

  // 3. tocar na ursa na tela espanta: ela foge com o filhote
  await p.evaluate(() => { const u = window.__jogo.bichos.lista.find((o) => !o.filhote); u.estado = 'avisar'; u.timer = 30; u.x = window.__jogo.jog.pos.x; u.z = window.__jogo.jog.pos.z - 4; });
  await olharPara(p, await p.evaluate(() => window.__jogo.bichos.lista.findIndex((o) => !o.filhote)));
  await p.waitForTimeout(700);
  const alvo = await p.evaluate(() => window.__tela(window.__jogo.bichos.lista.find((o) => !o.filhote)));
  for (let k = 0; k < 3 && (await p.evaluate(() => window.__jogo.bichos.lista.find((o) => !o.filhote).estado)) !== 'fugir'; k++) { await p.touchscreen.tap(alvo.x, alvo.y); await p.waitForTimeout(400); }
  const ue = await p.evaluate(() => window.__jogo.bichos.lista.map((o) => o.estado));
  conferir(ue.every((e) => e === 'fugir'), 'tablet: tocar na ursa espanta ela e o filhote (' + ue.join(', ') + ')');

  // 4. bicho de fazenda: tocar faz carinho (corações aparecem)
  await p.evaluate(() => { window.__limpar(); const o = window.__criar('ovelha', 0, -3.5); o.calmo = 99; o.estado = 'pastar'; o.timer = 99; });
  await olharPara(p);
  await p.waitForTimeout(700);
  const ov = await p.evaluate(() => window.__tela(window.__jogo.bichos.lista[0]));
  const part0 = await p.evaluate(() => window.__jogo.bichos.particulas.length);
  // o emulador desenha devagar (tela grande do iPad sem placa de vídeo): se o toque demorar, toca de novo
  for (let k = 0; k < 3 && (await p.evaluate(() => window.__jogo.bichos.particulas.length)) <= part0; k++) { await p.touchscreen.tap(ov.x, ov.y); await p.waitForTimeout(250); }
  conferir((await p.evaluate(() => window.__jogo.bichos.particulas.length)) > part0, 'tablet: tocar na ovelha faz carinho (corações)');
  await p.screenshot({ path: SAIDA + '/real-tablet-carinho.png' });

  // 5. de noite: mundo cheio de bichos sozinhos (sorteio de verdade) por 20 s, sem erros
  await p.evaluate(() => { window.__limpar(); window.__jogo.bichos.tempoSpawn = 0; window.__jogo.dia = 0.55; });
  await p.waitForTimeout(20000);
  const nat = await p.evaluate(() => window.__jogo.bichos.lista.map((o) => o.especie + ':' + o.estado));
  console.log('tablet, bichos sozinhos:', nat.join(' '));
  conferir(nat.length >= 3, 'tablet: bichos aparecem sozinhos (' + nat.length + ')');
  await p.screenshot({ path: SAIDA + '/real-tablet-entardecer.png' });
  await ctx.close();
}

// ================= COMPUTADOR (teclado e mouse) =================
{
  const { ctx, p } = await abrir({ viewport: { width: 1280, height: 760 } }, 'pc');
  await p.click('#bt-sozinho');
  await p.waitForSelector('#n-opcoes:not([hidden])');
  await p.click('[data-tamanho=pequeno]');
  await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
  await p.waitForTimeout(3000);
  conferir(!(await p.isVisible('#vida')), 'pc: sem "podem machucar" não tem corações');
  await preparar(p);
  // trava o mouse (primeiro clique no jogo)
  await p.mouse.click(640, 380);
  await p.waitForTimeout(400);
  const travou = await p.evaluate(() => !!document.pointerLockElement);
  console.log('mouse travado:', travou);

  // 1. coelho: congela quando você chega, e dispara se chegar mais perto
  await p.evaluate(() => { window.__limpar(); window.__jogo.dia = 0.5; const c = window.__criar('coelho', 0, -10); c.calmo = 99; c.estado = 'parar'; c.timer = 99; });
  await olharPara(p);
  await p.keyboard.down('KeyW');
  await p.waitForFunction(() => window.__jogo.bichos.lista[0].estado === 'congelar', null, { timeout: 6000 }).catch(() => {});
  const congelou = await p.evaluate(() => window.__jogo.bichos.lista[0].estado);
  await p.waitForFunction(() => window.__jogo.bichos.lista[0].estado === 'fugir', null, { timeout: 12000 }).catch(() => {});
  await p.keyboard.up('KeyW');
  conferir(congelou === 'congelar', 'pc: coelho congela quando você chega (' + congelou + ')');
  conferir(await p.evaluate(() => window.__jogo.bichos.lista[0].estado) === 'fugir', 'pc: chegando mais perto o coelho dispara');

  // 2. lobos caçam: matilha atrás de um veado, que foge
  await p.evaluate(() => { window.__limpar(); for (let i = 0; i < 3; i++) { const l = window.__criar('lobo', -6 + i * 1.5, -14, { grupo: 4 }); l.fome = 1; l.calmo = 99; } window.__criar('veado', 4, -16); });
  await p.evaluate(() => { const j = window.__jogo.jog; j.yaw = 0; j.pitch = -0.2; });
  await p.waitForFunction(() => window.__jogo.bichos.lista.filter((o) => o.estado === 'cacar').length >= 2 && window.__jogo.bichos.lista.some((o) => o.especie === 'veado' && o.estado === 'fugir'), null, { timeout: 8000 }).catch(() => {});
  const caca = await p.evaluate(() => window.__jogo.bichos.lista.map((o) => o.especie + ':' + o.estado));
  conferir(caca.filter((s) => s === 'lobo:cacar').length >= 2 && caca.includes('veado:fugir'), 'pc: matilha caça junto e o veado foge (' + caca.join(', ') + ')');
  await p.screenshot({ path: SAIDA + '/real-pc-matilha.png' });

  // 3. clique no lobo espanta (mouse travado mira no centro)
  await p.evaluate(() => { window.__limpar(); const l = window.__criar('lobo', 0, -4); l.estado = 'avisar'; l.timer = 30; });
  await olharPara(p);
  await p.waitForTimeout(700);
  if (travou) await p.mouse.down(); else await p.evaluate(() => window.__jogo.quebrar(null));
  await p.waitForTimeout(150);
  if (travou) await p.mouse.up();
  conferir(await p.evaluate(() => window.__jogo.bichos.lista[0].estado) === 'fugir', 'pc: clicar no lobo espanta');

  // 4. foto de todos os selvagens parados lado a lado, de dia
  await p.evaluate(() => document.exitPointerLock());
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    window.__limpar(); window.__jogo.dia = 0.3;
    ['veado', 'lobo', 'raposa', 'urso', 'onca', 'cobra'].forEach((e, i) => { const bb = window.__criar(e, -6.5 + i * 2.6, -7); bb.estado = 'parar'; bb.pensa = 1e9; bb.dir = 0.35; bb.grupo.rotation.y = 0.35; }); // parados para a foto, virados para a câmera
    const u = window.__jogo.bichos.lista[3]; const f = window.__criar('urso', 0.2, -5.5, { filhote: true, mae: u }); f.estado = 'parar'; f.pensa = 1e9; f.dir = 0.35;
    const j = window.__jogo.jog; j.yaw = 0; j.pitch = -0.28; j.pos.y += 1;
  });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: SAIDA + '/real-pc-selvagens.png' });
  await ctx.close();
}

console.log(erros.slice(0, 10).join('\n'));
conferir(erros.length === 0, 'sem erros no console');
await b.close();
process.exit(falhas.length ? 1 : 0);

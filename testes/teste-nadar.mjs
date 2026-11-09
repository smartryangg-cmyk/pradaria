// Testa o nado de verdade (teclado e tablet com toque): boiar, mergulhar, nadar olhando para baixo,
// subir, sair da piscina pela beirada, fôlego (com e sem vida) e a visão embaixo d'água (Linda e Leve).
// Uso: (cd public && python3 -m http.server 8772) e depois: node testes/teste-nadar.mjs
// PORTA=8772 SAIDA=/pasta/dos/prints
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = `http://localhost:${process.env.PORTA || 8772}/#teste`;
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const falhas = [], erros = [];
const ok = (cond, txt) => { console.log((cond ? 'ok    ' : 'FALHOU') + ' ' + txt); if (!cond) falhas.push(txt); };
// o swiftshader desenha devagar (poucos quadros por segundo) e a física limita o passo de cada quadro,
// então o tempo do jogo anda mais devagar que o relógio: as esperas contam o tempo do JOGO (soma dos dt da física)
const espera = (p, ms) => p.evaluate((s) => new Promise((r) => {
  const alvo = window.__tf + s;
  const id = setInterval(() => { if (window.__tf >= alvo) { clearInterval(id); r(); } }, 15);
}), ms / 1000);

// espera (em tempo de jogo, até `s` segundos) o jogador ficar em pé fora da água, em cima de algo acima de yMin
const ateSair = (p, yMin, s) => p.evaluate(([yMin, s]) => new Promise((r) => {
  const j = window.__jogo.jog, t0 = window.__tf;
  const id = setInterval(() => { if ((!j.naAgua && j.noChao && j.pos.y >= yMin) || window.__tf - t0 > s) { clearInterval(id); r(); } }, 10);
}), [yMin, s]);
// espera (em tempo de jogo) a cabeça sair da água
const ateRespirar = (p, s) => p.evaluate((s) => new Promise((r) => {
  const j = window.__jogo.jog, t0 = window.__tf;
  const id = setInterval(() => { if (!j.cabecaNaAgua || window.__tf - t0 > s) { clearInterval(id); r(); } }, 10);
}), s);

async function abrir(ctxOpts, graf) {
  const ctx = await b.newContext(ctxOpts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await p.goto(URL);
  await p.evaluate((g) => { localStorage.clear(); localStorage.setItem('pradaria.ajustes', JSON.stringify({ graf: g, grafManual: true, som: false })); }, graf);
  await p.reload();
  await p.waitForTimeout(600);
  if (ctxOpts.hasTouch) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForTimeout(400);
  if (await p.isVisible('#m-novo')) { if (ctxOpts.hasTouch) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]'); }
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.mundo, null, { timeout: 20000 });
  await p.waitForTimeout(2500);
  // conta o tempo de jogo que a física realmente andou
  await p.evaluate(() => {
    const j = window.__jogo.jog, orig = j.atualizar.bind(j);
    window.__tf = 0;
    j.atualizar = (dt, ent) => { window.__tf += Math.min(dt, 0.1); orig(dt, ent); };
  });
  // piscina no céu (não depende do terreno): 9x9 por dentro, 6 de fundo; a beirada norte é 1 bloco mais alta
  const P = await p.evaluate(() => {
    const J = window.__jogo, { mundo, jog } = J;
    window.__semAuto = true; J.dia = 0.25;
    const X = Math.floor(jog.pos.x), Z = Math.floor(jog.pos.z);
    let alto = 0;
    for (let dx = -10; dx <= 10; dx++) for (let dz = -10; dz <= 10; dz++) alto = Math.max(alto, mundo.chao(X + dx, Z + dz));
    const Y0 = Math.min(70, alto + 3);
    for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
      const dentro = Math.abs(dx) <= 4 && Math.abs(dz) <= 4;
      mundo.definir(X + dx, Y0, Z + dz, 3); // fundo
      const topo = dz <= -5 ? Y0 + 7 : Y0 + 6;   // norte mais alto (beirada de 1 bloco acima da água)
      for (let y = Y0 + 1; y <= Y0 + 8; y++) mundo.definir(X + dx, y, Z + dz, dentro ? (y <= Y0 + 6 ? 5 : 0) : (y <= topo ? 3 : 0));
    }
    return { X, Y0, Z };
  });
  return { ctx, p, P };
}

const estado = (p) => p.evaluate(() => {
  const J = window.__jogo, j = J.jog;
  return { x: j.pos.x, y: j.pos.y, z: j.pos.z, vy: j.vel.y, f: j.fundura, naAgua: j.naAgua, cabeca: !!j.cabecaNaAgua, sub: J.agua.submerso,
    folego: J.agua.folego, vida: J.vida.atual, descerVisivel: !document.getElementById('bt-descer').hidden,
    barra: !document.getElementById('folego').hidden, tela: document.getElementById('agua-tela').classList.contains('ligada'),
    nevoa: J.graf.embaixoDagua, aviso: document.getElementById('aviso').textContent, voando: j.voando, resgate: !!j.resgate };
});
const por = (p, P, dx, dy, dz, yaw = 0, pitch = 0) => p.evaluate(([P, dx, dy, dz, yaw, pitch]) => {
  const j = window.__jogo.jog;
  j.pos.x = P.X + 0.5 + dx; j.pos.y = P.Y0 + dy; j.pos.z = P.Z + 0.5 + dz; j.vel.x = j.vel.y = j.vel.z = 0;
  j.yaw = yaw; j.pitch = pitch; j.voando = false;
}, [P, dx, dy, dz, yaw, pitch]);
// segue o jogador por ms milissegundos e devolve as amostras
const seguir = (p, ms) => p.evaluate((s) => new Promise((r) => {
  const a = [], j = window.__jogo.jog, t0 = window.__tf;
  const id = setInterval(() => { a.push({ t: window.__tf - t0, y: j.pos.y, vy: j.vel.y, f: j.fundura }); if (window.__tf - t0 > s) { clearInterval(id); r(a); } }, 15);
}), ms / 1000);

// ================= 1) computador, teclado, gráficos Linda =================
{
  console.log('--- teclado, Linda ---');
  const { ctx, p, P } = await abrir({ viewport: { width: 1024, height: 640 } }, 'alta');
  const S = SAIDA;
  ok(await p.evaluate(() => window.__jogo.graf.q.sombra > 0), 'nível Linda ativo');
  ok(!(await estado(p)).descerVisivel, 'em terra o botão de descer fica escondido');

  // cai de alto na piscina: a água segura a queda (splash) e ele boia com a cabeça para fora
  await por(p, P, 0, 15, 0, Math.PI / 2, 0);
  const queda = await seguir(p, 4500);
  const maxVyNaAgua = Math.min(...queda.filter((s) => s.f > 0.6).map((s) => s.vy));
  const entrou = queda.find((s) => s.f > 0.4);
  ok(entrou && entrou.vy > -10, `splash: entrou na água a ${entrou && entrou.vy.toFixed(1)} m/s (caindo de ~8 blocos, freou)`);
  ok(maxVyNaAgua > -12, `queda dentro d'água freada (vy mínimo na água ${maxVyNaAgua.toFixed(1)})`);
  const boia = await seguir(p, 2000);
  const fs = boia.map((s) => s.f), fMed = fs.reduce((a, c) => a + c, 0) / fs.length;
  const e1 = await estado(p);
  ok(fMed > 1.1 && fMed < 1.5 && !e1.cabeca && !e1.sub, `boiando parado com a cabeça fora (fundura média ${fMed.toFixed(2)}, olhos fora: ${!e1.cabeca})`);
  ok(Math.max(...fs) - Math.min(...fs) > 0.01 && Math.max(...fs) - Math.min(...fs) < 0.4, `balança de leve (variação ${(Math.max(...fs) - Math.min(...fs)).toFixed(3)})`);
  ok(e1.descerVisivel, 'na água o botão de descer aparece');
  ok(!e1.barra, 'barra de fôlego escondida com a cabeça fora');
  await p.evaluate(() => { window.__jogo.jog.pitch = -0.25; });
  await espera(p, 400);
  await p.screenshot({ path: S + '/linda-superficie.png' });

  // Shift mergulha
  await p.keyboard.down('Shift');
  await espera(p, 1500);
  const e2 = await estado(p);
  ok(e2.f > 2.3 && e2.cabeca && e2.sub && e2.tela && e2.nevoa, `Shift mergulha (fundura ${e2.f.toFixed(2)}, visão submersa ${e2.sub}, tom azul ${e2.tela})`);
  ok(e2.barra, 'barra de fôlego aparece embaixo d\'água');
  ok(await p.evaluate(() => window.__jogo.camera && document.querySelector('#agua-tela') && window.__jogo.agua.bolhas.visible), 'bolhas subindo visíveis');
  await p.keyboard.up('Shift');
  await p.evaluate(() => { window.__jogo.jog.pitch = 0; });
  await espera(p, 300);
  await p.screenshot({ path: S + '/linda-embaixo.png' });
  await p.evaluate(() => { window.__jogo.jog.pitch = 1.1; });
  await espera(p, 300);
  await p.screenshot({ path: S + '/linda-embaixo-olhando-cima.png' });
  // solto embaixo d'água: sobe sozinho devagar
  const yA = (await estado(p)).y;
  await espera(p, 1200);
  ok((await estado(p)).y > yA + 0.2, 'parado embaixo d\'água, sobe boiando devagar');

  // nadar para frente olhando para baixo (mergulho para frente)
  await por(p, P, 3, 5.58, 0, Math.PI / 2, -0.8); // boiando, olhando para baixo, frente = -x
  await espera(p, 600);
  const a3 = await estado(p);
  await p.keyboard.down('w');
  await espera(p, 1100);
  await p.keyboard.up('w');
  const b3 = await estado(p);
  ok(b3.y < a3.y - 0.8 && a3.x - b3.x > 1.2, `W olhando para baixo: mergulha para frente (desceu ${(a3.y - b3.y).toFixed(2)}, andou ${(a3.x - b3.x).toFixed(2)})`);

  // espaço sobe até a superfície (e nunca liga o voo)
  await p.evaluate(() => { window.__jogo.jog.pitch = 0; });
  await p.keyboard.down('Space');
  await espera(p, 1600);
  const c3 = await estado(p);
  await p.keyboard.up('Space');
  ok(!c3.cabeca && !c3.voando, `Espaço nada para cima até a superfície (olhos fora: ${!c3.cabeca}, voando: ${c3.voando})`);
  // apertar espaço duas vezes na água não liga o voo
  await p.keyboard.press('Space'); await espera(p, 120); await p.keyboard.press('Space');
  await espera(p, 300);
  ok(!(await estado(p)).voando, 'espaço duas vezes na água não liga o voo');
  await espera(p, 1500);

  // pula para fora da superfície
  await por(p, P, 0, 5.58, 0, Math.PI / 2, 0);
  await espera(p, 1500);
  const yBoia = (await estado(p)).y;
  await p.keyboard.down('Space');
  const pulo = await seguir(p, 900);
  await p.keyboard.up('Space');
  const yMax = Math.max(...pulo.map((s) => s.y));
  ok(yMax > yBoia + 0.8, `espaço na superfície dá um pulinho para fora (subiu ${(yMax - yBoia).toFixed(2)})`);
  await espera(p, 1500);

  // sair pela beirada alta (1 bloco acima da água) só andando
  await por(p, P, 0, 5.58, -3, 0, 0); // frente = -z (norte)
  await espera(p, 1200);
  await p.keyboard.down('w');
  await ateSair(p, P.Y0 + 7.9, 4); // solta o W ao pisar na terra (senão sai andando e cai da piscina no céu)
  await p.keyboard.up('w');
  const e4 = await estado(p);
  ok(!e4.naAgua && e4.y >= P.Y0 + 8 - 0.05 && e4.z < P.Z - 4, `andando contra a beirada alta, sobe para a terra (y ${(e4.y - P.Y0).toFixed(2)} acima do fundo, fora da água: ${!e4.naAgua})`);
  // de volta: sair pela beirada baixa (leste) com pulo
  await por(p, P, 2, 5.58, 0, -Math.PI / 2, 0); // frente = +x
  await espera(p, 1200);
  await p.keyboard.down('w'); await p.keyboard.down('Space');
  await ateSair(p, P.Y0 + 6.9, 4);
  await p.keyboard.up('w'); await p.keyboard.up('Space');
  const e5 = await estado(p);
  ok(!e5.naAgua && e5.x > P.X + 5, `W + espaço contra a beirada baixa, sai da piscina (x ${(e5.x - P.X).toFixed(2)})`);

  // correnteza continua puxando (água corrente perto de uma fonte, como no teste-agua)
  const corr = await p.evaluate(async (P) => {
    const { mundo, jog } = window.__jogo;
    const Y = P.Y0 + 9;
    for (let dx = -2; dx <= 9; dx++) for (let dz = -1; dz <= 1; dz++) { mundo.definir(P.X + dx, Y - 1, P.Z + 20 + dz, 3); }
    mundo.definir(P.X - 2, Y, P.Z + 20, 5);
    await new Promise((r) => setTimeout(r, 2500));
    const b = mundo.bloco(P.X + 1, Y, P.Z + 20);
    jog.pos.x = P.X + 1.5; jog.pos.y = Y; jog.pos.z = P.Z + 20.5; jog.vel.x = jog.vel.y = jog.vel.z = 0; jog.voando = false;
    const x0 = jog.pos.x, t0 = window.__tf;
    await new Promise((r) => { const id = setInterval(() => { if (window.__tf - t0 >= 1.2) { clearInterval(id); r(); } }, 15); });
    return { b, andou: jog.pos.x - x0, c: mundo.correnteza(P.X + 1, Y, P.Z + 20) };
  }, P);
  ok(corr.andou > 0.3, `correnteza leva o jogador (bloco ${corr.b}, andou ${corr.andou.toFixed(2)} na direção ${corr.c})`);

  // fôlego com vida desligada: fica no fundo segurando Shift até o fôlego acabar -> volta para cima sem dano
  await por(p, P, 0, 1, 0, Math.PI / 2, 0);
  await p.keyboard.down('Shift');
  const t0 = await p.evaluate(() => window.__tf);
  await espera(p, 6000);
  const meio = await estado(p);
  await p.screenshot({ path: S + '/linda-folego-gastando.png' });
  ok(meio.folego < 13 && meio.barra && meio.cabeca, `fôlego gastando embaixo d'água (${meio.folego.toFixed(1)} s)`);
  await p.waitForFunction(() => window.__jogo.jog.resgate || !window.__jogo.jog.cabecaNaAgua, null, { timeout: 60000 });
  const r1 = await estado(p);
  const tFolego = (await p.evaluate(() => window.__tf)) - t0;
  ok(r1.resgate && /respirar/i.test(r1.aviso), `fôlego acabou (${tFolego.toFixed(1)} s de jogo): aviso gentil "${r1.aviso}"`);
  await ateRespirar(p, 6);
  const r2 = await estado(p);
  ok(!r2.cabeca && r2.vida === 10, `mesmo segurando Shift, voltou à superfície sem dano (vida ${r2.vida})`);
  await p.keyboard.up('Shift');
  await espera(p, 3000);
  const r3 = await estado(p);
  ok(r3.folego > 14 && !r3.barra, `respirou: fôlego recuperado (${r3.folego.toFixed(1)}) e a barra some`);

  // fôlego com vida ligada (Monstros machucam): perde coração e não é levado para cima
  await p.evaluate(() => { const J = window.__jogo; J.opcoesMundo.selvagens = true; J.opcoesMundo.selvagensMachucam = true; J.vida.reiniciar(); });
  await por(p, P, 0, 1, 0, Math.PI / 2, 0);
  await p.keyboard.down('Shift');
  await espera(p, 800);
  await p.evaluate(() => { window.__jogo.agua.folego = 0.3; });
  await espera(p, 4200);
  const v1 = await estado(p);
  await p.screenshot({ path: S + '/linda-sem-folego-vida.png' });
  ok(v1.vida <= 8 && v1.cabeca && !v1.resgate, `com vida ligada: sem fôlego perde meio coração a cada ~1,5 s (vida ${v1.vida}/10, ainda embaixo)`);
  await p.keyboard.up('Shift');
  await p.evaluate(() => { const J = window.__jogo; J.opcoesMundo.selvagens = false; J.opcoesMundo.selvagensMachucam = false; J.vida.reiniciar(); });
  await espera(p, 2500);
  const v2 = await estado(p);
  ok(!v2.cabeca && !v2.sub && !v2.tela && !v2.nevoa, 'de volta na superfície: visão normal (sem névoa azul nem tom)');
  await ctx.close();
}

// ================= 2) computador, gráficos Leve =================
{
  console.log('--- teclado, Leve ---');
  const { ctx, p, P } = await abrir({ viewport: { width: 1024, height: 640 } }, 'baixa');
  ok(await p.evaluate(() => window.__jogo.graf.q.sombra === 0), 'nível Leve ativo');
  await por(p, P, 0, 5.58, 0, Math.PI / 2, -0.25);
  await espera(p, 1500);
  await p.screenshot({ path: SAIDA + '/leve-superficie.png' });
  await p.keyboard.down('Shift'); await espera(p, 1500); await p.keyboard.up('Shift');
  await p.evaluate(() => { window.__jogo.jog.pitch = 0; });
  await espera(p, 300);
  const e = await estado(p);
  const n = await p.evaluate(() => window.__jogo.agua.bolhas.geometry.drawRange.count);
  ok(e.sub && e.tela && n <= 12, `Leve: visão submersa ligada com poucas bolhas (${n})`);
  await p.screenshot({ path: SAIDA + '/leve-embaixo.png' });
  const fps = await p.evaluate(() => new Promise((r) => { let q = 0; const t0 = performance.now(); const f = () => { q++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(q / 2); }; requestAnimationFrame(f); }));
  console.log('      (fps no swiftshader, embaixo d\'água, Leve: ' + fps.toFixed(1) + ')');
  await ctx.close();
}

// ================= 3) tablet com toque =================
{
  console.log('--- tablet (toque) ---');
  const { ctx, p, P } = await abrir({ ...devices['Galaxy Tab S4 landscape'] }, 'baixa');
  const cdp = await ctx.newCDPSession(p);
  const vp = p.viewportSize();
  const centro = async (sel) => { const r = await p.locator(sel).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  const toque = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  ok(!(await estado(p)).descerVisivel, 'tablet: em terra o botão de descer fica escondido');
  await por(p, P, 0, 5.58, 0, Math.PI / 2, 0);
  await espera(p, 1500);
  const t1 = await estado(p);
  ok(t1.descerVisivel && !t1.cabeca, 'tablet: boiando, botão de descer aparece');
  // segura o botão de descer
  const bd = await centro('#bt-descer');
  await toque('touchStart', [{ x: bd.x, y: bd.y, id: 7 }]);
  await espera(p, 1500);
  await toque('touchEnd', []);
  const t2 = await estado(p);
  ok(t2.cabeca && t2.sub && t2.f > 2.3, `tablet: botão descer mergulha (fundura ${t2.f.toFixed(2)})`);
  await p.screenshot({ path: SAIDA + '/tablet-embaixo.png' });
  // segura o botão de pular: sobe
  const bp = await centro('#bt-pular');
  await toque('touchStart', [{ x: bp.x, y: bp.y, id: 8 }]);
  await espera(p, 1600);
  await toque('touchEnd', []);
  const t3 = await estado(p);
  ok(!t3.cabeca && !t3.voando, 'tablet: botão pular nada para cima até a superfície');
  await espera(p, 1500);
  // joystick para frente contra a beirada alta: sai sem apertar nada mais
  await por(p, P, 0, 5.58, -3, 0, 0);
  await espera(p, 1200);
  const x0 = vp.width * 0.2, y0 = vp.height * 0.6;
  await toque('touchStart', [{ x: x0, y: y0, id: 1 }]);
  await toque('touchMove', [{ x: x0, y: y0 - 60, id: 1 }]);
  await ateSair(p, P.Y0 + 7.9, 4);
  await toque('touchEnd', []);
  const t4 = await estado(p);
  ok(!t4.naAgua && t4.y >= P.Y0 + 8 - 0.05, `tablet: só andando com o joystick, sobe na beirada (y ${(t4.y - P.Y0).toFixed(2)})`);
  await espera(p, 400);
  ok(!(await estado(p)).descerVisivel, 'tablet: fora da água o botão de descer some');
  await p.screenshot({ path: SAIDA + '/tablet-saiu.png' });
  await ctx.close();
}

await b.close();
console.log(erros.length ? 'ERROS NO CONSOLE:\n' + erros.slice(0, 8).join('\n') : 'console sem erros');
const tudo = !falhas.length && !erros.length;
console.log(tudo ? 'OK' : `FALHOU (${falhas.length} verificações, ${erros.length} erros)`);
process.exit(tudo ? 0 : 1);

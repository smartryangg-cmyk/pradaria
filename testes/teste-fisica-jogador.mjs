// Física do jogador em terra: coyote time, buffer de pulo, degrau sem pulo, teto, encostar na parede,
// sair de dentro de bloco, queda rápida sem atravessar, dano de queda (só com corações) e queda macia.
// Joga de verdade com teclado (computador) e com os botões de toque (tablet emulado).
// Uso: (cd public && python3 -m http.server 8771) e depois: node testes/teste-fisica-jogador.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8771';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg, extra = '') => { console.log((ok ? 'OK    ' : 'FALHA ') + msg + (extra !== '' ? '  ' + JSON.stringify(extra) : '')); if (!ok) falhas.push(msg); };
const espiar = (p) => {
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
};

// abre o jogo, cria um mundo sozinho (com ou sem corações) e prepara ajudantes na página
async function abrir(ctx, comVida, toque) {
  const p = await ctx.newPage();
  espiar(p);
  await p.goto(BASE + '/#teste');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(600);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (comVida) await p.click('[data-opcao=selvagensMachucam]');
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 20000 });
  await p.waitForTimeout(2500);
  await p.evaluate(async () => {
    const g = window.__jogo;
    const { B, E } = await import('/js/blocos.js');
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const quadros = (n) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    // arena: o mundo tem 96 blocos de altura, então limpa tudo acima de Y-10 numa área e constrói ali
    // procura o lugar mais baixo (mar ou vale) para ter pouca coisa para limpar
    const M = g.mundo, Lm = (M.limite || 300) - 50, px = Math.floor(g.jog.pos.x), pz = Math.floor(g.jog.pos.z);
    let melhor = null;
    for (let cx = -Lm; cx <= Lm - 30; cx += 24) for (let cz = -Lm + 30; cz <= Lm; cz += 24) {
      const x = M.limite ? cx : px + cx, z = M.limite ? cz : pz + cz;
      let alto = 0;
      for (let dx = -7; dx <= 27; dx += 5) for (let dz = -32; dz <= 8; dz += 5) alto = Math.max(alto, M.alturaEm(x + dx, z + dz));
      if (!melhor || alto < melhor.alto) melhor = { x, z, alto };
    }
    const X = melhor.x, Z = melhor.z, Y = 45;
    const cubo = (x0, x1, y0, y1, z0, z1, id) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (M.bloco(x, y, z) !== id) M.definir(x, y, z, id); };
    cubo(X - 7, X + 27, Y - 10, 95, Z - 32, Z + 8, 0);
    Object.assign(g.jog.pos, { x: X + 0.5, y: Y + 30, z: Z + 6.5 }); g.jog.voando = true; g.jog.planando = false;
    const parado = () => { const j = g.jog; j.voando = false; j.planando = false; j.vel.x = j.vel.y = j.vel.z = 0; j.pitch = 0; };
    const por = (x, y, z, yaw = 0) => { const j = g.jog; parado(); j.pos.x = x; j.pos.y = y; j.pos.z = z; j.yaw = yaw; };
    // calmo: de dia e sem monstrinhos atrapalhando
    const calmo = () => { g.dia = 0.3; if (g.monstros) { g.monstros.tempoSpawn = 1e9; if (g.monstros.limpar) g.monstros.limpar(); } };
    // grava o que acontece a cada quadro até cond() ou o tempo acabar
    const gravar = (ms, cada) => new Promise((r) => { const t0 = performance.now(); const f = () => { cada(g.jog); if (performance.now() - t0 < ms) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
    const tecla = (tipo, code) => dispatchEvent(new KeyboardEvent(tipo, { code, key: code === 'Space' ? ' ' : code }));
    // espera até a ação ou o tempo acabar (o jogo roda devagar no navegador de teste)
    const ate = async (cond, ms) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (cond(g.jog)) return true; await new Promise((r) => requestAnimationFrame(r)); } return false; };
    window.__t = { B, E, X, Y, Z, cubo, por, parado, calmo, gravar, tecla, espera, quadros, ate };
    calmo();
    // espera o mundo novo em volta ficar pronto (quadros mais rápidos)
    for (let i = 0; i < 20; i++) { const t0 = performance.now(); await quadros(10); if (performance.now() - t0 < 1000) break; }
  });
  return p;
}

// ===================== computador (teclado), mundo com corações =====================
const ctxPc = await b.newContext({ viewport: { width: 1024, height: 640 } });
const p = await abrir(ctxPc, true, false);
const J = (f, a) => p.evaluate(f, a);
conferir(await J(() => window.__jogo.vida.ligada()), 'mundo de teste com corações ligados');

// --- 1. testes de física puros (passos fixos, sem depender do FPS) com um Jogador separado ---
const u = await J(async () => {
  const { Jogador } = await import('/js/jogador.js');
  // estes jogadores de teste não podem tirar corações do jogador de verdade (a vida é uma só)
  const vida = window.__jogo.vida, danoDeVerdade = vida.dano; vida.dano = () => false;
  try {
  const { X, Y, Z, cubo, B } = window.__t, m = window.__jogo.mundo;
  const ox = X + 20; // longe do jogador de verdade
  cubo(ox - 6, ox + 6, Y, Y, Z - 30, Z + 6, B.PEDRA);
  const nada = { frente: 0, lado: 0, pular: false, descer: false, correr: false };
  const novo = (x, y, z) => { const j = new Jogador(m); j.pos.x = x; j.pos.y = y; j.pos.z = z; j.atualizar(1 / 60, nada); return j; };
  const passos = (j, n, ent, dt = 1 / 60, cada) => { for (let i = 0; i < n; i++) { j.atualizar(dt, ent); if (cada) cada(j, i); } };
  const r = {};
  // queda rápida a 10 FPS: não atravessa chão de 1 bloco
  { const j = novo(ox + 0.5, Y + 40, Z + 0.5); j.vel.y = -40; passos(j, 30, nada, 0.1); r.quedaRapida = j.pos.y; }
  { const j = novo(ox + 0.5, Y + 3.2, Z + 0.5); j._ult = { ...j.pos }; j.vel.y = -40; j.atualizar(0.1, nada); r.quedaUmQuadro = j.pos.y; }
  // anda na diagonal: não passa do limite
  { const j = novo(ox - 5.5, Y + 1, Z + 5.5); let max = 0; passos(j, 40, { ...nada, frente: 1, lado: 1 }, 1 / 60, (k) => { max = Math.max(max, Math.hypot(k.vel.x, k.vel.z)); }); r.diagonal = max;
    let maxC = 0; passos(j, 40, { ...nada, frente: 1, lado: 1, correr: true }, 1 / 60, (k) => { maxC = Math.max(maxC, Math.hypot(k.vel.x, k.vel.z)); }); r.diagonalCorrendo = maxC;
    // soltou: para rápido no chão
    let t = 0; while (Math.hypot(j.vel.x, j.vel.z) > 0.1 && t < 2) { j.atualizar(1 / 60, nada); t += 1 / 60; } r.tempoParar = t; }
  // parede: encosta exatamente (sem ficar a centímetros)
  cubo(ox - 6, ox + 6, Y + 1, Y + 3, Z - 6, Z - 6, B.PEDRA);
  { const j = novo(ox + 0.5, Y + 1, Z - 2.5); passos(j, 60, { ...nada, frente: 1 }, 1 / 20); r.folgaParede = j.pos.z - 0.3 - (Z - 5); r.paredeY = j.pos.y; }
  // degrau de 1 bloco: sobe sem pulo e sem perder velocidade
  cubo(ox - 6, ox + 6, Y + 1, Y + 1, Z - 14, Z - 10, B.PEDRA);
  cubo(ox - 6, ox + 6, Y + 1, Y + 3, Z - 6, Z - 6, 0);
  { const j = novo(ox + 0.5, Y + 1, Z - 6.5); let vy = 0, vmin = 9; passos(j, 60, { ...nada, frente: 1 }, 1 / 60, (k, i) => { vy = Math.max(vy, k.vel.y); if (i > 20 && k.pos.z < Z - 9 && k.pos.z > Z - 12) vmin = Math.min(vmin, Math.hypot(k.vel.x, k.vel.z)); }); r.degrau = { y: j.pos.y, vyMax: vy, velMin: vmin, z: j.pos.z, degrauY: j.degrauY }; }
  // parede de 2 blocos: não sobe
  cubo(ox - 6, ox + 6, Y + 2, Y + 3, Z - 18, Z - 18, B.PEDRA); cubo(ox - 6, ox + 6, Y + 1, Y + 1, Z - 18, Z - 18, B.PEDRA);
  { const j = novo(ox + 0.5, Y + 2, Z - 15.5); passos(j, 90, { ...nada, frente: 1 }); r.paredeAlta = { y: j.pos.y, z: j.pos.z }; }
  // coyote: saiu da beirada e pulou 0,05 s depois: pula. 0,2 s depois: não pula
  cubo(ox - 6, ox + 6, Y, Y, Z - 30, Z - 20, 0);
  for (const atraso of [0.05, 0.2]) {
    const j = novo(ox + 0.5, Y + 4, Z - 17.5); passos(j, 10, nada); // em cima da parede alta (topo em Y+4); beirada em z = Z-18
    let noAr = 0, pulou = false;
    for (let i = 0; i < 200; i++) {
      const ent = { ...nada, frente: 1 };
      if (!j.noChao) noAr += 1 / 60;
      if (noAr > atraso && noAr < atraso + 0.02) ent.pular = true;
      const vyA = j.vel.y; j.atualizar(1 / 60, ent);
      if (j.vel.y > 5 && vyA < 1) pulou = true;
      if (noAr > atraso + 0.1) break;
    }
    r['coyote' + atraso] = pulou;
  }
  // buffer: apertou pular pouco antes de pousar (e soltou): pula ao tocar o chão
  cubo(ox - 6, ox + 6, Y + 1, Y + 3, Z - 20, Z - 10, 0);
  { const j = novo(ox + 0.5, Y + 1, Z + 0.5); passos(j, 5, { ...nada, pular: true }); passos(j, 3, nada);
    let apertou = false, alturaAperto = 0, repulou = false, pousou = false;
    for (let i = 0; i < 120; i++) {
      const ent = { ...nada };
      if (!apertou && j.vel.y < 0 && j.pos.y - (Y + 1) < 0.35) { ent.pular = true; apertou = true; alturaAperto = j.pos.y - (Y + 1); }
      j.atualizar(1 / 60, ent);
      if (apertou && j.noChao) pousou = true;
      if (apertou && j.vel.y > 5) { repulou = true; break; }
    }
    r.buffer = { repulou, alturaAperto };
  }
  // sem buffer: apertar no meio do ar (longe do chão) não pula ao pousar
  { const j = novo(ox + 0.5, Y + 1, Z + 0.5); passos(j, 5, { ...nada, pular: true }); passos(j, 3, nada);
    let ap = false, repulou = false;
    for (let i = 0; i < 120; i++) { const ent = { ...nada }; if (!ap && j.vel.y < 0 && j.pos.y - (Y + 1) > 1) { ent.pular = true; ap = true; } j.atualizar(1 / 60, ent); if (ap && j.vel.y > 5) repulou = true; }
    r.semBufferLonge = repulou; }
  // teto: bate a cabeça e para de subir na hora
  cubo(ox - 1, ox + 1, Y + 3, Y + 3, Z + 2, Z + 4, B.PEDRA);
  { const j = novo(ox + 0.5, Y + 1, Z + 3.5); let yMax = 0, t = 0, subindoDepois = false, bateu = false;
    j.atualizar(1 / 60, { ...nada, pular: true });
    for (let i = 0; i < 120; i++) { j.atualizar(1 / 60, nada); t += 1 / 60; yMax = Math.max(yMax, j.pos.y); if (j.pos.y + 1.69 > Y + 2.99) bateu = true; if (bateu && j.vel.y > 0 && j.pos.y < yMax - 0.01) subindoDepois = true; if (j.noChao && t > 0.05) break; }
    r.teto = { cabeca: yMax + 1.69, limite: Y + 3, tempoNoAr: t, subindoDepois }; }
  // agachar: devagar, não corre, olhos mais baixos, não cai da beirada e só levanta com espaço em cima
  cubo(ox - 1, ox + 1, Y + 3, Y + 3, Z + 2, Z + 4, 0);
  { const j = novo(ox + 0.5, Y + 1, Z + 4.5); let v = 0, corr = false;
    passos(j, 60, { ...nada, frente: 1, correr: true, agachar: true }, 1 / 60, (k) => { v = Math.max(v, Math.hypot(k.vel.x, k.vel.z)); corr = corr || k.correndo; });
    r.agachado = { vel: v, correndo: corr, olhos: j.alturaOlhos, altura: j.altura, agachado: j.agachado };
    let vc = 0, cc = false; passos(j, 60, { ...nada, frente: 1, correr: true }, 1 / 60, (k) => { vc = Math.max(vc, Math.hypot(k.vel.x, k.vel.z)); cc = cc || k.correndo; });
    r.correndo = { vel: vc, correndo: cc, olhos: j.alturaOlhos, agachado: j.agachado }; }
  // beirada: a plataforma termina em x = ox+7; anda agachado de lado 4 s para fora e não cai
  { const j = novo(ox + 4.5, Y + 1, Z + 0.5); passos(j, 240, { ...nada, lado: 1, agachar: true });
    r.beira = { y: j.pos.y - Y, x: j.pos.x - ox, noChao: j.noChao };
    passos(j, 60, { ...nada, lado: 1 }); r.beiraSemAgachar = { y: j.pos.y - Y }; }
  // teto baixo: agachado no ar, perto do teto, soltou o botão: continua agachado até ter espaço
  cubo(ox + 3, ox + 5, Y + 3, Y + 3, Z - 3, Z - 1, B.PEDRA);
  { const j = novo(ox + 4.5, Y + 1, Z - 1.5); j.atualizar(1 / 60, { ...nada, agachar: true });
    j.pos.y = Y + 1.4; j.vel.y = 0; j.atualizar(1 / 60, { ...nada, agachar: true }); j.pos.y = Y + 1.4; j.vel.y = 0; j._ult = { ...j.pos };
    j.atualizar(1 / 60, nada); const ficou = j.agachado;
    passos(j, 60, nada); r.tetoBaixo = { ficouAgachado: ficou, depoisDePousar: j.agachado, y: j.pos.y - Y }; }
  // bloco colocado dentro do corpo (areia caiu, amigo colocou): sai para fora
  { const j = novo(ox + 0.5, Y + 1, Z + 0.5); m.definir(ox, Y + 1, Z, B.PEDRA); j.atualizar(1 / 60, nada); r.desenrosca = { colide: j.colide(j.pos.x, j.pos.y, j.pos.z), pos: [j.pos.x - ox, j.pos.y - Y, j.pos.z - Z] }; m.definir(ox, Y + 1, Z, 0); }
  return r;
  } finally { vida.dano = danoDeVerdade; }
});
console.log(JSON.stringify(u));
const { Y, Z } = await J(() => ({ Y: window.__t.Y, Z: window.__t.Z }));
conferir(Math.abs(u.quedaRapida - (Y + 1)) < 1e-9, 'queda a -40 com 10 FPS para em cima do chão de 1 bloco', u.quedaRapida - Y);
conferir(Math.abs(u.quedaUmQuadro - (Y + 1)) < 1e-9, 'um quadro de 0,1 s a -40 (4 blocos) não atravessa', u.quedaUmQuadro - Y);
conferir(u.diagonal <= 4.41 && u.diagonal > 4.2, 'diagonal não passa de 4,4', u.diagonal);
conferir(u.diagonalCorrendo <= 6.39 && u.diagonalCorrendo > 6, 'correndo na diagonal não passa de 6,38', u.diagonalCorrendo);
conferir(u.tempoParar < 0.3, 'no chão para rápido ao soltar', u.tempoParar);
conferir(u.folgaParede >= 0 && u.folgaParede < 0.002 && u.paredeY === Y + 1, 'encosta exatamente na parede (a 10 FPS)', u.folgaParede);
conferir(Math.abs(u.degrau.y - (Y + 2)) < 1e-9 && u.degrau.vyMax < 0.5 && u.degrau.velMin > 3.8, 'sobe degrau sem pulo e sem perder velocidade', u.degrau);
conferir(Math.abs(u.paredeAlta.y - (Y + 1)) < 1e-9 && u.paredeAlta.z >= Z - 16.7 - 1e-3, 'parede de 2 blocos não sobe sozinho', u.paredeAlta);
conferir(u['coyote0.05'] === true, 'coyote: pula 0,05 s depois de sair da beirada');
conferir(u['coyote0.2'] === false, 'coyote: 0,2 s depois já não pula');
conferir(u.buffer.repulou, 'buffer: apertou pouco antes de pousar e pulou ao tocar o chão', u.buffer);
conferir(!u.semBufferLonge, 'apertar lá no alto do pulo não guarda pulo');
conferir(u.teto.cabeca <= u.teto.limite + 1e-6 && !u.teto.subindoDepois && u.teto.tempoNoAr < 0.45, 'bate a cabeça no teto e para de subir', u.teto);
conferir(Math.abs(u.agachado.vel - 4.4 * 0.35) < 0.05 && !u.agachado.correndo && u.agachado.olhos < 1.27 && u.agachado.altura < 1.5, 'agachado: ~0,35x da velocidade, não corre, olhos e caixa mais baixos', u.agachado);
conferir(Math.abs(u.correndo.vel - 4.4 * 1.45) < 0.05 && u.correndo.correndo && !u.correndo.agachado && u.correndo.olhos > 1.53, 'correr: ~1,45x e correndo=true; levanta ao soltar agachar', u.correndo);
conferir(u.beira.y === 1 && u.beira.noChao && u.beira.x >= 7 && u.beira.x < 7.3, 'agachado não cai da beirada (fica pendurado na borda)', u.beira);
conferir(u.beiraSemAgachar.y < 0, 'sem agachar cai da beirada', u.beiraSemAgachar);
conferir(u.tetoBaixo.ficouAgachado && !u.tetoBaixo.depoisDePousar && u.tetoBaixo.y === 1, 'teto baixo: continua agachado até ter espaço', u.tetoBaixo);
conferir(!u.desenrosca.colide, 'bloco no próprio corpo: empurra para fora', u.desenrosca);

conferir(await J(() => window.__jogo.vida.atual === 10), 'testes puros não mexeram nos corações do jogador');
// --- 2. jogando de verdade com o teclado ---
// degrau: segurando W, sobe sozinho sem pulo
const deg = await J(async () => {
  const { X, Y, Z, cubo, por, gravar, B, calmo, espera } = window.__t;
  calmo();
  cubo(X - 4, X + 4, Y, Y, Z - 14, Z + 4, B.PEDRA);
  cubo(X - 4, X + 4, Y + 1, Y + 1, Z - 14, Z - 6, B.PEDRA); // degrau
  por(X + 0.5, Y + 1, Z + 1.5, 0);
  await espera(300);
  return window.__jogo.jog.pos.y - Y;
});
await p.keyboard.down('KeyW');
let vyMaxDeg = await J(async () => { let vy = 0; const { ate, Z } = window.__t; await ate((j) => { vy = Math.max(vy, j.vel.y); return j.pos.z < Z - 8; }, 10000); return vy; });
await p.keyboard.up('KeyW');
const posDeg = await J(() => ({ ...window.__jogo.jog.pos }));
await p.screenshot({ path: SAIDA + '/degrau.png' });
conferir(Math.abs(posDeg.y - (Y + 2)) < 0.01 && vyMaxDeg < 0.5, 'teclado: W sobe o degrau sem pular', { y: posDeg.y - Y, vyMax: vyMaxDeg });

// coyote com teclado: anda (W) para fora da beirada e aperta espaço logo depois de sair
const coy = [];
for (const [atrasoMin, atrasoMax] of [[0, 0.1], [0.2, 0.45]]) {
  await J(async () => {
    const { X, Y, Z, cubo, por, B, calmo, espera } = window.__t;
    calmo();
    cubo(X - 4, X + 4, Y, Y, Z - 14, Z + 4, 0); cubo(X - 4, X + 4, Y + 1, Y + 1, Z - 14, Z - 6, 0);
    cubo(X - 4, X + 4, Y, Y, Z - 3, Z + 4, B.PEDRA); // plataforma; beirada em z = Z-3
    cubo(X - 4, X + 4, Y - 8, Y - 8, Z - 20, Z - 4, B.PEDRA); // chão lá embaixo
    por(X + 0.5, Y + 1, Z + 2.5, 0);
    await espera(300);
  });
  // vigia na página: quando sai da beirada (sem ter pulado), aperta espaço no tempo pedido
  const vig = J(([a0, a1]) => new Promise((r) => {
    const { tecla, Y } = window.__t; const g = window.__jogo;
    let apertou = null, vyDepois = -99, t0 = performance.now();
    const f = () => {
      const j = g.jog;
      if (!apertou && !j.noChao && !j.pulou && j.pos.y < Y + 1 - 1e-6 && j.tempoNoAr > a0 && j.tempoNoAr < a1) { apertou = { tempoNoAr: j.tempoNoAr, abaixo: Y + 1 - j.pos.y, t: performance.now() }; tecla('keydown', 'Space'); setTimeout(() => tecla('keyup', 'Space'), 300); }
      if (apertou) vyDepois = Math.max(vyDepois, j.vel.y);
      if (performance.now() - t0 < 12000 && !(apertou && performance.now() - apertou.t > 1500)) requestAnimationFrame(f); else r({ apertou, vyDepois });
    };
    requestAnimationFrame(f);
  }), [atrasoMin, atrasoMax]);
  await p.keyboard.down('KeyW');
  await J(() => window.__t.ate((j) => j.pos.z < window.__t.Z - 3, 10000));
  await p.waitForTimeout(200);
  if (!coy.length) await p.screenshot({ path: SAIDA + '/coyote.png' });
  await p.keyboard.up('KeyW');
  coy.push(await vig);
}
conferir(coy[0].apertou && coy[0].vyDepois > 5, 'teclado: espaço logo depois de sair da beirada ainda pula (coyote)', coy[0]);
conferir(coy[1].apertou && coy[1].vyDepois < 1, 'teclado: espaço muito depois de sair da beirada não pula', coy[1]);

// pulo normal com espaço (e espaço duas vezes ainda liga o voo)
const pul = await J(async () => {
  const { X, Y, Z, cubo, por, gravar, B, calmo, espera, tecla } = window.__t;
  calmo(); cubo(X - 4, X + 4, Y, Y, Z - 14, Z + 4, B.PEDRA); por(X + 0.5, Y + 1, Z + 1.5, 0); await espera(300);
  return Y;
});
await p.keyboard.down('Space'); await p.waitForTimeout(250); await p.keyboard.up('Space');
const alturaPulo = await J(async () => { let y = 0, subiu = false; await window.__t.ate((j) => { y = Math.max(y, j.pos.y); if (j.vel.y > 1) subiu = true; return subiu && j.noChao; }, 8000); return y - window.__t.Y - 1; });
conferir(alturaPulo > 1.15 && alturaPulo < 1.4, 'espaço pula ~1,3 bloco', alturaPulo);
await p.keyboard.press('Space'); await p.waitForTimeout(100); await p.keyboard.press('Space');
await p.waitForTimeout(200);
conferir(await J(() => window.__jogo.jog.voando), 'espaço duas vezes liga o voo');
await p.keyboard.press('KeyF'); await p.waitForTimeout(200);
conferir(!(await J(() => window.__jogo.jog.voando)), 'F desliga o voo');

// agachar jogando: W até a beirada segurando "agachar" (entrada simulada no jogador de verdade): não cai
const agReal = await J(async () => {
  const { X, Y, Z, cubo, por, B, calmo, espera, ate } = window.__t; const g = window.__jogo, j = g.jog;
  calmo();
  cubo(X - 4, X + 4, Y - 8, Y + 14, Z - 20, Z + 4, 0);
  cubo(X - 4, X + 4, Y, Y, Z - 3, Z + 4, B.PEDRA); cubo(X - 4, X + 4, Y - 8, Y - 8, Z - 20, Z - 4, B.PEDRA);
  por(X + 0.5, Y + 1, Z + 2.5, 0);
  if (!j._orig) { j._orig = j.atualizar; j.atualizar = function (dt, ent) { return j._orig.call(this, dt, { ...ent, agachar: !!window.__agachar }); }; }
  window.__agachar = true;
  await espera(200);
  return true;
});
await p.keyboard.down('KeyW');
const agR = await J(async () => { const { ate, Y, Z } = window.__t; const j = window.__jogo.jog; let menor = 99; await ate((k) => { menor = Math.min(menor, k.pos.y - Y); return k.pos.z < Z - 3.25; }, 10000); await window.__t.espera(800); menor = Math.min(menor, j.pos.y - Y); return { menorY: menor, z: j.pos.z - Z, olhos: j.alturaOlhos, agachado: j.agachado }; });
await p.screenshot({ path: SAIDA + '/agachado-beirada.png' });
await J(() => { window.__agachar = false; });
await p.waitForTimeout(1500);
await p.keyboard.up('KeyW');
const agR2 = await J(() => window.__jogo.jog.pos.y - window.__t.Y);
conferir(agR.menorY === 1 && agR.agachado && agR.olhos < 1.3, 'jogando: agachado anda até a beirada e não cai', agR);
conferir(agR2 < 0, 'jogando: soltou agachar e continuou andando: cai da beirada', agR2);
await J(() => { const j = window.__jogo.jog; j.atualizar = j._orig; delete j._orig; });

// queda com corações: cair 10 blocos tira 3 corações (6 meios)
const quedas = {};
for (const [nome, prep] of [['pedra10', 'pedra'], ['agua10', 'agua'], ['feno10', 'feno'], ['trampolim10', 'trampolim'], ['pedra4', 'pedra4'], ['voando', 'voando'], ['rapida40', 'rapida']]) {
  quedas[nome] = await J(async (tipo) => {
    const { X, Y, Z, cubo, por, B, E, calmo, espera } = window.__t; const g = window.__jogo;
    calmo();
    por(X + 0.5, Y + 1, Z - 0.5, 0); // parado no chão antes de trocar a arena (ex.: ainda quicando no trampolim)
    cubo(X - 4, X + 4, Y - 8, Y + 14, Z - 20, Z + 4, 0);
    cubo(X - 4, X + 4, Y, Y, Z - 6, Z + 4, B.PEDRA);
    if (tipo === 'agua') { cubo(X - 3, X + 3, Y - 3, Y - 3, Z - 5, Z + 3, B.PEDRA); cubo(X - 2, X + 2, Y - 2, Y, Z - 4, Z + 2, B.PEDRA); cubo(X - 1, X + 1, Y - 2, Y, Z - 3, Z + 1, B.AGUA); }
    if (tipo === 'feno') cubo(X - 1, X + 1, Y, Y, Z - 1, Z + 1, B.FENO);
    if (tipo === 'trampolim') cubo(X - 1, X + 1, Y, Y, Z - 1, Z + 1, E.TRAMPOLIM);
    g.vida.reiniciar(); g.vida.protegido = 0;
    await espera(200);
    const alt = tipo === 'pedra4' ? 4 : tipo === 'rapida' ? 40 : 10;
    por(X + 0.5, Y + 1 + alt, Z - 0.5, 0);
    if (tipo === 'voando') { g.jog.voando = true; }
    if (tipo === 'rapida') g.jog.vel.y = -40;
    let menorY = 1e9;
    const t0 = performance.now();
    if (tipo === 'voando') { // desce voando com Shift até o chão
      dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
      while (performance.now() - t0 < 12000 && g.jog.voando) await espera(50);
      dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
    }
    while (performance.now() - t0 < 12000) { menorY = Math.min(menorY, g.jog.pos.y); if ((g.jog.noChao || tipo === "trampolim") && menorY < Y + 2) break; await new Promise((r) => requestAnimationFrame(r)); }
    if (tipo === 'trampolim') await espera(1500);
    await espera(200);
    const r = { vida: g.vida.atual, cheios: document.querySelectorAll('#vida .coracao.cheio').length, y: g.jog.pos.y - Y, menorY: menorY - Y, naAgua: g.jog.naAgua };
    return r;
  }, prep);
  if (nome === 'pedra10') await p.screenshot({ path: SAIDA + '/queda-coracoes.png' });
}
console.log(JSON.stringify(quedas));
conferir(quedas.pedra10.vida === 4 && quedas.pedra10.cheios === 2, 'cair 10 blocos na pedra tira 3 corações (sobram 2)', quedas.pedra10);
conferir(quedas.pedra4.vida === 10, 'cair 4 blocos não machuca', quedas.pedra4);
conferir(quedas.agua10.vida === 10, 'cair 10 blocos na água não machuca', quedas.agua10);
conferir(quedas.feno10.vida === 10, 'cair 10 blocos no feno não machuca', quedas.feno10);
conferir(quedas.trampolim10.vida === 10, 'cair 10 blocos no trampolim não machuca (quica)', quedas.trampolim10);
conferir(quedas.voando.vida === 10, 'descer voando até o chão não machuca', quedas.voando);
conferir(quedas.rapida40.menorY >= 1 - 1e-6 && Math.abs(quedas.rapida40.y - 1) < 1e-6, 'queda rápida de 40 blocos (a -40) para no chão de 1 bloco (não atravessa)', quedas.rapida40);
conferir(quedas.rapida40.vida === 0 || quedas.rapida40.vida === 10, '(info) queda de 40 blocos: desmaia (e acorda)', quedas.rapida40.vida);
await p.waitForTimeout(2500); // espera o desmaio terminar

// ===================== tablet emulado (botões de toque), mundo sem corações =====================
const ctxTab = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const t = await abrir(ctxTab, false, true);
const T = (f, a) => t.evaluate(f, a);
const cdp = await ctxTab.newCDPSession(t);
conferir(!(await T(() => window.__jogo.vida.ligada())) && await t.locator('#vida').isHidden(), 'tablet: mundo sem corações');
const vp = t.viewportSize();
await T(async () => {
  const { X, Y, Z, cubo, por, B, calmo, espera } = window.__t;
  calmo(); cubo(X - 4, X + 4, Y, Y, Z - 14, Z + 4, B.PEDRA); cubo(X - 4, X + 4, Y + 1, Y + 1, Z - 14, Z - 6, B.PEDRA);
  por(X + 0.5, Y + 1, Z + 1.5, 0); await espera(400);
});
const Yt = await T(() => window.__t.Y);
// joystick: arrasta para cima no lado esquerdo e segura
const x0 = vp.width * 0.18, y0 = vp.height * 0.7;
const vigDeg = T(() => new Promise((r) => { let vy = 0; window.__t.ate((j) => { vy = Math.max(vy, j.vel.y); return j.pos.z < window.__t.Z - 8; }, 10000).then(() => r(vy)); }));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: y0 - 50, id: 1 }] });
const vyTab = await vigDeg;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const posTab = await T(() => ({ ...window.__jogo.jog.pos }));
await t.screenshot({ path: SAIDA + '/tablet-degrau.png' });
conferir(Math.abs(posTab.y - (Yt + 2)) < 0.01 && vyTab < 0.5, 'tablet: joystick sobe o degrau sem pular', { y: posTab.y - Yt, vyMax: vyTab });
// botão de pular: um toque rápido pula a altura toda (dá para subir num bloco)
const bt = await t.locator('#bt-pular').boundingBox();
const vigPulo = T(() => new Promise((r) => { const y0 = window.__jogo.jog.pos.y; let y = y0, subiu = false; window.__t.ate((j) => { y = Math.max(y, j.pos.y); if (j.vel.y > 1) subiu = true; return subiu && j.noChao; }, 8000).then(() => r(y - y0)); }));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bt.x + bt.width / 2, y: bt.y + bt.height / 2, id: 2 }] });
await t.waitForTimeout(250);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const altTab = await vigPulo;
conferir(altTab > 1.15, 'tablet: toque no botão pular pula ~1,3 bloco', altTab);
// sem corações: cair 10 blocos não tira nada (só o baque)
const semVida = await T(async () => {
  const { X, Y, Z, por, espera } = window.__t; const g = window.__jogo;
  por(X + 0.5, Y + 12, Z + 2.5, 0);
  let baque = 0; const t0 = performance.now();
  while (performance.now() - t0 < 10000) { baque = Math.min(baque, g.jog.baqueY); await new Promise((r) => requestAnimationFrame(r)); if (g.jog.noChao && g.jog.pos.y < Y + 2) break; }
  for (let i = 0; i < 3; i++) { baque = Math.min(baque, g.jog.baqueY); await new Promise((r) => requestAnimationFrame(r)); }
  return { vida: g.vida.atual, baque, y: g.jog.pos.y - Y };
});
await t.screenshot({ path: SAIDA + '/tablet-queda.png' });
conferir(semVida.vida === 10 && Math.abs(semVida.y - 1) < 1e-6, 'tablet sem corações: queda de 11 blocos não machuca', semVida);
conferir(semVida.baque < -0.1, 'queda alta dá um baque na câmera', semVida.baque);

console.log(erros.length ? 'ERROS NO CONSOLE:\n' + erros.slice(0, 8).join('\n') : 'console sem erros');
const ok = !falhas.length && !erros.length;
console.log(ok ? 'OK' : 'FALHOU: ' + falhas.join(' | '));
await b.close();
process.exit(ok ? 0 : 1);

// Movimentos do boneco, jogando de verdade: parado (respira), andando, correndo (Shift), agachado (Z),
// pulando, aterrissando, caindo de alto, nadando, voando; cabeça seguindo a câmera; olhos e balanço
// na 1ª pessoa; flags para os amigos; e no tablet o toque duplo no joystick (correr) e o botão de agachar.
// Também simula um amigo (mensagens 'pos') para ver ele andar/correr/agachar.
// Uso: (cd public && python3 -m http.server 8774) e depois: URL=http://localhost:8774 node testes/teste-movimentos.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = (process.env.URL || 'http://localhost:8774') + '/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const erros = [];
const ok = (c, t) => { console.log(c ? 'OK  ' : 'FALHA', t); if (!c) falhas++; };
const f2 = (v) => (+v).toFixed(2);

async function abrir(ctxOpc, nome) {
  const ctx = await b.newContext(ctxOpc);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(500);
  const toque = !!ctxOpc.hasTouch;
  await p[toque ? 'tap' : 'click']('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  await p[toque ? 'tap' : 'click']('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 20000 });
  await p.waitForTimeout(3500);
  // campo plano de pedra 41x41 (ar em cima) com uma piscina funda num canto
  await p.evaluate(() => {
    const J = window.__jogo, m = J.mundo, j = J.jog;
    const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.floor(j.pos.y) + 1;
    for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) {
      m.definir(x0 + x, y0 - 1, z0 + z, 3);
      for (let y = 0; y < 10; y++) m.definir(x0 + x, y0 + y, z0 + z, 0);
    }
    j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0; J.dia = 0.3;
    window.__base = [x0, y0, z0];
  });
  await p.waitForTimeout(700);
  return { p, ctx };
}
// estado do boneco e do jogador
const ler = (p) => p.evaluate(() => {
  const J = window.__jogo, j = J.jog, bo = J.visao.boneco, A = bo && bo.anim;
  const r = (o) => +o.rotation.x.toFixed(2);
  return {
    t: performance.now() / 1000, vh: Math.hypot(j.vel.x, j.vel.z), pos: [j.pos.x, j.pos.y, j.pos.z], noChao: j.noChao, vy: j.vel.y, voando: j.voando, naAgua: j.naAgua,
    membros: bo ? bo.membros.map(r) : [], membrosZ: bo ? bo.membros.map((m) => +m.rotation.z.toFixed(2)) : [],
    canelas: bo ? bo.canelas.map(r) : [], antebracos: bo ? bo.antebracos.map(r) : [],
    quadril: bo ? +bo.quadril.position.y.toFixed(3) : 0, tronco: bo ? r(bo.tronco) : 0, raiz: bo ? r(bo.raiz) : 0,
    cabX: bo ? r(bo.cabeca) : 0, cabY: bo ? +(bo.cabeca.rotation.y + bo.tronco.rotation.y).toFixed(2) : 0,
    yawCorpo: A ? A.yawCorpo : 0, fase: A ? A.fase : 0, amp: A ? A.amp : 0, pousoAtivo: A ? A.pouso < A.pousoT : false, queda: A ? A.queda : 0,
    correndo: J.visao.correndo, agachado: J.visao.agachado, olhos: J.visao.alturaOlhos, camY: J.camera.position.y - j.pos.y,
    estado: { ...J.ctrl.estado },
  };
});
// amostra por um tempo: devolve a lista
async function amostrar(p, ms, passo = 60) {
  const l = [];
  for (let t = 0; t < ms; t += passo) { l.push(await ler(p)); await p.waitForTimeout(passo); }
  return l;
}
// velocidade de verdade (andou / tempo do relógio) e a da física (em aparelho lento o relógio anda mais)
const velocidade = (l) => {
  const a = l[0].pos, z = l[l.length - 1].pos;
  return Math.hypot(z[0] - a[0], z[2] - a[2]) / (l.at(-1).t - l[0].t);
};
const velFisica = (l) => l.reduce((s, e) => s + e.vh, 0) / l.length;
const amplitude = (l, k, i) => Math.max(...l.map((e) => Math.abs(e[k][i])));
const voltar = (p, extra = '') => p.evaluate((extra) => {
  const J = window.__jogo, j = J.jog, [x0, y0, z0] = window.__base;
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5 + (extra === 'sul' ? 12 : 0); j.pos.y = y0; j.vel.x = j.vel.y = j.vel.z = 0; j.voando = false; j.yaw = 0; j.pitch = 0;
}, extra);

// ================= PC: teclado, 3ª pessoa =================
{
  const { p } = await abrir({ viewport: { width: 1024, height: 640 } }, 'PC');
  const D = (n) => `${SAIDA}/${n}.png`;
  await p.keyboard.press('KeyR'); await p.keyboard.press('KeyR'); // olhos -> de trás -> de frente
  await p.waitForTimeout(900);
  ok(await p.evaluate(() => window.__jogo.visao.modo === 2), 'R troca a câmera (de frente)');

  // parado: respira (tronco mexe um tiquinho), braços quase parados
  let l = await amostrar(p, 3600, 100); // um ciclo inteiro da respiração
  const tr = l.map((e) => e.tronco);
  ok(Math.max(...tr) - Math.min(...tr) > 0.012 && Math.max(...tr.map(Math.abs)) < 0.05 && amplitude(l, 'membros', 2) < 0.05,
    `parado: respira (tronco ${f2(Math.min(...tr))}..${f2(Math.max(...tr))}), pernas paradas`);
  await p.screenshot({ path: D('01-parado') });
  // só para os prints: câmera de lado (vê melhor pernas, joelhos e inclinação). window.__lado = 'eu' ou um amigo
  await p.evaluate(() => {
    const J = window.__jogo, v = J.visao, orig = v.quadro.bind(v);
    v.quadro = (...a) => {
      const r = orig(...a), alvo = window.__lado;
      const g = alvo === 'eu' ? v.boneco && v.boneco.grupo : alvo && alvo.grupo;
      if (r && g) {
        const yaw = g.rotation.y, c = J.camera;
        c.position.set(g.position.x + Math.cos(yaw) * 5, g.position.y + 2, g.position.z - Math.sin(yaw) * 5);
        c.lookAt(g.position.x, g.position.y + 0.8, g.position.z);
      }
      return r;
    };
    window.__lado = 'eu';
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: D('01-parado-lado') });

  // andando (de costas para a câmera "de frente": W anda para a câmera, que vai junto)
  await p.keyboard.down('KeyW'); await p.waitForTimeout(500);
  const and = await amostrar(p, 1500);
  await p.screenshot({ path: D('02-andando') });
  await p.keyboard.up('KeyW');
  const vAnda = velocidade(and), ampAnda = amplitude(and, 'membros', 2), faseAnda = (and.at(-1).fase - and[0].fase) / (and.at(-1).t - and[0].t);
  ok(vAnda > 0.8 && ampAnda > 0.35, `andando: ${f2(vAnda)} blocos/s, coxa até ${f2(ampAnda)} rad, passo ${f2(faseAnda)} rad/s`);
  ok(Math.max(...and.map((e) => Math.max(...e.canelas))) > 0.2, 'andando: joelho dobra na perna que vai para a frente');
  await voltar(p); await p.waitForTimeout(600);

  // correndo: Shift + W
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await p.waitForTimeout(600);
  const cor = await amostrar(p, 1500);
  await p.screenshot({ path: D('03-correndo') });
  await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
  const vCorre = velocidade(cor), ampCorre = amplitude(cor, 'membros', 2), faseCorre = (cor.at(-1).fase - cor[0].fase) / (cor.at(-1).t - cor[0].t);
  const meio = cor[Math.floor(cor.length / 2)];
  ok(velFisica(cor) > velFisica(and) * 1.25, `correndo mais rápido: ${f2(velFisica(cor))} x ${f2(velFisica(and))} blocos/s na física (na tela: ${f2(vCorre)} x ${f2(vAnda)})`);
  ok(ampCorre > ampAnda + 0.15 && meio.tronco > 0.2 && Math.min(...meio.antebracos) < -1, `correndo: passada maior (${f2(ampCorre)}), corpo inclinado (${meio.tronco}), braços dobrados (${meio.antebracos})`);
  ok(meio.correndo && meio.estado.correr && !meio.estado.descer, `correndo: flag de correr ligada e Shift não vira "descer" no chão (${JSON.stringify(meio.estado)})`);
  // pé não patina: passo (rad/s) / velocidade quase igual andando e correndo, ajustado pela amplitude
  const k1 = faseAnda * amplitude(and, 'membros', 2) / vAnda, k2 = faseCorre * ampCorre / vCorre;
  ok(Math.abs(k1 - k2) / k1 < 0.25, `passo ligado à velocidade real (fase*amp/vel: ${f2(k1)} andando, ${f2(k2)} correndo)`);
  await voltar(p); await p.waitForTimeout(800);

  // agachado: segurar Z
  await p.keyboard.down('KeyZ'); await p.waitForTimeout(700);
  let ag = await ler(p);
  await p.screenshot({ path: D('04-agachado') });
  ok(ag.agachado && ag.quadril < -0.35 && Math.min(...ag.canelas) > 1 && ag.tronco > 0.25, `agachado: quadril ${ag.quadril}, joelhos ${ag.canelas}, tronco ${ag.tronco}`);
  ok(ag.estado.agachar, 'Z liga "agachar" nas entradas');
  await p.keyboard.down('KeyW'); await p.waitForTimeout(500);
  const agAnda = await amostrar(p, 900);
  await p.screenshot({ path: D('05-agachado-andando') });
  await p.keyboard.up('KeyW'); await p.keyboard.up('KeyZ');
  ok(amplitude(agAnda, 'membros', 2) > 0.3 && agAnda.every((e) => e.quadril < -0.3), `andando agachado: pernas mexem e quadril continua baixo (${agAnda.at(-1).quadril})`);
  await p.waitForTimeout(600);
  ag = await ler(p);
  ok(!ag.agachado && ag.quadril > -0.2, `soltou Z: levanta (quadril ${ag.quadril})`);
  await voltar(p); await p.waitForTimeout(500);

  // pulo: impulso (agacha) e braços para cima no ar
  await p.keyboard.down('Space');
  let imp = null, ar = null;
  for (let i = 0; i < 20 && !ar; i++) {
    const e = await ler(p);
    if (!e.noChao && e.vy > 0 && e.quadril < -0.25 && !imp) imp = e;
    if (!e.noChao && e.vy > 2 && e.membros[0] < -1.8) { ar = e; await p.screenshot({ path: D('06-pulando') }); }
    await p.waitForTimeout(25);
  }
  await p.keyboard.up('Space');
  ok(!!ar, `pulando: braços para cima (${ar && ar.membros})`);
  ok(!!imp, `pulo com impulso: quadril desce ao sair do chão (${imp && imp.quadril})`);
  await p.waitForTimeout(1200);

  // aterrissagem: cai de 7 blocos e amortece (conferido quadro a quadro dentro da página)
  const vigia = p.evaluate(() => new Promise((ok) => {
    const J = window.__jogo, bo = J.visao.boneco, t0 = performance.now();
    let menor = { quadril: 0 };
    const q = () => {
      if (J.jog.noChao && bo.anim.pouso < bo.anim.pousoT && bo.quadril.position.y < menor.quadril)
        menor = { quadril: +bo.quadril.position.y.toFixed(3), canelas: bo.canelas.map((c) => +c.rotation.x.toFixed(2)) };
      if (performance.now() - t0 < 4000) requestAnimationFrame(q); else ok(menor);
    };
    requestAnimationFrame(q);
  }));
  await p.evaluate(() => { window.__jogo.jog.pos.y += 7; });
  let pouso = null;
  for (let i = 0; i < 80 && !pouso; i++) {
    const e = await ler(p);
    if (e.noChao && e.pousoAtivo) { pouso = e; await p.screenshot({ path: D('07-aterrissando') }); }
    await p.waitForTimeout(15);
  }
  const pv = await vigia;
  ok(pv.quadril < -0.3, `aterrissando: amortece (quadril ${pv.quadril}, joelhos ${pv.canelas})${pouso ? '' : ' (o print pode ter perdido o quadro)'}`);
  await p.waitForTimeout(600);
  ag = await ler(p);
  ok(ag.quadril > -0.2, 'depois do pouso volta a ficar em pé');

  // queda longa: braços abertos
  await p.evaluate(() => { window.__jogo.jog.pos.y += 40; });
  let q = null;
  for (let i = 0; i < 40 && !q; i++) {
    const e = await ler(p);
    if (!e.noChao && e.queda > 0.7) { q = e; await p.screenshot({ path: D('08-caindo') }); }
    await p.waitForTimeout(60);
  }
  ok(q && q.membrosZ[0] < -1.2 && q.membrosZ[1] > 1.2, `caindo de alto: braços abertos (${q && q.membrosZ})`);
  await p.waitForTimeout(2500);
  await voltar(p); await p.waitForTimeout(500);

  // cabeça segue a câmera: olhar para cima e virar um pouco não gira o corpo; virar muito, o corpo acompanha
  await p.evaluate(() => { window.__jogo.jog.pitch = 0.8; window.__jogo.jog.yaw = 0.6; });
  await p.waitForTimeout(700);
  let c = await ler(p);
  ok(c.cabX < -0.4 && Math.abs(c.cabY - 0.6) < 0.15 && Math.abs(c.yawCorpo) < 0.15, `cabeça olha para cima (${c.cabX}) e para o lado (${c.cabY}) sem girar o corpo (${f2(c.yawCorpo)})`);
  await p.screenshot({ path: D('09-cabeca') });
  await p.evaluate(() => { window.__jogo.jog.pitch = 0; window.__jogo.jog.yaw = 1.8; });
  await p.waitForTimeout(1500);
  c = await ler(p);
  ok(Math.abs(c.yawCorpo - 1.8) < 0.3, `virou muito: o corpo acompanha (${f2(c.yawCorpo)})`);
  await voltar(p); await p.waitForTimeout(400);

  // nadando: piscina de água funda
  await p.evaluate(() => {
    const J = window.__jogo, m = J.mundo, [x0, y0, z0] = window.__base;
    for (let x = 6; x <= 18; x++) for (let z = -18; z <= -6; z++) for (let y = -6; y <= -1; y++) {
      const borda = x === 6 || x === 18 || z === -18 || z === -6 || y === -6;
      m.definir(x0 + x, y0 + y, z0 + z, borda ? 3 : 5);
    }
    const j = J.jog; j.pos.x = x0 + 12.5; j.pos.z = z0 - 7.5; j.pos.y = y0 - 2.5; j.yaw = 0; j.pitch = 0;
  });
  await p.waitForTimeout(1600);
  let n = await ler(p);
  await p.screenshot({ path: D('10-boiando') });
  ok(n.naAgua && n.raiz < 0.4, `na água parado: boiando em pé (corpo ${n.raiz}, na água ${n.naAgua})`);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(1300);
  const nad = await amostrar(p, 600);
  await p.screenshot({ path: D('11-nadando') });
  await p.keyboard.up('KeyW');
  n = nad.at(-1);
  ok(nad.some((e) => e.raiz > 1) && amplitude(nad, 'membros', 0) > 1.5, `nadando para a frente: corpo deitado (${n.raiz}) e braçadas (${n.membros})`);
  // Shift na água desce (não corre)
  await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(200);
  n = await ler(p);
  await p.keyboard.up('ShiftLeft');
  ok(n.estado.descer && !n.estado.correr, 'Shift na água: desce');
  await voltar(p); await p.waitForTimeout(500);

  // voando: F, anda com W
  await p.keyboard.press('KeyF'); await p.waitForTimeout(300);
  await p.keyboard.down('Space'); await p.waitForTimeout(500); await p.keyboard.up('Space');
  await p.keyboard.down('KeyW'); await p.waitForTimeout(800);
  const v = await ler(p);
  await p.screenshot({ path: D('12-voando') });
  await p.keyboard.up('KeyW');
  ok(v.voando && v.membrosZ[0] < -1 && v.membrosZ[1] > 1, `voando: braços abertos (${v.membrosZ})`);
  ok(await p.evaluate(() => document.querySelector('#bt-agachar').hidden), 'voando: botão de agachar some');
  await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(200);
  const vs = await ler(p);
  await p.keyboard.up('ShiftLeft');
  ok(vs.voando && vs.estado.descer && !vs.estado.correr, `Shift voando: desce (não corre) ${vs.voando} ${JSON.stringify(vs.estado)}`);
  await p.keyboard.press('KeyF'); await p.waitForTimeout(1500);
  await voltar(p); await p.waitForTimeout(500);

  // flags para a rede (16 correndo, 32 agachado)
  const flags = await p.evaluate(() => [window.__jogo.visao.correndo, window.__jogo.visao.agachado]);
  ok(!flags[0] && !flags[1], 'parado: sem flags de correr/agachar');

  // 1ª pessoa: olhos descem ao agachar; balanço leve andando; parado fica nos 1.55
  await p.evaluate(() => { window.__lado = null; });
  await p.keyboard.press('KeyR');
  await p.waitForTimeout(600);
  let o = await ler(p);
  ok(Math.abs(o.camY - 1.55) < 0.01, `1ª pessoa parado: olhos em ${f2(o.camY)}`);
  await p.keyboard.down('KeyZ'); await p.waitForTimeout(700);
  o = await ler(p);
  await p.screenshot({ path: D('13-olhos-agachado') });
  await p.keyboard.up('KeyZ');
  ok(o.camY < 1.32 && o.camY > 1.15, `1ª pessoa agachado: olhos descem para ${f2(o.camY)}`);
  await p.waitForTimeout(700);
  await p.keyboard.down('KeyW'); await p.waitForTimeout(400);
  const bob = (await amostrar(p, 1200, 40)).map((e) => e.camY);
  await p.keyboard.up('KeyW');
  const bobA = Math.max(...bob) - Math.min(...bob);
  ok(bobA > 0.01 && bobA < 0.08, `1ª pessoa andando: cabeça balança de leve (${f2(bobA)} bloco)`);
  await p.waitForTimeout(1000);
  o = await ler(p);
  ok(Math.abs(o.camY - 1.55) < 0.01, `parou: balanço some (${f2(o.camY)})`);

  // amigo simulado (mensagens 'pos' como as da sala): anda, corre, agacha e pula
  const amigo = await p.evaluate(async () => {
    const J = window.__jogo, [x0, y0, z0] = window.__base, espera = (ms) => new Promise((r) => setTimeout(r, ms));
    J.jog.yaw = Math.PI; J.jog.pos.z = z0 - 4.5; // olhando para o amigo (para o sul)
    J.amigo.entrou({ id: 'x1', nome: 'Amigo', cor: 2, p: [x0 + 0.5, y0, z0 + 2.5], r: [0, 0] });
    let o = J.outrosLista.find((x) => x.nome === 'Amigo'), oId = 'x1';
    window.__amigo = o;
    const res = {};
    async function trecho(nome, vel, a, ms, dir = 1) {
      let z = o.alvo.z, y = o.alvo.y; const amps = [], quad = [], fases = [o.anim ? o.anim.fase : 0];
      for (let t = 0; t < ms; t += 125) {
        z -= dir * vel * 0.125;
        J.amigo.pos({ id: oId, p: [x0 + 0.5, y, z], r: [dir > 0 ? 0 : Math.PI, 0], a });
        await espera(125);
        amps.push(Math.abs(o.membros[2].rotation.x)); quad.push(o.quadril.position.y);
      }
      fases.push(o.anim.fase);
      res[nome] = { amp: Math.max(...amps), quadril: Math.min(...quad), tronco: o.tronco.rotation.x, fase: (fases[1] - fases[0]) / (ms / 1000), antebraco: o.antebracos[0].rotation.x };
    }
    await trecho('parado', 0, 0, 750);
    await trecho('andando', 4.4, 0, 1500, -1);
    await trecho('correndo', 6.4, 16, 1500, 1);
    await trecho('agachado', 1.3, 32, 1500, -1);
    // outro amigo, de versão antiga (nunca manda as flags novas) correndo: deduz pela velocidade
    J.amigo.entrou({ id: 'x2', nome: 'Velho', cor: 4, p: [x0 + 2.5, y0, z0 + 2.5], r: [0, 0] });
    o = J.outrosLista.find((x) => x.nome === 'Velho'); oId = 'x2';
    await trecho('antigo', 6.4, 0, 1200, 1);
    return res;
  });
  console.log('amigo:', JSON.stringify(amigo));
  ok(amigo.parado.amp < 0.1, 'amigo parado: pernas paradas');
  ok(amigo.andando.amp > 0.35 && amigo.andando.fase > 3, `amigo andando: passos pela velocidade das posições (coxa ${f2(amigo.andando.amp)}, ${f2(amigo.andando.fase)} rad/s)`);
  ok(amigo.correndo.amp > amigo.andando.amp + 0.1 && amigo.correndo.tronco > 0.2, `amigo correndo (flag 16): passada ${f2(amigo.correndo.amp)} e corpo inclinado ${f2(amigo.correndo.tronco)}`);
  ok(amigo.agachado.quadril < -0.35, `amigo agachado (flag 32): quadril ${f2(amigo.agachado.quadril)}`);
  ok(amigo.antigo.tronco > 0.2, 'amigo de versão antiga correndo: deduz pela velocidade');
  // prints do amigo (de lado): correndo e andando agachado, com as mensagens chegando
  const amigoAnda = (vel, a) => p.evaluate(([vel, a]) => {
    const J = window.__jogo, o = window.__amigo, [x0, y0, z0] = window.__base;
    window.__lado = o; clearInterval(window.__corrida);
    let z = z0 + 6;
    window.__corrida = setInterval(() => { z -= vel * 0.125; J.amigo.pos({ id: 'x1', p: [x0 + 0.5, y0, z], r: [0, 0], a }); }, 125);
  }, [vel, a]);
  await amigoAnda(6.4, 16); await p.waitForTimeout(1100);
  await p.screenshot({ path: D('14-amigo-correndo') });
  await amigoAnda(1.3, 32); await p.waitForTimeout(1100);
  await p.screenshot({ path: D('15-amigo-agachado') });
  await amigoAnda(4.4, 0); await p.waitForTimeout(1100);
  await p.screenshot({ path: D('16-amigo-andando') });
  await p.evaluate(() => { clearInterval(window.__corrida); window.__lado = null; });
  await p.close();
}

// ================= tablet: toque duplo no joystick e botão de agachar =================
{
  const { p, ctx } = await abrir({ ...devices['Galaxy Tab S4 landscape'] }, 'tablet');
  const vp = p.viewportSize();
  const cdp = await ctx.newCDPSession(p);
  const toque = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const x0 = vp.width * 0.2, y0 = vp.height * 0.6;
  await p.tap('#bt-visao'); await p.tap('#bt-visao'); // de frente
  await p.waitForTimeout(600);
  ok(await p.isVisible('#bt-agachar'), 'tablet: botão de agachar aparece');
  // andar normal com o joystick (sem chegar na borda)
  const andar = async (duplo) => {
    if (duplo) { await toque('touchStart', [{ x: x0, y: y0, id: 1 }]); await p.waitForTimeout(60); await toque('touchEnd', []); await p.waitForTimeout(90); }
    await toque('touchStart', [{ x: x0, y: y0, id: 2 }]);
    await toque('touchMove', [{ x: x0, y: y0 - 40, id: 2 }]);
    await p.waitForTimeout(500);
    const l = await amostrar(p, 1200);
    if (duplo) await p.screenshot({ path: `${SAIDA}/17-tablet-correndo.png` });
    await toque('touchEnd', []);
    return l;
  };
  const la = await andar(false);
  await voltar(p); await p.waitForTimeout(600);
  const lc = await andar(true);
  const va = velocidade(la), vc = velocidade(lc);
  ok(!la.at(-1).estado.correr && lc.at(-1).estado.correr && velFisica(lc) > velFisica(la) * 1.25, `tablet: toque duplo no joystick corre (${f2(velFisica(lc))} x ${f2(velFisica(la))} blocos/s na física; na tela ${f2(vc)} x ${f2(va)})`);
  ok(await p.evaluate(() => !document.querySelector('#joy').classList.contains('correndo')), 'tablet: soltou o joystick, para de correr');
  await voltar(p); await p.waitForTimeout(500);
  await p.tap('#bt-agachar'); await p.waitForTimeout(700);
  let e = await ler(p);
  await p.screenshot({ path: `${SAIDA}/18-tablet-agachado.png` });
  ok(e.estado.agachar && e.agachado && e.quadril < -0.35, `tablet: botão de agachar liga (quadril ${e.quadril})`);
  ok(await p.evaluate(() => document.querySelector('#bt-agachar').classList.contains('ligado')), 'tablet: botão fica marcado');
  await p.tap('#bt-agachar'); await p.waitForTimeout(700);
  e = await ler(p);
  ok(!e.estado.agachar && e.quadril > -0.2, 'tablet: outro toque desliga');
  await p.tap('#bt-voar'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.querySelector('#bt-agachar').hidden), 'tablet: voando, o botão de agachar some');
  await p.tap('#bt-voar'); await p.waitForTimeout(300);
  ok(await p.evaluate(() => !document.querySelector('#bt-agachar').hidden), 'tablet: parou de voar, o botão volta');
  await p.close();
}

console.log('erros:', erros.length ? erros : 'nenhum');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

// Opções "Armas" e "Construção": tiro, recarga, troca, itens do chão, alvos, queda, renascimento,
// botões de toque no tablet e o multijogador (acerto entre 2 jogadores, item pego some para os dois,
// servidor recusando bloco num mundo sem construção).
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const sfx = Date.now() % 10000;
async function pagina(nome, toque = false) {
  const ctx = await b.newContext(toque ? { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Failed to load resource/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  return p;
}
const esperar = (p, ms) => p.waitForTimeout(ms);
// plataforma de pedra (só na tela de quem chama, sem mandar para a rede) e põe o jogador em cima
const plataforma = (p, x0, z0, y) => p.evaluate(([x0, z0, y]) => {
  const m = window.__jogo.mundo;
  for (let x = x0 - 2; x <= x0 + 14; x++) for (let z = z0 - 3; z <= z0 + 3; z++) { m.definir(x, y, z, 3, true); for (let k = 1; k <= 4; k++) m.definir(x, y + k, z, 0, true); }
}, [x0, z0, y]);
// vira a câmera para um ponto
const olharPara = (p, alvo) => p.evaluate((a) => {
  const { jog } = window.__jogo;
  const dx = a[0] - jog.pos.x, dy = a[1] - (jog.pos.y + 1.6), dz = a[2] - jog.pos.z;
  jog.yaw = Math.atan2(-dx, -dz); jog.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}, alvo);
const disparar = async (p, vezes = 1, espera = 360) => { for (let i = 0; i < vezes; i++) { await p.evaluate(() => window.__jogo.armas.gatilho(true)); await esperar(p, 60); await p.evaluate(() => window.__jogo.armas.gatilho(false)); await esperar(p, espera); } };

// ================= 1) sozinho, computador: armas ligadas, construção desligada =================
{
  const p = await pagina('PC');
  await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
  conferir(await p.getAttribute('[data-opcao=armas]', 'aria-pressed') === 'false', 'Armas vem desligada ao criar');
  conferir(await p.getAttribute('[data-opcao=construcao]', 'aria-pressed') === 'true', 'Construção vem ligada ao criar');
  await p.click('[data-opcao=armas]');
  await p.click('[data-opcao=construcao]');
  await p.screenshot({ path: SAIDA + '/armas-opcoes.png' });
  await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog && !window.__jogo.pausado);
  await esperar(p, 2500);
  const ini = await p.evaluate(() => { const j = window.__jogo; return { armas: j.opcoesMundo.armas, constr: j.opcoesMundo.construcao, slot: j.armas.slots[0] && j.armas.slots[0].a, emp: j.armas.empunhando, pente: j.armas.slots[0].pente, barra: document.querySelector('#barra').hidden, hud: document.querySelector('#armas-hud').hidden, vida: document.querySelector('#vida').hidden, voar: document.querySelector('#bt-voar').hidden }; });
  console.log(JSON.stringify(ini));
  conferir(ini.armas === true && ini.constr === false, 'opções guardadas: armas sim, construção não');
  conferir(ini.slot === 'pistola' && ini.emp && ini.pente === 12, 'começa com a pistola na mão (12 tiros)');
  conferir(ini.barra && !ini.hud && !ini.vida, 'sem barra de blocos; munição e corações aparecem');
  // não constrói: nem com a arma, nem de mãos livres
  await plataforma(p, 0, 0, 70);
  await p.evaluate(() => { const { jog } = window.__jogo; Object.assign(jog.pos, { x: 0.5, y: 71, z: 0.5 }); jog.vel.y = 0; jog.yaw = Math.PI / 2; jog.pitch = -1.2; });
  await esperar(p, 400);
  const blocoAntes = await p.evaluate(() => { const m = window.__jogo.mundo; return [m.bloco(-1, 70, 0), m.bloco(-2, 70, 0), m.bloco(-1, 71, 0)]; });
  await p.evaluate(() => { const j = window.__jogo; j.armas.escolher(-1); for (let i = 0; i < 12; i++) j.quebrar(null); j.usar(null); j.armas.escolher(0); });
  await esperar(p, 400);
  const blocoDepois = await p.evaluate(() => { const m = window.__jogo.mundo; return [m.bloco(-1, 70, 0), m.bloco(-2, 70, 0), m.bloco(-1, 71, 0)]; });
  conferir(JSON.stringify(blocoAntes) === JSON.stringify(blocoDepois), 'sem construção: quebrar e colocar não mudam nada ' + JSON.stringify(blocoDepois));
  await p.keyboard.press('KeyE');
  conferir(await p.isHidden('#inventario'), 'tecla E não abre blocos sem construção');
  await p.keyboard.press('KeyF');
  conferir(await p.evaluate(() => !window.__jogo.jog.voando), 'com armas não voa');

  // atirar num alvo de treino
  await p.evaluate(() => { const j = window.__jogo; j.armas.alvos.clear(); j.armas.montarAlvo('t', 9, 0, true, 71); j.jog.pitch = 0; });
  const alvo = await p.evaluate(() => { const a = window.__jogo.armas.alvos.get('t'); return [a.x, a.y + 1.5, a.z]; });
  await olharPara(p, alvo);
  await p.evaluate(() => window.__jogo.armas.mirar(true));
  await esperar(p, 300);
  conferir(await p.evaluate(() => window.__jogo.camera.fov < (window.__jogo.ajustes.fov || 72) - 5), 'mirar aproxima a câmera (zoom)');
  await disparar(p, 1);
  const tiro = await p.evaluate(() => ({ pente: window.__jogo.armas.slots[0].pente, caido: window.__jogo.armas.alvos.get('t').caido }));
  conferir(tiro.pente === 11, 'tiro gasta 1 bala (11 no pente)');
  conferir(tiro.caido === true, 'acertou o alvo de treino e ele caiu');
  await p.screenshot({ path: SAIDA + '/armas-pc-tiro.png' });
  await p.evaluate(() => window.__jogo.armas.mirar(false));
  // recarregar com R
  await p.keyboard.press('KeyR');
  await esperar(p, 1500);
  const rec = await p.evaluate(() => ({ pente: window.__jogo.armas.slots[0].pente, res: window.__jogo.armas.reserva.leve }));
  conferir(rec.pente === 12 && rec.res === 23, 'R recarrega: 12 no pente, 23 de reserva');
  // esvazia tudo: sem munição não atira
  await p.evaluate(() => { const a = window.__jogo.armas; a.slots[0].pente = 1; a.reserva.leve = 0; a.desenhar(); });
  await disparar(p, 3, 340);
  conferir(await p.evaluate(() => window.__jogo.armas.slots[0].pente === 0), 'sem munição a pistola para de atirar');

  // itens do chão: anda por cima e pega
  const item = await p.evaluate(() => {
    const a = window.__jogo.armas, jog = window.__jogo.jog;
    // procura um item já montado; se não houver perto, anda até achar
    for (let i = 0; i < 40 && !a.itens.size; i++) { jog.pos.x += 16; a.atualizarItens(jog); }
    const it = [...a.itens.values()].find((x) => x.y != null && !x.ruim);
    return it ? { k: it.k, tipo: it.tipo, a: it.a, m: it.m, x: it.x, y: it.y, z: it.z } : null;
  });
  conferir(!!item, 'tem armas/munição espalhadas pelo mapa ' + JSON.stringify(item));
  if (item) {
    await p.evaluate((it) => { const { jog, armas, vida } = window.__jogo; vida.atual = 6; vida.desenhar(); armas.reserva.leve = 0; Object.assign(jog.pos, { x: it.x + 0.5, y: it.y + 0.2, z: it.z + 0.5 }); jog.vel.y = 0; }, item);
    await esperar(p, 700);
    const depois = await p.evaluate((k) => { const a = window.__jogo.armas; return { pego: a.pegos.has(k), slots: a.slots.map((s) => s && s.a), res: { ...a.reserva }, vida: window.__jogo.vida.atual }; }, item.k);
    console.log(JSON.stringify(depois));
    conferir(depois.pego && (item.tipo !== 'arma' || depois.slots.includes(item.a)) && (item.tipo !== 'municao' || depois.res[item.m] > 0) && (item.tipo !== 'cura' || depois.vida > 6), `pegou o item (${item.tipo}) andando por cima`);
  }
  // pega uma arma de propósito e troca com Q
  await p.evaluate(() => { const a = window.__jogo.armas; a.receber({ tipo: 'arma', a: 'fuzil' }); });
  const comFuzil = await p.evaluate(() => ({ slots: window.__jogo.armas.slots.map((s) => s && s.a), sel: window.__jogo.armas.sel }));
  conferir(comFuzil.slots.includes('fuzil') && comFuzil.slots[comFuzil.sel] === 'fuzil', 'pegou o fuzil e já está com ele na mão');
  await p.keyboard.press('KeyQ'); await esperar(p, 100);
  const s1 = await p.evaluate(() => window.__jogo.armas.sel);
  await p.keyboard.press('KeyQ'); await esperar(p, 100);
  const s2 = await p.evaluate(() => window.__jogo.armas.sel);
  conferir(s1 !== comFuzil.sel && s2 !== s1, `Q troca de arma (${comFuzil.sel} -> ${s1} -> ${s2})`);
  // fuzil automático: segurando atira várias
  await p.evaluate(() => { const a = window.__jogo.armas; a.escolher(a.slots.findIndex((s) => s && s.a === 'fuzil')); a.slots[a.sel].pente = 25; });
  await esperar(p, 300);
  await p.evaluate(() => window.__jogo.armas.gatilho(true)); await esperar(p, 1600); await p.evaluate(() => window.__jogo.armas.gatilho(false));
  const auto = await p.evaluate(() => window.__jogo.armas.atual.pente);
  conferir(auto <= 21, 'fuzil automático: segurando o gatilho atira várias vezes (' + (25 - auto) + ' tiros)');
  await p.screenshot({ path: SAIDA + '/armas-pc-fuzil.png' });

  // queda alta machuca
  await p.evaluate(() => { const { jog, vida } = window.__jogo; vida.reiniciar(); Object.assign(jog.pos, { x: 4.5, y: 86, z: 0.5 }); jog.vel.y = 0; jog.noChao = false; });
  await esperar(p, 500);
  await p.waitForFunction(() => window.__jogo.jog.noChao && window.__jogo.jog.pos.y < 75, null, { timeout: 15000 });
  await esperar(p, 300);
  const vq = await p.evaluate(() => window.__jogo.vida.atual);
  conferir(vq < 10 && vq > 0, 'cair de 15 blocos tira corações (' + vq + '/10)');
  // ficar sem corações: cai e volta com a pistola
  await p.evaluate(() => { window.__jogo.vida.protegido = 0; window.__jogo.vida.dano(10); });
  await esperar(p, 2000);
  const volta = await p.evaluate(() => ({ vida: window.__jogo.vida.atual, slots: window.__jogo.armas.slots.map((s) => s && s.a), feed: document.querySelector('#feed').textContent }));
  conferir(volta.vida === 10 && volta.slots[0] === 'pistola' && !volta.slots[1], 'caiu e voltou com vida cheia e a pistola ' + JSON.stringify(volta));
  await p.close();
}

// ================= 2) tablet: botões de toque, armas + construção ligadas =================
{
  const p = await pagina('Tablet', true);
  await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
  await p.click('[data-opcao=armas]');
  // modo criativo (blocos à vontade) para testar colocar bloco de mãos livres
  if (await p.getAttribute('[data-opcao=sobrevivencia]', 'aria-pressed') === 'true') await p.click('[data-opcao=sobrevivencia]');
  await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog && !window.__jogo.pausado);
  await esperar(p, 2500);
  conferir(await p.isVisible('#bt-atirar') && await p.isVisible('#bt-mirar') && await p.isVisible('#bt-recarregar') && await p.isVisible('#bt-trocar'), 'tablet: botões atirar, mirar, recarregar e trocar');
  conferir(await p.isVisible('#barra') && await p.isVisible('#mira'), 'tablet: barra de blocos (construção ligada) e a mira no meio');
  await plataforma(p, 0, 0, 70);
  await p.evaluate(() => { const { jog } = window.__jogo; Object.assign(jog.pos, { x: 0.5, y: 71, z: 0.5 }); jog.vel.y = 0; jog.yaw = -Math.PI / 2; jog.pitch = 0; window.__jogo.armas.alvos.clear(); window.__jogo.armas.montarAlvo('t', 8, 0, true, 71); });
  const alvo = await p.evaluate(() => { const a = window.__jogo.armas.alvos.get('t'); return [a.x, a.y + 1.5, a.z]; });
  await olharPara(p, alvo);
  await esperar(p, 300);
  await p.tap('#bt-atirar');
  await esperar(p, 400);
  const t1 = await p.evaluate(() => ({ pente: window.__jogo.armas.slots[0].pente, caido: window.__jogo.armas.alvos.get('t').caido }));
  conferir(t1.pente === 11, 'tablet: tocar no botão atira');
  conferir(t1.caido, 'tablet: tiro pelo botão derruba o alvo do meio da tela');
  await p.tap('#bt-mirar'); await esperar(p, 300);
  conferir(await p.evaluate(() => window.__jogo.armas.mirando), 'tablet: botão mirar liga a mira');
  await p.screenshot({ path: SAIDA + '/armas-tablet.png' });
  await p.tap('#bt-mirar');
  await p.tap('#bt-recarregar'); await esperar(p, 1500);
  conferir(await p.evaluate(() => window.__jogo.armas.slots[0].pente === 12), 'tablet: botão recarregar');
  // troca para as mãos e coloca um bloco tocando na tela (construção ligada)
  await p.tap('#bt-trocar'); await esperar(p, 200);
  conferir(await p.evaluate(() => !window.__jogo.armas.empunhando), 'tablet: botão trocar guarda a arma (mãos livres)');
  await p.evaluate(() => { const { jog } = window.__jogo; jog.pitch = -1.0; });
  await esperar(p, 200);
  const antes = await p.evaluate(() => window.__jogo.mundo.listarEdicoes().length);
  await p.touchscreen.tap(590, 410);
  await esperar(p, 500);
  const depois = await p.evaluate(() => window.__jogo.mundo.listarEdicoes().length);
  conferir(depois > antes, 'tablet: de mãos livres, tocar na tela coloca bloco');
  await p.screenshot({ path: SAIDA + '/armas-tablet-maos.png' });
  await p.close();
}

// ================= 3) online com 2 jogadores =================
async function jogador(nome) {
  const p = await pagina(nome);
  await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123'); if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok'); await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])');
  return p;
}
{
  const a = await jogador('Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Batalha');
  await a.click('[data-opcao=armas]'); await a.click('[data-opcao=construcao]');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
  const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
  const bb = await jogador('Beto' + sfx);
  await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
  await esperar(a, 1500);
  conferir(await bb.evaluate(() => window.__jogo.opcoesMundo.armas === true && window.__jogo.opcoesMundo.construcao === false), 'Beto entrou num mundo com armas e sem construção');
  // os dois numa plataforma, frente a frente, 8 blocos de distância
  for (const p of [a, bb]) await plataforma(p, 60, 60, 70);
  await a.evaluate(() => { const { jog } = window.__jogo; Object.assign(jog.pos, { x: 60.5, y: 71, z: 60.5 }); jog.vel.y = 0; });
  await bb.evaluate(() => { const { jog } = window.__jogo; Object.assign(jog.pos, { x: 68.5, y: 71, z: 60.5 }); jog.vel.y = 0; jog.yaw = Math.PI / 2; });
  await esperar(a, 1500);
  conferir(await a.evaluate(() => { const [o] = [...window.__jogo.armas.o.outros().values()]; return !!o.arma && o.arma.userData.a === 'pistola'; }), 'Ana vê a pistola na mão do Beto');
  // servidor recusa bloco num mundo sem construção
  await a.evaluate(() => window.__jogo.sala.enviar({ t: 'bloco', x: 62, y: 71, z: 60, b: 3, j: 1 }));
  await esperar(a, 800);
  conferir(await bb.evaluate(() => window.__jogo.mundo.bloco(62, 71, 60)) === 0, 'servidor não deixa colocar bloco num mundo sem construção');
  // Ana atira no Beto até ele cair
  const vidaAntes = await bb.evaluate(() => window.__jogo.vida.atual);
  let caiu = false, vidaMeio = null;
  for (let i = 0; i < 9 && !caiu; i++) {
    const alvo = await a.evaluate(() => { const [o] = [...window.__jogo.armas.o.outros().values()]; const g = o.grupo.position; return [g.x, g.y + 1.0, g.z]; });
    await olharPara(a, alvo);
    await disparar(a, 1, 420);
    const v = await bb.evaluate(() => window.__jogo.vida.atual);
    if (i === 0) vidaMeio = v;
    caiu = await a.evaluate(() => window.__jogo.armas.derrubadas > 0);
  }
  conferir(vidaMeio < vidaAntes, `acerto chega no Beto e tira vida (${vidaAntes} -> ${vidaMeio})`);
  await esperar(a, 600);
  conferir(caiu, 'Beto caiu e a Ana ganhou a derrubada');
  const feedB = await bb.evaluate(() => document.querySelector('#feed').textContent);
  conferir(/derrubou/.test(feedB), 'notícia de quem derrubou aparece para o Beto: ' + feedB);
  await a.screenshot({ path: SAIDA + '/armas-online-ana.png' });
  await esperar(bb, 1500);
  conferir(await bb.evaluate(() => window.__jogo.vida.atual === 10 && window.__jogo.armas.slots[0].a === 'pistola'), 'Beto voltou com vida cheia');
  await bb.screenshot({ path: SAIDA + '/armas-online-beto.png' });
  // item pego some para os dois
  let it = null;
  for (let i = 0; i < 30 && !it; i++) {
    it = await a.evaluate(() => {
      const ar = window.__jogo.armas, jog = window.__jogo.jog;
      ar.atualizarItens(jog); const x = [...ar.itens.values()].find((v) => v.y != null && !v.ruim);
      if (x) return { k: x.k, x: x.x, y: x.y, z: x.z };
      jog.pos.x -= 16; jog.pos.y = 90; jog.vel.y = 0; return null;
    });
    if (!it) await esperar(a, 700);
  }
  if (it) {
    await bb.evaluate((it) => { const { jog, armas } = window.__jogo; Object.assign(jog.pos, { x: it.x + 3.5, y: it.y + 3, z: it.z + 0.5 }); armas.atualizarItens(jog); }, it);
    await a.evaluate((it) => { const { jog, armas, vida } = window.__jogo; vida.atual = 4; armas.reserva = { leve: 0, media: 0, cartucho: 0, pesada: 0 }; armas.slots[1] = null; Object.assign(jog.pos, { x: it.x + 0.5, y: it.y + 0.2, z: it.z + 0.5 }); jog.vel.y = 0; }, it);
    await esperar(a, 1500);
    const r = await bb.evaluate((k) => ({ pego: window.__jogo.armas.pegos.has(k), visivel: window.__jogo.armas.itens.has(k) }), it.k);
    conferir(await a.evaluate((k) => window.__jogo.armas.pegos.has(k), it.k), 'Ana pegou o item (servidor confirmou)');
    conferir(r.pego && !r.visivel, 'o item sumiu também para o Beto');
  } else conferir(false, 'achou item no mapa online');
  // quem entra depois sabe o que já foi pego
  await bb.evaluate(() => window.__jogo.sala.fechar());
  await bb.reload(); await bb.waitForSelector('#m-mundos:not([hidden])');
  await bb.click('#lista-mundos .mundo');
  await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
  await esperar(bb, 1500);
  if (it) conferir(await bb.evaluate((k) => window.__jogo.armas.pegos.has(k), it.k), 'Beto voltou e o servidor contou o que já foi pego');
}

console.log(erros.join('\n') || 'sem erros');
await b.close();
if (falhas.length || erros.length) process.exit(1);

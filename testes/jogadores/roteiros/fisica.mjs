// Roteiro "física e controles do clássico": mede andar, correr, pular, agachar na beirada, dano de queda e confere
// as teclas do clássico no PC (Shift agacha, Ctrl corre, W duas vezes corre, T abre o chat, Q larga o item,
// F5 troca a câmera, roda do mouse troca o espaço). Medidas com o tempo do JOGO (o Chromium do teste não tem
// placa de vídeo e roda devagar).
import { acharBloco, irAte, quebrarBloco, juntar, itens, mirarBloco, bloco, pos, inv } from '../acoes.mjs';

// velocidade de cruzeiro: lê a velocidade do jogador enquanto segura a tecla/joystick
async function velocidade(j, como) {
  // amostra a velocidade o tempo todo enquanto anda e fica com a de cruzeiro (a segunda maior);
  // no Chromium do teste o jogo roda a poucos quadros e demora para chegar na velocidade final
  const amostras = [];
  let andando = true;
  const coleta = (async () => { await j.p.waitForTimeout(400); while (andando) { amostras.push(await j.p.evaluate(() => { const v = window.__jogo.jog.vel; return Math.hypot(v.x, v.z); })); await j.p.waitForTimeout(100); } })();
  await como(); andando = false; await coleta;
  amostras.sort((a, b) => a - b);
  return +(amostras[amostras.length - 2] || 0).toFixed(2);
}

// volta para o meio da pista de medição (como dar /tp no clássico), para cada medida começar no aberto
async function meioDaPista(j) {
  await j.p.evaluate(() => { const g = window.__jogo, c = g.__pista; if (!c) return; Object.assign(g.jog.pos, { x: c.x, y: c.y, z: c.z }); Object.assign(g.jog.vel, { x: 0, y: 0, z: 0 }); });
  await j.p.waitForTimeout(600);
}

// vira para a direção mais aberta e plana (8 blocos sem parede nem buraco), como uma pessoa escolheria
async function virarParaOAberto(j) {
  const r = await j.p.evaluate(() => {
    const g = window.__jogo, m = g.mundo, p = g.jog.pos, x0 = Math.floor(p.x), y0 = Math.floor(p.y), z0 = Math.floor(p.z);
    let melhor = null;
    for (let k = 0; k < 16; k++) {
      const a = k * Math.PI / 8, dx = -Math.sin(a), dz = -Math.cos(a);
      let livre = 0;
      for (let d = 1; d <= 14; d++) {
        const x = Math.floor(p.x + dx * d), z = Math.floor(p.z + dz * d);
        if (m.bloco(x, y0, z) || m.bloco(x, y0 + 1, z) || !m.bloco(x, y0 - 1, z)) break;
        livre = d;
      }
      if (!melhor || livre > melhor.livre) melhor = { livre, a };
    }
    return melhor;
  });
  if (r.livre < 10) {
    j.passo('aqui é muito fechado; anda um pouco procurando lugar aberto');
    return r.livre;
  }
  const d = await j.p.evaluate((a) => { let d = a - window.__jogo.jog.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }, r.a);
  const k = j.toque ? await j.p.evaluate(() => window.__jogo.ctrl.sensToque) : 0.0024;
  await j.olhar(-d / k, 0);
  return r.livre;
}

export default async function fisica(j) {
  if (!(await j.jogarSozinho())) return;
  // semente 42: nasce longe da vila, num lugar aberto (medida igual em toda rodada)
  if (!(await j.criarMundo({ nome: 'Física', semente: process.env.SEMENTE_MUNDO || '42' }))) return;
  // Pista de medição: um campo de grama plano de 41x41 sem nada em cima, como um mundo plano do clássico,
  // para a medida não depender de onde o mundo nasceu (vila, árvore, encosta, água). Meio-dia, sem monstros.
  await j.p.evaluate(() => {
    const g = window.__jogo, m = g.mundo, p = g.jog.pos, x0 = Math.floor(p.x), z0 = Math.floor(p.z), y = Math.max(Math.floor(p.y), 40);
    for (let x = -20; x <= 20; x++) for (let z = -20; z <= 20; z++) {
      for (let d = -3; d < 0; d++) m.definir(x0 + x, y + d, z0 + z, d === -1 ? 1 : 2);
      for (let d = 0; d <= 12; d++) if (m.bloco(x0 + x, y + d, z0 + z)) m.definir(x0 + x, y + d, z0 + z, 0);
    }
    // um monte de terra (uma fileira de 9 blocos) para cavar com a mão
    for (let x = -4; x <= 4; x++) m.definir(x0 + x, y, z0 + 8, 2);
    g.__pista = { x: x0 + 0.5, y: y + 0.01, z: z0 + 0.5 };
    Object.assign(g.jog.pos, g.__pista); Object.assign(g.jog.vel, { x: 0, y: 0, z: 0 }); g.dia = 0.3;
  });
  j.passo('preparou a pista de medição (campo de grama plano 41x41)');
  await j.p.waitForTimeout(5000); // o jogo remonta os pedaços mexidos
  await meioDaPista(j); await virarParaOAberto(j);
  const anda = await velocidade(j, () => j.andar('frente', 3000));
  await j.espera(Math.abs(anda - 4.32) < 0.35, 'andar: ~4,3 blocos por segundo como no clássico', { tipo: 'clássico', esperado: '4,3 b/s', visto: anda + ' b/s' });
  if (!j.toque) {
    await meioDaPista(j); await virarParaOAberto(j);
    const corre = await velocidade(j, async () => { await j.p.keyboard.down('ControlLeft'); await j.andar('frente', 3000); await j.p.keyboard.up('ControlLeft'); });
    await j.espera(Math.abs(corre - 5.61) < 0.4, 'Ctrl + W corre a ~5,6 blocos por segundo como no clássico', { tipo: 'clássico', esperado: '5,6 b/s', visto: corre + ' b/s' });
    // W duas vezes rápido também corre no clássico
    await meioDaPista(j); await virarParaOAberto(j);
    let duplo = await velocidade(j, async () => { j.passo('apertou W duas vezes rápido'); await j.p.evaluate(() => { for (const t of ['keydown', 'keyup', 'keydown']) dispatchEvent(new KeyboardEvent(t, { code: 'KeyW', key: 'w' })); }); await j.andar('frente', 3000); });
    if (duplo <= 5) { j.passo('não correu; tenta de novo, como uma pessoa'); await meioDaPista(j); await virarParaOAberto(j);duplo = await velocidade(j, async () => { j.passo('apertou W duas vezes rápido'); await j.p.evaluate(() => { for (const t of ['keydown', 'keyup', 'keydown']) dispatchEvent(new KeyboardEvent(t, { code: 'KeyW', key: 'w' })); }); await j.andar('frente', 3000); }); }
    await j.espera(duplo > 5, 'apertar W duas vezes rápido corre, como no clássico', { tipo: 'clássico', esperado: '> 5 b/s', visto: duplo + ' b/s' });
    // Shift no clássico agacha (anda devagar ~1,3 b/s)
    await meioDaPista(j); await virarParaOAberto(j);
    const shift = await velocidade(j, async () => { await j.p.keyboard.down('ShiftLeft'); await j.andar('frente', 3000); await j.p.keyboard.up('ShiftLeft'); });
    await j.espera(shift < 2, 'Shift agacha (anda devagar), como no clássico', { tipo: 'clássico', esperado: '~1,3 b/s agachado', visto: shift + ' b/s' });
  } else {
    await meioDaPista(j); await virarParaOAberto(j);
    const corre = await velocidade(j, () => j.andar('frente', 3000, { correr: true }));
    await j.espera(Math.abs(corre - 5.61) < 0.4, 'toque duplo no joystick corre a ~5,6 b/s como no clássico', { tipo: 'clássico', esperado: '5,6 b/s', visto: corre + ' b/s' });
  }
  // pulo: altura de ~1,25 bloco
  await meioDaPista(j);
  await j.p.waitForTimeout(500);
  // pulo só vale com o céu livre (2 blocos acima da cabeça), senão é o teto que segura, não o jogo
  const teto = await j.p.evaluate(() => { const g = window.__jogo, p = g.jog.pos; for (let d = 2; d <= 3; d++) if (g.mundo.bloco(Math.floor(p.x), Math.floor(p.y) + d, Math.floor(p.z))) return d; return 0; });
  if (teto) { j.passo('tem bloco em cima da cabeça; anda um pouco antes de pular'); await virarParaOAberto(j); await j.andar('frente', 1500); }
  const y0 = (await pos(j)).y;
  // mede até pousar de novo (o teste roda a poucos quadros)
  const subida = j.p.evaluate(() => new Promise((r) => { const jg = window.__jogo.jog, y0 = jg.pos.y; let mx = y0; const t0 = performance.now(); let saiu = false; const tr = []; const f = () => { mx = Math.max(mx, jg.pos.y); if (tr.length < 40) tr.push([+jg.pos.y.toFixed(2), +jg.vel.y.toFixed(1), jg.noChao ? 1 : 0]); window.__trPulo = tr; if (!jg.noChao) saiu = true; if ((saiu && jg.noChao) || performance.now() - t0 > 30000) r(mx - y0); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  await j.pular();
  const alt = await subida;
  await j.espera(alt > 1.1 && alt < 1.45, 'o pulo sobe ~1,25 bloco (passa 1 bloco, não passa 2)', { tipo: 'clássico', esperado: '1,25', visto: alt.toFixed(2) + ' (de ' + y0 + ') ' + JSON.stringify(await j.p.evaluate(() => window.__trPulo)) });

  // dano de queda: junta terra e sobe num pilar pulando e colocando bloco embaixo (como no clássico)
  let terra = 0;
  for (let n = 0; n < 12 && terra < 6; n++) {
    const t = await acharBloco(j, [1, 2], 12);
    if (!t) break;
    await irAte(j, t.x, t.z, { perto: 2.5, ms: 10000 });
    if ((await quebrarBloco(j, t.x, t.y, t.z, { max: 6000 })) < 0) continue;
    await juntar(j, t.x, t.z);
    terra = (await itens(j))[2] || 0;
  }
  if (!(await j.espera(terra >= 5, 'cavar grama/terra com a mão dá terra', { visto: terra + ' terras' }))) return;
  const s = (await inv(j)).s.findIndex((x) => x && x[0] === 2);
  await j.escolherSlot(s);
  await meioDaPista(j); // sai do buraco que cavou e sobe o pilar no campo
  const base = await pos(j);
  await j.olhar(0, 2000); // olha para os pés
  for (let k = 0; k < 5; k++) {
    j.passo('pulou e colocou terra embaixo dos pés');
    // como uma pessoa: pula e coloca o bloco quando os pés já passaram da altura de 1 bloco
    const yAntes = (await pos(j)).y;
    const noAlto = () => j.p.waitForFunction((y) => window.__jogo.jog.pos.y > y + 1.02, yAntes, { timeout: 15000 }).catch(() => {});
    if (!j.toque) { await j.p.keyboard.down('Space'); await noAlto(); await j.usar(); await j.p.keyboard.up('Space'); }
    else { const pr = j.pular(); await noAlto(); await j.usar(); await pr; }
    await j.p.waitForFunction(() => window.__jogo.jog.noChao, null, { timeout: 15000 }).catch(() => {});
    await j.p.waitForTimeout(300);
  }
  const topo = await pos(j);
  const subiu = Math.round(topo.y - base.y);
  if (subiu < 4) j.passo('fps na hora do pilar: ' + (await j.p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }))));
  if (!(await j.espera(subiu >= 4, 'pular e colocar bloco embaixo sobe um pilar (técnica do clássico)', { tipo: 'clássico', esperado: 'subir 5', visto: 'subiu ' + subiu }))) return;
  const vida0 = (await j.estado).vida;
  // mede a queda de verdade: do último instante no chão até tocar o chão de novo (descer uma ladeira não conta)
  const medida = j.p.evaluate(() => new Promise((r) => { const jg = window.__jogo.jog; let alto = null, t0 = performance.now(); const f = () => { if (!jg.noChao && !jg.naAgua) alto = Math.max(alto ?? jg.pos.y, jg.pos.y); else if (alto != null) return r({ queda: alto - jg.pos.y, agua: jg.naAgua }); if (performance.now() - t0 < 30000) requestAnimationFrame(f); else r({ queda: 0 }); }; requestAnimationFrame(f); }));
  // a vida mais baixa logo depois de pousar (com a fome cheia ela volta a encher sozinha, como no clássico)
  const vigia = j.p.evaluate(() => new Promise((r) => { let mn = window.__jogo.vida.atual; const t0 = performance.now(); const f = () => { mn = Math.min(mn, window.__jogo.vida.atual); if (performance.now() - t0 < 30000 && !(window.__fimQueda && performance.now() - window.__fimQueda > 2500)) requestAnimationFrame(f); else r(mn); }; requestAnimationFrame(f); }));
  await j.olhar(0, -2000);
  for (let t = 0; t < 5 && (await j.p.evaluate(() => window.__jogo.jog.noChao)); t++) await j.andar('frente', 1200);
  const m = await medida;
  await j.p.evaluate(() => { window.__fimQueda = performance.now(); });
  const vida1 = await vigia;
  const queda = m.agua ? 0 : Math.round(m.queda);
  const esperado = Math.max(0, queda - 3);
  await j.espera(queda < 3 || Math.abs((vida0 - vida1) - esperado) <= 1, `cair ${queda} blocos tira ${esperado} de vida (meio coração por bloco acima de 3)`, { tipo: 'clássico', esperado: String(esperado), visto: `perdeu ${vida0 - vida1} (de ${vida0} para ${vida1})` });

  if (!j.toque) {
    // teclas do clássico
    const camAntes = await j.p.evaluate(() => window.__jogo.visao && (window.__jogo.visao.modo ?? window.__jogo.visao.atual));
    await j.tecla('F5', 'F5 (câmera)');
    const camDepois = await j.p.evaluate(() => window.__jogo.visao && (window.__jogo.visao.modo ?? window.__jogo.visao.atual));
    await j.espera(camAntes !== camDepois, 'F5 troca a câmera (primeira/terceira pessoa)', { tipo: 'clássico', visto: `${camAntes} -> ${camDepois}` });
    await j.tecla('F5'); await j.tecla('F5');
    // (T abre o chat: conferido no roteiro online; sem internet não há chat)
    const antes = (await itens(j))[2] || 0;
    await j.tecla('KeyQ', 'Q (largar item)');
    await j.p.waitForTimeout(400);
    const depois = (await itens(j))[2] || 0;
    await j.espera(depois === antes - 1, 'Q larga 1 item da mão, como no clássico', { tipo: 'clássico', esperado: `${antes - 1}`, visto: `${depois}` });
    const sel = () => j.p.evaluate(() => [...document.querySelectorAll('#barra .slot:not(.mais)')].findIndex((e) => e.classList.contains('sel')));
    const slotA = await sel();
    await j.p.evaluate(() => dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }))); await j.p.waitForTimeout(200);
    const slotB = await sel();
    j.passo('rolou a roda do mouse');
    await j.espera(slotA !== slotB, 'a roda do mouse troca o espaço da barra', { tipo: 'clássico', visto: `${slotA} -> ${slotB}` });
  }
  if (!j.toque) {
    if (!(await j.p.evaluate(() => !!document.pointerLockElement))) await j.travarMouse();
    await j.esc();
    await j.espera(await j.ve('#pausa:not([hidden])', 2000), 'Esc no meio do jogo abre o menu do jogo, como no clássico', { tipo: 'clássico', visto: 'o Esc só soltou o mouse' });
    await j.p.keyboard.press('Escape'); await j.p.waitForTimeout(300);
    await j.espera(!(await j.p.isVisible('#pausa')), 'Esc de novo fecha o menu e volta ao jogo', { tipo: 'clássico' });
  }
  await j.semErros('na física');
}

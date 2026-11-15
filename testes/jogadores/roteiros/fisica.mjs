// Roteiro "física e controles do clássico": mede andar, correr, pular, agachar na beirada, dano de queda e confere
// as teclas do clássico no PC (Shift agacha, Ctrl corre, W duas vezes corre, T abre o chat, Q larga o item,
// F5 troca a câmera, roda do mouse troca o espaço). Medidas com o tempo do JOGO (o Chromium do teste não tem
// placa de vídeo e roda devagar).
import { acharBloco, irAte, quebrarBloco, juntar, itens, mirarBloco, bloco, pos, inv } from '../acoes.mjs';

// velocidade de cruzeiro: lê a velocidade do jogador enquanto segura a tecla/joystick
async function velocidade(j, como) {
  const amostras = [];
  const coleta = (async () => { await j.p.waitForTimeout(900); for (let k = 0; k < 6; k++) { amostras.push(await j.p.evaluate(() => { const v = window.__jogo.jog.vel; return Math.hypot(v.x, v.z); })); await j.p.waitForTimeout(120); } })();
  await como(); await coleta;
  amostras.sort((a, b) => a - b);
  return +amostras[amostras.length - 2].toFixed(2);
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
  // semente 6: nasce num lugar plano, com 16 blocos livres (medida igual em toda rodada)
  if (!(await j.criarMundo({ nome: 'Física', semente: process.env.SEMENTE_MUNDO || '6' }))) return;
  // nasceu na água ou numa encosta? sai para a grama, como uma pessoa faria antes de medir
  for (let t = 0; t < 3 && (await j.p.evaluate(() => window.__jogo.jog.naAgua || !window.__jogo.jog.noChao)); t++) {
    const g = await acharBloco(j, [1], 20);
    if (g) await irAte(j, g.x, g.z, { perto: 0.8, ms: 20000 });
  }
  // anda num lugar aberto (14 blocos planos na frente)
  for (let t = 0; t < 4 && (await virarParaOAberto(j)) < 10; t++) await j.andar(['frente', 'direita', 'tras', 'esquerda'][t], 2500, { pular: true });
  const anda = await velocidade(j, () => j.andar('frente', 1800));
  await j.espera(Math.abs(anda - 4.32) < 0.35, 'andar: ~4,3 blocos por segundo como no clássico', { tipo: 'clássico', esperado: '4,3 b/s', visto: anda + ' b/s' });
  if (!j.toque) {
    await virarParaOAberto(j);
    const corre = await velocidade(j, async () => { await j.p.keyboard.down('ControlLeft'); await j.andar('frente', 1800); await j.p.keyboard.up('ControlLeft'); });
    await j.espera(Math.abs(corre - 5.61) < 0.4, 'Ctrl + W corre a ~5,6 blocos por segundo como no clássico', { tipo: 'clássico', esperado: '5,6 b/s', visto: corre + ' b/s' });
    // W duas vezes rápido também corre no clássico
    await virarParaOAberto(j);
    const duplo = await velocidade(j, async () => { await j.p.keyboard.press('KeyW'); await j.p.waitForTimeout(80); await j.andar('frente', 1800); });
    await j.espera(duplo > 5, 'apertar W duas vezes rápido corre, como no clássico', { tipo: 'clássico', esperado: '> 5 b/s', visto: duplo + ' b/s' });
    // Shift no clássico agacha (anda devagar ~1,3 b/s)
    await virarParaOAberto(j);
    const shift = await velocidade(j, async () => { await j.p.keyboard.down('ShiftLeft'); await j.andar('frente', 1800); await j.p.keyboard.up('ShiftLeft'); });
    await j.espera(shift < 2, 'Shift agacha (anda devagar), como no clássico', { tipo: 'clássico', esperado: '~1,3 b/s agachado', visto: shift + ' b/s' });
  } else {
    await virarParaOAberto(j);
    const corre = await velocidade(j, () => j.andar('frente', 1800, { correr: true }));
    await j.espera(Math.abs(corre - 5.61) < 0.4, 'toque duplo no joystick corre a ~5,6 b/s como no clássico', { tipo: 'clássico', esperado: '5,6 b/s', visto: corre + ' b/s' });
  }
  // pulo: altura de ~1,25 bloco
  await j.p.waitForTimeout(500);
  // pulo só vale com o céu livre (2 blocos acima da cabeça), senão é o teto que segura, não o jogo
  const teto = await j.p.evaluate(() => { const g = window.__jogo, p = g.jog.pos; for (let d = 2; d <= 3; d++) if (g.mundo.bloco(Math.floor(p.x), Math.floor(p.y) + d, Math.floor(p.z))) return d; return 0; });
  if (teto) { j.passo('tem bloco em cima da cabeça; anda um pouco antes de pular'); await virarParaOAberto(j); await j.andar('frente', 1500); }
  const y0 = (await pos(j)).y;
  const subida = j.p.evaluate(() => new Promise((r) => { const jg = window.__jogo.jog, y0 = jg.pos.y; let mx = y0; const t0 = performance.now(); const f = () => { mx = Math.max(mx, jg.pos.y); if (performance.now() - t0 < 2500) requestAnimationFrame(f); else r(mx - y0); }; requestAnimationFrame(f); }));
  await j.pular();
  const alt = await subida;
  await j.espera(alt > 1.1 && alt < 1.45, 'o pulo sobe ~1,25 bloco (passa 1 bloco, não passa 2)', { tipo: 'clássico', esperado: '1,25', visto: alt.toFixed(2) + ' (de ' + y0 + ')' });

  // dano de queda: junta terra e sobe num pilar pulando e colocando bloco embaixo (como no clássico)
  let terra = 0;
  for (let n = 0; n < 12 && terra < 6; n++) {
    const t = await acharBloco(j, [1, 2], 6);
    if (!t) break;
    await irAte(j, t.x, t.z, { perto: 2.5, ms: 10000 });
    if ((await quebrarBloco(j, t.x, t.y, t.z, { max: 6000 })) < 0) continue;
    await juntar(j, t.x, t.z);
    terra = (await itens(j))[2] || 0;
  }
  if (!(await j.espera(terra >= 5, 'cavar grama/terra com a mão dá terra', { visto: terra + ' terras' }))) return;
  const s = (await inv(j)).s.findIndex((x) => x && x[0] === 2);
  await j.escolherSlot(s);
  const base = await pos(j);
  await j.olhar(0, 2000); // olha para os pés
  for (let k = 0; k < 5; k++) {
    j.passo('pulou e colocou terra embaixo dos pés');
    if (!j.toque) { await j.p.keyboard.down('Space'); await j.p.waitForTimeout(260); await j.usar(); await j.p.keyboard.up('Space'); }
    else { const pr = j.pular(); await j.p.waitForTimeout(240); await j.usar(); await pr; }
    await j.p.waitForTimeout(900);
  }
  const topo = await pos(j);
  const subiu = Math.round(topo.y - base.y);
  if (subiu < 4) j.passo('fps na hora do pilar: ' + (await j.p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }))));
  if (!(await j.espera(subiu >= 4, 'pular e colocar bloco embaixo sobe um pilar (técnica do clássico)', { tipo: 'clássico', esperado: 'subir 5', visto: 'subiu ' + subiu }))) return;
  const vida0 = (await j.estado).vida;
  // mede a queda de verdade: do último instante no chão até tocar o chão de novo (descer uma ladeira não conta)
  const medida = j.p.evaluate(() => new Promise((r) => { const jg = window.__jogo.jog; let alto = null, t0 = performance.now(); const f = () => { if (!jg.noChao && !jg.naAgua) alto = Math.max(alto ?? jg.pos.y, jg.pos.y); else if (alto != null) return r({ queda: alto - jg.pos.y, agua: jg.naAgua }); if (performance.now() - t0 < 6000) requestAnimationFrame(f); else r({ queda: 0 }); }; requestAnimationFrame(f); }));
  await j.olhar(0, -2000);
  await j.andar('frente', 1200);
  const m = await medida;
  await j.p.waitForTimeout(1200);
  const vida1 = (await j.estado).vida;
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

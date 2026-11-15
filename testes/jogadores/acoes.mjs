// Ações de jogo de um jogador-robô, feitas como uma pessoa: anda até lá com o teclado/joystick, gira a câmera com o
// mouse/dedo, segura para quebrar, abre a mochila e arrasta os itens. O jogo só é LIDO para saber onde estão as
// coisas (uma pessoa enxerga a árvore; o robô procura no mapa) e para conferir o resultado.

// procura o bloco mais perto (ids) num raio, que tenha ar em volta (dá para ver e chegar)
export function acharBloco(j, ids, raio = 24, { acimaDoChao = true } = {}) {
  return j.p.evaluate(([ids, raio, acima]) => {
    const g = window.__jogo, m = g.mundo, p = g.jog.pos;
    const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
    let melhor = null, dm = 1e9;
    for (let dx = -raio; dx <= raio; dx++) for (let dz = -raio; dz <= raio; dz++) for (let dy = -6; dy <= 8; dy++) {
      const x = px + dx, y = py + dy, z = pz + dz, b = m.bloco(x, y, z);
      if (!ids.includes(b)) continue;
      if (acima && !(m.bloco(x + 1, y, z) === 0 || m.bloco(x - 1, y, z) === 0 || m.bloco(x, y, z + 1) === 0 || m.bloco(x, y, z - 1) === 0)) continue;
      const d = Math.hypot(dx, dz) + Math.abs(dy) * 1.5;
      if (d < dm) { dm = d; melhor = { x, y, z, b, d: +d.toFixed(1) }; }
    }
    return melhor;
  }, [ids, raio, acimaDoChao]);
}

export const bloco = (j, x, y, z) => j.p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x, y, z]);
export const itens = (j) => j.p.evaluate(() => ({ ...window.__jogo.mercado.e.itens }));
export const pos = (j) => j.p.evaluate(() => { const p = window.__jogo.jog.pos; return { x: p.x, y: p.y, z: p.z }; });

// gira só no plano (yaw) para o ponto, com o mouse/dedo
export async function virarPara(j, x, z) {
  const e = await j.p.evaluate(([x, z]) => { const g = window.__jogo, jg = g.jog; const yaw = Math.atan2(-(x - jg.pos.x), -(z - jg.pos.z)); let d = yaw - jg.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return { d, pitch: jg.pitch, k: (g.ctrl.escala || 1) }; }, [x, z]);
  const k = (j.toque ? await j.p.evaluate(() => window.__jogo.ctrl.sensToque) : 0.0024) * e.k;
  await j.olhar(-e.d / k, e.pitch / k); // e endireita a cabeça
}

// anda até ficar a "perto" blocos do ponto; pula quando trava; desiste depois de ms
export async function irAte(j, x, z, { perto = 2.2, ms = 40000 } = {}) {
  const t0 = Date.now();
  let ultimo = await pos(j), presos = 0;
  while (Date.now() - t0 < ms) {
    const p = await pos(j);
    const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z);
    if (d <= perto) return true;
    await virarPara(j, x + 0.5, z + 0.5);
    await j.andar('frente', Math.min(900, 150 + d * 120), { pular: presos > 0 });
    const q = await pos(j);
    if (Math.hypot(q.x - ultimo.x, q.z - ultimo.z) < 0.25) { presos++; if (presos > 6) { await j.andar(presos % 2 ? 'esquerda' : 'direita', 500, { pular: true }); } }
    else presos = 0;
    ultimo = q;
  }
  return false;
}

// mira o centro do bloco pela câmera de verdade (posição da câmera do jogo)
export async function mirarBloco(j, x, y, z) {
  for (let t = 0; t < 5; t++) {
    const e = await j.p.evaluate(([x, y, z]) => {
      const g = window.__jogo, jg = g.jog, c = g.camera.position;
      const dx = x - c.x, dy = y - c.y, dz = z - c.z;
      const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
      let dyw = yaw - jg.yaw; while (dyw > Math.PI) dyw -= 2 * Math.PI; while (dyw < -Math.PI) dyw += 2 * Math.PI;
      return { dyaw: dyw, dpitch: pitch - jg.pitch, k: g.ctrl.escala || 1, s: g.ctrl.sensToque };
    }, [x + 0.5, y + 0.5, z + 0.5]);
    if (Math.abs(e.dyaw) < 0.04 && Math.abs(e.dpitch) < 0.04) return true;
    const k = (j.toque ? e.s : 0.0024) * e.k;
    await j.olhar(-e.dyaw / k, -e.dpitch / k);
    await j.p.waitForTimeout(60);
  }
  return false;
}

// o que a mira está apontando agora (para conferir antes de bater)
export const mirando = (j) => j.p.evaluate(() => { const g = window.__jogo, c = g.camera; const v = c.getWorldDirection(c.position.clone()); const h = g.mundo.raycast(c.position, v, 6); const p = g.jog.pos; return { bloco: h ? [h.x, h.y, h.z, h.b, +h.t.toFixed(2)] : null, pe: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], aldeoes: g.aldeoes ? g.aldeoes.lista?.length : null }; });

// segura (sem soltar) até o bloco sumir; devolve quanto tempo levou (ms) ou -1
export async function quebrarBloco(j, x, y, z, { max = 15000 } = {}) {
  await mirarBloco(j, x, y, z);
  j.passo(`segurou para quebrar o bloco em ${x},${y},${z}`);
  const { width: w, height: h } = j.p.viewportSize();
  if (j.toque) await j.dedos('touchStart', [[w / 2, h / 2, 6]]);
  else { if (!j.travado) await j.travarMouse(); await j.p.mouse.down({ button: 'left' }); }
  const t0 = Date.now();
  let ms = -1;
  while (Date.now() - t0 < max) {
    const b = await bloco(j, x, y, z);
    if (!b || b === 5) { ms = Date.now() - t0; break; }
    await j.p.waitForTimeout(80);
  }
  if (j.toque) await j.dedos('touchEnd', []); else await j.p.mouse.up({ button: 'left' });
  return ms;
}

// anda por cima do lugar para pegar o que caiu
export async function juntar(j, x, z) {
  const p = await pos(j);
  await virarPara(j, x + 0.5, z + 0.5);
  const d = Math.hypot(x + 0.5 - p.x, z + 0.5 - p.z);
  await j.andar('frente', Math.min(1500, 200 + d * 260));
  await j.p.waitForTimeout(800);
}

// ---------- mochila (inventário igual ao clássico) ----------
export const SLOT = (i) => (i < 9 ? `.inv-barra [data-i="${i}"]` : i === 36 ? `.inv-mao2 [data-i="36"]` : `.inv-mochila [data-i="${i}"]`);
export const GRADE = (i) => `.grade-criar [data-i="${i}"]`;
export const inv = (j) => j.p.evaluate(() => { const v = window.__jogo.inv; return { s: v.s.map((x) => x && [x.id, x.n]), g: v.g.map((x) => x && [x.id, x.n]), c: v.cursor && [v.cursor.id, v.cursor.n], w: v.w }; });
export async function ondeEsta(j, id) { const e = await inv(j); return e.s.findIndex((x) => x && x[0] === id); }

async function clicar(j, sel, botao = 'left') {
  if (j.toque) {
    if (botao === 'right') { // segurar o dedo = metade/um
      const r = await j.p.locator(sel).first().boundingBox();
      await j.dedos('touchStart', [[r.x + r.width / 2, r.y + r.height / 2, 11]]); await j.p.waitForTimeout(550); await j.dedos('touchEnd', []);
    } else await j.p.locator(sel).first().tap();
  } else await j.p.locator(sel).first().click({ button: botao });
  await j.p.waitForTimeout(120);
}
// põe 1 item de id em cada casa da grade (lista de índices da grade) e pega o resultado; devolve o que saiu
export async function craftar(j, id, casas, vezes = 1) {
  for (let v = 0; v < vezes; v++) {
    for (const c of casas) {
      const s = await ondeEsta(j, Array.isArray(id) ? id[casas.indexOf(c)] : id);
      if (s < 0) return false;
      j.passo(`pegou ${Array.isArray(id) ? id[casas.indexOf(c)] : id} do espaço ${s} e pôs 1 na grade ${c}`);
      await clicar(j, SLOT(s));          // pega a pilha
      await clicar(j, GRADE(c), 'right'); // larga 1
      const e = await inv(j);
      if (e.c) await clicar(j, SLOT(s));  // devolve o resto
    }
  }
  const pronto = await j.p.isVisible('#inv-saida.pronta');
  if (!pronto) return false;
  j.passo(`${j.toque ? 'tocou' : 'clicou'} no resultado`);
  await clicar(j, '#inv-saida');
  const e = await inv(j);
  if (e.c) { // ficou na mão: guarda num espaço vazio
    const vazio = e.s.findIndex((x, i) => !x && i < 36);
    await clicar(j, SLOT(vazio >= 0 ? vazio : 0));
  }
  return true;
}

// Roteiro "criança apertando tudo": num aparelho (de preferência o tablet lento), entra num mundo e faz centenas de
// ações ao acaso: anda, pula, gira, quebra, coloca, abre e fecha mochila e menu, aperta botões quaisquer, fica sem
// internet, vai para outro aplicativo, gira o aparelho, recarrega. A cada tanto confere se o jogo continua vivo
// (desenhando quadros, sem erro de JavaScript, sem ficar preso numa tela). A SEMENTE repete a mesma bagunça.
import { sorteio } from '../base.mjs';

async function vivo(j) {
  return j.p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); setTimeout(() => r(n), 4000); })).catch(() => -1);
}
const telaPresa = (j) => j.p.evaluate(() => {
  const vis = (s) => { const e = document.querySelector(s); return e && !e.hidden && getComputedStyle(e).display !== 'none'; };
  const menus = ['#menu', '#pausa', '#inventario', '#comandos', '#mapa', '#personagem', '#editar-mundo', '#morte', '#missoes'].filter(vis);
  return { menus, jogando: !!(window.__jogo && window.__jogo.jog), pausado: window.__jogo && window.__jogo.pausado };
});

export default async function caos(j, { acoes = +process.env.ACOES || 120 } = {}) {
  const rnd = sorteio(+process.env.SEMENTE || Date.now());
  j.passo('semente da bagunça: ' + rnd.semente);
  if (!(await j.jogarSozinho())) return;
  if (!(await j.criarMundo({ nome: 'Bagunça', modo: rnd() < 0.5 ? 'sobrevivencia' : 'criativo' }))) return;
  const lista = [
    [20, () => j.andar(['frente', 'tras', 'esquerda', 'direita'][Math.floor(rnd() * 4)], 200 + rnd() * 1200, { pular: rnd() < 0.3, correr: rnd() < 0.3 })],
    [12, () => j.olhar((rnd() - 0.5) * 900, (rnd() - 0.5) * 400)],
    [8, () => j.pular()],
    [10, () => j.quebrar(300 + rnd() * 1500)],
    [8, () => j.usar()],
    [5, async () => { await j.abrirInventario(); await j.apertarAoAcaso(3, rnd); await j.fecharInventario(); }],
    [4, async () => { j.passo('abriu o menu'); if (j.toque) await j.tocar('#bt-menu'); else await j.p.keyboard.press('Escape'); await j.p.waitForTimeout(300); await j.apertarAoAcaso(2, rnd); await j.p.keyboard.press('Escape'); await j.p.waitForTimeout(200); if (!j.toque) await j.travarMouse(); }],
    [5, () => j.apertarAoAcaso(1 + Math.floor(rnd() * 3), rnd)],
    [3, () => j.escolherSlot(Math.floor(rnd() * 9))],
    [2, () => j.semInternet(2000 + rnd() * 6000)],
    [2, () => j.segundoPlano(1000 + rnd() * 4000)],
    [1, () => (j.toque ? j.girarAparelho() : j.p.setViewportSize({ width: 900 + Math.floor(rnd() * 600), height: 600 + Math.floor(rnd() * 300) }))],
    [2, async () => { for (let k = 0; k < 6; k++) await j.tecla(['KeyE', 'KeyF', 'KeyQ', 'KeyR', 'KeyT', 'KeyM', 'Tab', 'Digit3', 'Space'][Math.floor(rnd() * 9)]); }],
  ];
  const total = lista.reduce((s, [p]) => s + p, 0);
  for (let n = 0; n < acoes; n++) {
    let r = rnd() * total, acao = lista[0][1];
    for (const [p, f] of lista) { r -= p; if (r <= 0) { acao = f; break; } }
    try { await acao(); } catch (e) { j.passo('a ação falhou: ' + e.message.split('\n')[0].slice(0, 100)); }
    if (j.erros.length) { await j.semErros(`depois de ${n + 1} ações ao acaso`); }
    if (n % 15 === 14) {
      const q = await vivo(j);
      if (q <= 0) { await j.bug('o jogo parou de desenhar (travou) no meio da bagunça', { tipo: 'travou', visto: `${q} quadros em 1,5 s` }); return; }
      const t = await telaPresa(j);
      if (!t.jogando && !t.menus.includes('#menu')) { await j.bug('ficou numa tela sem jogo e sem menu', { visto: JSON.stringify(t) }); return; }
      // tenta sair de qualquer janela com Esc/voltar, como uma pessoa faria
      if (t.menus.length && t.jogando) { await j.p.keyboard.press('Escape'); await j.p.waitForTimeout(300); }
    }
  }
  // no fim, precisa conseguir voltar a jogar: fecha tudo e anda
  for (let k = 0; k < 3; k++) { await j.p.keyboard.press('Escape'); await j.p.waitForTimeout(250); }
  const t = await telaPresa(j);
  if (t.menus.includes('#pausa')) { j.passo('fechou o menu'); await j.p.keyboard.press('Escape'); }
  const a = await j.estado;
  if (a) {
    if (!j.toque) await j.travarMouse();
    await j.andar('frente', 1200); await j.andar('direita', 800);
    const b = await j.estado;
    const moveu = Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) > 0.3 || Math.abs(b.pos.y - a.pos.y) > 0.3;
    await j.espera(moveu, 'depois da bagunça ainda dá para voltar a andar', { tipo: 'travou', visto: JSON.stringify({ antes: a.pos, depois: b.pos, telas: (await telaPresa(j)).menus }) });
  }
  await j.print('fim-caos');
}

// Teste real de responsividade: abre o jogo em celular em pé (360x740), deitado (740x360), pequeno (320x568) e tablet,
// joga pela tela (menu, criar mundo, HUD, emotes, chat, mochila, pausa, editar, personagem, comandos, mapa),
// tira fotos e lista o que sai da tela ou fica por cima de outro botão. SAIDA=pasta das fotos, SO=cel-retrato,tablet...
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/fotos';
const URL = process.env.URL || 'http://localhost:8788';
const APARELHOS = {
  'cel-retrato': { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'cel-deitado': { viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'cel-pequeno': { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  'tablet': { ...devices['Galaxy Tab S4 landscape'] },
  'tablet-retrato': { ...devices['Galaxy Tab S4'] },
};
const so = process.env.SO ? process.env.SO.split(',') : Object.keys(APARELHOS);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const relatorio = {};
async function problemas(p, sel) {
  return p.evaluate((sel) => {
    const W = innerWidth, H = innerHeight, out = [];
    const raiz = document.querySelector(sel) || document.body;
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    // fora da tela
    for (const e of raiz.querySelectorAll('button, .bt, input, select, #barra, #status, #emotes, #minimapa, .caixa, h2, label, a')) {
      if (!vis(e)) continue; const r = e.getBoundingClientRect();
      // ignora coisas dentro de áreas com rolagem
      let rol = false; for (let a = e.parentElement; a; a = a.parentElement) { const o = getComputedStyle(a).overflowY; if ((o === 'auto' || o === 'scroll') && a.scrollHeight > a.clientHeight + 2) { rol = true; break; } }
      if (rol) continue;
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) out.push('FORA ' + (e.id || e.className || e.tagName) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
    }
    // texto cortado horizontalmente
    for (const e of raiz.querySelectorAll('.caixa, .bt, .opcao-mundo')) { if (vis(e) && e.scrollWidth > e.clientWidth + 2) out.push('LARGO ' + (e.id || e.className) + ' ' + e.scrollWidth + '>' + e.clientWidth); }
    return out;
  }, sel);
}
async function sobreposicao(p) {
  return p.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
    const els = [...document.querySelectorAll('#hud #topo > button, #hud #topo #status, #hud #emotes, #hud #minimapa, #hud #barra, #hud #botoes-toque, #hud #vida, #hud #conversa-botoes, #hud #econ, #hud #dica-toque, #hud #chat-caixa, #hud #botoes-armas, #hud #armas-hud, #hud #veic-botoes, #hud #feed')].filter(vis);
    const out = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i].getBoundingClientRect(), c = els[j].getBoundingClientRect();
      if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
      const ix = Math.min(a.right, c.right) - Math.max(a.left, c.left), iy = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (ix > 4 && iy > 4) out.push('SOBRE ' + (els[i].id || els[i].className) + ' x ' + (els[j].id || els[j].className) + ` (${Math.round(ix)}x${Math.round(iy)})`);
    }
    return out;
  });
}
for (const nome of so) {
  const ctx = await b.newContext(APARELHOS[nome]);
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  const r = relatorio[nome] = {}; r.bloqueados = [];
  const toca = async (sel) => { try { await p.tap(sel, { timeout: 2500 }); } catch (e) { r.bloqueados.push(sel + ': ' + ((e.message.match(/<[^\n]*intercepts pointer events/) || [''])[0]).slice(0, 140)); await p.evaluate((s) => document.querySelector(s).click(), sel); } };
  const foto = async (n, sel) => { await p.waitForTimeout(350); await p.screenshot({ path: `${SAIDA}/${nome}-${n}.png` }); r[n] = [...await problemas(p, sel)]; };
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  await foto('1-menu', '#m-inicio');
  await toca('#bt-sozinho'); await p.waitForTimeout(500);
  if (await p.isVisible('#m-novo')) { await foto('2-novo-mundo', '#m-novo'); await toca('#m-novo button[type=submit]'); }
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  await foto('3-jogo', '#hud'); r['3-jogo'].push(...await sobreposicao(p));
  if (await p.isVisible('#bt-emotes')) { await toca('#bt-emotes'); await foto('3b-emotes', '#hud'); await toca('#emotes-lista [data-emote=coracao]'); r['3b-emotes'].push('fechou depois do emote: ' + !(await p.isVisible('#emotes-lista'))); }
  // chat aberto (simulado: mostra a área de conversa como no online)
  await p.evaluate(() => { const c = document.querySelector('#conversa'); c.hidden = false; c.classList.add('aberto'); document.querySelector('#chat-caixa').hidden = false; document.body.classList.add('chat-aberto'); const log = document.querySelector('#chat-log'); for (const [n, t] of [['Ana', 'oi! vem ver minha casa'], ['Beto', 'to indo, onde fica?'], ['Ana', 'perto do lago grande com a ponte']]) { const d = document.createElement('div'); d.className = 'chat-msg'; d.innerHTML = `<button class="chat-nome">${n}</button>${t}`; log.append(d); } document.querySelector('#bt-falar').hidden = false; });
  await foto('4-chat', '#hud'); r['4-chat'].push(...await sobreposicao(p));
  await p.evaluate(() => { const c = document.querySelector('#conversa'); c.hidden = true; c.classList.remove('aberto'); document.querySelector('#chat-caixa').hidden = true; document.body.classList.remove('chat-aberto'); });
  await toca('#barra .slot.mais'); await p.waitForTimeout(400); await foto('5-inventario', '#inventario');
  await toca('#inventario [data-fechar]'); await p.waitForTimeout(300);
  await toca('#bt-menu'); await p.waitForTimeout(400); await foto('6-pausa', '#pausa');
  await p.evaluate(() => document.querySelector('#pausa .caixa').scrollTop = 99999); await foto('6b-pausa-fim', '#pausa');
  if (await p.isVisible('#bt-editar-mundo')) { await toca('#bt-editar-mundo'); await p.waitForTimeout(400); await foto('7-editar', '#editar-mundo'); await toca('#e-cancelar'); await p.waitForTimeout(300); }
  if (await p.isVisible('#bt-personagem3')) { await p.evaluate(() => document.querySelector('#bt-personagem3').scrollIntoView()); await toca('#bt-personagem3'); await p.waitForTimeout(900); await foto('8-personagem', '#personagem'); await toca('#pers-cancelar'); await p.waitForTimeout(300); }
  if (await p.isVisible('#pausa [data-fechar]')) { await p.evaluate(() => document.querySelector('#pausa [data-fechar]').scrollIntoView()); await toca('#pausa [data-fechar]'); await p.waitForTimeout(300); }
  await toca('#bt-comandos'); await p.waitForTimeout(400); await foto('9-comandos', '#comandos');
  await p.evaluate(() => document.querySelector('#comandos [data-fechar-cmd]').click()); await p.waitForTimeout(300);
  await toca('#minimapa'); await p.waitForTimeout(500); await foto('10-mapa', '#mapa'); await toca('#mapa-fechar');
  r.erros = erros;
  await ctx.close();
}
console.log(JSON.stringify(relatorio, null, 1));
await b.close();

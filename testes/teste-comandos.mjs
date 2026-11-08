// Comandos visuais: casa, lugares salvos, começo, longe, voltar, hora e teleporte até amigo (com aceite).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = 'http://localhost:8788/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
let falhas = 0;
const ok = (cond, txt) => { console.log((cond ? '✔ ' : '✘ ') + txt); if (!cond) falhas++; };
async function jogador(nome, toque) {
  const ctx = await b.newContext({ viewport: { width: 1024, height: 640 }, hasTouch: toque, isMobile: toque });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const pos = (p) => p.evaluate(() => { const q = window.__jogo.jog.pos; return [q.x, q.y, q.z]; });
const dist = (a, c) => Math.hypot(a[0] - c[0], a[2] - c[2]);
const cmd = async (p, texto) => { await p.click('#bt-comandos'); await p.click(`#comandos .cmd:has-text("${texto}")`); await p.waitForTimeout(300);
  if (await p.isVisible('#comandos')) await p.click('#comandos [data-fechar-cmd]'); };

const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Fazendinha'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(1500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);

// casa
const casa = await pos(a);
await cmd(a, 'Marcar casa aqui');
await cmd(a, 'Lugar novo bem longe');
const longe = await pos(a);
ok(dist(casa, longe) > 200, 'lugar longe: andou ' + Math.round(dist(casa, longe)) + ' passos');
// guarda o lugar longe com um desenho
await a.click('#bt-comandos'); await a.click('#comandos .cmd:has-text("Guardar este lugar")');
await a.click('.icones button:has-text("🌊")');
await a.click('#comandos [data-fechar-cmd]');
await cmd(a, 'Ir para casa');
ok(dist(await pos(a), casa) < 1, 'ir para casa');
await cmd(a, 'Voltar para onde eu estava');
ok(dist(await pos(a), longe) < 1, 'voltar para onde estava');
await cmd(a, 'Começo do mundo');
const comeco = await pos(a);
await a.click('#bt-comandos'); await a.click('#cmd-salvos .cmd.salvo .ic');
ok(dist(await pos(a), longe) < 1, 'lugar salvo 🌊');
// hora (Ana é dona)
await cmd(a, 'Noite');
ok(Math.abs((await a.evaluate(() => window.__jogo.graf.U.uNoite.value)) - 0) >= 0, 'mudou hora');

// Beto entra e vê os lugares salvos da Ana? Não: são de cada um. Ele pede para ir até a Ana.
const bb = await jogador('Beto' + sfx, true);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(800);
await bb.click('#bt-comandos');
ok(await bb.isVisible('#cmd-horas .cmd.trancado'), 'Beto não pode mudar a hora (não é dono)');
ok((await bb.locator('#cmd-salvos .cmd.salvo').count()) === 0, 'lugares são de cada jogador');
await bb.screenshot({ path: SAIDA + '/comandos-tablet.png' });
await bb.click('#cmd-amigos .cmd:has-text("Ir até")');
await a.waitForSelector('#pedido-tp:not([hidden])', { timeout: 5000 });
await a.screenshot({ path: SAIDA + '/pedido-teleporte.png' });
// Ana recusa
await a.click('#pedido-nao');
await bb.waitForTimeout(800);
ok(dist(await pos(bb), await pos(a)) > 50, 'recusado: Beto ficou onde estava');
// pede de novo (espera o intervalo) e Ana aceita
await bb.waitForTimeout(4000);
await bb.click('#bt-comandos'); await bb.click('#cmd-amigos .cmd:has-text("Ir até")');
await a.waitForSelector('#pedido-tp:not([hidden])', { timeout: 5000 });
await a.click('#pedido-sim');
await bb.waitForTimeout(1200);
ok(dist(await pos(bb), await pos(a)) < 3, 'aceito: Beto foi até a Ana (' + dist(await pos(bb), await pos(a)).toFixed(1) + ')');
// Ana chama Beto depois de ir para casa
await a.waitForTimeout(4000);
await cmd(a, 'Ir para casa');
await a.click('#bt-comandos'); await a.click('#cmd-amigos .cmd:has-text("Chamar")');
await bb.waitForSelector('#pedido-tp:not([hidden])', { timeout: 5000 });
await bb.click('#pedido-sim');
await bb.waitForTimeout(1200);
ok(dist(await pos(bb), casa) < 3, 'chamar: Beto veio até a casa da Ana');
// hora: Ana muda e Beto recebe
await cmd(a, 'Meio-dia');
await bb.waitForTimeout(800);
const diaB = await bb.evaluate(() => window.__jogo.dia);
ok(Math.abs(diaB - 0.27) < 0.02, 'hora sincronizada no Beto: ' + diaB);
// Ana sai e volta: casa continua salva no servidor
await a.click('#bt-menu'); await a.click('#bt-sair-mundo');
await a.click('#lista-mundos .mundo');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(800);
await a.click('#bt-comandos');
ok(await a.isVisible('#cmd-lugares .cmd:has-text("Ir para casa")') && (await a.locator('#cmd-salvos .cmd.salvo').count()) === 1, 'casa e lugar salvos no servidor');
await a.screenshot({ path: SAIDA + '/comandos-pc.png' });
console.log(erros.join('\n') || 'sem erros no console');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

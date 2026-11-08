// Ilha de Aventura: cria o mundo pela tela, confere a ilha (lugares, estradas, borda),
// o pouso planando, o nome do lugar aparecendo e o mapa da ilha.
// Funciona só com os arquivos estáticos (sem internet): BASE=http://localhost:8799 (ex.: python3 -m http.server dentro de public/).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const ctx = await b.newContext({ viewport: { width: 1024, height: 700 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(BASE + '/#teste');
await p.click('#bt-sozinho');
await p.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
conferir(await p.isVisible('[data-tipo=aventura]'), 'tipo Ilha de Aventura aparece na criação');
await p.click('[data-tipo=aventura]');
conferir(await p.isHidden('#n-tamanhos'), 'ilha esconde a escolha de tamanho');
await p.screenshot({ path: SAIDA + '/ilha-criar.png' });
await p.click('#m-novo summary');
await p.fill('#n-semente', 'aventura');
await p.click('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
const info = await p.evaluate(() => {
  const m = window.__jogo.mundo, a = m.aventura;
  return { tipo: window.__jogo.opcoesMundo.tipo, limite: m.limite, lugares: a && a.lugares.map((l) => [l.tipo, l.nome, l.x, l.z]), estradas: a && a.estradas.length, planando: window.__jogo.jog.planando, y: window.__jogo.jog.pos.y, vilas: m.vilas.regiao(0, 0) };
});
console.log(JSON.stringify(info));
conferir(info.tipo === 'aventura' && info.limite === 256, 'mundo de aventura com borda 256');
conferir(info.lugares && info.lugares.length >= 10, 'ilha com 10+ lugares com nome');
conferir(info.estradas >= info.lugares.length - 1, 'estradas ligando todos os lugares');
conferir(info.planando && info.y > 50, 'começa no alto, planando');
conferir(info.vilas === null, 'sem as vilas do mundo normal');
await p.waitForTimeout(2500);
await p.screenshot({ path: SAIDA + '/ilha-planando.png' });
// pousa: segura "descer" até tocar o chão
await p.keyboard.down('Shift');
await p.waitForFunction(() => !window.__jogo.jog.planando, null, { timeout: 30000 });
await p.keyboard.up('Shift');
conferir(true, 'pousou e parou de planar');
// vai até a primeira cidade: o nome aparece
const cid = info.lugares.find((l) => l[0] === 'cidade');
await p.evaluate(([x, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.z = z + 13.5; j.pos.y = window.__jogo.mundo.chao(x, z + 13) + 2; j.yaw = 0; }, [cid[2], cid[3]]);
await p.waitForTimeout(400);
const txt = await p.evaluate(() => document.querySelector('#aviso')?.textContent || '');
conferir(txt.includes(cid[1]), 'nome da cidade aparece ao chegar: ' + txt);
for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); if (await p.evaluate(() => window.__jogo.mundo.atualizar ? true : true)) {} }
await p.evaluate(() => { window.__jogo.jog.pitch = -0.15; });
await p.waitForTimeout(3000);
await p.screenshot({ path: SAIDA + '/ilha-cidade.png' });
// visão do alto
await p.evaluate(([x, z]) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = x - 30; j.pos.z = z + 40; j.pos.y = 58; j.yaw = -0.6; j.pitch = -0.55; }, [cid[2], cid[3]]);
await p.waitForTimeout(5000);
await p.screenshot({ path: SAIDA + '/ilha-cidade-alto.png' });
// outros lugares, de cima
for (const tipo of ['porto', 'farol', 'castelo', 'fabrica', 'fazenda', 'patio', 'mirante']) {
  const L = info.lugares.find((l) => l[0] === tipo);
  if (!L) continue;
  await p.evaluate(([x, z]) => { const j = window.__jogo.jog; j.voando = true; j.pos.x = x - 18; j.pos.z = z + 26; j.pos.y = 56; j.yaw = -0.6; j.pitch = -0.5; }, [L[2], L[3]]);
  await p.waitForTimeout(4500);
  await p.screenshot({ path: SAIDA + '/ilha-' + tipo + '.png' });
}
// mapa da ilha
conferir(await p.isVisible('#bt-mapa-ilha'), 'botão do mapa aparece');
await p.click('#bt-mapa-ilha');
await p.waitForSelector('#mapa-ilha:not([hidden])');
await p.screenshot({ path: SAIDA + '/ilha-mapa.png' });
await p.click('#mapa-ilha [data-fechar]');
conferir(await p.isHidden('#mapa-ilha'), 'mapa fecha');
const fps = await p.evaluate(() => document.querySelector('#fps')?.textContent);
console.log('fps', fps);
conferir(erros.length === 0, 'sem erros no console ' + erros.join(' | '));
await b.close();
if (falhas.length) { console.log('FALHAS:', falhas); process.exit(1); }
console.log('tudo certo');

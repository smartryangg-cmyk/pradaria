// Coletar e criar online: o que se compra na loja da vila vem marcado e a marca segue o bloco no mundo.
// A Ana compra tijolos, põe um no chão e o Beto (amigo) quebra: o tijolo chega marcado para ele e os
// moradores não compram de volta. Precisa de `npm run dev:sala` e `npm run dev` (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const sfx = Date.now() % 10000;
async function jogador(nome) {
  const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('pageerror', (e) => erros.push(nome + ' ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123'); if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok'); await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])');
  return p;
}
const est = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.mercado.e)));
const a = await jogador('Ana' + sfx);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Compras'); // Coletar e criar já vem ligado
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2000);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(1000);
conferir((await est(a)).moedas >= 10 && (await a.evaluate(() => window.__jogo.mercado.op.sobrevivencia)), 'mundo com Coletar e criar e mercado');
await bb.evaluate(() => { const [id] = [...window.__jogo.mercado.ui.outros()].map((o) => o.id); window.__jogo.sala.enviar({ t: 'dar', para: id, n: 5 }); });
await a.waitForTimeout(1200);
await a.evaluate(() => window.__jogo.mercado.enviar({ t: 'comprar', b: 10 }));
await a.waitForTimeout(1200);
const ea = await est(a);
conferir(ea.itens[10] === 4 && ea.compra[10] === 4, `Ana comprou 4 tijolos e vêm marcados (${ea.itens[10]}, marca ${ea.compra[10]})`);
// vender de volta não dá
await a.evaluate(() => window.__jogo.mercado.enviar({ t: 'vender', b: 10, n: 4 }));
await a.waitForTimeout(1000);
conferir((await est(a)).itens[10] === 4, 'os moradores não compram de volta o que ela comprou');
// põe um tijolo no chão perto dos dois
const lugar = await a.evaluate(() => {
  const { jog, mundo, comoJogador } = window.__jogo; const x = Math.floor(jog.pos.x) + 2, z = Math.floor(jog.pos.z) + 1;
  let y = 94; while (y > 2 && !mundo.bloco(x, y - 1, z)) y--;
  comoJogador(() => mundo.definir(x, y, z, 10)); return [x, y, z];
});
await a.waitForTimeout(1500);
conferir((await est(a)).itens[10] === 3, 'colocar gastou um tijolo da mochila');
await bb.evaluate(([x, y, z]) => { const { jog } = window.__jogo; jog.voando = true; Object.assign(jog.pos, { x: x + 0.5, y: y + 2, z: z + 2.5 }); }, lugar);
await bb.waitForFunction(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 10, lugar, { timeout: 10000 }).catch(() => {});
const antesB = await est(bb);
await bb.evaluate(([x, y, z]) => { const { mundo, comoJogador } = window.__jogo; comoJogador(() => mundo.definir(x, y, z, 0)); }, lugar);
await bb.waitForTimeout(1500);
const depoisB = await est(bb);
conferir((depoisB.itens[10] || 0) === (antesB.itens[10] || 0) + 1, `Beto quebrou o tijolo e pegou (${depoisB.itens[10]})`);
conferir((depoisB.compra[10] || 0) === 1, `o tijolo chegou marcado como comprado (${JSON.stringify(depoisB.compra)})`);
await bb.evaluate(() => window.__jogo.mercado.enviar({ t: 'vender', b: 10, n: 1 }));
await bb.waitForTimeout(1000);
const fimB = await est(bb);
conferir(fimB.moedas === depoisB.moedas && fimB.itens[10] === 1, 'os moradores não compram do Beto o tijolo que a Ana comprou');
// e um bloco que o Beto colheu (terra natural) vende normal
const terra = await bb.evaluate(() => {
  const { jog, mundo, comoJogador } = window.__jogo; const x = Math.floor(jog.pos.x) - 3, z = Math.floor(jog.pos.z) - 3;
  let y = 94; while (y > 2 && !mundo.bloco(x, y, z)) y--;
  const b = mundo.bloco(x, y, z); comoJogador(() => mundo.definir(x, y, z, 0)); return b;
});
await bb.waitForTimeout(1200);
const colheu = await est(bb);
const cai = Object.keys(colheu.itens).map(Number).find((k) => k !== 10 && !colheu.compra[k]);
await bb.evaluate((k) => window.__jogo.mercado.enviar({ t: 'vender', b: k, n: 1 }), cai);
await bb.waitForTimeout(1000);
conferir((await est(bb)).moedas > colheu.moedas, `o que o Beto colheu (bloco ${terra} -> ${cai}) vende normal`);
console.log('erros:', erros);
conferir(!erros.length, 'sem erros no console');
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHAS` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);

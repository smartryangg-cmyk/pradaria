// Coletar e criar online: o que se compra na loja da vila vem marcado e a marca segue o bloco no mundo.
// (lã: no jogo clássico tijolo e pedra só saem com picareta, e a marca de comprado vale para qualquer bloco)
// A Ana compra lãs, põe uma no chão e o Beto (amigo) quebra: a lã chega marcada para ele e os
// moradores não compram de volta. Precisa de `npm run dev:sala` e `npm run dev` (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const sfx = Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join(''); // letras: com 4 algarismos do relógio o nome repetia entre testes e a conta não era criada
async function jogador(nome) {
  const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  p.on('pageerror', (e) => erros.push(nome + ' ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123'); if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok'); if (await p.isVisible('#c-nasc .d-ano')) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '1990'); } await p.click('#c-ok');
  await (async () => { await p.waitForSelector('#m-mundos:not([hidden]), #m-jogos:not([hidden])'); if (await p.isVisible('#m-jogos')) { await p.click('.jogo[data-jogo=pradaria]'); await p.waitForSelector('#m-mundos:not([hidden])'); } })();
  return p;
}
// o que quebra cai no chão (é preciso passar por cima para pegar): vai até cada coisa caída
const pegarDoChao = async (p) => {
  await p.waitForTimeout(1200);
  for (const d of await p.evaluate(() => window.__jogo.drops.lista())) {
    await p.evaluate((d) => { const j = window.__jogo.jog; j.voando = false; j.pos.x = d.x; j.pos.z = d.z; j.pos.y = d.y + 0.1; j.vel.x = j.vel.y = j.vel.z = 0; }, d);
    await p.waitForTimeout(500);
  }
  await p.waitForTimeout(800);
};
const est = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.mercado.e)));
const a = await jogador('Ana' + sfx);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Compras'); // Coletar e criar já vem ligado
await a.click('#m-novo [data-opcao=mercado]'); // mod (desligado nos mundos novos)
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
await a.evaluate(() => window.__jogo.mercado.enviar({ t: 'comprar', b: 14 }));
await a.waitForTimeout(1200);
const ea = await est(a);
conferir(ea.itens[14] === 4 && ea.compra[14] === 4, `Ana comprou 4 lãs e vêm marcados (${ea.itens[14]}, marca ${ea.compra[14]})`);
// vender de volta não dá
await a.evaluate(() => window.__jogo.mercado.enviar({ t: 'vender', b: 14, n: 4 }));
await a.waitForTimeout(1000);
conferir((await est(a)).itens[14] === 4, 'os moradores não compram de volta o que ela comprou');
// põe uma lã no chão perto dos dois
const lugar = await a.evaluate(() => {
  const { jog, mundo, comoJogador } = window.__jogo; const x = Math.floor(jog.pos.x) + 2, z = Math.floor(jog.pos.z) + 1;
  let y = 94; while (y > 2 && !mundo.bloco(x, y - 1, z)) y--;
  comoJogador(() => mundo.definir(x, y, z, 14)); return [x, y, z];
});
await a.waitForTimeout(1500);
conferir((await est(a)).itens[14] === 3, 'colocar gastou uma lã da mochila');
await bb.evaluate(([x, y, z]) => { const { jog } = window.__jogo; jog.voando = true; Object.assign(jog.pos, { x: x + 0.5, y: y + 2, z: z + 2.5 }); }, lugar);
await bb.waitForFunction(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 14, lugar, { timeout: 10000 }).catch(() => {});
const antesB = await est(bb);
await bb.evaluate(([x, y, z]) => { const { mundo, comoJogador } = window.__jogo; comoJogador(() => mundo.definir(x, y, z, 0)); }, lugar);
await pegarDoChao(bb);
const depoisB = await est(bb);
conferir((depoisB.itens[14] || 0) === (antesB.itens[14] || 0) + 1, `Beto quebrou a lã e pegou (${depoisB.itens[14]})`);
conferir((depoisB.compra[14] || 0) === 1, `a lã chegou marcado como comprado (${JSON.stringify(depoisB.compra)})`);
await bb.evaluate(() => window.__jogo.mercado.enviar({ t: 'vender', b: 14, n: 1 }));
await bb.waitForTimeout(1000);
const fimB = await est(bb);
conferir(fimB.moedas === depoisB.moedas && fimB.itens[14] === 1, 'os moradores não compram do Beto a lã que a Ana comprou');
// e um bloco que o Beto colheu (terra natural) vende normal
const terra = await bb.evaluate(() => {
  // o bloco de cima de uma coluna perto que seja chão que a mão quebra (grama, terra ou areia): água, folha, plantinha ou
  // pedra sem picareta não dão nada para vender (o teste caía quando o Beto estava perto de um lago). Perto mesmo:
  // a sala só acredita em bloco do mundo quebrado a até 10 blocos de quem quebrou
  const { jog, mundo, comoJogador } = window.__jogo, px = Math.floor(jog.pos.x), pz = Math.floor(jog.pos.z), lugares = [];
  for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) { const r = Math.hypot(dx, dz); if (r >= 2 && r <= 6) lugares.push([r, px + dx, pz + dz]); }
  lugares.sort((p, q) => p[0] - q[0]);
  for (const [, x, z] of lugares) {
    let y = 94; while (y > 2 && !mundo.bloco(x, y, z)) y--;
    const b = mundo.bloco(x, y, z); if (![1, 2, 4].includes(b)) continue;
    comoJogador(() => mundo.definir(x, y, z, 0)); return b;
  }
  return null;
});
for (let t = 0; t < 4; t++) { // o que caiu pode demorar a aparecer no aparelho lento
  await pegarDoChao(bb);
  if (Object.keys((await est(bb)).itens).some((k) => k !== '14')) break;
}
const colheu = await est(bb);
const cai = Object.keys(colheu.itens).map(Number).find((k) => k !== 14 && !colheu.compra[k]);
await bb.evaluate((k) => window.__jogo.mercado.enviar({ t: 'vender', b: k, n: 1 }), cai);
await bb.waitForTimeout(1000);
conferir((await est(bb)).moedas > colheu.moedas, `o que o Beto colheu (bloco ${terra} -> ${cai}) vende normal`);
console.log('erros:', erros);
conferir(!erros.length, 'sem erros no console');
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHAS` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);

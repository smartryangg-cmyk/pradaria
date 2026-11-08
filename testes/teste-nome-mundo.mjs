// Nome sugerido ao criar mundo: "Mundo 01", "Mundo 02"... (próximo número livre), e o jogador pode trocar.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
async function jogador(nome, tablet) {
  const ctx = await b.newContext(tablet ? { viewport: { width: 800, height: 1100 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
async function criar(p, nomeNovo, foto) {
  await p.click('#bt-novo-mundo');
  await p.waitForSelector('#m-novo:not([hidden])');
  const sugerido = await p.inputValue('#n-nome');
  if (foto) await p.screenshot({ path: foto });
  if (nomeNovo) await p.fill('#n-nome', nomeNovo);
  await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  const nomeNoJogo = await p.evaluate(() => window.__jogo.mundoAtual?.()?.nome ?? null);
  // sai do mundo pelo menu (botão de menu na tela) e volta para a lista
  await p.click('#bt-menu');
  await p.click('#bt-sair-mundo');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return { sugerido, nomeNoJogo };
}
const sfx = Date.now() % 10000;
for (const [rot, tablet] of [['pc', false], ['tablet', true]]) {
  const p = await jogador((tablet ? 'Tab' : 'Pc') + sfx, tablet);
  const r1 = await criar(p, null, `${SAIDA}/${rot}-1-sugere-mundo01.png`);
  conferir(r1.sugerido === 'Mundo 01', `${rot}: primeiro mundo sugere "Mundo 01" (${r1.sugerido})`);
  const r2 = await criar(p, null, `${SAIDA}/${rot}-2-sugere-mundo02.png`);
  conferir(r2.sugerido === 'Mundo 02', `${rot}: segundo sugere "Mundo 02" (${r2.sugerido})`);
  // o jogador troca o nome: aceita o nome escolhido
  const r3 = await criar(p, 'Casa do Vovo', `${SAIDA}/${rot}-3-sugere-mundo03.png`);
  conferir(r3.sugerido === 'Mundo 03', `${rot}: terceiro sugere "Mundo 03" (${r3.sugerido})`);
  const nomes = await p.$$eval('#lista-mundos .mundo b', (bs) => bs.map((x) => x.textContent));
  conferir(nomes.includes('Casa do Vovo') && nomes.includes('Mundo 01') && nomes.includes('Mundo 02'), `${rot}: lista tem Mundo 01, Mundo 02 e o nome trocado (${nomes.join(', ')})`);
  // como "Mundo 03" não foi usado, ele continua livre
  await p.click('#bt-novo-mundo');
  await p.waitForSelector('#m-novo:not([hidden])');
  conferir(await p.inputValue('#n-nome') === 'Mundo 03', `${rot}: "Mundo 03" segue livre depois do nome trocado`);
  await p.screenshot({ path: `${SAIDA}/${rot}-4-lista-e-sugestao.png` });
  // código de amigo não vem preenchido
  await p.click('[data-voltar-mundos]');
  await p.waitForSelector('#m-mundos:not([hidden])');
  await p.screenshot({ path: `${SAIDA}/${rot}-5-lista.png` });
  await p.click('#bt-codigo');
  conferir(await p.inputValue('#n-nome') === '', `${rot}: entrar por código não vem preenchido`);
}
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros no console');
await b.close();
if (falhas.length || erros.length) process.exit(1);

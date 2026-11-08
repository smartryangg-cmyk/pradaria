// Mercado e objetivos sem internet: coloca blocos (cumpre objetivo), quebra (coleta), conversa com aldeão (loja), vende e compra.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const URL = process.env.URL || 'http://localhost:8765/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1024, height: 640 } })).newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
const falhas = [];
const conferir = (ok, txt) => { console.log((ok ? 'ok  ' : 'FALHOU ') + txt); if (!ok) falhas.push(txt); };
await p.goto(URL);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pradaria.local', JSON.stringify({ semente: 12345, edicoes: [], opcoes: { mercado: true, objetivos: true } })); });
await p.reload();
await p.click('#bt-sozinho');
await p.waitForTimeout(3500);
const est = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.mercado.e)));
conferir((await est()).moedas === 10, 'começa com 10 moedas');
conferir(await p.isVisible('#econ .econ-alvo'), 'objetivo aparece no HUD');
await p.screenshot({ path: SAIDA + '/mercado-hud.png' });
// coloca 10 blocos de grama empilhados no alto
await p.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  const x = Math.floor(jog.pos.x) + 3, z = Math.floor(jog.pos.z);
  for (let i = 0; i < 10; i++) mundo.definir(x, 52 + i, z, 1);
});
await p.waitForTimeout(300);
let e = await est();
conferir(e.feitos.includes('colocar10') && e.moedas === 15, 'cumpriu "coloque 10 blocos" e ganhou 5 moedas (' + e.moedas + ')');
conferir((e.cont.alto || 0) >= 1, 'contou bloco no alto');
await p.screenshot({ path: SAIDA + '/mercado-festa.png' });
// quebra 3 blocos naturais (coleta) e 1 colocado (não coleta)
await p.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  const x = Math.floor(jog.pos.x) + 3, z = Math.floor(jog.pos.z);
  mundo.definir(x, 61, z, 0); // colocado
  for (let i = 0; i < 3; i++) { const h = mundo.alturaEm(x + 2 + i, z); mundo.definir(x + 2 + i, h, z, 0); }
});
e = await est();
const qtd = Object.values(e.itens).reduce((a, n) => a + n, 0);
conferir(qtd === 3, 'coletou 3 itens só dos blocos naturais (' + JSON.stringify(e.itens) + ')');
// bloco trancado não coloca
const tranc = await p.evaluate(() => window.__jogo.mercado.podeColocar(9));
conferir(!tranc, 'vidro começa trancado');
// conversa com aldeão: abre a loja
await p.evaluate(() => {
  const { aldeoes, jog, mundo } = window.__jogo;
  const v = mundo.vilas.regiao(0, 0);
  jog.voando = true; Object.assign(jog.pos, { x: v.x + 0.5, y: mundo.alturaEm(v.x, v.z) + 3, z: v.z + 0.5 });
});
await p.waitForTimeout(3000);
const temAldeao = await p.evaluate(() => window.__jogo.aldeoes.lista.length);
if (temAldeao) {
  await p.evaluate(() => window.__jogo.conversarCom(window.__jogo.aldeoes.lista[0]));
  await p.waitForTimeout(1200);
  conferir(await p.isVisible('#loja'), 'tocar no aldeão abre a loja');
} else { await p.evaluate(() => window.__jogo.mercado.abrirLoja(null)); console.log('(sem aldeão perto, abri a loja direto)'); }
await p.screenshot({ path: SAIDA + '/mercado-vender.png' });
await p.click('#loja .econ-linha .bt.verde');
await p.waitForTimeout(200);
e = await est();
conferir(e.moedas > 15 && (e.cont.vender || 0) >= 1, 'vendeu (moedas ' + e.moedas + ')');
await p.click('#loja .econ-abas .bt:nth-child(2)');
await p.screenshot({ path: SAIDA + '/mercado-comprar.png' });
await p.evaluate(() => { window.__jogo.mercado.e.moedas = 100; });
await p.click('#loja .econ-linha:nth-child(2) .bt');
await p.waitForTimeout(200);
conferir(await p.evaluate(() => window.__jogo.mercado.podeColocar(9)), 'comprou o vidro');
await p.click('#loja .caixa > .bt');
await p.click('#econ .econ-alvo');
await p.waitForTimeout(300);
await p.screenshot({ path: SAIDA + '/mercado-objetivos.png' });
conferir(await p.isVisible('#objetivos'), 'janela de objetivos abre');
await p.click('#objetivos .caixa > .bt');
await p.click('#econ .econ-chip');
await p.screenshot({ path: SAIDA + '/mercado-mochila.png' });
await p.click('#mochila .caixa > .bt');
await p.click('#barra .mais');
await p.screenshot({ path: SAIDA + '/mercado-inventario.png' });
// guardou no aparelho
const salvo = await p.evaluate(() => JSON.parse(localStorage.getItem('pradaria.econ')));
conferir(salvo && salvo.comprados.includes(9), 'salvou no aparelho');
console.log(erros.join('\n') || 'sem erros');
await b.close();
if (falhas.length || erros.length) process.exit(1);

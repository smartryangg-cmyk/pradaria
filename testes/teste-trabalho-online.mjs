// Trabalhadores online: a Ana contrata um pedreiro (tocando num morador), marca uma casinha e a SALA constrói
// bloco a bloco; o Beto, no mesmo mundo, vê a casa subir; o salário sai das moedas da Ana; tudo fica salvo.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const sfx = Date.now() % 10000;
async function jogador(nome, tablet) {
  const ctx = tablet ? await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true }) : await b.newContext({ viewport: { width: 1180, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123'); if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok'); await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])');
  return p;
}
const est = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.mercado.e)));
const a = await jogador('Ana' + sfx);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Obras');
await a.click('[data-opcao=sobrevivencia]'); // desliga o Coletar e criar: blocos à vontade (a marca de comprado é testada em teste-compra-online)
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
// junta moedas: missão de colocar 10 blocos (+5) e presente do Beto (+10)
await a.evaluate(() => {
  const { mundo: m0, jog, comoJogador } = window.__jogo; const x = Math.floor(jog.pos.x) + 3, z = Math.floor(jog.pos.z);
  for (let i = 0; i < 10; i++) comoJogador(() => m0.definir(x, 70 + i, z, 1));
});
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(1000);
await bb.evaluate(() => { const [id] = [...window.__jogo.mercado.ui.outros()].map((o) => o.id); window.__jogo.sala.enviar({ t: 'dar', para: id, n: 10 }); });
await a.waitForTimeout(1500);
let e = await est(a);
conferir(e.moedas === 25, 'Ana juntou 25 moedas (' + e.moedas + ')');
// de manhã (só o dono muda a hora)
await a.evaluate(() => window.__jogo.sala.enviar({ t: 'dia', v: 0.1 }));
await a.waitForTimeout(800);
// vai até um morador e contrata pela loja
// a vila mais perto do começo (a semente é sorteada: nem sempre tem vila na região 0,0)
await a.evaluate(() => {
  const { mundo } = window.__jogo; let melhor = null;
  for (let rx = -2; rx <= 2; rx++) for (let rz = -2; rz <= 2; rz++) { const v = mundo.vilas.regiao(rx, rz); if (v && (!melhor || Math.hypot(v.x, v.z) < Math.hypot(melhor.x, melhor.z))) melhor = v; }
  window.__vila = melhor;
});
await a.evaluate(() => { const { jog, mundo } = window.__jogo; const v = window.__vila; Object.assign(jog.pos, { x: v.x + 3.5, y: mundo.alturaEm(v.x + 3, v.z) + 2, z: v.z + 0.5 }); });
await a.waitForTimeout(3500);
await a.evaluate(() => window.__jogo.conversarCom(window.__jogo.aldeoes.lista[0]));
await a.waitForTimeout(1200);
const antesContratar = (await est(a)).moedas; // conversar com o morador pode dar prêmio de missão
await a.click('#loja .econ-abas .bt:nth-child(3)');
await a.click('#loja [data-oficio="pedreiro"]');
await a.waitForTimeout(1200);
e = await est(a);
conferir(e.equipe.length === 1 && e.equipe[0].of === 'pedreiro' && e.moedas === antesContratar - 12, `sala contratou o pedreiro e cobrou 12 (${antesContratar} -> ${e.moedas})`);
await a.click('#loja .caixa > .bt');
// lugar plano longe da vila
await a.evaluate(() => {
  const { jog, mundo } = window.__jogo; const v = window.__vila;
  for (let r = v.raio + 10; r < v.raio + 70; r += 3) for (let k = 0; k < 16; k++) {
    const x = Math.round(v.x + Math.cos(k / 16 * 6.283) * r), z = Math.round(v.z + Math.sin(k / 16 * 6.283) * r);
    const h = mundo.alturaEm(x, z); let pior = 0;
    for (let dx = -2; dx <= 10; dx += 2) for (let dz = -5; dz <= 5; dz += 2) pior = Math.max(pior, Math.abs(mundo.alturaEm(x + dx, z + dz) - h));
    if (pior <= 1 && h > mundo.nivelAgua + 1) { Object.assign(jog.pos, { x: x + 0.5, y: h + 1.2, z: z + 0.5 }); jog.yaw = -Math.PI / 2; jog.pitch = -0.25; return; }
  }
});
await a.waitForTimeout(2500);
await a.click('#bt-negocios');
await a.click('#negocios [data-aba="obras"]');
await a.click('#negocios [data-planta="casinha"]');
await a.waitForTimeout(800);
await a.click('#obra-escolha .bt.verde');
await a.waitForTimeout(1500);
e = await est(a);
conferir(e.obras.length === 1, 'sala aceitou a obra ' + JSON.stringify(e.obras[0]));
conferir(await a.isHidden('#obra-escolha'), 'a barra de escolher lugar fechou');
const obra = e.obras[0];
// o Beto vai ver
await bb.evaluate((o) => { const { jog } = window.__jogo; jog.voando = true; Object.assign(jog.pos, { x: o.x - 8.5, y: o.y + 6, z: o.z + 0.5 }); jog.yaw = -Math.PI / 2; jog.pitch = -0.35; }, obra);
const conta = (p, o) => p.evaluate(async (o) => {
  const { blocosDaObra } = await import('/js/casas.js');
  const l = blocosDaObra(o); let certos = 0, reais = 0;
  for (const [x, y, z, b] of l) { if (!b) continue; reais++; if (window.__jogo.mundo.bloco(x, y, z) === b) certos++; }
  return { certos, reais };
}, o);
await a.waitForTimeout(30000);
const meio = await conta(bb, obra);
conferir(meio.certos > 10 && meio.certos < meio.reais, `no meio da obra o Beto já vê ${meio.certos} de ${meio.reais} blocos`);
await bb.screenshot({ path: SAIDA + '/online-beto-obra-meio.png' });
await a.waitForFunction(() => !window.__jogo.mercado.e.obras.length, null, { timeout: 150000, polling: 2000 });
await a.waitForTimeout(2000);
const fim = await conta(bb, obra), fimA = await conta(a, obra);
conferir(fim.certos === fim.reais, `Beto vê a casinha inteira: ${fim.certos}/${fim.reais}`);
conferir(fimA.certos === fimA.reais, `Ana vê a casinha inteira: ${fimA.certos}/${fimA.reais}`);
await bb.screenshot({ path: SAIDA + '/online-beto-obra-pronta.png' });
e = await est(a);
// o 1º dia foi pago na contratação: o tempo trabalhado vai gastando esse adiantamento (deve sobe de -12)
conferir(e.equipe[0].deve > -12 && e.equipe[0].feito >= fim.reais, `o pedreiro trabalhou por conta do salário (deve ${e.equipe[0].deve.toFixed(1)}) e fez ${e.equipe[0].feito} blocos`);
// sai e volta: a casa e a equipe continuam
await bb.reload();
await bb.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 }).catch(() => {});
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.mundo, null, { timeout: 20000 });
await bb.waitForTimeout(2000);
const volta = await conta(bb, obra);
conferir(volta.certos === volta.reais, `depois de sair e voltar a casinha continua lá (${volta.certos}/${volta.reais})`);
// trapaça: mandar obra longe de onde está
await a.evaluate(() => window.__jogo.mercado.enviar({ t: 'obra', p: 'casa', e: 'madeira', x: 9000, y: 30, z: 9000, r: 0 }));
await a.waitForTimeout(800);
conferir((await est(a)).obras.length === 0, 'sala recusa obra longe do jogador');
// griefing: obra em cima da casa pronta (ou de qualquer bloco que alguém pôs) a sala recusa
await a.evaluate((o) => { const { jog } = window.__jogo; Object.assign(jog.pos, { x: o.x + 0.5, y: o.y + 6, z: o.z - 3.5 }); }, obra);
await a.waitForTimeout(1500);
await a.evaluate((o) => window.__jogo.mercado.enviar({ t: 'obra', p: 'casinha', e: 'pedra', x: o.x + 2, y: o.y, z: o.z + 1, r: 0, comprar: true }), obra);
await a.waitForTimeout(1500);
conferir((await est(a)).obras.length === 0, 'sala recusa obra por cima de uma construção');
const casaDepois = await conta(bb, obra);
conferir(casaDepois.certos === casaDepois.reais, `a casinha continua inteira (${casaDepois.certos}/${casaDepois.reais})`);
console.log('erros:', erros);
conferir(!erros.length, 'sem erros no console');
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHAS` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);

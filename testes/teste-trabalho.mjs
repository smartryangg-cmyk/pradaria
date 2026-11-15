// Trabalhadores e casas reais (sem internet): contrata um pedreiro pela loja da vila (toques de verdade),
// marca uma obra pela janela "Meus negócios", vê a casa subir bloco a bloco, depois padaria + padeiro + loja + lojista.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const URL = process.env.URL || 'http://localhost:8765/#teste';
const TABLET = !!process.env.TABLET;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = TABLET
  ? await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
  : await b.newContext({ viewport: { width: 1280, height: 760 } });
const p = await ctx.newPage();
const erros = []; p.on('pageerror', (e) => erros.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
const falhas = [];
const conferir = (ok, txt) => { console.log((ok ? 'ok  ' : 'FALHOU ') + txt); if (!ok) falhas.push(txt); };
const tocar = (sel) => (TABLET ? p.tap(sel) : p.click(sel));
const foto = (n) => p.screenshot({ path: `${SAIDA}/${TABLET ? 'tablet' : 'pc'}-${n}.png` });
await p.goto(URL);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('pradaria.local', JSON.stringify({ semente: 4242, edicoes: [], opcoes: { mercado: true, objetivos: true, vilas: true, sobrevivencia: false, cicloDia: true, animais: true, gerador: 'classico', tamanho: 'medio' }, dia: 0.1 })); });
await p.reload();
await tocar('#bt-sozinho');
await p.waitForTimeout(4000);
const est = () => p.evaluate(() => JSON.parse(JSON.stringify(window.__jogo.mercado.e)));
await p.evaluate(() => { window.__jogo.mercado.e.moedas = 300; window.__jogo.mercado.salvarLocal(); window.__jogo.dia = 0.1; });
conferir(await p.isVisible('#bt-negocios'), 'botão Meus negócios aparece com o mercado ligado');
// vai até a vila e toca num morador
const vila = await p.evaluate(() => {
  const { jog, mundo } = window.__jogo;
  const v = mundo.vilas.regiao(0, 0);
  Object.assign(jog.pos, { x: v.x + 0.5, y: mundo.alturaEm(v.x, v.z) + 2, z: v.z + 0.5 });
  return { nome: v.nome, casas: v.casas.map((c) => c.planta || c.tipo), padaria: !!v.padaria, loja: !!v.loja };
});
console.log('vila', JSON.stringify(vila));
conferir(vila.padaria && vila.loja, 'a vila tem padaria e loja');
await p.waitForTimeout(3500);
await foto('vila');
const nAld = await p.evaluate(() => window.__jogo.aldeoes.lista.length);
conferir(nAld > 0, 'tem moradores na vila: ' + nAld);
await p.evaluate(() => window.__jogo.conversarCom(window.__jogo.aldeoes.lista[0]));
await p.waitForTimeout(1200);
await tocar('#loja .econ-abas .bt:nth-child(3)');
await p.waitForTimeout(300);
await foto('contratar');
await tocar('#loja [data-oficio="pedreiro"]');
await p.waitForTimeout(400);
let e = await est();
conferir(e.equipe.length === 1 && e.equipe[0].of === 'pedreiro', 'contratou pedreiro: ' + (e.equipe[0] && e.equipe[0].nome));
conferir(e.moedas <= 300 - 12 + 5 && e.moedas >= 300 - 12, 'pagou o primeiro dia (' + e.moedas + ')');
await tocar('#loja .caixa > .bt');
// sai da vila para um lugar plano e abre Meus negócios
const lugar = await p.evaluate(() => {
  const { jog, mundo } = window.__jogo;
  const v = mundo.vilas.regiao(0, 0);
  for (let r = v.raio + 10; r < v.raio + 60; r += 3) for (let a = 0; a < 16; a++) {
    const x = Math.round(v.x + Math.cos(a / 16 * 6.283) * r), z = Math.round(v.z + Math.sin(a / 16 * 6.283) * r);
    const h = mundo.alturaEm(x, z); let pior = 0;
    for (let dx = -2; dx <= 12; dx += 2) for (let dz = -6; dz <= 6; dz += 2) pior = Math.max(pior, Math.abs(mundo.alturaEm(x + dx, z + dz) - h));
    if (pior <= 1 && h > mundo.nivelAgua + 1) { Object.assign(jog.pos, { x: x + 0.5, y: h + 1.2, z: z + 0.5 }); jog.yaw = -Math.PI / 2; jog.pitch = -0.3; return { x, z, h }; }
  }
  return null;
});
conferir(!!lugar, 'achou lugar plano para construir ' + JSON.stringify(lugar));
await p.waitForTimeout(2500);
await tocar('#bt-negocios');
await p.waitForTimeout(400);
await foto('negocios-equipe');
await tocar('#negocios [data-aba="obras"]');
await p.waitForTimeout(300);
await foto('negocios-obras');
await tocar('#negocios [data-planta="casa"]');
await p.waitForTimeout(800);
conferir(await p.isVisible('#obra-escolha'), 'mostra o fantasma da obra para escolher o lugar');
await foto('escolher-lugar');
await tocar('#obra-escolha .bt.verde');
await p.waitForTimeout(500);
e = await est();
conferir(e.obras.length === 1, 'obra marcada: ' + JSON.stringify(e.obras[0]));
// o tempo passa: turnos de verdade a cada 3 s; acelera chamando mais turnos
const total = await p.evaluate(() => window.__jogo.blocosObra ? 0 : 0);
for (let k = 0; k < 8; k++) { await p.waitForTimeout(3100); }
e = await est();
conferir(e.obras.length === 1 && e.obras[0].i > 30, 'pedreiro já colocou blocos sozinho em ~25 s: ' + (e.obras[0] && e.obras[0].i));
await foto('obra-subindo');
await p.evaluate(() => { for (let i = 0; i < 80; i++) window.__jogo.mercado.turno(5, 12); });
e = await est();
conferir(e.obras.length === 0, 'casa pronta');
await p.evaluate(() => { const j = window.__jogo.jog; j.pos.y += 6; j.pitch = -0.5; });
await p.waitForTimeout(2500);
await foto('casa-pronta');
// confere os blocos no mundo: parede, porta, camas
const conf = await p.evaluate(() => {
  const { mundo } = window.__jogo; const ed = mundo.listarEdicoes();
  return { edicoes: ed.length };
});
conferir(conf.edicoes > 300, 'blocos da casa estão no mundo e salvos: ' + conf.edicoes);
// padaria + padeiro + loja + lojista
await p.evaluate(() => { const m = window.__jogo.mercado; m.e.itens[32] = 40; m.e.moedas = 300; });
await p.evaluate(() => { const { jog } = window.__jogo; jog.pos.x += 14; });
await p.waitForTimeout(1500);
await tocar('#bt-negocios');
await tocar('#negocios [data-aba="obras"]');
await tocar('#negocios [data-planta="padaria"]');
await p.waitForTimeout(600);
await tocar('#obra-escolha .bt.verde');
await p.waitForTimeout(300);
e = await est();
conferir(e.obras.length === 1 && e.obras[0].p === 'padaria', 'padaria marcada');
await p.evaluate(() => { for (let i = 0; i < 80; i++) window.__jogo.mercado.turno(5, 12); });
e = await est();
conferir(!!e.neg.padaria, 'padaria pronta e registrada');
await p.evaluate(() => { const m = window.__jogo.mercado; m.enviar({ t: 'contratar', of: 'padeiro' }); m.enviar({ t: 'depositar', onde: 'padaria', b: 32, n: 40 }); });
e = await est();
conferir(e.neg.trigo === 40, 'deixou 40 trigos na padaria');
await p.evaluate(() => { for (let i = 0; i < 12; i++) window.__jogo.mercado.turno(5, 12); });
e = await est();
conferir(e.neg.pao >= 3 && e.neg.trigo <= 34, `padeiro assou ${e.neg.pao} pães (trigo ${e.neg.trigo})`);
// loja: ferramenta gasta não vai para a vitrine (senão voltava nova: conserto de graça)
await p.evaluate(() => { const m = window.__jogo.mercado; m.e.itens[32] = 40; m.e.moedas = 300; m.e.obrasT = []; window.__jogo.jog.pos.x += 14; }); // o pedreiro só começa 4 obras por hora
await p.waitForTimeout(1500);
// procura um chão plano o bastante para a loja (anda e tenta de novo)
for (let tent = 0; tent < 8 && !(await est()).obras.some((o) => o.p === 'loja'); tent++) {
  if (tent) await p.evaluate((t) => { const J = window.__jogo; J.jog.pos.x += (t % 2 ? 9 : 0); J.jog.pos.z += (t % 2 ? 0 : 9); J.jog.pos.y = J.mundo.alturaEm(Math.floor(J.jog.pos.x), Math.floor(J.jog.pos.z)) + 2; }, tent);
  await p.waitForTimeout(800);
  if (!(await p.isVisible('#negocios [data-planta="loja"]'))) { if (await p.isVisible('#negocios')) await tocar('#negocios .caixa > .bt'); await tocar('#bt-negocios'); await tocar('#negocios [data-aba="obras"]'); }
  await tocar('#negocios [data-planta="loja"]');
  await p.waitForTimeout(600); await tocar('#obra-escolha .bt.verde'); await p.waitForTimeout(300);
  if (!(await est()).obras.some((o) => o.p === 'loja') && await p.isVisible('#obra-escolha')) await tocar('#obra-escolha .bt:last-child');
}
await p.evaluate(() => { for (let i = 0; i < 120; i++) window.__jogo.mercado.turno(5, 12); });
e = await est();
conferir(!!e.neg.loja, 'loja pronta e registrada');
await p.evaluate(() => { const J = window.__jogo, L = J.mercado.e.neg.loja; Object.assign(J.jog.pos, { x: L.x + 0.5, z: L.z + 0.5, y: J.mundo.alturaEm(L.x, L.z) + 2 }); const m = J.mercado.e; m.itens[1002] = 2; m.desg = { 1002: [30] }; });
await p.waitForTimeout(500);
await p.evaluate(() => window.__jogo.mercado.enviar({ t: 'depositar', onde: 'loja', b: 1002, n: 2 }));
e = await est();
conferir(e.neg.vitrine[1002] === 1 && e.itens[1002] === 1 && e.desg[1002][0] === 30, `só a picareta nova foi para a vitrine; a gasta ficou na mochila (vitrine ${e.neg.vitrine[1002]}, mochila ${e.itens[1002]}, desgaste ${JSON.stringify(e.desg)})`);
const aviso = await p.evaluate(() => { window.__avisos = []; const m = window.__jogo.mercado; const r = m.enviar({ t: 'depositar', onde: 'loja', b: 1002, n: 1 }); return r; });
e = await est();
conferir(e.neg.vitrine[1002] === 1 && e.itens[1002] === 1 && e.desg[1002][0] === 30, 'a picareta gasta não vai para a vitrine');
const txt = await p.evaluate(() => document.body.innerText);
conferir(/Ferramenta usada não vai para a vitrine/.test(txt), 'aviso: Ferramenta usada não vai para a vitrine');
await p.evaluate(() => window.__jogo.mercado.enviar({ t: 'retirar', onde: 'loja', b: 1002, n: 1 }));
e = await est();
conferir(e.itens[1002] === 2 && e.desg[1002][0] === 30 && !(e.desg[1002][1] > 0), 'pegou de volta a nova; a gasta continua gasta');
await tocar('#bt-negocios');
await tocar('#negocios [data-aba="padaria"]');
await p.waitForTimeout(300);
await foto('negocios-padaria');
await tocar('#negocios .caixa > .bt');
console.log('erros:', erros.slice(0, 8));
conferir(!erros.length, 'sem erros no console');
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHAS` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);

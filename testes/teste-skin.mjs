// Personagem (skin), jogando de verdade:
// 1) PC sem conta: abre "Meu personagem", mexe em todas as abas (corpo, rosto, peças de roupa, acessórios,
//    cor livre e régua de tom de pele), guarda modelos, salva e se vê no jogo.
// 2) Online: Ana (PC) monta e guarda modelos na conta. Beto (celular, toque) monta o dele e entra pelo código.
//    Cada um vê o outro igual. Ana troca para um modelo guardado pela pausa e o Beto vê na hora.
//    Ana recarrega (sem nada no aparelho): personagem e modelos voltam da conta.
// 3) Tablet: editor e aba de modelos com toque (prints).
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
let falhas = 0;
const ok = (c, t) => { console.log(c ? 'OK  ' : 'FALHA', t); if (!c) falhas++; };
const letras = () => Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join('');
async function pagina(nome, opc) {
  const ctx = await b.newContext(opc || { viewport: { width: 1280, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(600);
  return p;
}
async function criarConta(p, nome, tocar) {
  const t = (s) => (tocar ? p.tap(s) : p.click(s));
  await t('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await t('#c-ok');
  await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 15000 });
}
const irMundos = async (p, tocar) => { if (await p.isVisible('#m-jogos')) { await p[tocar ? 'tap' : 'click']('.jogo[data-jogo=pradaria]'); } await p.waitForSelector('#m-mundos:not([hidden])'); };
const aba = (p, tocar, id) => p[tocar ? 'tap' : 'click'](`.pers-aba[data-aba=${id}]`);
const estilo = async (p, tocar, campo, texto) => p.locator(`.pers-estilo[data-campo=${campo}]`, { hasText: new RegExp('^' + texto + '$') }).first()[tocar ? 'tap' : 'click']();
const cor = (p, tocar, campo, i) => p[tocar ? 'tap' : 'click'](`.pers-cores button[data-campo=${campo}][data-valor="${i}"]`);
const corLivre = (p, campo, hex) => p.locator(`.pers-livre input[data-campo=${campo}]`).fill(hex);
const skinV = (p) => p.evaluate(() => window.__jogo.personagem.skin);
const LIVRE = 0x1000000;

// ---------- 1) PC, sem conta ----------
const g = await pagina('Visitante');
await g.click('#bt-personagem');
await g.waitForSelector('#personagem:not([hidden]) #pers-canvas');
await g.waitForTimeout(800);
ok(await g.locator('.pers-aba').count() === 7, 'PC: 7 abas (Corpo, Cabeça, Rosto, Camisa, Calça e sapato, Acessórios, Modelos)');
// corpo: altura, corpo e régua de tom de pele
await aba(g, false, 'corpo');
await estilo(g, false, 'altura', 'Bem alto'); await estilo(g, false, 'corpo', 'Forte');
await g.locator('#pers-tom').fill('820');
await g.waitForTimeout(200);
let sv = await skinV(g);
ok(sv.altura === 4 && sv.corpo === 2 && sv.pele >= LIVRE, 'PC: altura, corpo e tom de pele livre pela régua ' + (sv.pele - LIVRE).toString(16));
const esc = await g.evaluate(() => { const r = window.__jogo.personagem.boneco.raiz; return [r.scale.x, r.scale.y]; });
ok(esc[0] > 1.1 && esc[1] > 1.1, 'PC: o boneco da vitrine ficou alto e forte ' + esc.map((v) => v.toFixed(2)));
// cabeça
await aba(g, false, 'cabeca');
await estilo(g, false, 'formato', 'Redondo'); await estilo(g, false, 'cabelo', 'Moicano');
await corLivre(g, 'corCabelo', '#ff22aa');
await g.waitForTimeout(150);
// rosto
await aba(g, false, 'rosto');
await estilo(g, false, 'olhos', 'Com cílios'); await estilo(g, false, 'sobrancelha', 'Brava'); await estilo(g, false, 'boca', 'Dentinhos'); await estilo(g, false, 'rosto', 'Bigode');
// roupa por peça
await aba(g, false, 'roupa');
await estilo(g, false, 'roupa', 'Jaqueta'); await cor(g, false, 'corRoupa', 1); await estilo(g, false, 'estampa', 'Estrela'); await cor(g, false, 'corDetalhe', 3);
await aba(g, false, 'pernas');
await estilo(g, false, 'calca', 'Calça rasgada'); await cor(g, false, 'corCalca', 11); await estilo(g, false, 'sapato', 'Botas'); await cor(g, false, 'corSapato', 10);
// acessórios
await aba(g, false, 'acess');
await estilo(g, false, 'chapeu', 'Cartola'); await cor(g, false, 'corChapeu', 4);
await estilo(g, false, 'oculos', 'Redondos'); await cor(g, false, 'corOculos', 6);
await estilo(g, false, 'costas', 'Capa'); await corLivre(g, 'corCostas', '#7a1fd0');
await g.waitForTimeout(300);
sv = await skinV(g);
ok(sv.formato === 1 && sv.cabelo === 8 && sv.corCabelo === LIVRE + 0xff22aa && sv.olhos === 5 && sv.sobrancelha === 3 && sv.boca === 5 && sv.rosto === 3
  && sv.roupa === 7 && sv.estampa === 5 && sv.calca === 3 && sv.sapato === 1 && sv.chapeu === 9 && sv.oculos === 1 && sv.costas === 2 && sv.corCostas === LIVRE + 0x7a1fd0,
'PC: todas as peças escolhidas com cliques ' + JSON.stringify(sv));
await g.screenshot({ path: `${SAIDA}/pc-editor-acessorios.png` });
// modelos: guarda este, sorteia outro, guarda também, volta para o primeiro, apaga o segundo
await aba(g, false, 'modelos');
await g.fill('#pers-nome-modelo', 'Pirata');
await g.click('#pers-guardar');
await g.waitForSelector('.pers-modelo');
const pirata = await skinV(g);
await g.click('#pers-sortear');
await g.fill('#pers-nome-modelo', 'Sorteado');
await g.click('#pers-guardar');
await g.waitForFunction(() => document.querySelectorAll('.pers-modelo').length === 2);
const imgs = await g.$$eval('.pers-usar img', (l) => l.map((i) => i.src.slice(0, 22)));
ok(imgs.every((s) => s.startsWith('data:image/png')), 'PC: cada modelo guardado tem uma foto do boneco');
await g.screenshot({ path: `${SAIDA}/pc-editor-modelos.png` });
await g.click('.pers-usar[data-modelo="0"]');
ok(JSON.stringify(await skinV(g)) === JSON.stringify(pirata), 'PC: tocar no modelo "Pirata" volta para ele');
await g.click('.pers-apagar[data-apagar="1"]');
await g.waitForFunction(() => document.querySelectorAll('.pers-modelo').length === 1);
ok(JSON.parse(await g.evaluate(() => localStorage.getItem('pradaria.modelos'))).length === 1, 'PC: apagou o modelo "Sorteado" (guardado neste aparelho)');
await g.click('#pers-salvar');
await g.waitForSelector('#personagem', { state: 'hidden' });
ok(JSON.parse(await g.evaluate(() => localStorage.getItem('pradaria.skin'))).chapeu === 9, 'PC: salvou o personagem neste aparelho (sem conta)');
// joga sem conta e vê o próprio boneco de frente
await g.click('#bt-sozinho');
await g.waitForTimeout(800);
if (await g.locator('#m-novo:not([hidden])').count()) await g.click('#m-novo button[type=submit]');
await g.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 40000 });
await g.waitForTimeout(2500);
await g.keyboard.press('KeyR'); await g.keyboard.press('KeyR');
await g.waitForTimeout(1500);
const vs = await g.evaluate(() => { const b = window.__jogo.visao.boneco; return b && { s: b.skin, alt: b.raiz.scale.y }; });
ok(vs && vs.s.chapeu === 9 && vs.s.costas === 2 && vs.alt > 1.1, 'PC: no jogo, o meu boneco (de frente) está com o personagem salvo e alto');
await g.screenshot({ path: `${SAIDA}/pc-jogo-frente.png` });
await g.context().close();

// ---------- 2) online: Ana no PC, Beto no celular ----------
const sfx = letras();
const a = await pagina('Ana');
await criarConta(a, 'Ana' + sfx, false);
await a.click('#bt-personagem4');
await a.waitForSelector('#pers-canvas');
await aba(a, false, 'corpo'); await cor(a, false, 'pele', 4); await estilo(a, false, 'altura', 'Baixinho');
await aba(a, false, 'cabeca'); await estilo(a, false, 'formato', 'Oval'); await estilo(a, false, 'cabelo', 'Maria-chiquinha'); await cor(a, false, 'corCabelo', 3);
await aba(a, false, 'rosto'); await estilo(a, false, 'olhos', 'Bem redondos'); await estilo(a, false, 'rosto', 'Bochechas');
await aba(a, false, 'roupa'); await estilo(a, false, 'roupa', 'Vestido'); await corLivre(a, 'corRoupa', '#20c0a0');
await aba(a, false, 'pernas'); await estilo(a, false, 'sapato', 'Sandália'); await cor(a, false, 'corSapato', 5);
await aba(a, false, 'acess'); await estilo(a, false, 'costas', 'Asinhas'); await cor(a, false, 'corCostas', 12); await estilo(a, false, 'chapeu', 'Tiara'); await cor(a, false, 'corChapeu', 5);
await a.waitForTimeout(200);
const skinAna = await skinV(a);
await aba(a, false, 'modelos');
await a.fill('#pers-nome-modelo', 'Fada'); await a.click('#pers-guardar'); await a.waitForSelector('.pers-modelo');
// segundo modelo: astronauta (capacete, jaqueta, galocha)
await aba(a, false, 'acess'); await estilo(a, false, 'chapeu', 'Capacete'); await cor(a, false, 'corChapeu', 8); await estilo(a, false, 'oculos', 'De mergulho'); await estilo(a, false, 'costas', 'Mochila'); await cor(a, false, 'corCostas', 15);
await aba(a, false, 'roupa'); await estilo(a, false, 'roupa', 'Jaqueta'); await cor(a, false, 'corRoupa', 8);
await aba(a, false, 'pernas'); await estilo(a, false, 'calca', 'Calça'); await cor(a, false, 'corCalca', 8); await estilo(a, false, 'sapato', 'Galocha'); await cor(a, false, 'corSapato', 15);
const astronauta = await skinV(a);
await aba(a, false, 'modelos'); await a.fill('#pers-nome-modelo', 'Astronauta'); await a.click('#pers-guardar');
await a.waitForFunction(() => document.querySelectorAll('.pers-modelo').length === 2);
await a.click('.pers-usar[data-modelo="0"]'); // volta para a fada e salva
await a.click('#pers-salvar');
await a.waitForSelector('#personagem', { state: 'hidden' });
const conta = await a.evaluate(async () => (await (await fetch('/api/eu', { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).usuario);
ok(JSON.stringify(conta.skin) === JSON.stringify(skinAna), 'Ana: personagem salvo na conta (D1), com a cor livre do vestido');
ok(conta.modelos.length === 2 && conta.modelos[1].nome === 'Astronauta', 'Ana: os 2 modelos ficaram guardados na conta');
await irMundos(a, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Moda'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 40000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);

const bb = await pagina('Beto', { ...devices['Pixel 7'] });
await criarConta(bb, 'Beto' + sfx, true);
await bb.tap('#bt-personagem4');
await bb.waitForSelector('#pers-canvas');
await bb.waitForTimeout(600);
await aba(bb, true, 'corpo'); await estilo(bb, true, 'corpo', 'Forte'); await estilo(bb, true, 'altura', 'Alto');
await aba(bb, true, 'cabeca'); await estilo(bb, true, 'formato', 'Largo'); await estilo(bb, true, 'cabelo', 'Topete'); await cor(bb, true, 'corCabelo', 0);
await aba(bb, true, 'rosto'); await estilo(bb, true, 'sobrancelha', 'Grossa'); await estilo(bb, true, 'rosto', 'Barba'); await estilo(bb, true, 'boca', 'Sorriso de lado');
await aba(bb, true, 'roupa'); await estilo(bb, true, 'roupa', 'Camisa social'); await cor(bb, true, 'corRoupa', 12); await estilo(bb, true, 'estampa', 'Xadrez'); await cor(bb, true, 'corDetalhe', 11);
await aba(bb, true, 'acess'); await estilo(bb, true, 'oculos', 'Escuros'); await estilo(bb, true, 'costas', 'Violão'); await cor(bb, true, 'corCostas', 10); await estilo(bb, true, 'chapeu', 'Fones'); await cor(bb, true, 'corChapeu', 1);
await bb.screenshot({ path: `${SAIDA}/celular-editor-acessorios.png` });
await bb.evaluate(() => document.querySelector('#pers-vitrine').scrollIntoView());
await bb.waitForTimeout(300);
await bb.screenshot({ path: `${SAIDA}/celular-editor-boneco.png` });
const skinBeto = await skinV(bb);
await bb.tap('#pers-salvar');
await bb.waitForSelector('#personagem', { state: 'hidden' });
await irMundos(bb, true);
await bb.tap('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.tap('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 40000 });
await a.waitForFunction(() => window.__jogo.outros > 0, null, { timeout: 15000 });
await bb.waitForTimeout(1200);
const igual = (x, y) => Object.keys(y).every((k) => x[k] === y[k]);
ok(igual(await bb.evaluate(() => window.__jogo.outrosLista[0].skin), skinAna), 'Beto (celular) vê a Ana com o personagem dela (cor livre também)');
ok(igual(await a.evaluate(() => window.__jogo.outrosLista[0].skin), skinBeto), 'Ana (PC) vê o Beto com o personagem dele');
const tamanhos = await a.evaluate(() => { const o = window.__jogo.outrosLista[0]; const et = o.grupo.children.find((c) => c.userData.etiqueta); return [o.raiz.scale.y, o.raiz.scale.x, et && et.position.y]; });
ok(tamanhos[0] > 1.05 && tamanhos[1] > 1.1 && tamanhos[2] > 2.3, 'Ana vê o Beto alto e forte, com o nome logo acima da cabeça ' + tamanhos.map((v) => v.toFixed(2)));
// os dois frente a frente num chão plano
const pa = await a.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog;
  const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.floor(j.pos.y);
  for (let x = -4; x <= 4; x++) for (let z = -8; z <= 3; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); for (let y = 0; y < 5; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.yaw = 0; j.pitch = 0; J.dia = 0.3;
  return { x: j.pos.x, y: j.pos.y, z: j.pos.z };
});
await a.waitForTimeout(800);
const porBeto = async () => { await bb.evaluate((pa) => { const J = window.__jogo, j = J.jog; j.pos.x = pa.x; j.pos.z = pa.z - 3.5; j.pos.y = pa.y; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = Math.PI; j.pitch = -0.1; J.dia = 0.3; }, pa); };
await porBeto();
await bb.tap('#bt-visao');
await bb.waitForTimeout(1500);
await porBeto(); await bb.waitForTimeout(500);
await bb.screenshot({ path: `${SAIDA}/celular-beto-ve-ana.png` });
// Ana troca para o modelo "Astronauta" pela pausa, no meio do jogo
await a.keyboard.press('Escape');
await a.waitForTimeout(300);
if (await a.locator('#pausa[hidden]').count()) await a.click('#bt-menu');
await a.click('#bt-personagem3');
await a.waitForSelector('#pers-canvas');
await aba(a, false, 'modelos');
await a.click('.pers-usar[data-modelo="1"]');
await a.click('#pers-salvar');
await a.waitForSelector('#pausa:not([hidden])');
await a.click('#pausa [data-fechar]');
await bb.waitForFunction(() => window.__jogo.outrosLista[0].skin.chapeu === 6, null, { timeout: 5000 }).then(() => ok(true, 'Beto viu na hora a Ana virar astronauta'), () => ok(false, 'Beto viu na hora a Ana virar astronauta'));
ok(igual(await bb.evaluate(() => window.__jogo.outrosLista[0].skin), astronauta), 'Beto vê o modelo Astronauta inteiro, igual ao guardado');
await porBeto(); await bb.waitForTimeout(700);
await bb.screenshot({ path: `${SAIDA}/celular-beto-ve-astronauta.png` });
await a.keyboard.press('KeyR');
await a.waitForTimeout(1200);
await a.screenshot({ path: `${SAIDA}/pc-ana-de-tras.png` });
// Ana recarrega a página sem nada no aparelho: personagem e modelos vêm da conta
await a.evaluate(() => { localStorage.removeItem('pradaria.skin'); localStorage.removeItem('pradaria.modelos'); });
await a.reload();
await a.waitForTimeout(1500);
await a.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 15000 });
ok((await a.evaluate(() => window.__jogo.meuSkin.chapeu)) === 6, 'Ana recarregou: personagem veio da conta');
await a.click('#m-jogos:not([hidden]) #bt-personagem4, #m-mundos:not([hidden]) #bt-personagem2');
await aba(a, false, 'modelos');
ok(await a.locator('.pers-modelo').count() === 2, 'Ana recarregou: os 2 modelos vieram da conta');

// ---------- 3) tablet: editor com toque ----------
const t = await pagina('Tablet', { ...devices['Galaxy Tab S4 landscape'] });
await t.tap('#bt-personagem');
await t.waitForSelector('#pers-canvas');
await t.waitForTimeout(500);
await aba(t, true, 'cabeca'); await estilo(t, true, 'cabelo', 'Duas tranças'); await cor(t, true, 'corCabelo', 4);
await aba(t, true, 'acess'); await estilo(t, true, 'chapeu', 'Laço'); await cor(t, true, 'corChapeu', 5); await estilo(t, true, 'costas', 'Mochila'); await cor(t, true, 'corCostas', 3);
ok((await skinV(t)).cabelo === 9 && (await skinV(t)).costas === 1, 'Tablet: toques mudam o personagem');
await t.screenshot({ path: `${SAIDA}/tablet-editor.png` });
await aba(t, true, 'modelos'); await t.fill('#pers-nome-modelo', 'Escola'); await t.tap('#pers-guardar'); await t.waitForSelector('.pers-modelo');
await t.screenshot({ path: `${SAIDA}/tablet-modelos.png` });

console.log(erros.length ? 'ERROS NO CONSOLE:\n' + erros.join('\n') : 'Console sem erros');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

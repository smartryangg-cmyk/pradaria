// Personagem (skin), jogando de verdade:
// 1) PC sem conta: abre "Meu personagem" no menu, troca cabelo/rosto/roupa clicando, salva neste aparelho.
// 2) Online: Ana (PC) monta o personagem antes de entrar (fica na conta). Beto (tablet, toque) entra pelo código e vê o
//    boneco da Ana igual. Ana troca de chapéu pela pausa no meio do jogo e o Beto vê na hora. Ana recarrega: continua.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
let falhas = 0;
const ok = (c, t) => { console.log(c ? 'OK  ' : 'FALHA', t); if (!c) falhas++; };
async function pagina(nome, tablet) {
  const ctx = await b.newContext(tablet ? { ...devices['Galaxy Tab S4 landscape'] } : { viewport: { width: 1280, height: 760 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  return p;
}
const toque = (p, tablet) => (sel) => p[tablet ? 'tap' : 'click'](sel);
const escolher = async (p, tablet, aba, texto) => {
  await toque(p, tablet)(`.pers-aba[data-aba=${aba}]`);
  await p.locator('.pers-estilo', { hasText: new RegExp('^' + texto + '$') }).first()[tablet ? 'tap' : 'click']();
};
const cor = async (p, tablet, campo, i) => toque(p, tablet)(`.pers-cores button[data-campo=${campo}][data-valor="${i}"]`);
const skinPreview = (p) => p.evaluate(() => window.__jogo.personagem.skin);

// ---------- 1) PC, sem conta ----------
const g = await pagina('Visitante', false);
await g.click('#bt-personagem');
await g.waitForSelector('#personagem:not([hidden]) #pers-canvas');
await g.waitForTimeout(800);
await escolher(g, false, 'cabeca', 'Black power'); await cor(g, false, 'corCabelo', 9);
await escolher(g, false, 'rosto', 'Óculos'); await escolher(g, false, 'rosto', 'Sorrisão');
await escolher(g, false, 'roupa', 'Vestido'); await cor(g, false, 'corRoupa', 4);
const sv = await skinPreview(g);
ok(sv.cabelo === 7 && sv.corCabelo === 9 && sv.rosto === 3 && sv.boca === 1 && sv.roupa === 4 && sv.corRoupa === 4, 'PC: cliques mudaram o personagem ' + JSON.stringify(sv));
const ang1 = await g.evaluate(() => window.__jogo.personagem.ang); await g.waitForTimeout(600);
ok(await g.evaluate(() => window.__jogo.personagem.ang) > ang1, 'PC: boneco da vitrine está girando');
// arrastar gira
const cv = await g.locator('#pers-canvas').boundingBox();
const angA = await g.evaluate(() => window.__jogo.personagem.ang);
await g.mouse.move(cv.x + 100, cv.y + 150); await g.mouse.down(); await g.mouse.move(cv.x + 220, cv.y + 150, { steps: 6 }); await g.mouse.up();
ok(await g.evaluate(() => window.__jogo.personagem.ang) - angA > 1, 'PC: arrastar com o mouse gira o boneco');
await g.screenshot({ path: `${SAIDA}/pc-editor.png` });
await g.click('#pers-salvar');
await g.waitForSelector('#personagem', { state: 'hidden' });
ok(JSON.parse(await g.evaluate(() => localStorage.getItem('pradaria.skin'))).cabelo === 7, 'PC: salvou neste aparelho (sem conta)');
// joga sem conta e vê o próprio boneco de frente
await g.click('#bt-sozinho');
await g.waitForTimeout(800);
if (await g.locator('#m-novo:not([hidden])').count()) await g.click('#m-novo button[type=submit]');
await g.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
await g.waitForTimeout(2500);
await g.keyboard.press('KeyR'); await g.keyboard.press('KeyR');
await g.waitForTimeout(1200);
const vs = await g.evaluate(() => window.__jogo.visao.boneco && window.__jogo.visao.boneco.skin);
ok(vs && vs.cabelo === 7 && vs.roupa === 4, 'PC: no jogo, o meu boneco (câmera de frente) está com o personagem salvo');
await g.screenshot({ path: `${SAIDA}/pc-jogo-frente.png` });
await g.context().close();

// ---------- 2) online com dois jogadores ----------
const sfx = Date.now() % 10000;
const a = await pagina('Ana', false);
await a.click('#bt-criar-conta');
await a.fill('#c-nome', 'Ana' + sfx); await a.fill('#c-senha', 'senha123');
await a.click('#c-ok');
await a.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
await a.click('#bt-personagem2');
await a.waitForSelector('#pers-canvas');
await escolher(a, false, 'cabeca', 'Rabo de cavalo'); await cor(a, false, 'corCabelo', 4); await cor(a, false, 'pele', 3);
await escolher(a, false, 'rosto', 'Grandes'); await cor(a, false, 'corOlhos', 2); await escolher(a, false, 'rosto', 'Bochechas');
await escolher(a, false, 'roupa', 'Jardineira'); await cor(a, false, 'corRoupa', 11); await cor(a, false, 'corDetalhe', 3);
await escolher(a, false, 'pernas', 'Calça'); await cor(a, false, 'corSapato', 1);
const skinAna = await skinPreview(a);
await a.click('#pers-salvar');
await a.waitForSelector('#personagem', { state: 'hidden' });
const naConta = await a.evaluate(async () => (await (await fetch('/api/eu', { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).usuario);
ok(naConta.skinSalva && naConta.skin.cabelo === 5 && naConta.skin.roupa === 5 && naConta.skin.corSapato === 1, 'Ana: personagem ficou salvo na conta (D1)');
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Moda'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);

const bb = await pagina('Beto', true);
await bb.tap('#bt-criar-conta');
await bb.fill('#c-nome', 'Beto' + sfx); await bb.fill('#c-senha', 'senha123');
await bb.tap('#c-ok');
await bb.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
// Beto também monta o dele no tablet (toque)
await bb.tap('#bt-personagem2');
await bb.waitForSelector('#pers-canvas');
await bb.waitForTimeout(600);
await escolher(bb, true, 'cabeca', 'Espetado'); await cor(bb, true, 'corCabelo', 0);
await escolher(bb, true, 'cabeca', 'Boné'); await cor(bb, true, 'corChapeu', 1);
await escolher(bb, true, 'roupa', 'Moletom com capuz'); await cor(bb, true, 'corRoupa', 2);
await escolher(bb, true, 'pernas', 'Bermuda');
await bb.screenshot({ path: `${SAIDA}/tablet-editor.png` });
const skinBeto = await skinPreview(bb);
await bb.tap('#pers-salvar');
await bb.waitForSelector('#personagem', { state: 'hidden' });
await bb.tap('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.tap('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await a.waitForFunction(() => window.__jogo.outros > 0, null, { timeout: 10000 });
await bb.waitForTimeout(1200);
const igual = (x, y) => Object.keys(y).every((k) => x[k] === y[k]);
ok(igual(await bb.evaluate(() => window.__jogo.outrosLista[0].skin), skinAna), 'Beto (tablet) vê a Ana com o personagem dela');
ok(igual(await a.evaluate(() => window.__jogo.outrosLista[0].skin), skinBeto), 'Ana (PC) vê o Beto com o personagem dele');
// os dois frente a frente, Beto com a câmera de trás
const pa = await a.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog;
  const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = Math.floor(j.pos.y);
  for (let x = -4; x <= 4; x++) for (let z = -8; z <= 3; z++) { m.definir(x0 + x, y0 - 1, z0 + z, 3); for (let y = 0; y < 5; y++) m.definir(x0 + x, y0 + y, z0 + z, 0); }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y0; j.yaw = 0; j.pitch = 0; J.dia = 0.3;
  return { x: j.pos.x, y: j.pos.y, z: j.pos.z };
});
await a.waitForTimeout(800);
await bb.evaluate((pa) => { const J = window.__jogo, j = J.jog; j.pos.x = pa.x; j.pos.z = pa.z - 3.5; j.pos.y = pa.y; j.yaw = Math.PI; j.pitch = -0.1; J.dia = 0.3; }, pa);
await bb.tap('#bt-visao');
await bb.waitForTimeout(1500);
await bb.screenshot({ path: `${SAIDA}/tablet-beto-ve-ana.png` });
// Ana troca de chapéu pela pausa, no meio do jogo (cliques de verdade)
await a.keyboard.press('Escape');
await a.waitForTimeout(300);
if (await a.locator('#pausa[hidden]').count()) await a.click('#bt-menu');
await a.click('#bt-personagem3');
await a.waitForSelector('#pers-canvas');
await escolher(a, false, 'cabeca', 'Coroa'); await cor(a, false, 'corChapeu', 1);
await a.click('#pers-salvar');
await a.waitForSelector('#pausa:not([hidden])');
ok(true, 'Ana: depois de salvar voltou para a pausa');
await a.click('#pausa [data-fechar]');
await bb.waitForFunction(() => window.__jogo.outrosLista[0].skin.chapeu === 4, null, { timeout: 5000 }).then(() => ok(true, 'Beto viu na hora a Ana trocar para a coroa'), () => ok(false, 'Beto viu na hora a Ana trocar para a coroa'));
await bb.evaluate((pa) => { const j = window.__jogo.jog; j.pos.x = pa.x; j.pos.z = pa.z - 3.5; j.pos.y = pa.y; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = Math.PI; j.pitch = -0.1; }, await a.evaluate(() => { const j = window.__jogo.jog; return { x: j.pos.x, y: j.pos.y, z: j.pos.z }; }));
await bb.waitForTimeout(900);
await bb.screenshot({ path: `${SAIDA}/tablet-beto-ve-ana-coroa.png` });
// Ana se vê de trás com a coroa
await a.keyboard.press('KeyR');
await a.waitForTimeout(1200);
ok((await a.evaluate(() => window.__jogo.visao.boneco.skin.chapeu)) === 4, 'Ana se vê de trás com a coroa');
await a.screenshot({ path: `${SAIDA}/pc-ana-de-tras.png` });
// Ana recarrega a página: o personagem continua (veio da conta)
await a.evaluate(() => localStorage.removeItem('pradaria.skin'));
await a.reload();
await a.waitForTimeout(1500);
if (await a.locator('#bt-entrar').isVisible()) await a.click('#bt-entrar');
await a.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
ok((await a.evaluate(() => window.__jogo.meuSkin.chapeu)) === 4, 'Ana recarregou (sem cópia no aparelho): personagem veio da conta');
await bb.waitForTimeout(500);
console.log(erros.length ? 'ERROS NO CONSOLE:\n' + erros.join('\n') : 'Console sem erros');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

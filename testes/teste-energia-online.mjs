// Multijogador: Ana liga uma alavanca; no aparelho do Beto a lâmpada também acende (e apaga).
// Uso: npm run dev:sala e npm run dev, depois: node testes/teste-energia-online.mjs
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = 'http://localhost:8788/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
async function jogador(nome) {
  const p = await (await b.newContext({ viewport: { width: 800, height: 500 } })).newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  await p.goto(URL);
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Oficina'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2000);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(1500);
// Ana monta perto de onde os dois estão
const pos = await a.evaluate(() => {
  const { mundo, jog } = window.__jogo;
  const X = Math.floor(jog.pos.x) + 2, Z = Math.floor(jog.pos.z) + 2, Y = 50;
  for (let d = -1; d <= 4; d++) mundo.definir(X + d, Y, Z, 3);
  mundo.definir(X, Y + 1, Z, 102);
  mundo.definir(X + 1, Y + 1, Z, 100); mundo.definir(X + 2, Y + 1, Z, 100);
  mundo.definir(X + 3, Y + 1, Z, 108);
  return [X, Y, Z];
});
await a.waitForTimeout(1000);
const ler = (p) => p.evaluate(([X, Y, Z]) => window.__jogo.mundo.bloco(X + 3, Y + 1, Z), pos);
const antesB = await ler(bb);
await a.evaluate(([X, Y, Z]) => window.__jogo.mundo.definir(X, Y + 1, Z, 103), pos);
await bb.waitForTimeout(1200);
const ligadaB = await ler(bb), ligadaA = await ler(a);
await bb.evaluate(([X, Y, Z]) => window.__jogo.mundo.definir(X, Y + 1, Z, 102), pos); // Beto desliga
await a.waitForTimeout(1200);
const desligadaA = await ler(a);
console.log(JSON.stringify({ antesB, ligadaA, ligadaB, desligadaA }));
const ok = antesB === 108 && ligadaA === 109 && ligadaB === 109 && desligadaA === 108 && !erros.length;
console.log(ok ? 'OK' : 'FALHOU', erros.slice(0, 5).join('\n'));
await b.close();
process.exit(ok ? 0 : 1);

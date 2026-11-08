// Veículos no modo sem internet: cria cada tipo, entra, dirige, buzina, desce e guarda.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const toque = process.argv[2] === 'toque';
const ctx = await b.newContext({ viewport: { width: 1024, height: 640 }, hasTouch: toque, isMobile: toque });
const p = await ctx.newPage();
const erros = [];
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
await p.goto((process.env.URL || 'http://localhost:8788') + '/#teste');
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForTimeout(500);
await p.click('#bt-sozinho');
// primeira vez: tela de opções do mundo novo (tudo no padrão, veículos ligados)
await p.waitForSelector('#m-novo:not([hidden])');
await p.click('[data-opcao=mercado]'); // sem mercado: a garagem é livre (com mercado, veja teste-veiculos-logica.mjs)
await p.click('#m-novo summary'); await p.fill('#n-semente', process.env.SEMENTE || 'estrada'); // mesmo lugar sempre
await p.click('#m-novo button[type=submit]');
await p.waitForTimeout(5000);
const info = () => p.evaluate(() => {
  const g = window.__jogo.garagem, j = window.__jogo.jog;
  const d = g.dentro;
  return { n: g.veic.mapa.size, dentro: d ? d.v.tipo + '#' + d.a : null, v: d ? { x: +d.v.x.toFixed(1), y: +d.v.y.toFixed(1), z: +d.v.z.toFixed(1), vel: +d.v.vel.toFixed(1) } : null, jog: [+j.pos.x.toFixed(1), +j.pos.y.toFixed(1), +j.pos.z.toFixed(1)] };
});
const tipos = (process.env.TIPOS || 'carro,jipe,esportivo,quadriciclo,moto,bicicleta,skate,trator,caminhao,onibus,aviao,helicoptero').split(',');
for (const t of tipos) {
  await p.evaluate((t) => window.__jogo.garagem.novo(t, Math.floor(Math.random() * 8)), t);
  await p.waitForTimeout(300);
  const i0 = await info();
  if (!i0.dentro) { console.log(t, 'NÃO ENTROU', JSON.stringify(i0)); continue; }
  await p.keyboard.down('KeyW');
  if (t === 'aviao' || t === 'helicoptero') await p.keyboard.down('Space');
  await p.waitForTimeout(t === 'aviao' ? 3500 : 1800);
  await p.keyboard.down('KeyD');
  await p.waitForTimeout(700);
  await p.keyboard.up('KeyD');
  const i1 = await info();
  await p.screenshot({ path: `${SAIDA}/veic-${t}.png` });
  await p.keyboard.up('KeyW'); await p.keyboard.up('Space');
  await p.keyboard.press('KeyH');
  const dist = Math.hypot(i1.v.x - i0.v.x, i1.v.z - i0.v.z);
  console.log(t, 'andou', dist.toFixed(1), 'subiu', (i1.v.y - i0.v.y).toFixed(1), 'vel', i1.v.vel);
  await p.waitForTimeout(800);
  await p.keyboard.press('KeyV'); // desce
  await p.waitForTimeout(300);
  const i2 = await info();
  console.log('  desceu?', !i2.dentro, 'jog', i2.jog.join(','));
}
// barco: precisa de água; procura um lago perto
const agua = await p.evaluate(() => {
  const m = window.__jogo.mundo, j = window.__jogo.jog;
  for (let r = 4; r < 120; r += 2) for (let a = 0; a < 16; a++) {
    const x = Math.floor(j.pos.x + Math.cos(a / 16 * 6.283) * r), z = Math.floor(j.pos.z + Math.sin(a / 16 * 6.283) * r);
    const y = m.chao(x, z);
    if (m.bloco(x, y, z) === 1 + 0 && false) return null;
    if ([11].includes(m.bloco(x, y, z)) || m.bloco(x, y, z) === window.__B_AGUA) return [x, y, z];
  }
  return null;
});
void agua;
await p.evaluate(() => {
  // põe o jogador olhando para a água mais próxima
  const m = window.__jogo.mundo, j = window.__jogo.jog;
  for (let r = 3; r < 150; r += 1) for (let a = 0; a < 24; a++) {
    const x = Math.floor(j.pos.x + Math.cos(a / 24 * 6.283) * r), z = Math.floor(j.pos.z + Math.sin(a / 24 * 6.283) * r);
    const y = m.chao(x, z);
    const b = m.bloco(x, y, z);
    if (b && window.__jogo.mundo && m.bloco(x, y, z) !== m.bloco(x, y - 1, z) && false) continue;
    const ehAgua = m.bloco(x, y + 0, z) === m.bloco(x, 19, z) && y === 20 && m.alturaEm(x, z) < 19;
    if (ehAgua) { j.pos.x = x + 0.5 - Math.cos(a / 24 * 6.283) * 3; j.pos.z = z + 0.5 - Math.sin(a / 24 * 6.283) * 3; j.pos.y = m.chao(Math.floor(j.pos.x), Math.floor(j.pos.z)) + 1.2; j.yaw = Math.atan2(-(x - j.pos.x), -(z - j.pos.z)); return; }
  }
});
await p.waitForTimeout(1500);
await p.evaluate(() => window.__jogo.garagem.novo('barco', 1));
await p.waitForTimeout(300);
const b0 = await info();
console.log('barco', JSON.stringify(b0));
if (b0.dentro) {
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2000); await p.keyboard.up('KeyW');
  const b1 = await info();
  console.log('barco andou', Math.hypot(b1.v.x - b0.v.x, b1.v.z - b0.v.z).toFixed(1), JSON.stringify(b1));
  await p.screenshot({ path: `${SAIDA}/veic-barco.png` });
  await p.evaluate(() => window.__jogo.garagem.guardar());
}
console.log('total veículos', (await info()).n);
// salva e recarrega: os veículos continuam lá
await p.evaluate(() => { window.dispatchEvent(new Event('beforeunload')); });
const salvos = await p.evaluate(() => JSON.parse(localStorage.getItem('pradaria.local')).veiculos.length);
console.log('salvos', salvos);
const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
console.log('fps', fps);
console.log('erros:', erros.slice(0, 10).join('\n') || 'nenhum');
await b.close();

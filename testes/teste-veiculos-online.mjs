// Veículos no multijogador: A cria um carro e dirige, B entra de passageiro e vê tudo junto.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (portas 8790 e 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = 'http://localhost:8788/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
async function jogador(nome, toque) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 }, hasTouch: toque, isMobile: toque });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) process.exitCode = 1; };
const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Estrada'); await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(1500);

// A olha para o lado mais aberto (sem cerca nem casa) e cria um carro (entra sozinha como motorista)
await a.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog;
  let melhor = 0, livre = -1;
  for (let k = 0; k < 8; k++) {
    const yaw = k * Math.PI / 4; let n = 0;
    for (let d = 2; d < 16; d++) {
      const x = Math.floor(j.pos.x - Math.sin(yaw) * d), z = Math.floor(j.pos.z - Math.cos(yaw) * d);
      if (Math.abs(m.alturaEm(x, z) - m.chao(x, z)) > 0 || m.chao(x, z) > j.pos.y + 1) break;
      n++;
    }
    if (n > livre) { livre = n; melhor = yaw; }
  }
  j.yaw = melhor;
});
await a.evaluate(() => window.__jogo.garagem.novo('carro', 2));
await a.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 5000 });
const vid = await a.evaluate(() => window.__jogo.garagem.dentro.v.id);
await bb.waitForFunction((id) => window.__jogo.garagem.veic.mapa.has(id), vid, { timeout: 5000 });
ok(true, 'B vê o carro novo ' + vid);
// B vai para perto e entra
const pv = await a.evaluate(() => { const v = window.__jogo.garagem.dentro.v; return [v.x, v.y, v.z]; });
await bb.evaluate((pv) => { const j = window.__jogo.jog; j.pos.x = pv[0] + 2.5; j.pos.y = pv[1] + 0.5; j.pos.z = pv[2]; }, pv);
await bb.waitForTimeout(600);
const temBotao = await bb.evaluate(() => !document.querySelector('#bt-veic-entrar').hidden);
ok(temBotao, 'B vê o botão Entrar perto do carro');
await bb.tap('#bt-veic-entrar');
await bb.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 5000 });
const lugarB = await bb.evaluate(() => window.__jogo.garagem.dentro.a);
ok(lugarB === 1, 'B sentou no banco do passageiro (' + lugarB + ')');
await a.waitForTimeout(500);
const aVeB = await a.evaluate((id) => window.__jogo.garagem.veic.mapa.get(id).ocup[1] !== null, vid);
ok(aVeB, 'A vê B sentado');
// A dirige (sem aldeões por perto: o carro freia sozinho para eles)
await a.evaluate(() => window.__jogo.aldeoes.limpar());
await a.keyboard.down('KeyW'); await a.waitForTimeout(2200); await a.keyboard.up('KeyS');
await a.keyboard.up('KeyW'); await a.keyboard.down('KeyS'); await a.waitForTimeout(700); await a.keyboard.up('KeyS'); // freia
await a.waitForTimeout(1200);
const pa = await a.evaluate(() => { const v = window.__jogo.garagem.dentro.v; return [v.x, v.z]; });
const pbV = await bb.evaluate((id) => { const v = window.__jogo.garagem.veic.mapa.get(id); return [v.x, v.z]; }, vid);
const pbJ = await bb.evaluate(() => { const j = window.__jogo.jog.pos; return [j.x, j.z]; });
const andou = Math.hypot(pa[0] - pv[0], pa[1] - pv[2]);
if (andou <= 2) console.log('debug', JSON.stringify(await a.evaluate(() => { const J = window.__jogo, v = J.garagem.dentro.v, m = J.mundo; const f = []; for (let d = 1; d < 5; d++) { const x = Math.floor(v.x - Math.sin(v.yaw) * (d + 1.7)), z = Math.floor(v.z - Math.cos(v.yaw) * (d + 1.7)); f.push([0, 1, 2].map((k) => m.bloco(x, Math.floor(v.y) + k, z)).join('/')); } return { y: v.y, yaw: v.yaw, f, al: J.aldeoes.lista.map((a) => [a.x - v.x, a.z - v.z].map((n) => +n.toFixed(1))).filter(([x, z]) => Math.hypot(x, z) < 8), bi: J.bichos.lista.map((a) => [a.x - v.x, a.z - v.z].map((n) => +n.toFixed(1))).filter(([x, z]) => Math.hypot(x, z) < 8) }; })));
ok(andou > 2, 'carro andou ' + andou.toFixed(1));
ok(Math.hypot(pa[0] - pbV[0], pa[1] - pbV[1]) < 1, 'B vê o carro no mesmo lugar');
ok(Math.hypot(pa[0] - pbJ[0], pa[1] - pbJ[1]) < 3, 'B foi junto no carro');
await a.screenshot({ path: SAIDA + '/online-veic-a.png' });
await bb.screenshot({ path: SAIDA + '/online-veic-b.png' });
// buzina chega no outro
await bb.evaluate(() => { window.__buzinas = 0; const s = window.__jogo.garagem.J.som; const o = s.buzina.bind(s); s.buzina = (...x) => { window.__buzinas++; o(...x); }; });
await a.keyboard.press('KeyH');
await bb.waitForTimeout(600);
ok(await bb.evaluate(() => window.__buzinas) > 0, 'B ouviu a buzina');
// B desce
await bb.tap('#bt-veic-sair');
await a.waitForTimeout(600);
ok(await a.evaluate((id) => window.__jogo.garagem.veic.mapa.get(id).ocup[1] === null, vid), 'A vê B descer');
ok(await bb.evaluate(() => !window.__jogo.garagem.dentro), 'B fora do carro');
// B recarrega: o carro continua lá, com A ao volante
await bb.reload();
await bb.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
await bb.click('#lista-mundos .mundo');
await bb.waitForFunction((id) => window.__jogo && window.__jogo.garagem.veic && window.__jogo.garagem.veic.mapa.has(id), vid, { timeout: 20000 });
ok(await bb.evaluate((id) => window.__jogo.garagem.veic.mapa.get(id).ocup[0] !== null, vid), 'depois de recarregar, B vê A dirigindo');
// A guarda o carro
await a.evaluate(() => window.__jogo.garagem.guardar());
ok(await bb.waitForFunction((id) => !window.__jogo.garagem.veic.mapa.has(id), vid, { timeout: 5000 }).then(() => true, () => false), 'carro guardado sumiu para B');
ok(await a.evaluate(() => !window.__jogo.garagem.dentro), 'A desceu ao guardar');
console.log(erros.join('\n') || 'sem erros');
await b.close();

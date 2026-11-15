// Lógica dos veículos no multijogador: A (computador) e B (tablet) no mesmo mundo com mercado.
// Veículos da vila aparecem igual para os dois, combustível/dano andam pela rede, posto cobra na sala,
// compra sem moedas é recusada, e o volante é só de quem tem a chave.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (portas 8790 e 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = (process.env.URL || 'http://localhost:8788') + '/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const falhas = [];
const ok = (c, msg) => { console.log((c ? 'OK    ' : 'FALHA ') + msg); if (!c) falhas.push(msg); };
async function jogador(nome, toque) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 }, hasTouch: toque, isMobile: toque });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Posto');
await a.click('#m-novo summary'); await a.fill('#n-semente', 'estrada');
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala && window.__jogo.garagem.veic, null, { timeout: 20000 });
await a.waitForTimeout(2000);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(1000);

// os dois vão até o posto da vila
const posto = await a.evaluate(() => window.__jogo.garagem.lugares.perto(0, 0, 400).postos[0]);
ok(!!posto, 'a vila tem posto');
for (const p of [a, bb]) {
  await p.evaluate((pt) => { const j = window.__jogo.jog, m = window.__jogo.mundo; j.pos.x = pt.x + 3; j.pos.z = pt.z + 3; j.pos.y = m.chao(Math.floor(pt.x + 3), Math.floor(pt.z + 3)) + 1.05; j.voando = false; window.__jogo.garagem.tempoLugares = 0; }, posto);
}
await a.waitForFunction(() => window.__jogo.garagem.lista().filter((v) => v.k).length >= 2, null, { timeout: 15000 }).catch(() => {});
await bb.waitForTimeout(1500);
const daVilaA = await a.evaluate(() => window.__jogo.garagem.lista().filter((v) => v.k).map((v) => v.k).sort());
const daVilaB = await bb.evaluate(() => window.__jogo.garagem.lista().filter((v) => v.k).map((v) => v.k).sort());
ok(daVilaA.length >= 2 && daVilaA.join() === daVilaB.join(), 'os dois veem os mesmos veículos da vila, sem repetir (' + daVilaA.join(' ') + ')');

// A entra num carro da vila, gasta e B vê o tanque
const carro = await a.evaluate(() => { const g = window.__jogo.garagem; const v = [...g.veic.mapa.values()].find((v) => v.parado && v.d.energia && v.d.meio === 'terra'); g.pedirEntrar(v); return v.id; });
await a.waitForFunction(() => window.__jogo.garagem.dentro && window.__jogo.garagem.dentro.a === 0, null, { timeout: 5000 });
await a.evaluate(() => { const v = window.__jogo.garagem.dentro.v; v.comb = 0.4; v.dano = 0.3; });
await a.keyboard.down('KeyW'); await a.waitForTimeout(1500); await a.keyboard.up('KeyW');
await a.waitForTimeout(2500);
const ca = await a.evaluate(() => ({ c: window.__jogo.garagem.dentro.v.comb, d: window.__jogo.garagem.dentro.v.dano }));
const cb = await bb.evaluate((id) => { const v = window.__jogo.garagem.veic.mapa.get(id); return { c: v.comb, d: v.dano }; }, carro);
ok(Math.abs(ca.c - cb.c) < 0.01 && Math.abs(ca.d - cb.d) < 0.01, `B vê o tanque e o dano do carro da A (${cb.c.toFixed(3)} / ${cb.d.toFixed(2)})`);

// posto: a sala cobra e manda o carro cheio para todos
const pp = await a.evaluate(() => { const q = [...window.__jogo.garagem.postos.values()][0]; return { x: q.x, y: q.y, z: q.z }; });
await a.evaluate((q) => { const g = window.__jogo.garagem, v = g.dentro.v; v.x = q.x + 1.5; v.z = q.z; v.y = q.y; v.yVis = q.y; v.vel = 0; g._esperado = null; g._tPosto = 0; }, pp);
await a.waitForTimeout(1500);
ok(await a.isVisible('#bt-abastecer'), 'A vê o botão Abastecer no posto');
const m0 = await a.evaluate(() => window.__jogo.mercado.e.moedas);
await a.click('#bt-abastecer');
await a.waitForFunction(() => window.__jogo.garagem.dentro.v.comb === 1, null, { timeout: 5000 }).catch(() => {});
await a.waitForTimeout(800);
const m1 = await a.evaluate(() => window.__jogo.mercado.e.moedas);
ok(m1 === m0 - 4, `a sala cobrou o tanque (${m0} -> ${m1})`);
ok(await bb.evaluate((id) => window.__jogo.garagem.veic.mapa.get(id).comb === 1, carro), 'B vê o carro de tanque cheio');
await a.screenshot({ path: SAIDA + '/online-posto.png' });

// compra sem moedas é recusada pela sala
await a.evaluate(() => window.__jogo.mercado.veiculo({ t: 'comprarV', tipo: 'aviao' }));
await a.waitForTimeout(800);
ok(!(await a.evaluate(() => window.__jogo.mercado.e.veiculos.includes('aviao'))), 'sem moedas a sala não vende o avião');
// o carro da vila não vai para a garagem
await a.evaluate(() => window.__jogo.garagem.guardar());
await a.waitForTimeout(600);
ok(await a.evaluate((id) => window.__jogo.garagem.veic.mapa.has(id), carro), 'o carro da vila continua no mundo');
await a.evaluate(() => window.__jogo.garagem.sair());
await a.waitForTimeout(500);

// chave: A chama a bicicleta dela; B só pode ir de passageiro (a bicicleta tem um lugar: está cheia para ele)
await a.evaluate(() => window.__jogo.garagem.chamar('bicicleta'));
await a.waitForFunction(() => window.__jogo.garagem.dentro && window.__jogo.garagem.dentro.v.tipo === 'bicicleta', null, { timeout: 10000 }).catch(() => {});
const bic = await a.evaluate(() => window.__jogo.garagem.dentro && window.__jogo.garagem.dentro.v.id);
ok(!!bic, 'A chamou a bicicleta pelo celular');
await a.evaluate(() => window.__jogo.garagem.sair());
await a.waitForTimeout(600);
await bb.evaluate((id) => { const g = window.__jogo.garagem; g.pedirEntrar(g.veic.mapa.get(id)); }, bic);
await bb.waitForTimeout(1200);
ok(!(await bb.evaluate(() => !!window.__jogo.garagem.dentro)), 'B não pega a bicicleta da A (a chave é dela)');
// B entra de passageiro num carro da vila em que A dirige
await a.evaluate((id) => { const g = window.__jogo.garagem; g.pedirEntrar(g.veic.mapa.get(id)); }, carro);
await a.waitForTimeout(800);
await bb.evaluate((id) => { const g = window.__jogo.garagem; g.pedirEntrar(g.veic.mapa.get(id)); }, carro);
await bb.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 5000 }).catch(() => {});
const sentB = await bb.evaluate(() => window.__jogo.garagem.dentro && window.__jogo.garagem.dentro.a);
ok(sentB >= 1, 'B vai de passageiro no carro da vila');
await bb.screenshot({ path: SAIDA + '/online-passageiro-tablet.png' });

console.log(erros.slice(0, 8).join('\n'));
ok(erros.length === 0, 'sem erros no console');
await b.close();
process.exit(falhas.length ? 1 : 0);

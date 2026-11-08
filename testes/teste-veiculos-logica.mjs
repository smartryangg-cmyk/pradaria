// Lógica dos veículos (sem internet): chave/garagem/celular, compra e montagem com o mercado, estrada x grama,
// pista do avião, combustível, batida e dano, posto (abastecer/consertar), veículos das vilas, submarino,
// e tudo sumindo quando a opção Veículos está desligada.
// Precisa de `npm run dev` rodando (porta 8788). TOQUE=1 roda como tablet.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const SAIDA = process.env.SAIDA || '/tmp';
const toque = !!process.env.TOQUE;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
let p;
async function novaPagina() {
  if (p) await p.context().close();
  const ctx = await b.newContext({ viewport: { width: 1024, height: 640 }, hasTouch: toque, isMobile: toque });
  p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
}
const falhas = [];
const ok = (c, msg) => { console.log((c ? 'OK    ' : 'FALHA ') + msg); if (!c) falhas.push(msg); };
const ev = (f, a) => p.evaluate(f, a);
const tocar = (sel) => (toque ? p.tap(sel) : p.click(sel));

async function mundoNovo({ mercado = true, veiculos = true } = {}) {
  await novaPagina();
  await p.goto((process.env.URL || 'http://localhost:8788') + '/#teste');
  await p.waitForTimeout(400);
  await tocar('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (!mercado) await tocar('[data-opcao=mercado]');
  if (!veiculos) await tocar('[data-opcao=veiculos]');
  await tocar('#m-novo summary'); await p.fill('#n-semente', 'estrada');
  await tocar('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.garagem.veic, null, { timeout: 20000 });
  await p.waitForTimeout(2500);
}
// pista de teste no alto: faixa de tábuas (estrada) e faixa de grama, com uma parede no fim da grama
async function pista() {
  await ev(() => { const j = window.__jogo.jog; j.pos.x = 300; j.pos.y = 75; j.pos.z = 300; j.voando = true; });
  await p.waitForTimeout(3000); // carrega o mundo em volta antes de construir
  for (let vez = 0; vez < 3; vez++) { await construirPista(); await p.waitForTimeout(2500); } // o gerador pode entregar pedaços atrasados
}
async function construirPista() {
  await ev(() => {
    const J = window.__jogo, m = J.mundo, Y = 70, X0 = 300, Z0 = 300;
    for (let x = X0 - 4; x < X0 + 90; x++) for (let z = Z0 - 6; z <= Z0 + 18; z++) {
      m.definir(x, Y, z, z <= Z0 + 6 ? 8 : 1); // tábuas (estrada/ponte) e grama; pedrisco cairia no ar
      for (let y = Y + 1; y < Y + 8; y++) m.definir(x, y, z, 0);
    }
    for (let z = Z0 + 8; z <= Z0 + 18; z++) for (let y = Y + 1; y < Y + 5; y++) m.definir(X0 + 60, y, z, 3);
    const j = J.jog; j.pos.x = X0; j.pos.y = Y + 1.05; j.pos.z = Z0; j.voando = false; j.yaw = -Math.PI / 2;
  });
}
// coloca o veículo em que estou num ponto, parado, virado para +x
const por = (x, y, z) => ev(([x, y, z]) => { const v = window.__jogo.garagem.dentro.v; v.x = x; v.y = y; v.z = z; v.yVis = y; v.yaw = -Math.PI / 2; v.vel = 0; v.vy = 0; window.__jogo.jog.yaw = 0; window.__jogo.garagem._esperado = null; }, [x, y, z]);
// acelera por `ms` (num computador lento sem placa de vídeo os quadros demoram: espera até 3x mais, até a velocidade parar de subir)
async function acelerar(ms, subir, ate) {
  await p.keyboard.down('KeyW'); if (subir) await p.keyboard.down('Space');
  let max = 0, parado = 0; const t0 = Date.now();
  while (Date.now() - t0 < ms * 6) {
    await p.waitForTimeout(150);
    const v = await ev(() => Math.abs(window.__jogo.garagem.dentro.v.vel));
    if (v > max + 0.05) { max = v; parado = 0; } else parado += 150;
    if (ate ? await ev(ate) : Date.now() - t0 > ms && parado > 3000) break;
  }
  await p.keyboard.up('KeyW'); if (subir) await p.keyboard.up('Space');
  return max;
}
const dentro = () => ev(() => { const d = window.__jogo.garagem.dentro; return d ? { tipo: d.v.tipo, a: d.a, x: d.v.x, y: d.v.y, z: d.v.z, comb: d.v.comb, dano: d.v.dano, vel: d.v.vel, noChao: d.v.noChao } : null; });
const sairPara = async () => { await ev(() => window.__jogo.garagem.sair()); await p.waitForTimeout(200); };

// ================= mundo com mercado =================
await mundoNovo({ mercado: true });
ok(await p.isVisible('#bt-celular'), 'celular aparece no topo (não tem mais menu de veículos solto)');
ok(!(await p.isVisible('#bt-garagem')), 'sem botão de garagem no topo');
// longe de uma garagem: a garagem não abre, o celular só tem bicicleta e skate
await ev(() => { const j = window.__jogo.jog; j.pos.x += 400; j.pos.z += 400; j.pos.y = 90; j.voando = true; });
await p.waitForTimeout(500);
await ev(() => window.__jogo.garagem.abrir('garagem'));
ok(await p.isHidden('#garagem'), 'longe do posto a garagem não abre');
await tocar('#bt-celular');
const noCel = await ev(() => [...document.querySelectorAll('#garagem-grade .veiculo')].filter((b) => !b.hidden).map((b) => b.dataset.tipo));
ok(noCel.join() === 'bicicleta,skate', 'celular: só as chaves que tenho (' + noCel.join() + ')');
await tocar('#garagem-fechar');
await ev(() => window.__jogo.garagem.novo('carro', 0));
ok(!(await dentro()), 'sem a chave o carro não sai');

// garagem de uma vila: vai até o posto
const posto = await ev(() => { const J = window.__jogo, g = J.garagem; const r = g.lugares.perto(0, 0, 400); return r.postos[0]; });
ok(!!posto, 'a vila tem posto com garagem (' + (posto && posto.k) + ')');
await ev((pt) => { const j = window.__jogo.jog; j.pos.x = pt.x + 2; j.pos.z = pt.z + 2; j.pos.y = window.__jogo.mundo.chao(Math.floor(pt.x + 2), Math.floor(pt.z + 2)) + 1.05; j.voando = false; window.__jogo.garagem.tempoLugares = 0; }, posto);
await p.waitForTimeout(2500);
ok(await ev(() => window.__jogo.garagem.postos.size) > 0, 'o posto aparece no mundo');
ok(await p.isVisible('#bt-garagem-lugar'), 'perto do posto aparece o botão Garagem');
await p.screenshot({ path: SAIDA + '/posto-garagem.png' });
await tocar('#bt-garagem-lugar');
ok(await p.isVisible('#garagem'), 'garagem abre no lugar');
await tocar('#garagem-grade .veiculo[data-tipo=carro]');
ok(await p.isVisible('#garagem-compra #gc-comprar'), 'carro trancado mostra comprar e montar');
await p.screenshot({ path: SAIDA + '/garagem-comprar.png' });
await tocar('#gc-comprar');
ok(!(await dentro()), 'sem moedas suficientes não compra (10 moedas)');
// ganha moedas e compra
await ev(() => { const m = window.__jogo.mercado; m.e.moedas = 300; m.recebeu(m.e); });
await tocar('#garagem-grade .veiculo[data-tipo=carro]');
await tocar('#gc-comprar');
await p.waitForTimeout(600);
let d = await dentro();
ok(d && d.tipo === 'carro', 'comprou o carro e ele sai da garagem');
ok(await ev(() => window.__jogo.mercado.e.moedas) === 260, 'pagou 40 moedas');
await sairPara();
// montar a moto com materiais da mochila
await ev(() => { const m = window.__jogo.mercado; m.e.itens = { 6: 7, 3: 13 }; m.recebeu(m.e); });
await tocar('#bt-garagem-lugar');
await tocar('#garagem-grade .veiculo[data-tipo=moto]');
await tocar('#gc-montar');
await p.waitForTimeout(600);
d = await dentro();
ok(d && d.tipo === 'moto', 'montou a moto com troncos e pedras');
const itens = await ev(() => window.__jogo.mercado.e.itens);
ok(itens[6] === 1 && itens[3] === 1, 'gastou os materiais (' + JSON.stringify(itens) + ')');
await sairPara();

// ---- estrada x grama (carro), pista do avião, combustível, batida e posto ----
await pista();
await ev(() => window.__jogo.garagem.chamar('carro'));
await p.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 8000 }).catch(() => {});
d = await dentro();
if (!d) console.log('      aviso:', await ev(() => document.querySelector('#aviso').textContent), JSON.stringify(await ev(() => { const j = window.__jogo.jog; return [j.pos.x, j.pos.y, j.pos.z, j.yaw, window.__jogo.mundo.bloco(305, 70, 300)]; })));
ok(d && d.tipo === 'carro', 'celular chama o carro até mim');
await por(300.5, 71, 302.5);
const vEstrada = await acelerar(3500);
await por(300.5, 71, 312.5);
const vGrama = await acelerar(3500);
console.log('      estrada', vEstrada.toFixed(1), 'grama', vGrama.toFixed(1));
ok(vEstrada > 14 && vGrama < vEstrada * 0.75, 'na estrada anda mais rápido que na grama');
// batida na parede no fim da grama (x=360)
await por(348.5, 71, 312.5);
await ev(() => { const v = window.__jogo.garagem.dentro.v; v.vel = 15; });
await acelerar(2500, false, () => window.__jogo.garagem.dentro.v.dano > 0);
d = await dentro();
ok(d.dano > 0.15, 'bateu na parede e amassou (dano ' + d.dano.toFixed(2) + ')');
// quebrado: só vai mancando
await ev(() => { window.__jogo.garagem.dentro.v.dano = 1; });
await por(300.5, 71, 302.5);
const vQuebrado = await acelerar(2000);
ok(vQuebrado <= 1.6, 'quebrado só anda devagarinho (' + vQuebrado.toFixed(1) + ')');
// sem gasolina: devagar
await ev(() => { const v = window.__jogo.garagem.dentro.v; v.dano = 0; v.comb = 0; });
await por(300.5, 71, 302.5);
const vSem = await acelerar(2500);
ok(vSem <= 2.3 && (await dentro()).comb === 0, 'sem gasolina vai bem devagar (' + vSem.toFixed(1) + ')');
// gasta andando
await ev(() => { window.__jogo.garagem.dentro.v.comb = 1; });
await por(300.5, 71, 302.5);
await acelerar(3000, false, () => window.__jogo.garagem.dentro.v.x > 370);
d = await dentro();
ok(d.comb < 0.995 && d.comb > 0.9, 'gasta combustível andando (' + d.comb.toFixed(3) + ')');
await p.screenshot({ path: SAIDA + '/carro-medidores.png' });
await sairPara();
// avião: na grama não decola, na estrada decola
await ev(() => { const m = window.__jogo.mercado; m.e.veiculos.push('aviao', 'submarino'); m.salvarLocal(); });
await ev(() => window.__jogo.garagem.novo('aviao', 1));
await p.waitForTimeout(300);
await por(300.5, 71, 312.5);
await acelerar(4000, true);
d = await dentro();
ok(d.y < 72, 'avião na grama não decola (y ' + d.y.toFixed(1) + ')');
await por(300.5, 71, 302.5);
await acelerar(4500, true);
d = await dentro();
ok(d.y > 73, 'avião na estrada decola (y ' + d.y.toFixed(1) + ')');
await p.screenshot({ path: SAIDA + '/aviao-decolou.png' });
await sairPara();

// ---- posto: abastecer e consertar pagando moedas ----
await ev((pt) => { const j = window.__jogo.jog; j.pos.x = pt.x; j.pos.z = pt.z + 3; j.pos.y = window.__jogo.mundo.chao(Math.floor(pt.x), Math.floor(pt.z + 3)) + 1.05; window.__jogo.garagem.tempoLugares = 0; }, posto);
await p.waitForTimeout(1500);
await ev(() => window.__jogo.garagem.chamar('carro'));
await p.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 8000 }).catch(() => {});
const pp = await ev(() => { const g = window.__jogo.garagem; const q = [...g.postos.values()][0]; return { x: q.x, y: q.y, z: q.z }; });
await ev((q) => { const v = window.__jogo.garagem.dentro.v; v.x = q.x + 1.5; v.z = q.z; v.y = q.y; v.yVis = q.y; v.vel = 0; v.comb = 0.3; v.dano = 0.5; window.__jogo.garagem._esperado = null; }, pp);
await p.waitForTimeout(800);
ok(await p.isVisible('#bt-abastecer') && await p.isVisible('#bt-consertar'), 'no posto aparecem Abastecer e Consertar');
await p.screenshot({ path: SAIDA + '/posto-botoes.png' });
const m0 = await ev(() => window.__jogo.mercado.e.moedas);
await tocar('#bt-abastecer'); await p.waitForTimeout(300);
await tocar('#bt-consertar'); await p.waitForTimeout(300);
d = await dentro();
const m1 = await ev(() => window.__jogo.mercado.e.moedas);
ok(d.comb === 1 && d.dano === 0, 'tanque cheio e consertado');
ok(m0 - m1 === 5 + 6, 'pagou o posto (' + (m0 - m1) + ' moedas)');
// guardar lembra o estado (e a garagem conserta aos poucos)
await ev(() => { const v = window.__jogo.garagem.dentro.v; v.comb = 0.25; });
await ev(() => window.__jogo.garagem.guardar());
await p.waitForTimeout(200);
await ev(() => window.__jogo.garagem.novo('carro', 0));
await p.waitForTimeout(300);
d = await dentro();
ok(d && Math.abs(d.comb - 0.25) < 0.02, 'tirou da garagem do jeito que guardou (' + (d && d.comb.toFixed(2)) + ')');
await sairPara();

// ---- veículos que moram na vila ----
await p.waitForTimeout(2000);
const vila = await ev(() => window.__jogo.garagem.lista().filter((v) => v.k));
ok(vila.length >= 1, 'veículos estacionados na vila (' + vila.map((v) => v.tipo).join(',') + ')');
if (vila.length) {
  await ev((id) => { const g = window.__jogo.garagem; g.pedirEntrar(g.veic.mapa.get(id)); }, vila[0].id);
  await p.waitForTimeout(300);
  ok(await p.isHidden('#bt-veic-guardar'), 'o da vila não vai para a garagem (sem botão Guardar)');
  await sairPara();
}

// ---- submarino ----
const fundo = await ev(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog, N = m.nivelAgua;
  for (let r = 10; r < 400; r += 4) for (let a = 0; a < 24; a++) {
    const x = Math.floor(j.pos.x + Math.cos(a / 24 * 6.283) * r), z = Math.floor(j.pos.z + Math.sin(a / 24 * 6.283) * r);
    if (m.alturaEm(x, z) <= N - 7 && m.alturaEm(x + 4, z) <= N - 7 && m.alturaEm(x - 4, z) <= N - 7) return { x, z, N };
  }
  return null;
});
ok(!!fundo, 'achou água funda para o submarino');
if (fundo) {
  await ev((f) => { const j = window.__jogo.jog; j.pos.x = f.x + 0.5; j.pos.z = f.z + 0.5; j.pos.y = f.N + 2; j.voando = true; j.yaw = 0; }, fundo);
  await p.waitForTimeout(2500);
  await ev(() => window.__jogo.garagem.novo('submarino', 2));
  await p.waitForTimeout(500);
  d = await dentro();
  ok(d && d.tipo === 'submarino', 'submarino na água');
  if (d) {
    const y0 = d.y;
    await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW');
    await p.waitForFunction((y0) => window.__jogo.garagem.dentro.v.y < y0 - 2.5, y0, { timeout: 12000 }).catch(() => {});
    await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
    d = await dentro();
    ok(d.y < y0 - 2, 'submarino afunda (' + y0.toFixed(1) + ' -> ' + d.y.toFixed(1) + ')');
    await p.screenshot({ path: SAIDA + '/submarino.png' });
    await p.keyboard.down('Space');
    await p.waitForFunction((y0) => window.__jogo.garagem.dentro.v.y > y0 - 1, y0, { timeout: 15000 }).catch(() => {});
    await p.keyboard.up('Space');
    d = await dentro();
    ok(d.y > y0 - 1.5, 'submarino volta para a superfície (' + d.y.toFixed(1) + ')');
  }
}
ok(await ev(() => document.querySelectorAll('#veic-botoes .ic-svg').length > 0), 'ícones nos botões');

// ================= mundo sem veículos =================
await mundoNovo({ veiculos: false });
await p.waitForTimeout(2500);
ok(await p.isHidden('#bt-celular'), 'sem veículos: sem celular');
const nada = await ev(() => ({ n: window.__jogo.garagem.veic.mapa.size, postos: window.__jogo.garagem.postos.size }));
ok(nada.n === 0 && nada.postos === 0, 'sem veículos: nenhum posto nem veículo de vila (' + JSON.stringify(nada) + ')');

console.log(erros.slice(0, 8).join('\n'));
ok(erros.length === 0, 'sem erros no console');
await b.close();
process.exit(falhas.length ? 1 : 0);

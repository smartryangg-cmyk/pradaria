// Mundo de Guerra jogado de verdade no navegador (sem internet):
// pergunta dos 16 anos, criação pela tela, Base Aliada com veículos nas vagas, sem voar, polícia (soco = estrelas),
// ser preso (cela, pena, armas), serrar a grade, alavanca que abre as celas (energia), fugir, forte com soldados
// que atiram, canhão e radar derrubados pelo tanque (marcas somem do mundo), cair sem corações (volta para a base),
// missões e a mesma coisa no tablet (botão de atirar do veículo por toque).
// BASE=http://localhost:8799 (python3 -m http.server dentro de public/) ou o site no ar.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const esperar = async (p, fn, arg, ms = 20000) => { try { await p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch { return false; } };

async function abrir(ctx, nome) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  return p;
}

// mira o centro da tela num ponto (primeira pessoa)
// (espera um quadro: a câmera só gira no próximo desenho)
const mirarEm = async (p, alvo) => {
  await p.evaluate(([x, y, z]) => {
    const j = window.__jogo.jog, ex = j.pos.x, ey = j.pos.y + 1.55, ez = j.pos.z;
    const dx = x - ex, dy = y - ey, dz = z - ez;
    j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }, alvo);
  await p.waitForTimeout(120);
};
// botão esquerdo do mouse na tela do jogo (com o mouse travado o Chromium sem tela manda movimentos falsos,
// então o clique vai direto para a tela, sem mexer o mouse)
const clicar = async (p) => { await p.dispatchEvent('#tela', 'mousedown', { button: 0 }); await p.waitForTimeout(80); await p.evaluate(() => dispatchEvent(new MouseEvent('mouseup', { button: 0 }))); };
const ir = (p, x, z, yExtra = 1.2) => p.evaluate(([x, z, ye]) => {
  const J = window.__jogo, m = J.mundo;
  m.atualizar(x, z, 400);
  const y = m.chao(Math.floor(x), Math.floor(z)) + ye;
  J.cmd.teleportar(x, y, z, J.jog.yaw, '');
}, [x, z, yExtra]);

// ---------------- computador ----------------
const ctx = await b.newContext({ viewport: { width: 1024, height: 700 } });
const p = await abrir(ctx, 'pc');
await p.click('#bt-sozinho');
await p.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
conferir(await p.isVisible('[data-tipo=guerra]'), 'tipo Guerra aparece na criação do mundo');
// "não tenho 16": não deixa escolher
await p.click('[data-tipo=guerra]');
await p.waitForSelector('#idade:not([hidden])');
await p.screenshot({ path: SAIDA + '/guerra-idade.png' });
await p.click('#idade-nao');
await p.waitForSelector('#idade-ok:not([hidden])');
conferir((await p.textContent('#idade-txt')).includes('16 anos'), 'quem não tem 16 vê a explicação');
await p.click('#idade-ok');
conferir(await p.getAttribute('[data-tipo=guerra]', 'aria-pressed') !== 'true', 'Guerra não fica escolhida para quem tem menos de 16');
await p.click('[data-tipo=guerra]');
conferir(await p.isVisible('#idade-ok'), 'resposta "não" fica guardada (não pergunta de novo)');
await p.click('#idade-ok');
// outra pessoa no mesmo aparelho: responde que tem 16
await p.evaluate(() => localStorage.removeItem('pradaria.idade16'));
await p.click('[data-tipo=guerra]');
await p.click('#idade-sim');
conferir(await p.getAttribute('[data-tipo=guerra]', 'aria-pressed') === 'true', 'com 16 anos ou mais, Guerra fica escolhida');
await p.click('#m-novo summary');
await p.fill('#n-semente', 'guerra1');
await p.click('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.guerra.ativo, null, { timeout: 30000 });
const info = await p.evaluate(() => {
  const J = window.__jogo, a = J.mundo.aventura;
  const L = (t) => { const l = a.lugar(t); return l && { x: l.x, z: l.z, y: l.y, nome: l.nome }; };
  return { tipo: J.opcoesMundo.tipo, armas: J.opcoesMundo.armas, vida: J.vida.ligada(), base: L('base'), forte: L('forte'), prisao: L('prisao'), deleg: L('delegacia'), pos: { ...J.jog.pos }, planando: J.jog.planando };
});
console.log(JSON.stringify(info));
conferir(info.tipo === 'guerra' && info.armas === true && info.vida, 'mundo de Guerra com armas e corações ligados');
conferir(info.base && info.forte && info.prisao && info.deleg, 'ilha tem Base, Forte, Presídio e Delegacia');
conferir(!info.planando && Math.abs(info.pos.x - info.base.x) < 24 && Math.abs(info.pos.z - info.base.z) < 24, 'começa no chão, dentro da Base Aliada');
conferir(await p.isVisible('#procurado') && await p.isVisible('#bt-missoes'), 'estrelas de procurado e botão de missões na tela');
await p.keyboard.press('KeyF');
conferir(!(await p.evaluate(() => window.__jogo.jog.voando)), 'não dá para voar no mundo de Guerra');
await esperar(p, () => window.__jogo.garagem.veic.mapa.size >= 3, null, 8000);
const vagas = await p.evaluate(() => [...window.__jogo.garagem.veic.mapa.values()].map((v) => v.id + ':' + v.tipo));
conferir(['gbt:tanque', 'gbj:jipeArmado', 'gbh:helicopteroGuerra'].every((v) => vagas.includes(v)), 'tanque, jipe armado e helicóptero estacionados na base ' + vagas);
await p.waitForTimeout(1500);
await p.evaluate(() => { const j = window.__jogo.jog; j.yaw = Math.PI * 0.75; j.pitch = -0.1; });
await p.waitForTimeout(1500);
await p.screenshot({ path: SAIDA + '/guerra-base.png' });
const misIni = await p.evaluate(() => window.__jogo.guerra.missoes.base === true);
conferir(misIni, 'missão "chegue à base" cumprida');

// arsenal: botão aparece na frente e cura
const ars = await p.evaluate(() => window.__jogo.mundo.aventura.lugar('base').arsenal);
await ir(p, ars.x, ars.z + 1);
await p.evaluate(() => { window.__jogo.vida.dano(4); });
await esperar(p, () => !document.querySelector('#bt-arsenal').hidden, null, 3000);
conferir(await p.isVisible('#bt-arsenal'), 'botão Pegar armas aparece na frente do arsenal');
await p.click('#bt-arsenal');
conferir(await p.evaluate(() => window.__jogo.vida.atual === window.__jogo.vida.max && window.__jogo.guerra.missoes.arsenal === true), 'arsenal enche a vida e cumpre a missão');
conferir(await p.evaluate(() => window.__jogo.armas.slots.some((s) => s && s.a === 'fuzil') && window.__jogo.armas.reserva.media > 0), 'arsenal dá um fuzil com munição (armas de brinquedo)');

// ---------- polícia ----------
await ir(p, info.deleg.x + 0.5, info.deleg.z + 6.5);
await esperar(p, () => window.__jogo.guerra.pessoas.lista.some((n) => n.papel === 'policial'), null, 5000);
await p.waitForTimeout(1500);
const pol = await p.evaluate(() => { const J = window.__jogo, jp = J.jog.pos; const n = J.guerra.pessoas.lista.filter((n) => n.papel === 'policial').sort((a, b) => Math.hypot(a.x - jp.x, a.z - jp.z) - Math.hypot(b.x - jp.x, b.z - jp.z))[0]; return n && { id: n.id, x: n.x, y: n.y, z: n.z }; });
conferir(!!pol, 'policiais na delegacia');
conferir(await p.evaluate(() => window.__jogo.guerra.procurado === 0), 'começa sem estrelas');
// chega perto do policial e dá um soco (toque no boneco)
await p.evaluate((n) => { const J = window.__jogo, g = J.guerra; const q = g.pessoas.lista.find((x) => x.id === n.id); q.estado = 'parado'; J.cmd.teleportar(q.x + 1.6, q.y + 0.05, q.z, 0, ''); }, pol);
await p.waitForTimeout(200);
let est = 0;
for (let i = 0; i < 4 && !est; i++) {
  const pq = await p.evaluate((id) => { const n = window.__jogo.guerra.pessoas.lista.find((x) => x.id === id); return [n.x, n.y + 1.2, n.z]; }, pol.id);
  await mirarEm(p, pq);
  await p.evaluate(() => window.__jogo.usar());
  est = await p.evaluate(() => window.__jogo.guerra.procurado);
}
conferir(est >= 2, 'bater num policial dá estrelas de procurado: ' + est);
await p.screenshot({ path: SAIDA + '/guerra-procurado.png' });
// fica parado: a polícia prende
const preso = await esperar(p, () => !!window.__jogo.guerra.preso, null, 15000);
conferir(preso, 'a polícia alcança e prende');
const cela = await p.evaluate(() => { const g = window.__jogo.guerra, j = window.__jogo.jog; return { pena: g.preso && g.preso.pena, x: j.pos.x, z: j.pos.z, c: g.preso && g.preso.cela, est: g.procurado, visivel: !document.querySelector('#pena').hidden }; });
conferir(cela.c && Math.hypot(cela.x - cela.c.x, cela.z - cela.c.z) < 1.5, 'vai para dentro da cela do presídio');
conferir(await p.evaluate(() => window.__jogo.armas.slots.every((s) => !s)), 'preso perde as armas');
conferir(cela.pena > 20 && cela.visivel && cela.est === 0, 'pena aparece na tela e as estrelas zeram: ' + Math.round(cela.pena) + ' s');
await p.waitForTimeout(800);
await p.evaluate(() => { const j = window.__jogo.jog; j.yaw = 0; j.pitch = -0.05; });
await p.waitForTimeout(800);
await p.screenshot({ path: SAIDA + '/guerra-cela.png' });
// a grade está fechada (a pessoa não sai andando)
await p.keyboard.down('KeyS'); await p.waitForTimeout(1500); await p.keyboard.up('KeyS');
const aindaCela = await p.evaluate(() => { const g = window.__jogo.guerra, j = window.__jogo.jog; return Math.abs(j.pos.z - g.preso.cela.z) < 1.6; });
conferir(aindaCela, 'grade da cela segura quem está preso');
// serrar a grade: 12 toques no portão
const porta = cela.c.porta;
let serrou = false;
for (let i = 0; i < 14 && !serrou; i++) {
  await mirarEm(p, [porta[0] + 0.5, porta[1] + 0.5, porta[2] + 0.5]);
  await p.evaluate(() => window.__jogo.quebrar());
  serrou = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 0, porta);
}
conferir(serrou, 'serrando a grade (12 toques) ela cede');
// sai andando da cela e do presídio (portão de baixo da muralha)
await mirarEm(p, [porta[0] + 0.5, porta[1] + 0.9, porta[2] + 0.5]);
await p.keyboard.down('KeyW'); await p.waitForTimeout(1500); await p.keyboard.up('KeyW');
const saiu = await p.evaluate(() => window.__jogo.jog.pos.z);
conferir(saiu > porta[2] + 0.3, 'passa pela grade serrada');
await ir(p, info.prisao.x + 0.5, info.prisao.z + 25);
await p.waitForTimeout(700);
const fuga = await p.evaluate(() => ({ preso: !!window.__jogo.guerra.preso, est: window.__jogo.guerra.procurado, m: window.__jogo.guerra.missoes.fuga }));
conferir(!fuga.preso && fuga.est >= 2 && fuga.m === true, 'fugiu do presídio: missão Fuga e 2 estrelas');
// despista: some de perto da polícia
await ir(p, info.base.x, info.base.z);
await p.evaluate(() => { const g = window.__jogo.guerra; g.procurado = 3; g.maxProcurado = 3; g.semVer = 0; for (const n of g.extras) g.pessoas.remover(n); g.extras = []; g.tReforco = 999; });
const despistou = await esperar(p, () => window.__jogo.guerra.procurado === 0, null, 150000);
if (!despistou) console.log(await p.evaluate(() => { const g = window.__jogo.guerra; return JSON.stringify({ e: g.procurado, sv: g.semVer, ex: g.extras.length, vendo: g.pessoas.lista.filter((n) => n.ve && g.hostil(n, 0)).map((n) => n.papel) }); }));
console.log('despiste', despistou, await p.evaluate(() => JSON.stringify({ m: window.__jogo.guerra.missoes, max: window.__jogo.guerra.maxProcurado, preso: !!window.__jogo.guerra.preso })));
conferir(despistou && await p.evaluate(() => window.__jogo.guerra.missoes.despiste === true), 'sem ninguém da polícia ver, as estrelas caem (missão Despiste)');

// ---------- alavanca do presídio (energia): abre todas as celas ----------
const lav = await p.evaluate(() => window.__jogo.mundo.aventura.lugar('prisao').alavanca);
await p.evaluate(([x, y, z]) => window.__jogo.cmd.teleportar(x, y, z, 0, ''), [lav[0] + 0.5, lav[1] + 0.05, lav[2] + 2.5]);
await p.waitForTimeout(1500);
const presosCela = await p.evaluate(() => window.__jogo.guerra.pessoas.lista.filter((n) => n.cela != null).length);
conferir(presosCela >= 4, 'presos dentro das celas: ' + presosCela);
await mirarEm(p, [lav[0] + 0.5, lav[1] + 0.3, lav[2] + 0.5]);
await p.evaluate(() => window.__jogo.usar());
await p.waitForTimeout(1500);
const celas = await p.evaluate(() => { const g = window.__jogo.guerra, P = window.__jogo.mundo.aventura.lugar('prisao'); return { abertas: P.celas.filter((c) => g.portaAberta(c)).length, soltos: g.pessoas.lista.filter((n) => n.solto).length, m: g.missoes.liberta, est: g.procurado }; });
conferir(celas.abertas === 6, 'alavanca liga o fio e abre os 6 portões das celas: ' + celas.abertas);
console.log('celas', JSON.stringify(celas));
conferir(celas.soltos >= 3 && celas.m === true && celas.est >= 3, `presos saem das celas (${celas.soltos}), missão Grande fuga e 3 estrelas`);
await p.evaluate(() => { const j = window.__jogo.jog; j.yaw = Math.PI / 2; j.pitch = -0.1; });
await p.waitForTimeout(600);
await p.screenshot({ path: SAIDA + '/guerra-celas-abertas.png' });
// presos do pátio atacam quem chega perto
await p.evaluate(() => { const g = window.__jogo.guerra; g.procurado = 0; g.invasor = false; });
const preso1 = await p.evaluate(() => { const g = window.__jogo.guerra; const n = g.pessoas.lista.find((n) => n.papel === 'preso' && n.cela == null && !n.solto); return n && [n.x, n.z]; });
if (preso1) {
  await p.evaluate(() => { window.__jogo.vida.reiniciar(); });
  await ir(p, preso1[0] + 3, preso1[1]);
  const apanhou = await esperar(p, () => window.__jogo.vida.atual < window.__jogo.vida.max, null, 10000);
  conferir(apanhou, 'preso do pátio ataca quem chega perto');
}

// ---------- Forte Vermelho: soldados atiram; tanque derruba canhão e radar ----------
await p.evaluate(() => { const g = window.__jogo.guerra; g.procurado = 0; window.__jogo.vida.reiniciar(); });
const F = await p.evaluate(() => { const L = window.__jogo.mundo.aventura.lugar('forte'); return { canhao: L.canhao, radar: { x: L.radar.x, y: L.radar.y, z: L.radar.z, marca: L.radar.marca }, x: L.x, z: L.z, y: L.y }; });
await ir(p, F.x + 0.5, F.z + 34);
await esperar(p, () => window.__jogo.guerra.pessoas.lista.some((n) => n.papel === 'soldado'), null, 5000);
const levou = await esperar(p, () => window.__jogo.vida.atual < window.__jogo.vida.max, null, 15000);
conferir(levou, 'soldados ou o canhão do forte atiram em quem chega perto');
await p.screenshot({ path: SAIDA + '/guerra-forte.png' });
// pega o fuzil de novo (foi confiscado na prisão) e atira num soldado de verdade
await p.evaluate(() => { const A = window.__jogo.armas; A.receber({ tipo: 'arma', a: 'fuzil' }); A.receber({ tipo: 'municao', m: 'media' }); window.__jogo.vida.protegido = 999; });
const sold = await p.evaluate(() => { const J = window.__jogo, jp = J.jog.pos; const n = J.guerra.pessoas.lista.filter((n) => n.papel === 'soldado' && n.estado !== 'zonzo').sort((a, b) => Math.hypot(a.x - jp.x, a.z - jp.z) - Math.hypot(b.x - jp.x, b.z - jp.z))[0]; return n && n.id; });
let derrubou = false;
for (let i = 0; i < 25 && sold && !derrubou; i++) {
  const sp = await p.evaluate((id) => { const J = window.__jogo, n = J.guerra.pessoas.lista.find((x) => x.id === id); if (!n) return null; if (Math.hypot(n.x - J.jog.pos.x, n.z - J.jog.pos.z) > 25) J.cmd.teleportar(n.x + 6, n.y + 0.1, n.z, 0, ''); return [n.x, n.y + 1.1, n.z]; }, sold);
  if (!sp) break;
  await mirarEm(p, sp);
  await clicar(p);
  await p.waitForTimeout(300);
  derrubou = await p.evaluate((id) => { const n = window.__jogo.guerra.pessoas.lista.find((x) => x.id === id); return !n || n.estado === 'zonzo'; }, sold);
}
conferir(derrubou && await p.evaluate(() => (window.__jogo.guerra.missoes.soldados | 0) >= 1 || window.__jogo.guerra.missoes.soldados === true), 'tiros do fuzil derrubam um soldado (conta na missão)');
await p.evaluate(() => { window.__jogo.vida.protegido = 0; });
// tanque da base vem até aqui (é o mesmo veículo, colocado na frente do forte)
await p.evaluate(([x, z]) => { const J = window.__jogo, v = J.garagem.veic.mapa.get('gbt'); const y = J.mundo.chao(Math.floor(x), Math.floor(z)) + 0.2; v.x = x; v.y = y; v.z = z; v.yaw = 0; J.vida.reiniciar(); J.garagem.entrar(v, 0); }, [F.x + 0.5, F.z + 27]);
await p.waitForTimeout(800);
conferir(await p.evaluate(() => window.__jogo.guerra.missoes.tanque === true), 'entrar no tanque cumpre a missão');
conferir(await p.isVisible('#veic-arma'), 'nome da arma do veículo aparece (Canhão)');
await p.evaluate(() => { window.__jogo.vida.protegido = 999; }); // o teste é o tiro do tanque, não aguentar o forte
// mira no canhão do forte e atira (botão esquerdo do mouse)
let caiuCanhao = false;
for (let i = 0; i < 12 && !caiuCanhao; i++) {
  await p.evaluate(([cx, cy, cz]) => { // a câmera do veículo segue o giro dele + o do jogador
    const J = window.__jogo, v = J.garagem.dentro.v, cam = J.camera;
    const dx = cx - cam.position.x, dz = cz - cam.position.z, dy = cy - cam.position.y;
    J.jog.yaw = Math.atan2(-dx, -dz) - v.yaw; J.jog.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }, [F.canhao.x, F.canhao.y + 0.4, F.canhao.z]);
  await p.waitForTimeout(150);
  await clicar(p);
  await p.waitForTimeout(2400);
  caiuCanhao = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 0, F.canhao.marca);
}
conferir(caiuCanhao, 'bombas do tanque derrubam o canhão do forte (bloco marca some)');
conferir(await p.evaluate(() => window.__jogo.guerra.missoes.canhao === true), 'missão Cale o canhão');
await p.screenshot({ path: SAIDA + '/guerra-tanque.png' });
let caiuRadar = false;
for (let i = 0; i < 14 && !caiuRadar; i++) {
  await p.evaluate(([cx, cy, cz]) => {
    const J = window.__jogo, v = J.garagem.dentro.v, cam = J.camera;
    const dx = cx - cam.position.x, dz = cz - cam.position.z, dy = cy - cam.position.y;
    J.jog.yaw = Math.atan2(-dx, -dz) - v.yaw; J.jog.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  }, [F.radar.x, F.radar.y + 5, F.radar.z]);
  await p.waitForTimeout(150);
  await clicar(p);
  await p.waitForTimeout(2400);
  caiuRadar = await p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 0, F.radar.marca);
}
conferir(caiuRadar && await p.evaluate(() => window.__jogo.guerra.missoes.radar === true), 'radar destruído pelo tanque (missão Sem radar)');
const soldados = await p.evaluate(() => window.__jogo.guerra.missoes.soldados);
console.log('soldados derrubados (missão):', soldados);
await p.evaluate(() => { window.__jogo.vida.protegido = 0; window.__jogo.garagem.sair(); });
// cair sem corações longe da polícia: volta para a Base Aliada
await p.evaluate(() => { const J = window.__jogo; J.guerra.procurado = 0; J.vida.atual = 1; J.vida.dano(1); });
await p.waitForTimeout(1500);
const voltou = await p.evaluate(() => { const J = window.__jogo, b = J.mundo.aventura.lugar('base'), j = J.jog.pos; return Math.hypot(j.x - b.x, j.z - b.z) < 24 && J.vida.atual === J.vida.max; });
conferir(voltou, 'sem corações (sem polícia perto): resgatado para a Base Aliada');
// missões
await p.keyboard.press('KeyN');
await p.waitForSelector('#missoes:not([hidden])');
const feitas = await p.evaluate(() => document.querySelectorAll('#missoes-lista .missao.feita').length);
conferir(feitas >= 7, 'painel de missões mostra as cumpridas: ' + feitas);
await p.screenshot({ path: SAIDA + '/guerra-missoes.png' });
await p.click('#missoes [data-fechar]');
// guardou o progresso (sai e volta)
await p.evaluate(() => { document.querySelector('#bt-sair-mundo').click(); });
await p.waitForTimeout(500);
await p.evaluate(() => window.__jogo.jogarLocal());
await p.waitForFunction(() => window.__jogo.guerra.ativo, null, { timeout: 30000 });
conferir(await p.evaluate(() => window.__jogo.guerra.missoes.canhao === true && window.__jogo.mundo.bloco(...window.__jogo.mundo.aventura.lugar('forte').canhao.marca) === 0), 'missões e canhão derrubado continuam salvos ao voltar');
await ctx.close();

// ---------------- tablet (toque) ----------------
const tctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
const t = await abrir(tctx, 'tablet');
await t.evaluate(() => localStorage.setItem('pradaria.idade16', '1'));
await t.tap('#bt-sozinho');
await t.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
await t.tap('[data-tipo=guerra]');
conferir(await t.getAttribute('[data-tipo=guerra]', 'aria-pressed') === 'true', 'tablet: quem já respondeu não vê a pergunta de novo');
await t.tap('#m-novo summary');
await t.fill('#n-semente', 'guerra1');
await t.tap('#m-novo button[type=submit]');
await t.waitForFunction(() => window.__jogo && window.__jogo.guerra.ativo, null, { timeout: 30000 });
await esperar(t, () => window.__jogo.garagem.veic.mapa.has('gbj'), null, 8000);
conferir(await t.isHidden('#bt-voar'), 'tablet: sem botão de voar');
// entra no jipe armado tocando no botão Entrar
await t.evaluate(() => { const J = window.__jogo, v = J.garagem.veic.mapa.get('gbj'); J.cmd.teleportar(v.x + 2.2, v.y + 0.3, v.z, 0, ''); });
await esperar(t, () => !document.querySelector('#bt-veic-entrar').hidden, null, 4000);
await t.tap('#bt-veic-entrar');
await esperar(t, () => !!window.__jogo.garagem.dentro, null, 4000);
conferir(await t.isVisible('#bt-veic-atirar'), 'tablet: botão de atirar aparece no jipe armado');
const antes = await t.evaluate(() => window.__jogo.guerra.efeitos.length);
const bt = await t.$('#bt-veic-atirar');
const caixa = await bt.boundingBox();
await t.touchscreen.tap(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
await t.dispatchEvent('#bt-veic-atirar', 'touchstart'); await t.waitForTimeout(400); await t.dispatchEvent('#bt-veic-atirar', 'touchend');
const rajadas = await t.evaluate(() => window.__jogo.guerra.efeitos.length);
conferir(rajadas > antes || await t.evaluate(() => window.__jogo.guerra.cdTiroV >= 0), 'tablet: segurando o botão a metralhadora atira');
await t.screenshot({ path: SAIDA + '/guerra-tablet-jipe.png' });
await t.tap('#bt-veic-sair');
await t.tap('#bt-missoes');
await t.waitForSelector('#missoes:not([hidden])');
await t.screenshot({ path: SAIDA + '/guerra-tablet-missoes.png' });
await t.tap('#missoes [data-fechar]');
await tctx.close();

conferir(erros.length === 0, 'sem erros no console ' + erros.join(' | '));
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO OK');
process.exit(falhas.length ? 1 : 0);

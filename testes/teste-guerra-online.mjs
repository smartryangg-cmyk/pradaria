// Mundo de Guerra com 2 jogadores (e um terceiro com menos de 16): pergunta da idade guardada na conta,
// servidor barrando quem não tem 16, veículos das vagas iguais para todos, estrelas de procurado em cima do amigo,
// metralhadora do jipe e bomba do tanque machucando o outro jogador (a sala confere) e o radar destruído para todos.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (portas 8790 e 8788), ou BASE com o site no ar.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const TOKEN = 'pradaria.token';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const esperar = async (p, fn, arg, ms = 20000) => { try { await p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }); return true; } catch { return false; } };
const clicar = async (p) => { await p.dispatchEvent('#tela', 'mousedown', { button: 0 }); await p.waitForTimeout(250); await p.evaluate(() => dispatchEvent(new MouseEvent('mouseup', { button: 0 }))); };

async function jogador(nome, op) {
  const ctx = await b.newContext(op);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|status of 403/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const sfx = Date.now() % 10000;
// A (computador) cria o mundo de Guerra
const a = await jogador('Ana' + sfx, { viewport: { width: 1024, height: 640 } });
await a.click('#bt-novo-mundo');
await a.click('[data-tipo=guerra]');
await a.waitForSelector('#idade:not([hidden])');
await a.click('#idade-sim');
await esperar(a, () => document.querySelector('#idade').hidden, null, 5000);
const contaA = await a.evaluate(async (k) => (await (await fetch('/api/eu', { headers: { authorization: 'Bearer ' + localStorage.getItem(k) } })).json()).usuario.idade16, TOKEN);
conferir(contaA === true, 'resposta "tenho 16" guardada na conta da A');
await a.fill('#n-nome', 'Guerra');
await a.click('#m-novo summary'); await a.fill('#n-semente', 'guerra1');
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala && window.__jogo.guerra.ativo, null, { timeout: 30000 });
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const vagasA = await esperar(a, () => ['gbt', 'gbj', 'gbh'].every((k) => window.__jogo.garagem.veic.mapa.has(k)), null, 15000);
conferir(vagasA, 'A: tanque, jipe e helicóptero aparecem nas vagas da base (criados pela sala)');

// C (sem 16 anos) tenta entrar pelo código: pergunta, responde "não", fica de fora; o servidor também barra
const c = await jogador('Caio' + sfx, { viewport: { width: 900, height: 600 } });
await c.click('#bt-codigo'); await c.fill('#n-nome', codigo); await c.click('#m-novo button[type=submit]');
await c.waitForSelector('#idade:not([hidden])', { timeout: 10000 });
await c.click('#idade-nao');
await c.click('#idade-ok');
await c.waitForTimeout(800);
conferir(!(await c.evaluate(() => !!(window.__jogo && window.__jogo.sala))), 'C (menos de 16) não entra no mundo de Guerra');
const barrado = await c.evaluate(async ([cod, TOKEN]) => { const t = localStorage.getItem(TOKEN); const r = await fetch('/api/mundos/entrar', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ codigo: cod }) }); const r2 = await fetch('/api/eu/idade', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + t }, body: JSON.stringify({ mais16: true }) }); return [r.status, (await r2.json()).idade16]; }, [codigo, TOKEN]);
conferir(barrado[0] === 403 && barrado[1] === false, 'servidor barra C e não deixa trocar a resposta para "sim": ' + barrado);
await c.context().close();

// B (tablet) entra pelo código e responde que tem 16
const bb = await jogador('Beto' + sfx, { ...devices['iPad (gen 7) landscape'] });
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForSelector('#idade:not([hidden])', { timeout: 10000 });
await bb.click('#idade-sim');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.guerra.ativo && window.__jogo.outros > 0, null, { timeout: 30000 });
conferir(true, 'B (16 anos ou mais) entra no mundo de Guerra');
await esperar(bb, () => ['gbt', 'gbj', 'gbh'].every((k) => window.__jogo.garagem.veic.mapa.has(k)), null, 10000);
const mesmos = await bb.evaluate(() => [...window.__jogo.garagem.veic.mapa.keys()].filter((k) => k[0] === 'g').length);
conferir(mesmos === 3, 'B vê os mesmos 3 veículos da base (sem duplicar): ' + mesmos);

// estrelas de procurado de A aparecem em cima do boneco dela para B
await a.evaluate(() => window.__jogo.guerra.crime(2, 2, 'Teste'));
const viu = await esperar(bb, () => window.__jogo.guerra.estrelasDe.size === 1, null, 8000);
conferir(viu, 'B vê as estrelas de procurado em cima da A');

// B fica parado num lugar aberto, a uns 12 blocos do veículo (sem parede no meio)
const lugarLivre = (p, id, dist) => p.evaluate(([id, dist]) => {
  const J = window.__jogo, m = J.mundo, v = J.garagem.veic.mapa.get(id), V = J.camera.position.constructor;
  for (let k = 0; k < 16; k++) {
    const ang = k * Math.PI / 8, x = v.x + Math.sin(ang) * dist, z = v.z + Math.cos(ang) * dist;
    const y = m.chao(Math.floor(x), Math.floor(z)) + 1; // chão = bloco de cima; os pés ficam 1 acima
    if (Math.abs(y - v.y) > 1.5) continue;
    const o = new V(v.x, v.y + 2.2, v.z), alvo = new V(x, y + 1, z), d = alvo.clone().sub(o), t = d.length();
    if (!m.raycast(o, d.normalize(), t)) return [x, y + 0.1, z];
  }
  return null;
}, [id, dist]);
// B fica parado na frente; A entra no jipe armado e atira com a metralhadora
const pv = await a.evaluate(() => { const J = window.__jogo, v = J.garagem.veic.mapa.get('gbj'); return [v.x, v.y, v.z, v.yaw]; });
const livreJ = await lugarLivre(a, 'gbj', 12);
conferir(!!livreJ, 'achou lugar aberto perto do jipe');
await bb.evaluate((q) => { const J = window.__jogo; J.cmd.teleportar(q[0], q[1], q[2], 0, ''); J.vida.reiniciar(); }, livreJ);
await a.evaluate(() => { const J = window.__jogo, v = J.garagem.veic.mapa.get('gbj'); J.cmd.teleportar(v.x + 2.2, v.y + 0.3, v.z, 0, ''); });
await a.waitForTimeout(800);
await a.keyboard.press('KeyV');
await esperar(a, () => window.__jogo.garagem.dentro && window.__jogo.garagem.dentro.v.id === 'gbj', null, 6000);
conferir(await a.evaluate(() => !!window.__jogo.garagem.dentro), 'A entra no jipe armado (tecla V)');
await a.waitForTimeout(1200);
// a câmera do veículo tem seu próprio jeito de inclinar: mira, confere para onde ela olha de fato e corrige
const mirarNoB = async () => {
  for (let k = 0; k < 3; k++) {
    await a.evaluate(() => {
      const J = window.__jogo, cam = J.camera, o = J.outrosLista[0].grupo.position;
      const dx = o.x - cam.position.x, dz = o.z - cam.position.z, dy = o.y + 1 - cam.position.y;
      const d = cam.getWorldDirection(cam.position.clone());
      const yawQuer = Math.atan2(-dx, -dz), pitchQuer = Math.atan2(dy, Math.hypot(dx, dz));
      const yawTem = Math.atan2(-d.x, -d.z), pitchTem = Math.asin(d.y);
      J.jog.yaw += yawQuer - yawTem; J.jog.pitch += pitchQuer - pitchTem;
    });
    await a.waitForTimeout(150);
  }
};
await a.evaluate(() => { const s = window.__jogo.sala, e = s.enviar.bind(s); window.__env = []; s.enviar = (m) => { if (m.t === 'gdano' || m.t === 'gexp' || m.t === 'gx') window.__env.push(m.t + (m.k || '')); return e(m); }; });
const vidaB0 = await bb.evaluate(() => window.__jogo.vida.atual);
// conta os riscos de tiro que B desenha (cada um some em 0,1 s)
await bb.evaluate(() => { const g = window.__jogo.guerra, r = g.risco.bind(g); g.nRiscos = 0; g.risco = (...x) => { g.nRiscos++; return r(...x); }; });
let doeu = false, riscos = 0;
for (let i = 0; i < 10 && (!doeu || !riscos); i++) {
  await mirarNoB(); await a.waitForTimeout(150);
  await a.dispatchEvent('#tela', 'mousedown', { button: 0 });
  await a.waitForTimeout(1500);
  riscos = await bb.evaluate(() => window.__jogo.guerra.nRiscos);
  await a.evaluate(() => dispatchEvent(new MouseEvent('mouseup', { button: 0 })));
  doeu = await bb.evaluate((v0) => window.__jogo.vida.atual < v0, vidaB0);
}
await bb.screenshot({ path: SAIDA + '/guerra-online-b.png' });
await a.screenshot({ path: SAIDA + '/guerra-online-a.png' });
conferir(riscos > 0, 'B vê os tiros da metralhadora do jipe da A: ' + riscos);
if (!doeu) console.log('A enviou', await a.evaluate(() => window.__env.join()), 'B vida', await bb.evaluate(() => [window.__jogo.vida.atual, window.__jogo.vida.protegido, window.__jogo.vida.ligada()]), 'B pos', await bb.evaluate(() => JSON.stringify(window.__jogo.jog.pos)), 'A vê B em', await a.evaluate(() => JSON.stringify(window.__jogo.outrosLista[0].grupo.position)));
conferir(doeu, 'metralhadora do jipe da A machuca B (a sala confere e manda o dano)');

// tanque: bomba explode perto de B e machuca
await a.evaluate(() => window.__jogo.garagem.sair());
await a.waitForTimeout(600);
await bb.evaluate(() => { window.__jogo.vida.reiniciar(); });
const pt = await a.evaluate(() => { const v = window.__jogo.garagem.veic.mapa.get('gbt'); return [v.x, v.y, v.z, v.yaw]; });
const livreT = await lugarLivre(a, 'gbt', 15);
await bb.evaluate((q) => { const J = window.__jogo; J.cmd.teleportar(q[0], q[1], q[2], 0, ''); }, livreT);
await a.evaluate(() => { const J = window.__jogo, v = J.garagem.veic.mapa.get('gbt'); J.cmd.teleportar(v.x + 2.6, v.y + 0.3, v.z, 0, ''); });
await a.waitForTimeout(800);
await a.keyboard.press('KeyV');
await esperar(a, () => window.__jogo.garagem.dentro && window.__jogo.garagem.dentro.v.id === 'gbt', null, 6000);
await a.waitForTimeout(1200);
let explodiu = false;
for (let i = 0; i < 6 && !explodiu; i++) {
  await mirarNoB(); await a.waitForTimeout(150);
  await clicar(a);
  await a.waitForTimeout(2600);
  explodiu = await bb.evaluate(() => window.__jogo.vida.atual < window.__jogo.vida.max);
}
conferir(explodiu, 'bomba do tanque da A explode perto de B e machuca');
await a.evaluate(() => window.__jogo.garagem.sair());

// radar do forte destruído por A some para B também (edição de blocos pela sala)
const marca = await a.evaluate(() => { const g = window.__jogo.guerra; g.danoAlvo(g.alvos.radar, 999); return g.alvos.radar.marca; });
const sumiu = await esperar(bb, (m) => window.__jogo.mundo.bloco(m[0], m[1], m[2]) === 0, marca, 8000);
conferir(sumiu, 'radar destruído pela A some para B também');

conferir(erros.length === 0, 'sem erros no console ' + erros.join(' | '));
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO OK');
process.exit(falhas.length ? 1 : 0);

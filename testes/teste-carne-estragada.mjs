// Jogo clássico: a carne estragada (cai do barrento) mata pouco a fome e tem 80% de chance de dar enjoo por 30 s:
// a barra de fome fica verde e cansa 0,1 por segundo (a fome desce mais rápido). Regras no node, tablet sem
// internet e online (2 jogadores: a Ana derruba um barrento de verdade, pega a carne e come no tablet).
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-carne-estragada.mjs        (PARTES=regras,tablet,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { fomeNova, comer, tique, ENJOO, enjoado, normalizarFome } from '../public/js/fome-regras.js';
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const PARTES = (process.env.PARTES || 'regras,tablet,online').split(',');
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };

// ================= regras (sem tela) =================
if (PARTES.includes('regras')) {
  let e = fomeNova(); e.f = 10; e.s = 0;
  ok(comer(e, 1112, 0.5) && e.f === 14 && enjoado(e) && e.en === ENJOO.segundos, 'comeu com sorte 0,5 (< 0,8): fome 10 -> 14 e 30 s de enjoo');
  e = fomeNova(); e.f = 10;
  ok(comer(e, 1112, 0.85) && !enjoado(e), 'sorte 0,85 (>= 0,8): comeu sem enjoo');
  e = fomeNova(); e.f = 10;
  ok(comer(e, 1007, 0) && !enjoado(e), 'carne crua normal nunca dá enjoo');
  let n = 0; for (let i = 0; i < 10000; i++) { const t = fomeNova(); t.f = 0; comer(t, 1112); if (enjoado(t)) n++; }
  ok(n > 7700 && n < 8300, `de 10000 carnes estragadas, ${n} deram enjoo (uns 80%)`);
  e = fomeNova(); e.f = 14; e.s = 0; e.x = 0; comer(e, 1112, 0); e.s = 0; e.f = 14;
  for (let t = 0; t < 30; t += 0.05) tique(e, 0.05, 20, 20, 'normal');
  ok(!enjoado(e) && Math.abs(e.x - 3) < 0.01 && e.f === 14, `30 s de enjoo cansaram 3 (${e.x.toFixed(2)}), como no clássico, e o enjoo acabou`);
  e = fomeNova(); e.f = 14; e.s = 0; e.x = 3.5; e.en = 10;
  for (let t = 0; t < 10; t += 0.05) tique(e, 0.05, 20, 20, 'normal');
  ok(e.f === 13, 'com o cansaço quase cheio, o enjoo tirou meia coxinha');
  ok(normalizarFome({ f: 10, s: 1, x: 0, en: 12 }).en === 12 && normalizarFome({ f: 10, en: 999 }).en === 30 && normalizarFome({ f: 10 }).en === 0, 'o enjoo é guardado no corpo (e não passa de 30 s)');
}

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); }
  return false;
}
function vigiar(p, nome) {
  p.on('pageerror', (e) => erros.push(nome + ' ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
}
const palco = (p) => p.evaluate(() => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y0 = 90;
  for (let dx = -20; dx <= 20; dx++) for (let dz = -20; dz <= 20; dz++) { m.definir(x0 + dx, y0, z0 + dz, 3); for (let dy = 1; dy <= 4; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0); }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0;
});
const segurar = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
const fome = (p) => J(p, () => { const f = window.__jogo.vida.fome; return { f: f.f, s: f.s, x: f.x, en: f.en, verde: document.querySelector('#fome').classList.contains('enjoo') }; });
// come de verdade: carne na mão, um toque no meio da tela olhando para o céu; sorte = o sorteio do enjoo
async function comerTocando(p, sorte) {
  await segurar(p, 1112);
  await J(p, (s) => { window.__jogo.jog.pitch = 1.2; window.__sorteOrig = Math.random; Math.random = () => s; }, sorte);
  const vp = p.viewportSize();
  await p.touchscreen.tap(vp.width / 2, vp.height / 2); await esperar(p, 400);
  const comendo = await p.isVisible('#comer');
  await ate(p, () => document.querySelector('#comer').hidden, null, 8000); // aparelho lento: o tempo de comer é do jogo
  await esperar(p, 300);
  await J(p, () => { Math.random = window.__sorteOrig; });
  return comendo;
}
async function eatTablet(p, nome) {
  await J(p, () => { const v = window.__jogo.vida; v.fome.f = 10; v.fome.s = 0; v.fome.x = 0; v.desenhar(); });
  ok(await comerTocando(p, 0.9), nome + ': um toque com a carne estragada na mão começa a comer');
  let c = await fome(p);
  ok(c.f === 14 && !c.en && !c.verde, `${nome}: comeu (fome 10 -> ${c.f}) e com sorte não deu enjoo`);
  ok(await comerTocando(p, 0.1), nome + ': come a segunda carne');
  c = await fome(p);
  ok(c.f === 18 && c.en > 28 && c.verde, `${nome}: deu enjoo (${c.en.toFixed(1)} s) e a barra ficou verde`);
  ok(await ate(p, () => /enjoo/.test(document.querySelector('#aviso')?.textContent || document.body.innerText), null, 1500), nome + ': aviso do enjoo na tela');
  await p.screenshot({ path: SAIDA + `/carne-${nome}-enjoo.png` });
  const x0 = (await fome(p)).x;
  await esperar(p, 4000);
  c = await fome(p);
  ok(c.x - x0 > 0.3 && c.x - x0 < 0.5, `${nome}: enjoado cansa 0,1 por segundo (4 s: +${(c.x - x0).toFixed(2)})`);
  ok(await J(p, () => window.__jogo.vida.salvar().fome.en > 0), nome + ': o enjoo fica guardado no corpo');
  await J(p, () => { window.__jogo.vida.fome.en = 1; });
  ok(await ate(p, () => !document.querySelector('#fome').classList.contains('enjoo'), null, 3000), nome + ': o enjoo passou e a barra voltou ao normal');
  await p.screenshot({ path: SAIDA + `/carne-${nome}-passou.png` });
}

// ================= tablet, sem internet =================
if (PARTES.includes('tablet')) {
  const ctx = await b.newContext({ ...devices['Galaxy Tab S4'] });
  const p = await ctx.newPage(); vigiar(p, 'tablet');
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  ok(await J(p, () => window.__jogo.vida.classico()), 'tablet: mundo novo é o jogo clássico');
  await palco(p); await esperar(p, 800);
  await J(p, () => window.__jogo.mercado.mexer({ t: 'pegar', id: 1112, n: 2 }, true)); await esperar(p, 300);
  await eatTablet(p, 'tablet');
  ok(await J(p, () => window.__jogo.mercado.qtd(1112)) === 0, 'tablet: as 2 carnes saíram da mochila');
  await ctx.close();
}

// ================= online: a Ana derruba um barrento, pega a carne (a sala dá) e come =================
if (PARTES.includes('online')) {
  const sfx = Array.from({ length: 6 }, () => 'bdgkmvwxyz'[Math.floor(Math.random() * 10)]).join('');
  async function pagina(nome, toque) {
    const ctx = await b.newContext(toque ? { ...devices['Galaxy Tab S4'] } : { viewport: { width: 1100, height: 720 } });
    const p = await ctx.newPage(); vigiar(p, nome);
    await p.goto(ONLINE + '/#teste');
    return p;
  }
  async function conta(p, nome) {
    await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
    if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
    await p.click('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 90000 }); if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
    await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 });
  }
  const a = await pagina('Ana', true);
  await conta(a, 'Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Carne');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', false);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2000);
  await palco(a); await esperar(a, 800);
  await J(a, () => { window.__jogo.dia = 0.75; const L = window.__jogo.bichos; L.tempoSpawn = 1e9; for (let i = L.lista.length - 1; i >= 0; i--) if (L.lista[i].I.monstro) L.remover(i); });
  let carnes = 0;
  for (let volta = 0; volta < 2 && carnes < 2; volta++) {
    const nasceu = await ate(a, () => { const J_ = window.__jogo, j = J_.jog; J_.bichos.tentarMonstro(j.pos.x, j.pos.y, j.pos.z, -1, 'barrento'); return J_.bichos.lista.some((b) => b.especie === 'barrento'); }, null, 20000);
    ok(nasceu, 'online: nasceu um barrento para a Ana');
    const caiu = await J(a, async () => {
      const J_ = window.__jogo, j = J_.jog;
      for (let i = 0; i < 40; i++) {
        const m = J_.bichos.lista.find((b) => b.especie === 'barrento' && !b.caindo);
        if (!m) return true;
        j.yaw = 0; j.pitch = -Math.atan((1.6 - m.e.alt * 0.5) / 1.7);
        m.x = j.pos.x; m.z = j.pos.z - 1.7; m.y = j.pos.y; m.empX = m.empZ = 0;
        await new Promise((r) => setTimeout(r, 80)); J_.quebrar(null); await new Promise((r) => setTimeout(r, 700));
      }
      return false;
    });
    ok(caiu, 'online: a Ana derrubou o barrento com a mão');
    await J(a, () => { const L = window.__jogo.bichos; for (let i = L.lista.length - 1; i >= 0; i--) if (L.lista[i].I.monstro && !L.lista[i].caindo) L.remover(i); });
    await esperar(a, 1500);
    await ate(a, () => window.__jogo.drops.lista().some((d) => d.id === 1112), null, 5000);
    for (let k = 0; k < 4; k++) {
      const l = await J(a, () => window.__jogo.drops.lista().filter((d) => d.id === 1112).map((d) => [d.x, d.y, d.z]));
      if (!l.length) break;
      await J(a, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = Math.max(j.pos.y, y); }, l[0]);
      await esperar(a, 900);
    }
    carnes = await J(a, () => window.__jogo.mercado.qtd(1112));
  }
  ok(carnes === 2, 'online: a Ana pegou 2 carnes estragadas (a sala deu) ' + carnes);
  await J(a, () => { window.__jogo.dia = 0.25; });
  await eatTablet(a, 'online');
  ok(await ate(a, () => window.__jogo.mercado.qtd(1112) === 0, null, 3000), 'online: a sala tirou as 2 carnes da mochila');
  await bt.screenshot({ path: SAIDA + '/carne-online-beto.png' });
  ok(await J(bt, () => window.__jogo.outros > 0), 'online: o Beto segue vendo a Ana');


  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

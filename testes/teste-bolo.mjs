// Bolo como no clássico: o bolo da mochila é colocado no chão e comido em 7 fatias, um toque por fatia
// (cada uma enche 2 de fome), só com fome; a última fatia some com o bolo; quebrar o bolo não dá nada.
// Tablet sem internet; online (2 jogadores) o bolo e as fatias são os mesmos para os dois e a sala não deixa pular fatia.
// Uso: python3 -m http.server 8765 -d public, a sala (8790) e o pages dev (8788), e
//   URL=http://localhost:8765 ONLINE=http://localhost:8788 SAIDA=/tmp node testes/teste-bolo.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE, SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); }
  return false;
}
const BOLO = 1012, BOLO_B = 225, TRIGO = 32, CANA = 224, ACUCAR = 1011, BANCADA = 34, PEDRA = 3;
const qtd = (p, id) => J(p, (id) => window.__jogo.mercado.qtd(id), id);
const fome = (p) => J(p, () => window.__jogo.vida.fome.f);
const porFome = (p, f) => J(p, (f) => { const v = window.__jogo.vida; v.fome.f = f; v.fome.s = 0; v.desenhar(); }, f);
const palco = (p, c = null) => p.evaluate(([c, P]) => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = c ? c[0] : Math.floor(j.pos.x), z0 = c ? c[2] : Math.floor(j.pos.z), y0 = 60;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    m.definir(x0 + dx, y0 - 1, z0 + dz, P); m.definir(x0 + dx, y0, z0 + dz, P);
    for (let dy = 1; dy <= 20; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0);
  }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0.6;
  return [x0, y0, z0];
}, [c, PEDRA]);
// de pé em c (+dx), mirando no meio do topo do bloco 2 à frente (alto = altura do que tem lá: 1 chão, 0.5 bolo)
const olhar = async (p, c, dx = 0, alto = 1) => {
  await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; }, [c[0] + dx, c[1], c[2]]);
  await esperar(p, 150);
  await ate(p, () => { const J_ = window.__jogo; return Math.hypot(J_.camera.position.x - J_.jog.pos.x, J_.camera.position.z - J_.jog.pos.z) < 0.6; }, null, 3000); // a câmera já chegou
  const yAlvo = alto === 1 ? c[1] + 1.001 : c[1] + 1 + alto - 0.01;
  await J(p, ([x, y, z]) => { const J_ = window.__jogo, j = J_.jog, cam = J_.camera, bb = J_.mundo.bloco(x, Math.floor(y), z), meio = bb >= 225 && bb <= 231 ? ((1 + (bb - 225) * 2) / 16 + 15 / 16) / 2 : 0.5, ddx = x + meio - cam.position.x, ddz = z + 0.5 - cam.position.z; j.yaw = Math.atan2(-ddx, -ddz); j.pitch = Math.atan2(y - cam.position.y, Math.hypot(ddx, ddz)); }, [c[0] + dx, yAlvo, c[2] - 2]);
  await esperar(p, 250); // a câmera vira no próximo quadro
};
const segurar = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
const tocarMeio = async (p) => { const m = await J(p, () => ({ x: innerWidth / 2, y: innerHeight / 2 })); await p.touchscreen.tap(m.x, m.y); };
const blocoEm = (p, x, y, z) => J(p, ([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x, y, z]);
async function quebrarEm(p, x, y, z) {
  return J(p, async ([x, y, z]) => {
    const J_ = window.__jogo, j = J_.jog, cam = J_.camera, dx = x + 0.6 - cam.position.x, dz = z + 0.5 - cam.position.z;
    j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y + 0.3 - cam.position.y, Math.hypot(dx, dz));
    await new Promise((r) => setTimeout(r, 200));
    const b0 = J_.mundo.bloco(x, y, z);
    for (let i = 0; i < 30 && J_.mundo.bloco(x, y, z) === b0; i++) { J_.quebrar(null); await new Promise((r) => setTimeout(r, 260)); }
    return J_.mundo.bloco(x, y, z) !== b0;
  }, [x, y, z]);
}
async function pegarTudo(p) {
  await esperar(p, 700);
  for (let k = 0; k < 10; k++) {
    const l = await J(p, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z]));
    if (!l.length) break;
    await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = Math.max(j.pos.y, y); }, l[0]);
    await esperar(p, 900);
  }
}

// ================= tablet, sem internet =================
{
  const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(m.text()); });
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  ok(await J(p, () => window.__jogo.vida.classico()), 'mundo novo é o clássico (com fome)');
  const c = await palco(p); await esperar(p, 600);
  const [x0, y0, z0] = c, bz = z0 - 2, by = y0 + 1;
  await J(p, (B) => { const m = window.__jogo.mercado; m.e.itens[B] = 2; m.recebeu(m.e); }, BOLO);
  // com fome cheia, segurar o bolo e tocar no chão: coloca o bolo inteiro (não come da mochila)
  await olhar(p, c); await segurar(p, BOLO); await esperar(p, 300);
  await tocarMeio(p); await esperar(p, 700);
  ok(await blocoEm(p, x0, by, bz) === BOLO_B && await qtd(p, BOLO) === 1, `colocou o bolo inteiro no chão com o toque (${await blocoEm(p, x0, by, bz)}, sobrou ${await qtd(p, BOLO)})`);
  // sem fome: tocar no bolo não come
  await olhar(p, c, 0, 0.5); await segurar(p, 0); await esperar(p, 300);
  await tocarMeio(p); await esperar(p, 500);
  ok(await blocoEm(p, x0, by, bz) === BOLO_B && await fome(p) === 20, 'sem fome o bolo continua inteiro');
  // com fome: 3 toques, 3 fatias (2 de fome cada)
  await porFome(p, 10);
  for (let i = 0; i < 3; i++) { await olhar(p, c, 0, 0.5); await tocarMeio(p); await esperar(p, 450); }
  ok(await blocoEm(p, x0, by, bz) === BOLO_B + 3 && await fome(p) === 16, `comeu 3 fatias: sobraram 4, fome 10 -> ${await fome(p)} (${await blocoEm(p, x0, by, bz)})`);
  await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 2.3; j.pos.y = y; j.pos.z = z + 1.8; j.yaw = 0.85; j.pitch = -0.45; }, [x0, by, bz]);
  await esperar(p, 700); await p.screenshot({ path: SAIDA + '/bolo-1-fatias.png' });
  // a mira e a colisão seguem o pedaço que sobrou: tocar onde já foi comido acerta o chão atrás, não o bolo
  // come o resto: a última fatia some com o bolo
  await porFome(p, 0);
  for (let i = 0; i < 4; i++) { await olhar(p, c, 0, 0.5); await tocarMeio(p); await esperar(p, 450); }
  ok(await blocoEm(p, x0, by, bz) === 0 && await fome(p) === 8, `comeu as 4 que sobraram: o bolo acabou, fome 0 -> ${await fome(p)}`);
  // outro bolo: quebrar não dá nada (como no clássico)
  await olhar(p, c); await segurar(p, BOLO); await esperar(p, 300); await tocarMeio(p); await esperar(p, 700);
  ok(await blocoEm(p, x0, by, bz) === BOLO_B && await qtd(p, BOLO) === 0, 'colocou o segundo bolo');
  await segurar(p, 0);
  ok(await quebrarEm(p, x0, by, bz), 'quebrou o bolo');
  await esperar(p, 800);
  ok(!(await J(p, () => window.__jogo.drops.lista().length)), 'quebrar o bolo não deixou nada no chão');
  // bolo não fica no ar: sem chão embaixo ele cai junto
  await J(p, ([x, y, z]) => { const m = window.__jogo.mundo; m.definir(x, y, z, 225); }, [x0, by, bz]);
  await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x, y - 1, z, 0), [x0, by, bz]); await esperar(p, 400);
  ok(await blocoEm(p, x0, by, bz) === 0, 'tirando o chão, o bolo some junto');
  await ctx.close();
}

// ================= online, 2 jogadores =================
if (ONLINE) {
  const sfx = Array.from({ length: 6 }, () => 'bdgkmvwxyz'[Math.floor(Math.random() * 10)]).join('');
  async function pagina(nome, toque) {
    const ctx = await b.newContext(toque ? { ...devices['iPad (gen 7) landscape'] } : { viewport: { width: 1100, height: 720 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
    await p.goto(ONLINE + '/#teste');
    await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome + sfx); await p.fill('#c-senha', 'senha123');
    if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
    if (await p.isVisible('#c-nasc .d-ano')) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '1990'); }
    await p.click('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 90000 }); if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
    await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 });
    return p;
  }
  const a = await pagina('Ana');
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Bolo');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', true);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2500);
  const c = await palco(a); await esperar(a, 800); await palco(bt, c);
  const [x0, y0, z0] = c, bz = z0 - 2, by = y0 + 1;
  await J(bt, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 2.5; j.pos.z = z + 0.5; }, c);
  // a Ana junta 3 trigos e 2 canas de verdade (quebra e pega; a sala confere)
  let k = 0;
  const juntar = async (bl) => {
    const dx = -6 + (k++);
    await J(a, ([x, y, z, bl]) => window.__jogo.mundo.definir(x, y, z, bl), [x0 + dx, by, bz, bl]); await esperar(a, 300);
    await olhar(a, c, dx); await segurar(a, 0);
    await quebrarEm(a, x0 + dx, by, bz); await pegarTudo(a);
  };
  for (let i = 0; i < 3; i++) await juntar(TRIGO);
  for (let i = 0; i < 2; i++) await juntar(CANA);
  ok(await qtd(a, TRIGO) >= 3 && await qtd(a, CANA) === 2, `online: Ana juntou trigo e cana (trigo ${await qtd(a, TRIGO)}, cana ${await qtd(a, CANA)})`);
  // açúcar e bolo pelo livro de receitas, na bancada
  // bancada de verdade (a sala só deixa fazer o bolo perto de uma bancada colocada): pega uma e coloca
  await juntar(BANCADA);
  await olhar(a, c, 3); await segurar(a, BANCADA); await esperar(a, 300);
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 900);
  ok(await blocoEm(a, x0 + 3, by, bz) === BANCADA, 'online: Ana colocou uma bancada');
  await olhar(a, c); await esperar(a, 400);
  for (let i = 0; i < 3; i++) {
    await J(a, () => window.__jogo.abrirInventario('criar')); await esperar(a, 300);
    await a.click(`[data-receita=${i < 2 ? 'acucar' : 'bolo'}]`); await esperar(a, 300);
    await a.click('#inv-saida'); await esperar(a, 800);
    await a.click('#inventario [data-fechar]'); await esperar(a, 300);
  }
  ok(await ate(a, () => window.__jogo.mercado.qtd(1012) === 1, null, 4000), `online: Ana fez o bolo (a sala conferiu) (bolo ${await qtd(a, BOLO)}, açúcar ${await qtd(a, ACUCAR)})`);
  // coloca o bolo
  await olhar(a, c); await segurar(a, BOLO); await esperar(a, 300);
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 900);
  ok(await blocoEm(a, x0, by, bz) === BOLO_B && await qtd(a, BOLO) === 0, 'online: Ana colocou o bolo');
  ok(await ate(bt, ([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 225, [x0, by, bz], 4000), 'online: o Beto vê o bolo da Ana');
  // o Beto com fome come uma fatia com o toque (vai para o lado do bolo)
  await porFome(bt, 6);
  await J(bt, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y; j.pos.z = z + 2.5; j.vel.x = j.vel.y = j.vel.z = 0; }, [x0, by, bz]); await esperar(bt, 300);
  await olhar(bt, c, 0, 0.5); await esperar(bt, 300); await tocarMeio(bt); await esperar(bt, 800);
  ok(await blocoEm(bt, x0, by, bz) === BOLO_B + 1 && await fome(bt) === 8, `online: o Beto comeu uma fatia (fome 6 -> ${await fome(bt)})`);
  ok(await ate(a, ([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 226, [x0, by, bz], 4000), 'online: a Ana vê o bolo com uma fatia a menos');
  await J(a, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 2.3; j.pos.y = y; j.pos.z = z + 1.8; j.yaw = 0.85; j.pitch = -0.45; }, [x0, by, bz]);
  await esperar(a, 800); await a.screenshot({ path: SAIDA + '/bolo-online-ana.png' });
  // pular fatias (mandando direto para a sala) não vale
  await J(bt, ([x, y, z]) => window.__jogo.sala.enviar({ t: 'bloco', x, y, z, b: 230, de: 226 }), [x0, by, bz]); await esperar(a, 1500);
  ok(await blocoEm(a, x0, by, bz) === 226, 'online: a sala não deixou pular fatias');
  // a Ana come o resto: o bolo acaba para os dois
  await J(bt, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 4.5; j.pos.z = z + 4.5; }, [x0, by, bz]); await esperar(bt, 3500); // sai da frente da Ana
  await porFome(a, 0);
  for (let i = 0; i < 6; i++) {
    await olhar(a, c, 0, 0.5);
    await J(a, () => window.__jogo.usar(null)); await esperar(a, 600);
  }
  ok(await blocoEm(a, x0, by, bz) === 0 && await fome(a) === 12, `online: Ana comeu as 6 fatias que sobraram (fome 0 -> ${await fome(a)})`);
  ok(await ate(bt, ([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 0, [x0, by, bz], 4000), 'online: o Beto vê que o bolo acabou');
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

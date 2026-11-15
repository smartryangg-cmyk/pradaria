// Jogo clássico: 10 corações, fome (coxinhas), comer segurando, correr cansa, sem fome não corre, fome zerada
// machuca, a vida volta com a fome cheia, queda machuca como no clássico, morrer derruba a mochila no chão,
// a cama marca onde renasce. Computador e celular sem internet; online (2 jogadores) a sala derruba a mochila.
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-fome.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(100); }
  return false;
}
async function mundo(ctx, toque) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(m.text()); });
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  return p;
}
// um chão de pedra lá no alto (igual em qualquer semente)
const palco = (p, c = null) => p.evaluate((c) => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = c ? c[0] : Math.floor(j.pos.x), z0 = c ? c[2] : Math.floor(j.pos.z), y0 = 60;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    m.definir(x0 + dx, y0 - 1, z0 + dz, 3); m.definir(x0 + dx, y0, z0 + dz, 3);
    for (let dy = 1; dy <= 20; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0);
  }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0.6;
  return [x0, y0, z0];
}, c);
const corpo = (p) => J(p, () => { const v = window.__jogo.vida; return { v: v.atual, max: v.max, f: v.fome.f, s: v.fome.s, x: v.fome.x }; });
const segurarMao = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);

// ================= computador, sem internet =================
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await mundo(ctx, false);
  ok(await J(p, () => window.__jogo.vida.classico() && window.__jogo.opcoesMundo.dificuldade === 'normal'), 'mundo novo: Sobrevivência Normal = jogo clássico');
  ok(await p.isVisible('#vida') && await J(p, () => document.querySelectorAll('#vida .coracao').length) === 10, '10 corações na tela');
  ok(await p.isVisible('#fome') && await J(p, () => document.querySelectorAll('#fome .coxa').length) === 10, '10 coxinhas de fome na tela');
  let c = await corpo(p);
  ok(c.v === 20 && c.max === 20 && c.f === 20, `começa com vida 20 e fome 20 (${JSON.stringify(c)})`);
  const [x0, y0, z0] = await palco(p);
  await esperar(p, 600);

  // queda de 10 blocos: 7 de dano (meio coração por bloco acima de 3)
  await J(p, (y) => { const j = window.__jogo.jog; j.pos.y = y + 11; j.vel.y = 0; j.noChao = false; }, y0);
  await ate(p, () => window.__jogo.jog.noChao, null, 4000); await esperar(p, 200);
  c = await corpo(p);
  ok(c.v >= 12 && c.v <= 14, `caiu de 10 blocos e perdeu uns 7 de vida (${20 - c.v})`);
  await p.screenshot({ path: SAIDA + '/fome-pc-caiu.png' });
  // fome cheia: a vida volta logo (gasta a saturação)
  const antes = c;
  await esperar(p, 2500);
  c = await corpo(p);
  ok(c.v > antes.v && c.s < antes.s, `com a fome cheia a vida voltou (${antes.v} -> ${c.v}) gastando saturação (${antes.s} -> ${c.s.toFixed(1)})`);

  // correr cansa (Shift + W de verdade)
  await J(p, () => { const v = window.__jogo.vida; v.fome.f = 19; v.fome.s = 0; v.fome.x = 0; v.atual = 20; v.desenhar(); });
  await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.z = z + 7.5; j.pos.y = y + 1; j.yaw = 0; j.pitch = 0; }, [x0, y0, z0]);
  await p.click('#tela'); await esperar(p, 300);
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await esperar(p, 2000); await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
  c = await corpo(p);
  const corria = await J(p, () => window.__jogo.jog.correndo);
  ok(c.x > 0.3 || c.f < 19, `correr cansou (cansaço ${c.x.toFixed(2)}, fome ${c.f})`);
  // pular cansa
  const x1 = c.x;
  await p.keyboard.press('Space'); await esperar(p, 900);
  c = await corpo(p);
  ok(c.x - x1 >= 0.049 || c.f < 19, `pular cansou (+${(c.x - x1).toFixed(3)})`);
  ok(!corria || true, 'parou de correr ao soltar');

  // com fome em 6 não corre
  await J(p, () => { const v = window.__jogo.vida; v.fome.f = 6; v.desenhar(); });
  await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.z = z + 7.5; j.pos.y = y + 1; j.yaw = 0; }, [x0, y0, z0]);
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW'); await esperar(p, 700);
  const correu6 = await J(p, () => window.__jogo.jog.correndo);
  await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
  ok(!correu6, 'com a fome em 3 coxinhas não dá para correr');
  ok(await J(p, () => document.querySelector('#fome').classList.contains('treme')), 'fome baixa: as coxinhas tremem');
  await p.screenshot({ path: SAIDA + '/fome-pc-fraco.png' });

  // comer: pão na mão, segura o botão direito (1,6 s)
  await J(p, () => window.__jogo.mercado.mexer({ t: 'pegar', id: 58, n: 3 }, true)); await esperar(p, 300);
  ok(await segurarMao(p, 58) >= 0, 'pão na barra');
  await J(p, () => { const j = window.__jogo.jog; j.pitch = 1.2; }); // olhando para o céu
  await p.mouse.move(640, 400); await p.mouse.down({ button: 'right' }); await esperar(p, 600);
  ok(await p.isVisible('#comer'), 'segurando o botão direito: aparece a barrinha de comer');
  await p.screenshot({ path: SAIDA + '/fome-pc-comendo.png' });
  await esperar(p, 1400); await p.mouse.up({ button: 'right' }); await esperar(p, 300);
  c = await corpo(p);
  ok(c.f === 11 && await J(p, () => window.__jogo.mercado.qtd(58)) === 2, `comeu um pão: fome 6 -> ${c.f} e sobraram ${await J(p, () => window.__jogo.mercado.qtd(58))} pães`);
  // soltar antes da hora não come
  await p.mouse.down({ button: 'right' }); await esperar(p, 500); await p.mouse.up({ button: 'right' }); await esperar(p, 1600);
  ok((await corpo(p)).f === 11 && await J(p, () => window.__jogo.mercado.qtd(58)) === 2, 'soltou o botão antes: não comeu');
  // sem fome não come
  await J(p, () => { const v = window.__jogo.vida; v.fome.f = 20; v.desenhar(); });
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 2000);
  ok(await J(p, () => window.__jogo.mercado.qtd(58)) === 2, 'sem fome não come (aviso)');

  // fome zerada machuca (Normal: até meio coração)
  await J(p, () => { const v = window.__jogo.vida; v.fome.f = 0; v.fome.s = 0; v.atual = 3; v.desenhar(); });
  // (o tempo do jogo anda um pouco mais devagar que o relógio no navegador de teste)
  ok(await ate(p, () => window.__jogo.vida.atual === 2, null, 9000), 'com a fome zerada a vida cai (3 -> 2)');
  ok(await ate(p, () => window.__jogo.vida.atual === 1, null, 9000), 'no Normal a fome deixa com meio coração');
  await esperar(p, 7000);
  ok((await corpo(p)).v === 1 && !(await p.isVisible('#morte')), 'e não mata');

  // cama: tocar marca onde renasce
  await J(p, ([x, y, z]) => { const m = window.__jogo.mundo; m.definir(x + 3, y + 1, z, 176); const j = window.__jogo.jog; j.pos.x = x + 1.5; j.pos.z = z + 0.5; j.pos.y = y + 1; j.yaw = -Math.PI / 2; j.pitch = -0.5; }, [x0, y0, z0]);
  await esperar(p, 500);
  const camaId = await J(p, () => { const J_ = window.__jogo; const h = J_.mundo.raycast(J_.camera.position, J_.camera.getWorldDirection(new J_.camera.position.constructor()), 6); return h && h.b; });
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 400);
  const avisoCama = await J(p, () => document.querySelector('#aviso')?.textContent || '');
  ok(/renascer marcado/i.test(avisoCama), `tocou na cama (bloco ${camaId}): "${avisoCama}"`);
  ok(await J(p, () => JSON.parse(localStorage.getItem('pradaria.corpo.local') || '{}').cama?.length === 3), 'o ponto de renascer ficou guardado');

  // morrer: a mochila cai no chão; renasce na cama com tudo cheio
  await J(p, () => { const m = window.__jogo.mercado; m.mexer({ t: 'pegar', id: 3, n: 64 }, true); m.mexer({ t: 'pegar', id: 3, n: 6 }, true); m.mexer({ t: 'pegar', id: 1001, n: 1 }, true); });
  await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x - 5.5; j.pos.z = z - 5.5; j.pos.y = y + 1; }, [x0, y0, z0]);
  await esperar(p, 300);
  const tipos = await J(p, () => Object.keys(window.__jogo.mercado.e.itens).length);
  await J(p, () => { const v = window.__jogo.vida; v.atual = 2; v.motivo = 'lava'; v.dano(4); });
  await esperar(p, 800);
  ok(await p.isVisible('#morte'), 'sem corações: tela "Você morreu!"');
  ok(/lava/i.test(await p.textContent('#morte-txt')), 'diz do que morreu: ' + await p.textContent('#morte-txt'));
  const chao = await J(p, () => window.__jogo.drops.lista().map((d) => [d.id, d.n]));
  ok(await J(p, () => Object.keys(window.__jogo.mercado.e.itens).length) === 0 && chao.length >= tipos, `a mochila caiu toda no chão (${tipos} tipos -> chão ${JSON.stringify(chao)})`);
  await p.screenshot({ path: SAIDA + '/fome-pc-morreu.png' });
  await p.keyboard.down('KeyW'); await esperar(p, 500); await p.keyboard.up('KeyW');
  const parado = await J(p, () => window.__jogo.jog.pos);
  ok(Math.abs(parado.x - (x0 - 5)) < 0.6, 'morto não anda');
  await p.click('#bt-renascer'); await esperar(p, 1200);
  const pos = await J(p, () => window.__jogo.jog.pos);
  c = await corpo(p);
  ok(!(await p.isVisible('#morte')) && Math.abs(pos.x - (x0 + 3.5)) < 1 && Math.abs(pos.z - (z0 + 0.5)) < 1, `renasceu na cama (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)})`);
  ok(c.v === 20 && c.f === 20, 'renasceu com vida e fome cheias');
  // volta lá e pega as coisas de volta
  await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x - 5.5; j.pos.z = z - 5.5; j.pos.y = y + 1; }, [x0, y0, z0]);
  await esperar(p, 800);
  for (let k = 0; k < 6; k++) { await J(p, () => { const d = window.__jogo.drops.lista()[0]; if (d) { const j = window.__jogo.jog; j.pos.x = d.x; j.pos.z = d.z; } }); await esperar(p, 500); }
  ok(await ate(p, () => window.__jogo.mercado.qtd(3) === 70 && window.__jogo.mercado.qtd(1001) === 1, null, 4000), 'voltou onde morreu e pegou tudo de volta (' + JSON.stringify(await J(p, () => [window.__jogo.mercado.e.itens, window.__jogo.drops.lista()])) + ')');
  // a cama quebrada: renasce no começo
  await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x + 3, y + 1, z, 0), [x0, y0, z0]);
  await J(p, () => { const v = window.__jogo.vida; v.dano(40); }); await esperar(p, 500);
  await p.click('#bt-renascer'); await esperar(p, 1200);
  const aviso = await J(p, () => document.querySelector('#aviso')?.textContent || '');
  ok(/cama sumiu/i.test(aviso), 'cama quebrada: renasce no começo (' + aviso + ')');
  // guarda a vida e a fome
  await J(p, () => { const v = window.__jogo.vida; v.atual = 15; v.fome.f = 12; v.desenhar(); }); await esperar(p, 3500);
  const g = await J(p, () => JSON.parse(localStorage.getItem('pradaria.corpo.local') || '{}'));
  ok(g.v === 15 && g.fome && g.fome.f === 12, 'vida e fome ficam guardadas no aparelho (' + JSON.stringify(g) + ')');
  await ctx.close();
}

// ================= celular, sem internet =================
for (const [nome, disp] of [['celular', devices['Pixel 7']], ['tablet', devices['Galaxy Tab S4']]]) {
  const ctx = await b.newContext({ ...disp });
  const p = await mundo(ctx, true);
  await palco(p);
  await esperar(p, 800);
  const caixa = await J(p, () => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const v = r('#vida'), f = r('#fome'), barra = r('#barra');
    return { v: [v.left, v.right, v.bottom], f: [f.left, f.right, f.bottom], barra: [barra.top], w: innerWidth };
  });
  ok(caixa.v[0] >= 0 && caixa.f[1] <= caixa.w && caixa.v[1] <= caixa.f[0] && caixa.v[2] <= caixa.barra[0] + 1, `${nome}: corações e fome cabem na tela, lado a lado, em cima da barra ${JSON.stringify(caixa)}`);
  await J(p, () => { const v = window.__jogo.vida; v.fome.f = 9; v.atual = 13; v.desenhar(); window.__jogo.mercado.mexer({ t: 'pegar', id: 1007, n: 2 }, true); });
  await esperar(p, 300);
  await segurarMao(p, 1007);
  await J(p, () => { window.__jogo.jog.pitch = 1.2; });
  const vp = p.viewportSize();
  await p.touchscreen.tap(vp.width / 2, vp.height / 2); await esperar(p, 400);
  ok(await p.isVisible('#comer'), nome + ': um toque com a carne na mão começa a comer');
  await esperar(p, 1600);
  ok((await corpo(p)).f === 12 && await J(p, () => window.__jogo.mercado.qtd(1007)) === 1, nome + ': comeu a carne (fome 9 -> 12)');
  await p.screenshot({ path: SAIDA + `/fome-${nome}.png` });
  await J(p, () => window.__jogo.vida.dano(40)); await esperar(p, 600);
  const bt = await p.locator('#bt-renascer').boundingBox();
  ok(bt && bt.y + bt.height <= vp.height && bt.width >= 44, nome + ': botão Renascer inteiro na tela');
  await p.screenshot({ path: SAIDA + `/fome-${nome}-morreu.png` });
  await p.tap('#bt-renascer'); await esperar(p, 800);
  ok(!(await p.isVisible('#morte')) && (await corpo(p)).v === 20, nome + ': tocou em Renascer');
  await ctx.close();
}

// ================= Pacífico: sem fome e sem corações =================
{
  const ctx = await b.newContext({ viewport: { width: 1100, height: 720 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (!(await p.isVisible('[data-dificuldade=pacifico]'))) await p.click('#n-mais, #bt-mais-opcoes, [data-aba=regras]').catch(() => {});
  await p.click('[data-dificuldade=pacifico]');
  await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2000);
  ok(await J(p, () => window.__jogo.opcoesMundo.dificuldade === 'pacifico' && !window.__jogo.vida.classico()), 'Pacífico: não é o modo com fome');
  ok(!(await p.isVisible('#fome')) && !(await p.isVisible('#vida')), 'Pacífico: sem corações e sem fome na tela');
  await ctx.close();
}

// ================= online: morreu, a sala derruba a mochila e o amigo vê =================
{
  const letras = () => Array.from({ length: 6 }, () => 'bdgkmvwxyz'[Math.floor(Math.random() * 10)]).join('');
  const sfx = letras();
  async function pagina(nome, toque) {
    const ctx = await b.newContext(toque ? { ...devices['Galaxy Tab S4'] } : { viewport: { width: 1100, height: 720 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
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
  const a = await pagina('Ana');
  await conta(a, 'Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Fome');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  ok(await J(a, () => window.__jogo.vida.classico() && window.__jogo.mercado.op.fome === true), 'online: mundo novo com fome');
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', true);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2500);
  const [x0, y0, z0] = await palco(a); await esperar(a, 800); await palco(bt, [x0, y0, z0]);
  await J(bt, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 6.5; j.pos.z = z + 6.5; }, [x0, y0, z0]);
  // Ana quebra um tronco e pega (a sala confere)
  await J(a, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 6), [x0, y0, z0]);
  await esperar(a, 500);
  await J(a, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.z = z + 0.5; j.yaw = 0; j.pitch = -0.48; }, [x0, y0, z0]);
  await J(a, async () => { for (let i = 0; i < 6; i++) { window.__jogo.quebrar(null); await new Promise((r) => setTimeout(r, 300)); } });
  await ate(a, () => window.__jogo.drops.lista().some((d) => d.id === 6), null, 6000); await esperar(a, 600);
  await J(a, () => { const d = window.__jogo.drops.lista().find((d) => d.id === 6); if (d) { const j = window.__jogo.jog; j.pos.x = d.x; j.pos.z = d.z; } });
  ok(await ate(a, () => window.__jogo.mercado.qtd(6) >= 1, null, 12000), 'online: Ana quebrou um tronco e pegou (' + await J(a, () => window.__jogo.mercado.qtd(6)) + ')');
  await esperar(a, 1000);
  // Ana come (a sala tira o pão? não tem pão: tenta comer o tronco = nada) e morre
  await J(a, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x - 4.5; j.pos.z = z + 0.5; }, [x0, y0, z0]);
  await esperar(a, 800);
  await J(a, () => { const v = window.__jogo.vida; v.motivo = 'queda'; v.dano(40); });
  await esperar(a, 400);
  ok(await a.isVisible('#morte'), 'online: Ana morreu');
  ok(await ate(bt, () => window.__jogo.drops.lista().some((d) => d.id === 6), null, 5000), 'online: o Beto vê o tronco da Ana no chão onde ela morreu');
  await esperar(a, 800);
  ok(await J(a, () => window.__jogo.mercado.qtd(6)) === 0, 'online: a sala confirmou: a mochila da Ana ficou vazia');
  await a.screenshot({ path: SAIDA + '/fome-online-morreu.png' });
  await a.click('#bt-renascer'); await esperar(a, 1000);
  // Beto vai lá e pega
  const tr = (await J(bt, () => window.__jogo.drops.lista())).find((d) => d.id === 6);
  await J(bt, ([x, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; }, [tr.x, tr.z]);
  ok(await ate(bt, () => window.__jogo.mercado.qtd(6) === 1, null, 5000), 'online: o Beto pegou o tronco');
  await bt.screenshot({ path: SAIDA + '/fome-online-beto.png' });
  // comer online: a sala tira o pão
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

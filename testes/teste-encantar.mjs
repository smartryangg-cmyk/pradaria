// Jogo clássico: encantar. Criar papel, livro, estante e a mesa de encantar na bancada; colocar a mesa e as estantes;
// abrir a mesa, escolher a picareta, ver as 3 ofertas, sem nível não dá, com nível encanta (paga pedra-azul e níveis),
// o brilho aparece na barra e o encanto continua depois de recarregar.
// Computador e celular/tablet sem internet; online (2 jogadores) a sala confere a mesa, as estantes e o pagamento.
// Uso: (cd public && python3 -m http.server 8765), `npm run dev:sala` e `npm run dev` (8788), e
//   node testes/teste-encantar.mjs        (PARTES=pc,toque,online)
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0; const erros = [];
const PARTES = (process.env.PARTES || 'pc,toque,online').split(',');
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(100); }
  return false;
}
const PIC = 1108, ESPADA = 1116, CAP = 1121, AZUL = 1129, MESA = 194, ESTANTE = 186;
const qtd = (p, id) => J(p, (id) => window.__jogo.mercado.qtd(id), id);
const xpDoNivel = (n) => { let x = 0; for (let k = 0; k < n; k++) x += k < 16 ? 2 * k + 7 : k < 31 ? 5 * k - 38 : 9 * k - 158; return x; };
const nivel = (p) => J(p, async () => (await import('/js/xp-regras.js')).nivelDe(window.__jogo.mercado.e.xp | 0).nivel);
const desg = (p, id) => J(p, (id) => ((window.__jogo.mercado.e.desg || {})[id] || [])[0] | 0, id);
const encsDe = (p, v) => J(p, async (v) => (await import('/js/encantos-regras.js')).listaEnc(v), v);
const mesmos = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const espaco = (p, id) => J(p, (id) => window.__jogo.inv.s.findIndex((s) => s && s.id === id), id);
async function mundo(ctx, toque) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(m.text()); });
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  await J(p, () => { window.__jogo.vida.protegido = 999; window.__jogo.dia = 0.3; });
  return p;
}
// um chão de pedra lá no alto (igual em qualquer semente)
const palco = (p, c = null) => p.evaluate((c) => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = c ? c[0] : Math.floor(j.pos.x), z0 = c ? c[2] : Math.floor(j.pos.z), y0 = c ? c[1] : 60;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    m.definir(x0 + dx, y0 - 1, z0 + dz, 3); m.definir(x0 + dx, y0, z0 + dz, 3);
    for (let dy = 1; dy <= 20; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0);
  }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0.6;
  return [x0, y0, z0];
}, c);
// fica em c olhando para o chão à frente: usar() põe o bloco em (x, y + 1, z - 3) ou abre o que estiver lá
const olharAlvo = (p, c) => J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = -0.48; }, c);
const segurar = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
const bloco = (p, [x, y, z]) => J(p, ([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x, y, z]);
// coloca o bloco id em P de verdade (na mão, mira, usar)
async function colocar(p, P, id) {
  await olharAlvo(p, [P[0], P[1] - 1, P[2] + 3]); await esperar(p, 350); await segurar(p, id);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 500);
  return (await bloco(p, P)) === id;
}
// as posições do anel de estantes em volta da mesa M (sem as 2 onde a pessoa fica para abrir a mesa)
const anel = (M) => {
  const l = [];
  for (let h = 0; h <= 1; h++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== 2 || (dx === 0 && dz === 2)) continue;
    l.push([M[0] + dx, M[1] + h, M[2] + dz]);
  }
  return l;
};
const ofertasTela = (p) => J(p, () => [...document.querySelectorAll('.mesa-oferta')].map((b) => [b.disabled, b.querySelector('.mesa-nivel')?.textContent || '', b.querySelector('.mesa-enc')?.textContent || '']));

// ================= computador, sem internet =================
if (PARTES.includes('pc')) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await mundo(ctx, false);
  ok(await J(p, () => window.__jogo.vida.classico()), 'mundo novo é o jogo clássico');
  const c = await palco(p); await esperar(p, 600);
  await J(p, () => { const m = window.__jogo.mercado; for (const [id, n] of [[224, 12], [1008, 4], [8, 6], [1103, 2], [220, 4], [1108, 1], [1129, 5]]) m.mexer({ t: 'pegar', id, n }, true); });
  await esperar(p, 300);
  // bancada na frente: abre e cria papel, livro e estante; a mesa pelo livro de receitas (cliques)
  await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 34), c);
  await olharAlvo(p, c); await esperar(p, 400); await segurar(p, 1108);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 500);
  ok((await p.textContent('#inv-titulo')) === 'Bancada', 'abriu a bancada');
  await J(p, () => { const m = window.__jogo.mercado; m.criar('papel', true, 4); }); await esperar(p, 300);
  ok(await qtd(p, 1130) === 12 && await qtd(p, 224) === 0, 'criou 12 papéis com 12 canas');
  await J(p, () => window.__jogo.mercado.criar('livro', true, 4)); await esperar(p, 300);
  ok(await qtd(p, 1131) === 4 && await qtd(p, 1008) === 0, 'criou 4 livros (papel e couro)');
  await J(p, () => window.__jogo.mercado.criar('estante-livros', true, 1)); await esperar(p, 300);
  ok(await qtd(p, ESTANTE) === 1 && await qtd(p, 1131) === 1 && await qtd(p, 8) === 0, 'criou a estante (6 tábuas e 3 livros)');
  await p.click('#inv-livro:visible'); await esperar(p, 300);
  ok(await p.isVisible('.receita[data-receita=mesa-encantar]'), 'a mesa de encantar está no livro de receitas');
  await p.click('.receita[data-receita=mesa-encantar]'); await esperar(p, 400);
  await p.click('#inv-saida'); await esperar(p, 400);
  await p.keyboard.press('Escape'); await esperar(p, 300);
  ok(await qtd(p, MESA) === 1 && await qtd(p, 1103) === 0 && await qtd(p, 220) === 0, 'criou a mesa de encantar (livro, 2 diamantes, 4 obsidianas)');
  // tira a bancada e põe a mesa
  await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 2, 0), c);
  const M = [c[0], c[1] + 1, c[2] - 3];
  await olharAlvo(p, c); await esperar(p, 300); await segurar(p, MESA);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 500);
  ok((await bloco(p, M)) === MESA && await qtd(p, MESA) === 0, 'colocou a mesa de encantar');
  // abre sem estantes e sem nível
  await olharAlvo(p, c); await esperar(p, 300);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 500);
  ok((await p.textContent('#inv-titulo')) === 'Mesa de encantar' && await p.isVisible('#mesa-painel'), 'tocou na mesa: abriu a mesa de encantar');
  ok((await ofertasTela(p)).every(([d]) => d), 'sem nada escolhido as 3 ofertas ficam apagadas');
  await p.click(`.slot-inv[data-l=s][data-i="${await espaco(p, PIC)}"]`); await esperar(p, 300);
  let of = await ofertasTela(p);
  ok(of.filter(([d]) => !d).length === 3 && /0 de 15/.test(await p.textContent('.mesa-dica')), 'escolheu a picareta: 3 ofertas, 0 estantes ' + JSON.stringify(of));
  ok(of.every(([, n]) => +n <= 8), 'sem estantes as ofertas são fracas (até nível 8)');
  await p.click('.mesa-oferta[data-op="0"]'); await esperar(p, 300);
  ok(/Precisa do nível/.test(await p.textContent('#aviso')) && await desg(p, PIC) === 0 && await qtd(p, AZUL) === 5, 'sem nível não encanta e não gasta nada');
  await p.screenshot({ path: SAIDA + '/encantar-pc-sem-estantes.png' });
  await p.keyboard.press('Escape'); await esperar(p, 300);
  // estantes: uma criada e posta na mão, as outras já no mundo
  const A = anel(M);
  ok(await colocar(p, A[0], ESTANTE), 'colocou a estante criada perto da mesa');
  await J(p, (l) => { for (const [x, y, z] of l) window.__jogo.mundo.definir(x, y, z, 186); }, A.slice(1));
  await J(p, (x) => { window.__jogo.mercado.e.xp = x; window.__jogo.mercado.salvarLocal(); }, xpDoNivel(30) + 3);
  await olharAlvo(p, c); await esperar(p, 400);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 500);
  await p.click(`.slot-inv[data-l=s][data-i="${await espaco(p, PIC)}"]`); await esperar(p, 300);
  of = await ofertasTela(p);
  const esperado = await J(p, () => window.__jogo.ofertasDaMesa());
  ok(/15 de 15/.test(await p.textContent('.mesa-dica')) && +of[2][1] === 30, 'com as estantes: 15 de 15 e a terceira oferta é de nível 30 ' + JSON.stringify(of));
  ok(await p.isVisible('.mesa-oferta.pode[data-op="2"]'), 'com nível 30 e pedra-azul a oferta acende');
  await p.screenshot({ path: SAIDA + '/encantar-pc-ofertas.png' });
  await p.click('.mesa-oferta[data-op="2"]'); await esperar(p, 500);
  const v = await desg(p, PIC);
  ok(mesmos(await encsDe(p, v), esperado[2].encs), 'encantou a picareta com o que a oferta mostrava ' + JSON.stringify(await encsDe(p, v)));
  ok(await qtd(p, AZUL) === 2 && await nivel(p) === 27, 'pagou 3 pedras-azuis e 3 níveis (' + await qtd(p, AZUL) + ', nível ' + await nivel(p) + ')');
  ok(await p.isVisible('.slot-inv.encantado'), 'a picareta brilha na mochila');
  await p.click(`.slot-inv[data-l=s][data-i="${await espaco(p, PIC)}"]`); await esperar(p, 300);
  ok(/Já está encantado/.test(await p.textContent('#aviso')), 'escolher de novo: já está encantado');
  await p.screenshot({ path: SAIDA + '/encantar-pc-encantou.png' });
  await p.keyboard.press('Escape'); await esperar(p, 300);
  ok(await J(p, () => !!document.querySelector('#barra .slot.encantado')), 'a picareta brilha na barra');
  ok(await J(p, () => /Eficiência|Inquebrável/.test(document.querySelector('#barra .slot.encantado')?.title || '')), 'passar o mouse mostra o encanto: ' + await J(p, () => document.querySelector('#barra .slot.encantado')?.title || ''));
  // eficiência quebra mais rápido de verdade (a conta usada pelo jogo)
  const efic = (await encsDe(p, v)).find(([k]) => k === 'eficiencia');
  if (efic) ok(await J(p, async (l) => { const q = await import('/js/quebra-regras.js'); return q.tempoQuebrar(3, 1108, null, l) < q.tempoQuebrar(3, 1108); }, efic[1]), 'eficiência: a picareta quebra pedra mais rápido');
  const salvo = await J(p, () => JSON.parse(localStorage.getItem('pradaria.econ') || 'null'));
  ok(salvo && salvo.desg && salvo.desg[PIC] && salvo.desg[PIC][0] === v, 'o encanto ficou guardado no aparelho');
  await ctx.close();
}

// ================= celular e tablet (toque), sem internet =================
for (const [nome, dev] of PARTES.includes('toque') ? [['celular', devices['Pixel 7']], ['tablet', devices['Galaxy Tab S4']], ['tablet deitado', devices['Galaxy Tab S4 landscape']]] : []) {
  const ctx = await b.newContext({ ...dev });
  const p = await mundo(ctx, true);
  const c = await palco(p); await esperar(p, 600);
  await J(p, (x) => { const m = window.__jogo.mercado; m.mexer({ t: 'pegar', id: 1116, n: 1 }, true); m.mexer({ t: 'pegar', id: 1129, n: 3 }, true); m.e.xp = x; m.salvarLocal(); }, xpDoNivel(10));
  await esperar(p, 300);
  await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x, y + 1, z - 3, 194), c);
  await olharAlvo(p, c); await esperar(p, 400);
  await J(p, () => window.__jogo.usar(null)); await esperar(p, 600);
  ok(await p.isVisible('#mesa-painel'), `${nome}: abriu a mesa de encantar`);
  await p.tap(`.slot-inv[data-l=s][data-i="${await espaco(p, ESPADA)}"]`); await esperar(p, 300);
  const of = await ofertasTela(p), esperado = await J(p, () => window.__jogo.ofertasDaMesa());
  ok(of.filter(([d]) => !d).length >= 1, `${nome}: tocou na espada e as ofertas apareceram ` + JSON.stringify(of));
  const caixa = await J(p, () => { const r = document.querySelector('#inventario .caixa').getBoundingClientRect(), m = document.querySelector('#mesa-painel').getBoundingClientRect(); return [r.width <= innerWidth, m.right <= innerWidth + 1, m.bottom <= innerHeight + 1]; });
  ok(caixa.every(Boolean), `${nome}: a janela e a mesa cabem na tela (${caixa})`);
  await p.screenshot({ path: SAIDA + `/encantar-${nome.replace(' ', '-')}.png` });
  await p.tap('.mesa-oferta[data-op="0"]'); await esperar(p, 400);
  const v = await desg(p, ESPADA);
  ok(mesmos(await encsDe(p, v), esperado[0].encs) && await qtd(p, AZUL) === 2 && await nivel(p) === 9, `${nome}: tocou na primeira oferta e a espada ficou encantada (${JSON.stringify(await encsDe(p, v))})`);
  // a bancada inteira aparece sem rolar (a grade 3x3 não fica cortada em cima)
  await p.keyboard.press('Escape').catch(() => {}); await J(p, () => { const J_ = window.__jogo; J_.inv.mudarGrade(3); J_.abrirInventario('mochila'); }); await esperar(p, 500);
  const g = await J(p, () => { const gr = document.querySelector('#grade'), r = gr.getBoundingClientRect(), c = document.querySelector('.inv-cima').getBoundingClientRect(); return [gr.scrollTop, gr.scrollHeight - gr.clientHeight, Math.round(c.top - r.top), Math.round(r.bottom - innerHeight)]; });
  ok(g[0] === 0 && g[1] <= 1 && g[2] >= 0 && g[3] <= 1, `${nome}: a bancada cabe inteira, sem rolar (${g})`);
  await p.screenshot({ path: SAIDA + `/encantar-${nome.replace(' ', '-')}-bancada.png` });
  await ctx.close();
}

// ================= online: a sala confere a mesa, as estantes e o pagamento =================
if (PARTES.includes('online')) {
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
  // o servidor de teste começa a pessoa com coisas, como um jogo salvo (a sala só aceita isso com TESTE ligado)
  const comecar = (p, itens, xp) => J(p, ([itens, xp]) => window.__jogo.sala.enviar({ t: 'teste-dar', itens, xp }), [itens, xp]);
  const a = await pagina('Ana');
  await conta(a, 'Ana' + sfx);
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Encantar');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', true);
  await conta(bt, 'Beto' + sfx);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2500);
  for (const p of [a, bt]) await J(p, () => { window.__jogo.vida.protegido = 999; window.__jogo.dia = 0.3; });
  const c = await palco(a); await esperar(a, 800); await palco(bt, c);
  await J(bt, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 4.5; j.pos.z = z + 4.5; }, c);
  await comecar(a, { [PIC]: 1, [CAP]: 1, [AZUL]: 6, [MESA]: 1, [ESTANTE]: 4 }, xpDoNivel(30));
  ok(await ate(a, () => window.__jogo.mercado.qtd(1108) === 1 && window.__jogo.mercado.qtd(186) === 4, null, 6000), 'online: Ana começou com picareta, capacete, pedra-azul, mesa e 4 estantes');
  ok(await nivel(a) === 30, 'online: Ana está no nível 30 (' + await nivel(a) + ')');
  // a mesa e as 4 estantes colocadas de verdade (a sala só aceita porque estão na mochila)
  const M = [c[0], c[1] + 1, c[2] - 3];
  await olharAlvo(a, c); await esperar(a, 400); await segurar(a, MESA);
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 1200);
  ok((await bloco(a, M)) === MESA && await qtd(a, MESA) === 0, 'online: Ana colocou a mesa');
  const E4 = [-2, -1, 1, 2].map((dx) => [M[0] + dx, M[1], M[2] + 2]);
  let postas = 0;
  for (const P of E4) if (await colocar(a, P, ESTANTE)) postas++;
  await esperar(a, 1200);
  ok(postas === 4 && await qtd(a, ESTANTE) === 0, `online: Ana colocou as 4 estantes perto da mesa (${postas})`);
  ok(await ate(bt, ([M, E4]) => window.__jogo.mundo.bloco(...M) === 194 && E4.every((P) => window.__jogo.mundo.bloco(...P) === 186), [M, E4], 6000), 'online: o Beto vê a mesa e as estantes da Ana');
  await a.screenshot({ path: SAIDA + '/encantar-online-mesa.png' });
  // abre a mesa e encanta a picareta (cliques); a sala confere e devolve a mochila
  await olharAlvo(a, c); await esperar(a, 400);
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 600);
  ok(await a.isVisible('#mesa-painel'), 'online: Ana abriu a mesa');
  await a.click(`.slot-inv[data-l=s][data-i="${await espaco(a, PIC)}"]`); await esperar(a, 300);
  ok(/4 de 15/.test(await a.textContent('.mesa-dica')), 'online: a mesa conta as 4 estantes (' + await a.textContent('.mesa-dica') + ')');
  const esperado = await J(a, () => window.__jogo.ofertasDaMesa());
  await a.click('.mesa-oferta[data-op="2"]'); await esperar(a, 1500);
  const v = await desg(a, PIC);
  ok(mesmos(await encsDe(a, v), esperado[2].encs), 'online: a picareta encantou e a sala concordou ' + JSON.stringify(await encsDe(a, v)));
  ok(await qtd(a, AZUL) === 3 && await nivel(a) === 27, 'online: a sala cobrou 3 pedras-azuis e 3 níveis (' + await qtd(a, AZUL) + ', nível ' + await nivel(a) + ')');
  await a.screenshot({ path: SAIDA + '/encantar-online-ana.png' });
  await a.keyboard.press('Escape'); await esperar(a, 300);
  // aparelho mentindo: diz que tem 15 estantes. A sala conta só as 4 que vê
  const semente = await J(a, () => window.__jogo.mercado.e.semEnc | 0);
  const com4 = await J(a, async ([s]) => (await import('/js/encantos-regras.js')).ofertas(1121, 0, 4, s)[0].encs, [semente]);
  await J(a, (M) => window.__jogo.sala.enviar({ t: 'encantar', id: 1121, k: 0, op: 0, est: 15, x: M[0], y: M[1], z: M[2] }), M);
  ok(await ate(a, () => (((window.__jogo.mercado.e.desg || {})[1121] || [])[0] | 0) >= 8192, null, 5000), 'online: o capacete encantou');
  ok(mesmos(await encsDe(a, await desg(a, CAP)), com4), 'online: dizer que tem 15 estantes não adianta: a sala usou as 4 (' + JSON.stringify([await encsDe(a, await desg(a, CAP)), com4]) + ')');
  // mesa que só existe no aparelho: a sala não encanta
  await comecar(a, { [ESPADA]: 1 }, xpDoNivel(30));
  await ate(a, () => window.__jogo.mercado.qtd(1116) === 1, null, 5000);
  await J(a, ([x, y, z]) => window.__jogo.mundo.definir(x + 4, y + 1, z, 194), c);
  await J(a, ([x, y, z]) => window.__jogo.sala.enviar({ t: 'encantar', id: 1116, k: 0, op: 0, est: 0, x: x + 4, y: y + 1, z }), c);
  await esperar(a, 1500);
  ok(await desg(a, ESPADA) === 0 && await nivel(a) === 30, 'online: mesa que ninguém colocou (só no aparelho) não encanta');
  // o Beto (tablet) usa a mesma mesa da Ana
  await comecar(bt, { [ESPADA]: 1, [AZUL]: 2 }, xpDoNivel(12));
  ok(await ate(bt, () => window.__jogo.mercado.qtd(1116) === 1, null, 5000), 'online: o Beto tem uma espada');
  await olharAlvo(bt, c); await esperar(bt, 500);
  await J(bt, () => window.__jogo.usar(null)); await esperar(bt, 700);
  ok(await bt.isVisible('#mesa-painel'), 'online: o Beto abriu a mesma mesa');
  await bt.tap(`.slot-inv[data-l=s][data-i="${await espaco(bt, ESPADA)}"]`); await esperar(bt, 300);
  const eb = await J(bt, () => window.__jogo.ofertasDaMesa());
  await bt.tap('.mesa-oferta[data-op="0"]'); await esperar(bt, 1500);
  ok(mesmos(await encsDe(bt, await desg(bt, ESPADA)), eb[0].encs) && await qtd(bt, AZUL) === 1, 'online: o Beto encantou a espada tocando ' + JSON.stringify(await encsDe(bt, await desg(bt, ESPADA))));
  await bt.screenshot({ path: SAIDA + '/encantar-online-beto.png' });
  // sai e volta: a sala devolve a picareta encantada
  await J(a, () => { window.__jogo.mercado.e.desg = {}; });
  await a.reload(); await esperar(a, 1500);
  if (await a.isVisible('#m-jogos')) await a.click('.jogo[data-jogo=pradaria]');
  await a.waitForSelector('#m-mundos:not([hidden])', { timeout: 30000 });
  await a.click('#lista-mundos .mundo, #lista-mundos button');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 }); await esperar(a, 2500);
  ok(await ate(a, (v) => (((window.__jogo.mercado.e.desg || {})[1108] || [])[0] | 0) === v, v, 6000), 'online: voltou ao mundo e a picareta continua encantada');
  ok(await ate(a, () => !!document.querySelector('#barra .slot.encantado'), null, 4000), 'online: o brilho aparece na barra depois de voltar');
  await bt.context().close();
  await a.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

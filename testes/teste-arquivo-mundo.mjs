// Apagar, exportar e importar mundo (só o dono), tudo pela tela: dono no computador, amigo no tablet, e mundo sem internet.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).  SAIDA=pasta para as fotos.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'fs';
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const ipx = () => '10.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250);
async function pagina(tablet) {
  const ctx = await b.newContext({ ...(tablet ? devices['Galaxy Tab S4'] : { viewport: { width: 1280, height: 760 } }), acceptDownloads: true, ...(BASE.includes('localhost') ? { extraHTTPHeaders: { 'cf-connecting-ip': ipx() } } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|favicon|Failed to load resource/.test(m.text())) erros.push(m.text()); });
  await p.goto(BASE + '/#teste');
  return p;
}
// letras sorteadas (nome sem 5 números seguidos e sem repetir entre testes rodados em seguida)
const sfx = Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join('');
const clicar = (p, sel) => p.click(sel), toque = (p, sel) => p.tap(sel);
async function criarConta(p, nome, aperta) {
  await aperta(p, '#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await aperta(p, '#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])');
}
const naSala = (p) => p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala && !document.querySelector('#hud').hidden, null, { timeout: 60000 });
const noJogo = (p) => p.waitForFunction(() => window.__jogo && window.__jogo.jog && !document.querySelector('#hud').hidden, null, { timeout: 60000 });
// uma torrezinha de blocos em lugar conhecido (bem no alto, longe do chão)
const TORRE = [[3, 58, 4, 8], [3, 59, 4, 8], [3, 60, 4, 8], [4, 60, 4, 8], [5, 60, 4, 8]]; // tábuas: livres no mercado e nunca soltas no ar no terreno natural (tronco pode vir de árvore no alto do morro)
const blocosEm = (p) => p.evaluate((t) => t.map(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z)), TORRE);
async function baixar(p, aperta) {
  const [d] = await Promise.all([p.waitForEvent('download'), aperta(p, '#e-exportar')]);
  const caminho = SAIDA + '/' + d.suggestedFilename();
  await d.saveAs(caminho);
  return { nome: d.suggestedFilename(), caminho, dados: JSON.parse(readFileSync(caminho, 'utf8')) };
}
async function escolher(p, aperta, sel, arquivo) {
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), aperta(p, sel)]);
  await fc.setFiles(arquivo);
}

// ---------- dono cria mundo (sem "coletar e criar") e constrói; amigo entra ----------
const A = await pagina(false), B = await pagina(true);
await criarConta(A, 'Dono' + sfx, clicar);
await A.click('#bt-novo-mundo');
await A.fill('#n-nome', 'Castelo Azul');
await A.click('#n-lista [data-opcao=sobrevivencia]');
await A.click('#n-lista [data-opcao=selvagensMachucam]');
await A.click('#m-novo button[type=submit]');
await naSala(A);
// como o jogador colocando com as mãos (a sala só guarda blocos novos assim)
await A.evaluate((t) => window.__jogo.comoJogador(() => { for (const [x, y, z, b] of t) window.__jogo.mundo.definir(x, y, z, b); }), TORRE);
await A.click('#bt-menu');
const codigo = await A.textContent('#dono-codigo');
await A.click('#pausa [data-fechar]');
await criarConta(B, 'Amigo' + sfx, toque);
await toque(B, '#bt-codigo'); await B.fill('#n-nome', codigo); await toque(B, '#m-novo button[type=submit]');
await naSala(B);
await B.waitForTimeout(1000);
conferir(JSON.stringify(await blocosEm(B)) === JSON.stringify(TORRE.map((t) => t[3])), 'amigo vê a torre do dono');

// ---------- exportar (dentro do jogo) ----------
await A.click('#bt-menu'); await A.click('#bt-editar-mundo');
await A.click('#e-mais summary');
await A.screenshot({ path: SAIDA + '/arquivo-pc-opcoes.png' });
const exp = await baixar(A, clicar);
conferir(exp.nome === 'pradaria-castelo-azul.json', 'arquivo baixado: ' + exp.nome);
conferir(exp.dados.formato === 'pradaria-mundo' && exp.dados.nome === 'Castelo Azul' && Number.isInteger(exp.dados.semente), 'arquivo tem nome e semente');
conferir(exp.dados.opcoes.sobrevivencia === false && exp.dados.opcoes.selvagensMachucam === true, 'arquivo tem as opções');
const tem = TORRE.every(([x, y, z, bl]) => exp.dados.edicoes.some((e) => e[0] === x && e[1] === y && e[2] === z && e[3] === bl));
conferir(tem, `arquivo tem os blocos construídos (${exp.dados.edicoes.length})`);
// o amigo não pode exportar nem apagar
const r = await B.evaluate(async (c) => { const h = { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('pradaria.token') };
  const e = await fetch('/api/mundos/exportar', { method: 'POST', headers: h, body: JSON.stringify({ codigo: c }) });
  const a = await fetch('/api/mundos/apagar', { method: 'POST', headers: h, body: JSON.stringify({ codigo: c }) });
  return [e.status, a.status]; }, codigo);
conferir(r[0] === 403 && r[1] === 403, 'servidor: amigo não exporta nem apaga (' + r + ')');
await A.click('#e-cancelar'); await A.click('#pausa [data-fechar]');

// ---------- importar pela lista: vira um mundo novo ----------
await A.click('#bt-menu'); await A.click('#bt-sair-mundo');
await A.waitForSelector('#m-mundos:not([hidden])');
// arquivo errado
const ruim = SAIDA + '/nao-e-mundo.json';
(await import('fs')).writeFileSync(ruim, '{"oi":1}');
await escolher(A, clicar, '#bt-importar', ruim);
await A.waitForFunction(() => /não é um mundo/.test(document.querySelector('#mundos-erro').textContent));
conferir(true, 'arquivo que não é mundo mostra erro');
await escolher(A, clicar, '#bt-importar', exp.caminho);
await A.waitForFunction(() => document.querySelectorAll('#lista-mundos .mundo').length === 2, null, { timeout: 30000 });
const nomes = await A.$$eval('#lista-mundos .mundo b', (l) => l.map((x) => x.textContent));
conferir(nomes.includes('Mundo 01') && nomes.includes('Castelo Azul'), 'importado aparece com nome livre: ' + nomes.join(', '));
await A.screenshot({ path: SAIDA + '/arquivo-pc-lista-importado.png' });
await A.click('#lista-mundos .mundo:has-text("Mundo 01")');
await naSala(A);
await A.waitForTimeout(800);
conferir(JSON.stringify(await blocosEm(A)) === JSON.stringify(TORRE.map((t) => t[3])), 'mundo importado tem a torre');
const opI = await A.evaluate(() => ({ ...window.__jogo.opcoesMundo, semente: window.__jogo.mundo.semente }));
conferir(opI.sobrevivencia === false && opI.selvagensMachucam === true && opI.semente === exp.dados.semente, 'mundo importado tem as mesmas opções e semente');
await A.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.x = 1; j.pos.y = 62; j.pos.z = 10; j.yaw = 0; j.pitch = -0.3; });
await A.waitForTimeout(2500);
await A.screenshot({ path: SAIDA + '/arquivo-pc-torre-importada.png' });
await A.click('#bt-menu'); await A.click('#bt-sair-mundo');
await A.waitForSelector('#m-mundos:not([hidden])');

// ---------- apagar pela lista (o amigo está jogando nele) ----------
await A.click('#lista-mundos .linha-mundo:has-text("Castelo Azul") .bt-editar');
await A.click('#e-mais summary');
A.once('dialog', (d) => d.dismiss());
await A.click('#e-apagar');
await A.waitForTimeout(500);
conferir(await A.isVisible('#editar-mundo'), 'cancelar a confirmação não apaga');
A.once('dialog', (d) => { conferir(/para sempre/.test(d.message()), 'confirmação clara: ' + d.message()); d.accept(); });
await A.click('#e-apagar');
await A.waitForFunction(() => document.querySelectorAll('#lista-mundos .mundo').length === 1, null, { timeout: 30000 });
conferir(!(await A.textContent('#lista-mundos')).includes('Castelo Azul'), 'mundo apagado some da lista do dono');
await B.waitForSelector('#m-mundos:not([hidden])', { timeout: 30000 });
conferir(/apagou/.test(await B.textContent('#mundos-erro')), 'amigo sai do mundo com aviso: ' + await B.textContent('#mundos-erro'));
await B.waitForTimeout(800);
conferir(!(await B.textContent('#lista-mundos')).includes('Castelo Azul'), 'mundo apagado some da lista do amigo');
await B.screenshot({ path: SAIDA + '/arquivo-tablet-amigo-apagado.png' });
const entrar = await B.evaluate(async (c) => (await fetch('/api/mundos/entrar', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('pradaria.token') }, body: JSON.stringify({ codigo: c }) })).status, codigo);
conferir(entrar === 404, 'código do mundo apagado não funciona mais (' + entrar + ')');

// ---------- apagar dentro do jogo (tablet, mundo do próprio amigo) ----------
await toque(B, '#bt-novo-mundo'); await B.fill('#n-nome', 'Casa do Amigo'); await toque(B, '#m-novo button[type=submit]');
await naSala(B);
await toque(B, '#bt-menu'); await toque(B, '#bt-editar-mundo'); await toque(B, '#e-mais summary');
await B.screenshot({ path: SAIDA + '/arquivo-tablet-opcoes.png' });
B.once('dialog', (d) => d.accept());
await toque(B, '#e-apagar');
await B.waitForSelector('#m-mundos:not([hidden])', { timeout: 30000 });
await B.waitForTimeout(800);
conferir(!(await B.textContent('#lista-mundos')).includes('Casa do Amigo'), 'tablet: apagar dentro do jogo volta para a lista sem o mundo');

// ---------- sem internet (tablet): exportar, trocar por arquivo, apagar ----------
const C = await pagina(true);
await toque(C, '#bt-sozinho'); await C.waitForSelector('#m-novo:not([hidden])');
await toque(C, '#m-novo button[type=submit]');
await noJogo(C);
await C.evaluate(() => window.__jogo.comoJogador(() => window.__jogo.mundo.definir(-6, 61, -6, 3)));
await toque(C, '#bt-menu'); await toque(C, '#bt-editar-mundo'); await toque(C, '#e-mais summary');
conferir(await C.isVisible('#e-importar'), 'sem internet: tem "trocar por um mundo de arquivo"');
const expC = await baixar(C, toque);
conferir(expC.dados.edicoes.some((e) => e[0] === -6 && e[1] === 61 && e[2] === -6 && e[3] === 3), 'sem internet: exportou o bloco colocado');
C.once('dialog', (d) => d.accept());
await escolher(C, toque, '#e-importar', exp.caminho);
await C.waitForFunction((s) => window.__jogo.mundo && window.__jogo.mundo.semente === s && !document.querySelector('#hud').hidden, exp.dados.semente, { timeout: 60000 });
await C.waitForTimeout(800);
conferir(JSON.stringify(await blocosEm(C)) === JSON.stringify(TORRE.map((t) => t[3])), 'sem internet: mundo do arquivo carregado com a torre');
conferir(await C.evaluate(() => JSON.parse(localStorage.getItem('pradaria.local')).semente) === exp.dados.semente, 'sem internet: mundo importado fica salvo');
await toque(C, '#bt-menu'); await toque(C, '#bt-editar-mundo'); await toque(C, '#e-mais summary');
C.once('dialog', (d) => d.accept());
await toque(C, '#e-apagar');
await C.waitForSelector('#m-inicio:not([hidden])', { timeout: 30000 });
conferir(await C.evaluate(() => localStorage.getItem('pradaria.local')) === null, 'sem internet: apagar limpa o mundo do aparelho');
await toque(C, '#bt-sozinho');
await C.waitForSelector('#m-novo:not([hidden])');
conferir(true, 'sem internet: depois de apagar, "jogar" pede um mundo novo');

conferir(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 5).join(' | ') : ''));
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO OK');
process.exit(falhas.length ? 1 : 0);

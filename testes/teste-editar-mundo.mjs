// Editar um mundo já criado: tudo pela tela, com dois jogadores (dono no computador, amigo no tablet).
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).  SAIDA=pasta para as fotos.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const ipx = () => '10.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250);
async function pagina(tablet) {
  const ctx = await b.newContext({ ...(tablet ? devices['Galaxy Tab S4'] : { viewport: { width: 1280, height: 760 } }), extraHTTPHeaders: { 'cf-connecting-ip': ipx() } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|favicon|Failed to load resource/.test(m.text())) erros.push(m.text()); });
  await p.goto(BASE + '/#teste');
  return p;
}
const toque = (p, sel) => p.tap(sel);
const sfx = String(Date.now() % 10000);
async function criarConta(p, nome, aperta) {
  await aperta(p, '#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await aperta(p, '#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])');
}
const op = (p) => p.evaluate(() => ({ ...window.__jogo.opcoesMundo }));
const naSala = (p) => p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala && !document.querySelector('#hud').hidden, null, { timeout: 60000 });
const clicar = (p, sel) => p.click(sel);

// ---------- dono (computador) cria o mundo; amigo (tablet) entra com o código ----------
const A = await pagina(false);
const B = await pagina(true);
await criarConta(A, 'Dono' + sfx, clicar);
await A.click('#bt-novo-mundo');
await A.fill('#n-nome', 'Fazenda Feliz');
await A.click('#m-novo button[type=submit]');
await naSala(A);
await A.click('#bt-menu');
const codigo = await A.textContent('#dono-codigo');
conferir(/^[A-Z0-9]{8}$/.test(codigo), 'dono vê o código ' + codigo);
conferir(await A.isVisible('#bt-editar-mundo'), 'dono vê "Editar o mundo" na pausa');
await A.click('#pausa [data-fechar]');

await criarConta(B, 'Amigo' + sfx, toque);
await toque(B, '#bt-codigo');
await B.fill('#n-nome', codigo);
await toque(B, '#m-novo button[type=submit]');
await naSala(B);
await B.waitForTimeout(1500);
const antesB = await op(B);
conferir(antesB.monstros === false && antesB.veiculos === true && antesB.cicloDia === true, 'amigo começa com as opções de quando foi criado');
await toque(B, '#bt-menu');
conferir(await B.isHidden('#bt-editar-mundo'), 'amigo (não dono) não vê o botão de editar');
await toque(B, '#pausa [data-fechar]');
// o amigo anda um pouco: depois da edição tem que continuar no mesmo lugar
await B.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.x += 7; j.pos.z -= 5; j.pos.y += 3; });
await B.waitForTimeout(600);
const posB = await B.evaluate(() => { const j = window.__jogo.jog; return [j.pos.x, j.pos.y, j.pos.z]; });
// o amigo não consegue editar nem pelo servidor
const r403 = await B.evaluate(async (c) => { const r = await fetch('/api/mundos/editar', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('pradaria.token') }, body: JSON.stringify({ codigo: c, nome: 'Roubei', opcoes: { monstros: true } }) }); return r.status; }, codigo);
conferir(r403 === 403, 'servidor recusa edição de quem não é dono (' + r403 + ')');

// ---------- dono edita dentro do jogo ----------
await A.click('#bt-menu');
await A.click('#bt-editar-mundo');
await A.waitForSelector('#editar-mundo:not([hidden])');
conferir(await A.inputValue('#e-nome') === 'Fazenda Feliz', 'janela vem com o nome atual');
const fixas = await A.textContent('#e-fixas');
conferir(/Não dá para mudar/.test(fixas) && /médio/.test(fixas), 'tipo/tamanho aparecem travados: "' + fixas + '"');
const nOpcoes = await A.locator('#e-lista .opcao-mundo').count();
const nLista = await A.evaluate(async () => (await import('/js/opcoes-mundo.js')).OPCOES_MUNDO.length);
conferir(nOpcoes === nLista, `todas as opções da lista aparecem (${nOpcoes}/${nLista})`);
// nome proibido: erro e nada muda
await A.fill('#e-nome', 'Mundo 12345');
await A.click('#e-salvar');
await A.waitForFunction(() => document.querySelector('#e-erro').textContent.length > 0);
conferir(/telefone/.test(await A.textContent('#e-erro')), 'nome com 5 números seguidos é barrado: ' + await A.textContent('#e-erro'));
await A.fill('#e-nome', 'Fazenda@Feliz');
await A.click('#e-salvar');
await A.waitForFunction(() => /só letras/.test(document.querySelector('#e-erro').textContent));
conferir(true, 'nome com símbolo é barrado');
// liga monstros que machucam (liga os monstrinhos junto), desliga veículos e o dia e noite
await A.click('#e-lista [data-opcao=monstrosMachucam]');
conferir(await A.getAttribute('#e-lista [data-opcao=monstros]', 'aria-pressed') === 'true', 'ligar "monstros machucam" liga os monstrinhos');
await A.click('#e-lista [data-opcao=veiculos]');
await A.click('#e-lista [data-opcao=cicloDia]');
conferir(/recarregar/.test(await A.textContent('#e-aviso')), 'avisa que quem está jogando vai recarregar');
await A.click('#e-lista [data-opcao=vilas]');
conferir(/terreno/.test(await A.textContent('#e-aviso')), 'vilas avisa que muda o terreno');
await A.screenshot({ path: SAIDA + '/editar-pc-jogo.png' });
await A.click('#e-lista [data-opcao=vilas]'); // volta vilas como estava
conferir(!/terreno/.test(await A.textContent('#e-aviso')), 'desfazer vilas tira o aviso de terreno');
await A.fill('#e-nome', 'Fazenda Nova');
await A.click('#e-salvar');
// os dois recarregam com as opções novas
await A.waitForFunction(() => window.__jogo.opcoesMundo.monstros === true && !document.querySelector('#hud').hidden && window.__jogo.jog, null, { timeout: 60000 });
await B.waitForFunction(() => window.__jogo.opcoesMundo.monstros === true && !document.querySelector('#hud').hidden && window.__jogo.jog, null, { timeout: 60000 });
await B.waitForTimeout(1500);
for (const [nome, p] of [['dono', A], ['amigo', B]]) {
  const o = await op(p);
  conferir(o.monstros && o.monstrosMachucam && o.veiculos === false && o.cicloDia === false, `${nome}: opções novas valem (monstros+machucam, sem veículos, sempre dia)`);
  conferir(o.tamanho === 'medio' && o.tipo === 'normal', `${nome}: tamanho e tipo continuam`);
  conferir(await p.evaluate(() => window.__jogo.garagem.ligados()) === false, `${nome}: garagem desligada`);
  conferir(/Fazenda Nova/.test(await p.textContent('#status')), `${nome}: nome novo aparece no topo`);
}
conferir(await B.evaluate(() => window.__jogo.vida.ligada()), 'amigo: corações ligados (monstros machucam)');
const posB2 = await B.evaluate(() => { const j = window.__jogo.jog; return [j.pos.x, j.pos.y, j.pos.z]; });
const dist = Math.hypot(posB2[0] - posB[0], posB2[2] - posB[2]);
conferir(dist < 1.5, 'amigo continua no mesmo lugar depois de recarregar (' + dist.toFixed(2) + ' blocos)');
conferir(await A.evaluate(() => window.__jogo.outros) === 1 && await B.evaluate(() => window.__jogo.outros) === 1, 'os dois continuam se vendo');
await B.screenshot({ path: SAIDA + '/editar-tablet-amigo-recarregou.png' });
await A.screenshot({ path: SAIDA + '/editar-pc-depois.png' });
// servidor: veículo novo não é aceito com a opção desligada
const veic = await B.evaluate(async () => {
  const s = window.__jogo.sala; let chegou = false;
  const ws = s.ws; const f = (e) => { if (/"vnovo"/.test(e.data)) chegou = true; }; ws.addEventListener('message', f);
  const j = window.__jogo.jog; s.enviar({ t: 'vnovo', tipo: 'carro', cor: 1, p: [j.pos.x, j.pos.y, j.pos.z], r: 0, n: 1 });
  await new Promise((r) => setTimeout(r, 1200)); ws.removeEventListener('message', f); return chegou;
});
conferir(!veic, 'sala recusa veículo novo quando a opção foi desligada');
// travadas: mesmo pedindo pelo servidor, tipo e tamanho não mudam
const trava = await A.evaluate(async (c) => {
  const r = await fetch('/api/mundos/editar', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('pradaria.token') }, body: JSON.stringify({ codigo: c, opcoes: { tamanho: 'grande', tipo: 'aventura', gerador: 'atual' } }) });
  return (await r.json()).mundo.opcoes;
}, codigo);
conferir(trava.tamanho === 'medio' && trava.tipo === 'normal' && trava.gerador === 'classico', 'servidor não deixa mudar tipo/tamanho/gerador');

// ---------- dono edita pela lista de mundos ----------
await A.click('#bt-menu');
await A.click('#bt-sair-mundo');
await A.waitForSelector('#m-mundos:not([hidden])');
conferir(await A.locator('#lista-mundos .bt-editar').count() === 1, 'lista: lápis no mundo do dono');
await A.screenshot({ path: SAIDA + '/editar-pc-lista.png' });
await A.click('#lista-mundos .bt-editar');
await A.waitForSelector('#editar-mundo:not([hidden])');
conferir(await A.inputValue('#e-nome') === 'Fazenda Nova', 'lista: janela abre com o nome novo');
conferir(await A.getAttribute('#e-lista [data-opcao=veiculos]', 'aria-pressed') === 'false', 'lista: opções salvas aparecem');
await A.click('#e-lista [data-opcao=animais]');
await A.click('#e-lista [data-opcao=veiculos]');
await A.click('#e-salvar');
await A.waitForSelector('#m-mundos:not([hidden]) #lista-mundos .bt-editar');
await A.waitForTimeout(500);
// o amigo (ainda jogando) recebe na hora
await B.waitForFunction(() => window.__jogo.opcoesMundo.animais === false && window.__jogo.opcoesMundo.veiculos === true && window.__jogo.jog && !document.querySelector('#hud').hidden, null, { timeout: 60000 });
conferir(true, 'amigo recebe a edição feita pela lista (sem bichinhos, com veículos)');
const banco = await A.evaluate(async () => (await (await fetch('/api/mundos', { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).mundos[0]);
conferir(banco.nome === 'Fazenda Nova' && banco.opcoes.animais === false && banco.opcoes.veiculos === true && banco.opcoes.monstros === true, 'banco guardou nome e opções');
// só nome: amigo não recarrega, só vê o nome novo
await A.click('#lista-mundos .bt-editar');
await A.fill('#e-nome', 'Fazenda do Sol');
await A.click('#e-salvar');
await B.waitForFunction(() => /Fazenda do Sol/.test(document.querySelector('#status').textContent), null, { timeout: 15000 });
conferir(true, 'só o nome: o amigo vê o nome novo sem recarregar');
await A.waitForTimeout(400);
conferir(/Fazenda do Sol/.test(await A.textContent('#lista-mundos')), 'lista mostra o nome novo');
// o amigo no tablet: lista sem lápis (o mundo não é dele)
await toque(B, '#bt-menu');
await toque(B, '#bt-sair-mundo');
await B.waitForSelector('#m-mundos:not([hidden])');
conferir(await B.locator('#lista-mundos .bt-editar').count() === 0, 'tablet: amigo não tem lápis no mundo dos outros');

// ---------- tablet: dono do próprio mundo edita pela lista e dentro do jogo (toque) ----------
await toque(B, '#bt-novo-mundo');
await B.fill('#n-nome', 'Ilha do Amigo');
await toque(B, '#m-novo button[type=submit]');
await naSala(B);
await toque(B, '#bt-menu');
await toque(B, '#bt-editar-mundo');
await B.waitForSelector('#editar-mundo:not([hidden])');
await toque(B, '#e-lista [data-opcao=monstros]');
await B.screenshot({ path: SAIDA + '/editar-tablet-jogo.png' });
await toque(B, '#e-salvar');
await B.waitForFunction(() => window.__jogo.opcoesMundo.monstros === true && window.__jogo.jog && !document.querySelector('#hud').hidden, null, { timeout: 60000 });
conferir(true, 'tablet: dono liga monstrinhos pela pausa e o mundo recarrega');
await toque(B, '#bt-menu');
await toque(B, '#bt-sair-mundo');
await B.waitForSelector('#m-mundos:not([hidden])');
await toque(B, '#lista-mundos .bt-editar');
await B.waitForSelector('#editar-mundo:not([hidden])');
await B.screenshot({ path: SAIDA + '/editar-tablet-lista.png' });
await toque(B, '#e-cancelar');
conferir(await B.isHidden('#editar-mundo'), 'tablet: cancelar fecha sem mudar');

// ---------- sem internet ----------
const C = await pagina(true);
await toque(C, '#bt-sozinho');
await C.waitForSelector('#m-novo:not([hidden])');
await toque(C, '#m-novo button[type=submit]');
await C.waitForFunction(() => window.__jogo && window.__jogo.jog && !document.querySelector('#hud').hidden);
await C.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.x += 9; j.pos.y += 4; });
await C.waitForTimeout(300);
const posC = await C.evaluate(() => window.__jogo.jog.pos.x);
await toque(C, '#bt-menu');
await toque(C, '#bt-editar-mundo');
conferir(await C.isHidden('#e-rotulo'), 'sem internet: sem campo de nome');
await toque(C, '#e-lista [data-opcao=animais]');
await toque(C, '#e-salvar');
await C.waitForFunction(() => window.__jogo.opcoesMundo.animais === false && !document.querySelector('#hud').hidden);
const salvo = await C.evaluate(() => JSON.parse(localStorage.getItem('pradaria.local')).opcoes.animais);
conferir(salvo === false, 'sem internet: opção salva no aparelho');
conferir(Math.abs(await C.evaluate(() => window.__jogo.jog.pos.x) - posC) < 1.5, 'sem internet: continua no mesmo lugar');

conferir(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 5).join(' | ') : ''));
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO OK');
process.exit(falhas.length ? 1 : 0);

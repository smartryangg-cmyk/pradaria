// Teste real do chat de texto e de voz: dois jogadores (computador e tablet) no mesmo mundo.
// Rodar com o site local no ar (npm run dev:sala, depois npm run dev). SAIDA=pasta para os prints.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = 'http://localhost:8788/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const erros = [];
let falhas = 0;
const ok = (cond, txt) => { console.log((cond ? 'OK   ' : 'FALHA') + ' ' + txt); if (!cond) falhas++; };

async function jogador(nome, toque) {
  const ctx = await b.newContext(toque ? { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 760 } });
  await ctx.grantPermissions(['microphone'], { origin: 'http://localhost:8788' });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('status of 403')) erros.push(nome + ' ' + m.text()); }); // 403: o teste de propósito tenta mudar sem ser dono
  await p.goto(URL);
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const ultimas = (p) => p.$$eval('#chat-log .chat-msg', (l) => l.map((e) => e.textContent));

const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Conversa');
// as duas opções novas aparecem na criação, já ligadas
ok(await a.getAttribute('[data-opcao=chatTexto]', 'aria-pressed') === 'true' && await a.getAttribute('[data-opcao=chatVoz]', 'aria-pressed') === 'true', 'criação: chat de texto e de voz aparecem ligados');
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2000);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await a.waitForFunction(() => window.__jogo.outros > 0);
ok(await a.isVisible('#bt-chat') && await a.isVisible('#bt-voz') && await bb.isVisible('#bt-chat') && await bb.isVisible('#bt-voz'), 'botões de chat e voz aparecem nos dois');

// ---------- texto ----------
// Ana (computador) abre com a tecla T, escreve e manda com Enter
await a.click('#tela'); // trava o mouse como no jogo
await a.keyboard.press('KeyT');
ok(await a.isVisible('#chat-caixa') && await a.evaluate(() => document.activeElement.id) === 'chat-txt', 'T abre o chat com o cursor na caixa');
const posAntes = await a.evaluate(() => ({ ...window.__jogo.jog.pos }));
await a.keyboard.type('oi Beto, vamos construir? wasd'); // as letras não andam com o boneco
await a.keyboard.press('Enter');
await bb.waitForFunction(() => document.querySelectorAll('#chat-log .chat-msg').length > 0, null, { timeout: 5000 }).catch(() => {});
const posDepois = await a.evaluate(() => ({ ...window.__jogo.jog.pos }));
ok(Math.hypot(posDepois.x - posAntes.x, posDepois.z - posAntes.z) < 0.2, 'escrever no chat não mexe o boneco');
ok((await ultimas(bb)).some((t) => t.includes('oi Beto, vamos construir?')), 'Beto recebeu a mensagem da Ana: ' + JSON.stringify(await ultimas(bb)));
ok(!(await a.isVisible('#pausa')), 'escrever "p" no chat não abre a pausa');

// Beto (tablet) toca no botão, escreve palavrão: chega com asteriscos
await bb.tap('#bt-chat');
await bb.fill('#chat-txt', 'seu idiota');
await bb.tap('#chat-caixa button[type=submit]');
await a.waitForTimeout(1500);
ok((await ultimas(a)).some((t) => t.includes('seu ******') && !t.includes('idiota')), 'palavrão chega como asteriscos: ' + JSON.stringify(await ultimas(a)));
// telefone: nem sai do aparelho
await bb.fill('#chat-txt', 'me liga 11 98765-4321');
await bb.tap('#chat-caixa button[type=submit]');
await bb.waitForTimeout(400);
ok((await bb.textContent('#chat-erro')).includes('telefone'), 'telefone é bloqueado: ' + await bb.textContent('#chat-erro'));
// tentando burlar mandando direto para a sala: a sala também bloqueia
await bb.evaluate(() => window.__jogo.sala.enviar({ t: 'chat', txt: 'meu zap 1198765432' }));
await bb.waitForTimeout(1500);
ok(!(await ultimas(a)).some((t) => t.includes('zap')), 'a sala bloqueia contato mesmo sem passar pelo filtro do aparelho');
// limite de taxa: 4 seguidas, só a primeira passa
const n0 = (await ultimas(a)).length;
await bb.evaluate(() => { for (const t of ['um', 'dois', 'tres', 'quatro']) window.__jogo.sala.enviar({ t: 'chat', txt: t }); });
await bb.waitForTimeout(1200);
ok((await ultimas(a)).length - n0 === 1, 'limite: de 4 mensagens seguidas só 1 passa (' + ((await ultimas(a)).length - n0) + ')');
ok((await bb.textContent('#chat-erro')).includes('Calma'), 'quem mandou demais vê o aviso: ' + await bb.textContent('#chat-erro'));
await a.screenshot({ path: SAIDA + '/chat-pc.png' });
await bb.screenshot({ path: SAIDA + '/chat-tablet.png' });
await bb.tap('#chat-fechar');
await a.keyboard.press('Escape');

// ---------- voz ----------
await a.click('#bt-voz');
await bb.tap('#bt-voz');
await a.waitForTimeout(4000);
const estA = await a.evaluate(() => window.__jogo.chat.voz.estatisticas());
const estB = await bb.evaluate(() => window.__jogo.chat.voz.estatisticas());
ok(Object.values(estA).some((s) => s.estado === 'connected') && Object.values(estB).some((s) => s.estado === 'connected'), 'voz conectada entre os dois: ' + JSON.stringify(estA) + ' ' + JSON.stringify(estB));
ok(await a.isVisible('#bt-falar') && await bb.isVisible('#bt-falar') && await bb.isVisible('#bt-mudo'), 'botões de falar e mudo aparecem');
const nivelEmB = async () => { await bb.waitForTimeout(1500); const s = await bb.evaluate(() => window.__jogo.chat.voz.estatisticas()); return Object.values(s)[0]; };
const quieto = await nivelEmB();
// Ana segura o botão de falar (mouse)
const box = await a.locator('#bt-falar').boundingBox();
await a.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await a.mouse.down();
await a.waitForTimeout(300);
ok(await a.evaluate(() => window.__jogo.chat.voz.falandoAgora), 'segurando o botão: microfone da Ana ligado');
const falando = await nivelEmB();
const indicador = await bb.evaluate(() => [...document.querySelectorAll('#voz-gente .voz-pessoa.falando')].map((e) => e.textContent));
await a.screenshot({ path: SAIDA + '/voz-pc-falando.png' });
await bb.screenshot({ path: SAIDA + '/voz-tablet-ouvindo.png' });
await a.mouse.up();
const solto = await nivelEmB();
console.log('nível do som da Ana no Beto: quieto', quieto.nivel, 'falando', falando.nivel, 'solto', solto.nivel, 'bytes', solto.bytes);
ok(quieto.nivel < 0.01 && falando.nivel > 0.05 && solto.nivel < 0.01, 'som só passa enquanto segura o botão');
ok(indicador.some((t) => t.startsWith('Ana')), 'Beto vê que a Ana está falando: ' + JSON.stringify(indicador));
// Beto (tablet) fala segurando o dedo
await bb.locator('#bt-falar').dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true });
await a.waitForTimeout(1500);
const sA = Object.values(await a.evaluate(() => window.__jogo.chat.voz.estatisticas()))[0];
await bb.locator('#bt-falar').dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true });
ok(sA.nivel > 0.05, 'Ana ouve o Beto quando ele segura o botão no tablet (nível ' + sA.nivel + ')');
// tecla B no computador
await a.keyboard.down('KeyB'); await a.waitForTimeout(200);
ok(await a.evaluate(() => window.__jogo.chat.voz.falandoAgora), 'tecla B segura liga o microfone');
await a.keyboard.up('KeyB'); await a.waitForTimeout(200);
ok(!(await a.evaluate(() => window.__jogo.chat.voz.falandoAgora)), 'soltar B desliga');
// mudo no Beto
await bb.tap('#bt-mudo');
ok(await bb.evaluate(() => [...document.querySelectorAll('audio[data-voz]')].every((x) => x.muted)), 'mudo: Beto não ouve ninguém');
await bb.tap('#bt-mudo');
ok(await bb.evaluate(() => [...document.querySelectorAll('audio[data-voz]')].every((x) => !x.muted)), 'tirar o mudo volta o som');

// ---------- dono desliga ----------
await a.keyboard.press('KeyP');
await a.waitForSelector('#pausa:not([hidden])');
ok(await a.isVisible('#pausa-chat'), 'dono vê as opções de conversa na pausa');
ok(!(await bb.evaluate(() => { document.querySelector('#bt-menu').click(); const v = !document.querySelector('#pausa-chat').hidden; return v; })), 'quem não é dono não vê as opções');
await bb.evaluate(() => document.querySelector('#pausa [data-fechar]').click());
await a.uncheck('#dono-chat-voz');
await a.waitForTimeout(2000);
await a.screenshot({ path: SAIDA + '/dono-opcoes.png' });
ok(!(await bb.isVisible('#bt-voz')) && !(await bb.evaluate(() => window.__jogo.chat.voz.ligada)), 'voz desligada pelo dono: some do Beto e a ligação cai');
ok(!(await a.evaluate(() => window.__jogo.chat.voz.ligada)), 'e da Ana também');
await a.uncheck('#dono-chat-texto');
await a.waitForTimeout(1500);
ok(!(await bb.isVisible('#bt-chat')), 'texto desligado pelo dono: botão some do Beto');
await bb.evaluate(() => window.__jogo.sala.enviar({ t: 'chat', txt: 'ainda da?' }));
await a.waitForTimeout(1500);
ok(!(await ultimas(a)).some((t) => t.includes('ainda da')), 'com o texto desligado a sala não passa mensagem');
// a escolha fica salva no mundo
const lista = await a.evaluate(async () => (await (await fetch('/api/mundos', { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).mundos);
const mm = lista.find((x) => x.codigo === codigo);
ok(mm && mm.opcoes.chatTexto === false && mm.opcoes.chatVoz === false, 'opções salvas no mundo: ' + JSON.stringify(mm && { t: mm.opcoes.chatTexto, v: mm.opcoes.chatVoz }));
// Beto não consegue mudar as opções
const r = await bb.evaluate(async (c) => (await fetch('/api/mundos/chat', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('pradaria.token') }, body: JSON.stringify({ codigo: c, texto: true }) })).status, codigo);
ok(r === 403, 'só o dono muda (Beto recebeu ' + r + ')');
// liga de novo
await a.check('#dono-chat-texto'); await a.check('#dono-chat-voz');
await a.waitForTimeout(1500);
ok(await bb.isVisible('#bt-chat') && await bb.isVisible('#bt-voz'), 'religado: botões voltam para o Beto');

console.log(erros.length ? 'ERROS NO CONSOLE:\n' + erros.join('\n') : 'console sem erros');
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

// Teste real do Modo TV: uma TV 1920x1080 (navegador de Smart TV) e um celular que vira o controle.
// Navega nos menus da TV pelo celular, cria um mundo, anda, olha, coloca e quebra bloco, abre a mochila;
// depois joga com o controle remoto (setas/OK) e com um controle de videogame (Gamepad simulado).
//   URL=http://localhost:8788 SAIDA=/tmp node testes/teste-tv.mjs
import { createRequire } from 'module'; const req = createRequire(import.meta.url); const { chromium, devices } = req('playwright');
const URL = process.env.URL || 'http://localhost:8788', SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const UA_TV = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36';
const tvCtx = await b.newContext({ viewport: { width: 1920, height: 1080 }, userAgent: UA_TV, hasTouch: false });
const tv = await tvCtx.newPage();
const erros = []; tv.on('pageerror', (e) => erros.push('TV: ' + e.message));
tv.on('console', (m) => { if (m.type() === 'error') erros.push('TV console: ' + m.text()); });
const ok = (cond, txt) => { console.log((cond ? 'OK   ' : 'FALHOU ') + txt); if (!cond) process.exitCode = 1; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

await tv.goto(URL + '/#teste');
await tv.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await tv.reload();
await tv.waitForSelector('#bt-celular-inicio');
ok(await tv.evaluate(() => document.body.classList.contains('modo-tv')), 'navegador de TV liga o Modo TV sozinho');
ok(await tv.evaluate(() => !document.body.classList.contains('toque')), 'na TV não mostra os botões de toque');
// controle remoto: setas andam pelos botões até "Celular como controle"
for (let i = 0; i < 12; i++) {
  if (await tv.evaluate(() => document.activeElement && document.activeElement.id === 'bt-celular-inicio')) break;
  await tv.keyboard.press('ArrowDown'); await espera(80);
}
ok(await tv.evaluate(() => document.activeElement.id === 'bt-celular-inicio' && document.activeElement.classList.contains('foco-tv')), 'setas do controle remoto chegam no botão "Celular como controle"');
await tv.screenshot({ path: SAIDA + '/tv-1-menu.png' });
await tv.keyboard.press('Enter');
await tv.waitForSelector('#tv-painel:not([hidden])');
await espera(400);
const codigo = (await tv.textContent('#tv-codigo')).replace(/\s/g, '');
ok(/^[A-Z2-9]{6}$/.test(codigo), 'TV mostra o código ' + codigo + ' e o QR');
ok(await tv.evaluate(() => !!document.querySelector('#tv-qr svg path')), 'QR desenhado');
await tv.screenshot({ path: SAIDA + '/tv-2-codigo.png' });

// celular: abre a página de controle pelo endereço do QR
const celCtx = await b.newContext({ ...devices['Pixel 7 landscape'] });
const cel = await celCtx.newPage();
cel.on('pageerror', (e) => erros.push('CEL: ' + e.message));
cel.on('console', (m) => { if (m.type() === 'error') erros.push('CEL console: ' + m.text()); });
const urlQR = await tv.evaluate(() => `${location.origin}/controle.html?c=` + document.querySelector('#tv-codigo').textContent.replace(/\s/g, ''));
await cel.goto(urlQR);
await cel.waitForFunction(() => document.body.classList.contains('ligado'), null, { timeout: 10000 });
ok(true, 'celular ligou na TV pelo QR');
await tv.waitForFunction(() => /Celular ligado/.test(document.querySelector('#tv-status').textContent));
ok(true, 'TV mostra "Celular ligado"');
await tv.screenshot({ path: SAIDA + '/tv-3-ligado.png' });
await cel.waitForFunction(() => document.body.classList.contains('menu'));
ok(true, 'celular mostra as setas (a TV está num menu)');
await cel.screenshot({ path: SAIDA + '/cel-1-menu.png' });

const toque = async (sel) => { await cel.tap(sel); await espera(250); };
// OK fecha o painel (o foco está em "Pronto")
await toque('[data-nav=ok]');
ok(await tv.evaluate(() => document.querySelector('#tv-painel').hidden), 'OK no celular fecha o painel da TV');
// vai até um botão da TV usando as setas do celular
async function irAte(id) {
  for (let i = 0; i < 24; i++) {
    if (await tv.evaluate((id) => document.activeElement && document.activeElement.id === id, id)) return true;
    // na mesma linha (botões lado a lado, como os modos de jogo) vai para o lado; senão sobe ou desce
    const lado = await tv.evaluate((id) => {
      const el = document.activeElement; if (!el || el === document.body) return 'baixo';
      const a = el.getBoundingClientRect(), b = document.getElementById(id).getBoundingClientRect();
      if (Math.abs(a.top - b.top) < 8) return a.left > b.left ? 'esq' : 'dir';
      return a.top > b.top ? 'cima' : 'baixo';
    }, id);
    await toque(`[data-nav=${lado}]`);
  }
  return tv.evaluate((id) => document.activeElement && document.activeElement.id === id, id);
}
// Entrar: escrever o nome de jogador pelo celular
ok(await irAte('bt-entrar'), 'setas do celular chegam em "Entrar"');
await toque('[data-nav=ok]');
await tv.waitForSelector('#m-conta:not([hidden])');
ok(await irAte('c-nome'), 'setas do celular chegam no campo "Nome de jogador"');
await cel.waitForFunction(() => document.body.classList.contains('com-campo'));
await cel.fill('#txt-cel', '');
await cel.type('#txt-cel', 'Irmao', { delay: 30 });
await espera(300);
ok((await tv.inputValue('#c-nome')) === 'Irmao', 'texto digitado no celular aparece no campo da TV');
await cel.screenshot({ path: SAIDA + '/cel-2-escrever.png' });
await tv.screenshot({ path: SAIDA + '/tv-4-escrever.png' });
await toque('.lado-menu [data-nav=voltar]');
ok(await tv.evaluate(() => !document.querySelector('#m-inicio').hidden), 'Voltar no celular volta para o início');
// Jogar sem conta e criar o mundo
ok(await irAte('bt-sozinho'), 'setas do celular chegam em "Jogar sem conta"');
await toque('[data-nav=ok]');
await tv.waitForSelector('#m-novo:not([hidden])');
await tv.screenshot({ path: SAIDA + '/tv-5-novo-mundo.png' });
// desliga "Coletar e criar" pelo celular (blocos à vontade: o teste coloca bloco sem ter que juntar antes)
const opSobrev = await tv.evaluate(() => { const b = document.querySelector('#m-novo [data-modo=criativo]'); if (!b) return null; b.id = b.id || 'op-sobrev-teste'; return b.id; });
if (opSobrev) {
  ok(await irAte(opSobrev), 'setas do celular chegam na opção "Coletar e criar"');
  const antesOp = await tv.evaluate((id) => document.getElementById(id).outerHTML, opSobrev);
  await toque('[data-nav=ok]');
  ok(antesOp !== (await tv.evaluate((id) => document.getElementById(id).outerHTML, opSobrev)), 'OK do celular liga/desliga a opção');
}
const criar = await tv.evaluate(() => { const b = document.querySelector('#m-novo button[type=submit]'); b.id = b.id || 'bt-criar-teste'; return b.id; });
ok(await irAte(criar), 'setas do celular chegam em "Criar"');
await toque('[data-nav=ok]');
await tv.waitForFunction(() => window.__jogo && window.__jogo.jog && !document.querySelector('#hud').hidden, null, { timeout: 30000 });
ok(true, '"Enviar para a TV" cria o mundo e o jogo começa');
await cel.waitForFunction(() => !document.body.classList.contains('menu'));
ok(true, 'celular troca para alavanca e botões');
await espera(2500);
// para o teste não depender de onde o mundo começa (árvore, água, morro): anda voando lá no alto e pousa para mexer nos blocos
const voarAlto = () => tv.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.y += 25; });
const pousar = async () => { await tv.evaluate(() => { window.__jogo.jog.voando = false; }); await tv.waitForFunction(() => window.__jogo.jog.noChao || window.__jogo.jog.naAgua, null, { timeout: 20000 }); await espera(300); };
await voarAlto();
await espera(300);

// andar com a alavanca do celular
const pos0 = await tv.evaluate(() => ({ ...window.__jogo.jog.pos, yaw: window.__jogo.jog.yaw }));
const areaA = await cel.locator('#area-andar').boundingBox();
const cdp = await celCtx.newCDPSession(cel);
const ax = areaA.x + areaA.width * 0.5, ay = areaA.y + areaA.height * 0.6;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ax, y: ay, id: 1 }] });
for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ax, y: ay - i * 10, id: 1 }] }); await espera(30); }
await espera(1600);
await tv.screenshot({ path: SAIDA + '/tv-6-andando.png' });
await cel.screenshot({ path: SAIDA + '/cel-3-jogando.png' });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await espera(400);
const pos1 = await tv.evaluate(() => ({ ...window.__jogo.jog.pos }));
const andou = Math.hypot(pos1.x - pos0.x, pos1.z - pos0.z);
ok(andou > 1, 'alavanca do celular anda na TV (' + andou.toFixed(1) + ' blocos)');
await espera(500);
const pos2 = await tv.evaluate(() => ({ ...window.__jogo.jog.pos }));
ok(Math.hypot(pos2.x - pos1.x, pos2.z - pos1.z) < 0.3, 'soltou a alavanca: para de andar');

// olhar arrastando à direita
const areaO = await cel.locator('#area-olhar').boundingBox();
const ox = areaO.x + areaO.width * 0.5, oy = areaO.y + areaO.height * 0.5;
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ox, y: oy, id: 2 }] });
for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ox + i * 12, y: oy + i * 4, id: 2 }] }); await espera(25); }
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await espera(300);
const olhar = await tv.evaluate(() => ({ yaw: window.__jogo.jog.yaw, pitch: window.__jogo.jog.pitch }));
ok(Math.abs(olhar.yaw - pos0.yaw) > 0.3, 'arrastar no celular gira a câmera (' + (olhar.yaw - pos0.yaw).toFixed(2) + ' rad)');
ok(olhar.pitch < -0.1, 'arrastar para baixo olha para baixo');

// pular
const y0 = await tv.evaluate(() => window.__jogo.jog.pos.y);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...(await (async () => { const r = await cel.locator('[data-segurar=pular]').boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()), id: 4 }] });
// segura até a TV subir (pela internet o recado demora um pouco: mede quanto)
const t0 = Date.now();
let subiu = 0, demora = null;
while (Date.now() - t0 < 2500) {
  await espera(40);
  subiu = (await tv.evaluate(() => window.__jogo.jog.pos.y)) - y0;
  if (demora === null && subiu > 0.05) demora = Date.now() - t0;
  if (subiu > 0.6) break;
}
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
ok(subiu > 0.6, 'botão Pular do celular sobe (voando: ' + subiu.toFixed(2) + ', a TV reagiu em ' + demora + ' ms)');
// soltou: para de subir (o botão não fica preso)
await espera(1200);
const ySolto = await tv.evaluate(() => window.__jogo.jog.pos.y);
await espera(600);
ok(Math.abs((await tv.evaluate(() => window.__jogo.jog.pos.y)) - ySolto) < 0.3, 'soltou o Pular: para de subir');

await pousar();
// segurar quebra; toque rápido coloca
await tv.evaluate(() => {
  const m = window.__jogo.mundo, orig = m.aoMudarBloco;
  window.__conta = { pos: 0, quebr: 0 };
  m.aoMudarBloco = (x, y, z, b, ...r) => { if (b) window.__conta.pos++; else window.__conta.quebr++; return orig(x, y, z, b, ...r); };
  window.__jogo.jog.pitch = -0.8;
});
// como um jogador de verdade: se o bloco da frente não dá (água, bicho no caminho), vira um pouco e tenta de novo
let c1, c2;
for (let tenta = 0; tenta < 4; tenta++) {
  await tv.evaluate((t) => { const j = window.__jogo.jog; j.pitch = -0.8; j.yaw += t ? Math.PI / 2 : 0; }, tenta);
  await espera(300);
  // quebrar leva o tempo do material (como no clássico): pedra na mão não sai em 4 s. Se a mira caiu em
  // pedra ou outra coisa dura do terreno sorteado, troca por terra, que a mão quebra
  await tv.evaluate(() => {
    const g = window.__jogo, h = g.mundo.raycast(g.camera.position, new g.camera.position.constructor(0, 0, -1).applyQuaternion(g.camera.quaternion), 6);
    if (h && ![1, 2, 4].includes(h.b)) g.mundo.definir(h.x, h.y, h.z, 2);
  });
  await espera(300);
  const antes = await tv.evaluate(() => ({ ...window.__conta }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ox, y: oy, id: 3 }] });
  await espera(4000);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await espera(2000); // o bloco cai no chão e vem para a mochila
  c1 = await tv.evaluate(() => ({ ...window.__conta }));
  if (c1.quebr === antes.quebr) continue;
  await tv.evaluate(() => { window.__jogo.jog.pitch = -0.5; }); // coloca um pouco mais longe (não em cima do buraco)
  // o bloco juntado pode ter ido para outro espaço da barra: as setinhas do celular trocam o item da mão
  for (let i = 0; i < 9; i++) {
    await cel.tap('#area-olhar'); await espera(600);
    c2 = await tv.evaluate(() => ({ ...window.__conta }));
    if (c2.pos > c1.pos) break;
    await cel.tap('#botoes [data-acao=slot][data-v="1"]'); await espera(250);
  }
  if (c2.pos > c1.pos) break;
  if (process.env.DEPURAR) { console.log('dbg', tenta, await tv.evaluate(() => { const g = window.__jogo; const h = g.mundo.raycast(g.camera.position, new g.camera.position.constructor(0, 0, -1).applyQuaternion(g.camera.quaternion), 6); return JSON.stringify({ barra: g.barra, h, pos: g.jog.pos, aviso: document.querySelector('#aviso').textContent, pausado: g.pausado }); })); await tv.screenshot({ path: SAIDA + '/dbg-' + tenta + '.png' }); }
}
ok(c1.quebr > 0, 'segurar no celular quebra bloco na TV (' + c1.quebr + ')');
ok(c2 && c2.pos > c1.pos, 'toque rápido no celular coloca o bloco que juntou');
await tv.screenshot({ path: SAIDA + '/tv-6b-construiu.png' });

// mochila abre na TV e o celular troca para as setas; Voltar fecha
await espera(600);
await toque('#fila [data-acao=mochila]');
await espera(300);
ok(await tv.evaluate(() => !document.querySelector('#inventario').hidden), 'botão Mochila do celular abre a mochila na TV');
await cel.waitForFunction(() => document.body.classList.contains('menu'));
await toque('[data-nav=dir]'); await toque('[data-nav=dir]');
await tv.screenshot({ path: SAIDA + '/tv-7-mochila.png' });
await toque('.lado-menu [data-nav=voltar]');
ok(await tv.evaluate(() => document.querySelector('#inventario').hidden && !window.__jogo.pausado), 'Voltar no celular fecha a mochila');
await cel.waitForFunction(() => !document.body.classList.contains('menu'));

// controle remoto: esquerda vira, OK coloca bloco, Voltar pausa
await voarAlto(); await espera(200);
const yawA = await tv.evaluate(() => window.__jogo.jog.yaw);
await tv.keyboard.down('ArrowLeft'); await espera(1200); // (o CI roda a ~13 quadros por segundo) await tv.keyboard.up('ArrowLeft');
const yawB = await tv.evaluate(() => window.__jogo.jog.yaw);
ok(yawB - yawA > 0.4, 'seta esquerda do controle remoto vira o personagem (' + (yawB - yawA).toFixed(2) + ' rad)');
const zA = await tv.evaluate(() => ({ ...window.__jogo.jog.pos }));
await tv.keyboard.down('ArrowUp'); await espera(900); await tv.keyboard.up('ArrowUp');
const zB = await tv.evaluate(() => ({ ...window.__jogo.jog.pos }));
ok(Math.hypot(zB.x - zA.x, zB.z - zA.z) > 1, 'seta para cima anda');
// segurar OK quebra (e junta); apertar OK coloca
await pousar();
// precisa de chão seco ao alcance da mão: nadando no mar, o fundo fica longe demais para quebrar (o teste caía
// assim); um morador ou bicho passando na frente da mira faz o OK conversar ou bater; e quebrar leva o tempo do
// material (como no clássico): pedra ou pedregulho na mão não saem em 4 s. Se o lugar sorteado não serve, vai
// para outro (mudar o bloco com definir não vale: no clássico a sala desfaz o que o jogador não tem)
const lugarRuim = () => tv.evaluate(() => {
  const g = window.__jogo, j = g.jog, p = j.pos;
  if (j.naAgua) return 'água';
  if ((g.aldeoes ? g.aldeoes.lista : []).some((a) => Math.hypot(a.grupo.position.x - p.x, a.grupo.position.z - p.z) < 16)) return 'vila';
  if (g.bichos && g.bichos.lista && g.bichos.lista.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < 8)) return 'bicho';
  const h = g.mundo.raycast(g.camera.position, new g.camera.position.constructor(0, 0, -1).applyQuaternion(g.camera.quaternion), 5);
  if (!h || ![1, 2, 4].includes(h.b)) return 'bloco ' + (h ? h.b : 'longe');
  return '';
});
let r0, r1, colocou = false, quebrouR = false;
for (let tenta = 0; tenta < 4 && !colocou; tenta++) {
  await pousar();
  for (let k = 0; k < 8; k++) {
    await tv.evaluate(() => { window.__jogo.jog.pitch = -0.8; });
    await espera(300);
    if (!(await lugarRuim())) break;
    await tv.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.x += 40; j.pos.z += 13; j.pos.y = 80; j.vel.x = j.vel.y = j.vel.z = 0; });
    await espera(1500); await pousar();
  }
  r0 = await tv.evaluate(() => ({ ...window.__conta }));
  await tv.keyboard.down('Enter'); await espera(4000); await tv.keyboard.up('Enter');
  await espera(2000);
  r1 = await tv.evaluate(() => ({ ...window.__conta }));
  if (r1.quebr === r0.quebr) continue;
  quebrouR = true;
  await tv.evaluate(() => { window.__jogo.jog.pitch = -0.5; });
  // no Coletar e criar o bloco juntado pode ir para outro espaço da barra: os números do controle remoto escolhem
  const barra = await tv.evaluate(() => window.__jogo.barra);
  for (let i = 0; i < 9 && !colocou; i++) {
    if (!barra[i]) continue;
    await tv.keyboard.press('Digit' + (i + 1)); await espera(150);
    await tv.keyboard.press('Enter'); await espera(500);
    colocou = (await tv.evaluate(() => window.__conta.pos)) > r1.pos;
  }
  if (!colocou && process.env.DEPURAR) { console.log('dbgR', tenta, JSON.stringify(r0), JSON.stringify(r1), await tv.evaluate(() => { const g = window.__jogo; const h = g.mundo.raycast(g.camera.position, new g.camera.position.constructor(0, 0, -1).applyQuaternion(g.camera.quaternion), 6); return JSON.stringify({ barra: g.barra, h, pos: g.jog.pos, aviso: document.querySelector('#aviso').textContent, pausado: g.pausado, foco: document.activeElement.id }); })); await tv.screenshot({ path: SAIDA + '/dbgR-' + tenta + '.png' }); }
}
ok(quebrouR, 'segurar OK do controle remoto quebra');
ok(colocou, 'OK do controle remoto coloca bloco');
await tv.keyboard.press('Escape'); await espera(300);
ok(await tv.evaluate(() => window.__jogo.pausado && !document.querySelector('#pausa').hidden), 'Voltar do controle remoto abre a pausa');
await tv.screenshot({ path: SAIDA + '/tv-8-pausa.png' });
// setas na pausa navegam; Voltar (Esc) fecha
await tv.keyboard.press('ArrowDown'); await espera(100);
ok(await tv.evaluate(() => document.activeElement && document.activeElement.classList.contains('foco-tv')), 'setas navegam na pausa');
await tv.keyboard.press('Escape'); await espera(300);
ok(await tv.evaluate(() => !window.__jogo.pausado), 'Voltar fecha a pausa');
// a TV perde o foco com seta e OK apertados (o soltar não chega): o personagem para de girar e de quebrar
await pousar();
await tv.keyboard.down('ArrowLeft'); await tv.keyboard.down('Enter'); await espera(900);
await tv.evaluate(() => window.dispatchEvent(new Event('blur')));
await espera(400);
const fA = await tv.evaluate(() => ({ yaw: window.__jogo.jog.yaw, q: window.__conta.quebr }));
await espera(1500);
const fB = await tv.evaluate(() => ({ yaw: window.__jogo.jog.yaw, q: window.__conta.quebr, cq: !!window.__jogo.cq }));
await tv.keyboard.up('Enter'); await tv.keyboard.up('ArrowLeft'); await espera(200);
ok(Math.abs(fB.yaw - fA.yaw) < 0.05 && !fB.cq && fB.q === fA.q, 'TV perdeu o foco: para de girar e de quebrar (' + JSON.stringify([fA, fB]) + ')');

// controle de videogame (Gamepad API simulado): alavanca anda, A pula, Start pausa
await tv.evaluate(() => {
  const g = { id: 'Controle Xbox (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  window.__pad = g; navigator.getGamepads = () => [g];
});
await voarAlto(); await espera(200);
const gA = await tv.evaluate(() => ({ ...window.__jogo.jog.pos, yaw: window.__jogo.jog.yaw }));
await tv.evaluate(() => { window.__pad.axes[1] = -1; window.__pad.axes[2] = 0.8; });
await espera(1000);
await tv.evaluate(() => { window.__pad.axes[1] = 0; window.__pad.axes[2] = 0; });
await espera(200);
const gB = await tv.evaluate(() => ({ ...window.__jogo.jog.pos, yaw: window.__jogo.jog.yaw }));
ok(Math.hypot(gB.x - gA.x, gB.z - gA.z) > 1, 'alavanca do videogame anda');
ok(Math.abs(gB.yaw - gA.yaw) > 0.3, 'alavanca direita do videogame gira a câmera');
await tv.evaluate(() => { window.__pad.buttons[9] = { pressed: true, value: 1 }; });
await espera(450);
await tv.evaluate(() => { window.__pad.buttons[9] = { pressed: false, value: 0 }; });
await espera(150);
ok(await tv.evaluate(() => window.__jogo.pausado), 'Start do videogame pausa');
await tv.evaluate(() => { window.__pad.buttons[1] = { pressed: true, value: 1 }; });
await espera(450);
await tv.evaluate(() => { window.__pad.buttons[1] = { pressed: false, value: 0 }; });
await espera(200);
ok(await tv.evaluate(() => !window.__jogo.pausado), 'B do videogame volta ao jogo');
await tv.screenshot({ path: SAIDA + '/tv-9-jogando.png' });

// celular sai: a TV avisa e solta os comandos
await cel.tap('#b-desligar'); await espera(800);
ok(await tv.evaluate(() => window.__jogo.tv.celulares === 0), 'celular saiu: TV sabe');

console.log(erros.join('\n') || 'sem erros no console');
await b.close();

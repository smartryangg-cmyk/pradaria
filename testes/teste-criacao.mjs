// Coletar e criar: quebrar dá o bloco, receitas na mão e na bancada, ferramentas mais rápidas,
// colocar gasta, mochila salva (sem internet e online) e o modo criativo continua igual.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
async function pagina(toque = false, ctx = null) {
  ctx = ctx || await b.newContext({ viewport: toque ? { width: 900, height: 600 } : { width: 1100, height: 720 }, hasTouch: toque, isMobile: toque });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await p.goto(BASE + '/#teste');
  return p;
}
const B = { TERRA: 2, PEDRA: 3, TRONCO: 6, TABUAS: 8, GRAMA: 1, LA_BRANCA: 14, BANCADA: 34 };
const I = { GRAVETO: 1000, PICARETA_MADEIRA: 1001 };

// põe um bloco bem na frente dos olhos do jogador (e limpa o caminho) e mira nele
const alvo = (p, bloco) => p.evaluate((bloco) => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  j.voando = true; j.vel.x = j.vel.y = j.vel.z = 0;
  j.yaw = 0; j.pitch = 0;
  const x = Math.floor(j.pos.x), y = Math.floor(j.pos.y + 1.6), z = Math.floor(j.pos.z);
  for (let dz = 1; dz <= 3; dz++) for (let dy = -1; dy <= 1; dy++) m.definir(x, y + dy, z - dz, 0);
  m.definir(x, y, z - 2, bloco);
  return [x, y, z - 2];
}, bloco);
const bater = (p, n) => p.evaluate(async (n) => { for (let i = 0; i < n; i++) { window.__jogo.quebrar(null); await new Promise((r) => setTimeout(r, 30)); } }, n);
const qtd = (p, id) => p.evaluate((id) => window.__jogo.mercado.qtd(id), id);
const blocoEm = (p, [x, y, z]) => p.evaluate(([x, y, z]) => window.__jogo.mundo.bloco(x, y, z), [x, y, z]);

// ---------- sem internet: mundo novo com "Coletar e criar" (vem ligado) ----------
const p = await pagina();
await p.click('#bt-sozinho');
await p.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
conferir(await p.getAttribute('[data-opcao=sobrevivencia]', 'aria-pressed') === 'true', 'Coletar e criar vem ligado no mundo novo');
await p.click('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
await p.waitForTimeout(2500);
conferir(await p.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true && window.__jogo.barra.every((x) => x === 0)), 'começa de mão vazia');

// quebrar tronco com a mão: 5 toques e vai para a mochila
let pos = await alvo(p, B.TRONCO);
await bater(p, 4);
conferir(await blocoEm(p, pos) === B.TRONCO && await qtd(p, B.TRONCO) === 0, 'tronco aguenta 4 toques com a mão');
await bater(p, 1);
conferir(await blocoEm(p, pos) === 0 && await qtd(p, B.TRONCO) === 1, 'no 5º toque o tronco quebra e vai para a mochila');
conferir(await p.evaluate(() => window.__jogo.barra.includes(6)), 'tronco apareceu na barra');
// grama vira terra
pos = await alvo(p, B.GRAMA);
await bater(p, 3);
conferir(await qtd(p, B.TERRA) === 1 && await qtd(p, B.GRAMA) === 0, 'grama dá terra');

// criar: livro de receitas
await p.evaluate(() => { const m = window.__jogo.mercado; m.e.itens[6] = (m.e.itens[6] || 0) + 2; m.recebeu(m.e); }); // mais 2 troncos (3 no total)
await p.evaluate(() => window.__jogo.abrirInventario('criar'));
await p.waitForSelector('#inventario:not([hidden]) [data-receita=tabuas]');
conferir(await p.isVisible('.bancada-status.longe'), 'avisa que não tem bancada por perto');
for (let i = 0; i < 3; i++) await p.click('[data-receita=tabuas]');
conferir(await qtd(p, B.TABUAS) === 12 && await qtd(p, B.TRONCO) === 0, '3 troncos viram 12 tábuas');
conferir(await p.getAttribute('[data-receita=tabuas]', 'class') === 'receita falta', 'sem tronco a receita fica apagada');
await p.click('[data-receita=picareta-madeira]');
conferir(await qtd(p, I.PICARETA_MADEIRA) === 0, 'picareta precisa de bancada');
await p.click('[data-receita=graveto]');
await p.click('[data-receita=bancada]');
conferir(await qtd(p, B.BANCADA) === 1 && await qtd(p, I.GRAVETO) === 4 && await qtd(p, B.TABUAS) === 6, 'criou gravetos e bancada');
await p.screenshot({ path: SAIDA + '/criar-sem-bancada.png' });
await p.click('#inventario [data-fechar]');

// colocar a bancada (gasta 1) e tocar nela abre as receitas
await p.evaluate(() => { const j = window.__jogo; j.slot = j.barra.indexOf(34); });
pos = await alvo(p, B.PEDRA);
await p.evaluate(() => { const j = window.__jogo.jog; j.pitch = 0; window.__jogo.usar(null); });
const posBancada = [pos[0], pos[1], pos[2] + 1];
conferir(await blocoEm(p, posBancada) === B.BANCADA && await qtd(p, B.BANCADA) === 0, 'colocou a bancada e ela saiu da mochila');
await p.evaluate(() => window.__jogo.usar(null));
await p.waitForSelector('#inventario:not([hidden]) .bancada-status.ok');
conferir(true, 'tocar na bancada abre o livro de receitas, com bancada perto');
await p.click('[data-receita=picareta-madeira]');
conferir(await qtd(p, I.PICARETA_MADEIRA) === 1, 'criou picareta de madeira na bancada');
await p.screenshot({ path: SAIDA + '/criar-com-bancada.png' });
await p.evaluate(() => window.__jogo.abrirInventario('mochila'));
await p.screenshot({ path: SAIDA + '/mochila.png' });
await p.click('#inventario [data-fechar]');

// ferramenta: pedra com a mão = 6 toques; com picareta de madeira = 3
await p.evaluate(() => { const j = window.__jogo; j.slot = j.barra.indexOf(1001); });
pos = await alvo(p, B.PEDRA);
await bater(p, 2);
conferir(await blocoEm(p, pos) === B.PEDRA, 'pedra ainda inteira depois de 2 toques com picareta');
await bater(p, 1);
conferir(await blocoEm(p, pos) === 0 && await qtd(p, B.PEDRA) === 1, 'picareta de madeira quebra pedra em 3 toques');
// ferramenta na mão não coloca bloco
pos = await alvo(p, B.PEDRA);
await p.evaluate(() => window.__jogo.usar(null));
conferir(await blocoEm(p, [pos[0], pos[1], pos[2] + 1]) === 0, 'com ferramenta na mão não coloca nada');
// colocar o último bloco: acaba e não coloca mais
await p.evaluate(() => { const j = window.__jogo; j.slot = j.barra.indexOf(2); });
conferir(await qtd(p, B.TERRA) === 1, 'tem 1 terra');
await p.evaluate(() => window.__jogo.usar(null));
conferir(await blocoEm(p, [pos[0], pos[1], pos[2] + 1]) === B.TERRA && await qtd(p, B.TERRA) === 0, 'colocou a terra e acabou');
await p.evaluate(([x, y, z]) => { window.__jogo.mundo.definir(x, y, z + 1, 0); window.__jogo.usar(null); }, pos);
conferir(await blocoEm(p, [pos[0], pos[1], pos[2] + 1]) === 0, 'sem terra não coloca');
await p.screenshot({ path: SAIDA + '/barra-sobrevivencia.png' });

// salva e volta
const antes = await p.evaluate(() => JSON.stringify(window.__jogo.mercado.e.itens));
await p.evaluate(() => { window.dispatchEvent(new Event('beforeunload')); });
await p.reload();
await p.click('#bt-sozinho');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
const depois = await p.evaluate(() => JSON.stringify(window.__jogo.mercado.e.itens));
conferir(antes === depois, 'a mochila continua depois de recarregar (' + depois + ')');
conferir(await p.evaluate(() => window.__jogo.barra.includes(1001)), 'a barra também');
// com o mercado: vender sai da mesma mochila e comprar traz 4 do bloco
const m0 = await p.evaluate(() => window.__jogo.mercado.e.moedas);
await p.evaluate(() => window.__jogo.mercado.enviar({ t: 'comprar', b: 33 }));
conferir(await qtd(p, 33) === 4 && await p.evaluate(() => window.__jogo.mercado.e.moedas) === m0 - 8, 'loja: comprou 4 fenos (8 moedas)');
await p.evaluate(() => window.__jogo.mercado.enviar({ t: 'vender', b: 1001, n: 1 }));
conferir(await qtd(p, 1001) === 0, 'loja: vendeu a picareta da mochila');
await p.context().close();

// ---------- mundo criativo (opção desligada): blocos à vontade, sem mochila ----------
const c = await pagina();
await c.evaluate(() => localStorage.removeItem('pradaria.local'));
await c.click('#bt-sozinho');
await c.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
await c.click('[data-opcao=sobrevivencia]');
await c.click('#m-novo button[type=submit]');
await c.waitForFunction(() => window.__jogo && window.__jogo.jog);
await c.waitForTimeout(1500);
conferir(await c.evaluate(() => window.__jogo.barra.every((x) => x > 0)), 'criativo: barra cheia de blocos');
pos = await alvo(c, B.TRONCO);
await bater(c, 5);
conferir(await c.evaluate(() => Object.keys(window.__jogo.mercado.e.itens).length) === 0, 'criativo: quebrar não junta nada');
await c.evaluate(() => window.__jogo.abrirInventario());
conferir(!(await c.isVisible('[data-aba=criar]')) && await c.isVisible('[data-aba=maquinas]'), 'criativo: abas Blocos e Engenharia, sem Criar');
await c.context().close();

// ---------- online: a mochila fica guardada na sala ----------
const nome = 'cri' + Math.random().toString(36).slice(2, 8);
const o = await pagina(true);
await o.click('#bt-criar-conta');
await o.fill('#c-nome', nome); await o.fill('#c-senha', 'senha123');
await o.click('#c-ok');
await o.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 }); // o primeiro cadastro depois de ligar o servidor demora
await o.click('#bt-novo-mundo');
await o.fill('#n-nome', 'Mundo de criar');
await o.click('#m-novo button[type=submit]');
await o.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala);
await o.waitForTimeout(2000);
conferir(await o.evaluate(() => window.__jogo.opcoesMundo.sobrevivencia === true), 'online: mundo novo com coletar e criar');
pos = await alvo(o, B.TRONCO);
await bater(o, 5);
conferir(await qtd(o, B.TRONCO) === 1, 'online: tronco na mochila');
await o.evaluate(() => { const m = window.__jogo.mercado; m.e.itens[14] = 5; window.__jogo.sala.enviar({ t: 'ev', e: 'la' }); });
await o.waitForTimeout(2200); // envio atrasado da mochila
await o.screenshot({ path: SAIDA + '/online-toque.png' });
await o.evaluate(() => window.__jogo.abrirInventario('criar'));
await o.click('[data-receita=tabuas]');
conferir(await qtd(o, B.TABUAS) === 4 && await qtd(o, B.TRONCO) === 0, 'online: criou tábuas');
await o.waitForTimeout(800);
conferir(await qtd(o, B.TABUAS) === 4, 'online: a sala confirmou as tábuas');
await o.screenshot({ path: SAIDA + '/criar-tablet.png' });
await o.reload();
await o.waitForSelector('#m-mundos:not([hidden])');
await o.click('#lista-mundos .mundo');
await o.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala);
await o.waitForTimeout(1000);
conferir(await qtd(o, B.TABUAS) === 4 && await qtd(o, B.TRONCO) === 0 && await qtd(o, B.LA_BRANCA) === 1, 'online: mochila volta igual depois de sair e entrar');
conferir(await o.evaluate(() => window.__jogo.barra.includes(8)), 'online: a barra também volta');

console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros no console');
conferir(erros.length === 0, 'sem erros no console');
await b.close();
process.exit(falhas.length ? 1 : 0);

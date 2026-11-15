// Teste real dos amigos da plataforma com 2 jogadores: Ana (PC) e Beto (celular ou tablet).
// Cria as duas contas pela tela, Ana pede amizade, Beto vê o pedido na hora e aceita, um vê o outro online,
// Ana entra num mundo e chama Beto pela pausa, Beto aceita o convite e aparece no mundo da Ana. No fim desfazem a amizade.
// SAIDA=pasta das fotos, URL=site, BETO=celular|tablet
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/amigos';
const URL = process.env.URL || 'http://localhost:8788';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
const letras = () => Math.random().toString(36).replace(/[^a-z]/g, '').slice(0, 6);
const BETO = process.env.BETO === 'tablet' ? { ...devices['Galaxy Tab S4 landscape'] } : { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function jogador(nome, opc) {
  const ctx = await b.newContext(opc);
  const p = await ctx.newPage(); const erros = [];
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) erros.push('console: ' + m.text()); });
  const toque = !!opc.hasTouch;
  const j = { p, erros, nome, clica: (sel) => (toque ? p.tap(sel) : p.click(sel)), foto: async (n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${SAIDA}/${n}.png` }); } };
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(800);
  await j.clica('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await j.clica('#c-ok');
  await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  return j;
}
const amigoLinha = (j, nome) => j.p.locator('#amigos-lista .amigo', { hasText: nome });

const ana = await jogador('ana' + letras(), { viewport: { width: 1280, height: 800 } });
const beto = await jogador('beto' + letras(), BETO);
ok(true, `contas criadas: ${ana.nome} (PC) e ${beto.nome}`);

// nome que não existe
await ana.clica('#bt-amigos');
await ana.p.waitForSelector('#amigos:not([hidden])');
await ana.p.fill('#amigos-nome', 'ninguemassim' + letras());
await ana.clica('#amigos-add button[type=submit]');
await ana.p.waitForFunction(() => /Não achei/.test(document.querySelector('#amigos-msg').textContent));
ok(true, 'nome que não existe: "Não achei ninguém"');
// pedido
await ana.p.fill('#amigos-nome', beto.nome.toUpperCase());
await ana.clica('#amigos-add button[type=submit]');
await ana.p.waitForFunction(() => /Pedido enviado/.test(document.querySelector('#amigos-msg').textContent));
ok(await ana.p.locator('#amigos-enviados .amigo', { hasText: beto.nome }).count() === 1, 'Ana vê o pedido em "Esperando aceitar" (nome com letras maiúsculas também acha)');
await ana.foto('1-ana-pediu');
// Beto vê na hora, sem recarregar
await beto.p.waitForFunction(() => /1 pedido/.test(document.querySelector('#amigos-contador').textContent), null, { timeout: 10000 });
ok(true, 'Beto vê "1 pedido" no botão Amigos na hora');
await beto.foto('2-beto-pedido-chegou');
await beto.clica('#bt-amigos');
await beto.p.waitForSelector('#amigos-recebidos .amigo');
await beto.foto('3-beto-amigos');
await beto.clica('#amigos-recebidos .amigo .bt.verde');
await beto.p.waitForFunction(() => /são amigos/.test(document.querySelector('#amigos-msg').textContent));
ok(true, 'Beto aceitou');
await beto.p.waitForFunction((n) => [...document.querySelectorAll('#amigos-lista .amigo.online')].some((e) => e.textContent.includes(n)), ana.nome, { timeout: 10000 });
ok(/Escolhendo um jogo/.test(await amigoLinha(beto, ana.nome).textContent()), 'Beto vê Ana online "Escolhendo um jogo"');
await ana.p.waitForFunction((n) => [...document.querySelectorAll('#amigos-lista .amigo.online')].some((e) => e.textContent.includes(n)), beto.nome, { timeout: 10000 });
ok(true, 'Ana vê Beto online na hora (a lista se atualizou sozinha)');
await ana.foto('4-ana-ve-beto-online');
await ana.clica('#amigos-fechar');
ok(/1 online/.test(await ana.p.textContent('#amigos-contador')), 'botão Amigos da Ana mostra "1 online"');

// Ana entra num mundo do Pradaria
await ana.clica('.jogo[data-jogo=pradaria]'); await ana.p.waitForSelector('#m-mundos:not([hidden])');
await ana.clica('#bt-novo-mundo'); await ana.p.fill('#n-nome', 'Casa da Ana'); await ana.clica('#m-novo button[type=submit]');
await ana.p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala && !document.querySelector('#hud').hidden, null, { timeout: 60000 });
ok(true, 'Ana entrou no mundo "Casa da Ana"');
await beto.p.waitForFunction((n) => [...document.querySelectorAll('#amigos-lista .amigo')].some((e) => e.textContent.includes(n) && /Jogando Pradaria/.test(e.textContent)), ana.nome, { timeout: 10000 });
ok(true, 'Beto vê Ana "Jogando Pradaria"');
await beto.foto('5-beto-ve-ana-jogando');
await beto.clica('#amigos-fechar');

// Ana chama pela pausa
await ana.p.keyboard.press('Escape'); await ana.p.waitForTimeout(400);
if (!(await ana.p.isVisible('#pausa'))) await ana.clica('#bt-menu');
await ana.p.waitForSelector('#bt-chamar-amigos:not([hidden])');
await ana.clica('#bt-chamar-amigos');
await ana.p.waitForSelector('#amigos:not([hidden]) .chamar');
await ana.foto('6-ana-chamar');
await ana.clica('#amigos-lista .chamar');
await beto.p.waitForSelector('#convite:not([hidden])', { timeout: 10000 });
ok(/Casa da Ana/.test(await beto.p.textContent('#convite-txt')), 'Beto recebe o convite com o nome do mundo');
await beto.foto('7-beto-convite');
// guarda todos os avisos da Ana (um aviso novo, como "fulano entrou", pode tomar o lugar logo depois)
await ana.p.evaluate(() => { window.__avisos = []; new MutationObserver(() => window.__avisos.push(document.querySelector('#aviso').textContent)).observe(document.querySelector('#aviso'), { childList: true, subtree: true, characterData: true }); });
await beto.clica('#convite-sim');
await ana.p.waitForFunction(() => window.__avisos.some((t) => /está vindo/.test(t)), null, { timeout: 10000 }).catch(async (e) => { console.log('avisos da Ana:', await ana.p.evaluate(() => window.__avisos)); throw e; });
ok(true, 'Ana vê "está vindo!"');
await beto.p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala && !document.querySelector('#hud').hidden, null, { timeout: 60000 });
ok(true, 'Beto entrou no mundo da Ana pelo convite');
await ana.clica('#amigos-fechar').catch(() => {});
await ana.p.waitForFunction(() => window.__jogo.outros >= 1, null, { timeout: 15000 });
await beto.p.waitForFunction(() => window.__jogo.outros >= 1, null, { timeout: 15000 });
ok(true, 'os dois se veem no mesmo mundo');
await beto.p.waitForTimeout(1500); await beto.foto('8-beto-no-mundo-da-ana'); await ana.foto('8-ana-ve-beto');

// Beto desfaz a amizade (pela pausa -> sair -> jogos -> amigos)
await beto.p.evaluate(() => document.querySelector('#bt-sair-mundo').click());
await beto.p.waitForSelector('#m-mundos:not([hidden])');
await beto.clica('#bt-voltar-jogos'); await beto.p.waitForSelector('#m-jogos:not([hidden])');
await beto.clica('#bt-amigos'); await beto.p.waitForSelector('#amigos-lista .amigo');
await beto.clica('#amigos-lista .amigo .remover');
await beto.clica('#amigos-lista .amigo .perigo');
await beto.p.waitForFunction(() => /não são mais amigos/.test(document.querySelector('#amigos-msg').textContent));
ok(await beto.p.locator('#amigos-lista .amigo').count() === 0, 'Beto desfez a amizade');
await ana.p.waitForFunction(() => !/online/.test(document.querySelector('#amigos-contador').textContent) || document.querySelector('#amigos-contador').hidden, null, { timeout: 10000 });
ok(true, 'contador da Ana atualizou');

ok(ana.erros.length === 0, 'Ana sem erros no console ' + ana.erros.join(' | ').slice(0, 300));
ok(beto.erros.length === 0, 'Beto sem erros no console ' + beto.erros.join(' | ').slice(0, 300));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

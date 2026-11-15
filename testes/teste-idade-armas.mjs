// "Você tem 16 anos ou mais?" na opção Armas, jogando de verdade:
//  - sem internet: ligar Armas na criação pergunta; "não" deixa desligado e fica guardado; "sim" liga e o mundo abre com armas
//  - online: resposta guardada na conta; quem tem menos de 16 não entra no mundo com Armas pelo código (e o servidor barra,
//    sem deixar trocar a resposta); quem tem 16 entra (tablet)
// LOCAL=http://localhost:8799 (arquivos estáticos) e BASE=http://localhost:8788 (npm run dev:sala + npm run dev) ou o site no ar.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const LOCAL = process.env.LOCAL || process.env.BASE || 'http://localhost:8788';
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const TOKEN = 'pradaria.token';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const ouvir = (p, nome) => {
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|status of 403/.test(m.text())) erros.push(nome + ' ' + m.text()); });
};

// ---------- sem internet ----------
{
  const ctx = await b.newContext({ viewport: { width: 1024, height: 700 } });
  const p = await ctx.newPage(); ouvir(p, 'local');
  await p.goto(LOCAL + '/#teste');
  await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden]) #n-opcoes:not([hidden])');
  await p.click('#n-lista [data-opcao=armas]');
  await p.waitForSelector('#idade:not([hidden])');
  await p.screenshot({ path: SAIDA + '/idade-pergunta.png' });
  await p.click('#idade-nao');
  conferir((await p.textContent('#idade-txt')).includes('16 anos'), 'quem não tem 16 vê a explicação');
  await p.click('#idade-ok');
  conferir(await p.getAttribute('#n-lista [data-opcao=armas]', 'aria-pressed') === 'false', '"não": Armas continua desligada');
  await p.click('#n-lista [data-opcao=armas]');
  conferir(await p.isVisible('#idade-ok') && !(await p.isVisible('#idade-sim')), 'resposta "não" fica guardada (não pergunta de novo)');
  await p.click('#idade-ok');
  await p.evaluate(() => localStorage.removeItem('pradaria.idade16')); // outra pessoa no aparelho
  await p.click('#n-lista [data-opcao=armas]');
  await p.click('#idade-sim');
  conferir(await p.getAttribute('#n-lista [data-opcao=armas]', 'aria-pressed') === 'true', '"sim": Armas liga');
  await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 });
  conferir(await p.evaluate(() => window.__jogo.opcoesMundo.armas === true), 'mundo abre com armas');
  // sai e volta: já respondeu, entra direto
  await p.evaluate(() => document.querySelector('#bt-sair-mundo').click());
  await p.waitForTimeout(400);
  await p.evaluate(() => window.__jogo.jogarLocal());
  await p.waitForFunction(() => window.__jogo.jog && window.__jogo.opcoesMundo.armas, null, { timeout: 30000 });
  conferir(await p.isHidden('#idade'), 'quem já respondeu "sim" volta ao mundo sem pergunta');
  // quem respondeu "não" neste aparelho não abre o mundo salvo com armas
  await p.evaluate(() => document.querySelector('#bt-sair-mundo').click());
  await p.waitForTimeout(400);
  await p.evaluate(() => { localStorage.setItem('pradaria.idade16', '0'); window.__jogo.jogarLocal(); });
  await p.waitForSelector('#idade:not([hidden])');
  await p.click('#idade-ok');
  await p.waitForTimeout(500);
  conferir(await p.isHidden('#hud'), '"não" guardado: o mundo salvo com armas não abre');
  await ctx.close();
}

// ---------- online ----------
async function jogador(nome, op) {
  const ctx = await b.newContext(op);
  const p = await ctx.newPage(); ouvir(p, nome);
  await p.goto(BASE + '/#teste');
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  await p.click('#c-ok');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const sfx = Date.now() % 10000;
const a = await jogador('Ana' + sfx, { viewport: { width: 1024, height: 640 } });
await a.click('#bt-novo-mundo');
await a.fill('#n-nome', 'Batalha');
await a.click('#n-lista [data-opcao=armas]');
await a.waitForSelector('#idade:not([hidden])');
await a.click('#idade-sim');
await a.waitForFunction(() => document.querySelector('#idade').hidden);
conferir(await a.evaluate(async (k) => (await (await fetch('/api/eu', { headers: { authorization: 'Bearer ' + localStorage.getItem(k) } })).json()).usuario.idade16, TOKEN) === true, 'A: resposta guardada na conta');
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
conferir(await a.evaluate(() => window.__jogo.opcoesMundo.armas === true), 'A entra no mundo com Armas');
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);

const c = await jogador('Caio' + sfx, { viewport: { width: 900, height: 600 } });
await c.click('#bt-codigo'); await c.fill('#n-nome', codigo); await c.click('#m-novo button[type=submit]');
await c.waitForSelector('#idade:not([hidden])', { timeout: 10000 });
await c.screenshot({ path: SAIDA + '/idade-amigo.png' });
await c.click('#idade-nao');
await c.click('#idade-ok');
await c.waitForTimeout(800);
conferir(!(await c.evaluate(() => !!(window.__jogo && window.__jogo.sala))), 'C (menos de 16) não entra no mundo com Armas');
const barrado = await c.evaluate(async ([cod, k]) => {
  const h = { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem(k) };
  const r = await fetch('/api/mundos/entrar', { method: 'POST', headers: h, body: JSON.stringify({ codigo: cod }) });
  const r2 = await fetch('/api/eu/idade', { method: 'POST', headers: h, body: JSON.stringify({ mais16: true }) });
  return [r.status, (await r2.json()).idade16];
}, [codigo, TOKEN]);
conferir(barrado[0] === 403 && barrado[1] === false, 'servidor barra C e não deixa trocar a resposta para "sim": ' + barrado);
// C cria um mundo sem armas normalmente, mas o servidor recusa criar com armas
const criar = await c.evaluate(async (k) => (await fetch('/api/mundos', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem(k) }, body: JSON.stringify({ nome: 'Tiros', opcoes: { armas: true } }) })).status, TOKEN);
conferir(criar === 403, 'servidor não deixa C criar mundo com Armas: ' + criar);
await c.context().close();

const bb = await jogador('Beto' + sfx, { ...devices['iPad (gen 7) landscape'] });
await bb.tap('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.tap('#m-novo button[type=submit]');
await bb.waitForSelector('#idade:not([hidden])', { timeout: 10000 });
await bb.tap('#idade-sim');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
conferir(await bb.evaluate(() => window.__jogo.opcoesMundo.armas === true), 'B (tablet, 16 anos ou mais) entra no mundo com Armas');
await bb.screenshot({ path: SAIDA + '/idade-tablet-dentro.png' });

conferir(erros.length === 0, 'sem erros no console ' + erros.join(' | '));
await b.close();
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO OK');
process.exit(falhas.length ? 1 : 0);

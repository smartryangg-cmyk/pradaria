// Teste real da idade na conta: a data de nascimento é pedida ao criar a conta, fica no servidor e não muda;
// quem tem menos de 16 vê os jogos com armas bloqueados e não entra no mundo de Guerra (nem pela API);
// conta antiga (sem data) responde uma vez no login. Tablet, celular e PC. SAIDA=pasta das fotos.
// Local: precisa do `wrangler pages dev` (8788) e da sala (8790); a parte da conta antiga mexe no banco local.
import { createRequire } from 'module'; const req = createRequire('/opt/'); let pw; try { pw = req('playwright'); } catch { pw = createRequire(import.meta.url)('playwright'); }
import { execSync } from 'child_process';
const { chromium, devices } = pw;
const SAIDA = process.env.SAIDA || '/tmp/idade';
const URL = process.env.URL || 'http://localhost:8788';
const LOCAL = /localhost|127\.0\.0\.1/.test(URL);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA ') + msg); if (!c) falhas++; };
const erros = [];
async function pagina(nome, op) {
  const ctx = await b.newContext(op);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ': ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|status of 403|status of 400/.test(m.text())) erros.push(nome + ' console: ' + m.text()); });
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  return p;
}
const data = async (p, raiz, d, m, a) => { await p.selectOption(raiz + ' .d-dia', String(d)); await p.selectOption(raiz + ' .d-mes', String(m)); await p.selectOption(raiz + ' .d-ano', String(a)); };
const eu = (p) => p.evaluate(async () => (await (await fetch('/api/eu', { headers: { authorization: 'Bearer ' + localStorage.getItem('pradaria.token') } })).json()).usuario);
const api = (p, rota, corpo) => p.evaluate(async ([rota, corpo]) => { const r = await fetch('/api/' + rota, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + localStorage.getItem('pradaria.token') }, body: JSON.stringify(corpo) }); return [r.status, await r.json().catch(() => null)]; }, [rota, corpo]);
async function criarConta(p, nome, nasc, toque) {
  await (toque ? p.tap('#bt-criar-conta') : p.click('#bt-criar-conta'));
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  if (nasc) await data(p, '#c-nasc', ...nasc);
}
const sfx = Date.now() % 10000;

// 1) criança no tablet: o cadastro pede a data; sem a data não cria
const t = await pagina('tablet', { ...devices['Galaxy Tab S4 landscape'] });
await criarConta(t, 'Kid' + sfx, null, true);
ok(await t.isVisible('#c-nasc .d-ano'), 'tablet: o cadastro mostra dia, mês e ano de nascimento');
await t.selectOption('#c-nasc .d-dia', ''); // apaga o dia
await t.tap('#c-ok');
await t.waitForTimeout(400);
ok(/dia, o mês e o ano/.test(await t.textContent('#c-erro')) && await t.isVisible('#m-conta'), 'tablet: sem a data completa não cria a conta');
const dia = 10, ano = new Date().getFullYear() - 11;
await data(t, '#c-nasc', dia, 5, ano);
await t.screenshot({ path: SAIDA + '/1-tablet-cadastro.png' });
await t.tap('#c-ok');
await t.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
let u = await eu(t);
ok(u.idade16 === false && u.temNascimento === true, 'tablet: conta de 11 anos guardada no servidor (idade16 = não)');
ok(await t.isVisible('.jogo[data-jogo=arena].bloqueado') && /16 anos/.test(await t.textContent('.jogo[data-jogo=arena] small')), 'tablet: Arena aparece bloqueada (só 16 anos ou mais)');
await t.screenshot({ path: SAIDA + '/2-tablet-jogos-bloqueados.png' });
// tenta o mundo de Guerra
await t.tap('.jogo[data-jogo=pradaria]');
await t.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
await t.tap('#bt-novo-mundo');
await t.tap('[data-tipo=guerra]');
await t.waitForSelector('#idade:not([hidden])', { timeout: 5000 });
ok(/16 anos ou mais/.test(await t.textContent('#idade-txt')) && await t.isVisible('#idade-ok') && !(await t.isVisible('#idade-data')), 'tablet: mundo de Guerra bloqueado sem perguntar de novo');
await t.screenshot({ path: SAIDA + '/3-tablet-guerra-bloqueada.png' });
await t.tap('#idade-ok');
ok(await t.isHidden('#idade'), 'tablet: fecha o aviso e continua no menu');
// a própria pessoa não troca a data
let r = await api(t, 'eu/nascimento', { nascimento: '1990-01-01' });
u = await eu(t);
ok(u.idade16 === false, 'servidor não deixa trocar a data depois (continua menos de 16): ' + r[0]);
r = await api(t, 'mundos', { nome: 'Guerra', opcoes: { tipo: 'guerra' } });
ok(r[0] === 403, 'servidor barra criar mundo de Guerra com menos de 16: ' + r[0]);
r = await t.evaluate(async () => { const x = await fetch('/api/cadastrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'semdata' + Date.now() % 1e4, senha: 'senha123' }) }); return x.status; });
ok(r === 400, 'servidor recusa cadastro sem data de nascimento: ' + r);
await t.context().close();

// 2) adulto no celular: entra no mundo de Guerra sem pergunta nenhuma
const c = await pagina('celular', { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await criarConta(c, 'Adu' + sfx, [2, 3, 1995], true);
const fora = await c.evaluate(() => [...document.querySelectorAll('#c-nasc select')].filter((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).length);
ok(!fora, 'celular: as listas da data cabem na tela');
await c.screenshot({ path: SAIDA + '/4-cel-cadastro.png' });
await c.tap('#c-ok');
await c.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
u = await eu(c);
ok(u.idade16 === true, 'celular: conta de adulto (idade16 = sim)');
ok(!(await c.isVisible('.jogo[data-jogo=arena].bloqueado')), 'celular: Arena não fica bloqueada para adulto');
await c.tap('.jogo[data-jogo=pradaria]');
await c.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
await c.tap('#bt-novo-mundo');
await c.tap('[data-tipo=guerra]');
await c.waitForTimeout(500);
ok(!(await c.isVisible('#idade')), 'celular: adulto escolhe o mundo de Guerra sem pergunta');
await c.context().close();

// 3) conta antiga (sem data): pergunta uma vez no login, sem "Agora não"
if (LOCAL) {
  const p = await pagina('pc', { viewport: { width: 1280, height: 800 } });
  const nome = 'Velha' + sfx;
  await criarConta(p, nome, [1, 1, 2000]);
  await p.click('#c-ok');
  await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  execSync(`npx wrangler d1 execute pradaria-db --local --persist-to .estado --command "UPDATE usuarios SET nascimento = NULL WHERE nome = '${nome}'"`, { stdio: 'ignore' });
  await p.evaluate(() => localStorage.removeItem('pradaria.token'));
  await p.reload(); await p.waitForTimeout(500);
  await p.click('#bt-entrar');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  await p.click('#c-ok');
  await p.waitForSelector('#idade:not([hidden])', { timeout: 15000 });
  ok(await p.isVisible('#idade-data') && !(await p.isVisible('#idade-nao')), 'pc: conta antiga tem que dizer a data no login (sem "Agora não")');
  await p.selectOption('#idade .d-dia', '');
  await p.click('#idade-sim');
  ok(/dia, o mês e o ano/.test(await p.textContent('#idade-erro')), 'pc: sem data completa não fecha');
  await data(p, '#idade', 20, 7, new Date().getFullYear() - 14);
  await p.screenshot({ path: SAIDA + '/5-pc-conta-antiga.png' });
  await p.click('#idade-sim');
  await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  u = await eu(p);
  ok(u.temNascimento && u.idade16 === false, 'pc: data guardada (14 anos) e a lista de jogos abre');
  ok(await p.isVisible('.jogo[data-jogo=ilha].bloqueado'), 'pc: Última Ilha bloqueada para 14 anos');
  await p.reload(); await p.waitForSelector('#m-jogos:not([hidden])', { timeout: 15000 });
  ok(!(await p.isVisible('#idade')), 'pc: depois de responder não pergunta mais');
  await p.context().close();
}

ok(!erros.length, 'sem erros no console' + (erros.length ? ': ' + erros.join(' | ') : ''));
await b.close();
console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO CERTO');
process.exit(falhas ? 1 : 0);

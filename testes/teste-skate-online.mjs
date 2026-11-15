// Skate no multijogador: A sobe no skate e anda; B vê a A EM PÉ na prancha (pés na prancha, não enterrada).
// Precisa de `npm run dev:sala` e `npm run dev` rodando (portas 8790 e 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = 'http://localhost:8788/#teste';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
async function jogador(nome, toque) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 }, hasTouch: toque, isMobile: toque });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  if (await p.isVisible('#c-nasc .d-ano')) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '1990'); } await p.click('#c-ok');
  // depois de entrar aparece "Escolha um jogo": abre o Pradaria
  await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 15000 });
  if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) process.exitCode = 1; };
const sfx = Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join(''); // letras: com 4 algarismos do relógio o nome repetia entre testes e a conta não era criada
const a = await jogador('Ana' + sfx, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Estrada');
await a.click('[data-opcao=veiculos]'); // mod Veículos; sem mercado (desligado) a garagem é livre (com mercado, veja teste-veiculos-logica.mjs)
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(1500);


await a.evaluate(() => window.__jogo.garagem.novo('skate', 0));
await a.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 5000 });
const vid = await a.evaluate(() => window.__jogo.garagem.dentro.v.id);
await bb.waitForFunction((id) => window.__jogo.garagem.veic.mapa.has(id), vid, { timeout: 5000 });
ok(true, 'B vê o skate da A ' + vid);
const pv = await a.evaluate(() => { const v = window.__jogo.garagem.dentro.v; return [v.x, v.y, v.z]; });
await bb.evaluate((pv) => { const j = window.__jogo.jog; j.pos.x = pv[0] + 3; j.pos.y = pv[1] + 0.5; j.pos.z = pv[2] + 3; }, pv);
await bb.waitForTimeout(1500);
const medir = (id) => bb.evaluate((id) => {
  const v = window.__jogo.garagem.veic.mapa.get(id), bon = v && v.bonecos[0];
  if (!bon) return null;
  let min = 1e9, max = -1e9; bon.grupo.updateMatrixWorld(true);
  bon.grupo.traverse((o) => { if (!o.geometry) return; o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; for (const cx of [bb.min.x, bb.max.x]) for (const cy of [bb.min.y, bb.max.y]) for (const cz of [bb.min.z, bb.max.z]) { const y = o.localToWorld(bb.min.clone().set(cx, cy, cz)).y; min = Math.min(min, y); max = Math.max(max, y); } });
  return { pes: min - v.yVis, cabeca: max - v.yVis };
}, id);
let m = await medir(vid);
ok(m && m.pes > 0.12 && m.pes < 0.32, `B vê a A com os pés na prancha (${m && m.pes.toFixed(2)} acima do chão)`);
ok(m && m.cabeca > 1.6, `B vê a A em pé no skate (cabeça ${m && m.cabeca.toFixed(2)})`);
await a.keyboard.down('KeyW'); await a.waitForTimeout(1500); await a.keyboard.up('KeyW');
await bb.waitForTimeout(800);
m = await medir(vid);
ok(m && m.pes > 0.05 && m.pes < 0.4, `andando, B continua vendo os pés na prancha (${m && m.pes.toFixed(2)})`);
await bb.screenshot({ path: SAIDA + '/skate-online-B.png' });
ok(erros.length === 0, 'sem erros' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await b.close();

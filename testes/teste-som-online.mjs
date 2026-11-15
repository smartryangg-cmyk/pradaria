// Som 3D de outro jogador: Beto ouve de que lado a Ana quebra bloco, anda e dirige (esquerda/direita certos).
// Precisa de `npm run dev:sala` e `npm run dev` (portas 8790 e 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const URL = (process.env.BASE || 'http://localhost:8788') + '/#teste';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const erros = [];
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) process.exitCode = 1; };
async function jogador(nome, toque) {
  const ctx = await b.newContext({ viewport: { width: 1024, height: 640 }, hasTouch: toque, isMobile: toque });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push(nome + ' ' + m.text()); });
  await p.goto(URL);
  await p.click('#bt-criar-conta');
  await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
  if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
  if (await p.isVisible('#c-nasc .d-ano')) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '1990'); } await p.click('#c-ok');
  await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 15000 });
  if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
  await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 15000 });
  return p;
}
// Beto registra o que ouve vindo de longe (som 3D): tipo, lado (-1 esquerda, +1 direita) e volume
const escutar = () => {
  const s = window.__jogo.som; window.__ouviu = [];
  const em = s.em.bind(s);
  s.em = (pos, fn, alc) => { const r = pos && s.espacial(pos.x, pos.y, pos.z, alc); const marca = { pan: r ? +r.pan.toFixed(2) : null, vol: r ? +r.vol.toFixed(2) : null, k: [] }; window.__ouviu.push(marca); const ant = window.__marca; window.__marca = marca; try { em(pos, fn, alc); } finally { window.__marca = ant; } };
  for (const k of ['passo', 'quebrar', 'colocar', 'bater']) { const f = s[k].bind(s); s[k] = (...a) => { if (window.__marca) window.__marca.k.push(k); return f(...a); }; }
};
// leva o jogador para um chão firme e plano (sem água), para andar e mexer em blocos sem depender do lugar onde nasceu
const irParaChaoFirme = (p) => p.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog;
  const firme = (x, z) => { const y = m.chao(x, z); const b = m.bloco(x, y, z); return b && b !== 5 && !(b >= 23 && b <= 30) && !m.bloco(x, y + 1, z) && !m.bloco(x, y + 2, z) ? y : 0; };
  let melhor = null;
  for (let r = 0; r < 60 && !melhor; r += 2) for (let dx = -r; dx <= r && !melhor; dx += 2) for (let dz = -r; dz <= r && !melhor; dz += 2) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = Math.floor(j.pos.x) + dx, z = Math.floor(j.pos.z) + dz, y = firme(x, z);
    if (!y) continue;
    let plano = true;
    for (let k = -10; k <= 8 && plano; k++) if (firme(x + k, z) !== y) plano = false;
    if (plano) melhor = { x: x + 0.5, y: y + 1, z: z + 0.5 };
  }
  if (melhor) { j.pos.x = melhor.x; j.pos.y = melhor.y; j.pos.z = melhor.z; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = Math.PI / 2; j.pitch = 0; }
  return !!melhor;
});
const ouviu = (p, k) => p.evaluate((k) => window.__ouviu.filter((x) => x.k.includes(k)), k);
const sfx = Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join(''); // letras: com 4 algarismos do relógio o nome repetia entre testes e a conta não era criada
const a = await jogador('Ana' + sfx, false);
await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Barulhinho');
await a.click('[data-modo=criativo]'); await a.click('#m-novo [data-opcao=veiculos]'); // sem mercado (mod desligado) e blocos à vontade
await a.click('#m-novo button[type=submit]');
await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 20000 });
await a.waitForTimeout(2500);
const codigo = await a.evaluate(() => window.__jogo.sala.codigo);
const bb = await jogador('Beto' + sfx, true);
await bb.click('#bt-codigo'); await bb.fill('#n-nome', codigo); await bb.click('#m-novo button[type=submit]');
await bb.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 20000 });
await bb.waitForTimeout(2000);
await bb.evaluate(escutar);
ok(await bb.evaluate(() => window.__jogo.som.ctx && window.__jogo.som.ctx.state === 'running'), 'áudio do Beto ligado');

console.log('     Ana em chão firme:', await irParaChaoFirme(a));
await a.waitForTimeout(1500);
// Beto fica 5 blocos a leste da Ana, olhando para o norte (-z): a Ana está à ESQUERDA dele
const pa = await a.evaluate(() => ({ ...window.__jogo.jog.pos }));
const colocarBeto = (yaw) => bb.evaluate(([pa, yaw]) => { const j = window.__jogo.jog; j.pos.x = pa.x + 5; j.pos.z = pa.z; j.pos.y = pa.y + 0.5; j.vel.set ? j.vel.set(0, 0, 0) : 0; j.yaw = yaw; j.pitch = 0; }, [pa, yaw]);
await colocarBeto(0);
await bb.waitForTimeout(1200);
await bb.evaluate(() => { window.__ouviu.length = 0; });
// Ana coloca um bloco no chão da frente dela
const edAntes = await a.evaluate(() => window.__jogo.mundo.listarEdicoes().length);
for (const pitch of [-0.8, -0.6, -0.5, -0.4]) { await a.evaluate((pt) => { window.__jogo.jog.pitch = pt; }, pitch); await a.waitForTimeout(150); await a.evaluate(() => window.__jogo.usar(null)); await a.waitForTimeout(150); if (await a.evaluate((n) => window.__jogo.mundo.listarEdicoes().length > n, edAntes)) break; }
await bb.waitForTimeout(800);
const c = await ouviu(bb, 'colocar');
ok(c.length >= 1 && c[0].pan < -0.3, `Beto ouve a Ana colocar à esquerda: ${JSON.stringify(c.slice(0, 2))}`);
await bb.screenshot({ path: (process.env.SAIDA || '/tmp') + '/som-online-beto.png' });

// Beto vira para o sul: agora a Ana fica à DIREITA; Ana quebra o bloco que pôs (segurando: vários toques)
await colocarBeto(Math.PI);
await bb.waitForTimeout(600);
await bb.evaluate(() => { window.__ouviu.length = 0; });
for (let i = 0; i < 10; i++) { await a.evaluate(() => window.__jogo.quebrar(null)); await a.waitForTimeout(200); }
await bb.waitForTimeout(800);
const q = await ouviu(bb, 'quebrar');
ok(q.length >= 1 && q[0].pan > 0.3, `Beto (virado) ouve a Ana quebrar à direita: ${JSON.stringify(q.slice(0, 2))}`);

// Ana anda: Beto ouve os passos dela (e mais baixo quando ela se afasta)
await bb.evaluate(() => { window.__ouviu.length = 0; });
// (a oeste dela ficou o buraco do bloco quebrado: anda para o leste, chegando perto do Beto, que fica mais longe agora)
await bb.evaluate(() => { window.__jogo.jog.pos.x += 7; });
await a.evaluate(() => { window.__jogo.jog.pitch = 0; window.__jogo.jog.yaw = -Math.PI / 2; });
const ini = await a.evaluate(() => ({ ...window.__jogo.jog.pos }));
await a.keyboard.down('KeyW'); await a.waitForTimeout(2200); await a.keyboard.up('KeyW');
console.log('     Ana andou de', ini.x.toFixed(1), 'até', await a.evaluate(() => window.__jogo.jog.pos.x.toFixed(1)), 'Beto vê acao', await bb.evaluate(() => window.__jogo.outrosLista[0].acao));
await bb.waitForTimeout(800);
const ps = await ouviu(bb, 'passo');
ok(ps.length >= 2, `Beto ouve os passos da Ana: ${ps.length} passos, volume subindo ${ps.map((x) => x.vol).join(' < ')}`);

// Ana dirige um carro: Beto ouve o motor dela, do lado dela
await a.evaluate(() => window.__jogo.mercado.veiculo({ t: 'chave', tipo: 'carro' }));
await a.waitForTimeout(800);
await a.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog;
  let melhor = 0, livre = -1;
  for (let k = 0; k < 8; k++) {
    const yaw = k * Math.PI / 4; let n = 0;
    for (let d = 2; d < 16; d++) { const x = Math.floor(j.pos.x - Math.sin(yaw) * d), z = Math.floor(j.pos.z - Math.cos(yaw) * d); if (Math.abs(m.alturaEm(x, z) - m.chao(x, z)) > 0 || m.chao(x, z) > j.pos.y + 1) break; n++; }
    if (n > livre) { livre = n; melhor = yaw; }
  }
  j.yaw = melhor;
  J.garagem.novo('carro', 1);
});
await a.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 6000 }).catch(() => {});
const vid = await a.evaluate(() => window.__jogo.garagem.dentro && window.__jogo.garagem.dentro.v.id);
await a.keyboard.down('KeyW'); await a.waitForTimeout(1500);
const pv = await a.evaluate(() => { const v = window.__jogo.garagem.dentro?.v || window.__jogo.jog.pos; return { x: v.x, y: v.y, z: v.z }; });
await colocarBeto(0);
await bb.evaluate((pv) => { const j = window.__jogo.jog; j.pos.x = pv.x + 8; j.pos.z = pv.z; }, pv);
await bb.waitForTimeout(1500);
const mot = await bb.evaluate((id) => { const m = window.__jogo.som.motores.get(id); return m ? { pan: +m.pan.pan.value.toFixed(2), vol: +m.g.gain.value.toFixed(3), hz: +m.o1.frequency.value.toFixed(0) } : null; }, vid);
await a.keyboard.up('KeyW');
ok(mot && mot.vol > 0, `Beto ouve o motor do carro da Ana: ${JSON.stringify(mot)}`);
ok(!erros.length, 'console sem erros' + (erros.length ? ': ' + erros.slice(0, 5).join(' | ') : ''));
await b.close();

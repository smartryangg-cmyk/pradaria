// Teste jogando de verdade (Chromium com WebGL): atacar os bichos.
//  - tablet sem internet: toque rápido faz carinho; segurar o dedo bate. Ovelha foge com o bando, urso enfrenta
//    e morde, matilha de lobos vem junto, cachorro não se machuca, bicho derrubado tomba e cai carne/lã na mochila.
//  - online com dois jogadores: computador (clique esquerdo bate, direito faz carinho) e tablet no mesmo mundo;
//    a sala confere e põe o que caiu na mochila de cada um.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).  SAIDA=pasta para as fotos.
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const ipx = () => '10.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250);
const CARNE = 1007, COURO = 1008, LA = 14;

async function abrir(ctxOpts, nome) {
  const ctx = await b.newContext({ ...ctxOpts, ...(BASE.includes('localhost') ? { extraHTTPHeaders: { 'cf-connecting-ip': ipx() } } : {}) });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(nome + ' PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|favicon|Failed to load resource/.test(m.text())) erros.push(nome + ' ' + m.text()); });
  await p.goto(BASE + '/#teste');
  await p.evaluate(() => localStorage.clear());
  return { ctx, p };
}
async function vigiarAvisos(p) {
  await p.evaluate(() => { window.__avisos = []; const el = document.querySelector('#aviso'); new MutationObserver(() => { const t = el.textContent.trim(); if (t && window.__avisos.at(-1) !== t) window.__avisos.push(t); }).observe(el, { childList: true, subtree: true, characterData: true, attributes: true }); });
}
// palco: gramado plano, com um buraco (cercado natural) na frente para o bicho não fugir
async function preparar(p) {
  await p.evaluate(() => {
    const g = window.__jogo, j = g.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y = Math.max(30, g.mundo.chao(x0, z0));
    for (let dx = -18; dx <= 18; dx++) for (let dz = -18; dz <= 18; dz++) {
      g.mundo.definir(x0 + dx, y, z0 + dz, 1);
      for (let h = 1; h <= 40; h++) if (g.mundo.bloco(x0 + dx, y + h, z0 + dz)) g.mundo.definir(x0 + dx, y + h, z0 + dz, 0);
    }
    j.voando = false;
    // os moradores de uma vila perto passeiam pelo palco: não podem ficar na frente do bicho (abrem a lojinha)
    g.aldeoes.atingir = () => null;
    j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y + 1; j.yaw = 0; j.pitch = -0.15;
    window.__centro = [x0 + 0.5, y + 1, z0 + 0.5]; window.__y = y;
    window.__criar = (esp, dx, dz, o = {}) => { const x = Math.floor(j.pos.x + dx), z = Math.floor(j.pos.z + dz); return g.bichos.criar(esp, x + 0.5, g.mundo.chao(x, z) + 1, z + 0.5, o); };
    // buraco 3x3, 2 de fundo, com o meio em (dx, dz) do centro do palco
    window.__buracos = [];
    window.__buraco = (dx, dz) => { const [cx, , cz] = window.__centro; for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (let h = 0; h >= -1; h--) { const q = [Math.floor(cx + dx) + a, y + h, Math.floor(cz + dz) + c]; g.mundo.definir(...q, 0); window.__buracos.push(q); } };
    window.__dist = (bb) => Math.hypot(bb.x - j.pos.x, bb.z - j.pos.z);
    window.__tela = (bb) => { const v = bb.grupo.position.clone(); v.y += bb.e.alt * bb.esc * 0.75; // mira no alto do bicho: no buraco, a beirada tampa a parte de baixo
    v.project(g.camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; };
    window.__limpar = () => { [j.pos.x, j.pos.y, j.pos.z] = window.__centro; j.vel.x = j.vel.z = 0; g.bichos.tempoSpawn = 1e9; g.bichos.limpar(); g.vida.protegido = 0; g.vida.reiniciar(); window.__avisos = []; for (const q of window.__buracos.splice(0)) g.mundo.definir(...q, 1); const [cx, , cz] = window.__centro; for (let dx = -7; dx <= 7; dx++) for (let dz = -7; dz <= 7; dz++) for (let h = 0; h >= -1; h--) if (!g.mundo.bloco(Math.floor(cx) + dx, y + h, Math.floor(cz) + dz)) g.mundo.definir(Math.floor(cx) + dx, y + h, Math.floor(cz) + dz, 1); }; // tapa o que um golpe errado quebrou
    window.__olhar = (bb) => { const c = { x: j.pos.x, y: j.pos.y + 1.6, z: j.pos.z }; j.yaw = Math.atan2(-(bb.x - c.x), -(bb.z - c.z)); j.pitch = Math.atan2(bb.y + bb.e.alt * bb.esc * 0.8 - c.y, Math.hypot(bb.x - c.x, bb.z - c.z)); };
    window.__carinhos = 0; const oc = g.bichos.carinho.bind(g.bichos); g.bichos.carinho = (bb) => { window.__carinhos++; return oc(bb); };
    window.__golpes = []; const orig = g.bichos.bater.bind(g.bichos); g.bichos.bater = (bb, f) => { const r = orig(bb, f); window.__golpes.push(bb.especie + ':' + r); return r; };
    window.__vidaMin = 10; window.__vigia = setInterval(() => { window.__vidaMin = Math.min(window.__vidaMin, g.vida.atual); }, 100);
  });
  await p.waitForTimeout(1500);
}
const qtd = (p, id) => p.evaluate((id) => window.__jogo.mercado.qtd(id), id);

// segura o dedo no bicho (dedo parado = bater, como para quebrar bloco); mira de novo a cada segurada
async function segurarNoBicho(p, cdp, achar, ms, ate) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const pt = await p.evaluate((f) => { const bb = eval(f)(); if (!bb) return null; window.__olhar(bb); return true; }, achar.toString());
    if (!pt) return;
    await p.waitForTimeout(450); // a câmera acompanha no próximo quadro
    const t = await p.evaluate((f) => { const bb = eval(f)(); return bb ? window.__tela(bb) : null; }, achar.toString());
    if (!t) return;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t.x, y: t.y, id: 7 }] });
    await p.waitForTimeout(1300);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    if (ate && await p.evaluate(ate)) return;
  }
}

// ================= TABLET sem internet =================
if (!process.env.SO_ONLINE) {
  const { ctx, p } = await abrir({ ...devices['iPad (gen 7) landscape'], hasTouch: true, isMobile: true }, 'tablet');
  await p.tap('#bt-sozinho');
  await p.waitForSelector('#n-opcoes:not([hidden])');
  await p.tap('[data-opcao=selvagensMachucam]');
  await p.tap('[data-tamanho=pequeno]');
  await p.tap('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
  await p.waitForTimeout(3000);
  await vigiarAvisos(p);
  await preparar(p);
  const cdp = await ctx.newCDPSession(p);

  // 1. toque rápido na ovelha: carinho (corações), ela não perde vida
  await p.evaluate(() => { window.__limpar(); const o = window.__criar('ovelha', 0, -3.5); o.calmo = 99; o.estado = 'pastar'; o.timer = 99; window.__olhar(o); });
  await p.waitForTimeout(700);
  const part0 = await p.evaluate(() => window.__jogo.bichos.particulas.length);
  for (let k = 0; k < 3 && (await p.evaluate(() => window.__jogo.bichos.particulas.length)) <= part0; k++) {
    const t = await p.evaluate(() => window.__tela(window.__jogo.bichos.lista[0]));
    await p.touchscreen.tap(t.x, t.y); await p.waitForTimeout(300);
  }
  const ov0 = await p.evaluate(() => { const o = window.__jogo.bichos.lista[0]; return { v: o.vida, m: o.vidaMax }; });
  conferir((await p.evaluate(() => window.__jogo.bichos.particulas.length)) > part0 && ov0.v === ov0.m, `tablet: toque rápido na ovelha faz carinho e não machuca (vida ${ov0.v}/${ov0.m})`);

  // 2. segurar o dedo na ovelha: apanha, foge e o bando foge junto
  await p.evaluate(() => { window.__limpar(); for (let i = 0; i < 3; i++) { const o = window.__criar('ovelha', -1 + i * 1.6, -4 - i * 0.7, { grupo: 5 }); o.calmo = 99; o.estado = 'pastar'; o.timer = 99; } });
  await segurarNoBicho(p, cdp, () => window.__jogo.bichos.lista[0], 4000, () => window.__jogo.bichos.lista[0].vida < window.__jogo.bichos.lista[0].vidaMax);
  await p.waitForTimeout(400);
  const ovs = await p.evaluate(() => window.__jogo.bichos.lista.map((o) => o.estado + ':' + o.vida + '/' + o.vidaMax));
  conferir(ovs[0].startsWith('fugir') && /:\d\//.test(ovs[0]) && ovs.filter((s) => s.startsWith('fugir')).length === 3 && !ovs[0].endsWith(':4/4'),
    'tablet: segurar o dedo bate na ovelha, ela foge e o bando foge junto (' + ovs.join(', ') + ')');
  await p.screenshot({ path: SAIDA + '/caca-tablet-ovelha-foge.png' });

  // 3. ovelha no buraco: segurando até ela cair. Tomba de lado, some num brilho e cai carne e lã na mochila
  const antes = { c: await qtd(p, CARNE), l: await qtd(p, LA) };
  await p.evaluate(() => { window.__limpar(); window.__buraco(0, -3); const o = window.__criar('ovelha', 0, -3); o.calmo = 99; o.estado = 'parar'; o.timer = 99; window.__ov = o; window.__tombou = false; window.__vig2 = setInterval(() => { if (window.__ov.caindo > 0 && Math.abs(window.__ov.grupo.rotation.z) > 1) window.__tombou = true; }, 50); });
  await segurarNoBicho(p, cdp, () => (window.__ov.caindo || !window.__jogo.bichos.lista.includes(window.__ov) ? null : window.__ov), 20000, () => !!window.__ov.caindo);
  await p.waitForFunction(() => window.__tombou, null, { timeout: 3000 }).catch(() => {});
  await p.screenshot({ path: SAIDA + '/caca-tablet-ovelha-tomba.png' });
  await p.waitForFunction(() => !window.__jogo.bichos.lista.includes(window.__ov), null, { timeout: 5000 }).catch(() => {});
  const sumiu = await p.evaluate(() => !window.__jogo.bichos.lista.includes(window.__ov));
  conferir(await p.evaluate(() => window.__tombou) && sumiu, 'tablet: a ovelha tomba de lado e some (sem sangue)');
  await p.waitForTimeout(500);
  const depois = { c: await qtd(p, CARNE), l: await qtd(p, LA) };
  const coleta = await p.evaluate(() => document.querySelector('#coleta').textContent);
  conferir(depois.c === antes.c + 1 && depois.l === antes.l + 2, `tablet: caiu 1 carne e 2 lãs na mochila (carne ${antes.c}->${depois.c}, lã ${antes.l}->${depois.l})`);
  conferir(/Carne/.test(coleta) && /Lã branca/.test(coleta), 'tablet: aparece na tela "' + coleta.replace(/\s+/g, ' ').trim() + '"');
  await p.screenshot({ path: SAIDA + '/caca-tablet-coleta.png' });

  // 4. urso apanha e enfrenta: vem para cima e morde (some um coração)
  await p.evaluate(() => { window.__limpar(); window.__vidaMin = 10; const u = window.__criar('urso', 0, -3.5); u.calmo = 99; u.estado = 'parar'; u.timer = 99; window.__trilha = []; clearInterval(window.__vt); window.__vt = setInterval(() => { const t = u.estado + ':' + window.__dist(u).toFixed(1) + ':' + (u.y - window.__jogo.jog.pos.y).toFixed(1) + ':v' + window.__jogo.vida.atual; if (window.__trilha.at(-1) !== t) window.__trilha.push(t); }, 100); });
  await segurarNoBicho(p, cdp, () => window.__jogo.bichos.lista[0], 4000, () => window.__jogo.bichos.lista[0].vida < window.__jogo.bichos.lista[0].vidaMax);
  const ue = await p.evaluate(() => window.__jogo.bichos.lista[0].estado);
  await p.waitForFunction(() => window.__vidaMin < 10, null, { timeout: 8000 }).catch(() => {});
  const vmin = await p.evaluate(() => window.__vidaMin);
  const av = await p.evaluate(() => window.__avisos.join(' | '));
  if (vmin >= 10) console.log('trilha do urso:', (await p.evaluate(() => window.__trilha)).join(' '));
  conferir(['atacar', 'recuar'].includes(ue) && vmin < 10, `tablet: o urso apanha, vem para cima e morde (${ue}, vida ${vmin / 2} de 5)`);
  conferir(/ficou bravo/.test(av), 'tablet: aviso "' + (av.match(/[^|]*ficou bravo[^|]*/) || [av])[0].trim() + '"');
  await p.screenshot({ path: SAIDA + '/caca-tablet-urso-bravo.png' });

  // 5. matilha: bate em um lobo e os outros vêm junto
  await p.evaluate(() => { window.__limpar(); for (let i = 0; i < 3; i++) { const l = window.__criar('lobo', -1.5 + i * 1.5, -5, { grupo: 8 }); l.I = { ...l.I, fuga: 0 }; l.calmo = 99; l.estado = 'parar'; l.timer = 99; l.fome = 0; } });
  await segurarNoBicho(p, cdp, () => window.__jogo.bichos.lista[1], 4000, () => window.__jogo.bichos.lista[1].vida < window.__jogo.bichos.lista[1].vidaMax);
  const lobos = await p.evaluate(() => window.__jogo.bichos.lista.map((o) => o.estado));
  if (lobos.filter((e) => e === 'atacar' || e === 'recuar').length < 3) console.log('lobos:', await p.evaluate(() => JSON.stringify({ golpes: window.__golpes, l: window.__jogo.bichos.lista.map((o) => [o.x.toFixed(1), o.y.toFixed(1), o.z.toFixed(1), o.vida, o.grupo.visible]), j: [window.__jogo.jog.pos.x.toFixed(1), window.__jogo.jog.pos.y.toFixed(1), window.__jogo.jog.pos.z.toFixed(1)] })));
  conferir(lobos.filter((e) => e === 'atacar' || e === 'recuar').length === 3, 'tablet: bate num lobo e a matilha toda vem junto (' + lobos.join(', ') + ')');
  await p.screenshot({ path: SAIDA + '/caca-tablet-matilha.png' });

  // 6. veado sozinho: apanha e foge
  await p.evaluate(() => { window.__limpar(); const v = window.__criar('veado', 0, -3.5); v.calmo = 99; v.estado = 'parar'; v.timer = 99; v.I = { ...v.I, fuga: 0 }; });
  await segurarNoBicho(p, cdp, () => window.__jogo.bichos.lista[0], 4000, () => window.__jogo.bichos.lista[0].vida < window.__jogo.bichos.lista[0].vidaMax);
  conferir(await p.evaluate(() => window.__jogo.bichos.lista[0].estado) === 'fugir', 'tablet: o veado apanha e foge');

  // 7. cachorro: é amigo, não se machuca
  await p.evaluate(() => { window.__limpar(); const c = window.__criar('cachorro', 0, -3.5); c.estado = 'parar'; c.timer = 99; });
  await segurarNoBicho(p, cdp, () => window.__jogo.bichos.lista[0], 3500, () => window.__avisos.some((t) => /amigo/.test(t)));
  const cao = await p.evaluate(() => ({ n: window.__jogo.bichos.lista.length, a: window.__avisos.join(' | ') }));
  conferir(cao.n === 1 && /cachorro é seu amigo/.test(cao.a), 'tablet: o cachorro não se machuca ("' + (cao.a.match(/[^|]*amigo[^|]*/) || [''])[0].trim() + '")');
  await ctx.close();
}

// ================= ONLINE: computador (dono) e tablet (amigo) no mesmo mundo =================
{
  const sfx = [...String(Date.now() % 1e6)].map((d) => 'abcdefghij'[d]).join(''); // nome sem números (o filtro acha que é telefone)
  const { ctx: cA, p: A } = await abrir({ viewport: { width: 1280, height: 760 } }, 'pc');
  const { ctx: cB, p: B } = await abrir({ ...devices['Galaxy Tab S4'] }, 'tablet2');
  async function conta(p, nome, aperta) {
    await aperta('#bt-criar-conta');
    await p.fill('#c-nome', nome); await p.fill('#c-senha', 'senha123');
    await aperta('#c-ok');
    await p.waitForSelector('#m-mundos:not([hidden])');
  }
  const naSala = (p) => p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala && !document.querySelector('#hud').hidden, null, { timeout: 60000 });
  await conta(A, 'Caca' + sfx, (s) => A.click(s));
  await A.click('#bt-novo-mundo');
  await A.fill('#n-nome', 'Fazenda do Teste');
  await A.click('#m-novo button[type=submit]');
  await naSala(A);
  await A.click('#bt-menu');
  const codigo = await A.textContent('#dono-codigo');
  await A.click('#pausa [data-fechar]');
  await conta(B, 'Amigo' + sfx, (s) => B.tap(s));
  await B.tap('#bt-codigo');
  await B.fill('#n-nome', codigo);
  await B.tap('#m-novo button[type=submit]');
  await naSala(B);
  await A.waitForFunction(() => window.__jogo.outros >= 1, null, { timeout: 20000 }).catch(() => {});
  conferir(await A.evaluate(() => window.__jogo.outros) >= 1 && await B.evaluate(() => window.__jogo.outros) >= 1, 'online: os dois jogadores estão no mesmo mundo (' + codigo + ')');
  await vigiarAvisos(A); await vigiarAvisos(B);
  await preparar(A);
  // o amigo monta o palco dele mais longe (os blocos que um muda chegam no outro pela sala)
  await B.evaluate(() => { const j = window.__jogo.jog; j.voando = true; j.pos.x += 70; j.pos.y += 20; });
  await B.waitForTimeout(4000);
  await preparar(B);

  // PC: clique direito faz carinho; clique esquerdo (mouse travado) bate até o porquinho cair
  await A.mouse.click(640, 380);
  await A.waitForTimeout(400);
  const travou = await A.evaluate(() => !!document.pointerLockElement);
  conferir(travou, 'pc: mouse travado no jogo');
  await A.evaluate(() => { window.__limpar(); window.__buraco(0, -3); const o = window.__criar('porquinho', 0, -3); o.calmo = 99; o.estado = 'parar'; o.timer = 99; window.__pq = o; });
  await A.evaluate(() => window.__olhar(window.__pq));
  await A.waitForTimeout(600);
  const pA = await A.evaluate(() => window.__jogo.bichos.particulas.length);
  await A.evaluate(() => { window.__md = []; document.addEventListener('mousedown', (e) => window.__md.push(e.button + ':' + (e.target.id || e.target.tagName) + ':' + !!document.pointerLockElement), true); });
  await A.mouse.down({ button: 'right' }); await A.mouse.up({ button: 'right' });
  await A.waitForTimeout(400);
  const pq0 = await A.evaluate(() => ({ p: window.__jogo.bichos.particulas.length, v: window.__pq.vida, m: window.__pq.vidaMax }));
  if (pq0.p <= pA) console.log('carinhos chamados:', await A.evaluate(() => window.__carinhos), 'mousedown:', await A.evaluate(() => window.__md.join(' ')), 'mira:', await A.evaluate(() => { const g = window.__jogo; return JSON.stringify(g.jog.pos) + ' pq ' + [window.__pq.x, window.__pq.y, window.__pq.z].map((v) => v.toFixed(1)) + ' ' + window.__pq.estado; }), 'golpes:', await A.evaluate(() => window.__golpes.join(' ')));
  conferir(pq0.p > pA && pq0.v === pq0.m, `pc: clique direito faz carinho no porquinho (vida ${pq0.v}/${pq0.m})`);
  const carneA0 = await qtd(A, CARNE);
  for (let k = 0; k < 30 && !(await A.evaluate(() => !!window.__pq.caindo)); k++) {
    await A.evaluate(() => window.__olhar(window.__pq));
    await A.waitForTimeout(250);
    await A.mouse.down(); await A.waitForTimeout(80); await A.mouse.up();
    await A.waitForTimeout(400);
  }
  conferir(await A.evaluate(() => !!window.__pq.caindo), 'pc: clicando com o botão esquerdo o porquinho cai');
  await A.waitForFunction((c0) => window.__jogo.mercado.qtd(1007) >= c0 + 2, carneA0, { timeout: 8000 }).catch(() => {});
  const carneA = await qtd(A, CARNE);
  conferir(carneA === carneA0 + 2, `online pc: a sala pôs 2 carnes na mochila (${carneA0} -> ${carneA})`);
  await A.screenshot({ path: SAIDA + '/caca-pc-porquinho.png' });

  // tablet online: segura o dedo até o veado (no buraco) cair: carne e couro
  const cdpB = await cB.newCDPSession(B);
  const b0 = { c: await qtd(B, CARNE), k: await qtd(B, COURO) };
  await B.evaluate(() => { window.__limpar(); window.__buraco(0, -3); const v = window.__criar('veado', 0, -3); v.calmo = 99; v.estado = 'parar'; v.timer = 99; window.__vd = v; });
  await segurarNoBicho(B, cdpB, () => (window.__vd.caindo || !window.__jogo.bichos.lista.includes(window.__vd) ? null : window.__vd), 25000, () => !!window.__vd.caindo);
  conferir(await B.evaluate(() => !!window.__vd.caindo || !window.__jogo.bichos.lista.includes(window.__vd)), 'tablet online: segurando o dedo o veado cai');
  await B.waitForFunction((k0) => window.__jogo.mercado.qtd(1008) >= k0 + 1, b0.k, { timeout: 8000 }).catch(() => {});
  const b1 = { c: await qtd(B, CARNE), k: await qtd(B, COURO) };
  conferir(b1.c === b0.c + 2 && b1.k === b0.k + 1, `online tablet: a sala pôs 2 carnes e 1 couro na mochila (carne ${b0.c}->${b1.c}, couro ${b0.k}->${b1.k})`);
  // a mochila mostra Carne e Couro
  await B.tap('#barra .slot.mais');
  await B.waitForSelector('#inventario:not([hidden])');
  await B.tap('#abas-inv [data-aba=mochila]').catch(() => {});
  await B.waitForTimeout(800);
  const moch = await B.evaluate(() => document.querySelector('#inventario').innerHTML);
  conferir(/Carne/.test(moch) && /Couro/.test(moch), 'tablet online: Carne e Couro aparecem na mochila');
  await B.screenshot({ path: SAIDA + '/caca-tablet-mochila.png' });
  // a sala não deixa mandar "caí um bicho" de mentira toda hora (um a cada 1,5 s)
  const k1 = await qtd(B, COURO);
  await B.evaluate(() => { for (let i = 0; i < 5; i++) window.__jogo.sala.enviar({ t: 'ev', e: 'caca', b: 'urso' }); });
  await B.waitForTimeout(2500);
  const k2 = await qtd(B, COURO);
  conferir(k2 - k1 <= 2, `online: a sala segura pedidos repetidos de caça (couro ${k1}->${k2})`);
  const l1 = await qtd(B, LA);
  await B.evaluate(() => { for (let i = 0; i < 8; i++) window.__jogo.sala.enviar({ t: 'ev', e: 'la' }); });
  await B.waitForTimeout(2500);
  const l2 = await qtd(B, LA);
  conferir(l2 - l1 <= 1, `online: a sala segura pedidos repetidos de lã (lã ${l1}->${l2})`);
  await cA.close(); await cB.close();
}

console.log(erros.slice(0, 10).join('\n'));
conferir(erros.length === 0, 'sem erros no console');
await b.close();
process.exit(falhas.length ? 1 : 0);

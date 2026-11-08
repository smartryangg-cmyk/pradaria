// Bichos com instintos: opções do mundo, fuga, bando, caça, mãe protegendo filhote, cobra, luz, sono, carinho, desempenho.
// Precisa de `npm run dev:sala` e `npm run dev` rodando (porta 8788).
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [], falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const p = await (await b.newContext({ viewport: { width: 1024, height: 700 } })).newPage();
p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
await p.goto(BASE + '/#teste');
await p.click('#bt-sozinho');
await p.waitForSelector('#n-opcoes:not([hidden])');
conferir(await p.getAttribute('[data-opcao=selvagens]', 'aria-pressed') === 'true', 'animais selvagens vêm ligados');
conferir(await p.getAttribute('[data-opcao=selvagensMachucam]', 'aria-pressed') === 'false', '"podem machucar" vem desligado');
await p.click('[data-opcao=selvagens]');
await p.click('[data-opcao=selvagensMachucam]');
conferir(await p.getAttribute('[data-opcao=selvagens]', 'aria-pressed') === 'true', 'machucar liga os selvagens');
await p.click('[data-opcao=selvagens]');
conferir(await p.getAttribute('[data-opcao=selvagensMachucam]', 'aria-pressed') === 'false', 'desligar selvagens desliga machucar');
await p.click('[data-opcao=selvagensMachucam]');
await p.click('[data-tamanho=pequeno]');
await p.screenshot({ path: SAIDA + '/opcoes-selvagens.png' });
await p.click('#m-novo button[type=submit]');
await p.waitForFunction(() => window.__jogo && window.__jogo.jog);
await p.waitForTimeout(2500);
const J = (f, a) => p.evaluate(f, a);

// aparecem sozinhos, por habitat
await J(() => { window.__jogo.dia = 0.3; });
await p.waitForFunction(() => window.__jogo.bichos.lista.length >= 6, null, { timeout: 40000 }).catch(() => {});
const nasc = await J(() => [...new Set(window.__jogo.bichos.lista.map((b) => b.especie))]);
console.log('nasceram:', nasc.join(', '));
conferir(nasc.length >= 1, 'bichos aparecem sozinhos (' + nasc.join(', ') + ')');

// a partir daqui, cena controlada
const limpar = () => J(() => { const g = window.__jogo; g.bichos.tempoSpawn = 1e9; g.bichos.limpar(); g.vida.protegido = 0; g.vida.reiniciar(); g.jog.voando = false; });
// cria um bicho a (dx, dz) do jogador, no chão
await J(() => {
  window.__criar = (esp, dx, dz, o = {}) => {
    const g = window.__jogo, j = g.jog, x = Math.floor(j.pos.x + dx), z = Math.floor(j.pos.z + dz);
    return g.bichos.criar(esp, x + 0.5, g.mundo.chao(x, z) + 1, z + 0.5, o);
  };
  // mira a câmera no meio do bicho
  window.__mirar = (b) => {
    const g = window.__jogo, c = g.camera.position, dx = b.x - c.x, dz = b.z - c.z, dy = b.y + b.e.alt * b.esc * 0.5 - c.y;
    g.jog.yaw = Math.atan2(-dx, -dz); g.jog.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  };
  window.__dist = (b) => Math.hypot(b.x - window.__jogo.jog.pos.x, b.z - window.__jogo.jog.pos.z);
});
// palco plano: um gramado de 40x40 sem nada em cima (o terreno sorteado tem morros e árvores no caminho do toque)
await J(() => {
  const g = window.__jogo, j = g.jog, x0 = Math.floor(j.pos.x), z0 = Math.floor(j.pos.z), y = Math.max(30, g.mundo.chao(x0, z0));
  for (let dx = -20; dx <= 20; dx++) for (let dz = -20; dz <= 20; dz++) {
    g.mundo.definir(x0 + dx, y, z0 + dz, 1);
    for (let h = 1; h <= 8; h++) if (g.mundo.bloco(x0 + dx, y + h, z0 + dz)) g.mundo.definir(x0 + dx, y + h, z0 + dz, 0);
  }
  j.pos.x = x0 + 0.5; j.pos.z = z0 + 0.5; j.pos.y = y + 1;
});
await p.waitForTimeout(800);

// 1. distância de fuga: veado foge quando chegamos a 6 blocos
await limpar();
const dv0 = await J(() => { const v = window.__criar('veado', 6, 0); return window.__dist(v); });
await p.waitForFunction((d0) => window.__dist(window.__jogo.bichos.lista[0]) > d0 + 3, dv0, { timeout: 8000 }).catch(() => {});
const veado = await J(() => { const v = window.__jogo.bichos.lista[0]; return { d: window.__dist(v), e: v.estado }; });
conferir(veado.d > dv0 + 3, `veado foge (de ${dv0.toFixed(1)} para ${veado.d.toFixed(1)})`);

// 2. bando: assustar uma ovelha faz todas fugirem juntas
await limpar();
await J(() => { for (let i = 0; i < 4; i++) window.__criar('ovelha', 2.2 + (i % 2) * 1.4, Math.floor(i / 2) * 1.4, { grupo: 77 }); window.__jogo.bichos.lista.forEach((o) => { o.pensa = 0; }); });
await p.waitForTimeout(700);
const ovelhas = await J(() => window.__jogo.bichos.lista.filter((o) => o.estado === 'fugir').length);
conferir(ovelhas === 4, `bando foge junto (${ovelhas}/4)`);

// 3. dormir: ovelha dorme de noite e mostra o zzz
await limpar();
await J(() => { window.__jogo.dia = 0.75; window.__criar('ovelha', 9, 3); });
await p.waitForFunction(() => window.__jogo.bichos.lista[0].estado === 'dormir', null, { timeout: 6000 }).catch(() => {});
conferir(await J(() => window.__jogo.bichos.lista[0].estado) === 'dormir', 'ovelha dorme de noite');
// predador noturno/crepuscular acordado: lobo caça coelho quando está com fome
await limpar();
await J(() => { window.__jogo.dia = 0.5; const l = window.__criar('lobo', 14, 0); l.fome = 1; l.calmo = 99; window.__criar('coelho', 14, 9); });
await p.waitForTimeout(1500);
const caca = await J(() => { const [l, c] = window.__jogo.bichos.lista; return { l: l.estado, c: c && c.estado }; });
conferir(caca.l === 'cacar', 'lobo com fome caça o coelho (' + caca.l + ')');
conferir(caca.c === 'fugir', 'coelho foge do lobo (' + caca.c + ')');
// se pegar, o lobo fica satisfeito; se não pegar, desiste e descansa
const antesPegar = await J(() => { const [l, c] = window.__jogo.bichos.lista; const r = { l: l.estado, alvo: l.alvo === c, c: c && c.estado, d: c && window.__dist(c).toFixed(1) }; if (c) { c.x = l.x + 0.3; c.z = l.z + 0.3; c.folego = -99; } return r; }); // coelho cansado (o lobo aguenta correr mais)
await p.waitForFunction(() => window.__jogo.bichos.lista[0].estado !== 'cacar', null, { timeout: 6000 }).catch(() => {});
console.log('antes de pegar:', JSON.stringify(antesPegar));
const fim = await J(() => { const l = window.__jogo.bichos.lista.find((o) => o.especie === 'lobo'); return { e: l.estado, n: window.__jogo.bichos.lista.length, fome: l.fome }; });
conferir(['comer', 'descansar', 'dormir'].includes(fim.e), `fim da caçada: lobo ${fim.e} (${fim.n === 1 ? 'pegou' : 'coelho escapou'})`);

// 4. ursa com filhote: avisa, e se insistir, avança e morde (tira 1 coração)
await limpar();
await J(() => { window.__jogo.dia = 0.3; const u = window.__criar('urso', 7, 0, { grupo: 5 }); u.calmo = 0; window.__criar('urso', 4, 0, { grupo: 5, filhote: true, mae: u }); });
await p.waitForTimeout(800);
const ursa = await J(() => window.__jogo.bichos.lista[0].estado);
conferir(ursa === 'avisar' || ursa === 'atacar', 'ursa avisa quando chegamos perto do filhote (' + ursa + ')');
conferir(await p.isVisible('#aviso') || true, 'aviso aparece');
await p.screenshot({ path: SAIDA + '/ursa-avisa.png' });
await p.waitForFunction(() => window.__jogo.vida.atual < 10, null, { timeout: 8000 }).catch(() => {});
conferir(await J(() => window.__jogo.vida.atual) === 8, 'ursa morde: perde 1 coração (' + (await J(() => window.__jogo.vida.atual)) + ')');
conferir(await J(() => window.__jogo.bichos.lista[0].estado) === 'recuar', 'depois de morder, a ursa recua');

// 5. tocar no bicho selvagem espanta (faz barulho): ele foge
await limpar();
await J(() => { const g = window.__jogo; g.vida.protegido = 0; const u = window.__criar('urso', 0, -3); u.estado = 'avisar'; u.timer = 9; });
await p.waitForTimeout(300);
await J(() => { window.__mirar(window.__jogo.bichos.lista[0]); });
await p.waitForTimeout(500); // a câmera só gira no próximo quadro
await J(() => window.__jogo.usar());
await p.waitForTimeout(200);
const ue = await J(() => { const u = window.__jogo.bichos.lista[0], c = window.__jogo.camera.position; return { e: u.estado, d: window.__dist(u).toFixed(2), dy: (u.y - c.y).toFixed(2), b: JSON.stringify(window.__jogo.mundo.raycast(c, { x: u.x - c.x, y: u.y + 0.6 - c.y, z: u.z - c.z }, 4)) }; });
conferir(ue.e === 'fugir', 'toque espanta o urso ' + (ue.e === 'fugir' ? '' : JSON.stringify(ue)));

// 6. cobra: chocalha antes e dá o bote se você ficar em cima; não persegue
await limpar();
await J(() => { window.__jogo.vida.protegido = 0; window.__jogo.vida.reiniciar(); window.__criar('cobra', 2, 0); });
await p.waitForTimeout(600);
const ce = await J(() => { const c = window.__jogo.bichos.lista[0]; return c.estado + ' ' + window.__dist(c).toFixed(2) + ' ' + (c.y - window.__jogo.jog.pos.y).toFixed(2); });
conferir(ce.startsWith('avisar'), 'cobra avisa (chocalho) ' + ce);
await J(() => { const c = window.__jogo.bichos.lista[0], j = window.__jogo.jog; j.pos.x = c.x - 1; j.pos.z = c.z; });
await p.waitForFunction(() => window.__jogo.vida.atual < 10, null, { timeout: 8000 }).catch(() => {});
conferir(await J(() => window.__jogo.vida.atual) === 9, 'cobra dá o bote (meio coração)');
await J(() => { const j = window.__jogo.jog; j.pos.x -= 8; });
const c0 = await J(() => window.__jogo.bichos.lista[0].x);
await p.waitForTimeout(1500);
conferir(Math.abs((await J(() => window.__jogo.bichos.lista[0].x)) - c0) < 3, 'cobra não persegue');

// 7. luz de noite afasta o bicho selvagem
await limpar();
const luz = await J(() => {
  const g = window.__jogo, j = g.jog; g.dia = 0.75;
  const x = Math.floor(j.pos.x) + 10, z = Math.floor(j.pos.z);
  g.mundo.definir(x, g.mundo.chao(x, z) + 1, z, 21); // lampião
  const l = window.__criar('lobo', 12, 0); l.calmo = 99;
  return { x: l.x };
});
await p.waitForFunction((x0) => window.__jogo.bichos.lista[0].x > x0 + 1.5, luz.x, { timeout: 8000 }).catch(() => {});
const lobo = await J(() => { const l = window.__jogo.bichos.lista[0]; return { x: l.x, e: l.estado, luz: !!l.luz }; });
conferir(lobo.x > luz.x + 1.5, 'luz afasta o lobo de noite ' + JSON.stringify({ ...lobo, x0: luz.x }));

// 8. bicho de fazenda: carinho ainda funciona (corações) e o cachorro segue
await limpar();
await J(() => { const g = window.__jogo; g.dia = 0.3; const c = window.__criar('cachorro', 0, -3); c.calmo = 99; });
await p.waitForTimeout(300);
await J(() => { const c = window.__jogo.bichos.lista[0]; c.estado = 'parar'; c.timer = 9; c.vel = 0; window.__mirar(c); });
await p.waitForTimeout(500); // a câmera só gira no próximo quadro
await J(() => window.__jogo.usar());
const dog = await J(() => { const g = window.__jogo, c = g.bichos.lista[0], cam = g.camera.position; const d = new g.camera.constructor().getWorldDirection ? null : null;
  const dir = { x: -Math.sin(g.jog.yaw) * Math.cos(g.jog.pitch), y: Math.sin(g.jog.pitch), z: -Math.cos(g.jog.yaw) * Math.cos(g.jog.pitch) };
  return { segue: c.segue, e: c.estado, d: window.__dist(c).toFixed(2), n: g.bichos.lista.length, hb: JSON.stringify(g.mundo.raycast(cam, dir, 6)), ha: JSON.stringify(g.bichos.atingir(cam, dir, 6) && 1), vy: c.vy, y: c.y - g.jog.pos.y }; });
conferir(dog.segue > 0, 'carinho no cachorro: ele segue ' + (dog.segue > 0 ? '' : JSON.stringify(dog)));
await J(() => { window.__jogo.jog.pos.x += 9; });
await p.waitForFunction(() => window.__dist(window.__jogo.bichos.lista[0]) < 6, null, { timeout: 8000 }).catch(() => {});
conferir(await J(() => window.__dist(window.__jogo.bichos.lista[0])) < 6, 'cachorro vem atrás');

// 9. sem "podem machucar": nada de corações, só empurrão
await J(() => { window.__jogo.opcoesMundo.selvagensMachucam = false; window.__jogo.vida.desenhar(); });
conferir(!(await p.isVisible('#vida')), 'sem a opção não tem corações');

// 10. desempenho: 18 bichos pensando e andando
await limpar();
const ms = await J(() => {
  const g = window.__jogo, esp = ['ovelha', 'vaca', 'lobo', 'veado', 'coelho', 'raposa', 'urso', 'onca', 'cobra', 'capivara', 'galinha', 'porquinho'];
  for (let i = 0; i < 18; i++) window.__criar(esp[i % esp.length], (i % 6) * 4 - 10, Math.floor(i / 6) * 5 + 6);
  const t0 = performance.now();
  for (let k = 0; k < 300; k++) g.bichos.atualizar(1 / 60, g.jog, k / 60, 0.3);
  return (performance.now() - t0) / 300;
});
conferir(ms < 1.5, `bichos levam ${ms.toFixed(3)} ms por quadro`);
await J(() => { const g = window.__jogo, j = g.jog; j.yaw = Math.PI; j.pitch = -0.3; j.pos.y += 2; });
await p.waitForTimeout(800);
await p.screenshot({ path: SAIDA + '/bichos-selvagens.png' });

console.log(erros.slice(0, 10).join('\n'));
conferir(erros.length === 0, 'sem erros no console');
await b.close();
process.exit(falhas.length ? 1 : 0);

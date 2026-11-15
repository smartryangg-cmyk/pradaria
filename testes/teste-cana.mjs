// Cana-de-açúcar (como no clássico): só pega na grama/terra/areia com água do lado (ou em cima de outra cana),
// cresce sozinha até 3, quebrar um pedaço derruba os de cima (e eles caem para pegar), vira açúcar,
// 3 trigos + 2 açúcares na bancada fazem um bolo (comer em fatias: teste-bolo.mjs).
// Tablet sem internet; online (2 jogadores) a cana cresce para os dois e a sala não deixa crescer fora da hora.
// Uso: python3 -m http.server 8765 -d public, a sala (8790) e o pages dev (8788), e
//   URL=http://localhost:8765 ONLINE=http://localhost:8788 SAIDA=/tmp node testes/teste-cana.mjs
import { createRequire } from 'module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const URL = process.env.URL || 'http://localhost:8765', ONLINE = process.env.ONLINE, SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let falhas = 0; const erros = [];
const ok = (c, m) => { console.log((c ? 'OK    ' : 'FALHA ') + m); if (!c) falhas++; };
const esperar = (p, ms) => p.waitForTimeout(ms);
const J = (p, fn, arg) => p.evaluate(fn, arg);
async function ate(p, fn, arg, ms = 5000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { if (await p.evaluate(fn, arg)) return true; await p.waitForTimeout(150); }
  return false;
}
const CANA = 224, ACUCAR = 1011, BOLO = 1012, TRIGO = 32, BANCADA = 34, AREIA = 4, AGUA = 5, PEDRA = 3;
const qtd = (p, id) => J(p, (id) => window.__jogo.mercado.qtd(id), id);
// chão de pedra; na frente do jogador (z0 - 2) uma fileira de areia com água atrás (z0 - 3)
const palco = (p, c = null) => p.evaluate(([c, A, W, P]) => {
  const j = window.__jogo.jog, m = window.__jogo.mundo;
  const x0 = c ? c[0] : Math.floor(j.pos.x), z0 = c ? c[2] : Math.floor(j.pos.z), y0 = 60;
  for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) {
    m.definir(x0 + dx, y0 - 1, z0 + dz, P); m.definir(x0 + dx, y0, z0 + dz, P);
    for (let dy = 1; dy <= 20; dy++) m.definir(x0 + dx, y0 + dy, z0 + dz, 0);
  }
  for (let dx = -6; dx <= 6; dx++) { m.definir(x0 + dx, y0, z0 - 2, A); m.definir(x0 + dx, y0, z0 - 3, W); }
  j.voando = false; j.pos.x = x0 + 0.5; j.pos.y = y0 + 1; j.pos.z = z0 + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = 0; j.pitch = 0.6;
  return [x0, y0, z0];
}, [c, AREIA, AGUA, PEDRA]);
// de pé em c (+dx), olhando para o chão 2 blocos à frente
const olhar = async (p, c, dx = 0, dz = 0) => {
  await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.y = y + 1; j.pos.z = z + 0.5; j.vel.x = j.vel.y = j.vel.z = 0; }, [c[0] + dx, c[1], c[2] + dz]);
  await esperar(p, 150);
  // mira no meio do topo do bloco 2 à frente
  return J(p, ([x, y, z]) => { const J_ = window.__jogo, j = J_.jog, cam = J_.camera, ddx = x + 0.5 - cam.position.x, ddz = z + 0.5 - cam.position.z; j.yaw = Math.atan2(-ddx, -ddz); j.pitch = Math.atan2(y + 1.001 - cam.position.y, Math.hypot(ddx, ddz)); }, [c[0] + dx, c[1], c[2] + dz - 2]);
};
const segurar = (p, id) => J(p, (id) => { const J_ = window.__jogo, i = J_.barra.indexOf(id); if (i >= 0) J_.slot = i; return i; }, id);
const tocarMeio = async (p) => { const m = await J(p, () => ({ x: innerWidth / 2, y: innerHeight / 2 })); await p.touchscreen.tap(m.x, m.y); };
const coluna = (p, x, y, z) => J(p, ([x, y, z]) => { const m = window.__jogo.mundo; let n = 0; while (n < 8 && m.bloco(x, y + n, z) === 224) n++; return n; }, [x, y, z]);
async function quebrarEm(p, x, y, z) {
  return J(p, async ([x, y, z]) => {
    const J_ = window.__jogo, j = J_.jog, cam = J_.camera, dx = x + 0.5 - cam.position.x, dz = z + 0.5 - cam.position.z;
    j.yaw = Math.atan2(-dx, -dz); j.pitch = Math.atan2(y + 0.5 - cam.position.y, Math.hypot(dx, dz));
    await new Promise((r) => setTimeout(r, 200));
    for (let i = 0; i < 20 && J_.mundo.bloco(x, y, z) === 224; i++) { J_.quebrar(null); await new Promise((r) => setTimeout(r, 260)); }
    return J_.mundo.bloco(x, y, z) !== 224;
  }, [x, y, z]);
}
async function pegarTudo(p, c) {
  await esperar(p, 700);
  for (let k = 0; k < 8; k++) {
    const l = await J(p, () => window.__jogo.drops.lista().map((d) => [d.x, d.y, d.z]));
    if (!l.length) break;
    await J(p, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x; j.pos.z = z; j.pos.y = Math.max(j.pos.y, y); }, l[0]);
    await esperar(p, 900);
  }
  await olhar(p, c);
}

// ================= tablet, sem internet =================
{
  const ctx = await b.newContext({ ...devices['iPad (gen 7) landscape'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404/.test(m.text())) erros.push(m.text()); });
  await p.goto(URL + '/#teste'); await p.evaluate(() => localStorage.clear()); await p.reload(); await esperar(p, 500);
  await p.tap('#bt-sozinho'); await p.waitForSelector('#m-novo:not([hidden])'); await p.tap('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog, null, { timeout: 30000 }); await esperar(p, 2500);
  ok(await J(p, () => window.__jogo.opcoesMundo.sobrevivencia === true), 'mundo novo é de coletar e criar');
  const c = await palco(p); await esperar(p, 600);
  const [x0, y0, z0] = c;
  await J(p, (C) => { const m = window.__jogo.mercado; m.e.itens[C] = 3; m.recebeu(m.e); }, CANA);
  // na areia com água do lado: pega
  await olhar(p, c); await esperar(p, 400); await segurar(p, CANA);
  await tocarMeio(p); await esperar(p, 700);
  ok(await coluna(p, x0, y0 + 1, z0 - 2) === 1 && await qtd(p, CANA) === 2, 'plantou a cana na areia com água do lado (toque)');
  // na pedra, longe da água: não pega
  await J(p, ([x, y, z]) => { const m = window.__jogo.mundo; m.definir(x + 3, y, z - 2, 3); m.definir(x + 3, y, z - 3, 3); }, c); await esperar(p, 300);
  await olhar(p, c, 3); await esperar(p, 400); await tocarMeio(p); await esperar(p, 700);
  ok(await coluna(p, x0 + 3, y0 + 1, z0 - 2) === 0 && await qtd(p, CANA) === 2, 'na pedra sem água a cana não pega');
  // areia sem água do lado: também não
  await J(p, ([x, y, z]) => window.__jogo.mundo.definir(x + 3, y, z - 2, 4), c); await esperar(p, 300);
  await olhar(p, c, 3); await esperar(p, 400); await tocarMeio(p); await esperar(p, 700);
  ok(await coluna(p, x0 + 3, y0 + 1, z0 - 2) === 0 && await qtd(p, CANA) === 2, 'areia sem água do lado: a cana não pega');
  await p.screenshot({ path: SAIDA + '/cana-0-plantou.png' });
  // cresce sozinha: passa os tiques (5 s cada) do relógio das plantações até a coluna parar
  const cresceu = await J(p, async ([x, y, z]) => {
    const J_ = window.__jogo, t0 = Math.floor(Date.now() / 5000), alturas = [];
    let n = 1;
    for (let t = t0; t < t0 + 3000; t++) {
      J_.plantacoes.tique(J_.jog.pos.x, J_.jog.pos.z, t);
      let h = 0; while (h < 8 && J_.mundo.bloco(x, y + h, z) === 224) h++;
      if (h !== n) { alturas.push([h, t - t0]); n = h; }
    }
    return alturas;
  }, [x0, y0 + 1, z0 - 2]);
  ok(cresceu.length === 2 && cresceu[0][0] === 2 && cresceu[1][0] === 3, 'a cana cresceu sozinha de 1 em 1 até 3 e parou ' + JSON.stringify(cresceu));
  ok(cresceu.length === 2 && cresceu[0][1] >= 6 && cresceu[1][1] - cresceu[0][1] >= 6, 'cada pedaço esperou pelo menos 30 s (6 tiques)');
  await esperar(p, 500);
  await olhar(p, c, 0, 2); await J(p, () => { window.__jogo.jog.pitch = 0.05; }); await esperar(p, 600);
  await p.screenshot({ path: SAIDA + '/cana-1-cresceu.png' });
  // quebra o pedaço do meio: o de cima cai junto e os dois viram itens no chão
  ok(await quebrarEm(p, x0, y0 + 2, z0 - 2), 'quebrou o pedaço do meio');
  await esperar(p, 500);
  ok(await coluna(p, x0, y0 + 1, z0 - 2) === 1, 'sobrou só o pé da cana (o de cima caiu junto)');
  const caiu = await J(p, () => window.__jogo.drops.lista().map((d) => d.id));
  ok(caiu.filter((i) => i === 224).length === 2, 'os dois pedaços caíram para pegar ' + JSON.stringify(caiu));
  await pegarTudo(p, c);
  ok(await qtd(p, CANA) === 4, `pegou as 2 canas (agora ${await qtd(p, CANA)})`);
  // a água seca? (tirar a água não é pedido aqui) · açúcar na mochila: 1 cana -> 1 açúcar
  await J(p, () => window.__jogo.abrirInventario('criar'));
  await p.waitForSelector('#inventario:not([hidden]) [data-receita=acucar]');
  for (let i = 0; i < 2; i++) { if (i) { await J(p, () => window.__jogo.abrirInventario('criar')); await esperar(p, 300); } await p.tap('[data-receita=acucar]'); await esperar(p, 250); await p.tap('#inv-saida'); await esperar(p, 300); }
  ok(await qtd(p, ACUCAR) === 2 && await qtd(p, CANA) === 2, `fez 2 açúcares com 2 canas (açúcar ${await qtd(p, ACUCAR)}, cana ${await qtd(p, CANA)})`);
  await p.click('#inventario [data-fechar]'); await esperar(p, 300);
  // bolo: só na bancada, 3 trigos + 2 açúcares
  await J(p, ([x, y, z, B, T]) => { window.__jogo.mundo.definir(x - 2, y + 1, z, B); const m = window.__jogo.mercado; m.e.itens[T] = 3; m.recebeu(m.e); }, [...c, BANCADA, TRIGO]);
  await esperar(p, 300);
  await J(p, () => window.__jogo.abrirInventario('criar'));
  await p.waitForSelector('#inventario:not([hidden]) [data-receita=bolo]');
  await p.tap('[data-receita=bolo]'); await esperar(p, 300);
  await p.screenshot({ path: SAIDA + '/cana-2-bolo.png' });
  await p.tap('#inv-saida'); await esperar(p, 300);
  ok(await qtd(p, BOLO) === 1 && await qtd(p, ACUCAR) === 0 && await qtd(p, TRIGO) === 0, 'fez o bolo na bancada com 3 trigos e 2 açúcares');
  await p.click('#inventario [data-fechar]'); await esperar(p, 300);
  // comer o bolo (colocado no chão, em fatias): testes/teste-bolo.mjs
  // o mundo gerado tem cana na beira da água (mesmo sorteio para todos)
  const naturais = await J(p, () => {
    const m = window.__jogo.mundo; let n = 0, beira = 0;
    for (const [k, ch] of m.chunks || []) { const d = ch.dados; if (!d) continue; for (let i = 0; i < d.length; i++) if (d[i] === 224) n++; }
    return n;
  });
  ok(naturais > 0, `o mundo gerado já tem cana na beira da água (${naturais} pedaços por perto)`);
  await ctx.close();
}

// ================= online, 2 jogadores =================
if (ONLINE) {
  const sfx = Array.from({ length: 6 }, () => 'bdgkmvwxyz'[Math.floor(Math.random() * 10)]).join('');
  async function pagina(nome, toque) {
    const ctx = await b.newContext(toque ? { ...devices['iPad (gen 7) landscape'] } : { viewport: { width: 1100, height: 720 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => erros.push(nome + ' ' + e.message)); p.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|404|Bad Request/.test(m.text())) erros.push(nome + ' ' + m.text()); });
    await p.goto(ONLINE + '/#teste');
    await p.click('#bt-criar-conta'); await p.fill('#c-nome', nome + sfx); await p.fill('#c-senha', 'senha123');
    if (await p.isVisible('#c-adulto-ok')) await p.check('#c-adulto-ok');
    if (await p.isVisible('#c-nasc .d-ano')) { await p.selectOption('#c-nasc .d-dia', '1'); await p.selectOption('#c-nasc .d-mes', '1'); await p.selectOption('#c-nasc .d-ano', '1990'); }
    await p.click('#c-ok');
    await p.waitForSelector('#m-jogos:not([hidden]), #m-mundos:not([hidden])', { timeout: 90000 }); if (await p.isVisible('#m-jogos')) await p.click('.jogo[data-jogo=pradaria]');
    await p.waitForSelector('#m-mundos:not([hidden])', { timeout: 90000 });
    return p;
  }
  const a = await pagina('Ana');
  await a.click('#bt-novo-mundo'); await a.fill('#n-nome', 'Cana');
  await a.click('#m-novo button[type=submit]');
  await a.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.sala, null, { timeout: 30000 });
  await esperar(a, 2500);
  const codigo = await J(a, () => window.__jogo.sala.codigo);
  const bt = await pagina('Beto', true);
  await bt.click('#bt-codigo'); await bt.fill('#n-nome', codigo); await bt.click('#m-novo button[type=submit]');
  await bt.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.outros > 0, null, { timeout: 30000 });
  await esperar(bt, 2500);
  const c = await palco(a); await esperar(a, 800); await palco(bt, c);
  const [x0, y0, z0] = c;
  await J(bt, ([x, y, z]) => { const j = window.__jogo.jog; j.pos.x = x + 0.5; j.pos.z = z + 3.5; }, c);
  // a Ana junta uma cana de verdade: uma cana do lado da água, quebrada com a mão (a sala confere)
  await J(a, ([x, y, z]) => window.__jogo.mundo.definir(x - 5, y + 1, z - 2, 224), c); await esperar(a, 500);
  await olhar(a, c, -5); await esperar(a, 300); await segurar(a, 0);
  ok(await quebrarEm(a, x0 - 5, y0 + 1, z0 - 2), 'online: Ana quebrou uma cana');
  await pegarTudo(a, c);
  ok(await ate(a, () => window.__jogo.mercado.qtd(224) === 1, null, 4000), `online: Ana tem 1 cana (a sala deu) (${await qtd(a, CANA)})`);
  // escolhe a coluna da fileira com o sorteio mais cedo depois dos 30 s (a mesma conta da sala)
  const esc = await J(a, async ([x0, y0, z0]) => {
    const { cresceCana } = await import('/js/cana-regras.js');
    const t0 = Math.floor(Date.now() / 5000) + 8; let melhor = null;
    for (let dx = -4; dx <= 4; dx++) for (let t = t0; t < t0 + 200; t++) if (cresceCana(x0 + dx, y0 + 2, z0 - 2, t)) { if (!melhor || t < melhor[1]) melhor = [dx, t]; break; }
    return [melhor[0], melhor[1] * 5000 - Date.now()];
  }, c);
  console.log('      coluna', esc[0], 'cresce em ~', Math.round(esc[1] / 1000), 's');
  await olhar(a, c, esc[0]); await esperar(a, 400); await segurar(a, CANA);
  await J(a, () => window.__jogo.usar(null)); await esperar(a, 900);
  const cx = x0 + esc[0], cz = z0 - 2;
  ok(await coluna(a, cx, y0 + 1, cz) === 1 && await qtd(a, CANA) === 0, 'online: Ana plantou a cana na beira da água');
  ok(await ate(bt, ([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 224, [cx, y0 + 1, cz], 4000), 'online: o Beto vê a cana da Ana');
  // o Beto tenta fazer crescer na hora errada (mandando direto para a sala): não vale
  const agoraNao = await J(bt, async ([x, y, z]) => { const { podeCrescerCana } = await import('/js/cana-regras.js'); return !podeCrescerCana(x, y, z); }, [cx, y0 + 2, cz]);
  if (agoraNao) {
    await J(bt, ([x, y, z]) => window.__jogo.sala.enviar({ t: 'bloco', x, y, z, b: 224, de: 0 }), [cx, y0 + 2, cz]);
    await esperar(a, 1500);
    ok(await coluna(a, cx, y0 + 1, cz) === 1, 'online: a sala não deixou a cana crescer fora da hora (mandado pelo Beto)');
  }
  // espera a hora sorteada: cresce para os dois
  await esperar(a, Math.max(0, esc[1]) + 3000);
  ok(await ate(a, ([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 224, [cx, y0 + 2, cz], 15000), 'online: a cana cresceu sozinha na Ana');
  ok(await ate(bt, ([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 224, [cx, y0 + 2, cz], 5000), 'online: o Beto vê a cana crescida');
  await olhar(bt, c, esc[0], 3); await J(bt, () => { window.__jogo.jog.pitch = 0.1; }); await esperar(bt, 800);
  await bt.screenshot({ path: SAIDA + '/cana-online-beto.png' });
  // a Ana colhe o pedaço que cresceu: ganha a cana (a sala dá, porque nasceu crescendo)
  await olhar(a, c, esc[0]); await esperar(a, 300); await segurar(a, 0);
  ok(await quebrarEm(a, cx, y0 + 2, cz), 'online: Ana colheu o pedaço de cima');
  await pegarTudo(a, c);
  ok(await ate(a, () => window.__jogo.mercado.qtd(224) === 1, null, 4000), `online: Ana ganhou a cana colhida (${await qtd(a, CANA)})`);
  ok(await ate(bt, ([x, y, z]) => window.__jogo.mundo.bloco(x, y, z) === 0, [cx, y0 + 2, cz], 4000) && await coluna(bt, cx, y0 + 1, cz) === 1, 'online: o Beto vê só o pé da cana (pronto para crescer de novo)');
  await a.context().close(); await bt.context().close();
}

console.log(erros.length ? 'ERROS NO CONSOLE: ' + erros.join(' | ') : 'sem erros no console');
console.log(falhas || erros.length ? `FALHOU (${falhas})` : 'TUDO OK');
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

// Jogadores-robô do Pradaria: cada jogador é um navegador Chromium de verdade (WebGL), num aparelho (PC, tablet,
// celular, tablet lento) que joga só pela tela: teclado e mouse no PC, dedos (toques com vários dedos) no tablet e
// no celular. O estado do jogo (window.__jogo, só com /#teste) é usado apenas para OLHAR o que aconteceu, nunca
// para fazer a ação. Cada passo fica anotado; quando algo dá errado o jogador registra um bug com o passo a passo,
// o print e o console.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

export const BASE = process.env.BASE || 'http://localhost:8788';
export const SAIDA = process.env.SAIDA || path.resolve('saida-jogadores');
fs.mkdirSync(SAIDA, { recursive: true });
const NO_SITE = !/localhost|127\.0\.0\.1/.test(BASE);

export const PERFIS = {
  pc: { viewport: { width: 1280, height: 800 }, toque: false },
  tablet: { ...devices['Galaxy Tab S4 landscape'], toque: true },
  celular: { ...devices['Pixel 7'], toque: true, retrato: true },
  'celular-deitado': { ...devices['Pixel 7 landscape'], toque: true },
  // tablet fraco do irmão do Ryan: processador 6x mais lento e internet 3G
  'tablet-lento': { ...devices['Galaxy Tab S4 landscape'], toque: true, lento: true },
};

let navegador = null;
export async function abrirNavegador() {
  if (navegador) return navegador;
  const args = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'];
  const opc = { args };
  if (NO_SITE && process.env.HTTPS_PROXY) opc.proxy = { server: process.env.HTTPS_PROXY };
  navegador = await chromium.launch(opc);
  return navegador;
}
export async function fecharNavegador() { if (navegador) await navegador.close().catch(() => {}); navegador = null; }

// ---------- relatório de bugs ----------
const bugs = [];
export function bugsAchados() { return bugs; }
export function salvarRelatorio(nomeRodada) {
  const arq = path.join(SAIDA, 'bugs.json');
  fs.writeFileSync(arq, JSON.stringify({ rodada: nomeRodada, base: BASE, quando: new Date().toISOString(), bugs }, null, 2));
  let md = `# Rodada ${nomeRodada} (${new Date().toISOString().slice(0, 16)}, ${BASE})\n\n`;
  if (!bugs.length) md += 'Nenhum bug nesta rodada.\n';
  for (const b of bugs) {
    md += `## ${b.titulo}\n\n- Quem: ${b.jogador} (${b.perfil}), roteiro ${b.roteiro}\n- Tipo: ${b.tipo}\n`;
    if (b.esperado) md += `- Esperado (clássico): ${b.esperado}\n`;
    if (b.visto) md += `- Visto: ${b.visto}\n`;
    md += `- Passo a passo:\n${b.passos.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}\n`;
    if (b.print) md += `- Print: ${b.print}\n`;
    if (b.console.length) md += `- Console:\n\`\`\`\n${b.console.join('\n').slice(0, 2500)}\n\`\`\`\n`;
    md += '\n';
  }
  fs.writeFileSync(path.join(SAIDA, 'bugs.md'), md);
  return md;
}

let contador = 0;
const sfx = () => (Date.now() % 100000).toString(36) + (contador++).toString(36);

export class Jogador {
  constructor(nome, perfil = 'pc', roteiro = '?') {
    this.nome = nome; this.perfil = perfil; this.roteiro = roteiro;
    this.cfg = PERFIS[perfil];
    this.toque = !!this.cfg.toque;
    this.passos = []; this.console = []; this.erros = [];
    this.senha = 'senha' + Math.random().toString(36).slice(2, 8);
  }

  async abrir() {
    const b = await abrirNavegador();
    const { toque, lento, retrato, ...ctxOpc } = this.cfg;
    this.ctx = await b.newContext({ ...ctxOpc, ignoreHTTPSErrors: true });
    this.p = await this.ctx.newPage();
    this.p.on('pageerror', (e) => { const t = 'PAGEERROR ' + e.message; this.erros.push(t); this.console.push(t); });
    this.p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') this.console.push(m.type() + ': ' + m.text()); if (this.console.length > 300) this.console.shift(); });
    this.cdp = await this.ctx.newCDPSession(this.p);
    if (lento) {
      await this.cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
      await this.cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 200 * 1024, uploadThroughput: 80 * 1024 });
    }
    await this.p.goto(BASE + '/#teste');
    await this.p.evaluate(() => localStorage.clear()); await this.p.reload();
    await this.p.waitForTimeout(800);
    this.passo(`abriu ${BASE} num ${this.perfil}`);
    return this;
  }
  async fechar() { await this.ctx?.close().catch(() => {}); }

  passo(t) { this.passos.push(t); if (process.env.VERBOSO) console.log(`[${this.nome}] ${t}`); }
  async print(nome) {
    const arq = path.join(SAIDA, `${this.nome}-${nome}.png`.replace(/[^\w.-]+/g, '-'));
    await this.p.screenshot({ path: arq }).catch(() => {});
    return arq;
  }
  // registra um bug com tudo que o jogador fez até aqui
  async bug(titulo, { tipo = 'erro', esperado = '', visto = '' } = {}) {
    const print = await this.print('bug-' + (bugs.length + 1));
    const b = { titulo, tipo, esperado, visto, jogador: this.nome, perfil: this.perfil, roteiro: this.roteiro, passos: [...this.passos], print, console: [...this.console].slice(-25) };
    bugs.push(b);
    console.log(`BUG [${this.nome}/${this.perfil}] ${titulo}${visto ? ' | visto: ' + visto : ''}`);
    return b;
  }
  // confere uma expectativa; se falhar vira bug
  async espera(cond, titulo, extra = {}) {
    if (cond) { console.log(`ok   [${this.nome}/${this.perfil}] ${titulo}`); return true; }
    await this.bug(titulo, extra); return false;
  }

  // ---------- toque: vários dedos ao mesmo tempo, como uma pessoa ----------
  async dedos(tipo, pontos) {
    // o navegador guarda os dedos na tela: soltar/mexer sem ter encostado é erro do robô, não do jogo
    if (tipo !== 'touchStart' && !this.dedosNaTela) return;
    await this.cdp.send('Input.dispatchTouchEvent', { type: tipo, touchPoints: pontos.map(([x, y, id]) => ({ x, y, id, radiusX: 8, radiusY: 8, force: 1 })) });
    this.dedosNaTela = tipo === 'touchEnd' || tipo === 'touchCancel' ? 0 : pontos.length;
  }
  async tocar(sel) {
    const r = await this.p.locator(sel).first().boundingBox();
    if (!r) throw new Error('não achei ' + sel);
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    await this.dedos('touchStart', [[x, y, 1]]); await this.p.waitForTimeout(60); await this.dedos('touchEnd', []);
    await this.p.waitForTimeout(120);
  }
  // clica ou toca, conforme o aparelho
  async aperta(sel, desc) {
    this.passo(`${this.toque ? 'tocou' : 'clicou'} em ${desc || sel}`);
    if (this.toque) {
      // botões HTML recebem toque como clique no navegador real
      await this.p.locator(sel).first().tap({ timeout: 10000 });
    } else await this.p.locator(sel).first().click({ timeout: 10000 });
    await this.p.waitForTimeout(150);
  }
  async escreve(sel, texto, desc) { this.passo(`escreveu "${texto}" em ${desc || sel}`); await this.p.locator(sel).first().fill(texto); }
  async ve(sel, ms = 10000) { return this.p.locator(sel).first().waitFor({ state: 'visible', timeout: ms }).then(() => true, () => false); }

  // ---------- entrar ----------
  async criarConta(nomeConta, { crianca = false } = {}) {
    this.conta = (nomeConta || this.nome).replace(/\d/g, '') + 'x' + sfx().replace(/\d/g, (d) => 'abcdefghij'[d]);
    this.conta = this.conta.slice(0, 16);
    await this.aperta('#bt-criar-conta', 'Criar conta');
    await this.escreve('#c-nome', this.conta, 'nome'); await this.escreve('#c-senha', this.senha, 'senha');
    const ano = new Date().getFullYear() - (crianca ? 10 : 30);
    if (await this.p.isVisible('#c-nasc .d-ano')) {
      this.passo(`escolheu nascimento 10/5/${ano}`);
      await this.p.selectOption('#c-nasc .d-dia', '10'); await this.p.selectOption('#c-nasc .d-mes', '5'); await this.p.selectOption('#c-nasc .d-ano', String(ano));
    }
    if (await this.p.isVisible('#c-adulto-ok')) await this.p.check('#c-adulto-ok');
    await this.aperta('#c-ok', 'Criar');
    const entrou = await this.p.locator('#m-jogos:not([hidden]), #m-mundos:not([hidden])').first().waitFor({ timeout: 20000 }).then(() => true, () => false);
    if (!entrou) { await this.bug('criar conta não levou para a lista de jogos', { visto: await this.p.locator('#c-erro').innerText().catch(() => '') }); return false; }
    return true;
  }
  async escolherJogo(jogo = 'pradaria') {
    if (await this.p.isVisible('#m-jogos')) {
      await this.aperta(`.jogo[data-jogo=${jogo}]`, 'o jogo ' + jogo);
      if (jogo === 'pradaria') return this.ve('#m-mundos:not([hidden])', 15000);
      return true;
    }
    return true;
  }
  async jogarSozinho() { await this.aperta('#bt-sozinho', 'Jogar sem conta'); return this.ve('#m-novo:not([hidden])'); }
  // tela Novo mundo: modo (sobrevivencia|criativo), dificuldade, mods a ligar
  async criarMundo({ nome = 'Mundo ' + this.nome, modo = 'sobrevivencia', dificuldade, mods = [] } = {}) {
    if (await this.p.isVisible('#bt-novo-mundo')) await this.aperta('#bt-novo-mundo', 'Novo mundo');
    await this.ve('#m-novo:not([hidden])');
    if (await this.p.isVisible('#n-nome')) await this.escreve('#n-nome', nome, 'nome do mundo');
    if (await this.p.locator(`[data-modo=${modo}]`).count()) await this.aperta(`[data-modo=${modo}]`, 'modo ' + modo);
    if (dificuldade && await this.p.locator(`[data-dificuldade=${dificuldade}]`).count()) await this.aperta(`[data-dificuldade=${dificuldade}]`, 'dificuldade ' + dificuldade);
    for (const m of mods) if (await this.p.locator(`#n-mods [data-opcao=${m}]`).count()) await this.aperta(`#n-mods [data-opcao=${m}]`, 'mod ' + m);
    await this.aperta('#m-novo button[type=submit]', 'Criar mundo');
    return this.esperarMundo();
  }
  async entrarCodigo(codigo) {
    await this.aperta('#bt-codigo', 'Entrar com código');
    await this.escreve('#n-nome', codigo, 'código');
    await this.aperta('#m-novo button[type=submit]', 'Entrar');
    return this.esperarMundo();
  }
  async esperarMundo() {
    const aberto = () => { const c = document.querySelector('#m-carregando'); return window.__jogo && window.__jogo.jog && !(c && c.getClientRects().length); };
    const t0 = Date.now(), limite = this.cfg.lento ? 90000 : 40000;
    let ok = await this.p.waitForFunction(aberto, null, { timeout: limite }).then(() => true, () => false);
    if (!ok) {
      const txt = await this.p.locator('#carregando-txt').innerText().catch(() => '');
      ok = await this.p.waitForFunction(aberto, null, { timeout: 80000 }).then(() => true, () => false);
      if (!ok) { await this.bug('o mundo não abriu em 2 minutos', { visto: txt }); return false; }
      await this.bug(`o mundo demorou ${Math.round((Date.now() - t0) / 1000)} s para abrir`, { tipo: 'lento', visto: txt + ' (o Chromium do teste não tem placa de vídeo)' });
    }
    await this.p.waitForTimeout(this.cfg.lento ? 5000 : 2500);
    this.passo('entrou no mundo');
    if (!this.toque) await this.travarMouse();
    else await this.dedoNaTela(); // primeiro toque some com a dica
    return true;
  }

  // ---------- jogar ----------
  async travarMouse() {
    const c = await this.p.locator('#tela').boundingBox();
    await this.p.mouse.click(c.x + c.width / 2, c.y + c.height / 2);
    this.mx = c.x + c.width / 2; this.my = c.y + c.height / 2;
    await this.p.waitForTimeout(250);
    this.travado = await this.p.evaluate(() => !!document.pointerLockElement);
  }
  // botão do mouse com o mouse travado. O Chromium sem tela manda junto um mousemove falso (-640, -400) que gira a
  // câmera; uma pessoa com mouse de verdade não tem isso. Então o robô manda o mesmo mousedown/mouseup que o mouse
  // mandaria, direto no jogo.
  async botaoMouse(tipo, botao = 0) {
    await this.p.evaluate(([tipo, botao]) => {
      const alvo = tipo === 'mousedown' ? document.getElementById('tela') : window;
      alvo.dispatchEvent(new MouseEvent(tipo, { button: botao, buttons: tipo === 'mousedown' ? 1 << botao : 0, bubbles: true, clientX: innerWidth / 2, clientY: innerHeight / 2 }));
    }, [tipo, botao]);
  }
  // Esc: no navegador de verdade, com o mouse travado, o Esc só solta o mouse (o jogo abre o menu por isso);
  // o Chromium sem tela não solta sozinho, então o robô solta como o navegador faria
  async esc() {
    this.passo('apertou Esc');
    const solto = await this.p.evaluate(() => { if (document.pointerLockElement) { document.exitPointerLock(); return true; } return false; });
    if (!solto) await this.p.keyboard.press('Escape');
    await this.p.waitForTimeout(300);
  }
  async dedoNaTela() {
    const { width: w, height: h } = this.p.viewportSize();
    await this.dedos('touchStart', [[w * 0.7, h * 0.3, 9]]); await this.p.waitForTimeout(40); await this.dedos('touchEnd', []);
  }
  get estado() {
    return this.p.evaluate(() => {
      const j = window.__jogo; if (!j || !j.jog) return null;
      const jog = j.jog;
      return { pos: { x: +jog.pos.x.toFixed(2), y: +jog.pos.y.toFixed(2), z: +jog.pos.z.toFixed(2) }, yaw: jog.yaw, pitch: jog.pitch, voando: !!jog.voando, noChao: !!jog.noChao, vel: jog.vel ? { ...jog.vel } : null, vida: j.vida && j.vida.atual != null ? j.vida.atual : null, itens: j.mercado && j.mercado.e ? { ...j.mercado.e.itens } : {}, outros: j.outros, dia: j.dia };
    });
  }
  // andar: frente/tras/esquerda/direita por ms (teclado ou joystick)
  async andar(dir = 'frente', ms = 800, { correr = false, pular = false } = {}) {
    this.passo(`andou para ${dir} por ${ms} ms${correr ? ' correndo' : ''}${pular ? ' pulando' : ''}`);
    if (!this.toque) {
      const k = { frente: 'KeyW', tras: 'KeyS', esquerda: 'KeyA', direita: 'KeyD' }[dir];
      if (correr) await this.p.keyboard.down('ShiftLeft');
      await this.p.keyboard.down(k); if (pular) await this.p.keyboard.down('Space');
      await this.p.waitForTimeout(ms);
      await this.p.keyboard.up(k); if (pular) await this.p.keyboard.up('Space'); if (correr) await this.p.keyboard.up('ShiftLeft');
      return;
    }
    const { width: w, height: h } = this.p.viewportSize();
    const x0 = w * 0.18, y0 = h * 0.72, d = 50;
    const [dx, dy] = { frente: [0, -d], tras: [0, d], esquerda: [-d, 0], direita: [d, 0] }[dir];
    if (correr) { await this.dedos('touchStart', [[x0, y0, 1]]); await this.p.waitForTimeout(50); await this.dedos('touchEnd', []); await this.p.waitForTimeout(80); }
    await this.dedos('touchStart', [[x0, y0, 1]]);
    for (let i = 1; i <= 5; i++) { await this.dedos('touchMove', [[x0 + dx * i / 5, y0 + dy * i / 5, 1]]); await this.p.waitForTimeout(16); }
    let pulo = null;
    if (pular) { pulo = this.p.locator('#bt-pular'); const r = await pulo.boundingBox(); if (r) await this.dedos('touchStart', [[x0 + dx, y0 + dy, 1], [r.x + r.width / 2, r.y + r.height / 2, 2]]); }
    await this.p.waitForTimeout(ms);
    await this.dedos('touchEnd', []);
  }
  async pular() {
    this.passo('pulou');
    if (!this.toque) { await this.p.keyboard.down('Space'); await this.p.waitForTimeout(90); await this.p.keyboard.up('Space'); return; }
    const r = await this.p.locator('#bt-pular').boundingBox();
    if (!r) return;
    await this.dedos('touchStart', [[r.x + r.width / 2, r.y + r.height / 2, 3]]); await this.p.waitForTimeout(90); await this.dedos('touchEnd', []);
  }
  // girar a câmera em pixels de mouse / dedo
  async olhar(dx, dy = 0) {
    this.passo(`olhou (${dx}, ${dy})`);
    if (!this.toque) {
      if (!this.travado) await this.travarMouse();
      // com o mouse travado o jogo lê movementX/Y. O Chromium sem tela (headless) não gera esse movimento com o
      // mouse travado (manda +x e logo -x), então o robô manda o mesmo evento mousemove que o mouse mandaria
      const passos = Math.max(4, Math.ceil(Math.hypot(dx, dy) / 40));
      for (let i = 0; i < passos; i++) {
        await this.p.evaluate(([mx, my]) => document.dispatchEvent(new MouseEvent('mousemove', { movementX: mx, movementY: my, bubbles: true })), [dx / passos, dy / passos]);
        await this.p.waitForTimeout(16);
      }
      return;
    }
    const { width: w, height: h } = this.p.viewportSize();
    const x0 = w * 0.7, y0 = h * 0.45;
    await this.dedos('touchStart', [[x0, y0, 5]]);
    for (let i = 1; i <= 8; i++) { await this.dedos('touchMove', [[x0 + dx * i / 8, y0 + dy * i / 8, 5]]); await this.p.waitForTimeout(16); }
    await this.dedos('touchEnd', []);
  }
  // olhar para um ponto do mundo (usa a posição para mirar, mas gira pelo mouse/dedo)
  async mirarEm(alvo) {
    for (let t = 0; t < 4; t++) {
      const e = await this.p.evaluate(([x, y, z]) => { const j = window.__jogo.jog; const ox = j.pos.x, oy = j.pos.y + 1.6, oz = j.pos.z; const dx = x - ox, dy = y - oy, dz = z - oz; const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz)); let dyw = yaw - j.yaw; while (dyw > Math.PI) dyw -= 2 * Math.PI; while (dyw < -Math.PI) dyw += 2 * Math.PI; return { dyaw: dyw, dpitch: pitch - j.pitch, sens: window.__jogo.ctrl.sensToque || 0.005, escala: window.__jogo.ctrl.escala || 1 }; }, alvo);
      if (Math.abs(e.dyaw) < 0.03 && Math.abs(e.dpitch) < 0.03) return;
      const k = this.toque ? e.sens * e.escala : 0.0024 * e.escala;
      await this.olhar(-e.dyaw / k, -e.dpitch / k);
      await this.p.waitForTimeout(80);
    }
  }
  // segurar para quebrar (mouse esquerdo / dedo parado)
  async quebrar(ms = 1500) {
    this.passo(`segurou para quebrar por ${ms} ms`);
    if (!this.toque) {
      if (!this.travado) await this.travarMouse();
      await this.botaoMouse('mousedown', 0); await this.p.waitForTimeout(ms); await this.botaoMouse('mouseup', 0);
      return;
    }
    const { width: w, height: h } = this.p.viewportSize();
    await this.dedos('touchStart', [[w * 0.62, h * 0.4, 6]]); await this.p.waitForTimeout(ms); await this.dedos('touchEnd', []);
  }
  // usar / colocar (mouse direito / toque rápido no centro)
  async usar() {
    this.passo('usou/colocou (botão direito ou toque rápido)');
    if (!this.toque) {
      if (!this.travado) await this.travarMouse();
      await this.botaoMouse('mousedown', 2); await this.p.waitForTimeout(60); await this.botaoMouse('mouseup', 2);
      return;
    }
    const { width: w, height: h } = this.p.viewportSize();
    await this.dedos('touchStart', [[w / 2, h / 2, 7]]); await this.p.waitForTimeout(80); await this.dedos('touchEnd', []);
  }
  async tecla(k, desc) { this.passo(`apertou ${desc || k}`); await this.p.keyboard.press(k); await this.p.waitForTimeout(150); }
  async escolherSlot(i) {
    this.passo(`escolheu o espaço ${i + 1} da barra`);
    if (!this.toque) return this.p.keyboard.press('Digit' + (i + 1));
    await this.tocar(`#barra .slot:nth-child(${i + 1})`);
  }
  async abrirInventario() {
    this.passo('abriu a mochila');
    if (!this.toque) await this.p.keyboard.press('KeyE');
    else {
      await this.tocar('#barra .slot.mais');
    }
    return this.ve('#inventario:not([hidden])', 4000);
  }
  async fecharInventario() { this.passo('fechou a mochila'); await this.esc(); await this.p.waitForTimeout(200); if (!this.toque) await this.travarMouse(); }

  // ---------- caos ----------
  async semInternet(ms) { this.passo(`ficou sem internet por ${ms} ms`); await this.ctx.setOffline(true); await this.p.waitForTimeout(ms); await this.ctx.setOffline(false); }
  async recarregar() { this.passo('recarregou a página'); await this.p.reload(); await this.p.waitForTimeout(1500); }
  async segundoPlano(ms) {
    this.passo(`foi para outro aplicativo por ${ms} ms`);
    await this.p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await this.p.waitForTimeout(ms);
    await this.p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  }
  async girarAparelho() {
    const { width, height } = this.p.viewportSize();
    this.passo(`girou o aparelho para ${height}x${width}`);
    await this.p.setViewportSize({ width: height, height: width }); await this.p.waitForTimeout(600);
  }
  // clica/toca em qualquer botão visível ao acaso (criança apertando tudo)
  async apertarAoAcaso(n = 10, rnd = Math.random) {
    for (let i = 0; i < n; i++) {
      const alvos = await this.p.$$eval('button:not([disabled]), [role=button], .jogo, .slot-inv, input[type=checkbox]', (els) => els.map((e, i) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight ? { i, x: r.x + r.width / 2, y: r.y + r.height / 2, t: (e.id || e.className || e.textContent || '').toString().slice(0, 40) } : null; }).filter(Boolean));
      const proib = /apagar|sair-conta|excluir|bt-sair/i;
      const ok = alvos.filter((a) => !proib.test(a.t));
      if (!ok.length) return;
      const a = ok[Math.floor(rnd() * ok.length)];
      this.passo(`${this.toque ? 'tocou' : 'clicou'} ao acaso em "${a.t.trim()}"`);
      if (this.toque) { await this.dedos('touchStart', [[a.x, a.y, 4]]); await this.p.waitForTimeout(50); await this.dedos('touchEnd', []); }
      else await this.p.mouse.click(a.x, a.y);
      await this.p.waitForTimeout(250);
    }
  }
  // erros da página que não podem acontecer
  async semErros(onde) {
    const graves = this.erros.splice(0);
    const ruins = this.console.filter((c) => /^error:/.test(c) && !/favicon|net::ERR_INTERNET_DISCONNECTED|Failed to load resource|WebSocket|AudioContext|GPU stall|pointer ?lock/i.test(c));
    if (graves.length) await this.bug(`erro de JavaScript ${onde}`, { tipo: 'erro', visto: graves.slice(0, 3).join(' | ') });
    return !graves.length && !ruins.length;
  }
}

// sorteio repetível (mesma semente = mesma bagunça, para reproduzir o bug)
export function sorteio(semente = Date.now()) {
  let s = semente >>> 0;
  const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.semente = semente; return f;
}

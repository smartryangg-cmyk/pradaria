// Jogar na TV: letras grandes, navegar nos menus com as setas do controle remoto, controle de videogame
// (Gamepad) e o celular como controle (a TV mostra um código/QR; o celular abre /controle e manda os comandos
// pela sala de controle no servidor, ver sala-worker/src/controle.js).
//
//   import { modoTV, iniciarTV } from './tv.js';
//   if (modoTV()) ... // antes de decidir se é toque
//   const tv = iniciarTV({ ctrl: () => ctrl, emJogo: () => ..., ... });
import { icone, comIcone } from './icones.js';
import qrcode from '../vendor/qrcode.mjs';

const CHAVE = 'pradaria.tv'; // '1' liga, '0' desliga, sem nada = automático (navegador de TV liga sozinho)
const CHAVE_COD = 'pradaria.tv.codigo';
const UA_TV = /SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|HbbTV|BRAVIA|Android ?TV|GoogleTV|CrKey|AFT[A-Z]|Roku|Viera|AQUOS|VIDAA|TitanOS|Opera TV|DTV/i;
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0 e 1
const $ = (s) => document.querySelector(s);

export const ehNavegadorTV = () => UA_TV.test(navigator.userAgent);

// ?tv=1 / ?tv=0 na URL também escolhe (e fica guardado)
// pradaria.pages.dev/tv: a versão da TV, que abre primeiro a tela de ligar o celular como controle
export const tvPrimeiro = () => /^\/tv\/?$/.test(location.pathname) || new URLSearchParams(location.search).get('tv') === 'parear';

export function modoTV() {
  if (tvPrimeiro()) return true;
  try {
    const q = new URLSearchParams(location.search).get('tv');
    if (q === '1' || q === '0') localStorage.setItem(CHAVE, q);
    const v = localStorage.getItem(CHAVE);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {}
  return ehNavegadorTV();
}

function novoCodigo() {
  const a = new Uint32Array(6); crypto.getRandomValues(a);
  return [...a].map((n) => LETRAS[n % LETRAS.length]).join('');
}

// ---------- navegar nos menus com setas (controle remoto, videogame, celular) ----------
const FOCAVEIS = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const camadaDe = (el) => el && el.closest('.janela, [role=dialog], #menu');

function camadaTopo() {
  const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  return camadaDe(el);
}

function podeFocar(el, topo) {
  if (el.disabled || el.closest('[hidden], [inert]')) return false;
  // dentro de um "Mais opções" fechado: só o título (summary) dá para escolher
  for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) {
    if (!d.open && !(el.tagName === 'SUMMARY' && el.parentElement === d)) return false;
  }
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
  const st = getComputedStyle(el);
  if (st.visibility === 'hidden' || st.display === 'none') return false;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  if (cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight) {
    const em = document.elementFromPoint(cx, cy);
    if (!em || em === document.body || em === document.documentElement) return false;
    return el === em || el.contains(em) || em.contains(el) || (el.labels && [...el.labels].some((l) => l.contains(em)));
  }
  // fora da tela (lista que rola): vale se estiver na mesma janela que está por cima
  return !!topo && topo.contains(el);
}

export function focaveis() {
  const topo = camadaTopo();
  return [...document.querySelectorAll(FOCAVEIS)].filter((el) => podeFocar(el, topo));
}

let focoAtual = null;
function focar(el) {
  if (focoAtual && focoAtual !== el) focoAtual.classList.remove('foco-tv');
  focoAtual = el;
  if (!el) return;
  el.classList.add('foco-tv');
  try { el.focus({ preventScroll: true }); } catch { el.focus(); }
  // no meio da tela: não fica escondido atrás de uma barra que fica parada no topo (abas do Novo mundo)
  const r = el.getBoundingClientRect();
  if (r.top < innerHeight * 0.18 || r.bottom > innerHeight * 0.82) el.scrollIntoView({ block: 'center', inline: 'nearest' });
}

const centro = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// primeiro foco de uma tela: o primeiro campo para escrever (nome, senha...), senão o botão principal (verde), senão o de cima
function focoInicial(lista) {
  return lista.find((e) => e.tagName === 'INPUT' && /^(text|password|search|email|)$/.test(e.type) && !(e.closest('details')))
    || lista.find((e) => e.classList.contains('verde') || e.dataset.jogo === 'pradaria')
    || [...lista].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
}

// tela nova (o botão escolhido sumiu): já deixa um escolhido, para o controle remoto/celular não ficar sem foco
export function garantirFoco() {
  const el = document.activeElement;
  if (el && el !== document.body && !el.closest('[hidden]') && el.getBoundingClientRect().width > 0) return false;
  const lista = focaveis();
  if (!lista.length) return false;
  focar(focoInicial(lista));
  return true;
}

// escolhe o vizinho mais perto na direção (cima, baixo, esq, dir)
export function navegar(dir) {
  const lista = focaveis();
  if (!lista.length) return false;
  const atual = lista.includes(document.activeElement) ? document.activeElement : null;
  if (!atual) {
    focar(focoInicial(lista));
    return true;
  }
  // controles deslizantes e listas: esquerda/direita mudam o valor
  if (dir === 'esq' || dir === 'dir') {
    const d = dir === 'dir' ? 1 : -1;
    if (atual.type === 'range') {
      const passo = +atual.step || (atual.max - atual.min) / 20 || 1;
      atual.value = Math.max(+atual.min, Math.min(+atual.max, +atual.value + d * passo));
      atual.dispatchEvent(new Event('input', { bubbles: true })); atual.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (atual.tagName === 'SELECT') {
      const i = Math.max(0, Math.min(atual.options.length - 1, atual.selectedIndex + d));
      if (i !== atual.selectedIndex) { atual.selectedIndex = i; atual.dispatchEvent(new Event('change', { bubbles: true })); }
      return true;
    }
  }
  const a = atual.getBoundingClientRect(), ca = centro(a);
  const vx = dir === 'dir' ? 1 : dir === 'esq' ? -1 : 0, vy = dir === 'baixo' ? 1 : dir === 'cima' ? -1 : 0;
  let melhor = null, nota = Infinity;
  for (const el of lista) {
    if (el === atual || el.contains(atual) || atual.contains(el)) continue;
    const r = el.getBoundingClientRect(), c = centro(r);
    // distância na direção (borda a borda) e de lado (0 quando estão na mesma linha/coluna)
    const prim = vx ? (vx > 0 ? r.left - a.right : a.left - r.right) : (vy > 0 ? r.top - a.bottom : a.top - r.bottom);
    const primC = (c.x - ca.x) * vx + (c.y - ca.y) * vy;
    if (primC <= 2) continue;
    const lado = vx ? Math.max(0, Math.max(r.top, a.top) - Math.min(r.bottom, a.bottom)) : Math.max(0, Math.max(r.left, a.left) - Math.min(r.right, a.right));
    const n = Math.max(0, prim) + lado * 3 + Math.abs(vx ? c.y - ca.y : c.x - ca.x) * 0.1;
    if (n < nota) { nota = n; melhor = el; }
  }
  if (melhor) focar(melhor);
  return !!melhor;
}

function apertarFocado() {
  const el = document.activeElement;
  if (!el || el === document.body || !focaveis().includes(el)) { navegar('baixo'); return; }
  if (el.tagName === 'INPUT' && /^(text|password|search|number|email|)$/.test(el.type)) { el.focus(); return; }
  if (el.tagName === 'SELECT') { navegar('dir'); return; }
  el.click();
}

// ---------- o painel na TV: código e QR para o celular ----------
function desenharQR(texto) {
  const q = qrcode(0, 'M');
  q.addData(texto); q.make();
  const n = q.getModuleCount(), m = 2;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x + m} ${y + m}h1v1h-1z`;
  return `<svg class="tv-qr" viewBox="0 0 ${n + m * 2} ${n + m * 2}" shape-rendering="crispEdges" aria-label="Código QR para abrir o controle no celular"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#1d1a16"/></svg>`;
}

export function iniciarTV(api) {
  const tv = {
    ligado: false,
    ws: null, codigo: null, celulares: 0, conectado: false,
    ultimoCel: 0, painel: null,
  };
  const ctrl = () => api.ctrl && api.ctrl();
  const emJogo = () => !!api.emJogo();

  // ----- liga/desliga as letras grandes -----
  function zoom() {
    const z = Math.max(1, Math.min(innerWidth / 1180, innerHeight / 660));
    document.documentElement.style.setProperty('--tv-zoom', z.toFixed(3));
  }
  tv.aplicar = (sim) => {
    tv.ligado = sim;
    document.body.classList.toggle('modo-tv', sim);
    if (ctrl()) ctrl().tv = sim;
    zoom();
    for (const c of document.querySelectorAll('.aj-tv')) c.checked = sim;
  };
  tv.escolher = (sim) => { try { localStorage.setItem(CHAVE, sim ? '1' : '0'); } catch {} tv.aplicar(sim); };
  addEventListener('resize', zoom);

  // ----- segurar quebrar/atirar (videogame, celular, OK do controle remoto) -----
  const quebrando = new Set();
  let timerQ = null;
  function segurarQuebrar(fonte, sim) {
    const c = ctrl(); if (!c) return;
    const armado = c.cb.armado && c.cb.armado();
    if (sim && !quebrando.has(fonte)) {
      quebrando.add(fonte);
      if (armado) { c.cb.gatilho(true); return; }
      if (!emJogo()) return;
      c.cb.quebrar(null);
      clearInterval(timerQ);
      timerQ = setInterval(() => { if (!quebrando.size || !emJogo()) { clearInterval(timerQ); return; } c.cb.quebrar(null); }, 260);
    } else if (!sim && quebrando.delete(fonte)) {
      if (!quebrando.size) { clearInterval(timerQ); if (c.cb.gatilho) c.cb.gatilho(false); }
    }
  }
  let mirando = false;
  function acao(a, v) {
    const c = ctrl();
    switch (a) {
      case 'usar':
        if (!c || !emJogo()) return;
        if (c.cb.armado && c.cb.armado()) { mirando = !mirando; c.cb.mirar(mirando); } else c.cb.usar(null);
        break;
      case 'voar': if (emJogo()) api.alternarVoo(); break;
      case 'mochila': if (emJogo()) api.inventario(); else api.fechar(); break;
      case 'pausa': if (!api.jogando()) return; if (emJogo()) api.pausar(); else api.fechar(); break;
      case 'mapa': if (emJogo()) api.mapa(); else api.fechar(); break;
      case 'visao': if (emJogo()) api.visao(); break;
      case 'largar': if (emJogo()) api.largar(); break;
      case 'slot': if (c && emJogo()) { if (c.cb.armado && c.cb.armado() && c.cb.trocar) c.cb.trocar(); else c.cb.rolar(v > 0 ? 1 : -1); } break;
      case 'recarregar': if (c && emJogo() && c.cb.recarregar) c.cb.recarregar(); break;
    }
  }
  // voltar: fecha a janela aberta, ou volta uma tela no menu inicial
  function voltar() {
    if (tv.painel && !tv.painel.hidden) { fecharPainel(); return; }
    if (api.jogando()) { if (emJogo()) api.pausar(); else api.fechar(); return; }
    const bt = focaveis().find((b) => b.matches('[data-voltar], [data-voltar-mundos], #e-cancelar, #bt-voltar-jogos, #pers-cancelar'));
    if (bt) bt.click();
  }
  tv.navegar = navegar; tv.voltar = voltar; tv.acao = acao;

  // ----- controle remoto (teclado da TV) -----
  const SETAS = { ArrowUp: 'cima', ArrowDown: 'baixo', ArrowLeft: 'esq', ArrowRight: 'dir' };
  const VOLTAR = new Set(['Escape', 'GoBack', 'BrowserBack', 'Back']);
  const codVoltar = (e) => e.keyCode === 10009 || e.keyCode === 461 || VOLTAR.has(e.key) || (e.key === 'Backspace' && e.target.tagName !== 'INPUT');
  const remoto = { esq: false, dir: false, okEm: 0, okSegurando: false, timerOk: null };
  addEventListener('keydown', (e) => {
    if (!tv.ligado) return;
    const dir = SETAS[e.key];
    if (!emJogo()) {
      // nos menus: setas andam entre os botões (no campo de texto, esquerda/direita mexem no cursor)
      if (dir) {
        const el = e.target;
        if ((dir === 'esq' || dir === 'dir') && el.tagName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox') return;
        e.preventDefault(); e.stopImmediatePropagation();
        navegar(dir);
        return;
      }
      if (codVoltar(e)) {
        const painel = tv.painel && !tv.painel.hidden;
        // Esc com o jogo pausado: quem fecha as janelas é o main.js
        if (painel || !(e.key === 'Escape' && api.jogando())) { e.preventDefault(); e.stopImmediatePropagation(); voltar(); }
      }
      return;
    }
    // jogando com o controle remoto: cima/baixo anda, esquerda/direita vira (ou guia o veículo), OK usa, segurar OK quebra
    if (dir === 'esq' || dir === 'dir') { remoto[dir] = true; e.preventDefault(); }
    if (e.key === 'Enter' && !e.repeat) {
      e.preventDefault();
      remoto.okEm = performance.now(); remoto.okSegurando = false;
      clearTimeout(remoto.timerOk);
      remoto.timerOk = setTimeout(() => { remoto.okSegurando = true; segurarQuebrar('remoto', true); }, 400);
    } else if (e.key === 'Enter') e.preventDefault();
    if (codVoltar(e)) { e.preventDefault(); e.stopImmediatePropagation(); api.pausar(); }
    // botões coloridos: vermelho pula, verde mochila, amarelo voa, azul mapa
    if (e.keyCode === 403 || e.key === 'ColorF0Red') { if (ctrl()) ctrl().fontes.remoto = { ...(ctrl().fontes.remoto || {}), pular: true }; }
    if ((e.keyCode === 404 || e.key === 'ColorF1Green') && !e.repeat) acao('mochila');
    if ((e.keyCode === 405 || e.key === 'ColorF2Yellow') && !e.repeat) acao('voar');
    if ((e.keyCode === 406 || e.key === 'ColorF3Blue') && !e.repeat) acao('mapa');
    if ((e.key === 'ChannelUp' || e.key === 'PageUp' || e.keyCode === 427) && !e.repeat) acao('slot', -1);
    if ((e.key === 'ChannelDown' || e.key === 'PageDown' || e.keyCode === 428) && !e.repeat) acao('slot', 1);
  }, true);
  addEventListener('keyup', (e) => {
    const dir = SETAS[e.key];
    if (dir === 'esq' || dir === 'dir') remoto[dir] = false;
    if (e.keyCode === 403 || e.key === 'ColorF0Red') { if (ctrl() && ctrl().fontes.remoto) ctrl().fontes.remoto.pular = false; }
    if (e.key === 'Enter' && remoto.okEm) {
      clearTimeout(remoto.timerOk);
      if (remoto.okSegurando) segurarQuebrar('remoto', false);
      else if (tv.ligado && emJogo()) acao('usar');
      remoto.okEm = 0;
    }
  }, true);

  // ----- controle de videogame (Gamepad API: padrão Xbox/PlayStation) -----
  const antes = {};
  const navRep = { dir: null, prox: 0 };
  function lerControles(dt) {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const c = ctrl();
    if (!pads.length) { if (c && c.fontes.pad) c.fontes.pad = null; return; }
    const g = pads[0];
    const bt = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
    const novo = (i) => bt(i) && !antes[i];
    const morto = (v) => (Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82);
    const ax = morto(g.axes[0] || 0), ay = morto(g.axes[1] || 0), rx = morto(g.axes[2] || 0), ry = morto(g.axes[3] || 0);
    if (emJogo()) {
      if (c) {
        c.fontes.pad = { frente: -ay, lado: ax, pular: bt(0), descer: bt(1), correr: bt(10) };
        if (rx || ry) c.girar(rx * Math.abs(rx) * dt * 3.2, ry * Math.abs(ry) * dt * 2.4);
      }
      segurarQuebrar('pad', bt(7));
      if (novo(6)) acao('usar');
      if (novo(2)) acao('mochila');
      if (novo(3)) acao('voar');
      if (novo(4) || novo(14)) acao('slot', -1);
      if (novo(5) || novo(15)) acao('slot', 1);
      if (novo(13)) acao('largar');
      if (novo(12)) acao('recarregar');
      if (novo(11)) acao('visao');
      if (novo(8)) acao('mapa');
      if (novo(9)) acao('pausa');
    } else {
      if (c) c.fontes.pad = null;
      segurarQuebrar('pad', false);
      // menus: direcional ou alavanca andam (repetindo enquanto segura), A aperta, B volta
      let dir = bt(12) ? 'cima' : bt(13) ? 'baixo' : bt(14) ? 'esq' : bt(15) ? 'dir' : null;
      if (!dir && Math.hypot(ax, ay) > 0.6) dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'dir' : 'esq') : (ay > 0 ? 'baixo' : 'cima');
      const agora = performance.now();
      if (dir && (dir !== navRep.dir || agora > navRep.prox)) { navegar(dir); navRep.prox = agora + (dir !== navRep.dir ? 380 : 140); }
      navRep.dir = dir;
      if (novo(0)) apertarFocado();
      if (novo(1)) voltar();
      if (novo(9)) acao('pausa');
    }
    for (let i = 0; i < g.buttons.length; i++) antes[i] = bt(i);
  }
  addEventListener('gamepadconnected', (e) => {
    api.aviso && api.aviso('Controle ligado: ' + (e.gamepad.id.split('(')[0].trim() || 'videogame').slice(0, 30), 2600, 'controle');
    if (!tv.ligado && ehNavegadorTV()) tv.aplicar(true);
  });

  // ----- celular como controle -----
  const cel = { frente: 0, lado: 0, pular: false, descer: false, correr: false };
  let ultimoModo = '';
  function mandarCel(obj) { if (tv.ws && tv.ws.readyState === 1) tv.ws.send(JSON.stringify(obj)); }
  function modoAgora() {
    const el = document.activeElement;
    const campo = !emJogo() && el && el.tagName === 'INPUT' && /^(text|password|search|number|email|)$/.test(el.type)
      ? { tipo: el.type === 'password' ? 'password' : 'text', valor: el.type === 'password' ? '' : el.value, nome: (el.labels && el.labels[0] && el.labels[0].textContent.trim().slice(0, 40)) || el.placeholder || '' } : null;
    return { t: 'modo', menu: !emJogo(), campo };
  }
  function recado(m) {
    tv.ultimoCel = performance.now();
    const c = ctrl();
    switch (m.t) {
      case 'par': atualizarPar(m); break;
      case 'oi': ultimoModo = ''; break;
      case 'm': // andar: alavanca do celular
        cel.frente = Math.max(-1, Math.min(1, +m.f || 0)); cel.lado = Math.max(-1, Math.min(1, +m.l || 0)); cel.correr = !!m.c;
        break;
      case 'g': // olhar em volta: quanto o dedo andou (em radianos)
        if (c && emJogo() && Number.isFinite(m.x) && Number.isFinite(m.y)) c.girar(Math.max(-1, Math.min(1, m.x)), Math.max(-1, Math.min(1, m.y)));
        break;
      case 'b': // botões de segurar
        if (m.b === 'pular') cel.pular = !!m.v;
        else if (m.b === 'descer') cel.descer = !!m.v;
        else if (m.b === 'quebrar') segurarQuebrar('cel' + (m.c || 1), !!m.v);
        break;
      case 'a': acao(String(m.a), m.v); break;
      case 'n':
        if (m.d === 'ok') apertarFocado();
        else if (m.d === 'voltar') voltar();
        else if (['cima', 'baixo', 'esq', 'dir'].includes(m.d)) navegar(m.d);
        break;
      case 'txt': { // o celular escreveu no campo que está escolhido na TV
        const el = document.activeElement;
        if (el && el.tagName === 'INPUT' && typeof m.v === 'string') {
          el.value = m.v.slice(0, +el.maxLength > 0 ? +el.maxLength : 60);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          if (m.enviar && el.form) el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit();
        }
        break;
      }
    }
  }
  function soltarCel() {
    cel.frente = cel.lado = 0; cel.pular = cel.descer = cel.correr = false;
    for (const f of [...quebrando]) if (f.startsWith('cel')) segurarQuebrar(f, false);
  }
  function atualizarPar(m) {
    const antes = tv.celulares;
    tv.celulares = m.cel || 0;
    tv.conectado = !!m.ok;
    if (!m.ok) soltarCel();
    if (tv.celulares > antes) {
      api.aviso && api.aviso('Celular ligado! Ele já é o seu controle', 2600, 'celular'); ultimoModo = '';
      // versão da TV: assim que o celular liga, a tela grande do código sai e o jogo segue (menu, conta, mundos)
      if (tv.painel && !tv.painel.hidden && tv.painel.classList.contains('tv-cheia')) setTimeout(() => { fecharPainel(); navegar('baixo'); }, 900);
    }
    else if (tv.celulares < antes) api.aviso && api.aviso('O celular desligou do controle', 2200, 'celular');
    desenharStatus();
  }
  function conectar() {
    if (!tv.codigo) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/controle/${tv.codigo}?papel=tv`);
    tv.ws = ws;
    ws.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } if (m && typeof m.t === 'string') recado(m); };
    ws.onclose = (ev) => {
      if (tv.ws !== ws) return;
      tv.ws = null; tv.conectado = false; tv.celulares = 0; soltarCel(); desenharStatus();
      if (ev.code === 4001) return; // a mesma TV abriu em outra aba
      setTimeout(() => { if (!tv.ws && tv.codigo) conectar(); }, 3000);
    };
    ws.onerror = () => {};
  }
  tv.ligarCelular = (cheia = false) => {
    if (!tv.codigo) {
      try { tv.codigo = sessionStorage.getItem(CHAVE_COD); } catch {}
      if (!tv.codigo || !/^[A-Z2-9]{6}$/.test(tv.codigo)) tv.codigo = novoCodigo();
      try { sessionStorage.setItem(CHAVE_COD, tv.codigo); } catch {}
    }
    if (!tv.ws) conectar();
    abrirPainel(cheia);
  };
  // a TV recarregou a página com um celular ligado: volta a esperar pelo mesmo código
  try { if (sessionStorage.getItem(CHAVE_COD)) { tv.codigo = sessionStorage.getItem(CHAVE_COD); conectar(); } } catch {}

  function urlControle() { return `${location.origin}/controle.html?c=${tv.codigo}`; }
  function abrirPainel(cheia = false) {
    if (!tv.painel) {
      const el = document.createElement('div');
      el.id = 'tv-painel'; el.className = 'janela'; el.hidden = true;
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tv-titulo');
      el.innerHTML = `<div class="caixa larga">
        <h2 class="com-ic" id="tv-titulo">${icone('celular')} <span>Celular como controle</span></h2>
        <div class="tv-par">
          <div id="tv-qr"></div>
          <div class="tv-passos">
            <p>No celular, aponte a câmera para o quadrado</p>
            <p>ou abra <b id="tv-url"></b> e digite:</p>
            <p class="tv-codigo" id="tv-codigo"></p>
            <p id="tv-status" class="sub"></p>
          </div>
        </div>
        <p class="sub">Dá para jogar também com um controle de videogame ligado na TV ou com as setas do controle remoto.</p>
        <button class="bt verde grande" type="button" id="tv-pronto">${icone('controle')}<span id="tv-pronto-txt">Pronto</span></button>
        <button class="bt fraco" type="button" id="tv-novo">Trocar o código</button>
      </div>`;
      document.body.appendChild(el);
      el.querySelector('#tv-pronto').addEventListener('click', fecharPainel);
      el.querySelector('#tv-novo').addEventListener('click', () => {
        tv.codigo = novoCodigo();
        try { sessionStorage.setItem(CHAVE_COD, tv.codigo); } catch {}
        const velho = tv.ws; tv.ws = null; if (velho) velho.close();
        conectar(); abrirPainel(tv.painel.classList.contains('tv-cheia'));
      });
      tv.painel = el;
    }
    // versão da TV: a tela inteira é o código, e dá para seguir sem celular (controle remoto ou videogame)
    tv.painel.classList.toggle('tv-cheia', cheia);
    $('#tv-titulo').lastElementChild.textContent = cheia ? 'Pegue o celular para jogar' : 'Celular como controle';
    $('#tv-pronto-txt').textContent = cheia ? 'Jogar sem celular' : 'Pronto';
    $('#tv-qr').innerHTML = desenharQR(urlControle());
    $('#tv-url').textContent = location.host + '/controle';
    $('#tv-codigo').textContent = tv.codigo.slice(0, 3) + ' ' + tv.codigo.slice(3);
    desenharStatus();
    tv.painel.hidden = false;
    tv.pausouPainel = api.jogando() && emJogo();
    if (tv.pausouPainel) api.pausarSem && api.pausarSem(true);
    setTimeout(() => focar(tv.painel.querySelector('#tv-pronto')), 50);
  }
  function fecharPainel() {
    if (!tv.painel) return;
    tv.painel.hidden = true;
    if (tv.pausouPainel) { tv.pausouPainel = false; api.pausarSem && api.pausarSem(false); }
  }
  tv.fecharPainel = fecharPainel;
  function desenharStatus() {
    const s = $('#tv-status');
    if (s) s.innerHTML = tv.celulares ? comIcone('celular', tv.celulares > 1 ? `${tv.celulares} celulares ligados` : 'Celular ligado! Pode jogar') : comIcone('ampulheta', tv.ws ? 'Esperando o celular...' : 'Ligando...');
    for (const b of document.querySelectorAll('.bt-celular-controle .tv-sit')) b.textContent = tv.celulares ? ' (ligado)' : '';
  }

  // ----- botões nos menus (início e pausa) e a opção "Modo TV" -----
  function botoes() {
    const fazer = (id) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'bt bt-celular-controle'; b.id = id;
      b.innerHTML = icone('celular') + '<span>Celular como controle</span><span class="tv-sit"></span>';
      b.addEventListener('click', () => tv.ligarCelular());
      return b;
    };
    const opcaoTV = () => {
      const l = document.createElement('label');
      l.className = 'campo linha';
      l.innerHTML = '<input type="checkbox" class="aj-tv"> Modo TV (letras grandes e controle remoto)';
      l.querySelector('input').addEventListener('change', (e) => tv.escolher(e.target.checked));
      return l;
    };
    const versao = $('#versao-inicio');
    if (versao) { versao.before(fazer('bt-celular-inicio')); versao.before(opcaoTV()); }
    const sair = $('#bt-sair-mundo');
    if (sair) { sair.before(fazer('bt-celular-pausa')); sair.before(opcaoTV()); }
    // no celular: abrir a tela de controle para mandar numa TV
    const pers = $('#bt-personagem');
    if (pers && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)) {
      const a = document.createElement('a');
      a.className = 'bt'; a.href = 'controle.html'; a.id = 'bt-ser-controle';
      a.innerHTML = icone('tv') + 'Controlar o jogo na TV';
      pers.after(a);
    }
  }
  botoes();
  tv.aplicar(modoTV());
  if (tvPrimeiro()) {
    document.body.classList.add('tv-primeiro');
    tv.ligarCelular(true);
  }

  // ----- a cada quadro -----
  let ultimo = performance.now();
  function quadro(agora) {
    requestAnimationFrame(quadro);
    const dt = Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
    const c = ctrl();
    lerControles(dt);
    // primeira vez jogando na TV: diz como se joga com o controle remoto
    if (tv.ligado && !tv.disseComo && emJogo()) {
      tv.disseComo = true;
      setTimeout(() => api.aviso && api.aviso(tv.celulares ? 'Jogando com o celular! Alavanca anda, arraste o dedo para olhar' : 'Setas: andar e virar · OK: usar · Segure OK: quebrar · Voltar: pausa', 6000, 'tv'), 2800);
    }
    if (c) {
      c.tv = tv.ligado;
      // celular: se parou de mandar (sinal caiu), solta tudo
      if (tv.ultimoCel && agora - tv.ultimoCel > 1500 && (cel.frente || cel.lado || cel.pular)) soltarCel();
      c.fontes.cel = emJogo() ? cel : null;
      // controle remoto: esquerda/direita viram a câmera (ou guiam o veículo)
      const giro = (remoto.dir ? 1 : 0) - (remoto.esq ? 1 : 0);
      const dirigindo = document.body.classList.contains('dirigindo');
      const r = c.fontes.remoto || (c.fontes.remoto = {});
      r.lado = dirigindo ? giro : 0;
      if (giro && !dirigindo && emJogo()) c.girar(giro * dt * 2.2, 0);
    }
    // menus na TV: quando a tela muda, já escolhe um botão (de vez em quando, para não pesar)
    if (tv.ligado && !emJogo() && agora - (tv.ultimoFoco || 0) > 300 && !(tv.painel && !tv.painel.hidden && tv.painel.classList.contains('tv-cheia'))) {
      tv.ultimoFoco = agora;
      garantirFoco();
    }
    // conta para o celular se a TV está num menu (ele mostra as setas) ou jogando (alavanca e botões)
    if (tv.conectado) {
      const m = modoAgora(), txt = JSON.stringify(m);
      if (txt !== ultimoModo) { ultimoModo = txt; mandarCel(m); }
    }
  }
  requestAnimationFrame(quadro);
  setInterval(() => { if (tv.ws && tv.ws.readyState === 1) tv.ws.send('"ping"'); }, 25000);
  return tv;
}

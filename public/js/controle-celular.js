// O celular vira controle do jogo que está aberto na TV (ver tv.js e sala-worker/src/controle.js).
// Jogando: alavanca à esquerda, arrastar à direita para olhar (toque usa, segurar quebra) e botões.
// Nos menus da TV: setas, OK, voltar e um campo para escrever (nome, senha, código do mundo).
import { preencherIcones } from './icones.js';

const $ = (s) => document.querySelector(s);
const LETRAS = /^[A-HJ-NP-Z2-9]{6}$/;
const SENS = 0.0065; // radianos por pixel arrastado
preencherIcones();

let ws = null, codigo = null, ligado = false, fechado = false, tentativas = 0;

function vibrar(ms = 12) { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch {} }
let timerAviso;
function aviso(txt, ms = 1800) {
  const el = $('#aviso-ctl'); el.textContent = txt; el.classList.add('mostra');
  clearTimeout(timerAviso); timerAviso = setTimeout(() => el.classList.remove('mostra'), ms);
}
function enviar(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

// ---------- ligar com o código ----------
const q = new URLSearchParams(location.search).get('c');
if (q) $('#codigo').value = q.toUpperCase();
$('#f-ligar').addEventListener('submit', (e) => {
  e.preventDefault();
  const c = $('#codigo').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!LETRAS.test(c)) { $('#erro-ligar').textContent = 'O código tem 6 letras e números, igual ao da TV.'; return; }
  $('#erro-ligar').textContent = '';
  ligar(c);
});
if (q && LETRAS.test(q.toUpperCase())) ligar(q.toUpperCase());

function ligar(c) {
  codigo = c; fechado = false;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const w = new WebSocket(`${proto}//${location.host}/api/controle/${codigo}?papel=cel`);
  ws = w;
  w.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === 'erro') { fechado = true; desligar(m.msg); return; }
    if (m.t === 'par') {
      if (m.tvSaiu) { $('#estado').textContent = 'A TV saiu... esperando'; return; }
      if (!ligado) { ligado = true; vibrar(40); }
      tentativas = 0;
      document.body.classList.add('ligado');
      $('#estado').textContent = 'Ligado na TV ' + codigo.slice(0, 3) + ' ' + codigo.slice(3);
      try { history.replaceState(null, '', '?c=' + codigo); } catch {}
      manterTelaAcesa();
      enviar({ t: 'oi' });
    }
    if (m.t === 'modo') mudarModo(m);
  };
  w.onclose = (ev) => {
    if (ws !== w) return;
    ws = null;
    if (fechado || ev.code >= 4000) { if (!fechado) desligar('Não deu para ligar na TV.'); return; }
    if (!ligado && tentativas >= 2) { desligar('Não consegui falar com a TV. Confira a internet.'); return; }
    $('#estado').textContent = 'Reconectando...';
    setTimeout(() => !fechado && ligar(codigo), Math.min(8000, 800 * 2 ** tentativas++));
  };
  w.onerror = () => {};
}
function desligar(msg) {
  ligado = false; fechado = true;
  if (ws) { const w = ws; ws = null; try { w.close(); } catch {} }
  document.body.classList.remove('ligado', 'menu', 'com-campo');
  $('#erro-ligar').textContent = msg || '';
}
$('#b-desligar').addEventListener('click', () => { soltarTudo(); desligar(''); });
setInterval(() => { if (ws && ws.readyState === 1) ws.send('"ping"'); }, 25000);

// a tela do celular não apaga enquanto ele é o controle
let trava = null;
async function manterTelaAcesa() { try { if (!trava && navigator.wakeLock) { trava = await navigator.wakeLock.request('screen'); trava.addEventListener('release', () => { trava = null; }); } } catch {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ligado) manterTelaAcesa(); else soltarTudo(); });

// ---------- a TV conta se está num menu ou jogando ----------
let modoMenu = false;
function mudarModo(m) {
  if (m.menu !== modoMenu) { modoMenu = !!m.menu; soltarTudo(); vibrar(8); }
  document.body.classList.toggle('menu', modoMenu);
  const campo = m.campo;
  document.body.classList.toggle('com-campo', !!campo);
  if (campo) {
    const inp = $('#txt-cel');
    inp.type = campo.tipo === 'password' ? 'password' : 'text';
    $('#campo-nome').textContent = 'Escrever: ' + (campo.nome || 'campo da TV');
    if (document.activeElement !== inp) inp.value = campo.valor || '';
  }
}
$('#txt-cel').addEventListener('input', (e) => enviar({ t: 'txt', v: e.target.value }));
$('#campo-cel').addEventListener('submit', (e) => { e.preventDefault(); enviar({ t: 'txt', v: $('#txt-cel').value, enviar: 1 }); $('#txt-cel').blur(); vibrar(); });

// ---------- botões ----------
for (const b of document.querySelectorAll('[data-acao]')) {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault(); vibrar(); b.classList.add('ativo');
    enviar({ t: 'a', a: b.dataset.acao, ...(b.dataset.v ? { v: +b.dataset.v } : {}) });
  });
  const solta = () => b.classList.remove('ativo');
  b.addEventListener('pointerup', solta); b.addEventListener('pointercancel', solta); b.addEventListener('pointerleave', solta);
}
for (const b of document.querySelectorAll('[data-nav]')) {
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); vibrar(); b.classList.add('ativo'); enviar({ t: 'n', d: b.dataset.nav }); });
  const solta = () => b.classList.remove('ativo');
  b.addEventListener('pointerup', solta); b.addEventListener('pointercancel', solta); b.addEventListener('pointerleave', solta);
}
const segurando = new Set();
for (const b of document.querySelectorAll('[data-segurar]')) {
  const nome = b.dataset.segurar;
  const on = (e) => { e.preventDefault(); if (segurando.has(nome)) return; segurando.add(nome); vibrar(); b.classList.add('ativo'); enviar({ t: 'b', b: nome, v: 1 }); };
  const off = () => { if (!segurando.delete(nome)) return; b.classList.remove('ativo'); enviar({ t: 'b', b: nome, v: 0 }); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
}

// ---------- alavanca (andar) ----------
const RAIO = 55;
const joy = { id: null, x0: 0, y0: 0, dx: 0, dy: 0 };
const base = $('#joy-base'), pino = $('#joy-pino2'), areaAndar = $('#area-andar');
let ultimoMov = '', ultimoEnvio = 0;
function mandarMov(forcar) {
  const f = +(-joy.dy).toFixed(2), l = +joy.dx.toFixed(2), c = Math.hypot(joy.dx, joy.dy) > 0.97 ? 1 : 0;
  const txt = f + ',' + l + ',' + c, agora = performance.now();
  // manda quando muda (até 30 por segundo) e repete de vez em quando para a TV saber que o sinal está vivo
  if (forcar || (txt !== ultimoMov && agora - ultimoEnvio > 33) || (joy.id !== null && agora - ultimoEnvio > 400)) {
    ultimoMov = txt; ultimoEnvio = agora; enviar({ t: 'm', f, l, c });
  }
}
areaAndar.addEventListener('pointerdown', (e) => {
  if (joy.id !== null) return;
  e.preventDefault();
  areaAndar.setPointerCapture(e.pointerId);
  const r = areaAndar.getBoundingClientRect();
  joy.id = e.pointerId; joy.x0 = e.clientX; joy.y0 = e.clientY; joy.dx = joy.dy = 0;
  base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px';
  pino.style.transform = 'translate(-50%,-50%)';
});
areaAndar.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.x0, dy = e.clientY - joy.y0;
  const d = Math.hypot(dx, dy);
  if (d > RAIO) { dx *= RAIO / d; dy *= RAIO / d; }
  joy.dx = dx / RAIO; joy.dy = dy / RAIO;
  pino.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  mandarMov();
});
const fimJoy = (e) => {
  if (e.pointerId !== joy.id) return;
  joy.id = null; joy.dx = joy.dy = 0; pino.style.transform = 'translate(-50%,-50%)';
  mandarMov(true);
};
areaAndar.addEventListener('pointerup', fimJoy); areaAndar.addEventListener('pointercancel', fimJoy);

// ---------- olhar (arrastar), usar (toque) e quebrar (segurar) ----------
const areaOlhar = $('#area-olhar');
const olho = { id: null, x: 0, y: 0, x0: 0, y0: 0, t0: 0, moveu: false, quebrando: false, timer: null, gx: 0, gy: 0 };
areaOlhar.addEventListener('pointerdown', (e) => {
  if (olho.id !== null) return;
  e.preventDefault();
  areaOlhar.setPointerCapture(e.pointerId);
  Object.assign(olho, { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moveu: false, quebrando: false });
  clearTimeout(olho.timer);
  olho.timer = setTimeout(() => { if (olho.id !== null && !olho.moveu) { olho.quebrando = true; vibrar(25); enviar({ t: 'b', b: 'quebrar', v: 1 }); } }, 380);
});
areaOlhar.addEventListener('pointermove', (e) => {
  if (e.pointerId !== olho.id) return;
  olho.gx += (e.clientX - olho.x) * SENS; olho.gy += (e.clientY - olho.y) * SENS;
  olho.x = e.clientX; olho.y = e.clientY;
  if (Math.hypot(olho.x - olho.x0, olho.y - olho.y0) > 12) { olho.moveu = true; if (!olho.quebrando) clearTimeout(olho.timer); }
});
const fimOlho = (e) => {
  if (e.pointerId !== olho.id) return;
  clearTimeout(olho.timer);
  if (olho.quebrando) enviar({ t: 'b', b: 'quebrar', v: 0 });
  else if (!olho.moveu && performance.now() - olho.t0 < 380) { vibrar(); enviar({ t: 'a', a: 'usar' }); }
  olho.id = null; olho.quebrando = false;
};
areaOlhar.addEventListener('pointerup', fimOlho); areaOlhar.addEventListener('pointercancel', fimOlho);
// o olhar vai junto, até 30 vezes por segundo
setInterval(() => {
  if (Math.abs(olho.gx) + Math.abs(olho.gy) > 0.0005) {
    enviar({ t: 'g', x: +olho.gx.toFixed(4), y: +olho.gy.toFixed(4) });
    olho.gx = olho.gy = 0;
  }
  if (joy.id !== null) mandarMov();
}, 33);

function soltarTudo() {
  if (joy.id !== null || ultimoMov !== '0,0,0') { joy.id = null; joy.dx = joy.dy = 0; pino.style.transform = 'translate(-50%,-50%)'; mandarMov(true); }
  for (const n of [...segurando]) { segurando.delete(n); enviar({ t: 'b', b: n, v: 0 }); }
  document.querySelectorAll('.bc.ativo').forEach((b) => b.classList.remove('ativo'));
  if (olho.quebrando) enviar({ t: 'b', b: 'quebrar', v: 0 });
  clearTimeout(olho.timer); olho.id = null; olho.quebrando = false;
}

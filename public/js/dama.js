// Página da Dama: contra o computador (3 níveis) ou online com um amigo (convite pelo saguão).
// Regras brasileiras em dama-regras.js (as mesmas do servidor, sala-worker/src/partida.js). Sem three.js: leve para tablet fraco.
// Feita a partir da página do xadrez (xadrez.js): mesma tela, mesmos botões, outras regras e peças.
import * as X from './dama-regras.js';
import { conta } from './rede.js';
import { icone, preencherIcones, comIcone } from './icones.js';
import { Lobby } from './lobby.js';
import { criarAmigos } from './amigos.js';
import { jogo as dadosJogo } from './jogos.js';

const $ = (s) => document.querySelector(s);
preencherIcones();

// ---------- desenho das peças (SVG próprio): disco com frisos; a dama ganha uma coroa ----------
export function svgPeca(p) {
  const branca = p.toLowerCase() === 'w', d = p === 'W' || p === 'B';
  const f = branca ? '#fffaf0' : '#d23b44', f2 = branca ? '#e9dcc0' : '#a8303a', s = '#3b2f22';
  const coroa = d ? `<path d="M13 22.5l-1.5-8 4.5 4 4-6 4 6 4.5-4-1.5 8z" fill="#ffd23f" stroke="${s}" stroke-width="1.6" stroke-linejoin="round"/>` : `<circle cx="20" cy="19" r="5.5" fill="none" stroke="${f2}" stroke-width="2"/>`;
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><ellipse cx="20" cy="23.5" rx="14" ry="10" fill="${f2}" stroke="${s}" stroke-width="2"/><ellipse cx="20" cy="19.5" rx="14" ry="10" fill="${f}" stroke="${s}" stroke-width="2"/><ellipse cx="20" cy="19.5" rx="10" ry="7" fill="none" stroke="${f2}" stroke-width="1.6"/>${coroa}</svg>`;
}
const nomePeca = (p) => (p === 'W' || p === 'B' ? 'dama' : 'peça') + (p.toLowerCase() === 'w' ? ' branca' : ' vermelha');
const nomeCasa = (i) => 'abcdefgh'[i & 7] + (8 - (i >> 3));

// ---------- aviso ----------
let timerAviso;
function aviso(txt, ms = 1800, ic = null) {
  const el = $('#aviso'); el.innerHTML = comIcone(ic, txt); el.classList.add('mostra');
  clearTimeout(timerAviso); timerAviso = setTimeout(() => el.classList.remove('mostra'), ms);
}

// ---------- estado ----------
const CHAVE = 'pradaria.dama';
let modo = null; // 'pc' | 'online'
let e = X.novo();
let voce = 'w';
let nivel = 2;
let sel = -1, alvos = [];
let girado = false;
let fimAtual = null;
let pensando = false;
let online = null; // { ws, codigo, jogadores, empate, revanche }
let fimVisto = null;

function salvarPC() {
  if (modo !== 'pc') return;
  try { localStorage.setItem(CHAVE, JSON.stringify({ e: { ...X.publico(e), rep: e.rep }, voce, nivel, fim: fimAtual })); } catch {}
}
function lerPC() { try { const o = JSON.parse(localStorage.getItem(CHAVE) || 'null'); return o && o.e && !o.fim ? o : null; } catch { return null; } }

// ---------- desenhar ----------
const tab = $('#tabuleiro');
const casas = [];
for (let k = 0; k < 64; k++) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'casa'; b.setAttribute('role', 'gridcell');
  b.addEventListener('click', () => tocar(+b.dataset.i));
  casas.push(b); tab.appendChild(b);
}
const meuLado = () => (modo === 'online' ? voce || 'w' : voce);

function desenhar() {
  const baixo = meuLado();
  const virar = (baixo === 'b') !== girado;
  const xeque = -1;
  const ult = e.ultimo;
  const caminhoUlt = ult ? ult.caminho : [];
  for (let k = 0; k < 64; k++) {
    const i = virar ? 63 - k : k;
    const c = casas[k];
    c.dataset.i = i;
    const l = i >> 3, co = i & 7;
    c.className = 'casa' + ((l + co) % 2 ? ' escura' : '') + (caminhoUlt.includes(i) ? ' ultimo' : '') + (i === sel ? ' sel' : '') + (i === xeque ? ' xeque' : '');
    const p = e.b[i];
    const pode = alvos.find((m) => m.caminho[m.caminho.length - 1] === i);
    if (pode) c.classList.add('pode'), pode.comidas.length && c.classList.add('come');
    if (alvos.some((m) => m.comidas.includes(i))) c.classList.add('vai-comer');
    let h = p ? svgPeca(p) : '';
    if (k % 8 === 0) h += `<span class="coord l">${8 - l}</span>`;
    if (k >= 56) h += `<span class="coord c">${'abcdefgh'[co]}</span>`;
    c.innerHTML = h;
    c.setAttribute('aria-label', nomeCasa(i) + (p ? ' ' + nomePeca(p) : ' vazia') + (pode ? ', pode ir' : ''));
  }
  desenharJogadores(baixo);
  status();
}

function comidas(corDeQuem) {
  // peças da cor "corDeQuem" que já foram comidas (cada lado começa com 12)
  const n = 12 - e.b.filter((x) => x && x.toLowerCase() === corDeQuem).length;
  return Array(n).fill(corDeQuem);
}
function desenharJogadores(baixo) {
  const cima = baixo === 'w' ? 'b' : 'w';
  const nome = (l) => {
    if (modo === 'pc') return l === voce ? 'Você' : 'Computador (' + ['', 'fácil', 'médio', 'difícil'][nivel] + ')';
    const j = online && online.jogadores && online.jogadores[l];
    if (!j) return 'Esperando seu amigo…';
    return (l === voce ? 'Você' : j.nome);
  };
  const on = (l) => (modo === 'pc' ? true : !!(online && online.jogadores && online.jogadores[l] && online.jogadores[l].online));
  for (const [el, l] of [[$('#x-cima'), cima], [$('#x-baixo'), baixo]]) {
    el.innerHTML = `<span class="bolinha${on(l) ? ' on' : ''}"></span><span class="n"></span><span class="pecas-comidas">${comidas(l === 'w' ? 'b' : 'w').map(svgPeca).join('')}</span>`;
    el.querySelector('.n').textContent = nome(l) + (l === 'w' ? ' (brancas)' : ' (vermelhas)');
  }
}

function status() {
  const s = $('#x-status');
  let t = '', minha = false;
  if (fimAtual) t = X.TEXTO_FIM[fimAtual.tipo] || 'Fim';
  else if (modo === 'online' && (!online.jogadores || !online.jogadores.b || !online.jogadores.w)) t = 'Esperando seu amigo entrar';
  else if (pensando) t = 'Computador pensando…';
  else if (e.vez === meuLado()) { t = X.lances(e)[0]?.comidas.length ? 'Tem que comer!' : 'Sua vez'; minha = true; }
  else t = modo === 'pc' ? 'Vez do computador' : 'Vez do seu amigo';
  if (modo === 'online' && online.empate && !fimAtual) t = online.empate === voce ? 'Você propôs empate' : 'Seu amigo propôs empate';
  s.textContent = t; s.classList.toggle('minha', minha);
  const esperando = modo === 'online' && online.jogadores && !online.jogadores[voce === 'w' ? 'b' : 'w'];
  $('#bt-chamar').hidden = !(modo === 'online' && esperando);
  $('#bt-empate').hidden = !(modo === 'online' && !fimAtual && !esperando);
  $('#bt-empate').textContent = online && online.empate && online.empate !== voce ? 'Aceitar empate' : 'Propor empate';
  $('#bt-desistir').hidden = !!fimAtual;
}

// ---------- jogar ----------
function podeMexer() {
  if (fimAtual || pensando) return false;
  if (modo === 'online' && (!online.jogadores || !online.jogadores.w || !online.jogadores.b)) return false;
  return e.vez === meuLado();
}
function tocar(i) {
  if (!podeMexer()) {
    if (modo === 'online' && !fimAtual && online.jogadores && online.jogadores.w && online.jogadores.b && e.b[i] && e.vez !== voce) aviso('Espere a vez do seu amigo', 1400, 'relogio');
    return;
  }
  const m = alvos.find((x) => x.caminho[x.caminho.length - 1] === i);
  if (sel >= 0 && m) { fazer(m); return; }
  const p = e.b[i];
  if (p && p.toLowerCase() === e.vez) {
    const ls = X.lances(e);
    sel = i; alvos = ls.filter((x) => x.caminho[0] === i);
    if (!alvos.length && ls[0] && ls[0].comidas.length) aviso('Você tem que comer com outra peça!', 1800, 'alvo');
  } else { sel = -1; alvos = []; }
  desenhar();
}
function fazer(m) {
  sel = -1; alvos = [];
  e = X.avancar(e, m);
  if (modo === 'online') { online.ws && online.ws.readyState === 1 && online.ws.send(JSON.stringify({ t: 'lance', caminho: m.caminho })); desenhar(); return; }
  fimAtual = X.fim(e);
  salvarPC();
  desenhar();
  if (fimAtual) mostrarFim();
  else vezDoComputador();
}
function vezDoComputador() {
  if (modo !== 'pc' || fimAtual || e.vez === voce) return;
  pensando = true; status();
  // um tempinho para a tela mostrar o lance antes de o computador pensar
  setTimeout(() => {
    const m = X.melhorLance(e, nivel);
    pensando = false;
    if (modo !== 'pc' || !m) { desenhar(); return; }
    e = X.avancar(e, m);
    fimAtual = X.fim(e);
    salvarPC();
    desenhar();
    if (fimAtual) mostrarFim();
  }, 450);
}

function mostrarFim() {
  const f = fimAtual;
  const venci = f.vencedor && f.vencedor === meuLado();
  $('#fim-titulo').textContent = !f.vencedor ? 'Empate!' : venci ? 'Você ganhou!' : 'Você perdeu';
  let txt = X.TEXTO_FIM[f.tipo] || '';
  if (f.tipo === 'desistiu') txt = f.quem === meuLado() ? 'Você desistiu.' : (modo === 'pc' ? 'O computador desistiu.' : 'Seu amigo desistiu.');
  $('#fim-txt').textContent = txt;
  $('#bt-revanche').textContent = modo === 'online' ? 'Jogar de novo (trocando de cor)' : 'Jogar de novo';
  $('#fim-espera').hidden = true;
  $('#x-fim').hidden = false;
}

// ---------- menu ----------
function marcar(sel, attr, v) { document.querySelectorAll(sel).forEach((b) => { const s = b.dataset[attr] === String(v); b.classList.toggle('sel', s); b.setAttribute('aria-checked', s); }); }
document.querySelectorAll('.nivel').forEach((b) => b.addEventListener('click', () => { nivel = +b.dataset.nivel; marcar('.nivel', 'nivel', nivel); }));
document.querySelectorAll('.cor-peca').forEach((b) => b.addEventListener('click', () => { voce = b.dataset.cor; marcar('.cor-peca', 'cor', voce); }));
marcar('.nivel', 'nivel', nivel); marcar('.cor-peca', 'cor', voce);

function abrirMenu() {
  fecharOnline();
  modo = null;
  $('#x-jogo').hidden = true; $('#x-fim').hidden = true;
  $('#x-menu').hidden = false;
  $('#bt-continuar').hidden = !lerPC();
  $('#x-sem-conta').hidden = !!conta.token;
  $('#bt-amigo').disabled = !conta.token;
  history.replaceState(null, '', location.pathname);
  if (lobby) lobby.jogo('dama');
}
function comecarPC(guardado = null) {
  modo = 'pc'; girado = false; sel = -1; alvos = [];
  if (guardado) { e = X.deJson(guardado.e); voce = guardado.voce; nivel = guardado.nivel; fimAtual = null; }
  else { e = X.novo(); fimAtual = null; }
  $('#x-menu').hidden = true; $('#x-jogo').hidden = false;
  salvarPC();
  desenhar();
  vezDoComputador();
}
$('#bt-computador').addEventListener('click', () => comecarPC());
$('#bt-continuar').addEventListener('click', () => { const g = lerPC(); if (g) comecarPC(g); });
$('#bt-sair').addEventListener('click', () => abrirMenu());
$('#bt-girar').addEventListener('click', () => { girado = !girado; desenhar(); });
$('#bt-desistir').addEventListener('click', () => {
  if (fimAtual) return;
  const b = $('#bt-desistir');
  if (!b.classList.contains('confirmar')) { b.classList.add('confirmar'); b.textContent = 'Desistir mesmo?'; setTimeout(() => { b.classList.remove('confirmar'); b.textContent = 'Desistir'; }, 3000); return; }
  b.classList.remove('confirmar'); b.textContent = 'Desistir';
  if (modo === 'online') { online.ws && online.ws.send(JSON.stringify({ t: 'desistir' })); return; }
  fimAtual = { tipo: 'desistiu', vencedor: voce === 'w' ? 'b' : 'w', quem: voce };
  salvarPC(); desenhar(); mostrarFim();
});
$('#bt-empate').addEventListener('click', () => { if (online && online.ws) online.ws.send(JSON.stringify({ t: 'empate' })); });
$('#bt-revanche').addEventListener('click', () => {
  if (modo === 'pc') { $('#x-fim').hidden = true; comecarPC(); return; }
  online.ws && online.ws.send(JSON.stringify({ t: 'revanche' }));
  $('#fim-espera').hidden = false; $('#fim-espera').textContent = 'Esperando seu amigo topar…';
});
$('#bt-ver').addEventListener('click', () => { $('#x-fim').hidden = true; });
$('#bt-menu-fim').addEventListener('click', () => abrirMenu());

// ---------- online ----------
function fecharOnline() { if (online && online.ws) { online.fechado = true; try { online.ws.close(); } catch {} } online = null; }
function codigoNovo() { const L = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.getRandomValues(new Uint8Array(14))].map((x) => L[x % L.length]).join(''); }
function jogarOnline(codigo, chamar = false) {
  if (!conta.token) { $('#x-erro').textContent = 'Entre na sua conta para jogar com amigos.'; return; }
  fecharOnline();
  modo = 'online'; e = X.novo(); voce = 'w'; fimAtual = null; fimVisto = null; sel = -1; alvos = []; girado = false;
  online = { codigo, jogadores: null, tentativas: 0 };
  history.replaceState(null, '', '?sala=' + codigo);
  $('#x-menu').hidden = true; $('#x-jogo').hidden = false; $('#x-fim').hidden = true;
  desenhar();
  conectar();
  if (chamar) setTimeout(() => chamarAmigo(), 300);
}
function conectar() {
  const o = online;
  if (!o) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${proto}//${location.host}/api/partida/${o.codigo}?jogo=dama&t=${encodeURIComponent(conta.token)}`);
  o.ws = ws;
  ws.onopen = () => { o.tentativas = 0; };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (online !== o) return;
    if (m.t === 'erro') { o.fechado = true; abrirMenu(); $('#x-erro').textContent = m.msg; return; }
    if (m.t === 'aviso') { aviso(m.msg, 1800, 'relogio'); return; }
    if (m.t !== 'estado') return;
    const antes = o.jogadores;
    o.jogadores = m.jogadores; o.empate = m.empate; o.revanche = m.revanche;
    voce = m.voce || 'w';
    e = X.deJson(m.estado);
    fimAtual = m.fim;
    if (sel >= 0 && (e.vez !== voce)) { sel = -1; alvos = []; }
    else if (sel >= 0) alvos = X.lances(e).filter((x) => x.caminho[0] === sel);
    if (antes && m.n !== o.n) { $('#x-fim').hidden = true; fimVisto = null; aviso('Partida nova! Agora você joga de ' + (voce === 'w' ? 'brancas' : 'vermelhas'), 2500, 'dama'); }
    o.n = m.n;
    const outro = voce === 'w' ? 'b' : 'w';
    if (antes && !antes[outro] && m.jogadores[outro]) aviso(`${m.jogadores[outro].nome} chegou!`, 2200, 'acenar');
    desenhar();
    if (fimAtual && JSON.stringify(fimAtual) !== fimVisto) { fimVisto = JSON.stringify(fimAtual); mostrarFim(); }
    if (fimAtual && m.revanche && m.revanche.length === 1 && m.revanche[0] !== voce) { $('#fim-espera').hidden = false; $('#fim-espera').textContent = 'Seu amigo quer jogar de novo!'; }
  };
  ws.onclose = () => {
    if (online !== o || o.fechado) return;
    if (o.tentativas > 6) { abrirMenu(); $('#x-erro').textContent = 'A conexão com a partida caiu.'; return; }
    setTimeout(() => { if (online === o && !o.fechado) conectar(); }, Math.min(10000, 800 * 2 ** o.tentativas++));
  };
}
function chamarAmigo() {
  if (!amigos || !online) return;
  amigos.abrir({ jogo: 'dama', sala: online.codigo, titulo: 'Dama' });
}
$('#bt-amigo').addEventListener('click', () => jogarOnline(codigoNovo(), true));
$('#bt-chamar').addEventListener('click', () => chamarAmigo());

// ---------- saguão e amigos ----------
let lobby = null, amigos = null;
if (conta.token) {
  lobby = new Lobby('dama');
  amigos = criarAmigos({
    lobby, aviso,
    aceitarConvite(m) {
      const j = dadosJogo(m.jogo);
      if (m.jogo === 'dama') { jogarOnline(m.sala); return; }
      if (m.jogo === 'pradaria') { location.href = '/?mundo=' + encodeURIComponent(m.sala); return; }
      if (j && j.pronto) location.href = j.abrir + '?sala=' + encodeURIComponent(m.sala);
    },
  });
  amigos.carregar();
}

// ---------- início ----------
const pedida = new URLSearchParams(location.search).get('sala');
if (pedida && /^[A-Za-z0-9]{10,24}$/.test(pedida) && conta.token) jogarOnline(pedida);
else abrirMenu();

// para os testes automáticos (testes/teste-dama.mjs)
window.__dama = { get e() { return e; }, get voce() { return voce; }, get modo() { return modo; }, get fim() { return fimAtual; }, get online() { return online; }, X, set nivel(v) { nivel = v; }, fazer };
void icone;

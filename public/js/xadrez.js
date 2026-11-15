// Página do Xadrez: contra o computador (3 níveis) ou online com um amigo (convite pelo saguão).
// Regras em xadrez-regras.js (as mesmas do servidor, sala-worker/src/partida.js). Sem three.js: leve para tablet fraco.
import * as X from './xadrez-regras.js';
import { conta } from './rede.js';
import { icone, preencherIcones, comIcone } from './icones.js';
import { Lobby } from './lobby.js';
import { somDaPagina } from './som.js';

// sons: peça de madeira na casa, "toc-toc" ao comer, aviso de xeque e o fim da partida
const som = somDaPagina();
let tabAntes = null;
function somDoTabuleiro() {
  const pecas = e.b.filter(Boolean).length, sig = e.b.join(',');
  if (tabAntes && sig !== tabAntes.sig && pecas <= tabAntes.pecas) {
    som.peca(pecas < tabAntes.pecas);
    if (!fimAtual && X.emXeque(e)) setTimeout(() => som.xeque(), 120);
  }
  tabAntes = { sig, pecas };
}
import { criarAmigos } from './amigos.js';
import { jogo as dadosJogo } from './jogos.js';

const $ = (s) => document.querySelector(s);
preencherIcones();

// ---------- desenho das peças (SVG próprio, viewBox 40) ----------
const BASE = 'M9 31.5h22a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 1-1.5 1.5h-23A1.5 1.5 0 0 1 7 35v-1.5a2 2 0 0 1 2-2z';
// cada parte: [d, tipo] com tipo c = corpo (cor da peça), l = linha de detalhe, o = olho/bolinha de detalhe
const FORMA = {
  P: [['M20 8.5a5 5 0 1 1 0 10a5 5 0 1 1 0-10z', 'c'], ['M13.5 31.5c0-6 2.5-9.5 6.5-11.5 4 2 6.5 5.5 6.5 11.5z', 'c']],
  R: [['M11.5 8h3.5v3h3V8h4v3h3V8h3.5v6.5l-3 3v14H14.5v-14l-3-3z', 'c'], ['M14.5 17.5h11', 'l']],
  N: [['M13 31.5c0-7 1.5-10 5.5-13.5-2.5 1-5.5 1.5-7.5-.5l6.5-8.5c1-1.5 2.5-2.5 3.5-2.5l1 3c5.5 2 7.5 8 7 22z', 'c'], ['M18.2 12.2a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0-2.8 0z', 'o']],
  B: [['M15 25.5h10l2 6H13z', 'c'], ['M20 7c-5 5-7.5 9-7.5 13 0 3.5 3 5.5 7.5 5.5s7.5-2 7.5-5.5c0-4-2.5-8-7.5-13z', 'c'], ['M21.5 12.5l-4 5', 'l'], ['M18 5.3a2 2 0 1 0 4 0a2 2 0 1 0-4 0z', 'c']],
  Q: [['M10.5 30.5l-2.5-17 6.5 8 1.5-12.5 4 11.5 4-11.5 1.5 12.5 6.5-8-2.5 17z', 'c'], ['M6.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0zM12.7 8a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0zM18.2 7a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0zM23.7 8a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0zM30.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0z', 'c']],
  K: [['M12 30.5c-3.5-6-3.5-12.5 2-14.5 3-1 5 1 6 3 1-2 3-4 6-3 5.5 2 5.5 8.5 2 14.5z', 'c'], ['M20 4v10M16.5 7.5h7', 'x'], ['M13 25.5h14', 'l']],
};
export function svgPeca(p) {
  const t = p.toUpperCase(), branca = p === t;
  const f = branca ? '#fffaf0' : '#3b2f22', s = branca ? '#3b2f22' : '#1c140c', det = branca ? '#3b2f22' : '#f6ead0';
  const partes = FORMA[t].map(([d, k]) => k === 'c' ? `<path d="${d}" fill="${f}" stroke="${s}" stroke-width="2" stroke-linejoin="round"/>`
    : k === 'o' ? `<path d="${d}" fill="${det}"/>`
    : k === 'x' ? `<path d="${d}" fill="none" stroke="${s}" stroke-width="2.4" stroke-linecap="round"/>`
    : `<path d="${d}" fill="none" stroke="${det}" stroke-width="1.8" stroke-linecap="round"/>`).join('');
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="${BASE}" fill="${f}" stroke="${s}" stroke-width="2"/>${partes}</svg>`;
}
const NOME = { P: 'peão', N: 'cavalo', B: 'bispo', R: 'torre', Q: 'dama', K: 'rei' };
const nomePeca = (p) => NOME[p.toUpperCase()] + (p === p.toUpperCase() ? ' branco' : ' preto').replace('dama branco', 'dama branca').replace('dama preto', 'dama preta').replace('torre branco', 'torre branca').replace('torre preto', 'torre preta');

// ---------- aviso ----------
let timerAviso;
function aviso(txt, ms = 1800, ic = null) {
  const el = $('#aviso'); el.innerHTML = comIcone(ic, txt); el.classList.add('mostra');
  clearTimeout(timerAviso); timerAviso = setTimeout(() => el.classList.remove('mostra'), ms);
}

// ---------- estado ----------
const CHAVE = 'pradaria.xadrez';
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
let ritmo = '3+2'; // ritmo escolhido para jogar com amigo ('' = sem relógio)
let relogio = null; // { w, b (ms que sobram), anda: 'w'|'b'|null, base, inc } + recebido (hora local em que chegou)
let pre = null; // pré-lance { de, para } que vale quando chegar a minha vez
let modoPre = false; // as casas marcadas são de pré-lance
let preFeitos = 0; // quantos pré-lances já saíram sozinhos (para os testes)

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
  somDoTabuleiro();
  const baixo = meuLado();
  const virar = (baixo === 'b') !== girado;
  const xeque = !fimAtual || fimAtual.tipo === 'mate' ? (X.emXeque(e) ? e.b.indexOf(e.vez === 'w' ? 'K' : 'k') : -1) : -1;
  const ult = e.ultimo;
  for (let k = 0; k < 64; k++) {
    const i = virar ? 63 - k : k;
    const c = casas[k];
    c.dataset.i = i;
    const l = i >> 3, co = i & 7;
    c.className = 'casa' + ((l + co) % 2 ? ' escura' : '') + (ult && (ult.de === i || ult.para === i) ? ' ultimo' : '') + (i === sel ? ' sel' : '') + (i === xeque ? ' xeque' : '') + (pre && (pre.de === i || pre.para === i) ? ' pre' : '');
    const p = e.b[i];
    const pode = alvos.find((m) => m.para === i);
    if (pode) c.classList.add('pode'), (p || pode.ep) && c.classList.add('come');
    let h = p ? svgPeca(p) : '';
    if (k % 8 === 0) h += `<span class="coord l">${8 - l}</span>`;
    if (k >= 56) h += `<span class="coord c">${'abcdefgh'[co]}</span>`;
    c.innerHTML = h;
    c.setAttribute('aria-label', X.nomeCasa(i) + (p ? ' ' + nomePeca(p) : ' vazia') + (pode ? ', pode ir' : ''));
  }
  desenharJogadores(baixo);
  desenharLances();
  status();
}

// lista de lances: "1. e4 e5 2. Cf3 …" (o último fica marcado)
let lancesVistos = -1;
function desenharLances() {
  const h = e.hist || [];
  if (h.length === lancesVistos) return;
  lancesVistos = h.length;
  const el = $('#x-lances');
  el.innerHTML = h.map((t, k) => (k % 2 === 0 ? `<span class="num">${k / 2 + 1}.</span>` : '') + `<span class="lance${k === h.length - 1 ? ' ult' : ''}">${t}</span>`).join('');
  el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight;
}

function comidas(corDeQuem) {
  // peças da cor "corDeQuem" que já saíram do tabuleiro
  const inicio = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
  const out = [];
  for (const t of 'QRBNP') {
    const p = corDeQuem === 'w' ? t : t.toLowerCase();
    const n = inicio[t] - e.b.filter((x) => x === p).length;
    for (let k = 0; k < n; k++) out.push(p);
  }
  return out;
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
    el.innerHTML = `<span class="bolinha${on(l) ? ' on' : ''}"></span><span class="n"></span><span class="pecas-comidas">${comidas(l === 'w' ? 'b' : 'w').map(svgPeca).join('')}</span>` + (modo === 'online' && relogio ? `<span class="relogio" data-cor="${l}"></span>` : '');
    el.querySelector('.n').textContent = nome(l) + (l === 'w' ? ' (brancas)' : ' (pretas)');
  }
  mostrarRelogios();
}

// ---------- relógio ----------
const fmt = (ms) => { const t = Math.max(0, ms); if (t < 20000) return (t / 1000).toFixed(1); const s = Math.ceil(t / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function tempoDe(c) {
  if (!relogio) return 0;
  return relogio.anda === c ? relogio[c] - (performance.now() - relogio.recebido) : relogio[c];
}
let pediuTempo = 0;
function mostrarRelogios() {
  if (!relogio) return;
  for (const el of document.querySelectorAll('.relogio')) {
    const c = el.dataset.cor, t = tempoDe(c);
    el.textContent = fmt(t);
    el.classList.toggle('anda', relogio.anda === c && !fimAtual);
    el.classList.toggle('pouco', t < 20000 && relogio.anda === c && !fimAtual);
  }
  // zerou: pede para o servidor conferir (ele também confere sozinho)
  if (relogio.anda && !fimAtual && tempoDe(relogio.anda) <= 0 && performance.now() - pediuTempo > 1500 && online && online.ws && online.ws.readyState === 1) { pediuTempo = performance.now(); online.ws.send(JSON.stringify({ t: 'tempo' })); }
}
setInterval(() => { if (modo === 'online' && relogio && relogio.anda && !fimAtual) mostrarRelogios(); }, 100);

function status() {
  const s = $('#x-status');
  let t = '', minha = false;
  if (fimAtual) t = X.TEXTO_FIM[fimAtual.tipo] || 'Fim';
  else if (modo === 'online' && (!online.jogadores || !online.jogadores.b || !online.jogadores.w)) t = 'Esperando seu amigo entrar';
  else if (pensando) t = 'Computador pensando…';
  else if (e.vez === meuLado()) { t = X.emXeque(e) ? 'Xeque! Sua vez' : 'Sua vez'; minha = true; }
  else t = modo === 'pc' ? 'Vez do computador' : X.emXeque(e) ? 'Xeque! Vez do amigo' : 'Vez do seu amigo';
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
// pré-lance: na vez do outro dá para escolher o próximo lance; ele sai sozinho quando chegar a sua vez
function podePre() {
  if (fimAtual) return false;
  if (modo === 'online') return !!(online.jogadores && online.jogadores.w && online.jogadores.b) && e.vez !== voce;
  return modo === 'pc' && e.vez !== voce;
}
function tocarPre(i) {
  const lado = meuLado();
  const m = modoPre && sel >= 0 && alvos.find((x) => x.para === i);
  if (m) { pre = { de: m.de, para: m.para }; sel = -1; alvos = []; modoPre = false; desenhar(); return; }
  const p = e.b[i];
  pre = null;
  if (p && (p === p.toUpperCase() ? 'w' : 'b') === lado && i !== sel) { sel = i; alvos = X.preLances(e, lado, i); modoPre = true; }
  else { sel = -1; alvos = []; modoPre = false; if (p && (p === p.toUpperCase() ? 'w' : 'b') !== lado && modo === 'online') aviso('Espere a vez do seu amigo', 1400, 'relogio'); }
  desenhar();
}
// chegou a minha vez: faz o pré-lance se ainda valer (promoção vira dama)
function tentarPre() {
  if (!pre || fimAtual || e.vez !== meuLado()) return false;
  const p = pre; pre = null;
  if (sel >= 0 && modoPre) { sel = -1; alvos = []; modoPre = false; }
  const m = X.achar(e, p.de, p.para, 'Q');
  if (!m) { aviso('Pré-lance cancelado: não vale mais', 1600, 'relogio'); desenhar(); return false; }
  preFeitos++;
  fazer(m.de, m.para, 'Q');
  return true;
}
function tocar(i) {
  if (!podeMexer()) {
    if (podePre()) tocarPre(i);
    return;
  }
  if (modoPre) { sel = -1; alvos = []; modoPre = false; }
  const m = alvos.find((x) => x.para === i);
  if (sel >= 0 && m) { escolherPromo(m).then((pr) => { if (pr) fazer(m.de, m.para, pr); }); return; }
  const p = e.b[i];
  if (p && (p === p.toUpperCase() ? 'w' : 'b') === e.vez) { sel = i; alvos = X.lances(e).filter((x) => x.de === i); }
  else { sel = -1; alvos = []; }
  desenhar();
}
function escolherPromo(m) {
  if (!m.promo) return Promise.resolve('Q');
  return new Promise((ok) => {
    const caixa = $('#promo-pecas'); caixa.innerHTML = '';
    for (const t of 'QRBN') {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = svgPeca(e.vez === 'w' ? t : t.toLowerCase()); b.setAttribute('aria-label', NOME[t]);
      b.addEventListener('click', () => { $('#promo').hidden = true; ok(t); });
      caixa.appendChild(b);
    }
    $('#promo').hidden = false;
  });
}
function fazer(de, para, promo) {
  const m = X.achar(e, de, para, promo);
  if (!m) return;
  sel = -1; alvos = [];
  e = X.avancar(e, m);
  if (modo === 'online') { online.ws && online.ws.readyState === 1 && online.ws.send(JSON.stringify({ t: 'lance', de, para, promo })); desenhar(); return; }
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
    else tentarPre();
  }, 450);
}

function mostrarFim() {
  const f = fimAtual;
  const venci = f.vencedor && f.vencedor === meuLado();
  som.fim(!f.vencedor ? 'empate' : venci ? 'ganhou' : 'perdeu');
  $('#fim-titulo').textContent = !f.vencedor ? 'Empate!' : venci ? 'Você ganhou!' : 'Você perdeu';
  let txt = X.TEXTO_FIM[f.tipo] || '';
  if (f.tipo === 'desistiu') txt = f.quem === meuLado() ? 'Você desistiu.' : (modo === 'pc' ? 'O computador desistiu.' : 'Seu amigo desistiu.');
  if (f.tipo === 'tempo') txt = f.quem === meuLado() ? 'Seu tempo acabou.' : 'O tempo do seu amigo acabou.';
  $('#fim-txt').textContent = txt;
  $('#bt-revanche').textContent = modo === 'online' ? 'Jogar de novo (trocando de cor)' : 'Jogar de novo';
  $('#fim-espera').hidden = true;
  $('#x-fim').hidden = false;
}

// ---------- menu ----------
function marcar(sel, attr, v) { document.querySelectorAll(sel).forEach((b) => { const s = b.dataset[attr] === String(v); b.classList.toggle('sel', s); b.setAttribute('aria-checked', s); }); }
document.querySelectorAll('.nivel').forEach((b) => b.addEventListener('click', () => { nivel = +b.dataset.nivel; marcar('.nivel', 'nivel', nivel); }));
document.querySelectorAll('.cor-peca').forEach((b) => b.addEventListener('click', () => { voce = b.dataset.cor; marcar('.cor-peca', 'cor', voce); }));
document.querySelectorAll('.ritmo').forEach((b) => b.addEventListener('click', () => { ritmo = b.dataset.ritmo; marcar('.ritmo', 'ritmo', ritmo); try { localStorage.setItem('pradaria.xadrez.ritmo', ritmo); } catch {} }));
try { const r = localStorage.getItem('pradaria.xadrez.ritmo'); if (r !== null && (r === '' || X.RITMOS[r])) ritmo = r; } catch {}
marcar('.nivel', 'nivel', nivel); marcar('.cor-peca', 'cor', voce); marcar('.ritmo', 'ritmo', ritmo);

function abrirMenu() {
  fecharOnline();
  modo = null;
  $('#x-jogo').hidden = true; $('#x-fim').hidden = true; $('#promo').hidden = true;
  $('#x-menu').hidden = false;
  $('#bt-continuar').hidden = !lerPC();
  $('#x-sem-conta').hidden = !!conta.token;
  $('#bt-amigo').disabled = !conta.token;
  history.replaceState(null, '', location.pathname);
  if (lobby) lobby.jogo('xadrez');
}
function comecarPC(guardado = null) {
  modo = 'pc'; girado = false; sel = -1; alvos = []; pre = null; modoPre = false; relogio = null; lancesVistos = -1;
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
function jogarOnline(codigo, chamar = false, criar = false) {
  if (!conta.token) { $('#x-erro').textContent = 'Entre na sua conta para jogar com amigos.'; return; }
  fecharOnline();
  modo = 'online'; e = X.novo(); voce = 'w'; fimAtual = null; fimVisto = null; sel = -1; alvos = []; girado = false;
  online = { codigo, jogadores: null, tentativas: 0, ritmo: criar ? ritmo : '' };
  relogio = null; pre = null; modoPre = false; lancesVistos = -1;
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
  const ws = new WebSocket(`${proto}//${location.host}/api/partida/${o.codigo}?jogo=xadrez${o.ritmo ? '&ritmo=' + encodeURIComponent(o.ritmo) : ''}&t=${encodeURIComponent(conta.token)}`);
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
    relogio = m.relogio ? { ...m.relogio, recebido: performance.now() } : null;
    if (fimAtual) { pre = null; if (modoPre) { sel = -1; alvos = []; modoPre = false; } }
    if (modoPre) { if (sel >= 0) alvos = X.preLances(e, voce, sel); }
    else if (sel >= 0 && (e.vez !== voce)) { sel = -1; alvos = []; }
    else if (sel >= 0) alvos = X.lances(e).filter((x) => x.de === sel);
    if (antes && m.n !== o.n) { $('#x-fim').hidden = true; fimVisto = null; aviso('Partida nova! Agora você joga de ' + (voce === 'w' ? 'brancas' : 'pretas'), 2500, 'xadrez'); }
    o.n = m.n;
    const outro = voce === 'w' ? 'b' : 'w';
    if (antes && !antes[outro] && m.jogadores[outro]) aviso(`${m.jogadores[outro].nome} chegou!`, 2200, 'acenar');
    desenhar();
    if (!fimAtual && e.vez === voce && pre) tentarPre();
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
  amigos.abrir({ jogo: 'xadrez', sala: online.codigo, titulo: 'Xadrez' });
}
$('#bt-amigo').addEventListener('click', () => jogarOnline(codigoNovo(), true, true));
$('#bt-chamar').addEventListener('click', () => chamarAmigo());

// ---------- saguão e amigos ----------
let lobby = null, amigos = null;
if (conta.token) {
  lobby = new Lobby('xadrez');
  amigos = criarAmigos({
    lobby, aviso, som: () => som.clique(), somConvite: () => som.convite(), somAviso: () => som.aviso(),
    aceitarConvite(m) {
      const j = dadosJogo(m.jogo);
      if (m.jogo === 'xadrez') { jogarOnline(m.sala); return; }
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

// para os testes automáticos (testes/teste-xadrez.mjs)
window.__xadrez = { get e() { return e; }, get voce() { return voce; }, get modo() { return modo; }, get fim() { return fimAtual; }, get online() { return online; }, get relogio() { return relogio; }, get pre() { return pre; }, get preFeitos() { return preFeitos; }, set ritmo(v) { ritmo = v; }, X, set nivel(v) { nivel = v; }, fazer };
void icone;

// Página do Truco paulista: contra o computador (um contra um ou em dupla) ou online com amigos (mesa de 2 ou 4;
// as vagas que sobrarem ficam com o computador). Um contra um pode valer pontos (com amigo ou procurando adversário). Regras em truco-regras.js (as mesmas do servidor, sala-worker/src/partida.js).
// Sem three.js: leve para tablet fraco. As cartas são desenhos próprios (SVG), sem imagens.
import * as T from './truco-regras.js';
import * as P from './pontos-regras.js';
import { conta } from './rede.js';
import { preencherIcones, comIcone } from './icones.js';
import { Lobby } from './lobby.js';
import { criarAmigos } from './amigos.js';
import { jogo as dadosJogo } from './jogos.js';

const $ = (s) => document.querySelector(s);
preencherIcones();

// ---------- cartas (desenho próprio) ----------
const NAIPE_SVG = {
  o: '<path d="M10 1.5L17.5 10 10 18.5 2.5 10z"/>',
  c: '<path d="M10 18C4.2 13.4 1.5 10.4 1.5 6.8a4.3 4.3 0 0 1 8.5-1 4.3 4.3 0 0 1 8.5 1c0 3.6-2.7 6.6-8.5 11.2z"/>',
  e: '<path d="M10 1.5c3.8 4.6 8.5 7.4 8.5 11a3.9 3.9 0 0 1-7 2.3l1.4 3.7H7.1l1.4-3.7a3.9 3.9 0 0 1-7-2.3c0-3.6 4.7-6.4 8.5-11z"/>',
  p: '<circle cx="10" cy="5.6" r="3.9"/><circle cx="5.2" cy="11.2" r="3.9"/><circle cx="14.8" cy="11.2" r="3.9"/><path d="M9 10.5h2l1.6 8H7.4z"/>',
};
const vermelho = (c) => c[1] === 'o' || c[1] === 'c';
const naipe = (s, cls = '') => `<svg class="naipe ${cls}" viewBox="0 0 20 20" aria-hidden="true">${NAIPE_SVG[s]}</svg>`;
function cartaHtml(c, extra = '') {
  const v = c[0];
  return `<span class="carta ${vermelho(c) ? 'verm' : 'preta'} ${extra}"><span class="cv">${v}</span>${naipe(c[1], 'pq')}${naipe(c[1], 'gr')}</span>`;
}
const costas = () => '<span class="carta costas"></span>';
const nomeCarta = (c) => T.NOME_VALOR[c[0]] + ' de ' + T.NOME_NAIPE[c[1]];

// ---------- aviso ----------
let timerAviso;
function aviso(txt, ms = 1800, ic = null) {
  const el = $('#aviso'); el.innerHTML = comIcone(ic, txt); el.classList.add('mostra');
  clearTimeout(timerAviso); timerAviso = setTimeout(() => el.classList.remove('mostra'), ms);
}

// ---------- estado ----------
const CHAVE = 'pradaria.truco';
let modo = null; // 'pc' | 'online'
let nMesa = 2;
let e = null; // jogo inteiro (só no modo computador)
let v = null; // o que eu vejo (T.visao)
let eu = 0;
let lugares = []; // [{ nome, online, robo }]
let online = null; // { ws, codigo, dono, comecou, revanche, tentativas }
let vistoSeq = -1;
let rodadaAte = 0, rodadaMostrada = null;
let fimVisto = null;
let timerRobo = 0;
let tipoAmigo = 'amistosa'; // um contra um com amigo: 'amistosa' ou 'pontos'
let meusPontos = null; // { truco: { mostrar, ... } }
let busca = null; // procurando adversário: { ws, desde, timer }
let prazo = null; // online: { falta, total (ms), recebido } da jogada de agora; acabou, o computador joga por quem demorou

const time = T.time;
function salvarPC() { if (modo === 'pc' && e) try { localStorage.setItem(CHAVE, JSON.stringify({ e, n: nMesa })); } catch {} }
function lerPC() { try { const o = JSON.parse(localStorage.getItem(CHAVE) || 'null'); return o && o.e && !o.e.fim ? o : null; } catch { return null; } }

// ---------- quem é quem ----------
function posicao(l) {
  const r = (l - eu + v.n) % v.n;
  if (v.n === 2) return r === 0 ? 'baixo' : 'cima';
  return ['baixo', 'dir', 'cima', 'esq'][r];
}
function nome(l) {
  if (l === eu) return 'Você';
  const j = lugares[l];
  return j ? j.nome : 'Vaga';
}
const nos = () => time(eu);
function falaDe(ev) {
  const quem = (l) => (l === eu ? 'Você' : nome(l));
  if (ev.t === 'pediu') return { txt: `${quem(ev.lugar)}: ${T.NOME_APOSTA[ev.valor].toUpperCase()}!`, forte: true };
  if (ev.t === 'aceitou') return { txt: `${quem(ev.lugar)}: Aceito! Vale ${ev.valor}` };
  if (ev.t === 'correu') return { txt: `${quem(ev.lugar)} correu` };
  if (ev.t === 'onze') return { txt: ev.time === nos() ? (ev.jogar ? 'Vocês vão jogar a mão de onze (vale 3)' : 'Vocês correram da mão de onze') : (ev.jogar ? 'Eles vão jogar a mão de onze (vale 3)' : 'Eles correram da mão de onze') };
  if (ev.t === 'mao') {
    if (ev.time < 0) return { txt: 'Mão empatada: ninguém marca' };
    const p = ev.pontos + (ev.pontos === 1 ? ' ponto' : ' pontos');
    if (v.n === 2) return { txt: ev.time === nos() ? `Você ganhou ${p}` : `${nome((eu + 1) % 2)} ganhou ${p}`, bom: ev.time === nos() };
    return { txt: ev.time === nos() ? `Nós ganhamos ${p}` : `Eles ganharam ${p}`, bom: ev.time === nos() };
  }
  return null;
}

// ---------- desenhar ----------
function desenhar() {
  if (!v) return;
  const agora = Date.now();
  // eventos novos: fala do último importante e a rodada que acabou de fechar fica na mesa um pouco
  const novos = v.eventos.filter((x) => x.s > vistoSeq);
  if (vistoSeq >= 0 && novos.length) {
    const imp = [...novos].reverse().find((x) => ['pediu', 'aceitou', 'correu', 'mao', 'onze'].includes(x.t));
    const f = imp && falaDe(imp);
    if (f) mostrarFala(f);
    if (novos.some((x) => x.t === 'rodada') && v.ultimaRodada) { rodadaMostrada = v.ultimaRodada; rodadaAte = agora + 1600; setTimeout(desenhar, 1650); }
  }
  vistoSeq = v.seq;

  // placar
  const valor = v.valor;
  $('#t-placar').innerHTML = `<span class="pl nos"><b>${v.n === 2 ? 'Você' : 'Nós'}</b> ${v.pontos[nos()]}</span><span class="x">x</span><span class="pl eles">${v.pontos[1 - nos()]} <b>${v.n === 2 ? 'Ele' : 'Eles'}</b></span><span class="vale">Vale ${valor}</span>`;

  // lugares dos outros
  document.querySelectorAll('.t-lugar').forEach((el) => { el.hidden = true; });
  for (let l = 0; l < v.n; l++) {
    if (l === eu) continue;
    const el = document.querySelector(`.t-lugar[data-pos="${posicao(l)}"]`);
    el.hidden = false;
    const j = lugares[l];
    const vez = v.age.includes(l) && !v.fim;
    el.className = 't-lugar' + (vez ? ' vez' : '') + (time(l) === nos() ? ' parceiro' : '');
    el.innerHTML = `<div class="t-nome"><span class="bolinha${!j || j.online ? ' on' : ''}"></span><span class="n"></span>${l === v.dealer ? '<span class="dealer" title="Deu as cartas">D</span>' : ''}</div><div class="t-costas">${Array(v.quantas[l]).fill(0).map(costas).join('')}</div>`;
    el.querySelector('.n').textContent = nome(l) + (v.n === 4 && time(l) === nos() && !/parceiro/i.test(nome(l)) ? ' (parceiro)' : '');
    // valendo pontos: os pontos do adversário do lado do nome
    if (modo === 'online' && online.pontos && online.pontos[l]) el.querySelector('.t-nome').insertAdjacentHTML('beforeend', `<span class="pts">${online.pontos[l].mostrar}</span>`);
  }

  // vira e manilha
  $('#t-vira').innerHTML = `${cartaHtml(v.vira, 'peq')}<span class="t-vira-txt">Vira<br><b>Manilha: ${T.NOME_VALOR[v.manilha]}</b></span>`;

  // cartas na mesa (ou a rodada que acabou de fechar)
  const mostrandoRodada = !v.mesa.length && rodadaMostrada && agora < rodadaAte;
  const mesa = mostrandoRodada ? rodadaMostrada.mesa : v.mesa;
  $('#t-jogadas').innerHTML = mesa.map((j) => {
    const ganhou = mostrandoRodada && (rodadaMostrada.time === -1 ? false : j.lugar === rodadaMostrada.lugar);
    return `<span class="jogada pos-${posicao(j.lugar)}${ganhou ? ' ganhou' : ''}">${cartaHtml(j.carta, j.carta[0] === v.manilha ? 'manilha' : '')}</span>`;
  }).join('');

  // rodadas da mão
  $('#t-rodadas').innerHTML = [0, 1, 2].map((i) => {
    const t = v.vazas[i];
    const c = t === undefined ? '' : t === -1 ? ' empate' : t === nos() ? ' nossa' : ' deles';
    return `<span class="rod${c}"></span>`;
  }).join('');

  // minhas cartas
  const possoJogar = podeJogar();
  $('#t-minhas').innerHTML = v.minhas.map((c) => `<button type="button" class="minha" data-c="${c}" aria-label="${nomeCarta(c)}"${possoJogar ? '' : ' aria-disabled="true"'}>${cartaHtml(c, c[0] === v.manilha ? 'manilha' : '')}</button>`).join('');
  $('#t-minhas').classList.toggle('pode', possoJogar);

  // cartas do parceiro na mão de onze
  const pp = $('#t-parceiro');
  pp.hidden = !(v.parceiro && v.onze);
  if (!pp.hidden) pp.innerHTML = `<span>Cartas do parceiro:</span>${v.parceiro.map((c) => cartaHtml(c, 'peq')).join('')}`;

  status();
  acoes();
}

function podeJogar() {
  return !!v && !v.fim && !v.aposta && !v.onze && v.vez === eu && (modo === 'pc' || online.comecou) && !(Date.now() < rodadaAte);
}
function status() {
  const s = $('#t-status');
  let t = '', minha = false;
  if (v.fim) t = v.fim.vencedor === nos() ? 'Fim: vocês ganharam!' : 'Fim de jogo';
  else if (v.onze) { t = v.onze.time === nos() ? 'Mão de onze: olhe as cartas e decida' : 'Mão de onze: esperando o outro time'; minha = v.onze.time === nos(); }
  else if (v.aposta) { const d = time(v.aposta.lugar) !== nos(); t = d ? `Pediram ${T.NOME_APOSTA[v.aposta.valor].toLowerCase()}! Aceita?` : 'Esperando a resposta…'; minha = d; }
  else if (v.vez === eu) { t = v.ferro ? 'Mão de ferro: sua vez' : 'Sua vez: escolha uma carta'; minha = true; }
  else t = 'Vez de ' + nome(v.vez);
  // online: quanto falta da jogada (curto para caber no celular)
  const falta = prazoFalta();
  if (falta != null && !v.fim) {
    const seg = Math.ceil(falta / 1000);
    if (minha) t = v.aposta ? t + ' ' + seg + 's' : (v.onze ? 'Mão de onze' : 'Sua vez') + ': ' + seg + 's';
    else if (!v.onze && !v.aposta) t = 'Vez de ' + nome(v.vez) + ': ' + seg + 's';
  }
  s.textContent = t; s.classList.toggle('minha', minha); s.classList.toggle('pouco', minha && falta != null && falta < 10000);
}
function prazoFalta() { return modo === 'online' && prazo ? Math.max(0, prazo.falta - (performance.now() - prazo.recebido)) : null; }
setInterval(() => { if (modo === 'online' && v && !v.fim && prazo) status(); }, 500);
function botao(txt, cls, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'bt ' + cls; b.textContent = txt; b.addEventListener('click', fn); return b; }
function acoes() {
  const el = $('#t-acoes');
  el.innerHTML = '';
  if (v.fim) return;
  if (v.onze && v.onze.time === nos()) {
    el.append(botao('Jogar (vale 3)', 'verde', () => agir({ t: 'onze', jogar: true })), botao('Correr', '', () => agir({ t: 'onze', jogar: false })));
    return;
  }
  if (v.aposta && time(v.aposta.lugar) !== nos()) {
    el.append(botao('Aceitar', 'verde', () => agir({ t: 'aceitar' })));
    if (v.aposta.valor < 12) el.append(botao(T.NOME_APOSTA[v.aposta.valor + 3] + '!', 'amarelo grito', () => agir({ t: 'aumentar' })));
    el.append(botao('Correr', '', () => agir({ t: 'correr' })));
    return;
  }
  const podeTrucar = v.vez === eu && !v.aposta && !v.onze && !v.ferro && v.valor < 12 && v.subiu !== nos() && v.pontos[0] !== 11 && v.pontos[1] !== 11;
  if (podeTrucar) el.append(botao(T.NOME_APOSTA[v.valor === 1 ? 3 : v.valor + 3] + '!', 'amarelo grito', () => agir({ t: 'truco' })));
}

let timerFala;
function mostrarFala(f) {
  const el = $('#t-fala');
  el.textContent = f.txt;
  el.className = 'mostra' + (f.forte ? ' forte' : '') + (f.bom === true ? ' bom' : f.bom === false ? ' ruim' : '');
  clearTimeout(timerFala); timerFala = setTimeout(() => { el.className = ''; }, f.forte ? 2200 : 1800);
}

// ---------- jogar ----------
function agir(a) {
  if (!v || v.fim) return;
  if (modo === 'online') { if (online.ws && online.ws.readyState === 1) online.ws.send(JSON.stringify({ t: 'agir', a })); return; }
  const r = T.agir(e, eu, a);
  if (r) { aviso(r, 1800, 'relogio'); return; }
  atualizarPC();
}
$('#t-minhas').addEventListener('click', (ev) => {
  const b = ev.target.closest('.minha');
  if (!b) return;
  if (!podeJogar()) {
    if (v && !v.fim) aviso(v.aposta ? 'Responda o pedido primeiro' : v.onze ? 'Decida a mão de onze primeiro' : 'Espere a sua vez', 1400, 'relogio');
    return;
  }
  b.classList.add('saindo');
  agir({ t: 'jogar', carta: b.dataset.c });
});

// ---------- contra o computador ----------
function atualizarPC() {
  v = T.visao(e, eu);
  salvarPC();
  desenhar();
  if (e.fim) { localStorage.removeItem(CHAVE); mostrarFim(); return; }
  clearTimeout(timerRobo);
  const quem = T.quemAge(e);
  if (!quem.length || quem.includes(eu)) return;
  // o computador espera um pouco (mais depois de fechar a rodada, para dar tempo de ver as cartas)
  const ult = e.eventos[e.eventos.length - 1];
  const espera = ult && (ult.t === 'rodada' || ult.t === 'mao') ? 1700 : ult && ult.t === 'pediu' ? 1300 : 800;
  timerRobo = setTimeout(() => {
    if (modo !== 'pc' || e.fim) return;
    const l = T.quemAge(e)[0];
    if (l === undefined || l === eu) return;
    const a = T.robo(e, l);
    if (a) T.agir(e, l, a);
    atualizarPC();
  }, espera);
}
function comecarPC(guardado = null) {
  fecharOnline();
  modo = 'pc'; eu = 0; vistoSeq = -1; rodadaAte = 0; fimVisto = null;
  if (guardado) { e = guardado.e; nMesa = guardado.n; } else e = T.novo(nMesa);
  lugares = nMesa === 2 ? [{ nome: 'Você' }, { nome: 'Computador', robo: true, online: true }]
    : [{ nome: 'Você' }, { nome: 'Rival 1', robo: true, online: true }, { nome: 'Parceiro', robo: true, online: true }, { nome: 'Rival 2', robo: true, online: true }];
  $('#x-menu').hidden = true; $('#x-fim').hidden = true; $('#t-espera').hidden = true; $('#t-jogo').hidden = false;
  $('#bt-chamar').hidden = true;
  atualizarPC();
}

function mostrarFim() {
  const venci = v.fim.vencedor === nos();
  if (fimVisto === v.seq) return;
  fimVisto = v.seq;
  $('#fim-titulo').textContent = venci ? (v.n === 2 ? 'Você ganhou!' : 'Vocês ganharam!') : (v.n === 2 ? 'Você perdeu' : 'Vocês perderam');
  $('#fim-txt').textContent = `Placar: ${v.pontos[nos()]} a ${v.pontos[1 - nos()]}`;
  $('#fim-espera').hidden = true;
  mostrarPontosFim();
  setTimeout(() => { $('#x-fim').hidden = false; }, 1200);
}

// linha dos pontos no fim: "Seus pontos (Truco): 1200 → 1216 (+16)"
function mostrarPontosFim() {
  const el = $('#fim-pontos');
  const r = modo === 'online' && online && online.resultado;
  el.hidden = !(modo === 'online' && online && online.ranqueada);
  if (el.hidden) return;
  if (!r || r.pendente) { el.textContent = 'Contando os pontos…'; return; }
  if (r.falhou) { el.textContent = 'Não deu para contar os pontos agora.'; return; }
  if (r.anulada) {
    el.textContent = r.motivo === 'rede' ? 'Jogo anulado (as duas contas estão na mesma internet): não valeu pontos.'
      : r.motivo === 'limite' ? 'Vocês dois já jogaram 3 jogos valendo pontos hoje: este não valeu.' : 'Jogo anulado: não valeu pontos.';
    return;
  }
  const x = r[eu];
  if (!x) return;
  const dif = x.depois - x.antes;
  el.innerHTML = `Seus pontos (Truco): ${x.antes} → <b class="${dif >= 0 ? 'sobe' : 'desce'}">${x.mostrar} (${dif >= 0 ? '+' : ''}${dif})</b>`;
  meusPontos = null;
}

// ---------- pontos e busca de adversário (um contra um) ----------
const redeTeste = new URLSearchParams(location.search).get('rede');
const comRede = (u) => (redeTeste ? u + '&rede=' + encodeURIComponent(redeTeste) : u);
async function lerMeusPontos() {
  if (!conta.token) return;
  try {
    const r = await fetch('/api/xadrez/pontos?jogo=truco', { headers: { authorization: 'Bearer ' + conta.token } });
    if (r.ok) meusPontos = (await r.json()).pontos;
  } catch {}
  mostrarMeusPontos();
}
function mostrarMeusPontos() {
  const el = $('#x-meus-pontos');
  el.hidden = !conta.token;
  $('#bt-procurar').disabled = !conta.token;
  if (conta.token) el.textContent = `Seus pontos no truco: ${meusPontos && meusPontos.truco ? meusPontos.truco.mostrar : '…'}`;
  // valendo pontos só no um contra um
  $('#x-tipo-amigo').hidden = nMesa !== 2;
}
function procurar() {
  if (!conta.token || busca) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(comRede(`${proto}//${location.host}/api/xadrez/busca?jogo=truco&t=${encodeURIComponent(conta.token)}`));
  busca = { ws, desde: Date.now(), timer: 0 };
  $('#busca-txt').textContent = `Truco um contra um · seus pontos ${meusPontos && meusPontos.truco ? meusPontos.truco.mostrar : '…'}`;
  $('#x-busca').hidden = false;
  const tique = () => { const s = Math.floor((Date.now() - busca.desde) / 1000); $('#busca-tempo').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  tique(); busca.timer = setInterval(tique, 500);
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (m.t === 'achou') { pararBusca(); jogarOnline(m.codigo); }
    else if (m.t === 'erro') { pararBusca(); $('#x-erro').textContent = m.msg; }
  };
  ws.onclose = () => { if (busca && busca.ws === ws) { pararBusca(); $('#x-erro').textContent = 'A busca caiu. Tente de novo.'; } };
}
function pararBusca() {
  if (!busca) return;
  const b = busca; busca = null;
  clearInterval(b.timer);
  try { b.ws.close(); } catch {}
  $('#x-busca').hidden = true;
}
$('#bt-procurar').addEventListener('click', () => { $('#x-erro').textContent = ''; procurar(); });
$('#bt-busca-cancelar').addEventListener('click', () => pararBusca());
function marcarTipo() { document.querySelectorAll('.tipo-amigo').forEach((b) => { const s = b.dataset.tipo === tipoAmigo; b.classList.toggle('sel', s); b.setAttribute('aria-checked', s); }); }
document.querySelectorAll('.tipo-amigo').forEach((b) => b.addEventListener('click', () => { tipoAmigo = b.dataset.tipo; marcarTipo(); }));
marcarTipo();

// ---------- menu ----------
function marcarQtd() { document.querySelectorAll('.qtd').forEach((b) => { const s = +b.dataset.n === nMesa; b.classList.toggle('sel', s); b.setAttribute('aria-checked', s); }); }
document.querySelectorAll('.qtd').forEach((b) => b.addEventListener('click', () => { nMesa = +b.dataset.n; marcarQtd(); mostrarMeusPontos(); }));
marcarQtd();
function abrirMenu() {
  fecharOnline();
  clearTimeout(timerRobo);
  modo = null; v = null;
  $('#t-jogo').hidden = true; $('#x-fim').hidden = true; $('#t-espera').hidden = true;
  $('#x-menu').hidden = false;
  $('#bt-continuar').hidden = !lerPC();
  $('#x-sem-conta').hidden = !!conta.token;
  $('#bt-amigo').disabled = !conta.token;
  history.replaceState(null, '', location.pathname);
  if (lobby) lobby.jogo('truco');
  mostrarMeusPontos();
  if (conta.token && !meusPontos) lerMeusPontos();
}
$('#bt-computador').addEventListener('click', () => comecarPC());
$('#bt-continuar').addEventListener('click', () => { const g = lerPC(); if (g) comecarPC(g); });
$('#bt-sair').addEventListener('click', () => abrirMenu());
$('#bt-sair2').addEventListener('click', () => abrirMenu());
$('#bt-menu-fim').addEventListener('click', () => abrirMenu());
$('#bt-revanche').addEventListener('click', () => {
  if (modo === 'pc') { comecarPC(); return; }
  online.ws && online.ws.send(JSON.stringify({ t: 'revanche' }));
  $('#fim-espera').hidden = false; $('#fim-espera').textContent = 'Esperando os amigos toparem…';
});

// ---------- online ----------
function fecharOnline() { if (online && online.ws) { online.fechado = true; try { online.ws.close(); } catch {} } online = null; }
function codigoNovo() { const L = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.getRandomValues(new Uint8Array(14))].map((x) => L[x % L.length]).join(''); }
function jogarOnline(codigo, chamar = false, criar = false) {
  if (!conta.token) { $('#x-erro').textContent = 'Entre na sua conta para jogar com amigos.'; return; }
  fecharOnline();
  clearTimeout(timerRobo);
  modo = 'online'; v = null; vistoSeq = -1; rodadaAte = 0; fimVisto = null; prazo = null;
  online = { codigo, tentativas: 0, n: nMesa, comecou: false, ranqueada: criar && nMesa === 2 && tipoAmigo === 'pontos' };
  history.replaceState(null, '', '?sala=' + codigo);
  $('#x-menu').hidden = true; $('#x-fim').hidden = true; $('#t-jogo').hidden = true;
  $('#t-espera').hidden = false;
  $('#espera-lista').innerHTML = ''; $('#espera-txt').textContent = 'Entrando na mesa…';
  conectar();
  if (chamar) setTimeout(() => chamarAmigos(), 300);
}
function desenharEspera(m) {
  $('#espera-lista').innerHTML = m.lugares.map((j, i) => `<div class="espera-lugar${j ? ' tem' : ''}"><span class="bolinha${j && j.online ? ' on' : ''}"></span><span class="n"></span><span class="eq">${m.n === 4 ? (time(i) === time(m.voce) ? 'Sua dupla' : 'Outra dupla') : ''}</span></div>`).join('');
  document.querySelectorAll('#espera-lista .espera-lugar .n').forEach((el, i) => { const j = m.lugares[i]; el.textContent = i === m.voce ? 'Você' : j ? j.nome : 'Vaga livre'; });
  const vagas = m.lugares.filter((j) => !j).length;
  $('#bt-comecar').hidden = !(m.dono && m.n === 4);
  $('#espera-txt').textContent = m.n === 2 ? 'Esperando seu amigo entrar…' : m.dono ? `Faltam ${vagas}. Chame amigos ou comece com o computador nas vagas.` : 'Esperando quem criou a mesa começar…';
}
function conectar() {
  const o = online;
  if (!o) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(comRede(`${proto}//${location.host}/api/partida/${o.codigo}?jogo=truco&n=${o.n}${o.ranqueada ? '&ranqueada=1' : ''}&t=${encodeURIComponent(conta.token)}`));
  o.ws = ws;
  ws.onopen = () => { o.tentativas = 0; };
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch { return; }
    if (online !== o) return;
    if (m.t === 'erro') { o.fechado = true; abrirMenu(); $('#x-erro').textContent = m.msg; return; }
    if (m.t === 'aviso') { aviso(m.msg, 1800, 'relogio'); return; }
    if (m.t !== 'estado' || m.jogo !== 'truco') return;
    const antes = lugares;
    lugares = m.lugares; eu = m.voce; o.dono = m.dono; o.revanche = m.revanche;
        o.ranqueada = !!m.ranqueada; o.pontos = m.pontos || null; o.resultado = m.resultado || null;
    if (o.comecou && antes.length) m.lugares.forEach((j, i) => { if (j && !j.robo && antes[i] && !antes[i].online && j.online) aviso(`${j.nome} voltou`, 1600, 'acenar'); });
    if (!m.comecou) {
      if (antes.length) m.lugares.forEach((j, i) => { if (j && !antes[i] && i !== eu) aviso(`${j.nome} chegou!`, 2200, 'acenar'); });
      o.comecou = false; desenharEspera(m); return;
    }
    if (o.partida && m.partida !== o.partida) { $('#x-fim').hidden = true; fimVisto = null; vistoSeq = -1; aviso('Jogo novo!', 2000, 'carta'); }
    o.partida = m.partida;
    o.comecou = true;
    $('#t-espera').hidden = true; $('#t-jogo').hidden = false;
    $('#bt-chamar').hidden = true;
    v = m.estado;
    prazo = m.prazo ? { ...m.prazo, recebido: performance.now() } : null;
    // alguém demorou demais: o computador jogou no lugar
    if (m.esgotou && o.esgotou !== undefined && m.esgotou.n !== (o.esgotou && o.esgotou.n)) aviso(m.esgotou.lugar === eu ? 'Seu tempo acabou: o computador jogou por você' : `${nome(m.esgotou.lugar)} demorou: o computador jogou no lugar`, 2600, 'relogio');
    o.esgotou = m.esgotou || null;
    desenhar();
    if (v.fim) {
      mostrarFim();
      mostrarPontosFim();
      if (m.revanche.length && !m.revanche.includes(eu)) { $('#fim-espera').hidden = false; $('#fim-espera').textContent = 'Seus amigos querem jogar de novo!'; }
    }
  };
  ws.onclose = () => {
    if (online !== o || o.fechado) return;
    if (o.tentativas > 6) { abrirMenu(); $('#x-erro').textContent = 'A conexão com a mesa caiu.'; return; }
    setTimeout(() => { if (online === o && !o.fechado) conectar(); }, Math.min(10000, 800 * 2 ** o.tentativas++));
  };
}
function chamarAmigos() {
  if (!amigos || !online) return;
  amigos.abrir({ jogo: 'truco', sala: online.codigo, titulo: 'Truco' });
}
$('#bt-amigo').addEventListener('click', () => jogarOnline(codigoNovo(), true, true));
$('#bt-chamar').addEventListener('click', () => chamarAmigos());
$('#bt-chamar2').addEventListener('click', () => chamarAmigos());
$('#bt-comecar').addEventListener('click', () => { if (online && online.ws) online.ws.send(JSON.stringify({ t: 'comecar' })); });

// ---------- saguão e amigos ----------
let lobby = null, amigos = null;
if (conta.token) {
  lobby = new Lobby('truco');
  amigos = criarAmigos({
    lobby, aviso,
    aceitarConvite(m) {
      const j = dadosJogo(m.jogo);
      if (m.jogo === 'truco') { jogarOnline(m.sala); return; }
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

// para os testes automáticos (testes/teste-truco.mjs)
window.__truco = { get e() { return e; }, get v() { return v; }, get prazo() { return prazo; }, get busca() { return busca; }, get eu() { return eu; }, get modo() { return modo; }, get online() { return online; }, T, agir, atualizar: () => atualizarPC() };

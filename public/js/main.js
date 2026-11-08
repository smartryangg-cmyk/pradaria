// Pradaria: jogo de construir e explorar, pacífico, para o navegador.
import * as THREE from '../vendor/three.module.min.js';
import { criarAtlas, iconeBloco, INVENTARIO, INVENTARIO_MAQUINAS, B, E, AR, BLOCOS, SOLIDO, AGUA, PRECISA_CHAO } from './blocos.js';
import { BASE, PRECISA_ENERGIA, ELETRICO } from './energia.js';
import { Mundo, ALT, NIVEL_AGUA } from './mundo.js';
import { Jogador, OLHOS } from './jogador.js';
import { Controles } from './controles.js';
import { Bichos } from './animais.js';
import { Aldeoes } from './aldeoes.js';
import { Som } from './som.js';
import { montarBoneco, etiqueta, matModelo, caixa, juntar } from './modelos.js';
import { conta, api, Sala } from './rede.js';
import { criarGraficos, QUALIDADES, PESSOAIS } from './graficos.js';
import { icone, preencherIcones, comIcone, nomeEmote } from './icones.js';
import { Escavacao } from './escavar.js';
import { Fisica } from './fisica.js';
import { criarComandos } from './comandos.js';
import { OPCOES_MUNDO, PADRAO_MUNDO, PADRAO_NOVO, TAMANHOS, TIPOS, normalizarOpcoes, definirOpcoesMundo, opcoesMundo, sementeDeTexto } from './opcoes-mundo.js';
import { Monstros } from './monstros.js';
import { vida } from './vida.js';
import { Mapa } from './mapa.js';
import { Mercado } from './mercado.js';

const $ = (s) => document.querySelector(s);
preencherIcones();
const CORES = [0x3f6fd9, 0xe8433f, 0x4caf50, 0xf2c72e, 0x9c5bd9, 0xf29ac2, 0xff8a3d, 0x2bb3b3];

// ---------- ajustes salvos ----------
const ehToque = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (ehToque) document.body.classList.add('toque');
const AJ_PADRAO = { dist: ehToque ? 3 : 4, qual: ehToque ? 0.8 : 1, graf: ehToque ? 'media' : 'alta', gopc: null, ...PESSOAIS, auto: true, sens: 0.0055, som: true, fps: false, minimapa: true };
let ajustes = { ...AJ_PADRAO };
try { Object.assign(ajustes, JSON.parse(localStorage.getItem('pradaria.ajustes') || '{}')); } catch {}
if (!QUALIDADES[ajustes.graf] && !(ajustes.graf === 'personalizado' && ajustes.gopc)) ajustes.graf = AJ_PADRAO.graf;
// opções gráficas valendo agora: as do preset (ou as personalizadas) + as pessoais
function opcoesGraficas() {
  const base = ajustes.graf === 'personalizado' ? { ...QUALIDADES.alta, ...ajustes.gopc, nome: 'Personalizado' } : QUALIDADES[ajustes.graf];
  return { ...base, fov: ajustes.fov, brilho: ajustes.brilho, fpsMax: ajustes.fpsMax };
}
const salvarAjustes = () => { try { localStorage.setItem('pradaria.ajustes', JSON.stringify(ajustes)); } catch {} };

// ---------- renderização ----------
const canvas = $('#tela');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
cena.fog = new THREE.Fog(0x8fd3ff, 30, 60);

function redimensionar() {
  // limite de pixels por nível (tablet com tela enorme não precisa desenhar 4 milhões de pixels)
  const tetoMP = opcoesGraficas().teto || 1.3;
  const maxPr = Math.sqrt((tetoMP * 1e6) / (innerWidth * innerHeight));
  const pr = Math.min(window.devicePixelRatio || 1, 2, maxPr) * ajustes.qual;
  renderer.setPixelRatio(Math.max(0.4, pr));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = ajustes.fov || 72;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
redimensionar();

const { tex: atlas, canvas: atlasCanvas } = criarAtlas();
const graf = criarGraficos(renderer, cena, camera, atlas);
const { matBlocos, matAgua } = graf;

// minimapa e mapa grande
const mapa = new Mapa({
  atlasCanvas,
  mini: $('#minimapa-tela'),
  grande: { janela: $('#mapa'), canvas: $('#mapa-tela'), coords: $('#mapa-coords'), fechar: $('#mapa-fechar'), mais: $('#mapa-mais'), menos: $('#mapa-menos'), centrar: $('#mapa-centro'), limpar: $('#mapa-limpar') },
  aoAbrir: () => { if (document.pointerLockElement) document.exitPointerLock(); pausado = true; },
  aoFechar: () => { pausado = false; },
});
function aplicarMinimapa() { mapa.ligado = !!ajustes.minimapa; $('#minimapa').hidden = !ajustes.minimapa; }

// nuvens
const nuvens = (() => {
  const g = [];
  const r = Math.random;
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 360, z = (r() - 0.5) * 360;
    const w = 12 + r() * 20, d = 8 + r() * 14;
    g.push(caixa(w, 3, d, 0xffffff, x, 0, z));
    if (r() < 0.6) g.push(caixa(w * 0.6, 3, d * 0.6, 0xffffff, x + w * 0.3, 1.5, z + d * 0.2));
  }
  const m = new THREE.Mesh(juntar(g), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
  m.position.y = ALT + 20;
  cena.add(m);
  return m;
})();

function aplicarGraficos() {
  const o = graf.aplicar(opcoesGraficas());
  nuvens.visible = o.nuvens;
  $('#vinheta').hidden = !o.vinheta;
  redimensionar();
  return o;
}
aplicarGraficos();

// contorno do bloco mirado
const contorno = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
contorno.visible = false;
cena.add(contorno);

// ---------- estado do jogo ----------
const som = new Som();
let mundo = null, jog = null, ctrl = null, bichos = null, aldeoes = null, monstros = null, sala = null, escav = null, fisica = null;
let jogando = false, pausado = false;
let modo = 'local', mundoAtual = null;
let barra = [B.GRAMA, B.TERRA, B.PEDRA, B.TABUAS, B.TRONCO, B.VIDRO, B.TIJOLO, B.LA_VERMELHA, B.FLOR_AMARELA];
let slotSel = 0;
let tempoDia = 0.3; // 0..1 (0.25 = meio-dia)
const DURACAO_DIA = 600;
const outros = new Map();
let euId = null;

// ---------- interface ----------
function mostrarMenu(id) {
  $('#menu').hidden = false;
  for (const c of document.querySelectorAll('#menu > .caixa')) c.hidden = c.id !== id;
}
let timerAviso;
function aviso(txt, ms = 1800, ic = null) {
  const el = $('#aviso');
  el.innerHTML = comIcone(ic, txt); el.classList.add('mostra');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove('mostra'), ms);
}

// mercado e objetivos (ligados ou não nas opções do mundo)
const mercado = new Mercado({
  aviso, som,
  icone: (b, t) => iconeBloco(atlasCanvas, b, t),
  nomeBloco: (b) => (BLOCOS[b] ? BLOCOS[b].nome : '?'),
  pausar: () => { if (document.pointerLockElement) document.exitPointerLock(); pausado = true; },
  retomar: () => { pausado = false; },
  outros: () => [...outros.entries()].map(([id, o]) => ({ id, nome: o.nome })),
});

function desenharBarra() {
  const el = $('#barra');
  el.innerHTML = '';
  barra.forEach((id, i) => {
    const b = document.createElement('button');
    b.className = 'slot' + (i === slotSel ? ' sel' : '');
    b.setAttribute('aria-label', BLOCOS[id].nome);
    b.appendChild(iconeBloco(atlasCanvas, id, 48));
    if (!mercado.podeColocar(id)) { b.classList.add('trancado'); b.title = 'Compre na loja de uma vila'; }
    b.addEventListener('click', () => { slotSel = i; som.clique(); desenharBarra(); aviso(BLOCOS[id].nome, 900); });
    el.appendChild(b);
  });
  const mais = document.createElement('button');
  mais.className = 'slot mais'; mais.innerHTML = icone('mais'); mais.setAttribute('aria-label', 'Todos os blocos');
  mais.addEventListener('click', abrirInventario);
  el.appendChild(mais);
}

let abaInv = 'blocos';
const maquinasLigadas = () => opcoesMundo.maquinas !== false;
function abrirInventario() {
  if (!jogando) return;
  const g = $('#grade');
  if (!maquinasLigadas()) abaInv = 'blocos';
  $('#abas-inv').hidden = !maquinasLigadas();
  document.querySelectorAll('[data-aba]').forEach((b) => b.classList.toggle('sel', b.dataset.aba === abaInv));
  $('#dica-maquinas').hidden = abaInv !== 'maquinas';
  g.innerHTML = '';
  {
    for (const id of abaInv === 'maquinas' ? INVENTARIO_MAQUINAS : INVENTARIO) {
      const b = document.createElement('button');
      b.title = BLOCOS[id].nome;
      b.appendChild(iconeBloco(atlasCanvas, id, 48));
      const trancado = !mercado.podeColocar(id);
      if (trancado) { b.classList.add('trancado'); b.dataset.preco = '🪙' + mercado.precoDe(id); }
      b.addEventListener('click', () => {
        if (trancado) { som.clique(); aviso(`${BLOCOS[id].nome}: compre na loja de uma vila por ${mercado.precoDe(id)} 🪙 (toque num aldeão)`, 2800); return; }
        const ja = barra.indexOf(id);
        if (ja >= 0) slotSel = ja; else barra[slotSel] = id;
        som.clique(); desenharBarra(); fecharJanelas(); aviso(BLOCOS[id].nome, 900);
      });
      g.appendChild(b);
    }
  }
  if (document.pointerLockElement) document.exitPointerLock();
  $('#inventario').hidden = false;
  $('#inv-titulo').textContent = abaInv === 'maquinas' ? 'Engenharia' : 'Blocos';
  pausado = true;
}

function abrirPausa() {
  if (document.pointerLockElement) document.exitPointerLock();
  $('#aj-dist').value = ajustes.dist; $('#aj-qual').value = ajustes.qual; preencherGraficos(); $('#aj-sens').value = ajustes.sens;
  $('#aj-som').checked = ajustes.som; $('#aj-fps').checked = ajustes.fps; $('#aj-minimapa').checked = ajustes.minimapa;
  $('#pausa-mundo').textContent = modo === 'online' ? `Mundo: ${mundoAtual.nome} · código ${mundoAtual.codigo}` : 'Mundo sem internet (salvo neste aparelho)';
  $('#pausa-opcoes').textContent = 'Neste mundo: ' + resumoOpcoes(opcoesMundo);
  $('#pausa').hidden = false;
  pausado = true;
}
function fecharJanelas() {
  $('#inventario').hidden = true; $('#pausa').hidden = true; $('#mapa').hidden = true;
  if (cmd) cmd.fechar();
  mercado.fechar(true);
  pausado = false;
}
document.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { abaInv = b.dataset.aba; som.clique(); abrirInventario(); }));
document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharJanelas));
$('#bt-menu').addEventListener('click', abrirPausa);
// ---------- tela cheia ----------
const el = document.documentElement;
const pedirTela = el.requestFullscreen || el.webkitRequestFullscreen;
const emTelaCheia = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const ehApp = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone || new URLSearchParams(location.search).get('app') === 'android';
function alternarTela() {
  som.iniciar();
  if (emTelaCheia()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  if (pedirTela) {
    Promise.resolve(pedirTela.call(el, { navigationUI: 'hide' }))
      .then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch {} })
      .catch(() => aviso('Não deu para abrir em tela cheia aqui', 2500, 'telacheia'));
  } else {
    // iPhone não deixa sites ficarem em tela cheia: o jeito é instalar na tela de início
    aviso('No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início". O jogo abre em tela cheia por lá!', 6000);
  }
}
function atualizarBotaoTela() {
  const cheia = emTelaCheia();
  $('#bt-tela').innerHTML = icone(cheia ? 'sairtela' : 'telacheia');
  $('#bt-tela2').innerHTML = icone(cheia ? 'sairtela' : 'telacheia') + (cheia ? 'Sair da tela cheia' : 'Tela cheia');
}
$('#bt-tela').hidden = !!ehApp;
$('#bt-tela2').hidden = !!ehApp;
$('#bt-tela').addEventListener('click', alternarTela);
$('#bt-tela2').addEventListener('click', alternarTela);
document.addEventListener('fullscreenchange', atualizarBotaoTela);
document.addEventListener('webkitfullscreenchange', atualizarBotaoTela);

// ---------- instalar o app ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(() => {});
let pedidoInstalar = null;
const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function mostrarInstalar(sim) { document.querySelectorAll('.instalar').forEach((b) => { b.hidden = !sim || !!ehApp; }); }
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalar = e; mostrarInstalar(true); });
addEventListener('appinstalled', () => { pedidoInstalar = null; mostrarInstalar(false); aviso('Pronto! O Pradaria está na sua tela de início!', 3500, 'estrela'); });
// no Android (fora do app) oferece baixar o APK, que abre o jogo em tela cheia
if (/Android/i.test(navigator.userAgent) && !ehApp) document.querySelectorAll('.baixar-apk').forEach((b) => { b.hidden = false; });
if (ehIOS) mostrarInstalar(true); // no iPhone/iPad não tem pedido automático: mostramos o passo a passo
document.querySelectorAll('.instalar').forEach((b) => b.addEventListener('click', async () => {
  if (pedidoInstalar) {
    pedidoInstalar.prompt();
    const r = await pedidoInstalar.userChoice.catch(() => null);
    if (r && r.outcome === 'accepted') mostrarInstalar(false);
    pedidoInstalar = null;
  } else if (ehIOS) {
    alert('Para instalar no iPhone ou iPad:\n\n1. Abra este site no Safari\n2. Toque em Compartilhar (o quadrado com a setinha para cima)\n3. Toque em "Adicionar à Tela de Início"\n\nDepois é só abrir pelo ícone, em tela cheia!');
  }
}));
addEventListener('keydown', (e) => {
  if (!jogando) return;
  if (e.code === 'Escape' && pausado) fecharJanelas();
  else if (e.code === 'KeyP') abrirPausa();
  else if (e.code === 'KeyC' && !pausado && e.target.tagName !== 'INPUT') cmd.abrir();
  else if (e.code === 'KeyM') { if (!$('#mapa').hidden) fecharJanelas(); else if (!pausado) mapa.abrir(); }
});
// mundo pequeno/médio: como acaba no mar, dá para enxergar mais longe sem pesar
const raioVisao = () => Math.min(9, ajustes.dist + TAMANHOS[opcoesMundo.tamanho].raioExtra);
$('#aj-dist').addEventListener('input', (e) => { ajustes.dist = +e.target.value; if (mundo) mundo.raio = raioVisao(); salvarAjustes(); ajustarNevoa(); });
$('#aj-graf').addEventListener('change', (e) => {
  ajustes.graf = e.target.value;
  if (ajustes.graf === 'personalizado' && !ajustes.gopc) ajustes.gopc = { ...QUALIDADES.alta };
  salvarAjustes(); aplicarGraficos(); preencherGraficos(); segundosLentos = 0;
});
// opções avançadas: mexer em qualquer uma vira "Personalizado"
const OPC = [
  ['aj-sombra', 'sombra', 'num'], ['aj-area', 'area', 'num'], ['aj-luzes', 'luzes', 'num'], ['aj-teto', 'teto', 'num'],
  ['aj-vento', 'vento', 'bool'], ['aj-ondas', 'ondas', 'bool'], ['aj-nuvens', 'nuvens', 'bool'], ['aj-vinheta', 'vinheta', 'bool'],
];
const PESS = [['aj-fov', 'fov'], ['aj-brilho', 'brilho'], ['aj-fpsmax', 'fpsMax']];
function preencherGraficos() {
  const o = opcoesGraficas();
  $('#aj-graf').value = ajustes.graf;
  for (const [id, k, t] of OPC) { const el = $('#' + id); if (t === 'bool') el.checked = !!o[k]; else el.value = o[k]; }
  for (const [id, k] of PESS) $('#' + id).value = ajustes[k];
  $('#aj-auto').checked = ajustes.auto;
  $('#v-fov').textContent = ajustes.fov + '°';
  $('#v-brilho').textContent = Math.round(ajustes.brilho * 100) + '%';
  $('#v-area').textContent = o.sombra ? o.area + ' m' : '—';
  $('#aj-area').disabled = !o.sombra;
}
for (const [id, k, t] of OPC) $('#' + id).addEventListener(t === 'bool' ? 'change' : 'input', (e) => {
  const o = opcoesGraficas();
  ajustes.gopc = { sombra: o.sombra, area: o.area, luzes: o.luzes, pular: 0, vento: o.vento, ondas: o.ondas, nuvens: o.nuvens, vinheta: o.vinheta, teto: o.teto };
  ajustes.gopc[k] = t === 'bool' ? e.target.checked : +e.target.value;
  if (k === 'sombra' && ajustes.gopc.sombra && !ajustes.gopc.area) ajustes.gopc.area = 32;
  ajustes.graf = 'personalizado';
  salvarAjustes(); aplicarGraficos(); preencherGraficos();
});
for (const [id, k] of PESS) $('#' + id).addEventListener('input', (e) => { ajustes[k] = +e.target.value; salvarAjustes(); aplicarGraficos(); preencherGraficos(); });
$('#aj-auto').addEventListener('change', (e) => { ajustes.auto = e.target.checked; salvarAjustes(); });
$('#aj-qual').addEventListener('input', (e) => { ajustes.qual = +e.target.value; salvarAjustes(); redimensionar(); });
$('#aj-sens').addEventListener('input', (e) => { ajustes.sens = +e.target.value; if (ctrl) ctrl.sensToque = ajustes.sens; salvarAjustes(); });
$('#aj-som').addEventListener('change', (e) => { ajustes.som = e.target.checked; som.ligado = ajustes.som; salvarAjustes(); });
$('#aj-minimapa').addEventListener('change', (e) => { ajustes.minimapa = e.target.checked; salvarAjustes(); aplicarMinimapa(); });
$('#minimapa').addEventListener('click', () => { som.clique(); mapa.abrir(); });
$('#bt-abrir-mapa').addEventListener('click', () => { $('#pausa').hidden = true; mapa.abrir(); });
$('#aj-fps').addEventListener('change', (e) => { ajustes.fps = e.target.checked; $('#fps').hidden = !ajustes.fps; salvarAjustes(); });
$('#bt-sair-mundo').addEventListener('click', sairDoMundo);

// ---------- comandos visuais (teleporte, casa, amigos, hora) ----------
// sem corações: desmaia, os monstrinhos vão embora e acorda em casa (ou no começo), sem perder nada
vida.aoDesmaiar = () => {
  if (!jogando) return;
  if (monstros) monstros.limpar();
  const el = $('#desmaio');
  el.hidden = false; el.classList.remove('vai'); void el.offsetWidth; el.classList.add('vai');
  setTimeout(() => {
    if (!jogando) return;
    const c = cmd.casa();
    if (c) cmd.teleportar(c[0], c[1], c[2], c[3], 'Você desmaiou e acordou em casa');
    else { const p = acharInicio(); cmd.teleportar(p.x, p.y, p.z, 0, 'Você desmaiou e acordou no começo do mundo'); }
    vida.reiniciar(); vida.protegido = 6;
  }, 900);
  setTimeout(() => { el.hidden = true; }, 2200);
};
const cmd = criarComandos({
  aviso, som, outros, acharInicio: () => acharInicio(),
  jog: () => (jogando ? jog : null), mundo: () => mundo, sala: () => sala, modo: () => modo, mundoAtual: () => mundoAtual,
  nomeEu: () => conta.usuario && conta.usuario.nome,
  definirDia: (v) => { tempoDia = v; },
  pausar: (sim) => { pausado = sim; },
});
$('#bt-comandos').addEventListener('click', () => { som.iniciar(); som.clique(); cmd.abrir(); });
$('#bt-voar').addEventListener('click', () => alternarVoo());
document.querySelectorAll('[data-emote]').forEach((b) => b.addEventListener('click', () => {
  const e = b.dataset.emote; // nome do ícone: 'acenar', 'coracao', 'sorriso', 'estrela'
  som.oi();
  if (sala) sala.enviar({ t: 'emote', e });
  mercado.evento('emote');
  if (bichos) bichos.icone(e, jog.pos.x + Math.sin(-jog.yaw) * -1.2, jog.pos.y + 1.9, jog.pos.z - Math.cos(jog.yaw) * 1.2, 1.4, 0.5);
}));

function ajustarNevoa() {
  const d = ajustes.dist * 16;
  cena.fog.near = d * 0.45; cena.fog.far = d * 0.95;
  graf.ajustarNevoa(cena.fog.near, cena.fog.far);
}

function alternarVoo() {
  if (!jog) return;
  jog.voando = !jog.voando;
  jog.vel.y = jog.voando ? 2 : 0;
  $('#bt-voar').classList.toggle('ligado', jog.voando);
  $('#bt-descer').hidden = !jog.voando;
  aviso(jog.voando ? 'Voando!' : 'Andando', 900, jog.voando ? 'voar' : null);
}

// ---------- ações ----------
const raio = new THREE.Raycaster();
const centro = new THREE.Vector2(0, 0);
function direcaoDe(ponto) {
  if (!ponto) raio.setFromCamera(centro, camera);
  else raio.setFromCamera(new THREE.Vector2((ponto.x / innerWidth) * 2 - 1, -(ponto.y / innerHeight) * 2 + 1), camera);
  return raio.ray.direction;
}

function mirar(ponto, alcance = 6) {
  const dir = direcaoDe(ponto);
  const o = camera.position;
  const hb = mundo.raycast(o, dir, alcance);
  const ha = bichos.atingir(o, dir, hb ? hb.t + 0.01 : alcance);
  const hm = monstros.atingir(o, dir, ha ? ha.t : hb ? hb.t + 0.01 : alcance);
  const hv = aldeoes.atingir(o, dir, hm ? hm.t : ha ? ha.t : hb ? hb.t + 0.01 : alcance);
  if (hv) return { bloco: null, bicho: null, aldeao: hv.aldeao };
  if (hm) return { bloco: null, bicho: null, monstro: hm.monstro };
  return { bloco: ha ? null : hb, bicho: ha ? ha.bicho : null };
}

function usar(ponto) {
  if (!jogando || pausado) return;
  som.iniciar();
  const m = mirar(ponto);
  if (m.monstro) { monstros.espantar(m.monstro); return; }
  if (m.bicho) { fazerCarinho(m.bicho); return; }
  if (m.aldeao) { conversarCom(m.aldeao); return; }
  const h = m.bloco;
  if (!h) return;
  // tocar na alavanca liga/desliga; no botão, aperta
  if (BASE[h.b] === E.ALAVANCA) {
    mundo.definir(h.x, h.y, h.z, h.b === E.ALAVANCA ? E.ALAVANCA_LIGADA : E.ALAVANCA);
    som.alavanca();
    return;
  }
  if (BASE[h.b] === E.BOTAO) { apertarBotao(h.x, h.y, h.z); return; }
  const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2];
  let novo = barra[slotSel];
  if (y < 1 || y >= ALT) return;
  if (!mercado.podeColocar(novo)) { aviso(`${BLOCOS[novo].nome}: compre na loja de uma vila por ${mercado.precoDe(novo)} 🪙`, 2500); return; }
  const atual = mundo.bloco(x, y, z);
  if (atual !== AR && !AGUA[atual] && !BLOCOS[atual].planta) return;
  if (novo === B.AGUA && atual === B.AGUA) return;
  if (SOLIDO[novo] && jog.ocupa(x, y, z)) return;
  if (PRECISA_CHAO[novo] && !SOLIDO[mundo.bloco(x, y - 1, z)]) return;
  // esteira: anda para onde o jogador está olhando
  if (novo === E.ESTEIRA) {
    const fx = -Math.sin(jog.yaw), fz = -Math.cos(jog.yaw);
    novo = E.ESTEIRA + (Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3));
  }
  comoJogador(() => mundo.definir(x, y, z, novo));
  som.colocar();
  dicaEnergia(novo, x, y, z);
}

// ---------- engenharia ----------
function apertarBotao(x, y, z) {
  if (mundo.bloco(x, y, z) !== E.BOTAO) return;
  mundo.definir(x, y, z, E.BOTAO_LIGADO);
  som.alavanca();
  const m = mundo;
  setTimeout(() => { if (mundo === m && m.bloco(x, y, z) === E.BOTAO_LIGADO) m.definir(x, y, z, E.BOTAO); }, 1500);
}
// dicas para quem está começando (uma vez cada)
const dicasDadas = new Set();
function dicaEnergia(novo, x, y, z) {
  if (!PRECISA_ENERGIA.has(BASE[novo]) || dicasDadas.has('energia')) return;
  setTimeout(() => {
    if (!mundo || dicasDadas.has('energia')) return;
    if (mundo.bloco(x, y, z) === novo) { // continua desligado
      dicasDadas.add('energia');
      aviso('Essa máquina precisa de energia! Coloque uma Alavanca encostada (ou ligue com Fio) e toque nela.', 5000, 'raio');
    }
  }, 400);
}
// placa de pisar: quem pisa liga; quando sai (e ninguém mais está nela), desliga
let minhaPlaca = null;
function vigiarPlaca() {
  const x = Math.floor(jog.pos.x), y = Math.floor(jog.pos.y + 0.05), z = Math.floor(jog.pos.z);
  const b = mundo.bloco(x, y, z);
  const aqui = BASE[b] === E.PLACA && !jog.voando ? [x, y, z] : null;
  if (aqui && b === E.PLACA) { mundo.definir(x, y, z, E.PLACA_LIGADA); som.clique(); }
  if (minhaPlaca && (!aqui || aqui.join() !== minhaPlaca.join())) {
    const [px, py, pz] = minhaPlaca;
    let alguem = false;
    for (const o of outros.values()) if (Math.floor(o.alvo.x) === px && Math.floor(o.alvo.y + 0.05) === py && Math.floor(o.alvo.z) === pz) alguem = true;
    if (!alguem && mundo.bloco(px, py, pz) === E.PLACA_LIGADA) mundo.definir(px, py, pz, E.PLACA);
  }
  minhaPlaca = aqui;
}
// confete: chuva de papeizinhos coloridos
const CORES_CONFETE = [0xe8433f, 0xf2c72e, 0x3f6fd9, 0x5cb83a, 0xf29ac2, 0xffffff, 0x9c5bd9];
const matsConfete = CORES_CONFETE.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
const geoConfete = new THREE.PlaneGeometry(0.14, 0.09);
function soltarConfete(x, y, z) {
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(geoConfete, matsConfete[i % matsConfete.length]);
    m.position.set(x + 0.5, y + 1.05, z + 0.5);
    m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    cena.add(m);
    partQ.push({ m, v: [(Math.random() - 0.5) * 4, 7 + Math.random() * 5, (Math.random() - 0.5) * 4], vida: 2 + Math.random(), confete: true, giro: (Math.random() - 0.5) * 12, dono: 'confete' });
  }
}
function eventoEnergia(tipo, x, y, z) {
  if (!jog || (jog.pos.x - x) ** 2 + (jog.pos.y - y) ** 2 + (jog.pos.z - z) ** 2 > 40 * 40) return;
  if (tipo === E.SINO) { som.sino(y); bichos && bichos.icone('nota', x + 0.5, y + 1.6, z + 0.5, 1.2, 0.5); }
  else if (tipo === E.CONFETE) { som.confete(); soltarConfete(x, y, z); }
}

// só o que a pessoa faz com as mãos conta para o mercado e as missões
// (areia caindo, folhas secando, grama crescendo e máquinas não contam)
let porJogador = false;
function comoJogador(fn) { porJogador = true; try { return fn(); } finally { porJogador = false; } }

function fazerCarinho(b) { bichos.carinho(b); mercado.evento('carinho'); }
function conversarCom(a) {
  aldeoes.conversar(a, jog, Math.sin(tempoDia * Math.PI * 2) < -0.15);
  mercado.evento('conversa');
  // com o mercado ligado, o aldeão abre a lojinha da vila
  if (mercado.op.mercado) setTimeout(() => { if (jogando && !pausado) mercado.abrirLoja(a); }, 650);
}

function quebrar(ponto) {
  if (!jogando || pausado) return;
  som.iniciar();
  const m = mirar(ponto);
  if (m.monstro) { monstros.espantar(m.monstro); return; }
  if (m.bicho) { fazerCarinho(m.bicho); return; }
  if (m.aldeao) { conversarCom(m.aldeao); return; }
  // com a Água na mão, "quebrar" recolhe a água (como um balde)
  if (barra[slotSel] === B.AGUA && recolherAgua(ponto)) return;
  const h = m.bloco;
  if (!h || h.y < 1) return;
  // cada toque arranca um pedaço; o último derruba o bloco
  const p = raio.ray.at(h.t + 0.001, new THREE.Vector3());
  if (comoJogador(() => escav.bater(h, p))) som.quebrar(); else som.bater(h.b);
}

// recolhe a fonte de água mirada; a água corrente que dependia dela seca sozinha
function recolherAgua(ponto) {
  const h = mundo.raycast(camera.position, direcaoDe(ponto), 6, true);
  if (!h || !AGUA[h.b]) return false;
  // mirou na água corrente: procura a fonte mais perto dali
  let alvo = h.b === B.AGUA ? h : null;
  for (let r = 1; !alvo && r <= 3; r++) {
    for (let dy = -r; dy <= r && !alvo; dy++) for (let dx = -r; dx <= r && !alvo; dx++) for (let dz = -r; dz <= r && !alvo; dz++) {
      if (mundo.bloco(h.x + dx, h.y + dy, h.z + dz) === B.AGUA) alvo = { x: h.x + dx, y: h.y + dy, z: h.z + dz };
    }
  }
  if (!alvo) { aviso('Essa água vem de longe', 1500, 'gota'); return true; }
  comoJogador(() => mundo.definir(alvo.x, alvo.y, alvo.z, AR));
  som.quebrar();
  return true;
}

const partQ = [];
const geoQ = new THREE.BoxGeometry(0.14, 0.14, 0.14);
function quebraParticulas(x, y, z, b) {
  const tile = BLOCOS[b].tiles[2];
  const cv = atlasCanvas.getContext('2d').getImageData((tile % 8) * 16 + 7, Math.floor(tile / 8) * 16 + 7, 1, 1).data;
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(`rgb(${cv[0]},${cv[1]},${cv[2]})`) });
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(geoQ, mat);
    m.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
    cena.add(m);
    partQ.push({ m, v: [(Math.random() - 0.5) * 3, Math.random() * 4 + 1, (Math.random() - 0.5) * 3], vida: 0.6 + Math.random() * 0.3 });
  }
}

// ---------- outros jogadores ----------
function adicionarOutro(j) {
  if (j.id === euId || outros.has(j.id)) return;
  const b = montarBoneco(CORES[j.cor % CORES.length] ?? CORES[0]);
  const et = etiqueta(j.nome);
  et.position.y = 2.25;
  b.grupo.add(et);
  const p = j.p || [0, 60, 0];
  b.grupo.position.set(p[0], p[1], p[2]);
  cena.add(b.grupo);
  outros.set(j.id, { ...b, nome: j.nome, corCss: '#' + (CORES[j.cor % CORES.length] ?? CORES[0]).toString(16).padStart(6, '0'), alvo: new THREE.Vector3(...p), yaw: 0, alvoYaw: (j.r && j.r[0]) || 0, fase: 0 });
}
function removerOutro(id) {
  const o = outros.get(id);
  if (!o) return;
  cena.remove(o.grupo);
  o.grupo.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material && x.material !== matModelo) { x.material.map && x.material.map.dispose(); x.material.dispose(); } });
  outros.delete(id);
}

// ---------- iniciar / sair ----------
function acharInicio() {
  // começa na rua da vila que fica perto do meio do mundo
  const v = mundo.vilas.regiao(0, 0);
  if (v && v.ruas.length) {
    const r = v.ruas[0];
    const x = v.x + r.dx * 6, z = v.z + r.dz * 6;
    return { x: x + 0.5, y: Math.max(mundo.alturaEm(x, z), NIVEL_AGUA) + 2, z: z + 0.5 };
  }
  // procura um lugar de terra firme perto da origem
  for (let r = 0; r < 200; r += 4) for (let a = 0; a < 8; a++) {
    const x = Math.round(Math.cos(a * 0.785) * r), z = Math.round(Math.sin(a * 0.785) * r);
    const h = mundo.alturaEm(x, z);
    if (h > NIVEL_AGUA + 1 && h < 40) return { x: x + 0.5, y: h + 2, z: z + 0.5 };
  }
  return { x: 0.5, y: 50, z: 0.5 };
}

let salvarLocalTimer = 0, edicoesPendentes = false;
function salvarLocal() {
  if (modo !== 'local' || !mundo) return;
  try {
    localStorage.setItem('pradaria.local', JSON.stringify({
      semente: mundo.semente, opcoes: { ...opcoesMundo }, edicoes: mundo.listarEdicoes(), pos: [jog.pos.x, jog.pos.y, jog.pos.z], yaw: jog.yaw, dia: tempoDia, barra,
    }));
  } catch {}
  edicoesPendentes = false;
}

function limparMundo() {
  if (sala) { sala.fechar(); sala = null; }
  for (const id of [...outros.keys()]) removerOutro(id);
  mapa.usarMundo(null);
  mapa.fechar();
  if (mundo) {
    for (const c of mundo.chunks.values()) for (const m of [c.malha, c.agua]) if (m) { cena.remove(m); m.geometry.dispose(); }
  }
  if (fisica) fisica.limpar();
  if (escav) { for (const k of [...escav.blocos.keys()]) escav.soltar(k); escav.atualizar(10, 0, 0); }
  if (bichos) for (let i = bichos.lista.length - 1; i >= 0; i--) bichos.remover(i);
  if (aldeoes) aldeoes.limpar();
  if (monstros) monstros.limpar();
  mundo = null; bichos = null; aldeoes = null; monstros = null; escav = null; fisica = null;
  mercado.parar();
}

function iniciarMundo({ semente, edicoes = [], pos = null, yaw = 0, opcoes = null }) {
  limparMundo();
  definirOpcoesMundo(opcoes); // antes do Mundo: a geração (vilas etc.) já lê as opções
  if (!opcoesMundo.cicloDia) tempoDia = 0.3;
  mundo = new Mundo(cena, matBlocos, matAgua, semente);
  mundo.raio = raioVisao();
  escav = new Escavacao(cena, mundo, matBlocos, atlasCanvas);
  fisica = new Fisica(cena, mundo, matBlocos);
  fisica.aoCair = (x, y, z) => { if (Math.abs(x - jog.pos.x) + Math.abs(z - jog.pos.z) < 24) som.passo(); };
  fisica.aoFolha = (x, y, z) => escav.estilhacar(x, y, z, B.FOLHAS, null, null);
  mundo.carregarEdicoes(edicoes);
  mundo.aoMudarBloco = (x, y, z, b, de, natural) => {
    edicoesPendentes = true;
    if (sala) sala.enviar(porJogador ? { t: 'bloco', x, y, z, b, de, j: 1 } : { t: 'bloco', x, y, z, b });
    if (fisica) fisica.mudou(x, y, z, b);
    if (porJogador) mercado.bloco(b, y, de, natural);
  };
  mundo.energia.aoEvento = eventoEnergia;
  minhaPlaca = null;
  jog = new Jogador(mundo);
  let avisoBorda = 0;
  jog.aoBorda = () => { if (tempoTotal - avisoBorda > 6) { avisoBorda = tempoTotal; aviso('Aqui é o fim do mundo! Só mar daqui pra frente', 2200, 'gota'); } };
  if (pos) Object.assign(jog.pos, { x: pos[0], y: pos[1], z: pos[2] });
  else Object.assign(jog.pos, acharInicio());
  jog.yaw = yaw;
  if (!ctrl) {
    ctrl = new Controles(canvas, jog, {
      usar, quebrar, alternarVoo, inventario: abrirInventario,
      slot: (i) => { if (i < barra.length) { slotSel = i; desenharBarra(); } },
      rolar: (d) => { slotSel = (slotSel + d + barra.length) % barra.length; desenharBarra(); },
      primeiroToque: () => som.iniciar(),
      mira: (p) => { miraToque = p; },
      travaMudou: () => {},
    });
  }
  ctrl.jog = jog;
  ctrl.sensToque = ajustes.sens;
  bichos = new Bichos(cena, mundo, som);
  aldeoes = new Aldeoes(cena, mundo, som, (...a) => bichos.icone(...a));
  aldeoes.aoEntrarVila = (v) => aviso(v.nome, 2600, 'vila');
  monstros = new Monstros(cena, mundo, som, bichos);
  monstros.aoSusto = () => {
    if (vida.dano(1)) { som.tom(200, 0.15, { tipo: 'sine', vol: 0.3, ate: 120 }); aviso('Ai! Toque no monstrinho ou acenda uma luz', 1800, 'coracao'); }
    else aviso('Buu! Toque no monstrinho para espantar', 1800, 'sorriso');
  };
  vida.reiniciar();
  mapa.usarMundo(mundo, 'pradaria.mapa.' + (modo === 'online' && mundoAtual ? mundoAtual.codigo : 'local'));
  aplicarMinimapa();
  som.ligado = ajustes.som;
  ajustarNevoa();
  desenharBarra();
  $('#bt-voar').classList.remove('ligado'); $('#bt-descer').hidden = true;
  // pré-carrega o pedaço onde o jogador está
  mundo.atualizar(jog.pos.x, jog.pos.z, 400);
  $('#menu').hidden = true;
  $('#hud').hidden = false;
  $('#fps').hidden = !ajustes.fps;
  jogando = true; pausado = false;
  setTimeout(() => { $('#dica-toque').style.opacity = 0; }, 9000);
}

// sem internet: continua o mundo salvo; se ainda não tem, ou `novo` vem com as opções escolhidas, cria um
function jogarLocal(novo = null) {
  let salvo = null;
  try { salvo = JSON.parse(localStorage.getItem('pradaria.local') || 'null'); } catch {}
  if (!salvo && !novo) { abrirNovo('local'); return; }
  if (novo) salvo = null;
  modo = 'local'; mundoAtual = null;
  if (salvo && salvo.barra) barra = salvo.barra;
  if (salvo) tempoDia = salvo.dia ?? 0.3;
  tempoDia = salvo ? salvo.dia ?? 0.3 : 0.3;
  iniciarMundo({
    semente: salvo ? salvo.semente : novo.semente ?? Math.floor(Math.random() * 1e9), edicoes: salvo ? salvo.edicoes : [],
    pos: salvo && salvo.pos, yaw: salvo ? salvo.yaw : 0,
    // mundos salvos antes das opções existirem continuam do jeito que eram (sem monstros)
    opcoes: salvo ? salvo.opcoes || PADRAO_MUNDO : novo.opcoes,
  });
  if (novo) salvarLocal();
  cmd.entrouLocal();
  mercado.iniciar({ opcoes: opcoesMundo, novo: !!novo });
  desenharBarra();
  $('#status').innerHTML = comIcone('casa', 'Sem internet');
  aviso('Bem-vindo à Pradaria!', 2500, 'flor');
}

async function jogarOnline(m) {
  $('#mundos-erro').textContent = '';
  modo = 'online'; mundoAtual = m;
  mostrarMenu('m-carregando');
  $('#carregando-txt').textContent = `Entrando em "${m.nome}"…`;
  let primeiro = true;
  sala = new Sala(m.codigo, {
    status: (s) => { if (jogando) $('#status').innerHTML = s === 'online' ? comIcone('globo', m.nome) : comIcone('ampulheta', 'Reconectando…'); },
    ola: (msg) => {
      euId = msg.eu;
      if (primeiro) {
        primeiro = false;
        const s = sala; sala = null; // evita que iniciarMundo feche a sala
        tempoDia = msg.dia ?? 0.3;
        iniciarMundo({ semente: msg.semente, edicoes: msg.edicoes, pos: msg.pos, yaw: 0, opcoes: msg.opcoes || m.opcoes });
        sala = s;
        cmd.entrouOnline(msg);
        mercado.iniciar({ opcoes: msg.opcoes, estado: msg.econ, sala: s });
        desenharBarra();
        $('#status').innerHTML = comIcone('globo', m.nome);
        aviso(`Bem-vindo, ${conta.usuario.nome}! Código do mundo: ${m.codigo}`, 3500, 'flor');
      } else {
        mundo.carregarEdicoes(msg.edicoes);
      }
      for (const id of [...outros.keys()]) removerOutro(id);
      for (const j of msg.jogadores) adicionarOutro(j);
    },
    entrou: (msg) => { adicionarOutro(msg.j); aviso(`${msg.j.nome} entrou no mundo`, 1800, 'acenar'); som.oi(); },
    saiu: (msg) => { const o = outros.get(msg.id); if (o) aviso(`${o.nome} saiu`); removerOutro(msg.id); },
    pos: (msg) => {
      const o = outros.get(msg.id);
      if (!o) return;
      o.alvo.set(msg.p[0], msg.p[1], msg.p[2]);
      o.alvoYaw = msg.r[0]; o.alvoPitch = msg.r[1];
    },
    bloco: (msg) => { if (mundo) mundo.definir(msg.x, msg.y, msg.z, msg.b, true); },
    emote: (msg) => {
      const o = outros.get(msg.id);
      const nome = nomeEmote(msg.e); // aceita nome novo ou emoji de versão antiga
      if (o && bichos && nome) bichos.icone(nome, o.grupo.position.x, o.grupo.position.y + 2.7, o.grupo.position.z, 2, 0.6);
    },
    erro: (msg) => { aviso(msg.msg || 'Erro', 3000); },
    econ: (msg) => { mercado.recebeu(msg.s, msg.feitos, msg.msg); desenharBarra(); },
    'econ-erro': (msg) => mercado.erro(msg.msg),
    fim: (texto) => { sala = null; sairDoMundo(); $('#mundos-erro').textContent = texto || ''; },
    ...cmd.rede,
  });
}

function sairDoMundo() {
  salvarLocal();
  cmd.saiu();
  if (sala && jog) sala.enviar({ t: 'pos', p: [jog.pos.x, jog.pos.y, jog.pos.z], r: [jog.yaw, jog.pitch] });
  limparMundo();
  jogando = false; pausado = false;
  fecharJanelas();
  $('#hud').hidden = true;
  if (conta.usuario) abrirMundos(); else mostrarMenu('m-inicio');
}

// ---------- menus de conta e mundos ----------
let modoConta = 'entrar', corEscolhida = 0;
function abrirConta(m) {
  modoConta = m;
  $('#conta-titulo').textContent = m === 'entrar' ? 'Entrar' : 'Criar conta';
  $('#c-ok').textContent = m === 'entrar' ? 'Entrar' : 'Criar e jogar';
  $('#c-senha').autocomplete = m === 'entrar' ? 'current-password' : 'new-password';
  $('#c-cores').hidden = m === 'entrar';
  $('#c-erro').textContent = '';
  const cc = $('#c-cores');
  if (!cc.childElementCount) CORES.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.style.background = '#' + c.toString(16).padStart(6, '0');
    b.setAttribute('aria-label', 'Cor da camiseta ' + (i + 1));
    b.addEventListener('click', () => { corEscolhida = i; cc.querySelectorAll('button').forEach((x, k) => x.classList.toggle('sel', k === i)); });
    if (i === 0) b.classList.add('sel');
    cc.appendChild(b);
  });
  mostrarMenu('m-conta');
  setTimeout(() => $('#c-nome').focus(), 50);
}
$('#bt-entrar').addEventListener('click', () => conta.token ? abrirMundos() : abrirConta('entrar'));
$('#bt-criar-conta').addEventListener('click', () => abrirConta('criar'));
$('#bt-sozinho').addEventListener('click', () => { som.iniciar(); jogarLocal(); });
$('#bt-sozinho2').addEventListener('click', () => { som.iniciar(); jogarLocal(); });
document.querySelector('[data-voltar]').addEventListener('click', () => mostrarMenu('m-inicio'));
document.querySelector('[data-voltar-mundos]').addEventListener('click', () => (modoNovo === 'local' && !conta.token ? mostrarMenu('m-inicio') : abrirMundos()));
$('#m-conta').addEventListener('submit', async (e) => {
  e.preventDefault();
  som.iniciar();
  $('#c-erro').textContent = '';
  $('#c-ok').disabled = true;
  try {
    const r = await api(modoConta === 'entrar' ? 'entrar' : 'cadastrar', { nome: $('#c-nome').value.trim(), senha: $('#c-senha').value, cor: corEscolhida });
    conta.salvar(r.token); conta.usuario = r.usuario;
    $('#c-senha').value = '';
    abrirMundos();
  } catch (err) { $('#c-erro').textContent = err.message; }
  $('#c-ok').disabled = false;
});
$('#bt-sair-conta').addEventListener('click', () => { conta.salvar(null); conta.usuario = null; mostrarMenu('m-inicio'); });

async function abrirMundos() {
  mostrarMenu('m-carregando');
  $('#carregando-txt').textContent = 'Buscando seus mundos…';
  try {
    if (!conta.usuario) conta.usuario = (await api('eu')).usuario;
    const { mundos } = await api('mundos');
    $('#m-nome').textContent = conta.usuario.nome;
    const l = $('#lista-mundos');
    l.innerHTML = '';
    if (!mundos.length) l.innerHTML = `<div class="vazio">${icone('broto')}<span>Você ainda não tem mundos. Crie um!</span></div>`;
    for (const m of mundos) {
      const b = document.createElement('button');
      b.className = 'mundo';
      b.innerHTML = `<span class="ic ${m.dono ? 'meu' : 'amigo'}">${icone(m.dono ? 'casa' : 'amigos')}</span><span class="txt"><b></b><small></small></span>${icone('entrar', 'ic-svg seta')}`;
      b.querySelector('b').textContent = m.nome;
      b.querySelector('small').textContent = `código ${m.codigo}` + (m.dono ? '' : ` · de ${m.nome_dono}`);
      b.querySelector('small').insertAdjacentHTML('beforeend', `<span class="ops-mini">${iconesOpcoes(m.opcoes)}</span>`);
      b.addEventListener('click', () => { som.iniciar(); jogarOnline(m); });
      l.appendChild(b);
    }
    mostrarMenu('m-mundos');
  } catch (err) {
    if (/sess|entrar|401/i.test(err.message)) { conta.salvar(null); conta.usuario = null; abrirConta('entrar'); $('#c-erro').textContent = 'Entre de novo, por favor.'; }
    else { mostrarMenu('m-inicio'); alert('Não consegui falar com o servidor agora. Você pode jogar sem internet.\n\n' + err.message); }
  }
}

// ---------- criar mundo: nome + opções (o que vai ter no mundo) + semente ----------
const iconesOpcoes = (o) => { const n = normalizarOpcoes(o); return (n.tipo !== 'normal' ? icone(TIPOS[n.tipo].icone, 'ic-svg ic-mini') : '') + icone(TAMANHOS[n.tamanho].icone, 'ic-svg ic-mini') + OPCOES_MUNDO.filter((x) => n[x.id]).map((x) => icone(x.icone, 'ic-svg ic-mini')).join(''); };
function resumoOpcoes(o) {
  const n = normalizarOpcoes(o);
  const t = TAMANHOS[n.tamanho];
  const com = OPCOES_MUNDO.filter((x) => n[x.id]).map((x) => x.nome);
  const sem = OPCOES_MUNDO.filter((x) => !n[x.id]).map((x) => x.nome.toLowerCase());
  return (n.tipo !== 'normal' ? TIPOS[n.tipo].nome + ' · ' : '') + `Mundo ${t.nome.toLowerCase()} · ` + (com.join(', ') || 'só blocos') + (sem.length ? ' · sem ' + sem.join(', ') : '');
}
let escolhaNovo = { ...PADRAO_NOVO };
function desenharOpcoesNovo() {
  const tp = $('#n-tipos');
  tp.innerHTML = '';
  for (const [id, t] of Object.entries(TIPOS)) {
    if (t.oculto && !location.hash.includes('teste')) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opcao-mundo'; b.dataset.tipo = id; b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="ic"></span><b></b><small></small>';
    b.querySelector('.ic').innerHTML = icone(t.icone); b.querySelector('b').textContent = t.nome; b.querySelector('small').textContent = t.desc;
    b.addEventListener('click', () => { escolhaNovo.tipo = id; marcarTamanho(); som.iniciar(); som.clique(); });
    tp.appendChild(b);
  }
  $('#n-tipos').hidden = $('#n-tipos-titulo').hidden = tp.childElementCount < 2;
  const lt = $('#n-tamanhos');
  lt.innerHTML = '';
  for (const [id, t] of Object.entries(TAMANHOS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opcao-mundo'; b.dataset.tamanho = id; b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="ic"></span><b></b><small></small>';
    b.querySelector('.ic').innerHTML = icone(t.icone); b.querySelector('b').textContent = t.nome; b.querySelector('small').textContent = t.desc;
    b.addEventListener('click', () => { escolhaNovo.tamanho = id; marcarTamanho(); som.iniciar(); som.clique(); });
    lt.appendChild(b);
  }
  marcarTamanho();
  const l = $('#n-lista');
  l.innerHTML = '';
  for (const o of OPCOES_MUNDO) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opcao-mundo'; b.dataset.opcao = o.id;
    b.setAttribute('aria-pressed', String(!!escolhaNovo[o.id]));
    b.innerHTML = '<span class="ic"></span><span><b></b><small></small></span>';
    b.querySelector('.ic').innerHTML = icone(o.icone);
    b.querySelector('b').textContent = o.nome;
    b.querySelector('small').textContent = o.desc;
    b.addEventListener('click', () => {
      escolhaNovo[o.id] = !escolhaNovo[o.id];
      // "Monstros machucam" só faz sentido com monstrinhos: um liga/desliga o outro
      if (o.id === 'monstrosMachucam' && escolhaNovo.monstrosMachucam) escolhaNovo.monstros = true;
      if (o.id === 'monstros' && !escolhaNovo.monstros) escolhaNovo.monstrosMachucam = false;
      for (const x of l.children) x.setAttribute('aria-pressed', String(!!escolhaNovo[x.dataset.opcao]));
      som.iniciar(); som.clique();
    });
    l.appendChild(b);
  }
  marcarTamanho();
}
function marcarTamanho() {
  for (const b of $('#n-tamanhos').children) { const sel = b.dataset.tamanho === escolhaNovo.tamanho; b.setAttribute('aria-pressed', String(sel)); b.setAttribute('aria-checked', String(sel)); }
  for (const b of $('#n-tipos').children) { const sel = b.dataset.tipo === escolhaNovo.tipo; b.setAttribute('aria-pressed', String(sel)); b.setAttribute('aria-checked', String(sel)); }
  // alguns tipos não têm monstrinhos (ex.: Linha do Tempo)
  const sem = !!TIPOS[escolhaNovo.tipo].semMonstros;
  for (const id of ['monstros', 'monstrosMachucam']) {
    const mb = $(`#n-lista [data-opcao="${id}"]`);
    if (mb) { mb.disabled = sem; if (sem) { escolhaNovo[id] = false; mb.setAttribute('aria-pressed', 'false'); } }
  }
}
let modoNovo = 'criar';
function abrirNovo(modoN) {
  modoNovo = modoN;
  const comOpcoes = modoN !== 'codigo';
  $('#novo-titulo').textContent = modoN === 'codigo' ? 'Entrar no mundo de um amigo' : modoN === 'local' ? 'Novo mundo sem internet' : 'Novo mundo';
  $('#novo-rotulo').firstChild.textContent = modoN === 'codigo' ? 'Código do mundo' : 'Nome do mundo';
  $('#novo-rotulo').hidden = modoN === 'local';
  $('#n-nome').required = modoN !== 'local';
  $('#n-nome').value = ''; $('#n-nome').maxLength = modoN === 'codigo' ? 8 : 24; $('#n-erro').textContent = '';
  $('#m-novo button[type=submit]').textContent = modoN === 'codigo' ? 'Entrar' : 'Criar';
  $('#n-opcoes').hidden = !comOpcoes;
  if (comOpcoes) { escolhaNovo = { ...PADRAO_NOVO }; $('#n-semente').value = ''; desenharOpcoesNovo(); }
  mostrarMenu('m-novo');
}
$('#bt-novo-mundo').addEventListener('click', () => abrirNovo('criar'));
$('#bt-codigo').addEventListener('click', () => abrirNovo('codigo'));
$('#m-novo').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#n-erro').textContent = '';
  const semente = $('#n-semente').value.trim();
  if (modoNovo === 'local') { som.iniciar(); jogarLocal({ opcoes: { ...escolhaNovo }, semente: sementeDeTexto(semente) }); return; }
  try {
    const v = $('#n-nome').value.trim();
    const r = modoNovo === 'criar' ? await api('mundos', { nome: v, opcoes: { ...escolhaNovo }, semente }) : await api('mundos/entrar', { codigo: v.toUpperCase() });
    som.iniciar();
    jogarOnline(r.mundo);
  } catch (err) { $('#n-erro').textContent = err.message; }
});

// ---------- laço principal ----------
let ultimo = performance.now(), acumPos = 0, quadros = 0, tempoFps = 0, tempoTotal = 0, ultimoPasso = 0;
let miraToque = null;
const passoAntes = { x: 0, z: 0 };
const corTmp = new THREE.Color();

function laco(agora) {
  requestAnimationFrame(laco);
  // limite de FPS (economiza bateria); a folga de 2 ms evita pular quadro à toa
  if (jogando && ajustes.fpsMax && agora - ultimo < 1000 / ajustes.fpsMax - 2) return;
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;
  if (!jogando) { renderer.render(cena, camera); return; }
  tempoTotal += dt;

  if (!pausado) {
    const ent = ctrl.atualizar();
    jog.atualizar(dt, ent);
    if (jog.noChao && Math.floor(jog.passo / 1.8) !== ultimoPasso) { ultimoPasso = Math.floor(jog.passo / 1.8); som.passo(); }
  }
  camera.position.set(jog.pos.x, jog.pos.y + OLHOS, jog.pos.z);
  camera.rotation.set(jog.pitch, jog.yaw, 0, 'YXZ');

  mundo.energia.noite = graf.U.uNoite.value > 0.5;
  mundo.atualizar(jog.pos.x, jog.pos.z, ehToque ? 5 : 8);
  if (!pausado) vigiarPlaca();
  if (jog.quicou) { jog.quicou = false; som.boing(); }
  bichos.atualizar(dt, jog, tempoTotal);
  aldeoes.atualizar(dt, jog, Math.sin(tempoDia * Math.PI * 2));
  monstros.atualizar(pausado ? 0 : dt, jog, tempoDia);
  if (!pausado) vida.atualizar(dt);
  mapa.atualizar(dt, jog, outros, bichos);
  mercado.passo(jog.pos.x - passoAntes.x, jog.pos.z - passoAntes.z, jog, mundo.alturaEm(Math.floor(jog.pos.x), Math.floor(jog.pos.z)));
  passoAntes.x = jog.pos.x; passoAntes.z = jog.pos.z;

  // contorno do bloco mirado
  if (!ehToque || miraToque) {
    const h = mundo.raycast(camera.position, direcaoDe(miraToque), 6);
    if (h && h.t > 0.05) { contorno.visible = true; contorno.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); } else contorno.visible = false;
  } else contorno.visible = false;

  escav.atualizar(dt, jog.pos.x, jog.pos.z);
  fisica.atualizar(dt);
  // partículas de quebra
  for (let i = partQ.length - 1; i >= 0; i--) {
    const q = partQ[i];
    q.vida -= dt;
    if (q.confete) { q.v[1] = Math.max(q.v[1] - 14 * dt, -1.6); q.v[0] *= 1 - dt * 1.5; q.v[2] *= 1 - dt * 1.5; q.m.rotation.x += q.giro * dt; q.m.rotation.y += q.giro * 0.7 * dt; }
    else q.v[1] -= 15 * dt;
    q.m.position.x += q.v[0] * dt; q.m.position.y += q.v[1] * dt; q.m.position.z += q.v[2] * dt;
    if (q.vida <= 0) { cena.remove(q.m); partQ.splice(i, 1); }
  }

  // outros jogadores (interpolação suave)
  for (const o of outros.values()) {
    const g = o.grupo.position;
    const dx = o.alvo.x - g.x, dz = o.alvo.z - g.z;
    const andando = Math.hypot(dx, dz) > 0.05;
    g.lerp(o.alvo, Math.min(1, dt * 10));
    let d = ((o.alvoYaw - o.grupo.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    o.grupo.rotation.y += d * Math.min(1, dt * 10);
    o.cabeca.rotation.x = -(o.alvoPitch || 0) * 0.6;
    o.fase += andando ? dt * 10 : 0;
    const s = andando ? Math.sin(o.fase) * 0.7 : 0;
    o.membros[0].rotation.x = s; o.membros[1].rotation.x = -s; o.membros[2].rotation.x = -s; o.membros[3].rotation.x = s;
  }

  // ciclo de dia e noite (a noite é clarinha: nada de medo!)
  if (opcoesMundo.cicloDia) tempoDia = (tempoDia + dt / DURACAO_DIA) % 1;
  const ang = tempoDia * Math.PI * 2;
  const s = Math.sin(ang); // 0.25 -> 1 (meio-dia), 0.75 -> -1 (meia-noite)
  const luz = THREE.MathUtils.clamp(0.62 + s * 0.6, 0.5, 1);
  const horizonte = graf.atualizar(dt, tempoDia, jog.pos, mundo);
  cena.fog.color.copy(horizonte);
  graf.ajustarNevoa(cena.fog.near, cena.fog.far, horizonte);
  const cx = camera.position.x, cz = camera.position.z;
  void ang;
  nuvens.position.x = ((tempoTotal * 1.2) % 360) - 180 + Math.floor(cx / 360) * 360;
  nuvens.position.z = Math.floor(cz / 360) * 360;
  nuvens.material.color.setRGB(0.035, 0.04, 0.07).lerp(corTmp.setRGB(1, 1, 1), 1 - graf.U.uNoite.value).lerp(corTmp.setRGB(1, 0.72, 0.55), graf.U.uPor.value * 0.6);

  // rede: posição ~8x por segundo
  if (sala) {
    acumPos += dt;
    if (acumPos > 0.125) { acumPos = 0; sala.enviar({ t: 'pos', p: [+jog.pos.x.toFixed(2), +jog.pos.y.toFixed(2), +jog.pos.z.toFixed(2)], r: [+jog.yaw.toFixed(2), +jog.pitch.toFixed(2)] }); }
  }
  // salvamento local a cada 5s
  salvarLocalTimer += dt;
  if (salvarLocalTimer > 5) { salvarLocalTimer = 0; if (modo === 'local') salvarLocal(); }

  renderer.render(cena, camera);
  quadros++; tempoFps += dt;
  if (tempoFps > 1) {
    if (ajustes.fps) $('#fps').textContent = `${quadros} fps · ${renderer.info.render.calls} draws · ${opcoesGraficas().nome}`;
    vigiarDesempenho(quadros / tempoFps);
    quadros = 0; tempoFps = 0;
  }
}
// se o aparelho sofrer, deixa os gráficos mais leves sozinho (uma vez por nível)
let segundosLentos = 0, segundosJogando = 0;
function vigiarDesempenho(fps) {
  if (!jogando || pausado || document.hidden || window.__semAuto || !ajustes.auto) return;
  segundosJogando++;
  if (segundosJogando < 6) return; // espera o mundo carregar
  segundosLentos = fps < 24 ? segundosLentos + 1 : 0;
  if (segundosLentos >= 5) {
    segundosLentos = 0;
    const ordem = ['baixa', 'media', 'alta', 'ultra'];
    let i = ordem.indexOf(ajustes.graf);
    if (i < 0) i = opcoesGraficas().sombra > 1024 ? 2 : 1; // personalizado: desce para o preset logo abaixo
    if (i > 0) {
      ajustes.graf = ordem[i - 1]; salvarAjustes(); aplicarGraficos(); preencherGraficos();
      aviso('Deixei os gráficos mais leves para rodar liso', 2500, 'brilho');
    } else if (ajustes.qual > 0.6) {
      ajustes.qual = Math.max(0.6, +(ajustes.qual - 0.1).toFixed(1)); salvarAjustes(); redimensionar();
    }
  }
}
requestAnimationFrame(laco);
addEventListener('beforeunload', () => salvarLocal());
document.addEventListener('visibilitychange', () => { if (document.hidden) salvarLocal(); });
void edicoesPendentes;

// início: se já tem sessão, vai direto para os mundos
camera.position.set(0, 40, 0);
if (conta.token) abrirMundos(); else mostrarMenu('m-inicio');

// modo de teste automatizado
if (location.hash === '#teste') { window.__jogo = { get outros() { return outros.size; }, get sala() { return sala; }, get jog() { return jog; }, get mundo() { return mundo; }, get bichos() { return bichos; }, get aldeoes() { return aldeoes; }, get monstros() { return monstros; }, mercado, conversarCom, comoJogador, vida, opcoesMundo, get tempoDia() { return tempoDia; }, set dia(v) { tempoDia = v; }, get dia() { return tempoDia; }, get barra() { return barra; }, set slot(v) { slotSel = v; }, camera, graf, renderer, ajustes, jogarLocal, usar, quebrar, cmd, mapa }; }

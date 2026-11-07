// Pradaria: jogo de construir e explorar, pacífico, para o navegador.
import * as THREE from '../vendor/three.module.min.js';
import { criarAtlas, iconeBloco, INVENTARIO, B, AR, BLOCOS, SOLIDO } from './blocos.js';
import { Mundo, ALT, NIVEL_AGUA } from './mundo.js';
import { Jogador, OLHOS } from './jogador.js';
import { Controles } from './controles.js';
import { Bichos } from './animais.js';
import { Som } from './som.js';
import { montarBoneco, etiqueta, matModelo, caixa, juntar } from './modelos.js';
import { conta, api, Sala } from './rede.js';

const $ = (s) => document.querySelector(s);
const CORES = [0x3f6fd9, 0xe8433f, 0x4caf50, 0xf2c72e, 0x9c5bd9, 0xf29ac2, 0xff8a3d, 0x2bb3b3];

// ---------- ajustes salvos ----------
const ehToque = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (ehToque) document.body.classList.add('toque');
const AJ_PADRAO = { dist: ehToque ? 3 : 4, qual: ehToque ? 0.8 : 1, sens: 0.0055, som: true, fps: false };
let ajustes = { ...AJ_PADRAO };
try { Object.assign(ajustes, JSON.parse(localStorage.getItem('pradaria.ajustes') || '{}')); } catch {}
const salvarAjustes = () => { try { localStorage.setItem('pradaria.ajustes', JSON.stringify(ajustes)); } catch {} };

// ---------- renderização ----------
const canvas = $('#tela');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
const corCeuDia = new THREE.Color(0x8fd3ff), corCeuNoite = new THREE.Color(0x1d2b52), corPor = new THREE.Color(0xffb27a);
cena.background = new THREE.Color(0x8fd3ff);
cena.fog = new THREE.Fog(0x8fd3ff, 30, 60);

function redimensionar() {
  const pr = Math.min(window.devicePixelRatio || 1, 2) * ajustes.qual;
  renderer.setPixelRatio(Math.max(0.4, pr));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
redimensionar();

const { tex: atlas, canvas: atlasCanvas } = criarAtlas();
const matBlocos = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5 });
const matAgua = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false });

// sol, lua e nuvens
const sol = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false }));
const lua = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ color: 0xf0f4ff, fog: false }));
cena.add(sol, lua);
const nuvens = (() => {
  const g = [];
  const r = Math.random;
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 360, z = (r() - 0.5) * 360;
    const w = 12 + r() * 20, d = 8 + r() * 14;
    g.push(caixa(w, 3, d, 0xffffff, x, 0, z));
    if (r() < 0.6) g.push(caixa(w * 0.6, 3, d * 0.6, 0xffffff, x + w * 0.3, 1.5, z + d * 0.2));
  }
  const m = new THREE.Mesh(juntar(g), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, fog: false }));
  m.position.y = ALT + 20;
  cena.add(m);
  return m;
})();

// contorno do bloco mirado
const contorno = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
contorno.visible = false;
cena.add(contorno);

// ---------- estado do jogo ----------
const som = new Som();
let mundo = null, jog = null, ctrl = null, bichos = null, sala = null;
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
function aviso(txt, ms = 1800) {
  const el = $('#aviso');
  el.textContent = txt; el.classList.add('mostra');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove('mostra'), ms);
}

function desenharBarra() {
  const el = $('#barra');
  el.innerHTML = '';
  barra.forEach((id, i) => {
    const b = document.createElement('button');
    b.className = 'slot' + (i === slotSel ? ' sel' : '');
    b.setAttribute('aria-label', BLOCOS[id].nome);
    b.appendChild(iconeBloco(atlasCanvas, id, 48));
    b.addEventListener('click', () => { slotSel = i; som.clique(); desenharBarra(); aviso(BLOCOS[id].nome, 900); });
    el.appendChild(b);
  });
  const mais = document.createElement('button');
  mais.className = 'slot mais'; mais.textContent = '＋'; mais.setAttribute('aria-label', 'Todos os blocos');
  mais.addEventListener('click', abrirInventario);
  el.appendChild(mais);
}

function abrirInventario() {
  if (!jogando) return;
  const g = $('#grade');
  if (!g.childElementCount) {
    for (const id of INVENTARIO) {
      const b = document.createElement('button');
      b.title = BLOCOS[id].nome;
      b.appendChild(iconeBloco(atlasCanvas, id, 48));
      b.addEventListener('click', () => {
        const ja = barra.indexOf(id);
        if (ja >= 0) slotSel = ja; else barra[slotSel] = id;
        som.clique(); desenharBarra(); fecharJanelas(); aviso(BLOCOS[id].nome, 900);
      });
      g.appendChild(b);
    }
  }
  if (document.pointerLockElement) document.exitPointerLock();
  $('#inventario').hidden = false;
  pausado = true;
}

function abrirPausa() {
  if (document.pointerLockElement) document.exitPointerLock();
  $('#aj-dist').value = ajustes.dist; $('#aj-qual').value = ajustes.qual; $('#aj-sens').value = ajustes.sens;
  $('#aj-som').checked = ajustes.som; $('#aj-fps').checked = ajustes.fps;
  $('#pausa-mundo').textContent = modo === 'online' ? `Mundo: ${mundoAtual.nome} · código ${mundoAtual.codigo}` : 'Mundo sem internet (salvo neste aparelho)';
  $('#pausa').hidden = false;
  pausado = true;
}
function fecharJanelas() {
  $('#inventario').hidden = true; $('#pausa').hidden = true;
  pausado = false;
}
document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharJanelas));
$('#bt-menu').addEventListener('click', abrirPausa);
addEventListener('keydown', (e) => {
  if (!jogando) return;
  if (e.code === 'Escape' && pausado) fecharJanelas();
  else if (e.code === 'KeyP') abrirPausa();
});
$('#aj-dist').addEventListener('input', (e) => { ajustes.dist = +e.target.value; if (mundo) mundo.raio = ajustes.dist; salvarAjustes(); ajustarNevoa(); });
$('#aj-qual').addEventListener('input', (e) => { ajustes.qual = +e.target.value; salvarAjustes(); redimensionar(); });
$('#aj-sens').addEventListener('input', (e) => { ajustes.sens = +e.target.value; if (ctrl) ctrl.sensToque = ajustes.sens; salvarAjustes(); });
$('#aj-som').addEventListener('change', (e) => { ajustes.som = e.target.checked; som.ligado = ajustes.som; salvarAjustes(); });
$('#aj-fps').addEventListener('change', (e) => { ajustes.fps = e.target.checked; $('#fps').hidden = !ajustes.fps; salvarAjustes(); });
$('#bt-sair-mundo').addEventListener('click', sairDoMundo);
$('#bt-voar').addEventListener('click', () => alternarVoo());
document.querySelectorAll('[data-emote]').forEach((b) => b.addEventListener('click', () => {
  const e = b.dataset.emote;
  som.oi();
  if (sala) sala.enviar({ t: 'emote', e });
  if (bichos) bichos.emoji(e, jog.pos.x + Math.sin(-jog.yaw) * -1.2, jog.pos.y + 1.9, jog.pos.z - Math.cos(jog.yaw) * 1.2, 1.4, 0.5);
}));

function ajustarNevoa() {
  const d = ajustes.dist * 16;
  cena.fog.near = d * 0.5; cena.fog.far = d * 0.95;
}

function alternarVoo() {
  if (!jog) return;
  jog.voando = !jog.voando;
  jog.vel.y = jog.voando ? 2 : 0;
  $('#bt-voar').classList.toggle('ligado', jog.voando);
  $('#bt-descer').hidden = !jog.voando;
  aviso(jog.voando ? 'Voando! 🕊️' : 'Andando', 900);
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
  return { bloco: ha ? null : hb, bicho: ha ? ha.bicho : null };
}

function usar(ponto) {
  if (!jogando || pausado) return;
  som.iniciar();
  const m = mirar(ponto);
  if (m.bicho) { bichos.carinho(m.bicho); return; }
  const h = m.bloco;
  if (!h) return;
  const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2];
  const novo = barra[slotSel];
  if (y < 1 || y >= ALT) return;
  const atual = mundo.bloco(x, y, z);
  if (atual !== AR && atual !== B.AGUA && !BLOCOS[atual].planta) return;
  if (SOLIDO[novo] && jog.ocupa(x, y, z)) return;
  if (BLOCOS[novo].planta && !SOLIDO[mundo.bloco(x, y - 1, z)]) return;
  mundo.definir(x, y, z, novo);
  som.colocar();
}

function quebrar(ponto) {
  if (!jogando || pausado) return;
  som.iniciar();
  const m = mirar(ponto);
  if (m.bicho) { bichos.carinho(m.bicho); return; }
  const h = m.bloco;
  if (!h || h.y < 1) return;
  mundo.definir(h.x, h.y, h.z, AR);
  som.quebrar();
  quebraParticulas(h.x, h.y, h.z, h.b);
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
  outros.set(j.id, { ...b, nome: j.nome, alvo: new THREE.Vector3(...p), yaw: 0, alvoYaw: (j.r && j.r[0]) || 0, fase: 0 });
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
      semente: mundo.semente, edicoes: mundo.listarEdicoes(), pos: [jog.pos.x, jog.pos.y, jog.pos.z], yaw: jog.yaw, dia: tempoDia, barra,
    }));
  } catch {}
  edicoesPendentes = false;
}

function limparMundo() {
  if (sala) { sala.fechar(); sala = null; }
  for (const id of [...outros.keys()]) removerOutro(id);
  if (mundo) {
    for (const c of mundo.chunks.values()) for (const m of [c.malha, c.agua]) if (m) { cena.remove(m); m.geometry.dispose(); }
  }
  if (bichos) for (let i = bichos.lista.length - 1; i >= 0; i--) bichos.remover(i);
  mundo = null; bichos = null;
}

function iniciarMundo({ semente, edicoes = [], pos = null, yaw = 0 }) {
  limparMundo();
  mundo = new Mundo(cena, matBlocos, matAgua, semente);
  mundo.raio = ajustes.dist;
  mundo.carregarEdicoes(edicoes);
  mundo.aoMudarBloco = (x, y, z, b) => {
    edicoesPendentes = true;
    if (sala) sala.enviar({ t: 'bloco', x, y, z, b });
  };
  jog = new Jogador(mundo);
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

function jogarLocal() {
  modo = 'local'; mundoAtual = null;
  let salvo = null;
  try { salvo = JSON.parse(localStorage.getItem('pradaria.local') || 'null'); } catch {}
  if (salvo && salvo.barra) barra = salvo.barra;
  if (salvo) tempoDia = salvo.dia ?? 0.3;
  iniciarMundo({ semente: salvo ? salvo.semente : Math.floor(Math.random() * 1e9), edicoes: salvo ? salvo.edicoes : [], pos: salvo && salvo.pos, yaw: salvo ? salvo.yaw : 0 });
  $('#status').textContent = '🏡 Sem internet';
  aviso('Bem-vindo à Pradaria! 🌼', 2500);
}

async function jogarOnline(m) {
  modo = 'online'; mundoAtual = m;
  mostrarMenu('m-carregando');
  $('#carregando-txt').textContent = `Entrando em "${m.nome}"…`;
  let primeiro = true;
  sala = new Sala(m.codigo, {
    status: (s) => { if (jogando) $('#status').textContent = s === 'online' ? `🌍 ${m.nome}` : '⏳ Reconectando…'; },
    ola: (msg) => {
      euId = msg.eu;
      if (primeiro) {
        primeiro = false;
        const s = sala; sala = null; // evita que iniciarMundo feche a sala
        tempoDia = msg.dia ?? 0.3;
        iniciarMundo({ semente: msg.semente, edicoes: msg.edicoes, pos: msg.pos, yaw: 0 });
        sala = s;
        $('#status').textContent = `🌍 ${m.nome}`;
        aviso(`Bem-vindo, ${conta.usuario.nome}! Código do mundo: ${m.codigo}`, 3500);
      } else {
        mundo.carregarEdicoes(msg.edicoes);
      }
      for (const id of [...outros.keys()]) removerOutro(id);
      for (const j of msg.jogadores) adicionarOutro(j);
    },
    entrou: (msg) => { adicionarOutro(msg.j); aviso(`${msg.j.nome} entrou no mundo 👋`); som.oi(); },
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
      if (o && bichos) bichos.emoji(msg.e, o.grupo.position.x, o.grupo.position.y + 2.7, o.grupo.position.z, 2, 0.6);
    },
    erro: (msg) => { aviso(msg.msg || 'Erro', 3000); },
  });
}

function sairDoMundo() {
  salvarLocal();
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
document.querySelector('[data-voltar-mundos]').addEventListener('click', () => abrirMundos());
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
    if (!mundos.length) l.innerHTML = '<div class="vazio">Você ainda não tem mundos. Crie um! 🌱</div>';
    for (const m of mundos) {
      const b = document.createElement('button');
      b.className = 'mundo';
      b.innerHTML = `<span class="ic">${m.dono ? '🏡' : '🤝'}</span><span><b></b><small></small></span>`;
      b.querySelector('b').textContent = m.nome;
      b.querySelector('small').textContent = `código ${m.codigo}` + (m.dono ? '' : ` · de ${m.nome_dono}`);
      b.addEventListener('click', () => { som.iniciar(); jogarOnline(m); });
      l.appendChild(b);
    }
    mostrarMenu('m-mundos');
  } catch (err) {
    if (/sess|entrar|401/i.test(err.message)) { conta.salvar(null); conta.usuario = null; abrirConta('entrar'); $('#c-erro').textContent = 'Entre de novo, por favor.'; }
    else { mostrarMenu('m-inicio'); alert('Não consegui falar com o servidor agora. Você pode jogar sem internet.\n\n' + err.message); }
  }
}

let modoNovo = 'criar';
$('#bt-novo-mundo').addEventListener('click', () => {
  modoNovo = 'criar';
  $('#novo-titulo').textContent = 'Novo mundo';
  $('#novo-rotulo').firstChild.textContent = 'Nome do mundo';
  $('#n-nome').value = ''; $('#n-nome').maxLength = 24; $('#n-erro').textContent = '';
  mostrarMenu('m-novo');
});
$('#bt-codigo').addEventListener('click', () => {
  modoNovo = 'codigo';
  $('#novo-titulo').textContent = 'Entrar no mundo de um amigo';
  $('#novo-rotulo').firstChild.textContent = 'Código do mundo';
  $('#n-nome').value = ''; $('#n-nome').maxLength = 8; $('#n-erro').textContent = '';
  mostrarMenu('m-novo');
});
$('#m-novo').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#n-erro').textContent = '';
  try {
    const v = $('#n-nome').value.trim();
    const r = modoNovo === 'criar' ? await api('mundos', { nome: v }) : await api('mundos/entrar', { codigo: v.toUpperCase() });
    som.iniciar();
    jogarOnline(r.mundo);
  } catch (err) { $('#n-erro').textContent = err.message; }
});

// ---------- laço principal ----------
let ultimo = performance.now(), acumPos = 0, quadros = 0, tempoFps = 0, tempoTotal = 0, ultimoPasso = 0;
let miraToque = null;
const corTmp = new THREE.Color();

function laco(agora) {
  requestAnimationFrame(laco);
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

  mundo.atualizar(jog.pos.x, jog.pos.z, ehToque ? 5 : 8);
  bichos.atualizar(dt, jog, tempoTotal);

  // contorno do bloco mirado
  if (!ehToque || miraToque) {
    const h = mundo.raycast(camera.position, direcaoDe(miraToque), 6);
    if (h) { contorno.visible = true; contorno.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); } else contorno.visible = false;
  } else contorno.visible = false;

  // partículas de quebra
  for (let i = partQ.length - 1; i >= 0; i--) {
    const q = partQ[i];
    q.vida -= dt; q.v[1] -= 15 * dt;
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
  tempoDia = (tempoDia + dt / DURACAO_DIA) % 1;
  const ang = tempoDia * Math.PI * 2;
  const s = Math.sin(ang); // 0.25 -> 1 (meio-dia), 0.75 -> -1 (meia-noite)
  const luz = THREE.MathUtils.clamp(0.62 + s * 0.6, 0.5, 1);
  const dia = THREE.MathUtils.clamp(s * 2 + 0.5, 0, 1);
  corTmp.copy(corCeuNoite).lerp(corCeuDia, dia);
  const por = Math.max(0, 1 - Math.abs(s) * 4) * 0.45;
  corTmp.lerp(corPor, por);
  cena.background.copy(corTmp); cena.fog.color.copy(corTmp);
  matBlocos.color.setScalar(luz); matAgua.color.setScalar(luz); matModelo.color.setScalar(luz);
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  sol.position.set(cx + Math.cos(ang) * 150, cy + s * 150, cz + 30);
  lua.position.set(cx - Math.cos(ang) * 150, cy - s * 150, cz + 30);
  sol.lookAt(camera.position); lua.lookAt(camera.position);
  nuvens.position.x = ((tempoTotal * 1.2) % 360) - 180 + Math.floor(cx / 360) * 360;
  nuvens.position.z = Math.floor(cz / 360) * 360;
  nuvens.material.color.setScalar(Math.max(0.55, luz));

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
  if (tempoFps > 1) { if (ajustes.fps) $('#fps').textContent = `${quadros} fps · ${renderer.info.render.calls} draws`; quadros = 0; tempoFps = 0; }
}
requestAnimationFrame(laco);
addEventListener('beforeunload', () => salvarLocal());
document.addEventListener('visibilitychange', () => { if (document.hidden) salvarLocal(); });
void edicoesPendentes;

// início: se já tem sessão, vai direto para os mundos
camera.position.set(0, 40, 0);
if (conta.token) abrirMundos(); else mostrarMenu('m-inicio');

// modo de teste automatizado
if (location.hash === '#teste') { window.__jogo = { get outros() { return outros.size; }, get sala() { return sala; }, get jog() { return jog; }, get mundo() { return mundo; }, get bichos() { return bichos; }, jogarLocal, usar, quebrar }; }

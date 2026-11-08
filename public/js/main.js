// Pradaria: mundo aberto pacífico no navegador — cidade, carros, campo, bichos e amigos.
import * as THREE from '../vendor/three.module.min.js';
import { Terreno, NIVEL_AGUA, TAM } from './terreno.js';
import { Garagem, montarCarro, MODELOS } from './carros.js';
import { Personagem } from './personagem.js';
import { Controles } from './controles.js';
import { Bichos } from './animais.js';
import { Som } from './som.js';
import { montarBoneco, etiqueta, matLowPoly, peca, juntar, CORES } from './modelos.js';
import { conta, api, Sala } from './rede.js';

const $ = (s) => document.querySelector(s);

// ---------- ajustes salvos ----------
const ehToque = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (ehToque) document.body.classList.add('toque');
const AJ_PADRAO = { dist: ehToque ? 2 : 3, qual: ehToque ? 0.75 : 1, sens: 0.006, som: true, fps: false };
let ajustes = { ...AJ_PADRAO };
try { Object.assign(ajustes, JSON.parse(localStorage.getItem('pradaria.ajustes2') || '{}')); } catch {}
const salvarAjustes = () => { try { localStorage.setItem('pradaria.ajustes2', JSON.stringify(ajustes)); } catch {} };

// ---------- renderização ----------
const canvas = $('#tela');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !ehToque, powerPreference: 'low-power' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 1, 0.3, 700);
const corCeuDia = new THREE.Color(0x9fd8ff), corCeuNoite = new THREE.Color(0x24345e), corPor = new THREE.Color(0xffb27a);
cena.background = new THREE.Color(0x9fd8ff);
cena.fog = new THREE.Fog(0x9fd8ff, 80, 150);

const luzCeu = new THREE.HemisphereLight(0xdff1ff, 0x7a8f5a, 1.1);
const luzSol = new THREE.DirectionalLight(0xfff4e0, 1.6);
cena.add(luzCeu, luzSol, luzSol.target);

function redimensionar() {
  const pr = Math.min(window.devicePixelRatio || 1, 2) * ajustes.qual;
  renderer.setPixelRatio(Math.max(0.4, pr));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
redimensionar();

// água (um plano grande que acompanha o jogador)
const agua = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3d9be0, transparent: true, opacity: 0.82 }));
agua.position.y = NIVEL_AGUA;
cena.add(agua);

// sol, lua e nuvens
const sol = new THREE.Mesh(new THREE.CircleGeometry(16, 16), new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false }));
const lua = new THREE.Mesh(new THREE.CircleGeometry(10, 16), new THREE.MeshBasicMaterial({ color: 0xf0f4ff, fog: false }));
cena.add(sol, lua);
const nuvens = (() => {
  const P = [];
  const bola = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 22; i++) {
    const x = (Math.random() - 0.5) * 700, z = (Math.random() - 0.5) * 700, w = 10 + Math.random() * 14;
    for (let k = 0; k < 3; k++) P.push(peca(bola, 0xffffff, [x + (k - 1) * w * 0.6, Math.random() * 3, z + (Math.random() - 0.5) * 6], [0, 0, 0], [w * 0.7, w * 0.3, w * 0.5]));
  }
  const m = new THREE.Mesh(juntar(P), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, fog: false }));
  m.position.y = 130;
  cena.add(m);
  return m;
})();

// ---------- estado ----------
const som = new Som();
let terreno = null, garagem = null, bichos = null, jog = null, ctrl = null, sala = null;
let jogando = false, pausado = false;
let modo = 'local', mundoAtual = null, minhaCor = 0;
const cam = { yaw: Math.PI, pitch: 0.35, dist: 7 };
let ultimoGiro = 0;
let tempoDia = 0.3;
const DURACAO_DIA = 900;
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

function abrirPausa() {
  if (document.pointerLockElement) document.exitPointerLock();
  $('#aj-dist').value = ajustes.dist; $('#aj-qual').value = ajustes.qual; $('#aj-sens').value = ajustes.sens;
  $('#aj-som').checked = ajustes.som; $('#aj-fps').checked = ajustes.fps;
  $('#pausa-mundo').textContent = modo === 'online' ? `Mundo: ${mundoAtual.nome} · código ${mundoAtual.codigo}` : 'Jogando sem internet (salvo neste aparelho)';
  $('#pausa').hidden = false;
  pausado = true;
  som.motor(null);
}
function fecharJanelas() { $('#pausa').hidden = true; pausado = false; }
document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharJanelas));
$('#bt-menu').addEventListener('click', abrirPausa);
addEventListener('keydown', (e) => {
  if (!jogando) return;
  if (e.code === 'Escape' && pausado) fecharJanelas();
  else if (e.code === 'KeyP') abrirPausa();
});
$('#aj-dist').addEventListener('input', (e) => { ajustes.dist = +e.target.value; if (terreno) terreno.raio = ajustes.dist; salvarAjustes(); ajustarNevoa(); });
$('#aj-qual').addEventListener('input', (e) => { ajustes.qual = +e.target.value; salvarAjustes(); redimensionar(); });
$('#aj-sens').addEventListener('input', (e) => { ajustes.sens = +e.target.value; if (ctrl) ctrl.sensToque = ajustes.sens; salvarAjustes(); });
$('#aj-som').addEventListener('change', (e) => { ajustes.som = e.target.checked; som.ligado = ajustes.som; if (!som.ligado) som.motor(null); salvarAjustes(); });
$('#aj-fps').addEventListener('change', (e) => { ajustes.fps = e.target.checked; $('#fps').hidden = !ajustes.fps; salvarAjustes(); });
$('#bt-sair-mundo').addEventListener('click', sairDoMundo);
$('#bt-carro').addEventListener('click', () => entrarSair());
$('#bt-buzina').addEventListener('click', () => buzina());
document.querySelectorAll('[data-emote]').forEach((b) => b.addEventListener('click', () => {
  const e = b.dataset.emote;
  som.oi();
  if (sala) sala.enviar({ t: 'emote', e });
  const p = alvoCamera();
  if (bichos) bichos.emoji(e, p.x, p.y + 1.4, p.z, 1.6, 0.7);
}));

function ajustarNevoa() {
  const d = ajustes.dist * TAM;
  cena.fog.near = d * 0.55; cena.fog.far = d * 1.05;
}

// ---------- carros ----------
function entrarSair() {
  if (!jog || pausado) return;
  som.iniciar();
  if (jog.carro) {
    const c = jog.carro;
    if (Math.abs(c.vel) > 4) { aviso('Pare o carro para descer 🛑'); return; }
    c.vel = 0; c.dirigindo = false;
    // desce pelo lado do motorista
    const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
    const q = { x: c.x + co * (c.d.W / 2 + 0.7), z: c.z - s * (c.d.W / 2 + 0.7) };
    terreno.resolverColisao(q, 0.35);
    Object.assign(jog.pos, { x: q.x, y: terreno.chao(q.x, q.z), z: q.z });
    jog.rot = c.yaw; jog.carro = null; jog.mostrar(true);
    som.porta(); som.motor(null);
    cam.dist = 7;
  } else {
    const c = garagem.maisPerto(jog.pos.x, jog.pos.z, 4.5);
    if (!c) return;
    jog.carro = c; c.dirigindo = true; jog.mostrar(false);
    som.porta();
    cam.dist = 10; cam.yaw = c.yaw + Math.PI; cam.pitch = 0.3;
    aviso(`${MODELOS[c.modelo].nome} 🚗 Bom passeio!`, 1500);
  }
  atualizarBotoes(true);
}
function buzina() {
  if (!jog || !jog.carro) return;
  som.iniciar(); som.buzina();
  if (sala) sala.enviar({ t: 'emote', e: '📯' });
}

let ultimoBotao = '';
function atualizarBotoes(forcar) {
  let estado = 'nada';
  if (jog.carro) estado = 'sair';
  else if (garagem.maisPerto(jog.pos.x, jog.pos.z, 4.5)) estado = 'entrar';
  if (estado === ultimoBotao && !forcar) return;
  ultimoBotao = estado;
  const b = $('#bt-carro');
  b.hidden = estado === 'nada';
  b.textContent = estado === 'sair' ? '🚶 Descer' : '🚗 Entrar';
  $('#bt-buzina').hidden = estado !== 'sair';
  $('#velo').hidden = estado !== 'sair';
  $('#bt-pular').hidden = estado === 'sair';
}

// ---------- tocar / clicar ----------
const raio = new THREE.Raycaster();
function usar(ponto) {
  if (!jogando || pausado) return;
  som.iniciar();
  raio.setFromCamera(ponto ? new THREE.Vector2((ponto.x / innerWidth) * 2 - 1, -(ponto.y / innerHeight) * 2 + 1) : new THREE.Vector2(0, 0), camera);
  const o = raio.ray.origin, dir = raio.ray.direction;
  const p = alvoCamera();
  const hb = bichos.atingir(o, dir, 60);
  if (hb && Math.hypot(hb.bicho.x - p.x, hb.bicho.z - p.z) < 14) { bichos.carinho(hb.bicho); return; }
  if (!jog.carro) {
    const grupos = [...garagem.carros.values()].filter((c) => Math.hypot(c.x - jog.pos.x, c.z - jog.pos.z) < 7).map((c) => c.grupo);
    const hit = raio.intersectObjects(grupos, true)[0];
    if (hit) entrarSair();
  }
}

// ---------- outros jogadores ----------
function adicionarOutro(j) {
  if (j.id === euId || outros.has(j.id)) return;
  const b = montarBoneco(CORES[j.cor % CORES.length] ?? CORES[0]);
  const et = etiqueta(j.nome);
  et.position.y = 2.2;
  const raiz = new THREE.Group();
  raiz.add(b.grupo, et);
  const p = j.p || [0, 5, 0];
  raiz.position.set(p[0], p[1], p[2]);
  cena.add(raiz);
  outros.set(j.id, { ...b, raiz, et, nome: j.nome, alvo: new THREE.Vector3(...p), alvoYaw: (j.r && j.r[0]) || 0, fase: 0, carro: null, carroChave: '' });
  if (j.c) atualizarCarroOutro(outros.get(j.id), j.c);
}
// o carro estacionado que outro jogador pegou some aqui e reaparece onde ele deixar
function soltarCarroEstacionado(o) {
  const pc = o.carroId && garagem && garagem.carros.get(o.carroId);
  if (pc && !(jog && jog.carro === pc)) {
    pc.x = o.raiz.position.x; pc.z = o.raiz.position.z; pc.yaw = o.raiz.rotation.y;
    pc.dirigindo = false; pc.movido = true; pc.grupo.visible = true; pc.posicionar(1);
  }
  o.carroId = '';
}
function atualizarCarroOutro(o, c) {
  const id = (c && c[4]) || '';
  if (id !== (o.carroId || '')) {
    soltarCarroEstacionado(o);
    o.carroId = id;
    const pc = id && garagem && garagem.carros.get(id);
    if (pc && !(jog && jog.carro === pc)) { pc.dirigindo = true; pc.grupo.visible = false; }
  }
  const chave = c ? c[0] + c[1] : '';
  if (chave === o.carroChave) return;
  if (o.carro) { o.raiz.remove(o.carro); o.carro = null; }
  o.carroChave = chave;
  if (c && MODELOS[c[0]]) { o.carro = montarCarro(c[0], c[1]); o.raiz.add(o.carro); }
  o.grupo.visible = !o.carro;
  o.et.position.y = o.carro ? 2.6 : 2.2;
}
function removerOutro(id) {
  const o = outros.get(id);
  if (!o) return;
  soltarCarroEstacionado(o);
  cena.remove(o.raiz);
  o.raiz.traverse((x) => { if (x.isSprite) { x.material.map.dispose(); x.material.dispose(); } });
  outros.delete(id);
}

// ---------- iniciar / sair ----------
function salvarLocal() {
  if (modo !== 'local' || !jog) return;
  const p = jog.carro ? { x: jog.carro.x, y: jog.carro.y, z: jog.carro.z } : jog.pos;
  try { localStorage.setItem('pradaria.local2', JSON.stringify({ semente: terreno.semente, pos: [p.x, p.y, p.z], dia: tempoDia })); } catch {}
}

function limparMundo() {
  if (sala) { sala.fechar(); sala = null; }
  for (const id of [...outros.keys()]) removerOutro(id);
  if (bichos) for (let i = bichos.lista.length - 1; i >= 0; i--) bichos.remover(i);
  if (garagem) garagem.limpar();
  if (terreno) terreno.limpar();
  if (jog) cena.remove(jog.boneco.grupo);
  som.motor(null);
  terreno = garagem = bichos = jog = null;
}

function iniciarMundo({ semente, pos = null }) {
  limparMundo();
  terreno = new Terreno(cena, semente);
  terreno.raio = ajustes.dist;
  garagem = new Garagem(cena, terreno);
  jog = new Personagem(cena, terreno, garagem, CORES[minhaCor % CORES.length]);
  const p = pos || [24, 5, 33];
  Object.assign(jog.pos, { x: p[0], y: p[1], z: p[2] });
  // carrega os pedaços em volta antes de começar
  for (let i = 0; i < 30 && terreno.atualizar(jog.pos.x, jog.pos.z, 4); i++);
  jog.pos.y = terreno.chao(jog.pos.x, jog.pos.z);
  cam.yaw = 0; cam.pitch = 0.32; cam.dist = 7;
  if (!ctrl) {
    ctrl = new Controles(canvas, cam, {
      usar, entrarSair, buzina,
      zoom: (d) => { cam.dist = Math.max(3, Math.min(16, cam.dist + d)); },
      primeiroToque: () => som.iniciar(),
    });
    canvas.addEventListener('touchmove', () => { ultimoGiro = performance.now(); }, { passive: true });
    document.addEventListener('mousemove', () => { if (ctrl.travado) ultimoGiro = performance.now(); });
  }
  ctrl.sensToque = ajustes.sens;
  bichos = new Bichos(cena, terreno, som);
  som.ligado = ajustes.som;
  ajustarNevoa();
  ultimoBotao = ''; atualizarBotoes(true);
  $('#menu').hidden = true;
  $('#hud').hidden = false;
  $('#fps').hidden = !ajustes.fps;
  $('#dica-toque').style.opacity = 1;
  jogando = true; pausado = false;
  setTimeout(() => { $('#dica-toque').style.opacity = 0; }, 9000);
}

function jogarLocal() {
  modo = 'local'; mundoAtual = null;
  let salvo = null;
  try { salvo = JSON.parse(localStorage.getItem('pradaria.local2') || 'null'); } catch {}
  if (salvo) tempoDia = salvo.dia ?? 0.3;
  iniciarMundo({ semente: salvo ? salvo.semente : Math.floor(Math.random() * 1e9), pos: salvo && salvo.pos });
  $('#status').textContent = '🏡 Sem internet';
  aviso('Bem-vindo à Pradaria! 🌼 Procure um carro na rua 🚗', 3500);
}

async function jogarOnline(m) {
  modo = 'online'; mundoAtual = m;
  mostrarMenu('m-carregando');
  $('#carregando-txt').textContent = `Entrando em "${m.nome}"…`;
  let primeiro = true;
  minhaCor = (conta.usuario && conta.usuario.cor) || 0;
  sala = new Sala(m.codigo, {
    status: (s) => { if (jogando) $('#status').textContent = s === 'online' ? `🌍 ${m.nome}` : '⏳ Reconectando…'; },
    ola: (msg) => {
      euId = msg.eu;
      if (primeiro) {
        primeiro = false;
        const s = sala; sala = null; // evita que iniciarMundo feche a sala
        tempoDia = msg.dia ?? 0.3;
        const pos = msg.pos && Math.abs(msg.pos[0]) < 1e5 && msg.pos[1] > -50 && msg.pos[1] < 400 ? msg.pos : null;
        iniciarMundo({ semente: msg.semente, pos });
        sala = s;
        $('#status').textContent = `🌍 ${m.nome}`;
        aviso(`Oi, ${conta.usuario.nome}! Código do mundo: ${m.codigo}`, 3500);
      }
      for (const id of [...outros.keys()]) removerOutro(id);
      for (const j of msg.jogadores) adicionarOutro(j);
    },
    entrou: (msg) => { adicionarOutro(msg.j); aviso(`${msg.j.nome} chegou 👋`); som.oi(); },
    saiu: (msg) => { const o = outros.get(msg.id); if (o) aviso(`${o.nome} saiu`); removerOutro(msg.id); },
    pos: (msg) => {
      const o = outros.get(msg.id);
      if (!o) return;
      o.alvo.set(msg.p[0], msg.p[1], msg.p[2]);
      o.alvoYaw = msg.r[0]; o.anda = msg.r[1];
      atualizarCarroOutro(o, msg.c || null);
      if (o.carro && msg.c) { o.carro.rotation.set(msg.c[2] || 0, 0, msg.c[3] || 0, 'YXZ'); }
    },
    emote: (msg) => {
      const o = outros.get(msg.id);
      if (!o) return;
      if (msg.e === '📯') { som.buzina(); }
      if (bichos) bichos.emoji(msg.e, o.raiz.position.x, o.raiz.position.y + 2.8, o.raiz.position.z, 2, 0.7);
    },
    erro: (msg) => { aviso(msg.msg || 'Erro', 3000); },
  });
}

function sairDoMundo() {
  salvarLocal();
  enviarPos(true);
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
function alvoCamera() {
  if (jog.carro) return { x: jog.carro.x, y: jog.carro.y + 1.4, z: jog.carro.z };
  return { x: jog.pos.x, y: jog.pos.y + 1.5, z: jog.pos.z };
}

let acumPos = 0, ultimoEnvio = '';
function enviarPos(forcar) {
  if (!sala || !jog) return;
  const c = jog.carro;
  const p = c ? [c.x, c.y, c.z] : [jog.pos.x, jog.pos.y, jog.pos.z];
  const msg = { t: 'pos', p: p.map((v) => +v.toFixed(2)), r: [+(c ? c.yaw : jog.rot).toFixed(2), +(c ? Math.abs(c.vel) : jog.vel).toFixed(1)] };
  if (c) msg.c = [c.modelo, c.cor, +c.pitch.toFixed(2), +c.roll.toFixed(2), c.id];
  const s = JSON.stringify(msg);
  if (s === ultimoEnvio && !forcar) return;
  ultimoEnvio = s;
  sala.enviar(msg);
}

let ultimo = performance.now(), quadros = 0, tempoFps = 0, tempoTotal = 0, tempoBotoes = 0;
const corTmp = new THREE.Color();

function laco(agora) {
  requestAnimationFrame(laco);
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;
  if (!jogando) { renderer.render(cena, camera); return; }
  tempoTotal += dt;

  const ent = pausado ? { frente: 0, lado: 0, pular: false, correr: false } : ctrl.atualizar();
  if (jog.carro) {
    const c = jog.carro;
    if (c.dirigir(dt, ent)) { som.batida(); }
    som.motor(Math.min(1, Math.abs(c.vel) / c.d.vmax));
    $('#velo b').textContent = Math.round(Math.abs(c.vel) * 3.6);
    // câmera volta para trás do carro quando a criança não está girando
    if (performance.now() - ultimoGiro > 1200 && Math.abs(c.vel) > 1) {
      const alvo = c.yaw + Math.PI * (c.vel < 0 ? 0 : 1);
      const d = ((alvo - cam.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      cam.yaw += d * Math.min(1, dt * 2.5);
    }
  } else {
    jog.atualizar(dt, ent, cam.yaw);
  }

  const alvo = alvoCamera();
  terreno.atualizar(alvo.x, alvo.z, 1);
  bichos.atualizar(dt, jog.carro ? { pos: { x: jog.carro.x, y: jog.carro.y, z: jog.carro.z } } : jog, tempoTotal);

  // câmera em terceira pessoa
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  let cx = alvo.x + Math.sin(cam.yaw) * cp * cam.dist, cz = alvo.z + Math.cos(cam.yaw) * cp * cam.dist;
  let cy = alvo.y + sp * cam.dist;
  const minY = Math.max(terreno.chao(cx, cz), NIVEL_AGUA) + 0.6;
  if (cy < minY) cy = minY;
  camera.position.set(cx, cy, cz);
  camera.lookAt(alvo.x, alvo.y, alvo.z);

  tempoBotoes += dt;
  if (tempoBotoes > 0.25) { tempoBotoes = 0; atualizarBotoes(); }

  // outros jogadores (interpolação suave)
  for (const o of outros.values()) {
    const g = o.raiz.position;
    g.lerp(o.alvo, Math.min(1, dt * 10));
    const d = ((o.alvoYaw - o.raiz.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    o.raiz.rotation.y += d * Math.min(1, dt * 10);
    const v = o.anda || 0;
    o.fase += dt * 2.2 * v;
    const s = v > 0.3 && !o.carro ? Math.sin(o.fase) * Math.min(0.9, v / 6) : 0;
    o.membros[0].rotation.x = s; o.membros[1].rotation.x = -s; o.membros[2].rotation.x = -s; o.membros[3].rotation.x = s;
  }

  // dia e noite (a noite é clarinha)
  tempoDia = (tempoDia + dt / DURACAO_DIA) % 1;
  const ang = tempoDia * Math.PI * 2;
  const s = Math.sin(ang);
  const dia = THREE.MathUtils.clamp(s * 2 + 0.5, 0, 1);
  corTmp.copy(corCeuNoite).lerp(corCeuDia, dia);
  corTmp.lerp(corPor, Math.max(0, 1 - Math.abs(s) * 4) * 0.4);
  cena.background.copy(corTmp); cena.fog.color.copy(corTmp);
  luzCeu.intensity = 0.55 + dia * 0.6;
  luzSol.intensity = 0.25 + dia * 1.35;
  luzSol.color.setHSL(0.1, 0.6, 0.6 + dia * 0.35);
  luzSol.position.set(alvo.x + Math.cos(ang) * 100, alvo.y + Math.max(20, Math.abs(s) * 120), alvo.z + 40);
  luzSol.target.position.set(alvo.x, alvo.y, alvo.z);
  sol.position.set(camera.position.x + Math.cos(ang) * 400, camera.position.y + s * 400, camera.position.z + 120);
  lua.position.set(camera.position.x - Math.cos(ang) * 400, camera.position.y - s * 400, camera.position.z + 120);
  sol.lookAt(camera.position); lua.lookAt(camera.position);
  agua.position.x = Math.round(alvo.x / TAM) * TAM; agua.position.z = Math.round(alvo.z / TAM) * TAM;
  nuvens.position.x = ((tempoTotal * 1.5) % 700) - 350 + Math.round(alvo.x / 700) * 700;
  nuvens.position.z = Math.round(alvo.z / 700) * 700;
  nuvens.material.color.setScalar(0.55 + dia * 0.45);

  // rede ~8x por segundo
  if (sala) { acumPos += dt; if (acumPos > 0.125) { acumPos = 0; enviarPos(); } }

  renderer.render(cena, camera);
  quadros++; tempoFps += dt;
  if (tempoFps > 1) {
    if (ajustes.fps) $('#fps').textContent = `${quadros} fps · ${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles / 1000)}k tri`;
    quadros = 0; tempoFps = 0;
    if (modo === 'local') salvarLocal();
  }
}
requestAnimationFrame(laco);
addEventListener('beforeunload', () => salvarLocal());
document.addEventListener('visibilitychange', () => { if (document.hidden) { salvarLocal(); som.motor(null); } });
void matLowPoly;

camera.position.set(0, 40, 0);
if (conta.token) abrirMundos(); else mostrarMenu('m-inicio');

// modo de teste automatizado
if (location.hash === '#teste') {
  window.__jogo = {
    get outros() { return outros.size; }, get sala() { return sala; }, get jog() { return jog; }, get terreno() { return terreno; },
    get garagem() { return garagem; }, get bichos() { return bichos; }, cam, jogarLocal, usar, entrarSair, renderer,
  };
}

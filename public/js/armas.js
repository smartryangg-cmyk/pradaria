// Armas de brinquedo (opção "Armas" do mundo): duas armas na mão, munição por tipo, recarga, mira com zoom,
// tiro com acerto e dano (corpo e cabeça; bicho não se machuca, o selvagem só foge), itens espalhados pelo mapa, alvos de treino, queda e renascimento.
// Funciona em qualquer tipo de mundo; no multijogador o servidor repassa os tiros, confere os acertos e
// decide quem pegou cada item do chão.
import * as THREE from '../vendor/three.module.min.js';
import { ARMAS, MUNICOES, CABECA, VOLTA_ITEM } from './armas-dados.js';
import { caixa, juntar, matModelo } from './modelos.js';
import { icone } from './icones.js';
import { opcoesMundo } from './opcoes-mundo.js';
import { vida } from './vida.js';
import { SOLIDO, AGUA } from './blocos.js';

const CEL = 16; // itens: no máximo alguns por pedaço de 16x16
const RAIO_ITENS = 3; // células em volta do jogador com itens montados
const PEGAR = 1.5; // distância para pegar um item andando por cima
const ORDEM = Object.keys(ARMAS);
const COR_PONTA = 0xff8a3d;
const ESC_MAO = 0.42; // tamanho da arma em primeira pessoa

// número "aleatório" fixo para cada lugar (todos os jogadores veem os mesmos itens)
function hash(a, b, c) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function sortear(tabela, r) { // tabela: [[valor, peso]]
  let tot = 0; for (const [, p] of tabela) tot += p;
  let x = r * tot;
  for (const [v, p] of tabela) { if ((x -= p) < 0) return v; }
  return tabela[tabela.length - 1][0];
}
const TAB_ARMAS = ORDEM.map((a) => [a, ARMAS[a].chance]);
const TAB_MUNICAO = [['leve', 40], ['media', 25], ['cartucho', 20], ['pesada', 15]];

// raio contra caixa (min, max); devolve a distância ou -1
function raioCaixa(o, d, mn, mx, max) {
  let t0 = 0, t1 = max;
  for (const e of ['x', 'y', 'z']) {
    if (Math.abs(d[e]) < 1e-9) { if (o[e] < mn[e] || o[e] > mx[e]) return -1; continue; }
    let a = (mn[e] - o[e]) / d[e], b = (mx[e] - o[e]) / d[e];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return -1;
  }
  return t0;
}

// ---------- modelos (feitos de caixinhas, frente = +z, cabo na origem) ----------
export function modeloArma(a, escala = 1) {
  const c = ARMAS[a] ? ARMAS[a].cor : 0x888888, esc = 0x3a3f48, p = [];
  const cx = (w, h, d, cor, x, y, z) => p.push(caixa(w * escala, h * escala, d * escala, cor, x * escala, y * escala, z * escala));
  if (a === 'pistola') {
    cx(0.09, 0.1, 0.3, c, 0, 0.04, 0.06); cx(0.07, 0.16, 0.08, esc, 0, -0.06, -0.04); cx(0.06, 0.06, 0.04, COR_PONTA, 0, 0.04, 0.23);
  } else if (a === 'sub') {
    cx(0.1, 0.12, 0.44, c, 0, 0.04, 0.1); cx(0.07, 0.15, 0.08, esc, 0, -0.07, -0.02); cx(0.06, 0.2, 0.07, esc, 0, -0.08, 0.16);
    cx(0.06, 0.06, 0.05, COR_PONTA, 0, 0.05, 0.34); cx(0.03, 0.04, 0.04, esc, 0, 0.12, 0.02);
  } else if (a === 'espingarda') {
    cx(0.1, 0.11, 0.62, c, 0, 0.04, 0.2); cx(0.08, 0.08, 0.2, esc, 0, -0.04, 0.3); cx(0.09, 0.14, 0.22, c, 0, -0.01, -0.18);
    cx(0.07, 0.14, 0.07, esc, 0, -0.07, 0.0); cx(0.07, 0.07, 0.05, COR_PONTA, 0, 0.05, 0.53);
  } else if (a === 'fuzil') {
    cx(0.1, 0.13, 0.66, c, 0, 0.04, 0.18); cx(0.06, 0.2, 0.08, esc, 0, -0.1, 0.12); cx(0.09, 0.15, 0.22, esc, 0, 0.0, -0.22);
    cx(0.07, 0.15, 0.07, esc, 0, -0.08, -0.02); cx(0.04, 0.06, 0.18, esc, 0, 0.14, 0.12); cx(0.06, 0.06, 0.05, COR_PONTA, 0, 0.05, 0.53);
  } else if (a === 'precisao') {
    cx(0.09, 0.11, 0.86, c, 0, 0.04, 0.24); cx(0.07, 0.07, 0.3, esc, 0, 0.15, 0.08); cx(0.09, 0.09, 0.04, esc, 0, 0.15, 0.24);
    cx(0.09, 0.16, 0.24, c, 0, -0.01, -0.26); cx(0.07, 0.15, 0.07, esc, 0, -0.08, -0.04); cx(0.06, 0.06, 0.05, COR_PONTA, 0, 0.04, 0.7);
  }
  return new THREE.Mesh(juntar(p), matModelo);
}
const PONTA = { pistola: 0.26, sub: 0.38, espingarda: 0.56, fuzil: 0.56, precisao: 0.73 };

function modeloMunicao(tipo) {
  const c = MUNICOES[tipo].cor, p = [caixa(0.42, 0.26, 0.3, c, 0, 0.13, 0), caixa(0.44, 0.05, 0.32, 0xffffff, 0, 0.2, 0)];
  for (let i = 0; i < 3; i++) p.push(caixa(0.06, 0.14, 0.06, 0xffcb3c, -0.12 + i * 0.12, 0.33, 0));
  return new THREE.Mesh(juntar(p), matModelo);
}
function modeloCura() {
  return new THREE.Mesh(juntar([caixa(0.38, 0.3, 0.3, 0xffffff, 0, 0.15, 0), caixa(0.24, 0.07, 0.31, 0xe8433f, 0, 0.16, 0), caixa(0.07, 0.24, 0.31, 0xe8433f, 0, 0.16, 0)]), matModelo);
}
function modeloAlvo() {
  const g = new THREE.Group();
  const poste = new THREE.Mesh(juntar([caixa(0.12, 1.1, 0.12, 0x8c5c31, 0, 0.55, 0), caixa(0.6, 0.08, 0.3, 0x8c5c31, 0, 0.04, 0)]), matModelo);
  const placa = new THREE.Group();
  const cores = [0xffffff, 0xe8433f, 0xffffff, 0xe8433f, 0xf2c72e];
  cores.forEach((c, i) => {
    const r = 0.5 - i * 0.1;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.06 + i * 0.012, 20), new THREE.MeshLambertMaterial({ color: c }));
    m.rotation.x = Math.PI / 2;
    placa.add(m);
  });
  placa.position.y = 0; // gira na base (cai para trás quando acerta)
  for (const m of placa.children) m.position.y = 0.5;
  const pivo = new THREE.Group(); pivo.position.y = 1.0; pivo.add(placa);
  g.add(poste, pivo);
  return { g, pivo };
}

export class Armas {
  constructor(o) {
    this.o = o; // { cena, camera, som, aviso, outros, mundo, bichos, jog, sala, euId, nomeEu, parado, fovBase, controles }
    this.slots = [null, null]; // { a, pente }
    this.sel = -1; // -1 = mãos (blocos/carinho)
    this.reserva = { leve: 0, media: 0, cartucho: 0, pesada: 0 };
    this.espera = 0; this.recarga = 0; this.apertado = false; this.disparou = false; this.mirando = false; this.zoomAtual = 1;
    this.itens = new Map(); // k -> { k, tipo, a|m, x, y, z, malha }
    this.alvos = new Map(); // k -> { x, y, z, g, pivo, caido }
    this.pegos = new Map(); // k -> quando foi pego (ms)
    this.pedidos = new Set(); // itens que pedi ao servidor
    this.efeitos = []; // riscos, faíscas, clarões
    this.ultimoAtaque = null; // { id, nome, t }
    this.derrubadas = 0;
    this.tempoItens = 0; this.celAtual = null;
    this.topo = null; this.antes = { noChao: true, planando: false, voando: false };
    this.recuo = 0; this.balanco = 0;
    this.alvosExtras = []; // outros módulos podem pôr alvos aqui (veja lancar)
    this.aoAtirar = null; // (arma, origem, direção): avisa outros módulos que o jogador atirou
    this.mao = new THREE.Group(); // arma em primeira pessoa (presa na câmera)
    this.mao.position.set(0.2, -0.19, -0.38);
    this.o.camera.add(this.mao);
    this.clarao = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    this.clarao.visible = false;
    this.geoFaisca = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    this.matFaisca = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
    this.hud();
  }

  get ligado() { return !!opcoesMundo.armas; }
  get empunhando() { return this.ligado && this.sel >= 0 && !!this.slots[this.sel]; }
  get atual() { return this.empunhando ? this.slots[this.sel] : null; }

  // ---------- começo / fim ----------
  comecar() {
    this.limpar();
    document.body.classList.toggle('com-armas', this.ligado);
    this.el.hud.hidden = !this.ligado;
    this.el.botoes.hidden = !this.ligado;
    if (!this.ligado) { this.desenhar(); return; }
    this.equipar(true);
    this.desenhar();
  }
  // arma inicial: uma pistola com um pouco de munição (ninguém começa sem nada)
  equipar(inicio) {
    this.slots = [{ a: 'pistola', pente: ARMAS.pistola.pente }, null];
    this.reserva = { leve: 24, media: 0, cartucho: 0, pesada: 0 };
    this.sel = 0; this.recarga = 0; this.espera = 0;
    this.trocouArma(!inicio);
  }
  limpar() {
    for (const it of this.itens.values()) this.o.cena.remove(it.malha);
    for (const a of this.alvos.values()) this.o.cena.remove(a.g);
    for (const e of this.efeitos) this.o.cena.remove(e.m);
    this.itens.clear(); this.alvos.clear(); this.pegos.clear(); this.pedidos.clear(); this.efeitos = [];
    this.slots = [null, null]; this.sel = -1; this.apertado = false; this.mirar(false);
    this.derrubadas = 0; this.ultimoAtaque = null; this.celAtual = null; this.topo = null;
    this.mao.clear(); this.el.feed.innerHTML = '';
  }
  parar() { this.limpar(); document.body.classList.remove('com-armas', 'armado'); this.el.hud.hidden = true; this.el.botoes.hidden = true; }

  // ---------- HUD ----------
  hud() {
    const $ = (s) => document.querySelector(s);
    this.el = { hud: $('#armas-hud'), slots: $('#armas-slots'), pente: $('#am-pente'), reserva: $('#am-reserva'), recarga: $('#armas-recarga'), botoes: $('#botoes-armas'), feed: $('#feed'), acertou: $('#acertou'), ferida: $('#ferida'), luneta: $('#luneta'), placar: $('#am-placar') };
    const toque = (id, fn, solta) => {
      const b = $(id); if (!b) return;
      const on = (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('ativo'); fn(); };
      const off = (e) => { e.preventDefault(); b.classList.remove('ativo'); if (solta) solta(); };
      b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
      b.addEventListener('touchend', off); b.addEventListener('touchcancel', off); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', (e) => { if (b.classList.contains('ativo')) off(e); });
    };
    toque('#bt-atirar', () => this.gatilho(true), () => this.gatilho(false));
    toque('#bt-mirar', () => this.mirar(!this.mirando));
    toque('#bt-recarregar', () => this.recarregar());
    toque('#bt-trocar', () => this.trocar());
  }

  desenhar() {
    if (!this.el.hud) return;
    const s = this.el.slots;
    s.innerHTML = '';
    if (this.ligado) {
      this.slots.forEach((sl, i) => {
        const b = document.createElement('button');
        b.className = 'aslot' + (i === this.sel ? ' sel' : '') + (sl ? '' : ' vazio');
        b.setAttribute('aria-label', sl ? ARMAS[sl.a].nome : 'Espaço vazio');
        b.innerHTML = sl ? `<span class="cor" style="background:#${ARMAS[sl.a].cor.toString(16).padStart(6, '0')}"></span><span class="nome">${ARMAS[sl.a].nome}</span>` : '<span class="nome">vazio</span>';
        b.addEventListener('click', (e) => { e.stopPropagation(); if (sl) this.escolher(i); });
        s.appendChild(b);
      });
      const m = document.createElement('button');
      m.className = 'aslot maos' + (this.sel < 0 ? ' sel' : '');
      m.setAttribute('aria-label', 'Guardar a arma (mãos livres)');
      m.innerHTML = icone('acenar');
      m.addEventListener('click', (e) => { e.stopPropagation(); this.escolher(-1); });
      s.appendChild(m);
    }
    const at = this.atual;
    this.el.pente.textContent = at ? at.pente : '-';
    this.el.reserva.textContent = at ? '/ ' + this.reserva[ARMAS[at.a].municao] : '';
    this.el.pente.classList.toggle('pouca', !!at && at.pente <= Math.ceil(ARMAS[at.a].pente / 4));
    this.el.placar.textContent = this.derrubadas ? String(this.derrubadas) : '';
    this.el.placar.parentElement.hidden = !this.derrubadas;
    document.body.classList.toggle('armado', this.empunhando);
    if (this.o.aoMudar) this.o.aoMudar();
  }

  // ---------- trocar / escolher ----------
  escolher(i) {
    if (!this.ligado) return;
    if (i >= 0 && !this.slots[i]) return;
    if (i === this.sel) return;
    this.sel = i; this.recarga = 0; this.espera = Math.max(this.espera, 0.25);
    this.trocouArma(true);
  }
  // arma 1 -> arma 2 -> mãos -> arma 1
  trocar() {
    if (!this.ligado) return;
    const ordem = [0, 1, -1].filter((i) => i < 0 || this.slots[i]);
    const j = ordem.indexOf(this.sel);
    this.escolher(ordem[(j + 1) % ordem.length]);
  }
  trocouArma(comSom) {
    this.mirar(false);
    this.mao.clear();
    const at = this.atual;
    if (at) {
      const m = modeloArma(at.a, ESC_MAO);
      m.rotation.y = Math.PI; // o modelo aponta para +z; a câmera olha para -z
      this.mao.add(m);
      this.clarao.position.set(0, 0.05 * ESC_MAO, (PONTA[at.a] + 0.06) * ESC_MAO);
      m.add(this.clarao);
      this.mao.position.y = -0.36; // sobe da parte de baixo da tela
      if (comSom) { this.o.som.tom(420, 0.05, { tipo: 'square', vol: 0.12, ate: 620 }); this.o.som.ruido(0.05, { vol: 0.15, freq: 2400, atraso: 0.04 }); }
    }
    const sala = this.o.sala();
    if (sala) sala.enviar({ t: 'arma', a: at ? at.a : null });
    this.desenhar();
  }

  // ---------- gatilho, mira, recarga ----------
  gatilho(sim) {
    if (sim && !this.empunhando) return;
    if (sim && !this.apertado) this.pedido = true; // toque rápido: atira mesmo se soltar antes do próximo quadro
    this.apertado = sim;
    if (!sim) this.disparou = false;
  }
  mirar(sim) {
    sim = !!sim && this.empunhando && this.recarga <= 0;
    this.mirando = sim;
    document.body.classList.toggle('mirando', sim);
    const bt = document.querySelector('#bt-mirar');
    if (bt) bt.classList.toggle('ligado', sim);
  }
  recarregar() {
    const at = this.atual;
    if (!at || this.recarga > 0) return;
    const A = ARMAS[at.a];
    if (at.pente >= A.pente) return;
    if (this.reserva[A.municao] <= 0) { this.o.aviso(`Sem ${MUNICOES[A.municao].nome.toLowerCase()}! Procure caixas pelo mapa`, 2000, 'municao'); return; }
    this.mirar(false);
    this.recarga = A.recarga;
    this.o.som.tom(300, 0.06, { tipo: 'square', vol: 0.1, ate: 200 }); this.o.som.ruido(0.06, { vol: 0.2, freq: 1500 });
  }
  terminarRecarga() {
    const at = this.atual;
    if (!at) return;
    const A = ARMAS[at.a];
    const n = Math.min(A.pente - at.pente, this.reserva[A.municao]);
    at.pente += n; this.reserva[A.municao] -= n;
    this.o.som.tom(520, 0.05, { tipo: 'square', vol: 0.12, ate: 760 }); this.o.som.ruido(0.05, { vol: 0.2, freq: 3000, atraso: 0.03 });
    this.desenhar();
  }

  // ---------- tiro ----------
  atirar() {
    const at = this.atual, A = ARMAS[at.a], som = this.o.som;
    if (at.pente <= 0) {
      som.tom(900, 0.03, { tipo: 'square', vol: 0.1 });
      this.espera = 0.25;
      if (this.reserva[A.municao] > 0) this.recarregar();
      else this.o.aviso(`Sem munição! Procure caixas de ${MUNICOES[A.municao].nome.toLowerCase()}`, 1800, 'municao');
      return;
    }
    at.pente--;
    this.espera = Math.max(-0.2, this.espera) + A.intervalo;
    const cam = this.o.camera, jog = this.o.jog();
    const o = cam.getWorldPosition(new THREE.Vector3());
    const frente = cam.getWorldDirection(new THREE.Vector3());
    const dir0 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion), lado = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const andando = Math.hypot(jog.vel.x, jog.vel.z) > 1 || !jog.noChao;
    const disp = A.disp * (this.mirando ? 0.35 : 1) * (andando ? 1.5 : 1);
    const danos = new Map(); // id do jogador -> dano somado
    let fim0 = null, acertouAlgo = false, cabeca = false;
    for (let i = 0; i < A.chumbos; i++) {
      const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * disp;
      dir0.copy(frente).addScaledVector(lado, Math.cos(ang) * r).addScaledVector(up, Math.sin(ang) * r).normalize();
      const h = this.lancar(o, dir0, A.alcance);
      const fim = o.clone().addScaledVector(dir0, h.t);
      if (!fim0) fim0 = fim;
      if (h.jogador) {
        const d = h.cabeca ? A.dano * CABECA : A.dano;
        danos.set(h.jogador, (danos.get(h.jogador) || 0) + d);
        acertouAlgo = true; cabeca = cabeca || h.cabeca;
        this.faiscas(fim, 0xffe08a, 4);
      } else if (h.bicho) {
        const bichos = this.o.bichos();
        if (bichos && h.bicho.I && h.bicho.I.selvagem) bichos.espantar(h.bicho);
        this.faiscas(fim, 0xffffff, 2);
      } else if (h.extra) {
        h.extra(h.cabeca ? A.dano * CABECA : A.dano, h.cabeca, fim);
        acertouAlgo = true; cabeca = cabeca || h.cabeca;
        this.faiscas(fim, 0xffe08a, 4);
      } else if (h.alvo) {
        this.derrubarAlvo(h.alvo); acertouAlgo = true;
      } else if (h.bloco) this.faiscas(fim, 0xfff1a8, 3);
      if (i < 3) this.risco(this.pontaMundo(), fim, 0xfff1a8);
    }
    if (this.aoAtirar) this.aoAtirar(at.a, o, frente);
    // som "pew" de brinquedo, cada arma com seu tom
    const tom = { pistola: 700, sub: 820, espingarda: 260, fuzil: 560, precisao: 380 }[at.a];
    som.tom(tom, A.chumbos > 1 ? 0.18 : 0.09, { tipo: 'square', vol: 0.16, ate: tom * 0.45 });
    som.ruido(A.chumbos > 1 ? 0.16 : 0.07, { vol: 0.28, freq: at.a === 'precisao' ? 900 : 1800 });
    this.recuo = Math.min(1, this.recuo + (at.a === 'precisao' || at.a === 'espingarda' ? 1 : 0.45));
    // o tranco levanta um pouquinho a mira
    jog.pitch = Math.min(1.55, jog.pitch + (at.a === 'precisao' ? 0.035 : at.a === 'espingarda' ? 0.03 : 0.008));
    this.clarao.visible = true; this.clarao.rotation.z = Math.random() * 3; this.tempoClarao = 0.05;
    const sala = this.o.sala();
    if (sala) {
      sala.enviar({ t: 'tiro', a: at.a, o: [o.x, o.y, o.z].map((v) => +v.toFixed(2)), f: [fim0.x, fim0.y, fim0.z].map((v) => +v.toFixed(2)) });
      for (const [id, d] of danos) sala.enviar({ t: 'acerto', alvo: id, a: at.a, dano: Math.max(1, Math.round(d)) });
    }
    if (acertouAlgo) this.marcarAcerto(cabeca);
    if (at.pente === 0 && this.reserva[A.municao] > 0) setTimeout(() => { if (this.atual === at && at.pente === 0) this.recarregar(); }, 250);
    this.desenhar();
  }

  // o que o tiro encontra primeiro: bloco, jogador (corpo/cabeça), bicho ou alvo de treino
  lancar(o, dir, alcance) {
    const mundo = this.o.mundo();
    const hb = mundo.raycast(o, dir, alcance);
    let melhor = { t: hb ? hb.t : alcance, bloco: !!hb };
    const mn = new THREE.Vector3(), mx = new THREE.Vector3();
    for (const [id, ou] of this.o.outros()) {
      const p = ou.grupo.position;
      mn.set(p.x - 0.36, p.y, p.z - 0.36); mx.set(p.x + 0.36, p.y + 1.4, p.z + 0.36);
      const tc = raioCaixa(o, dir, mn, mx, melhor.t);
      if (tc >= 0 && tc < melhor.t) melhor = { t: tc, jogador: id, cabeca: false };
      mn.set(p.x - 0.3, p.y + 1.4, p.z - 0.3); mx.set(p.x + 0.3, p.y + 1.95, p.z + 0.3);
      const th = raioCaixa(o, dir, mn, mx, melhor.t);
      if (th >= 0 && th < melhor.t) melhor = { t: th, jogador: id, cabeca: true };
    }
    // bichos: o tiro de brinquedo não machuca; para no bicho e o selvagem se assusta e foge
    const bichos = this.o.bichos();
    if (bichos) { const hb = bichos.atingir(o, dir, melhor.t); if (hb && hb.t < melhor.t) melhor = { t: hb.t, bicho: hb.bicho }; }
    // alvos de outros módulos: { min, max, aoAcertar(dano, cabeca, p) } ou { testar(o, dir, max) -> { t, aoAcertar, cabeca } }
    for (const x of this.alvosExtras) {
      if (x.testar) { const r = x.testar(o, dir, melhor.t); if (r && r.t >= 0 && r.t < melhor.t) melhor = { t: r.t, extra: r.aoAcertar, cabeca: !!r.cabeca }; continue; }
      const te = raioCaixa(o, dir, x.min, x.max, melhor.t);
      if (te >= 0 && te < melhor.t) melhor = { t: te, extra: x.aoAcertar, cabeca: false };
    }
    for (const a of this.alvos.values()) {
      if (a.caido) continue;
      mn.set(a.x - 0.5, a.y + 1.0, a.z - 0.5); mx.set(a.x + 0.5, a.y + 2.0, a.z + 0.5);
      const ta = raioCaixa(o, dir, mn, mx, melhor.t);
      if (ta >= 0 && ta < melhor.t) melhor = { t: ta, alvo: a };
    }
    return melhor;
  }

  pontaMundo() {
    const at = this.atual;
    const v = new THREE.Vector3(0, 0.05 * ESC_MAO, (at ? PONTA[at.a] : 0.3) * ESC_MAO);
    return this.mao.children[0] ? this.mao.children[0].localToWorld(v) : this.o.camera.getWorldPosition(v);
  }

  marcarAcerto(cabeca) {
    const el = this.el.acertou;
    el.classList.remove('vai', 'cabeca'); void el.offsetWidth; el.classList.add('vai'); if (cabeca) el.classList.add('cabeca');
    this.o.som.tom(cabeca ? 1500 : 1150, 0.06, { tipo: 'sine', vol: 0.22, atraso: 0.03 });
  }

  // ---------- efeitos ----------
  risco(a, b, cor) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.9 }));
    this.o.cena.add(m);
    this.efeitos.push({ m, vida: 0.09, total: 0.09, risco: true });
  }
  faiscas(p, cor, n) {
    const mat = cor === 0xfff1a8 ? this.matFaisca : new THREE.MeshBasicMaterial({ color: cor });
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.geoFaisca, mat);
      m.position.copy(p);
      this.o.cena.add(m);
      this.efeitos.push({ m, vida: 0.3, v: [(Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4] });
    }
  }

  // ---------- alvos de treino ----------
  derrubarAlvo(a) {
    a.caido = true; a.volta = 6;
    this.o.som.tom(1320, 0.12, { tipo: 'triangle', vol: 0.3 }); this.o.som.tom(1760, 0.16, { tipo: 'triangle', vol: 0.22, atraso: 0.08 });
  }

  // ---------- receber (multijogador) ----------
  get rede() {
    return {
      tiro: (m) => {
        const ou = this.o.outros().get(m.id);
        if (!ou || !ARMAS[m.a]) return;
        const de = ou.arma ? ou.arma.localToWorld(new THREE.Vector3(0, 0.05, PONTA[m.a])) : new THREE.Vector3(...m.o);
        const fim = new THREE.Vector3(...m.f);
        this.risco(de, fim, 0xfff1a8);
        this.faiscas(fim, 0xfff1a8, 2);
        const jog = this.o.jog();
        const d = jog ? Math.hypot(jog.pos.x - m.o[0], jog.pos.y - m.o[1], jog.pos.z - m.o[2]) : 30;
        const vol = Math.max(0.02, 0.2 * (1 - d / 90));
        const tom = { pistola: 700, sub: 820, espingarda: 260, fuzil: 560, precisao: 380 }[m.a];
        this.o.som.tom(tom, 0.08, { tipo: 'square', vol: vol * 0.7, ate: tom * 0.45 });
        this.o.som.ruido(0.06, { vol, freq: 1600 });
        this.armaDeOutro(ou, m.a);
      },
      arma: (m) => { const ou = this.o.outros().get(m.id); if (ou) this.armaDeOutro(ou, m.a); },
      ferido: (m) => this.ferido(m),
      caiu: (m) => {
        const eu = this.o.euId();
        if (m.por && m.por === eu && m.id !== eu) { this.derrubadas++; this.desenhar(); this.o.aviso(`Você derrubou ${m.nome}!`, 2200, 'estrela'); }
        this.noticia(m.porNome ? `${m.porNome} derrubou ${m.nome}` : `${m.nome} caiu`, m.por === eu || m.id === eu);
      },
      pegou: (m) => {
        if (m.tarde) { this.pedidos.delete(m.k); return; }
        this.pegos.set(m.k, Date.now());
        const it = this.itens.get(m.k);
        if (m.id === this.o.euId() && this.pedidos.has(m.k)) { this.pedidos.delete(m.k); if (it) this.receber(it); }
        if (it) { this.o.cena.remove(it.malha); this.itens.delete(m.k); }
      },
      pegos: (m) => {
        const agora = Date.now();
        for (const [k, s] of m.l || []) {
          this.pegos.set(k, agora - s * 1000);
          const it = this.itens.get(k);
          if (it) { this.o.cena.remove(it.malha); this.itens.delete(k); }
        }
      },
    };
  }

  // entrei numa sala: pergunto o que já foi pego e conto que arma estou segurando
  entrouOnline(sala) {
    if (!this.ligado || !sala) return;
    sala.enviar({ t: 'pegos' });
    const at = this.atual;
    sala.enviar({ t: 'arma', a: at ? at.a : null });
  }

  armaDeOutro(ou, a) {
    a = ARMAS[a] ? a : null;
    const braco = ou.membros[0];
    // a roupa (skin) pode trocar os braços do boneco: aí a arma volta para o braço novo
    if (((ou.arma && ou.arma.userData.a) === a && (!ou.arma || ou.arma.parent === braco)) || (!ou.arma && !a)) return;
    if (ou.arma) { if (ou.arma.parent) ou.arma.parent.remove(ou.arma); ou.arma.geometry.dispose(); ou.arma = null; }
    if (a) {
      const m = modeloArma(a, 1.6);
      m.userData.a = a;
      m.position.set(0, -0.58, 0.04); m.rotation.x = Math.PI / 2;
      braco.add(m);
      ou.arma = m;
    }
  }

  // braço de quem segura arma fica esticado para a frente (a animação de andar mexe só as pernas)
  segurar(bonecos) {
    for (const b of bonecos) if (b && b.arma && b.membros) { b.membros[0].rotation.x = -Math.PI / 2 - (b.alvoPitch || 0) * 0.5; b.membros[0].rotation.z = 0; }
  }

  ferido(m) {
    if (!this.ligado) return;
    const machucou = vida.dano(m.dano);
    if (!machucou) return;
    this.ultimoAtaque = { id: m.de, nome: m.nome, t: performance.now() };
    const el = this.el.ferida;
    el.classList.remove('vai'); void el.offsetWidth; el.classList.add('vai');
    // de que lado veio
    const jog = this.o.jog();
    if (jog && m.p) {
      const ang = Math.atan2(m.p[0] - jog.pos.x, m.p[2] - jog.pos.z); // ângulo no chão
      const rel = ang - (jog.yaw + Math.PI); // yaw 0 olha para -z
      el.style.setProperty('--ang', `${-rel}rad`);
    }
    this.o.som.tom(240, 0.12, { tipo: 'sine', vol: 0.3, ate: 140 });
    if (vida.atual > 0) this.o.aviso(`${m.nome} te acertou!`, 1100, 'coracao');
  }

  // fiquei sem corações: conto para todos e volto com a pistola
  caiu() {
    const sala = this.o.sala();
    const at = this.ultimoAtaque && performance.now() - this.ultimoAtaque.t < 10000 ? this.ultimoAtaque : null;
    if (sala) sala.enviar({ t: 'caiu', por: at ? at.id : null });
    else this.noticia(at ? `${at.nome} derrubou você` : 'Você caiu', true);
    this.ultimoAtaque = null;
    this.gatilho(false); this.mirar(false);
  }
  renasceu() { if (this.ligado) this.equipar(false); }

  noticia(txt, destaque) {
    const d = document.createElement('div');
    d.className = 'noticia' + (destaque ? ' eu' : '');
    d.innerHTML = icone('arma', 'ic-svg ic-mini') + '<span></span>';
    d.lastChild.textContent = txt;
    this.el.feed.prepend(d);
    while (this.el.feed.childElementCount > 4) this.el.feed.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  }

  // ---------- itens do chão ----------
  // cada célula de 16x16 sorteia (sempre igual) se tem item e qual
  conteudo(cx, cz, i) {
    const r = hash(cx, cz, 101 + i);
    const t = hash(cx, cz, 202 + i);
    if (r < 0.5) return { tipo: 'arma', a: sortear(TAB_ARMAS, t) };
    if (r < 0.88) return { tipo: 'municao', m: sortear(TAB_MUNICAO, t) };
    return { tipo: 'cura' };
  }
  itensDaCelula(cx, cz) {
    const mundo = this.o.mundo();
    const meio = [cx * CEL + 8, cz * CEL + 8];
    const lugar = mundo.aventura ? mundo.aventura.lugarEm(meio[0], meio[1]) : null;
    const n = lugar ? 2 : hash(cx, cz, 7) < 0.3 ? 1 : 0;
    const l = [];
    for (let i = 0; i < n; i++) {
      if (lugar && hash(cx, cz, 9 + i) > 0.85) continue;
      const x = cx * CEL + 2 + Math.floor(hash(cx, cz, 31 + i) * 12), z = cz * CEL + 2 + Math.floor(hash(cx, cz, 57 + i) * 12);
      l.push({ k: `${cx},${cz},${i}`, x, z, ...this.conteudo(cx, cz, i) });
    }
    return l;
  }
  // altura do chão naquele ponto (dentro de casa, fica no piso)
  chao(x, z) {
    const mundo = this.o.mundo();
    let y = Math.max(mundo.alturaEm(x, z) + 1, 2);
    const solido = (yy) => !!SOLIDO[mundo.bloco(x, yy, z)];
    let n = 0;
    while (solido(y) && n++ < 24) y++;
    n = 0;
    while (!solido(y - 1) && y > 2 && n++ < 24) y--;
    if (!solido(y - 1)) return null;
    if (AGUA[mundo.bloco(x, y, z)]) return null;
    return y;
  }
  carregado(x, z) { return this.o.mundo().chunks.has(Math.floor(x / 16) + ',' + Math.floor(z / 16)); }
  montarItem(it) {
    const mundo = this.o.mundo();
    if (!this.carregado(it.x, it.z)) return false;
    const y = this.chao(it.x, it.z);
    if (y == null) { it.ruim = true; return true; }
    it.y = y;
    const g = new THREE.Group();
    const m = it.tipo === 'arma' ? modeloArma(it.a, 1.7) : it.tipo === 'municao' ? modeloMunicao(it.m) : modeloCura();
    g.add(m);
    // anel brilhante no chão (de longe dá para ver que tem algo ali)
    const cor = it.tipo === 'arma' ? ARMAS[it.a].cor : it.tipo === 'municao' ? MUNICOES[it.m].cor : 0xe8433f;
    const anel = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 20), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    anel.rotation.x = -Math.PI / 2; anel.position.y = 0.04;
    g.add(anel);
    g.position.set(it.x + 0.5, y, it.z + 0.5);
    g.userData.fase = hash(it.x, it.z, 3) * 6;
    this.o.cena.add(g);
    it.malha = g; it.peca = m;
    return true;
  }
  montarAlvo(k, x, z, fixo = false, yFixo = null) {
    if (!fixo && !this.carregado(x, z)) return;
    const y = yFixo ?? this.chao(x, z);
    if (y == null) { this.alvos.set(k, { ruim: true, caido: true }); return; }
    const { g, pivo } = modeloAlvo();
    g.position.set(x + 0.5, y, z + 0.5);
    g.rotation.y = Math.floor(hash(x, z, 77) * 4) * Math.PI / 2;
    this.o.cena.add(g);
    this.alvos.set(k, { x: x + 0.5, y, z: z + 0.5, g, pivo, caido: false, volta: 0, fixo });
  }

  atualizarItens(jog) {
    const cx0 = Math.floor(jog.pos.x / CEL), cz0 = Math.floor(jog.pos.z / CEL);
    const perto = new Set();
    for (let dx = -RAIO_ITENS; dx <= RAIO_ITENS; dx++) for (let dz = -RAIO_ITENS; dz <= RAIO_ITENS; dz++) {
      const cx = cx0 + dx, cz = cz0 + dz;
      for (const it of this.itensDaCelula(cx, cz)) {
        perto.add(it.k);
        if (this.itens.has(it.k)) continue;
        const t = this.pegos.get(it.k);
        if (t && Date.now() - t < VOLTA_ITEM * 1000) continue;
        if (this.montarItem(it)) this.itens.set(it.k, it);
      }
      // alvo de treino: alguns pelo mundo (só para treinar a mira, cada um vê o seu)
      if (hash(cx, cz, 404) < 0.08) {
        const k = 'a' + cx + ',' + cz;
        perto.add(k);
        if (!this.alvos.has(k)) this.montarAlvo(k, cx * CEL + 3 + Math.floor(hash(cx, cz, 405) * 10), cz * CEL + 3 + Math.floor(hash(cx, cz, 406) * 10));
      }
    }
    for (const [k, it] of this.itens) if (!perto.has(k)) { if (it.malha) this.o.cena.remove(it.malha); this.itens.delete(k); }
    for (const [k, a] of this.alvos) if (!perto.has(k) && !a.fixo) { if (a.g) this.o.cena.remove(a.g); this.alvos.delete(k); }
  }

  // andou por cima do item: pega (no online, o servidor decide quem pegou primeiro)
  tentarPegar(jog) {
    for (const it of this.itens.values()) {
      if (it.ruim || it.y == null) continue;
      const d = Math.hypot(it.x + 0.5 - jog.pos.x, it.z + 0.5 - jog.pos.z);
      if (d > PEGAR || Math.abs(it.y - jog.pos.y) > 1.6) continue;
      if (!this.serve(it)) continue;
      const sala = this.o.sala();
      if (sala) {
        if (this.pedidos.has(it.k)) continue;
        this.pedidos.add(it.k);
        sala.enviar({ t: 'pegar', k: it.k });
        setTimeout(() => this.pedidos.delete(it.k), 3000);
      } else {
        this.receber(it);
        this.pegos.set(it.k, Date.now());
        this.o.cena.remove(it.malha); this.itens.delete(it.k);
      }
    }
  }
  // o item serve agora? (com tudo cheio, deixa no chão para outra pessoa)
  serve(it) {
    if (it.tipo === 'cura') return vida.atual < vida.max;
    if (it.tipo === 'municao') return this.reserva[it.m] < MUNICOES[it.m].max;
    const tem = this.slots.findIndex((s) => s && s.a === it.a);
    if (tem >= 0) return this.reserva[ARMAS[it.a].municao] < MUNICOES[ARMAS[it.a].municao].max;
    return true;
  }
  receber(it) {
    const som = this.o.som;
    if (it.tipo === 'cura') {
      vida.curar(4);
      this.o.aviso('Kit de cura: +2 corações', 1500, 'coracao');
      som.tom(660, 0.1, { tipo: 'sine', vol: 0.25 }); som.tom(990, 0.14, { tipo: 'sine', vol: 0.25, atraso: 0.08 });
    } else if (it.tipo === 'municao') {
      const M = MUNICOES[it.m];
      this.reserva[it.m] = Math.min(M.max, this.reserva[it.m] + M.caixa);
      this.o.aviso(`${M.nome} +${M.caixa}`, 1300, 'municao');
      som.ruido(0.06, { vol: 0.25, freq: 2600 }); som.tom(700, 0.06, { tipo: 'triangle', vol: 0.2 });
    } else {
      const A = ARMAS[it.a], mun = A.municao;
      const tem = this.slots.findIndex((s) => s && s.a === it.a);
      if (tem >= 0) {
        this.reserva[mun] = Math.min(MUNICOES[mun].max, this.reserva[mun] + A.pente);
        this.o.aviso(`${MUNICOES[mun].nome} +${A.pente}`, 1300, 'municao');
      } else {
        let i = this.slots.findIndex((s) => !s);
        // as duas mãos ocupadas: troca a que está segurando (ou a primeira)
        if (i < 0) i = this.sel >= 0 ? this.sel : 0;
        const velha = this.slots[i];
        this.slots[i] = { a: it.a, pente: A.pente };
        this.reserva[mun] = Math.min(MUNICOES[mun].max, this.reserva[mun] + Math.ceil(A.pente / 2));
        this.o.aviso(velha ? `Trocou ${ARMAS[velha.a].nome} por ${A.nome}` : `Pegou: ${A.nome}`, 1600, 'arma');
        this.sel = i; this.recarga = 0;
        this.trocouArma(true);
      }
      som.ruido(0.06, { vol: 0.25, freq: 2600 });
    }
    this.desenhar();
  }

  // ---------- quadro a quadro ----------
  quadro(dt, parado) {
    if (!this.ligado) return;
    const jog = this.o.jog();
    if (!jog) return;
    const cam = this.o.camera;
    // efeitos
    for (let i = this.efeitos.length - 1; i >= 0; i--) {
      const e = this.efeitos[i];
      e.vida -= dt;
      if (e.risco) e.m.material.opacity = Math.max(0, e.vida / e.total) * 0.9;
      else { e.v[1] -= 12 * dt; e.m.position.x += e.v[0] * dt; e.m.position.y += e.v[1] * dt; e.m.position.z += e.v[2] * dt; }
      if (e.vida <= 0) { this.o.cena.remove(e.m); if (e.risco) { e.m.geometry.dispose(); e.m.material.dispose(); } this.efeitos.splice(i, 1); }
    }
    if (this.tempoClarao > 0) { this.tempoClarao -= dt; if (this.tempoClarao <= 0) this.clarao.visible = false; }
    // itens girando, alvos voltando
    const t = performance.now() / 1000;
    for (const it of this.itens.values()) if (it.peca) { it.peca.rotation.y = t * 1.6 + it.malha.userData.fase; it.peca.position.y = (it.tipo === 'arma' ? 0.35 : 0.12) + Math.sin(t * 2.4 + it.malha.userData.fase) * 0.08; }
    for (const a of this.alvos.values()) {
      if (!a.pivo) continue;
      if (a.caido) { a.volta -= dt; if (a.volta <= 0) a.caido = false; }
      const alvo = a.caido ? -Math.PI / 2 : 0;
      a.pivo.rotation.x += (alvo - a.pivo.rotation.x) * Math.min(1, dt * 10);
    }
    this.tempoItens -= dt;
    if (this.tempoItens <= 0) { this.tempoItens = 0.3; this.atualizarItens(jog); }
    if (!parado) this.tentarPegar(jog);

    // queda: cair de muito alto machuca (quem plana ou voa não se machuca)
    if (!jog.noChao && !jog.voando && !jog.planando && !jog.naAgua) this.topo = this.topo == null ? jog.pos.y : Math.max(this.topo, jog.pos.y);
    else if (jog.voando || jog.planando || jog.naAgua) this.topo = null;
    if (jog.noChao && this.topo != null) {
      const altura = this.topo - jog.pos.y;
      this.topo = null;
      if (altura > 6.5 && !jog.quicou && !parado) {
        if (vida.dano(Math.min(8, Math.floor(altura - 5)))) { this.o.aviso('Ai! Que tombo', 1300, 'coracao'); this.o.som.ruido(0.12, { vol: 0.4, freq: 300 }); }
      }
    }

    // arma na mão
    const at = this.atual;
    if (this.espera > 0) this.espera -= dt;
    if (this.recarga > 0) { this.recarga -= dt; if (this.recarga <= 0) { this.recarga = 0; this.terminarRecarga(); } }
    // aparelho lento (poucos quadros por segundo): a automática ainda atira no ritmo certo
    for (let n = 0; n < 4 && at && this.atual === at && !parado && (this.apertado || this.pedido) && this.espera <= 0 && this.recarga <= 0 && at.pente > 0 && (ARMAS[at.a].auto || !this.disparou || this.pedido); n++) { this.disparou = true; this.pedido = false; this.atirar(); }
    if (at && !parado && this.pedido && this.espera <= 0 && this.recarga <= 0 && at.pente <= 0) { this.pedido = false; this.atirar(); }
    if (this.espera < -0.2) this.espera = 0;
    if (parado) { this.apertado = false; this.pedido = false; }
    // zoom da mira
    const zoom = this.mirando && at ? ARMAS[at.a].zoom : 1;
    this.zoomAtual += (zoom - this.zoomAtual) * Math.min(1, dt * 14);
    const fov = this.o.fovBase() / this.zoomAtual;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    if (this.o.controles()) this.o.controles().escala = 1 / this.zoomAtual;
    this.el.luneta.hidden = !(this.mirando && at && at.a === 'precisao' && this.zoomAtual > 2.5);
    // posição da arma: balança andando, sobe ao trocar, recua no tiro, abaixa recarregando, centraliza mirando
    this.recuo = Math.max(0, this.recuo - dt * 6);
    const andar = Math.hypot(jog.vel.x, jog.vel.z);
    this.balanco += dt * (jog.noChao ? andar * 1.4 : 0);
    const mira = this.mirando ? 1 : 0;
    const alvoX = 0.17 * (1 - mira) + Math.sin(this.balanco) * 0.01 * (1 - mira);
    const alvoY = (this.recarga > 0 ? -0.3 : -0.17 + mira * 0.03) + Math.abs(Math.cos(this.balanco)) * 0.01;
    const m = this.mao.position;
    m.x += (alvoX - m.x) * Math.min(1, dt * 14);
    m.y += (alvoY - m.y) * Math.min(1, dt * 10);
    m.z = -0.36 + this.recuo * 0.06;
    this.mao.rotation.x = this.recuo * 0.25 + (this.recarga > 0 ? 0.6 : 0);
    this.mao.visible = !!at && this.el.luneta.hidden;
    this.el.recarga.hidden = !(this.recarga > 0);
    if (this.recarga > 0 && at) this.el.recarga.firstElementChild.style.width = `${100 * (1 - this.recarga / ARMAS[at.a].recarga)}%`;
  }
}

// Editor de personagem: escolher cabelo, rosto, roupa, calça, sapato, chapéu e cores, vendo o boneco 3D girando.
// O mesmo boneco (modelos.js) aparece no jogo para você (câmera de trás/frente) e para os amigos online.
import * as THREE from '../vendor/three.module.min.js';
import { montarBoneco, vestirBoneco, animarBoneco } from './modelos.js';
import { PELES, CORES_CABELO, CORES_OLHOS, CORES_ROUPA, PARTES, normalizarSkin, skinAleatoria, skinIgual } from './skin.js';

const $ = (s) => document.querySelector(s);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// abas -> linhas: [rótulo, campo de estilo (ou null), campo de cor (ou null), paleta]
const ABAS = [
  { id: 'cabeca', nome: 'Cabeça', linhas: [
    ['Pele', null, 'pele', PELES],
    ['Cabelo', 'cabelo', 'corCabelo', CORES_CABELO],
    ['Chapéu', 'chapeu', 'corChapeu', CORES_ROUPA],
  ] },
  { id: 'rosto', nome: 'Rosto', linhas: [
    ['Olhos', 'olhos', 'corOlhos', CORES_OLHOS],
    ['Boca', 'boca', null, null],
    ['Detalhe', 'rosto', null, null],
  ] },
  { id: 'roupa', nome: 'Roupa', linhas: [
    ['Roupa', 'roupa', 'corRoupa', CORES_ROUPA],
    ['Estampa', 'estampa', 'corDetalhe', CORES_ROUPA],
  ] },
  { id: 'pernas', nome: 'Pernas', linhas: [
    ['Calça', 'calca', 'corCalca', CORES_ROUPA],
    ['Sapato', null, 'corSapato', CORES_ROUPA],
  ] },
];

export class Personagem {
  // J: { som, salvar(skin) -> Promise<string|null> (mensagem de erro ou null) }
  constructor(J) {
    this.J = J;
    this.el = $('#personagem');
    this.aba = 'cabeca';
    this.skin = null; this.original = null;
    this.giro = 0.5; this.arrastando = false;
    $('#pers-sortear').addEventListener('click', () => { this.clique(); this.definir(skinAleatoria()); });
    $('#pers-desfazer').addEventListener('click', () => { this.clique(); this.definir({ ...this.original }); });
    $('#pers-cancelar').addEventListener('click', () => { this.clique(); this.fechar(); });
    $('#pers-salvar').addEventListener('click', () => this.salvar());
  }

  clique() { if (this.J.som) this.J.som.clique(); }
  get aberto() { return !this.el.hidden; }

  abrir(skin, aoFechar) {
    this.aoFechar = aoFechar;
    this.original = normalizarSkin(skin);
    this.skin = { ...this.original };
    $('#pers-erro').textContent = '';
    this.el.hidden = false;
    this.desenharAbas();
    this.iniciar3D();
  }

  fechar() {
    this.el.hidden = true;
    this.parar3D();
    const f = this.aoFechar; this.aoFechar = null;
    if (f) f();
  }

  async salvar() {
    this.clique();
    const bt = $('#pers-salvar');
    bt.disabled = true;
    $('#pers-erro').textContent = '';
    const erro = await this.J.salvar({ ...this.skin });
    bt.disabled = false;
    if (erro) { $('#pers-erro').textContent = erro; return; }
    this.fechar();
  }

  definir(s) {
    this.skin = normalizarSkin(s);
    if (this.boneco) vestirBoneco(this.boneco, this.skin);
    this.desenharPainel();
  }

  // ---------- botões ----------
  desenharAbas() {
    const abas = $('#pers-abas');
    abas.innerHTML = '';
    for (const a of ABAS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pers-aba' + (a.id === this.aba ? ' sel' : ''); b.textContent = a.nome;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', a.id === this.aba);
      b.dataset.aba = a.id;
      b.addEventListener('click', () => { this.clique(); this.aba = a.id; this.desenharAbas(); });
      abas.appendChild(b);
    }
    this.desenharPainel();
  }

  desenharPainel() {
    const p = $('#pers-painel');
    p.innerHTML = '';
    const aba = ABAS.find((a) => a.id === this.aba);
    for (const [rotulo, campoEstilo, campoCor, paleta] of aba.linhas) {
      const linha = document.createElement('div');
      linha.className = 'pers-linha';
      const t = document.createElement('p');
      t.className = 'sub'; t.textContent = rotulo;
      linha.appendChild(t);
      if (campoEstilo) {
        const ops = document.createElement('div');
        ops.className = 'pers-estilos';
        PARTES[campoEstilo].forEach((nome, i) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'pers-estilo' + (this.skin[campoEstilo] === i ? ' sel' : ''); b.textContent = nome;
          b.dataset.campo = campoEstilo; b.dataset.valor = i;
          b.addEventListener('click', () => { this.clique(); this.definir({ ...this.skin, [campoEstilo]: i }); });
          ops.appendChild(b);
        });
        linha.appendChild(ops);
      }
      // a cor some quando não faz sentido (careca, sem chapéu, estampa lisa)
      const semCor = (campoEstilo === 'cabelo' && this.skin.cabelo === 0) || (campoEstilo === 'chapeu' && this.skin.chapeu === 0)
        || (campoEstilo === 'estampa' && this.skin.estampa === 0 && this.skin.roupa !== 5);
      if (campoCor && !semCor) {
        const cores = document.createElement('div');
        cores.className = 'cores pers-cores';
        paleta.forEach((c, i) => {
          const b = document.createElement('button');
          b.type = 'button'; b.style.background = hex(c);
          b.className = this.skin[campoCor] === i ? 'sel' : '';
          b.dataset.campo = campoCor; b.dataset.valor = i;
          b.setAttribute('aria-label', `${rotulo}: cor ${i + 1}`);
          b.addEventListener('click', () => { this.clique(); this.definir({ ...this.skin, [campoCor]: i }); });
          cores.appendChild(b);
        });
        linha.appendChild(cores);
      }
      p.appendChild(linha);
    }
    $('#pers-desfazer').disabled = skinIgual(this.skin, this.original);
  }

  // ---------- vitrine 3D (um canvas pequeno só enquanto o editor está aberto) ----------
  iniciar3D() {
    this.parar3D();
    const vitrine = $('#pers-vitrine');
    const cv = document.createElement('canvas');
    cv.id = 'pers-canvas';
    vitrine.prepend(cv);
    let r;
    try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); } catch { cv.remove(); return; }
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.r = r; this.cv = cv;
    const cena = new THREE.Scene();
    cena.add(new THREE.HemisphereLight(0xfff6e0, 0x6a7a55, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.8);
    sol.position.set(2, 4, 3);
    cena.add(sol);
    const chao = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.12, 24), new THREE.MeshLambertMaterial({ color: 0x6cbf4a }));
    chao.position.y = -0.06;
    cena.add(chao);
    this.cena = cena;
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.cam.position.set(0, 1.25, 5.2);
    this.cam.lookAt(0, 0.98, 0);
    this.boneco = montarBoneco(this.skin);
    cena.add(this.boneco.grupo);
    this.ang = 0.35; this.t = 0;
    // arrastar para girar (dedo ou mouse)
    let ultX = 0;
    cv.addEventListener('pointerdown', (e) => { this.arrastando = true; ultX = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!this.arrastando) return; this.ang += (e.clientX - ultX) * 0.012; ultX = e.clientX; });
    const soltar = () => { this.arrastando = false; this.pausaGiro = performance.now(); };
    cv.addEventListener('pointerup', soltar); cv.addEventListener('pointercancel', soltar);
    let antes = performance.now();
    const quadro = (agora) => {
      if (!this.r) return;
      this.raf = requestAnimationFrame(quadro);
      const dt = Math.min(0.05, (agora - antes) / 1000); antes = agora;
      this.t += dt;
      const w = cv.clientWidth | 0, h = cv.clientHeight | 0;
      if (w && h && (w !== this.w || h !== this.h)) { this.w = w; this.h = h; r.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
      // gira sozinho devagar (para um pouco depois de arrastar)
      if (!this.arrastando && performance.now() - (this.pausaGiro || 0) > 1500) this.ang += dt * this.giro;
      this.boneco.grupo.rotation.y = this.ang;
      // de vez em quando dá um tchauzinho
      const ciclo = this.t % 6;
      animarBoneco(this.boneco, { anda: 0, golpe: ciclo < 0.6 ? ciclo / 0.6 : 1, pitch: Math.sin(this.t * 0.8) * 0.15 }, dt);
      r.render(cena, this.cam);
    };
    this.raf = requestAnimationFrame(quadro);
  }

  parar3D() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.boneco) { this.boneco.grupo.traverse((x) => x.geometry && x.geometry.dispose()); this.boneco = null; }
    if (this.cena) { this.cena.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); this.cena = null; }
    if (this.r) { this.r.dispose(); try { this.r.forceContextLoss(); } catch {} this.r = null; }
    if (this.cv) { this.cv.remove(); this.cv = null; }
    this.w = this.h = 0;
  }
}


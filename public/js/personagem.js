// Editor de personagem: corpo (pele, altura), cabeça (formato, cabelo), rosto, roupa por peça, acessórios
// e modelos guardados, vendo o boneco 3D girando. O mesmo boneco (modelos.js) aparece no jogo para você
// (câmera de trás/frente) e para os amigos online.
import * as THREE from '../vendor/three.module.min.js';
import { montarBoneco, vestirBoneco, animarBoneco } from './modelos.js';
import {
  PELES, CORES_CABELO, CORES_OLHOS, CORES_ROUPA, PARTES, MAX_MODELOS, normalizarSkin, normalizarModelos, skinAleatoria, skinIgual,
  corDe, ehLivre, corLivre, tomDePele,
} from './skin.js';
import { icone } from './icones.js';

const $ = (s) => document.querySelector(s);
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// abas -> linhas { rot, estilo (campo), cor (campo), paleta, tom (régua de tom de pele) }
const ABAS = [
  { id: 'corpo', nome: 'Corpo', linhas: [
    { rot: 'Pele', cor: 'pele', paleta: PELES, tom: true },
    { rot: 'Altura', estilo: 'altura' },
    { rot: 'Corpo', estilo: 'corpo' },
  ] },
  { id: 'cabeca', nome: 'Cabeça', linhas: [
    { rot: 'Formato do rosto', estilo: 'formato' },
    { rot: 'Cabelo', estilo: 'cabelo', cor: 'corCabelo', paleta: CORES_CABELO },
  ] },
  { id: 'rosto', nome: 'Rosto', linhas: [
    { rot: 'Olhos', estilo: 'olhos', cor: 'corOlhos', paleta: CORES_OLHOS },
    { rot: 'Sobrancelha', estilo: 'sobrancelha' },
    { rot: 'Boca', estilo: 'boca' },
    { rot: 'Detalhe', estilo: 'rosto' },
  ] },
  { id: 'roupa', nome: 'Camisa', linhas: [
    { rot: 'Roupa de cima', estilo: 'roupa', cor: 'corRoupa', paleta: CORES_ROUPA },
    { rot: 'Estampa', estilo: 'estampa', cor: 'corDetalhe', paleta: CORES_ROUPA },
  ] },
  { id: 'pernas', nome: 'Calça e sapato', linhas: [
    { rot: 'Calça', estilo: 'calca', cor: 'corCalca', paleta: CORES_ROUPA },
    { rot: 'Sapato', estilo: 'sapato', cor: 'corSapato', paleta: CORES_ROUPA },
  ] },
  { id: 'acess', nome: 'Acessórios', linhas: [
    { rot: 'Chapéu', estilo: 'chapeu', cor: 'corChapeu', paleta: CORES_ROUPA },
    { rot: 'Óculos', estilo: 'oculos', cor: 'corOculos', paleta: CORES_ROUPA },
    { rot: 'Nas costas', estilo: 'costas', cor: 'corCostas', paleta: CORES_ROUPA },
  ] },
  { id: 'modelos', nome: 'Modelos' },
];

// a cor some quando não faz sentido (careca, sem chapéu, estampa lisa, descalço...)
function semCor(s, campo) {
  if (campo === 'cabelo') return s.cabelo === 0;
  if (campo === 'chapeu') return s.chapeu === 0;
  if (campo === 'oculos') return s.oculos === 0 || s.oculos === 3;
  if (campo === 'costas') return s.costas === 0;
  if (campo === 'sapato') return s.sapato === 3;
  if (campo === 'estampa') return s.estampa === 0 && s.roupa !== 5 && s.roupa !== 7;
  if (campo === 'calca') return s.roupa === 4 || s.roupa === 5;
  return false;
}

export class Personagem {
  // J: { som, salvar(skin) -> Promise<erro|null>, modelos() -> lista, salvarModelos(lista) -> Promise<erro|null> }
  constructor(J) {
    this.J = J;
    this.el = $('#personagem');
    this.aba = 'corpo';
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
    this.iniciar3D();
    this.desenharAbas();
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

  // painel = false: só troca o boneco (enquanto arrasta a régua ou escolhe a cor livre)
  definir(s, painel = true) {
    this.skin = normalizarSkin(s);
    if (this.boneco) vestirBoneco(this.boneco, this.skin);
    if (painel) this.desenharPainel();
    else $('#pers-desfazer').disabled = skinIgual(this.skin, this.original);
  }

  // muda um campo; vários toques seguidos numa régua viram uma troca por quadro
  mudarAoVivo(campo, valor) {
    this.pendente = { ...(this.pendente || this.skin), [campo]: valor };
    if (this.rafMuda) return;
    this.rafMuda = requestAnimationFrame(() => { this.rafMuda = 0; const s = this.pendente; this.pendente = null; this.definir(s, false); });
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
    $('#pers-desfazer').disabled = skinIgual(this.skin, this.original);
    const aba = ABAS.find((a) => a.id === this.aba);
    if (aba.id === 'modelos') { this.desenharModelos(p); return; }
    for (const L of aba.linhas) {
      const linha = document.createElement('div');
      linha.className = 'pers-linha';
      const t = document.createElement('p');
      t.className = 'sub'; t.textContent = L.rot;
      linha.appendChild(t);
      if (L.estilo) {
        const ops = document.createElement('div');
        ops.className = 'pers-estilos';
        PARTES[L.estilo].forEach((nome, i) => {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'pers-estilo' + (this.skin[L.estilo] === i ? ' sel' : ''); b.textContent = nome;
          b.dataset.campo = L.estilo; b.dataset.valor = i;
          b.addEventListener('click', () => { this.clique(); this.definir({ ...this.skin, [L.estilo]: i }); });
          ops.appendChild(b);
        });
        linha.appendChild(ops);
      }
      if (L.cor && !semCor(this.skin, L.estilo)) linha.appendChild(this.linhaCores(L));
      if (L.tom) linha.appendChild(this.reguaTom());
      p.appendChild(linha);
    }
  }

  linhaCores(L) {
    const v = this.skin[L.cor];
    const cores = document.createElement('div');
    cores.className = 'cores pers-cores';
    L.paleta.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.style.background = hex(c);
      b.className = v === i ? 'sel' : '';
      b.dataset.campo = L.cor; b.dataset.valor = i;
      b.setAttribute('aria-label', `${L.rot}: cor ${i + 1}`);
      b.addEventListener('click', () => { this.clique(); this.definir({ ...this.skin, [L.cor]: i }); });
      cores.appendChild(b);
    });
    // qualquer cor: o seletor de cores do aparelho
    const livre = document.createElement('label');
    livre.className = 'pers-livre' + (ehLivre(v) ? ' sel' : '');
    livre.title = 'Outra cor';
    if (ehLivre(v)) livre.style.setProperty('--cor', hex(corDe(L.paleta, v)));
    const inp = document.createElement('input');
    inp.type = 'color'; inp.dataset.campo = L.cor; inp.setAttribute('aria-label', `${L.rot}: outra cor`);
    inp.value = hex(corDe(L.paleta, v));
    inp.addEventListener('input', () => { livre.classList.add('sel'); livre.style.setProperty('--cor', inp.value); this.mudarAoVivo(L.cor, corLivre(parseInt(inp.value.slice(1), 16))); });
    inp.addEventListener('change', () => this.definir({ ...(this.pendente || this.skin), [L.cor]: corLivre(parseInt(inp.value.slice(1), 16)) }));
    livre.append(inp);
    cores.appendChild(livre);
    return cores;
  }

  // tom de pele livre: uma régua do mais claro ao mais escuro
  reguaTom() {
    const box = document.createElement('label');
    box.className = 'campo pers-tom';
    box.append('Ou escolha o tom na régua');
    const r = document.createElement('input');
    r.type = 'range'; r.min = 0; r.max = 1000; r.id = 'pers-tom';
    r.value = this.tomAtual ?? 300;
    r.addEventListener('input', () => { this.tomAtual = +r.value; this.mudarAoVivo('pele', corLivre(tomDePele(r.value / 1000))); });
    r.addEventListener('change', () => this.desenharPainel());
    box.append(r);
    return box;
  }

  // ---------- modelos guardados ----------
  desenharModelos(p) {
    const lista = normalizarModelos(this.J.modelos ? this.J.modelos() : []);
    const dica = document.createElement('p');
    dica.className = 'sub';
    dica.textContent = `Guarde até ${MAX_MODELOS} personagens e troque com um toque. Depois toque em Salvar para vestir.`;
    p.appendChild(dica);
    const linha = document.createElement('div');
    linha.className = 'pers-guardar';
    const nome = document.createElement('input');
    nome.id = 'pers-nome-modelo'; nome.maxLength = 16; nome.placeholder = `Modelo ${lista.length + 1}`; nome.autocomplete = 'off';
    const bt = document.createElement('button');
    bt.type = 'button'; bt.className = 'bt'; bt.id = 'pers-guardar';
    bt.innerHTML = `${icone('mais')}<span>Guardar este</span>`;
    bt.disabled = lista.length >= MAX_MODELOS;
    bt.addEventListener('click', async () => {
      this.clique();
      const n = nome.value.trim().replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '').slice(0, 16) || `Modelo ${lista.length + 1}`;
      await this.gravarModelos([...lista, { nome: n, s: { ...this.skin } }]);
    });
    linha.append(nome, bt);
    p.appendChild(linha);
    if (lista.length >= MAX_MODELOS) { const c = document.createElement('p'); c.className = 'sub'; c.textContent = 'Está cheio: apague um para guardar outro.'; p.appendChild(c); }
    const grade = document.createElement('div');
    grade.className = 'pers-modelos';
    lista.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'pers-modelo' + (skinIgual(m.s, this.skin) ? ' sel' : '');
      const usar = document.createElement('button');
      usar.type = 'button'; usar.className = 'pers-usar'; usar.dataset.modelo = i;
      const img = document.createElement('img');
      img.alt = ''; img.src = this.miniatura(m.s) || '';
      const b = document.createElement('b'); b.textContent = m.nome;
      usar.append(img, b);
      usar.addEventListener('click', () => { this.clique(); this.definir(m.s); });
      const apagar = document.createElement('button');
      apagar.type = 'button'; apagar.className = 'pers-apagar'; apagar.dataset.apagar = i;
      apagar.innerHTML = icone('lixeira'); apagar.setAttribute('aria-label', `Apagar ${m.nome}`);
      apagar.addEventListener('click', async () => { this.clique(); await this.gravarModelos(lista.filter((_, k) => k !== i)); });
      card.append(usar, apagar);
      grade.appendChild(card);
    });
    if (!lista.length) { const v = document.createElement('p'); v.className = 'sub centro'; v.textContent = 'Nenhum modelo guardado ainda.'; grade.appendChild(v); }
    p.appendChild(grade);
  }

  async gravarModelos(lista) {
    $('#pers-erro').textContent = '';
    const erro = await this.J.salvarModelos(lista);
    if (erro) $('#pers-erro').textContent = erro;
    if (this.aba === 'modelos' && this.aberto) this.desenharPainel();
  }

  // foto do boneco com outro personagem (para a lista de modelos), tirada na própria vitrine
  miniatura(s) {
    if (!this.r || !this.boneco) return null;
    try {
      const W = 96, H = 120;
      const ang = this.boneco.grupo.rotation.y;
      vestirBoneco(this.boneco, s);
      this.boneco.grupo.rotation.y = 0.45;
      this.r.setSize(W, H, false);
      this.cam.aspect = W / H; this.cam.updateProjectionMatrix();
      this.r.render(this.cena, this.cam);
      const url = this.r.domElement.toDataURL('image/png');
      // volta como estava
      vestirBoneco(this.boneco, this.skin);
      this.boneco.grupo.rotation.y = ang;
      this.w = this.h = 0; // o próximo quadro acerta o tamanho
      return url;
    } catch { return null; }
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
    this.cam.position.set(0, 1.3, 5.6);
    this.cam.lookAt(0, 1.02, 0);
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

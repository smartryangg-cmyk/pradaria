// Água: quanto do corpo está na água, fôlego (barra de bolhas) e a visão embaixo d'água
// (névoa azul-esverdeada curta, tom azulado na tela, bolhas subindo e som abafado).
// A física do nado fica em jogador.js (nadar); aqui ficam as medidas e o que se vê/ouve.
//
// Para reaproveitar (ex.: submarino):
//   superficieAgua(mundo, x, y, z) -> y da superfície acima do ponto, ou -Infinity se o ponto não está na água
//   olhosNaAgua(mundo, x, y, z)    -> true se o ponto (ex.: a câmera) está embaixo d'água
//   agua.visaoSubmersa(true|false|null) -> força a visão embaixo d'água ligada/desligada (null = automático pela câmera)
import * as THREE from '../vendor/three.module.min.js';
import { AGUA, NIVEL } from './blocos.js';
import { icone } from './icones.js';

// altura da água dentro do bloco (a mesma do desenho em mundo.js): fonte 0.88, corrente baixa conforme o nível
export function alturaAgua(b) {
  if (!AGUA[b]) return 0;
  const n = NIVEL[b];
  return n >= 1 && n <= 7 ? (8 - n) / 9 : 0.88;
}

export function superficieAgua(mundo, x, y, z) {
  const bx = Math.floor(x), bz = Math.floor(z);
  let by = Math.floor(y), b = mundo.bloco(bx, by, bz);
  if (!AGUA[b]) return -Infinity;
  for (let i = 0; i < 64; i++) {
    const c = mundo.bloco(bx, by + 1, bz);
    if (!AGUA[c]) break;
    by++; b = c;
  }
  return by + alturaAgua(b);
}

export function olhosNaAgua(mundo, x, y, z) { return superficieAgua(mundo, x, y, z) > y; }

const FOLEGO = 15;          // segundos de fôlego
const RECUPERA = 6;         // recupera 6x mais rápido do que gasta
const DANO_A_CADA = 1.5;    // sem fôlego (com vida ligada): meio coração a cada 1,5 s
const N_BOLHAS = 10;        // bolinhas na barra

// cor da água em volta (linear), de dia e de noite
const COR_DIA = new THREE.Color(0.035, 0.30, 0.36), COR_NOITE = new THREE.Color(0.006, 0.03, 0.06);

function texturaBolha() {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(235,250,255,0.95)'; g.lineWidth = 3;
  g.fillStyle = 'rgba(200,240,255,0.25)';
  g.beginPath(); g.arc(16, 16, 12, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(11, 11, 3.2, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Agua {
  // J: { cena, graf, som, aviso, vida, esconder: () => [objetos sem névoa que somem embaixo d'água] }
  constructor(J) {
    this.J = J;
    this.submerso = false;   // a câmera está embaixo d'água (visão ligada)
    this.forcado = null;     // visaoSubmersa(true/false) força; null = automático
    this.folego = FOLEGO; this.max = FOLEGO;
    this.acumDano = 0; this.tempoResgate = 0; this.tempoBolha = 0;
    this.cor = new THREE.Color();
    this.hudBolhas = -1;

    // tom azulado por cima do jogo (CSS: quase nada de custo)
    this.tela = document.createElement('div');
    this.tela.id = 'agua-tela';
    const hud = document.getElementById('hud');
    if (hud) hud.insertBefore(this.tela, hud.firstChild); else document.body.appendChild(this.tela);

    // barra de fôlego
    this.barra = document.getElementById('folego');
    if (this.barra && !this.barra.childElementCount) {
      for (let i = 0; i < N_BOLHAS; i++) { const s = document.createElement('span'); s.className = 'bolha'; s.innerHTML = icone('bolha'); this.barra.appendChild(s); }
    }

    // bolhas subindo em volta da câmera: um Points só, poucas partículas
    const N = 28;
    this.nB = N;
    this.posB = new Float32Array(N * 3);
    this.velB = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.posB, 3));
    this.bolhas = new THREE.Points(geo, new THREE.PointsMaterial({ map: texturaBolha(), size: 0.11, transparent: true, depthWrite: false, fog: false, sizeAttenuation: true }));
    this.bolhas.frustumCulled = false;
    this.bolhas.visible = false;
    this.bolhas.renderOrder = 5;
    J.cena.add(this.bolhas);
    this.bolhasProntas = false;
  }

  // força a visão embaixo d'água (true/false) ou volta ao automático (null)
  visaoSubmersa(ligada = null) { this.forcado = ligada === null ? null : !!ligada; }

  // fôlego 0..1
  get folegoFracao() { return this.folego / this.max; }

  soltarBolha(i, cx, cy, cz, perto) {
    const a = Math.random() * Math.PI * 2, r = perto ? 0.15 + Math.random() * 0.35 : 0.6 + Math.random() * 2.8;
    this.posB[i * 3] = cx + Math.cos(a) * r;
    this.posB[i * 3 + 1] = cy - (perto ? 0.15 : Math.random() * 3);
    this.posB[i * 3 + 2] = cz + Math.sin(a) * r;
    this.velB[i] = 0.5 + Math.random() * 0.8;
  }

  // chamado todo quadro, depois de main.js ajustar a névoa normal e antes de desenhar.
  // o: { dt, jog, mundo, camera, pausado, noVeiculo, restaurarNevoa }
  quadro(o) {
    const { dt, jog, mundo, camera } = o;
    const J = this.J, graf = J.graf, cp = camera.position;
    // olhos/câmera na água (com uma folguinha para não piscar na linha da água)
    const sup = superficieAgua(mundo, cp.x, cp.y, cp.z);
    const fundo = sup - cp.y;
    let sub = this.submerso ? fundo > -0.03 : fundo > 0.03;
    if (this.forcado !== null) sub = this.forcado;

    if (sub !== this.submerso) {
      this.submerso = sub;
      this.tela.classList.toggle('ligada', sub);
      this.bolhas.visible = sub;
      J.som.abafar(sub);
      if (!sub) {
        graf.submerso(null);
        for (const ob of J.esconder ? J.esconder() : []) if (ob.userData.escondidoAgua) { ob.visible = true; delete ob.userData.escondidoAgua; }
        if (o.restaurarNevoa) o.restaurarNevoa();
      } else this.bolhasProntas = false;
    }

    if (sub) {
      const rica = !!(graf.q && graf.q.sombra);
      // cor da água: mais escura de noite e quanto mais fundo
      const prof = Math.max(0, Math.min(1, (Number.isFinite(fundo) ? fundo : 4) / 14));
      this.cor.copy(COR_DIA).lerp(COR_NOITE, graf.U.uNoite.value).multiplyScalar(1 - prof * 0.5);
      graf.submerso(this.cor);
      const cena = J.cena, longe = rica ? 20 : 15;
      cena.fog.near = 0.5; cena.fog.far = longe;
      graf.ajustarNevoa(0.5, longe, this.cor);
      for (const ob of J.esconder ? J.esconder() : []) if (ob.visible) { ob.visible = false; ob.userData.escondidoAgua = true; }

      // bolhas: sobem balançando; ao passar da superfície (ou longe) voltam lá embaixo
      const n = rica ? this.nB : 12;
      this.bolhas.geometry.setDrawRange(0, n);
      if (!this.bolhasProntas) { for (let i = 0; i < this.nB; i++) this.soltarBolha(i, cp.x, cp.y, cp.z, false); this.bolhasProntas = true; }
      const t = performance.now() * 0.001;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        this.posB[k + 1] += this.velB[i] * dt;
        this.posB[k] += Math.sin(t * 3 + i) * 0.12 * dt;
        const dx = this.posB[k] - cp.x, dz = this.posB[k + 2] - cp.z, dy = this.posB[k + 1] - cp.y;
        if (this.posB[k + 1] > sup - 0.05 || dy > 3 || dx * dx + dz * dz > 16) this.soltarBolha(i, cp.x, cp.y, cp.z, false);
      }
      // respirando embaixo d'água: de vez em quando sai um punhado de bolhas da boca
      this.tempoBolha -= dt;
      if (jog.cabecaNaAgua && !o.noVeiculo && this.tempoBolha <= 0) {
        this.tempoBolha = 2 + Math.random() * 1.5;
        const fx = -Math.sin(jog.yaw) * 0.35, fz = -Math.cos(jog.yaw) * 0.35;
        for (let j = 0; j < 4; j++) this.soltarBolha((Math.random() * n) | 0, cp.x + fx, cp.y, cp.z + fz, true);
        if (!o.pausado) J.som.bolha();
      }
      this.bolhas.geometry.attributes.position.needsUpdate = true;
    }

    // tchibum
    if (jog.splash) {
      J.som.splash(Math.min(1, jog.splash / 14));
      jog.splash = 0;
    }

    // botão de descer (toque): aparece voando ou na água
    if (!o.noVeiculo) {
      const bt = document.getElementById('bt-descer');
      const esconder = !(jog.voando || jog.naAgua);
      if (bt && bt.hidden !== esconder) bt.hidden = esconder;
    }

    if (!o.pausado) this.respirar(dt, jog, mundo, o.noVeiculo);
  }

  respirar(dt, jog, mundo, noVeiculo) {
    const J = this.J;
    const embaixo = !!jog.cabecaNaAgua && !noVeiculo && !jog.voando;
    if (embaixo) this.folego = Math.max(0, this.folego - dt);
    else { this.folego = Math.min(this.max, this.folego + dt * RECUPERA); this.acumDano = 0; }

    if (embaixo && this.folego <= 0) {
      if (J.vida.ligada()) {
        this.acumDano += dt;
        if (this.acumDano >= DANO_A_CADA) {
          this.acumDano = 0;
          if (J.vida.dano(1)) { J.som.tom(200, 0.15, { tipo: 'sine', vol: 0.3, ate: 120 }); J.aviso('Sem fôlego! Suba para respirar', 1600, 'bolha'); }
        }
      } else if (!jog.resgate) {
        // mundo sem perigo: a água leva a gente de volta para cima, sem machucar
        jog.resgate = true; this.tempoResgate = 0;
        J.aviso('Hora de respirar! Subindo...', 2200, 'bolha');
      }
    }
    if (jog.resgate) {
      this.tempoResgate += dt;
      if (!jog.cabecaNaAgua) { jog.resgate = false; this.folego = Math.max(this.folego, 2); }
      else if (this.tempoResgate > 7) {
        // preso embaixo de algo (caverna alagada): põe na superfície da coluna
        const x = Math.floor(jog.pos.x), z = Math.floor(jog.pos.z);
        jog.pos.y = mundo.chao(x, z) + 1; jog.vel.y = 0;
        jog.resgate = false; this.folego = this.max;
      }
    }
    this.desenhar(embaixo);
  }

  desenhar(embaixo) {
    const el = this.barra;
    if (!el) return;
    const mostrar = embaixo || this.folego < this.max - 0.01;
    if (el.hidden === mostrar) el.hidden = !mostrar;
    if (!mostrar) return;
    const n = Math.ceil((this.folego / this.max) * N_BOLHAS - 0.001);
    if (n === this.hudBolhas) return;
    this.hudBolhas = n;
    [...el.children].forEach((s, i) => s.classList.toggle('vazia', i >= n));
    el.classList.toggle('acabando', n <= 2);
    el.setAttribute('aria-label', `Fôlego: ${n} de ${N_BOLHAS}`);
  }
}

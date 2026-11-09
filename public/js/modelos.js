// Modelos 3D feitos de caixinhas (bichos e jogadores), com cores e sombreamento embutidos.
import * as THREE from '../vendor/three.module.min.js';

export const matModelo = new THREE.MeshLambertMaterial({ vertexColors: true });
function malha(geo) { const m = new THREE.Mesh(geo, matModelo); m.castShadow = true; return m; }
// a luz do sol já faz o sombreado; aqui só um toque leve para o desenho ficar nítido
const SOMBRA = [0.95, 0.95, 1, 0.85, 0.92, 0.92];

// cria geometria de caixa com cor por face; o = deslocamento do centro
export function caixa(w, h, d, cor, ox = 0, oy = 0, oz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(ox, oy, oz);
  const c = new THREE.Color(cor);
  const cols = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = (f * 4 + v) * 3;
    cols[i] = c.r * SOMBRA[f]; cols[i + 1] = c.g * SOMBRA[f]; cols[i + 2] = c.b * SOMBRA[f];
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  return g;
}

export function juntar(geos) {
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), C = new Float32Array(nv * 3), N = new Float32Array(nv * 3), I = new Uint16Array(ni);
  let ov = 0, oi = 0;
  for (const g of geos) {
    P.set(g.attributes.position.array, ov * 3);
    C.set(g.attributes.color.array, ov * 3);
    if (g.attributes.normal) N.set(g.attributes.normal.array, ov * 3);
    const idx = g.index.array;
    for (let k = 0; k < idx.length; k++) I[oi + k] = idx[k] + ov;
    ov += g.attributes.position.count; oi += idx.length;
    g.dispose();
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(P, 3));
  r.setAttribute('color', new THREE.BufferAttribute(C, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  r.setIndex(new THREE.BufferAttribute(I, 1));
  return r;
}

// perna/braço com pivô no topo
function membro(w, h, d, cor, x, y, z) {
  const m = malha(caixa(w, h, d, cor, 0, -h / 2, 0));
  m.position.set(x, y, z);
  return m;
}

// Cada bicho: corpo (malha única), cabeça e pernas animáveis. Frente = +z.
export const ESPECIES = {
  ovelha: {
    nome: 'Ovelha', vel: 0.9, alt: 1.1, raio: 0.45, som: 'bee',
    montar(r) {
      const la = r < 0.08 ? 0xf6a6c8 : r < 0.18 ? 0x9a8f86 : 0xf4f2ea;
      return {
        corpo: [caixa(0.85, 0.7, 1.15, la, 0, 0.8, 0)],
        cabeca: [caixa(0.42, 0.42, 0.42, 0xd8cfc4, 0, 0, 0.12), caixa(0.5, 0.25, 0.3, la, 0, 0.2, 0.02),
          caixa(0.08, 0.08, 0.02, 0x222222, -0.12, 0.05, 0.34), caixa(0.08, 0.08, 0.02, 0x222222, 0.12, 0.05, 0.34)],
        cabecaPos: [0, 1.1, 0.62],
        pernas: [[0.18, 0.5, 0.18, 0xd8cfc4, [[-0.25, 0.5, 0.38], [0.25, 0.5, 0.38], [-0.25, 0.5, -0.38], [0.25, 0.5, -0.38]]]],
      };
    },
  },
  porquinho: {
    nome: 'Porquinho', vel: 1.0, alt: 0.9, raio: 0.4, som: 'oinc',
    montar() {
      const rosa = 0xf2a5b0;
      return {
        corpo: [caixa(0.75, 0.6, 1.05, rosa, 0, 0.62, 0), caixa(0.08, 0.15, 0.08, 0xe58a98, 0, 0.82, -0.56)],
        cabeca: [caixa(0.55, 0.5, 0.45, rosa, 0, 0, 0.1), caixa(0.28, 0.2, 0.08, 0xe0798a, 0, -0.05, 0.37),
          caixa(0.08, 0.08, 0.02, 0x222222, -0.14, 0.1, 0.335), caixa(0.08, 0.08, 0.02, 0x222222, 0.14, 0.1, 0.335),
          caixa(0.14, 0.14, 0.05, 0xe58a98, -0.2, 0.28, 0.05), caixa(0.14, 0.14, 0.05, 0xe58a98, 0.2, 0.28, 0.05)],
        cabecaPos: [0, 0.75, 0.58],
        pernas: [[0.2, 0.35, 0.2, 0xe58a98, [[-0.22, 0.35, 0.32], [0.22, 0.35, 0.32], [-0.22, 0.35, -0.32], [0.22, 0.35, -0.32]]]],
      };
    },
  },
  galinha: {
    nome: 'Galinha', vel: 0.8, alt: 0.8, raio: 0.25, som: 'cocó',
    montar() {
      return {
        corpo: [caixa(0.42, 0.42, 0.55, 0xfafafa, 0, 0.5, 0), caixa(0.06, 0.3, 0.38, 0xeeeeee, -0.24, 0.52, -0.02), caixa(0.06, 0.3, 0.38, 0xeeeeee, 0.24, 0.52, -0.02)],
        cabeca: [caixa(0.28, 0.32, 0.26, 0xfafafa, 0, 0, 0), caixa(0.14, 0.08, 0.14, 0xf2b632, 0, -0.02, 0.18),
          caixa(0.08, 0.12, 0.06, 0xe23b3b, 0, -0.13, 0.13), caixa(0.06, 0.1, 0.16, 0xe23b3b, 0, 0.2, 0.0),
          caixa(0.05, 0.05, 0.02, 0x222222, -0.1, 0.06, 0.135), caixa(0.05, 0.05, 0.02, 0x222222, 0.1, 0.06, 0.135)],
        cabecaPos: [0, 0.85, 0.25],
        pernas: [[0.06, 0.3, 0.06, 0xf2b632, [[-0.1, 0.3, 0], [0.1, 0.3, 0]]]],
      };
    },
  },
  vaca: {
    nome: 'Vaca', vel: 0.8, alt: 1.4, raio: 0.5, som: 'muu',
    montar() {
      const c = 0xb5763a;
      return {
        corpo: [caixa(0.95, 0.8, 1.4, c, 0, 1.05, 0), caixa(0.5, 0.82, 0.5, 0xf3ece0, 0.25, 1.05, -0.2), caixa(0.3, 0.12, 0.25, 0xf2b5c0, 0, 0.6, -0.25)],
        cabeca: [caixa(0.6, 0.55, 0.45, c, 0, 0, 0.12), caixa(0.45, 0.25, 0.1, 0xf3d6c4, 0, -0.12, 0.38),
          caixa(0.1, 0.18, 0.1, 0xf3ece0, -0.3, 0.32, 0.1), caixa(0.1, 0.18, 0.1, 0xf3ece0, 0.3, 0.32, 0.1),
          caixa(0.08, 0.08, 0.02, 0x222222, -0.16, 0.08, 0.35), caixa(0.08, 0.08, 0.02, 0x222222, 0.16, 0.08, 0.35)],
        cabecaPos: [0, 1.4, 0.78],
        pernas: [[0.22, 0.65, 0.22, 0x8e5a2b, [[-0.3, 0.65, 0.5], [0.3, 0.65, 0.5], [-0.3, 0.65, -0.5], [0.3, 0.65, -0.5]]]],
      };
    },
  },
  cachorro: {
    nome: 'Caramelo', vel: 1.8, alt: 0.9, raio: 0.3, som: 'auau', segue: true,
    montar() {
      const c = 0xd99a4e;
      return {
        corpo: [caixa(0.42, 0.42, 0.85, c, 0, 0.55, 0), caixa(0.1, 0.1, 0.35, c, 0, 0.82, -0.52)],
        cabeca: [caixa(0.42, 0.4, 0.38, c, 0, 0, 0.05), caixa(0.22, 0.18, 0.22, 0xf0d2a8, 0, -0.08, 0.3),
          caixa(0.08, 0.07, 0.04, 0x222222, 0, -0.02, 0.42), caixa(0.12, 0.2, 0.06, 0x9c6127, -0.2, 0.22, -0.04),
          caixa(0.12, 0.2, 0.06, 0x9c6127, 0.2, 0.22, -0.04), caixa(0.07, 0.07, 0.02, 0x222222, -0.11, 0.08, 0.245), caixa(0.07, 0.07, 0.02, 0x222222, 0.11, 0.08, 0.245)],
        cabecaPos: [0, 0.82, 0.5],
        pernas: [[0.13, 0.35, 0.13, 0xc4863f, [[-0.13, 0.35, 0.28], [0.13, 0.35, 0.28], [-0.13, 0.35, -0.28], [0.13, 0.35, -0.28]]]],
      };
    },
  },
  capivara: {
    nome: 'Capivara', vel: 0.6, alt: 0.9, raio: 0.4, som: 'hmm', nada: true,
    montar() {
      const c = 0x8a6a4a;
      return {
        corpo: [caixa(0.72, 0.6, 1.1, c, 0, 0.6, 0)],
        cabeca: [caixa(0.46, 0.46, 0.6, c, 0, 0, 0.15), caixa(0.36, 0.2, 0.1, 0x5e4630, 0, -0.06, 0.48),
          caixa(0.1, 0.1, 0.06, 0x5e4630, -0.17, 0.27, -0.05), caixa(0.1, 0.1, 0.06, 0x5e4630, 0.17, 0.27, -0.05),
          caixa(0.07, 0.07, 0.02, 0x111111, -0.18, 0.1, 0.26), caixa(0.07, 0.07, 0.02, 0x111111, 0.18, 0.1, 0.26)],
        cabecaPos: [0, 0.8, 0.58],
        pernas: [[0.18, 0.3, 0.18, 0x6e5238, [[-0.22, 0.3, 0.35], [0.22, 0.3, 0.35], [-0.22, 0.3, -0.35], [0.22, 0.3, -0.35]]]],
      };
    },
  },
  coelho: {
    nome: 'Coelho', vel: 1.4, alt: 0.6, raio: 0.22, som: 'pi', pula: true,
    montar(r) {
      const c = r < 0.5 ? 0xf5f1ea : 0xa98563;
      return {
        corpo: [caixa(0.3, 0.3, 0.42, c, 0, 0.28, 0), caixa(0.14, 0.14, 0.1, 0xffffff, 0, 0.34, -0.25)],
        cabeca: [caixa(0.26, 0.24, 0.24, c, 0, 0, 0.04), caixa(0.07, 0.24, 0.04, c, -0.07, 0.22, 0), caixa(0.07, 0.24, 0.04, c, 0.07, 0.22, 0),
          caixa(0.05, 0.05, 0.02, 0x222222, -0.07, 0.04, 0.165), caixa(0.05, 0.05, 0.02, 0x222222, 0.07, 0.04, 0.165), caixa(0.05, 0.04, 0.02, 0xf29ac2, 0, -0.04, 0.165)],
        cabecaPos: [0, 0.48, 0.2],
        pernas: [[0.08, 0.14, 0.12, c, [[-0.1, 0.14, 0.1], [0.1, 0.14, 0.1], [-0.1, 0.14, -0.12], [0.1, 0.14, -0.12]]]],
      };
    },
  },
};

export function montarBicho(especie, r) {
  const m = ESPECIES[especie].montar(r);
  const g = new THREE.Group();
  g.add(malha(juntar(m.corpo)));
  const cab = malha(juntar(m.cabeca));
  cab.position.set(...m.cabecaPos);
  g.add(cab);
  const pernas = [];
  for (const [w, h, d, cor, posicoes] of m.pernas) for (const p of posicoes) {
    const pe = membro(w, h, d, cor, ...p);
    g.add(pe); pernas.push(pe);
  }
  return { grupo: g, cabeca: cab, pernas };
}

// ---------- boneco dos jogadores (o meu na 3ª pessoa e o dos amigos) ----------
// Juntas: raiz (meio do corpo: gira o corpo todo para nadar deitado) > quadril (desce ao agachar)
// > pernas (coxa + canela, com joelho) e tronco (inclina) > cabeça e braços (braço + antebraço,
// com cotovelo). Pés no chão = y 0 do grupo. Frente = +z.
const CENTRO = 0.9, QUADRIL = 0.75, PERNA = 0.75, OMBRO_Y = 0.65;

// membro com pivô no topo, feito de várias caixas (já deslocadas para baixo do pivô)
function articulado(geos, x, y, z) {
  const m = malha(juntar(geos));
  m.position.set(x, y, z);
  return m;
}

export function montarBoneco(cor = 0x3f6fd9) {
  const g = new THREE.Group();
  const pele = 0xf1c8a0, calca = 0x3a4a6a, sapato = 0x4a3426;
  const raiz = new THREE.Group(); raiz.position.y = CENTRO;
  const quadril = new THREE.Group(); quadril.position.y = QUADRIL - CENTRO;
  const tronco = new THREE.Group(); tronco.rotation.order = 'YXZ';
  g.add(raiz); raiz.add(quadril); quadril.add(tronco);
  const corpo = malha(juntar([caixa(0.5, 0.65, 0.28, cor, 0, 0.33, 0)]));
  const cab = malha(juntar([caixa(0.48, 0.48, 0.48, pele, 0, 0.24, 0), caixa(0.5, 0.14, 0.5, 0x5a3a22, 0, 0.45, -0.01),
    caixa(0.08, 0.08, 0.02, 0x222222, -0.11, 0.26, 0.245), caixa(0.08, 0.08, 0.02, 0x222222, 0.11, 0.26, 0.245),
    caixa(0.16, 0.04, 0.02, 0xc0605a, 0, 0.12, 0.245)]));
  cab.position.y = OMBRO_Y; cab.rotation.order = 'YXZ';
  tronco.add(corpo, cab);
  // braço: manguinha da cor da roupa + pele; o antebraço fica pendurado no cotovelo
  const braco = (x) => {
    const b = articulado([caixa(0.22, 0.15, 0.24, cor, 0, -0.07, 0), caixa(0.2, 0.31, 0.22, pele, 0, -0.155, 0)], x, OMBRO_Y, 0);
    const a = articulado([caixa(0.19, 0.33, 0.21, pele, 0, -0.145, 0)], 0, -0.31, 0);
    b.add(a); tronco.add(b);
    return [b, a];
  };
  // perna: coxa + canela com sapato, joelho no meio
  const perna = (x) => {
    const p = articulado([caixa(0.22, 0.39, 0.24, calca, 0, -0.18, 0)], x, 0, 0);
    const c = articulado([caixa(0.21, 0.3, 0.23, calca, 0, -0.13, 0), caixa(0.23, 0.09, 0.29, sapato, 0, -0.33, 0.025)], 0, -0.375, 0);
    p.add(c); quadril.add(p);
    return [p, c];
  };
  const [bd, ad] = braco(-0.36), [be, ae] = braco(0.36);
  const [pd, cd] = perna(-0.13), [pe, ce] = perna(0.13);
  return { grupo: g, cabeca: cab, membros: [bd, be, pd, pe], antebracos: [ad, ae], canelas: [cd, ce], raiz, quadril, tronco };
}

// volta tudo para a pose em pé (ex.: amigo que sentou num veículo: lá só os membros são posados)
export function poseNeutra(b) {
  if (!b.raiz) return;
  for (const m of [...b.membros, ...b.antebracos, ...b.canelas]) m.rotation.set(0, 0, 0);
  b.raiz.rotation.set(0, 0, 0); b.tronco.rotation.set(0, 0, 0); b.cabeca.rotation.set(0, 0, 0);
  b.quadril.position.y = QUADRIL - CENTRO;
  b.anim = null;
}

// ---------- animação ----------
const TAU = Math.PI * 2;
const ang = (a) => ((a % TAU) + TAU * 1.5) % TAU - Math.PI; // ângulo entre -π e π
const suave = (a, b, taxa, dt) => a + (b - a) * Math.min(1, taxa * dt);
const lim = (v, a, b) => (v < a ? a : v > b ? b : v);
// índices da pose (ângulos em radianos; DH e DOB = quanto o quadril desce, em blocos)
const BDX = 0, BDZ = 1, BEX = 2, BEZ = 3, ADX = 4, AEX = 5, PDX = 6, PDZ = 7, PEX = 8, PEZ = 9, CDX = 10, CEX = 11,
  DH = 12, DOB = 13, TX = 14, TY = 15, RX = 16, NP = 17;
const MODOS_ANIM = ['chao', 'ar', 'agua', 'voo'];
// pé no chão sem patinar: a perna varre perna * amplitude * ω (na média do seno, ~ π/2 disso)
const K_PASSO = (Math.PI / (2 * PERNA)) * 0.8;

function estadoAnim(e) {
  return {
    chao: 1, ar: 0, agua: 0, voo: 0, corre: 0, agacha: 0, queda: 0, deita: 0, amp: 0, fase: 0, t: 0,
    yawCorpo: e.yaw || 0, virando: false, noArAntes: false, tAr: 0, vyMin: 0, yAntes: e.y ?? 0,
    impulso: 9, pouso: 9, pousoT: 0.2, pousoI: 0, degrau: 9, cabX: 0, cabY: 0,
    p: new Float32Array(NP), q: new Float32Array(NP),
  };
}
function misturar(P, Q, w) { for (let i = 0; i < NP; i++) P[i] += Q[i] * w; }

// Animação do boneco (o meu, na 3ª pessoa, e o dos amigos).
// e = { vx, vz, vy: velocidade (medida pela posição), y, yaw, pitch: para onde olha, noChao, voando, naAgua,
//       submerso (cabeça embaixo d'água: nada mesmo encostando no fundo), correndo, agachado,
//       golpe: 0..1 (>= 1 = parado), semPulo: saiu do chão sem apertar pular (degrau) }
// Cada estado (chão, ar, água, voo) tem sua pose; o boneco passa de uma para outra misturando aos poucos.
export function animarBoneco(b, e, dt) {
  const A = b.anim || (b.anim = estadoAnim(e));
  dt = Math.min(dt, 0.1);
  A.t += dt;
  const vx = e.vx || 0, vz = e.vz || 0, vy = e.vy || 0, v = Math.hypot(vx, vz);
  const voando = !!e.voando, agua = !voando && !!e.naAgua && (!e.noChao || !!e.submerso), noAr = !voando && !agua && !e.noChao;
  const yaw = e.yaw || 0, pitch = e.pitch || 0;

  // eventos: saiu do chão (pulo ou degrau) e pousou (amortece conforme a altura da queda).
  // Os relógios andam antes, para o primeiro quadro do evento já aparecer (tablet lento)
  A.impulso += dt; A.pouso += dt; A.degrau += dt;
  if (noAr) {
    if (!A.noArAntes) {
      A.tAr = 0; A.vyMin = 0;
      if (vy > 1) { if (e.semPulo) A.degrau = 0; else A.impulso = 0; }
    }
    A.tAr += dt; A.vyMin = Math.min(A.vyMin, vy);
  } else if (A.noArAntes && !voando && !agua && A.tAr > 0.12) {
    const i = lim((-A.vyMin - 3) / 17, 0, 1);
    A.pouso = 0; A.pousoI = A.degrau < 0.5 ? 0.1 : 0.22 + 0.78 * i; A.pousoT = 0.16 + 0.24 * i;
  }
  // degrau subido andando, sem sair do chão
  if (e.y != null) {
    if (e.noChao && !A.noArAntes && e.y - A.yAntes > 0.25 && e.y - A.yAntes < 1.2) A.degrau = 0;
    A.yAntes = e.y;
  }
  A.noArAntes = noAr;

  // pesos dos estados (somam ~1) e dos jeitos (correr, agachar, cair de alto, nadar deitado)
  const modo = voando ? 'voo' : agua ? 'agua' : noAr ? 'ar' : 'chao';
  const taxa = modo === 'ar' || A.ar > 0.05 ? 16 : 9;
  for (const k of MODOS_ANIM) A[k] = suave(A[k], k === modo ? 1 : 0, taxa, dt);
  const soma = A.chao + A.ar + A.agua + A.voo || 1;
  A.corre = suave(A.corre, e.correndo && v > 1.5 ? 1 : 0, 6, dt);
  A.agacha = suave(A.agacha, e.agachado ? 1 : 0, 10, dt);
  A.queda = suave(A.queda, noAr && (vy < -12 || (A.tAr > 0.9 && vy < -6)) ? 1 : 0, 4, dt);
  A.deita = suave(A.deita, agua && v > 0.5 ? 1 : 0, 3, dt);

  // para onde o corpo vira: andando, para onde vai (até ~57° da câmera; de costas anda de ré);
  // parado, só gira quando a cabeça já virou muito
  let alvoCorpo = A.yawCorpo, taxaCorpo = 8;
  if (voando) { alvoCorpo = yaw; taxaCorpo = 6; }
  else if (v > 0.4) {
    let d = ang(Math.atan2(-vx, -vz) - yaw);
    if (Math.abs(d) > 2.0) d = ang(d - Math.PI);
    alvoCorpo = yaw + lim(d, -1, 1); taxaCorpo = 10; A.virando = false;
  } else {
    const d = ang(yaw - A.yawCorpo);
    if (Math.abs(d) > 0.9) A.virando = true;
    if (A.virando) { alvoCorpo = yaw; taxaCorpo = 6; if (Math.abs(d) < 0.12) A.virando = false; }
  }
  if (e.golpe < 1) { alvoCorpo = yaw; taxaCorpo = 14; }
  A.yawCorpo = ang(A.yawCorpo + ang(alvoCorpo - A.yawCorpo) * Math.min(1, taxaCorpo * dt));
  b.grupo.rotation.y = A.yawCorpo + Math.PI; // a frente do boneco é +z e a câmera olha para -z
  const vFrente = -vx * Math.sin(A.yawCorpo) - vz * Math.cos(A.yawCorpo); // < 0 = andando de ré

  // passada: amplitude cresce com a velocidade; a frequência vem da velocidade real (pé não patina)
  const ampMax = (0.6 + 0.3 * A.corre) * (1 - 0.45 * A.agacha);
  A.amp = suave(A.amp, Math.min(ampMax, v * 0.2) * (A.chao + A.ar * 0.3), 10, dt);
  const wChao = A.amp > 0.02 ? Math.min(15, (K_PASSO * v) / Math.max(A.amp, 0.12)) : 0;
  const wAgua = 3 + Math.min(v, 3) * 1.2;
  const omega = (A.chao + A.ar) * wChao * (vFrente < -0.2 ? -1 : 1) + A.agua * wAgua + A.voo * 2.5;
  A.fase = (A.fase + dt * omega) % (TAU * 100);
  const s = Math.sin(A.fase), c = Math.cos(A.fase), am = A.amp;
  const resp = Math.sin(A.t * 1.9), parado = 1 - lim(am / 0.3, 0, 1);

  const P = A.p, Q = A.q;
  P.fill(0);
  // --- no chão: parado (respirando), andando, correndo, agachado ---
  if (A.chao > 0.001) {
    Q.fill(0);
    const ag = A.agacha, co = A.corre;
    Q[PDX] = -am * s; Q[PEX] = am * s;
    // o joelho dobra na perna que está indo para a frente (correndo, dobra bem mais)
    Q[CDX] = am * (0.8 + 1.4 * co) * Math.max(0, c); Q[CEX] = am * (0.8 + 1.4 * co) * Math.max(0, -c);
    Q[DH] = PERNA * (1 - Math.cos(am * s)) * 0.7; // pernas abertas: o quadril desce um tiquinho
    const braco = am * (1.15 - 0.15 * co);
    Q[BDX] = braco * s - 0.35 * ag; Q[BEX] = -braco * s - 0.35 * ag;
    Q[BDZ] = -0.06 - 0.03 * (1 + resp) * parado; Q[BEZ] = 0.06 + 0.03 * (1 + resp) * parado;
    Q[ADX] = -(0.12 + 1.35 * co + 0.5 * ag) - 0.3 * am * Math.max(0, -s);
    Q[AEX] = -(0.12 + 1.35 * co + 0.5 * ag) - 0.3 * am * Math.max(0, s);
    Q[DOB] = 0.28 * ag;
    Q[TX] = 0.06 * am + 0.3 * co + 0.35 * ag + 0.022 * resp * parado;
    Q[TY] = 0.14 * am * s;
    misturar(P, Q, A.chao / soma);
  }
  // --- no ar: pulo (braços para cima) e queda longa (braços abertos, se debatendo) ---
  if (A.ar > 0.001) {
    Q.fill(0);
    const sobe = lim(vy / 8, 0, 1), qd = A.queda, sl = 1 - qd, w = Math.sin(A.t * 9);
    Q[BDX] = sl * -(1.3 + 1.3 * sobe) + qd * -0.4; Q[BEX] = Q[BDX];
    Q[BDZ] = sl * -0.35 + qd * (-1.9 + 0.25 * w); Q[BEZ] = sl * 0.35 + qd * (1.9 + 0.25 * w);
    Q[ADX] = Q[AEX] = sl * -0.3 + qd * -0.2;
    Q[PDX] = sl * (-0.75 - 0.15 * A.corre) + qd * (-0.4 + 0.3 * w); Q[PEX] = sl * (0.4 + 0.1 * A.corre) + qd * (-0.1 - 0.3 * w);
    Q[CDX] = sl * 1.1 + qd * 0.5; Q[CEX] = sl * 0.5 + qd * 0.5;
    Q[PDZ] = -0.15 * qd; Q[PEZ] = 0.15 * qd;
    Q[TX] = sl * 0.12 - qd * 0.15;
    misturar(P, Q, A.ar / soma);
  }
  // --- na água: boiando em pé (parado) ou nadando deitado (braçadas e pernadas) ---
  if (A.agua > 0.001) {
    Q.fill(0);
    const de = A.deita, pe2 = 1 - de, s2 = Math.sin(A.fase * 2);
    Q[BDX] = pe2 * (-0.5 + 0.35 * s) + de * (-1.6 - 1.3 * s); Q[BEX] = pe2 * (-0.5 - 0.35 * s) + de * (-1.6 + 1.3 * s);
    Q[BDZ] = pe2 * (-0.9 + 0.3 * c) - de * 0.2; Q[BEZ] = pe2 * (0.9 - 0.3 * c) + de * 0.2;
    Q[ADX] = pe2 * -0.6 - de * 0.35 * Math.max(0, c); Q[AEX] = pe2 * -0.6 - de * 0.35 * Math.max(0, -c);
    Q[PDX] = pe2 * (-0.45 + 0.4 * s) + de * 0.32 * s2; Q[PEX] = pe2 * (-0.45 - 0.4 * s) - de * 0.32 * s2;
    Q[CDX] = pe2 * (0.9 + 0.4 * c) + de * (0.2 + 0.25 * Math.max(0, s2)); Q[CEX] = pe2 * (0.9 - 0.4 * c) + de * (0.2 + 0.25 * Math.max(0, -s2));
    // deitado; olhando para baixo, mergulha de cabeça
    Q[RX] = pe2 * 0.12 + de * lim(1.35 - pitch * 0.7, 0.5, 2.3);
    misturar(P, Q, A.agua / soma);
  }
  // --- voando: asas abertas, pernas para trás, inclina com a velocidade ---
  if (A.voo > 0.001) {
    Q.fill(0);
    Q[BDZ] = -1.25 - s * 0.08; Q[BEZ] = 1.25 + s * 0.08;
    Q[PDX] = 0.3 + s * 0.12; Q[PEX] = 0.3 - s * 0.12;
    Q[RX] = 0.35 * lim(v / 9, 0, 1);
    misturar(P, Q, A.voo / soma);
  }

  // --- por cima: impulso do pulo, amortecer a queda, perna que sobe o degrau ---
  if (A.impulso < 0.1) {
    const k = 1 - A.impulso / 0.1;
    P[DOB] += 0.17 * k; P[TX] += 0.25 * k; P[BDX] += 0.6 * k; P[BEX] += 0.6 * k;
  }
  if (A.pouso < A.pousoT) {
    const x = A.pouso / A.pousoT;
    let k = x < 0.25 ? x / 0.25 : 1 - (x - 0.25) / 0.75;
    k = k * k * (3 - 2 * k) * A.pousoI;
    P[DOB] += 0.34 * k; P[TX] += 0.35 * k; P[BDX] -= 0.5 * k; P[BEX] -= 0.5 * k; P[BDZ] -= 0.3 * k; P[BEZ] += 0.3 * k;
  }
  if (A.degrau < 0.32) {
    const k = Math.sin((Math.PI * A.degrau) / 0.32);
    P[PDX] -= 1.1 * k; P[CDX] += 1.3 * k; P[PEX] += 0.2 * k; P[TX] += 0.15 * k; P[BEX] -= 0.4 * k;
  }
  // bater / colocar: o braço direito vai esticado para a frente e volta
  if (e.golpe < 1) {
    const g = Math.sin(Math.max(0, e.golpe) * Math.PI);
    P[BDX] = P[BDX] * (1 - g) - 1.9 * g; P[BDZ] = P[BDZ] * (1 - g) + 0.25 * g; P[ADX] *= 1 - g;
  }

  // agachar/amortecer: dobra os joelhos o quanto o quadril desceu (os pés continuam no chão)
  const dob = lim(P[DOB], 0, 0.45);
  const t = Math.acos((PERNA - dob) / PERNA);
  const [bd, be, pd, pe] = b.membros, [ad, ae] = b.antebracos, [cd, ce] = b.canelas;
  bd.rotation.x = P[BDX]; bd.rotation.z = P[BDZ]; be.rotation.x = P[BEX]; be.rotation.z = P[BEZ];
  ad.rotation.x = Math.min(0, P[ADX]); ae.rotation.x = Math.min(0, P[AEX]);
  pd.rotation.x = P[PDX] - t; pd.rotation.z = P[PDZ]; pe.rotation.x = P[PEX] - t; pe.rotation.z = P[PEZ];
  cd.rotation.x = Math.max(0, P[CDX] + 2 * t); ce.rotation.x = Math.max(0, P[CEX] + 2 * t);
  b.quadril.position.y = QUADRIL - CENTRO - P[DH] - dob;
  b.raiz.rotation.x = P[RX];
  // a cabeça segue a câmera (para cima/baixo e um pouco para os lados); virando muito, o tronco acompanha
  const olharY = lim(ang(yaw - A.yawCorpo), -1.25, 1.25);
  A.cabY = suave(A.cabY, olharY, 12, dt);
  A.cabX = suave(A.cabX, lim(-pitch * 0.75 - P[TX] - P[RX] * 0.75, -1.25, 0.85), 12, dt);
  const troncoY = P[TY] + A.cabY * 0.35;
  b.tronco.rotation.x = P[TX]; b.tronco.rotation.y = troncoY;
  b.cabeca.rotation.y = A.cabY - troncoY; b.cabeca.rotation.x = A.cabX;
}

// etiqueta com o nome acima da cabeça
export function etiqueta(texto) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 28px system-ui, sans-serif';
  const w = Math.ceil(ctx.measureText(texto).width) + 24;
  cv.width = w; cv.height = 40;
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, 40, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(texto, w / 2, 21);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(w / 150, 40 / 150, 1);
  s.renderOrder = 10;
  return s;
}

// textura de coração / emoji para partículas
const cacheTex = new Map();
export function texturaEmoji(e) {
  if (cacheTex.has(e)) return cacheTex.get(e);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = '52px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, 32, 36);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheTex.set(e, t);
  return t;
}

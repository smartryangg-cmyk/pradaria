// Modelos 3D feitos de caixinhas (bichos e jogadores), com cores e sombreamento embutidos.
import * as THREE from '../vendor/three.module.min.js';
import { PELES, CORES_CABELO, CORES_OLHOS, CORES_ROUPA, PADRAO, normalizarSkin, skinDeCor } from './skin.js';

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

// ---------- boneco do jogador (o meu na 3ª pessoa, o dos amigos e o do editor de personagem) ----------
// Feito a partir do personagem (skin.js): pele, cabelo, rosto, roupa, calça, sapato e chapéu.
// Medidas (frente = +z): pernas 0..0.75, tronco 0.755..1.405, cabeça 1.4..1.88, braços pendurados de 1.4.

// esfera / cilindro com cor (para cabelo black power, coque, pompom, saia e chapéu)
function comCor(g, cor) {
  g.deleteAttribute('uv');
  const c = new THREE.Color(cor), n = g.attributes.position.count, cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return g;
}
export function bola(r, cor, ox = 0, oy = 0, oz = 0, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, 10, 7);
  g.scale(sx, sy, sz); g.translate(ox, oy, oz);
  return comCor(g, cor);
}
export function cilindro(rt, rb, h, cor, ox = 0, oy = 0, oz = 0, lados = 12) {
  const g = new THREE.CylinderGeometry(rt, rb, h, lados);
  g.translate(ox, oy, oz);
  return comCor(g, cor);
}

// braço/perna de várias cores, empilhadas de cima para baixo; pivô no topo
function membroPartes(partes, x, y, z) {
  let topo = 0;
  const geos = [];
  for (const [w, h, d, cor, dz = 0] of partes) { geos.push(caixa(w, h, d, cor, 0, topo - h / 2, dz)); topo -= h; }
  const m = malha(juntar(geos));
  m.position.set(x, y, z);
  return m;
}

const BOCA = 0xc0605a, ESCURO = 0x222222, BRANCO = 0xffffff, ROSA = 0xf29a9a, PALHA = 0xe8c66a, OURO = 0xf5c542;

function pecasCabeca(s) {
  const pele = PELES[s.pele], ch = CORES_CABELO[s.corCabelo], io = CORES_OLHOS[s.corOlhos], hat = CORES_ROUPA[s.corChapeu];
  const g = [caixa(0.48, 0.48, 0.48, pele, 0, 0.24, 0)];
  const z = 0.245; // frente do rosto
  // olhos
  for (const lx of [-0.11, 0.11]) {
    if (s.olhos === 0) g.push(caixa(0.08, 0.08, 0.02, io, lx, 0.26, z));
    else if (s.olhos === 1) g.push(caixa(0.13, 0.13, 0.02, BRANCO, lx, 0.26, z), caixa(0.07, 0.09, 0.02, io, lx + (lx < 0 ? 0.02 : -0.02), 0.25, z + 0.006));
    else if (s.olhos === 2) g.push(caixa(0.12, 0.035, 0.02, ESCURO, lx, 0.275, z), caixa(0.035, 0.035, 0.02, ESCURO, lx - 0.055, 0.25, z), caixa(0.035, 0.035, 0.02, ESCURO, lx + 0.055, 0.25, z));
    else if (s.olhos === 3) g.push(caixa(0.1, 0.11, 0.02, io, lx, 0.26, z), caixa(0.04, 0.04, 0.02, BRANCO, lx + 0.025, 0.285, z + 0.006));
    else g.push(caixa(0.12, 0.035, 0.02, ESCURO, lx, 0.27, z + 0.004), caixa(0.08, 0.045, 0.02, io, lx, 0.24, z));
  }
  // boca
  if (s.boca === 0) g.push(caixa(0.16, 0.04, 0.02, BOCA, 0, 0.12, z));
  else if (s.boca === 1) g.push(caixa(0.2, 0.09, 0.02, 0x7a2a2a, 0, 0.115, z), caixa(0.17, 0.03, 0.02, BRANCO, 0, 0.142, z + 0.005));
  else if (s.boca === 2) g.push(caixa(0.08, 0.03, 0.02, BOCA, 0, 0.12, z));
  else g.push(caixa(0.16, 0.04, 0.02, BOCA, 0, 0.125, z), caixa(0.07, 0.07, 0.02, 0xef7f95, 0.02, 0.085, z + 0.005));
  // extras do rosto
  if (s.rosto === 1) g.push(caixa(0.08, 0.05, 0.02, ROSA, -0.17, 0.16, z - 0.002), caixa(0.08, 0.05, 0.02, ROSA, 0.17, 0.16, z - 0.002));
  else if (s.rosto === 2) for (const [x, y] of [[-0.18, 0.18], [-0.14, 0.15], [-0.19, 0.14], [0.18, 0.18], [0.14, 0.15], [0.19, 0.14]]) g.push(caixa(0.025, 0.025, 0.02, 0xa8673f, x, y, z - 0.002));
  else if (s.rosto === 3) {
    for (const lx of [-0.11, 0.11]) g.push(caixa(0.17, 0.025, 0.02, ESCURO, lx, 0.335, z + 0.012), caixa(0.17, 0.025, 0.02, ESCURO, lx, 0.185, z + 0.012),
      caixa(0.025, 0.15, 0.02, ESCURO, lx - 0.085, 0.26, z + 0.012), caixa(0.025, 0.15, 0.02, ESCURO, lx + 0.085, 0.26, z + 0.012));
    g.push(caixa(0.06, 0.025, 0.02, ESCURO, 0, 0.29, z + 0.012), caixa(0.02, 0.025, 0.2, ESCURO, -0.245, 0.3, 0.13), caixa(0.02, 0.025, 0.2, ESCURO, 0.245, 0.3, 0.13));
  } else if (s.rosto === 4) {
    g.push(caixa(0.17, 0.11, 0.02, 0x1b1b24, -0.11, 0.265, z + 0.014), caixa(0.17, 0.11, 0.02, 0x1b1b24, 0.11, 0.265, z + 0.014),
      caixa(0.06, 0.025, 0.02, ESCURO, 0, 0.29, z + 0.014), caixa(0.02, 0.025, 0.2, ESCURO, -0.245, 0.3, 0.13), caixa(0.02, 0.025, 0.2, ESCURO, 0.245, 0.3, 0.13));
  }
  // cabelo
  const curto = () => g.push(caixa(0.52, 0.1, 0.52, ch, 0, 0.47, 0), caixa(0.52, 0.3, 0.06, ch, 0, 0.33, -0.245),
    caixa(0.04, 0.16, 0.42, ch, -0.25, 0.37, -0.03), caixa(0.04, 0.16, 0.42, ch, 0.25, 0.37, -0.03));
  let topo = 0.48;
  if (s.cabelo >= 1 && s.cabelo <= 6) { curto(); topo = 0.52; }
  if (s.cabelo === 2) for (const [x, zz, h] of [[-0.15, 0.1, 0.12], [0.02, 0.14, 0.15], [0.17, 0.06, 0.11], [-0.08, -0.1, 0.13], [0.12, -0.14, 0.12]]) g.push(caixa(0.11, h, 0.11, ch, x, 0.52 + h / 2, zz));
  else if (s.cabelo === 3) g.push(caixa(0.52, 0.1, 0.05, ch, 0, 0.42, 0.24), caixa(0.14, 0.06, 0.05, ch, -0.17, 0.36, 0.24));
  else if (s.cabelo === 4) g.push(caixa(0.54, 0.64, 0.08, ch, 0, 0.19, -0.255), caixa(0.06, 0.46, 0.3, ch, -0.265, 0.23, -0.07), caixa(0.06, 0.46, 0.3, ch, 0.265, 0.23, -0.07));
  else if (s.cabelo === 5) g.push(caixa(0.1, 0.1, 0.08, hat === ch ? BRANCO : hat, 0, 0.36, -0.3), caixa(0.13, 0.4, 0.13, ch, 0, 0.12, -0.32));
  else if (s.cabelo === 6) g.push(bola(0.12, ch, 0, 0.58, -0.1));
  else if (s.cabelo === 7) { g.push(bola(0.34, ch, 0, 0.42, -0.1, 1.12, 0.86, 1), caixa(0.5, 0.06, 0.4, ch, 0, 0.49, 0.03)); topo = 0.7; }
  // chapéu
  if (s.chapeu === 1) g.push(caixa(0.54, 0.15, 0.54, hat, 0, topo + 0.04, 0), caixa(0.5, 0.04, 0.24, hat, 0, topo - 0.01, 0.36), caixa(0.08, 0.04, 0.08, BRANCO, 0, topo + 0.13, 0));
  else if (s.chapeu === 2) g.push(cilindro(0.5, 0.5, 0.035, PALHA, 0, topo, 0, 16), cilindro(0.26, 0.29, 0.22, PALHA, 0, topo + 0.12, 0), cilindro(0.295, 0.295, 0.06, hat, 0, topo + 0.04, 0));
  else if (s.chapeu === 3) g.push(caixa(0.56, 0.08, 0.56, BRANCO, 0, topo - 0.02, 0), caixa(0.52, 0.2, 0.52, hat, 0, topo + 0.1, 0), bola(0.09, BRANCO, 0, topo + 0.26, 0));
  else if (s.chapeu === 4) {
    g.push(caixa(0.5, 0.1, 0.5, OURO, 0, topo + 0.03, 0));
    for (const [x, zz] of [[-0.2, 0.2], [0, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2], [0, -0.2]]) g.push(caixa(0.08, 0.12, 0.08, OURO, x, topo + 0.13, zz));
    g.push(caixa(0.07, 0.07, 0.02, hat, 0, topo + 0.03, 0.255));
  } else if (s.chapeu === 5) g.push(caixa(0.16, 0.13, 0.06, hat, 0.08, topo + 0.02, 0.1), caixa(0.16, 0.13, 0.06, hat, 0.3, topo + 0.02, 0.1), caixa(0.08, 0.08, 0.08, hat, 0.19, topo + 0.02, 0.1));
  return g;
}

function pecasCorpo(s) {
  const pele = PELES[s.pele], r = CORES_ROUPA[s.corRoupa], d = CORES_ROUPA[s.corDetalhe];
  const jardineira = s.roupa === 5, vestido = s.roupa === 4;
  const camisa = jardineira ? d : r; // na jardineira a camiseta de baixo é a cor do detalhe
  const g = [caixa(0.5, 0.65, 0.28, camisa, 0, 1.08, 0)];
  // estampa (não vale na jardineira, que já tem duas cores)
  if (!jardineira) {
    if (s.estampa === 1) for (const y of [0.88, 1.05, 1.22]) g.push(caixa(0.51, 0.07, 0.29, d, 0, y, 0));
    else if (s.estampa === 2) g.push(caixa(0.13, 0.66, 0.29, d, 0, 1.08, 0));
    else if (s.estampa === 3) g.push(caixa(0.24, 0.14, 0.02, d, 0.09, 0.95, 0.145), caixa(0.24, 0.02, 0.02, ESCURO, 0.09, 1.025, 0.146));
  }
  if (s.roupa === 1) g.push(caixa(0.5, 0.06, 0.24, pele, 0, 1.38, 0), caixa(0.06, 0.06, 0.29, r, -0.19, 1.38, 0), caixa(0.06, 0.06, 0.29, r, 0.19, 1.38, 0));
  if (s.roupa === 3) g.push(caixa(0.42, 0.2, 0.12, r, 0, 1.4, -0.18), caixa(0.03, 0.14, 0.02, BRANCO, -0.07, 1.31, 0.146), caixa(0.03, 0.14, 0.02, BRANCO, 0.07, 1.31, 0.146));
  if (jardineira) g.push(caixa(0.34, 0.3, 0.02, r, 0, 0.93, 0.145), caixa(0.51, 0.16, 0.29, r, 0, 0.84, 0),
    caixa(0.06, 0.34, 0.02, r, -0.15, 1.22, 0.145), caixa(0.06, 0.34, 0.02, r, 0.15, 1.22, 0.145), caixa(0.06, 0.4, 0.02, r, -0.15, 1.15, -0.145), caixa(0.06, 0.4, 0.02, r, 0.15, 1.15, -0.145),
    caixa(0.05, 0.05, 0.02, OURO, -0.15, 1.08, 0.157), caixa(0.05, 0.05, 0.02, OURO, 0.15, 1.08, 0.157));
  // saia / vestido (rodadinhos)
  if (vestido) g.push(cilindro(0.27, 0.38, 0.44, r, 0, 0.6, 0, 14));
  else if (s.calca === 2) g.push(cilindro(0.27, 0.35, 0.28, CORES_ROUPA[s.corCalca], 0, 0.69, 0, 14));
  return g;
}

function membrosDe(s) {
  const pele = PELES[s.pele], r = CORES_ROUPA[s.corRoupa], d = CORES_ROUPA[s.corDetalhe], sap = CORES_ROUPA[s.corSapato];
  const manga = s.roupa === 2 || s.roupa === 3 ? 0.52 : s.roupa === 1 ? 0 : 0.22;
  const corManga = s.roupa === 5 ? d : r;
  const braco = (x) => membroPartes(manga ? [[0.22, manga, 0.24, corManga], [0.2, 0.62 - manga, 0.22, pele]] : [[0.2, 0.62, 0.22, pele]], x, 1.4, 0);
  // jardineira: a calça é da cor da roupa; vestido e saia: pernas de fora
  const pernasDeFora = s.roupa === 4 || s.calca === 2;
  const corCalca = s.roupa === 5 ? r : CORES_ROUPA[s.corCalca];
  const sapato = [0.24, 0.14, 0.28, sap, 0.02];
  const perna = (x) => membroPartes(pernasDeFora ? [[0.2, 0.61, 0.22, pele], sapato]
    : s.calca === 1 && s.roupa !== 5 ? [[0.23, 0.3, 0.25, corCalca], [0.2, 0.31, 0.22, pele], sapato]
      : [[0.22, 0.61, 0.24, corCalca], sapato], x, 0.75, 0);
  return [braco(-0.36), braco(0.36), perna(-0.13), perna(0.13)];
}

// (re)veste o boneco com um personagem; o grupo continua o mesmo (pode estar sentado num carro, com etiqueta etc.)
export function vestirBoneco(b, skin) {
  const s = typeof skin === 'number' ? skinDaCorHex(skin) : normalizarSkin(skin);
  for (const c of [...b.grupo.children]) if (c.userData.boneco) { b.grupo.remove(c); c.geometry.dispose(); }
  const corpo = malha(juntar(pecasCorpo(s)));
  const cab = malha(juntar(pecasCabeca(s)));
  cab.position.y = 1.4;
  const membros = membrosDe(s);
  for (const m of [corpo, cab, ...membros]) { m.userData.boneco = true; b.grupo.add(m); }
  // mantém a pose de antes
  if (b.membros) membros.forEach((m, i) => m.rotation.copy(b.membros[i].rotation));
  if (b.cabeca) cab.rotation.copy(b.cabeca.rotation);
  b.cabeca = cab; b.membros = membros; b.skin = s;
  return b;
}
// compatibilidade: quem ainda passa uma cor de camiseta (0xRRGGBB)
function skinDaCorHex(hex) { const i = CORES_ROUPA.indexOf(hex); return skinDeCor(i >= 0 && i < 8 ? i : 0); }

export function montarBoneco(skin = PADRAO) {
  return vestirBoneco({ grupo: new THREE.Group(), cabeca: null, membros: null }, skin);
}

// Animação do boneco (o meu, na 3ª pessoa, e o dos amigos): andar, pular, voar, nadar e bater.
// e = { anda: 0..1, noAr, voando, nadando, golpe: 0..1 (>= 1 = parado), pitch }
export function animarBoneco(b, e, dt) {
  const [bd, be, pd, pe] = b.membros;
  const anda = e.anda > 0.05 ? e.anda : 0;
  b.fase = ((b.fase || 0) + dt * (e.voando ? 2.5 : e.nadando ? 5 : anda ? 7 + anda * 5 : 0)) % (Math.PI * 200);
  const s = Math.sin(b.fase);
  let bdx, bex, bdz = 0, bez = 0, pdx, pex;
  if (e.voando) {
    // asas abertas, pernas para trás balançando de leve
    bdz = -1.25 - s * 0.08; bez = 1.25 + s * 0.08; bdx = bex = 0;
    pdx = 0.3 + s * 0.12; pex = 0.3 - s * 0.12;
  } else if (e.nadando) {
    // braçadas e pernadas
    bdx = -1.5 + s * 0.9; bex = -1.5 - s * 0.9; bdz = -0.25; bez = 0.25;
    pdx = Math.sin(b.fase * 2) * 0.45; pex = -pdx;
  } else if (e.noAr) {
    // pulo: braços sobem um pouco e as pernas abrem
    bdx = bex = -0.45; bdz = -0.35; bez = 0.35;
    pdx = -0.55; pex = 0.35;
  } else {
    const a = s * 0.8 * anda;
    bdx = a; bex = -a; pdx = -a; pex = a;
  }
  // bater / colocar: o braço direito vai para a frente e volta
  if (e.golpe < 1) {
    const g = Math.sin(Math.max(0, e.golpe) * Math.PI);
    bdx = bdx * (1 - g) - 1.9 * g; bdz = bdz * (1 - g) + 0.25 * g;
  }
  bd.rotation.x = bdx; be.rotation.x = bex; bd.rotation.z = bdz; be.rotation.z = bez;
  pd.rotation.x = pdx; pe.rotation.x = pex; pd.rotation.z = pe.rotation.z = 0;
  b.cabeca.rotation.x = -(e.pitch || 0) * 0.6;
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

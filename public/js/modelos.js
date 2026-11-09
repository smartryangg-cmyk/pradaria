// Modelos 3D feitos de caixinhas (bichos e jogadores), com cores e sombreamento embutidos.
import * as THREE from '../vendor/three.module.min.js';
import { PELES, CORES_CABELO, CORES_OLHOS, CORES_ROUPA, PADRAO, normalizarSkin, skinDeCor } from './skin.js';
import { opcoesMundo } from './opcoes-mundo.js';

export const matModelo = new THREE.MeshLambertMaterial({ vertexColors: true });
function malha(geo) { const m = new THREE.Mesh(geo, matModelo); m.castShadow = true; return m; }
// a luz do sol já faz o sombreado; aqui só um toque leve para o desenho ficar nítido
const SOMBRA = [0.95, 0.95, 1, 0.85, 0.92, 0.92];

// cria geometria de caixa com cor por face; o = deslocamento do centro
// No estilo Natural 3D (mundo suave) as caixas maiores ganham cantos redondos.
export function caixa(w, h, d, cor, ox = 0, oy = 0, oz = 0) {
  const redonda = opcoesMundo.estilo === 'suave' && Math.min(w, h, d) >= 0.12;
  const s = redonda ? 4 : 1;
  const g = new THREE.BoxGeometry(w, h, d, s, s, s);
  if (redonda) arredondar(g, w, h, d, Math.min(w, h, d) * 0.32);
  g.translate(ox, oy, oz);
  const c = new THREE.Color(cor);
  const pf = (s + 1) * (s + 1); // vértices por face
  const cols = new Float32Array(6 * pf * 3);
  for (let f = 0; f < 6; f++) for (let v = 0; v < pf; v++) {
    const i = (f * pf + v) * 3;
    cols[i] = c.r * SOMBRA[f]; cols[i + 1] = c.g * SOMBRA[f]; cols[i + 2] = c.b * SOMBRA[f];
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  return g;
}

// cantos redondos (raio r): cada vértice fica a r de uma caixa menor dentro; a normal aponta para fora dela
function arredondar(g, w, h, d, r) {
  const p = g.attributes.position, n = g.attributes.normal;
  const ix = w / 2 - r, iy = h / 2 - r, iz = d / 2 - r;
  // grade de 4 por face: o meio da face vai até onde começa a curva (m - r), a borda fica na aresta
  const encolhe = (v, m) => { const t = Math.abs(v) / m; return Math.sign(v) * (t <= 0.5 ? t * 2 * (m - r) : m - r + (t - 0.5) * 2 * r); };
  for (let i = 0; i < p.count; i++) {
    let x = encolhe(p.getX(i), w / 2), y = encolhe(p.getY(i), h / 2), z = encolhe(p.getZ(i), d / 2);
    const cx = Math.max(-ix, Math.min(ix, x)), cy = Math.max(-iy, Math.min(iy, y)), cz = Math.max(-iz, Math.min(iz, z));
    let nx = x - cx, ny = y - cy, nz = z - cz;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-6) { nx = n.getX(i); ny = n.getY(i); nz = n.getZ(i); } else { nx /= l; ny /= l; nz /= l; }
    p.setXYZ(i, cx + nx * r, cy + ny * r, cz + nz * r);
    n.setXYZ(i, nx, ny, nz);
  }
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
    montar(r, filhote) {
      if (filhote) return { // pintinho
        corpo: [caixa(0.42, 0.42, 0.5, 0xffe066, 0, 0.42, 0)],
        cabeca: [caixa(0.3, 0.3, 0.28, 0xffe066, 0, 0, 0), caixa(0.12, 0.08, 0.12, 0xf29a32, 0, -0.03, 0.18),
          caixa(0.06, 0.06, 0.02, 0x222222, -0.09, 0.05, 0.145), caixa(0.06, 0.06, 0.02, 0x222222, 0.09, 0.05, 0.145)],
        cabecaPos: [0, 0.75, 0.22],
        pernas: [[0.07, 0.24, 0.07, 0xf29a32, [[-0.1, 0.24, 0], [0.1, 0.24, 0]]]],
      };
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

  // ---------- bichos selvagens (instintos em instintos.js) ----------
  veado: {
    nome: 'Veado', vel: 1.1, alt: 1.3, raio: 0.38, som: 'veado',
    montar(r) {
      const c = 0xa8743f, claro = 0xf0e2c8;
      const chifre = r < 0.5 ? [caixa(0.05, 0.3, 0.05, 0x7a5a3a, -0.13, 0.36, -0.02), caixa(0.05, 0.3, 0.05, 0x7a5a3a, 0.13, 0.36, -0.02),
        caixa(0.18, 0.05, 0.05, 0x7a5a3a, -0.2, 0.45, -0.02), caixa(0.18, 0.05, 0.05, 0x7a5a3a, 0.2, 0.45, -0.02)] : [];
      return {
        corpo: [caixa(0.5, 0.5, 1.0, c, 0, 0.98, 0), caixa(0.4, 0.2, 0.7, claro, 0, 0.74, 0), caixa(0.16, 0.16, 0.1, 0xffffff, 0, 1.1, -0.53),
          caixa(0.24, 0.45, 0.24, c, 0, 1.28, 0.42)],
        cabeca: [caixa(0.3, 0.3, 0.42, c, 0, 0, 0.1), caixa(0.1, 0.2, 0.06, c, -0.17, 0.2, -0.02), caixa(0.1, 0.2, 0.06, c, 0.17, 0.2, -0.02),
          caixa(0.12, 0.08, 0.04, 0x222222, 0, -0.04, 0.32), caixa(0.06, 0.06, 0.02, 0x222222, -0.1, 0.06, 0.2), caixa(0.06, 0.06, 0.02, 0x222222, 0.1, 0.06, 0.2), ...chifre],
        cabecaPos: [0, 1.55, 0.55],
        pernas: [[0.1, 0.75, 0.1, 0x8a5a2e, [[-0.16, 0.75, 0.38], [0.16, 0.75, 0.38], [-0.16, 0.75, -0.38], [0.16, 0.75, -0.38]]]],
      };
    },
  },
  lobo: {
    nome: 'Lobo', vel: 1.4, alt: 1.0, raio: 0.36, som: 'lobo',
    montar(r) {
      const c = r < 0.7 ? 0x8d939b : 0x6b6560, claro = 0xd9d6d0;
      return {
        corpo: [caixa(0.46, 0.46, 1.0, c, 0, 0.72, 0), caixa(0.5, 0.5, 0.36, c, 0, 0.76, 0.3), caixa(0.36, 0.14, 0.7, claro, 0, 0.5, 0),
          caixa(0.14, 0.14, 0.5, c, 0, 0.78, -0.7), caixa(0.14, 0.14, 0.12, claro, 0, 0.74, -0.98)],
        cabeca: [caixa(0.4, 0.38, 0.36, c, 0, 0, 0.05), caixa(0.22, 0.18, 0.26, claro, 0, -0.08, 0.32),
          caixa(0.08, 0.07, 0.04, 0x222222, 0, -0.02, 0.46), caixa(0.1, 0.18, 0.06, c, -0.13, 0.26, -0.04), caixa(0.1, 0.18, 0.06, c, 0.13, 0.26, -0.04),
          caixa(0.07, 0.05, 0.02, 0xf2c94c, -0.1, 0.06, 0.235), caixa(0.07, 0.05, 0.02, 0xf2c94c, 0.1, 0.06, 0.235)],
        cabecaPos: [0, 0.98, 0.62],
        pernas: [[0.12, 0.5, 0.12, c, [[-0.13, 0.5, 0.32], [0.13, 0.5, 0.32], [-0.13, 0.5, -0.32], [0.13, 0.5, -0.32]]]],
      };
    },
  },
  raposa: {
    nome: 'Raposa', vel: 1.3, alt: 0.7, raio: 0.28, som: 'raposa',
    montar() {
      const c = 0xe07a2e, claro = 0xfaf0e0, pe = 0x2e2420;
      return {
        corpo: [caixa(0.32, 0.32, 0.7, c, 0, 0.45, 0), caixa(0.24, 0.12, 0.4, claro, 0, 0.32, 0.12),
          caixa(0.2, 0.2, 0.46, c, 0, 0.48, -0.55), caixa(0.2, 0.2, 0.14, claro, 0, 0.48, -0.84)],
        cabeca: [caixa(0.32, 0.28, 0.28, c, 0, 0, 0.02), caixa(0.16, 0.12, 0.2, claro, 0, -0.07, 0.22), caixa(0.07, 0.06, 0.04, 0x222222, 0, -0.04, 0.33),
          caixa(0.09, 0.16, 0.05, c, -0.1, 0.2, -0.02), caixa(0.09, 0.16, 0.05, c, 0.1, 0.2, -0.02),
          caixa(0.06, 0.05, 0.02, 0x222222, -0.08, 0.04, 0.165), caixa(0.06, 0.05, 0.02, 0x222222, 0.08, 0.04, 0.165)],
        cabecaPos: [0, 0.66, 0.42],
        pernas: [[0.08, 0.3, 0.08, pe, [[-0.09, 0.3, 0.22], [0.09, 0.3, 0.22], [-0.09, 0.3, -0.22], [0.09, 0.3, -0.22]]]],
      };
    },
  },
  urso: {
    nome: 'Urso', vel: 0.9, alt: 1.35, raio: 0.6, som: 'urso',
    montar(r) {
      const c = r < 0.75 ? 0x6b4a2f : 0x2f2a28, focinho = 0xc9a27a;
      return {
        corpo: [caixa(1.0, 0.9, 1.5, c, 0, 1.0, 0), caixa(0.9, 0.3, 0.5, c, 0, 1.5, 0.35)],
        cabeca: [caixa(0.62, 0.56, 0.5, c, 0, 0, 0.05), caixa(0.32, 0.26, 0.2, focinho, 0, -0.1, 0.36), caixa(0.12, 0.09, 0.04, 0x222222, 0, -0.02, 0.47),
          caixa(0.16, 0.16, 0.08, c, -0.25, 0.32, -0.04), caixa(0.16, 0.16, 0.08, c, 0.25, 0.32, -0.04),
          caixa(0.08, 0.08, 0.02, 0x111111, -0.15, 0.08, 0.305), caixa(0.08, 0.08, 0.02, 0x111111, 0.15, 0.08, 0.305)],
        cabecaPos: [0, 1.25, 0.88],
        pernas: [[0.3, 0.6, 0.3, c, [[-0.3, 0.6, 0.48], [0.3, 0.6, 0.48], [-0.3, 0.6, -0.48], [0.3, 0.6, -0.48]]]],
      };
    },
  },
  onca: {
    nome: 'Onça', vel: 1.2, alt: 0.95, raio: 0.42, som: 'onca',
    montar(r) {
      const preta = r < 0.12; // onça-preta: mesma espécie, pelagem escura
      const c = preta ? 0x2c2a2e : 0xe2a948, m = preta ? 0x1a181c : 0x3a2a1a, claro = preta ? 0x3a383c : 0xf6e6c4;
      const manchas = [];
      for (const [x, y, z] of [[-0.29, 0.8, 0.3], [0.29, 0.75, 0.1], [-0.29, 0.7, -0.2], [0.29, 0.85, -0.35], [0, 0.98, 0.15], [0.12, 0.98, -0.25], [-0.15, 0.98, -0.05], [-0.29, 0.86, -0.42], [0.29, 0.68, 0.38]])
        manchas.push(caixa(x === 0 || Math.abs(x) < 0.2 ? 0.12 : 0.02, x === 0 || Math.abs(x) < 0.2 ? 0.02 : 0.1, 0.12, m, x, y, z));
      return {
        corpo: [caixa(0.56, 0.48, 1.15, c, 0, 0.75, 0), caixa(0.44, 0.14, 0.9, claro, 0, 0.51, 0), ...manchas,
          caixa(0.12, 0.12, 0.7, c, 0, 0.78, -0.9), caixa(0.13, 0.13, 0.14, m, 0, 0.74, -1.25)],
        cabeca: [caixa(0.46, 0.4, 0.4, c, 0, 0, 0.05), caixa(0.26, 0.18, 0.14, claro, 0, -0.1, 0.28), caixa(0.09, 0.07, 0.04, 0x5a3a2a, 0, -0.04, 0.36),
          caixa(0.12, 0.12, 0.06, c, -0.17, 0.24, -0.04), caixa(0.12, 0.12, 0.06, c, 0.17, 0.24, -0.04),
          caixa(0.08, 0.06, 0.02, 0xc8e06a, -0.11, 0.06, 0.255), caixa(0.08, 0.06, 0.02, 0xc8e06a, 0.11, 0.06, 0.255)],
        cabecaPos: [0, 0.95, 0.66],
        pernas: [[0.15, 0.5, 0.15, c, [[-0.17, 0.5, 0.38], [0.17, 0.5, 0.38], [-0.17, 0.5, -0.38], [0.17, 0.5, -0.38]]]],
      };
    },
  },
  cobra: {
    nome: 'Cobra', vel: 0.6, alt: 0.3, raio: 0.3, som: 'cobra',
    montar(r) {
      const c = r < 0.5 ? 0x5d9a3a : 0x9a7a4a, f = r < 0.5 ? 0x3e6e26 : 0x6a4e2e;
      const seg = [];
      // corpo em zigue-zague, deitado no chão
      for (let i = 0; i < 6; i++) seg.push(caixa(0.16, 0.14, 0.24, i % 2 ? f : c, Math.sin(i * 1.3) * 0.12, 0.08, -0.05 - i * 0.2));
      seg.push(caixa(0.1, 0.1, 0.2, f, Math.sin(7.8) * 0.12, 0.06, -1.25));
      return {
        corpo: seg,
        cabeca: [caixa(0.22, 0.14, 0.26, c, 0, 0, 0.06), caixa(0.04, 0.04, 0.02, 0x111111, -0.07, 0.04, 0.17), caixa(0.04, 0.04, 0.02, 0x111111, 0.07, 0.04, 0.17),
          caixa(0.03, 0.02, 0.1, 0xd23b4a, 0, -0.03, 0.24)],
        cabecaPos: [0, 0.12, 0.1],
        pernas: [],
      };
    },
  },
};

export function montarBicho(especie, r, filhote = false) {
  const m = ESPECIES[especie].montar(r, filhote);
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
// Juntas: raiz (meio do corpo: gira o corpo todo para nadar deitado) > quadril (desce ao agachar)
// > pernas (coxa + canela, com joelho) e tronco (inclina) > cabeça e braços (braço + antebraço,
// com cotovelo). Pés no chão = y 0 do grupo.
const CENTRO = 0.9, QUADRIL = 0.75, PERNA = 0.75, OMBRO_Y = 0.65, BRACO = 0.62;

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
// (inicio > 0: a primeira peça sobe um pouco acima do pivô, para não abrir buraco no joelho/cotovelo)
function membroPartes(partes, x, y, z, inicio = 0) {
  let topo = inicio;
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

// corta uma pilha de peças [w, h, d, cor, dz] em duas: as de cima (até "corte") e as de baixo
function cortar(partes, corte) {
  const cima = [], baixo = [];
  let y = 0;
  for (const p of partes) {
    const [w, h, d, cor, dz = 0] = p;
    if (y + h <= corte + 1e-6) cima.push(p);
    else if (y >= corte - 1e-6) baixo.push(p);
    else { cima.push([w, corte - y, d, cor, dz]); baixo.push([w, y + h - corte, d, cor, dz]); }
    y += h;
  }
  return [cima, baixo];
}
// prolonga a primeira peça para cima (cobre a junta quando dobra)
const comFolga = (partes, f) => partes.map((p, i) => (i ? p : [p[0] * 0.95, p[1] + f, p[2] * 0.95, p[3], p[4] || 0]));

// braços (braço + antebraço) e pernas (coxa + canela); cada um devolve [de cima, de baixo]
function membrosDe(s) {
  const pele = PELES[s.pele], r = CORES_ROUPA[s.corRoupa], d = CORES_ROUPA[s.corDetalhe], sap = CORES_ROUPA[s.corSapato];
  const manga = s.roupa === 2 || s.roupa === 3 ? 0.52 : s.roupa === 1 ? 0 : 0.22;
  const corManga = s.roupa === 5 ? d : r;
  const articular = (partes, total, x, y) => {
    const [cima, baixo] = cortar(partes, total / 2);
    const a = membroPartes(cima, x, y, 0), b = membroPartes(comFolga(baixo, 0.03), 0, -total / 2, 0, 0.03);
    a.add(b);
    return [a, b];
  };
  const braco = (x) => articular(manga ? [[0.22, manga, 0.24, corManga], [0.2, BRACO - manga, 0.22, pele]] : [[0.2, BRACO, 0.22, pele]], BRACO, x, OMBRO_Y);
  // jardineira: a calça é da cor da roupa; vestido e saia: pernas de fora
  const pernasDeFora = s.roupa === 4 || s.calca === 2;
  const corCalca = s.roupa === 5 ? r : CORES_ROUPA[s.corCalca];
  const sapato = [0.24, 0.14, 0.28, sap, 0.02];
  const perna = (x) => articular(pernasDeFora ? [[0.2, 0.61, 0.22, pele], sapato]
    : s.calca === 1 && s.roupa !== 5 ? [[0.23, 0.3, 0.25, corCalca], [0.2, 0.31, 0.22, pele], sapato]
      : [[0.22, 0.61, 0.24, corCalca], sapato], PERNA, x, 0);
  return [braco(-0.36), braco(0.36), perna(-0.13), perna(0.13)];
}

// (re)veste o boneco com um personagem; o grupo e as juntas continuam os mesmos (pode estar sentado
// num carro, com etiqueta, no meio de um passo etc.) e a pose é mantida
export function vestirBoneco(b, skin) {
  const s = typeof skin === 'number' ? skinDaCorHex(skin) : normalizarSkin(skin);
  if (!b.raiz) {
    b.raiz = new THREE.Group(); b.raiz.position.y = CENTRO;
    b.quadril = new THREE.Group(); b.quadril.position.y = QUADRIL - CENTRO;
    b.tronco = new THREE.Group(); b.tronco.rotation.order = 'YXZ';
    b.grupo.add(b.raiz); b.raiz.add(b.quadril); b.quadril.add(b.tronco);
  }
  for (const m of b.pecas || []) { m.parent && m.parent.remove(m); m.traverse((x) => x.geometry && x.geometry.dispose()); }
  // corpo e saia: medidas a partir do chão; aqui o tronco começa no quadril
  const geos = pecasCorpo(s);
  for (const g of geos) g.translate(0, -QUADRIL, 0);
  const corpo = malha(juntar(geos));
  const cab = malha(juntar(pecasCabeca(s)));
  cab.position.y = OMBRO_Y; cab.rotation.order = 'YXZ';
  const [[bd, ad], [be, ae], [pd, cd], [pe, ce]] = membrosDe(s);
  b.tronco.add(corpo, cab, bd, be);
  b.quadril.add(pd, pe);
  // mantém a pose de antes
  const copiar = (novos, velhos) => velhos && novos.forEach((m, i) => m.rotation.copy(velhos[i].rotation));
  copiar([bd, be, pd, pe], b.membros); copiar([ad, ae], b.antebracos); copiar([cd, ce], b.canelas);
  if (b.cabeca) cab.rotation.copy(b.cabeca.rotation);
  b.cabeca = cab; b.membros = [bd, be, pd, pe]; b.antebracos = [ad, ae]; b.canelas = [cd, ce];
  b.pecas = [corpo, cab, bd, be, pd, pe]; b.skin = s;
  return b;
}
// compatibilidade: quem ainda passa uma cor de camiseta (0xRRGGBB)
function skinDaCorHex(hex) { const i = CORES_ROUPA.indexOf(hex); return skinDeCor(i >= 0 && i < 8 ? i : 0); }

export function montarBoneco(skin = PADRAO) {
  return vestirBoneco({ grupo: new THREE.Group(), cabeca: null, membros: null }, skin);
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
  // (sem noChao/yaw = quem só quer a pose, como o editor de personagem: em pé e sem girar o grupo)
  const noChao = e.noChao ?? true, giraGrupo = e.yaw != null;
  const voando = !!e.voando, agua = !voando && !!e.naAgua && (!noChao || !!e.submerso), noAr = !voando && !agua && !noChao;
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
  if (giraGrupo) b.grupo.rotation.y = A.yawCorpo + Math.PI; // a frente do boneco é +z e a câmera olha para -z
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

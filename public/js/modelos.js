// Modelos low-poly feitos em código: bichos, personagem, árvores, decorações e itens.
import * as THREE from '../vendor/three.module.min.js';

export const matLowPoly = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();

// peça: geometria + cor + transformação -> arrays sem índice (posição, normal, cor)
export function peca(geo, cor, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], variar = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  _m.compose(new THREE.Vector3(...p), _q.setFromEuler(_e.set(...r)), new THREE.Vector3(...s));
  g.applyMatrix4(_m);
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  const cols = new Float32Array(n * 3);
  _c.set(cor);
  for (let i = 0; i < n; i += 3) {
    const k = variar ? 1 + (Math.random() - 0.5) * variar : 1;
    for (let j = 0; j < 3; j++) { cols[(i + j) * 3] = _c.r * k; cols[(i + j) * 3 + 1] = _c.g * k; cols[(i + j) * 3 + 2] = _c.b * k; }
  }
  return { pos: g.attributes.position.array, nor: g.attributes.normal.array, cor: cols };
}

export function juntar(pecas) {
  let n = 0;
  for (const p of pecas) n += p.pos.length;
  const P = new Float32Array(n), N = new Float32Array(n), C = new Float32Array(n);
  let o = 0;
  for (const p of pecas) { P.set(p.pos, o); N.set(p.nor, o); C.set(p.cor, o); o += p.pos.length; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.computeBoundingSphere();
  return g;
}

// aplica uma matriz a uma peça (para montar decorações/árvores dentro do pedaço do mapa)
export function moverPeca(pc, x, y, z, rotY = 0, esc = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(esc, esc, esc));
  const nm = new THREE.Matrix3().getNormalMatrix(m);
  const P = pc.pos.slice(), N = pc.nor.slice();
  const v = new THREE.Vector3();
  for (let i = 0; i < P.length; i += 3) {
    v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(m); P[i] = v.x; P[i + 1] = v.y; P[i + 2] = v.z;
    v.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(nm).normalize(); N[i] = v.x; N[i + 1] = v.y; N[i + 2] = v.z;
  }
  return { pos: P, nor: N, cor: pc.cor };
}

// formas base (poucas faces = leve)
const BOLA = new THREE.IcosahedronGeometry(1, 1);
const BOLA0 = new THREE.IcosahedronGeometry(1, 0);
const CIL = (seg = 6) => new THREE.CylinderGeometry(1, 1, 1, seg);
const CONE = (seg = 6) => new THREE.ConeGeometry(1, 1, seg);
const CAIXA = new THREE.BoxGeometry(1, 1, 1);
const DODECA = new THREE.DodecahedronGeometry(1, 0);

const olhos = (x, y, z, r = 0.05) => [peca(BOLA0, 0x1d1d1d, [-x, y, z], [0, 0, 0], [r, r, r]), peca(BOLA0, 0x1d1d1d, [x, y, z], [0, 0, 0], [r, r, r])];
const membro = (raio, alt, cor, x, y, z) => {
  const m = new THREE.Mesh(juntar([peca(CIL(5), cor, [0, -alt / 2, 0], [0, 0, 0], [raio, alt, raio])]), matLowPoly);
  m.position.set(x, y, z);
  return m;
};
const quatroPernas = (raio, alt, cor, dx, y, dz) => [[-dx, y, dz], [dx, y, dz], [-dx, y, -dz], [dx, y, -dz]].map(([x, yy, z]) => membro(raio, alt, cor, x, yy, z));

// ---------- bichos (frente = +z) ----------
export const ESPECIES = {
  ovelha: {
    nome: 'Ovelha', vel: 0.9, alt: 1.2, raio: 0.6, som: 'bee',
    montar(r) {
      const la = r < 0.08 ? 0xf7b2d0 : r < 0.18 ? 0x8f857c : 0xf6f3ea;
      return {
        corpo: [peca(BOLA, la, [0, 0.8, 0], [0, 0, 0], [0.5, 0.45, 0.65]), peca(BOLA, la, [0, 1.02, 0.25], [0, 0, 0], [0.35, 0.3, 0.35])],
        cabeca: [peca(BOLA, 0x4a403a, [0, 0, 0.1], [0, 0, 0], [0.2, 0.22, 0.26]), peca(BOLA, la, [0, 0.16, 0.04], [0, 0, 0], [0.2, 0.12, 0.2]),
          peca(BOLA0, 0x4a403a, [-0.22, 0.04, 0], [0, 0, 0.6], [0.12, 0.05, 0.07]), peca(BOLA0, 0x4a403a, [0.22, 0.04, 0], [0, 0, -0.6], [0.12, 0.05, 0.07]),
          ...olhos(0.1, 0.06, 0.3, 0.035)],
        cabecaPos: [0, 0.98, 0.62],
        pernas: quatroPernas(0.07, 0.5, 0x4a403a, 0.22, 0.52, 0.3),
      };
    },
  },
  porquinho: {
    nome: 'Porquinho', vel: 1.0, alt: 0.9, raio: 0.5, som: 'oinc',
    montar() {
      const rosa = 0xf4a7b4;
      return {
        corpo: [peca(BOLA, rosa, [0, 0.55, 0], [0, 0, 0], [0.42, 0.38, 0.55])],
        cabeca: [peca(BOLA, rosa, [0, 0, 0.05], [0, 0, 0], [0.28, 0.27, 0.26]), peca(CIL(8), 0xe8879a, [0, -0.03, 0.3], [Math.PI / 2, 0, 0], [0.12, 0.08, 0.1]),
          peca(CONE(4), 0xe8879a, [-0.17, 0.25, 0], [0, 0, 0.3], [0.08, 0.14, 0.05]), peca(CONE(4), 0xe8879a, [0.17, 0.25, 0], [0, 0, -0.3], [0.08, 0.14, 0.05]),
          ...olhos(0.11, 0.08, 0.24, 0.035)],
        cabecaPos: [0, 0.68, 0.55],
        pernas: quatroPernas(0.08, 0.3, 0xe8879a, 0.2, 0.3, 0.28),
      };
    },
  },
  galinha: {
    nome: 'Galinha', vel: 0.8, alt: 0.8, raio: 0.3, som: 'cocó',
    montar() {
      return {
        corpo: [peca(BOLA, 0xfafafa, [0, 0.42, 0], [0, 0, 0], [0.22, 0.22, 0.28]), peca(CONE(4), 0xeeeeee, [0, 0.52, -0.3], [-0.9, 0, 0], [0.12, 0.25, 0.08]),
          peca(BOLA0, 0xeeeeee, [-0.2, 0.44, 0], [0, 0, 0], [0.05, 0.12, 0.17]), peca(BOLA0, 0xeeeeee, [0.2, 0.44, 0], [0, 0, 0], [0.05, 0.12, 0.17])],
        cabeca: [peca(BOLA, 0xfafafa, [0, 0, 0], [0, 0, 0], [0.13, 0.14, 0.13]), peca(CONE(4), 0xf2b632, [0, -0.01, 0.15], [Math.PI / 2, 0, 0], [0.05, 0.1, 0.04]),
          peca(BOLA0, 0xe23b3b, [0, 0.15, 0], [0, 0, 0], [0.03, 0.06, 0.08]), peca(BOLA0, 0xe23b3b, [0, -0.09, 0.1], [0, 0, 0], [0.025, 0.05, 0.025]),
          ...olhos(0.08, 0.03, 0.09, 0.025)],
        cabecaPos: [0, 0.72, 0.2],
        pernas: [membro(0.025, 0.25, 0xf2b632, -0.08, 0.25, 0), membro(0.025, 0.25, 0xf2b632, 0.08, 0.25, 0)],
      };
    },
  },
  vaca: {
    nome: 'Vaca', vel: 0.8, alt: 1.5, raio: 0.7, som: 'muu',
    montar() {
      const c = 0xc28a4f;
      return {
        corpo: [peca(BOLA, c, [0, 1.05, 0], [0, 0, 0], [0.5, 0.45, 0.8]), peca(BOLA0, 0xf6efe2, [0.38, 1.12, -0.15], [0, 0, 0], [0.16, 0.25, 0.3]),
          peca(BOLA0, 0xf6efe2, [-0.4, 0.98, 0.25], [0, 0, 0], [0.12, 0.2, 0.22]), peca(BOLA, 0xf4b8c4, [0, 0.62, -0.2], [0, 0, 0], [0.13, 0.08, 0.13])],
        cabeca: [peca(BOLA, c, [0, 0, 0.08], [0, 0, 0], [0.3, 0.3, 0.32]), peca(BOLA, 0xf3d6c4, [0, -0.1, 0.35], [0, 0, 0], [0.22, 0.15, 0.12]),
          peca(CONE(5), 0xf6efe2, [-0.25, 0.26, 0], [0, 0, 0.6], [0.05, 0.18, 0.05]), peca(CONE(5), 0xf6efe2, [0.25, 0.26, 0], [0, 0, -0.6], [0.05, 0.18, 0.05]),
          ...olhos(0.15, 0.08, 0.32, 0.045)],
        cabecaPos: [0, 1.35, 0.82],
        pernas: quatroPernas(0.1, 0.72, 0x8e5a2b, 0.28, 0.75, 0.45),
      };
    },
  },
  cachorro: {
    nome: 'Caramelo', vel: 2.0, alt: 0.9, raio: 0.4, som: 'auau', segue: true,
    montar() {
      const c = 0xdc9c50;
      return {
        corpo: [peca(BOLA, c, [0, 0.55, 0], [0, 0, 0], [0.24, 0.24, 0.45]), peca(CIL(5), c, [0, 0.78, -0.48], [-0.6, 0, 0], [0.05, 0.35, 0.05]),
          peca(BOLA, 0xf3dcb8, [0, 0.5, 0.18], [0, 0, 0], [0.16, 0.16, 0.2])],
        cabeca: [peca(BOLA, c, [0, 0, 0], [0, 0, 0], [0.22, 0.21, 0.21]), peca(BOLA, 0xf3dcb8, [0, -0.07, 0.2], [0, 0, 0], [0.11, 0.09, 0.13]),
          peca(BOLA0, 0x222222, [0, -0.02, 0.32], [0, 0, 0], [0.04, 0.035, 0.03]),
          peca(BOLA0, 0x9c6127, [-0.19, 0.06, -0.02], [0, 0, 0.5], [0.06, 0.15, 0.09]), peca(BOLA0, 0x9c6127, [0.19, 0.06, -0.02], [0, 0, -0.5], [0.06, 0.15, 0.09]),
          ...olhos(0.09, 0.06, 0.18, 0.035)],
        cabecaPos: [0, 0.82, 0.48],
        pernas: quatroPernas(0.06, 0.38, 0xc4863f, 0.13, 0.38, 0.25),
      };
    },
  },
  capivara: {
    nome: 'Capivara', vel: 0.6, alt: 0.9, raio: 0.5, som: 'hmm', nada: true,
    montar() {
      const c = 0x8c6b4b;
      return {
        corpo: [peca(BOLA, c, [0, 0.55, 0], [0, 0, 0], [0.38, 0.36, 0.58])],
        cabeca: [peca(BOLA, c, [0, 0, 0.12], [0, 0, 0], [0.22, 0.24, 0.34]), peca(BOLA, 0x5e4630, [0, -0.04, 0.42], [0, 0, 0], [0.15, 0.1, 0.05]),
          peca(BOLA0, 0x5e4630, [-0.14, 0.22, -0.04], [0, 0, 0], [0.05, 0.05, 0.03]), peca(BOLA0, 0x5e4630, [0.14, 0.22, -0.04], [0, 0, 0], [0.05, 0.05, 0.03]),
          ...olhos(0.15, 0.1, 0.24, 0.03)],
        cabecaPos: [0, 0.72, 0.55],
        pernas: quatroPernas(0.08, 0.28, 0x6e5238, 0.2, 0.28, 0.32),
      };
    },
  },
  gato: {
    nome: 'Gatinho', vel: 1.2, alt: 0.6, raio: 0.3, som: 'miau', segue: true,
    montar(r) {
      const c = r < 0.33 ? 0x3b3b3b : r < 0.66 ? 0xf0a050 : 0xd8d2c8;
      return {
        corpo: [peca(BOLA, c, [0, 0.38, 0], [0, 0, 0], [0.17, 0.17, 0.32]), peca(CIL(5), c, [0, 0.62, -0.38], [-0.3, 0, 0], [0.04, 0.45, 0.04])],
        cabeca: [peca(BOLA, c, [0, 0, 0], [0, 0, 0], [0.16, 0.15, 0.15]), peca(CONE(3), c, [-0.09, 0.15, 0], [0, 0, 0.2], [0.06, 0.12, 0.05]),
          peca(CONE(3), c, [0.09, 0.15, 0], [0, 0, -0.2], [0.06, 0.12, 0.05]), peca(BOLA0, 0xf29ac2, [0, -0.03, 0.15], [0, 0, 0], [0.025, 0.02, 0.015]),
          peca(BOLA0, 0x8bc34a, [-0.06, 0.03, 0.13], [0, 0, 0], [0.03, 0.03, 0.02]), peca(BOLA0, 0x8bc34a, [0.06, 0.03, 0.13], [0, 0, 0], [0.03, 0.03, 0.02])],
        cabecaPos: [0, 0.58, 0.3],
        pernas: quatroPernas(0.04, 0.26, c, 0.09, 0.26, 0.18),
      };
    },
  },
  coelho: {
    nome: 'Coelho', vel: 1.4, alt: 0.6, raio: 0.25, som: 'pi', pula: true,
    montar(r) {
      const c = r < 0.5 ? 0xf5f1ea : 0xa98563;
      return {
        corpo: [peca(BOLA, c, [0, 0.25, 0], [0, 0, 0], [0.16, 0.16, 0.2]), peca(BOLA0, 0xffffff, [0, 0.3, -0.2], [0, 0, 0], [0.07, 0.07, 0.07])],
        cabeca: [peca(BOLA, c, [0, 0, 0.02], [0, 0, 0], [0.12, 0.12, 0.12]), peca(BOLA0, c, [-0.05, 0.18, -0.02], [0, 0, 0.15], [0.035, 0.13, 0.025]),
          peca(BOLA0, c, [0.05, 0.18, -0.02], [0, 0, -0.15], [0.035, 0.13, 0.025]), peca(BOLA0, 0xf29ac2, [0, -0.02, 0.13], [0, 0, 0], [0.02, 0.015, 0.01]),
          ...olhos(0.06, 0.03, 0.1, 0.02)],
        cabecaPos: [0, 0.42, 0.17],
        pernas: [membro(0.03, 0.12, c, -0.08, 0.12, 0.08), membro(0.03, 0.12, c, 0.08, 0.12, 0.08), membro(0.04, 0.12, c, -0.09, 0.12, -0.1), membro(0.04, 0.12, c, 0.09, 0.12, -0.1)],
      };
    },
  },
};

const geoSombra = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
const matSombra = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
export function sombra(r) {
  const s = new THREE.Mesh(geoSombra, matSombra);
  s.scale.setScalar(r);
  s.position.y = 0.04;
  return s;
}

export function montarBicho(especie, r) {
  const e = ESPECIES[especie];
  const m = e.montar(r);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(juntar(m.corpo), matLowPoly));
  const cab = new THREE.Mesh(juntar(m.cabeca), matLowPoly);
  cab.position.set(...m.cabecaPos);
  g.add(cab);
  for (const p of m.pernas) g.add(p);
  g.add(sombra(e.raio * 1.1));
  return { grupo: g, cabeca: cab, pernas: m.pernas };
}

// ---------- personagem ----------
export const CORES = [0x3f6fd9, 0xe8433f, 0x4caf50, 0xf2c72e, 0x9c5bd9, 0xf29ac2, 0xff8a3d, 0x2bb3b3];
export function montarBoneco(cor = CORES[0]) {
  const g = new THREE.Group();
  const pele = 0xf1c8a0, cabelo = 0x5a3a22, calca = 0x3a4a6a;
  const corpo = new THREE.Mesh(juntar([peca(CIL(7), cor, [0, 1.05, 0], [0, 0, 0], [0.27, 0.6, 0.2]), peca(BOLA, cor, [0, 1.33, 0], [0, 0, 0], [0.28, 0.1, 0.21])]), matLowPoly);
  const cab = new THREE.Mesh(juntar([peca(BOLA, pele, [0, 0.22, 0], [0, 0, 0], [0.24, 0.25, 0.23]), peca(BOLA, cabelo, [0, 0.33, -0.03], [0, 0, 0], [0.255, 0.17, 0.24]),
    ...olhos(0.085, 0.24, 0.205, 0.035), peca(BOLA0, 0xe58a7a, [-0.14, 0.16, 0.18], [0, 0, 0], [0.04, 0.025, 0.02]), peca(BOLA0, 0xe58a7a, [0.14, 0.16, 0.18], [0, 0, 0], [0.04, 0.025, 0.02])]), matLowPoly);
  cab.position.y = 1.36;
  g.add(corpo, cab);
  const bd = membro(0.075, 0.55, pele, -0.34, 1.32, 0), be = membro(0.075, 0.55, pele, 0.34, 1.32, 0);
  const pd = membro(0.1, 0.75, calca, -0.12, 0.75, 0), pe = membro(0.1, 0.75, calca, 0.12, 0.75, 0);
  g.add(bd, be, pd, pe, sombra(0.45));
  return { grupo: g, cabeca: cab, membros: [bd, be, pd, pe] };
}

// ---------- vegetação (peças para juntar no pedaço do mapa) ----------
export const VEG = {
  arvore: (r) => [peca(CIL(5), 0x7a5634, [0, 1.2, 0], [0, 0, 0], [0.22, 2.4, 0.22]),
    peca(BOLA0, r < 0.5 ? 0x5fae3e : 0x6cbf47, [0, 3.2, 0], [0, r * 3, 0], [1.6, 1.4, 1.6], 0.12),
    peca(BOLA0, r < 0.5 ? 0x54a038 : 0x62b440, [0.5, 2.6, 0.3], [0, r * 5, 0], [1.1, 0.95, 1.1], 0.12)],
  pinheiro: () => [peca(CIL(5), 0x6b4a2b, [0, 0.8, 0], [0, 0, 0], [0.18, 1.6, 0.18]),
    peca(CONE(7), 0x2f7d4a, [0, 2.2, 0], [0, 0, 0], [1.4, 2.0, 1.4], 0.1), peca(CONE(7), 0x37905a, [0, 3.4, 0], [0, 0.4, 0], [1.0, 1.7, 1.0], 0.1),
    peca(CONE(7), 0x3fa064, [0, 4.4, 0], [0, 0.8, 0], [0.6, 1.3, 0.6], 0.1)],
  arbusto: () => [peca(BOLA0, 0x5aa83c, [0, 0.45, 0], [0, 1, 0], [0.75, 0.55, 0.75], 0.15)],
  pedra: () => [peca(DODECA, 0x9a9ca3, [0, 0.25, 0], [0.3, 1, 0], [0.9, 0.6, 0.75], 0.12)],
  pedrona: () => [peca(DODECA, 0x8b8d94, [0, 0.6, 0], [0.5, 2, 0.2], [1.8, 1.4, 1.5], 0.12)],
  coqueiro: () => [peca(CIL(5), 0xa07a4a, [0.3, 1.8, 0], [0, 0, -0.18], [0.16, 3.6, 0.16]),
    ...[0, 1.25, 2.5, 3.75, 5].map((a) => peca(CONE(4), 0x4caf50, [0.65 + Math.sin(a) * 0.8, 3.5, Math.cos(a) * 0.8], [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2], [0.35, 1.8, 0.12]))],
  florzinhas: (r) => {
    const cores = [0xff6f91, 0xffd23f, 0x7ab8ff, 0xffffff, 0xc77dff];
    const out = [];
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + r * 6, d = 0.2 + ((i * 37) % 10) / 20;
      out.push(peca(BOLA0, cores[(i + Math.floor(r * 5)) % 5], [Math.cos(a) * d, 0.22, Math.sin(a) * d], [0, 0, 0], [0.09, 0.07, 0.09]));
    }
    return out;
  },
};

// ---------- decorações que a criança coloca ----------
export const DECORACOES = {
  cerca: { nome: 'Cerca', emoji: '🪵', raio: 0, pecas: () => [peca(CAIXA, 0xc89a5a, [-0.9, 0.5, 0], [0, 0, 0], [0.14, 1, 0.14]), peca(CAIXA, 0xc89a5a, [0.9, 0.5, 0], [0, 0, 0], [0.14, 1, 0.14]),
    peca(CAIXA, 0xd8aa6a, [0, 0.75, 0], [0, 0, 0], [2, 0.12, 0.08]), peca(CAIXA, 0xd8aa6a, [0, 0.4, 0], [0, 0, 0], [2, 0.12, 0.08])] },
  banco: { nome: 'Banquinho', emoji: '🪑', raio: 0.7, pecas: () => [peca(CAIXA, 0xb07a44, [0, 0.45, 0], [0, 0, 0], [1.6, 0.1, 0.5]), peca(CAIXA, 0xb07a44, [0, 0.85, -0.22], [0, 0, 0], [1.6, 0.35, 0.08]),
    peca(CAIXA, 0x555555, [-0.65, 0.22, 0], [0, 0, 0], [0.08, 0.45, 0.45]), peca(CAIXA, 0x555555, [0.65, 0.22, 0], [0, 0, 0], [0.08, 0.45, 0.45])] },
  lampiao: { nome: 'Lampião', emoji: '🏮', raio: 0.25, pecas: () => [peca(CIL(6), 0x444444, [0, 1.1, 0], [0, 0, 0], [0.06, 2.2, 0.06]),
    peca(BOLA, 0xffe08a, [0, 2.35, 0], [0, 0, 0], [0.22, 0.25, 0.22]), peca(CONE(6), 0x444444, [0, 2.65, 0], [0, 0, 0], [0.28, 0.2, 0.28])], brilha: true },
  vaso: { nome: 'Vaso de flores', emoji: '🌷', raio: 0.35, pecas: () => [peca(CIL(7), 0xc96a43, [0, 0.25, 0], [0, 0, 0], [0.3, 0.5, 0.3]),
    peca(BOLA0, 0xff6f91, [-0.1, 0.62, 0], [0, 0, 0], [0.12, 0.1, 0.12]), peca(BOLA0, 0xffd23f, [0.12, 0.6, 0.05], [0, 0, 0], [0.12, 0.1, 0.12]),
    peca(BOLA0, 0xc77dff, [0, 0.66, -0.12], [0, 0, 0], [0.11, 0.09, 0.11]), peca(BOLA0, 0x5aa83c, [0, 0.52, 0], [0, 0, 0], [0.25, 0.12, 0.25])] },
  casinha: { nome: 'Casinha', emoji: '🏠', raio: 2.1, pecas: () => [peca(CAIXA, 0xf3e6c8, [0, 1.2, 0], [0, 0, 0], [3.6, 2.4, 3.2]),
    peca(CONE(4), 0xd2553f, [0, 3.1, 0], [0, Math.PI / 4, 0], [3.3, 1.5, 3.0]), peca(CAIXA, 0x8a5a3b, [0, 0.75, 1.61], [0, 0, 0], [0.9, 1.5, 0.05]),
    peca(CAIXA, 0x9fd3ff, [-1.1, 1.5, 1.61], [0, 0, 0], [0.7, 0.6, 0.05]), peca(CAIXA, 0x9fd3ff, [1.1, 1.5, 1.61], [0, 0, 0], [0.7, 0.6, 0.05]),
    peca(CAIXA, 0x9a9ca3, [1.1, 3.2, -0.6], [0, 0, 0], [0.4, 1.2, 0.4])] },
  arvorezinha: { nome: 'Arvorezinha', emoji: '🌳', raio: 0.3, pecas: () => [peca(CIL(5), 0x7a5634, [0, 0.6, 0], [0, 0, 0], [0.1, 1.2, 0.1]), peca(BOLA0, 0x6cbf47, [0, 1.5, 0], [0, 0, 0], [0.7, 0.65, 0.7], 0.12)] },
  balanco: { nome: 'Balanço', emoji: '🎠', raio: 0.3, pecas: () => [peca(CAIXA, 0x7a5634, [-1, 1.2, 0], [0, 0, 0.12], [0.12, 2.5, 0.12]), peca(CAIXA, 0x7a5634, [1, 1.2, 0], [0, 0, -0.12], [0.12, 2.5, 0.12]),
    peca(CAIXA, 0x7a5634, [0, 2.4, 0], [0, 0, 0], [2.3, 0.12, 0.12]), peca(CAIXA, 0x888888, [-0.3, 1.6, 0], [0, 0, 0], [0.03, 1.6, 0.03]), peca(CAIXA, 0x888888, [0.3, 1.6, 0], [0, 0, 0], [0.03, 1.6, 0.03]),
    peca(CAIXA, 0xe8433f, [0, 0.8, 0], [0, 0, 0], [0.75, 0.07, 0.35])] },
  pedrinha: { nome: 'Caminho de pedra', emoji: '🪨', raio: 0, pecas: () => [peca(CIL(7), 0xb8b2a6, [0, 0.03, 0], [0, 0, 0], [0.5, 0.08, 0.45]), peca(CIL(6), 0xa8a296, [0.55, 0.03, 0.35], [0, 0.5, 0], [0.3, 0.08, 0.28])] },
};
const cacheDeco = new Map();
export function geoDecoracao(tipo) {
  if (!cacheDeco.has(tipo)) cacheDeco.set(tipo, juntar(DECORACOES[tipo].pecas()));
  return cacheDeco.get(tipo);
}

// ---------- itens para coletar ----------
export const ITENS = {
  flor: { nome: 'Flor', emoji: '🌸', geo: () => juntar([peca(BOLA0, 0xff6f91, [0, 0.35, 0], [0, 0, 0], [0.16, 0.1, 0.16]), peca(BOLA0, 0xffe066, [0, 0.4, 0], [0, 0, 0], [0.06, 0.05, 0.06]), peca(CIL(4), 0x4caf50, [0, 0.15, 0], [0, 0, 0], [0.02, 0.3, 0.02])]) },
  maca: { nome: 'Maçã', emoji: '🍎', geo: () => juntar([peca(BOLA, 0xe53935, [0, 0.2, 0], [0, 0, 0], [0.16, 0.15, 0.16]), peca(CIL(4), 0x6b4a2b, [0, 0.38, 0], [0, 0, 0.3], [0.015, 0.08, 0.015]), peca(BOLA0, 0x4caf50, [0.05, 0.4, 0], [0, 0, 0.6], [0.06, 0.02, 0.035])]) },
  concha: { nome: 'Concha', emoji: '🐚', geo: () => juntar([peca(CONE(6), 0xffc6b0, [0, 0.12, 0], [Math.PI / 2, 0, 0], [0.16, 0.24, 0.08])]) },
  cogumelo: { nome: 'Cogumelo', emoji: '🍄', geo: () => juntar([peca(CIL(6), 0xf5f1ea, [0, 0.12, 0], [0, 0, 0], [0.05, 0.24, 0.05]), peca(BOLA, 0xe53935, [0, 0.26, 0], [0, 0, 0], [0.16, 0.09, 0.16]), peca(BOLA0, 0xffffff, [0.07, 0.33, 0.05], [0, 0, 0], [0.03, 0.02, 0.03])]) },
  pena: { nome: 'Pena', emoji: '🪶', geo: () => juntar([peca(BOLA0, 0x7ab8ff, [0, 0.2, 0], [0, 0, 0.6], [0.05, 0.22, 0.02]), peca(CIL(3), 0xffffff, [0.07, 0.04, 0], [0, 0, 0.6], [0.01, 0.12, 0.01])]) },
  cristal: { nome: 'Cristal', emoji: '💎', geo: () => juntar([peca(new THREE.OctahedronGeometry(1, 0), 0x8fe3ff, [0, 0.3, 0], [0, 0, 0], [0.13, 0.25, 0.13])]) },
};

// ---------- etiqueta e emojis ----------
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
  s.scale.set(w / 110, 40 / 110, 1);
  s.renderOrder = 10;
  return s;
}

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

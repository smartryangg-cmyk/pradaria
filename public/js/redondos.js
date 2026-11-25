// Estilo Natural 3D: personagens, aldeões e bichos redondos, de desenho animado (no mundo de blocos continuam
// de caixinhas, em modelos.js). Cabeça esférica, corpo em cápsula ou ovo, focinho, orelhas e rabo redondos,
// olhos como discos grudados na cabeça, cabelo como calota, mãos e pés como bolinhas.
// Leve: poucos segmentos, e os bichos (que são muitos) usam geometrias guardadas e compartilhadas.
import * as THREE from '../vendor/three.module.min.js';
import { juntar, comCor, caixa, cilindro, coresDe, estrelaGeo, deitado } from './modelos.js';

// ---------- peças ----------
// detalhe de cada esfera: [lados, andares]
const SEG_BONITO = { g: [12, 8], m: [10, 7], p: [7, 5], pp: [6, 4] }, SEG_LEVE = { g: [9, 6], m: [8, 5], p: [6, 4], pp: [5, 3] };
let SEG = SEG_BONITO;
// gráfico Leve (main.js chama ao entrar no mundo): menos lados em cada bolinha
export function detalheRedondo(leve) { SEG = leve ? SEG_LEVE : SEG_BONITO; }
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _m = new THREE.Matrix4();
// rot: [x, y, z] (Euler, radianos) ou um Quaternion
function posicionar(g, x, y, z, rot) {
  if (rot) {
    if (rot.isQuaternion) _m.makeRotationFromQuaternion(rot);
    else _m.makeRotationFromEuler(_e.set(rot[0] || 0, rot[1] || 0, rot[2] || 0));
    g.applyMatrix4(_m);
  }
  g.translate(x, y, z);
  return g;
}
// elipsoide (raios rx, ry, rz)
export function ovo(rx, ry, rz, cor, x = 0, y = 0, z = 0, rot = null, q = 'm') {
  const [a, b] = SEG[q];
  const g = new THREE.SphereGeometry(1, a, b);
  g.scale(rx, ry, rz);
  return comCor(posicionar(g, x, y, z, rot), cor);
}
// calota (topo de esfera até o ângulo th a partir de cima), inclinada para trás (incl) — cabelo e gorro
function calota(rx, ry, rz, th, cor, x, y, z, incl = 0, q = 'g') {
  const [a, b] = SEG[q];
  const g = new THREE.SphereGeometry(1, a + 2, b, 0, Math.PI * 2, 0, th);
  g.scale(rx, ry, rz);
  return comCor(posicionar(g, x, y, z, [-incl, 0, 0]), cor);
}
// cápsula de raio r e comprimento total h (de ponta a ponta), em pé
export function capsula(r, h, cor, x = 0, y = 0, z = 0, rot = null, lados = 8) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, h - 2 * r), 3, lados);
  return comCor(posicionar(g, x, y, z, rot), cor);
}
// cone (orelha pontuda, bico, chifre); a ponta aponta para +y antes de girar
function cone(r, h, cor, x = 0, y = 0, z = 0, rot = null, lados = 7) {
  const g = new THREE.ConeGeometry(r, h, lados);
  return comCor(posicionar(g, x, y, z, rot), cor);
}
// arco (sorriso, olho fechado, rabinho de porco): pedaço de anel, aberto para cima (sorriso) se rot = 0
function arco(R, tubo, ang, cor, x = 0, y = 0, z = 0, rot = null) {
  const g = new THREE.TorusGeometry(R, tubo, 4, 8, ang);
  g.rotateZ(Math.PI + (Math.PI - ang) / 2); // o meio do arco fica embaixo
  return comCor(posicionar(g, x, y, z, rot), cor);
}

// ---------- coisas grudadas na superfície de uma elipsoide (olhos, boca, nariz, manchas) ----------
// E = [cx, cy, cz, rx, ry, rz]; (u, v) = x, y do ponto (na frente, +z) ou lado = 'x' (u = z, v = y, no lado +x/-x conforme o sinal de sx)
function pontoNa(E, u, v, lado = 'z', sx = 1) {
  const [cx, cy, cz, rx, ry, rz] = E;
  let px, py, pz, nx, ny, nz;
  if (lado === 'z') {
    const a = (u - cx) / rx, b = (v - cy) / ry, t = Math.sqrt(Math.max(0.03, 1 - a * a - b * b));
    px = u; py = v; pz = cz + rz * t;
    nx = (px - cx) / (rx * rx); ny = (py - cy) / (ry * ry); nz = (pz - cz) / (rz * rz);
  } else {
    const a = (u - cz) / rz, b = (v - cy) / ry, t = Math.sqrt(Math.max(0.03, 1 - a * a - b * b));
    pz = u; py = v; px = cx + sx * rx * t;
    nx = (px - cx) / (rx * rx); ny = (py - cy) / (ry * ry); nz = (pz - cz) / (rz * rz);
  }
  const l = Math.hypot(nx, ny, nz);
  return [px, py, pz, nx / l, ny / l, nz / l];
}
// gruda a geometria g (feita virada para +z, centrada na origem) no ponto, afastada "fora" da superfície;
// giro = giro em volta da normal (inclinar sobrancelha, boca de lado)
function grudar(g, P, fora = 0, giro = 0) {
  if (giro) g.rotateZ(giro);
  _v.set(P[3], P[4], P[5]);
  _q.setFromUnitVectors(_z, _v);
  return posicionar(g, P[0] + P[3] * fora, P[1] + P[4] * fora, P[2] + P[5] * fora, _q);
}
// disco (elipsoide achatada) de raios a, b
const disco = (a, b, esp, cor, q = 'p') => ovo(a, b, esp, cor, 0, 0, 0, null, q);
// mancha de desenho: um pedaço chato da própria pele (elipsoide E), de contorno irregular, colado na superfície.
// Sem espessura e com a normal da pele: recebe a mesma luz e não ganha contorno escuro (não parece botão).
// (u, v) = centro, a/b = raios no plano do lado, sem = semente do contorno (cada mancha sai diferente)
function mancha(E, u, v, a, b, cor, lado = 'z', sx = 1, sem = 0) {
  const K = 14, pos = [], nor = [], idx = [];
  const ponto = (du, dv) => {
    const P = pontoNa(E, u + du, v + dv, lado, sx), f = 0.005; // um fio para fora da pele (os gomos ficam por dentro)
    pos.push(P[0] + P[3] * f, P[1] + P[4] * f, P[2] + P[5] * f); nor.push(P[3], P[4], P[5]);
  };
  ponto(0, 0);
  for (const anel of [0.55, 1]) for (let i = 0; i < K; i++) {
    const t = (i / K) * Math.PI * 2;
    const r = anel * (1 + 0.22 * Math.sin(2 * t + sem * 1.7) + 0.14 * Math.sin(3 * t + sem * 2.9) + 0.07 * Math.cos(5 * t + sem));
    ponto(Math.cos(t) * a * r, Math.sin(t) * b * r);
  }
  for (let i = 0; i < K; i++) {
    const j = (i + 1) % K;
    idx.push(0, 1 + i, 1 + j, 1 + i, 1 + K + i, 1 + K + j, 1 + i, 1 + K + j, 1 + j);
  }
  // vira os triângulos para fora (a frente de cada um olha para onde a pele olha)
  for (let k = 0; k < idx.length; k += 3) {
    const [i0, i1, i2] = [idx[k] * 3, idx[k + 1] * 3, idx[k + 2] * 3];
    const ax = pos[i1] - pos[i0], ay = pos[i1 + 1] - pos[i0 + 1], az = pos[i1 + 2] - pos[i0 + 2];
    const bx = pos[i2] - pos[i0], by = pos[i2 + 1] - pos[i0 + 1], bz = pos[i2 + 2] - pos[i0 + 2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    if (cx * nor[i0] + cy * nor[i0 + 1] + cz * nor[i0 + 2] < 0) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return comCor(g, cor);
}

// olho de bicho: bolinha preta brilhante com um pontinho de luz
function olhoBicho(E, u, v, r, cor = 0x1c1a1e, lado = 'z', sx = 1) {
  const P = pontoNa(E, u, v, lado, sx);
  const g = [grudar(ovo(r, r * 1.12, r * 0.6, cor, 0, 0, 0, null, 'p'), P, r * 0.1)];
  // brilho para cima e para fora
  g.push(grudar(ovo(r * 0.32, r * 0.32, r * 0.2, 0xffffff, r * 0.35 * Math.sign(u - E[0] || 1), r * 0.4, 0, null, 'pp'), P, r * 0.55));
  return g;
}
// olho com íris (aldeão, lobo, onça)
function olhoIris(E, u, v, r, iris, lado = 'z', sx = 1) {
  const P = pontoNa(E, u, v, lado, sx);
  return [grudar(disco(r, r * 1.1, r * 0.35, 0xffffff), P, 0.004), grudar(disco(r * 0.62, r * 0.75, r * 0.3, iris), P, 0.012),
    grudar(disco(r * 0.3, r * 0.36, r * 0.25, 0x141414, 'pp'), P, 0.02), grudar(ovo(r * 0.2, r * 0.2, r * 0.12, 0xffffff, r * 0.22, r * 0.3, 0, null, 'pp'), P, 0.026)];
}

// ---------- bichos ----------
// Cada espécie devolve { corpo: [geos], cabeca: [geos], cabecaPos, pernas: [[raio, comprimento, cor, corPata, posições]] }.
// Mesmo pivô de cabeça e de pernas do modelo de caixinhas (a animação e o chão continuam iguais).
const ESCURO = 0x1c1a1e, NARIZ = 0x2a2226;
const REDONDOS = {
  ovelha(r) {
    const la = r < 0.08 ? 0xf6a6c8 : r < 0.18 ? 0x9a8f86 : 0xf4f2ea, cara = 0x3d3530;
    const corpo = [ovo(0.46, 0.38, 0.62, la, 0, 0.84, 0, null, 'g')];
    // lã em bolinhas por cima
    for (const [x, y, z, s] of [[-0.24, 1.02, 0.3, 0.24], [0.24, 1.02, 0.3, 0.24], [0, 1.12, 0.05, 0.27], [-0.26, 1.0, -0.25, 0.25], [0.26, 1.0, -0.25, 0.25], [0, 1.08, -0.42, 0.22], [-0.38, 0.84, 0.05, 0.2], [0.38, 0.84, 0.05, 0.2]])
      corpo.push(ovo(s, s * 0.9, s, la, x, y, z, null, 'p'));
    corpo.push(ovo(0.1, 0.1, 0.1, la, 0, 0.9, -0.64, null, 'p')); // rabinho
    const E = [0, -0.02, 0.14, 0.17, 0.2, 0.19];
    const cab = [ovo(E[3], E[4], E[5], cara, E[0], E[1], E[2]),
      ovo(0.2, 0.13, 0.17, la, 0, 0.16, 0.08, null, 'p'), ovo(0.09, 0.09, 0.09, la, -0.1, 0.2, 0.18, null, 'pp'), ovo(0.09, 0.09, 0.09, la, 0.1, 0.2, 0.18, null, 'pp'),
      ovo(0.13, 0.05, 0.07, cara, -0.2, 0.06, 0.06, [0, 0.3, -0.5], 'p'), ovo(0.13, 0.05, 0.07, cara, 0.2, 0.06, 0.06, [0, -0.3, 0.5], 'p'),
      ...olhoBicho(E, -0.075, 0.04, 0.042, 0xf2efe8), ...olhoBicho(E, 0.075, 0.04, 0.042, 0xf2efe8),
      grudar(disco(0.045, 0.025, 0.015, 0x1a1416), pontoNa(E, 0, -0.12), 0.004)];
    return { corpo, cabeca: cab, cabecaPos: [0, 1.1, 0.62], pernas: [[0.075, 0.5, cara, 0x2a2420, [[-0.24, 0.5, 0.36], [0.24, 0.5, 0.36], [-0.24, 0.5, -0.36], [0.24, 0.5, -0.36]]]] };
  },
  porquinho() {
    const rosa = 0xf4a9b5, escuro = 0xe0798a;
    const corpo = [ovo(0.4, 0.35, 0.56, rosa, 0, 0.62, 0, null, 'g'), arco(0.06, 0.02, Math.PI * 1.6, escuro, 0, 0.78, -0.57, [0, Math.PI / 2, 0])];
    const E = [0, 0, 0.1, 0.28, 0.26, 0.25];
    const fp = pontoNa(E, 0, -0.04);
    const cab = [ovo(E[3], E[4], E[5], rosa, E[0], E[1], E[2], null, 'g'),
      grudar(cilindroFrente(0.11, 0.08, escuro), fp, 0.02), grudar(disco(0.022, 0.032, 0.01, 0x8a3a48, 'pp'), fp, 0.065, 0).translate(-0.04, 0, 0), grudar(disco(0.022, 0.032, 0.01, 0x8a3a48, 'pp'), fp, 0.065, 0).translate(0.04, 0, 0),
      cone(0.09, 0.16, escuro, -0.17, 0.25, 0.08, [0.5, 0, 0.45], 4), cone(0.09, 0.16, escuro, 0.17, 0.25, 0.08, [0.5, 0, -0.45], 4),
      ...olhoBicho(E, -0.12, 0.1, 0.04), ...olhoBicho(E, 0.12, 0.1, 0.04),
      grudar(disco(0.045, 0.028, 0.012, 0xf58a9e), pontoNa(E, -0.18, -0.04), 0.002), grudar(disco(0.045, 0.028, 0.012, 0xf58a9e), pontoNa(E, 0.18, -0.04), 0.002)];
    return { corpo, cabeca: cab, cabecaPos: [0, 0.75, 0.58], pernas: [[0.095, 0.35, rosa, escuro, [[-0.21, 0.35, 0.3], [0.21, 0.35, 0.3], [-0.21, 0.35, -0.3], [0.21, 0.35, -0.3]]]] };
  },
  galinha(r, filhote) {
    if (filhote) {
      const am = 0xffe066, E = [0, 0, 0.02, 0.15, 0.15, 0.15];
      return {
        corpo: [ovo(0.22, 0.21, 0.25, am, 0, 0.4, 0, null, 'g'), ovo(0.05, 0.1, 0.13, 0xf5d24a, -0.21, 0.42, -0.02, [0.2, 0, 0.3], 'p'), ovo(0.05, 0.1, 0.13, 0xf5d24a, 0.21, 0.42, -0.02, [0.2, 0, -0.3], 'p')],
        cabeca: [ovo(E[3], E[4], E[5], am, E[0], E[1], E[2]), cone(0.045, 0.1, 0xf29a32, 0, -0.03, 0.2, [Math.PI / 2, 0, 0], 6),
          ...olhoBicho(E, -0.07, 0.04, 0.03), ...olhoBicho(E, 0.07, 0.04, 0.03), ovo(0.04, 0.05, 0.04, am, 0, 0.16, 0, null, 'pp')],
        cabecaPos: [0, 0.72, 0.2],
        pernas: [[0.025, 0.24, 0xf29a32, 0xf29a32, [[-0.08, 0.24, 0], [0.08, 0.24, 0]]]],
      };
    }
    const b = 0xfafafa, crista = 0xe23b3b, E = [0, 0, 0, 0.15, 0.17, 0.15];
    return {
      corpo: [ovo(0.24, 0.25, 0.31, b, 0, 0.52, 0, null, 'g'), ovo(0.07, 0.17, 0.11, 0xeeeeee, 0, 0.72, -0.27, [-0.5, 0, 0], 'p'),
        ovo(0.05, 0.14, 0.2, 0xeeeeee, -0.23, 0.53, -0.02, [0.15, 0, 0.12], 'p'), ovo(0.05, 0.14, 0.2, 0xeeeeee, 0.23, 0.53, -0.02, [0.15, 0, -0.12], 'p')],
      cabeca: [ovo(E[3], E[4], E[5], b, E[0], E[1], E[2]), cone(0.055, 0.12, 0xf2b632, 0, -0.02, 0.19, [Math.PI / 2, 0, 0], 6),
        ovo(0.035, 0.06, 0.035, crista, 0, -0.12, 0.12, null, 'pp'),
        ovo(0.045, 0.05, 0.045, crista, 0, 0.18, 0.05, null, 'pp'), ovo(0.05, 0.06, 0.05, crista, 0, 0.2, -0.02, null, 'pp'), ovo(0.04, 0.045, 0.04, crista, 0, 0.17, -0.08, null, 'pp'),
        ...olhoBicho(E, -0.075, 0.05, 0.03), ...olhoBicho(E, 0.075, 0.05, 0.03)],
      cabecaPos: [0, 0.85, 0.25],
      pernas: [[0.025, 0.3, 0xf2b632, 0xf2b632, [[-0.09, 0.3, 0], [0.09, 0.3, 0]]]],
    };
  },
  vaca() {
    const c = 0xb5763a, branco = 0xf3ece0, E = [0, 0.02, 0.1, 0.27, 0.27, 0.25];
    const C = [0, 1.05, 0, 0.5, 0.42, 0.74];
    const corpo = [ovo(C[3], C[4], C[5], c, C[0], C[1], C[2], null, 'g'), ovo(0.17, 0.09, 0.15, 0xf2b5c0, 0, 0.66, -0.25, null, 'p')];
    // manchas brancas chatas, de contorno irregular, coladas na pele (as de um lado não repetem as do outro)
    for (const [u, v, a, b, sx, sem] of [[-0.3, 1.1, 0.24, 0.18, 1, 1], [0.32, 1.0, 0.15, 0.13, 1, 2], [0.05, 0.86, 0.1, 0.07, 1, 3],
      [0.22, 1.08, 0.22, 0.17, -1, 4], [-0.24, 0.92, 0.17, 0.14, -1, 5], [-0.48, 1.12, 0.09, 0.08, -1, 6]])
      corpo.push(mancha(C, u, v, a, b, branco, 'x', sx, sem));
    corpo.push(capsula(0.035, 0.42, c, 0, 1.0, -0.76, [0.35, 0, 0]), ovo(0.06, 0.08, 0.06, 0x3a2a1a, 0, 0.8, -0.83, null, 'pp'));
    const fp = pontoNa(E, 0, -0.1);
    const cab = [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2], null, 'g'), grudar(ovo(0.2, 0.13, 0.12, 0xf3d6c4), fp, -0.04),
      grudar(disco(0.025, 0.035, 0.012, 0x7a4a3a, 'pp'), fp, 0.08).translate(-0.07, 0, 0), grudar(disco(0.025, 0.035, 0.012, 0x7a4a3a, 'pp'), fp, 0.08).translate(0.07, 0, 0),
      cone(0.04, 0.16, branco, -0.17, 0.26, 0.04, [0, 0, 0.6], 6), cone(0.04, 0.16, branco, 0.17, 0.26, 0.04, [0, 0, -0.6], 6),
      ovo(0.14, 0.05, 0.08, c, -0.3, 0.1, 0.02, [0, 0.2, -0.35], 'p'), ovo(0.14, 0.05, 0.08, c, 0.3, 0.1, 0.02, [0, -0.2, 0.35], 'p'),
      mancha(E, -0.12, 0.11, 0.085, 0.075, branco, 'z', 1, 7),
      ...olhoBicho(E, -0.12, 0.07, 0.045), ...olhoBicho(E, 0.12, 0.07, 0.045)];
    return { corpo, cabeca: cab, cabecaPos: [0, 1.4, 0.78], pernas: [[0.1, 0.65, 0x8e5a2b, 0x3a2a1a, [[-0.28, 0.65, 0.46], [0.28, 0.65, 0.46], [-0.28, 0.65, -0.46], [0.28, 0.65, -0.46]]]] };
  },
  cachorro() {
    const c = 0xd99a4e, claro = 0xf3d8b0, orelha = 0x9c6127, E = [0, 0, 0.05, 0.21, 0.2, 0.19];
    const corpo = [ovo(0.22, 0.22, 0.44, c, 0, 0.56, 0, null, 'g'), ovo(0.15, 0.12, 0.3, claro, 0, 0.46, 0.04, null, 'p'),
      capsula(0.055, 0.34, c, 0, 0.78, -0.5, [-0.7, 0, 0])];
    const fp = pontoNa(E, 0, -0.06);
    const cab = [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2], null, 'g'), grudar(ovo(0.12, 0.1, 0.13, claro), fp, -0.02),
      grudar(ovo(0.05, 0.04, 0.04, NARIZ, 0, 0, 0, null, 'pp'), fp, 0.1).translate(0, 0.03, 0),
      ovo(0.06, 0.14, 0.09, orelha, -0.2, 0.05, -0.02, [0, 0, -0.35], 'p'), ovo(0.06, 0.14, 0.09, orelha, 0.2, 0.05, -0.02, [0, 0, 0.35], 'p'),
      ...olhoBicho(E, -0.08, 0.07, 0.038), ...olhoBicho(E, 0.08, 0.07, 0.038),
      grudar(ovo(0.035, 0.05, 0.015, 0xe86a7a, 0, 0, 0, null, 'pp'), pontoNa(E, 0, -0.16), 0.03)];
    return { corpo, cabeca: cab, cabecaPos: [0, 0.82, 0.5], pernas: [[0.065, 0.35, 0xc4863f, claro, [[-0.12, 0.35, 0.26], [0.12, 0.35, 0.26], [-0.12, 0.35, -0.26], [0.12, 0.35, -0.26]]]] };
  },
  capivara() {
    const c = 0x8a6a4a, escuro = 0x5e4630, E = [0, 0, 0.15, 0.22, 0.22, 0.3];
    const cab = [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2], null, 'g'), ovo(0.17, 0.14, 0.12, escuro, 0, -0.04, 0.38, null, 'p'),
      ovo(0.025, 0.02, 0.01, 0x1a120c, -0.05, 0.0, 0.5, null, 'pp'), ovo(0.025, 0.02, 0.01, 0x1a120c, 0.05, 0.0, 0.5, null, 'pp'),
      ovo(0.06, 0.06, 0.04, escuro, -0.15, 0.22, -0.02, null, 'pp'), ovo(0.06, 0.06, 0.04, escuro, 0.15, 0.22, -0.02, null, 'pp'),
      ...olhoBicho(E, -0.14, 0.09, 0.035), ...olhoBicho(E, 0.14, 0.09, 0.035)];
    return { corpo: [ovo(0.38, 0.33, 0.58, c, 0, 0.62, 0, null, 'g')], cabeca: cab, cabecaPos: [0, 0.8, 0.58], pernas: [[0.085, 0.3, 0x6e5238, escuro, [[-0.21, 0.3, 0.33], [0.21, 0.3, 0.33], [-0.21, 0.3, -0.33], [0.21, 0.3, -0.33]]]] };
  },
  coelho(r) {
    const c = r < 0.5 ? 0xf5f1ea : 0xa98563, rosa = 0xf29ac2, E = [0, 0, 0.04, 0.14, 0.13, 0.13];
    const cab = [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2]),
      capsula(0.04, 0.24, c, -0.06, 0.22, -0.01, [0, 0, 0.18], 6), capsula(0.04, 0.24, c, 0.06, 0.22, -0.01, [0, 0, -0.18], 6),
      ovo(0.022, 0.08, 0.012, rosa, -0.064, 0.22, 0.03, [0, 0, 0.18], 'pp'), ovo(0.022, 0.08, 0.012, rosa, 0.064, 0.22, 0.03, [0, 0, -0.18], 'pp'),
      grudar(ovo(0.022, 0.016, 0.012, rosa, 0, 0, 0, null, 'pp'), pontoNa(E, 0, -0.02), 0.005),
      ...olhoBicho(E, -0.06, 0.03, 0.026), ...olhoBicho(E, 0.06, 0.03, 0.026)];
    return { corpo: [ovo(0.17, 0.17, 0.22, c, 0, 0.28, 0), ovo(0.07, 0.07, 0.07, 0xffffff, 0, 0.32, -0.22, null, 'p')], cabeca: cab, cabecaPos: [0, 0.46, 0.2], pernas: [[0.045, 0.14, c, c, [[-0.09, 0.14, 0.1], [0.09, 0.14, 0.1], [-0.09, 0.14, -0.1], [0.09, 0.14, -0.1]]]] };
  },
  veado(r) {
    const c = 0xa8743f, claro = 0xf0e2c8, chifre = 0x7a5a3a, E = [0, 0, 0.1, 0.15, 0.15, 0.21];
    const corpo = [ovo(0.26, 0.27, 0.52, c, 0, 0.98, 0, null, 'g'), ovo(0.19, 0.12, 0.36, claro, 0, 0.82, 0, null, 'p'), ovo(0.08, 0.08, 0.06, 0xffffff, 0, 1.1, -0.52, null, 'p'),
      capsula(0.11, 0.48, c, 0, 1.25, 0.42, [0.35, 0, 0])];
    const cab = [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2]), ovo(0.08, 0.06, 0.06, NARIZ, 0, -0.03, 0.3, null, 'pp'),
      ovo(0.11, 0.04, 0.06, c, -0.16, 0.12, 0, [0, 0.2, -0.5], 'p'), ovo(0.11, 0.04, 0.06, c, 0.16, 0.12, 0, [0, -0.2, 0.5], 'p'),
      ...olhoBicho(E, -0.09, 0.05, 0.034), ...olhoBicho(E, 0.09, 0.05, 0.034)];
    if (r < 0.5) for (const s of [-1, 1]) cab.push(capsula(0.025, 0.3, chifre, s * 0.08, 0.26, -0.01, [0, 0, -s * 0.35], 5), capsula(0.022, 0.16, chifre, s * 0.17, 0.36, -0.01, [0, 0, -s * 1.1], 5), capsula(0.02, 0.12, chifre, s * 0.12, 0.38, 0.03, [0.5, 0, -s * 0.1], 5));
    return { corpo, cabeca: cab, cabecaPos: [0, 1.55, 0.55], pernas: [[0.05, 0.75, 0x8a5a2e, 0x3a2a1a, [[-0.15, 0.75, 0.36], [0.15, 0.75, 0.36], [-0.15, 0.75, -0.36], [0.15, 0.75, -0.36]]]] };
  },
  lobo(r) {
    const c = r < 0.7 ? 0x8d939b : 0x6b6560, claro = 0xd9d6d0, E = [0, 0, 0.05, 0.2, 0.19, 0.18];
    const corpo = [ovo(0.24, 0.25, 0.5, c, 0, 0.74, 0, null, 'g'), ovo(0.21, 0.2, 0.18, claro, 0, 0.68, 0.32, null, 'p'),
      ovo(0.1, 0.1, 0.28, c, 0, 0.74, -0.62, [0.5, 0, 0], 'p'), ovo(0.08, 0.08, 0.1, claro, 0, 0.62, -0.84, [0.5, 0, 0], 'pp')];
    const fp = pontoNa(E, 0, -0.07);
    const cab = [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2], null, 'g'), grudar(ovo(0.1, 0.085, 0.15, claro), fp, -0.04),
      grudar(ovo(0.045, 0.035, 0.035, NARIZ, 0, 0, 0, null, 'pp'), fp, 0.1).translate(0, 0.03, 0),
      cone(0.075, 0.17, c, -0.12, 0.23, -0.02, [-0.15, 0, 0.3], 5), cone(0.075, 0.17, c, 0.12, 0.23, -0.02, [-0.15, 0, -0.3], 5),
      ...olhoIris(E, -0.08, 0.06, 0.04, 0xf2c94c), ...olhoIris(E, 0.08, 0.06, 0.04, 0xf2c94c)];
    return { corpo, cabeca: cab, cabecaPos: [0, 0.98, 0.62], pernas: [[0.06, 0.5, c, claro, [[-0.12, 0.5, 0.3], [0.12, 0.5, 0.3], [-0.12, 0.5, -0.3], [0.12, 0.5, -0.3]]]] };
  },
  raposa() {
    const c = 0xe07a2e, claro = 0xfaf0e0, pe = 0x2e2420, E = [0, 0, 0.02, 0.16, 0.14, 0.14];
    const corpo = [ovo(0.17, 0.17, 0.36, c, 0, 0.46, 0, null, 'g'), ovo(0.12, 0.08, 0.22, claro, 0, 0.36, 0.1, null, 'p'),
      ovo(0.12, 0.12, 0.27, c, 0, 0.52, -0.5, [0.45, 0, 0], 'p'), ovo(0.09, 0.09, 0.1, claro, 0, 0.42, -0.72, [0.45, 0, 0], 'pp')];
    const fp = pontoNa(E, 0, -0.05);
    const cab = [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2], null, 'g'), grudar(ovo(0.075, 0.06, 0.12, claro), fp, -0.03),
      grudar(ovo(0.032, 0.026, 0.026, NARIZ, 0, 0, 0, null, 'pp'), fp, 0.085).translate(0, 0.02, 0),
      cone(0.06, 0.15, c, -0.09, 0.18, -0.01, [-0.1, 0, 0.3], 5), cone(0.06, 0.15, c, 0.09, 0.18, -0.01, [-0.1, 0, -0.3], 5),
      cone(0.025, 0.06, pe, -0.115, 0.25, -0.02, [-0.1, 0, 0.3], 5), cone(0.025, 0.06, pe, 0.115, 0.25, -0.02, [-0.1, 0, -0.3], 5),
      ...olhoBicho(E, -0.065, 0.035, 0.03), ...olhoBicho(E, 0.065, 0.035, 0.03)];
    return { corpo, cabeca: cab, cabecaPos: [0, 0.66, 0.42], pernas: [[0.042, 0.3, pe, pe, [[-0.09, 0.3, 0.2], [0.09, 0.3, 0.2], [-0.09, 0.3, -0.2], [0.09, 0.3, -0.2]]]] };
  },
  urso(r) {
    const c = r < 0.75 ? 0x6b4a2f : 0x2f2a28, focinho = 0xc9a27a, E = [0, 0, 0.05, 0.31, 0.29, 0.26];
    const fp = pontoNa(E, 0, -0.09);
    const cab = [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2], null, 'g'), grudar(ovo(0.16, 0.12, 0.12, focinho), fp, -0.03),
      grudar(ovo(0.06, 0.045, 0.04, NARIZ, 0, 0, 0, null, 'pp'), fp, 0.08).translate(0, 0.03, 0),
      ovo(0.1, 0.1, 0.06, c, -0.24, 0.24, -0.02, null, 'p'), ovo(0.1, 0.1, 0.06, c, 0.24, 0.24, -0.02, null, 'p'),
      ovo(0.055, 0.055, 0.04, focinho, -0.24, 0.24, 0.02, null, 'pp'), ovo(0.055, 0.055, 0.04, focinho, 0.24, 0.24, 0.02, null, 'pp'),
      ...olhoBicho(E, -0.11, 0.07, 0.04), ...olhoBicho(E, 0.11, 0.07, 0.04)];
    return { corpo: [ovo(0.55, 0.5, 0.76, c, 0, 1.05, 0, null, 'g'), ovo(0.08, 0.08, 0.08, c, 0, 1.12, -0.76, null, 'pp')], cabeca: cab, cabecaPos: [0, 1.25, 0.88], pernas: [[0.15, 0.6, c, c, [[-0.3, 0.6, 0.46], [0.3, 0.6, 0.46], [-0.3, 0.6, -0.46], [0.3, 0.6, -0.46]]]] };
  },
  onca(r) {
    const preta = r < 0.12;
    const c = preta ? 0x2c2a2e : 0xe2a948, m = preta ? 0x1a181c : 0x3a2a1a, claro = preta ? 0x3a383c : 0xf6e6c4, E = [0, 0, 0.05, 0.23, 0.2, 0.2];
    const C = [0, 0.76, 0, 0.29, 0.26, 0.58];
    const corpo = [ovo(C[3], C[4], C[5], c, C[0], C[1], C[2], null, 'g'), ovo(0.21, 0.1, 0.44, claro, 0, 0.6, 0, null, 'p')];
    for (const [u, v, lado, sx] of [[0.3, 0.84, 'x', 1], [0.05, 0.76, 'x', 1], [-0.25, 0.86, 'x', 1], [-0.42, 0.74, 'x', 1], [0.25, 0.78, 'x', -1], [-0.05, 0.88, 'x', -1], [-0.33, 0.74, 'x', -1], [0.38, 0.9, 'x', -1]])
      corpo.push(grudar(disco(0.05, 0.045, 0.02, m), pontoNa(C, u, v, lado, sx), -0.005));
    for (const [u, v] of [[-0.12, 0.15], [0.12, -0.1], [0, -0.35], [-0.1, 0.4]]) corpo.push(ovo(0.05, 0.02, 0.05, m, u, 1.015 - Math.abs(v) * 0.08, v, null, 'pp'));
    corpo.push(capsula(0.055, 0.7, c, 0, 0.66, -0.82, [-1.0, 0, 0]), ovo(0.065, 0.065, 0.08, m, 0, 0.47, -1.08, null, 'pp'));
    const fp = pontoNa(E, 0, -0.08);
    const cab = [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2], null, 'g'), grudar(ovo(0.12, 0.09, 0.1, claro), fp, -0.03),
      grudar(ovo(0.04, 0.03, 0.03, 0x5a3a2a, 0, 0, 0, null, 'pp'), fp, 0.07).translate(0, 0.02, 0),
      ovo(0.07, 0.07, 0.04, c, -0.16, 0.18, -0.02, null, 'p'), ovo(0.07, 0.07, 0.04, c, 0.16, 0.18, -0.02, null, 'p'),
      ...olhoIris(E, -0.085, 0.05, 0.04, 0xc8e06a), ...olhoIris(E, 0.085, 0.05, 0.04, 0xc8e06a)];
    return { corpo, cabeca: cab, cabecaPos: [0, 0.95, 0.66], pernas: [[0.075, 0.5, c, claro, [[-0.16, 0.5, 0.36], [0.16, 0.5, 0.36], [-0.16, 0.5, -0.36], [0.16, 0.5, -0.36]]]] };
  },
  cobra(r) {
    const c = r < 0.5 ? 0x5d9a3a : 0x9a7a4a, f = r < 0.5 ? 0x3e6e26 : 0x6a4e2e, E = [0, 0, 0.06, 0.11, 0.075, 0.14];
    const seg = [];
    for (let i = 0; i < 8; i++) { const s = 0.1 - i * 0.008; seg.push(ovo(s, s * 0.8, s * 1.2, i % 2 ? f : c, Math.sin(i * 1.0) * 0.12, s * 0.8, -0.05 - i * 0.15, null, 'p')); }
    return {
      corpo: seg,
      cabeca: [ovo(E[3], E[4], E[5], c, E[0], E[1], E[2]), ...olhoBicho(E, -0.06, 0.035, 0.022), ...olhoBicho(E, 0.06, 0.035, 0.022),
        capsula(0.008, 0.12, 0xd23b4a, 0, -0.02, 0.24, [Math.PI / 2, 0, 0], 4)],
      cabecaPos: [0, 0.1, 0.1],
      pernas: [],
    };
  },
};
// focinho de porco: cilindro curto virado para a frente
function cilindroFrente(r, h, cor) { const g = new THREE.CylinderGeometry(r, r, h, 10); g.rotateX(Math.PI / 2); return comCor(g, cor); }

export const temRedondo = (especie) => !!REDONDOS[especie];

// geometrias de cada bicho (espécie + variante) feitas uma vez e usadas por todos os iguais
const guardadas = new Map();
const semDescartar = (g) => { g.dispose = () => {}; return g; }; // compartilhada: quem remove um bicho não apaga a dos outros
export function geometriasBicho(especie, r, filhote) {
  // a variante sai das cores: monta (barato) e compara pela soma das cores e posições
  const m = REDONDOS[especie](r, filhote);
  const chave = especie + (filhote ? 'f' : '') + (SEG === SEG_LEVE ? 'L' : '') + assinatura(m);
  let g = guardadas.get(chave);
  if (!g) {
    g = {
      corpo: semDescartar(juntar(m.corpo)), cabeca: semDescartar(juntar(m.cabeca)), cabecaPos: m.cabecaPos,
      pernas: m.pernas.map(([raio, h, cor, corPata, pos]) => [semDescartar(pata(raio, h, cor, corPata)), pos]),
    };
    guardadas.set(chave, g);
  } else for (const geo of [...m.corpo, ...m.cabeca]) geo.dispose();
  return g;
}
function assinatura(m) {
  let s = 0;
  for (const geo of [...m.corpo, ...m.cabeca]) { const c = geo.attributes.color.array, p = geo.attributes.position.array; s = (s * 31 + c[0] * 977 + c[1] * 131 + c[2] * 17 + p[0] * 7 + p[1] * 3 + p[2] + c.length) % 1e9; }
  return ':' + m.corpo.length + ':' + m.cabeca.length + ':' + Math.round(s * 1000);
}
// perna de bicho: cápsula pendurada no pivô e uma patinha redonda no chão
function pata(raio, h, cor, corPata) {
  const rp = raio * 1.3;
  return juntar([capsula(raio, h - rp * 0.6, cor, 0, -(h - rp * 0.6) / 2, 0, null, 7), ovo(rp, rp * 0.8, rp * 1.2, corPata, 0, -h + rp * 0.8, raio * 0.25, null, 'p')]);
}

// ---------- boneco do jogador ----------
// cabeça: elipsoide de centro (0, 0.24, 0); a cara fica em +z
const EC = [0, 0.24, 0, 0.265, 0.26, 0.25];
const BOCA = 0xc0605a, PRETO = 0x222222, BRANCO = 0xffffff, ROSA = 0xf29a9a, PALHA = 0xe8c66a, OURO = 0xf5c542, LENTE = 0x9fd6f0;
const naCara = (u, v) => pontoNa(EC, u, v);

export function pecasCabecaRedonda(s) {
  const C = coresDe(s), pele = C.pele, ch = C.cab, io = C.olho, hat = C.hat;
  const g = [ovo(EC[3], EC[4], EC[5], pele, EC[0], EC[1], EC[2], null, 'g')];
  const pelo = s.cabelo === 0 ? 0x4a3020 : ch;
  const barba = s.rosto === 4;
  // orelhinhas
  for (const sx of [-1, 1]) g.push(ovo(0.045, 0.065, 0.04, pele, sx * 0.262, 0.22, 0.0, null, 'pp'));
  // olhos
  for (const lx of [-0.1, 0.1]) {
    const o = s.olhos, P = naCara(lx, 0.27), fora = lx < 0 ? -1 : 1;
    if (o === 0) g.push(grudar(disco(0.032, 0.04, 0.014, io), P, 0.003), grudar(disco(0.011, 0.011, 0.008, BRANCO, 'pp'), P, 0.014).translate(0.01, 0.014, 0));
    else if (o === 1 || o === 5) {
      g.push(grudar(disco(0.058, 0.064, 0.018, BRANCO), P, 0.002), grudar(disco(0.032, 0.042, 0.014, io), naCara(lx - fora * 0.016, 0.262), 0.012),
        grudar(disco(0.011, 0.011, 0.008, BRANCO, 'pp'), naCara(lx - fora * 0.006, 0.278), 0.022));
      if (o === 5) g.push(grudar(arco(0.06, 0.009, Math.PI * 0.8, PRETO, 0, 0, 0, [0, 0, Math.PI]), P, 0.012).translate(0, 0.015, 0), grudar(capsula(0.008, 0.045, PRETO, 0, 0, 0, null, 4), naCara(lx + fora * 0.07, 0.33), 0.01, fora * -0.8));
    } else if (o === 2) g.push(grudar(arco(0.042, 0.011, Math.PI * 0.85, PRETO, 0, 0, 0, [0, 0, Math.PI]), P, 0.004).translate(0, -0.012, 0));
    else if (o === 3) g.push(grudar(disco(0.045, 0.052, 0.016, io), P, 0.003), grudar(disco(0.017, 0.017, 0.01, BRANCO, 'pp'), P, 0.016).translate(0.015, 0.02, 0), grudar(disco(0.008, 0.008, 0.006, BRANCO, 'pp'), P, 0.016).translate(-0.016, -0.016, 0));
    else if (o === 4) g.push(grudar(disco(0.04, 0.03, 0.014, io), naCara(lx, 0.258), 0.003), grudar(capsula(0.009, 0.1, PRETO, 0, 0, 0, [0, 0, Math.PI / 2], 4), naCara(lx, 0.282), 0.01));
    else if (o === 6) g.push(lx < 0 ? grudar(disco(0.036, 0.046, 0.015, io), P, 0.003) : grudar(arco(0.04, 0.011, Math.PI * 0.85, PRETO, 0, 0, 0, [0, 0, Math.PI]), P, 0.004).translate(0, -0.01, 0));
    else g.push(grudar(disco(0.07, 0.075, 0.02, BRANCO), P, 0.002), grudar(disco(0.046, 0.05, 0.016, io), P, 0.014), grudar(disco(0.022, 0.024, 0.01, 0x141414, 'pp'), P, 0.024), grudar(disco(0.016, 0.016, 0.008, BRANCO, 'pp'), naCara(lx + 0.02, 0.29), 0.032));
    // sobrancelhas
    const dentro = -fora, Ps = naCara(lx, 0.36);
    if (s.sobrancelha === 1) g.push(grudar(capsula(0.008, 0.1, pelo, 0, 0, 0, [0, 0, Math.PI / 2], 4), Ps, 0.006));
    else if (s.sobrancelha === 2) g.push(grudar(capsula(0.02, 0.12, pelo, 0, 0, 0, [0, 0, Math.PI / 2], 5), Ps, 0.006));
    else if (s.sobrancelha === 3 || s.sobrancelha === 4) g.push(grudar(capsula(0.014, 0.11, pelo, 0, 0, 0, [0, 0, Math.PI / 2], 5), Ps, 0.006, (s.sobrancelha === 3 ? -0.35 : 0.35) * dentro));
  }
  // boca (por cima da barba, se tiver)
  const fb = barba ? 0.035 : 0.004, PB = naCara(0, 0.12), b = s.boca;
  if (b === 0) g.push(grudar(arco(0.06, 0.012, Math.PI * 0.7, BOCA), PB, fb).translate(0, 0.02, 0));
  else if (b === 1) g.push(grudar(ovo(0.085, 0.05, 0.012, 0x7a2a2a, 0, 0, 0, null, 'p'), PB, fb), grudar(ovo(0.07, 0.016, 0.01, BRANCO, 0, 0.024, 0, null, 'pp'), PB, fb + 0.008));
  else if (b === 2) g.push(grudar(arco(0.03, 0.01, Math.PI * 0.7, BOCA), PB, fb).translate(0, 0.012, 0));
  else if (b === 3) g.push(grudar(arco(0.06, 0.012, Math.PI * 0.7, BOCA), PB, fb).translate(0, 0.02, 0), grudar(ovo(0.032, 0.04, 0.012, 0xef7f95, 0, 0, 0, null, 'pp'), naCara(0.02, 0.085), fb + 0.006));
  else if (b === 4) g.push(grudar(ovo(0.035, 0.045, 0.012, 0x7a2a2a, 0, 0, 0, null, 'p'), PB, fb));
  else if (b === 5) g.push(grudar(arco(0.06, 0.012, Math.PI * 0.7, BOCA), PB, fb).translate(0, 0.02, 0), grudar(ovo(0.016, 0.02, 0.008, BRANCO, 0, 0, 0, null, 'pp'), naCara(-0.02, 0.095), fb + 0.006), grudar(ovo(0.016, 0.02, 0.008, BRANCO, 0, 0, 0, null, 'pp'), naCara(0.02, 0.095), fb + 0.006));
  else g.push(grudar(arco(0.05, 0.012, Math.PI * 0.6, BOCA), naCara(0.03, 0.12), fb, 0.35).translate(0, 0.015, 0));
  // rosto
  const r = s.rosto;
  if (r === 1) for (const x of [-0.16, 0.16]) g.push(grudar(disco(0.045, 0.028, 0.01, ROSA), naCara(x, 0.17), 0.002));
  else if (r === 2) for (const [x, y] of [[-0.17, 0.18], [-0.13, 0.155], [-0.18, 0.14], [0.17, 0.18], [0.13, 0.155], [0.18, 0.14]]) g.push(grudar(disco(0.011, 0.011, 0.006, 0xa8673f, 'pp'), naCara(x, y), 0.002));
  else if (r === 3) for (const sx of [-1, 1]) g.push(grudar(ovo(0.06, 0.022, 0.016, pelo, 0, 0, 0, null, 'p'), naCara(sx * 0.05, 0.165), 0.006, sx * -0.25));
  else if (r === 4) g.push(ovo(0.255, 0.15, 0.225, pelo, 0, 0.09, 0.035, null, 'g'), ovo(0.17, 0.04, 0.05, pelo, 0, 0.17, 0.215, null, 'p'));
  else if (r === 5) g.push(grudar(disco(0.012, 0.012, 0.006, 0x4a2c18, 'pp'), naCara(0.15, 0.18), 0.002));
  else if (r === 6) g.push(grudar(ovo(0.06, 0.022, 0.008, 0xf2d7a8, 0, 0, 0, null, 'p'), naCara(-0.15, 0.18), 0.003, 0.4));
  // óculos
  const oc = s.oculos, aroCor = oc === 4 ? BRANCO : C.ocu;
  if (oc >= 1 && oc <= 4) {
    for (const lx of [-0.1, 0.1]) {
      const P = naCara(lx, 0.27);
      if (oc === 1) g.push(grudar(comCor(new THREE.TorusGeometry(0.068, 0.011, 4, 14), aroCor), P, 0.03));
      else if (oc === 2) g.push(grudar(comCor(new THREE.TorusGeometry(0.08, 0.011, 4, 4).rotateZ(Math.PI / 4), aroCor), P, 0.03));
      else g.push(grudar(disco(0.078, 0.056, 0.012, oc === 3 ? 0x1b1b24 : C.ocu), P, 0.03));
      if (oc === 4) g.push(grudar(disco(0.022, 0.012, 0.006, BRANCO, 'pp'), P, 0.045).translate(-0.02, 0.02, 0));
    }
    g.push(grudar(capsula(0.008, 0.06, aroCor, 0, 0, 0, [0, 0, Math.PI / 2], 4), naCara(0, 0.29), 0.03));
  } else if (oc === 5) {
    g.push(comCor(new THREE.TorusGeometry(1, 0.022, 4, 18).rotateX(Math.PI / 2).scale(0.275, 1, 0.26).translate(0, 0.29, 0), aroCor),
      grudar(ovo(0.19, 0.075, 0.03, aroCor, 0, 0, 0, null, 'p'), naCara(0, 0.27), 0.02), grudar(ovo(0.16, 0.055, 0.02, LENTE, 0, 0, 0, null, 'p'), naCara(0, 0.27), 0.04));
  }
  // cabelo (calota): a frente para na testa e atrás desce até a nuca
  const c = s.cabelo;
  const k = 1.08, cal = (th = 1.55, incl = 0.5, cor = ch) => calota(EC[3] * k, EC[4] * k, EC[5] * k, th, cor, 0, EC[1], -0.005, incl);
  let topo = 0.5;
  if ((c >= 1 && c <= 6) || c === 9 || c === 11 || c === 12) { g.push(cal()); topo = 0.52; }
  if (c === 2) for (const [x, zz, h, inc] of [[-0.12, 0.08, 0.12, -0.4], [0.02, 0.12, 0.14, 0], [0.15, 0.04, 0.11, 0.4], [-0.06, -0.1, 0.13, -0.2], [0.1, -0.12, 0.12, 0.25]]) g.push(cone(0.06, h, ch, x, 0.5 + h * 0.3, zz, [zz * 2, 0, -inc], 5));
  else if (c === 3) g.push(grudar(ovo(0.2, 0.06, 0.05, ch, 0, 0, 0, null, 'p'), naCara(0, 0.4), 0.01, 0.12));
  else if (c === 4) g.push(ovo(0.25, 0.3, 0.1, ch, 0, 0.12, -0.2, [-0.15, 0, 0]), ovo(0.06, 0.22, 0.14, ch, -0.26, 0.17, -0.04, [0, 0, 0.06], 'p'), ovo(0.06, 0.22, 0.14, ch, 0.26, 0.17, -0.04, [0, 0, -0.06], 'p'));
  else if (c === 5) g.push(ovo(0.05, 0.05, 0.05, hat === ch ? BRANCO : hat, 0, 0.33, -0.29, null, 'pp'), ovo(0.08, 0.2, 0.08, ch, 0, 0.16, -0.33, [-0.2, 0, 0], 'p'));
  else if (c === 6) g.push(ovo(0.12, 0.11, 0.12, ch, 0, 0.56, -0.08));
  else if (c === 7) { g.push(ovo(0.37, 0.3, 0.34, ch, 0, 0.42, -0.08, null, 'g')); topo = 0.7; }
  else if (c === 8) { g.push(ovo(0.055, 0.13, 0.3, ch, 0, 0.47, -0.02, null, 'p')); topo = 0.6; }
  else if (c === 9) for (const sx of [-1, 1]) g.push(ovo(0.07, 0.2, 0.07, ch, sx * 0.24, 0.07, -0.16, [0, 0, sx * 0.15], 'p'), ovo(0.045, 0.045, 0.045, hat === ch ? BRANCO : hat, sx * 0.23, 0.25, -0.16, null, 'pp'), ovo(0.06, 0.06, 0.06, ch, sx * 0.26, -0.13, -0.16, null, 'pp'));
  else if (c === 10) { g.push(cal(1.65, 0.62), ovo(0.07, 0.19, 0.2, ch, -0.255, 0.18, -0.01, null, 'p'), ovo(0.07, 0.19, 0.2, ch, 0.255, 0.18, -0.01, null, 'p')); topo = 0.52; }
  else if (c === 11) { g.push(ovo(0.19, 0.1, 0.14, ch, 0, 0.52, 0.12, [-0.3, 0, 0])); topo = 0.6; }
  else if (c === 12) for (const sx of [-1, 1]) g.push(ovo(0.04, 0.04, 0.04, hat === ch ? BRANCO : hat, sx * 0.27, 0.42, -0.06, null, 'pp'), ovo(0.1, 0.12, 0.1, ch, sx * 0.33, 0.36, -0.06, null, 'p'));
  // chapéu
  const h = s.chapeu;
  if (h === 1) g.push(calota(0.29, 0.28, 0.28, 1.45, hat, 0, 0.27, -0.01, 0.15), ovo(0.21, 0.022, 0.16, hat, 0, 0.43, 0.25, [0.18, 0, 0], 'p'), ovo(0.035, 0.03, 0.035, BRANCO, 0, 0.56, -0.02, null, 'pp'));
  else if (h === 2) g.push(cilindro(0.5, 0.5, 0.035, PALHA, 0, topo, 0, 16), cilindro(0.26, 0.29, 0.22, PALHA, 0, topo + 0.12, 0, 16), cilindro(0.295, 0.295, 0.06, hat, 0, topo + 0.04, 0, 16));
  else if (h === 3) g.push(calota(0.295, 0.31, 0.285, 1.3, hat, 0, 0.27, 0, 0.1), comCor(new THREE.TorusGeometry(1, 0.05, 5, 16).rotateX(Math.PI / 2).scale(0.27, 1, 0.26).translate(0, 0.38, 0.0), BRANCO), ovo(0.08, 0.08, 0.08, BRANCO, 0, 0.6, -0.02, null, 'p'));
  else if (h === 4) {
    g.push(cilindro(0.22, 0.24, 0.1, OURO, 0, topo + 0.03, 0, 14));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.push(cone(0.045, 0.1, OURO, Math.sin(a) * 0.21, topo + 0.12, Math.cos(a) * 0.21, null, 5), ovo(0.025, 0.025, 0.025, OURO, Math.sin(a) * 0.21, topo + 0.18, Math.cos(a) * 0.21, null, 'pp')); }
    g.push(ovo(0.035, 0.035, 0.015, hat, 0, topo + 0.03, 0.24, null, 'pp'));
  } else if (h === 5) g.push(ovo(0.09, 0.07, 0.04, hat, 0.1, topo - 0.02, 0.12, [0, 0, 0.4], 'p'), ovo(0.09, 0.07, 0.04, hat, 0.28, topo - 0.02, 0.12, [0, 0, -0.4], 'p'), ovo(0.045, 0.045, 0.045, hat, 0.19, topo - 0.02, 0.13, null, 'pp'));
  else if (h === 6) g.push(ovo(0.31, 0.26, 0.32, hat, 0, topo - 0.1, -0.01, null, 'g'), ovo(0.18, 0.02, 0.07, hat, 0, topo - 0.06, 0.3, null, 'p'), ovo(0.05, 0.03, 0.02, BRANCO, 0, topo + 0.08, 0.27, null, 'pp'));
  else if (h === 7) g.push(comCor(new THREE.TorusGeometry(0.28, 0.022, 4, 14, Math.PI).translate(0, 0, 0).scale(1, 1.05, 1).translate(0, 0.27, 0.06), hat), ovo(0.05, 0.05, 0.05, BRANCO, 0.14, topo + 0.03, 0.08, null, 'pp'));
  else if (h === 8) g.push(comCor(new THREE.TorusGeometry(0.29, 0.03, 4, 14, Math.PI).translate(0, 0.25, 0), hat), deitado(0.1, 0.07, PRETO, -0.29, 0.25, 0, 'z'), deitado(0.1, 0.07, PRETO, 0.29, 0.25, 0, 'z'));
  else if (h === 9) g.push(cilindro(0.38, 0.38, 0.03, PRETO, 0, topo, 0, 16), cilindro(0.24, 0.24, 0.42, PRETO, 0, topo + 0.22, 0, 14), cilindro(0.245, 0.245, 0.07, hat, 0, topo + 0.06, 0, 14));
  return g;
}

// tronco: cápsula achatada de frente para trás (medidas a partir do chão; o meio fica em y 1.08)
const TR = { y: 1.08, r: 0.245, meia: 0.1, pz: 0.68 };
const raioTronco = (y) => { const d = Math.abs(y - TR.y) - TR.meia; return d <= 0 ? TR.r : Math.sqrt(Math.max(0, TR.r * TR.r - d * d)); };
// ponto na frente (+z) ou atrás (-z) do tronco, com a normal
function naBarriga(u, v, atras = false) {
  const rr = raioTronco(v), x = Math.max(-rr * 0.97, Math.min(rr * 0.97, u));
  const zz = Math.sqrt(Math.max(0, rr * rr - x * x)) * TR.pz * (atras ? -1 : 1);
  const d = Math.abs(v - TR.y) - TR.meia, ny = d > 0 ? Math.sign(v - TR.y) * d / TR.r : 0;
  const nx = x / TR.r, nz = zz / (TR.r * TR.pz * TR.pz), l = Math.hypot(nx, ny, nz);
  return [x, v, zz, nx / l, ny / l, nz / l];
}
// faixa em volta do tronco entre y0 e y1
function faixa(y0, y1, cor, folga = 0.006) {
  const g = new THREE.CylinderGeometry(raioTronco(y1) + folga, raioTronco(y0) + folga, y1 - y0, 14, 1, true);
  g.scale(1, 1, TR.pz); g.translate(0, (y0 + y1) / 2, 0);
  return comCor(g, cor);
}

export function pecasCorpoRedondo(s) {
  const C = coresDe(s), pele = C.pele, r = C.roupa, d = C.det;
  const jardineira = s.roupa === 5, vestido = s.roupa === 4, jaqueta = s.roupa === 7;
  const camisa = jardineira ? d : r;
  const tr = new THREE.CapsuleGeometry(TR.r, TR.meia * 2, 4, 12);
  tr.scale(1, 1, TR.pz); tr.translate(0, TR.y, 0);
  const g = [comCor(tr, camisa)];
  if (!jardineira) {
    const e = s.estampa;
    if (e === 1) for (const y of [0.9, 1.06, 1.22]) g.push(faixa(y - 0.035, y + 0.035, d));
    else if (e === 2) g.push(grudar(ovo(0.06, 0.3, 0.02, d, 0, 0, 0, null, 'p'), naBarriga(0, 1.08), -0.006));
    else if (e === 3) g.push(grudar(ovo(0.07, 0.055, 0.014, d, 0, 0, 0, null, 'p'), naBarriga(0.1, 0.96), 0.002), grudar(capsula(0.008, 0.12, PRETO, 0, 0, 0, [0, 0, Math.PI / 2], 4), naBarriga(0.1, 1.0), 0.006));
    else if (e === 4) { for (const y of [0.93, 1.12, 1.3]) g.push(faixa(y - 0.02, y + 0.02, d)); for (const x of [-0.12, 0.02, 0.15]) g.push(grudar(ovo(0.018, 0.3, 0.01, d, 0, 0, 0, null, 'p'), naBarriga(x, 1.08), 0.0)); }
    else if (e === 5) { const P = naBarriga(0, 1.1); g.push(grudar(estrelaGeo(0.1, d, 0, 0, 0), P, 0.006)); }
  }
  if (s.roupa === 1) g.push(ovo(0.17, 0.07, 0.11, pele, 0, 1.4, 0, null, 'p'));
  if (s.roupa === 3) g.push(ovo(0.2, 0.11, 0.09, r, 0, 1.38, -0.14, [-0.3, 0, 0], 'p'), capsula(0.01, 0.14, BRANCO, -0.06, 1.3, 0.16, null, 4), capsula(0.01, 0.14, BRANCO, 0.06, 1.3, 0.16, null, 4));
  if (jardineira) {
    g.push(faixa(0.74, 0.93, r, 0.008), grudar(ovo(0.13, 0.1, 0.02, r, 0, 0, 0, null, 'p'), naBarriga(0, 1.0), -0.004));
    for (const sx of [-1, 1]) g.push(grudar(capsula(0.022, 0.4, r, 0, 0, 0, null, 4), naBarriga(sx * 0.13, 1.2), 0.002), grudar(capsula(0.022, 0.4, r, 0, 0, 0, null, 4), naBarriga(sx * 0.13, 1.15, true), 0.002),
      grudar(ovo(0.022, 0.022, 0.012, OURO, 0, 0, 0, null, 'pp'), naBarriga(sx * 0.13, 1.08), 0.016));
  }
  if (s.roupa === 6) {
    for (const sx of [-1, 1]) g.push(grudar(ovo(0.065, 0.04, 0.012, BRANCO, 0, 0, 0, null, 'p'), naBarriga(sx * 0.06, 1.36), 0.006, sx * 0.5));
    for (const y of [0.92, 1.05, 1.18, 1.29]) g.push(grudar(ovo(0.017, 0.017, 0.01, BRANCO, 0, 0, 0, null, 'pp'), naBarriga(0, y), 0.004));
  }
  if (jaqueta) g.push(grudar(ovo(0.075, 0.3, 0.015, d, 0, 0, 0, null, 'p'), naBarriga(0, 1.08), -0.004),
    grudar(capsula(0.01, 0.58, 0x9e9e9e, 0, 0, 0, null, 4), naBarriga(-0.08, 1.08), 0.004), grudar(capsula(0.01, 0.58, 0x9e9e9e, 0, 0, 0, null, 4), naBarriga(0.08, 1.08), 0.004),
    comCor(new THREE.TorusGeometry(1, 0.045, 5, 14).rotateX(Math.PI / 2).scale(0.16, 1, 0.13).translate(0, 1.4, 0), r));
  if (vestido) g.push(cilindro(0.27, 0.38, 0.44, r, 0, 0.6, 0, 14));
  else if (s.calca === 2) g.push(cilindro(0.26, 0.35, 0.28, C.calca, 0, 0.69, 0, 14));
  // costas
  const cos = C.cos, k = s.costas;
  if (k === 1) g.push(caixa(0.34, 0.4, 0.16, cos, 0, 1.06, -0.2, 0.07), caixa(0.26, 0.14, 0.07, cos, 0, 0.96, -0.29, 0.03),
    grudar(capsula(0.024, 0.46, 0x3b2f22, 0, 0, 0, null, 4), naBarriga(-0.13, 1.12), 0.004), grudar(capsula(0.024, 0.46, 0x3b2f22, 0, 0, 0, null, 4), naBarriga(0.13, 1.12), 0.004));
  else if (k === 2) g.push(caixa(0.54, 0.9, 0.03, cos, 0, 0.95, -0.18, 0.012), comCor(new THREE.TorusGeometry(1, 0.035, 5, 14).rotateX(Math.PI / 2).scale(0.2, 1, 0.16).translate(0, 1.39, -0.01), cos));
  else if (k === 3) for (const sx of [-1, 1]) g.push(ovo(0.16, 0.12, 0.02, cos, sx * 0.22, 1.24, -0.2, [0, 0, sx * 0.4], 'p'), ovo(0.11, 0.09, 0.02, cos, sx * 0.19, 1.02, -0.2, [0, 0, -sx * 0.3], 'p'));
  else if (k === 4) g.push(ovo(0.2, 0.23, 0.07, cos, 0.04, 0.88, -0.22), ovo(0.14, 0.14, 0.065, cos, 0.04, 1.14, -0.22), deitado(0.045, 0.03, PRETO, 0.04, 0.95, -0.29, 'x'),
    capsula(0.03, 0.48, 0x5a3a22, 0.04, 1.42, -0.22, null, 5), caixa(0.1, 0.1, 0.05, 0x3b2f22, 0.04, 1.69, -0.22, 0.02), grudar(capsula(0.018, 0.6, 0x3b2f22, 0, 0, 0, null, 4), naBarriga(-0.12, 1.12), 0.004, 0.5));
  return g;
}

// braço/perna em cápsulas empilhadas de cima para baixo (pivô no topo) + extra (mão, pé) no fim
function membroRedondo(partes, x, y, z, extra = [], inicio = 0) {
  let topo = inicio;
  const geos = [];
  for (const [w, h, d, cor] of partes) {
    const r = Math.min(w, d) * 0.47;
    geos.push(capsula(r, h + r * 0.6, cor, 0, topo - h / 2, 0, null, 9));
    topo -= h;
  }
  return { geos: [...geos, ...extra], x, y, z };
}

// braços (braço + antebraço + mão) e pernas (coxa + canela + pé); cada um devolve [de cima, de baixo]
export function membrosRedondos(s, malha, cortar, PERNA, BRACO, OMBRO_Y) {
  const C = coresDe(s), pele = C.pele, r = C.roupa, d = C.det, sap = C.sap;
  const manga = [2, 3, 6, 7].includes(s.roupa) ? 0.52 : s.roupa === 1 ? 0 : 0.22;
  const corManga = s.roupa === 5 ? d : r;
  const articular = (partes, total, x, y, extra) => {
    const [cima, baixo] = cortar(partes, total / 2);
    const A = membroRedondo(cima, x, y, 0), B = membroRedondo(baixo, 0, -total / 2, 0, extra(-total / 2), 0.02);
    const a = malha(juntar(A.geos)), b = malha(juntar(B.geos));
    a.position.set(A.x, A.y, A.z); b.position.set(B.x, B.y, B.z);
    a.add(b);
    return [a, b];
  };
  const mao = (fim) => [ovo(0.088, 0.092, 0.088, pele, 0, fim + 0.01, 0, null, 'p')]; // fim = ponta do braço
  const braco = (x) => articular(manga ? [[0.2, manga, 0.2, corManga], [0.15, BRACO - manga - 0.06, 0.15, pele]] : [[0.16, 0.28, 0.16, pele], [0.15, BRACO - 0.34, 0.15, pele]], BRACO, x, OMBRO_Y, mao);
  // pé: cano (de cima para baixo) e a cor da bolinha do pé; sola = sola de outra cor
  const PES = [
    { cano: [[0.2, 0.06, 0.2, sap]], pe: sap, sola: BRANCO },
    { cano: [[0.23, 0.22, 0.23, sap]], pe: sap },
    { cano: [[0.18, 0.06, 0.18, pele]], pe: pele, sola: sap },
    { cano: [[0.18, 0.06, 0.18, pele]], pe: pele, peq: true },
    { cano: [[0.24, 0.3, 0.24, sap]], pe: sap },
  ];
  const P = PES[s.sapato] || PES[0];
  const ALT_PE = 0.08;
  const resto = PERNA - ALT_PE - P.cano.reduce((t, p) => t + p[1], 0);
  const pernasDeFora = s.roupa === 4 || s.calca === 2;
  const corCalca = s.roupa === 5 ? r : C.calca;
  let cima;
  if (pernasDeFora) cima = [[0.19, resto, 0.19, pele]];
  else if (s.calca === 1 && s.roupa !== 5) cima = [[0.23, Math.min(0.3, resto), 0.23, corCalca], ...(resto > 0.3 ? [[0.19, resto - 0.3, 0.19, pele]] : [])];
  else if (s.calca === 3 && s.roupa !== 5 && resto > 0.36) cima = [[0.22, 0.24, 0.22, corCalca], [0.2, 0.08, 0.2, pele], [0.22, resto - 0.32, 0.22, corCalca]];
  else cima = [[0.22, resto, 0.22, corCalca]];
  // base = chão, nas medidas da canela (o pivô dela fica no joelho, meia perna acima do chão)
  const pe = (chao) => {
    const k = P.peq ? 0.88 : 1, out = [ovo(0.105 * k, 0.075 * k, 0.15 * k, P.pe, 0, chao + 0.07 * k, 0.04, null, 'p')];
    if (P.sola) out.push(ovo(0.11, 0.025, 0.155, P.sola, 0, chao + 0.022, 0.04, null, 'p'));
    return out;
  };
  const perna = (x) => articular([...cima, ...P.cano, [0.2, ALT_PE, 0.2, P.pe]], PERNA, x, 0, pe);
  return [braco(-0.34), braco(0.34), perna(-0.12), perna(0.12)];
}

// ---------- aldeão ----------
export function montarAldeaoRedondo(pick, r, oficio, malha) {
  const pele = pick.pele, cab = pick.cab, roupa = pick.roupa, calca = pick.calca;
  const g = new THREE.Group();
  const tr = new THREE.CapsuleGeometry(0.25, 0.14, 4, 12); tr.scale(1, 1, 0.68); tr.translate(0, 0.94, 0);
  const corpo = [comCor(tr, roupa)];
  const fr = (u, v) => [u, v, 0.165, 0, 0, 1];
  if (oficio === 'fazendeiro') corpo.push(grudar(ovo(0.2, 0.22, 0.02, 0x3f6fa0, 0, 0, 0, null, 'p'), fr(0, 0.86), 0.0), capsula(0.02, 0.2, 0x3f6fa0, -0.13, 1.14, 0.15, null, 4), capsula(0.02, 0.2, 0x3f6fa0, 0.13, 1.14, 0.15, null, 4));
  if (oficio === 'padeiro') corpo.push(grudar(ovo(0.2, 0.25, 0.02, 0xfafafa, 0, 0, 0, null, 'p'), fr(0, 0.86), 0.0));
  if (oficio === 'lojista') corpo.push(grudar(ovo(0.2, 0.25, 0.02, 0x3f8f5a, 0, 0, 0, null, 'p'), fr(0, 0.86), 0.0), grudar(ovo(0.05, 0.035, 0.01, 0xf2c72e, 0, 0, 0, null, 'pp'), fr(0.12, 1.06), 0.01));
  if (oficio === 'artesao') corpo.push(ovo(0.1, 0.3, 0.17, 0x7a5634, -0.17, 0.94, 0, null, 'p'), ovo(0.1, 0.3, 0.17, 0x7a5634, 0.17, 0.94, 0, null, 'p'));
  if (oficio === 'florista') corpo.push(cilindro(0.25, 0.33, 0.26, roupa, 0, 0.66, 0, 14));
  g.add(malha(juntar(corpo)));

  const E = [0, 0.23, 0, 0.25, 0.25, 0.235], na = (u, v) => pontoNa(E, u, v);
  const cabeca = [ovo(E[3], E[4], E[5], pele, E[0], E[1], E[2], null, 'g'),
    grudar(disco(0.032, 0.042, 0.014, 0x222222), na(-0.09, 0.26), 0.003), grudar(disco(0.032, 0.042, 0.014, 0x222222), na(0.09, 0.26), 0.003),
    grudar(disco(0.01, 0.01, 0.006, 0xffffff, 'pp'), na(-0.08, 0.275), 0.014), grudar(disco(0.01, 0.01, 0.006, 0xffffff, 'pp'), na(0.1, 0.275), 0.014),
    grudar(ovo(0.035, 0.03, 0.03, pele, 0, 0, 0, null, 'pp'), na(0, 0.18), 0.012), grudar(arco(0.05, 0.011, Math.PI * 0.7, 0x8a3a30), na(0, 0.11), 0.004).translate(0, 0.015, 0),
    grudar(disco(0.04, 0.026, 0.01, 0xf08a8a), na(-0.15, 0.15), 0.002), grudar(disco(0.04, 0.026, 0.01, 0xf08a8a), na(0.15, 0.15), 0.002),
    ovo(0.04, 0.06, 0.035, pele, -0.248, 0.21, 0, null, 'pp'), ovo(0.04, 0.06, 0.035, pele, 0.248, 0.21, 0, null, 'pp')];
  const estilo = r();
  const k = 1.08, cal = (th, incl) => calota(E[3] * k, E[4] * k, E[5] * k, th, cab, 0, E[1], -0.005, incl);
  if (cab === 0xdedad2 && estilo < 0.5) cabeca.push(ovo(0.07, 0.12, 0.17, cab, -0.23, 0.28, -0.04, null, 'p'), ovo(0.07, 0.12, 0.17, cab, 0.23, 0.28, -0.04, null, 'p'), ovo(0.2, 0.12, 0.08, cab, 0, 0.26, -0.2, null, 'p'));
  else {
    cabeca.push(cal(1.55, 0.5));
    if (estilo < 0.35) cabeca.push(ovo(0.24, 0.26, 0.09, cab, 0, 0.12, -0.19, [-0.15, 0, 0]), ovo(0.06, 0.18, 0.12, cab, -0.24, 0.17, -0.05, null, 'p'), ovo(0.06, 0.18, 0.12, cab, 0.24, 0.17, -0.05, null, 'p'));
    else if (estilo < 0.55) cabeca.push(ovo(0.11, 0.1, 0.11, cab, 0, 0.56, -0.12));
  }
  if (oficio === 'fazendeiro') cabeca.push(cilindro(0.42, 0.42, 0.03, 0xe8c46a, 0, 0.49, 0, 16), cilindro(0.23, 0.25, 0.2, 0xe8c46a, 0, 0.6, 0, 14), cilindro(0.255, 0.255, 0.05, 0xb0472b, 0, 0.53, 0, 14));
  if (oficio === 'padeiro') cabeca.push(cilindro(0.2, 0.23, 0.12, 0xfafafa, 0, 0.52, 0, 14), ovo(0.25, 0.14, 0.25, 0xfafafa, 0, 0.64, 0));
  if (oficio === 'pescador') cabeca.push(calota(0.28, 0.27, 0.27, 1.4, 0x3f6fd9, 0, 0.27, -0.01, 0.15), ovo(0.2, 0.02, 0.14, 0x3f6fd9, 0, 0.42, 0.25, [0.18, 0, 0], 'p'));
  if (oficio === 'florista') cabeca.push(ovo(0.065, 0.065, 0.03, 0xe8433f, 0.18, 0.44, 0.12, null, 'p'), ovo(0.025, 0.025, 0.015, 0xffe066, 0.18, 0.44, 0.15, null, 'pp'));
  const cab3 = malha(juntar(cabeca));
  cab3.position.y = 1.24;
  g.add(cab3);

  const membro = (geos, x, y) => { const m = malha(juntar(geos)); m.position.set(x, y, 0); return m; };
  const bracoG = () => [capsula(0.095, 0.42, roupa, 0, -0.2, 0, null, 9), capsula(0.08, 0.2, pele, 0, -0.42, 0, null, 9), ovo(0.075, 0.08, 0.075, pele, 0, -0.52, 0, null, 'p')];
  const pernaG = () => [capsula(0.11, 0.56, calca, 0, -0.27, 0, null, 9), ovo(0.11, 0.075, 0.155, 0x3b2a1e, 0, -0.55, 0.04, null, 'p')];
  const bd = membro(bracoG(), -0.33, 1.2), be = membro(bracoG(), 0.33, 1.2);
  const pd = membro(pernaG(), -0.12, 0.62), pe = membro(pernaG(), 0.12, 0.62);
  g.add(bd, be, pd, pe);
  return { grupo: g, cabeca: cab3, bracos: [bd, be], pernas: [pd, pe] };
}

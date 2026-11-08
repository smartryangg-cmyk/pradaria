// Cidade procedural: ruas, calçadas, prédios, casas, praças, postes e carros estacionados.
import * as THREE from '../vendor/three.module.min.js';
import { hash3 } from './ruido.js';
import { peca, moverPeca, VEG, DECORACOES } from './modelos.js';
import { TAM, ALT_CIDADE } from './terreno.js';

const CAIXA = new THREE.BoxGeometry(1, 1, 1);
const CIL = (s) => new THREE.CylinderGeometry(1, 1, 1, s);
const CONE4 = new THREE.ConeGeometry(1, 1, 4);

const ASFALTO = 0x4a4d55, LINHA = 0xf2d24b, FAIXA = 0xf4f4f4, CALCADA = 0xc9c5bd, GUIA = 0xa9a59d;
const CORES_PREDIO = [0xe9d6b5, 0xd9a07a, 0xb8c9d9, 0xe8c4c4, 0xc9d9b8, 0xf0e1a8, 0xd0d0d8, 0xa9c4e0, 0xe6b98a];
const CORES_CASA = [0xf6e7c8, 0xf2c6b4, 0xcfe3f2, 0xd8ecc4, 0xf7e08f, 0xe8d0f0, 0xffffff];
const CORES_TELHADO = [0xc0503a, 0x8a4a3a, 0x5a6e8a, 0x6a6a6a, 0xa0603a];
export const MODELOS_CARRO = ['compacto', 'sedan', 'picape', 'van', 'esportivo'];
export const CORES_CARRO = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xffffff, 0x212121, 0xfb8c00, 0x8e24aa, 0x00acc1, 0xf48fb1];

const caixa = (cor, x, y, z, w, h, d, ry = 0) => peca(CAIXA, cor, [x, y, z], [0, ry, 0], [w, h, d]);
const pick = (lista, r) => lista[Math.floor(r * lista.length) % lista.length];

// cache de peças repetidas
const cache = {};
const tpl = (nome, fn) => (cache[nome] ||= fn());
const poste = () => tpl('poste', () => [peca(CIL(6), 0x50545c, [0, 2.4, 0], [0, 0, 0], [0.08, 4.8, 0.08]), caixa(0x50545c, 0.45, 4.75, 0, 1.0, 0.08, 0.08),
  caixa(0xfff2b0, 0.85, 4.65, 0, 0.35, 0.12, 0.22)]);
const semaforo = () => tpl('semaforo', () => [peca(CIL(6), 0x3a3d44, [0, 1.6, 0], [0, 0, 0], [0.07, 3.2, 0.07]), caixa(0x2a2a2a, 0, 3.4, 0, 0.3, 0.8, 0.25),
  peca(new THREE.IcosahedronGeometry(1, 0), 0xe53935, [0, 3.65, 0.13], [0, 0, 0], [0.08, 0.08, 0.04]), peca(new THREE.IcosahedronGeometry(1, 0), 0xfdd835, [0, 3.4, 0.13], [0, 0, 0], [0.08, 0.08, 0.04]),
  peca(new THREE.IcosahedronGeometry(1, 0), 0x43a047, [0, 3.15, 0.13], [0, 0, 0], [0.08, 0.08, 0.04])]);

function predio(P, rets, x0, z0, w, d, h, r) {
  const cor = pick(CORES_PREDIO, r), y0 = ALT_CIDADE;
  const cx = x0 + w / 2, cz = z0 + d / 2;
  P.push(caixa(cor, cx, y0 + h / 2, cz, w, h, d));
  // janelas: uma faixa escura por andar
  const vidro = r < 0.5 ? 0x5b7896 : 0x6f8fae;
  for (let y = 2.2; y < h - 0.8; y += 3.1) P.push(caixa(vidro, cx, y0 + y, cz, w + 0.06, 1.1, d + 0.06));
  P.push(caixa(0x8f8a84, cx, y0 + h + 0.15, cz, w + 0.3, 0.3, d + 0.3));
  if (h > 12) P.push(caixa(0xb0aca6, cx + w * 0.2, y0 + h + 0.9, cz - d * 0.15, 2.2, 1.5, 2.2)); // caixa d'água
  // porta voltada para a rua mais próxima (z menor)
  P.push(caixa(0x6b4a2b, cx, y0 + 1.1, z0 - 0.03, 1.6, 2.2, 0.08));
  P.push(caixa(0xe0e0e0, cx, y0 + 2.4, z0 - 0.4, 2.6, 0.12, 0.8));
  rets.push({ x0: x0 - 0.1, z0: z0 - 0.1, x1: x0 + w + 0.1, z1: z0 + d + 0.1 });
}

function casa(P, rets, col, cx, cz, rot, r) {
  const w = 6 + r * 2.5, d = 6 + ((r * 7) % 1) * 2;
  const cor = pick(CORES_CASA, r), tel = pick(CORES_TELHADO, (r * 13) % 1), y0 = ALT_CIDADE;
  const pecas = [caixa(cor, 0, 1.5, 0, w, 3, d), peca(CONE4, tel, [0, 3.0 + 1.0, 0], [0, Math.PI / 4, 0], [w * 0.78, 2.0, d * 0.78]),
    caixa(0x7a5634, 0, 1.05, d / 2 + 0.02, 1.1, 2.1, 0.08), caixa(0x9fd3ff, -w / 4 - 0.3, 1.7, d / 2 + 0.02, 1.2, 0.9, 0.06),
    caixa(0x9fd3ff, w / 4 + 0.3, 1.7, d / 2 + 0.02, 1.2, 0.9, 0.06), caixa(0xffffff, -w / 4 - 0.3, 1.2, d / 2 + 0.12, 1.4, 0.1, 0.2),
    caixa(0x8f8a84, w * 0.25, 4.3, -d * 0.15, 0.6, 1.4, 0.6)];
  for (const pc of pecas) P.push(moverPeca(pc, cx, y0, cz, rot));
  const m = Math.max(w, d) / 2 + 0.2;
  const c = Math.abs(Math.cos(rot)) > 0.5;
  const hw = c ? w / 2 : d / 2, hd = c ? d / 2 : w / 2;
  rets.push({ x0: cx - hw - 0.1, z0: cz - hd - 0.1, x1: cx + hw + 0.1, z1: cz + hd + 0.1 });
  void m; void col;
}

function arvoreCidade(P, col, x, z, r) {
  const v = VEG.arvore(r);
  for (const pc of v) P.push(moverPeca(pc, x, ALT_CIDADE, z, r * 9, 0.75));
  col.push({ x, z, r: 0.3 });
}

// monta um quarteirão da cidade (pedaço cx,cz). Coordenadas locais 0..48.
export function montarQuarteirao(semente, cx, cz) {
  const P = [], col = [], rets = [], carros = [];
  const ox = cx * TAM, oz = cz * TAM, y = ALT_CIDADE;
  const R = (k) => hash3(cx, k, cz, semente);
  // ruas (bordas do pedaço) e faixas
  P.push(caixa(ASFALTO, 2.5, y + 0.02, TAM / 2, 5, 0.04, TAM), caixa(ASFALTO, TAM - 2.5, y + 0.02, TAM / 2, 5, 0.04, TAM));
  P.push(caixa(ASFALTO, TAM / 2, y + 0.02, 2.5, TAM - 10, 0.04, 5), caixa(ASFALTO, TAM / 2, y + 0.02, TAM - 2.5, TAM - 10, 0.04, 5));
  for (let t = 7; t < TAM - 6; t += 6) {
    P.push(caixa(LINHA, 0.08, y + 0.05, t, 0.16, 0.02, 2.8), caixa(LINHA, TAM - 0.08, y + 0.05, t, 0.16, 0.02, 2.8));
    P.push(caixa(LINHA, t, y + 0.05, 0.08, 2.8, 0.02, 0.16), caixa(LINHA, t, y + 0.05, TAM - 0.08, 2.8, 0.02, 0.16));
  }
  // faixa de pedestre perto da esquina (0,0)
  for (let i = 0; i < 5; i++) P.push(caixa(FAIXA, 6.2, y + 0.05, 0.6 + i * 0.95, 1.6, 0.02, 0.5), caixa(FAIXA, 0.6 + i * 0.95, y + 0.05, 6.2, 0.5, 0.02, 1.6));
  // calçadas (anel ao redor do quarteirão)
  const c0 = 5, c1 = TAM - 5, larg = 2.2;
  P.push(caixa(CALCADA, TAM / 2, y + 0.1, c0 + larg / 2, c1 - c0, 0.2, larg), caixa(CALCADA, TAM / 2, y + 0.1, c1 - larg / 2, c1 - c0, 0.2, larg));
  P.push(caixa(CALCADA, c0 + larg / 2, y + 0.1, TAM / 2, larg, 0.2, c1 - c0 - 2 * larg), caixa(CALCADA, c1 - larg / 2, y + 0.1, TAM / 2, larg, 0.2, c1 - c0 - 2 * larg));
  P.push(caixa(GUIA, TAM / 2, y + 0.11, c0 + 0.05, c1 - c0, 0.22, 0.12), caixa(GUIA, TAM / 2, y + 0.11, c1 - 0.05, c1 - c0, 0.22, 0.12));
  // postes nas esquinas e no meio
  for (const [px, pz, ry] of [[c0 + 0.5, c0 + 0.5, Math.PI * 1.25], [c1 - 0.5, c0 + 0.5, Math.PI * 1.75], [c0 + 0.5, c1 - 0.5, Math.PI * 0.75], [c1 - 0.5, c1 - 0.5, Math.PI * 0.25], [TAM / 2, c0 + 0.5, Math.PI * 1.5]]) {
    for (const pc of poste()) P.push(moverPeca(pc, px, y + 0.2, pz, ry));
    col.push({ x: px, z: pz, r: 0.15 });
  }
  for (const pc of semaforo()) P.push(moverPeca(pc, c0 + 0.4, y + 0.2, c0 + 1.6, Math.PI));
  col.push({ x: c0 + 0.4, z: c0 + 1.6, r: 0.12 });

  // miolo do quarteirão
  const m0 = c0 + larg, m1 = c1 - larg, mw = m1 - m0; // ~33.6 m
  const dist = Math.max(Math.abs(cx + 0.5), Math.abs(cz + 0.5));
  const r = R(1);
  let tipo = r < 0.2 ? 'praca' : (dist > 3 ? r < 0.8 : r < 0.4) ? 'casas' : 'predios';
  if ((cx === 0 || cx === -1) && (cz === 0 || cz === -1)) tipo = 'praca';
  if (tipo === 'praca') {
    P.push(caixa(0xe3d3a8, m0 + mw / 2, y + 0.03, m0 + mw / 2, 3, 0.06, mw), caixa(0xe3d3a8, m0 + mw / 2, y + 0.03, m0 + mw / 2, mw, 0.06, 3));
    // chafariz
    const fx = m0 + mw / 2, fz = m0 + mw / 2;
    P.push(peca(CIL(10), 0xbdb8ae, [fx, y + 0.3, fz], [0, 0, 0], [2.4, 0.6, 2.4]), peca(CIL(10), 0x58a8e8, [fx, y + 0.62, fz], [0, 0, 0], [2.1, 0.06, 2.1]),
      peca(CIL(8), 0xbdb8ae, [fx, y + 1.2, fz], [0, 0, 0], [0.3, 1.6, 0.3]), peca(CIL(8), 0x7cc4f2, [fx, y + 2.05, fz], [0, 0, 0], [0.8, 0.12, 0.8]));
    col.push({ x: fx, z: fz, r: 2.5 });
    for (const [ax, az] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]]) arvoreCidade(P, col, m0 + mw * ax, m0 + mw * az, R(ax * 10 + az * 100));
    const banco = DECORACOES.banco.pecas();
    for (const [bx, bz, br] of [[fx, fz - 5, 0], [fx, fz + 5, Math.PI], [fx - 5, fz, Math.PI / 2], [fx + 5, fz, -Math.PI / 2]]) for (const pc of banco) P.push(moverPeca(pc, bx, y, bz, br));
    for (let i = 0; i < 6; i++) for (const pc of VEG.florzinhas(R(20 + i))) P.push(moverPeca(pc, m0 + 3 + R(30 + i) * (mw - 6), y, m0 + 3 + R(40 + i) * (mw - 6), 0));
  } else if (tipo === 'predios') {
    const n = r < 0.55 ? 1 : 2; // 1 grande ou 2x2 lotes
    const lotes = n === 1 ? [[m0 + 2, m0 + 2, mw - 4, mw - 4]] : [[m0 + 1, m0 + 1, mw / 2 - 2, mw / 2 - 2], [m0 + mw / 2 + 1, m0 + 1, mw / 2 - 2, mw / 2 - 2], [m0 + 1, m0 + mw / 2 + 1, mw / 2 - 2, mw / 2 - 2], [m0 + mw / 2 + 1, m0 + mw / 2 + 1, mw / 2 - 2, mw / 2 - 2]];
    lotes.forEach(([x0, z0, w, d], i) => {
      const rr = R(50 + i);
      const centro = 1 - Math.min(1, dist / 5);
      const h = 7 + Math.floor(rr * (8 + centro * 22)) + (n === 1 ? 6 : 0);
      if (rr < 0.12 && n > 1) { arvoreCidade(P, col, x0 + w / 2, z0 + d / 2, rr); return; }
      const ww = w * (0.75 + rr * 0.25), dd = d * (0.75 + ((rr * 7) % 1) * 0.25);
      // monta em coordenadas locais e converte o retângulo para o mundo
      const ret = [];
      predio(P, ret, x0 + (w - ww) / 2, z0 + (d - dd) / 2, ww, dd, h, rr);
      for (const q of ret) rets.push({ x0: q.x0 + ox, z0: q.z0 + oz, x1: q.x1 + ox, z1: q.z1 + oz });
    });
  } else {
    // casas: duas fileiras voltadas para as ruas
    const lados = [[m0 + mw * 0.25, m0 + 5, Math.PI], [m0 + mw * 0.75, m0 + 5, Math.PI], [m0 + mw * 0.25, m1 - 5, 0], [m0 + mw * 0.75, m1 - 5, 0]];
    lados.forEach(([hx, hz, rot], i) => {
      const rr = R(60 + i);
      if (rr < 0.12) { arvoreCidade(P, col, hx, hz, rr); return; }
      const ret = [];
      casa(P, ret, col, hx, hz, rot, rr);
      for (const q of ret) rets.push({ x0: q.x0 + ox, z0: q.z0 + oz, x1: q.x1 + ox, z1: q.z1 + oz });
      if (rr > 0.5) arvoreCidade(P, col, hx + 5.2, hz + (rot ? 5 : -5), rr);
    });
    // quintal com cerquinha baixa no meio
    const cerca = DECORACOES.cerca.pecas();
    for (let t = m0 + 1; t < m1 - 1; t += 2) for (const pc of cerca) P.push(moverPeca(pc, t + 1, y, m0 + mw / 2, 0, 1));
  }
  // corrige colisores locais de árvores/postes (os de casas/predios já foram convertidos)
  for (const c of col) { c.x += ox; c.z += oz; }

  // carros estacionados junto à calçada
  const nCarros = Math.floor(R(70) * 3);
  for (let i = 0; i < nCarros; i++) {
    const lado = Math.floor(R(71 + i) * 4);
    const t = 10 + R(80 + i) * (TAM - 20);
    const pos = [[4.0, t, 0], [TAM - 4.0, t, Math.PI], [t, 4.0, Math.PI / 2], [t, TAM - 4.0, -Math.PI / 2]][lado];
    carros.push({ id: `${cx},${cz},${i}`, x: ox + pos[0], z: oz + pos[1], yaw: pos[2], modelo: pick(MODELOS_CARRO, R(90 + i)), cor: pick(CORES_CARRO, R(95 + i)) });
  }
  return { pecas: P, col, rets, carros };
}

// faixa de estrada fora da cidade (segue o terreno). eixo: 'x' (estrada ao longo de z, em x=0) ou 'z'
export function montarEstrada(ter, cx, cz) {
  const P = [];
  const ox = cx * TAM, oz = cz * TAM;
  const ao_longo_z = ox <= 0 && ox + TAM > 0; // pedaço que contém x=0
  const ao_longo_x = oz <= 0 && oz + TAM > 0;
  const tira = (eixoZ) => {
    const pos = [], cor = [], nor = [];
    const asf = new THREE.Color(ASFALTO), lin = new THREE.Color(LINHA);
    for (let t = 0; t < TAM; t += 3) {
      const a0 = (eixoZ ? oz : ox) + t, a1 = a0 + 3;
      const h0 = ter.alturaEstradaEm(a0) + 0.06, h1 = ter.alturaEstradaEm(a1) + 0.06;
      const quad = (w0, w1, c, dy = 0) => {
        const v = eixoZ
          ? [[w0, h0, a0], [w0, h1, a1], [w1, h1, a1], [w0, h0, a0], [w1, h1, a1], [w1, h0, a0]]
          : [[a0, h0, w0], [a0, h0, w1], [a1, h1, w1], [a0, h0, w0], [a1, h1, w1], [a1, h1, w0]];
        for (const p of v) { pos.push(p[0] - ox, p[1] + dy, p[2] - oz); cor.push(c.r, c.g, c.b); nor.push(0, 1, 0); }
      };
      quad(-5, 5, asf);
      if ((t / 3) % 2 === 0) quad(-0.1, 0.1, lin, 0.02);
    }
    P.push({ pos: new Float32Array(pos), nor: new Float32Array(nor), cor: new Float32Array(cor) });
  };
  if (ao_longo_z) tira(true);
  if (ao_longo_x) tira(false);
  return P;
}

// Escavar: cada toque arranca um pedaço do bloco (ele vai ficando esculpido) até quebrar de vez.
// O bloco atingido é escondido da malha do pedaço e trocado por uma malha de 3x3x3 cubinhos.
import * as THREE from '../vendor/three.module.min.js';
import { AR, B, BLOCOS, OPACO, uvTile } from './blocos.js';
import { BE } from './blocos-eras.js';

const N = 3;               // cubinhos por lado
const TOTAL = N * N * N;
const MAX_ESCAVADOS = 8;   // blocos meio quebrados ao mesmo tempo
const LONGE = 24;          // longe disso o bloco volta inteiro

// quantos toques cada bloco aguenta (dureza)
const DUREZA = {
  [B.FOLHAS]: 2, [B.VIDRO]: 2, [B.AREIA]: 3, [B.TERRA]: 3, [B.GRAMA]: 3, [B.LAMPIAO]: 3,
  [B.LA_BRANCA]: 3, [B.LA_VERMELHA]: 3, [B.LA_AZUL]: 3, [B.LA_AMARELA]: 3, [B.LA_VERDE]: 3, [B.LA_ROSA]: 3,
  [B.TABUAS]: 4, [B.BANCADA]: 4, [B.TRONCO]: 5, [B.PEDRISCO]: 5, [B.PEDRA]: 6, [B.TIJOLO]: 6,
  [B.CACTO]: 2, [B.CASCALHO]: 3,
  [B.FOLHAS_PINHEIRO]: 2, [B.FOLHAS_SELVA]: 2, [B.TRONCO_PINHEIRO]: 5, [B.TRONCO_BETULA]: 5,
  [B.CARVAO]: 7, [B.FERRO]: 8, [B.OURO]: 8, [B.DIAMANTE]: 10, [B.ROCHA_MAE]: 9999,
};
export const toquesPara = (b) => (BLOCOS[b].planta || BLOCOS[b].forma && BLOCOS[b].forma !== 'esteira' ? 1 : DUREZA[b] ?? 3);

// faces de um cubinho: normal, eixo, cantos (CCW de fora) e eixos U/V da textura (iguais aos da malha do mundo)
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], t: 2 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], t: 2 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], t: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], t: 1 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], t: 2 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], t: 2 },
];
for (const f of FACES) {
  const [a, b, , d] = f.c;
  f.o = a; f.U = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; f.V = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
}
const ci = (i, j, k) => i + j * N + k * N * N;

export class Escavacao {
  constructor(cena, mundo, material, atlasCanvas) {
    this.cena = cena; this.mundo = mundo; this.mat = material; this.atlas = atlasCanvas;
    this.blocos = new Map(); // "x,y,z" -> {x,y,z,b,vivos:Uint8Array,restam,toques,malha,ultimo}
    this.parts = [];
    this.geoP = new THREE.BoxGeometry(1, 1, 1);
    this.mats = new Map();
  }

  // um toque no bloco h (do raycast). p = ponto atingido no mundo. Retorna true se o bloco quebrou de vez.
  // total = quantos toques ele aguenta (menos com a ferramenta certa na mão; veja criacao.js)
  bater(h, p, total = toquesPara(h.b)) {
    const k = h.x + ',' + h.y + ',' + h.z;
    let e = this.blocos.get(k);
    if (e && e.b !== h.b) { this.soltar(k); e = null; }
    if (!e) {
      if (total <= 1) { this.estilhacar(h.x, h.y, h.z, h.b, null, h.n); this.mundo.definir(h.x, h.y, h.z, AR); return true; }
      if (this.blocos.size >= MAX_ESCAVADOS) this.soltar(this.maisAntigo());
      e = { x: h.x, y: h.y, z: h.z, b: h.b, vivos: new Uint8Array(TOTAL).fill(1), restam: TOTAL, toques: 0, malha: null };
      this.blocos.set(k, e);
      this.mundo.esconder(h.x, h.y, h.z, true);
    }
    e.toques++;
    e.ultimo = performance.now();
    if (e.toques >= total) {
      const sobra = [];
      for (let i = 0; i < TOTAL; i++) if (e.vivos[i]) sobra.push(i);
      this.estilhacar(e.x, e.y, e.z, e.b, sobra, h.n);
      this.soltar(k, true);
      return true;
    }
    // arranca os cubinhos mais perto do ponto atingido (o buraco vai afundando)
    const quantos = Math.round(TOTAL / total * (0.8 + Math.random() * 0.4));
    const lx = p.x - e.x, ly = p.y - e.y, lz = p.z - e.z;
    const cand = [];
    for (let kk = 0; kk < N; kk++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const id = ci(i, j, kk);
      if (!e.vivos[id]) continue;
      const dx = (i + 0.5) / N - lx, dy = (j + 0.5) / N - ly, dz = (kk + 0.5) / N - lz;
      cand.push([dx * dx + dy * dy + dz * dz + Math.random() * 0.04, id]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const tirar = cand.slice(0, Math.min(quantos, cand.length - 1)).map((c) => c[1]);
    for (const id of tirar) { e.vivos[id] = 0; e.restam--; }
    this.estilhacar(e.x, e.y, e.z, e.b, tirar, h.n);
    this.montar(e);
    return false;
  }

  maisAntigo() {
    let k0 = null, t0 = Infinity;
    for (const [k, e] of this.blocos) if (e.ultimo < t0) { t0 = e.ultimo; k0 = k; }
    return k0;
  }

  // tira a malha esculpida; o bloco volta para a malha do mundo (ou já virou ar)
  soltar(k, quebrou = false) {
    const e = this.blocos.get(k);
    if (!e) return;
    if (e.malha) { this.cena.remove(e.malha); e.malha.geometry.dispose(); }
    this.blocos.delete(k);
    this.mundo.esconder(e.x, e.y, e.z, false);
    if (quebrou) this.mundo.definir(e.x, e.y, e.z, AR);
  }

  montar(e) {
    const P = [], U = [], C = [], Nn = [], O = [], L = [], I = [];
    const def = BLOCOS[e.b];
    const lamp = e.b === B.LAMPIAO ? 1 : 0;
    const m = this.mundo;
    // faces de fora só aparecem se o vizinho do mundo não tapar
    const tapado = FACES.map((f) => OPACO[m.bloco(e.x + f.n[0], e.y + f.n[1], e.z + f.n[2])] && !m.escondido(e.x + f.n[0], e.y + f.n[1], e.z + f.n[2]));
    const s = 1 / N;
    for (let k = 0; k < N; k++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!e.vivos[ci(i, j, k)]) continue;
      FACES.forEach((f, fi) => {
        const ni = i + f.n[0], nj = j + f.n[1], nk = k + f.n[2];
        const dentro = ni >= 0 && ni < N && nj >= 0 && nj < N && nk >= 0 && nk < N;
        if (dentro && e.vivos[ci(ni, nj, nk)]) return;
        if (!dentro && tapado[fi]) return;
        // face de dentro (exposta pela escavação) usa a textura de baixo (terra na grama) e fica mais escura
        const tile = dentro && e.b === B.GRAMA ? def.tiles[1] : def.tiles[f.t];
        const [u0, v0, u1, v1] = uvTile(tile);
        const base = P.length / 3;
        const cor = dentro ? 0.72 : 1;
        for (const cn of f.c) {
          const px = (i + cn[0]) * s, py = (j + cn[1]) * s, pz = (k + cn[2]) * s;
          P.push(px, py, pz);
          const qx = px - f.o[0], qy = py - f.o[1], qz = pz - f.o[2];
          const a = qx * f.U[0] + qy * f.U[1] + qz * f.U[2];
          const b = qx * f.V[0] + qy * f.V[1] + qz * f.V[2];
          U.push(u0 + a * (u1 - u0), v0 + b * (v1 - v0));
          C.push(cor, cor, cor);
          Nn.push(f.n[0], f.n[1], f.n[2]);
          O.push(0); L.push(lamp);
        }
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    g.setAttribute('onda', new THREE.Float32BufferAttribute(O, 1));
    g.setAttribute('brilho', new THREE.Float32BufferAttribute(L, 1));
    g.setIndex(I);
    g.computeBoundingSphere();
    if (e.malha) { e.malha.geometry.dispose(); e.malha.geometry = g; return; }
    const malha = new THREE.Mesh(g, this.mat);
    malha.position.set(e.x, e.y, e.z);
    malha.castShadow = true; malha.receiveShadow = true;
    this.cena.add(malha);
    e.malha = malha;
  }

  // cor média de um pedaço da textura (para os fragmentos)
  corDe(b, tile, qi, qj) {
    const ch = b + ':' + tile + ':' + qi + ':' + qj;
    let mat = this.mats.get(ch);
    if (mat) return mat;
    const tx = (tile % 8) * 16 + Math.floor(qi * 16 / N), ty = Math.floor(tile / 8) * 16 + Math.floor(qj * 16 / N);
    const d = this.atlas.getContext('2d').getImageData(tx, ty, Math.ceil(16 / N), Math.ceil(16 / N)).data;
    let r = 0, g = 0, bb = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100) { r += d[i]; g += d[i + 1]; bb += d[i + 2]; n++; }
    n = n || 1;
    mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(`rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(bb / n)})`) });
    this.mats.set(ch, mat);
    return mat;
  }

  // pedaços voando (ids = cubinhos arrancados; null = bloco inteiro de planta)
  estilhacar(x, y, z, b, ids, n) {
    const def = BLOCOS[b];
    const lista = ids || [ci(1, 1, 1)];
    const tam = ids ? 1 / N : 0.5;
    for (const id of lista) {
      if (this.parts.length > 70) break;
      const i = id % N, j = Math.floor(id / N) % N, k = Math.floor(id / (N * N));
      const tile = j === N - 1 ? def.tiles[0] : def.tiles[2];
      const pecas = ids ? (Math.random() < 0.5 ? 2 : 1) : 6;
      for (let q = 0; q < pecas; q++) {
        const mesh = new THREE.Mesh(this.geoP, this.corDe(b, tile, (i + q) % N, N - 1 - j));
        const sz = tam * (0.2 + Math.random() * 0.25);
        mesh.scale.setScalar(sz);
        const cx = ids ? (i + 0.5) / N : 0.2 + Math.random() * 0.6;
        const cy = ids ? (j + 0.5) / N : 0.1 + Math.random() * 0.6;
        const cz = ids ? (k + 0.5) / N : 0.2 + Math.random() * 0.6;
        mesh.position.set(x + cx, y + cy, z + cz);
        mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        this.cena.add(mesh);
        const nx = n ? n[0] : 0, ny = n ? n[1] : 0, nz = n ? n[2] : 0;
        this.parts.push({
          m: mesh, sz,
          v: [nx * 2.2 + (cx - 0.5) * 3 + (Math.random() - 0.5) * 1.5, ny * 2 + 1.5 + Math.random() * 2.5, nz * 2.2 + (cz - 0.5) * 3 + (Math.random() - 0.5) * 1.5],
          gir: [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12],
          vida: 0.7 + Math.random() * 0.5,
        });
      }
    }
  }

  atualizar(dt, px, pz) {
    // pedaços caem, quicam no chão e somem encolhendo
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i], m = q.m;
      q.vida -= dt; q.v[1] -= 16 * dt;
      m.position.x += q.v[0] * dt; m.position.y += q.v[1] * dt; m.position.z += q.v[2] * dt;
      m.rotation.x += q.gir[0] * dt; m.rotation.y += q.gir[1] * dt;
      const b = this.mundo.bloco(Math.floor(m.position.x), Math.floor(m.position.y - q.sz / 2), Math.floor(m.position.z));
      if (q.v[1] < 0 && b !== AR && b !== B.AGUA && !BLOCOS[b].planta && !this.mundo.escondido(Math.floor(m.position.x), Math.floor(m.position.y - q.sz / 2), Math.floor(m.position.z))) {
        m.position.y = Math.floor(m.position.y - q.sz / 2) + 1 + q.sz / 2;
        q.v[1] *= -0.3; q.v[0] *= 0.6; q.v[2] *= 0.6; q.gir[0] *= 0.5; q.gir[1] *= 0.5;
      }
      if (q.vida < 0.25) m.scale.setScalar(q.sz * Math.max(0.01, q.vida / 0.25));
      if (q.vida <= 0) { this.cena.remove(m); this.parts.splice(i, 1); }
    }
    // bloco mudou por outro jogador / longe demais: volta ao normal
    for (const [k, e] of this.blocos) {
      if (this.mundo.bloco(e.x, e.y, e.z) !== e.b || Math.abs(e.x - px) > LONGE || Math.abs(e.z - pz) > LONGE) this.soltar(k);
    }
  }
}

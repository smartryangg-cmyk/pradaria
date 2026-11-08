// Física dos blocos: areia e pedrisco caem, folhas sem árvore caem, grama coberta vira terra
// e terra descoberta volta a ficar verde. Tudo começa por mudanças feitas NESTE aparelho
// (o resultado vai pela rede como edições comuns, então os amigos veem o mesmo).
import * as THREE from '../vendor/three.module.min.js';
import { AR, B, BLOCOS, SOLIDO, OPACO, PLANTA, AGUA, uvTile } from './blocos.js';

export const CAI = new Uint8Array(256);
CAI[B.AREIA] = 1; CAI[B.PEDRISCO] = 1; CAI[B.CASCALHO] = 1;
const TRONCO = new Uint8Array(256), FOLHA = new Uint8Array(256);
TRONCO[B.TRONCO] = TRONCO[B.TRONCO_PINHEIRO] = TRONCO[B.TRONCO_BETULA] = 1;
FOLHA[B.FOLHAS] = FOLHA[B.FOLHAS_PINHEIRO] = FOLHA[B.FOLHAS_SELVA] = 1;

const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], t: 2 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], t: 2 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], t: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], t: 1 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], t: 2 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], t: 2 },
];

// cubo com a textura do bloco (centrado na origem)
function geometriaBloco(b) {
  const P = [], U = [], C = [], N = [], O = [], L = [], I = [];
  for (const f of FACES) {
    const [u0, v0, u1, v1] = uvTile(BLOCOS[b].tiles[f.t]);
    const k = P.length / 3;
    for (const c of f.c) { P.push(c[0] - 0.5, c[1] - 0.5, c[2] - 0.5); C.push(1, 1, 1); N.push(...f.n); O.push(0); L.push(0); }
    U.push(u0, v0, u1, v0, u1, v1, u0, v1);
    I.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('onda', new THREE.Float32BufferAttribute(O, 1));
  g.setAttribute('brilho', new THREE.Float32BufferAttribute(L, 1));
  g.setIndex(I);
  return g;
}

const vazio = (b) => b === AR || AGUA[b] || PLANTA[b];

export class Fisica {
  constructor(cena, mundo, material) {
    this.cena = cena; this.mundo = mundo; this.mat = material;
    this.agenda = [];         // {t, chave, fn}
    this.chaves = new Set();  // evita agendar a mesma coisa duas vezes
    this.caindo = [];         // blocos em queda {m, b, v}
    this.geos = new Map();
    this.relogio = 0;
    this.aoCair = null;       // som ao pousar
    this.aoFolha = null;      // partículas quando a folha some
  }

  depois(seg, chave, fn) {
    if (chave && this.chaves.has(chave)) return;
    if (chave) this.chaves.add(chave);
    this.agenda.push({ t: this.relogio + seg, chave, fn });
  }

  // chamado quando um bloco muda por ação deste aparelho
  mudou(x, y, z, b) {
    const m = this.mundo;
    // tirou o apoio: o que estiver em cima e cair, cai
    if (!SOLIDO[b] && CAI[m.bloco(x, y + 1, z)]) this.queda(x, y + 1, z);
    // colocou areia/pedrisco no ar
    if (CAI[b] && vazio(m.bloco(x, y - 1, z))) this.queda(x, y, z);
    // cobriu a grama: vira terra (sem luz)
    if (OPACO[b] && m.bloco(x, y - 1, z) === B.GRAMA) {
      this.depois(1.5 + Math.random(), 'g' + x + ',' + (y - 1) + ',' + z, () => {
        if (OPACO[m.bloco(x, y, z)] && m.bloco(x, y - 1, z) === B.GRAMA) m.definir(x, y - 1, z, B.TERRA);
      });
    }
    // descobriu terra: a grama do lado vai crescendo por cima
    if (!OPACO[b] && m.bloco(x, y - 1, z) === B.TERRA) this.crescer(x, y - 1, z);
    if (b === B.GRAMA) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let dy = -1; dy <= 1; dy++) {
      if (m.bloco(x + dx, y + dy, z + dz) === B.TERRA) this.crescer(x + dx, y + dy, z + dz);
    }
    // cortou tronco (ou folha): folhas longe de qualquer tronco caem
    if (b === AR) this.conferirFolhas(x, y, z);
  }

  queda(x, y, z) {
    this.depois(0.12, 'q' + x + ',' + y + ',' + z, () => {
      const m = this.mundo, b = m.bloco(x, y, z);
      if (!CAI[b] || !vazio(m.bloco(x, y - 1, z))) return;
      m.definir(x, y, z, AR); // isso também derruba o que estiver em cima
      let geo = this.geos.get(b);
      if (!geo) { geo = geometriaBloco(b); this.geos.set(b, geo); }
      const malha = new THREE.Mesh(geo, this.mat);
      malha.position.set(x + 0.5, y + 0.5, z + 0.5);
      malha.castShadow = true; malha.receiveShadow = true;
      this.cena.add(malha);
      this.caindo.push({ m: malha, b, x, z, v: 0 });
    });
  }

  crescer(x, y, z) {
    const m = this.mundo;
    this.depois(6 + Math.random() * 12, 'c' + x + ',' + y + ',' + z, () => {
      if (m.bloco(x, y, z) !== B.TERRA || OPACO[m.bloco(x, y + 1, z)] || AGUA[m.bloco(x, y + 1, z)]) return;
      let perto = false;
      for (let dx = -1; dx <= 1 && !perto; dx++) for (let dz = -1; dz <= 1 && !perto; dz++) for (let dy = -1; dy <= 1; dy++) {
        if ((dx || dz) && m.bloco(x + dx, y + dy, z + dz) === B.GRAMA) { perto = true; break; }
      }
      if (perto) m.definir(x, y, z, B.GRAMA); // definir(GRAMA) chama mudou -> espalha para a terra vizinha
    });
  }

  // folhas "da natureza" sem tronco a até 4 passos (por folhas) caem aos poucos.
  // Folhas que o jogador colocou nunca caem (dá para construir com elas).
  conferirFolhas(x0, y0, z0) {
    const m = this.mundo, R = 5, A = 9;
    let tem = false;
    for (let dy = -1; dy <= 1 && !tem; dy++) for (let dx = -1; dx <= 1 && !tem; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (FOLHA[m.bloco(x0 + dx, y0 + dy, z0 + dz)]) { tem = true; break; }
    }
    if (!tem) return;
    this.depois(0.6, 'f' + x0 + ',' + y0 + ',' + z0, () => {
      // espalha a partir dos troncos da região, atravessando folhas, até 4 passos
      const ok = new Map(), fila = [];
      for (let dx = -A; dx <= A; dx++) for (let dz = -A; dz <= A; dz++) for (let dy = -A; dy <= A; dy++) {
        const x = x0 + dx, y = y0 + dy, z = z0 + dz;
        if (TRONCO[m.bloco(x, y, z)]) { const k = x + ',' + y + ',' + z; ok.set(k, 0); fila.push([x, y, z, 0]); }
      }
      while (fila.length) {
        const [x, y, z, d] = fila.shift();
        if (d >= 4) continue;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const nx = x + dx, ny = y + dy, nz = z + dz, k = nx + ',' + ny + ',' + nz;
          if (ok.has(k) || !FOLHA[m.bloco(nx, ny, nz)]) continue;
          ok.set(k, d + 1); fila.push([nx, ny, nz, d + 1]);
        }
      }
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) {
        const x = x0 + dx, y = y0 + dy, z = z0 + dz;
        const fb = m.bloco(x, y, z);
        if (!FOLHA[fb] || ok.has(x + ',' + y + ',' + z) || m.editado(x, y, z)) continue;
        this.depois(0.4 + Math.random() * 3.5, 'F' + x + ',' + y + ',' + z, () => {
          if (m.bloco(x, y, z) !== fb) return;
          m.definir(x, y, z, AR);
          this.aoFolha && this.aoFolha(x, y, z, fb);
        });
      }
    });
  }

  atualizar(dt) {
    this.relogio += dt;
    if (this.agenda.length) {
      const prontos = [];
      this.agenda = this.agenda.filter((a) => (a.t <= this.relogio ? (prontos.push(a), false) : true));
      for (const a of prontos) { if (a.chave) this.chaves.delete(a.chave); a.fn(); }
    }
    const m = this.mundo;
    for (let i = this.caindo.length - 1; i >= 0; i--) {
      const c = this.caindo[i];
      c.v = Math.min(c.v + 22 * dt, 30);
      const novoY = c.m.position.y - c.v * dt;
      const base = Math.floor(novoY - 0.5); // célula onde a parte de baixo está entrando
      if (base < 1 || !vazio(m.bloco(c.x, base, c.z))) {
        let y = Math.max(1, base + 1);
        while (y < 63 && !vazio(m.bloco(c.x, y, c.z))) y++; // caiu em cima de outro que acabou de pousar
        this.cena.remove(c.m);
        this.caindo.splice(i, 1);
        if (vazio(m.bloco(c.x, y, c.z))) m.definir(c.x, y, c.z, c.b);
        this.aoCair && this.aoCair(c.x, y, c.z, c.b);
        continue;
      }
      c.m.position.y = novoY;
    }
  }

  limpar() {
    for (const c of this.caindo) this.cena.remove(c.m);
    this.caindo = []; this.agenda = []; this.chaves.clear();
  }
}

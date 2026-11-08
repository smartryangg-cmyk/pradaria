// Mundo em pedaços (chunks) de 16x16x64: geração do terreno, edições e montagem das malhas.
import * as THREE from '../vendor/three.module.min.js';
import { criarRuido, hash3 } from './ruido.js';
import { AR, B, SOLIDO, OPACO, PLANTA, BLOCOS, uvTile } from './blocos.js';

export const CX = 16, CZ = 16, ALT = 64;
export const NIVEL_AGUA = 20;
const idx = (x, y, z) => x + z * CX + y * CX * CZ;
const chave = (cx, cz) => cx + ',' + cz;

// faces: normal, 4 cantos (CCW de fora), sombra
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.8, t: 2 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.8, t: 2 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, t: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, t: 1 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.65, t: 2 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.65, t: 2 },
];
const AO = [0.45, 0.65, 0.82, 1];

export class Mundo {
  constructor(cena, material, materialAgua, semente) {
    this.cena = cena;
    this.mat = material;
    this.matAgua = materialAgua;
    this.semente = semente;
    this.ruido = criarRuido(semente);
    this.ruido2 = criarRuido(semente + 1013);
    this.chunks = new Map();
    this.edicoes = new Map(); // chave chunk -> Map(idx -> bloco)
    this.fila = [];
    this.raio = 3;
    this.aoMudarBloco = null;
  }

  // ---------- geração ----------
  alturaEm(x, z) {
    const r = this.ruido, r2 = this.ruido2;
    const cont = r.fbm(x / 240, z / 240, 3);
    const det = r.fbm(x / 55, z / 55, 3);
    const morro = Math.max(0, r2.fbm(x / 130 + 100, z / 130 - 50, 3));
    return Math.floor(24 + cont * 9 + det * 4 + morro * morro * 40);
  }

  gerarDados(cx, cz) {
    const d = new Uint8Array(CX * CZ * ALT);
    const s = this.semente;
    const alturas = new Int16Array(CX * CZ);
    for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const wx = cx * CX + x, wz = cz * CZ + z;
      const h = Math.min(ALT - 10, Math.max(4, this.alturaEm(wx, wz)));
      alturas[x + z * CX] = h;
      const praia = h <= NIVEL_AGUA + 1;
      for (let y = 0; y <= Math.max(h, NIVEL_AGUA); y++) {
        let b = AR;
        if (y === 0) b = B.PEDRA;
        else if (y < h - 3) b = B.PEDRA;
        else if (y < h) b = praia ? B.AREIA : B.TERRA;
        else if (y === h) b = praia ? B.AREIA : (h > 48 ? B.PEDRA : B.GRAMA);
        else if (y <= NIVEL_AGUA) b = B.AGUA;
        d[idx(x, y, z)] = b;
      }
    }
    // decoração: árvores, flores e capim
    for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const h = alturas[x + z * CX];
      if (d[idx(x, h, z)] !== B.GRAMA) continue;
      const wx = cx * CX + x, wz = cz * CZ + z;
      const rnd = hash3(wx, 7, wz, s);
      const floresta = this.ruido2.fbm(wx / 90 + 300, wz / 90 - 200, 2);
      const chanceArvore = floresta > 0.18 ? 0.035 : 0.004;
      if (rnd < chanceArvore && x >= 2 && x <= 13 && z >= 2 && z <= 13 && h + 8 < ALT) {
        this.arvore(d, x, h + 1, z, hash3(wx, 3, wz, s));
        continue;
      }
      const r2 = hash3(wx, 11, wz, s);
      const prado = floresta < -0.25;
      if (r2 < (prado ? 0.1 : 0.025)) {
        const t = hash3(wx, 19, wz, s);
        d[idx(x, h + 1, z)] = t < 0.4 ? B.FLOR_VERMELHA : t < 0.75 ? B.FLOR_AMARELA : B.FLOR_AZUL;
      } else if (r2 < 0.2) d[idx(x, h + 1, z)] = B.CAPIM;
    }
    // edições salvas
    const ed = this.edicoes.get(chave(cx, cz));
    if (ed) for (const [i, b] of ed) d[i] = b;
    return d;
  }

  arvore(d, x, y, z, r) {
    const alt = 4 + Math.floor(r * 2);
    for (let i = 0; i < alt; i++) d[idx(x, y + i, z)] = B.TRONCO;
    const topo = y + alt;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy < 0 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
        const yy = topo + dy;
        const i = idx(x + dx, yy, z + dz);
        if (d[i] === AR || PLANTA[d[i]]) d[i] = B.FOLHAS;
      }
    }
  }

  // ---------- acesso ----------
  pegarChunk(cx, cz, criar = true) {
    const k = chave(cx, cz);
    let c = this.chunks.get(k);
    if (!c && criar) {
      c = { cx, cz, dados: this.gerarDados(cx, cz), malha: null, agua: null, sujo: true };
      this.chunks.set(k, c);
    }
    return c;
  }

  bloco(x, y, z) {
    if (y < 0) return B.PEDRA;
    if (y >= ALT) return AR;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.pegarChunk(cx, cz);
    return c.dados[idx(x - cx * CX, y, z - cz * CZ)];
  }

  // altura do chão (primeiro bloco sólido de cima para baixo)
  chao(x, z) {
    for (let y = ALT - 1; y > 0; y--) if (SOLIDO[this.bloco(x, y, z)] || this.bloco(x, y, z) === B.AGUA) return y;
    return 0;
  }

  // muda um bloco (local ou vindo da rede). Retorna true se mudou.
  definir(x, y, z, b, daRede = false) {
    if (y < 1 || y >= ALT) return false;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.pegarChunk(cx, cz);
    const lx = x - cx * CX, lz = z - cz * CZ;
    const i = idx(lx, y, lz);
    if (c.dados[i] === b) return false;
    c.dados[i] = b;
    const k = chave(cx, cz);
    if (!this.edicoes.has(k)) this.edicoes.set(k, new Map());
    this.edicoes.get(k).set(i, b);
    this.marcarSujo(cx, cz);
    if (lx === 0) this.marcarSujo(cx - 1, cz);
    if (lx === CX - 1) this.marcarSujo(cx + 1, cz);
    if (lz === 0) this.marcarSujo(cx, cz - 1);
    if (lz === CZ - 1) this.marcarSujo(cx, cz + 1);
    // planta sem chão some
    if (!SOLIDO[b] && PLANTA[this.bloco(x, y + 1, z)]) this.definir(x, y + 1, z, AR, daRede);
    if (!daRede && this.aoMudarBloco) this.aoMudarBloco(x, y, z, b);
    return true;
  }

  marcarSujo(cx, cz) {
    const c = this.chunks.get(chave(cx, cz));
    if (c && c.malha !== undefined) { c.sujo = true; c.prioridade = true; }
  }

  // aplica uma lista de edições [x,y,z,b] (ex.: vindas do servidor) antes de gerar
  carregarEdicoes(lista) {
    for (const [x, y, z, b] of lista) {
      const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
      const k = chave(cx, cz);
      if (!this.edicoes.has(k)) this.edicoes.set(k, new Map());
      this.edicoes.get(k).set(idx(x - cx * CX, y, z - cz * CZ), b);
      const c = this.chunks.get(k);
      if (c) { c.dados[idx(x - cx * CX, y, z - cz * CZ)] = b; c.sujo = true; }
    }
  }

  listarEdicoes() {
    const out = [];
    for (const [k, m] of this.edicoes) {
      const [cx, cz] = k.split(',').map(Number);
      for (const [i, b] of m) {
        const x = i % CX, z = Math.floor(i / CX) % CZ, y = Math.floor(i / (CX * CZ));
        out.push([cx * CX + x, y, cz * CZ + z, b]);
      }
    }
    return out;
  }

  // ---------- malhas ----------
  construir(c) {
    const P = [], U = [], C = [], I = [], N = [], O = [], L = [];
    const luzes = [];
    const PA = [], UA = [], CA = [], IA = [];
    const d = c.dados;
    const ox = c.cx * CX, oz = c.cz * CZ;
    // vizinhos (para bordas)
    const viz = {
      '1,0': this.pegarChunk(c.cx + 1, c.cz).dados, '-1,0': this.pegarChunk(c.cx - 1, c.cz).dados,
      '0,1': this.pegarChunk(c.cx, c.cz + 1).dados, '0,-1': this.pegarChunk(c.cx, c.cz - 1).dados,
    };
    const get = (x, y, z) => {
      if (y < 0) return B.PEDRA;
      if (y >= ALT) return AR;
      if (x >= 0 && x < CX && z >= 0 && z < CZ) return d[idx(x, y, z)];
      const dx = x < 0 ? -1 : x >= CX ? 1 : 0, dz = z < 0 ? -1 : z >= CZ ? 1 : 0;
      if (dx && dz) return this.bloco(ox + x, y, oz + z);
      return viz[dx + ',' + dz][idx(x - dx * CX, y, z - dz * CZ)];
    };

    let topo = 0;
    for (let i = d.length - 1; i >= 0; i--) if (d[i]) { topo = Math.floor(i / (CX * CZ)); break; }

    for (let y = 0; y <= topo; y++) for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const b = d[idx(x, y, z)];
      if (b === AR) continue;
      const def = BLOCOS[b];
      if (b === B.LAMPIAO) luzes.push([ox + x + 0.5, y + 0.5, oz + z + 0.5]);
      if (def.planta) {
        const [u0, v0, u1, v1] = uvTile(def.tiles[0]);
        const base = P.length / 3;
        const q = [[0.15, 0.15, 0.85, 0.85], [0.15, 0.85, 0.85, 0.15]];
        for (const [ax, az, bx, bz] of q) {
          const k = P.length / 3;
          P.push(x + ax, y, z + az, x + bx, y, z + bz, x + bx, y + 0.9, z + bz, x + ax, y + 0.9, z + az);
          U.push(u0, v0, u1, v0, u1, v1, u0, v1);
          for (let n = 0; n < 4; n++) { C.push(0.95, 0.95, 0.95); N.push(0, 1, 0); L.push(0); }
          O.push(0, 0, 1, 1); // só o topo da plantinha balança
          I.push(k, k + 1, k + 2, k, k + 2, k + 3, k, k + 2, k + 1, k, k + 3, k + 2);
        }
        void base;
        continue;
      }
      const agua = def.agua;
      for (const f of FACES) {
        const nb = get(x + f.n[0], y + f.n[1], z + f.n[2]);
        if (agua) {
          if (nb === B.AGUA || OPACO[nb]) continue;
        } else {
          if (OPACO[nb] || nb === b) continue;
        }
        const [u0, v0, u1, v1] = uvTile(def.tiles[f.t]);
        const PP = agua ? PA : P, UU = agua ? UA : U, CC = agua ? CA : C, II = agua ? IA : I;
        const k = PP.length / 3;
        const aos = [];
        for (const cn of f.c) {
          let py = y + cn[1];
          if (agua && cn[1] === 1 && get(x, y + 1, z) !== B.AGUA) py -= 0.12;
          PP.push(x + cn[0], py, z + cn[2]);
          let ao = 3;
          if (!agua) {
            // AO: dois lados e canto na camada da face
            const sx = [0, 0, 0];
            const lados = [];
            for (let a = 0; a < 3; a++) if (f.n[a] === 0) { const v = [0, 0, 0]; v[a] = cn[a] ? 1 : -1; lados.push(v); sx[a] = v[a]; }
            const bx = x + f.n[0], by = y + f.n[1], bz = z + f.n[2];
            const s1 = OPACO[get(bx + lados[0][0], by + lados[0][1], bz + lados[0][2])];
            const s2 = OPACO[get(bx + lados[1][0], by + lados[1][1], bz + lados[1][2])];
            const cc = OPACO[get(bx + sx[0], by + sx[1], bz + sx[2])];
            ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
          }
          aos.push(ao);
          if (agua) { CC.push(1, 1, 1); continue; }
          const v = AO[ao];
          CC.push(v, v, v);
          N.push(f.n[0], f.n[1], f.n[2]);
          O.push(b === B.FOLHAS ? 0.6 : 0);
          L.push(b === B.LAMPIAO ? 1 : 0);
        }
        UU.push(u0, v0, u1, v0, u1, v1, u0, v1);
        // vira a diagonal para o AO ficar suave
        if (aos[0] + aos[2] < aos[1] + aos[3]) II.push(k, k + 1, k + 3, k + 1, k + 2, k + 3);
        else II.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
    }

    const fazer = (P, U, C, I, mat, antiga, extra) => {
      if (antiga) { this.cena.remove(antiga); antiga.geometry.dispose(); }
      if (!I.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      if (extra) {
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('onda', new THREE.Float32BufferAttribute(O, 1));
        g.setAttribute('brilho', new THREE.Float32BufferAttribute(L, 1));
      }
      g.setIndex(P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.position.set(ox, 0, oz);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      if (extra) { m.castShadow = true; m.receiveShadow = true; }
      this.cena.add(m);
      return m;
    };
    c.malha = fazer(P, U, C, I, this.mat, c.malha, true);
    c.luzes = luzes;
    c.agua = fazer(PA, UA, CA, IA, this.matAgua, c.agua);
    if (c.agua) c.agua.renderOrder = 1;
    c.sujo = false;
    c.prioridade = false;
    c.temMalha = true;
  }

  // chamado a cada quadro: carrega/descarrega pedaços perto do jogador
  atualizar(px, pz, orcamentoMs = 6) {
    const pcx = Math.floor(px / CX), pcz = Math.floor(pz / CZ);
    const R = this.raio;
    const ini = performance.now();
    // primeiro os pedaços editados (resposta imediata ao colocar/quebrar)
    for (const c of this.chunks.values()) {
      if (c.prioridade && c.temMalha) this.construir(c);
    }
    const pend = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > R * R + 1) continue;
      const c = this.pegarChunk(pcx + dx, pcz + dz);
      if (c.sujo) pend.push([dx * dx + dz * dz, c]);
    }
    pend.sort((a, b) => a[0] - b[0]);
    for (const [, c] of pend) {
      this.construir(c);
      if (performance.now() - ini > orcamentoMs) break;
    }
    // descarregar longe
    for (const [k, c] of this.chunks) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      const d2 = dx * dx + dz * dz;
      if (c.temMalha && d2 > (R + 2) * (R + 2)) {
        for (const m of [c.malha, c.agua]) if (m) { this.cena.remove(m); m.geometry.dispose(); }
        c.malha = c.agua = null; c.temMalha = false; c.sujo = true;
      }
      if (d2 > (R + 5) * (R + 5)) this.chunks.delete(k);
    }
    return pend.length;
  }

  // raio (DDA) a partir da câmera: retorna bloco atingido e a face
  raycast(o, dir, max = 6) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx;
    let ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy;
    let tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
    let n = [0, 0, 0], t = 0;
    while (t <= max) {
      const b = this.bloco(x, y, z);
      if (b !== AR && b !== B.AGUA) return { x, y, z, b, n, t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  }
}

// Itens no chão (drops): o que cai ao quebrar, a lã/carne/couro dos bichos e o que o jogador larga.
// Aparecem girando e pulando de leve, caem com gravidade, boiam na água e somem depois de uns minutos.
// Passou perto, pega (vai para a mochila). As regras ficam em regras-chao.js; online quem decide é a sala.
//
// Bichos (lã, caça) mandam pela economia um evento com x, y, z: o que sai cai no chão (economia.js r.cai).
// Mensagens da sala: chao-pegar / chao-largar (daqui) e chao / chao-pegou (de lá).
// ('pegar'/'pegou' sem "chao-" são das armas.)
import * as THREE from '../vendor/three.module.min.js';
import { BLOCOS, SOLIDO, AGUA, uvTile, ITENS, ehItem } from './blocos.js';
import { Chao, publico, podePegar, VIDA_CHAO, podeNoChao } from './regras-chao.js';
import { temMochila } from './economia.js';

const LADO = 0.3;           // cubinho de bloco
const PLANO = 0.46;         // item/planta (dois planos cruzados)
const PEGA_H = 1.5;         // distância para pegar (no chão, em volta do jogador)
const GRAVIDADE = 18;
const PISCA = 10000;        // pisca nos últimos 10 s antes de sumir

// faces de um cubo (mesma ordem/UV da malha do mundo: t = 0 cima, 1 baixo, 2 lados)
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], t: 2 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], t: 2 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], t: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], t: 1 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], t: 2 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], t: 2 },
];

// desenha como plano (ferramentas, plantas, fios...) ou como cubinho
const plano = (id) => {
  if (ehItem(id)) return true;
  const b = BLOCOS[id];
  return !b || b.planta || b.agua || b.icone !== null || b.forma === 'fio' || b.forma === 'placa';
};
const tileDe = (id) => (ehItem(id) ? (ITENS[id] ? ITENS[id].tile : 0) : BLOCOS[id].icone ?? BLOCOS[id].tiles[2]);

function geometria(P, U, Nn, I, brilho) {
  const g = new THREE.BufferGeometry();
  const n = P.length / 3;
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
  g.setAttribute('onda', new THREE.Float32BufferAttribute(new Array(n).fill(0), 1));
  g.setAttribute('brilho', new THREE.Float32BufferAttribute(new Array(n).fill(brilho), 1));
  g.setAttribute('borda', new THREE.Float32BufferAttribute(new Array(n).fill(0), 1));
  g.setIndex(I);
  g.computeBoundingSphere();
  return g;
}

function geoCubo(id) {
  const def = BLOCOS[id];
  const P = [], U = [], Nn = [], I = [];
  for (const f of FACES) {
    const [a, b, , d] = f.c;
    const Ue = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], Ve = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const [u0, v0, u1, v1] = uvTile(def.tiles[f.t]);
    const base = P.length / 3;
    for (const c of f.c) {
      P.push((c[0] - 0.5) * LADO, c[1] * LADO, (c[2] - 0.5) * LADO);
      const qx = c[0] - a[0], qy = c[1] - a[1], qz = c[2] - a[2];
      U.push(u0 + (qx * Ue[0] + qy * Ue[1] + qz * Ue[2]) * (u1 - u0), v0 + (qx * Ve[0] + qy * Ve[1] + qz * Ve[2]) * (v1 - v0));
      Nn.push(...f.n);
    }
    I.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return geometria(P, U, Nn, I, def.brilho ? 1 : 0);
}

// dois planos cruzados, com frente e verso (o material do mundo só desenha a frente)
function geoPlano(id) {
  const [u0, v0, u1, v1] = uvTile(tileDe(id));
  const P = [], U = [], Nn = [], I = [];
  const h = PLANO / 2;
  for (const [dx, dz] of [[1, 0], [0, 1]]) {
    for (const lado of [1, -1]) {
      const base = P.length / 3;
      const cantos = [[-h, 0], [h, 0], [h, PLANO], [-h, PLANO]];
      const ordem = lado > 0 ? [0, 1, 2, 3] : [1, 0, 3, 2];
      for (const k of ordem) {
        const [s, y] = cantos[k];
        P.push(s * dx, y, s * dz);
        U.push(k === 0 || k === 3 ? u0 : u1, k < 2 ? v0 : v1);
        Nn.push(-dz * lado, 0, dx * lado);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  return geometria(P, U, Nn, I, 0);
}

export class Drops {
  // ui: { mochila (Mercado), pegou(id, n), cheio(id), som }
  constructor(cena, mat, ui) {
    this.cena = cena; this.mat = mat; this.ui = ui;
    this.vivos = new Map();   // i -> { i, id, n, x, y, z, v, t, dono, grupo, malha, fase, parado }
    this.voando = [];         // indo para a mão de quem pegou
    this.geos = new Map();
    this.chao = new Chao();   // sem internet o jogo mesmo guarda
    this.mundo = null; this.sala = null; this.eu = 'eu';
    this.recusados = new Map(); // i -> até quando não tentar de novo (a sala disse não)
    this.cheioEm = 0;
  }

  get ativo() { return !!this.mundo && temMochila(this.ui.mochila.op); }

  usarMundo(mundo) { this.limpar(); this.mundo = mundo; this.sala = null; this.eu = 'eu'; this.chao = new Chao(); }
  // online: a sala manda a lista do que está no chão (ao entrar e ao reconectar)
  ligarSala(sala, eu, lista = []) {
    this.sala = sala; this.eu = eu;
    const tem = new Set(lista.map((d) => d.i));
    for (const i of [...this.vivos.keys()]) if (!tem.has(i)) this.sumir(i);
    for (const d of lista) this.aparecer(d);
  }
  limpar() {
    for (const i of [...this.vivos.keys()]) this.sumir(i);
    for (const f of this.voando) this.cena.remove(f.grupo);
    this.voando = [];
    this.recusados.clear();
  }

  geo(id) {
    let g = this.geos.get(id);
    if (!g) { g = plano(id) ? geoPlano(id) : geoCubo(id); this.geos.set(id, g); }
    return g;
  }

  // um item (formato de regras-chao.js publico()) aparece no mundo
  aparecer(p) {
    if (!podeNoChao(p.id, p.n)) return;
    const velho = this.vivos.get(p.i);
    if (velho) return;
    const grupo = new THREE.Group();
    const malha = new THREE.Group();
    const g = this.geo(p.id);
    // pilha: mostra 1, 2 ou 3 cópias
    const copias = p.n >= 16 ? 3 : p.n > 1 ? 2 : 1;
    for (let k = 0; k < copias; k++) {
      const m = new THREE.Mesh(g, this.mat);
      m.position.set(k * 0.07, k * 0.05, -k * 0.06);
      m.castShadow = true;
      malha.add(m);
    }
    grupo.add(malha);
    grupo.position.set(p.x, p.y, p.z);
    this.cena.add(grupo);
    const e = {
      i: p.i, id: p.id, n: p.n, x: p.x, y: p.y, z: p.z, v: [...(p.v || [0, 0, 0])],
      t: Date.now() - (p.idade || 0), dono: p.dono || '', c: p.c || 0, grupo, malha, fase: Math.random() * 6, parado: false,
    };
    this.vivos.set(p.i, e);
    const r = this.recusados.get(p.i);
    if (r) e.esperar = r;
  }

  // tira da tela (para = posição de quem pegou: o item voa até lá)
  sumir(i, para) {
    const e = this.vivos.get(i);
    if (!e) return;
    this.vivos.delete(i);
    if (para) this.voando.push({ grupo: e.grupo, de: e.grupo.position.clone(), para, t: 0 });
    else this.cena.remove(e.grupo);
  }

  // ---------- pôr no chão ----------
  // sem internet: o que caiu (bloco quebrado, lã, caça; economia.js r.cai: [[id, n, comprados]]); online a sala manda
  cair(cai, x, y, z) {
    if (this.sala || !this.ativo) return;
    for (const [id, n, c] of cai) this.novoLocal(id, n, x, y, z, null, '', c);
  }
  novoLocal(id, n, x, y, z, v, dono = '', c = 0) {
    const d = this.chao.novo(id, n, x, y, z, v || [(Math.random() - 0.5) * 2.4, 3.2, (Math.random() - 0.5) * 2.4], dono, Date.now(), null, c);
    if (!d) return false;
    for (const f of this.chao.limpar()) this.sumir(f.i);
    if (this.chao.itens.has(d.i)) this.aparecer(publico(d));
    return true;
  }
  // larga da mochila na frente do jogador (jogado para onde ele olha: dá para passar para um amigo)
  largar(id, n, jog) {
    if (!this.ativo || !podeNoChao(id, n)) return false;
    const r = this.ui.mochila.mexer({ t: 'largar', id, n });
    if (!r) return false;
    const cp = Math.cos(jog.pitch);
    const v = [-Math.sin(jog.yaw) * cp * 4.5, 2.2 + Math.sin(jog.pitch) * 3, -Math.cos(jog.yaw) * cp * 4.5].map((c) => Math.round(c * 100) / 100);
    if (this.sala) this.sala.enviar({ t: 'chao-largar', id, n, v });
    else this.novoLocal(id, n, jog.pos.x - Math.sin(jog.yaw) * 0.6, jog.pos.y + 1.2, jog.pos.z - Math.cos(jog.yaw) * 0.6, v, this.eu, r.c);
    return true;
  }

  // ---------- mensagens da sala ----------
  recebeuChao(lista) { for (const d of lista || []) this.aparecer(d); }
  // alguém pegou (ou sumiu): voa até a pessoa, se der para ver
  recebeuPegou(m, posDe) {
    if (!this.vivos.has(m.i)) return;
    const p = m.j ? posDe(m.j) : null;
    this.sumir(m.i, p);
  }

  // ---------- a cada quadro ----------
  quadro(dt, jog, podePegarAgora) {
    if (!this.mundo) return;
    const agora = Date.now();
    const seg = performance.now() / 1000;
    for (const e of [...this.vivos.values()]) {
      // sem internet o jogo some com os velhos; online a sala avisa (mas some daqui também, por garantia)
      if (agora - e.t > VIDA_CHAO + (this.sala ? 5000 : 0)) { if (!this.sala) this.chao.tirar(e.i); this.sumir(e.i); continue; }
      this.fisica(e, dt);
      e.grupo.position.set(e.x, e.y, e.z);
      e.malha.rotation.y += dt * 1.8;
      e.malha.position.y = 0.06 + Math.sin(seg * 2.6 + e.fase) * 0.05;
      e.grupo.visible = agora - e.t < VIDA_CHAO - PISCA || Math.floor(seg * 6) % 2 === 0;
      if (podePegarAgora && jog) this.talvezPegar(e, jog, agora);
    }
    for (let k = this.voando.length - 1; k >= 0; k--) {
      const f = this.voando[k];
      f.t += dt / 0.22;
      const alvo = typeof f.para === 'function' ? f.para() : f.para;
      f.grupo.position.lerpVectors(f.de, alvo, Math.min(1, f.t));
      f.grupo.scale.setScalar(Math.max(0.2, 1 - f.t * 0.6));
      if (f.t >= 1) { this.cena.remove(f.grupo); this.voando.splice(k, 1); }
    }
  }

  // cair, escorregar, quicar e boiar (só desenho; cada aparelho faz a sua)
  fisica(e, dt) {
    const m = this.mundo;
    const bl = (x, y, z) => m.bloco(Math.floor(x), Math.floor(y), Math.floor(z));
    // ficou preso dentro de um bloco (colocaram em cima): sobe
    if (SOLIDO[bl(e.x, e.y + 0.05, e.z)]) { e.y = Math.floor(e.y + 0.05) + 1; e.v[1] = 0; e.parado = false; }
    if (e.parado) {
      // continua parado enquanto o chão existir
      if (SOLIDO[bl(e.x, e.y - 0.05, e.z)] && !AGUA[bl(e.x, e.y + 0.1, e.z)]) return;
      e.parado = false;
    }
    if (e.y < -20) return;
    const naAgua = AGUA[bl(e.x, e.y + 0.12, e.z)];
    if (naAgua) {
      // boia: empurra para cima até a superfície e balança lá
      e.v[1] += (7 - e.v[1] * 2.2) * dt;
      e.v[0] *= 1 - Math.min(1, dt * 2); e.v[2] *= 1 - Math.min(1, dt * 2);
    } else e.v[1] -= GRAVIDADE * dt;
    e.v[1] = Math.max(-20, Math.min(8, e.v[1]));
    const nx = e.x + e.v[0] * dt;
    if (SOLIDO[bl(nx + Math.sign(e.v[0]) * 0.12, e.y + 0.1, e.z)]) e.v[0] *= -0.2; else e.x = nx;
    const nz = e.z + e.v[2] * dt;
    if (SOLIDO[bl(e.x, e.y + 0.1, nz + Math.sign(e.v[2]) * 0.12)]) e.v[2] *= -0.2; else e.z = nz;
    const ny = e.y + e.v[1] * dt;
    if (e.v[1] < 0 && SOLIDO[bl(e.x, ny, e.z)]) {
      e.y = Math.floor(ny) + 1;
      if (e.v[1] < -4) e.v[1] *= -0.3; // quica
      else { e.v[1] = 0; e.v[0] *= 0.5; e.v[2] *= 0.5; }
      if (Math.abs(e.v[0]) + Math.abs(e.v[2]) < 0.05 && e.v[1] === 0) { e.v[0] = e.v[2] = 0; e.parado = true; }
      else { e.v[0] *= 1 - Math.min(1, dt * 6); e.v[2] *= 1 - Math.min(1, dt * 6); }
    } else if (e.v[1] > 0 && SOLIDO[bl(e.x, ny + LADO, e.z)]) e.v[1] = 0;
    else e.y = ny;
  }

  talvezPegar(e, jog, agora) {
    if (e.esperar && agora < e.esperar) return;
    const dx = e.x - jog.pos.x, dz = e.z - jog.pos.z, dy = e.y - jog.pos.y;
    if (dx * dx + dz * dz > PEGA_H * PEGA_H || dy < -0.9 || dy > 2) return;
    if (!podePegar(e, this.eu, agora)) return;
    // cabe na mochila? (senão avisa de vez em quando e deixa no chão)
    if (!this.ui.mochila.mexer({ t: 'pegar', id: e.id, n: e.n, c: e.c }, true)) {
      e.esperar = agora + 1500;
      if (agora - this.cheioEm > 4000) { this.cheioEm = agora; this.ui.cheio && this.ui.cheio(e.id); }
      return;
    }
    if (this.sala) { this.sala.enviar({ t: 'chao-pegar', i: e.i }); this.recusados.set(e.i, agora + 1500); setTimeout(() => this.recusados.delete(e.i), 3000); }
    else this.chao.tirar(e.i);
    this.sumir(e.i, () => new THREE.Vector3(jog.pos.x, jog.pos.y + 0.9, jog.pos.z));
    this.ui.pegou && this.ui.pegou(e.id, e.n);
  }

  // para testes e para o mapa: o que está no chão agora
  lista() { return [...this.vivos.values()].map(({ i, id, n, x, y, z, parado }) => ({ i, id, n, x, y, z, parado })); }
}

// Carros: modelos low-poly, física simples de direção e os carros estacionados pela cidade.
import * as THREE from '../vendor/three.module.min.js';
import { peca, juntar, matLowPoly, sombra } from './modelos.js';
import { NIVEL_AGUA } from './terreno.js';

const CAIXA = new THREE.BoxGeometry(1, 1, 1);
const RODA = new THREE.CylinderGeometry(1, 1, 1, 8);
const cx = (cor, x, y, z, w, h, d, rx = 0) => peca(CAIXA, cor, [x, y, z], [rx, 0, 0], [w, h, d]);

// medidas: L comprimento, W largura, rodas, cabine
const DEF = {
  compacto: { nome: 'Compacto', L: 3.6, W: 1.7, alt: 0.62, cab: [2.0, 0.62, -0.25], vmax: 19 },
  sedan: { nome: 'Sedã', L: 4.4, W: 1.8, alt: 0.6, cab: [2.2, 0.6, -0.2], vmax: 22 },
  picape: { nome: 'Picape', L: 4.9, W: 1.95, alt: 0.75, cab: [1.7, 0.7, 0.55], vmax: 20, cacamba: true },
  van: { nome: 'Van', L: 4.7, W: 1.95, alt: 0.8, cab: [3.6, 1.05, -0.4], vmax: 17 },
  esportivo: { nome: 'Esportivo', L: 4.3, W: 1.9, alt: 0.45, cab: [1.7, 0.45, -0.35], vmax: 27 },
};
export const MODELOS = DEF;

const cacheGeo = new Map();
export function geoCarro(modelo, cor) {
  const k = modelo + cor;
  if (cacheGeo.has(k)) return cacheGeo.get(k);
  const d = DEF[modelo];
  const L = d.L, W = d.W, h = d.alt, base = 0.38;
  const [cl, ch, cz] = d.cab;
  const vidro = 0x2f4a66, cinza = 0x3a3a3a, pneu = 0x1e1e1e;
  const P = [];
  P.push(cx(cor, 0, base + h / 2, 0, W, h, L));
  // cabine com vidros e teto da cor do carro
  P.push(cx(vidro, 0, base + h + ch / 2, cz, W * 0.86, ch, cl));
  P.push(cx(cor, 0, base + h + ch + 0.04, cz, W * 0.88, 0.08, cl * 0.96));
  P.push(cx(cor, W * 0.43 - 0.02, base + h + ch / 2, cz, 0.05, ch, cl * 0.12), cx(cor, -W * 0.43 + 0.02, base + h + ch / 2, cz, 0.05, ch, cl * 0.12));
  if (d.cacamba) { // caçamba aberta da picape
    P.push(cx(0x2a2a2a, 0, base + h + 0.01, -L * 0.27, W * 0.86, 0.04, L * 0.42));
    P.push(cx(cor, W / 2 - 0.05, base + h + 0.2, -L * 0.27, 0.1, 0.4, L * 0.44), cx(cor, -W / 2 + 0.05, base + h + 0.2, -L * 0.27, 0.1, 0.4, L * 0.44), cx(cor, 0, base + h + 0.2, -L / 2 + 0.05, W, 0.4, 0.1));
  }
  // faróis, lanternas, para-choques
  P.push(cx(0xfff6cc, W * 0.32, base + h * 0.65, L / 2 + 0.01, 0.38, 0.16, 0.04), cx(0xfff6cc, -W * 0.32, base + h * 0.65, L / 2 + 0.01, 0.38, 0.16, 0.04));
  P.push(cx(0xd32f2f, W * 0.34, base + h * 0.7, -L / 2 - 0.01, 0.32, 0.14, 0.04), cx(0xd32f2f, -W * 0.34, base + h * 0.7, -L / 2 - 0.01, 0.32, 0.14, 0.04));
  P.push(cx(cinza, 0, base + 0.08, L / 2 + 0.04, W * 1.02, 0.18, 0.12), cx(cinza, 0, base + 0.08, -L / 2 - 0.04, W * 1.02, 0.18, 0.12));
  P.push(cx(0xf0f0f0, 0, base + h * 0.4, L / 2 + 0.03, 0.5, 0.12, 0.03)); // placa
  // rodas
  const rz = L / 2 - 0.75;
  for (const [x, z] of [[W / 2, rz], [-W / 2, rz], [W / 2, -rz], [-W / 2, -rz]]) {
    P.push(peca(RODA, pneu, [x, 0.36, z], [0, 0, Math.PI / 2], [0.36, 0.26, 0.36]));
    P.push(peca(RODA, 0xbdbdbd, [x + Math.sign(x) * 0.135, 0.36, z], [0, 0, Math.PI / 2], [0.17, 0.02, 0.17]));
  }
  const g = juntar(P);
  cacheGeo.set(k, g);
  return g;
}

export function montarCarro(modelo, cor) {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(geoCarro(modelo, cor), matLowPoly);
  g.add(corpo);
  const s = sombra(1);
  s.scale.set(DEF[modelo].W * 0.65, 1, DEF[modelo].L * 0.55);
  g.add(s);
  return g;
}

export class Carro {
  constructor(cena, terreno, def) {
    this.cena = cena; this.terreno = terreno;
    Object.assign(this, { id: def.id, modelo: def.modelo, cor: def.cor, x: def.x, z: def.z, yaw: def.yaw });
    this.d = DEF[this.modelo];
    this.vel = 0; this.movido = false; this.dirigindo = false;
    this.grupo = montarCarro(this.modelo, this.cor);
    this.y = terreno.chao(this.x, this.z);
    this.pitch = 0; this.roll = 0;
    this.posicionar(1);
    cena.add(this.grupo);
  }

  posicionar(suav = 0.3) {
    const t = this.terreno, s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const L = this.d.L * 0.4, W = this.d.W * 0.45;
    const hf = t.chao(this.x + s * L, this.z + c * L), hb = t.chao(this.x - s * L, this.z - c * L);
    const hl = t.chao(this.x + c * W, this.z - s * W), hr = t.chao(this.x - c * W, this.z + s * W);
    const yAlvo = Math.max((hf + hb + hl + hr) / 4, NIVEL_AGUA - 0.6);
    this.y += (yAlvo - this.y) * suav;
    this.pitch += (Math.atan2(hb - hf, L * 2) - this.pitch) * suav;
    this.roll += (Math.atan2(hl - hr, W * 2) - this.roll) * suav;
    this.grupo.position.set(this.x, this.y, this.z);
    this.grupo.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
  }

  // ent: { frente (-1..1), lado (-1..1), freio } -> retorna true se bateu
  dirigir(dt, ent) {
    dt = Math.min(dt, 0.05);
    this.movido = true;
    const naEstrada = this.terreno.naEstrada(this.x, this.z);
    const vmax = this.d.vmax * (naEstrada ? 1 : 0.6);
    const a = ent.frente;
    if (a > 0.05) this.vel = this.vel < 0 ? this.vel + 14 * dt : Math.min(vmax * Math.min(1, a * 1.2), this.vel + 7.5 * a * dt);
    else if (a < -0.05) this.vel = this.vel > 0.3 ? this.vel - 16 * dt : Math.max(-6, this.vel + 5 * a * dt);
    else this.vel -= Math.sign(this.vel) * Math.min(Math.abs(this.vel), (2.5 + Math.abs(this.vel) * 0.15) * dt);
    if (this.vel > vmax) this.vel -= 8 * dt;
    const giro = ent.lado * Math.min(1, Math.abs(this.vel) / 3) * (1.7 / (1 + Math.abs(this.vel) * 0.03));
    this.yaw -= giro * dt * Math.sign(this.vel || 1);
    const nx = this.x + Math.sin(this.yaw) * this.vel * dt, nz = this.z + Math.cos(this.yaw) * this.vel * dt;
    let bateu = false;
    if (this.terreno.chao(nx, nz) < NIVEL_AGUA - 0.7) { this.vel = 0; bateu = true; }
    else {
      const pos = { x: nx, z: nz };
      // dois círculos: frente e trás do carro
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw), off = this.d.L * 0.28;
      const f = { x: pos.x + s * off, z: pos.z + c * off }, b = { x: pos.x - s * off, z: pos.z - c * off };
      const bf = this.terreno.resolverColisao(f, this.d.W * 0.5), bb = this.terreno.resolverColisao(b, this.d.W * 0.5);
      if (bf || bb) {
        bateu = Math.abs(this.vel) > 3;
        this.vel *= -0.25;
        pos.x = (f.x + b.x) / 2; pos.z = (f.z + b.z) / 2;
      }
      this.x = pos.x; this.z = pos.z;
    }
    this.posicionar(Math.min(1, dt * 12));
    return bateu;
  }

  remover() {
    this.cena.remove(this.grupo);
  }
}

// gerencia os carros estacionados que aparecem com os pedaços da cidade
export class Garagem {
  constructor(cena, terreno) {
    this.cena = cena; this.terreno = terreno;
    this.carros = new Map();
    terreno.aoCarregar = (p) => { for (const d of p.carros || []) if (!this.carros.has(d.id)) this.carros.set(d.id, new Carro(cena, terreno, d)); };
    terreno.aoDescarregar = (p) => {
      for (const d of p.carros || []) {
        const c = this.carros.get(d.id);
        if (c && !c.movido && !c.dirigindo) { c.remover(); this.carros.delete(d.id); }
      }
    };
  }

  maisPerto(x, z, max = 4.5) {
    let melhor = null, dm = max;
    for (const c of this.carros.values()) {
      if (c.dirigindo) continue;
      const d = Math.hypot(c.x - x, c.z - z) - c.d.L * 0.3;
      if (d < dm) { dm = d; melhor = c; }
    }
    return melhor;
  }

  // carros parados também empurram o jogador/bichos
  empurrar(pos, r) {
    for (const c of this.carros.values()) {
      if (c.dirigindo) continue;
      const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
      // coordenadas locais do carro
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const lx = dx * co - dz * s, lz = dx * s + dz * co;
      const hw = c.d.W / 2 + r, hl = c.d.L / 2 + r;
      if (Math.abs(lx) < hw && Math.abs(lz) < hl) {
        const px = hw - Math.abs(lx), pz = hl - Math.abs(lz);
        let nlx = lx, nlz = lz;
        if (px < pz) nlx = Math.sign(lx || 1) * hw; else nlz = Math.sign(lz || 1) * hl;
        pos.x = c.x + nlx * co + nlz * s; pos.z = c.z - nlx * s + nlz * co;
      }
    }
  }

  limpar() { for (const c of this.carros.values()) c.remover(); this.carros.clear(); }
}

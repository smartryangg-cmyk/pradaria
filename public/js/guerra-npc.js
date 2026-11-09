// Pessoas do mundo de Guerra: policiais, guardas do presídio, presos e soldados inimigos.
// Aqui fica só o corpo (montar, andar com colisão nos blocos, gravidade, animação, cair zonzo);
// quem decide para onde cada um vai e quando ataca é o guerra.js.
// Visual de brinquedo: ninguém sangra; quem perde a vida fica zonzo com estrelinhas e some numa nuvem.
import * as THREE from '../vendor/three.module.min.js';
import { montarBoneco, animarBoneco, caixa, juntar, matModelo } from './modelos.js';
import { SOLIDO, AGUA } from './blocos.js';

// vida em meios corações (como a do jogador); dano por golpe; mira = chance de acertar de perto
export const PAPEIS = {
  policial: { nome: 'Policial', camisa: 0x2a4f9e, chapeu: 'quepe', vida: 6, vel: 4.2, arma: 'taser', alcance: 20, dano: 1, intervalo: 1.6, mira: 0.55, visao: 38 },
  guarda: { nome: 'Guarda', camisa: 0x56616e, chapeu: 'quepe', vida: 7, vel: 3.9, arma: 'pistola', alcance: 22, dano: 1, intervalo: 1.5, mira: 0.5, visao: 30 },
  preso: { nome: 'Preso', camisa: 0xf28a2e, chapeu: null, vida: 5, vel: 3.8, arma: 'soco', alcance: 1.7, dano: 1, intervalo: 1.1, mira: 0.85, visao: 13 },
  soldado: { nome: 'Soldado inimigo', camisa: 0x8a3b2e, chapeu: 'capacete', vida: 6, vel: 3.4, arma: 'fuzil', alcance: 30, dano: 1, intervalo: 1.2, mira: 0.42, visao: 36 },
};

const ALTURA = 1.85, LARG = 0.32;
const geoChapeu = {
  quepe: () => juntar([caixa(0.54, 0.14, 0.54, 0x1a2747, 0, 0.55, 0), caixa(0.5, 0.05, 0.22, 0x111111, 0, 0.49, 0.33), caixa(0.12, 0.1, 0.02, 0xffd54a, 0, 0.56, 0.275)]),
  capacete: () => juntar([caixa(0.58, 0.2, 0.58, 0x55663a, 0, 0.55, 0), caixa(0.62, 0.06, 0.62, 0x4a5a32, 0, 0.45, 0)]),
};
const cacheChapeu = {};
const geoArma = (cor) => juntar([caixa(0.1, 0.12, 0.5, cor, 0, 0, 0.18), caixa(0.07, 0.15, 0.08, 0x222222, 0, -0.1, 0.02), caixa(0.06, 0.06, 0.05, 0xff8a3d, 0, 0, 0.44)]);
const COR_ARMA = { taser: 0xf2c72e, pistola: 0x5aa0e0, fuzil: 0x6b7a3a };

export class Pessoas {
  constructor(cena, mundo) {
    this.cena = cena; this.mundo = mundo;
    this.lista = [];
    this.seq = 1;
    this.matZonzo = null;
  }

  criar(papel, x, z, extra = {}) {
    const P = PAPEIS[papel];
    const y = extra.y ?? this.chao(x, z, 60);
    const b = montarBoneco(P.camisa);
    if (P.chapeu) {
      const geo = cacheChapeu[P.chapeu] || (cacheChapeu[P.chapeu] = geoChapeu[P.chapeu]());
      const m = new THREE.Mesh(geo, matModelo); m.castShadow = true;
      b.cabeca.add(m);
    }
    if (P.arma !== 'soco') {
      const arma = new THREE.Mesh(geoArma(COR_ARMA[P.arma]), matModelo);
      arma.position.set(0, -0.55, 0.1);
      b.membros[0].add(arma); // braço direito
    }
    b.grupo.position.set(x, y, z);
    this.cena.add(b.grupo);
    const n = {
      id: 'n' + this.seq++, papel, P, b, x, y, z, vy: 0, yaw: Math.random() * 6.28, noChao: false,
      vida: P.vida, estado: 'parado', cd: Math.random(), anda: 0, golpe: 1, preso: false,
      casa: { x, z, r: 6 }, alvo: null, travado: 0, desvio: 0, desvioDir: 0, olhar: 0, visto: false, zonzo: 0, ...extra,
    };
    this.lista.push(n);
    return n;
  }

  remover(n) {
    const i = this.lista.indexOf(n);
    if (i >= 0) this.lista.splice(i, 1);
    this.cena.remove(n.b.grupo);
    n.removido = true;
  }

  limpar() { for (const n of [...this.lista]) this.remover(n); }

  // altura do chão em (x,z): primeiro bloco sólido de cima para baixo a partir de yRef
  chao(x, z, yRef) {
    const bx = Math.floor(x), bz = Math.floor(z);
    for (let y = Math.floor(yRef); y > 1; y--) if (SOLIDO[this.mundo.bloco(bx, y - 1, bz)] && !SOLIDO[this.mundo.bloco(bx, y, bz)] && !SOLIDO[this.mundo.bloco(bx, y + 1, bz)]) return y;
    return yRef;
  }

  ocupa(x, y, z) {
    const m = this.mundo;
    const x0 = Math.floor(x - LARG), x1 = Math.floor(x + LARG), z0 = Math.floor(z - LARG), z1 = Math.floor(z + LARG);
    const y0 = Math.floor(y + 0.01), y1 = Math.floor(y + ALTURA - 0.05);
    for (let bx = x0; bx <= x1; bx++) for (let bz = z0; bz <= z1; bz++) for (let by = y0; by <= y1; by++) if (SOLIDO[m.bloco(bx, by, bz)]) return true;
    return false;
  }

  // anda na direção de (tx, tz) com velocidade vel (0 = parado); sobe degrau de 1 bloco, contorna paredes
  mover(n, dt, tx, tz, vel) {
    const dx = tx - n.x, dz = tz - n.z, d = Math.hypot(dx, dz);
    let ux = 0, uz = 0;
    if (vel > 0 && d > 0.15) {
      ux = dx / d; uz = dz / d;
      if (n.desvio > 0) { // contornando: anda de lado por um tempo
        n.desvio -= dt;
        const s = n.desvioDir;
        const nx = ux * 0.3 - uz * s, nz = uz * 0.3 + ux * s, l = Math.hypot(nx, nz);
        ux = nx / l; uz = nz / l;
      }
      n.yaw = Math.atan2(ux, uz);
    }
    const passo = Math.min(vel * dt, d);
    const andou = this.passo(n, ux * passo, uz * passo);
    n.anda = vel > 0 && andou > passo * 0.3 ? Math.min(1, vel / 4) : 0;
    if (vel > 0 && d > 0.6 && andou < passo * 0.3) {
      n.travado += dt;
      if (n.travado > 0.5 && n.desvio <= 0) { n.desvio = 0.8 + Math.random(); n.desvioDir = Math.random() < 0.5 ? 1 : -1; n.travado = 0; }
    } else n.travado = 0;
    return d;
  }

  // tenta andar (mx, mz); devolve quanto andou
  passo(n, mx, mz) {
    let andou = 0;
    for (const [ax, az] of [[mx, 0], [0, mz]]) {
      if (!ax && !az) continue;
      const nx = n.x + ax, nz = n.z + az;
      // água funda na frente: não entra
      const pe = this.mundo.bloco(Math.floor(nx), Math.floor(n.y - 0.5), Math.floor(nz));
      if (AGUA[pe] && AGUA[this.mundo.bloco(Math.floor(nx), Math.floor(n.y - 1.5), Math.floor(nz))]) continue;
      if (!this.ocupa(nx, n.y, nz)) { n.x = nx; n.z = nz; andou += Math.abs(ax + az); continue; }
      // degrau: sobe se couber um bloco acima
      if (n.noChao && !this.ocupa(nx, n.y + 1.02, nz) && !this.ocupa(n.x, n.y + 1.02, n.z)) { n.y += 1.02; n.x = nx; n.z = nz; n.vy = 0; andou += Math.abs(ax + az); }
    }
    return andou;
  }

  fisica(n, dt) {
    n.vy = Math.max(-25, n.vy - 25 * dt);
    let ny = n.y + n.vy * dt;
    if (n.vy <= 0) {
      const base = Math.floor(ny);
      if (this.ocupa(n.x, ny, n.z)) { ny = base + 1; n.vy = 0; n.noChao = true; } else n.noChao = false;
    } else if (this.ocupa(n.x, ny, n.z)) { n.vy = 0; ny = n.y; }
    // caiu num buraco sem fundo (fora do mundo): volta para casa
    if (ny < 2) { n.x = n.casa.x; n.z = n.casa.z; ny = this.chao(n.x, n.z, 60); n.vy = 0; }
    n.y = ny;
  }

  // desenha (e anima) uma pessoa
  desenhar(n, dt) {
    const g = n.b.grupo;
    g.position.set(n.x, n.y, n.z);
    if (n.estado === 'zonzo') {
      g.rotation.set(-Math.PI / 2 * Math.min(1, n.zonzo * 3), n.yaw, 0, 'YXZ');
      g.position.y = n.y + 0.25;
      return;
    }
    let d = ((n.yaw - g.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.rotation.set(0, g.rotation.y + d * Math.min(1, dt * 10), 0);
    if (n.golpe < 1) n.golpe = Math.min(1, n.golpe + dt / 0.3);
    animarBoneco(n.b, { anda: n.anda, golpe: n.golpe, pitch: n.mirando ? -0.2 : 0 }, dt);
    if (n.mirando) { n.b.membros[0].rotation.x = -1.5; }
  }

  // raio contra as pessoas (corpo e cabeça); ignora quem está zonzo
  atingir(o, dir, max) {
    let melhor = null;
    const mn = new THREE.Vector3(), mx = new THREE.Vector3();
    for (const n of this.lista) {
      if (n.estado === 'zonzo' || !n.b.grupo.visible) continue;
      mn.set(n.x - 0.38, n.y, n.z - 0.38); mx.set(n.x + 0.38, n.y + 1.4, n.z + 0.38);
      const t = raioCaixa(o, dir, mn, mx, melhor ? melhor.t : max);
      if (t >= 0) melhor = { t, npc: n, cabeca: false };
      mn.set(n.x - 0.3, n.y + 1.4, n.z - 0.3); mx.set(n.x + 0.3, n.y + 1.95, n.z + 0.3);
      const th = raioCaixa(o, dir, mn, mx, melhor ? melhor.t : max);
      if (th >= 0) melhor = { t: th, npc: n, cabeca: true };
    }
    return melhor;
  }
}

// raio contra caixa (min, max); devolve a distância ou -1
export function raioCaixa(o, d, mn, mx, max) {
  let t0 = 0, t1 = max;
  for (const e of ['x', 'y', 'z']) {
    if (Math.abs(d[e]) < 1e-9) { if (o[e] < mn[e] || o[e] > mx[e]) return -1; continue; }
    let a = (mn[e] - o[e]) / d[e], b = (mx[e] - o[e]) / d[e];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return -1;
  }
  return t0;
}

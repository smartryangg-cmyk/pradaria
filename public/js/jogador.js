// Física do jogador: andar, pular, voar, nadar e colisão com blocos.
import { SOLIDO, AGUA, E, ESTEIRA_DIRS } from './blocos.js';
import { FORMA_NOVA, colideForma } from './formas.js';

const LARG = 0.3; // meia largura
const ALTURA = 1.7;
export const OLHOS = 1.55;

export class Jogador {
  constructor(mundo) {
    this.mundo = mundo;
    this.pos = { x: 0.5, y: 40, z: 0.5 };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0; this.pitch = 0;
    this.noChao = false;
    this.voando = false;
    this.naAgua = false;
    this.passo = 0;
  }

  colide(x, y, z) {
    const m = this.mundo;
    const x0 = Math.floor(x - LARG), x1 = Math.floor(x + LARG);
    const y0 = Math.floor(y), y1 = Math.floor(y + ALTURA - 0.01);
    const z0 = Math.floor(z - LARG), z1 = Math.floor(z + LARG);
    const get = this.get || (this.get = (a, b, c) => m.bloco(a, b, c));
    // começa 1 abaixo: a cerca tem 1,5 de altura e pode encostar vindo da célula de baixo
    for (let bx = x0; bx <= x1; bx++) for (let by = y0 - 1; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) {
      const b = m.bloco(bx, by, bz);
      if (!SOLIDO[b]) continue;
      if (FORMA_NOVA[b]) {
        if (colideForma(b, get, bx, by, bz, x - LARG, y, z - LARG, x + LARG, y + ALTURA - 0.01, z + LARG)) return true;
      } else if (by >= y0) return true;
    }
    return false;
  }

  // entrada: { frente, lado, pular, descer, correr }
  atualizar(dt, ent) {
    dt = Math.min(dt, 0.05);
    const p = this.pos, v = this.vel;
    const bx = Math.floor(p.x), bz = Math.floor(p.z), by = Math.floor(p.y + 0.4);
    this.naAgua = !!AGUA[this.mundo.bloco(bx, by, bz)];
    const sen = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // frente = -z da câmera
    let mx = -sen * ent.frente + cos * ent.lado;
    let mz = -cos * ent.frente - sen * ent.lado;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    let vel = this.voando ? 9 : this.naAgua ? 2.6 : 4.4;
    if (ent.correr && !this.naAgua) vel *= 1.45;
    const acel = this.noChao || this.voando ? 14 : 5;
    // esteira: leva quem está em cima
    let ex = 0, ez = 0;
    const pe = this.mundo.bloco(bx, Math.floor(p.y - 0.05), bz);
    if (this.noChao && pe >= E.ESTEIRA && pe < E.ESTEIRA + 4) [ex, ez] = ESTEIRA_DIRS[pe - E.ESTEIRA].map((d) => d * 3.2);
    this.naEsteira = !!(ex || ez);
    v.x += (mx * vel + ex - v.x) * Math.min(1, acel * dt);
    v.z += (mz * vel + ez - v.z) * Math.min(1, acel * dt);
    // correnteza: a água que corre leva a gente devagarinho
    if (this.naAgua && !this.voando) {
      const [cx, cz] = this.mundo.correnteza(bx, by, bz);
      v.x += cx * 9 * dt; v.z += cz * 9 * dt;
    }

    if (this.voando) {
      const alvo = (ent.pular ? 7 : 0) - (ent.descer ? 7 : 0);
      v.y += (alvo - v.y) * Math.min(1, 10 * dt);
    } else if (this.naAgua) {
      v.y -= 9 * dt;
      if (ent.pular) v.y += 22 * dt;
      v.y = Math.max(-3, Math.min(3.5, v.y));
    } else {
      v.y -= 26 * dt;
      if (ent.pular && this.noChao) { v.y = 8.2; this.noChao = false; }
      v.y = Math.max(v.y, -40);
      // planando (começo da Ilha de Aventura): cai devagarinho e anda rápido no ar
      if (this.planando) {
        v.y = Math.max(v.y, ent.descer ? -12 : -3.2);
        if (len > 0.1) { v.x += (mx * 9 - v.x) * Math.min(1, 3 * dt); v.z += (mz * 9 - v.z) * Math.min(1, 3 * dt); }
      }
      // ventilador ligado embaixo (até 10 blocos): sobe como num elevador
      this.noVento = false;
      for (let dy = 0; dy <= 10; dy++) {
        const q = this.mundo.bloco(bx, Math.floor(p.y) - dy, bz);
        if (q === E.VENTILADOR_LIGADO && dy > 0) { this.noVento = true; break; }
        if (SOLIDO[q]) break;
      }
      if (this.noVento) { v.y = Math.min(6, v.y + 48 * dt); this.noChao = false; }
    }
    const vyAntes = v.y;

    // movimento eixo a eixo
    const nx = p.x + v.x * dt;
    if (!this.colide(nx, p.y, p.z)) p.x = nx;
    else if (this.degrau(nx, p.z)) p.x = nx;
    else { this.tentarSubir(nx, p.z, len); v.x = 0; }
    const nz = p.z + v.z * dt;
    if (!this.colide(p.x, p.y, nz)) p.z = nz;
    else if (this.degrau(p.x, nz)) p.z = nz;
    else { this.tentarSubir(p.x, nz, len); v.z = 0; }
    const ny = p.y + v.y * dt;
    if (!this.colide(p.x, ny, p.z)) { p.y = ny; this.noChao = false; }
    else {
      if (v.y < 0) { this.noChao = true; p.y = this.pousar(ny); if (this.voando) this.voando = false; }
      else if (!this.colide(p.x, p.y, p.z)) p.y = this.encostarTeto(ny);
      v.y = 0;
      // trampolim: quica (segurando "descer" para de quicar)
      if (vyAntes < 0 && !ent.descer && this.mundo.bloco(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z)) === E.TRAMPOLIM) {
        v.y = Math.min(17, Math.max(11, -vyAntes * 0.92)); this.noChao = false; this.quicou = true;
      }
    }
    // borda do mundo pequeno/médio: dá para nadar um pouquinho no mar, mas não passar
    const L = this.mundo.limite;
    if (L) {
      const M = L + 6;
      if (Math.abs(p.x) > M || Math.abs(p.z) > M) {
        p.x = Math.max(-M, Math.min(M, p.x)); p.z = Math.max(-M, Math.min(M, p.z));
        if (this.aoBorda) this.aoBorda();
      }
    }
    if (this.planando && (this.noChao || this.naAgua || this.voando)) this.planando = false;
    if (p.y < -10) { p.y = this.mundo.chao(Math.floor(p.x), Math.floor(p.z)) + 2; v.y = 0; }
    if (this.noChao && len > 0.1) this.passo += dt * vel;
  }

  // altura onde os pés encostam no que está embaixo (bloco cheio, meio bloco, rampa, bola...)
  pousar(ny) {
    const p = this.pos;
    if (this.colide(p.x, p.y, p.z)) return Math.floor(ny) + (this.colide(p.x, Math.floor(ny), p.z) ? 1 : 0); // estava preso: jeito antigo
    const inteiro = Math.floor(p.y);
    if (inteiro > ny && !this.colide(p.x, inteiro, p.z)) {
      // caso comum (chão de bloco cheio): encosta certinho no número inteiro
      if (this.colide(p.x, inteiro - 0.0005, p.z)) return inteiro;
    }
    let lo = ny, hi = p.y; // lo encosta, hi está livre
    for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (this.colide(p.x, m, p.z)) lo = m; else hi = m; }
    return hi;
  }

  encostarTeto(ny) {
    const p = this.pos;
    let lo = p.y, hi = ny; // lo livre, hi encosta
    for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (this.colide(p.x, m, p.z)) hi = m; else lo = m; }
    return lo;
  }

  // degrau baixo (rampa, escada, meio bloco): sobe andando, sem pular
  degrau(x, z) {
    if (!this.noChao || this.voando) return false;
    const p = this.pos;
    for (let s = 0.1; s <= 0.61; s += 0.1) {
      if (!this.colide(x, p.y + s, z)) {
        if (this.colide(p.x, p.y + s, p.z)) return false;
        p.y += s + 0.001;
        return true;
      }
    }
    return false;
  }

  // sobe degraus de 1 bloco sozinho (bom para o toque)
  tentarSubir(x, z, querAndar) {
    if (!this.noChao || this.voando || querAndar < 0.1) return;
    if (!this.colide(x, this.pos.y + 1.01, z) && !this.colide(this.pos.x, this.pos.y + 1.01, this.pos.z)) this.vel.y = 8.2, this.noChao = false;
  }

  ocupa(bx, by, bz) {
    const p = this.pos;
    return bx + 1 > p.x - LARG && bx < p.x + LARG && bz + 1 > p.z - LARG && bz < p.z + LARG && by + 1 > p.y && by < p.y + ALTURA;
  }
}

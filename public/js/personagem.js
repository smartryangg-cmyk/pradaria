// Personagem a pé: andar, correr, pular e nadar no terreno, com animação do boneco.
import { montarBoneco } from './modelos.js';
import { NIVEL_AGUA } from './terreno.js';

export class Personagem {
  constructor(cena, terreno, garagem, cor) {
    this.cena = cena; this.terreno = terreno; this.garagem = garagem;
    this.boneco = montarBoneco(cor);
    cena.add(this.boneco.grupo);
    this.pos = { x: 24, y: 5, z: 24 };
    this.vy = 0; this.noChao = true; this.nadando = false;
    this.rot = 0;           // para onde o boneco olha
    this.fase = 0; this.vel = 0;
    this.carro = null;      // carro que está dirigindo
  }

  // ent: { frente, lado, pular, correr }, camYaw: ângulo da câmera
  atualizar(dt, ent, camYaw) {
    dt = Math.min(dt, 0.05);
    const p = this.pos, t = this.terreno;
    // direção relativa à câmera (câmera olha para -frente)
    const s = Math.sin(camYaw), c = Math.cos(camYaw);
    let mx = -s * ent.frente + c * ent.lado;
    let mz = -c * ent.frente - s * ent.lado;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const chaoAqui = t.chao(p.x, p.z);
    this.nadando = chaoAqui < NIVEL_AGUA - 1.1;
    let vel = this.nadando ? 2.4 : ent.correr ? 7.5 : 4.2;
    this.vel += (len * vel - this.vel) * Math.min(1, dt * 10);
    if (len > 0.05) {
      const alvo = Math.atan2(mx, mz);
      const d = ((alvo - this.rot + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.rot += d * Math.min(1, dt * 12);
    }
    const nx = p.x + Math.sin(this.rot) * this.vel * dt * Math.min(1, len * 1.5);
    const nz = p.z + Math.cos(this.rot) * this.vel * dt * Math.min(1, len * 1.5);
    // não sobe paredes muito íngremes
    const hNovo = t.chao(nx, nz);
    const subida = (hNovo - chaoAqui) / Math.max(0.0001, Math.hypot(nx - p.x, nz - p.z));
    if (subida < 1.6 || this.nadando || hNovo < p.y) {
      const q = { x: nx, z: nz };
      t.resolverColisao(q, 0.35);
      this.garagem.empurrar(q, 0.35);
      p.x = q.x; p.z = q.z;
    }
    const chao = t.chao(p.x, p.z);
    if (this.nadando || chao < NIVEL_AGUA - 1.1) {
      const sup = NIVEL_AGUA - 1.25;
      p.y += (sup - p.y) * Math.min(1, dt * 5);
      this.vy = 0; this.noChao = false;
    } else {
      if (ent.pular && this.noChao) { this.vy = 6.5; this.noChao = false; }
      this.vy -= 20 * dt;
      p.y += this.vy * dt;
      if (p.y <= chao) { p.y = chao; this.vy = 0; this.noChao = true; }
      else if (this.noChao && p.y - chao < 0.5 && this.vy <= 0) { p.y = chao; this.vy = 0; } // desce rampas sem "voar"
      else this.noChao = false;
    }

    // animação
    const g = this.boneco.grupo;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = this.rot;
    const andando = this.vel > 0.3;
    this.fase += dt * (this.nadando ? 5 : 2.2 * this.vel);
    const a = this.nadando ? Math.sin(this.fase) * 1.2 : andando ? Math.sin(this.fase) * Math.min(0.9, this.vel / 6) : 0;
    const [bd, be, pd, pe] = this.boneco.membros;
    bd.rotation.x = this.nadando ? -2.2 + a * 0.6 : a; be.rotation.x = this.nadando ? -2.2 - a * 0.6 : -a;
    pd.rotation.x = -a; pe.rotation.x = a;
    if (!this.noChao && !this.nadando) { pd.rotation.x = -0.5; pe.rotation.x = 0.3; }
  }

  mostrar(v) { this.boneco.grupo.visible = v; }
}

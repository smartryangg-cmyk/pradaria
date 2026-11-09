// Física do jogador: andar, pular, voar, nadar e colisão com blocos.
import { SOLIDO, E, ESTEIRA_DIRS } from './blocos.js';
import { superficieAgua } from './agua.js';

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
    for (let bx = x0; bx <= x1; bx++) for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) {
      if (SOLIDO[m.bloco(bx, by, bz)]) return true;
    }
    return false;
  }

  // entrada: { frente, lado, pular, descer, correr }
  atualizar(dt, ent) {
    dt = Math.min(dt, 0.05);
    const p = this.pos, v = this.vel;
    const bx = Math.floor(p.x), bz = Math.floor(p.z), by = Math.floor(p.y + 0.4);
    this.medirAgua();
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
    if (!this.naAgua || this.voando) { // na água quem cuida é nadar()
      v.x += (mx * vel + ex - v.x) * Math.min(1, acel * dt);
      v.z += (mz * vel + ez - v.z) * Math.min(1, acel * dt);
    }
    // correnteza: a água que corre leva a gente devagarinho
    if (this.naAgua && !this.voando) {
      const [cx, cz] = this.mundo.correnteza(bx, by, bz);
      v.x += cx * 9 * dt; v.z += cz * 9 * dt;
    }

    if (this.voando) {
      const alvo = (ent.pular ? 7 : 0) - (ent.descer ? 7 : 0);
      v.y += (alvo - v.y) * Math.min(1, 10 * dt);
    } else if (this.naAgua) {
      this.nadar(dt, ent);
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
    else { this.tentarSubir(nx, p.z, len); v.x = 0; }
    const nz = p.z + v.z * dt;
    if (!this.colide(p.x, p.y, nz)) p.z = nz;
    else { this.tentarSubir(p.x, nz, len); v.z = 0; }
    const ny = p.y + v.y * dt;
    if (!this.colide(p.x, ny, p.z)) { p.y = ny; this.noChao = false; }
    else {
      if (v.y < 0) { this.noChao = true; p.y = Math.floor(ny) + (this.colide(p.x, Math.floor(ny), p.z) ? 1 : 0); if (this.voando) this.voando = false; }
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

  // sobe degraus de 1 bloco sozinho (bom para o toque)
  tentarSubir(x, z, querAndar) {
    if (!this.noChao || this.voando || querAndar < 0.1) return;
    if (!this.colide(x, this.pos.y + 1.01, z) && !this.colide(this.pos.x, this.pos.y + 1.01, this.pos.z)) this.vel.y = 8.2, this.noChao = false;
  }

  // ---------- água ----------
  // quanto do corpo está na água: fundura = da sola do pé até a superfície (0 = seco)
  medirAgua() {
    const p = this.pos, m = this.mundo, antes = this.naAgua;
    let sup = superficieAgua(m, p.x, p.y + 0.1, p.z);
    if (sup === -Infinity) sup = superficieAgua(m, p.x, p.y + 0.8, p.z);
    if (sup === -Infinity) sup = superficieAgua(m, p.x, p.y + OLHOS, p.z);
    const f = sup > p.y ? sup - p.y : 0;
    this.superficie = sup;
    this.fundura = f;
    this.peNaAgua = f > 0;
    this.naAgua = f > 0.4;           // nadando (cintura para baixo na água)
    this.cabecaNaAgua = f > OLHOS;   // olhos embaixo d'água: gasta fôlego
    // caiu na água: tchibum, e a água freia a queda
    if (this.naAgua && !antes && !this.voando && this.vel.y < -5) {
      this.splash = -this.vel.y;
      this.vel.y *= 0.35;
    }
    if (!this.naAgua) { this.saindo = 0; this.resgate = false; }
  }

  // nado: boia com a cabeça para fora, pular sobe, descer mergulha, olhando para baixo/cima
  // (embaixo d'água) nada nessa direção, arrasto da água e subir na beirada
  nadar(dt, ent) {
    const p = this.pos, v = this.vel, d = this.fundura;
    const sub = this.cabecaNaAgua;
    this.tempoAgua = (this.tempoAgua || 0) + dt;
    let f = ent.frente, l = ent.lado;
    const n = Math.hypot(f, l);
    if (n > 1) { f /= n; l /= n; }
    const vel = (sub ? 3.1 : 2.8) * (ent.correr ? 1.35 : 1);
    // embaixo d'água (ou olhando bem para baixo na superfície) a frente segue a câmera
    const guiar = !this.resgate && (sub || (this.pitch < -0.45 && f > 0.1));
    const fh = guiar ? f * Math.cos(this.pitch) : f;
    const vyGuia = guiar ? f * Math.sin(this.pitch) * vel : 0;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const k = Math.min(1, 3.2 * dt); // arrasto: a velocidade muda devagar
    v.x += ((-sy * fh + cy * l) * vel - v.x) * k;
    v.z += ((-cy * fh - sy * l) * vel - v.z) * k;

    // beirada: nadando contra um bloco com espaço em cima, sobe para a terra
    this.saindo = Math.max(0, (this.saindo || 0) - dt);
    if (!this.saindo && n > 0.3) {
      let ux = -sy * f + cy * l, uz = -cy * f - sy * l;
      const u = Math.hypot(ux, uz) || 1; ux /= u; uz /= u;
      if (this.colide(p.x + ux * 0.2, p.y, p.z + uz * 0.2) && (ent.pular || d < 2.3)) {
        const m = this.mundo, cx = Math.floor(p.x + ux * 0.75), cz = Math.floor(p.z + uz * 0.75);
        for (let y = Math.floor(p.y); y <= Math.floor(p.y + 2.6); y++) {
          if (!SOLIDO[m.bloco(cx, y, cz)] || SOLIDO[m.bloco(cx, y + 1, cz)]) continue;
          const topo = y + 1, h = topo - p.y;
          if (h > 0 && h <= 2.6 && !SOLIDO[m.bloco(cx, y + 2, cz)] && !this.colide(p.x, topo + 0.02, p.z)) {
            // impulso para passar da beirada (+13*dt compensa o passo da física em aparelho lento)
            v.y = Math.sqrt(2 * 26 * (h + 0.25)) + 13 * dt;
            this.saindo = 0.45;
          }
          break;
        }
      }
    }

    if (this.saindo) v.y -= 26 * dt; // subindo na beirada: como um pulo
    else {
      let alvo = vyGuia;
      if (ent.pular) alvo += 3.4;
      if (ent.descer) alvo -= 3.4;
      if (this.resgate) alvo = 4.2; // sem fôlego num mundo sem perigo: a água leva para cima
      if (Math.abs(alvo) > 0.05) v.y += (alvo - v.y) * Math.min(1, 4 * dt);
      else {
        // empuxo: boia com os olhos um pouco acima da água, balançando de leve
        const d0 = 1.3 + Math.sin(this.tempoAgua * 2.2) * 0.05;
        v.y += 9 * (Math.min(d, 1.7) / d0 - 1) * dt;
        v.y *= Math.exp(-2.4 * dt);
      }
      if (v.y < -4) v.y *= Math.exp(-6 * dt); // entrou rápido: a água segura
      v.y = Math.max(-8, Math.min(6, v.y));
    }
  }

  ocupa(bx, by, bz) {
    const p = this.pos;
    return bx + 1 > p.x - LARG && bx < p.x + LARG && bz + 1 > p.z - LARG && bz < p.z + LARG && by + 1 > p.y && by < p.y + ALTURA;
  }
}

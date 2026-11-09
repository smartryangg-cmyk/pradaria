// Física do jogador: andar, pular, voar, nadar e colisão com blocos.
import { SOLIDO, AGUA, B, E, ESTEIRA_DIRS } from './blocos.js';
import { vida } from './vida.js';

const LARG = 0.3; // meia largura
const ALTURA = 1.7;
const ALTURA_AGACHADO = 1.45;
export const OLHOS = 1.55;
export const OLHOS_AGACHADO = 1.25;
const GRAV = 26;
const PULO = 8.2; // pulo de ~1,3 bloco
const COYOTE = 0.1; // segundos depois de sair da beirada em que ainda dá para pular
const BUFFER_PULO = 0.13; // apertou pular um pouquinho antes de pousar: pula ao tocar o chão
const PASSO_FIXO = 1 / 60; // a física anda em passos pequenos, mesmo se o tablet estiver lento
const SUB = 0.4; // nunca anda mais que isso de uma vez (não atravessa bloco nem quina)
const FOLGA = 1e-4; // encosta na parede sem entrar nela
const QUEDA_SEGURA = 4; // cair até 4 blocos não machuca; cada bloco a mais tira meio coração

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
    this.tempoNoAr = 1; // segundos desde que saiu do chão (coyote time)
    this.bufPulo = 0; // segundos que ainda vale um pulo apertado antes de pousar
    this.pularAntes = false;
    this.pulou = false;
    this.pico = this.pos.y; // ponto mais alto desde que saiu do chão (para o dano de queda)
    this.degrauY = 0; // suaviza o degrau: a câmera e o boneco sobem aos poucos
    this.baqueY = 0; // câmera desce um tiquinho ao cair de alto
    this.olhosY = 0; // degrauY + baqueY: main.js soma na altura da câmera
    this.agachado = false; // agachado: anda devagar, fica mais baixo e não cai da beirada
    this.correndo = false; // true só quando está correndo de fato no chão
    this.altura = ALTURA; // altura da caixa de colisão (menor agachado)
    this.alturaOlhos = OLHOS; // altura dos olhos acima dos pés (desce suave ao agachar); a câmera usa pos.y + alturaOlhos + olhosY
    this.aoQueda = null; // (blocos, dano, machucou) => som/aviso; definido pelo main.js
    this._ult = null;
  }

  // y visual dos pés (degrau suave): visao.js põe o boneco e a câmera aqui
  get yVisual() { return this.pos.y + this.degrauY; }

  colide(x, y, z) {
    const m = this.mundo;
    const x0 = Math.floor(x - LARG), x1 = Math.floor(x + LARG);
    const y0 = Math.floor(y), y1 = Math.floor(y + this.altura - 0.01);
    const z0 = Math.floor(z - LARG), z1 = Math.floor(z + LARG);
    for (let bx = x0; bx <= x1; bx++) for (let by = y0; by <= y1; by++) for (let bz = z0; bz <= z1; bz++) {
      if (SOLIDO[m.bloco(bx, by, bz)]) return true;
    }
    return false;
  }

  // entrada: { frente, lado, pular, descer, correr, agachar }
  atualizar(dt, ent) {
    dt = Math.min(dt, 0.1);
    const p = this.pos;
    // alguém mudou a posição por fora (teleporte, veículo, comando): a queda começa a contar daqui
    const u = this._ult;
    if (!u || Math.abs(u.x - p.x) + Math.abs(u.y - p.y) + Math.abs(u.z - p.z) > 1e-6) { this.pico = p.y; this.tempoNoAr = Math.max(this.tempoNoAr, COYOTE); }
    if (ent.pular && !this.pularAntes) this.bufPulo = BUFFER_PULO;
    this.pularAntes = !!ent.pular;
    this.desenroscar();
    const n = Math.max(1, Math.ceil(dt / PASSO_FIXO - 1e-6));
    for (let i = 0; i < n; i++) this.passoFisica(dt / n, ent);
    this.bufPulo = Math.max(0, this.bufPulo - dt);
    // câmera volta ao lugar suavemente depois do degrau e do baque
    this.degrauY *= Math.exp(-13 * dt); if (Math.abs(this.degrauY) < 0.003) this.degrauY = 0;
    this.baqueY *= Math.exp(-9 * dt); if (Math.abs(this.baqueY) < 0.003) this.baqueY = 0;
    this.olhosY = this.degrauY + this.baqueY;
    const olhosAlvo = this.agachado ? OLHOS_AGACHADO : OLHOS;
    this.alturaOlhos += (olhosAlvo - this.alturaOlhos) * Math.min(1, 16 * dt);
    if (Math.abs(olhosAlvo - this.alturaOlhos) < 0.002) this.alturaOlhos = olhosAlvo;
    if (!this._ult) this._ult = { x: 0, y: 0, z: 0 };
    this._ult.x = p.x; this._ult.y = p.y; this._ult.z = p.z;
  }

  passoFisica(dt, ent) {
    const p = this.pos, v = this.vel;
    const bx = Math.floor(p.x), bz = Math.floor(p.z), by = Math.floor(p.y + 0.4);
    this.naAgua = !!AGUA[this.mundo.bloco(bx, by, bz)];
    const sen = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // frente = -z da câmera
    let mx = -sen * ent.frente + cos * ent.lado;
    let mz = -cos * ent.frente - sen * ent.lado;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; } // na diagonal não anda mais rápido
    // agachar: só no chão ou caindo (não voando nem nadando); levanta só se tiver espaço em cima
    if (ent.agachar && !this.voando && !this.naAgua) { this.agachado = true; this.altura = ALTURA_AGACHADO; }
    else if (this.agachado) { this.altura = ALTURA; if (this.colide(p.x, p.y, p.z)) this.altura = ALTURA_AGACHADO; else this.agachado = false; }
    let vel = this.voando ? 9 : this.naAgua ? 2.6 : 4.4;
    if (this.agachado) vel *= 0.35;
    else if (ent.correr && !this.naAgua) vel *= 1.45;
    this.correndo = !!ent.correr && !this.agachado && !this.naAgua && !this.voando && this.noChao && len > 0.1;
    // aceleração: no chão pega velocidade rápido e para mais rápido ainda; no ar tem pouco controle
    const parado = len < 0.1;
    const acel = this.voando ? 14 : this.naAgua ? (this.noChao ? 14 : 5) : this.noChao ? (parado ? 22 : 14) : (parado ? 3 : 5);
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
      v.y -= GRAV * dt;
      // pulo: no chão, um tiquinho depois de sair da beirada (coyote) ou apertado logo antes de pousar (buffer)
      if ((ent.pular || this.bufPulo > 0) && this.tempoNoAr < COYOTE && !this.pulou) {
        v.y = PULO; this.noChao = false; this.pulou = true; this.bufPulo = 0; this.tempoNoAr = COYOTE;
      }
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
    const estavaNoChao = this.noChao;

    // movimento em sub-passos (no máximo SUB bloco por vez), eixo a eixo
    const bateu = this.mover(v.x * dt, v.y * dt, v.z * dt, this.noChao && !this.voando && len > 0.1, this.agachado && this.noChao && !this.voando);
    if (bateu < 0) {
      this.noChao = true;
      if (this.voando) this.voando = false;
      v.y = 0;
      // trampolim: quica (segurando "descer" para de quicar)
      let quicou = false;
      if (vyAntes < 0 && !ent.descer && this.mundo.bloco(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z)) === E.TRAMPOLIM) {
        v.y = Math.min(17, Math.max(11, -vyAntes * 0.92)); this.noChao = false; this.quicou = quicou = true;
      }
      if (!estavaNoChao) this.pousou(quicou);
    } else {
      this.noChao = false;
      if (bateu > 0 && v.y > 0) v.y = 0; // bateu a cabeça no teto: para de subir
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
    if (p.y < -10) { p.y = this.mundo.chao(Math.floor(p.x), Math.floor(p.z)) + 2; v.y = 0; this.pico = p.y; }
    if (this.noChao && len > 0.1) this.passo += dt * vel;
    // coyote time e altura da queda
    if (this.noChao) { this.tempoNoAr = 0; this.pulou = false; } else this.tempoNoAr += dt;
    if (this.naAgua || this.voando) this.tempoNoAr = Math.max(this.tempoNoAr, COYOTE);
    if (this.noChao || this.voando || this.naAgua || this.planando || this.noVento) this.pico = p.y;
    else if (p.y > this.pico) this.pico = p.y;
  }

  // anda (dx, dy, dz) sem atravessar blocos. Devolve -1 se pousou no chão, 1 se bateu no teto, 0 se nada.
  mover(dx, dy, dz, podeSubir, naBeira) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / SUB));
    dx /= n; dy /= n; dz /= n;
    let bateu = 0;
    for (let i = 0; i < n; i++) {
      if (dx && !this.moverEixo('x', dx, podeSubir, naBeira)) { dx = 0; this.vel.x = 0; }
      if (dz && !this.moverEixo('z', dz, podeSubir, naBeira)) { dz = 0; this.vel.z = 0; }
      if (dy) { const r = this.moverY(dy); if (r) { bateu = r; dy = 0; } }
    }
    return bateu;
  }

  colideEixo(e, val, y = this.pos.y) {
    return e === 'x' ? this.colide(val, y, this.pos.z) : this.colide(this.pos.x, y, val);
  }

  // anda num eixo; devolve false se bateu (e encosta certinho na parede)
  moverEixo(e, d, podeSubir, naBeira) {
    const p = this.pos, novo = p[e] + d;
    if (!this.colideEixo(e, novo)) {
      // agachado não cai da beirada: só anda se continuar com algum bloco embaixo dos pés
      if (naBeira && this.temApoio(p.x, p.z) && !(e === 'x' ? this.temApoio(novo, p.z) : this.temApoio(p.x, novo))) return false;
      p[e] = novo; return true;
    }
    // degrau de 1 bloco: sobe suave, sem pulo, mantendo a velocidade
    if (podeSubir) {
      const topo = Math.floor(p.y + 0.001) + 1, sobe = topo - p.y;
      if (sobe > 0 && sobe <= 1.01 && !this.colideEixo(e, novo, topo) && !this.colide(p.x, topo, p.z)) {
        p.y = topo; p[e] = novo;
        this.degrauY = Math.max(-1.2, this.degrauY - sobe);
        if (this.vel.y < 0) this.vel.y = 0;
        return true;
      }
    }
    const encosta = d > 0 ? Math.floor(novo + LARG) - LARG - FOLGA : Math.floor(novo - LARG) + 1 + LARG + FOLGA;
    if ((d > 0 ? encosta > p[e] : encosta < p[e]) && !this.colideEixo(e, encosta)) p[e] = encosta;
    return false;
  }

  // tem bloco sólido logo abaixo de alguma parte dos pés?
  temApoio(x, z) {
    const y = Math.floor(this.pos.y - 0.01);
    for (let bx = Math.floor(x - LARG); bx <= Math.floor(x + LARG); bx++) for (let bz = Math.floor(z - LARG); bz <= Math.floor(z + LARG); bz++) {
      if (SOLIDO[this.mundo.bloco(bx, y, bz)]) return true;
    }
    return false;
  }

  moverY(d) {
    const p = this.pos, ny = p.y + d;
    if (!this.colide(p.x, ny, p.z)) { p.y = ny; return 0; }
    if (d < 0) { // pousa exatamente em cima do bloco
      const y = Math.floor(ny) + 1;
      if (y <= p.y + FOLGA && !this.colide(p.x, y, p.z)) p.y = y;
      return -1;
    }
    // cabeça encosta no teto
    const y = Math.floor(ny + this.altura - 0.01) - this.altura + 0.01 - FOLGA;
    if (y >= p.y - FOLGA && !this.colide(p.x, y, p.z)) p.y = y;
    return 1;
  }

  // ficou dentro de um bloco (areia caiu, portão fechou, amigo colocou bloco): sai pelo lado mais perto
  desenroscar() {
    const p = this.pos;
    if (!this.colide(p.x, p.y, p.z)) return false;
    const fx = Math.floor(p.x), fz = Math.floor(p.z), fy = Math.floor(p.y);
    const xs = [p.x, fx + LARG + FOLGA, fx + 1 - LARG - FOLGA, fx - LARG - FOLGA, fx + 1 + LARG + FOLGA];
    const zs = [p.z, fz + LARG + FOLGA, fz + 1 - LARG - FOLGA, fz - LARG - FOLGA, fz + 1 + LARG + FOLGA];
    let melhor = null, dm = Infinity;
    for (const y of [p.y, fy + 1, fy + 2]) for (const x of xs) for (const z of zs) {
      const d = (x - p.x) ** 2 + (z - p.z) ** 2 + (y - p.y) ** 2 * 1.5;
      if (d < dm && !this.colide(x, y, z)) { dm = d; melhor = [x, y, z]; }
    }
    if (!melhor) for (let y = fy + 3; y < fy + 40; y++) if (!this.colide(p.x, y, p.z)) { melhor = [p.x, y, p.z]; break; }
    if (!melhor) return false;
    [p.x, p.y, p.z] = melhor;
    this.pico = p.y;
    return true;
  }

  // algum bloco embaixo dos pés (na área do corpo) é deste tipo?
  pisaEm(id) {
    const p = this.pos, y = Math.floor(p.y) - 1;
    for (let x = Math.floor(p.x - LARG); x <= Math.floor(p.x + LARG); x++) for (let z = Math.floor(p.z - LARG); z <= Math.floor(p.z + LARG); z++) {
      if (this.mundo.bloco(x, y, z) === id) return true;
    }
    return false;
  }

  // pousou depois de estar no ar: baque e, com corações ligados, dano de queda alta
  pousou(quicou) {
    const p = this.pos, queda = this.pico - p.y;
    this.pico = p.y;
    if (queda < 2) return;
    const fx = Math.floor(p.x), fz = Math.floor(p.z);
    const macio = quicou || this.naAgua || AGUA[this.mundo.bloco(fx, Math.floor(p.y), fz)] || AGUA[this.mundo.bloco(fx, Math.floor(p.y + 0.4), fz)]
      || this.pisaEm(B.FENO) || this.pisaEm(E.TRAMPOLIM);
    if (macio) return;
    this.baqueY = Math.min(this.baqueY, -Math.min(0.4, (queda - 1.5) * 0.05));
    const n = Math.floor(queda - QUEDA_SEGURA + 1e-6);
    const machucou = n > 0 && vida.dano(n);
    if (this.aoQueda && (machucou || queda > 3)) this.aoQueda(queda, machucou ? n : 0, machucou);
  }

  ocupa(bx, by, bz) {
    const p = this.pos;
    return bx + 1 > p.x - LARG && bx < p.x + LARG && bz + 1 > p.z - LARG && bz < p.z + LARG && by + 1 > p.y && by < p.y + this.altura;
  }
}

// Monstrinhos (opção do mundo, desligada por padrão): aparecem só de noite, chegam perto,
// dão um sustinho ("Buu!") e um empurrãozinho. Com a opção "Monstros machucam", o Buu tira meio coração
// (ver vida.js). Um toque espanta (vira brilho), luz (lampião, lâmpada acesa) afasta,
// e quando o sol nasce todos somem.
import * as THREE from '../vendor/three.module.min.js';
import { matModelo, caixa, juntar } from './modelos.js';
import { SOLIDO, AGUA, B, BRILHO } from './blocos.js';
import { opcoesMundo } from './opcoes-mundo.js';

const MAX = 5;
const matOlho = new THREE.MeshBasicMaterial({ vertexColors: true }); // olhos brilham no escuro

function malha(geo, mat = matModelo) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m; }
function perna(w, h, d, cor, x, y, z) { const m = malha(caixa(w, h, d, cor, 0, -h / 2, 0)); m.position.set(x, y, z); return m; }

// frente = +z
export const TIPOS = {
  // Resmungão: cubinho roxo peludo, sobrancelhas bravas e chifrinhos de pelúcia
  resmungao: {
    vel: 1.5, alt: 1.0, raio: 0.42, pula: false,
    montar() {
      const roxo = 0x6b4fa8, escuro = 0x4a3478;
      const corpo = juntar([
        caixa(0.8, 0.75, 0.75, roxo, 0, 0.62, 0),
        caixa(0.86, 0.12, 0.8, escuro, 0, 0.98, 0), // franjinha
        caixa(0.1, 0.18, 0.1, 0xf2d27a, -0.26, 1.12, 0.1), caixa(0.1, 0.18, 0.1, 0xf2d27a, 0.26, 1.12, 0.1), // chifres
        caixa(0.2, 0.05, 0.02, 0x2a1d45, -0.17, 0.86, 0.385), caixa(0.2, 0.05, 0.02, 0x2a1d45, 0.17, 0.86, 0.385), // sobrancelhas
        caixa(0.3, 0.06, 0.02, 0x2a1d45, 0, 0.45, 0.385), // boca emburrada
      ]);
      const olhos = juntar([
        caixa(0.2, 0.18, 0.02, 0xfff6c9, -0.17, 0.7, 0.385), caixa(0.2, 0.18, 0.02, 0xfff6c9, 0.17, 0.7, 0.385),
        caixa(0.08, 0.08, 0.02, 0x1a1030, -0.15, 0.68, 0.39), caixa(0.08, 0.08, 0.02, 0x1a1030, 0.19, 0.68, 0.39),
      ]);
      return { corpo, olhos, pernas: [0.18, 0.25, 0.18, escuro, [[-0.22, 0.25, 0.15], [0.22, 0.25, 0.15], [-0.22, 0.25, -0.15], [0.22, 0.25, -0.15]]] };
    },
  },
  // Bolotinha: bolinha verde-água de um olho só, com espetinhos macios, que anda pulando
  bolotinha: {
    vel: 1.8, alt: 0.8, raio: 0.36, pula: true,
    montar() {
      const cor = 0x3fb8a8, esp = 0xff9a52;
      const corpo = juntar([
        caixa(0.66, 0.6, 0.66, cor, 0, 0.42, 0), caixa(0.54, 0.72, 0.54, cor, 0, 0.42, 0), caixa(0.74, 0.48, 0.54, cor, 0, 0.42, 0),
        caixa(0.1, 0.14, 0.1, esp, 0, 0.84, 0), caixa(0.1, 0.12, 0.1, esp, -0.2, 0.78, -0.12), caixa(0.1, 0.12, 0.1, esp, 0.2, 0.78, -0.12),
        caixa(0.1, 0.1, 0.1, esp, -0.4, 0.5, 0), caixa(0.1, 0.1, 0.1, esp, 0.4, 0.5, 0),
        caixa(0.22, 0.05, 0.02, 0x17463f, 0, 0.27, 0.335), // boca
      ]);
      const olhos = juntar([caixa(0.26, 0.26, 0.02, 0xfff6c9, 0, 0.5, 0.335), caixa(0.11, 0.11, 0.02, 0x1a1030, 0, 0.48, 0.34)]);
      return { corpo, olhos, pernas: [0.14, 0.12, 0.14, 0x2a8a7d, [[-0.16, 0.12, 0], [0.16, 0.12, 0]]] };
    },
  },
};
const NOMES = Object.keys(TIPOS);

export class Monstros {
  constructor(cena, mundo, som, bichos) {
    this.cena = cena; this.mundo = mundo; this.som = som; this.bichos = bichos;
    this.lista = [];
    this.tempoSpawn = 1;
  }

  criar(tipo, x, y, z) {
    const t = TIPOS[tipo];
    const m = t.montar();
    const g = new THREE.Group();
    g.add(malha(m.corpo));
    g.add(malha(m.olhos, matOlho));
    const pernas = [];
    const [w, h, d, cor, posicoes] = m.pernas;
    for (const p of posicoes) { const pe = perna(w, h, d, cor, ...p); g.add(pe); pernas.push(pe); }
    g.position.set(x, y, z);
    this.cena.add(g);
    const mo = { tipo, t, grupo: g, pernas, x, y, z, vy: 0, dir: Math.random() * 6.28, fase: 0, susto: 0, foge: 0, timer: 0 };
    this.lista.push(mo);
    return mo;
  }

  // noite = sol abaixo do horizonte (tempoDia 0.25 é meio-dia, 0.75 meia-noite)
  static ehNoite(tempoDia) { return Math.sin(tempoDia * Math.PI * 2) < -0.15; }

  tentarSpawn(p) {
    if (this.lista.length >= MAX) return false;
    const ang = Math.random() * Math.PI * 2, dist = 18 + Math.random() * 14;
    const x = Math.floor(p.x + Math.cos(ang) * dist) + 0.5, z = Math.floor(p.z + Math.sin(ang) * dist) + 0.5;
    const y = this.mundo.chao(Math.floor(x), Math.floor(z));
    const topo = this.mundo.bloco(Math.floor(x), y, Math.floor(z));
    if (topo !== B.GRAMA && topo !== B.AREIA && topo !== B.PEDRA && topo !== B.TERRA) return false;
    if (Math.abs(y - p.y) > 12) return false;
    if (this.luzPerto(x, y + 1, z, 8)) return false; // perto de luz não nasce monstrinho
    this.criar(NOMES[Math.floor(Math.random() * NOMES.length)], x, y + 1, z);
    return true;
  }

  // procura um bloco que brilha (lampião, lâmpada acesa) perto; devolve onde está
  luzPerto(x, y, z, r) {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    let melhor = null, md = r * r + 1;
    for (let dy = -2; dy <= 3; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const d = dx * dx + dz * dz;
      if (d >= md) continue;
      if (BRILHO[this.mundo.bloco(bx + dx, by + dy, bz + dz)] > 0) { md = d; melhor = { x: bx + dx + 0.5, z: bz + dz + 0.5 }; }
    }
    return melhor;
  }

  piso(x, z, yRef) {
    const bx = Math.floor(x), bz = Math.floor(z);
    for (let y = Math.floor(yRef) + 2; y > yRef - 6 && y > 0; y--) {
      const b = this.mundo.bloco(bx, y - 1, bz);
      if (SOLIDO[b] || AGUA[b]) return { y, agua: !!AGUA[b] };
    }
    return null;
  }

  atualizar(dt, jog, tempoDia) {
    const noite = opcoesMundo.monstros && Monstros.ehNoite(tempoDia);
    if (noite) {
      this.tempoSpawn -= dt;
      // deu certo: espera um pouco; caiu na água ou num morro: tenta de novo logo
      if (this.tempoSpawn <= 0) this.tempoSpawn = this.tentarSpawn(jog.pos) ? 3 + Math.random() * 4 : 0.4;
    }
    const p = jog.pos;
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const m = this.lista[i];
      const dx = p.x - m.x, dz = p.z - m.z, dist = Math.hypot(dx, dz);
      // de dia (ou se desligarem) somem um por um
      if (!noite && Math.random() < dt * 0.8) { this.espantar(m, false); continue; }
      if (dist > 50) { this.remover(i); continue; }
      m.susto -= dt; m.foge -= dt; m.timer -= dt;
      // de vez em quando confere se tem luz perto (a luz afasta)
      m.olhaLuz = (m.olhaLuz || 0) - dt;
      if (m.olhaLuz <= 0) { m.olhaLuz = 0.5; m.luz = this.luzPerto(m.x, m.y, m.z, 6); }
      let andando = true;
      if (m.luz) { m.dir = Math.atan2(m.x - m.luz.x, m.z - m.luz.z); m.susto = Math.max(m.susto, 0.6); }
      else if (m.foge > 0) m.dir = Math.atan2(-dx, -dz); // depois do sustinho, sai correndo rindo
      else if (dist < 16) m.dir = Math.atan2(dx, dz);
      else if (m.timer <= 0) { m.timer = 2 + Math.random() * 3; m.dir += (Math.random() - 0.5) * 2; }
      if (dist < 0.9 && m.foge <= 0 && !m.luz) andando = false;
      // Buu! (empurrãozinho e pulinho; se o mundo deixar, tira meio coração)
      if (dist < 1.3 && Math.abs(p.y - m.y) < 1.8 && m.susto <= 0) {
        m.susto = 4; m.foge = 2.5;
        const n = dist || 1;
        jog.vel.x += (dx / n) * 6; jog.vel.z += (dz / n) * 6;
        if (!jog.voando) { jog.vel.y = Math.max(jog.vel.y, 5); jog.noChao = false; }
        this.som.tom(330, 0.18, { tipo: 'square', vol: 0.18, ate: 160 });
        this.som.tom(520, 0.12, { tipo: 'triangle', vol: 0.15, atraso: 0.12 });
        this.bichos.icone('sorriso', m.x, m.y + m.t.alt + 0.4, m.z, 1.4, 0.6);
        if (this.aoSusto) this.aoSusto(m);
      }
      if (andando) {
        const vel = m.t.vel * (m.foge > 0 || m.luz ? 1.6 : 1);
        const nx = m.x + Math.sin(m.dir) * vel * dt, nz = m.z + Math.cos(m.dir) * vel * dt;
        const s = this.piso(nx, nz, m.y);
        const alt = s ? s.y - m.y : -99;
        if (s && !s.agua && alt <= 1.05 && alt > -3 && !SOLIDO[this.mundo.bloco(Math.floor(nx), Math.floor(s.y), Math.floor(nz))]) {
          m.x = nx; m.z = nz;
          if (alt > 0.05 && m.vy <= 0) m.vy = 6;
        } else if (m.foge <= 0) m.dir += Math.PI * 0.7;
        if (m.t.pula && m.vy === 0) m.vy = 4.5;
      }
      const s = this.piso(m.x, m.z, m.y);
      const chao = s ? s.y : 0;
      m.vy -= 20 * dt; m.y += m.vy * dt;
      if (m.y <= chao) { m.y = chao; m.vy = 0; }
      // animação
      m.fase += dt * (andando ? 10 : 2);
      const bal = andando ? Math.sin(m.fase) * 0.6 : 0;
      m.pernas.forEach((pe, k) => { pe.rotation.x = (k % 2 ? -1 : 1) * (k > 1 ? -bal : bal); });
      const atual = m.grupo.rotation.y;
      const delta = ((m.dir - atual + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      m.grupo.rotation.y = atual + delta * Math.min(1, dt * 6);
      m.grupo.scale.y = 1 + Math.sin(m.fase * 0.5) * 0.04; // respirando
      m.grupo.position.set(m.x, m.y, m.z);
    }
  }

  // toque no monstrinho: "puf!", vira brilho
  espantar(m, comSom = true) {
    const i = this.lista.indexOf(m);
    if (i < 0) return;
    for (let k = 0; k < 4; k++) this.bichos.icone('brilho', m.x + (Math.random() - 0.5), m.y + 0.4 + Math.random() * 0.6, m.z + (Math.random() - 0.5), 1 + k * 0.15);
    if (comSom) { this.som.tom(880, 0.08, { tipo: 'sine', vol: 0.3, ate: 1400 }); this.som.ruido(0.12, { vol: 0.2, freq: 2000, atraso: 0.03 }); }
    this.remover(i);
  }

  remover(i) {
    const m = this.lista[i];
    this.cena.remove(m.grupo);
    m.grupo.traverse((o) => o.geometry && o.geometry.dispose());
    this.lista.splice(i, 1);
  }

  limpar() { for (let i = this.lista.length - 1; i >= 0; i--) this.remover(i); }

  atingir(o, dir, max) {
    let melhor = null, tm = max;
    for (const m of this.lista) {
      const r = m.t.raio + 0.15;
      const min = [m.x - r, m.y, m.z - r], mx = [m.x + r, m.y + m.t.alt, m.z + r];
      const O = [o.x, o.y, o.z], D = [dir.x, dir.y, dir.z];
      let t0 = 0, t1 = tm, ok = true;
      for (let a = 0; a < 3 && ok; a++) {
        if (Math.abs(D[a]) < 1e-8) { if (O[a] < min[a] || O[a] > mx[a]) ok = false; continue; }
        let ta = (min[a] - O[a]) / D[a], tb = (mx[a] - O[a]) / D[a];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok && t0 < tm) { tm = t0; melhor = m; }
    }
    return melhor ? { monstro: melhor, t: tm } : null;
  }
}

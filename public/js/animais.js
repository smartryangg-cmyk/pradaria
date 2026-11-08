// Bichos pacíficos: aparecem perto do jogador, passeiam, e ganham carinho com um toque.
import * as THREE from '../vendor/three.module.min.js';
import { ESPECIES, montarBicho } from './modelos.js';
import { texturaIcone, nomeEmote } from './icones.js';
import { SOLIDO, AGUA, B } from './blocos.js';
import { opcoesMundo } from './opcoes-mundo.js';

const MAX = 16;
const LISTA = ['ovelha', 'ovelha', 'porquinho', 'galinha', 'galinha', 'vaca', 'cachorro', 'capivara', 'coelho', 'coelho'];

export class Bichos {
  constructor(cena, mundo, som) {
    this.cena = cena; this.mundo = mundo; this.som = som;
    this.lista = [];
    this.particulas = [];
    this.tempoSpawn = 0;
  }

  chao(x, z, yRef) {
    const m = this.mundo;
    const bx = Math.floor(x), bz = Math.floor(z);
    // procura a superfície perto de yRef
    let y = Math.floor(yRef) + 2;
    for (; y > yRef - 6 && y > 0; y--) {
      const b = m.bloco(bx, y - 1, bz);
      if (SOLIDO[b] || AGUA[b]) return { y, agua: !!AGUA[b] };
    }
    return null;
  }

  criar(especie, x, y, z) {
    const r = Math.random();
    const mod = montarBicho(especie, r);
    const e = ESPECIES[especie];
    const b = {
      especie, e, ...mod, x, y, z, vy: 0, dir: Math.random() * Math.PI * 2, andando: false,
      timer: 1 + Math.random() * 3, fase: Math.random() * 10, segue: 0, pulo: 0,
    };
    b.grupo.position.set(x, y, z);
    this.cena.add(b.grupo);
    this.lista.push(b);
    return b;
  }

  tentarSpawn(px, py, pz) {
    if (this.lista.length >= MAX || !opcoesMundo.animais) return;
    const ang = Math.random() * Math.PI * 2, dist = 14 + Math.random() * 18;
    const x = Math.floor(px + Math.cos(ang) * dist) + 0.5, z = Math.floor(pz + Math.sin(ang) * dist) + 0.5;
    const yTopo = this.mundo.chao(Math.floor(x), Math.floor(z));
    const topo = this.mundo.bloco(Math.floor(x), yTopo, Math.floor(z));
    if (topo !== B.GRAMA && topo !== B.AREIA) return;
    if (Math.abs(yTopo - py) > 14) return;
    const esp = LISTA[Math.floor(Math.random() * LISTA.length)];
    const n = esp === 'galinha' || esp === 'coelho' || esp === 'ovelha' ? 1 + Math.floor(Math.random() * 3) : 1;
    for (let i = 0; i < n; i++) this.criar(esp, x + (i % 2) * 1.2, yTopo + 1, z + Math.floor(i / 2) * 1.2);
  }

  atualizar(dt, jog, tempo) {
    const p = jog.pos;
    this.tempoSpawn -= dt;
    if (this.tempoSpawn <= 0) { this.tempoSpawn = 1.5; this.tentarSpawn(p.x, p.y, p.z); }

    for (let i = this.lista.length - 1; i >= 0; i--) {
      const b = this.lista[i];
      const dx = p.x - b.x, dz = p.z - b.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 60) { this.remover(i); continue; }
      if (dist > 40) { b.grupo.visible = false; continue; }
      b.grupo.visible = true;

      b.timer -= dt;
      if (b.segue > 0) {
        b.segue -= dt;
        if (dist > 3) { b.andando = true; b.dir = Math.atan2(dx, dz); }
        else b.andando = false;
      } else if (b.timer <= 0) {
        b.andando = Math.random() < 0.55;
        b.timer = 2 + Math.random() * 4;
        if (b.andando) b.dir += (Math.random() - 0.5) * 2.5;
      }
      const vel = b.e.vel * (b.segue > 0 && dist > 6 ? 2.4 : 1);
      if (b.andando) {
        const nx = b.x + Math.sin(b.dir) * vel * dt, nz = b.z + Math.cos(b.dir) * vel * dt;
        const s = this.chao(nx, nz, b.y);
        const altura = s ? s.y - b.y : -99;
        const podeAgua = b.e.nada || b.segue > 0;
        if (s && altura <= 1.05 && altura > -3 && (!s.agua || podeAgua) && !SOLIDO[this.mundo.bloco(Math.floor(nx), Math.floor(s.y), Math.floor(nz))]
          && !SOLIDO[this.mundo.bloco(Math.floor(nx), Math.floor(s.y) + (b.e.alt > 1 ? 1 : 0), Math.floor(nz))]) {
          b.x = nx; b.z = nz;
          if (altura > 0.05 && b.vy <= 0 && b.y <= Math.floor(b.y) + 0.01) b.vy = 6;
        } else if (b.segue <= 0) { b.dir += Math.PI * (0.5 + Math.random()); b.timer = 1 + Math.random() * 2; }
        if (b.e.pula && b.vy === 0) b.vy = 4;
      }
      // gravidade
      const s = this.chao(b.x, b.z, b.y);
      const piso = s ? s.y - (s.agua ? 0.45 : 0) : 0;
      b.vy -= 20 * dt;
      b.y += b.vy * dt;
      if (b.y <= piso) { b.y = piso; b.vy = 0; }

      // animação
      b.fase += dt * (b.andando ? 9 : 0);
      const balanco = b.andando ? Math.sin(b.fase) * 0.6 : 0;
      b.pernas.forEach((pe, k) => { pe.rotation.x = (k % 2 === (k < 2 ? 0 : 1) ? 1 : -1) * balanco; });
      b.cabeca.rotation.x = b.andando ? 0 : Math.sin(tempo * 1.3 + b.fase) * 0.15 + 0.1;
      let alvo = b.dir;
      let atual = b.grupo.rotation.y;
      let delta = ((alvo - atual + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      b.grupo.rotation.y = atual + delta * Math.min(1, dt * 6);
      b.grupo.position.set(b.x, b.y, b.z);
    }

    // partículas (corações etc.)
    for (let i = this.particulas.length - 1; i >= 0; i--) {
      const q = this.particulas[i];
      q.vida -= dt;
      q.s.position.y += dt * 0.9;
      q.s.material.opacity = Math.min(1, q.vida * 1.5);
      if (q.vida <= 0) { this.cena.remove(q.s); q.s.material.dispose(); this.particulas.splice(i, 1); }
    }
  }

  remover(i) {
    const b = this.lista[i];
    this.cena.remove(b.grupo);
    b.grupo.traverse((o) => o.geometry && o.geometry.dispose());
    this.lista.splice(i, 1);
  }

  // retorna o bicho atingido pelo raio e a distância
  atingir(o, dir, max) {
    let melhor = null, tm = max;
    for (const b of this.lista) {
      if (!b.grupo.visible) continue;
      const r = b.e.raio + 0.15;
      const min = [b.x - r, b.y, b.z - r], mx = [b.x + r, b.y + b.e.alt, b.z + r];
      let t0 = 0, t1 = tm;
      const O = [o.x, o.y, o.z], D = [dir.x, dir.y, dir.z];
      let ok = true;
      for (let a = 0; a < 3; a++) {
        if (Math.abs(D[a]) < 1e-8) { if (O[a] < min[a] || O[a] > mx[a]) { ok = false; break; } continue; }
        let ta = (min[a] - O[a]) / D[a], tb = (mx[a] - O[a]) / D[a];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < tm) { tm = t0; melhor = b; }
    }
    return melhor ? { bicho: melhor, t: tm } : null;
  }

  carinho(b) {
    // segurar o dedo/botão repete o toque a cada 260 ms: sem esse intervalo
    // (e sem exigir o pé no chão) cada toque somava outro pulo e o bicho saía voando
    const agora = performance.now();
    if (b.ultimoCarinho && agora - b.ultimoCarinho < 700) return;
    b.ultimoCarinho = agora;
    this.som.bicho(b.e.som);
    b.andando = false; b.timer = 2;
    if (b.vy === 0) b.vy = 3.5; // pulinho de alegria só saindo do chão
    if (b.e.segue) b.segue = 90;
    for (let k = 0; k < 4; k++) this.icone('coracao', b.x + (Math.random() - 0.5) * 0.8, b.y + b.e.alt + 0.2 + k * 0.25, b.z + (Math.random() - 0.5) * 0.8, 1.2 + k * 0.2);
  }

  // ícone flutuante (coração do carinho, emotes dos jogadores)
  icone(nome, x, y, z, vida = 1.6, escala = 0.45) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaIcone(nome), transparent: true, depthWrite: false }));
    s.position.set(x, y, z);
    s.scale.set(escala, escala, 1);
    this.cena.add(s);
    this.particulas.push({ s, vida });
  }

  // compatibilidade: aceita nome de ícone ou emoji antigo; ignora o que não conhece
  emoji(e, x, y, z, vida, escala) {
    const nome = nomeEmote(e);
    if (nome) this.icone(nome, x, y, z, vida, escala);
  }
}

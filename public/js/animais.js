// Bichos com instintos de verdade (ver instintos.js): bandos que andam juntos, pastam, dormem na hora certa,
// fogem quando a gente chega perto demais, ficam curiosos, mães protegem os filhotes, predadores caçam com
// fome e as presas fogem deles. Os de fazenda ganham carinho com um toque; os selvagens não gostam de toque:
// tocar neles é "fazer barulho" e eles fogem. Com "Animais podem machucar", quem for provocado morde.
//
// Desempenho (tablet fraco): o "pensar" (olhar em volta, decidir) roda só de 0,3 em 0,3 s por bicho,
// espalhado entre os quadros; a cada quadro só anda e anima. Longe do jogador fica escondido e parado.
import * as THREE from '../vendor/three.module.min.js';
import { ESPECIES, montarBicho } from './modelos.js';
import { texturaIcone, nomeEmote } from './icones.js';
import { SOLIDO, AGUA, B, BRILHO } from './blocos.js';
import { G } from './gerador.js';
import { opcoesMundo } from './opcoes-mundo.js';
import { instinto, acordado } from './instintos.js';

const MAX = 18; // bichos ao mesmo tempo perto do jogador
const MAX_PREDADORES = 3; // na natureza há bem menos caçadores que presas
const PENSAR = 0.3; // segundos entre uma decisão e outra
const TAU = Math.PI * 2;

// bioma do mundo clássico (gerador.js BIOMA) -> habitat dos instintos
const HABITAT_BIOMA = [null, null, 'praia', 'beira', 'prado', 'floresta', 'taiga', 'neve', 'deserto', 'savana', 'selva', 'montanha', 'beira'];
// chão onde bicho pode nascer
const CHAO_BOM = new Set([B.GRAMA, B.AREIA, B.PEDRA, B.TERRA, G.NEVE, G.GRAMA_NEVE]);
const sorteio = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const angulo = (dx, dz) => Math.atan2(dx, dz);

export class Bichos {
  constructor(cena, mundo, som) {
    this.cena = cena; this.mundo = mundo; this.som = som;
    this.lista = [];
    this.particulas = [];
    this.tempoSpawn = 0;
    this.proxGrupo = 1;
    this.tempoUivo = 20;
    this.aoMorder = null; // (bicho, dano) => {}  main.js tira vida e empurra
    this.aoAvisar = null; // (bicho) => {}         main.js mostra o aviso "está bravo"
    this.aoCacar = null; // (predador, presa, pegou) => {}
  }

  chao(x, z, yRef) {
    const m = this.mundo;
    const bx = Math.floor(x), bz = Math.floor(z);
    let y = Math.floor(yRef) + 2;
    for (; y > yRef - 6 && y > 0; y--) {
      const b = m.bloco(bx, y - 1, bz);
      if (SOLIDO[b] || AGUA[b]) return { y, agua: !!AGUA[b] };
    }
    return null;
  }

  criar(especie, x, y, z, { filhote = false, grupo = 0, mae = null } = {}) {
    const r = mae && mae.r !== undefined ? mae.r : Math.random(); // filhote puxa a cor da mãe
    const mod = montarBicho(especie, r, filhote);
    const e = ESPECIES[especie];
    const I = instinto(especie);
    const esc = filhote ? 0.55 : 1;
    if (filhote) mod.grupo.scale.setScalar(esc);
    const b = {
      especie, e, I, ...mod, r, x, y, z, vy: 0, dir: Math.random() * TAU, andando: false,
      timer: 1 + Math.random() * 3, fase: Math.random() * 10, segue: 0, pulo: 0,
      estado: 'vagar', vel: 0, pensa: Math.random() * PENSAR, folego: I.folego, fome: Math.random() * 0.5,
      medo: 0, de: null, alvo: null, filhote, mae, grupoId: grupo, esc, deita: 0, cabX: 0,
      calmo: 0, olhaLuz: 0, luz: null, avisou: 0, mordeu: 0, distJog: 99,
    };
    b.grupo.position.set(x, y, z);
    this.cena.add(b.grupo);
    this.lista.push(b);
    return b;
  }

  // que lugar é este? (no mundo clássico vem do bioma; perto d'água vira "beira")
  habitat(x, z, y, topo) {
    const bio = this.mundo.biomaEm ? HABITAT_BIOMA[this.mundo.biomaEm(x, z)] : null;
    const agua = [[6, 0], [-6, 0], [0, 6], [0, -6]].some(([dx, dz]) => AGUA[this.mundo.bloco(x + dx, y, z + dz)]);
    if (bio) return agua && (bio === 'prado' || bio === 'floresta' || bio === 'selva' || bio === 'savana') ? 'beira' : bio;
    if (topo === B.AREIA) return 'praia';
    if (topo === B.PEDRA || y > 40) return 'montanha';
    if (agua) return 'beira';
    const r2 = this.mundo.ruido2;
    if (r2 && r2.fbm(x / 90 + 300, z / 90 - 200, 2) > 0.18) return 'floresta';
    return 'prado';
  }

  tentarSpawn(px, py, pz, sol) {
    if (this.lista.length >= MAX) return;
    const domesticos = opcoesMundo.animais, selvagens = opcoesMundo.selvagens;
    if (!domesticos && !selvagens) return;
    const ang = Math.random() * TAU, dist = 18 + Math.random() * 16;
    const x = Math.floor(px + Math.cos(ang) * dist), z = Math.floor(pz + Math.sin(ang) * dist);
    const yTopo = this.mundo.chao(x, z);
    const topo = this.mundo.bloco(x, yTopo, z);
    if (!CHAO_BOM.has(topo)) return;
    if (Math.abs(yTopo - py) > 14) return;
    const lugar = this.habitat(x, z, yTopo, topo);
    let predadores = 0;
    for (const b of this.lista) if (b.I.dieta === 'carne' || b.I.presas) predadores++;
    // sorteia uma espécie pelo peso do habitat (quem está acordado agora aparece mais)
    const opcoes = [];
    let soma = 0;
    for (const esp of Object.keys(ESPECIES)) {
      const I = instinto(esp);
      if (I.selvagem ? !selvagens : !domesticos) continue;
      if (I.presas && predadores >= MAX_PREDADORES) continue;
      let p = (I.habitat && I.habitat[lugar]) || 0;
      if (!p) continue;
      if (acordado(I.atividade, sol)) p *= 2;
      opcoes.push([esp, p]); soma += p;
    }
    if (!soma) return;
    let r = Math.random() * soma, esp = opcoes[0][0];
    for (const [k, p] of opcoes) { r -= p; if (r <= 0) { esp = k; break; } }
    const I = instinto(esp);
    const grupo = this.proxGrupo++;
    const n = Math.min(sorteio(I.grupo[0], I.grupo[1]), MAX - this.lista.length);
    for (let i = 0; i < n; i++) {
      const bx = x + 0.5 + (i % 3) * 1.4 - 1.4, bz = z + 0.5 + Math.floor(i / 3) * 1.4;
      const mae = this.criar(esp, bx, yTopo + 1, bz, { grupo });
      if (I.filhotes && Math.random() < I.filhotes[0] && this.lista.length < MAX) {
        const nf = Math.min(sorteio(I.filhotes[1], I.filhotes[2]), MAX - this.lista.length);
        for (let f = 0; f < nf; f++) this.criar(esp, bx + 0.6 * (f + 1), yTopo + 1, bz - 0.6, { filhote: true, grupo, mae });
      }
    }
  }

  // procura um bloco que brilha (lampião, lâmpada acesa) perto: bicho selvagem evita luz de noite
  luzPerto(x, y, z, r) {
    const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
    for (let dy = -2; dy <= 3; dy++) for (let dz = -r; dz <= r; dz += 1) for (let dx = -r; dx <= r; dx += 1) {
      if (dx * dx + dz * dz > r * r) continue;
      if (BRILHO[this.mundo.bloco(bx + dx, by + dy, bz + dz)] > 0) return { x: bx + dx + 0.5, z: bz + dz + 0.5 };
    }
    return null;
  }

  atualizar(dt, jog, tempo, tempoDia = 0.3) {
    const p = jog.pos;
    const sol = opcoesMundo.cicloDia === false ? 1 : Math.sin(tempoDia * TAU);
    const noite = sol < -0.15;
    this.tempoSpawn -= dt;
    if (this.tempoSpawn <= 0) { this.tempoSpawn = 1.5; this.tentarSpawn(p.x, p.y, p.z, sol); }
    // uivo de lobo ao longe, de noite (lobos uivam para chamar a matilha)
    if (noite && dt > 0) {
      this.tempoUivo -= dt;
      if (this.tempoUivo <= 0) {
        this.tempoUivo = 35 + Math.random() * 40;
        if (this.lista.some((b) => b.especie === 'lobo' && b.distJog > 12)) this.som.bicho('uivo');
      }
    }
    this._px = p.x; this._pz = p.z;
    const ctx = { p, sol, noite };
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const b = this.lista[i];
      const dx = p.x - b.x, dz = p.z - b.z;
      const dist = Math.hypot(dx, dz);
      b.distJog = dist;
      if (dist > 60) { this.remover(i); continue; }
      if (dist > 40) { b.grupo.visible = false; continue; }
      b.grupo.visible = true;
      if (dt <= 0) continue; // pausado
      b.pensa -= dt;
      if (b.pensa <= 0) { b.pensa = PENSAR * (0.8 + Math.random() * 0.4); this.pensar(b, ctx, jog); }
      this.agir(b, dt, jog);
      if (!this.lista.includes(b)) continue; // virou caça
      this.mover(b, dt);
      this.animar(b, dt, tempo);
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

  mudar(b, estado, timer) { b.estado = estado; b.timer = timer; }

  // olhar em volta e decidir o que fazer (roda poucas vezes por segundo)
  pensar(b, { p, sol, noite }, jog) {
    const I = b.I;
    const dist = b.distJog;
    const ativo = acordado(I.atividade, sol);
    const voando = jog.voando && p.y - b.y > 4; // lá do alto o bicho nem liga
    b.fome = Math.min(1, b.fome + PENSAR / (I.dieta === 'erva' ? 999 : 90));

    // de noite o bicho selvagem procura luz por perto (fogo e lâmpadas afastam)
    if (I.selvagem && noite) {
      b.olhaLuz -= PENSAR;
      if (b.olhaLuz <= 0) { b.olhaLuz = 1; b.luz = this.luzPerto(b.x, b.y, b.z, 6); }
    } else b.luz = null;

    // olha os outros bichos: predador mais perto, centro do bando, filhotes
    let pred = null, dPred = I.alerta;
    let cx = 0, cz = 0, nb = 0, filhoteAmeacado = false;
    for (const o of this.lista) {
      if (o === b) continue;
      const ox = o.x - b.x, oz = o.z - b.z;
      const d = Math.abs(ox) + Math.abs(oz);
      if (d > 24) continue;
      if (o.I.presas && o.I.presas.includes(b.especie) && !b.filhote) {
        const dd = Math.hypot(ox, oz);
        // presa foge do predador que está caçando, ou de qualquer um que chegue perto demais
        const limite = o.estado === 'cacar' ? I.alerta : I.alerta * 0.5;
        if (dd < limite && dd < dPred) { pred = o; dPred = dd; }
      }
      if (o.especie === b.especie && o.grupoId === b.grupoId && !o.filhote) { cx += o.x; cz += o.z; nb++; }
      if (o.mae === b && I.defende && Math.hypot(p.x - o.x, p.z - o.z) < I.defende && !voando) filhoteAmeacado = true;
    }

    // ---- 1. fugir (medo ainda valendo) ----
    if (b.estado === 'fugir' && b.medo > 0) {
      if (b.de === 'jog') b.dir = angulo(b.x - p.x, b.z - p.z);
      else if (b.de && b.de.x !== undefined) b.dir = angulo(b.x - b.de.x, b.z - b.de.z);
      b.dir += (Math.random() - 0.5) * (b.especie === 'coelho' ? 1.6 : 0.4); // coelho foge em zigue-zague
      return;
    }
    // ---- 2. luz de noite: o selvagem se afasta ----
    if (b.luz && b.estado !== 'fugir') { this.fugir(b, b.luz, 3); return; }
    // ---- 3. filhote: segue a mãe e faz o que ela faz ----
    if (b.filhote) {
      const m = b.mae;
      if (!m || !this.lista.includes(m)) b.mae = null; // órfão: segue a vida sozinho
      else {
        const dm = Math.hypot(m.x - b.x, m.z - b.z);
        if (m.estado === 'fugir') { b.estado = 'fugir'; b.medo = m.medo; b.de = m.de; return; }
        if (dm > 2.5) { b.estado = 'seguirMae'; b.dir = angulo(m.x - b.x, m.z - b.z); return; }
        b.estado = m.estado === 'dormir' || m.estado === 'repousar' ? m.estado : m.estado === 'pastar' ? 'pastar' : 'parar';
        return;
      }
    }
    // ---- 4. presa com predador por perto: foge e avisa o bando ----
    if (pred) { this.fugir(b, pred, 4, true); return; }

    // ---- 5. gente chegando perto ----
    const calmo = b.calmo > 0;
    if (b.estado === 'avisar' || b.estado === 'atacar') {
      // se o jogador se afastou (ou saiu voando), o bicho se acalma
      b.defendendo = filhoteAmeacado;
      const longe = Math.max(I.territorio || 0, filhoteAmeacado ? I.defende : 0, 3) * 1.5 + 1;
      if (voando || (dist > longe && !(b.estado === 'atacar' && b.cacandoGente && dist < 18))) { this.mudar(b, 'vagar', 2); b.calmo = 6; b.cacandoGente = false; }
      return;
    }
    if (!voando) {
      // mãe defendendo filhotes, ou bicho de território surpreendido de perto
      b.defendendo = filhoteAmeacado;
      const irrita = (filhoteAmeacado || (I.territorio && dist < I.territorio)) && !calmo;
      if (irrita && b.estado !== 'recuar') {
        this.mudar(b, 'avisar', I.naoPersegue ? 1.2 : 2.6); b.alvo = 'jog';
        this.som.bicho(b.e.som, true);
        if (this.aoAvisar) this.aoAvisar(b);
        return;
      }
      // fome demais à noite, longe de luz: o lobo e a onça podem espreitar o jogador
      if (I.cacaGente && noite && b.fome > 0.92 && dist < 16 && !calmo && b.estado !== 'recuar' && !b.filhote && opcoesMundo.selvagensMachucam) {
        b.estado = 'atacar'; b.cacandoGente = true; b.alvo = 'jog'; b.timer = 6;
        if (this.aoAvisar) this.aoAvisar(b);
        return;
      }
      // distância de fuga (dormindo deixa chegar mais perto); coelho primeiro congela
      const fuga = b.estado === 'dormir' ? I.fuga * 0.5 : I.fuga;
      if (fuga && dist < fuga && b.estado !== 'recuar' && b.segue <= 0) { this.fugir(b, 'jog', 3 + Math.random() * 2, true); return; }
      if (I.congela && dist < I.congela && b.estado !== 'fugir') { b.estado = 'congelar'; b.timer = 1; return; }
    }
    if (b.estado === 'recuar' || b.estado === 'comer' || b.estado === 'descansar') return;
    // ---- 6. cachorro que ganhou carinho segue o jogador ----
    if (b.segue > 0) { b.estado = 'seguir'; return; }
    // ---- 7. dormir fora da hora de atividade ----
    // (os de crepúsculo só repousam deitados no meio do dia/da noite, atentos: não dormem pesado)
    if (!ativo) {
      const modo = I.atividade === 'crepusculo' ? 'repousar' : 'dormir';
      if (b.estado !== modo) this.mudar(b, modo, 8 + Math.random() * 10);
      return;
    }
    if (b.estado === 'repousar' && b.timer > 0) return;
    if (b.estado === 'dormir' && b.timer > 0 && b.fome < 0.9) return; // ainda acordando devagar
    // ---- 8. predador com fome caça ----
    if (I.presas && b.fome > 0.55 && !b.filhote) {
      if (b.estado === 'cacar' && b.alvo && this.lista.includes(b.alvo)) return;
      let presa = null, dp = 22;
      for (const o of this.lista) {
        if (o.filhote || !I.presas.includes(o.especie)) continue;
        const d = Math.hypot(o.x - b.x, o.z - b.z);
        if (d < dp) { dp = d; presa = o; }
      }
      if (presa) {
        b.estado = 'cacar'; b.alvo = presa; b.folego = I.folego;
        // matilha: os lobos do mesmo grupo caçam juntos
        for (const o of this.lista) if (o !== b && o.grupoId === b.grupoId && o.especie === b.especie && !o.filhote && o.estado !== 'fugir') { o.estado = 'cacar'; o.alvo = presa; o.folego = I.folego; }
        return;
      }
    }
    // ---- 9. curioso: chega perto para olhar ----
    if (I.curioso && !calmo && dist < 10 && dist > 3 && b.estado !== 'curioso' && Math.random() < I.curioso * PENSAR * 0.5) {
      this.mudar(b, 'curioso', 4 + Math.random() * 4); return;
    }
    // ---- 10. rotina: pastar, passear, parar (o bando fica junto) ----
    if (b.timer > 0 && (b.estado === 'vagar' || b.estado === 'pastar' || b.estado === 'parar' || b.estado === 'curioso')) {
      if (nb && b.estado === 'vagar') {
        const mx = cx / nb, mz = cz / nb;
        if (Math.hypot(mx - b.x, mz - b.z) > 5) b.dir = angulo(mx - b.x, mz - b.z) + (Math.random() - 0.5) * 0.6;
      }
      return;
    }
    const r = Math.random();
    const come = I.dieta !== 'carne' ? 0.4 : 0;
    if (r < come) this.mudar(b, 'pastar', 3 + Math.random() * 5);
    else if (r < come + 0.35) { this.mudar(b, 'vagar', 2 + Math.random() * 4); b.dir += (Math.random() - 0.5) * 2.5; }
    else this.mudar(b, 'parar', 1.5 + Math.random() * 3);
    // pastar e forragear matam a fome dos que comem planta
    if (b.estado === 'pastar' && I.dieta !== 'carne') b.fome = Math.max(0, b.fome - 0.3);
  }

  fugir(b, de, segundos, alarme = false) {
    b.estado = 'fugir'; b.medo = segundos; b.de = de;
    b.dir = de === 'jog' ? angulo(b.x - this._px, b.z - this._pz) : angulo(b.x - de.x, b.z - de.z);
    // capivara: foge para a água mais perto
    if (b.I.foge_agua) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU, ax = Math.floor(b.x + Math.sin(a) * 7), az = Math.floor(b.z + Math.cos(a) * 7);
        if (AGUA[this.mundo.bloco(ax, Math.floor(b.y) - 1, az)] || AGUA[this.mundo.bloco(ax, Math.floor(b.y), az)]) { b.dir = a; b.paraAgua = true; break; }
      }
    }
    if (!alarme) return;
    // grito de alarme: o bando todo foge junto
    for (const o of this.lista) {
      if (o === b || o.especie !== b.especie || o.estado === 'fugir') continue;
      if (Math.abs(o.x - b.x) + Math.abs(o.z - b.z) < 12) { o.estado = 'fugir'; o.medo = segundos; o.de = de; o.dir = b.dir + (Math.random() - 0.5) * 0.5; }
    }
  }

  // o que fazer a cada quadro com a decisão tomada (velocidade, direção, caçar, morder)
  agir(b, dt, jog) {
    const I = b.I, p = jog.pos;
    b.timer -= dt;
    if (b.calmo > 0) b.calmo -= dt;
    if (b.segue > 0) b.segue -= dt;
    let vel = 0;
    switch (b.estado) {
      case 'fugir':
        b.medo -= dt;
        vel = b.folego > 0 ? I.corrida : b.e.vel * 1.5;
        b.folego -= dt;
        if (b.medo <= 0) { b.estado = 'vagar'; b.timer = 1; b.paraAgua = false; }
        break;
      case 'seguirMae': vel = b.mae ? Math.max(b.e.vel * 1.5, b.mae.vel) : b.e.vel; break;
      case 'seguir': {
        const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
        b.dir = angulo(dx, dz);
        vel = d > 3 ? b.e.vel * (d > 6 ? 2.4 : 1) : 0;
        break;
      }
      case 'curioso': {
        const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
        b.dir = angulo(dx, dz);
        vel = d > 3.2 ? b.e.vel * 0.8 : 0;
        if (b.timer <= 0) { b.estado = 'vagar'; b.timer = 2; b.calmo = 10; }
        break;
      }
      case 'vagar': vel = b.e.vel; break;
      case 'avisar': {
        // fica parado encarando, rosnando (é a hora de se afastar)
        b.dir = angulo(p.x - b.x, p.z - b.z);
        if (b.timer <= 0) {
          const limite = I.bote || Math.max(I.territorio ? I.territorio * 1.3 : 0, b.defendendo ? I.defende * 1.2 : 0);
          if (b.distJog < limite) { b.estado = 'atacar'; b.timer = I.naoPersegue ? 0.6 : 3; }
          else b.timer = 1.2; // continua avisando enquanto o jogador estiver perto
          if (I.naoPersegue && b.estado !== 'atacar') this.som.bicho(b.e.som, true);
        }
        break;
      }
      case 'atacar': {
        const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
        b.dir = angulo(dx, dz);
        vel = I.naoPersegue ? (d < 2 ? 3 : 0) : I.corrida;
        if (d < 1.1 + b.e.raio * b.esc && Math.abs(p.y - b.y) < 1.8) this.morder(b, jog);
        else if (b.timer <= 0) { b.estado = 'recuar'; b.timer = 3; b.calmo = 8; b.cacandoGente = false; }
        break;
      }
      case 'recuar':
        b.dir = angulo(b.x - p.x, b.z - p.z);
        vel = b.e.vel * 1.4;
        if (b.timer <= 0) { b.estado = 'vagar'; b.timer = 2; }
        break;
      case 'cacar': {
        const a = b.alvo;
        if (!a || !this.lista.includes(a)) { b.estado = 'vagar'; b.alvo = null; b.timer = 1; break; }
        const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz);
        b.dir = angulo(dx, dz);
        // espreita devagar e dispara no fim (o fôlego acaba rápido nos felinos)
        const perto = d < (I.corrida > 5.3 ? 7 : 12);
        vel = perto && b.folego > 0 ? I.corrida : b.e.vel * 0.7;
        if (perto) b.folego -= dt;
        if (b.folego <= 0) { b.estado = 'descansar'; b.timer = 6; b.alvo = null; break; }
        if (d < b.e.raio + a.e.raio + 0.3) this.pegar(b, a);
        break;
      }
      case 'comer': case 'descansar':
        if (b.timer <= 0) { b.estado = 'dormir'; b.timer = 10; }
        break;
      case 'congelar':
        if (b.timer <= 0) b.estado = 'vagar';
        break;
      default: break; // parar, pastar, dormir
    }
    if (b.estado !== 'fugir' && b.estado !== 'cacar' && b.folego < I.folego) b.folego = Math.min(I.folego, b.folego + dt * 0.5);
    b.vel = vel;
  }

  // mordida/bicada/empurrão no jogador; depois o bicho recua (assim é na natureza: avisa, avança e sai)
  morder(b, jog) {
    const agora = performance.now();
    if (agora - b.mordeu < 1500) return;
    b.mordeu = agora;
    const dx = jog.pos.x - b.x, dz = jog.pos.z - b.z, n = Math.hypot(dx, dz) || 1;
    jog.vel.x += (dx / n) * 6; jog.vel.z += (dz / n) * 6;
    if (!jog.voando) { jog.vel.y = Math.max(jog.vel.y, 5); jog.noChao = false; }
    this.som.bicho(b.e.som, true);
    b.estado = 'recuar'; b.timer = 3; b.calmo = 10; b.cacandoGente = false; b.fome = Math.max(0, b.fome - 0.2);
    if (this.aoMorder) this.aoMorder(b, b.I.dano || 0);
  }

  // fim da corrida de caça: na maioria das vezes a presa escapa
  pegar(pred, presa) {
    const I = pred.I;
    let chance = I.sucesso || 0.3;
    for (const o of this.lista) if (o !== pred && o.alvo === presa && o.estado === 'cacar') chance += 0.1; // matilha ajuda
    const pegou = Math.random() < chance;
    if (pegou) {
      // sem nada feio: a presa some numa nuvenzinha e o predador fica satisfeito
      for (let k = 0; k < 3; k++) this.icone('brilho', presa.x + (Math.random() - 0.5), presa.y + 0.3 + Math.random() * 0.5, presa.z + (Math.random() - 0.5), 0.8 + k * 0.15, 0.35);
      const i = this.lista.indexOf(presa);
      if (i >= 0) this.remover(i);
      for (const o of this.lista) if (o.alvo === presa) { o.alvo = null; o.estado = 'comer'; o.timer = 5; o.fome = 0; }
    } else {
      // escapou: dá um pique e o predador desiste por um tempo
      this.fugir(presa, pred, 5, true);
      presa.folego = presa.I.folego;
      for (const o of this.lista) if (o.alvo === presa) { o.alvo = null; o.estado = 'descansar'; o.timer = 8; o.fome = Math.max(0.3, o.fome - 0.2); }
    }
    if (this.aoCacar) this.aoCacar(pred, presa, pegou);
  }

  mover(b, dt) {
    const vel = b.vel;
    b.andando = vel > 0.01;
    if (b.andando) {
      const nx = b.x + Math.sin(b.dir) * vel * dt, nz = b.z + Math.cos(b.dir) * vel * dt;
      const s = this.chao(nx, nz, b.y);
      const altura = s ? s.y - b.y : -99;
      const podeAgua = b.e.nada || b.estado === 'seguir' || b.paraAgua || b.estado === 'fugir' && b.I.foge_agua;
      const alto = b.e.alt * b.esc > 1;
      if (s && altura <= 1.05 && altura > -3 && (!s.agua || podeAgua) && !SOLIDO[this.mundo.bloco(Math.floor(nx), Math.floor(s.y), Math.floor(nz))]
        && !SOLIDO[this.mundo.bloco(Math.floor(nx), Math.floor(s.y) + (alto ? 1 : 0), Math.floor(nz))]) {
        b.x = nx; b.z = nz;
        if (altura > 0.05 && b.vy <= 0 && b.y <= Math.floor(b.y) + 0.01) b.vy = 6;
      } else if (b.estado !== 'seguir' && b.estado !== 'atacar') {
        // bateu: tenta outro caminho (fugindo vira menos, para não voltar na direção do perigo)
        b.dir += (b.estado === 'fugir' ? 0.9 : Math.PI * (0.5 + Math.random())) * (Math.random() < 0.5 ? 1 : -1);
        if (b.estado === 'vagar') b.timer = Math.min(b.timer, 1 + Math.random() * 2);
      }
      if (b.e.pula && b.vy === 0) b.vy = vel > 2 ? 5 : 4;
    }
    // gravidade
    const s = this.chao(b.x, b.z, b.y);
    const piso = s ? s.y - (s.agua ? 0.45 : 0) : 0;
    b.vy -= 20 * dt;
    b.y += b.vy * dt;
    if (b.y <= piso) { b.y = piso; b.vy = 0; }
  }

  animar(b, dt, tempo) {
    const dorme = b.estado === 'dormir' || b.estado === 'descansar' || b.estado === 'comer' || b.estado === 'repousar';
    b.deita += ((dorme ? 1 : 0) - b.deita) * Math.min(1, dt * 3);
    const corre = b.vel > b.e.vel * 1.6;
    b.fase += dt * (b.andando ? (corre ? 16 : 9) : 0);
    const balanco = b.andando ? Math.sin(b.fase) * (corre ? 0.9 : 0.6) : 0;
    b.pernas.forEach((pe, k) => { pe.rotation.x = (k % 2 === (k < 2 ? 0 : 1) ? 1 : -1) * balanco * (1 - b.deita) + (k < 2 ? -1.3 : 1.3) * b.deita; });
    // cabeça: baixa pastando, alta e firme em alerta, encostada dormindo
    let cab;
    if (b.estado === 'pastar') cab = 0.75 + Math.sin(tempo * 3 + b.fase) * 0.08;
    else if (b.estado === 'avisar' || b.estado === 'congelar') cab = b.estado === 'avisar' && b.I.dieta !== 'erva' ? 0.25 : -0.2;
    else if (dorme) cab = 0.45;
    else if (b.andando) cab = corre ? 0.15 : 0;
    else cab = Math.sin(tempo * 1.3 + b.fase) * 0.15 + 0.1;
    b.cabX += (cab - b.cabX) * Math.min(1, dt * 6);
    b.cabeca.rotation.x = b.cabX;
    // virar para onde vai
    const atual = b.grupo.rotation.y;
    let alvo = b.dir;
    if (b.especie === 'cobra' && b.andando) alvo += Math.sin(b.fase * 0.6) * 0.35; // serpenteia
    const delta = ((alvo - atual + Math.PI * 3) % TAU) - Math.PI;
    b.grupo.rotation.y = atual + delta * Math.min(1, dt * 6);
    // deitado: o corpo desce até quase o chão
    const desce = b.pernas.length ? b.pernas[0].position.y * 0.7 * b.deita * b.esc : 0;
    // avisando: tremidinha de raiva (rosnado, chocalho)
    const treme = b.estado === 'avisar' ? Math.sin(tempo * 40) * 0.03 : 0;
    b.grupo.position.set(b.x + treme, b.y - desce, b.z);
    // zzz de quem dorme perto do jogador
    if (b.estado === 'dormir' && b.distJog < 14) {
      b.zzz = (b.zzz || Math.random() * 3) - dt;
      if (b.zzz <= 0) { b.zzz = 3.5; this.icone('sono', b.x, b.y + b.e.alt * b.esc + 0.3, b.z, 1.6, 0.35); }
    }
  }

  remover(i) {
    const b = this.lista[i];
    this.cena.remove(b.grupo);
    b.grupo.traverse((o) => o.geometry && o.geometry.dispose());
    this.lista.splice(i, 1);
  }

  limpar() { for (let i = this.lista.length - 1; i >= 0; i--) this.remover(i); }

  // depois de desmaiar: os bichos bravos vão embora
  acalmar() {
    for (let i = this.lista.length - 1; i >= 0; i--) {
      const b = this.lista[i];
      if (b.estado === 'avisar' || b.estado === 'atacar' || b.estado === 'recuar' || b.cacandoGente) this.remover(i);
      else if (b.I.selvagem) b.calmo = 20;
    }
  }

  // retorna o bicho atingido pelo raio e a distância
  atingir(o, dir, max) {
    let melhor = null, tm = max;
    for (const b of this.lista) {
      if (!b.grupo.visible) continue;
      const r = b.e.raio * b.esc + 0.15;
      const min = [b.x - r, b.y, b.z - r], mx = [b.x + r, b.y + b.e.alt * b.esc, b.z + r];
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

  // toque: bicho de fazenda ganha carinho; bicho do mato se assusta com o "barulho" e vai embora
  carinho(b) {
    // segurar o dedo/botão repete o toque a cada 260 ms: sem esse intervalo
    // (e sem exigir o pé no chão) cada toque somava outro pulo e o bicho saía voando
    const agora = performance.now();
    if (b.ultimoCarinho && agora - b.ultimoCarinho < 700) return false;
    b.ultimoCarinho = agora;
    if (b.I.selvagem) { this.espantar(b); return false; }
    this.som.bicho(b.e.som);
    b.andando = false; b.timer = 2; b.calmo = 30;
    if (b.estado === 'fugir' || b.estado === 'dormir' || b.estado === 'avisar' || b.estado === 'atacar') { b.estado = 'parar'; b.medo = 0; }
    if (b.vy === 0) b.vy = 3.5; // pulinho de alegria só saindo do chão
    if (b.e.segue) b.segue = 90;
    for (let k = 0; k < 4; k++) this.icone('coracao', b.x + (Math.random() - 0.5) * 0.8, b.y + b.e.alt * b.esc + 0.2 + k * 0.25, b.z + (Math.random() - 0.5) * 0.8, 1.2 + k * 0.2);
    return true;
  }

  // "xô!": o selvagem foge do jogador (como na vida real: fazer barulho e parecer grande afasta)
  espantar(b) {
    this.som.tom(300, 0.12, { tipo: 'square', vol: 0.15, ate: 520 });
    this.icone('pata', b.x, b.y + b.e.alt * b.esc + 0.3, b.z, 1, 0.4);
    b.calmo = 25; b.cacandoGente = false; b.alvo = null;
    b.folego = b.I.folego;
    this.fugir(b, 'jog', 6, true);
    // a mãe leva os filhotes junto
    for (const o of this.lista) if (o.mae === b) { o.estado = 'fugir'; o.medo = 6; o.de = 'jog'; }
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

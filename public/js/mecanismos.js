// Mecanismos das construções: o que faz as coisas geradas no mundo funcionarem de verdade.
//
//  * Catavento: a hélice gira com o vento (igual para todos: o vento vem do relógio, veja
//    vento() em energia.js) e a caixa de engrenagens vira fonte de energia enquanto venta.
//  * Pedra de moinho: gira quando recebe energia (do catavento, alavanca...). Com ela girando,
//    o trigo da mochila vira farinha.
//  * Forno: toque para acender (sai fumaça e ilumina); aceso, transforma farinha em pão.
//  * Portas: abrem e fecham com um toque (as duas metades e as portas duplas juntas).
//    Os moradores abrem a porta para passar e ela fecha sozinha depois.
//  * Manivela do poço: tira um balde de água.
//
// Só o que o jogador mexe é salvo (porta, forno). A hélice, a pedra girando e a fumaça são
// desenhadas aqui e não pesam: só perto do jogador, poucas malhas, e nada no modo "Leve" além do necessário.
import * as THREE from '../vendor/three.module.min.js';
import { M, SOLIDO, AR } from './blocos.js';
import { vento } from './energia.js';

// blocos que este arquivo anima (o mundo guarda a posição deles ao montar cada pedaço)
export const ESPECIAL = new Uint8Array(256);
ESPECIAL[M.CATAVENTO] = ESPECIAL[M.CATAVENTO_GIRANDO] = ESPECIAL[M.MO_GIRANDO] = ESPECIAL[M.FORNO_ACESO] = 1;

const temMochila = (ui) => !!(ui.mercado.op.mercado || ui.mercado.op.sobrevivencia);
export const ehPorta = (b) => b === M.PORTA || b === M.PORTA_ABERTA;

const RAIO = 56; // blocos: até onde animar
const H4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];

// ---------- geometria juntando caixas (uma malha por objeto = uma chamada de desenho) ----------
function juntarCaixas(lista) {
  const P = [], N = [], C = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (const [sx, sy, sz, px, py, pz, cor, rz = 0] of lista) {
    const g = new THREE.BoxGeometry(sx, sy, sz).toNonIndexed();
    e.set(0, 0, rz); q.setFromEuler(e);
    m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    const c = new THREE.Color(cor);
    for (let i = 0; i < pa.length; i += 3) {
      P.push(pa[i], pa[i + 1], pa[i + 2]); N.push(na[i], na[i + 1], na[i + 2]);
      // um pouco mais escuro embaixo e dos lados (parece sombra, sem custo)
      const k = na[i + 1] > 0.5 ? 1 : na[i + 1] < -0.5 ? 0.6 : 0.82;
      C.push(c.r * k, c.g * k, c.b * k);
    }
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.computeBoundingSphere();
  return g;
}

// hélice: 4 braços de madeira com velas de pano (eixo = z local)
function geoHelice() {
  const L = [];
  L.push([0.5, 0.5, 0.5, 0, 0, 0, 0x6b4524]); // cubo do eixo
  L.push([0.18, 0.18, 0.7, 0, 0, -0.3, 0x55565c]); // eixo entrando na caixa
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
    // braço
    L.push([0.16, 4.1, 0.14, -s * 2.1, c * 2.1, 0.05, 0x7a5030, a]);
    // vela (pano claro) presa de um lado do braço, com ripas
    const ox = -s * 2.45 + c * 0.42, oy = c * 2.45 + s * 0.42;
    L.push([0.7, 3.0, 0.05, ox, oy, 0.12, k % 2 ? 0xf3ead8 : 0xe9dcc2, a]);
    for (const t of [-0.9, 0, 0.9]) L.push([0.78, 0.07, 0.08, ox + -s * t, oy + c * t, 0.16, 0x8a5a30, a]);
  }
  return juntarCaixas(L);
}
// pedra de cima da mó (gira em volta de y)
function geoPedra() {
  const g = new THREE.CylinderGeometry(0.36, 0.36, 0.34, 12).toNonIndexed();
  const n = g.attributes.position.count, C = [];
  for (let i = 0; i < n; i++) {
    const ny = g.attributes.normal.array[i * 3 + 1];
    const x = g.attributes.position.array[i * 3];
    const v = ny > 0.5 ? 0.66 : 0.56 + (x > 0 ? 0.06 : 0);
    C.push(v, v * 0.98, v * 0.94);
  }
  // um "cabo" de madeira para dar para ver que está girando
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  const cabo = juntarCaixas([[0.5, 0.08, 0.08, 0.3, 0.2, 0, 0x7a5030], [0.08, 0.2, 0.08, 0.52, 0.3, 0, 0x6b4524]]);
  const P = [...g.attributes.position.array, ...cabo.attributes.position.array];
  const N = [...g.attributes.normal.array, ...cabo.attributes.normal.array];
  const CC = [...C, ...cabo.attributes.color.array];
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  r.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  r.setAttribute('color', new THREE.Float32BufferAttribute(CC, 3));
  r.computeBoundingSphere();
  g.dispose(); cabo.dispose();
  return r;
}

export class Mecanismos {
  // ui: { aviso(txt, ms, icone), som, mercado, emoji(nome, x, y, z, tam, dur) }
  constructor(cena, ui) {
    this.cena = cena; this.ui = ui;
    this.mundo = null;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.geoHelice = geoHelice();
    this.geoPedra = geoPedra();
    this.ativos = new Map(); // "x,y,z" -> { tipo, obj, x, y, z, b }
    this.giro = 0; // velocidade atual das hélices (rad/s)
    this.angulo = 0;
    this.revisar = 0;
    this.fumaca = [];
    this.matFumaca = new THREE.MeshBasicMaterial({ color: 0xdedad4, transparent: true, opacity: 0.55, depthWrite: false });
    this.matFarinha = new THREE.MeshBasicMaterial({ color: 0xfaf6ea, transparent: true, opacity: 0.8, depthWrite: false });
    this.geoFumaca = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    this.portasAldeoes = new Map(); // portas abertas por moradores: "x,y,z" -> tempo para fechar
    this.somMo = 0;
  }

  usarMundo(mundo) { this.limpar(); this.mundo = mundo; }

  limpar() {
    for (const a of this.ativos.values()) if (a.obj) this.cena.remove(a.obj);
    this.ativos.clear();
    for (const f of this.fumaca) this.cena.remove(f.m);
    this.fumaca.length = 0;
    this.portasAldeoes.clear();
  }

  // ---------- a cada quadro ----------
  atualizar(dt, jog, leve) {
    const m = this.mundo;
    if (!m || !jog) return;
    const p = jog.pos;
    // vento: as hélices aceleram e freiam devagar
    const alvo = vento() * 1.9;
    this.giro += (alvo - this.giro) * Math.min(1, dt * 0.6);
    this.angulo = (this.angulo + this.giro * dt) % (Math.PI * 2);

    this.revisar -= dt;
    if (this.revisar <= 0) { this.revisar = 0.5; this.revisarPerto(p); }

    for (const a of this.ativos.values()) {
      if (a.tipo === 'helice') {
        a.rot.rotation.z = this.angulo + a.fase;
      } else if (a.tipo === 'pedra') {
        a.obj.rotation.y += dt * 2.4;
        if (!leve && Math.random() < dt * 1.5) this.soltar(a.x + 0.5 + (Math.random() - 0.5) * 0.7, a.y + 0.75, a.z + 0.5 + (Math.random() - 0.5) * 0.7, this.matFarinha, 0.5, 0.6);
        const d2 = (a.x - p.x) ** 2 + (a.z - p.z) ** 2;
        if (d2 < 64) { this.somMo -= dt; if (this.somMo <= 0) { this.somMo = 0.7; this.ui.som.ruido && this.ui.som.ruido(0.25, { vol: 0.06, freq: 220 }); } }
      } else if (a.tipo === 'forno') {
        a.t -= dt;
        if (a.t <= 0) { a.t = leve ? 1.6 : 0.7; this.soltar(a.x + 0.5, a.y + 1.1, a.z + 0.5, this.matFumaca, 1, 2.6); }
      }
    }
    // fumaça e farinha subindo
    for (let i = this.fumaca.length - 1; i >= 0; i--) {
      const f = this.fumaca[i];
      f.vida -= dt;
      if (f.vida <= 0) { this.cena.remove(f.m); this.fumaca.splice(i, 1); continue; }
      f.m.position.y += f.sobe * dt;
      f.m.position.x += Math.sin(f.vida * 2 + i) * 0.15 * dt + this.giro * 0.12 * dt;
      const s = f.cresce ? 1 + (f.max - f.vida) * 0.6 : 1;
      f.m.scale.set(s, s, s);
    }
    // portas que os moradores abriram: fecham sozinhas
    for (const [k, t] of this.portasAldeoes) {
      const resta = t - dt;
      if (resta > 0) { this.portasAldeoes.set(k, resta); continue; }
      this.portasAldeoes.delete(k);
      const [x, y, z] = k.split(',').map(Number);
      // só fecha se ninguém (jogador) deixou ela aberta de propósito
      if (m.bloco(x, y, z) === M.PORTA_ABERTA && !this.abertaPeloJogador(x, y, z)) m.energia.definirDerivado(x, y, z, M.PORTA);
    }
  }

  soltar(x, y, z, mat, sobe, vida) {
    if (this.fumaca.length > 40) return;
    const mm = new THREE.Mesh(this.geoFumaca, mat);
    mm.position.set(x, y, z);
    mm.rotation.set(Math.random(), Math.random(), 0);
    if (mat === this.matFarinha) mm.scale.setScalar(0.4);
    this.cena.add(mm);
    this.fumaca.push({ m: mm, sobe, vida, max: vida, cresce: mat === this.matFumaca });
  }

  // procura (nos pedaços já montados) catavento, mó girando e forno aceso perto do jogador
  revisarPerto(p) {
    const m = this.mundo;
    const vistos = new Set();
    const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16), R = Math.ceil(RAIO / 16);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const c = m.chunks.get((pcx + dx) + ',' + (pcz + dz));
      if (!c || !c.temMalha || !c.especiais) continue;
      for (const [x, y, z, b] of c.especiais) {
        if ((x - p.x) ** 2 + (z - p.z) ** 2 > RAIO * RAIO) continue;
        const k = x + ',' + y + ',' + z;
        const atual = m.bloco(x, y, z);
        if (atual !== b && !(atual === M.CATAVENTO_GIRANDO && b === M.CATAVENTO) && !(atual === M.CATAVENTO && b === M.CATAVENTO_GIRANDO)) continue;
        vistos.add(k);
        if (this.ativos.has(k)) continue;
        this.criar(k, x, y, z, b);
      }
    }
    for (const [k, a] of this.ativos) {
      if (vistos.has(k)) continue;
      if (a.obj) this.cena.remove(a.obj);
      this.ativos.delete(k);
    }
  }

  criar(k, x, y, z, b) {
    const m = this.mundo;
    let a;
    if (b === M.CATAVENTO || b === M.CATAVENTO_GIRANDO) {
      // a hélice fica do lado livre (de preferência o oposto à torre)
      let dir = null;
      for (const [dx, dz] of H4) {
        const fora = m.bloco(x + dx, y, z + dz), dentro = m.bloco(x - dx, y, z - dz);
        if (!SOLIDO[fora] && SOLIDO[dentro]) { dir = [dx, dz]; break; }
      }
      if (!dir) for (const [dx, dz] of H4) if (m.bloco(x + dx, y, z + dz) === AR) { dir = [dx, dz]; break; }
      if (!dir) dir = [0, 1];
      const obj = new THREE.Mesh(this.geoHelice, this.mat);
      const g = new THREE.Group();
      g.position.set(x + 0.5 + dir[0] * 0.85, y + 0.5, z + 0.5 + dir[1] * 0.85);
      g.rotation.y = Math.atan2(dir[0], dir[1]);
      g.add(obj);
      obj.castShadow = true;
      this.cena.add(g);
      a = { tipo: 'helice', obj: g, rot: obj, fase: ((x * 7 + z * 13) % 10) * 0.3 };
    } else if (b === M.MO_GIRANDO) {
      const obj = new THREE.Mesh(this.geoPedra, this.mat);
      obj.position.set(x + 0.5, y + 0.62, z + 0.5);
      this.cena.add(obj);
      a = { tipo: 'pedra', obj };
    } else if (b === M.FORNO_ACESO) {
      a = { tipo: 'forno', obj: null, t: Math.random() };
    } else return;
    Object.assign(a, { x, y, z, b });
    this.ativos.set(k, a);
  }

  // ---------- toques do jogador ----------
  // devolve true se o toque foi usado por um mecanismo
  tocar(h, slot) {
    const m = this.mundo, b = h.b, { x, y, z } = h;
    const ui = this.ui;
    if (ehPorta(b)) { this.alternarPorta(x, y, z); return true; }
    if (b === M.FORNO) {
      m.definir(x, y, z, M.FORNO_ACESO);
      ui.som.porta();
      ui.aviso('Forno aceso! Traga farinha para assar pão.', 2600, 'pao');
      return true;
    }
    if (b === M.FORNO_ACESO) {
      if (temMochila(ui) && (ui.mercado.e.itens[M.FARINHA] || 0) > 0) {
        ui.mercado.enviar({ t: 'assar' });
        ui.som.oi();
        ui.emoji('pao', x + 0.5, y + 1.4, z + 0.5, 1.4, 0.6);
        return true;
      }
      m.definir(x, y, z, M.FORNO);
      ui.som.porta();
      ui.aviso(temMochila(ui) ? 'Forno apagado. Para assar pão, moa trigo no moinho de vento e volte com a farinha.' : 'Forno apagado.', 3200, 'pao');
      return true;
    }
    if (b === M.MO || b === M.MO_GIRANDO) {
      if (b === M.MO) {
        ui.aviso('A pedra do moinho está parada: ela precisa de energia. Espere o vento girar o catavento (ou ligue uma alavanca nela).', 4200, 'raio');
        return true;
      }
      if (temMochila(ui)) {
        if ((ui.mercado.e.itens[32] || 0) > 0) {
          ui.mercado.enviar({ t: 'moer' });
          ui.som.oi();
          for (let i = 0; i < 6; i++) this.soltar(x + 0.5 + (Math.random() - 0.5), y + 0.8, z + 0.5 + (Math.random() - 0.5), this.matFarinha, 0.8, 1);
        } else ui.aviso('O moinho está girando! Colha trigo nas plantações e traga aqui para virar farinha.', 3600, 'milho');
      } else {
        for (let i = 0; i < 6; i++) this.soltar(x + 0.5 + (Math.random() - 0.5), y + 0.8, z + 0.5 + (Math.random() - 0.5), this.matFarinha, 0.8, 1);
        ui.aviso('O moinho está moendo!', 1800, 'milho');
      }
      return true;
    }
    if (b === M.SARILHO) {
      ui.som.alavanca();
      ui.pegarAgua();
      ui.aviso('Você tirou um balde de água do poço!', 2200, 'gota');
      return true;
    }
    void slot;
    return false;
  }

  // portas encostadas (as duas metades e portas duplas) abrem e fecham juntas
  grupoPorta(x, y, z) {
    const m = this.mundo, out = [], visto = new Set(), pilha = [[x, y, z]];
    while (pilha.length && out.length < 12) {
      const [a, b, c] = pilha.pop();
      const k = a + ',' + b + ',' + c;
      if (visto.has(k)) continue;
      visto.add(k);
      if (!ehPorta(m.bloco(a, b, c))) continue;
      out.push([a, b, c]);
      pilha.push([a, b + 1, c], [a, b - 1, c], [a + 1, b, c], [a - 1, b, c], [a, b, c + 1], [a, b, c - 1]);
    }
    return out;
  }

  alternarPorta(x, y, z) {
    const m = this.mundo;
    const abrir = m.bloco(x, y, z) === M.PORTA;
    for (const [a, b, c] of this.grupoPorta(x, y, z)) {
      this.portasAldeoes.delete(a + ',' + b + ',' + c);
      m.definir(a, b, c, abrir ? M.PORTA_ABERTA : M.PORTA);
    }
    this.ui.som.porta();
  }

  // a porta está aberta porque alguém (salvo) abriu? (as dos moradores não são salvas)
  abertaPeloJogador(x, y, z) {
    const m = this.mundo;
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    const ed = m.edicoes.get(cx + ',' + cz);
    if (!ed) return false;
    return ed.get((x - cx * 16) + (z - cz * 16) * 16 + y * 256) === M.PORTA_ABERTA;
  }

  // um morador quer passar: abre a porta só neste aparelho (não salva) e fecha depois
  abrirParaMorador(x, y, z) {
    const m = this.mundo;
    if (!m || m.bloco(x, y, z) !== M.PORTA) return false;
    for (const [a, b, c] of this.grupoPorta(x, y, z)) {
      if (m.bloco(a, b, c) !== M.PORTA) continue;
      m.energia.definirDerivado(a, b, c, M.PORTA_ABERTA);
      this.portasAldeoes.set(a + ',' + b + ',' + c, 2.5);
    }
    return true;
  }
}

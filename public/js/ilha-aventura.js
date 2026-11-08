// Ilha de Aventura: um tipo de mundo montado como os mapas de ilha dos jogos de ação,
// mas sem armas e sem luta. Uma ilha fechada cercada de mar, com lugares que têm nome
// (cidades, porto, farol, fábrica, fazendas, castelo, acampamento...), estradas ligando
// tudo, pontes sobre o rio, e muita coisa para explorar e se esconder atrás.
// Tudo nasce da semente: todos os jogadores veem a mesma ilha e o servidor guarda só as edições.
import { criarRuido, hash3, rngSemente } from './ruido.js';
import { AR, B, PLANTA } from './blocos.js';

const NA = 20; // nível da água (igual ao de mundo.js)
const ALT = 64;
export const LIMITE_AVENTURA = 256; // meia-largura do mundo (o jogador não passa disso)
const R = 210; // raio médio da ilha
const CEL = 32; // grade para achar estradas e lugares perto de um ponto

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// tipos de lugar: raio da área aplainada, forma (q = quadrado), nomes e ícone do aviso
const TIPOS = {
  cidade: { r: 37, q: true, nomes: ['Cidade Girassol', 'Cidade das Pipas', 'Centro Arco-Íris', 'Cidade Bem-te-vi'] },
  vila: { r: 18, nomes: ['Vila do Tatu', 'Recanto das Pitangas', 'Vilarejo do Sabiá', 'Aldeia do Caqui'] },
  fazenda: { r: 25, nomes: ['Fazenda Boa Vista', 'Sítio do Milho Verde', 'Rancho das Ovelhas'] },
  fabrica: { r: 22, q: true, nomes: ['Fábrica de Brinquedos', 'Fábrica de Doces'] },
  patio: { r: 18, q: true, nomes: ['Pátio dos Contêineres', 'Armazém Colorido'] },
  castelo: { r: 16, q: true, nomes: ['Castelinho da Colina', 'Castelo das Andorinhas'] },
  acampamento: { r: 12, nomes: ['Acampamento Vagalume', 'Camping das Estrelas'] },
  catavento: { r: 14, nomes: ['Colina dos Cata-ventos', 'Morro do Vento'] },
  mirante: { r: 9, nomes: ['Pico do Gavião', 'Mirante das Nuvens'] },
  farol: { r: 8, nomes: ['Farol da Ponta', 'Farol do Golfinho'] },
  porto: { r: 15, nomes: ['Porto Sereno', 'Cais das Gaivotas'] },
};
// ícone (icones.js) de cada tipo de lugar, para o aviso e os mapas
export const ICONE_LUGAR = { cidade: 'vila', vila: 'casa', fazenda: 'milho', fabrica: 'engrenagem', patio: 'bloco', castelo: 'castelo', acampamento: 'estrela', catavento: 'flor', mirante: 'montanha', farol: 'pino', porto: 'onda' };
const ORDEM = ['cidade', 'cidade', 'fabrica', 'fazenda', 'vila', 'patio', 'castelo', 'fazenda', 'vila', 'acampamento', 'catavento'];
const CORES_CONT = [B.LA_VERMELHA, B.LA_AZUL, B.LA_AMARELA, B.LA_VERDE, B.LA_ROSA, B.LA_BRANCA];
const TELHADOS = [B.LA_VERMELHA, B.LA_AZUL, B.TABUAS, B.LA_VERDE, B.LA_AMARELA];

export class IlhaAventura {
  constructor(mundo) {
    this.m = mundo;
    this.s = mundo.semente;
    this.r1 = criarRuido(this.s + 4242);
    this.r2 = criarRuido(this.s + 777);
    this.planejar();
  }

  // ---------- relevo ----------
  // altura "natural" (antes de aplainar lugares e estradas)
  bruta(x, z) {
    const r1 = this.r1, r2 = this.r2;
    const borda = Math.hypot(x, z) / R + r1.fbm(x / 170 + 50, z / 170 - 30, 3) * 0.3;
    const terra = smooth(1.02, 0.8, borda); // 1 = terra, 0 = mar
    let h = 24 + r2.fbm(x / 95, z / 95, 3) * 5 + r1.fbm(x / 38, z / 38, 2) * 1.6;
    const M = this.montanha;
    if (M) {
      const dm = Math.hypot(x - M.x, z - M.z);
      h += 27 * Math.exp(-(dm * dm) / (2 * 42 * 42)) * (0.85 + 0.3 * r2.fbm(x / 28, z / 28, 2));
    }
    h = lerp(NA - 9, h, terra);
    // rio
    if (this.rio) {
      const dr = this.distRio(x, z);
      if (dr < 11) h = Math.min(h, lerp(NA - 3, h, smooth(3.5, 11, dr)));
    }
    return h;
  }

  distRio(x, z) {
    let m = 1e9;
    const p = this.rio;
    for (let i = 0; i < p.length - 1; i++) m = Math.min(m, distSeg(x, z, p[i], p[i + 1]).d);
    return m;
  }

  // altura final do chão (o Mundo chama isso no lugar do relevo normal)
  altura(x, z) {
    const b = this.bruta(x, z);
    let h = b;
    const cel = this.grade.get(Math.floor(x / CEL) + ',' + Math.floor(z / CEL));
    if (cel) {
      // estradas: aplainam o chão na altura da estrada (sobre a água viram ponte)
      if (b > NA) {
        let melhor = null;
        for (const s of cel.estradas) {
          const q = distSeg(x, z, s.a, s.b);
          if (q.d < 10 && (!melhor || q.d < melhor.d)) melhor = { d: q.d, y: lerp(s.a.y, s.b.y, q.t) };
        }
        if (melhor) h = lerp(melhor.y, h, smooth(3.5, 10, melhor.d));
      }
      // lugares: chão retinho na altura do lugar, com uma rampa suave em volta
      for (const L of cel.lugares) {
        const d = L.q ? Math.max(Math.abs(x - L.x), Math.abs(z - L.z)) : Math.hypot(x - L.x, z - L.z);
        if (d < L.r + 12) h = lerp(L.y, h, smooth(L.r, L.r + 12, d));
      }
    }
    return Math.max(4, Math.floor(h));
  }

  // ---------- planejamento (só números) ----------
  planejar() {
    const rng = rngSemente((Math.imul(this.s, 2654435761) ^ 0x51ed) >>> 0);
    for (let k = 0; k < 5; k++) rng();
    const ang = (a, d) => [Math.cos(a) * d, Math.sin(a) * d];
    // montanha
    const am = rng() * Math.PI * 2;
    const [mx, mz] = ang(am, R * 0.42);
    this.montanha = { x: mx, z: mz };
    // rio: atravessa a ilha de um lado ao outro, longe da montanha, fazendo curvas
    const ar = am + Math.PI / 2 + (rng() - 0.5) * 0.8;
    const desv = (rng() - 0.5) * 60;
    const nx = -Math.sin(ar), nz = Math.cos(ar);
    this.rio = [];
    const fase = rng() * 6;
    for (let i = 0; i <= 20; i++) {
      const t = -1.3 + (2.6 * i) / 20;
      const w = Math.sin(t * 3.2 + fase) * 22 + desv;
      this.rio.push({ x: Math.cos(ar) * t * R + nx * w, z: Math.sin(ar) * t * R + nz * w });
    }
    this.lugares = [];
    const usados = {};
    const nomeDe = (tipo) => {
      const l = TIPOS[tipo].nomes; const i = (usados[tipo] = (usados[tipo] ?? Math.floor(rng() * l.length)) + 1) - 1;
      return l[i % l.length];
    };
    const add = (tipo, x, z, extra = {}) => {
      const T = TIPOS[tipo];
      x = Math.round(x); z = Math.round(z);
      const y = Math.max(NA + 2, Math.min(44, Math.round(this.bruta(x, z))));
      const L = { tipo, nome: nomeDe(tipo), x, z, y, r: T.r, q: !!T.q, ...extra };
      this.lugares.push(L);
      return L;
    };
    const longe = (x, z, r, folga) => this.lugares.every((L) => Math.hypot(L.x - x, L.z - z) > L.r + r + folga);
    add('mirante', mx, mz);
    // litoral: porto e farol, em lados diferentes da ilha
    const costa = (a) => {
      for (let d = R * 0.5; d < R * 1.4; d += 2) { const [x, z] = ang(a, d); if (this.bruta(x, z) <= NA + 0.5) return { x, z, d }; }
      return null;
    };
    const ap = am + Math.PI + (rng() - 0.5);
    for (const [tipo, a0, rec] of [['porto', ap, 14], ['farol', ap + 2 + rng(), 4]]) {
      for (let k = 0; k < 12; k++) {
        const a = a0 + k * 0.4 * (k % 2 ? 1 : -1);
        const c = costa(a); if (!c) continue;
        const [x, z] = ang(a, c.d - rec - TIPOS[tipo].r * 0.6);
        if (this.distRio(x, z) < TIPOS[tipo].r + 14 || !longe(x, z, TIPOS[tipo].r, 20)) continue;
        add(tipo, x, z, { dir: [Math.cos(a), Math.sin(a)] });
        break;
      }
    }
    // o resto, no interior da ilha
    for (const [i, tipo] of ORDEM.entries()) {
      const T = TIPOS[tipo];
      for (let k = 0; k < 400; k++) {
        const dmax = i === 0 && k < 200 ? R * 0.35 : R * 0.78;
        const [x, z] = ang(rng() * Math.PI * 2, Math.sqrt(rng()) * dmax);
        const h = this.bruta(x, z);
        if (h < NA + 2 || h > (tipo === 'castelo' || tipo === 'catavento' ? 42 : 36)) continue;
        if (this.distRio(x, z) < T.r * (T.q ? 1.42 : 1) + 14) continue;
        if (!longe(x, z, T.r, 18)) continue;
        // a área toda tem que estar em terra
        let ok = true;
        for (let a = 0; a < 8 && ok; a++) { const [ox, oz] = ang(a * Math.PI / 4, T.r * 1.3); if (this.bruta(x + ox, z + oz) <= NA + 1) ok = false; }
        if (!ok) continue;
        add(tipo, x, z);
        break;
      }
    }
    // estradas: árvore geradora mínima + alguns atalhos
    const P = this.lugares, n = P.length;
    const arestas = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) arestas.push([Math.hypot(P[i].x - P[j].x, P[i].z - P[j].z), i, j]);
    arestas.sort((a, b) => a[0] - b[0]);
    const pai = P.map((_, i) => i);
    const raiz = (i) => (pai[i] === i ? i : (pai[i] = raiz(pai[i])));
    const lig = [];
    const extras = [];
    for (const [d, i, j] of arestas) {
      if (raiz(i) !== raiz(j)) { pai[raiz(i)] = raiz(j); lig.push([i, j]); } else if (d < 170) extras.push([i, j]);
    }
    // atalhos: até 2 pontes a mais sobre o rio e 2 outros caminhos curtos
    const cruza = ([i, j]) => { for (let k = 1; k < 30; k++) { const t = k / 30; if (this.distRio(lerp(P[i].x, P[j].x, t), lerp(P[i].z, P[j].z, t)) < 3) return true; } return false; };
    const pontes = extras.filter((e) => cruza(e) && Math.hypot(P[e[0]].x - P[e[1]].x, P[e[0]].z - P[e[1]].z) < 170).slice(0, 2);
    for (const e of [...pontes, ...extras.filter((e) => !pontes.includes(e) && !cruza(e)).slice(0, 2)]) lig.push(e);
    this.estradas = lig.map(([i, j]) => ({ a: { x: P[i].x, z: P[i].z, y: P[i].y }, b: { x: P[j].x, z: P[j].z, y: P[j].y }, la: P[i], lb: P[j] }));
    // grade de busca
    this.grade = new Map();
    const pegar = (gx, gz) => { const k = gx + ',' + gz; let c = this.grade.get(k); if (!c) this.grade.set(k, (c = { estradas: [], lugares: [] })); return c; };
    for (const s of this.estradas) {
      const x0 = Math.floor((Math.min(s.a.x, s.b.x) - 12) / CEL), x1 = Math.floor((Math.max(s.a.x, s.b.x) + 12) / CEL);
      const z0 = Math.floor((Math.min(s.a.z, s.b.z) - 12) / CEL), z1 = Math.floor((Math.max(s.a.z, s.b.z) + 12) / CEL);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
        const cx = (gx + 0.5) * CEL, cz = (gz + 0.5) * CEL;
        if (distSeg(cx, cz, s.a, s.b).d < 12 + CEL * 0.71) pegar(gx, gz).estradas.push(s);
      }
    }
    // o que vai em cada lugar
    for (const L of this.lugares) {
      L.pecas = [];
      const rl = rngSemente((Math.imul(L.x, 73856093) ^ Math.imul(L.z, 19349663) ^ this.s) >>> 0);
      this['montar_' + L.tipo](L, rl);
      for (const p of L.pecas) if (!p.r) p.r = [p.x - 1, p.z - 1, p.x + 1, p.z + 1];
    }
    // cada lugar entra em todas as células que a área dele ou alguma peça (ex.: o cais) toca
    for (const L of this.lugares) {
      const e = L.r + 14;
      let x0 = L.x - e, z0 = L.z - e, x1 = L.x + e, z1 = L.z + e;
      for (const p of L.pecas) { x0 = Math.min(x0, p.r[0] - 4); z0 = Math.min(z0, p.r[1] - 4); x1 = Math.max(x1, p.r[2] + 4); z1 = Math.max(z1, p.r[3] + 4); }
      for (let gx = Math.floor(x0 / CEL); gx <= Math.floor(x1 / CEL); gx++)
        for (let gz = Math.floor(z0 / CEL); gz <= Math.floor(z1 / CEL); gz++) pegar(gx, gz).lugares.push(L);
    }
  }

  // ---------- montagem de cada tipo de lugar (lista de peças) ----------
  montar_cidade(L, rng) {
    const { x: X, z: Z, y } = L;
    const ruas = [-33, -11, 11, 33];
    // ruas de 5 de largura
    for (const o of ruas) {
      L.pecas.push({ tipo: 'piso', r: [X + o - 2, Z - 35, X + o + 2, Z + 35], y, mat: B.PEDRA, faixa: 'z', meio: X + o });
      L.pecas.push({ tipo: 'piso', r: [X - 35, Z + o - 2, X + 35, Z + o + 2], y, mat: B.PEDRA, faixa: 'x', meio: Z + o });
    }
    for (const o of ruas) for (const p of ruas) L.pecas.push({ tipo: 'piso', r: [X + o - 2, Z + p - 2, X + o + 2, Z + p + 2], y, mat: B.PEDRA });
    // postes nas esquinas
    for (const o of ruas) for (const p of ruas) L.pecas.push({ tipo: 'poste', x: X + o + 3, z: Z + p + 3, y });
    // quarteirões 17x17
    const lotes = [];
    for (const a of [-30, -8, 14]) for (const b of [-30, -8, 14]) lotes.push([X + a, Z + b, X + a + 16, Z + b + 16]);
    const conteudo = ['predio', 'predio', 'predio', 'casas', 'casas', 'quadra', 'mercado', 'predio'];
    for (let i = conteudo.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [conteudo[i], conteudo[j]] = [conteudo[j], conteudo[i]]; }
    let k = 0;
    for (const lt of lotes) {
      const centro = lt[0] === X - 8 && lt[1] === Z - 8;
      const t = centro ? 'praca' : conteudo[k++];
      // calçada
      L.pecas.push({ tipo: 'piso', r: lt, y, mat: B.PEDRISCO });
      const [x0, z0, x1, z1] = lt;
      if (t === 'praca') this.montarPraca(L, lt, rng);
      else if (t === 'predio') {
        const w = 10 + Math.floor(rng() * 4), l = 10 + Math.floor(rng() * 4);
        const px = x0 + 1 + Math.floor(rng() * (15 - w)), pz = z0 + 1 + Math.floor(rng() * (15 - l));
        L.pecas.push({
          tipo: 'predio', r: [px, pz, px + w - 1, pz + l - 1], y, andares: 2 + Math.floor(rng() * 3),
          parede: [B.TIJOLO, B.PEDRISCO, B.LA_BRANCA, B.LA_AMARELA, B.LA_ROSA][Math.floor(rng() * 5)],
        });
      } else if (t === 'casas') {
        for (const [cx, cz, lado] of [[x0 + 4, z0 + 3, -1], [x1 - 4, z0 + 3, -1], [x0 + 4, z1 - 3, 1], [x1 - 4, z1 - 3, 1]]) this.casa(L, cx, cz, 0, lado, rng, 'tijolo');
      } else if (t === 'quadra') {
        L.pecas.push({ tipo: 'quadra', r: [x0 + 1, z0 + 3, x1 - 1, z1 - 3], y });
      } else if (t === 'mercado') {
        L.pecas.push({ tipo: 'galpao', r: [x0 + 2, z0 + 3, x1 - 2, z1 - 3], y, parede: B.TABUAS, teto: B.LA_VERDE, aberto: true });
        for (let i = 0; i < 3; i++) L.pecas.push({ tipo: 'barraca_feira', x: x0 + 5 + i * 4, z: z0 + 8, y, cor: CORES_CONT[i] });
      }
    }
  }

  montarPraca(L, [x0, z0, x1, z1], rng) {
    const y = L.y, cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
    L.pecas.push({ tipo: 'fonte', x: cx, z: cz, y, r: [cx - 3, cz - 3, cx + 3, cz + 3] });
    for (const [ax, az] of [[x0 + 2, z0 + 2], [x1 - 2, z0 + 2], [x0 + 2, z1 - 2], [x1 - 2, z1 - 2]]) L.pecas.push({ tipo: 'arvore', x: ax, z: az, y, r: [ax - 2, az - 2, ax + 2, az + 2] });
    for (const [bx, bz] of [[cx, z0 + 1], [cx, z1 - 1], [x0 + 1, cz], [x1 - 1, cz]]) L.pecas.push({ tipo: 'banco', x: bx, z: bz, y });
    for (const [lx, lz] of [[cx - 5, cz], [cx + 5, cz], [cx, cz - 5], [cx, cz + 5]]) L.pecas.push({ tipo: 'poste', x: lx, z: lz, y });
  }

  // casa pequena (usa o pintor de casas das vilas). (cx,cz) = centro; porta virada para (dx,dz)
  casa(L, cx, cz, dx, dz, rng, estilo = 'campo', celeiro = false) {
    const w = celeiro ? 7 : 5, l = celeiro ? 7 : 5, h = (w - 1) / 2, k = (l - 1) / 2;
    const r = [cx - h, cz - k, cx + h, cz + k];
    let porta, dentro, frente;
    if (dz) { const pz = dz > 0 ? r[3] : r[1]; porta = [cx, pz]; dentro = [cx, pz - dz]; frente = [cx, pz + dz]; }
    else { const px = dx > 0 ? r[2] : r[0]; porta = [px, cz]; dentro = [px - dx, cz]; frente = [px + dx, cz]; }
    const E = {
      campo: { parede: B.TABUAS, canto: B.TRONCO, piso: B.TABUAS },
      tijolo: { parede: B.TIJOLO, canto: B.PEDRISCO, piso: B.TABUAS },
    }[estilo];
    L.pecas.push({
      tipo: 'casa', tipoCasa: celeiro ? 'celeiro' : 'casa', r, y: L.y, porta, dentro, frente, ...E,
      telhado: celeiro ? B.LA_VERMELHA : TELHADOS[Math.floor(rng() * TELHADOS.length)],
      cama: CORES_CONT[Math.floor(rng() * 5)],
    });
  }

  montar_vila(L, rng) {
    const { x, z, y } = L;
    L.pecas.push({ tipo: 'praca_vila', r: [x - 4, z - 4, x + 4, z + 4], y });
    const pos = [[0, -10, 0, 1], [0, 10, 0, -1], [-10, 0, 1, 0], [10, 0, -1, 0], [-9, -9, 0, 1], [9, -9, 0, 1], [-9, 9, 0, -1], [9, 9, 0, -1]];
    for (const [ox, oz, dx, dz] of pos) if (rng() < 0.85) this.casa(L, x + ox, z + oz, dx, dz, rng);
    L.pecas.push({ tipo: 'poste', x: x + 5, z: z + 5, y }, { tipo: 'poste', x: x - 5, z: z - 5, y });
  }

  montar_fazenda(L, rng) {
    const { x, z, y } = L;
    this.casa(L, x - 8, z - 8, 0, 1, rng, 'campo', true); // celeiro
    this.casa(L, x + 9, z - 9, 0, 1, rng); // casa da fazenda
    L.pecas.push({ tipo: 'silo', x: x - 1, z: z - 13, y }, { tipo: 'silo', x: x + 3, z: z - 13, y });
    for (const [ox, oz] of [[-14, 4], [-2, 4], [10, 4], [-14, 13], [-2, 13]]) {
      const r = [x + ox, z + oz, x + ox + 8, z + oz + 6];
      L.pecas.push({ tipo: 'campo', r, y, porta: [r[0] + 4, r[1]], frente: [r[0] + 4, r[1] - 1] });
    }
    for (let i = 0; i < 9; i++) {
      const fx = x - 18 + Math.floor(rng() * 36), fz = z - 4 + Math.floor(rng() * 6);
      L.pecas.push({ tipo: 'fardo', x: fx, z: fz, y, alto: rng() < 0.4 });
    }
    L.pecas.push({ tipo: 'cerca', r: [x - 22, z - 20, x + 22, z + 22], y });
  }

  montar_fabrica(L, rng) {
    const { x, z, y } = L;
    L.pecas.push({ tipo: 'piso', r: [x - 21, z - 21, x + 21, z + 21], y, mat: B.PEDRISCO });
    L.pecas.push({ tipo: 'muro', r: [x - 21, z - 21, x + 21, z + 21], y, mat: B.TIJOLO, alto: 2 });
    L.pecas.push({ tipo: 'galpao', r: [x - 12, z - 9, x + 12, z + 5], y, parede: B.TIJOLO, teto: B.PEDRISCO, alto: 7 });
    L.pecas.push({ tipo: 'chamine', x: x - 7, z: z - 12, y }, { tipo: 'chamine', x: x + 7, z: z - 12, y });
    this.conteineres(L, rng, x - 18, z + 10, x + 18, z + 18, 5);
    L.pecas.push({ tipo: 'poste', x: x - 15, z: z + 8, y }, { tipo: 'poste', x: x + 15, z: z + 8, y });
  }

  conteineres(L, rng, x0, z0, x1, z1, n) {
    const ocup = [];
    for (let k = 0; k < n * 8 && ocup.length < n; k++) {
      const longoX = rng() < 0.5;
      const w = longoX ? 7 : 3, l = longoX ? 3 : 7;
      const cx = x0 + Math.floor(rng() * Math.max(1, x1 - x0 - w)), cz = z0 + Math.floor(rng() * Math.max(1, z1 - z0 - l));
      const r = [cx, cz, cx + w - 1, cz + l - 1];
      if (ocup.some((o) => r[0] <= o[2] + 1 && r[2] >= o[0] - 1 && r[1] <= o[3] + 1 && r[3] >= o[1] - 1)) continue;
      ocup.push(r);
      const cor = CORES_CONT[Math.floor(rng() * CORES_CONT.length)];
      L.pecas.push({ tipo: 'conteiner', r, y: L.y, cor, longoX, abre: rng() < 0.5 ? 1 : -1 });
      if (rng() < 0.4) L.pecas.push({ tipo: 'conteiner', r, y: L.y + 3, cor: CORES_CONT[Math.floor(rng() * CORES_CONT.length)], longoX, fechado: true });
    }
  }

  montar_patio(L, rng) {
    const { x, z, y } = L;
    L.pecas.push({ tipo: 'piso', r: [x - 17, z - 17, x + 17, z + 17], y, mat: B.PEDRISCO });
    this.conteineres(L, rng, x - 16, z - 16, x + 16, z + 16, 12);
    L.pecas.push({ tipo: 'guindaste', x: x + 14, z: z - 14, y, r: [x, z - 16, x + 16, z - 12] });
  }

  montar_castelo(L) {
    const { x, z, y } = L;
    L.pecas.push({ tipo: 'castelo', r: [x - 13, z - 13, x + 13, z + 13], y });
  }

  montar_acampamento(L, rng) {
    const { x, z, y } = L;
    L.pecas.push({ tipo: 'fogueira', x, z, y });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rng() * 0.3;
      L.pecas.push({ tipo: 'barraca', x: Math.round(x + Math.cos(a) * 8), z: Math.round(z + Math.sin(a) * 8), y, cor: CORES_CONT[i % 5], longoX: Math.abs(Math.cos(a)) < 0.7 });
    }
    for (const [ox, oz, lx] of [[-3, 0, false], [3, 0, false], [0, -3, true], [0, 3, true]]) L.pecas.push({ tipo: 'tora', x: x + ox, z: z + oz, y, longoX: lx });
  }

  montar_catavento(L, rng) {
    const { x, z, y } = L;
    for (const [ox, oz] of [[-7, -5], [6, -6], [0, 7]]) L.pecas.push({ tipo: 'catavento', x: x + ox, z: z + oz, y, r: [x + ox - 4, z + oz - 2, x + ox + 4, z + oz + 2], fase: rng() < 0.5 });
  }

  montar_mirante(L) {
    L.pecas.push({ tipo: 'torre', x: L.x, z: L.z, y: L.y, alto: 10, nucleo: B.TRONCO, faixa: null, r: [L.x - 4, L.z - 4, L.x + 4, L.z + 4] });
  }

  montar_farol(L, rng) {
    L.pecas.push({ tipo: 'torre', x: L.x, z: L.z, y: L.y, alto: Math.min(16, 58 - L.y), nucleo: B.LA_BRANCA, faixa: B.LA_VERMELHA, farol: true, r: [L.x - 4, L.z - 4, L.x + 4, L.z + 4] });
    const [dx, dz] = L.dir;
    this.casa(L, Math.round(L.x - dx * 8 + dz * 5), Math.round(L.z - dz * 8 - dx * 5), Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0, Math.abs(dx) > Math.abs(dz) ? 0 : Math.sign(dz), rng);
  }

  montar_porto(L, rng) {
    const { x, z, y } = L;
    // eixo principal virado para o mar: o lado (dos 4) em que a água fica mais perto
    let ax = [1, 0], melhor = 1e9;
    for (const e of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let t = 10; t < 70; t++) if (this.altura(x + e[0] * t, z + e[1] * t) <= NA - 1) { if (t < melhor) { melhor = t; ax = e; } break; }
    }
    L.pecas.push({ tipo: 'piso', r: [x - 14, z - 14, x + 14, z + 14], y, mat: B.PEDRISCO });
    L.pecas.push({ tipo: 'cais', x: x + ax[0] * 12, z: z + ax[1] * 12, y, dx: ax[0], dz: ax[1], r: ax[0] ? [x + ax[0] * 12 - (ax[0] < 0 ? 40 : 0), z - 3, x + ax[0] * 12 + (ax[0] > 0 ? 40 : 0), z + 3] : [x - 3, z + ax[1] * 12 - (ax[1] < 0 ? 40 : 0), x + 3, z + ax[1] * 12 + (ax[1] > 0 ? 40 : 0)] });
    const gx = x - ax[0] * 6 - ax[1] * 6, gz = z - ax[1] * 6 - ax[0] * 6;
    L.pecas.push({ tipo: 'galpao', r: [gx - 6, gz - 5, gx + 6, gz + 5], y, parede: B.TABUAS, teto: B.LA_AZUL, alto: 5 });
    this.conteineres(L, rng, x + (ax[1] ? 2 : -12), z + (ax[0] ? 2 : -12), x + 12, z + 12, 4);
  }

  // ---------- consultas ----------
  // lugar onde (x,z) está (ou null)
  lugarEm(x, z) {
    const cel = this.grade.get(Math.floor(x / CEL) + ',' + Math.floor(z / CEL));
    if (!cel) return null;
    for (const L of cel.lugares) {
      const d = L.q ? Math.max(Math.abs(x - L.x), Math.abs(z - L.z)) : Math.hypot(x - L.x, z - L.z);
      if (d < L.r + 3) return L;
    }
    return null;
  }

  // em cima de estrada (ou dentro de um lugar, onde o chão é calçado)? Usado pelos veículos
  naEstrada(x, z) {
    const cel = this.grade.get(Math.floor(x / CEL) + ',' + Math.floor(z / CEL));
    if (!cel) return false;
    for (const s of cel.estradas) if (distSeg(x, z, s.a, s.b).d < 3) return true;
    return !!this.lugarEm(x, z);
  }

  // árvores não nascem em lugares nem em estradas
  semArvore(x, z) {
    const cel = this.grade.get(Math.floor(x / CEL) + ',' + Math.floor(z / CEL));
    if (!cel) return false;
    for (const L of cel.lugares) {
      const d = L.q ? Math.max(Math.abs(x - L.x), Math.abs(z - L.z)) : Math.hypot(x - L.x, z - L.z);
      if (d < L.r + 5) return true;
    }
    for (const s of cel.estradas) if (distSeg(x, z, s.a, s.b).d < 6) return true;
    return false;
  }

  // ponto de partida: no ar, sobre o meio da ilha (o jogador desce planando e escolhe onde pousar)
  inicio() {
    return { x: 0.5, y: ALT - 4, z: 0.5, planar: true };
  }

  // cor de um ponto para o mapa da ilha
  corMapa(x, z) {
    const h = this.altura(x, z);
    const cel = this.grade.get(Math.floor(x / CEL) + ',' + Math.floor(z / CEL));
    if (h <= NA && cel) for (const s of cel.estradas) if (distSeg(x, z, s.a, s.b).d < 2.6) return [168, 120, 70]; // ponte
    if (h <= NA) {
      const p = Math.min(1, (NA - h) / 9);
      return [Math.round(90 - p * 50), Math.round(170 - p * 60), Math.round(220 - p * 40)];
    }
    if (cel) {
      for (const L of cel.lugares) {
        const d = L.q ? Math.max(Math.abs(x - L.x), Math.abs(z - L.z)) : Math.hypot(x - L.x, z - L.z);
        if (d < L.r) return [214, 196, 160];
      }
      for (const s of cel.estradas) if (distSeg(x, z, s.a, s.b).d < 2.6) return [150, 150, 150];
    }
    if (h <= NA + 1) return [232, 216, 160];
    if (h > 48) return [150, 150, 145];
    const t = Math.min(1, (h - NA) / 28);
    return [Math.round(110 - t * 40), Math.round(180 - t * 50), Math.round(80 - t * 30)];
  }

  // ---------- carimbar os blocos de um pedaço ----------
  carimbar(d, cx, cz, CX, CZ) {
    const ox = cx * CX, oz = cz * CZ;
    const idx = (x, y, z) => x + z * CX + y * CX * CZ;
    const dentro = (x, z) => x >= ox && x < ox + CX && z >= oz && z < oz + CZ;
    const put = (x, y, z, b) => { if (y > 0 && y < ALT && dentro(x, z)) d[idx(x - ox, y, z - oz)] = b; };
    const get = (x, y, z) => (dentro(x, z) && y >= 0 && y < ALT ? d[idx(x - ox, y, z - oz)] : AR);
    const chao = (x, y, z, b) => { put(x, y, z, b); for (let k = 1; k <= 2; k++) if (PLANTA[get(x, y + k, z)]) put(x, y + k, z, AR); };
    const ctx = { put, get, dentro, chao };
    const cel = this.grade.get(Math.floor((ox + 8) / CEL) + ',' + Math.floor((oz + 8) / CEL));
    // juntando as células vizinhas (o pedaço é menor que a célula, mas peças grandes passam da borda)
    const lugares = new Set(), estradas = new Set();
    for (const [a, b] of [[ox, oz], [ox + CX - 1, oz], [ox, oz + CZ - 1], [ox + CX - 1, oz + CZ - 1]]) {
      const c = this.grade.get(Math.floor(a / CEL) + ',' + Math.floor(b / CEL));
      if (c) { c.lugares.forEach((L) => lugares.add(L)); c.estradas.forEach((s) => estradas.add(s)); }
    }
    void cel;
    // estradas (e pontes sobre a água)
    if (estradas.size) {
      for (let z = oz; z < oz + CZ; z++) for (let x = ox; x < ox + CX; x++) {
        let m = null;
        for (const s of estradas) { const q = distSeg(x, z, s.a, s.b); if (q.d < 4 && (!m || q.d < m.d)) m = { ...q, s }; }
        if (!m) continue;
        // dentro dos lugares quem manda é o lugar (fica só a pontinha da estrada chegando)
        if ([...lugares].some((L) => (L.q ? Math.max(Math.abs(x - L.x), Math.abs(z - L.z)) : Math.hypot(x - L.x, z - L.z)) < L.r - (L.tipo === 'cidade' ? 2 : L.r * 0.4))) continue;
        const yr = Math.round(lerp(m.s.a.y, m.s.b.y, m.t));
        const h = this.altura(x, z);
        const comp = m.t * Math.hypot(m.s.b.x - m.s.a.x, m.s.b.z - m.s.a.z);
        if (h <= NA) {
          // ponte de tábuas com corrimão e pilares
          const yp = Math.max(yr, NA + 2);
          if (m.d < 3) {
            put(x, yp, z, B.TABUAS);
            for (let k = 1; k <= 3; k++) put(x, yp + k, z, AR);
            if (m.d > 2 && Math.round(comp) % 5 === 0) for (let yy = yp - 1; yy > 1 && get(x, yy, z) !== B.PEDRA && get(x, yy, z) !== B.AREIA && get(x, yy, z) !== B.TERRA; yy--) put(x, yy, z, B.TRONCO);
          } else if (m.d < 3.6) { put(x, yp, z, B.TABUAS); put(x, yp + 1, z, B.TRONCO); }
          continue;
        }
        if (m.d < 2.6) {
          const faixa = m.d < 0.5 && Math.floor(comp / 3) % 2 === 0;
          chao(x, h, z, faixa ? B.LA_BRANCA : B.PEDRA);
          for (let k = 1; k <= 6; k++) { const b = get(x, h + k, z); if (b === B.TRONCO || b === B.FOLHAS || PLANTA[b]) put(x, h + k, z, AR); }
        } else if (m.d < 3.6) chao(x, h, z, B.PEDRISCO);
      }
    }
    // lugares
    const toca = (r) => r[0] - 1 < ox + CX && r[2] + 1 >= ox && r[1] - 1 < oz + CZ && r[3] + 1 >= oz;
    for (const L of lugares) for (const p of L.pecas) if (toca(p.r)) this['pintar_' + p.tipo](ctx, p);
    // coisas espalhadas pela ilha para explorar e se esconder: pedras, toras e moitas
    const rl = rngSemente((Math.imul(cx, 2246822519) ^ Math.imul(cz, 3266489917) ^ this.s) >>> 0);
    const n = rl() < 0.55 ? 1 + Math.floor(rl() * 2) : 0;
    for (let i = 0; i < n; i++) {
      const x = ox + 2 + Math.floor(rl() * 12), z = oz + 2 + Math.floor(rl() * 12), qual = rl();
      if (this.semArvore(x, z)) continue;
      const h = this.altura(x, z);
      if (h <= NA + 1 || get(x, h + 1, z) === B.TRONCO || get(x, h + 1, z) === B.FOLHAS) continue;
      if (qual < 0.45) { // pedra grande
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (rl() < 0.75) { put(x + a, h + 1, z + b, B.PEDRA); if (!a && !b || rl() < 0.3) put(x + a, h + 2, z + b, B.PEDRA); }
      } else if (qual < 0.75) { // tora caída
        const lx = rl() < 0.5;
        for (let k = -2; k <= 2; k++) put(x + (lx ? k : 0), h + 1, z + (lx ? 0 : k), B.TRONCO);
      } else { // moita
        for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) { put(x + a, h + 1, z + b, B.FOLHAS); if (rl() < 0.5) put(x + a, h + 2, z + b, B.FOLHAS); }
      }
    }
  }

  // ---------- pintores das peças ----------
  pintar_piso({ chao, dentro, put, get }, p) {
    const [x0, z0, x1, z1] = p.r;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z)) continue;
      let b = p.mat;
      // faixa branca tracejada no meio das ruas da cidade
      if (p.faixa === 'z' && x === p.meio && Math.floor(z / 3) % 2 === 0) b = B.LA_BRANCA;
      if (p.faixa === 'x' && z === p.meio && Math.floor(x / 3) % 2 === 0) b = B.LA_BRANCA;
      chao(x, p.y, z, b);
      for (let k = 1; k <= 6; k++) { const q = get(x, p.y + k, z); if (q === B.TRONCO || q === B.FOLHAS || PLANTA[q]) put(x, p.y + k, z, AR); }
    }
  }

  pintar_poste({ put }, p) {
    put(p.x, p.y + 1, p.z, B.TRONCO); put(p.x, p.y + 2, p.z, B.TRONCO); put(p.x, p.y + 3, p.z, B.LAMPIAO);
  }

  pintar_banco({ put }, p) { put(p.x, p.y + 1, p.z, B.TABUAS); }

  pintar_arvore({ put, get }, p) {
    const { x, y, z } = p;
    put(x, y, z, B.GRAMA);
    for (let i = 1; i <= 5; i++) put(x, y + i, z, B.TRONCO);
    for (let dy = 3; dy <= 6; dy++) {
      const rad = dy <= 4 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (get(x + dx, y + dy, z + dz) === AR) put(x + dx, y + dy, z + dz, B.FOLHAS);
      }
    }
  }

  pintar_fonte({ put }, p) {
    const { x, y, z } = p;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      const d = Math.max(Math.abs(dx), Math.abs(dz));
      if (d === 3) put(x + dx, y + 1, z + dz, B.PEDRA);
      else { put(x + dx, y, z + dz, B.AGUA); put(x + dx, y - 1, z + dz, B.PEDRA); }
    }
    put(x, y, z, B.PEDRA); put(x, y + 1, z, B.PEDRA); put(x, y + 2, z, B.AGUA);
  }

  pintar_casa(ctx, p) { this.m.vilas.pintarCasa(ctx, { ...p, tipo: p.tipoCasa }); }
  pintar_praca_vila(ctx, p) { this.m.vilas.pintarPraca(ctx, p); }
  pintar_campo(ctx, p) { this.m.vilas.pintarFazenda(ctx, p); }

  pintar_predio({ put, dentro }, p) {
    const [x0, z0, x1, z1] = p.r, y = p.y, H = 4, n = p.andares;
    const topo = y + H * n;
    const porta = (x0 + x1) >> 1;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z)) continue;
      const bx = x === x0 || x === x1, bz = z === z0 || z === z1;
      put(x, y, z, B.PEDRISCO);
      for (let k = 1; k < H * n; k++) {
        const andar = Math.floor(k / H), rel = k % H;
        if (rel === 0) { // laje entre andares (com o buraco da escada)
          const ex = x0 + 1 + ((andar - 1) % 2);
          put(x, y + k, z, bx || bz ? p.parede : (x === ex && z >= z0 + 2 && z <= z0 + 4 ? AR : B.TABUAS));
          continue;
        }
        if (!bx && !bz) { put(x, y + k, z, AR); continue; }
        if (bx && bz) { put(x, y + k, z, B.PEDRA); continue; }
        // porta larga no térreo (lado z1)
        if (z === z1 && andar === 0 && rel <= 2 && Math.abs(x - porta) <= 1) { put(x, y + k, z, AR); continue; }
        const ao = bz ? x - x0 : z - z0;
        put(x, y + k, z, (rel === 2 || rel === 3) && ao % 3 !== 0 ? B.VIDRO : p.parede);
      }
      // telhado plano com mureta e saída da escada
      const ex = x0 + 1 + ((n - 1) % 2);
      put(x, topo, z, !bx && !bz && x === ex && z >= z0 + 2 && z <= z0 + 4 ? AR : B.PEDRISCO);
      put(x, topo + 1, z, bx || bz ? p.parede : AR);
      for (let k = 2; k <= 3; k++) put(x, topo + k, z, AR);
    }
    // escadas: degraus subindo de um andar para o outro
    for (let f = 0; f < n; f++) {
      const ex = x0 + 1 + (f % 2), yb = y + H * f;
      for (let k = 0; k < 3; k++) put(ex, yb + 1 + k, z0 + 2 + k, B.PEDRISCO);
    }
    put(porta, y + 3, z1 + 1, B.LAMPIAO);
  }

  pintar_quadra({ put, dentro }, p) {
    const [x0, z0, x1, z1] = p.r, y = p.y, mx = (x0 + x1) >> 1;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z)) continue;
      const borda = x === x0 || x === x1 || z === z0 || z === z1;
      put(x, y, z, borda || x === mx || (Math.abs(x - mx) + 0 === 0) ? B.LA_BRANCA : B.LA_VERDE);
      put(x, y + 1, z, AR);
    }
    // gols
    const zm = (z0 + z1) >> 1;
    for (const gx of [x0, x1]) for (let dz = -1; dz <= 1; dz++) {
      put(gx, y + 1, zm + dz, AR);
      if (Math.abs(dz) === 1) { put(gx, y + 1, zm + dz * 2, B.LA_BRANCA); put(gx, y + 2, zm + dz * 2, B.LA_BRANCA); }
      put(gx, y + 3, zm + dz, B.LA_BRANCA);
    }
    for (const gx of [x0, x1]) { put(gx, y + 3, zm - 2, B.LA_BRANCA); put(gx, y + 3, zm + 2, B.LA_BRANCA); }
  }

  pintar_galpao({ put, dentro }, p) {
    const [x0, z0, x1, z1] = p.r, y = p.y, H = p.alto || 5;
    const porta = (x0 + x1) >> 1;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z)) continue;
      const bx = x === x0 || x === x1, bz = z === z0 || z === z1;
      put(x, y, z, B.PEDRISCO);
      for (let k = 1; k <= H; k++) {
        let b = AR;
        if (bx || bz) {
          b = bx && bz ? B.TRONCO : p.parede;
          if (p.aberto && (z === z1 || z === z0) && !(bx && bz) && k <= H - 1) b = AR; // mercado: aberto na frente e atrás
          else if (bz && Math.abs(x - porta) <= 2 && k <= 4) b = AR; // portão grande dos dois lados
          else if (k === H - 1 && !(bx && bz) && (x + z) % 3 !== 0) b = B.VIDRO;
        }
        put(x, y + k, z, b);
      }
      put(x, y + H + 1, z, p.teto);
    }
    if (!p.aberto) put(porta + 3, y + 3, z1 + 1, B.LAMPIAO);
  }

  pintar_barraca_feira({ put }, p) {
    const { x, y, z } = p;
    for (let dx = -1; dx <= 1; dx++) { put(x + dx, y + 1, z, B.TABUAS); put(x + dx, y + 4, z, p.cor); put(x + dx, y + 4, z + 1, p.cor); }
    put(x - 1, y + 2, z + 1, B.TRONCO); put(x - 1, y + 3, z + 1, B.TRONCO); put(x + 1, y + 2, z + 1, B.TRONCO); put(x + 1, y + 3, z + 1, B.TRONCO);
  }

  pintar_conteiner({ put, dentro }, p) {
    const [x0, z0, x1, z1] = p.r, y = p.y;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z)) continue;
      // ponta aberta (dá para entrar)
      const ponta = p.longoX ? (p.abre > 0 ? x === x1 : x === x0) : (p.abre > 0 ? z === z1 : z === z0);
      const lado = p.longoX ? z === z0 || z === z1 : x === x0 || x === x1;
      const fundo = p.longoX ? x === x0 || x === x1 : z === z0 || z === z1;
      for (let k = 1; k <= 3; k++) {
        let b = p.cor;
        const meio = !lado && k < 3;
        if (meio && !fundo) b = AR;
        if (meio && ponta && !p.fechado) b = AR;
        put(x, y + k, z, b);
      }
    }
  }

  pintar_chamine({ put }, p) {
    const topo = Math.min(ALT - 3, p.y + 20);
    for (let yy = p.y + 1; yy <= topo; yy++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const borda = Math.abs(dx) === 1 || Math.abs(dz) === 1;
      put(p.x + dx, yy, p.z + dz, borda ? (yy >= topo - 1 ? B.LA_BRANCA : B.TIJOLO) : AR);
    }
  }

  pintar_muro({ put, dentro }, p) {
    const [x0, z0, x1, z1] = p.r, xm = (x0 + x1) >> 1, zm = (z0 + z1) >> 1;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z) || (x !== x0 && x !== x1 && z !== z0 && z !== z1)) continue;
      if (Math.abs(x - xm) <= 3 || Math.abs(z - zm) <= 3) continue; // portões nos quatro lados
      for (let k = 1; k <= p.alto; k++) put(x, p.y + k, z, p.mat);
    }
  }

  pintar_cerca({ put, dentro }, p) {
    const [x0, z0, x1, z1] = p.r, xm = (x0 + x1) >> 1, zm = (z0 + z1) >> 1;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z) || (x !== x0 && x !== x1 && z !== z0 && z !== z1)) continue;
      if (Math.abs(x - xm) <= 2 || Math.abs(z - zm) <= 2) continue;
      put(x, p.y + 1, z, B.TRONCO);
    }
  }

  pintar_silo({ put }, p) {
    const topo = p.y + 10;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const d = dx * dx + dz * dz;
      if (d > 5) continue;
      for (let yy = p.y + 1; yy <= topo; yy++) put(p.x + dx, yy, p.z + dz, d >= 4 ? B.LA_BRANCA : AR);
      put(p.x + dx, topo + 1, p.z + dz, B.LA_VERMELHA);
      if (d <= 2) put(p.x + dx, topo + 2, p.z + dz, B.LA_VERMELHA);
    }
    put(p.x, p.y + 1, p.z + 2, AR); put(p.x, p.y + 2, p.z + 2, AR); // portinha
  }

  pintar_fardo({ put }, p) {
    put(p.x, p.y + 1, p.z, B.FENO); put(p.x + 1, p.y + 1, p.z, B.FENO);
    if (p.alto) put(p.x, p.y + 2, p.z, B.FENO);
  }

  pintar_guindaste({ put }, p) {
    const topo = Math.min(ALT - 4, p.y + 16);
    for (let yy = p.y + 1; yy <= topo; yy++) for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(p.x + a, yy, p.z + b, (yy - p.y) % 4 === 0 ? B.PEDRISCO : B.LA_AMARELA);
    for (let k = -12; k <= 3; k++) put(p.x + k, topo + 1, p.z, B.LA_AMARELA);
    put(p.x + 1, topo + 2, p.z, B.VIDRO); put(p.x + 1, topo + 2, p.z + 1, B.LA_AMARELA);
    for (let yy = topo; yy >= topo - 6; yy--) put(p.x - 10, yy, p.z, B.TRONCO);
  }

  pintar_castelo({ put, dentro }, p) {
    const [x0, z0, x1, z1] = p.r, y = p.y, xm = (x0 + x1) >> 1, zm = (z0 + z1) >> 1;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z)) continue;
      const bx = x === x0 || x === x1, bz = z === z0 || z === z1;
      const cantoT = (x - x0 < 4 || x1 - x < 4) && (z - z0 < 4 || z1 - z < 4); // torres de 4x4 nos cantos
      put(x, y, z, cantoT || bx || bz ? B.PEDRA : B.GRAMA);
      if (cantoT) {
        const bordaT = x === x0 || x === x1 || z === z0 || z === z1 || x - x0 === 3 || x1 - x === 3 || z - z0 === 3 || z1 - z === 3;
        for (let k = 1; k <= 10; k++) put(x, y + k, z, bordaT && !(k === 5 || k === 6) ? B.PEDRA : bordaT ? B.VIDRO : AR);
        put(x, y + 5, z, bordaT ? B.VIDRO : B.TABUAS); // piso do meio da torre
        put(x, y + 10, z, B.PEDRA);
        if (bordaT && (x + z) % 2 === 0) put(x, y + 11, z, B.PEDRA);
        continue;
      }
      if (bx || bz) {
        const portao = (bz && Math.abs(x - xm) <= 1) || (bx && Math.abs(z - zm) <= 1);
        for (let k = 1; k <= 6; k++) put(x, y + k, z, portao && k <= 3 ? AR : B.PEDRA);
        if ((x + z) % 2 === 0) put(x, y + 7, z, B.PEDRA);
      }
    }
    // escadinha de pedra para subir na muralha (lado de dentro, perto do portão norte)
    for (let k = 0; k < 5; k++) put(xm + 3 + k, y + 1 + k, z0 + 1, B.PEDRA);
    for (let x = xm + 3; x <= xm + 8; x++) put(x, y + 6, z0 + 1, B.PEDRA);
    // bandeirinhas
    for (const [fx, fz] of [[x0 + 1, z0 + 1], [x1 - 1, z1 - 1]]) { put(fx, y + 12, fz, B.TRONCO); put(fx, y + 13, fz, B.TRONCO); put(fx + 1, y + 13, fz, B.LA_AZUL); put(fx + 1, y + 12, fz, B.LA_AMARELA); }
  }

  pintar_fogueira({ put }, p) {
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(p.x + a, p.y + 1, p.z + b, B.PEDRA);
    put(p.x, p.y + 1, p.z, B.LAMPIAO);
  }

  pintar_tora({ put }, p) {
    for (let k = -1; k <= 1; k++) put(p.x + (p.longoX ? k : 0), p.y + 1, p.z + (p.longoX ? 0 : k), B.TRONCO);
  }

  pintar_barraca({ put }, p) {
    // barraca em "A", aberta na frente
    for (let k = -2; k <= 2; k++) for (let a = -2; a <= 2; a++) {
      const alt = 3 - Math.abs(a);
      const x = p.x + (p.longoX ? k : a), z = p.z + (p.longoX ? a : k);
      if (Math.abs(a) === 2 || k === -2) for (let h = 1; h <= alt; h++) put(x, p.y + h, z, Math.abs(a) === 2 || k === -2 ? p.cor : AR);
      else for (let h = 1; h < alt; h++) put(x, p.y + h, z, AR);
      put(x, p.y + alt, z, p.cor);
    }
  }

  pintar_catavento({ put }, p) {
    const { x, y, z } = p;
    for (let k = 1; k <= 9; k++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const borda = Math.abs(a) === 1 || Math.abs(b) === 1;
      put(x + a, y + k, z + b, borda ? (k > 7 ? B.LA_VERMELHA : B.LA_BRANCA) : AR);
    }
    put(x, y + 1, z - 1, AR); put(x, y + 2, z - 1, AR);
    put(x, y + 10, z, B.LA_VERMELHA);
    // hélice de 4 pás no plano x-y, na frente (z+2)
    const cy = y + 8, fz = z + 2;
    put(x, cy, z + 1, B.TRONCO); put(x, cy, fz, B.TRONCO);
    for (let k = 1; k <= 4; k++) {
      const pas = p.fase ? [[k, k], [-k, -k], [k, -k], [-k, k]] : [[k, 0], [-k, 0], [0, k], [0, -k]];
      for (const [a, b] of pas) if (cy + b > 0 && cy + b < ALT) put(x + a, cy + b, fz, B.LA_BRANCA);
    }
  }

  // torre com escada em caracol por fora e mirante em cima (mirante e farol)
  pintar_torre({ put }, p) {
    const { x, y, z } = p, H = p.alto;
    for (let k = 1; k <= H; k++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      put(x + a, y + k, z + b, p.faixa && Math.floor(k / 3) % 2 ? p.faixa : p.nucleo);
    }
    // anel 5x5 em volta: um degrau por bloco, girando
    const anel = [];
    for (let a = -2; a <= 2; a++) anel.push([a, -2]);
    for (let b = -1; b <= 2; b++) anel.push([2, b]);
    for (let a = 1; a >= -2; a--) anel.push([a, 2]);
    for (let b = 1; b >= -1; b--) anel.push([-2, b]);
    for (let k = 0; k < H; k++) {
      const [a, b] = anel[k % anel.length];
      put(x + a, y + 1 + k, z + b, B.TABUAS);
      for (let h = 2; h <= 3; h++) { const [c, d] = anel[(k + anel.length - 1) % anel.length]; void c; void d; put(x + a, y + 1 + k + h, z + b, AR); }
    }
    // plataforma com corrimão
    const yp = y + H + 1;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      put(x + a, yp, z + b, B.TABUAS);
      if (Math.abs(a) === 3 || Math.abs(b) === 3) put(x + a, yp + 1, z + b, B.TRONCO);
      else for (let h = 1; h <= 3; h++) put(x + a, yp + h, z + b, AR);
    }
    // entrada da plataforma (onde chega a escada)
    const [ea, eb] = anel[(H - 1) % anel.length];
    put(x + ea, yp, z + eb, AR); put(x + Math.sign(ea) * 3, yp + 1, z + Math.sign(eb) * 3, AR);
    if (p.farol) {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        put(x + a, yp + 1, z + b, a || b ? B.VIDRO : B.LAMPIAO);
        put(x + a, yp + 2, z + b, a || b ? B.VIDRO : B.LAMPIAO);
        put(x + a, yp + 3, z + b, B.LA_VERMELHA);
      }
    } else {
      // telhadinho
      for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) { put(x + a, yp + 2, z + b, B.TRONCO); put(x + a, yp + 3, z + b, B.TRONCO); }
      for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) put(x + a, yp + 4, z + b, B.LA_VERMELHA);
      put(x, yp + 1, z, B.LAMPIAO);
    }
  }

  pintar_cais({ put, get }, p) {
    // píer de tábuas saindo da praça do porto para dentro do mar
    const { dx, dz, y } = p;
    for (let t = 0; t <= 40; t++) for (let w = -2; w <= 2; w++) {
      const x = p.x + dx * t - dz * w, z = p.z + dz * t + dx * w;
      const yy = Math.max(NA + 1, Math.min(y, this.altura(x, z))); // acompanha o chão e fica rente à água
      put(x, yy, z, B.TABUAS);
      for (let k = 1; k <= 3; k++) if (get(x, yy + k, z) !== B.LAMPIAO) put(x, yy + k, z, AR);
      if (Math.abs(w) === 2 && t % 6 === 0) {
        for (let yb = yy - 1; yb > 1 && get(x, yb, z) !== B.PEDRA && get(x, yb, z) !== B.AREIA; yb--) put(x, yb, z, B.TRONCO);
        put(x, yy + 1, z, B.TRONCO);
        if (t % 12 === 0) put(x, yy + 2, z, B.LAMPIAO);
      }
    }
  }
}

// distância de um ponto a um segmento (t = posição ao longo dele, 0..1)
function distSeg(x, z, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z;
  const l2 = vx * vx + vz * vz || 1;
  let t = ((x - a.x) * vx + (z - a.z) * vz) / l2;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(x - a.x - vx * t, z - a.z - vz * t), t };
}
void hash3;

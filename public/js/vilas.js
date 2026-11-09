// Vilas: povoados com casas, ruas, poço, plantações e celeiros.
// Tudo nasce da semente do mundo, então todos os jogadores veem as mesmas vilas
// e o servidor continua guardando só o que os jogadores mudaram.
import { hash3, rngSemente } from './ruido.js';
import { AR, B, E, M, PLANTA } from './blocos.js';
import { BE } from './blocos-eras.js';
import { BIOMA } from './gerador.js';
import { opcoesMundo } from './opcoes-mundo.js';
import { PLANTAS, desenhar, noMundo, girar, DIRS as DIRS4 } from './casas.js';

export const REGIAO = 96; // cada região de 96x96 blocos pode ter uma vila (pedaços de 16 cabem certinho)
const ALT = 96; // igual ao de mundo.js (o nível do mar vem de mundo.nivelAgua)

const NOMES_A = ['Vila', 'Aldeia', 'Vilarejo', 'Povoado', 'Arraial'];
const NOMES_B = ['do Girassol', 'das Capivaras', 'Bem-te-vi', 'do Sabiá', 'Flor de Ipê', 'Pé de Moleque', 'do Arco-Íris',
  'da Paçoca', 'Beija-Flor', 'das Jabuticabas', 'do Riacho', 'Pôr do Sol', 'das Borboletas', 'do Caqui', 'Cantinho Feliz',
  'das Pitangas', 'Lua Cheia', 'do Pinhão', 'Brisa Mansa', 'das Goiabas', 'do Tucano', 'Vento Bom', 'das Ovelhinhas', 'do Milho Verde'];

// estilos de vila ("civilizações"), escolhidos pelo lugar onde a vila nasce
export const ESTILOS = {
  campo: { nome: 'do campo', parede: B.TABUAS, canto: B.TRONCO, piso: B.TABUAS, rua: B.PEDRISCO, telhados: [B.LA_VERMELHA, B.LA_AMARELA, B.TABUAS, B.LA_VERDE] },
  tijolo: { nome: 'de tijolinho', parede: B.TIJOLO, canto: B.PEDRISCO, piso: B.TABUAS, rua: B.PEDRISCO, telhados: [B.LA_AZUL, B.TABUAS, B.LA_VERMELHA, B.LA_ROSA] },
  praia: { nome: 'da praia', parede: B.TABUAS, canto: B.TRONCO, piso: B.TABUAS, rua: B.TABUAS, telhados: [B.FENO] },
  deserto: { nome: 'do deserto', parede: BE.ARENITO, canto: BE.ARENITO_ENTALHADO, piso: BE.ARENITO, rua: B.AREIA, telhados: [BE.TERRACOTA, B.LA_AMARELA, B.FENO] },
  neve: { nome: 'das neves', parede: B.TRONCO_PINHEIRO, canto: B.PEDRISCO, piso: B.TABUAS, rua: B.CASCALHO, telhados: [B.LA_VERMELHA, B.TABUAS, B.LA_AZUL] },
  serra: { nome: 'da serra', parede: B.PEDRISCO, canto: B.TRONCO, piso: B.TABUAS, rua: B.PEDRISCO, telhados: [B.TABUAS, B.LA_VERMELHA, B.TIJOLO] },
};

// direções das ruas e a posição de cada uma no anel da praça
const DIRS = [[1, 0, 0], [0, 1, 2], [-1, 0, 4], [0, -1, 6]];
export const ANEL = [[3, 0], [3, 3], [0, 3], [-3, 3], [-3, 0], [-3, -3], [0, -3], [3, -3]];

export class Vilas {
  constructor(mundo) {
    this.m = mundo;
    this.cache = new Map();
  }

  get nivel() { return this.m.nivelAgua; }

  alt(x, z) { return Math.min(this.m.tetoTerreno, Math.max(4, this.m.alturaEm(x, z))); }

  // vila da região (ou null)
  regiao(rx, rz) {
    const k = rx + ',' + rz;
    if (!this.cache.has(k)) this.cache.set(k, this.planejar(rx, rz));
    return this.cache.get(k);
  }

  daColuna(x, z) { return this.regiao(Math.floor(x / REGIAO), Math.floor(z / REGIAO)); }

  // vilas cujo centro está a até `dist` blocos
  perto(x, z, dist) {
    const out = [];
    const rx = Math.floor(x / REGIAO), rz = Math.floor(z / REGIAO);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const v = this.regiao(rx + dx, rz + dz);
      if (v && Math.hypot(v.x + 0.5 - x, v.z + 0.5 - z) < dist) out.push(v);
    }
    return out;
  }

  // ---------- planejamento (só números, nada de blocos ainda) ----------
  planejar(rx, rz) {
    if (!opcoesMundo.vilas) return null; // mundo criado sem vilas
    if (this.m.aventura) return null; // a Ilha de Aventura tem as próprias cidades e vilas
    const s = this.m.semente;
    const origem = rx === 0 && rz === 0; // sempre tem uma vila perto de onde se começa
    if (!origem && hash3(rx, 501, rz, s) > 0.55) return null;
    const rng = rngSemente((Math.imul(rx, 73856093) ^ Math.imul(rz, 19349663) ^ Math.imul(s, 83492791)) >>> 0);
    for (let k = 0; k < 4; k++) rng(); // mistura bem a semente
    let C = null;
    for (let t = 0; t < 14 && !C; t++) {
      const x = rx * REGIAO + 30 + Math.floor(rng() * 36), z = rz * REGIAO + 30 + Math.floor(rng() * 36);
      const h = this.alt(x, z);
      if (h <= this.nivel + 1 || h > this.nivel + 24) continue;
      let dif = 0;
      for (const [dx, dz] of [[12, 0], [-12, 0], [0, 12], [0, -12], [8, 8], [-8, -8], [8, -8], [-8, 8]]) dif = Math.max(dif, Math.abs(this.alt(x + dx, z + dz) - h));
      if (dif <= (origem && t > 6 ? 8 : 4)) C = { x, z, h };
    }
    if (!C) return null;

    const nome = NOMES_A[Math.floor(rng() * NOMES_A.length)] + ' ' + NOMES_B[Math.floor(rng() * NOMES_B.length)];
    const N = this.nivel, bio = this.m.biomaEm ? this.m.biomaEm(C.x, C.z) : -1;
    const estilo = C.h <= N + 2 ? 'praia' : C.h >= N + 14 ? 'serra' : bio === BIOMA.DESERTO ? 'deserto' : bio === BIOMA.NEVE || bio === BIOMA.TAIGA ? 'neve' : rng() < 0.5 ? 'campo' : 'tijolo';
    const E = ESTILOS[estilo];
    const v = { nome, estilo, x: C.x, z: C.z, y: C.h, ruas: [], estruturas: [], casas: [], fazendas: [], raio: 8 };
    const ocupado = [[C.x - 5, C.z - 5, C.x + 5, C.z + 5]];
    const livre = (r) => !ocupado.some((o) => r[0] <= o[2] && r[2] >= o[0] && r[1] <= o[3] && r[3] >= o[1]);

    // ruas (2 a 4), saindo da praça
    const postes = [];
    const quais = DIRS.filter(() => rng() < 0.8);
    while (quais.length < 2) { const d = DIRS[Math.floor(rng() * 4)]; if (!quais.includes(d)) quais.push(d); }
    quais.sort((a, b) => a[2] - b[2]);
    for (const [dx, dz, anel] of quais) {
      const L = 12 + Math.floor(rng() * 11);
      const rua = { dx, dz, anel, L, lados: [] };
      v.ruas.push(rua);
      const a0 = 5, a1 = 4 + L;
      const r = this.retRua(C, dx, dz, a0, a1, 1);
      ocupado.push(r);
      v.estruturas.push({ tipo: 'rua', r, mat: E.rua });
      // lampiões ao longo da rua
      for (let t = 12; t <= a1; t += 9) {
        const [lx, lz] = this.ponto(C, dx, dz, t, 2 * (t % 2 ? 1 : -1));
        postes.push({ tipo: 'poste', x: lx, z: lz });
      }
    }
    // construções dos dois lados de cada rua
    let celeiro = false, padaria = false, loja = false;
    v.ruas.forEach((rua, ri) => {
      for (let t = 8; t <= 4 + rua.L; t += 10) for (const lado of [-1, 1]) {
        if (rng() < 0.12) continue;
        const sorte = rng();
        let tipo = sorte < 0.68 ? 'casa' : sorte < 0.9 ? 'fazenda' : 'celeiro';
        if (tipo === 'celeiro' && celeiro) tipo = 'casa';
        // casas de verdade (casas.js): casinha, casa com quarto, sobrado; a vila também tem padaria e loja
        let planta = null;
        if (tipo === 'casa') {
          planta = !padaria ? 'padaria' : !loja ? 'loja' : (() => { const q = rng(); return q < 0.35 ? 'casinha' : q < 0.75 ? 'casa' : 'sobrado'; })();
          if (planta === 'padaria' || planta === 'loja') tipo = planta;
        }
        const larg = planta ? PLANTAS[planta].L : 7; // ao longo da rua
        const fundo = planta ? PLANTAS[planta].F : tipo === 'celeiro' ? 7 : 5; // para longe da rua
        if (t + (larg - 1) / 2 > 4 + rua.L + 1) continue;
        // retângulo (com 1 bloco de folga) em coordenadas do mundo
        const ret = this.retLado(C, rua, t, lado, larg, fundo);
        const folga = [ret[0] - 1, ret[1] - 1, ret[2] + 1, ret[3] + 1];
        if (!livre(folga)) continue;
        // altura do chão: a da rua na frente da porta
        const [px, pz] = this.ponto(C, rua.dx, rua.dz, t, 2 * lado);
        const y = Math.max(this.alt(px, pz), this.nivel + 1);
        let pior = 0;
        for (const [qx, qz] of [[ret[0], ret[1]], [ret[2], ret[1]], [ret[0], ret[3]], [ret[2], ret[3]]]) pior = Math.max(pior, Math.abs(this.alt(qx, qz) - y));
        if (pior > 6) continue;
        if (tipo === 'celeiro') celeiro = true;
        if (tipo === 'padaria') padaria = true;
        if (tipo === 'loja') loja = true;
        ocupado.push(folga);
        // porta: no meio da parede da frente; "frente" = célula entre a casa e a rua
        const [fx, fz] = this.ponto(C, rua.dx, rua.dz, t, 3 * lado);
        const [gx, gz] = [px, pz];
        // "dentro" = logo depois da porta (os móveis ficam encostados nas paredes)
        const [ix, iz] = this.ponto(C, rua.dx, rua.dz, t, (planta ? 4 : 3 + Math.floor((fundo - 1) / 2)) * lado);
        const est = {
          tipo, planta, v: rng(), r: ret, y, porta: [fx, fz], frente: [gx, gz], dentro: [ix, iz], rua: ri, t, lado,
          parede: E.parede, canto: E.canto, piso: E.piso,
          telhado: E.telhados[Math.floor(rng() * E.telhados.length)],
          cama: [B.LA_VERMELHA, B.LA_AZUL, B.LA_AMARELA, B.LA_ROSA, B.LA_VERDE][Math.floor(rng() * 5)],
        };
        v.estruturas.push(est);
        if (tipo === 'fazenda') v.fazendas.push(est); else v.casas.push(est);
        if (tipo === 'padaria') v.padaria = est;
        if (tipo === 'loja') v.loja = est;
        rua.lados.push({ t, lado, est });
      }
    });
    // moinho de vento no fim da rua mais comprida (a hélice olha para a praça)
    const ruasPorTamanho = v.ruas.map((r, i) => [r.L, i]).sort((a, b) => b[0] - a[0]);
    for (const [, ri] of ruasPorTamanho) {
      const rua = v.ruas[ri];
      const [mx, mz] = this.ponto(C, rua.dx, rua.dz, 4 + rua.L + 5, 0);
      const folga = [mx - 4, mz - 4, mx + 4, mz + 4];
      // tem que caber na região da vila (cada pedaço só olha a vila da própria região)
      if (mx - 6 < rx * REGIAO || mz - 6 < rz * REGIAO || mx + 6 >= (rx + 1) * REGIAO || mz + 6 >= (rz + 1) * REGIAO) continue;
      if (!livre(folga)) continue;
      const y = Math.max(this.alt(mx, mz), this.nivel + 1);
      let pior = 0;
      for (const [qx, qz] of [[mx - 3, mz - 3], [mx + 3, mz - 3], [mx - 3, mz + 3], [mx + 3, mz + 3], [mx, mz]]) pior = Math.max(pior, Math.abs(this.alt(qx, qz) - y));
      if (pior > 5) continue;
      ocupado.push(folga);
      v.estruturas.push({ tipo: 'moinho', x: mx, z: mz, y, fx: -rua.dx, fz: -rua.dz, r: [mx - 5, mz - 5, mx + 5, mz + 5] });
      break;
    }
    // praça com poço por cima de tudo
    v.estruturas.push(...postes); // por último, em cima do chão já nivelado
    v.estruturas.unshift({ tipo: 'praca', r: [C.x - 4, C.z - 4, C.x + 4, C.z + 4], y: C.h });
    for (const o of ocupado) v.raio = Math.max(v.raio, Math.hypot(o[0] - C.x, o[1] - C.z), Math.hypot(o[2] - C.x, o[3] - C.z));
    return v;
  }

  // ponto a `t` blocos do centro ao longo da rua e `p` para o lado (lado +1 = à direita de quem sai da praça)
  ponto(C, dx, dz, t, p) { return [C.x + dx * t - dz * p, C.z + dz * t + dx * p]; }

  retRua(C, dx, dz, a0, a1, meia) {
    const [x0, z0] = this.ponto(C, dx, dz, a0, -meia), [x1, z1] = this.ponto(C, dx, dz, a1, meia);
    return [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)];
  }

  retLado(C, rua, t, lado, larg, fundo) {
    const h = (larg - 1) / 2;
    const [x0, z0] = this.ponto(C, rua.dx, rua.dz, t - h, 3 * lado);
    const [x1, z1] = this.ponto(C, rua.dx, rua.dz, t + h, (3 + fundo - 1) * lado);
    return [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)];
  }

  // árvores não nascem dentro (nem coladas) nas vilas
  semArvore(x, z) {
    const v = this.daColuna(x, z);
    return !!v && Math.hypot(x - v.x, z - v.z) < v.raio + 4;
  }

  // ---------- carimbar os blocos de um pedaço ----------
  carimbar(d, cx, cz, CX, CZ) {
    const v = this.regiao(Math.floor(cx * CX / REGIAO), Math.floor(cz * CZ / REGIAO));
    if (!v) return;
    const ox = cx * CX, oz = cz * CZ;
    const idx = (x, y, z) => x + z * CX + y * CX * CZ;
    const dentro = (x, z) => x >= ox && x < ox + CX && z >= oz && z < oz + CZ;
    const put = (x, y, z, b) => { if (y > 0 && y < ALT && dentro(x, z)) d[idx(x - ox, y, z - oz)] = b; };
    const get = (x, y, z) => dentro(x, z) && y >= 0 && y < ALT ? d[idx(x - ox, y, z - oz)] : AR;
    const toca = (r) => r[0] - 1 < ox + CX && r[2] + 1 >= ox && r[1] - 1 < oz + CZ && r[3] + 1 >= oz;
    const ctx = { put, get, dentro };
    for (const e of v.estruturas) {
      if (e.r ? !toca(e.r) : !dentro(e.x, e.z)) continue;
      if (e.tipo === 'rua') this.pintarRua(ctx, e);
      else if (e.tipo === 'praca') this.pintarPraca(ctx, e);
      else if (e.tipo === 'poste') this.pintarPoste(ctx, e);
      else if (e.tipo === 'fazenda') this.pintarFazenda(ctx, e);
      else if (e.tipo === 'moinho') this.pintarMoinho(ctx, e);
      else if (e.planta) this.pintarPlanta(ctx, e, v);
      else this.pintarCasa(ctx, e);
    }
  }

  // nivela um retângulo na altura y (enche embaixo, limpa em cima)
  aplainar({ put, dentro }, x0, z0, x1, z1, y, topo, limpar = 8) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z)) continue;
      const h = this.alt(x, z);
      for (let yy = Math.min(h, y - 1); yy < y; yy++) put(x, yy, z, yy < y - 3 ? B.PEDRA : B.TERRA);
      put(x, y, z, topo);
      for (let yy = y + 1; yy <= Math.max(h, y) + limpar; yy++) put(x, yy, z, AR);
    }
  }

  pintarRua({ put, get, dentro }, e) {
    const [x0, z0, x1, z1] = e.r;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z)) continue;
      const h = this.alt(x, z);
      if (h <= this.nivel) { put(x, this.nivel, z, B.TABUAS); continue; } // pontezinha
      put(x, h, z, e.mat);
      for (let yy = h + 1; yy <= h + 2; yy++) if (PLANTA[get(x, yy, z)]) put(x, yy, z, AR);
    }
  }

  pintarPoste({ put, get }, e) {
    let y = ALT - 2;
    while (y > 1 && (get(e.x, y, e.z) === AR || PLANTA[get(e.x, y, e.z)])) y--;
    put(e.x, y + 1, e.z, B.TRONCO);
    put(e.x, y + 2, e.z, B.TRONCO);
    this.lampiao(put, e.x, y + 3, e.z);
  }

  // poste de luz: com as máquinas ligadas, a lâmpada tem um sensor de noite em cima
  // (acende sozinha quando escurece e apaga de dia); sem máquinas, lampião sempre aceso
  lampiao(put, x, y, z) {
    if (opcoesMundo.maquinas === false) { put(x, y, z, B.LAMPIAO); return; }
    put(x, y, z, E.LAMPADA); put(x, y + 1, z, E.SENSOR);
  }

  pintarPraca(ctx, e) {
    const { put } = ctx;
    const [x0, z0, x1, z1] = e.r, y = e.y;
    const cx = x0 + 4, cz = z0 + 4;
    this.aplainar(ctx, x0, z0, x1, z1, y, B.PEDRISCO);
    // canteiros de flores nos cantos
    for (const [fx, fz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) { put(fx, y, fz, B.GRAMA); put(fx, y + 1, fz, B.FLOR_AMARELA); }
    // poço
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) { for (let yy = y - 3; yy <= y; yy++) put(cx, yy, cz, B.AGUA); continue; }
      put(cx + dx, y + 1, cz + dz, B.PEDRA);
      if (dx && dz) { put(cx + dx, y + 2, cz + dz, B.TRONCO); put(cx + dx, y + 3, cz + dz, B.TRONCO); }
      put(cx + dx, y + 4, cz + dz, B.TABUAS);
    }
    put(cx, y + 4, cz, B.TABUAS);
    put(cx, y + 5, cz, B.LAMPIAO);
    // manivela com o balde: toque para tirar água
    put(cx, y + 3, cz, M.SARILHO);
    // lampiões nos cantos da praça
    for (const [lx, lz] of [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]]) { put(lx, y + 1, lz, B.TRONCO); this.lampiao(put, lx, y + 2, lz); }
  }

  // Moinho de vento que funciona: a hélice (catavento) gira com o vento e gera energia, que desce
  // pelo cabo até a lâmpada e a pedra de moinho lá dentro. Com a pedra girando, o trigo vira farinha.
  // (x,z) = centro, (fx,fz) = para onde a hélice olha.
  pintarMoinho(ctx, e) {
    const { put } = ctx;
    const { x, z, y, fx, fz } = e;
    const sx = -fz, sz = fx; // lado
    const P = (f, s, k, b) => put(x + fx * f + sx * s, y + k, z + fz * f + sz * s, b);
    this.aplainar(ctx, x - 4, z - 4, x + 4, z + 4, y, B.GRAMA, 14);
    const maq = opcoesMundo.maquinas !== false;
    for (let f = -2; f <= 2; f++) for (let s = -2; s <= 2; s++) {
      P(f, s, 0, B.PEDRISCO);
      const borda = Math.abs(f) === 2 || Math.abs(s) === 2, canto = Math.abs(f) === 2 && Math.abs(s) === 2;
      // base de pedra (3 de altura) com janelas dos lados
      for (let k = 1; k <= 3; k++) P(f, s, k, borda ? (canto ? B.TRONCO : k === 2 && f === 0 ? B.VIDRO : B.PEDRA) : AR);
      // assoalho do andar de cima
      P(f, s, 4, borda ? B.TRONCO : B.TABUAS);
    }
    // torre de madeira (3x3) e telhado
    for (let f = -1; f <= 1; f++) for (let s = -1; s <= 1; s++) {
      const borda = f !== 0 || s !== 0, canto = Math.abs(f) === 1 && Math.abs(s) === 1;
      for (let k = 5; k <= 9; k++) P(f, s, k, borda ? (canto ? B.TRONCO : B.TABUAS) : AR);
      P(f, s, 10, B.LA_VERMELHA);
    }
    P(0, 0, 11, B.LA_VERMELHA);
    for (const [a, b] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) P(a, b, 9, B.LA_VERMELHA); // beiral
    // porta na frente e caminho
    P(2, 0, 1, M.PORTA); P(2, 0, 2, M.PORTA);
    P(3, 0, 0, B.PEDRISCO); P(4, 0, 0, B.PEDRISCO);
    // catavento (caixa de engrenagens) na frente da torre; a hélice gira em mecanismos.js
    P(2, 0, 8, M.CATAVENTO);
    // energia: cabo descendo pela frente da torre, pelo assoalho, até o canto de dentro
    for (let k = 5; k <= 8; k++) P(1, 0, k, maq ? M.CABO : B.TABUAS);
    P(1, 0, 4, maq ? M.CABO : B.TABUAS); P(1, 1, 4, maq ? M.CABO : B.TABUAS);
    P(1, 1, 3, maq ? M.CABO : AR); P(1, 1, 2, maq ? M.CABO : AR);
    P(1, 1, 1, maq ? E.LAMPADA : B.LAMPIAO); // acende quando a energia chega
    P(0, 1, 1, M.MO); // pedra de moinho (gira com a energia)
    // sacos de farinha no fundo
    P(-1, -1, 1, M.FARINHA); P(-1, 0, 1, M.FARINHA); P(-1, -1, 2, M.FARINHA);
  }

  pintarFazenda(ctx, e) {
    const { put } = ctx;
    const [x0, z0, x1, z1] = e.r, y = e.y;
    this.aplainar(ctx, x0 - 1, z0 - 1, x1 + 1, z1 + 1, y, B.GRAMA, 4);
    const longoX = x1 - x0 >= z1 - z0;
    const meio = longoX ? (z0 + z1) / 2 : (x0 + x1) / 2;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const borda = x === x0 || x === x1 || z === z0 || z === z1;
      if (borda) {
        // cerca de verdade (1,5 de altura: os bichos não fogem), com uma passagem virada para a rua
        if (x === e.porta[0] && z === e.porta[1]) { put(x, y, z, B.PEDRISCO); continue; }
        put(x, y, z, B.GRAMA); put(x, y + 1, z, 84); // 84 = Cerca (formas-defs.js)
        continue;
      }
      if ((longoX ? z : x) === meio) { put(x, y, z, B.AGUA); continue; }
      put(x, y, z, B.TERRA_ARADA); put(x, y + 1, z, B.TRIGO);
    }
    put(e.frente[0], y, e.frente[1], B.PEDRISCO);
  }

  // casa de verdade (planta de casas.js): a mesma que o pedreiro contratado constrói
  pintarPlanta(ctx, e, v) {
    const { put } = ctx;
    const [x0, z0, x1, z1] = e.r, y = e.y;
    const [px, pz] = e.porta, [ix, iz] = e.dentro;
    const ddx = Math.sign(ix - px), ddz = Math.sign(iz - pz);
    const r = DIRS4.findIndex(([a, b]) => a === ddx && b === ddz);
    if (!e.celulas) {
      const estilo = { parede: e.parede, canto: e.canto, piso: e.piso, telhado: e.telhado, faixa: e.canto === B.TRONCO ? B.TABUAS : B.TRONCO };
      const pos = noMundo(e.planta, px, y, pz, r);
      // na vila mora gente: o forno já está aceso (o da casa que o pedreiro faz, o jogador acende)
      e.celulas = desenhar(e.planta, estilo, e.v).map(([lx, ly, lz, b]) => [...pos(lx, ly, lz), b === M.FORNO ? M.FORNO_ACESO : girar(b, r)]);
    }
    this.aplainar(ctx, x0 - 1, z0 - 1, x1 + 1, z1 + 1, y, B.GRAMA, 14);
    for (const [x, yy, z, b] of e.celulas) put(x, yy, z, b);
    // lampião do lado de fora da porta e caminho até a rua
    put(px + (ddz ? 1 : 0), y + 3, pz + (ddx ? 1 : 0), B.LAMPIAO);
    put(e.frente[0], y, e.frente[1], e.piso === B.TABUAS ? B.PEDRISCO : e.piso);
  }

  pintarCasa(ctx, e) {
    const { put } = ctx;
    const [x0, z0, x1, z1] = e.r, y = e.y;
    const celeiro = e.tipo === 'celeiro';
    const H = celeiro ? 4 : 3; // altura das paredes
    this.aplainar(ctx, x0 - 1, z0 - 1, x1 + 1, z1 + 1, y, B.GRAMA, H + 8);
    const [px, pz] = e.porta, [ix, iz] = e.dentro;
    // direção da porta para dentro
    const ddx = Math.sign(ix - px), ddz = Math.sign(iz - pz);
    const parede = celeiro ? B.TABUAS : e.parede;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      put(x, y, z, celeiro ? B.TERRA : e.piso);
      const bx = x === x0 || x === x1, bz = z === z0 || z === z1;
      if (!bx && !bz) continue;
      for (let k = 1; k <= H; k++) put(x, y + k, z, bx && bz ? e.canto : parede);
      // janelas no meio das paredes
      const meioX = x === Math.floor((x0 + x1) / 2), meioZ = z === Math.floor((z0 + z1) / 2);
      if (!(bx && bz) && ((bz && meioX) || (bx && meioZ))) put(x, y + 2, z, B.VIDRO);
    }
    // porta (2 de altura, larga no celeiro) + lampião ao lado + caminho até a rua
    const larg = celeiro ? 1 : 0;
    for (let w = -larg; w <= larg; w++) {
      const qx = px + (ddz ? w : 0), qz = pz + (ddx ? w : 0);
      put(qx, y + 1, qz, M.PORTA); put(qx, y + 2, qz, M.PORTA);
      if (celeiro) put(qx, y + 3, qz, M.PORTA);
    }
    const [lx, lz] = [px + (ddz ? 1 + larg : 0), pz + (ddx ? 1 + larg : 0)];
    put(lx, y + H, lz, B.LAMPIAO);
    put(e.frente[0], y, e.frente[1], e.piso === B.TABUAS ? B.PEDRISCO : e.piso);
    // móveis (encostados na parede do fundo)
    if (celeiro) {
      for (const [hx, hz] of [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]]) {
        if (Math.abs(hx - px) + Math.abs(hz - pz) <= 2) continue;
        put(hx, y + 1, hz, B.FENO); put(hx, y + 2, hz, B.FENO);
      }
    } else if (ddz) {
      const fz = ddz > 0 ? z1 - 1 : z0 + 1;
      put(x0 + 1, y + 1, fz, e.cama); put(x0 + 2, y + 1, fz, B.LA_BRANCA);
      put(x1 - 1, y + 1, fz, M.FORNO_ACESO); // fogão a lenha aceso (ilumina a casa)
    } else {
      const fx = ddx > 0 ? x1 - 1 : x0 + 1;
      put(fx, y + 1, z0 + 1, e.cama); put(fx, y + 1, z0 + 2, B.LA_BRANCA);
      put(fx, y + 1, z1 - 1, M.FORNO_ACESO);
    }
    // telhado em pirâmide com beiral
    const T = e.telhado;
    for (let k = 0; ; k++) {
      const a0 = x0 - 1 + k, a1 = x1 + 1 - k, b0 = z0 - 1 + k, b1 = z1 + 1 - k;
      if (a0 > a1 || b0 > b1) break;
      for (let x = a0; x <= a1; x++) for (let z = b0; z <= b1; z++) put(x, y + H + 1 + k, z, T);
    }
  }
}

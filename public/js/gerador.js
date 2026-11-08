// Gerador "clássico" de mundo: continentes e oceanos, montanhas, rios, biomas pelo clima
// (temperatura e umidade), cavernas, minérios por profundidade e rocha-mãe no fundo.
// Algoritmo próprio, inspirado na ideia geral dos jogos de blocos clássicos.
// Este arquivo não usa DOM nem Three.js: roda tanto na página quanto no worker (gerador-worker.js).
import { criarRuido, hash3, rngSemente } from './ruido.js';

// ids dos blocos (iguais aos de blocos.js; o teste testes/teste-gerador.mjs confere)
export const G = {
  AR: 0, GRAMA: 1, TERRA: 2, PEDRA: 3, AREIA: 4, AGUA: 5, TRONCO: 6, FOLHAS: 7,
  FLOR_VERMELHA: 11, FLOR_AMARELA: 12, CAPIM: 13, FLOR_AZUL: 22,
  // neve, grama com neve, gelo e arenito: blocos das eras (blocos-eras.js)
  NEVE: 140, GRAMA_NEVE: 137, GELO: 138, ARENITO: 146, CACTO: 63, CASCALHO: 65,
  CARVAO: 66, FERRO: 67, OURO: 68, DIAMANTE: 69, ROCHA_MAE: 70,
  TRONCO_PINHEIRO: 71, FOLHAS_PINHEIRO: 72, TRONCO_BETULA: 73, FOLHAS_SELVA: 74, ARBUSTO_SECO: 75,
  // troncos redondos das árvores (formas-defs.js)
  TRONCO_R: 80, TRONCO_R_PINHEIRO: 81, TRONCO_R_BETULA: 82,
};

export const BIOMA = {
  OCEANO: 0, OCEANO_GELADO: 1, PRAIA: 2, RIO: 3, PLANICIE: 4, FLORESTA: 5, TAIGA: 6, NEVE: 7,
  DESERTO: 8, SAVANA: 9, SELVA: 10, MONTANHA: 11, RIO_GELADO: 12,
};
export const NOME_BIOMA = ['Oceano', 'Oceano gelado', 'Praia', 'Rio', 'Planície', 'Floresta', 'Taiga', 'Campos de neve',
  'Deserto', 'Savana', 'Selva', 'Montanhas', 'Rio congelado'];

const CX = 16, CZ = 16;
const idx = (x, y, z) => x + z * CX + y * CX * CZ;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const passo = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// curva da altura do terreno conforme a "continentalidade" (oceano fundo -> interior)
const CURVA = [[-1, -26], [-0.4, -19], [-0.2, -7], [-0.12, -2], [-0.06, 1], [0.08, 4], [0.35, 10], [1, 17]];
function curva(c) {
  if (c <= CURVA[0][0]) return CURVA[0][1];
  for (let i = 1; i < CURVA.length; i++) {
    const [x1, y1] = CURVA[i];
    if (c <= x1) { const [x0, y0] = CURVA[i - 1]; return y0 + (y1 - y0) * (c - x0) / (x1 - x0); }
  }
  return CURVA[CURVA.length - 1][1];
}

// limite: meia-largura do mundo-ilha (pequeno/médio) ou null (sem fim)
export function criarGerador(semente, alt, limite = null) {
  const S = 40; // nível do mar
  const ALT = alt;
  const rc = criarRuido(semente + 11), re = criarRuido(semente + 23), rp = criarRuido(semente + 37);
  const rd = criarRuido(semente + 41), rr = criarRuido(semente + 53), rt = criarRuido(semente + 67);
  const ru = criarRuido(semente + 79), rcav = criarRuido(semente + 97), rcav2 = criarRuido(semente + 101);
  const rsala = criarRuido(semente + 113);

  // tudo que se sabe de uma coluna só olhando x,z (barato; usado pelas vilas e pelo mapa)
  function coluna(x, z) {
    let c = rc.fbm(x / 720, z / 720, 4) * 1.35 + 0.1;
    if (limite) c = c * 0.6 + 0.22; // mundo-ilha: quase tudo terra firme (o mar fica na borda)
    const e = re.fbm(x / 430 + 31, z / 430 - 17, 3);
    const crista = 1 - Math.abs(rp.fbm(x / 250, z / 250, 4)) * 1.6;
    const det = rd.fbm(x / 64 + 50, z / 64 + 50, 3);
    // montanhas: onde a erosão é baixa e longe do mar
    const m = passo(0.1, -0.3, e) * passo(-0.04, 0.22, c);
    const pico = Math.max(0, crista);
    let h = S + curva(c) + det * (5 - m * 2) + m * Math.pow(pico, 2.2) * 38 + m * 6;
    // rios: um "vale" estreito onde o ruído do rio cruza o zero
    const rv = Math.abs(rr.fbm(x / 400, z / 400, 3));
    let rio = 0;
    if (c > -0.14) {
      const larg = 0.028 + m * 0.05;
      const t = passo(0, larg * 2.2, rv);
      const leito = S - 3;
      if (h > leito) h = leito + (h - leito) * t;
      rio = 1 - t;
    }
    if (limite) {
      // ilha: perto da borda o chão desce suave até o fundo do mar
      const L = limite;
      const dd = Math.hypot(Math.max(0, Math.abs(x) - L * 0.55), Math.max(0, Math.abs(z) - L * 0.55)) / (L * 0.45) + det * 0.08;
      const t = passo(0.55, 1, dd);
      h = h * (1 - t) + (S - 9) * t;
    }
    h = clamp(Math.floor(h), 3, ALT - 12);
    let temp = rt.fbm(x / 950, z / 950, 3) * 1.6 - Math.max(0, h - S - 18) / 45;
    const umid = ru.fbm(x / 760 + 90, z / 760 - 40, 3) * 1.6;
    let b;
    if (h < S) b = rio > 0.5 ? (temp < -0.5 ? BIOMA.RIO_GELADO : BIOMA.RIO) : (temp < -0.5 ? BIOMA.OCEANO_GELADO : BIOMA.OCEANO);
    else if (h <= S + 1 && rio < 0.5) b = BIOMA.PRAIA;
    else if (h >= S + 30) b = BIOMA.MONTANHA;
    else if (temp > 0.22) b = umid < -0.02 ? BIOMA.DESERTO : umid > 0.22 ? BIOMA.SELVA : BIOMA.SAVANA;
    else if (temp < -0.5) b = BIOMA.NEVE;
    else if (temp < -0.26) b = BIOMA.TAIGA;
    else if (umid > 0.08) b = BIOMA.FLORESTA;
    else b = BIOMA.PLANICIE;
    return { h, b, temp, umid, rio };
  }

  const alturaEm = (x, z) => coluna(x, z).h;
  const biomaEm = (x, z) => coluna(x, z).b;

  // ---------- terreno pesado (cavernas, minérios): pode rodar no worker ----------
  function terreno(cx, cz) {
    const d = new Uint8Array(CX * CZ * ALT);
    const ox = cx * CX, oz = cz * CZ;
    // alturas com 2 blocos de folga em volta (para inclinação e beira d'água)
    const W = CX + 4;
    const H = new Int16Array(W * W);
    const alturas = new Int16Array(CX * CZ), biomas = new Uint8Array(CX * CZ);
    for (let z = -2; z < CZ + 2; z++) for (let x = -2; x < CX + 2; x++) {
      const col = coluna(ox + x, oz + z);
      H[(x + 2) + (z + 2) * W] = col.h;
      if (x >= 0 && x < CX && z >= 0 && z < CZ) { alturas[x + z * CX] = col.h; biomas[x + z * CX] = col.b; }
    }
    const hAt = (x, z) => H[(x + 2) + (z + 2) * W];

    // cavernas: ruído 3D numa grade grossa (a cada 4 blocos) e interpolado
    const GY = Math.ceil(ALT / 4) + 1;
    const N1 = new Float32Array(5 * 5 * GY), N2 = new Float32Array(5 * 5 * GY), N3 = new Float32Array(5 * 5 * GY);
    let topoMax = 0;
    for (let i = 0; i < alturas.length; i++) if (alturas[i] > topoMax) topoMax = alturas[i];
    const gyMax = Math.min(GY - 1, Math.ceil((topoMax + 1) / 4));
    for (let gy = 0; gy <= gyMax; gy++) for (let gz = 0; gz < 5; gz++) for (let gx = 0; gx < 5; gx++) {
      const wx = ox + gx * 4, wy = gy * 4, wz = oz + gz * 4;
      const k = gx + gz * 5 + gy * 25;
      N1[k] = rcav.ruido3(wx / 38, wy / 20, wz / 38);
      N2[k] = rcav2.ruido3(wx / 38 + 7.3, wy / 20 - 3.1, wz / 38 + 1.7);
      N3[k] = rsala.ruido3(wx / 64, wy / 26, wz / 64);
    }
    const interp = (N, x, y, z) => {
      const gx = x >> 2, gy = y >> 2, gz = z >> 2;
      const fx = (x & 3) / 4, fy = (y & 3) / 4, fz = (z & 3) / 4;
      const k = gx + gz * 5 + gy * 25;
      const a = N[k] + (N[k + 1] - N[k]) * fx, b = N[k + 5] + (N[k + 6] - N[k + 5]) * fx;
      const c = N[k + 25] + (N[k + 26] - N[k + 25]) * fx, e = N[k + 30] + (N[k + 31] - N[k + 30]) * fx;
      const ab = a + (b - a) * fz, ce = c + (e - c) * fz;
      return ab + (ce - ab) * fy;
    };

    for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const h = hAt(x, z), bio = biomas[x + z * CX];
      // menor altura em volta: perto de água as cavernas ficam bem fundas (não inundam)
      let minH = h, inclin = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const q = hAt(x + dx, z + dz);
        if (q < minH) minH = q;
        if (Math.abs(dx) + Math.abs(dz) === 1) inclin = Math.max(inclin, Math.abs(q - h));
      }
      const molhado = minH <= S + 1;
      const tetoCaverna = molhado ? Math.min(h, minH) - 5 : h;
      const r = hash3(ox + x, 5, oz + z, semente);
      // camadas de superfície
      let topo = G.GRAMA, sub = G.TERRA, prof = 3 + Math.floor(r * 2);
      let embaixo = G.PEDRA, profEmbaixo = 0;
      switch (bio) {
        case BIOMA.OCEANO: case BIOMA.OCEANO_GELADO:
          topo = sub = h < S - 9 ? G.CASCALHO : G.AREIA; break;
        case BIOMA.RIO: case BIOMA.RIO_GELADO:
          topo = sub = r < 0.25 ? G.CASCALHO : G.AREIA; break;
        case BIOMA.PRAIA: topo = sub = G.AREIA; embaixo = G.ARENITO; profEmbaixo = 2; break;
        case BIOMA.DESERTO: topo = sub = G.AREIA; prof = 4; embaixo = G.ARENITO; profEmbaixo = 4; break;
        case BIOMA.NEVE: topo = G.GRAMA_NEVE; break;
        case BIOMA.MONTANHA: topo = h >= S + 40 ? G.NEVE : G.GRAMA; prof = 2; break;
        case BIOMA.TAIGA: if (h >= S + 24) topo = G.GRAMA_NEVE; break;
      }
      // encosta íngreme mostra a pedra
      if (inclin >= 3 && topo !== G.AREIA && bio !== BIOMA.DESERTO) {
        topo = h >= S + 40 ? G.NEVE : G.PEDRA; sub = G.PEDRA;
      }
      d[idx(x, 0, z)] = G.ROCHA_MAE;
      for (let y = 1; y <= h; y++) {
        let b;
        if (y === h) b = topo;
        else if (y > h - prof) b = sub;
        else if (y > h - prof - profEmbaixo) b = embaixo;
        else b = G.PEDRA;
        if (y === 1 && hash3(ox + x, y, oz + z, semente) < 0.5) b = G.ROCHA_MAE;
        d[idx(x, y, z)] = b;
      }
      // água até o nível do mar (gelo por cima no frio)
      for (let y = h + 1; y <= S; y++) d[idx(x, y, z)] = G.AGUA;
      if (h < S && (bio === BIOMA.OCEANO_GELADO || bio === BIOMA.RIO_GELADO)) d[idx(x, S, z)] = G.GELO;

      // escava as cavernas
      const limite = Math.min(tetoCaverna, h);
      for (let y = 3; y <= limite; y++) {
        // perto da superfície os túneis afinam (poucas entradas, nada de queijo suíço)
        const fundo = h - y;
        const esp = fundo < 6 ? 0.006 + fundo * 0.0012 : 0.014;
        const a = interp(N1, x, y, z), b = interp(N2, x, y, z);
        let oco = a * a + b * b < esp;
        if (!oco && y < S - 6 && fundo > 8) oco = interp(N3, x, y, z) > 0.5 - Math.min(0.12, (S - 6 - y) * 0.006);
        if (oco) d[idx(x, y, z)] = G.AR;
      }
    }

    // minérios e bolsões, em "veios" que andam ao acaso (determinísticos por pedaço)
    const rnd = rngSemente((semente * 31 + cx * 73856093 + cz * 19349663) >>> 0);
    const veio = (bloco, tentativas, yMin, yMax, tamMin, tamMax) => {
      for (let t = 0; t < tentativas; t++) {
        let x = Math.floor(rnd() * CX), z = Math.floor(rnd() * CZ), y = yMin + Math.floor(rnd() * (yMax - yMin));
        const n = tamMin + Math.floor(rnd() * (tamMax - tamMin + 1));
        for (let i = 0; i < n; i++) {
          if (x >= 0 && x < CX && z >= 0 && z < CZ && y > 1 && y < ALT) {
            const k = idx(x, y, z);
            if (d[k] === G.PEDRA) d[k] = bloco;
          }
          const dir = Math.floor(rnd() * 6);
          if (dir === 0) x++; else if (dir === 1) x--; else if (dir === 2) z++; else if (dir === 3) z--; else if (dir === 4) y++; else y--;
        }
      }
    };
    veio(G.CASCALHO, 3, 6, S + 20, 10, 22);
    veio(G.TERRA, 2, 10, S + 20, 10, 18);
    veio(G.CARVAO, 16, 5, S + 40, 6, 12);
    veio(G.FERRO, 10, 4, S + 10, 4, 8);
    veio(G.OURO, 3, 3, 26, 3, 7);
    veio(G.DIAMANTE, rnd() < 0.6 ? 1 : 2, 2, 14, 2, 6);
    return { dados: d, alturas, biomas };
  }

  // ---------- decoração (árvores, plantas, cactos): leve, roda na página ----------
  function decorar(d, cx, cz, alturas, biomas, semArvore) {
    const ox = cx * CX, oz = cz * CZ;
    for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const h = alturas[x + z * CX];
      if (h + 1 >= ALT - 14) continue;
      const chao = d[idx(x, h, z)];
      if (d[idx(x, h + 1, z)] !== G.AR) continue;
      const wx = ox + x, wz = oz + z;
      const bio = biomas[x + z * CX];
      const r = hash3(wx, 7, wz, semente), r2 = hash3(wx, 11, wz, semente), r3 = hash3(wx, 3, wz, semente);
      const cabe = (m) => x >= m && x <= CX - 1 - m && z >= m && z <= CZ - 1 - m && !semArvore(wx, wz);
      if (chao === G.AREIA) {
        if (bio === BIOMA.DESERTO) {
          if (r < 0.006 && cabe(1)) { const a = 1 + Math.floor(r3 * 3); for (let i = 1; i <= a; i++) d[idx(x, h + i, z)] = G.CACTO; }
          else if (r2 < 0.012) d[idx(x, h + 1, z)] = G.ARBUSTO_SECO;
        }
        continue;
      }
      if (chao !== G.GRAMA && chao !== G.GRAMA_NEVE) continue;
      // árvores conforme o bioma
      let arv = null, chance = 0;
      switch (bio) {
        case BIOMA.PLANICIE: arv = 'carvalho'; chance = 0.003; break;
        case BIOMA.FLORESTA: arv = r3 < 0.35 ? 'betula' : 'carvalho'; chance = 0.05; break;
        case BIOMA.TAIGA: arv = 'pinheiro'; chance = 0.045; break;
        case BIOMA.NEVE: arv = 'pinheiro'; chance = 0.008; break;
        case BIOMA.MONTANHA: arv = 'pinheiro'; chance = 0.012; break;
        case BIOMA.SAVANA: arv = 'acacia'; chance = 0.007; break;
        case BIOMA.SELVA: arv = r3 < 0.3 ? 'selva' : 'arbusto'; chance = 0.09; break;
      }
      if (arv && r < chance) {
        const m = arv === 'selva' ? 3 : 2;
        if (cabe(m)) { ARVORES[arv](d, x, h + 1, z, r3, ALT); continue; }
      }
      // plantinhas
      if (chao === G.GRAMA_NEVE) continue;
      const flores = bio === BIOMA.PLANICIE ? 0.06 : bio === BIOMA.FLORESTA || bio === BIOMA.SELVA ? 0.025 : 0.004;
      const capim = bio === BIOMA.SAVANA || bio === BIOMA.SELVA ? 0.3 : bio === BIOMA.PLANICIE ? 0.2 : bio === BIOMA.MONTANHA ? 0.05 : 0.12;
      if (r2 < flores) {
        const t = hash3(wx, 19, wz, semente);
        d[idx(x, h + 1, z)] = t < 0.4 ? G.FLOR_VERMELHA : t < 0.75 ? G.FLOR_AMARELA : G.FLOR_AZUL;
      } else if (r2 < flores + capim) d[idx(x, h + 1, z)] = G.CAPIM;
    }
  }

  return { nivelAgua: S, alturaEm, biomaEm, coluna, terreno, decorar };
}

// ---------- árvores ----------
function folha(d, x, y, z, b, ALT) {
  if (x < 0 || x >= CX || z < 0 || z >= CZ || y <= 0 || y >= ALT) return;
  const i = idx(x, y, z);
  const q = d[i];
  if (q === G.AR || q === G.CAPIM || q === G.FLOR_AMARELA || q === G.FLOR_VERMELHA || q === G.FLOR_AZUL) d[i] = b;
}
function tronco(d, x, y, z, n, b) { for (let i = 0; i < n; i++) d[idx(x, y + i, z)] = b; }

const ARVORES = {
  carvalho(d, x, y, z, r, ALT, tr = G.TRONCO_R, fo = G.FOLHAS) {
    const alt = 4 + Math.floor(r * 3);
    tronco(d, x, y, z, alt, tr);
    const topo = y + alt;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy < 0 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
        folha(d, x + dx, topo + dy, z + dz, fo, ALT);
      }
    }
  },
  betula(d, x, y, z, r, ALT) { ARVORES.carvalho(d, x, y, z, 0.4 + r * 0.6, ALT, G.TRONCO_R_BETULA, G.FOLHAS); },
  pinheiro(d, x, y, z, r, ALT) {
    const alt = 6 + Math.floor(r * 4);
    tronco(d, x, y, z, alt, G.TRONCO_R_PINHEIRO);
    const topo = y + alt;
    folha(d, x, topo, z, G.FOLHAS_PINHEIRO, ALT);
    folha(d, x, topo + 1, z, G.FOLHAS_PINHEIRO, ALT);
    // camadas em cone, alternando largura
    for (let dy = 0; dy < alt - 2; dy++) {
      const yy = topo - dy;
      const rad = dy === 0 ? 1 : dy % 2 ? Math.min(2, 1 + (dy >> 1)) : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (dx === 0 && dz === 0) continue;
        if (Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 1 : 0)) continue;
        folha(d, x + dx, yy, z + dz, G.FOLHAS_PINHEIRO, ALT);
      }
    }
  },
  acacia(d, x, y, z, r, ALT) {
    const alt = 4 + Math.floor(r * 2);
    const dx = r < 0.5 ? 1 : -1;
    tronco(d, x, y, z, alt - 1, G.TRONCO_R);
    const tx = x + dx, ty = y + alt - 1;
    d[idx(tx, ty, z)] = G.TRONCO_R;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      if (Math.abs(a) === 2 && Math.abs(b) === 2) continue;
      folha(d, tx + a, ty + 1, z + b, G.FOLHAS, ALT);
    }
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (Math.abs(a) + Math.abs(b) < 2) folha(d, tx + a, ty + 2, z + b, G.FOLHAS, ALT);
  },
  selva(d, x, y, z, r, ALT) {
    const alt = Math.min(ALT - y - 5, 9 + Math.floor(r * 6));
    tronco(d, x, y, z, alt, G.TRONCO_R);
    const topo = y + alt;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy <= -1 ? 3 : dy === 0 ? 2 : 1;
      for (let a = -rad; a <= rad; a++) for (let b = -rad; b <= rad; b++) {
        if (a * a + b * b > rad * rad + 1) continue;
        folha(d, x + a, topo + dy, z + b, G.FOLHAS_SELVA, ALT);
      }
    }
    // cipós de folhas pelo tronco
    for (let i = 2; i < alt - 2; i += 3) folha(d, x + (i % 2 ? 1 : -1), y + i, z, G.FOLHAS_SELVA, ALT);
  },
  arbusto(d, x, y, z, r, ALT) {
    d[idx(x, y, z)] = G.TRONCO;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) folha(d, x + a, y, z + b, G.FOLHAS_SELVA, ALT);
    folha(d, x, y + 1, z, G.FOLHAS_SELVA, ALT);
  },
};

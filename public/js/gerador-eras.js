// Terreno do mundo "Linha do Tempo": o relevo é o mesmo em todas as eras (mundo.alturaEm), mas
// o chão, as plantas, as árvores e os lugares especiais mudam conforme a era.
// Tudo nasce da semente + era, então todos os jogadores veem o mesmo mundo e o servidor
// continua guardando só o que os jogadores mudaram (as construções atravessam as eras).
//
// gerarEra(mundo, d, cx, cz, alturas, era): preenche um pedaço 16x16x64 (chamado por mundo.gerarDados).
// lugaresPerto(mundo, era, x, z, dist = 150): lugares especiais (vulcão, castelo...) perto de (x, z).
// CHAO_BICHOS: blocos do chão onde os bichos podem nascer.
import { hash3, rngSemente } from './ruido.js';
import { AR, B, PLANTA } from './blocos.js';
import { BE } from './blocos-eras.js';
import { ERAS } from './eras-regras.js';
import { REGIAO } from './vilas.js';

const CX = 16, CZ = 16, ALT = 64, NIVEL_AGUA = 20;
const idx = (x, y, z) => x + z * CX + y * CX * CZ;
const BASE_CAVERNA = NIVEL_AGUA + 7; // chão das cavernas rasas (nos morros)

// paleta do chão por era: topo (terra firme), embaixo do topo, praia, topo de montanha
const PALETA = [
  { topo: BE.MUSGO, sub: B.TERRA, praia: B.AREIA, alto: BE.BASALTO },
  { topo: BE.NEVE, sub: B.TERRA, praia: B.AREIA, alto: BE.BLOCO_NEVE },
  { topo: B.GRAMA, sub: B.TERRA, praia: B.AREIA, alto: B.PEDRA },
  { topo: B.GRAMA, sub: B.TERRA, praia: B.AREIA, alto: B.PEDRA },
  { topo: B.GRAMA, sub: B.TERRA, praia: B.AREIA, alto: B.PEDRA },
  { topo: B.GRAMA, sub: B.TERRA, praia: B.AREIA, alto: B.PEDRA },
  { topo: B.GRAMA, sub: B.TERRA, praia: B.AREIA, alto: B.PEDRA },
  { topo: B.GRAMA, sub: B.TERRA, praia: B.AREIA, alto: B.PEDRA },
];
const FLORES = [B.FLOR_VERMELHA, B.FLOR_AMARELA, B.FLOR_AZUL];

// rascunhos reaproveitados (o gerador não roda em paralelo)
const H0 = new Int16Array(CX * CZ); // altura natural (mundo.alturaEm) de cada coluna
const USADO = new Uint8Array(CX * CZ); // coluna já decorada (poça, plantação...)

// preenche o pedaço (cx, cz) da era `era` em d; alturas[x + z*16] recebe a altura do chão
export function gerarEra(mundo, d, cx, cz, alturas, era) {
  const P = PALETA[era] || PALETA[2];
  const s = mundo.semente, rA = mundo.ruido, rB = mundo.ruido2;
  const ox = cx * CX, oz = cz * CZ;
  const lugs = lugaresDoPedaco(mundo, era, ox, oz);
  const livre = (wx, wz) => {
    for (let i = 0; i < lugs.length; i++) { const L = lugs[i]; const m = L.raio + 3; if ((wx - L.x) ** 2 + (wz - L.z) ** 2 < m * m) return false; }
    return true;
  };
  USADO.fill(0);

  // ---------- 1. chão e camadas ----------
  for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
    const wx = ox + x, wz = oz + z, i = x + z * CX;
    let h = Math.min(ALT - 10, Math.max(4, mundo.alturaEm(wx, wz)));
    H0[i] = h;
    const praia = h <= NIVEL_AGUA + 1;
    let topo = praia ? P.praia : (h > 48 ? P.alto : P.topo), sub = praia ? B.AREIA : P.sub, sub2 = sub;
    if (era === 0) {
      // campos de pedra vulcânica (com pedra de lava brilhando nas rachaduras)
      if (!praia && h <= 48) {
        const v = rA.ruido2(wx / 48 + 500, wz / 48 - 300);
        if (v > 0.45) { topo = v > 0.6 && hash3(wx, 23, wz, s) < 0.05 ? BE.PEDRA_LAVA : BE.BASALTO; sub = BE.BASALTO; }
      }
    } else if (era === 1) {
      if (praia && h > NIVEL_AGUA) topo = BE.NEVE; // praia coberta de neve
      if (h > 38) { topo = BE.BLOCO_NEVE; sub = sub2 = BE.BLOCO_NEVE; } // montanhas brancas
    } else if (era === 3) {
      // areia e arenito perto da água e em manchas secas
      if (h <= NIVEL_AGUA + 3 || (h <= 40 && rA.ruido2(wx / 110 + 900, wz / 110 + 40) > 0.4)) { topo = B.AREIA; sub = B.AREIA; sub2 = BE.ARENITO; }
    } else if (era === 5 && !praia && h > 26) {
      // minas de carvão a céu aberto (degraus escavados no morro)
      const q = rA.ruido2(wx / 40 + 1300, wz / 40 - 700);
      if (q > 0.5 && livre(wx, wz) && !mundo.vilas.semArvore(wx, wz)) {
        h -= Math.min(4, 1 + Math.floor((q - 0.5) * 14));
        topo = hash3(wx, 29, wz, s) < 0.4 ? BE.CARVAO : B.PEDRA; sub = hash3(wx, 31, wz, s) < 0.3 ? BE.CARVAO : B.PEDRA; sub2 = B.PEDRA;
        USADO[i] = 1;
      }
    }
    alturas[i] = h;
    const fim = Math.max(h, NIVEL_AGUA);
    for (let y = 0; y <= fim; y++) {
      let b;
      if (y === 0 || y < h - 3) b = B.PEDRA;
      else if (y < h) b = y === h - 1 ? sub : sub2;
      else if (y === h) b = topo;
      else b = era === 1 && y === NIVEL_AGUA ? BE.GELO : B.AGUA; // lagos congelados na Era do Gelo
      d[idx(x, y, z)] = b;
    }
    // fósseis escondidos na pedra depois da era dos dinossauros; carvão a partir da Idade da Pedra
    if (era >= 1 && h > 12 && hash3(wx, 77, wz, s) < 0.004) d[idx(x, 4 + Math.floor(hash3(wx, 78, wz, s) * 6), z)] = BE.FOSSIL;
    if (era >= 2 && h > 14) {
      const c = hash3(wx, 91, wz, s);
      if (c < (era === 5 ? 0.12 : 0.05)) d[idx(x, 3 + Math.floor(hash3(wx, 92, wz, s) * (h - 8)), z)] = BE.CARVAO;
      // na Era Industrial o carvão aparece também perto da superfície (nos barrancos e cavernas)
      if (era === 5 && c > 0.9) d[idx(x, h - 4 - Math.floor(hash3(wx, 93, wz, s) * 3), z)] = BE.CARVAO;
    }
    // cavernas rasas nos morros (túneis que abrem nas encostas), da Idade da Pedra em diante
    if (era >= 2 && h > BASE_CAVERNA && h <= 50 && !USADO[i] && rB.ruido2(wx / 160 - 400, wz / 160 + 250) > 0.3
      && Math.abs(rA.ruido2(wx / 26 + 77, wz / 26 - 33)) < 0.055 && livre(wx, wz) && !mundo.vilas.semArvore(wx, wz)) {
      for (let y = BASE_CAVERNA; y <= Math.min(h, BASE_CAVERNA + 2); y++) d[idx(x, y, z)] = AR;
      if (era === 5 && hash3(wx, 94, wz, s) < 0.2) d[idx(x, BASE_CAVERNA - 1, z)] = BE.CARVAO;
      if (h <= BASE_CAVERNA + 2) { alturas[i] = BASE_CAVERNA - 1; USADO[i] = 1; } // valeta aberta (entrada)
    }
  }

  // ---------- 2. poças (dinossauros) e plantações (Idade Média) ----------
  if (era === 0) {
    for (let z = 1; z < CZ - 1; z++) for (let x = 1; x < CX - 1; x++) {
      const i = x + z * CX, h = alturas[i];
      if (USADO[i] || h <= NIVEL_AGUA + 2 || d[idx(x, h, z)] !== BE.MUSGO) continue;
      const wx = ox + x, wz = oz + z;
      if (rB.ruido2(wx / 9 + 700, wz / 9 - 150) < 0.62) continue;
      if (alturas[i - 1] < h || alturas[i + 1] < h || alturas[i - CX] < h || alturas[i + CX] < h || !livre(wx, wz)) continue;
      d[idx(x, h, z)] = B.AGUA; d[idx(x, h - 1, z)] = B.TERRA;
      USADO[i] = 1;
    }
  } else if (era === 4 && hash3(cx, 931, cz, s) < 0.3 && rB.fbm((ox + 8) / 90 + 300, (oz + 8) / 90 - 200, 2) < -0.2) {
    plantacao(mundo, d, ox, oz, alturas, livre);
  }

  // ---------- 3. árvores, plantas e pedras ----------
  // Era Industrial: menos árvores perto das cidades (e tocos onde cortaram)
  let fatorVila = 1;
  if (era === 5) for (const v of mundo.vilas.perto(ox + 8, oz + 8, 200)) fatorVila = Math.min(fatorVila, Math.max(0.08, (Math.hypot(v.x - ox - 8, v.z - oz - 8) - v.raio) / 70));
  for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
    const i = x + z * CX;
    if (USADO[i]) continue;
    const h = alturas[i];
    if (h + 2 >= ALT) continue;
    const wx = ox + x, wz = oz + z;
    if (lugs.length && !livre(wx, wz)) continue;
    const t = d[idx(x, h, z)];
    const acima = idx(x, h + 1, z);
    const rnd = hash3(wx, 7, wz, s), r2 = hash3(wx, 11, wz, s), r3 = hash3(wx, 19, wz, s);
    const cabe = x >= 2 && x <= 13 && z >= 2 && z <= 13 && h + 11 < ALT;
    const arv = (chance) => rnd < chance && cabe && !mundo.vilas.semArvore(wx, wz);
    if (era === 0) {
      if (t === BE.BASALTO || t === BE.PEDRA_LAVA) { if (r2 < 0.012) { d[acima] = BE.BASALTO; if (r3 < 0.4) d[acima + 256] = BE.BASALTO; } continue; }
      if (t === B.AREIA) { if (h > NIVEL_AGUA && r2 < 0.08) d[acima] = BE.CAVALINHA; continue; }
      if (t !== BE.MUSGO) continue;
      const f = rB.fbm(wx / 90 + 300, wz / 90 - 200, 2);
      if (arv(f > 0.1 ? 0.04 : 0.007)) { arvore(d, x, h + 1, z, r3 < 0.45 ? 'palmeira' : r3 < 0.75 ? 'cica' : 'samambaia', hash3(wx, 3, wz, s)); continue; }
      if (hash3(wx, 41, wz, s) < 0.0015 && x >= 1 && x <= 14 && z >= 1 && z <= 14) { ninhoPequeno(d, x, h, z, alturas, hash3(wx, 42, wz, s)); continue; }
      const perto = h <= NIVEL_AGUA + 3;
      if (r2 < (f > 0.1 ? 0.28 : 0.12)) d[acima] = perto || r3 < 0.35 ? BE.CAVALINHA : BE.SAMAMBAIA;
    } else if (era === 1) {
      if (t === BE.GELO || t === B.AREIA) continue;
      if (h <= NIVEL_AGUA + 2 && r2 < 0.025) { d[acima] = BE.GELO; if (r3 < 0.5) d[acima + 256] = BE.GELO; continue; } // blocos de gelo na beira dos lagos
      if (t !== BE.NEVE) { if (t === BE.BLOCO_NEVE && r2 < 0.006) d[acima] = BE.GELO; continue; }
      const f = rB.fbm(wx / 90 + 300, wz / 90 - 200, 2);
      if (arv(f > 0.05 ? 0.035 : 0.004)) { arvore(d, x, h + 1, z, 'pinheiro', hash3(wx, 3, wz, s), BE.FOLHAS_NEVE); continue; }
      if (r2 < 0.004) { const n = 1 + Math.floor(r3 * 3); for (let k = 1; k <= n; k++) d[idx(x, h + k, z)] = BE.GELO; continue; } // espinhos de gelo
      if (f < 0 && r2 < 0.04) d[acima] = B.CAPIM; // capim da estepe furando a neve
    } else {
      if (t === B.AREIA && era === 3 && h > NIVEL_AGUA) {
        if (rnd < (h <= NIVEL_AGUA + 3 ? 0.02 : 0.004) && cabe && !mundo.vilas.semArvore(wx, wz)) { arvore(d, x, h + 1, z, 'palmeira', hash3(wx, 3, wz, s)); continue; }
        if (r2 < 0.004) { d[acima] = BE.ARENITO; if (r3 < 0.5) d[acima + 256] = BE.ARENITO; continue; }
        if (r2 < 0.035) d[acima] = B.CAPIM;
        continue;
      }
      if (t !== B.GRAMA) continue;
      const f = rB.fbm(wx / 90 + 300, wz / 90 - 200, 2);
      const r = hash3(wx, 3, wz, s);
      if (era === 2) {
        if (arv(f > 0.18 ? 0.045 : 0.006)) { arvore(d, x, h + 1, z, 'carvalho', r); continue; }
        if (r2 < 0.0025 && x >= 1 && x <= 14 && z >= 1 && z <= 14) { pedregulho(d, x, h, z, alturas, r3); continue; }
        if (r2 < 0.012) { d[acima] = B.FOLHAS; continue; } // arbusto
      } else if (era === 3) {
        if (arv(f > 0.18 ? 0.022 : 0.006)) { arvore(d, x, h + 1, z, r3 < 0.6 ? 'oliveira' : 'cipreste', r); continue; }
      } else if (era === 4) {
        if (arv(f > 0.1 ? 0.05 : 0.005)) { arvore(d, x, h + 1, z, r3 < 0.3 ? 'pinheiro' : 'carvalho', r); continue; }
        if (f < -0.3) { if (r2 < 0.08) d[acima] = FLORES[Math.floor(r3 * 3)]; else if (r2 < 0.35) d[acima] = B.CAPIM; continue; } // campos
      } else if (era === 5) {
        if (rnd < (f > 0.18 ? 0.035 : 0.004) && cabe && !mundo.vilas.semArvore(wx, wz)) {
          if (r3 < fatorVila) arvore(d, x, h + 1, z, 'carvalho', r); else d[acima] = B.TRONCO; // toco
          continue;
        }
        if (r2 < 0.006) { d[acima] = BE.CARVAO; continue; }
      } else if (era === 6) {
        if (arv(f > 0.18 ? 0.035 : 0.004)) { arvore(d, x, h + 1, z, 'carvalho', r); continue; }
      } else {
        if (arv(f > 0.18 ? 0.03 : 0.006)) { arvore(d, x, h + 1, z, 'redonda', r); continue; }
        if (r2 < 0.004) { const n = 1 + Math.floor(r3 * 3); for (let k = 1; k <= n; k++) d[idx(x, h + k, z)] = BE.CRISTAL; continue; } // cristais brilhando
      }
      const prado = f < -0.25;
      if (r2 < (prado ? 0.1 : era === 7 ? 0.05 : 0.025)) d[acima] = FLORES[Math.floor(r3 * 3)];
      else if (r2 < 0.2) d[acima] = B.CAPIM;
    }
  }

  // ---------- 4. lugares especiais ----------
  if (lugs.length) {
    const c = ctxPedaco(d, ox, oz);
    for (const L of lugs) CONSTRUIR[L.id](c, L);
  }
}

// ---------- árvores ----------
function arvore(d, x, y, z, tipo, r, folha = B.FOLHAS, tronco = B.TRONCO) {
  const put = (dx, yy, dz, b) => { const i = idx(x + dx, yy, z + dz); if (d[i] === AR || PLANTA[d[i]]) d[i] = b; };
  const col = (n, b) => { for (let k = 0; k < n; k++) d[idx(x, y + k, z)] = b; };
  if (tipo === 'palmeira') {
    folha = BE.FOLHA_PALMEIRA;
    const alt = 5 + Math.floor(r * 3);
    col(alt, BE.TRONCO_PALMEIRA);
    const t = y + alt;
    put(0, t, 0, folha);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { put(dx, t, dz, folha); put(dx * 2, t - 1, dz * 2, folha); }
    for (const [dx, dz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) if (r * 7 % 1 < 0.6) put(dx, t - 1, dz, folha);
    return;
  }
  if (tipo === 'cica') { // cica: tronco baixinho e um leque de folhas
    const alt = 1 + Math.floor(r * 2);
    col(alt, BE.TRONCO_PALMEIRA);
    const t = y + alt;
    put(0, t, 0, BE.FOLHA_PALMEIRA);
    for (const [dx, dz] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) { put(dx, t, dz, BE.FOLHA_PALMEIRA); put(dx * 2, t - 1, dz * 2, BE.FOLHA_PALMEIRA); }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(dx, t, dz, BE.FOLHA_PALMEIRA);
    return;
  }
  if (tipo === 'samambaia') { // samambaia gigante (em forma de árvore)
    const alt = 3 + Math.floor(r * 2);
    col(alt, BE.TRONCO_PALMEIRA);
    const t = y + alt;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(dx, t, dz, BE.FOLHA_PALMEIRA);
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) put(dx, t - 1, dz, BE.FOLHA_PALMEIRA);
    put(0, t + 1, 0, BE.FOLHA_PALMEIRA);
    return;
  }
  if (tipo === 'pinheiro') { // cone em camadas
    const alt = 6 + Math.floor(r * 3);
    col(alt, tronco);
    const t = y + alt;
    put(0, t, 0, folha); put(0, t + 1, 0, folha);
    for (let k = 0; k < alt - 2; k++) {
      const yy = t - 1 - k, rad = k % 2 === 0 ? 1 : 2;
      if (k === 0) { for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(dx, yy, dz, folha); continue; }
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad === 2 && Math.abs(dx) + Math.abs(dz) > 3) continue;
        if (rad === 1 && k < 3 && dx && dz) continue;
        put(dx, yy, dz, folha);
      }
    }
    return;
  }
  if (tipo === 'oliveira') { // baixinha e larga
    const alt = 2 + Math.floor(r * 2);
    col(alt, tronco);
    const t = y + alt;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      if ((dx * 7 + dz * 3 + Math.floor(r * 10)) % 5 === 0 && (Math.abs(dx) === 2 || Math.abs(dz) === 2)) continue; // falhas
      put(dx, t, dz, folha);
      if (Math.abs(dx) + Math.abs(dz) <= 1) put(dx, t + 1, dz, folha);
    }
    return;
  }
  if (tipo === 'cipreste') { // fininho e alto
    col(2, tronco);
    for (let k = 2; k <= 7; k++) put(0, y + k, 0, folha);
    for (let k = 2; k <= 5; k++) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(dx, y + k, dz, folha);
    return;
  }
  if (tipo === 'redonda') { // copa de bola (Futuro)
    const alt = 3 + Math.floor(r * 2);
    col(alt, tronco);
    const cy = y + alt + 1;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      if (dx * dx + dy * dy + dz * dz > 5.3) continue;
      put(dx, cy + dy, dz, folha);
    }
    return;
  }
  // carvalho (o de sempre)
  const alt = 4 + Math.floor(r * 2);
  col(alt, tronco);
  const topo = y + alt;
  for (let dy = -2; dy <= 1; dy++) {
    const rad = dy < 0 ? 2 : 1;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
      put(dx, topo + dy, dz, folha);
    }
  }
}

// ninho pequeno de dinossauro no meio do musgo (uns ovinhos numa cama de terra)
function ninhoPequeno(d, x, h, z, alturas, r) {
  const i = x + z * CX;
  if (alturas[i - 1] !== h || alturas[i + 1] !== h || alturas[i - CX] !== h || alturas[i + CX] !== h) return;
  for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { d[idx(x + dx, h, z + dz)] = BE.PALHA; d[idx(x + dx, h + 1, z + dz)] = AR; USADO[x + dx + (z + dz) * CX] = 1; }
  d[idx(x, h + 1, z)] = BE.OVO_DINO;
  d[idx(x + (r < 0.5 ? 1 : -1), h + 1, z)] = BE.OVO_DINO;
  if (r > 0.3) d[idx(x, h + 1, z + (r < 0.65 ? 1 : -1))] = BE.OVO_DINO;
}

// pedra grande (Idade da Pedra)
function pedregulho(d, x, h, z, alturas, r) {
  const i = x + z * CX;
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const hh = alturas[i + dx + dz * CX];
    if (Math.abs(hh - h) > 1) return;
  }
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const hh = alturas[i + dx + dz * CX];
    d[idx(x + dx, hh + 1, z + dz)] = B.PEDRA;
    if (r < 0.6 || (dx === 0 && dz === 0)) d[idx(x + dx, hh + 2, z + dz)] = B.PEDRA;
    USADO[i + dx + dz * CX] = 1;
  }
  if (r < 0.3) d[idx(x, h + 3, z)] = B.PEDRA;
}

// plantação de trigo com cerquinha (campos da Idade Média), dentro de um pedaço só
function plantacao(mundo, d, ox, oz, alturas, livre) {
  const h = alturas[7 + 7 * CX];
  for (let z = 4; z <= 11; z++) for (let x = 3; x <= 12; x++) {
    if (alturas[x + z * CX] !== h || d[idx(x, h, z)] !== B.GRAMA) return;
  }
  if (h <= NIVEL_AGUA + 1 || !livre(ox + 7, oz + 7) || mundo.vilas.semArvore(ox + 7, oz + 7)) return;
  for (let z = 4; z <= 11; z++) for (let x = 3; x <= 12; x++) {
    USADO[x + z * CX] = 1;
    if (x === 3 || x === 12 || z === 4 || z === 11) { if (!(z === 4 && x === 7)) d[idx(x, h + 1, z)] = B.TRONCO; continue; }
    if (z === 7) { d[idx(x, h, z)] = B.AGUA; continue; }
    d[idx(x, h, z)] = B.TERRA_ARADA; d[idx(x, h + 1, z)] = B.TRIGO;
  }
  d[idx(2, h + 1, 3)] = B.FENO; d[idx(13, h + 1, 12)] = B.FENO;
}

// =====================================================================
// ---------- lugares especiais (landmarks) ----------
// Cada região de 96x96 blocos pode ter um lugar especial da era; perto de onde se começa
// sempre tem um de cada tipo da era (para a criança achar fácil).
// raio: tamanho no chão; alt: altura acima do chão; tol: desnível aceito; teto: chão mais alto aceito
const TIPOS = {
  vulcao: { nome: 'Vulcão', raio: 13, alt: 16, tol: 8, teto: 40 },
  ninho: { nome: 'Ninho de dinossauro', raio: 7, alt: 2, tol: 3, teto: 44 },
  geleira: { nome: 'Geleira gigante', raio: 15, alt: 11, tol: 6, teto: 42 },
  caverna: { nome: 'Caverna das pinturas', raio: 10, alt: 9, tol: 5, teto: 44 },
  circulo: { nome: 'Círculo de pedras', raio: 10, alt: 4, tol: 3, teto: 46 },
  piramide: { nome: 'Pirâmide', raio: 12, alt: 9, tol: 4, teto: 46 },
  templo: { nome: 'Templo', raio: 11, alt: 13, tol: 3, teto: 44 },
  castelo: { nome: 'Castelo', raio: 16, alt: 13, tol: 4, teto: 44 },
  moinho: { nome: 'Moinho', raio: 7, alt: 12, tol: 3, teto: 46 },
  fabrica: { nome: 'Fábrica', raio: 12, alt: 20, tol: 3, teto: 40 },
  estacao: { nome: 'Estação de trem', raio: 16, alt: 7, tol: 3, teto: 44 },
  predio: { nome: 'Arranha-céu', raio: 9, alt: 33, tol: 3, teto: 38 },
  estadio: { nome: 'Estádio', raio: 17, alt: 13, tol: 3, teto: 42 },
  foguete: { nome: 'Foguete', raio: 8, alt: 20, tol: 3, teto: 40 },
  cupula: { nome: 'Cúpula de cristal', raio: 11, alt: 10, tol: 3, teto: 44 },
};
export const NOMES_LUGARES = Object.fromEntries(Object.entries(TIPOS).map(([k, t]) => [k, t.nome]));

const tiposDaEra = (era) => ((ERAS[era] && ERAS[era].lugares) || []).filter((id) => TIPOS[id]);
const DIR8 = [[1, 0], [0.71, 0.71], [0, 1], [-0.71, 0.71], [-1, 0], [-0.71, -0.71], [0, -1], [0.71, -0.71]];
const FRENTE = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const altura = (m, x, z) => Math.min(ALT - 10, Math.max(4, m.alturaEm(x, z)));

const CACHES = new WeakMap(); // mundo -> Map(chave -> plano)
function cacheDe(m) {
  let c = CACHES.get(m);
  if (!c || c.semente !== m.semente) { c = { semente: m.semente, planos: new Map(), ultimo: null }; CACHES.set(m, c); }
  return c;
}

// onde o jogador provavelmente começa nesta era (igual a acharInicio do main.js)
function inicioProvavel(m, era) {
  if (era >= 2 && m.vilas.regiaoNaEra) {
    const v = m.vilas.regiaoNaEra(0, 0, era);
    if (v && v.ruas.length) { const r = v.ruas[0]; return [v.x + r.dx * 6, v.z + r.dz * 6]; }
  }
  for (let r = 0; r < 200; r += 4) for (let a = 0; a < 8; a++) {
    const x = Math.round(Math.cos(a * 0.785) * r), z = Math.round(Math.sin(a * 0.785) * r);
    const h = m.alturaEm(x, z);
    if (h > NIVEL_AGUA + 1 && h < 40) return [x, z];
  }
  return [0, 0];
}

// vilas (no tamanho máximo, para não depender da era atual) das regiões em volta de (x, z)
function vilasEmVolta(m, era, x, z, alcance = 1) {
  if (era < 2 || !m.vilas.regiaoNaEra) return [];
  const out = [];
  const rx = Math.floor(x / REGIAO), rz = Math.floor(z / REGIAO);
  for (let dz = -alcance; dz <= alcance; dz++) for (let dx = -alcance; dx <= alcance; dx++) {
    const v = m.vilas.regiaoNaEra(rx + dx, rz + dz, 7);
    if (v) out.push(v);
  }
  return out;
}

// o lugar cabe aqui? devolve a altura do chão ou null
function sitio(m, T, x, z, outros, vilas, ini) {
  const h0 = altura(m, x, z);
  if (h0 <= NIVEL_AGUA + 1 || h0 > T.teto) return null;
  if (m.limite && Math.max(Math.abs(x), Math.abs(z)) + T.raio > m.limite * 0.8) return null;
  if (Math.hypot(x - ini[0], z - ini[1]) < T.raio + 8) return null;
  for (const v of vilas) if (Math.hypot(x - v.x, z - v.z) < v.raio + T.raio + 8) return null;
  for (const o of outros) if (Math.hypot(x - o.x, z - o.z) < o.raio + T.raio + 10) return null;
  for (const f of [0.5, 1]) for (const [ax, az] of DIR8) {
    const h = altura(m, Math.round(x + ax * T.raio * f), Math.round(z + az * T.raio * f));
    if (h <= NIVEL_AGUA || Math.abs(h - h0) > T.tol) return null;
  }
  return h0;
}

function criarLugar(m, id, x, y, z, rng, olhar) {
  const T = TIPOS[id];
  const L = { id, nome: T.nome, x, y, z, raio: T.raio, topo: y + T.alt, dir: Math.floor(rng() * 4), s: Math.floor(rng() * 1e9) };
  if (olhar) { // porta virada para quem chega (de onde se começa)
    const ax = olhar[0] - x, az = olhar[1] - z;
    L.dir = Math.abs(ax) > Math.abs(az) ? (ax > 0 ? 0 : 2) : (az > 0 ? 1 : 3);
  }
  if (id === 'caverna') { // entrada da caverna virada para o lado mais baixo
    let melhor = 1e9;
    FRENTE.forEach(([fx, fz], k) => { const h = altura(m, x + fx * (T.raio + 3), z + fz * (T.raio + 3)); if (h < melhor) { melhor = h; L.dir = k; } });
  }
  if (id === 'vulcao') {
    L.rios = [0, 1, 2].map((k) => k * 2.1 + rng() * 1.2 - Math.PI);
    L.fumaca = [x + 0.5, y + 15, z + 0.5];
  }
  if (id === 'predio') { L.andares = Math.max(3, Math.min(7, Math.floor((ALT - 9 - y) / 4))); L.topo = y + L.andares * 4 + 5; }
  if (id === 'fabrica') {
    const [cu, cv] = [-4, 3], [fx, fz] = FRENTE[L.dir];
    L.fumaca = [x + cu * fx - cv * fz + 0.5, y + 21, z + cu * fz + cv * fx + 0.5];
  }
  return L;
}

// lugares perto de onde se começa: um de cada tipo da era
function planoOrigem(m, era) {
  const C = cacheDe(m), k = era + ':o';
  if (C.planos.has(k)) return C.planos.get(k);
  const out = [];
  C.planos.set(k, out);
  const ini = inicioProvavel(m, era);
  const vilas = vilasEmVolta(m, era, ini[0], ini[1], 2);
  const s = m.semente;
  tiposDaEra(era).forEach((id, n) => {
    const T = TIPOS[id];
    const rng = rngSemente((Math.imul(era + 1, 2654435761) ^ Math.imul(s, 40503) ^ (n * 977)) >>> 0);
    rng(); rng();
    const a0 = rng() * Math.PI * 2;
    let achou = null;
    // do mais perto para o mais longe; se não couber, aceita terreno mais torto
    for (let tent = 0; tent < 3 && !achou; tent++) {
      const Tt = tent === 0 ? T : { ...T, tol: T.tol + tent * 3 };
      for (let dist = T.raio + 14 + n * 10; dist <= 130 && !achou; dist += 5) {
        for (let a = 0; a < 16 && !achou; a++) {
          const ang = a0 + a * 0.3927;
          const x = Math.round(ini[0] + Math.cos(ang) * dist), z = Math.round(ini[1] + Math.sin(ang) * dist);
          const y = sitio(m, Tt, x, z, out, vilas, ini);
          if (y !== null) achou = criarLugar(m, id, x, y, z, rng, ini);
        }
      }
    }
    if (achou) out.push(achou);
  });
  return out;
}

// lugar sorteado de uma região de 96x96 (fica inteiro dentro da região)
function planoRegiao(m, era, rx, rz) {
  const C = cacheDe(m), k = era + ':' + rx + ',' + rz;
  if (C.planos.has(k)) return C.planos.get(k);
  const out = [];
  C.planos.set(k, out);
  const tipos = tiposDaEra(era);
  const s = m.semente;
  if (!tipos.length || hash3(rx, 811 + era, rz, s) > 0.5) return out;
  const rng = rngSemente((Math.imul(rx, 73856093) ^ Math.imul(rz, 19349663) ^ Math.imul(s + era * 7919, 83492791)) >>> 0);
  rng(); rng(); rng();
  const id = tipos[Math.floor(rng() * tipos.length)];
  const T = TIPOS[id];
  const origem = planoOrigem(m, era);
  const ini = inicioProvavel(m, era);
  const vilas = vilasEmVolta(m, era, rx * REGIAO + 48, rz * REGIAO + 48);
  const mg = T.raio + 4;
  for (let t = 0; t < 10; t++) {
    const x = rx * REGIAO + mg + Math.floor(rng() * (REGIAO - 2 * mg)), z = rz * REGIAO + mg + Math.floor(rng() * (REGIAO - 2 * mg));
    const y = sitio(m, T, x, z, origem, vilas, ini);
    if (y !== null) { out.push(criarLugar(m, id, x, y, z, rng)); break; }
  }
  return out;
}

// lugares que encostam no pedaço que começa em (ox, oz)
function lugaresDoPedaco(m, era, ox, oz) {
  const tipos = tiposDaEra(era);
  if (!tipos.length) return [];
  const out = [];
  const toca = (L) => { const r = L.raio + 4; return L.x + r >= ox && L.x - r < ox + CX && L.z + r >= oz && L.z - r < oz + CZ; };
  for (const L of planoRegiao(m, era, Math.floor(ox / REGIAO), Math.floor(oz / REGIAO))) if (toca(L)) out.push(L);
  for (const L of planoOrigem(m, era)) if (toca(L)) out.push(L);
  return out;
}

// Lugares especiais da era a até `dist` blocos de (x, z), do mais perto para o mais longe:
// [{ id, nome, x, y, z, raio, topo, dir, fumaca? }]
//   x, z = centro; y = altura do chão; topo = ponto mais alto; raio = tamanho no chão;
//   fumaca = [x, y, z] de onde sai fumaça (vulcão e chaminé da fábrica).
// O resultado é guardado: chamar a cada quadro é barato (só recalcula quando muda de pedaço).
export function lugaresPerto(mundo, era, x, z, dist = 150) {
  if (era === null || era === undefined || !tiposDaEra(era).length) return [];
  const C = cacheDe(mundo);
  const k = era + ':' + Math.floor(x / 16) + ',' + Math.floor(z / 16) + ':' + dist;
  if (C.ultimo && C.ultimo.k === k) return C.ultimo.lista;
  const lista = [];
  const visto = new Set();
  const add = (L) => { if (!visto.has(L) && Math.hypot(L.x - x, L.z - z) <= dist) { visto.add(L); lista.push(L); } };
  const rx = Math.floor(x / REGIAO), rz = Math.floor(z / REGIAO), n = Math.ceil(dist / REGIAO);
  for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) for (const L of planoRegiao(mundo, era, rx + dx, rz + dz)) add(L);
  for (const L of planoOrigem(mundo, era)) add(L);
  lista.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
  C.ultimo = { k, lista };
  return lista;
}

// ---------- construir os lugares (só a parte que cai no pedaço) ----------
function ctxPedaco(d, ox, oz) {
  const dentro = (x, z) => x >= ox && x < ox + CX && z >= oz && z < oz + CZ;
  const c = {
    put(x, y, z, b) { if (y > 0 && y < ALT && dentro(x, z)) d[idx(x - ox, y, z - oz)] = b; },
    get(x, y, z) { return y >= 0 && y < ALT && dentro(x, z) ? d[idx(x - ox, y, z - oz)] : AR; },
    alt(x, z) { return H0[(x - ox) + (z - oz) * CX]; },
    // percorre as colunas do retângulo que caem no pedaço
    cols(x0, z0, x1, z1, fn) {
      const a0 = Math.max(x0, ox), a1 = Math.min(x1, ox + CX - 1), b0 = Math.max(z0, oz), b1 = Math.min(z1, oz + CZ - 1);
      for (let z = b0; z <= b1; z++) for (let x = a0; x <= a1; x++) fn(x, z);
    },
    box(x0, y0, z0, x1, y1, z1, b) {
      if (x0 > x1) [x0, x1] = [x1, x0];
      if (z0 > z1) [z0, z1] = [z1, z0];
      const ya = Math.max(1, y0), yb = Math.min(ALT - 1, y1);
      c.cols(x0, z0, x1, z1, (x, z) => { for (let y = ya; y <= yb; y++) d[idx(x - ox, y, z - oz)] = b; });
    },
  };
  return c;
}

// coordenadas locais do lugar: u = para a frente (porta), v = para o lado
function local(c, L) {
  const [fx, fz] = FRENTE[L.dir];
  const wx = (u, v) => L.x + u * fx - v * fz, wz = (u, v) => L.z + u * fz + v * fx;
  return {
    put: (u, y, v, b) => c.put(wx(u, v), y, wz(u, v), b),
    get: (u, y, v) => c.get(wx(u, v), y, wz(u, v)),
    box: (u0, y0, v0, u1, y1, v1, b) => c.box(wx(u0, v0), y0, wz(u0, v0), wx(u1, v1), y1, wz(u1, v1), b),
    uv: (x, z) => { const dx = x - L.x, dz = z - L.z; return [dx * fx + dz * fz, -dx * fz + dz * fx]; },
  };
}

// aplaina o chão do lugar na altura L.y (enche embaixo, limpa em cima)
function fundar(c, L, raio, topo, quadrado = false, fundo = B.TERRA) {
  c.cols(L.x - raio, L.z - raio, L.x + raio, L.z + raio, (x, z) => {
    const dx = x - L.x, dz = z - L.z;
    if (!quadrado && dx * dx + dz * dz > (raio + 0.5) ** 2) return;
    const h = c.alt(x, z);
    for (let y = Math.min(h, L.y - 1); y < L.y; y++) c.put(x, y, z, y < L.y - 3 ? B.PEDRA : fundo);
    c.put(x, L.y, z, topo);
    for (let y = L.y + 1; y <= Math.max(h, L.y) + 2; y++) c.put(x, y, z, AR);
  });
}

const CONSTRUIR = {
  // cone de pedra vulcânica com pedra de lava na cratera e "rios" de lava descendo
  vulcao(c, L) {
    const R = 13.5, H = 16;
    c.cols(L.x - 14, L.z - 14, L.x + 14, L.z + 14, (x, z) => {
      const dx = x - L.x, dz = z - L.z, r = Math.hypot(dx, dz);
      if (r > R) return;
      const n = hash3(x, 61, z, L.s);
      const h = c.alt(x, z);
      let topo = L.y + (r <= 3.5 ? H : Math.max(0, Math.round(H * Math.pow((R - r) / (R - 3.5), 1.25) + n * 1.4 - 0.5)));
      let lava = false;
      if (r < 2.4) { topo = L.y + H - 2; lava = true; }
      else if (r >= 3.5 && r < R - 2.5) {
        const a = Math.atan2(dz, dx);
        for (const b of L.rios) { let q = Math.abs(a - b) % (Math.PI * 2); if (q > Math.PI) q = Math.PI * 2 - q; if (q * r < 0.75) lava = true; }
      }
      if (topo < h) return; // morro natural mais alto: fica como está
      for (let y = Math.min(h, L.y); y < topo; y++) c.put(x, y, z, BE.BASALTO);
      c.put(x, topo, z, lava ? BE.PEDRA_LAVA : r > R - 3 && n < 0.5 ? BE.MUSGO : BE.BASALTO);
      c.put(x, topo + 1, z, AR); c.put(x, topo + 2, z, AR);
    });
  },

  // ninho gigante: anel de gravetos, palha e ovos
  ninho(c, L) {
    fundar(c, L, 7, BE.MUSGO);
    c.cols(L.x - 7, L.z - 7, L.x + 7, L.z + 7, (x, z) => {
      const r = Math.hypot(x - L.x, z - L.z), n = hash3(x, 65, z, L.s);
      if (r < 3.3) c.put(x, L.y, z, BE.PALHA);
      else if (r < 4.8) { c.put(x, L.y + 1, z, BE.TRONCO_PALMEIRA); if (r >= 4.1 && n < 0.25) c.put(x, L.y + 2, z, BE.TRONCO_PALMEIRA); }
      else if (r < 7 && n < 0.35) c.put(x, L.y + 1, z, n < 0.2 ? BE.SAMAMBAIA : BE.CAVALINHA);
    });
    for (const [dx, dz] of [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2]]) c.put(L.x + dx, L.y + 1, L.z + dz, BE.OVO_DINO);
  },

  // geleira: um morro comprido de gelo com neve em cima e um túnel para atravessar
  geleira(c, L) {
    const l = local(c, L), A = 15, Bm = 9, H = 11;
    c.cols(L.x - 20, L.z - 20, L.x + 20, L.z + 20, (x, z) => {
      const [u, v] = l.uv(x, z);
      const e = (u / A) ** 2 + (v / Bm) ** 2;
      const h = c.alt(x, z);
      if (e < 1) {
        const hh = Math.round(H * Math.sqrt(1 - e) * (0.8 + 0.35 * hash3(x >> 1, 62, z >> 1, L.s)));
        const topo = L.y + hh;
        if (hh >= 1 && topo >= h) {
          for (let y = Math.min(h, L.y); y <= topo; y++) c.put(x, y, z, BE.GELO);
          if (hh > H * 0.45) c.put(x, topo, z, BE.BLOCO_NEVE);
          c.put(x, topo + 1, z, AR);
        }
      }
      if (e < 1.25 && Math.abs(v) <= 1) { // túnel de ponta a ponta
        c.put(x, L.y, z, e < 1 ? BE.GELO : BE.NEVE);
        for (let y = L.y + 1; y <= Math.max(L.y + 3, e < 1 ? 0 : h + 1); y++) c.put(x, y, z, AR);
      } else if (e >= 1.05 && e < 1.7 && hash3(x, 63, z, L.s) < 0.05) { // espinhos de gelo em volta
        const n = 1 + Math.floor(hash3(x, 64, z, L.s) * 3);
        for (let k = 1; k <= n; k++) c.put(x, h + k, z, BE.GELO);
      }
    });
  },

  // morro de pedra com uma caverna dentro: pinturas nas paredes, fogueira e camas de pele
  caverna(c, L) {
    const l = local(c, L), R = 10;
    c.cols(L.x - R - 1, L.z - R - 1, L.x + R + 1, L.z + R + 1, (x, z) => {
      const [u, v] = l.uv(x, z), r = Math.hypot(u, v);
      if (r > R + 0.5) return;
      const h = c.alt(x, z);
      const ho = Math.round(9 * Math.sqrt(Math.max(0, 1 - (r / (R + 0.5)) ** 2)) - hash3(x, 66, z, L.s) * 1.2);
      const topo = L.y + ho;
      if (ho >= 1 && topo >= h) {
        for (let y = Math.min(h, L.y); y <= topo; y++) c.put(x, y, z, B.PEDRA);
        // morro de pedra, com grama só no alto e musgo aqui e ali
        const g = hash3(x, 69, z, L.s);
        if (ho >= 6 || g < 0.25) { c.put(x, topo - 1, z, B.TERRA); c.put(x, topo, z, B.GRAMA); }
        else if (g < 0.4) c.put(x, topo, z, B.PEDRISCO);
        c.put(x, topo + 1, z, AR);
      }
      const entrada = u > 0 && Math.abs(v) <= 1;
      if (r < 6 || entrada) {
        const hi = entrada ? 3 : r < 4.6 ? 4 : 3;
        c.put(x, L.y, z, B.TERRA);
        for (let y = L.y + 1; y <= L.y + hi; y++) c.put(x, y, z, AR);
        if (entrada && r > 6) for (let y = L.y + 4; y <= h + 1 && r > 8.5; y++) c.put(x, y, z, AR); // abre a encosta
      } else if (r < 7.3 && ho >= 3) {
        for (let y = L.y + 1; y <= L.y + 3; y++) c.put(x, y, z, BE.PINTURA_RUPESTRE);
      }
    });
    l.put(0, L.y + 1, 0, BE.FOGUEIRA);
    for (const [u, v] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) l.put(u, L.y, v, B.PEDRISCO);
    l.put(-4, L.y + 1, 1, BE.PELE); l.put(-4, L.y + 1, 2, BE.PELE);
    l.put(-4, L.y + 1, -2, BE.PELE); l.put(-3, L.y + 1, -3, BE.PELE);
  },

  // círculo de pedras em pé, algumas com uma pedra deitada por cima, e fogueira no meio
  circulo(c, L) {
    fundar(c, L, 10, B.GRAMA);
    const rot = (L.s % 100) / 100;
    const pos = [];
    for (let k = 0; k < 12; k++) {
      const a = rot + k * Math.PI / 6;
      pos.push([Math.round(L.x + Math.cos(a) * 7), Math.round(L.z + Math.sin(a) * 7)]);
    }
    pos.forEach(([x, z], k) => { const hgt = k % 3 === 2 ? 3 : 4; for (let y = 1; y <= hgt; y++) c.put(x, L.y + y, z, B.PEDRA); });
    for (let k = 0; k < 12; k += 3) { // pedras deitadas ligando duas em pé
      const [a, b] = [pos[k], pos[k + 1]];
      for (let t = 0; t <= 1.001; t += 0.25) c.put(Math.round(a[0] + (b[0] - a[0]) * t), L.y + 5, Math.round(a[1] + (b[1] - a[1]) * t), B.PEDRA);
    }
    for (let k = 0; k < 5; k++) { // pedrinhas de dentro
      const a = rot + 0.3 + k * 1.2566;
      const x = Math.round(L.x + Math.cos(a) * 4), z = Math.round(L.z + Math.sin(a) * 4);
      c.put(x, L.y + 1, z, B.PEDRA); if (k % 2 === 0) c.put(x, L.y + 2, z, B.PEDRA);
    }
    c.box(L.x - 1, L.y, L.z - 1, L.x + 1, L.y, L.z + 1, B.PEDRISCO);
    c.put(L.x, L.y + 1, L.z, BE.FOGUEIRA);
  },

  // pirâmide de arenito com topo de ouro, corredor até a câmara do tesouro e dois obeliscos
  piramide(c, L) {
    const l = local(c, L);
    fundar(c, L, 12, B.AREIA, true);
    c.cols(L.x - 8, L.z - 8, L.x + 8, L.z + 8, (x, z) => {
      const m = Math.max(Math.abs(x - L.x), Math.abs(z - L.z)), topo = L.y + 9 - m;
      for (let y = L.y + 1; y <= topo; y++) c.put(x, y, z, y >= L.y + 8 ? BE.OURO : (y - L.y) % 3 === 0 ? BE.ARENITO_ENTALHADO : BE.ARENITO);
    });
    l.box(2, L.y + 1, 0, 8, L.y + 2, 0, AR); // corredor
    l.box(-1, L.y + 1, -1, 1, L.y + 3, 1, AR); // câmara
    l.box(-1, L.y, -1, 1, L.y, 1, BE.MOSAICO);
    l.box(2, L.y, 0, 8, L.y, 0, BE.ARENITO_ENTALHADO);
    l.put(-1, L.y + 1, -1, BE.OURO); l.put(-1, L.y + 1, 1, BE.OURO); l.put(-1, L.y + 1, 0, BE.FOGUEIRA);
    for (const v of [-3, 3]) { l.box(11, L.y + 1, v, 11, L.y + 4, v, BE.ARENITO_ENTALHADO); l.put(11, L.y + 5, v, BE.OURO); }
  },

  // templo de mármore com colunas, telhado de telha de barro e uma estátua dourada
  templo(c, L) {
    const l = local(c, L), y = L.y;
    fundar(c, L, 11, B.GRAMA, true);
    l.box(-8, y + 1, -6, 8, y + 1, 6, BE.MARMORE);
    l.box(-7, y + 2, -5, 7, y + 2, 5, BE.MARMORE);
    for (let u = -7; u <= 7; u += 2) for (const v of [-5, 5]) l.box(u, y + 3, v, u, y + 6, v, BE.COLUNA);
    for (let v = -3; v <= 3; v += 2) for (const u of [-7, 7]) l.box(u, y + 3, v, u, y + 6, v, BE.COLUNA);
    l.box(-7, y + 7, -5, 7, y + 7, 5, BE.MARMORE);
    for (let k = 0; k <= 5; k++) {
      l.box(-7, y + 8 + k, -5 + k, 7, y + 8 + k, 5 - k, BE.TERRACOTA);
      for (const u of [-7, 7]) l.box(u, y + 8 + k, -5 + k, u, y + 8 + k, 5 - k, BE.MARMORE);
    }
    l.box(-4, y + 3, -3, 4, y + 6, 3, BE.MARMORE); // sala do meio
    l.box(-3, y + 3, -2, 3, y + 6, 2, AR);
    l.box(4, y + 3, -1, 4, y + 5, 1, AR);
    l.box(-3, y + 2, -2, 3, y + 2, 2, BE.MOSAICO);
    l.box(-3, y + 3, 0, -3, y + 4, 0, BE.OURO);
    l.put(6, y + 3, -3, BE.FOGUEIRA); l.put(6, y + 3, 3, BE.FOGUEIRA);
  },

  // castelo: muralha com ameias, 4 torres com telhado pontudo, portão, estandartes e a torre do meio com vitrais
  castelo(c, L) {
    const l = local(c, L), y = L.y, W = 10, PC = BE.PEDRA_CASTELO;
    fundar(c, L, 13, B.GRAMA, true);
    l.box(-W + 1, y, -W + 1, W - 1, y, W - 1, B.PEDRISCO);
    for (const s of [-W, W]) { l.box(-W, y + 1, s, W, y + 6, s, PC); l.box(s, y + 1, -W, s, y + 6, W, PC); }
    for (let i = -W; i <= W; i += 2) for (const s of [-W, W]) { l.put(i, y + 7, s, PC); l.put(s, y + 7, i, PC); }
    l.box(W, y + 1, -1, W, y + 4, 1, AR); // portão
    for (const v of [-3, 3]) { l.box(W, y + 2, v, W, y + 5, v, BE.ESTANDARTE); l.put(W, y + 3, v > 0 ? 2 : -2, B.LAMPIAO); }
    for (const cu of [-W, W]) for (const cv of [-W, W]) { // torres
      l.box(cu - 2, y + 1, cv - 2, cu + 2, y + 9, cv + 2, PC);
      for (let k = 0; k <= 2; k++) l.box(cu - 2 + k, y + 10 + k, cv - 2 + k, cu + 2 - k, y + 10 + k, cv + 2 - k, B.LA_AZUL);
      l.put(cu, y + 13, cv, BE.ESTANDARTE);
      l.put(cu + (cu > 0 ? 2 : -2), y + 6, cv, BE.VITRAL); l.put(cu, y + 6, cv + (cv > 0 ? 2 : -2), BE.VITRAL);
    }
    // torre do meio
    l.box(-3, y + 1, -3, 3, y + 12, 3, PC);
    l.box(-2, y + 1, -2, 2, y + 11, 2, AR);
    l.box(-2, y, -2, 2, y, 2, B.LA_VERMELHA);
    l.box(3, y + 1, 0, 3, y + 3, 0, AR);
    for (const [a, b] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) l.box(a, y + 5, b, a, y + 8, b, BE.VITRAL);
    for (let i = -3; i <= 3; i += 2) for (const s of [-3, 3]) { l.put(i, y + 13, s, PC); l.put(s, y + 13, i, PC); }
    for (const v of [-2, 2]) l.box(3, y + 6, v, 3, y + 9, v, BE.ESTANDARTE);
    l.put(-2, y + 1, 0, BE.OURO); // trono
    for (const [a, b] of [[-2, 2], [-2, -2], [2, 2], [2, -2]]) l.put(a, y + 1, b, B.LAMPIAO);
  },

  // moinho de vento: base de pedra, corpo de enxaimel, telhado pontudo e 4 pás com pano
  moinho(c, L) {
    const l = local(c, L), y = L.y;
    fundar(c, L, 7, B.GRAMA);
    c.cols(L.x - 3, L.z - 3, L.x + 3, L.z + 3, (x, z) => {
      const r = Math.hypot(x - L.x, z - L.z);
      if (r > 2.6) return;
      for (let k = 1; k <= 8; k++) c.put(x, y + k, z, r <= 1.5 && k <= 7 ? AR : k <= 3 ? BE.PEDRA_CASTELO : BE.ENXAIMEL);
      if (r <= 1.5) c.put(x, y, z, B.TABUAS);
      if (r <= 2.9) c.put(x, y + 9, z, B.LA_VERMELHA);
      if (r <= 1.9) c.put(x, y + 10, z, B.LA_VERMELHA);
      if (r <= 0.5) c.put(x, y + 11, z, B.LA_VERMELHA);
    });
    l.box(2, y + 1, 0, 2, y + 2, 0, AR);
    l.put(3, y + 7, 0, B.TRONCO); l.put(4, y + 7, 0, B.TRONCO);
    for (let k = 1; k <= 5; k++) {
      l.put(4, y + 7 + k, 0, B.TABUAS); l.put(4, y + 7 - k, 0, B.TABUAS); l.put(4, y + 7, k, B.TABUAS); l.put(4, y + 7, -k, B.TABUAS);
      if (k >= 2) { l.put(4, y + 7 + k, 1, B.LA_BRANCA); l.put(4, y + 7 - k, -1, B.LA_BRANCA); l.put(4, y + 6, k, B.LA_BRANCA); l.put(4, y + 8, -k, B.LA_BRANCA); }
    }
    l.put(-1, y + 1, 1, B.FENO); l.put(-4, y + 1, 4, B.FENO); l.put(-4, y + 2, 4, B.FENO); l.put(-5, y + 1, 3, B.FENO);
  },

  // fábrica de tijolo com janelas, telhado em dente de serra, chaminé alta e engrenagens
  fabrica(c, L) {
    const l = local(c, L), y = L.y, TF = BE.TIJOLO_FABRICA;
    fundar(c, L, 12, B.PEDRISCO, true);
    l.box(-7, y + 1, -5, 7, y + 7, 5, TF);
    l.box(-6, y + 1, -4, 6, y + 6, 4, AR);
    l.box(-6, y, -4, 6, y, 4, B.PEDRA);
    for (let u = -5; u <= 5; u += 2) for (const v of [-5, 5]) l.box(u, y + 3, v, u, y + 5, v, B.VIDRO);
    for (const v of [-3, 3]) l.box(-7, y + 3, v, -7, y + 5, v, B.VIDRO);
    l.box(7, y + 1, -1, 7, y + 4, 1, AR); // portão
    for (const v of [-3, 3]) { l.box(7, y + 4, v, 7, y + 6, v, BE.ENGRENAGEM); l.put(7, y + 5, v - 1, BE.ENGRENAGEM); l.put(7, y + 5, v + 1, BE.ENGRENAGEM); }
    l.box(-7, y + 8, -5, 7, y + 8, 5, BE.FERRO);
    for (let u = -6; u <= 5; u += 4) { l.box(u, y + 9, -5, u + 1, y + 9, 5, BE.FERRO); l.box(u, y + 10, -5, u, y + 10, 5, B.VIDRO); }
    l.box(-5, y + 1, 2, -3, y + 20, 4, TF); // chaminé
    l.box(-5, y + 18, 2, -3, y + 18, 4, BE.FERRO);
    l.box(-2, y + 1, -3, 2, y + 2, -3, BE.FERRO); // máquinas
    for (let u = -2; u <= 2; u += 2) l.put(u, y + 3, -3, BE.ENGRENAGEM);
    l.box(0, y + 1, 1, 3, y + 1, 2, BE.FERRO); l.put(1, y + 2, 1, BE.ENGRENAGEM); l.put(3, y + 2, 2, BE.ENGRENAGEM);
    for (const u of [-3, 0, 3]) l.put(u, y + 6, 0, B.LAMPIAO);
    l.box(-2, y + 1, 7, 2, y + 1, 9, BE.CARVAO); l.box(-1, y + 2, 8, 1, y + 2, 8, BE.CARVAO); // monte de carvão
  },

  // estação de trem: trilho, plataforma coberta, prédio com relógio e um trenzinho parado
  estacao(c, L) {
    const l = local(c, L), y = L.y, TF = BE.TIJOLO_FABRICA;
    fundar(c, L, 16, B.GRAMA, true);
    for (let u = -15; u <= 15; u++) { l.put(u, y, 3, BE.FERRO); l.put(u, y, 4, B.TABUAS); l.put(u, y, 5, BE.FERRO); l.put(u, y, 2, B.PEDRISCO); l.put(u, y, 6, B.PEDRISCO); }
    l.box(-10, y + 1, -1, 10, y + 1, 1, B.PEDRISCO); // plataforma
    l.box(-5, y + 1, -7, 5, y + 5, -2, TF); // prédio
    l.box(-4, y + 2, -6, 4, y + 4, -3, AR);
    l.box(-4, y + 1, -6, 4, y + 1, -3, B.TABUAS);
    l.box(0, y + 2, -2, 0, y + 3, -2, AR);
    for (const u of [-3, 3]) { l.put(u, y + 3, -2, B.VIDRO); l.put(u, y + 3, -7, B.VIDRO); }
    for (const u of [-5, 5]) l.put(u, y + 3, -4, B.VIDRO);
    l.put(0, y + 5, -2, BE.ENGRENAGEM); // relógio
    for (let k = 0; k <= 3; k++) l.box(-6, y + 6 + k, -8 + k, 6, y + 6 + k, -1 - k, BE.TERRACOTA);
    l.box(-9, y + 5, -1, 9, y + 5, 1, BE.FERRO); // cobertura
    for (let u = -8; u <= 8; u += 4) l.box(u, y + 2, 1, u, y + 4, 1, BE.FERRO);
    for (const u of [-6, 0, 6]) l.put(u, y + 4, 0, B.LAMPIAO);
    // trenzinho (virado para +u)
    for (const u of [-10, -8, -6]) { l.put(u, y + 1, 3, BE.ENGRENAGEM); l.put(u, y + 1, 5, BE.ENGRENAGEM); }
    l.box(-11, y + 2, 3, -5, y + 3, 5, BE.FERRO);
    l.box(-11, y + 4, 3, -9, y + 5, 5, BE.FERRO);
    l.put(-10, y + 4, 3, B.VIDRO); l.put(-10, y + 4, 5, B.VIDRO);
    l.box(-11, y + 6, 3, -9, y + 6, 5, B.LA_VERMELHA);
    l.box(-6, y + 4, 4, -6, y + 5, 4, BE.FERRO); l.put(-6, y + 6, 4, BE.CARVAO);
    l.put(-4, y + 2, 4, B.LAMPIAO);
    for (const u of [-2, 0]) { l.put(u, y + 1, 3, BE.ENGRENAGEM); l.put(u, y + 1, 5, BE.ENGRENAGEM); }
    l.box(-3, y + 2, 3, 1, y + 2, 5, B.TABUAS);
    l.box(-2, y + 3, 4, 0, y + 3, 4, BE.CARVAO);
  },

  // arranha-céu de concreto e janela azul (não muito alto: o mundo tem 64 de altura)
  predio(c, L) {
    const l = local(c, L), y = L.y, Ht = L.andares * 4;
    fundar(c, L, 9, BE.CONCRETO, true);
    c.cols(L.x - 4, L.z - 4, L.x + 4, L.z + 4, (x, z) => {
      const ax = Math.abs(x - L.x), az = Math.abs(z - L.z), borda = ax === 4 || az === 4, canto = ax === 4 && az === 4;
      for (let k = 1; k <= Ht; k++) c.put(x, y + k, z, canto || k % 4 === 0 ? BE.CONCRETO : borda ? BE.VIDRO_AZUL : AR);
      c.put(x, y + Ht + 1, z, BE.CONCRETO);
      if (borda) c.put(x, y + Ht + 2, z, canto ? BE.LUZ_LED : BE.CONCRETO);
    });
    l.box(-3, y, -3, 3, y, 3, BE.AZULEJO);
    l.box(4, y + 1, -1, 4, y + 3, 1, AR); // porta
    l.box(5, y, -1, 9, y, 1, BE.AZULEJO); // caminho
    l.box(0, y + Ht + 2, 0, 0, y + Ht + 4, 0, BE.FERRO);
    l.put(0, y + Ht + 5, 0, BE.LUZ_LED);
    for (const [u, v] of [[-7, -7], [-7, 7], [7, -7], [7, 7]]) { // arvorezinhas na praça
      l.put(u, y, v, B.GRAMA); l.box(u, y + 1, v, u, y + 2, v, B.TRONCO); l.box(u - 1, y + 3, v - 1, u + 1, y + 3, v + 1, B.FOLHAS); l.put(u, y + 4, v, B.FOLHAS);
    }
    for (const [u, v] of [[6, -3], [6, 3], [-6, -3], [-6, 3]]) { l.box(u, y + 1, v, u, y + 2, v, BE.FERRO); l.put(u, y + 3, v, BE.LUZ_LED); }
  },

  // estádio: campo com linhas, pista vermelha, arquibancadas coloridas e torres de luz
  estadio(c, L) {
    const l = local(c, L), y = L.y, A = 16, Bm = 12;
    const ASSENTOS = [B.LA_AZUL, B.LA_AMARELA, B.LA_VERMELHA, B.LA_VERDE, B.LA_AZUL];
    c.cols(L.x - 17, L.z - 17, L.x + 17, L.z + 17, (x, z) => {
      const [u, v] = l.uv(x, z), e = Math.sqrt((u / A) ** 2 + (v / Bm) ** 2);
      if (e > 1.08) return;
      const h = c.alt(x, z);
      for (let yy = Math.min(h, y - 1); yy < y; yy++) c.put(x, yy, z, B.TERRA);
      for (let yy = y + 1; yy <= Math.max(h, y) + 2; yy++) c.put(x, yy, z, AR);
      const entrada = Math.abs(u) <= 1;
      if (e < 0.6) {
        const linha = u === 0 || e >= 0.56 || Math.abs(Math.hypot(u, v) - 3) < 0.5;
        c.put(x, y, z, linha ? B.LA_BRANCA : B.GRAMA);
      } else if (e < 0.66) c.put(x, y, z, BE.TERRACOTA);
      else if (e < 0.98) {
        c.put(x, y, z, BE.CONCRETO);
        if (entrada) return;
        const nivel = 1 + Math.floor((e - 0.66) / 0.32 * 5);
        for (let k = 1; k < nivel; k++) c.put(x, y + k, z, BE.CONCRETO);
        c.put(x, y + nivel, z, ASSENTOS[nivel - 1]);
      } else {
        c.put(x, y, z, BE.CONCRETO);
        if (e < 1.04) for (let k = entrada ? 4 : 1; k <= 6; k++) c.put(x, y + k, z, BE.CONCRETO);
      }
    });
    for (const su of [-9, 9]) { // gols
      for (const v of [-2, 2]) l.box(su, y + 1, v, su, y + 2, v, B.LA_BRANCA);
      l.box(su, y + 3, -2, su, y + 3, 2, B.LA_BRANCA);
    }
    for (const [u, v] of [[-12, -9], [-12, 9], [12, -9], [12, 9]]) { // torres de luz
      l.box(u, y + 1, v, u, y + 12, v, BE.FERRO);
      l.box(u - (u > 0 ? 1 : 0), y + 13, v - (v > 0 ? 1 : 0), u + (u < 0 ? 1 : 0), y + 13, v + (v < 0 ? 1 : 0), BE.LUZ_LED);
    }
  },

  // foguete na plataforma de lançamento, com torre de serviço
  foguete(c, L) {
    const l = local(c, L), y = L.y;
    fundar(c, L, 8, BE.METAL_BRANCO, true);
    c.cols(L.x - 8, L.z - 8, L.x + 8, L.z + 8, (x, z) => {
      const ax = Math.abs(x - L.x), az = Math.abs(z - L.z), r = Math.hypot(x - L.x, z - L.z);
      if (Math.max(ax, az) === 6 || (ax === 0 && az > 2 && az < 6) || (az === 0 && ax > 2 && ax < 6)) c.put(x, y, z, BE.NEON);
      if (r <= 2.3) for (let k = 1; k <= 16; k++) c.put(x, y + k, z, r <= 1.2 && k <= 15 ? AR : (k === 5 || k === 11) ? BE.NEON : BE.METAL_BRANCO);
      if (r <= 1.6) c.put(x, y + 17, z, BE.METAL_BRANCO);
      if (r <= 1.1) c.put(x, y + 18, z, BE.METAL_BRANCO);
    });
    l.put(0, y + 19, 0, BE.METAL_BRANCO); l.put(0, y + 20, 0, BE.NEON);
    for (const [u, v] of [[0, 2], [0, -2], [-2, 0], [2, 0]]) l.box(u, y + 13, v, u, y + 14, v, BE.VIDRO_AZUL);
    l.box(2, y + 1, 0, 2, y + 2, 0, AR); // porta
    l.put(0, y + 15, 0, BE.LUZ_LED);
    for (const [su, sv] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { // aletas
      l.box(su * 2, y + 1, sv * 2, su * 2, y + 5, sv * 2, BE.METAL_BRANCO);
      l.box(su * 3, y + 1, sv * 3, su * 3, y + 3, sv * 3, BE.METAL_BRANCO);
      l.box(su * 4, y + 1, sv * 4, su * 4, y + 2, sv * 4, BE.NEON);
    }
    l.box(-5, y + 1, 0, -5, y + 18, 0, BE.FERRO); // torre
    for (let k = 3; k <= 15; k += 4) l.box(-6, y + k, 0, -4, y + k, 0, BE.FERRO);
    l.box(-4, y + 14, 0, -3, y + 14, 0, BE.FERRO);
    l.put(-5, y + 19, 0, BE.LUZ_LED);
  },

  // cúpula de vidro com nervuras de cristal e um jardim dentro
  cupula(c, L) {
    const l = local(c, L), y = L.y, R = 9.5;
    fundar(c, L, 11, BE.METAL_BRANCO);
    c.cols(L.x - 11, L.z - 11, L.x + 11, L.z + 11, (x, z) => {
      const [u, v] = l.uv(x, z), r = Math.hypot(u, v);
      if (r > 11.5) return;
      if (r < 8.5) c.put(x, y, z, Math.abs(v) === 0 && u > 1 ? BE.METAL_BRANCO : B.GRAMA);
      else if (r >= 9.6 && r < 10.6) c.put(x, y, z, BE.NEON);
      const nervura = u === 0 || v === 0 || Math.abs(u) === Math.abs(v);
      for (let k = 1; k <= 10; k++) {
        const dd = Math.hypot(r, k);
        if (dd < R - 1 || dd >= R) continue;
        if (u > 6 && Math.abs(v) <= 1 && k <= 3) continue; // porta
        c.put(x, y + k, z, nervura ? BE.CRISTAL : B.VIDRO);
      }
      if (r >= 2 && r < 8 && Math.abs(v) > 0 && hash3(x, 67, z, L.s) < 0.12) c.put(x, y + 1, z, FLORES[Math.floor(hash3(x, 68, z, L.s) * 3)]);
    });
    l.box(-1, y, -1, 1, y, 1, B.AGUA); // laguinho
    for (const [u, v] of [[-4, 4], [-4, -4]]) { // árvores redondas
      l.put(u, y + 1, v, B.TRONCO); l.put(u, y + 2, v, B.TRONCO);
      l.box(u - 1, y + 3, v - 1, u + 1, y + 4, v + 1, B.FOLHAS); l.put(u, y + 5, v, B.FOLHAS);
    }
    for (const [u, v, n] of [[3, -4, 3], [4, 4, 2], [-6, 0, 2], [2, 6, 1]]) l.box(u, y + 1, v, u, y + n, v, BE.CRISTAL);
  },
};

// blocos do chão onde os bichos podem nascer, por era
export const CHAO_BICHOS = new Set([B.GRAMA, B.AREIA, BE.MUSGO, BE.NEVE, BE.BLOCO_NEVE]);

// Estilo "Natural 3D" (opcoes.estilo = 'suave'): o mundo continua feito de blocos (colisão, colocar e
// quebrar são os mesmos), mas o terreno e as copas das árvores são desenhados arredondados.
//
// Como funciona (surface nets): a malha continua sendo as mesmas faces entre bloco cheio e vazio,
// só que cada canto de face é empurrado para a superfície lisa que passa entre os blocos.
// Os cantos são compartilhados pelas faces vizinhas, então a malha continua fechada (sem buracos).
//  * terreno natural (grama, terra, pedra, areia, neve, minérios...): morros e beiradas viram rampas
//    suaves. A "densidade" é a média 3x3x3 de blocos cheios, o que espalha cada degrau por uns 3 blocos.
//  * folhas (com o tronco dentro): a copa vira uma bola; arbusto no chão vira um montinho.
//    Terreno, folhas e troncos naturais usam o mesmo campo, então os cantos que eles dividem batem.
//  * tudo que o jogador colocou, e as construções (casas, estradas de pedrisco, vidro, máquinas),
//    fica quadrado como foi feito. Um canto que encosta numa construção não se mexe, para não abrir fresta.
//  * perto de um bloco quebrado ou colocado o arredondado é o simples (sem a média), assim
//    o buraco que a criança cavou aparece do tamanho certo.
import { B, AR, PLANTA, AGUA, BLOCOS } from './blocos.js';
import { BE } from './blocos-eras.js';

// 1 = terreno que alisa, 2 = folhas, 3 = tronco (conta como cheio dentro da copa)
export const GRUPO_SUAVE = new Uint8Array(256);
for (const b of [B.GRAMA, B.TERRA, B.PEDRA, B.AREIA, B.CASCALHO, B.CARVAO, B.FERRO, B.OURO, B.DIAMANTE, B.ROCHA_MAE,
  BE.NEVE, BE.BLOCO_NEVE, BE.ARENITO]) GRUPO_SUAVE[b] = 1;
for (const b of [B.FOLHAS, B.FOLHAS_PINHEIRO, B.FOLHAS_SELVA, BE.FOLHAS_NEVE]) GRUPO_SUAVE[b] = 2;
for (const b of [B.TRONCO, B.TRONCO_PINHEIRO, B.TRONCO_BETULA]) GRUPO_SUAVE[b] = 3;
// troncos redondos (formas 80..82), se existirem nesta versão
for (const b of [80, 81, 82]) if (BLOCOS[b] && /tronco/i.test(BLOCOS[b].nome)) GRUPO_SUAVE[b] = 3;

// ---------- cores lisas (sem textura de pixel) ----------
// Cada bloco natural ganha duas cores: a de cima (chão plano) e a do lado (barranco). O shader (graficos.js,
// matSuave) mistura as duas pela inclinação e varia o tom com um ruído grande, como num desenho 3D.
// Os cantos misturam as cores dos blocos em volta: a praia passa para a grama num degradê, sem linha reta.
// sRGB em hex; ATLAS = usa a textura de sempre por cima da forma lisa (minérios: a criança precisa achar).
const HEX = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
export const PALETA = [];
const pal = (bs, topo, lado, atlas = false) => { for (const b of bs) PALETA[b] = { t: HEX(topo), l: HEX(lado), atlas }; };
pal([B.GRAMA], 0x62c43c, 0x8a6748);
pal([B.TERRA], 0x8f6a48, 0x7d5c40);
pal([B.PEDRA, B.CASCALHO, B.ROCHA_MAE], 0xa9a9ad, 0x8e8c93);
pal([B.CARVAO, B.FERRO, B.OURO, B.DIAMANTE], 0xa9a9ad, 0x8e8c93, true);
pal([B.AREIA], 0xf3d98f, 0xe2be72);
pal([BE.NEVE, BE.BLOCO_NEVE], 0xf4f8ff, 0xc9d6ea);
pal([BE.ARENITO], 0xe8b56c, 0xd49955);
pal([B.FOLHAS], 0x74d84c, 0x3d9e3f);
pal([B.FOLHAS_PINHEIRO], 0x4fbf63, 0x2b8a55);
pal([B.FOLHAS_SELVA], 0x66dc44, 0x2c9c40);
pal([BE.FOLHAS_NEVE], 0xe8f3ee, 0x7fb59a);
pal([B.TRONCO], 0xc08a5a, 0xb07a4c);
pal([B.TRONCO_PINHEIRO], 0xb37a52, 0xa36c46);
pal([B.TRONCO_BETULA], 0xeee8dc, 0xd9d1c2);
// troncos redondos (formas 80..82) que o gerador clássico usa nas árvores
if (GRUPO_SUAVE[80] === 3) { pal([80], 0xc08a5a, 0xb07a4c); pal([81], 0xb37a52, 0xa36c46); pal([82], 0xeee8dc, 0xd9d1c2); }
pal([B.CACTO], 0x6fcf5a, 0x3f9e48); // cacto vira coluna redonda (mundo.js)
// plantinhas estilizadas do mundo liso (desenharPlanta): tufo de capim e flores
export const COR_CAPIM = HEX(0x7ddb45), COR_CAPIM_BASE = HEX(0x3f9a2e);
export const COR_FLOR = { [B.FLOR_VERMELHA]: HEX(0xd81e30), [B.FLOR_AMARELA]: HEX(0xf5b80f), [B.FLOR_AZUL]: HEX(0x2f68e0) };
export const COR_MIOLO = HEX(0xfff4c2);

// arestas do cubo dual (pares de índices dos 8 blocos em volta do canto: bit0 = x, bit1 = y, bit2 = z)
const ARESTAS = [];
for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) ARESTAS.push([i, i | bit]);
const OFF = []; // centro de cada um dos 8 blocos em relação ao canto
for (let i = 0; i < 8; i++) OFF.push([(i & 1) - 0.5, ((i >> 1) & 1) - 0.5, ((i >> 2) & 1) - 0.5]);

// Prepara o alisamento de um pedaço (chunk). Só vale durante a montagem da malha dele.
//   get(x,y,z): bloco em coordenadas locais (pode sair do pedaço)
//   editado(x,y,z): true se um jogador mudou esse bloco (coordenadas locais)
//   alturaNatural(x,z): altura do chão que o gerador fez na coluna (acima disso é construção)
//   simples: true = sem a média 3x3x3 (aparelho fraco: mais rápido, arredonda menos)
//   ox, oz: canto do pedaço no mundo (as "bolhas" da copa usam a posição do mundo, sem emenda entre pedaços)
export function criarSuavizador(get, editado, alturaNatural, topo, simples = false, ox = 0, oz = 0) {
  const M = 3, W = 16 + 2 * M + 1, H = topo + 2 * M + 3; // região: blocos de -3 a 19 em x/z, -3 a topo+3 em y
  const N = W * W * H;
  const cl = new Uint8Array(N); // bits 0-1 classe, 4 editado, 7 já calculado
  const dens = new Float32Array(N).fill(-1);
  const altCol = new Int16Array(W * W).fill(-32768);
  const densG = new Float32Array(N).fill(-1); // média larga (5x5x5) só do chão
  const cantos = new Map(), cores = new Map();
  const ix = (x, y, z) => (x + M) + (z + M) * W + (y + M) * W * W;
  const fora = (x, y, z) => x < -M || x >= W - M || z < -M || z >= W - M || y < -M || y >= H - M;

  // classe: 0 = vazio (ar, água, plantinha), 1 = alisa, 2 = construção (prende o canto)
  function classe(x, y, z) {
    if (fora(x, y, z)) return 0x80 | 2;
    const i = ix(x, y, z);
    let c = cl[i];
    if (c & 0x80) return c;
    const b = get(x, y, z);
    const ed = editado(x, y, z) ? 1 : 0;
    let k = 0;
    if (!(b === AR || PLANTA[b] || AGUA[b])) {
      const g = GRUPO_SUAVE[b];
      if (ed || !g) k = 2;
      else if (g === 1) {
        let ac = altCol[(x + M) + (z + M) * W];
        if (ac === -32768) ac = altCol[(x + M) + (z + M) * W] = alturaNatural(x, z);
        k = y <= ac ? 1 : 2; // pedra/terra acima do chão natural é construção (castelo, muro...)
      } else k = 1;
    }
    c = 0x80 | k | (ed << 4);
    cl[i] = c;
    return c;
  }
  const cls = (x, y, z) => classe(x, y, z) & 3;

  // densidade: média dos blocos cheios no cubo 3x3x3 em volta (0..1)
  function densidade(x, y, z) {
    if (fora(x, y, z)) return 1;
    const i = ix(x, y, z);
    if (dens[i] >= 0) return dens[i];
    let s = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (cls(x + a, y + b, z + c)) s++;
    return (dens[i] = s / 27);
  }

  // densidade larga: média 5x5x5 com peso em "tenda" (1 2 3 2 1). O chão vira colina lisa: os degraus de
  // 1 bloco do terreno somem numa rampa de uns 5 blocos (a 3x3x3 deixava "curvas de nível").
  const PESO = [1 / 9, 2 / 9, 3 / 9, 2 / 9, 1 / 9];
  function densidadeLarga(x, y, z) {
    if (fora(x, y, z)) return 1;
    const i = ix(x, y, z);
    if (densG[i] >= 0) return densG[i];
    let s = 0;
    for (let a = -2; a <= 2; a++) {
      const wa = PESO[a + 2];
      for (let b = -2; b <= 2; b++) {
        const wb = wa * PESO[b + 2];
        for (let c = -2; c <= 2; c++) if (cls(x + a, y + b, z + c)) s += wb * PESO[c + 2];
      }
    }
    return (densG[i] = s);
  }

  // grupo da face deste bloco (0 = desenha quadrado como sempre)
  function grupo(x, y, z, b) {
    const g = GRUPO_SUAVE[b];
    return (g === 1 || g === 2) && cls(x, y, z) === 1 ? g : 0;
  }

  // canto (x,y,z) da grade: [dx, dy, dz, nx, ny, nz] (deslocamento e normal lisa) ou null = não mexe
  const s8 = new Uint8Array(8), d8 = new Float32Array(8);
  function canto(x, y, z) {
    const k = x + (z * 17 + y * 289) * 17;
    const mp = cantos;
    let r = mp.get(k);
    if (r !== undefined) return r;
    r = null;
    let cheios = 0, perto = simples, temChao = false, temCopa = false;
    for (let i = 0; i < 8; i++) {
      const cx = x - 1 + (i & 1), cy = y - 1 + ((i >> 1) & 1), cz = z - 1 + ((i >> 2) & 1);
      const c = cls(cx, cy, cz);
      if (c === 2) { mp.set(k, null); return null; } // encosta numa construção: fica no lugar
      s8[i] = c ? 1 : 0;
      cheios += s8[i];
      if (c) { const g = GRUPO_SUAVE[get(cx, cy, cz)]; if (g === 1) temChao = true; else if (g) temCopa = true; }
      if (classe(cx, cy, cz) & 16) perto = true;
    }
    if (cheios === 0 || cheios === 8) { mp.set(k, null); return null; }
    // perto de um bloco mexido pelo jogador (até 2 blocos): arredondado simples
    if (!perto) {
      for (let a = -2; a <= 1 && !perto; a++) for (let b = -2; b <= 1 && !perto; b++) for (let c = -2; c <= 1; c++) {
        if (classe(x + a, y + b, z + c) & 16) { perto = true; break; }
      }
    }
    let px = 0, py = 0, pz = 0, n = 0, largaUsada = false;
    if (!perto) {
      // chão: média larga (colinas lisas). Copa sozinha: média larga também, com limite mais baixo (fica cheia
      // e redonda, sem "andares"); copa encostada no chão (arbusto): média curta, para não sumir
      const larga = !(temChao && temCopa), iso = temCopa && !temChao ? 0.36 : 0.5;
      const dens = larga ? densidadeLarga : densidade;
      for (let i = 0; i < 8; i++) d8[i] = dens(x - 1 + (i & 1), y - 1 + ((i >> 1) & 1), z - 1 + ((i >> 2) & 1));
      for (const [a, b] of ARESTAS) {
        const da = d8[a] - iso, db = d8[b] - iso;
        if ((da < 0) === (db < 0)) continue;
        const t = da / (da - db);
        const oa = OFF[a], ob = OFF[b];
        px += oa[0] + (ob[0] - oa[0]) * t; py += oa[1] + (ob[1] - oa[1]) * t; pz += oa[2] + (ob[2] - oa[2]) * t; n++;
      }
      largaUsada = n > 0 && larga;
    }
    if (!n) {
      // sem a média (ou ela não cruzou aqui): ponto médio das arestas entre cheio e vazio
      for (let i = 0; i < 8; i++) d8[i] = s8[i];
      for (const [a, b] of ARESTAS) {
        if (s8[a] === s8[b]) continue;
        const oa = OFF[a], ob = OFF[b];
        px += (oa[0] + ob[0]) / 2; py += (oa[1] + ob[1]) / 2; pz += (oa[2] + ob[2]) / 2; n++;
      }
    }
    // normal: aponta do cheio para o vazio
    let nx = 0, ny = 0, nz = 0;
    if (largaUsada) {
      // chão liso: gradiente num cubo 4x4x4 (normal bem lisa; com só os 8 blocos a luz marcava cada degrau)
      for (let a = -2; a <= 1; a++) for (let b = -2; b <= 1; b++) for (let c = -2; c <= 1; c++) {
        const dd = densidadeLarga(x + a, y + b, z + c), oa = a + 0.5, ob = b + 0.5, oc = c + 0.5;
        const w = (Math.abs(oa) > 1 ? 0.5 : 1) * (Math.abs(ob) > 1 ? 0.5 : 1) * (Math.abs(oc) > 1 ? 0.5 : 1);
        nx -= dd * oa * w; ny -= dd * ob * w; nz -= dd * oc * w;
      }
    } else for (let i = 0; i < 8; i++) { nx -= d8[i] * OFF[i][0]; ny -= d8[i] * OFF[i][1]; nz -= d8[i] * OFF[i][2]; }
    const l = Math.hypot(nx, ny, nz);
    if (l > 1e-5) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
    px /= n; py /= n; pz /= n;
    // não deixa a superfície "inchar" para dentro do espaço vazio além do limite: o jogador encosta na parede
    // do bloco (a 0,3 dele) e o olho não pode ficar do lado de dentro do morro. No chão pode inchar mais.
    const dn = px * nx + py * ny + pz * nz;
    // (teto e parede em pé: até 0,18, longe do olho, que fica a 0,3 do bloco; chão e rampa: até 0,55, enche os
    // cantos dos degraus, que ficam no pé da parede, abaixo do olho)
    const t = Math.min(1, Math.max(0, ny / 0.3));
    const lim = 0.18 + 0.37 * t * t * (3 - 2 * t);
    if (dn > lim) { px -= (dn - lim) * nx; py -= (dn - lim) * ny; pz -= (dn - lim) * nz; }
    // copa de árvore: "bolhas" (a superfície sobe e desce devagar pela posição no mundo), como nuvenzinhas
    if (temCopa && !temChao && !perto) {
      const wx = ox + x, wz = oz + z;
      const f = Math.sin(wx * 1.1 + y * 0.7) * Math.sin(wz * 0.9 - y * 0.8) + 0.5 * Math.sin((wx + wz) * 0.6 + y * 1.3);
      const k = 0.12 + 0.16 * f;
      px += nx * k; py += ny * k; pz += nz * k;
    }
    // "AO liso": densidade da média larga um bloco para fora da superfície (interpolada): num vale ou no pé
    // de um barranco tem mais chão em volta e fica um pouco mais escuro. Sem degraus (a 8 blocos marcava cada um).
    let ao = 1;
    if (largaUsada && !temCopa) {
      const qx = x + px + nx - 0.5, qy = y + py + ny - 0.5, qz = z + pz + nz - 0.5; // centro do bloco i fica em i + 0,5
      const fx = Math.floor(qx), fy = Math.floor(qy), fz = Math.floor(qz), tx = qx - fx, ty = qy - fy, tz = qz - fz;
      let dd = 0;
      for (let i = 0; i < 8; i++) {
        const a = i & 1, b = (i >> 1) & 1, c = (i >> 2) & 1;
        dd += densidadeLarga(fx + a, fy + b, fz + c) * (a ? tx : 1 - tx) * (b ? ty : 1 - ty) * (c ? tz : 1 - tz);
      }
      ao = 1 - 0.5 * Math.min(1, Math.max(0, (dd - 0.23) * 2.5)); // ~0,22 no chão plano
    }
    r = [px, py, pz, nx, ny, nz, ao];
    mp.set(k, r);
    return r;
  }

  // quanto o chão liso embaixo de uma plantinha (bloco x,y,z) desceu ou subiu (para ela não flutuar)
  function ajustePlanta(x, y, z) {
    if (cls(x, y - 1, z) !== 1) return 0;
    let s = 0, n = 0;
    for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const r = canto(x + a, y, z + c); s += r ? r[1] : 0; n++; }
    return s / n;
  }

  // cor lisa de um canto: [topo r,g,b, lado r,g,b], média dos blocos naturais que encostam nele
  // (os de cima de tudo valem mais, assim a grama fica viva; o tronco quase não conta)
  function corCanto(x, y, z, bProprio) {
    const k = x + (z * 17 + y * 289) * 17;
    let r = cores.get(k);
    if (r) return r;
    r = [0, 0, 0, 0, 0, 0];
    let w = 0;
    for (let i = 0; i < 8; i++) {
      const cx = x - 1 + (i & 1), cy = y - 1 + ((i >> 1) & 1), cz = z - 1 + ((i >> 2) & 1);
      const b = get(cx, cy, cz), p = PALETA[b];
      if (!p) continue;
      const a = get(cx, cy + 1, cz);
      let wi = PALETA[a] && GRUPO_SUAVE[a] === GRUPO_SUAVE[b] ? 1 : 3;
      if (GRUPO_SUAVE[b] === 3) wi = 0.15;
      for (let j = 0; j < 3; j++) { r[j] += p.t[j] * wi; r[j + 3] += p.l[j] * wi; }
      w += wi;
    }
    if (w) for (let j = 0; j < 6; j++) r[j] /= w;
    else { const p = PALETA[bProprio]; r = p ? [...p.t, ...p.l] : [1, 1, 1, 1, 1, 1]; }
    cores.set(k, r);
    return r;
  }

  // o bloco é natural (alisa)? Tronco natural vira cilindro (mundo.js)
  const natural = (x, y, z) => cls(x, y, z) === 1;

  return { grupo, canto, ajustePlanta, corCanto, natural };
}

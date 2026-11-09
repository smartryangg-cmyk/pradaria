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
  BE.NEVE, BE.BLOCO_NEVE, BE.ARENITO, BE.MUSGO, BE.BASALTO, BE.PEDRA_LAVA, BE.BARRO, BE.CARVAO]) GRUPO_SUAVE[b] = 1; // + chão das eras (Linha do Tempo)
for (const b of [B.FOLHAS, B.FOLHAS_PINHEIRO, B.FOLHAS_SELVA, BE.FOLHAS_NEVE, BE.FOLHA_PALMEIRA]) GRUPO_SUAVE[b] = 2;
for (const b of [B.TRONCO, B.TRONCO_PINHEIRO, B.TRONCO_BETULA, BE.TRONCO_PALMEIRA]) GRUPO_SUAVE[b] = 3;
// troncos redondos (formas 80..82), se existirem nesta versão
for (const b of [80, 81, 82]) if (BLOCOS[b] && /tronco/i.test(BLOCOS[b].nome)) GRUPO_SUAVE[b] = 3;

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
export function criarSuavizador(get, editado, alturaNatural, topo, simples = false) {
  const M = 2, W = 16 + 2 * M + 1, H = topo + 2 * M + 3; // região: blocos de -2 a 18 em x/z, -2 a topo+3 em y
  const N = W * W * H;
  const cl = new Uint8Array(N); // bits 0-1 classe, 4 editado, 7 já calculado
  const dens = new Float32Array(N).fill(-1);
  const altCol = new Int16Array(W * W).fill(-32768);
  const cantos = new Map();
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
    let cheios = 0, perto = simples;
    for (let i = 0; i < 8; i++) {
      const cx = x - 1 + (i & 1), cy = y - 1 + ((i >> 1) & 1), cz = z - 1 + ((i >> 2) & 1);
      const c = cls(cx, cy, cz);
      if (c === 2) { mp.set(k, null); return null; } // encosta numa construção: fica no lugar
      s8[i] = c ? 1 : 0;
      cheios += s8[i];
      if (classe(cx, cy, cz) & 16) perto = true;
    }
    if (cheios === 0 || cheios === 8) { mp.set(k, null); return null; }
    // perto de um bloco mexido pelo jogador (até 2 blocos): arredondado simples
    if (!perto) {
      for (let a = -2; a <= 1 && !perto; a++) for (let b = -2; b <= 1 && !perto; b++) for (let c = -2; c <= 1; c++) {
        if (classe(x + a, y + b, z + c) & 16) { perto = true; break; }
      }
    }
    let px = 0, py = 0, pz = 0, n = 0;
    if (!perto) {
      for (let i = 0; i < 8; i++) d8[i] = densidade(x - 1 + (i & 1), y - 1 + ((i >> 1) & 1), z - 1 + ((i >> 2) & 1));
      for (const [a, b] of ARESTAS) {
        const da = d8[a] - 0.5, db = d8[b] - 0.5;
        if ((da < 0) === (db < 0)) continue;
        const t = da / (da - db);
        const oa = OFF[a], ob = OFF[b];
        px += oa[0] + (ob[0] - oa[0]) * t; py += oa[1] + (ob[1] - oa[1]) * t; pz += oa[2] + (ob[2] - oa[2]) * t; n++;
      }
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
    for (let i = 0; i < 8; i++) { nx -= d8[i] * OFF[i][0]; ny -= d8[i] * OFF[i][1]; nz -= d8[i] * OFF[i][2]; }
    const l = Math.hypot(nx, ny, nz);
    if (l > 1e-5) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
    px /= n; py /= n; pz /= n;
    // não deixa a superfície "inchar" para dentro do espaço vazio além do limite: o jogador encosta na parede
    // do bloco (a 0,3 dele) e o olho não pode ficar do lado de dentro do morro. No chão pode inchar mais.
    const dn = px * nx + py * ny + pz * nz;
    const t = Math.min(1, Math.max(0, (ny - 0.2) / 0.5));
    const lim = 0.1 + 0.25 * t * t * (3 - 2 * t);
    if (dn > lim) { px -= (dn - lim) * nx; py -= (dn - lim) * ny; pz -= (dn - lim) * nz; }
    r = [px, py, pz, nx, ny, nz];
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

  return { grupo, canto, ajustePlanta };
}

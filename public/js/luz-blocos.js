// Luz dos blocos que se espalha (como nos jogos de blocos clássicos): lampião, lâmpada acesa, forno aceso,
// fogueira, pedra de lava, LED, neon e cristal clareiam o que está em volta, perdendo 1 nível por bloco
// e sem atravessar blocos opacos. Assim um lampião numa caverna escura ilumina a caverna.
// É calculado só quando um pedaço do mundo é montado (mundo.js), então não custa nada ao jogar.
import { OPACO } from './blocos.js';

export const RAIO_LUZ = 7;          // até onde a luz chega (blocos)
export const LUZ_MAX = 8;           // nível da luz mais forte
export const EMITE = new Uint8Array(256); // nível de luz que cada bloco solta (0 = nenhum)
EMITE[21] = 8;   // lampião
EMITE[109] = 8;  // lâmpada acesa
EMITE[142] = 8;  // fogueira
EMITE[166] = 8;  // luz de LED
EMITE[134] = 7;  // pedra de lava
EMITE[169] = 6;  // neon
EMITE[170] = 5;  // cristal
EMITE[56] = 7;   // forno aceso (blocos-mecanismos.js)

const R = RAIO_LUZ;
// nível -> claridade (cai mais rápido longe da luz, como no clássico)
const CURVA = new Float32Array(LUZ_MAX + 1).map((_, i) => (i / LUZ_MAX) ** 1.5);
let grade = null, fila = null, W = 0, D = 0, H = 0;

// arrs: os 9 pedaços em volta ([dx+1 + (dz+1)*3], null = não carregado), cada um CX*CZ*alt.
// Devolve null quando não há luz por perto (o mais comum), ou a função luz(x, y, z) -> 0..1 (coords do pedaço).
export function calcularLuz(arrs, CX, CZ, ALT) {
  W = CX + 2 * R; D = CZ + 2 * R; H = ALT;
  const n = W * D * H;
  const camada = CX * CZ;
  const bloco = (x, y, z) => {
    const dx = x < 0 ? -1 : x >= CX ? 1 : 0, dz = z < 0 ? -1 : z >= CZ ? 1 : 0;
    const a = arrs[dx + 1 + (dz + 1) * 3];
    if (!a) return 0;
    return a[(x - dx * CX) + (z - dz * CZ) * CX + y * camada];
  };
  let nf = 0;
  // procura as fontes de luz nos 9 pedaços (só a faixa que alcança este)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const a = arrs[dx + 1 + (dz + 1) * 3];
    if (!a) continue;
    const x0 = dx < 0 ? CX - R : 0, x1 = dx > 0 ? R : CX, z0 = dz < 0 ? CZ - R : 0, z1 = dz > 0 ? R : CZ;
    for (let y = 0; y < ALT; y++) {
      const by = y * camada;
      for (let z = z0; z < z1; z++) {
        const bz = by + z * CX;
        for (let x = x0; x < x1; x++) {
          const e = EMITE[a[bz + x]];
          if (!e) continue;
          if (!grade || grade.length !== n) { grade = new Uint8Array(n); fila = new Int32Array(n); }
          if (!nf) grade.fill(0);
          const gx = x + dx * CX + R, gz = z + dz * CZ + R, g = gx + gz * W + y * W * D;
          if (grade[g] < e) { grade[g] = e; fila[nf++] = g; }
        }
      }
    }
  }
  if (!nf) return null;
  // espalha (busca em largura, nível por nível)
  const WD = W * D;
  for (let qi = 0; qi < nf; qi++) {
    const g = fila[qi], v = grade[g];
    if (v <= 1) continue;
    const y = Math.floor(g / WD), r = g - y * WD, gz = Math.floor(r / W), gx = r - gz * W;
    const prox = v - 1;
    const tenta = (nx, ny, nz) => {
      if (nx < 0 || nx >= W || nz < 0 || nz >= D || ny < 0 || ny >= H) return;
      const ng = nx + nz * W + ny * WD;
      if (grade[ng] >= prox) return;
      if (OPACO[bloco(nx - R, ny, nz - R)]) return;
      grade[ng] = prox;
      if (nf < fila.length) fila[nf++] = ng;
    };
    tenta(gx + 1, y, gz); tenta(gx - 1, y, gz); tenta(gx, y + 1, gz); tenta(gx, y - 1, gz); tenta(gx, y, gz + 1); tenta(gx, y, gz - 1);
  }
  const g2 = grade;
  return (x, y, z) => {
    const gx = x + R, gz = z + R;
    if (gx < 0 || gx >= W || gz < 0 || gz >= D || y < 0 || y >= H) return 0;
    return CURVA[g2[gx + gz * W + y * WD]];
  };
}

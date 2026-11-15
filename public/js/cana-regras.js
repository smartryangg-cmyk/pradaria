// Cana-de-açúcar (como no clássico), regras sem tela: plantacoes.js faz crescer, a sala confere com as mesmas contas.
// Só fica em cima de outra cana, ou na grama/terra/areia com água encostada (do lado) nesse chão.
// Cresce sozinha até 3 de altura, um pedaço por vez. Quebrar um pedaço derruba os de cima.
// 1 cana -> 1 açúcar; 3 trigos + 2 açúcares na bancada -> bolo (de comer).
// Não importe nada daqui que dependa do navegador.
import { sorteio, TIQUE_MS } from './plantacoes-regras.js';

export const CANA = 224, ACUCAR = 1011, BOLO = 1012;
export const ALTURA_CANA = 3;
export const CHANCE_CANA = 0.05;   // por tique de 5 s (~1 min e meio por pedaço)
export const CANA_MIN = 30000;     // cada pedaço novo espera pelo menos 30 s antes do próximo
export const CHAO_CANA = new Set([1, 2, 4]); // grama, terra, areia
const AGUAS = new Set([5, 23, 24, 25, 26, 27, 28, 29, 30]); // água parada e correndo (blocos.js)
const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// dá para ter cana em (x, y, z)? bloco(x, y, z) = o que tem no mundo
export function cabeCana(bloco, x, y, z) {
  const em = bloco(x, y - 1, z);
  if (em === CANA) return true;
  if (!CHAO_CANA.has(em)) return false;
  return H4.some(([dx, dz]) => AGUAS.has(bloco(x + dx, y - 1, z + dz)));
}
// quantas canas tem a coluna, de (x, y, z) para baixo
export function alturaCana(bloco, x, y, z) {
  let n = 0;
  while (n < 8 && bloco(x, y - n, z) === CANA) n++;
  return n;
}
// sorteio separado do trigo e da muda
const s = (x, y, z, t) => sorteio(x, y + 12288, z, t);
export const cresceCana = (x, y, z, tique) => s(x, y, z, tique) < CHANCE_CANA;
// a sala confere com folga de 1 tique (relógio de cada aparelho)
export function podeCrescerCana(x, y, z, agora = Date.now()) {
  const t = Math.floor(agora / TIQUE_MS);
  for (let d = -1; d <= 1; d++) if (cresceCana(x, y, z, t + d)) return true;
  return false;
}

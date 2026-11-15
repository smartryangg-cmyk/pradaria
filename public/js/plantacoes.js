// Plantações: o trigo plantado na Terra de plantar cresce sozinho (broto -> verde -> maduro).
// Como nos jogos de blocos clássicos, cada planta tem uma chance de crescer a cada "tique":
// com água a até 4 blocos (terra molhada) cresce o dobro mais rápido. Colher o maduro dá mais trigo
// do que plantou (receitas.js), então a plantação rende.
//
// Mundo online: o tique e o sorteio dependem só da hora (relógio de todos é parecido) e da posição,
// então todos os aparelhos tomam a mesma decisão na mesma hora e mandam a mesma mudança (repetida não faz mal).
import { B, AGUA } from './blocos.js';
import { CX, CZ } from './mundo.js';

export const TIQUE_MS = 5000;      // um "tique" de crescimento a cada 5 s
export const CHANCE = 0.08;        // por tique e por estágio (~1 min por estágio; ~2 min até colher)
export const CHANCE_MOLHADA = 0.16; // terra com água perto
const RAIO = 64;                   // só cresce perto de quem está jogando (o resto espera alguém chegar)
const PROXIMO = { [B.TRIGO_BROTO]: B.TRIGO_VERDE, [B.TRIGO_VERDE]: B.TRIGO };

// número entre 0 e 1 fixo para (posição, tique)
export function sorteio(x, y, z, tique) {
  let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791) ^ Math.imul(tique | 0, 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// terra de plantar com água a até 4 blocos (mesmo nível ou um acima)
export function molhada(mundo, x, y, z) {
  for (let dy = 0; dy <= 1; dy++) for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
    if (AGUA[mundo.bloco(x + dx, y + dy, z + dz)]) return true;
  }
  return false;
}

export class Plantacoes {
  constructor(mundo) { this.mundo = mundo; this.ultimo = Math.floor(Date.now() / TIQUE_MS); }

  // chamado a cada quadro; px/pz = onde o jogador está
  atualizar(px, pz, agora = Date.now()) {
    const tique = Math.floor(agora / TIQUE_MS);
    if (tique === this.ultimo) return 0;
    // aba em segundo plano ou aparelho travado: conta só 1 tique (não cresce tudo de uma vez)
    this.ultimo = tique;
    return this.tique(px, pz, tique);
  }

  // percorre as mudanças feitas pelos jogadores perto de (px, pz): só elas podem ter trigo plantado
  tique(px, pz, tique) {
    const m = this.mundo, crescer = [];
    for (const [k, mapa] of m.edicoes) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx * CX + CX / 2 - px) > RAIO + CX || Math.abs(cz * CZ + CZ / 2 - pz) > RAIO + CZ) continue;
      for (const [i, b] of mapa) {
        if (!PROXIMO[b]) continue;
        const x = cx * CX + (i % CX), z = cz * CZ + (Math.floor(i / CX) % CZ), y = Math.floor(i / (CX * CZ));
        if (m.bloco(x, y, z) !== b) continue; // ainda não carregou ou já mudou
        if (m.bloco(x, y - 1, z) !== B.TERRA_ARADA) continue; // só cresce na terra de plantar
        const chance = molhada(m, x, y - 1, z) ? CHANCE_MOLHADA : CHANCE;
        if (sorteio(x, y, z, tique) < chance) crescer.push([x, y, z, PROXIMO[b]]);
      }
    }
    for (const [x, y, z, b] of crescer) m.definir(x, y, z, b);
    return crescer.length;
  }
}

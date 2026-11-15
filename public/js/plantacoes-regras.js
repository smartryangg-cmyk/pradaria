// Regras do crescimento do trigo sem tela (plantacoes.js desenha e manda; a sala confere com estas mesmas contas).
// Não importe nada daqui que dependa do navegador.
export const TIQUE_MS = 5000;      // um "tique" de crescimento a cada 5 s
export const CHANCE = 0.08;        // por tique e por estágio (~1 min por estágio; ~2 min até colher)
export const CHANCE_MOLHADA = 0.16; // terra com água perto

// número entre 0 e 1 fixo para (posição, tique)
export function sorteio(x, y, z, tique) {
  let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791) ^ Math.imul(tique | 0, 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// a sala confere: neste tique (ou num vizinho, pelo relógio de cada aparelho) a planta podia crescer?
// A sala não sabe se tem água perto (o mundo gerado fica no aparelho), então usa a chance maior.
export function podeCrescer(x, y, z, agora = Date.now()) {
  const t = Math.floor(agora / TIQUE_MS);
  for (let d = -1; d <= 1; d++) if (sorteio(x, y, z, t + d) < CHANCE_MOLHADA) return true;
  return false;
}

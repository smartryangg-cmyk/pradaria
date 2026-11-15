// Plantações: o trigo plantado na Terra de plantar cresce sozinho (broto -> verde -> maduro).
// Como nos jogos de blocos clássicos, cada planta tem uma chance de crescer a cada "tique":
// com água a até 4 blocos (terra molhada) cresce o dobro mais rápido. Colher o maduro dá mais trigo
// do que plantou (receitas.js), então a plantação rende.
//
// Mundo online: o tique e o sorteio dependem só da hora (relógio de todos é parecido) e da posição,
// então todos os aparelhos tomam a mesma decisão na mesma hora e mandam a mesma mudança (repetida não faz mal).
import { B, AGUA, PLANTA, FOLHAGEM } from './blocos.js';
import { MUDAS, CHAO_DA_MUDA, MUDA_MIN, cresceMuda, formaArvore } from './arvores-regras.js';
import { CX, CZ } from './mundo.js';
import { CANA, ALTURA_CANA, CANA_MIN, cabeCana, alturaCana, cresceCana } from './cana-regras.js';

export { TIQUE_MS, CHANCE, CHANCE_MOLHADA, sorteio } from './plantacoes-regras.js';
import { TIQUE_MS, CHANCE, CHANCE_MOLHADA, sorteio } from './plantacoes-regras.js';
const RAIO = 64;                   // só cresce perto de quem está jogando (o resto espera alguém chegar)
const PROXIMO = { [B.TRIGO_BROTO]: B.TRIGO_VERDE, [B.TRIGO_VERDE]: B.TRIGO };

// terra de plantar com água a até 4 blocos (mesmo nível ou um acima)
export function molhada(mundo, x, y, z) {
  for (let dy = 0; dy <= 1; dy++) for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
    if (AGUA[mundo.bloco(x + dx, y + dy, z + dz)]) return true;
  }
  return false;
}

export class Plantacoes {
  constructor(mundo) { this.mundo = mundo; this.ultimo = Math.floor(Date.now() / TIQUE_MS); this.mudaVista = new Map(); this.canaVista = new Map(); }

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
    const m = this.mundo, crescer = [], arvores = [];
    for (const [k, mapa] of m.edicoes) {
      const [cx, cz] = k.split(',').map(Number);
      if (Math.abs(cx * CX + CX / 2 - px) > RAIO + CX || Math.abs(cz * CZ + CZ / 2 - pz) > RAIO + CZ) continue;
      for (const [i, b] of mapa) {
        if (MUDAS.has(b)) { this.muda(cx, cz, i, b, tique, arvores); continue; }
        if (b === CANA) { this.cana(cx, cz, i, tique, crescer); continue; }
        if (!PROXIMO[b]) continue;
        const x = cx * CX + (i % CX), z = cz * CZ + (Math.floor(i / CX) % CZ), y = Math.floor(i / (CX * CZ));
        if (m.bloco(x, y, z) !== b) continue; // ainda não carregou ou já mudou
        if (m.bloco(x, y - 1, z) !== B.TERRA_ARADA) continue; // só cresce na terra de plantar
        const chance = molhada(m, x, y - 1, z) ? CHANCE_MOLHADA : CHANCE;
        if (sorteio(x, y, z, tique) < chance) crescer.push([x, y, z, PROXIMO[b]]);
      }
    }
    for (const [x, y, z, b] of crescer) m.definir(x, y, z, b);
    // árvore nova: o tronco no lugar da muda primeiro (é o que a sala confere), depois o resto
    for (const blocos of arvores) for (const [x, y, z, b] of blocos) m.definir(x, y, z, b);
    return crescer.length + arvores.length;
  }

  // cana plantada (cana-regras.js): o pedaço de cima, com ar em cima e coluna menor que 3, ganha mais um
  // no tique sorteado, depois de CANA_MIN desde que esse pedaço apareceu (a sala confere igual)
  cana(cx, cz, i, tique, crescer) {
    const m = this.mundo, x = cx * CX + (i % CX), z = cz * CZ + (Math.floor(i / CX) % CZ), y = Math.floor(i / (CX * CZ));
    const bl = (a, b, c) => m.bloco(a, b, c);
    if (bl(x, y, z) !== CANA || bl(x, y + 1, z) !== 0) return;
    const alt = alturaCana(bl, x, y, z);
    if (alt >= ALTURA_CANA || !cabeCana(bl, x, y - alt + 1, z)) return;
    const k = x + ',' + y + ',' + z, agora = tique * TIQUE_MS;
    if (!this.canaVista.has(k) || this.canaVista.get(k) > agora) { this.canaVista.set(k, agora); if (this.canaVista.size > 2000) this.canaVista.clear(); }
    if (agora - this.canaVista.get(k) < CANA_MIN || !cresceCana(x, y + 1, z, tique)) return;
    this.canaVista.delete(k);
    crescer.push([x, y + 1, z, CANA]);
  }

  // muda plantada na grama/terra: depois de 1 min, a cada tique pode virar árvore (se tiver espaço em cima)
  muda(cx, cz, i, b, tique, arvores) {
    const m = this.mundo, x = cx * CX + (i % CX), z = cz * CZ + (Math.floor(i / CX) % CZ), y = Math.floor(i / (CX * CZ));
    if (m.bloco(x, y, z) !== b || !CHAO_DA_MUDA.has(m.bloco(x, y - 1, z))) return;
    const k = x + ',' + y + ',' + z, agora = tique * TIQUE_MS;
    if (!this.mudaVista.has(k) || this.mudaVista.get(k) > agora) { this.mudaVista.set(k, agora); if (this.mudaVista.size > 2000) this.mudaVista.clear(); }
    if (agora - this.mudaVista.get(k) < MUDA_MIN || !cresceMuda(x, y, z, tique)) return;
    const forma = formaArvore(b, x, y, z);
    for (const [dx, dy, dz] of forma) {
      if (!dx && !dy && !dz) continue;
      const q = m.bloco(x + dx, y + dy, z + dz);
      if (q && !PLANTA[q] && !FOLHAGEM[q]) return; // sem espaço: espera (o clássico também)
    }
    this.mudaVista.delete(k);
    arvores.push(forma.map(([dx, dy, dz, bb]) => [x + dx, y + dy, z + dz, bb]));
  }
}

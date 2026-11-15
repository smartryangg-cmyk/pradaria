// Muda que vira árvore (regras sem tela: plantacoes.js faz crescer, a sala confere com estas mesmas contas).
// Como nos jogos de blocos clássicos: quebrar folhas às vezes solta uma muda; plantada na grama ou na terra,
// ela cresce sozinha depois de alguns minutos, se tiver espaço em cima. Sem isso a madeira do mundo acaba.
// Não importe nada daqui que dependa do navegador.
import { sorteio, TIQUE_MS } from './plantacoes-regras.js';

export const MUDA = 78, MUDA_PINHEIRO = 79;
export const MUDAS = new Set([MUDA, MUDA_PINHEIRO]);
export const CHANCE_MUDA = 0.03;   // por tique de 5 s (~3 min em média)
export const MUDA_MIN = 60000;     // no mínimo 1 min plantada antes de virar árvore
// troncos redondos (formas-defs.js) e folhas que a árvore nova usa
const TR_CARVALHO = 80, TR_PINHEIRO = 81, TR_BETULA = 82, FOLHAS = 7, FOLHAS_PINHEIRO = 72;
export const BLOCOS_ARVORE = new Set([TR_CARVALHO, TR_PINHEIRO, TR_BETULA, FOLHAS, FOLHAS_PINHEIRO]);
export const TRONCO_DA_MUDA = { [MUDA]: [TR_CARVALHO, TR_BETULA], [MUDA_PINHEIRO]: [TR_PINHEIRO] };
// onde a muda pode ficar: grama, terra, terra de plantar (e a grama com neve das eras)
export const CHAO_DA_MUDA = new Set([1, 2, 31, 137]);
// a árvore inteira cabe nesta caixa em volta da muda (a sala só aceita folha/tronco dentro dela)
export const CAIXA = { lado: 2, alto: 11 };

// sorteio separado do trigo (mesma conta, outra "altura")
const s = (x, y, z, t) => sorteio(x, y + 4096, z, t);

// a muda cresce neste tique?
export const cresceMuda = (x, y, z, tique) => s(x, y, z, tique) < CHANCE_MUDA;
// a sala confere com folga de 1 tique (relógio de cada aparelho)
export function podeCrescerMuda(x, y, z, agora = Date.now()) {
  const t = Math.floor(agora / TIQUE_MS);
  for (let d = -1; d <= 1; d++) if (cresceMuda(x, y, z, t + d)) return true;
  return false;
}

// os blocos da árvore [dx, dy, dz, bloco], com a muda em (0, 0, 0); o formato depende só da posição
export function formaArvore(muda, x, y, z) {
  const r = sorteio(x, y + 8192, z, 7), out = [];
  if (muda === MUDA_PINHEIRO) {
    const alt = 6 + Math.floor(r * 4);
    for (let i = 0; i < alt; i++) out.push([0, i, 0, TR_PINHEIRO]);
    out.push([0, alt, 0, FOLHAS_PINHEIRO], [0, alt + 1, 0, FOLHAS_PINHEIRO]);
    for (let dy = 0; dy < alt - 2; dy++) {
      const yy = alt - dy, rad = dy === 0 ? 1 : dy % 2 ? Math.min(2, 1 + (dy >> 1)) : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if ((dx === 0 && dz === 0) || Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 1 : 0)) continue;
        out.push([dx, yy, dz, FOLHAS_PINHEIRO]);
      }
    }
    return out;
  }
  // carvalho (ou bétula, mais alta e fina, em 3 de cada 10 lugares)
  const betula = sorteio(x, y + 8192, z, 11) < 0.3;
  const tr = betula ? TR_BETULA : TR_CARVALHO, alt = betula ? 5 + Math.floor(r * 2) : 4 + Math.floor(r * 3);
  for (let i = 0; i < alt; i++) out.push([0, i, 0, tr]);
  for (let dy = -2; dy <= 1; dy++) {
    const rad = dy < 0 ? 2 : 1;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
      if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
      if (dy < 0 && dx === 0 && dz === 0) continue; // ali é o tronco
      out.push([dx, alt + dy, dz, FOLHAS]);
    }
  }
  return out;
}

export const naCaixa = (dx, dy, dz) => Math.abs(dx) <= CAIXA.lado && Math.abs(dz) <= CAIXA.lado && dy >= 0 && dy <= CAIXA.alto;

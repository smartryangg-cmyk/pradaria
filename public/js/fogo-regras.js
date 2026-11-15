// Fogo (como nos jogos de blocos clássicos), regras puras (aparelho e sala usam):
//  * o isqueiro acende fogo no lado do bloco tocado; a lava acende o que pega fogo encostado nela;
//  * o fogo queima madeira, folhas, lã, feno e plantas encostadas (o bloco vira fogo e depois some);
//  * sem nada para queimar ele apaga sozinho em poucos segundos; água apaga; sem chão nem combustível, apaga;
//  * ficar dentro do fogo machuca.
// O sorteio é por posição e idade (igual em todos os aparelhos).
export const FOGO = 222;
export const ISQUEIRO = 1010;
export const TICK_FOGO = 500; // ms entre cada passo
export const DANO_FOGO = 1; // corações por segundo dentro do fogo
export const ALCANCE_FOGO = 16; // fogo de verdade só passa a marca até esta distância do isqueiro que acendeu
export const MAX_FOGOS = 400; // teto de fogos acesos (tablet fraco)
// chance de pegar fogo por passo, para cada vizinho em chamas
export const QUEIMA = new Float32Array(256);
for (const b of [6, 71, 73]) QUEIMA[b] = 0.1; // troncos
for (const b of [7, 72, 74]) QUEIMA[b] = 0.3; // folhas
QUEIMA[8] = 0.2; // tábuas
for (let b = 14; b <= 19; b++) QUEIMA[b] = 0.25; // lã
for (const b of [11, 12, 13, 22, 32, 75, 76, 77, 78, 79]) QUEIMA[b] = 0.5; // flores, capim, trigo, mudas
QUEIMA[33] = 0.3; // feno
QUEIMA[34] = 0.1; // bancada
for (let b = 211; b <= 214; b++) QUEIMA[b] = 0.15; // escada de mão
export const inflamavel = (b) => QUEIMA[b] > 0;
// sorteio 0..1 por posição e idade
export function sorteioFogo(x, y, z, a) {
  let h = (x * 374761393 + y * 668265263 + z * 1442695041 + a * 974634131) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// quantos passos o fogo dura: pouco sem combustível, mais com
export const vidaFogo = (x, y, z, temComb) => (temComb ? 24 : 4) + Math.floor(sorteioFogo(x, z, y, 7) * 4);

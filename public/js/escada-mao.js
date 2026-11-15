// Escada de mão (como nos jogos de blocos clássicos): presa numa parede, dá para subir e descer.
// 211..214 = parede do lado +x, +z, -x, -z. Não é sólida (o jogador entra nela).
// Este arquivo não importa nada (o servidor e as receitas usam os números).
export const ESCADA_MAO = 211;
export const ehEscadaMao = (b) => b >= ESCADA_MAO && b < ESCADA_MAO + 4;
// direção da parede de cada giro
export const PAREDE = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const SOBE = 2.4, DESCE = 2.4; // blocos por segundo (subindo / escorregando devagar)

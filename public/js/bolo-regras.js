// Bolo (como no clássico): o bolo feito na bancada é colocado no chão e comido em 7 fatias, uma por toque.
// Cada fatia enche 1 coxinha (2 de fome) e um pouco de saturação; só come com fome. Quebrar o bolo não dá nada.
// Blocos: 225 = inteiro (7 fatias), 226 = 6 fatias ... 231 = 1 fatia; comer a última some com o bolo.
// Regras puras: o jogo e a sala (blocos-rede.js) usam as mesmas.
export const BOLO_ITEM = 1012;      // o bolo na mochila (cana-regras.js: 3 trigos + 2 açúcares)
export const BOLO_B = 225, BOLO_FIM = 231, FATIAS = 7;
export const FATIA = { f: 2, s: 0.4 };
export const ehBolo = (b) => b >= BOLO_B && b <= BOLO_FIM;
export const fatiasDe = (b) => (ehBolo(b) ? FATIAS - (b - BOLO_B) : 0);
// o que fica depois de comer uma fatia (0 = acabou)
export const depoisDaFatia = (b) => (!ehBolo(b) ? b : b === BOLO_FIM ? 0 : b + 1);

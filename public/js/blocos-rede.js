// Que mudanças de bloco um aparelho pode mandar SEM ser o jogador com as mãos (sem "j" na mensagem).
// Usado pela sala (servidor): sem isto, um cliente modificado mandava {t:'bloco', b:0} sem "j" e apagava
// construções dos outros, colocava blocos sem ter na mochila e construía em mundo sem Construção.
// Só importa regras puras (o servidor usa este arquivo). teste-economia-regras.mjs confere estas listas com blocos.js.
import { FOGO, inflamavel } from './fogo-regras.js';

// o jogador mexe e fica salvo, sem colocar nem quebrar nada: porta, forno, alavanca, botão, placa
export const PARES_TOQUE = [[47, 48], [55, 56], [102, 103], [104, 105], [106, 107]];
const PAR = new Map();
PARES_TOQUE.forEach(([a, b], i) => { PAR.set(a, i); PAR.set(b, i); });
// física (fisica.js): areia, pedrisco e cascalho caem; folhas sem árvore caem
export const CAI = new Set([4, 20, 65]);
export const FOLHA = new Set([7, 72, 74, 132]);
// some quando tiram o bloco de baixo (blocos.js PRECISA_CHAO: plantas, fios, alavanca, botão, placa)
export const PRECISA_CHAO = new Set([11, 12, 13, 22, 32, 75, 76, 77, 78, 79, 100, 101, 102, 103, 104, 105, 106, 107, 129, 130, 135, 221, 222]); // 221 tocha, 222 fogo
const vazio = (b) => !b || b === 5 || (b >= 23 && b <= 30); // ar ou água

// atual = o que está no lugar (o servidor sabe se alguém já mexeu; se não, é o que o aparelho diz)
export function mudancaSemMao(atual, b, construcao = true) {
  atual |= 0; b |= 0;
  if (atual !== b && PAR.has(atual) && PAR.get(atual) === PAR.get(b)) return true; // abrir porta, acender forno, ligar alavanca
  if (!construcao) return false; // mundo sem Construção: só os toques acima
  if (atual === b) return true;
  if (b === 0) return CAI.has(atual) || FOLHA.has(atual) || PRECISA_CHAO.has(atual);
  if (CAI.has(b)) return vazio(atual); // areia caindo
  // lava (lava-regras.js): com água a lava vira obsidiana ou pedrisco; lava caindo na água vira pedra
  if (atual >= 215 && atual <= 219 && (b === 220 || b === 20)) return true;
  if ((atual === 5 || (atual >= 23 && atual <= 30)) && b === 3) return true;
  // fogo (fogo-regras.js): acende no vazio e no que pega fogo (que queima e some)
  if (b === FOGO) return !atual || inflamavel(atual);
  return (atual === 1 && b === 2) || (atual === 2 && b === 1); // grama coberta vira terra e volta
}

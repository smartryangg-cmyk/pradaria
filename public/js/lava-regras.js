// Lava (como nos jogos de blocos clássicos): fonte que escorre devagar (até 3 blocos para o lado), cai,
// queima quem entra, ilumina, e com água vira obsidiana (fonte) ou pedrisco (lava corrente).
// Blocos 215..220. Não importe nada daqui (a sala e o gerador usam os números).
export const LAVA = 215;                    // fonte (balde de lava = este bloco na mochila)
export const LAVA_CORRENTE = [0, 216, 217, 218]; // nível 1..3 (3 = a ponta, mais rasa)
export const LAVA_CAINDO = 219;             // lava que desce
export const OBSIDIANA = 220;
export const LAVAS = new Set([215, 216, 217, 218, 219]);
export const ehLava = (b) => b >= 215 && b <= 219;
export const NIVEL_LAVA = { 215: 0, 216: 1, 217: 2, 218: 3, 219: 0 };
export const TICK_LAVA = 900;               // ms entre os passos da lava (a água anda 4,5 vezes mais rápido)
export const DANO_LAVA = 2;                 // corações por segundo dentro da lava

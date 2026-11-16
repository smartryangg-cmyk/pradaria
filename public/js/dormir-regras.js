// Cama: dormir pula a noite (regras sem tela; a sala confere com estas mesmas contas).
// Como nos jogos de blocos clássicos: só dá para deitar do pôr do sol até antes de amanhecer;
// online, a noite só passa quando todo mundo que está no mundo deita numa cama.
// Não importe nada daqui que dependa do navegador.
// um dia inteiro (dia + noite) dura 20 minutos, como no clássico (o jogo e a sala usam o mesmo número)
export const DURACAO_DIA = 1200; // segundos
export const CAMA = 176;                       // 176..179 (4 giros, moveis.js)
export const ehCama = (b) => b >= CAMA && b < CAMA + 4;
export const DORMIR_DE = 0.48, DORMIR_ATE = 0.98; // pôr do sol .. quase amanhecendo (0.25 = meio-dia, 0.75 = meia-noite)
export const ACORDA = 0.02;                    // acorda no comecinho da manhã
export const podeDormir = (dia) => dia >= DORMIR_DE && dia < DORMIR_ATE;
export const PERTO_DA_CAMA = 3;                // a sala só aceita quem está em cima/ao lado da cama

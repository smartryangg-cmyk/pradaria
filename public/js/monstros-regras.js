// Monstros da noite (jogo clássico), regras puras: quando e onde nascem, quantos e o que deixam.
// Só no jogo clássico (sobrevivência fora do Pacífico). Nascem no escuro: de noite na superfície ou em
// qualquer hora dentro das cavernas, longe de luz (tocha, lampião, fogo) e longe do jogador. O barrento
// queima no sol da manhã; a aranha fica quieta de dia. A luz espanta: perto de tocha não nasce nenhum.
export const MONSTROS = ['barrento', 'aranha'];
export const ehMonstro = (esp) => MONSTROS.includes(esp);
export const MAX_MONSTROS = 6;          // ao mesmo tempo perto do jogador
export const LONGE_MIN = 16, LONGE_MAX = 32; // nascem a esta distância do jogador (nunca na cara)
export const SEM_LUZ = 7;               // raio sem luz em volta de onde nasce
export const NOITE = -0.1;              // sol abaixo disto: noite (monstros na superfície)
export const FUNDO = 6;                 // abaixo do chão: escuro de caverna

// sol: seno da hora (1 meio-dia, -1 meia-noite); y: onde nasceria; chao: altura do chão ali
export const escuroPara = (sol, y, chao) => sol < NOITE || y < chao - FUNDO;
// a aranha só caça no escuro (de dia só se apanhar)
export const aranhaBrava = (sol, y, chao) => escuroPara(sol, y, chao);
// sorteio da espécie (r de 0 a 1)
export const qualMonstro = (r) => (r < 0.6 ? 'barrento' : 'aranha');
// o que cada um deixa (economia.js CAI_BICHO usa esta lista)
export const CAI_MONSTRO = { barrento: [[1112, 1]], aranha: [[1111, 2]] }; // carne estragada; fio de teia

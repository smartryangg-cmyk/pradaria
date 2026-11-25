// Quebrar como no clássico (jogo base): segura o botão (ou o dedo) e o bloco racha aos poucos até quebrar.
// O tempo depende da dureza do material e do que está na mão:
//   ferramenta certa: velocidade 2 (madeira), 4 (pedra), 6 (ferro), 8 (diamante); mão ou ferramenta errada: 1
//   tempo = dureza x 1,5 / velocidade, se o bloco cai com o que está na mão
//   tempo = dureza x 5 / velocidade, se precisa de picareta melhor (quebra devagar e não dá nada)
// Soltou ou mirou em outro bloco: começa do zero (como no clássico). Dureza 0 quebra na hora (flores, tocha...).
// Os números de dureza são os nossos, no jeito do clássico. Regras puras: o teste roda no node.
import { FERRAMENTAS, tipoDoBloco, PRECISA_PICARETA, nivelPicareta } from './receitas.js';

export const ESTAGIOS = 10; // rachaduras: 10 desenhos, do risquinho ao bloco todo trincado
const VEL = [1, 2, 4, 6, 8]; // por nível de ferramenta (0 = mão)

// dureza de cada bloco (quem não está aqui: 1; planta e coisa fina: 0)
const DUREZA = {};
const d = (v, ids) => { for (const b of ids) DUREZA[b] = v; };
d(0.6, [1, 31, 65, 145]); // grama, terra arada, cascalho, barro
d(0.5, [2, 4, 33, 138, 225, 226, 227, 228, 229, 230, 231]); // terra, areia, feno, gelo, bolo
d(0.2, [7, 72, 74, 132, 139, 140, 176, 177, 178, 179]); // folhas, bloco de neve, cama
d(0.1, [137]); // camada de neve
d(0.3, [9, 21, 85, 89, 156]); // vidro, lampião
d(1, [242, 247]); // abóbora, melancia
d(4, [245]); // teia: com a mão 20 s; com espada 0,4 s
d(0.8, [14, 15, 16, 17, 18, 19, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 146, 147]); // lã (16 cores), arenito
d(1.5, [3, 186, 246]); // pedra, estante, tijolo de pedra
d(2, [90]); // laje de pedra
d(2, [6, 8, 10, 20, 71, 73, 131, 80, 81, 82, 84, 95, 96, 97, 98, 157, 153]); // madeira, tijolo, pedrisco
d(2.5, [34, 223]); // bancada, baú
d(3, [47, 48, 66, 67, 68, 69, 191]); // porta, minérios, bloco de ouro
d(3.5, [188, 189]); // fornalha
d(5, [190, 192]); // blocos de ferro e de diamante
d(50, [220]); // obsidiana
d(0.4, [63, 211, 212, 213, 214]); // cacto, escada de mão
d(Infinity, [70]); // rocha-mãe
d(0, [11, 12, 13, 22, 32, 75, 76, 77, 78, 79, 129, 130, 221, 222, 224, 243, 244]); // flores, capim, trigo, mudas, tocha, fogo, cana, cogumelos

export const durezaDe = (b, def = null) => (b in DUREZA ? DUREZA[b] : def && (def.planta || (def.forma && def.forma !== 'esteira' && def.forma !== 'bolo')) && !def.solido ? 0 : 1);
// velocidade do que está na mão para este bloco
const ESPADAS = new Set([1113, 1114, 1115, 1116]);
export function velocidade(b, mao) {
  if (b === 245) return ESPADAS.has(mao) ? 15 : 1; // espada corta teia
  const f = FERRAMENTAS[mao];
  return f && f[0] === tipoDoBloco(b) ? VEL[f[2]] : 1;
}
// o bloco cai com o que está na mão? (pedra e minério precisam da picareta certa)
export const cai = (b, mao) => b === 245 ? ESPADAS.has(mao) : nivelPicareta(mao) >= (PRECISA_PICARETA[b] || 0);
// segundos segurando para quebrar (0 = na hora; Infinity = não quebra)
export function tempoQuebrar(b, mao, def = null) {
  const h = durezaDe(b, def);
  if (h <= 0) return 0;
  if (!Number.isFinite(h)) return Infinity;
  return Math.round(h * (cai(b, mao) ? 1.5 : 5) / velocidade(b, mao) * 100) / 100;
}
// estágio da rachadura (0..9) para o progresso p (0..1)
export const estagio = (p) => Math.max(0, Math.min(ESTAGIOS - 1, Math.floor(p * ESTAGIOS)));

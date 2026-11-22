// Coletar e criar: o que cada bloco dá ao quebrar, o que se gasta ao colocar, as receitas
// (grade de criar 2x2/3x3 com desenho, como no clássico, e o livro de receitas que arruma a grade) e as ferramentas.
// Regras puras, sem tela: o jogo sem internet e a sala online (economia.js) usam as mesmas.
// Não importe nada daqui que dependa do navegador.
//
// Os itens guardados ficam na mochila do jogador (economia.js: estado.itens = { id: quantidade }).
// Para outras partes do jogo:
//   - receitas novas: adicionarReceitas([{ id, faz: [id, qtd], usa: [[id, qtd], ...], bancada, grupo }])
//   - liberar receitas aos poucos (ex.: eras da Linha do Tempo): ponha `era: 'x'` na receita e troque
//     `regras.liberada = (receita, opcoes) => true` por uma função sua
import { DURA_ARMADURA, parteDe } from './armadura-regras.js';

// ids (iguais aos de blocos.js)
export const IDS = {
  GRAMA: 1, TERRA: 2, PEDRA: 3, AREIA: 4, AGUA: 5, TRONCO: 6, FOLHAS: 7, TABUAS: 8, VIDRO: 9, TIJOLO: 10,
  FLOR_VERMELHA: 11, FLOR_AMARELA: 12, CAPIM: 13, LA_BRANCA: 14, LA_VERMELHA: 15, LA_AZUL: 16, LA_AMARELA: 17,
  LA_VERDE: 18, LA_ROSA: 19, PEDRISCO: 20, LAMPIAO: 21, FLOR_AZUL: 22, TERRA_ARADA: 31, TRIGO: 32, FENO: 33, BANCADA: 34,
  // engenharia
  FIO: 100, ALAVANCA: 102, BOTAO: 104, PLACA: 106, LAMPADA: 108, PORTAO: 110, VENTILADOR: 112, SINO: 114,
  CONFETE: 116, SENSOR: 118, PISCA: 120, TRAMPOLIM: 122, ESTEIRA: 123,
  // mecanismos das construções (blocos-mecanismos.js)
  PORTA: 47, CATAVENTO: 49, MO: 51, CABO: 53, FORNO: 55, FARINHA: 57, PAO: 58, SARILHO: 59,
  // itens (não são blocos)
  GRAVETO: 1000, PICARETA_MADEIRA: 1001, PICARETA_PEDRA: 1002, MACHADO_MADEIRA: 1003, MACHADO_PEDRA: 1004, PA_MADEIRA: 1005, PA_PEDRA: 1006, CARNE: 1007, COURO: 1008, BALDE: 1009,
  // jogo clássico: minérios, fornalha e ferramentas de ferro e diamante (blocos 188..210, itens 1100..1299)
  CARVAO_MINERIO: 66, FERRO_MINERIO: 67, OURO_MINERIO: 68, DIAMANTE_MINERIO: 69,
  FORNALHA: 188, BLOCO_FERRO: 190, BLOCO_OURO: 191, BLOCO_DIAMANTE: 192,
  CARVAO: 1100, BARRA_FERRO: 1101, BARRA_OURO: 1102, DIAMANTE: 1103, CARNE_ASSADA: 1104,
  PICARETA_FERRO: 1105, MACHADO_FERRO: 1106, PA_FERRO: 1107, PICARETA_DIAMANTE: 1108, MACHADO_DIAMANTE: 1109, PA_DIAMANTE: 1110,
  // monstros da noite (monstros-regras.js): o que eles deixam e as espadas
  TEIA: 1111, CARNE_ESTRAGADA: 1112, ESPADA_MADEIRA: 1113, ESPADA_PEDRA: 1114, ESPADA_FERRO: 1115, ESPADA_DIAMANTE: 1116,
  // armadura (armadura-regras.js): capacete, peitoral, calça e botas de couro, ferro e diamante
  CAPACETE_COURO: 1117, PEITORAL_COURO: 1118, CALCA_COURO: 1119, BOTAS_COURO: 1120,
  CAPACETE_FERRO: 1121, PEITORAL_FERRO: 1122, CALCA_FERRO: 1123, BOTAS_FERRO: 1124,
  CAPACETE_DIAMANTE: 1125, PEITORAL_DIAMANTE: 1126, CALCA_DIAMANTE: 1127, BOTAS_DIAMANTE: 1128,
};
const I = IDS;
export const ULTIMO_ITEM = 1012; // 1010 isqueiro (fogo-regras.js); 1011 açúcar, 1012 bolo (cana-regras.js)
export const PRIMEIRO_CLASSICO = 1100, ULTIMO_CLASSICO = 1128; // itens do jogo clássico (minérios, fornalha, monstros, espadas, armadura)
export const MAIOR_ITEM = ULTIMO_CLASSICO;
export const MAX_BLOCO = 255;

// pode ficar guardado na mochila: blocos (menos as águas correntes) e os itens conhecidos
export const guardavel = (id) => Number.isInteger(id) && ((id > 0 && id <= MAX_BLOCO && !(id >= 23 && id <= 30)) || (id >= 1000 && id <= ULTIMO_ITEM) || (id >= PRIMEIRO_CLASSICO && id <= ULTIMO_CLASSICO));

// ---------- o que cai ao quebrar ----------
// as peças ligadas (101, 103...) voltam a ser a peça desligada; esteiras viradas viram esteira
export function baseDe(b) {
  if (b >= 100 && b <= 121) return b - ((b - 100) % 2);
  if (b >= 123 && b <= 126) return I.ESTEIRA;
  if (b >= 47 && b <= 56) return b - ((b - 47) % 2); // porta aberta, catavento girando, forno aceso...
  // formas viradas (formas-defs.js): rampa 91..94 e escada 95..98
  if (b >= 91 && b <= 94) return 91;
  if (b >= 95 && b <= 98) return 95;
  if (b >= 176 && b <= 183) return b - ((b - 176) % 4); // cama e cadeira viradas (moveis.js)
  if (b >= 211 && b <= 214) return 211; // escada de mão virada (escada-mao.js)
  if (b === 76 || b === 77) return I.TRIGO; // trigo plantado ainda crescendo: é o mesmo trigo
  if (b === 189) return I.FORNALHA; // fornalha acesa
  if (b >= 225 && b <= 231) return 1012; // bolo colocado (bolo-regras.js): colocar gasta o bolo da mochila
  return b;
}
// o tronco redondo das árvores dá o tronco comum (dá para refazer o redondo no livro, 1 por 1)
// carvão e diamante saem prontos do minério (ferro e ouro saem como minério: vão para a fornalha)
const VIRA = { [I.GRAMA]: I.TERRA, [I.TERRA_ARADA]: I.TERRA, 80: I.TRONCO, 81: 71, 82: 73, [I.CARVAO_MINERIO]: I.CARVAO, [I.DIAMANTE_MINERIO]: I.DIAMANTE };

// jogo clássico: pedra e minério só caem com a picareta certa (1 madeira, 2 pedra, 3 ferro, 4 diamante);
// com a mão ou picareta fraca o bloco quebra (devagar) e não dá nada, como no clássico
export const PRECISA_PICARETA = {
  [I.PEDRA]: 1, [I.PEDRISCO]: 1, [I.TIJOLO]: 1, [I.CARVAO_MINERIO]: 1, [I.FERRO_MINERIO]: 2, [I.OURO_MINERIO]: 3,
  [I.DIAMANTE_MINERIO]: 3, [I.FORNALHA]: 1, 189: 1, [I.BLOCO_FERRO]: 2, [I.BLOCO_OURO]: 3, [I.BLOCO_DIAMANTE]: 3,
  83: 1, 86: 1, 87: 1, 88: 1, 90: 1, 91: 1, 92: 1, 93: 1, 94: 1, // formas de pedra e tijolo
};
export const NOME_NIVEL = ['', 'de madeira', 'de pedra', 'de ferro', 'de diamante'];
export const nivelPicareta = (mao) => (FERRAMENTAS[mao] && FERRAMENTAS[mao][0] === 'picareta' ? FERRAMENTAS[mao][2] : 0);
// quanto falta: 0 = pode; senão o nível de picareta que precisa
export const nivelFalta = (b, mao) => { const p = PRECISA_PICARETA[b] || 0; return p && nivelPicareta(mao) < p ? p : 0; };
// extras: [chance em %, item]; sorteio fixo pela posição (o jogo e o servidor tiram o mesmo resultado)
// trigo maduro: colher dá mais do que plantou (é assim que a plantação rende)
// folhas: às vezes solta uma muda (planta e ela vira árvore: a madeira do mundo não acaba)
const EXTRA = {
  [I.FOLHAS]: [[35, I.GRAVETO], [10, 78]], [72]: [[10, 79]], [74]: [[10, 78]],
  [I.CAPIM]: [[30, I.TRIGO]], [I.TRIGO]: [[75, I.TRIGO]],
};
const sorteio = (x, y, z) => (((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) >>> 0) % 100);

// natural = bloco do mundo original (o extra só vale nele; senão era só pôr e tirar folha no lugar da sorte); mao = ferramenta
export function oQueCai(b, x = 0, y = 0, z = 0, natural = true, mao = 0, classico = false) {
  if (!Number.isInteger(b) || b <= 0 || (b >= 23 && b <= 30) || b > MAX_BLOCO) return [];
  if (classico && nivelFalta(b, mao)) return [];
  // vidro estilhaça: só sai inteiro com picareta na mão (com a mão vazia vira cacos)
  if (b === I.VIDRO && !(FERRAMENTAS[mao] && FERRAMENTAS[mao][0] === 'picareta')) return [];
  if (b >= 215 && b <= 219) return []; // lava não se quebra: só sai com balde (lava-regras.js)
  if (b === 222) return []; // fogo (fogo-regras.js)
  if (b >= 225 && b <= 231) return []; // bolo colocado: quebrar não dá nada (como no clássico)
  if (b === 220 && !(FERRAMENTAS[mao] && FERRAMENTAS[mao][0] === 'picareta')) return []; // obsidiana: só com picareta
  const r = [[VIRA[b] ?? baseDe(b), 1]];
  // o extra só vem de bloco do mundo (colocar e quebrar não multiplica nada), menos o trigo maduro e as folhas:
  // eles também nascem crescendo (trigo plantado, muda que virou árvore; a sala confere), e render é o motivo de plantar
  const cresce = b === I.TRIGO || b === I.FOLHAS || b === 72 || b === 74;
  if (natural || cresce) (EXTRA[b] || []).forEach(([chance, item], i) => { if (sorteio(x + i * 31, y, z - i * 17) < chance) r.push([item, 1]); });
  return r;
}

// colocar só gasta quando o lugar estava vazio (ar, água ou plantinha); ligar uma alavanca não gasta
const PLANTAS = new Set([11, 12, 13, 22, 32, 75, 76, 77, 129, 130, 135]); // 75 = arbusto seco; 76, 77 = trigo crescendo
export const lugarVazio = (de) => !de || de === 5 || (de >= 23 && de <= 30) || (de >= 216 && de <= 219) || PLANTAS.has(de); // 216..219 lava corrente
export const gastoDe = (b) => baseDe(b);

// ---------- ferramentas ----------
// [tipo, força (divide os toques), nível (1 madeira, 2 pedra, 3 ferro, 4 diamante)]
export const FERRAMENTAS = {
  [I.PICARETA_MADEIRA]: ['picareta', 2, 1], [I.PICARETA_PEDRA]: ['picareta', 3, 2],
  [I.MACHADO_MADEIRA]: ['machado', 2, 1], [I.MACHADO_PEDRA]: ['machado', 3, 2],
  [I.PA_MADEIRA]: ['pa', 2, 1], [I.PA_PEDRA]: ['pa', 3, 2],
  [I.PICARETA_FERRO]: ['picareta', 4, 3], [I.MACHADO_FERRO]: ['machado', 4, 3], [I.PA_FERRO]: ['pa', 4, 3],
  [I.PICARETA_DIAMANTE]: ['picareta', 6, 4], [I.MACHADO_DIAMANTE]: ['machado', 6, 4], [I.PA_DIAMANTE]: ['pa', 6, 4],
};
const TIPO_DO_BLOCO = {};
export const tipoDoBloco = (b) => TIPO_DO_BLOCO[b];
for (const b of [I.PEDRA, I.PEDRISCO, I.TIJOLO, I.LAMPIAO, I.VIDRO, 108, 109, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122]) TIPO_DO_BLOCO[b] = 'picareta';
for (const b of [I.TRONCO, I.TABUAS, I.FOLHAS, I.FENO, I.BANCADA, 110, 111, 47, 48, 49, 50, 53, 54]) TIPO_DO_BLOCO[b] = 'machado';
for (let b = 176; b <= 187; b++) TIPO_DO_BLOCO[b] = 'machado'; // móveis
TIPO_DO_BLOCO[223] = 'machado'; // baú
for (const b of [51, 52, 55, 56]) TIPO_DO_BLOCO[b] = 'picareta';
for (const b of [I.TERRA, I.GRAMA, I.AREIA, I.TERRA_ARADA]) TIPO_DO_BLOCO[b] = 'pa';
// formas (80..99): madeira com machado, pedra/vidro com picareta
for (const b of [80, 81, 82, 84, 95, 96, 97, 98, 99]) TIPO_DO_BLOCO[b] = 'machado';
for (const b of [83, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94]) TIPO_DO_BLOCO[b] = 'picareta';
// troncos das outras árvores, folhas, minérios e cascalho do mundo clássico
for (const b of [71, 72, 73, 74, 131, 132]) TIPO_DO_BLOCO[b] = 'machado';
for (const b of [66, 67, 68, 69, 220, 188, 189, 190, 191, 192]) TIPO_DO_BLOCO[b] = 'picareta'; // 220 obsidiana, 188 fornalha
TIPO_DO_BLOCO[65] = 'pa';

// quantos toques o bloco b precisa com `naMao` na mão (base = toques sem ferramenta)
export function toquesCom(base, b, naMao) {
  const f = FERRAMENTAS[naMao];
  if (!f || f[0] !== TIPO_DO_BLOCO[b]) return base;
  return Math.max(1, Math.ceil(base / f[1]));
}

// ---------- receitas ----------
// bancada: true = só cria perto de uma Bancada. grupo: em que parte do livro aparece.
export const GRUPOS = [
  { id: 'basico', nome: 'Primeiros passos', icone: 'arvore' },
  { id: 'ferramentas', nome: 'Ferramentas', icone: 'martelo' },
  { id: 'construir', nome: 'Construção', icone: 'tijolos' },
  { id: 'cores', nome: 'Cores e enfeites', icone: 'flor' },
  { id: 'formas', nome: 'Formas redondas', icone: 'bloco', opcao: 'formas' },
  { id: 'maquinas', nome: 'Engenharia', icone: 'engrenagem', opcao: 'maquinas' },
  { id: 'armadura', nome: 'Armadura', icone: 'escudo' },
];
export const RECEITAS = [
  // na mão
  { id: 'tabuas', faz: [I.TABUAS, 4], usa: [[I.TRONCO, 1]], grupo: 'basico' },
  // troncos das outras árvores também viram tábuas (no mundo clássico quase tudo é pinheiro ou bétula)
  { id: 'tabuas-pinheiro', faz: [I.TABUAS, 4], usa: [[71, 1]], grupo: 'basico' },
  { id: 'tabuas-betula', faz: [I.TABUAS, 4], usa: [[73, 1]], grupo: 'basico' },
  { id: 'tabuas-palmeira', faz: [I.TABUAS, 4], usa: [[131, 1]], grupo: 'basico' },
  { id: 'graveto', faz: [I.GRAVETO, 4], usa: [[I.TABUAS, 2]], grupo: 'basico', forma: ['T', 'T'] },
  { id: 'bancada', faz: [I.BANCADA, 1], usa: [[I.TABUAS, 4]], grupo: 'basico', forma: ['TT', 'TT'] },
  // ferramentas (bancada)
  { id: 'picareta-madeira', faz: [I.PICARETA_MADEIRA, 1], usa: [[I.TABUAS, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['TTT', '.G.', '.G.'] },
  { id: 'machado-madeira', faz: [I.MACHADO_MADEIRA, 1], usa: [[I.TABUAS, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['TT', 'TG', '.G'] },
  { id: 'pa-madeira', faz: [I.PA_MADEIRA, 1], usa: [[I.TABUAS, 1], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['T', 'G', 'G'] },
  { id: 'picareta-pedra', faz: [I.PICARETA_PEDRA, 1], usa: [[I.PEDRA, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['PPP', '.G.', '.G.'] },
  { id: 'machado-pedra', faz: [I.MACHADO_PEDRA, 1], usa: [[I.PEDRA, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['PP', 'PG', '.G'] },
  { id: 'pa-pedra', faz: [I.PA_PEDRA, 1], usa: [[I.PEDRA, 1], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['P', 'G', 'G'] },
  { id: 'picareta-ferro', faz: [I.PICARETA_FERRO, 1], usa: [[I.BARRA_FERRO, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['FFF', '.G.', '.G.'] },
  { id: 'machado-ferro', faz: [I.MACHADO_FERRO, 1], usa: [[I.BARRA_FERRO, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['FF', 'FG', '.G'] },
  { id: 'pa-ferro', faz: [I.PA_FERRO, 1], usa: [[I.BARRA_FERRO, 1], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['F', 'G', 'G'] },
  { id: 'picareta-diamante', faz: [I.PICARETA_DIAMANTE, 1], usa: [[I.DIAMANTE, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['DDD', '.G.', '.G.'] },
  { id: 'machado-diamante', faz: [I.MACHADO_DIAMANTE, 1], usa: [[I.DIAMANTE, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['DD', 'DG', '.G'] },
  { id: 'pa-diamante', faz: [I.PA_DIAMANTE, 1], usa: [[I.DIAMANTE, 1], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas', forma: ['D', 'G', 'G'] },
  { id: 'espada-madeira', faz: [I.ESPADA_MADEIRA, 1], usa: [[I.TABUAS, 2], [I.GRAVETO, 1]], bancada: true, grupo: 'ferramentas', forma: ['T', 'T', 'G'] },
  { id: 'espada-pedra', faz: [I.ESPADA_PEDRA, 1], usa: [[I.PEDRA, 2], [I.GRAVETO, 1]], bancada: true, grupo: 'ferramentas', forma: ['P', 'P', 'G'] },
  { id: 'espada-ferro', faz: [I.ESPADA_FERRO, 1], usa: [[I.BARRA_FERRO, 2], [I.GRAVETO, 1]], bancada: true, grupo: 'ferramentas', forma: ['F', 'F', 'G'] },
  { id: 'espada-diamante', faz: [I.ESPADA_DIAMANTE, 1], usa: [[I.DIAMANTE, 2], [I.GRAVETO, 1]], bancada: true, grupo: 'ferramentas', forma: ['D', 'D', 'G'] },
  // armadura (só no jogo clássico, onde ela protege: armadura-regras.js)
  { id: 'capacete-couro', faz: [I.CAPACETE_COURO, 1], usa: [[I.COURO, 5]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['LLL', 'L.L'] },
  { id: 'peitoral-couro', faz: [I.PEITORAL_COURO, 1], usa: [[I.COURO, 8]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['L.L', 'LLL', 'LLL'] },
  { id: 'calca-couro', faz: [I.CALCA_COURO, 1], usa: [[I.COURO, 7]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['LLL', 'L.L', 'L.L'] },
  { id: 'botas-couro', faz: [I.BOTAS_COURO, 1], usa: [[I.COURO, 4]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['L.L', 'L.L'] },
  { id: 'capacete-ferro', faz: [I.CAPACETE_FERRO, 1], usa: [[I.BARRA_FERRO, 5]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['LLL', 'L.L'] },
  { id: 'peitoral-ferro', faz: [I.PEITORAL_FERRO, 1], usa: [[I.BARRA_FERRO, 8]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['L.L', 'LLL', 'LLL'] },
  { id: 'calca-ferro', faz: [I.CALCA_FERRO, 1], usa: [[I.BARRA_FERRO, 7]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['LLL', 'L.L', 'L.L'] },
  { id: 'botas-ferro', faz: [I.BOTAS_FERRO, 1], usa: [[I.BARRA_FERRO, 4]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['L.L', 'L.L'] },
  { id: 'capacete-diamante', faz: [I.CAPACETE_DIAMANTE, 1], usa: [[I.DIAMANTE, 5]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['LLL', 'L.L'] },
  { id: 'peitoral-diamante', faz: [I.PEITORAL_DIAMANTE, 1], usa: [[I.DIAMANTE, 8]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['L.L', 'LLL', 'LLL'] },
  { id: 'calca-diamante', faz: [I.CALCA_DIAMANTE, 1], usa: [[I.DIAMANTE, 7]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['LLL', 'L.L', 'L.L'] },
  { id: 'botas-diamante', faz: [I.BOTAS_DIAMANTE, 1], usa: [[I.DIAMANTE, 4]], bancada: true, grupo: 'armadura', soClassico: true, forma: ['L.L', 'L.L'] },
  { id: 'la-de-fio', faz: [14, 1], usa: [[I.TEIA, 4]], grupo: 'construir', forma: ['II', 'II'] }, // 4 fios de teia de aranha = 1 lã
  { id: 'balde', faz: [I.BALDE, 1], usa: [[I.TABUAS, 3]], bancada: true, grupo: 'ferramentas', forma: ['T.T', '.T.'] },
  // construção
  { id: 'pedrisco', faz: [I.PEDRISCO, 2], usa: [[I.PEDRA, 2]], grupo: 'construir', forma: ['P.', '.P'] },
  { id: 'terra-arada', faz: [I.TERRA_ARADA, 1], usa: [[I.TERRA, 1]], grupo: 'construir' },
  { id: 'tijolo', faz: [I.TIJOLO, 2], usa: [[I.TERRA, 1], [I.AREIA, 1]], bancada: true, grupo: 'construir' },
  { id: 'vidro', faz: [I.VIDRO, 1], usa: [[I.AREIA, 2]], bancada: true, grupo: 'construir' },
  // isqueiro e tocha: no clássico com barra de ferro e carvão; os mundos com mods guardam a receita antiga (minério)
  { id: 'isqueiro', faz: [1010, 1], usa: [[20, 1], [67, 1]], bancada: true, grupo: 'ferramentas', classico: false }, // pedrisco + minério de ferro
  { id: 'isqueiro-ferro', faz: [1010, 1], usa: [[20, 1], [I.BARRA_FERRO, 1]], bancada: true, grupo: 'ferramentas' },
  { id: 'tocha', faz: [221, 4], usa: [[I.GRAVETO, 1], [66, 1]], grupo: 'construir', classico: false }, // 66 = minério de carvão
  { id: 'tocha-carvao', faz: [221, 4], usa: [[I.CARVAO, 1], [I.GRAVETO, 1]], grupo: 'construir', forma: ['C', 'G'] },
  { id: 'fornalha', faz: [I.FORNALHA, 1], usa: [[I.PEDRISCO, 8]], bancada: true, grupo: 'construir', forma: ['RRR', 'R.R', 'RRR'] },
  { id: 'bloco-ferro', faz: [I.BLOCO_FERRO, 1], usa: [[I.BARRA_FERRO, 9]], bancada: true, grupo: 'construir', forma: ['FFF', 'FFF', 'FFF'] },
  { id: 'barras-ferro', faz: [I.BARRA_FERRO, 9], usa: [[I.BLOCO_FERRO, 1]], grupo: 'construir' },
  { id: 'bloco-ouro', faz: [I.BLOCO_OURO, 1], usa: [[I.BARRA_OURO, 9]], bancada: true, grupo: 'construir', forma: ['OOO', 'OOO', 'OOO'] },
  { id: 'barras-ouro', faz: [I.BARRA_OURO, 9], usa: [[I.BLOCO_OURO, 1]], grupo: 'construir' },
  { id: 'bloco-diamante', faz: [I.BLOCO_DIAMANTE, 1], usa: [[I.DIAMANTE, 9]], bancada: true, grupo: 'construir', forma: ['DDD', 'DDD', 'DDD'] },
  { id: 'diamantes', faz: [I.DIAMANTE, 9], usa: [[I.BLOCO_DIAMANTE, 1]], grupo: 'construir' },
  { id: 'acucar', faz: [1011, 1], usa: [[224, 1]], grupo: 'basico' },
  { id: 'bolo', faz: [1012, 1], usa: [[32, 3], [1011, 2]], bancada: true, grupo: 'basico' },
  { id: 'bau', faz: [223, 1], usa: [[I.TABUAS, 8]], bancada: true, grupo: 'construir', forma: ['TTT', 'T.T', 'TTT'] },
  { id: 'escada-mao', faz: [211, 3], usa: [[I.GRAVETO, 7]], bancada: true, grupo: 'construir', forma: ['G.G', 'GGG', 'G.G'] },
  { id: 'lampiao', faz: [I.LAMPIAO, 1], usa: [[I.VIDRO, 1], [I.GRAVETO, 1]], bancada: true, grupo: 'construir' },
  { id: 'feno', faz: [I.FENO, 1], usa: [[I.TRIGO, 9]], grupo: 'construir', forma: ['WWW', 'WWW', 'WWW'] }, // como no clássico: 9 trigos
  { id: 'trigo-do-feno', faz: [I.TRIGO, 9], usa: [[I.FENO, 1]], grupo: 'basico' },
  { id: 'pao', faz: [I.PAO, 1], usa: [[I.TRIGO, 3]], bancada: true, grupo: 'basico', forma: ['WWW'] }, // pão como no clássico: 3 trigos em fila na bancada
  { id: 'porta', faz: [I.PORTA, 3], usa: [[I.TABUAS, 6]], bancada: true, grupo: 'construir', forma: ['TT', 'TT', 'TT'] },
  { id: 'forno', faz: [I.FORNO, 1], usa: [[I.PEDRA, 6], [I.PEDRISCO, 2]], bancada: true, grupo: 'construir', extra: true },
  { id: 'manivela', faz: [I.SARILHO, 1], usa: [[I.TRONCO, 1], [I.GRAVETO, 2]], bancada: true, grupo: 'construir', extra: true },
  // móveis (moveis.js); o pedreiro gasta o mesmo material quando faz os móveis da casa (casas.js BRUTO)
  { id: 'cama', faz: [176, 1], usa: [[I.TABUAS, 2], [I.LA_BRANCA, 1], [I.LA_VERMELHA, 1]], bancada: true, grupo: 'construir' },
  { id: 'cadeira', faz: [180, 1], usa: [[I.TABUAS, 2]], bancada: true, grupo: 'construir', forma: ['TT'], extra: true },
  { id: 'mesa', faz: [184, 1], usa: [[I.TABUAS, 3]], bancada: true, grupo: 'construir', forma: ['TTT'], extra: true },
  { id: 'balcao', faz: [185, 1], usa: [[I.TABUAS, 3]], bancada: true, grupo: 'construir', forma: ['TT', 'T.'], extra: true },
  { id: 'estante', faz: [186, 1], usa: [[I.TABUAS, 4]], bancada: true, grupo: 'construir', forma: ['T.T', 'T.T'] },
  { id: 'prateleira-paes', faz: [187, 1], usa: [[I.TABUAS, 4]], bancada: true, grupo: 'construir', forma: ['TTT', '.T.'], extra: true },
  // cores
  { id: 'la-vermelha', faz: [I.LA_VERMELHA, 1], usa: [[I.LA_BRANCA, 1], [I.FLOR_VERMELHA, 1]], grupo: 'cores' },
  { id: 'la-amarela', faz: [I.LA_AMARELA, 1], usa: [[I.LA_BRANCA, 1], [I.FLOR_AMARELA, 1]], grupo: 'cores' },
  { id: 'la-azul', faz: [I.LA_AZUL, 1], usa: [[I.LA_BRANCA, 1], [I.FLOR_AZUL, 1]], grupo: 'cores' },
  { id: 'la-verde', faz: [I.LA_VERDE, 1], usa: [[I.LA_BRANCA, 1], [I.CAPIM, 1]], grupo: 'cores' },
  { id: 'la-rosa', faz: [I.LA_ROSA, 2], usa: [[I.LA_BRANCA, 1], [I.LA_VERMELHA, 1]], grupo: 'cores' },
  // formas que não são cubos (formas-defs.js: 80..99)
  { id: 'tronco-redondo', faz: [80, 2], usa: [[I.TRONCO, 2]], grupo: 'formas', forma: ['L', 'L'] },
  { id: 'tronco-redondo-pinheiro', faz: [81, 2], usa: [[71, 2]], grupo: 'formas', forma: ['L', 'L'] },
  { id: 'tronco-redondo-betula', faz: [82, 2], usa: [[73, 2]], grupo: 'formas', forma: ['L', 'L'] },
  { id: 'cerca', faz: [84, 3], usa: [[I.TABUAS, 2], [I.GRAVETO, 2]], grupo: 'formas', forma: ['TG', 'TG'] },
  { id: 'meio-bloco', faz: [90, 6], usa: [[I.PEDRA, 3]], bancada: true, grupo: 'formas', forma: ['PPP'] },
  { id: 'rampa', faz: [91, 2], usa: [[I.PEDRISCO, 3]], grupo: 'formas', forma: ['R.', 'RR'] },
  { id: 'escada', faz: [95, 4], usa: [[I.TABUAS, 6]], bancada: true, grupo: 'formas', forma: ['T..', 'TT.', 'TTT'] },
  { id: 'coluna', faz: [83, 2], usa: [[I.PEDRA, 2]], bancada: true, grupo: 'formas', forma: ['P', 'P'] },
  { id: 'bola', faz: [87, 4], usa: [[I.PEDRA, 4]], bancada: true, grupo: 'formas', forma: ['.P.', 'P.P', '.P.'] },
  { id: 'cupula', faz: [88, 2], usa: [[I.TIJOLO, 3]], bancada: true, grupo: 'formas' },
  { id: 'vidro-fino', faz: [85, 4], usa: [[I.VIDRO, 1]], bancada: true, grupo: 'formas' },
  { id: 'cupula-vidro', faz: [89, 2], usa: [[I.VIDRO, 3]], bancada: true, grupo: 'formas' },
  { id: 'cano', faz: [86, 4], usa: [[I.PEDRA, 2], [I.PEDRISCO, 1]], bancada: true, grupo: 'formas' },
  { id: 'roda', faz: [99, 1], usa: [[I.TABUAS, 2], [I.GRAVETO, 1]], bancada: true, grupo: 'formas', forma: ['TGT'] },
  // engenharia (bancada; só nos mundos com máquinas)
  { id: 'fio', faz: [I.FIO, 6], usa: [[I.LA_VERMELHA, 1], [I.GRAVETO, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'alavanca', faz: [I.ALAVANCA, 1], usa: [[I.GRAVETO, 1], [I.PEDRISCO, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'botao', faz: [I.BOTAO, 1], usa: [[I.PEDRA, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'placa', faz: [I.PLACA, 1], usa: [[I.PEDRA, 2]], bancada: true, grupo: 'maquinas', forma: ['PP'] },
  { id: 'sensor', faz: [I.SENSOR, 1], usa: [[I.VIDRO, 1], [I.LA_AZUL, 1], [I.PEDRA, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'pisca', faz: [I.PISCA, 1], usa: [[I.LAMPIAO, 1], [I.FIO, 2]], bancada: true, grupo: 'maquinas' },
  { id: 'lampada', faz: [I.LAMPADA, 1], usa: [[I.LAMPIAO, 1], [I.VIDRO, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'portao', faz: [I.PORTAO, 1], usa: [[I.TABUAS, 4], [I.PEDRA, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'ventilador', faz: [I.VENTILADOR, 1], usa: [[I.PEDRA, 4], [I.TABUAS, 1], [I.FIO, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'sino', faz: [I.SINO, 1], usa: [[I.PEDRA, 2], [I.FLOR_AMARELA, 1], [I.FIO, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'confete', faz: [I.CONFETE, 1], usa: [[I.PEDRA, 3], [I.FLOR_VERMELHA, 1], [I.FLOR_AMARELA, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'trampolim', faz: [I.TRAMPOLIM, 1], usa: [[I.LA_BRANCA, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'maquinas' },
  { id: 'esteira', faz: [I.ESTEIRA, 2], usa: [[I.PEDRA, 3], [I.FIO, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'catavento', faz: [I.CATAVENTO, 1], usa: [[I.TABUAS, 4], [I.LA_BRANCA, 4], [I.FIO, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'cabo', faz: [I.CABO, 4], usa: [[I.TRONCO, 1], [I.FIO, 2]], bancada: true, grupo: 'maquinas' },
  { id: 'pedra-moinho', faz: [I.MO, 1], usa: [[I.PEDRA, 4], [I.GRAVETO, 1]], bancada: true, grupo: 'maquinas' },
];
export function adicionarReceitas(lista) { for (const r of lista) if (!RECEITAS.some((x) => x.id === r.id)) RECEITAS.push(r); }
export const regras = { liberada: () => true };

// receitas que aparecem no livro deste mundo
// jogo clássico de verdade (igual a vida.js classico() e economia.js op.fome)
export const mundoClassico = (o) => {
  if (!o || !o.sobrevivencia || o.armas || o.tipo === 'guerra') return false;
  const dif = typeof o.dificuldade === 'string' ? o.dificuldade : o.selvagensMachucam ? 'normal' : 'pacifico';
  return dif !== 'pacifico';
};
// receita com `classico: false` = só nos mundos com mods; `soClassico` = só no jogo clássico (a armadura) (no clássico há a receita certa, com barra/carvão)
export const receitaNoMundo = (r, classico) => !(classico && r.classico === false) && !(!classico && r.soClassico);
export function receitasDoMundo(opcoes) {
  const fora = new Set(GRUPOS.filter((g) => g.opcao && opcoes && opcoes[g.opcao] === false).map((g) => g.id));
  const cl = mundoClassico(opcoes);
  const semExtras = !!opcoes && opcoes.extras === false; // mod "Blocos extras" desligado: só o que existe no clássico
  return RECEITAS.filter((r) => !fora.has(r.grupo) && !(semExtras && r.extra) && receitaNoMundo(r, cl) && regras.liberada(r, opcoes));
}
export const receita = (id) => RECEITAS.find((r) => r.id === id) || null;

// `itens` = { id: quantidade } (a mochila)
export const MAX_ITEM = 9999;
export const qtdEm = (itens, id) => itens[id] || 0;
export const faltaBancada = (r, temBancada) => !!r.bancada && !temBancada;
export const temTudo = (itens, r) => r.usa.every(([id, n]) => qtdEm(itens, id) >= n);
export const podeCriar = (itens, r, temBancada, limite = false) => !faltaBancada(r, temBancada) && temTudo(itens, r) && qtdEm(itens, r.faz[0]) + r.faz[1] <= MAX_ITEM
  && (!limite || cabeDepois(itens, r));

// ---------- espaço da mochila (como no clássico) ----------
// 27 espaços + 9 da barra + 1 da segunda mão; cada espaço guarda uma pilha: 64 da maioria das coisas,
// 16 baldes, 1 ferramenta. A conta é pela arrumação mais apertada: o inventário da tela (inventario.js)
// sempre consegue arrumar o que a mochila diz que cabe.
export const ESPACOS = 37;
export const pilhaDe = (id) => (FERRAMENTAS[id] || DURA[id] ? 1 : id === I.BALDE ? 16 : 64); // ferramenta, espada, isqueiro e armadura não empilham
export function espacosUsados(itens) {
  let s = 0;
  const vestida = [0, 0, 0, 0]; // uma peça de cada parte vai vestida, no espaço dela (inventario.js), não na mochila
  for (const k in itens) {
    const n = itens[k];
    if (!(n > 0)) continue;
    s += Math.ceil(n / pilhaDe(+k));
    const p = parteDe(+k);
    if (p >= 0 && !vestida[p]) { vestida[p] = 1; s--; }
  }
  return s;
}
// quantos de `id` ainda cabem
export function cabeQuanto(itens, id) {
  const p = pilhaDe(id), tem = qtdEm(itens, id);
  const sobra = tem % p ? p - (tem % p) : 0;
  // a primeira peça de uma parte da armadura vai vestida: tem espaço próprio
  const pa = parteDe(id), vestir = pa >= 0 && !Object.keys(itens).some((k) => itens[k] > 0 && parteDe(+k) === pa) ? 1 : 0;
  return Math.max(0, sobra + (Math.max(0, ESPACOS - espacosUsados(itens)) + vestir) * p);
}
export const cabe = (itens, id, n) => cabeQuanto(itens, id) >= n;
// depois de gastar os ingredientes, o resultado cabe?
function cabeDepois(itens, r) {
  const c = { ...itens };
  for (const [id, n] of r.usa) { c[id] = qtdEm(c, id) - n; if (c[id] <= 0) delete c[id]; }
  return cabe(c, r.faz[0], r.faz[1]);
}

// ---------- grade de criar (2x2 na mochila, 3x3 na bancada) ----------
// receita com `forma`: o desenho tem de ser esse (em qualquer lugar da grade, e pode ser espelhado);
// sem `forma`: as coisas podem estar em qualquer lugar (uma por espaço). Cada espaço gasta 1.
// Letras: T tábuas, G graveto, P pedra, R pedrisco, W trigo, F barra de ferro, D diamante, O barra de ouro,
// C carvão, L = o único ingrediente da receita.
const LETRAS = { T: I.TABUAS, G: I.GRAVETO, P: I.PEDRA, R: I.PEDRISCO, W: I.TRIGO, F: I.BARRA_FERRO, D: I.DIAMANTE, O: I.BARRA_OURO, C: I.CARVAO, I: I.TEIA };
const letra = (r, c) => (c === '.' ? 0 : c === 'L' ? r.usa[0][0] : LETRAS[c]);
export function desenhoDe(r) {
  if (r.forma) return r.forma.map((l) => [...l].map((c) => letra(r, c)));
  return null;
}
export const totalUsa = (r) => r.usa.reduce((s, [, n]) => s + n, 0);
// cabe numa grade de lado w? (2x2 só para o que não precisa de bancada)
export function cabeNaGrade(r, w) {
  if (w < 3 && r.bancada) return false;
  const d = desenhoDe(r);
  return d ? d.length <= w && d[0].length <= w : totalUsa(r) <= w * w;
}
// recorta a grade no retângulo usado
function recortar(grade, w) {
  let x0 = w, y0 = w, x1 = -1, y1 = -1;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) if (grade[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  const r = [];
  for (let y = y0; y <= y1; y++) { const l = []; for (let x = x0; x <= x1; x++) l.push(grade[y * w + x] || 0); r.push(l); }
  return r;
}
const igual = (a, b) => a.length === b.length && a.every((l, y) => l.length === b[y].length && l.every((v, x) => v === b[y][x]));
// grade = ids (w*w, 0 = vazio) -> a receita que ela faz (ou null)
export function receitaDaGrade(grade, w, lista = RECEITAS) {
  const g = recortar(grade, w);
  if (!g) return null;
  const esp = g.map((l) => [...l].reverse());
  const cont = {}; let n = 0;
  for (const v of grade) if (v) { cont[v] = (cont[v] || 0) + 1; n++; }
  for (const r of lista) {
    if (!cabeNaGrade(r, w)) continue;
    const d = desenhoDe(r);
    if (d) { if (igual(g, d) || igual(esp, d)) return r; continue; }
    if (n === totalUsa(r) && r.usa.every(([id, q]) => cont[id] === q)) return r;
  }
  return null;
}
// como o livro de receitas arruma os ingredientes na grade (ids w*w)
export function arrumar(r, w) {
  const g = new Array(w * w).fill(0);
  const d = desenhoDe(r);
  if (d) { d.forEach((l, y) => l.forEach((v, x) => { g[y * w + x] = v; })); return g; }
  let i = 0;
  for (const [id, q] of r.usa) for (let k = 0; k < q; k++) g[i++] = id;
  return g;
}

export function por(itens, id, n = 1) {
  if (!guardavel(id) || !(n > 0)) return 0;
  const cabe = Math.min(n, MAX_ITEM - qtdEm(itens, id));
  if (cabe > 0) itens[id] = qtdEm(itens, id) + cabe;
  return Math.max(0, cabe);
}
export function tirar(itens, id, n = 1) {
  const tem = qtdEm(itens, id);
  if (tem < n) return false;
  if (tem === n) delete itens[id]; else itens[id] = tem - n;
  return true;
}
export function criarEm(itens, r, temBancada, limite = false) {
  if (!podeCriar(itens, r, temBancada, limite)) return false;
  for (const [id, n] of r.usa) tirar(itens, id, n);
  por(itens, r.faz[0], r.faz[1]);
  return true;
}

// ---------- desgaste das ferramentas (como no clássico) ----------
// e.desg[id] = lista com o uso já gasto de cada ferramenta desse tipo (a primeira é a da mão: gasta primeiro).
// Quebrar um bloco com a ferramenta gasta 1 (plantas e coisas de um toque não); acender com o isqueiro gasta 1.
// Quando chega no máximo, a ferramenta quebra. Largar no chão leva o desgaste junto (pegar de volta não conserta).
export const DURA = { 1001: 59, 1003: 59, 1005: 59, 1002: 131, 1004: 131, 1006: 131, 1010: 64, 1105: 250, 1106: 250, 1107: 250, 1108: 1561, 1109: 1561, 1110: 1561, 1113: 59, 1114: 131, 1115: 250, 1116: 1561, ...DURA_ARMADURA };
const lim = (id, v) => Math.max(0, Math.min(DURA[id] - 1, v | 0));
// desgaste válido para n ferramentas id (lista de números; o que faltar é ferramenta nova)
export const desgLista = (id, l, n) => (DURA[id] && Array.isArray(l) ? l.slice(0, Math.max(0, n | 0)).map((v) => lim(id, v)) : []);
// a lista de cada ferramenta nunca passa de quantas a mochila tem
export function ajustarDesg(e) {
  const d = {};
  for (const [k, l] of Object.entries(e.desg && typeof e.desg === 'object' ? e.desg : {})) {
    const q = desgLista(+k, l, e.itens[k] | 0);
    while (q.length && !q[q.length - 1]) q.pop(); // as novas no fim não precisam ficar
    if (q.length) d[k] = q;
  }
  e.desg = d;
}
// gasta 1 da ferramenta id: 'quebrou' (sumiu da mochila), 'gastou' ou null (não é ferramenta / não tem)
export function desgastar(e, id) {
  if (!DURA[id] || !((e.itens[id] | 0) > 0)) return null;
  const l = ((e.desg ??= {})[id] ??= []);
  l[0] = (l[0] | 0) + 1;
  if (l[0] < DURA[id]) return 'gastou';
  l.shift();
  tirar(e.itens, id, 1);
  ajustarDesg(e);
  return 'quebrou';
}
// tira n do fim da lista (as que saem da mochila levam o desgaste); devolve o desgaste delas
export function tirarDesg(e, id, n) {
  if (!DURA[id]) return null;
  const l = (e.desg && e.desg[id]) || [];
  const tem = (e.itens[id] | 0) + n; // antes de tirar
  while (l.length < tem) l.push(0);
  const fora = l.splice(tem - n, n);
  if (e.desg) e.desg[id] = l;
  return fora.some((v) => v > 0) ? fora : null;
}
// as que chegam (do chão) entram no fim com o desgaste delas
export function porDesg(e, id, d, n) {
  if (!DURA[id]) return;
  const tem = (e.itens[id] | 0) - n; // antes de pôr
  const l = ((e.desg ??= {})[id] ??= []);
  while (l.length < tem) l.push(0);
  l.length = tem;
  l.push(...desgLista(id, d, n), ...Array(Math.max(0, n - desgLista(id, d, n).length)).fill(0));
}

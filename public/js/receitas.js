// Coletar e criar: o que cada bloco dá ao quebrar, o que se gasta ao colocar, as receitas
// (livro de receitas: toca e cria, sem decorar grade) e as ferramentas.
// Regras puras, sem tela: o jogo sem internet e a sala online (economia.js) usam as mesmas.
// Não importe nada daqui que dependa do navegador.
//
// Os itens guardados ficam na mochila do jogador (economia.js: estado.itens = { id: quantidade }).
// Para outras partes do jogo:
//   - receitas novas: adicionarReceitas([{ id, faz: [id, qtd], usa: [[id, qtd], ...], bancada, grupo }])
//   - liberar receitas aos poucos (ex.: eras da Linha do Tempo): ponha `era: 'x'` na receita e troque
//     `regras.liberada = (receita, opcoes) => true` por uma função sua

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
  GRAVETO: 1000, PICARETA_MADEIRA: 1001, PICARETA_PEDRA: 1002, MACHADO_MADEIRA: 1003, MACHADO_PEDRA: 1004, PA_MADEIRA: 1005, PA_PEDRA: 1006,
};
const I = IDS;
export const ULTIMO_ITEM = 1006;
export const MAX_BLOCO = 255;

// pode ficar guardado na mochila: blocos (menos as águas correntes) e os itens conhecidos
export const guardavel = (id) => Number.isInteger(id) && ((id > 0 && id <= MAX_BLOCO && !(id >= 23 && id <= 30)) || (id >= 1000 && id <= ULTIMO_ITEM));

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
  return b;
}
// o tronco redondo das árvores dá o tronco comum (dá para refazer o redondo no livro, 1 por 1)
const VIRA = { [I.GRAMA]: I.TERRA, [I.TERRA_ARADA]: I.TERRA, 80: I.TRONCO, 81: 71, 82: 73 };
// extras: [chance em %, item]; sorteio fixo pela posição (o jogo e o servidor tiram o mesmo resultado)
const EXTRA = { [I.FOLHAS]: [35, I.GRAVETO], [I.CAPIM]: [30, I.TRIGO] };
const sorteio = (x, y, z) => (((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791)) >>> 0) % 100);

export function oQueCai(b, x = 0, y = 0, z = 0) {
  if (!Number.isInteger(b) || b <= 0 || (b >= 23 && b <= 30) || b > MAX_BLOCO) return [];
  const r = [[VIRA[b] ?? baseDe(b), 1]];
  const ex = EXTRA[b];
  if (ex && sorteio(x, y, z) < ex[0]) r.push([ex[1], 1]);
  return r;
}

// colocar só gasta quando o lugar estava vazio (ar, água ou plantinha); ligar uma alavanca não gasta
const PLANTAS = new Set([11, 12, 13, 22, 32, 129, 130, 135]);
export const lugarVazio = (de) => !de || de === 5 || (de >= 23 && de <= 30) || PLANTAS.has(de);
export const gastoDe = (b) => baseDe(b);

// ---------- ferramentas ----------
export const FERRAMENTAS = {
  [I.PICARETA_MADEIRA]: ['picareta', 2], [I.PICARETA_PEDRA]: ['picareta', 3],
  [I.MACHADO_MADEIRA]: ['machado', 2], [I.MACHADO_PEDRA]: ['machado', 3],
  [I.PA_MADEIRA]: ['pa', 2], [I.PA_PEDRA]: ['pa', 3],
};
const TIPO_DO_BLOCO = {};
for (const b of [I.PEDRA, I.PEDRISCO, I.TIJOLO, I.LAMPIAO, I.VIDRO, 108, 109, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122]) TIPO_DO_BLOCO[b] = 'picareta';
for (const b of [I.TRONCO, I.TABUAS, I.FOLHAS, I.FENO, I.BANCADA, 110, 111, 47, 48, 49, 50, 53, 54]) TIPO_DO_BLOCO[b] = 'machado';
for (let b = 176; b <= 187; b++) TIPO_DO_BLOCO[b] = 'machado'; // móveis
for (const b of [51, 52, 55, 56]) TIPO_DO_BLOCO[b] = 'picareta';
for (const b of [I.TERRA, I.GRAMA, I.AREIA, I.TERRA_ARADA]) TIPO_DO_BLOCO[b] = 'pa';
// formas (80..99): madeira com machado, pedra/vidro com picareta
for (const b of [80, 81, 82, 84, 95, 96, 97, 98, 99]) TIPO_DO_BLOCO[b] = 'machado';
for (const b of [83, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94]) TIPO_DO_BLOCO[b] = 'picareta';

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
  { id: 'formas', nome: 'Formas redondas', icone: 'bloco' },
  { id: 'maquinas', nome: 'Engenharia', icone: 'engrenagem', opcao: 'maquinas' },
];
export const RECEITAS = [
  // na mão
  { id: 'tabuas', faz: [I.TABUAS, 4], usa: [[I.TRONCO, 1]], grupo: 'basico' },
  { id: 'graveto', faz: [I.GRAVETO, 4], usa: [[I.TABUAS, 2]], grupo: 'basico' },
  { id: 'bancada', faz: [I.BANCADA, 1], usa: [[I.TABUAS, 4]], grupo: 'basico' },
  // ferramentas (bancada)
  { id: 'picareta-madeira', faz: [I.PICARETA_MADEIRA, 1], usa: [[I.TABUAS, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas' },
  { id: 'machado-madeira', faz: [I.MACHADO_MADEIRA, 1], usa: [[I.TABUAS, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas' },
  { id: 'pa-madeira', faz: [I.PA_MADEIRA, 1], usa: [[I.TABUAS, 1], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas' },
  { id: 'picareta-pedra', faz: [I.PICARETA_PEDRA, 1], usa: [[I.PEDRA, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas' },
  { id: 'machado-pedra', faz: [I.MACHADO_PEDRA, 1], usa: [[I.PEDRA, 3], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas' },
  { id: 'pa-pedra', faz: [I.PA_PEDRA, 1], usa: [[I.PEDRA, 1], [I.GRAVETO, 2]], bancada: true, grupo: 'ferramentas' },
  // construção
  { id: 'pedrisco', faz: [I.PEDRISCO, 2], usa: [[I.PEDRA, 2]], grupo: 'construir' },
  { id: 'terra-arada', faz: [I.TERRA_ARADA, 1], usa: [[I.TERRA, 1]], grupo: 'construir' },
  { id: 'tijolo', faz: [I.TIJOLO, 2], usa: [[I.TERRA, 1], [I.AREIA, 1]], bancada: true, grupo: 'construir' },
  { id: 'vidro', faz: [I.VIDRO, 1], usa: [[I.AREIA, 2]], bancada: true, grupo: 'construir' },
  { id: 'lampiao', faz: [I.LAMPIAO, 1], usa: [[I.VIDRO, 1], [I.GRAVETO, 1]], bancada: true, grupo: 'construir' },
  { id: 'feno', faz: [I.FENO, 1], usa: [[I.TRIGO, 3]], grupo: 'construir' },
  { id: 'porta', faz: [I.PORTA, 2], usa: [[I.TABUAS, 4]], bancada: true, grupo: 'construir' },
  { id: 'forno', faz: [I.FORNO, 1], usa: [[I.PEDRA, 6], [I.PEDRISCO, 2]], bancada: true, grupo: 'construir' },
  { id: 'manivela', faz: [I.SARILHO, 1], usa: [[I.TRONCO, 1], [I.GRAVETO, 2]], bancada: true, grupo: 'construir' },
  // móveis (moveis.js); o pedreiro gasta o mesmo material quando faz os móveis da casa (casas.js BRUTO)
  { id: 'cama', faz: [176, 1], usa: [[I.TABUAS, 2], [I.LA_BRANCA, 1], [I.LA_VERMELHA, 1]], bancada: true, grupo: 'construir' },
  { id: 'cadeira', faz: [180, 1], usa: [[I.TABUAS, 2]], bancada: true, grupo: 'construir' },
  { id: 'mesa', faz: [184, 1], usa: [[I.TABUAS, 3]], bancada: true, grupo: 'construir' },
  { id: 'balcao', faz: [185, 1], usa: [[I.TABUAS, 3]], bancada: true, grupo: 'construir' },
  { id: 'estante', faz: [186, 1], usa: [[I.TABUAS, 4]], bancada: true, grupo: 'construir' },
  { id: 'prateleira-paes', faz: [187, 1], usa: [[I.TABUAS, 4]], bancada: true, grupo: 'construir' },
  // cores
  { id: 'la-vermelha', faz: [I.LA_VERMELHA, 1], usa: [[I.LA_BRANCA, 1], [I.FLOR_VERMELHA, 1]], grupo: 'cores' },
  { id: 'la-amarela', faz: [I.LA_AMARELA, 1], usa: [[I.LA_BRANCA, 1], [I.FLOR_AMARELA, 1]], grupo: 'cores' },
  { id: 'la-azul', faz: [I.LA_AZUL, 1], usa: [[I.LA_BRANCA, 1], [I.FLOR_AZUL, 1]], grupo: 'cores' },
  { id: 'la-verde', faz: [I.LA_VERDE, 1], usa: [[I.LA_BRANCA, 1], [I.CAPIM, 1]], grupo: 'cores' },
  { id: 'la-rosa', faz: [I.LA_ROSA, 2], usa: [[I.LA_BRANCA, 1], [I.LA_VERMELHA, 1]], grupo: 'cores' },
  // formas que não são cubos (formas-defs.js: 80..99)
  { id: 'tronco-redondo', faz: [80, 1], usa: [[I.TRONCO, 1]], grupo: 'formas' },
  { id: 'tronco-redondo-pinheiro', faz: [81, 1], usa: [[71, 1]], grupo: 'formas' },
  { id: 'tronco-redondo-betula', faz: [82, 1], usa: [[73, 1]], grupo: 'formas' },
  { id: 'cerca', faz: [84, 3], usa: [[I.TABUAS, 2], [I.GRAVETO, 2]], grupo: 'formas' },
  { id: 'meio-bloco', faz: [90, 2], usa: [[I.PEDRA, 1]], grupo: 'formas' },
  { id: 'rampa', faz: [91, 2], usa: [[I.PEDRISCO, 3]], grupo: 'formas' },
  { id: 'escada', faz: [95, 4], usa: [[I.TABUAS, 6]], bancada: true, grupo: 'formas' },
  { id: 'coluna', faz: [83, 2], usa: [[I.PEDRA, 2]], bancada: true, grupo: 'formas' },
  { id: 'bola', faz: [87, 1], usa: [[I.PEDRA, 1]], bancada: true, grupo: 'formas' },
  { id: 'cupula', faz: [88, 2], usa: [[I.TIJOLO, 3]], bancada: true, grupo: 'formas' },
  { id: 'vidro-fino', faz: [85, 4], usa: [[I.VIDRO, 1]], bancada: true, grupo: 'formas' },
  { id: 'cupula-vidro', faz: [89, 2], usa: [[I.VIDRO, 3]], bancada: true, grupo: 'formas' },
  { id: 'cano', faz: [86, 4], usa: [[I.PEDRA, 2], [I.PEDRISCO, 1]], bancada: true, grupo: 'formas' },
  { id: 'roda', faz: [99, 1], usa: [[I.TABUAS, 2], [I.GRAVETO, 1]], bancada: true, grupo: 'formas' },
  // engenharia (bancada; só nos mundos com máquinas)
  { id: 'fio', faz: [I.FIO, 6], usa: [[I.LA_VERMELHA, 1], [I.GRAVETO, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'alavanca', faz: [I.ALAVANCA, 1], usa: [[I.GRAVETO, 1], [I.PEDRISCO, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'botao', faz: [I.BOTAO, 1], usa: [[I.PEDRA, 1]], bancada: true, grupo: 'maquinas' },
  { id: 'placa', faz: [I.PLACA, 1], usa: [[I.PEDRA, 2]], bancada: true, grupo: 'maquinas' },
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
export function receitasDoMundo(opcoes) {
  const fora = new Set(GRUPOS.filter((g) => g.opcao && opcoes && opcoes[g.opcao] === false).map((g) => g.id));
  return RECEITAS.filter((r) => !fora.has(r.grupo) && regras.liberada(r, opcoes));
}
export const receita = (id) => RECEITAS.find((r) => r.id === id) || null;

// `itens` = { id: quantidade } (a mochila)
export const MAX_ITEM = 9999;
export const qtdEm = (itens, id) => itens[id] || 0;
export const faltaBancada = (r, temBancada) => !!r.bancada && !temBancada;
export const temTudo = (itens, r) => r.usa.every(([id, n]) => qtdEm(itens, id) >= n);
export const podeCriar = (itens, r, temBancada) => !faltaBancada(r, temBancada) && temTudo(itens, r) && qtdEm(itens, r.faz[0]) + r.faz[1] <= MAX_ITEM;

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
export function criarEm(itens, r, temBancada) {
  if (!podeCriar(itens, r, temBancada)) return false;
  for (const [id, n] of r.usa) tirar(itens, id, n);
  por(itens, r.faz[0], r.faz[1]);
  return true;
}

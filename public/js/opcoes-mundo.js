// Opções escolhidas na criação do mundo (valem para todo mundo que entra nele).
// Usado pelo jogo (navegador) e pelo servidor (functions/api), então não importa nada.
//
// Como usar numa funcionalidade nova:
//   import { opcoesMundo } from './opcoes-mundo.js';
//   if (!opcoesMundo.vilas) return; // não gera vilas neste mundo
// Tamanho: `opcoesMundo.tamanho` ('pequeno' | 'medio' | 'grande'); `limiteMundo()` dá a meia-largura em blocos (null = sem fim).
// `opcoesMundo` é preenchido antes do mundo começar (iniciarMundo em main.js) e também fica em `mundo.opcoes`.
// Para criar uma opção nova: acrescente em OPCOES_MUNDO abaixo (o servidor e a tela já usam a lista).

export const OPCOES_MUNDO = [
  { id: 'animais', icone: 'ovelha', nome: 'Bichinhos', desc: 'Ovelhas, porquinhos, coelhos e amigos', padrao: true },
  { id: 'vilas', icone: 'vila', nome: 'Vilas', desc: 'Vilinhas com casas e moradores', padrao: true },
  { id: 'veiculos', icone: 'carro', nome: 'Veículos', desc: 'Carrinhos e barcos para passear', padrao: true },
  { id: 'maquinas', icone: 'engrenagem', nome: 'Máquinas', desc: 'Engenhocas, alavancas e esteiras', padrao: true },
  { id: 'aguaCorre', icone: 'onda', nome: 'Água que corre', desc: 'A água escorre e faz cachoeiras', padrao: true },
  { id: 'cicloDia', icone: 'lua', nome: 'Dia e noite', desc: 'Desligado: é sempre de dia', padrao: true },
  { id: 'mercado', icone: 'moeda', nome: 'Mercado', desc: 'Moedas e lojinha com os moradores', padrao: true, antigos: false },
  { id: 'objetivos', icone: 'alvo', nome: 'Missões', desc: 'Desafios com prêmios', padrao: true, antigos: false },
  { id: 'monstros', icone: 'monstro', nome: 'Monstrinhos', desc: 'Aparecem de noite e dão sustinho', padrao: false },
  { id: 'monstrosMachucam', icone: 'coracao', nome: 'Monstros machucam', desc: 'Corações de vida. Luz e um toque espantam', padrao: false },
];
// padrao = como vem marcado ao criar; antigos = valor nos mundos criados antes da opção existir (se faltar, usa padrao)

// tamanho do mundo: pequeno e médio são ilhas com mar em volta (mais leves: dá para ver mais longe);
// grande não tem fim (como os mundos antigos, que ficam "grande").
export const TAMANHOS = {
  pequeno: { icone: 'ilha', nome: 'Pequeno', desc: 'Ilha de 256 blocos. Mais leve e bonito', limite: 128, raioExtra: 2 },
  medio: { icone: 'mapa', nome: 'Médio', desc: 'Ilha de 640 blocos', limite: 320, raioExtra: 1 },
  grande: { icone: 'globo', nome: 'Grande', desc: 'Sem fim. Pesa mais em aparelho fraco', limite: null, raioExtra: 0 },
};
export const TAMANHO_NOVO = 'medio'; // já vem marcado ao criar

// gerador do terreno: os mundos novos usam o clássico (biomas, rios, cavernas e minérios);
// os mundos antigos continuam com o terreno de antes para as construções não ficarem flutuando.
export const GERADORES = {
  atual: { nome: 'Pradaria de antes' },
  classico: { nome: 'Clássico: biomas, cavernas e minérios' },
};

// tipo do mundo: um campo só, compartilhado pelos modos especiais. Para um tipo novo, acrescente aqui.
// historia = "Linha do Tempo": começa na era dos dinossauros e evolui com a experiência (eras-regras.js)
export const TIPOS = {
  normal: { icone: 'flor', nome: 'Pradaria', desc: 'O mundo de sempre, com vilas e bichinhos' },
  historia: { icone: 'ampulheta', nome: 'Linha do Tempo', desc: 'Começa com os dinossauros e evolui pela história', semMonstros: true, oculto: true }, // oculto até as eras ficarem prontas
  // Ilha de Aventura (ilha-aventura.js): mapa como os de jogos de ação, mas sem armas. Tamanho fixo (limite/raioExtra valem no lugar do tamanho).
  aventura: { icone: 'ilha', nome: 'Ilha de Aventura', desc: 'Cidades, estradas, porto, farol e lugares com nome', limite: 256, raioExtra: 1 },
};

// PADRAO_MUNDO: o que vale quando falta a opção (mundos antigos); PADRAO_NOVO: o que já vem marcado ao criar
export const PADRAO_MUNDO = { ...Object.fromEntries(OPCOES_MUNDO.map((o) => [o.id, o.antigos ?? o.padrao])), tamanho: 'grande', tipo: 'normal', gerador: 'atual' };
export const PADRAO_NOVO = { ...Object.fromEntries(OPCOES_MUNDO.map((o) => [o.id, o.padrao])), tamanho: TAMANHO_NOVO, tipo: 'normal', gerador: 'classico' };

// aceita qualquer coisa (texto JSON, objeto, nada) e devolve só opções conhecidas, sempre true/false (+ tamanho)
export function normalizarOpcoes(o) {
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
  const r = { ...PADRAO_MUNDO };
  if (o && typeof o === 'object') {
    for (const k of Object.keys(r)) if (typeof o[k] === 'boolean' && typeof r[k] === 'boolean') r[k] = o[k];
    if (typeof o.tamanho === 'string' && Object.prototype.hasOwnProperty.call(TAMANHOS, o.tamanho)) r.tamanho = o.tamanho;
    if (typeof o.gerador === 'string' && Object.prototype.hasOwnProperty.call(GERADORES, o.gerador)) r.gerador = o.gerador;
    if (typeof o.tipo === 'string' && Object.prototype.hasOwnProperty.call(TIPOS, o.tipo)) r.tipo = o.tipo;
  }
  if (TIPOS[r.tipo].semMonstros) r.monstros = false;
  if (!r.monstros) r.monstrosMachucam = false;
  return r;
}

// semente: número digitado vira ele mesmo; palavra vira um número (sempre igual para a mesma palavra)
export function sementeDeTexto(t) {
  const s = String(t ?? '').trim();
  if (!s) return null;
  if (/^\d{1,9}$/.test(s)) return +s;
  let h = 2166136261;
  for (const ch of s.toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return (h >>> 0) % 1000000000;
}

// o objeto das opções do mundo que está aberto agora (mesma referência sempre)
export const opcoesMundo = { ...PADRAO_MUNDO };
export function definirOpcoesMundo(o) { Object.assign(opcoesMundo, normalizarOpcoes(o)); return opcoesMundo; }
export const limiteMundo = () => TIPOS[opcoesMundo.tipo]?.limite ?? TAMANHOS[opcoesMundo.tamanho].limite;
export const raioExtraMundo = () => TIPOS[opcoesMundo.tipo]?.raioExtra ?? TAMANHOS[opcoesMundo.tamanho].raioExtra;

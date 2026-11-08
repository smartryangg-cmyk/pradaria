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
  { id: 'animais', emoji: '🐑', nome: 'Bichinhos', desc: 'Ovelhas, porquinhos, coelhos e amigos', padrao: true },
  { id: 'vilas', emoji: '🏘️', nome: 'Vilas', desc: 'Vilinhas com casas e moradores', padrao: true },
  { id: 'veiculos', emoji: '🚗', nome: 'Veículos', desc: 'Carrinhos e barcos para passear', padrao: true },
  { id: 'maquinas', emoji: '⚙️', nome: 'Máquinas', desc: 'Engenhocas, alavancas e esteiras', padrao: true },
  { id: 'aguaCorre', emoji: '🌊', nome: 'Água que corre', desc: 'A água escorre e faz cachoeiras', padrao: true },
  { id: 'cicloDia', emoji: '🌙', nome: 'Dia e noite', desc: 'Desligado: é sempre de dia', padrao: true },
  { id: 'mercado', emoji: '🪙', nome: 'Mercado', desc: 'Moedas e lojinha com os moradores', padrao: true, antigos: false },
  { id: 'objetivos', emoji: '🎯', nome: 'Missões', desc: 'Desafios com prêmios', padrao: true, antigos: false },
  { id: 'monstros', emoji: '👾', nome: 'Monstrinhos', desc: 'Aparecem de noite e dão sustinho (sem machucar)', padrao: false },
];
// padrao = como vem marcado ao criar; antigos = valor nos mundos criados antes da opção existir (se faltar, usa padrao)

// tamanho do mundo: pequeno e médio são ilhas com mar em volta (mais leves: dá para ver mais longe);
// grande não tem fim (como os mundos antigos, que ficam "grande").
export const TAMANHOS = {
  pequeno: { emoji: '🏝️', nome: 'Pequeno', desc: 'Ilha de 256 blocos. Mais leve e bonito', limite: 128, raioExtra: 2 },
  medio: { emoji: '🗺️', nome: 'Médio', desc: 'Ilha de 640 blocos', limite: 320, raioExtra: 1 },
  grande: { emoji: '🌍', nome: 'Grande', desc: 'Sem fim. Pesa mais em aparelho fraco', limite: null, raioExtra: 0 },
};
export const TAMANHO_NOVO = 'medio'; // já vem marcado ao criar

// PADRAO_MUNDO: o que vale quando falta a opção (mundos antigos); PADRAO_NOVO: o que já vem marcado ao criar
export const PADRAO_MUNDO = { ...Object.fromEntries(OPCOES_MUNDO.map((o) => [o.id, o.antigos ?? o.padrao])), tamanho: 'grande' };
export const PADRAO_NOVO = { ...Object.fromEntries(OPCOES_MUNDO.map((o) => [o.id, o.padrao])), tamanho: TAMANHO_NOVO };

// aceita qualquer coisa (texto JSON, objeto, nada) e devolve só opções conhecidas, sempre true/false (+ tamanho)
export function normalizarOpcoes(o) {
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
  const r = { ...PADRAO_MUNDO };
  if (o && typeof o === 'object') {
    for (const k of Object.keys(r)) if (typeof o[k] === 'boolean' && typeof r[k] === 'boolean') r[k] = o[k];
    if (typeof o.tamanho === 'string' && Object.prototype.hasOwnProperty.call(TAMANHOS, o.tamanho)) r.tamanho = o.tamanho;
  }
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
export const limiteMundo = () => TAMANHOS[opcoesMundo.tamanho].limite;

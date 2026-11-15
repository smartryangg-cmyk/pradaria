// Arquivo de um mundo (exportar/importar): nome, semente, opções e os blocos que os jogadores mudaram.
// Usado pelo jogo (navegador) e pelo servidor (functions/api), então só importa o que também roda lá.
import { normalizarOpcoes } from './opcoes-mundo.js';

export const FORMATO = 'pradaria-mundo';
export const MAX_EDICOES_ARQUIVO = 200000; // o mesmo limite da sala
const LONGE = 100000;

export function montarArquivo({ nome, semente, opcoes, edicoes }) {
  return { formato: FORMATO, versao: 1, nome: String(nome || 'Meu mundo').slice(0, 24), semente, opcoes: normalizarOpcoes(opcoes), criado: new Date().toISOString(), edicoes: edicoes || [] };
}

// confere um arquivo (texto ou objeto). Devolve { nome, semente, opcoes, edicoes } ou { erro }
export function lerArquivo(dados) {
  let a = dados;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { return { erro: 'Esse arquivo não é um mundo da Pradaria.' }; } }
  if (!a || typeof a !== 'object' || a.formato !== FORMATO) return { erro: 'Esse arquivo não é um mundo da Pradaria.' };
  if (!Number.isInteger(a.semente) || a.semente < 0 || a.semente > 4294967295) return { erro: 'O arquivo do mundo está estragado (semente).' };
  if (!Array.isArray(a.edicoes)) return { erro: 'O arquivo do mundo está estragado (blocos).' };
  if (a.edicoes.length > MAX_EDICOES_ARQUIVO) return { erro: 'Esse mundo é grande demais para importar.' };
  const edicoes = [];
  for (const e of a.edicoes) {
    if (!Array.isArray(e) || e.length !== 4 || !e.every(Number.isInteger)) continue;
    const [x, y, z, b] = e;
    if (Math.abs(x) > LONGE || Math.abs(z) > LONGE || y < 1 || y > 95 || b < 0 || b > 255) continue;
    edicoes.push([x, y, z, b]);
  }
  return { nome: typeof a.nome === 'string' ? a.nome : '', semente: a.semente, opcoes: normalizarOpcoes(a.opcoes), edicoes };
}

// nome do arquivo baixado: "pradaria-fazenda-feliz.json"
export const nomeArquivo = (nome) => 'pradaria-' + (String(nome || 'mundo').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mundo') + '.json';

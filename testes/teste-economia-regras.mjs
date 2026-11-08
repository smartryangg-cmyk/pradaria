// Regras do mercado sem navegador: comprar e vender não pode dar lucro, e o extra da sorte só vale em bloco natural.
// Uso: node testes/teste-economia-regras.mjs
import { LOJA, LOTE_LOJA, precoVenda, estadoNovo, aplicar, normalizar } from '../public/js/economia.js';
import { oQueCai, IDS } from '../public/js/receitas.js';
let falhas = 0;
const conferir = (ok, msg) => { console.log((ok ? 'ok   ' : 'FALHA') + ' ' + msg); if (!ok) falhas++; };
for (const { b, preco } of LOJA) conferir(preco >= LOTE_LOJA * precoVenda(b), `bloco ${b}: lote de ${LOTE_LOJA} custa ${preco} e vende por ${LOTE_LOJA * precoVenda(b)}`);
// ciclo comprar + vender com todas as opções ligadas: as moedas nunca sobem
const op = { mercado: true, sobrevivencia: true, maquinas: true };
for (const { b } of LOJA) {
  const e = normalizar({ ...estadoNovo(op), moedas: 100 }, op);
  for (let i = 0; i < 5; i++) { aplicar(e, op, { t: 'comprar', b }); aplicar(e, op, { t: 'vender', b, n: LOTE_LOJA }); }
  conferir(e.moedas <= 100, `comprar e vender o bloco ${b} 5 vezes: ${e.moedas} moedas (começou com 100)`);
}
// folha colocada pelo jogador não dá graveto extra; folha da árvore pode dar
let extraEditado = 0, extraNatural = 0;
for (let x = 0; x < 200; x++) {
  if (oQueCai(IDS.FOLHAS, x, 40, 7, false).length > 1) extraEditado++;
  if (oQueCai(IDS.FOLHAS, x, 40, 7, true).length > 1) extraNatural++;
}
conferir(extraEditado === 0 && extraNatural > 0, `extra só em bloco natural (editado ${extraEditado}, natural ${extraNatural})`);
if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('tudo certo');

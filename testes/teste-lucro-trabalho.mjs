// Regras (sem navegador): nenhum caminho comprar -> converter -> vender dá lucro, nem com padeiro, lojista,
// vitrine, moinho/forno, receitas ou obra do pedreiro cancelada. Lucro só com o que se colhe.
// node testes/teste-lucro-trabalho.mjs
import { estadoNovo, aplicar, LOJA, LOTE_LOJA, normalizar } from '../public/js/economia.js';
import { RECEITAS as receitas } from '../public/js/receitas.js';
import { SEG_DIA_TRABALHO } from '../public/js/trabalho.js';
const falhas = [];
const conferir = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
const op = { mercado: true, sobrevivencia: true, objetivos: false };
const PAD = { x: 0, y: 30, z: 0, r: 0 }, LOJ = { x: 20, y: 30, z: 0, r: 0 };
const pos = (p) => [p.x, p.y, p.z];
function mundoRico() {
  const e = estadoNovo(op); e.moedas = 5000;
  e.neg.padaria = { ...PAD }; e.neg.loja = { ...LOJ };
  aplicar(e, op, { t: 'contratar', of: 'padeiro' }); aplicar(e, op, { t: 'contratar', of: 'lojista' });
  return e;
}
// tenta tudo para transformar as coisas da mochila em moedas
function venderTudo(e) {
  for (let volta = 0; volta < 4; volta++) {
    for (const rc of receitas || []) for (let k = 0; k < 20; k++) if (!aplicar(e, op, { t: 'criar', r: rc.id, bancada: true }).ok) break;
    for (let k = 0; k < 30; k++) { aplicar(e, op, { t: 'moer' }); aplicar(e, op, { t: 'assar' }); }
    for (const b of Object.keys(e.itens)) {
      aplicar(e, op, { t: 'depositar', onde: 'padaria', b: +b, n: 999 }, { pos: pos(PAD) });
      aplicar(e, op, { t: 'depositar', onde: 'loja', b: +b, n: 999 }, { pos: pos(LOJ) });
      aplicar(e, op, { t: 'vender', b: +b, n: 999 });
    }
    // trabalham muitos dias (o padeiro assa, o lojista vende)
    for (let s = 0; s < SEG_DIA_TRABALHO * 3; s += 15) aplicar(e, op, { t: 'turno', dt: 15, hora: 10 });
  }
}
// referência: os mesmos dias de trabalho sem comprar nada
const ref = mundoRico(); const m0 = ref.moedas; venderTudo(ref);
const gastoParado = m0 - ref.moedas;
conferir(gastoParado > 0, `sem nada para vender, a equipe só custa salário (${gastoParado} moedas)`);
for (const { b, preco } of LOJA) {
  const e = mundoRico(); const antes = e.moedas;
  for (let i = 0; i < 10; i++) aplicar(e, op, { t: 'comprar', b });
  venderTudo(e);
  const saldo = e.moedas - antes + gastoParado; // tira o salário que seria pago de qualquer jeito
  conferir(saldo <= 0, `comprar bloco ${b} (${preco} por ${LOTE_LOJA}) e passar por tudo não dá lucro (saldo ${saldo})`);
}
// obra com material comprado pelo pedreiro e cancelada: o material volta marcado, não dá para revender
{
  const e = mundoRico(); const antes = e.moedas;
  const r = aplicar(e, op, { t: 'obra', p: 'casa', e: 'tijolo', x: 40, y: 30, z: 40, r: 0, comprar: true }, { pos: [40, 30, 40] });
  conferir(r.ok, 'pedreiro comprou o material da obra');
  aplicar(e, op, { t: 'cancelar-obra', id: e.obras[0].id });
  conferir(Object.keys(e.compra).length > 0, 'material devolvido ficou marcado como comprado');
  venderTudo(e);
  conferir(e.moedas - antes + gastoParado <= 0, `obra comprada e cancelada não dá lucro (saldo ${e.moedas - antes + gastoParado})`);
  // e a marca sobrevive ao salvar e carregar
  const n = normalizar(JSON.parse(JSON.stringify(e)), op);
  conferir(JSON.stringify(n.compra) === JSON.stringify(e.compra), 'marca de comprado continua depois de salvar');
}
// formas (cerca, vidro fino, meio bloco...): uma receita faz várias, então ninguém compra (nem vila, nem vitrine)
{
  const e = mundoRico();
  e.itens[9] = 5; e.itens[3] = 5; // vidro e pedra feitos/colhidos (não comprados)
  const r1 = aplicar(e, op, { t: 'criar', r: 'vidro-fino', bancada: true });
  const r2 = aplicar(e, op, { t: 'criar', r: 'meio-bloco', bancada: true });
  conferir(r1.ok && r2.ok && e.itens[85] === 4 && e.itens[90] === 2, 'fez 4 vidros finos com 1 vidro e 2 meios blocos com 1 pedra');
  const m = e.moedas;
  const v1 = aplicar(e, op, { t: 'vender', b: 85, n: 4 }), v2 = aplicar(e, op, { t: 'vender', b: 90, n: 2 });
  const d = aplicar(e, op, { t: 'depositar', onde: 'loja', b: 85, n: 4 }, { pos: pos(LOJ) });
  conferir(!v1.ok && !v2.ok && !d.ok && e.moedas === m && e.itens[85] === 4, `formas não são vendidas nem vão para a vitrine (${v1.erro || ''} / ${d.erro || ''})`);
}
// o que se colhe dá lucro de verdade: trigo colhido vira pão e o lojista vende pelo dobro
{
  const e = mundoRico(); const antes = e.moedas;
  e.itens[32] = 60; // trigo colhido
  venderTudo(e);
  conferir(e.moedas - antes + gastoParado > 0, `trigo colhido vira pão e dá lucro (saldo ${e.moedas - antes + gastoParado}, ${e.neg.assados} pães)`);
}
console.log(falhas.length ? `\n${falhas.length} FALHAS` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);

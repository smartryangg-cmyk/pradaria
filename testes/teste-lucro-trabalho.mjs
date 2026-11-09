// Regras (sem navegador): nenhum caminho comprar -> converter -> vender dá lucro, nem com padeiro, lojista,
// vitrine, moinho/forno, receitas ou obra do pedreiro cancelada. Lucro só com o que se colhe.
// node testes/teste-lucro-trabalho.mjs
import { estadoNovo, aplicar, LOJA, LOTE_LOJA, normalizar } from '../public/js/economia.js';
import { RECEITAS as receitas } from '../public/js/receitas.js';
import { SEG_DIA_TRABALHO, livreDe } from '../public/js/trabalho.js';
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
// ---- colocar e quebrar (como a sala faz: o mundo guarda "c:x,y,z" para bloco feito de coisa comprada) ----
function mundoSala() {
  const ed = new Map(), marcas = new Set();
  return {
    ed, marcas,
    // jogador põe (b>0) ou quebra (b=0) com a mão
    mao(e, x, y, z, b) {
      const k = x + ',' + y + ',' + z, de = ed.get(k) || 0, natural = !ed.has(k);
      ed.set(k, b);
      const comprado = !natural && marcas.has(k); marcas.delete(k);
      const r = aplicar(e, op, { t: 'bloco', b, x, y, z, de, natural, comprado });
      if (r.ok && r.marca && b > 0) marcas.add(k);
      return r;
    },
    pedreiro(r) { const m = new Set(r.marcar || []); for (const [x, y, z, b] of r.blocos || []) { const k = x + ',' + y + ',' + z; if (ed.get(k) > 0) continue; ed.set(k, b); if (m.has(k)) marcas.add(k); } },
  };
}
for (const { b } of LOJA) {
  const e = mundoRico(), w = mundoSala(); const antes = e.moedas;
  for (let i = 0; i < 5; i++) aplicar(e, op, { t: 'comprar', b });
  // põe tudo no mundo e quebra de novo (eu mesmo e um amigo)
  const amigo = estadoNovo(op);
  let n = 0;
  while ((e.itens[b] || 0) > 0 && n < 40) { const x = 100 + n++; w.mao(e, x, 30, 0, b); }
  for (let i = 0; i < n; i++) w.mao(i % 2 ? e : amigo, 100 + i, 30, 0, 0);
  venderTudo(e);
  const dele = amigo.moedas; venderTudo(amigo);
  const saldo = e.moedas - antes + gastoParado + (amigo.moedas - dele);
  conferir(saldo <= 0 && !Object.keys(amigo.itens).some((k) => livreDe(amigo, +k) > 0), `bloco ${b} comprado, colocado e quebrado (por mim ou por um amigo) não dá lucro (saldo ${saldo})`);
}
// material comprado que estava na mochila, obra cancelada: volta marcado
{
  const e = mundoRico(); const antes = e.moedas;
  for (let i = 0; i < 40; i++) aplicar(e, op, { t: 'comprar', b: 10 }); // tijolos
  for (let i = 0; i < 40; i++) aplicar(e, op, { t: 'comprar', b: 9 }); // vidro
  aplicar(e, op, { t: 'obra', p: 'casa', e: 'tijolo', x: 40, y: 30, z: 40, r: 0, comprar: true }, { pos: [40, 30, 40], agora: 1 });
  aplicar(e, op, { t: 'cancelar-obra', id: e.obras[0].id });
  conferir([10, 9].every((b) => livreDe(e, b) === 0), 'tijolo e vidro da mochila voltam da obra cancelada ainda marcados');
  venderTudo(e);
  conferir(e.moedas - antes + gastoParado <= 0, `comprar, mandar para a obra e cancelar não dá lucro (saldo ${e.moedas - antes + gastoParado})`);
}
// casa feita pelo pedreiro com material comprado, depois quebrada: o que cai vem marcado
{
  const e = mundoRico(), w = mundoSala(); const antes = e.moedas;
  aplicar(e, op, { t: 'contratar', of: 'pedreiro' });
  aplicar(e, op, { t: 'obra', p: 'casinha', e: 'madeira', x: 60, y: 30, z: 60, r: 0, comprar: true }, { pos: [60, 30, 60], agora: 1 });
  for (let i = 0; i < 400 && e.obras.length; i++) w.pedreiro(aplicar(e, op, { t: 'turno', dt: 15, hora: 10 }));
  conferir(!e.obras.length && w.marcas.size > 50, `casinha pronta, ${w.marcas.size} blocos marcados no mundo`);
  for (const k of [...w.ed.keys()]) { const [x, y, z] = k.split(',').map(Number); if (w.ed.get(k) > 0) w.mao(e, x, y, z, 0); }
  conferir(Object.keys(e.itens).every((k) => livreDe(e, +k) === 0), 'derrubar a casa feita com material comprado só dá coisa marcada');
  venderTudo(e);
  const gastoPedreiro = 12; // o pedreiro também recebe
  conferir(e.moedas - antes + gastoParado + gastoPedreiro <= 0, `material comprado pelo pedreiro e casa derrubada não dá lucro (saldo ${e.moedas - antes + gastoParado + gastoPedreiro})`);
}
// casa feita com material colhido: derrubar devolve material livre (não é castigo)
{
  const e = mundoRico(), w = mundoSala();
  aplicar(e, op, { t: 'contratar', of: 'pedreiro' });
  for (const id of [3, 6, 8, 9, 14, 15, 20, 21]) e.itens[id] = 200; // tudo colhido
  const r = aplicar(e, op, { t: 'obra', p: 'casinha', e: 'madeira', x: 60, y: 30, z: 60, r: 0, comprar: true }, { pos: [60, 30, 60], agora: 1 });
  const semCompra = !e.obras[0].cmp;
  for (let i = 0; i < 400 && e.obras.length; i++) w.pedreiro(aplicar(e, op, { t: 'turno', dt: 15, hora: 10 }));
  conferir(r.ok && semCompra && !e.obras.length && w.marcas.size === 0, `casa de material colhido não fica marcada (${w.marcas.size} marcas)`);
}
// limite de obras por hora
{
  const e = mundoRico(); const t0 = 5e6;
  const pede = (i, t) => aplicar(e, op, { t: 'obra', p: 'casinha', e: 'madeira', x: 200 + i * 20, y: 30, z: 0, r: 0, comprar: true }, { pos: [200 + i * 20, 30, 0], agora: t });
  let ok = 0;
  for (let i = 0; i < 6; i++) { if (pede(i, t0 + i * 1000).ok) ok++; aplicar(e, op, { t: 'cancelar-obra', id: e.obras[e.obras.length - 1]?.id }); }
  conferir(ok === 4, `marcar e cancelar obra sem parar: só 4 por hora (${ok})`);
  conferir(pede(9, t0 + 3600 * 1000 + 1).ok, 'depois de uma hora pode marcar de novo');
}
console.log(falhas.length ? `\n${falhas.length} FALHAS` : '\nTUDO CERTO');
process.exit(falhas.length ? 1 : 0);

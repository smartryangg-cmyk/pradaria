// Regras do mercado sem navegador: comprar e vender não pode dar lucro, e o extra da sorte só vale em bloco natural.
// Uso: node testes/teste-economia-regras.mjs
import { LOJA, LOTE_LOJA, precoVenda, vendivel, estadoNovo, aplicar, normalizar } from '../public/js/economia.js';
import { oQueCai, IDS, RECEITAS } from '../public/js/receitas.js';
import { Chao, MAX_CHAO, MAX_POR_JOGADOR, podePegar, publico, ESPERA_MORTE } from '../public/js/regras-chao.js';
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
// comprar tudo o que a loja vende, moer, assar e vender tudo: nunca dá lucro
for (const { b } of LOJA) {
  const e = normalizar({ ...estadoNovo(op), moedas: 100 }, op);
  for (let i = 0; i < 5; i++) {
    aplicar(e, op, { t: 'comprar', b });
    aplicar(e, op, { t: 'moer' }); aplicar(e, op, { t: 'assar' });
    for (const id of Object.keys(e.itens)) aplicar(e, op, { t: 'vender', b: +id, n: 999 });
  }
  conferir(e.moedas <= 100, `comprar o bloco ${b}, moer, assar e vender 5 vezes: ${e.moedas} moedas (começou com 100)`);
}
// nenhuma receita da bancada dá lucro: o que ela faz nunca vende por mais do que o que ela gasta
for (const r of RECEITAS) {
  const [id, n] = r.faz;
  const sai = vendivel(id) ? precoVenda(id) * n : 0, entra = r.usa.reduce((s, [i, q]) => s + precoVenda(i) * q, 0);
  if (sai > entra) conferir(false, `receita ${r.id}: faz ${n} que vendem por ${sai}, gasta ${entra}`);
}
conferir(true, `${RECEITAS.length} receitas sem lucro (tronco vende por ${precoVenda(IDS.TRONCO)}, tábuas por ${precoVenda(IDS.TABUAS)})`);
// de verdade: 1 tronco vendido direto vale pelo menos as 4 tábuas que ele vira
{
  const e = normalizar({ ...estadoNovo(op), moedas: 0, itens: { [IDS.TRONCO]: 2 } }, op);
  aplicar(e, op, { t: 'vender', b: IDS.TRONCO, n: 1 }); const direto = e.moedas;
  const cr = aplicar(e, op, { t: 'criar', r: 'tabuas' }); conferir(cr.ok && (e.itens[IDS.TABUAS] | 0) === 4, 'tronco vira 4 tábuas'); aplicar(e, op, { t: 'vender', b: IDS.TABUAS, n: 99 });
  conferir(e.moedas - direto <= direto, `tronco vendido: ${direto} moedas; virando tábuas: ${e.moedas - direto}`);
}
// listas da sala (blocos-rede.js) iguais às do jogo (blocos.js, fisica.js, energia.js)
{
  const R = await import('../public/js/blocos-rede.js'), BL = await import('../public/js/blocos.js'), F = await import('../public/js/fisica.js');
  const chao = []; for (let i = 0; i < 256; i++) if (BL.PRECISA_CHAO[i]) chao.push(i);
  conferir(chao.join() === [...R.PRECISA_CHAO].sort((a, b) => a - b).join(), 'PRECISA_CHAO igual ao de blocos.js: ' + chao.join());
  const cai = []; for (let i = 0; i < 256; i++) if (F.CAI[i]) cai.push(i);
  conferir(cai.join() === [...R.CAI].sort((a, b) => a - b).join(), 'CAI igual ao de fisica.js');
  const M = (await import('../public/js/blocos-mecanismos.js')).M, E = BL.E;
  const pares = [[M.PORTA, M.PORTA_ABERTA], [M.FORNO, M.FORNO_ACESO], [E.ALAVANCA, E.ALAVANCA_LIGADA], [E.BOTAO, E.BOTAO_LIGADO], [E.PLACA, E.PLACA_LIGADA]];
  conferir(JSON.stringify(pares) === JSON.stringify(R.PARES_TOQUE), 'pares de toque iguais aos ids de verdade');
  const { mudancaSemMao: sm } = R;
  conferir(sm(M.PORTA, M.PORTA_ABERTA, false) && sm(E.ALAVANCA_LIGADA, E.ALAVANCA, false), 'abrir porta e ligar alavanca valem até sem Construção');
  conferir(!sm(3, 0, true) && !sm(0, 3, true) && !sm(BL.B.TABUAS, 0, true), 'sem a mão: não quebra pedra/tábua nem coloca bloco');
  conferir(!sm(0, 0, false) && !sm(3, 0, false) && !sm(0, 4, false), 'sem Construção: nem a física coloca ou tira blocos');
  conferir(sm(4, 0, true) && sm(0, 4, true) && sm(7, 0, true) && sm(1, 2, true) && sm(12, 0, true), 'areia cai, folha cai, grama vira terra, flor sem chão some');
}
// capim colocado pelo jogador não dá trigo extra; capim do mundo pode dar
// (folha e trigo maduro rendem mesmo editados: nascem crescendo e a sala confere)
let extraEditado = 0, extraNatural = 0;
for (let x = 0; x < 200; x++) {
  if (oQueCai(IDS.CAPIM, x, 40, 7, false).length > 1) extraEditado++;
  if (oQueCai(IDS.CAPIM, x, 40, 7, true).length > 1) extraNatural++;
}
conferir(extraEditado === 0 && extraNatural > 0, `extra só em bloco natural (editado ${extraEditado}, natural ${extraNatural})`);
// a mochila de quem morreu: só ele pega nos primeiros 30 s, depois qualquer um
{
  const c = new Chao(), t0 = Date.now();
  const d = c.novo(6, 1, 0, 40, 0, [0, 0, 0], '', t0, null, 0, '203', null, '203');
  conferir(!podePegar(d, '77-abcde', t0 + 5000) && podePegar(d, '203-abcde', t0 + 5000) && podePegar(d, '77-abcde', t0 + ESPERA_MORTE + 1) && publico(d, t0).res === '203',
    'chão: a mochila de quem morreu é só dele por 30 s');
  conferir(podePegar(d, '203-zzzzz', t0 + 5000), 'chão: recarregou a página (outra conexão, mesma conta) e ainda pega a própria mochila');
  const l = c.novo(6, 1, 0, 40, 0, [0, 0, 0], '', t0);
  conferir(podePegar(l, 'beto', t0 + 1000) && publico(l, t0).res === undefined, 'chão: item comum qualquer um pega');
}
// itens no chão: quem enche o chão perde os próprios itens mais antigos, não os dos outros
{
  const c = new Chao();
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) c.novo(3, 1, i, 40, 0, [0, 0, 0], '', t0 - 1000 + i, null, 0, 'vitima');
  for (let i = 0; i < 300; i++) c.novo(3, 1, i, 40, 9, [0, 0, 0], '', t0 + i, null, 0, 'chato');
  c.limpar(t0 + 400);
  const de = (q) => c.lista().filter((d) => d.q === q).length;
  conferir(de('vitima') === 5 && de('chato') === MAX_POR_JOGADOR, `chão: os 5 da vítima ficam e o chato fica com ${MAX_POR_JOGADOR} (${de('vitima')}, ${de('chato')})`);
  const s = new Chao(); // sem internet (sem q): só o limite do mundo, sai o mais antigo
  for (let i = 0; i < MAX_CHAO + 10; i++) s.novo(3, 1, i, 40, 0, [0, 0, 0], '', t0 + i);
  s.limpar(t0 + 1000);
  conferir(s.itens.size === MAX_CHAO && !s.itens.has(1) && s.itens.has(MAX_CHAO + 10), `chão sem internet: guarda ${MAX_CHAO} e tira os mais antigos`);
}
// ferramenta na mão só vale se estiver na mochila (aparelho modificado dizia ter picareta e tirava vidro inteiro)
{
  const op = { sobrevivencia: true }, e = estadoNovo();
  const vidro = (mao) => aplicar(e, op, { t: 'bloco', b: 0, x: 1, y: 40, z: 1, de: IDS.VIDRO, natural: false, mao }).cai || [];
  conferir(vidro(IDS.PICARETA_MADEIRA).length === 0, 'vidro: picareta inventada (fora da mochila) não tira inteiro');
  e.itens[IDS.PICARETA_MADEIRA] = 1;
  conferir(JSON.stringify(vidro(IDS.PICARETA_MADEIRA).map(([id, n]) => [id, n])) === JSON.stringify([[IDS.VIDRO, 1]]), 'vidro: picareta de verdade tira inteiro');
}
if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('tudo certo');

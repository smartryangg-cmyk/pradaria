// Trabalhadores contratados: pedreiro, padeiro e lojista. Regras puras (sem tela), usadas pelo jogo
// sem internet e pela sala online (é ela quem decide online). Chamado por economia.js (aplicar).
//
// Como funciona:
//  - Contratar custa o primeiro dia de salário adiantado. Depois o salário vai sendo cobrado aos poucos,
//    por tempo trabalhado (só no horário de trabalho, das 7h às 18h do jogo).
//  - Sem moedas para pagar, o trabalhador para. Um dia inteiro sem receber e ele pede as contas.
//  - O jogo manda um "turno" a cada poucos segundos enquanto você está no mundo; a sala mede o tempo
//    pelo relógio dela. Os trabalhadores só trabalham enquanto você está no mundo.
//  - Pedreiro: constrói as obras encomendadas (plantas de casas.js), bloco a bloco. Quem coloca os
//    blocos é a sala (online) ou o próprio jogo (sem internet), então todo mundo vê a casa subindo.
//  - Padeiro: na padaria (construída pelo pedreiro), transforma trigo em pão (2 trigo -> 1 pão).
//  - Lojista: na loja, vende para os moradores o que você deixou na vitrine (e leva o pão da padaria
//    para a vitrine). O dinheiro das vendas vai para as suas moedas.
import { PLANTAS, ESTILOS_OBRA, blocosDaObra, materiais, alturaDaPlanta, areaDaObra } from './casas.js';

export const TRIGO = 32, FARINHA = 57, PAO = 58;

export const OFICIOS = {
  pedreiro: { nome: 'Pedreiro', ic: 'martelo', salario: 12, max: 3, desc: 'Constrói casas, padaria e loja a partir de uma planta' },
  padeiro: { nome: 'Padeiro', ic: 'pao', salario: 8, max: 2, desc: 'Faz pão com o trigo que você deixa na padaria', precisa: 'padaria' },
  lojista: { nome: 'Lojista', ic: 'moeda', salario: 8, max: 2, desc: 'Vende o que você deixa na vitrine da loja', precisa: 'loja' },
};
export const MAX_EQUIPE = 6;
export const MAX_OBRAS = 3;
export const PRECO_MATERIAL = 3; // moedas por bloco de material que o pedreiro compra (mais que o preço de venda: não dá lucro)

// horário de trabalho (horas do jogo). tempoDia 0..1: 0 = 6h, 0.25 = meio-dia, 0.5 = 18h
export const HORA_INI = 7, HORA_FIM = 18;
export const horaDe = (dia) => ((dia * 24 + 6) % 24 + 24) % 24;
export const noHorario = (hora) => hora >= HORA_INI && hora < HORA_FIM;
// um dia de trabalho, em segundos de verdade (o dia do jogo dura 600 s)
export const SEG_DIA_TRABALHO = (HORA_FIM - HORA_INI) / 24 * 600;

export const SEG_POR_BLOCO = 0.6; // o pedreiro coloca um bloco a cada 0,6 s
export const SEG_POR_PAO = 15; // o padeiro assa um pão a cada 15 s (gasta 2 trigos)
export const TRIGO_POR_PAO = 2;
export const SEG_POR_VENDA = 10; // o lojista vende uma coisa a cada 10 s
export const MAX_ESTOQUE = 999;
export const MAX_TURNO = 15; // um turno conta no máximo 15 s (quem saiu e voltou não ganha o tempo de fora)

const NOMES = ['Seu Tonho', 'Dona Rita', 'Zé Pedreiro', 'Mestre Bené', 'Dona Lurdinha', 'Seu Juca', 'Tia Nena', 'Seu Quim',
  'Dona Sônia', 'Biu', 'Dona Fia', 'Seu Valdo', 'Cidinha', 'Seu Nino', 'Dona Zezé', 'Tião'];

export function negocioNovo() { return { padaria: null, loja: null, trigo: 0, farinha: 0, pao: 0, vitrine: {}, vendas: 0, ganho: 0, assados: 0 }; }

const intOk = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
const posOk = (p) => p && intOk(p.x, -1e5, 1e5) && intOk(p.y, 1, 95) && intOk(p.z, -1e5, 1e5) && intOk(p.r, 0, 3);

// confere/repara o que veio salvo
export function normalizarTrabalho(e, s) {
  e.equipe = [];
  for (const t of Array.isArray(s.equipe) ? s.equipe.slice(0, MAX_EQUIPE) : []) {
    if (!t || !OFICIOS[t.of]) continue;
    e.equipe.push({
      id: String(t.id || '').slice(0, 12) || 't' + e.equipe.length, of: t.of, nome: String(t.nome || OFICIOS[t.of].nome).slice(0, 24),
      sal: OFICIOS[t.of].salario, deve: Number.isFinite(t.deve) ? Math.max(-OFICIOS[t.of].salario, Math.min(99, t.deve)) : 0,
      semPagar: Number.isFinite(t.semPagar) ? Math.max(0, t.semPagar) : 0, cor: t.cor | 0, feito: Math.max(0, t.feito | 0),
      t: Number.isFinite(t.t) ? Math.max(0, Math.min(60, t.t)) : 0, // tempo trabalhado que ainda não virou nada
    });
  }
  const n = negocioNovo(), sn = s.neg && typeof s.neg === 'object' ? s.neg : {};
  for (const k of ['padaria', 'loja']) if (posOk(sn[k])) n[k] = { x: sn[k].x, y: sn[k].y, z: sn[k].z, r: sn[k].r };
  for (const k of ['trigo', 'farinha', 'pao']) n[k] = Math.max(0, Math.min(MAX_ESTOQUE, sn[k] | 0));
  for (const k of ['vendas', 'ganho', 'assados']) n[k] = Math.max(0, sn[k] | 0);
  for (const [k, v] of Object.entries(sn.vitrine || {})) if (intOk(+k, 1, 1200) && v > 0) n.vitrine[k] = Math.min(MAX_ESTOQUE, v | 0);
  e.neg = n;
  e.obras = [];
  for (const o of Array.isArray(s.obras) ? s.obras.slice(0, MAX_OBRAS) : []) {
    if (!o || !PLANTAS[o.p] || !ESTILOS_OBRA[o.e] || !posOk(o)) continue;
    const q = { id: String(o.id || '').slice(0, 12), p: o.p, e: o.e, v: o.v ? 1 : 0, x: o.x, y: o.y, z: o.z, r: o.r, i: Math.max(0, o.i | 0) };
    if (o.pago > 0) q.pago = o.pago | 0;
    if (o.cmp && typeof o.cmp === 'object') {
      q.cmp = {};
      for (const [k, v] of Object.entries(o.cmp)) if (intOk(+k, 1, 1200) && v > 0) q.cmp[k] = Math.min(9999, v | 0);
    }
    e.obras.push(q);
  }
  e.tseq = Math.max(0, s.tseq | 0);
  e.compra = {};
  for (const [k, v] of Object.entries(s.compra && typeof s.compra === 'object' ? s.compra : {})) if (intOk(+k, 1, 1200) && v > 0) e.compra[k] = v | 0;
  if (e.itens) ajustarCompra(e);
}

// Nada de lucro com coisa comprada: o que veio da loja da vila (ou o pedreiro comprou) fica marcado em
// e.compra[id]. Isso não vai para a vitrine, nem para a padaria, nem os moradores compram de volta; e o que
// sai de uma receita feita com coisa comprada também fica marcado. Lucro só com o que você colheu.
// (Quando a mochila gasta um item, a parte comprada é a última a sair: a marca nunca some à toa.)
export const livreDe = (e, b) => Math.max(0, (e.itens[b] || 0) - ((e.compra && e.compra[b]) || 0));
export function marcarCompra(e, b, n) { if (n > 0) e.compra[b] = (e.compra[b] || 0) + n; }
export function ajustarCompra(e) {
  for (const k of Object.keys(e.compra)) {
    const v = Math.min(e.compra[k] | 0, e.itens[k] | 0);
    if (v > 0) e.compra[k] = v; else delete e.compra[k];
  }
}
// roda uma conversão (receita, moinho, forno): se gastou coisa comprada, o que saiu também fica marcado
export function converter(e, fn) {
  const antes = { ...e.itens }, livre = {};
  for (const k of Object.keys(antes)) livre[k] = livreDe(e, +k);
  const r = fn();
  let usouComprado = false;
  for (const [k, v] of Object.entries(antes)) {
    const gasto = v - (e.itens[k] || 0);
    if (gasto > 0 && gasto > livre[k]) usouComprado = true;
  }
  if (usouComprado) for (const [k, v] of Object.entries(e.itens)) if (v > (antes[k] || 0)) marcarCompra(e, +k, v - (antes[k] || 0));
  ajustarCompra(e);
  return r;
}

// quanto falta de cada material (no "Coletar e criar"): [[id, falta], ...]
export function faltaPara(itens, mats) {
  const f = [];
  for (const [id, n] of Object.entries(mats)) if ((itens[id] || 0) < n) f.push([+id, n - (itens[id] || 0)]);
  return f;
}

// cabe a obra aqui? (altura do mundo e não encostar em outra obra)
export function obraCabe(e, o) {
  const h = alturaDaPlanta(o.p);
  if (o.y < 2 || o.y + h > 94) return 'Aqui não dá: alto ou baixo demais.';
  const a = areaDaObra(o);
  for (const q of e.obras) {
    const b = areaDaObra(q);
    if (a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]) return 'Já tem uma obra aqui.';
  }
  return null;
}

// a ação de trabalho (economia.js chama). Devolve null se não é de trabalho; senão { erro } ou { ok, blocos?, msgs? }
// ctx: { por(itens,id,n), tirar(itens,id,n), guardavel(id), vendivel(id), precoLoja(id), MAX_MOEDAS, pos: [x,y,z] onde o jogador está }
const PERTO = 12;
export const pertoDe = (pos, p) => !!(pos && p && Math.abs(pos[0] - p.x) <= PERTO && Math.abs(pos[2] - p.z) <= PERTO && Math.abs(pos[1] - p.y) <= 10);
export function aplicarTrabalho(e, op, a, ctx) {
  const t = a.t;
  if (!['contratar', 'demitir', 'obra', 'cancelar-obra', 'turno', 'depositar', 'retirar'].includes(t)) return null;
  if (!op.mercado) return { erro: 'Ligue o Mercado nas opções do mundo para contratar.' };
  const so = op.sobrevivencia;

  if (t === 'contratar') {
    const of = OFICIOS[a.of];
    if (!of) return { erro: '?' };
    if (e.equipe.length >= MAX_EQUIPE) return { erro: `Sua equipe já tem ${MAX_EQUIPE} pessoas.` };
    if (e.equipe.filter((x) => x.of === a.of).length >= of.max) return { erro: `Você já tem ${of.max} ${of.nome.toLowerCase()}s.` };
    if (e.moedas < of.salario) return { erro: `Faltam ${of.salario - e.moedas} moedas para o primeiro dia de salário.` };
    e.moedas -= of.salario;
    e.tseq = (e.tseq || 0) + 1;
    const nome = typeof a.nome === 'string' && /^[\p{L} .'-]{2,24}$/u.test(a.nome) ? a.nome : NOMES[e.tseq % NOMES.length];
    e.equipe.push({ id: 't' + e.tseq, of: a.of, nome, sal: of.salario, deve: -of.salario, semPagar: 0, cor: e.tseq, feito: 0 });
    return { ok: true, msgs: [`${nome} agora é seu ${of.nome.toLowerCase()}! Trabalha das ${HORA_INI}h às ${HORA_FIM}h.`] };
  }

  if (t === 'demitir') {
    const i = e.equipe.findIndex((x) => x.id === a.id);
    if (i < 0) return { erro: '?' };
    const [x] = e.equipe.splice(i, 1);
    // acerta o que ficou devendo (até onde der)
    const conta = Math.max(0, Math.min(e.moedas, Math.floor(x.deve)));
    e.moedas -= conta;
    return { ok: true, msgs: [`${x.nome} foi embora. Obrigado pelo trabalho!`] };
  }

  if (t === 'obra') {
    if (!PLANTAS[a.p] || !ESTILOS_OBRA[a.e] || !posOk(a)) return { erro: '?' };
    if (!pertoDe(ctx.pos, a)) return { erro: 'Chegue mais perto do lugar da obra.' };
    if (e.obras.length >= MAX_OBRAS) return { erro: `Já tem ${MAX_OBRAS} obras esperando.` };
    if (PLANTAS[a.p].negocio && (e.neg[PLANTAS[a.p].negocio] || e.obras.some((o) => o.p === a.p))) return { erro: `Você já tem uma ${PLANTAS[a.p].nome.toLowerCase()}.` };
    e.tseq = (e.tseq || 0) + 1;
    const o = { id: 'o' + e.tseq, p: a.p, e: a.e, v: a.v ? 1 : 0, x: a.x, y: a.y, z: a.z, r: a.r, i: 0 };
    const nao = obraCabe(e, o);
    if (nao) return { erro: nao };
    if (so) {
      // no "Coletar e criar" o material sai da mochila; o que faltar o pedreiro pode comprar (PRECO_MATERIAL cada)
      const mats = materiais(blocosDaObra(o));
      const falta = faltaPara(e.itens, mats);
      const custo = falta.reduce((s, [, n]) => s + n * PRECO_MATERIAL, 0);
      if (falta.length && !a.comprar) return { erro: 'Faltam materiais para essa obra.', falta, custo };
      if (custo > e.moedas) return { erro: `Faltam ${custo - e.moedas} moedas para comprar o material.`, falta, custo };
      e.moedas -= custo;
      for (const [id, n] of Object.entries(mats)) ctx.tirar(e.itens, +id, Math.min(n, e.itens[id] || 0));
      o.pago = custo;
      if (falta.length) o.cmp = Object.fromEntries(falta);
    }
    e.obras.push(o);
    const tem = e.equipe.some((x) => x.of === 'pedreiro');
    return { ok: true, msgs: [tem ? `Obra marcada: ${PLANTAS[a.p].nome}. O pedreiro já vai começar!` : `Obra marcada: ${PLANTAS[a.p].nome}. Contrate um pedreiro para construir.`] };
  }

  if (t === 'cancelar-obra') {
    const i = e.obras.findIndex((o) => o.id === a.id);
    if (i < 0) return { erro: '?' };
    const [o] = e.obras.splice(i, 1);
    // devolve o material que ainda não foi usado
    // (o que o pedreiro comprou volta marcado como comprado: não dá para revender)
    if (so) for (const [id, n] of Object.entries(materiais(blocosDaObra(o), o.i))) {
      ctx.por(e.itens, +id, n);
      marcarCompra(e, +id, Math.min(n, (o.cmp && o.cmp[id]) || 0));
    }
    return { ok: true, msgs: ['Obra cancelada. O material que sobrou voltou para a mochila.'] };
  }

  if (t === 'depositar' || t === 'retirar') {
    const onde = a.onde === 'padaria' ? 'padaria' : a.onde === 'loja' ? 'loja' : null;
    if (!onde || !e.neg[onde]) return { erro: '?' };
    if (!pertoDe(ctx.pos, e.neg[onde])) return { erro: `Vá até a sua ${onde} para fazer isso.` };
    const b = a.b | 0, n = Math.max(1, Math.min(MAX_ESTOQUE, a.n | 0));
    const N = e.neg;
    if (onde === 'padaria') {
      const k = b === TRIGO ? 'trigo' : b === FARINHA ? 'farinha' : b === PAO ? 'pao' : null;
      if (!k) return { erro: 'A padaria só guarda trigo, farinha e pão.' };
      if (t === 'depositar') {
        if (k === 'pao') return { erro: 'Pão vai para a vitrine da loja.' };
        const m = Math.min(n, livreDe(e, b), MAX_ESTOQUE - N[k]);
        if (m <= 0) return { erro: e.itens[b] ? 'O padeiro só usa trigo que você colheu (não o comprado na loja).' : 'Você não tem isso na mochila.' };
        ctx.tirar(e.itens, b, m); N[k] += m;
      } else {
        const m = Math.min(n, N[k]);
        if (m <= 0) return { erro: 'Não tem isso na padaria.' };
        N[k] -= m; ctx.por(e.itens, b, m);
      }
    } else {
      if (!ctx.guardavel(b)) return { erro: '?' };
      if (t === 'depositar') {
        if (ctx.vendivel && !ctx.vendivel(b)) return { erro: 'Formas não vão para a vitrine: elas são para construir.' };
        const m = Math.min(n, livreDe(e, b), MAX_ESTOQUE - (N.vitrine[b] || 0));
        if (m <= 0) return { erro: e.itens[b] ? 'Revender o que você comprou não vale: a vitrine é para o que você colheu ou fez.' : 'Você não tem isso na mochila.' };
        ctx.tirar(e.itens, b, m); N.vitrine[b] = (N.vitrine[b] || 0) + m;
      } else {
        const m = Math.min(n, N.vitrine[b] || 0);
        if (m <= 0) return { erro: 'Não tem isso na vitrine.' };
        N.vitrine[b] -= m; if (!N.vitrine[b]) delete N.vitrine[b];
        ctx.por(e.itens, b, m);
      }
    }
    return { ok: true };
  }

  // turno: o tempo passou (dt segundos) e é tal hora do dia
  const dt = Math.max(0, Math.min(MAX_TURNO, Number(a.dt) || 0));
  if (!e.equipe.length || !dt) return { ok: true, quieto: true };
  if (!noHorario(Number(a.hora))) return { ok: true, quieto: true };
  const r = { ok: true, blocos: [], msgs: [], vendas: 0, paes: 0 };
  const N = e.neg;
  for (const x of [...e.equipe]) {
    // salário: vai sendo cobrado por tempo trabalhado
    x.deve += x.sal * dt / SEG_DIA_TRABALHO;
    while (x.deve >= 1 && e.moedas >= 1) { e.moedas -= 1; x.deve -= 1; }
    if (x.deve >= 1) {
      x.semPagar += dt;
      if (x.semPagar >= SEG_DIA_TRABALHO) {
        e.equipe.splice(e.equipe.indexOf(x), 1);
        r.msgs.push(`${x.nome} pediu as contas: ficou um dia sem receber.`);
      }
      continue; // sem salário, não trabalha
    }
    x.semPagar = 0;
    x.t = (x.t || 0) + dt; // tempo de trabalho ainda não usado (o que sobra fica para o próximo turno)
    if (x.of === 'pedreiro') {
      const o = e.obras[0];
      if (!o) { x.t = 0; continue; }
      const lista = blocosDaObra(o);
      // limpar o terreno é rapidinho; cada bloco de verdade leva SEG_POR_BLOCO
      while (o.i < lista.length && (x.t >= SEG_POR_BLOCO || !lista[o.i][3])) {
        const c = lista[o.i++];
        r.blocos.push(c);
        if (c[3]) { x.t -= SEG_POR_BLOCO; x.feito++; }
      }
      if (o.i >= lista.length) {
        e.obras.shift();
        const neg = PLANTAS[o.p].negocio;
        if (neg) N[neg] = { x: o.x, y: o.y, z: o.z, r: o.r };
        r.msgs.push(`${x.nome} terminou: ${PLANTAS[o.p].nome}!` + (neg ? ` Agora você pode contratar ${neg === 'padaria' ? 'um padeiro' : 'um lojista'}.` : ''));
        x.t = 0;
      }
    } else if (x.of === 'padeiro') {
      if (!N.padaria) { x.t = 0; continue; }
      while (x.t >= SEG_POR_PAO) {
        // farinha pronta vira pão direto; senão mói 2 trigos
        if (N.farinha >= 1) N.farinha--;
        else if (N.trigo >= TRIGO_POR_PAO) N.trigo -= TRIGO_POR_PAO;
        else { x.t = 0; break; }
        if (N.pao >= MAX_ESTOQUE) { x.t = 0; break; }
        N.pao++; N.assados++; x.feito++; r.paes++;
        x.t -= SEG_POR_PAO;
      }
    } else if (x.of === 'lojista') {
      if (!N.loja) { x.t = 0; continue; }
      // leva o pão da padaria para a vitrine
      if (N.pao > 0) { N.vitrine[PAO] = Math.min(MAX_ESTOQUE, (N.vitrine[PAO] || 0) + N.pao); N.pao = 0; }
      while (x.t >= SEG_POR_VENDA) {
        const ids = Object.keys(N.vitrine).map(Number).filter((b) => N.vitrine[b] > 0);
        if (!ids.length) { x.t = 0; break; }
        // vende primeiro o que dá mais lucro
        ids.sort((p, q) => ctx.precoLoja(q) - ctx.precoLoja(p));
        const b = ids[0], p = ctx.precoLoja(b);
        N.vitrine[b]--; if (!N.vitrine[b]) delete N.vitrine[b];
        e.moedas = Math.min(ctx.MAX_MOEDAS, e.moedas + p);
        N.vendas++; N.ganho += p; x.feito++; r.vendas += p;
        x.t -= SEG_POR_VENDA;
      }
    }
  }
  return r;
}

// o que cada trabalhador está fazendo agora (para a tela)
export function situacao(e, x, hora) {
  if (!noHorario(hora)) return { txt: 'Descansando (trabalha das 7h às 18h)', ic: 'lua', ativo: false };
  if (x.deve >= 1) return { txt: 'Parado: sem moedas para o salário', ic: 'moeda', ativo: false };
  if (x.of === 'pedreiro') {
    const o = e.obras[0];
    if (!o) return { txt: 'Esperando uma obra', ic: 'martelo', ativo: false };
    const tot = blocosDaObra(o).length;
    return { txt: `Construindo ${PLANTAS[o.p].nome} (${Math.floor(100 * o.i / tot)}%)`, ic: 'martelo', ativo: true, obra: o };
  }
  if (x.of === 'padeiro') {
    if (!e.neg.padaria) return { txt: 'Precisa de uma padaria (peça ao pedreiro)', ic: 'pao', ativo: false };
    if (e.neg.trigo < TRIGO_POR_PAO && !e.neg.farinha) return { txt: 'Sem trigo! Deixe trigo na padaria', ic: 'pao', ativo: false };
    return { txt: 'Assando pão', ic: 'pao', ativo: true };
  }
  if (!e.neg.loja) return { txt: 'Precisa de uma loja (peça ao pedreiro)', ic: 'moeda', ativo: false };
  if (!Object.keys(e.neg.vitrine).length && !e.neg.pao) return { txt: 'Vitrine vazia! Deixe coisas para vender', ic: 'moeda', ativo: false };
  return { txt: 'Vendendo na loja', ic: 'moeda', ativo: true };
}

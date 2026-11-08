// Mercado e objetivos: regras puras (sem tela), usadas pelo jogo sem internet e pela sala online.
// A sala online roda estas mesmas regras e é ela quem decide as moedas de cada jogador.
// Não importe nada daqui que dependa do navegador (o servidor também usa este arquivo).

import { aplicarTrabalho, normalizarTrabalho, negocioNovo, livreDe, marcarCompra, ajustarCompra, converter } from './trabalho.js';
import { guardavel, oQueCai, lugarVazio, gastoDe, receita, criarEm, faltaBancada, temTudo, por, tirar, qtdEm } from './receitas.js';

// ids dos blocos (iguais aos de blocos.js)
const G = 1, TE = 2, PE = 3, AR_ = 4, AG = 5, TR = 6, FO = 7, TA = 8, VI = 9, TJ = 10, FV = 11, FA = 12, CA = 13,
  LB = 14, LV = 15, LZ = 16, LM = 17, LG = 18, LR = 19, PD = 20, LP = 21, FZ = 22, TAR = 31, TRI = 32, FE = 33;
// farinha e pão (blocos-mecanismos.js): saem do moinho de vento e do forno
const FAR = 57, PAO = 58;

// blocos que todo mundo já tem desde o começo (os outros se compram na loja da vila)
export const LIVRES = new Set([G, TE, PE, AR_, AG, TR, FO, TA, FV, FA, CA, PD]);

// loja: preço para liberar o bloco para sempre neste mundo
export const LOJA = [
  [TJ, 12], [VI, 15], [LP, 20], [FE, 8], [TAR, 6], [TRI, 6], [FZ, 10],
  [LB, 8], [LV, 10], [LZ, 10], [LM, 10], [LG, 10], [LR, 10],
].map(([b, preco]) => ({ b, preco }));
const PRECO_LOJA = new Map(LOJA.map((x) => [x.b, x.preco]));

// quanto os aldeões pagam por cada coisa coletada (o que não está aqui vale 1)
const VENDA = { [TR]: 2, 80: 2, 81: 2, 82: 2, [FV]: 3, [FA]: 3, [FZ]: 3, [TRI]: 3, [FE]: 3, [LP]: 4, [VI]: 2, [TJ]: 2, [FAR]: 5, [PAO]: 9 };
export const precoVenda = (b) => VENDA[b] || 1;
// formas feitas na bancada (83..99: coluna, cerca, bola, rampa...) são para construir: ninguém compra.
// Uma receita faz várias de uma vez (1 vidro = 4 vidros finos), então vender dava mais moedas que a matéria-prima.
export const vendivel = (b) => !(b >= 83 && b <= 99);
// na loja do jogador (o lojista vende para os moradores) tudo sai pelo dobro
export const precoLoja = (b) => Math.max(2, precoVenda(b) * 2);
// só dá para coletar blocos de verdade (nada de água, ar ou ids estranhos)
export const coletavel = (b) => Number.isInteger(b) && b > 0 && b !== AG && (b <= 22 || (b >= 31 && b <= 33) || b === FAR || b === PAO || (b >= 80 && b <= 82)); // 80..82: troncos redondos das árvores
// quanto o moinho mói (e o forno assa) de uma vez
export const LOTE = 10;

// objetivos, na ordem em que aparecem (ic = nome do ícone em icones.js). "conta" é o contador que faz andar a barrinha.
// premio = moedas (com mercado) ou estrelas (sem mercado). "mercado: true" = só aparece com o mercado ligado.
export const OBJETIVOS = [
  { id: 'colocar10', constroi: true, ic: 'tijolos', txt: 'Coloque 10 blocos', conta: 'colocar', meta: 10, premio: 5 },
  { id: 'carinho3', ic: 'ovelha', txt: 'Faça carinho em 3 bichinhos', conta: 'carinho', meta: 3, premio: 5 },
  { id: 'conversa1', ic: 'pessoa', txt: 'Converse com um aldeão', conta: 'conversa', meta: 1, premio: 5 },
  { id: 'quebrar10', constroi: true, ic: 'bloco', txt: 'Quebre 10 blocos', conta: 'quebrar', meta: 10, premio: 5 },
  { id: 'vender5', constroi: true, ic: 'moeda', txt: 'Venda 5 coisas para um aldeão', conta: 'vender', meta: 5, premio: 5, mercado: true },
  { id: 'voar1', voa: true, ic: 'voar', txt: 'Voe bem alto', conta: 'voar', meta: 1, premio: 5 },
  { id: 'flores5', constroi: true, ic: 'flor', txt: 'Plante 5 flores', conta: 'flor', meta: 5, premio: 8 },
  { id: 'comprar1', constroi: true, ic: 'chave', txt: 'Compre um bloco novo na loja', conta: 'comprar', meta: 1, premio: 8, mercado: true },
  { id: 'andar300', ic: 'mapa', txt: 'Ande 300 passos explorando', conta: 'andar', meta: 300, premio: 8 },
  { id: 'carinho10', ic: 'coracao', txt: 'Faça carinho em 10 bichinhos', conta: 'carinho', meta: 10, premio: 10 },
  { id: 'colocar100', constroi: true, ic: 'casa', txt: 'Construa com 100 blocos', conta: 'colocar', meta: 100, premio: 15 },
  { id: 'conversa5', ic: 'vila', txt: 'Converse com 5 aldeões', conta: 'conversa', meta: 5, premio: 10 },
  { id: 'alto1', constroi: true, ic: 'montanha', txt: 'Coloque um bloco lá no alto (altura 50)', conta: 'alto', meta: 1, premio: 10 },
  { id: 'agua1', constroi: true, ic: 'gota', txt: 'Faça uma fonte de água', conta: 'agua', meta: 1, premio: 8 },
  { id: 'emote3', ic: 'sorriso', txt: 'Mande 3 emotes', conta: 'emote', meta: 3, premio: 5 },
  { id: 'vender50', constroi: true, ic: 'diamante', txt: 'Venda 50 coisas', conta: 'vender', meta: 50, premio: 20, mercado: true },
  { id: 'flores30', constroi: true, ic: 'broto', txt: 'Faça um jardim com 30 flores', conta: 'flor', meta: 30, premio: 20 },
  { id: 'andar2000', ic: 'bussola', txt: 'Ande 2000 passos pelo mundo', conta: 'andar', meta: 2000, premio: 25 },
  { id: 'comprar5', ic: 'chave', txt: 'Compre 5 blocos novos', conta: 'comprar', meta: 5, premio: 25, mercado: true },
  { id: 'colocar500', ic: 'castelo', txt: 'Construa com 500 blocos', conta: 'colocar', meta: 500, premio: 40 },
  { id: 'carinho30', ic: 'coracao', txt: 'Faça carinho em 30 bichinhos', conta: 'carinho', meta: 30, premio: 30 },
  { id: 'moer1', ic: 'milho', txt: 'Moa trigo no moinho de vento', conta: 'moer', meta: 1, premio: 10, mercado: true },
  { id: 'assar5', ic: 'pao', txt: 'Asse 5 pães no forno', conta: 'assar', meta: 5, premio: 15, mercado: true },
];
export const ATIVOS = 3; // quantos objetivos aparecem por vez

// eventos que o jogador pode contar (com o máximo aceito de uma vez)
export const EVENTOS = { carinho: 1, conversa: 1, voar: 1, emote: 1, andar: 80, la: 1 };
const MAX_ITEM = 9999, MAX_MOEDAS = 999999;

// ---------- veículos (só valem com a opção Veículos ligada no mundo) ----------
// tipos iguais aos de veiculos.js (ORDEM). Livres: já vêm com todo mundo.
export const VEICULOS_LIVRES = ['bicicleta', 'skate'];
export const PRECO_VEICULO = {
  carro: 40, jipe: 50, esportivo: 70, quadriciclo: 35, moto: 30, bicicleta: 0, skate: 0,
  trator: 45, caminhao: 70, onibus: 80, barco: 40, submarino: 90, aviao: 120, helicoptero: 110,
};
// montar com o que se coletou pelo mundo (o "crafting" dos veículos): { bloco: quantidade }
export const RECEITA_VEICULO = {
  carro: { [TR]: 10, [PE]: 20, [AR_]: 6 },
  jipe: { [TR]: 14, [PE]: 20, [AR_]: 6 },
  esportivo: { [TR]: 6, [PE]: 30, [AR_]: 12 },
  quadriciclo: { [TR]: 8, [PE]: 14 },
  moto: { [TR]: 6, [PE]: 12 },
  trator: { [TR]: 12, [PE]: 18, [G]: 6 },
  caminhao: { [TR]: 16, [PE]: 30 },
  onibus: { [TR]: 16, [PE]: 36, [AR_]: 12 },
  barco: { [TR]: 20, [FO]: 6 },
  submarino: { [TR]: 6, [PE]: 30, [AR_]: 16 },
  aviao: { [TR]: 20, [PE]: 30, [AR_]: 10 },
  helicoptero: { [TR]: 12, [PE]: 36, [AR_]: 10 },
};
// serviços no posto: preço do tanque cheio (ou da bateria) e do conserto completo
export const SERVICO = { comb: 6, conserto: 12 };
export const precoServico = (k, falta) => Math.max(1, Math.ceil(SERVICO[k] * Math.max(0, Math.min(1, falta))));
// chave do veículo: bicicleta e skate todo mundo tem; os outros se pegam na garagem (posto) de uma vila:
// de graça sem o mercado, comprando ou montando com o mercado ligado
export const temVeiculo = (e, tipo) => VEICULOS_LIVRES.includes(tipo) || !!(e && (e.veiculos || []).includes(tipo));
// estado guardado na garagem de cada jogador: { tipo: [combustível 0..1, dano 0..1, quando guardou (ms)] }
const estadoVeic = (x) => Array.isArray(x) && x.length >= 2 ? [Math.max(0, Math.min(1, +x[0] || 0)), Math.max(0, Math.min(1, +x[1] || 0)), Math.max(0, +x[2] || 0)] : null;
// na garagem o mecânico abastece e conserta aos poucos: 10% por minuto guardado
export const OFICINA_POR_MS = 0.1 / 60000;
export function estadoDaGaragem(e, tipo, agora) {
  const g = e && e.garagem && e.garagem[tipo];
  if (!g) return [1, 0];
  const k = Math.max(0, agora - (g[2] || 0)) * OFICINA_POR_MS;
  return [Math.min(1, g[0] + k), Math.max(0, g[1] - k)];
}


// sobrevivencia = "Coletar e criar": a mochila (itens) é o que o jogador tem para construir (veja receitas.js)
export function opcoesEcon(op) {
  op = op || {};
  // sem construção (ou com armas, que não deixam voar) as missões impossíveis ficam de fora
  return { mercado: !!op.mercado, objetivos: !!op.objetivos, sobrevivencia: !!op.sobrevivencia, construcao: op.construcao !== false, voo: !op.armas };
}
export const econLigada = (op) => !!(op && (op.mercado || op.objetivos || op.sobrevivencia));
// no "Coletar e criar", comprar na loja traz este tanto do bloco (e dá para comprar de novo)
export const LOTE_LOJA = 4;

export function estadoNovo(op) {
  // equipe/neg/obras: trabalhadores contratados, padaria e loja do jogador, obras do pedreiro (trabalho.js)
  return { moedas: op && op.mercado ? 10 : 0, estrelas: 0, itens: {}, comprados: [], cont: {}, feitos: [], equipe: [], neg: negocioNovo(), obras: [], tseq: 0, compra: {}, mc: [], obrasT: [], veiculos: [], garagem: {} };
}

// confere/repara um estado salvo (vindo do armazenamento)
export function normalizar(e, op) {
  const n = estadoNovo(op);
  if (!e || typeof e !== 'object') return n;
  n.moedas = Math.max(0, Math.min(MAX_MOEDAS, e.moedas | 0));
  n.estrelas = Math.max(0, e.estrelas | 0);
  for (const [k, v] of Object.entries(e.itens || {})) if (guardavel(+k) && v > 0) n.itens[k] = Math.min(MAX_ITEM, v | 0);
  n.comprados = (e.comprados || []).filter((b) => PRECO_LOJA.has(b));
  for (const [k, v] of Object.entries(e.cont || {})) if (typeof v === 'number') n.cont[k] = v;
  n.feitos = (e.feitos || []).filter((id) => OBJETIVOS.some((o) => o.id === id));
  n.veiculos = [...new Set((Array.isArray(e.veiculos) ? e.veiculos : []).filter((t) => t in PRECO_VEICULO))];
  for (const [t, x] of Object.entries(e.garagem && typeof e.garagem === 'object' ? e.garagem : {})) { const q = estadoVeic(x); if (t in PRECO_VEICULO && q) n.garagem[t] = q; }
  normalizarTrabalho(n, e);
  return n;
}

export const liberado = (e, b, op) => !op.mercado || op.sobrevivencia || LIVRES.has(b) || !PRECO_LOJA.has(b) || e.comprados.includes(b);

export function objetivosDoMundo(op) { return op.objetivos ? OBJETIVOS.filter((o) => (!o.mercado || op.mercado) && (!o.constroi || op.construcao !== false) && (!o.voa || op.voo !== false)) : []; }

export function objetivosAtivos(e, op) {
  return objetivosDoMundo(op).filter((o) => !e.feitos.includes(o.id)).slice(0, ATIVOS);
}

// soma num contador e entrega os objetivos que ficaram prontos. Devolve a lista dos que completou.
function contar(e, op, k, n) {
  e.cont[k] = (e.cont[k] || 0) + n;
  const prontos = [];
  if (!op.objetivos) return prontos;
  // quando um objetivo sai da lista, entra outro que talvez já esteja pronto também
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const o of objetivosAtivos(e, op)) {
      if ((e.cont[o.conta] || 0) >= o.meta) {
        e.feitos.push(o.id);
        if (op.mercado) e.moedas = Math.min(MAX_MOEDAS, e.moedas + o.premio); else e.estrelas += 1;
        prontos.push(o.id); mudou = true;
      }
    }
  }
  return prontos;
}

// Aplica uma ação ao estado de um jogador. Devolve { ok, erro?, feitos: [ids], mudou }.
//  { t:'ev', e, n }          um evento (carinho, conversa, voar, emote, andar)
//  { t:'bloco', b, y, de, natural }   colocou (b>0) ou quebrou (b=0) um bloco; "natural" = o bloco era do mundo original
//  { t:'vender', b, n }      vende n unidades do item b
//  { t:'comprar', b }        libera o bloco b (no "Coletar e criar": traz LOTE_LOJA dele)
//  { t:'criar', r, bancada } receita r (receitas.js); bancada = tem uma bancada perto (a sala confere)
//  { t:'ev', e:'la' }        carinho na ovelha deu lã (só no "Coletar e criar")
//  { t:'moer' }              trigo da mochila vira farinha (no moinho girando)
//  { t:'assar' }             farinha da mochila vira pão (no forno aceso)
//  trabalhadores (trabalho.js): contratar, demitir, obra, cancelar-obra, depositar, retirar, turno
//    ctx.pos = onde o jogador está (a sala usa a posição que ela conhece). Pode devolver r.blocos (o pedreiro
//    colocou: quem chamou põe no mundo) e r.msgs (avisos para o jogador).
export function aplicar(e, op, a, ctx = {}) {
  const r = { ok: true, feitos: [], mudou: false };
  const falha = (erro) => ({ ok: false, erro, feitos: [], mudou: false });
  if (!a || typeof a !== 'object') return falha('?');
  const tr = aplicarTrabalho(e, op, a, { por, tirar, guardavel, vendivel, precoLoja, MAX_MOEDAS, pos: ctx.pos, agora: ctx.agora });
  if (tr) {
    if (tr.erro) return { ...falha(tr.erro), falta: tr.falta, custo: tr.custo };
    ajustarCompra(e);
    return { ok: true, feitos: [], mudou: !tr.quieto, blocos: tr.blocos || [], marcar: tr.marcar || [], msgs: tr.msgs || [], vendas: tr.vendas || 0, paes: tr.paes || 0 };
  }
  if (a.t === 'ev') {
    const max = Object.prototype.hasOwnProperty.call(EVENTOS, a.e) ? EVENTOS[a.e] : 0; // 'constructor' etc. não contam
    if (!max) return falha('?');
    const n = Math.max(1, Math.min(max, a.n | 0 || 1));
    if (a.e === 'la') {
      if (!op.sobrevivencia) return falha('?');
      por(e.itens, LB, 1);
    } else r.feitos = contar(e, op, a.e, n);
    r.mudou = true;
  } else if (a.t === 'bloco') {
    // coletar e criar: colocar gasta da mochila; quebrar guarda o que cai
    if (op.sobrevivencia) {
      if (a.b > 0 && lugarVazio(a.de)) {
        // colocou coisa comprada: o lugar fica marcado (quem chamou guarda: a sala para o mundo todo)
        const g = gastoDe(a.b), comprado = livreDe(e, g) < 1;
        if (!tirar(e.itens, g, 1)) return falha('Você não tem esse bloco.');
        if (comprado) { e.compra[g] = Math.max(0, (e.compra[g] || 0) - 1); r.marca = 1; }
      } else if (!a.b) {
        // quebrou: o que cai de um bloco que era comprado continua marcado (senão colocar e quebrar "lavava" a marca)
        for (const [id, n] of oQueCai(a.de, a.x, a.y, a.z)) { por(e.itens, id, n); if (a.comprado) marcarCompra(e, id, n); }
      }
    }
    if (a.b > 0) {
      r.feitos.push(...contar(e, op, 'colocar', 1));
      if ([FV, FA, FZ].includes(a.b)) r.feitos.push(...contar(e, op, 'flor', 1));
      if (a.y >= 50) r.feitos.push(...contar(e, op, 'alto', 1));
      if (a.b === AG) r.feitos.push(...contar(e, op, 'agua', 1));
    } else {
      r.feitos.push(...contar(e, op, 'quebrar', 1));
      if (op.mercado && !op.sobrevivencia && a.natural && coletavel(a.de)) e.itens[a.de] = Math.min(MAX_ITEM, (e.itens[a.de] || 0) + 1);
    }
    r.mudou = true;
  } else if (a.t === 'vender') {
    if (!op.mercado) return falha('O mercado está desligado neste mundo.');
    const b = a.b | 0, tem = e.itens[b] || 0;
    // os moradores não compram de volta o que você comprou na loja deles (senão dava lucro sem trabalho)
    const n = Math.min(livreDe(e, b), Math.max(1, a.n | 0));
    if (guardavel(b) && tem > 0 && n <= 0) return falha('Os moradores não compram de volta o que você comprou na loja.');
    if (!vendivel(b)) return falha('Os moradores não compram formas: elas são para construir.');
    if (!guardavel(b) || n <= 0) return falha('Você não tem isso para vender.');
    e.itens[b] = tem - n;
    if (!e.itens[b]) delete e.itens[b];
    e.moedas = Math.min(MAX_MOEDAS, e.moedas + n * precoVenda(b));
    r.feitos = contar(e, op, 'vender', n); r.mudou = true;
  } else if (a.t === 'comprar') {
    if (!op.mercado) return falha('O mercado está desligado neste mundo.');
    const preco = PRECO_LOJA.get(a.b);
    if (!preco) return falha('Isso não está à venda.');
    if (e.moedas < preco) return falha(`Faltam ${preco - e.moedas} moedas.`);
    if (op.sobrevivencia) {
      if (qtdEm(e.itens, a.b) + LOTE_LOJA > MAX_ITEM) return falha('Sua mochila já está cheia disso!');
      e.moedas -= preco; por(e.itens, a.b, LOTE_LOJA); marcarCompra(e, a.b, LOTE_LOJA);
      if (!e.comprados.includes(a.b)) e.comprados.push(a.b);
    } else {
      if (e.comprados.includes(a.b)) return falha('Você já tem esse bloco!');
      e.moedas -= preco; e.comprados.push(a.b);
    }
    r.feitos = contar(e, op, 'comprar', 1); r.mudou = true;
  } else if (a.t === 'comprarV' || a.t === 'montarV') {
    // veículo novo: com moedas ou montado com o que se coletou
    if (!op.mercado) return falha('O mercado está desligado neste mundo.');
    const tipo = a.tipo;
    if (!(tipo in PRECO_VEICULO)) return falha('?');
    if (temVeiculo(e, tipo)) return falha('Esse veículo já é seu!');
    if (a.t === 'comprarV') {
      const preco = PRECO_VEICULO[tipo];
      if (e.moedas < preco) return falha(`Faltam ${preco - e.moedas} moedas.`);
      e.moedas -= preco;
    } else {
      const rec = RECEITA_VEICULO[tipo];
      for (const [b, n] of Object.entries(rec)) if ((e.itens[b] || 0) < n) return falha('Faltam materiais na mochila.');
      for (const [b, n] of Object.entries(rec)) { e.itens[b] -= n; if (!e.itens[b]) delete e.itens[b]; }
    }
    e.veiculos.push(tipo);
    r.mudou = true;
  } else if (a.t === 'chave') {
    // sem o mercado a chave sai de graça na garagem
    if (op.mercado) return falha('Compre ou monte este veículo na garagem.');
    if (!(a.tipo in PRECO_VEICULO)) return falha('?');
    if (!temVeiculo(e, a.tipo)) e.veiculos.push(a.tipo);
    r.mudou = true;
  } else if (a.t === 'servico') {
    // abastecer/carregar ou consertar no posto. "falta" = quanto falta (0..1); online quem calcula é a sala
    if (!(a.k in SERVICO)) return falha('?');
    if (op.mercado) {
      const preco = precoServico(a.k, a.falta);
      if (e.moedas < preco) return falha(`Faltam ${preco - e.moedas} moedas.`);
      e.moedas -= preco;
    }
    r.mudou = true;
  } else if (a.t === 'garagem') {
    // guardou um veículo: lembra como ele estava (tanque e dano) para quando tirar de novo
    const q = estadoVeic(a.s);
    if (!(a.tipo in PRECO_VEICULO) || !q) return falha('?');
    q[2] = Number.isFinite(a.agora) ? a.agora : Date.now();
    e.garagem[a.tipo] = q;
    r.mudou = true;
  } else if (a.t === 'criar') {
    if (!op.sobrevivencia) return falha('?');
    const rc = receita(a.r);
    if (!rc) return falha('?');
    if (faltaBancada(rc, a.bancada)) return falha('Precisa de uma Bancada perto.');
    if (!temTudo(e.itens, rc)) return falha('Faltam coisas para essa receita.');
    if (!converter(e, () => criarEm(e.itens, rc, a.bancada))) return falha('Sua mochila já está cheia disso!');
    r.mudou = true;
  } else if (a.t === 'moer' || a.t === 'assar') {
    if (!op.mercado && !op.sobrevivencia) return falha('Este mundo não tem mochila.');
    const [de, para] = a.t === 'moer' ? [TRI, FAR] : [FAR, PAO];
    const n = Math.min(LOTE, e.itens[de] || 0);
    if (n <= 0) return falha(a.t === 'moer' ? 'Você não tem trigo para moer.' : 'Você não tem farinha para assar.');
    converter(e, () => {
      e.itens[de] -= n;
      if (!e.itens[de]) delete e.itens[de];
      e.itens[para] = Math.min(MAX_ITEM, (e.itens[para] || 0) + n);
    });
    r.feitos = contar(e, op, a.t, n); r.mudou = true;
  } else return falha('?');
  ajustarCompra(e);
  return r;
}

// presente de moedas entre jogadores (a sala chama com os dois estados)
export function dar(de, para, n) {
  n = n | 0;
  if (n < 1 || n > 1000) return 'Quantidade estranha.';
  if (de.moedas < n) return 'Você não tem tantas moedas.';
  de.moedas -= n; para.moedas = Math.min(MAX_MOEDAS, para.moedas + n);
  return null;
}

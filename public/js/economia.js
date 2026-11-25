// Mercado e objetivos: regras puras (sem tela), usadas pelo jogo sem internet e pela sala online.
// A sala online roda estas mesmas regras e é ela quem decide as moedas de cada jogador.
// Não importe nada daqui que dependa do navegador (o servidor também usa este arquivo).

import { caberNoBau, porNoBau, tirarDoBau, ESPACOS_BAU } from './bau-regras.js';
import { ganharXp, normalizarXp, xpDoMinerio, XP_FORNO, XP_CACA, XP_MONSTRO } from './xp-regras.js';
import { CAI_MONSTRO, ehMonstro } from './monstros-regras.js';
import { avancar, caberNoForno, porNoForno, tirarDoForno, PILHA_FORNO } from './fornalha-regras.js';
import { aplicarTrabalho, normalizarTrabalho, negocioNovo, livreDe, marcarCompra, ajustarCompra, converter } from './trabalho.js';
import { parteDe } from './armadura-regras.js';
import { RECEITAS, guardavel, oQueCai, lugarVazio, gastoDe, receita, criarEm, faltaBancada, temTudo, por, tirar, qtdEm, cabe, cabeQuanto, pilhaDe, DURA, ajustarDesg, desgastar, tirarDesg, porDesg, desgLista, receitaNoMundo, semExtras } from './receitas.js';
import { ehComida } from './fome-regras.js';

// ids dos blocos (iguais aos de blocos.js)
const BALDE = 1009; // receitas.js I.BALDE
const LAVA = 215; // lava-regras.js: a fonte de lava na mochila é o balde de lava
const G = 1, TE = 2, PE = 3, AR_ = 4, AG = 5, TR = 6, FO = 7, TA = 8, VI = 9, TJ = 10, FV = 11, FA = 12, CA = 13,
  LB = 14, LV = 15, LZ = 16, LM = 17, LG = 18, LR = 19, PD = 20, LP = 21, FZ = 22, TAR = 31, TRI = 32, FE = 33;
// farinha e pão (blocos-mecanismos.js): saem do moinho de vento e do forno
const FAR = 57, PAO = 58;
// itens que caem dos bichos (blocos.js ITEM)
const CAR = 1007, COU = 1008;

// blocos que todo mundo já tem desde o começo (os outros se compram na loja da vila)
export const LIVRES = new Set([G, TE, PE, AR_, AG, TR, FO, TA, FV, FA, CA, PD]);

// loja: preço para liberar o bloco para sempre neste mundo
export const LOJA = [
  [TJ, 12], [VI, 15], [LP, 20], [FE, 14], [TAR, 6], [TRI, 14], [FZ, 14],
  [LB, 8], [LV, 10], [LZ, 10], [LM, 10], [LG, 10], [LR, 10],
].map(([b, preco]) => ({ b, preco }));
const PRECO_LOJA = new Map(LOJA.map((x) => [x.b, x.preco]));
// no "Coletar e criar" a loja não vende trigo: comprado, virava pão (9 cada) no moinho e no forno e dava moedas sem fim.
// Trigo se colhe no campo.
export const SO_COLHENDO = new Set([TRI]);
export const naLoja = (b, op) => !(op && op.sobrevivencia && SO_COLHENDO.has(b));
// no "Coletar e criar" a loja entrega LOTE_LOJA de uma vez: o lote nunca pode valer mais na venda do que custa
// (trigo custava 6 e o lote de 4 vendia por 12: moedas infinitas comprando e vendendo)

// quanto os aldeões pagam por cada coisa coletada (o que não está aqui vale 1).
// Troncos valem 4 porque 1 tronco vira 4 tábuas (que valem 1 cada).
const VENDA = { [TR]: 4, 71: 4, 73: 4, 131: 4, 80: 4, 81: 4, 82: 4, [FV]: 3, [FA]: 3, [FZ]: 3, [TRI]: 3, [FE]: 3, [LP]: 4, [VI]: 2, [TJ]: 2, [FAR]: 5, [PAO]: 9, [CAR]: 3, [COU]: 4 };
const precoBase = (b) => VENDA[b] || 1;
// nenhuma receita pode dar lucro: o que sai dela vale no máximo o que ela gasta, dividido pela quantidade feita
// (1 tronco que vendia por 2 virava 4 tábuas que vendiam por 4). Calculado das próprias receitas, então uma
// receita nova já entra na conta. Preço 0 = os moradores não compram (graveto, fio...).
let tabela = null, nReceitas = -1;
function tabelaVenda() {
  if (tabela && nReceitas === RECEITAS.length) return tabela;
  const t = new Map(), preco = (b) => (t.has(b) ? t.get(b) : precoBase(b));
  for (let volta = 0, mudou = true; mudou && volta < 50; volta++) {
    mudou = false;
    for (const r of RECEITAS) {
      if (r.semExtras) continue; // pão de 3 trigos: só nos mundos sem mercado de pão (moinho e forno)
      const [id, n] = r.faz, custo = r.usa.reduce((s, [i, q]) => s + preco(i) * q, 0);
      const teto = Math.floor(custo / Math.max(1, n));
      if (teto < preco(id)) { t.set(id, teto); mudou = true; }
    }
  }
  tabela = t; nReceitas = RECEITAS.length;
  return t;
}
export const precoVenda = (b) => { const t = tabelaVenda(); return t.has(b) ? t.get(b) : precoBase(b); };
// formas feitas na bancada (83..99: coluna, cerca, bola, rampa...) são para construir: ninguém compra.
// Uma receita faz várias de uma vez (1 vidro = 4 vidros finos), então vender dava mais moedas que a matéria-prima.
export const ehForma = (b) => b >= 83 && b <= 99;
export const vendivel = (b) => !ehForma(b) && precoVenda(b) > 0;
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
export const EVENTOS = { carinho: 1, conversa: 1, voar: 1, emote: 1, andar: 80, la: 1, caca: 1 };

// o que um bicho deixa quando cai (animais.js). Filhote é pequeno: só o primeiro item, um só.
// (o cachorro não entra: é bicho de estimação e não pode ser atacado)
export const CAI_BICHO = {
  ovelha: [[CAR, 1], [LB, 2]], porquinho: [[CAR, 2]], galinha: [[CAR, 1]], vaca: [[CAR, 2], [COU, 1]],
  capivara: [[CAR, 1], [COU, 1]], coelho: [[CAR, 1]], veado: [[CAR, 2], [COU, 1]], lobo: [[COU, 1]],
  raposa: [[COU, 1]], urso: [[CAR, 2], [COU, 2]], onca: [[COU, 1]], cobra: [[COU, 1]],
  ...CAI_MONSTRO, // monstros da noite (monstros-regras.js)
};
export function caiDoBicho(especie, filhote) {
  const l = Object.prototype.hasOwnProperty.call(CAI_BICHO, especie) ? CAI_BICHO[especie] : [];
  return filhote ? l.slice(0, 1).map(([id]) => [id, 1]) : l;
}
const ESPADAS = new Set([1113, 1114, 1115, 1116]); // receitas.js I.ESPADA_*
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
  // fome = o jogo clássico de verdade: sobrevivência fora do Pacífico (sem armas e fora da Guerra), com fome,
  // morte (o que estava na mochila cai no chão) e cama para renascer
  const dif = typeof op.dificuldade === 'string' ? op.dificuldade : op.selvagensMachucam ? 'normal' : 'pacifico';
  const fome = !!op.sobrevivencia && !op.armas && op.tipo !== 'guerra' && dif !== 'pacifico';
  return { mercado: !!op.mercado, objetivos: !!op.objetivos, sobrevivencia: !!op.sobrevivencia, construcao: op.construcao !== false, voo: !op.armas, fome, extras: op.extras !== false };
}
// tem mochila (dá para pegar e largar coisas no chão)
export const temMochila = (op) => !!(op && (op.mercado || op.sobrevivencia));
export const econLigada = (op) => !!(op && (op.mercado || op.objetivos || op.sobrevivencia));
// no "Coletar e criar", comprar na loja traz este tanto do bloco (e dá para comprar de novo)
export const LOTE_LOJA = 4;

export function estadoNovo(op) {
  // equipe/neg/obras: trabalhadores contratados, padaria e loja do jogador, obras do pedreiro (trabalho.js)
  return { moedas: op && op.mercado ? 10 : 0, estrelas: 0, itens: {}, comprados: [], cont: {}, feitos: [], equipe: [], neg: negocioNovo(), obras: [], tseq: 0, compra: {}, mc: [], obrasT: [], veiculos: [], garagem: {}, xp: 0, xpf: 0 };
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
  n.desg = e.desg; ajustarDesg(n); // desgaste das ferramentas (receitas.js)
  normalizarXp(n, e); // experiência (xp-regras.js)
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
//  { t:'ev', e:'la', x, y, z } carinho na ovelha deu lã (só no "Coletar e criar")
//  { t:'ev', e:'caca', b, f, x, y, z } derrubou um bicho da espécie b (f = filhote): o que cai vai para o chão (x, y, z: onde caiu)
//  { t:'pegar', id, n } / { t:'largar', id, n }   item do chão para a mochila e vice-versa
//  { t:'moer' }              trigo da mochila vira farinha (no moinho girando)
//  { t:'assar' }             farinha da mochila vira pão (no forno aceso)
//  trabalhadores (trabalho.js): contratar, demitir, obra, cancelar-obra, depositar, retirar, turno
//    ctx.pos = onde o jogador está (a sala usa a posição que ela conhece). Pode devolver r.blocos (o pedreiro
//    colocou: quem chamou põe no mundo) e r.msgs (avisos para o jogador).
// quebrar estas não gasta ferramenta (plantas, fogo, coisas de um toque)
const DESGASTA_NAO = new Set([0, 11, 12, 13, 22, 32, 75, 76, 77, 78, 79, 129, 130, 135, 221, 222]);
export function aplicar(e, op, a, ctx = {}) {
  const r = { ok: true, feitos: [], mudou: false };
  const falha = (erro) => ({ ok: false, erro, feitos: [], mudou: false });
  if (!a || typeof a !== 'object') return falha('?');
  const tr = aplicarTrabalho(e, op, a, { por, tirar, guardavel, vendivel, precoLoja, MAX_MOEDAS, pos: ctx.pos, agora: ctx.agora });
  if (tr) {
    if (tr.erro) return { ...falha(tr.erro), falta: tr.falta, custo: tr.custo };
    ajustarCompra(e);
    if (e.desg) ajustarDesg(e);
    return { ok: true, feitos: [], mudou: !tr.quieto, blocos: tr.blocos || [], marcar: tr.marcar || [], msgs: tr.msgs || [], vendas: tr.vendas || 0, paes: tr.paes || 0 };
  }
  if (a.t === 'ev') {
    const max = Object.prototype.hasOwnProperty.call(EVENTOS, a.e) ? EVENTOS[a.e] : 0; // 'constructor' etc. não contam
    if (!max) return falha('?');
    const n = Math.max(1, Math.min(max, a.n | 0 || 1));
    // lã e caça: com x, y, z (onde o bicho está) o que sai cai no chão (regras-chao.js); sem, vai direto para a mochila
    const noChao = [a.x, a.y, a.z].every(Number.isFinite);
    if (a.e === 'la' || a.e === 'caca') {
      let cai;
      if (a.e === 'la') { if (!op.sobrevivencia) return falha('?'); cai = [[LB, 1]]; }
      else {
        if (!op.sobrevivencia && !op.mercado) return falha('?');
        if (ehMonstro(String(a.b)) && !op.fome) return falha('?'); // monstro só existe no jogo clássico
        cai = caiDoBicho(String(a.b), !!a.f);
        if (!cai.length) return falha('?');
        if (op.fome) r.xp = ganharXp(e, XP_MONSTRO[a.b] || XP_CACA); // caçar dá experiência (jogo clássico); monstro dá mais
      }
      if (noChao) r.cai = cai.map(([id, q]) => [id, q, 0]);
      else for (const [id, q] of cai) por(e.itens, id, q);
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
        if (a.b === AG || a.b === LAVA) por(e.itens, BALDE, 1); // despejou a água (ou a lava): o balde volta vazio
      } else if (!a.b && a.de === AG) {
        // água parada só sai com balde: o balde vazio vira balde de água (a Água na mochila), nada cai no chão
        if ((a.mao | 0) !== BALDE || !tirar(e.itens, BALDE, 1)) return falha('Para pegar água, use um balde (crie na bancada com 3 tábuas).');
        por(e.itens, AG, 1);
      } else if (!a.b && a.de === LAVA) {
        // lava também: só com balde (não dá para pegar com a mão)
        if ((a.mao | 0) !== BALDE || !tirar(e.itens, BALDE, 1)) return falha('Para pegar lava, use um balde.');
        por(e.itens, LAVA, 1);
      } else if (!a.b) {
        // quebrou: o que cai vai para o chão (regras-chao.js); quem chamou põe no chão. A mochila só recebe quando
        // alguém pega. O que cai de um bloco que era comprado continua marcado (c = quantos são comprados).
        // A ferramenta só vale se estiver na mochila (senão o aparelho dizia ter picareta e tirava vidro inteiro)
        r.cai = oQueCai(a.de, a.x, a.y, a.z, !!a.natural, (e.itens[a.mao | 0] | 0) > 0 ? a.mao | 0 : 0, !!op.fome).map(([id, n]) => [id, n, a.comprado ? n : 0]);
        // a ferramenta da mão gasta (planta e coisa de um toque não: DESGASTA_NAO)
        if (!DESGASTA_NAO.has(a.de | 0)) r.ferramenta = desgastar(e, a.mao | 0);
        // jogo clássico: minério do mundo tirado com a picareta certa dá experiência (xp-regras.js)
        if (op.fome && a.natural && r.cai.length) r.xp = ganharXp(e, xpDoMinerio(a.de | 0, a.x, a.y, a.z));
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
    if (!vendivel(b)) return falha(ehForma(b) ? 'Os moradores não compram formas: elas são para construir.' : 'Os moradores não compram isso.');
    if (!guardavel(b) || n <= 0) return falha('Você não tem isso para vender.');
    e.itens[b] = tem - n;
    if (!e.itens[b]) delete e.itens[b];
    e.moedas = Math.min(MAX_MOEDAS, e.moedas + n * precoVenda(b));
    r.feitos = contar(e, op, 'vender', n); r.mudou = true;
  } else if (a.t === 'comprar') {
    if (!op.mercado) return falha('O mercado está desligado neste mundo.');
    const preco = PRECO_LOJA.get(a.b);
    if (!preco || !naLoja(a.b, op)) return falha('Isso não está à venda.');
    if (e.moedas < preco) return falha(`Faltam ${preco - e.moedas} moedas.`);
    if (op.sobrevivencia) {
      if (qtdEm(e.itens, a.b) + LOTE_LOJA > MAX_ITEM) return falha('Sua mochila já está cheia disso!');
      if (!cabe(e.itens, a.b, LOTE_LOJA)) return falha('A mochila está cheia! Largue ou use alguma coisa.');
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
    if (!rc || !receitaNoMundo(rc, op.fome)) return falha('?');
    if (rc.extra && semExtras(op)) return falha('?'); // mod "Blocos extras" desligado (e sem o Mercado)
    if (rc.semExtras && !semExtras(op)) return falha('?'); // com os blocos extras (ou o Mercado) o pão vem do moinho e do forno
    if (faltaBancada(rc, a.bancada)) return falha('Precisa de uma Bancada perto.');
    if (!temTudo(e.itens, rc)) return falha('Faltam coisas para essa receita.');
    // n = quantas vezes (shift na grade de criar: o máximo de uma vez); cria enquanto der
    const n = Math.max(1, Math.min(64, a.n | 0 || 1));
    let feitas = 0;
    for (let k = 0; k < n; k++) { if (!converter(e, () => criarEm(e.itens, rc, a.bancada, true))) break; feitas++; if (!temTudo(e.itens, rc)) break; }
    if (!feitas) return falha('A mochila está cheia! Largue ou use alguma coisa.');
    r.feitas = feitas;
    r.mudou = true;
  } else if (a.t === 'pegar' || a.t === 'largar') {
    // pegar do chão / largar no chão (quem confere se o item existe e está perto é a sala ou o jogo sem internet)
    if (!temMochila(op)) return falha('Este mundo não tem mochila.');
    const id = a.id | 0, n = a.n | 0;
    if (!guardavel(id) || n < 1 || n > 64) return falha('?');
    // c = quantos são coisa comprada (a marca vai junto para o chão e volta para quem pegar)
    if (a.t === 'pegar') {
      // coletando, a mochila tem espaços como no clássico (receitas.js ESPACOS): pega o que cabe e o resto
      // fica no chão (r.pegou = quantos entraram; r.restoC = quantos dos que ficaram são comprados)
      let k = Math.min(n, MAX_ITEM - qtdEm(e.itens, id));
      if (k < 1) return falha('Sua mochila já está cheia disso!');
      if (op.sobrevivencia) k = Math.min(k, cabeQuanto(e.itens, id));
      if (k < 1) return falha('A mochila está cheia!');
      if (!por(e.itens, id, k)) return falha('Sua mochila já está cheia disso!');
      const c = Math.max(0, Math.min(n, a.c | 0)), cK = Math.min(k, c);
      marcarCompra(e, id, cK);
      r.pegou = k; r.restoC = c - cK;
      if (DURA[id]) { const d = desgLista(id, a.d, n); porDesg(e, id, d.slice(0, k), k); r.restoD = d.slice(k); } // o desgaste vem junto
    } else {
      r.c = Math.max(0, n - livreDe(e, id)); // a parte comprada é a última a sair
      if (!tirar(e.itens, id, n)) return falha('Você não tem isso.');
      r.d = tirarDesg(e, id, n); // a ferramenta largada leva o desgaste para o chão
    }
    r.mudou = true;
  } else if (a.t === 'comer') {
    // comeu (fome-regras.js COMIDA): sai 1 da mochila; a barra de fome fica no aparelho
    if (!op.fome) return falha('?');
    const id = a.id | 0;
    if (!ehComida(id)) return falha('Isso não se come.');
    if (!tirar(e.itens, id, 1)) return falha('Acabou a comida.');
    ajustarCompra(e);
    r.mudou = true;
  } else if (a.t === 'golpe') {
    // bateu num bicho/monstro com uma ferramenta (jogo clássico): a espada gasta 1, as outras ferramentas 2
    if (!op.fome) return falha('?');
    const id = a.mao | 0;
    if (!DURA[id] || (e.itens[id] | 0) < 1) return falha('?');
    r.ferramenta = desgastar(e, id);
    if (!ESPADAS.has(id) && r.ferramenta === 'gastou') r.ferramenta = desgastar(e, id);
    r.mudou = true;
  } else if (a.t === 'armadura') {
    // levou um golpe vestido (jogo clássico, armadura-regras.js): cada peça vestida gasta n
    if (!op.fome || !Array.isArray(a.ids) || a.ids.length > 4) return falha('?');
    const n = Math.max(1, Math.min(10, a.n | 0)), partes = new Set(), quebrou = [];
    for (const v of a.ids) {
      const id = v | 0, p = parteDe(id);
      if (p < 0 || partes.has(p) || (e.itens[id] | 0) < 1) return falha('?');
      partes.add(p);
    }
    for (const v of a.ids) for (let k = 0; k < n; k++) if (desgastar(e, v | 0) === 'quebrou') { quebrou.push(v | 0); break; }
    if (quebrou.length) r.quebrou = quebrou;
    r.mudou = true;
  } else if (a.t === 'morrer') {
    // morreu (sem corações): tudo o que dá para pôr no chão cai, em pilhas, onde a pessoa estava
    if (!op.fome) return falha('?');
    r.xpPerdido = e.xp | 0; e.xp = 0; e.xpf = 0; // morrer perde a experiência
    r.cai = [];
    for (const k of Object.keys(e.itens)) {
      const id = +k;
      let n = e.itens[k] | 0;
      if (!(n > 0) || !guardavel(id)) continue;
      let c = Math.min(n, (e.compra && e.compra[k]) | 0);
      const p = pilhaDe(id);
      // ferramentas: cada uma leva o próprio desgaste (receitas.js DURA)
      e.itens[k] = 0; // tirarDesg conta com a mochila já sem elas
      const dg = DURA[id] ? tirarDesg(e, id, n) : null;
      let di = 0;
      while (n > 0 && r.cai.length < 60) { const q = Math.min(p, 64, n), qc = Math.min(q, c); r.cai.push(dg ? [id, q, qc, dg.slice(di, di + q)] : [id, q, qc]); di += q; n -= q; c -= qc; }
      e.itens[k] = n;
      if (!n) delete e.itens[k];
    }
    ajustarCompra(e);
    r.mudou = true;
  } else if (a.t === 'acender') {
    // acendeu fogo com o isqueiro (fogo-regras.js): gasta 1
    if (!op.sobrevivencia) return falha('?');
    r.ferramenta = desgastar(e, 1010);
    if (!r.ferramenta) return falha('Você não tem isqueiro.');
    r.mudou = true;
  } else if (a.t === 'alimentar') {
    // deu trigo na mão para um bicho de fazenda (animais.js: cruzar)
    if (!op.sobrevivencia) return falha('?');
    if (!tirar(e.itens, TRI, 1)) return falha('Você não tem trigo.');
    r.mudou = true;
  } else if (a.t === 'forno-por' || a.t === 'forno-tirar') {
    // fornalha (fornalha-regras.js). a.f = o estado da fornalha: quem chama (a sala, ou o jogo sem internet) põe,
    // nunca o que veio do aparelho; aqui só se mexe na mochila e no estado
    if (!op.sobrevivencia) return falha('?');
    const f = a.f;
    if (!f || typeof f !== 'object') return falha('?');
    avancar(f, Number.isFinite(a.agora) ? a.agora : Date.now());
    if (a.t === 'forno-por') {
      const id = a.id | 0;
      // coisa comprada não entra (senão tirar de volta apagava a marca de comprada)
      const n = Math.min(Math.max(1, a.n | 0), livreDe(e, id));
      if (!guardavel(id) || n < 1) return falha('Você não tem isso.');
      const q = caberNoForno(f, a.k, id, n);
      if (!q) return falha(a.k === 'c' ? 'Isso não serve de combustível.' : 'Isso não vai na fornalha.');
      tirar(e.itens, id, q); porNoForno(f, a.k, id, q);
      r.foi = q;
    } else {
      const k = a.k;
      if (!f[k]) return falha('?');
      const [id] = f[k];
      const q = Math.min(Math.max(1, a.n | 0 || PILHA_FORNO), f[k][1], cabeQuanto(e.itens, id));
      if (q < 1) return falha('A mochila está cheia! Largue ou use alguma coisa.');
      tirarDoForno(f, k, q); por(e.itens, id, q);
      r.veio = [id, q];
      if (k === 's') { r.feitos = contar(e, op, 'forno', q); if (op.fome) r.xp = ganharXp(e, (XP_FORNO[id] || 0) * q); }
    }
    r.mudou = true;
  } else if (a.t === 'bau-por' || a.t === 'bau-tirar') {
    // baú (bau-regras.js). a.b = os 27 espaços do baú: quem chama (a sala, ou o jogo sem internet) põe,
    // nunca o que veio do aparelho. A marca de comprado e o desgaste vão junto com a coisa.
    if (!op.sobrevivencia) return falha('?');
    const b = a.b;
    if (!Array.isArray(b) || b.length !== ESPACOS_BAU) return falha('?');
    const k = Number.isInteger(a.k) && a.k >= -1 && a.k < ESPACOS_BAU ? a.k : -1;
    if (a.t === 'bau-por') {
      const id = a.id | 0;
      let n = Math.min(Math.max(1, a.n | 0), qtdEm(e.itens, id));
      if (DURA[id]) n = Math.min(n, 1); // ferramenta vai uma por vez (cada uma com o seu desgaste)
      if (!guardavel(id) || n < 1) return falha('Você não tem isso.');
      const q = caberNoBau(b, k, id, n);
      if (!q) return falha('O baú está cheio!');
      const c = Math.max(0, q - livreDe(e, id)); // a parte comprada é a última a sair
      tirar(e.itens, id, q);
      const d = DURA[id] ? ((tirarDesg(e, id, 1) || [0])[0] | 0) : 0;
      ajustarCompra(e);
      porNoBau(b, k, id, q, c, d);
      r.foi = q;
    } else {
      const p = b[k];
      if (!p) return falha('?');
      const id = p[0];
      const q = Math.min(Math.max(1, a.n | 0 || 64), p[1], op.sobrevivencia ? cabeQuanto(e.itens, id) : p[1]);
      if (q < 1) return falha('A mochila está cheia! Largue ou use alguma coisa.');
      const t = tirarDoBau(b, k, q);
      por(e.itens, id, t.n);
      marcarCompra(e, id, t.c);
      if (DURA[id]) porDesg(e, id, [t.d], 1);
      r.veio = [id, t.n];
    }
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
  if (e.desg) ajustarDesg(e); // vendeu, largou, quebrou...: o desgaste acompanha a mochila
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

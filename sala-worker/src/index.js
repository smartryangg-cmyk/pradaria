// Sala de um mundo: guarda as edições de blocos e repassa posições/emotes entre os jogadores.
import { DurableObject } from 'cloudflare:workers';
export { Lobby } from './lobby.js';
export { Partida } from './partida.js';
export { Pontos } from './pontos.js';
import { ARMAS, danoMaximo, VOLTA_ITEM } from '../../public/js/armas-dados.js';
import { opcoesEcon, econLigada, normalizar, aplicar, dar, liberado, temMochila, temVeiculo, estadoDaGaragem } from '../../public/js/economia.js';
import { lugarVazio, gastoDe, oQueCai, MAIOR_ITEM } from '../../public/js/receitas.js';
import { normalizarForno, avancar, conteudo, fornoPublico } from '../../public/js/fornalha-regras.js';
import { BAU, normalizarBau, conteudoBau, vazioBau } from '../../public/js/bau-regras.js';
const FORNALHA = 188;
import { Chao, publico, podePegar, pertoParaPegar, podeNoChao, MAX_LARGAR } from '../../public/js/regras-chao.js';
import { normalizarOpcoes } from '../../public/js/opcoes-mundo.js';
import { normalizarSkin } from '../../public/js/skin.js';
import { filtrarChat, contarDigitos } from '../../public/js/chat-filtro.js';
import { candidatoSeguro, sdpSemIp } from '../../public/js/voz-filtro.js';
import { horaDe, MAX_TURNO } from '../../public/js/trabalho.js';
import { blocosDaObra, PLANTAS, ESTILOS_OBRA } from '../../public/js/casas.js';
import { mudancaSemMao } from '../../public/js/blocos-rede.js';
import { FOGO, ISQUEIRO, ALCANCE_FOGO, inflamavel } from '../../public/js/fogo-regras.js';
import { podeCrescer } from '../../public/js/plantacoes-regras.js';
import { ehCama, podeDormir, ACORDA, PERTO_DA_CAMA } from '../../public/js/dormir-regras.js';
import { CANA, ALTURA_CANA, CANA_MIN, podeCrescerCana } from '../../public/js/cana-regras.js';
import { MUDAS, MUDA_MIN, TRONCO_DA_MUDA, BLOCOS_ARVORE, podeCrescerMuda, naCaixa } from '../../public/js/arvores-regras.js';
export { Controle } from './controle.js';

// ações dos trabalhadores contratados (trabalho.js)
const ACOES_TRABALHO = new Set(['contratar', 'demitir', 'obra', 'cancelar-obra', 'depositar', 'retirar', 'turno']);
const ALTURA_MAX = 95; // igual ao ALT - 1 de public/js/mundo.js

const MAX_BLOCO = 255; // 0..63 base, 100..126 engenharia, 128..175 eras (blocos-eras.js)
// o cliente ignora ids que não existem (antes um id desconhecido travava o mundo de todos); aqui só o intervalo
const blocoOk = (b) => Number.isInteger(b) && b >= 0 && b <= MAX_BLOCO;
const MAX_JOGADORES = 12;
// emotes por nome de ícone (v4); os emojis ficam para quem ainda está com a versão antiga aberta
const EMOTES = new Set(['acenar', 'coracao', 'sorriso', 'estrela', '👋', '❤️', '😄', '⭐']);
const MAX_EDICOES = 200000; // por mundo
const LONGE = 100000; // ninguém precisa ir mais longe que isso
const MSG_POR_SEG = 30;
// veículos: tipo -> número de lugares (igual ao public/js/veiculos.js)
const LUGARES = { carro: 4, jipe: 4, esportivo: 2, quadriciclo: 2, moto: 2, bicicleta: 1, skate: 1, trator: 2, caminhao: 6, onibus: 9, barco: 4, submarino: 2, aviao: 2, helicoptero: 4,
  tanque: 2, jipeArmado: 4, helicopteroGuerra: 4, viatura: 4 };
// mundo de Guerra (public/js/guerra.js): veículos que só existem nas vagas da base, do forte e da delegacia
const MILITARES = new Set(['tanque', 'jipeArmado', 'helicopteroGuerra', 'viatura']);
// armas dos veículos: alcance da metralhadora e raio da bomba do canhão (igual ao public/js/guerra-veiculos.js)
const ARMA_VEIC = { tanque: { raio: 4.2 }, jipeArmado: { alcance: 55 }, helicopteroGuerra: { alcance: 65 } };
// vagas dos veículos de guerra (guerra-mapa.js): cada vaga tem um tipo só
const VAGAS_GUERRA = { bt: 'tanque', bj: 'jipeArmado', bh: 'helicopteroGuerra', ft: 'tanque', dv1: 'viatura', dv2: 'viatura' };
const MAX_CACA_MIN = 12, MAX_LA_MIN = 10; // bichos derrubados e lã tirada por conta, por minuto
const ANDA_MAX = 40;
const ESTAGIO_MIN = 20000; // trigo: no mínimo 20 s em cada estágio (com água perto a média é 30 s) // blocos por segundo (veja pv no 'pos')
const MAX_VEICULOS = 40; // por mundo
const MAX_VEICULOS_POR_JOGADOR = 6;
const MAX_PARADOS = 40; // veículos que moram nas vilas/portos (aparecem quando alguém chega perto)
const fracao = (x, padrao) => (Number.isFinite(x) ? Math.max(0, Math.min(1, Math.round(x * 1000) / 1000)) : padrao);
const pubV = (v) => ({ id: v.id, tipo: v.tipo, cor: v.cor, p: v.p, r: v.r, c: fracao(v.c, 1), d: fracao(v.d, 0), ...(v.k ? { k: v.k } : {}), ...(v.dono ? { dono: v.dono } : {}) });
const arrV = (v, k = 100) => Math.round(v * k) / k;
const MAX_LUGARES = 8;
// desenhos dos lugares salvos: nomes de ícone (v4, ver ICONES em public/js/comandos.js) e os emojis antigos
const ICONES_LUGAR = new Set(['estrela', 'arvore', 'castelo', 'onda', 'montanha', 'flor', 'ovelha', 'maca', 'diamante', 'casa',
  '⭐', '🌳', '🏰', '🌊', '⛰️', '🌸', '🐑', '🍎', '💎', '🌻']);
const TP_ESPERA = 30000; // um pedido de teleporte vale por 30 s
const TP_INTERVALO = 4000; // e cada um pode pedir de 4 em 4 s
const TP_ALVO_INTERVALO = 4000; // e cada um recebe no máximo um pedido a cada 4 s
// chat de texto: no máximo 1 mensagem a cada 1,2 s e 6 a cada 15 s por pessoa; a mesma frase só depois de 20 s
const CHAT_INTERVALO = 1200, CHAT_JANELA = 15000, CHAT_NA_JANELA = 6, CHAT_REPETIDA = 20000;
const CHAT_HISTORICO = 20, CHAT_HISTORICO_MS = 10 * 60000; // quem entra vê as últimas mensagens (só na memória)
// chat de voz: a sala só passa os recados do WebRTC (oferta/resposta/caminhos) entre quem ligou a voz
const VOZ_SINAL_MAX = 8000; // tamanho de um recado (uma oferta de áudio tem uns 2-4 mil letras)
const VOZ_SINAIS_POR_5S = 60;
const chatDe = (opcoes) => ({ texto: opcoes.chatTexto !== false, voz: opcoes.chatVoz !== false });
const MAX_ID_ITEM = MAIOR_ITEM; // blocos 1..255 e itens 1000+ (ferramentas etc.)

// posição [x, y, z] (e giro opcional) dentro dos limites do mundo
function posOk(p) {
  return Array.isArray(p) && p.length >= 3 && p.length <= 4 && p.every(Number.isFinite)
    && Math.abs(p[0]) <= LONGE && Math.abs(p[2]) <= LONGE && p[1] >= -64 && p[1] <= 512;
}
const arred = (p) => p.map((v) => Math.round(v * 100) / 100);
function limparLugares(l) {
  const casa = l && posOk(l.casa) ? arred(l.casa) : null;
  const lista = [];
  for (const x of (l && Array.isArray(l.lista) ? l.lista : []).slice(0, MAX_LUGARES)) {
    if (x && ICONES_LUGAR.has(x.ic) && posOk(x.p)) lista.push({ ic: x.ic, p: arred(x.p) });
  }
  return { casa, lista };
}

// barra de um jogador (modo coletar e criar): 9 ids de blocos/itens (0 = mão vazia)
const barraOk = (b) => Array.isArray(b) && b.length === 9 && b.every((x) => Number.isInteger(x) && x >= 0 && x <= MAX_ID_ITEM);

export class Sala extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.edicoes = null; // Map "x,y,z" -> b
    this.veiculos = null; // Map id -> { id, tipo, cor, p, r, dono, t }
    this.info = null;
    this.ctx.blockConcurrencyWhile(async () => {
      this.info = (await this.ctx.storage.get('info')) || null;
    });
  }

  async carregarEdicoes() {
    if (this.edicoes) return this.edicoes;
    const m = new Map();
    const lista = await this.ctx.storage.list({ prefix: 'b:' });
    for (const [k, v] of lista) m.set(k.slice(2), v);
    this.edicoes = m;
    return m;
  }

  async carregarVeiculos() {
    if (this.veiculos) return this.veiculos;
    const m = new Map();
    const lista = await this.ctx.storage.list({ prefix: 'v:' });
    for (const [, v] of lista) m.set(v.id, v);
    this.veiculos = m;
    return m;
  }

  // chaves dos veículos de vila/porto que já apareceram neste mundo (cada um aparece uma vez só)
  async carregarParados() {
    if (!this.parados) this.parados = new Set((await this.ctx.storage.get('vpar')) || []);
    return this.parados;
  }

  // itens no chão (drops): ficam guardados um por chave ("d:i") e somem sozinhos depois de uns minutos
  async carregarChao() {
    if (this.chao) return this.chao;
    const c = new Chao();
    const lista = await this.ctx.storage.list({ prefix: 'd:' });
    for (const [, d] of lista) if (d && Number.isInteger(d.i)) c.novo(d.id, d.n, d.x, d.y, d.z, d.v, d.dono, d.t, d.i, d.c, d.q, d.dg);
    this.chao = c;
    await this.limparChao();
    return c;
  }
  async limparChao() {
    const fora = this.chao.limpar();
    if (!fora.length) return;
    const ks = fora.map((d) => 'd:' + d.i);
    for (let i = 0; i < ks.length; i += 128) await this.ctx.storage.delete(ks.slice(i, i + 128));
    for (const d of fora) this.enviarTodos({ t: 'chao-pegou', i: d.i, j: null });
  }
  // põe itens no chão e avisa todo mundo. itens: [[id, n, x, y, z, v?, c?]] (c = quantos são comprados)
  // q = a conta de quem fez cair (cada um tem um limite no chão: encher o chão não apaga os itens dos outros)
  async soltarNoChao(itens, dono = '', q = '') {
    const c = await this.carregarChao();
    const novos = [];
    for (const [id, n, x, y, z, v, comp, dg, res] of itens) {
      const d = c.novo(id, n, x, y, z, v || [(Math.random() - 0.5) * 2.4, 3.2, (Math.random() - 0.5) * 2.4], dono, Date.now(), null, comp || 0, q, dg, res);
      if (d) novos.push(d);
    }
    if (!novos.length) return;
    const put = {};
    for (const d of novos) put['d:' + d.i] = d;
    await this.ctx.storage.put(put);
    await this.limparChao();
    this.enviarTodos({ t: 'chao', d: novos.filter((d) => c.itens.has(d.i)).map((d) => publico(d)) });
  }
  // fornalhas: carrega quando alguém usa (fica guardada em "f:x,y,z")
  async fornoDe(k) {
    this.fornos ??= new Map();
    let f = this.fornos.get(k);
    if (!f) { f = normalizarForno(await this.ctx.storage.get('f:' + k)); this.fornos.set(k, f); if (this.fornos.size > 500) this.fornos.clear(); }
    return f;
  }
  // a fornalha saiu dali: o que estava dentro cai no chão
  async fornoSumiu(x, y, z, q) {
    const k = x + ',' + y + ',' + z, f = await this.fornoDe(k);
    avancar(f, Date.now());
    const tem = conteudo(f);
    this.fornos.delete(k);
    await this.ctx.storage.delete('f:' + k);
    this.enviarTodos({ t: 'forno', x, y, z, f: null });
    if (tem.length && temMochila(this.op())) await this.soltarNoChao(tem.map(([id, n]) => [id, n, x + 0.5, y + 0.4, z + 0.5]), '', q);
  }
  // baús: carrega quando alguém abre (fica guardado em "k:x,y,z")
  async bauDe(k) {
    this.baus ??= new Map();
    let b = this.baus.get(k);
    if (!b) { b = normalizarBau(await this.ctx.storage.get('k:' + k)); this.baus.set(k, b); if (this.baus.size > 500) this.baus.clear(); }
    return b;
  }
  // o baú saiu dali: o que estava dentro cai no chão (com a marca de comprado e o desgaste)
  async bauSumiu(x, y, z, q) {
    const k = x + ',' + y + ',' + z, b = await this.bauDe(k);
    const tem = conteudoBau(b);
    this.baus.delete(k);
    await this.ctx.storage.delete('k:' + k);
    this.enviarTodos({ t: 'bau', x, y, z, b: null });
    if (tem.length && temMochila(this.op())) await this.soltarNoChao(tem.map(([id, n, c, d]) => [id, n, x + 0.5, y + 0.4, z + 0.5, null, c, d ? [d] : undefined]), '', q);
  }
  // limite simples por jogador (fica na conexão)
  balde(ws, eu, k, max, janela = 1000) {
    const agora = Date.now();
    if (!eu['j' + k] || agora - eu['j' + k] > janela) { eu['j' + k] = agora; eu['n' + k] = 0; }
    if (++eu['n' + k] > max) return false;
    ws.serializeAttachment(eu);
    return true;
  }

  // quem está sentado em cada veículo (fica guardado na conexão de cada jogador)
  ocupacao() {
    const o = new Map();
    for (const j of this.jogadores()) if (j.v) {
      if (!o.has(j.v[0])) o.set(j.v[0], []);
      o.get(j.v[0])[j.v[1]] = j.id;
    }
    return o;
  }

  async descer(ws, eu) {
    if (!eu.v) return;
    const [id, a] = eu.v;
    eu.v = null;
    ws.serializeAttachment(eu);
    this.enviarTodos({ t: 'vassento', id, a, j: null });
    const v = (await this.carregarVeiculos()).get(id);
    if (v) await this.ctx.storage.put('v:' + id, v);
  }

  jogadores() {
    return this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment()).filter(Boolean);
  }

  enviarTodos(msg, exceto) {
    const s = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exceto) continue;
      try { ws.send(s); } catch {}
    }
  }

  // pedidos da API (só chegam pelo binding, nunca do jogador): expulsar, esquecer alguém, apagar o mundo, editar, exportar, importar
  async admin(acao, d) {
    if (acao === 'expulsar') {
      const uids = new Set(Array.isArray(d.uids) ? d.uids : []);
      for (const ws of this.ctx.getWebSockets()) {
        const j = ws.deserializeAttachment();
        if (!j || !(uids.has(j.uid) || (d.todosMenos != null && j.uid !== d.todosMenos))) continue;
        try { ws.send(JSON.stringify({ t: 'erro', fim: true, msg: typeof d.msg === 'string' ? d.msg : 'O dono do mundo tirou você deste mundo.' })); } catch {}
        ws.serializeAttachment(null);
        try { ws.close(4004, 'expulso'); } catch {}
        this.enviarTodos({ t: 'saiu', id: j.id }, ws);
      }
    } else if (acao === 'editar') {
      // o dono editou o mundo (nome/opções já salvos no banco): vale na hora para quem está aqui
      const opcoes = normalizarOpcoes(d.opcoes);
      // regras do servidor (construção, armas) valem na hora, não só quando alguém entra de novo
      if (this.info) { this.info.econ = opcoesEcon(opcoes); this.info.regras = { construcao: opcoes.construcao !== false, armas: opcoes.armas === true }; await this.ctx.storage.put('info', this.info); }
      if (this.econ) this.econ.clear(); // a mochila/moedas de cada um é ajustada às opções novas
      if (this.info) await this.mudarChat(chatDe(opcoes)); // chat de texto/voz: vale na hora, sem recarregar
      const nome = typeof d.nome === 'string' ? d.nome.slice(0, 24) : '';
      for (const ws of this.ctx.getWebSockets()) {
        const j = ws.deserializeAttachment();
        if (!j) continue;
        // ligaram Armas: quem não respondeu "tenho 16 anos ou mais" sai na hora (não espera recarregar)
        if (opcoes.armas === true && !j.mais16) {
          try { ws.send(JSON.stringify({ t: 'erro', fim: true, msg: 'Este mundo agora é para quem tem 16 anos ou mais.' })); } catch {}
          ws.serializeAttachment(null);
          try { ws.close(4003, 'idade'); } catch {}
          this.enviarTodos({ t: 'saiu', id: j.id }, ws);
          continue;
        }
        j.semVeiculos = opcoes.veiculos === false; ws.serializeAttachment(j);
        try { ws.send(JSON.stringify({ t: 'mundo-editado', nome, opcoes, recarregar: d.recarregar === true })); } catch {}
      }
    } else if (acao === 'exportar') {
      // todos os blocos mudados neste mundo (para o arquivo do dono)
      const edicoes = [];
      for (const [k, b] of await this.carregarEdicoes()) { if (!blocoOk(b)) continue; const [x, y, z] = k.split(',').map(Number); edicoes.push([x, y, z, b]); }
      return Response.json({ edicoes });
    } else if (acao === 'importar' && Array.isArray(d.edicoes)) {
      // mundo novo vindo de um arquivo (a API já conferiu): grava os blocos de 128 em 128
      const ed = await this.carregarEdicoes();
      let lote = {}, n = 0;
      for (const e of d.edicoes.slice(0, MAX_EDICOES)) {
        if (!Array.isArray(e) || e.length !== 4) continue;
        const [x, y, z, b] = e;
        if (![x, y, z].every(Number.isInteger) || y < 1 || y > ALTURA_MAX || !blocoOk(b) || Math.abs(x) > LONGE || Math.abs(z) > LONGE) continue;
        const k = x + ',' + y + ',' + z;
        ed.set(k, b); lote['b:' + k] = b;
        if (++n % 128 === 0) { await this.ctx.storage.put(lote); lote = {}; }
      }
      if (Object.keys(lote).length) await this.ctx.storage.put(lote);
      return Response.json({ ok: true, n });
    } else if (acao === 'chat-op') {
      // o dono ligou/desligou o chat de texto ou de voz nas opções do mundo (vale na hora, para todo mundo)
      await this.mudarChat({ texto: d.texto !== false, voz: d.voz !== false });
    } else if (acao === 'esquecer' && Number.isInteger(d.uid)) {
      await this.ctx.storage.delete(['p:' + d.uid, 'l:' + d.uid, 'e:' + d.uid]);
      if (this.econ) this.econ.delete(d.uid);
      await this.admin('expulsar', { uids: [d.uid] });
    } else if (acao === 'apagar') {
      await this.admin('expulsar', { todosMenos: -1, msg: 'O dono apagou este mundo.' });
      await this.ctx.storage.deleteAll();
      this.edicoes = null; this.info = null; this.econ = null; this.veiculos = null; this.coleta = null;
    }
    return new Response('ok');
  }

  async fetch(request) {
    // ações do dono só chegam pelo binding do servidor (https://sala/admin); do jogador nunca
    const acao = new URL(request.url).hostname === 'sala' ? request.headers.get('x-admin') : null;
    if (request.headers.get('x-admin') && !acao) return new Response('não', { status: 403 });
    if (acao) { let d = {}; try { d = await request.json(); } catch {} return this.admin(acao, d || {}); }
    const u = JSON.parse(request.headers.get('x-usuario') || 'null');
    const mundo = JSON.parse(request.headers.get('x-mundo') || 'null');
    if (!u || !mundo) return new Response('sem dados', { status: 400 });
    if (!this.info) {
      this.info = { codigo: mundo.codigo, semente: mundo.semente, inicio: Date.now() };
      await this.ctx.storage.put('info', this.info);
    }
    // as opções do mundo vêm do banco (D1) a cada entrada
    const opcoes = mundo.opcoes && typeof mundo.opcoes === 'object' ? mundo.opcoes : {};
    const op = opcoesEcon(opcoes);
    const cicloDia = opcoes.cicloDia !== false;
    if (JSON.stringify(op) !== JSON.stringify(this.info.econ) || this.info.cicloDia !== cicloDia) { this.info.econ = op; this.info.cicloDia = cicloDia; await this.ctx.storage.put('info', this.info); }
    // regras que o servidor faz valer: construção (colocar/quebrar) e armas
    const regras = { construcao: opcoes.construcao !== false, armas: opcoes.armas === true || opcoes.tipo === 'guerra' };
    if (JSON.stringify(regras) !== JSON.stringify(this.info.regras)) { this.info.regras = regras; await this.ctx.storage.put('info', this.info); }
    const chat = chatDe(opcoes);
    if (JSON.stringify(chat) !== JSON.stringify(this.info.chat)) await this.mudarChat(chat);
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    // o mesmo login em outro aparelho/aba: a conexão antiga sai
    for (const ws of this.ctx.getWebSockets()) {
      const j = ws.deserializeAttachment();
      if (j && j.uid === u.id) {
        try { ws.send(JSON.stringify({ t: 'erro', fim: true, msg: 'Você entrou neste mundo em outro lugar.' })); } catch {}
        ws.serializeAttachment(null);
        try { ws.close(4001, 'outro lugar'); } catch {}
        this.enviarTodos({ t: 'saiu', id: j.id }, ws);
      }
    }
    if (this.ctx.getWebSockets().filter((w) => w.deserializeAttachment()).length >= MAX_JOGADORES) {
      servidor.accept();
      servidor.send(JSON.stringify({ t: 'erro', fim: true, msg: 'Este mundo está cheio agora. Tente daqui a pouco!' }));
      servidor.close(4003, 'cheia');
      return new Response(null, { status: 101, webSocket: cliente });
    }
    const id = u.id + '-' + Math.random().toString(36).slice(2, 7);
    const pos = (await this.ctx.storage.get('p:' + u.id)) || null;
    const eu = { id, uid: u.id, nome: u.nome, cor: u.cor, skin: normalizarSkin(u.skin, u.cor), dono: !!u.dono, mais16: u.mais16 === true, p: pos || [0, 60, 0], r: [0, 0], cota: 0, janela: 0, semVeiculos: opcoes.veiculos === false, guerra: opcoes.tipo === 'guerra' };
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment(eu);

    const econ = await this.econDe(u.id);
    const ed = await this.carregarEdicoes();
    const edicoes = [];
    for (const [k, b] of ed) { if (!blocoOk(b)) continue; const [x, y, z] = k.split(',').map(Number); edicoes.push([x, y, z, b]); }
    // sem ciclo de dia e noite: sempre de manhã clarinha
    const dia = opcoes.cicloDia === false ? 0.3 : this.diaAgora();
    const vs = await this.carregarVeiculos();
    const ocup = this.ocupacao();
    const veiculos = [...vs.values()].map((v) => ({ ...pubV(v), ocup: ocup.get(v.id) || [] }));
    const vparados = await this.carregarParados();
    const lugares = (await this.ctx.storage.get('l:' + u.id)) || { casa: null, lista: [] };
    const barra = (await this.ctx.storage.get('h:' + u.id)) || null;
    const chao = (await this.carregarChao()).lista().map((d) => publico(d));
    servidor.send(JSON.stringify({
      t: 'ola', eu: id, semente: this.info.semente, edicoes, pos, dia, dono: eu.dono, lugares, opcoes, econ, veiculos, vparados: [...vparados], barra, chao,
      chat: this.chat(), historico: this.chatRecente(),
      jogadores: this.jogadores().filter((j) => j.id !== id).map(({ id, nome, cor, skin, p, r, voz }) => ({ id, nome, cor, skin, p, r, voz: !!voz })),
    }));
    this.enviarTodos({ t: 'entrou', j: { id, nome: u.nome, cor: u.cor, skin: eu.skin, p: eu.p, r: eu.r } }, servidor);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  chat() { return (this.info && this.info.chat) || { texto: true, voz: true }; }

  async mudarChat(chat) {
    const antes = this.chat();
    this.info.chat = chat;
    await this.ctx.storage.put('info', this.info);
    if (antes.texto === chat.texto && antes.voz === chat.voz) return;
    if (!chat.texto) this.historico = [];
    // voz desligada: todo mundo sai da voz
    if (!chat.voz) for (const ws of this.ctx.getWebSockets()) {
      const j = ws.deserializeAttachment();
      if (j && j.voz) { j.voz = false; ws.serializeAttachment(j); }
    }
    this.enviarTodos({ t: 'chat-op', ...chat });
  }

  chatRecente() {
    const agora = Date.now();
    return (this.historico || []).filter((h) => agora - h.em < CHAT_HISTORICO_MS).map(({ id, nome, txt }) => ({ id, nome, txt }));
  }

  // mensagem de texto: filtro de palavrão/contato e limite de quantas por vez (por pessoa, reconectar não zera)
  mandarChat(ws, eu, m) {
    if (!this.chat().texto) { ws.send(JSON.stringify({ t: 'chat-erro', msg: 'O chat de texto está desligado neste mundo.' })); return; }
    const f = filtrarChat(m.txt);
    if (f.erro) { ws.send(JSON.stringify({ t: 'chat-erro', msg: f.erro })); return; }
    const agora = Date.now();
    if (!this.chatUid) this.chatUid = new Map();
    const c = this.chatUid.get(eu.uid) || { em: [], ult: '', ultEm: 0 };
    c.em = c.em.filter((t) => agora - t < CHAT_JANELA);
    if ((c.em.length && agora - c.em[c.em.length - 1] < CHAT_INTERVALO) || c.em.length >= CHAT_NA_JANELA) {
      ws.send(JSON.stringify({ t: 'chat-erro', msg: 'Calma! Espere um pouquinho para mandar outra mensagem.' }));
      this.chatUid.set(eu.uid, c);
      return;
    }
    if (f.texto.toLowerCase() === c.ult && agora - c.ultEm < CHAT_REPETIDA) {
      ws.send(JSON.stringify({ t: 'chat-erro', msg: 'Você acabou de mandar essa mensagem.' }));
      return;
    }
    // telefone picado em várias mensagens ("98 76" + "54 32"...): no máximo 4 algarismos a cada 2 minutos
    c.dig = (c.dig || []).filter((d) => agora - d.em < 120000);
    const nd = contarDigitos(f.texto);
    if (nd && c.dig.reduce((a, d) => a + d.n, 0) + nd >= 5) {
      ws.send(JSON.stringify({ t: 'chat-erro', msg: 'Não dá para mandar números de telefone no chat.' }));
      this.chatUid.set(eu.uid, c);
      return;
    }
    if (nd) c.dig.push({ em: agora, n: nd });
    c.em.push(agora); c.ult = f.texto.toLowerCase(); c.ultEm = agora;
    this.chatUid.set(eu.uid, c);
    const msg = { t: 'chat', id: eu.id, nome: eu.nome, txt: f.texto };
    if (!this.historico) this.historico = [];
    this.historico.push({ id: eu.id, nome: eu.nome, txt: f.texto, em: agora });
    if (this.historico.length > CHAT_HISTORICO) this.historico.shift();
    this.enviarTodos(msg); // inclusive para quem mandou (vê como ficou depois do filtro)
  }

  // voz: entrar/sair da conversa e passar os recados do WebRTC só entre quem está na voz
  voz(ws, eu, m) {
    const agora = Date.now();
    if (m.t === 'voz-entrar') {
      if (!this.chat().voz) { ws.send(JSON.stringify({ t: 'chat-erro', msg: 'O chat de voz está desligado neste mundo.' })); return; }
      if (eu.voz) return;
      if (eu.vozEm && agora - eu.vozEm < 1000) return;
      eu.voz = true; eu.vozEm = agora; ws.serializeAttachment(eu);
      // quem acabou de entrar chama os que já estão (assim nunca os dois chamam ao mesmo tempo)
      const ids = this.jogadores().filter((j) => j.voz && j.id !== eu.id).map((j) => j.id);
      ws.send(JSON.stringify({ t: 'voz-lista', ids }));
      this.enviarTodos({ t: 'voz', id: eu.id, on: true }, ws);
    } else if (m.t === 'voz-sair') {
      if (!eu.voz) return;
      eu.voz = false; ws.serializeAttachment(eu);
      this.enviarTodos({ t: 'voz', id: eu.id, on: false }, ws);
    } else if (m.t === 'voz-sinal') {
      if (!eu.voz || typeof m.para !== 'string' || !m.d || typeof m.d !== 'object') return;
      if (!eu.sinJ || agora - eu.sinJ > 5000) { eu.sinJ = agora; eu.sinN = 0; }
      if (++eu.sinN > VOZ_SINAIS_POR_5S) return;
      ws.serializeAttachment(eu);
      const [alvoWs, alvo] = this.conexaoDe(m.para);
      if (!alvoWs || !alvo.voz || alvo.id === eu.id) return;
      const d = {};
      // o IP de casa da criança nunca passa para os outros: só endereços da rede de casa (ou .local) e de servidor de retransmissão
      if (m.d.sdp && typeof m.d.sdp === 'object' && (m.d.sdp.type === 'offer' || m.d.sdp.type === 'answer') && typeof m.d.sdp.sdp === 'string') d.sdp = { type: m.d.sdp.type, sdp: sdpSemIp(m.d.sdp.sdp) };
      else if (m.d.ice && typeof m.d.ice === 'object' && typeof m.d.ice.candidate === 'string') {
        if (m.d.ice.candidate && !candidatoSeguro(m.d.ice.candidate)) return;
        d.ice = { candidate: m.d.ice.candidate, sdpMid: typeof m.d.ice.sdpMid === 'string' ? m.d.ice.sdpMid : null, sdpMLineIndex: Number.isInteger(m.d.ice.sdpMLineIndex) ? m.d.ice.sdpMLineIndex : null };
      } else return;
      alvoWs.send(JSON.stringify({ t: 'voz-sinal', de: eu.id, d }));
    } else if (m.t === 'voz-fala') {
      // aviso de "está falando" (para o desenho em cima da cabeça), no máximo 4 por segundo
      if (!eu.voz || (eu.falaEm && agora - eu.falaEm < 250)) return;
      eu.falaEm = agora; ws.serializeAttachment(eu);
      this.enviarTodos({ t: 'voz-fala', id: eu.id, on: !!m.on }, ws);
    }
  }

  diaAgora() { return ((((Date.now() - this.info.inicio) / 600000) + 0.3) % 1 + 1) % 1; }

  conexaoDe(id) {
    for (const ws of this.ctx.getWebSockets()) { const j = ws.deserializeAttachment(); if (j && j.id === id) return [ws, j]; }
    return [null, null];
  }

  // teleporte até um amigo (ou chamar um amigo): só acontece se o amigo deixar
  pedirTeleporte(ws, eu, m) {
    const agora = Date.now();
    if (m.tipo !== 'ir' && m.tipo !== 'chamar') return;
    // a espera vale por pessoa (não por conexão: reconectar não zera) e cada um recebe no máximo um pedido a cada 4 s
    if (!this.tpUid) this.tpUid = new Map();
    const ultimo = this.tpUid.get(eu.uid) || 0;
    if (agora - ultimo < TP_INTERVALO || (eu.tpEm && agora - eu.tpEm < TP_INTERVALO)) {
      ws.send(JSON.stringify({ t: 'tp-erro', msg: 'Espere um pouquinho antes de pedir de novo.' }));
      return;
    }
    const [alvoWs, alvo] = this.conexaoDe(m.para);
    if (!alvoWs || alvo.id === eu.id) { ws.send(JSON.stringify({ t: 'tp-erro', msg: 'Esse amigo não está mais no mundo.' })); return; }
    if (!this.tpAlvo) this.tpAlvo = new Map();
    if (agora - (this.tpAlvo.get(alvo.uid) || 0) < TP_ALVO_INTERVALO) {
      ws.send(JSON.stringify({ t: 'tp-erro', msg: `${alvo.nome} acabou de receber um pedido. Tente daqui a pouco.` }));
      return;
    }
    this.tpAlvo.set(alvo.uid, agora); this.tpUid.set(eu.uid, agora);
    eu.tpEm = agora; ws.serializeAttachment(eu);
    if (!this.pedidos) this.pedidos = new Map();
    for (const [k, p] of this.pedidos) if (agora > p.ate || p.de === eu.id) this.pedidos.delete(k);
    const pid = Math.random().toString(36).slice(2, 10);
    this.pedidos.set(pid, { de: eu.id, para: alvo.id, tipo: m.tipo, ate: agora + TP_ESPERA });
    alvoWs.send(JSON.stringify({ t: 'tp-pedido', pid, de: eu.id, nome: eu.nome, tipo: m.tipo }));
  }

  responderTeleporte(ws, eu, m) {
    const p = this.pedidos && this.pedidos.get(m.pid);
    if (!p || p.para !== eu.id) return;
    this.pedidos.delete(m.pid);
    const [deWs, de] = this.conexaoDe(p.de);
    if (!deWs) return;
    const ok = m.ok === true && Date.now() <= p.ate;
    deWs.send(JSON.stringify({ t: 'tp-resp', ok, nome: eu.nome, tipo: p.tipo }));
    if (!ok) return;
    // quem vai e para onde: um passinho ao lado de quem fica
    const [vaiWs, fica] = p.tipo === 'ir' ? [deWs, eu] : [ws, de];
    const a = Math.random() * Math.PI * 2;
    const destino = [fica.p[0] + Math.cos(a) * 1.5, fica.p[1] + 0.2, fica.p[2] + Math.sin(a) * 1.5];
    vaiWs.send(JSON.stringify({ t: 'tp-ir', p: arred(destino), nome: fica.nome }));
  }

  async webSocketMessage(ws, dados) {
    if (typeof dados !== 'string' || dados.length > VOZ_SINAL_MAX) return;
    let m; try { m = JSON.parse(dados); } catch { return; }
    if (!m || (dados.length > 2000 && m.t !== 'voz-sinal')) return;
    const eu = ws.deserializeAttachment();
    if (!eu) return;
    if (m.t === 'pos' || m.t === 'emote' || m.t === 'vmov' || m.t === 'buzina' || m.t === 'tiro') {
      // balde simples por conexão (fica na memória)
      if (!this.taxa) this.taxa = new Map();
      const agora = Date.now();
      let t = this.taxa.get(eu.id);
      if (!t || agora - t.ini > 1000) { t = { ini: agora, n: 0 }; this.taxa.set(eu.id, t); }
      if (++t.n > MSG_POR_SEG) return;
    }
    if (m.t === 'pos' && Array.isArray(m.p) && m.p.length === 3 && m.p.every(Number.isFinite)) {
      if (Math.abs(m.p[0]) > LONGE || Math.abs(m.p[2]) > LONGE || m.p[1] < -64 || m.p[1] > 512) return;
      eu.p = m.p.map((v) => Math.round(v * 100) / 100);
      // pv = a posição "andada": segue eu.p no máximo a ANDA_MAX blocos por segundo (o avião, o mais rápido, faz 26).
      // Quem pega item do chão é conferido por ela: dizer que está do lado de um item longe não pega na hora.
      const agoraP = Date.now();
      if (!eu.pv) eu.pv = eu.p;
      else {
        const dt = Math.min(10, (agoraP - (eu.pvEm || agoraP)) / 1000), dx = eu.p[0] - eu.pv[0], dz = eu.p[2] - eu.pv[2];
        const d = Math.hypot(dx, dz), max = ANDA_MAX * dt + 2;
        eu.pv = d <= max ? eu.p : [eu.pv[0] + dx * max / d, eu.p[1], eu.pv[2] + dz * max / d].map((v) => Math.round(v * 100) / 100);
      }
      eu.pvEm = agoraP;
      const fin = (v) => (Number.isFinite(v) ? v : 0); // r:[] deixava o boneco invisível (NaN) nos outros
      eu.r = Array.isArray(m.r) ? [fin(m.r[0]), fin(m.r[1])] : [0, 0];
      ws.serializeAttachment(eu);
      // a = o que o boneco está fazendo (1 batendo, 2 voando, 4 na água, 8 no ar, 16 correndo, 32 agachado): só para a animação
      this.enviarTodos({ t: 'pos', id: eu.id, p: eu.p, r: eu.r, a: (m.a | 0) & 63 }, ws);
      const agora = Date.now();
      if (!eu.salvoEm || agora - eu.salvoEm > 10000) { eu.salvoEm = agora; ws.serializeAttachment(eu); await this.ctx.storage.put('p:' + eu.uid, eu.p); }
    } else if (m.t === 'bloco') {
      const { x, y, z, b } = m;
      if (![x, y, z].every(Number.isInteger) || y < 1 || y > ALTURA_MAX || !blocoOk(b)) return;
      if (Math.abs(x) > LONGE || Math.abs(z) > LONGE) return;
      // mundo sem construção: ninguém coloca nem quebra blocos com as mãos
      if (m.j && !this.regras().construcao) return;
      const op = this.op();
      const econ = econLigada(op) ? await this.econDe(eu.uid) : null;
      // com o mercado, só dá para colocar os blocos que a pessoa já tem
      if (econ && b > 0 && (!liberado(econ, b, op) || !liberado(econ, gastoDe(b), op))) return;
      // coletar e criar: trigo se planta na Terra de plantar e nasce broto (76); maduro só cresce sozinho
      if (econ && op.sobrevivencia && m.j && b === 32) return;
      const ed = await this.carregarEdicoes();
      const k = x + ',' + y + ',' + z;
      // sem "j" (não foi a mão do jogador): só toques (porta, forno, alavanca...) e a física (areia caindo, folhas...)
      // no mundo de Guerra o forte inimigo (radar, canhões) é destruído pelos tiros: some bloco do mundo original
      // sem a mão do jogador. O que alguém construiu (já está nas edições) continua protegido.
      const destruiu = eu.guerra && b === 0 && !ed.has(k);
      // trigo plantado crescendo (plantacoes.js): broto -> verde -> maduro, mandado sem "j" por quem está perto.
      // Só vale na Terra de plantar e no tique em que o sorteio do crescimento deixa (o mesmo que os aparelhos
      // usam): crescer na hora que quiser não dá (senão colhia trigo maduro, que rende mais, sem esperar).
      const cresceu = !m.j && ed.has(k) && ((ed.get(k) === 76 && b === 77) || (ed.get(k) === 77 && b === 32))
        && [31, undefined].includes(ed.get(x + ',' + (y - 1) + ',' + z)) // Terra de plantar (colocada ou da fazenda da vila)
        && podeCrescer(x, y, z, Date.now())
        && Date.now() - ((this.estagioEm && this.estagioEm.get(k)) || 0) >= ESTAGIO_MIN; // cada estágio leva um tempo
      // muda virando árvore (plantacoes.js + arvores-regras.js): primeiro o tronco no lugar da muda, no tique
      // sorteado e depois de 1 min plantada; aí, por 20 s, folhas e tronco só dentro da caixa da árvore e
      // só onde não tem coisa construída (a sala não conhece o mundo gerado: quem confere o espaço é o aparelho)
      const agoraA = Date.now(), arv = (this.arvores ??= new Map());
      const brotou = !m.j && MUDAS.has(ed.get(k)) && (TRONCO_DA_MUDA[ed.get(k)] || []).includes(b)
        && podeCrescerMuda(x, y, z, agoraA) && agoraA - ((this.estagioEm && this.estagioEm.get(k)) || 0) >= MUDA_MIN;
      if (brotou) { arv.set(k, { x, y, z, t: agoraA }); if (arv.size > 500) arv.clear(); }
      const copa = !m.j && !brotou && BLOCOS_ARVORE.has(b) && (!ed.has(k) || !ed.get(k) || BLOCOS_ARVORE.has(ed.get(k)) || [11, 12, 13, 22, 75].includes(ed.get(k)))
        && [...arv.values()].some((a) => agoraA - a.t < 20000 && naCaixa(x - a.x, y - a.y, z - a.z));
      const arvore = brotou || copa;
      // cana-de-açúcar crescendo (plantacoes.js + cana-regras.js): um pedaço novo no vazio em cima de uma cana
      // plantada, no tique sorteado, depois de um tempo do pedaço de baixo e com a coluna menor que 3
      const kAbaixo = x + ',' + (y - 1) + ',' + z;
      let colCana = 0;
      while (colCana < ALTURA_CANA && ed.get(x + ',' + (y - 1 - colCana) + ',' + z) === CANA) colCana++;
      const cana = !m.j && b === CANA && !ed.get(k) && colCana >= 1 && colCana < ALTURA_CANA
        && podeCrescerCana(x, y, z, Date.now())
        && Date.now() - ((this.estagioEm && this.estagioEm.get(kAbaixo)) || 0) >= CANA_MIN;
      if (!m.j && !destruiu && !cresceu && !arvore && !cana && !mudancaSemMao(ed.has(k) ? ed.get(k) : m.de, b, this.regras().construcao)) return;
      // fogo (fogo-regras.js): a sala lembra onde está o fogo "de verdade": aceso pelo isqueiro (perto de quem
      // acendeu e, coletando, com isqueiro na mochila) ou espalhado de um fogo de verdade (herda a marca).
      // O que alguém construiu só pega fogo de fogo de verdade; o fogo sem marca (o da lava, ou o de um aparelho
      // modificado mentindo o "de") só queima o que é do mundo original. Os aparelhos seguem a mesma regra (mundo.js).
      if (!m.j && b === FOGO) {
        const bons = (this.fogoBom ??= new Map()); // posição -> [x, y, z] do isqueiro que acendeu
        const atual = ed.has(k) ? ed.get(k) : m.de | 0;
        const construido = !!(ed.has(k) && ed.get(k));
        // herda a marca só ao queimar algo que pega fogo (não anda pelo ar) e perto do isqueiro de origem
        let bom = null;
        if (inflamavel(atual)) for (const [a, c, d] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          const o = bons.get((x + a) + ',' + (y + c) + ',' + (z + d));
          if (o && Math.max(Math.abs(x - o[0]), Math.abs(y - o[1]), Math.abs(z - o[2])) <= ALCANCE_FOGO) { bom = o; break; }
        }
        if (m.isq) {
          if (!this.regras().construcao) return; // isqueiro é ação de jogador: mundo sem construção, nada
          const p = eu.pv || eu.p || [0, 0, 0]; // a posição andada (não dá para pular de longe)
          const perto = Math.hypot(x + 0.5 - p[0], y - p[1], z + 0.5 - p[2]) < 9;
          const tem = !(econ && op.sobrevivencia) || (econ.itens[ISQUEIRO] || 0) > 0;
          if (!perto || !tem || construido) return;
          bom = [x, y, z];
        }
        if (construido && !bom) return;
        if (bom) { bons.set(k, bom); if (bons.size > 20000) bons.clear(); }
      }
      if (b !== FOGO && this.fogoBom) this.fogoBom.delete(k);
      // coletar e criar: água parada só sai com balde na mão (a mira atravessa a água)
      if (econ && op.sobrevivencia && m.j && b === 0 && (m.mao | 0) !== 1009) {
        const de0 = ed.has(k) ? ed.get(k) : m.de | 0;
        if (de0 === 5 || (de0 >= 23 && de0 <= 30) || (de0 >= 215 && de0 <= 219)) { ws.send(JSON.stringify({ t: 'econ', s: econ })); return; } // lava também
      }
      // coletar e criar: só coloca o que tem na mochila
      if (econ && op.sobrevivencia && m.j && b > 0 && lugarVazio(ed.has(k) ? ed.get(k) | 0 : m.de | 0) && !((econ.itens[gastoDe(b)] || 0) > 0)) {
        ws.send(JSON.stringify({ t: 'econ', s: econ })); // devolve a mochila certa para o aparelho
        return;
      }
      // limite: 25 blocos por segundo por jogador
      const agora = Date.now();
      if (agora - eu.janela > 1000) { eu.janela = agora; eu.cota = 0; }
      if (!arvore && ++eu.cota > 25) return; // a árvore inteira (até ~60 blocos) chega de uma vez
      ws.serializeAttachment(eu);
      if (!ed.has(k) && ed.size >= MAX_EDICOES) return;
      let natural = !ed.has(k); // ninguém mexeu aqui ainda: é um bloco do mundo original
      // o que estava ali: se alguém já mexeu, quem sabe é o servidor (não dá para "quebrar um lampião" que não existe)
      let de = ed.has(k) ? ed.get(k) | 0 : m.de | 0;
      if (b === 0 && econ && m.j && (natural || op.sobrevivencia)) {
        // coleta só perto do jogador e no máximo 40 itens por minuto (por conta: reconectar não zera)
        const min = Math.floor(Date.now() / 60000), c = (this.coleta ??= new Map()).get(eu.uid) || { min, n: 0 };
        if (c.min !== min) { c.min = min; c.n = 0; }
        if (Math.hypot(x + 0.5 - eu.p[0], z + 0.5 - eu.p[2]) > 10 || ++c.n > 40) { natural = false; if (op.sobrevivencia) de = 0; }
        this.coleta.set(eu.uid, c);
      }
      const eraForno = ed.get(k) === FORNALHA && b !== FORNALHA;
      const eraBau = ed.get(k) === BAU && b !== BAU;
      ed.set(k, b);
      await this.ctx.storage.put('b:' + k, b);
      if (b === 76 || b === 77 || b === CANA || MUDAS.has(b)) { (this.estagioEm ??= new Map()).set(k, Date.now()); if (this.estagioEm.size > 5000) this.estagioEm.clear(); }
      // j: foi a mão de alguém (os outros ouvem o som de quebrar/colocar; água escorrendo fica quieta)
      this.enviarTodos(m.j ? { t: 'bloco', x, y, z, b, j: 1 } : b === FOGO && this.fogoBom && this.fogoBom.has(k) ? { t: 'bloco', x, y, z, b, bom: this.fogoBom.get(k) } : { t: 'bloco', x, y, z, b }, ws);
      // "c:x,y,z" = ali está um bloco feito com coisa comprada (quebrar devolve marcado, para ninguém lucrar
      // colocando e quebrando, nem passando para um amigo quebrar). Mudou o bloco, a marca sai.
      const comprado = !natural && !!(await this.ctx.storage.get('c:' + k));
      if (comprado) await this.ctx.storage.delete('c:' + k);
      if (econ && m.j) { // só o que o jogador fez com as mãos
        const r = await this.econAplicar(ws, eu, econ, { t: 'bloco', b, x, y, z, de, natural, comprado, mao: m.mao | 0 }, true);
        if (r && r.ok && r.marca && b > 0) await this.ctx.storage.put('c:' + k, 1);
        // coletar e criar: quebrou com as mãos, o que tinha ali cai no chão
        if (r && r.ok && r.cai && b === 0) await this.soltarNoChao(r.cai.map(([id, n, c]) => [id, n, x + 0.5, y + 0.3, z + 0.5, null, c]), '', eu.uid);
      }
      if (eraForno) await this.fornoSumiu(x, y, z, eu.uid); // quebrou a fornalha: o que tinha dentro cai no chão
      if (eraBau) await this.bauSumiu(x, y, z, eu.uid); // quebrou o baú: o que tinha dentro cai no chão
    } else if (m.t === 'vnovo') {
      if (eu.semVeiculos || !LUGARES[m.tipo] || MILITARES.has(m.tipo) || !posOk(m.p) || m.p.length !== 3 || !Number.isFinite(m.r)) return;
      const cor = Number.isInteger(m.cor) && m.cor >= 0 && m.cor < 8 ? m.cor : 0;
      // com o mercado ligado, só sai da garagem o que a pessoa comprou ou montou (e do jeito que guardou)
      const econV = await this.econDe(eu.uid);
      if (!temVeiculo(econV, m.tipo)) { ws.send(JSON.stringify({ t: 'erro', msg: 'Esse veículo ainda não é seu. Compre ou monte na garagem!' })); return; }
      const [comb, dano] = estadoDaGaragem(econV, m.tipo, Date.now());
      const agora = Date.now();
      if (eu.ultimoVeiculo && agora - eu.ultimoVeiculo < 1500) return;
      eu.ultimoVeiculo = agora; ws.serializeAttachment(eu);
      const vs = await this.carregarVeiculos();
      const ocup = this.ocupacao();
      const vazio = (v) => !(ocup.get(v.id) || []).some(Boolean);
      // limite: some o mais antigo (e vazio) do próprio jogador, ou do mundo
      const meus = [...vs.values()].filter((v) => v.dono === eu.uid).sort((a, b) => a.t - b.t);
      const daGaragem = [...vs.values()].filter((v) => !v.k);
      const cheio = meus.length >= MAX_VEICULOS_POR_JOGADOR || daGaragem.length >= MAX_VEICULOS;
      const tirar = meus.length >= MAX_VEICULOS_POR_JOGADOR ? meus.find(vazio) : daGaragem.length >= MAX_VEICULOS ? daGaragem.sort((a, b) => a.t - b.t).find(vazio) : null;
      if (cheio && !tirar) { ws.send(JSON.stringify({ t: 'erro', msg: 'Tem veículos demais aqui. Guarde algum!' })); return; }
      if (tirar) { vs.delete(tirar.id); await this.ctx.storage.delete('v:' + tirar.id); this.enviarTodos({ t: 'vfim', id: tirar.id }); }
      const seq = ((await this.ctx.storage.get('vseq')) || 0) + 1;
      await this.ctx.storage.put('vseq', seq);
      const v = { id: 'v' + seq, tipo: m.tipo, cor, p: m.p.map((x) => arrV(x)), r: arrV(m.r, 1000), dono: eu.uid, t: agora, c: fracao(comb, 1), d: fracao(dano, 0) };
      vs.set(v.id, v);
      await this.ctx.storage.put('v:' + v.id, v);
      const pub = pubV(v);
      this.enviarTodos({ t: 'vnovo', v: pub }, ws);
      ws.send(JSON.stringify({ t: 'vnovo', v: pub, n: Number.isFinite(m.n) ? m.n : 0 }));
    } else if (m.t === 'vparado') {
      // veículo que mora numa vila/porto: o primeiro que chega perto pede, e ele aparece uma vez só
      if (eu.semVeiculos || !LUGARES[m.tipo] || MILITARES.has(m.tipo) || typeof m.k !== 'string' || !/^[va][-0-9a-z.,]{1,40}$/.test(m.k) || !posOk(m.p) || m.p.length !== 3 || !Number.isFinite(m.r)) return;
      // só perto de quem pede (o jogo pede os que estão a até 90 blocos) e no máximo 12 a cada 15 s por jogador
      // (uma vila tem alguns; sem limite, um aparelho modificado criava milhares e enchia o mundo)
      if (!eu.p || Math.hypot(m.p[0] - eu.p[0], m.p[2] - eu.p[2]) > 120) return;
      const agoraV = Date.now();
      if (!eu.vparJ || agoraV - eu.vparJ > 15000) { eu.vparJ = agoraV; eu.vparN = 0; }
      if (++eu.vparN > 12) return;
      ws.serializeAttachment(eu);
      const par = await this.carregarParados();
      if (par.has(m.k) || par.size > 3000) return;
      par.add(m.k);
      await this.ctx.storage.put('vpar', [...par]);
      const vs = await this.carregarVeiculos();
      const ocup = this.ocupacao();
      const moram = [...vs.values()].filter((v) => v.k && !MILITARES.has(v.tipo)).sort((a, b) => a.t - b.t);
      if (moram.length >= MAX_PARADOS) {
        const tirar = moram.find((v) => !(ocup.get(v.id) || []).some(Boolean));
        if (!tirar) return;
        vs.delete(tirar.id); await this.ctx.storage.delete('v:' + tirar.id); this.enviarTodos({ t: 'vfim', id: tirar.id });
      }
      const seq = ((await this.ctx.storage.get('vseq')) || 0) + 1;
      await this.ctx.storage.put('vseq', seq);
      const cor = Number.isInteger(m.cor) && m.cor >= 0 && m.cor < 8 ? m.cor : 0;
      const v = { id: 'v' + seq, tipo: m.tipo, cor, p: m.p.map((x) => arrV(x)), r: arrV(m.r, 1000), dono: null, k: m.k, t: Date.now(), c: 0.6 + (cor % 4) * 0.1, d: 0 };
      vs.set(v.id, v);
      await this.ctx.storage.put('v:' + v.id, v);
      this.enviarTodos({ t: 'vnovo', v: pubV(v) });
    } else if (m.t === 'servico') {
      // posto: abastecer/carregar ("comb") ou consertar ("conserto"); com o mercado ligado custa moedas
      if (!eu.v || eu.v[0] !== m.id || eu.v[1] !== 0 || (m.k !== 'comb' && m.k !== 'conserto')) return;
      const agora = Date.now();
      if (eu.servEm && agora - eu.servEm < 800) return;
      eu.servEm = agora; ws.serializeAttachment(eu);
      const v = (await this.carregarVeiculos()).get(m.id);
      if (!v) return;
      const falta = m.k === 'comb' ? 1 - fracao(v.c, 1) : fracao(v.d, 0);
      if (falta <= 0.005) return;
      const econ = await this.econDe(eu.uid);
      const r = aplicar(econ, this.op(), { t: 'servico', k: m.k, falta });
      if (!r.ok) { ws.send(JSON.stringify({ t: 'econ-erro', msg: r.erro + ' Venda coisas na loja da vila!' })); return; }
      if (this.op().mercado) { await this.ctx.storage.put('e:' + eu.uid, econ); ws.send(JSON.stringify({ t: 'econ', s: econ, feitos: [] })); }
      if (m.k === 'comb') v.c = 1; else v.d = 0;
      await this.ctx.storage.put('v:' + v.id, v);
      this.enviarTodos({ t: 'vestado', id: v.id, c: fracao(v.c, 1), d: fracao(v.d, 0) });
    } else if (m.t === 'ventrar') {
      const v = (await this.carregarVeiculos()).get(m.id);
      if (!v || Math.hypot(v.p[0] - eu.p[0], v.p[1] - eu.p[1], v.p[2] - eu.p[2]) > 12) return;
      const atual = this.ocupacao().get(v.id) || [];
      let a = -1;
      // o volante é só de quem tem a chave (o dono); os outros vão de passageiro. Os das vilas qualquer um dirige
      const comChave = !v.dono || v.dono === eu.uid;
      for (let i = comChave ? 0 : 1; i < LUGARES[v.tipo]; i++) if (!atual[i]) { a = i; break; }
      if (a < 0) { ws.send(JSON.stringify({ t: 'erro', msg: 'Está cheio!' })); return; }
      if (eu.v) await this.descer(ws, eu);
      eu.v = [v.id, a];
      ws.serializeAttachment(eu);
      this.enviarTodos({ t: 'vassento', id: v.id, a, j: eu.id });
    } else if (m.t === 'vsair') {
      await this.descer(ws, eu);
    } else if (m.t === 'vmov') {
      if (!eu.v || eu.v[0] !== m.id || eu.v[1] !== 0 || !posOk(m.p) || m.p.length !== 3 || !Array.isArray(m.r)) return;
      const v = (await this.carregarVeiculos()).get(m.id);
      if (!v) return;
      v.p = m.p.map((x) => arrV(x));
      v.r = Number.isFinite(m.r[0]) ? arrV(m.r[0], 1000) : 0;
      // combustível e dano: quem dirige calcula (gasta andando, amassa batendo); o posto é com a sala
      v.c = fracao(m.c, fracao(v.c, 1)); v.d = fracao(m.d, fracao(v.d, 0));
      const r = m.r.slice(0, 3).map((x) => (Number.isFinite(x) ? arrV(x, 1000) : 0));
      this.enviarTodos({ t: 'vmov', id: v.id, p: v.p, r, s: Number.isFinite(m.s) ? arrV(m.s, 10) : 0, c: v.c, d: v.d }, ws);
      const agora = Date.now();
      if (!v.salvoEm || agora - v.salvoEm > 5000) { v.salvoEm = agora; await this.ctx.storage.put('v:' + v.id, v); }
    } else if (m.t === 'vguardar') {
      const vs = await this.carregarVeiculos();
      const v = vs.get(m.id);
      if (!v || (v.dono !== eu.uid && !eu.dono)) return;
      const atual = this.ocupacao().get(v.id) || [];
      if (v.k || atual.some((j) => j && j !== eu.id)) return; // o que mora na vila fica lá
      if (eu.v && eu.v[0] === v.id) { eu.v = null; ws.serializeAttachment(eu); }
      // a garagem lembra como ele estava (o mecânico abastece e conserta aos poucos)
      const econG = await this.econDe(eu.uid);
      if (aplicar(econG, this.op(), { t: 'garagem', tipo: v.tipo, s: [fracao(v.c, 1), fracao(v.d, 0)], agora: Date.now() }).ok) await this.ctx.storage.put('e:' + eu.uid, econG);
      vs.delete(v.id);
      await this.ctx.storage.delete('v:' + v.id);
      this.enviarTodos({ t: 'vfim', id: v.id });
    } else if (m.t === 'tiro' || m.t === 'arma' || m.t === 'acerto' || m.t === 'caiu' || m.t === 'pegar' || m.t === 'pegos') {
      if (this.regras().armas) this.armas(ws, eu, m);
    } else if (m.t === 'gveic' || m.t === 'gx' || m.t === 'gdano' || m.t === 'gexp') {
      if (eu.guerra) await this.guerra(ws, eu, m);
    } else if (m.t === 'buzina') {
      if (!eu.v || eu.v[0] !== m.id) return;
      this.enviarTodos({ t: 'buzina', id: m.id }, ws);
    } else if (m.t === 'skin' && m.s && typeof m.s === 'object') {
      // trocou de personagem no meio do jogo: os amigos veem na hora (a conta já salvou pela API)
      const agora = Date.now();
      if (eu.skinEm && agora - eu.skinEm < 1500) return;
      eu.skinEm = agora;
      eu.skin = normalizarSkin(m.s, eu.cor);
      ws.serializeAttachment(eu);
      this.enviarTodos({ t: 'skin', id: eu.id, s: eu.skin }, ws);
    } else if (m.t === 'racha') {
      // rachadura de um bloco (só para os outros verem); no máximo ~7 por segundo
      const { x, y, z, b, n, de } = m;
      if (![x, y, z, b, n, de].every(Number.isInteger) || !blocoOk(b) || y < 1 || y > ALTURA_MAX || n < 1 || de < 2 || de > 99 || n >= de) return;
      const agora = Date.now();
      if (eu.rachaEm && agora - eu.rachaEm < 140) return;
      eu.rachaEm = agora;
      this.enviarTodos({ t: 'racha', x, y, z, b, n, de }, ws);
    } else if (m.t === 'emote' && EMOTES.has(m.e)) {
      // no máximo um emote a cada 0,8 s (evita encher a tela/os ouvidos dos outros)
      const agora = Date.now();
      if (eu.emEm && agora - eu.emEm < 800) return;
      eu.emEm = agora; ws.serializeAttachment(eu);
      this.enviarTodos({ t: 'emote', id: eu.id, e: m.e }, ws);
    } else if (m.t === 'chat' && typeof m.txt === 'string') {
      this.mandarChat(ws, eu, m);
    } else if (m.t === 'voz-entrar' || m.t === 'voz-sair' || m.t === 'voz-sinal' || m.t === 'voz-fala') {
      this.voz(ws, eu, m);
    } else if (m.t === 'tp-pedir' && typeof m.para === 'string') {
      this.pedirTeleporte(ws, eu, m);
    } else if (m.t === 'tp-resp' && typeof m.pid === 'string') {
      this.responderTeleporte(ws, eu, m);
    } else if (m.t === 'lugares') {
      // casa e lugares salvos de cada jogador neste mundo
      const agora = Date.now();
      if (eu.lugEm && agora - eu.lugEm < 500) return;
      eu.lugEm = agora; ws.serializeAttachment(eu);
      await this.ctx.storage.put('l:' + eu.uid, limparLugares(m));
    } else if (m.t === 'barra' && barraOk(m.barra)) {
      // a barra de baixo de cada jogador (coletar e criar), no máximo 1 vez a cada 0,5 s
      const agora = Date.now();
      if (eu.barEm && agora - eu.barEm < 500) return;
      eu.barEm = agora; ws.serializeAttachment(eu);
      await this.ctx.storage.put('h:' + eu.uid, m.barra);
    } else if (m.t === 'dia' && Number.isFinite(m.v)) {
      // só o dono do mundo muda a hora (vale para todo mundo)
      if (!eu.dono) { ws.send(JSON.stringify({ t: 'tp-erro', msg: 'Só o dono do mundo pode mudar a hora.' })); return; }
      const agoraDia = Date.now();
      if (eu.diaEm && agoraDia - eu.diaEm < 3000) return;
      eu.diaEm = agoraDia; ws.serializeAttachment(eu);
      const v = ((m.v % 1) + 1) % 1;
      this.info.inicio = Date.now() - (v - 0.3) * 600000;
      await this.ctx.storage.put('info', this.info);
      this.enviarTodos({ t: 'dia', v, nome: eu.nome });
    } else if (m.t === 'dormir' && Array.isArray(m.b) && m.b.length === 3 && m.b.every(Number.isFinite)) {
      // deitar na cama: só de noite, perto de uma cama de verdade; quando todo mundo deita, amanhece
      if (this.info.cicloDia === false) return;
      const nao = (msg) => ws.send(JSON.stringify({ t: 'sono-erro', msg }));
      if (!podeDormir(this.diaAgora())) return nao('Só dá para dormir de noite (depois do pôr do sol)');
      const [bx, by, bz] = m.b.map(Math.floor);
      const ed = await this.carregarEdicoes(), k = bx + ',' + by + ',' + bz;
      if (ed.has(k) && !ehCama(ed.get(k))) return nao('Isso não é uma cama');
      if (!eu.p || Math.hypot(eu.p[0] - bx - 0.5, eu.p[1] - by, eu.p[2] - bz - 0.5) > PERTO_DA_CAMA + 2) return nao('Chegue mais perto da cama');
      if (!eu.dorme) { eu.dorme = true; ws.serializeAttachment(eu); }
      this.verSono(null, eu.nome);
    } else if (m.t === 'acordar') {
      if (eu.dorme) { eu.dorme = false; ws.serializeAttachment(eu); this.verSono(); }
    } else if (m.t === 'ev' || m.t === 'vender' || m.t === 'comprar' || m.t === 'criar' || m.t === 'moer' || m.t === 'assar' || m.t === 'alimentar' || m.t === 'acender' || m.t === 'comer' || m.t === 'golpe' || m.t === 'comprarV' || m.t === 'montarV' || m.t === 'chave') {
      const op = this.op();
      const deVeiculo = m.t === 'comprarV' || m.t === 'montarV' || m.t === 'chave';
      if (!econLigada(op) && !deVeiculo) return; // chave de veículo vale mesmo sem mercado
      if (deVeiculo && (eu.semVeiculos || typeof m.tipo !== 'string')) return;
      // a bancada quem confere é a sala: alguma bancada colocada perto de onde o jogador está
      if (m.t === 'criar') m = { t: 'criar', r: String(m.r), n: Math.max(1, Math.min(64, m.n | 0 || 1)), bancada: await this.bancadaPerto(eu.p) };
      // no máximo 10 por segundo
      const agora = Date.now();
      if (!eu.jeco || agora - eu.jeco > 1000) { eu.jeco = agora; eu.neco = 0; }
      if (++eu.neco > 10) { if (eu.neco === 11) ws.send(JSON.stringify({ t: 'econ', s: await this.econDe(eu.uid) })); return; } // devolve a mochila certa
      // lã e caça: os bichos só existem no aparelho de cada um, então a sala não vê a ovelha; o que dá para
      // conferir é o ritmo. Derrubar um bicho leva vários golpes (mais de um a cada 1,5 s não é de verdade) e
      // cada ovelha dá lã uma vez por minuto (mais de uma lã a cada 4 s não é de verdade).
      if (m.t === 'ev' && (m.e === 'caca' || m.e === 'la')) {
        const k = m.e === 'caca' ? 'cacaEm' : 'laEm', espera = m.e === 'caca' ? 1500 : 4000;
        if (eu[k] && agora - eu[k] < espera) return;
        eu[k] = agora;
        // e por conta, por minuto (reconectar ou abrir duas abas não zera): sem isso um aparelho modificado
        // dizia "derrubei um urso" a cada 1,5 s e ganhava carne e couro sem fim
        const min = Math.floor(agora / 60000), kc = m.e + ':' + eu.uid, lim = this.bichosMin ??= new Map();
        const c = lim.get(kc) || { min, n: 0 };
        if (c.min !== min) { c.min = min; c.n = 0; }
        if (++c.n > (m.e === 'caca' ? MAX_CACA_MIN : MAX_LA_MIN)) return;
        lim.set(kc, c);
      }
      ws.serializeAttachment(eu);
      const econ = await this.econDe(eu.uid);
      if (m.t === 'ev' && (m.e === 'caca' || m.e === 'la')) {
        // cai no chão onde o bicho está (perto de quem fez; longe demais vai para os pés do jogador)
        const onde = [m.x, m.y, m.z].every(Number.isFinite) && Math.hypot(m.x - eu.p[0], m.z - eu.p[2]) <= 12 && Math.abs(m.y - eu.p[1]) <= 12
          ? [m.x, m.y, m.z] : [eu.p[0], eu.p[1] + 1, eu.p[2]];
        m = { t: 'ev', e: m.e, b: m.b, f: m.f, x: onde[0], y: onde[1], z: onde[2] };
      }
      const r = await this.econAplicar(ws, eu, econ, m, m.t === 'ev');
      if (r && r.ok && r.cai && m.t === 'ev') await this.soltarNoChao(r.cai.map(([id, n]) => [id, n, m.x, m.y, m.z]), '', eu.uid);
    } else if (ACOES_TRABALHO.has(m.t)) {
      const op = this.op();
      if (!op.mercado) return;
      // mundo sem Construção: o pedreiro também não constrói
      if (m.t === 'obra' && !this.regras().construcao) return ws.send(JSON.stringify({ t: 'econ-erro', msg: 'Neste mundo não dá para construir.' }));
      const agora = Date.now();
      const econ = await this.econDe(eu.uid);
      if (m.t === 'turno') {
        // o tempo quem mede é a sala (pelo relógio dela), e a hora do dia também
        if (!this.turnos) this.turnos = new Map();
        const ult = this.turnos.get(eu.uid);
        this.turnos.set(eu.uid, agora);
        if (!ult || agora - ult < 1500) return;
        const dt = (agora - ult) / 1000;
        const dia = this.info.cicloDia === false ? 0.3 : this.diaAgora();
        m = { t: 'turno', dt: dt > MAX_TURNO * 2 ? 0 : Math.min(MAX_TURNO, dt), hora: horaDe(dia) };
        if (!m.dt || !econ.equipe.length) return;
      } else {
        if (!eu.jtr || agora - eu.jtr > 1000) { eu.jtr = agora; eu.ntr = 0; }
        if (++eu.ntr > 6) return;
        ws.serializeAttachment(eu);
        m = { ...m, nome: typeof m.nome === 'string' ? m.nome.slice(0, 24) : undefined };
        // obra só em lugar livre: se no volume dela tem bloco colocado por alguém, o pedreiro não derruba
        if (m.t === 'obra') {
          const nao = await this.obraSobreConstrucao(m);
          if (nao) { ws.send(JSON.stringify({ t: 'econ-erro', msg: nao })); return; }
        }
      }
      await this.econAplicar(ws, eu, econ, m, m.t === 'turno', { pos: eu.p, agora });
    } else if (m.t === 'chao-pegar' && Number.isInteger(m.i)) {
      // pegou um item do chão (passou perto)
      const op = this.op();
      if (!temMochila(op) || !this.balde(ws, eu, 'pg', 30)) return;
      const c = await this.carregarChao();
      const econ = await this.econDe(eu.uid);
      const d = c.itens.get(m.i);
      // já foi (outro pegou ou sumiu): o aparelho tira da tela e volta a mochila certa
      if (!d) { ws.send(JSON.stringify({ t: 'chao-pegou', i: m.i, j: null })); ws.send(JSON.stringify({ t: 'econ', s: econ })); return; }
      if (!podePegar(d, eu.id) || !pertoParaPegar(d, eu.pv || eu.p)) { ws.send(JSON.stringify({ t: 'econ', s: econ })); ws.send(JSON.stringify({ t: 'chao', d: [publico(d)] })); return; }
      const r = aplicar(econ, op, { t: 'pegar', id: d.id, n: d.n, c: d.c, d: d.dg });
      if (!r.ok) { ws.send(JSON.stringify({ t: 'econ', s: econ, msg: r.erro })); ws.send(JSON.stringify({ t: 'chao', d: [publico(d)] })); return; }
      // a mochila só tinha espaço para parte da pilha: pega o que cabe e o resto continua no chão
      if (r.pegou < d.n) {
        d.n -= r.pegou; d.c = r.restoC; if (d.dg) { d.dg = r.restoD; if (!d.dg || !d.dg.some((v) => v > 0)) delete d.dg; }
        await this.ctx.storage.put('d:' + d.i, d);
        await this.ctx.storage.put('e:' + eu.uid, econ);
        ws.send(JSON.stringify({ t: 'econ', s: econ }));
        this.enviarTodos({ t: 'chao-pegou', i: d.i, j: eu.id, id: d.id, n: r.pegou, resto: d.n, c: d.c });
        return;
      }
      c.tirar(d.i);
      await this.ctx.storage.delete('d:' + d.i);
      await this.ctx.storage.put('e:' + eu.uid, econ);
      ws.send(JSON.stringify({ t: 'econ', s: econ }));
      this.enviarTodos({ t: 'chao-pegou', i: d.i, j: eu.id, id: d.id, n: d.n });
    } else if (m.t === 'morrer') {
      // morreu (jogo clássico, com fome): o que estava na mochila cai no chão onde a pessoa estava.
      // Só perde as próprias coisas; no máximo uma vez a cada 3 s.
      const op = this.op();
      if (!op.fome || !this.balde(ws, eu, 'mo', 1, 3000)) return;
      const econ = await this.econDe(eu.uid);
      const r = aplicar(econ, op, { t: 'morrer' });
      if (!r.ok) return;
      await this.ctx.storage.put('e:' + eu.uid, econ);
      ws.send(JSON.stringify({ t: 'econ', s: econ }));
      const [x, y, z] = eu.p;
      await this.soltarNoChao(r.cai.map(([id, n, c, dg]) => [id, n, x, y + 0.6, z, [(Math.random() - 0.5) * 4, 3 + Math.random() * 2, (Math.random() - 0.5) * 4], c, dg, String(eu.uid)]), '', eu.uid);
    } else if (m.t === 'forno-ver' || m.t === 'forno-por' || m.t === 'forno-tirar') {
      // fornalha (fornalha-regras.js): o estado é do mundo (todos usam a mesma) e fica na sala
      const op = this.op();
      if (!op.sobrevivencia || ![m.x, m.y, m.z].every(Number.isInteger)) return;
      const k = m.x + ',' + m.y + ',' + m.z, ed = await this.carregarEdicoes();
      // recusou: devolve a mochila certa (o aparelho já tinha mexido nela)
      const recusar = async (f) => { if (m.t !== 'forno-ver') ws.send(JSON.stringify({ t: 'econ', s: await this.econDe(eu.uid) })); if (f !== undefined) ws.send(JSON.stringify({ t: 'forno', x: m.x, y: m.y, z: m.z, f })); };
      if (ed.get(k) !== FORNALHA) { await recusar(null); return; }
      if (!eu.p || Math.hypot(eu.p[0] - m.x - 0.5, eu.p[1] - m.y, eu.p[2] - m.z - 0.5) > 9 || !this.balde(ws, eu, 'fo', 12, 1000)) {
        const f0 = await this.fornoDe(k); avancar(f0, Date.now()); await recusar(fornoPublico(f0)); return;
      }
      const f = await this.fornoDe(k), agora = Date.now();
      if (m.t !== 'forno-ver') {
        const econ = await this.econDe(eu.uid);
        const a = m.t === 'forno-por'
          ? { t: m.t, k: m.k === 'c' ? 'c' : 'e', id: m.id | 0, n: Math.max(1, Math.min(64, m.n | 0)), f, agora }
          : { t: m.t, k: ['e', 'c', 's'].includes(m.k) ? m.k : 's', n: Math.max(1, Math.min(64, m.n | 0 || 64)), f, agora };
        const r = await this.econAplicar(ws, eu, econ, a, true);
        if (r.ok) await this.ctx.storage.put('f:' + k, f);
      } else avancar(f, agora);
      const msg = { t: 'forno', x: m.x, y: m.y, z: m.z, f: fornoPublico(f, agora) };
      if (m.t === 'forno-ver') ws.send(JSON.stringify(msg)); else this.enviarTodos(msg);
    } else if (m.t === 'bau-ver' || m.t === 'bau-por' || m.t === 'bau-tirar') {
      // baú (bau-regras.js): o que tem dentro é do mundo (todos usam o mesmo) e fica na sala
      const op = this.op();
      if (!op.sobrevivencia || ![m.x, m.y, m.z].every(Number.isInteger)) return;
      const k = m.x + ',' + m.y + ',' + m.z, ed = await this.carregarEdicoes();
      // recusou: devolve a mochila certa e o baú certo (o aparelho já tinha mexido nos dois)
      const recusar = async (b) => { if (m.t !== 'bau-ver') ws.send(JSON.stringify({ t: 'econ', s: await this.econDe(eu.uid) })); if (b !== undefined) ws.send(JSON.stringify({ t: 'bau', x: m.x, y: m.y, z: m.z, b })); };
      if (ed.get(k) !== BAU) { await recusar(null); return; }
      if (!eu.p || Math.hypot(eu.p[0] - m.x - 0.5, eu.p[1] - m.y, eu.p[2] - m.z - 0.5) > 9 || !this.balde(ws, eu, 'ba', 15, 1000)) { await recusar(await this.bauDe(k)); return; }
      const b = await this.bauDe(k);
      if (m.t !== 'bau-ver') {
        const econ = await this.econDe(eu.uid);
        const kk = Number.isInteger(m.k) && m.k >= -1 && m.k < 27 ? m.k : -1;
        const a = m.t === 'bau-por'
          ? { t: m.t, k: kk, id: m.id | 0, n: Math.max(1, Math.min(64, m.n | 0)), b }
          : { t: m.t, k: kk, n: Math.max(1, Math.min(64, m.n | 0 || 64)), b };
        const r = await this.econAplicar(ws, eu, econ, a, true);
        if (r && r.ok) { if (vazioBau(b)) await this.ctx.storage.delete('k:' + k); else await this.ctx.storage.put('k:' + k, b); }
        else { await recusar(b); return; }
      }
      const msg = { t: 'bau', x: m.x, y: m.y, z: m.z, b };
      if (m.t === 'bau-ver') ws.send(JSON.stringify(msg)); else this.enviarTodos(msg);
    } else if (m.t === 'chao-largar') {
      // largou da mochila no chão (para guardar depois ou passar para um amigo)
      const op = this.op();
      const id = m.id | 0, n = m.n | 0;
      if (!temMochila(op) || !podeNoChao(id, n) || n > MAX_LARGAR || !this.balde(ws, eu, 'lg', 10)) return;
      const econ = await this.econDe(eu.uid);
      const r = aplicar(econ, op, { t: 'largar', id, n });
      if (!r.ok) { ws.send(JSON.stringify({ t: 'econ', s: econ })); return; }
      await this.ctx.storage.put('e:' + eu.uid, econ);
      ws.send(JSON.stringify({ t: 'econ', s: econ }));
      const v = Array.isArray(m.v) && m.v.length === 3 && m.v.every(Number.isFinite) ? m.v : [0, 2, 0];
      // sai um pouco na frente do jogador (para onde foi jogado), não dentro da cabeça
      const vh = Math.hypot(v[0], v[2]) || 1;
      await this.soltarNoChao([[id, n, eu.p[0] + v[0] / vh * 0.6, eu.p[1] + 1.2, eu.p[2] + v[2] / vh * 0.6, v, r.c, r.d]], eu.id, eu.uid);
    } else if (m.t === 'dar') {
      if (!this.op().mercado) return;
      const agora = Date.now();
      if (eu.dadoEm && agora - eu.dadoEm < 500) return;
      eu.dadoEm = agora; ws.serializeAttachment(eu);
      const alvo = this.ctx.getWebSockets().find((w) => { const j = w.deserializeAttachment(); return j && j.id === m.para; });
      const ja = alvo && alvo.deserializeAttachment();
      if (!ja || ja.uid === eu.uid) return ws.send(JSON.stringify({ t: 'econ-erro', msg: 'Essa pessoa não está mais aqui.' }));
      const de = await this.econDe(eu.uid), para = await this.econDe(ja.uid);
      const falha = dar(de, para, m.n);
      if (falha) return ws.send(JSON.stringify({ t: 'econ-erro', msg: falha }));
      await this.ctx.storage.put({ ['e:' + eu.uid]: de, ['e:' + ja.uid]: para });
      ws.send(JSON.stringify({ t: 'econ', s: de, msg: `Você deu ${m.n | 0} moedas para ${ja.nome}!` }));
      alvo.send(JSON.stringify({ t: 'econ', s: para, msg: `${eu.nome} te deu ${m.n | 0} moedas de presente!` }));
    }
  }

  // ---------- mundo de Guerra ----------
  // gveic: veículo de uma vaga (id fixo "g" + vaga); some e volta para a vaga quando fica abandonado longe dela
  // gx: estrelas de procurado e tiros dos veículos (só o desenho, para os outros verem)
  // gdano / gexp: metralhadora ou bomba do canhão acertando outro jogador (a sala confere e manda o dano)
  async guerra(ws, eu, m) {
    const agora = Date.now();
    if (m.t === 'gveic') {
      if (eu.semVeiculos || !Object.hasOwn(VAGAS_GUERRA, String(m.k)) || VAGAS_GUERRA[m.k] !== m.tipo || !posOk(m.p) || m.p.length !== 3 || !Number.isFinite(m.r)) return;
      // no máximo 6 pedidos a cada 4 s por jogador (uma base tem 3 vagas, a delegacia 2)
      if (!eu.gvEm || agora - eu.gvEm > 4000) { eu.gvEm = agora; eu.gvN = 0; }
      if (++eu.gvN > 6) return;
      ws.serializeAttachment(eu);
      if (Math.hypot(eu.p[0] - m.p[0], eu.p[2] - m.p[2]) > 120) return;
      const vs = await this.carregarVeiculos();
      const id = 'g' + m.k;
      const pub = { id, tipo: m.tipo, cor: 0, p: m.p.map((x) => arrV(x)), r: arrV(m.r, 1000) };
      const v = vs.get(id);
      if (v) {
        const ocupado = (this.ocupacao().get(id) || []).some(Boolean);
        const longeDaVaga = Math.hypot(v.p[0] - pub.p[0], v.p[2] - pub.p[2]) > 30;
        const alguemPerto = this.jogadores().some((j) => Math.hypot(j.p[0] - v.p[0], j.p[2] - v.p[2]) < 50);
        if (ocupado || !longeDaVaga || alguemPerto) { ws.send(JSON.stringify({ t: 'vnovo', v: pubV(v) })); return; }
        vs.delete(id);
        this.enviarTodos({ t: 'vfim', id });
      }
      // mora na vaga (k): qualquer um dirige, ninguém guarda na garagem; volta para a vaga abastecido e consertado
      const novo = { ...pub, dono: null, k: id, t: agora, c: 1, d: 0 };
      vs.set(id, novo);
      await this.ctx.storage.put('v:' + id, novo);
      this.enviarTodos({ t: 'vnovo', v: pubV(novo) });
    } else if (m.t === 'gx') {
      // no máximo 10 por segundo (cada um vira desenho e som em todos os tablets)
      if (!this.balde(ws, eu, 'gx', 10)) return;
      const f = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) ? a.map((x) => arrV(x)) : null;
      if (m.k === 'estrelas') {
        const n = Math.max(0, Math.min(5, m.n | 0));
        eu.estrelas = n; ws.serializeAttachment(eu);
        this.enviarTodos({ t: 'gx', k: 'estrelas', id: eu.id, n }, ws);
      } else if (m.k === 'tiro' || m.k === 'rajada') {
        // só quem está no lugar do atirador de um veículo armado
        const vg = eu.v && eu.v[1] === 0 ? (await this.carregarVeiculos()).get(eu.v[0]) : null;
        if (!vg || !ARMA_VEIC[vg.tipo]) return;
        const o = f(m.o), d = f(m.k === 'tiro' ? m.d : m.f);
        if (!o || !d) return;
        this.enviarTodos(m.k === 'tiro' ? { t: 'gx', k: 'tiro', id: eu.id, o, d } : { t: 'gx', k: 'rajada', id: eu.id, o, f: d }, ws);
      }
    } else {
      // quem atira tem que estar no lugar do atirador de um veículo armado
      if (!eu.v || eu.v[1] !== 0) return;
      const v = (await this.carregarVeiculos()).get(eu.v[0]);
      const A = v && ARMA_VEIC[v.tipo];
      if (!A) return;
      const t = this.taxaGuerra || (this.taxaGuerra = new Map());
      let q = t.get(eu.id);
      if (!q || agora - q.ini > 1000) { q = { ini: agora, n: 0 }; t.set(eu.id, q); }
      const sentadoEmTanque = (j) => { if (!j.v) return false; const w = this.veiculos.get(j.v[0]); return !!w && w.tipo === 'tanque'; };
      if (m.t === 'gdano' && A.alcance) {
        if (++q.n > 12) return;
        const [wsA, alvo] = this.conexaoDe(String(m.alvo));
        if (!alvo || alvo.id === eu.id || sentadoEmTanque(alvo)) return;
        if (Math.hypot(alvo.p[0] - v.p[0], alvo.p[1] - v.p[1], alvo.p[2] - v.p[2]) > A.alcance + 6) return;
        try { wsA.send(JSON.stringify({ t: 'gx', k: 'dano', n: 1, de: eu.nome })); } catch {}
      } else if (m.t === 'gexp' && A.raio) {
        const p = Array.isArray(m.p) && m.p.length === 3 && m.p.every(Number.isFinite) ? m.p : null;
        if (!p || (eu.expEm && agora - eu.expEm < 1800) || Math.hypot(p[0] - v.p[0], p[2] - v.p[2]) > 140) return;
        eu.expEm = agora; ws.serializeAttachment(eu);
        for (const w of this.ctx.getWebSockets()) {
          const j = w.deserializeAttachment();
          if (!j || j.id === eu.id || sentadoEmTanque(j)) continue;
          const d = Math.hypot(j.p[0] - p[0], j.p[1] + 0.9 - p[1], j.p[2] - p[2]);
          if (d < A.raio) try { w.send(JSON.stringify({ t: 'gx', k: 'dano', n: Math.max(1, Math.round(5 * (1 - d / A.raio))), de: eu.nome, exp: 1 })); } catch {}
        }
      }
    }
  }

  op() { return (this.info && this.info.econ) || { mercado: false, objetivos: false, sobrevivencia: false }; }
  regras() { return (this.info && this.info.regras) || { construcao: true, armas: false }; }

  // ---------- armas (só nos mundos com a opção ligada) ----------
  // tiro: só repassa (para os outros verem o risquinho e ouvirem); acerto: confere e avisa quem levou;
  // caiu: quem levou avisa que caiu (e todos veem quem derrubou); pegar: item do chão some para todos
  armas(ws, eu, m) {
    const agora = Date.now();
    const vec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
    // trocar de arma, cair e pegar: no máximo 5 por segundo (cada troca refaz o boneco em todos os tablets)
    if (m.t === 'arma' || m.t === 'caiu' || m.t === 'pegar' || m.t === 'pegos') {
      if (!eu.arJan || agora - eu.arJan > 1000) { eu.arJan = agora; eu.arN = 0; }
      if (++eu.arN > 5) {
        // passou do limite: a arma na mão continua certa aqui (para os acertos), só não avisa os outros agora
        if (m.t === 'arma' && (m.a === null || ARMAS[m.a])) { eu.a = m.a; ws.serializeAttachment(eu); }
        return;
      }
      ws.serializeAttachment(eu);
    }
    if (m.t === 'tiro') {
      if (!ARMAS[m.a] || !vec(m.o) || !vec(m.f)) return;
      this.enviarTodos({ t: 'tiro', id: eu.id, a: m.a, o: arred(m.o), f: arred(m.f) }, ws);
    } else if (m.t === 'arma') {
      const a = m.a === null || ARMAS[m.a] ? m.a : null;
      eu.a = a; ws.serializeAttachment(eu);
      this.enviarTodos({ t: 'arma', id: eu.id, a }, ws);
    } else if (m.t === 'acerto') {
      if (!ARMAS[m.a] || typeof m.alvo !== 'string' || !Number.isInteger(m.dano) || m.dano < 1) return;
      if (eu.a !== m.a) return; // só acerta com a arma que está segurando
      const [alvoWs, alvo] = this.conexaoDe(m.alvo);
      if (!alvoWs || alvo.id === eu.id) return;
      // um acerto por tiro em cada alvo: respeita o tempo entre tiros daquela arma (com folga para a rede)
      if (!this.ultAcerto) this.ultAcerto = new Map();
      const chave = eu.id + '>' + alvo.id, ult = this.ultAcerto.get(chave) || 0;
      if (agora - ult < ARMAS[m.a].intervalo * 800) return;
      this.ultAcerto.set(chave, agora);
      if (this.ultAcerto.size > 2000) for (const [k, t] of this.ultAcerto) if (agora - t > 5000) this.ultAcerto.delete(k);
      // perto o bastante para aquela arma (com folga para o atraso da rede)
      const d = Math.hypot(alvo.p[0] - eu.p[0], alvo.p[1] - eu.p[1], alvo.p[2] - eu.p[2]);
      if (d > ARMAS[m.a].alcance + 8) return;
      // no máximo 15 acertos por segundo de cada jogador
      if (!eu.acJan || agora - eu.acJan > 1000) { eu.acJan = agora; eu.acN = 0; }
      if (++eu.acN > 15) return;
      ws.serializeAttachment(eu);
      alvoWs.send(JSON.stringify({ t: 'ferido', dano: Math.min(m.dano, danoMaximo(m.a)), de: eu.id, nome: eu.nome, p: eu.p }));
      (this.feridoPor ??= new Map()).set(alvo.id, { de: eu.id, t: agora });
    } else if (m.t === 'caiu') {
      // quem derrubou: só vale quem acertou esta pessoa nos últimos 10 segundos (senão inventava "derrubadas" para um amigo)
      const f = this.feridoPor && this.feridoPor.get(eu.id);
      const por = typeof m.por === 'string' && f && f.de === m.por && agora - f.t < 10000 ? this.conexaoDe(m.por)[1] : null;
      if (this.feridoPor) this.feridoPor.delete(eu.id);
      this.enviarTodos({ t: 'caiu', id: eu.id, nome: eu.nome, por: por ? por.id : null, porNome: por ? por.nome : null });
    } else if (m.t === 'pegar') {
      if (typeof m.k !== 'string' || m.k.length > 24) return;
      if (!this.pegos) this.pegos = new Map();
      const antes = this.pegos.get(m.k);
      if (antes && agora - antes < VOLTA_ITEM * 1000) { ws.send(JSON.stringify({ t: 'pegou', k: m.k, id: null, tarde: true })); return; }
      if (this.pegos.size > 5000) for (const [k, t] of this.pegos) if (agora - t > VOLTA_ITEM * 1000) this.pegos.delete(k);
      this.pegos.set(m.k, agora);
      this.enviarTodos({ t: 'pegou', k: m.k, id: eu.id });
    } else if (m.t === 'pegos') {
      // quem acabou de chegar pergunta o que já foi pego (e quanto tempo falta para voltar)
      const l = [];
      if (this.pegos) for (const [k, t] of this.pegos) if (agora - t < VOLTA_ITEM * 1000) l.push([k, Math.round((agora - t) / 1000)]);
      ws.send(JSON.stringify({ t: 'pegos', l: l.slice(0, 2000) }));
      // e as armas que cada um está segurando
      for (const j of this.jogadores()) if (j.a && j.id !== eu.id) ws.send(JSON.stringify({ t: 'arma', id: j.id, a: j.a }));
    }
  }


  // tem uma Bancada (bloco 34) colocada a até 5 blocos de p? (bancadas nunca são do mundo original)
  async bancadaPerto(p) {
    const ed = await this.carregarEdicoes();
    const [px, py, pz] = p.map(Math.floor);
    for (let dy = -3; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      if (ed.get((px + dx) + ',' + (py + dy) + ',' + (pz + dz)) === 34) return true;
    }
    return false;
  }

  // moedas, coleta e objetivos de cada jogador (por conta), guardados aqui na sala
  async econDe(uid) {
    if (!this.econ) this.econ = new Map();
    let e = this.econ.get(uid);
    if (!e) { e = normalizar(await this.ctx.storage.get('e:' + uid), this.op()); this.econ.set(uid, e); }
    return e;
  }

  async econAplicar(ws, eu, econ, acao, quieto, ctx) {
    const r = aplicar(econ, this.op(), acao, ctx);
    if (!r.ok) {
      ws.send(JSON.stringify({ t: 'econ', s: econ })); // o aparelho já tinha mexido na mochila: devolve a certa
      if (!quieto) ws.send(JSON.stringify({ t: 'econ-erro', msg: r.erro, falta: r.falta, custo: r.custo }));
      return r;
    }
    if (!r.mudou) return r;
    // o pedreiro colocou blocos: a sala põe no mundo e todo mundo vê
    if (r.blocos && r.blocos.length) await this.porBlocos(r.blocos, new Set(r.marcar || []));
    await this.ctx.storage.put('e:' + eu.uid, econ);
    ws.send(JSON.stringify({ t: 'econ', s: econ, feitos: r.feitos, msgs: r.msgs && r.msgs.length ? r.msgs : undefined, vendas: r.vendas || undefined, paes: r.paes || undefined }));
    return r;
  }

  // a obra pedida passa por cima de algum bloco que alguém colocou? (devolve o aviso, ou null)
  async obraSobreConstrucao(m) {
    if (!PLANTAS[m.p] || !ESTILOS_OBRA[m.e] || ![m.x, m.y, m.z, m.r].every(Number.isInteger) || m.r < 0 || m.r > 3) return null; // as regras recusam
    const ed = await this.carregarEdicoes();
    for (const [x, y, z] of blocosDaObra({ p: m.p, e: m.e, v: m.v ? 1 : 0, x: m.x, y: m.y, z: m.z, r: m.r })) {
      if (ed.get(x + ',' + y + ',' + z) > 0) return 'Aqui já tem construção. Escolha um lugar livre para a obra.';
    }
    return null;
  }

  // blocos colocados pela própria sala (obras do pedreiro): guarda e manda para todos de uma vez
  // marcar: "x,y,z" dos blocos feitos com material comprado
  async porBlocos(lista, marcar = new Set()) {
    const ed = await this.carregarEdicoes();
    const ok = [];
    let lote = {};
    let n = 0;
    for (const [x, y, z, b] of lista) {
      if (![x, y, z].every(Number.isInteger) || y < 1 || y > ALTURA_MAX || !blocoOk(b)) continue;
      const k = x + ',' + y + ',' + z;
      // o pedreiro nunca derruba nem cobre o que alguém construiu depois que a obra começou
      if (ed.get(k) > 0) continue;
      if (!ed.has(k) && ed.size >= MAX_EDICOES) break;
      ed.set(k, b);
      lote['b:' + k] = b;
      if (marcar.has(k)) { lote['c:' + k] = 1; n++; } // (lugar com marca antiga nunca chega aqui: tem bloco)
      ok.push([x, y, z, b]);
      if (++n >= 120) { await this.ctx.storage.put(lote); lote = {}; n = 0; }
    }
    if (n) await this.ctx.storage.put(lote);
    if (ok.length) this.enviarTodos({ t: 'blocos', l: ok });
  }

  // cama: conta quem está dormindo; se todo mundo deitou, amanhece para todos
  async verSono(exceto, nome) {
    const ws = this.ctx.getWebSockets().filter((w) => w !== exceto && w.deserializeAttachment());
    const n = ws.filter((w) => w.deserializeAttachment().dorme).length, total = ws.length;
    if (!n) return;
    if (n < total) { this.enviarTodos({ t: 'sono', n, total, nome, deitou: !!nome }); return; }
    if (!podeDormir(this.diaAgora())) return;
    for (const w of ws) { const j = w.deserializeAttachment(); j.dorme = false; w.serializeAttachment(j); }
    this.info.inicio = Date.now() - (ACORDA - 0.3) * 600000;
    await this.ctx.storage.put('info', this.info);
    this.enviarTodos({ t: 'dia', v: ACORDA, dormiu: true });
  }

  async webSocketClose(ws) { await this.sair(ws); }
  async webSocketError(ws) { await this.sair(ws); }

  async sair(ws) {
    const eu = ws.deserializeAttachment();
    if (eu && this.taxa) this.taxa.delete(eu.id);
    if (eu && this.taxaGuerra) this.taxaGuerra.delete(eu.id);
    try { ws.close(1000, 'tchau'); } catch {}
    if (!eu) return;
    if (eu.v) { const [id, a] = eu.v; this.enviarTodos({ t: 'vassento', id, a, j: null }, ws); }
    await this.ctx.storage.put('p:' + eu.uid, eu.p);
    this.enviarTodos({ t: 'saiu', id: eu.id }, ws);
    await this.verSono(ws); // quem saiu não conta mais: se os outros já estão deitados, amanhece
  }
}

export default {
  fetch() { return new Response('Pradaria: sala multijogador', { status: 404 }); },
};

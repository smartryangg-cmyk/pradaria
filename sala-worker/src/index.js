// Sala de um mundo: guarda as edições de blocos e repassa posições/emotes entre os jogadores.
import { DurableObject } from 'cloudflare:workers';
import { opcoesEcon, econLigada, normalizar, aplicar, dar, liberado } from '../../public/js/economia.js';
import { lugarVazio, gastoDe, ULTIMO_ITEM } from '../../public/js/receitas.js';
import { normalizarOpcoes } from '../../public/js/opcoes-mundo.js';
import { normalizarSkin } from '../../public/js/skin.js';
import { filtrarChat } from '../../public/js/chat-filtro.js';
import { horaDe, MAX_TURNO } from '../../public/js/trabalho.js';

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
const LUGARES = { carro: 4, jipe: 4, esportivo: 2, quadriciclo: 2, moto: 2, bicicleta: 1, skate: 1, trator: 2, caminhao: 6, onibus: 9, barco: 4, aviao: 2, helicoptero: 4 };
const MAX_VEICULOS = 40; // por mundo
const MAX_VEICULOS_POR_JOGADOR = 6;
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
const MAX_ID_ITEM = ULTIMO_ITEM; // blocos 1..255 e itens 1000+ (ferramentas etc.)

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
      if (this.info) { this.info.econ = opcoesEcon(opcoes); await this.ctx.storage.put('info', this.info); }
      if (this.econ) this.econ.clear(); // a mochila/moedas de cada um é ajustada às opções novas
      if (this.info) await this.mudarChat(chatDe(opcoes)); // chat de texto/voz: vale na hora, sem recarregar
      const nome = typeof d.nome === 'string' ? d.nome.slice(0, 24) : '';
      for (const ws of this.ctx.getWebSockets()) {
        const j = ws.deserializeAttachment();
        if (!j) continue;
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
        if (![x, y, z].every(Number.isInteger) || y < 1 || y > 63 || !blocoOk(b) || Math.abs(x) > LONGE || Math.abs(z) > LONGE) continue;
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
      await this.ctx.storage.delete(['p:' + d.uid, 'l:' + d.uid]);
      await this.admin('expulsar', { uids: [d.uid] });
    } else if (acao === 'apagar') {
      await this.admin('expulsar', { todosMenos: -1, msg: 'O dono apagou este mundo.' });
      await this.ctx.storage.deleteAll();
      this.edicoes = null; this.info = null;
    }
    return new Response('ok');
  }

  async fetch(request) {
    const acao = request.headers.get('x-admin');
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
    const eu = { id, uid: u.id, nome: u.nome, cor: u.cor, skin: normalizarSkin(u.skin, u.cor), dono: !!u.dono, p: pos || [0, 60, 0], r: [0, 0], cota: 0, janela: 0, semVeiculos: opcoes.veiculos === false };
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
    const veiculos = [...vs.values()].map(({ id, tipo, cor, p, r }) => ({ id, tipo, cor, p, r, ocup: ocup.get(id) || [] }));
    const lugares = (await this.ctx.storage.get('l:' + u.id)) || { casa: null, lista: [] };
    const barra = (await this.ctx.storage.get('h:' + u.id)) || null;
    servidor.send(JSON.stringify({
      t: 'ola', eu: id, semente: this.info.semente, edicoes, pos, dia, dono: eu.dono, lugares, opcoes, econ, veiculos, barra,
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
      if (m.d.sdp && typeof m.d.sdp === 'object' && (m.d.sdp.type === 'offer' || m.d.sdp.type === 'answer') && typeof m.d.sdp.sdp === 'string') d.sdp = { type: m.d.sdp.type, sdp: m.d.sdp.sdp };
      else if (m.d.ice && typeof m.d.ice === 'object' && typeof m.d.ice.candidate === 'string') d.ice = { candidate: m.d.ice.candidate, sdpMid: typeof m.d.ice.sdpMid === 'string' ? m.d.ice.sdpMid : null, sdpMLineIndex: Number.isInteger(m.d.ice.sdpMLineIndex) ? m.d.ice.sdpMLineIndex : null };
      else return;
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
    if (m.t === 'pos' || m.t === 'emote' || m.t === 'vmov' || m.t === 'buzina') {
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
      eu.r = Array.isArray(m.r) ? m.r.slice(0, 2).map((v) => (Number.isFinite(v) ? v : 0)) : [0, 0];
      ws.serializeAttachment(eu);
      // a = o que o boneco está fazendo (1 batendo, 2 voando, 4 na água, 8 no ar): só para a animação
      this.enviarTodos({ t: 'pos', id: eu.id, p: eu.p, r: eu.r, a: (m.a | 0) & 15 }, ws);
      const agora = Date.now();
      if (!eu.salvoEm || agora - eu.salvoEm > 10000) { eu.salvoEm = agora; ws.serializeAttachment(eu); await this.ctx.storage.put('p:' + eu.uid, eu.p); }
    } else if (m.t === 'bloco') {
      const { x, y, z, b } = m;
      if (![x, y, z].every(Number.isInteger) || y < 1 || y > ALTURA_MAX || !blocoOk(b)) return;
      if (Math.abs(x) > LONGE || Math.abs(z) > LONGE) return;
      const op = this.op();
      const econ = econLigada(op) ? await this.econDe(eu.uid) : null;
      // com o mercado, só dá para colocar os blocos que a pessoa já tem
      if (econ && b > 0 && !liberado(econ, b, op)) return;
      // coletar e criar: só coloca o que tem na mochila
      if (econ && op.sobrevivencia && m.j && b > 0 && lugarVazio(m.de | 0) && !((econ.itens[gastoDe(b)] || 0) > 0)) {
        ws.send(JSON.stringify({ t: 'econ', s: econ })); // devolve a mochila certa para o aparelho
        return;
      }
      // limite: 25 blocos por segundo por jogador
      const agora = Date.now();
      if (agora - eu.janela > 1000) { eu.janela = agora; eu.cota = 0; }
      if (++eu.cota > 25) return;
      ws.serializeAttachment(eu);
      const ed = await this.carregarEdicoes();
      const k = x + ',' + y + ',' + z;
      if (!ed.has(k) && ed.size >= MAX_EDICOES) return;
      const natural = !ed.has(k); // ninguém mexeu aqui ainda: é um bloco do mundo original
      ed.set(k, b);
      await this.ctx.storage.put('b:' + k, b);
      this.enviarTodos({ t: 'bloco', x, y, z, b }, ws);
      if (econ && m.j) await this.econAplicar(ws, eu, econ, { t: 'bloco', b, x, y, z, de: m.de | 0, natural }, true); // só o que o jogador fez com as mãos
    } else if (m.t === 'vnovo') {
      if (eu.semVeiculos || !LUGARES[m.tipo] || !posOk(m.p) || m.p.length !== 3 || !Number.isFinite(m.r)) return;
      const cor = Number.isInteger(m.cor) && m.cor >= 0 && m.cor < 8 ? m.cor : 0;
      const agora = Date.now();
      if (eu.ultimoVeiculo && agora - eu.ultimoVeiculo < 1500) return;
      eu.ultimoVeiculo = agora; ws.serializeAttachment(eu);
      const vs = await this.carregarVeiculos();
      const ocup = this.ocupacao();
      const vazio = (v) => !(ocup.get(v.id) || []).some(Boolean);
      // limite: some o mais antigo (e vazio) do próprio jogador, ou do mundo
      const meus = [...vs.values()].filter((v) => v.dono === eu.uid).sort((a, b) => a.t - b.t);
      const cheio = meus.length >= MAX_VEICULOS_POR_JOGADOR || vs.size >= MAX_VEICULOS;
      const tirar = meus.length >= MAX_VEICULOS_POR_JOGADOR ? meus.find(vazio) : vs.size >= MAX_VEICULOS ? [...vs.values()].sort((a, b) => a.t - b.t).find(vazio) : null;
      if (cheio && !tirar) { ws.send(JSON.stringify({ t: 'erro', msg: 'Tem veículos demais aqui. Guarde algum!' })); return; }
      if (tirar) { vs.delete(tirar.id); await this.ctx.storage.delete('v:' + tirar.id); this.enviarTodos({ t: 'vfim', id: tirar.id }); }
      const seq = ((await this.ctx.storage.get('vseq')) || 0) + 1;
      await this.ctx.storage.put('vseq', seq);
      const v = { id: 'v' + seq, tipo: m.tipo, cor, p: m.p.map((x) => arrV(x)), r: arrV(m.r, 1000), dono: eu.uid, t: agora };
      vs.set(v.id, v);
      await this.ctx.storage.put('v:' + v.id, v);
      const pub = { id: v.id, tipo: v.tipo, cor: v.cor, p: v.p, r: v.r };
      this.enviarTodos({ t: 'vnovo', v: pub }, ws);
      ws.send(JSON.stringify({ t: 'vnovo', v: pub, n: Number.isFinite(m.n) ? m.n : 0 }));
    } else if (m.t === 'ventrar') {
      const v = (await this.carregarVeiculos()).get(m.id);
      if (!v) return;
      const atual = this.ocupacao().get(v.id) || [];
      let a = -1;
      for (let i = 0; i < LUGARES[v.tipo]; i++) if (!atual[i]) { a = i; break; }
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
      const r = m.r.slice(0, 3).map((x) => (Number.isFinite(x) ? arrV(x, 1000) : 0));
      this.enviarTodos({ t: 'vmov', id: v.id, p: v.p, r, s: Number.isFinite(m.s) ? arrV(m.s, 10) : 0 }, ws);
      const agora = Date.now();
      if (!v.salvoEm || agora - v.salvoEm > 5000) { v.salvoEm = agora; await this.ctx.storage.put('v:' + v.id, v); }
    } else if (m.t === 'vguardar') {
      const vs = await this.carregarVeiculos();
      const v = vs.get(m.id);
      if (!v) return;
      const atual = this.ocupacao().get(v.id) || [];
      if (atual.some((j) => j && j !== eu.id)) return;
      if (eu.v && eu.v[0] === v.id) { eu.v = null; ws.serializeAttachment(eu); }
      vs.delete(v.id);
      await this.ctx.storage.delete('v:' + v.id);
      this.enviarTodos({ t: 'vfim', id: v.id });
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
    } else if (m.t === 'ev' || m.t === 'vender' || m.t === 'comprar' || m.t === 'criar' || m.t === 'moer' || m.t === 'assar') {
      const op = this.op();
      if (!econLigada(op)) return;
      // a bancada quem confere é a sala: alguma bancada colocada perto de onde o jogador está
      if (m.t === 'criar') m = { t: 'criar', r: String(m.r), bancada: await this.bancadaPerto(eu.p) };
      // no máximo 10 por segundo
      const agora = Date.now();
      if (!eu.jeco || agora - eu.jeco > 1000) { eu.jeco = agora; eu.neco = 0; }
      if (++eu.neco > 10) return;
      ws.serializeAttachment(eu);
      const econ = await this.econDe(eu.uid);
      await this.econAplicar(ws, eu, econ, m, m.t === 'ev');
    } else if (ACOES_TRABALHO.has(m.t)) {
      const op = this.op();
      if (!op.mercado) return;
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
      }
      await this.econAplicar(ws, eu, econ, m, m.t === 'turno', { pos: eu.p });
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

  op() { return (this.info && this.info.econ) || { mercado: false, objetivos: false, sobrevivencia: false }; }

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
    if (!r.ok) { if (!quieto) ws.send(JSON.stringify({ t: 'econ-erro', msg: r.erro, falta: r.falta, custo: r.custo })); return; }
    if (!r.mudou) return;
    // o pedreiro colocou blocos: a sala põe no mundo e todo mundo vê
    if (r.blocos && r.blocos.length) await this.porBlocos(r.blocos);
    await this.ctx.storage.put('e:' + eu.uid, econ);
    ws.send(JSON.stringify({ t: 'econ', s: econ, feitos: r.feitos, msgs: r.msgs && r.msgs.length ? r.msgs : undefined, vendas: r.vendas || undefined, paes: r.paes || undefined }));
  }

  // blocos colocados pela própria sala (obras do pedreiro): guarda e manda para todos de uma vez
  async porBlocos(lista) {
    const ed = await this.carregarEdicoes();
    const ok = [];
    let lote = {};
    let n = 0;
    for (const [x, y, z, b] of lista) {
      if (![x, y, z].every(Number.isInteger) || y < 1 || y > ALTURA_MAX || !blocoOk(b)) continue;
      const k = x + ',' + y + ',' + z;
      if (!ed.has(k) && ed.size >= MAX_EDICOES) break;
      ed.set(k, b);
      lote['b:' + k] = b;
      ok.push([x, y, z, b]);
      if (++n === 128) { await this.ctx.storage.put(lote); lote = {}; n = 0; }
    }
    if (n) await this.ctx.storage.put(lote);
    if (ok.length) this.enviarTodos({ t: 'blocos', l: ok });
  }

  async webSocketClose(ws) { await this.sair(ws); }
  async webSocketError(ws) { await this.sair(ws); }

  async sair(ws) {
    const eu = ws.deserializeAttachment();
    if (eu && this.taxa) this.taxa.delete(eu.id);
    try { ws.close(1000, 'tchau'); } catch {}
    if (!eu) return;
    if (eu.v) { const [id, a] = eu.v; this.enviarTodos({ t: 'vassento', id, a, j: null }, ws); }
    await this.ctx.storage.put('p:' + eu.uid, eu.p);
    this.enviarTodos({ t: 'saiu', id: eu.id }, ws);
  }
}

export default {
  fetch() { return new Response('Pradaria: sala multijogador', { status: 404 }); },
};

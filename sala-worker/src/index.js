// Sala de um mundo: guarda as edições de blocos e repassa posições/emotes entre os jogadores.
import { DurableObject } from 'cloudflare:workers';
import { ARMAS, danoMaximo, VOLTA_ITEM } from '../../public/js/armas-dados.js';
import { opcoesEcon, econLigada, normalizar, aplicar, dar, liberado } from '../../public/js/economia.js';
import { lugarVazio, gastoDe, ULTIMO_ITEM } from '../../public/js/receitas.js';
import { normalizarOpcoes } from '../../public/js/opcoes-mundo.js';

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
    if (JSON.stringify(op) !== JSON.stringify(this.info.econ)) { this.info.econ = op; await this.ctx.storage.put('info', this.info); }
    // regras que o servidor faz valer: construção (colocar/quebrar) e armas
    const regras = { construcao: opcoes.construcao !== false, armas: opcoes.armas === true };
    if (JSON.stringify(regras) !== JSON.stringify(this.info.regras)) { this.info.regras = regras; await this.ctx.storage.put('info', this.info); }
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
    const eu = { id, uid: u.id, nome: u.nome, cor: u.cor, dono: !!u.dono, p: pos || [0, 60, 0], r: [0, 0], cota: 0, janela: 0, semVeiculos: opcoes.veiculos === false };
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
      jogadores: this.jogadores().filter((j) => j.id !== id).map(({ id, nome, cor, p, r }) => ({ id, nome, cor, p, r })),
    }));
    this.enviarTodos({ t: 'entrou', j: { id, nome: u.nome, cor: u.cor, p: eu.p, r: eu.r } }, servidor);
    return new Response(null, { status: 101, webSocket: cliente });
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
    if (typeof dados !== 'string' || dados.length > 2000) return;
    let m; try { m = JSON.parse(dados); } catch { return; }
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
      eu.r = Array.isArray(m.r) ? m.r.slice(0, 2).map((v) => (Number.isFinite(v) ? v : 0)) : [0, 0];
      ws.serializeAttachment(eu);
      // a = o que o boneco está fazendo (1 batendo, 2 voando, 4 na água, 8 no ar): só para a animação
      this.enviarTodos({ t: 'pos', id: eu.id, p: eu.p, r: eu.r, a: (m.a | 0) & 15 }, ws);
      const agora = Date.now();
      if (!eu.salvoEm || agora - eu.salvoEm > 10000) { eu.salvoEm = agora; ws.serializeAttachment(eu); await this.ctx.storage.put('p:' + eu.uid, eu.p); }
    } else if (m.t === 'bloco') {
      const { x, y, z, b } = m;
      if (![x, y, z].every(Number.isInteger) || y < 1 || y > 63 || !blocoOk(b)) return;
      if (Math.abs(x) > LONGE || Math.abs(z) > LONGE) return;
      // mundo sem construção: ninguém coloca nem quebra blocos com as mãos
      if (m.j && !this.regras().construcao) return;
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
    } else if (m.t === 'tiro' || m.t === 'arma' || m.t === 'acerto' || m.t === 'caiu' || m.t === 'pegar' || m.t === 'pegos') {
      if (this.regras().armas) this.armas(ws, eu, m);
    } else if (m.t === 'buzina') {
      if (!eu.v || eu.v[0] !== m.id) return;
      this.enviarTodos({ t: 'buzina', id: m.id }, ws);
    } else if (m.t === 'emote' && EMOTES.has(m.e)) {
      // no máximo um emote a cada 0,8 s (evita encher a tela/os ouvidos dos outros)
      const agora = Date.now();
      if (eu.emEm && agora - eu.emEm < 800) return;
      eu.emEm = agora; ws.serializeAttachment(eu);
      this.enviarTodos({ t: 'emote', id: eu.id, e: m.e }, ws);
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
  regras() { return (this.info && this.info.regras) || { construcao: true, armas: false }; }

  // ---------- armas (só nos mundos com a opção ligada) ----------
  // tiro: só repassa (para os outros verem o risquinho e ouvirem); acerto: confere e avisa quem levou;
  // caiu: quem levou avisa que caiu (e todos veem quem derrubou); pegar: item do chão some para todos
  armas(ws, eu, m) {
    const agora = Date.now();
    const vec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
    if (m.t === 'tiro') {
      if (!ARMAS[m.a] || !vec(m.o) || !vec(m.f)) return;
      this.enviarTodos({ t: 'tiro', id: eu.id, a: m.a, o: arred(m.o), f: arred(m.f) }, ws);
    } else if (m.t === 'arma') {
      const a = m.a === null || ARMAS[m.a] ? m.a : null;
      eu.a = a; ws.serializeAttachment(eu);
      this.enviarTodos({ t: 'arma', id: eu.id, a }, ws);
    } else if (m.t === 'acerto') {
      if (!ARMAS[m.a] || typeof m.alvo !== 'string' || !Number.isInteger(m.dano) || m.dano < 1) return;
      const [alvoWs, alvo] = this.conexaoDe(m.alvo);
      if (!alvoWs || alvo.id === eu.id) return;
      // perto o bastante para aquela arma (com folga para o atraso da rede)
      const d = Math.hypot(alvo.p[0] - eu.p[0], alvo.p[1] - eu.p[1], alvo.p[2] - eu.p[2]);
      if (d > ARMAS[m.a].alcance + 8) return;
      // no máximo 15 acertos por segundo de cada jogador
      if (!eu.acJan || agora - eu.acJan > 1000) { eu.acJan = agora; eu.acN = 0; }
      if (++eu.acN > 15) return;
      ws.serializeAttachment(eu);
      alvoWs.send(JSON.stringify({ t: 'ferido', dano: Math.min(m.dano, danoMaximo(m.a)), de: eu.id, nome: eu.nome, p: eu.p }));
    } else if (m.t === 'caiu') {
      const por = typeof m.por === 'string' ? this.conexaoDe(m.por)[1] : null;
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

  async econAplicar(ws, eu, econ, acao, quieto) {
    const r = aplicar(econ, this.op(), acao);
    if (!r.ok) { if (!quieto) ws.send(JSON.stringify({ t: 'econ-erro', msg: r.erro })); return; }
    if (!r.mudou) return;
    await this.ctx.storage.put('e:' + eu.uid, econ);
    ws.send(JSON.stringify({ t: 'econ', s: econ, feitos: r.feitos }));
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

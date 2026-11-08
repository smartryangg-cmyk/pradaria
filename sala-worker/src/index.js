// Sala de um mundo: guarda as edições de blocos e repassa posições/emotes entre os jogadores.
import { DurableObject } from 'cloudflare:workers';

const MAX_BLOCO = 23;
const MAX_JOGADORES = 12;
// emotes por nome de ícone (v4); os emojis ficam para quem ainda está com a versão antiga aberta
const EMOTES = new Set(['acenar', 'coracao', 'sorriso', 'estrela', '👋', '❤️', '😄', '⭐']);
const MAX_EDICOES = 200000; // por mundo
const LONGE = 100000; // ninguém precisa ir mais longe que isso
const MSG_POR_SEG = 20;

export class Sala extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.edicoes = null; // Map "x,y,z" -> b
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

  async fetch(request) {
    const u = JSON.parse(request.headers.get('x-usuario') || 'null');
    const mundo = JSON.parse(request.headers.get('x-mundo') || 'null');
    if (!u || !mundo) return new Response('sem dados', { status: 400 });
    if (!this.info) {
      this.info = { codigo: mundo.codigo, semente: mundo.semente, inicio: Date.now() };
      await this.ctx.storage.put('info', this.info);
    }
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
    const eu = { id, uid: u.id, nome: u.nome, cor: u.cor, p: pos || [0, 60, 0], r: [0, 0], cota: 0, janela: 0 };
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment(eu);

    const ed = await this.carregarEdicoes();
    const edicoes = [];
    for (const [k, b] of ed) { const [x, y, z] = k.split(',').map(Number); edicoes.push([x, y, z, b]); }
    const dia = (((Date.now() - this.info.inicio) / 600000) + 0.3) % 1;
    servidor.send(JSON.stringify({
      t: 'ola', eu: id, semente: this.info.semente, edicoes, pos, dia,
      jogadores: this.jogadores().filter((j) => j.id !== id).map(({ id, nome, cor, p, r }) => ({ id, nome, cor, p, r })),
    }));
    this.enviarTodos({ t: 'entrou', j: { id, nome: u.nome, cor: u.cor, p: eu.p, r: eu.r } }, servidor);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(ws, dados) {
    if (typeof dados !== 'string' || dados.length > 2000) return;
    let m; try { m = JSON.parse(dados); } catch { return; }
    const eu = ws.deserializeAttachment();
    if (!eu) return;
    if (m.t === 'pos' || m.t === 'emote') {
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
      this.enviarTodos({ t: 'pos', id: eu.id, p: eu.p, r: eu.r }, ws);
      const agora = Date.now();
      if (!eu.salvoEm || agora - eu.salvoEm > 10000) { eu.salvoEm = agora; ws.serializeAttachment(eu); await this.ctx.storage.put('p:' + eu.uid, eu.p); }
    } else if (m.t === 'bloco') {
      const { x, y, z, b } = m;
      if (![x, y, z, b].every(Number.isInteger) || y < 1 || y > 63 || b < 0 || b > MAX_BLOCO) return;
      if (Math.abs(x) > LONGE || Math.abs(z) > LONGE) return;
      // limite: 25 blocos por segundo por jogador
      const agora = Date.now();
      if (agora - eu.janela > 1000) { eu.janela = agora; eu.cota = 0; }
      if (++eu.cota > 25) return;
      ws.serializeAttachment(eu);
      const ed = await this.carregarEdicoes();
      const k = x + ',' + y + ',' + z;
      if (!ed.has(k) && ed.size >= MAX_EDICOES) return;
      ed.set(k, b);
      await this.ctx.storage.put('b:' + k, b);
      this.enviarTodos({ t: 'bloco', x, y, z, b }, ws);
    } else if (m.t === 'emote' && EMOTES.has(m.e)) {
      this.enviarTodos({ t: 'emote', id: eu.id, e: m.e }, ws);
    }
  }

  async webSocketClose(ws) { await this.sair(ws); }
  async webSocketError(ws) { await this.sair(ws); }

  async sair(ws) {
    const eu = ws.deserializeAttachment();
    if (eu && this.taxa) this.taxa.delete(eu.id);
    try { ws.close(1000, 'tchau'); } catch {}
    if (!eu) return;
    await this.ctx.storage.put('p:' + eu.uid, eu.p);
    this.enviarTodos({ t: 'saiu', id: eu.id }, ws);
  }
}

export default {
  fetch() { return new Response('Pradaria: sala multijogador', { status: 404 }); },
};

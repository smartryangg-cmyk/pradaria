// Saguão da plataforma: quem está online, em qual jogo, e convites entre amigos.
// Uma instância só ("geral"). Cada aba logada abre um WebSocket aqui (public/js/lobby.js).
// A lista de amigos vem do banco (D1) na entrada (x-amigos) e a API avisa quando muda (x-admin: amizade).
import { DurableObject } from 'cloudflare:workers';

export const JOGOS_LOBBY = ['hub', 'pradaria', 'xadrez', 'dama', 'truco', 'arena', 'ilha'];
const jogoOk = (j) => (JOGOS_LOBBY.includes(j) ? j : 'hub');

export class Lobby extends DurableObject {
  // conexões de um jogador (pode ter mais de uma aba)
  conexoes(uid) { return this.ctx.getWebSockets().filter((w) => { const a = w.deserializeAttachment(); return a && a.uid === uid; }); }
  // o que mostrar para os amigos: online + jogo da conexão mais recente
  estado(uid) {
    let melhor = null;
    for (const w of this.conexoes(uid)) { const a = w.deserializeAttachment(); if (!melhor || a.desde > melhor.desde) melhor = a; }
    return melhor ? melhor.jogo : null;
  }
  enviar(uid, msg) { const s = JSON.stringify(msg); for (const w of this.conexoes(uid)) { try { w.send(s); } catch {} } }
  // avisa os amigos online de uid que ele mudou (jogo ou saiu)
  avisarAmigos(uid, amigos) {
    const jogo = this.estado(uid);
    for (const a of amigos) this.enviar(a, { t: 'presenca', id: uid, jogo });
  }

  async fetch(request) {
    const acao = request.headers.get('x-admin');
    if (acao) { let d = {}; try { d = await request.json(); } catch {} return this.admin(acao, d || {}); }
    const u = JSON.parse(request.headers.get('x-usuario') || 'null');
    const amigos = JSON.parse(request.headers.get('x-amigos') || '[]');
    if (!u) return new Response('sem dados', { status: 400 });
    const jogo = jogoOk(new URL(request.url).searchParams.get('jogo'));
    const [cliente, servidor] = Object.values(new WebSocketPair());
    // muitas abas do mesmo jogador: a mais antiga sai
    const minhas = this.conexoes(u.id).sort((a, b) => a.deserializeAttachment().desde - b.deserializeAttachment().desde);
    while (minhas.length >= 4) { const w = minhas.shift(); w.serializeAttachment(null); try { w.close(4001, 'muitas abas'); } catch {} }
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment({ uid: u.id, nome: u.nome, amigos: amigos.slice(0, 300), jogo, desde: Date.now(), cota: 0, janela: 0 });
    const online = {};
    for (const a of amigos) { const j = this.estado(a); if (j) online[a] = j; }
    servidor.send(JSON.stringify({ t: 'ola', online }));
    this.avisarAmigos(u.id, amigos);
    return new Response(null, { status: 101, webSocket: cliente });
  }

  // a API avisa: a amizade entre a e b mudou (pedido novo, aceito, desfeito)
  async admin(acao, d) {
    if (acao === 'amizade') {
      const a = +d.a, b = +d.b, amigos = !!d.amigos;
      for (const [x, y] of [[a, b], [b, a]]) {
        for (const w of this.conexoes(x)) {
          const at = w.deserializeAttachment();
          const s = new Set(at.amigos);
          if (amigos) s.add(y); else s.delete(y);
          at.amigos = [...s];
          w.serializeAttachment(at);
        }
        this.enviar(x, { t: 'amigos-mudou', id: y, pedido: !!d.pedido && x === b });
        // a presença do outro (se virou amigo e está online)
        if (amigos) this.enviar(x, { t: 'presenca', id: y, jogo: this.estado(y) });
      }
      return Response.json({ ok: true });
    }
    return new Response('ação desconhecida', { status: 400 });
  }

  async webSocketMessage(ws, dados) {
    const eu = ws.deserializeAttachment();
    if (!eu || typeof dados !== 'string' || dados.length > 600) return;
    // limite simples: 20 mensagens a cada 10 s por conexão
    const agora = Date.now();
    if (agora - eu.janela > 10000) { eu.janela = agora; eu.cota = 0; }
    if (++eu.cota > 20) { ws.serializeAttachment(eu); return; }
    let m; try { m = JSON.parse(dados); } catch { return; }
    if (m.t === 'jogo') {
      eu.jogo = jogoOk(m.jogo); eu.desde = agora;
      ws.serializeAttachment(eu);
      this.avisarAmigos(eu.uid, eu.amigos);
      return;
    }
    ws.serializeAttachment(eu);
    const para = +m.para;
    // convites e respostas só entre amigos
    if (!eu.amigos.includes(para)) return;
    if (m.t === 'convidar') {
      const jogo = jogoOk(m.jogo);
      if (jogo === 'hub') return;
      if (!this.estado(para)) { ws.send(JSON.stringify({ t: 'convite-falhou', para, msg: 'Seu amigo saiu.' })); return; }
      this.enviar(para, { t: 'convite', de: eu.uid, nome: eu.nome, jogo, sala: String(m.sala || '').slice(0, 24), titulo: String(m.titulo || '').slice(0, 40) });
    } else if (m.t === 'resposta') {
      this.enviar(para, { t: 'convite-resp', de: eu.uid, nome: eu.nome, aceitou: !!m.aceitou, jogo: jogoOk(m.jogo) });
    }
  }

  async webSocketClose(ws) { this.saiu(ws); }
  async webSocketError(ws) { this.saiu(ws); }
  saiu(ws) {
    const eu = ws.deserializeAttachment();
    ws.serializeAttachment(null);
    try { ws.close(1000, 'tchau'); } catch {}
    if (eu) this.avisarAmigos(eu.uid, eu.amigos);
  }
}

// Partida de jogo de tabuleiro entre dois amigos (xadrez agora; dama e truco depois).
// Uma instância por código de partida. O servidor confere cada lance com as mesmas regras do navegador
// (public/js/xadrez-regras.js) e guarda tudo, então dá para recarregar a página e continuar.
import { DurableObject } from 'cloudflare:workers';
import * as X from '../../public/js/xadrez-regras.js';

const JOGOS = { xadrez: X };
const LUGARES = ['w', 'b'];

export class Partida extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.p = null;
    this.ctx.blockConcurrencyWhile(async () => { this.p = (await this.ctx.storage.get('p')) || null; });
  }
  salvar() { return this.ctx.storage.put('p', this.p); }
  conexoes() { return this.ctx.getWebSockets().filter((w) => w.deserializeAttachment()); }
  online(uid) { return this.conexoes().some((w) => w.deserializeAttachment().uid === uid); }

  // o que cada um vê (o lugar dele muda o "voce")
  visao(uid) {
    const p = this.p;
    const jog = {};
    for (const l of LUGARES) { const j = p.lugares[l]; jog[l] = j ? { nome: j.nome, online: this.online(j.uid) } : null; }
    const voce = LUGARES.find((l) => p.lugares[l] && p.lugares[l].uid === uid) || null;
    return { t: 'estado', jogo: p.jogo, estado: X.publico(p.e), jogadores: jog, voce, fim: p.fim, empate: p.empate || null, revanche: p.revanche || [], n: p.partidas };
  }
  avisarTodos() { for (const w of this.conexoes()) { try { w.send(JSON.stringify(this.visao(w.deserializeAttachment().uid))); } catch {} } }

  novaPartida(trocar) {
    const p = this.p;
    if (trocar) { const w = p.lugares.w; p.lugares.w = p.lugares.b; p.lugares.b = w; }
    p.e = X.novo(); p.fim = null; p.empate = null; p.revanche = []; p.partidas = (p.partidas || 1) + (trocar ? 1 : 0);
  }

  async fetch(request) {
    const u = JSON.parse(request.headers.get('x-usuario') || 'null');
    const jogo = new URL(request.url).searchParams.get('jogo');
    if (!u) return new Response('sem dados', { status: 400 });
    const [cliente, servidor] = Object.values(new WebSocketPair());
    const recusar = (msg) => { servidor.accept(); servidor.send(JSON.stringify({ t: 'erro', fim: true, msg })); servidor.close(4003, 'nao'); return new Response(null, { status: 101, webSocket: cliente }); };
    if (!this.p) {
      if (!JOGOS[jogo]) return recusar('Jogo desconhecido.');
      // quem abre a partida joga de brancas
      this.p = { jogo, lugares: { w: { uid: u.id, nome: u.nome }, b: null }, e: X.novo(), fim: null, criado: Date.now(), partidas: 1 };
      await this.salvar();
    } else if (jogo && jogo !== this.p.jogo) return recusar('Este convite é de outro jogo.');
    const p = this.p;
    let meu = LUGARES.find((l) => p.lugares[l] && p.lugares[l].uid === u.id);
    if (!meu) {
      meu = LUGARES.find((l) => !p.lugares[l]);
      if (!meu) return recusar('Esta partida já tem dois jogadores.');
      p.lugares[meu] = { uid: u.id, nome: u.nome };
      await this.salvar();
    }
    // a mesma pessoa em outra aba: a antiga sai
    for (const w of this.conexoes()) if (w.deserializeAttachment().uid === u.id) { w.serializeAttachment(null); try { w.close(4001, 'outra aba'); } catch {} }
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment({ uid: u.id, nome: u.nome, cota: 0, janela: 0 });
    this.avisarTodos();
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(ws, dados) {
    const eu = ws.deserializeAttachment();
    if (!eu || typeof dados !== 'string' || dados.length > 300) return;
    const agora = Date.now();
    if (agora - eu.janela > 10000) { eu.janela = agora; eu.cota = 0; }
    if (++eu.cota > 30) { ws.serializeAttachment(eu); return; }
    ws.serializeAttachment(eu);
    let m; try { m = JSON.parse(dados); } catch { return; }
    const p = this.p;
    if (!p) return;
    const meu = LUGARES.find((l) => p.lugares[l] && p.lugares[l].uid === eu.uid);
    if (!meu) return;
    const outro = meu === 'w' ? 'b' : 'w';
    const erro = (msg) => ws.send(JSON.stringify({ t: 'aviso', msg }));
    if (m.t === 'lance') {
      if (p.fim) return erro('A partida acabou.');
      if (!p.lugares[outro]) return erro('Espere seu amigo chegar.');
      if (p.e.vez !== meu) return erro('Não é a sua vez.');
      const l = X.achar(p.e, +m.de, +m.para, typeof m.promo === 'string' ? m.promo.slice(0, 1) : 'Q');
      if (!l) { ws.send(JSON.stringify(this.visao(eu.uid))); return erro('Esse lance não vale.'); }
      p.e = X.avancar(p.e, l);
      p.empate = null;
      const f = X.fim(p.e);
      if (f) p.fim = f;
    } else if (m.t === 'desistir') {
      if (p.fim) return;
      p.fim = { tipo: 'desistiu', vencedor: outro, quem: meu };
    } else if (m.t === 'empate') {
      if (p.fim || !p.lugares[outro]) return;
      if (p.empate && p.empate !== meu) p.fim = { tipo: 'empate' };
      else p.empate = meu;
    } else if (m.t === 'recusar-empate') {
      if (p.empate === outro) p.empate = null;
    } else if (m.t === 'revanche') {
      if (!p.fim) return;
      p.revanche = [...new Set([...(p.revanche || []), meu])];
      if (p.revanche.length === 2) this.novaPartida(true);
    } else return;
    await this.salvar();
    this.avisarTodos();
  }

  async webSocketClose(ws) { this.saiu(ws); }
  async webSocketError(ws) { this.saiu(ws); }
  saiu(ws) {
    const eu = ws.deserializeAttachment();
    ws.serializeAttachment(null);
    try { ws.close(1000, 'tchau'); } catch {}
    if (eu) this.avisarTodos();
  }
}

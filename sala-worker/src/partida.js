// Partida entre amigos: xadrez e dama (dois lugares, 'w' e 'b') e truco (mesa de 2 ou 4 lugares, com o computador nas vagas).
// Uma instância por código de partida. O servidor confere cada lance com as mesmas regras do navegador
// (public/js/xadrez-regras.js) e guarda tudo, então dá para recarregar a página e continuar.
import { DurableObject } from 'cloudflare:workers';
import * as X from '../../public/js/xadrez-regras.js';
import * as D from '../../public/js/dama-regras.js';
import * as T from '../../public/js/truco-regras.js';

// cada jogo: novo, validar(estado, mensagem), avancar, fim, publico (as regras ficam em public/js)
const JOGOS = { xadrez: X, dama: D };
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
    if (p.jogo === 'truco') return this.visaoTruco(uid);
    const jog = {};
    for (const l of LUGARES) { const j = p.lugares[l]; jog[l] = j ? { nome: j.nome, online: this.online(j.uid) } : null; }
    const voce = LUGARES.find((l) => p.lugares[l] && p.lugares[l].uid === uid) || null;
    return { t: 'estado', jogo: p.jogo, estado: JOGOS[p.jogo].publico(p.e), jogadores: jog, voce, fim: p.fim, empate: p.empate || null, revanche: p.revanche || [], n: p.partidas };
  }
  avisarTodos() { for (const w of this.conexoes()) { try { w.send(JSON.stringify(this.visao(w.deserializeAttachment().uid))); } catch {} } }

  novaPartida(trocar) {
    const p = this.p;
    if (trocar) { const w = p.lugares.w; p.lugares.w = p.lugares.b; p.lugares.b = w; }
    p.e = JOGOS[p.jogo].novo(); p.fim = null; p.empate = null; p.revanche = []; p.partidas = (p.partidas || 1) + (trocar ? 1 : 0);
  }

  async fetch(request) {
    const u = JSON.parse(request.headers.get('x-usuario') || 'null');
    const jogo = new URL(request.url).searchParams.get('jogo');
    if (!u) return new Response('sem dados', { status: 400 });
    const [cliente, servidor] = Object.values(new WebSocketPair());
    const recusar = (msg) => { servidor.accept(); servidor.send(JSON.stringify({ t: 'erro', fim: true, msg })); servidor.close(4003, 'nao'); return new Response(null, { status: 101, webSocket: cliente }); };
    if (!this.p) {
      if (jogo === 'truco') {
        const n = new URL(request.url).searchParams.get('n') === '4' ? 4 : 2;
        this.p = { jogo, n, dono: u.id, lugares: Array(n).fill(null), e: null, fim: null, criado: Date.now(), partidas: 1, revanche: [] };
        this.p.lugares[0] = { uid: u.id, nome: u.nome };
        await this.salvar();
      } else if (!JOGOS[jogo]) return recusar('Jogo desconhecido.');
      else {
      // quem abre a partida joga de brancas
      this.p = { jogo, lugares: { w: { uid: u.id, nome: u.nome }, b: null }, e: JOGOS[jogo].novo(), fim: null, criado: Date.now(), partidas: 1 };
      await this.salvar();
      }
    } else if (jogo && jogo !== this.p.jogo) return recusar('Este convite é de outro jogo.');
    const p = this.p;
    if (p.jogo === 'truco') {
      if (!p.lugares.some((j) => j && j.uid === u.id)) {
        const i = p.lugares.findIndex((j) => !j);
        if (i < 0) return recusar(p.e ? 'Esta mesa já começou sem você.' : 'Esta mesa já está cheia.');
        p.lugares[i] = { uid: u.id, nome: u.nome };
        // dois amigos no um contra um: já começa; na mesa de 4 começa quando encher (ou quando o dono mandar)
        if (!p.e && p.lugares.every((j) => j)) this.comecarTruco();
        await this.salvar();
      }
    } else {
    let meu = LUGARES.find((l) => p.lugares[l] && p.lugares[l].uid === u.id);
    if (!meu) {
      meu = LUGARES.find((l) => !p.lugares[l]);
      if (!meu) return recusar('Esta partida já tem dois jogadores.');
      p.lugares[meu] = { uid: u.id, nome: u.nome };
      await this.salvar();
    }
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
    if (!eu || typeof dados !== 'string' || dados.length > 600) return;
    const agora = Date.now();
    if (agora - eu.janela > 10000) { eu.janela = agora; eu.cota = 0; }
    if (++eu.cota > 30) { ws.serializeAttachment(eu); return; }
    ws.serializeAttachment(eu);
    let m; try { m = JSON.parse(dados); } catch { return; }
    const p = this.p;
    if (!p) return;
    if (p.jogo === 'truco') return this.msgTruco(ws, eu, m);
    const meu = LUGARES.find((l) => p.lugares[l] && p.lugares[l].uid === eu.uid);
    if (!meu) return;
    const outro = meu === 'w' ? 'b' : 'w';
    const erro = (msg) => ws.send(JSON.stringify({ t: 'aviso', msg }));
    if (m.t === 'lance') {
      if (p.fim) return erro('A partida acabou.');
      if (!p.lugares[outro]) return erro('Espere seu amigo chegar.');
      if (p.e.vez !== meu) return erro('Não é a sua vez.');
      const R = JOGOS[p.jogo];
      const l = R.validar(p.e, m);
      if (!l) { ws.send(JSON.stringify(this.visao(eu.uid))); return erro('Esse lance não vale.'); }
      p.e = R.avancar(p.e, l);
      p.empate = null;
      const f = R.fim(p.e);
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

  // ---------- truco ----------
  visaoTruco(uid) {
    const p = this.p;
    const eu = p.lugares.findIndex((j) => j && j.uid === uid);
    const lugares = p.lugares.map((j) => (j ? (j.robo ? { nome: j.nome, robo: true, online: true } : { nome: j.nome, online: this.online(j.uid) }) : null));
    return { t: 'estado', jogo: 'truco', n: p.n, lugares, voce: eu, dono: p.dono === uid, comecou: !!p.e, estado: p.e ? T.visao(p.e, eu) : null, fim: p.e ? p.e.fim : null, revanche: p.revanche || [], partida: p.partidas };
  }
  comecarTruco() {
    const p = this.p;
    let k = 0;
    p.lugares = p.lugares.map((j) => j || { robo: true, nome: 'Computador ' + ++k });
    p.e = T.novo(p.n);
    p.revanche = [];
    this.agendarRobo();
  }
  // o computador joga devagar (um alarme por jogada) para todo mundo ver as cartas na mesa
  agendarRobo() {
    const p = this.p;
    if (!p.e || p.e.fim) return;
    const quem = T.quemAge(p.e);
    if (!quem.length || !quem.every((l) => p.lugares[l] && p.lugares[l].robo)) return;
    const ult = p.e.eventos[p.e.eventos.length - 1];
    const espera = ult && (ult.t === 'rodada' || ult.t === 'mao') ? 1700 : ult && ult.t === 'pediu' ? 1300 : 850;
    this.ctx.storage.setAlarm(Date.now() + espera);
  }
  async alarm() {
    const p = this.p;
    if (!p || p.jogo !== 'truco' || !p.e || p.e.fim) return;
    const quem = T.quemAge(p.e);
    if (!quem.length || !quem.every((l) => p.lugares[l] && p.lugares[l].robo)) return;
    const l = quem[0];
    const a = T.robo(p.e, l);
    if (a) T.agir(p.e, l, a);
    await this.salvar();
    this.avisarTodos();
    this.agendarRobo();
  }
  async msgTruco(ws, eu, m) {
    const p = this.p;
    const meu = p.lugares.findIndex((j) => j && j.uid === eu.uid);
    if (meu < 0) return;
    const erro = (msg) => ws.send(JSON.stringify({ t: 'aviso', msg }));
    if (m.t === 'comecar') {
      if (p.e) return;
      if (p.dono !== eu.uid) return erro('Quem criou a mesa é que começa.');
      if (p.lugares.filter(Boolean).length < 2 && p.n === 2) return erro('Espere seu amigo chegar.');
      this.comecarTruco();
    } else if (m.t === 'agir') {
      if (!p.e) return erro('A mesa ainda não começou.');
      const a = m.a || {};
      const acao = { t: String(a.t || ''), carta: typeof a.carta === 'string' ? a.carta.slice(0, 3) : undefined, jogar: !!a.jogar };
      const r = T.agir(p.e, meu, acao);
      if (r) { ws.send(JSON.stringify(this.visao(eu.uid))); return erro(r); }
      this.agendarRobo();
    } else if (m.t === 'revanche') {
      if (!p.e || !p.e.fim) return;
      p.revanche = [...new Set([...(p.revanche || []), meu])];
      const humanos = p.lugares.map((j, i) => (j && !j.robo ? i : -1)).filter((i) => i >= 0);
      if (humanos.every((i) => p.revanche.includes(i))) { p.e = T.novo(p.n); p.revanche = []; p.partidas++; this.agendarRobo(); }
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

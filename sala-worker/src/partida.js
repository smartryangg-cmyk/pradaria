// Partida entre amigos: xadrez e dama (dois lugares, 'w' e 'b'; com relógio quando tem ritmo) e truco (mesa de 2 ou 4 lugares, com o computador nas vagas).
// Uma instância por código de partida. O servidor confere cada lance com as mesmas regras do navegador
// (public/js/xadrez-regras.js) e guarda tudo, então dá para recarregar a página e continuar.
import { DurableObject } from 'cloudflare:workers';
import * as X from '../../public/js/xadrez-regras.js';
import * as D from '../../public/js/dama-regras.js';
import * as T from '../../public/js/truco-regras.js';
import * as P from '../../public/js/pontos-regras.js';
import { redeDoPedido } from './pontos.js';

// cada jogo: novo, validar(estado, mensagem), avancar, fim, publico (as regras ficam em public/js)
const JOGOS = { xadrez: X, dama: D };
const LUGARES = ['w', 'b'];
const MIN_LANCES_DESISTIR = 20; // desistir, sair ou perder no tempo antes de 10 lances de cada lado: a partida não vale pontos
const FIM_SEM_JOGO = ['desistiu', 'saiu', 'tempo', 'tempo-empate'];
const PRAZO_FORA = 60000; // o adversário saiu: depois disso dá para pedir a vitória
const PRAZO_PRIMEIRO = 30000; // tempo para fazer o primeiro lance (partida com relógio)
const PRAZO_TRUCO = 30000; // truco online: tempo de cada jogada; acabou, o computador joga pela pessoa
const ROBO_MAX = 3; // truco valendo pontos: o computador joga por alguém no máximo 3 vezes; na 4ª, essa pessoa perde
const PRAZO_TRUCO_FORA = 3000; // ... e bem menos para quem saiu da mesa (a mesa não fica parada esperando)

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
    // quem saiu da partida (ms fora): o outro pode pedir a vitória depois de PRAZO_FORA
    const fora = {};
    if (!p.fim) for (const l of LUGARES) if (p.fora && p.fora[l]) fora[l] = Date.now() - p.fora[l];
    return { t: 'estado', jogo: p.jogo, estado: JOGOS[p.jogo].publico(p.e), jogadores: jog, voce, fim: p.fim, empate: p.empate || null, revanche: p.revanche || [], n: p.partidas, relogio: this.relogioAgora(), ranqueada: !!p.ranqueada, pontos: p.pontos || null, resultado: p.registrado || null, fora, prazoFora: this.prazoFora() };
  }
  avisarTodos() { for (const w of this.conexoes()) { try { w.send(JSON.stringify(this.visao(w.deserializeAttachment().uid))); } catch {} } }

  novaPartida(trocar) {
    const p = this.p;
    if (trocar) { const w = p.lugares.w; p.lugares.w = p.lugares.b; p.lugares.b = w; }
    p.e = JOGOS[p.jogo].novo(); p.fim = null; p.empate = null; p.revanche = []; p.partidas = (p.partidas || 1) + (trocar ? 1 : 0);
    if (p.relogio) p.relogio = this.relogioNovo(p.relogio.ritmo);
    p.registrado = null; p.idJogo = crypto.randomUUID(); p.fora = null; p.guardado = false;
  }

  // ---------- pontos (partidas que valem pontos) ----------
  categoria() { return this.p.relogio ? P.categoria(this.p.relogio.ritmo, this.p.jogo) : null; }
  async lerPontos() {
    const p = this.p, cat = this.categoria();
    if (!p.ranqueada || !cat || !this.env.PONTOS || !p.lugares.w || !p.lugares.b) return;
    try {
      const r = await this.env.PONTOS.get(this.env.PONTOS.idFromName('geral')).fetch('https://pontos/interno?uids=' + p.lugares.w.uid + ',' + p.lugares.b.uid, { headers: { 'x-interno': 'ver' } });
      const n = await r.json();
      const um = (uid) => { const x = P.envelhecer({ ...P.INICIAL, ...((n[uid] || {})[cat] || {}) }, Date.now()); return { r: x.r, rd: x.rd, mostrar: P.mostrar(x) }; };
      p.pontos = { w: um(p.lugares.w.uid), b: um(p.lugares.b.uid) };
    } catch {}
  }
  // no fim de uma partida que vale pontos: manda o resultado (uma vez). Menos de 2 lances = partida anulada, não conta.
  //  Não contam: menos de 2 lances; desistir/sair antes de 10 lances de cada lado; as duas contas na mesma internet;
  //  e (no Pontos) mais de 3 partidas valendo pontos entre as mesmas contas no dia.
  async registrar() {
    await this.registrarPontos();
    await this.guardarHistorico();
  }
  // no fim de uma partida de xadrez com 2 lances ou mais: vai para o histórico dos dois (perfil e análise)
  async guardarHistorico() {
    const p = this.p;
    if (p.jogo !== 'xadrez' || !p.fim || p.guardado || !this.env.PONTOS || !p.lugares.w || !p.lugares.b || (p.e.hist || []).length < 2) return;
    p.guardado = true;
    const r = p.registrado && !p.registrado.anulada ? p.registrado : null;
    try {
      await this.env.PONTOS.get(this.env.PONTOS.idFromName('geral')).fetch('https://pontos/interno', {
        method: 'POST', headers: { 'x-interno': 'historico', 'content-type': 'application/json' },
        body: JSON.stringify({ w: { uid: p.lugares.w.uid, nome: p.lugares.w.nome }, b: { uid: p.lugares.b.uid, nome: p.lugares.b.nome }, ritmo: p.relogio ? p.relogio.ritmo : '', ranqueada: !!r, fim: p.fim, hist: p.e.hist, pontos: r }),
      });
    } catch {}
  }
  async registrarPontos() {
    const p = this.p, cat = this.categoria();
    if (!p.ranqueada || !p.fim || p.registrado || !cat || !this.env.PONTOS || !p.lugares.w || !p.lugares.b) return;
    const n = (p.e.hist || []).length;
    if (n < 2) { p.registrado = { anulada: true }; return; }
    if (FIM_SEM_JOGO.includes(p.fim.tipo) && n < MIN_LANCES_DESISTIR) { p.registrado = { anulada: true, motivo: 'cedo' }; return; }
    if (p.lugares.w.rede && p.lugares.w.rede === p.lugares.b.rede) { p.registrado = { anulada: true, motivo: 'rede' }; return; }
    const s = p.fim.vencedor === 'w' ? 1 : p.fim.vencedor === 'b' ? 0 : 0.5;
    // marca antes de perguntar ao Pontos: outra mensagem que chegue enquanto isso não manda de novo
    const reg = { pendente: true };
    p.registrado = reg;
    if (!p.idJogo) p.idJogo = crypto.randomUUID();
    let fim = { falhou: true };
    try {
      const r = await this.env.PONTOS.get(this.env.PONTOS.idFromName('geral')).fetch('https://pontos/interno', {
        method: 'POST', headers: { 'x-interno': 'resultado', 'content-type': 'application/json' },
        body: JSON.stringify({ id: p.idJogo, cat, w: p.lugares.w.uid, b: p.lugares.b.uid, s }),
      });
      if (r.ok) {
        const d = await r.json();
        const um = (x) => ({ antes: Math.round(x.antes.r), depois: x.depois.r, mostrar: P.mostrar(x.depois) });
        fim = d.limite ? { anulada: true, motivo: 'limite' } : { cat, w: um(d.w), b: um(d.b) };
      }
    } catch {}
    // (se nesse meio-tempo começou outra partida, o resultado é da anterior: não mexe)
    if (this.p === p && p.registrado === reg) p.registrado = fim;
  }

  // ---------- relógio (xadrez com ritmo) ----------
  // w e b = tempo que sobra (ms); desde = quando começou a contar a vez de quem joga agora (null = parado:
  // o relógio só anda depois que os dois fizeram o primeiro lance, e para no fim)
  relogioNovo(ritmo) {
    // só os ritmos da lista (Object.hasOwn: "constructor", "__proto__" e afins não viram ritmo)
    const r = ritmo === 'teste' && this.env.TESTE ? { base: 8000, inc: 1000 } : X.ritmoValido(ritmo) ? X.RITMOS[ritmo] : null;
    return r ? { ritmo, base: r.base, inc: r.inc, w: r.base, b: r.base, desde: null, prazo: null } : null;
  }
  // primeiro lance: com os dois na mesa, cada um tem um prazo para fazer o primeiro lance; se não fizer, a partida é cancelada
  marcarPrazo() {
    const p = this.p, r = p.relogio;
    if (!r) return;
    r.prazo = !p.fim && p.lugares.w && p.lugares.b && (p.e.hist || []).length < 2 ? Date.now() + PRAZO_PRIMEIRO : null;
  }
  prazoAcabou() {
    const p = this.p, r = p.relogio;
    if (!r || p.fim || !r.prazo || Date.now() < r.prazo) return false;
    r.prazo = null;
    p.fim = { tipo: 'cancelada', quem: p.e.vez };
    return true;
  }
  relogioAgora() {
    const r = this.p.relogio;
    if (!r) return null;
    const vez = this.p.e.vez, x = { ritmo: r.ritmo, base: r.base, inc: r.inc, w: r.w, b: r.b, anda: r.desde != null && !this.p.fim ? vez : null };
    if (x.anda) x[vez] = Math.max(0, r[vez] - (Date.now() - r.desde));
    if (r.prazo && !this.p.fim) x.prazo = Math.max(0, r.prazo - Date.now());
    return x;
  }
  // confere se o tempo de quem joga acabou (true = acabou e a partida terminou)
  tempoAcabou() {
    const p = this.p, r = p.relogio;
    if (!r || p.fim || r.desde == null) return false;
    const vez = p.e.vez;
    if (r[vez] - (Date.now() - r.desde) > 0) return false;
    r[vez] = 0; r.desde = null;
    const outro = vez === 'w' ? 'b' : 'w';
    p.fim = p.jogo === 'xadrez' && X.semMaterialParaMate(p.e.b, outro) ? { tipo: 'tempo-empate' } : { tipo: 'tempo', vencedor: outro, quem: vez };
    return true;
  }
  agendarTempo() {
    const r = this.p.relogio;
    if (!r || this.p.fim) return;
    if (r.prazo) this.ctx.storage.setAlarm(r.prazo + 50);
    else if (r.desde != null) this.ctx.storage.setAlarm(r.desde + r[this.p.e.vez] + 50);
  }

  async fetch(request) {
    // partida criada pela busca de adversário (src/pontos.js), por dentro do worker
    if (request.headers.get('x-interno') === 'criar') {
      if (this.p) return new Response('já existe', { status: 409 });
      const d = await request.json();
      const pessoa = (x) => ({ uid: x.uid, nome: x.nome, rede: typeof x.rede === 'string' ? x.rede : '' });
      if (d.jogo === 'truco') {
        // truco um contra um valendo pontos (da busca): já começa; o prazo da primeira jogada é o normal (ninguém conectou ainda)
        this.p = { jogo: 'truco', n: 2, dono: d.w.uid, lugares: [pessoa(d.w), pessoa(d.b)], e: null, fim: null, criado: Date.now(), partidas: 1, revanche: [], ranqueada: true, idJogo: crypto.randomUUID() };
        this.comecarTruco();
        this.prazoNormal();
        await this.lerPontosTruco();
        await this.salvar();
        return new Response('ok');
      }
      const jogo = d.jogo === 'dama' ? 'dama' : 'xadrez';
      this.p = { jogo, lugares: { w: pessoa(d.w), b: pessoa(d.b) }, e: JOGOS[jogo].novo(), fim: null, criado: Date.now(), partidas: 1, ranqueada: true, idJogo: crypto.randomUUID() };
      this.p.relogio = this.relogioNovo(d.ritmo);
      if (!this.p.relogio) { this.p = null; return new Response('ritmo', { status: 400 }); }
      this.marcarPrazo();
      await this.lerPontos();
      await this.salvar();
      this.agendarTempo();
      return new Response('ok');
    }
    const u = JSON.parse(request.headers.get('x-usuario') || 'null');
    const rede = redeDoPedido(request, this.env);
    const jogo = new URL(request.url).searchParams.get('jogo');
    if (!u) return new Response('sem dados', { status: 400 });
    const [cliente, servidor] = Object.values(new WebSocketPair());
    const recusar = (msg) => { servidor.accept(); servidor.send(JSON.stringify({ t: 'erro', fim: true, msg })); servidor.close(4003, 'nao'); return new Response(null, { status: 101, webSocket: cliente }); };
    if (!this.p) {
      if (jogo === 'truco') {
        const n = new URL(request.url).searchParams.get('n') === '4' ? 4 : 2;
        // um contra um com amigo pode valer pontos
        const ranqueada = n === 2 && new URL(request.url).searchParams.get('ranqueada') === '1';
        this.p = { jogo, n, dono: u.id, lugares: Array(n).fill(null), e: null, fim: null, criado: Date.now(), partidas: 1, revanche: [], ranqueada, idJogo: crypto.randomUUID() };
        this.p.lugares[0] = { uid: u.id, nome: u.nome, rede };
        await this.salvar();
      } else if (!JOGOS[jogo]) return recusar('Jogo desconhecido.');
      else {
      // quem abre a partida joga de brancas
      this.p = { jogo, lugares: { w: { uid: u.id, nome: u.nome, rede }, b: null }, e: JOGOS[jogo].novo(), fim: null, criado: Date.now(), partidas: 1, idJogo: crypto.randomUUID() };
      // xadrez e dama: com relógio quando escolheram um ritmo
      this.p.relogio = this.relogioNovo(new URL(request.url).searchParams.get('ritmo'));
      // partida entre amigos valendo pontos (só com relógio)
      this.p.ranqueada = !!this.p.relogio && new URL(request.url).searchParams.get('ranqueada') === '1';
      await this.salvar();
      }
    } else if (jogo && jogo !== this.p.jogo) return recusar('Este convite é de outro jogo.');
    const p = this.p;
    if (p.jogo === 'truco') {
      if (!p.lugares.some((j) => j && j.uid === u.id)) {
        const i = p.lugares.findIndex((j) => !j);
        if (i < 0) return recusar(p.e ? 'Esta mesa já começou sem você.' : 'Esta mesa já está cheia.');
        p.lugares[i] = { uid: u.id, nome: u.nome, rede };
        // dois amigos no um contra um: já começa; na mesa de 4 começa quando encher (ou quando o dono mandar)
        if (!p.e && p.lugares.every((j) => j)) { this.comecarTruco(); await this.lerPontosTruco(); }
        await this.salvar();
      }
    } else {
    let meu = LUGARES.find((l) => p.lugares[l] && p.lugares[l].uid === u.id);
    if (!meu) {
      meu = LUGARES.find((l) => !p.lugares[l]);
      if (!meu) return recusar('Esta partida já tem dois jogadores.');
      p.lugares[meu] = { uid: u.id, nome: u.nome, rede };
      this.marcarPrazo();
      await this.lerPontos();
      await this.salvar();
      this.agendarTempo();
    }
    // voltou: não está mais "fora"
    if (p.fora && p.fora[meu]) { delete p.fora[meu]; await this.salvar(); }
    }
    // a mesma pessoa em outra aba: a antiga sai
    for (const w of this.conexoes()) if (w.deserializeAttachment().uid === u.id) { w.serializeAttachment(null); try { w.close(4001, 'outra aba'); } catch {} }
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment({ uid: u.id, nome: u.nome, cota: 0, janela: 0 });
    // truco: chegou (ou voltou) na sua vez com o prazo curto de quem está fora: agora que está na mesa, o prazo é o normal
    if (p.jogo === 'truco' && p.e && !p.e.fim && p.prazoTotal === PRAZO_TRUCO_FORA && this.humanosQueAgem().some((l) => p.lugares[l].uid === u.id)) { this.agendarRobo(); await this.salvar(); }
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
    if (this.tempoAcabou() || this.prazoAcabou()) { await this.registrar(); await this.salvar(); this.avisarTodos(); return; }
    if (m.t === 'tempo') return; // o navegador viu o relógio zerar: a conferência acima já resolve
    if (m.t === 'lance') {
      if (p.fim) return erro('A partida acabou.');
      if (!p.lugares[outro]) return erro('Espere seu amigo chegar.');
      if (p.e.vez !== meu) return erro('Não é a sua vez.');
      const R = JOGOS[p.jogo];
      const l = R.validar(p.e, m);
      if (!l) { ws.send(JSON.stringify(this.visao(eu.uid))); return erro('Esse lance não vale.'); }
      p.e = R.avancar(p.e, l);
      p.empate = null;
      const r = p.relogio;
      if (r) {
        if (r.desde != null) { r[meu] = Math.max(0, r[meu] - (Date.now() - r.desde)) + r.inc; }
        // o relógio começa depois do primeiro lance das pretas
        r.desde = (p.e.hist || []).length >= 2 ? Date.now() : null;
        this.marcarPrazo();
      }
      const f = R.fim(p.e);
      if (f) p.fim = f;
    } else if (m.t === 'desistir') {
      if (p.fim) return;
      p.fim = { tipo: 'desistiu', vencedor: outro, quem: meu };
    } else if (m.t === 'vitoria') {
      // o adversário saiu faz tempo (e não voltou): quem ficou pede a vitória
      if (p.fim || !p.lugares[outro]) return;
      const desde = p.fora && p.fora[outro];
      if (!desde || this.online(p.lugares[outro].uid)) return erro('Seu adversário está na partida.');
      if (Date.now() - desde < this.prazoFora()) return erro('Espere mais um pouco: ele pode voltar.');
      p.fim = { tipo: 'saiu', vencedor: meu, quem: outro };
    } else if (m.t === 'empate') {
      if (p.fim || !p.lugares[outro]) return;
      if (p.empate && p.empate !== meu) p.fim = { tipo: 'empate' };
      else p.empate = meu;
    } else if (m.t === 'recusar-empate') {
      if (p.empate === outro) p.empate = null;
    } else if (m.t === 'revanche') {
      if (!p.fim) return;
      p.revanche = [...new Set([...(p.revanche || []), meu])];
      if (p.revanche.length === 2) { this.novaPartida(true); this.marcarPrazo(); await this.lerPontos(); }
    } else return;
    if (p.fim && p.relogio) p.relogio.prazo = null;
    if (p.fim && p.relogio && p.relogio.desde != null) { const r = p.relogio; r[p.e.vez] = Math.max(0, r[p.e.vez] - (Date.now() - r.desde)); r.desde = null; }
    await this.registrar();
    await this.salvar();
    this.agendarTempo();
    this.avisarTodos();
  }

  // ---------- truco ----------
  visaoTruco(uid) {
    const p = this.p;
    const eu = p.lugares.findIndex((j) => j && j.uid === uid);
    const lugares = p.lugares.map((j) => (j ? (j.robo ? { nome: j.nome, robo: true, online: true } : { nome: j.nome, online: this.online(j.uid) }) : null));
    const prazo = p.e && !p.e.fim && p.prazoJogada ? { falta: Math.max(0, p.prazoJogada - Date.now()), total: p.prazoTotal || this.prazoTruco() } : null;
    return { t: 'estado', jogo: 'truco', n: p.n, lugares, voce: eu, dono: p.dono === uid, comecou: !!p.e, estado: p.e ? T.visao(p.e, eu) : null, fim: p.e ? p.e.fim : null, revanche: p.revanche || [], partida: p.partidas, prazo, esgotou: p.esgotou || null, porRobo: p.porRobo || null, roboMax: ROBO_MAX, ranqueada: !!p.ranqueada, pontos: p.pontos || null, resultado: p.registrado || null };
  }
  comecarTruco() {
    const p = this.p;
    let k = 0;
    p.lugares = p.lugares.map((j) => j || { robo: true, nome: 'Robô ' + ++k });
    p.e = T.novo(p.n);
    p.revanche = [];
    this.agendarRobo();
  }
  // o prazo da jogada de agora volta a ser o normal (quem age vai chegar já)
  prazoNormal() {
    const p = this.p;
    if (!p.prazoJogada || p.prazoTotal !== PRAZO_TRUCO_FORA) return;
    p.prazoTotal = this.prazoTruco(); p.prazoJogada = Date.now() + p.prazoTotal;
    this.ctx.storage.setAlarm(p.prazoJogada);
  }
  // pontos do truco um contra um (lugar 0 e 1): [ { r, rd, mostrar }, ... ]
  async lerPontosTruco() {
    const p = this.p;
    if (!p.ranqueada || p.n !== 2 || !this.env.PONTOS || !p.lugares[0] || !p.lugares[1]) return;
    try {
      const r = await this.env.PONTOS.get(this.env.PONTOS.idFromName('geral')).fetch('https://pontos/interno?uids=' + p.lugares[0].uid + ',' + p.lugares[1].uid, { headers: { 'x-interno': 'ver' } });
      const n = await r.json();
      p.pontos = p.lugares.map((j) => { const x = P.envelhecer({ ...P.INICIAL, ...((n[j.uid] || {}).truco || {}) }, Date.now()); return { r: x.r, rd: x.rd, mostrar: P.mostrar(x) }; });
    } catch {}
  }
  // fim de um truco valendo pontos: manda o resultado (uma vez). As duas contas na mesma internet = não vale;
  // o limite de 3 por dia entre as mesmas contas fica no Pontos
  async registrarTruco() {
    const p = this.p;
    if (!p.ranqueada || p.n !== 2 || !p.e || !p.e.fim || p.registrado || !this.env.PONTOS || !p.lugares[0] || !p.lugares[1]) return;
    const [a, b] = p.lugares;
    if (a.rede && a.rede === b.rede) { p.registrado = { anulada: true, motivo: 'rede' }; return; }
    const reg = { pendente: true };
    p.registrado = reg;
    if (!p.idJogo) p.idJogo = crypto.randomUUID();
    let fim = { falhou: true };
    try {
      const r = await this.env.PONTOS.get(this.env.PONTOS.idFromName('geral')).fetch('https://pontos/interno', {
        method: 'POST', headers: { 'x-interno': 'resultado', 'content-type': 'application/json' },
        body: JSON.stringify({ id: p.idJogo, cat: 'truco', w: a.uid, b: b.uid, s: p.e.fim.vencedor === 0 ? 1 : 0 }),
      });
      if (r.ok) {
        const d = await r.json();
        const um = (x) => ({ antes: Math.round(x.antes.r), depois: x.depois.r, mostrar: P.mostrar(x.depois) });
        fim = d.limite ? { anulada: true, motivo: 'limite' } : { cat: 'truco', 0: um(d.w), 1: um(d.b) };
      }
    } catch {}
    if (this.p === p && p.registrado === reg) p.registrado = fim;
  }
  prazoTruco() { return this.env.TESTE ? 15000 : PRAZO_TRUCO; } // (servidor de teste: 15 s)
  humanosQueAgem() { const p = this.p; return T.quemAge(p.e).filter((l) => p.lugares[l] && !p.lugares[l].robo); }
  // o computador joga devagar (um alarme por jogada) para todo mundo ver as cartas na mesa.
  // Se quem tem que agir é gente: marca o prazo da jogada (chame antes de salvar)
  agendarRobo() {
    const p = this.p;
    p.prazoJogada = null;
    if (!p.e || p.e.fim) return;
    const quem = T.quemAge(p.e);
    if (!quem.length) return;
    const humanos = this.humanosQueAgem();
    if (humanos.length) {
      const fora = humanos.every((l) => !this.online(p.lugares[l].uid));
      p.prazoTotal = fora ? PRAZO_TRUCO_FORA : this.prazoTruco();
      p.prazoJogada = Date.now() + p.prazoTotal;
      this.ctx.storage.setAlarm(p.prazoJogada);
      return;
    }
    const ult = p.e.eventos[p.e.eventos.length - 1];
    const espera = ult && (ult.t === 'rodada' || ult.t === 'mao') ? 1700 : ult && ult.t === 'pediu' ? 1300 : 850;
    this.ctx.storage.setAlarm(Date.now() + espera);
  }
  async alarm() {
    const p = this.p;
    if (p && p.jogo !== 'truco') {
      // relógio do xadrez: o tempo de quem joga acabou?
      if (this.tempoAcabou() || this.prazoAcabou()) { await this.registrar(); await this.salvar(); this.avisarTodos(); } else this.agendarTempo();
      return;
    }
    if (!p || p.jogo !== 'truco' || !p.e || p.e.fim) return;
    const quem = T.quemAge(p.e);
    if (!quem.length) return;
    const humanos = this.humanosQueAgem();
    let l = quem[0];
    if (humanos.length) {
      // gente na vez: só quando o prazo acabou o computador joga no lugar dela
      if (!p.prazoJogada) { this.agendarRobo(); await this.salvar(); return; }
      if (Date.now() < p.prazoJogada - 30) { this.ctx.storage.setAlarm(p.prazoJogada); return; }
      l = humanos[0];
      p.esgotou = { lugar: l, n: ((p.esgotou && p.esgotou.n) || 0) + 1 };
      // valendo pontos: ninguém ganha pontos com o computador jogando por ele (saiu ou deixou o tempo acabar)
      if (p.ranqueada && p.n === 2) {
        p.porRobo = p.porRobo || [0, 0];
        if (++p.porRobo[l] > ROBO_MAX) p.e.fim = { vencedor: 1 - T.time(l), abandono: l };
      }
    }
    const a = p.e.fim ? null : T.robo(p.e, l);
    if (a) T.agir(p.e, l, a);
    this.agendarRobo();
    await this.registrarTruco();
    await this.salvar();
    this.avisarTodos();
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
      if (humanos.every((i) => p.revanche.includes(i))) { p.e = T.novo(p.n); p.revanche = []; p.partidas++; p.registrado = null; p.porRobo = null; p.idJogo = crypto.randomUUID(); this.agendarRobo(); await this.lerPontosTruco(); }
    } else return;
    await this.registrarTruco();
    await this.salvar();
    this.avisarTodos();
  }

  async webSocketClose(ws) { await this.saiu(ws); }
  async webSocketError(ws) { await this.saiu(ws); }
  async saiu(ws) {
    const eu = ws.deserializeAttachment();
    ws.serializeAttachment(null);
    try { ws.close(1000, 'tchau'); } catch {}
    if (!eu) return;
    const p = this.p;
    // truco: se era a vez de quem saiu, o computador joga por ele logo
    if (p && p.jogo === 'truco' && p.e && !p.e.fim && !this.online(eu.uid)) {
      const meu = p.lugares.findIndex((j) => j && j.uid === eu.uid);
      if (this.humanosQueAgem().includes(meu)) { this.agendarRobo(); await this.salvar(); }
    }
    // xadrez/dama em andamento: marca desde quando a pessoa está fora (o outro pode pedir a vitória depois de um tempo)
    if (p && p.jogo !== 'truco' && !p.fim && p.lugares.w && p.lugares.b && !this.online(eu.uid)) {
      const cor = LUGARES.find((l) => p.lugares[l].uid === eu.uid);
      if (cor) { p.fora = { ...(p.fora || {}), [cor]: Date.now() }; await this.salvar(); }
    }
    this.avisarTodos();
  }
  prazoFora() { return this.env.TESTE ? 5000 : PRAZO_FORA; }
}

// Pontos (rating) do xadrez e a busca de adversário. Uma instância só ("geral").
//  - guarda a nota de cada conta em cada categoria (bullet, blitz, rápida) e atualiza no fim das partidas que valem pontos
//    (quem chama é a Partida, por dentro do worker: cabeçalho x-interno, que a API do site nunca repassa);
//  - fila de quem está procurando partida (WebSocket da tela): junta duas pessoas do mesmo ritmo com pontos parecidos,
//    cria a partida (cores sorteadas) e manda o código para as duas.
import { DurableObject } from 'cloudflare:workers';
import * as P from '../../public/js/pontos-regras.js';
import { RITMOS } from '../../public/js/xadrez-regras.js';

const codigoNovo = () => { const L = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.getRandomValues(new Uint8Array(14))].map((x) => L[x % L.length]).join(''); };
// rede (hash do IP) de quem chamou: vem do site (x-rede). Só no servidor de teste dá para trocar pela URL (?rede=)
export const redeDoPedido = (request, env) => (env.TESTE && new URL(request.url).searchParams.get('rede')) || request.headers.get('x-rede') || '';
const LIMITE_PAR_DIA = 3; // partidas valendo pontos entre as mesmas duas contas no mesmo dia
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

export class Pontos extends DurableObject {
  async notas(uid) { return (await this.ctx.storage.get('u:' + uid)) || {}; }
  async nota(uid, cat) { const n = await this.notas(uid); return P.envelhecer({ ...P.INICIAL, ...(n[cat] || {}) }, Date.now()); }

  async fetch(request) {
    const url = new URL(request.url);
    const interno = request.headers.get('x-interno');
    if (interno === 'ver') {
      const uids = (url.searchParams.get('uids') || '').split(',').map(Number).filter(Number.isInteger).slice(0, 10);
      const out = {};
      for (const u of uids) out[u] = await this.notas(u);
      return json(out);
    }
    if (interno === 'resultado') {
      // { cat, w, b (uids), s (pontos das brancas) } -> notas antes e depois
      const d = await request.json();
      if (!Object.hasOwn(P.NOME_CATEGORIA, d.cat || '') || !Number.isInteger(d.w) || !Number.isInteger(d.b) || d.w === d.b || ![0, 0.5, 1].includes(d.s)) return json({ erro: 'dados' }, 400);
      // a mesma partida só conta uma vez (id da partida)
      const chaveId = typeof d.id === 'string' && d.id ? 'r:' + d.id.slice(0, 40) : null;
      if (chaveId) { const ja = await this.ctx.storage.get(chaveId); if (ja) return json(ja); }
      // as mesmas duas contas: só as primeiras partidas do dia valem pontos
      const chavePar = 'par:' + Math.min(d.w, d.b) + '-' + Math.max(d.w, d.b) + ':' + new Date().toISOString().slice(0, 10);
      const quantas = (await this.ctx.storage.get(chavePar)) || 0;
      if (quantas >= LIMITE_PAR_DIA) return json({ limite: true });
      const nw = await this.notas(d.w), nb = await this.notas(d.b);
      const aw = { ...P.INICIAL, ...(nw[d.cat] || {}) }, ab = { ...P.INICIAL, ...(nb[d.cat] || {}) };
      const r = P.partida(aw, ab, d.s);
      nw[d.cat] = r.w; nb[d.cat] = r.b;
      const out = { w: { antes: aw, depois: r.w }, b: { antes: ab, depois: r.b } };
      await this.ctx.storage.put({ ['u:' + d.w]: nw, ['u:' + d.b]: nb, [chavePar]: quantas + 1, ...(chaveId ? { [chaveId]: out } : {}) });
      return json(out);
    }
    // busca de adversário (WebSocket)
    const u = JSON.parse(request.headers.get('x-usuario') || 'null');
    if (!u || request.headers.get('upgrade') !== 'websocket') return new Response('sem dados', { status: 400 });
    const ritmo = url.searchParams.get('ritmo');
    const [cliente, servidor] = Object.values(new WebSocketPair());
    if (!(Object.hasOwn(RITMOS, ritmo || '') || (ritmo === 'teste' && this.env.TESTE))) { servidor.accept(); servidor.send(JSON.stringify({ t: 'erro', msg: 'Escolha um ritmo com relógio.' })); servidor.close(4003, 'ritmo'); return new Response(null, { status: 101, webSocket: cliente }); }
    // a mesma pessoa só fica uma vez na fila
    for (const w of this.ctx.getWebSockets()) { const a = w.deserializeAttachment(); if (a && a.uid === u.id) { w.serializeAttachment(null); try { w.close(4001, 'outra aba'); } catch {} } }
    const cat = P.categoria(ritmo);
    const n = await this.nota(u.id, cat);
    this.ctx.acceptWebSocket(servidor);
    servidor.serializeAttachment({ uid: u.id, nome: u.nome, ritmo, cat, r: n.r, desde: Date.now(), rede: redeDoPedido(request, this.env) });
    servidor.send(JSON.stringify({ t: 'fila', ritmo, pontos: P.mostrar(n) }));
    await this.parear();
    return new Response(null, { status: 101, webSocket: cliente });
  }

  // junta quem dá: mesmo ritmo, diferença de pontos dentro da janela (que abre com a espera)
  async parear() {
    const agora = Date.now();
    const fila = this.ctx.getWebSockets().map((w) => ({ w, a: w.deserializeAttachment() })).filter((x) => x.a).sort((x, y) => x.a.desde - y.a.desde);
    const usados = new Set();
    for (const x of fila) {
      if (usados.has(x.w)) continue;
      let melhor = null;
      for (const y of fila) {
        if (y === x || usados.has(y.w) || y.a.ritmo !== x.a.ritmo || y.a.uid === x.a.uid) continue;
        // duas contas da mesma internet não se encontram na busca (para ninguém ganhar pontos jogando contra si mesmo)
        if (x.a.rede && x.a.rede === y.a.rede) continue;
        const dif = Math.abs(x.a.r - y.a.r);
        if (dif > P.janela(agora - Math.min(x.a.desde, y.a.desde))) continue;
        if (!melhor || dif < melhor.dif) melhor = { y, dif };
      }
      if (!melhor) continue;
      usados.add(x.w); usados.add(melhor.y.w);
      await this.criar(x, melhor.y);
    }
    if (this.ctx.getWebSockets().some((w) => w.deserializeAttachment())) this.ctx.storage.setAlarm(Date.now() + 2000);
  }
  async criar(x, y) {
    const [w, b] = Math.random() < 0.5 ? [x, y] : [y, x];
    const codigo = codigoNovo();
    const r = await this.env.PARTIDA.get(this.env.PARTIDA.idFromName(codigo)).fetch('https://partida/interno', {
      method: 'POST', headers: { 'x-interno': 'criar', 'content-type': 'application/json' },
      body: JSON.stringify({ jogo: 'xadrez', ritmo: x.a.ritmo, ranqueada: true, w: { uid: w.a.uid, nome: w.a.nome, rede: w.a.rede }, b: { uid: b.a.uid, nome: b.a.nome, rede: b.a.rede } }),
    });
    for (const z of [x, y]) {
      z.w.serializeAttachment(null);
      try { z.w.send(JSON.stringify(r.ok ? { t: 'achou', codigo } : { t: 'erro', msg: 'Não deu para criar a partida. Tente de novo.' })); z.w.close(1000, 'achou'); } catch {}
    }
  }
  async alarm() { await this.parear(); }
  webSocketClose(ws) { ws.serializeAttachment(null); }
  webSocketMessage() {}
}

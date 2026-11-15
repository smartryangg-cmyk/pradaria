// Conexão com o saguão da plataforma (sala-worker/src/lobby.js): amigos online, em qual jogo, e convites.
// Uma por aba, aberta enquanto houver conta. Reconecta sozinha.
//   const lobby = new Lobby('hub', { ola, presenca, convite, 'convite-resp', 'amigos-mudou' });
//   lobby.jogo('pradaria'); lobby.convidar(id, 'pradaria', codigo, 'Mundo do Ryan');
import { conta } from './rede.js';

export class Lobby {
  constructor(jogo, handlers = {}) {
    this.j = jogo;
    this.h = handlers;
    this.online = new Map(); // id do amigo -> jogo
    this.fechado = false;
    this.tentativas = 0;
    this.conectar();
  }
  conectar() {
    if (this.fechado || !conta.token) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/lobby?jogo=${encodeURIComponent(this.j)}&t=${encodeURIComponent(conta.token)}`);
    this.ws = ws;
    ws.onopen = () => { this.tentativas = 0; };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'ola') { this.online = new Map(Object.entries(m.online || {}).map(([k, v]) => [+k, v])); }
      else if (m.t === 'presenca') { if (m.jogo) this.online.set(m.id, m.jogo); else this.online.delete(m.id); }
      const fn = this.h[m.t];
      if (fn) fn(m);
      if ((m.t === 'ola' || m.t === 'presenca') && this.h.mudou) this.h.mudou();
    };
    ws.onclose = (ev) => {
      if (this.ws !== ws) return;
      this.online.clear();
      if (this.h.mudou) this.h.mudou();
      if (this.fechado || ev.code === 4001) return;
      const espera = Math.min(30000, 1500 * 2 ** this.tentativas++);
      setTimeout(() => this.conectar(), espera);
    };
    ws.onerror = () => {};
  }
  enviar(o) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(o)); return true; } return false; }
  jogo(j) { this.j = j; this.enviar({ t: 'jogo', jogo: j }); }
  convidar(para, jogo, sala, titulo) { return this.enviar({ t: 'convidar', para, jogo, sala, titulo }); }
  responder(para, jogo, aceitou) { return this.enviar({ t: 'resposta', para, jogo, aceitou }); }
  // depois de entrar/sair da conta ou mudar a lista de amigos: conexão nova (o servidor relê os amigos)
  reabrir() { const w = this.ws; this.ws = null; if (w) try { w.close(); } catch {} this.fechado = false; this.tentativas = 0; this.conectar(); }
  fechar() { this.fechado = true; const w = this.ws; this.ws = null; this.online.clear(); if (w) try { w.close(); } catch {} }
}

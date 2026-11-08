// Conversa com o servidor: contas, mundos e a sala em tempo real (WebSocket).
const CHAVE_TOKEN = 'pradaria.token';

export const conta = {
  token: (() => { try { return localStorage.getItem(CHAVE_TOKEN); } catch { return null; } })(),
  usuario: null,
  salvar(t) { this.token = t; try { t ? localStorage.setItem(CHAVE_TOKEN, t) : localStorage.removeItem(CHAVE_TOKEN); } catch {} },
};

export async function api(caminho, corpo, metodo) {
  const r = await fetch('/api/' + caminho, {
    method: metodo || (corpo ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(conta.token ? { authorization: 'Bearer ' + conta.token } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let dados = null;
  try { dados = await r.json(); } catch {}
  if (!r.ok) throw new Error((dados && dados.erro) || 'Não deu certo (' + r.status + ')');
  return dados;
}

export class Sala {
  constructor(codigo, handlers) {
    this.codigo = codigo;
    this.h = handlers;
    this.ws = null;
    this.fechada = false;
    this.tentativas = 0;
    this.conectar();
  }

  conectar() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}/api/sala/${encodeURIComponent(this.codigo)}?t=${encodeURIComponent(conta.token || '')}`);
    this.ws = ws;
    ws.onopen = () => { this.tentativas = 0; this.abriu = true; this.h.status && this.h.status('online'); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'erro' && m.fim) { this.fechada = true; this.h.fim && this.h.fim(m.msg); return; }
      const fn = this.h[m.t];
      if (fn) fn(m);
    };
    ws.onclose = (ev) => {
      if (this.fechada) return;
      // recusado de vez (sala cheia, outro aparelho) ou nunca conseguiu entrar (login vencido): para de tentar
      if (ev.code >= 4000 || (!this.abriu && this.tentativas >= 4)) {
        this.fechada = true;
        this.h.fim && this.h.fim(this.abriu ? 'A conexão com o mundo caiu.' : 'Não consegui entrar neste mundo. Entre na conta de novo.');
        return;
      }
      this.h.status && this.h.status('reconectando');
      const espera = Math.min(15000, 1000 * 2 ** this.tentativas++);
      setTimeout(() => !this.fechada && this.conectar(), espera);
    };
    ws.onerror = () => {};
  }

  enviar(obj) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj)); }
  fechar() { this.fechada = true; if (this.ws) this.ws.close(); }
}

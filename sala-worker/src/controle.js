// Celular como controle da TV: a TV abre uma "sala de controle" com um código curto e o celular entra nela.
// Não guarda nada: só repassa os recados entre a TV e o celular (WebSocket, hibernando quando ninguém fala).
import { DurableObject } from 'cloudflare:workers';

const MAX_CELULARES = 2; // dois celulares na mesma TV (um joga, o outro pode ajudar nos menus)
const MAX_MSG = 600; // um recado de controle é bem pequeno (o maior é o texto digitado)
const MSG_POR_SEG = 80;

export class Controle extends DurableObject {
  async fetch(request) {
    const papel = request.headers.get('x-controle');
    if (papel !== 'tv' && papel !== 'cel') return new Response('sem papel', { status: 400 });
    const par = new WebSocketPair();
    const [cliente, servidor] = Object.values(par);
    const tvs = this.ctx.getWebSockets('tv');
    const cels = this.ctx.getWebSockets('cel');
    const recusar = (msg, cod) => {
      servidor.accept();
      servidor.send(JSON.stringify({ t: 'erro', msg }));
      servidor.close(cod, 'recusado');
      return new Response(null, { status: 101, webSocket: cliente });
    };
    if (papel === 'cel') {
      if (!tvs.length) return recusar('Não achei a TV com esse código. Confira o código que aparece na TV.', 4004);
      if (cels.length >= MAX_CELULARES) return recusar('Essa TV já tem celulares demais ligados.', 4003);
    } else {
      // a mesma TV abrindo de novo (recarregou a página): a conexão antiga sai
      for (const w of tvs) { try { w.close(4001, 'outra tv'); } catch {} }
    }
    this.ctx.acceptWebSocket(servidor, [papel]);
    const n = (papel === 'cel' ? cels.length : 0) + 1;
    servidor.serializeAttachment({ papel, n, janela: 0, cota: 0 });
    if (papel === 'cel') {
      servidor.send(JSON.stringify({ t: 'par', ok: true, n }));
      for (const w of tvs) { try { w.send(JSON.stringify({ t: 'par', ok: true, cel: this.ctx.getWebSockets('cel').length, n })); } catch {} }
    } else {
      servidor.send(JSON.stringify({ t: 'par', ok: cels.length > 0, cel: cels.length }));
      for (const w of cels) { try { w.send(JSON.stringify({ t: 'par', ok: true })); } catch {} }
    }
    return new Response(null, { status: 101, webSocket: cliente });
  }

  async webSocketMessage(ws, dados) {
    if (typeof dados !== 'string' || dados.length > MAX_MSG) return;
    const eu = ws.deserializeAttachment();
    if (!eu) return;
    const agora = Date.now();
    if (agora - eu.janela > 1000) { eu.janela = agora; eu.cota = 0; }
    if (++eu.cota > MSG_POR_SEG) return;
    ws.serializeAttachment(eu);
    if (dados === '"ping"') return;
    // só repassa: do celular para a TV (marcando qual celular é) e da TV para os celulares
    if (eu.papel === 'cel') {
      let m; try { m = JSON.parse(dados); } catch { return; }
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
      m.c = eu.n;
      const txt = JSON.stringify(m);
      for (const w of this.ctx.getWebSockets('tv')) { try { w.send(txt); } catch {} }
    } else {
      for (const w of this.ctx.getWebSockets('cel')) { try { w.send(dados); } catch {} }
    }
  }

  async webSocketClose(ws) { this.saiu(ws); }
  async webSocketError(ws) { this.saiu(ws); }

  saiu(ws) {
    const eu = ws.deserializeAttachment();
    try { ws.close(1000, 'tchau'); } catch {}
    if (!eu) return;
    ws.serializeAttachment(null);
    if (eu.papel === 'cel') {
      const resto = this.ctx.getWebSockets('cel').filter((w) => w !== ws && w.deserializeAttachment()).length;
      for (const w of this.ctx.getWebSockets('tv')) { try { w.send(JSON.stringify({ t: 'par', ok: resto > 0, cel: resto, saiu: eu.n })); } catch {} }
    } else {
      for (const w of this.ctx.getWebSockets('cel')) { try { w.send(JSON.stringify({ t: 'par', ok: false, tvSaiu: true })); } catch {} }
    }
  }
}

// Chat de texto e de voz no jogo online (os botões da esquerda, a caixa de escrever e a lista de quem está na voz).
// O dono do mundo liga/desliga cada um nas opções do mundo (pausa). Cada jogador pode silenciar alguém só para si.
import { icone } from './icones.js';
import { filtrarChat, CHAT_MAX } from './chat-filtro.js';
import { Voz } from './voz.js';

const $ = (s) => document.querySelector(s);
const CHAVE_SILENCIO = 'pradaria.silenciados';
const SOME_EM = 12000; // a mensagem some da tela depois de 12 s (abrindo o chat, aparecem todas)
const MAX_LOG = 40;
// o id de cada conexão é "<id da conta>-<sorteio>": silenciar vale para a pessoa, mesmo se ela reconectar
const contaDe = (id) => String(id).split('-')[0];

export class Chat {
  // J: { sala(), euId(), nomeDe(id), aviso(txt, ms, ic), iconeCabeca(id, nome), pausar(sim), dono(), mudarOpcoes(texto, voz) }
  constructor(J) {
    this.J = J;
    this.op = { texto: false, voz: false };
    this.online = false;
    this.log = []; // { id, nome, txt, em, el }
    this.silenciados = new Set();
    try { for (const x of JSON.parse(localStorage.getItem(CHAVE_SILENCIO) || '[]')) this.silenciados.add(String(x)); } catch {}
    this.voz = new Voz({
      enviar: (m) => { const s = J.sala(); if (s) s.enviar(m); },
      aoMudar: (id, on) => { if (id && on) J.iconeCabeca(id, 'microfone'); this.desenharVoz(); },
      silenciado: (id) => this.silenciados.has(contaDe(id)),
      aviso: J.aviso,
    });
    this.montar();
  }

  montar() {
    $('#chat-txt').maxLength = CHAT_MAX;
    $('#bt-chat').addEventListener('click', () => (this.aberto ? this.fechar() : this.abrir()));
    $('#chat-fechar').addEventListener('click', () => this.fechar());
    $('#chat-caixa').addEventListener('submit', (e) => { e.preventDefault(); this.mandar(); });
    $('#chat-txt').addEventListener('keydown', (e) => { if (e.code === 'Escape') { e.preventDefault(); this.fechar(); } e.stopPropagation(); });
    $('#bt-voz').addEventListener('click', () => (this.voz.ligada ? this.voz.desligar() : this.voz.ligar()));
    $('#bt-mudo').addEventListener('click', () => this.voz.alternarMudo());
    // apertar para falar: segurar o botão (dedo ou mouse) ou a tecla B
    const falar = $('#bt-falar');
    const soltar = () => this.voz.falar(false);
    falar.addEventListener('pointerdown', (e) => { e.preventDefault(); try { falar.setPointerCapture(e.pointerId); } catch {} this.voz.falar(true); });
    falar.addEventListener('pointerup', soltar);
    falar.addEventListener('pointercancel', soltar);
    falar.addEventListener('lostpointercapture', soltar);
    falar.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('keydown', (e) => {
      if (!this.online || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'KeyB' && !e.repeat) this.voz.falar(true);
      else if ((e.code === 'KeyT' || e.code === 'Enter') && this.op.texto && !this.J.pausado()) { e.preventDefault(); this.abrir(); }
    });
    addEventListener('keyup', (e) => { if (e.code === 'KeyB') this.voz.falar(false); });
    addEventListener('blur', soltar);
    // dono: liga/desliga nas opções da pausa
    $('#dono-chat-texto').addEventListener('change', (e) => this.J.mudarOpcoes({ texto: e.target.checked }));
    $('#dono-chat-voz').addEventListener('change', (e) => this.J.mudarOpcoes({ voz: e.target.checked }));
  }

  // ---------- entrar e sair do mundo ----------
  entrou(msg) {
    this.online = true;
    this.limparLog();
    this.aplicarOp(msg.chat || { texto: false, voz: false });
    for (const h of msg.historico || []) this.adicionar(h, true);
    $('#conversa').hidden = false;
  }

  // reconectou (nova conexão na sala): a voz recomeça
  reconectou(msg) {
    this.aplicarOp(msg.chat || this.op);
    if (this.voz.ligada) { this.voz.desligar(false); this.voz.ligar(); }
  }

  saiu() {
    this.online = false;
    this.voz.desligar(false);
    this.fechar();
    this.limparLog();
    $('#conversa').hidden = true;
  }

  aplicarOp(op) {
    const antes = this.op;
    this.op = { texto: !!op.texto, voz: !!op.voz };
    if (!this.op.voz && this.voz.ligada) { this.voz.desligar(false); if (antes.voz) this.J.aviso('O dono do mundo desligou o chat de voz.', 3000, 'microfoneoff'); }
    if (!this.op.texto) { this.fechar(); this.limparLog(); if (antes.texto && this.online) this.J.aviso('O dono do mundo desligou o chat de texto.', 3000, 'balao'); }
    $('#dono-chat-texto').checked = this.op.texto;
    $('#dono-chat-voz').checked = this.op.voz;
    this.desenharVoz();
  }

  // ---------- texto ----------
  get aberto() { return !$('#chat-caixa').hidden; }

  abrir() {
    if (!this.op.texto || !this.online) return;
    if (document.pointerLockElement) document.exitPointerLock();
    $('#chat-caixa').hidden = false;
    $('#conversa').classList.add('aberto');
    $('#chat-erro').textContent = '';
    for (const l of this.log) l.el.classList.remove('some');
    const t = $('#chat-txt');
    t.focus();
    $('#chat-log').scrollTop = 1e6;
  }

  fechar() {
    if ($('#chat-caixa').hidden) return;
    $('#chat-caixa').hidden = true;
    $('#conversa').classList.remove('aberto');
    $('#chat-txt').blur();
    const agora = Date.now();
    for (const l of this.log) if (agora - l.em > SOME_EM) l.el.classList.add('some');
  }

  mandar() {
    const t = $('#chat-txt');
    const f = filtrarChat(t.value);
    if (f.erro) { $('#chat-erro').textContent = t.value.trim() ? f.erro : ''; return; }
    const s = this.J.sala();
    if (!s) return;
    s.enviar({ t: 'chat', txt: f.texto });
    t.value = '';
    $('#chat-erro').textContent = '';
  }

  // mensagem da sala
  recebeu(m) { this.adicionar(m, false); }
  erro(m) { if (this.aberto) $('#chat-erro').textContent = m.msg; else this.J.aviso(m.msg, 3000, 'balao'); }

  adicionar(m, antiga) {
    if (!this.op.texto) return;
    const el = document.createElement('div');
    el.className = 'chat-msg';
    const nome = document.createElement('button');
    nome.type = 'button'; nome.className = 'chat-nome'; nome.textContent = m.nome;
    nome.title = 'Silenciar ou ouvir de novo esta pessoa';
    nome.addEventListener('click', () => this.alternarSilencio(m.id, m.nome));
    const txt = document.createElement('span');
    txt.textContent = m.txt; // sempre texto puro (nunca HTML)
    el.append(nome, txt);
    if (m.id === this.J.euId()) el.classList.add('eu');
    const item = { id: m.id, nome: m.nome, txt: m.txt, em: antiga ? 0 : Date.now(), el };
    this.log.push(item);
    if (this.log.length > MAX_LOG) this.log.shift().el.remove();
    this.esconderSilenciados(item);
    if (antiga && !this.aberto) el.classList.add('some');
    $('#chat-log').appendChild(el);
    $('#chat-log').scrollTop = 1e6;
    if (!antiga) {
      if (m.id !== this.J.euId() && !this.silenciados.has(contaDe(m.id))) this.J.iconeCabeca(m.id, 'balao');
      setTimeout(() => { if (!this.aberto) el.classList.add('some'); }, SOME_EM);
    }
  }

  limparLog() { for (const l of this.log) l.el.remove(); this.log = []; }

  esconderSilenciados(item) { item.el.classList.toggle('silenciada', this.silenciados.has(contaDe(item.id))); }

  alternarSilencio(id, nome) {
    if (id === this.J.euId()) return;
    const c = contaDe(id);
    if (this.silenciados.has(c)) {
      this.silenciados.delete(c);
      this.J.aviso(`Você voltou a ouvir ${nome}.`, 2500, 'altofalante');
    } else {
      if (!confirm(`Silenciar ${nome}? Você não vai mais ver as mensagens nem ouvir a voz dessa pessoa (só neste aparelho).`)) return;
      this.silenciados.add(c);
      this.J.aviso(`${nome} foi silenciado(a) para você.`, 2500, 'silencio');
    }
    try { localStorage.setItem(CHAVE_SILENCIO, JSON.stringify([...this.silenciados])); } catch {}
    for (const l of this.log) this.esconderSilenciados(l);
    this.voz.atualizarVolumes();
    this.desenharVoz();
  }

  // ---------- voz ----------
  mensagemVoz(m) { this.voz.mensagem(m); }
  jogadorSaiu(id) { this.voz.saiu(id); }

  desenharVoz() {
    const v = this.voz;
    $('#bt-chat').hidden = !this.op.texto;
    $('#bt-voz').hidden = !this.op.voz;
    const ic = $('#bt-voz span');
    ic.dataset.icone = v.ligada ? 'microfone' : 'microfoneoff';
    ic.innerHTML = icone(ic.dataset.icone);
    $('#bt-voz').classList.toggle('ligado', v.ligada);
    $('#bt-voz').setAttribute('aria-label', v.ligada ? 'Sair do chat de voz' : 'Entrar no chat de voz');
    $('#bt-falar').hidden = !(v.ligada && v.temMicrofone);
    $('#bt-falar').classList.toggle('ativo', v.falandoAgora);
    $('#bt-mudo').hidden = !v.ligada;
    const icm = $('#bt-mudo span');
    icm.innerHTML = icone(v.mudo ? 'silencio' : 'altofalante');
    $('#bt-mudo').setAttribute('aria-label', v.mudo ? 'Voltar a ouvir os amigos' : 'Mudo: não ouvir ninguém');
    $('#bt-mudo').classList.toggle('ligado', v.mudo);
    // quem está na voz
    const lista = $('#voz-gente');
    lista.hidden = !v.ligada;
    lista.textContent = '';
    if (!v.ligada) return;
    const eu = document.createElement('div');
    eu.className = 'voz-pessoa' + (v.falandoAgora ? ' falando' : '');
    eu.innerHTML = icone(v.temMicrofone ? 'microfone' : 'microfoneoff', 'ic-svg');
    eu.append(document.createTextNode('Você'));
    lista.appendChild(eu);
    for (const id of v.naVoz) {
      const nome = this.J.nomeDe(id);
      if (!nome) continue;
      const silenciado = this.silenciados.has(contaDe(id));
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'voz-pessoa' + (v.falando(id) && !silenciado ? ' falando' : '') + (silenciado ? ' silenciada' : '');
      b.innerHTML = icone(silenciado ? 'silencio' : 'microfone', 'ic-svg');
      b.append(document.createTextNode(nome));
      b.title = silenciado ? 'Ouvir de novo' : 'Silenciar só para mim';
      b.addEventListener('click', () => this.alternarSilencio(id, nome));
      lista.appendChild(b);
    }
  }
}

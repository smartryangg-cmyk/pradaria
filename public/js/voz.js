// Chat de voz: áudio direto entre os aparelhos (WebRTC), a sala só passa os recados para eles se acharem.
// Microfone fica DESLIGADO o tempo todo; só manda som enquanto o jogador segura o botão de falar.
// Quem não tem microfone (ou não deixou usar) entra só para ouvir.
const ICE = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];

export class Voz {
  // enviar(msg): manda pela sala; aoMudar(): redesenhar a tela; silenciado(id): esta pessoa foi silenciada aqui
  constructor({ enviar, aoMudar, silenciado, aviso }) {
    this.enviar = enviar; this.aoMudar = aoMudar || (() => {}); this.silenciado = silenciado || (() => false);
    this.aviso = aviso || (() => {});
    this.ligada = false;
    this.stream = null; // microfone (null = só ouvir)
    this.pares = new Map(); // id -> { pc, audio, falando, filaIce }
    this.naVoz = new Set(); // ids de quem está na voz (inclusive quem ainda não conectou)
    this.falandoAgora = false;
    this.mudo = false; // não ouvir ninguém
    this.ligando = false;
  }

  static suportado() { return typeof RTCPeerConnection === 'function'; }

  async ligar() {
    if (this.ligada || this.ligando) return;
    if (!Voz.suportado()) { this.aviso('Este aparelho não consegue usar o chat de voz.', 3000, 'microfoneoff'); return; }
    this.ligando = true;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
        for (const t of this.stream.getAudioTracks()) t.enabled = false; // só liga segurando o botão
      }
    } catch {
      this.stream = null;
      this.aviso('Sem microfone: você vai só ouvir os amigos.', 3500, 'microfoneoff');
    }
    this.ligando = false;
    this.ligada = true;
    this.enviar({ t: 'voz-entrar' });
    this.aoMudar();
  }

  desligar(avisarSala = true) {
    if (!this.ligada && !this.ligando) return;
    this.falar(false);
    for (const id of [...this.pares.keys()]) this.fechar(id);
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null;
    this.ligada = false;
    this.naVoz.clear();
    if (avisarSala) this.enviar({ t: 'voz-sair' });
    this.aoMudar();
  }

  get temMicrofone() { return !!this.stream; }

  // segurar o botão de falar
  falar(on) {
    on = !!on && this.ligada && !!this.stream;
    if (on === this.falandoAgora) return;
    this.falandoAgora = on;
    if (this.stream) for (const t of this.stream.getAudioTracks()) t.enabled = on;
    if (this.ligada) this.enviar({ t: 'voz-fala', on });
    this.aoMudar();
  }

  alternarMudo() {
    this.mudo = !this.mudo;
    this.atualizarVolumes();
    this.aoMudar();
  }

  atualizarVolumes() {
    for (const [id, p] of this.pares) if (p.audio) p.audio.muted = this.mudo || this.silenciado(id);
  }

  // ---------- mensagens da sala ----------
  mensagem(m) {
    if (m.t === 'voz-lista') {
      if (!this.ligada) return;
      // eu acabei de entrar: eu chamo quem já estava
      for (const id of m.ids) { this.naVoz.add(id); this.conectar(id, true); }
      this.aoMudar();
    } else if (m.t === 'voz') {
      if (m.on) this.naVoz.add(m.id); else { this.naVoz.delete(m.id); this.fechar(m.id); }
      this.aoMudar();
    } else if (m.t === 'voz-sinal') {
      if (this.ligada) this.sinal(m.de, m.d);
    } else if (m.t === 'voz-fala') {
      const p = this.pares.get(m.id);
      if (p) p.falando = !!m.on;
      this.aoMudar(m.id, !!m.on);
    }
  }

  saiu(id) { this.naVoz.delete(id); this.fechar(id); this.aoMudar(); }
  falando(id) { const p = this.pares.get(id); return !!(p && p.falando); }

  conectar(id, chamar) {
    if (this.pares.has(id)) return this.pares.get(id);
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const par = { pc, audio: null, falando: false, filaIce: [] };
    this.pares.set(id, par);
    if (this.stream) for (const t of this.stream.getAudioTracks()) pc.addTrack(t, this.stream);
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = (e) => {
      if (e.candidate) this.enviar({ t: 'voz-sinal', para: id, d: { ice: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } } });
    };
    pc.ontrack = (e) => {
      if (!par.audio) {
        par.audio = document.createElement('audio');
        par.audio.autoplay = true;
        par.audio.setAttribute('playsinline', '');
        par.audio.dataset.voz = id;
        document.body.appendChild(par.audio);
      }
      par.audio.srcObject = e.streams[0] || new MediaStream([e.track]);
      par.audio.muted = this.mudo || this.silenciado(id);
      const p = par.audio.play(); if (p && p.catch) p.catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') this.aviso('Não consegui ligar a voz com um amigo (a internet de um de vocês bloqueia).', 3500, 'microfoneoff');
      this.aoMudar();
    };
    if (chamar) {
      (async () => {
        try {
          await pc.setLocalDescription(await pc.createOffer());
          this.enviar({ t: 'voz-sinal', para: id, d: { sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } } });
        } catch (e) { console.warn('voz: oferta', e); }
      })();
    }
    return par;
  }

  async sinal(de, d) {
    let par = this.pares.get(de);
    try {
      if (d.sdp) {
        if (d.sdp.type === 'offer') {
          if (par) this.fechar(de); // recomeça do zero se o amigo chamou de novo
          par = this.conectar(de, false);
          this.naVoz.add(de);
          await par.pc.setRemoteDescription(d.sdp);
          await par.pc.setLocalDescription(await par.pc.createAnswer());
          this.enviar({ t: 'voz-sinal', para: de, d: { sdp: { type: par.pc.localDescription.type, sdp: par.pc.localDescription.sdp } } });
        } else if (par && par.pc.signalingState === 'have-local-offer') {
          await par.pc.setRemoteDescription(d.sdp);
        }
        if (par) { for (const c of par.filaIce) await par.pc.addIceCandidate(c).catch(() => {}); par.filaIce = []; }
      } else if (d.ice && par) {
        if (par.pc.remoteDescription) await par.pc.addIceCandidate(d.ice).catch(() => {});
        else par.filaIce.push(d.ice);
      }
    } catch (e) { console.warn('voz: sinal', e); }
  }

  fechar(id) {
    const p = this.pares.get(id);
    if (!p) return;
    this.pares.delete(id);
    try { p.pc.close(); } catch {}
    if (p.audio) { p.audio.srcObject = null; p.audio.remove(); }
  }

  // para os testes: quanto áudio chegou de cada um
  async estatisticas() {
    const r = {};
    for (const [id, p] of this.pares) {
      let bytes = 0, nivel = 0;
      const st = await p.pc.getStats();
      st.forEach((s) => { if (s.type === 'inbound-rtp' && s.kind === 'audio') { bytes += s.bytesReceived || 0; nivel = Math.max(nivel, s.audioLevel || 0); } });
      r[id] = { estado: p.pc.connectionState, bytes, nivel };
    }
    return r;
  }
}

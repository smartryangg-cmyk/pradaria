// Sons sintetizados na hora (sem arquivos de áudio): leve e original.
export class Som {
  constructor() { this.ctx = null; this.ligado = true; }

  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = 0.35;
    this.mestre.connect(this.ctx.destination);
  }

  tom(freq, dur, { tipo = 'sine', vol = 0.5, ate = null, atraso = 0, vibrato = 0 } = {}) {
    if (!this.ctx || !this.ligado) return;
    const t = this.ctx.currentTime + atraso;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (ate) o.frequency.exponentialRampToValueAtTime(ate, t + dur);
    if (vibrato) {
      const l = this.ctx.createOscillator(), lg = this.ctx.createGain();
      l.frequency.value = vibrato; lg.gain.value = freq * 0.06;
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.mestre);
    o.start(t); o.stop(t + dur + 0.02);
  }

  ruido(dur, { vol = 0.3, freq = 800, atraso = 0 } = {}) {
    if (!this.ctx || !this.ligado) return;
    const t = this.ctx.currentTime + atraso;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.mestre);
    s.start(t);
  }

  colocar() { this.tom(520, 0.08, { tipo: 'triangle', vol: 0.4, ate: 780 }); }
  quebrar() { this.ruido(0.14, { vol: 0.5, freq: 1200 }); this.tom(220, 0.1, { tipo: 'triangle', vol: 0.2, ate: 140 }); }
  passo() { this.ruido(0.05, { vol: 0.12, freq: 500 }); }
  clique() { this.tom(880, 0.05, { tipo: 'sine', vol: 0.25 }); }
  oi() { this.tom(660, 0.12, { tipo: 'sine', vol: 0.3 }); this.tom(990, 0.18, { tipo: 'sine', vol: 0.3, atraso: 0.1 }); }

  buzina() { this.tom(392, 0.35, { tipo: 'square', vol: 0.12 }); this.tom(494, 0.35, { tipo: 'square', vol: 0.1 }); }
  porta() { this.ruido(0.08, { vol: 0.35, freq: 600 }); this.tom(160, 0.08, { tipo: 'triangle', vol: 0.2 }); }
  batida() { this.ruido(0.18, { vol: 0.45, freq: 400 }); }

  // ronco do motor contínuo (vel 0..1); null desliga
  motor(v) {
    if (!this.ctx) return;
    if (v === null || !this.ligado) { if (this.mo) { this.mg.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); } return; }
    if (!this.mo) {
      this.mo = this.ctx.createOscillator(); this.mo.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      this.mg = this.ctx.createGain(); this.mg.gain.value = 0;
      this.mo.connect(f); f.connect(this.mg); this.mg.connect(this.mestre); this.mo.start();
    }
    this.mo.frequency.setTargetAtTime(48 + v * 120, this.ctx.currentTime, 0.1);
    this.mg.gain.setTargetAtTime(0.07 + v * 0.06, this.ctx.currentTime, 0.1);
  }

  bicho(tipo) {
    switch (tipo) {
      case 'bee': this.tom(330, 0.5, { tipo: 'sawtooth', vol: 0.18, vibrato: 18, ate: 300 }); break;
      case 'muu': this.tom(170, 0.9, { tipo: 'sawtooth', vol: 0.18, ate: 115 }); break;
      case 'oinc': this.tom(500, 0.12, { tipo: 'square', vol: 0.12, ate: 380 }); this.tom(560, 0.12, { tipo: 'square', vol: 0.12, ate: 400, atraso: 0.16 }); break;
      case 'cocó': for (let i = 0; i < 3; i++) this.tom(900 + i * 80, 0.07, { tipo: 'triangle', vol: 0.2, ate: 700, atraso: i * 0.1 }); break;
      case 'auau': this.tom(420, 0.1, { tipo: 'square', vol: 0.15, ate: 260 }); this.tom(440, 0.12, { tipo: 'square', vol: 0.15, ate: 260, atraso: 0.2 }); break;
      case 'hmm': this.tom(140, 0.6, { tipo: 'triangle', vol: 0.35, vibrato: 6 }); break;
      case 'miau': this.tom(700, 0.35, { tipo: 'triangle', vol: 0.25, ate: 500, vibrato: 5 }); break;
      case 'pi': this.tom(1400, 0.08, { tipo: 'sine', vol: 0.25, ate: 1800 }); break;
      default: this.oi();
    }
  }
}

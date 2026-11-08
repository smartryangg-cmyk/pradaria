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
  // toque que arranca um pedaço: som mais grave na pedra, mais abafado na terra
  bater(b) {
    const duro = b === 3 || b === 10 || b === 20, madeira = b === 6 || b === 8;
    this.ruido(0.07, { vol: 0.35, freq: duro ? 2200 : madeira ? 1000 : 600 });
    this.tom(duro ? 300 : madeira ? 200 : 140, 0.06, { tipo: 'triangle', vol: 0.18, ate: duro ? 220 : 110 });
  }
  passo() { this.ruido(0.05, { vol: 0.12, freq: 500 }); }
  clique() { this.tom(880, 0.05, { tipo: 'sine', vol: 0.25 }); }
  // sino: a nota depende da altura do bloco (escala pentatônica: sempre soa bonito)
  sino(altura = 0) {
    const escala = [0, 2, 4, 7, 9];
    const n = ((altura % 10) + 10) % 10;
    const f = 523.25 * Math.pow(2, (escala[n % 5] + 12 * Math.floor(n / 5)) / 12);
    this.tom(f, 1.2, { tipo: 'sine', vol: 0.4 });
    this.tom(f * 2.01, 0.6, { tipo: 'sine', vol: 0.12 });
    this.tom(f * 3.2, 0.25, { tipo: 'triangle', vol: 0.05 });
  }
  confete() { this.ruido(0.18, { vol: 0.35, freq: 2500 }); for (let i = 0; i < 4; i++) this.tom(1200 + i * 260, 0.08, { tipo: 'triangle', vol: 0.12, atraso: 0.05 + i * 0.05 }); }
  alavanca() { this.tom(300, 0.05, { tipo: 'square', vol: 0.15, ate: 200 }); this.ruido(0.04, { vol: 0.2, freq: 3000 }); }
  boing() { this.tom(180, 0.3, { tipo: 'sine', vol: 0.35, ate: 520 }); }
  oi() { this.tom(660, 0.12, { tipo: 'sine', vol: 0.3 }); this.tom(990, 0.18, { tipo: 'sine', vol: 0.3, atraso: 0.1 }); }

  bicho(tipo) {
    switch (tipo) {
      case 'bee': this.tom(330, 0.5, { tipo: 'sawtooth', vol: 0.18, vibrato: 18, ate: 300 }); break;
      case 'muu': this.tom(170, 0.9, { tipo: 'sawtooth', vol: 0.18, ate: 115 }); break;
      case 'oinc': this.tom(500, 0.12, { tipo: 'square', vol: 0.12, ate: 380 }); this.tom(560, 0.12, { tipo: 'square', vol: 0.12, ate: 400, atraso: 0.16 }); break;
      case 'cocó': for (let i = 0; i < 3; i++) this.tom(900 + i * 80, 0.07, { tipo: 'triangle', vol: 0.2, ate: 700, atraso: i * 0.1 }); break;
      case 'auau': this.tom(420, 0.1, { tipo: 'square', vol: 0.15, ate: 260 }); this.tom(440, 0.12, { tipo: 'square', vol: 0.15, ate: 260, atraso: 0.2 }); break;
      case 'hmm': this.tom(140, 0.6, { tipo: 'triangle', vol: 0.35, vibrato: 6 }); break;
      case 'pi': this.tom(1400, 0.08, { tipo: 'sine', vol: 0.25, ate: 1800 }); break;
      default: this.oi();
    }
  }
}

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
  // pegou um item do chão ("plop" subindo) / largou um (descendo)
  pegar() { this.tom(700, 0.07, { tipo: 'sine', vol: 0.28, ate: 1250 }); }
  largar() { this.tom(520, 0.09, { tipo: 'triangle', vol: 0.22, ate: 300 }); }
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

  // buzinas de cada veículo (vol 0..1 diminui com a distância)
  buzina(tipo, vol = 1) {
    const v = Math.max(0.02, vol);
    switch (tipo) {
      case 'caminhao': this.tom(220, 0.6, { tipo: 'sawtooth', vol: 0.12 * v }); this.tom(277, 0.6, { tipo: 'sawtooth', vol: 0.1 * v }); break;
      case 'campainha': this.tom(1800, 0.12, { tipo: 'triangle', vol: 0.25 * v }); this.tom(1800, 0.2, { tipo: 'triangle', vol: 0.25 * v, atraso: 0.16 }); break;
      case 'barco': this.tom(140, 1.1, { tipo: 'sawtooth', vol: 0.14 * v }); this.tom(210, 1.1, { tipo: 'triangle', vol: 0.1 * v }); break;
      case 'apito': this.tom(900, 0.25, { tipo: 'sine', vol: 0.3 * v, ate: 1500 }); this.tom(1500, 0.2, { tipo: 'sine', vol: 0.25 * v, ate: 1100, atraso: 0.26 }); break;
      default: this.tom(392, 0.35, { tipo: 'square', vol: 0.12 * v }); this.tom(494, 0.35, { tipo: 'square', vol: 0.1 * v });
    }
  }
  porta() { this.ruido(0.08, { vol: 0.35, freq: 600 }); this.tom(160, 0.08, { tipo: 'triangle', vol: 0.2 }); }

  // ronco do motor contínuo (v 0..1, grave muda o tom); null desliga
  motor(v, grave = 1, tipo = 'motor') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (v === null || !this.ligado || tipo === 'pedal') { if (this.mo) this.mg.gain.setTargetAtTime(0, t, 0.1); return; }
    if (!this.mo) {
      this.mo = this.ctx.createOscillator(); this.mo.type = 'sawtooth';
      this.mf = this.ctx.createBiquadFilter(); this.mf.type = 'lowpass'; this.mf.frequency.value = 420;
      this.mg = this.ctx.createGain(); this.mg.gain.value = 0;
      this.mo.connect(this.mf); this.mf.connect(this.mg); this.mg.connect(this.mestre); this.mo.start();
    }
    if (tipo === 'skate') { this.mo.frequency.setTargetAtTime(30 + v * 20, t, 0.1); this.mf.frequency.value = 200; this.mg.gain.setTargetAtTime(v > 0.05 ? 0.05 : 0, t, 0.1); return; }
    if (tipo === 'helice') { this.mo.frequency.setTargetAtTime(22 + v * 6, t, 0.1); this.mf.frequency.value = 300; this.mg.gain.setTargetAtTime(0.14, t, 0.1); return; }
    this.mf.frequency.value = 420;
    this.mo.frequency.setTargetAtTime((48 + v * 120) * grave, t, 0.1);
    this.mg.gain.setTargetAtTime(0.06 + v * 0.06, t, 0.1);
  }

  // bravo = rosnado/aviso (o bicho está mandando você se afastar)
  bicho(tipo, bravo = false) {
    if (bravo) {
      switch (tipo) {
        case 'cobra': this.ruido(0.9, { vol: 0.25, freq: 5000 }); this.ruido(0.5, { vol: 0.15, freq: 7000, atraso: 0.3 }); return; // chocalho/sibilo
        case 'cocó': for (let i = 0; i < 5; i++) this.tom(1100, 0.05, { tipo: 'square', vol: 0.12, ate: 900, atraso: i * 0.07 }); return;
        case 'muu': this.tom(150, 0.6, { tipo: 'sawtooth', vol: 0.22, ate: 90 }); this.ruido(0.3, { vol: 0.15, freq: 300 }); return;
        default: this.tom(110, 0.7, { tipo: 'sawtooth', vol: 0.2, vibrato: 28, ate: 90 }); this.ruido(0.5, { vol: 0.12, freq: 400 }); return; // rosnado
      }
    }
    switch (tipo) {
      case 'veado': this.tom(700, 0.15, { tipo: 'triangle', vol: 0.2, ate: 450 }); break;
      case 'lobo': this.tom(380, 0.25, { tipo: 'triangle', vol: 0.18, ate: 300 }); break;
      case 'uivo': this.tom(330, 2.2, { tipo: 'sine', vol: 0.12, ate: 520, vibrato: 5 }); this.tom(520, 1.4, { tipo: 'sine', vol: 0.08, ate: 380, atraso: 1.6 }); break;
      case 'raposa': this.tom(900, 0.1, { tipo: 'square', vol: 0.1, ate: 1300 }); this.tom(950, 0.1, { tipo: 'square', vol: 0.1, ate: 1300, atraso: 0.18 }); break;
      case 'urso': this.tom(95, 0.5, { tipo: 'sawtooth', vol: 0.2, ate: 70 }); break;
      case 'onca': for (let i = 0; i < 4; i++) this.tom(120, 0.14, { tipo: 'sawtooth', vol: 0.16, ate: 80, atraso: i * 0.22 }); break; // esturro
      case 'cobra': this.ruido(0.4, { vol: 0.15, freq: 6000 }); break;
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

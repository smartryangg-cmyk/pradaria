// Sons do jogo, todos sintetizados na hora com WebAudio (nenhum arquivo de áudio: zero download,
// 100% original, nada copiado de outro jogo). Estilo "desenho animado": sons curtos, redondos e alegres.
//
// Organização:
//   mestre (liga/desliga) -> compressor (nada estoura) -> filtro (abafado embaixo d'água) -> saída
//   efeitos (volume "Efeitos")  -> mestre      música (volume "Música") -> mestre
//   eco (cavernas) -> mestre     ambiente (vento, água, passarinhos) -> efeitos
// Som 3D: som.em({x,y,z}, () => som.passo('pedra')) toca na posição do mundo (volume pela distância,
// esquerda/direita pela direção, mais abafado longe ou atrás). O ouvinte vem de som.ouvinte() a cada quadro.
// Tablet fraco: um ruído só gerado uma vez e reaproveitado, limite de sons ao mesmo tempo (menor no Leve),
// e o ambiente/música ficam mais simples no modo Leve.

const CHAVE = 'pradaria.ajustes';
export const VOL_PADRAO = { volMusica: 0.35, volEfeitos: 0.85, volVoz: 1 };

// materiais (o que o pé pisa / o bloco que quebra). nf/nt/nq/nd/nv: ruído; tf/tt/td/tv/ta: tom
const MAT = {
  grama: { nf: 2300, nt: 'bandpass', nq: 0.9, nd: 0.07, nv: 0.55, tf: 120, tt: 'sine', td: 0.05, tv: 0.25, ta: 80 },
  terra: { nf: 850, nt: 'lowpass', nq: 0.8, nd: 0.08, nv: 0.6, tf: 95, tt: 'sine', td: 0.07, tv: 0.35, ta: 60 },
  pedra: { nf: 3200, nt: 'bandpass', nq: 1.6, nd: 0.045, nv: 0.5, tf: 430, tt: 'triangle', td: 0.05, tv: 0.24, ta: 300 },
  madeira: { nf: 1400, nt: 'bandpass', nq: 2.5, nd: 0.05, nv: 0.4, tf: 245, tt: 'triangle', td: 0.09, tv: 0.38, ta: 190 },
  areia: { nf: 3800, nt: 'bandpass', nq: 0.5, nd: 0.11, nv: 0.45, tf: 0 },
  neve: { nf: 1700, nt: 'bandpass', nq: 1.2, nd: 0.09, nv: 0.5, tf: 0, crec: true },
  vidro: { nf: 6000, nt: 'highpass', nq: 0.7, nd: 0.03, nv: 0.2, tf: 1900, tt: 'sine', td: 0.12, tv: 0.2, ta: 1880 },
  tecido: { nf: 450, nt: 'lowpass', nq: 0.7, nd: 0.09, nv: 0.5, tf: 0 },
  metal: { nf: 5000, nt: 'bandpass', nq: 3, nd: 0.03, nv: 0.25, tf: 620, tt: 'triangle', td: 0.25, tv: 0.16, ta: 600, sino: 1530 },
  folhas: { nf: 4200, nt: 'highpass', nq: 0.7, nd: 0.1, nv: 0.32, tf: 0 },
  agua: { nf: 1100, nt: 'bandpass', nq: 0.8, nd: 0.12, nv: 0.45, tf: 380, tt: 'sine', td: 0.08, tv: 0.12, ta: 700 },
};

// escalas da música (semitons a partir da tônica): pentatônica, sempre soa bonito junto
const PENTA = [0, 2, 4, 7, 9];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function lerAjustes() {
  try { return { ...VOL_PADRAO, som: true, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }; } catch { return { ...VOL_PADRAO, som: true }; }
}

export class Som {
  constructor() {
    this.ctx = null;
    const a = lerAjustes();
    this.ligado = a.som !== false;
    this.vol = { musica: num(a.volMusica, VOL_PADRAO.volMusica), efeitos: num(a.volEfeitos, VOL_PADRAO.volEfeitos), voz: num(a.volVoz, VOL_PADRAO.volVoz) };
    this.leve = false;
    this.maxVozes = 22; this.vozes = 0;
    this.ouv = { x: 0, y: 0, z: 0, yaw: 0 };
    this._dest = null; // destino 3D do som que está sendo tocado agora (som.em)
    this.motores = new Map(); // id -> motor contínuo (o meu é 'eu')
    this.materialDe = null; // main.js liga: id do bloco -> nome do material
    this.amb = null; this.mus = null;
  }

  // precisa de um toque/clique do jogador antes (regra dos navegadores)
  iniciar() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC({ latencyHint: 'interactive' }); } catch { try { this.ctx = new AC(); } catch { return; } }
    const c = this.ctx;
    this.mestre = c.createGain(); this.mestre.gain.value = this.ligado ? 0.55 : 0;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 10; this.comp.ratio.value = 4;
    this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    this.filtro = c.createBiquadFilter(); this.filtro.type = 'lowpass'; this.filtro.frequency.value = 20000;
    this.mestre.connect(this.comp); this.comp.connect(this.filtro); this.filtro.connect(c.destination);
    this.busEfeitos = c.createGain(); this.busEfeitos.connect(this.mestre);
    this.busMusica = c.createGain(); this.busMusica.connect(this.mestre);
    // eco das cavernas (desligado até entrar numa)
    this.eco = c.createDelay(1); this.eco.delayTime.value = 0.17;
    this.ecoVolta = c.createGain(); this.ecoVolta.gain.value = 0.32;
    this.ecoSai = c.createGain(); this.ecoSai.gain.value = 0;
    this.busEfeitos.connect(this.eco); this.eco.connect(this.ecoVolta); this.ecoVolta.connect(this.eco);
    this.eco.connect(this.ecoSai); this.ecoSai.connect(this.mestre);
    // ruído branco feito uma vez só (2 s) e reaproveitado por todos os sons de "chhh"
    const n = Math.floor(c.sampleRate * 2);
    this.bufRuido = c.createBuffer(1, n, c.sampleRate);
    const d = this.bufRuido.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // ruído marrom (mais grave e macio): vento e água
    this.bufMarrom = c.createBuffer(1, n, c.sampleRate);
    const m = this.bufMarrom.getChannelData(0);
    let ult = 0;
    for (let i = 0; i < n; i++) { ult = (ult + 0.02 * (Math.random() * 2 - 1)) / 1.02; m[i] = ult * 3.5; }
    this.aplicarVolumes();
    if (this.abafado) this.abafar(true);
  }

  // volumes 0..1 (o que estiver faltando fica como está); leve = aparelho fraco / gráfico Leve
  configurar({ ligado, musica, efeitos, voz, leve } = {}) {
    if (ligado !== undefined) this.ligado = !!ligado;
    if (musica !== undefined) this.vol.musica = num(musica, this.vol.musica);
    if (efeitos !== undefined) this.vol.efeitos = num(efeitos, this.vol.efeitos);
    if (voz !== undefined) this.vol.voz = num(voz, this.vol.voz);
    if (leve !== undefined) { this.leve = !!leve; this.maxVozes = this.leve ? 12 : 22; }
    this.aplicarVolumes();
  }
  aplicarVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.mestre.gain.setTargetAtTime(this.ligado ? 0.55 : 0, t, 0.05);
    this.busEfeitos.gain.setTargetAtTime(this.vol.efeitos, t, 0.05);
    this.busMusica.gain.setTargetAtTime(this.vol.musica * 0.55, t, 0.05);
    if (!this.ligado) { for (const id of [...this.motores.keys()]) this.pararMotor(id); }
  }

  // embaixo d'água tudo soa abafado
  abafar(sim) {
    this.abafado = !!sim;
    if (!this.filtro) return;
    this.filtro.frequency.setTargetAtTime(sim ? 650 : 20000, this.ctx.currentTime, sim ? 0.05 : 0.12);
  }
  // dentro de caverna: eco curto
  caverna(sim) {
    if (!this.ctx) return;
    sim = !!sim && !this.leve;
    if (sim === this._caverna) return;
    this._caverna = sim;
    this.ecoSai.gain.setTargetAtTime(sim ? 0.38 : 0, this.ctx.currentTime, 0.3);
  }

  // ---------- 3D ----------
  // posição e direção de quem escuta (a câmera), uma vez por quadro
  ouvinte(x, y, z, yaw) { const o = this.ouv; o.x = x; o.y = y; o.z = z; o.yaw = yaw; }
  // volume/lado de um ponto do mundo (null = longe demais para ouvir)
  espacial(x, y, z, alcance = 48) {
    const o = this.ouv;
    const dx = x - o.x, dy = y - o.y, dz = z - o.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > alcance) return null;
    let vol = 1 / (1 + (d / 8) * (d / 8));
    if (d > alcance * 0.75) vol *= (alcance - d) / (alcance * 0.25); // some de mansinho na borda
    if (vol < 0.012) return null;
    const h = Math.hypot(dx, dz) || 1;
    const dirX = dx / h, dirZ = dz / h;
    // câmera com yaw olha para (-sin, -cos); a direita é (cos, -sin)
    const lado = dirX * Math.cos(o.yaw) - dirZ * Math.sin(o.yaw);
    const frente = -dirX * Math.sin(o.yaw) - dirZ * Math.cos(o.yaw);
    const perto = Math.min(1, d / 3); // colado no ouvido não dá lado
    let corte = 16000 / (1 + d / 10);
    if (frente < 0) corte *= 0.6;
    return { vol, pan: lado * 0.85 * perto, corte: Math.max(700, corte), d };
  }
  // toca o que fn() pedir como se viesse daquele ponto do mundo
  em(p, fn, alcance) {
    if (!p) { fn(); return; }
    if (!this.ctx || !this.ligado) return;
    const r = this.espacial(p.x, p.y, p.z, alcance);
    if (!r) return;
    const antes = this._dest;
    this._dest = this.no3D(r);
    try { fn(); } finally { this._dest = antes; }
  }
  no3D(r, destino = this.busEfeitos) {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = r.vol;
    let fim = g;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = r.pan; fim.connect(p); fim = p; }
    if (!this.leve && r.corte < 15000) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = r.corte; fim.connect(f); fim = f; }
    fim.connect(destino);
    g._vol = r.vol;
    return g;
  }

  // ---------- peças básicas ----------
  // limite de sons ao mesmo tempo (o tablet fraco agradece); som fraquinho demais nem toca
  podeTocar(vol) {
    if (!this.ctx || !this.ligado || this.ctx.state !== 'running') return false;
    if (this.vozes >= this.maxVozes) return false;
    if (this._dest && vol * this._dest._vol < 0.004) return false;
    return true;
  }
  conta(no) { this.vozes++; no.onended = () => { this.vozes--; }; }

  // tom: oscilador com envelope. filtro: { tipo, f, q, ate } dá a "boca" (formante) dos bichos
  tom(freq, dur, { tipo = 'sine', vol = 0.5, ate = null, atraso = 0, vibrato = 0, vibAmp = 0.06, ataque = 0.012, filtro = null, destino = null } = {}) {
    if (!this.podeTocar(vol)) return;
    const c = this.ctx, t = c.currentTime + atraso;
    const o = c.createOscillator(), g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (ate) o.frequency.exponentialRampToValueAtTime(Math.max(20, ate), t + dur);
    if (vibrato) {
      const l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = vibrato; lg.gain.value = freq * vibAmp;
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    const at = Math.min(ataque, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + at);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let no = o;
    if (filtro) {
      const f = c.createBiquadFilter(); f.type = filtro.tipo || 'lowpass'; f.Q.value = filtro.q ?? 1;
      f.frequency.setValueAtTime(filtro.f, t);
      if (filtro.ate) f.frequency.exponentialRampToValueAtTime(filtro.ate, t + dur);
      no.connect(f); no = f;
    }
    no.connect(g); g.connect(destino || this._dest || this.busEfeitos);
    this.conta(o);
    o.start(t); o.stop(t + dur + 0.03);
  }

  // ruído ("chhh") filtrado. tipo: lowpass | bandpass | highpass
  ruido(dur, { vol = 0.3, freq = 800, atraso = 0, tipo = 'lowpass', q = 0.7, ate = null, marrom = false, ataque = 0.004, destino = null } = {}) {
    if (!this.podeTocar(vol)) return;
    const c = this.ctx, t = c.currentTime + atraso;
    const s = c.createBufferSource(); s.buffer = marrom ? this.bufMarrom : this.bufRuido;
    const f = c.createBiquadFilter(); f.type = tipo; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (ate) f.frequency.exponentialRampToValueAtTime(ate, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(destino || this._dest || this.busEfeitos);
    this.conta(s);
    s.start(t, Math.random() * Math.max(0, 1.9 - dur), dur + 0.05);
  }

  // ---------- blocos e passos ----------
  mat(m) {
    if (typeof m === 'string') return MAT[m] ? m : 'terra';
    if (typeof m === 'number' && this.materialDe) return this.materialDe(m) || 'terra';
    return 'terra';
  }
  // pancada com a "cor" do material. forca: 0.35 passo, 0.7 bater, 0.85 colocar, 1 quebrar
  impacto(m, forca, { grave = 1 } = {}) {
    const p = MAT[m] || MAT.terra;
    const r = 0.9 + Math.random() * 0.2; // cada pancada um pouquinho diferente
    this.ruido(p.nd * (0.7 + forca * 0.5), { vol: p.nv * forca, freq: p.nf * r, tipo: p.nt, q: p.nq });
    if (p.crec) this.ruido(p.nd * 0.6, { vol: p.nv * forca * 0.7, freq: p.nf * 1.3 * r, tipo: p.nt, q: p.nq, atraso: 0.035 });
    if (p.tf) this.tom(p.tf * r * grave, p.td, { tipo: p.tt, vol: p.tv * forca, ate: p.ta * r * grave });
    if (p.sino) this.tom(p.sino * r, p.td * 1.3, { tipo: 'sine', vol: p.tv * forca * 0.5 });
  }
  passo(m, forca = 0.35) { this.impacto(this.mat(m), forca); }
  // pulou de cima e caiu: baque (mais forte se machucou)
  queda(m, machucou) {
    this.tom(machucou ? 140 : 110, 0.16, { tipo: 'sine', vol: machucou ? 0.45 : 0.25, ate: 55 });
    this.impacto(this.mat(m), 0.7);
  }
  colocar(m) {
    const k = this.mat(m);
    this.impacto(k, 0.8, { grave: 0.8 });
    this.tom(330, 0.07, { tipo: 'sine', vol: 0.12, ate: 520 }); // "pop" de encaixe
  }
  bater(m) { this.impacto(this.mat(m), 0.7, { grave: 1.15 }); }
  quebrar(m) {
    const k = this.mat(m), p = MAT[k];
    this.impacto(k, 1, { grave: 0.85 });
    // pedacinhos caindo
    const n = this.leve ? 1 : 3;
    for (let i = 0; i < n; i++) this.ruido(p.nd * 0.7, { vol: p.nv * 0.35, freq: p.nf * (0.7 + Math.random() * 0.6), tipo: p.nt, q: p.nq, atraso: 0.06 + i * 0.05 + Math.random() * 0.03 });
    if (k === 'vidro') for (let i = 0; i < (this.leve ? 2 : 5); i++) this.tom(2200 + Math.random() * 2600, 0.09, { tipo: 'sine', vol: 0.09, atraso: 0.02 + i * 0.035 });
    else if (k === 'madeira') this.ruido(0.05, { vol: 0.3, freq: 2600, tipo: 'highpass' }); // estalo
    else if (k === 'folhas') this.ruido(0.22, { vol: 0.25, freq: 3500, tipo: 'highpass', atraso: 0.03 });
    else if (k === 'metal') this.tom(880, 0.4, { tipo: 'sine', vol: 0.1, atraso: 0.02 });
    else if (k === 'agua') this.bolha();
  }

  // tchibum ao cair na água (forca 0..1)
  splash(forca = 0.5) {
    this.ruido(0.25 + forca * 0.35, { vol: 0.3 + forca * 0.35, freq: 1400 + forca * 1400, tipo: 'bandpass', q: 0.6, ate: 500 });
    this.tom(320, 0.18, { tipo: 'sine', vol: 0.12 + forca * 0.12, ate: 110 });
    for (let i = 0; i < (this.leve ? 1 : 3); i++) this.bolha(0.08 + i * 0.07 + Math.random() * 0.05);
  }
  // blub das bolhas de ar
  bolha(atraso = 0) { const f = 380 + Math.random() * 260; this.tom(f, 0.08, { tipo: 'sine', vol: 0.12, ate: f * 2.1, atraso }); }

  // ---------- interface ----------
  clique() { this.tom(620, 0.06, { tipo: 'sine', vol: 0.22, ate: 900, destino: this.busEfeitos }); }
  // abrir/fechar janela (mochila, mapa, opções): "fwip" subindo/descendo
  abrir() { this.ruido(0.12, { vol: 0.12, freq: 900, tipo: 'bandpass', q: 1.5, ate: 2600, destino: this.busEfeitos }); this.tom(440, 0.1, { tipo: 'sine', vol: 0.12, ate: 700, atraso: 0.02, destino: this.busEfeitos }); }
  fechar() { this.ruido(0.1, { vol: 0.1, freq: 2400, tipo: 'bandpass', q: 1.5, ate: 800, destino: this.busEfeitos }); this.tom(600, 0.08, { tipo: 'sine', vol: 0.1, ate: 400, destino: this.busEfeitos }); }
  // pegou um item do chão ("plop" subindo) / largou um (descendo)
  pegar() { this.tom(700, 0.07, { tipo: 'sine', vol: 0.26, ate: 1250 }); this.tom(1400, 0.06, { tipo: 'sine', vol: 0.08, ate: 1900, atraso: 0.05 }); }
  largar() { this.tom(520, 0.09, { tipo: 'triangle', vol: 0.22, ate: 300 }); }
  // criou algo na bancada: martelinho + brilho
  criar() { this.impacto('madeira', 0.8); this.impacto('madeira', 0.6); for (let i = 0; i < 3; i++) this.tom(988 * Math.pow(2, PENTA[i + 1] / 12), 0.12, { tipo: 'sine', vol: 0.12, atraso: 0.12 + i * 0.06, destino: this.busEfeitos }); }
  // convite de um amigo: "dim-dom" de campainha
  convite() {
    const d = this.busEfeitos;
    this.tom(784, 0.5, { tipo: 'sine', vol: 0.3, destino: d }); this.tom(784 * 3, 0.25, { tipo: 'sine', vol: 0.05, destino: d });
    this.tom(659, 0.7, { tipo: 'sine', vol: 0.3, atraso: 0.28, destino: d }); this.tom(659 * 3, 0.3, { tipo: 'sine', vol: 0.05, atraso: 0.28, destino: d });
  }
  // notificação suave (pedido de amizade, mensagem)
  aviso() { this.tom(880, 0.14, { tipo: 'sine', vol: 0.15, destino: this.busEfeitos }); this.tom(1320, 0.2, { tipo: 'sine', vol: 0.12, atraso: 0.09, destino: this.busEfeitos }); }
  // tabuleiro (xadrez, dama): peça de madeira na casa; comer faz "toc-toc"
  peca(comeu = false) {
    const d = this.busEfeitos;
    this.ruido(0.04, { vol: 0.35, freq: 1500 + Math.random() * 300, tipo: 'bandpass', q: 3, destino: d });
    this.tom(300 + Math.random() * 40, 0.08, { tipo: 'triangle', vol: 0.3, ate: 220, destino: d });
    if (comeu) { this.ruido(0.04, { vol: 0.3, freq: 1900, tipo: 'bandpass', q: 3, atraso: 0.09, destino: d }); this.tom(420, 0.07, { tipo: 'triangle', vol: 0.25, ate: 300, atraso: 0.09, destino: d }); }
  }
  xeque() { this.tom(988, 0.12, { tipo: 'triangle', vol: 0.18, destino: this.busEfeitos }); this.tom(988, 0.16, { tipo: 'triangle', vol: 0.18, atraso: 0.15, destino: this.busEfeitos }); }
  // fim de partida: ganhou (arpejo subindo), perdeu (descendo, sem drama), empate (neutro)
  fim(resultado) {
    const d = this.busEfeitos;
    const notas = resultado === 'ganhou' ? [60, 64, 67, 72, 76] : resultado === 'perdeu' ? [67, 64, 60, 55] : [64, 67, 64];
    notas.forEach((n, i) => { this.tom(midi(n), 0.28, { tipo: 'triangle', vol: 0.22, atraso: i * 0.11, destino: d }); this.tom(midi(n + 12), 0.18, { tipo: 'sine', vol: 0.06, atraso: i * 0.11, destino: d }); });
  }

  // sino: a nota depende da altura do bloco (escala pentatônica: sempre soa bonito)
  sino(altura = 0) {
    const n = ((altura % 10) + 10) % 10;
    const f = 523.25 * Math.pow(2, (PENTA[n % 5] + 12 * Math.floor(n / 5)) / 12);
    this.tom(f, 1.2, { tipo: 'sine', vol: 0.4 });
    this.tom(f * 2.01, 0.6, { tipo: 'sine', vol: 0.12 });
    this.tom(f * 3.2, 0.25, { tipo: 'triangle', vol: 0.05 });
  }
  confete() { this.ruido(0.18, { vol: 0.35, freq: 2500 }); for (let i = 0; i < 4; i++) this.tom(1200 + i * 260, 0.08, { tipo: 'triangle', vol: 0.12, atraso: 0.05 + i * 0.05 }); }
  alavanca() { this.tom(300, 0.05, { tipo: 'square', vol: 0.12, ate: 200, filtro: { tipo: 'lowpass', f: 1800 } }); this.ruido(0.04, { vol: 0.2, freq: 3000, tipo: 'bandpass', q: 2 }); }
  boing() { this.tom(180, 0.3, { tipo: 'sine', vol: 0.35, ate: 520, vibrato: 14, vibAmp: 0.04 }); }
  oi() { this.tom(660, 0.12, { tipo: 'sine', vol: 0.28 }); this.tom(990, 0.18, { tipo: 'sine', vol: 0.28, atraso: 0.1 }); }

  // buzinas de cada veículo (vol 0..1 diminui com a distância)
  buzina(tipo, vol = 1) {
    const v = Math.max(0.02, vol);
    const lp = { tipo: 'lowpass', f: 2400, q: 1 };
    switch (tipo) {
      case 'caminhao': this.tom(220, 0.6, { tipo: 'sawtooth', vol: 0.14 * v, filtro: lp }); this.tom(277, 0.6, { tipo: 'sawtooth', vol: 0.12 * v, filtro: lp }); break;
      case 'campainha': this.tom(1800, 0.25, { tipo: 'sine', vol: 0.22 * v }); this.tom(1800 * 2.7, 0.12, { tipo: 'sine', vol: 0.05 * v }); this.tom(1800, 0.3, { tipo: 'sine', vol: 0.22 * v, atraso: 0.16 }); break;
      case 'barco': this.tom(140, 1.1, { tipo: 'sawtooth', vol: 0.16 * v, filtro: { tipo: 'lowpass', f: 900, q: 2 }, ataque: 0.08 }); this.tom(210, 1.1, { tipo: 'triangle', vol: 0.1 * v, ataque: 0.08 }); break;
      case 'apito': this.tom(900, 0.25, { tipo: 'sine', vol: 0.3 * v, ate: 1500 }); this.tom(1500, 0.2, { tipo: 'sine', vol: 0.25 * v, ate: 1100, atraso: 0.26 }); break;
      default: this.tom(392, 0.35, { tipo: 'square', vol: 0.12 * v, filtro: lp }); this.tom(494, 0.35, { tipo: 'square', vol: 0.1 * v, filtro: lp });
    }
  }
  porta() { this.impacto('madeira', 0.7); this.tom(160, 0.1, { tipo: 'triangle', vol: 0.2, ate: 120 }); }

  // ---------- motores (contínuos) ----------
  // o meu veículo: v 0..1 (velocidade), grave muda o tom; null desliga
  motor(v, grave = 1, tipo = 'motor') { this.motorEm('eu', v, grave, tipo, null); }
  // motor de qualquer veículo, num ponto do mundo (pos null = colado em mim)
  motorEm(id, v, grave = 1, tipo = 'motor', pos = null) {
    if (!this.ctx) return;
    if (v === null || v === undefined || !this.ligado) { this.pararMotor(id); return; }
    let m = this.motores.get(id);
    if (m && m.tipo !== tipo) { this.pararMotor(id); m = null; }
    let r = null;
    if (pos) { r = this.espacial(pos.x, pos.y, pos.z, 45); if (!r) { this.pararMotor(id); return; } }
    if (!m) { m = this.criarMotor(tipo); if (!m) return; this.motores.set(id, m); }
    m.visto = true;
    const c = this.ctx, t = c.currentTime;
    if (m.pan) { m.pan.pan.setTargetAtTime(r ? r.pan : 0, t, 0.08); }
    const dist = r ? r.vol : 1;
    v = Math.max(0, Math.min(1, v));
    if (tipo === 'motor') {
      // marchas: o giro sobe dentro de cada marcha e cai um pouco ao trocar (soa de verdade)
      let rpm;
      if (v < 0.03) rpm = 0.12;
      else { const x = Math.min(0.999, v) * 4, marcha = Math.floor(x); rpm = (marcha === 0 ? 0.15 : 0.4) + (x - marcha) * (marcha === 0 ? 0.75 : 0.5); }
      const f = (34 + rpm * 100) * grave;
      m.o1.frequency.setTargetAtTime(f, t, 0.08);
      m.o2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
      m.lfo.frequency.setTargetAtTime(f * 0.25, t, 0.08);
      m.lfoG.gain.setTargetAtTime((0.5 - rpm * 0.35) * (0.08 + v * 0.06) * dist, t, 0.1); // "tuc-tuc" mais forte parado
      m.f.frequency.setTargetAtTime(260 + rpm * 1300 + v * 300, t, 0.1);
      m.g.gain.setTargetAtTime((0.08 + v * 0.07) * dist, t, 0.1);
    } else if (tipo === 'helice') {
      m.lfo.frequency.setTargetAtTime(7 + v * 9, t, 0.15);
      m.o1.frequency.setTargetAtTime((50 + v * 25) * grave, t, 0.15);
      m.g.gain.setTargetAtTime(0.13 * dist, t, 0.1);
      m.lfoG.gain.setTargetAtTime(0.1 * dist, t, 0.1);
    } else if (tipo === 'skate' || tipo === 'pedal') {
      m.f.frequency.setTargetAtTime(tipo === 'skate' ? 280 + v * 500 : 200 + v * 400, t, 0.1);
      m.g.gain.setTargetAtTime(v > 0.04 ? (tipo === 'skate' ? 0.22 : 0.09) * Math.min(1, v * 2) * dist : 0, t, 0.1);
    }
  }
  criarMotor(tipo) {
    const c = this.ctx;
    const m = { tipo, fontes: [] };
    m.g = c.createGain(); m.g.gain.value = 0;
    let saida = m.g;
    if (c.createStereoPanner) { m.pan = c.createStereoPanner(); m.g.connect(m.pan); saida = m.pan; }
    saida.connect(this.busEfeitos);
    if (tipo === 'motor') {
      m.o1 = c.createOscillator(); m.o1.type = 'sawtooth';
      m.o2 = c.createOscillator(); m.o2.type = 'square';
      const g2 = c.createGain(); g2.gain.value = 0.45;
      m.f = c.createBiquadFilter(); m.f.type = 'lowpass'; m.f.Q.value = 2.5; m.f.frequency.value = 400;
      m.o1.connect(m.f); m.o2.connect(g2); g2.connect(m.f); m.f.connect(m.g);
      // pulsação dos pistões (modula o volume)
      m.lfo = c.createOscillator(); m.lfo.frequency.value = 10;
      m.lfoG = c.createGain(); m.lfoG.gain.value = 0;
      m.lfo.connect(m.lfoG); m.lfoG.connect(m.g.gain);
      m.fontes.push(m.o1, m.o2, m.lfo);
    } else if (tipo === 'helice') {
      const s = c.createBufferSource(); s.buffer = this.bufMarrom; s.loop = true;
      m.f = c.createBiquadFilter(); m.f.type = 'lowpass'; m.f.frequency.value = 700;
      s.connect(m.f); m.f.connect(m.g);
      m.o1 = c.createOscillator(); m.o1.type = 'triangle';
      const og = c.createGain(); og.gain.value = 0.25; m.o1.connect(og); og.connect(m.g);
      m.lfo = c.createOscillator(); m.lfo.type = 'square'; m.lfo.frequency.value = 9;
      m.lfoG = c.createGain(); m.lfoG.gain.value = 0;
      m.lfo.connect(m.lfoG); m.lfoG.connect(m.g.gain);
      m.fontes.push(s, m.o1, m.lfo);
    } else if (tipo === 'skate' || tipo === 'pedal') {
      const s = c.createBufferSource(); s.buffer = tipo === 'skate' ? this.bufRuido : this.bufMarrom; s.loop = true;
      m.f = c.createBiquadFilter(); m.f.type = tipo === 'skate' ? 'bandpass' : 'lowpass'; m.f.Q.value = 0.8; m.f.frequency.value = 300;
      s.connect(m.f); m.f.connect(m.g);
      m.fontes.push(s);
    } else return null;
    for (const f of m.fontes) f.start();
    return m;
  }
  pararMotor(id) {
    const m = this.motores.get(id);
    if (!m) return;
    this.motores.delete(id);
    const t = this.ctx.currentTime;
    m.g.gain.cancelScheduledValues(t);
    m.g.gain.setTargetAtTime(0, t, 0.08);
    if (m.lfoG) m.lfoG.gain.setTargetAtTime(0, t, 0.08);
    for (const f of m.fontes) { try { f.stop(t + 0.5); } catch {} }
  }
  // motores dos outros que não foram atualizados neste quadro: param (o meu fica com quem cuida dele)
  motoresQuadro() {
    for (const [id, m] of [...this.motores]) { if (id === 'eu') continue; if (!m.visto) this.pararMotor(id); else m.visto = false; }
  }

  // ---------- bichos ----------
  // vozes de bicho feitas com "boca" (filtro que abre e fecha). bravo = rosnado/aviso (mandando se afastar)
  // pos: onde o bicho está (som 3D); sem pos toca "colado"
  bicho(tipo, bravo = false, pos = null) {
    if (pos) { this.em(pos, () => this.bicho(tipo, bravo)); return; }
    if (bravo) {
      switch (tipo) {
        case 'cobra': this.ruido(0.9, { vol: 0.28, freq: 5000, tipo: 'highpass' }); this.ruido(0.5, { vol: 0.16, freq: 7000, tipo: 'highpass', atraso: 0.3 }); return; // sibilo
        case 'cocó': for (let i = 0; i < 5; i++) this.tom(1100, 0.06, { tipo: 'sawtooth', vol: 0.12, ate: 900, atraso: i * 0.07, filtro: { tipo: 'bandpass', f: 1800, q: 3 } }); return;
        case 'muu': this.tom(140, 0.7, { tipo: 'sawtooth', vol: 0.3, ate: 95, filtro: { tipo: 'lowpass', f: 300, q: 5, ate: 700 }, ataque: 0.05 }); this.ruido(0.3, { vol: 0.15, freq: 300 }); return;
        case 'oinc': this.tom(700, 0.18, { tipo: 'sawtooth', vol: 0.22, ate: 950, filtro: { tipo: 'bandpass', f: 1600, q: 4 } }); return; // guincho
        case 'auau': for (let i = 0; i < 3; i++) this.tom(430, 0.1, { tipo: 'sawtooth', vol: 0.28, ate: 230, atraso: i * 0.16, filtro: { tipo: 'bandpass', f: 1000, q: 2.5 } }); return;
        default: // rosnado
          this.tom(105, 0.8, { tipo: 'sawtooth', vol: 0.3, vibrato: 26, vibAmp: 0.12, ate: 85, filtro: { tipo: 'lowpass', f: 380, q: 6, ate: 600 }, ataque: 0.08 });
          this.ruido(0.6, { vol: 0.14, freq: 420, marrom: true }); return;
      }
    }
    switch (tipo) {
      case 'muu': this.tom(118, 1.05, { tipo: 'sawtooth', vol: 0.3, ate: 100, vibrato: 5, vibAmp: 0.02, filtro: { tipo: 'lowpass', f: 280, q: 6, ate: 820 }, ataque: 0.12 }); break;
      case 'bee': this.tom(330, 0.65, { tipo: 'sawtooth', vol: 0.24, vibrato: 11, vibAmp: 0.05, ate: 300, filtro: { tipo: 'bandpass', f: 1150, q: 3 }, ataque: 0.04 }); break;
      case 'oinc':
        for (let i = 0; i < 2; i++) { this.tom(230 + i * 30, 0.12, { tipo: 'sawtooth', vol: 0.26, ate: 170, atraso: i * 0.17, filtro: { tipo: 'lowpass', f: 900, q: 8 } }); this.ruido(0.08, { vol: 0.12, freq: 600, atraso: i * 0.17 }); }
        break;
      case 'cocó':
        for (let i = 0; i < 3; i++) this.tom(820 + i * 70, 0.06, { tipo: 'triangle', vol: 0.2, ate: 1100, atraso: i * 0.09 });
        this.tom(1050, 0.22, { tipo: 'sawtooth', vol: 0.12, ate: 720, atraso: 0.3, filtro: { tipo: 'bandpass', f: 1800, q: 5 } });
        break;
      case 'auau':
        for (let i = 0; i < 2; i++) { this.tom(480, 0.1, { tipo: 'sawtooth', vol: 0.26, ate: 260, atraso: i * 0.22, filtro: { tipo: 'bandpass', f: 1100, q: 2.5 } }); this.ruido(0.05, { vol: 0.12, freq: 1200, tipo: 'bandpass', atraso: i * 0.22 }); }
        break;
      case 'hmm': this.tom(170, 0.45, { tipo: 'triangle', vol: 0.3, vibrato: 7, vibAmp: 0.04 }); this.tom(1300, 0.06, { tipo: 'sine', vol: 0.08, ate: 1700, atraso: 0.45 }); break;
      case 'pi': this.tom(1500, 0.06, { tipo: 'sine', vol: 0.2, ate: 2100 }); this.tom(1700, 0.05, { tipo: 'sine', vol: 0.15, ate: 2300, atraso: 0.09 }); break;
      case 'veado': this.tom(660, 0.28, { tipo: 'sawtooth', vol: 0.18, ate: 500, vibrato: 9, vibAmp: 0.03, filtro: { tipo: 'bandpass', f: 1500, q: 4 } }); break;
      case 'lobo': this.tom(520, 0.15, { tipo: 'sawtooth', vol: 0.2, ate: 380, filtro: { tipo: 'bandpass', f: 1000, q: 3 } }); break;
      case 'uivo':
        this.tom(330, 2.4, { tipo: 'sawtooth', vol: 0.14, ate: 560, vibrato: 5, vibAmp: 0.02, filtro: { tipo: 'lowpass', f: 700, q: 3, ate: 1100 }, ataque: 0.5 });
        this.tom(560, 1.4, { tipo: 'sawtooth', vol: 0.09, ate: 380, atraso: 1.8, filtro: { tipo: 'lowpass', f: 900, q: 3 }, ataque: 0.2 });
        break;
      case 'raposa': for (let i = 0; i < 3; i++) this.tom(1050, 0.08, { tipo: 'sawtooth', vol: 0.14, ate: 1500, atraso: i * 0.16, filtro: { tipo: 'bandpass', f: 2000, q: 4 } }); break;
      case 'urso': this.tom(88, 0.7, { tipo: 'sawtooth', vol: 0.3, ate: 70, vibrato: 20, vibAmp: 0.07, filtro: { tipo: 'lowpass', f: 380, q: 5 }, ataque: 0.06 }); this.ruido(0.5, { vol: 0.1, freq: 300, marrom: true }); break;
      case 'onca': for (let i = 0; i < 4; i++) this.tom(120, 0.15, { tipo: 'sawtooth', vol: 0.2, ate: 80, atraso: i * 0.22, filtro: { tipo: 'lowpass', f: 600, q: 4 } }); break; // esturro
      case 'cobra': this.ruido(0.4, { vol: 0.16, freq: 6000, tipo: 'highpass' }); break;
      default: this.oi();
    }
  }

  // ---------- ambiente e música ----------
  // chamado a cada quadro do jogo. info: { dt, dia 0..1 (claridade), vento 0..1, agua 0..1 (perto de água),
  // arvores 0..1, coberto (caverna), altura (y), pausado, debaixoDagua }
  ambiente(info) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const c = this.ctx, t = c.currentTime;
    if (!this.amb) this.criarAmbiente();
    const a = this.amb;
    const ligado = this.ligado && this.vol.efeitos > 0;
    const alto = Math.min(1, Math.max(0, (info.altura - 40) / 60));
    // vento: some na caverna, mais forte no alto; rajadas devagar
    a.fase += info.dt * (0.25 + Math.random() * 0.05);
    const rajada = 0.65 + 0.35 * Math.sin(a.fase) * Math.sin(a.fase * 0.37 + 1);
    const vento = ligado && !info.coberto ? info.vento * rajada * (0.06 + alto * 0.1 + info.arvores * 0.03) : 0;
    a.ventoG.gain.setTargetAtTime(vento, t, 0.4);
    a.ventoF.frequency.setTargetAtTime(260 + rajada * 380 + alto * 200, t, 0.5);
    // água corrente/mar por perto: chuá suave que "borbulha"
    const agua = ligado && !info.debaixoDagua ? info.agua * 0.09 : 0;
    a.aguaG.gain.setTargetAtTime(agua, t, 0.5);
    if (Math.random() < info.dt * 3) a.aguaF.frequency.setTargetAtTime(500 + Math.random() * 700, t, 0.2);
    if (!ligado || info.pausado) return;
    // passarinhos de dia perto de árvores/grama, grilos de noite, goteira na caverna
    a.prox -= info.dt;
    if (a.prox <= 0) {
      const leve = this.leve ? 2 : 1;
      if (info.coberto) { a.prox = (3 + Math.random() * 6) * leve; this.goteira(); }
      else if (info.debaixoDagua) a.prox = 4;
      else if (info.dia > 0.45) { a.prox = (2 + Math.random() * 5) * leve / (0.4 + info.arvores); if (info.arvores > 0.05 || Math.random() < 0.3) this.passarinho(); }
      else { a.prox = (0.8 + Math.random() * 2.5) * leve; this.grilo(); }
    }
    this.musica(info);
  }
  criarAmbiente() {
    const c = this.ctx;
    const a = { fase: Math.random() * 10, prox: 2 };
    const fonte = (buf) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = 0; s.start(0, Math.random() * 1.5); return s; };
    a.ventoS = fonte(this.bufMarrom);
    a.ventoF = c.createBiquadFilter(); a.ventoF.type = 'bandpass'; a.ventoF.Q.value = 0.8; a.ventoF.frequency.value = 400;
    a.ventoG = c.createGain(); a.ventoG.gain.value = 0;
    a.ventoS.connect(a.ventoF); a.ventoF.connect(a.ventoG); a.ventoG.connect(this.busEfeitos);
    a.aguaS = fonte(this.bufRuido);
    a.aguaF = c.createBiquadFilter(); a.aguaF.type = 'bandpass'; a.aguaF.Q.value = 0.9; a.aguaF.frequency.value = 800;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    a.aguaG = c.createGain(); a.aguaG.gain.value = 0;
    a.aguaS.connect(a.aguaF); a.aguaF.connect(lp); lp.connect(a.aguaG); a.aguaG.connect(this.busEfeitos);
    this.amb = a;
  }
  // um passarinho em algum lugar perto (lado aleatório)
  passarinho() {
    const ang = Math.random() * Math.PI * 2, d = 6 + Math.random() * 14;
    const o = this.ouv;
    this.em({ x: o.x + Math.cos(ang) * d, y: o.y + 3 + Math.random() * 4, z: o.z + Math.sin(ang) * d }, () => {
      const tipo = Math.floor(Math.random() * 3);
      const base = 2200 + Math.random() * 1400;
      if (tipo === 0) for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) this.tom(base, 0.07, { tipo: 'sine', vol: 0.09, ate: base * 1.5, atraso: i * 0.1 });
      else if (tipo === 1) { this.tom(base * 0.8, 0.18, { tipo: 'sine', vol: 0.1, ate: base * 1.2 }); this.tom(base * 1.2, 0.22, { tipo: 'sine', vol: 0.09, ate: base * 0.85, atraso: 0.22 }); }
      else for (let i = 0; i < 2; i++) this.tom(base * 1.3, 0.12, { tipo: 'sine', vol: 0.08, ate: base * 0.9, atraso: i * 0.3, vibrato: 30, vibAmp: 0.03 });
    });
  }
  grilo() {
    const ang = Math.random() * Math.PI * 2, d = 4 + Math.random() * 12, o = this.ouv;
    this.em({ x: o.x + Math.cos(ang) * d, y: o.y, z: o.z + Math.sin(ang) * d }, () => {
      const f = 4300 + Math.random() * 600;
      for (let i = 0; i < 3; i++) this.tom(f, 0.035, { tipo: 'sine', vol: 0.05, atraso: i * 0.06 });
    });
  }
  goteira() {
    const ang = Math.random() * Math.PI * 2, d = 2 + Math.random() * 8, o = this.ouv;
    this.em({ x: o.x + Math.cos(ang) * d, y: o.y + 2, z: o.z + Math.sin(ang) * d }, () => { const f = 1100 + Math.random() * 700; this.tom(f, 0.07, { tipo: 'sine', vol: 0.12, ate: f * 2 }); });
  }

  // música ambiente leve: frases curtas de "kalimba" com silêncio no meio (de dia alegre, de noite calminha)
  musica(info) {
    if (this.vol.musica <= 0) return;
    const c = this.ctx;
    if (!this.mus) this.mus = { prox: c.currentTime + 6, compasso: 0, frase: 0, nota: 2 };
    const m = this.mus;
    if (m.prox > c.currentTime + 0.5) return;
    if (m.prox < c.currentTime) m.prox = c.currentTime + 0.05; // voltou de pausa longa: não toca atrasado
    const noite = info.dia < 0.45;
    const bpm = noite ? 72 : 96, tempo = 60 / bpm;
    // acordes (tônica, em midi): dia em Dó, noite em Lá menor
    const ciclo = noite ? [57, 53, 48, 55] : [60, 57, 53, 55];
    const raiz = ciclo[m.compasso % 4];
    const t0 = m.prox;
    const vol = noite ? 0.12 : 0.15;
    // baixo macio no começo do compasso
    this.notaMusica(midi(raiz - 12), t0, tempo * 3.5, vol * 0.8, 'baixo');
    // melodia: anda pela pentatônica, com pausas
    const centro = noite ? 69 : 72;
    for (let k = 0; k < 8; k++) {
      if (Math.random() < (noite ? 0.6 : 0.45)) continue;
      m.nota = Math.max(0, Math.min(9, m.nota + Math.floor(Math.random() * 5) - 2));
      const n = centro - 12 + PENTA[m.nota % 5] + 12 * Math.floor(m.nota / 5) + (noite ? -3 : 0);
      this.notaMusica(midi(n), t0 + k * tempo * 0.5, tempo * 1.6, vol, noite ? 'caixinha' : 'kalimba');
    }
    m.compasso++;
    m.prox = t0 + tempo * 4;
    // depois de uma frase (8 compassos), um bom silêncio para não cansar
    if (m.compasso % 8 === 0) m.prox += 25 + Math.random() * 35;
  }
  notaMusica(f, t, dur, vol, timbre) {
    if (!this.ligado || this.vozes >= this.maxVozes - 4) return;
    const c = this.ctx;
    const g = c.createGain(); g.connect(this.busMusica);
    const o = c.createOscillator(); o.type = timbre === 'baixo' ? 'triangle' : 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (timbre === 'baixo' ? 0.06 : 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); this.conta(o); o.start(t); o.stop(t + dur + 0.05);
    // brilho de "sininho" por cima (só fora do modo Leve)
    if (timbre !== 'baixo' && !this.leve) {
      const o2 = c.createOscillator(), g2 = c.createGain();
      o2.frequency.value = f * (timbre === 'caixinha' ? 3 : 4);
      g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(vol * 0.18, t + 0.005); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.3);
      o2.connect(g2); g2.connect(this.busMusica); this.conta(o2); o2.start(t); o2.stop(t + dur * 0.3 + 0.05);
    }
  }
  // saiu do jogo: silencia o ambiente e os motores
  silenciarJogo() {
    if (!this.ctx) return;
    for (const id of [...this.motores.keys()]) this.pararMotor(id);
    if (this.amb) { const t = this.ctx.currentTime; this.amb.ventoG.gain.setTargetAtTime(0, t, 0.2); this.amb.aguaG.gain.setTargetAtTime(0, t, 0.2); }
    this.caverna(false);
    if (this.mus) this.mus.prox = this.ctx.currentTime + 6;
  }
  // aba escondida: para o áudio todo (economiza bateria); volta quando aparecer
  pausarTudo(sim) {
    if (!this.ctx) return;
    if (sim && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
    else if (!sim && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }
}

function num(v, padrao) { v = +v; return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : padrao; }

// páginas de tabuleiro (xadrez, dama): liga o som no primeiro toque
export function somDaPagina() {
  const s = new Som();
  const ligar = () => s.iniciar();
  addEventListener('pointerdown', ligar, { capture: true });
  addEventListener('keydown', ligar, { capture: true });
  document.addEventListener('visibilitychange', () => s.pausarTudo(document.hidden));
  return s;
}

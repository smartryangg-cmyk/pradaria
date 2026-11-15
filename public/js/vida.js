// Vida do jogador (corações) e, no jogo clássico, a fome (coxinhas).
// Mundos com mods (bichos que mordem, armas, Guerra): 5 corações e a vida volta sozinha.
// Jogo clássico (Sobrevivência fora do Pacífico, sem armas): 10 corações (20 de vida, como no clássico),
// a vida só volta com a fome cheia (fome-regras.js), sem corações a pessoa morre (main.js).
// Outras partes do jogo podem curar: import { vida } from './vida.js'; vida.curar(2); // 2 = um coração inteiro
import { icone } from './icones.js';
import { opcoesMundo } from './opcoes-mundo.js';
import { fomeNova, normalizarFome, cansar, comer, tique, podeCorrer, FOME_MAX, CANSA } from './fome-regras.js';

const MAX_MODS = 10; // 5 corações, cada um vale 2 (dá meio coração)
const MAX_CLASSICO = 20; // 10 corações
const ESPERA_CURA = 6; // segundos sem levar dano para começar a recuperar sozinho (mundos com mods)
const CURA_A_CADA = 3; // recupera meio coração a cada 3 s

// jogo clássico de verdade: sobrevivência, fora do Pacífico, sem armas e fora da Guerra
export const classico = () => !!(opcoesMundo.sobrevivencia && opcoesMundo.dificuldade && opcoesMundo.dificuldade !== 'pacifico' && !opcoesMundo.armas && opcoesMundo.tipo !== 'guerra');

export const vida = {
  max: MAX_MODS,
  atual: MAX_MODS,
  semDano: 99, // segundos desde o último dano
  protegido: 0, // segundos de proteção (depois de desmaiar)
  acumCura: 0,
  fome: fomeNova(),
  aoDesmaiar: null, // definido pelo main.js
  aoMudar: null,

  ligada() { return classico() || !!((opcoesMundo.selvagens && opcoesMundo.selvagensMachucam) || opcoesMundo.armas || opcoesMundo.tipo === 'guerra'); },
  classico,
  // os danos do jogo foram feitos para 5 corações: no clássico (10 corações) valem o dobro
  escala() { return classico() ? 2 : 1; },

  reiniciar(guardado = null) {
    this.max = classico() ? MAX_CLASSICO : MAX_MODS;
    this.atual = this.max; this.semDano = 99; this.protegido = 0; this.acumCura = 0;
    this.fome = fomeNova();
    if (guardado && classico()) {
      if (Number.isFinite(guardado.v) && guardado.v > 0) this.atual = Math.max(1, Math.min(this.max, Math.round(guardado.v)));
      this.fome = normalizarFome(guardado.fome);
    }
    this.desenhar();
  },
  salvar() { return { v: this.atual, fome: { f: this.fome.f, s: Math.round(this.fome.s * 10) / 10, x: Math.round(this.fome.x * 100) / 100 } }; },

  // devolve true se machucou
  dano(n = 1) {
    if (!this.ligada() || this.protegido > 0 || this.atual <= 0) return false;
    this.atual = Math.max(0, this.atual - n);
    this.semDano = 0; this.acumCura = 0;
    if (classico()) cansar(this.fome, CANSA.dano);
    this.desenhar(true);
    if (this.atual <= 0 && this.aoDesmaiar) this.aoDesmaiar();
    return true;
  },

  curar(n = 2) {
    if (this.atual >= this.max || this.atual <= 0) return false;
    this.atual = Math.min(this.max, this.atual + n);
    this.desenhar();
    return true;
  },

  // fome (só no clássico)
  cansar(q) { if (classico() && this.atual > 0) { const f = this.fome.f; cansar(this.fome, q); if (f !== this.fome.f) this.desenhar(); } },
  podeCorrer() { return !classico() || podeCorrer(this.fome); },
  comFome() { return classico() && this.fome.f < FOME_MAX; },
  comer(id) { if (!classico() || !comer(this.fome, id)) return false; this.desenhar(); return true; },

  atualizar(dt) {
    if (this.protegido > 0) this.protegido -= dt;
    this.semDano += dt;
    if (this.atual <= 0) return;
    if (classico()) {
      const d = tique(this.fome, dt, this.atual, this.max, opcoesMundo.dificuldade);
      if (d > 0) this.curar(1);
      else if (d < 0) { this.protegido = 0; this.motivo = 'fome'; this.dano(1); }
      return;
    }
    if (this.atual < this.max && this.semDano > ESPERA_CURA) {
      this.acumCura += dt;
      if (this.acumCura >= CURA_A_CADA) { this.acumCura = 0; this.curar(1); }
    }
  },

  desenhar(machucou = false) {
    const el = document.querySelector('#vida');
    if (!el) return;
    el.hidden = !this.ligada();
    document.body.classList.toggle('com-vida', !el.hidden); // a dica do toque sobe para não ficar em cima dos corações
    const fe = document.querySelector('#fome');
    if (fe) fe.hidden = el.hidden || !classico();
    if (el.hidden) return;
    const n = this.max / 2;
    if (el.childElementCount !== n) {
      el.textContent = '';
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.className = 'coracao';
        s.innerHTML = icone('coracao') + '<span class="metade">' + icone('coracao') + '</span>';
        el.appendChild(s);
      }
    }
    [...el.children].forEach((s, i) => {
      const v = this.atual - i * 2; // 2 = cheio, 1 = meio, 0 = vazio
      s.className = 'coracao ' + (v >= 2 ? 'cheio' : v === 1 ? 'meio' : 'oco');
    });
    el.classList.toggle('dez', n === 10);
    el.setAttribute('aria-label', `Vida: ${this.atual / 2} de ${n} corações`);
    if (machucou) { el.classList.remove('treme'); void el.offsetWidth; el.classList.add('treme'); }
    if (fe && !fe.hidden) {
      if (fe.childElementCount !== 10) {
        fe.textContent = '';
        for (let i = 0; i < 10; i++) {
          const s = document.createElement('span');
          s.className = 'coxa';
          s.innerHTML = icone('coxa') + '<span class="metade">' + icone('coxa') + '</span>';
          fe.appendChild(s);
        }
      }
      // como no clássico: a barra de fome enche da direita para a esquerda
      [...fe.children].forEach((s, i) => {
        const v = this.fome.f - i * 2;
        s.className = 'coxa ' + (v >= 2 ? 'cheio' : v === 1 ? 'meio' : 'oco');
      });
      fe.classList.toggle('treme', this.fome.f <= 6);
      fe.setAttribute('aria-label', `Fome: ${this.fome.f / 2} de 10`);
    }
    if (this.aoMudar) this.aoMudar(this.atual, machucou);
  },
};

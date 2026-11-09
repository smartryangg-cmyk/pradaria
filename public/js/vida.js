// Vida do jogador (corações). Só aparece nos mundos com a opção "Animais podem machucar".
// Outras partes do jogo podem curar: import { vida } from './vida.js'; vida.curar(2); // 2 = um coração inteiro
import { icone } from './icones.js';
import { opcoesMundo } from './opcoes-mundo.js';

const MAX = 10; // 5 corações, cada um vale 2 (dá meio coração)
const ESPERA_CURA = 6; // segundos sem levar dano para começar a recuperar sozinho
const CURA_A_CADA = 3; // recupera meio coração a cada 3 s

export const vida = {
  max: MAX,
  atual: MAX,
  semDano: 99, // segundos desde o último dano
  protegido: 0, // segundos de proteção (depois de desmaiar)
  acumCura: 0,
  aoDesmaiar: null, // definido pelo main.js
  aoMudar: null,

  ligada() { return !!(opcoesMundo.selvagens && opcoesMundo.selvagensMachucam); },

  reiniciar() { this.atual = MAX; this.semDano = 99; this.protegido = 0; this.acumCura = 0; this.desenhar(); },

  // devolve true se machucou
  dano(n = 1) {
    if (!this.ligada() || this.protegido > 0 || this.atual <= 0) return false;
    this.atual = Math.max(0, this.atual - n);
    this.semDano = 0; this.acumCura = 0;
    this.desenhar(true);
    if (this.atual <= 0 && this.aoDesmaiar) this.aoDesmaiar();
    return true;
  },

  curar(n = 2) {
    if (this.atual >= MAX) return false;
    this.atual = Math.min(MAX, this.atual + n);
    this.desenhar();
    return true;
  },

  atualizar(dt) {
    if (this.protegido > 0) this.protegido -= dt;
    this.semDano += dt;
    if (this.atual > 0 && this.atual < MAX && this.semDano > ESPERA_CURA) {
      this.acumCura += dt;
      if (this.acumCura >= CURA_A_CADA) { this.acumCura = 0; this.curar(1); }
    }
  },

  desenhar(machucou = false) {
    const el = document.querySelector('#vida');
    if (!el) return;
    el.hidden = !this.ligada();
    if (el.hidden) return;
    if (!el.childElementCount) for (let i = 0; i < MAX / 2; i++) {
      const s = document.createElement('span');
      s.className = 'coracao';
      s.innerHTML = icone('coracao') + '<span class="metade">' + icone('coracao') + '</span>';
      el.appendChild(s);
    }
    [...el.children].forEach((s, i) => {
      const v = this.atual - i * 2; // 2 = cheio, 1 = meio, 0 = vazio
      s.className = 'coracao ' + (v >= 2 ? 'cheio' : v === 1 ? 'meio' : 'vazio');
    });
    el.setAttribute('aria-label', `Vida: ${this.atual / 2} de ${MAX / 2} corações`);
    if (machucou) { el.classList.remove('treme'); void el.offsetWidth; el.classList.add('treme'); }
    if (this.aoMudar) this.aoMudar(this.atual, machucou);
  },
};

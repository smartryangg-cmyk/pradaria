// Fome (como no clássico), regras puras: sem tela, o teste roda no node.
// Barra de 20 (10 coxinhas), saturação escondida e cansaço. Andar correndo, pular, bater e quebrar cansam;
// a cada 4 de cansaço sai 1 de saturação ou, sem saturação, 1 de fome. Com a fome em 18 ou mais a vida volta
// sozinha; com a fome em 0 a vida cai (no Fácil até 10, no Normal até 1, no Difícil até morrer).
// Correr só com a fome acima de 6.
import { IDS as I } from './receitas.js';

export const FOME_MAX = 20;
export const CORRE_ACIMA = 6;
// f = quanto enche a barra, s = saturação (quanto tempo segura a fome)
export const COMIDA = {
  [I.PAO]: { f: 5, s: 6 },
  [I.CARNE]: { f: 3, s: 1.8 },
};
export const ehComida = (id) => Object.prototype.hasOwnProperty.call(COMIDA, id);
export const TEMPO_COMER = 1.6; // segundos segurando para comer

// quanto cansa cada coisa (como no clássico)
export const CANSA = { correr: 0.1, nadar: 0.01, pular: 0.05, pularCorrendo: 0.2, bater: 0.1, quebrar: 0.005, dano: 0.1, curar: 6 };

export const fomeNova = () => ({ f: FOME_MAX, s: 5, x: 0, tc: 0, tr: 0 });
export function normalizarFome(o) {
  const n = fomeNova();
  if (!o || typeof o !== 'object') return n;
  const num = (v, a, b, p) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : p);
  n.f = Math.round(num(o.f, 0, FOME_MAX, n.f));
  n.s = num(o.s, 0, n.f, Math.min(n.s, n.f));
  n.x = num(o.x, 0, 4, 0);
  return n;
}

export function cansar(e, q) {
  if (!(q > 0)) return;
  e.x += q;
  while (e.x >= 4) {
    e.x -= 4;
    if (e.s > 0) e.s = Math.max(0, e.s - 1);
    else e.f = Math.max(0, e.f - 1);
  }
}

// comeu: devolve false se não é comida ou se está sem fome
export function comer(e, id) {
  const c = COMIDA[id];
  if (!c || e.f >= FOME_MAX) return false;
  e.f = Math.min(FOME_MAX, e.f + c.f);
  e.s = Math.min(e.f, e.s + c.s);
  return true;
}

export const podeCorrer = (e) => e.f > CORRE_ACIMA;
// até onde a fome (barra em 0) deixa a vida cair
export const pisoFome = (dif) => (dif === 'facil' ? 10 : dif === 'dificil' ? 0 : 1);

// a cada quadro: devolve quanto a vida muda (+1 curou, -1 a fome machucou, 0 nada)
export function tique(e, dt, vida, max, dif) {
  // cheio e com saturação: cura rápido (meio coração a cada 0,5 s, gastando a saturação)
  if (e.f >= FOME_MAX && e.s > 0 && vida < max) {
    e.tr += dt;
    if (e.tr >= 0.5) { e.tr = 0; cansar(e, Math.min(e.s, CANSA.curar)); return 1; }
    return 0;
  }
  if (e.f >= 18 && vida < max) {
    e.tr += dt;
    if (e.tr >= 4) { e.tr = 0; cansar(e, CANSA.curar); return 1; }
    return 0;
  }
  e.tr = 0;
  if (e.f <= 0) {
    e.tc += dt;
    if (e.tc >= 4) { e.tc = 0; if (vida > pisoFome(dif)) return -1; }
    return 0;
  }
  e.tc = 0;
  return 0;
}

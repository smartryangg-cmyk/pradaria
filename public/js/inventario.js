// Inventário de espaços, como no clássico: 9 da barra (0..8), 27 da mochila (9..35), a segunda mão (36)
// e a armadura vestida (37 cabeça, 38 peito, 39 pernas, 40 pés: só a peça daquela parte, armadura-regras.js),
// mais a grade de criar (2x2 na mochila, 3x3 na bancada) e o que está preso no cursor.
// Quantas coisas o jogador tem é a contagem da economia (e.itens = { id: n }, conferida pela sala);
// aqui fica só a ARRUMAÇÃO. ajustar(itens) faz a arrumação bater com a contagem: o que entrou vai para
// as pilhas e espaços livres, o que saiu sai primeiro da mão. A conta de espaço (receitas.js ESPACOS)
// garante que tudo cabe; se uma mochila antiga passou do limite, o resto fica em "sobrando".
// Sem tela (o teste roda no node).
import { pilhaDe } from './receitas.js';
import { parteDe } from './armadura-regras.js';

export const BARRA = 9, MAO2 = 36, ARMA = 37, TOTAL = 41;
const faixa = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const BARRA_I = faixa(0, 9), MOCHILA_I = faixa(9, 36), ARMA_I = faixa(37, 41);
// o espaço i aceita a coisa id? (os da armadura só a peça da parte certa)
export const aceita = (l, i, id) => !(l === 's' && i >= ARMA) || parteDe(id) === i - ARMA;

export class Inventario {
  constructor() {
    this.s = new Array(TOTAL).fill(null); // espaços: { id, n } ou null
    this.g = new Array(9).fill(null);     // grade de criar (w*w usados)
    this.w = 2;
    this.cursor = null;                   // o que está "na mão" dentro da tela
    this.extra = [];                      // sobrando (mochila antiga acima do limite)
    this.preferir = -1;                   // de onde sai primeiro na próxima vez (ex.: colocou da segunda mão)
  }
  lista(l) { return l === 's' ? this.s : l === 'g' ? this.g : this.extra; }
  em(l, i) { return this.lista(l)[i] || null; }
  por(l, i, p) {
    const a = this.lista(l);
    a[i] = p && p.n > 0 ? p : null;
    if (l === 'x') this.extra = this.extra.filter(Boolean);
  }
  *pilhas() {
    for (const p of this.s) if (p) yield p;
    for (const p of this.g) if (p) yield p;
    for (const p of this.extra) if (p) yield p;
    if (this.cursor) yield this.cursor;
  }
  total(id) { let n = 0; for (const p of this.pilhas()) if (p.id === id) n += p.n; return n; }
  contagem() { const c = {}; for (const p of this.pilhas()) c[p.id] = (c[p.id] || 0) + p.n; return c; }
  gradeIds() { return this.g.slice(0, this.w * this.w).map((p) => (p ? p.id : 0)); }
  // as peças vestidas (ids)
  vestido() { return ARMA_I.map((i) => this.s[i]).filter(Boolean).map((p) => p.id); }
  // vestir a peça do espaço i (da barra ou da mochila): troca com a que estava vestida
  vestir(i) {
    const a = this.s[i], p = a ? parteDe(a.id) : -1;
    if (p < 0 || i >= ARMA) return false;
    this.s[i] = this.s[ARMA + p]; this.s[ARMA + p] = a;
    return true;
  }

  // ---------- bater com a contagem ----------
  ajustar(itens, sel = 0) {
    const ids = new Set(Object.keys(itens).map(Number));
    for (const p of this.pilhas()) ids.add(p.id);
    for (const id of ids) {
      const d = (itens[id] > 0 ? itens[id] : 0) - this.total(id);
      if (d > 0) this.add(id, d);
      else if (d < 0) this.remover(id, -d, sel);
    }
    this.preferir = -1;
    // não coube: veste a armadura que está solta (o espaço dela é próprio) e junta as pilhas incompletas
    // da mesma coisa (a mochila diz que cabe arrumando apertado)
    const livre = () => [...BARRA_I, ...MOCHILA_I, MAO2].some((i) => !this.s[i]);
    if (this.extra.length) {
      for (const i of [...MOCHILA_I, ...BARRA_I, MAO2]) { const a = this.s[i], p = a ? parteDe(a.id) : -1; if (p >= 0 && !this.s[ARMA + p]) this.vestir(i); }
      for (let k = 0; k < this.extra.length; k++) { const a = this.extra[k], p = parteDe(a.id); if (p >= 0 && !this.s[ARMA + p]) { this.s[ARMA + p] = a; this.extra[k] = null; } }
      this.extra = this.extra.filter(Boolean);
    }
    if (this.extra.length && !livre()) this.juntar();
    // sobrando: se abriu espaço, entra
    if (this.extra.length && livre()) { const ex = this.extra; this.extra = []; for (const p of ex) this.add(p.id, p.n); }
  }
  // junta pilhas incompletas iguais (a de trás enche a da frente)
  juntar() {
    for (let i = 0; i < TOTAL; i++) {
      const a = this.s[i];
      if (!a) continue;
      const p = pilhaDe(a.id);
      for (let j = i + 1; j < TOTAL && a.n < p; j++) {
        const b = this.s[j];
        if (!b || b.id !== a.id) continue;
        const k = Math.min(p - a.n, b.n); a.n += k; b.n -= k;
        if (!b.n) this.s[j] = null;
      }
    }
  }
  // entrou: completa pilhas (barra, mochila, segunda mão), depois espaços vazios (barra primeiro)
  add(id, n) {
    const p = pilhaDe(id);
    for (const i of [...BARRA_I, ...MOCHILA_I, MAO2]) {
      const a = this.s[i];
      if (a && a.id === id && a.n < p) { const k = Math.min(p - a.n, n); a.n += k; n -= k; if (!n) return; }
    }
    // a segunda mão só recebe sozinha quando todo o resto está cheio
    for (const i of [...BARRA_I, ...MOCHILA_I, MAO2]) {
      if (!this.s[i]) { const k = Math.min(p, n); this.s[i] = { id, n: k }; n -= k; if (!n) return; }
    }
    while (n > 0) { const k = Math.min(p, n); this.extra.push({ id, n: k }); n -= k; }
  }
  // saiu: primeiro da mão (ou de onde foi usado), depois barra, mochila, segunda mão, sobrando, grade, cursor
  remover(id, n, sel = 0) {
    const ordem = [];
    if (this.preferir >= 0) ordem.push(['s', this.preferir]);
    ordem.push(['s', sel], ...BARRA_I.map((i) => ['s', i]), ...MOCHILA_I.map((i) => ['s', i]), ['s', MAO2]);
    this.extra.forEach((_, i) => ordem.push(['x', i]));
    ordem.push(...ARMA_I.map((i) => ['s', i])); // a vestida sai por último
    this.g.forEach((_, i) => ordem.push(['g', i]));
    for (const [l, i] of ordem) {
      const a = this.lista(l)[i];
      if (!a || a.id !== id) continue;
      const k = Math.min(a.n, n); a.n -= k; n -= k;
      if (!a.n) this.lista(l)[i] = null;
      if (!n) break;
    }
    this.extra = this.extra.filter(Boolean);
    if (n > 0 && this.cursor && this.cursor.id === id) { this.cursor.n -= Math.min(n, this.cursor.n); if (!this.cursor.n) this.cursor = null; }
  }

  // ---------- mexer com o cursor (clique, clique direito, arrastar) ----------
  // clique: pega a pilha toda; com algo preso, larga tudo, junta na pilha igual ou troca
  clicar(l, i) {
    const a = this.em(l, i), c = this.cursor;
    if (!c) { if (a) { this.cursor = a; this.por(l, i, null); } return; }
    if (l === 'x' || !aceita(l, i, c.id)) return; // em "sobrando" só se tira; na armadura só a peça certa
    if (!a) { this.por(l, i, c); this.cursor = null; return; }
    if (a.id === c.id) {
      const k = Math.min(pilhaDe(c.id) - a.n, c.n); a.n += k; c.n -= k;
      if (!c.n) this.cursor = null;
      return;
    }
    this.por(l, i, c); this.cursor = a;
  }
  // clique direito (ou segurar o dedo): pega a metade; com algo preso, larga 1
  clicarDireito(l, i) {
    const a = this.em(l, i), c = this.cursor;
    if (!c) {
      if (a) { const k = Math.ceil(a.n / 2); this.cursor = { id: a.id, n: k }; a.n -= k; if (!a.n) this.por(l, i, null); }
      return;
    }
    if (l === 'x' || !aceita(l, i, c.id)) return;
    if (!a) this.por(l, i, { id: c.id, n: 1 });
    else if (a.id === c.id && a.n < pilhaDe(a.id)) a.n++;
    else return;
    c.n--;
    if (!c.n) this.cursor = null;
  }
  // arrastou com algo preso por vários espaços: reparte igual (ou 1 em cada)
  espalhar(lugares, umCada = false) {
    const c = this.cursor;
    if (!c) return;
    const alvos = lugares.filter(([l, i]) => { const a = this.em(l, i); return l !== 'x' && aceita(l, i, c.id) && (!a || a.id === c.id); });
    if (!alvos.length) return;
    const p = pilhaDe(c.id), cada = umCada ? 1 : Math.max(1, Math.floor(c.n / alvos.length));
    for (const [l, i] of alvos) {
      if (!c.n) break;
      const a = this.em(l, i), k = Math.min(cada, p - (a ? a.n : 0), c.n);
      if (k <= 0) continue;
      if (a) a.n += k; else this.por(l, i, { id: c.id, n: k });
      c.n -= k;
    }
    if (!c.n) this.cursor = null;
  }
  // shift-clique: barra <-> mochila; da grade, da segunda mão e de "sobrando" vai para a mochila
  moverRapido(l, i) {
    const a = this.em(l, i);
    if (!a) return;
    // peça de armadura com a parte livre: veste (como no clássico)
    const pa = parteDe(a.id);
    if (pa >= 0 && !(l === 's' && i >= ARMA) && !this.s[ARMA + pa]) { this.s[ARMA + pa] = a; this.por(l, i, null); return; }
    const destino = l === 's' && i < 9 ? MOCHILA_I : l === 's' && i < 36 ? BARRA_I : [...MOCHILA_I, ...BARRA_I];
    const p = pilhaDe(a.id);
    for (const j of destino) {
      const b = this.s[j];
      if (b && b.id === a.id && b.n < p) { const k = Math.min(p - b.n, a.n); b.n += k; a.n -= k; if (!a.n) break; }
    }
    if (a.n) for (const j of destino) if (!this.s[j]) { this.s[j] = { id: a.id, n: a.n }; a.n = 0; break; }
    if (!a.n) this.por(l, i, null);
  }
  // tecla 1..9 em cima de um espaço: troca com aquele espaço da barra
  trocarComBarra(l, i, k) {
    if (l === 's' && i === k) return;
    const a = this.em(l, i), b = this.s[k];
    if ((l === 'x' && b) || (b && !aceita(l, i, b.id))) return;
    this.s[k] = a; this.por(l, i, b);
  }
  // tecla F: troca o que está na mão com a segunda mão
  trocarMaos(sel) { const a = this.s[sel]; this.s[sel] = this.s[MAO2]; this.s[MAO2] = a; }

  // ---------- grade de criar ----------
  // fechou a tela (ou trocou de grade): o que estava na grade e no cursor volta para a mochila
  devolverGrade() { for (let i = 0; i < 9; i++) { const p = this.g[i]; if (p) { this.g[i] = null; this.add(p.id, p.n); } } }
  devolver() { this.devolverGrade(); if (this.cursor) { const c = this.cursor; this.cursor = null; this.add(c.id, c.n); } }
  mudarGrade(w) { if (w !== this.w) { this.devolverGrade(); this.w = w; } }
  // criou uma vez: cada espaço usado da grade gasta 1
  gastarGrade() { for (let i = 0; i < this.w * this.w; i++) { const p = this.g[i]; if (p) { p.n--; if (!p.n) this.g[i] = null; } } }
  // livro de receitas: põe os ingredientes na grade (ids w*w) tirando da mochila; vezes = até quantas
  encher(ids, vezes = 1) {
    this.devolverGrade();
    const precisa = {};
    ids.forEach((id) => { if (id) precisa[id] = (precisa[id] || 0) + 1; });
    for (const id in precisa) {
      const tem = this.total(+id) - (this.cursor && this.cursor.id === +id ? this.cursor.n : 0);
      vezes = Math.min(vezes, Math.floor(tem / precisa[id]), pilhaDe(+id));
    }
    if (!(vezes >= 1)) return 0;
    ids.forEach((id, i) => {
      if (!id) return;
      let falta = vezes;
      // tira primeiro da mochila, depois de "sobrando", da barra e da segunda mão
      for (const [l, j] of [...MOCHILA_I.map((k) => ['s', k]), ...this.extra.map((_, k) => ['x', k]), ...BARRA_I.map((k) => ['s', k]), ['s', MAO2]]) {
        const a = this.lista(l)[j];
        if (!a || a.id !== id) continue;
        const k = Math.min(a.n, falta); a.n -= k; falta -= k;
        if (!a.n) this.lista(l)[j] = null;
        if (!falta) break;
      }
      this.extra = this.extra.filter(Boolean);
      this.g[i] = { id, n: vezes };
    });
    return vezes;
  }

  // ---------- guardar ----------
  salvar() { return { v: 1, s: this.s.map((p) => (p ? [p.id, p.n] : 0)) }; }
  carregar(o) {
    // 37 = guardado antes da armadura (os espaços dela começam vazios)
    if (!o || o.v !== 1 || !Array.isArray(o.s) || (o.s.length !== TOTAL && o.s.length !== ARMA)) return false;
    this.s = [...o.s, ...new Array(TOTAL - o.s.length).fill(0)].map((p, i) => (Array.isArray(p) && Number.isInteger(p[0]) && p[1] > 0 && aceita('s', i, p[0]) ? { id: p[0], n: Math.min(p[1] | 0, pilhaDe(p[0])) } : null));
    return true;
  }
}

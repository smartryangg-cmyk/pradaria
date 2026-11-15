// Baú (como no clássico), regras puras: sem tela. O jogo sem internet e a sala online usam as mesmas.
// 27 espaços (3 fileiras de 9). Cada espaço guarda uma pilha: [id, n, c, d]
//   c = quantos dessa pilha são coisa comprada (a marca vai junto e volta para quem tirar: ninguém lucra)
//   d = desgaste da ferramenta (ferramenta não empilha; tirar do baú não conserta)
// Quem é dono do estado é a sala (online) ou o aparelho (sem internet); economia.js mexe na mochila e no baú
// juntos (ações bau-por e bau-tirar).
import { guardavel, pilhaDe, DURA } from './receitas.js';

export const BAU = 223;
export const ESPACOS_BAU = 27;

export const bauNovo = () => Array(ESPACOS_BAU).fill(null);
const int = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
// o que veio guardado (ou da rede) volta sempre certo
export function normalizarBau(o) {
  const b = bauNovo();
  if (!Array.isArray(o)) return b;
  for (let i = 0; i < ESPACOS_BAU; i++) {
    const p = o[i];
    if (!Array.isArray(p) || !guardavel(p[0]) || !int(p[1], 1, pilhaDe(p[0]))) continue;
    const c = int(p[2], 0, p[1]) ? p[2] : 0;
    const d = DURA[p[0]] && int(p[3], 0, DURA[p[0]] - 1) ? p[3] : 0;
    b[i] = [p[0], p[1], c, d];
  }
  return b;
}

// quantos de `id` cabem no espaço k (ou no baú todo, k = -1)
export function caberNoBau(b, k, id, n) {
  if (!guardavel(id) || n < 1) return 0;
  const P = pilhaDe(id);
  const cabeEm = (p) => (!p ? P : p[0] === id && !DURA[id] ? P - p[1] : 0);
  if (k >= 0) return int(k, 0, ESPACOS_BAU - 1) ? Math.min(n, cabeEm(b[k])) : 0;
  let q = 0;
  for (const p of b) { q += cabeEm(p); if (q >= n) return n; }
  return q;
}

// põe n de id (c deles comprados; d = desgaste, só ferramenta, que vai uma por vez) no espaço k
// ou, com k = -1, primeiro nas pilhas iguais e depois nos espaços vazios. Devolve quantos entraram.
export function porNoBau(b, k, id, n, c = 0, d = 0) {
  const q = caberNoBau(b, k, id, n);
  if (!q) return 0;
  let falta = q, falC = Math.min(c, q);
  const em = (i) => {
    const p = b[i], cabe = !p ? pilhaDe(id) : p[0] === id && !DURA[id] ? pilhaDe(id) - p[1] : 0;
    const m = Math.min(falta, cabe);
    if (m <= 0) return;
    // as compradas vão por último: ficam nas últimas pilhas
    const mc = Math.max(0, falC - (falta - m));
    b[i] = p ? [id, p[1] + m, p[2] + mc, p[3]] : [id, m, mc, DURA[id] ? d : 0];
    falta -= m; falC -= mc;
  };
  if (k >= 0) em(k);
  else {
    for (let i = 0; i < ESPACOS_BAU && falta; i++) if (b[i]) em(i);
    for (let i = 0; i < ESPACOS_BAU && falta; i++) if (!b[i]) em(i);
  }
  return q;
}

// tira até n do espaço k: devolve { id, n, c, d } (c = quantos dos tirados são comprados) ou null
export function tirarDoBau(b, k, n = 64) {
  if (!int(k, 0, ESPACOS_BAU - 1) || !b[k]) return null;
  const [id, tem, c, d] = b[k];
  const q = Math.max(0, Math.min(n, tem));
  if (!q) return null;
  const qc = Math.max(0, q - (tem - c)); // as livres saem primeiro
  if (q === tem) b[k] = null; else b[k] = [id, tem - q, c - qc, d];
  return { id, n: q, c: qc, d };
}

// tudo o que tem dentro (quebrou o baú: cai no chão)
export const conteudoBau = (b) => b.filter(Boolean).map((p) => [...p]);
export const vazioBau = (b) => !b.some(Boolean);

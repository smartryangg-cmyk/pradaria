// Fornalha (como no clássico), regras puras: sem tela. O jogo sem internet e a sala online usam as mesmas.
// Três espaços: o que vai derreter/assar (e), o combustível (c) e o que ficou pronto (s).
// Cada coisa leva 10 s; o combustível queima um de cada vez (carvão dura 80 s = 8 coisas, tronco e tábuas 15 s,
// graveto 5 s). Só queima combustível quando tem o que fazer e lugar na saída. Sem fogo, o que estava pela
// metade volta para o começo.
// Ninguém precisa ficar olhando: o estado guarda a hora (t) e avancar() faz a conta do tempo que passou.
// Estado: { e: [id, n] | null, c: [id, n] | null, s: [id, n] | null, q (fogo que falta, s), Q (fogo do
//   combustível que está queimando, s: a barrinha da chama), p (progresso da coisa atual, s), t (ms) }
import { IDS as I, guardavel, FERRAMENTAS } from './receitas.js';

export const TEMPO_FORNO = 10; // segundos por coisa
export const PILHA_FORNO = 64;
// o que entra -> o que sai
export const FORNO_FAZ = {
  [I.FERRO_MINERIO]: I.BARRA_FERRO, [I.OURO_MINERIO]: I.BARRA_OURO,
  [I.AREIA]: I.VIDRO, [I.PEDRISCO]: I.PEDRA, [I.CARNE]: I.CARNE_ASSADA,
  [I.TRONCO]: I.CARVAO, 71: I.CARVAO, 73: I.CARVAO, 131: I.CARVAO, // carvão de madeira
  [I.FARINHA]: I.PAO,
};
// combustível: segundos de fogo
export const FOGO_DE = {
  [I.CARVAO]: 80, [I.CARVAO_MINERIO]: 80, [I.TRONCO]: 15, 71: 15, 73: 15, 131: 15, [I.TABUAS]: 15,
  [I.GRAVETO]: 5, [I.FENO]: 4, [I.BANCADA]: 15,
};
export const assavel = (id) => Object.prototype.hasOwnProperty.call(FORNO_FAZ, id);
export const queima = (id) => Object.prototype.hasOwnProperty.call(FOGO_DE, id);

export const fornoNovo = (agora = Date.now()) => ({ e: null, c: null, s: null, q: 0, Q: 0, p: 0, t: agora });
const pilhaOk = (v, teste) => Array.isArray(v) && v.length === 2 && Number.isInteger(v[0]) && guardavel(v[0]) && !FERRAMENTAS[v[0]]
  && Number.isInteger(v[1]) && v[1] >= 1 && v[1] <= PILHA_FORNO && (!teste || teste(v[0]));
// o que veio guardado (ou da rede) volta sempre certo
export function normalizarForno(o, agora = Date.now()) {
  const f = fornoNovo(agora);
  if (!o || typeof o !== 'object') return f;
  if (pilhaOk(o.e, assavel)) f.e = [o.e[0], o.e[1]];
  if (pilhaOk(o.c, queima)) f.c = [o.c[0], o.c[1]];
  if (pilhaOk(o.s)) f.s = [o.s[0], o.s[1]];
  const num = (v, a, b) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a);
  f.Q = num(o.Q, 0, 80); f.q = num(o.q, 0, f.Q); f.p = num(o.p, 0, TEMPO_FORNO);
  f.t = Number.isFinite(o.t) ? Math.min(o.t, agora) : agora;
  return f;
}

// dá para fazer a próxima coisa? (tem entrada e a saída aceita)
function podeFazer(f) {
  if (!f.e) return false;
  const sai = FORNO_FAZ[f.e[0]];
  return !f.s || (f.s[0] === sai && f.s[1] < PILHA_FORNO);
}
const tirar1 = (f, k) => { f[k][1]--; if (!f[k][1]) f[k] = null; };

// faz a conta do tempo que passou até `agora`. Devolve quantas coisas ficaram prontas.
export function avancar(f, agora = Date.now()) {
  let dt = Math.max(0, Math.min(3 * 86400, (agora - f.t) / 1000));
  f.t = agora;
  let feitas = 0;
  while (dt > 1e-9) {
    if (!podeFazer(f)) { f.q = Math.max(0, f.q - dt); f.p = 0; break; }
    if (f.q <= 1e-9) {
      if (!f.c) { f.q = 0; f.p = 0; break; }
      f.Q = f.q = FOGO_DE[f.c[0]]; tirar1(f, 'c');
    }
    const passo = Math.min(dt, f.q, TEMPO_FORNO - f.p);
    f.p += passo; f.q -= passo; dt -= passo;
    if (f.p >= TEMPO_FORNO - 1e-9) {
      const sai = FORNO_FAZ[f.e[0]];
      tirar1(f, 'e');
      f.s = f.s ? [sai, f.s[1] + 1] : [sai, 1];
      f.p = 0; feitas++;
    }
  }
  if (f.q <= 1e-9) { f.q = 0; f.Q = 0; }
  return feitas;
}
export const acesa = (f) => f.q > 0;

// pôr na fornalha (k = 'e' entrada ou 'c' combustível): devolve quantos entraram
export function caberNoForno(f, k, id, n) {
  if (k !== 'e' && k !== 'c') return 0;
  if (k === 'e' ? !assavel(id) : !queima(id)) return 0;
  if (f[k] && f[k][0] !== id) return 0;
  return Math.max(0, Math.min(n, PILHA_FORNO - (f[k] ? f[k][1] : 0)));
}
export function porNoForno(f, k, id, n) {
  const q = caberNoForno(f, k, id, n);
  if (q > 0) f[k] = f[k] ? [id, f[k][1] + q] : [id, q];
  return q;
}
// tirar da fornalha: devolve [id, n] tirados (até `n`)
export function tirarDoForno(f, k, n = PILHA_FORNO) {
  if (!['e', 'c', 's'].includes(k) || !f[k]) return null;
  const q = Math.max(0, Math.min(n, f[k][1]));
  if (!q) return null;
  const id = f[k][0];
  f[k][1] -= q; if (!f[k][1]) f[k] = null;
  if (k === 'e' && !f.e) f.p = 0;
  return [id, q];
}
// tudo o que tem dentro (quebrou a fornalha: cai no chão)
export const conteudo = (f) => ['e', 'c', 's'].map((k) => f[k]).filter(Boolean);
// como vai para a rede: com a idade em vez da hora (cada aparelho tem o seu relógio)
export const fornoPublico = (f, agora = Date.now()) => ({ e: f.e, c: f.c, s: f.s, q: Math.round(f.q * 100) / 100, Q: f.Q, p: Math.round(f.p * 100) / 100, idade: Math.max(0, agora - f.t) });
export const fornoDaRede = (o, agora = Date.now()) => normalizarForno({ ...o, t: agora - (Number(o && o.idade) || 0) }, agora);

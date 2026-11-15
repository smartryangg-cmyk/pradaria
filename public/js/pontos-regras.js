// Pontos (rating) dos jogos de tabuleiro: sistema Glicko. Cada jogador tem uma nota (r) e uma incerteza (rd):
// quem jogou pouco tem rd alto e a nota anda bastante a cada partida; com o tempo ela firma. Ganhar de quem tem
// mais pontos dá mais; perder para quem tem menos tira mais. Usado pelo servidor (sala-worker/src/pontos.js)
// e pela tela (para mostrar "1200?" enquanto a nota ainda não firmou).
export const INICIAL = { r: 1200, rd: 350, jogos: 0, v: 0, d: 0, e: 0, t: 0 };
export const RD_MIN = 45, RD_MAX = 350, RD_PROVISORIO = 110;
const Q = Math.LN10 / 400;
const g = (rd) => 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));
// chance de "a" ganhar de "b"
export const esperado = (a, b) => 1 / (1 + 10 ** ((-g(b.rd) * (a.r - b.r)) / 400));
// a incerteza volta a crescer quando a pessoa fica sem jogar (c = 35 por mês)
export function envelhecer(x, agora) {
  if (!x.t) return { ...x };
  const meses = Math.max(0, (agora - x.t) / (30 * 864e5));
  return { ...x, rd: Math.min(RD_MAX, Math.sqrt(x.rd * x.rd + 35 * 35 * meses)) };
}
// nota nova de "a" depois de uma partida contra "b" (s = 1 ganhou, 0.5 empate, 0 perdeu)
export function depois(a, b, s) {
  const gb = g(b.rd), E = esperado(a, b);
  const d2 = 1 / (Q * Q * gb * gb * E * (1 - E));
  const den = 1 / (a.rd * a.rd) + 1 / d2;
  const r = a.r + (Q / den) * gb * (s - E);
  const rd = Math.max(RD_MIN, Math.sqrt(1 / den));
  return { r: Math.round(r), rd: Math.round(rd * 10) / 10 };
}
// resultado de uma partida entre w e b (s = pontos das brancas): devolve as notas novas dos dois
export function partida(w, b, s, agora = Date.now()) {
  const W = envelhecer({ ...INICIAL, ...w }, agora), B = envelhecer({ ...INICIAL, ...b }, agora);
  const nw = depois(W, B, s), nb = depois(B, W, 1 - s);
  const conta = (x, n, res) => ({ ...x, ...n, jogos: x.jogos + 1, v: x.v + (res === 1 ? 1 : 0), d: x.d + (res === 0 ? 1 : 0), e: x.e + (res === 0.5 ? 1 : 0), t: agora });
  return { w: conta(W, nw, s), b: conta(B, nb, 1 - s) };
}
// categoria dos pontos pelo ritmo (cada ritmo tem a sua nota, como nos sites de xadrez)
export const CATEGORIAS = { '1+0': 'bullet', '3+2': 'blitz', '10+0': 'rapida', teste: 'bullet' };
// categoria de um ritmo (só as chaves da lista; qualquer outra coisa = null)
export const categoria = (r) => (typeof r === 'string' && Object.hasOwn(CATEGORIAS, r) ? CATEGORIAS[r] : null);
export const NOME_CATEGORIA = { bullet: 'Bullet', blitz: 'Blitz', rapida: 'Rápida' };
export const provisorio = (x) => !x || x.rd > RD_PROVISORIO;
export const mostrar = (x) => (x ? Math.round(x.r) : INICIAL.r) + (provisorio(x) ? '?' : '');
// busca de adversário: no começo só quem está perto (±150); a cada 3 s a janela abre mais 100 (até ±800),
// porque ainda tem pouca gente jogando ao mesmo tempo
export const janela = (esperaMs) => Math.min(800, 150 + 100 * Math.floor(esperaMs / 3000));

// Experiência (como no clássico), regras puras: sem tela. O jogo sem internet e a sala online usam as mesmas.
// Ganha experiência quem tira minério de carvão ou diamante (com a picareta certa), tira coisa pronta da fornalha
// e caça bicho. Os pontos enchem a barra verde e sobem o nível; cada nível pede mais pontos que o anterior.
// Morrer perde a experiência. O nível vai servir para encantar (a mesa de encantar).
// Estado na mochila (economia.js): e.xp = pontos inteiros, e.xpf = a fração que ainda não virou ponto.
export const MAX_XP = 1000000;

// pontos para passar do nível n para o n+1 (a mesma curva do clássico)
export const paraProximo = (n) => (n < 16 ? 2 * n + 7 : n < 31 ? 5 * n - 38 : 9 * n - 158);
// nível e quanto da barra está cheio
export function nivelDe(xp) {
  let n = 0, resto = Math.max(0, xp | 0);
  while (resto >= paraProximo(n)) { resto -= paraProximo(n); n++; }
  return { nivel: n, frac: resto / paraProximo(n), resto };
}

// minério natural tirado com a picareta certa: [mínimo, máximo] (sorteio pela posição: o jogo e a sala tiram igual)
export const XP_MINERIO = { 66: [0, 2], 69: [3, 7] };
// o que sai pronto da fornalha: pontos por coisa
export const XP_FORNO = { 1101: 0.7, 1102: 1, 9: 0.1, 3: 0.1, 1104: 0.35, 1100: 0.15, 58: 0.35 };
export const XP_CACA = 2;

const sorteio = (x, y, z) => (((Math.imul(x | 0, 2654435761) ^ Math.imul(y | 0, 40503) ^ Math.imul(z | 0, 2246822519)) >>> 0) % 1000) / 1000;
export function xpDoMinerio(b, x, y, z) {
  const f = XP_MINERIO[b];
  if (!f) return 0;
  return f[0] + Math.floor(sorteio(x, y, z) * (f[1] - f[0] + 1));
}

// soma pontos (a fração fica guardada até completar 1)
export function ganharXp(e, q) {
  if (!(q > 0)) return 0;
  e.xpf = (Number.isFinite(e.xpf) ? e.xpf : 0) + q;
  const inteiro = Math.floor(e.xpf + 1e-9);
  e.xpf = Math.max(0, e.xpf - inteiro);
  e.xp = Math.min(MAX_XP, (e.xp | 0) + inteiro);
  return inteiro;
}
export function normalizarXp(n, e) {
  n.xp = Math.max(0, Math.min(MAX_XP, (e && e.xp) | 0));
  n.xpf = e && Number.isFinite(e.xpf) ? Math.max(0, Math.min(0.999, e.xpf)) : 0;
}

// Regras da dama (jogo de damas, regras brasileiras), as mesmas no navegador e no servidor da partida:
// tabuleiro 8x8 nas casas escuras, brancas começam, peão anda 1 casa na diagonal para a frente e captura para a frente e para trás,
// captura é obrigatória e vale a "lei da maioria" (tem que pegar o caminho que come mais peças),
// dama anda e captura de longe (voa), peão vira dama só se terminar o lance na última fileira.
//
// Casas: índice = linha * 8 + coluna, linha 0 = em cima (lado das pretas). Peças: 'w' peão branco, 'W' dama branca, 'b', 'B' pretas.
// Lance: { caminho: [de, ..., para], comidas: [casas das peças comidas] }.

const corDe = (p) => (p ? (p.toLowerCase() === 'w' ? 'w' : 'b') : null);
const outra = (c) => (c === 'w' ? 'b' : 'w');
const dama = (p) => p === 'W' || p === 'B';
const dentro = (l, c) => l >= 0 && l < 8 && c >= 0 && c < 8;
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
export const escura = (i) => ((i >> 3) + (i & 7)) % 2 === 1;

export function novo() {
  const b = Array(64).fill('');
  for (let i = 0; i < 64; i++) if (escura(i)) { const l = i >> 3; if (l <= 2) b[i] = 'b'; else if (l >= 5) b[i] = 'w'; }
  const e = { b, vez: 'w', semComer: 0, n: 1, rep: {} };
  e.rep[chave(e)] = 1;
  return e;
}
export const chave = (e) => e.b.map((p) => p || '.').join('') + e.vez;

// todas as sequências de captura a partir de i (a peça continua no tabuleiro até o fim; não pode comer a mesma duas vezes)
function capturas(b, i, p, comidas, caminho, out) {
  const l = i >> 3, c = i & 7, eu = corDe(p);
  let achou = false;
  for (const [dl, dc] of DIRS) {
    if (dama(p)) {
      // voa até achar uma peça
      let L = l + dl, C = c + dc;
      while (dentro(L, C) && !b[L * 8 + C]) { L += dl; C += dc; }
      if (!dentro(L, C)) continue;
      const x = L * 8 + C;
      if (corDe(b[x]) === eu || comidas.includes(x)) continue;
      let L2 = L + dl, C2 = C + dc;
      while (dentro(L2, C2) && !b[L2 * 8 + C2]) {
        const y = L2 * 8 + C2;
        achou = true;
        capturas(b, y, p, [...comidas, x], [...caminho, y], out);
        L2 += dl; C2 += dc;
      }
    } else {
      const L = l + dl, C = c + dc, L2 = l + 2 * dl, C2 = c + 2 * dc;
      if (!dentro(L2, C2)) continue;
      const x = L * 8 + C, y = L2 * 8 + C2;
      if (!b[x] || corDe(b[x]) === eu || comidas.includes(x) || b[y]) continue;
      achou = true;
      capturas(b, y, p, [...comidas, x], [...caminho, y], out);
    }
  }
  if (!achou && comidas.length) out.push({ caminho, comidas });
}

export function lances(e) {
  const { b, vez } = e;
  const caps = [], simples = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || corDe(p) !== vez) continue;
    // durante a captura a casa de onde a peça saiu fica vazia (ela pode passar por ali de novo)
    const tb = b.slice(); tb[i] = '';
    capturas(tb, i, p, [], [i], caps);
    const l = i >> 3, c = i & 7;
    for (const [dl, dc] of DIRS) {
      if (dama(p)) {
        let L = l + dl, C = c + dc;
        while (dentro(L, C) && !b[L * 8 + C]) { simples.push({ caminho: [i, L * 8 + C], comidas: [] }); L += dl; C += dc; }
      } else {
        if (dl !== (vez === 'w' ? -1 : 1)) continue;
        const L = l + dl, C = c + dc;
        if (dentro(L, C) && !b[L * 8 + C]) simples.push({ caminho: [i, L * 8 + C], comidas: [] });
      }
    }
  }
  if (caps.length) { const max = Math.max(...caps.map((m) => m.comidas.length)); return caps.filter((m) => m.comidas.length === max); }
  return simples;
}

export function jogar(e, m) {
  const b = e.b.slice();
  const de = m.caminho[0], para = m.caminho[m.caminho.length - 1];
  let p = b[de];
  b[de] = '';
  for (const x of m.comidas) b[x] = '';
  const ult = corDe(p) === 'w' ? 0 : 7;
  if (!dama(p) && para >> 3 === ult) p = p.toUpperCase();
  b[para] = p;
  return { b, vez: outra(e.vez), semComer: m.comidas.length || !dama(e.b[de]) ? 0 : e.semComer + 1, n: e.n + (e.vez === 'b' ? 1 : 0), rep: e.rep };
}

// o lance pedido (caminho completo, ou só de/para quando não há dúvida) se for legal
export function validar(e, msg) {
  const ls = lances(e);
  if (Array.isArray(msg.caminho)) {
    const c = msg.caminho.map(Number).join(',');
    return ls.find((m) => m.caminho.join(',') === c) || null;
  }
  return ls.find((m) => m.caminho[0] === +msg.de && m.caminho[m.caminho.length - 1] === +msg.para) || null;
}

export function avancar(e, m) {
  const n = jogar(e, m);
  n.rep = { ...e.rep };
  const k = chave(n);
  n.rep[k] = (n.rep[k] || 0) + 1;
  n.ultimo = { caminho: m.caminho, comidas: m.comidas };
  return n;
}

export function fim(e) {
  if (!lances(e).length) return { tipo: 'semlance', vencedor: outra(e.vez) };
  if (e.semComer >= 40) return { tipo: 'empate20' }; // 20 lances de cada lado só com damas e sem comer
  if ((e.rep[chave(e)] || 0) >= 3) return { tipo: 'repeticao' };
  return null;
}
export const TEXTO_FIM = { semlance: 'Sem peças ou sem lances', empate20: 'Empate: 20 lances só com damas', repeticao: 'Empate: a mesma posição 3 vezes', desistiu: 'Desistiu', empate: 'Empate combinado' };

// ---------- computador ----------
function avaliar(e) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = e.b[i];
    if (!p) continue;
    const l = i >> 3, c = i & 7;
    let v = dama(p) ? 320 : 100 + (corDe(p) === 'w' ? 7 - l : l) * 4;
    if (!dama(p) && (c === 0 || c === 7)) v += 4; // na beirada não é comido
    if (!dama(p) && l === (corDe(p) === 'w' ? 7 : 0)) v += 6; // guardando a última fileira
    s += corDe(p) === 'w' ? v : -v;
  }
  return e.vez === 'w' ? s : -s;
}
function busca(e, prof, alfa, beta, conta) {
  const ls = lances(e);
  if (!ls.length) return -100000 - prof;
  if (++conta.n > conta.max || (prof <= 0 && !ls[0].comidas.length)) return avaliar(e);
  for (const m of ls) {
    const v = -busca(jogar(e, m), prof - 1, -beta, -alfa, conta);
    if (v >= beta) return beta;
    if (v > alfa) alfa = v;
  }
  return alfa;
}
export function melhorLance(e, nivel = 2, aleatorio = Math.random) {
  const ls = lances(e);
  if (!ls.length) return null;
  if (nivel <= 1 && aleatorio() < 0.3) return ls[Math.floor(aleatorio() * ls.length)];
  const prof = nivel <= 1 ? 2 : nivel === 2 ? 4 : 6;
  const conta = { n: 0, max: nivel >= 3 ? 80000 : 25000 };
  let melhor = null, nota = -Infinity;
  for (const m of ls) {
    const v = -busca(jogar(e, m), prof - 1, -Infinity, Infinity, conta) + aleatorio() * (nivel <= 1 ? 40 : 6);
    if (v > nota) { nota = v; melhor = m; }
  }
  return melhor;
}

export const publico = (e) => ({ b: e.b, vez: e.vez, semComer: e.semComer, n: e.n, ultimo: e.ultimo || null });
export function deJson(o) { return { b: o.b.slice(), vez: o.vez, semComer: o.semComer, n: o.n, rep: o.rep || {}, ultimo: o.ultimo || null }; }

// Regras do xadrez (as mesmas no navegador e no servidor da partida): lances legais, xeque, mate, empates
// e o computador (busca alfa-beta com tabela de posições). Sem nada de tela aqui.
//
// Tabuleiro: 64 casas, índice = linha * 8 + coluna; linha 0 = a fileira 8 (lado das pretas), coluna 0 = a coluna "a".
// Peças: 'P' peão, 'N' cavalo, 'B' bispo, 'R' torre, 'Q' dama, 'K' rei; maiúscula = brancas, minúscula = pretas, '' = vazia.

// ritmos de jogo com relógio (minutos + segundos ganhos a cada lance)
export const RITMOS = { '1+0': { nome: 'Bullet', base: 60000, inc: 0 }, '3+2': { nome: 'Blitz', base: 180000, inc: 2000 }, '10+0': { nome: 'Rápida', base: 600000, inc: 0 } };

export const INICIO = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const cor = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
const outra = (c) => (c === 'w' ? 'b' : 'w');
const lin = (i) => i >> 3, col = (i) => i & 7;
const dentro = (l, c) => l >= 0 && l < 8 && c >= 0 && c < 8;

export function novo() {
  const b = [];
  for (const ch of INICIO.replace(/\//g, '')) { if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) b.push(''); else b.push(ch); }
  const e = { b, vez: 'w', roque: 'KQkq', ep: -1, meio: 0, n: 1, rep: {} };
  e.rep[chave(e)] = 1;
  return e;
}
export function chave(e) { return e.b.map((p) => p || '.').join('') + e.vez + e.roque + e.ep; }
export const nomeCasa = (i) => 'abcdefgh'[col(i)] + (8 - lin(i));

const DIR_N = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const DIR_B = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const DIR_R = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIR_K = [...DIR_B, ...DIR_R];

// a casa i está sendo atacada por peças da cor "por"?
export function atacada(b, i, por) {
  const l = lin(i), c = col(i);
  // peão
  const dl = por === 'w' ? 1 : -1; // peão branco ataca para cima (linha menor), então ele está uma linha abaixo
  for (const dc of [-1, 1]) { const L = l + dl, C = c + dc; if (dentro(L, C) && b[L * 8 + C] === (por === 'w' ? 'P' : 'p')) return true; }
  for (const [a, d] of DIR_N) { const L = l + a, C = c + d; if (dentro(L, C) && b[L * 8 + C] === (por === 'w' ? 'N' : 'n')) return true; }
  for (const [a, d] of DIR_K) { const L = l + a, C = c + d; if (dentro(L, C) && b[L * 8 + C] === (por === 'w' ? 'K' : 'k')) return true; }
  const deslizar = (dirs, tipos) => {
    for (const [a, d] of dirs) {
      let L = l + a, C = c + d;
      while (dentro(L, C)) {
        const p = b[L * 8 + C];
        if (p) { if (cor(p) === por && tipos.includes(p.toUpperCase())) return true; break; }
        L += a; C += d;
      }
    }
    return false;
  };
  return deslizar(DIR_B, 'BQ') || deslizar(DIR_R, 'RQ');
}
const rei = (b, c) => b.indexOf(c === 'w' ? 'K' : 'k');
export const emXeque = (e, c = e.vez) => atacada(e.b, rei(e.b, c), outra(c));

// lances possíveis sem olhar se o próprio rei fica em xeque
function pseudo(e) {
  const { b, vez } = e, out = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || cor(p) !== vez) continue;
    const t = p.toUpperCase(), l = lin(i), c = col(i);
    if (t === 'P') {
      const d = vez === 'w' ? -1 : 1, ini = vez === 'w' ? 6 : 1, ult = vez === 'w' ? 0 : 7;
      const add = (para, x = {}) => { if (lin(para) === ult) for (const pr of 'QRBN') out.push({ de: i, para, promo: pr, ...x }); else out.push({ de: i, para, ...x }); };
      const f = (l + d) * 8 + c;
      if (dentro(l + d, c) && !b[f]) { add(f); const f2 = (l + 2 * d) * 8 + c; if (l === ini && !b[f2]) out.push({ de: i, para: f2, duplo: true }); }
      for (const dc of [-1, 1]) {
        if (!dentro(l + d, c + dc)) continue;
        const x = (l + d) * 8 + c + dc;
        if (b[x] && cor(b[x]) !== vez) add(x);
        else if (x === e.ep) out.push({ de: i, para: x, ep: true });
      }
    } else if (t === 'N' || t === 'K') {
      for (const [a, d] of t === 'N' ? DIR_N : DIR_K) {
        const L = l + a, C = c + d;
        if (!dentro(L, C)) continue;
        const x = L * 8 + C;
        if (!b[x] || cor(b[x]) !== vez) out.push({ de: i, para: x });
      }
      if (t === 'K') {
        const base = vez === 'w' ? 60 : 4, o = outra(vez);
        if (i === base && !atacada(b, i, o)) {
          const [rk, rq] = vez === 'w' ? ['K', 'Q'] : ['k', 'q'];
          if (e.roque.includes(rk) && !b[i + 1] && !b[i + 2] && b[i + 3] === (vez === 'w' ? 'R' : 'r') && !atacada(b, i + 1, o) && !atacada(b, i + 2, o)) out.push({ de: i, para: i + 2, roque: 'k' });
          if (e.roque.includes(rq) && !b[i - 1] && !b[i - 2] && !b[i - 3] && b[i - 4] === (vez === 'w' ? 'R' : 'r') && !atacada(b, i - 1, o) && !atacada(b, i - 2, o)) out.push({ de: i, para: i - 2, roque: 'q' });
        }
      }
    } else {
      const dirs = t === 'B' ? DIR_B : t === 'R' ? DIR_R : DIR_K;
      for (const [a, d] of dirs) {
        let L = l + a, C = c + d;
        while (dentro(L, C)) {
          const x = L * 8 + C;
          if (b[x]) { if (cor(b[x]) !== vez) out.push({ de: i, para: x }); break; }
          out.push({ de: i, para: x });
          L += a; C += d;
        }
      }
    }
  }
  return out;
}

// aplica o lance num tabuleiro (sem conferir), devolve o estado novo
export function jogar(e, m) {
  const b = e.b.slice();
  const p = b[m.de], vez = e.vez;
  const comeu = !!b[m.para] || !!m.ep;
  b[m.para] = m.promo ? (vez === 'w' ? m.promo : m.promo.toLowerCase()) : p;
  b[m.de] = '';
  if (m.ep) b[m.para + (vez === 'w' ? 8 : -8)] = '';
  if (m.roque === 'k') { b[m.para - 1] = b[m.para + 1]; b[m.para + 1] = ''; }
  if (m.roque === 'q') { b[m.para + 1] = b[m.para - 2]; b[m.para - 2] = ''; }
  let roque = e.roque;
  const tira = (s) => { roque = roque.replace(s, ''); };
  if (p === 'K') { tira('K'); tira('Q'); } if (p === 'k') { tira('k'); tira('q'); }
  for (const x of [m.de, m.para]) { if (x === 63) tira('K'); if (x === 56) tira('Q'); if (x === 7) tira('k'); if (x === 0) tira('q'); }
  const n = { b, vez: outra(vez), roque, ep: m.duplo ? (m.de + m.para) / 2 : -1, meio: p.toUpperCase() === 'P' || comeu ? 0 : e.meio + 1, n: e.n + (vez === 'b' ? 1 : 0), rep: e.rep };
  return n;
}

export function lances(e) {
  const out = [];
  for (const m of pseudo(e)) { const n = jogar(e, m); if (!atacada(n.b, rei(n.b, e.vez), n.vez)) out.push(m); }
  return out;
}

// o lance que o jogador pediu (de, para, promoção) se for legal; senão null
export function achar(e, de, para, promo) {
  const ls = lances(e).filter((m) => m.de === de && m.para === para);
  if (!ls.length) return null;
  if (ls[0].promo) return ls.find((m) => m.promo === (promo || 'Q').toUpperCase()) || null;
  return ls[0];
}

// o lance mandado pelo jogador (mensagem { de, para, promo }) se for legal: usado pelo servidor da partida
export const validar = (e, m) => achar(e, +m.de, +m.para, typeof m.promo === 'string' ? m.promo.slice(0, 1) : 'Q');

// joga de verdade (guarda as repetições de posição para o empate por repetição)
export function avancar(e, m) {
  const n = jogar(e, m);
  n.rep = { ...e.rep };
  const k = chave(n);
  n.rep[k] = (n.rep[k] || 0) + 1;
  n.ultimo = { de: m.de, para: m.para };
  n.hist = [...(e.hist || []), notacao(e, m)];
  return n;
}

// lance em notação (letras em português: R rei, D dama, T torre, B bispo, C cavalo; peão sem letra), com + e #
const LETRA = { K: 'R', Q: 'D', R: 'T', B: 'B', N: 'C' };
export function notacao(e, m) {
  const p = e.b[m.de].toUpperCase();
  let t;
  if (m.roque) t = m.roque === 'k' ? 'O-O' : 'O-O-O';
  else {
    const come = !!e.b[m.para] || !!m.ep;
    if (p === 'P') t = (come ? 'abcdefgh'[col(m.de)] + 'x' : '') + nomeCasa(m.para) + (m.promo ? '=' + LETRA[m.promo] : '');
    else {
      // se outra peça igual também chega na casa, diz a coluna (ou a fileira) de onde saiu
      const outras = lances(e).filter((x) => x.para === m.para && x.de !== m.de && e.b[x.de] === e.b[m.de]);
      let qual = '';
      if (outras.length) {
        if (!outras.some((x) => col(x.de) === col(m.de))) qual = 'abcdefgh'[col(m.de)];
        else if (!outras.some((x) => lin(x.de) === lin(m.de))) qual = String(8 - lin(m.de));
        else qual = nomeCasa(m.de);
      }
      t = LETRA[p] + qual + (come ? 'x' : '') + nomeCasa(m.para);
    }
  }
  const n = jogar(e, m);
  if (emXeque(n)) t += lances(n).length ? '+' : '#';
  return t;
}

// pré-lance: as casas aonde a peça poderia ir na próxima vez (pelo jeito de andar, sem olhar xeque),
// incluindo as diagonais do peão (para comer uma peça que pode chegar ali)
export function preLances(e, cor, de) {
  const p = e.b[de];
  if (!p || (p === p.toUpperCase() ? 'w' : 'b') !== cor) return [];
  const f = { ...e, vez: cor, ep: -1 };
  const out = pseudo(f).filter((m) => m.de === de).map((m) => ({ de, para: m.para, promo: m.promo ? 'Q' : undefined }));
  if (p.toUpperCase() === 'P') {
    const d = cor === 'w' ? -1 : 1, l = lin(de) + d, ult = cor === 'w' ? 0 : 7;
    for (const dc of [-1, 1]) { const c = col(de) + dc; if (dentro(l, c) && !out.some((m) => m.para === l * 8 + c) && (!e.b[l * 8 + c] || (e.b[l * 8 + c] === e.b[l * 8 + c].toUpperCase() ? 'w' : 'b') !== cor)) out.push({ de, para: l * 8 + c, promo: l === ult ? 'Q' : undefined }); }
  }
  const vistos = new Set();
  return out.filter((m) => !vistos.has(m.para) && vistos.add(m.para));
}

// acabou o tempo de alguém: o outro ganha, a não ser que só tenha o rei (ou rei e um bispo/cavalo) para dar mate
export function semMaterialParaMate(b, c) {
  const ps = b.filter((p) => p && (p === p.toUpperCase() ? 'w' : 'b') === c && p.toUpperCase() !== 'K');
  return !ps.length || (ps.length === 1 && 'BN'.includes(ps[0].toUpperCase()));
}

function materialInsuficiente(b) {
  const ps = b.filter((p) => p && p.toUpperCase() !== 'K');
  if (!ps.length) return true;
  if (ps.length === 1 && 'BN'.includes(ps[0].toUpperCase())) return true;
  return false;
}

// null = continua; senão { tipo, vencedor? }
export function fim(e) {
  const ls = lances(e);
  if (!ls.length) return emXeque(e) ? { tipo: 'mate', vencedor: outra(e.vez) } : { tipo: 'afogado' };
  if (materialInsuficiente(e.b)) return { tipo: 'material' };
  if (e.meio >= 100) return { tipo: '50' };
  if ((e.rep[chave(e)] || 0) >= 3) return { tipo: 'repeticao' };
  return null;
}
export const TEXTO_FIM = { mate: 'Xeque-mate', afogado: 'Empate: rei afogado', material: 'Empate: poucas peças', 50: 'Empate: 50 lances sem captura', repeticao: 'Empate: a mesma posição 3 vezes', desistiu: 'Desistiu', tempo: 'Acabou o tempo', 'tempo-empate': 'Empate: acabou o tempo, mas o outro não tinha peças para dar mate', saiu: 'O outro jogador saiu', empate: 'Empate combinado' };

// ---------- computador ----------
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
// tabelas de posição (do ponto de vista das brancas, linha 0 = fileira 8)
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
// nota da posição para quem joga agora
function avaliar(e) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = e.b[i];
    if (!p) continue;
    const t = p.toUpperCase();
    const v = VAL[t] + PST[t][cor(p) === 'w' ? i : (7 - lin(i)) * 8 + col(i)];
    s += cor(p) === 'w' ? v : -v;
  }
  return e.vez === 'w' ? s : -s;
}
const ordem = (e, ls) => ls.map((m) => ({ m, k: (e.b[m.para] ? VAL[e.b[m.para].toUpperCase()] * 10 - VAL[e.b[m.de].toUpperCase()] : 0) + (m.promo ? 800 : 0) })).sort((a, b) => b.k - a.k).map((x) => x.m);

function busca(e, prof, alfa, beta, conta) {
  if (++conta.n > conta.max) return avaliar(e);
  const ls = lances(e);
  if (!ls.length) return emXeque(e) ? -100000 - prof : 0;
  if (prof <= 0) {
    // só capturas para não parar no meio de uma troca
    let parado = avaliar(e);
    if (parado >= beta) return beta;
    if (parado > alfa) alfa = parado;
    for (const m of ordem(e, ls.filter((x) => e.b[x.para] || x.ep || x.promo))) {
      if (prof < -3) break;
      const v = -busca(jogar(e, m), prof - 1, -beta, -alfa, conta);
      if (v >= beta) return beta;
      if (v > alfa) alfa = v;
    }
    return alfa;
  }
  for (const m of ordem(e, ls)) {
    const v = -busca(jogar(e, m), prof - 1, -beta, -alfa, conta);
    if (v >= beta) return beta;
    if (v > alfa) alfa = v;
  }
  return alfa;
}

// nivel: 1 fácil (erra às vezes), 2 médio, 3 difícil. aleatorio: função 0..1 (para testes)
export function melhorLance(e, nivel = 2, aleatorio = Math.random) {
  const ls = lances(e);
  if (!ls.length) return null;
  if (nivel <= 1 && aleatorio() < 0.3) return ls[Math.floor(aleatorio() * ls.length)];
  const prof = nivel <= 1 ? 1 : nivel === 2 ? 2 : 3;
  const conta = { n: 0, max: nivel >= 3 ? 60000 : 20000 };
  let melhor = [], nota = -Infinity;
  for (const m of ordem(e, ls)) {
    // janela inteira na raiz: o valor de cada lance é exato, então o "tempero" aleatório não engana a escolha
    const v = -busca(jogar(e, m), prof - 1, -Infinity, Infinity, conta) + aleatorio() * (nivel <= 1 ? 60 : 8);
    if (v > nota) { nota = v; melhor = [m]; }
  }
  return melhor[0];
}

// estado em JSON (servidor -> navegador)
export const publico = (e) => ({ b: e.b, vez: e.vez, roque: e.roque, ep: e.ep, meio: e.meio, n: e.n, ultimo: e.ultimo || null, hist: e.hist || [] });
export function deJson(o) { return { b: o.b.slice(), vez: o.vez, roque: o.roque, ep: o.ep, meio: o.meio, n: o.n, rep: o.rep || {}, ultimo: o.ultimo || null, hist: Array.isArray(o.hist) ? o.hist.slice() : [] }; }

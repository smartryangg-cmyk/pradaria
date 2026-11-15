// gera problemas de xadrez a partir de partidas do próprio computador (posições originais)
import * as X from '../public/js/xadrez-regras.js';
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const vistos = new Set(), out = [];
const chaveB = (e) => e.b.map((p) => p || '.').join('') + e.vez;
function mateEm1(e) { return X.lances(e).filter((m) => { const n = X.jogar(e, m); return X.emXeque(n) && X.lances(n).length === 0; }); }
for (let jogo = 0; jogo < 400 && out.length < 150; jogo++) {
  let e = X.novo();
  for (let k = 0; k < 120; k++) {
    if (X.fim(e)) break;
    if (k >= 10) {
      const ns = X.notasDosLances(e, 2, 3000);
      const m1 = mateEm1(e);
      let tipo = null, sol = null;
      if (m1.length === 1) { tipo = 'mate1'; sol = m1[0]; }
      else if (ns.length >= 3 && ns[0].v >= 280 && ns[0].v - ns[1].v >= 250 && ns[0].v < 1900 && !m1.length) {
        // ganha material: confere com busca mais funda
        const fundo = X.notasDosLances(e, 3, 20000);
        if (fundo[0].m.de === ns[0].m.de && fundo[0].m.para === ns[0].m.para && fundo[0].v - fundo[1].v >= 250 && fundo[0].v >= 280) { tipo = 'tatica'; sol = ns[0].m; }
      }
      if (tipo && !vistos.has(chaveB(e))) {
        vistos.add(chaveB(e));
        // resposta do adversário e continuação (2 lances do jogador quando for tática)
        const linha = [X.notacao(e, sol)];
        out.push({ tipo, b: e.b.map((p) => p || '.').join(''), vez: e.vez, roque: e.roque, ep: e.ep, linha, v: ns[0].v });
      }
    }
    const nivel = rnd() < 0.5 ? 1 : 2;
    const m = X.melhorLance(e, nivel, rnd);
    if (!m) break;
    e = X.avancar(e, m);
  }
}
console.error('total', out.length, 'mate1', out.filter((p) => p.tipo === 'mate1').length);
console.log(JSON.stringify(out));

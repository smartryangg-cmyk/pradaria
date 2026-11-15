// Segundo passo: confere cada problema com uma busca mais funda, guarda os lances que também valem e dá a dificuldade.
// Uso: node testes/gerar-problemas.mjs > /tmp/s5/problemas.json && node testes/afinar-problemas.mjs (escreve /tmp/s5/final.json)
import * as X from '../public/js/xadrez-regras.js';
import fs from 'fs';
const ps = JSON.parse(fs.readFileSync('/tmp/s5/problemas.json', 'utf8'));
const VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
const out = [];
for (const [k, p] of ps.entries()) {
  const e = { b: p.b.split('').map((c) => (c === '.' ? '' : c)), vez: p.vez, roque: p.roque, ep: p.ep, meio: 0, n: 20, rep: {}, hist: [] };
  const fundo = X.notasDosLances(e, 3, 20000);
  const melhor = fundo[0];
  const sol = X.notacao(e, melhor.m);
  let aceitos;
  if (p.tipo === 'mate1') aceitos = [p.linha[0]];
  else {
    if (melhor.v < 250 || fundo[1].v > melhor.v - 200) continue; // não é claro: fora
    aceitos = fundo.filter((x) => x.v >= melhor.v - 60).map((x) => X.notacao(e, x.m));
  }
  // dificuldade: mate em 1 ~700; capturar peça solta ~600; outro lance que ganha material ~1100 (+ pelo valor)
  const capt = e.b[melhor.m.para];
  let r;
  if (p.tipo === 'mate1') r = 650 + Math.min(300, X.lances(e).length * 6);
  else if (capt) r = 500 + VAL[capt.toUpperCase()] * 40;
  else r = 1000 + Math.min(300, Math.round(melhor.v / 4));
  out.push({ id: 'p' + (k + 1), b: p.b, vez: p.vez, roque: p.roque, ep: p.ep, tipo: p.tipo, r, sol: p.tipo === 'mate1' ? p.linha[0] : sol, ok: aceitos });
}
console.error('ficaram', out.length, 'mate1', out.filter((x) => x.tipo === 'mate1').length, 'sem captura', out.filter((x) => x.r >= 1000).length);
fs.writeFileSync('/tmp/s5/final.json', JSON.stringify(out));

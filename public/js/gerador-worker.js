// Worker que gera o terreno pesado do mundo clássico (relevo, cavernas e minérios) fora da tela,
// para o jogo não engasgar enquanto você anda. A decoração e as vilas são feitas na página.
import { criarGerador } from './gerador.js';

let gen = null, serie = 0;
self.onmessage = (e) => {
  const m = e.data;
  if (m.t === 'config') { gen = criarGerador(m.semente, m.alt, m.limite); serie = m.serie; return; }
  if (m.t !== 'pedaco' || !gen || m.serie !== serie) return;
  const r = gen.terreno(m.cx, m.cz);
  self.postMessage({ serie, cx: m.cx, cz: m.cz, dados: r.dados, alturas: r.alturas, biomas: r.biomas },
    [r.dados.buffer, r.alturas.buffer, r.biomas.buffer]);
};

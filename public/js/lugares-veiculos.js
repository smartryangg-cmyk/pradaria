// Onde ficam os postos (abastecer, carregar e consertar) e os veículos que já moram no mundo:
// carros no fim das ruas das vilas, barcos na água perto delas, e na Ilha de Aventura ônibus nas cidades,
// barcos no cais do porto, trator na fazenda, caminhão no pátio. Tudo sai da semente, então todos os
// jogadores veem as mesmas coisas; cada um aparece uma vez só por mundo (chave "k").
import { hash3 } from './ruido.js';

// tipos que moram em cada estilo de vila (vilas.js) e a cor de cada um sai da semente
const DA_VILA = {
  campo: ['trator', 'carro'], tijolo: ['carro', 'onibus'], praia: ['bicicleta', 'jipe'],
  deserto: ['jipe', 'quadriciclo'], neve: ['jipe', 'moto'], serra: ['moto', 'quadriciclo'],
};
const DO_LUGAR = { cidade: ['onibus', 'carro', 'esportivo'], vila: ['bicicleta', 'moto'], fazenda: ['trator'], patio: ['caminhao'], fabrica: ['caminhao'], acampamento: ['quadriciclo'] };

export class LugaresVeiculos {
  constructor(mundo) {
    this.m = mundo;
    this.cache = new Map(); // vila/lugar -> { postos, parados }
  }

  // postos e veículos a até `dist` blocos de (x, z)
  perto(x, z, dist) {
    const postos = [], parados = [];
    const juntar = (r) => { postos.push(...r.postos); parados.push(...r.parados); };
    for (const v of this.m.vilas.perto(x, z, dist)) juntar(this.daVila(v));
    const A = this.m.aventura;
    if (A) for (const L of A.lugares) if (Math.hypot(L.x - x, L.z - z) < dist + L.r) juntar(this.doLugar(L));
    return { postos, parados };
  }

  cor(k) { let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 8; }

  // ---------- vilas ----------
  daVila(v) {
    const k = 'v' + v.x + ',' + v.z;
    if (this.cache.has(k)) return this.cache.get(k);
    const C = { x: v.x, z: v.z };
    const pt = (r, t, p) => [C.x + r.dx * t - r.dz * p + 0.5, C.z + r.dz * t + r.dx * p + 0.5];
    const yawDe = (dx, dz) => Math.atan2(-dx, -dz); // frente do veículo virada para (dx, dz)
    const out = { postos: [], parados: [] };
    const ruas = v.ruas;
    // posto no fim da primeira rua (a rua chega nele)
    if (ruas[0]) { const [px, pz] = pt(ruas[0], 4 + ruas[0].L + 4, 0); out.postos.push({ k: k + 'p', x: px, z: pz, yaw: yawDe(ruas[0].dx, ruas[0].dz) }); }
    // um ou dois veículos estacionados no fim das outras ruas, virados para a praça
    const tipos = DA_VILA[v.estilo] || DA_VILA.campo;
    ruas.slice(1, 3).forEach((r, i) => {
      const [px, pz] = pt(r, 4 + r.L + 3, 0);
      const tipo = tipos[i % tipos.length];
      out.parados.push({ k: k + 'c' + i, tipo, cor: this.cor(k + i), x: px, z: pz, yaw: yawDe(-r.dx, -r.dz) });
    });
    // barco: na água mais perto da vila (rio, lago ou mar)
    const b = this.agua(C.x, C.z, v.raio + 3, v.raio + 34, k);
    if (b) out.parados.push({ k: k + 'b', tipo: 'barco', cor: this.cor(k + 'b'), x: b.x, z: b.z, yaw: b.yaw, agua: true });
    this.cache.set(k, out);
    return out;
  }

  // ponto de água funda (2+ blocos) entre r0 e r1 do centro, com espaço para o barco
  agua(cx, cz, r0, r1, sem) {
    const N = this.m.nivelAgua;
    const fundo = (x, z) => this.m.alturaEm(Math.floor(x), Math.floor(z)) <= N - 2;
    const a0 = hash3(Math.floor(cx), 7, Math.floor(cz), this.m.semente + (sem ? sem.length : 0)) * Math.PI * 2;
    for (let r = r0; r <= r1; r += 3) {
      for (let i = 0; i < 16; i++) {
        const a = a0 + (i * Math.PI * 2) / 16;
        const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        if (!fundo(x, z)) continue;
        // barco ao longo da margem: procura a direção em que cabe (4,4 blocos de comprimento)
        for (const [dx, dz] of [[-Math.sin(a), Math.cos(a)], [Math.cos(a), Math.sin(a)]]) {
          if (fundo(x + dx * 2.6, z + dz * 2.6) && fundo(x - dx * 2.6, z - dz * 2.6) && fundo(x + dz * 1.4, z - dx * 1.4) && fundo(x - dz * 1.4, z + dx * 1.4)) {
            return { x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5, yaw: Math.atan2(-dx, -dz) };
          }
        }
      }
    }
    return null;
  }

  // ---------- Ilha de Aventura ----------
  doLugar(L) {
    const k = 'a' + Math.round(L.x) + ',' + Math.round(L.z);
    if (this.cache.has(k)) return this.cache.get(k);
    const A = this.m.aventura;
    const out = { postos: [], parados: [] };
    // estradas que saem deste lugar: direção de saída
    const saidas = A.estradas.filter((s) => s.la === L || s.lb === L).map((s) => {
      const o = s.la === L ? s.b : s.a, d = Math.hypot(o.x - L.x, o.z - L.z) || 1;
      return { dx: (o.x - L.x) / d, dz: (o.z - L.z) / d };
    });
    const naSaida = (s, t, lado) => [L.x + s.dx * t - s.dz * lado, L.z + s.dz * t + s.dx * lado];
    if (L.tipo === 'cidade' || L.tipo === 'porto' || (L.tipo === 'vila' && saidas.length)) {
      const s = saidas[0];
      if (s) { const [x, z] = naSaida(s, L.r * (L.q ? 1.42 : 1) + 6, 6); out.postos.push({ k: k + 'p', x, z, yaw: Math.atan2(-s.dx, -s.dz) }); }
    }
    const tipos = DO_LUGAR[L.tipo];
    if (tipos) {
      saidas.slice(0, 3).forEach((s, i) => {
        const tipo = tipos[i % tipos.length];
        const [x, z] = naSaida(s, L.r * (L.q ? 1.42 : 1) + 10 + i * 2, 1.4);
        out.parados.push({ k: k + 'c' + i, tipo, cor: this.cor(k + i), x, z, yaw: Math.atan2(s.dx, s.dz) }); // virado para o lugar
      });
    }
    // porto: barcos dos dois lados do cais
    if (L.tipo === 'porto') {
      const cais = (L.pecas || []).find((p) => p.tipo === 'cais');
      if (cais) for (const [t, w, i] of [[16, 5, 0], [26, -5, 1], [34, 5, 2]]) {
        const x = cais.x + cais.dx * t - cais.dz * w + 0.5, z = cais.z + cais.dz * t + cais.dx * w + 0.5;
        out.parados.push({ k: k + 'b' + i, tipo: 'barco', cor: this.cor(k + 'b' + i), x, z, yaw: Math.atan2(-cais.dx, -cais.dz), agua: true });
      }
    }
    this.cache.set(k, out);
    return out;
  }
}

// Engenharia: energia que corre pelos fios, de alavancas, botões e sensores até as máquinas.
//
// Como funciona (pensado para ficar igual em todos os aparelhos do mundo online):
//  * Só o que o jogador mexe é salvo e vai pela rede: colocar/tirar peças, ligar a alavanca,
//    apertar o botão, pisar na placa.
//  * O resto (fio aceso, lâmpada acesa, portão aberto...) cada aparelho calcula sozinho,
//    olhando os blocos. Mesmo mundo => mesmo resultado.
//  * Tudo que é elétrico e encosta conduz: fio, lâmpada, portão, ventilador, sino e confete.
//    Um grupo de peças encostadas fica ligado se alguma fonte ligada encostar nele.
import { E, ESTEIRA_DIRS, BLOCOS, OPACO, SOLIDO, BRILHO, uvTile } from './blocos.js';
const ALT_MAX = 96; // altura do mundo (igual a ALT de mundo.js)

// pares desligado -> ligado
const PARES = [
  [E.FIO, E.FIO_LIGADO], [E.ALAVANCA, E.ALAVANCA_LIGADA], [E.BOTAO, E.BOTAO_LIGADO], [E.PLACA, E.PLACA_LIGADA],
  [E.LAMPADA, E.LAMPADA_LIGADA], [E.PORTAO, E.PORTAO_ABERTO], [E.VENTILADOR, E.VENTILADOR_LIGADO],
  [E.SINO, E.SINO_LIGADO], [E.CONFETE, E.CONFETE_LIGADO], [E.SENSOR, E.SENSOR_LIGADO], [E.PISCA, E.PISCA_LIGADO],
];
export const BASE = new Uint8Array(256);
export const LIGADO = new Uint8Array(256);
export const ESTA_LIGADO = new Uint8Array(256);
for (let i = 0; i < 256; i++) BASE[i] = i;
for (const [d, l] of PARES) { BASE[l] = d; LIGADO[d] = l; LIGADO[l] = l; ESTA_LIGADO[l] = 1; }
// conduz energia (e liga quando recebe)
export const CONDUZ = new Uint8Array(256);
for (const b of [E.FIO, E.LAMPADA, E.PORTAO, E.VENTILADOR, E.SINO, E.CONFETE]) { CONDUZ[b] = 1; CONDUZ[LIGADO[b]] = 1; }
// fontes de energia
export const FONTE = new Uint8Array(256);
for (const b of [E.ALAVANCA, E.BOTAO, E.PLACA, E.SENSOR, E.PISCA]) { FONTE[b] = 1; FONTE[LIGADO[b]] = 1; }
// fontes que mudam sozinhas com o tempo (calculadas em cada aparelho)
const DO_TEMPO = new Uint8Array(256);
for (const b of [E.SENSOR, E.PISCA]) { DO_TEMPO[b] = 1; DO_TEMPO[LIGADO[b]] = 1; }
// máquinas que precisam de energia (para a dica)
export const PRECISA_ENERGIA = new Set([E.LAMPADA, E.PORTAO, E.VENTILADOR, E.SINO, E.CONFETE]);
export const ehEsteira = (b) => b >= E.ESTEIRA && b < E.ESTEIRA + 4;
export const ELETRICO = (b) => CONDUZ[b] || FONTE[b];

const V6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const TICK = 100; // ms
const MAX_GRUPO = 2000; // peças por grupo (proteção)
const PISCA_MS = 800;

const k3 = (x, y, z) => x + ',' + y + ',' + z;

export class Energia {
  constructor(mundo) {
    this.m = mundo;
    this.fila = new Map(); // "x,y,z" -> silencioso
    this.relogio = new Map(); // fontes do tempo: "x,y,z" -> [x,y,z]
    this.noite = false;
    this.ultimo = 0;
    this.aoEvento = null; // (tipo, x, y, z) quando um sino toca ou o confete dispara
  }

  // algo mudou em x,y,z: recalcular a energia em volta no próximo passo
  agendar(x, y, z, silencioso = false) {
    const k = k3(x, y, z);
    if (!this.fila.has(k) || !silencioso) this.fila.set(k, silencioso);
  }

  // muda o estado visível sem salvar (cada aparelho calcula o mesmo)
  definirDerivado(x, y, z, b) {
    const m = this.m;
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16);
    const c = m.chunks.get(cx + ',' + cz);
    if (!c) return;
    const lx = x - cx * 16, lz = z - cz * 16;
    c.dados[lx + lz * 16 + y * 256] = b;
    m.marcarSujo(cx, cz);
    if (lx === 0) m.marcarSujo(cx - 1, cz);
    if (lx === 15) m.marcarSujo(cx + 1, cz);
    if (lz === 0) m.marcarSujo(cx, cz - 1);
    if (lz === 15) m.marcarSujo(cx, cz + 1);
  }

  carregado(x, z) { return this.m.chunks.has(Math.floor(x / 16) + ',' + Math.floor(z / 16)); }

  atualizar(agora = performance.now()) {
    if (agora - this.ultimo < TICK) return;
    this.ultimo = agora;
    const m = this.m;
    // 1) sensores de noite e pisca-piscas
    const piscaAceso = Math.floor(Date.now() / PISCA_MS) % 2 === 0;
    for (const [k, [x, y, z]] of this.relogio) {
      if (!this.carregado(x, z)) continue;
      const b = m.bloco(x, y, z);
      if (!DO_TEMPO[b]) { this.relogio.delete(k); continue; }
      const quer = BASE[b] === E.SENSOR ? this.noite : piscaAceso;
      const alvo = quer ? LIGADO[BASE[b]] : BASE[b];
      if (alvo !== b) { this.definirDerivado(x, y, z, alvo); this.agendar(x, y, z); }
    }
    // 2) recalcula os grupos de peças perto do que mudou
    if (!this.fila.size) return;
    const fila = this.fila;
    this.fila = new Map();
    const visto = new Set();
    for (const [k, silencioso] of fila) {
      const [x, y, z] = k.split(',').map(Number);
      if (y < 1 || y >= ALT_MAX || !this.carregado(x, z)) continue;
      const b = m.bloco(x, y, z);
      if (DO_TEMPO[b]) this.relogio.set(k, [x, y, z]);
      // sementes: a própria peça e as vizinhas (inclusive fio subindo/descendo degrau)
      const sementes = [[x, y, z]];
      for (const [dx, dy, dz] of V6) sementes.push([x + dx, y + dy, z + dz]);
      for (const [dx, dz] of H4) { sementes.push([x + dx, y + 1, z + dz]); sementes.push([x + dx, y - 1, z + dz]); }
      for (const [sx, sy, sz] of sementes) {
        const sk = k3(sx, sy, sz);
        if (visto.has(sk) || sy < 1 || sy >= ALT_MAX || !CONDUZ[m.bloco(sx, sy, sz)]) continue;
        this.resolverGrupo(sx, sy, sz, visto, silencioso);
      }
    }
  }

  // acha todas as peças encostadas e liga ou desliga todas juntas
  resolverGrupo(x0, y0, z0, visto, silencioso) {
    const m = this.m;
    const grupo = [];
    const pilha = [[x0, y0, z0]];
    visto.add(k3(x0, y0, z0));
    let energia = false;
    while (pilha.length && grupo.length < MAX_GRUPO) {
      const [x, y, z] = pilha.pop();
      const b = m.bloco(x, y, z);
      grupo.push([x, y, z, b]);
      const viz = V6.map(([dx, dy, dz]) => [x + dx, y + dy, z + dz]);
      // fio sobe e desce degraus
      if (BASE[b] === E.FIO) for (const [dx, dz] of H4) { viz.push([x + dx, y + 1, z + dz]); viz.push([x + dx, y - 1, z + dz]); }
      for (const [nx, ny, nz] of viz) {
        if (ny < 1 || ny >= ALT_MAX) continue;
        const nb = m.bloco(nx, ny, nz);
        if (FONTE[nb] && ESTA_LIGADO[nb]) energia = true;
        if (!CONDUZ[nb]) continue;
        // degrau: só fio com fio
        if (ny !== y && nx !== x || ny !== y && nz !== z) { if (BASE[nb] !== E.FIO || BASE[b] !== E.FIO) continue; }
        const nk = k3(nx, ny, nz);
        if (visto.has(nk)) continue;
        visto.add(nk);
        pilha.push([nx, ny, nz]);
      }
    }
    for (const [x, y, z, b] of grupo) {
      const alvo = energia ? LIGADO[BASE[b]] : BASE[b];
      if (alvo === b) continue;
      this.definirDerivado(x, y, z, alvo);
      if (energia && !silencioso && this.aoEvento && (BASE[b] === E.SINO || BASE[b] === E.CONFETE)) this.aoEvento(BASE[b], x, y, z);
    }
  }
}

// ---------- desenho das peças que não são cubos ----------
// A: arrays do gerador de malha { P, U, C, I, N, O, L }
function caixa(A, get, x, y, z, x0, y0, z0, x1, y1, z1, tile, luz, girarTopo = 0, tileTopo = tile) {
  const faces = [
    { n: [1, 0, 0], c: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], borda: x1 >= 1 },
    { n: [-1, 0, 0], c: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], borda: x0 <= 0 },
    { n: [0, 1, 0], c: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], borda: y1 >= 1, topo: true },
    { n: [0, -1, 0], c: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], borda: y0 <= 0 },
    { n: [0, 0, 1], c: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], borda: z1 >= 1 },
    { n: [0, 0, -1], c: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], borda: z0 <= 0 },
  ];
  for (const f of faces) {
    if (f.borda && OPACO[get(x + f.n[0], y + f.n[1], z + f.n[2])]) continue;
    const [u0, v0, u1, v1] = uvTile(f.topo ? tileTopo : tile);
    const k = A.P.length / 3;
    for (const c of f.c) {
      A.P.push(x + c[0], y + c[1], z + c[2]);
      A.C.push(1, 1, 1); A.N.push(f.n[0], f.n[1], f.n[2]); A.O.push(0); A.L.push(luz);
    }
    const q = [u0, v0, u1, v0, u1, v1, u0, v1];
    const r = f.topo ? girarTopo : 0;
    for (let i = 0; i < 4; i++) { const j = (i + r) % 4; A.U.push(q[j * 2], q[j * 2 + 1]); }
    A.I.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
}

// o fio liga visualmente com estas peças
const ligaFio = (b) => ELETRICO(b);
// esteira: quantos quartos de volta girar a seta do topo (a seta da arte aponta para -z)
const GIRO_ESTEIRA = [1, 2, 3, 0];

export function desenharForma(A, get, x, y, z, b) {
  const def = BLOCOS[b];
  const luz = BRILHO[b];
  const f = def.forma;
  if (f === 'fio') {
    const t = def.tiles[0], h = 0.0625;
    caixa(A, get, x, y, z, 0.375, 0, 0.375, 0.625, h, 0.625, t, luz);
    for (const [dx, dz] of H4) {
      const nb = get(x + dx, y, z + dz);
      const sobe = !OPACO[get(x, y + 1, z)] && BASE[get(x + dx, y + 1, z + dz)] === E.FIO;
      const desce = !SOLIDO[nb] && BASE[get(x + dx, y - 1, z + dz)] === E.FIO;
      if (!ligaFio(nb) && !sobe && !desce) continue;
      // braço até a borda
      const xa = dx > 0 ? 0.625 : dx < 0 ? 0 : 0.4, xb = dx > 0 ? 1 : dx < 0 ? 0.375 : 0.6;
      const za = dz > 0 ? 0.625 : dz < 0 ? 0 : 0.4, zb = dz > 0 ? 1 : dz < 0 ? 0.375 : 0.6;
      caixa(A, get, x, y, z, xa, 0, za, xb, h, zb, t, luz);
      // subindo na parede do bloco vizinho
      if (sobe) {
        const e = 0.06;
        const sx0 = dx > 0 ? 1 - e : dx < 0 ? 0 : 0.4, sx1 = dx > 0 ? 1 : dx < 0 ? e : 0.6;
        const sz0 = dz > 0 ? 1 - e : dz < 0 ? 0 : 0.4, sz1 = dz > 0 ? 1 : dz < 0 ? e : 0.6;
        caixa(A, get, x, y, z, sx0, 0, sz0, sx1, 1, sz1, t, luz);
      }
    }
  } else if (f === 'alavanca') {
    const lig = b === E.ALAVANCA_LIGADA;
    caixa(A, get, x, y, z, 0.28, 0, 0.22, 0.72, 0.14, 0.78, def.tiles[1], 0);
    // a haste deita para um lado ou para o outro
    const za = lig ? 0.56 : 0.34;
    caixa(A, get, x, y, z, 0.45, 0.12, za, 0.55, 0.36, za + 0.1, def.tiles[2], 0);
    const zb = lig ? 0.64 : 0.26;
    caixa(A, get, x, y, z, 0.45, 0.34, zb, 0.55, 0.56, zb + 0.1, def.tiles[2], 0);
    caixa(A, get, x, y, z, 0.41, 0.54, zb - 0.04, 0.59, 0.7, zb + 0.14, def.tiles[0], luz);
  } else if (f === 'botao') {
    caixa(A, get, x, y, z, 0.25, 0, 0.25, 0.75, 0.05, 0.75, 55, 0);
    caixa(A, get, x, y, z, 0.33, 0.05, 0.33, 0.67, b === E.BOTAO_LIGADO ? 0.09 : 0.18, 0.67, def.tiles[0], luz);
  } else if (f === 'placa') {
    caixa(A, get, x, y, z, 0.06, 0, 0.06, 0.94, b === E.PLACA_LIGADA ? 0.03 : 0.08, 0.94, def.tiles[0], luz);
  } else if (f === 'esteira') {
    const d = b - E.ESTEIRA;
    caixa(A, get, x, y, z, 0, 0, 0, 1, 1, 1, def.tiles[2], 0, GIRO_ESTEIRA[d], def.tiles[0]);
  }
}

export { ESTEIRA_DIRS };

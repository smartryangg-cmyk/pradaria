// Mundo em pedaços (chunks) de 16x16x96: geração do terreno, edições e montagem das malhas.
import * as THREE from '../vendor/three.module.min.js';
import { criarRuido, hash3 } from './ruido.js';
import { AR, B, E, SOLIDO, OPACO, PLANTA, BLOCOS, AGUA, NIVEL, AGUA_CORRENTE, AGUA_CAINDO, BRILHO, PRECISA_CHAO, FOLHAGEM, uvTile } from './blocos.js';
import { criarGerador } from './gerador.js';
import { Vilas } from './vilas.js';
import { IlhaAventura } from './ilha-aventura.js';
import { opcoesMundo, limiteMundo } from './opcoes-mundo.js';
import { Energia, desenharForma } from './energia.js';

export const CX = 16, CZ = 16, ALT = 96;
export const NIVEL_AGUA = 20; // mar do terreno de antes (o clássico usa mundo.nivelAgua = 40)
const TETO_ANTIGO = 54; // altura máxima do terreno de antes (fica igual para não mudar os mundos antigos)
const idx = (x, y, z) => x + z * CX + y * CX * CZ;
const chave = (cx, cz) => cx + ',' + cz;

// faces: normal, 4 cantos (CCW de fora), sombra
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 0.8, t: 2 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 0.8, t: 2 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0, t: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5, t: 1 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 0.65, t: 2 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 0.65, t: 2 },
];
const AO = [0.45, 0.65, 0.82, 1];

// ---------- líquidos ----------
const TICK_AGUA = 200; // ms entre cada "passo" da água (5 por segundo)
const MAX_POR_PASSO = 1500; // teto de células por passo (tablet fraco)
// a água pode ocupar este bloco? (ar, plantinhas e água que não é fonte)
const LIVRE = new Uint8Array(256);
for (const b of BLOCOS) if (b && (b.id === AR || b.planta || (b.agua && b.id !== B.AGUA))) LIVRE[b.id] = 1;
// altura da superfície de cada tipo de água (fração do bloco)
const ALTURA_AGUA = new Float32Array(256);
ALTURA_AGUA[B.AGUA] = 0.88; ALTURA_AGUA[AGUA_CAINDO] = 0.88;
for (let n = 1; n <= 7; n++) ALTURA_AGUA[AGUA_CORRENTE[n]] = (8 - n) / 9;
const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
// chave numérica de uma posição (cabe com folga num número do JS)
const pos2k = (x, y, z) => ((x + 32768) * 65536 + (z + 32768)) * 128 + y;

// gera o terreno pesado do mundo clássico num worker (um só para a página toda)
let trabalhador = null, trabalhadorFalhou = false, serieMundo = 0;
function pegarTrabalhador() {
  if (trabalhador || trabalhadorFalhou) return trabalhador;
  try { trabalhador = new Worker(new URL('./gerador-worker.js', import.meta.url), { type: 'module' }); }
  catch { trabalhadorFalhou = true; }
  if (trabalhador) trabalhador.onerror = () => { trabalhadorFalhou = true; trabalhador = null; };
  return trabalhador;
}
const FUNDO_CAVERNA = 10; // paredes de caverna mais fundo que isso só aparecem com o jogador lá embaixo
const MAX_PEDIDOS = 4; // pedaços sendo gerados ao mesmo tempo no worker

export class Mundo {
  constructor(cena, material, materialAgua, semente) {
    this.cena = cena;
    this.mat = material;
    this.matAgua = materialAgua;
    this.semente = semente;
    this.ruido = criarRuido(semente);
    this.ruido2 = criarRuido(semente + 1013);
    this.chunks = new Map();
    this.edicoes = new Map(); // chave chunk -> Map(idx -> bloco)
    this.fila = [];
    this.raio = 3;
    this.aoMudarBloco = null;
    this.opcoes = opcoesMundo; // opções escolhidas na criação do mundo
    this.limite = limiteMundo(); // mundo pequeno/médio: ilha com mar em volta (null = sem fim)
    // terreno: clássico (biomas, cavernas, minérios) nos mundos novos; o de antes nos antigos
    this.gen = opcoesMundo.gerador === 'classico' && (opcoesMundo.tipo || 'normal') === 'normal' ? criarGerador(semente, ALT, this.limite) : null;
    this.nivelAgua = this.gen ? this.gen.nivelAgua : NIVEL_AGUA;
    this.tetoTerreno = this.gen ? ALT - 12 : TETO_ANTIGO;
    this.prontos = new Map(); // chave -> terreno que chegou do worker
    this.pedidos = new Set();
    this.serie = ++serieMundo;
    this.naSuperficie = true;
    if (this.gen) {
      const w = pegarTrabalhador();
      if (w) {
        w.postMessage({ t: 'config', serie: this.serie, semente, alt: ALT, limite: this.limite });
        w.onmessage = (e) => {
          const m = e.data;
          if (m.serie !== this.serie) return; // resposta de um mundo que já fechou
          const k = chave(m.cx, m.cz);
          this.pedidos.delete(k);
          if (!this.chunks.has(k)) this.prontos.set(k, m);
        };
      }
    }
    this.filaAgua = new Set(); // células para reavaliar no próximo passo da água
    this.ultimoPassoAgua = 0;
    this.vilas = new Vilas(this);
    this.aventura = opcoesMundo.tipo === 'aventura' ? new IlhaAventura(this) : null; // Ilha de Aventura
    this.ocultos = new Map(); // "x,y,z" -> [x,y,z]: blocos sendo escavados (desenhados à parte)
    this.energia = new Energia(this); // fios e máquinas
  }

  // esconde/mostra um bloco da malha do pedaço (o bloco continua existindo para colisão e mira)
  esconder(x, y, z, sim) {
    const k = x + ',' + y + ',' + z;
    if (sim) this.ocultos.set(k, [x, y, z]); else if (!this.ocultos.delete(k)) return;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ), lx = x - cx * CX, lz = z - cz * CZ;
    this.marcarSujo(cx, cz);
    if (lx === 0) this.marcarSujo(cx - 1, cz);
    if (lx === CX - 1) this.marcarSujo(cx + 1, cz);
    if (lz === 0) this.marcarSujo(cx, cz - 1);
    if (lz === CZ - 1) this.marcarSujo(cx, cz + 1);
  }
  escondido(x, y, z) { return this.ocultos.size > 0 && this.ocultos.has(x + ',' + y + ',' + z); }

  // ---------- geração ----------
  alturaEm(x, z) {
    if (this.aventura) return this.aventura.altura(x, z);
    if (this.gen) return this.gen.alturaEm(x, z);
    const r = this.ruido, r2 = this.ruido2;
    const cont = r.fbm(x / 240, z / 240, 3);
    const det = r.fbm(x / 55, z / 55, 3);
    const morro = Math.max(0, r2.fbm(x / 130 + 100, z / 130 - 50, 3));
    const h = 24 + cont * 9 + det * 4 + morro * morro * 40;
    if (!this.limite) return Math.floor(h);
    // ilha: perto da borda o chão desce suave até o fundo do mar (borda arredondada, com ondulação)
    const L = this.limite;
    const d = Math.hypot(Math.max(0, Math.abs(x) - L * 0.55), Math.max(0, Math.abs(z) - L * 0.55)) / (L * 0.45) + det * 0.08;
    const t = Math.min(1, Math.max(0, (d - 0.55) / 0.45)); // 0 = terra normal, 1 = fundo do mar
    const s = t * t * (3 - 2 * t);
    return Math.floor(h * (1 - s) + (NIVEL_AGUA - 7) * s);
  }

  // nome do bioma (só no mundo clássico; -1 no de antes)
  biomaEm(x, z) { return this.gen ? this.gen.biomaEm(x, z) : -1; }

  gerarDados(cx, cz) {
    if (this.gen) return this.gerarClassico(cx, cz);
    const d = new Uint8Array(CX * CZ * ALT);
    const s = this.semente;
    const alturas = new Int16Array(CX * CZ);
    for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const wx = cx * CX + x, wz = cz * CZ + z;
      const h = Math.min(TETO_ANTIGO, Math.max(4, this.alturaEm(wx, wz)));
      alturas[x + z * CX] = h;
      const praia = h <= NIVEL_AGUA + 1;
      for (let y = 0; y <= Math.max(h, NIVEL_AGUA); y++) {
        let b = AR;
        if (y === 0) b = B.PEDRA;
        else if (y < h - 3) b = B.PEDRA;
        else if (y < h) b = praia ? B.AREIA : B.TERRA;
        else if (y === h) b = praia ? B.AREIA : (h > 48 ? B.PEDRA : B.GRAMA);
        else if (y <= NIVEL_AGUA) b = B.AGUA;
        d[idx(x, y, z)] = b;
      }
    }
    // decoração: árvores, flores e capim
    for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const h = alturas[x + z * CX];
      if (d[idx(x, h, z)] !== B.GRAMA) continue;
      const wx = cx * CX + x, wz = cz * CZ + z;
      const rnd = hash3(wx, 7, wz, s);
      const floresta = this.ruido2.fbm(wx / 90 + 300, wz / 90 - 200, 2);
      const chanceArvore = floresta > 0.18 ? 0.035 : 0.004;
      if (rnd < chanceArvore && x >= 2 && !this.vilas.semArvore(wx, wz) && !(this.aventura && this.aventura.semArvore(wx, wz)) && x <= 13 && z >= 2 && z <= 13 && h + 8 < ALT) {
        this.arvore(d, x, h + 1, z, hash3(wx, 3, wz, s));
        continue;
      }
      const r2 = hash3(wx, 11, wz, s);
      const prado = floresta < -0.25;
      if (r2 < (prado ? 0.1 : 0.025)) {
        const t = hash3(wx, 19, wz, s);
        d[idx(x, h + 1, z)] = t < 0.4 ? B.FLOR_VERMELHA : t < 0.75 ? B.FLOR_AMARELA : B.FLOR_AZUL;
      } else if (r2 < 0.2) d[idx(x, h + 1, z)] = B.CAPIM;
    }
    // vilas (casas, ruas, poço e plantações)
    this.vilas.carimbar(d, cx, cz, CX, CZ);
    if (this.aventura) this.aventura.carimbar(d, cx, cz, CX, CZ);
    // edições salvas
    const ed = this.edicoes.get(chave(cx, cz));
    if (ed) for (const [i, b] of ed) d[i] = b;
    return d;
  }

  gerarClassico(cx, cz) {
    const k = chave(cx, cz);
    let t = this.prontos.get(k);
    if (t) this.prontos.delete(k);
    else t = this.gen.terreno(cx, cz); // não chegou do worker: gera aqui mesmo
    const d = t.dados;
    this.ultAlturas = t.alturas;
    this.gen.decorar(d, cx, cz, t.alturas, t.biomas, (x, z) => this.vilas.semArvore(x, z));
    this.vilas.carimbar(d, cx, cz, CX, CZ);
    const ed = this.edicoes.get(k);
    if (ed) for (const [i, b] of ed) d[i] = b;
    return d;
  }

  // pede ao worker o terreno de um pedaço (se ainda não tem nem foi pedido)
  pedir(cx, cz) {
    const k = chave(cx, cz);
    if (this.chunks.has(k) || this.prontos.has(k) || this.pedidos.has(k) || this.pedidos.size >= MAX_PEDIDOS) return;
    this.pedidos.add(k);
    trabalhador.postMessage({ t: 'pedaco', serie: this.serie, cx, cz });
  }

  // o pedaço já pode ser montado sem travar? (ele e os 8 vizinhos gerados ou prontos)
  vizinhancaPronta(cx, cz) {
    let ok = true;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const k = chave(cx + dx, cz + dz);
      if (this.chunks.has(k)) continue;
      if (this.prontos.has(k)) { this.pegarChunk(cx + dx, cz + dz); continue; }
      ok = false;
      this.pedir(cx + dx, cz + dz);
    }
    return ok;
  }

  arvore(d, x, y, z, r) {
    const alt = 4 + Math.floor(r * 2);
    for (let i = 0; i < alt; i++) d[idx(x, y + i, z)] = B.TRONCO;
    const topo = y + alt;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy < 0 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
        if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
        const yy = topo + dy;
        const i = idx(x + dx, yy, z + dz);
        if (d[i] === AR || PLANTA[d[i]]) d[i] = B.FOLHAS;
      }
    }
  }

  // ---------- acesso ----------
  pegarChunk(cx, cz, criar = true) {
    const k = chave(cx, cz);
    let c = this.chunks.get(k);
    if (!c && criar) {
      this.ultAlturas = null;
      c = { cx, cz, dados: this.gerarDados(cx, cz), malha: null, agua: null, sujo: true };
      c.alturas = this.ultAlturas; // altura do terreno gerado (mundo clássico), para esconder as cavernas
      this.chunks.set(k, c);
      // a água corrente não é salva: perto de cada edição ela é recalculada
      const ed = this.edicoes.get(k);
      // (e as máquinas também recalculam a energia)
      if (ed) for (const [i, b] of ed) {
        const x = cx * CX + i % CX, y = Math.floor(i / (CX * CZ)), z = cz * CZ + Math.floor(i / CX) % CZ;
        this.agendarAgua(x, y, z);
        if (b >= 100) this.energia.agendar(x, y, z, true);
      }
    }
    return c;
  }

  bloco(x, y, z) {
    if (y < 0) return B.PEDRA;
    if (y >= ALT) return AR;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.pegarChunk(cx, cz);
    return c.dados[idx(x - cx * CX, y, z - cz * CZ)];
  }

  // altura do chão (primeiro bloco sólido de cima para baixo)
  chao(x, z) {
    for (let y = ALT - 1; y > 0; y--) { const b = this.bloco(x, y, z); if (SOLIDO[b] || AGUA[b]) return y; }
    return 0;
  }

  // muda um bloco (local ou vindo da rede). Retorna true se mudou.
  definir(x, y, z, b, daRede = false) {
    if (y < 1 || y >= ALT) return false;
    if (b !== AR && !BLOCOS[b]) return false; // bloco que não existe (de outra versão ou de alguém atrapalhando)
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.pegarChunk(cx, cz);
    const lx = x - cx * CX, lz = z - cz * CZ;
    const i = idx(lx, y, lz);
    if (c.dados[i] === b) return false;
    const antes = c.dados[i];
    c.dados[i] = b;
    const k = chave(cx, cz);
    if (!this.edicoes.has(k)) this.edicoes.set(k, new Map());
    const natural = !this.edicoes.get(k).has(i); // ninguém tinha mexido aqui: bloco do mundo original
    this.edicoes.get(k).set(i, b);
    this.marcarSujo(cx, cz);
    if (lx === 0) this.marcarSujo(cx - 1, cz);
    if (lx === CX - 1) this.marcarSujo(cx + 1, cz);
    if (lz === 0) this.marcarSujo(cx, cz - 1);
    if (lz === CZ - 1) this.marcarSujo(cx, cz + 1);
    // planta (ou fio, botão...) sem chão some
    if (!SOLIDO[b] && PRECISA_CHAO[this.bloco(x, y + 1, z)]) this.definir(x, y + 1, z, AR, daRede);
    this.agendarAgua(x, y, z);
    this.energia.agendar(x, y, z);
    if (!daRede && this.aoMudarBloco) this.aoMudarBloco(x, y, z, b, antes, natural);
    return true;
  }

  // ---------- água que corre ----------
  // Regras (parecidas com as dos jogos de blocos clássicos):
  //  * a fonte (bloco Água) nunca some sozinha;
  //  * a água sempre tenta descer; embaixo dela vira cachoeira;
  //  * no chão, ela se espalha para os lados perdendo força (até 7 blocos da fonte);
  //  * água que pode descer não se espalha para os lados (cachoeira fininha);
  //  * buraco com 2 fontes do lado e chão firme embaixo vira fonte (dá para fazer lago infinito);
  //  * tirou a fonte? a água corrente vai secando aos poucos.
  // Cada passo calcula o novo estado de todas as células da fila olhando o mundo antigo
  // e só depois aplica, então o resultado não depende da ordem (igual em todos os aparelhos).
  agendarAgua(x, y, z) {
    const f = this.filaAgua;
    const add = (a, b, c) => { if (b >= 1 && b < ALT) f.add(pos2k(a, b, c)); };
    add(x, y, z); add(x, y + 1, z); add(x, y - 1, z);
    for (const [dx, dz] of H4) { add(x + dx, y, z + dz); add(x + dx, y + 1, z + dz); }
  }

  // o que deveria existir nesta célula, de acordo com a água em volta
  aguaDesejada(x, y, z) {
    const b = this.bloco(x, y, z);
    if (!LIVRE[b]) return b; // fonte, blocos sólidos, vidro... ficam como estão
    const cima = this.bloco(x, y + 1, z);
    const baixo = this.bloco(x, y - 1, z);
    let fontes = 0, melhor = 99;
    for (const [dx, dz] of H4) {
      const n = this.bloco(x + dx, y, z + dz);
      if (n === B.AGUA) { fontes++; melhor = 0; continue; }
      if (!AGUA[n]) continue;
      // água corrente só se espalha para o lado se não tiver como descer
      if (LIVRE[this.bloco(x + dx, y - 1, z + dz)]) continue;
      const nv = NIVEL[n] === 8 ? 0 : NIVEL[n];
      if (nv < melhor) melhor = nv;
    }
    if (fontes >= 2 && (SOLIDO[baixo] || baixo === B.AGUA)) return B.AGUA;
    if (AGUA[cima]) return AGUA_CAINDO;
    if (melhor < 7) return AGUA_CORRENTE[melhor + 1];
    return AGUA[b] ? AR : b;
  }

  // muda um bloco por causa da água (não vira edição salva nem vai para a rede)
  definirAgua(x, y, z, b) {
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chave(cx, cz));
    if (!c) return;
    const lx = x - cx * CX, lz = z - cz * CZ;
    c.dados[idx(lx, y, lz)] = b;
    // reconstrói sem furar a fila (a água muda muito; não precisa ser no mesmo quadro)
    const sujar = (a, d) => { const o = this.chunks.get(chave(a, d)); if (o) o.sujo = true; };
    sujar(cx, cz);
    if (lx === 0) sujar(cx - 1, cz);
    if (lx === CX - 1) sujar(cx + 1, cz);
    if (lz === 0) sujar(cx, cz - 1);
    if (lz === CZ - 1) sujar(cx, cz + 1);
    this.agendarAgua(x, y, z);
  }

  passoAgua() {
    if (!this.filaAgua.size) return 0;
    const fila = this.filaAgua;
    this.filaAgua = new Set();
    const mudar = [];
    let n = 0;
    for (const k of fila) {
      if (++n > MAX_POR_PASSO) { this.filaAgua.add(k); continue; }
      const y = k % 128, r = Math.floor(k / 128);
      const z = (r % 65536) - 32768, x = Math.floor(r / 65536) - 32768;
      // só mexe onde o mundo está carregado; o resto é recalculado quando carregar
      if (!this.chunks.has(chave(Math.floor(x / CX), Math.floor(z / CZ)))) continue;
      const atual = this.bloco(x, y, z);
      const novo = this.aguaDesejada(x, y, z);
      if (novo !== atual) mudar.push(x, y, z, novo);
    }
    for (let i = 0; i < mudar.length; i += 4) this.definirAgua(mudar[i], mudar[i + 1], mudar[i + 2], mudar[i + 3]);
    return mudar.length / 4;
  }

  // para onde a água empurra quem está dentro dela (x, z)
  correnteza(x, y, z) {
    const b = this.bloco(x, y, z);
    if (!AGUA[b] || b === B.AGUA) return [0, 0];
    const forca = (q) => (q === B.AGUA || NIVEL[q] === 8 ? 8 : 8 - NIVEL[q]);
    const aqui = forca(b);
    let fx = 0, fz = 0;
    for (const [dx, dz] of H4) {
      const n = this.bloco(x + dx, y, z + dz);
      let f;
      if (AGUA[n]) f = forca(n);
      else if (LIVRE[n]) f = LIVRE[this.bloco(x + dx, y - 1, z + dz)] ? -2 : aqui - 1;
      else continue;
      fx += dx * (aqui - f); fz += dz * (aqui - f);
    }
    const l = Math.hypot(fx, fz);
    return l > 0.01 ? [fx / l, fz / l] : [0, 0];
  }

  marcarSujo(cx, cz) {
    const c = this.chunks.get(chave(cx, cz));
    if (c && c.malha !== undefined) { c.sujo = true; c.prioridade = true; }
  }

  // aplica uma lista de edições [x,y,z,b] (ex.: vindas do servidor) antes de gerar
  carregarEdicoes(lista) {
    for (const [x, y, z, b] of lista) {
      if (b !== AR && !BLOCOS[b]) continue;
      const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
      const k = chave(cx, cz);
      if (!this.edicoes.has(k)) this.edicoes.set(k, new Map());
      this.edicoes.get(k).set(idx(x - cx * CX, y, z - cz * CZ), b);
      const c = this.chunks.get(k);
      if (c) { c.dados[idx(x - cx * CX, y, z - cz * CZ)] = b; c.sujo = true; this.agendarAgua(x, y, z); this.energia.agendar(x, y, z, true); }
    }
  }

  // true se o bloco foi mudado por algum jogador (não é da geração do mundo)
  editado(x, y, z) {
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const m = this.edicoes.get(chave(cx, cz));
    return !!m && m.has(idx(x - cx * CX, y, z - cz * CZ));
  }

  listarEdicoes() {
    const out = [];
    for (const [k, m] of this.edicoes) {
      const [cx, cz] = k.split(',').map(Number);
      for (const [i, b] of m) {
        const x = i % CX, z = Math.floor(i / CX) % CZ, y = Math.floor(i / (CX * CZ));
        out.push([cx * CX + x, y, cz * CZ + z, b]);
      }
    }
    return out;
  }

  // ---------- malhas ----------
  construir(c) {
    // blocos escondidos viram ar só durante a montagem (assim os vizinhos mostram as faces)
    if (this.ocultos.size) {
      const trocas = [];
      for (const [x, y, z] of this.ocultos.values()) {
        const ch = this.chunks.get(chave(Math.floor(x / CX), Math.floor(z / CZ)));
        if (!ch) continue;
        const i = idx(x - ch.cx * CX, y, z - ch.cz * CZ);
        trocas.push([ch.dados, i, ch.dados[i]]);
        ch.dados[i] = AR;
      }
      try { this.construirMalha(c); } finally { for (const [d, i, b] of trocas) d[i] = b; }
      return;
    }
    this.construirMalha(c);
  }

  construirMalha(c) {
    const P = [], U = [], C = [], I = [], N = [], O = [], L = [], BD = [];
    const luzes = [];
    const PA = [], UA = [], CA = [], IA = [], FA = [];
    const d = c.dados;
    const ox = c.cx * CX, oz = c.cz * CZ;
    const cortar = this.naSuperficie && c.alturas ? c.alturas : null;
    // vizinhos (para bordas)
    const viz = {
      '1,0': this.pegarChunk(c.cx + 1, c.cz).dados, '-1,0': this.pegarChunk(c.cx - 1, c.cz).dados,
      '0,1': this.pegarChunk(c.cx, c.cz + 1).dados, '0,-1': this.pegarChunk(c.cx, c.cz - 1).dados,
    };
    const get = (x, y, z) => {
      if (y < 0) return B.PEDRA;
      if (y >= ALT) return AR;
      if (x >= 0 && x < CX && z >= 0 && z < CZ) return d[idx(x, y, z)];
      const dx = x < 0 ? -1 : x >= CX ? 1 : 0, dz = z < 0 ? -1 : z >= CZ ? 1 : 0;
      if (dx && dz) return this.bloco(ox + x, y, oz + z);
      return viz[dx + ',' + dz][idx(x - dx * CX, y, z - dz * CZ)];
    };

    // altura da água num canto (média das águas que encostam nele), como nos jogos de blocos
    const alturaCanto = (x, y, z) => {
      let soma = 0, n = 0;
      for (let i = -1; i <= 0; i++) for (let j = -1; j <= 0; j++) {
        const q = get(x + i, y, z + j);
        if (AGUA[q]) {
          if (AGUA[get(x + i, y + 1, z + j)]) return 1;
          soma += ALTURA_AGUA[q]; n++;
        } else if (!SOLIDO[q]) n++; // ar puxa a borda para baixo
      }
      return n ? soma / n : 0.88;
    };
    const HC = [[0, 0], [0, 0]];
    const FORMA_A = { P, U, C, I, N, O, L }; // peças de engenharia (fio, alavanca...)

    let topo = 0;
    for (let i = d.length - 1; i >= 0; i--) if (d[i]) { topo = Math.floor(i / (CX * CZ)); break; }

    // "luz do céu": altura do bloco opaco mais alto de cada coluna (com borda de 1 dos vizinhos).
    // Embaixo de árvore, beiral ou caverna a face fica mais escura (sombra macia, custo zero ao jogar).
    const LC = CX + 2;
    const altCeu = new Int16Array(LC * (CZ + 2)).fill(-1);
    for (let z = -1; z <= CZ; z++) for (let x = -1; x <= CX; x++) {
      const dentro = x >= 0 && x < CX && z >= 0 && z < CZ;
      if (dentro) { for (let y = topo; y >= 0; y--) if (OPACO[d[idx(x, y, z)]]) { altCeu[x + 1 + (z + 1) * LC] = y; break; } }
      else for (let y = ALT - 1; y >= 0; y--) if (OPACO[get(x, y, z)]) { altCeu[x + 1 + (z + 1) * LC] = y; break; }
    }
    const coberto = (x, y, z) => (altCeu[x + 1 + (z + 1) * LC] > y ? 1 : 0);
    // água (para o shader): profundidade e beirada no canto de uma face.
    // Retorna [fundura 0..1, 1 - beirada, 1]; (1,1,1) = "fundo, sem espuma" (padrão seguro).
    const ehAgua = (q) => !!(BLOCOS[q] && BLOCOS[q].agua);
    const fundura = (x, y, z) => {
      if (!ehAgua(get(x, y, z))) return 0;
      let n = 0;
      while (n < 6 && ehAgua(get(x, y - n - 1, z))) n++;
      return n + 1;
    };
    const corAgua = (x, y, z, cn, f) => {
      if (f.n[1] !== 1 || ehAgua(get(x, y + 1, z))) return [1, 1, 1];
      let fd = 0, terra = 0;
      for (let i = 0; i < 4; i++) {
        const qx = x + cn[0] - (i & 1), qz = z + cn[2] - (i >> 1);
        const qb = get(qx, y, qz);
        fd += fundura(qx, y, qz);
        if (SOLIDO[qb] || OPACO[qb]) terra = 1;
      }
      return [Math.min(1, fd / 4 / 5), 1 - terra, 1];
    };

    for (let y = 0; y <= topo; y++) for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const b = d[idx(x, y, z)];
      if (b === AR) continue;
      const def = BLOCOS[b];
      if (!def) continue;
      if (b === B.LAMPIAO || b === E.LAMPADA_LIGADA) luzes.push([ox + x + 0.5, y + 0.5, oz + z + 0.5]);
      if (def.forma) { desenharForma(FORMA_A, get, x, y, z, b); continue; }
      if (def.planta) {
        const [u0, v0, u1, v1] = uvTile(def.tiles[0]);
        const base = P.length / 3;
        const q = [[0.15, 0.15, 0.85, 0.85], [0.15, 0.85, 0.85, 0.15]];
        for (const [ax, az, bx, bz] of q) {
          const k = P.length / 3;
          P.push(x + ax, y, z + az, x + bx, y, z + bz, x + bx, y + 0.9, z + bz, x + ax, y + 0.9, z + az);
          U.push(u0, v0, u1, v0, u1, v1, u0, v1);
          const lp = 0.95 * (coberto(x, y, z) ? 0.7 : 1);
          for (let n = 0; n < 4; n++) { C.push(lp, lp, lp); N.push(0, 1, 0); L.push(0); BD.push(0); }
          O.push(0, 0, 1, 1); // só o topo da plantinha balança
          I.push(k, k + 1, k + 2, k, k + 2, k + 3, k, k + 2, k + 1, k, k + 3, k + 2);
        }
        void base;
        continue;
      }
      const agua = def.agua;
      let fluxoX = 0, fluxoZ = 0, caindo = 0;
      if (agua) {
        if (AGUA[get(x, y + 1, z)]) { HC[0][0] = HC[0][1] = HC[1][0] = HC[1][1] = 1; }
        else for (let a = 0; a < 2; a++) for (let c2 = 0; c2 < 2; c2++) HC[a][c2] = alturaCanto(x + a, y, z + c2);
        // a água corre do canto alto para o baixo
        fluxoX = (HC[0][0] + HC[0][1]) - (HC[1][0] + HC[1][1]);
        fluxoZ = (HC[0][0] + HC[1][0]) - (HC[0][1] + HC[1][1]);
        caindo = NIVEL[b] === 8 ? 1 : 0;
      }
      for (const f of FACES) {
        const nb = get(x + f.n[0], y + f.n[1], z + f.n[2]);
        if (agua) {
          if (AGUA[nb] || OPACO[nb]) continue;
        } else {
          if (OPACO[nb] || nb === b) continue;
          // jogador na superfície: paredes de caverna bem fundas não aparecem (metade dos triângulos a menos)
          if (cortar && nb === AR) {
            const qx = x + f.n[0], qz = z + f.n[2];
            if (qx >= 0 && qx < CX && qz >= 0 && qz < CZ && y + f.n[1] < cortar[qx + qz * CX] - FUNDO_CAVERNA) continue;
          }
        }
        const [u0, v0, u1, v1] = uvTile(def.tiles[f.t]);
        const PP = agua ? PA : P, UU = agua ? UA : U, CC = agua ? CA : C, II = agua ? IA : I;
        const k = PP.length / 3;
        const aos = [];
        // arestas "arredondadas" (shader): 1 + bits das bordas expostas da face, 0 = sem efeito.
        // Eixos da face na ordem x,y,z (os que não são a normal): bit0 eixo1-, bit1 eixo1+, bit2 eixo2-, bit3 eixo2+
        let bd = 0;
        if (!agua && OPACO[b] && b !== B.FOLHAS) {
          let bit = 1;
          for (let a = 0; a < 3; a++) {
            if (f.n[a] !== 0) continue;
            for (const sn of [-1, 1]) {
              const v = [x, y, z]; v[a] += sn;
              if (!OPACO[get(v[0], v[1], v[2])]) bd += bit;
              bit *= 2;
            }
          }
          bd += 1;
        }
        for (const cn of f.c) {
          let py = y + cn[1];
          if (agua && cn[1] === 1) py = y + HC[cn[0]][cn[2]];
          PP.push(x + cn[0], py, z + cn[2]);
          let ao = 3;
          if (!agua) {
            // AO: dois lados e canto na camada da face
            const sx = [0, 0, 0];
            const lados = [];
            for (let a = 0; a < 3; a++) if (f.n[a] === 0) { const v = [0, 0, 0]; v[a] = cn[a] ? 1 : -1; lados.push(v); sx[a] = v[a]; }
            const bx = x + f.n[0], by = y + f.n[1], bz = z + f.n[2];
            const s1 = OPACO[get(bx + lados[0][0], by + lados[0][1], bz + lados[0][2])];
            const s2 = OPACO[get(bx + lados[1][0], by + lados[1][1], bz + lados[1][2])];
            const cc = OPACO[get(bx + sx[0], by + sx[1], bz + sx[2])];
            ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc);
          }
          aos.push(ao);
          if (agua) { CC.push(...corAgua(x, y, z, cn, f)); FA.push(fluxoX, fluxoZ, f.n[1] === 0 ? caindo : 0); continue; }
          // luz do céu nas 4 colunas que tocam o canto (só no plano da face)
          let cob = 0, nc = 0;
          for (let i = 0; i < 4; i++) {
            const qx = f.n[0] ? x + f.n[0] : x + cn[0] - (i & 1);
            const qz = f.n[2] ? z + f.n[2] : z + cn[2] - (i >> 1);
            if (f.n[0] && (i & 1)) continue;
            if (f.n[2] && (i >> 1)) continue;
            cob += coberto(qx, y + f.n[1], qz); nc++;
          }
          const v = AO[ao] * (1 - 0.32 * cob / nc);
          CC.push(v, v, v);
          N.push(f.n[0], f.n[1], f.n[2]);
          O.push(FOLHAGEM[b] ? 0.6 : 0);
          L.push(BRILHO[b]);
          BD.push(bd);
        }
        UU.push(u0, v0, u1, v0, u1, v1, u0, v1);
        // vira a diagonal para o AO ficar suave
        if (aos[0] + aos[2] < aos[1] + aos[3]) II.push(k, k + 1, k + 3, k + 1, k + 2, k + 3);
        else II.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
    }

    const fazer = (P, U, C, I, mat, antiga, extra, fluxo) => {
      if (antiga) { this.cena.remove(antiga); antiga.geometry.dispose(); }
      if (!I.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      if (extra) {
        g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('onda', new THREE.Float32BufferAttribute(O, 1));
        g.setAttribute('brilho', new THREE.Float32BufferAttribute(L, 1));
        g.setAttribute('borda', new THREE.Float32BufferAttribute(BD, 1));
      }
      if (fluxo) g.setAttribute('fluxo', new THREE.Float32BufferAttribute(fluxo, 3));
      g.setIndex(P.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.position.set(ox, 0, oz);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      if (extra) { m.castShadow = true; m.receiveShadow = true; }
      this.cena.add(m);
      return m;
    };
    c.malha = fazer(P, U, C, I, this.mat, c.malha, true);
    c.luzes = luzes;
    c.agua = fazer(PA, UA, CA, IA, this.matAgua, c.agua, false, FA);
    if (c.agua) c.agua.renderOrder = 1;
    c.sujo = false;
    c.prioridade = false;
    c.temMalha = true;
  }

  // chamado a cada quadro: carrega/descarrega pedaços perto do jogador
  // py (altura do jogador): quando ele desce numa caverna, as paredes fundas voltam a ser desenhadas
  atualizar(px, pz, orcamentoMs = 6, py = undefined) {
    if (this.gen && py !== undefined) {
      const sup = this.gen.alturaEm(Math.floor(px), Math.floor(pz));
      const agora = this.naSuperficie ? py > sup - 6 : py > sup - 3;
      if (agora !== this.naSuperficie) {
        this.naSuperficie = agora;
        for (const c of this.chunks.values()) if (c.alturas && c.temMalha) c.sujo = true;
      }
    }
    const pcx = Math.floor(px / CX), pcz = Math.floor(pz / CZ);
    const R = this.raio;
    const ini = performance.now();
    if (opcoesMundo.aguaCorre && ini - this.ultimoPassoAgua >= TICK_AGUA) { this.ultimoPassoAgua = ini; this.passoAgua(); }
    if (opcoesMundo.maquinas !== false) this.energia.atualizar(ini);
    // primeiro os pedaços editados (resposta imediata ao colocar/quebrar)
    for (const c of this.chunks.values()) {
      if (c.prioridade && c.temMalha) this.construir(c);
    }
    const pend = [];
    // mundo clássico: o terreno vem do worker; só monta quando a vizinhança chegou
    // (na entrada do mundo, com orçamento grande, gera na hora mesmo)
    const comWorker = this.gen && trabalhador && !trabalhadorFalhou && orcamentoMs < 50;
    const anel = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > R * R + 1) continue;
      anel.push([dx * dx + dz * dz, dx, dz]);
    }
    if (comWorker) anel.sort((a, b) => a[0] - b[0]);
    for (const [d2, dx, dz] of anel) {
      if (comWorker) {
        const c0 = this.chunks.get(chave(pcx + dx, pcz + dz));
        if (c0 && !c0.sujo) continue;
        if (!this.vizinhancaPronta(pcx + dx, pcz + dz)) continue;
      }
      const c = this.pegarChunk(pcx + dx, pcz + dz);
      if (c.sujo) pend.push([d2, c]);
    }
    pend.sort((a, b) => a[0] - b[0]);
    for (const [, c] of pend) {
      this.construir(c);
      if (performance.now() - ini > orcamentoMs) break;
    }
    // descarregar longe
    for (const [k, c] of this.chunks) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      const d2 = dx * dx + dz * dz;
      if (c.temMalha && d2 > (R + 2) * (R + 2)) {
        for (const m of [c.malha, c.agua]) if (m) { this.cena.remove(m); m.geometry.dispose(); }
        c.malha = c.agua = null; c.temMalha = false; c.sujo = true;
      }
      if (d2 > (R + 5) * (R + 5)) this.chunks.delete(k);
    }
    for (const k of this.prontos.keys()) {
      const [a, b] = k.split(',').map(Number);
      if ((a - pcx) ** 2 + (b - pcz) ** 2 > (R + 5) * (R + 5)) this.prontos.delete(k);
    }
    return pend.length;
  }

  // raio (DDA) a partir da câmera: retorna bloco atingido e a face
  raycast(o, dir, max = 6, pegaAgua = false) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx;
    let ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy;
    let tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
    let n = [0, 0, 0], t = 0;
    while (t <= max) {
      const b = this.bloco(x, y, z);
      if (b !== AR && (pegaAgua ? true : !AGUA[b])) return { x, y, z, b, n, t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  }
}

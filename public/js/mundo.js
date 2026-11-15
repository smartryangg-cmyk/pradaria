// Mundo em pedaços (chunks) de 16x16x96: geração do terreno, edições e montagem das malhas.
import * as THREE from '../vendor/three.module.min.js';
import { criarRuido, hash3 } from './ruido.js';
import { AR, B, E, M, SOLIDO, OPACO, PLANTA, BLOCOS, AGUA, NIVEL, AGUA_CORRENTE, AGUA_CAINDO, BRILHO, PRECISA_CHAO, FOLHAGEM, uvTile } from './blocos.js';
import { criarGerador } from './gerador.js';
import { Vilas } from './vilas.js';
import { IlhaAventura } from './ilha-aventura.js';
import { IlhaGuerra } from './guerra-mapa.js';
import { opcoesMundo, limiteMundo } from './opcoes-mundo.js';
import { Energia, desenharForma, ELETRICO } from './energia.js';
import { ESPECIAL } from './mecanismos.js';
import { F, FORMA_NOVA, desenharFormaNova, mirarForma } from './formas.js';
const ELET = new Uint8Array(256);
for (let b = 1; b < 256; b++) ELET[b] = ELETRICO(b) ? 1 : 0;
import { criarSuavizador, GRUPO_SUAVE, PALETA, COR_CAPIM, COR_CAPIM_BASE, COR_FLOR, COR_MIOLO } from './suave.js';
import { calcularLuz, EMITE, RAIO_LUZ } from './luz-blocos.js';
import { LAVA, LAVA_CORRENTE, LAVA_CAINDO, OBSIDIANA, ehLava, NIVEL_LAVA, TICK_LAVA } from './lava-regras.js';
import { FOGO, TICK_FOGO, MAX_FOGOS, QUEIMA, ALCANCE_FOGO, inflamavel, sorteioFogo, vidaFogo } from './fogo-regras.js';

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
const AO_SUAVE = [0.68, 0.8, 0.9, 1];
const AO_LISO = [0.8, 0.88, 0.95, 1]; // cores lisas, canto preso (construção do lado): AO de bloco leve

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
// a lava pode ocupar este bloco? (ar, plantinhas e lava que não é fonte)
const LIVRE_L = new Uint8Array(256);
for (const b of BLOCOS) if (b && (b.id === AR || b.planta || (ehLava(b.id) && b.id !== LAVA))) LIVRE_L[b.id] = 1;
const V6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
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
    this.cacheDirAgua = new Map(); // direções da água no passo atual (aguaVaiPara)
    this.ultimoPassoAgua = 0;
    this.fogos = new Map(); this.ultimoPassoFogo = 0; // fogo aceso: posição -> idade (fogo-regras.js)
    this.fogoBom = new Map(); // fogo de verdade -> isqueiro de origem [x, y, z]: só ele queima o que alguém construiu
    this.filaLava = new Set(); this.ultimoPassoLava = 0; // a lava usa as mesmas células, num passo mais lento
    this.vilas = new Vilas(this);
    // Ilha de Aventura; o mundo de Guerra usa a mesma ilha com base, forte, presídio e delegacia
    this.aventura = opcoesMundo.tipo === 'aventura' ? new IlhaAventura(this) : opcoesMundo.tipo === 'guerra' ? new IlhaGuerra(this) : null;
    this.ocultos = new Map(); // "x,y,z" -> [x,y,z]: blocos sendo escavados (desenhados à parte)
    this.montagem = null; // pedaço sendo montado em fatias: { c, g (gerador), limite }
    this.energia = new Energia(this); // fios e máquinas
    // estilo Natural 3D: terreno e copas arredondados (só o desenho; os blocos são os mesmos). suave.js
    this.suave = opcoesMundo.estilo === 'suave';
    this.suaveSimples = false; // aparelho fraco: arredondado simples (main.js liga no gráfico Leve)
    this.matSuave = null; // material de cores lisas do estilo Natural 3D (graficos.js); null = usa a textura
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

  // altura do chão que o gerador fez (sem casas nem construções): estilo suave só alisa até aqui
  alturaNatural(x, z) {
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chave(cx, cz));
    if (c && c.altNat) return c.altNat[(x - cx * CX) + (z - cz * CZ) * CX];
    return this.gen ? this.gen.alturaEm(x, z) : Math.min(TETO_ANTIGO, Math.max(4, this.alturaEm(x, z)));
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
    this.ultAltNat = alturas; // chão natural (o estilo suave só alisa até essa altura)
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
    for (let i = 0; i < alt; i++) d[idx(x, y + i, z)] = F.TRONCO_R; // tronco redondo
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
      c.altNat = this.ultAlturas || this.ultAltNat || null; // chão natural (estilo suave)
      this.ultAltNat = null;
      this.chunks.set(k, c);
      // a água corrente não é salva: perto de cada edição ela é recalculada
      const ed = this.edicoes.get(k);
      if (ed) for (const [i] of ed) {
        const x = cx * CX + i % CX, y = Math.floor(i / (CX * CZ)), z = cz * CZ + Math.floor(i / CX) % CZ;
        this.agendarAgua(x, y, z);
      }
      // as máquinas (as do jogador e as das construções geradas) recalculam a energia
      const d = c.dados;
      for (let i = 0; i < d.length; i++) {
        if (!ELET[d[i]]) continue;
        this.energia.agendar(cx * CX + i % CX, Math.floor(i / (CX * CZ)), cz * CZ + Math.floor(i / CX) % CZ, true);
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
    this.sujarLuz(x, z, antes, b);
    if (b === FOGO) this.acender(x, y, z);
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
    const fl = this.filaLava;
    const add = (a, b, c) => { if (b >= 1 && b < ALT) { const k = pos2k(a, b, c); f.add(k); fl.add(k); } };
    add(x, y, z); add(x, y + 1, z); add(x, y - 1, z);
    for (const [dx, dz] of H4) { add(x + dx, y, z + dz); add(x + dx, y + 1, z + dz); }
  }

  // ---------- lava ----------
  // Como a água, mas devagar e só até 3 blocos para o lado; não procura buraco (escorre para todos os lados).
  // Encontrando água: a fonte vira obsidiana e a lava corrente vira pedrisco; lava caindo na água vira pedra.
  lavaDesejada(x, y, z) {
    const b = this.bloco(x, y, z);
    const cima = this.bloco(x, y + 1, z);
    const temAgua = () => V6.some(([dx, dy, dz]) => dy !== 1 && AGUA[this.bloco(x + dx, y + dy, z + dz)]);
    if (b === LAVA) return temAgua() || AGUA[cima] ? OBSIDIANA : LAVA;
    if (AGUA[b]) return ehLava(cima) ? B.PEDRA : b;
    if (!LIVRE_L[b]) return b;
    let novo;
    if (ehLava(cima)) novo = LAVA_CAINDO;
    else {
      let melhor = 99;
      for (const [dx, dz] of H4) {
        const n = this.bloco(x + dx, y, z + dz);
        if (!ehLava(n)) continue;
        if (LIVRE_L[this.bloco(x + dx, y - 1, z + dz)]) continue; // pode descer: não espalha para o lado
        const nv = NIVEL_LAVA[n];
        if (nv < melhor) melhor = nv;
      }
      novo = melhor < 3 ? LAVA_CORRENTE[melhor + 1] : (ehLava(b) ? AR : b);
    }
    if (ehLava(novo) && (temAgua() || AGUA[cima])) return B.PEDRISCO;
    return novo;
  }

  passoLava() {
    if (!this.filaLava.size) return 0;
    const fila = this.filaLava;
    this.filaLava = new Set();
    const mudar = [];
    let n = 0;
    for (const k of fila) {
      if (++n > MAX_POR_PASSO) { this.filaLava.add(k); continue; }
      const y = k % 128, r = Math.floor(k / 128);
      const z = (r % 65536) - 32768, x = Math.floor(r / 65536) - 32768;
      if (!this.chunks.has(chave(Math.floor(x / CX), Math.floor(z / CZ)))) continue;
      const atual = this.bloco(x, y, z);
      if (!ehLava(atual) && !LIVRE_L[atual] && !AGUA[atual]) continue;
      const novo = this.lavaDesejada(x, y, z);
      if (novo !== atual) mudar.push(x, y, z, novo);
      // lava acende o que pega fogo encostado nela (só o do mundo original: construção só pega fogo do isqueiro)
      if (ehLava(novo)) for (const [dx, dy, dz] of V6) if (inflamavel(this.bloco(x + dx, y + dy, z + dz)) && !this.editado(x + dx, y + dy, z + dz)) mudar.push(x + dx, y + dy, z + dz, FOGO);
    }
    for (let i = 0; i < mudar.length; i += 4) {
      const [x, y, z, b] = [mudar[i], mudar[i + 1], mudar[i + 2], mudar[i + 3]];
      // virou pedra/obsidiana: fica salvo e vai para a rede (todos os aparelhos chegam no mesmo)
      if (b === OBSIDIANA || b === B.PEDRA || b === B.PEDRISCO || b === FOGO) { this.definir(x, y, z, b); continue; }
      this.definirAgua(x, y, z, b);
      this.sujarLuz(x, z, 0, b);
    }
    return mudar.length / 4;
  }

  // ---------- fogo (fogo-regras.js) ----------
  acender(x, y, z) {
    const k = pos2k(x, y, z);
    if (!this.fogos.has(k) && this.fogos.size < MAX_FOGOS) this.fogos.set(k, 0);
  }

  // cada fogo envelhece; queima os vizinhos que pegam fogo (eles viram fogo); apaga com água, sem chão
  // nem combustível, ou quando a vida acaba. Calcula tudo olhando o mundo antigo e depois aplica.
  // o (origem): o isqueiro que acendeu; a marca só passa até ALCANCE_FOGO dele (a sala confere igual)
  marcarFogo(x, y, z, o = [x, y, z]) { this.fogoBom.set(pos2k(x, y, z), o); }

  passoFogo() {
    const acende = [], apaga = [];
    for (const [k, a0] of this.fogos) {
      const y = k % 128, r = Math.floor(k / 128);
      const z = (r % 65536) - 32768, x = Math.floor(r / 65536) - 32768;
      if (this.bloco(x, y, z) !== FOGO) { this.fogos.delete(k); this.fogoBom.delete(k); continue; }
      const bom = this.fogoBom.get(k) || null;
      if (!this.chunks.has(chave(Math.floor(x / CX), Math.floor(z / CZ)))) continue; // longe: espera
      const a = a0 + 1;
      this.fogos.set(k, a);
      let comb = 0, agua = false;
      for (const [dx, dy, dz] of V6) {
        const n = this.bloco(x + dx, y + dy, z + dz);
        if (AGUA[n]) agua = true;
        if (!QUEIMA[n]) continue;
        comb++;
        const herda = bom && Math.max(Math.abs(x + dx - bom[0]), Math.abs(y + dy - bom[1]), Math.abs(z + dz - bom[2])) <= ALCANCE_FOGO ? bom : null;
        if (!herda && this.editado(x + dx, y + dy, z + dz)) continue; // construção: só fogo de verdade (a sala confere igual)
        if (sorteioFogo(x + dx, y + dy, z + dz, a) < QUEIMA[n]) acende.push(x + dx, y + dy, z + dz, herda);
      }
      if (agua || (!comb && !SOLIDO[this.bloco(x, y - 1, z)]) || a >= vidaFogo(x, y, z, comb > 0)) apaga.push(x, y, z);
    }
    // primeiro acende (a sala confere que tem fogo do lado), depois apaga
    for (let i = 0; i < acende.length; i += 4) {
      const [x, y, z, bom] = [acende[i], acende[i + 1], acende[i + 2], acende[i + 3]];
      if (!inflamavel(this.bloco(x, y, z))) continue;
      if (bom) this.marcarFogo(x, y, z, bom); // marca antes de mandar: herda a marca
      this.definir(x, y, z, FOGO);
    }
    for (let i = 0; i < apaga.length; i += 3) { if (this.bloco(apaga[i], apaga[i + 1], apaga[i + 2]) === FOGO) this.definir(apaga[i], apaga[i + 1], apaga[i + 2], AR); const k = pos2k(apaga[i], apaga[i + 1], apaga[i + 2]); this.fogos.delete(k); this.fogoBom.delete(k); }
    return acende.length / 4;
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
      if (n === B.AGUA) fontes++;
      if (!AGUA[n]) continue;
      // água (fonte ou corrente) só se espalha para o lado se não tiver como descer
      if (LIVRE[this.bloco(x + dx, y - 1, z + dz)]) continue;
      // e só para o lado do buraco mais perto (até 4 blocos); sem buraco perto, para todos os lados
      if (!this.aguaVaiPara(x + dx, y, z + dz, -dx, -dz)) continue;
      const nv = n === B.AGUA || NIVEL[n] === 8 ? 0 : NIVEL[n];
      if (nv < melhor) melhor = nv;
    }
    if (fontes >= 2 && (SOLIDO[baixo] || baixo === B.AGUA)) return B.AGUA;
    if (AGUA[cima]) return AGUA_CAINDO;
    if (melhor < 7) return AGUA_CORRENTE[melhor + 1];
    return AGUA[b] ? AR : b;
  }

  // Como nos jogos de blocos clássicos: a água no chão procura o caminho mais curto até um
  // buraco (até 4 blocos) e só corre para esse lado. Devolve true se a água em (x,y,z) corre
  // para a direção (dx,dz). Guarda o resultado durante um passo da água (o mundo não muda no meio).
  aguaVaiPara(x, y, z, dx, dz) {
    const k = pos2k(x, y, z);
    let dirs = this.cacheDirAgua.get(k);
    if (dirs === undefined) { dirs = this.direcoesAgua(x, y, z); this.cacheDirAgua.set(k, dirs); }
    return !!(dirs & (1 << H4.findIndex(([a, b]) => a === dx && b === dz)));
  }

  // bits das direções de H4 que levam ao buraco mais perto (15 = todas)
  direcoesAgua(x, y, z) {
    let melhor = 99, bits = 0;
    for (let i = 0; i < 4; i++) {
      const [dx, dz] = H4[i];
      const d = this.distBuraco(x + dx, y, z + dz, x, z);
      if (d < melhor) { melhor = d; bits = 1 << i; } else if (d === melhor && d < 99) bits |= 1 << i;
    }
    return melhor === 99 ? 15 : bits;
  }

  // passos (0..4) de (x,y,z) até uma célula livre com buraco embaixo, andando por células livres
  // no mesmo nível sem voltar para (ox,oz); 99 = nenhum buraco perto
  distBuraco(x, y, z, ox, oz) {
    if (!LIVRE[this.bloco(x, y, z)]) return 99;
    const vistos = new Set([ox + ',' + oz, x + ',' + z]);
    let fila = [[x, z]];
    for (let d = 0; d <= 4 && fila.length; d++) {
      const prox = [];
      for (const [cx, cz] of fila) {
        if (LIVRE[this.bloco(cx, y - 1, cz)]) return d;
        if (d === 4) continue;
        for (const [ax, az] of H4) {
          const nx = cx + ax, nz = cz + az, kk = nx + ',' + nz;
          if (vistos.has(kk) || !LIVRE[this.bloco(nx, y, nz)]) continue;
          vistos.add(kk); prox.push([nx, nz]);
        }
      }
      fila = prox;
    }
    return 99;
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
    this.cacheDirAgua.clear();
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

  // pôs ou tirou uma luz (ou um bloco perto de uma): os pedaços que ela alcança são montados de novo
  sujarLuz(x, z, antes, b) {
    if (!EMITE[antes] && !EMITE[b] && !this.temLuzPerto(x, z)) return;
    const R = RAIO_LUZ;
    for (let a = Math.floor((x - R) / CX); a <= Math.floor((x + R) / CX); a++)
      for (let d = Math.floor((z - R) / CZ); d <= Math.floor((z + R) / CZ); d++) this.marcarSujo(a, d);
  }

  // há luz de bloco nos pedaços em volta deste ponto? (guardado na montagem da malha)
  temLuzPerto(x, z) {
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    for (let a = -1; a <= 1; a++) for (let d = -1; d <= 1; d++) { const o = this.chunks.get(chave(cx + a, cz + d)); if (o && o.temLuz) return true; }
    return false;
  }

  marcarSujo(cx, cz) {
    const c = this.chunks.get(chave(cx, cz));
    if (c && c.malha !== undefined) { c.sujo = true; c.prioridade = true; }
  }

  // aplica uma lista de edições [x,y,z,b] (ex.: vindas do servidor) antes de gerar
  carregarEdicoes(lista) {
    for (let [x, y, z, b] of lista) {
      if (b !== AR && !BLOCOS[b]) continue;
      if (b === E.BOTAO_LIGADO) b = E.BOTAO; // salvou com o botão apertado: ele volta solto
      if (b === FOGO) this.acender(x, y, z); // fogo salvo continua queimando (e apaga)
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
  // monta a malha do pedaço de uma vez (pedaço editado, entrada no mundo)
  construir(c) {
    if (this.montagem && this.montagem.c === c) this.montagem = null; // a montagem em fatias dele fica velha
    const g = this.construirMalha(c);
    const trocas = this.esconderOcultos();
    try { while (!g.next().done); } finally { for (const [d, i, b] of trocas) d[i] = b; }
  }

  // blocos escondidos viram ar só durante a montagem (assim os vizinhos mostram as faces)
  esconderOcultos() {
    const trocas = [];
    if (!this.ocultos.size) return trocas;
    for (const [x, y, z] of this.ocultos.values()) {
      const ch = this.chunks.get(chave(Math.floor(x / CX), Math.floor(z / CZ)));
      if (!ch) continue;
      const i = idx(x - ch.cx * CX, y, z - ch.cz * CZ);
      trocas.push([ch.dados, i, ch.dados[i]]);
      ch.dados[i] = AR;
    }
    return trocas;
  }

  // Montagem em fatias: um pedaço novo (andando pelo mundo) é montado aos poucos, no máximo `ms` por quadro;
  // a malha velha continua na tela até a nova ficar pronta. Retorna true quando terminou (ou não tinha nada).
  // No tablet fraco um pedaço do Natural 3D levava ~50 ms de uma vez (engasgo a cada pedaço novo).
  montarFatia(ms) {
    const j = this.montagem;
    if (!j) return true;
    if (this.chunks.get(chave(j.c.cx, j.c.cz)) !== j.c) { this.montagem = null; return true; } // descarregou
    j.limite = performance.now() + ms;
    const trocas = this.esconderOcultos();
    let fim;
    try { fim = j.g.next().done; } finally { for (const [d, i, b] of trocas) d[i] = b; }
    if (fim) this.montagem = null;
    return fim;
  }

  // gerador: monta a malha; com `fatia` (objeto com .limite em ms de performance.now) pausa (yield) quando passa
  // do limite e continua no próximo quadro. Sem fatia vai até o fim.
  *construirMalha(c, fatia = null) {
    const P = [], U = [], C = [], I = [], N = [], O = [], L = [], BD = [];
    // Natural 3D com cores lisas: índices do material liso (IS) e as duas cores de cada vértice (topo e lado)
    const IS = [], CT = [], CL = [];
    const luzes = [];
    const especiais = []; // catavento, mó girando, forno aceso (animados em mecanismos.js)
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
    const SC = [null, null, null, null];
    const FORMA_A = { P, U, C, I, N, O, L, BD }; // peças que não são cubos (fio, alavanca, formas redondas...)

    let topo = 0;
    for (let i = d.length - 1; i >= 0; i--) if (d[i]) { topo = Math.floor(i / (CX * CZ)); break; }
    // estilo Natural 3D: cantos das faces do terreno e das folhas vão para a superfície lisa (suave.js)
    let temEd = false;
    for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) { const m = this.edicoes.get(chave(c.cx + a, c.cz + b2)); if (m && m.size) temEd = true; }
    const sv = this.suave ? criarSuavizador(get, temEd ? (x, y, z) => this.editado(ox + x, y, oz + z) : () => false, (x, z) => this.alturaNatural(ox + x, oz + z), topo, this.suaveSimples, ox, oz) : null;
    // gráfico Leve (arredondado simples): o lado de cada degrau ficaria listrado de terra; lá a cor é só a de cima
    const simples = this.suaveSimples;
    const liso = sv && this.matSuave ? sv : null; // desenho de desenho animado: cores lisas, troncos redondos, capim em tufo
    // as cores lisas só existem nos vértices do material liso: completa com zero até o vértice atual
    const completar = () => { const n = P.length; while (CT.length < n) { CT.push(0, 0, 0); CL.push(0, 0, 0); } };
    // tronco natural vira cilindro (mais fino que o bloco); a colisão continua a do bloco
    const cilindro = (qx, qy, qz, q) => !!liso && GRUPO_SUAVE[q] === 3 && !!PALETA[q] && liso.natural(qx, qy, qz);

    // "luz do céu": altura do bloco opaco mais alto de cada coluna (com borda de 1 dos vizinhos).
    // Embaixo de árvore, beiral ou caverna a face fica mais escura (sombra macia, custo zero ao jogar).
    const LC = CX + 2;
    const altCeu = new Int16Array(LC * (CZ + 2)).fill(-1);
    for (let z = -1; z <= CZ; z++) for (let x = -1; x <= CX; x++) {
      const dentro = x >= 0 && x < CX && z >= 0 && z < CZ;
      if (dentro) { for (let y = topo; y >= 0; y--) if (OPACO[d[idx(x, y, z)]]) { altCeu[x + 1 + (z + 1) * LC] = y; break; } }
      else for (let y = ALT - 1; y >= 0; y--) if (OPACO[get(x, y, z)]) { altCeu[x + 1 + (z + 1) * LC] = y; break; }
    }
    // cor lisa: só copa, casa e teto alto cobrem. O morro do lado não conta (marcava cada degrau do barranco)
    const altCopa = liso ? new Int16Array(LC * (CZ + 2)).fill(-1) : null;
    if (liso) for (let z = -1; z <= CZ; z++) for (let x = -1; x <= CX; x++) {
      const t = altCeu[x + 1 + (z + 1) * LC];
      for (let y = t; y >= 0; y--) { const q = get(x, y, z); if (OPACO[q] && GRUPO_SUAVE[q] !== 1) { altCopa[x + 1 + (z + 1) * LC] = y; break; } if (GRUPO_SUAVE[q] === 1) break; }
    }
    const coberto = (x, y, z) => (altCeu[x + 1 + (z + 1) * LC] > y ? 1 : 0);
    // quão escuro fica sem o céu: sombra leve embaixo de árvore/beiral (como antes); mais de 5 blocos
    // de teto (caverna) vai escurecendo até 62%
    const escuroCeu = (x, y, z) => { const t = altCeu[x + 1 + (z + 1) * LC]; return t > y ? Math.min(0.62, 0.32 + 0.03 * Math.max(0, t - y - 5)) : 0; };
    const escuroLiso = (x, y, z) => { const i = x + 1 + (z + 1) * LC, t = altCeu[i]; return altCopa[i] > y || t > y + 4 ? Math.min(0.62, 0.32 + 0.03 * Math.max(0, t - y - 5)) : 0; };
    // luz dos blocos (lampião, fogueira...) espalhada em volta; null = nenhuma por perto
    const arrs = [];
    for (let b2 = -1; b2 <= 1; b2++) for (let a = -1; a <= 1; a++) {
      const o = a || b2 ? this.chunks.get(chave(c.cx + a, c.cz + b2)) : c;
      arrs.push(o ? o.dados : null);
    }
    if (fatia && performance.now() > fatia.limite) yield;
    const luzB = calcularLuz(arrs, CX, CZ, ALT);
    if (fatia && performance.now() > fatia.limite) yield;
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

    // ---------- Natural 3D "de desenho": peças lisas (material liso, sem textura) ----------
    // um vértice do material liso: cor de topo e de lado (o shader mistura pela inclinação), luz (AO/céu)
    const vLiso = (px, py, pz, nx, ny, nz, ct, cl, luz, onda, brilho) => {
      P.push(px, py, pz); U.push(0, 0); C.push(luz, luz, luz); N.push(nx, ny, nz); O.push(onda); L.push(brilho); BD.push(0);
      CT.push(ct[0], ct[1], ct[2]); CL.push(cl[0], cl[1], cl[2]);
    };
    // tronco natural: cilindro de 8 lados, mais grosso embaixo (raiz) e afinando para cima
    const ehCopa = (q) => GRUPO_SUAVE[q] === 2 || GRUPO_SUAVE[q] === 3;
    const desenharTronco = (x, y, z, b) => {
      // escondido dentro da copa: nem desenha
      if (ehCopa(get(x + 1, y, z)) && ehCopa(get(x - 1, y, z)) && ehCopa(get(x, y, z + 1)) && ehCopa(get(x, y, z - 1)) && ehCopa(get(x, y + 1, z))) return;
      let kb = 0; while (kb < 10 && GRUPO_SUAVE[get(x, y - kb - 1, z)] === 3) kb++;
      let ka = 0; while (ka < 10 && GRUPO_SUAVE[get(x, y + ka + 1, z)] === 3) ka++;
      const cacto = b === B.CACTO;
      if (cacto) { kb = 0; ka = 0; while (kb < 6 && get(x, y - kb - 1, z) === b) kb++; while (ka < 6 && get(x, y + ka + 1, z) === b) ka++; }
      const tot = kb + ka + 1, fino = b === B.TRONCO_BETULA || b === 82 ? 0.75 : 1;
      // cacto: coluna grossa com a ponta arredondada; tronco: afina para cima e alarga na raiz
      const raio = cacto ? (h) => 0.4 * Math.sqrt(Math.max(0.04, 1 - Math.max(0, h - tot + 0.6) ** 2 / 0.36))
        : (h) => fino * (0.2 + 0.14 * (1 - h / tot) + 0.2 * Math.max(0, 1 - h * 1.6));
      const r0 = raio(kb), r1 = raio(kb + 1), p = PALETA[b];
      const lb = luzB ? luzB(x, y, z) : 0;
      const luz = 1 - escuroCeu(x, y, z) * (1 - lb) * 0.25, br = Math.max(BRILHO[b], lb * 0.3);
      const fase = hash3(ox + x, 0, oz + z, 7) * 6.283, nl = Math.hypot(1, r0 - r1), S = 8;
      completar();
      const k = P.length / 3;
      for (let anel = 0; anel < 2; anel++) {
        const r = anel ? r1 : r0, yy = y + anel - (anel || kb ? 0 : 0.25) - (cacto && anel && !ka ? 0.02 : 0); // a raiz entra no chão (o chão liso pode descer)
        for (let i = 0; i < S; i++) {
          const a = fase + (i / S) * 6.283, ca = Math.cos(a), sa = Math.sin(a);
          vLiso(x + 0.5 + ca * r, yy, z + 0.5 + sa * r, ca / nl, (r0 - r1) / nl, sa / nl, p.t, p.l, luz * (anel ? 1 : 0.86), 0, br);
        }
      }
      for (let i = 0; i < S; i++) { const j = (i + 1) % S; IS.push(k + i, k + S + i, k + S + j, k + i, k + S + j, k + j); }
      if (!ehCopa(get(x, y + 1, z)) && get(x, y + 1, z) !== b) { // tampa (tronco cortado, ponta do cacto)
        const c0 = P.length / 3;
        vLiso(x + 0.5, y + 1, z + 0.5, 0, 1, 0, p.t, p.t, luz, 0, br);
        for (let i = 0; i < S; i++) IS.push(c0, k + S + (i + 1) % S, k + S + i);
      }
    };
    // capim em tufo (folhinhas em ponta, escuras no pé e claras na ponta) e flor (estrela colorida no cabinho)
    // pinheiro de desenho: as folhas em blocos (que viravam uma massa amassada) dão lugar a 3 cones lisos
    // empilhados, com a borda ondulada. Os blocos de folha continuam lá (colisão, mira, quebrar).
    // Acha os pinheiros (tronco natural com folha de pinheiro em cima) até 3 blocos fora do pedaço.
    const pinheiros = [];
    if (liso && d.includes(B.FOLHAS_PINHEIRO)) {
      for (let z = -3; z < CZ + 3; z++) for (let x = -3; x < CX + 3; x++) {
        for (let y = Math.min(ALT - 2, topo + 3); y > 0; y--) {
          const q = get(x, y, z);
          if (q === F.TRONCO_R_PINHEIRO || q === B.TRONCO_PINHEIRO) {
            if (get(x, y + 1, z) !== B.FOLHAS_PINHEIRO || !liso.natural(x, y, z)) break;
            let yb = y; while (yb > 1 && get(x, yb - 1, z) === q) yb--;
            pinheiros.push({ x, z, topo: y, base: yb });
            break;
          }
          if (GRUPO_SUAVE[q] === 1 || (OPACO[q] && q !== B.FOLHAS_PINHEIRO)) break;
        }
      }
    }
    // folha de pinheiro natural que faz parte de um pinheiro desenhado em cone (não desenha as faces)
    const folhaDePinheiro = (x, y, z) => {
      for (const t of pinheiros) if (Math.abs(t.x - x) <= 3 && Math.abs(t.z - z) <= 3 && y > t.base && y <= t.topo + 3) return true;
      return false;
    };
    const desenharPinheiro = (t) => {
      const p = PALETA[B.FOLHAS_PINHEIRO], escuro = p.l.map((v) => v * 0.7);
      const h0 = t.base + 2.4, h1 = t.topo + 2.6, H = h1 - h0, S = 12;
      const fase = hash3(ox + t.x, 5, oz + t.z, 9) * 6.283, cx = t.x + 0.5, cz = t.z + 0.5;
      const br = BRILHO[B.FOLHAS_PINHEIRO];
      // camadas: [base, topo, raio] (a de baixo é a maior)
      const camadas = [[0, 0.5, 2.35], [0.3, 0.78, 1.8], [0.58, 1, 1.25]];
      completar();
      for (const [a0, a1, R] of camadas) {
        const yb = h0 + a0 * H, yt = h0 + a1 * H, inc = R / (yt - yb), nl = Math.hypot(1, inc);
        const k = P.length / 3;
        vLiso(cx, yt, cz, 0, 1, 0, p.t, p.t, 1.05, 0.35, br); // ponta
        for (let i = 0; i < S; i++) {
          const a = fase + (i / S) * 6.283, r = R * (i & 1 ? 0.88 : 1.04), ca = Math.cos(a), sa = Math.sin(a);
          vLiso(cx + ca * r, yb - (i & 1 ? 0 : 0.12), cz + sa * r, ca / nl, inc / nl, sa / nl, p.t, p.l, 0.9, 0.3, br);
        }
        // embaixo da saia: disco mais escuro (visto de baixo)
        const kb = P.length / 3;
        vLiso(cx, yb + 0.15, cz, 0, -1, 0, escuro, escuro, 0.7, 0.3, br);
        for (let i = 0; i < S; i++) {
          const j = (i + 1) % S;
          IS.push(k, k + 1 + j, k + 1 + i); // lado do cone (de fora)
          IS.push(kb, k + 1 + i, k + 1 + j); // disco de baixo
        }
      }
    };
    for (const t of pinheiros) if (t.x >= 0 && t.x < CX && t.z >= 0 && t.z < CZ) desenharPinheiro(t);
    const desenharPlantaLisa = (x, py, z, b, luz, br) => {
      completar();
      const h = hash3(ox + x, Math.floor(py), oz + z, 3);
      const folha = (a, dd, alt, larg, cBase, cPonta, curva) => {
        const cx = x + 0.5 + Math.cos(a) * dd, cz = z + 0.5 + Math.sin(a) * dd;
        const lx = -Math.sin(a) * larg, lz = Math.cos(a) * larg;
        const k = P.length / 3;
        vLiso(cx - lx, py, cz - lz, 0, 1, 0, cBase, cBase, luz * 0.85, 0, br);
        vLiso(cx + lx, py, cz + lz, 0, 1, 0, cBase, cBase, luz * 0.85, 0, br);
        vLiso(cx + Math.cos(a) * curva, py + alt, cz + Math.sin(a) * curva, 0, 1, 0, cPonta, cPonta, luz * 1.05, 1, br);
        IS.push(k, k + 1, k + 2, k, k + 2, k + 1);
      };
      if (b === B.CAPIM) {
        for (let i = 0; i < 6; i++) folha(h * 6.283 + i * 2.4, 0.05 + 0.2 * ((h * 3.7 + i * 0.37) % 1), 0.4 + 0.4 * ((h * 7.3 + i * 0.61) % 1), 0.075, COR_CAPIM_BASE, COR_CAPIM, 0.2);
        return;
      }
      // flor: cabinho + duas folhinhas + estrela de 5 pétalas virada para cima
      const cor = COR_FLOR[b], alt = 0.42 + 0.12 * h;
      folha(h * 6.283, 0, alt, 0.03, COR_CAPIM_BASE, COR_CAPIM_BASE, 0);
      folha(h * 6.283 + 2, 0.02, 0.28, 0.06, COR_CAPIM_BASE, COR_CAPIM, 0.16);
      folha(h * 6.283 + 4.6, 0.02, 0.24, 0.06, COR_CAPIM_BASE, COR_CAPIM, 0.16);
      const cx = x + 0.5, cz = z + 0.5, cy = py + alt;
      const k = P.length / 3;
      const miolo = [0, 1, 2].map((j) => cor[j] * 0.5 + COR_MIOLO[j] * 0.5);
      vLiso(cx, cy + 0.02, cz, 0, 1, 0, miolo, miolo, luz * 1.1, 0.6, br);
      for (let i = 0; i < 10; i++) {
        const a = h * 6.283 + (i / 10) * 6.283, r = i & 1 ? 0.07 : 0.2;
        vLiso(cx + Math.cos(a) * r, cy + (i & 1 ? 0 : 0.05), cz + Math.sin(a) * r, 0, 1, 0, cor, cor, luz, 0.6, br);
      }
      for (let i = 0; i < 10; i++) { const a = k + 1 + i, c2 = k + 1 + (i + 1) % 10; IS.push(k, c2, a, k, a, c2); }
    };
    // beira d'água: a água continua por cima do chão liso da margem (o chão que sobra por cima esconde),
    // assim a margem fica curva, sem os degraus dos blocos, e a espuma acompanha
    const VIZ8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const margem = (x, y, z) => {
      if (get(x, y + 1, z) !== AR) return;
      let h = 0;
      for (const [a, c2] of VIZ8) { const q = get(x + a, y, z + c2); if (AGUA[q] && !AGUA[get(x + a, y + 1, z + c2)]) h = Math.max(h, ALTURA_AGUA[q]); }
      if (!h) return;
      const k = PA.length / 3;
      for (const cn of FACES[2].c) { PA.push(x + cn[0], y + h, z + cn[2]); UA.push(0, 0); CA.push(0, 0, 1); FA.push(0, 0, 0); }
      IA.push(k, k + 1, k + 2, k, k + 2, k + 3);
    };

    for (let y = 0; y <= topo; y++) for (let z = 0; z < CZ; z++) {
      if (fatia && performance.now() > fatia.limite) yield;
      for (let x = 0; x < CX; x++) {
      const b = d[idx(x, y, z)];
      if (b === AR) continue;
      const def = BLOCOS[b];
      if (!def) continue;
      if (b === B.LAMPIAO || b === E.LAMPADA_LIGADA || b === M.FORNO_ACESO) luzes.push([ox + x + 0.5, y + 0.5, oz + z + 0.5]);
      if (ESPECIAL[b]) especiais.push([ox + x, y, oz + z, b]);
      if (liso && cilindro(x, y, z, b)) { desenharTronco(x, y, z, b); continue; } // tronco natural: cilindro de desenho
      if (liso && b === B.CACTO && !(temEd && this.editado(ox + x, y, oz + z))) { desenharTronco(x, y, z, b); continue; } // cacto: coluna redonda
      if (def.forma) {
        if (FORMA_NOVA[b]) desenharFormaNova(FORMA_A, get, x, y, z, b, coberto(x, y, z) ? 0.72 : 1);
        else desenharForma(FORMA_A, get, x, y, z, b);
        continue;
      }
      if (def.planta && liso && (b === B.CAPIM || COR_FLOR[b])) {
        const lb = luzB ? luzB(x, y, z) : 0;
        const lp = 1 - escuroCeu(x, y, z) * (1 - lb) * 0.8;
        desenharPlantaLisa(x, y + liso.ajustePlanta(x, y, z), z, b, lp, Math.max(BRILHO[b], lb * 0.3));
        continue;
      }
      if (def.planta) {
        const [u0, v0, u1, v1] = uvTile(def.tiles[0]);
        const base = P.length / 3;
        const q = [[0.15, 0.15, 0.85, 0.85], [0.15, 0.85, 0.85, 0.15]];
        const py = y + (sv ? sv.ajustePlanta(x, y, z) : 0); // no chão liso a plantinha acompanha o chão
        for (const [ax, az, bx, bz] of q) {
          const k = P.length / 3;
          P.push(x + ax, py, z + az, x + bx, py, z + bz, x + bx, py + 0.9, z + bz, x + ax, py + 0.9, z + az);
          U.push(u0, v0, u1, v0, u1, v1, u0, v1);
          const lb = luzB ? luzB(x, y, z) : 0;
          const lp = 0.95 * (1 - escuroCeu(x, y, z) * (1 - lb));
          for (let n = 0; n < 4; n++) { C.push(lp, lp, lp); N.push(0, 1, 0); L.push(Math.max(BRILHO[b], lb * 0.3)); BD.push(0); }
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
      if (liso && GRUPO_SUAVE[b] === 1) margem(x, y, z);
      let gs = -1; // 1 terreno liso, 2 copa redonda, 0 quadrado (só calcula se alguma face aparece)
      for (const f of FACES) {
        const nb = get(x + f.n[0], y + f.n[1], z + f.n[2]);
        if (agua) {
          if (AGUA[nb] || OPACO[nb]) continue;
        } else {
          // o chão em volta do tronco redondo aparece (o tronco é mais fino que o bloco)
          if (nb === b || (OPACO[nb] && !(GRUPO_SUAVE[b] === 1 && cilindro(x + f.n[0], y + f.n[1], z + f.n[2], nb)))) continue;
          // jogador na superfície: paredes de caverna bem fundas não aparecem (metade dos triângulos a menos)
          if (cortar && nb === AR) {
            const qx = x + f.n[0], qz = z + f.n[2];
            if (qx >= 0 && qx < CX && qz >= 0 && qz < CZ && y + f.n[1] < cortar[qx + qz * CX] - FUNDO_CAVERNA) continue;
          }
        }
        // cantos lisos: deslocamento + normal de cada canto (null = canto preso, fica no lugar)
        if (gs < 0) gs = sv && !agua ? sv.grupo(x, y, z, b) : 0;
        if (gs === 2 && b === B.FOLHAS_PINHEIRO && pinheiros.length && folhaDePinheiro(x, y, z)) break; // vira cone (desenharPinheiro)
        let sc = null, ft = f.t;
        if (gs) {
          sc = SC;
          for (let q = 0; q < 4; q++) { const cn = f.c[q]; SC[q] = sv.canto(x + cn[0], y + cn[1], z + cn[2]); }
          // a textura segue a inclinação: rampa de grama mostra grama, não o lado com terra
          let ny = 0;
          for (const r of sc) ny += r ? r[4] : f.n[1];
          ny /= 4;
          ft = ny > 0.55 ? 0 : ny < -0.55 ? 1 : 2;
        }
        const [u0, v0, u1, v1] = uvTile(def.tiles[ft]);
        // face lisa com cor de desenho (sem textura): vai para o material liso, com a cor de cada canto
        const pal = gs && liso && PALETA[b] && !PALETA[b].atlas;
        if (pal) completar();
        const PP = agua ? PA : P, UU = agua ? UA : U, CC = agua ? CA : C, II = agua ? IA : pal ? IS : I;
        const k = PP.length / 3;
        const aos = [];
        // arestas "arredondadas" (shader): 1 + bits das bordas expostas da face, 0 = sem efeito.
        // Eixos da face na ordem x,y,z (os que não são a normal): bit0 eixo1-, bit1 eixo1+, bit2 eixo2-, bit3 eixo2+
        let bd = 0;
        if (!agua && !gs && OPACO[b] && b !== B.FOLHAS) {
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
        let ic = 0;
        for (const cn of f.c) {
          let py = y + cn[1];
          if (agua && cn[1] === 1) py = y + HC[cn[0]][cn[2]];
          const s = sc && sc[ic++];
          if (pal) { const cc = liso.corCanto(x + cn[0], y + cn[1], z + cn[2], b), j = simples ? 0 : 3; CT.push(cc[0], cc[1], cc[2]); CL.push(cc[j], cc[j + 1], cc[j + 2]); }
          if (s) PP.push(x + cn[0] + s[0], py + s[1], z + cn[2] + s[2]);
          else PP.push(x + cn[0], py, z + cn[2]);
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
          // (caverna funda fica mais escura; a luz dos blocos em volta clareia de novo)
          let cob = 0, lb = 0, nc = 0;
          for (let i = 0; i < 4; i++) {
            const qx = f.n[0] ? x + f.n[0] : x + cn[0] - (i & 1);
            const qz = f.n[2] ? z + f.n[2] : z + cn[2] - (i >> 1);
            if (f.n[0] && (i & 1)) continue;
            if (f.n[2] && (i >> 1)) continue;
            cob += (pal ? escuroLiso : escuroCeu)(qx, y + f.n[1], qz); nc++;
            if (luzB) lb += luzB(qx, y + f.n[1], qz);
          }
          lb /= nc;
          if (pal && GRUPO_SUAVE[b] === 2) cob *= 0.35; // copa lisa: as folhas de cima quase não escurecem as de baixo
          // cor lisa: sem o AO de bloco (deixava cada degrau marcado); só a sombrinha macia dos vales (suave.js)
          const aoV = pal ? (s ? s[6] : AO_LISO[ao]) : (gs ? AO_SUAVE : AO)[ao];
          const v = aoV * (1 - (cob / nc) * (1 - lb)); // no chão liso o AO é mais leve (sem "curvas de nível" escuras)
          CC.push(v, v, v);
          if (s) N.push(s[3], s[4], s[5]); else N.push(f.n[0], f.n[1], f.n[2]);
          O.push(FOLHAGEM[b] ? 0.6 : 0);
          L.push(Math.max(BRILHO[b], lb * 0.3)); // perto do lampião a parede brilha um pouco (mais de noite)
          BD.push(bd);
        }
        UU.push(u0, v0, u1, v0, u1, v1, u0, v1);
        // vira a diagonal para o AO ficar suave
        if (aos[0] + aos[2] < aos[1] + aos[3]) II.push(k, k + 1, k + 3, k + 1, k + 2, k + 3);
        else II.push(k, k + 1, k + 2, k, k + 2, k + 3);
      }
    }
    }

    const fazer = (P, U, C, I, mat, antiga, extra, fluxo, IL) => {
      if (antiga) { this.cena.remove(antiga); antiga.geometry.dispose(); }
      if (!I.length && !(IL && IL.length)) return null;
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
      if (IL && IL.length) {
        // dois materiais na mesma malha: blocos com textura (grupo 0) e chão/copas lisos (grupo 1)
        completar();
        g.setAttribute('corTopo', new THREE.Float32BufferAttribute(CT, 3));
        g.setAttribute('corLado', new THREE.Float32BufferAttribute(CL, 3));
        const n0 = I.length;
        for (const v of IL) I.push(v);
        g.addGroup(0, n0, 0); g.addGroup(n0, IL.length, 1);
        mat = [mat, this.matSuave];
      }
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
    if (fatia && performance.now() > fatia.limite) yield;
    c.malha = fazer(P, U, C, I, this.mat, c.malha, true, null, IS);
    c.luzes = luzes;
    c.temLuz = !!luzB;
    c.especiais = especiais;
    c.agua = fazer(PA, UA, CA, IA, this.matAgua, c.agua, false, FA);
    if (c.agua) c.agua.renderOrder = 1;
    if (!fatia) c.sujo = false; // em fatias o sujo já foi limpo no começo (mexeram no meio: monta de novo)
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
    if (opcoesMundo.aguaCorre && ini - this.ultimoPassoLava >= TICK_LAVA) { this.ultimoPassoLava = ini; this.passoLava(); }
    if (this.fogos.size && ini - this.ultimoPassoFogo >= TICK_FOGO) { this.ultimoPassoFogo = ini; this.passoFogo(); }
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
    if (orcamentoMs >= 50) {
      // entrada no mundo (tela de carregando): monta de uma vez
      for (const [, c] of pend) {
        this.construir(c);
        if (performance.now() - ini > orcamentoMs) break;
      }
    } else {
      // andando: monta em fatias dentro do orçamento do quadro (um pedaço pode levar vários quadros)
      let k = 0;
      for (let resto = orcamentoMs - (performance.now() - ini); resto > 0.5; resto = orcamentoMs - (performance.now() - ini)) {
        if (!this.montagem) {
          while (k < pend.length && !pend[k][1].sujo) k++;
          if (k >= pend.length) break;
          const c = pend[k++][1];
          c.sujo = false;
          const job = { c, limite: 0 };
          job.g = this.construirMalha(c, job);
          this.montagem = job;
        }
        this.montarFatia(resto);
      }
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
    return pend.length + (this.montagem ? 1 : 0);
  }

  // raio (DDA) a partir da câmera: retorna bloco atingido e a face
  // Estilo Natural 3D: o chão desenhado (arredondado) fica mais baixo que o topo do bloco nas beiradas e
  // declives. Devolve a altura do chão DESENHADO em (x, z) logo abaixo de y (ou null), para pôr os pés
  // do boneco nele (a colisão continua nos blocos). Índice por coluna feito uma vez por malha.
  alturaVisual(x, y, z) {
    if (!this.suave) return null;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ), c = this.chunks.get(chave(cx, cz));
    const m = c && c.malha;
    if (!m) return null;
    if (!c.colunas || c.colunas.malha !== m) {
      const P = m.geometry.attributes.position.array, I = m.geometry.index.array, cols = new Array(CX * CZ);
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
        // só o que está virado para cima (chão)
        const ux = P[b] - P[a], uz = P[b + 2] - P[a + 2], vx = P[d] - P[a], vz = P[d + 2] - P[a + 2];
        if (uz * vx - ux * vz <= 1e-6) continue;
        const x0 = Math.max(0, Math.floor(Math.min(P[a], P[b], P[d]))), x1 = Math.min(CX - 1, Math.floor(Math.max(P[a], P[b], P[d]) - 1e-6));
        const z0 = Math.max(0, Math.floor(Math.min(P[a + 2], P[b + 2], P[d + 2]))), z1 = Math.min(CZ - 1, Math.floor(Math.max(P[a + 2], P[b + 2], P[d + 2]) - 1e-6));
        for (let i = x0; i <= x1; i++) for (let k = z0; k <= z1; k++) (cols[i * CZ + k] ??= []).push(t);
      }
      c.colunas = { malha: m, cols, P, I };
    }
    const { cols, P, I } = c.colunas, lx = x - cx * CX, lz = z - cz * CZ, l = cols[Math.floor(lx) * CZ + Math.floor(lz)];
    if (!l) return null;
    let melhor = null;
    for (const t of l) {
      const a = I[t] * 3, b = I[t + 1] * 3, d = I[t + 2] * 3;
      const v0x = P[d] - P[a], v0z = P[d + 2] - P[a + 2], v1x = P[b] - P[a], v1z = P[b + 2] - P[a + 2], v2x = lx - P[a], v2z = lz - P[a + 2];
      const d00 = v0x * v0x + v0z * v0z, d01 = v0x * v1x + v0z * v1z, d11 = v1x * v1x + v1z * v1z, d20 = v2x * v0x + v2z * v0z, d21 = v2x * v1x + v2z * v1z;
      const den = d00 * d11 - d01 * d01;
      if (Math.abs(den) < 1e-9) continue;
      const u = (d11 * d20 - d01 * d21) / den, v = (d00 * d21 - d01 * d20) / den;
      if (u < -1e-4 || v < -1e-4 || u + v > 1 + 1e-4) continue;
      const yy = P[a + 1] + u * (P[d + 1] - P[a + 1]) + v * (P[b + 1] - P[a + 1]);
      if (yy <= y + 0.05 && yy > y - 1.2 && (melhor === null || yy > melhor)) melhor = yy;
    }
    return melhor;
  }

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
      if (b !== AR && (pegaAgua ? true : !AGUA[b] && !ehLava(b))) {
        // formas (cerca, bola, rampa...): só acerta se o raio passar pela peça de verdade
        if (!FORMA_NOVA[b]) return { x, y, z, b, n, t };
        const h = mirarForma(b, (a, c, e) => this.bloco(a, c, e), x, y, z, o, dir);
        if (h && h.t <= max) return { x, y, z, b, n: h.n, t: h.t };
      }
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; n = [-sx, 0, 0]; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; n = [0, -sy, 0]; }
      else { z += sz; t = tz; tz += tdz; n = [0, 0, -sz]; }
    }
    return null;
  }
}

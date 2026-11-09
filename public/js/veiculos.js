// Veículos de blocos: carros, caminhão, ônibus, trator, moto, bicicleta, skate, barco, avião e helicóptero.
// Cada tipo é só uma ficha (medidas, velocidade, lugares e o desenho em caixinhas); a física (fisica-veiculos.js)
// é a mesma para todos, mudando conforme o "meio": terra, água, ar (avião) ou hélice (helicóptero), com alguns
// números por tipo (aderência, mola, densidade) em FISICA. Ninguém se machuca: os veículos atravessam as pessoas
// e freiam sozinhos na frente dos bichos.
import * as THREE from '../vendor/three.module.min.js';
import { caixa, juntar, matModelo } from './modelos.js';
import { SOLIDO, AGUA } from './blocos.js';
import * as F from './fisica-veiculos.js';

export const CORES_VEICULO = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xf5f5f5, 0xfb8c00, 0xf48fb1, 0x8e24aa];

const PNEU = 0x262626, CINZA = 0x9a9a9a, VIDRO = 0xa8dcff, BANCO = 0x6b4426, PRETO = 0x333333, FAROL = 0xfff3b0,
  LANTERNA = 0xe53935, BRANCO = 0xf4f4f4, MADEIRA = 0xa8743f;
const c = caixa;
const espelhar = (f) => [f(1), f(-1)];

// assento: [x, altura do quadril, z, pose, giro]; pose: s = sentado, p = pedalando, e = em pé
export const TIPOS = {
  carro: {
    nome: 'Carro', meio: 'terra', L: 3.4, W: 1.8, H: 1.3, vmax: 16, acel: 7, giro: 1.9, som: 'motor', buzina: 'carro',
    assentos: [[-0.4, 1.04, -0.1], [0.4, 1.04, -0.1], [-0.4, 1.04, 0.8], [0.4, 1.04, 0.8]],
    rodas: [[0.85, 0.38, -1.05, 0.38, 0.3, 1], [-0.85, 0.38, -1.05, 0.38, 0.3, 1], [0.85, 0.38, 1.05, 0.38, 0.3], [-0.85, 0.38, 1.05, 0.38, 0.3]],
    desenho: (cor) => [
      c(1.8, 0.55, 3.4, cor, 0, 0.65, 0), c(1.7, 0.15, 1.0, cor, 0, 0.98, -1.15), c(1.7, 0.15, 0.6, cor, 0, 0.98, 1.38),
      ...espelhar((s) => c(0.12, 0.35, 1.7, cor, s * 0.84, 1.1, 0.25)),
      c(1.6, 0.42, 0.08, VIDRO, 0, 1.25, -0.62), c(1.66, 0.07, 0.12, PRETO, 0, 1.48, -0.62),
      ...espelhar((s) => c(0.6, 0.1, 0.55, BANCO, s * 0.4, 0.98, -0.05)), ...espelhar((s) => c(0.6, 0.5, 0.12, BANCO, s * 0.4, 1.25, 0.24)),
      c(1.4, 0.1, 0.55, BANCO, 0, 0.98, 0.85), c(1.4, 0.5, 0.12, BANCO, 0, 1.25, 1.12),
      c(0.36, 0.36, 0.06, PRETO, -0.4, 1.22, -0.5),
      ...espelhar((s) => c(0.32, 0.15, 0.04, FAROL, s * 0.6, 0.8, -1.72)), ...espelhar((s) => c(0.32, 0.12, 0.04, LANTERNA, s * 0.6, 0.8, 1.72)),
      c(1.84, 0.14, 0.12, CINZA, 0, 0.45, -1.74), c(1.84, 0.14, 0.12, CINZA, 0, 0.45, 1.74),
    ],
  },
  jipe: {
    nome: 'Jipe', meio: 'terra', L: 3.5, W: 1.9, H: 1.6, vmax: 14, acel: 7, giro: 1.8, som: 'motor', buzina: 'carro', grave: 0.9,
    assentos: [[-0.42, 1.36, -0.15], [0.42, 1.36, -0.15], [-0.42, 1.36, 0.85], [0.42, 1.36, 0.85]],
    rodas: [[0.92, 0.5, -1.15, 0.5, 0.38, 1], [-0.92, 0.5, -1.15, 0.5, 0.38, 1], [0.92, 0.5, 1.15, 0.5, 0.38], [-0.92, 0.5, 1.15, 0.5, 0.38]],
    desenho: (cor) => [
      c(1.9, 0.7, 3.3, cor, 0, 0.95, 0), c(1.0, 0.35, 0.05, PRETO, 0, 1.05, -1.66),
      ...espelhar((s) => c(0.32, 0.2, 0.05, FAROL, s * 0.68, 1.12, -1.66)),
      ...espelhar((s) => c(0.5, 0.08, 0.9, PRETO, s * 0.92, 1.32, -1.15)), ...espelhar((s) => c(0.5, 0.08, 0.9, PRETO, s * 0.92, 1.32, 1.15)),
      c(1.7, 0.5, 0.08, VIDRO, 0, 1.6, -0.75), c(1.76, 0.07, 0.12, PRETO, 0, 1.86, -0.75),
      ...espelhar((s) => c(0.1, 0.95, 0.1, PRETO, s * 0.9, 1.78, 0.4)), c(1.9, 0.1, 0.1, PRETO, 0, 2.25, 0.4),
      ...espelhar((s) => c(0.6, 0.1, 0.55, BANCO, s * 0.42, 1.31, -0.1)), ...espelhar((s) => c(0.6, 0.55, 0.12, BANCO, s * 0.42, 1.6, 0.2)),
      c(1.5, 0.1, 0.55, BANCO, 0, 1.31, 0.9), c(1.5, 0.55, 0.12, BANCO, 0, 1.6, 1.18),
      c(0.36, 0.36, 0.06, PRETO, -0.42, 1.55, -0.55),
      c(0.8, 0.8, 0.25, PNEU, 0, 1.15, 1.78), c(0.4, 0.4, 0.27, CINZA, 0, 1.15, 1.78),
    ],
  },
  esportivo: {
    nome: 'Esportivo', meio: 'terra', L: 3.9, W: 1.9, H: 1.0, vmax: 24, acel: 11, giro: 2.0, som: 'motor', buzina: 'carro', grave: 1.25,
    assentos: [[-0.4, 0.8, 0.2], [0.4, 0.8, 0.2]],
    rodas: [[0.9, 0.34, -1.3, 0.34, 0.34, 1], [-0.9, 0.34, -1.3, 0.34, 0.34, 1], [0.9, 0.34, 1.25, 0.34, 0.36], [-0.9, 0.34, 1.25, 0.34, 0.36]],
    desenho: (cor) => [
      c(1.9, 0.45, 3.9, cor, 0, 0.5, 0), c(1.8, 0.14, 1.4, cor, 0, 0.78, -1.15), c(1.8, 0.14, 0.9, cor, 0, 0.78, 1.45),
      c(0.3, 0.02, 3.92, BRANCO, 0, 0.73, 0), c(0.3, 0.02, 1.42, BRANCO, 0, 0.86, -1.15),
      c(1.6, 0.28, 0.08, VIDRO, 0, 0.95, -0.42),
      ...espelhar((s) => c(0.6, 0.08, 0.6, PRETO, s * 0.4, 0.74, 0.25)), ...espelhar((s) => c(0.6, 0.5, 0.12, PRETO, s * 0.4, 0.98, 0.55)),
      c(1.9, 0.08, 0.45, PRETO, 0, 1.18, 1.75), ...espelhar((s) => c(0.08, 0.36, 0.08, PRETO, s * 0.6, 0.98, 1.75)),
      ...espelhar((s) => c(0.4, 0.1, 0.04, FAROL, s * 0.6, 0.62, -1.96)), ...espelhar((s) => c(0.4, 0.1, 0.04, LANTERNA, s * 0.6, 0.62, 1.96)),
      c(0.34, 0.34, 0.06, PRETO, -0.4, 0.98, -0.2),
    ],
  },
  quadriciclo: {
    nome: 'Quadriciclo', meio: 'terra', L: 2.2, W: 1.4, H: 1.2, vmax: 15, acel: 9, giro: 2.4, som: 'motor', buzina: 'carro', grave: 1.15,
    assentos: [[0, 1.08, -0.05], [0, 1.1, 0.5]],
    rodas: [[0.6, 0.38, -0.75, 0.38, 0.36, 1], [-0.6, 0.38, -0.75, 0.38, 0.36, 1], [0.6, 0.38, 0.75, 0.38, 0.36], [-0.6, 0.38, 0.75, 0.38, 0.36]],
    desenho: (cor) => [
      c(0.7, 0.4, 1.8, cor, 0, 0.75, 0), c(1.1, 0.08, 0.5, PRETO, 0, 1.0, -0.8), c(1.1, 0.08, 0.45, PRETO, 0, 1.0, 0.85),
      c(0.5, 0.14, 0.95, BANCO, 0, 1.0, 0.2), c(0.9, 0.06, 0.06, PRETO, 0, 1.36, -0.45), c(0.06, 0.38, 0.06, PRETO, 0, 1.16, -0.45),
      ...espelhar((s) => c(0.42, 0.06, 0.72, cor, s * 0.6, 0.84, -0.75)), ...espelhar((s) => c(0.42, 0.06, 0.72, cor, s * 0.6, 0.84, 0.75)),
      c(0.24, 0.16, 0.06, FAROL, 0, 0.9, -0.92),
    ],
  },
  moto: {
    nome: 'Moto', meio: 'terra', L: 2.0, W: 0.7, H: 1.3, vmax: 20, acel: 10, giro: 2.4, som: 'motor', buzina: 'carro', grave: 1.4, inclina: true,
    assentos: [[0, 1.04, 0.05], [0, 1.08, 0.55]],
    rodas: [[0, 0.38, -0.75, 0.38, 0.16, 1], [0, 0.38, 0.75, 0.38, 0.18]],
    desenho: (cor) => [
      c(0.3, 0.35, 1.2, cor, 0, 0.75, 0), c(0.42, 0.3, 0.55, cor, 0, 1.0, -0.28), c(0.36, 0.12, 0.85, PRETO, 0, 0.98, 0.32),
      ...espelhar((s) => c(0.06, 0.62, 0.06, CINZA, s * 0.11, 0.78, -0.72)), c(0.8, 0.06, 0.06, PRETO, 0, 1.25, -0.6),
      c(0.22, 0.2, 0.1, FAROL, 0, 1.1, -0.8), c(0.1, 0.1, 0.8, CINZA, 0.22, 0.5, 0.4), c(0.14, 0.08, 0.04, LANTERNA, 0, 1.0, 0.76),
    ],
  },
  bicicleta: {
    nome: 'Bicicleta', meio: 'terra', L: 1.7, W: 0.5, H: 1.2, vmax: 9, acel: 6, giro: 2.4, som: 'pedal', buzina: 'campainha', inclina: true,
    assentos: [[0, 0.95, 0.18, 'p']],
    rodas: [[0, 0.35, -0.58, 0.35, 0.08, 1], [0, 0.35, 0.58, 0.35, 0.08]],
    desenho: (cor) => [
      c(0.07, 0.07, 1.0, cor, 0, 0.72, -0.05), c(0.07, 0.5, 0.07, cor, 0, 0.6, 0.15), c(0.07, 0.07, 0.62, cor, 0, 0.42, 0.38),
      c(0.07, 0.42, 0.07, cor, 0, 0.56, -0.5), c(0.22, 0.07, 0.32, PRETO, 0, 0.9, 0.2), c(0.06, 0.38, 0.06, CINZA, 0, 0.86, -0.56),
      c(0.62, 0.05, 0.05, PRETO, 0, 1.05, -0.52), c(0.36, 0.24, 0.26, 0xc8a165, 0, 0.92, -0.76), c(0.08, 0.14, 0.14, CINZA, 0, 0.36, 0),
    ],
  },
  skate: {
    nome: 'Skate', meio: 'terra', L: 1.0, W: 0.4, H: 0.3, vmax: 9, acel: 6, giro: 2.6, som: 'skate', buzina: 'apito', inclina: true,
    assentos: [[0, 0.22, 0, 'e', Math.PI / 2]],
    rodas: [[0.13, 0.07, -0.34, 0.07, 0.08], [-0.13, 0.07, -0.34, 0.07, 0.08], [0.13, 0.07, 0.34, 0.07, 0.08], [-0.13, 0.07, 0.34, 0.07, 0.08]],
    desenho: (cor) => [c(0.38, 0.06, 0.96, cor, 0, 0.17, 0), c(0.34, 0.06, 0.1, cor, 0, 0.21, -0.5), c(0.34, 0.06, 0.1, cor, 0, 0.21, 0.5), c(0.3, 0.04, 0.04, CINZA, 0, 0.13, -0.34), c(0.3, 0.04, 0.04, CINZA, 0, 0.13, 0.34)],
  },
  trator: {
    nome: 'Trator', meio: 'terra', L: 3.2, W: 1.9, H: 2.0, vmax: 8, acel: 5, giro: 1.7, som: 'motor', buzina: 'caminhao', grave: 0.65,
    assentos: [[0, 1.56, 0.55], [0.86, 1.62, 0.85]],
    rodas: [[0.85, 0.75, 0.8, 0.75, 0.42], [-0.85, 0.75, 0.8, 0.75, 0.42], [0.65, 0.4, -1.1, 0.4, 0.28, 1], [-0.65, 0.4, -1.1, 0.4, 0.28, 1]],
    desenho: (cor) => [
      c(0.95, 0.85, 1.9, cor, 0, 1.1, -0.65), c(0.7, 0.4, 0.05, PRETO, 0, 1.1, -1.62), c(0.14, 0.65, 0.14, PRETO, 0.25, 1.85, -1.05),
      c(1.0, 0.25, 1.4, PRETO, 0, 0.75, 0.6), c(0.62, 0.12, 0.55, PRETO, 0, 1.5, 0.6), c(0.62, 0.5, 0.12, PRETO, 0, 1.75, 0.92),
      ...espelhar((s) => c(0.48, 0.1, 1.3, cor, s * 0.85, 1.58, 0.8)), c(0.06, 0.5, 0.06, PRETO, 0, 1.55, 0.05),
      c(0.38, 0.06, 0.38, PRETO, 0, 1.82, 0.1), ...espelhar((s) => c(0.22, 0.18, 0.05, FAROL, s * 0.3, 1.35, -1.62)),
    ],
  },
  caminhao: {
    nome: 'Caminhão', meio: 'terra', L: 6.4, W: 2.2, H: 3.0, vmax: 12, acel: 4.5, giro: 1.4, som: 'motor', buzina: 'caminhao', grave: 0.6,
    assentos: [[-0.5, 1.76, -2.05], [0.5, 1.76, -2.05], [-0.6, 1.18, 0.1], [0.6, 1.18, 0.1], [-0.6, 1.18, 1.5], [0.6, 1.18, 1.5]],
    rodas: [[1.0, 0.5, -2.2, 0.5, 0.36, 1], [-1.0, 0.5, -2.2, 0.5, 0.36, 1], [1.0, 0.5, 1.3, 0.5, 0.36], [-1.0, 0.5, 1.3, 0.5, 0.36], [1.0, 0.5, 2.4, 0.5, 0.36], [-1.0, 0.5, 2.4, 0.5, 0.36]],
    desenho: (cor) => [
      c(1.9, 0.3, 6.2, PRETO, 0, 0.75, 0.1),
      c(2.2, 0.85, 1.9, cor, 0, 1.3, -2.25), c(2.24, 0.16, 1.9, cor, 0, 2.95, -2.25),
      ...espelhar((s) => c(0.14, 1.25, 0.14, cor, s * 1.03, 2.3, -3.12)), ...espelhar((s) => c(0.14, 1.25, 0.3, cor, s * 1.03, 2.3, -1.4)),
      c(2.2, 1.25, 0.12, cor, 0, 2.3, -1.34), c(1.9, 0.08, 0.08, PRETO, 0, 2.2, -3.18),
      ...espelhar((s) => c(0.6, 0.12, 0.6, BANCO, s * 0.5, 1.7, -2.0)), c(0.4, 0.4, 0.06, PRETO, -0.5, 2.0, -2.6),
      c(1.4, 0.45, 0.05, PRETO, 0, 1.15, -3.21), ...espelhar((s) => c(0.32, 0.2, 0.05, FAROL, s * 0.85, 1.2, -3.21)),
      c(2.24, 0.16, 0.14, CINZA, 0, 0.7, -3.24),
      c(2.2, 0.16, 4.1, MADEIRA, 0, 1.02, 0.95), ...espelhar((s) => c(0.12, 0.6, 4.1, MADEIRA, s * 1.04, 1.4, 0.95)),
      c(2.2, 0.6, 0.12, MADEIRA, 0, 1.4, 2.95), ...espelhar((s) => c(0.3, 0.12, 0.04, LANTERNA, s * 0.8, 0.85, 3.03)),
    ],
  },
  onibus: {
    nome: 'Ônibus', meio: 'terra', L: 8, W: 2.5, H: 3.2, vmax: 11, acel: 4, giro: 1.25, som: 'motor', buzina: 'caminhao', grave: 0.55,
    assentos: [[-0.7, 1.82, -3.2], ...[-1.7, -0.3, 1.1, 2.5].flatMap((z) => [[-0.68, 1.82, z], [0.68, 1.82, z]])],
    rodas: [[1.15, 0.55, -2.6, 0.55, 0.36, 1], [-1.15, 0.55, -2.6, 0.55, 0.36, 1], [1.15, 0.55, 2.6, 0.55, 0.36], [-1.15, 0.55, 2.6, 0.55, 0.36]],
    desenho: (cor) => {
      const g = [c(2.5, 1.1, 8, cor, 0, 1.15, 0), c(2.52, 0.18, 8.02, BRANCO, 0, 1.45, 0), c(2.5, 0.22, 8, BRANCO, 0, 3.15, 0),
        c(2.5, 1.3, 0.12, cor, 0, 2.38, 3.94), c(2.5, 0.25, 0.12, cor, 0, 2.95, -3.94), c(1.4, 0.2, 0.06, PRETO, 0, 2.9, -4.0),
        ...espelhar((s) => c(0.34, 0.2, 0.05, FAROL, s * 0.9, 0.95, -4.01)), ...espelhar((s) => c(0.3, 0.2, 0.05, LANTERNA, s * 0.95, 1.0, 4.01)),
        c(0.4, 0.4, 0.06, PRETO, -0.7, 2.1, -3.65), c(0.6, 0.12, 0.55, BANCO, -0.7, 1.76, -3.15)];
      for (let z = -3.9; z <= 3.95; z += 1.3) for (const s of [1, -1]) g.push(c(0.12, 1.3, 0.14, cor, s * 1.19, 2.38, Math.min(z, 3.88)));
      for (const z of [-1.7, -0.3, 1.1, 2.5]) for (const s of [1, -1]) g.push(c(0.62, 0.12, 0.55, BANCO, s * 0.68, 1.76, z + 0.05), c(0.62, 0.5, 0.1, BANCO, s * 0.68, 2.0, z + 0.36));
      return g;
    },
  },
  barco: {
    nome: 'Barco', meio: 'agua', L: 4.4, W: 1.9, H: 1.1, vmax: 13, acel: 6, giro: 1.6, som: 'motor', buzina: 'barco', grave: 0.8,
    assentos: [[-0.42, 0.62, -0.3], [0.42, 0.62, -0.3], [-0.42, 0.62, 0.95], [0.42, 0.62, 0.95]],
    rodas: [],
    desenho: (cor) => [
      c(1.9, 0.5, 3.6, BRANCO, 0, 0.25, 0.2), c(1.92, 0.16, 3.62, cor, 0, 0.09, 0.2), c(1.4, 0.5, 0.6, BRANCO, 0, 0.3, -1.85), c(0.7, 0.5, 0.4, cor, 0, 0.36, -2.3),
      ...espelhar((s) => c(0.1, 0.35, 3.6, cor, s * 0.92, 0.66, 0.2)), c(1.9, 0.35, 0.1, cor, 0, 0.66, 1.98),
      c(1.4, 0.36, 0.06, VIDRO, 0, 0.88, -0.85), c(0.4, 0.7, 0.4, PRETO, 0, 0.6, 2.2),
      ...espelhar((s) => c(0.6, 0.1, 0.5, BANCO, s * 0.42, 0.57, -0.25)), c(1.5, 0.1, 0.5, BANCO, 0, 0.57, 1.0), c(0.34, 0.34, 0.06, PRETO, -0.42, 0.85, -0.65),
    ],
  },
  aviao: {
    nome: 'Avião', meio: 'ar', L: 5, W: 1.2, H: 1.7, vmax: 26, acel: 7, giro: 1.3, som: 'motor', buzina: 'carro', grave: 1.1, decola: 10,
    assentos: [[0, 1.34, -0.55], [0, 1.34, 0.55]],
    rodas: [[0.7, 0.3, -1.2, 0.3, 0.2], [-0.7, 0.3, -1.2, 0.3, 0.2], [0, 0.18, 2.1, 0.18, 0.12]],
    helice: { pos: [0, 1.1, -2.78], eixo: 'z', desenho: () => [c(0.14, 1.9, 0.06, PRETO, 0, 0, 0), c(0.2, 0.2, 0.12, CINZA, 0, 0, -0.04)] },
    desenho: (cor) => [
      c(1.0, 1.0, 4.4, cor, 0, 1.1, 0.1), c(0.84, 0.84, 0.4, BRANCO, 0, 1.1, -2.32), c(0.7, 0.6, 1.0, cor, 0, 1.2, 2.7),
      c(6.6, 0.12, 1.2, cor, 0, 1.18, -0.45), ...espelhar((s) => c(0.5, 0.13, 1.22, BRANCO, s * 2.9, 1.18, -0.45)),
      c(0.1, 0.9, 0.8, cor, 0, 1.9, 2.8), c(2.2, 0.1, 0.6, cor, 0, 1.5, 2.9),
      c(0.8, 0.26, 0.06, VIDRO, 0, 1.74, -1.0), c(0.8, 0.22, 0.06, VIDRO, 0, 1.72, 0.1),
      ...espelhar((s) => c(0.08, 0.5, 0.08, PRETO, s * 0.7, 0.55, -1.2)), c(0.08, 0.6, 0.08, PRETO, 0, 0.5, 2.1),
      c(0.7, 0.1, 0.6, BANCO, 0, 1.3, -0.5), c(0.7, 0.1, 0.6, BANCO, 0, 1.3, 0.6),
    ],
  },
  helicoptero: {
    nome: 'Helicóptero', meio: 'helice', L: 4.6, W: 1.8, H: 2.4, vmax: 14, acel: 6, giro: 1.6, som: 'helice', buzina: 'carro', grave: 1.2,
    assentos: [[-0.45, 0.88, -0.55], [0.45, 0.88, -0.55], [-0.45, 0.88, 0.55], [0.45, 0.88, 0.55]],
    rodas: [],
    helice: { pos: [0, 2.48, 0], eixo: 'y', desenho: () => [c(6.2, 0.06, 0.3, PRETO, 0, 0, 0), c(0.3, 0.06, 6.2, PRETO, 0, 0, 0), c(0.3, 0.25, 0.3, CINZA, 0, -0.1, 0)] },
    desenho: (cor) => [
      ...espelhar((s) => c(0.12, 0.1, 3.0, PRETO, s * 0.8, 0.05, 0)), ...espelhar((s) => c(0.08, 0.4, 0.08, PRETO, s * 0.8, 0.28, -0.8)), ...espelhar((s) => c(0.08, 0.4, 0.08, PRETO, s * 0.8, 0.28, 0.8)),
      c(1.8, 0.3, 2.5, cor, 0, 0.6, 0), c(1.7, 1.05, 0.36, VIDRO, 0, 1.25, -1.35), c(1.8, 0.16, 2.5, cor, 0, 2.3, 0),
      c(1.8, 1.55, 0.16, cor, 0, 1.5, 1.18), ...espelhar((s) => c(0.12, 1.55, 0.12, cor, s * 0.85, 1.5, -1.18)),
      c(0.42, 0.42, 2.4, cor, 0, 1.75, 2.4), c(0.1, 0.9, 0.55, cor, 0, 2.15, 3.45), c(0.08, 0.8, 0.12, PRETO, 0.12, 2.15, 3.55),
      ...espelhar((s) => c(0.6, 0.1, 0.55, BANCO, s * 0.45, 0.82, -0.5)), c(1.5, 0.1, 0.55, BANCO, 0, 0.82, 0.6), c(1.5, 0.6, 0.12, BANCO, 0, 1.1, 0.95),
      c(0.3, 0.3, 0.06, PRETO, -0.45, 1.2, -0.95),
    ],
  },
};
export const ORDEM = ['carro', 'jipe', 'esportivo', 'quadriciclo', 'moto', 'bicicleta', 'skate', 'trator', 'caminhao', 'onibus', 'barco', 'aviao', 'helicoptero'];

const cacheGeo = new Map();
function geo(chave, fn) { if (!cacheGeo.has(chave)) cacheGeo.set(chave, juntar(fn())); return cacheGeo.get(chave); }
function malha(g) { const m = new THREE.Mesh(g, matModelo); m.castShadow = true; return m; }
function geoRoda(r, w) {
  return geo(`roda${r}|${w}`, () => [c(w, r * 2, r * 2, PNEU), c(w + 0.02, r * 0.9, r * 0.9, CINZA), c(w + 0.03, r * 0.3, r * 1.6, PNEU), c(w + 0.03, r * 1.6, r * 0.3, PNEU)]);
}

export function montarVeiculo(tipo, cor) {
  const d = TIPOS[tipo];
  const grupo = new THREE.Group();
  const corpo = new THREE.Group(); // corpo inclina (subida, curva) e o grupo só anda e gira
  grupo.add(corpo);
  corpo.add(malha(geo(tipo + cor, () => d.desenho(CORES_VEICULO[cor] ?? CORES_VEICULO[0]))));
  const rodas = d.rodas.map(([x, y, z, r, w, frente]) => {
    const m = malha(geoRoda(r, w));
    m.position.set(x, y, z); m.rotation.order = 'YXZ'; m.userData = { r, frente: !!frente };
    corpo.add(m);
    return m;
  });
  let helice = null;
  if (d.helice) {
    helice = malha(geo('helice' + tipo, d.helice.desenho));
    helice.position.set(...d.helice.pos);
    corpo.add(helice);
  }
  return { grupo, corpo, rodas, helice };
}

// pose do boneco no assento
function posar(b, pose, t = 0) {
  const [bd, be, pd, pe] = b.membros;
  if (pose === 'e') { for (const m of b.membros) m.rotation.x = 0; bd.rotation.z = -0.5; be.rotation.z = 0.5; return; }
  bd.rotation.z = 0; be.rotation.z = 0;
  bd.rotation.x = be.rotation.x = -1.1;
  if (pose === 'p') { pd.rotation.x = -1.0 + Math.sin(t) * 0.45; pe.rotation.x = -1.0 - Math.sin(t) * 0.45; }
  else pd.rotation.x = pe.rotation.x = -Math.PI / 2;
}
function desposar(b) { for (const m of b.membros) { m.rotation.x = 0; m.rotation.z = 0; } }

const v3 = new THREE.Vector3();
const angulo = (a) => ((a % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;

export class Veiculos {
  constructor(cena, mundo, som) {
    this.cena = cena; this.mundo = mundo; this.som = som;
    this.mapa = new Map();
    this.seq = 1;
  }

  // dados: { id, tipo, cor, p:[x,y,z], r: yaw }
  criar(dados) {
    if (!TIPOS[dados.tipo] || this.mapa.has(dados.id)) return this.mapa.get(dados.id) || null;
    const d = TIPOS[dados.tipo];
    const m = montarVeiculo(dados.tipo, dados.cor | 0);
    const [x, y, z] = dados.p;
    const v = {
      id: dados.id, tipo: dados.tipo, cor: dados.cor | 0, d, ...m,
      x, y, z, yaw: dados.r || 0, pitch: 0, roll: 0, vel: 0, lat: 0, vy: 0, yVis: y, noChao: false,
      ocup: new Array(d.assentos.length).fill(null), bonecos: new Array(d.assentos.length).fill(null),
      alvo: null, giroRoda: 0, girohelice: 0, motorLigado: 0, viraRoda: 0, salvo: 0,
    };
    this.mapa.set(v.id, v);
    this.cena.add(v.grupo);
    this.posicionar(v);
    return v;
  }

  remover(id) {
    const v = this.mapa.get(id);
    if (!v) return;
    for (let a = 0; a < v.ocup.length; a++) this.levantar(v, a);
    this.cena.remove(v.grupo);
    this.mapa.delete(id);
  }

  limpar() { for (const id of [...this.mapa.keys()]) this.remover(id); }

  lista() { return [...this.mapa.values()].map((v) => ({ id: v.id, tipo: v.tipo, cor: v.cor, p: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)], r: +v.yaw.toFixed(2) })); }

  // ---------- lugares ----------
  livre(v) { const i = v.ocup.indexOf(null); return i; }
  de(quem) {
    for (const v of this.mapa.values()) { const a = v.ocup.indexOf(quem); if (a >= 0) return { v, a }; }
    return null;
  }
  // coloca alguém (id do jogador) num assento; boneco opcional para desenhar sentado
  ocupar(v, a, quem, boneco) {
    const antes = this.de(quem);
    if (antes) this.desocupar(antes.v, antes.a);
    v.ocup[a] = quem;
    if (boneco) {
      const [x, y, z, pose = 's', giro = 0] = v.d.assentos[a];
      this.cena.remove(boneco.grupo);
      boneco.grupo.position.set(x, y - 0.75, z);
      boneco.grupo.rotation.set(0, Math.PI + giro, 0);
      boneco.pose = pose;
      posar(boneco, pose);
      v.corpo.add(boneco.grupo);
      v.bonecos[a] = boneco;
    }
    if (a === 0) { v.alvo = null; v.vel = 0; v.lat = 0; v.dorme = 0; }
  }
  desocupar(v, a) {
    v.ocup[a] = null;
    this.levantar(v, a);
    if (a === 0) v.vel = 0;
  }
  levantar(v, a) {
    const b = v.bonecos[a];
    if (!b) return;
    v.corpo.remove(b.grupo);
    desposar(b);
    b.grupo.rotation.set(0, v.yaw + Math.PI, 0);
    v.bonecos[a] = null;
    const p = this.posAssento(v, a);
    b.grupo.position.set(p.x, p.y - 0.75, p.z);
    this.cena.add(b.grupo);
  }
  posAssento(v, a, alvo = new THREE.Vector3()) {
    const [x, y, z] = v.d.assentos[a];
    v.grupo.updateMatrixWorld(true);
    return v.corpo.localToWorld(alvo.set(x, y, z));
  }

  // um ponto livre do lado do veículo para descer
  lugarDescer(v, jog) {
    const d = v.d, s = Math.sin(v.yaw), co = Math.cos(v.yaw);
    const op = [[-(d.W / 2 + 0.6), 0], [d.W / 2 + 0.6, 0], [0, d.L / 2 + 0.7], [0, -(d.L / 2 + 0.7)], [-(d.W / 2 + 1.6), 0], [d.W / 2 + 1.6, 0]];
    for (const [lx, lz] of op) {
      const x = v.x + lx * co + lz * s, z = v.z - lx * s + lz * co;
      for (let dy = 0; dy <= 3; dy++) {
        const y = Math.floor(v.y) + dy + 0.01;
        if (!jog.colide(x, y, z)) return { x, y, z };
      }
    }
    return { x: v.x, y: v.y + d.H + 0.3, z: v.z };
  }

  // veículo mais perto (para mostrar o botão "Entrar")
  maisPerto(x, y, z, max = 2.2) {
    let melhor = null, dm = max;
    for (const v of this.mapa.values()) {
      if (Math.abs(y - v.y) > v.d.H + 2) continue;
      const dl = this.local(v, x, z);
      const dx = Math.max(0, Math.abs(dl.x) - v.d.W / 2), dz = Math.max(0, Math.abs(dl.z) - v.d.L / 2);
      const dist = Math.hypot(dx, dz);
      if (dist < dm && v.ocup.includes(null)) { dm = dist; melhor = v; }
    }
    return melhor;
  }

  local(v, x, z) {
    const dx = x - v.x, dz = z - v.z, s = Math.sin(v.yaw), co = Math.cos(v.yaw);
    return { x: dx * co - dz * s, z: dx * s + dz * co };
  }

  // toque/clique no veículo (caixa girada)
  atingir(o, dir, max) {
    let melhor = null, tm = max;
    for (const v of this.mapa.values()) {
      const s = Math.sin(v.yaw), co = Math.cos(v.yaw);
      const ox = o.x - v.x, oz = o.z - v.z;
      const O = [ox * co - oz * s, o.y - v.yVis, ox * s + oz * co], D = [dir.x * co - dir.z * s, dir.y, dir.x * s + dir.z * co];
      const mn = [-v.d.W / 2, 0, -v.d.L / 2], mx = [v.d.W / 2, v.d.H, v.d.L / 2];
      let t0 = 0, t1 = tm, ok = true;
      for (let k = 0; k < 3 && ok; k++) {
        if (Math.abs(D[k]) < 1e-8) { if (O[k] < mn[k] || O[k] > mx[k]) ok = false; continue; }
        let ta = (mn[k] - O[k]) / D[k], tb = (mx[k] - O[k]) / D[k];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok && t0 < tm) { tm = t0; melhor = v; }
    }
    return melhor ? { veiculo: melhor, t: tm } : null;
  }

  // empurra quem anda a pé para fora dos veículos parados (não dá para atravessar)
  empurrar(pos, r = 0.3) {
    for (const v of this.mapa.values()) {
      if (pos.y > v.y + v.d.H - 0.2 || pos.y + 1.7 < v.y) continue;
      const l = this.local(v, pos.x, pos.z);
      const hw = v.d.W / 2 + r, hl = v.d.L / 2 + r;
      if (Math.abs(l.x) < hw && Math.abs(l.z) < hl) {
        let nx = l.x, nz = l.z;
        if (hw - Math.abs(l.x) < hl - Math.abs(l.z)) nx = Math.sign(l.x || 1) * hw; else nz = Math.sign(l.z || 1) * hl;
        const s = Math.sin(v.yaw), co = Math.cos(v.yaw);
        pos.x = v.x + nx * co + nz * s; pos.z = v.z - nx * s + nz * co;
      }
    }
  }

  // ---------- física (em fisica-veiculos.js) ----------
  // caixa inteira do veículo (para achar lugar livre ao criar)
  colide(v, x, y, z, yaw) {
    const d = v.d, m = this.mundo;
    const n = Math.max(1, Math.ceil(d.L / Math.max(d.W, 0.8)));
    const meia = Math.max(0.22, d.W * 0.42);
    const s = Math.sin(yaw), co = Math.cos(yaw);
    const y0 = Math.floor(y + 0.05), y1 = Math.floor(y + Math.min(d.H, 2.6) - 0.05);
    for (let i = 0; i < n; i++) {
      const off = ((i + 0.5) / n - 0.5) * d.L * 0.9;
      const cx = x - s * off, cz = z - co * off;
      for (let bx = Math.floor(cx - meia); bx <= Math.floor(cx + meia); bx++)
        for (let bz = Math.floor(cz - meia); bz <= Math.floor(cz + meia); bz++)
          for (let by = y0; by <= y1; by++) if (SOLIDO[m.bloco(bx, by, bz)]) return true;
    }
    return false;
  }
  // paredes ao andar (só acima do degrau de 1 bloco, com a caixa inclinada junto com o chão)
  colideCorpo(v, x, y, z, yaw, pitch) { return F.colideCorpo(this, v, x, y, z, yaw, pitch); }

  // água: superfície (ou null), fração submersa 0..1 e empuxo (veja empuxo() em fisica-veiculos.js)
  nivelAgua(v) { return F.nivelAgua(this, v); }
  submersao(v) { return F.submersao(this, v); }
  empuxo(v, dt, densidade) { return F.empuxo(this, v, dt, densidade); }
  naAgua(v) { return F.submersao(this, v) > 0; }
  afundado(v) { return F.submersao(this, v) >= 0.99; }
  boiar(v, dt) { if (!this.empuxo(v, dt)) v.vy -= F.GRAV * dt; }

  // altura do chão (ou da água) perto de y
  chaoPerto(x, y, z) {
    const bx = Math.floor(x), bz = Math.floor(z);
    for (let by = Math.floor(y) + 1; by > y - 3; by--) { const b = this.mundo.bloco(bx, by - 1, bz); if (SOLIDO[b] || AGUA[b]) return by; }
    return y - 3;
  }
  // pose do chão pelas 4 rodas: { y, p (pitch), r (roll), bloco }
  chaoRodas(v) { return F.chaoRodas(this, v); }

  // ent: { frente, lado, subir, descer }; obst: [{x,z}] (bichos e pessoas: o veículo freia antes)
  dirigir(v, dt, ent, obst) {
    v.dorme = 0;
    F.passo(this, v, dt, ent, obst, true);
    this.posicionar(v, dt);
  }

  // veículo sem motorista: cai, boia, escorrega até parar e depois dorme
  assentar(v, dt) {
    if (v.dorme > dt) { v.dorme -= dt; return; }
    F.assentar(this, v, dt);
    this.posicionar(v, dt);
  }

  posicionar(v, dt = 1) { // eslint-disable-line no-unused-vars
    v.yVis = v.y; // a física já anda suave (degraus sobem aos poucos)
    v.grupo.position.set(v.x, v.yVis, v.z);
    v.grupo.rotation.set(0, v.yaw, 0);
    v.corpo.rotation.set(v.pitch, 0, v.roll, 'YXZ');
    // suspensão: o corpo sobe e desce na mola e as rodas ficam no chão
    const h = v.su ? v.su.h : 0;
    v.corpo.position.y = h;
    for (const r of v.rodas) { if (r.userData.y0 === undefined) r.userData.y0 = r.position.y; r.position.y = r.userData.y0 - h; }
  }

  // pose vinda da rede (motorista é outra pessoa)
  aplicarPose(id, p, r, s) {
    const v = this.mapa.get(id);
    if (!v) return;
    v.alvo = { x: p[0], y: p[1], z: p[2], yaw: r[0] || 0, pitch: r[1] || 0, roll: r[2] || 0 };
    v.velRede = s || 0;
  }

  // anima tudo; quem é dirigido por mim é atualizado antes, em dirigir()
  atualizar(dt, meu, perto) {
    for (const v of this.mapa.values()) {
      const longe = Math.hypot(v.x - perto.x, v.z - perto.z) > 120;
      if (v !== meu) {
        if (v.alvo) {
          const k = Math.min(1, dt * 8);
          if (Math.hypot(v.alvo.x - v.x, v.alvo.z - v.z) > 20) { v.x = v.alvo.x; v.z = v.alvo.z; v.y = v.yVis = v.alvo.y; }
          v.x += (v.alvo.x - v.x) * k; v.y += (v.alvo.y - v.y) * k; v.z += (v.alvo.z - v.z) * k;
          v.yaw += angulo(v.alvo.yaw - v.yaw) * k; v.pitch += (v.alvo.pitch - v.pitch) * k; v.roll += (v.alvo.roll - v.roll) * k;
          v.vel = v.velRede || 0;
          v.yVis = v.y;
          this.posicionar(v, dt);
        } else if (v.ocup[0] === null && !longe) this.assentar(v, dt);
      }
      if (longe) continue;
      // rodas, hélice e pedaladas
      v.giroRoda += v.vel * dt;
      for (const r of v.rodas) {
        r.rotation.x = -v.giroRoda / r.userData.r;
        r.rotation.y = r.userData.frente ? (v === meu ? v.viraRoda : 0) : 0;
      }
      if (v.helice) {
        const ligado = v.ocup[0] !== null || !v.noChao;
        v.motorLigado += ((ligado ? 1 : 0) - v.motorLigado) * Math.min(1, dt * (ligado ? 1.5 : 0.5));
        v.girohelice += dt * (v.d.meio === 'helice' ? 22 : 8 + Math.abs(v.vel) * 1.5) * v.motorLigado;
        if (v.d.helice.eixo === 'y') v.helice.rotation.y = v.girohelice; else v.helice.rotation.z = v.girohelice;
      }
      for (const b of v.bonecos) if (b && b.pose === 'p') posar(b, 'p', v.giroRoda * 2.2);
    }
  }

  buzinar(v, vol = 1) { this.som.buzina(v.d.buzina, vol); }
}

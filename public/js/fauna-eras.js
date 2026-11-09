// Bichos das eras do mundo "Linha do Tempo" (dinossauros, Era do Gelo, bichos antigos e o robô-cão do futuro).
// Mesmo formato de ESPECIES (modelos.js): montar(r) devolve corpo/cabeca/cabecaPos/pernas feitos de caixa().
// Extras opcionais: asas [[geos, x, y, z, lado]] (batem com o voo), brilho / cabecaBrilho (partes que brilham).
// Campos extras: voa (plana no alto e às vezes pousa), velVoo, passo (ritmo das pernas: grandões andam devagar),
// bando (quantos nascem juntos, no máximo), afunda (quanto o corpo afunda na água; padrão 0.45).
// Tudo fofo: olhinhos pretos, bochechas rosadas, nada de dentes afiados nem garras.
import { ESPECIES, caixa } from './modelos.js';
import { registrarInstinto } from './instintos.js';

const PRETO = 0x222222, BRANCO = 0xffffff, ROSA = 0xf4a6b8;

// cor mais escura/clara (f < 1 escurece)
function tom(c, f) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f)), g = Math.min(255, Math.round(((c >> 8) & 255) * f)), b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}
// par de olhos na face da frente (z), com um pontinho de brilho que deixa o olhar fofo
function olhos(dx, y, z, s = 0.08, brilho = true) {
  const o = [caixa(s, s * 1.15, 0.02, PRETO, -dx, y, z), caixa(s, s * 1.15, 0.02, PRETO, dx, y, z)];
  if (brilho && s >= 0.08) o.push(caixa(s * 0.35, s * 0.35, 0.02, BRANCO, -dx + s * 0.2, y + s * 0.25, z + 0.006), caixa(s * 0.35, s * 0.35, 0.02, BRANCO, dx + s * 0.2, y + s * 0.25, z + 0.006));
  return o;
}
const bochechas = (dx, y, z, s = 0.08) => [caixa(s, s * 0.6, 0.02, ROSA, -dx, y, z), caixa(s, s * 0.6, 0.02, ROSA, dx, y, z)];
// quatro pernas iguais: [w, h, d, cor, posições] (frente esquerda, frente direita, trás esquerda, trás direita)
const quatro = (w, h, d, cor, x, zf, zt = -zf) => [[w, h, d, cor, [[-x, h, zf], [x, h, zf], [-x, h, zt], [x, h, zt]]]];

export const ESPECIES_ERAS = {
  // ---------- Era dos Dinossauros ----------
  braquiossauro: {
    nome: 'Braquiossauro', vel: 0.55, alt: 4.45, raio: 1.0, som: 'uooo', passo: 0.5,
    montar(r) {
      const c = r < 0.5 ? 0x7fc8a9 : 0x96b4ea, esc = tom(c, 0.78), barriga = 0xeaf4cf;
      return {
        corpo: [
          caixa(1.3, 1.1, 2.3, c, 0, 1.85, 0), caixa(1.1, 0.12, 1.9, barriga, 0, 1.28, 0),
          caixa(0.45, 0.06, 0.45, esc, 0.25, 2.42, 0.35), caixa(0.32, 0.06, 0.32, esc, -0.3, 2.42, -0.5), caixa(0.25, 0.06, 0.25, esc, 0.3, 2.42, -0.85),
          // pescoção subindo para a frente
          caixa(0.62, 0.8, 0.72, c, 0, 2.55, 1.05), caixa(0.54, 0.7, 0.56, c, 0, 3.15, 1.32), caixa(0.48, 0.65, 0.5, c, 0, 3.65, 1.52),
          caixa(0.3, 0.6, 0.06, barriga, 0, 3.1, 1.6),
          // cauda
          caixa(0.62, 0.56, 1.0, c, 0, 1.95, -1.6), caixa(0.42, 0.4, 0.9, c, 0, 1.78, -2.5), caixa(0.24, 0.24, 0.7, c, 0, 1.62, -3.2),
        ],
        cabeca: [caixa(0.62, 0.5, 0.86, c, 0, 0.05, 0.22), caixa(0.36, 0.16, 0.32, c, 0, 0.36, 0.08),
          ...olhos(0.17, 0.12, 0.66, 0.1), ...bochechas(0.24, -0.04, 0.66), caixa(0.18, 0.04, 0.02, esc, 0, -0.1, 0.66)],
        cabecaPos: [0, 4.0, 1.62],
        pernas: quatro(0.46, 1.35, 0.46, esc, 0.44, 0.75),
      };
    },
  },
  triceratops: {
    nome: 'Tricerátops', vel: 0.75, alt: 1.85, raio: 0.65, som: 'muu', passo: 0.8,
    montar(r) {
      const c = r < 0.5 ? 0xf2a65a : 0x8fc3e8, esc = tom(c, 0.8), barriga = 0xfbe6bd;
      const gola = r < 0.5 ? 0x9b7fd4 : 0xf48fb1, borda = tom(gola, 1.2), chifre = 0xfff3d6;
      return {
        corpo: [caixa(0.95, 0.8, 1.5, c, 0, 0.95, 0), caixa(0.8, 0.1, 1.2, barriga, 0, 0.53, 0),
          caixa(0.3, 0.05, 0.3, esc, 0.2, 1.37, 0.2), caixa(0.24, 0.05, 0.24, esc, -0.22, 1.37, -0.3),
          caixa(0.42, 0.36, 0.7, c, 0, 1.0, -1.05), caixa(0.24, 0.22, 0.5, c, 0, 0.9, -1.6)],
        cabeca: [caixa(0.66, 0.55, 0.6, c, 0, 0, 0.25), caixa(0.42, 0.3, 0.26, c, 0, -0.1, 0.66), caixa(0.24, 0.16, 0.08, tom(c, 0.9), 0, -0.13, 0.8),
          caixa(1.15, 0.8, 0.12, gola, 0, 0.32, -0.04), caixa(0.8, 0.16, 0.12, gola, 0, 0.78, -0.04),
          caixa(0.12, 0.12, 0.13, borda, -0.42, 0.62, -0.04), caixa(0.12, 0.12, 0.13, borda, 0.42, 0.62, -0.04), caixa(0.12, 0.12, 0.13, borda, 0, 0.8, -0.04),
          caixa(0.1, 0.26, 0.1, chifre, -0.2, 0.38, 0.42), caixa(0.1, 0.26, 0.1, chifre, 0.2, 0.38, 0.42), caixa(0.09, 0.14, 0.09, chifre, 0, 0.11, 0.72),
          ...olhos(0.18, 0.13, 0.555, 0.09), ...bochechas(0.26, 0.02, 0.555)],
        cabecaPos: [0, 1.12, 0.8],
        pernas: quatro(0.3, 0.6, 0.3, esc, 0.34, 0.5),
      };
    },
  },
  estegossauro: {
    nome: 'Estegossauro', vel: 0.6, alt: 1.85, raio: 0.65, som: 'hmm', passo: 0.8,
    montar(r) {
      const c = r < 0.5 ? 0x9ccc65 : 0xffd166, esc = tom(c, 0.78), barriga = 0xf2f8dc;
      const p1 = r < 0.5 ? 0xff8a80 : 0x4fc3f7, p2 = r < 0.5 ? 0xffb74d : 0x9575cd;
      const placas = [];
      for (let i = -2; i <= 2; i++) {
        const h = 0.38 - Math.abs(i) * 0.07;
        placas.push(caixa(0.1, h, 0.26, i % 2 ? p2 : p1, 0, 1.48 + h / 2, i * 0.3));
      }
      return {
        corpo: [caixa(0.9, 0.75, 1.6, c, 0, 0.92, 0), caixa(0.78, 0.2, 1.0, c, 0, 1.38, -0.05), caixa(0.74, 0.08, 1.3, barriga, 0, 0.52, 0), ...placas,
          caixa(0.36, 0.3, 0.7, c, 0, 0.95, -1.1), caixa(0.22, 0.2, 0.6, c, 0, 0.85, -1.7),
          caixa(0.08, 0.16, 0.16, p1, 0, 1.17, -1.15), caixa(0.07, 0.13, 0.13, p2, 0, 1.0, -1.7)],
        cabeca: [caixa(0.42, 0.36, 0.5, c, 0, 0, 0.2), caixa(0.3, 0.2, 0.12, tom(c, 0.92), 0, -0.07, 0.5),
          ...olhos(0.11, 0.07, 0.455, 0.08), ...bochechas(0.17, -0.04, 0.455, 0.06)],
        cabecaPos: [0, 0.82, 0.85],
        pernas: quatro(0.28, 0.55, 0.28, esc, 0.32, 0.52),
      };
    },
  },
  pterossauro: {
    nome: 'Pterossauro', vel: 0.8, velVoo: 3.2, alt: 1.0, raio: 0.45, som: 'cuaa', voa: true,
    montar(r) {
      const c = r < 0.5 ? 0xb39ddb : 0x4fc3f7, asa = tom(c, 1.15), bico = 0xffd54f, crista = 0xff8a65;
      const asaDe = (lado) => [caixa(1.25, 0.05, 0.55, asa, lado * 0.62, 0, 0), caixa(0.45, 0.05, 0.32, asa, lado * 1.45, 0, 0.08), caixa(0.08, 0.08, 0.08, c, lado * 1.25, 0.04, 0.24)];
      return {
        corpo: [caixa(0.36, 0.36, 0.7, c, 0, 0.55, 0), caixa(0.3, 0.06, 0.55, 0xf3edfb, 0, 0.37, 0.02), caixa(0.08, 0.08, 0.4, c, 0, 0.58, -0.52)],
        cabeca: [caixa(0.3, 0.3, 0.34, c, 0, 0.05, 0.1), caixa(0.12, 0.1, 0.42, bico, 0, -0.03, 0.46), caixa(0.06, 0.22, 0.34, crista, 0, 0.27, -0.08),
          ...olhos(0.09, 0.11, 0.275, 0.07, false), ...bochechas(0.12, 0.0, 0.275, 0.05)],
        cabecaPos: [0, 0.76, 0.4],
        asas: [[asaDe(-1), -0.17, 0.64, 0.04, -1], [asaDe(1), 0.17, 0.64, 0.04, 1]],
        pernas: [[0.08, 0.37, 0.08, 0xffb74d, [[-0.1, 0.37, -0.05], [0.1, 0.37, -0.05]]]],
      };
    },
  },
  rexinho: {
    nome: 'Rexinho', vel: 1.6, alt: 1.45, raio: 0.35, som: 'rawr', segue: true,
    montar(r) {
      const c = r < 0.6 ? 0x8bd17c : r < 0.85 ? 0x7fb8f0 : 0xf49ac1, esc = tom(c, 0.82), barriga = 0xf6f1c8, crista = 0xffb74d;
      return {
        corpo: [caixa(0.55, 0.6, 0.65, c, 0, 0.72, 0), caixa(0.42, 0.46, 0.04, barriga, 0, 0.7, 0.33),
          caixa(0.36, 0.32, 0.5, c, 0, 0.65, -0.5), caixa(0.22, 0.2, 0.45, c, 0, 0.55, -0.95),
          caixa(0.08, 0.08, 0.18, c, -0.2, 0.86, 0.4), caixa(0.08, 0.08, 0.18, c, 0.2, 0.86, 0.4), // bracinhos curtinhos
          caixa(0.08, 0.1, 0.14, crista, 0, 1.07, -0.08), caixa(0.07, 0.09, 0.12, crista, 0, 0.85, -0.5), caixa(0.06, 0.07, 0.1, crista, 0, 0.7, -0.9)],
        cabeca: [caixa(0.6, 0.5, 0.6, c, 0, 0.2, 0.15), caixa(0.5, 0.22, 0.2, c, 0, 0.05, 0.53), caixa(0.08, 0.12, 0.14, crista, 0, 0.5, 0.05),
          caixa(0.04, 0.03, 0.02, esc, -0.1, 0.12, 0.635), caixa(0.04, 0.03, 0.02, esc, 0.1, 0.12, 0.635),
          caixa(0.16, 0.035, 0.02, esc, 0, 0.0, 0.635),
          ...olhos(0.15, 0.3, 0.455, 0.12), ...bochechas(0.22, 0.17, 0.455, 0.09)],
        cabecaPos: [0, 1.0, 0.2],
        pernas: [[0.2, 0.45, 0.24, esc, [[-0.18, 0.45, -0.05], [0.18, 0.45, -0.05]]]],
      };
    },
  },

  // ---------- Era do Gelo ----------
  mamute: {
    nome: 'Mamute', vel: 0.6, alt: 2.75, raio: 0.9, som: 'barrido', passo: 0.6,
    montar(r) {
      const c = r < 0.6 ? 0x9a6440 : 0xb5835a, pelo = tom(c, 0.78), presa = 0xfff3d6;
      return {
        corpo: [caixa(1.35, 1.2, 1.8, c, 0, 1.5, 0), caixa(1.1, 0.35, 1.0, pelo, 0, 2.25, 0.35), caixa(1.42, 0.25, 1.86, pelo, 0, 0.98, 0),
          caixa(0.12, 0.4, 0.12, pelo, 0, 1.6, -0.95)],
        cabeca: [caixa(0.95, 0.9, 0.7, c, 0, 0.1, 0.2), caixa(0.6, 0.22, 0.5, pelo, 0, 0.64, 0.15),
          caixa(0.12, 0.45, 0.42, pelo, -0.53, 0.05, 0.08), caixa(0.12, 0.45, 0.42, pelo, 0.53, 0.05, 0.08),
          caixa(0.26, 0.4, 0.26, c, 0, -0.38, 0.6), caixa(0.22, 0.34, 0.22, c, 0, -0.72, 0.66), caixa(0.2, 0.14, 0.3, c, 0, -0.86, 0.76),
          caixa(0.12, 0.12, 0.42, presa, -0.3, -0.3, 0.68), caixa(0.12, 0.12, 0.42, presa, 0.3, -0.3, 0.68),
          caixa(0.12, 0.26, 0.12, presa, -0.3, -0.2, 0.9), caixa(0.12, 0.26, 0.12, presa, 0.3, -0.2, 0.9),
          ...olhos(0.24, 0.2, 0.555, 0.1), ...bochechas(0.34, 0.02, 0.555, 0.1)],
        cabecaPos: [0, 1.95, 0.95],
        pernas: quatro(0.42, 0.95, 0.42, pelo, 0.42, 0.6),
      };
    },
  },
  preguica: {
    nome: 'Preguiça-gigante', vel: 0.35, alt: 2.0, raio: 0.7, som: 'hmm', passo: 0.5,
    montar() {
      const c = 0xb08d6e, esc = tom(c, 0.75), rosto = 0xf1e3cc, mancha = 0x7a5a40;
      return {
        corpo: [caixa(1.1, 1.0, 1.3, c, 0, 1.15, 0), caixa(0.9, 0.3, 1.0, c, 0, 1.78, 0.05), caixa(0.7, 0.6, 0.06, tom(c, 1.12), 0, 1.1, 0.66),
          caixa(0.3, 0.3, 0.3, c, 0, 0.9, -0.7)],
        cabeca: [caixa(0.62, 0.55, 0.5, c, 0, 0.1, 0.15), caixa(0.48, 0.38, 0.04, rosto, 0, 0.05, 0.415),
          caixa(0.17, 0.1, 0.02, mancha, -0.13, 0.11, 0.43), caixa(0.17, 0.1, 0.02, mancha, 0.13, 0.11, 0.43),
          caixa(0.07, 0.07, 0.02, PRETO, -0.13, 0.12, 0.445), caixa(0.07, 0.07, 0.02, PRETO, 0.13, 0.12, 0.445),
          caixa(0.12, 0.08, 0.03, 0x4a3426, 0, -0.02, 0.44), caixa(0.14, 0.03, 0.02, 0x4a3426, 0, -0.1, 0.44),
          ...bochechas(0.19, -0.05, 0.44, 0.07)],
        cabecaPos: [0, 1.6, 0.75],
        pernas: quatro(0.36, 0.7, 0.36, esc, 0.38, 0.45),
      };
    },
  },
  gliptodonte: {
    nome: 'Gliptodonte', vel: 0.45, alt: 1.4, raio: 0.65, som: 'oinc', passo: 0.8,
    montar(r) {
      const casco = r < 0.5 ? 0x8d6e63 : 0x7f8f6a, padrao = tom(casco, 1.35), pele = 0xd2b394;
      const pontos = [];
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) pontos.push(caixa(0.16, 0.04, 0.16, padrao, i * 0.27, 1.26, j * 0.36));
      return {
        corpo: [caixa(1.15, 0.6, 1.45, casco, 0, 0.7, 0), caixa(0.95, 0.25, 1.2, casco, 0, 1.12, 0), caixa(0.6, 0.12, 0.8, casco, 0, 1.3, 0),
          caixa(1.18, 0.08, 1.48, padrao, 0, 0.55, 0), ...pontos,
          caixa(0.22, 0.22, 0.5, casco, 0, 0.6, -0.9), caixa(0.3, 0.3, 0.26, padrao, 0, 0.6, -1.2)],
        cabeca: [caixa(0.38, 0.32, 0.35, pele, 0, 0, 0.12), caixa(0.36, 0.1, 0.3, casco, 0, 0.2, 0.1),
          caixa(0.08, 0.06, 0.03, 0x6d4c41, 0, -0.06, 0.3), ...olhos(0.1, 0.05, 0.3, 0.07, false), ...bochechas(0.14, -0.06, 0.3, 0.06)],
        cabecaPos: [0, 0.62, 0.8],
        pernas: quatro(0.26, 0.35, 0.26, pele, 0.38, 0.42),
      };
    },
  },
  rena: {
    nome: 'Rena', vel: 1.2, alt: 2.1, raio: 0.45, som: 'hmm', bando: 3,
    montar(r) {
      const c = r < 0.7 ? 0x9c7552 : 0xc4a07a, esc = tom(c, 0.75), peito = 0xf3e9da, chifre = 0xe0c79a;
      const nariz = r < 0.15 ? 0xe53935 : 0x3b2a20;
      const galhos = [];
      for (const s of [-1, 1]) galhos.push(caixa(0.06, 0.3, 0.06, chifre, s * 0.12, 0.32, 0), caixa(0.2, 0.06, 0.06, chifre, s * 0.24, 0.45, 0),
        caixa(0.06, 0.2, 0.06, chifre, s * 0.32, 0.55, 0), caixa(0.06, 0.06, 0.16, chifre, s * 0.12, 0.38, 0.1), caixa(0.06, 0.14, 0.06, chifre, s * 0.22, 0.55, 0));
      return {
        corpo: [caixa(0.6, 0.55, 1.15, c, 0, 0.95, 0), caixa(0.5, 0.4, 0.06, peito, 0, 1.0, 0.6), caixa(0.14, 0.14, 0.08, peito, 0, 1.15, -0.6),
          caixa(0.3, 0.45, 0.3, c, 0, 1.3, 0.5)],
        cabeca: [caixa(0.36, 0.34, 0.42, c, 0, 0, 0.1), caixa(0.24, 0.2, 0.16, peito, 0, -0.08, 0.37), caixa(0.1, 0.08, 0.04, nariz, 0, -0.01, 0.46),
          caixa(0.16, 0.06, 0.1, c, -0.25, 0.12, 0), caixa(0.16, 0.06, 0.1, c, 0.25, 0.12, 0), ...galhos,
          ...olhos(0.1, 0.07, 0.315, 0.07, false)],
        cabecaPos: [0, 1.5, 0.62],
        pernas: quatro(0.14, 0.7, 0.14, esc, 0.22, 0.42),
      };
    },
  },

  // ---------- Idade da Pedra em diante ----------
  lobinho: {
    nome: 'Lobinho', vel: 1.8, alt: 1.1, raio: 0.3, som: 'auau', segue: true,
    montar() {
      const c = 0x9aa5b1, claro = 0xe8ecef, esc = 0x707b88;
      return {
        corpo: [caixa(0.42, 0.42, 0.85, c, 0, 0.55, 0), caixa(0.34, 0.08, 0.6, claro, 0, 0.33, 0.05),
          caixa(0.16, 0.16, 0.4, c, 0, 0.75, -0.55), caixa(0.17, 0.17, 0.12, claro, 0, 0.72, -0.8)],
        cabeca: [caixa(0.42, 0.4, 0.38, c, 0, 0, 0.05), caixa(0.22, 0.18, 0.22, claro, 0, -0.08, 0.3), caixa(0.08, 0.07, 0.04, PRETO, 0, -0.02, 0.42),
          caixa(0.12, 0.2, 0.08, c, -0.13, 0.29, -0.02), caixa(0.12, 0.2, 0.08, c, 0.13, 0.29, -0.02),
          caixa(0.06, 0.1, 0.02, 0xf4b6c2, -0.13, 0.27, 0.025), caixa(0.06, 0.1, 0.02, 0xf4b6c2, 0.13, 0.27, 0.025),
          ...olhos(0.11, 0.08, 0.245, 0.07, false)],
        cabecaPos: [0, 0.82, 0.5],
        pernas: quatro(0.13, 0.35, 0.13, esc, 0.13, 0.28),
      };
    },
  },
  auroque: {
    nome: 'Auroque', vel: 0.8, alt: 1.9, raio: 0.55, som: 'muu',
    montar() {
      const c = 0x6d4c3d, esc = 0x553a2e, faixa = 0xc8a882, chifre = 0xf5ead0, focinho = 0xd9b8a0;
      return {
        corpo: [caixa(1.0, 0.85, 1.45, c, 0, 1.1, 0), caixa(0.14, 0.04, 1.3, faixa, 0, 1.54, 0), caixa(0.1, 0.5, 0.1, esc, 0, 1.15, -0.76)],
        cabeca: [caixa(0.6, 0.55, 0.48, c, 0, 0, 0.12), caixa(0.45, 0.25, 0.12, focinho, 0, -0.13, 0.4), caixa(0.3, 0.1, 0.12, faixa, 0, 0.28, 0.12),
          caixa(0.3, 0.1, 0.1, chifre, -0.42, 0.24, 0.08), caixa(0.3, 0.1, 0.1, chifre, 0.42, 0.24, 0.08),
          caixa(0.1, 0.2, 0.1, chifre, -0.52, 0.38, 0.12), caixa(0.1, 0.2, 0.1, chifre, 0.52, 0.38, 0.12),
          ...olhos(0.17, 0.08, 0.365, 0.08)],
        cabecaPos: [0, 1.45, 0.82],
        pernas: quatro(0.22, 0.68, 0.22, esc, 0.3, 0.5),
      };
    },
  },
  cavalo: {
    nome: 'Cavalo', vel: 1.6, alt: 2.15, raio: 0.5, som: 'relincho',
    montar(r) {
      const v = [[0x9c6b3e, 0x3b2618], [0xf2eee6, 0xc9c0b0], [0x4a4644, 0x1e1c1b], [0xd6a160, 0xf6ead0], [0xb9a48d, 0x6b5a48]][Math.floor(r * 5)];
      const [c, crina] = v, focinho = tom(c, 0.88);
      return {
        corpo: [caixa(0.6, 0.65, 1.3, c, 0, 1.15, 0), caixa(0.32, 0.62, 0.38, c, 0, 1.6, 0.55), caixa(0.12, 0.7, 0.24, crina, 0, 1.72, 0.38),
          caixa(0.16, 0.62, 0.16, crina, 0, 1.12, -0.72)],
        cabeca: [caixa(0.32, 0.34, 0.45, c, 0, 0.05, 0.12), caixa(0.28, 0.22, 0.25, focinho, 0, -0.05, 0.42),
          caixa(0.04, 0.04, 0.02, PRETO, -0.07, -0.04, 0.546), caixa(0.04, 0.04, 0.02, PRETO, 0.07, -0.04, 0.546),
          caixa(0.08, 0.14, 0.06, c, -0.1, 0.28, 0), caixa(0.08, 0.14, 0.06, c, 0.1, 0.28, 0), caixa(0.1, 0.1, 0.22, crina, 0, 0.26, -0.04),
          ...olhos(0.1, 0.13, 0.346, 0.07, false)],
        cabecaPos: [0, 1.85, 0.72],
        pernas: quatro(0.17, 0.85, 0.17, c, 0.2, 0.5),
      };
    },
  },
  cabra: {
    nome: 'Cabra', vel: 1.1, alt: 1.4, raio: 0.35, som: 'bee', bando: 2,
    montar(r) {
      const c = r < 0.5 ? 0xf3efe6 : 0xa58b70, chifre = 0xc8bba5, barba = r < 0.5 ? 0xd9d2c4 : 0xf3efe6;
      return {
        corpo: [caixa(0.5, 0.5, 0.85, c, 0, 0.7, 0), caixa(0.1, 0.16, 0.1, c, 0, 0.98, -0.45)],
        cabeca: [caixa(0.32, 0.32, 0.36, c, 0, 0, 0.08), caixa(0.24, 0.18, 0.14, 0xe9c9bf, 0, -0.08, 0.32),
          caixa(0.07, 0.2, 0.07, chifre, -0.08, 0.24, -0.02), caixa(0.07, 0.2, 0.07, chifre, 0.08, 0.24, -0.02),
          caixa(0.07, 0.07, 0.16, chifre, -0.08, 0.32, -0.12), caixa(0.07, 0.07, 0.16, chifre, 0.08, 0.32, -0.12),
          caixa(0.16, 0.06, 0.08, c, -0.23, 0.05, 0), caixa(0.16, 0.06, 0.08, c, 0.23, 0.05, 0), caixa(0.1, 0.14, 0.08, barba, 0, -0.24, 0.3),
          ...olhos(0.09, 0.06, 0.265, 0.07, false)],
        cabecaPos: [0, 1.0, 0.48],
        pernas: quatro(0.12, 0.45, 0.12, tom(c, 0.9), 0.17, 0.3),
      };
    },
  },
  camelo: {
    nome: 'Camelo', vel: 0.9, alt: 2.45, raio: 0.6, som: 'hmm', passo: 0.8,
    montar() {
      const c = 0xd8b07a, focinho = 0xead3ad, manta = 0xe53935, franja = 0xffd54f;
      return {
        corpo: [caixa(0.7, 0.65, 1.3, c, 0, 1.32, 0), caixa(0.5, 0.34, 0.42, c, 0, 1.82, 0.33), caixa(0.5, 0.34, 0.42, c, 0, 1.82, -0.33),
          caixa(0.36, 0.1, 0.3, c, 0, 2.04, 0.33), caixa(0.36, 0.1, 0.3, c, 0, 2.04, -0.33),
          caixa(0.74, 0.36, 0.5, manta, 0, 1.5, 0), caixa(0.76, 0.06, 0.52, franja, 0, 1.31, 0), caixa(0.76, 0.06, 0.12, franja, 0, 1.5, 0),
          caixa(0.26, 0.6, 0.3, c, 0, 1.55, 0.72), caixa(0.24, 0.5, 0.28, c, 0, 1.95, 0.82), caixa(0.1, 0.4, 0.1, c, 0, 1.4, -0.68)],
        cabeca: [caixa(0.3, 0.3, 0.42, c, 0, 0, 0.1), caixa(0.26, 0.2, 0.2, focinho, 0, -0.06, 0.38),
          caixa(0.08, 0.08, 0.06, c, -0.13, 0.17, -0.02), caixa(0.08, 0.08, 0.06, c, 0.13, 0.17, -0.02),
          ...olhos(0.09, 0.08, 0.315, 0.07, false)],
        cabecaPos: [0, 2.2, 0.92],
        pernas: quatro(0.18, 1.0, 0.18, tom(c, 0.92), 0.25, 0.45),
      };
    },
  },
  gato: {
    nome: 'Gatinho', vel: 1.3, alt: 0.8, raio: 0.22, som: 'miau', bando: 1,
    montar(r) {
      const tipo = Math.floor(r * 4);
      const c = [0xf0a04b, 0x9e9e9e, 0x3a3a3a, 0xf5f1ea][tipo], listra = tom(c, tipo === 2 ? 1.5 : 0.8), claro = 0xfaf6ee;
      const olho = tipo === 2 ? 0xffe082 : PRETO;
      const listras = tipo === 0 || tipo === 1 ? [caixa(0.29, 0.04, 0.06, listra, 0, 0.47, 0.05), caixa(0.29, 0.04, 0.06, listra, 0, 0.47, -0.1)] : [];
      return {
        corpo: [caixa(0.28, 0.26, 0.5, c, 0, 0.35, 0), caixa(0.07, 0.38, 0.07, c, 0, 0.6, -0.27), caixa(0.2, 0.04, 0.3, claro, 0, 0.215, 0.04), ...listras],
        cabeca: [caixa(0.32, 0.28, 0.26, c, 0, 0.04, 0.05), caixa(0.14, 0.08, 0.02, claro, 0, -0.03, 0.183),
          caixa(0.08, 0.1, 0.06, c, -0.1, 0.23, 0), caixa(0.08, 0.1, 0.06, c, 0.1, 0.23, 0),
          caixa(0.04, 0.05, 0.02, 0xf4a6b8, -0.1, 0.22, 0.032), caixa(0.04, 0.05, 0.02, 0xf4a6b8, 0.1, 0.22, 0.032),
          caixa(0.05, 0.06, 0.02, olho, -0.075, 0.07, 0.185), caixa(0.05, 0.06, 0.02, olho, 0.075, 0.07, 0.185),
          ...(tipo === 2 ? [caixa(0.02, 0.05, 0.02, PRETO, -0.075, 0.07, 0.19), caixa(0.02, 0.05, 0.02, PRETO, 0.075, 0.07, 0.19)] : []),
          caixa(0.04, 0.03, 0.02, 0xf48fb1, 0, 0.01, 0.192)],
        cabecaPos: [0, 0.5, 0.25],
        pernas: quatro(0.09, 0.22, 0.09, c, 0.1, 0.16),
      };
    },
  },
  pato: {
    nome: 'Pato', vel: 0.8, alt: 0.75, raio: 0.22, som: 'quack', nada: true, afunda: 0.15, bando: 3,
    montar(r) {
      const branco = r < 0.5;
      const c = branco ? 0xfafafa : 0xa38a6c, asa = branco ? 0xececec : 0x7d6a54, cab = branco ? 0xfafafa : 0x3a8f4a;
      return {
        corpo: [caixa(0.36, 0.3, 0.55, c, 0, 0.33, 0), caixa(0.2, 0.1, 0.14, c, 0, 0.5, -0.3),
          caixa(0.04, 0.18, 0.34, asa, -0.2, 0.36, -0.02), caixa(0.04, 0.18, 0.34, asa, 0.2, 0.36, -0.02),
          ...(branco ? [] : [caixa(0.25, 0.05, 0.05, 0xfafafa, 0, 0.5, 0.2)])],
        cabeca: [caixa(0.24, 0.24, 0.24, cab, 0, 0.08, 0.02), caixa(0.16, 0.06, 0.16, 0xffa726, 0, 0.0, 0.2),
          ...olhos(0.07, 0.12, 0.145, 0.05, false)],
        cabecaPos: [0, 0.48, 0.22],
        pernas: [[0.06, 0.18, 0.06, 0xff9800, [[-0.08, 0.18, 0], [0.08, 0.18, 0]]]],
      };
    },
  },

  // ---------- Futuro ----------
  robocao: {
    nome: 'Robô-cão', vel: 1.9, alt: 1.3, raio: 0.3, som: 'bip', segue: true,
    montar(r) {
      const metal = 0xdfe6ea, esc = 0x90a4ae, det = r < 0.5 ? 0x4dd0e1 : 0xba68c8, luz = r < 0.5 ? 0x7ff9ff : 0xff8af0;
      return {
        corpo: [caixa(0.44, 0.4, 0.8, metal, 0, 0.58, 0), caixa(0.46, 0.08, 0.82, det, 0, 0.62, 0), caixa(0.3, 0.04, 0.4, esc, 0, 0.8, 0),
          caixa(0.06, 0.3, 0.06, esc, 0, 0.88, -0.38)],
        brilho: [caixa(0.1, 0.1, 0.1, luz, 0, 1.06, -0.38), caixa(0.12, 0.06, 0.02, luz, 0, 0.7, 0.405)],
        cabeca: [caixa(0.42, 0.36, 0.38, metal, 0, 0, 0.05), caixa(0.34, 0.16, 0.02, 0x263238, 0, 0.05, 0.245),
          caixa(0.2, 0.14, 0.16, metal, 0, -0.1, 0.3), caixa(0.07, 0.05, 0.03, esc, 0, -0.06, 0.39),
          caixa(0.1, 0.16, 0.06, det, -0.15, 0.24, -0.02), caixa(0.1, 0.16, 0.06, det, 0.15, 0.24, -0.02),
          caixa(0.03, 0.18, 0.03, esc, 0.08, 0.27, -0.1)],
        cabecaBrilho: [caixa(0.08, 0.07, 0.02, luz, -0.08, 0.05, 0.258), caixa(0.08, 0.07, 0.02, luz, 0.08, 0.05, 0.258),
          caixa(0.07, 0.07, 0.07, luz, 0.08, 0.39, -0.1)],
        cabecaPos: [0, 0.85, 0.45],
        pernas: quatro(0.12, 0.36, 0.12, esc, 0.14, 0.26),
      };
    },
  },
};

Object.assign(ESPECIES, ESPECIES_ERAS);

// instintos (instintos.js) de cada bicho das eras, pelo que se sabe dos animais de verdade.
// Todos são mansos aqui (aceitam carinho, que dá experiência para a era): nada de caçar gente.
const INSTINTOS_ERAS = {
  // gigantes de pescoço comprido: andavam em grupo e não tinham medo de quase nada
  braquiossauro: { dieta: 'erva', atividade: 'dia', grupo: [2, 3], filhotes: [0.4, 1, 1], fuga: 0, alerta: 16, corrida: 1.4, folego: 6, curioso: 0.05, habitat: { prado: 2, floresta: 2, beira: 2 }, nome: 'o braquiossauro' },
  triceratops: { dieta: 'erva', atividade: 'dia', grupo: [2, 4], filhotes: [0.4, 1, 2], fuga: 2, alerta: 12, corrida: 2.4, folego: 6, curioso: 0.1, habitat: { prado: 3, beira: 1 }, nome: 'o tricerátops' },
  estegossauro: { dieta: 'erva', atividade: 'dia', grupo: [1, 3], fuga: 2, alerta: 10, corrida: 1.8, folego: 5, curioso: 0.05, habitat: { floresta: 2, prado: 1 }, nome: 'o estegossauro' },
  // pterossauro: pescava perto d'água; voa em círculos e pousa de vez em quando (animais.js)
  pterossauro: { dieta: 'onivoro', atividade: 'dia', grupo: [1, 2], fuga: 4, alerta: 12, corrida: 3, folego: 4, curioso: 0, habitat: { beira: 3, praia: 3, prado: 1, montanha: 1 }, nome: 'o pterossauro' },
  rexinho: { dieta: 'onivoro', atividade: 'dia', grupo: [1, 1], fuga: 0, alerta: 12, corrida: 3.6, folego: 8, curioso: 0.6, habitat: { prado: 1, floresta: 1 }, nome: 'o rexinho' },
  // Era do Gelo: manadas de mamutes com filhotes, renas em bando que fogem cedo
  mamute: { dieta: 'erva', atividade: 'dia', grupo: [2, 4], filhotes: [0.5, 1, 1], fuga: 3, alerta: 14, corrida: 2.6, folego: 6, curioso: 0.05, habitat: { prado: 2, neve: 2, taiga: 2 }, nome: 'o mamute' },
  preguica: { dieta: 'erva', atividade: 'sempre', grupo: [1, 1], fuga: 0, alerta: 6, corrida: 0.8, folego: 3, curioso: 0.1, habitat: { floresta: 2, prado: 1 }, nome: 'a preguiça-gigante' },
  gliptodonte: { dieta: 'erva', atividade: 'crepusculo', grupo: [1, 2], fuga: 0, alerta: 6, corrida: 1, folego: 3, curioso: 0, habitat: { prado: 2, beira: 1 }, nome: 'o gliptodonte' },
  rena: { dieta: 'erva', atividade: 'dia', grupo: [2, 5], filhotes: [0.3, 1, 1], fuga: 6, alerta: 16, corrida: 5, folego: 10, curioso: 0, habitat: { neve: 3, taiga: 3, prado: 1 }, nome: 'a rena' },
  // Idade da Pedra: o lobinho é o primeiro amigo das pessoas (vira cachorro)
  lobinho: { dieta: 'onivoro', atividade: 'sempre', grupo: [1, 1], fuga: 0, alerta: 12, corrida: 4.6, folego: 14, curioso: 0.6, habitat: { floresta: 1, prado: 1 }, nome: 'o lobinho' },
  auroque: { dieta: 'erva', atividade: 'dia', grupo: [2, 4], filhotes: [0.3, 1, 1], fuga: 4, alerta: 14, corrida: 4, folego: 8, curioso: 0.05, habitat: { prado: 3, floresta: 1 }, nome: 'o auroque' },
  cavalo: { dieta: 'erva', atividade: 'dia', grupo: [2, 4], filhotes: [0.3, 1, 1], fuga: 3, alerta: 16, corrida: 6, folego: 12, curioso: 0.2, habitat: { prado: 3, savana: 2 }, nome: 'o cavalo' },
  cabra: { dieta: 'erva', atividade: 'dia', grupo: [2, 4], filhotes: [0.4, 1, 2], fuga: 2.5, alerta: 12, corrida: 4, folego: 6, curioso: 0.25, habitat: { montanha: 3, prado: 1 }, nome: 'a cabra' },
  camelo: { dieta: 'erva', atividade: 'dia', grupo: [1, 3], fuga: 2, alerta: 12, corrida: 3.6, folego: 14, curioso: 0.1, habitat: { deserto: 3, praia: 1, prado: 1 }, nome: 'o camelo' },
  gato: { dieta: 'onivoro', atividade: 'crepusculo', grupo: [1, 1], fuga: 2.5, alerta: 10, corrida: 5, folego: 4, curioso: 0.4, habitat: { prado: 1 }, nome: 'o gatinho' },
  pato: { dieta: 'onivoro', atividade: 'dia', grupo: [2, 4], filhotes: [0.5, 2, 3], fuga: 3, alerta: 10, corrida: 2.6, folego: 4, curioso: 0.05, habitat: { beira: 4, praia: 1, prado: 0.5 }, nome: 'o pato' },
  robocao: { dieta: 'onivoro', atividade: 'sempre', grupo: [1, 1], fuga: 0, alerta: 14, corrida: 5, folego: 30, curioso: 0.6, habitat: { prado: 1 }, nome: 'o robô-cão' },
};
for (const [k, v] of Object.entries(INSTINTOS_ERAS)) registrarInstinto(k, { selvagem: false, dano: 0, ...v });

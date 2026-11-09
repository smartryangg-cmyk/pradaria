// Veículos do mundo de Guerra: tanque (canhão), jipe armado e helicóptero militar (metralhadora) e a viatura da polícia.
// Entram no catálogo de veiculos.js (mesma física e mesma rede dos outros veículos), mas não aparecem na
// garagem: ficam estacionados na Base Aliada, no Forte Vermelho e na Delegacia (guerra.js cuida das vagas).
import { TIPOS } from './veiculos.js';
import { caixa } from './modelos.js';

const c = caixa;
const espelhar = (f) => [f(1), f(-1)];
const OLIVA = 0x6b7a3a, OLIVA_ESC = 0x4f5a2a, ESTEIRA = 0x2b2b2b, PRETO = 0x333333, CINZA = 0x9a9a9a, BRANCO = 0xf4f4f4,
  AZUL = 0x1e4fb0, VERMELHO = 0xe53935, AZUL_LUZ = 0x1e88e5, BANCO = 0x4a3a2a;

// armas dos veículos: quem senta no assento `assento` atira
//  canhao: bala que cai em arco e explode · metralhadora: rajada reta
export const ARMADOS = {
  tanque: { arma: 'canhao', assento: 0, intervalo: 2.2, ponta: [0, 2.05, -3.3], vel: 70, raio: 4.2, dano: 12, nome: 'Canhão' },
  jipeArmado: { arma: 'metralhadora', assento: 0, intervalo: 0.11, ponta: [0, 2.45, -0.3], alcance: 55, dano: 1, nome: 'Metralhadora' },
  helicopteroGuerra: { arma: 'metralhadora', assento: 0, intervalo: 0.1, ponta: [0, 0.5, -2.2], alcance: 65, dano: 1, nome: 'Metralhadora' },
};
// blindagem: quanto do dano das armas pequenas o veículo segura (1 = tudo)
export const BLINDAGEM = { tanque: 1, jipeArmado: 0.5, helicopteroGuerra: 0.6, viatura: 0.3 };
export const MILITARES = new Set(['tanque', 'jipeArmado', 'helicopteroGuerra', 'viatura']);

// rodas de apoio do tanque (dos dois lados, por fora da esteira)
const rodasTanque = [];
for (const z of [-2.0, -1.0, 0, 1.0, 2.0]) for (const s of [1, -1]) rodasTanque.push([s * 1.52, 0.42, z, 0.38, 0.12, z === -2.0 ? 1 : 0]);

export const TIPOS_GUERRA = {
  tanque: {
    nome: 'Tanque', meio: 'terra', L: 5.8, W: 3.1, H: 2.3, vmax: 8.5, acel: 4, giro: 1.15, som: 'motor', buzina: 'caminhao', grave: 0.45,
    assentos: [[0, 1.55, 0.35, 's'], [0, 1.45, 1.6, 's']],
    rodas: rodasTanque,
    desenho: () => [
      ...espelhar((s) => c(0.75, 0.95, 5.7, ESTEIRA, s * 1.15, 0.48, 0)),
      ...espelhar((s) => c(0.85, 0.12, 5.8, OLIVA_ESC, s * 1.15, 1.0, 0)),
      c(1.6, 0.75, 5.3, OLIVA, 0, 0.75, 0), c(3.0, 0.32, 1.0, OLIVA, 0, 1.0, -2.45), c(3.0, 0.18, 4.6, OLIVA, 0, 1.2, 0.3),
      c(2.6, 0.3, 0.3, OLIVA_ESC, 0, 1.3, 2.6), ...espelhar((s) => c(0.3, 0.16, 0.06, 0xfff3b0, s * 1.0, 1.15, -2.96)),
      // torre e canhão
      c(2.0, 0.72, 2.3, OLIVA, 0, 1.68, 0.35), c(1.4, 0.2, 1.6, OLIVA_ESC, 0, 2.1, 0.45), c(0.62, 0.14, 0.62, OLIVA_ESC, 0, 2.25, 0.35),
      c(0.26, 0.26, 2.9, OLIVA_ESC, 0, 1.78, -2.1), c(0.34, 0.34, 0.3, PRETO, 0, 1.78, -3.5),
    ],
  },
  jipeArmado: {
    ...TIPOS.jipe, nome: 'Jipe armado', vmax: 15, grave: 0.8,
    desenho: () => [
      ...TIPOS.jipe.desenho(OLIVA),
      c(0.12, 0.62, 0.12, PRETO, 0, 2.05, 0.1), c(0.16, 0.16, 1.1, PRETO, 0, 2.42, -0.15), c(0.36, 0.3, 0.3, OLIVA_ESC, 0, 2.42, 0.25),
      c(0.5, 0.36, 0.06, OLIVA_ESC, 0, 2.62, -0.2),
    ],
  },
  helicopteroGuerra: {
    ...TIPOS.helicoptero, nome: 'Helicóptero militar', vmax: 16,
    desenho: () => [
      ...TIPOS.helicoptero.desenho(OLIVA),
      ...espelhar((s) => c(0.9, 0.1, 0.4, OLIVA_ESC, s * 1.25, 0.95, -0.2)),
      ...espelhar((s) => c(0.16, 0.16, 1.3, PRETO, s * 1.55, 0.85, -0.6)),
    ],
  },
  viatura: {
    ...TIPOS.carro, nome: 'Viatura', vmax: 18, acel: 8,
    desenho: () => [
      ...TIPOS.carro.desenho(BRANCO),
      ...espelhar((s) => c(0.06, 0.18, 2.6, AZUL, s * 0.92, 0.75, 0.1)),
      c(1.0, 0.1, 0.24, PRETO, 0, 1.58, -0.62), c(0.42, 0.16, 0.22, VERMELHO, -0.26, 1.7, -0.62), c(0.42, 0.16, 0.22, AZUL_LUZ, 0.26, 1.7, -0.62),
    ],
  },
};
void CINZA; void BANCO;

// energia, autonomia (blocos com o tanque cheio) e quanto da velocidade sobra fora da estrada (igual a veiculos.js)
const EXTRA = { tanque: ['comb', 3000, 1], jipeArmado: ['comb', 3500, 0.95], helicopteroGuerra: ['comb', 5000, 1], viatura: ['comb', 4000, 0.65] };
for (const [t, [energia, autonomia, terreno]] of Object.entries(EXTRA)) Object.assign(TIPOS_GUERRA[t], { energia, autonomia, terreno });

// coloca os tipos novos no catálogo (uma vez)
export function registrarVeiculosGuerra() {
  for (const [k, d] of Object.entries(TIPOS_GUERRA)) if (!TIPOS[k]) TIPOS[k] = d;
}
registrarVeiculosGuerra();

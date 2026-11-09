// Física dos veículos (terra, água e ar). Fica separada de veiculos.js, que só guarda as fichas e o desenho;
// a classe Veiculos chama estas funções nos métodos dirigir(), assentar(), colide(), empuxo()...
//
// Modelo (leve, para tablet fraco):
// - Velocidade em duas partes: v.vel (para a frente, a mesma de sempre: rede, rodas, som, km/h) e v.lat (para o lado).
//   O volante gira o veículo; a velocidade do mundo fica, e os pneus seguram o lado até o limite da aderência
//   (por tipo e pelo chão: gelo e areia escorregam). Curva rápida passa do limite e o carro derrapa um pouco.
// - Chão amostrado em 4 cantos: dá a altura, a inclinação para a frente (pitch) e para o lado (roll). Cada canto
//   só sobe 1 bloco por vez, então degraus e morros de 1 bloco são subidos aos poucos (primeiro a frente, depois
//   a traseira), sem teletransporte. A parede só conta acima do degrau, com a caixa inclinada junto com o chão.
// - Suspensão: mola-amortecedor no corpo (pitch, roll e altura) em volta da pose do chão. Frear abaixa o nariz,
//   acelerar levanta, curva joga o corpo para fora (motos, bicicletas e skate deitam para dentro), pouso comprime.
// - Rampas: subindo, o chão empurra o veículo para cima na velocidade da subida; no topo ele segue voando
//   (gravidade) e pousa. Descendo, ele "gruda" no chão para não flutuar.
// - Colisão em sub-passos de no máximo 0,35 m (não atravessa blocos rápido). Bateu: perde a velocidade contra a
//   parede, quica 25% e escorrega pela parede. Também bate nos outros veículos. Se ficar preso, sai sozinho.
// - Água: empuxo de verdade (fração submersa / densidade). Carro tem densidade 0,75: boia baixinho e devagar, com o
//   motor fraco (30%); em água rasa as rodas tocam o fundo. Barco: densidade 0,4, balança com as ondas, inclina
//   para dentro na curva e empina ao acelerar. Avião e helicóptero boiam se pousarem na água.
// - Ar: avião só sobe com velocidade (sustentação = velocidade / velocidade de decolagem); devagar no ar ele plana
//   para baixo. Helicóptero paira (sobe/desce pelos botões) e inclina para a frente quando anda.
import { B, SOLIDO, AGUA } from './blocos.js';
import { BE } from './blocos-eras.js';
import { ALT } from './mundo.js';

export const GRAV = 25;
const PASSO = 1.35; // a parede começa acima disto (degrau de 1 bloco passa, mesmo com a mola um pouco comprimida)
const COMPRIME = 0.3; // o quanto a mola deixa o chassi abaixo do chão antes de travar
const ALTURA_AGUA = 0.88; // a superfície do bloco de água (igual ao desenho em mundo.js)

// ---------- parâmetros ----------
// aderencia: m/s² de força lateral dos pneus; mola: rigidez (1/s²); amort: fração do amortecimento crítico;
// densidade: em relação à água (< 1 boia, > 1 afunda); casco: altura (m) que desloca água; agua: aderência lateral
// na água (leme); motorAgua/motorTerra: força do motor boiando / fora do seu meio; offroad: sofre menos na areia/neve.
const BASE = {
  terra: { aderencia: 17, mola: 170, amort: 0.32, densidade: 0.75, casco: 1.1, agua: 3, motorAgua: 0.3, motorTerra: 1, offroad: false },
  agua: { aderencia: 10, mola: 120, amort: 0.4, densidade: 0.4, casco: 0.7, agua: 7, motorAgua: 1, motorTerra: 0.18, offroad: false },
  ar: { aderencia: 18, mola: 150, amort: 0.42, densidade: 0.45, casco: 0.9, agua: 4, motorAgua: 0.55, motorTerra: 1, offroad: false },
  helice: { aderencia: 18, mola: 150, amort: 0.45, densidade: 0.5, casco: 0.8, agua: 4, motorAgua: 0.5, motorTerra: 1, offroad: false },
};
export const FISICA = {
  jipe: { aderencia: 16, mola: 110, offroad: true },
  esportivo: { aderencia: 20, mola: 260, amort: 0.45 },
  quadriciclo: { aderencia: 15, mola: 140, offroad: true },
  moto: { aderencia: 22, mola: 200 },
  bicicleta: { aderencia: 22, mola: 300, densidade: 0.9, casco: 0.8 },
  skate: { aderencia: 22, mola: 500, amort: 0.6, densidade: 0.9, casco: 0.3 },
  trator: { aderencia: 14, mola: 130, offroad: true, densidade: 0.85 },
  caminhao: { aderencia: 13, mola: 100, densidade: 0.85, casco: 1.5 },
  onibus: { aderencia: 12, mola: 90, densidade: 0.85, casco: 1.6 },
};
const cacheF = new Map();
// parâmetros de um tipo (tipos novos, como um submarino, herdam os do seu meio)
export function fisicaDe(tipo, meio) {
  const k = tipo + '|' + meio;
  if (!cacheF.has(k)) cacheF.set(k, { ...(BASE[meio] || BASE.terra), ...(FISICA[tipo] || {}) });
  return cacheF.get(k);
}

// chão: aderência (multiplica a dos pneus) e atrito de rolagem (areia e neve seguram o carro)
export const ADERENCIA = new Float32Array(256).fill(1);
export const ATRITO = new Float32Array(256).fill(1);
for (const b of [B.PEDRA, B.TIJOLO, B.TABUAS, BE.CONCRETO, BE.ASFALTO, BE.ASFALTO_FAIXA, BE.PEDRA_CASTELO, BE.MARMORE, BE.AZULEJO]) ADERENCIA[b] = 1.12;
for (const b of [B.GRAMA, B.TERRA, B.CAPIM, BE.MUSGO]) ADERENCIA[b] = 0.92;
for (const b of [B.PEDRISCO, B.CASCALHO, B.TERRA_ARADA, B.FENO]) { ADERENCIA[b] = 0.78; ATRITO[b] = 1.4; }
ADERENCIA[B.AREIA] = 0.65; ATRITO[B.AREIA] = 2.4;
ADERENCIA[BE.ARENITO] = 0.85;
for (const b of [BE.NEVE, BE.BLOCO_NEVE]) { ADERENCIA[b] = 0.5; ATRITO[b] = 2; }
ADERENCIA[BE.GELO] = 0.16; ATRITO[BE.GELO] = 0.6;
for (const b of [B.FOLHAS, B.FOLHAS_PINHEIRO, B.FOLHAS_SELVA, BE.FOLHAS_NEVE]) ADERENCIA[b] = 0.7;

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const angulo = (a) => ((a % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;

// ondas: altura extra da superfície (o mesmo em todos os aparelhos, só depende do relógio e do lugar)
export function onda(x, z, t) { return Math.sin(t * 1.3 + x * 0.35 + z * 0.12) * 0.07 + Math.sin(t * 0.85 - z * 0.31 + x * 0.1) * 0.05; }
function inclinacaoOnda(x, z, t) {
  const a = Math.cos(t * 1.3 + x * 0.35 + z * 0.12) * 0.07, b = Math.cos(t * 0.85 - z * 0.31 + x * 0.1) * 0.05;
  return { dx: a * 0.35 + b * 0.1, dz: a * 0.12 - b * 0.31 };
}

// ---------- chão e paredes ----------
// topo do chão sólido numa coluna, a partir da altura h de uma roda: sobe no máximo 1 bloco (com folga para a mola
// comprimida), procura até 4 abaixo
function topo(m, x, z, h) {
  const bx = Math.floor(x), bz = Math.floor(z);
  for (let by = Math.floor(h + 1.25); by > h - 4; by--) if (SOLIDO[m.bloco(bx, by - 1, bz)]) return by;
  return h - 4;
}

// pose do chão pelos 4 cantos (e o meio): altura, pitch e roll; e o bloco embaixo (para a aderência)
const _ch = { y: 0, p: 0, r: 0, bloco: 0, folga: 0 };
export function chaoRodas(V, v, x = v.x, y = v.y, z = v.z, yaw = v.yaw) {
  const d = v.d, m = V.mundo;
  const lz = d.L * 0.42, lx = Math.max(0.15, d.W * 0.4);
  const s = Math.sin(yaw), co = Math.cos(yaw);
  const sp = Math.sin(v.pg || 0) * lz, sr = Math.sin(v.rg || 0) * lx;
  // frente = -z local; direita = +x local
  const canto = (ax, az) => topo(m, x + ax * co + az * s, z - ax * s + az * co, y - az / lz * sp + ax / lx * sr);
  let fe = canto(-lx, -lz), fd = canto(lx, -lz), te = canto(-lx, lz), td = canto(lx, lz);
  const meio = topo(m, x, z, y);
  // um buraco pequeno debaixo de uma roda não engole o veículo: cada canto fica no máximo 1 abaixo do mais alto
  const alto = Math.max(fe, fd, te, td, meio) - 1;
  if (fe < alto) fe = alto; if (fd < alto) fd = alto; if (te < alto) te = alto; if (td < alto) td = alto;
  const frente = (fe + fd) / 2, tras = (te + td) / 2, esq = (fe + te) / 2, dir = (fd + td) / 2;
  _ch.y = Math.max((frente + tras) / 2, meio - 0.5); // barriga: um bloco bem no meio levanta o veículo
  _ch.p = clamp(Math.atan2(frente - tras, lz * 2), -0.6, 0.6);
  _ch.r = d.inclina ? 0 : clamp(Math.atan2(dir - esq, lx * 2), -0.5, 0.5);
  _ch.bloco = m.bloco(Math.floor(x), Math.floor(_ch.y) - 1, Math.floor(z));
  return _ch;
}

// paredes: a caixa do veículo inclinada com o chão, só acima do degrau
export function colideCorpo(V, v, x, y, z, yaw, pitch = v.pg || 0) {
  const d = v.d, m = V.mundo;
  const n = Math.max(1, Math.ceil(d.L / Math.max(d.W, 0.8)));
  const meia = Math.max(0.22, d.W * 0.42);
  const s = Math.sin(yaw), co = Math.cos(yaw), sp = Math.sin(pitch);
  const alto = Math.min(Math.max(d.H, 1.3), 2.6);
  for (let i = 0; i < n; i++) {
    const off = ((i + 0.5) / n - 0.5) * d.L * 0.9; // + = para a frente
    const cx = x - s * off, cz = z - co * off, yb = y + sp * off;
    const y0 = Math.floor(yb + PASSO), y1 = Math.max(y0, Math.floor(yb + alto - 0.05));
    for (let bx = Math.floor(cx - meia); bx <= Math.floor(cx + meia); bx++)
      for (let bz = Math.floor(cz - meia); bz <= Math.floor(cz + meia); bz++)
        for (let by = y0; by <= y1; by++) if (SOLIDO[m.bloco(bx, by, bz)]) return true;
  }
  return false;
}

// outro veículo no caminho (caixas giradas). Só bloqueia se a mudança aproximar os dois (assim nunca prende)
function sobrepoe(ax, az, ay, ahw, ahl, bx, bz, by, bhw, bhl) {
  const dx = bx - ax, dz = bz - az;
  const eixos = [Math.cos(ay), -Math.sin(ay), -Math.sin(ay), -Math.cos(ay), Math.cos(by), -Math.sin(by), -Math.sin(by), -Math.cos(by)];
  for (let i = 0; i < 8; i += 2) {
    const nx = eixos[i], nz = eixos[i + 1];
    const ra = ahw * Math.abs(eixos[0] * nx + eixos[1] * nz) + ahl * Math.abs(eixos[2] * nx + eixos[3] * nz);
    const rb = bhw * Math.abs(eixos[4] * nx + eixos[5] * nz) + bhl * Math.abs(eixos[6] * nx + eixos[7] * nz);
    if (Math.abs(dx * nx + dz * nz) > ra + rb) return false;
  }
  return true;
}
export function bateVeiculo(V, v, x, z, yaw = v.yaw) {
  const d = v.d;
  for (const u of V.mapa.values()) {
    if (u === v) continue;
    if (v.y > u.y + u.d.H * 0.85 || u.y > v.y + d.H * 0.85) continue;
    const dn = Math.hypot(u.x - x, u.z - z);
    if (dn > (d.L + u.d.L) / 2 + 0.5) continue;
    if (dn >= Math.hypot(u.x - v.x, u.z - v.z)) continue; // afastando: deixa sair
    if (sobrepoe(x, z, yaw, d.W / 2, d.L / 2, u.x, u.z, u.yaw, u.d.W / 2, u.d.L / 2)) return u;
  }
  return null;
}

// preso dentro de bloco (alguém construiu em cima, girou rente à parede...): procura o lugar livre mais perto
function desencalhar(V, v) {
  if (!colideCorpo(V, v, v.x, v.y, v.z, v.yaw)) return;
  for (const dy of [0.5, 1, 1.5, 2, 3]) if (!colideCorpo(V, v, v.x, v.y + dy, v.z, v.yaw)) { v.y += dy; v.vy = 0; return; }
  for (const r of [0.5, 1, 1.5, 2.5]) for (let k = 0; k < 8; k++) {
    const x = v.x + Math.cos(k * Math.PI / 4) * r, z = v.z + Math.sin(k * Math.PI / 4) * r;
    if (!colideCorpo(V, v, x, v.y, z, v.yaw)) { v.x = x; v.z = z; v.vel *= 0.3; v.lat = 0; return; }
  }
}

// ---------- água ----------
// superfície da água na coluna do veículo (null = sem água por perto)
export function nivelAgua(V, v, x = v.x, z = v.z) {
  const f = fisicaDe(v.tipo, v.d.meio), m = V.mundo, bx = Math.floor(x), bz = Math.floor(z);
  for (let by = Math.floor(v.y + f.casco + 0.5); by >= Math.floor(v.y) - 1; by--) if (AGUA[m.bloco(bx, by, bz)]) return by + ALTURA_AGUA;
  return null;
}
// quanto do casco está debaixo d'água (0..1), com as ondas
export function submersao(V, v) {
  const sup = nivelAgua(V, v);
  if (sup === null) return 0;
  const f = fisicaDe(v.tipo, v.d.meio);
  return clamp((sup + onda(v.x, v.z, performance.now() / 1000) - v.y) / f.casco, 0, 1);
}
// Empuxo reaproveitável (barco, carro na água, avião/helicóptero que pousam, submarino...).
// Aplica gravidade + empuxo + arrasto da água em v.vy e devolve a fração submersa s (0..1); 0 = fora d'água
// (aí quem chamou aplica a gravidade normal). Em equilíbrio s = densidade: 0,4 boia alto, 0,75 boia afundado,
// 1 fica parado em qualquer profundidade, > 1 afunda devagar. Submarino: mude a densidade (ex. 0,9 sobe, 1,1 desce).
export function empuxo(V, v, dt, densidade, s = submersao(V, v)) {
  if (s <= 0) return 0;
  const f = fisicaDe(v.tipo, v.d.meio);
  const dens = Math.max(0.05, densidade ?? f.densidade);
  v.vy += GRAV * (s / dens - 1) * dt;
  v.vy *= Math.exp(-(1.2 + 2.6 * s + (v.vy < 0 ? 0.35 * -v.vy * s : 0)) * dt); // caindo rápido na água: freia forte
  return s;
}

// ---------- um passo de física ----------
const PARADO = { frente: 0, lado: 0, subir: false, descer: false };
const MAXDT = 0.05;

// ent: { frente, lado, subir, descer }; obst: [{x,z}] bichos e pessoas (freia antes); motorista: alguém dirige aqui
export function passo(V, v, dt, ent = PARADO, obst = null, motorista = true) {
  if (dt > MAXDT) { const n = Math.min(4, Math.ceil(dt / MAXDT)); for (let i = 0; i < n; i++) passo(V, v, dt / n, ent, obst, motorista); return; }
  if (!(dt > 0)) return;
  const d = v.d, f = fisicaDe(v.tipo, d.meio);
  const su = v.su || (v.su = { vp: 0, vr: 0, h: 0, vh: 0 });
  if (v.pg === undefined) { v.lat = v.lat || 0; v.pg = 0; v.rg = 0; v.aL = 0; v.tAr = 0; v.apoio = false; }
  if (!motorista) ent = PARADO;
  desencalhar(V, v);

  const voa = d.meio === 'ar' || d.meio === 'helice';
  const sub = submersao(V, v);
  const boiando = sub > 0.2 && !v.apoio;
  const noAr = !v.apoio && sub <= 0.02;
  const tracao = voa ? 1 : v.tAr < 0.15 ? 1 : boiando ? f.motorAgua : 0; // pneu no ar não empurra nem freia
  const freioMao = motorista && ent.descer && d.meio === 'terra' && v.apoio;

  // ----- motor, freio e atrito (para a frente) -----
  let fv = 1, atr = 1;
  if (boiando) fv = d.meio === 'agua' ? 1 : f.motorAgua;
  else if (sub > 0.25) fv = d.meio === 'agua' ? 0.6 : 0.6 + 0.4 * f.motorAgua; // atravessando água rasa
  if (d.meio === 'agua' && sub < 0.05) fv = f.motorTerra; // barco no seco só se arrasta
  if (v.apoio && !boiando) {
    atr = ATRITO[v.blocoChao || 0] || 1;
    if (atr > 1) fv /= 1 + (atr - 1) * (f.offroad ? 0.12 : 0.3);
  }
  const vmax = d.vmax * fv, acel = d.acel * tracao;
  const vel0 = v.vel, a = ent.frente;
  if (acel > 0 && a > 0.05) {
    const lim = vmax * Math.min(1, a * 1.15);
    if (v.vel < 0) v.vel += acel * 2 * dt;
    else if (v.vel < lim) v.vel = Math.min(lim, v.vel + acel * a * dt);
  } else if (acel > 0 && a < -0.05) {
    if (v.vel > 0.3) v.vel -= acel * 2.2 * dt;
    else v.vel = Math.max(voa ? 0 : -vmax * 0.35, v.vel + acel * 0.6 * a * dt);
  } else {
    let atrito;
    if (voa && noAr) atrito = d.meio === 'helice' ? 2.5 + Math.abs(v.vel) * 0.12 : 0.6; // helicóptero para e paira
    else if (boiando || (sub > 0.3 && !v.apoio)) atrito = 1.2 + Math.abs(v.vel) * 0.25;
    else if (tracao > 0) atrito = !motorista ? 8 : (2.5 + Math.abs(v.vel) * 0.15) * atr;
    else atrito = 0.3; // no ar: só o vento
    v.vel -= Math.sign(v.vel) * Math.min(Math.abs(v.vel), atrito * dt);
    if (motorista && tracao > 0 && v.apoio && Math.abs(v.vel) < 0.4 && !voa) v.vel = 0; // parado: fica parado (freio)
  }
  if (v.vel > vmax) v.vel = Math.max(vmax, v.vel - (d.acel * 1.5 + 2) * dt);
  if (v.vel < -vmax * 0.4) v.vel = Math.min(-vmax * 0.4, v.vel + (d.acel * 1.5 + 2) * dt);
  // morro: a gravidade puxa para baixo da ladeira
  if (v.apoio && !voa && !freioMao && Math.abs(v.pg) > 0.05 && (motorista || Math.abs(v.vel) > 0.5)) v.vel -= GRAV * Math.sin(v.pg) * 0.45 * dt;
  // avião: subir gasta velocidade, mergulhar ganha
  if (d.meio === 'ar' && noAr) v.vel = Math.min(d.vmax * 1.15, Math.max(0, v.vel - v.vy * 0.12 * dt));
  if (freioMao) v.vel -= Math.sign(v.vel) * Math.min(Math.abs(v.vel), 7 * dt);

  // freia sozinho na frente de bichos e pessoas (ninguém se machuca)
  if (obst && !(voa && noAr) && Math.abs(v.vel) > 0.2) {
    const sentido = Math.sign(v.vel);
    for (const o of obst) {
      if (Math.abs((o.y ?? v.y) - v.y) > 3) continue;
      const l = V.local(v, o.x, o.z);
      const frente = -l.z * sentido - d.L / 2; // distância à frente do para-choque
      if (frente > -0.3 && frente < 3 && Math.abs(l.x) < d.W / 2 + 0.6) {
        const lim = Math.max(0, frente - 0.4) * 2.2;
        if (Math.abs(v.vel) > lim) { v.vel = sentido * lim; v.lat *= 0.5; }
      }
    }
  }

  // ----- direção: só gira andando (carro de verdade não gira parado); rápido, gira menos -----
  let fator;
  if (voa && noAr) fator = 1;
  else if (tracao === 0) fator = 0;
  else fator = Math.min(1, Math.abs(v.vel) / 3);
  const giro = ent.lado * d.giro * fator / (1 + Math.abs(v.vel) * 0.03) * (freioMao ? 1.4 : 1);
  const dyaw = -giro * dt * (voa && noAr ? 1 : v.vel < 0 ? -1 : 1);
  let fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
  let Wx = fx * v.vel - fz * v.lat, Wz = fz * v.vel + fx * v.lat; // direita = (-fz, fx)
  if (dyaw) {
    const ny = angulo(v.yaw + dyaw);
    if (!colideCorpo(V, v, v.x, v.y, v.z, ny) || colideCorpo(V, v, v.x, v.y, v.z, v.yaw)) {
      v.yaw = ny; fx = -Math.sin(ny); fz = -Math.cos(ny);
    }
  }
  v.viraRoda += (ent.lado * 0.45 - v.viraRoda) * Math.min(1, dt * 8);
  // a velocidade do mundo continua; agora ela tem uma parte para o lado
  v.vel = Wx * fx + Wz * fz; v.lat = -Wx * fz + Wz * fx;

  // ----- pneus/leme seguram o lado (até a aderência) -----
  let grip;
  if (v.apoio && tracao > 0 && !boiando) grip = f.aderencia * (ADERENCIA[v.blocoChao || 0] || 1) * (freioMao ? 0.3 : 1);
  else if (boiando) grip = f.agua;
  else if (voa && noAr) grip = d.meio === 'ar' ? 10 : 3;
  else grip = 0;
  const tira = Math.min(Math.abs(v.lat), grip * dt);
  v.lat -= Math.sign(v.lat) * tira;
  if (tira > 0 && Math.abs(v.lat) > 0.5) v.vel -= Math.sign(v.vel) * Math.min(Math.abs(v.vel), Math.abs(v.lat) * 0.25 * dt); // derrapar gasta
  v.derrapa = Math.abs(v.lat);

  // ----- anda, em pedacinhos (não atravessa bloco rápido); bateu: para, quica e escorrega pela parede -----
  Wx = fx * v.vel - fz * v.lat; Wz = fz * v.vel + fx * v.lat;
  const dist = Math.hypot(Wx, Wz) * dt;
  const n = Math.min(10, Math.max(1, Math.ceil(dist / 0.35)));
  const bate = (x, z) => colideCorpo(V, v, x, v.y, z, v.yaw) || !!bateVeiculo(V, v, x, z);
  for (let k = 0; k < n; k++) {
    const nx = v.x + Wx * dt / n, nz = v.z + Wz * dt / n;
    if (!bate(nx, nz)) { v.x = nx; v.z = nz; continue; }
    const ax = Wx, az = Wz;
    let bx = false, bz = false;
    if (Math.abs(Wx) > 0.01 && !bate(nx, v.z)) { v.x = nx; bz = true; }
    else if (Math.abs(Wz) > 0.01 && !bate(v.x, nz)) { v.z = nz; bx = true; }
    else bx = bz = true;
    const e = 0.25;
    let imp = 0;
    if (bx) { imp += Wx * Wx; Wx = -Wx * e; }
    if (bz) { imp += Wz * Wz; Wz = -Wz * e; }
    imp = Math.sqrt(imp);
    const raspa = 1 - Math.min(0.5, imp * 0.03); // raspando na parede perde um pouco
    if (bx && !bz) Wz *= raspa; else if (bz && !bx) Wx *= raspa;
    if (imp > 4 && V.som) V.som.ruido(0.12, { vol: Math.min(0.5, 0.12 + imp * 0.02), freq: 380 });
    su.vp -= ((ax - Wx) * fx + (az - Wz) * fz) * 0.035; // batida de frente: o nariz abaixa
    v.bateu = imp;
    break;
  }
  v.vel = Wx * fx + Wz * fz; v.lat = -Wx * fz + Wz * fx;

  // ----- vertical -----
  const cmd = (ent.subir ? 1 : 0) - (ent.descer ? 1 : 0);
  let sustenta = false;
  if (d.meio === 'helice') {
    if (motorista && !(sub > 0.05 && cmd <= 0)) { v.vy += (cmd * 6 - v.vy) * Math.min(1, dt * 4); sustenta = true; v.motorLigado = 1; }
    else if (!motorista && noAr) { v.vy += (-4 - v.vy) * Math.min(1, dt * 2); sustenta = true; } // desce de paraquedas
  } else if (d.meio === 'ar') {
    const l = v.vel / (d.decola || 10); // sustentação: proporcional à velocidade
    if (motorista && l >= 1 && (cmd > 0 || noAr)) { v.vy += (cmd * Math.min(7, 2 + v.vel * 0.2) - v.vy) * Math.min(1, dt * 2.5); sustenta = true; }
    else if (noAr) { v.vy += ((motorista ? -7 * (1 - clamp(l, 0, 1)) - (cmd < 0 ? 3 : 0) : -4) - v.vy) * Math.min(1, dt * 2); sustenta = true; } // plana
  }
  if (!sustenta) {
    if (sub > 0) empuxo(V, v, dt, v.densidade ?? f.densidade, sub);
    else {
      v.vy = Math.max(-30, v.vy - GRAV * dt);
      if (v.tAr < 0.1 && v.vy <= 0) v.vy -= 30 * dt; // descendo morro: gruda no chão (não flutua)
    }
  }
  const yAntes = v.y;
  v.y += v.vy * dt;
  if (v.vy > 0 && colideCorpo(V, v, v.x, v.y, v.z, v.yaw)) { v.y = yAntes; v.vy = 0; } // teto

  // chão pelas 4 rodas
  const ch = chaoRodas(V, v, v.x, Math.max(v.y, yAntes)); // a referência é antes da queda deste passo
  v.blocoChao = ch.bloco;
  v.pg += (ch.p - v.pg) * Math.min(1, dt * 20); v.rg += (ch.r - v.rg) * Math.min(1, dt * 20);
  if (v.y <= ch.y + 0.001) {
    const vyChao = clamp(v.vel * Math.sin(ch.p), -20, 9); // subindo rampa: o chão empurra para cima
    if (v.vy < -4) su.vh += Math.max(-3, v.vy * 0.25); // pouso: a mola comprime (a queda de um passo no chão é bem menor)
    if (v.vy < vyChao) v.vy = vyChao;
    const min = ch.y - COMPRIME;
    const yQueda = v.y;
    if (v.y < min) v.y = min;
    if (v.y < ch.y) v.y += Math.min(ch.y - v.y, (2 + Math.abs(v.vel) * 0.8) * dt);
    // o chão subiu (degrau, rampa): o corpo fica um pouco para trás e a mola empurra (a queda do próprio passo não conta)
    const empurrao = Math.min(v.y - yQueda, Math.max(0, v.y - yAntes));
    if (empurrao > 0.01) su.h -= empurrao * 0.7;
    v.apoio = true;
  } else v.apoio = v.y - ch.y < 0.06;
  if (v.y > ALT + 40) { v.y = ALT + 40; v.vy = Math.min(0, v.vy); }
  v.noChao = v.apoio || sub > 0.05;
  v.tAr = v.apoio ? 0 : v.tAr + dt;
  v.sub = sub;

  // ----- suspensão: mola-amortecedor do corpo em volta da pose do chão -----
  v.aL += ((v.vel - vel0) / dt - v.aL) * Math.min(1, dt * 10);
  const aLat = v.vel * (-dyaw / dt); // centrípeta para a direita
  let Pt, Rt;
  if (voa && noAr) {
    if (d.meio === 'ar') { Pt = clamp(Math.atan2(v.vy, Math.max(6, v.vel)) * 0.8, -0.5, 0.5); Rt = -ent.lado * 0.5; }
    else { Pt = clamp(-v.aL * 0.03 - v.vel / d.vmax * 0.15, -0.3, 0.3); Rt = -ent.lado * 0.2; }
  } else if (sub > 0.05 && !v.apoio) {
    const t = performance.now() / 1000, w = inclinacaoOnda(v.x, v.z, t);
    const amp = d.meio === 'agua' ? 3 : 1.5;
    Pt = Math.atan(w.dx * fx + w.dz * fz) * amp; // a onda sobe na frente: nariz sobe
    Rt = Math.atan(w.dx * -fz + w.dz * fx) * amp;
    if (d.meio === 'agua') { Pt += clamp(0.03 + v.aL * 0.02 + Math.abs(v.vel) / d.vmax * 0.08, -0.05, 0.2); Rt -= ent.lado * Math.min(1, Math.abs(v.vel) / 8) * 0.14; }
  } else if (v.apoio) {
    Pt = v.pg + clamp(v.aL * 0.008, -0.1, 0.07);
    Rt = d.inclina ? clamp(-Math.atan(aLat / GRAV), -0.6, 0.6) : v.rg + clamp(aLat * 0.005, -0.08, 0.08);
  } else { Pt = clamp(Math.atan2(v.vy, Math.max(5, Math.abs(v.vel))) * 0.5, -0.45, 0.45); Rt = v.rg * 0.5; }
  const k = f.mola, c = 2 * f.amort * Math.sqrt(k);
  su.vp += (k * (Pt - v.pitch) - c * su.vp) * dt; v.pitch = clamp(v.pitch + su.vp * dt, -0.8, 0.8);
  su.vr += (k * (Rt - v.roll) - c * su.vr) * dt; v.roll = clamp(v.roll + su.vr * dt, -0.7, 0.7);
  su.vh += (-k * su.h - c * su.vh) * dt; su.h = clamp(su.h + su.vh * dt, -0.32, 0.22);
  if (su.h <= -0.32 && su.vh < 0) su.vh = 0;
}

// veículo sem motorista: a mesma física, com freio de mão; parado no chão ele "dorme" (não gasta nada)
export function assentar(V, v, dt) {
  if (v.dorme > 0) {
    v.dorme -= dt;
    if (v.dorme > 0) return;
    const ch = chaoRodas(V, v);
    if (Math.abs(ch.y - v.y) < 0.02 && submersao(V, v) === 0 && !colideCorpo(V, v, v.x, v.y, v.z, v.yaw)) { v.dorme = 0.5; return; }
    v.dorme = 0; v.quieto = 0;
  }
  passo(V, v, dt, PARADO, null, false);
  const su = v.su;
  const quieto = v.apoio && !v.sub && Math.abs(v.vel) < 0.05 && Math.abs(v.lat) < 0.05 && Math.abs(v.vy) < 0.6 &&
    Math.abs(su.vp) + Math.abs(su.vr) + Math.abs(su.vh) < 0.02 && Math.abs(su.h) < 0.01;
  v.quieto = quieto ? (v.quieto || 0) + dt : 0;
  if (v.quieto > 1) { v.dorme = 0.5; v.vy = 0; }
}

// Mapa do mundo de Guerra: a mesma ilha da Ilha de Aventura (relevo, rio, estradas, cidades), com lugares
// que têm função no jogo (guerra.js usa os dados que ficam em cada lugar):
//  - Base Aliada: onde você renasce; hangar, quartel, arsenal (pega armas), heliporto e vagas com tanque, jipe armado e helicóptero
//  - Forte Vermelho: inimigo; soldados, canhão que atira em quem chega perto e o radar (missão: destruir)
//  - Presídio: celas com portões de verdade ligados por fio a uma alavanca na sala de controle; pátio com presos
//  - Delegacia: de onde sai a polícia, com viaturas estacionadas
// Tudo nasce da semente: todos os jogadores veem o mesmo mapa e o servidor guarda só as edições
// (radar destruído, canhão derrubado e alavanca puxada valem para todo mundo).
import { IlhaAventura, TIPOS_LUGAR, ICONE_LUGAR } from './ilha-aventura.js';
import { AR, B, E } from './blocos.js';

const ALT = 64;

const TIPOS_GUERRA = {
  ...TIPOS_LUGAR,
  base: { r: 24, q: true, nomes: ['Base Aliada'] },
  forte: { r: 22, q: true, nomes: ['Forte Vermelho'] },
  prisao: { r: 20, q: true, nomes: ['Presídio da Ilha'] },
  delegacia: { r: 12, q: true, nomes: ['Delegacia Central'] },
};
// a base fica perto do meio (primeiro da lista); o forte bem longe dela
const ORDEM_GUERRA = ['base', 'cidade', 'prisao', 'forte', 'delegacia', 'cidade', 'vila', 'fazenda', 'acampamento', 'vila'];
Object.assign(ICONE_LUGAR, { base: 'escudo', forte: 'tanque', prisao: 'algema', delegacia: 'sirene' });

export class IlhaGuerra extends IlhaAventura {
  get tipos() { return TIPOS_GUERRA; }
  get ordem() { return ORDEM_GUERRA; }
  aceitar(tipo, x, z) {
    const base = this.lugares.find((L) => L.tipo === 'base');
    if (tipo === 'forte' && base) return Math.hypot(x - base.x, z - base.z) > 170;
    if (tipo === 'delegacia') { const c = this.lugares.find((L) => L.tipo === 'cidade'); return !c || Math.hypot(x - c.x, z - c.z) < 120; }
    return true;
  }
  lugar(tipo) { return this.lugares.find((L) => L.tipo === tipo) || null; }

  // ---------- montagem ----------
  montar_base(L) {
    const { x: X, z: Z, y } = L;
    L.pecas.push({ tipo: 'piso', r: [X - 24, Z - 24, X + 24, Z + 24], y, mat: B.PEDRISCO });
    L.pecas.push({ tipo: 'muro', r: [X - 24, Z - 24, X + 24, Z + 24], y, mat: B.PEDRA, alto: 3 });
    L.pecas.push({ tipo: 'galpao', r: [X - 21, Z - 21, X - 5, Z - 9], y, parede: B.PEDRISCO, teto: B.LA_VERDE, alto: 6 });
    L.pecas.push({ tipo: 'galpao', r: [X + 5, Z - 21, X + 21, Z - 11], y, parede: B.TIJOLO, teto: B.LA_VERDE, alto: 4 });
    L.pecas.push({ tipo: 'heliporto', x: X + 13, z: Z + 13, y, r: [X + 9, Z + 9, X + 17, Z + 17] });
    L.pecas.push({ tipo: 'torre', x: X - 18, z: Z + 18, y, alto: 9, nucleo: B.PEDRA, faixa: B.LA_VERDE, r: [X - 22, Z + 14, X - 14, Z + 22] });
    L.pecas.push({ tipo: 'arsenal', x: X - 4, z: Z + 12, y, r: [X - 7, Z + 9, X - 1, Z + 15] });
    L.pecas.push({ tipo: 'bandeira', x: X, z: Z - 3, y, cor: B.LA_AZUL, r: [X - 1, Z - 4, X + 4, Z - 2] });
    L.arsenal = { x: X - 4 + 0.5, y: y + 1, z: Z + 15 + 1.5 };
    L.renascer = { x: X + 0.5, y: y + 1.2, z: Z + 6.5 };
    L.vagas = [
      { k: 'bt', tipo: 'tanque', x: X - 15.5, z: Z + 2.5, r: 0 },
      { k: 'bj', tipo: 'jipeArmado', x: X - 7.5, z: Z + 2.5, r: 0 },
      { k: 'bh', tipo: 'helicopteroGuerra', x: X + 13.5, z: Z + 13.5, r: 0 },
    ];
  }

  montar_forte(L, rng) {
    const { x: X, z: Z, y } = L;
    L.pecas.push({ tipo: 'piso', r: [X - 22, Z - 22, X + 22, Z + 22], y, mat: B.PEDRISCO });
    L.pecas.push({ tipo: 'muro', r: [X - 22, Z - 22, X + 22, Z + 22], y, mat: B.TIJOLO, alto: 5 });
    L.pecas.push({ tipo: 'galpao', r: [X - 18, Z - 18, X - 5, Z - 8], y, parede: B.TIJOLO, teto: B.LA_VERMELHA, alto: 4 });
    for (const [a, b] of [[-17, 17], [17, 17]]) L.pecas.push({ tipo: 'torre', x: X + a, z: Z + b, y, alto: 7, nucleo: B.TIJOLO, faixa: B.LA_VERMELHA, r: [X + a - 4, Z + b - 4, X + a + 4, Z + b + 4] });
    L.pecas.push({ tipo: 'bandeira', x: X, z: Z - 3, y, cor: B.LA_VERMELHA, r: [X - 1, Z - 4, X + 4, Z - 2] });
    // radar: base, mastro e antena (guerra.js derruba quando a vida dele acaba)
    const rx = X + 11, rz = Z - 11;
    const radar = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let k = 1; k <= 2; k++) radar.push([rx + a, y + k, rz + b, B.PEDRISCO]);
    for (let k = 3; k <= 8; k++) radar.push([rx, y + k, rz, B.PEDRA]);
    for (let a = -2; a <= 2; a++) for (let k = 0; k <= 1; k++) radar.push([rx + a, y + 9 + k, rz + (Math.abs(a) === 2 ? 1 : 0), Math.abs(a) <= 1 && k === 1 ? B.VIDRO : B.LA_BRANCA]);
    radar.push([rx, y + 11, rz, B.LAMPIAO]);
    L.radar = { x: rx + 0.5, y: y + 1, z: rz + 0.5, blocos: radar, marca: [rx, y + 8, rz] };
    L.pecas.push({ tipo: 'blocos', lista: radar, r: [rx - 2, rz - 1, rx + 2, rz + 1] });
    // canhão: plataforma; a marca (tijolo no meio) some quando ele é derrubado
    const cx = X + 2, cz = Z + 9;
    const canhao = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) canhao.push([cx + a, y + 1, cz + b, B.PEDRA]);
    canhao.push([cx, y + 2, cz, B.TIJOLO]);
    L.canhao = { x: cx + 0.5, y: y + 3, z: cz + 0.5, marca: [cx, y + 2, cz] };
    L.pecas.push({ tipo: 'blocos', lista: canhao, r: [cx - 1, cz - 1, cx + 1, cz + 1] });
    L.postos = [];
    for (let i = 0; i < 9; i++) L.postos.push({ x: X - 14 + Math.floor(rng() * 28) + 0.5, z: Z - 4 + Math.floor(rng() * 20) + 0.5 });
    L.postos.push({ x: X + 0.5, z: Z + 24.5 }, { x: X - 24.5, z: Z + 0.5 }, { x: X + 24.5, z: Z + 0.5 });
    L.vagas = [{ k: 'ft', tipo: 'tanque', x: X - 10.5, z: Z + 4.5, r: Math.PI }];
  }

  montar_prisao(L) {
    const { x: X, z: Z, y } = L;
    L.pecas.push({ tipo: 'piso', r: [X - 20, Z - 20, X + 20, Z + 20], y, mat: B.PEDRISCO });
    L.pecas.push({ tipo: 'muralha', r: [X - 20, Z - 20, X + 20, Z + 20], y, alto: 6, portao: X });
    for (const a of [-16, 16]) L.pecas.push({ tipo: 'torre', x: X + a, z: Z + 16, y, alto: 6, nucleo: B.PEDRA, faixa: B.LA_BRANCA, r: [X + a - 4, Z + 12, X + a + 4, Z + 20] });
    // bloco de celas: 6 celas (3x3 por dentro) com portão de grade; fio na frente de todos até a alavanca
    const celas = [];
    for (let i = 0; i < 6; i++) {
      const cx = X - 10 + i * 4;
      celas.push({ x: cx + 0.5, z: Z - 14.5, porta: [cx, y + 1, Z - 13] });
    }
    L.celas = celas;
    L.alavanca = [X + 16, y + 1, Z - 12];
    L.pecas.push({ tipo: 'celas', x: X, z: Z, y, celas, alavanca: L.alavanca, r: [X - 13, Z - 18, X + 19, Z - 8] });
    L.portao = { x: X + 0.5, z: Z + 22.5 };
    L.patio = [X - 18, Z - 10, X + 18, Z + 18];
    L.presos = [];
    for (let i = 0; i < 6; i++) L.presos.push({ x: X - 12 + i * 5 + 0.5, z: Z + 2 + (i % 3) * 4 + 0.5 });
    L.guardas = [{ x: X + 0.5, z: Z + 17.5 }, { x: X - 12.5, z: Z - 9.5 }, { x: X + 14.5, z: Z - 6.5 }];
  }

  montar_delegacia(L) {
    const { x: X, z: Z, y } = L;
    L.pecas.push({ tipo: 'piso', r: [X - 12, Z - 12, X + 12, Z + 12], y, mat: B.PEDRISCO });
    L.pecas.push({ tipo: 'predio', r: [X - 7, Z - 10, X + 7, Z - 1], y, andares: 1, parede: B.LA_AZUL });
    L.pecas.push({ tipo: 'poste', x: X - 9, z: Z + 2, y }, { tipo: 'poste', x: X + 9, z: Z + 2, y });
    L.saida = { x: X + 0.5, z: Z + 2.5 };
    L.vagas = [{ k: 'dv1', tipo: 'viatura', x: X - 5.5, z: Z + 7.5, r: Math.PI / 2 }, { k: 'dv2', tipo: 'viatura', x: X + 5.5, z: Z + 7.5, r: Math.PI / 2 }];
  }

  // a ilha de guerra começa na Base Aliada (no chão, sem planar)
  inicio() {
    const b = this.lugar('base');
    if (!b) return super.inicio();
    return { x: b.renascer.x, y: b.renascer.y + 1, z: b.renascer.z };
  }

  // ---------- pintores das peças novas ----------
  pintar_blocos({ put }, p) { for (const [x, y, z, b] of p.lista) put(x, y, z, b); }

  pintar_heliporto({ put, dentro }, p) {
    for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
      const x = p.x + a, z = p.z + b;
      if (!dentro(x, z)) continue;
      const borda = Math.abs(a) === 4 || Math.abs(b) === 4;
      const H = (Math.abs(a) === 2 && Math.abs(b) <= 2) || (b === 0 && Math.abs(a) <= 2);
      put(x, p.y, z, borda ? B.LA_AMARELA : H ? B.LA_BRANCA : B.PEDRA);
      for (let k = 1; k <= 4; k++) put(x, p.y + k, z, AR);
    }
  }

  pintar_bandeira({ put }, p) {
    for (let k = 1; k <= 9; k++) put(p.x, p.y + k, p.z, B.TRONCO);
    for (let a = 1; a <= 3; a++) for (let k = 7; k <= 9; k++) put(p.x + a, p.y + k, p.z, p.cor);
  }

  // arsenal: telheiro com caixotes; ficar na frente dele e tocar no botão dá armas e munição (guerra.js)
  pintar_arsenal({ put }, p) {
    const { x, y, z } = p;
    for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
      const borda = Math.abs(a) === 3 || b === -3;
      for (let k = 1; k <= 4; k++) put(x + a, y + k, z + b, borda && b !== 3 ? (Math.abs(a) === 3 && Math.abs(b) === 3 ? B.TRONCO : B.PEDRISCO) : AR);
      put(x + a, y + 5, z + b, B.LA_VERDE);
    }
    for (const [a, b, alto] of [[-2, -2, 2], [-1, -2, 1], [2, -2, 2], [1, -2, 1], [-2, -1, 1]]) for (let k = 1; k <= alto; k++) put(x + a, y + k, z + b, B.LA_VERDE);
    put(x, y + 4, z + 3, B.LAMPIAO);
  }

  // muralha do presídio: alta, com faixa branca e um portão só (lado de z1)
  pintar_muralha({ put, dentro }, p) {
    const [x0, z0, x1, z1] = p.r;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z) || (x !== x0 && x !== x1 && z !== z0 && z !== z1)) continue;
      const portao = z === z1 && Math.abs(x - p.portao) <= 1;
      for (let k = 1; k <= p.alto; k++) put(x, p.y + k, z, portao && k <= 3 ? AR : k === p.alto - 1 ? B.LA_BRANCA : B.PEDRA);
      if (portao) put(x, p.y + p.alto, z, B.PEDRA);
    }
  }

  // bloco de celas: paredes de pedra, portões de grade (Portão da engenharia: abre com energia),
  // fio na frente das portas até a sala de controle, onde fica a alavanca que abre todas
  pintar_celas({ put, dentro }, p) {
    const { y } = p, X = p.x, Z = p.z;
    const x0 = X - 12, x1 = X + 12, z0 = Z - 17, z1 = Z - 13;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (!dentro(x, z)) continue;
      const parede = z === z0 || z === z1 || (x - x0) % 4 === 0;
      for (let k = 1; k <= 4; k++) put(x, y + k, z, parede ? B.PEDRA : AR);
      put(x, y + 5, z, B.PEDRISCO);
      if (!parede) put(x, y, z, B.TABUAS);
    }
    for (const c of p.celas) {
      const [px, py, pz] = c.porta;
      put(px, py, pz, E.PORTAO); put(px, py + 1, pz, E.PORTAO);
      put(Math.floor(c.x) - 1, y + 1, Math.floor(c.z) - 1, B.LA_BRANCA); // cama
    }
    // fio na frente das portas (encosta em todas) até a sala de controle
    const zf = Z - 12;
    for (let x = x0; x <= X + 15; x++) put(x, y + 1, zf, E.FIO);
    // sala de controle com a alavanca
    const sx0 = X + 13, sx1 = X + 19, sz0 = Z - 15, sz1 = Z - 8;
    for (let x = sx0; x <= sx1; x++) for (let z = sz0; z <= sz1; z++) {
      if (!dentro(x, z)) continue;
      const borda = x === sx0 || x === sx1 || z === sz0 || z === sz1;
      const porta = z === sz1 && (x === X + 16) ;
      for (let k = 1; k <= 3; k++) put(x, y + k, z, borda && !(porta && k <= 2) ? (k === 2 && !porta && z === sz1 ? B.VIDRO : B.PEDRISCO) : AR);
      put(x, y + 4, z, B.LA_AZUL);
    }
    put(sx0, y + 1, zf, E.FIO); // passagem do fio por baixo da parede
    put(X + 14, y + 1, zf, E.FIO); put(X + 15, y + 1, zf, E.FIO);
    const [ax, ay, az] = p.alavanca;
    put(ax, ay, az, E.ALAVANCA);
    put(X + 18, y + 3, Z - 11, B.LAMPIAO);
  }
}
void ALT;

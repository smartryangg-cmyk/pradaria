// Terreno suave low-poly infinito, vegetação, colisões e itens para coletar.
import * as THREE from '../vendor/three.module.min.js';
import { criarRuido, hash3 } from './ruido.js';
import { VEG, juntar, moverPeca, matLowPoly } from './modelos.js';
import { montarQuarteirao, montarEstrada } from './cidade.js';

export const TAM = 48;      // tamanho do pedaço (metros)
const PASSO = 3;            // distância entre vértices
const N = TAM / PASSO;      // células por lado
export const NIVEL_AGUA = 0;
export const CIDADE = 5;               // pedaços para cada lado do centro
export const CIDADE_M = CIDADE * TAM;  // 240 m
export const ALT_CIDADE = 5;
const suave = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };

const C_AREIA = new THREE.Color(0xe9d8a6), C_GRAMA = new THREE.Color(0x8cc63f), C_FLORESTA = new THREE.Color(0x5e9e3a),
  C_PRADO = new THREE.Color(0xa6d65a), C_PEDRA = new THREE.Color(0x9a958c), C_NEVE = new THREE.Color(0xf4f6fa), C_TERRA = new THREE.Color(0xa77b4f),
  C_FUNDO = new THREE.Color(0xc9b98a), C_GRAMADO = new THREE.Color(0x86c25a), C_ACOSTAMENTO = new THREE.Color(0xb59a6a);

// variações pré-montadas de cada vegetação (montar é caro; mover é barato)
const VARIANTES = {};
function variante(tipo, r) {
  if (!VARIANTES[tipo]) VARIANTES[tipo] = [0.15, 0.5, 0.85].map((v) => VEG[tipo](v));
  return VARIANTES[tipo][Math.floor(r * 3) % 3];
}

export class Terreno {
  constructor(cena, semente) {
    this.cena = cena;
    this.semente = semente;
    this.r1 = criarRuido(semente);
    this.r2 = criarRuido(semente + 77);
    this.r3 = criarRuido(semente + 991);
    this.pedacos = new Map();
    this.raio = 3;
    this.colisores = new Map(); // chave -> [{x,z,r}]
  }

  // altura natural (sem cidade/estrada)
  alturaNatural(x, z) {
    const r1 = this.r1, r2 = this.r2;
    const cont = r1.fbm(x / 520, z / 520, 3);              // continentes e lagos
    const morros = r1.fbm(x / 140 + 50, z / 140 - 20, 3);   // ondulação
    let mont = r2.fbm(x / 380, z / 380, 2);                 // montanhas
    mont = Math.max(0, mont - 0.12);
    const det = r2.fbm(x / 35, z / 35, 2);
    return 6 + cont * 16 + morros * 7 + mont * mont * 220 + det * 0.8;
  }

  // altura das estradas que saem da cidade (só depende da posição ao longo da estrada)
  alturaEstrada(t) { return Math.max(2.2, this.r1.fbm(t / 300 + 9, 3.3, 2) * 14 + 7); }

  // altura do chão em (x,z): natural, achatada na cidade e nas estradas
  altura(x, z) {
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d <= CIDADE_M) return ALT_CIDADE;
    let h = this.alturaNatural(x, z);
    // estradas: eixo x=0 (norte-sul) e z=0 (leste-oeste)
    const ax = Math.abs(x), az = Math.abs(z);
    if (ax < 22) { const hr = this.alturaEstradaEm(z); const k = ax < 8 ? 1 : 1 - (ax - 8) / 14; h = h + (hr - h) * suave(k); }
    if (az < 22) { const hr = this.alturaEstradaEm(x); const k = az < 8 ? 1 : 1 - (az - 8) / 14; h = h + (hr - h) * suave(k); }
    if (d < CIDADE_M + 90) { const k = 1 - (d - CIDADE_M) / 90; h = h + (ALT_CIDADE - h) * suave(k); }
    return h;
  }

  alturaEstradaEm(t) {
    const a = Math.abs(t);
    const hr = this.alturaEstrada(t);
    if (a < CIDADE_M + 90) { const k = 1 - Math.max(0, a - CIDADE_M) / 90; return hr + (ALT_CIDADE - hr) * suave(k); }
    return hr;
  }

  naCidade(x, z) { return Math.max(Math.abs(x), Math.abs(z)) < CIDADE_M; }

  // está no asfalto?
  naEstrada(x, z) {
    if (this.naCidade(x, z)) {
      const lx = ((x % TAM) + TAM) % TAM, lz = ((z % TAM) + TAM) % TAM;
      return lx < 5 || lx >= TAM - 5 || lz < 5 || lz >= TAM - 5;
    }
    return Math.abs(x) < 5 || Math.abs(z) < 5;
  }

  // altura exata da malha (igual ao que se vê): interpola o triângulo
  chao(x, z) {
    const gi = Math.floor(x / PASSO), gj = Math.floor(z / PASSO);
    const fx = x / PASSO - gi, fz = z / PASSO - gj;
    const h00 = this.altura(gi * PASSO, gj * PASSO), h10 = this.altura((gi + 1) * PASSO, gj * PASSO);
    const h01 = this.altura(gi * PASSO, (gj + 1) * PASSO), h11 = this.altura((gi + 1) * PASSO, (gj + 1) * PASSO);
    if (((gi + gj) % 2 + 2) % 2 === 1) {
      if (fx + fz < 1) return h00 + (h10 - h00) * fx + (h01 - h00) * fz;
      return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
    }
    if (fz > fx) return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
    return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
  }

  floresta(x, z) { return this.r3.fbm(x / 160, z / 160, 2); }

  bioma(x, z, h) {
    if (h < 1.3) return 'praia';
    if (h > 34) return 'montanha';
    const f = this.floresta(x, z);
    if (f > 0.15) return 'floresta';
    if (f < -0.2) return 'prado';
    return 'campo';
  }

  corEm(x, z, h, ny) {
    if (this.naCidade(x, z)) return C_GRAMADO;
    if ((Math.abs(x) < 7 || Math.abs(z) < 7) && h > 1) return C_ACOSTAMENTO;
    if (h < -0.5) return C_FUNDO;
    if (h < 1.3) return C_AREIA;
    if (h > 46) return C_NEVE;
    if (ny < 0.78 || h > 34) return ny < 0.6 ? C_PEDRA : C_PEDRA.clone().lerp(C_GRAMA, 0.25);
    const f = this.floresta(x, z);
    if (f > 0.15) return C_FLORESTA;
    if (f < -0.2) return C_PRADO;
    return C_GRAMA;
  }

  chave(cx, cz) { return cx + ',' + cz; }

  construir(cx, cz) {
    const ox = cx * TAM, oz = cz * TAM;
    const H = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      // leve deslocamento nos vértices para parecer low-poly orgânico (determinístico pela posição)
      const wx = ox + i * PASSO, wz = oz + j * PASSO;
      H[i + j * (N + 1)] = this.altura(wx, wz);
    }
    const pos = new Float32Array(N * N * 6 * 3), cor = new Float32Array(N * N * 6 * 3);
    let k = 0;
    const tmp = new THREE.Color();
    const tri = (ax, az, bx, bz, cx2, cz2) => {
      const ha = H[ax + az * (N + 1)], hb = H[bx + bz * (N + 1)], hc = H[cx2 + cz2 * (N + 1)];
      const p = [ax * PASSO, ha, az * PASSO, bx * PASSO, hb, bz * PASSO, cx2 * PASSO, hc, cz2 * PASSO];
      // normal
      const ux = p[3] - p[0], uy = p[4] - p[1], uz = p[5] - p[2], vx = p[6] - p[0], vy = p[7] - p[1], vz = p[8] - p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz); ny /= l;
      const mx = ox + (p[0] + p[3] + p[6]) / 3, mz = oz + (p[2] + p[5] + p[8]) / 3, mh = (ha + hb + hc) / 3;
      tmp.copy(this.corEm(mx, mz, mh, Math.abs(ny)));
      const v = 1 + (hash3(Math.floor(mx * 3), 1, Math.floor(mz * 3), this.semente) - 0.5) * 0.08;
      tmp.multiplyScalar(v);
      for (let q = 0; q < 9; q++) pos[k * 9 + q] = p[q];
      for (let q = 0; q < 3; q++) { cor[k * 9 + q * 3] = tmp.r; cor[k * 9 + q * 3 + 1] = tmp.g; cor[k * 9 + q * 3 + 2] = tmp.b; }
      k++;
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if ((i + j) % 2) { tri(i, j, i, j + 1, i + 1, j); tri(i + 1, j, i, j + 1, i + 1, j + 1); }
      else { tri(i, j, i, j + 1, i + 1, j + 1); tri(i, j, i + 1, j + 1, i + 1, j); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cor, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const chao = new THREE.Mesh(g, matLowPoly);
    chao.position.set(ox, 0, oz);
    chao.matrixAutoUpdate = false; chao.updateMatrix();
    chao.userData.terreno = true;

    // vegetação
    const pecas = [], col = [], itens = [];
    let rets = [], carros = [];
    const s = this.semente;
    let nItem = 0;
    const cidade = cx >= -CIDADE && cx < CIDADE && cz >= -CIDADE && cz < CIDADE;
    if (cidade) {
      const q = montarQuarteirao(s, cx, cz);
      pecas.push(...q.pecas); col.push(...q.col); rets = q.rets; carros = q.carros;
    } else pecas.push(...montarEstrada(this, cx, cz));
    for (let j = 0; !cidade && j < TAM; j += 4) for (let i = 0; i < TAM; i += 4) {
      const r = hash3(ox + i, 3, oz + j, s);
      const x = ox + i + hash3(ox + i, 5, oz + j, s) * 3.5, z = oz + j + hash3(ox + i, 9, oz + j, s) * 3.5;
      const h = this.chao(x, z);
      const b = this.bioma(x, z, h);
      const hx = this.altura(x + 1, z) - h, hz = this.altura(x, z + 1) - h;
      const inclinado = Math.hypot(hx, hz) > 0.9;
      const lx = x - ox, lz = z - oz;
      if (Math.abs(x) < 10 || Math.abs(z) < 10 || Math.max(Math.abs(x), Math.abs(z)) < CIDADE_M + 6) continue;
      const rot = r * 40;
      let tipo = null;
      if (b === 'floresta') tipo = r < 0.32 ? (this.floresta(x, z) > 0.35 ? 'pinheiro' : 'arvore') : r < 0.4 ? 'arbusto' : r < 0.43 ? 'pedra' : null;
      else if (b === 'campo') tipo = r < 0.035 ? 'arvore' : r < 0.06 ? 'arbusto' : r < 0.075 ? 'pedra' : r < 0.2 ? 'florzinhas' : null;
      else if (b === 'prado') tipo = r < 0.012 ? 'arvore' : r < 0.45 ? 'florzinhas' : null;
      else if (b === 'praia') tipo = h > 0.2 && r < 0.03 ? 'coqueiro' : null;
      else if (b === 'montanha') tipo = r < 0.06 ? 'pedrona' : r < 0.12 && h < 40 ? 'pinheiro' : null;
      if (inclinado && tipo !== 'pedrona') tipo = r < 0.05 ? 'pedra' : null;
      if (tipo) {
        const esc = tipo === 'florzinhas' ? 1 : 0.8 + hash3(ox + i, 13, oz + j, s) * 0.5;
        for (const pc of variante(tipo, hash3(ox + i, 17, oz + j, s))) pecas.push(moverPeca(pc, lx, h - 0.1, lz, rot, esc));
        const raio = { arvore: 0.35, pinheiro: 0.35, coqueiro: 0.3, pedra: 0.55, pedrona: 1.4, arbusto: 0.5 }[tipo];
        if (raio) col.push({ x, z, r: raio * esc });
      }
      // itens para coletar
      const ri = hash3(ox + i, 23, oz + j, s);
      if (ri < 0.05 && nItem < 6 && !inclinado) {
        let it = null;
        if (b === 'praia' && h > 0.1) it = 'concha';
        else if (b === 'floresta') it = tipo === 'arvore' ? 'maca' : 'cogumelo';
        else if (b === 'prado' || b === 'campo') it = ri < 0.012 ? 'pena' : tipo === 'arvore' ? 'maca' : 'flor';
        else if (b === 'montanha') it = 'cristal';
        if (it) {
          const ix = it === 'maca' ? x + 1.2 : x + 0.8, iz = z + 0.6;
          itens.push({ id: `${cx},${cz},${nItem}`, tipo: it, x: ix, z: iz, y: this.chao(ix, iz) });
          nItem++;
        }
      }
    }
    let veg = null;
    if (pecas.length) {
      veg = new THREE.Mesh(juntar(pecas), matLowPoly);
      veg.position.set(ox, 0, oz);
      veg.matrixAutoUpdate = false; veg.updateMatrix();
    }
    return { cx, cz, chao, veg, col, rets, itens, carros };
  }

  // carrega/descarrega pedaços ao redor; retorna true se mudou algo
  atualizar(px, pz, limite = 2) {
    const pcx = Math.floor(px / TAM), pcz = Math.floor(pz / TAM);
    const R = this.raio;
    const falta = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dz * dz > R * R + 1) continue;
      const k = this.chave(pcx + dx, pcz + dz);
      if (!this.pedacos.has(k)) falta.push([dx * dx + dz * dz, pcx + dx, pcz + dz]);
    }
    falta.sort((a, b) => a[0] - b[0]);
    let mudou = false;
    for (let n = 0; n < Math.min(limite, falta.length); n++) {
      const [, cx, cz] = falta[n];
      const p = this.construir(cx, cz);
      this.cena.add(p.chao);
      if (p.veg) this.cena.add(p.veg);
      this.pedacos.set(this.chave(cx, cz), p);
      if (this.aoCarregar) this.aoCarregar(p);
      mudou = true;
    }
    for (const [k, p] of this.pedacos) {
      const dx = p.cx - pcx, dz = p.cz - pcz;
      if (dx * dx + dz * dz > (R + 1.5) * (R + 1.5)) {
        for (const m of [p.chao, p.veg]) if (m) { this.cena.remove(m); m.geometry.dispose(); }
        this.pedacos.delete(k);
        if (this.aoDescarregar) this.aoDescarregar(p);
        mudou = true;
      }
    }
    return mudou;
  }

  pronto(px, pz) { return this.pedacos.has(this.chave(Math.floor(px / TAM), Math.floor(pz / TAM))); }

  // empurra um círculo (x,z,r) para fora de árvores/pedras
  resolverColisao(pos, r) {
    let bateu = false;
    const cx = Math.floor(pos.x / TAM), cz = Math.floor(pos.z / TAM);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const p = this.pedacos.get(this.chave(cx + dx, cz + dz));
      if (!p) continue;
      for (const c of p.col) {
        const ddx = pos.x - c.x, ddz = pos.z - c.z;
        const d = Math.hypot(ddx, ddz), m = c.r + r;
        if (d < m && d > 0.0001) { pos.x = c.x + (ddx / d) * m; pos.z = c.z + (ddz / d) * m; bateu = true; }
      }
      for (const q of p.rets) {
        if (pos.x + r <= q.x0 || pos.x - r >= q.x1 || pos.z + r <= q.z0 || pos.z - r >= q.z1) continue;
        // sai pelo lado mais próximo
        const e = pos.x + r - q.x0, d2 = q.x1 - (pos.x - r), f = pos.z + r - q.z0, g = q.z1 - (pos.z - r);
        const m = Math.min(e, d2, f, g);
        if (m === e) pos.x = q.x0 - r; else if (m === d2) pos.x = q.x1 + r; else if (m === f) pos.z = q.z0 - r; else pos.z = q.z1 + r;
        bateu = true;
      }
    }
    return bateu;
  }

  malhasChao() { const l = []; for (const p of this.pedacos.values()) l.push(p.chao); return l; }

  limpar() {
    for (const p of this.pedacos.values()) for (const m of [p.chao, p.veg]) if (m) { this.cena.remove(m); m.geometry.dispose(); }
    this.pedacos.clear();
  }
}

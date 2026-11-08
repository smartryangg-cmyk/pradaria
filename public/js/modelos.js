// Modelos 3D feitos de caixinhas (bichos e jogadores), com cores e sombreamento embutidos.
import * as THREE from '../vendor/three.module.min.js';

export const matModelo = new THREE.MeshLambertMaterial({ vertexColors: true });
function malha(geo) { const m = new THREE.Mesh(geo, matModelo); m.castShadow = true; return m; }
// a luz do sol já faz o sombreado; aqui só um toque leve para o desenho ficar nítido
const SOMBRA = [0.95, 0.95, 1, 0.85, 0.92, 0.92];

// cria geometria de caixa com cor por face; o = deslocamento do centro
export function caixa(w, h, d, cor, ox = 0, oy = 0, oz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(ox, oy, oz);
  const c = new THREE.Color(cor);
  const cols = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = (f * 4 + v) * 3;
    cols[i] = c.r * SOMBRA[f]; cols[i + 1] = c.g * SOMBRA[f]; cols[i + 2] = c.b * SOMBRA[f];
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  return g;
}

export function juntar(geos) {
  let nv = 0, ni = 0;
  for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const P = new Float32Array(nv * 3), C = new Float32Array(nv * 3), N = new Float32Array(nv * 3), I = new Uint16Array(ni);
  let ov = 0, oi = 0;
  for (const g of geos) {
    P.set(g.attributes.position.array, ov * 3);
    C.set(g.attributes.color.array, ov * 3);
    if (g.attributes.normal) N.set(g.attributes.normal.array, ov * 3);
    const idx = g.index.array;
    for (let k = 0; k < idx.length; k++) I[oi + k] = idx[k] + ov;
    ov += g.attributes.position.count; oi += idx.length;
    g.dispose();
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(P, 3));
  r.setAttribute('color', new THREE.BufferAttribute(C, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  r.setIndex(new THREE.BufferAttribute(I, 1));
  return r;
}

// perna/braço com pivô no topo
function membro(w, h, d, cor, x, y, z) {
  const m = malha(caixa(w, h, d, cor, 0, -h / 2, 0));
  m.position.set(x, y, z);
  return m;
}

// Cada bicho: corpo (malha única), cabeça e pernas animáveis. Frente = +z.
export const ESPECIES = {
  ovelha: {
    nome: 'Ovelha', vel: 0.9, alt: 1.1, raio: 0.45, som: 'bee',
    montar(r) {
      const la = r < 0.08 ? 0xf6a6c8 : r < 0.18 ? 0x9a8f86 : 0xf4f2ea;
      return {
        corpo: [caixa(0.85, 0.7, 1.15, la, 0, 0.8, 0)],
        cabeca: [caixa(0.42, 0.42, 0.42, 0xd8cfc4, 0, 0, 0.12), caixa(0.5, 0.25, 0.3, la, 0, 0.2, 0.02),
          caixa(0.08, 0.08, 0.02, 0x222222, -0.12, 0.05, 0.34), caixa(0.08, 0.08, 0.02, 0x222222, 0.12, 0.05, 0.34)],
        cabecaPos: [0, 1.1, 0.62],
        pernas: [[0.18, 0.5, 0.18, 0xd8cfc4, [[-0.25, 0.5, 0.38], [0.25, 0.5, 0.38], [-0.25, 0.5, -0.38], [0.25, 0.5, -0.38]]]],
      };
    },
  },
  porquinho: {
    nome: 'Porquinho', vel: 1.0, alt: 0.9, raio: 0.4, som: 'oinc',
    montar() {
      const rosa = 0xf2a5b0;
      return {
        corpo: [caixa(0.75, 0.6, 1.05, rosa, 0, 0.62, 0), caixa(0.08, 0.15, 0.08, 0xe58a98, 0, 0.82, -0.56)],
        cabeca: [caixa(0.55, 0.5, 0.45, rosa, 0, 0, 0.1), caixa(0.28, 0.2, 0.08, 0xe0798a, 0, -0.05, 0.37),
          caixa(0.08, 0.08, 0.02, 0x222222, -0.14, 0.1, 0.335), caixa(0.08, 0.08, 0.02, 0x222222, 0.14, 0.1, 0.335),
          caixa(0.14, 0.14, 0.05, 0xe58a98, -0.2, 0.28, 0.05), caixa(0.14, 0.14, 0.05, 0xe58a98, 0.2, 0.28, 0.05)],
        cabecaPos: [0, 0.75, 0.58],
        pernas: [[0.2, 0.35, 0.2, 0xe58a98, [[-0.22, 0.35, 0.32], [0.22, 0.35, 0.32], [-0.22, 0.35, -0.32], [0.22, 0.35, -0.32]]]],
      };
    },
  },
  galinha: {
    nome: 'Galinha', vel: 0.8, alt: 0.8, raio: 0.25, som: 'cocó',
    montar() {
      return {
        corpo: [caixa(0.42, 0.42, 0.55, 0xfafafa, 0, 0.5, 0), caixa(0.06, 0.3, 0.38, 0xeeeeee, -0.24, 0.52, -0.02), caixa(0.06, 0.3, 0.38, 0xeeeeee, 0.24, 0.52, -0.02)],
        cabeca: [caixa(0.28, 0.32, 0.26, 0xfafafa, 0, 0, 0), caixa(0.14, 0.08, 0.14, 0xf2b632, 0, -0.02, 0.18),
          caixa(0.08, 0.12, 0.06, 0xe23b3b, 0, -0.13, 0.13), caixa(0.06, 0.1, 0.16, 0xe23b3b, 0, 0.2, 0.0),
          caixa(0.05, 0.05, 0.02, 0x222222, -0.1, 0.06, 0.135), caixa(0.05, 0.05, 0.02, 0x222222, 0.1, 0.06, 0.135)],
        cabecaPos: [0, 0.85, 0.25],
        pernas: [[0.06, 0.3, 0.06, 0xf2b632, [[-0.1, 0.3, 0], [0.1, 0.3, 0]]]],
      };
    },
  },
  vaca: {
    nome: 'Vaca', vel: 0.8, alt: 1.4, raio: 0.5, som: 'muu',
    montar() {
      const c = 0xb5763a;
      return {
        corpo: [caixa(0.95, 0.8, 1.4, c, 0, 1.05, 0), caixa(0.5, 0.82, 0.5, 0xf3ece0, 0.25, 1.05, -0.2), caixa(0.3, 0.12, 0.25, 0xf2b5c0, 0, 0.6, -0.25)],
        cabeca: [caixa(0.6, 0.55, 0.45, c, 0, 0, 0.12), caixa(0.45, 0.25, 0.1, 0xf3d6c4, 0, -0.12, 0.38),
          caixa(0.1, 0.18, 0.1, 0xf3ece0, -0.3, 0.32, 0.1), caixa(0.1, 0.18, 0.1, 0xf3ece0, 0.3, 0.32, 0.1),
          caixa(0.08, 0.08, 0.02, 0x222222, -0.16, 0.08, 0.35), caixa(0.08, 0.08, 0.02, 0x222222, 0.16, 0.08, 0.35)],
        cabecaPos: [0, 1.4, 0.78],
        pernas: [[0.22, 0.65, 0.22, 0x8e5a2b, [[-0.3, 0.65, 0.5], [0.3, 0.65, 0.5], [-0.3, 0.65, -0.5], [0.3, 0.65, -0.5]]]],
      };
    },
  },
  cachorro: {
    nome: 'Caramelo', vel: 1.8, alt: 0.9, raio: 0.3, som: 'auau', segue: true,
    montar() {
      const c = 0xd99a4e;
      return {
        corpo: [caixa(0.42, 0.42, 0.85, c, 0, 0.55, 0), caixa(0.1, 0.1, 0.35, c, 0, 0.82, -0.52)],
        cabeca: [caixa(0.42, 0.4, 0.38, c, 0, 0, 0.05), caixa(0.22, 0.18, 0.22, 0xf0d2a8, 0, -0.08, 0.3),
          caixa(0.08, 0.07, 0.04, 0x222222, 0, -0.02, 0.42), caixa(0.12, 0.2, 0.06, 0x9c6127, -0.2, 0.22, -0.04),
          caixa(0.12, 0.2, 0.06, 0x9c6127, 0.2, 0.22, -0.04), caixa(0.07, 0.07, 0.02, 0x222222, -0.11, 0.08, 0.245), caixa(0.07, 0.07, 0.02, 0x222222, 0.11, 0.08, 0.245)],
        cabecaPos: [0, 0.82, 0.5],
        pernas: [[0.13, 0.35, 0.13, 0xc4863f, [[-0.13, 0.35, 0.28], [0.13, 0.35, 0.28], [-0.13, 0.35, -0.28], [0.13, 0.35, -0.28]]]],
      };
    },
  },
  capivara: {
    nome: 'Capivara', vel: 0.6, alt: 0.9, raio: 0.4, som: 'hmm', nada: true,
    montar() {
      const c = 0x8a6a4a;
      return {
        corpo: [caixa(0.72, 0.6, 1.1, c, 0, 0.6, 0)],
        cabeca: [caixa(0.46, 0.46, 0.6, c, 0, 0, 0.15), caixa(0.36, 0.2, 0.1, 0x5e4630, 0, -0.06, 0.48),
          caixa(0.1, 0.1, 0.06, 0x5e4630, -0.17, 0.27, -0.05), caixa(0.1, 0.1, 0.06, 0x5e4630, 0.17, 0.27, -0.05),
          caixa(0.07, 0.07, 0.02, 0x111111, -0.18, 0.1, 0.26), caixa(0.07, 0.07, 0.02, 0x111111, 0.18, 0.1, 0.26)],
        cabecaPos: [0, 0.8, 0.58],
        pernas: [[0.18, 0.3, 0.18, 0x6e5238, [[-0.22, 0.3, 0.35], [0.22, 0.3, 0.35], [-0.22, 0.3, -0.35], [0.22, 0.3, -0.35]]]],
      };
    },
  },
  coelho: {
    nome: 'Coelho', vel: 1.4, alt: 0.6, raio: 0.22, som: 'pi', pula: true,
    montar(r) {
      const c = r < 0.5 ? 0xf5f1ea : 0xa98563;
      return {
        corpo: [caixa(0.3, 0.3, 0.42, c, 0, 0.28, 0), caixa(0.14, 0.14, 0.1, 0xffffff, 0, 0.34, -0.25)],
        cabeca: [caixa(0.26, 0.24, 0.24, c, 0, 0, 0.04), caixa(0.07, 0.24, 0.04, c, -0.07, 0.22, 0), caixa(0.07, 0.24, 0.04, c, 0.07, 0.22, 0),
          caixa(0.05, 0.05, 0.02, 0x222222, -0.07, 0.04, 0.165), caixa(0.05, 0.05, 0.02, 0x222222, 0.07, 0.04, 0.165), caixa(0.05, 0.04, 0.02, 0xf29ac2, 0, -0.04, 0.165)],
        cabecaPos: [0, 0.48, 0.2],
        pernas: [[0.08, 0.14, 0.12, c, [[-0.1, 0.14, 0.1], [0.1, 0.14, 0.1], [-0.1, 0.14, -0.12], [0.1, 0.14, -0.12]]]],
      };
    },
  },
};

export function montarBicho(especie, r) {
  const m = ESPECIES[especie].montar(r);
  const g = new THREE.Group();
  g.add(malha(juntar(m.corpo)));
  const cab = malha(juntar(m.cabeca));
  cab.position.set(...m.cabecaPos);
  g.add(cab);
  const pernas = [];
  for (const [w, h, d, cor, posicoes] of m.pernas) for (const p of posicoes) {
    const pe = membro(w, h, d, cor, ...p);
    g.add(pe); pernas.push(pe);
  }
  return { grupo: g, cabeca: cab, pernas };
}

// boneco do jogador (outros jogadores na rede)
export function montarBoneco(cor = 0x3f6fd9) {
  const g = new THREE.Group();
  const pele = 0xf1c8a0;
  const corpo = malha(juntar([caixa(0.5, 0.65, 0.28, cor, 0, 1.08, 0)]));
  const cab = malha(juntar([caixa(0.48, 0.48, 0.48, pele, 0, 0.24, 0), caixa(0.5, 0.14, 0.5, 0x5a3a22, 0, 0.45, -0.01),
    caixa(0.08, 0.08, 0.02, 0x222222, -0.11, 0.26, 0.245), caixa(0.08, 0.08, 0.02, 0x222222, 0.11, 0.26, 0.245),
    caixa(0.16, 0.04, 0.02, 0xc0605a, 0, 0.12, 0.245)]));
  cab.position.y = 1.4;
  g.add(corpo, cab);
  const bd = membro(0.2, 0.62, 0.22, pele, -0.36, 1.4, 0), be = membro(0.2, 0.62, 0.22, pele, 0.36, 1.4, 0);
  const pd = membro(0.22, 0.75, 0.24, 0x3a4a6a, -0.13, 0.75, 0), pe = membro(0.22, 0.75, 0.24, 0x3a4a6a, 0.13, 0.75, 0);
  g.add(bd, be, pd, pe);
  return { grupo: g, cabeca: cab, membros: [bd, be, pd, pe] };
}

// Animação do boneco (o meu, na 3ª pessoa, e o dos amigos): andar, pular, voar, nadar e bater.
// e = { anda: 0..1, noAr, voando, nadando, golpe: 0..1 (>= 1 = parado), pitch }
export function animarBoneco(b, e, dt) {
  const [bd, be, pd, pe] = b.membros;
  const anda = e.anda > 0.05 ? e.anda : 0;
  b.fase = ((b.fase || 0) + dt * (e.voando ? 2.5 : e.nadando ? 5 : anda ? 7 + anda * 5 : 0)) % (Math.PI * 200);
  const s = Math.sin(b.fase);
  let bdx, bex, bdz = 0, bez = 0, pdx, pex;
  if (e.voando) {
    // asas abertas, pernas para trás balançando de leve
    bdz = -1.25 - s * 0.08; bez = 1.25 + s * 0.08; bdx = bex = 0;
    pdx = 0.3 + s * 0.12; pex = 0.3 - s * 0.12;
  } else if (e.nadando) {
    // braçadas e pernadas
    bdx = -1.5 + s * 0.9; bex = -1.5 - s * 0.9; bdz = -0.25; bez = 0.25;
    pdx = Math.sin(b.fase * 2) * 0.45; pex = -pdx;
  } else if (e.noAr) {
    // pulo: braços sobem um pouco e as pernas abrem
    bdx = bex = -0.45; bdz = -0.35; bez = 0.35;
    pdx = -0.55; pex = 0.35;
  } else {
    const a = s * 0.8 * anda;
    bdx = a; bex = -a; pdx = -a; pex = a;
  }
  // bater / colocar: o braço direito vai para a frente e volta
  if (e.golpe < 1) {
    const g = Math.sin(Math.max(0, e.golpe) * Math.PI);
    bdx = bdx * (1 - g) - 1.9 * g; bdz = bdz * (1 - g) + 0.25 * g;
  }
  bd.rotation.x = bdx; be.rotation.x = bex; bd.rotation.z = bdz; be.rotation.z = bez;
  pd.rotation.x = pdx; pe.rotation.x = pex; pd.rotation.z = pe.rotation.z = 0;
  b.cabeca.rotation.x = -(e.pitch || 0) * 0.6;
}

// etiqueta com o nome acima da cabeça
export function etiqueta(texto) {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 28px system-ui, sans-serif';
  const w = Math.ceil(ctx.measureText(texto).width) + 24;
  cv.width = w; cv.height = 40;
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.roundRect(0, 0, w, 40, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(texto, w / 2, 21);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(w / 150, 40 / 150, 1);
  s.renderOrder = 10;
  return s;
}

// textura de coração / emoji para partículas
const cacheTex = new Map();
export function texturaEmoji(e) {
  if (cacheTex.has(e)) return cacheTex.get(e);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = '52px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e, 32, 36);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheTex.set(e, t);
  return t;
}

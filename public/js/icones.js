// Ícones da Pradaria: desenhos simples em SVG (viewBox 24), feitos à mão para o jogo.
// Cada ícone é uma lista de traços { d, f (preenchimento), s (contorno), w (largura do contorno) }.
// 'c' = currentColor (o ícone pega a cor do texto do botão). Os mesmos dados servem para o
// HTML (svg inline) e para o 3D (desenhados num canvas com Path2D, sem carregar nada).
import * as THREE from '../vendor/three.module.min.js';

const T = '#3b2f22'; // contorno marrom-escuro (mesmo tom do texto)
const circ = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
function estrela(cx, cy, R, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * q).toFixed(2) + ' ' + (cy + Math.sin(a) * q).toFixed(2);
  }
  return d + 'z';
}
// mão: dedos como traços grossos; primeiro o contorno de tudo, depois a cor por cima (vira uma silhueta só)
const DEDOS = 'M8.4 12V6.6M11.1 12V4.6M13.8 12V5.2M16.4 13V7.6M7.6 15.6l-3-3';
const PALMA = 'M7 12h10.6v4.6a4.4 4.4 0 0 1-4.4 4.4h-1.8A4.4 4.4 0 0 1 7 16.6z';

const ICONES = {
  menu: [{ d: 'M5 7h14M5 12h14M5 17h14', s: 'c', w: 2.8 }],
  mais: [{ d: 'M12 5v14M5 12h14', s: 'c', w: 3.2 }],
  pular: [{ d: 'M12 4.5l7 7.5h-4.2v7.5H9.2V12H5z', f: 'c', s: 'c', w: 2 }],
  descer: [{ d: 'M12 19.5l7-7.5h-4.2V4.5H9.2V12H5z', f: 'c', s: 'c', w: 2 }],
  entrar: [{ d: 'M13 4.5h4.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H13M4.5 12h10M11 8l4 4-4 4', s: 'c', w: 2.4 }],
  sair: [{ d: 'M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H11M9.5 12h10M16 8l4 4-4 4', s: 'c', w: 2.4 }],
  voltar: [{ d: 'M19 12H6M11 6.5L5.5 12l5.5 5.5', s: 'c', w: 2.6 }],
  chave: [
    { d: circ(8, 12, 4), f: '#ffd54a', s: T, w: 1.6 },
    { d: 'M12 12h8.5M17.5 12v3M20 12v2.4', s: T, w: 2 },
    { d: circ(8, 12, 1.3), f: T },
  ],
  pessoa: [
    { d: 'M5 20.5c0-4 3.1-6.8 7-6.8s7 2.8 7 6.8z', f: '#6fb7ff', s: T, w: 1.6 },
    { d: circ(12, 8, 3.8), f: '#ffd9b0', s: T, w: 1.6 },
  ],
  acenar: [
    { d: PALMA, f: T, s: T, w: 3.2 },
    { d: DEDOS, s: T, w: 5.2 },
    { d: PALMA, f: '#ffcf9e' },
    { d: DEDOS, s: '#ffcf9e', w: 2.4 },
    { d: 'M3.6 7.4a5 5 0 0 1 2.4-3M19.5 4.4a5 5 0 0 1 1.6 3.4', s: T, w: 1.6 },
  ],
  coracao: [{ d: 'M12 20.4C6.2 16.6 2.8 13.1 2.8 9 2.8 6.2 5 4 7.6 4c1.9 0 3.4 1 4.4 2.6C13 5 14.5 4 16.4 4 19 4 21.2 6.2 21.2 9c0 4.1-3.4 7.6-9.2 11.4z', f: '#ff5d7d', s: T, w: 1.6 },
    { d: 'M6.6 8.2a2 2 0 0 1 1.6-1.4', s: '#fff', w: 1.6 }],
  sorriso: [
    { d: circ(12, 12, 9), f: '#ffd54a', s: T, w: 1.6 },
    { d: circ(9, 10, 1.3) + circ(15, 10, 1.3), f: T },
    { d: 'M7.8 13.6c1 2 2.4 3 4.2 3s3.2-1 4.2-3', s: T, w: 1.8 },
    { d: circ(6.8, 13.4, 1.2) + circ(17.2, 13.4, 1.2), f: '#ff9e9e' },
  ],
  estrela: [{ d: estrela(12, 12.6, 9.6, 4.4), f: '#ffc93c', s: T, w: 1.6 }],
  voar: [
    { d: 'M6.4 13.4C5.2 8.6 6.6 4.6 10.2 2.4c2.2 3.8 2 8.2-.6 11.6z', f: '#fff', s: T, w: 1.5 },
    { d: 'M2.5 14.8c0-3.8 3.2-6.5 7.3-6.5 2.9 0 5.1 1.3 6.2 3.4l5.5.9-4.5 2c-.6 4-4 6.7-8 6.7-3.9 0-6.5-2.6-6.5-6.5z', f: '#8fd3ff', s: T, w: 1.6 },
    { d: 'M4.8 14.6c2.4-.6 5 .2 6.6 2.2-2.4 1.4-5.2 1.2-6.6-.4', f: '#4fa3e0', s: T, w: 1.3 },
    { d: circ(15.2, 12, 1.15), f: T },
  ],
  casa: [
    { d: 'M5.5 10.6L12 5.2l6.5 5.4V20h-13z', f: '#ffe1a8', s: T, w: 1.6 },
    { d: 'M10 20v-4.6a2 2 0 0 1 4 0V20z', f: '#b97a45', s: T, w: 1.4 },
    { d: 'M3 11.8L12 4.3l9 7.5', s: '#e8574a', w: 2.8 },
  ],
  globo: [
    { d: circ(12, 12, 9), f: '#6cc0f0', s: T, w: 1.6 },
    { d: 'M6.4 7.2c1.8 0 2.4 1.5 3.8 1.6 1.2.1 1.6 1.4.6 2.3-1 .9-.5 2.4-1.6 3.3-1 .8-1.4 2.2-1.6 3.3A9 9 0 0 1 6.4 7.2zM14.6 4.4c-.4 1.1.3 2 1.4 2.1 1.3.1 1.6 1.4 1 2.4-.7 1.1.1 2.2 1.4 2.2h2.4a9 9 0 0 0-6.2-6.7zM14.8 14.6c1.4-.4 2.6.4 2.4 1.7-.2 1.4-1.2 2.5-2.4 3.6-1-.9-1.6-2.1-1.2-3.3.2-1 .5-1.7 1.2-2z', f: '#7ccc5a', s: T, w: 1.1 },
  ],
  ampulheta: [
    { d: 'M7.5 3.5h9c0 4.6-3 6.6-4.5 8.5 1.5 1.9 4.5 3.9 4.5 8.5h-9c0-4.6 3-6.6 4.5-8.5-1.5-1.9-4.5-3.9-4.5-8.5z', f: '#fff6d6', s: T, w: 1.6 },
    { d: 'M9.2 19.6c.6-2 1.6-3 2.8-3.6 1.2.6 2.2 1.6 2.8 3.6z', f: '#f2b33d' },
    { d: 'M6 3.5h12M6 20.5h12', s: T, w: 2.2 },
  ],
  amigos: [
    { d: 'M11.6 19.6c.4-3 2.2-5 4.6-5 2.6 0 4.6 2 4.8 5z', f: '#8fd16a', s: T, w: 1.5 },
    { d: circ(16.2, 9.6, 2.8), f: '#ffd9b0', s: T, w: 1.5 },
    { d: 'M3 19.6c0-3.4 2.6-6 5.8-6s5.8 2.6 5.8 6z', f: '#ffb74d', s: T, w: 1.5 },
    { d: circ(8.8, 8.4, 3.4), f: '#ffd9b0', s: T, w: 1.5 },
  ],
  broto: [
    { d: 'M12 20.5v-8', s: '#3f8a2e', w: 2.2 },
    { d: 'M12 13.5c-4.2 0-6.8-2.5-6.8-6.8 4.2 0 6.8 2.5 6.8 6.8z', f: '#7ccc5a', s: T, w: 1.5 },
    { d: 'M12 11.8c0-3.8 2.4-6.3 6.8-6.3 0 3.8-2.4 6.3-6.8 6.3z', f: '#9be07a', s: T, w: 1.5 },
    { d: 'M6 20.5h12', s: '#a86b3c', w: 2.4 },
  ],
  flor: [
    { d: 'M12 13v8', s: '#3f8a2e', w: 2 },
    { d: circ(12, 5.6, 3) + circ(17.2, 9.4, 3) + circ(15.2, 15, 3) + circ(8.8, 15, 3) + circ(6.8, 9.4, 3), f: '#ff9ec4', s: T, w: 1.4 },
    { d: circ(12, 10.6, 2.8), f: '#ffd54a', s: T, w: 1.4 },
  ],
  brilho: [
    { d: 'M10.5 3c.8 4.6 2.4 6.2 7 7-4.6.8-6.2 2.4-7 7-.8-4.6-2.4-6.2-7-7 4.6-.8 6.2-2.4 7-7z', f: '#ffd54a', s: T, w: 1.5 },
    { d: 'M18.5 14.5c.4 2 1 2.6 3 3-2 .4-2.6 1-3 3-.4-2-1-2.6-3-3 2-.4 2.6-1 3-3z', f: '#fff1a8', s: T, w: 1.2 },
  ],
  pata: [
    { d: 'M12 12.6c2.8 0 5.6 2.6 5.6 5 0 1.8-1.4 2.6-2.8 2.6-1.2 0-1.8-.6-2.8-.6s-1.6.6-2.8.6c-1.4 0-2.8-.8-2.8-2.6 0-2.4 2.8-5 5.6-5z', f: '#b5835a', s: T, w: 1.4 },
    { d: circ(5.2, 10.6, 2) + circ(9.2, 6.6, 2.1) + circ(14.8, 6.6, 2.1) + circ(18.8, 10.6, 2), f: '#b5835a', s: T, w: 1.4 },
  ],
  // tela cheia / sair da tela cheia / instalar / celular / água / vila / sono
  telacheia: [{ d: 'M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15', s: 'c', w: 2.8 }],
  sairtela: [{ d: 'M9 4.5V9H4.5M19.5 9H15V4.5M15 19.5V15h4.5M4.5 15H9v4.5', s: 'c', w: 2.8 }],
  baixar: [{ d: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14', s: 'c', w: 2.6 }],
  celular: [
    { d: 'M7.5 2.8h9a1.8 1.8 0 0 1 1.8 1.8v14.8a1.8 1.8 0 0 1-1.8 1.8h-9a1.8 1.8 0 0 1-1.8-1.8V4.6a1.8 1.8 0 0 1 1.8-1.8z', f: '#8fd16a', s: T, w: 1.8 },
    { d: 'M10.5 18h3', s: T, w: 1.8 },
  ],
  gota: [{ d: 'M12 3.2C9 7.6 6.2 10.8 6.2 14.4a5.8 5.8 0 0 0 11.6 0C17.8 10.8 15 7.6 12 3.2z', f: '#4fb3f0', s: T, w: 1.6 },
    { d: 'M9.4 14.6a2.8 2.8 0 0 0 2.2 2.6', s: '#fff', w: 1.4 }],
  vila: [
    { d: 'M2.8 12.2L8 7.4l5.2 4.8v7.6H2.8z', f: '#ffe7b0', s: T, w: 1.6 },
    { d: 'M11 10l5.6-5.2 5.6 5.2v9.8H11z', f: '#ffd27a', s: T, w: 1.6 },
    { d: 'M2 12.8L8 7.2l6 5.6M10.2 10.6l6.4-6 6.4 6', s: '#e0533d', w: 2 },
    { d: 'M6.6 19.8v-3.6h2.8v3.6M15.2 19.8v-4h2.8v4', s: T, w: 1.4 },
  ],
  sono: [{ d: 'M4 6h5L4 12h5M12 11h4l-4 5h4M18 3.5h3l-3 4h3', s: '#6a7fd6', w: 2.2 }],
  // presentes dos aldeões
  maca: [{ d: 'M12 7.6c-2-1.4-6.8-1.4-7.6 3.6-.6 4.4 2.6 9.6 5.4 9.6 1 0 1.4-.6 2.2-.6s1.2.6 2.2.6c2.8 0 6-5.2 5.4-9.6-.8-5-5.6-5-7.6-3.6z', f: '#ff5a4f', s: T, w: 1.6 },
    { d: 'M12 7.6c0-1.8.4-3.2 1.6-4.4', s: T, w: 1.6 }, { d: 'M13 6c1-1.8 3-2.4 4.6-2-.4 1.8-2.4 2.8-4.6 2z', f: '#6cc04a', s: T, w: 1.2 }],
  cenoura: [{ d: 'M15.6 8.4L5.4 19.4c-.6.6-1.4-.2-.8-.8L15.6 8.4c1.2-1.2 3.2.8 2 2z', f: '#ff9a3c', s: T, w: 1.6 },
    { d: 'M5.6 18.6L18 7.4c1-1 .4-2.6-1-2.4L5 17.4', f: '#ff9a3c', s: T, w: 1.6 },
    { d: 'M17 5.4c0-1.6.6-2.6 2-2.8M18 6.6c1.4-.6 2.6-.4 3.2.6M17.8 6c1.2-1.2 2.2-1.6 3-1.4', s: '#4b9636', w: 1.8 }],
  pao: [{ d: 'M4 13c0-4 3.6-6.4 8-6.4s8 2.4 8 6.4v4.4a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.4z', f: '#e8a85a', s: T, w: 1.6 },
    { d: 'M8.4 9.6l1.4 2M12 9l.4 2.4M15.6 9.6l-1.2 2', s: '#fff1d6', w: 1.4 }],
  morango: [{ d: 'M12 20.6c-3.6-1.8-7-6.6-6.2-10 .4-1.8 2.8-2.6 6.2-2.6s5.8.8 6.2 2.6c.8 3.4-2.6 8.2-6.2 10z', f: '#ff4d5e', s: T, w: 1.6 },
    { d: 'M7.6 8.2L9.6 5l2.4 2.2L14.4 5l2 3.2', f: '#5fae43', s: T, w: 1.4 },
    { d: circ(9.6, 12, 0.6) + circ(14.4, 12, 0.6) + circ(12, 15, 0.6) + circ(10, 17, 0.5) + circ(14, 17, 0.5), f: '#ffe58a' }],
  ovo: [{ d: 'M12 3.4c-3.6 0-6.4 5.6-6.4 9.8a6.4 6.4 0 0 0 12.8 0c0-4.2-2.8-9.8-6.4-9.8z', f: '#fff6e4', s: T, w: 1.6 },
    { d: 'M9 10.4c.4-1.4 1-2.4 1.8-3', s: '#d9c7a4', w: 1.4 }],
  bolo: [{ d: 'M4.4 12.4h15.2v7.2H4.4z', f: '#f6c48a', s: T, w: 1.6 },
    { d: 'M4.4 12.4c0-2.6 3.4-4 7.6-4s7.6 1.4 7.6 4c-1.2 1.6-2.4-.2-3.8 1-1.2 1-2.4-.6-3.8.6-1.4 1-2.4-.6-3.8.4-1.2.8-2.6-.4-3.8-2z', f: '#ff8fb1', s: T, w: 1.4 },
    { d: 'M12 8.4V5.2', s: T, w: 1.6 }, { d: 'M12 2.6c.8.8.8 1.8 0 2.4-.8-.6-.8-1.6 0-2.4z', f: '#ffb02e' }],
  milho: [{ d: 'M12 3c2.6 0 3.8 4 3.8 8.4S14.6 20 12 20s-3.8-4.2-3.8-8.6S9.4 3 12 3z', f: '#ffd84a', s: T, w: 1.6 },
    { d: 'M10 7.4h4M9.4 10.4h5.2M9.4 13.4h5.2M10 16.4h4M12 4v15', s: '#d9a91f', w: 1 },
    { d: 'M12 21c-2.6-1.4-5-5-5.4-9 1.6 1.6 3 4 3.6 6M12 21c2.6-1.4 5-5 5.4-9-1.6 1.6-3 4-3.6 6', f: '#6cc04a', s: T, w: 1.4 }],
  // bloquinho de grama (logo)
  bloco: [
    { d: 'M12 2.8l8.6 4.8v9.8L12 22.2l-8.6-4.8V7.6z', f: T, s: T, w: 2 },
    { d: 'M3.4 7.6L12 12.4v9.8l-8.6-4.8z', f: '#b07a45' },
    { d: 'M20.6 7.6L12 12.4v9.8l8.6-4.8z', f: '#8c5c31' },
    { d: 'M3.4 7.6L12 12.4v3l-1.4-.6-1 1.2-1.6-1.6-1.4.6-1.2-1.8-1.2.4-.8-1.2z', f: '#5fae43' },
    { d: 'M20.6 7.6L12 12.4v3l1.4-.6 1 1.2 1.6-1.6 1.4.6 1.2-1.8 1.2.4.8-1.2z', f: '#4b9636' },
    { d: 'M12 2.8l8.6 4.8-8.6 4.8-8.6-4.8z', f: '#7ccc5a' },
    { d: 'M12 2.8l8.6 4.8v9.8L12 22.2l-8.6-4.8V7.6zM3.4 7.6L12 12.4l8.6-4.8M12 12.4v9.8', s: T, w: 1.4 },
  ],
};

export const NOMES_ICONES = Object.keys(ICONES);

// emotes que circulam pela rede (os nomes); emojis antigos de versões passadas viram o nome equivalente
export const EMOTES = ['acenar', 'coracao', 'sorriso', 'estrela'];
const cp = (...c) => String.fromCodePoint(...c);
const ANTIGOS = { [cp(0x1F44B)]: 'acenar', [cp(0x2764, 0xFE0F)]: 'coracao', [cp(0x2764)]: 'coracao', [cp(0x1F604)]: 'sorriso', [cp(0x2B50)]: 'estrela' };
export function nomeEmote(e) {
  if (typeof e !== 'string') return null;
  if (EMOTES.includes(e)) return e;
  return ANTIGOS[e] || null;
}

const cor = (c) => (c === 'c' ? 'currentColor' : c);
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

// devolve o <svg> como texto (para innerHTML)
export function icone(nome, classe = 'ic-svg') {
  const lista = ICONES[nome];
  if (!lista) return '';
  let s = `<svg class="${esc(classe)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">`;
  for (const p of lista) {
    s += `<path d="${p.d}" fill="${p.f ? cor(p.f) : 'none'}"`;
    if (p.s) s += ` stroke="${cor(p.s)}" stroke-width="${p.w || 1.6}" stroke-linecap="round" stroke-linejoin="round"`;
    s += '/>';
  }
  return s + '</svg>';
}

// preenche todos os elementos marcados com data-icone="nome" (dentro de raiz)
export function preencherIcones(raiz = document) {
  for (const el of raiz.querySelectorAll('[data-icone]')) {
    if (el.dataset.iconePronto === el.dataset.icone) continue;
    el.innerHTML = icone(el.dataset.icone);
    el.dataset.iconePronto = el.dataset.icone;
  }
}

// texto com ícone ao lado (para avisos): devolve HTML seguro
export function comIcone(nome, texto) {
  return (nome ? icone(nome, 'ic-svg ic-aviso') : '') + `<span>${esc(texto)}</span>`;
}

// ---------- 3D: ícone desenhado num canvas, com borda branca para ler bem no céu ----------
const cacheTex = new Map();
export function texturaIcone(nome) {
  if (!ICONES[nome]) nome = 'coracao';
  if (cacheTex.has(nome)) return cacheTex.get(nome);
  const N = 128, m = 14; // tamanho e margem (pixels)
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const k = (N - 2 * m) / 24;
  ctx.translate(m, m); ctx.scale(k, k);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const caminhos = ICONES[nome].map((p) => ({ ...p, path: new Path2D(p.d) }));
  // 1) borda branca: tudo engordado em branco
  ctx.strokeStyle = ctx.fillStyle = '#fff';
  for (const p of caminhos) {
    if (p.f) ctx.fill(p.path);
    ctx.lineWidth = (p.s ? p.w || 1.6 : 0) + 4.4;
    ctx.stroke(p.path);
  }
  // 2) o ícone em si
  for (const p of caminhos) {
    if (p.f) { ctx.fillStyle = p.f === 'c' ? T : p.f; ctx.fill(p.path); }
    if (p.s) { ctx.strokeStyle = p.s === 'c' ? T : p.s; ctx.lineWidth = p.w || 1.6; ctx.stroke(p.path); }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheTex.set(nome, t);
  return t;
}

// Minimapa (canto da tela) e mapa grande (toque no minimapa ou tecla M).
// Leve para tablet: cada pedaço do mundo vira uma imagenzinha 16x16 (1 pixel por coluna),
// feita uma vez e refeita só quando um bloco muda; o minimapa é redesenhado ~5x por segundo.
import { BLOCOS, AR, AGUA, PLANTA } from './blocos.js';
import { CX, CZ, ALT } from './mundo.js';
import { REGIAO } from './vilas.js';
import { ICONE_LUGAR } from './ilha-aventura.js';
import { texturaIcone } from './icones.js';

const MAX_PEDACOS = 2500; // pedaços lembrados para o mapa grande (~2,5 MB no pior caso)
const POR_VEZ = 3; // pedaços desenhados por atualização (não trava o jogo)

// cor de cada bloco = média da textura de cima no atlas
function coresDosBlocos(atlasCanvas) {
  const W = atlasCanvas.width;
  const px = atlasCanvas.getContext('2d').getImageData(0, 0, W, atlasCanvas.height).data; // uma leitura só
  const cores = new Uint8Array(256 * 3);
  for (const b of BLOCOS) {
    if (!b || b.id === AR) continue;
    const t = b.tiles[0], x0 = (t % 8) * 16, y0 = Math.floor(t / 8) * 16;
    let r = 0, g = 0, bl = 0, n = 0;
    for (let yy = y0; yy < y0 + 16; yy++) for (let xx = x0; xx < x0 + 16; xx++) {
      const i = (yy * W + xx) * 4;
      if (px[i + 3] > 128) { r += px[i]; g += px[i + 1]; bl += px[i + 2]; n++; }
    }
    if (n) { cores[b.id * 3] = r / n; cores[b.id * 3 + 1] = g / n; cores[b.id * 3 + 2] = bl / n; }
  }
  // água sempre azulzinha e bem visível
  for (const b of BLOCOS) if (b && b.agua) { cores[b.id * 3] = 64; cores[b.id * 3 + 1] = 140; cores[b.id * 3 + 2] = 220; }
  return cores;
}

export class Mapa {
  constructor({ atlasCanvas, mini, grande, aoAbrir, aoFechar }) {
    this.cores = coresDosBlocos(atlasCanvas);
    this.mini = mini; // <canvas> do minimapa
    this.grande = grande; // { janela, canvas, coords, fechar, mais, menos, centrar, limpar }
    this.aoAbrir = aoAbrir; this.aoFechar = aoFechar;
    this.pedacos = new Map(); // "cx,cz" -> { cv, sujo }
    this.mundo = null;
    this.marca = null; // ponto marcado pelo jogador {x, z}
    this.chaveMarca = null;
    this.tempo = 0;
    this.ligado = true;
    this.zoom = 2; // pixels por bloco no mapa grande
    this.centro = null; // centro do mapa grande (quando o jogador arrasta)
    this.ctxMini = mini.getContext('2d');
    this.ctxGrande = grande.canvas.getContext('2d');
    this.ligarMapaGrande();
  }

  // novo mundo: esquece o mapa anterior e fica de olho nas mudanças de bloco
  usarMundo(mundo, chaveMarca) {
    this.mundo = mundo;
    this.pedacos.clear();
    this.chaveMarca = chaveMarca;
    this.marca = null;
    try { this.marca = JSON.parse(localStorage.getItem(chaveMarca) || 'null'); } catch {}
    if (!mundo) return;
    const sujar = (x, z) => {
      const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
      const p = this.pedacos.get(cx + ',' + cz);
      if (p) p.sujo = true;
    };
    for (const nome of ['definir', 'definirAgua']) {
      const orig = mundo[nome].bind(mundo);
      mundo[nome] = (x, y, z, ...resto) => { const r = orig(x, y, z, ...resto); sujar(x, z); return r; };
    }
  }

  // imagem 16x16 de um pedaço: cor do bloco mais alto de cada coluna, com relevo
  desenharPedaco(c) {
    const k = c.cx + ',' + c.cz;
    let p = this.pedacos.get(k);
    if (!p) {
      if (this.pedacos.size >= MAX_PEDACOS) this.pedacos.delete(this.pedacos.keys().next().value);
      const cv = document.createElement('canvas');
      cv.width = CX; cv.height = CZ;
      p = { cv, sujo: true };
      this.pedacos.set(k, p);
    }
    const d = c.dados, cores = this.cores;
    const ctx = p.cv.getContext('2d');
    const img = ctx.createImageData(CX, CZ);
    const alturas = new Int16Array(CX * CZ);
    const blocos = new Uint8Array(CX * CZ);
    const fundo = new Uint8Array(CX * CZ); // profundidade da água
    const camada = CX * CZ;
    for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const col = x + z * CX;
      let y = ALT - 1, b = AR;
      for (; y > 0; y--) { b = d[col + y * camada]; if (b !== AR && !PLANTA[b]) break; } // flores e capim: mostra o chão
      // olha através da água para mostrar o fundo mais escuro
      let prof = 0;
      if (AGUA[b]) { let yy = y - 1; while (yy > 0 && AGUA[d[col + yy * camada]] && prof < 6) { yy--; prof++; } }
      alturas[col] = y; blocos[col] = b; fundo[col] = prof;
    }
    for (let z = 0; z < CZ; z++) for (let x = 0; x < CX; x++) {
      const col = x + z * CX, b = blocos[col];
      // relevo: mais claro onde sobe para o norte, mais escuro onde desce
      const hN = z > 0 ? alturas[col - CX] : alturas[col];
      const hO = x > 0 ? alturas[col - 1] : alturas[col];
      let luz = AGUA[b] ? 1 - fundo[col] * 0.06 : 1 + Math.max(-0.25, Math.min(0.25, (alturas[col] - hN + alturas[col] - hO) * 0.09));
      luz *= 0.88 + (alturas[col] / ALT) * 0.3;
      const o = col * 4;
      img.data[o] = Math.min(255, cores[b * 3] * luz);
      img.data[o + 1] = Math.min(255, cores[b * 3 + 1] * luz);
      img.data[o + 2] = Math.min(255, cores[b * 3 + 2] * luz);
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    p.sujo = false;
  }

  // chamado todo quadro; o trabalho de verdade acontece poucas vezes por segundo
  atualizar(dt, jog, outros, bichos, forcar = false) {
    if (!this.mundo || (!this.ligado && this.grande.janela.hidden)) return;
    this.tempo += dt;
    if (this.tempo < 0.2 && !forcar) return;
    this.tempo = 0;
    // desenha os pedaços novos ou mudados, os mais perto primeiro
    const pcx = Math.floor(jog.pos.x / CX), pcz = Math.floor(jog.pos.z / CZ);
    const pend = [];
    for (const c of this.mundo.chunks.values()) {
      const p = this.pedacos.get(c.cx + ',' + c.cz);
      if (!p || p.sujo) pend.push([(c.cx - pcx) ** 2 + (c.cz - pcz) ** 2, c]);
    }
    pend.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < pend.length && i < (forcar ? 40 : POR_VEZ); i++) this.desenharPedaco(pend[i][1]);
    this.jog = jog; this.outros = outros; this.bichos = bichos;
    if (this.ligado) this.desenharMini();
    if (!this.grande.janela.hidden) this.desenharGrande();
  }

  // desenha os pedaços conhecidos em volta de (wx, wz) com "esc" pixels por bloco
  desenharTerreno(ctx, w, h, wx, wz, esc) {
    ctx.fillStyle = '#26394d';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    const meiaW = w / 2 / esc, meiaH = h / 2 / esc;
    const cx0 = Math.floor((wx - meiaW) / CX), cx1 = Math.floor((wx + meiaW) / CX);
    const cz0 = Math.floor((wz - meiaH) / CZ), cz1 = Math.floor((wz + meiaH) / CZ);
    const t = CX * esc;
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const p = this.pedacos.get(cx + ',' + cz);
      if (!p) continue;
      // arredonda para não aparecer risquinho entre os pedaços
      const sx = Math.round(w / 2 + (cx * CX - wx) * esc), sy = Math.round(h / 2 + (cz * CZ - wz) * esc);
      ctx.drawImage(p.cv, sx, sy, t, t);
    }
  }

  ponto(ctx, x, y, r, cor, borda = '#fff') {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = cor; ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.35); ctx.strokeStyle = borda; ctx.stroke();
  }

  // setinha do jogador apontando para onde ele olha
  seta(ctx, x, y, yaw, tam) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw); // olhando para o norte (yaw 0) a seta aponta para cima
    ctx.beginPath();
    ctx.moveTo(0, -tam); ctx.lineTo(tam * 0.7, tam * 0.75); ctx.lineTo(0, tam * 0.35); ctx.lineTo(-tam * 0.7, tam * 0.75); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = tam * 0.22; ctx.strokeStyle = '#d23c3c'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }

  // alfinete do ponto marcado; se estiver fora, fica na borda apontando o caminho
  alfinete(ctx, sx, sy, w, h, tam, redondo) {
    let x = sx, y = sy, fora = false;
    const m = tam * 1.2;
    if (redondo) {
      const dx = x - w / 2, dy = y - h / 2, r = w / 2 - m, d = Math.hypot(dx, dy);
      if (d > r) { x = w / 2 + (dx / d) * r; y = h / 2 + (dy / d) * r; fora = true; }
    } else if (x < m || y < m || x > w - m || y > h - m) {
      x = Math.max(m, Math.min(w - m, x)); y = Math.max(m, Math.min(h - m, y)); fora = true;
    }
    // ícone "pino" (a ponta fica embaixo, no lugar marcado)
    const t = tam * 2.6;
    ctx.save();
    ctx.globalAlpha = fora ? 0.85 : 1;
    ctx.drawImage(texturaIcone('pino').image, x - t / 2, y - t * 0.92, t, t);
    ctx.restore();
  }

  desenharMarcadores(ctx, w, h, wx, wz, esc, grande) {
    const tela = (x, z) => [w / 2 + (x - wx) * esc, h / 2 + (z - wz) * esc];
    const dentro = (sx, sy) => sx > -10 && sy > -10 && sx < w + 10 && sy < h + 10;
    // vilas já descobertas: casinha com o nome
    const vilas = this.mundo && this.mundo.vilas;
    if (vilas) {
      const R = REGIAO, meiaW = w / 2 / esc, meiaH = h / 2 / esc;
      const rx0 = Math.floor((wx - meiaW) / R), rx1 = Math.floor((wx + meiaW) / R);
      const rz0 = Math.floor((wz - meiaH) / R), rz1 = Math.floor((wz + meiaH) / R);
      if ((rx1 - rx0 + 1) * (rz1 - rz0 + 1) <= 64) for (let rz = rz0; rz <= rz1; rz++) for (let rx = rx0; rx <= rx1; rx++) {
        const v = vilas.regiao(rx, rz);
        if (!v || !this.pedacos.has(Math.floor(v.x / CX) + ',' + Math.floor(v.z / CZ))) continue;
        const [sx, sy] = tela(v.x, v.z);
        if (!dentro(sx, sy)) continue;
        const t = grande ? 30 : 18;
        ctx.drawImage(texturaIcone('vila').image, sx - t / 2, sy - t / 2, t, t);
        ctx.textAlign = 'center';
        if (grande && v.nome) {
          ctx.font = 'bold 13px system-ui, sans-serif';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(v.nome, sx, sy + 20);
          ctx.fillStyle = '#fff'; ctx.fillText(v.nome, sx, sy + 20);
        }
      }
    }
    // Ilha de Aventura: todos os lugares com nome aparecem desde o começo (como num mapa de verdade)
    const ilha = this.mundo && this.mundo.aventura;
    if (ilha) for (const L of ilha.lugares) {
      const [sx, sy] = tela(L.x, L.z);
      if (!dentro(sx, sy)) continue;
      const t = grande ? 26 : 14;
      ctx.drawImage(texturaIcone(ICONE_LUGAR[L.tipo] || 'pino').image, sx - t / 2, sy - t / 2, t, t);
      if (grande) {
        ctx.textAlign = 'center'; ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(L.nome, sx, sy + 20);
        ctx.fillStyle = '#fff'; ctx.fillText(L.nome, sx, sy + 20);
      }
    }
    // bichinhos: pontinhos rosados
    if (this.bichos) for (const b of this.bichos.lista) {
      const [sx, sy] = tela(b.x, b.z);
      if (dentro(sx, sy)) this.ponto(ctx, sx, sy, grande ? 3.5 : 2.2, '#ffb3c7', 'rgba(90,40,50,.8)');
    }
    // amigos: bolinha da cor da camiseta (e o nome no mapa grande)
    if (this.outros) for (const o of this.outros.values()) {
      const g = o.grupo.position;
      let [sx, sy] = tela(g.x, g.z);
      if (!grande) { // no minimapa, quem está longe fica na borda
        const dx = sx - w / 2, dy = sy - h / 2, r = w / 2 - 6, d = Math.hypot(dx, dy);
        if (d > r) { sx = w / 2 + (dx / d) * r; sy = h / 2 + (dy / d) * r; }
      } else if (!dentro(sx, sy)) continue;
      this.ponto(ctx, sx, sy, grande ? 7 : 4.5, o.corCss || '#3f6fd9');
      if (grande) {
        ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(o.nome, sx, sy - 12);
        ctx.fillStyle = '#fff'; ctx.fillText(o.nome, sx, sy - 12);
      }
    }
    if (this.marca) { const [sx, sy] = tela(this.marca.x, this.marca.z); this.alfinete(ctx, sx, sy, w, h, grande ? 14 : 8, !grande); }
    const [jx, jy] = tela(this.jog.pos.x, this.jog.pos.z);
    this.seta(ctx, jx, jy, this.jog.yaw, grande ? 11 : 7);
  }

  desenharMini() {
    const cv = this.mini, ctx = this.ctxMini;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const tam = Math.round(cv.clientWidth * dpr) || 120;
    if (cv.width !== tam) { cv.width = tam; cv.height = tam; }
    const esc = tam / 64; // mostra 64 blocos de ponta a ponta
    const { x, z } = this.jog.pos;
    ctx.save();
    ctx.beginPath(); ctx.arc(tam / 2, tam / 2, tam / 2, 0, Math.PI * 2); ctx.clip();
    this.desenharTerreno(ctx, tam, tam, x, z, esc);
    ctx.scale(dpr, dpr);
    this.desenharMarcadores(ctx, tam / dpr, tam / dpr, x, z, esc / dpr, false);
    ctx.restore();
  }

  desenharGrande() {
    const cv = this.grande.canvas, ctx = this.ctxGrande;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (!w || !h) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const c = this.centro || this.jog.pos;
    ctx.save();
    this.desenharTerreno(ctx, w, h, c.x, c.z, this.zoom * dpr);
    ctx.scale(dpr, dpr);
    this.desenharMarcadores(ctx, w / dpr, h / dpr, c.x, c.z, this.zoom, true);
    ctx.restore();
    const p = this.jog.pos;
    this.grande.coords.textContent = `Você está em  x ${Math.floor(p.x)} · z ${Math.floor(p.z)}` + (this.marca ? `  ·  ponto marcado a ${Math.round(Math.hypot(this.marca.x - p.x, this.marca.z - p.z))} blocos` : '');
    this.grande.limpar.hidden = !this.marca;
  }

  abrir() {
    if (!this.mundo || !this.jog) return;
    this.centro = null;
    this.grande.janela.hidden = false;
    this.aoAbrir && this.aoAbrir();
    this.atualizar(0, this.jog, this.outros, this.bichos, true);
  }

  fechar() {
    if (this.grande.janela.hidden) return;
    this.grande.janela.hidden = true;
    this.aoFechar && this.aoFechar();
  }

  salvarMarca() { try { localStorage.setItem(this.chaveMarca, JSON.stringify(this.marca)); } catch {} }

  ligarMapaGrande() {
    const g = this.grande, cv = g.canvas;
    const redesenhar = () => { if (this.jog) this.desenharGrande(); };
    g.fechar.addEventListener('click', () => this.fechar());
    g.mais.addEventListener('click', () => { this.zoom = Math.min(8, this.zoom * 1.5); redesenhar(); });
    g.menos.addEventListener('click', () => { this.zoom = Math.max(0.5, this.zoom / 1.5); redesenhar(); });
    g.centrar.addEventListener('click', () => { this.centro = null; redesenhar(); });
    g.limpar.addEventListener('click', () => { this.marca = null; this.salvarMarca(); redesenhar(); });
    // arrastar para passear pelo mapa; tocar sem arrastar marca um ponto
    const toques = new Map();
    let arrastou = false, distPinca = 0;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.size === 1) arrastou = false;
      if (toques.size === 2) { const [a, b] = [...toques.values()]; distPinca = Math.hypot(a.x - b.x, a.y - b.y); arrastou = true; }
    });
    cv.addEventListener('pointermove', (e) => {
      const t = toques.get(e.pointerId);
      if (!t || !this.jog) return;
      if (toques.size === 2) { // pinça para dar zoom
        t.x = e.clientX; t.y = e.clientY;
        const [a, b] = [...toques.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (distPinca > 0) this.zoom = Math.max(0.5, Math.min(8, this.zoom * d / distPinca));
        distPinca = d; redesenhar(); return;
      }
      const dx = e.clientX - t.x, dy = e.clientY - t.y;
      if (!arrastou && Math.hypot(dx, dy) < 8) return;
      arrastou = true;
      const c = this.centro || { x: this.jog.pos.x, z: this.jog.pos.z };
      this.centro = { x: c.x - dx / this.zoom, z: c.z - dy / this.zoom };
      t.x = e.clientX; t.y = e.clientY;
      redesenhar();
    });
    const soltar = (e) => {
      if (!toques.has(e.pointerId)) return;
      toques.delete(e.pointerId);
      if (e.type === 'pointerup' && !arrastou && !toques.size && this.jog) {
        const r = cv.getBoundingClientRect();
        const c = this.centro || this.jog.pos;
        const x = c.x + (e.clientX - r.left - r.width / 2) / this.zoom;
        const z = c.z + (e.clientY - r.top - r.height / 2) / this.zoom;
        // tocar perto do alfinete tira ele; em outro lugar, muda ele de lugar
        if (this.marca && Math.hypot(this.marca.x - x, this.marca.z - z) * this.zoom < 22) this.marca = null;
        else this.marca = { x: Math.floor(x) + 0.5, z: Math.floor(z) + 0.5 };
        this.salvarMarca();
        redesenhar();
      }
    };
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.max(0.5, Math.min(8, this.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2))); redesenhar(); }, { passive: false });
  }
}

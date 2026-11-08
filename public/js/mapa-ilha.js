// Mapa da Ilha de Aventura: a ilha inteira vista de cima, com o nome de cada lugar,
// as estradas, onde você está e onde estão os amigos. Desenhado uma vez por mundo.
import { LIMITE_AVENTURA } from './ilha-aventura.js';

const N = 256; // pixels do desenho
const MEIA = LIMITE_AVENTURA - 26; // a ilha vai até uns 230 blocos do meio
const PASSO = (MEIA * 2) / N;

export class MapaIlha {
  constructor(janela) {
    this.janela = janela;
    this.tela = janela.querySelector('canvas');
    this.fundo = null; // desenho da ilha (cache)
    this.ilha = null;
  }

  // desenha o terreno (uma vez para cada ilha)
  preparar(ilha) {
    if (this.ilha === ilha && this.fundo) return;
    this.ilha = ilha;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const [r, gr, b] = ilha.corMapa(-MEIA + (i + 0.5) * PASSO, -MEIA + (j + 0.5) * PASSO);
      const k = (i + j * N) * 4;
      img.data[k] = r; img.data[k + 1] = gr; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.fundo = c;
  }

  // eu = {x, z, yaw}; amigos = [{x, z, nome}]
  desenhar(eu, amigos) {
    const t = this.tela, S = t.width, g = t.getContext('2d');
    const px = (x) => ((x + MEIA) / (MEIA * 2)) * S;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.fundo, 0, 0, S, S);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${Math.round(S / 34)}px system-ui, sans-serif`;
    g.lineJoin = 'round';
    for (const L of this.ilha.lugares) {
      const x = px(L.x), y = px(L.z);
      g.fillStyle = '#2b2b2b'; g.beginPath(); g.arc(x, y, S / 120, 0, 7); g.fill();
      g.lineWidth = S / 120; g.strokeStyle = 'rgba(255,255,255,.95)';
      g.strokeText(L.nome, x, y - S / 40); g.fillStyle = '#26323a'; g.fillText(L.nome, x, y - S / 40);
    }
    for (const a of amigos) {
      const x = px(a.x), y = px(a.z);
      g.fillStyle = '#4f8fe8'; g.strokeStyle = '#fff'; g.lineWidth = S / 200;
      g.beginPath(); g.arc(x, y, S / 90, 0, 7); g.fill(); g.stroke();
    }
    // eu: setinha vermelha apontando para onde estou olhando
    const x = px(eu.x), y = px(eu.z), r = S / 45;
    g.save(); g.translate(x, y); g.rotate(-eu.yaw);
    g.fillStyle = '#ff5d5d'; g.strokeStyle = '#fff'; g.lineWidth = S / 200;
    g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.7, r * 0.8); g.lineTo(0, r * 0.4); g.lineTo(-r * 0.7, r * 0.8); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}

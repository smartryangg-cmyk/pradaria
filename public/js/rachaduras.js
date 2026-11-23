// Rachaduras (jogo base, como no clássico): enquanto segura para quebrar, o bloco ganha trincas em 10 estágios,
// do risquinho ao bloco todo rachado. É uma "casca" um tiquinho maior que o bloco, com o desenho das trincas
// (feito aqui, pixel a pixel, no nosso traço). Os amigos online também veem (mensagem 'racha').
import * as THREE from '../vendor/three.module.min.js';
import { ESTAGIOS } from './quebra-regras.js';

const PX = 16;
// as trincas: galhos que saem do meio e se dividem; cada estágio desenha um pedaço a mais dos mesmos galhos
function trincas() {
  let s = 7331;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) | 0; return ((s >>> 8) & 0xffff) / 65536; };
  const pontos = []; // [x, y, ordem]
  const galho = (x, y, dx, dy, passo, vida) => {
    for (let i = 0; i < vida; i++) {
      x += dx; y += dy;
      if (rnd() < 0.35) { if (dx && rnd() < 0.5) dy = dy ? 0 : (rnd() < 0.5 ? 1 : -1); else if (dy) dx = dx ? 0 : (rnd() < 0.5 ? 1 : -1); }
      if (x < 0 || y < 0 || x >= PX || y >= PX) return;
      pontos.push([x, y, passo + i]);
      if (rnd() < 0.12) galho(x, y, rnd() < 0.5 ? 1 : -1, rnd() < 0.5 ? 1 : -1, passo + i, 3 + (rnd() * 4 | 0));
    }
  };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) galho(7, 8, dx, dy, (rnd() * 3) | 0, 9);
  return pontos;
}
const PONTOS = trincas();
const MAX_ORDEM = Math.max(...PONTOS.map((p) => p[2]));

function textura(estagio) {
  const c = document.createElement('canvas'); c.width = c.height = PX;
  const g = c.getContext('2d');
  const ate = ((estagio + 1) / ESTAGIOS) * (MAX_ORDEM + 1);
  for (const [x, y, o] of PONTOS) {
    if (o >= ate) continue;
    g.fillStyle = 'rgba(20,14,10,0.78)'; g.fillRect(x, y, 1, 1);
    if (estagio >= 6 && (x + y) % 3 === 0) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 1, y, 1, 1); } // lasquinha clara na borda
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  if ('colorSpace' in t) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Rachaduras {
  constructor(cena) {
    this.cena = cena;
    this.mats = Array.from({ length: ESTAGIOS }, (_, i) => new THREE.MeshBasicMaterial({ map: textura(i), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.geo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
    this.lista = new Map(); // quem -> { m, x, y, z, est, t }
  }
  // quem: 'eu' ou o id do amigo; estagio 0..9
  mostrar(quem, x, y, z, estagio) {
    let r = this.lista.get(quem);
    if (!r) { r = { m: new THREE.Mesh(this.geo, this.mats[0]) }; r.m.renderOrder = 2; this.cena.add(r.m); this.lista.set(quem, r); }
    r.est = Math.max(0, Math.min(ESTAGIOS - 1, estagio | 0)); r.x = x; r.y = y; r.z = z; r.t = performance.now();
    r.m.material = this.mats[r.est];
    r.m.position.set(x + 0.5, y + 0.5, z + 0.5);
  }
  tirar(quem) { const r = this.lista.get(quem); if (!r) return; this.cena.remove(r.m); this.lista.delete(quem); }
  estagioDe(quem) { const r = this.lista.get(quem); return r ? r.est : -1; }
  // as dos amigos somem se pararem de chegar (soltou o botão) ou se o bloco mudou
  atualizar(bloco) {
    const agora = performance.now();
    for (const [q, r] of this.lista) if (q !== 'eu' && (agora - r.t > 900 || bloco(r.x, r.y, r.z) === 0)) this.tirar(q);
  }
  fechar() { for (const q of [...this.lista.keys()]) this.tirar(q); }
}

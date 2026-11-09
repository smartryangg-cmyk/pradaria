// Câmera do jogador: com os olhos (1ª pessoa), de trás (por cima do ombro) ou de frente.
// Na 3ª pessoa aparece o próprio boneco (o mesmo modelo que os amigos veem), animado.
// A câmera nunca atravessa paredes: se tiver bloco no caminho, ela chega mais perto.
import * as THREE from '../vendor/three.module.min.js';
import { montarBoneco, animarBoneco } from './modelos.js';
import { OLHOS } from './jogador.js';

export const MODOS = [
  { nome: 'olhos', texto: 'Vendo com os olhos', icone: 'camera' },
  { nome: 'atras', texto: 'Vendo o boneco de trás', icone: 'pessoa' },
  { nome: 'frente', texto: 'Vendo o boneco de frente', icone: 'pessoa' },
];
const DIST = 4; // distância da câmera até a cabeça
const OMBRO = 0.6, ACIMA = 0.3; // de trás: um pouco para a direita e para cima (a mira não fica atrás da cabeça)
const FOLGA = 0.3; // distância mínima da parede
const GOLPE = 0.3; // segundos de uma batida
// raios extras ao redor do centro, para a câmera não "raspar" numa parede do lado
const CANTOS = [[0, 0], [0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]];

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();

export class Visao {
  constructor(cena) {
    this.cena = cena;
    this.modo = 0;
    this.boneco = null;
    this.golpe = 1; this.ultGolpe = -1e9;
    this.dist = 0; // distância atual da câmera (0 na 1ª pessoa)
    this.olho = new THREE.Vector3();
    this.pivo = new THREE.Vector3();
    this.frente = new THREE.Vector3();
    this.tras = new THREE.Vector3();
    this.ombro = new THREE.Vector3();
  }

  get terceira() { return this.modo > 0; }
  // a mão bateu há pouco (vai junto com a posição para os amigos verem)
  get batendo() { return performance.now() - this.ultGolpe < GOLPE * 1000; }

  definir(m) {
    this.modo = ((m | 0) % MODOS.length + MODOS.length) % MODOS.length;
    this.dist = 0;
    document.body.classList.toggle('visao-frente', this.modo === 2);
    document.body.classList.toggle('visao-3p', this.modo > 0);
    return MODOS[this.modo];
  }
  alternar() { return this.definir(this.modo + 1); }

  bater() { this.golpe = 0; this.ultGolpe = performance.now(); }

  esconder() { if (this.boneco && this.boneco.grupo.parent) this.boneco.grupo.parent.remove(this.boneco.grupo); }

  // cria o boneco do jogador (skin = função que devolve o personagem; trocar de roupa usa vestirBoneco)
  meuBoneco(skin) {
    if (!this.boneco) this.boneco = montarBoneco(typeof skin === 'function' ? skin() : skin);
    return this.boneco;
  }

  // distância livre a partir de "de" na direção "dir" (testa o centro e 4 cantinhos ao redor)
  livre(mundo, de, dir, max) {
    let d = max;
    // eixos perpendiculares à direção, para os cantinhos
    const lado = v2.set(dir.z, 0, -dir.x);
    if (lado.lengthSq() < 1e-4) lado.set(1, 0, 0);
    lado.normalize();
    const cima = v3.crossVectors(lado, dir).normalize();
    for (const [a, b] of CANTOS) {
      v1.copy(de).addScaledVector(lado, a).addScaledVector(cima, b);
      const h = mundo.raycast(v1, dir, max);
      if (h) d = Math.min(d, h.t - FOLGA);
    }
    return Math.max(0, d);
  }

  // anima o boneco e posiciona a câmera. Devolve false na 1ª pessoa (a câmera fica nos olhos).
  quadro(dt, jog, camera, mundo, skin, dirigindo) {
    if (!this.terceira || dirigindo || !jog || !mundo) { this.esconder(); this.dist = 0; return false; }
    const b = this.meuBoneco(skin);
    if (b.grupo.parent !== this.cena) this.cena.add(b.grupo);
    const yaw = jog.yaw, pitch = jog.pitch;
    // boneco: a frente do modelo é +z; a câmera olha para -z, por isso o meio giro
    b.grupo.position.set(jog.pos.x, jog.yVisual ?? jog.pos.y, jog.pos.z);
    b.grupo.rotation.y = yaw + Math.PI;
    if (this.golpe < 1) this.golpe = Math.min(1, this.golpe + dt / GOLPE);
    const hv = Math.hypot(jog.vel.x, jog.vel.z);
    animarBoneco(b, {
      anda: jog.noChao || jog.naAgua ? Math.min(1, hv / 4.4) : 0,
      noAr: !jog.noChao && !jog.voando && !jog.naAgua,
      voando: jog.voando, nadando: jog.naAgua && !jog.noChao && !jog.voando,
      golpe: this.golpe, pitch,
    }, dt);

    const olho = this.olho.set(jog.pos.x, (jog.yVisual ?? jog.pos.y) + OLHOS, jog.pos.z);
    const cp = Math.cos(pitch);
    const frente = this.frente.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    let alvo;
    if (this.modo === 1) {
      // pivô por cima do ombro direito (sem entrar na parede)
      const dirD = this.ombro.set(Math.cos(yaw) * OMBRO, ACIMA, -Math.sin(yaw) * OMBRO);
      const lenD = dirD.length();
      dirD.divideScalar(lenD);
      const h = mundo.raycast(olho, dirD, lenD + FOLGA);
      const ok = h ? Math.max(0, h.t - FOLGA) : lenD;
      this.pivo.copy(olho).addScaledVector(dirD, ok);
      const tras = this.tras.copy(frente).negate();
      alvo = this.livre(mundo, this.pivo, tras, DIST);
      this.suavizar(alvo, dt);
      camera.position.copy(this.pivo).addScaledVector(tras, this.dist);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    } else {
      this.pivo.copy(olho);
      alvo = this.livre(mundo, olho, frente, DIST);
      this.suavizar(alvo, dt);
      camera.position.copy(olho).addScaledVector(frente, this.dist);
      camera.lookAt(olho);
    }
    // câmera muito perto (encostado na parede): some com o boneco para não tampar a tela
    b.grupo.visible = this.dist > 0.9;
    return true;
  }

  // chega perto na hora (parede), mas se afasta devagar (fica suave)
  suavizar(alvo, dt) {
    if (alvo < this.dist || this.dist === 0) this.dist = alvo;
    else this.dist += (alvo - this.dist) * Math.min(1, dt * 5);
  }

  // Ajusta o raio da mira para a 3ª pessoa. centro = mira do meio da tela (mouse);
  // senão é um toque na tela (o raio sai da câmera, passando pelo dedo).
  ajustarRaio(ray, centro, mundo) {
    if (!this.terceira || !this.boneco || !this.boneco.grupo.parent) return;
    if (centro) {
      if (this.modo === 1) ray.origin.copy(this.pivo); // mesma linha da tela, começando no ombro
      else { ray.origin.copy(this.olho); ray.direction.copy(this.frente); } // de frente: para onde o boneco olha
      return;
    }
    // toque: se não tem nada entre a câmera e o boneco, o alcance conta a partir do boneco
    const pula = Math.max(0, this.dist - 0.6);
    if (pula > 0 && mundo && !mundo.raycast(ray.origin, ray.direction, pula)) ray.origin.addScaledVector(ray.direction, pula);
  }
}

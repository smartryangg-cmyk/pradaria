// Clima e céu de cada era do mundo "Linha do Tempo", sem mexer no graficos.js.
//
// Como funciona: o graficos.js recalcula do zero, a cada quadro, as cores do céu (U.uZenite,
// U.uHorizonte), a cor do sol (U.uSolCor) e a luz ambiente (HemisphereLight). Este módulo roda
// LOGO DEPOIS e só "tinge" essas cores de leve, conforme a era (nada acumula de um quadro para o
// outro). Também ajusta a névoa (cor e distância) e cuida das partículas: neve na Era do Gelo,
// luzinhas na noite do Futuro e colunas de fumaça leve.
//
// Ligar no main.js:
//   import { criarClimaEras } from './clima-eras.js';
//   const clima = criarClimaEras(cena, graf);
//   clima.aplicar(mundo.era);                 // ao criar o mundo e sempre que a era mudar (null = mundo normal)
//   clima.atualizar(dt, jog.pos, camera);     // todo quadro, depois de graf.atualizar(...)
//
// Era null (mundo Pradaria normal): nada muda. Gráficos "Leve": só as cores; sem partículas.
import * as THREE from '../vendor/three.module.min.js';

const C = (h) => new THREE.Color(h);
const tmp = new THREE.Color();
const cinza = (c, t) => { const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11; c.lerp(tmp.setRGB(l, l, l), t); };

// ceu(U, k, hemi): k = 0..1 (força, sobe e desce nas trocas de era)
// nevoa: multiplica a distância da névoa (menor = névoa mais perto)
const CLIMAS = {
  // Dinossauros: céu morno e alaranjado, névoa morna
  0: {
    nevoa: 0.92,
    ceu(U, k, hemi) {
      const dia = 1 - U.uNoite.value, noite = U.uNoite.value;
      U.uZenite.value.lerp(C0.zen, 0.28 * k * dia);
      U.uHorizonte.value.lerp(C0.hor, 0.5 * k * dia).lerp(C0.horNoite, 0.25 * k * noite);
      U.uSolCor.value.lerp(C0.sol, 0.3 * k);
      hemi.color.lerp(C0.hemi, 0.2 * k);
    },
  },
  // Gelo: névoa branco-azulada mais perto, céu claro e frio, neve caindo
  1: {
    nevoa: 0.8, neve: true,
    ceu(U, k, hemi) {
      const dia = 1 - U.uNoite.value, noite = U.uNoite.value;
      U.uZenite.value.lerp(C1.zen, 0.3 * k * dia).lerp(C1.zenNoite, 0.2 * k * noite);
      U.uHorizonte.value.lerp(C1.hor, 0.55 * k * dia).lerp(C1.horNoite, 0.3 * k * noite);
      U.uSolCor.value.lerp(C1.sol, 0.25 * k);
      hemi.color.lerp(C1.hemi, 0.25 * k);
    },
  },
  // Industrial: céu um pouco acinzentado
  5: {
    nevoa: 0.9,
    ceu(U, k, hemi) {
      const dia = 1 - U.uNoite.value;
      cinza(U.uZenite.value, 0.42 * k);
      cinza(U.uHorizonte.value, 0.45 * k);
      U.uHorizonte.value.lerp(C5.fumaca, 0.18 * k * dia);
      cinza(hemi.color, 0.3 * k);
    },
  },
  // Futuro: pôr do sol lilás, noite arroxeada com luzinhas no ar
  7: {
    nevoa: 1, luzes: true,
    ceu(U, k, hemi) {
      const por = U.uPor.value, noite = U.uNoite.value, dia = 1 - noite;
      U.uZenite.value.lerp(C7.zen, (0.45 * por + 0.06 * dia) * k).lerp(C7.zenNoite, 0.4 * noite * k);
      U.uHorizonte.value.lerp(C7.hor, (0.65 * por + 0.08 * dia) * k).lerp(C7.horNoite, 0.4 * noite * k);
      U.uSolCor.value.lerp(C7.sol, 0.4 * por * k);
      hemi.color.lerp(C7.hemi, (0.15 + 0.2 * noite) * k);
    },
  },
};
const C0 = { zen: C(0x6c8ec0), hor: C(0xffb87a), horNoite: C(0x5a3a52), sol: C(0xffcf9a), hemi: C(0xffe0b8) };
const C1 = { zen: C(0x8ab2e2), zenNoite: C(0x1c2c54), hor: C(0xeef4fb), horNoite: C(0x5a7098), sol: C(0xe8f0ff), hemi: C(0xdfeaff) };
const C5 = { fumaca: C(0xb8b2aa) };
const C7 = { zen: C(0x6a4cc0), zenNoite: C(0x241848), hor: C(0xe08cf0), horNoite: C(0x4a3478), sol: C(0xff9ad8), hemi: C(0xd8c4ff) };

// ---------- partículas (tudo anda na placa de vídeo: o processador não mexe em nada por quadro) ----------
const N_NEVE = 400, N_LUZES = 70;
const CAIXA_NEVE = new THREE.Vector3(24, 16, 24), CAIXA_LUZES = new THREE.Vector3(20, 5, 20);

// pontos espalhados numa caixa que acompanha a câmera (dá a volta nas bordas, sem "pular")
function criarPontos(n, caixa, extra, vertice, fragmento, aditivo) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3), fase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = Math.random() * caixa.x; pos[i * 3 + 1] = Math.random() * caixa.y; pos[i * 3 + 2] = Math.random() * caixa.z;
    fase[i] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
  if (extra) extra(g, n);
  const uniforms = {
    uTempo: { value: 0 }, uOpac: { value: 0 }, uAltura: { value: 600 }, uNoite: { value: 0 },
    uCentro: { value: new THREE.Vector3() }, uCaixa: { value: caixa.clone() },
  };
  const m = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, fog: false,
    blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `
      uniform float uTempo, uAltura, uOpac;
      uniform vec3 uCentro, uCaixa;
      attribute float fase;
      varying float vA;
      ${vertice}`,
    fragmentShader: `
      uniform float uNoite;
      varying float vA;
      ${fragmento}`,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 5;
  p.visible = false;
  const tam = new THREE.Vector2();
  p.onBeforeRender = (renderer) => { renderer.getDrawingBufferSize(tam); uniforms.uAltura.value = tam.y; };
  return p;
}

const DAR_VOLTA = 'p = mod(p - uCentro + uCaixa * 0.5, uCaixa) + uCentro - uCaixa * 0.5;';

function criarNeve() {
  return criarPontos(N_NEVE, CAIXA_NEVE, null, `
    void main() {
      vec3 p = position;
      p.y -= uTempo * (0.8 + fase * 0.7);
      p.x += sin(uTempo * 0.9 + fase * 6.283) * 0.45;
      p.z += cos(uTempo * 0.7 + fase * 12.0) * 0.45;
      ${DAR_VOLTA}
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float d = max(-mv.z, 0.2);
      gl_PointSize = 0.2 * (0.7 + fase * 0.6) * uAltura * projectionMatrix[1][1] * 0.5 / d;
      vA = uOpac * (1.0 - smoothstep(7.0, 11.5, length((p - uCentro).xz))) * smoothstep(0.3, 1.2, d);
    }`, `
    void main() {
      float a = (1.0 - smoothstep(0.18, 0.5, length(gl_PointCoord - 0.5))) * vA;
      if (a < 0.02) discard;
      gl_FragColor = vec4(mix(vec3(1.0), vec3(0.72, 0.8, 1.0), uNoite * 0.6), a * 0.9);
    }`, false);
}

function criarLuzes() {
  const cores = [[0.45, 1, 0.95], [0.85, 0.6, 1], [1, 0.95, 0.5], [0.55, 0.8, 1]];
  return criarPontos(N_LUZES, CAIXA_LUZES, (g, n) => {
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set(cores[i % cores.length], i * 3);
    g.setAttribute('cor', new THREE.BufferAttribute(c, 3));
  }, `
    attribute vec3 cor;
    varying vec3 vCor;
    void main() {
      vCor = cor;
      vec3 p = position;
      float t = uTempo * 0.3 + fase * 30.0;
      p += vec3(sin(t * 1.3) * 1.4, sin(t * 0.9 + 1.7) * 0.6, cos(t * 1.1) * 1.4);
      ${DAR_VOLTA}
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float d = max(-mv.z, 0.3);
      float pisca = 0.5 + 0.5 * sin(uTempo * (1.2 + fase * 1.5) + fase * 40.0);
      gl_PointSize = 0.5 * uAltura * projectionMatrix[1][1] * 0.5 / d;
      vA = uOpac * smoothstep(0.0, 0.5, pisca) * (1.0 - smoothstep(6.0, 9.8, length((p - uCentro).xz)));
    }`, `
    varying vec3 vCor;
    void main() {
      float r = length(gl_PointCoord - 0.5);
      float halo = 1.0 - smoothstep(0.0, 0.5, r);
      float miolo = 1.0 - smoothstep(0.05, 0.16, r);
      float a = (halo * halo * 0.7 + miolo) * vA;
      if (a < 0.01) discard;
      gl_FragColor = vec4(mix(vCor, vec3(1.0), miolo * 0.7) * a, a);
    }`, true);
}

// textura redondinha e macia (para a fumaça)
function texturaFumaca() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function criarClimaEras(cena, graf) {
  const U = graf.U;
  const hemi = cena.children.find((o) => o.isHemisphereLight) || new THREE.HemisphereLight();
  let atual = null; // era cujo clima está na tela
  let alvo = null; // era pedida
  let k = 0; // força do clima atual (0..1)
  const leve = () => { const q = graf.q || {}; return !q.vento && !q.ondas && !q.sombra; };

  let neve = null, luzes = null, texFumaca = null;
  const colunas = []; // fumaças

  // névoa: guarda a distância "de verdade" (a que o main.js pôs) e aplica o fator da era
  let baseNear = null, baseFar = null, ultNear = null, ultFar = null;
  function ajustarNevoa(f) {
    const fog = cena.fog;
    if (!fog) return;
    if (baseNear === null || fog.near !== ultNear || fog.far !== ultFar) { baseNear = fog.near; baseFar = fog.far; }
    fog.near = baseNear * f; fog.far = baseFar * f;
    ultNear = fog.near; ultFar = fog.far;
    fog.color.copy(U.uHorizonte.value);
    graf.ajustarNevoa(fog.near, fog.far, U.uHorizonte.value);
  }

  function prepararParticulas(cfg) {
    if (cfg.neve && !neve) { neve = criarNeve(); cena.add(neve); }
    if (cfg.luzes && !luzes) { luzes = criarLuzes(); cena.add(luzes); }
  }

  function aplicar(era) {
    alvo = era === undefined ? null : era;
    if (alvo !== null && atual === null && k === 0) atual = alvo; // primeira vez: entra direto (subindo de 0)
    if (alvo !== 0) limparFumaca();
  }

  function atualizarPontos(p, ligado, opac, centro) {
    if (!p) return;
    p.visible = ligado && opac > 0.01;
    if (!p.visible) return;
    const u = p.material.uniforms;
    u.uTempo.value = U.uTempo.value;
    u.uOpac.value = opac;
    u.uNoite.value = U.uNoite.value;
    u.uCentro.value.copy(centro);
  }

  const centro = new THREE.Vector3();
  function atualizar(dt, jogPos, camera) {
    // troca de era: o clima antigo some devagar e o novo aparece
    if (alvo !== atual) {
      k = Math.max(0, k - dt / 1.2);
      if (k === 0) atual = alvo;
    } else if (atual !== null) k = Math.min(1, k + dt / 1.8);
    if (atual === null && k === 0) {
      if (baseNear !== null && cena.fog) { // devolve a névoa do jeito que estava
        if (cena.fog.near === ultNear && cena.fog.far === ultFar) { cena.fog.near = baseNear; cena.fog.far = baseFar; graf.ajustarNevoa(baseNear, baseFar); }
        baseNear = null;
      }
      if (neve) neve.visible = false;
      if (luzes) luzes.visible = false;
      atualizarFumaca(dt);
      return;
    }
    const cfg = CLIMAS[atual] || {};
    if (cfg.ceu) cfg.ceu(U, k, hemi);
    ajustarNevoa(1 + ((cfg.nevoa || 1) - 1) * k);

    const semParticulas = leve();
    if (!semParticulas) prepararParticulas(cfg);
    const cam = camera ? camera.position : jogPos;
    atualizarPontos(neve, !!cfg.neve && !semParticulas, k, cam);
    const noite = THREE.MathUtils.smoothstep(U.uNoite.value, 0.35, 0.8);
    centro.set(jogPos.x, jogPos.y + 1.6, jogPos.z);
    atualizarPontos(luzes, !!cfg.luzes && !semParticulas, k * noite, centro);
    atualizarFumaca(dt);
  }

  // ---------- fumaça: uma coluna de "nuvenzinhas" que sobem, crescem e somem ----------
  function fumaca(x, y, z, o = {}) {
    if (!texFumaca) texFumaca = texturaFumaca();
    const n = leve() ? 6 : o.n || 12;
    const grupo = new THREE.Group();
    grupo.position.set(x, y, z);
    const sprites = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: texFumaca, color: 0x9a948e, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(m);
      s.userData.fase = i / n;
      s.userData.lado = Math.random() * Math.PI * 2;
      grupo.add(s); sprites.push(s);
    }
    cena.add(grupo);
    const col = { grupo, sprites, altura: o.altura || 16, vel: o.vel || 0.08, largura: o.largura || 1, remover() { removerColuna(col); } };
    colunas.push(col);
    return col;
  }
  function removerColuna(col) {
    const i = colunas.indexOf(col);
    if (i < 0) return;
    colunas.splice(i, 1);
    cena.remove(col.grupo);
    for (const s of col.sprites) s.material.dispose();
  }
  function limparFumaca() { while (colunas.length) removerColuna(colunas[0]); }
  let tempoFumaca = 0;
  function atualizarFumaca(dt) {
    if (!colunas.length) return;
    tempoFumaca += dt;
    const noite = U.uNoite.value;
    tmp.setRGB(0.26, 0.25, 0.24).multiplyScalar(1 - noite * 0.5);
    for (const col of colunas) {
      for (const s of col.sprites) {
        const t = (tempoFumaca * col.vel + s.userData.fase) % 1;
        const l = s.userData.lado;
        s.position.set(Math.cos(l) * t * 1.2 + t * t * 3, t * col.altura, Math.sin(l) * t * 1.2);
        const esc = (1.6 + t * 6) * col.largura;
        s.scale.set(esc, esc, 1);
        s.material.opacity = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.85;
        s.material.color.copy(tmp);
      }
    }
  }

  function descartar() {
    limparFumaca();
    for (const p of [neve, luzes]) if (p) { cena.remove(p); p.geometry.dispose(); p.material.dispose(); }
    neve = luzes = null;
    if (texFumaca) texFumaca.dispose();
  }

  return { aplicar, atualizar, fumaca, limparFumaca, descartar, get era() { return alvo; } };
}

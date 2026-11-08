// Visual "com shaders": céu de verdade, sol que faz sombra, água que brilha, folhas que balançam,
// lampiões que acendem de noite. Tudo em três níveis de qualidade para rodar até em tablet fraco.
import * as THREE from '../vendor/three.module.min.js';

// sombra: tamanho do mapa de sombra · area: metros cobertos · luzes: lampiões acesos · pular: quadros entre atualizações da sombra
// vento: folhas balançando · ondas: água com ondinhas e reflexo · nuvens · vinheta · fov: campo de visão
// brilho: exposição · teto: milhões de pixels no máximo · fpsMax: 0 = sem limite
export const QUALIDADES = {
  baixa: { nome: 'Leve', sombra: 0, area: 0, luzes: 0, pular: 0, vento: false, ondas: false, nuvens: true, vinheta: false, teto: 0.8 },
  media: { nome: 'Bonita', sombra: 1024, area: 30, luzes: 2, pular: 1, vento: true, ondas: true, nuvens: true, vinheta: true, teto: 1.3 },
  alta: { nome: 'Linda', sombra: 2048, area: 44, luzes: 4, pular: 0, vento: true, ondas: true, nuvens: true, vinheta: true, teto: 2.4 },
  ultra: { nome: 'Ultra', sombra: 4096, area: 64, luzes: 4, pular: 0, vento: true, ondas: true, nuvens: true, vinheta: true, teto: 4 },
};
// opções que não mudam com o preset (preferência pessoal)
export const PESSOAIS = { fov: 72, brilho: 1, fpsMax: 0 };

// distância do "sol" até o centro da sombra e altura mínima da luz que faz sombra (seno do ângulo)
const DIST_SOL = 90, ELEV_MIN = 0.5;
const tmp = new THREE.Color(), tmp2 = new THREE.Color();
const C = (h) => new THREE.Color(h);
// cores do céu ao longo do dia: [zênite, horizonte]
const CEU = {
  dia: [C(0x2a78dc), C(0x9fd2ff)],
  por: [C(0x4a5fa8), C(0xffa463)],
  noite: [C(0x0d1838), C(0x2a3d6e)],
};

// Sombra some aos poucos perto da borda da área coberta, em vez de acabar numa linha reta no chão.
{
  const k = 'shadowmap_pars_fragment', ch = THREE.ShaderChunk[k];
  const ant = '\t\t}\n\t\treturn shadow;\n\t}\n\tvec2 cubeToUV';
  if (ch.includes(ant)) {
    THREE.ShaderChunk[k] = ch.replace(ant, '\t\t}\n\t\tvec2 bordaS = abs( shadowCoord.xy * 2.0 - 1.0 );\n\t\treturn mix( shadow, 1.0, smoothstep( 0.75, 1.0, max( bordaS.x, bordaS.y ) ) );\n\t}\n\tvec2 cubeToUV');
  }
}

export function criarGraficos(renderer, cena, camera, atlas) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const U = {
    uTempo: { value: 0 },
    uSolDir: { value: new THREE.Vector3(0, 1, 0) },
    uSolCor: { value: new THREE.Color(1, 1, 1) },
    uZenite: { value: new THREE.Color() },
    uHorizonte: { value: new THREE.Color() },
    uNoite: { value: 0 },
    uPor: { value: 0 },
    uVento: { value: 1 },
    uOndas: { value: 1 },
  };
  let brilhoUsuario = 1;

  // ---------- blocos: luz de verdade + folhas balançando + lampião aceso ----------
  const matBlocos = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5 });
  matBlocos.onBeforeCompile = (sh) => {
    sh.uniforms.uTempo = U.uTempo;
    sh.uniforms.uNoite = U.uNoite;
    sh.uniforms.uVento = U.uVento;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float onda;\nattribute float brilho;\nuniform float uTempo;\nuniform float uVento;\nvarying float vBrilho;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBrilho = brilho;
        if (onda * uVento > 0.0) {
          vec4 wpO = modelMatrix * vec4(transformed, 1.0);
          float fase = uTempo * 1.6 + wpO.x * 0.55 + wpO.z * 0.4;
          transformed.x += sin(fase) * 0.07 * onda;
          transformed.z += cos(fase * 0.8 + wpO.y) * 0.05 * onda;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNoite;\nvarying float vBrilho;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vBrilho * (0.6 + uNoite * 1.6);');
  };

  // ---------- água: reflexo do céu, brilho do sol, ondinhas ----------
  const matAgua = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      ...U,
      uNevoaCor: { value: new THREE.Color() }, uNevoaPerto: { value: 30 }, uNevoaLonge: { value: 60 },
    },
    vertexShader: `
      uniform float uTempo;
      attribute vec3 fluxo;
      varying vec3 vMundo;
      varying vec3 vFluxo;
      void main() {
        vFluxo = fluxo;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        if (fract(position.y) > 0.5) wp.y += sin(uTempo * 1.4 + wp.x * 0.8 + wp.z * 0.6) * 0.04;
        vMundo = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTempo, uNoite, uPor, uNevoaPerto, uNevoaLonge, uOndas;
      uniform vec3 uSolDir, uSolCor, uZenite, uHorizonte, uNevoaCor;
      varying vec3 vMundo;
      varying vec3 vFluxo;
      void main() {
        float t = uTempo;
        // água corrente: as ondinhas andam na direção em que ela corre
        float corre = clamp(length(vFluxo.xy) * 1.5, 0.0, 1.0);
        vec2 p = vMundo.xz - vFluxo.xy * t * 1.6;
        // cachoeira: listras descendo
        if (vFluxo.z > 0.5) p = vec2((vMundo.x + vMundo.z) * 1.3, vMundo.y * 0.5 + t * 3.0);
        // soma de ondinhas → normal
        vec2 d = vec2(0.0);
        d += vec2(cos(p.x * 0.9 + t * 1.3), cos(p.y * 0.7 + t * 1.1)) * 0.10;
        d += vec2(cos(p.x * 2.3 - p.y * 1.7 + t * 2.1), cos(p.y * 2.1 + p.x * 1.3 - t * 1.7)) * 0.05;
        d += vec2(cos((p.x + p.y) * 4.7 + t * 3.0), cos((p.x - p.y) * 5.1 - t * 2.6)) * 0.025;
        vec3 n = normalize(vec3(d.x * uOndas, 1.0, d.y * uOndas));
        vec3 v = normalize(cameraPosition - vMundo);
        if (v.y < 0.0) n.y = -n.y;
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 r = reflect(-v, n);
        vec3 ceu = mix(uHorizonte, uZenite, clamp(r.y * 1.6, 0.0, 1.0));
        vec3 funda = mix(vec3(0.05, 0.28, 0.45), vec3(0.02, 0.06, 0.14), uNoite);
        vec3 cor = mix(funda, ceu, 0.25 + fres * 0.7);
        float brilho = pow(max(dot(r, uSolDir), 0.0), 120.0) * 2.5 + pow(max(dot(r, uSolDir), 0.0), 12.0) * 0.15;
        cor += uSolCor * brilho;
        // espuminha onde a água corre ou cai
        float espuma = max(corre * 0.5, vFluxo.z) * (0.5 + 0.5 * sin(p.x * 6.0 + p.y * 3.0 + t * 4.0));
        cor = mix(cor, vec3(0.85, 0.93, 1.0) * (1.0 - uNoite * 0.6), espuma * 0.28);
        float a = mix(0.74, 0.95, fres);
        a = mix(a, 0.9, vFluxo.z * 0.5);
        float dist = length(cameraPosition - vMundo);
        float nev = smoothstep(uNevoaPerto, uNevoaLonge, dist);
        cor = mix(cor, uNevoaCor, nev);
        gl_FragColor = vec4(cor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  // ---------- céu: degradê, sol com brilho, lua, estrelas ----------
  const ceu = new THREE.Mesh(
    new THREE.SphereGeometry(320, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: U,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: `
        uniform vec3 uSolDir, uSolCor, uZenite, uHorizonte;
        uniform float uNoite, uPor, uTempo;
        varying vec3 vDir;
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 cor = mix(uHorizonte, uZenite, pow(clamp(h, 0.0, 1.0), 0.55));
          cor = mix(cor, uHorizonte * 0.8, clamp(-h * 3.0, 0.0, 1.0));
          float s = max(dot(d, uSolDir), 0.0);
          // brilho em volta do sol (maior no nascer/pôr)
          cor += uSolCor * (pow(s, 6.0) * (0.12 + uPor * 0.5) + pow(s, 60.0) * 0.35) * (1.0 - uNoite);
          // disco do sol
          cor = mix(cor, vec3(1.0, 0.97, 0.85) * 1.6, smoothstep(0.9975, 0.9985, s) * (1.0 - uNoite));
          // lua (oposta ao sol)
          float l = max(dot(d, -uSolDir), 0.0);
          cor = mix(cor, vec3(0.92, 0.95, 1.0), smoothstep(0.9988, 0.9993, l) * uNoite);
          cor += vec3(0.5, 0.6, 0.9) * pow(l, 40.0) * 0.15 * uNoite;
          // estrelas
          if (uNoite > 0.01 && h > 0.0) {
            vec2 g = floor(vec2(atan(d.z, d.x) * 120.0, h * 160.0));
            float e = step(0.993, h21(g)) * (0.6 + 0.4 * sin(uTempo * 2.0 + h21(g + 3.1) * 40.0));
            cor += vec3(e) * uNoite * smoothstep(0.0, 0.25, h);
          }
          gl_FragColor = vec4(cor, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  ceu.renderOrder = -10;
  ceu.frustumCulled = false;
  cena.add(ceu);

  // ---------- luzes ----------
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6b5a3f, 1.0);
  const sol = new THREE.DirectionalLight(0xffffff, 2.5);
  // bias pequeno (a câmera da sombra é curta, ver DIST_SOL) e normalBias do tamanho de um pixel da sombra:
  // a sombra encosta no pé do bloco sem "manchas" nas faces
  sol.shadow.bias = -0.00015;
  sol.shadow.normalBias = 0.05;
  cena.add(hemi, sol, sol.target);
  const lampioes = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.PointLight(0xffb45e, 0, 9, 1.6);
    lampioes.push(l); cena.add(l);
  }

  let q = QUALIDADES.media, pulos = 0;
  // o: objeto com as opções (de um preset ou personalizadas)
  function aplicar(o) {
    const antes = q;
    q = { ...QUALIDADES.media, ...o };
    U.uVento.value = q.vento ? 1 : 0;
    U.uOndas.value = q.ondas ? 1 : 0;
    brilhoUsuario = q.brilho || 1;
    // só recompila os materiais quando muda algo que exige (sombra, nº de lampiões)
    if (antes && antes !== QUALIDADES.media && antes.sombra === q.sombra && antes.area === q.area && antes.luzes === q.luzes) return q;
    const comSombra = q.sombra > 0;
    renderer.shadowMap.enabled = comSombra;
    renderer.shadowMap.autoUpdate = false;
    sol.castShadow = comSombra;
    if (comSombra) {
      sol.shadow.mapSize.set(q.sombra, q.sombra);
      if (sol.shadow.map) { sol.shadow.map.dispose(); sol.shadow.map = null; }
      const c = sol.shadow.camera;
      c.left = c.bottom = -q.area; c.right = c.top = q.area;
      c.near = 1; c.far = DIST_SOL + q.area * 2.5;
      c.updateProjectionMatrix();
      sol.shadow.normalBias = Math.max(0.03, (2 * q.area / q.sombra) * 1.2);
    }
    lampioes.forEach((l, i) => { l.visible = i < q.luzes; });
    // força recompilar os materiais (sombra liga/desliga, nº de luzes)
    cena.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    matBlocos.needsUpdate = true;
    return q;
  }

  const solDir = new THREE.Vector3();
  const alvo = new THREE.Vector3();
  const luzDir = new THREE.Vector3(), centro = new THREE.Vector3(), olhar = new THREE.Vector3();
  const rotLuz = new THREE.Matrix4(), ZERO = new THREE.Vector3(), CIMA = new THREE.Vector3(0, 1, 0);
  const eixoX = new THREE.Vector3(), eixoY = new THREE.Vector3();
  let tempoLuzes = 0;

  // tempoDia: 0..1 (0.25 = meio-dia). Retorna a cor da névoa/horizonte.
  function atualizar(dt, tempoDia, foco, mundo) {
    U.uTempo.value += dt;
    const ang = tempoDia * Math.PI * 2;
    const s = Math.sin(ang);
    solDir.set(Math.cos(ang), s, 0.35).normalize();
    U.uSolDir.value.copy(solDir);
    const dia = THREE.MathUtils.smoothstep(s, -0.25, 0.2);
    const por = Math.max(0, 1 - Math.abs(s) * 3.5);
    const noite = 1 - dia;
    U.uNoite.value = noite; U.uPor.value = por;

    // céu
    U.uZenite.value.copy(CEU.noite[0]).lerp(CEU.dia[0], dia).lerp(CEU.por[0], por * 0.5);
    U.uHorizonte.value.copy(CEU.noite[1]).lerp(CEU.dia[1], dia).lerp(CEU.por[1], por * 0.75);
    U.uSolCor.value.setRGB(1, 0.95, 0.85).lerp(tmp.setRGB(1, 0.55, 0.25), por);

    // sol durante o dia, lua à noite (a noite é clarinha: sem medo!)
    const fonte = s > -0.05 ? solDir : alvo.copy(solDir).negate();
    sol.color.copy(U.uSolCor.value).lerp(tmp2.setRGB(0.55, 0.65, 1), noite);
    sol.intensity = s > -0.05 ? 0.4 + 2.4 * THREE.MathUtils.smoothstep(s, -0.05, 0.35) : 0.5 * noite;
    hemi.color.copy(U.uZenite.value).lerp(tmp.setRGB(1, 1, 1), 0.3 + dia * 0.25);
    hemi.groundColor.setRGB(0.42, 0.36, 0.28).multiplyScalar(0.5 + dia * 0.5);
    hemi.intensity = 0.55 + dia * 0.4;
    renderer.toneMappingExposure = (0.95 + noite * 0.2) * brilhoUsuario;

    // a luz que faz sombra nunca fica rasante: com o sol quase no horizonte cada degrau do morro
    // jogava uma faixa escura comprida no chão. O disco do sol no céu continua no lugar certo.
    luzDir.copy(fonte);
    if (luzDir.y < ELEV_MIN) {
      const h = Math.hypot(luzDir.x, luzDir.z) || 1, k = Math.sqrt(1 - ELEV_MIN * ELEV_MIN) / h;
      luzDir.set(luzDir.x * k, ELEV_MIN, luzDir.z * k);
    }
    // a área da sombra fica um pouco à frente do jogador (onde ele está olhando)
    const R = q.area || 30;
    camera.getWorldDirection(olhar); olhar.y = 0;
    if (olhar.lengthSq() > 1e-6) olhar.normalize();
    centro.copy(foco).addScaledVector(olhar, R * 0.4);
    if (q.sombra) {
      // "grudada" nos pixels do mapa de sombra, medidos na direção da luz: a borda da sombra não treme ao andar
      const passo = (2 * R) / q.sombra;
      rotLuz.lookAt(luzDir, ZERO, CIMA);
      eixoX.setFromMatrixColumn(rotLuz, 0); eixoY.setFromMatrixColumn(rotLuz, 1);
      const ax = centro.dot(eixoX), ay = centro.dot(eixoY);
      centro.addScaledVector(eixoX, Math.round(ax / passo) * passo - ax).addScaledVector(eixoY, Math.round(ay / passo) * passo - ay);
    }
    sol.target.position.copy(centro);
    sol.position.copy(centro).addScaledVector(luzDir, DIST_SOL);
    sol.target.updateMatrixWorld();
    if (q.sombra && pulos++ >= (q.pular || 0)) { pulos = 0; renderer.shadowMap.needsUpdate = true; }

    ceu.position.copy(camera.position);

    // lampiões perto acendem de noite
    tempoLuzes -= dt;
    if (q.luzes && mundo && tempoLuzes <= 0) {
      tempoLuzes = 0.5;
      const perto = [];
      for (const c of mundo.chunks.values()) {
        if (!c.luzes || !c.temMalha) continue;
        for (const p of c.luzes) perto.push([(p[0] - foco.x) ** 2 + (p[1] - foco.y) ** 2 + (p[2] - foco.z) ** 2, p]);
      }
      perto.sort((a, b) => a[0] - b[0]);
      lampioes.forEach((l, i) => {
        const p = i < q.luzes && perto[i];
        l.userData.ligada = !!(p && p[0] < 30 * 30);
        if (p) l.position.set(p[1][0], p[1][1], p[1][2]);
      });
    }
    for (const l of lampioes) l.intensity = l.userData.ligada ? 1.5 + noite * 5 : 0;

    return U.uHorizonte.value;
  }

  function ajustarNevoa(perto, longe, cor) {
    matAgua.uniforms.uNevoaPerto.value = perto;
    matAgua.uniforms.uNevoaLonge.value = longe;
    if (cor) matAgua.uniforms.uNevoaCor.value.copy(cor);
  }

  return { matBlocos, matAgua, atualizar, aplicar, ajustarNevoa, U, get q() { return q; } };
}

// Visual "com shaders": céu de verdade, sol que faz sombra, água que brilha, folhas que balançam,
// lampiões que acendem de noite. Tudo em três níveis de qualidade para rodar até em tablet fraco.
import * as THREE from '../vendor/three.module.min.js';

// sombra: tamanho do mapa de sombra · area: metros cobertos · luzes: lampiões acesos · pular: quadros entre atualizações da sombra
// vento: folhas balançando · ondas: água com ondinhas e reflexo · nuvens · vinheta · fov: campo de visão
// brilho: exposição · teto: milhões de pixels no máximo · fpsMax: 0 = sem limite
// pos: efeitos de cinema (posefeitos.js) · nativo: resolução nativa da tela, sem teto · visao: distância de visão mínima
export const QUALIDADES = {
  baixa: { nome: 'Leve', sombra: 0, area: 0, luzes: 0, pular: 0, vento: false, ondas: false, nuvens: true, vinheta: false, teto: 0.8, pos: false },
  media: { nome: 'Bonita', sombra: 1024, area: 30, luzes: 2, pular: 1, vento: true, ondas: true, nuvens: true, vinheta: true, teto: 1.3, pos: false },
  alta: { nome: 'Linda', sombra: 2048, area: 44, luzes: 4, pular: 0, vento: true, ondas: true, nuvens: true, vinheta: true, teto: 2.4, pos: false },
  ultra: { nome: 'Ultra', sombra: 4096, area: 64, luzes: 4, pular: 0, vento: true, ondas: true, nuvens: true, vinheta: true, teto: 4, pos: true, nativo: true, visao: 8 },
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

// ---------- gradação de cor + névoa que casa com o céu (vale para todos os materiais) ----------
// O three aplica a névoa DEPOIS do tone mapping, então o chão longe sumia numa cor diferente do céu.
// A cor da névoa agora é calculada no JS já "como aparece na tela" (mesmo tone mapping + gradação do céu),
// sem nenhuma conta extra por pixel. Nos blocos (FOG_SOL) a névoa fica dourada na direção do sol.
const SATURACAO = 1.12;
let chunksProntos = false;
function prepararChunks() {
  if (chunksProntos) return;
  chunksProntos = true;
  const SC = THREE.ShaderChunk;
  SC.tonemapping_fragment = `#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
	gl_FragColor.rgb = max( mix( vec3( dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ) ), gl_FragColor.rgb, ${SATURACAO.toFixed(2)} ), 0.0 );
#endif`;
  SC.fog_pars_vertex += '\n#if defined( USE_FOG ) && defined( FOG_SOL )\nvarying vec3 vFogVista;\n#endif';
  SC.fog_vertex += '\n#if defined( USE_FOG ) && defined( FOG_SOL )\nvFogVista = mvPosition.xyz;\n#endif';
  SC.fog_pars_fragment += `
#if defined( USE_FOG ) && defined( FOG_SOL )
varying vec3 vFogVista;
uniform vec3 uFogSolVista, uFogSolCor;
uniform float uFogPor;
#endif`;
  SC.fog_fragment = SC.fog_fragment.replace('gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );', `vec3 corNevoa = fogColor;
	#ifdef FOG_SOL
		float sNev = max( dot( normalize( vFogVista ), uFogSolVista ), 0.0 );
		corNevoa += uFogSolCor * ( pow( sNev, 6.0 ) * uFogPor + pow( sNev, 60.0 ) * 0.35 );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, corNevoa, fogFactor );`);
}
// a mesma conta do ACESFilmicToneMapping do three (r160) + a gradação acima, no JS
function telaLinear(c, exp, out) {
  let r = c.r * exp / 0.6, g = c.g * exp / 0.6, b = c.b * exp / 0.6;
  const ir = 0.59719 * r + 0.35458 * g + 0.04823 * b;
  const ig = 0.07600 * r + 0.90834 * g + 0.01566 * b;
  const ib = 0.02840 * r + 0.13383 * g + 0.83777 * b;
  const f = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081);
  const fr = f(ir), fg = f(ig), fb = f(ib);
  r = Math.min(1, Math.max(0, 1.60475 * fr - 0.53108 * fg - 0.07367 * fb));
  g = Math.min(1, Math.max(0, -0.10208 * fr + 1.10813 * fg - 0.00605 * fb));
  b = Math.min(1, Math.max(0, -0.00327 * fr - 0.07276 * fg + 1.07602 * fb));
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return out.setRGB(Math.max(0, l + (r - l) * SATURACAO), Math.max(0, l + (g - l) * SATURACAO), Math.max(0, l + (b - l) * SATURACAO));
}
// liga/desliga um #define de material (recompila só quando muda)
function ligarDefine(m, nome, ligado) {
  if (ligado === (nome in m.defines)) return;
  if (ligado) m.defines[nome] = ''; else delete m.defines[nome];
  m.needsUpdate = true;
}
const sRGB = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
// Sombra some aos poucos perto da borda da área coberta, em vez de acabar numa linha reta no chão.
{
  const k = 'shadowmap_pars_fragment', ch = THREE.ShaderChunk[k];
  const ant = '\t\t}\n\t\treturn shadow;\n\t}\n\tvec2 cubeToUV';
  if (ch.includes(ant)) {
    THREE.ShaderChunk[k] = ch.replace(ant, '\t\t}\n\t\tvec2 bordaS = abs( shadowCoord.xy * 2.0 - 1.0 );\n\t\treturn mix( shadow, 1.0, smoothstep( 0.75, 1.0, max( bordaS.x, bordaS.y ) ) );\n\t}\n\tvec2 cubeToUV');
  }
}

export function criarGraficos(renderer, cena, camera, atlas) {
  prepararChunks();
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

  // névoa dourada na direção do sol só nos blocos (chunks globais acima) +
  // arestas "arredondadas" falsas: perto das bordas expostas a cor escurece de leve e (Bonita/Linda)
  // a normal entorta para fora, então o sol pega na aresta como se ela fosse redonda. Sem geometria extra.
  const UF = { uFogSolVista: { value: new THREE.Vector3(0, 1, 0) }, uFogSolCor: { value: new THREE.Color(0, 0, 0) }, uFogPor: { value: 0.12 } };
  matBlocos.defines = { ...(matBlocos.defines || {}), FOG_SOL: '', BORDA: '' };
  {
    const compilarBase = matBlocos.onBeforeCompile;
    matBlocos.onBeforeCompile = (sh, r) => {
      compilarBase(sh, r);
      Object.assign(sh.uniforms, UF);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float borda;\nvarying float vBorda;\nvarying vec3 vLocal;\nvarying vec3 vNLocal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBorda = borda; vLocal = position; vNLocal = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
varying float vBorda;
varying vec3 vLocal;
varying vec3 vNLocal;
vec3 gDirBorda = vec3(0.0);`)
        .replace('#include <color_fragment>', `#include <color_fragment>
#ifdef BORDA
  if (vBorda > 0.5) {
    vec3 an = abs(vNLocal);
    vec2 q; vec3 e1, e2;
    if (an.x > 0.5) { q = vLocal.yz; e1 = vec3(0.0, 1.0, 0.0); e2 = vec3(0.0, 0.0, 1.0); }
    else if (an.y > 0.5) { q = vLocal.xz; e1 = vec3(1.0, 0.0, 0.0); e2 = vec3(0.0, 0.0, 1.0); }
    else { q = vLocal.xy; e1 = vec3(1.0, 0.0, 0.0); e2 = vec3(0.0, 1.0, 0.0); }
    q = fract(q);
    float m = floor(vBorda - 0.5); // arredonda: o valor interpolado pode vir 0.99999
    vec4 bits = mod(floor(vec4(m, m * 0.5, m * 0.25, m * 0.125) + 0.01), 2.0);
    vec4 w = bits * (1.0 - smoothstep(vec4(0.0), vec4(0.1), vec4(q.x, 1.0 - q.x, q.y, 1.0 - q.y)));
    gDirBorda = e1 * (w.y - w.x) + e2 * (w.w - w.z);
    float wb = max(max(w.x, w.y), max(w.z, w.w));
    diffuseColor.rgb *= (1.0 - 0.14 * wb * wb) * (1.0 + 0.16 * max(gDirBorda.y, 0.0));
  }
#endif`)
        .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
#ifdef BORDA_LUZ
  normal = normalize(normal + (viewMatrix * vec4(gDirBorda, 0.0)).xyz * 0.85);
#endif`);
    };
  }
  // cor da névoa "como aparece na tela", aplicada logo antes de desenhar (já com a exposição final)
  const nev = { h: new THREE.Color(), sol: new THREE.Color(), gmax: 0.47, dir: new THREE.Vector3() };
  const cA = new THREE.Color(), cB = new THREE.Color();
  cena.onBeforeRender = (rend, sc, cam) => {
    if (!sc.fog) return;
    const exp = rend.toneMappingExposure;
    telaLinear(nev.h, exp, sc.fog.color);
    // brilho do sol na névoa: diferença (em sRGB, como o shader mistura) entre horizonte e horizonte+sol
    telaLinear(cA.copy(nev.h).add(cB.copy(nev.sol).multiplyScalar(nev.gmax)), exp, cA);
    const g = 1 / nev.gmax;
    UF.uFogSolCor.value.setRGB(
      (sRGB(cA.r) - sRGB(sc.fog.color.r)) * g, (sRGB(cA.g) - sRGB(sc.fog.color.g)) * g, (sRGB(cA.b) - sRGB(sc.fog.color.b)) * g);
    UF.uFogSolVista.value.copy(nev.dir).transformDirection(cam.matrixWorldInverse);
  };

  // ---------- água estilizada: turquesa no raso, azul fundo ao longe, luz atravessando a crista,
  // espuma na beirada e na correnteza/cachoeira, reflexo do céu (Fresnel) e brilho forte do sol ----------
  // AGUA_RICA (Bonita/Linda) liga espuma da beirada e "subsurface"; no Leve fica cor + reflexo + brilho.
  // uOndas (0/1) liga/desliga as ondinhas. Atributos (de mundo.js), todos opcionais:
  //   color: r = fundura (0 raso .. 1 fundo), g = 1 - beirada  → (1,1,1) = "fundo, sem espuma"
  //   fluxo: xy = direção da correnteza, z = 1 na cachoeira
  const matAgua = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, vertexColors: true,
    defines: { AGUA_RICA: '' },
    uniforms: {
      ...U,
      uOndas: U.uOndas || { value: 1 },
      uNevoaCor: { value: new THREE.Color() }, uNevoaPerto: { value: 30 }, uNevoaLonge: { value: 60 },
    },
    vertexShader: `
      uniform float uTempo, uOndas;
      attribute vec3 fluxo;
      varying vec3 vMundo;
      varying vec3 vFluxo;
      varying vec2 vAgua; // x: fundura (0 raso, 1 fundo) · y: beirada (espuma)
      void main() {
        vFluxo = fluxo;
        vAgua = vec2(color.r, 1.0 - color.g);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        if (fract(position.y) > 0.5) wp.y += sin(uTempo * 1.4 + wp.x * 0.8 + wp.z * 0.6) * 0.04 * uOndas;
        vMundo = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform float uTempo, uNoite, uPor, uNevoaPerto, uNevoaLonge, uOndas;
      uniform vec3 uSolDir, uSolCor, uZenite, uHorizonte, uNevoaCor;
      varying vec3 vMundo;
      varying vec3 vFluxo;
      varying vec2 vAgua;
      void main() {
        float t = uTempo;
        // água corrente: as ondinhas andam na direção em que ela corre
        float corre = clamp(length(vFluxo.xy) * 1.5, 0.0, 1.0);
        vec2 p = vMundo.xz - vFluxo.xy * t * 1.6;
        // cachoeira: listras descendo
        float cai = step(0.5, vFluxo.z);
        if (cai > 0.5) p = vec2((vMundo.x + vMundo.z) * 1.3, vMundo.y * 0.5 + t * 3.0);
        // ondinhas estilizadas: 3 trens de onda → inclinação (d) e altura (h)
        vec2 f1 = vec2(p.x * 0.9 + t * 1.3, p.y * 0.7 + t * 1.1);
        vec2 f2 = vec2(p.x * 2.3 - p.y * 1.7 + t * 2.1, p.y * 2.1 + p.x * 1.3 - t * 1.7);
        vec2 f3 = vec2((p.x + p.y) * 4.7 + t * 3.0, (p.x - p.y) * 5.1 - t * 2.6);
        vec2 d = vec2(cos(f1.x), cos(f1.y)) * 0.10 + vec2(cos(f2.x), cos(f2.y)) * 0.05 + vec2(cos(f3.x), cos(f3.y)) * 0.025;
        float h = (sin(f1.x) + sin(f1.y)) * 0.32 + (sin(f2.x) + sin(f2.y)) * 0.18;
        d *= uOndas; h *= uOndas;
        vec3 n = normalize(vec3(d.x, 1.0, d.y));
        vec3 v = normalize(cameraPosition - vMundo);
        float dist = length(cameraPosition - vMundo);
        if (v.y < 0.0) n.y = -n.y;
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 r = reflect(-v, n);
        vec3 ceu = mix(uHorizonte, uZenite, clamp(r.y * 1.6, 0.0, 1.0));

        // cor da água: raso turquesa clarinho → turquesa → azul fundo (fundo ou longe)
        float raso = 1.0 - vAgua.x;
        raso *= raso;
        float longe = smoothstep(10.0, 45.0, dist);
        vec3 cFunda = mix(vec3(0.015, 0.13, 0.32), vec3(0.004, 0.015, 0.05), uNoite);
        vec3 cTurq = mix(vec3(0.03, 0.42, 0.48), vec3(0.008, 0.035, 0.07), uNoite);
        vec3 cRasa = mix(vec3(0.22, 0.80, 0.70), vec3(0.02, 0.07, 0.10), uNoite);
        vec3 agua = mix(cTurq, cRasa, raso);
        agua = mix(agua, cFunda, longe * (1.0 - raso * 0.6) * 0.85);
        agua = mix(agua, cFunda, (1.0 - raso) * vAgua.x * 0.35);
        // cristas um pouco mais claras (visual de desenho)
        float crista = clamp(h * 0.6 + 0.5, 0.0, 1.0);
        agua *= 0.9 + crista * 0.25;
        // entardecer: a água fica mais quente e um pouco mais escura, como o resto da cena
        agua *= mix(vec3(1.0), vec3(1.0, 0.78, 0.66), uPor * 0.7) * (1.0 - uPor * 0.3);

        float sol = 1.0 - uNoite;
        #ifdef AGUA_RICA
          // falso subsurface: o sol atrás da onda (em relação à câmera) acende a crista em verde-água
          vec3 olharH = normalize(vec3(-v.x, 0.0, -v.z) + 1e-4);
          vec3 solH = normalize(vec3(uSolDir.x, 0.0, uSolDir.z) + 1e-4);
          float atras = pow(max(dot(olharH, solH), 0.0), 3.0) * smoothstep(-0.1, 0.25, uSolDir.y + 0.2);
          float sss = crista * crista * (0.25 + atras * 1.1) * sol;
          agua += vec3(0.10, 0.75, 0.55) * sss * 0.45 * (0.6 + raso * 0.6);
        #endif

        vec3 cor = mix(agua, ceu, 0.12 + fres * 0.78);
        // brilho do sol (forte e recortado) + halo; de noite um brilhinho da lua
        float rs = max(dot(r, uSolDir), 0.0);
        cor += uSolCor * (smoothstep(0.985, 0.995, rs) * 2.2 + pow(rs, 90.0) * 1.6 + pow(rs, 10.0) * 0.12) * sol;
        float rl = max(dot(r, -uSolDir), 0.0);
        cor += vec3(0.6, 0.7, 1.0) * pow(rl, 200.0) * 1.2 * uNoite;

        float a = mix(mix(0.6, 0.86, 1.0 - raso), 0.96, fres);
        a = mix(a, 0.94, longe);
        vec3 branco = vec3(0.95, 0.98, 1.0) * (1.0 - uNoite * 0.75);
        // espuminha onde a água corre ou cai (todos os níveis: é barato)
        float listra = 0.5 + 0.5 * sin(p.x * 6.0 + p.y * 3.0 + t * 4.0);
        float espC = max(corre * 0.5, cai) * listra;
        cor = mix(cor, branco, espC * (0.28 + cai * 0.4));
        a = mix(a, 0.92, cai * 0.6);
        #ifdef AGUA_RICA
          // espuma branca onde a água encosta na terra + pontinhas nas cristas mais altas
          float ruidoE = sin(p.x * 3.1 + t * 1.6) * sin(p.y * 2.7 - t * 1.3);
          float esp = vAgua.y * (0.65 + 0.35 * ruidoE) + (d.x + d.y) * 1.2;
          esp = smoothstep(0.5, 0.8, esp) * vAgua.y;
          float faixa = smoothstep(0.6, 0.62, fract(vAgua.y * 2.2 - t * 0.35 + ruidoE * 0.15)) * vAgua.y * 0.6;
          esp = max(esp, faixa * step(0.25, vAgua.y));
          esp += smoothstep(0.96, 1.0, crista + ruidoE * 0.06) * 0.3 * uOndas * (1.0 - longe) * (1.0 - cai);
          esp = clamp(esp + cai * smoothstep(0.55, 0.9, listra) * 0.5, 0.0, 1.0);
          cor = mix(cor, branco, esp * 0.85);
          a = max(a, esp * 0.92);
        #endif

        // névoa com a cor do céu (e dourada na direção do sol, igual ao céu)
        float sN = max(dot(-v, uSolDir), 0.0);
        vec3 nevCor = uNevoaCor + uSolCor * (pow(sN, 6.0) * (0.12 + uPor * 0.5) + pow(sN, 60.0) * 0.35) * sol;
        float nev = smoothstep(uNevoaPerto, uNevoaLonge, dist);
        cor = mix(cor, nevCor, nev);
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
    nev.h.copy(U.uHorizonte.value);
    nev.sol.copy(U.uSolCor.value).multiplyScalar(1 - noite);
    nev.dir.copy(solDir);
    UF.uFogPor.value = 0.12 + por * 0.5;
    nev.gmax = UF.uFogPor.value + 0.35;

    // sol durante o dia, lua à noite (a noite é clarinha: sem medo!)
    const fonte = s > -0.05 ? solDir : alvo.copy(solDir).negate();
    sol.color.copy(U.uSolCor.value).lerp(tmp2.setRGB(0.55, 0.65, 1), noite);
    sol.intensity = s > -0.05 ? 0.4 + 2.4 * THREE.MathUtils.smoothstep(s, -0.05, 0.35) : 0.5 * noite;
    // luz ambiente: de dia branca-azulada, no pôr do sol puxa para o horizonte (quente),
    // de noite um azul de luar mais clarinho (a noite não é assustadora)
    hemi.color.copy(U.uZenite.value).lerp(U.uHorizonte.value, por * 0.45).lerp(tmp.setRGB(1, 1, 1), 0.3 + dia * 0.25)
      .lerp(tmp.setRGB(0.45, 0.55, 0.85), noite * 0.35);
    hemi.groundColor.setRGB(0.42, 0.36, 0.28).multiplyScalar(0.5 + dia * 0.5);
    hemi.intensity = 0.55 + dia * 0.4 + por * 0.2 + noite * 0.15;
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

    // detalhes por nível: nos níveis com sombra (Bonita/Linda) liga espuma/subsurface na água,
    // luz nas arestas arredondadas e texturas 32px; no Leve fica o básico (16px, borda só escurecida)
    const rica = !!q.sombra;
    ligarDefine(matAgua, 'AGUA_RICA', rica);
    ligarDefine(matBlocos, 'BORDA', rica);
    ligarDefine(matBlocos, 'BORDA_LUZ', rica);
    ligarDefine(matBlocos, 'FOG_SOL', rica);
    // texturas: 16px no Leve, 32px na Bonita, 64px na Linda/Ultra
    if (atlas.userData && atlas.userData.definirResolucao) atlas.userData.definirResolucao(!q.sombra ? 16 : q.sombra < 2048 ? 32 : 64);

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

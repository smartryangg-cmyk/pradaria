// Pós-processamento "de cinema" do nível Ultra (só para computador forte).
// A cena é desenhada em HDR (meia precisão, com MSAA 4x) numa textura com profundidade; depois:
//  1) SSAO: sombrinha nos cantos entre blocos (oclusão de ambiente em tela) + desfoque que respeita bordas
//  2) Bloom suave: o que é muito claro (sol, lampião, brilho na água) "vaza" luz, em cadeia de mips
//  3) Raios de sol (god rays) saindo do sol na tela, cortados por morros e árvores; mais fortes no nascer/pôr
//  4) Tone mapping ACES (igual ao do three, mesma exposição) + correção de cor leve + vinheta
//  5) Profundidade de campo bem leve só bem longe + FXAA só nas bordas (não borra as texturas)
// Desligado, não aloca nada e não custa nada.
import * as THREE from '../vendor/three.module.min.js';

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMUM = `
  varying vec2 vUv;
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  vec3 posVista(sampler2D tProf, mat4 projInv, vec2 uv) {
    float d = texture2D(tProf, uv).x;
    vec4 p = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    return p.xyz / p.w;
  }
`;

// ---------- 1) SSAO ----------
const N_AO = 16;
const FRAG_AO = `
  ${COMUM}
  uniform sampler2D tProf;
  uniform mat4 uProj, uProjInv;
  uniform vec2 uTexel;          // 1/resolução da profundidade (cheia)
  uniform vec3 uKernel[${N_AO}];
  uniform float uRaio, uLonge;
  float h12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    float d = texture2D(tProf, vUv).x;
    if (d >= 0.99999) { gl_FragColor = vec4(1.0, 6e4, 0.0, 1.0); return; /* meia precisão vai até 65504 */ }
    vec3 p = posVista(tProf, uProjInv, vUv);
    // normal a partir da profundidade: escolhe o vizinho mais "liso" para não errar nas quinas
    vec3 pd = posVista(tProf, uProjInv, vUv + vec2(uTexel.x, 0.0));
    vec3 pe = posVista(tProf, uProjInv, vUv - vec2(uTexel.x, 0.0));
    vec3 pc = posVista(tProf, uProjInv, vUv + vec2(0.0, uTexel.y));
    vec3 pb = posVista(tProf, uProjInv, vUv - vec2(0.0, uTexel.y));
    vec3 dx = abs(pd.z - p.z) < abs(p.z - pe.z) ? pd - p : p - pe;
    vec3 dy = abs(pc.z - p.z) < abs(p.z - pb.z) ? pc - p : p - pb;
    vec3 n = normalize(cross(dx, dy));
    // rotação aleatória por pixel (o desfoque depois limpa o ruído)
    float a = h12(floor(gl_FragCoord.xy)) * 6.2831853;
    vec3 rnd = vec3(cos(a), sin(a), 0.0);
    vec3 t = normalize(rnd - n * dot(rnd, n));
    mat3 tbn = mat3(t, cross(n, t), n);
    float raio = uRaio;
    float occ = 0.0;
    for (int i = 0; i < ${N_AO}; i++) {
      vec3 s = p + tbn * uKernel[i] * raio;
      vec4 o = uProj * vec4(s, 1.0);
      vec2 suv = o.xy / o.w * 0.5 + 0.5;
      if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
      float sz = posVista(tProf, uProjInv, suv).z;
      float faixa = smoothstep(0.0, 1.0, raio / abs(p.z - sz));
      occ += (sz >= s.z + 0.025 ? 1.0 : 0.0) * faixa;
    }
    float ao = pow(1.0 - occ / float(${N_AO}), 1.7);
    // some aos poucos ao longe (lá a névoa manda)
    ao = mix(ao, 1.0, smoothstep(uLonge * 0.6, uLonge, -p.z));
    gl_FragColor = vec4(ao, -p.z, 0.0, 1.0);
  }`;

// desfoque bilateral separável (r = ao, g = distância)
const FRAG_AO_BLUR = `
  ${COMUM}
  uniform sampler2D tAO;
  uniform vec2 uDir;
  void main() {
    vec2 c = texture2D(tAO, vUv).rg;
    float soma = c.r, peso = 1.0;
    for (int i = -4; i <= 4; i++) {
      if (i == 0) continue;
      vec2 s = texture2D(tAO, vUv + uDir * float(i)).rg;
      float w = exp(-float(i * i) / 18.0) * exp(-abs(s.g - c.g) / max(c.g * 0.04, 0.05));
      soma += s.r * w; peso += w;
    }
    gl_FragColor = vec4(soma / peso, c.g, 0.0, 1.0);
  }`;

// ---------- 2) bloom ----------
const FRAG_CLARO = `
  ${COMUM}
  uniform sampler2D tCor;
  uniform vec2 uTexel;
  uniform float uLimiar, uJoelho;
  vec3 corte(vec3 c) {
    float l = max(c.r, max(c.g, c.b));
    float suave = clamp(l - uLimiar + uJoelho, 0.0, 2.0 * uJoelho);
    suave = suave * suave / (4.0 * uJoelho + 1e-4);
    float k = max(suave, l - uLimiar) / max(l, 1e-4);
    return c * k / (1.0 + luma(c) * 0.25); // segura "vagalumes" de pixels muito fortes
  }
  void main() {
    vec3 c = corte(texture2D(tCor, vUv + uTexel * vec2(-1.0, -1.0)).rgb)
           + corte(texture2D(tCor, vUv + uTexel * vec2( 1.0, -1.0)).rgb)
           + corte(texture2D(tCor, vUv + uTexel * vec2(-1.0,  1.0)).rgb)
           + corte(texture2D(tCor, vUv + uTexel * vec2( 1.0,  1.0)).rgb);
    gl_FragColor = vec4(c * 0.25, 1.0);
  }`;
const FRAG_DESCE = `
  ${COMUM}
  uniform sampler2D tCor;
  uniform vec2 uTexel;
  void main() {
    vec3 a = texture2D(tCor, vUv).rgb * 0.5;
    vec3 b = (texture2D(tCor, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tCor, vUv + uTexel * vec2(1.0, -1.0)).rgb
            + texture2D(tCor, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tCor, vUv + uTexel * vec2(1.0, 1.0)).rgb) * 0.125;
    gl_FragColor = vec4(a + b, 1.0);
  }`;
const FRAG_SOBE = `
  ${COMUM}
  uniform sampler2D tCor;
  uniform vec2 uTexel;
  uniform float uPeso;
  void main() {
    vec3 c = texture2D(tCor, vUv).rgb * 4.0;
    c += (texture2D(tCor, vUv + vec2(uTexel.x, 0.0)).rgb + texture2D(tCor, vUv - vec2(uTexel.x, 0.0)).rgb
        + texture2D(tCor, vUv + vec2(0.0, uTexel.y)).rgb + texture2D(tCor, vUv - vec2(0.0, uTexel.y)).rgb) * 2.0;
    c += texture2D(tCor, vUv + uTexel).rgb + texture2D(tCor, vUv - uTexel).rgb
       + texture2D(tCor, vUv + vec2(uTexel.x, -uTexel.y)).rgb + texture2D(tCor, vUv + vec2(-uTexel.x, uTexel.y)).rgb;
    gl_FragColor = vec4(c / 16.0 * uPeso, 1.0);
  }`;

// ---------- 3) raios de sol ----------
const FRAG_MASCARA = `
  ${COMUM}
  uniform sampler2D tCor, tProf;
  uniform vec2 uSol;
  uniform float uAspecto;
  void main() {
    float d = texture2D(tProf, vUv).x;
    if (d < 0.99999) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
    vec3 c = texture2D(tCor, vUv).rgb;
    vec2 q = (vUv - uSol) * vec2(uAspecto, 1.0);
    float perto = pow(max(1.0 - length(q) / 0.45, 0.0), 3.0);
    gl_FragColor = vec4(c * max(luma(c) - 0.3, 0.0) * perto, 1.0);
  }`;
const FRAG_RAIOS = `
  ${COMUM}
  uniform sampler2D tMascara;
  uniform vec2 uSol;
  float h12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    const int N = 48;
    vec2 passo = (vUv - uSol) * (0.92 / float(N));
    vec2 uv = vUv - passo * h12(gl_FragCoord.xy); // quebra o "degrau" das amostras
    vec3 soma = vec3(0.0);
    float dec = 1.0;
    for (int i = 0; i < N; i++) {
      soma += texture2D(tMascara, uv).rgb * dec;
      dec *= 0.965;
      uv -= passo;
    }
    gl_FragColor = vec4(soma / float(N) * 2.2, 1.0);
  }`;

// ---------- 4) junta tudo, ACES, cor ----------
const FRAG_FINAL = `
  ${COMUM}
  uniform sampler2D tCor, tProf, tAO, tBloom, tRaios;
  uniform mat4 uProjInv;
  uniform vec2 uTexel;
  uniform float uExpo, uBloom, uRaios, uAO, uNevoaPerto, uNevoaLonge, uDof, uSat, uContraste, uVinheta, uNoite;
  uniform vec3 uSolCor;
  vec3 RRTAndODTFit(vec3 v) {
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec3 aces(vec3 c) { // o mesmo ACESFilmicToneMapping do three.js
    const mat3 ent = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
    const mat3 sai = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
    c *= uExpo / 0.6;
    c = sai * RRTAndODTFit(ent * c);
    return clamp(c, 0.0, 1.0);
  }
  vec3 paraSRGB(vec3 c) { return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
  float h12(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float dist(vec2 uv) { float d = texture2D(tProf, uv).x; return d >= 0.99999 ? 1e5 : -posVista(tProf, uProjInv, uv).z; }
  void main() {
    vec3 c = texture2D(tCor, vUv).rgb;
    float z = dist(vUv);
    bool ceu = z > 9e4;
    float nev = ceu ? 1.0 : smoothstep(uNevoaPerto, uNevoaLonge, z);
    // profundidade de campo bem leve, só lá longe
    float f = ceu ? 0.0 : smoothstep(uNevoaPerto * 0.7, uNevoaLonge, z) * uDof;
    if (f > 0.01) {
      vec3 b = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float a = float(i) * 0.785398 + 0.39;
        b += texture2D(tCor, vUv + vec2(cos(a), sin(a)) * uTexel * 2.5 * f).rgb;
      }
      c = mix(c, b / 8.0, min(1.0, f * 1.4));
    }
    // oclusão de ambiente (some na névoa)
    if (!ceu) c *= mix(1.0, clamp(texture2D(tAO, vUv).r, 0.0, 1.0), uAO * (1.0 - nev));
    c += texture2D(tBloom, vUv).rgb * uBloom;
    c += texture2D(tRaios, vUv).rgb * uSolCor * uRaios;
    c = paraSRGB(aces(c));
    // correção de cor: um pouco mais de contraste e cor, sombras frias e luzes quentes
    float l = luma(c);
    c = mix(vec3(l), c, uSat);
    c = mix(c, c * c * (3.0 - 2.0 * c), uContraste);
    c += (vec3(-0.012, -0.002, 0.018) * (1.0 - l) + vec3(0.018, 0.008, -0.012) * l) * (1.0 - uNoite * 0.5);
    vec2 q = vUv - 0.5;
    c *= 1.0 - dot(q, q) * uVinheta;
    c += (h12(gl_FragCoord.xy) - 0.5) / 255.0; // tira as faixas do degradê do céu
    // borda de profundidade (para o FXAA mexer só em quinas, sem borrar as texturas)
    float zd = dist(vUv + vec2(uTexel.x, 0.0)), ze = dist(vUv - vec2(uTexel.x, 0.0));
    float zc = dist(vUv + vec2(0.0, uTexel.y)), zb = dist(vUv - vec2(0.0, uTexel.y));
    float zm = min(z, min(min(zd, ze), min(zc, zb)));
    float zM = max(z, max(max(zd, ze), max(zc, zb)));
    float borda = clamp((zM - zm) / max(zm, 0.1) * 6.0, 0.0, 1.0);
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), borda);
  }`;

// ---------- 5) FXAA (só nas bordas) ----------
const FRAG_FXAA = `
  ${COMUM}
  uniform sampler2D tCor;
  uniform vec2 uTexel;
  void main() {
    vec4 m = texture2D(tCor, vUv);
    if (m.a < 0.02) { gl_FragColor = vec4(m.rgb, 1.0); return; }
    vec3 nw = texture2D(tCor, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
    vec3 ne = texture2D(tCor, vUv + vec2( 1.0, -1.0) * uTexel).rgb;
    vec3 sw = texture2D(tCor, vUv + vec2(-1.0,  1.0) * uTexel).rgb;
    vec3 se = texture2D(tCor, vUv + vec2( 1.0,  1.0) * uTexel).rgb;
    vec3 L = vec3(0.299, 0.587, 0.114);
    float lnw = dot(nw, L), lne = dot(ne, L), lsw = dot(sw, L), lse = dot(se, L), lm = dot(m.rgb, L);
    float lmin = min(lm, min(min(lnw, lne), min(lsw, lse)));
    float lmax = max(lm, max(max(lnw, lne), max(lsw, lse)));
    vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), ((lnw + lsw) - (lne + lse)));
    float red = max((lnw + lne + lsw + lse) * 0.03125, 1.0 / 128.0);
    float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
    dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uTexel;
    vec3 a = 0.5 * (texture2D(tCor, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tCor, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
    vec3 b = a * 0.5 + 0.25 * (texture2D(tCor, vUv - dir * 0.5).rgb + texture2D(tCor, vUv + dir * 0.5).rgb);
    float lb = dot(b, L);
    vec3 r = (lb < lmin || lb > lmax) ? a : b;
    gl_FragColor = vec4(mix(m.rgb, r, m.a), 1.0);
  }`;

export function criarPosEfeitos(renderer, cena, camera) {
  const gl2 = renderer.capabilities.isWebGL2;
  const suportado = gl2 && renderer.extensions.has('EXT_color_buffer_float');
  const info = { suportado, ativo: false, largura: 0, altura: 0, msaa: 0 };
  let ligado = false, W = 1, H = 1, rt = null;

  // triângulo que cobre a tela toda
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const quad = new THREE.Mesh(geo);
  quad.frustumCulled = false;
  const quadCena = new THREE.Scene();
  quadCena.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const mat = (frag, uniforms, extra) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false, ...extra });
  const v2 = () => ({ value: new THREE.Vector2() });

  // núcleo do SSAO: hemisfério, mais amostras perto do centro
  const kernel = [];
  for (let i = 0; i < N_AO; i++) {
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 0.9 + 0.1).normalize();
    let s = i / N_AO; s = 0.1 + 0.9 * s * s;
    kernel.push(v.multiplyScalar(s * (0.5 + Math.random() * 0.5)));
  }

  const mAO = mat(FRAG_AO, { tProf: { value: null }, uProj: { value: camera.projectionMatrix }, uProjInv: { value: camera.projectionMatrixInverse }, uTexel: v2(), uKernel: { value: kernel }, uRaio: { value: 0.9 }, uLonge: { value: 90 } });
  const mAOBlur = mat(FRAG_AO_BLUR, { tAO: { value: null }, uDir: v2() });
  const mClaro = mat(FRAG_CLARO, { tCor: { value: null }, uTexel: v2(), uLimiar: { value: 1.0 }, uJoelho: { value: 0.5 } });
  const mDesce = mat(FRAG_DESCE, { tCor: { value: null }, uTexel: v2() });
  const mSobe = mat(FRAG_SOBE, { tCor: { value: null }, uTexel: v2(), uPeso: { value: 1 } }, { blending: THREE.AdditiveBlending, transparent: true });
  const mMascara = mat(FRAG_MASCARA, { tCor: { value: null }, tProf: { value: null }, uSol: v2(), uAspecto: { value: 1 } });
  const mRaios = mat(FRAG_RAIOS, { tMascara: { value: null }, uSol: v2() });
  const mFinal = mat(FRAG_FINAL, {
    tCor: { value: null }, tProf: { value: null }, tAO: { value: null }, tBloom: { value: null }, tRaios: { value: null },
    uProjInv: { value: camera.projectionMatrixInverse }, uTexel: v2(),
    uExpo: { value: 1 }, uBloom: { value: 0.35 }, uRaios: { value: 0 }, uAO: { value: 0.85 },
    uNevoaPerto: { value: 30 }, uNevoaLonge: { value: 60 }, uDof: { value: 0.35 },
    uSat: { value: 1.1 }, uContraste: { value: 0.18 }, uVinheta: { value: 0.32 }, uNoite: { value: 0 },
    uSolCor: { value: new THREE.Color(1, 0.9, 0.7) },
  });
  const mFxaa = mat(FRAG_FXAA, { tCor: { value: null }, uTexel: v2() });

  function criarAlvos() {
    liberar();
    const w = W, h = H, w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1);
    const hf = { type: THREE.HalfFloatType, depthBuffer: false };
    const cenaRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) });
    const mips = [];
    for (let i = 0, mw = w2, mh = h2; i < 6; i++, mw = Math.max(1, mw >> 1), mh = Math.max(1, mh >> 1)) mips.push(new THREE.WebGLRenderTarget(mw, mh, hf));
    rt = {
      cena: cenaRT,
      ao: new THREE.WebGLRenderTarget(w2, h2, hf), ao2: new THREE.WebGLRenderTarget(w2, h2, hf),
      mips,
      mascara: new THREE.WebGLRenderTarget(w2, h2, hf), raios: new THREE.WebGLRenderTarget(w2, h2, hf),
      ldr: new THREE.WebGLRenderTarget(w, h, { depthBuffer: false }),
    };
    info.largura = w; info.altura = h; info.msaa = 4;
  }
  function liberar() {
    if (!rt) return;
    for (const k in rt) [].concat(rt[k]).forEach((r) => { if (r.depthTexture) r.depthTexture.dispose(); r.dispose(); });
    rt = null;
  }

  function passe(m, alvo) {
    quad.material = m;
    renderer.setRenderTarget(alvo);
    renderer.render(quadCena, quadCam);
  }

  const vSol = new THREE.Vector3(), vFrente = new THREE.Vector3(), solTela = new THREE.Vector2();

  // solTela: posição do sol na tela (0..1) ou null para calcular; dados: os uniforms do graficos.js (uSolDir, uSolCor, uNoite, uPor)
  function render(solPos, dados) {
    if (!rt) criarAlvos();
    const infoR = renderer.info, autoReset = infoR.autoReset, autoClear = renderer.autoClear;
    infoR.autoReset = false; infoR.reset();

    // cena em HDR (os materiais não fazem tone mapping quando o alvo é uma textura)
    renderer.setRenderTarget(rt.cena);
    renderer.render(cena, camera);
    renderer.autoClear = false;
    const prof = rt.cena.depthTexture, cor = rt.cena.texture;

    // SSAO
    mAO.uniforms.tProf.value = prof;
    mAO.uniforms.uTexel.value.set(1 / W, 1 / H);
    mAO.uniforms.uLonge.value = cena.fog ? cena.fog.far : 120;
    passe(mAO, rt.ao);
    const tw = 1 / rt.ao.width, th = 1 / rt.ao.height;
    mAOBlur.uniforms.tAO.value = rt.ao.texture; mAOBlur.uniforms.uDir.value.set(tw, 0); passe(mAOBlur, rt.ao2);
    mAOBlur.uniforms.tAO.value = rt.ao2.texture; mAOBlur.uniforms.uDir.value.set(0, th); passe(mAOBlur, rt.ao);

    // bloom
    const noite = dados ? dados.uNoite.value : 0, por = dados ? dados.uPor.value : 0;
    mClaro.uniforms.tCor.value = cor;
    mClaro.uniforms.uTexel.value.set(1 / W, 1 / H);
    mClaro.uniforms.uLimiar.value = 1.35 - noite * 0.7;
    passe(mClaro, rt.mips[0]);
    for (let i = 1; i < rt.mips.length; i++) {
      const s = rt.mips[i - 1];
      mDesce.uniforms.tCor.value = s.texture; mDesce.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      passe(mDesce, rt.mips[i]);
    }
    for (let i = rt.mips.length - 2; i >= 0; i--) {
      const s = rt.mips[i + 1];
      mSobe.uniforms.tCor.value = s.texture; mSobe.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      mSobe.uniforms.uPeso.value = 0.85;
      passe(mSobe, rt.mips[i]);
    }

    // raios de sol
    let forcaRaios = 0;
    if (dados) {
      const dir = dados.uSolDir.value;
      camera.getWorldDirection(vFrente);
      const frente = vFrente.dot(dir);
      if (solPos) solTela.copy(solPos);
      else { vSol.copy(dir).multiplyScalar(300).add(camera.position).project(camera); solTela.set(vSol.x * 0.5 + 0.5, vSol.y * 0.5 + 0.5); }
      forcaRaios = (1 - noite) * THREE.MathUtils.smoothstep(dir.y, -0.08, 0.06) * THREE.MathUtils.smoothstep(frente, 0.05, 0.55) * (0.2 + por * 0.55);
      mFinal.uniforms.uSolCor.value.copy(dados.uSolCor.value);
    }
    if (forcaRaios > 0.003) {
      mMascara.uniforms.tCor.value = cor; mMascara.uniforms.tProf.value = prof;
      mMascara.uniforms.uSol.value.copy(solTela); mMascara.uniforms.uAspecto.value = W / H;
      passe(mMascara, rt.mascara);
      mRaios.uniforms.tMascara.value = rt.mascara.texture; mRaios.uniforms.uSol.value.copy(solTela);
      passe(mRaios, rt.raios);
    }

    // final: junta, tone mapping, cor
    const u = mFinal.uniforms;
    u.tCor.value = cor; u.tProf.value = prof; u.tAO.value = rt.ao.texture; u.tBloom.value = rt.mips[0].texture; u.tRaios.value = rt.raios.texture;
    u.uTexel.value.set(1 / W, 1 / H);
    u.uExpo.value = renderer.toneMappingExposure;
    u.uRaios.value = forcaRaios;
    u.uBloom.value = 0.25 + noite * 0.25;
    u.uNoite.value = noite;
    if (cena.fog) { u.uNevoaPerto.value = cena.fog.near; u.uNevoaLonge.value = cena.fog.far; }
    passe(mFinal, rt.ldr);
    mFxaa.uniforms.tCor.value = rt.ldr.texture;
    mFxaa.uniforms.uTexel.value.set(1 / W, 1 / H);
    passe(mFxaa, null);

    renderer.autoClear = autoClear;
    infoR.autoReset = autoReset;
  }

  return {
    get ativo() { return ligado && suportado; },
    info,
    ligar(sim) {
      ligado = !!sim;
      info.ativo = ligado && suportado;
      if (!info.ativo) liberar();
    },
    tamanho(w, h, pr) {
      const nw = Math.max(1, Math.floor(w * pr)), nh = Math.max(1, Math.floor(h * pr));
      if (nw === W && nh === H) return;
      W = nw; H = nh;
      if (rt) criarAlvos();
    },
    render,
  };
}

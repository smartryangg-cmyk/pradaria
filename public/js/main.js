// Pradaria: jogo de construir e explorar, pacífico, para o navegador.
import { CHAO_DA_MUDA } from './arvores-regras.js';
import * as THREE from '../vendor/three.module.min.js';
import { F } from './formas.js';
import { FOLHAGEM } from './blocos.js';
import { CANA, cabeCana } from './cana-regras.js';
import { criarAtlas, iconeBloco, INVENTARIO, INVENTARIO_MAQUINAS, INVENTARIO_FORMAS, B, E, AR, BLOCOS, SOLIDO, AGUA, PRECISA_CHAO, ITEM, ehItem, nomeDe, FORNALHA } from './blocos.js';
import { toquesCom, receitasDoMundo, GRUPOS, podeCriar, faltaBancada, gastoDe, receitaDaGrade, arrumar, cabeNaGrade, pilhaDe, cabe, nivelFalta, NOME_NIVEL, baseDe, DURA } from './receitas.js';
import { Inventario, MAO2 } from './inventario.js';
import { BASE, PRECISA_ENERGIA, ELETRICO } from './energia.js';
import { Mundo, ALT, NIVEL_AGUA } from './mundo.js';
import { vento as forcaVento } from './energia.js';
import { Jogador, OLHOS } from './jogador.js';
import { Controles } from './controles.js';
import { Bichos } from './animais.js';
import { Aldeoes } from './aldeoes.js';
import { Garagem } from './garagem.js';
import { Som, VOL_PADRAO } from './som.js';
import { materialDe } from './som-materiais.js';
import { Voz } from './voz.js';
import { montarBoneco, vestirBoneco, etiqueta, matModelo, matContorno, caixa, juntar, bola, animarBoneco, poseNeutra } from './modelos.js';
import { normalizarSkin, skinDeCor, skinIgual, CORES_ROUPA, corDe, normalizarModelos } from './skin.js';
import { Personagem } from './personagem.js';
import { Visao } from './visao.js';
import { Chat } from './chat.js';
import { conta, api, Sala } from './rede.js';
import { criarGraficos, QUALIDADES, PESSOAIS } from './graficos.js';
import { MapaIlha } from './mapa-ilha.js';
import { ICONE_LUGAR } from './ilha-aventura.js';
import { criarPosEfeitos } from './posefeitos.js';
import { icone, preencherIcones, comIcone, nomeEmote, ligarThree } from './icones.js';
import { Escavacao, toquesPara } from './escavar.js';
import { Fisica } from './fisica.js';
import { Plantacoes } from './plantacoes.js';
import { Agua } from './agua.js';
import { criarComandos } from './comandos.js';
import { criarCama } from './cama.js';
import { ehCama } from './dormir-regras.js';
import { ESCADA_MAO, PAREDE } from './escada-mao.js';
import { LAVA, ehLava, DANO_LAVA } from './lava-regras.js';
import { FOGO, ISQUEIRO, DANO_FOGO, inflamavel } from './fogo-regras.js';
import { nivelDe } from './xp-regras.js';
import { fornoNovo, avancar, normalizarForno, fornoDaRede, conteudo, assavel, queima, TEMPO_FORNO } from './fornalha-regras.js';
import { BAU, ESPACOS_BAU, bauNovo, normalizarBau, conteudoBau, vazioBau } from './bau-regras.js';
import { FORMA_NOVA } from './formas.js';
import { OPCOES_MUNDO, PADRAO_MUNDO, PADRAO_NOVO, TAMANHOS, TIPOS, ESTILOS, MODOS_JOGO, DIFICULDADES, modoJogoDe, normalizarOpcoes, definirOpcoesMundo, opcoesMundo, sementeDeTexto, raioExtraMundo, precisa16 } from './opcoes-mundo.js';
import { vida } from './vida.js';
import { ehComida, TEMPO_COMER } from './fome-regras.js';
import { Mapa } from './mapa.js';
import { Mercado } from './mercado.js';
import { Negocios } from './negocios.js';
import { MV } from './moveis.js';
import { horaDe } from './trabalho.js';
import { caiDoBicho } from './economia.js';
import { Drops } from './drops.js';
import { MAX_LARGAR } from './regras-chao.js';
import { VERSAO } from './versao.js';
import { preencherDono, contaModo, ligarApagarConta } from './dono.js';
import { Armas } from './armas.js';
import { abrirEditarMundo, desenharRegrasMods, desenharAbas, atualizarAbas, baixarArquivo, escolherArquivo, montarArquivo } from './editar-mundo.js';
import { Mecanismos } from './mecanismos.js';
import { Guerra } from './guerra.js';
import { confirmarIdade16, seletorData } from './idade.js';
import { ligarHub, abrirJogos } from './hub.js';
import { modoTV, iniciarTV } from './tv.js';
import { Lobby } from './lobby.js';
import { criarAmigos } from './amigos.js';
import { jogo as dadosJogo } from './jogos.js';

const $ = (s) => document.querySelector(s);
ligarThree(THREE);
preencherIcones();
const CORES = [0x3f6fd9, 0xe8433f, 0x4caf50, 0xf2c72e, 0x9c5bd9, 0xf29ac2, 0xff8a3d, 0x2bb3b3];

// ---------- ajustes salvos ----------
// na TV (navegador de Smart TV, ou Modo TV ligado) não tem toque: controle remoto, videogame ou celular
const naTV = modoTV();
const ehToque = !naTV && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
if (ehToque) document.body.classList.add('toque');
const AJ_PADRAO = { dist: ehToque ? 3 : 4, qual: ehToque ? 0.8 : 1, graf: 'auto', grafAuto: null, grafTeto: null, grafManual: false, gopc: null, ...PESSOAIS, auto: true, sens: 0.0055, som: true, ...VOL_PADRAO, fps: false, minimapa: true };
let ajustes = { ...AJ_PADRAO };
try { Object.assign(ajustes, JSON.parse(localStorage.getItem('pradaria.ajustes') || '{}')); } catch {}
// tela dividida na TV: só a metade do Jogador 1 toca a música (as duas juntas embolam)
if (window.jogadorTV === 2 && !localStorage.getItem('pradaria.ajustes')) ajustes.volMusica = 0;
// quem nunca escolheu os gráficos à mão fica no automático (inclusive quem jogou antes desta versão)
if (!ajustes.grafManual) ajustes.graf = 'auto';
if (ajustes.graf !== 'auto' && !QUALIDADES[ajustes.graf] && !(ajustes.graf === 'personalizado' && ajustes.gopc)) ajustes.graf = 'auto';
const NIVEIS = ['baixa', 'media', 'alta', 'ultra'];
// nível que vale no automático: o que a calibração achou neste aparelho, ou um palpite pela placa de vídeo
const nivelAuto = () => (NIVEIS.includes(ajustes.grafAuto) ? ajustes.grafAuto : palpiteGrafico());
// opções gráficas valendo agora: as do preset (ou as personalizadas) + as pessoais
function opcoesGraficas() {
  const base = ajustes.graf === 'personalizado' ? { ...QUALIDADES.alta, ...ajustes.gopc, nome: 'Personalizado' }
    : ajustes.graf === 'auto' ? { ...QUALIDADES[nivelAuto()], nome: 'Automático: ' + QUALIDADES[nivelAuto()].nome } : QUALIDADES[ajustes.graf];
  return { ...base, fov: ajustes.fov, brilho: ajustes.brilho, fpsMax: ajustes.fpsMax };
}
const salvarAjustes = () => { try { localStorage.setItem('pradaria.ajustes', JSON.stringify(ajustes)); } catch {} };

// ---------- renderização ----------
const canvas = $('#tela');
// no computador pede a placa de vídeo mais forte (notebook com duas placas usaria a fraca)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: ehToque ? 'default' : 'high-performance' });

// palpite do nível gráfico pelo nome da placa de vídeo e pela memória/núcleos do aparelho
let palpiteFeito = null;
function palpiteGrafico() {
  if (palpiteFeito) return palpiteFeito;
  let gpu = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
  } catch {}
  const mem = navigator.deviceMemory || 4, nucleos = navigator.hardwareConcurrency || 4;
  let n;
  if (/swiftshader|llvmpipe|software|microsoft basic/i.test(gpu)) n = 'baixa';
  else if (/rtx|gtx 1[06-9]|gtx [2-9]|radeon (rx|pro)|apple m[1-9]|arc a/i.test(gpu)) n = 'ultra';
  else if (/adreno.*\b[3-5]\d\d\b|mali-[t4]|mali-g[57]\d\b|powervr|videocore|tegra/i.test(gpu)) n = 'baixa';
  else if (/adreno.*\b(6[0-3]\d)\b|mali-g[67]\d/i.test(gpu)) n = 'media';
  else if (/intel|iris|uhd|apple gpu|adreno|mali|radeon|geforce|nvidia/i.test(gpu)) n = ehToque ? 'media' : 'alta';
  else n = ehToque ? 'media' : 'alta';
  // aparelho com pouca memória ou poucos núcleos não passa de certo nível
  if (mem <= 2 || nucleos <= 2) n = 'baixa';
  else if (ehToque && (mem <= 3 || nucleos <= 4) && n !== 'baixa') n = 'media';
  palpiteFeito = n;
  return n;
}
// a placa de vídeo desistiu (memória cheia, comum em tablet fraco): volta para o nível leve e lembra disso
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); // deixa o navegador devolver a tela
  if (ajustes.graf === 'auto') { ajustes.grafAuto = 'baixa'; ajustes.grafTeto = 'baixa'; }
  else if (ajustes.graf !== 'baixa') { ajustes.graf = 'baixa'; ajustes.grafManual = false; }
  salvarAjustes();
});
canvas.addEventListener('webglcontextrestored', () => { try { aplicarGraficos(); preencherGraficos(); } catch {} });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 400); // perto = 0,05 (como no clássico): com tela larga e visão 100° o canto da tela não entra na parede nem no teto
cena.fog = new THREE.Fog(0x8fd3ff, 30, 60);
// efeitos de cinema do Ultra (desligados não custam nada)
const pos = criarPosEfeitos(renderer, cena, camera);

function redimensionar() {
  // limite de pixels por nível (tablet com tela enorme não precisa desenhar 4 milhões de pixels)
  const og = opcoesGraficas(), tetoMP = og.teto || 1.3;
  const maxPr = Math.sqrt((tetoMP * 1e6) / (innerWidth * innerHeight));
  // Ultra: resolução nativa da tela (sem teto)
  const pr = (og.nativo ? window.devicePixelRatio || 1 : Math.min(window.devicePixelRatio || 1, 2, maxPr)) * ajustes.qual;
  renderer.setPixelRatio(Math.max(0.4, pr));
  renderer.setSize(innerWidth, innerHeight, false);
  pos.tamanho(innerWidth, innerHeight, renderer.getPixelRatio());
  camera.aspect = innerWidth / innerHeight;
  camera.fov = ajustes.fov || 72;
  camera.updateProjectionMatrix();
}
addEventListener('resize', redimensionar);
redimensionar();

const { tex: atlas, canvas: atlasCanvas } = criarAtlas();
const graf = criarGraficos(renderer, cena, camera, atlas);
const { matBlocos, matAgua } = graf;

// minimapa e mapa grande
const mapa = new Mapa({
  atlasCanvas,
  mini: $('#minimapa-tela'),
  grande: { janela: $('#mapa'), canvas: $('#mapa-tela'), coords: $('#mapa-coords'), fechar: $('#mapa-fechar'), mais: $('#mapa-mais'), menos: $('#mapa-menos'), centrar: $('#mapa-centro'), limpar: $('#mapa-limpar') },
  aoAbrir: () => { if (document.pointerLockElement) document.exitPointerLock(); pausado = true; },
  aoFechar: () => { pausado = false; },
});
function aplicarMinimapa() { mapa.ligado = !!ajustes.minimapa; $('#minimapa').hidden = !ajustes.minimapa; }

// nuvens fofas (estilo desenho): cachos de bolas achatadas, brancas em cima e lilás-azuladas embaixo
const nuvens = (() => {
  const g = [];
  const r = Math.random;
  const baixo = new THREE.Color(0.74, 0.8, 0.96);
  for (let i = 0; i < 24; i++) {
    const x = (r() - 0.5) * 360, z = (r() - 0.5) * 360;
    const w = 10 + r() * 14, n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const t = n > 1 ? k / (n - 1) - 0.5 : 0, rb = w * (0.32 + (0.5 - Math.abs(t)) * 0.3) * (0.8 + r() * 0.4);
      const bg = bola(1, 0xffffff, x + t * w * 1.3, rb * 0.25, z + (r() - 0.5) * w * 0.5, rb, rb * 0.62, rb * 0.8);
      // sombreado de desenho embutido: faixa de baixo um tom mais escuro
      const p = bg.attributes.position, c = bg.attributes.color, y0 = rb * 0.25;
      for (let v = 0; v < p.count; v++) if (p.getY(v) < y0 - rb * 0.12) c.setXYZ(v, baixo.r, baixo.g, baixo.b);
      g.push(bg);
    }
  }
  const m = new THREE.Mesh(juntar(g), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.94, fog: false, depthWrite: false }));
  m.position.y = ALT + 22;
  cena.add(m);
  return m;
})();

let somPronto = false;
function aplicarGraficos() {
  const o = graf.aplicar(opcoesGraficas());
  if (somPronto) aplicarSom(); // gráfico Leve deixa o som mais simples também
  nuvens.visible = o.nuvens;
  matContorno.visible = !!o.contorno;
  $('#vinheta').hidden = !o.vinheta;
  pos.ligar(!!o.pos);
  redimensionar();
  return o;
}
aplicarGraficos();

// contorno do bloco mirado
const contorno = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
contorno.visible = false;
cena.add(contorno);

// ---------- estado do jogo ----------
const som = new Som();
som.materialDe = materialDe;
// sons: liga/desliga, volumes separados (música, efeitos, voz dos amigos) e modo leve (gráfico Leve ou celular)
const celular = () => ehToque && Math.min(innerWidth, innerHeight) < 500;
function aplicarSom() {
  som.configurar({ ligado: ajustes.som, musica: ajustes.volMusica, efeitos: ajustes.volEfeitos, voz: ajustes.volVoz, leve: opcoesGraficas().sombra === 0 || celular() });
  Voz.definirVolume(ajustes.som ? ajustes.volVoz : 0);
}
aplicarSom();
somPronto = true;
// o que o pé pisa (no ar logo acima de meio bloco/rampa, olha um pouco mais embaixo)
function chaoDe(x, y, z) {
  if (!mundo) return 'terra';
  const bx = Math.floor(x), bz = Math.floor(z);
  let b = mundo.bloco(bx, Math.floor(y - 0.05), bz);
  if (!b) b = mundo.bloco(bx, Math.floor(y - 0.6), bz);
  return b ? materialDe(b) : 'terra';
}
const meioDe = (x, y, z) => ({ x: x + 0.5, y: y + 0.5, z: z + 0.5 });
// água: fôlego e a visão embaixo d'água
const agua = new Agua({ cena, graf, som, aviso: (t, ms, ic) => aviso(t, ms, ic), vida, esconder: () => [nuvens] });

let mundo = null, jog = null, ctrl = null, bichos = null, aldeoes = null, sala = null, escav = null, fisica = null, plantacoes = null;
let jogando = false, pausado = false;
let modo = 'local', mundoAtual = null;
const BARRA_CRIATIVO = [B.GRAMA, B.TERRA, B.PEDRA, B.TABUAS, B.TRONCO, B.VIDRO, B.TIJOLO, B.LA_VERMELHA, B.FLOR_AMARELA];
let barra = [...BARRA_CRIATIVO];
let slotSel = 0;
// coletar e criar: o que o jogador tem fica na mochila do mercado (mercado.e.itens; regras em receitas.js).
// Só vale nos mundos com essa opção; nos outros, blocos à vontade.
const sobrev = () => opcoesMundo.sobrevivencia === true;
const naMao = () => barra[slotSel] || 0;
let tempoDia = 0.3; // 0..1 (0.25 = meio-dia)
const DURACAO_DIA = 600;
const outros = new Map();
let euId = null;
// veículos: garagem, direção e câmera de trás (código em garagem.js e veiculos.js)
const garagem = new Garagem({
  cena, camera, som, aviso: (t, ms, ic) => aviso(t, ms, ic), outros,
  corBoneco: () => meuSkin(),
  sala: () => sala, euId: () => euId, jog: () => jog, mundo: () => mundo, bichos: () => bichos, aldeoes: () => aldeoes,
  pausar: (sim) => { pausado = sim; }, mercado: () => mercado,
});
// mundo de Guerra: polícia, presídio, forte inimigo, veículos armados e missões (guerra.js)
const guerra = new Guerra({
  cena, camera, canvas, som, aviso: (t, ms, ic) => aviso(t, ms, ic), outros, garagem,
  sala: () => sala, euId: () => euId, jog: () => jog, mundo: () => mundo, bichos: () => bichos,
  armas: () => armas,
  cmd: { teleportar: (...a) => cmd.teleportar(...a) },
  codigo: () => (modo === 'online' && mundoAtual ? mundoAtual.codigo : null),
  pausar: (sim) => { pausado = sim; },
});

// câmera: com os olhos, de trás ou de frente (vendo o próprio boneco)
const visao = new Visao(cena);
// ---------- meu personagem (skin.js / personagem.js) ----------
// Com conta: fica salvo na conta (D1). Sem conta: neste aparelho. Online: os amigos veem na hora.
const CHAVE_SKIN = 'pradaria.skin';
function skinLocal() { try { const t = localStorage.getItem(CHAVE_SKIN); return t ? normalizarSkin(t) : null; } catch { return null; } }
function meuSkin() {
  const u = conta.usuario;
  if (u && u.skinSalva) return normalizarSkin(u.skin, u.cor);
  return skinLocal() || (u ? normalizarSkin(u.skin, u.cor) : skinDeCor(0));
}
// conta sem personagem salvo: leva o que foi montado neste aparelho antes de entrar
function levarSkinLocal() {
  const u = conta.usuario, s = skinLocal();
  if (!u || u.skinSalva || !s) return;
  api('eu/skin', { skin: s }).then((r) => { u.skin = r.skin; u.skinSalva = true; }).catch(() => {});
}
// conta sem modelos guardados: leva os deste aparelho
function levarModelosLocal() {
  const u = conta.usuario, l = modelosLocal();
  if (!u || (u.modelos && u.modelos.length) || !l.length) return;
  api('eu/modelos', { modelos: l }).then((r) => { u.modelos = r.modelos; }).catch(() => {});
}
function vestirMeusBonecos(s) {
  if (visao.boneco) vestirBoneco(visao.boneco, s);
  if (garagem.meuBoneco) vestirBoneco(garagem.meuBoneco, s);
}
async function salvarSkin(s) {
  try { localStorage.setItem(CHAVE_SKIN, JSON.stringify(s)); } catch {}
  if (conta.token && conta.usuario) {
    try {
      const r = await api('eu/skin', { skin: s });
      conta.usuario.skin = r.skin; conta.usuario.skinSalva = true;
    } catch (e) {
      if (/sess/i.test(e.message)) return 'Entre na conta de novo para salvar o personagem.';
      return 'Não consegui salvar na conta agora: ' + e.message;
    }
  }
  vestirMeusBonecos(s);
  if (sala) sala.enviar({ t: 'skin', s });
  aviso('Personagem salvo!', 1500, 'camiseta');
  return null;
}
// modelos guardados (vários personagens): na conta e neste aparelho
const CHAVE_MODELOS = 'pradaria.modelos';
function modelosLocal() { try { return normalizarModelos(localStorage.getItem(CHAVE_MODELOS)); } catch { return []; } }
function meusModelos() {
  const u = conta.usuario;
  return u && u.modelos && u.modelos.length ? normalizarModelos(u.modelos) : modelosLocal();
}
async function salvarModelos(lista) {
  lista = normalizarModelos(lista);
  try { localStorage.setItem(CHAVE_MODELOS, JSON.stringify(lista)); } catch {}
  if (conta.token && conta.usuario) {
    try { conta.usuario.modelos = (await api('eu/modelos', { modelos: lista })).modelos; }
    catch (e) { conta.usuario.modelos = lista; return 'Guardei neste aparelho, mas não na conta: ' + e.message; }
  }
  return null;
}
const personagem = new Personagem({ som, salvar: salvarSkin, modelos: meusModelos, salvarModelos });
function abrirPersonagem(voltar) {
  som.iniciar();
  personagem.abrir(meuSkin(), voltar);
}
function alternarVisao() {
  if (!jogando) return;
  const m = visao.alternar();
  ajustes.visao = visao.modo; salvarAjustes();
  aviso(garagem.dentro ? m.texto + ' (quando sair do veículo)' : m.texto, 1200, m.icone);
}
$('#bt-visao').addEventListener('click', () => { som.clique(); alternarVisao(); });

// ---------- interface ----------
function mostrarMenu(id) {
  $('#menu').hidden = false;
  for (const c of document.querySelectorAll('#menu > .caixa')) c.hidden = c.id !== id;
}
let timerAviso;
function aviso(txt, ms = 1800, ic = null) {
  const el = $('#aviso');
  el.innerHTML = comIcone(ic, txt); el.classList.add('mostra');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove('mostra'), ms);
}

// mercado e objetivos (ligados ou não nas opções do mundo)
const mercado = new Mercado({
  aviso, som,
  icone: (b, t) => iconeBloco(atlasCanvas, b, t),
  nomeBloco: nomeDe,
  aoMudar: () => mochilaMudou(),
  pausar: () => { if (document.pointerLockElement) document.exitPointerLock(); pausado = true; },
  retomar: () => { pausado = false; },
  outros: () => [...outros.entries()].map(([id, o]) => ({ id, nome: o.nome })),
  mudou: () => garagem.mudouEcon(), // comprou/montou um veículo
  // trabalhadores contratados (negocios.js / trabalho.js)
  pos: () => (jog ? [jog.pos.x, jog.pos.y, jog.pos.z] : null),
  porBlocos: (l) => porBlocosObra(l, false),
  trabalhoMudou: (antes, depois, extra) => negocios.estadoMudou(antes, depois, extra),
  erro: (r) => negocios.respostaObra(false, r),
  abrirNegocios: () => negocios.abrir(),
  // sem internet: o que cai no chão (bloco quebrado: do meio do bloco; lã e caça: de onde o bicho está)
  caiu: (cai, a) => (a.t === 'bloco' ? drops.cair(cai, a.x + 0.5, a.y + 0.3, a.z + 0.5) : drops.cair(cai, a.x, a.y, a.z)),
});
const negocios = new Negocios({
  cena, mercado, som, aviso,
  icone: (b, t) => iconeBloco(atlasCanvas, b, t),
  nomeBloco: nomeDe,
  pausar: () => { if (document.pointerLockElement) document.exitPointerLock(); pausado = true; },
  retomar: () => { pausado = false; },
  mundo: () => mundo, dia: () => tempoDia, sobrev: () => sobrev(), bichos: () => bichos,
  posJog: () => (jog ? [jog.pos.x, jog.pos.y, jog.pos.z] : null),
});
// blocos que o pedreiro colocou (sem internet: daqui mesmo; online: vêm da sala)
function porBlocosObra(l, daRede) {
  if (!mundo) return;
  for (const [x, y, z, b] of l) mundo.definir(x, y, z, b, daRede);
}
$('#bt-negocios').addEventListener('click', () => { som.clique(); negocios.abrir(); });

const qtd = (id) => mercado.qtd(id);

// itens no chão: o que cai ao quebrar, o que os bichos soltam e o que o jogador larga (drops.js)
const drops = new Drops(cena, matBlocos, {
  mochila: mercado, som,
  pegou: (id, n) => { som.pegar(); colocarNaBarra(id); mostrarColeta(id, n); },
  cheio: (id) => aviso(`A mochila está cheia: ${nomeDe(id)} ficou no chão`, 1800, 'mochila'),
});
// larga o que está na mão (Q no computador, botão no tablet); tudo = a pilha inteira
function largarDaMao(tudo) {
  if (!jogando || pausado || !drops.ativo) return;
  const id = barra[slotSel];
  if (!id) { aviso('A mão está vazia', 900, 'mochila'); return; }
  const tem = qtd(id);
  if (!tem) { aviso(`Você não tem ${nomeDe(id)} na mochila`, 1400, 'mochila'); return; }
  if (drops.largar(id, tudo ? Math.min(tem, MAX_LARGAR) : 1, jog)) som.largar();
}

// mecanismos das construções (portas, catavento, moinho, forno, poço)
const mecanismos = new Mecanismos(cena, {
  aviso, som, mercado,
  emoji: (...a) => bichos && bichos.icone(...a),
  // balde de água do poço: vai para a mão (no espaço da Água, se já tiver, ou no escolhido)
  pegarAgua: () => { const ja = barra.indexOf(B.AGUA); if (ja >= 0) slotSel = ja; else barra[slotSel] = B.AGUA; desenharBarra(); },
});

// chat de texto e de voz (só online; o dono liga/desliga nas opções do mundo, na pausa)
const chat = new Chat({
  sala: () => sala, euId: () => euId, pausado: () => pausado, aviso,
  nomeDe: (id) => outros.get(id)?.nome,
  iconeCabeca: (id, ic) => { const o = outros.get(id); if (o && bichos) bichos.icone(ic, o.grupo.position.x, o.grupo.position.y + 2.7, o.grupo.position.z, 1.6, 0.5); },
  mudarOpcoes: async (mud) => {
    if (modo !== 'online' || !mundoAtual || !mundoAtual.dono) return;
    try {
      const { opcoes } = await api('mundos/chat', { codigo: mundoAtual.codigo, ...mud });
      mundoAtual.opcoes = opcoes;
      opcoesMundo.chatTexto = opcoes.chatTexto; opcoesMundo.chatVoz = opcoes.chatVoz;
      chat.aplicarOp({ texto: opcoes.chatTexto, voz: opcoes.chatVoz });
      $('#pausa-opcoes').textContent = 'Neste mundo: ' + resumoOpcoes(opcoesMundo);
    } catch (e) { aviso(e.message, 3000); chat.aplicarOp(chat.op); }
  },
});

// opção "Construção": desligada, ninguém coloca nem quebra blocos (o servidor também não deixa)
const podeConstruir = () => opcoesMundo.construcao !== false;
function desenharBarra() {
  const el = $('#barra');
  el.innerHTML = '';
  $('#bt-largar').hidden = !drops.ativo;
  el.hidden = !podeConstruir();
  if (el.hidden) return;
  const semArma = !armas.empunhando;
  const sv = sobrev();
  if (sv) arrumarMochila();
  barra.forEach((id, i) => {
    const b = document.createElement('button');
    const n = sv && id ? (inv.s[i] ? inv.s[i].n : 0) : 0;
    b.className = 'slot' + (i === slotSel && semArma ? ' sel' : '') + (sv && id && !n ? ' acabou' : '');
    b.setAttribute('aria-label', id ? nomeDe(id) + (sv ? ` (${n})` : '') : 'Mão vazia');
    b.appendChild(iconeBloco(atlasCanvas, id, 48));
    if (!sv && !mercado.podeColocar(id)) { b.classList.add('trancado'); b.title = 'Compre na loja de uma vila'; b.insertAdjacentHTML('beforeend', `<span class="cad">${icone('cadeado')}</span>`); }
    if (sv && id && !ehItem(id) || sv && n > 1) { const q = document.createElement('b'); q.className = 'qtd'; q.textContent = n; b.appendChild(q); }
    if (sv && id && n) barraDesg(b, i, id);
    b.addEventListener('click', () => { slotSel = i; armas.escolher(-1); som.clique(); desenharBarra(); aviso(id ? nomeDe(id) : 'Mão vazia', 900); });
    el.appendChild(b);
  });
  const mais = document.createElement('button');
  mais.className = 'slot mais'; mais.innerHTML = icone(sv ? 'mochila' : 'mais'); mais.setAttribute('aria-label', sv ? 'Mochila e criar' : 'Todos os blocos');
  mais.addEventListener('click', abrirInventario);
  el.appendChild(mais);
}

let abaInv = 'blocos';
const maquinasLigadas = () => opcoesMundo.maquinas !== false;
// ferramentas também no modo criativo (quebram mais rápido)
const FERRAMENTAS_CRIATIVO = [ITEM.PICARETA_PEDRA, ITEM.MACHADO_PEDRA, ITEM.PA_PEDRA, ITEM.BALDE, ISQUEIRO];
function abasDoMundo() {
  if (sobrev()) return [['mochila', 'mochila', inv.w === 3 ? 'Bancada' : 'Mochila'], ['criar', 'livro', 'Receitas']];
  const abas = [['blocos', 'tijolos', 'Blocos']];
  if (opcoesMundo.formas !== false) abas.push(['formas', 'bloco', 'Formas']); // mod Formas redondas
  if (maquinasLigadas()) abas.push(['maquinas', 'engrenagem', 'Engenharia']);
  return abas;
}
// ícone de bloco/item como <img> (guardado: a tela de receitas usa muitos)
const cacheIcones = new Map();
function imgIcone(id, cls = '') {
  let url = cacheIcones.get(id);
  if (!url) { url = iconeBloco(atlasCanvas, id, 48).toDataURL(); cacheIcones.set(id, url); }
  const im = new Image(); im.src = url; im.alt = ''; im.className = cls; im.draggable = false;
  return im;
}
// põe na mão: se já está na barra, só seleciona
function porNaMao(id) {
  const ja = barra.indexOf(id);
  if (ja >= 0) slotSel = ja; else { barra[slotSel] = id; guardarBarraDepois(); }
  armas.escolher(-1);
  desenharBarra();
}
function abrirInventario(aba) {
  if (!jogando || !podeConstruir()) return;
  if ($('#inventario').hidden) som.abrir(); // "fwip" só quando abre (trocar de aba não toca)
  const abas = abasDoMundo();
  if (typeof aba === 'string') abaInv = aba;
  if (!abas.some((a) => a[0] === abaInv)) abaInv = abas[0][0];
  const ab = $('#abas-inv');
  ab.innerHTML = '';
  ab.hidden = abas.length < 2;
  for (const [id, ic, nome] of abas) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.aba = id; b.className = id === abaInv ? 'sel' : '';
    b.innerHTML = icone(ic); b.append(nome);
    b.addEventListener('click', () => { abaInv = id; som.clique(); abrirInventario(); });
    ab.appendChild(b);
  }
  $('#dica-maquinas').hidden = abaInv !== 'maquinas';
  $('#bancada-status').hidden = abaInv !== 'criar';
  $('#inv-titulo').textContent = { maquinas: 'Engenharia', mochila: fornoAberto ? 'Fornalha' : bauAberto ? 'Baú' : inv.w === 3 ? 'Bancada' : 'Mochila', criar: 'Receitas', formas: 'Formas' }[abaInv] || 'Blocos';
  $('#inv-sub').textContent = abaInv === 'criar' ? 'Toque numa receita: ela vai para a grade de criar' : abaInv === 'mochila' ? (toqueInv ? 'Toque para pegar e soltar. Segure o dedo para dividir. Arraste para mover' : 'Clique para pegar e soltar, botão direito divide, Shift move rápido, 1 a 9 troca com a barra') : 'Escolha um bloco para a mão';
  const g = $('#grade');
  const rolagem = g.dataset.aba === abaInv ? g.scrollTop : 0;
  g.innerHTML = ''; g.dataset.aba = abaInv;
  g.classList.toggle('receitas', abaInv === 'criar');
  g.classList.toggle('inv-classico', abaInv === 'mochila');
  if (abaInv === 'criar') desenharReceitas(g);
  else if (abaInv === 'mochila') desenharMochila(g);
  else {
    const lista = abaInv === 'maquinas' ? INVENTARIO_MAQUINAS : abaInv === 'formas' ? INVENTARIO_FORMAS : [...INVENTARIO, ...FERRAMENTAS_CRIATIVO];
    for (const id of lista) {
      const b = document.createElement('button');
      b.title = nomeDe(id);
      b.appendChild(iconeBloco(atlasCanvas, id, 48));
      const trancado = !mercado.podeColocar(id);
      if (trancado) { b.classList.add('trancado'); b.insertAdjacentHTML('beforeend', `<span class="preco">${icone('cadeado')}${mercado.precoDe(id)}</span>`); }
      b.addEventListener('click', () => {
        if (trancado) { som.clique(); aviso(`${nomeDe(id)}: compre na loja de uma vila por ${mercado.precoDe(id)} moedas (toque num aldeão)`, 2800, 'cadeado'); return; }
        porNaMao(id); som.clique(); fecharJanelas(); aviso(nomeDe(id), 900);
      });
      g.appendChild(b);
    }
  }
  g.scrollTop = rolagem;
  if (document.pointerLockElement) document.exitPointerLock();
  $('#inventario').hidden = false;
  pausado = true;
}

// ---------- mochila de espaços (como no clássico; regras em inventario.js) ----------
// 9 da barra + 27 da mochila + segunda mão, grade de criar 2x2 (3x3 na bancada) e o que está preso no cursor
let inv = new Inventario(), invPronto = false, invChave = '', barraVista = new Array(9).fill(0), timerInv = 0;
let moverRapido = false;
const toqueInv = matchMedia('(pointer: coarse)').matches;
const chaveInv = () => 'pradaria.inv.' + (modo === 'online' && mundoAtual ? mundoAtual.codigo + '.' + (conta.usuario ? conta.usuario.nome : '') : 'local');
// a mochila já tem a contagem certa deste mundo: carrega a arrumação guardada e acerta
function prepararInventario() {
  carregarFornos(); fecharFornalha(); carregarBaus(); fecharBau();
  carregarCorpo(); morto = false; pararComer(); $('#morte').hidden = true; document.body.classList.remove('morto');
  inv = new Inventario(); invChave = chaveInv(); invPronto = sobrev();
  barraVista = new Array(9).fill(0); // a barra guardada (na sala ou no mundo) diz o que fica em cada espaço
  if (!invPronto) return;
  try { inv.carregar(JSON.parse(localStorage.getItem(invChave))); } catch {}
  arrumarMochila();
}
function salvarInvDepois() {
  clearTimeout(timerInv);
  timerInv = setTimeout(() => { if (invPronto && invChave === chaveInv()) try { localStorage.setItem(invChave, JSON.stringify(inv.salvar())); } catch {} }, 800);
}
// a contagem mudou (pegou, colocou, criou, a sala corrigiu): a arrumação acompanha
function arrumarMochila() {
  if (!invPronto || !sobrev()) return;
  inv.ajustar(mercado.e.itens, slotSel);
  sincronizarBarra();
  salvarInvDepois();
}
// barra (ids) <-> espaços 0..8. Se outra parte do jogo trocou o que está num espaço da barra
// (pôr na mão, balde que encheu...), a pilha daquilo vem para esse espaço
function sincronizarBarra() {
  let mudou = false;
  for (let i = 0; i < 9; i++) {
    const id = inv.s[i] ? inv.s[i].id : 0;
    // esvaziaram o espaço da barra: a pilha vai para a mochila
    if (!barra[i] && barraVista[i] && inv.s[i]) inv.moverRapido('s', i);
    if (barra[i] && barra[i] !== id && barra[i] !== barraVista[i]) {
      const j = inv.s.findIndex((p, k) => k !== i && k < MAO2 && p && p.id === barra[i]);
      if (j >= 0) { const t = inv.s[i]; inv.s[i] = inv.s[j]; inv.s[j] = t; }
    }
    const novo = inv.s[i] ? inv.s[i].id : 0;
    if (barra[i] !== novo) { barra[i] = novo; mudou = true; }
  }
  barraVista = [...barra];
  if (mudou) guardarBarraDepois();
}
const grandeDe = (l, i) => (l === 's' && i === MAO2 ? 'mao2' : l);
// desgaste da ferramenta no espaço i (receitas.js DURA; e.desg[id]: a primeira é a da mão, depois na ordem dos espaços)
function desgDoEspaco(i, id) {
  if (!DURA[id] || !invPronto) return 0;
  const l = (mercado.e.desg && mercado.e.desg[id]) || [];
  if (!l.some((v) => v > 0)) return 0;
  const ordem = [];
  if (inv.s[slotSel] && inv.s[slotSel].id === id) ordem.push(slotSel);
  inv.s.forEach((p, k) => { if (p && p.id === id && k !== slotSel) ordem.push(k); });
  const n = ordem.indexOf(i);
  return n >= 0 ? l[n] || 0 : 0;
}
// barrinha de uso embaixo da ferramenta (verde -> vermelho), como no clássico
function barraDesg(el, i, id) {
  const d = desgDoEspaco(i, id);
  if (!d) return;
  const resta = Math.max(0, 1 - d / DURA[id]);
  const b = document.createElement('span'); b.className = 'desg';
  b.innerHTML = `<i style="width:${Math.max(4, Math.round(resta * 100))}%;background:hsl(${Math.round(resta * 120)},80%,45%)"></i>`;
  b.title = `Ainda aguenta ${DURA[id] - d} usos`;
  el.appendChild(b);
}
function slotInv(l, i, p, cls = '') {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'slot-inv ' + cls; b.dataset.l = l; b.dataset.i = i;
  if (p) {
    b.appendChild(imgIcone(p.id)); b.title = nomeDe(p.id);
    if (p.n > 1) { const q = document.createElement('b'); q.className = 'qtd'; q.textContent = p.n; b.appendChild(q); }
    if (l === 's') barraDesg(b, i, p.id);
    b.setAttribute('aria-label', `${nomeDe(p.id)} (${p.n})`);
  } else b.setAttribute('aria-label', grandeDe(l, i) === 'mao2' ? 'Segunda mão vazia' : 'Vazio');
  return b;
}
function receitaNaGrade() { return receitaDaGrade(inv.gradeIds(), inv.w, receitasDoMundo(opcoesMundo)); }
function desenharMochila(g) {
  arrumarMochila();
  g.innerHTML = '';
  const cima = document.createElement('div'); cima.className = 'inv-cima';
  // grade de criar e o resultado
  const criar = document.createElement('div'); criar.className = 'inv-criar';
  const gr = document.createElement('div'); gr.className = 'grade-criar w' + inv.w;
  for (let i = 0; i < inv.w * inv.w; i++) gr.appendChild(slotInv('g', i, inv.g[i]));
  const r = receitaNaGrade();
  const seta = document.createElement('span'); seta.className = 'seta-criar'; seta.innerHTML = icone('seta');
  const saida = slotInv('o', 0, r ? { id: r.faz[0], n: r.faz[1] } : null, 'saida' + (r ? ' pronta' : ''));
  saida.id = 'inv-saida';
  if (r) saida.setAttribute('aria-label', `Criar ${nomeDe(r.faz[0])}`);
  criar.append(gr, seta, saida);
  const forno = fornoAberto ? painelForno() : bauAberto ? painelBau() : null;
  const lado = document.createElement('div'); lado.className = 'inv-lado';
  const m2 = document.createElement('label'); m2.className = 'inv-mao2';
  m2.append(slotInv('s', MAO2, inv.s[MAO2], 'mao2'), Object.assign(document.createElement('small'), { textContent: 'Segunda mão' }));
  const rap = document.createElement('button'); rap.type = 'button'; rap.id = 'inv-rapido'; rap.className = 'bt-mini' + (moverRapido ? ' ligado' : '');
  rap.setAttribute('aria-pressed', moverRapido); rap.innerHTML = icone('raio'); rap.append(' Mover rápido');
  rap.addEventListener('click', () => { moverRapido = !moverRapido; som.clique(); desenharMochila(g); });
  lado.append(m2, rap);
  cima.append(forno || criar, lado);
  const moch = document.createElement('div'); moch.className = 'inv-mochila';
  for (let i = 9; i < 36; i++) moch.appendChild(slotInv('s', i, inv.s[i]));
  const bar = document.createElement('div'); bar.className = 'inv-barra';
  for (let i = 0; i < 9; i++) bar.appendChild(slotInv('s', i, inv.s[i], i === slotSel ? 'sel' : ''));
  g.append(cima, moch, bar);
  if (fornoAberto) desenharForno();
  if (inv.extra.length) {
    const ex = document.createElement('div'); ex.className = 'inv-extra';
    const t = document.createElement('p'); t.className = 'sub'; t.textContent = 'Sobrando (a mochila passou do limite): use ou largue para caber';
    ex.appendChild(t);
    inv.extra.forEach((p, i) => ex.appendChild(slotInv('x', i, p)));
    g.appendChild(ex);
  }
  desenharCursor();
}
// o que está preso no cursor anda junto com o dedo/mouse
let cursorXY = [0, 0];
function desenharCursor() {
  let el = $('#inv-cursor');
  if (!el) { el = document.createElement('div'); el.id = 'inv-cursor'; document.body.appendChild(el); }
  el.innerHTML = '';
  const c = inv.cursor;
  el.hidden = !c || $('#inventario').hidden;
  if (!c) return;
  el.appendChild(imgIcone(c.id));
  if (c.n > 1) { const q = document.createElement('b'); q.className = 'qtd'; q.textContent = c.n; el.appendChild(q); }
  el.style.transform = `translate(${cursorXY[0] - 24}px, ${cursorXY[1] - 24}px)`;
}
function invMudou() { sincronizarBarra(); salvarInvDepois(); desenharMochila($('#grade')); desenharBarra(); }
// clicou no resultado: cria uma vez (vai para o cursor); com shift (ou mover rápido), o máximo, direto na mochila
function pegarResultado(tudo) {
  const r = receitaNaGrade();
  if (!r) return;
  const temBancada = inv.w === 3 && bancadaPerto();
  if (r.bancada && !temBancada) { aviso('Precisa estar perto de uma Bancada', 2000, 'martelo'); return; }
  const itens = mercado.e.itens;
  if (!podeCriar(itens, r, temBancada, true)) { aviso('A mochila está cheia! Largue ou use alguma coisa', 2200, 'mochila'); return; }
  const [id, n] = r.faz;
  if (tudo) {
    // quantas vezes: o que a grade tem (o menor espaço) e o que cabe
    let vezes = Math.min(...inv.gradeIds().map((x, i) => (x ? inv.g[i].n : Infinity)));
    const c = { ...itens }; let k = 0;
    while (k < vezes && podeCriar(c, r, temBancada, true)) { for (const [u, q] of r.usa) { c[u] -= q; if (!c[u]) delete c[u]; } c[id] = (c[id] || 0) + n; k++; }
    if (!k) return;
    for (let j = 0; j < k; j++) inv.gastarGrade();
    mercado.criar(r.id, temBancada, k);
    aviso(`Criou ${k * n} ${nomeDe(id)}!`, 1400, 'martelo');
  } else {
    const c = inv.cursor;
    if (c && (c.id !== id || c.n + n > pilhaDe(id))) return; // a mão do cursor está ocupada
    inv.gastarGrade();
    inv.cursor = c ? { id, n: c.n + n } : { id, n };
    mercado.criar(r.id, temBancada, 1);
  }
  som.criar();
  invMudou();
}
// ações de um espaço (clique, clique direito, shift, arrastar)
function acaoSlot(l, i, direito, shift) {
  som.iniciar();
  if (l === 'o') { pegarResultado(shift || moverRapido); return; }
  if (l === 'f') { acaoForno(i, direito); return; }
  if (l === 'b') { acaoBau(i, direito); return; }
  if (bauAberto && (shift || moverRapido) && !inv.cursor && !direito && l === 's') { moverParaBau(i); return; }
  if (fornoAberto && (shift || moverRapido) && !inv.cursor && !direito && moverParaForno(l, i)) { invMudou(); return; }
  if (direito) inv.clicarDireito(l, i);
  else if ((shift || moverRapido) && !inv.cursor) inv.moverRapido(l, i);
  else inv.clicar(l, i);
  som.clique();
  invMudou();
}
// largou fora da janela: cai no chão na frente do jogador (todo ou 1)
function largarCursor(um) {
  const c = inv.cursor;
  if (!c) return;
  if (!drops.ativo) { aviso('Neste mundo não dá para largar coisas no chão', 1800, 'mochila'); return; }
  const n = um ? 1 : Math.min(c.n, MAX_LARGAR);
  // tira do cursor antes: a mochila vai contar a menos e a arrumação já bate
  c.n -= n; if (!c.n) inv.cursor = null;
  if (drops.largar(c.id, n, jog)) som.largar();
  invMudou();
}
// toque e mouse juntos (pointer events): toque = clique, segurar = clique direito, arrastar move
(() => {
  const g = $('#grade');
  let ap = null; // { l, i, direito, x, y, t, tinha, arrastando, passou: [[l,i]], segurou }
  const alvo = (x, y) => { const el = document.elementFromPoint(x, y); const b = el && el.closest && el.closest('.slot-inv'); return b && g.contains(b) ? [b.dataset.l, +b.dataset.i] : null; };
  g.addEventListener('contextmenu', (e) => { if (g.classList.contains('inv-classico')) e.preventDefault(); });
  g.addEventListener('pointerdown', (e) => {
    if (!g.classList.contains('inv-classico')) return;
    const b = e.target.closest('.slot-inv');
    if (!b) return;
    e.preventDefault();
    cursorXY = [e.clientX, e.clientY];
    const l = b.dataset.l, i = +b.dataset.i;
    ap = { l, i, direito: e.button === 2, x: e.clientX, y: e.clientY, tinha: !!inv.cursor, arrastando: false, passou: [[l, i]], segurou: false, shift: e.shiftKey };
    if (e.pointerType !== 'mouse' && l !== 'o') {
      const este = ap;
      este.timer = setTimeout(() => { if (ap === este && !este.arrastando) { este.segurou = true; acaoSlot(l, i, true, false); } }, 450);
    }
  });
  addEventListener('pointermove', (e) => {
    if ($('#inventario').hidden) return;
    cursorXY = [e.clientX, e.clientY];
    const el = $('#inv-cursor');
    if (el && !el.hidden) el.style.transform = `translate(${e.clientX - 24}px, ${e.clientY - 24}px)`;
    if (!ap || ap.segurou) return;
    if (!ap.arrastando && Math.hypot(e.clientX - ap.x, e.clientY - ap.y) > 10) {
      ap.arrastando = true; clearTimeout(ap.timer);
      // começou a arrastar uma pilha (sem nada preso): pega ela para soltar onde largar o dedo
      if (!ap.tinha && ap.l !== 'o' && ap.l !== 'f' && ap.l !== 'b') { if (ap.direito) inv.clicarDireito(ap.l, ap.i); else inv.clicar(ap.l, ap.i); invMudou(); }
    }
    if (ap.arrastando && ap.tinha) { const t = alvo(e.clientX, e.clientY); if (t && t[0] !== 'o' && t[0] !== 'f' && t[0] !== 'b' && !ap.passou.some(([a, b]) => a === t[0] && b === t[1])) ap.passou.push(t); }
  });
  addEventListener('pointerup', (e) => {
    if (!ap) return;
    const a = ap; ap = null; clearTimeout(a.timer);
    if (a.segurou) return;
    if (!a.arrastando) { acaoSlot(a.l, a.i, a.direito, a.shift || e.shiftKey); return; }
    const t = alvo(e.clientX, e.clientY);
    if (a.tinha) {
      // arrastou com algo preso por vários espaços: reparte (botão direito: 1 em cada)
      if (a.passou.length > 1) { inv.espalhar(a.passou, a.direito); som.clique(); invMudou(); }
      else if (t) acaoSlot(t[0], t[1], a.direito, false);
      return;
    }
    // arrastar e soltar uma pilha
    if (a.l === 'f') { acaoSlot('f', a.i, false, false); return; } // arrastou da fornalha: tira para a mochila
    if (a.l === 'b') { acaoSlot('b', a.i, false, false); return; } // arrastou do baú: tira para a mochila
    if (t && t[0] === 'b') { if (inv.cursor) acaoBau(t[1], false); if (inv.cursor) { inv.clicar(a.l, a.i); invMudou(); } return; } // soltou no baú
    if (t && t[0] === 'f') { if (inv.cursor) acaoForno(t[1], false); if (inv.cursor && a.l !== 'f') { inv.clicar(a.l, a.i); invMudou(); } } // soltou na fornalha
    else if (t && t[0] !== 'o') { if (!(t[0] === a.l && t[1] === a.i) || inv.cursor) { inv.clicar(t[0], t[1]); som.clique(); invMudou(); } }
    else if (!t && !e.target.closest('#inventario .caixa')) largarCursor(false);
    else if (inv.cursor) { inv.clicar(a.l, a.i); invMudou(); } // soltou em lugar nenhum dentro da janela: volta
  });
  // clique fora da janela com algo preso: larga no chão (botão direito: 1)
  $('#inventario').addEventListener('pointerdown', (e) => {
    if (!g.classList.contains('inv-classico') || e.target.closest('.caixa') || !inv.cursor) return;
    e.preventDefault(); e.stopPropagation();
    largarCursor(e.button === 2);
  });
  $('#inventario').addEventListener('contextmenu', (e) => { if (g.classList.contains('inv-classico')) e.preventDefault(); });
  // teclas 1..9 em cima de um espaço: troca com a barra
  addEventListener('keydown', (e) => {
    if ($('#inventario').hidden || !g.classList.contains('inv-classico') || !/^Digit[1-9]$/.test(e.code)) return;
    const t = alvo(cursorXY[0], cursorXY[1]);
    if (!t || t[0] === 'o' || t[0] === 'f' || t[0] === 'b') return;
    e.preventDefault(); e.stopImmediatePropagation();
    inv.trocarComBarra(t[0], t[1], +e.code.slice(5) - 1); som.clique(); invMudou();
  }, true);
})();
// fechou o inventário: grade e cursor voltam para a mochila
function guardarGrade() {
  fecharFornalha(); fecharBau();
  if (!invPronto) return;
  if (inv.cursor || inv.g.some(Boolean)) { inv.devolver(); sincronizarBarra(); salvarInvDepois(); }
  inv.mudarGrade(2);
  desenharCursor();
}

// ---------- fornalha (regras em fornalha-regras.js) ----------
// Sem internet o estado fica guardado no aparelho; online fica na sala (todos usam a mesma fornalha) e
// o aparelho só mostra (e mexe na hora, a sala confere). A conta do tempo é feita na hora de olhar.
let fornoAberto = null, timerForno = 0;
const fornos = new Map(); // "x,y,z" -> estado
const chaveFornos = () => chaveInv().replace('pradaria.inv.', 'pradaria.fornos.');
function carregarFornos() {
  fornos.clear();
  if (sala) return;
  try { const o = JSON.parse(localStorage.getItem(chaveFornos()) || '{}'); for (const k in o) fornos.set(k, normalizarForno(o[k])); } catch {}
}
function salvarFornos() {
  if (sala) return;
  const o = {};
  for (const [k, f] of fornos) if (conteudo(f).length || f.q > 0) o[k] = f;
  try { localStorage.setItem(chaveFornos(), JSON.stringify(o)); } catch {}
}
const fornoK = (x, y, z) => x + ',' + y + ',' + z;
function abrirFornalha(x, y, z) {
  fornoAberto = { x, y, z, k: fornoK(x, y, z) };
  if (sala) sala.enviar({ t: 'forno-ver', x, y, z });
  inv.mudarGrade(2);
  abrirInventario('mochila');
  clearInterval(timerForno);
  timerForno = setInterval(() => { if (fornoAberto && !$('#inventario').hidden) desenharForno(); }, 250);
}
function fecharFornalha() { fornoAberto = null; clearInterval(timerForno); }
// o estado agora (com o tempo que passou), sem mexer no guardado
function fornoVista() {
  const f = fornos.get(fornoAberto.k);
  if (!f) return fornoNovo();
  const v = { ...f, e: f.e && [...f.e], c: f.c && [...f.c], s: f.s && [...f.s] };
  avancar(v, Date.now());
  return v;
}
function fornoDaSala(m) {
  const k = fornoK(m.x, m.y, m.z);
  if (m.f) fornos.set(k, fornoDaRede(m.f)); else fornos.delete(k);
  if (fornoAberto && fornoAberto.k === k && !$('#inventario').hidden) {
    if (!m.f && mundo && mundo.bloco(m.x, m.y, m.z) !== FORNALHA) { fecharJanelas(); return; }
    desenharForno();
  }
}
// mexe na fornalha aberta: a mochila e a fornalha mudam juntas (economia.js forno-por / forno-tirar)
function mexerForno(a) {
  const { x, y, z, k } = fornoAberto;
  const velho = fornos.get(k) || fornoNovo();
  const f = { ...velho, e: velho.e && [...velho.e], c: velho.c && [...velho.c], s: velho.s && [...velho.s] };
  const r = mercado.mexer({ ...a, f, agora: Date.now() });
  if (!r) return null;
  fornos.set(k, f);
  if (sala) sala.enviar({ t: a.t, x, y, z, k: a.k, id: a.id, n: a.n });
  else salvarFornos();
  return r;
}
// clicou num espaço da fornalha (0 = o que assa, 1 = combustível, 2 = pronto)
function acaoForno(i, direito) {
  const k = 'ecs'[i], c = inv.cursor;
  if (c && k !== 's') {
    const r = mexerForno({ t: 'forno-por', k, id: c.id, n: direito ? 1 : c.n });
    if (!r) return;
    c.n -= r.foi; if (c.n <= 0) inv.cursor = null;
    som.clique();
  } else if (!c) {
    const r = mexerForno({ t: 'forno-tirar', k });
    if (!r) return;
    if (k === 's') som.criar(); else som.clique();
  } else return;
  invMudou();
}
// Shift (ou mover rápido) numa pilha da mochila com a fornalha aberta: vai para a fornalha
function moverParaForno(l, i) {
  const p = l === 's' ? inv.s[i] : null;
  if (!p) return false;
  const k = assavel(p.id) ? 'e' : queima(p.id) ? 'c' : null;
  if (!k) return false;
  const r = mexerForno({ t: 'forno-por', k, id: p.id, n: p.n });
  if (r) som.clique();
  return true;
}
function desenharForno() {
  const el = $('#forno-painel');
  if (!el || !fornoAberto) return;
  const f = fornoVista();
  const chave = JSON.stringify([f.e, f.c, f.s]);
  if (el.dataset.chave !== chave) {
    el.dataset.chave = chave;
    for (const [i, k] of [[0, 'e'], [1, 'c'], [2, 's']]) {
      const novo = slotInv('f', i, f[k] ? { id: f[k][0], n: f[k][1] } : null, 'forno-' + k);
      if (!f[k]) novo.setAttribute('aria-label', ['O que vai assar (minério, areia, carne...)', 'Combustível (carvão, madeira)', 'Pronto'][i]);
      el.querySelector('.forno-' + k).replaceWith(novo);
    }
  }
  el.querySelector('.chama i').style.height = (f.Q > 0 ? Math.round((f.q / f.Q) * 100) : 0) + '%';
  el.querySelector('.forno-seta i').style.width = Math.round((f.p / TEMPO_FORNO) * 100) + '%';
  el.classList.toggle('acesa', f.q > 0);
}
// a fornalha saiu do lugar: sem internet, o que tinha dentro cai no chão (online a sala faz isso)
function fornalhaSumiu(x, y, z) {
  const k = fornoK(x, y, z);
  if (fornoAberto && fornoAberto.k === k && !$('#inventario').hidden) fecharJanelas();
  if (sala) return;
  const f = fornos.get(k);
  fornos.delete(k);
  if (!f) return;
  avancar(f, Date.now());
  for (const [id, n] of conteudo(f)) drops.novoLocal(id, n, x + 0.5, y + 0.4, z + 0.5);
  salvarFornos();
}
function painelForno() {
  const el = document.createElement('div'); el.className = 'inv-criar forno'; el.id = 'forno-painel';
  const col = document.createElement('div'); col.className = 'forno-col';
  const chama = document.createElement('span'); chama.className = 'chama'; chama.innerHTML = icone('fogo') + '<i></i>';
  col.append(Object.assign(document.createElement('span'), { className: 'forno-e' }), chama, Object.assign(document.createElement('span'), { className: 'forno-c' }));
  const seta = document.createElement('span'); seta.className = 'seta-criar forno-seta'; seta.innerHTML = icone('seta') + '<i></i>';
  el.append(col, seta, Object.assign(document.createElement('span'), { className: 'forno-s' }));
  return el;
}

// ---------- baú (regras em bau-regras.js) ----------
// Como a fornalha: sem internet o que tem dentro fica guardado no aparelho; online fica na sala (todos usam o
// mesmo baú) e o aparelho mexe na hora, a sala confere e manda para todo mundo.
let bauAberto = null;
const baus = new Map(); // "x,y,z" -> 27 espaços
const chaveBaus = () => chaveInv().replace('pradaria.inv.', 'pradaria.baus.');
function carregarBaus() {
  baus.clear();
  if (sala) return;
  try { const o = JSON.parse(localStorage.getItem(chaveBaus()) || '{}'); for (const k in o) baus.set(k, normalizarBau(o[k])); } catch {}
}
function salvarBaus() {
  if (sala) return;
  const o = {};
  for (const [k, b] of baus) if (!vazioBau(b)) o[k] = b;
  try { localStorage.setItem(chaveBaus(), JSON.stringify(o)); } catch {}
}
function abrirBau(x, y, z) {
  fecharFornalha();
  bauAberto = { x, y, z, k: fornoK(x, y, z) };
  if (sala) sala.enviar({ t: 'bau-ver', x, y, z });
  inv.mudarGrade(2);
  abrirInventario('mochila');
}
function fecharBau() { bauAberto = null; }
function bauDaSala(m) {
  const k = fornoK(m.x, m.y, m.z);
  if (m.b) baus.set(k, normalizarBau(m.b)); else baus.delete(k);
  if (bauAberto && bauAberto.k === k && !$('#inventario').hidden) {
    if (!m.b && mundo && mundo.bloco(m.x, m.y, m.z) !== BAU) { fecharJanelas(); return; }
    desenharMochila($('#grade'));
  }
}
// mexe no baú aberto: a mochila e o baú mudam juntos (economia.js bau-por / bau-tirar)
function mexerBau(a) {
  const { x, y, z, k } = bauAberto;
  const b = (baus.get(k) || bauNovo()).map((p) => p && [...p]);
  const r = mercado.mexer({ ...a, b });
  if (!r) return null;
  baus.set(k, b);
  if (sala) sala.enviar({ t: a.t, x, y, z, k: a.k, id: a.id, n: a.n });
  else salvarBaus();
  return r;
}
// tocou num espaço do baú: com algo preso no dedo, põe ali (botão direito: 1); sem nada, tira para a mochila
function acaoBau(i, direito) {
  const c = inv.cursor;
  if (c) {
    const r = mexerBau({ t: 'bau-por', k: i, id: c.id, n: direito ? 1 : c.n });
    if (!r) return;
    c.n -= r.foi; if (c.n <= 0) inv.cursor = null;
  } else if (!mexerBau({ t: 'bau-tirar', k: i, n: direito ? 1 : 64 })) return;
  som.clique();
  invMudou();
}
// Shift (ou mover rápido) numa pilha da mochila com o baú aberto: vai a pilha inteira para o baú
function moverParaBau(i) {
  const p = inv.s[i];
  if (!p) return;
  if (mexerBau({ t: 'bau-por', k: -1, id: p.id, n: p.n })) som.clique();
  invMudou();
}
function painelBau() {
  const el = document.createElement('div'); el.className = 'inv-bau'; el.id = 'bau-painel';
  const b = baus.get(bauAberto.k) || bauNovo();
  for (let i = 0; i < ESPACOS_BAU; i++) {
    const p = b[i], s = slotInv('b', i, p ? { id: p[0], n: p[1] } : null);
    if (p && p[3] && DURA[p[0]]) { // a ferramenta guardada mostra o desgaste dela
      const resta = Math.max(0, 1 - p[3] / DURA[p[0]]), d = document.createElement('span'); d.className = 'desg';
      d.innerHTML = `<i style="width:${Math.max(4, Math.round(resta * 100))}%;background:hsl(${Math.round(resta * 120)},80%,45%)"></i>`;
      s.appendChild(d);
    }
    el.appendChild(s);
  }
  return el;
}
// o baú saiu do lugar: sem internet, o que tinha dentro cai no chão (online a sala faz isso)
function bauSumiu(x, y, z) {
  const k = fornoK(x, y, z);
  if (bauAberto && bauAberto.k === k && !$('#inventario').hidden) fecharJanelas();
  if (sala) return;
  const b = baus.get(k);
  baus.delete(k);
  if (!b) return;
  for (const [id, n, c, d] of conteudoBau(b)) drops.novoLocal(id, n, x + 0.5, y + 0.4, z + 0.5, null, '', c, d ? [d] : null);
  salvarBaus();
}

// bancada perto do jogador (até 4 blocos)
function bancadaPerto() {
  if (!jog || !mundo) return false;
  const px = Math.floor(jog.pos.x), py = Math.floor(jog.pos.y), pz = Math.floor(jog.pos.z);
  for (let dy = -2; dy <= 3; dy++) for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) {
    if (mundo.bloco(px + dx, py + dy, pz + dz) === B.BANCADA) return true;
  }
  return false;
}

// livro de receitas: cada receita é um botão grande; tocar cria uma vez
function desenharReceitas(g) {
  const temBancada = bancadaPerto();
  const st = $('#bancada-status');
  st.className = 'sub bancada-status ' + (temBancada ? 'ok' : 'longe');
  st.innerHTML = temBancada ? comIcone('martelo', 'Você está perto de uma Bancada: dá para criar tudo!')
    : comIcone('martelo', 'Sem Bancada por perto: só dá para criar o que não precisa dela. Crie uma Bancada com 4 Tábuas e coloque no chão.');
  const lista = receitasDoMundo(opcoesMundo);
  for (const grp of GRUPOS) {
    const rs = lista.filter((r) => r.grupo === grp.id);
    if (!rs.length) continue;
    const h = document.createElement('h3');
    h.className = 'grupo-receitas'; h.innerHTML = icone(grp.icone); h.append(grp.nome);
    g.appendChild(h);
    for (const r of rs) g.appendChild(cartaoReceita(r, temBancada));
  }
}
function cartaoReceita(r, temBancada) {
  const pode = podeCriar(mercado.e.itens, r, temBancada);
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'receita ' + (pode ? 'pode' : 'falta');
  b.dataset.receita = r.id;
  const res = document.createElement('span'); res.className = 'res';
  res.appendChild(imgIcone(r.faz[0]));
  if (r.faz[1] > 1) { const q = document.createElement('b'); q.className = 'qtd'; q.textContent = r.faz[1]; res.appendChild(q); }
  const info = document.createElement('span'); info.className = 'info';
  const nome = document.createElement('b'); nome.textContent = nomeDe(r.faz[0]);
  const ings = document.createElement('span'); ings.className = 'ings';
  for (const [id, n] of r.usa) {
    const tem = qtd(id);
    const ing = document.createElement('span');
    ing.className = 'ing ' + (tem >= n ? 'ok' : 'nao');
    ing.title = nomeDe(id);
    ing.appendChild(imgIcone(id));
    const t = document.createElement('small'); t.textContent = `${Math.min(tem, 999)}/${n}`; ing.appendChild(t);
    ings.appendChild(ing);
  }
  if (r.bancada) {
    const bc = document.createElement('span');
    bc.className = 'ing bancada ' + (temBancada ? 'ok' : 'nao');
    bc.title = 'Precisa de Bancada perto';
    bc.innerHTML = icone('martelo');
    ings.appendChild(bc);
  }
  info.append(nome, ings);
  b.append(res, info);
  b.addEventListener('click', (e) => tocarReceita(r, e.shiftKey));
  return b;
}
function tocarReceita(r, tudo) {
  som.iniciar();
  const temBancada = bancadaPerto();
  // livro de receitas (como no clássico): põe os ingredientes na grade de criar; o resultado sai pela grade
  if (invPronto) {
    if (faltaBancada(r, temBancada)) { som.clique(); aviso('Precisa de uma Bancada perto! Crie uma com 4 Tábuas e coloque no chão.', 3200, 'martelo'); abrirInventario('criar'); return; }
    const w = r.bancada || !cabeNaGrade(r, 2) ? 3 : inv.w;
    inv.devolver(); // o que estava preso no cursor volta para a mochila
    inv.mudarGrade(w);
    if (!inv.encher(arrumar(r, w), tudo ? 64 : 1)) {
      som.clique();
      const falta = r.usa.filter(([id, n]) => qtd(id) < n).map(([id, n]) => `${n - qtd(id)} ${nomeDe(id)}`);
      aviso(falta.length ? 'Falta: ' + falta.join(', ') : 'Não deu para arrumar a grade', 2400, 'mochila');
      abrirInventario('criar');
      return;
    }
    som.clique(); sincronizarBarra(); salvarInvDepois(); desenharBarra();
    abrirInventario('mochila');
    return;
  }
  if (podeCriar(mercado.e.itens, r, temBancada)) {
    mercado.criar(r.id, temBancada);
    som.criar();
    colocarNaBarra(r.faz[0]);
    aviso(`Criou ${r.faz[1] > 1 ? r.faz[1] + ' ' : ''}${nomeDe(r.faz[0])}!`, 1400, 'martelo');
  } else if (faltaBancada(r, temBancada)) {
    som.clique();
    aviso('Precisa de uma Bancada perto! Crie uma com 4 Tábuas e coloque no chão.', 3200, 'martelo');
  } else {
    som.clique();
    const falta = r.usa.filter(([id, n]) => qtd(id) < n).map(([id, n]) => `${n - qtd(id)} ${nomeDe(id)}`);
    aviso(falta.length ? 'Falta: ' + falta.join(', ') : 'A mochila está cheia disso', 2400, 'mochila');
  }
  abrirInventario('criar');
}

// ---------- coletar ----------
// item novo vai para a barra se tiver lugar (vazio ou que acabou)
function colocarNaBarra(id) {
  if (!sobrev() || barra.includes(id)) return;
  let i = barra.indexOf(0);
  if (i < 0) i = barra.findIndex((x) => qtd(x) <= 0);
  if (i >= 0) { barra[i] = id; guardarBarraDepois(); }
}
let redesenharBarra = false;
function mochilaMudou() {
  if (redesenharBarra) return;
  redesenharBarra = true;
  requestAnimationFrame(() => {
    redesenharBarra = false;
    if (!jogando) return;
    desenharBarra();
    if (!$('#inventario').hidden && (abaInv === 'criar' || abaInv === 'mochila')) abrirInventario();
  });
}
// a barra de baixo fica guardada (online, na sala; sem internet, junto com o mundo)
let timerBarra = 0, barraEnviada = '';
function guardarBarraDepois() { clearTimeout(timerBarra); timerBarra = setTimeout(enviarBarra, 1500); }
function enviarBarra() {
  clearTimeout(timerBarra);
  const t = JSON.stringify(barra);
  if (sala && sobrev() && t !== barraEnviada) { barraEnviada = t; sala.enviar({ t: 'barra', barra }); }
}
// mostra "+1 Terra" no canto (os mais recentes por cima)
const coletados = new Map();
function mostrarColeta(id, n) {
  const el = $('#coleta');
  let c = coletados.get(id);
  if (c && c.el.isConnected) { c.n += n; clearTimeout(c.t); el.prepend(c.el); }
  else {
    const d = document.createElement('div'); d.className = 'pego';
    d.append(imgIcone(id), document.createElement('span'));
    el.prepend(d);
    c = { el: d, n };
    coletados.set(id, c);
  }
  c.el.querySelector('span').textContent = `+${c.n} ${nomeDe(id)}`;
  c.el.classList.remove('some');
  c.t = setTimeout(() => { c.el.classList.add('some'); setTimeout(() => { c.el.remove(); coletados.delete(id); }, 400); }, 1600);
  while (el.childElementCount > 4) el.lastElementChild.remove();
}
// depois de quebrar: o que tinha ali cai no chão (economia.js diz o quê: mercado ui.caiu chama drops.cair;
// online quem põe no chão é a sala)
// ---------- experiência (xp-regras.js): barra verde em cima da barra de itens, com o nível no meio ----------
let xpVisto = -1, nivelVisto = -1;
function desenharXp() {
  const el = $('#xp');
  const liga = jogando && sobrev() && !!mercado.op.fome && podeConstruir();
  if (el.hidden === liga) { el.hidden = !liga; document.body.classList.toggle('com-xp', liga); xpVisto = -1; }
  if (!liga) return;
  const xp = mercado.e.xp | 0;
  if (xp === xpVisto) return;
  const { nivel, frac } = nivelDe(xp);
  el.querySelector('i').style.width = (frac * 100).toFixed(1) + '%';
  const b = el.querySelector('b');
  b.textContent = nivel; b.hidden = nivel === 0;
  el.setAttribute('aria-label', `Experiência: nível ${nivel}`);
  if (xpVisto >= 0 && xp > xpVisto) {
    if (nivel > nivelVisto) { som.tom(660, 0.12, { tipo: 'triangle', vol: 0.2, ate: 990 }); aviso(`Subiu para o nível ${nivel}!`, 1600, 'estrela'); }
    else som.tom(1250 + Math.random() * 250, 0.05, { tipo: 'sine', vol: 0.12 }); // plim de experiência
  }
  xpVisto = xp; nivelVisto = nivel;
}
$('#bt-morte-sair').addEventListener('click', () => { som.clique(); morto = false; $('#morte').hidden = true; document.body.classList.remove('morto'); sairDoMundo(); });

// jogo clássico: quebrou pedra/minério sem a picareta certa (não caiu nada): diz qual precisa
let avisouPicareta = 0;
function mostrarQueCaiu(b) {
  if (!sobrev() || !mercado.op.fome) return;
  const n = nivelFalta(b, maoQuebrando);
  if (!n || tempoTotal - avisouPicareta < 3) return;
  avisouPicareta = tempoTotal;
  aviso(`Não caiu nada: ${nomeDe(baseDe(b))} só sai com picareta ${NOME_NIVEL[n]} ou melhor`, 2600, 'martelo');
}
// carinho na ovelha dá lã (uma vez a cada minuto por ovelha)
const ondeBicho = (b) => ({ x: Math.round(b.x * 100) / 100, y: Math.round((b.y + 0.9) * 100) / 100, z: Math.round(b.z * 100) / 100 });
function laDaOvelha(bicho) {
  if (!sobrev() || bicho.especie !== 'ovelha') return;
  const agora = performance.now();
  if (bicho.laEm && agora - bicho.laEm < 60000) return;
  bicho.laEm = agora;
  setTimeout(() => { if (jogando) mercado.enviar({ t: 'ev', e: 'la', ...ondeBicho(bicho) }, true); }, 400);
}

function abrirPausa() {
  if (document.pointerLockElement) document.exitPointerLock();
  $('#aj-dist').value = ajustes.dist; $('#aj-qual').value = ajustes.qual; preencherGraficos(); $('#aj-sens').value = ajustes.sens;
  $('#aj-som').checked = ajustes.som; $('#aj-vol-musica').value = ajustes.volMusica; $('#aj-vol-efeitos').value = ajustes.volEfeitos; $('#aj-vol-voz').value = ajustes.volVoz; $('#aj-fps').checked = ajustes.fps; $('#aj-minimapa').checked = ajustes.minimapa;
  // o código só aparece para o dono (é ele quem decide quem entra)
  $('#pausa-mundo').textContent = modo === 'online' ? `Mundo: ${mundoAtual.nome}` + (mundoAtual.dono ? ` · código ${mundoAtual.codigo}` : '') : 'Mundo sem internet (salvo neste aparelho)';
  preencherDono(modo === 'online' ? mundoAtual : null, () => abrirPausa());
  $('#pausa-chat').hidden = !(modo === 'online' && mundoAtual && mundoAtual.dono);
  $('#pausa-opcoes').textContent = 'Neste mundo: ' + resumoOpcoes(opcoesMundo);
  // editar o mundo: só o dono (no mundo sem internet, quem joga é o dono)
  $('#bt-editar-mundo').hidden = !(modo === 'local' || (mundoAtual && mundoAtual.dono));
  $('#bt-chamar-amigos').hidden = !(modo === 'online' && mundoAtual && mundoAtual.dono && conta.token);
  if ($('#pausa').hidden) som.abrir();
  $('#pausa').hidden = false;
  pausado = true;
}
function fecharJanelas() {
  if (jogando && (!$('#inventario').hidden || !$('#pausa').hidden || !$('#mapa').hidden || !$('#garagem').hidden)) som.fechar();
  if (!$('#inventario').hidden) { $('#inventario').hidden = true; guardarGrade(); }
  $('#editar-mundo').hidden = true;
  $('#inventario').hidden = true; $('#pausa').hidden = true; $('#mapa').hidden = true; $('#mapa-ilha').hidden = true; $('#garagem').hidden = true; $('#missoes').hidden = true;
  if (cmd) cmd.fechar();
  mercado.fechar(true);
  negocios.fechar(true);
  pausado = false;
}
document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharJanelas));
$('#bt-menu').addEventListener('click', abrirPausa);
$('#bt-editar-mundo').addEventListener('click', () => {
  som.clique();
  if (modo === 'local') {
    abrirEditarMundo({ opcoes: opcoesMundo, som: () => som.clique(), salvarLocal: (novas) => {
      // mundo sem internet: guarda as opções novas e abre o mundo de novo no mesmo lugar
      definirOpcoesMundo(novas); salvarLocal();
      fecharJanelas(); jogarLocal(); aviso('Pronto! O mundo foi atualizado.', 2500, 'lapis');
    }, local: {
      exportar: () => { salvarLocal(); baixarArquivo(montarArquivo({ nome: 'Mundo sem internet', semente: mundo.semente, opcoes: opcoesMundo, edicoes: mundo.listarEdicoes() })); },
      importar: (a) => { fecharJanelas(); jogarLocal({ opcoes: a.opcoes, semente: a.semente, edicoes: a.edicoes }); aviso('Mundo importado!', 2500, 'subir'); },
      apagar: () => { sairDoMundo({ apagarLocal: true }); },
    } });
  } else if (mundoAtual && mundoAtual.dono) {
    abrirEditarMundo({ mundo: mundoAtual, opcoes: opcoesMundo, som: () => som.clique(), aoSalvar: (m, mudou) => {
      mundoAtual.nome = m.nome;
      abrirPausa();
      // a sala avisa todo mundo (inclusive aqui) e o jogo recarrega; se o aviso não chegar, recarrega mesmo assim
      if (mudou.length) esperarEdicao = setTimeout(() => recarregarOnline({ ...mundoAtual, opcoes: m.opcoes }), 5000);
      else aviso('Nome salvo!', 2000, 'lapis');
    }, aoApagar: () => { /* a sala tira todo mundo (inclusive o dono) e o jogo volta para a lista */ } });
  }
});
// ---------- Ilha de Aventura: mapa e nome dos lugares ----------
const mapaIlha = new MapaIlha($('#mapa-ilha'));
function abrirMapaIlha() {
  if (!mundo || !mundo.aventura) return;
  som.iniciar(); som.clique();
  mapaIlha.preparar(mundo.aventura);
  mapaIlha.desenhar({ x: jog.pos.x, z: jog.pos.z, yaw: jog.yaw }, [...outros.values()].map((o) => ({ x: o.grupo.position.x, z: o.grupo.position.z })));
  $('#mapa-ilha').hidden = false; pausado = true;
}
$('#bt-mapa-ilha').addEventListener('click', abrirMapaIlha);
let lugarAtual = null;
function verLugar() {
  const L = mundo.aventura.lugarEm(jog.pos.x, jog.pos.z);
  if (L === lugarAtual) return;
  lugarAtual = L;
  if (L && !jog.planando) aviso(L.nome, 2600, ICONE_LUGAR[L.tipo] || 'pino');
}
// ---------- tela cheia ----------
const el = document.documentElement;
const pedirTela = el.requestFullscreen || el.webkitRequestFullscreen;
const emTelaCheia = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const ehApp = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone || new URLSearchParams(location.search).get('app') === 'android' || new URLSearchParams(location.search).has('appv');
function alternarTela() {
  som.iniciar();
  if (emTelaCheia()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
  if (pedirTela) {
    Promise.resolve(pedirTela.call(el, { navigationUI: 'hide' }))
      .then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch {} })
      .catch(() => aviso('Não deu para abrir em tela cheia aqui', 2500, 'telacheia'));
  } else {
    // iPhone não deixa sites ficarem em tela cheia: o jeito é instalar na tela de início
    aviso('No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início". O jogo abre em tela cheia por lá!', 6000);
  }
}
function atualizarBotaoTela() {
  const cheia = emTelaCheia();
  $('#bt-tela').innerHTML = icone(cheia ? 'sairtela' : 'telacheia');
  $('#bt-tela2').innerHTML = icone(cheia ? 'sairtela' : 'telacheia') + (cheia ? 'Sair da tela cheia' : 'Tela cheia');
}
$('#bt-tela').hidden = !!ehApp;
$('#bt-tela2').hidden = !!ehApp;
$('#bt-tela').addEventListener('click', alternarTela);
$('#bt-tela2').addEventListener('click', alternarTela);
document.addEventListener('fullscreenchange', atualizarBotaoTela);
document.addEventListener('webkitfullscreenchange', atualizarBotaoTela);

// ---------- instalar o app ----------
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('/sw.js').catch(() => {});
let pedidoInstalar = null;
const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function mostrarInstalar(sim) { document.querySelectorAll('.instalar').forEach((b) => { b.hidden = !sim || !!ehApp; }); }
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedidoInstalar = e; mostrarInstalar(true); });
addEventListener('appinstalled', () => { pedidoInstalar = null; mostrarInstalar(false); aviso('Pronto! O Pradaria está na sua tela de início!', 3500, 'estrela'); });
// ---------- versão (tela inicial e pausa) ----------
// o app Android abre o site com ?appv=1.0.N (o jogo navega só pelo #, então o endereço continua com ela)
const versaoApp = /^[\w.]{1,20}$/.test(new URLSearchParams(location.search).get('appv') || '') ? new URLSearchParams(location.search).get('appv') : null;
function textoVersao() {
  const jogo = VERSAO.numero === 'teste' ? 'Versão de teste' : `Versão ${VERSAO.numero}` + (VERSAO.data ? ` · ${VERSAO.data}` : '') + (VERSAO.hash ? ` · ${VERSAO.hash}` : '');
  const app = versaoApp ? ` · App Android ${versaoApp}` : (new URLSearchParams(location.search).get('app') === 'android' ? ' · App Android' : '');
  return jogo + app;
}
document.querySelectorAll('.versao').forEach((el) => { el.textContent = textoVersao(); });
// no Android (fora do app) oferece baixar o APK, que abre o jogo em tela cheia
if (/Android/i.test(navigator.userAgent) && !ehApp) document.querySelectorAll('.baixar-apk').forEach((b) => { b.hidden = false; });
if (ehIOS) mostrarInstalar(true); // no iPhone/iPad não tem pedido automático: mostramos o passo a passo
document.querySelectorAll('.instalar').forEach((b) => b.addEventListener('click', async () => {
  if (pedidoInstalar) {
    pedidoInstalar.prompt();
    const r = await pedidoInstalar.userChoice.catch(() => null);
    if (r && r.outcome === 'accepted') mostrarInstalar(false);
    pedidoInstalar = null;
  } else if (ehIOS) {
    alert('Para instalar no iPhone ou iPad:\n\n1. Abra este site no Safari\n2. Toque em Compartilhar (o quadrado com a setinha para cima)\n3. Toque em "Adicionar à Tela de Início"\n\nDepois é só abrir pelo ícone, em tela cheia!');
  }
}));
addEventListener('keydown', (e) => {
  if (!jogando) return;
  if (e.target.tagName === 'INPUT' && e.code !== 'Escape') return; // digitando (nome do mundo etc.)
  if (personagem.aberto) { if (e.code === 'Escape') personagem.fechar(); return; }
  if (e.code === 'Escape' && pausado) fecharJanelas();
  else if (e.target.tagName === 'INPUT') return; // escrevendo no chat (ou num campo): as letras não são atalhos
  else if (e.code === 'KeyP') abrirPausa();
  else if (e.code === 'KeyC' && !pausado && e.target.tagName !== 'INPUT') cmd.abrir();
  else if (((e.code === 'KeyR' && !opcoesMundo.armas) || e.code === 'F5') && !e.ctrlKey && !e.metaKey && !pausado && e.target.tagName !== 'INPUT') { e.preventDefault(); if (!e.repeat) alternarVisao(); }
  else if (e.code === 'KeyQ' && !pausado && !e.repeat) largarDaMao(e.ctrlKey || e.shiftKey);
  else if (e.code === 'KeyM') { if (!$('#mapa').hidden) fecharJanelas(); else if (!pausado) mapa.abrir(); }
});
// mundo pequeno/médio: como acaba no mar, dá para enxergar mais longe sem pesar
// Ultra enxerga longe (visao: distância mínima do preset)
const distVisao = () => Math.max(ajustes.dist, opcoesGraficas().visao || 0);
const raioVisao = () => Math.min(9, distVisao() + raioExtraMundo());
$('#aj-dist').addEventListener('input', (e) => { ajustes.dist = +e.target.value; if (mundo) mundo.raio = raioVisao(); salvarAjustes(); ajustarNevoa(); });
$('#aj-graf').addEventListener('change', (e) => {
  ajustes.graf = e.target.value;
  ajustes.grafManual = ajustes.graf !== 'auto';
  if (ajustes.graf === 'auto') { ajustes.grafTeto = null; calib.reiniciar(); }
  if (ajustes.graf === 'personalizado' && !ajustes.gopc) ajustes.gopc = { ...QUALIDADES.alta };
  salvarAjustes(); aplicarGraficos(); preencherGraficos(); segundosLentos = 0;
  if (mundo) mundo.raio = raioVisao();
  ajustarNevoa();
});
// opções avançadas: mexer em qualquer uma vira "Personalizado"
const OPC = [
  ['aj-sombra', 'sombra', 'num'], ['aj-area', 'area', 'num'], ['aj-luzes', 'luzes', 'num'], ['aj-teto', 'teto', 'num'],
  ['aj-vento', 'vento', 'bool'], ['aj-ondas', 'ondas', 'bool'], ['aj-nuvens', 'nuvens', 'bool'], ['aj-vinheta', 'vinheta', 'bool'], ['aj-pos', 'pos', 'bool'],
];
const PESS = [['aj-fov', 'fov'], ['aj-brilho', 'brilho'], ['aj-fpsmax', 'fpsMax']];
function preencherGraficos() {
  const o = opcoesGraficas();
  $('#aj-graf').value = ajustes.graf;
  $('#aj-graf option[value=auto]').textContent = `Automático (agora: ${QUALIDADES[nivelAuto()].nome})`;
  for (const [id, k, t] of OPC) { const el = $('#' + id); if (t === 'bool') el.checked = !!o[k]; else el.value = o[k]; }
  for (const [id, k] of PESS) $('#' + id).value = ajustes[k];
  $('#aj-auto').checked = ajustes.auto;
  $('#v-fov').textContent = ajustes.fov + '°';
  $('#v-brilho').textContent = Math.round(ajustes.brilho * 100) + '%';
  $('#v-area').textContent = o.sombra ? o.area + ' m' : '—';
  $('#aj-area').disabled = !o.sombra;
}
for (const [id, k, t] of OPC) $('#' + id).addEventListener(t === 'bool' ? 'change' : 'input', (e) => {
  const o = opcoesGraficas();
  ajustes.gopc = { sombra: o.sombra, area: o.area, luzes: o.luzes, pular: 0, vento: o.vento, ondas: o.ondas, nuvens: o.nuvens, vinheta: o.vinheta, teto: o.teto, pos: o.pos };
  ajustes.gopc[k] = t === 'bool' ? e.target.checked : +e.target.value;
  if (k === 'sombra' && ajustes.gopc.sombra && !ajustes.gopc.area) ajustes.gopc.area = 32;
  ajustes.graf = 'personalizado'; ajustes.grafManual = true;
  salvarAjustes(); aplicarGraficos(); preencherGraficos();
});
for (const [id, k] of PESS) $('#' + id).addEventListener('input', (e) => { ajustes[k] = +e.target.value; salvarAjustes(); aplicarGraficos(); preencherGraficos(); });
$('#aj-auto').addEventListener('change', (e) => { ajustes.auto = e.target.checked; salvarAjustes(); });
$('#aj-qual').addEventListener('input', (e) => { ajustes.qual = +e.target.value; salvarAjustes(); redimensionar(); });
$('#aj-sens').addEventListener('input', (e) => { ajustes.sens = +e.target.value; if (ctrl) ctrl.sensToque = ajustes.sens; salvarAjustes(); });
$('#aj-som').addEventListener('change', (e) => { ajustes.som = e.target.checked; aplicarSom(); salvarAjustes(); som.iniciar(); som.clique(); });
for (const [id, k] of [['aj-vol-musica', 'volMusica'], ['aj-vol-efeitos', 'volEfeitos'], ['aj-vol-voz', 'volVoz']]) {
  $('#' + id).addEventListener('input', (e) => { ajustes[k] = +e.target.value; aplicarSom(); salvarAjustes(); });
  $('#' + id).addEventListener('change', () => { if (k === 'volEfeitos') som.clique(); }); // amostra do volume novo
}
$('#aj-minimapa').addEventListener('change', (e) => { ajustes.minimapa = e.target.checked; salvarAjustes(); aplicarMinimapa(); });
$('#minimapa').addEventListener('click', () => { som.clique(); mapa.abrir(); });
$('#bt-abrir-mapa').addEventListener('click', () => { $('#pausa').hidden = true; mapa.abrir(); });
$('#aj-fps').addEventListener('change', (e) => { ajustes.fps = e.target.checked; $('#fps').hidden = !ajustes.fps; salvarAjustes(); });
$('#bt-sair-mundo').addEventListener('click', sairDoMundo);

// ---------- comandos visuais (teleporte, casa, amigos, hora) ----------
// sem corações: desmaia, os bichos bravos vão embora e acorda em casa (ou no começo), sem perder nada
vida.aoDesmaiar = () => {
  if (!jogando) return;
  if (guerra.ativo && guerra.desmaiou()) return; // Guerra: preso (procurado) ou resgatado para a Base Aliada
  if (vida.classico()) { morrer(); return; }
  if (bichos) bichos.acalmar();
  const el = $('#desmaio');
  el.hidden = false; el.classList.remove('vai'); void el.offsetWidth; el.classList.add('vai');
  const comArmas = !!opcoesMundo.armas;
  if (comArmas) armas.caiu();
  setTimeout(() => {
    if (!jogando) return;
    const c = cmd.casa();
    if (comArmas && mundo.aventura) {
      // Ilha de Aventura: volta lá do alto, num ponto qualquer da ilha, e escolhe onde pousar
      const a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 120, ini = mundo.aventura.inicio();
      cmd.teleportar(Math.round(Math.cos(a) * r) + 0.5, ini.y, Math.round(Math.sin(a) * r) + 0.5, a, 'Você caiu! Escolha onde pousar');
      jog.planando = true; jog.voando = false;
    } else if (c) cmd.teleportar(c[0], c[1], c[2], c[3], comArmas ? 'Você caiu e voltou para casa' : 'Você desmaiou e acordou em casa');
    else { const p = acharInicio(); cmd.teleportar(p.x, p.y, p.z, 0, comArmas ? 'Você caiu e voltou para o começo' : 'Você desmaiou e acordou no começo do mundo'); }
    vida.reiniciar(); vida.protegido = comArmas ? 3 : 6;
    if (comArmas) armas.renasceu();
  }, 900);
  setTimeout(() => { el.hidden = true; }, 2200);
};
// ---------- jogo clássico: fome, comer, morrer e renascer na cama ----------
// (regras em fome-regras.js e vida.js; a mochila que cai no chão é a economia 'morrer', conferida pela sala)
let morto = false, comendo = null, timerCorpo = 0;
const chaveCorpo = () => chaveInv().replace('pradaria.inv.', 'pradaria.corpo.');
let corpoCama = null; // [x, y, z] da última cama em que deitou (ponto de renascer)
function carregarCorpo() {
  let g = null;
  try { g = JSON.parse(localStorage.getItem(chaveCorpo()) || 'null'); } catch {}
  corpoCama = g && Array.isArray(g.cama) && g.cama.length === 3 && g.cama.every(Number.isInteger) ? g.cama : null;
  vida.reiniciar(g);
}
function salvarCorpo() {
  if (!jogando || !vida.classico() || morto) return;
  try { localStorage.setItem(chaveCorpo(), JSON.stringify({ ...vida.salvar(), cama: corpoCama })); } catch {}
}
// tocar na cama marca onde renasce (como no clássico)
function marcarCama(h) {
  if (!vida.classico()) return false;
  const c = [h.x, h.y, h.z];
  if (corpoCama && corpoCama.every((v, i) => v === c[i])) return false;
  corpoCama = c; salvarCorpo();
  return true;
}
// segurar a comida (botão direito; no toque, um toque): come em 1,6 s
function tentarComer() {
  const id = naMao();
  if (!vida.classico() || !ehComida(id) || qtd(id) < 1) return false;
  if (comendo) return true;
  if (!vida.comFome()) { aviso('Você está sem fome', 1400, 'coxa'); return true; }
  comendo = { id, t: 0, som: 0 };
  $('#comer').hidden = false;
  return true;
}
function pararComer() { if (!comendo) return; comendo = null; $('#comer').hidden = true; }
function quadroComer(dt) {
  if (!comendo) return;
  if (pausado || morto || naMao() !== comendo.id || qtd(comendo.id) < 1) { pararComer(); return; }
  comendo.t += dt; comendo.som -= dt;
  if (comendo.som <= 0) { comendo.som = 0.27; som.tom(180 + Math.random() * 60, 0.06, { tipo: 'square', vol: 0.12, ate: 90 }); visao.bater(); }
  $('#comer').firstElementChild.style.width = Math.round(Math.min(1, comendo.t / TEMPO_COMER) * 100) + '%';
  if (comendo.t < TEMPO_COMER) return;
  const id = comendo.id, a = { t: 'comer', id };
  pararComer();
  const r = mercado.mexer(a, false);
  if (!r) return;
  if (mercado.sala) mercado.sala.enviar(a);
  vida.comer(id);
  som.tom(520, 0.08, { tipo: 'sine', vol: 0.2, ate: 760 });
  salvarCorpo();
  desenharBarra();
}
const MORREU = { fome: 'Morreu de fome', queda: 'Caiu de muito alto', lava: 'Tentou nadar na lava', fogo: 'Queimou no fogo', agua: 'Ficou sem ar debaixo da água', bicho: 'Um bicho bravo te pegou' };
function morrer() {
  if (morto) return;
  morto = true; pararComer();
  if (bichos) bichos.acalmar();
  if (document.pointerLockElement) document.exitPointerLock();
  // tudo o que estava na mochila cai no chão (some em 5 minutos, como no clássico)
  const p = jog.pos, nivelAntes = nivelDe(mercado.e.xp | 0).nivel, r = mercado.mexer({ t: 'morrer' }, true);
  if (r) {
    if (mercado.sala) mercado.sala.enviar({ t: 'morrer' });
    else for (const [id, n, c, dg] of r.cai || []) drops.novoLocal(id, n, p.x, p.y + 0.6, p.z, [(Math.random() - 0.5) * 4, 3 + Math.random() * 2, (Math.random() - 0.5) * 4], '', c, dg);
    desenharBarra();
  }
  $('#morte-txt').textContent = MORREU[vida.motivo] || '';
  // como no clássico: a pontuação é a experiência que tinha (e que se perde)
  $('#morte-pontos').textContent = r && r.xpPerdido ? `Pontuação: ${r.xpPerdido} (nível ${nivelAntes})` : 'Pontuação: 0';
  vida.motivo = null;
  $('#morte').hidden = false; document.body.classList.add('morto');
  try { localStorage.removeItem(chaveCorpo()); } catch {} // renasce com tudo cheio
  if (corpoCama) try { localStorage.setItem(chaveCorpo(), JSON.stringify({ cama: corpoCama })); } catch {}
  som.tom(220, 0.5, { tipo: 'sawtooth', vol: 0.18, ate: 70 });
}
function renascer() {
  if (!morto || !jogando) return;
  morto = false;
  $('#morte').hidden = true; document.body.classList.remove('morto');
  const b = corpoCama && mundo.bloco(corpoCama[0], corpoCama[1], corpoCama[2]);
  if (corpoCama && ehCama(b)) cmd.teleportar(corpoCama[0] + 0.5, corpoCama[1] + 1.02, corpoCama[2] + 0.5, jog.yaw, 'Você renasceu na sua cama');
  else {
    const tinha = !!corpoCama;
    corpoCama = null;
    const p = acharInicio(); cmd.teleportar(p.x, p.y, p.z, 0, tinha ? 'Sua cama sumiu: você renasceu no começo do mundo' : 'Você renasceu no começo do mundo');
  }
  vida.reiniciar(); vida.protegido = 1;
  salvarCorpo();
  if (!ehToque) canvas.requestPointerLock && canvas.requestPointerLock();
}
$('#bt-renascer').addEventListener('click', renascer);

const cmd = criarComandos({
  aviso, som, outros, acharInicio: () => acharInicio(),
  jog: () => (jogando ? jog : null), mundo: () => mundo, sala: () => sala, modo: () => modo, mundoAtual: () => mundoAtual,
  nomeEu: () => conta.usuario && conta.usuario.nome,
  definirDia: (v) => { tempoDia = v; },
  pausar: (sim) => { pausado = sim; },
});
// cama: deitar de noite pula para a manhã (online, quando todo mundo deita)
const cama = criarCama({
  jog: () => jog, mundo: () => mundo, sala: () => sala, aviso, som, comIcone,
  dia: () => tempoDia, definirDia: (v) => { tempoDia = v; }, cicloDia: () => !!opcoesMundo.cicloDia,
});
// ---------- armas (opção do mundo) ----------
const armas = new Armas({
  cena, camera, som, aviso,
  outros: () => outros, mundo: () => mundo, bichos: () => bichos, jog: () => jog, sala: () => sala, euId: () => euId,
  fovBase: () => ajustes.fov || 72, controles: () => ctrl,
  aoMudar: () => { if (jogando) { desenharBarraSeMudou(); } },
});
cena.add(camera); // a arma em primeira pessoa fica presa na câmera
armas.aoAtirar = (a, o) => guerra.atirou(o); // Guerra: tiro perto da polícia dá estrela
let barraArmado = null;
function desenharBarraSeMudou() { if (barraArmado !== armas.empunhando) { barraArmado = armas.empunhando; desenharBarra(); } }
$('#bt-comandos').addEventListener('click', () => { som.iniciar(); som.clique(); cmd.abrir(); });
$('#bt-voar').addEventListener('click', () => alternarVoo());
// largar: tocar larga 1; segurar larga a pilha toda
{
  const bt = $('#bt-largar');
  let timer = 0, segurou = false;
  bt.addEventListener('pointerdown', (e) => { e.preventDefault(); segurou = false; timer = setTimeout(() => { segurou = true; largarDaMao(true); }, 550); });
  const soltar = () => { clearTimeout(timer); if (!segurou) largarDaMao(false); segurou = true; };
  bt.addEventListener('pointerup', soltar);
  bt.addEventListener('pointerleave', () => { clearTimeout(timer); segurou = true; });
  bt.addEventListener('contextmenu', (e) => e.preventDefault());
}
// celular: os emotes ficam guardados atrás de um botão só (não cabem na linha de cima)
function emotesAbertos(v) { $('#emotes').classList.toggle('aberto', v); $('#bt-emotes').setAttribute('aria-expanded', String(v)); }
$('#bt-emotes').addEventListener('click', () => { som.clique(); emotesAbertos(!$('#emotes').classList.contains('aberto')); });
// altura real da linha de cima (os botões quebram linha em tela estreita): o resto do HUD se posiciona por ela
{
  const topo = $('#topo');
  const medir = () => { const r = topo.getBoundingClientRect(); if (r.height) document.documentElement.style.setProperty('--topo-fim', Math.round(r.bottom) + 'px'); };
  if (window.ResizeObserver) new ResizeObserver(medir).observe(topo);
  addEventListener('resize', medir); medir();
}
document.querySelectorAll('[data-emote]').forEach((b) => b.addEventListener('click', () => {
  const e = b.dataset.emote; // nome do ícone: 'acenar', 'coracao', 'sorriso', 'estrela'
  emotesAbertos(false);
  som.oi();
  if (sala) sala.enviar({ t: 'emote', e });
  mercado.evento('emote');
  if (bichos) bichos.icone(e, jog.pos.x + Math.sin(-jog.yaw) * -1.2, jog.pos.y + 1.9, jog.pos.z - Math.cos(jog.yaw) * 1.2, 1.4, 0.5);
}));

function ajustarNevoa() {
  const d = distVisao() * 16;
  cena.fog.near = d * 0.45; cena.fog.far = d * 0.95;
  graf.ajustarNevoa(cena.fog.near, cena.fog.far);
}

function alternarVoo() {
  if (!jog || garagem.dentro) return;
  if (guerra.ativo && !jog.voando) { aviso('No mundo de Guerra não dá para voar', 1500, 'escudo'); return; }
  if (opcoesMundo.armas) { if (!jog.planando) aviso('Com armas não dá para voar', 1300, 'arma'); return; }
  jog.voando = !jog.voando;
  jog.vel.y = jog.voando ? 2 : 0;
  $('#bt-voar').classList.toggle('ligado', jog.voando);
  $('#bt-descer').hidden = !jog.voando;
  if (jog.voando && ctrl) ctrl.soltarAgachar();
  $('#bt-agachar').hidden = jog.voando;
  aviso(jog.voando ? 'Voando!' : 'Andando', 900, jog.voando ? 'voar' : null);
}

// ---------- ações ----------
const raio = new THREE.Raycaster();
const centro = new THREE.Vector2(0, 0);
function direcaoDe(ponto) {
  if (!ponto) raio.setFromCamera(centro, camera);
  else raio.setFromCamera(new THREE.Vector2((ponto.x / innerWidth) * 2 - 1, -(ponto.y / innerHeight) * 2 + 1), camera);
  if (!garagem.dentro) visao.ajustarRaio(raio.ray, !ponto, mundo); // 3ª pessoa: o alcance conta a partir do boneco
  return raio.ray.direction;
}

function mirar(ponto, alcance = 6) {
  const dir = direcaoDe(ponto);
  const o = raio.ray.origin;
  const hb = mundo.raycast(o, dir, alcance);
  const hp = guerra.atingir(o, dir, hb ? hb.t + 0.01 : alcance); // policiais, presos e soldados (mundo de Guerra)
  if (hp) return { bloco: null, bicho: null, pessoa: hp.npc };
  const ha = bichos.atingir(o, dir, hb ? hb.t + 0.01 : alcance);
  const hv = aldeoes.atingir(o, dir, ha ? ha.t : hb ? hb.t + 0.01 : alcance);
  const ht = negocios.atingir(o, dir, hv ? hv.t : ha ? ha.t : hb ? hb.t + 0.01 : alcance);
  if (ht) return { bloco: null, bicho: null, trabalhador: ht.npc };
  if (hv) return { bloco: null, bicho: null, aldeao: hv.aldeao };
  const hc = garagem.mirado(o, dir, ha ? ha.t : hb ? hb.t + 0.01 : alcance);
  if (hc) return { bloco: null, bicho: null, veiculo: hc.veiculo };
  return { bloco: ha ? null : hb, bicho: ha ? ha.bicho : null };
}

function usar(ponto) {
  if (!jogando || pausado || morto) return;
  som.iniciar();
  if (garagem.dentro) return;
  visao.bater();
  const m = mirar(ponto);
  if (m.pessoa) { guerra.socar(m.pessoa); return; }
  if (m.veiculo) { garagem.pedirEntrar(m.veiculo); return; }
  if (m.bicho) { if (!darTrigo(m.bicho)) fazerCarinho(m.bicho); return; }
  if (m.aldeao) { conversarCom(m.aldeao); return; }
  if (m.trabalhador) { negocios.tocar(m.trabalhador); return; }
  const h = m.bloco;
  if (!h) { tentarComer(); return; }
  // tocar na bancada abre a grade de criar 3x3
  if (h.b === B.BANCADA && sobrev()) { som.clique(); if (invPronto) { inv.mudarGrade(3); abrirInventario('mochila'); } else abrirInventario('criar'); return; }
  // tocar na fornalha abre a fornalha (com a mochila embaixo)
  if (h.b === FORNALHA && sobrev() && invPronto) { som.clique(); abrirFornalha(h.x, h.y, h.z); return; }
  // tocar no baú abre o baú (27 espaços em cima, a mochila embaixo)
  if (h.b === BAU && sobrev() && invPronto) { som.abrirBau ? som.abrirBau() : som.clique(); abrirBau(h.x, h.y, h.z); return; }
  // tocar na cama: deita (de noite, dorme até amanhecer)
  if (ehCama(h.b) && !armas.empunhando) {
    som.clique();
    const marcou = marcarCama(h);
    cama.deitar(h);
    // de dia a cama explica que só dorme de noite; junta o aviso do ponto de renascer
    if (marcou) { const t = $('#aviso').textContent; aviso((cama.deitado || !t ? '' : t + '. ') + 'Ponto de renascer marcado nesta cama', 2600, 'casa'); }
    return;
  }
  // tocar na alavanca liga/desliga; no botão, aperta
  if (BASE[h.b] === E.ALAVANCA) {
    mundo.definir(h.x, h.y, h.z, h.b === E.ALAVANCA ? E.ALAVANCA_LIGADA : E.ALAVANCA);
    som.alavanca();
    return;
  }
  if (BASE[h.b] === E.BOTAO) { apertarBotao(h.x, h.y, h.z); return; }
  // portas, forno, pedra de moinho e manivela do poço (com Porta/Forno... na mão, coloca em vez de mexer)
  if (naMao() !== h.b && mecanismos.tocar(h)) return; // (não conta como colocar bloco nas missões)
  if (tentarComer()) return; // comida na mão (clássico): come em vez de colocar
  if (armas.empunhando || !podeConstruir()) return; // com arma na mão (ou sem construção) não coloca bloco
  const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2];
  let novo = naMao();
  if (novo === ISQUEIRO) { acenderFogo(x, y, z); return; }
  // segunda mão (como no clássico): com a mão vazia ou com ferramenta, coloca o bloco da segunda mão
  let daMao2 = false;
  if ((!novo || ehItem(novo)) && invPronto && inv.s[MAO2] && !ehItem(inv.s[MAO2].id)) { novo = inv.s[MAO2].id; daMao2 = true; }
  if (!novo || ehItem(novo)) return; // mão vazia ou ferramenta: não coloca nada
  if (sobrev() && qtd(gastoDe(novo)) < 1) { aviso(`Acabou ${nomeDe(novo)}! Quebre mais ou crie`, 1500, 'mochila'); return; }
  if (y < 1 || y >= ALT) return;
  if (!mercado.podeColocar(novo)) { aviso(`${BLOCOS[novo].nome}: compre na loja de uma vila por ${mercado.precoDe(novo)} moedas`, 2500, 'cadeado'); return; }
  const atual = mundo.bloco(x, y, z);
  if (atual !== AR && !AGUA[atual] && !BLOCOS[atual].planta && !(ehLava(atual) && atual !== LAVA)) return; // na lava corrente dá para pôr
  if ((novo === B.AGUA || novo === LAVA) && atual === novo) return;
  if (SOLIDO[novo] && jog.ocupa(x, y, z)) return;
  // cana-de-açúcar (cana-regras.js): na grama/terra/areia encostada na água, ou em cima de outra cana
  if (novo === CANA) {
    if (!cabeCana((a, b, c) => mundo.bloco(a, b, c), x, y, z)) { aviso('A cana só pega na grama, terra ou areia com água bem do lado', 3000, 'milho'); return; }
  } else if (PRECISA_CHAO[novo] && !SOLIDO[mundo.bloco(x, y - 1, z)]) return;
  // trigo: na Terra de plantar vira broto e cresce sozinho; coletando, só dá para plantar nela
  if (novo === B.TRIGO) {
    if (mundo.bloco(x, y - 1, z) === B.TERRA_ARADA) novo = B.TRIGO_BROTO;
    else if (sobrev()) { aviso('Plante o trigo na Terra de plantar (crie com Terra na Mochila). Perto da água cresce mais rápido', 3200, 'milho'); return; }
  }
  // muda: só pega na grama, na terra ou na terra de plantar (depois vira árvore sozinha)
  if ((novo === B.MUDA || novo === B.MUDA_PINHEIRO) && !CHAO_DA_MUDA.has(mundo.bloco(x, y - 1, z))) {
    aviso('Plante a muda na grama ou na terra. Com espaço em cima, ela vira árvore em alguns minutos', 3000, 'arvore');
    return;
  }
  // esteira: anda para onde o jogador está olhando
  if (novo === E.ESTEIRA) {
    const fx = -Math.sin(jog.yaw), fz = -Math.cos(jog.yaw);
    novo = E.ESTEIRA + (Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3));
  }
  // escada de mão: fica presa na parede tocada (tocando no chão, na parede da frente); sem parede não fica
  if (novo === ESCADA_MAO) {
    let d;
    if (h.n[1] === 0) d = PAREDE.findIndex(([px, pz]) => px === -h.n[0] && pz === -h.n[2]);
    else { const fx = -Math.sin(jog.yaw), fz = -Math.cos(jog.yaw); d = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3); }
    const [px, pz] = PAREDE[d], parede = mundo.bloco(x + px, y, z + pz);
    if (!SOLIDO[parede] || FORMA_NOVA[parede]) { aviso('A escada de mão precisa de uma parede atrás', 2200, 'subir'); return; }
    novo = ESCADA_MAO + d;
  }
  // rampa e escada: sobem para onde o jogador está olhando (andando para a frente, sobe)
  if (novo === F.RAMPA || novo === F.ESCADA) {
    const fx = -Math.sin(jog.yaw), fz = -Math.cos(jog.yaw);
    novo += Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3);
  }
  // cama: cabeceira do lado de lá; cadeira: virada para quem colocou
  if (novo === MV.CAMA || novo === MV.CADEIRA) {
    const fx = -Math.sin(jog.yaw), fz = -Math.cos(jog.yaw);
    const d = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3);
    novo += novo === MV.CAMA ? d : (d + 2) & 3;
  }
  if (daMao2) inv.preferir = MAO2; // a mochila vai contar 1 a menos: sai da segunda mão
  comoJogador(() => mundo.definir(x, y, z, novo));
  som.em(meioDe(x, y, z), () => som.colocar(novo));
  // coletando: despejou a última água, o balde vazio volta para a mão
  if (novo === B.AGUA && sobrev() && qtd(B.AGUA) < 1) trocarNaMao(B.AGUA, ITEM.BALDE);
  if (novo === LAVA && sobrev() && qtd(LAVA) < 1) trocarNaMao(LAVA, ITEM.BALDE);
  dicaEnergia(novo, x, y, z);
}

// ---------- engenharia ----------
function apertarBotao(x, y, z) {
  if (mundo.bloco(x, y, z) !== E.BOTAO) return;
  mundo.definir(x, y, z, E.BOTAO_LIGADO);
  som.alavanca();
  const m = mundo;
  setTimeout(() => { if (mundo === m && m.bloco(x, y, z) === E.BOTAO_LIGADO) m.definir(x, y, z, E.BOTAO); }, 1500);
}
// dicas para quem está começando (uma vez cada)
const dicasDadas = new Set();
function dicaEnergia(novo, x, y, z) {
  if (!PRECISA_ENERGIA.has(BASE[novo]) || dicasDadas.has('energia')) return;
  setTimeout(() => {
    if (!mundo || dicasDadas.has('energia')) return;
    if (mundo.bloco(x, y, z) === novo) { // continua desligado
      dicasDadas.add('energia');
      aviso('Essa máquina precisa de energia! Coloque uma Alavanca encostada (ou ligue com Fio) e toque nela.', 5000, 'raio');
    }
  }, 400);
}
// placa de pisar: quem pisa liga; quando sai (e ninguém mais está nela), desliga
let minhaPlaca = null;
function vigiarPlaca() {
  const x = Math.floor(jog.pos.x), y = Math.floor(jog.pos.y + 0.05), z = Math.floor(jog.pos.z);
  const b = mundo.bloco(x, y, z);
  const aqui = BASE[b] === E.PLACA && !jog.voando ? [x, y, z] : null;
  if (aqui && b === E.PLACA) { mundo.definir(x, y, z, E.PLACA_LIGADA); som.clique(); }
  if (minhaPlaca && (!aqui || aqui.join() !== minhaPlaca.join())) {
    const [px, py, pz] = minhaPlaca;
    let alguem = false;
    for (const o of outros.values()) if (Math.floor(o.alvo.x) === px && Math.floor(o.alvo.y + 0.05) === py && Math.floor(o.alvo.z) === pz) alguem = true;
    // solta um pouquinho depois (dá tempo de passar pelo portão antes de ele fechar)
    const m = mundo;
    if (!alguem) setTimeout(() => {
      if (mundo !== m || (minhaPlaca && minhaPlaca.join() === [px, py, pz].join())) return;
      for (const o of outros.values()) if (Math.floor(o.alvo.x) === px && Math.floor(o.alvo.y + 0.05) === py && Math.floor(o.alvo.z) === pz) return;
      if (m.bloco(px, py, pz) === E.PLACA_LIGADA) m.definir(px, py, pz, E.PLACA);
    }, 1800);
  }
  minhaPlaca = aqui;
}
// confete: chuva de papeizinhos coloridos
const CORES_CONFETE = [0xe8433f, 0xf2c72e, 0x3f6fd9, 0x5cb83a, 0xf29ac2, 0xffffff, 0x9c5bd9];
const matsConfete = CORES_CONFETE.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
const geoConfete = new THREE.PlaneGeometry(0.14, 0.09);
function soltarConfete(x, y, z) {
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(geoConfete, matsConfete[i % matsConfete.length]);
    m.position.set(x + 0.5, y + 1.05, z + 0.5);
    m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    cena.add(m);
    partQ.push({ m, v: [(Math.random() - 0.5) * 4, 7 + Math.random() * 5, (Math.random() - 0.5) * 4], vida: 2 + Math.random(), confete: true, giro: (Math.random() - 0.5) * 12, dono: 'confete' });
  }
}
function eventoEnergia(tipo, x, y, z) {
  if (!jog || (jog.pos.x - x) ** 2 + (jog.pos.y - y) ** 2 + (jog.pos.z - z) ** 2 > 40 * 40) return;
  if (tipo === E.SINO) { som.sino(y); bichos && bichos.icone('nota', x + 0.5, y + 1.6, z + 0.5, 1.2, 0.5); }
  else if (tipo === E.CONFETE) { som.confete(); soltarConfete(x, y, z); }
}

// só o que a pessoa faz com as mãos conta para o mercado e as missões
// (areia caindo, folhas secando, grama crescendo e máquinas não contam)
let porJogador = false;
function comoJogador(fn) { porJogador = true; try { return fn(); } finally { porJogador = false; } }
let maoQuebrando = 0; // o que estava na mão ao quebrar (vidro só sai inteiro com picareta)

// segurar o dedo (ou clicar) num bicho bate nele. Como no clássico: cada coisa na mão tem dano (em meios corações)
// e um tempo de recarga; bater antes de recarregar dá golpe fraco (20% a 100%). Segurando o dedo, o golpe
// sai sozinho quando a recarga enche. Golpe caindo de um pulo é crítico (1,5x).
const GOLPE = { // [dano, segundos de recarga]
  mao: [0.5, 0.25],
  [ITEM.PICARETA_MADEIRA]: [1, 0.83], [ITEM.PICARETA_PEDRA]: [1.5, 0.83],
  [ITEM.MACHADO_MADEIRA]: [3.5, 1.25], [ITEM.MACHADO_PEDRA]: [4.5, 1.25],
  [ITEM.PA_MADEIRA]: [1.25, 1], [ITEM.PA_PEDRA]: [1.75, 1],
};
const golpeDe = (id) => GOLPE[id] || GOLPE.mao;
let golpeEm = -1e9, tentouEm = -1e9;
function cargaGolpe() { return Math.min(1, (performance.now() - golpeEm) / 1000 / golpeDe(naMao())[1]); }
function baterNoBicho(b) {
  const agora = performance.now(), carga = cargaGolpe();
  const segurando = agora - tentouEm < 330; // segurar repete a cada 260 ms: espera a recarga encher
  tentouEm = agora;
  if (segurando && carga < 0.95) return;
  const [dano] = golpeDe(naMao());
  const critico = carga > 0.9 && !jog.noChao && !jog.naAgua && !jog.voando && jog.vel.y < 0;
  const r = bichos.bater(b, dano * (0.2 + 0.8 * carga * carga), { critico, empurrao: carga > 0.9 ? 1 : 0.6 });
  vida.cansar(0.1); // fome (clássico): bater cansa
  golpeEm = agora;
  mostrarRecarga();
  if (r && !b.vidaMax) aviso('O cachorro é seu amigo! Faça carinho com um toque rápido', 2200, 'coracao');
}
// barrinha da recarga embaixo da mira (some quando enche)
let recargaRaf = 0;
function mostrarRecarga() {
  const el = $('#recarga');
  if (!el || recargaRaf) return;
  el.hidden = false;
  const passo = () => {
    const c = cargaGolpe();
    el.firstElementChild.style.width = Math.round(c * 100) + '%';
    if (c >= 1) { recargaRaf = 0; setTimeout(() => { if (!recargaRaf) el.hidden = true; }, 150); return; }
    recargaRaf = requestAnimationFrame(passo);
  };
  recargaRaf = requestAnimationFrame(passo);
}
// trigo na mão: o bicho de fazenda come (adulto fica apaixonado e cruza; filhote cresce mais rápido)
function darTrigo(b) {
  if (naMao() !== B.TRIGO || b.I.selvagem) return false;
  if (sobrev() && qtd(B.TRIGO) < 1) { aviso('Acabou o trigo! Colha mais na plantação', 1600, 'milho'); return true; }
  if (!bichos.alimentar(b)) { aviso(b.filhote ? 'Esse filhote não come trigo' : b.amor > 0 ? 'Já está procurando um par' : 'Já comeu: descansando um pouco antes de outra cria', 1800, 'coracao'); return true; }
  if (sobrev()) mercado.enviar({ t: 'alimentar' });
  return true;
}
function fazerCarinho(b) { if (!bichos.carinho(b)) return; mercado.evento('carinho'); laDaOvelha(b); } // bicho selvagem: o toque espanta (não conta como carinho)
function conversarCom(a) {
  aldeoes.conversar(a, jog, Math.sin(tempoDia * Math.PI * 2) < -0.15);
  mercado.evento('conversa');
  // com o mercado ligado, o aldeão abre a lojinha da vila
  if (mercado.op.mercado) setTimeout(() => { if (jogando && !pausado) mercado.abrirLoja(a); }, 650);
}

function quebrar(ponto) {
  if (!jogando || pausado || morto) return;
  som.iniciar();
  if (garagem.dentro) return;
  visao.bater();
  const m = mirar(ponto);
  if (m.pessoa) { guerra.socar(m.pessoa); return; }
  if (m.veiculo) return;
  if (m.bicho) { baterNoBicho(m.bicho); return; }
  if (m.aldeao) { conversarCom(m.aldeao); return; }
  if (m.trabalhador) { negocios.tocar(m.trabalhador); return; }
  if (armas.empunhando || !podeConstruir()) return; // sem construção ninguém quebra bloco
  // a água não se quebra: a mira atravessa e acerta o que está atrás. Só o balde vazio pega a água
  const mao = naMao();
  if (mao === ITEM.BALDE && recolherAgua(ponto)) return;
  const h = m.bloco;
  if (!h || h.y < 1) return;
  if (guerra.quebrarBloco(h)) return; // grade da cela (serrar), paredes do presídio e alvos do forte
  // cada toque arranca um pedaço; o último derruba o bloco (a ferramenta certa precisa de menos toques)
  const p = raio.ray.at(h.t + 0.001, new THREE.Vector3());
  const total = toquesCom(toquesPara(h.b), h.b, mao);
  maoQuebrando = mao;
  if (comoJogador(() => escav.bater(h, p, total))) { vida.cansar(0.005); som.em(meioDe(h.x, h.y, h.z), () => som.quebrar(h.b)); mostrarQueCaiu(h.b, h.x, h.y, h.z); } else som.em(meioDe(h.x, h.y, h.z), () => som.bater(h.b));
}

// dentro da lava queima (com os corações ligados): DANO_LAVA por segundo
let tempoLava = 0, avisouLava = 0;
// isqueiro: acende fogo no lado do bloco tocado (precisa de chão firme ou de algo que pegue fogo do lado)
function acenderFogo(x, y, z) {
  if (y < 1 || y >= ALT) return;
  const atual = mundo.bloco(x, y, z);
  if (atual !== AR && !(BLOCOS[atual].planta && atual !== FOGO)) return;
  const perto = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([a, b, c]) => inflamavel(mundo.bloco(x + a, y + b, z + c)));
  if (!SOLIDO[mundo.bloco(x, y - 1, z)] && !perto) { aviso('O fogo precisa de chão ou de madeira do lado', 1800, 'explosao'); return; }
  mundo.marcarFogo(x, y, z);
  acendendo = true; try { mundo.definir(x, y, z, FOGO); } finally { acendendo = false; } // isq: a sala marca como fogo de verdade
  if (sobrev()) mercado.acender(); // gasta o isqueiro (depois do fogo: a sala confere que ainda tem)
  som.tom(900, 0.05, { tipo: 'square', vol: 0.15, ate: 300 });
}

// dentro do fogo (pés ou cabeça) machuca
function noFogo() {
  const x = Math.floor(jog.pos.x), y = Math.floor(jog.pos.y), z = Math.floor(jog.pos.z);
  return mundo.bloco(x, y, z) === FOGO || mundo.bloco(x, y + 1, z) === FOGO;
}
let tempoFogo = 0, avisouFogo = 0, acendendo = false;
function queimarNoFogo(dt) {
  if (!noFogo()) { tempoFogo = 0; return; }
  if (tempoTotal - avisouFogo > 4) { avisouFogo = tempoTotal; aviso('Fogo queima! Saia de perto ou apague com água', 2000, 'explosao'); }
  tempoFogo += dt;
  if (tempoFogo >= 1 / DANO_FOGO) { tempoFogo = 0; vida.motivo = 'fogo'; if (vida.dano(vida.escala())) som.tom(160, 0.15, { tipo: 'square', vol: 0.25, ate: 90 }); }
}

function queimarNaLava(dt) {
  if (!jog.naLava) { tempoLava = 0; return; }
  if (tempoTotal - avisouLava > 4) { avisouLava = tempoTotal; aviso('A lava queima! Saia rápido (pule)', 2000, 'explosao'); }
  tempoLava += dt;
  if (tempoLava >= 1 / DANO_LAVA) { tempoLava = 0; vida.motivo = 'lava'; if (vida.dano(vida.escala() * (vida.classico() ? 2 : 1))) som.tom(160, 0.15, { tipo: 'square', vol: 0.25, ate: 90 }); }
}

// recolhe a fonte de água mirada; a água corrente que dependia dela seca sozinha
function recolherAgua(ponto) {
  const dir = direcaoDe(ponto);
  const h = mundo.raycast(raio.ray.origin, dir, 6, true);
  if (!h || !(AGUA[h.b] || ehLava(h.b))) return false;
  // lava também vai no balde (vira "Lava" na mochila); corrente: procura a fonte mais perto dali
  const fonte = ehLava(h.b) ? LAVA : B.AGUA;
  let alvo = h.b === fonte ? h : null;
  for (let r = 1; !alvo && r <= 3; r++) {
    for (let dy = -r; dy <= r && !alvo; dy++) for (let dx = -r; dx <= r && !alvo; dx++) for (let dz = -r; dz <= r && !alvo; dz++) {
      if (mundo.bloco(h.x + dx, h.y + dy, h.z + dz) === fonte) alvo = { x: h.x + dx, y: h.y + dy, z: h.z + dz };
    }
  }
  if (!alvo) { aviso(fonte === LAVA ? 'Essa lava vem de longe' : 'Essa água vem de longe', 1500, fonte === LAVA ? 'explosao' : 'gota'); return true; }
  if (sobrev() && qtd(ITEM.BALDE) < 1) return true;
  maoQuebrando = ITEM.BALDE;
  comoJogador(() => mundo.definir(alvo.x, alvo.y, alvo.z, AR));
  som.splash(0.2);
  // coletando: o balde ficou cheio (Água na mochila); acabaram os vazios, a mão passa a segurar a água
  if (sobrev() && qtd(ITEM.BALDE) < 1) trocarNaMao(ITEM.BALDE, fonte);
  return true;
}
// o espaço da barra com "de" passa a mostrar "para" (ou escolhe o espaço que já tem "para")
function trocarNaMao(de, para) {
  const ja = barra.indexOf(para);
  if (ja >= 0) slotSel = ja; else { const i = barra[slotSel] === de ? slotSel : barra.indexOf(de); if (i < 0) return; barra[i] = para; slotSel = i; }
  desenharBarra();
}

const partQ = [];
const geoQ = new THREE.BoxGeometry(0.14, 0.14, 0.14);
function quebraParticulas(x, y, z, b) {
  const tile = BLOCOS[b].tiles[2];
  const cv = atlasCanvas.getContext('2d').getImageData((tile % 8) * 16 + 7, Math.floor(tile / 8) * 16 + 7, 1, 1).data;
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(`rgb(${cv[0]},${cv[1]},${cv[2]})`) });
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(geoQ, mat);
    m.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
    cena.add(m);
    partQ.push({ m, v: [(Math.random() - 0.5) * 3, Math.random() * 4 + 1, (Math.random() - 0.5) * 3], vida: 0.6 + Math.random() * 0.3 });
  }
}

// ---------- outros jogadores ----------
function adicionarOutro(j) {
  if (j.id === euId || outros.has(j.id)) return;
  const b = montarBoneco(j.skin ? normalizarSkin(j.skin, j.cor) : skinDeCor(j.cor));
  const et = etiqueta(j.nome);
  et.position.y = b.topo + 0.37; et.userData.etiqueta = true;
  b.grupo.add(et);
  const p = j.p || [0, 60, 0];
  b.grupo.position.set(p[0], p[1], p[2]);
  cena.add(b.grupo);
  outros.set(j.id, { ...b, nome: j.nome, corCss: '#' + corDe(CORES_ROUPA, b.skin.corRoupa).toString(16).padStart(6, '0'), alvo: new THREE.Vector3(...p), yaw: 0, alvoYaw: (j.r && j.r[0]) || 0, yawOlhar: (j.r && j.r[0]) || 0, vRede: new THREE.Vector3(), vAnim: new THREE.Vector3(), vTmp: new THREE.Vector3() });
}

// posição de um amigo (vem da sala ~8x por segundo)
function recebeuPos(msg) {
  const o = outros.get(msg.id);
  if (!o) return;
  // velocidade do amigo pelas posições recebidas (anima os passos na velocidade real)
  const agora = performance.now(), dtp = (agora - (o.tPos || 0)) / 1000;
  if (dtp > 0.04 && dtp < 2.5) { // (aparelho lento manda devagar: ainda vale)
    const vx = (msg.p[0] - o.alvo.x) / dtp, vy = (msg.p[1] - o.alvo.y) / dtp, vz = (msg.p[2] - o.alvo.z) / dtp;
    if (Math.hypot(vx, vy, vz) < 30) { o.vRede.x += (vx - o.vRede.x) * 0.6; o.vRede.y += (vy - o.vRede.y) * 0.6; o.vRede.z += (vz - o.vRede.z) * 0.6; }
    else o.vRede.set(0, 0, 0); // teleporte
  } else if (dtp >= 2.5) o.vRede.set(0, 0, 0);
  o.tPos = agora;
  o.alvo.set(msg.p[0], msg.p[1], msg.p[2]);
  o.alvoYaw = msg.r[0]; o.alvoPitch = msg.r[1]; o.acao = msg.a | 0;
  if (o.acao & 48) o.flagsNovas = true;
}

function removerOutro(id) {
  const o = outros.get(id);
  if (!o) return;
  garagem.esquecer(id);
  cena.remove(o.grupo);
  o.grupo.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material && x.material !== matModelo && !x.material.userData.compartilhado) { x.material.map && x.material.map.dispose(); x.material.dispose(); } });
  outros.delete(id);
}

// ---------- iniciar / sair ----------
function acharInicio() {
  if (mundo.aventura) return mundo.aventura.inicio();
  // começa na rua da vila que fica perto do meio do mundo
  const v = mundo.vilas.regiao(0, 0);
  if (v && v.ruas.length) {
    const r = v.ruas[0];
    const x = v.x + r.dx * 6, z = v.z + r.dz * 6;
    return { x: x + 0.5, y: Math.max(mundo.alturaEm(x, z), mundo.nivelAgua) + 2, z: z + 0.5 };
  }
  // procura um lugar de terra firme perto da origem
  for (let r = 0; r < 200; r += 4) for (let a = 0; a < 8; a++) {
    const x = Math.round(Math.cos(a * 0.785) * r), z = Math.round(Math.sin(a * 0.785) * r);
    const h = mundo.alturaEm(x, z);
    if (h > mundo.nivelAgua + 1 && h < mundo.nivelAgua + 20) return { x: x + 0.5, y: h + 2, z: z + 0.5 };
  }
  return { x: 0.5, y: 50, z: 0.5 };
}

let salvarLocalTimer = 0, edicoesPendentes = false;
function salvarLocal() {
  if (modo !== 'local' || !mundo) return;
  try {
    localStorage.setItem('pradaria.local', JSON.stringify({
      semente: mundo.semente, opcoes: { ...opcoesMundo }, edicoes: mundo.listarEdicoes(), pos: [jog.pos.x, jog.pos.y, jog.pos.z], yaw: jog.yaw, dia: tempoDia, barra, veiculos: garagem.lista(), veiculosP: garagem.listaCriados(),
    }));
  } catch {}
  edicoesPendentes = false;
}

function limparMundo() {
  guerra.parar();
  garagem.parar();
  armas.parar();
  visao.esconder();
  chat.saiu();
  if (sala) { sala.fechar(); sala = null; }
  for (const id of [...outros.keys()]) removerOutro(id);
  mapa.usarMundo(null);
  mapa.fechar();
  if (mundo) {
    for (const c of mundo.chunks.values()) for (const m of [c.malha, c.agua]) if (m) { cena.remove(m); m.geometry.dispose(); }
  }
  if (fisica) fisica.limpar();
  drops.usarMundo(null);
  if (escav) { for (const k of [...escav.blocos.keys()]) escav.soltar(k); escav.atualizar(10, 0, 0); }
  if (bichos) for (let i = bichos.lista.length - 1; i >= 0; i--) bichos.remover(i);
  if (aldeoes) aldeoes.limpar();
  negocios.limpar();
  mecanismos.usarMundo(null);
  mundo = null; bichos = null; aldeoes = null; escav = null; fisica = null;
  mercado.parar();
}

function iniciarMundo({ semente, edicoes = [], pos = null, yaw = 0, opcoes = null, veiculos = [], veiculosP = [], guardado = null }) {
  invPronto = false; // a arrumação da mochila espera a contagem deste mundo (prepararInventario)
  vestirMeusBonecos(meuSkin()); // pode ter trocado de conta desde o último mundo
  segundosJogando = 0; calib.reiniciar();
  limparMundo();
  visao.definir(ajustes.visao || 0);
  definirOpcoesMundo(opcoes); // antes do Mundo: a geração (vilas etc.) já lê as opções
  // coletar e criar: a mochila e a barra deste jogador neste mundo (criativo: blocos à vontade)
  const barraOk = (b) => Array.isArray(b) && b.length === 9 && b.every((x) => Number.isInteger(x) && (x === 0 || nomeDe(x) !== '?'));
  if (sobrev()) barra = barraOk(guardado && guardado.barra) ? [...guardado.barra] : new Array(9).fill(0);
  else if (!barraOk(barra) || barra.includes(0)) barra = [...BARRA_CRIATIVO];
  slotSel = Math.min(slotSel, barra.length - 1);
  if (!opcoesMundo.cicloDia) tempoDia = 0.3;
  mundo = new Mundo(cena, matBlocos, matAgua, semente);
  mundo.raio = raioVisao();
  mundo.suaveSimples = opcoesGraficas().sombra === 0; // gráfico Leve: arredondado simples (monta mais rápido)
  mundo.matSuave = mundo.suave ? graf.matSuave : null; // Natural 3D: chão e árvores com cor lisa de desenho (graficos.js)
  escav = new Escavacao(cena, mundo, matBlocos, atlasCanvas);
  // rachadura: os amigos veem o bloco rachando (no máximo 1 aviso a cada 0,15 s)
  let ultimaRacha = 0;
  escav.aoRachar = (x, y, z, b, toques, total) => {
    const ag = performance.now();
    if (!sala || ag - ultimaRacha < 150) return;
    ultimaRacha = ag; sala.enviar({ t: 'racha', x, y, z, b, n: toques, de: total });
  };
  drops.usarMundo(mundo);
  fisica = new Fisica(cena, mundo, matBlocos);
  plantacoes = new Plantacoes(mundo);
  fisica.aoCair = (x, y, z, b) => { som.em({ x: x + 0.5, y, z: z + 0.5 }, () => som.passo(b || 'areia', 0.7)); };
  fisica.aoFolha = (x, y, z, b) => escav.estilhacar(x, y, z, b, null, null);
  mundo.carregarEdicoes(edicoes);
  mundo.aoMudarBloco = (x, y, z, b, de, natural) => {
    edicoesPendentes = true;
    if (sala) sala.enviar(porJogador ? { t: 'bloco', x, y, z, b, de, j: 1, mao: b ? 0 : maoQuebrando } : acendendo ? { t: 'bloco', x, y, z, b, de, isq: 1 } : { t: 'bloco', x, y, z, b, de });
    if (fisica) fisica.mudou(x, y, z, b);
    if (porJogador) mercado.bloco(b, y, de, natural, x, z, b ? 0 : maoQuebrando);
    if (de === FORNALHA && b !== FORNALHA) fornalhaSumiu(x, y, z);
    if (de === BAU && b !== BAU) bauSumiu(x, y, z);
  };
  mundo.energia.aoEvento = eventoEnergia;
  minhaPlaca = null;
  jog = new Jogador(mundo);
  let avisoBorda = 0;
  jog.aoBorda = () => { if (tempoTotal - avisoBorda > 6) { avisoBorda = tempoTotal; aviso('Aqui é o fim do mundo! Só mar daqui pra frente', 2200, 'gota'); } };
  // queda alta: baque sempre; com corações ligados, tira meio coração por bloco acima de 4
  jog.aoQueda = (blocos, dano, machucou) => {
    som.queda(chaoDe(jog.pos.x, jog.pos.y, jog.pos.z), machucou);
    if (machucou) aviso('Ai, que tombo! Quedas altas machucam', 1800, 'coracao');
  };
  lugarAtual = null;
  $('#bt-mapa-ilha').hidden = !mundo.aventura;
  if (pos) Object.assign(jog.pos, { x: pos[0], y: pos[1], z: pos[2] });
  else {
    const ini = acharInicio();
    Object.assign(jog.pos, { x: ini.x, y: ini.y, z: ini.z });
    // Ilha de Aventura: começa lá no alto e desce planando, escolhendo onde pousar
    if (ini.planar) { jog.planando = true; setTimeout(() => aviso('Escolha onde pousar! Ande para planar até lá', 4000, 'voar'), 600); }
  }
  jog.yaw = yaw;
  if (!ctrl) {
    ctrl = new Controles(canvas, jog, {
      usar, quebrar, alternarVoo, inventario: abrirInventario,
      slot: (i) => {
        // sem construção, os números escolhem as armas (1, 2) e as mãos (3)
        if (!podeConstruir()) { if (i < 2) armas.escolher(i); else if (i === 2) armas.escolher(-1); return; }
        if (i < barra.length) { slotSel = i; armas.escolher(-1); desenharBarra(); }
      },
      armado: () => jogando && !pausado && !garagem.dentro && armas.empunhando,
      gatilho: (sim) => { if (!sim || (jogando && !pausado)) armas.gatilho(sim); },
      mirar: (sim) => { if (!sim && comendo && !ehToque) pararComer(); armas.mirar(sim); }, // soltou o botão direito: para de comer
      recarregar: () => { if (jogando && !pausado) armas.recarregar(); },
      trocar: () => { if (jogando && !pausado) armas.trocar(); },
      rolar: (d) => { slotSel = (slotSel + d + barra.length) % barra.length; desenharBarra(); },
      primeiroToque: () => som.iniciar(),
      mira: (p) => { miraToque = p; },
      travaMudou: () => {},
    });
  }
  ctrl.jog = jog;
  ctrl.sensToque = ajustes.sens;
  if (naTV) ctrl.toque = false;
  ctrl.tv = tv.ligado;
  bichos = new Bichos(cena, mundo, som);
  aldeoes = new Aldeoes(cena, mundo, som, (...a) => bichos.icone(...a));
  aldeoes.aoEntrarVila = (v) => aviso(v.nome, 2600, 'vila');
  aldeoes.aoPorta = (x, y, z) => mecanismos.abrirParaMorador(x, y, z);
  mecanismos.usarMundo(mundo);
  // bicho provocado (mãe com filhotes, urso surpreendido, cobra pisada...) avisa antes e morde se você insistir
  let ultimoAvisoBicho = -99;
  bichos.aoAvisar = (b, bravo) => {
    if (bravo) { // apanhou e veio para cima
      if (tempoTotal - ultimoAvisoBicho < 4) return;
      ultimoAvisoBicho = tempoTotal;
      const quem = b.I.nome || 'o bicho';
      aviso(quem[0].toUpperCase() + quem.slice(1) + ' ficou bravo e veio para cima! Afaste-se', 2200, 'pata');
      return;
    }
    if (tempoTotal - ultimoAvisoBicho < 12) return;
    ultimoAvisoBicho = tempoTotal;
    const mae = bichos.lista.some((o) => o.mae === b);
    const quem = (mae && b.I.nomeMae) || b.I.nome || 'o bicho';
    const motivo = b.cacandoGente ? 'está com fome e de olho em você' : b.especie === 'cobra' ? 'está avisando: não chegue perto' : mae ? 'está protegendo os filhotes' : 'não gostou de você tão perto';
    aviso(quem[0].toUpperCase() + quem.slice(1) + ' ' + motivo + '. Afaste-se ou toque para espantar', 2600, 'pata');
  };
  bichos.aoMorder = (b, dano) => {
    const quem = b.I.nome || 'o bicho';
    // no clássico os danos dobram (10 corações) e mudam com a dificuldade (Fácil metade, Difícil uma vez e meia)
    if (dano && vida.classico()) { const d = opcoesMundo.dificuldade; dano = Math.max(1, Math.round(dano * 2 * (d === 'facil' ? 0.5 : d === 'dificil' ? 1.5 : 1))); vida.motivo = 'bicho'; }
    if (dano && vida.dano(dano)) { som.tom(200, 0.15, { tipo: 'sine', vol: 0.3, ate: 120 }); aviso('Ai! ' + quem[0].toUpperCase() + quem.slice(1) + ' te mordeu. Acenda uma luz ou toque para espantar', 2000, 'coracao'); }
    else aviso(quem[0].toUpperCase() + quem.slice(1) + ' te deu um empurrão. Deixe ' + (quem.startsWith('a ') ? 'ela' : 'ele') + ' em paz', 1800, 'pata');
  };
  // bicho derrubado: o que ele deixa vai para a mochila (se o mundo tiver mochila: Coletar e criar ou Mercado)
  bichos.aoCair = (b) => {
    const cai = caiDoBicho(b.especie, b.filhote);
    if (!cai.length || !(sobrev() || mercado.op.mercado)) return;
    mercado.enviar({ t: 'ev', e: 'caca', b: b.especie, f: b.filhote ? 1 : 0, ...ondeBicho(b) }, true); // cai no chão onde ele estava
  };
  vida.reiniciar();
  armas.comecar();
  barraArmado = null;
  $('#bt-voar').hidden = !!opcoesMundo.armas;
  $('#dica-toque').textContent = opcoesMundo.armas ? 'Botão da arma: atirar · Mira: aproximar · Ande por cima das caixas para pegar'
    : podeConstruir() ? 'Toque: colocar bloco ou fazer carinho · Segure: quebrar' : 'Toque: fazer carinho e conversar · Mundo só para explorar';
  $('#dica-toque').style.opacity = 1;
  mapa.usarMundo(mundo, 'pradaria.mapa.' + (modo === 'online' && mundoAtual ? mundoAtual.codigo : 'local'));
  aplicarMinimapa();
  garagem.comecar(mundo, veiculos, veiculosP);
  guerra.comecar();
  aplicarSom();
  ajustarNevoa();
  desenharBarra();
  $('#bt-voar').classList.remove('ligado'); $('#bt-descer').hidden = true; $('#bt-agachar').hidden = false;
  ctrl.soltarAgachar();
  // pré-carrega o pedaço onde o jogador está
  mundo.atualizar(jog.pos.x, jog.pos.z, 400);
  $('#menu').hidden = true;
  $('#hud').hidden = false;
  $('#fps').hidden = !ajustes.fps;
  jogando = true; pausado = false;
  setTimeout(() => { $('#dica-toque').style.opacity = 0; }, 9000);
  const vazia = () => !Object.keys(mercado.e.itens).length;
  if (sobrev()) setTimeout(() => {
    if (jogando && sobrev() && vazia()) aviso('Neste mundo você junta o que quebrar! Segure o dedo numa árvore para pegar Tronco e depois abra a Mochila para criar.', 7000, 'mochila');
  }, 3000);
}

// sem internet: continua o mundo salvo; se ainda não tem, ou `novo` vem com as opções escolhidas, cria um
function jogarLocal(novo = null, idadeOk = false) {
  let salvo = null;
  try { salvo = JSON.parse(localStorage.getItem('pradaria.local') || 'null'); } catch {}
  if (!salvo && !novo) { abrirNovo('local'); return; }
  if (novo) salvo = null;
  // Guerra (e outros temas sensíveis): pergunta a idade antes
  if (!idadeOk && precisa16(salvo ? salvo.opcoes : novo.opcoes)) {
    confirmarIdade16(normalizarOpcoes(salvo ? salvo.opcoes : novo.opcoes).tipo === 'guerra' ? 'O mundo de Guerra' : 'Este mundo').then((ok) => { if (ok) jogarLocal(novo, true); else if (!jogando) mostrarMenu('m-inicio'); });
    return;
  }
  // mundo novo não herda os lugares marcados nem a marca do mapa do mundo antigo
  if (novo) {
    try { localStorage.removeItem('pradaria.lugares.local'); localStorage.removeItem('pradaria.mapa.local'); } catch {}
  }
  modo = 'local'; mundoAtual = null;
  if (salvo && salvo.barra) barra = salvo.barra;
  tempoDia = salvo ? salvo.dia ?? 0.3 : 0.3;
  iniciarMundo({
    semente: salvo ? salvo.semente : novo.semente ?? Math.floor(Math.random() * 1e9), edicoes: salvo ? salvo.edicoes : [],
    edicoes: salvo ? salvo.edicoes : novo.edicoes || [], // mundo importado de arquivo já vem com blocos
    pos: salvo && salvo.pos, yaw: salvo ? salvo.yaw : 0,
    // mundos salvos antes das opções existirem continuam do jeito que eram
    opcoes: salvo ? salvo.opcoes || PADRAO_MUNDO : novo.opcoes,
    veiculos: salvo && salvo.veiculos, veiculosP: salvo && salvo.veiculosP,
    guardado: salvo ? { barra: salvo.barra } : null,
  });
  if (novo) salvarLocal();
  cmd.entrouLocal();
  mercado.iniciar({ opcoes: opcoesMundo, novo: !!novo });
  if (novo) try { localStorage.removeItem('pradaria.inv.local'); localStorage.removeItem('pradaria.corpo.local'); localStorage.removeItem('pradaria.fornos.local'); localStorage.removeItem('pradaria.baus.local'); } catch {}
  prepararInventario();
  desenharBarra();
  $('#status').innerHTML = comIcone('casa', 'Sem internet');
  aviso('Bem-vindo à Pradaria!', 2500, 'flor');
}

async function jogarOnline(m, volta = null) {
  $('#mundos-erro').textContent = '';
  if (precisa16(m.opcoes) && !(await confirmarIdade16(normalizarOpcoes(m.opcoes).tipo === 'guerra' ? 'O mundo de Guerra' : 'Este mundo'))) return;
  modo = 'online'; mundoAtual = m;
  mostrarMenu('m-carregando');
  $('#carregando-txt').textContent = `Entrando em "${m.nome}"…`;
  let primeiro = true;
  sala = new Sala(m.codigo, {
    status: (s) => { if (jogando) $('#status').innerHTML = s === 'online' ? comIcone('globo', m.nome) : comIcone('ampulheta', 'Reconectando…'); },
    ola: (msg) => {
      euId = msg.eu;
      if (primeiro) {
        primeiro = false;
        const s = sala; sala = null; // evita que iniciarMundo feche a sala
        tempoDia = msg.dia ?? 0.3;
        iniciarMundo({ semente: msg.semente, edicoes: msg.edicoes, pos: (volta && volta.pos) || msg.pos, yaw: volta ? volta.yaw : 0, opcoes: msg.opcoes || m.opcoes, guardado: { barra: msg.barra } });
        sala = s;
        cmd.entrouOnline(msg);
        armas.entrouOnline(s);
        mercado.iniciar({ opcoes: msg.opcoes, estado: msg.econ, sala: s });
        prepararInventario();
        drops.ligarSala(s, msg.eu, msg.chao);
        desenharBarra();
        $('#status').innerHTML = comIcone('globo', m.nome);
        if (volta) aviso(volta.msg, 3500, 'lapis');
        else aviso(`Bem-vindo, ${conta.usuario.nome}!` + (m.dono ? ` Código do mundo: ${m.codigo}` : ''), 3500, 'flor');
        chat.entrou(msg);
      } else {
        mundo.carregarEdicoes(msg.edicoes);
        chat.reconectou(msg);
        armas.entrouOnline(sala);
        if (msg.econ) { mercado.recebeu(msg.econ); desenharBarra(); } // reconectou: a mochila certa é a do servidor
        drops.ligarSala(sala, msg.eu, msg.chao);
      }
      for (const id of [...outros.keys()]) removerOutro(id);
      for (const j of msg.jogadores) adicionarOutro(j);
      garagem.ola(msg);
    },
    vnovo: (m) => garagem.mensagem(m), vassento: (m) => garagem.mensagem(m), vmov: (m) => garagem.mensagem(m),
    vfim: (m) => garagem.mensagem(m), buzina: (m) => garagem.mensagem(m), vestado: (m) => garagem.mensagem(m),
    entrou: (msg) => { adicionarOutro(msg.j); aviso(`${msg.j.nome} entrou no mundo`, 1800, 'acenar'); som.oi(); },
    skin: (msg) => {
      const o = outros.get(msg.id);
      if (!o || !msg.s) return;
      vestirBoneco(o, msg.s);
      o.corCss = '#' + corDe(CORES_ROUPA, o.skin.corRoupa).toString(16).padStart(6, '0');
    },
    saiu: (msg) => { const o = outros.get(msg.id); if (o) aviso(`${o.nome} saiu`); chat.jogadorSaiu(msg.id); removerOutro(msg.id); },
    chat: (msg) => chat.recebeu(msg), 'chat-erro': (msg) => chat.erro(msg), 'chat-op': (msg) => chat.aplicarOp(msg),
    voz: (msg) => chat.mensagemVoz(msg), 'voz-lista': (msg) => chat.mensagemVoz(msg), 'voz-sinal': (msg) => chat.mensagemVoz(msg), 'voz-fala': (msg) => chat.mensagemVoz(msg),
    pos: recebeuPos,
    bloco: (msg) => {
      if (!mundo) return;
      const antes = mundo.bloco(msg.x, msg.y, msg.z);
      if (msg.b === FOGO && Array.isArray(msg.bom) && msg.bom.length === 3 && msg.bom.every(Number.isInteger)) mundo.marcarFogo(msg.x, msg.y, msg.z, msg.bom); // fogo de verdade (a sala marcou, com o isqueiro de origem)
      mundo.definir(msg.x, msg.y, msg.z, msg.b, true);
      // o amigo quebrou/colocou: ouve de onde foi (só o que alguém fez, não a água escorrendo)
      if (msg.j && antes !== msg.b) som.em(meioDe(msg.x, msg.y, msg.z), () => (msg.b ? som.colocar(msg.b) : som.quebrar(antes)));
    },
    racha: (msg) => { if (escav) escav.remoto(msg.x, msg.y, msg.z, msg.b, msg.n, msg.de); },
    blocos: (msg) => { if (Array.isArray(msg.l)) porBlocosObra(msg.l, true); },
    emote: (msg) => {
      const o = outros.get(msg.id);
      const nome = nomeEmote(msg.e); // aceita nome novo ou emoji de versão antiga
      if (o && bichos && nome) bichos.icone(nome, o.grupo.position.x, o.grupo.position.y + 2.7, o.grupo.position.z, 2, 0.6);
    },
    erro: (msg) => { aviso(msg.msg || 'Erro', 3000); },
    chao: (msg) => drops.recebeuChao(msg.d),
    forno: (msg) => fornoDaSala(msg),
    bau: (msg) => bauDaSala(msg),
    'chao-pegou': (msg) => drops.recebeuPegou(msg, (j) => { const o = outros.get(j); return o ? o.grupo.position.clone().setY(o.grupo.position.y + 0.9) : null; }),
    econ: (msg) => { mercado.recebeu(msg.s, msg.feitos, msg.msg, msg); desenharBarra(); },
    'econ-erro': (msg) => mercado.erro(msg.msg, msg),
    // o dono editou o mundo: nome novo vale na hora; opções novas recarregam o mundo (no mesmo lugar)
    'mundo-editado': (msg) => {
      clearTimeout(esperarEdicao);
      if (msg.nome) { mundoAtual.nome = msg.nome; $('#status').innerHTML = comIcone('globo', msg.nome); }
      if (msg.recarregar) recarregarOnline({ ...mundoAtual, opcoes: msg.opcoes });
      else if (msg.opcoes) { mundoAtual.opcoes = msg.opcoes; opcoesMundo.chatTexto = msg.opcoes.chatTexto; opcoesMundo.chatVoz = msg.opcoes.chatVoz; } // chat muda sem recarregar
      else if (!mundoAtual.dono && msg.nome) aviso(`O mundo agora se chama ${msg.nome}`, 2500, 'lapis');
    },
    fim: (texto) => { sala = null; sairDoMundo(); $('#mundos-erro').textContent = texto || ''; },
    ...cmd.rede,
    ...cama.rede,
    dia: (msg) => { cmd.rede.dia(msg); if (msg.dormiu) cama.dormiram(); },
    ...armas.rede,
    ...guerra.rede,
  });
}

let esperarEdicao = 0;
function recarregarOnline(m) {
  if (modo !== 'online' || !jogando) return;
  clearTimeout(esperarEdicao);
  const volta = { pos: [jog.pos.x, jog.pos.y + 0.05, jog.pos.z], yaw: jog.yaw, msg: m.dono ? 'Pronto! O mundo foi atualizado.' : 'O dono mudou as opções do mundo.' };
  enviarBarra();
  if (sala) sala.enviar({ t: 'pos', p: volta.pos, r: [jog.yaw, jog.pitch] });
  cmd.saiu();
  limparMundo();
  jogando = false; pausado = false; som.silenciarJogo();
  fecharJanelas();
  $('#hud').hidden = true;
  jogarOnline(m, volta);
  $('#carregando-txt').textContent = 'Atualizando o mundo…';
}

function sairDoMundo(op = {}) {
  if (jogando) enviarBarra();
  if (op.apagarLocal) { try { localStorage.removeItem('pradaria.local'); } catch {} } // apagado: não salva de novo
  else salvarLocal();
  cmd.saiu(); cama.sair();
  if (sala && jog) sala.enviar({ t: 'pos', p: [jog.pos.x, jog.pos.y, jog.pos.z], r: [jog.yaw, jog.pitch] });
  limparMundo();
  jogando = false; pausado = false; som.silenciarJogo();
  fecharJanelas();
  $('#hud').hidden = true;
  if (op.semMenu) return;
  if (conta.usuario) abrirMundos(); else mostrarMenu('m-inicio');
}

// ---------- menus de conta e mundos ----------
let modoConta = 'entrar', corEscolhida = 0, dataNasc = null;
function abrirConta(m) {
  modoConta = m;
  $('#conta-titulo').textContent = m === 'entrar' ? 'Entrar' : 'Criar conta';
  $('#c-ok').textContent = m === 'entrar' ? 'Entrar' : 'Criar e jogar';
  $('#c-senha').autocomplete = m === 'entrar' ? 'current-password' : 'new-password';
  $('#c-cores').hidden = m === 'entrar';
  $('#c-nasc-caixa').hidden = m === 'entrar';
  if (!dataNasc) dataNasc = seletorData($('#c-nasc'));
  contaModo(m);
  $('#c-erro').textContent = '';
  const cc = $('#c-cores');
  if (!cc.childElementCount) CORES.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.style.background = '#' + c.toString(16).padStart(6, '0');
    b.setAttribute('aria-label', 'Cor da camiseta ' + (i + 1));
    b.addEventListener('click', () => { corEscolhida = i; cc.querySelectorAll('button').forEach((x, k) => x.classList.toggle('sel', k === i)); });
    if (i === 0) b.classList.add('sel');
    cc.appendChild(b);
  });
  mostrarMenu('m-conta');
  setTimeout(() => { if (!$('#m-conta').contains(document.activeElement)) $('#c-nome').focus(); }, 50); // não rouba o foco de quem já está digitando
}
$('#bt-entrar').addEventListener('click', () => conta.token ? abrirJogos() : abrirConta('entrar'));
$('#bt-criar-conta').addEventListener('click', () => abrirConta('criar'));
$('#bt-sozinho').addEventListener('click', () => { som.iniciar(); jogarLocal(); });
$('#bt-sozinho2').addEventListener('click', () => { som.iniciar(); jogarLocal(); });
document.querySelector('[data-voltar]').addEventListener('click', () => mostrarMenu('m-inicio'));
document.querySelector('[data-voltar-mundos]').addEventListener('click', () => (modoNovo === 'local' && !conta.token ? mostrarMenu('m-inicio') : abrirMundos()));
$('#m-conta').addEventListener('submit', async (e) => {
  e.preventDefault();
  som.iniciar();
  $('#c-erro').textContent = '';
  const nascimento = modoConta === 'entrar' ? undefined : dataNasc.valor();
  if (modoConta !== 'entrar' && !nascimento) { $('#c-erro').textContent = 'Escolha o dia, o mês e o ano em que você nasceu.'; return; }
  $('#c-ok').disabled = true;
  try {
    const r = await api(modoConta === 'entrar' ? 'entrar' : 'cadastrar', { nome: $('#c-nome').value.trim(), senha: $('#c-senha').value, cor: corEscolhida, nascimento, skin: modoConta === 'entrar' ? undefined : skinLocal() || undefined });
    conta.salvar(r.token); conta.usuario = r.usuario;
    levarSkinLocal(); levarModelosLocal();
    $('#c-senha').value = '';
    abrirJogos();
  } catch (err) { $('#c-erro').textContent = err.message; }
  $('#c-ok').disabled = false;
});
const sairDaConta = () => { conta.salvar(null); conta.usuario = null; lobby.fechar(); mostrarMenu('m-inicio'); };
$('#bt-sair-conta').addEventListener('click', sairDaConta);
$('#bt-sair-conta2').addEventListener('click', sairDaConta);
$('#bt-personagem4').addEventListener('click', () => abrirPersonagem());
// ---------- amigos da plataforma: quem está online e convites (lobby.js, amigos.js) ----------
const lobby = new Lobby('hub');
async function entrarPorCodigo(codigo) {
  const entrar = () => api('mundos/entrar', { codigo });
  let r;
  try { r = await entrar(); } catch (err) {
    if (!/16 anos/.test(err.message)) throw err;
    if (!(await confirmarIdade16('O mundo do seu amigo'))) return;
    r = await entrar();
  }
  som.iniciar();
  jogarOnline(r.mundo);
}
const amigos = criarAmigos({
  lobby, som: () => { som.iniciar(); som.clique(); }, somConvite: () => som.convite(), somAviso: () => som.aviso(), aviso,
  contador: ({ online, pedidos }) => {
    const c = $('#amigos-contador');
    c.textContent = pedidos ? `${pedidos} pedido${pedidos > 1 ? 's' : ''}` : online ? `${online} online` : '';
    c.hidden = !c.textContent; c.classList.toggle('pedidos', !!pedidos);
  },
  async aceitarConvite(m) {
    const j = dadosJogo(m.jogo);
    if (!j || !j.pronto) return;
    if (m.jogo !== 'pradaria') { location.href = j.abrir + '?sala=' + encodeURIComponent(m.sala); return; }
    if (jogando && mundoAtual && mundoAtual.codigo === m.sala) { aviso('Você já está neste mundo!', 2000, 'globo'); return; }
    if (jogando) sairDoMundo({ semMenu: true });
    amigos.fechar();
    try { await entrarPorCodigo(m.sala); } catch (err) { aviso(err.message, 3000, 'relogio'); abrirMundos(); }
  },
});
$('#bt-amigos').addEventListener('click', () => { som.iniciar(); som.clique(); amigos.abrir(); });
$('#bt-chamar-amigos').addEventListener('click', () => {
  som.clique(); $('#pausa').hidden = true;
  amigos.abrir({ jogo: 'pradaria', sala: mundoAtual.codigo, titulo: mundoAtual.nome }, () => { if (jogando) abrirPausa(); });
});
ligarHub({ lobby, amigos, mostrarMenu, abrirMundos, som: () => { som.iniciar(); som.clique(); }, abrirConta: (m, msg) => { abrirConta(m); if (msg) $('#c-erro').textContent = msg; } });
ligarApagarConta(() => mostrarMenu('m-inicio'));
$('#bt-personagem').addEventListener('click', () => abrirPersonagem());
$('#bt-personagem2').addEventListener('click', () => abrirPersonagem());
$('#bt-personagem3').addEventListener('click', () => { $('#pausa').hidden = true; abrirPersonagem(() => { if (jogando) abrirPausa(); }); });

async function abrirMundos() {
  lobby.jogo('pradaria');
  mostrarMenu('m-carregando');
  $('#carregando-txt').textContent = 'Buscando seus mundos…';
  try {
    if (!conta.usuario) { conta.usuario = (await api('eu')).usuario; levarSkinLocal(); levarModelosLocal(); }
    const { mundos } = await api('mundos');
    nomesMeusMundos = mundos.filter(m => m.dono).map(m => m.nome);
    $('#m-nome').textContent = conta.usuario.nome;
    const l = $('#lista-mundos');
    l.innerHTML = '';
    if (!mundos.length) l.innerHTML = `<div class="vazio">${icone('broto')}<span>Você ainda não tem mundos. Crie um!</span></div>`;
    for (const m of mundos) {
      const b = document.createElement('button');
      b.className = 'mundo';
      b.innerHTML = `<span class="ic ${m.dono ? 'meu' : 'amigo'}">${icone(m.dono ? 'casa' : 'amigos')}</span><span class="txt"><b></b><small></small></span>${icone('entrar', 'ic-svg seta')}`;
      b.querySelector('b').textContent = m.nome;
      b.querySelector('small').textContent = m.dono ? `código ${m.codigo}` : `de ${m.nome_dono}`;
      b.querySelector('small').insertAdjacentHTML('beforeend', `<span class="ops-mini">${iconesOpcoes(m.opcoes)}</span>`);
      b.addEventListener('click', () => { som.iniciar(); jogarOnline(m); });
      if (!m.dono) { l.appendChild(b); continue; }
      // dono: lápis ao lado para editar nome e opções
      const linha = document.createElement('div');
      linha.className = 'linha-mundo';
      const ed = document.createElement('button');
      ed.type = 'button'; ed.className = 'bt-editar'; ed.innerHTML = icone('lapis', 'ic-svg');
      ed.setAttribute('aria-label', 'Editar ' + m.nome); ed.title = 'Editar o mundo';
      ed.addEventListener('click', () => { som.iniciar(); som.clique(); abrirEditarMundo({ mundo: m, opcoes: m.opcoes, som: () => som.clique(), aoSalvar: () => abrirMundos(), aoApagar: () => abrirMundos() }); });
      linha.append(b, ed);
      l.appendChild(linha);
    }
    mostrarMenu('m-mundos');
  } catch (err) {
    if (/sess|entrar|401/i.test(err.message)) { conta.salvar(null); conta.usuario = null; abrirConta('entrar'); $('#c-erro').textContent = 'Entre de novo, por favor.'; }
    else { mostrarMenu('m-inicio'); alert('Não consegui falar com o servidor agora. Você pode jogar sem internet.\n\n' + err.message); }
  }
}

// ---------- criar mundo: nome + opções (o que vai ter no mundo) + semente ----------
const iconesOpcoes = (o) => { const n = normalizarOpcoes(o); return (n.tipo !== 'normal' ? icone(TIPOS[n.tipo].icone, 'ic-svg ic-mini') : '') + (n.estilo !== 'blocos' ? icone(ESTILOS[n.estilo].icone, 'ic-svg ic-mini') : '') + (TIPOS[n.tipo].limite ? '' : icone(TAMANHOS[n.tamanho].icone, 'ic-svg ic-mini')) + OPCOES_MUNDO.filter((x) => n[x.id]).map((x) => icone(x.icone, 'ic-svg ic-mini')).join(''); };
function resumoOpcoes(o) {
  const n = normalizarOpcoes(o);
  const t = TAMANHOS[n.tamanho];
  const mods = [...(TIPOS[n.tipo].oculto || n.tipo === 'normal' ? [] : [TIPOS[n.tipo].nome]), ...OPCOES_MUNDO.filter((x) => x.aba === 'mods' && n[x.id]).map((x) => x.nome), ...(n.estilo === 'suave' ? [ESTILOS.suave.nome] : [])];
  return [MODOS_JOGO[modoJogoDe(n)].nome, DIFICULDADES[n.dificuldade].nome, TIPOS[n.tipo].limite ? null : `mundo ${t.nome.toLowerCase()}`].filter(Boolean).join(' · ')
    + ' · ' + (mods.length ? 'Mods: ' + mods.join(', ') : 'sem mods');
}
let escolhaNovo = { ...PADRAO_NOVO };
function desenharOpcoesNovo() {
  const lt = $('#n-tamanhos');
  lt.innerHTML = '';
  for (const [id, t] of Object.entries(TAMANHOS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opcao-mundo'; b.dataset.tamanho = id; b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="ic"></span><b></b><small></small>';
    b.querySelector('.ic').innerHTML = icone(t.icone); b.querySelector('b').textContent = t.nome; b.querySelector('small').textContent = t.desc;
    b.addEventListener('click', () => { escolhaNovo.tamanho = id; marcarTamanho(); som.iniciar(); som.clique(); });
    lt.appendChild(b);
  }
  // abas Regras e Mods (editar-mundo.js: as mesmas da edição)
  desenharRegrasMods($('#n-regras'), $('#n-mods'), escolhaNovo, { criando: true, aoMudar: () => { som.iniciar(); som.clique(); marcarTamanho(); } });
  desenharAbas($('#n-abas'), $('#m-novo'), escolhaNovo);
  marcarTamanho();
}
function marcarTamanho() {
  // mapas com tamanho fixo (Ilha de Aventura, Guerra) escondem a escolha de tamanho
  const fixo = !!TIPOS[escolhaNovo.tipo]?.limite;
  $('#n-tamanhos').hidden = fixo; $('#n-tamanhos-titulo').hidden = fixo;
  for (const b of $('#n-tamanhos').children) { const sel = b.dataset.tamanho === escolhaNovo.tamanho; b.setAttribute('aria-pressed', String(sel)); b.setAttribute('aria-checked', String(sel)); }
  atualizarAbas($('#n-abas'), escolhaNovo);
}
let modoNovo = 'criar';
// nome sugerido ao criar: "Mundo 01", "Mundo 02"... o primeiro número que o jogador ainda não usou
let nomesMeusMundos = [];
function proximoNomeMundo(nomes) {
  const usados = new Set();
  for (const n of nomes) { const r = /^\s*mundo\s+0*(\d{1,4})\s*$/i.exec(n || ''); if (r) usados.add(+r[1]); }
  let i = 1;
  while (usados.has(i) && i < 9999) i++; // no máximo 4 dígitos (o nome não aceita 5 números seguidos)
  return 'Mundo ' + String(i).padStart(2, '0');
}
function abrirNovo(modoN) {
  modoNovo = modoN;
  const comOpcoes = modoN !== 'codigo';
  $('#novo-titulo').textContent = modoN === 'codigo' ? 'Entrar no mundo de um amigo' : modoN === 'local' ? 'Novo mundo sem internet' : 'Novo mundo';
  $('#novo-rotulo').firstChild.textContent = modoN === 'codigo' ? 'Código do mundo' : 'Nome do mundo';
  $('#novo-rotulo').hidden = modoN === 'local';
  $('#n-nome').required = modoN !== 'local';
  $('#n-nome').value = modoN === 'criar' ? proximoNomeMundo(nomesMeusMundos) : ''; $('#n-nome').maxLength = modoN === 'codigo' ? 8 : 24; $('#n-erro').textContent = '';
  $('#m-novo button[type=submit]').textContent = modoN === 'codigo' ? 'Entrar' : 'Criar';
  $('#n-opcoes').hidden = !comOpcoes;
  if (comOpcoes) { escolhaNovo = { ...PADRAO_NOVO }; $('#n-semente').value = ''; desenharOpcoesNovo(); }
  mostrarMenu('m-novo');
}
$('#bt-novo-mundo').addEventListener('click', () => abrirNovo('criar'));
// importar: o arquivo vira um mundo novo da conta (com código novo)
$('#bt-importar').addEventListener('click', async () => {
  som.iniciar();
  $('#mundos-erro').textContent = '';
  const a = await escolherArquivo();
  if (!a) return;
  if (a.erro) { $('#mundos-erro').textContent = a.erro; return; }
  const bt = $('#bt-importar'); bt.disabled = true;
  try {
    const arquivo = montarArquivo(a);
    const nome = /^[A-Za-zÀ-ÿ0-9 ]{2,24}$/.test(a.nome) && !nomesMeusMundos.includes(a.nome) ? a.nome : proximoNomeMundo(nomesMeusMundos);
    await api('mundos/importar', { arquivo, nome });
    await abrirMundos();
  } catch (e) { $('#mundos-erro').textContent = e.message; }
  bt.disabled = false;
});
$('#bt-codigo').addEventListener('click', () => abrirNovo('codigo'));
$('#m-novo').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#n-erro').textContent = '';
  const semente = $('#n-semente').value.trim();
  if (modoNovo === 'local') { som.iniciar(); jogarLocal({ opcoes: { ...escolhaNovo }, semente: sementeDeTexto(semente) }); return; }
  try {
    const v = $('#n-nome').value.trim();
    const entrar = () => api('mundos/entrar', { codigo: v.toUpperCase() });
    let r;
    if (modoNovo === 'criar') r = await api('mundos', { nome: v, opcoes: { ...escolhaNovo }, semente });
    else {
      // mundo de um amigo com temas sensíveis (Guerra, Armas): o servidor pede a resposta dos 16 anos antes
      try { r = await entrar(); } catch (err) {
        if (!/16 anos/.test(err.message)) throw err;
        if (!(await confirmarIdade16('O mundo do seu amigo'))) return;
        r = await entrar();
      }
    }
    som.iniciar();
    jogarOnline(r.mundo);
  } catch (err) { $('#n-erro').textContent = err.message; }
});

// ---------- som ambiente (vento, água, passarinhos, grilos, caverna) e música ----------
const amb = { t: 0, agua: 0, arvores: 0, coberto: false };
function ambienteSom(dt) {
  amb.t -= dt;
  const c = camera.position;
  // olha o que tem em volta duas vezes por segundo (pouca conta: uma grade espaçada)
  if (amb.t <= 0) {
    amb.t = 0.5;
    const cx = Math.floor(c.x), cy = Math.floor(c.y), cz = Math.floor(c.z);
    let ag = 0, fo = 0;
    for (let dx = -8; dx <= 8; dx += 2) for (let dz = -8; dz <= 8; dz += 2) {
      for (let dy = -4; dy <= 0; dy += 2) if (AGUA[mundo.bloco(cx + dx, cy + dy, cz + dz)]) { ag++; break; }
      for (let dy = 1; dy <= 9; dy += 2) if (FOLHAGEM[mundo.bloco(cx + dx, cy + dy, cz + dz)]) { fo++; break; }
    }
    amb.agua = Math.min(1, ag / 18); amb.arvores = Math.min(1, fo / 14);
    amb.coberto = mundo.alturaEm(cx, cz) - c.y > 5;
  }
  som.caverna(amb.coberto);
  som.ambiente({ dt, dia: 1 - graf.U.uNoite.value, vento: forcaVento(), agua: amb.agua, arvores: amb.arvores, coberto: amb.coberto, altura: c.y, pausado, debaixoDagua: !!som.abafado });
  som.motoresQuadro();
}

// ---------- laço principal ----------
let turnoAcum = 0;
let ultimo = performance.now(), acumPos = 0, quadros = 0, tempoFps = 0, tempoTotal = 0, ultimoPasso = 0;
let miraToque = null;
const passoAntes = { x: 0, z: 0 };
const corTmp = new THREE.Color();

function laco(agora) {
  requestAnimationFrame(laco);
  // limite de FPS (economiza bateria); a folga de 2 ms evita pular quadro à toa
  if (jogando && ajustes.fpsMax && agora - ultimo < 1000 / ajustes.fpsMax - 2) return;
  const dt = Math.min(0.1, (agora - ultimo) / 1000);
  ultimo = agora;
  if (!jogando) { renderer.render(cena, camera); return; }
  tempoTotal += dt;

  if (!pausado && !morto) {
    const ent = ctrl.atualizar();
    if (!garagem.quadro(dt, ent, false) && !cama.quadro(dt, ent)) {
      jog.atualizar(dt, ent);
      queimarNaLava(dt);
      queimarNoFogo(dt);
      if ((jog.noChao || jog.naAgua) && Math.floor(jog.passo / 1.8) !== ultimoPasso) { ultimoPasso = Math.floor(jog.passo / 1.8); som.passo(jog.naAgua ? 'agua' : chaoDe(jog.pos.x, jog.pos.y, jog.pos.z), visao.agachado ? 0.18 : visao.correndo ? 0.45 : 0.35); }
    }
  }
  const dirigindo = garagem.camera(camera);
  if (!visao.quadro(dt, jog, camera, mundo, meuSkin, dirigindo, ctrl.estado) && !dirigindo) {
    camera.position.set(jog.pos.x, jog.pos.y + (jog.alturaOlhos ?? OLHOS) + (jog.olhosY ?? 0), jog.pos.z); // olhos (mais baixos agachado) + degrau suave e baque da queda
    camera.rotation.set(jog.pitch, jog.yaw, 0, 'YXZ');
  }

  som.ouvinte(camera.position.x, camera.position.y, camera.position.z, camera.rotation.y);
  ambienteSom(dt);
  mundo.energia.noite = graf.U.uNoite.value > 0.5;
  mundo.atualizar(jog.pos.x, jog.pos.z, ehToque ? 5 : 8, jog.pos.y);
  if (!pausado) vigiarPlaca();
  if (jog.quicou) { jog.quicou = false; som.boing(); }
  bichos.trigoNaMao = naMao() === B.TRIGO && (!sobrev() || qtd(B.TRIGO) > 0);
  bichos.atualizar(pausado ? 0 : dt, jog, tempoTotal, tempoDia);
  aldeoes.atualizar(dt, jog, Math.sin(tempoDia * Math.PI * 2));
  mecanismos.atualizar(pausado ? 0 : dt, jog, graf.U.uVento.value === 0);
  negocios.atualizar(dt, jog, tempoDia);
  // os trabalhadores contam o tempo a cada 3 s (online quem mede é a sala)
  turnoAcum += dt;
  if (turnoAcum >= 3) { mercado.turno(turnoAcum, horaDe(tempoDia)); turnoAcum = 0; }
  if (!pausado && !morto) { vida.atualizar(dt); quadroComer(dt); }
  desenharXp();
  if ((timerCorpo += dt) > 3) { timerCorpo = 0; salvarCorpo(); }
  armas.quadro(dt, pausado || garagem.dentro);
  if (garagem.dentro || visao.terceira) armas.mao.visible = false;
  mapa.atualizar(dt, jog, outros, bichos);
  mercado.passo(jog.pos.x - passoAntes.x, jog.pos.z - passoAntes.z, jog, mundo.alturaEm(Math.floor(jog.pos.x), Math.floor(jog.pos.z)));
  // fome (clássico): correr e nadar cansam pela distância (pulos grandes, como teleporte, não contam)
  if (!pausado && (jog.correndo || jog.naAgua) && !jog.voando) { const d = Math.hypot(jog.pos.x - passoAntes.x, jog.pos.z - passoAntes.z); if (d < 2) vida.cansar(d * (jog.correndo ? 0.1 : 0.01)); }
  passoAntes.x = jog.pos.x; passoAntes.z = jog.pos.z;

  // contorno do bloco mirado
  if (garagem.dentro) contorno.visible = false;
  else if (!ehToque || miraToque) {
    const dir = direcaoDe(miraToque);
    const h = mundo.raycast(raio.ray.origin, dir, 6);
    if (h && h.t > 0.05) { contorno.visible = true; contorno.position.set(h.x + 0.5, h.y + 0.5, h.z + 0.5); } else contorno.visible = false;
  } else contorno.visible = false;

  escav.atualizar(dt, jog.pos.x, jog.pos.z);
  fisica.atualizar(dt);
  plantacoes.atualizar(jog.pos.x, jog.pos.z);
  drops.quadro(dt, jog, !pausado && !garagem.dentro && !morto);
  if (mundo.aventura) verLugar();
  guerra.quadro(dt, pausado);
  // partículas de quebra
  for (let i = partQ.length - 1; i >= 0; i--) {
    const q = partQ[i];
    q.vida -= dt;
    if (q.confete) { q.v[1] = Math.max(q.v[1] - 14 * dt, -1.6); q.v[0] *= 1 - dt * 1.5; q.v[2] *= 1 - dt * 1.5; q.m.rotation.x += q.giro * dt; q.m.rotation.y += q.giro * 0.7 * dt; }
    else q.v[1] -= 15 * dt;
    q.m.position.x += q.v[0] * dt; q.m.position.y += q.v[1] * dt; q.m.position.z += q.v[2] * dt;
    if (q.vida <= 0) { cena.remove(q.m); partQ.splice(i, 1); }
  }

  // outros jogadores (interpolação suave)
  for (const o of outros.values()) {
    // sentado num veículo: anda junto com ele (e sai da pose de andar/agachar)
    if (o.sentado) { if (!o.neutro) { poseNeutra(o); o.neutro = true; } continue; }
    o.neutro = false;
    const g = o.grupo.position;
    // base = onde o amigo está (sem o ajuste dos pés); alguém mexeu no boneco por fora: recomeça dali
    if (!o.base || Math.abs(g.x - o.base.x) > 1e-3 || Math.abs(g.z - o.base.z) > 1e-3 || Math.abs(g.y - o.base.y - (o.pesNoChao || 0)) > 1e-3) { o.base = g.clone(); o.pesNoChao = 0; }
    o.base.lerp(o.alvo, Math.min(1, dt * 10));
    // Natural 3D: pés no chão desenhado (arredondado), como o nosso boneco (visao.js)
    let desce = 0;
    if (mundo.suave && !((o.acao | 0) & 14)) { const h = mundo.alturaVisual(o.base.x, o.base.y, o.base.z); if (h !== null && h < o.base.y) desce = h - o.base.y; }
    o.pesNoChao += (desce - o.pesNoChao) * Math.min(1, dt * 12);
    g.set(o.base.x, o.base.y + o.pesNoChao, o.base.z);
    // para onde o amigo olha (suave entre uma mensagem e outra); o corpo vira sozinho na animação
    o.yawOlhar += (((o.alvoYaw - o.yawOlhar + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10);
    // parou de chegar posição (aba escondida, rede caiu): para de andar
    if (performance.now() - (o.tPos || 0) > 1500) o.vRede.set(0, 0, 0);
    // ainda chegando no lugar (mensagens atrasadas): anda na velocidade com que o boneco se move na tela
    const fx = o.alvo.x - g.x, fz = o.alvo.z - g.z;
    if (o.vRede.x * o.vRede.x + o.vRede.z * o.vRede.z < 0.25 && fx * fx + fz * fz > 0.09) o.vTmp.set(fx * 10, o.vRede.y, fz * 10).clampLength(0, 9);
    else o.vTmp.copy(o.vRede);
    o.vAnim.lerp(o.vTmp, Math.min(1, dt * 8));
    // 1 = batendo, 2 = voando, 4 = na água, 8 = no ar, 16 = correndo, 32 = agachado (versões antigas só mandam até 8)
    const acao = o.acao | 0;
    if (acao & 1 && (o.golpe ?? 1) >= 1) { o.golpe = 0; o.acao = acao & ~1; } // uma batida por aviso (senão repete ou fica batendo para sempre)
    if ((o.golpe ?? 1) < 1) o.golpe = Math.min(1, o.golpe + dt / 0.3);
    const v = o.vAnim, noChao = !(acao & 14);
    animarBoneco(o, {
      vx: v.x, vz: v.z, vy: v.y, y: g.y, yaw: o.yawOlhar, pitch: o.alvoPitch || 0,
      noChao, voando: !!(acao & 2), naAgua: !!(acao & 4),
      // versão antiga não manda "correndo": deduz pela velocidade (só de quem nunca mandou as flags novas)
      correndo: !!(acao & 16) || (!o.flagsNovas && noChao && Math.hypot(v.x, v.z) > 6), agachado: !!(acao & 32),
      golpe: o.golpe ?? 1,
    }, dt);
    // passos do amigo: ouve de onde ele está, com o som do chão que ele pisa
    if (noChao || acao & 4) {
      const vel = Math.hypot(v.x, v.z);
      o.passoAc = (o.passoAc || 0) + vel * dt;
      if (o.passoAc > 1.9) { o.passoAc = 0; if (vel > 0.8) som.em(g, () => som.passo(acao & 4 ? 'agua' : chaoDe(g.x, g.y, g.z), acao & 32 ? 0.18 : 0.35)); }
    }
  }

  // ciclo de dia e noite (a noite é clarinha: nada de medo!)
  if (opcoesMundo.cicloDia) tempoDia = (tempoDia + dt / DURACAO_DIA) % 1;
  const ang = tempoDia * Math.PI * 2;
  const s = Math.sin(ang); // 0.25 -> 1 (meio-dia), 0.75 -> -1 (meia-noite)
  const luz = THREE.MathUtils.clamp(0.62 + s * 0.6, 0.5, 1);
  const horizonte = graf.atualizar(dt, tempoDia, jog.pos, mundo);
  cena.fog.color.copy(horizonte);
  graf.ajustarNevoa(cena.fog.near, cena.fog.far, horizonte);
  agua.quadro({ dt, jog, mundo, camera, pausado, noVeiculo: !!garagem.dentro, restaurarNevoa: ajustarNevoa });
  const cx = camera.position.x, cz = camera.position.z;
  void ang;
  nuvens.position.x = ((tempoTotal * 1.2) % 360) - 180 + Math.floor(cx / 360) * 360;
  nuvens.position.z = Math.floor(cz / 360) * 360;
  nuvens.material.color.setRGB(0.035, 0.04, 0.07).lerp(corTmp.setRGB(1, 1, 1), 1 - graf.U.uNoite.value).lerp(corTmp.setRGB(1, 0.72, 0.55), graf.U.uPor.value * 0.6);

  // rede: posição ~8x por segundo
  if (sala) {
    acumPos += dt;
    if (acumPos > 0.125) { acumPos = 0; sala.enviar({ t: 'pos', p: [+jog.pos.x.toFixed(2), +jog.pos.y.toFixed(2), +jog.pos.z.toFixed(2)], r: [+jog.yaw.toFixed(2), +jog.pitch.toFixed(2)], a: (visao.batendo ? 1 : 0) | (jog.voando ? 2 : 0) | (jog.naAgua ? 4 : 0) | (!jog.noChao && !jog.voando && !jog.naAgua ? 8 : 0) | (visao.correndo ? 16 : 0) | (visao.agachado ? 32 : 0) }); }
  }
  // salvamento local a cada 5s
  salvarLocalTimer += dt;
  if (salvarLocalTimer > 5) { salvarLocalTimer = 0; if (modo === 'local') salvarLocal(); }

  // armas na mão dos bonecos (o meu, em 3ª pessoa, e o dos amigos): braço esticado segurando
  if (opcoesMundo.armas) {
    if (visao.boneco) armas.armaDeOutro(visao.boneco, visao.terceira && armas.atual ? armas.atual.a : null);
    armas.segurar(visao.boneco ? [visao.boneco, ...outros.values()] : outros.values());
  }
  if (pos.ativo) pos.render(null, graf.U); else renderer.render(cena, camera);
  quadros++; tempoFps += dt;
  if (tempoFps > 1) {
    if (ajustes.fps) $('#fps').textContent = `${quadros} fps · ${renderer.info.render.calls} draws · ${opcoesGraficas().nome}`;
    vigiarDesempenho(quadros / tempoFps);
    quadros = 0; tempoFps = 0;
  }
}
// se o aparelho sofrer, deixa os gráficos mais leves sozinho (uma vez por nível)
let segundosLentos = 0, segundosJogando = 0;
// Automático: começa no palpite e calibra jogando. Sobra fôlego por uns segundos → sobe um nível;
// engasga → desce e marca esse nível como teto deste aparelho (para não ficar subindo e descendo).
const calib = {
  bons: 0, ruins: 0, aguardar: 0,
  reiniciar() { this.bons = 0; this.ruins = 0; this.aguardar = 4; },
  passo(fps) {
    if (this.aguardar > 0) { this.aguardar--; return; }
    const alvo = ajustes.fpsMax || 60; // tela de 60 Hz não passa de ~60
    const atual = NIVEIS.indexOf(nivelAuto());
    // sem teto marcado: no máximo um nível acima do palpite, e tablet/celular ou pouca memória nunca vão sozinhos ao Ultra
    const fraco = ehToque || (navigator.deviceMemory || 8) <= 4;
    const tetoPadrao = Math.min(NIVEIS.indexOf(palpiteGrafico()) + 1, NIVEIS.length - (fraco ? 2 : 1));
    const teto = NIVEIS.includes(ajustes.grafTeto) ? NIVEIS.indexOf(ajustes.grafTeto) : tetoPadrao;
    this.bons = fps >= alvo * 0.9 ? this.bons + 1 : 0;
    this.ruins = fps < alvo * 0.62 ? this.ruins + 1 : 0;
    let novo = atual;
    if (this.ruins >= 3 && atual > 0) { novo = atual - 1; ajustes.grafTeto = NIVEIS[novo]; }
    else if (this.bons >= 5 && atual < teto) novo = atual + 1;
    if (novo === atual) {
      if (this.ruins >= 3 && atual === 0 && ajustes.qual > 0.6) { ajustes.qual = Math.max(0.6, +(ajustes.qual - 0.1).toFixed(1)); salvarAjustes(); redimensionar(); this.reiniciar(); }
      return;
    }
    ajustes.grafAuto = NIVEIS[novo];
    salvarAjustes(); aplicarGraficos(); preencherGraficos();
    if (mundo) mundo.raio = raioVisao();
    ajustarNevoa();
    this.reiniciar();
    if (novo < atual) aviso('Ajustei os gráficos para rodar liso', 2200, 'brilho');
  },
};
function vigiarDesempenho(fps) {
  if (!jogando || pausado || document.hidden || window.__semAuto) return;
  segundosJogando++;
  if (segundosJogando < 6) return; // espera o mundo carregar
  if (ajustes.graf === 'auto') { calib.passo(fps); return; }
  if (!ajustes.auto) return;
  segundosLentos = fps < 24 ? segundosLentos + 1 : 0;
  if (segundosLentos >= 5) {
    segundosLentos = 0;
    const ordem = ['baixa', 'media', 'alta', 'ultra'];
    let i = ordem.indexOf(ajustes.graf);
    if (i < 0) i = opcoesGraficas().sombra > 1024 ? 2 : 1; // personalizado: desce para o preset logo abaixo
    if (i > 0) {
      ajustes.graf = ordem[i - 1]; salvarAjustes(); aplicarGraficos(); preencherGraficos();
      if (mundo) mundo.raio = raioVisao();
      ajustarNevoa();
      aviso('Deixei os gráficos mais leves para rodar liso', 2500, 'brilho');
    } else if (ajustes.qual > 0.6) {
      ajustes.qual = Math.max(0.6, +(ajustes.qual - 0.1).toFixed(1)); salvarAjustes(); redimensionar();
    }
  }
}
// TV: navegar nos menus com o controle remoto, controle de videogame e o celular como controle
const tv = iniciarTV({
  ctrl: () => ctrl,
  jogando: () => jogando,
  emJogo: () => jogando && !pausado && !personagem.aberto,
  pausar: abrirPausa, fechar: fecharJanelas, pausarSem: (sim) => { pausado = sim; },
  inventario: () => abrirInventario(), mapa: () => mapa.abrir(), visao: alternarVisao, alternarVoo, largar: () => largarDaMao(false),
  aviso,
  // tela dividida na TV: em que mundo online estou, e entrar no mundo do outro jogador
  mundo: () => (jogando && modo === 'online' && mundoAtual && mundoAtual.codigo ? { codigo: mundoAtual.codigo, nome: mundoAtual.nome || '' } : null),
  async entrarMundo(codigo) {
    try { if (jogando) sairDoMundo({ semMenu: true }); await entrarPorCodigo(codigo); } catch (err) { aviso(err.message, 3000, 'relogio'); abrirMundos(); }
  },
});
requestAnimationFrame(laco);
addEventListener('beforeunload', () => salvarLocal());
document.addEventListener('visibilitychange', () => { som.pausarTudo(document.hidden); if (document.hidden) { salvarLocal(); if (jogando) enviarBarra(); } });
void edicoesPendentes;

// início: se já tem sessão, vai direto para a escolha do jogo
camera.position.set(0, 40, 0);
// convite aceito em outra página (xadrez, dama...): /?mundo=CODIGO entra direto no mundo do amigo
const mundoPedido = new URLSearchParams(location.search).get('mundo');
if (mundoPedido) history.replaceState(null, '', location.pathname + location.hash);
if (conta.token) abrirJogos().then(() => { if (mundoPedido && conta.usuario) entrarPorCodigo(mundoPedido.toUpperCase()).catch((err) => aviso(err.message, 3000, 'relogio')); });
else mostrarMenu('m-inicio');

// modo de teste automatizado
if (location.hash === '#teste') { window.__jogo = { get ctrl() { return ctrl; }, amigo: { entrou: (j) => adicionarOutro(j), pos: recebeuPos }, get outros() { return outros.size; }, get outrosLista() { return [...outros.values()]; }, get sala() { return sala; }, get mundoAtual() { return mundoAtual; }, get jog() { return jog; }, get mundo() { return mundo; }, get bichos() { return bichos; }, agua, get aldeoes() { return aldeoes; }, garagem, visao, chat, personagem, get meuSkin() { return meuSkin(); }, mercado, conversarCom, comoJogador, vida, opcoesMundo, get tempoDia() { return tempoDia; }, set dia(v) { tempoDia = v; }, get dia() { return tempoDia; }, get barra() { return barra; }, set slot(v) { slotSel = v; }, get inv() { return inv; }, abrirInventario, bancadaPerto, camera, graf, pos, renderer, ajustes, calib, vigiarDesempenho, palpiteGrafico, opcoesGraficas, jogarLocal, usar, quebrar, cmd, mapa, mecanismos, armas, get pausado() { return pausado; }, guerra, drops, largarDaMao, tv, get plantacoes() { return plantacoes; }, get escav() { return escav; }, som, fornos, get fornoAberto() { return fornoAberto; }, baus, get bauAberto() { return bauAberto; } }; }

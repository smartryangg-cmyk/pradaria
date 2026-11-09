// Pradaria: jogo de construir e explorar, pacífico, para o navegador.
import * as THREE from '../vendor/three.module.min.js';
import { criarAtlas, iconeBloco, INVENTARIO, INVENTARIO_MAQUINAS, B, E, AR, BLOCOS, SOLIDO, AGUA, PRECISA_CHAO, ITEM, ehItem, nomeDe } from './blocos.js';
import { oQueCai, toquesCom, receitasDoMundo, GRUPOS, podeCriar, faltaBancada, gastoDe } from './receitas.js';
import { BASE, PRECISA_ENERGIA, ELETRICO } from './energia.js';
import { Mundo, ALT, NIVEL_AGUA } from './mundo.js';
import { Jogador, OLHOS } from './jogador.js';
import { Controles } from './controles.js';
import { Bichos } from './animais.js';
import { Aldeoes } from './aldeoes.js';
import { Garagem } from './garagem.js';
import { Som } from './som.js';
import { montarBoneco, vestirBoneco, etiqueta, matModelo, caixa, juntar, animarBoneco } from './modelos.js';
import { normalizarSkin, skinDeCor, skinIgual, CORES_ROUPA } from './skin.js';
import { Personagem } from './personagem.js';
import { Visao } from './visao.js';
import { Chat } from './chat.js';
import { conta, api, Sala } from './rede.js';
import { criarGraficos, QUALIDADES, PESSOAIS } from './graficos.js';
import { MapaIlha } from './mapa-ilha.js';
import { ICONE_LUGAR } from './ilha-aventura.js';
import { criarPosEfeitos } from './posefeitos.js';
import { icone, preencherIcones, comIcone, nomeEmote } from './icones.js';
import { Escavacao, toquesPara } from './escavar.js';
import { Fisica } from './fisica.js';
import { criarComandos } from './comandos.js';
import { OPCOES_MUNDO, PADRAO_MUNDO, PADRAO_NOVO, TAMANHOS, TIPOS, ESTILOS, normalizarOpcoes, definirOpcoesMundo, opcoesMundo, sementeDeTexto, raioExtraMundo } from './opcoes-mundo.js';
import { vida } from './vida.js';
import { Mapa } from './mapa.js';
import { Mercado } from './mercado.js';
import { Negocios } from './negocios.js';
import { MV } from './moveis.js';
import { horaDe } from './trabalho.js';
import { VERSAO } from './versao.js';
import { preencherDono, contaModo, ligarApagarConta } from './dono.js';
import { abrirEditarMundo, desenharEstilos, desenharListaOpcoes, marcarLista, baixarArquivo, escolherArquivo, montarArquivo } from './editar-mundo.js';
import { Mecanismos } from './mecanismos.js';

const $ = (s) => document.querySelector(s);
preencherIcones();
const CORES = [0x3f6fd9, 0xe8433f, 0x4caf50, 0xf2c72e, 0x9c5bd9, 0xf29ac2, 0xff8a3d, 0x2bb3b3];

// ---------- ajustes salvos ----------
const ehToque = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (ehToque) document.body.classList.add('toque');
const AJ_PADRAO = { dist: ehToque ? 3 : 4, qual: ehToque ? 0.8 : 1, graf: 'auto', grafAuto: null, grafTeto: null, grafManual: false, gopc: null, ...PESSOAIS, auto: true, sens: 0.0055, som: true, fps: false, minimapa: true };
let ajustes = { ...AJ_PADRAO };
try { Object.assign(ajustes, JSON.parse(localStorage.getItem('pradaria.ajustes') || '{}')); } catch {}
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
renderer.outputColorSpace = THREE.SRGBColorSpace;
const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
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

// nuvens
const nuvens = (() => {
  const g = [];
  const r = Math.random;
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 360, z = (r() - 0.5) * 360;
    const w = 12 + r() * 20, d = 8 + r() * 14;
    g.push(caixa(w, 3, d, 0xffffff, x, 0, z));
    if (r() < 0.6) g.push(caixa(w * 0.6, 3, d * 0.6, 0xffffff, x + w * 0.3, 1.5, z + d * 0.2));
  }
  const m = new THREE.Mesh(juntar(g), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
  m.position.y = ALT + 20;
  cena.add(m);
  return m;
})();

function aplicarGraficos() {
  const o = graf.aplicar(opcoesGraficas());
  nuvens.visible = o.nuvens;
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
let mundo = null, jog = null, ctrl = null, bichos = null, aldeoes = null, sala = null, escav = null, fisica = null;
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
const personagem = new Personagem({ som, salvar: salvarSkin });
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
  // trabalhadores contratados (negocios.js / trabalho.js)
  pos: () => (jog ? [jog.pos.x, jog.pos.y, jog.pos.z] : null),
  porBlocos: (l) => porBlocosObra(l, false),
  trabalhoMudou: (antes, depois, extra) => negocios.estadoMudou(antes, depois, extra),
  erro: (r) => negocios.respostaObra(false, r),
  abrirNegocios: () => negocios.abrir(),
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

function desenharBarra() {
  const el = $('#barra');
  el.innerHTML = '';
  const sv = sobrev();
  barra.forEach((id, i) => {
    const b = document.createElement('button');
    const n = sv && id ? qtd(id) : 0;
    b.className = 'slot' + (i === slotSel ? ' sel' : '') + (sv && id && !n ? ' acabou' : '');
    b.setAttribute('aria-label', id ? nomeDe(id) + (sv ? ` (${n})` : '') : 'Mão vazia');
    b.appendChild(iconeBloco(atlasCanvas, id, 48));
    if (!sv && !mercado.podeColocar(id)) { b.classList.add('trancado'); b.title = 'Compre na loja de uma vila'; b.insertAdjacentHTML('beforeend', `<span class="cad">${icone('cadeado')}</span>`); }
    if (sv && id && !ehItem(id) || sv && n > 1) { const q = document.createElement('b'); q.className = 'qtd'; q.textContent = n; b.appendChild(q); }
    b.addEventListener('click', () => { slotSel = i; som.clique(); desenharBarra(); aviso(id ? nomeDe(id) : 'Mão vazia', 900); });
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
const FERRAMENTAS_CRIATIVO = [ITEM.PICARETA_PEDRA, ITEM.MACHADO_PEDRA, ITEM.PA_PEDRA];
function abasDoMundo() {
  if (sobrev()) return [['mochila', 'mochila', 'Mochila'], ['criar', 'martelo', 'Criar']];
  return maquinasLigadas() ? [['blocos', 'tijolos', 'Blocos'], ['maquinas', 'engrenagem', 'Engenharia']] : [['blocos', 'tijolos', 'Blocos']];
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
  desenharBarra();
}
function abrirInventario(aba) {
  if (!jogando) return;
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
  $('#inv-titulo').textContent = { maquinas: 'Engenharia', mochila: 'Mochila', criar: 'Criar' }[abaInv] || 'Blocos';
  $('#inv-sub').textContent = abaInv === 'criar' ? 'Toque numa receita para criar' : abaInv === 'mochila' ? 'Toque para pôr na mão' : 'Escolha um bloco para a mão';
  const g = $('#grade');
  const rolagem = g.dataset.aba === abaInv ? g.scrollTop : 0;
  g.innerHTML = ''; g.dataset.aba = abaInv;
  g.classList.toggle('receitas', abaInv === 'criar');
  if (abaInv === 'criar') desenharReceitas(g);
  else if (abaInv === 'mochila') desenharMochila(g);
  else {
    const lista = abaInv === 'maquinas' ? INVENTARIO_MAQUINAS : [...INVENTARIO, ...FERRAMENTAS_CRIATIVO];
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

function desenharMochila(g) {
  const itens = Object.entries(mercado.e.itens).map(([k, n]) => [+k, n]).filter(([, n]) => n > 0)
    .sort((a, b) => (a[0] >= 1000) - (b[0] >= 1000) || a[0] - b[0]);
  if (!itens.length) {
    g.innerHTML = `<div class="vazio">${icone('mochila')}<span>A mochila está vazia. Segure o dedo num bloco para quebrar e pegar! Comece pelas árvores.</span></div>`;
    return;
  }
  for (const [id, n] of itens) {
    const b = document.createElement('button');
    b.title = nomeDe(id);
    b.appendChild(imgIcone(id));
    const q = document.createElement('b'); q.className = 'qtd'; q.textContent = n; b.appendChild(q);
    b.addEventListener('click', () => { porNaMao(id); som.clique(); fecharJanelas(); aviso(nomeDe(id), 900); });
    g.appendChild(b);
  }
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
  b.addEventListener('click', () => tocarReceita(r));
  return b;
}
function tocarReceita(r) {
  som.iniciar();
  const temBancada = bancadaPerto();
  if (podeCriar(mercado.e.itens, r, temBancada)) {
    mercado.criar(r.id, temBancada);
    som.colocar();
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
// depois de quebrar: mostra o que foi para a mochila (a conta de verdade é feita em economia.js)
function mostrarQueCaiu(b, x, y, z) {
  if (!sobrev()) return;
  for (const [id, n] of oQueCai(b, x, y, z)) { colocarNaBarra(id); mostrarColeta(id, n); }
}
// carinho na ovelha dá lã (uma vez a cada minuto por ovelha)
function laDaOvelha(bicho) {
  if (!sobrev() || bicho.especie !== 'ovelha') return;
  const agora = performance.now();
  if (bicho.laEm && agora - bicho.laEm < 60000) return;
  bicho.laEm = agora;
  setTimeout(() => { if (!jogando) return; mercado.evento('la'); colocarNaBarra(B.LA_BRANCA); mostrarColeta(B.LA_BRANCA, 1); }, 500);
}

function abrirPausa() {
  if (document.pointerLockElement) document.exitPointerLock();
  $('#aj-dist').value = ajustes.dist; $('#aj-qual').value = ajustes.qual; preencherGraficos(); $('#aj-sens').value = ajustes.sens;
  $('#aj-som').checked = ajustes.som; $('#aj-fps').checked = ajustes.fps; $('#aj-minimapa').checked = ajustes.minimapa;
  // o código só aparece para o dono (é ele quem decide quem entra)
  $('#pausa-mundo').textContent = modo === 'online' ? `Mundo: ${mundoAtual.nome}` + (mundoAtual.dono ? ` · código ${mundoAtual.codigo}` : '') : 'Mundo sem internet (salvo neste aparelho)';
  preencherDono(modo === 'online' ? mundoAtual : null, () => abrirPausa());
  $('#pausa-chat').hidden = !(modo === 'online' && mundoAtual && mundoAtual.dono);
  $('#pausa-opcoes').textContent = 'Neste mundo: ' + resumoOpcoes(opcoesMundo);
  // editar o mundo: só o dono (no mundo sem internet, quem joga é o dono)
  $('#bt-editar-mundo').hidden = !(modo === 'local' || (mundoAtual && mundoAtual.dono));
  $('#pausa').hidden = false;
  pausado = true;
}
function fecharJanelas() {
  $('#editar-mundo').hidden = true;
  $('#inventario').hidden = true; $('#pausa').hidden = true; $('#mapa').hidden = true; $('#mapa-ilha').hidden = true; $('#garagem').hidden = true;
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
  else if ((e.code === 'KeyR' || e.code === 'F5') && !pausado && e.target.tagName !== 'INPUT') { e.preventDefault(); if (!e.repeat) alternarVisao(); }
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
$('#aj-som').addEventListener('change', (e) => { ajustes.som = e.target.checked; som.ligado = ajustes.som; salvarAjustes(); });
$('#aj-minimapa').addEventListener('change', (e) => { ajustes.minimapa = e.target.checked; salvarAjustes(); aplicarMinimapa(); });
$('#minimapa').addEventListener('click', () => { som.clique(); mapa.abrir(); });
$('#bt-abrir-mapa').addEventListener('click', () => { $('#pausa').hidden = true; mapa.abrir(); });
$('#aj-fps').addEventListener('change', (e) => { ajustes.fps = e.target.checked; $('#fps').hidden = !ajustes.fps; salvarAjustes(); });
$('#bt-sair-mundo').addEventListener('click', sairDoMundo);

// ---------- comandos visuais (teleporte, casa, amigos, hora) ----------
// sem corações: desmaia, os bichos bravos vão embora e acorda em casa (ou no começo), sem perder nada
vida.aoDesmaiar = () => {
  if (!jogando) return;
  if (bichos) bichos.acalmar();
  const el = $('#desmaio');
  el.hidden = false; el.classList.remove('vai'); void el.offsetWidth; el.classList.add('vai');
  setTimeout(() => {
    if (!jogando) return;
    const c = cmd.casa();
    if (c) cmd.teleportar(c[0], c[1], c[2], c[3], 'Você desmaiou e acordou em casa');
    else { const p = acharInicio(); cmd.teleportar(p.x, p.y, p.z, 0, 'Você desmaiou e acordou no começo do mundo'); }
    vida.reiniciar(); vida.protegido = 6;
  }, 900);
  setTimeout(() => { el.hidden = true; }, 2200);
};
const cmd = criarComandos({
  aviso, som, outros, acharInicio: () => acharInicio(),
  jog: () => (jogando ? jog : null), mundo: () => mundo, sala: () => sala, modo: () => modo, mundoAtual: () => mundoAtual,
  nomeEu: () => conta.usuario && conta.usuario.nome,
  definirDia: (v) => { tempoDia = v; },
  pausar: (sim) => { pausado = sim; },
});
$('#bt-comandos').addEventListener('click', () => { som.iniciar(); som.clique(); cmd.abrir(); });
$('#bt-voar').addEventListener('click', () => alternarVoo());
document.querySelectorAll('[data-emote]').forEach((b) => b.addEventListener('click', () => {
  const e = b.dataset.emote; // nome do ícone: 'acenar', 'coracao', 'sorriso', 'estrela'
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
  jog.voando = !jog.voando;
  jog.vel.y = jog.voando ? 2 : 0;
  $('#bt-voar').classList.toggle('ligado', jog.voando);
  $('#bt-descer').hidden = !jog.voando;
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
  if (!jogando || pausado) return;
  som.iniciar();
  if (garagem.dentro) return;
  visao.bater();
  const m = mirar(ponto);
  if (m.veiculo) { garagem.pedirEntrar(m.veiculo); return; }
  if (m.bicho) { fazerCarinho(m.bicho); return; }
  if (m.aldeao) { conversarCom(m.aldeao); return; }
  if (m.trabalhador) { negocios.tocar(m.trabalhador); return; }
  const h = m.bloco;
  if (!h) return;
  // tocar na bancada abre o livro de receitas
  if (h.b === B.BANCADA && sobrev()) { som.clique(); abrirInventario('criar'); return; }
  // tocar na alavanca liga/desliga; no botão, aperta
  if (BASE[h.b] === E.ALAVANCA) {
    mundo.definir(h.x, h.y, h.z, h.b === E.ALAVANCA ? E.ALAVANCA_LIGADA : E.ALAVANCA);
    som.alavanca();
    return;
  }
  if (BASE[h.b] === E.BOTAO) { apertarBotao(h.x, h.y, h.z); return; }
  // portas, forno, pedra de moinho e manivela do poço (com Porta/Forno... na mão, coloca em vez de mexer)
  if (naMao() !== h.b && mecanismos.tocar(h)) return; // (não conta como colocar bloco nas missões)
  const x = h.x + h.n[0], y = h.y + h.n[1], z = h.z + h.n[2];
  let novo = naMao();
  if (!novo || ehItem(novo)) return; // mão vazia ou ferramenta: não coloca nada
  if (sobrev() && qtd(gastoDe(novo)) < 1) { aviso(`Acabou ${nomeDe(novo)}! Quebre mais ou crie`, 1500, 'mochila'); return; }
  if (y < 1 || y >= ALT) return;
  if (!mercado.podeColocar(novo)) { aviso(`${BLOCOS[novo].nome}: compre na loja de uma vila por ${mercado.precoDe(novo)} moedas`, 2500, 'cadeado'); return; }
  const atual = mundo.bloco(x, y, z);
  if (atual !== AR && !AGUA[atual] && !BLOCOS[atual].planta) return;
  if (novo === B.AGUA && atual === B.AGUA) return;
  if (SOLIDO[novo] && jog.ocupa(x, y, z)) return;
  if (PRECISA_CHAO[novo] && !SOLIDO[mundo.bloco(x, y - 1, z)]) return;
  // esteira: anda para onde o jogador está olhando
  if (novo === E.ESTEIRA) {
    const fx = -Math.sin(jog.yaw), fz = -Math.cos(jog.yaw);
    novo = E.ESTEIRA + (Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3));
  }
  // cama: cabeceira do lado de lá; cadeira: virada para quem colocou
  if (novo === MV.CAMA || novo === MV.CADEIRA) {
    const fx = -Math.sin(jog.yaw), fz = -Math.cos(jog.yaw);
    const d = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3);
    novo += novo === MV.CAMA ? d : (d + 2) & 3;
  }
  comoJogador(() => mundo.definir(x, y, z, novo));
  som.colocar();
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

function fazerCarinho(b) { if (!bichos.carinho(b)) return; mercado.evento('carinho'); laDaOvelha(b); } // bicho selvagem: o toque espanta (não conta como carinho)
function conversarCom(a) {
  aldeoes.conversar(a, jog, Math.sin(tempoDia * Math.PI * 2) < -0.15);
  mercado.evento('conversa');
  // com o mercado ligado, o aldeão abre a lojinha da vila
  if (mercado.op.mercado) setTimeout(() => { if (jogando && !pausado) mercado.abrirLoja(a); }, 650);
}

function quebrar(ponto) {
  if (!jogando || pausado) return;
  som.iniciar();
  if (garagem.dentro) return;
  visao.bater();
  const m = mirar(ponto);
  if (m.veiculo) return;
  if (m.bicho) { fazerCarinho(m.bicho); return; }
  if (m.aldeao) { conversarCom(m.aldeao); return; }
  if (m.trabalhador) { negocios.tocar(m.trabalhador); return; }
  // com a Água na mão, "quebrar" recolhe a água (como um balde); coletando, a mão vazia também pega
  const mao = naMao();
  if ((mao === B.AGUA || (sobrev() && !mao)) && recolherAgua(ponto)) return;
  const h = m.bloco;
  if (!h || h.y < 1) return;
  // cada toque arranca um pedaço; o último derruba o bloco (a ferramenta certa precisa de menos toques)
  const p = raio.ray.at(h.t + 0.001, new THREE.Vector3());
  const total = toquesCom(toquesPara(h.b), h.b, mao);
  if (comoJogador(() => escav.bater(h, p, total))) { som.quebrar(); mostrarQueCaiu(h.b, h.x, h.y, h.z); } else som.bater(h.b);
}

// recolhe a fonte de água mirada; a água corrente que dependia dela seca sozinha
function recolherAgua(ponto) {
  const dir = direcaoDe(ponto);
  const h = mundo.raycast(raio.ray.origin, dir, 6, true);
  if (!h || !AGUA[h.b]) return false;
  // mirou na água corrente: procura a fonte mais perto dali
  let alvo = h.b === B.AGUA ? h : null;
  for (let r = 1; !alvo && r <= 3; r++) {
    for (let dy = -r; dy <= r && !alvo; dy++) for (let dx = -r; dx <= r && !alvo; dx++) for (let dz = -r; dz <= r && !alvo; dz++) {
      if (mundo.bloco(h.x + dx, h.y + dy, h.z + dz) === B.AGUA) alvo = { x: h.x + dx, y: h.y + dy, z: h.z + dz };
    }
  }
  if (!alvo) { aviso('Essa água vem de longe', 1500, 'gota'); return true; }
  comoJogador(() => mundo.definir(alvo.x, alvo.y, alvo.z, AR));
  som.quebrar();
  mostrarQueCaiu(B.AGUA, alvo.x, alvo.y, alvo.z);
  return true;
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
  et.position.y = 2.25;
  b.grupo.add(et);
  const p = j.p || [0, 60, 0];
  b.grupo.position.set(p[0], p[1], p[2]);
  cena.add(b.grupo);
  outros.set(j.id, { ...b, nome: j.nome, corCss: '#' + CORES_ROUPA[b.skin.corRoupa].toString(16).padStart(6, '0'), alvo: new THREE.Vector3(...p), yaw: 0, alvoYaw: (j.r && j.r[0]) || 0, fase: 0 });
}
function removerOutro(id) {
  const o = outros.get(id);
  if (!o) return;
  garagem.esquecer(id);
  cena.remove(o.grupo);
  o.grupo.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material && x.material !== matModelo) { x.material.map && x.material.map.dispose(); x.material.dispose(); } });
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
      semente: mundo.semente, opcoes: { ...opcoesMundo }, edicoes: mundo.listarEdicoes(), pos: [jog.pos.x, jog.pos.y, jog.pos.z], yaw: jog.yaw, dia: tempoDia, barra, veiculos: garagem.lista(),
    }));
  } catch {}
  edicoesPendentes = false;
}

function limparMundo() {
  garagem.parar();
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
  if (escav) { for (const k of [...escav.blocos.keys()]) escav.soltar(k); escav.atualizar(10, 0, 0); }
  if (bichos) for (let i = bichos.lista.length - 1; i >= 0; i--) bichos.remover(i);
  if (aldeoes) aldeoes.limpar();
  negocios.limpar();
  mecanismos.usarMundo(null);
  mundo = null; bichos = null; aldeoes = null; escav = null; fisica = null;
  mercado.parar();
}

function iniciarMundo({ semente, edicoes = [], pos = null, yaw = 0, opcoes = null, veiculos = [], guardado = null }) {
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
  escav = new Escavacao(cena, mundo, matBlocos, atlasCanvas);
  fisica = new Fisica(cena, mundo, matBlocos);
  fisica.aoCair = (x, y, z) => { if (Math.abs(x - jog.pos.x) + Math.abs(z - jog.pos.z) < 24) som.passo(); };
  fisica.aoFolha = (x, y, z, b) => escav.estilhacar(x, y, z, b, null, null);
  mundo.carregarEdicoes(edicoes);
  mundo.aoMudarBloco = (x, y, z, b, de, natural) => {
    edicoesPendentes = true;
    if (sala) sala.enviar(porJogador ? { t: 'bloco', x, y, z, b, de, j: 1 } : { t: 'bloco', x, y, z, b });
    if (fisica) fisica.mudou(x, y, z, b);
    if (porJogador) mercado.bloco(b, y, de, natural, x, z);
  };
  mundo.energia.aoEvento = eventoEnergia;
  minhaPlaca = null;
  jog = new Jogador(mundo);
  let avisoBorda = 0;
  jog.aoBorda = () => { if (tempoTotal - avisoBorda > 6) { avisoBorda = tempoTotal; aviso('Aqui é o fim do mundo! Só mar daqui pra frente', 2200, 'gota'); } };
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
      slot: (i) => { if (i < barra.length) { slotSel = i; desenharBarra(); } },
      rolar: (d) => { slotSel = (slotSel + d + barra.length) % barra.length; desenharBarra(); },
      primeiroToque: () => som.iniciar(),
      mira: (p) => { miraToque = p; },
      travaMudou: () => {},
    });
  }
  ctrl.jog = jog;
  ctrl.sensToque = ajustes.sens;
  bichos = new Bichos(cena, mundo, som);
  aldeoes = new Aldeoes(cena, mundo, som, (...a) => bichos.icone(...a));
  aldeoes.aoEntrarVila = (v) => aviso(v.nome, 2600, 'vila');
  aldeoes.aoPorta = (x, y, z) => mecanismos.abrirParaMorador(x, y, z);
  mecanismos.usarMundo(mundo);
  // bicho provocado (mãe com filhotes, urso surpreendido, cobra pisada...) avisa antes e morde se você insistir
  let ultimoAvisoBicho = -99;
  bichos.aoAvisar = (b) => {
    if (tempoTotal - ultimoAvisoBicho < 12) return;
    ultimoAvisoBicho = tempoTotal;
    const mae = bichos.lista.some((o) => o.mae === b);
    const quem = (mae && b.I.nomeMae) || b.I.nome || 'o bicho';
    const motivo = b.cacandoGente ? 'está com fome e de olho em você' : b.especie === 'cobra' ? 'está avisando: não chegue perto' : mae ? 'está protegendo os filhotes' : 'não gostou de você tão perto';
    aviso(quem[0].toUpperCase() + quem.slice(1) + ' ' + motivo + '. Afaste-se ou toque para espantar', 2600, 'pata');
  };
  bichos.aoMorder = (b, dano) => {
    const quem = b.I.nome || 'o bicho';
    if (dano && vida.dano(dano)) { som.tom(200, 0.15, { tipo: 'sine', vol: 0.3, ate: 120 }); aviso('Ai! ' + quem[0].toUpperCase() + quem.slice(1) + ' te mordeu. Acenda uma luz ou toque para espantar', 2000, 'coracao'); }
    else aviso(quem[0].toUpperCase() + quem.slice(1) + ' te deu um empurrão. Deixe ' + (quem.startsWith('a ') ? 'ela' : 'ele') + ' em paz', 1800, 'pata');
  };
  vida.reiniciar();
  mapa.usarMundo(mundo, 'pradaria.mapa.' + (modo === 'online' && mundoAtual ? mundoAtual.codigo : 'local'));
  aplicarMinimapa();
  garagem.comecar(mundo, veiculos);
  som.ligado = ajustes.som;
  ajustarNevoa();
  desenharBarra();
  $('#bt-voar').classList.remove('ligado'); $('#bt-descer').hidden = true;
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
function jogarLocal(novo = null) {
  let salvo = null;
  try { salvo = JSON.parse(localStorage.getItem('pradaria.local') || 'null'); } catch {}
  if (!salvo && !novo) { abrirNovo('local'); return; }
  if (novo) salvo = null;
  modo = 'local'; mundoAtual = null;
  if (salvo && salvo.barra) barra = salvo.barra;
  tempoDia = salvo ? salvo.dia ?? 0.3 : 0.3;
  iniciarMundo({
    semente: salvo ? salvo.semente : novo.semente ?? Math.floor(Math.random() * 1e9), edicoes: salvo ? salvo.edicoes : [],
    edicoes: salvo ? salvo.edicoes : novo.edicoes || [], // mundo importado de arquivo já vem com blocos
    pos: salvo && salvo.pos, yaw: salvo ? salvo.yaw : 0,
    // mundos salvos antes das opções existirem continuam do jeito que eram
    opcoes: salvo ? salvo.opcoes || PADRAO_MUNDO : novo.opcoes,
    veiculos: salvo && salvo.veiculos,
    guardado: salvo ? { barra: salvo.barra } : null,
  });
  if (novo) salvarLocal();
  cmd.entrouLocal();
  mercado.iniciar({ opcoes: opcoesMundo, novo: !!novo });
  desenharBarra();
  $('#status').innerHTML = comIcone('casa', 'Sem internet');
  aviso('Bem-vindo à Pradaria!', 2500, 'flor');
}

async function jogarOnline(m, volta = null) {
  $('#mundos-erro').textContent = '';
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
        mercado.iniciar({ opcoes: msg.opcoes, estado: msg.econ, sala: s });
        desenharBarra();
        $('#status').innerHTML = comIcone('globo', m.nome);
        if (volta) aviso(volta.msg, 3500, 'lapis');
        else aviso(`Bem-vindo, ${conta.usuario.nome}!` + (m.dono ? ` Código do mundo: ${m.codigo}` : ''), 3500, 'flor');
        chat.entrou(msg);
      } else {
        mundo.carregarEdicoes(msg.edicoes);
        chat.reconectou(msg);
      }
      for (const id of [...outros.keys()]) removerOutro(id);
      for (const j of msg.jogadores) adicionarOutro(j);
      garagem.ola(msg);
    },
    vnovo: (m) => garagem.mensagem(m), vassento: (m) => garagem.mensagem(m), vmov: (m) => garagem.mensagem(m),
    vfim: (m) => garagem.mensagem(m), buzina: (m) => garagem.mensagem(m),
    entrou: (msg) => { adicionarOutro(msg.j); aviso(`${msg.j.nome} entrou no mundo`, 1800, 'acenar'); som.oi(); },
    skin: (msg) => {
      const o = outros.get(msg.id);
      if (!o || !msg.s) return;
      vestirBoneco(o, msg.s);
      o.corCss = '#' + CORES_ROUPA[o.skin.corRoupa].toString(16).padStart(6, '0');
    },
    saiu: (msg) => { const o = outros.get(msg.id); if (o) aviso(`${o.nome} saiu`); removerOutro(msg.id); },
    saiu: (msg) => { const o = outros.get(msg.id); if (o) aviso(`${o.nome} saiu`); chat.jogadorSaiu(msg.id); removerOutro(msg.id); },
    chat: (msg) => chat.recebeu(msg), 'chat-erro': (msg) => chat.erro(msg), 'chat-op': (msg) => chat.aplicarOp(msg),
    voz: (msg) => chat.mensagemVoz(msg), 'voz-lista': (msg) => chat.mensagemVoz(msg), 'voz-sinal': (msg) => chat.mensagemVoz(msg), 'voz-fala': (msg) => chat.mensagemVoz(msg),
    pos: (msg) => {
      const o = outros.get(msg.id);
      if (!o) return;
      o.alvo.set(msg.p[0], msg.p[1], msg.p[2]);
      o.alvoYaw = msg.r[0]; o.alvoPitch = msg.r[1]; o.acao = msg.a | 0;
    },
    bloco: (msg) => { if (mundo) mundo.definir(msg.x, msg.y, msg.z, msg.b, true); },
    blocos: (msg) => { if (Array.isArray(msg.l)) porBlocosObra(msg.l, true); },
    emote: (msg) => {
      const o = outros.get(msg.id);
      const nome = nomeEmote(msg.e); // aceita nome novo ou emoji de versão antiga
      if (o && bichos && nome) bichos.icone(nome, o.grupo.position.x, o.grupo.position.y + 2.7, o.grupo.position.z, 2, 0.6);
    },
    erro: (msg) => { aviso(msg.msg || 'Erro', 3000); },
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
  jogando = false; pausado = false;
  fecharJanelas();
  $('#hud').hidden = true;
  jogarOnline(m, volta);
  $('#carregando-txt').textContent = 'Atualizando o mundo…';
}

function sairDoMundo(op = {}) {
  if (jogando) enviarBarra();
  if (op.apagarLocal) { try { localStorage.removeItem('pradaria.local'); } catch {} } // apagado: não salva de novo
  else salvarLocal();
  cmd.saiu();
  if (sala && jog) sala.enviar({ t: 'pos', p: [jog.pos.x, jog.pos.y, jog.pos.z], r: [jog.yaw, jog.pitch] });
  limparMundo();
  jogando = false; pausado = false;
  fecharJanelas();
  $('#hud').hidden = true;
  if (conta.usuario) abrirMundos(); else mostrarMenu('m-inicio');
}

// ---------- menus de conta e mundos ----------
let modoConta = 'entrar', corEscolhida = 0;
function abrirConta(m) {
  modoConta = m;
  $('#conta-titulo').textContent = m === 'entrar' ? 'Entrar' : 'Criar conta';
  $('#c-ok').textContent = m === 'entrar' ? 'Entrar' : 'Criar e jogar';
  $('#c-senha').autocomplete = m === 'entrar' ? 'current-password' : 'new-password';
  $('#c-cores').hidden = m === 'entrar';
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
  setTimeout(() => $('#c-nome').focus(), 50);
}
$('#bt-entrar').addEventListener('click', () => conta.token ? abrirMundos() : abrirConta('entrar'));
$('#bt-criar-conta').addEventListener('click', () => abrirConta('criar'));
$('#bt-sozinho').addEventListener('click', () => { som.iniciar(); jogarLocal(); });
$('#bt-sozinho2').addEventListener('click', () => { som.iniciar(); jogarLocal(); });
document.querySelector('[data-voltar]').addEventListener('click', () => mostrarMenu('m-inicio'));
document.querySelector('[data-voltar-mundos]').addEventListener('click', () => (modoNovo === 'local' && !conta.token ? mostrarMenu('m-inicio') : abrirMundos()));
$('#m-conta').addEventListener('submit', async (e) => {
  e.preventDefault();
  som.iniciar();
  $('#c-erro').textContent = '';
  $('#c-ok').disabled = true;
  try {
    const r = await api(modoConta === 'entrar' ? 'entrar' : 'cadastrar', { nome: $('#c-nome').value.trim(), senha: $('#c-senha').value, cor: corEscolhida, skin: modoConta === 'entrar' ? undefined : skinLocal() || undefined });
    conta.salvar(r.token); conta.usuario = r.usuario;
    levarSkinLocal();
    $('#c-senha').value = '';
    abrirMundos();
  } catch (err) { $('#c-erro').textContent = err.message; }
  $('#c-ok').disabled = false;
});
$('#bt-sair-conta').addEventListener('click', () => { conta.salvar(null); conta.usuario = null; mostrarMenu('m-inicio'); });
ligarApagarConta(() => mostrarMenu('m-inicio'));
$('#bt-personagem').addEventListener('click', () => abrirPersonagem());
$('#bt-personagem2').addEventListener('click', () => abrirPersonagem());
$('#bt-personagem3').addEventListener('click', () => { $('#pausa').hidden = true; abrirPersonagem(() => { if (jogando) abrirPausa(); }); });

async function abrirMundos() {
  mostrarMenu('m-carregando');
  $('#carregando-txt').textContent = 'Buscando seus mundos…';
  try {
    if (!conta.usuario) { conta.usuario = (await api('eu')).usuario; levarSkinLocal(); }
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
  const com = OPCOES_MUNDO.filter((x) => n[x.id]).map((x) => x.nome);
  const sem = OPCOES_MUNDO.filter((x) => !n[x.id]).map((x) => x.nome.toLowerCase());
  return (n.tipo !== 'normal' ? TIPOS[n.tipo].nome + ' · ' : '') + (n.estilo !== 'blocos' ? ESTILOS[n.estilo].nome + ' · ' : '') + (TIPOS[n.tipo].limite ? '' : `Mundo ${t.nome.toLowerCase()} · `) + (com.join(', ') || 'só blocos') + (sem.length ? ' · sem ' + sem.join(', ') : '');
}
let escolhaNovo = { ...PADRAO_NOVO };
function desenharOpcoesNovo() {
  const tp = $('#n-tipos');
  tp.innerHTML = '';
  for (const [id, t] of Object.entries(TIPOS)) {
    if (t.oculto && !location.hash.includes('teste')) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opcao-mundo'; b.dataset.tipo = id; b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="ic"></span><b></b><small></small>';
    b.querySelector('.ic').innerHTML = icone(t.icone); b.querySelector('b').textContent = t.nome; b.querySelector('small').textContent = t.desc;
    b.addEventListener('click', () => { escolhaNovo.tipo = id; marcarTamanho(); som.iniciar(); som.clique(); });
    tp.appendChild(b);
  }
  $('#n-tipos').hidden = $('#n-tipos-titulo').hidden = tp.childElementCount < 2;
  // jeito do mundo: blocos ou Natural 3D (suave.js)
  desenharEstilos($('#n-estilos'), escolhaNovo, () => { som.iniciar(); som.clique(); });
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
  marcarTamanho();
  desenharListaOpcoes($('#n-lista'), escolhaNovo, () => { som.iniciar(); som.clique(); });
  marcarTamanho();
}
function marcarTamanho() {
  // tipos com tamanho fixo (a Ilha de Aventura) escondem a escolha de tamanho
  const fixo = !!TIPOS[escolhaNovo.tipo]?.limite;
  $('#n-tamanhos').hidden = fixo; $('#n-tamanhos-titulo').hidden = fixo;
  for (const b of $('#n-tamanhos').children) { const sel = b.dataset.tamanho === escolhaNovo.tamanho; b.setAttribute('aria-pressed', String(sel)); b.setAttribute('aria-checked', String(sel)); }
  for (const b of $('#n-tipos').children) { const sel = b.dataset.tipo === escolhaNovo.tipo; b.setAttribute('aria-pressed', String(sel)); b.setAttribute('aria-checked', String(sel)); }
  marcarLista($('#n-lista'), escolhaNovo); // alguns tipos têm os próprios bichos (ex.: Linha do Tempo)
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
    const r = modoNovo === 'criar' ? await api('mundos', { nome: v, opcoes: { ...escolhaNovo }, semente }) : await api('mundos/entrar', { codigo: v.toUpperCase() });
    som.iniciar();
    jogarOnline(r.mundo);
  } catch (err) { $('#n-erro').textContent = err.message; }
});

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

  if (!pausado) {
    const ent = ctrl.atualizar();
    if (!garagem.quadro(dt, ent, false)) {
      jog.atualizar(dt, ent);
      if (jog.noChao && Math.floor(jog.passo / 1.8) !== ultimoPasso) { ultimoPasso = Math.floor(jog.passo / 1.8); som.passo(); }
    }
  }
  const dirigindo = garagem.camera(camera);
  if (!visao.quadro(dt, jog, camera, mundo, meuSkin, dirigindo) && !dirigindo) {
    camera.position.set(jog.pos.x, jog.yVisual + OLHOS, jog.pos.z);
    camera.rotation.set(jog.pitch, jog.yaw, 0, 'YXZ');
  }

  mundo.energia.noite = graf.U.uNoite.value > 0.5;
  mundo.atualizar(jog.pos.x, jog.pos.z, ehToque ? 5 : 8, jog.pos.y);
  if (!pausado) vigiarPlaca();
  if (jog.quicou) { jog.quicou = false; som.boing(); }
  bichos.atualizar(pausado ? 0 : dt, jog, tempoTotal, tempoDia);
  aldeoes.atualizar(dt, jog, Math.sin(tempoDia * Math.PI * 2));
  mecanismos.atualizar(pausado ? 0 : dt, jog, graf.U.uVento.value === 0);
  negocios.atualizar(dt, jog, tempoDia);
  // os trabalhadores contam o tempo a cada 3 s (online quem mede é a sala)
  turnoAcum += dt;
  if (turnoAcum >= 3) { mercado.turno(turnoAcum, horaDe(tempoDia)); turnoAcum = 0; }
  if (!pausado) vida.atualizar(dt);
  mapa.atualizar(dt, jog, outros, bichos);
  mercado.passo(jog.pos.x - passoAntes.x, jog.pos.z - passoAntes.z, jog, mundo.alturaEm(Math.floor(jog.pos.x), Math.floor(jog.pos.z)));
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
  if (mundo.aventura) verLugar();
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
    if (o.sentado) continue; // sentado num veículo: anda junto com ele
    const g = o.grupo.position;
    const dx = o.alvo.x - g.x, dz = o.alvo.z - g.z;
    const andando = Math.hypot(dx, dz) > 0.05;
    g.lerp(o.alvo, Math.min(1, dt * 10));
    // a frente do boneco é +z e a câmera olha para -z: meio giro para ele olhar para onde o amigo olha
    let d = ((o.alvoYaw + Math.PI - o.grupo.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    o.grupo.rotation.y += d * Math.min(1, dt * 10);
    const acao = o.acao | 0; // 1 = batendo, 2 = voando, 4 = na água, 8 = no ar (pulando/caindo)
    if (acao & 1 && (o.golpe ?? 1) >= 1) o.golpe = 0;
    if ((o.golpe ?? 1) < 1) o.golpe = Math.min(1, o.golpe + dt / 0.3);
    animarBoneco(o, { anda: andando ? 0.8 : 0, noAr: !!(acao & 8), voando: !!(acao & 2), nadando: !!(acao & 4) && andando, golpe: o.golpe ?? 1, pitch: o.alvoPitch || 0 }, dt);
  }

  // ciclo de dia e noite (a noite é clarinha: nada de medo!)
  if (opcoesMundo.cicloDia) tempoDia = (tempoDia + dt / DURACAO_DIA) % 1;
  const ang = tempoDia * Math.PI * 2;
  const s = Math.sin(ang); // 0.25 -> 1 (meio-dia), 0.75 -> -1 (meia-noite)
  const luz = THREE.MathUtils.clamp(0.62 + s * 0.6, 0.5, 1);
  const horizonte = graf.atualizar(dt, tempoDia, jog.pos, mundo);
  cena.fog.color.copy(horizonte);
  graf.ajustarNevoa(cena.fog.near, cena.fog.far, horizonte);
  const cx = camera.position.x, cz = camera.position.z;
  void ang;
  nuvens.position.x = ((tempoTotal * 1.2) % 360) - 180 + Math.floor(cx / 360) * 360;
  nuvens.position.z = Math.floor(cz / 360) * 360;
  nuvens.material.color.setRGB(0.035, 0.04, 0.07).lerp(corTmp.setRGB(1, 1, 1), 1 - graf.U.uNoite.value).lerp(corTmp.setRGB(1, 0.72, 0.55), graf.U.uPor.value * 0.6);

  // rede: posição ~8x por segundo
  if (sala) {
    acumPos += dt;
    if (acumPos > 0.125) { acumPos = 0; sala.enviar({ t: 'pos', p: [+jog.pos.x.toFixed(2), +jog.pos.y.toFixed(2), +jog.pos.z.toFixed(2)], r: [+jog.yaw.toFixed(2), +jog.pitch.toFixed(2)], a: (visao.batendo ? 1 : 0) | (jog.voando ? 2 : 0) | (jog.naAgua ? 4 : 0) | (!jog.noChao && !jog.voando && !jog.naAgua ? 8 : 0) }); }
  }
  // salvamento local a cada 5s
  salvarLocalTimer += dt;
  if (salvarLocalTimer > 5) { salvarLocalTimer = 0; if (modo === 'local') salvarLocal(); }

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
    const teto = NIVEIS.includes(ajustes.grafTeto) ? NIVEIS.indexOf(ajustes.grafTeto) : NIVEIS.length - 1;
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
requestAnimationFrame(laco);
addEventListener('beforeunload', () => salvarLocal());
document.addEventListener('visibilitychange', () => { if (document.hidden) { salvarLocal(); if (jogando) enviarBarra(); } });
void edicoesPendentes;

// início: se já tem sessão, vai direto para os mundos
camera.position.set(0, 40, 0);
if (conta.token) abrirMundos(); else mostrarMenu('m-inicio');

// modo de teste automatizado
if (location.hash === '#teste') { window.__jogo = { get outros() { return outros.size; }, get outrosLista() { return [...outros.values()]; }, get sala() { return sala; }, get jog() { return jog; }, get mundo() { return mundo; }, get bichos() { return bichos; }, get aldeoes() { return aldeoes; }, garagem, visao, chat, personagem, get meuSkin() { return meuSkin(); }, mercado, conversarCom, comoJogador, vida, opcoesMundo, get tempoDia() { return tempoDia; }, set dia(v) { tempoDia = v; }, get dia() { return tempoDia; }, get barra() { return barra; }, set slot(v) { slotSel = v; }, abrirInventario, bancadaPerto, camera, graf, pos, renderer, ajustes, calib, vigiarDesempenho, palpiteGrafico, opcoesGraficas, jogarLocal, usar, quebrar, cmd, mapa, mecanismos }; }

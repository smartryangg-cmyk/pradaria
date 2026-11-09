// Aldeões: moradores das vilas. Passeiam pelas ruas e pela praça, cuidam das plantações,
// acenam para quem chega e conversam com um toque. À noite voltam para casa e dormem.
import * as THREE from '../vendor/three.module.min.js';
import { caixa, juntar, matModelo, matBrilho } from './modelos.js';
import { SOLIDO, AGUA, M } from './blocos.js';
import { ANEL } from './vilas.js';
import { ALT } from './mundo.js';

const NOMES = ['Dona Cida', 'Seu Zé', 'Tia Lu', 'Juca', 'Nina', 'Vô Bento', 'Vó Lurdes', 'Tonico', 'Marieta', 'Dona Flor',
  'Seu Lima', 'Bia', 'Chico', 'Rosinha', 'Tião', 'Dona Neném', 'Pedrinho', 'Lia', 'Seu Bené', 'Iaiá', 'Dito', 'Zefa', 'Quinzinho', 'Cecília'];
const PELES = [0xf5d5b8, 0xf1c8a0, 0xd9a273, 0xb87a4f, 0x8a5534, 0x6b3f25];
const CABELOS = [0x2b1d14, 0x5a3a22, 0x8a5a2b, 0xd9b061, 0xb0472b, 0xdedad2, 0x161616];
const ROUPAS = [0xe06b5a, 0x5aa0e0, 0x6cc04a, 0xf2c72e, 0xb07ad9, 0xf29ac2, 0x4fb3a8, 0xe8913c];
const CALCAS = [0x3a4a6a, 0x5a3d22, 0x4a4a4a, 0x2f5d8a, 0x6b5a3a];

const FALAS = {
  geral: ['Bom dia!', 'Que dia lindo!', 'Já fez carinho numa capivara hoje?', 'Bem-vindo à {vila}!', 'Adoro morar aqui na {vila}.',
    'Cuidado com as flores!', 'Você constrói muito bem!', 'O Caramelo passou por aqui agora há pouco', 'Olha que nuvem bonita!',
    'Vamos ser amigos?', 'Já bebeu água do poço da praça?', 'Aqui a noite é clarinha, não precisa ter medo',
    'Que tal construir uma casa aqui do lado?', 'Oi, oi!'],
  fazendeiro: ['O trigo está crescendo bonito!', 'Hoje vou colher trigo para fazer pão', 'As galinhas botaram muitos ovos!', 'Plantar é muito legal! Quer tentar?'],
  padeiro: ['Acabei de fazer pão quentinho!', 'Bolo de fubá saindo do forno!', 'Quer um pãozinho de queijo?'],
  pescador: ['O mar está calminho hoje', 'Vi um peixinho colorido!', 'Adoro o barulho das ondas'],
  artesao: ['Estou fazendo uma cadeira nova', 'Tábua por tábua se faz uma casa!', 'Gostou do telhado da minha casa?'],
  florista: ['Essas flores são para você!', 'Flor azul é a minha preferida', 'Plantei flores na praça'],
  lojista: ['A loja está aberta!', 'Hoje chegou mercadoria nova', 'Quer vender alguma coisa? É só pedir!', 'Se precisar de ajuda, me contrata!'],
  noite: ['Boa noite! Hora de dormir', 'Zzz...', 'Amanhã a gente brinca mais!'],
};
// mundo Linha do Tempo: falas de cada era (índice = era; só existem pessoas da era 2 em diante)
const FALAS_ERA = {
  2: ['Uga! Fogo quentinho!', 'Vamos pintar a parede da caverna?', 'Achei uma pedra bem redondinha!', 'O lobinho virou meu amigo!',
    'Uga uga! Bem-vindo!', 'Hoje tem frutinha para todo mundo', 'Olha o cavalo correndo lá longe!'],
  3: ['Salve, amigo!', 'Você já viu a pirâmide?', 'Meu camelo adora tâmaras', 'Vamos construir colunas bem altas!',
    'Os gatinhos daqui são muito mimados', 'Que mosaico mais bonito!'],
  4: ['Saudações, viajante!', 'O castelo é logo ali!', 'O moinho está girando hoje', 'Meu cavalo se chama Pipoca',
    'Que lindo vitral colorido!', 'Quer ouvir uma história de cavaleiro?'],
  5: ['Piuí! Ouviu o trem?', 'A fábrica faz engrenagens', 'Bom dia! Já tomou seu chá?', 'Olha a fumacinha da chaminé!',
    'Comprei uma cartola nova!'],
  6: ['Oi! Tudo bem?', 'Vamos andar de bicicleta?', 'Meu cachorro adora passear', 'Já foi no estádio?', 'Que tal um sorvete?'],
  7: ['Olá! Bem-vindo ao futuro!', 'Meu robô-cão sabe dar a patinha!', 'Os painéis solares pegam a luz do sol',
    'Vamos voar até a Lua?', 'Bip bop! Brincadeira, eu não sou robô!'],
};
// falas gerais que servem em qualquer época
const GERAL_ERA = ['Bom dia!', 'Que dia lindo!', 'Bem-vindo à {vila}!', 'Adoro morar aqui na {vila}.', 'Cuidado com as flores!',
  'Você constrói muito bem!', 'Olha que nuvem bonita!', 'Vamos ser amigos?', 'Oi, oi!'];

// roupas de cada era (mundo Linha do Tempo)
const COUROS = [0x9a6a3f, 0x8a5a32, 0xb07f4e];
const FAIXAS = [0xe53935, 0x1e88e5, 0x8e24aa, 0xf9a825, 0x43a047, 0xd81b60];
const MEDIEVAL = [0x7b3f2a, 0x2e5d3a, 0x3c4f7a, 0x8a2f4a, 0xa3742c, 0x5b4a7a];
const CAMISAS = [0xf5f2ea, 0xe8dcc4, 0xc9d6e3, 0xe6c9c9];
const JEANS = [0x3f5f9a, 0x2f4f7a, 0x4a6fa5];
const PRATA = [0xe8edf2, 0xcfd8dc, 0xf7f7fa];
const NEONS = [0x3ff0ff, 0xff5ad8, 0xa6ff4d, 0xffd23f];

const PRESENTES = ['maca', 'milho', 'cenoura', 'pao', 'flor', 'morango', 'ovo', 'bolo']; // nomes de ícones (icones.js)

function malha(geo) { const m = new THREE.Mesh(geo, matModelo); m.castShadow = true; return m; }
function membro(geos, x, y, z) { const m = malha(juntar(geos)); m.position.set(x, y, z); return m; }

// bonequinho de aldeão (frente = +z, pés em y=0). era: null = mundo normal; 2..7 = roupa da época (Linha do Tempo)
export function montarAldeao(r, oficio, era = null) {
  const pick = (l) => l[Math.floor(r() * l.length)];
  const pele = pick(PELES), cab = pick(CABELOS);
  let roupa = pick(ROUPAS), calca = pick(CALCAS);
  const E = era == null ? -1 : era;
  // aventais e chapéus de ofício: no mundo normal, na Idade Média e hoje; nas outras eras manda a roupa da época
  const deOficio = E < 0 || E === 4 || E === 6;
  let sapato = 0x3b2a1e, manga = roupa, mangaCurta = false, pernaNua = false, shortinho = null;
  const corpo = [], cabExtra = [], brilho = [], cabBrilho = [];
  let chapeu = false; // a era já pôs algo na cabeça (aí não entra chapéu de ofício)

  if (E === 2) { // Idade da Pedra: roupa de pele, descalço
    roupa = pick(COUROS); manga = pele; pernaNua = true; shortinho = roupa; sapato = pele;
    const mancha = 0x5e3d22;
    corpo.push(caixa(0.58, 0.24, 0.34, roupa, 0, 0.66, 0),
      caixa(0.1, 0.08, 0.02, mancha, -0.12, 1.02, 0.152), caixa(0.08, 0.1, 0.02, mancha, 0.14, 0.86, 0.152), caixa(0.1, 0.06, 0.02, mancha, 0.02, 0.7, 0.172),
      caixa(0.54, 0.05, 0.32, 0x5e3d22, 0, 0.8, 0));
    cabExtra.push(caixa(0.48, 0.06, 0.46, 0x6e4a2a, 0, 0.4, 0)); // faixinha de couro na testa
    if (r() < 0.5) cabExtra.push(caixa(0.04, 0.22, 0.08, pick([0xe53935, 0xf9a825, 0x43a047]), 0.2, 0.5, -0.12)); // pena
  } else if (E === 3) { // Antiguidade: túnica branca com faixa colorida e sandália
    const faixa = pick(FAIXAS);
    roupa = 0xf5f2ea; manga = roupa; mangaCurta = true; pernaNua = true; sapato = 0x9a6a3f;
    corpo.push(caixa(0.56, 0.34, 0.34, roupa, 0, 0.5, 0), caixa(0.54, 0.07, 0.32, faixa, 0, 0.76, 0),
      caixa(0.12, 0.22, 0.02, faixa, -0.15, 1.12, 0.152), caixa(0.12, 0.2, 0.02, faixa, -0.05, 0.94, 0.152), caixa(0.12, 0.16, 0.02, faixa, 0.06, 0.82, 0.152),
      caixa(0.12, 0.22, 0.02, faixa, -0.15, 1.12, -0.152));
    if (r() < 0.45) { cabExtra.push(caixa(0.5, 0.06, 0.48, 0x7cb342, 0, 0.44, 0), caixa(0.08, 0.06, 0.06, 0x9ccc65, -0.16, 0.44, 0.24), caixa(0.08, 0.06, 0.06, 0x9ccc65, 0.16, 0.44, 0.24)); chapeu = true; } // coroa de louros
  } else if (E === 4) { // Idade Média: túnica com cinto, meia-calça e bota, capuz ou chapéu com pena
    roupa = pick(MEDIEVAL); manga = roupa; sapato = 0x5a3a22;
    corpo.push(caixa(0.56, 0.2, 0.34, roupa, 0, 0.6, 0), caixa(0.54, 0.07, 0.32, 0x4a2f1e, 0, 0.72, 0), caixa(0.07, 0.07, 0.02, 0xd4a93c, 0, 0.72, 0.162));
    if (!['fazendeiro', 'padeiro'].includes(oficio)) {
      chapeu = true;
      if (r() < 0.5) { // capuz
        const capuz = pick(MEDIEVAL.filter((c) => c !== roupa));
        corpo.push(caixa(0.6, 0.14, 0.36, capuz, 0, 1.2, 0));
        cabExtra.push(caixa(0.54, 0.14, 0.52, capuz, 0, 0.5, 0), caixa(0.54, 0.44, 0.1, capuz, 0, 0.28, -0.24),
          caixa(0.06, 0.4, 0.44, capuz, -0.26, 0.28, -0.02), caixa(0.06, 0.4, 0.44, capuz, 0.26, 0.28, -0.02), caixa(0.2, 0.16, 0.18, capuz, 0, 0.58, -0.22));
      } else { // chapéu com pena
        const ch = pick([0x3c4f7a, 0x7b3f2a, 0x2e5d3a]);
        cabExtra.push(caixa(0.64, 0.05, 0.62, ch, 0, 0.5, 0), caixa(0.46, 0.18, 0.44, ch, 0, 0.6, 0), caixa(0.04, 0.24, 0.14, 0xf2f2f2, 0.22, 0.72, -0.12));
      }
    }
  } else if (E === 5) { // Era Industrial: macacão e boné, ou suspensório, gravatinha e cartola
    roupa = pick(CAMISAS); manga = roupa; sapato = 0x262626; chapeu = true;
    if (r() < 0.5) {
      const mac = pick([0x3f5f8a, 0x6d5a45, 0x4a5a3a]); calca = mac;
      corpo.push(caixa(0.53, 0.22, 0.31, mac, 0, 0.72, 0), caixa(0.44, 0.3, 0.04, mac, 0, 0.92, 0.15),
        caixa(0.08, 0.2, 0.02, mac, -0.15, 1.14, 0.152), caixa(0.08, 0.2, 0.02, mac, 0.15, 1.14, 0.152),
        caixa(0.08, 0.5, 0.02, mac, -0.15, 0.98, -0.152), caixa(0.08, 0.5, 0.02, mac, 0.15, 0.98, -0.152),
        caixa(0.05, 0.05, 0.02, 0xffd54f, -0.15, 1.05, 0.17), caixa(0.05, 0.05, 0.02, 0xffd54f, 0.15, 1.05, 0.17));
      const bone = pick([0x5d4a3a, 0x4a4a4a, 0x3f5f8a]);
      cabExtra.push(caixa(0.5, 0.12, 0.5, bone, 0, 0.52, 0), caixa(0.44, 0.04, 0.2, bone, 0, 0.47, 0.32));
    } else {
      calca = pick([0x4a4a4a, 0x5a3d22, 0x3a3a4a]);
      const sus = pick([0xb71c1c, 0x1e3a6a, 0x2e5d3a]);
      corpo.push(caixa(0.07, 0.62, 0.02, sus, -0.14, 0.93, 0.152), caixa(0.07, 0.62, 0.02, sus, 0.14, 0.93, 0.152),
        caixa(0.07, 0.62, 0.02, sus, -0.14, 0.93, -0.152), caixa(0.07, 0.62, 0.02, sus, 0.14, 0.93, -0.152),
        caixa(0.16, 0.07, 0.03, sus, 0, 1.19, 0.162));
      cabExtra.push(caixa(0.62, 0.04, 0.6, 0x262626, 0, 0.5, 0), caixa(0.42, 0.44, 0.4, 0x262626, 0, 0.74, 0), caixa(0.43, 0.07, 0.41, sus, 0, 0.56, 0));
    }
  } else if (E === 6) { // Era Moderna: camiseta, jeans e tênis
    mangaCurta = true; calca = pick(JEANS); sapato = pick([0xf5f5f5, 0xe53935, 0x1e88e5, 0x262626]);
  } else if (E === 7) { // Futuro: roupa prateada com detalhe neon
    roupa = pick(PRATA); manga = roupa; calca = pick(PRATA); sapato = 0xf5f7fa;
    const neon = pick(NEONS);
    corpo.push(caixa(0.56, 0.12, 0.34, 0xb0bec5, 0, 1.2, 0));
    brilho.push(caixa(0.535, 0.05, 0.315, neon, 0, 0.72, 0), caixa(0.06, 0.4, 0.02, neon, 0, 0.95, 0.158), caixa(0.14, 0.14, 0.02, neon, 0.14, 1.06, 0.158));
    cabBrilho.push(caixa(0.5, 0.05, 0.48, neon, 0, 0.44, 0));
    if (r() < 0.4) { cabExtra.push(caixa(0.03, 0.16, 0.03, 0xb0bec5, 0.18, 0.56, -0.05)); cabBrilho.push(caixa(0.07, 0.07, 0.07, neon, 0.18, 0.66, -0.05)); }
  }

  const g = new THREE.Group();
  corpo.unshift(caixa(0.52, 0.62, 0.3, roupa, 0, 0.93, 0));
  if (deOficio) {
    if (oficio === 'fazendeiro') corpo.push(caixa(0.46, 0.5, 0.04, 0x3f6fa0, 0, 0.88, 0.15), caixa(0.08, 0.14, 0.04, 0x3f6fa0, -0.15, 1.18, 0.15), caixa(0.08, 0.14, 0.04, 0x3f6fa0, 0.15, 1.18, 0.15));
    if (oficio === 'padeiro') corpo.push(caixa(0.44, 0.52, 0.04, 0xfafafa, 0, 0.86, 0.15));
    if (oficio === 'lojista') corpo.push(caixa(0.44, 0.52, 0.04, 0x3f8f5a, 0, 0.86, 0.15), caixa(0.12, 0.08, 0.02, 0xf2c72e, 0.12, 1.08, 0.18));
    if (oficio === 'artesao') corpo.push(caixa(0.16, 0.6, 0.32, 0x7a5634, -0.19, 0.94, 0), caixa(0.16, 0.6, 0.32, 0x7a5634, 0.19, 0.94, 0));
  }
  if (oficio === 'florista' && E !== 2 && E !== 3) corpo.push(caixa(0.54, 0.22, 0.32, roupa, 0, 0.66, 0)); // saia rodada
  g.add(malha(juntar(corpo)));
  if (brilho.length) g.add(new THREE.Mesh(juntar(brilho), matBrilho));

  const cabeca = [caixa(0.46, 0.46, 0.44, pele, 0, 0.23, 0),
    caixa(0.07, 0.09, 0.02, 0x222222, -0.1, 0.26, 0.225), caixa(0.07, 0.09, 0.02, 0x222222, 0.1, 0.26, 0.225),
    caixa(0.06, 0.07, 0.05, pele, 0, 0.18, 0.24), caixa(0.14, 0.035, 0.02, 0x8a3a30, 0, 0.1, 0.225),
    caixa(0.07, 0.04, 0.02, 0xf08a8a, -0.16, 0.15, 0.223), caixa(0.07, 0.04, 0.02, 0xf08a8a, 0.16, 0.15, 0.223)];
  const estilo = r();
  if (cab === 0xdedad2 && estilo < 0.5) cabeca.push(caixa(0.06, 0.18, 0.4, cab, -0.24, 0.3, -0.02), caixa(0.06, 0.18, 0.4, cab, 0.24, 0.3, -0.02), caixa(0.5, 0.18, 0.06, cab, 0, 0.3, -0.22));
  else {
    cabeca.push(caixa(0.5, 0.12, 0.48, cab, 0, 0.49, 0), caixa(0.5, 0.3, 0.1, cab, 0, 0.32, -0.2));
    if (estilo < 0.35 || E === 2) cabeca.push(caixa(0.5, 0.42, 0.1, cab, 0, 0.12, -0.22), caixa(0.06, 0.32, 0.3, cab, -0.25, 0.25, -0.06), caixa(0.06, 0.32, 0.3, cab, 0.25, 0.25, -0.06)); // cabelo comprido
    else if (estilo < 0.55 && !chapeu) cabeca.push(caixa(0.2, 0.2, 0.2, cab, 0, 0.6, -0.14)); // coque
  }
  cabeca.push(...cabExtra);
  if (deOficio && !chapeu) {
    if (oficio === 'fazendeiro') cabeca.push(caixa(0.82, 0.05, 0.82, 0xe8c46a, 0, 0.5, 0), caixa(0.48, 0.2, 0.46, 0xe8c46a, 0, 0.61, 0), caixa(0.49, 0.05, 0.47, 0xb0472b, 0, 0.55, 0));
    if (oficio === 'padeiro') cabeca.push(caixa(0.5, 0.28, 0.48, 0xfafafa, 0, 0.62, 0));
    if (oficio === 'pescador') cabeca.push(caixa(0.5, 0.12, 0.48, 0x3f6fd9, 0, 0.53, 0), caixa(0.4, 0.04, 0.22, 0x3f6fd9, 0, 0.48, 0.32));
  }
  if (oficio === 'florista' && E !== 7) cabeca.push(caixa(0.13, 0.13, 0.06, 0xe8433f, 0.2, 0.47, 0.14), caixa(0.05, 0.05, 0.02, 0xffe066, 0.2, 0.47, 0.175));
  const cab3 = malha(juntar(cabeca));
  cab3.position.y = 1.24;
  if (cabBrilho.length) cab3.add(new THREE.Mesh(juntar(cabBrilho), matBrilho));
  g.add(cab3);

  // braços: manga inteira, manga curtinha (camiseta, túnica) ou braço de fora (pele)
  const braco = (x) => membro(mangaCurta
    ? [caixa(0.18, 0.18, 0.2, manga, 0, -0.09, 0), caixa(0.16, 0.4, 0.18, pele, 0, -0.38, 0)]
    : [caixa(0.18, 0.4, 0.2, manga, 0, -0.2, 0), caixa(0.16, 0.18, 0.18, pele, 0, -0.49, 0)], x, 1.2, 0);
  // pernas: calça, perna de fora (com shortinho de pele na Idade da Pedra) e sapato/sandália/pé descalço
  const perna = (x) => membro([
    ...(pernaNua
      ? [...(shortinho ? [caixa(0.23, 0.18, 0.25, shortinho, 0, -0.09, 0)] : []), caixa(0.2, shortinho ? 0.34 : 0.52, 0.22, pele, 0, shortinho ? -0.35 : -0.26, 0)]
      : [caixa(0.22, 0.52, 0.24, calca, 0, -0.26, 0)]),
    caixa(0.23, E === 3 ? 0.06 : 0.1, 0.27, sapato, 0, E === 3 ? -0.59 : -0.57, 0.01),
    ...(E === 6 ? [caixa(0.235, 0.03, 0.275, 0xffffff, 0, -0.605, 0.01)] : []),
  ], x, 0.62, 0);
  const bd = braco(-0.35), be = braco(0.35), pd = perna(-0.13), pe = perna(0.13);
  g.add(bd, be, pd, pe);
  return { grupo: g, cabeca: cab3, bracos: [bd, be], pernas: [pd, pe] };
}

// balãozinho de fala
export function balao(texto) {
  const linhas = [];
  for (const palavra of texto.split(' ')) {
    const ult = linhas[linhas.length - 1];
    if (ult && (ult + ' ' + palavra).length <= 22) linhas[linhas.length - 1] = ult + ' ' + palavra;
    else linhas.push(palavra);
  }
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const fonte = 'bold 30px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.font = fonte;
  const w = Math.ceil(Math.max(...linhas.map((l) => ctx.measureText(l).width))) + 36;
  const lh = 38, h = linhas.length * lh + 24;
  cv.width = w; cv.height = h + 16;
  ctx.font = fonte;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 18); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w / 2 - 12, h - 3); ctx.lineTo(w / 2, h + 14); ctx.lineTo(w / 2 + 12, h - 3); ctx.fill();
  ctx.fillStyle = '#3a2a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  linhas.forEach((l, i) => ctx.fillText(l, w / 2, 14 + lh * (i + 0.5)));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(cv.width / 130, cv.height / 130, 1);
  s.center.set(0.5, 0);
  s.renderOrder = 11;
  return s;
}

export class Aldeoes {
  constructor(cena, mundo, som, emoji) {
    this.cena = cena; this.mundo = mundo; this.som = som; this.emoji = emoji;
    this.lista = [];
    this.povoadas = new Set();
    this.checar = 0;
    this.vilaAtual = null;
    this.aoEntrarVila = null;
    this.eraVista = mundo.era; // Linha do Tempo: quando a era muda, o povo troca de roupa (nasce de novo)
  }

  // chão perto de yRef: procura de yRef+acima até yRef-abaixo (ou o mundo todo, se yRef for null)
  solo(x, z, yRef, acima = 2, abaixo = 6) {
    const m = this.mundo, bx = Math.floor(x), bz = Math.floor(z);
    let y = yRef == null ? ALT - 1 : Math.floor(yRef) + acima;
    const fim = yRef == null ? 1 : yRef - abaixo;
    for (; y > fim && y > 0; y--) {
      const b = m.bloco(bx, y - 1, bz);
      if (SOLIDO[b] || AGUA[b]) return y;
    }
    return null;
  }

  // chão para quem está na altura y: se o pé está dentro de bloco, sobe até o primeiro vão
  // (até 3); senão desce até achar chão (até 6). Não confunde a verga da porta com o chão.
  chaoPerto(x, z, y) {
    const m = this.mundo, bx = Math.floor(x), bz = Math.floor(z), by = Math.floor(y + 0.01);
    const firme = (yy) => { const b = m.bloco(bx, yy, bz); return SOLIDO[b] || AGUA[b]; };
    if (firme(by)) { for (let k = 1; k <= 3; k++) if (!firme(by + k)) return by + k; return null; }
    for (let yy = by; yy > by - 6 && yy > 0; yy--) if (firme(yy - 1)) return yy;
    return null;
  }

  // o corpo (largura ~0.5) cabe em pé em (x, s, z)? O centro precisa de 2 blocos livres; as
  // beiradas só na altura do tronco (o pé pode encostar num degrau que ele vai subir)
  cabe(x, s, z) {
    const m = this.mundo, y0 = Math.floor(s + 0.01);
    if (SOLIDO[m.bloco(Math.floor(x), y0, Math.floor(z))] || SOLIDO[m.bloco(Math.floor(x), y0 + 1, Math.floor(z))]) return false;
    for (const [ox, oz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
      if (SOLIDO[m.bloco(Math.floor(x + ox), y0 + 1, Math.floor(z + oz))]) return false;
    }
    return true;
  }

  // dá para o morador `a` dar um passo até (x, z)? devolve a altura do chão lá (ou null).
  // Sobe degrau de até 2 blocos (pulando) e desce até 5 (caindo).
  passo(a, x, z) {
    const y = a.y, s = this.chaoPerto(x, z, y);
    if (s == null) return null;
    const subir = s - y;
    if (subir > 2.05 || subir < -5) return null;
    if (!this.cabe(x, s, z)) return null;
    if (AGUA[this.mundo.bloco(Math.floor(x), Math.floor(s) - 1, Math.floor(z))]) return null; // não entra no poço nem no rio
    if (subir > 0.05) { // para pular precisa de espaço em cima da cabeça
      const m = this.mundo, bx = Math.floor(a.x), bz = Math.floor(a.z), by = Math.floor(y + 0.01);
      for (let k = 2; k <= 1 + Math.ceil(subir - 0.05); k++) if (SOLIDO[m.bloco(bx, by + k, bz)]) return null;
    }
    return s;
  }

  // ---------- caminhos pela vila ----------
  pontoRua(v, ri, t) { const r = v.ruas[ri]; return [v.x + r.dx * t + 0.5, v.z + r.dz * t + 0.5]; }

  rota(a, v, de, para) {
    const pts = [];
    if (de.est) { if (de.dentro) pts.push([de.est.frente[0] + 0.5, de.est.frente[1] + 0.5]); pts.push(this.pontoRua(v, de.est.rua, de.est.t)); }
    const ruaDe = de.est ? de.est.rua : de.rua, ruaPara = para.est ? para.est.rua : para.rua;
    const tPara = para.est ? para.est.t : para.t;
    if (ruaDe !== ruaPara) {
      // contorna o poço pelo anel da praça
      let i = v.ruas[ruaDe].anel; const j = v.ruas[ruaPara].anel;
      const passo = ((j - i + 8) % 8) <= 4 ? 1 : -1;
      pts.push([v.x + ANEL[i][0] + 0.5, v.z + ANEL[i][1] + 0.5]);
      while (i !== j) { i = (i + passo + 8) % 8; pts.push([v.x + ANEL[i][0] + 0.5, v.z + ANEL[i][1] + 0.5]); }
    }
    pts.push(this.pontoRua(v, ruaPara, tPara));
    if (para.est) { pts.push([para.est.frente[0] + 0.5, para.est.frente[1] + 0.5]); if (para.dentro) pts.push([para.est.dentro[0] + 0.5, para.est.dentro[1] + 0.5]); }
    a.caminho = pts; a.melhorD = 1e9; a.preso = 0;
    a.no = para;
  }

  escolherDestino(a, noite) {
    const v = a.vila;
    if (noite && a.casa) { if (!(a.no.est === a.casa && a.no.dentro)) this.rota(a, v, a.no, { est: a.casa, dentro: true }); return; }
    const r = Math.random();
    const ests = v.estruturas.filter((e) => e.frente);
    // de dia, o padeiro trabalha na padaria e o lojista na loja da vila
    const trabalho = a.oficio === 'padeiro' ? v.padaria : a.oficio === 'lojista' ? v.loja : null;
    if (trabalho && r < 0.65) { if (!(a.no.est === trabalho && a.no.dentro)) this.rota(a, v, a.no, { est: trabalho, dentro: true }); else a.espera = 6 + Math.random() * 8; return; }
    if (r < 0.3 && ests.length) {
      const e = a.oficio === 'fazendeiro' && v.fazendas.length && Math.random() < 0.6 ? v.fazendas[Math.floor(Math.random() * v.fazendas.length)] : ests[Math.floor(Math.random() * ests.length)];
      this.rota(a, v, a.no, { est: e, dentro: e === a.casa && Math.random() < 0.5 });
    } else if (r < 0.5) {
      this.rota(a, v, a.no, { rua: Math.floor(Math.random() * v.ruas.length), t: 3 });
    } else {
      const ri = Math.floor(Math.random() * v.ruas.length);
      this.rota(a, v, a.no, { rua: ri, t: 5 + Math.floor(Math.random() * v.ruas[ri].L) });
    }
  }

  // ---------- nascer / sumir ----------
  povoar(v) {
    this.povoadas.add(v);
    const semCasa = v.casas.filter((c) => c.tipo === 'casa');
    const lugares = [];
    for (const c of semCasa.slice(0, 4)) lugares.push({ casa: c, est: c });
    for (const f of v.fazendas.slice(0, 1)) lugares.push({ casa: null, est: f, oficio: 'fazendeiro' });
    while (lugares.length < 2) lugares.push({ casa: null, est: null });
    lugares.forEach((l, i) => {
      const r = Math.random;
      let oficio = l.oficio;
      if (!oficio) {
        const op = v.estilo === 'praia' ? ['pescador', 'pescador', 'padeiro', 'florista', 'artesao'] : ['fazendeiro', 'padeiro', 'artesao', 'florista'];
        oficio = op[Math.floor(r() * op.length)];
        // a padaria e a loja da vila sempre têm quem trabalhe nelas
        if (i === 0 && v.padaria) oficio = 'padeiro';
        if (i === 1 && v.loja) oficio = 'lojista';
      }
      const mod = montarAldeao(r, oficio, this.mundo.era);
      const no = l.est ? { est: l.est, dentro: false } : { rua: i % v.ruas.length, t: 3 };
      const [x, z] = l.est ? [l.est.frente[0] + 0.5, l.est.frente[1] + 0.5] : this.pontoRua(v, no.rua, 3);
      const y = this.solo(x, z, (l.est ? l.est.y : v.y) + 1, 4, 10) ?? this.solo(x, z, null) ?? v.y + 1;
      const a = {
        ...mod, vila: v, casa: l.casa, oficio, nome: NOMES[Math.floor(r() * NOMES.length)],
        x, y, z, vy: 0, dir: Math.random() * 6.28, no, caminho: [], espera: 1 + Math.random() * 4, desvio: 0, lado: i % 2 ? 1 : -1,
        fase: Math.random() * 10, aceno: 0, falando: 0, balao: null, preso: 0, cumprimentou: 0, zzz: 2 + Math.random() * 3,
        tom: 0.85 + Math.random() * 0.5, raio: 0.35, alt: 1.85,
      };
      a.grupo.position.set(x, y, z);
      this.cena.add(a.grupo);
      this.lista.push(a);
    });
  }

  remover(i) {
    const a = this.lista[i];
    if (a.balao) this.tirarBalao(a);
    this.cena.remove(a.grupo);
    a.grupo.traverse((o) => o.geometry && o.geometry.dispose());
    this.lista.splice(i, 1);
  }

  limpar() { for (let i = this.lista.length - 1; i >= 0; i--) this.remover(i); this.povoadas.clear(); this.vilaAtual = null; }

  tirarBalao(a) { a.grupo.remove(a.balao); a.balao.material.map.dispose(); a.balao.material.dispose(); a.balao = null; }

  // ---------- conversa ----------
  conversar(a, jog, noite) {
    const v = a.vila;
    const era = this.mundo.era, q = Math.random();
    let lista = noite && a.no.dentro ? FALAS.noite
      : era != null && FALAS_ERA[era] ? (q < 0.55 ? FALAS_ERA[era] : q < 0.75 && era >= 4 ? FALAS[a.oficio] : GERAL_ERA)
        : q < 0.45 ? FALAS[a.oficio] : FALAS.geral;
    const fala = lista[Math.floor(Math.random() * lista.length)].replace('{vila}', v.nome);
    if (a.balao) this.tirarBalao(a);
    a.balao = balao(`${a.nome}: ${fala}`);
    a.balao.position.y = 2.15;
    a.grupo.add(a.balao);
    a.falando = 4.5; a.aceno = 1.4; a.espera = Math.max(a.espera, 5);
    a.dir = Math.atan2(jog.pos.x - a.x, jog.pos.z - a.z);
    // voz: "blá-blá" curtinho
    for (let k = 0; k < 3; k++) this.som.tom((300 + Math.random() * 180) * a.tom, 0.07, { tipo: 'triangle', vol: 0.22, atraso: k * 0.11, ate: (360 + Math.random() * 160) * a.tom });
    if (!noite && Math.random() < 0.35) {
      const p = PRESENTES[Math.floor(Math.random() * PRESENTES.length)];
      this.emoji(p, a.x + Math.sin(a.dir) * 0.6, a.y + 1.1, a.z + Math.cos(a.dir) * 0.6, 2, 0.55);
    }
  }

  atingir(o, dir, max) {
    let melhor = null, tm = max;
    const O = [o.x, o.y, o.z], D = [dir.x, dir.y, dir.z];
    for (const a of this.lista) {
      if (!a.grupo.visible) continue;
      const r = a.raio;
      const min = [a.x - r, a.y, a.z - r], mx = [a.x + r, a.y + a.alt, a.z + r];
      let t0 = 0, t1 = tm, ok = true;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(D[k]) < 1e-8) { if (O[k] < min[k] || O[k] > mx[k]) { ok = false; break; } continue; }
        let ta = (min[k] - O[k]) / D[k], tb = (mx[k] - O[k]) / D[k];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < tm) { tm = t0; melhor = a; }
    }
    return melhor ? { aldeao: melhor, t: tm } : null;
  }

  // empurra o morador na direção (ux, uz) só se lá couber (nunca para dentro de bloco)
  empurrar(a, ux, uz, q) {
    const nx = a.x + ux * q, nz = a.z + uz * q;
    const s = this.passo(a, nx, nz);
    if (s != null && Math.abs(s - a.y) < 0.5) { a.x = nx; a.z = nz; }
  }

  // ---------- a cada quadro ----------
  atualizar(dt, jog, altSol) {
    const p = jog.pos;
    const noite = altSol < -0.15;
    if (this.mundo.era !== this.eraVista) { this.eraVista = this.mundo.era; this.limpar(); this.checar = 0; }
    this.checar -= dt;
    if (this.checar <= 0) {
      this.checar = 1;
      const perto = this.mundo.vilas.perto(p.x, p.z, 90);
      for (const v of perto) if (!this.povoadas.has(v) && Math.hypot(v.x - p.x, v.z - p.z) < 65) this.povoar(v);
      for (const v of [...this.povoadas]) {
        if (Math.hypot(v.x - p.x, v.z - p.z) > 120) {
          for (let i = this.lista.length - 1; i >= 0; i--) if (this.lista[i].vila === v) this.remover(i);
          this.povoadas.delete(v);
        }
      }
      const aqui = perto.find((v) => Math.hypot(v.x + 0.5 - p.x, v.z + 0.5 - p.z) < v.raio + 2) || null;
      if (aqui && aqui !== this.vilaAtual && this.aoEntrarVila) this.aoEntrarVila(aqui);
      if (aqui || perto.every((v) => Math.hypot(v.x - p.x, v.z - p.z) > v.raio + 12)) this.vilaAtual = aqui;
    }

    for (const a of this.lista) {
      const dx = p.x - a.x, dz = p.z - a.z, dist = Math.hypot(dx, dz);
      a.grupo.visible = dist < 50;
      if (!a.grupo.visible) continue;

      // balão
      if (a.falando > 0) { a.falando -= dt; if (a.falando <= 0 && a.balao) this.tirarBalao(a); }
      // cumprimenta quem chega perto
      a.cumprimentou -= dt;
      if (dist < 3.5 && a.cumprimentou <= 0 && !(noite && a.no.dentro)) { a.cumprimentou = 25; a.aceno = 1.2; a.espera = Math.max(a.espera, 1.5); a.caminho.length && (a.pausa = 1.5); }

      let andando = false;
      if (a.falando > 0 || a.pausa > 0) {
        a.pausa = Math.max(0, (a.pausa || 0) - dt);
        a.dir = Math.atan2(dx, dz);
      } else if (a.caminho.length) {
        const [tx, tz] = a.caminho[0];
        const ex = tx - a.x, ez = tz - a.z, d = Math.hypot(ex, ez);
        // chegou (ou o ponto está ocupado por outro morador parado ali: chega pertinho e pronto)
        if (d < 0.25 || (d < 0.95 && this.lista.some((o) => o !== a && Math.hypot(o.x - tx, o.z - tz) < 0.6))) {
          a.caminho.shift(); a.preso = 0; a.desvio = 0; a.melhorD = 1e9;
          if (!a.caminho.length) a.espera = noite ? 8 : 2 + Math.random() * 6;
        } else {
          const vel = Math.min(1.35 * dt, d);
          // direção: reto para o ponto, ou o desvio que achou quando algo estava no caminho
          let ang = Math.atan2(ex, ez);
          if (a.desvio > 0) { a.desvio -= dt; ang = a.angDesvio; }
          let nx = a.x + Math.sin(ang) * vel, nz = a.z + Math.cos(ang) * vel;
          // porta fechada no caminho: o morador abre (e ela fecha sozinha depois)
          if (this.aoPorta) {
            const qx = Math.floor(a.x + Math.sin(ang) * 0.6), qz = Math.floor(a.z + Math.cos(ang) * 0.6);
            for (let k = 0; k <= 1; k++) if (this.mundo.bloco(qx, Math.floor(a.y) + k, qz) === M.PORTA) this.aoPorta(qx, Math.floor(a.y) + k, qz);
          }
          let s = this.passo(a, nx, nz);
          if (s == null && a.vy === 0) {
            // bloqueado: tenta contornar pelos lados (bloco que alguém colocou, poste, quina de parede)
            for (const g of [0.6, -0.6, 1.2, -1.2, 1.6, -1.6]) {
              const ang2 = Math.atan2(ex, ez) + g * (a.lado || 1);
              const qx = a.x + Math.sin(ang2) * vel, qz = a.z + Math.cos(ang2) * vel;
              const q = this.passo(a, qx, qz);
              if (q != null) { ang = ang2; nx = qx; nz = qz; s = q; a.angDesvio = ang2; a.desvio = 0.5; break; }
            }
          }
          a.dir = ang;
          if (s != null) {
            andando = true;
            const subir = s - a.y;
            // degrau: primeiro pula, depois anda (assim não entra no bloco nem "teleporta" para cima)
            if (subir > 0.05 && a.vy === 0) a.vy = subir > 1.05 ? 9.4 : 7.2;
            if (subir <= 0.05 || a.y >= s - 0.05) { a.x = nx; a.z = nz; }
          }
          // sem avançar há um tempo (parede, barranco alto, outro morador no corredor)?
          if (d < (a.melhorD ?? 1e9) - 0.05) { a.melhorD = d; a.preso = 0; } else a.preso += dt;
          if (a.preso > 3) {
            a.preso = 0; a.melhorD = 1e9; a.lado = -(a.lado || 1);
            // ninguém olhando de perto: dá a volta "por trás" e aparece no ponto. Com o jogador
            // perto, desiste desse caminho e escolhe outro (nada de atravessar parede na frente dele)
            const st = dist > 24 ? this.solo(tx, tz, a.y, 4, 10) : null;
            if (st != null && this.cabe(tx, st, tz)) { a.x = tx; a.z = tz; a.y = st; a.vy = 0; a.caminho.shift(); }
            else {
              // recomeça da rua mais perto do ponto onde ia (a próxima rota sai de lá)
              const n = a.no;
              a.no = n.est ? { rua: n.est.rua, t: n.est.t } : { rua: n.rua, t: n.t };
              a.caminho.length = 0; a.espera = 0.5 + Math.random() * 1.5; a.desistiu = (a.desistiu || 0) + 1;
            }
          }
        }
      } else {
        a.espera -= dt;
        if (a.espera <= 0) { this.escolherDestino(a, noite); a.espera = 3; }
        if (noite && a.no.dentro && dist < 22) { a.zzz -= dt; if (a.zzz <= 0) { a.zzz = 3; this.emoji('sono', a.x, a.y + 2, a.z, 1.6, 0.45); } }
      }
      // não atravessa os outros moradores nem o jogador: um empurrãozinho para o lado
      for (const o of this.lista) {
        if (o === a || !o.grupo.visible || Math.abs(o.y - a.y) > 1.5) continue;
        const ox = a.x - o.x, oz = a.z - o.z, od = Math.hypot(ox, oz);
        if (od < 0.7) this.empurrar(a, od > 0.01 ? ox / od : Math.sin(a.fase), od > 0.01 ? oz / od : Math.cos(a.fase), (0.7 - od) * 0.5);
      }
      if (dist < 0.75 && Math.abs(p.y - a.y) < 1.8) this.empurrar(a, dist > 0.01 ? -dx / dist : 1, dist > 0.01 ? -dz / dist : 0, 0.75 - dist);
      // gravidade (procura o chão bem para baixo: se cavarem embaixo dele, ele cai em vez de flutuar)
      const s = this.solo(a.x, a.z, a.y, 2, 60);
      const piso = s == null ? 1 : s;
      a.vy -= 20 * dt; a.y += a.vy * dt;
      if (a.y <= piso) { a.y = piso; a.vy = 0; }

      // animação
      a.fase += dt * (andando ? 8 : 0);
      const bal = andando ? Math.sin(a.fase) * 0.6 : 0;
      a.pernas[0].rotation.x = bal; a.pernas[1].rotation.x = -bal;
      a.bracos[0].rotation.x = -bal * 0.8; a.bracos[1].rotation.x = bal * 0.8; a.bracos[1].rotation.z = 0;
      if (a.aceno > 0) {
        a.aceno -= dt;
        a.bracos[1].rotation.x = Math.PI; a.bracos[1].rotation.z = Math.sin(a.aceno * 14) * 0.35;
      }
      a.cabeca.rotation.x = !andando && dist < 6 ? -0.15 : 0;
      const atual = a.grupo.rotation.y;
      const delta = ((a.dir - atual + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      a.grupo.rotation.y = atual + delta * Math.min(1, dt * 7);
      a.grupo.position.set(a.x, a.y, a.z);
    }
  }
}

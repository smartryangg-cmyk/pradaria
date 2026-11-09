// Opções escolhidas na criação do mundo (valem para todo mundo que entra nele).
// Usado pelo jogo (navegador) e pelo servidor (functions/api), então não importa nada.
//
// Como usar numa funcionalidade nova:
//   import { opcoesMundo } from './opcoes-mundo.js';
//   if (!opcoesMundo.vilas) return; // não gera vilas neste mundo
// Tamanho: `opcoesMundo.tamanho` ('pequeno' | 'medio' | 'grande'); `limiteMundo()` dá a meia-largura em blocos (null = sem fim).
// `opcoesMundo` é preenchido antes do mundo começar (iniciarMundo em main.js) e também fica em `mundo.opcoes`.
// Para criar uma opção nova: acrescente em OPCOES_MUNDO abaixo (o servidor e a tela já usam a lista).

export const OPCOES_MUNDO = [
  { id: 'sobrevivencia', icone: 'martelo', nome: 'Coletar e criar', desc: 'Quebre para juntar e crie ferramentas na bancada. Desligado: blocos à vontade', padrao: true, antigos: false },
  { id: 'animais', icone: 'ovelha', nome: 'Bichinhos', desc: 'Ovelhas, porquinhos, coelhos e amigos', padrao: true },
  { id: 'vilas', icone: 'vila', nome: 'Vilas', desc: 'Vilinhas com casas e moradores', padrao: true, terreno: true },
  { id: 'veiculos', icone: 'carro', nome: 'Veículos', desc: 'Carrinhos e barcos para passear', padrao: true },
  { id: 'maquinas', icone: 'engrenagem', nome: 'Máquinas', desc: 'Engenhocas, alavancas e esteiras', padrao: true },
  { id: 'aguaCorre', icone: 'onda', nome: 'Água que corre', desc: 'A água escorre e faz cachoeiras', padrao: true },
  { id: 'cicloDia', icone: 'lua', nome: 'Dia e noite', desc: 'Desligado: é sempre de dia', padrao: true },
  { id: 'mercado', icone: 'moeda', nome: 'Mercado', desc: 'Moedas e lojinha com os moradores', padrao: true, antigos: false },
  { id: 'objetivos', icone: 'alvo', nome: 'Missões', desc: 'Desafios com prêmios', padrao: true, antigos: false },
  { id: 'chatTexto', icone: 'balao', nome: 'Chat de texto', desc: 'Mensagens escritas, com filtro de palavrões e contatos', padrao: true, semRecarregar: true },
  { id: 'chatVoz', icone: 'microfone', nome: 'Chat de voz', desc: 'Falar com os amigos segurando o botão do microfone', padrao: true, semRecarregar: true },
  { id: 'selvagens', icone: 'pata', nome: 'Animais selvagens', desc: 'Lobos, raposas, ursos, onças, cobras e veados com instintos de verdade', padrao: true },
  { id: 'selvagensMachucam', icone: 'coracao', nome: 'Animais podem machucar', desc: 'Corações de vida. Bicho provocado morde. Luz e um toque espantam', padrao: false },
  { id: 'construcao', icone: 'tijolos', nome: 'Construção', desc: 'Colocar e quebrar blocos. Desligado: só explorar', padrao: true },
  { id: 'armas', icone: 'arma', nome: 'Armas', desc: 'Armas de brinquedo, munição e batalha entre amigos. 16 anos ou mais', padrao: false, antigos: false, mais16: true },
];
// padrao = como vem marcado ao criar; antigos = valor nos mundos criados antes da opção existir (se faltar, usa padrao)
// terreno = a opção muda o terreno gerado (ao editar um mundo já criado, o dono recebe um aviso)

// tamanho do mundo: pequeno e médio são ilhas com mar em volta (mais leves: dá para ver mais longe);
// grande não tem fim (como os mundos antigos, que ficam "grande").
export const TAMANHOS = {
  pequeno: { icone: 'ilha', nome: 'Pequeno', desc: 'Ilha de 256 blocos. Mais leve e bonito', limite: 128, raioExtra: 2 },
  medio: { icone: 'mapa', nome: 'Médio', desc: 'Ilha de 640 blocos', limite: 320, raioExtra: 1 },
  grande: { icone: 'globo', nome: 'Grande', desc: 'Sem fim. Pesa mais em aparelho fraco', limite: null, raioExtra: 0 },
};
export const TAMANHO_NOVO = 'medio'; // já vem marcado ao criar

// gerador do terreno: os mundos novos usam o clássico (biomas, rios, cavernas e minérios);
// os mundos antigos continuam com o terreno de antes para as construções não ficarem flutuando.
export const GERADORES = {
  atual: { nome: 'Pradaria de antes' },
  classico: { nome: 'Clássico: biomas, cavernas e minérios' },
};

// visual do mundo (suave.js): blocos quadradinhos ou "Natural 3D" (morros lisos, copas redondas, bichos arredondados).
// Só muda o desenho: os blocos, a colisão, colocar e quebrar são iguais nos dois.
export const ESTILOS = {
  blocos: { icone: 'bloco', nome: 'Blocos', desc: 'Tudo quadradinho, como sempre' },
  suave: { icone: 'montanha', nome: 'Natural 3D', desc: 'Morros lisos, árvores e bichos redondos' },
};

// tipo do mundo: um campo só, compartilhado pelos modos especiais. Para um tipo novo, acrescente aqui.
// historia = "Linha do Tempo": começa na era dos dinossauros e evolui com a experiência (eras-regras.js)
export const TIPOS = {
  normal: { icone: 'flor', nome: 'Pradaria', desc: 'O mundo de sempre, com vilas e bichinhos' },
  historia: { icone: 'ampulheta', nome: 'Linha do Tempo', desc: 'Começa com os dinossauros e evolui pela história', semSelvagens: true }, // os bichos de cada era vêm de fauna-eras.js
  // Ilha de Aventura (ilha-aventura.js): mapa como os de jogos de ação, mas sem armas. Tamanho fixo (limite/raioExtra valem no lugar do tamanho).
  aventura: { icone: 'ilha', nome: 'Ilha de Aventura', desc: 'Cidades, estradas, porto, farol e lugares com nome', limite: 256, raioExtra: 1 },
  // Guerra (guerra.js, guerra-mapa.js): ilha com Base Aliada, Forte Vermelho, presídio, delegacia e polícia.
  // mais16 = pergunta a idade antes de entrar (idade.js); forca = opções que valem sempre neste tipo
  guerra: { icone: 'tanque', nome: 'Guerra', desc: 'Base, forte inimigo, tanques, presídio e polícia. 16 anos ou mais', limite: 256, raioExtra: 1, mais16: true, forca: { armas: true } },
};

// PADRAO_MUNDO: o que vale quando falta a opção (mundos antigos); PADRAO_NOVO: o que já vem marcado ao criar
export const PADRAO_MUNDO = { ...Object.fromEntries(OPCOES_MUNDO.map((o) => [o.id, o.antigos ?? o.padrao])), tamanho: 'grande', tipo: 'normal', gerador: 'atual', estilo: 'blocos' };
export const PADRAO_NOVO = { ...Object.fromEntries(OPCOES_MUNDO.map((o) => [o.id, o.padrao])), tamanho: TAMANHO_NOVO, tipo: 'normal', gerador: 'classico', estilo: 'blocos' };

// aceita qualquer coisa (texto JSON, objeto, nada) e devolve só opções conhecidas, sempre true/false (+ tamanho)
export function normalizarOpcoes(o) {
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
  const r = { ...PADRAO_MUNDO };
  if (o && typeof o === 'object') {
    for (const k of Object.keys(r)) if (typeof o[k] === 'boolean' && typeof r[k] === 'boolean') r[k] = o[k];
    if (typeof o.tamanho === 'string' && Object.prototype.hasOwnProperty.call(TAMANHOS, o.tamanho)) r.tamanho = o.tamanho;
    if (typeof o.gerador === 'string' && Object.prototype.hasOwnProperty.call(GERADORES, o.gerador)) r.gerador = o.gerador;
    if (typeof o.tipo === 'string' && Object.prototype.hasOwnProperty.call(TIPOS, o.tipo)) r.tipo = o.tipo;
    if (typeof o.estilo === 'string' && Object.prototype.hasOwnProperty.call(ESTILOS, o.estilo)) r.estilo = o.estilo;
  }
  // mundos que ligaram "Monstros machucam" antes dos monstros virarem bichos selvagens continuam com corações
  if (o && typeof o === 'object' && typeof o.selvagensMachucam !== 'boolean' && o.monstrosMachucam === true) r.selvagensMachucam = true;
  if (TIPOS[r.tipo].semSelvagens) r.selvagens = false;
  if (TIPOS[r.tipo].forca) Object.assign(r, TIPOS[r.tipo].forca);
  if (!r.selvagens) r.selvagensMachucam = false;
  return r;
}

// ---------- editar um mundo já criado ----------
// Tipo, tamanho e gerador fazem o terreno (junto com a semente): ficam como foram criados.
// Todas as outras opções (as de OPCOES_MUNDO, inclusive as que forem acrescentadas depois) podem mudar.
export const FIXAS_AO_CRIAR = ['tipo', 'tamanho', 'gerador'];
export function editarOpcoes(atual, pedido) {
  const base = normalizarOpcoes(atual);
  const novo = normalizarOpcoes({ ...base, ...(pedido && typeof pedido === 'object' ? pedido : {}) });
  for (const k of FIXAS_AO_CRIAR) novo[k] = base[k];
  return normalizarOpcoes(novo);
}
// quais opções mudaram (ids de OPCOES_MUNDO)
// mudar estas não precisa recarregar o mundo de quem está jogando (semRecarregar: a sala aplica na hora)
export const precisaRecarregar = (mudou) => mudou.some((id) => !OPCOES_MUNDO.find((o) => o.id === id)?.semRecarregar);
// (o jeito do mundo, 'estilo', só muda o desenho, então dá para trocar depois de criado)
export const opcoesMudadas = (a, b) => { const x = normalizarOpcoes(a), y = normalizarOpcoes(b); return [...OPCOES_MUNDO.filter((o) => x[o.id] !== y[o.id]).map((o) => o.id), ...(x.estilo !== y.estilo ? ['estilo'] : [])]; };

// mundos com temas sensíveis (Guerra, Armas): precisam da resposta "tenho 16 anos ou mais" (idade.js e o servidor conferem)
export function precisa16(o) {
  const n = normalizarOpcoes(o);
  return !!(TIPOS[n.tipo].mais16 || n.armas);
}

// semente: número digitado vira ele mesmo; palavra vira um número (sempre igual para a mesma palavra)
export function sementeDeTexto(t) {
  const s = String(t ?? '').trim();
  if (!s) return null;
  if (/^\d{1,9}$/.test(s)) return +s;
  let h = 2166136261;
  for (const ch of s.toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return (h >>> 0) % 1000000000;
}

// o objeto das opções do mundo que está aberto agora (mesma referência sempre)
export const opcoesMundo = { ...PADRAO_MUNDO };
export function definirOpcoesMundo(o) { Object.assign(opcoesMundo, normalizarOpcoes(o)); return opcoesMundo; }
export const limiteMundo = () => TIPOS[opcoesMundo.tipo]?.limite ?? TAMANHOS[opcoesMundo.tamanho].limite;
export const raioExtraMundo = () => TIPOS[opcoesMundo.tipo]?.raioExtra ?? TAMANHOS[opcoesMundo.tamanho].raioExtra;

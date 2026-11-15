// Personagem (skin) do jogador: escolhas pequenas (números) que o servidor confere e todo mundo desenha igual.
// Usado no jogo (editor e boneco), na API (salvar na conta) e na sala (mandar para os amigos). Sem THREE aqui.

// cores que aparecem nos quadradinhos do editor
export const PELES = [0xfbe0c8, 0xf1c8a0, 0xe0ac7e, 0xc68b59, 0xa86b40, 0x8a5530, 0x6a3f22, 0x4a2c18];
export const CORES_CABELO = [0x2a1d14, 0x5a3a22, 0x8b5a2b, 0xc98b3c, 0xf0d27a, 0xd9643a, 0x9a9a9a, 0xf4f4f4, 0x4f7bd9, 0xe36aa8, 0x47b06a, 0x8e5bd0];
export const CORES_OLHOS = [0x222222, 0x6b4325, 0x3f7fd0, 0x3c9a52, 0x8f9aa3, 0x9b59d0];
export const CORES_ROUPA = [
  0x3f6fd9, 0xe8433f, 0x4caf50, 0xf2c72e, 0x9c5bd9, 0xf29ac2, 0xff8a3d, 0x2bb3b3,
  0xffffff, 0x2b2b2b, 0x7a4a26, 0x1f3c88, 0x8bd3f7, 0xb8e986, 0xc0392b, 0x9e9e9e,
];

// Cor livre: além dos quadradinhos, qualquer cor (0xRRGGBB) guardada como COR_LIVRE + cor.
export const COR_LIVRE = 0x1000000;
export const ehLivre = (v) => Number.isInteger(v) && v >= COR_LIVRE && v <= COR_LIVRE + 0xffffff;
export const corLivre = (rgb) => COR_LIVRE + (rgb & 0xffffff);
// número salvo -> 0xRRGGBB
export const corDe = (paleta, v) => (ehLivre(v) ? v - COR_LIVRE : paleta[v] ?? paleta[0]);

// tom de pele livre: régua do mais claro ao mais escuro (0..1), passando por tons de pele de verdade
const REGUA_PELE = [0xffe9d6, 0xf6d0b1, 0xeab48a, 0xd59a6a, 0xb97c4c, 0x95603a, 0x704428, 0x4b2c19, 0x33200f];
export function tomDePele(t) {
  t = Math.max(0, Math.min(1, t)) * (REGUA_PELE.length - 1);
  const i = Math.min(REGUA_PELE.length - 2, Math.floor(t)), f = t - i, a = REGUA_PELE[i], b = REGUA_PELE[i + 1];
  const m = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f) << s;
  return m(16) | m(8) | m(0);
}

// cada parte: lista de estilos (nome para a tela). A ordem não pode mudar (o número vai salvo na conta):
// coisas novas entram sempre no fim da lista.
export const PARTES = {
  formato: ['Quadrado', 'Redondo', 'Oval', 'Largo'],
  cabelo: ['Careca', 'Curtinho', 'Espetado', 'Franja', 'Comprido', 'Rabo de cavalo', 'Coque', 'Black power',
    'Moicano', 'Duas tranças', 'Chanel', 'Topete', 'Maria-chiquinha'],
  olhos: ['Pontinhos', 'Grandes', 'Felizes', 'Brilhando', 'Sonolentos', 'Com cílios', 'Piscando', 'Bem redondos'],
  sobrancelha: ['Nenhuma', 'Fininha', 'Grossa', 'Brava', 'Preocupada'],
  boca: ['Sorriso', 'Sorrisão', 'Quietinho', 'Língua de fora', 'Surpresa', 'Dentinhos', 'Sorriso de lado'],
  // (3 e 4 eram óculos; agora óculos têm o lugar deles em "oculos")
  rosto: ['Nada', 'Bochechas', 'Sardas', 'Bigode', 'Barba', 'Pintinha', 'Curativo'],
  roupa: ['Camiseta', 'Regata', 'Manga comprida', 'Moletom com capuz', 'Vestido', 'Jardineira', 'Camisa social', 'Jaqueta'],
  estampa: ['Lisa', 'Listras', 'Faixa', 'Bolso', 'Xadrez', 'Estrela'],
  calca: ['Calça', 'Bermuda', 'Saia', 'Calça rasgada'],
  sapato: ['Tênis', 'Botas', 'Sandália', 'Descalço', 'Galocha'],
  chapeu: ['Nada', 'Boné', 'Chapéu de palha', 'Gorro', 'Coroa', 'Laço', 'Capacete', 'Tiara', 'Fones', 'Cartola'],
  oculos: ['Nenhum', 'Redondos', 'Quadrados', 'Escuros', 'De sol coloridos', 'De mergulho'],
  costas: ['Nada', 'Mochila', 'Capa', 'Asinhas', 'Violão'],
  altura: ['Bem baixinho', 'Baixinho', 'Médio', 'Alto', 'Bem alto'],
  corpo: ['Magrinho', 'Normal', 'Forte'],
};
// tamanho do boneco: [largura, altura] para cada opção
export const ALTURAS = [0.82, 0.91, 1, 1.07, 1.14];
export const CORPOS = [0.86, 1, 1.15];

// campo -> quantas opções (paleta: aceita também cor livre)
const ESTILO = (k) => ({ n: PARTES[k].length });
const COR = (paleta) => ({ n: paleta.length, livre: true });
const LIMITES = {
  pele: COR(PELES), formato: ESTILO('formato'), cabelo: ESTILO('cabelo'), corCabelo: COR(CORES_CABELO),
  olhos: ESTILO('olhos'), corOlhos: COR(CORES_OLHOS), sobrancelha: ESTILO('sobrancelha'), boca: ESTILO('boca'), rosto: ESTILO('rosto'),
  roupa: ESTILO('roupa'), corRoupa: COR(CORES_ROUPA), estampa: ESTILO('estampa'), corDetalhe: COR(CORES_ROUPA),
  calca: ESTILO('calca'), corCalca: COR(CORES_ROUPA), sapato: ESTILO('sapato'), corSapato: COR(CORES_ROUPA),
  chapeu: ESTILO('chapeu'), corChapeu: COR(CORES_ROUPA), oculos: ESTILO('oculos'), corOculos: COR(CORES_ROUPA),
  costas: ESTILO('costas'), corCostas: COR(CORES_ROUPA), altura: ESTILO('altura'), corpo: ESTILO('corpo'),
};
export const CAMPOS = Object.keys(LIMITES);
export const ehCampoCor = (k) => !!(LIMITES[k] && LIMITES[k].livre);

// o boneco de antes (camiseta da cor escolhida, cabelo castanho curtinho, calça jeans)
export const PADRAO = {
  pele: 1, formato: 0, cabelo: 1, corCabelo: 1, olhos: 0, corOlhos: 0, sobrancelha: 0, boca: 0, rosto: 0,
  roupa: 0, corRoupa: 0, estampa: 0, corDetalhe: 8, calca: 0, corCalca: 11, sapato: 0, corSapato: 9,
  chapeu: 0, corChapeu: 1, oculos: 0, corOculos: 9, costas: 0, corCostas: 1, altura: 2, corpo: 1,
};

// contas antigas só tinham "cor" (0..7 = cor da camiseta); vira um personagem com essa camiseta
export function skinDeCor(cor) {
  return { ...PADRAO, corRoupa: Number.isInteger(cor) && cor >= 0 && cor < 8 ? cor : 0 };
}

const valido = (k, v) => Number.isInteger(v) && ((v >= 0 && v < LIMITES[k].n) || (LIMITES[k].livre && ehLivre(v)));

// aceita objeto ou texto JSON; qualquer coisa estranha volta ao padrão (nunca quebra o boneco de ninguém)
export function normalizarSkin(s, cor) {
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = null; } }
  const base = skinDeCor(cor);
  if (!s || typeof s !== 'object' || Array.isArray(s)) return base;
  s = { ...s };
  // personagens salvos antes dos óculos virarem acessório: rosto 3 = óculos, 4 = óculos escuros
  if (s.oculos === undefined && (s.rosto === 3 || s.rosto === 4)) { s.oculos = s.rosto === 3 ? 2 : 3; s.rosto = 0; }
  const r = {};
  for (const k of CAMPOS) r[k] = valido(k, s[k]) ? s[k] : base[k];
  return r;
}

export const skinIgual = (a, b) => CAMPOS.every((k) => a[k] === b[k]);
export const chaveSkin = (s) => CAMPOS.map((k) => s[k]).join('.');

export function skinAleatoria(rnd = Math.random) {
  const r = {};
  for (const k of CAMPOS) r[k] = Math.floor(rnd() * LIMITES[k].n);
  // mais simpático: menos chapéu, óculos, barba e coisas nas costas; altura e corpo perto do meio
  if (rnd() < 0.5) r.chapeu = 0;
  if (rnd() < 0.7) r.oculos = 0;
  if (rnd() < 0.6) r.costas = 0;
  if (rnd() < 0.7) r.rosto = Math.floor(rnd() * 3);
  if (rnd() < 0.5) r.sobrancelha = 1;
  r.altura = 1 + Math.floor(rnd() * 3); r.corpo = rnd() < 0.6 ? 1 : Math.floor(rnd() * 3);
  return r;
}

// ---------- modelos salvos (vários personagens guardados) ----------
export const MAX_MODELOS = 8;
const NOME_MODELO = /^[A-Za-zÀ-ÿ0-9 ]{1,16}$/;
export function normalizarModelos(lista) {
  if (typeof lista === 'string') { try { lista = JSON.parse(lista); } catch { lista = null; } }
  if (!Array.isArray(lista)) return [];
  const out = [];
  for (const m of lista.slice(0, MAX_MODELOS)) {
    if (!m || typeof m !== 'object') continue;
    const nome = typeof m.nome === 'string' ? m.nome.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '').trim().replace(/\s+/g, ' ').slice(0, 16) : '';
    out.push({ nome: NOME_MODELO.test(nome) ? nome : `Modelo ${out.length + 1}`, s: normalizarSkin(m.s) });
  }
  return out;
}

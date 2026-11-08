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

// cada parte: lista de estilos (nome para a tela). A ordem não pode mudar (o número vai salvo na conta).
export const PARTES = {
  cabelo: ['Careca', 'Curtinho', 'Espetado', 'Franja', 'Comprido', 'Rabo de cavalo', 'Coque', 'Black power'],
  olhos: ['Pontinhos', 'Grandes', 'Felizes', 'Brilhando', 'Sonolentos'],
  boca: ['Sorriso', 'Sorrisão', 'Quietinho', 'Língua de fora'],
  rosto: ['Nada', 'Bochechas', 'Sardas', 'Óculos', 'Óculos escuros'],
  roupa: ['Camiseta', 'Regata', 'Manga comprida', 'Moletom com capuz', 'Vestido', 'Jardineira'],
  estampa: ['Lisa', 'Listras', 'Faixa', 'Bolso'],
  calca: ['Calça', 'Bermuda', 'Saia'],
  chapeu: ['Nada', 'Boné', 'Chapéu de palha', 'Gorro', 'Coroa', 'Laço'],
};

// campo -> quantas opções (o servidor recusa o que estiver fora)
const LIMITES = {
  pele: PELES.length, cabelo: PARTES.cabelo.length, corCabelo: CORES_CABELO.length,
  olhos: PARTES.olhos.length, corOlhos: CORES_OLHOS.length, boca: PARTES.boca.length, rosto: PARTES.rosto.length,
  roupa: PARTES.roupa.length, corRoupa: CORES_ROUPA.length, estampa: PARTES.estampa.length, corDetalhe: CORES_ROUPA.length,
  calca: PARTES.calca.length, corCalca: CORES_ROUPA.length, corSapato: CORES_ROUPA.length,
  chapeu: PARTES.chapeu.length, corChapeu: CORES_ROUPA.length,
};
export const CAMPOS = Object.keys(LIMITES);

// o boneco de antes (camiseta da cor escolhida, cabelo castanho curtinho, calça jeans)
export const PADRAO = {
  pele: 1, cabelo: 1, corCabelo: 1, olhos: 0, corOlhos: 0, boca: 0, rosto: 0,
  roupa: 0, corRoupa: 0, estampa: 0, corDetalhe: 8, calca: 0, corCalca: 11, corSapato: 9, chapeu: 0, corChapeu: 1,
};

// contas antigas só tinham "cor" (0..7 = cor da camiseta); vira um personagem com essa camiseta
export function skinDeCor(cor) {
  return { ...PADRAO, corRoupa: Number.isInteger(cor) && cor >= 0 && cor < 8 ? cor : 0 };
}

// aceita objeto ou texto JSON; qualquer coisa estranha volta ao padrão (nunca quebra o boneco de ninguém)
export function normalizarSkin(s, cor) {
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch { s = null; } }
  const base = skinDeCor(cor);
  if (!s || typeof s !== 'object' || Array.isArray(s)) return base;
  const r = {};
  for (const k of CAMPOS) {
    const v = s[k];
    r[k] = Number.isInteger(v) && v >= 0 && v < LIMITES[k] ? v : base[k];
  }
  return r;
}

export const skinIgual = (a, b) => CAMPOS.every((k) => a[k] === b[k]);
export const chaveSkin = (s) => CAMPOS.map((k) => s[k]).join('.');

export function skinAleatoria(rnd = Math.random) {
  const r = {};
  for (const k of CAMPOS) r[k] = Math.floor(rnd() * LIMITES[k]);
  // sem óculos escuros e chapéu demais: fica mais simpático
  if (rnd() < 0.5) r.chapeu = 0;
  if (rnd() < 0.6) r.rosto = Math.floor(rnd() * 3);
  return r;
}

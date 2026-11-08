// Dados das armas (opção "Armas" do mundo). Usado pelo jogo e pelo servidor da sala, então não importa nada.
// Tudo é de brinquedo: cores fortes, ponta laranja e "dano" em meios corações (a vida tem 10 = 5 corações).
//  dano: por chumbo · chumbos: quantos saem por tiro · intervalo: segundos entre tiros · auto: segurar atira sem parar
//  pente: tiros antes de recarregar · recarga: segundos · alcance: blocos · disp: espalhamento (radianos)
//  zoom: aproximação ao mirar · municao: tipo de munição que usa
export const ARMAS = {
  pistola: { nome: 'Pistola', cor: 0x5aa0e0, dano: 2, chumbos: 1, intervalo: 0.3, auto: false, pente: 12, recarga: 1.1, alcance: 60, disp: 0.012, zoom: 1.25, municao: 'leve', chance: 34 },
  sub: { nome: 'Submetralhadora', cor: 0xf2c72e, dano: 1, chumbos: 1, intervalo: 0.085, auto: true, pente: 30, recarga: 1.5, alcance: 40, disp: 0.038, zoom: 1.25, municao: 'leve', chance: 24 },
  espingarda: { nome: 'Espingarda', cor: 0xe8433f, dano: 1, chumbos: 7, intervalo: 0.85, auto: false, pente: 6, recarga: 2.0, alcance: 22, disp: 0.085, zoom: 1.15, municao: 'cartucho', chance: 18 },
  fuzil: { nome: 'Fuzil', cor: 0x6cc04a, dano: 2, chumbos: 1, intervalo: 0.13, auto: true, pente: 25, recarga: 1.8, alcance: 85, disp: 0.02, zoom: 1.6, municao: 'media', chance: 16 },
  precisao: { nome: 'Rifle de precisão', cor: 0xb07ad9, dano: 7, chumbos: 1, intervalo: 1.2, auto: false, pente: 5, recarga: 2.4, alcance: 160, disp: 0.002, zoom: 3.5, municao: 'pesada', chance: 8 },
};
export const MUNICOES = {
  leve: { nome: 'Munição leve', cor: 0x5aa0e0, caixa: 30, max: 150 },
  media: { nome: 'Munição média', cor: 0x6cc04a, caixa: 30, max: 150 },
  cartucho: { nome: 'Cartuchos', cor: 0xe8433f, caixa: 10, max: 40 },
  pesada: { nome: 'Munição pesada', cor: 0xb07ad9, caixa: 6, max: 24 },
};
export const CABECA = 1.5; // acerto na cabeça vale 1,5x
export const VOLTA_ITEM = 90; // segundos para um item pego aparecer de novo no mesmo lugar

// maior "dano" possível de um tiro (o servidor usa para conferir)
export const danoMaximo = (a) => (ARMAS[a] ? Math.ceil(ARMAS[a].dano * ARMAS[a].chumbos * CABECA) : 0);

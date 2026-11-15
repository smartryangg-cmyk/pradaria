// Instintos dos bichos, baseados no comportamento dos animais de verdade.
// Este arquivo só tem dados (não desenha nada), então serve para qualquer bicho novo,
// inclusive os das eras (dinossauros, mamutes...): basta registrar com registrarInstinto().
//
// O que cada campo quer dizer:
//   selvagem   true = bicho do mato (só aparece com a opção "Animais selvagens"); false = de fazenda, aceita carinho
//   dieta      'erva' | 'carne' | 'onivoro'
//   presas     espécies que ele caça quando está com fome (nunca filhotes)
//   atividade  quando está acordado: 'dia' | 'noite' | 'crepusculo' (amanhecer e entardecer) | 'sempre'
//   grupo      [mín, máx] tamanho do bando ao aparecer; o bando anda junto (coesão)
//   filhotes   [chance, mín, máx] de vir com filhotes, que seguem a mãe
//   fuga       distância de fuga: se o jogador chega mais perto que isso, ele foge (0 = não foge de gente)
//   congela    coelhos primeiro congelam (ficam paradinhos) e só correm se você chegar mais perto
//   alerta     a que distância percebe um predador
//   corrida    velocidade correndo; folego = quantos segundos aguenta correr
//   curioso    chance de vir olhar o jogador de perto (vacas, porcos e raposas são curiosos)
//   territorio se o jogador chegar mais perto que isso, ele avisa (rosna, chocalha) e depois avança
//   defende    raio em volta dos filhotes que a mãe defende
//   dano       meios corações que tira ao morder/bicar (0 = só empurra). Só com "Animais podem machucar"
//   cacaGente  com muita fome, de noite e longe de luz, pode espreitar o jogador (raríssimo na vida real)
//   sucesso    chance de pegar a presa no fim da corrida (na natureza a maioria das caçadas falha)
//   habitat    peso de aparecer em cada lugar: prado, floresta, beira (perto d'água), praia, montanha,
//              taiga, neve, deserto, savana, selva (biomas do mundo clássico)
//   foge_agua  a capivara foge para dentro d'água quando assustada
//   vida       quantos golpes aguenta (mão = 1, ferramenta de madeira = 2, de pedra = 3). 0 = não se ataca (cachorro)
//   revida     o que faz quando apanha: 'foge' (padrão: corre e avisa o bando), 'sempre' (enfrenta: urso, onça),
//              'bando' (com o bando por perto, todos enfrentam; sozinho foge: lobos, vacas), 'bote' (cobra: dá o
//              bote se você estiver perto, senão vai embora). Mãe com filhotes sempre enfrenta, e ferido demais foge.
//   nome       como aparece nos avisos ("o lobo", "a onça"); nomeMae quando está com filhotes ("a ursa")
//
// Fontes da pesquisa (resumo): distância de fuga de herbívoros (Hediger), rebanhos de ovinos e bovinos
// (pastejo de 7 a 10 h por dia, mães bovinas defendem bezerros), lobos (matilhas de 2 a 8, caçam ao
// entardecer e à noite, sucesso de 10 a 25 por cento, evitam pessoas), raposa-vermelha (solitária,
// curiosa, crepuscular, caça coelhos e aves), urso (solitário, onívoro, mãe com filhotes é o caso mais
// perigoso, avisa antes de avançar), onça-pintada (solitária, embosca perto d'água, come capivaras,
// queixadas e veados, corrida curta), cobras (de sangue frio: ativas de dia, avisam antes do bote,
// não perseguem), capivaras (grupos perto d'água, fogem mergulhando), coelhos (congelam e depois
// disparam em zigue-zague), galinhas (dormem no poleiro ao escurecer, galinha choca protege pintinhos),
// e animais selvagens evitam fogo e luz forte à noite. Quando atacados: herbívoros fogem e o bando foge junto,
// ursos e onças encurralados enfrentam, lobos e vacas em grupo se juntam contra o perigo, cobras dão o bote.

export const INSTINTOS = {
  // ---------- fazenda (mansos) ----------
  ovelha: { selvagem: false, vida: 4, dieta: 'erva', atividade: 'dia', grupo: [2, 5], filhotes: [0.35, 1, 2], fuga: 3, alerta: 12, corrida: 3.6, folego: 8,
    curioso: 0.05, habitat: { prado: 3, montanha: 1, taiga: 0.5 }, nome: 'a ovelha' },
  porquinho: { selvagem: false, vida: 5, dieta: 'onivoro', atividade: 'dia', grupo: [1, 3], filhotes: [0.4, 2, 3], fuga: 2, alerta: 10, corrida: 3.4, folego: 6,
    curioso: 0.35, habitat: { prado: 2, floresta: 1, selva: 0.5 }, nome: 'o porquinho' },
  galinha: { selvagem: false, vida: 2, dieta: 'onivoro', atividade: 'dia', grupo: [2, 4], filhotes: [0.4, 2, 3], fuga: 2, alerta: 8, corrida: 3.2, folego: 4,
    curioso: 0.05, defende: 3, dano: 0, habitat: { prado: 3, savana: 0.5 }, nome: 'a galinha' },
  vaca: { selvagem: false, vida: 6, revida: 'bando', dieta: 'erva', atividade: 'dia', grupo: [2, 3], filhotes: [0.3, 1, 1], fuga: 2, alerta: 12, corrida: 3.4, folego: 8,
    curioso: 0.35, defende: 5, dano: 0, habitat: { prado: 2, savana: 1 }, nome: 'a vaca' },
  cachorro: { selvagem: false, vida: 0, dieta: 'onivoro', atividade: 'sempre', grupo: [1, 1], fuga: 0, alerta: 12, corrida: 5, folego: 20,
    curioso: 0.6, habitat: { prado: 1 }, nome: 'o cachorro' },
  capivara: { selvagem: false, vida: 5, dieta: 'erva', atividade: 'crepusculo', grupo: [2, 5], filhotes: [0.5, 1, 3], fuga: 4, alerta: 14, corrida: 4, folego: 8,
    curioso: 0.05, foge_agua: true, habitat: { beira: 4, praia: 1, selva: 1 }, nome: 'a capivara' },
  coelho: { selvagem: false, vida: 2, dieta: 'erva', atividade: 'crepusculo', grupo: [1, 3], fuga: 3.5, congela: 8, alerta: 12, corrida: 5.2, folego: 5,
    curioso: 0, habitat: { prado: 3, floresta: 1, montanha: 1, neve: 1.5, deserto: 1, taiga: 1 }, nome: 'o coelho' },

  // ---------- selvagens ----------
  veado: { selvagem: true, vida: 5, dieta: 'erva', atividade: 'crepusculo', grupo: [2, 4], filhotes: [0.4, 1, 1], fuga: 11, alerta: 18, corrida: 6, folego: 9,
    curioso: 0, habitat: { floresta: 3, prado: 1, taiga: 2, savana: 1 }, nome: 'o veado' },
  lobo: { selvagem: true, vida: 6, revida: 'bando', dieta: 'carne', presas: ['veado', 'ovelha', 'coelho'], atividade: 'crepusculo', grupo: [2, 4], fuga: 8, alerta: 20, corrida: 5, folego: 14,
    curioso: 0, territorio: 0, dano: 1, cacaGente: true, sucesso: 0.25, habitat: { montanha: 2, floresta: 1, prado: 0.6, taiga: 2.5, neve: 2 }, nome: 'o lobo' },
  raposa: { selvagem: true, vida: 3, dieta: 'carne', presas: ['coelho', 'galinha'], atividade: 'crepusculo', grupo: [1, 1], fuga: 5, alerta: 14, corrida: 5, folego: 6,
    curioso: 0.4, dano: 0, sucesso: 0.35, habitat: { floresta: 1.5, prado: 1, neve: 1, deserto: 1, taiga: 1 }, nome: 'a raposa' },
  urso: { selvagem: true, vida: 12, revida: 'sempre', dieta: 'onivoro', presas: ['veado'], atividade: 'dia', grupo: [1, 1], filhotes: [0.6, 1, 2], fuga: 0, alerta: 16, corrida: 4.8, folego: 6,
    curioso: 0.1, territorio: 3.5, defende: 9, dano: 2, sucesso: 0.15, habitat: { floresta: 1.5, montanha: 1, taiga: 2 }, nome: 'o urso', nomeMae: 'a ursa' },
  onca: { selvagem: true, vida: 9, revida: 'sempre', dieta: 'carne', presas: ['capivara', 'veado', 'porquinho'], atividade: 'noite', grupo: [1, 1], filhotes: [0.3, 1, 1], fuga: 11, alerta: 18,
    corrida: 5.6, folego: 4, curioso: 0, territorio: 0, defende: 7, dano: 2, cacaGente: true, sucesso: 0.4, habitat: { floresta: 1, beira: 1.5, selva: 3, savana: 0.5 }, nome: 'a onça' },
  cobra: { selvagem: true, vida: 2, revida: 'bote', dieta: 'carne', atividade: 'dia', grupo: [1, 1], fuga: 0, alerta: 4, corrida: 1.6, folego: 2, curioso: 0, territorio: 3, bote: 1.5,
    dano: 1, naoPersegue: true, habitat: { prado: 0.5, floresta: 0.6, praia: 0.8, deserto: 2, selva: 1.5, savana: 1 }, nome: 'a cobra' },
};

// bichos novos (das eras, por exemplo) entram aqui. Campos que faltarem usam o padrão abaixo.
const PADRAO = { selvagem: false, vida: 4, revida: 'foge', dieta: 'erva', atividade: 'dia', grupo: [1, 1], fuga: 3, alerta: 10, corrida: 3.5, folego: 6, curioso: 0, dano: 0, habitat: { prado: 1 } };
export function registrarInstinto(especie, dados) { INSTINTOS[especie] = { ...PADRAO, ...dados }; }
export const instinto = (especie) => INSTINTOS[especie] || PADRAO;

// quem caça quem (calculado das listas de presas)
export function predadoresDe(especie) {
  const r = [];
  for (const [k, v] of Object.entries(INSTINTOS)) if (v.presas && v.presas.includes(especie)) r.push(k);
  return r;
}

// sol: seno da hora do dia (1 = meio-dia, -1 = meia-noite)
export function acordado(atividade, sol) {
  switch (atividade) {
    case 'dia': return sol > -0.1;
    case 'noite': return sol < 0.2;
    case 'crepusculo': return Math.abs(sol) < 0.55; // amanhecer, entardecer e um pedaço da noite/dia
    default: return true;
  }
}

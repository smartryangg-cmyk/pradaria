// Armadura do jogo clássico: capacete, peitoral, calça e botas de couro, ferro e diamante.
// Cada peça vai num espaço próprio do inventário (inventario.js) e protege do que machuca de fora
// (bichos, monstros, fogo e lava). Queda, fome e afogar passam direto, como no clássico.
// A conta é a do clássico: cada ponto de armadura tira 4% do dano (até 80%), e o golpe forte
// atravessa um pouco (a dureza do diamante segura melhor). Cada golpe gasta as peças vestidas.
// Sem tela: o teste roda no node; economia.js e a sala usam os ids e o desgaste (receitas.js DURA).

export const PARTES = ['cabeca', 'peito', 'pernas', 'pes'];
export const NOME_PARTE = ['Cabeça', 'Peito', 'Pernas', 'Pés'];

// id: [parte, pontos de defesa, dureza, usos]
export const ARMADURA = {
  1117: [0, 1, 0, 55], 1118: [1, 3, 0, 80], 1119: [2, 2, 0, 75], 1120: [3, 1, 0, 65],         // couro
  1121: [0, 2, 0, 165], 1122: [1, 6, 0, 240], 1123: [2, 5, 0, 225], 1124: [3, 2, 0, 195],     // ferro
  1125: [0, 3, 2, 363], 1126: [1, 8, 2, 528], 1127: [2, 6, 2, 495], 1128: [3, 3, 2, 429],     // diamante
};
export const ehArmadura = (id) => !!ARMADURA[id];
export const parteDe = (id) => (ARMADURA[id] ? ARMADURA[id][0] : -1);
// usos de cada peça (entra no DURA das ferramentas)
export const DURA_ARMADURA = Object.fromEntries(Object.entries(ARMADURA).map(([id, a]) => [id, a[3]]));

// o que machuca de fora: a armadura segura
export const PROTEGE = new Set(['bicho', 'monstro', 'fogo', 'lava']);

// soma das peças vestidas (ids)
export function defesa(ids) {
  let d = 0, t = 0;
  for (const id of ids || []) { const a = ARMADURA[id]; if (a) { d += a[1]; t += a[2]; } }
  return { d, t };
}

// dano depois da armadura (conta do clássico). Devolve o dano (inteiro, em meios corações) e quanto cada peça gasta.
// sorte(): 0..1 para arredondar sem perder a média (o clássico guarda meio de meio coração; aqui não)
// fator: o que sobra depois da Proteção dos encantos (encantos-regras.js fatorProtecao; 1 = sem encanto)
export function reduzir(dano, ids, sorte = Math.random, fator = 1) {
  const { d, t } = defesa(ids);
  if (!(dano > 0) || !d) return { dano, gasto: 0 };
  const efetiva = Math.min(20, Math.max(d / 5, d - dano / (2 + t / 4)));
  const bruto = dano * (1 - efetiva / 25) * fator;
  const inteiro = Math.floor(bruto);
  return { dano: inteiro + (sorte() < bruto - inteiro ? 1 : 0), gasto: Math.max(1, Math.floor(dano / 4)) };
}

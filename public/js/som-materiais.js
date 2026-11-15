// De que é feito cada bloco, para o som (passo, bater, quebrar, colocar). Calculado uma vez pelo nome.
import { BLOCOS } from './blocos.js';

const REGRAS = [
  ['agua', /água|cachoeira/i],
  ['vidro', /vidro|vitral|janela|cristal|neon|lâmpada|luz de led|pisca/i],
  ['pedra', /telha|tijolo|moinho|minério|fóssil|castelo/i],
  ['metal', /ferro|metal|chapa|engrenagem|cano|sino|painel|ouro|canhão|lampião|trilho|fio|cabo|ventilador|esteira/i],
  ['tecido', /lã|cama|tenda|estandarte|feno|palha|saco|trampolim/i],
  ['neve', /neve|gelo/i],
  ['areia', /areia|cascalho|pedrisco|barro/i],
  ['folhas', /folha|capim|flor|trigo|arbusto|samambaia|cavalinha|musgo|cacto/i],
  ['madeira', /tronco|tábua|bancada|porta|portão|cerca|cadeira|mesa|balcão|estante|prateleira|cesta|enxaimel|catavento|manivela|roda|alavanca|botão|placa|escada|forno/i],
  ['grama', /grama/i],
  ['terra', /terra/i],
];

const TABELA = new Array(256).fill('pedra');
for (let id = 0; id < BLOCOS.length; id++) {
  const b = BLOCOS[id];
  if (!b) continue;
  const r = REGRAS.find(([, re]) => re.test(b.nome));
  TABELA[id] = r ? r[0] : 'pedra';
}

export function materialDe(id) { return TABELA[id & 255] || 'pedra'; }

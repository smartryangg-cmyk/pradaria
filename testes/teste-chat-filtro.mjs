// Filtro do chat sem navegador: tentativas de passar telefone, contato, palavrão e perguntas de estranho.
// Uso: node testes/teste-chat-filtro.mjs
import { filtrarChat } from '../public/js/chat-filtro.js';
let falhas = 0;
const conferir = (ok, msg) => { console.log((ok ? 'ok   ' : 'FALHA') + ' ' + msg); if (!ok) falhas++; };
const barra = [
  // telefone
  '98765 4321', '98- 76- 54- 32', '98..76..54..32', '９８７６５４３２１', '9️⃣8️⃣7️⃣6️⃣5️⃣', '¹¹⁹⁸⁷⁶⁵', '①②③④⑤⑥', 'nove nove oito sete seis', 'meu zap 11 9 8 7',
  // contato
  'me chama no zapzap', 'me segue @joaozinho', 'add meu dc joao#1234', 'yt: joaozinho', 'tt: joaozinho', 'meu roblox é joao_123', 's n a p', 'site.xyz', 'meusite(ponto)com',
  'me chama no whats', 'insta', 'disсord', 'ｄｉｓｃｏｒｄ', 'pоrra',
  // palavrão
  'putinha', 'fuuuck', 'f*ck', 'kct', 'porrrra', 'transar',
  // perguntas de estranho
  'manda foto', 'quantos anos vc tem', 'qual sua escola', 'ond vc mora', 'onde vc mora?', 'rua das flores 12', 'vamos nos encontrar', 'não conta pros seus pais', 'tá sozinho?',
];
for (const t of barra) { const r = filtrarChat(t); conferir(!!r.erro || /\*/.test(r.texto), `barrado: "${t}" -> ${r.erro || r.texto}`); }
const passa = ['oi, vamos construir uma casa?', 'tenho 10 anos de jogo', 'olha o porão', 'temporada de chuva', 'faz a parede ali', 'eu te pego no pega-pega', 'isso não conta', 'vou pegar o fone', 'o carro é caro', 'que bolo gostoso', 'achei 3 ovelhas e 4 porcos', 'passa a ponte'];
for (const t of passa) { const r = filtrarChat(t); conferir(r.texto === t, `passa normal: "${t}" -> ${r.erro || r.texto}`); }
if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('tudo certo');

// Filtro do chat de texto (o mesmo código roda na sala, que é quem decide, e no jogo, que avisa antes de mandar).
// Palavrão vira asteriscos; contato (telefone, rede social, link, e-mail, endereço, senha) não é enviado.
// Não importa nada: a sala (sala-worker) usa este arquivo direto.

export const CHAT_MAX = 100; // letras por mensagem

// palavras inteiras feias (depois de tirar acento e trocar 0->o, 1->i, 3->e, 4->a, 5->s, @->a)
const FEIA_PALAVRA = /^(puta|puto|putas|putos|fdp|vtnc|vsf|pqp|tnc|cu|cuzao|viado|bicha|sexo|sexy|pelado|pelada|otario|otaria|idiota|idiotas|imbecil|dick|ass|cock|pussy|nigga|nigger|caralho|krl|crl|porra|merda|bosta|foda|fodase|foder|fudido|fudida|desgracado|desgracada|arrombado|arrombada|piranha|vagabundo|vagabunda|retardado|retardada)$/;
// pedaços feios dentro de qualquer palavra (ou de letras separadas: "p o r r a")
const FEIA_DENTRO = ['caralh', 'buceta', 'porra', 'merda', 'bosta', 'foder', 'fodase', 'xoxota', 'piroca', 'retardad', 'nazi', 'hitler', 'porn', 'nude', 'fuck', 'shit', 'bitch', 'arrombad', 'vagabund', 'punheta', 'putaria'];
// contato e coisas que criança não deve passar pelo chat
const CONTATO_PALAVRA = /^(zap|wpp|insta|ig|face|snap|pix|cpf)$/;
const CONTATO_DENTRO = ['whatsapp', 'whats', 'instagram', 'tiktok', 'discord', 'telegram', 'kwai', 'youtube', 'gmail', 'hotmail', 'outlook', 'facebook',
  'snapchat', 'arroba', 'http', 'www', 'endereco', 'ondevocemora', 'ondevcmora', 'ondetumora', 'meunumero', 'seunumero', 'minhasenha', 'suasenha', 'qualasenha', 'qualsuasenha'];

// acentos (marcas combinantes) e caracteres invisíveis, montados por código para o arquivo ficar só com texto simples
const faixa = (a, b) => String.fromCharCode(a) + '-' + String.fromCharCode(b);
const ACENTOS = new RegExp('[' + faixa(0x300, 0x36f) + ']', 'g');
const CONTROLE = new RegExp('[' + faixa(0, 0x1f) + faixa(0x7f, 0x9f) + ']', 'g');
const INVISIVEIS = new RegExp('[' + [faixa(0x200b, 0x200f), faixa(0x2028, 0x202e), faixa(0x2060, 0x206f), faixa(0xfeff, 0xfeff)].join('') + ']', 'g');
const normal = (s) => String(s).normalize('NFD').replace(ACENTOS, '').toLowerCase()
  .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a').replace(/\$/g, 's');

// devolve { texto } (já limpo) ou { erro } quando não pode mandar
export function filtrarChat(entrada) {
  if (typeof entrada !== 'string') return { erro: 'Mensagem vazia.' };
  // tira caracteres de controle e invisíveis, junta espaços
  let t = entrada.replace(CONTROLE, ' ').replace(INVISIVEIS, '').replace(/\s+/g, ' ').trim();
  if (!t) return { erro: 'Mensagem vazia.' };
  if (t.length > CHAT_MAX) t = t.slice(0, CHAT_MAX);
  // telefone: 5 ou mais números seguidos (aceita um separador entre eles)
  if (/\d{5}/.test(t.replace(/\D+/g, (x) => (x.length > 1 ? '|' : '')))) return { erro: 'Não dá para mandar números de telefone no chat.' };
  // link ou e-mail
  if (/[a-z0-9]\s*(\.|ponto)\s*(com|net|org|br|gg|io|me|ly|tv)\b/i.test(t) || /\S@\S+\.\S/.test(t)) return { erro: 'Não dá para mandar links ou e-mails no chat.' };
  const tokens = t.split(' ');
  const juntoTudo = normal(t).replace(/[^a-z]/g, '');
  if (CONTATO_DENTRO.some((p) => juntoTudo.includes(p)) || tokens.some((w) => CONTATO_PALAVRA.test(normal(w).replace(/[^a-z]/g, ''))))
    return { erro: 'Para sua segurança, não combine contato, endereço ou senha pelo chat.' };
  // palavrão: a palavra vira asteriscos
  const limpos = tokens.map((w) => {
    const n = normal(w).replace(/[^a-z]/g, '');
    if (n && (FEIA_PALAVRA.test(n) || FEIA_DENTRO.some((p) => n.includes(p)))) return '*'.repeat(Math.min(8, w.length));
    return w;
  });
  // palavrão escondido com letras separadas ("p o r r a")
  const resto = normal(limpos.join(' ')).replace(/[^a-z]/g, '');
  if (FEIA_DENTRO.some((p) => resto.includes(p))) return { erro: 'Essa mensagem tem palavra feia.' };
  t = limpos.join(' ');
  if (!/[^*\s]/.test(t)) return { erro: 'Essa mensagem tem palavra feia.' };
  return { texto: t };
}

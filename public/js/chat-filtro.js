// Filtro do chat de texto (o mesmo código roda na sala, que é quem decide, e no jogo, que avisa antes de mandar).
// Palavrão vira asteriscos; contato (telefone, rede social, link, e-mail, endereço, senha) não é enviado.
// Não importa nada: a sala (sala-worker) usa este arquivo direto.

export const CHAT_MAX = 100; // letras por mensagem

// palavras inteiras feias (depois de tirar acento e trocar 0->o, 1->i, 3->e, 4->a, 5->s, @->a)
const FEIA_PALAVRA = /^(puta|puto|putas|putos|fdp|vtnc|vsf|pqp|tnc|cu|cuzao|viado|bicha|sexo|sexy|pelado|pelada|otario|otaria|idiota|idiotas|imbecil|dick|ass|cock|pussy|nigga|nigger|caralho|krl|crl|porra|merda|bosta|foda|fodase|foder|fudido|fudida|desgracado|desgracada|arrombado|arrombada|piranha|vagabundo|vagabunda|retardado|retardada|putinha|putinho|kct|transar|transa|fck|fuk|fuc|wtf|stfu)$/;
// pedaços feios dentro de qualquer palavra (ou de letras separadas: "p o r r a")
const FEIA_DENTRO = ['caralh', 'buceta', 'porra', 'merda', 'bosta', 'foder', 'fodase', 'xoxota', 'piroca', 'retardad', 'nazi', 'hitler', 'porn', 'nude', 'fuck', 'shit', 'bitch', 'arrombad', 'vagabund', 'punheta', 'putaria', 'putinh', 'fodend', 'fodid', 'fudend', 'cacete', 'boquete', 'siririca', 'pelad', 'safad', 'tesao', 'nudes'];
// contato e coisas que criança não deve passar pelo chat
const CONTATO_PALAVRA = /^(zap|zapzap|wpp|whats|insta|ig|face|fb|snap|pix|cpf|rg|dc|yt|tt|tel|cel|email)$/;
const CONTATO_DENTRO = ['whatsapp', 'whats', 'instagram', 'tiktok', 'discord', 'telegram', 'kwai', 'youtube', 'gmail', 'hotmail', 'outlook', 'facebook',
  'snapchat', 'arroba', 'http', 'www', 'endereco', 'ondevocemora', 'ondevcmora', 'ondetumora', 'meunumero', 'seunumero', 'minhasenha', 'suasenha', 'qualasenha', 'qualsuasenha',
  'snap', 'roblox', 'twitch', 'whatsap', 'meutelefone', 'meucelular', 'seutelefone', 'seucelular', 'meuperfil', 'seuperfil', 'meucanal', 'meuuser', 'meunick',
  // perguntas que estranho faz para criança (foto, idade, escola, onde mora, encontro)
  'mandafoto', 'mandaumafoto', 'suafoto', 'fotosua', 'fotodevc', 'fotodevoce', 'quantosanos', 'qualsuaidade', 'suaidade', 'qualaidade', 'qualescola', 'suaescola', 'qualcolegio', 'seucolegio',
  'ondevcmor', 'ondvcmor', 'ondevocemor', 'ondetumor', 'ondemor', 'qualcidade', 'qualbairro', 'seubairro', 'suacidade', 'seuendereco', 'suarua', 'qualrua', 'ruadas', 'ruados', 'avenida',
  'vamosencontr', 'vamosnosencontr', 'teencontr', 'segredinho', 'naocontapr', 'seuspais', 'teuspais', 'tasozinh', 'estasozinh', 'tasozinha'];

// acentos (marcas combinantes) e caracteres invisíveis, montados por código para o arquivo ficar só com texto simples
const faixa = (a, b) => String.fromCharCode(a) + '-' + String.fromCharCode(b);
const ACENTOS = new RegExp('[' + faixa(0x300, 0x36f) + ']', 'g');
const CONTROLE = new RegExp('[' + faixa(0, 0x1f) + faixa(0x7f, 0x9f) + ']', 'g');
const INVISIVEIS = new RegExp('[' + [faixa(0x200b, 0x200f), faixa(0x2028, 0x202e), faixa(0x2060, 0x206f), faixa(0xfeff, 0xfeff)].join('') + ']', 'g');
const normal = (s) => String(s).normalize('NFKC').normalize('NFD').replace(ACENTOS, '').toLowerCase()
  .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/@/g, 'a').replace(/\$/g, 's');

// letras repetidas viram uma ("fuuuck" -> "fuck"): as listas são comparadas das duas formas
// (pedaço sem letra dobrada compara com tudo junto em uma; com letra dobrada, só tira o exagero: "porrrra" -> "porra",
//  sem fazer "temporada" virar "pora")
const colapsar = (s) => s.replace(/(.)\1+/g, '$1');
const exagero = (s) => s.replace(/(.)\1\1+/g, '$1$1');
const DOBRADA = /(.)\1/;
const temPedaco = (n, lista) => { const c = colapsar(n), e = exagero(n); return lista.some((p) => n.includes(p) || (DOBRADA.test(p) ? e.includes(p) : c.includes(p))); };
// números escritos por extenso ("nove nove oito sete...")
const NUM_PALAVRA = /^(zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|meia)$/;
// letras de outros alfabetos que parecem as nossas (cirílico "о", grego "ο"...)
const OUTRO_ALFABETO = /[\u0370-\u03ff\u0400-\u052f\u2c00-\u2dff\ua640-\ua69f\u13a0-\u13ff]/;
// quantos algarismos tem o texto (qualquer alfabeto de números)
export const contarDigitos = (t) => (String(t).normalize('NFKC').match(/\p{Nd}/gu) || []).length;

// devolve { texto } (já limpo) ou { erro } quando não pode mandar
export function filtrarChat(entrada) {
  if (typeof entrada !== 'string') return { erro: 'Mensagem vazia.' };
  // tira caracteres de controle e invisíveis, junta espaços
  let t = entrada.replace(CONTROLE, ' ').replace(INVISIVEIS, '').replace(/\s+/g, ' ').trim();
  if (!t) return { erro: 'Mensagem vazia.' };
  if (t.length > CHAT_MAX) t = t.slice(0, CHAT_MAX);
  const k = t.normalize('NFKC'); // "９８７", "¹²³", "①②③" e "ｄｉｓｃｏｒｄ" viram os normais
  if (OUTRO_ALFABETO.test(k)) return { erro: 'Use só letras do nosso alfabeto no chat.' };
  // telefone: 5 ou mais algarismos na mensagem (separados ou não), ou 4 números por extenso
  if (contarDigitos(k) >= 5) return { erro: 'Não dá para mandar números de telefone no chat.' };
  const tokens = t.split(' ');
  if (tokens.filter((w) => NUM_PALAVRA.test(normal(w).replace(/[^a-z]/g, ''))).length >= 4) return { erro: 'Não dá para mandar números de telefone no chat.' };
  // link, e-mail ou @usuario
  if (/[a-z0-9]\s*(\.|\(?\s*ponto\s*\)?|\[\s*ponto\s*\]|\bdot\b)\s*(com|net|org|br|gg|io|me|ly|tv|xyz|site|online|app|link|club|info|co|top|live|store|shop|fun|vip)\b/i.test(k) || /\S@\S+\.\S/.test(k) || /@\s*[a-z0-9_]/i.test(k))
    return { erro: 'Não dá para mandar links, e-mails ou @ no chat.' };
  if (/#\s*\d/.test(k)) return { erro: 'Para sua segurança, não combine contato, endereço ou senha pelo chat.' }; // usuario#1234
  const juntoTudo = normal(t).replace(/[^a-z]/g, '');
  if (temPedaco(juntoTudo, CONTATO_DENTRO) || tokens.some((w) => { const n = normal(w).replace(/[^a-z]/g, ''); return CONTATO_PALAVRA.test(n) || CONTATO_PALAVRA.test(colapsar(n)); }))
    return { erro: 'Para sua segurança, não combine contato, endereço, foto ou senha pelo chat.' };
  // palavrão: a palavra vira asteriscos
  const limpos = tokens.map((w) => {
    const n = normal(w).replace(/[^a-z]/g, '');
    if (n && (FEIA_PALAVRA.test(n) || FEIA_PALAVRA.test(colapsar(n)) || temPedaco(n, FEIA_DENTRO))) return '*'.repeat(Math.min(8, w.length));
    return w;
  });
  // palavrão escondido com letras separadas ("p o r r a") ou com símbolos no meio ("f*ck")
  const resto = normal(limpos.join(' ')).replace(/[^a-z]/g, '');
  if (temPedaco(resto, FEIA_DENTRO)) return { erro: 'Essa mensagem tem palavra feia.' };
  t = limpos.join(' ');
  if (!/[^*\s]/.test(t)) return { erro: 'Essa mensagem tem palavra feia.' };
  return { texto: t };
}

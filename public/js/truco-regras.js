// Regras do truco paulista (as mesmas no navegador e no servidor da mesa): baralho de 40 cartas (sem 8, 9 e 10),
// vira e manilha, 3 cartas por jogador, melhor de 3 rodadas, truco (3), seis, nove e doze, mão de onze e mão de ferro.
// 2 jogadores (um contra um) ou 4 (duplas: lugares 0 e 2 contra 1 e 3). Sem nada de tela aqui.
//
// Carta: valor + naipe, ex. '4o', 'Qe', 'Ac', '3p'. Ordem: 4 5 6 7 Q J K A 2 3. Naipes da manilha (fraco ao forte):
// o ouros, e espadas, c copas, p paus (o "zap"). A manilha é o valor seguinte ao da vira.

export const VALORES = '4567QJKA23';
export const NAIPES = 'oecp';
export const NOME_NAIPE = { o: 'ouros', e: 'espadas', c: 'copas', p: 'paus' };
export const NOME_VALOR = { 4: '4', 5: '5', 6: '6', 7: '7', Q: 'dama', J: 'valete', K: 'rei', A: 'ás', 2: '2', 3: '3' };
const SOBE = { 1: 3, 3: 6, 6: 9, 9: 12 };
export const NOME_APOSTA = { 3: 'Truco', 6: 'Seis', 9: 'Nove', 12: 'Doze' };
export const time = (lugar) => lugar % 2;

export const manilhaDe = (vira) => VALORES[(VALORES.indexOf(vira[0]) + 1) % 10];
export function forca(carta, manilha) {
  if (carta[0] === manilha) return 100 + NAIPES.indexOf(carta[1]);
  return VALORES.indexOf(carta[0]);
}

// sorteio que dá para repetir (o servidor guarda só o número)
function aleatorio(e) {
  e.rng = (e.rng + 0x6d2b79f5) >>> 0;
  let t = e.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function novo(n = 2, semente = Math.floor(Math.random() * 2 ** 31)) {
  const e = { n: n === 4 ? 4 : 2, pontos: [0, 0], dealer: -1, rng: semente >>> 0, fim: null, ultimaMao: null, seq: 0, eventos: [] };
  novaMao(e);
  return e;
}

function evento(e, ev) { e.seq++; e.eventos.push({ ...ev, s: e.seq }); if (e.eventos.length > 12) e.eventos.shift(); }

function novaMao(e) {
  e.dealer = (e.dealer + 1) % e.n;
  const baralho = [];
  for (const v of VALORES) for (const s of NAIPES) baralho.push(v + s);
  for (let i = baralho.length - 1; i > 0; i--) { const j = Math.floor(aleatorio(e) * (i + 1)); [baralho[i], baralho[j]] = [baralho[j], baralho[i]]; }
  const maos = [];
  for (let k = 0; k < e.n; k++) maos.push(baralho.splice(0, 3));
  const vira = baralho.pop();
  const inicio = (e.dealer + 1) % e.n;
  const onzes = [0, 1].filter((t) => e.pontos[t] === 11);
  e.mao = {
    vira, manilha: manilhaDe(vira), maos, mesa: [], vazas: [], vez: inicio, comeca: inicio, valor: 1, aposta: null, subiu: null,
    // mão de onze: o time com 11 vê as cartas e decide se joga (vale 3) ou corre (o outro ganha 1). Os dois com 11: mão de ferro.
    onze: onzes.length === 1 ? { time: onzes[0] } : null, ferro: onzes.length === 2,
    ganhou: [], // por rodada: lugar que ganhou (ou -1 empate)
  };
}

// quem ganha a mão olhando as rodadas (vazas: time que ganhou cada uma, -1 = empate). undefined = continua; -1 = ninguém
function vencedorDaMao(v) {
  if (v.length < 2) return undefined;
  const [a, b, c] = v;
  if (a !== -1 && b === a) return a;
  if (a === -1 && b !== -1) return b;
  if (a !== -1 && b === -1) return a;
  if (v.length < 3) return undefined;
  if (a === -1 && b === -1) return c; // c pode ser -1: ninguém marca
  return c === -1 ? a : c; // cada um ganhou uma
}

function marcar(e, t, pontos, motivo) {
  if (t >= 0) e.pontos[t] = Math.min(12, e.pontos[t] + pontos);
  e.ultimaMao = { time: t, pontos: t >= 0 ? pontos : 0, motivo, vira: e.mao.vira, seq: e.seq + 1 };
  evento(e, { t: 'mao', time: t, pontos: t >= 0 ? pontos : 0, motivo });
  const f = [0, 1].find((x) => e.pontos[x] >= 12);
  if (f !== undefined) { e.fim = { vencedor: f }; e.mao.vez = -1; return; }
  novaMao(e);
}

function fecharRodada(e) {
  const m = e.mao;
  let melhor = -1, quem = [];
  for (const j of m.mesa) {
    const f = forca(j.carta, m.manilha);
    if (f > melhor) { melhor = f; quem = [j.lugar]; } else if (f === melhor) quem.push(j.lugar);
  }
  const times = [...new Set(quem.map(time))];
  const tg = times.length === 1 ? times[0] : -1;
  m.vazas.push(tg);
  m.ganhou.push(tg === -1 ? -1 : quem[0]);
  evento(e, { t: 'rodada', time: tg, lugar: tg === -1 ? -1 : quem[0], mesa: m.mesa.slice() });
  e.ultimaRodada = { mesa: m.mesa.slice(), lugar: tg === -1 ? -1 : quem[0], time: tg, seq: e.seq };
  m.mesa = [];
  // quem ganhou começa a próxima; no empate começa quem jogou a carta mais alta primeiro
  m.vez = m.comeca = quem[0];
  const v = vencedorDaMao(m.vazas);
  if (v !== undefined) marcar(e, v, m.valor, 'cartas');
}

// confere e faz a ação de um jogador. msg: { t: 'jogar', carta } | truco | aceitar | correr | aumentar | { t: 'onze', jogar }
// devolve null se deu certo ou o texto do erro
export function agir(e, lugar, msg) {
  if (e.fim) return 'O jogo acabou.';
  const m = e.mao;
  const t = time(lugar);
  if (m.onze && msg.t !== 'onze') return m.onze.time === t ? 'Decida se vai jogar a mão de onze.' : 'Esperando o outro time decidir a mão de onze.';
  if (msg.t === 'onze') {
    if (!m.onze || m.onze.time !== t) return 'Não é hora disso.';
    const outro = 1 - t;
    m.onze = null;
    if (msg.jogar) { m.valor = 3; evento(e, { t: 'onze', time: t, jogar: true }); }
    else { evento(e, { t: 'onze', time: t, jogar: false }); marcar(e, outro, 1, 'correu da mão de onze'); }
    return null;
  }
  if (msg.t === 'aceitar' || msg.t === 'correr' || msg.t === 'aumentar') {
    if (!m.aposta) return 'Ninguém pediu truco.';
    if (time(lugar) === m.aposta.time) return 'Quem responde é o outro time.';
    if (msg.t === 'aceitar') { m.valor = m.aposta.valor; m.subiu = m.aposta.time; evento(e, { t: 'aceitou', lugar, valor: m.valor }); m.aposta = null; return null; }
    if (msg.t === 'correr') { const a = m.aposta; m.aposta = null; evento(e, { t: 'correu', lugar }); marcar(e, a.time, m.valor, 'correu'); return null; }
    if (m.aposta.valor >= 12) return 'Doze é o máximo.';
    // aumentar = aceitar o que foi pedido e pedir mais
    m.valor = m.aposta.valor; m.subiu = m.aposta.time;
    m.aposta = { valor: SOBE[m.valor], time: t, lugar };
    evento(e, { t: 'pediu', lugar, valor: m.aposta.valor });
    return null;
  }
  if (m.aposta) return 'Responda o ' + NOME_APOSTA[m.aposta.valor].toLowerCase() + ' primeiro.';
  if (m.vez !== lugar) return 'Não é a sua vez.';
  if (msg.t === 'truco') {
    if (m.ferro) return 'Na mão de ferro não tem truco.';
    if (m.valor >= 12) return 'Já está valendo doze.';
    if (m.subiu === t) return 'Agora só o outro time pode aumentar.';
    if (e.pontos[0] === 11 || e.pontos[1] === 11) return 'Na mão de onze não tem truco.';
    m.aposta = { valor: SOBE[m.valor], time: t, lugar };
    evento(e, { t: 'pediu', lugar, valor: m.aposta.valor });
    return null;
  }
  if (msg.t === 'jogar') {
    const i = m.maos[lugar].indexOf(msg.carta);
    if (i < 0) return 'Você não tem essa carta.';
    m.maos[lugar].splice(i, 1);
    m.mesa.push({ lugar, carta: msg.carta });
    evento(e, { t: 'jogou', lugar, carta: msg.carta });
    if (m.mesa.length === e.n) fecharRodada(e);
    else m.vez = (lugar + 1) % e.n;
    return null;
  }
  return 'Ação desconhecida.';
}

// quem precisa agir agora (para os robôs e para a tela): lugares
export function quemAge(e) {
  if (e.fim) return [];
  const m = e.mao;
  if (m.onze) return [0, 1, 2, 3].slice(0, e.n).filter((l) => time(l) === m.onze.time);
  if (m.aposta) return [0, 1, 2, 3].slice(0, e.n).filter((l) => time(l) !== m.aposta.time);
  return [m.vez];
}

// o que o jogador do lugar vê (as cartas dos outros ficam escondidas)
export function visao(e, lugar) {
  const m = e.mao;
  const parceiro = e.n === 4 ? (lugar + 2) % 4 : -1;
  // mão de onze: quem tem 11 vê a mão do parceiro para decidir
  const verParceiro = m.onze && m.onze.time === time(lugar) && parceiro >= 0;
  return {
    n: e.n, pontos: e.pontos, dealer: e.dealer, fim: e.fim, eu: lugar,
    vira: m.vira, manilha: m.manilha, mesa: m.mesa, ultimaRodada: e.ultimaRodada || null, vazas: m.vazas, ganhou: m.ganhou, vez: m.vez, valor: m.valor, aposta: m.aposta, subiu: m.subiu,
    onze: m.onze, ferro: m.ferro, minhas: lugar >= 0 ? m.maos[lugar].slice() : [], parceiro: verParceiro ? m.maos[parceiro].slice() : null,
    quantas: m.maos.map((x) => x.length), age: quemAge(e), ultimaMao: e.ultimaMao, eventos: e.eventos.slice(-6), seq: e.seq,
  };
}

// ---------- computador ----------
// nota da mão de 0 a 1 (manilhas e cartas altas)
function notaMao(cartas, manilha) {
  if (!cartas.length) return 0;
  const f = cartas.map((c) => forca(c, manilha)).sort((a, b) => b - a);
  const n = (x) => (x >= 100 ? 1 + (x - 100) * 0.1 : x / 12);
  return f.reduce((s, x, i) => s + n(x) * [0.5, 0.33, 0.17][i], 0);
}
// o que o robô do lugar faz agora (ou null se não é com ele)
export function robo(e, lugar, aleat = Math.random) {
  const m = e.mao;
  if (!quemAge(e).includes(lugar)) return null;
  const minhas = m.maos[lugar];
  const nota = notaMao(minhas, m.manilha) + (m.vazas[0] === time(lugar) ? 0.25 : m.vazas[0] === 1 - time(lugar) ? -0.25 : 0);
  if (m.onze) return { t: 'onze', jogar: nota > 0.45 || e.pontos[1 - m.onze.time] >= 9 };
  if (m.aposta) {
    if (nota > 0.85 && m.aposta.valor < 12 && aleat() < 0.5) return { t: 'aumentar' };
    if (nota > 0.42 || (e.pontos[1 - time(lugar)] + m.valor >= 12 && nota > 0.25)) return { t: 'aceitar' };
    return { t: 'correr' };
  }
  // pedir truco às vezes (com mão boa, ou blefe raro)
  const podeTrucar = !m.ferro && m.valor < 12 && m.subiu !== time(lugar) && e.pontos[0] !== 11 && e.pontos[1] !== 11;
  if (podeTrucar && ((nota > 0.75 && aleat() < 0.6) || aleat() < 0.04)) return { t: 'truco' };
  const fs = minhas.map((c) => ({ c, f: forca(c, m.manilha) })).sort((a, b) => a.f - b.f);
  if (!m.mesa.length) {
    // primeira da rodada: na 1ª joga uma do meio, depois a mais forte
    return { t: 'jogar', carta: (m.vazas.length === 0 && fs.length > 1 ? fs[Math.floor(fs.length / 2)] : fs[fs.length - 1]).c };
  }
  let melhor = null;
  for (const j of m.mesa) { const f = forca(j.carta, m.manilha); if (!melhor || f > melhor.f) melhor = { f, lugar: j.lugar }; }
  if (time(melhor.lugar) === time(lugar)) return { t: 'jogar', carta: fs[0].c }; // o parceiro está ganhando
  const ganha = fs.find((x) => x.f > melhor.f);
  return { t: 'jogar', carta: (ganha || fs[0]).c };
}

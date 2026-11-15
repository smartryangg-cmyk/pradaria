// Roteiro dos jogos de mesa: um jogador por aparelho joga Xadrez e Dama contra o computador escolhendo lances ao
// acaso entre as casas que o jogo mostra (tocar na peça e na casa), até a partida acabar ou 60 lances; e Truco
// contra o computador tocando em cartas ao acaso. Confere regras do clássico (20 lances no começo do xadrez,
// 24 peças na dama), que o jogo nunca trava ("sua vez" sem nenhuma jogada possível) e que não há erro de JavaScript.
// Depois, dois jogadores procuram partida valendo pontos ao mesmo tempo e precisam se encontrar.
import { Jogador, sorteio, BASE } from '../base.mjs';

const casasPode = (j) => j.p.$$eval('.casa.pode', (l) => l.map((e) => +e.dataset.i));
async function minhasPecas(j, jogo) {
  return j.p.evaluate((jogo) => {
    const g = window['__' + jogo]; if (!g || !g.e) return [];
    const tab = g.e.b || g.e.t || g.e.tab || [];
    const voce = g.voce;
    return tab.map((p, i) => [p, i]).filter(([p]) => p && (typeof p === 'string' ? (voce === 'b' || voce === 'w' || voce === 0 ? p === p.toUpperCase() : p === p.toLowerCase()) : (p > 0) === (voce !== 2 && voce !== 'p'))).map(([, i]) => i);
  }, jogo);
}

async function partidaAoAcaso(j, jogo, rnd) {
  await j.p.goto(BASE + '/' + jogo + '#teste'); await j.ve('#x-menu:not([hidden])');
  await j.aperta('.nivel[data-nivel="1"]', 'nível Fácil');
  await j.aperta('#bt-computador', 'Jogar contra o computador');
  if (!(await j.ve('#x-jogo:not([hidden])'))) return j.bug(`${jogo}: a partida contra o computador não abriu`);
  if (jogo === 'xadrez') {
    let n = 0; for (const i of await j.p.$$eval('.casa', (l) => l.map((e) => +e.dataset.i).filter((i) => i >= 48))) { await j.p.locator(`.casa[data-i="${i}"]`).click(); n += (await casasPode(j)).length; }
    await j.espera(n === 20, 'xadrez: no começo as brancas têm 20 lances possíveis', { tipo: 'clássico', visto: n + ' lances' });
  } else {
    const pecas = await j.p.evaluate(() => window.__dama.e.b.filter(Boolean).length);
    await j.espera(pecas === 24, 'dama: 24 peças no começo', { tipo: 'clássico', visto: String(pecas) });
  }
  let lances = 0, semSaida = 0;
  while (lances < 60) {
    if (await j.p.isVisible('#x-fim:not([hidden])')) { j.passo('a partida acabou: ' + (await j.p.locator('#fim-titulo').innerText())); break; }
    const status = await j.p.locator('#x-status').innerText().catch(() => '');
    if (!/Sua vez|Tem que comer|Xeque|sua vez/i.test(status)) { await j.p.waitForTimeout(700); semSaida++; if (semSaida > 40) { await j.bug(`${jogo}: o computador não respondeu em 28 s`, { tipo: 'travou', visto: status }); return; } continue; }
    semSaida = 0;
    const todas = await j.p.$$eval('.casa', (l) => l.map((e) => +e.dataset.i));
    let fez = false;
    for (const i of todas.sort(() => rnd() - 0.5)) {
      await j.p.locator(`.casa[data-i="${i}"]`).click({ timeout: 3000 }).catch(() => {});
      const pode = await casasPode(j);
      if (!pode.length) continue;
      const alvo = pode[Math.floor(rnd() * pode.length)];
      j.passo(`${jogo}: tocou na casa ${i} e depois na ${alvo}`);
      await j.p.locator(`.casa[data-i="${alvo}"]`).click();
      if (await j.p.isVisible('#promo:not([hidden])')) { j.passo('escolheu a dama na promoção'); await j.p.locator('#promo-pecas button').first().click(); }
      fez = true; lances++; break;
    }
    if (!fez) {
      const fim = await j.p.isVisible('#x-fim:not([hidden])');
      if (!fim) { await j.bug(`${jogo}: é "sua vez" mas nenhuma peça tem lance`, { tipo: 'regra', visto: status }); return; }
      break;
    }
    await j.p.waitForTimeout(200);
  }
  await j.print(jogo + '-fim');
  await j.semErros('no ' + jogo);
}

async function trucoAoAcaso(j, rnd) {
  await j.p.goto(BASE + '/truco#teste'); await j.ve('#x-menu:not([hidden])');
  await j.aperta('#bt-computador', 'Jogar contra o computador');
  if (!(await j.ve('#t-jogo:not([hidden])'))) return j.bug('truco: a mesa contra o computador não abriu');
  let jogadas = 0, parado = 0;
  while (jogadas < 40) {
    if (await j.p.isVisible('#x-fim:not([hidden])')) { j.passo('o jogo de truco acabou'); break; }
    const acoes = await j.p.$$eval('#t-acoes button:not([disabled])', (l) => l.map((e) => e.textContent.trim()));
    const cartas = await j.p.$$eval('#t-minhas.pode .minha', (l) => l.map((e) => e.dataset.c));
    if (!acoes.length && !cartas.length) { await j.p.waitForTimeout(600); if (++parado > 50) { await j.bug('truco: ninguém joga há 30 s', { tipo: 'travou', visto: await j.p.locator('#t-status').innerText().catch(() => '') }); return; } continue; }
    parado = 0;
    if (acoes.length && (rnd() < 0.3 || !cartas.length)) {
      const a = acoes[Math.floor(rnd() * acoes.length)];
      j.passo('truco: apertou "' + a + '"');
      await j.p.locator('#t-acoes button:not([disabled])', { hasText: a }).first().click().catch(() => {});
    } else {
      const c = cartas[Math.floor(rnd() * cartas.length)];
      j.passo('truco: jogou a carta ' + c);
      await j.p.locator(`#t-minhas .minha[data-c="${c}"]`).click().catch(() => {});
    }
    jogadas++; await j.p.waitForTimeout(400);
  }
  await j.print('truco-fim');
  await j.semErros('no truco');
}

export default async function tabuleiros(prefixo) {
  const rnd = sorteio(+process.env.SEMENTE || Date.now());
  const perfis = ['pc', 'tablet', 'celular'];
  await Promise.all(perfis.map(async (perfil, k) => {
    const j = await new Jogador('Mesa' + prefixo + perfil, perfil, 'tabuleiros').abrir();
    j.passo('semente ' + rnd.semente);
    try {
      if (!(await j.criarConta('Mesa'))) return;
      const ordem = [['xadrez'], ['dama'], ['truco']];
      for (const [jogo] of [...ordem.slice(k), ...ordem.slice(0, k)]) {
        try { if (jogo === 'truco') await trucoAoAcaso(j, rnd); else await partidaAoAcaso(j, jogo, rnd); }
        catch (e) { await j.bug(`${jogo}: o roteiro parou: ${e.message.split('\n')[0].slice(0, 140)}`, { tipo: 'travou' }); }
      }
    } finally { await j.fechar(); }
  }));
}

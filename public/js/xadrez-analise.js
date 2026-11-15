// Xadrez: perfil (pontos e últimas partidas) e análise da partida depois do fim (o computador diz o melhor lance,
// classifica cada lance e dá a precisão de cada jogador). A análise roda aos pouquinhos (um lance por vez) para
// não travar o tablet fraco; dá para andar pelos lances enquanto ela termina.
import * as X from './xadrez-regras.js';
import * as P from './pontos-regras.js';
import { conta } from './rede.js';

const $ = (s) => document.querySelector(s);
const CHAVE_LOCAL = 'pradaria.xadrez.partidas';

// ---------- partidas contra o computador (guardadas no aparelho) ----------
export function guardarLocal(item) {
  try {
    const l = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '[]');
    l.unshift(item);
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(l.slice(0, 20)));
  } catch {}
}
function lerLocal() { try { const l = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } }

const RES = { v: 'Vitória', d: 'Derrota', e: 'Empate' };
const data = (t) => { const d = new Date(t); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function criarAnalise({ svgPeca, aoVoltar }) {
  // ---------- tabuleiro da análise ----------
  const tab = $('#a-tabuleiro');
  const casas = [];
  for (let k = 0; k < 64; k++) { const b = document.createElement('div'); b.className = 'casa'; casas.push(b); tab.appendChild(b); }
  let A = null; // { pos, lances, hist, res: [], k (quantos lances mostrados), cor (de quem é a partida), girado, nomes, timer }

  function desenhar() {
    const e = A.pos[A.k];
    const virar = (A.cor === 'b') !== A.girado;
    const r = A.k > 0 ? A.res[A.k - 1] : null;
    const ult = A.k > 0 ? A.lances[A.k - 1] : null;
    const ruim = r && ['impreciso', 'erro', 'grave'].includes(r.classe);
    for (let j = 0; j < 64; j++) {
      const i = virar ? 63 - j : j, c = casas[j], l = i >> 3, co = i & 7;
      c.className = 'casa' + ((l + co) % 2 ? ' escura' : '') + (ult && (ult.de === i || ult.para === i) ? ' ultimo' : '') + (ruim && (r.melhor.de === i || r.melhor.para === i) ? ' melhor' : '');
      let h = e.b[i] ? svgPeca(e.b[i]) : '';
      if (j % 8 === 0) h += `<span class="coord l">${8 - l}</span>`;
      if (j >= 56) h += `<span class="coord c">${'abcdefgh'[co]}</span>`;
      c.innerHTML = h;
    }
    // nomes em cima e embaixo
    const baixo = virar ? 'b' : 'w', cima = baixo === 'w' ? 'b' : 'w';
    $('#a-cima').textContent = A.nomes[cima] + (cima === 'w' ? ' (brancas)' : ' (pretas)');
    $('#a-baixo').textContent = A.nomes[baixo] + (baixo === 'w' ? ' (brancas)' : ' (pretas)');
    // barra da nota (+ = brancas melhor)
    const nota = r ? r.nota : 0;
    const txt = Math.abs(nota) >= 19 ? (nota > 0 ? 'Brancas dão mate' : 'Pretas dão mate') : (nota > 0 ? '+' : '') + nota.toFixed(1);
    const pct = 50 + Math.max(-45, Math.min(45, nota * 8));
    $('#a-nota-brancas').style.width = (baixo === 'w' ? pct : 100 - pct) + '%';
    $('#a-nota-brancas').classList.toggle('pretas', baixo === 'b');
    $('#a-nota-txt').textContent = A.k === 0 ? 'Começo da partida' : r ? txt : 'Analisando…';
    // o que foi o lance
    const info = $('#a-info');
    if (A.k === 0) info.innerHTML = 'Toque em <b>Próximo</b> para ver lance por lance.';
    else if (!r) info.innerHTML = `<b>${A.hist[A.k - 1]}</b>: analisando…`;
    else {
      const quem = (A.k - 1) % 2 === 0 ? 'w' : 'b';
      const deQuem = quem === A.cor ? 'Você jogou' : (A.nomes[quem] + ' jogou');
      info.innerHTML = `<span class="classe c-${r.classe}">${X.CLASSES[r.classe]}</span> ${esc(deQuem)} <b>${A.hist[A.k - 1]}</b>` + (ruim ? `. O melhor era <b>${r.melhor.t}</b>.` : '.');
    }
    $('#a-status').textContent = A.k === 0 ? 'Análise' : `Lance ${Math.ceil(A.k / 2)}${A.k % 2 ? '' : '…'} de ${Math.ceil(A.hist.length / 2)}`;
    $('#a-ant').disabled = $('#a-inicio').disabled = A.k === 0;
    $('#a-prox').disabled = $('#a-fim').disabled = A.k === A.lances.length;
    // lista com a cor de cada lance
    for (const el of document.querySelectorAll('#a-lances .lance')) el.classList.toggle('ult', +el.dataset.k === A.k);
    const at = document.querySelector('#a-lances .lance.ult');
    if (at) at.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function lista() {
    $('#a-lances').innerHTML = A.hist.slice(0, A.lances.length).map((t, k) => (k % 2 === 0 ? `<span class="num">${k / 2 + 1}.</span>` : '') + `<button type="button" class="lance${A.res[k] ? ' c-' + A.res[k].classe : ''}" data-k="${k + 1}">${t}</button>`).join('');
  }
  function resumo() {
    const el = $('#a-precisao');
    if (A.res.length < A.lances.length) { el.textContent = `Analisando ${A.res.length} de ${A.lances.length} lances…`; return; }
    const de = (c) => A.res.filter((r, k) => (k % 2 === 0 ? 'w' : 'b') === c);
    const quantos = (c, cl) => de(c).filter((r) => r.classe === cl).length;
    const linha = (c) => {
      const pr = X.precisao(de(c).map((r) => r.perda));
      return `<div class="a-jog"><b>${esc(c === A.cor ? 'Você' : A.nomes[c])}</b> <span class="pct">${pr == null ? '-' : pr + '%'}</span>`
        + `<small>${quantos(c, 'grave')} erro(s) grave(s) · ${quantos(c, 'erro')} erro(s) · ${quantos(c, 'impreciso')} imprecisão(ões)</small></div>`;
    };
    el.innerHTML = `<div class="a-tit">Precisão</div>${linha(A.cor)}${linha(A.cor === 'w' ? 'b' : 'w')}`;
  }
  // analisa um lance por vez, sem travar a tela
  function passo() {
    if (!A || A.res.length >= A.lances.length) return;
    const k = A.res.length;
    A.res.push(X.analisarLance(A.pos[k], A.lances[k]));
    const b = document.querySelector(`#a-lances .lance[data-k="${k + 1}"]`);
    if (b) b.classList.add('c-' + A.res[k].classe);
    if (A.k === k + 1) desenhar();
    resumo();
    A.timer = setTimeout(passo, 0);
  }
  function ir(k) { if (!A) return; A.k = Math.max(0, Math.min(A.lances.length, k)); desenhar(); }
  $('#a-inicio').addEventListener('click', () => ir(0));
  $('#a-ant').addEventListener('click', () => ir(A.k - 1));
  $('#a-prox').addEventListener('click', () => ir(A.k + 1));
  $('#a-fim').addEventListener('click', () => ir(A.lances.length));
  $('#a-lances').addEventListener('click', (ev) => { const b = ev.target.closest('.lance'); if (b) ir(+b.dataset.k); });
  $('#a-girar').addEventListener('click', () => { if (A) { A.girado = !A.girado; desenhar(); } });
  $('#a-voltar').addEventListener('click', () => fechar());
  addEventListener('keydown', (ev) => {
    if (!A || $('#x-analise').hidden) return;
    if (ev.key === 'ArrowLeft') ir(A.k - 1); else if (ev.key === 'ArrowRight') ir(A.k + 1);
  });

  let voltar = aoVoltar;
  function fechar() {
    if (A) clearTimeout(A.timer);
    A = null;
    $('#x-analise').hidden = true;
    voltar();
  }
  // partida = { hist, cor ('w'|'b'), nomes: { w, b } }
  // depois = o que fazer ao sair da análise (padrão: voltar ao menu)
  function abrir(partida, depois = aoVoltar) {
    voltar = depois;
    if (A) clearTimeout(A.timer);
    const r = X.refazer(partida.hist);
    A = { ...r, hist: partida.hist, res: [], k: r.lances.length, cor: partida.cor || 'w', girado: false, nomes: partida.nomes, timer: 0 };
    for (const id of ['#x-menu', '#x-jogo', '#x-fim', '#x-perfil']) { const el = $(id); if (el) el.hidden = true; }
    $('#x-analise').hidden = false;
    lista(); resumo(); desenhar();
    A.timer = setTimeout(passo, 30);
  }
  return { abrir, fechar, get estado() { return A; } };
}

// ---------- perfil: pontos e últimas partidas ----------
export function criarPerfil({ analise, aoVoltar }) {
  let partidas = [];
  async function abrir() {
    $('#x-menu').hidden = true;
    $('#x-perfil').hidden = false;
    $('#perfil-pontos').innerHTML = conta.token ? '<p class="sub centro">Carregando…</p>' : '<p class="sub centro">Entre na sua conta para ter pontos e guardar as partidas online.</p>';
    let online = [];
    if (conta.token) {
      try {
        const r = await fetch('/api/xadrez/pontos?partidas=1', { headers: { authorization: 'Bearer ' + conta.token } });
        if (r.ok) {
          const d = await r.json();
          online = d.partidas || [];
          $('#perfil-pontos').innerHTML = Object.keys(P.NOME_CATEGORIA).map((c) => {
            const x = d.pontos[c];
            return `<div class="pp"><span class="pp-cat">${P.NOME_CATEGORIA[c]}</span><span class="pp-n">${x.mostrar}</span><small>${x.v}V ${x.d}D ${x.e}E</small></div>`;
          }).join('');
        } else $('#perfil-pontos').innerHTML = '<p class="sub centro">Não deu para ler os pontos agora.</p>';
      } catch { $('#perfil-pontos').innerHTML = '<p class="sub centro">Sem internet: mostrando só as partidas deste aparelho.</p>'; }
    }
    partidas = [...online, ...lerLocal()].sort((a, b) => b.quando - a.quando).slice(0, 40);
    const el = $('#perfil-lista');
    if (!partidas.length) { el.innerHTML = '<p class="sub centro">Nenhuma partida ainda. Quando uma partida terminar, ela aparece aqui para você analisar.</p>'; return; }
    el.innerHTML = partidas.map((p, k) => {
      const tipo = p.local ? 'Contra o computador' : p.ranqueada ? `${P.NOME_CATEGORIA[p.cat]} · valendo pontos` : (p.cat ? P.NOME_CATEGORIA[p.cat] + ' · amistosa' : 'Sem relógio · amistosa');
      const pts = p.pontos ? ` <b class="${p.pontos.depois >= p.pontos.antes ? 'sobe' : 'desce'}">${p.pontos.depois >= p.pontos.antes ? '+' : ''}${p.pontos.depois - p.pontos.antes}</b>` : '';
      return `<button type="button" class="partida-item" data-k="${k}"><span class="res r-${p.res}">${RES[p.res] || '-'}</span>`
        + `<span class="pi-meio"><span class="pi-contra">contra ${esc(p.contra)}</span><small>${tipo}${pts} · ${Math.ceil((p.hist || []).length / 2)} lances · ${data(p.quando)}</small></span>`
        + '<span class="pi-ver">Analisar</span></button>';
    }).join('');
  }
  $('#perfil-lista').addEventListener('click', (ev) => {
    const b = ev.target.closest('.partida-item');
    if (!b) return;
    const p = partidas[+b.dataset.k];
    const outro = p.cor === 'w' ? 'b' : 'w';
    analise.abrir({ hist: p.hist || [], cor: p.cor, nomes: { [p.cor]: 'Você', [outro]: p.contra } }, () => abrir());
  });
  $('#bt-perfil-fechar').addEventListener('click', () => { $('#x-perfil').hidden = true; aoVoltar(); });
  return { abrir };
}

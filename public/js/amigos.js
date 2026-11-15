// Janela de amigos da plataforma: adicionar pelo nome, aceitar pedidos, ver quem está online e chamar para jogar.
// Os dados vêm da API (/api/amigos) e a presença e os convites do saguão (lobby.js).
import { api } from './rede.js';
import { icone } from './icones.js';
import { jogo as dadosJogo } from './jogos.js';

const $ = (s) => document.querySelector(s);
const ONDE = { hub: 'Escolhendo um jogo', pradaria: 'Jogando Pradaria', xadrez: 'Jogando Xadrez', dama: 'Jogando Dama', truco: 'Jogando Truco', arena: 'Jogando Arena', ilha: 'Jogando Última Ilha' };
const nomeJogo = (id) => (dadosJogo(id) || { nome: id }).nome;

// opc: { lobby, som(), somConvite(), somAviso(), aviso(txt, ms, icone), aceitarConvite(msg), contador(n) }
export function criarAmigos(opc) {
  const { lobby } = opc;
  let dados = { amigos: [], recebidos: [], enviados: [] };
  let contexto = null; // { jogo, sala, titulo }: aparece "Chamar" ao lado de quem está online
  let confirmar = null; // id do amigo com "Desfazer amizade?" aberto
  const chamados = new Map(); // id -> hora do último convite (não repetir em seguida)

  const el = document.createElement('div');
  el.id = 'amigos'; el.className = 'janela'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'amigos-titulo');
  el.innerHTML = `<div class="caixa">
    <h2 class="com-ic" id="amigos-titulo">${icone('amigos')} <span>Amigos</span></h2>
    <p class="sub centro" id="amigos-contexto" hidden></p>
    <form id="amigos-add" class="linha-add" autocomplete="off">
      <input id="amigos-nome" maxlength="16" placeholder="Nome do amigo" aria-label="Nome de jogador do amigo" enterkeyhint="send">
      <button class="bt verde" type="submit">${icone('mais')}Adicionar</button>
    </form>
    <p id="amigos-msg" class="sub" aria-live="polite"></p>
    <div id="amigos-recebidos"></div>
    <div id="amigos-lista"></div>
    <div id="amigos-enviados"></div>
    <p class="sub dica-amigos">Só adicione quem você conhece de verdade. Seu amigo precisa aceitar.</p>
    <button class="bt" type="button" id="amigos-fechar">Fechar</button>
  </div>`;
  document.body.appendChild(el);

  const msg = (t, erro = false) => { const m = $('#amigos-msg'); m.textContent = t; m.classList.toggle('erro', erro); };

  function linha(p, conteudo) {
    const d = document.createElement('div');
    d.className = 'amigo';
    d.dataset.id = p.id;
    d.innerHTML = `<span class="bolinha"></span><span class="txt"><b></b><small></small></span><span class="acoes"></span>`;
    d.querySelector('b').textContent = p.nome;
    conteudo(d, d.querySelector('small'), d.querySelector('.acoes'));
    return d;
  }
  function botao(txt, classe, fn, ic) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'bt ' + classe; b.innerHTML = (ic ? icone(ic) : '') + '<span></span>';
    b.querySelector('span').textContent = txt;
    b.addEventListener('click', () => { opc.som && opc.som(); fn(b); });
    return b;
  }
  async function acao(caminho, corpo, ok) {
    try { await api(caminho, corpo); if (ok) msg(ok); await carregar(); } catch (e) { msg(e.message, true); }
  }

  function desenhar() {
    const rec = $('#amigos-recebidos'); rec.innerHTML = '';
    if (dados.recebidos.length) {
      rec.insertAdjacentHTML('beforeend', '<h3>Querem ser seus amigos</h3>');
      for (const p of dados.recebidos) rec.appendChild(linha(p, (d, s, a) => {
        d.classList.add('pedido'); s.textContent = 'Pediu para ser seu amigo';
        a.append(botao('Aceitar', 'verde', () => acao('amigos/responder', { id: p.id, aceitar: true }, `Agora você e ${p.nome} são amigos!`)),
          botao('Recusar', '', () => acao('amigos/responder', { id: p.id, aceitar: false })));
      }));
    }
    const l = $('#amigos-lista'); l.innerHTML = '<h3>Meus amigos</h3>';
    if (!dados.amigos.length) l.insertAdjacentHTML('beforeend', `<div class="vazio">${icone('amigos')}<span>Ainda não tem amigos aqui. Escreva o nome de jogador de um amigo e toque em Adicionar.</span></div>`);
    // online primeiro
    const ord = [...dados.amigos].sort((a, b) => (lobby.online.has(b.id) - lobby.online.has(a.id)) || a.nome.localeCompare(b.nome));
    for (const p of ord) l.appendChild(linha(p, (d, s, a) => {
      const onde = lobby.online.get(p.id);
      d.classList.toggle('online', !!onde);
      s.textContent = onde ? ONDE[onde] || 'Online' : 'Fora do jogo';
      if (confirmar === p.id) {
        s.textContent = 'Desfazer a amizade?';
        a.append(botao('Desfazer', 'perigo', () => { confirmar = null; acao('amigos/remover', { id: p.id }, `Você e ${p.nome} não são mais amigos.`); }),
          botao('Não', '', () => { confirmar = null; desenhar(); }));
        return;
      }
      if (contexto && onde) {
        const b = botao(chamados.has(p.id) ? 'Chamado' : 'Chamar', 'verde chamar', (bt) => {
          if (!lobby.convidar(p.id, contexto.jogo, contexto.sala, contexto.titulo)) { msg('Sem conexão agora. Tente de novo.', true); return; }
          chamados.set(p.id, Date.now()); bt.disabled = true; bt.querySelector('span').textContent = 'Chamado';
          msg(`Chamei ${p.nome}. Espere a resposta.`);
        }, 'acenar');
        if (chamados.has(p.id) && Date.now() - chamados.get(p.id) < 15000) b.disabled = true;
        a.append(b);
      }
      const x = botao('', 'fraco remover', () => { confirmar = p.id; desenhar(); }, 'fechar');
      x.setAttribute('aria-label', 'Desfazer amizade com ' + p.nome);
      a.append(x);
    }));
    const env = $('#amigos-enviados'); env.innerHTML = '';
    if (dados.enviados.length) {
      env.insertAdjacentHTML('beforeend', '<h3>Esperando aceitar</h3>');
      for (const p of dados.enviados) env.appendChild(linha(p, (d, s, a) => {
        d.classList.add('pedido'); s.textContent = 'Você pediu, falta aceitar';
        a.append(botao('Cancelar', 'fraco', () => acao('amigos/remover', { id: p.id })));
      }));
    }
    atualizarContador();
  }

  function atualizarContador() {
    const on = dados.amigos.filter((p) => lobby.online.has(p.id)).length;
    opc.contador && opc.contador({ online: on, pedidos: dados.recebidos.length });
  }

  async function carregar() {
    try { dados = await api('amigos'); } catch (e) { msg(e.message, true); }
    if (!el.hidden) desenhar(); else atualizarContador();
  }

  $('#amigos-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    opc.som && opc.som();
    const nome = $('#amigos-nome').value.trim();
    if (!nome) { msg('Escreva o nome de jogador do seu amigo.', true); return; }
    try {
      const r = await api('amigos/pedir', { nome });
      $('#amigos-nome').value = '';
      msg(r.amigos ? `Agora você e ${r.nome} são amigos!` : `Pedido enviado para ${r.nome}. Falta ${r.nome} aceitar.`);
      await carregar();
    } catch (err) { msg(err.message, true); }
  });
  $('#amigos-fechar').addEventListener('click', () => { opc.som && opc.som(); fechar(); });
  el.addEventListener('click', (e) => { if (e.target === el) fechar(); });

  let aoFechar = null;
  function fechar() { el.hidden = true; contexto = null; confirmar = null; const f = aoFechar; aoFechar = null; if (f) f(); }

  // ---------- convites que chegam ----------
  const card = document.createElement('div');
  card.id = 'convite'; card.hidden = true; card.setAttribute('role', 'alertdialog'); card.setAttribute('aria-live', 'assertive');
  card.innerHTML = `<span class="ic-convite"></span><span id="convite-txt"></span><div class="linha-bts"><button class="bt verde" id="convite-sim" type="button">Ir jogar</button><button class="bt" id="convite-nao" type="button">Agora não</button></div>`;
  document.body.appendChild(card);
  let atual = null, timer = null;
  function mostrarConvite(m) {
    atual = m;
    card.querySelector('.ic-convite').innerHTML = icone((dadosJogo(m.jogo) || {}).icone || 'amigos');
    $('#convite-txt').textContent = `${m.nome} chamou você para jogar ${nomeJogo(m.jogo)}` + (m.titulo ? ` (${m.titulo})` : '') + '!';
    card.hidden = false;
    opc.somConvite && opc.somConvite(); // "dim-dom"
    clearTimeout(timer);
    timer = setTimeout(() => responder(false, true), 30000);
  }
  function responder(sim, sozinho = false) {
    clearTimeout(timer);
    card.hidden = true;
    const m = atual; atual = null;
    if (!m) return;
    if (!sozinho || sim) lobby.responder(m.de, m.jogo, sim);
    if (sim) opc.aceitarConvite(m);
  }
  $('#convite-sim').addEventListener('click', () => { opc.som && opc.som(); responder(true); });
  $('#convite-nao').addEventListener('click', () => { opc.som && opc.som(); responder(false); });

  Object.assign(lobby.h, {
    convite: (m) => mostrarConvite(m),
    'convite-resp': (m) => opc.aviso(m.aceitou ? `${m.nome} está vindo!` : `${m.nome} não pode agora.`, 2600, m.aceitou ? 'acenar' : 'relogio'),
    'convite-falhou': () => opc.aviso('Seu amigo saiu do jogo.', 2200, 'relogio'),
    'amigos-mudou': (m) => { carregar(); if (m.pedido) { opc.aviso('Você recebeu um pedido de amizade!', 2600, 'amigos'); opc.somAviso && opc.somAviso(); } },
    mudou: () => { if (!el.hidden) desenhar(); else atualizarContador(); },
  });

  return {
    // ctx opcional { jogo, sala, titulo } liga o "Chamar"; depois(): ao fechar
    async abrir(ctx = null, depois = null) {
      contexto = ctx; aoFechar = depois; confirmar = null;
      const c = $('#amigos-contexto');
      c.hidden = !ctx; c.textContent = ctx ? `Chame um amigo online para ${ctx.titulo ? '"' + ctx.titulo + '"' : nomeJogo(ctx.jogo)}` : '';
      msg('');
      el.hidden = false;
      desenhar();
      await carregar();
    },
    fechar,
    carregar,
    get aberto() { return !el.hidden; },
  };
}

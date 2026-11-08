// Editar um mundo já criado (só o dono): nome e opções.
// A lista de opções vem de OPCOES_MUNDO (opcoes-mundo.js): uma opção nova aparece aqui sozinha.
// Tipo, tamanho e gerador fazem o terreno, então aparecem travados (FIXAS_AO_CRIAR).
import { OPCOES_MUNDO, TAMANHOS, TIPOS, normalizarOpcoes, editarOpcoes, opcoesMudadas } from './opcoes-mundo.js';
import { icone } from './icones.js';
import { api } from './rede.js';

const $ = (s) => document.querySelector(s);

// botões liga/desliga das opções (mesmos da criação do mundo); `escolha` é alterado na hora
export function desenharListaOpcoes(l, escolha, aoMudar) {
  l.innerHTML = '';
  for (const o of OPCOES_MUNDO) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opcao-mundo'; b.dataset.opcao = o.id;
    b.innerHTML = '<span class="ic"></span><span><b></b><small></small></span>';
    b.querySelector('.ic').innerHTML = icone(o.icone);
    b.querySelector('b').textContent = o.nome;
    b.querySelector('small').textContent = o.desc;
    b.addEventListener('click', () => {
      escolha[o.id] = !escolha[o.id];
      // "Monstros machucam" só faz sentido com monstrinhos: um liga/desliga o outro
      if (o.id === 'monstrosMachucam' && escolha.monstrosMachucam) escolha.monstros = true;
      if (o.id === 'monstros' && !escolha.monstros) escolha.monstrosMachucam = false;
      marcarLista(l, escolha);
      aoMudar && aoMudar(o.id);
    });
    l.appendChild(b);
  }
  marcarLista(l, escolha);
}
export function marcarLista(l, escolha) {
  // alguns tipos não têm monstrinhos (ex.: Linha do Tempo)
  const sem = !!(TIPOS[escolha.tipo] && TIPOS[escolha.tipo].semMonstros);
  for (const b of l.children) {
    const id = b.dataset.opcao;
    if (sem && (id === 'monstros' || id === 'monstrosMachucam')) escolha[id] = false;
    b.disabled = sem && (id === 'monstros' || id === 'monstrosMachucam');
    b.setAttribute('aria-pressed', String(!!escolha[id]));
  }
}

// abre a janela. mundo = { codigo, nome, opcoes } (online) ou null (mundo sem internet, só opções)
// salvarLocal(opcoes) é chamado no mundo sem internet; aoSalvar(mundo, mudou) depois que deu certo
export function abrirEditarMundo({ mundo = null, opcoes, salvarLocal = null, aoSalvar = null, som = null }) {
  const jan = $('#editar-mundo');
  const antes = normalizarOpcoes(opcoes);
  const escolha = { ...antes };
  const online = !!mundo;
  $('#e-rotulo').hidden = !online;
  $('#e-nome').value = online ? mundo.nome : '';
  $('#e-erro').textContent = '';
  // o que não muda: tipo, tamanho e terreno
  const t = TIPOS[antes.tipo];
  const fixo = [t.nome, t.limite ? null : 'tamanho ' + TAMANHOS[antes.tamanho].nome.toLowerCase(),
    antes.tipo === 'normal' ? 'terreno ' + (antes.gerador === 'classico' ? 'clássico' : 'de antes') : null].filter(Boolean).join(', ');
  $('#e-fixas').innerHTML = icone('cadeado', 'ic-svg ic-mini') + '<span></span>';
  $('#e-fixas span').textContent = `Não dá para mudar depois de criado: ${fixo}. Para isso, crie um mundo novo.`;
  const lista = $('#e-lista');
  const atualizarAvisos = () => {
    const mudou = opcoesMudadas(antes, escolha);
    const terreno = OPCOES_MUNDO.filter((o) => o.terreno && mudou.includes(o.id)).map((o) => o.nome);
    const av = $('#e-aviso');
    const partes = [];
    if (terreno.length) partes.push(`${terreno.join(', ')}: muda o terreno nos lugares onde ninguém mexeu ainda. O que já foi construído continua.`);
    if (mudou.length && online) partes.push('Quem estiver jogando neste mundo vai recarregar por um instante.');
    av.textContent = partes.join(' ');
    av.hidden = !partes.length;
    for (const b of lista.children) b.classList.toggle('mudou', mudou.includes(b.dataset.opcao));
  };
  desenharListaOpcoes(lista, escolha, () => { som && som(); atualizarAvisos(); });
  atualizarAvisos();
  const salvar = $('#e-salvar');
  salvar.disabled = false;
  $('#e-form').onsubmit = async (ev) => {
    ev.preventDefault();
    if (salvar.disabled) return;
    $('#e-erro').textContent = '';
    const novas = editarOpcoes(antes, escolha);
    if (!online) {
      const mudou = opcoesMudadas(antes, novas);
      fechar();
      if (mudou.length && salvarLocal) salvarLocal(novas);
      return;
    }
    salvar.disabled = true;
    try {
      const r = await api('mundos/editar', { codigo: mundo.codigo, nome: $('#e-nome').value, opcoes: novas });
      fechar();
      aoSalvar && aoSalvar(r.mundo, r.mudou || []);
    } catch (e) { $('#e-erro').textContent = e.message; }
    salvar.disabled = false;
  };
  $('#e-cancelar').onclick = fechar;
  jan.hidden = false;
  if (online) setTimeout(() => $('#e-nome').focus(), 50);
  function fechar() { jan.hidden = true; }
}
export const editandoMundo = () => !$('#editar-mundo').hidden;

// Editar um mundo já criado (só o dono): nome e opções.
// A lista de opções vem de OPCOES_MUNDO (opcoes-mundo.js): uma opção nova aparece aqui sozinha.
// Tipo, tamanho e gerador fazem o terreno, então aparecem travados (FIXAS_AO_CRIAR).
import { OPCOES_MUNDO, TAMANHOS, TIPOS, ESTILOS, normalizarOpcoes, editarOpcoes, opcoesMudadas, precisaRecarregar } from './opcoes-mundo.js';
import { icone } from './icones.js';
import { api } from './rede.js';
import { montarArquivo, lerArquivo, nomeArquivo } from './arquivo-mundo.js';

const $ = (s) => document.querySelector(s);

// escolha do jeito do mundo (Blocos / Natural 3D): botões de rádio, na criação e na edição
export function desenharEstilos(l, escolha, aoMudar) {
  l.innerHTML = '';
  for (const [id, t] of Object.entries(ESTILOS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'opcao-mundo'; b.dataset.estilo = id; b.setAttribute('role', 'radio');
    b.innerHTML = '<span class="ic"></span><b></b><small></small>';
    b.querySelector('.ic').innerHTML = icone(t.icone); b.querySelector('b').textContent = t.nome; b.querySelector('small').textContent = t.desc;
    b.addEventListener('click', () => { escolha.estilo = id; marcarEstilos(l, escolha); aoMudar && aoMudar('estilo'); });
    l.appendChild(b);
  }
  marcarEstilos(l, escolha);
}
export function marcarEstilos(l, escolha) {
  for (const b of l.children) { const sel = b.dataset.estilo === escolha.estilo; b.setAttribute('aria-pressed', String(sel)); b.setAttribute('aria-checked', String(sel)); }
}

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
      // "Animais podem machucar" só faz sentido com bichos selvagens: um liga/desliga o outro
      if (o.id === 'selvagensMachucam' && escolha.selvagensMachucam) escolha.selvagens = true;
      if (o.id === 'selvagens' && !escolha.selvagens) escolha.selvagensMachucam = false;
      marcarLista(l, escolha);
      aoMudar && aoMudar(o.id);
    });
    l.appendChild(b);
  }
  marcarLista(l, escolha);
}
export function marcarLista(l, escolha) {
  // alguns tipos têm os próprios bichos (ex.: Linha do Tempo)
  const sem = !!(TIPOS[escolha.tipo] && TIPOS[escolha.tipo].semSelvagens);
  for (const b of l.children) {
    const id = b.dataset.opcao;
    if (sem && (id === 'selvagens' || id === 'selvagensMachucam')) escolha[id] = false;
    b.disabled = sem && (id === 'selvagens' || id === 'selvagensMachucam');
    b.setAttribute('aria-pressed', String(!!escolha[id]));
  }
}

// ---------- arquivo do mundo ----------
export function baixarArquivo(arquivo) {
  const blob = new Blob([JSON.stringify(arquivo)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nomeArquivo(arquivo.nome);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
// abre a escolha de arquivo; devolve o mundo lido ({ nome, semente, opcoes, edicoes }), { erro } ou null (desistiu)
export function escolherArquivo() {
  return new Promise((res) => {
    const inp = $('#arquivo-mundo');
    inp.value = '';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0];
      if (!f) return res(null);
      if (f.size > 20e6) return res({ erro: 'Esse arquivo é grande demais.' });
      try { res(lerArquivo(await f.text())); } catch { res({ erro: 'Não consegui ler esse arquivo.' }); }
    };
    inp.click();
  });
}
export { montarArquivo };

// abre a janela. mundo = { codigo, nome, opcoes } (online) ou null (mundo sem internet, só opções)
// salvarLocal(opcoes) é chamado no mundo sem internet; aoSalvar(mundo, mudou) depois que deu certo
// local = { exportar(), importar(arquivoLido), apagar() } no mundo sem internet; aoApagar() depois de apagar online
export function abrirEditarMundo({ mundo = null, opcoes, salvarLocal = null, aoSalvar = null, som = null, local = null, aoApagar = null }) {
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
    if (precisaRecarregar(mudou) && online) partes.push('Quem estiver jogando neste mundo vai recarregar por um instante.');
    av.textContent = partes.join(' ');
    av.hidden = !partes.length;
    for (const b of lista.children) b.classList.toggle('mudou', mudou.includes(b.dataset.opcao));
    for (const b of $('#e-estilos').children) b.classList.toggle('mudou', mudou.includes('estilo') && b.dataset.estilo === escolha.estilo);
  };
  desenharEstilos($('#e-estilos'), escolha, () => { som && som(); atualizarAvisos(); });
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
  // arquivo e apagar
  $('#e-mais').open = false;
  $('#e-importar').hidden = online;
  $('#e-exportar').onclick = async () => {
    $('#e-erro').textContent = '';
    if (!online) { local && local.exportar(); return; }
    const bt = $('#e-exportar'); bt.disabled = true;
    try { baixarArquivo(await api('mundos/exportar', { codigo: mundo.codigo })); }
    catch (e) { $('#e-erro').textContent = e.message; }
    bt.disabled = false;
  };
  $('#e-importar').onclick = async () => {
    const a = await escolherArquivo();
    if (!a) return;
    if (a.erro) { $('#e-erro').textContent = a.erro; return; }
    if (!confirm('Trocar o mundo deste aparelho pelo mundo do arquivo? O mundo de agora some (exporte antes se quiser guardar).')) return;
    fechar(); local && local.importar(a);
  };
  $('#e-apagar').onclick = async () => {
    const nome = online ? `"${mundo.nome}"` : 'o mundo sem internet deste aparelho';
    if (!confirm(`Apagar ${nome} para sempre? Tudo o que foi construído some e não dá para desfazer. Se quiser guardar, toque em Exportar antes.`)) return;
    if (!online) { fechar(); local && local.apagar(); return; }
    const bt = $('#e-apagar'); bt.disabled = true;
    try { await api('mundos/apagar', { codigo: mundo.codigo }); fechar(); aoApagar && aoApagar(); }
    catch (e) { $('#e-erro').textContent = e.message; }
    bt.disabled = false;
  };
  jan.hidden = false;
  if (online) setTimeout(() => $('#e-nome').focus(), 50);
  function fechar() { jan.hidden = true; }
}
export const editandoMundo = () => !$('#editar-mundo').hidden;

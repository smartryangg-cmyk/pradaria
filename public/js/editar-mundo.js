// Editar um mundo já criado (só o dono): nome e opções.
// A lista de opções vem de OPCOES_MUNDO (opcoes-mundo.js): uma opção nova aparece aqui sozinha.
// Tipo, tamanho e gerador fazem o terreno, então aparecem travados (FIXAS_AO_CRIAR).
import { OPCOES_MUNDO, TAMANHOS, TIPOS, ESTILOS, CATS_MODS, DIFICULDADES, MODOS_JOGO, modoJogoDe, normalizarOpcoes, editarOpcoes, opcoesMudadas, precisaRecarregar } from './opcoes-mundo.js';
import { icone } from './icones.js';
import { confirmarIdade16 } from './idade.js';
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

// ---------- abas Regras e Mods (as mesmas na criação e na edição do mundo) ----------
// regras / mods: as caixas onde desenhar; escolha é alterado na hora; criando = false trava o mapa especial
// (o tipo faz o terreno). aoMudar(id) depois de cada toque. Os botões têm data-modo, data-dificuldade,
// data-opcao, data-tipo e data-estilo (os testes e a edição usam).
function botaoOpcao(ic, nome, desc, attrs, papel) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'opcao-mundo';
  for (const [k, v] of Object.entries(attrs)) b.dataset[k] = v;
  if (papel) b.setAttribute('role', papel);
  b.innerHTML = '<span class="ic"></span><span class="tx"><b></b><small></small></span>';
  b.querySelector('.ic').innerHTML = icone(ic);
  b.querySelector('b').textContent = nome; b.querySelector('small').textContent = desc;
  return b;
}
function titulo(t, nota) {
  const f = document.createDocumentFragment();
  const h = document.createElement('p'); h.className = 'sub titulo-grupo'; h.textContent = t; f.appendChild(h);
  if (nota) { const n = document.createElement('p'); n.className = 'nota-grupo'; n.textContent = nota; f.appendChild(n); }
  return f;
}
const tipoMod = (id) => id !== 'normal' && !TIPOS[id].oculto;
export function desenharRegrasMods(regras, mods, escolha, { criando = true, aoMudar = null } = {}) {
  const tudo = [regras, mods];
  const marcar = () => marcarRegrasMods(tudo, escolha, criando);
  const tocou = (id) => { marcar(); aoMudar && aoMudar(id); };
  regras.innerHTML = ''; mods.innerHTML = '';
  // modo de jogo
  regras.appendChild(titulo('Modo de jogo'));
  let g = document.createElement('div'); g.className = 'tamanhos-mundo'; g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', 'Modo de jogo');
  for (const [id, m] of Object.entries(MODOS_JOGO)) {
    const b = botaoOpcao(m.icone, m.nome, m.desc, { modo: id }, 'radio');
    b.addEventListener('click', () => { Object.assign(escolha, m.o); tocou(id === 'sobrevivencia' ? 'sobrevivencia' : 'construcao'); });
    g.appendChild(b);
  }
  regras.appendChild(g);
  // dificuldade
  regras.appendChild(titulo('Dificuldade'));
  g = document.createElement('div'); g.className = 'tamanhos-mundo quatro'; g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', 'Dificuldade');
  for (const [id, d] of Object.entries(DIFICULDADES)) {
    const b = botaoOpcao(d.icone, d.nome, d.desc, { dificuldade: id }, 'radio');
    b.addEventListener('click', () => { escolha.dificuldade = id; escolha.selvagensMachucam = id !== 'pacifico' && escolha.selvagens; tocou('dificuldade'); });
    g.appendChild(b);
  }
  regras.appendChild(g);
  // o resto das regras
  regras.appendChild(titulo('No mundo'));
  g = document.createElement('div'); g.className = 'opcoes-mundo';
  for (const o of OPCOES_MUNDO.filter((x) => x.aba === 'regras' && !x.oculta)) g.appendChild(toggle(o));
  regras.appendChild(g);
  // mods, por grupo
  for (const c of CATS_MODS) {
    const caixa = document.createElement('div'); caixa.className = 'opcoes-mundo mods';
    if (c.id === 'mapa') {
      for (const [id, t] of Object.entries(TIPOS)) {
        if (!tipoMod(id)) continue;
        const b = botaoOpcao(t.icone, t.nome, t.desc.replace(/\.? *16 anos ou mais\.?$/, ''), { tipo: id });
        if (t.mais16) b.querySelector('.tx').insertAdjacentHTML('beforeend', '<i class="etiqueta">Precisa: Armas · 16 anos</i>');
        b.addEventListener('click', async () => {
          if (!criando) return;
          const liga = escolha.tipo !== id;
          if (liga && t.mais16 && !(await confirmarIdade16(`O mapa ${t.nome}`))) return;
          escolha.tipo = liga ? id : 'normal';
          tocou('tipo');
        });
        caixa.appendChild(b);
      }
    }
    for (const o of OPCOES_MUNDO.filter((x) => x.aba === 'mods' && x.cat === c.id)) caixa.appendChild(toggle(o));
    if (c.id === 'construir') {
      const e = ESTILOS.suave;
      const b = botaoOpcao(e.icone, e.nome, e.desc + ' (só muda o desenho)', { estilo: 'suave' });
      b.addEventListener('click', () => { escolha.estilo = escolha.estilo === 'suave' ? 'blocos' : 'suave'; tocou('estilo'); });
      caixa.appendChild(b);
    }
    if (!caixa.childElementCount) continue;
    mods.appendChild(titulo(c.nome, c.nota));
    mods.appendChild(caixa);
  }
  marcar();

  function toggle(o) {
    const b = botaoOpcao(o.icone, o.nome, o.desc, { opcao: o.id });
    if (o.mais16) b.querySelector('.tx').insertAdjacentHTML('beforeend', '<i class="etiqueta">16 anos (da sua conta)</i>');
    b.addEventListener('click', async () => {
      // Armas: só para quem tem 16 anos ou mais (idade da conta; o servidor também confere)
      if (o.mais16 && !escolha[o.id] && !(await confirmarIdade16('O mod Armas'))) return;
      escolha[o.id] = !escolha[o.id];
      if (o.id === 'selvagens') escolha.selvagensMachucam = escolha.selvagens && escolha.dificuldade !== 'pacifico';
      tocou(o.id);
    });
    return b;
  }
}
// quantos mods estão ligados (para o título da aba)
export function contarMods(escolha) {
  return OPCOES_MUNDO.filter((o) => o.aba === 'mods' && escolha[o.id]).length + (tipoMod(escolha.tipo) ? 1 : 0) + (escolha.estilo === 'suave' ? 1 : 0);
}
export function marcarRegrasMods(caixas, escolha, criando = true) {
  const t = TIPOS[escolha.tipo] || TIPOS.normal;
  if (t.semSelvagens) { escolha.selvagens = false; escolha.selvagensMachucam = false; }
  if (t.forca) Object.assign(escolha, t.forca); // Guerra precisa de Armas: liga junto e trava
  const modo = modoJogoDe(escolha);
  for (const cx of caixas) for (const b of cx.querySelectorAll('button')) {
    const d = b.dataset;
    let sel, trava = false;
    if (d.modo) sel = d.modo === modo;
    else if (d.dificuldade) sel = d.dificuldade === escolha.dificuldade;
    else if (d.tipo) { sel = escolha.tipo === d.tipo; trava = !criando; }
    else if (d.estilo) sel = escolha.estilo === d.estilo;
    else if (d.opcao) { sel = !!escolha[d.opcao]; trava = (t.semSelvagens && d.opcao === 'selvagens') || !!(t.forca && d.opcao in t.forca); }
    b.setAttribute('aria-pressed', String(sel));
    if (b.getAttribute('role') === 'radio') b.setAttribute('aria-checked', String(sel));
    b.disabled = trava;
  }
}
// barra de atalhos para as partes da tela (Mundo, Regras, Mods): rola até a parte e marca o botão
export function desenharAbas(nav, form, escolha) {
  nav.innerHTML = '';
  for (const sec of form.querySelectorAll('.sec-mundo')) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.ir = sec.dataset.sec;
    b.addEventListener('click', () => {
      for (const x of nav.children) x.classList.toggle('sel', x === b);
      sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.appendChild(b);
  }
  nav.firstElementChild && nav.firstElementChild.classList.add('sel');
  atualizarAbas(nav, escolha);
}
export function atualizarAbas(nav, escolha) {
  const nomes = { mundo: 'Mundo', regras: 'Regras', mods: 'Mods' };
  for (const b of nav.children) {
    const n = b.dataset.ir === 'mods' ? contarMods(escolha) : 0;
    b.textContent = nomes[b.dataset.ir] + (b.dataset.ir === 'mods' ? ` (${n})` : '');
    if (b.dataset.ir === 'mods') b.setAttribute('aria-label', `Mods: ${n} ${n === 1 ? 'ligado' : 'ligados'}`);
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
  const caixas = [$('#e-regras'), $('#e-mods')];
  const atualizarAvisos = () => {
    const mudou = opcoesMudadas(antes, escolha);
    const terreno = OPCOES_MUNDO.filter((o) => o.terreno && mudou.includes(o.id)).map((o) => o.nome);
    const av = $('#e-aviso');
    const partes = [];
    if (terreno.length) partes.push(`${terreno.join(', ')}: muda o terreno nos lugares onde ninguém mexeu ainda. O que já foi construído continua.`);
    if (precisaRecarregar(mudou) && online) partes.push('Quem estiver jogando neste mundo vai recarregar por um instante.');
    av.textContent = partes.join(' ');
    av.hidden = !partes.length;
    const modo = modoJogoDe(antes) !== modoJogoDe(escolha);
    for (const cx of caixas) for (const b of cx.querySelectorAll('button')) {
      const d = b.dataset;
      b.classList.toggle('mudou', (d.opcao && mudou.includes(d.opcao)) || (d.estilo && mudou.includes('estilo')) || (d.dificuldade && mudou.includes('dificuldade') && d.dificuldade === escolha.dificuldade) || (d.modo && modo && b.getAttribute('aria-pressed') === 'true'));
    }
    atualizarAbas($('#e-abas'), escolha);
  };
  desenharRegrasMods(caixas[0], caixas[1], escolha, { criando: false, aoMudar: () => { som && som(); atualizarAvisos(); } });
  desenharAbas($('#e-abas'), $('#e-form'), escolha);
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

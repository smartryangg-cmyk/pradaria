// Tela "Escolha um jogo": a plataforma com uma conta só e vários jogos (lista em jogos.js).
// O Pradaria abre a lista de mundos deste mesmo site; os outros jogos ficam em páginas próprias, que usam a mesma conta.
import { conta, api } from './rede.js';
import { icone } from './icones.js';
import { JOGOS } from './jogos.js';
import { idade16, confirmarIdade16, garantirNascimento } from './idade.js';

const $ = (s) => document.querySelector(s);
let cb = {};

// cb: { lobby, amigos, mostrarMenu(id), abrirMundos(), abrirConta(modo, erro), som() }
export function ligarHub(callbacks) {
  cb = callbacks;
  $('#bt-voltar-jogos').addEventListener('click', () => { cb.som && cb.som(); abrirJogos(); });
}

function cartao(j) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'jogo' + (j.pronto ? '' : ' embreve');
  b.dataset.jogo = j.id;
  b.style.setProperty('--c1', j.cor); b.style.setProperty('--c2', j.cor2);
  const bloqueado = j.idade16 && idade16() === false;
  if (bloqueado) b.classList.add('bloqueado');
  const selos = [...(j.idade16 ? ['16+'] : []), ...(j.pronto ? j.selos : ['Em breve'])];
  b.innerHTML = `<span class="capa">${icone(j.icone, 'ic-svg')}</span><span class="info"><b></b><small></small><span class="selos"></span></span>`;
  b.querySelector('b').textContent = j.nome;
  b.querySelector('small').textContent = bloqueado ? 'Só para quem tem 16 anos ou mais' : j.desc;
  for (const s of selos) { const e = document.createElement('i'); e.textContent = s; if (s === '16+') e.className = 'mais16'; b.querySelector('.selos').appendChild(e); }
  b.setAttribute('aria-label', `${j.nome}: ${bloqueado ? 'só para 16 anos ou mais' : j.desc}${j.pronto ? '' : ' (em breve)'}`);
  b.addEventListener('click', () => escolher(j));
  return b;
}

async function escolher(j) {
  cb.som && cb.som();
  const msg = $('#jogos-msg');
  msg.textContent = '';
  if (!j.pronto) { msg.textContent = `${j.nome} está sendo feito. Logo aparece aqui!`; return; }
  if (j.idade16 && !(await confirmarIdade16(j.nome))) return;
  if (j.abrir === 'pradaria') { cb.abrirMundos(); return; }
  location.href = j.abrir;
}

export async function abrirJogos() {
  if (!conta.token) { cb.mostrarMenu('m-inicio'); return; }
  try {
    if (!conta.usuario) {
      cb.mostrarMenu('m-carregando');
      $('#carregando-txt').textContent = 'Abrindo sua conta…';
      conta.usuario = (await api('eu')).usuario;
    }
  } catch (err) {
    if (/sess|entrar|401/i.test(err.message)) { conta.salvar(null); conta.usuario = null; cb.abrirConta('entrar', 'Entre de novo, por favor.'); }
    else { cb.mostrarMenu('m-inicio'); alert('Não consegui falar com o servidor agora. Você pode jogar sem internet.\n\n' + err.message); }
    return;
  }
  // conta antiga sem data de nascimento: pergunta uma vez (decide quais jogos ficam liberados)
  await garantirNascimento();
  if (cb.lobby) { if (!cb.lobby.ws || cb.lobby.fechado) cb.lobby.reabrir(); cb.lobby.jogo('hub'); cb.amigos.carregar(); }
  $('#j-nome').textContent = conta.usuario.nome;
  $('#jogos-msg').textContent = '';
  const l = $('#lista-jogos');
  l.innerHTML = '';
  for (const j of JOGOS) l.appendChild(cartao(j));
  cb.mostrarMenu('m-jogos');
}

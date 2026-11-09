// "Você tem 16 anos ou mais?": pergunta feita antes de entrar num modo com temas sensíveis
// (mundo de Guerra, opção Armas). A resposta fica guardada na conta (servidor) e, sem conta, no aparelho.
// Quem respondeu "não" não consegue trocar sozinho para "sim" (o servidor só aceita a primeira resposta).
//
//   import { confirmarIdade16 } from './idade.js';
//   if (!(await confirmarIdade16())) return; // não entra
import { conta, api } from './rede.js';
import { icone } from './icones.js';

const CHAVE = 'pradaria.idade16';
const $ = (s) => document.querySelector(s);

// resposta guardada: true (16 ou mais), false (menos) ou null (ainda não respondeu)
export function idade16() {
  if (conta.token && conta.usuario && conta.usuario.idade16 != null) return !!conta.usuario.idade16;
  if (conta.token) return null; // com conta vale só o que o servidor guardou
  try { const v = localStorage.getItem(CHAVE); return v === '1' ? true : v === '0' ? false : null; } catch { return null; }
}

async function guardar(sim) {
  if (conta.token) {
    try {
      const r = await api('eu/idade', { mais16: sim });
      if (conta.usuario) conta.usuario.idade16 = r.idade16;
      return r.idade16;
    } catch { return null; }
  }
  try { localStorage.setItem(CHAVE, sim ? '1' : '0'); } catch {}
  return sim;
}

function janela() {
  let el = $('#idade');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'idade'; el.className = 'janela'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'idade-titulo');
  el.innerHTML = `<div class="caixa">
    <h2 class="com-ic" id="idade-titulo">${icone('cadeado')} <span>Antes de entrar</span></h2>
    <p class="idade-txt" id="idade-txt"></p>
    <div class="linha-bts" id="idade-bts">
      <button class="bt verde" id="idade-sim" type="button">Tenho 16 anos ou mais</button>
      <button class="bt" id="idade-nao" type="button">Não tenho</button>
    </div>
    <button class="bt" id="idade-ok" type="button" hidden>Voltar</button>
  </div>`;
  document.body.appendChild(el);
  return el;
}

// pergunta (se ainda não respondeu) e devolve true se pode entrar
export async function confirmarIdade16(oQue = 'Este modo') {
  if (document.pointerLockElement) document.exitPointerLock();
  // com conta: confere no servidor o que já foi respondido (outro aparelho pode ter respondido)
  if (conta.token && conta.usuario && conta.usuario.idade16 === undefined) {
    try { conta.usuario = (await api('eu')).usuario; } catch {}
  }
  const ja = idade16();
  if (ja === true) return true;
  const el = janela();
  const txt = el.querySelector('#idade-txt'), bts = el.querySelector('#idade-bts'), ok = el.querySelector('#idade-ok');
  return new Promise((fim) => {
    const fechar = (v) => { el.hidden = true; fim(v); };
    const negar = () => {
      txt.textContent = `${oQue} é só para quem tem 16 anos ou mais. Que tal um mundo sem armas?`;
      bts.hidden = true; ok.hidden = false;
      ok.onclick = () => fechar(false);
      ok.focus();
    };
    el.hidden = false;
    if (ja === false) { negar(); return; }
    txt.textContent = `${oQue} tem temas para mais velhos (armas de brinquedo e batalha). Você tem 16 anos ou mais?`;
    bts.hidden = false; ok.hidden = true;
    el.querySelector('#idade-sim').onclick = async () => { const r = await guardar(true); fechar(r !== false); };
    el.querySelector('#idade-nao').onclick = async () => { await guardar(false); negar(); };
    el.querySelector('#idade-sim').focus();
  });
}

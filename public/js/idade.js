// Idade da conta: a data de nascimento é pedida ao criar a conta (contas antigas respondem uma vez no próximo login)
// e fica guardada no servidor; ninguém troca depois. Os jogos e modos com armas (mundo de Guerra, opção Armas, Arena,
// Última Ilha...) só abrem com 16 anos ou mais. Sem conta (jogar sem internet), a data fica guardada no aparelho.
//
//   import { confirmarIdade16 } from './idade.js';
//   if (!(await confirmarIdade16('O mundo de Guerra'))) return; // não entra
import { conta, api } from './rede.js';
import { icone } from './icones.js';

const CHAVE = 'pradaria.nascimento';
const $ = (s) => document.querySelector(s);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// idade em anos completos (data 'AAAA-MM-DD')
export function idadeDe(nasc, agora = new Date()) {
  const [a, m, d] = nasc.split('-').map(Number);
  let i = agora.getFullYear() - a;
  if (agora.getMonth() + 1 < m || (agora.getMonth() + 1 === m && agora.getDate() < d)) i--;
  return i;
}
function nascimentoLocal() { try { const v = localStorage.getItem(CHAVE); return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null; } catch { return null; } }

// 16 anos ou mais? true, false ou null (ainda não disse a data de nascimento)
export function idade16() {
  if (conta.token) return conta.usuario && conta.usuario.idade16 != null ? !!conta.usuario.idade16 : null;
  const n = nascimentoLocal();
  return n ? idadeDe(n) >= 16 : null;
}
// a conta (ou o aparelho, sem conta) ainda precisa dizer a data de nascimento?
export const faltaNascimento = () => (conta.token ? !!conta.usuario && !conta.usuario.temNascimento : !nascimentoLocal());

// três listas (dia, mês, ano), fáceis no tablet. Devolve { valor() -> 'AAAA-MM-DD' | null }
export function seletorData(el) {
  const ano = new Date().getFullYear();
  const op = (v, t) => `<option value="${v}">${t}</option>`;
  el.classList.add('data-nasc');
  el.innerHTML = `<select aria-label="Dia" class="d-dia">${op('', 'Dia')}${Array.from({ length: 31 }, (_, i) => op(i + 1, i + 1)).join('')}</select>`
    + `<select aria-label="Mês" class="d-mes">${op('', 'Mês')}${MESES.map((m, i) => op(i + 1, m)).join('')}</select>`
    + `<select aria-label="Ano" class="d-ano">${op('', 'Ano')}${Array.from({ length: 101 }, (_, i) => op(ano - i, ano - i)).join('')}</select>`;
  // servidor local de desenvolvimento (wrangler dev): já vem com uma data de adulto, para os testes automáticos
  // criarem contas sem mexer nas listas; no site de verdade começa vazio
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { el.querySelector('.d-dia').value = '1'; el.querySelector('.d-mes').value = '1'; el.querySelector('.d-ano').value = '2000'; }
  return {
    valor() {
      const d = +el.querySelector('.d-dia').value, m = +el.querySelector('.d-mes').value, a = +el.querySelector('.d-ano').value;
      if (!d || !m || !a) return null;
      const dt = new Date(a, m - 1, d);
      if (dt.getMonth() !== m - 1 || dt > new Date()) return null;
      return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    },
  };
}

function janela() {
  let el = $('#idade');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'idade'; el.className = 'janela'; el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'idade-titulo');
  el.innerHTML = `<div class="caixa">
    <h2 class="com-ic" id="idade-titulo">${icone('cadeado')} <span></span></h2>
    <p class="idade-txt" id="idade-txt"></p>
    <div id="idade-data"></div>
    <p class="erro" id="idade-erro"></p>
    <div class="linha-bts" id="idade-bts">
      <button class="bt verde" id="idade-sim" type="button">Pronto</button>
      <button class="bt" id="idade-nao" type="button">Agora não</button>
    </div>
    <button class="bt" id="idade-ok" type="button" hidden>Voltar</button>
  </div>`;
  document.body.appendChild(el);
  return el;
}

// pergunta a data de nascimento (uma vez só). obrigatorio: sem "Agora não". Devolve true se guardou.
export function pedirNascimento({ obrigatorio = false, texto = '' } = {}) {
  if (document.pointerLockElement) document.exitPointerLock();
  const el = janela();
  el.querySelector('#idade-titulo span').textContent = 'Quando você nasceu?';
  el.querySelector('#idade-txt').textContent = texto || 'Guardamos só para saber quais jogos combinam com a sua idade. Peça ajuda a um adulto se precisar. Depois não dá para trocar.';
  const sel = seletorData(el.querySelector('#idade-data'));
  el.querySelector('#idade-data').hidden = false;
  const erro = el.querySelector('#idade-erro'); erro.textContent = '';
  el.querySelector('#idade-data').onchange = () => { erro.textContent = ''; };
  el.querySelector('#idade-bts').hidden = false; el.querySelector('#idade-ok').hidden = true;
  el.querySelector('#idade-nao').hidden = obrigatorio;
  el.hidden = false;
  return new Promise((fim) => {
    el.querySelector('#idade-nao').onclick = () => { el.hidden = true; fim(false); };
    el.querySelector('#idade-sim').onclick = async () => {
      const v = sel.valor();
      if (!v) { erro.textContent = 'Escolha o dia, o mês e o ano.'; return; }
      if (conta.token) {
        try { conta.usuario = (await api('eu/nascimento', { nascimento: v })).usuario; } catch (e) { erro.textContent = e.message; return; }
      } else try { localStorage.setItem(CHAVE, v); } catch {}
      el.hidden = true; fim(true);
    };
    el.querySelector('.d-dia').focus();
  });
}

// conta antiga sem data de nascimento: pergunta uma vez (chamado depois do login)
export async function garantirNascimento() {
  if (conta.token && conta.usuario && conta.usuario.temNascimento === undefined) { try { conta.usuario = (await api('eu')).usuario; } catch {} }
  if (conta.token && conta.usuario && !conta.usuario.temNascimento)
    await pedirNascimento({ obrigatorio: true, texto: 'Agora a Pradaria pede a data de nascimento de todo mundo, uma vez só. Ela decide quais jogos combinam com a sua idade e não dá para trocar depois. Peça ajuda a um adulto se precisar.' });
}

// pode entrar num jogo ou modo só para 16 anos ou mais? (pergunta a data se ainda não sabe)
export async function confirmarIdade16(oQue = 'Este modo') {
  if (document.pointerLockElement) document.exitPointerLock();
  if (conta.token && conta.usuario && conta.usuario.temNascimento === undefined) { try { conta.usuario = (await api('eu')).usuario; } catch {} }
  if (idade16() === null && !(await pedirNascimento())) return false;
  if (idade16() === true) return true;
  const el = janela();
  el.querySelector('#idade-titulo span').textContent = 'Só com 16 anos ou mais';
  el.querySelector('#idade-txt').textContent = `${oQue} é só para quem tem 16 anos ou mais. Que tal um jogo sem armas?`;
  el.querySelector('#idade-data').hidden = true; el.querySelector('#idade-erro').textContent = '';
  el.querySelector('#idade-bts').hidden = true;
  const ok = el.querySelector('#idade-ok'); ok.hidden = false;
  el.hidden = false;
  return new Promise((fim) => { ok.onclick = () => { el.hidden = true; fim(false); }; ok.focus(); });
}

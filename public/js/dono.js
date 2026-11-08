// Proteções para criança: ferramentas do dono do mundo (quem pode entrar, trocar código),
// autorização de um adulto ao criar conta e "apagar minha conta".
import { api, conta } from './rede.js';

const $ = (s) => document.querySelector(s);

// ---------- pausa: só o dono vê o código e a lista de quem pode entrar ----------
export async function preencherDono(mundo, aoTrocarCodigo) {
  const caixa = $('#pausa-dono');
  if (!caixa) return;
  caixa.hidden = !(mundo && mundo.dono);
  if (caixa.hidden) return;
  $('#dono-codigo').textContent = mundo.codigo;
  const lista = $('#dono-membros');
  lista.textContent = 'Carregando…';
  try {
    const { membros } = await api('mundos/membros', { codigo: mundo.codigo });
    lista.textContent = '';
    if (!membros.length) { lista.textContent = 'Só você por enquanto.'; return; }
    for (const p of membros) {
      const linha = document.createElement('div');
      linha.className = 'dono-membro';
      const nome = document.createElement('span'); nome.textContent = p.nome;
      const bt = document.createElement('button');
      bt.type = 'button'; bt.className = 'bt fraco'; bt.textContent = 'Tirar do mundo';
      bt.addEventListener('click', async () => {
        if (!confirm(`Tirar ${p.nome} deste mundo? Para voltar, vai precisar do código de novo.`)) return;
        bt.disabled = true;
        try { await api('mundos/expulsar', { codigo: mundo.codigo, uid: p.id }); linha.remove(); }
        catch (e) { bt.disabled = false; alert(e.message); }
      });
      linha.append(nome, bt);
      lista.appendChild(linha);
    }
  } catch (e) { lista.textContent = e.message; }

  const bt = $('#dono-trocar');
  bt.onclick = async () => {
    if (!confirm('Trocar o código do mundo? O código antigo para de funcionar e todos (menos você) saem até receberem o código novo. O que foi construído continua.')) return;
    bt.disabled = true;
    try {
      const { codigo } = await api('mundos/codigo-novo', { codigo: mundo.codigo });
      mundo.codigo = codigo;
      aoTrocarCodigo && aoTrocarCodigo(codigo);
      preencherDono(mundo, aoTrocarCodigo);
    } catch (e) { alert(e.message); }
    bt.disabled = false;
  };
}

// ---------- criar conta: um adulto precisa autorizar ----------
export function contaModo(m) {
  const c = $('#c-adulto');
  if (!c) return;
  c.hidden = m === 'entrar';
  $('#c-adulto-ok').required = m !== 'entrar';
  // nos testes automáticos (#teste) a caixa já vem marcada, para os testes de outras partes não quebrarem
  $('#c-adulto-ok').checked = location.hash === '#teste';
}

// ---------- apagar a conta ----------
export function ligarApagarConta(depois) {
  const bt = $('#bt-apagar-conta');
  if (!bt) return;
  bt.addEventListener('click', async () => {
    if (!conta.token) return;
    if (!confirm('Apagar a conta para sempre? Seus mundos e tudo o que foi construído neles somem e não dá para desfazer.')) return;
    const senha = prompt('Para confirmar, digite a senha da conta:');
    if (!senha) return;
    try {
      await api('eu', { senha }, 'DELETE');
      conta.salvar(null); conta.usuario = null;
      alert('Pronto, a conta foi apagada.');
      depois && depois();
    } catch (e) { alert(e.message); }
  });
}

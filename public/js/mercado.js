// Mercado (moedas, loja dos aldeões, presentes) e objetivos: a parte da tela.
// As regras ficam em economia.js. Online quem decide é a sala (servidor); sem internet, o próprio aparelho.
import { opcoesEcon, estadoNovo, normalizar, aplicar, liberado, LOJA, precoVenda, objetivosDoMundo, objetivosAtivos, OBJETIVOS } from './economia.js';

const $ = (s) => document.querySelector(s);
const CHAVE_LOCAL = 'pradaria.econ';

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

export class Mercado {
  // ui: { aviso, som, icone(b, tam), nomeBloco(b), pausar(), retomar(), outros(): [{id, nome}] }
  constructor(ui) {
    this.ui = ui;
    this.op = opcoesEcon(null);
    this.e = estadoNovo(this.op);
    this.sala = null;
    this.andado = 0; this.voou = false;
    this.montarTela();
  }

  get ligado() { return this.op.mercado || this.op.objetivos; }

  // começa um mundo. online: estado vem do servidor; local: do aparelho
  iniciar({ opcoes, estado, sala, novo }) {
    this.op = opcoesEcon(opcoes);
    this.sala = sala || null;
    if (this.sala) this.e = normalizar(estado, this.op);
    else {
      let salvo = null;
      if (!novo) try { salvo = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || 'null'); } catch {}
      this.e = normalizar(salvo, this.op);
      if (!salvo) this.salvarLocal();
    }
    this.andado = 0; this.voou = false;
    this.atualizarHud();
  }
  parar() { this.sala = null; this.op = opcoesEcon(null); this.fechar(); this.atualizarHud(); }

  salvarLocal() { if (!this.sala) try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(this.e)); } catch {} }

  // ---------- ações ----------
  enviar(acao, quieto) {
    if (!this.ligado) return;
    if (this.sala) { this.sala.enviar(acao); return; }
    const r = aplicar(this.e, this.op, acao);
    if (!r.ok) { if (!quieto) this.ui.aviso(r.erro, 2200); return; }
    this.salvarLocal();
    this.recebeu(this.e, r.feitos);
  }
  evento(e, n = 1) { this.enviar({ t: 'ev', e, n }, true); }
  // só sem internet (online o servidor conta pela própria mensagem do bloco)
  bloco(b, y, de, natural) { if (!this.sala) this.enviar({ t: 'bloco', b, y, de, natural }, true); }
  podeColocar(b) { return liberado(this.e, b, this.op); }
  precoDe(b) { const x = LOJA.find((l) => l.b === b); return x ? x.preco : 0; }

  // a cada quadro: conta os passos e o voo
  passo(dx, dz, jog, chao) {
    if (!this.op.objetivos) return;
    const d = Math.hypot(dx, dz);
    if (d < 2 && !jog.voando) this.andado += d; // pulos grandes (teleporte) não contam
    if (this.andado >= 25) { this.evento('andar', Math.floor(this.andado)); this.andado -= Math.floor(this.andado); }
    if (!this.voou && jog.voando && jog.pos.y - chao > 12) { this.voou = true; this.evento('voar'); }
  }

  // estado novo (do servidor ou daqui mesmo)
  recebeu(estado, feitos = [], msg) {
    const moedasAntes = this.e.moedas;
    this.e = normalizar(estado, this.op);
    for (const id of feitos || []) {
      const o = OBJETIVOS.find((x) => x.id === id);
      if (!o) continue;
      this.ui.som.oi && this.ui.som.oi();
      this.comemorar(`${o.ic} Objetivo cumprido!`, o.txt, this.op.mercado ? `+${o.premio} 🪙` : '+1 ⭐');
    }
    if (msg) this.ui.aviso(msg, 3000);
    if (this.e.moedas !== moedasAntes) this.pulsar();
    this.atualizarHud();
    if (!$('#loja').hidden) this.desenharLoja();
    if (!$('#mochila').hidden) this.desenharMochila();
    if (!$('#objetivos').hidden) this.desenharObjetivos();
  }
  erro(msg) { this.ui.aviso(msg, 2200); }

  // ---------- tela ----------
  montarTela() {
    const hud = $('#hud');
    const box = el('div', '', null); box.id = 'econ'; box.hidden = true;
    this.chip = el('button', 'econ-chip'); this.chip.setAttribute('aria-label', 'Mochila e moedas');
    this.chip.addEventListener('click', () => this.abrirMochila());
    this.alvo = el('button', 'econ-alvo'); this.alvo.setAttribute('aria-label', 'Objetivos');
    this.alvo.addEventListener('click', () => this.abrirObjetivos());
    box.append(this.chip, this.alvo);
    hud.appendChild(box);
    this.festa = el('div', ''); this.festa.id = 'festa'; hud.appendChild(this.festa);

    const janela = (id, titulo) => {
      const j = el('div', 'janela'); j.id = id; j.hidden = true;
      const c = el('div', 'caixa econ-caixa');
      const h = el('h2', '', titulo); const sub = el('p', 'sub'); const corpo = el('div', 'econ-corpo');
      const f = el('button', 'bt', 'Fechar'); f.addEventListener('click', () => this.fechar());
      c.append(h, sub, corpo, f); j.appendChild(c); document.body.appendChild(j);
      return { j, h, sub, corpo };
    };
    this.wLoja = janela('loja', '🛒 Loja');
    this.wMochila = janela('mochila', '🎒 Mochila');
    this.wObj = janela('objetivos', '🎯 Objetivos');
    this.abaLoja = 'vender';
  }

  atualizarHud() {
    const box = $('#econ');
    box.hidden = !this.ligado;
    if (!this.ligado) return;
    this.chip.hidden = false;
    this.chip.textContent = this.op.mercado ? `🪙 ${this.e.moedas}` : `⭐ ${this.e.estrelas}`;
    const at = objetivosAtivos(this.e, this.op)[0];
    this.alvo.hidden = !this.op.objetivos;
    if (this.op.objetivos) {
      this.alvo.innerHTML = '';
      if (at) {
        const v = Math.min(at.meta, this.e.cont[at.conta] || 0);
        this.alvo.append(el('span', 'ic', at.ic), el('span', 'tx', at.txt), el('b', '', `${v}/${at.meta}`));
        const barra = el('i', ''); barra.style.width = (100 * v / at.meta) + '%'; this.alvo.appendChild(barra);
      } else this.alvo.append(el('span', 'ic', '🏆'), el('span', 'tx', 'Você cumpriu todos os objetivos!'));
    }
  }
  pulsar() { this.chip.classList.remove('pula'); void this.chip.offsetWidth; this.chip.classList.add('pula'); }

  comemorar(titulo, txt, premio) {
    const c = el('div', 'festa-card');
    c.append(el('b', '', titulo), el('span', '', txt), el('em', '', premio));
    this.festa.appendChild(c);
    setTimeout(() => c.classList.add('sai'), 3200);
    setTimeout(() => c.remove(), 3800);
  }

  abrir(w) { this.fechar(true); w.j.hidden = false; this.ui.pausar(); }
  fechar(semRetomar) {
    let algum = false;
    for (const id of ['loja', 'mochila', 'objetivos']) { const j = $('#' + id); if (j && !j.hidden) { j.hidden = true; algum = true; } }
    if (algum && !semRetomar) this.ui.retomar();
  }
  aberto() { return ['loja', 'mochila', 'objetivos'].some((id) => !$('#' + id).hidden); }

  linhaItem(b, qtd, direita) {
    const l = el('div', 'econ-linha');
    const ic = el('span', 'econ-ic'); ic.appendChild(this.ui.icone(b, 36));
    const nm = el('span', 'econ-nome', this.ui.nomeBloco(b));
    if (qtd != null) nm.appendChild(el('small', '', ` ×${qtd}`));
    l.append(ic, nm);
    if (direita) l.appendChild(direita);
    return l;
  }

  // ----- loja do aldeão -----
  abrirLoja(aldeao) {
    if (!this.op.mercado) return false;
    this.vendedor = aldeao ? `${aldeao.nome} · ${aldeao.vila.nome}` : '';
    this.abrir(this.wLoja);
    this.desenharLoja();
    return true;
  }
  desenharLoja() {
    const w = this.wLoja;
    w.h.textContent = '🛒 Loja da vila';
    w.sub.textContent = `${this.vendedor} · Você tem 🪙 ${this.e.moedas}`;
    w.corpo.innerHTML = '';
    const abas = el('div', 'linha-bts econ-abas');
    for (const [k, t] of [['vender', '💰 Vender'], ['comprar', '🧱 Comprar']]) {
      const b = el('button', 'bt' + (this.abaLoja === k ? ' verde' : ''), t);
      b.addEventListener('click', () => { this.abaLoja = k; this.ui.som.clique(); this.desenharLoja(); });
      abas.appendChild(b);
    }
    w.corpo.appendChild(abas);
    const lista = el('div', 'econ-lista');
    if (this.abaLoja === 'vender') {
      const itens = Object.entries(this.e.itens).filter(([, n]) => n > 0);
      if (!itens.length) lista.appendChild(el('div', 'vazio', 'Sua mochila está vazia. Quebre blocos pelo mundo (terra, troncos, flores…) e traga aqui para vender! ⛏️'));
      for (const [k, n] of itens) {
        const b = +k, p = precoVenda(b);
        const bt = el('button', 'bt verde econ-bt', `+${p * n} 🪙`);
        bt.title = `Vender tudo (${p} cada)`;
        bt.addEventListener('click', () => { this.ui.som.clique(); this.enviar({ t: 'vender', b, n }); });
        const um = el('button', 'bt econ-bt', `1 → ${p}🪙`);
        um.addEventListener('click', () => { this.ui.som.clique(); this.enviar({ t: 'vender', b, n: 1 }); });
        const d = el('span', 'econ-dir'); d.append(um, bt);
        lista.appendChild(this.linhaItem(b, n, d));
      }
    } else {
      for (const { b, preco } of LOJA) {
        const tem = this.e.comprados.includes(b);
        const bt = el('button', 'bt econ-bt' + (tem ? ' fraco' : this.e.moedas >= preco ? ' verde' : ''), tem ? '✓ Seu' : `🪙 ${preco}`);
        bt.disabled = tem;
        bt.addEventListener('click', () => {
          this.ui.som.clique();
          if (this.e.moedas < preco) { this.ui.aviso(`Faltam ${preco - this.e.moedas} moedas 🪙`, 1800); return; }
          this.enviar({ t: 'comprar', b });
        });
        lista.appendChild(this.linhaItem(b, null, bt));
      }
    }
    w.corpo.appendChild(lista);
  }

  // ----- mochila (moedas, coisas coletadas, dar presente) -----
  abrirMochila() { this.abrir(this.wMochila); this.desenharMochila(); }
  desenharMochila() {
    const w = this.wMochila;
    w.sub.textContent = this.op.mercado ? `Você tem 🪙 ${this.e.moedas} moedas` + (this.op.objetivos ? '' : '') : `Você tem ⭐ ${this.e.estrelas} estrelas dos objetivos`;
    w.corpo.innerHTML = '';
    if (this.op.objetivos) {
      const b = el('button', 'bt', `🎯 Ver objetivos (${this.e.feitos.length}/${objetivosDoMundo(this.op).length})`);
      b.addEventListener('click', () => this.abrirObjetivos());
      w.corpo.appendChild(b);
    }
    if (!this.op.mercado) return;
    w.corpo.appendChild(el('p', 'econ-dica', 'Toque num aldeão para abrir a loja da vila: lá você vende o que coletou e compra blocos novos.'));
    const lista = el('div', 'econ-lista');
    const itens = Object.entries(this.e.itens).filter(([, n]) => n > 0);
    if (!itens.length) lista.appendChild(el('div', 'vazio', 'Nada coletado ainda. Quebre blocos pelo mundo! ⛏️'));
    for (const [k, n] of itens) lista.appendChild(this.linhaItem(+k, n, el('small', 'econ-dir', `${precoVenda(+k)} 🪙 cada`)));
    w.corpo.appendChild(lista);
    if (this.sala) {
      const amigos = this.ui.outros();
      w.corpo.appendChild(el('h3', '', '🎁 Dar moedas para um amigo'));
      if (!amigos.length) w.corpo.appendChild(el('p', 'econ-dica', 'Quando um amigo estiver no mundo, ele aparece aqui.'));
      for (const a of amigos) {
        const d = el('span', 'econ-dir');
        for (const n of [1, 5, 10]) {
          const b = el('button', 'bt econ-bt', `${n} 🪙`);
          b.addEventListener('click', () => { this.ui.som.clique(); if (this.e.moedas < n) return this.ui.aviso('Você não tem tantas moedas.', 1800); this.sala.enviar({ t: 'dar', para: a.id, n }); });
          d.appendChild(b);
        }
        const l = el('div', 'econ-linha'); l.append(el('span', 'econ-ic', '🙂'), el('span', 'econ-nome', a.nome), d);
        w.corpo.appendChild(l);
      }
    }
  }

  // ----- objetivos -----
  abrirObjetivos() { if (!this.op.objetivos) return; this.abrir(this.wObj); this.desenharObjetivos(); }
  desenharObjetivos() {
    const w = this.wObj;
    const todos = objetivosDoMundo(this.op);
    const ativos = new Set(objetivosAtivos(this.e, this.op).map((o) => o.id));
    w.sub.textContent = `${this.e.feitos.length} de ${todos.length} cumpridos` + (this.op.mercado ? '' : ` · ⭐ ${this.e.estrelas}`);
    w.corpo.innerHTML = '';
    const lista = el('div', 'econ-lista');
    for (const o of todos) {
      const feito = this.e.feitos.includes(o.id), ativo = ativos.has(o.id);
      const l = el('div', 'econ-linha obj' + (feito ? ' feito' : ativo ? ' ativo' : ' depois'));
      const v = Math.min(o.meta, this.e.cont[o.conta] || 0);
      const nm = el('span', 'econ-nome', feito || ativo ? o.txt : '???');
      if (ativo) { const bar = el('span', 'econ-barra'); const i = el('i'); i.style.width = (100 * v / o.meta) + '%'; bar.appendChild(i); nm.appendChild(bar); }
      l.append(el('span', 'econ-ic', feito ? '✅' : ativo ? o.ic : '🔒'), nm,
        el('small', 'econ-dir', feito ? 'feito!' : (ativo ? `${v}/${o.meta} · ` : '') + (this.op.mercado ? `🪙 ${o.premio}` : '⭐')));
      lista.appendChild(l);
    }
    w.corpo.appendChild(lista);
  }
}

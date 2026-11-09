// Meus negócios: os trabalhadores contratados andando pelo mundo (pedreiro na obra, padeiro na padaria,
// lojista na loja), a janela "Meus negócios" e a escolha do lugar de uma obra nova.
// As regras (salário, horário, quanto cada um produz) ficam em trabalho.js; as plantas em casas.js.
import * as THREE from '../vendor/three.module.min.js';
import { icone, comIcone } from './icones.js';
import { montarAldeao, balao } from './aldeoes.js';
import { SOLIDO, AGUA, PLANTA, FOLHAGEM, B } from './blocos.js';
import { PLANTAS, ESTILOS_OBRA, DIRS, blocosDaObra, noMundo, areaDaObra, alturaDaPlanta, materiais, desenhar } from './casas.js';
import { OFICIOS, HORA_INI, HORA_FIM, horaDe, noHorario, situacao, faltaPara, obraCabe, pertoDe, TRIGO, FARINHA, PAO, TRIGO_POR_PAO, PRECO_MATERIAL, MAX_OBRAS, livreDe } from './trabalho.js';
import { precoLoja } from './economia.js';
import { rngSemente } from './ruido.js';

const $ = (s) => document.querySelector(s);
function el(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function elIc(tag, cls, ic, txt) { const e = el(tag, cls); e.innerHTML = comIcone(ic, txt == null ? '' : txt); return e; }
const moedaHtml = (n) => `<span class="econ-m">${icone('moeda')}<span>${n}</span></span>`;
const hhmm = (h) => `${Math.floor(h)}h${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

const ARVORE = new Set([B.TRONCO, B.TRONCO_PINHEIRO, B.TRONCO_BETULA, B.FOLHAS, B.FOLHAS_PINHEIRO, B.FOLHAS_SELVA, B.CACTO]);
// onde cada um fica dentro do prédio (coordenadas da planta, veja casas.js)
const POSTO = { padaria: [3, 1, 4], loja: [1, 1, 3] };

export class Negocios {
  // ui: { cena, mercado, som, aviso, icone(b,t), nomeBloco(b), pausar(), retomar(), mundo(), jog(), dia(), sobrev(), bichos(), online() }
  constructor(ui) {
    this.ui = ui;
    this.npcs = new Map(); // id do trabalhador -> boneco
    this.aba = 'equipe';
    this.estilo = 'madeira';
    this.escolha = null; // { p, e, giro } escolhendo o lugar da obra
    this.checar = 0;
    this.montarTela();
  }

  get e() { return this.ui.mercado.e; }
  get ligado() { return !!this.ui.mercado.op.mercado; }

  // ---------- bonecos dos trabalhadores ----------
  limpar() {
    for (const n of this.npcs.values()) this.tirarNpc(n);
    this.npcs.clear();
    this.cancelarEscolha();
  }
  tirarNpc(n) {
    if (n.balao) { n.grupo.remove(n.balao); n.balao.material.map.dispose(); n.balao.material.dispose(); }
    this.ui.cena.remove(n.grupo);
    n.grupo.traverse((o) => o.geometry && o.geometry.dispose());
  }

  // chão perto de yRef
  solo(x, z, yRef) {
    const m = this.ui.mundo(), bx = Math.floor(x), bz = Math.floor(z);
    for (let y = Math.floor(yRef) + 3; y > yRef - 8 && y > 0; y--) {
      const b = m.bloco(bx, y - 1, bz);
      if ((SOLIDO[b] || AGUA[b]) && !SOLIDO[m.bloco(bx, y, bz)] && !SOLIDO[m.bloco(bx, y + 1, bz)]) return y;
    }
    return null;
  }

  // para onde cada um vai agora: { x, y, z, olha? } ou null (segue o jogador)
  posto(x, hora) {
    const e = this.e;
    if (!noHorario(hora)) return { casa: true };
    const s = situacao(e, x, hora);
    if (x.of === 'pedreiro' && s.obra) {
      const o = s.obra, l = blocosDaObra(o);
      // perto do próximo bloco (pelo lado de dentro ou de fora, onde tiver chão)
      let alvo = l[Math.min(o.i, l.length - 1)];
      for (let k = o.i; k < l.length && !l[k][3]; k++) alvo = l[Math.min(k + 1, l.length - 1)];
      const pos = noMundo(o.p, o.x, o.y, o.z, o.r);
      const [fx, , fz] = pos((PLANTAS[o.p].L - 1) / 2, 0, -2);
      return { x: alvo[0] + 0.5, z: alvo[2] + 0.5, y: o.y + 1, olha: [alvo[0] + 0.5, alvo[2] + 0.5], fora: [fx + 0.5, fz + 0.5], trabalha: true };
    }
    const lugar = x.of === 'padeiro' ? e.neg.padaria : x.of === 'lojista' ? e.neg.loja : null;
    if (lugar) {
      const id = x.of === 'padeiro' ? 'padaria' : 'loja';
      const pos = noMundo(id, lugar.x, lugar.y, lugar.z, lugar.r);
      const [px, py, pz] = pos(...POSTO[id]);
      const [ox, , oz] = pos(POSTO[id][0], 1, 0); // olha para a porta (fregueses)
      return { x: px + 0.5, y: py, z: pz + 0.5, olha: [ox + 0.5, oz + 0.5], trabalha: s.ativo };
    }
    return null;
  }

  atualizar(dt, jog, dia) {
    const mundo = this.ui.mundo();
    if (!mundo) return;
    const e = this.e, hora = horaDe(dia);
    const ids = new Set();
    if (this.ligado) for (const x of e.equipe) {
      ids.add(x.id);
      let n = this.npcs.get(x.id);
      if (!n) {
        const mod = montarAldeao(rngSemente(9000 + (x.cor | 0) * 7919), x.of === 'pedreiro' ? 'artesao' : x.of === 'padeiro' ? 'padeiro' : 'lojista');
        n = { ...mod, id: x.id, x: jog.pos.x + 2, y: jog.pos.y, z: jog.pos.z + 2, vy: 0, dir: 0, fase: 0, golpe: 0, falando: 0, balao: null, preso: 0, raio: 0.35, alt: 1.85 };
        if (x.of === 'pedreiro') { // capacete amarelo
          const cap = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.52), new THREE.MeshLambertMaterial({ color: 0xf2c72e }));
          cap.position.y = 0.53; n.cabeca.add(cap);
        }
        this.ui.cena.add(n.grupo);
        this.npcs.set(x.id, n);
      }
      n.trab = x;
      this.mover(n, x, dt, jog, hora, mundo);
    }
    for (const [id, n] of this.npcs) if (!ids.has(id)) { this.tirarNpc(n); this.npcs.delete(id); }
    if (this.escolha) this.atualizarEscolha(jog);
    // janela aberta: atualiza os números de vez em quando
    this.checar -= dt;
    if (this.checar <= 0) { this.checar = 1; if (!this.w.j.hidden) this.desenhar(); }
  }

  mover(n, x, dt, jog, hora, mundo) {
    const p = this.posto(x, hora);
    // fora do horário: foi para casa (some) e volta de manhã
    n.grupo.visible = !(p && p.casa);
    if (!n.grupo.visible) return;
    let tx, tz, ty;
    if (p) { tx = p.x; tz = p.z; ty = p.y; }
    else {
      // sem lugar de trabalho: acompanha o jogador de pertinho
      const d = Math.hypot(jog.pos.x - n.x, jog.pos.z - n.z);
      if (d > 3.2) { tx = jog.pos.x - (jog.pos.x - n.x) / d * 2.5; tz = jog.pos.z - (jog.pos.z - n.z) / d * 2.5; }
      else { tx = n.x; tz = n.z; }
      ty = jog.pos.y;
    }
    const dx = tx - n.x, dz = tz - n.z, dist = Math.hypot(dx, dz);
    let andando = false;
    if (dist > 28 || Math.abs((ty ?? n.y) - n.y) > 12) {
      // longe demais: chega de uma vez (como quem pegou um atalho)
      const s = this.solo(tx, tz, ty ?? n.y) ?? ty ?? n.y;
      n.x = tx; n.z = tz; n.y = s; n.vy = 0;
    } else if (dist > 0.3) {
      const v = Math.min(dist, (dist > 6 ? 4 : 2) * dt);
      const nx = n.x + dx / dist * v, nz = n.z + dz / dist * v;
      const s = this.solo(nx, nz, n.y);
      if (s != null && s - n.y <= 1.05) { n.x = nx; n.z = nz; if (s - n.y > 0.05 && n.vy === 0) n.vy = 6; n.preso = 0; andando = true; }
      else if ((n.preso += dt) > 1.2) {
        // travou (parede, obra subindo): o pedreiro dá a volta e trabalha de fora
        const [fx, fz] = p && p.fora ? p.fora : [tx, tz];
        const s2 = this.solo(fx, fz, ty ?? n.y) ?? this.solo(tx, tz, ty ?? n.y);
        if (s2 != null) { n.x = fx; n.z = fz; n.y = s2; n.vy = 0; }
        n.preso = 0;
      }
      n.dir = Math.atan2(dx, dz);
    } else if (p && p.olha) n.dir = Math.atan2(p.olha[0] - n.x, p.olha[1] - n.z);
    else n.dir = Math.atan2(jog.pos.x - n.x, jog.pos.z - n.z);
    // gravidade
    const s = this.solo(n.x, n.z, n.y);
    n.vy -= 20 * dt; n.y += n.vy * dt;
    if (s != null && n.y <= s) { n.y = s; n.vy = 0; }
    if (n.y < -10) n.y = (this.solo(n.x, n.z, jog.pos.y) ?? jog.pos.y);
    // animação: anda, ou trabalha (martelada / mexe a massa / atende)
    n.fase += dt * (andando ? 8 : 0);
    const bal = andando ? Math.sin(n.fase) * 0.6 : 0;
    n.pernas[0].rotation.x = bal; n.pernas[1].rotation.x = -bal;
    n.bracos[0].rotation.x = -bal * 0.8;
    if (!andando && p && p.trabalha) { n.golpe += dt * (x.of === 'pedreiro' ? 9 : 4); n.bracos[1].rotation.x = -1.2 + Math.sin(n.golpe) * 0.7; }
    else n.bracos[1].rotation.x = bal * 0.8;
    if (n.falando > 0) { n.falando -= dt; if (n.falando <= 0 && n.balao) { n.grupo.remove(n.balao); n.balao.material.map.dispose(); n.balao.material.dispose(); n.balao = null; } }
    const atual = n.grupo.rotation.y, delta = ((n.dir - atual + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    n.grupo.rotation.y = atual + delta * Math.min(1, dt * 7);
    n.grupo.position.set(n.x, n.y, n.z);
  }

  falar(n, txt) {
    if (n.balao) { n.grupo.remove(n.balao); n.balao.material.map.dispose(); n.balao.material.dispose(); }
    n.balao = balao(txt); n.balao.position.y = 2.15; n.grupo.add(n.balao); n.falando = 4;
  }

  atingir(o, dir, max) {
    let melhor = null, tm = max;
    const O = [o.x, o.y, o.z], D = [dir.x, dir.y, dir.z];
    for (const n of this.npcs.values()) {
      if (!n.grupo.visible) continue;
      const r = n.raio, min = [n.x - r, n.y, n.z - r], mx = [n.x + r, n.y + n.alt, n.z + r];
      let t0 = 0, t1 = tm, ok = true;
      for (let k = 0; k < 3 && ok; k++) {
        if (Math.abs(D[k]) < 1e-8) { if (O[k] < min[k] || O[k] > mx[k]) ok = false; continue; }
        let ta = (min[k] - O[k]) / D[k], tb = (mx[k] - O[k]) / D[k];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) ok = false;
      }
      if (ok && t0 < tm) { tm = t0; melhor = n; }
    }
    return melhor ? { npc: melhor, t: tm } : null;
  }

  // tocou no trabalhador: ele conta o que está fazendo e abre a janela
  tocar(n) {
    const x = n.trab, s = situacao(this.e, x, horaDe(this.ui.dia()));
    this.falar(n, `${x.nome}: ${s.txt}`);
    this.ui.som.tom && this.ui.som.tom(420, 0.08, { tipo: 'triangle', vol: 0.2, ate: 520 });
    setTimeout(() => this.abrir(x.of === 'padeiro' ? 'padaria' : x.of === 'lojista' ? 'loja' : x.of === 'pedreiro' ? 'obras' : 'equipe'), 700);
  }

  // a sala (ou o jogo) mandou o estado novo: festeja o que aconteceu
  novidades(r) {
    if (!r) return;
    if (r.paes) for (const n of this.npcs.values()) if (n.trab && n.trab.of === 'padeiro' && n.grupo.visible) this.ui.bichos().icone('pao', n.x, n.y + 2.2, n.z, 1.6, 0.5);
    if (r.vendas) for (const n of this.npcs.values()) if (n.trab && n.trab.of === 'lojista' && n.grupo.visible) { this.ui.bichos().icone('moeda', n.x, n.y + 2.2, n.z, 1.6, 0.5); this.ui.som.tom && this.ui.som.tom(880, 0.06, { tipo: 'square', vol: 0.12, ate: 1320 }); }
  }

  // estado novo da economia (da sala ou daqui): obra aceita, festinha, janela atualizada
  estadoMudou(antes, depois, extra) {
    this.novidades(extra);
    if (this.ultimaObra && depois.obras.length > ((antes && antes.obras) || []).length) this.respostaObra(true);
    if (!this.w.j.hidden) this.desenhar();
  }

  // ---------- janela "Meus negócios" ----------
  montarTela() {
    const j = el('div', 'janela'); j.id = 'negocios'; j.hidden = true;
    const c = el('div', 'caixa econ-caixa neg-caixa');
    const h = elIc('h2', 'com-ic', 'amigos', 'Meus negócios');
    const sub = el('p', 'sub'), corpo = el('div', 'econ-corpo');
    const f = el('button', 'bt', 'Fechar'); f.addEventListener('click', () => this.fechar());
    c.append(h, sub, corpo, f); j.appendChild(c); document.body.appendChild(j);
    this.w = { j, h, sub, corpo };
    // barra da escolha do lugar da obra
    const b = el('div', ''); b.id = 'obra-escolha'; b.hidden = true;
    this.escTxt = el('span', 'tx');
    const girar = elIc('button', 'bt com-ic', 'engrenagem', 'Girar');
    girar.addEventListener('click', () => { if (this.escolha) { this.escolha.giro = (this.escolha.giro + 1) & 3; this.ui.som.clique(); } });
    const ok = elIc('button', 'bt verde com-ic', 'martelo', 'Construir aqui');
    ok.addEventListener('click', () => this.confirmarEscolha());
    const nao = elIc('button', 'bt com-ic', 'fechar', 'Cancelar');
    nao.addEventListener('click', () => { this.cancelarEscolha(); this.abrir('obras'); });
    const comprar = elIc('button', 'bt verde com-ic', 'moeda', 'Comprar o que falta');
    comprar.hidden = true;
    comprar.addEventListener('click', () => { if (this.ultimaObra) { this.ui.som.clique(); this.pedirObra({ ...this.ultimaObra, comprar: true }); } });
    this.btComprar = comprar;
    const bts = el('div', 'linha-bts'); bts.append(girar, ok, comprar, nao);
    b.append(this.escTxt, bts);
    $('#hud').appendChild(b);
    this.escBar = b;
  }

  abrir(aba) {
    if (!this.ligado) { this.ui.aviso('Ligue o Mercado nas opções do mundo para ter negócios.', 2500, 'moeda'); return; }
    if (aba) this.aba = aba;
    this.ui.mercado.fechar(true);
    this.w.j.hidden = false;
    this.ui.pausar();
    this.desenhar();
  }
  fechar(semRetomar) { if (this.w.j.hidden) return; this.w.j.hidden = true; if (!semRetomar) this.ui.retomar(); }
  aberto() { return !this.w.j.hidden; }

  desenhar() {
    const w = this.w, e = this.e, hora = horaDe(this.ui.dia());
    w.sub.innerHTML = '';
    w.sub.append(el('span', '', `Agora são ${hhmm(hora)} · trabalham das ${HORA_INI}h às ${HORA_FIM}h · `));
    w.sub.insertAdjacentHTML('beforeend', moedaHtml(e.moedas));
    w.corpo.innerHTML = '';
    const abas = el('div', 'linha-bts econ-abas neg-abas');
    for (const [k, ic, t] of [['equipe', 'amigos', 'Equipe'], ['obras', 'martelo', 'Obras'], ['padaria', 'pao', 'Padaria'], ['loja', 'moeda', 'Loja']]) {
      const b = elIc('button', 'bt com-ic' + (this.aba === k ? ' verde' : ''), ic, t);
      b.dataset.aba = k;
      b.addEventListener('click', () => { this.aba = k; this.ui.som.clique(); this.desenhar(); });
      abas.appendChild(b);
    }
    w.corpo.appendChild(abas);
    if (this.aba === 'equipe') this.desenharEquipe(w.corpo, hora);
    else if (this.aba === 'obras') this.desenharObras(w.corpo, hora);
    else if (this.aba === 'padaria') this.desenharPadaria(w.corpo);
    else this.desenharLoja(w.corpo);
  }

  linha(ic, nome, sub, dir) {
    const l = el('div', 'econ-linha');
    const i = el('span', 'econ-ic');
    if (typeof ic === 'number') i.appendChild(this.ui.icone(ic, 36)); else i.innerHTML = icone(ic);
    const nm = el('span', 'econ-nome', nome);
    if (sub) nm.appendChild(el('small', '', sub));
    l.append(i, nm);
    if (dir) l.appendChild(dir);
    return l;
  }

  desenharEquipe(c, hora) {
    const e = this.e;
    const lista = el('div', 'econ-lista');
    if (!e.equipe.length) lista.appendChild(el('div', 'vazio', 'Ninguém trabalha para você ainda. Toque num morador de uma vila e escolha "Contratar".'));
    for (const x of e.equipe) {
      const s = situacao(e, x, hora), of = OFICIOS[x.of];
      const d = el('span', 'econ-dir');
      d.insertAdjacentHTML('beforeend', `<small>${moedaHtml(x.sal)}/dia</small>`);
      const bt = el('button', 'bt econ-bt', 'Demitir');
      bt.addEventListener('click', () => { this.ui.som.clique(); if (bt.dataset.certo) this.ui.mercado.enviar({ t: 'demitir', id: x.id }); else { bt.dataset.certo = '1'; bt.textContent = 'Certeza?'; } });
      d.appendChild(bt);
      const l = this.linha(of.ic, `${x.nome} · ${of.nome}`, s.txt + (x.feito ? ` · já fez ${x.feito} ${x.of === 'pedreiro' ? 'blocos' : x.of === 'padeiro' ? 'pães' : 'vendas'}` : ''), d);
      if (!s.ativo) l.classList.add('neg-parado');
      lista.appendChild(l);
    }
    c.appendChild(lista);
    c.appendChild(el('p', 'econ-dica', 'O salário é cobrado aos pouquinhos enquanto eles trabalham. Sem moedas, eles param; um dia inteiro sem receber e vão embora. Eles só trabalham enquanto você está no mundo.'));
  }

  desenharObras(c, hora) {
    const e = this.e, so = this.ui.sobrev();
    const pedreiros = e.equipe.filter((x) => x.of === 'pedreiro').length;
    if (!pedreiros) c.appendChild(el('p', 'econ-dica neg-aviso', 'Você ainda não tem pedreiro. Toque num morador de uma vila e contrate um. Dá para marcar a obra antes.'));
    if (e.obras.length) {
      c.appendChild(elIc('h3', 'com-ic', 'martelo', 'Obras'));
      const lista = el('div', 'econ-lista');
      e.obras.forEach((o, i) => {
        const tot = blocosDaObra(o).length, pc = Math.floor(100 * o.i / tot);
        const d = el('span', 'econ-dir');
        const bt = el('button', 'bt econ-bt', 'Cancelar');
        bt.addEventListener('click', () => { this.ui.som.clique(); if (bt.dataset.certo) this.ui.mercado.enviar({ t: 'cancelar-obra', id: o.id }); else { bt.dataset.certo = '1'; bt.textContent = 'Certeza?'; } });
        d.appendChild(bt);
        const l = this.linha(PLANTAS[o.p].ic, `${PLANTAS[o.p].nome} (${ESTILOS_OBRA[o.e].nome})`, i === 0 ? (pedreiros && noHorario(hora) ? `Construindo: ${pc}%` : `Parada: ${pc}%`) : 'Esperando a vez', d);
        const bar = el('span', 'econ-barra'); const bi = el('i'); bi.style.width = pc + '%'; bar.appendChild(bi); l.querySelector('.econ-nome').appendChild(bar);
        lista.appendChild(l);
      });
      c.appendChild(lista);
    }
    if (e.obras.length >= MAX_OBRAS) return;
    c.appendChild(elIc('h3', 'com-ic', 'casa', 'Nova obra'));
    const est = el('div', 'linha-bts econ-abas');
    for (const [k, s] of Object.entries(ESTILOS_OBRA)) {
      const b = el('button', 'bt' + (this.estilo === k ? ' verde' : ''), s.nome);
      b.addEventListener('click', () => { this.estilo = k; this.ui.som.clique(); this.desenhar(); });
      est.appendChild(b);
    }
    c.appendChild(est);
    const lista = el('div', 'econ-lista');
    for (const [id, p] of Object.entries(PLANTAS)) {
      const ja = p.negocio && (e.neg[p.negocio] || e.obras.some((o) => o.p === id));
      const d = el('span', 'econ-dir');
      const bt = elIc('button', 'bt econ-bt' + (ja ? ' fraco' : ' verde'), 'pino', ja ? 'Já tem' : 'Escolher lugar');
      bt.disabled = !!ja;
      bt.dataset.planta = id;
      bt.addEventListener('click', () => { this.ui.som.clique(); this.comecarEscolha(id); });
      d.appendChild(bt);
      let sub = `${p.desc} · ${p.L}x${p.F}`;
      if (so) {
        const mats = materiais(desenhar(id, this.estilo).map((x) => [0, 0, 0, x[3]]));
        const falta = faltaPara(e.itens, mats);
        sub += ' · ' + Object.entries(mats).map(([b, n]) => `${n} ${this.ui.nomeBloco(+b)}`).join(', ');
        if (falta.length) sub += ` · faltam ${falta.reduce((s, [, n]) => s + n, 0)} (o pedreiro compra por ${falta.reduce((s, [, n]) => s + n, 0) * PRECO_MATERIAL} moedas)`;
      } else sub += ' · material por conta da casa';
      lista.appendChild(this.linha(p.ic, p.nome, sub, d));
    }
    c.appendChild(lista);
  }

  desenharPadaria(c) {
    const e = this.e, N = e.neg;
    if (!N.padaria) {
      c.appendChild(el('div', 'vazio', 'Você ainda não tem padaria. Na aba Obras, peça uma Padaria ao pedreiro. Depois contrate um padeiro: ele faz 1 pão com 2 trigos.'));
      return;
    }
    const perto = pertoDe(this.ui.posJog(), N.padaria);
    const padeiros = e.equipe.filter((x) => x.of === 'padeiro').length;
    c.appendChild(el('p', 'econ-dica', `${padeiros ? `${padeiros} padeiro(s) trabalhando.` : 'Sem padeiro: contrate um numa vila.'} Já saíram ${N.assados} pães do forno.${e.equipe.some((x) => x.of === 'lojista') && N.loja ? ' O lojista leva os pães para a vitrine.' : ''}`));
    const lista = el('div', 'econ-lista');
    const bt = (txt, fn, ok = true) => { const b = el('button', 'bt econ-bt' + (ok ? ' verde' : ' fraco'), txt); b.disabled = !ok; b.addEventListener('click', () => { this.ui.som.clique(); fn(); }); return b; };
    for (const [b, k] of [[TRIGO, 'trigo'], [FARINHA, 'farinha'], [PAO, 'pao']]) {
      if (k === 'farinha' && !N.farinha && !(e.itens[FARINHA] > 0)) continue;
      const d = el('span', 'econ-dir');
      const naMochila = e.itens[b] || 0, livre = livreDe(e, b), comprado = naMochila - livre;
      if (k !== 'pao') d.appendChild(bt(`Deixar ${livre}`, () => this.ui.mercado.enviar({ t: 'depositar', onde: 'padaria', b, n: livre }), perto && livre > 0));
      d.appendChild(bt('Pegar', () => this.ui.mercado.enviar({ t: 'retirar', onde: 'padaria', b, n: N[k] }), perto && N[k] > 0));
      lista.appendChild(this.linha(b, this.ui.nomeBloco(b), `Na padaria: ${N[k]} · na mochila: ${naMochila}${k !== 'pao' && comprado ? ` (${comprado} comprado, não serve)` : ''}`, d));
    }
    c.appendChild(lista);
    if (!perto) c.appendChild(el('p', 'econ-dica neg-aviso', 'Para deixar ou pegar coisas, vá até a padaria.'));
    else if (N.trigo < TRIGO_POR_PAO && !N.farinha) c.appendChild(el('p', 'econ-dica neg-aviso', 'Sem trigo o padeiro não trabalha. Colha trigo (ou capim) e deixe aqui.'));
  }

  desenharLoja(c) {
    const e = this.e, N = e.neg;
    if (!N.loja) {
      c.appendChild(el('div', 'vazio', 'Você ainda não tem loja. Na aba Obras, peça uma Loja ao pedreiro. Depois contrate um lojista: ele vende para os moradores o que você deixar na vitrine, pelo dobro do preço da vila.'));
      return;
    }
    const perto = pertoDe(this.ui.posJog(), N.loja);
    const lojistas = e.equipe.filter((x) => x.of === 'lojista').length;
    const p = el('p', 'econ-dica');
    p.innerHTML = `${lojistas ? `${lojistas} lojista(s) atendendo.` : 'Sem lojista: contrate um numa vila.'} Já vendeu ${N.vendas} coisas e ganhou ${moedaHtml(N.ganho)}.`;
    c.appendChild(p);
    c.appendChild(elIc('h3', 'com-ic', 'moeda', 'Na vitrine'));
    const vit = el('div', 'econ-lista');
    const itensV = Object.entries(N.vitrine).filter(([, n]) => n > 0);
    if (!itensV.length) vit.appendChild(el('div', 'vazio', 'Vitrine vazia.'));
    for (const [k, n] of itensV) {
      const d = el('span', 'econ-dir');
      d.insertAdjacentHTML('beforeend', `<small>${moedaHtml(precoLoja(+k))} cada</small>`);
      const b = el('button', 'bt econ-bt', 'Pegar'); b.disabled = !perto;
      b.addEventListener('click', () => { this.ui.som.clique(); this.ui.mercado.enviar({ t: 'retirar', onde: 'loja', b: +k, n }); });
      d.appendChild(b);
      vit.appendChild(this.linha(+k, this.ui.nomeBloco(+k), `×${n}`, d));
    }
    c.appendChild(vit);
    c.appendChild(elIc('h3', 'com-ic', 'mochila', 'Pôr à venda (da mochila)'));
    const moc = el('div', 'econ-lista');
    // só o que você colheu ou fez (o comprado na loja da vila não dá para revender)
    const itens = Object.keys(e.itens).map((k) => [k, livreDe(e, +k)]).filter(([k, n]) => n > 0 && +k < 1000);
    if (!itens.length) moc.appendChild(el('div', 'vazio', Object.keys(e.compra || {}).length ? 'Só tem coisa comprada na mochila. Revender não vale: colha ou faça coisas para pôr à venda.' : 'Sua mochila está vazia.'));
    for (const [k, n] of itens) {
      const d = el('span', 'econ-dir');
      for (const q of [1, n]) {
        if (q === 1 && n === 1 && d.children.length) continue;
        const b = el('button', 'bt econ-bt' + (perto ? ' verde' : ' fraco'), q === n ? `Tudo (${n})` : '1'); b.disabled = !perto;
        b.addEventListener('click', () => { this.ui.som.clique(); this.ui.mercado.enviar({ t: 'depositar', onde: 'loja', b: +k, n: q }); });
        d.appendChild(b);
      }
      moc.appendChild(this.linha(+k, this.ui.nomeBloco(+k), `×${n} · vende por ${precoLoja(+k)}`, d));
    }
    c.appendChild(moc);
    if (!perto) c.appendChild(el('p', 'econ-dica neg-aviso', 'Para mexer na vitrine, vá até a loja.'));
  }

  // ---------- escolher o lugar da obra ----------
  comecarEscolha(p) {
    this.fechar(true);
    this.ui.retomar();
    this.escolha = { p, e: this.estilo, giro: 0, v: Math.random() < 0.5 ? 0 : 1 };
    const pl = PLANTAS[p], h = alturaDaPlanta(p) + 1;
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(pl.L + 2, h, pl.F + 2));
    this.fantasma = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5cd65c, depthTest: false, transparent: true, opacity: 0.9 }));
    this.fantasma.renderOrder = 20;
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(pl.L, pl.F), new THREE.MeshBasicMaterial({ color: 0x5cd65c, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    chao.rotation.x = -Math.PI / 2; chao.position.y = -h / 2 + 1.02;
    // a porta: um tracinho na frente
    const porta = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 0.15), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.7, depthTest: false }));
    this.fantasmaPorta = porta;
    this.fantasma.add(chao, porta);
    this.fantasma.userData = { h, chao };
    this.ui.cena.add(this.fantasma);
    this.escBar.hidden = false;
    this.ui.aviso('Ande e olhe para escolher onde a casa fica. A porta vai ficar virada para você.', 4000, 'pino');
  }

  cancelarEscolha() {
    if (this.fantasma) { this.ui.cena.remove(this.fantasma); this.fantasma.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }); this.fantasma = null; }
    this.escolha = null;
    if (this.escBar) this.escBar.hidden = true;
    if (this.btComprar) this.btComprar.hidden = true;
    this.ultimaObra = null;
  }

  // chão de verdade (sem contar árvores e plantinhas, que o pedreiro tira)
  chao(x, z) {
    const m = this.ui.mundo();
    let y = m.chao(x, z);
    while (y > 1) { const b = m.bloco(x, y, z); if (!ARVORE.has(b) && !PLANTA[b] && (SOLIDO[b] || AGUA[b])) break; y--; }
    return y;
  }

  // lugar da obra na frente do jogador: porta a 3 blocos, virada para ele
  lugarDaEscolha(jog) {
    const es = this.escolha;
    const fx = -Math.sin(jog.yaw), fz = -Math.cos(jog.yaw);
    let r = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 0 : 2) : (fz > 0 ? 1 : 3);
    r = (r + es.giro) & 3;
    const [dx, dz] = DIRS[r];
    const px = Math.floor(jog.pos.x), pz = Math.floor(jog.pos.z);
    // a porta fica a 3 blocos na direção do olhar (girar não mexe na porta: a casa gira em volta dela)
    const [lx, lz] = Math.abs(fx) > Math.abs(fz) ? [Math.sign(fx), 0] : [0, Math.sign(fz)];
    const x = px + lx * 3, z = pz + lz * 3;
    let y = this.chao(x, z);
    if (y < 1) y = Math.floor(jog.pos.y) - 1;
    return { p: es.p, e: es.e, v: es.v, x, y, z, r, dx, dz };
  }

  atualizarEscolha(jog) {
    const o = this.lugarDaEscolha(jog);
    this.escolha.o = o;
    const pl = PLANTAS[o.p], pos = noMundo(o.p, o.x, o.y, o.z, o.r);
    const a = pos(-1, 0, -1), b = pos(pl.L, 0, pl.F);
    const cx = (a[0] + b[0]) / 2 + 0.5, cz = (a[2] + b[2]) / 2 + 0.5;
    const { h } = this.fantasma.userData;
    this.fantasma.position.set(cx, o.y + h / 2, cz);
    this.fantasma.rotation.y = o.r % 2 === 0 ? Math.PI / 2 : 0;
    // tracinho da porta: na parede da frente
    const fr = pos((pl.L - 1) / 2, 0, 0);
    this.fantasmaPorta.position.set(fr[0] + 0.5 - cx, -h / 2 + 2, fr[2] + 0.5 - cz);
    this.fantasmaPorta.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.fantasma.rotation.y);
    const prob = this.problemaDaEscolha(o);
    this.escolha.prob = prob;
    const cor = prob ? 0xe8433f : 0x5cd65c;
    this.fantasma.material.color.setHex(cor);
    this.fantasma.userData.chao.material.color.setHex(cor);
    this.escTxt.textContent = prob || `${pl.nome}: a porta fica no amarelo`;
  }

  problemaDaEscolha(o) {
    const e = this.e;
    const nao = obraCabe(e, o);
    if (nao) return nao;
    // não pode cair na água nem num barranco muito alto
    const mundo = this.ui.mundo(), [x0, z0, x1, z1] = areaDaObra(o);
    let agua = 0, pior = 0;
    for (let x = x0; x <= x1; x += 2) for (let z = z0; z <= z1; z += 2) {
      const h = this.chao(x, z);
      if (AGUA[mundo.bloco(x, h, z)]) agua++;
      pior = Math.max(pior, Math.abs(h - o.y));
    }
    if (agua > 2) return 'Aqui tem água: escolha terra firme.';
    if (pior > 5) return 'O chão aqui é torto demais.';
    return null;
  }

  confirmarEscolha() {
    const es = this.escolha;
    if (!es || !es.o) return;
    if (es.prob) { this.ui.aviso(es.prob, 2200, 'pino'); return; }
    const { p, e, v, x, y, z, r } = es.o;
    this.ui.som.clique();
    this.pedirObra({ t: 'obra', p, e, v, x, y, z, r });
  }

  pedirObra(acao) {
    this.ultimaObra = acao;
    this.ui.mercado.enviar(acao);
  }

  // a resposta da obra: deu certo (some o fantasma) ou falta material (oferece comprar)
  respostaObra(ok, erro) {
    if (!this.ultimaObra || !this.escolha) return;
    if (ok) { this.cancelarEscolha(); this.ultimaObra = null; return; }
    if (erro && erro.falta && erro.falta.length) {
      const total = erro.falta.reduce((s, [, n]) => s + n, 0);
      this.falta = erro.falta.map(([b, n]) => `${n} ${this.ui.nomeBloco(b)}`).join(', ');
      this.btComprar.hidden = false;
      this.btComprar.innerHTML = comIcone('moeda', `Comprar o que falta (${total * PRECO_MATERIAL})`);
      this.ui.aviso(`Faltam ${this.falta}. O pedreiro pode comprar para você.`, 4000, 'mochila');
    }
  }
}

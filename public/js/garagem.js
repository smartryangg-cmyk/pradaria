// Garagem e direção: escolher um veículo, entrar, dirigir com o joystick, buzinar, levar amigos e guardar.
// Fica fora do main.js; o main só chama os ganchos (comecar, tocar, quadro, camera, rede...).
import * as THREE from '../vendor/three.module.min.js';
import { Veiculos, TIPOS, ORDEM, CORES_VEICULO } from './veiculos.js';
import { SOLIDO, AGUA, B } from './blocos.js';
import { montarBoneco, caixa, juntar, matModelo } from './modelos.js';
import { opcoesMundo } from './opcoes-mundo.js';
import { icone } from './icones.js';
import { LugaresVeiculos } from './lugares-veiculos.js';
import { PRECO_VEICULO, RECEITA_VEICULO, VEICULOS_LIVRES, temVeiculo, precoServico, estadoDaGaragem } from './economia.js';

const $ = (s) => document.querySelector(s);
const MAX_LOCAL = 40;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const PERTO_POSTO = 6.5; // distância (centro do veículo até o posto) para abastecer/consertar
const moedaHtml = (n) => `<span class="econ-m">${icone('moeda')}<span>${n}</span></span>`;

// posto: chão de concreto, cobertura, bomba de gasolina, carregador e a placa da oficina (só enfeite: não é sólido)
let geoPosto = null;
function montarPosto() {
  if (!geoPosto) {
    const c = caixa, CIM = 0xb9b4aa, TETO = 0xf4f4f4, VERM = 0xe53935, AZUL = 0x1e88e5, PRETO = 0x333333, AMAR = 0xfdd835;
    geoPosto = juntar([
      c(5.2, 0.12, 6.2, CIM, 0, 0.06, 0),
      ...[[-2.3, -2.8], [2.3, -2.8], [-2.3, 2.8], [2.3, 2.8]].map(([x, z]) => c(0.22, 3.7, 0.22, TETO, x, 1.95, z)),
      c(5.4, 0.3, 6.4, TETO, 0, 3.9, 0), c(5.44, 0.14, 6.44, VERM, 0, 3.72, 0),
      // ilha das bombas no meio
      c(0.9, 0.25, 2.6, CIM, 0, 0.2, 0),
      c(0.6, 1.4, 0.5, VERM, 0, 1.0, -0.7), c(0.5, 0.35, 0.06, 0xbfe6ff, 0, 1.35, -0.98), c(0.08, 0.5, 0.08, PRETO, 0.34, 0.8, -0.7),
      c(0.6, 1.4, 0.5, AZUL, 0, 1.0, 0.7), c(0.5, 0.35, 0.06, 0xbfe6ff, 0, 1.35, 0.98), c(0.14, 0.14, 0.14, AMAR, 0, 1.85, 0.7),
      // placa alta
      c(0.18, 4.6, 0.18, PRETO, 3.3, 2.3, -3.3), c(1.4, 1.1, 0.16, VERM, 3.3, 4.9, -3.3), c(1.0, 0.7, 0.18, AMAR, 3.3, 4.9, -3.3),
      // garagem do lado: galpão aberto na frente, quadro de chaves na parede do fundo
      c(5.6, 0.12, 6.2, CIM, -6, 0.06, 0),
      c(0.2, 3.6, 6.2, 0xd9c8a5, -8.7, 1.8, 0), ...[-2.9, 2.9].map((z) => c(5.6, 3.6, 0.2, 0xd9c8a5, -6, 1.8, z)),
      c(6.0, 0.3, 6.6, AZUL, -6, 3.75, 0),
      c(0.08, 1.0, 1.6, 0x8a5a2b, -8.56, 1.7, 0), ...[-0.5, 0, 0.5].map((z) => c(0.1, 0.22, 0.12, AMAR, -8.5, 1.8, z)),
      c(0.16, 0.9, 2.4, AMAR, -3.15, 3.2, 0), c(0.18, 0.5, 1.4, PRETO, -3.1, 3.2, 0),
    ]);
  }
  const m = new THREE.Mesh(geoPosto, matModelo);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export class Garagem {
  // J: { cena, camera, som, aviso, corBoneco(), sala(), euId(), outros, jog(), ctrl(), mundo(), bichos(), aldeoes(), pausar(bool) }
  constructor(J) {
    this.J = J;
    this.veic = null;
    this.dentro = null; // { v, a }
    this.meuBoneco = null;
    this.corSel = 0;
    this.pedido = 0;
    this.acumRede = 0;
    this.tempoOlhar = 0;
    this.ultYaw = 0; this.ultPitch = 0;
    // filtro de quais tipos aparecem na garagem (ex.: modo história libera por era). Chaves: ORDEM de veiculos.js
    this.permitido = (tipo) => true; // eslint-disable-line no-unused-vars
    this.postos = new Map(); // k -> { x, y, z, malha }
    this.criados = new Set(); // veículos de vila/porto que já apareceram neste mundo (não voltam a aparecer)
    this.pedidosP = new Set();
    this.tempoLugares = 0;
    this.escolhido = null; // tipo aberto na garagem (para comprar/montar)
    this.montarTela();
    addEventListener('keydown', (e) => {
      if (!this.veic || e.target.tagName === 'INPUT' || e.repeat) return;
      if (e.code === 'KeyV') { if (this.dentro) this.sair(); else { const v = this.pertoDeMim(); if (v) this.pedirEntrar(v); } }
      else if (e.code === 'KeyH') this.buzinar();
      else if (e.code === 'KeyG') this.abrir(this.garagemPerto() ? 'garagem' : 'celular');
    });
  }

  get eu() { return this.J.sala() ? this.J.euId() : 'eu'; }

  // ---------- tela ----------
  montarTela() {
    const topo = $('#topo');
    // celular: chama um veículo que você tem a chave (os veículos não ficam num menu: a garagem é um lugar no mundo)
    const bt = document.createElement('button');
    bt.id = 'bt-celular'; bt.className = 'redondo'; bt.setAttribute('aria-label', 'Celular: chamar meu veículo'); bt.innerHTML = icone('celular');
    bt.addEventListener('click', () => this.abrir('celular'));
    topo.insertBefore(bt, $('#status-linha') || $('#status'));

    const hud = $('#hud');
    const caixa = document.createElement('div');
    caixa.id = 'veic-botoes';
    caixa.innerHTML = `
      <div id="velo" hidden><b>0</b><small>km/h</small>
        <div class="medidor" id="med-comb"><span class="ic-m"></span><i><u></u></i></div>
        <div class="medidor" id="med-dano"><span class="ic-m">${icone('ferramenta')}</span><i><u></u></i></div>
      </div>
      <div id="veic-posto" hidden>
        <button id="bt-abastecer" class="pilula verde"></button>
        <button id="bt-consertar" class="pilula"></button>
      </div>
      <button id="bt-veic-entrar" class="pilula" hidden></button>
      <button id="bt-garagem-lugar" class="pilula" hidden>${icone('chave')}Garagem</button>
      <div id="veic-dentro" hidden>
        <button id="bt-veic-guardar" class="pilula fraca" title="Guardar o veículo">${icone('estacionar')}Guardar</button>
        <button id="bt-veic-sair" class="pilula" title="Descer (V)">${icone('sair')}Descer</button>
        <button id="bt-buzina" class="redondo grande" aria-label="Buzina (H)">${icone('buzina')}</button>
      </div>`;
    hud.appendChild(caixa);
    const toque = (el, fn) => { el.addEventListener('click', (e) => { e.stopPropagation(); this.J.som.iniciar(); fn(); }); };
    toque($('#bt-veic-entrar'), () => { const v = this.pertoDeMim(); if (v) this.pedirEntrar(v); });
    toque($('#bt-veic-sair'), () => this.sair());
    toque($('#bt-veic-guardar'), () => this.guardar());
    toque($('#bt-abastecer'), () => this.servico('comb'));
    toque($('#bt-garagem-lugar'), () => this.abrir('garagem'));
    toque($('#bt-consertar'), () => this.servico('conserto'));
    $('#bt-buzina').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.buzinar(); }, { passive: false });
    $('#bt-buzina').addEventListener('mousedown', (e) => { e.stopPropagation(); this.buzinar(); });

    const jan = document.createElement('div');
    jan.id = 'garagem'; jan.className = 'janela'; jan.hidden = true;
    jan.innerHTML = `<div class="caixa">
      <h2 id="garagem-titulo">Garagem</h2>
      <p class="sub" id="garagem-sub">Escolha a cor e o veículo. Ele aparece na sua frente!</p>
      <div id="garagem-cores"></div>
      <div id="garagem-compra" hidden></div>
      <div id="garagem-grade"></div>
      <button class="bt" id="garagem-fechar">Fechar</button>
    </div>`;
    document.body.appendChild(jan);
    const cores = $('#garagem-cores');
    CORES_VEICULO.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.style.background = hex(c); b.setAttribute('aria-label', 'Cor ' + (i + 1));
      if (i === 0) b.classList.add('sel');
      b.addEventListener('click', () => { this.corSel = i; this.J.som.clique(); cores.querySelectorAll('button').forEach((x, k) => x.classList.toggle('sel', k === i)); });
      cores.appendChild(b);
    });
    const grade = $('#garagem-grade');
    for (const t of ORDEM) {
      const d = TIPOS[t];
      const b = document.createElement('button');
      b.className = 'veiculo'; b.dataset.tipo = t;
      b.innerHTML = `<span class="ic"></span><span class="nm"></span><small></small><em class="preco"></em>`;
      b.querySelector('.ic').innerHTML = icone(t);
      b.querySelector('.nm').textContent = d.nome;
      b.querySelector('small').textContent = d.assentos.length === 1 ? '1 lugar' : d.assentos.length + ' lugares';
      b.addEventListener('click', () => {
        this.J.som.clique();
        if (this.modo === 'celular') { this.fechar(); this.chamar(t); return; }
        if (!this.meu(t)) { this.escolhido = t; this.desenharGaragem(); return; }
        this.fechar(); this.novo(t, this.corSel);
      });
      grade.appendChild(b);
    }
    $('#garagem-fechar').addEventListener('click', () => this.fechar());
  }

  // modo 'garagem' (só no lugar: o posto/garagem de uma vila) ou 'celular' (chamar um veículo que você tem a chave)
  abrir(modo = 'garagem') {
    if (!this.veic || !this.ligados()) return;
    if (modo === 'garagem' && !this.garagemPerto()) { this.J.aviso('A garagem fica no posto das vilas. Pelo celular você chama os veículos que já tem', 3000, 'celular'); return; }
    if (document.pointerLockElement) document.exitPointerLock();
    this.modo = modo;
    let algum = false;
    for (const b of document.querySelectorAll('#garagem-grade .veiculo')) {
      const t = b.dataset.tipo;
      b.hidden = !this.permitido(t) || (modo === 'celular' && !this.meu(t));
      algum = algum || !b.hidden;
    }
    if (!algum) { this.J.aviso('Ainda não existem veículos nesta época', 2200, 'ampulheta'); return; }
    $('#garagem-titulo').innerHTML = modo === 'celular' ? icone('celular') + 'Celular' : icone('chave') + 'Garagem';
    $('#garagem-cores').hidden = false;
    this.escolhido = null;
    this.desenharGaragem();
    $('#garagem').hidden = false;
    this.J.pausar(true);
  }

  // ---------- mercado: comprar com moedas ou montar com o que se coletou ----------
  mercado() { return this.J.mercado ? this.J.mercado() : null; }
  comMercado() { const m = this.mercado(); return !!(m && m.op.mercado); }
  meu(tipo) { const m = this.mercado(); return !m || temVeiculo(m.e, tipo); }
  garagemPerto() {
    const p = this.J.jog().pos;
    for (const g of this.postos.values()) if (Math.hypot(g.x - p.x, g.z - p.z) < 11 && Math.abs(g.y - p.y) < 6) return g;
    return null;
  }
  // veículo meu (tem a chave): sem internet tudo que saiu da garagem; online o dono é a conta
  ehMeu(v) {
    if (!v.dono) return false;
    if (!this.J.sala()) return true;
    const id = this.J.euId() || '';
    return v.dono === id.slice(0, id.lastIndexOf('-'));
  }

  // celular: o veículo vem até você (se já estiver no mundo e vazio, ele sai de onde está)
  chamar(tipo) {
    if (!this.meu(tipo) || !this.permitido(tipo)) return;
    const d = TIPOS[tipo];
    const lá = [...this.veic.mapa.values()].find((v) => v.tipo === tipo && this.ehMeu(v));
    if (lá && this.dentro && this.dentro.v === lá) { this.J.aviso('Você já está nele!', 1500, tipo); return; }
    if (lá && lá.ocup.some(Boolean)) { this.J.aviso(`Alguém está usando o seu ${d.nome.toLowerCase()} agora`, 2200, tipo); return; }
    this.J.aviso(`Chamando: o ${d.nome.toLowerCase()} chega em instantes`, 2200, 'celular');
    this.J.som.clique();
    const cor = lá ? lá.cor : this.corSel;
    clearTimeout(this._chamada);
    this._chamada = setTimeout(() => {
      if (!this.veic) return;
      if (lá && this.veic.mapa.has(lá.id) && !lá.ocup.some(Boolean)) {
        if (this.J.sala()) this.J.sala().enviar({ t: 'vguardar', id: lá.id });
        else { const m = this.mercado(); if (m) m.guardarVeiculo(tipo, [lá.comb, lá.dano]); this.veic.remover(lá.id); }
      }
      setTimeout(() => this.novo(tipo, cor), this.J.sala() ? 1600 : 0); // a sala só deixa criar um a cada 1,5 s
    }, 1800);
  }

  desenharGaragem() {
    const m = this.mercado(), loja = this.comMercado();
    $('#garagem-sub').innerHTML = this.modo === 'celular'
      ? 'Os veículos que você tem a chave. Toque num e ele vem até você!'
      : loja
        ? `Você tem ${moedaHtml(m.e.moedas)}. Com a chave, o veículo sai daqui; os outros você compra ou monta com o que coletou.`
        : 'Pegue a chave do veículo que quiser. Depois é só chamar pelo celular!';
    for (const b of document.querySelectorAll('#garagem-grade .veiculo')) {
      const t = b.dataset.tipo, meu = this.meu(t), pr = b.querySelector('.preco');
      b.classList.toggle('trancado', !meu);
      b.classList.toggle('sel', this.escolhido === t);
      pr.innerHTML = meu ? icone('chave') : !loja ? 'pegar chave' : icone('cadeado') + PRECO_VEICULO[t];
    }
    const caixa = $('#garagem-compra');
    const t = this.escolhido;
    caixa.hidden = !t || this.meu(t) || this.modo === 'celular';
    if (caixa.hidden) return;
    if (!loja) {
      // sem mercado: a chave é de graça, mas só aqui na garagem
      caixa.innerHTML = `<div class="gc-topo">${icone(t)}<b>${TIPOS[t].nome}</b></div>
        <div class="gc-linhas"><button class="bt verde" id="gc-chave">${icone('chave')}Pegar a chave</button></div>`;
      caixa.querySelector('#gc-chave').addEventListener('click', () => { this.J.som.clique(); m.veiculo({ t: 'chave', tipo: t }); this.depoisDeComprar(t); });
      return;
    }
    const preco = PRECO_VEICULO[t], rec = RECEITA_VEICULO[t] || {};
    const temTudo = Object.entries(rec).every(([b, n]) => (m.e.itens[b] || 0) >= n);
    caixa.innerHTML = `<div class="gc-topo">${icone(t)}<b>${TIPOS[t].nome}</b></div>
      <div class="gc-linhas">
        <button class="bt ${m.e.moedas >= preco ? 'verde' : ''}" id="gc-comprar">Comprar por ${moedaHtml(preco)}</button>
        <div class="gc-montar"><span>Ou monte com:</span><span class="gc-rec"></span>
          <button class="bt ${temTudo ? 'verde' : ''}" id="gc-montar">${icone('ferramenta')}Montar</button></div>
      </div>`;
    const lista = caixa.querySelector('.gc-rec');
    const ui = m.ui;
    for (const [b, n] of Object.entries(rec)) {
      const tem = m.e.itens[b] || 0;
      const s = document.createElement('span');
      s.className = 'gc-item' + (tem >= n ? ' ok' : '');
      if (ui.icone) s.appendChild(ui.icone(+b, 24));
      s.appendChild(document.createTextNode(`${Math.min(tem, n)}/${n}`));
      s.title = ui.nomeBloco ? ui.nomeBloco(+b) : '';
      lista.appendChild(s);
    }
    caixa.querySelector('#gc-comprar').addEventListener('click', () => {
      this.J.som.clique();
      if (m.e.moedas < preco) { this.J.aviso(`Faltam ${preco - m.e.moedas} moedas. Venda coisas na loja da vila!`, 2400, 'moeda'); return; }
      m.veiculo({ t: 'comprarV', tipo: t });
      this.depoisDeComprar(t);
    });
    caixa.querySelector('#gc-montar').addEventListener('click', () => {
      this.J.som.clique();
      if (!temTudo) { this.J.aviso('Faltam materiais. Quebre blocos pelo mundo para juntar!', 2400, 'ferramenta'); return; }
      m.veiculo({ t: 'montarV', tipo: t });
      this.depoisDeComprar(t);
    });
  }
  // sem internet a compra é na hora; online espera a sala responder (mercado.recebeu chama mudouEcon)
  depoisDeComprar(t) { this._comprando = t; this.mudouEcon(); }
  mudouEcon() {
    if (!$('#garagem').hidden) this.desenharGaragem();
    const t = this._comprando;
    if (t && this.meu(t)) {
      this._comprando = null; this.escolhido = null;
      this.J.aviso(`A chave do ${TIPOS[t].nome.toLowerCase()} é sua! Pelo celular você chama ele de qualquer lugar`, 3000, 'chave');
      this.fechar(); this.novo(t, this.corSel);
    }
  }
  fechar() { $('#garagem').hidden = true; this.J.pausar(false); }

  ligados() { return opcoesMundo.veiculos !== false; }

  // ---------- ciclo do mundo ----------
  comecar(mundo, salvos = [], criados = []) {
    this.parar();
    this.veic = new Veiculos(this.J.cena, mundo, this.J.som);
    this.lugares = new LugaresVeiculos(mundo);
    this.criados = new Set(Array.isArray(criados) ? criados : []);
    this.pedidosP = new Set();
    this.tempoLugares = 0;
    // estradas de pedra da Ilha de Aventura contam como estrada
    this.veic.estradaExtra = (x, y, z, b) => !!mundo.aventura && (b === B.PEDRA || b === B.LA_BRANCA) && mundo.aventura.naEstrada(x, z);
    this.veic.aoAcabar = (v, como) => this.acabou(v, como);
    this.veic.aoBater = (v, quanto, quebrou) => this.bateu(v, quanto, quebrou);
    for (const s of salvos || []) { const v = this.veic.criar(s); if (v && v.parado) this.criados.add(v.parado); }
    for (const v of this.veic.mapa.values()) { const n = parseInt(String(v.id).slice(1), 10); if (n >= this.veic.seq) this.veic.seq = n + 1; }
    $('#bt-celular').hidden = !this.ligados();
    this.atualizarHud();
  }

  parar() {
    if (this.dentro) this.sairLocal(true);
    if (this.veic) { for (const o of this.J.outros.values()) o.sentado = false; this.veic.limpar(); }
    for (const p of this.postos.values()) this.J.cena.remove(p.malha);
    this.postos.clear();
    this.veic = null;
    this.J.som.motor(null);
    $('#bt-veic-entrar').hidden = true;
    $('#garagem').hidden = true;
  }

  lista() { return this.veic ? this.veic.lista() : []; }
  listaCriados() { return [...this.criados]; }

  // ---------- ações ----------
  novo(tipo, cor) {
    if (!TIPOS[tipo] || !this.permitido(tipo) || !this.ligados()) return;
    if (!this.meu(tipo)) { this.J.aviso('Você ainda não tem a chave. Pegue na garagem de uma vila', 2600, 'chave'); return; }
    const jog = this.J.jog(), d = TIPOS[tipo];
    if (this.dentro) this.sair();
    // tenta na frente; se não couber (penhasco, parede), dos lados e atrás
    let yaw = 0, lugar = null;
    for (const giro of [0, -Math.PI / 2, Math.PI / 2, Math.PI]) {
      const olhar = jog.yaw + giro;
      yaw = Math.round(olhar / (Math.PI / 2)) * (Math.PI / 2);
      lugar = this.acharLugar(d, jog.pos, -Math.sin(olhar), -Math.cos(olhar), yaw);
      if (lugar) break;
    }
    if (!lugar) { this.J.aviso((d.meio === 'agua' || d.meio === 'sub') ? 'Barco e submarino precisam de água bem pertinho' : 'Não cabe aqui. Tente num lugar mais aberto', 2600, (d.meio === 'agua' || d.meio === 'sub') ? 'gota' : tipo); return; }
    if (this.J.sala()) {
      this.pedido = Math.floor(Math.random() * 1e9);
      this.J.sala().enviar({ t: 'vnovo', tipo, cor, p: lugar, r: yaw, n: this.pedido });
    } else {
      // limite de veículos no mundo: o mais antigo vazio vai embora
      if (this.veic.mapa.size >= MAX_LOCAL) for (const v of this.veic.mapa.values()) if (!v.ocup.some(Boolean)) { this.veic.remover(v.id); break; }
      // sai da garagem como foi guardado (o mecânico da garagem abastece e conserta aos poucos)
      const m = this.mercado();
      const [c, dn] = estadoDaGaragem(m && m.e, tipo, Date.now());
      const v = this.veic.criar({ id: 'L' + this.veic.seq++, tipo, cor, p: lugar, r: yaw, c, d: dn, dono: 'eu' });
      this.entrar(v, 0);
    }
  }

  acharLugar(d, pos, fx, fz, yaw) {
    const m = this.J.mundo();
    const prova = { d, x: 0, y: 0, z: 0, yaw };
    const testar = (x, z, y0) => {
      for (let y = y0; y <= y0 + 1; y++) if (!this.veic.colide(prova, x, y, z, yaw)) return y;
      return null;
    };
    for (let dist = d.L / 2 + 1.2; dist < ((d.meio === 'agua' || d.meio === 'sub') ? 24 : d.L / 2 + 6); dist += 1) {
      const x = pos.x + fx * dist, z = pos.z + fz * dist;
      const bx = Math.floor(x), bz = Math.floor(z);
      let topo = null, agua = false;
      for (let by = Math.floor(pos.y) + 4; by > pos.y - 12 && by > 0; by--) {
        const b = m.bloco(bx, by, bz);
        if (SOLIDO[b] || AGUA[b]) { topo = by + 1; agua = !!AGUA[b]; break; }
      }
      if (topo === null) continue;
      if ((d.meio === 'agua' || d.meio === 'sub') && !agua) continue;
      const y = testar(x, z, agua ? topo - 1 : topo);
      if (y !== null) return [+x.toFixed(2), y, +z.toFixed(2)];
    }
    return null;
  }

  pertoDeMim() {
    if (!this.veic || this.dentro) return null;
    const p = this.J.jog().pos;
    return this.veic.maisPerto(p.x, p.y, p.z);
  }

  // toque no veículo: entra. Retorna true se usou o toque.
  tocar(o, dir, max) {
    if (!this.veic) return false;
    if (this.dentro) return true; // dirigindo, os toques não colocam blocos
    const h = this.veic.atingir(o, dir, max);
    if (!h) return false;
    this.pedirEntrar(h.veiculo);
    return true;
  }
  // distância até o veículo mirado (para não colocar bloco atrás dele)
  mirado(o, dir, max) { return this.veic ? this.veic.atingir(o, dir, max) : null; }

  pedirEntrar(v) {
    if (!v.ocup.includes(null)) { this.J.aviso('Está cheio!', 1500, 'amigos'); return; }
    if (this.J.sala()) this.J.sala().enviar({ t: 'ventrar', id: v.id });
    else this.entrar(v, v.ocup.indexOf(null));
  }

  entrar(v, a) {
    const J = this.J, jog = J.jog();
    if (!this.meuBoneco) this.meuBoneco = montarBoneco(J.corBoneco());
    this.veic.ocupar(v, a, this.eu, this.meuBoneco);
    this.dentro = { v, a };
    this._esperado = null;
    jog.voando = false; jog.vel.x = jog.vel.y = jog.vel.z = 0;
    jog.yaw = 0; jog.pitch = -0.22;
    this.ultYaw = 0; this.ultPitch = jog.pitch;
    document.body.classList.add('dirigindo');
    $('#bt-voar').classList.remove('ligado');
    J.som.porta();
    const d = v.d;
    if (a === 0) J.aviso(d.meio === 'ar' ? 'Acelere numa rua ou estrada para decolar e use as setas para subir e descer' : d.meio === 'helice' ? 'Use as setas para subir e descer' : d.meio === 'sub' ? 'Use as setas para afundar e voltar para a superfície' : 'Use o joystick para dirigir', 3000, v.tipo);
    else J.aviso('Você é passageiro! Aproveite o passeio', 2200, v.tipo);
    this.atualizarHud();
  }

  sair() {
    if (!this.dentro) return;
    if (this.J.sala()) this.J.sala().enviar({ t: 'vsair' });
    this.sairLocal();
  }

  sairLocal(semSom = false) {
    const { v, a } = this.dentro;
    const jog = this.J.jog();
    const yawAbs = v.yaw + jog.yaw;
    this.veic.desocupar(v, a);
    if (this.meuBoneco) this.J.cena.remove(this.meuBoneco.grupo);
    this.dentro = null;
    if (jog) {
      const p = this.veic.lugarDescer(v, jog);
      Object.assign(jog.pos, p);
      jog.vel.x = jog.vel.y = jog.vel.z = 0;
      jog.yaw = yawAbs; jog.pitch = 0;
    }
    document.body.classList.remove('dirigindo');
    $('#bt-descer').hidden = true;
    this.J.som.motor(null);
    if (!semSom) this.J.som.porta();
    this.atualizarHud();
  }

  guardar() {
    if (!this.dentro) return;
    const { v } = this.dentro;
    if (v.parado) { this.J.aviso('Este veículo mora aqui. Deixe ele estacionado para os outros', 2200, 'estacionar'); return; }
    if (v.ocup.some((q, i) => q && q !== this.eu && i !== this.dentro.a)) { this.J.aviso('Espere todo mundo descer', 1800, 'amigos'); return; }
    if (this.J.sala()) { this.J.sala().enviar({ t: 'vguardar', id: v.id }); this.sair(); return; }
    const m = this.mercado();
    if (m) m.guardarVeiculo(v.tipo, [v.comb, v.dano]);
    this.sairLocal();
    this.veic.remover(v.id);
    this.J.aviso('Veículo guardado. Na garagem ele é abastecido e consertado aos poucos', 2400, 'estacionar');
  }

  buzinar() {
    if (!this.dentro) return;
    this.veic.buzinar(this.dentro.v, 1);
    if (this.J.sala()) this.J.sala().enviar({ t: 'buzina', id: this.dentro.v.id });
  }

  atualizarHud() {
    const dentro = !!this.dentro, motorista = dentro && this.dentro.a === 0;
    $('#veic-dentro').hidden = !dentro;
    $('#bt-buzina').hidden = !motorista;
    $('#bt-veic-guardar').hidden = !motorista || !!this.dentro.v.parado;
    $('#velo').hidden = !motorista;
    if (motorista) {
      const d = this.dentro.v.d;
      $('#med-comb').hidden = $('#med-dano').hidden = !d.energia;
      $('#med-comb .ic-m').innerHTML = icone(d.energia === 'bateria' ? 'bateria' : 'combustivel');
    }
    if (!motorista) $('#veic-posto').hidden = true;
    if (dentro) {
      const voa = motorista && ['ar', 'helice', 'sub'].includes(this.dentro.v.d.meio);
      $('#bt-descer').hidden = !voa;
      $('#bt-pular').hidden = !voa;
      $('#bt-pular').setAttribute('aria-label', voa ? 'Subir' : 'Pular');
    } else $('#bt-pular').hidden = false;
  }

  // ---------- quadro a quadro ----------
  // chamado antes da física do jogador; retorna true quando o jogador está num veículo
  quadro(dt, ent, pausado) {
    if (!this.veic) return false;
    const J = this.J, jog = J.jog();
    // alguém teleportou o jogador (comandos, desmaio): desce do veículo e fica lá
    if (this.dentro && this._esperado && Math.hypot(jog.pos.x - this._esperado.x, jog.pos.y - this._esperado.y, jog.pos.z - this._esperado.z) > 3) {
      const p = { x: jog.pos.x, y: jog.pos.y, z: jog.pos.z }, yaw = this.dentro.v.yaw + jog.yaw;
      this.sair();
      Object.assign(jog.pos, p); jog.yaw = yaw;
    }
    const meu = this.dentro && this.dentro.a === 0 ? this.dentro.v : null;
    if (meu && !pausado) {
      const obst = [];
      for (const b of J.bichos().lista) obst.push(b);
      const al = J.aldeoes();
      if (al) for (const a of al.lista) obst.push(a);
      for (const o of J.outros.values()) if (!o.sentado) obst.push(o.grupo.position);
      this.veic.dirigir(meu, dt, { frente: ent.frente, lado: ent.lado, subir: ent.pular, descer: ent.descer }, obst);
      const d = meu.d;
      J.som.motor(this.veic.quebrado(meu) || this.veic.semEnergia(meu) ? 0.05 : Math.min(1, Math.abs(meu.vel) / d.vmax), d.grave || 1, d.som);
      $('#velo b').textContent = Math.round(Math.abs(meu.vel) * 3.6);
      this.medidores(meu);
      this.verPosto(meu, dt);
      // avião fora da pista: avisa uma vez que precisa de rua ou estrada para decolar
      if (d.meio === 'ar' && meu.noChao && !meu.naEstrada && ent.frente > 0.5 && Math.abs(meu.vel) > d.vmax * d.terreno * 0.9) {
        this._semPista = (this._semPista || 0) + dt;
        if (this._semPista > 1.5 && !this._avisouPista) { this._avisouPista = true; J.aviso('Para decolar o avião precisa de pista: acelere numa rua ou estrada', 3200, 'aviao'); }
      } else this._semPista = 0;
      // rede: posição do veículo ~10x por segundo
      const sala = J.sala();
      if (sala) {
        this.acumRede += dt;
        if (this.acumRede > 0.1) {
          this.acumRede = 0;
          sala.enviar({ t: 'vmov', id: meu.id, p: [+meu.x.toFixed(2), +meu.y.toFixed(2), +meu.z.toFixed(2)], r: [+meu.yaw.toFixed(3), +meu.pitch.toFixed(2), +meu.roll.toFixed(2)], s: +meu.vel.toFixed(1), c: +meu.comb.toFixed(3), d: +meu.dano.toFixed(3) });
        }
      }
    } else if (this.dentro) {
      const v = this.dentro.v;
      J.som.motor(v.ocup[0] ? Math.min(1, Math.abs(v.vel) / v.d.vmax) : null, v.d.grave || 1, v.d.som);
    }
    this.veic.atualizar(dt, meu, jog.pos);
    // postos e veículos das vilas/portos em volta (a cada segundo e meio)
    this.tempoLugares -= dt;
    if (this.tempoLugares <= 0) { this.tempoLugares = 1.5; this.olharLugares(jog.pos); }

    if (this.dentro) {
      // o jogador "fica" no assento (para carregar o mundo e os bichos em volta)
      const p = this.veic.posAssento(this.dentro.v, this.dentro.a);
      jog.pos.x = p.x; jog.pos.y = p.y - 0.75; jog.pos.z = p.z;
      this._esperado = { x: jog.pos.x, y: jog.pos.y, z: jog.pos.z };
      // a câmera volta para trás do veículo quando ninguém está mexendo nela
      const mexeu = Math.abs(jog.yaw - this.ultYaw) > 1e-4 || Math.abs(jog.pitch - this.ultPitch) > 1e-4;
      this.tempoOlhar = mexeu ? 1.2 : Math.max(0, this.tempoOlhar - dt);
      if (!this.tempoOlhar && Math.abs(this.dentro.v.vel) > 1.5) {
        jog.yaw -= jog.yaw * Math.min(1, dt * 1.8);
        jog.pitch += (-0.22 - jog.pitch) * Math.min(1, dt * 1.8);
      }
      jog.yaw = ((jog.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      jog.pitch = Math.max(-1.2, Math.min(0.6, jog.pitch));
      this.ultYaw = jog.yaw; this.ultPitch = jog.pitch;
      $('#bt-veic-entrar').hidden = true;
      $('#bt-garagem-lugar').hidden = true;
      return true;
    }
    this.veic.empurrar(jog.pos);
    const perto = this.pertoDeMim();
    $('#bt-veic-entrar').hidden = !perto;
    $('#bt-garagem-lugar').hidden = !this.ligados() || !this.garagemPerto();
    if (perto && this._ultPerto !== perto.tipo) { this._ultPerto = perto.tipo; $('#bt-veic-entrar').innerHTML = icone(perto.tipo) + 'Entrar'; }
    return false;
  }

  // câmera em terceira pessoa atrás do veículo
  camera(camera) {
    if (!this.dentro) return false;
    const v = this.dentro.v, d = v.d, jog = this.J.jog();
    const cy = v.yaw + jog.yaw, cp = jog.pitch;
    const alvo = this._alvo || (this._alvo = new THREE.Vector3());
    alvo.set(v.x, v.yVis + Math.min(d.H, 3.2) * 0.75 + 0.9, v.z);
    const tras = this._tras || (this._tras = new THREE.Vector3());
    tras.set(Math.sin(cy) * Math.cos(cp), -Math.sin(cp), Math.cos(cy) * Math.cos(cp));
    let dist = Math.max(4.2, d.L * 0.85 + 3.4);
    const h = this.J.mundo().raycast(alvo, tras, dist);
    if (h) dist = Math.max(0.6, h.t - 0.35);
    camera.position.copy(alvo).addScaledVector(tras, dist);
    camera.rotation.set(cp, cy, 0, 'YXZ');
    return true;
  }

  // ---------- combustível, dano e posto ----------
  medidores(v) {
    if (!v.d.energia) return;
    const pc = Math.round(v.comb * 100), pd = Math.round((1 - v.dano) * 100);
    if (pc !== this._pc) {
      this._pc = pc;
      const el = $('#med-comb'); el.querySelector('u').style.width = pc + '%';
      el.classList.toggle('baixo', pc <= 15);
    }
    if (pd !== this._pd) {
      this._pd = pd;
      const el = $('#med-dano'); el.querySelector('u').style.width = pd + '%';
      el.classList.toggle('baixo', pd <= 30);
    }
  }

  postoPerto(v) {
    let melhor = null, dm = PERTO_POSTO;
    for (const p of this.postos.values()) {
      const d = Math.hypot(p.x - v.x, p.z - v.z);
      if (d < dm && Math.abs(p.y - v.y) < 4) { dm = d; melhor = p; }
    }
    return melhor;
  }

  verPosto(v, dt) {
    this._tPosto = (this._tPosto || 0) - dt;
    if (this._tPosto > 0) return;
    this._tPosto = 0.25;
    const p = v.d.energia && Math.abs(v.vel) < 1.5 ? this.postoPerto(v) : null;
    const precisaComb = v.comb < 0.99, precisaConserto = v.dano > 0.01;
    const box = $('#veic-posto');
    box.hidden = !p || (!precisaComb && !precisaConserto);
    if (box.hidden) return;
    const loja = this.comMercado();
    const preco = (k, falta) => (loja ? ' ' + moedaHtml(precoServico(k, falta)) : '');
    const bat = v.d.energia === 'bateria';
    const a = $('#bt-abastecer'), c = $('#bt-consertar');
    a.hidden = !precisaComb; c.hidden = !precisaConserto;
    const ha = icone(bat ? 'bateria' : 'combustivel') + (bat ? 'Carregar' : 'Abastecer') + preco('comb', 1 - v.comb);
    const hc = icone('ferramenta') + 'Consertar' + preco('conserto', v.dano);
    if (a.innerHTML !== ha) a.innerHTML = ha;
    if (c.innerHTML !== hc) c.innerHTML = hc;
    if (!this._avisouPosto) { this._avisouPosto = true; this.J.aviso('Posto! Aqui você abastece e conserta o veículo', 2400, 'combustivel'); }
  }

  servico(k) {
    if (!this.dentro || this.dentro.a !== 0) return;
    const v = this.dentro.v;
    if (!this.postoPerto(v)) return;
    const falta = k === 'comb' ? 1 - v.comb : v.dano;
    if (falta <= 0.005) return;
    if (this.J.sala()) { this.J.sala().enviar({ t: 'servico', id: v.id, k }); this._tPosto = 0; return; }
    const m = this.mercado();
    if (m && !m.servico(k, falta)) return;
    if (k === 'comb') v.comb = 1; else v.dano = 0;
    this.J.som.porta();
    this.J.aviso(k === 'comb' ? (v.d.energia === 'bateria' ? 'Bateria carregada!' : 'Tanque cheio!') : 'Veículo consertado, novinho!', 1800, k === 'comb' ? (v.d.energia === 'bateria' ? 'bateria' : 'combustivel') : 'ferramenta');
    this._tPosto = 0;
  }

  acabou(v, como) {
    if (!this.dentro || this.dentro.v !== v || this.dentro.a !== 0) return;
    const bat = v.d.energia === 'bateria';
    if (como === 'reserva') this.J.aviso(bat ? 'Bateria acabando! Procure um posto para carregar' : 'Gasolina acabando! Procure um posto', 3000, bat ? 'bateria' : 'combustivel');
    else this.J.aviso(bat ? 'A bateria acabou! O veículo vai bem devagar até um posto' : 'A gasolina acabou! O veículo vai bem devagar até um posto', 3500, bat ? 'bateria' : 'combustivel');
  }

  bateu(v, quanto, quebrou) {
    if (!this.dentro || this.dentro.v !== v || this.dentro.a !== 0) return;
    if (quebrou) { this.J.aviso('O veículo quebrou! Vá devagar até um posto para consertar', 3500, 'ferramenta'); return; }
    const agora = performance.now();
    if (quanto > 0.03 && (!this._avisoBatida || agora - this._avisoBatida > 4000)) {
      this._avisoBatida = agora;
      this.J.aviso(v.dano > 0.6 ? 'Bateu feio! O veículo está bem amassado' : 'Bateu! O veículo amassou um pouco', 1800, 'ferramenta');
    }
  }

  // ---------- postos e veículos que moram nas vilas e portos ----------
  chaoEm(x, z, agua) {
    const m = this.J.mundo(), bx = Math.floor(x), bz = Math.floor(z);
    const h = m.alturaEm(bx, bz);
    for (let y = Math.min(h + 12, 94); y > Math.max(1, h - 12); y--) {
      const b = m.bloco(bx, y, bz);
      if (AGUA[b]) return agua ? y : null;
      if (SOLIDO[b]) return agua ? null : y + 1;
    }
    return null;
  }

  olharLugares(pos) {
    if (!this.lugares || !this.ligados()) return;
    const { postos, parados } = this.lugares.perto(pos.x, pos.z, 90);
    // postos: aparecem perto e somem longe
    const vistos = new Set();
    for (const p of postos) {
      vistos.add(p.k);
      if (this.postos.has(p.k) || Math.hypot(p.x - pos.x, p.z - pos.z) > 90) continue;
      const y = this.chaoEm(p.x, p.z, false);
      if (y === null) continue;
      const malha = montarPosto();
      malha.position.set(p.x, y, p.z); malha.rotation.y = p.yaw;
      this.J.cena.add(malha);
      this.postos.set(p.k, { x: p.x, y, z: p.z, malha });
    }
    for (const [k, p] of this.postos) if (!vistos.has(k) && Math.hypot(p.x - pos.x, p.z - pos.z) > 140) { this.J.cena.remove(p.malha); this.postos.delete(k); }
    // veículos estacionados: cada um aparece uma vez só por mundo, quando alguém chega perto
    for (const c of parados) {
      if (this.criados.has(c.k) || this.pedidosP.has(c.k) || !this.permitido(c.tipo)) continue;
      if (Math.hypot(c.x - pos.x, c.z - pos.z) > 60) continue;
      const lugar = this.lugarParado(c);
      if (!lugar) { this.pedidosP.add(c.k); continue; } // não cabe (alguém construiu ali): desiste
      this.pedidosP.add(c.k);
      if (this.J.sala()) this.J.sala().enviar({ t: 'vparado', k: c.k, tipo: c.tipo, cor: c.cor, p: lugar, r: +c.yaw.toFixed(3) });
      else {
        this.criados.add(c.k);
        this.veic.criar({ id: 'L' + this.veic.seq++, tipo: c.tipo, cor: c.cor, p: lugar, r: c.yaw, k: c.k, c: 0.6 + (c.cor % 4) * 0.1 });
      }
    }
  }

  lugarParado(c) {
    const d = TIPOS[c.tipo];
    const y = this.chaoEm(c.x, c.z, !!c.agua);
    if (y === null) return null;
    const prova = { d, x: 0, y: 0, z: 0, yaw: c.yaw };
    for (let yy = y; yy <= y + 1; yy++) {
      if (!this.veic.colide(prova, c.x, yy, c.z, c.yaw) && !this.veic.colideVeiculo(prova, c.x, yy, c.z, c.yaw)) return [+c.x.toFixed(2), yy, +c.z.toFixed(2)];
    }
    return null;
  }

  // ---------- rede ----------
  // depois do "ola": coloca os veículos e quem está sentado neles
  ola(msg) {
    if (!this.veic) return;
    if (this.dentro) this.sairLocal(true);
    for (const id of [...this.veic.mapa.keys()]) this.veic.remover(id);
    for (const o of this.J.outros.values()) o.sentado = false;
    for (const k of msg.vparados || []) this.criados.add(k);
    for (const d of msg.veiculos || []) {
      const v = this.veic.criar(d);
      if (v && v.parado) this.criados.add(v.parado);
      if (!v || !d.ocup) continue;
      d.ocup.forEach((j, a) => { if (j) this.sentarOutro(v, a, j); });
    }
  }

  sentarOutro(v, a, j) {
    const o = this.J.outros.get(j);
    this.veic.ocupar(v, a, j, o || null);
    if (o) o.sentado = true;
  }

  // mensagens da sala que são de veículos; retorna true se tratou
  mensagem(msg) {
    if (!this.veic) return false;
    const V = this.veic;
    switch (msg.t) {
      case 'vnovo': {
        const v = V.criar(msg.v);
        if (v && v.parado) this.criados.add(v.parado);
        if (v && msg.n && msg.n === this.pedido) { this.pedido = 0; this.pedirEntrar(v); }
        return true;
      }
      case 'vassento': {
        const v = V.mapa.get(msg.id);
        if (!v) return true;
        if (msg.j) {
          if (msg.j === this.J.euId()) { if (!this.dentro || this.dentro.v !== v) this.entrar(v, msg.a); }
          else this.sentarOutro(v, msg.a, msg.j);
        } else {
          const quem = v.ocup[msg.a];
          if (quem && quem === this.J.euId()) { if (this.dentro && this.dentro.v === v) this.sairLocal(); }
          else if (quem) {
            V.desocupar(v, msg.a);
            const o = this.J.outros.get(quem);
            if (o) { o.sentado = false; o.alvo.copy(o.grupo.position); }
          }
        }
        return true;
      }
      case 'vmov': {
        if (this.dentro && this.dentro.a === 0 && this.dentro.v.id === msg.id) return true;
        V.aplicarPose(msg.id, msg.p, msg.r, msg.s, msg.c, msg.d);
        return true;
      }
      case 'vestado': {
        // posto (abastecer/consertar) feito pela sala
        const v = V.mapa.get(msg.id);
        if (!v) return true;
        const antes = { c: v.comb, d: v.dano };
        if (Number.isFinite(msg.c)) v.comb = msg.c;
        if (Number.isFinite(msg.d)) v.dano = msg.d;
        if (this.dentro && this.dentro.v === v && this.dentro.a === 0) {
          if (v.comb > antes.c + 0.01) this.J.aviso(v.d.energia === 'bateria' ? 'Bateria carregada!' : 'Tanque cheio!', 1800, v.d.energia === 'bateria' ? 'bateria' : 'combustivel');
          if (v.dano < antes.d - 0.01) this.J.aviso('Veículo consertado, novinho!', 1800, 'ferramenta');
          this.J.som.porta();
        }
        return true;
      }
      case 'vfim': {
        const v = V.mapa.get(msg.id);
        if (!v) return true;
        if (this.dentro && this.dentro.v === v) this.sairLocal();
        v.ocup.forEach((q, a) => { if (q) { V.desocupar(v, a); const o = this.J.outros.get(q); if (o) { o.sentado = false; o.alvo.copy(o.grupo.position); } } });
        V.remover(msg.id);
        return true;
      }
      case 'buzina': {
        const v = V.mapa.get(msg.id);
        if (!v) return true;
        const p = this.J.jog().pos;
        const dist = Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z);
        if (dist < 70) V.buzinar(v, 1 - dist / 70);
        return true;
      }
    }
    return false;
  }

  // um jogador saiu da sala: tira o boneco do assento antes de apagá-lo
  esquecer(id) {
    if (!this.veic) return;
    const s = this.veic.de(id);
    if (s) this.veic.desocupar(s.v, s.a);
    const o = this.J.outros.get(id);
    if (o) o.sentado = false;
  }
}

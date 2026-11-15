// Mundo de Guerra (tipo de mundo "guerra", 16 anos ou mais): quase um modo de ação de mundo aberto.
//  - Procurado (0 a 5 estrelas): atirar perto da polícia, acertar ou derrubar policial, roubar viatura, invadir
//    ou fugir do presídio e abrir as celas aumentam as estrelas. Mais estrelas = mais policiais, e com 3 ou mais
//    eles atiram (taser). Sem ninguém da polícia te ver por um tempo, as estrelas vão caindo.
//  - Preso: policial encosta em você (1 ou 2 estrelas) ou você cai sem corações sendo procurado. Vai para uma cela
//    do presídio, perde as armas e cumpre a pena. Dá para fugir serrando a grade (bater no portão da cela) ou com
//    alguém puxando a alavanca da sala de controle, que abre todas as celas (energia de verdade, pelo fio).
//  - Presos do pátio atacam quem chega perto; soldados do Forte Vermelho atiram em quem chega perto;
//    o canhão do forte atira bombas. Canhão e radar têm vida e podem ser destruídos (fica salvo no mundo).
//  - Veículos de guerra nas vagas da base, do forte e da delegacia; tanque com canhão, jipe e helicóptero com metralhadora.
//  - Missões com prêmios (armas), progresso salvo por mundo neste aparelho.
// Policiais, presos e soldados são calculados em cada aparelho; o que importa para todos (blocos do presídio,
// canhão e radar destruídos, veículos, explosões e estrelas de cada jogador) passa pela sala.
import * as THREE from '../vendor/three.module.min.js';
import { opcoesMundo } from './opcoes-mundo.js';
import { vida } from './vida.js';
import { icone } from './icones.js';
import { E, B, AR } from './blocos.js';
import { caixa, juntar, matModelo } from './modelos.js';
import { Pessoas, raioCaixa } from './guerra-npc.js';
import { ARMADOS, BLINDAGEM, MILITARES } from './guerra-veiculos.js';

const $ = (s) => document.querySelector(s);
const MAX_ESTRELAS = 5;
const POLICIA_POR_ESTRELA = [0, 2, 3, 4, 5, 6];
const ATIVAR = 110, DESATIVAR = 150; // distância em que as pessoas de um lugar aparecem / somem
const VOLTA_PESSOA = 45; // segundos para alguém derrubado voltar ao posto
const VIDA_CANHAO = 25, VIDA_RADAR = 30;
const REFAZ_FORTE = 8 * 60; // segundos: o forte é reconstruído (longe de todo mundo)

export const MISSOES = [
  { id: 'base', nome: 'Apresente-se', desc: 'Chegue à Base Aliada', ic: 'escudo', premio: 'fuzil' },
  { id: 'arsenal', nome: 'Equipado', desc: 'Pegue armas no arsenal da base', ic: 'mochila' },
  { id: 'tanque', nome: 'Motorista blindado', desc: 'Entre num tanque', ic: 'tanque' },
  { id: 'soldados', nome: 'Ataque ao forte', desc: 'Derrube 6 soldados inimigos', alvo: 6, ic: 'soldado', premio: 'espingarda' },
  { id: 'canhao', nome: 'Cale o canhão', desc: 'Derrube o canhão do Forte Vermelho', ic: 'explosao' },
  { id: 'radar', nome: 'Sem radar', desc: 'Destrua o radar do Forte Vermelho', ic: 'radar', premio: 'precisao' },
  { id: 'despiste', nome: 'Despiste', desc: 'Chegue a 3 estrelas e despiste a polícia', ic: 'sirene' },
  { id: 'fuga', nome: 'Fuga!', desc: 'Fuja do presídio antes do fim da pena', ic: 'algema' },
  { id: 'liberta', nome: 'Grande fuga', desc: 'Puxe a alavanca que abre todas as celas', ic: 'raio' },
];

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dentroRet = (x, z, L, folga = 0) => Math.abs(x - L.x) <= L.r + folga && Math.abs(z - L.z) <= L.r + folga;

export class Guerra {
  // J: { cena, camera, canvas, som, aviso, outros, jog(), mundo(), sala(), euId(), garagem, armas(), cmd, bichos(), codigo(), pausar(sim) }
  constructor(J) {
    this.J = J;
    this.pessoas = null;
    this.procurado = 0;
    this.efeitos = [];
    this.projeteis = [];
    this.gatilhoV = false;
    this.estrelasDe = new Map(); // id do jogador -> sprite das estrelas
    this.montarHud();
    // tiro dos veículos: botão esquerdo do mouse (dirigindo um veículo armado) ou o botão da tela
    const canvas = J.canvas;
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0 && this.armaVeiculo()) this.gatilhoV = this.tiroPedido = true; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.gatilhoV = false; });
    addEventListener('keydown', (e) => {
      if (!this.ativo || !this.J.jog() || e.target.tagName === 'INPUT') return;
      if (e.code === 'KeyK' && !e.repeat) this.pegarArsenal();
      else if (e.code === 'KeyN' && !e.repeat) this.abrirMissoes();
    });
  }

  get ativo() { return opcoesMundo.tipo === 'guerra' && !!this.ilha; }

  // ---------- tela ----------
  montarHud() {
    this.el = { estrelas: $('#procurado'), pena: $('#pena'), btMissoes: $('#bt-missoes'), missoes: $('#missoes'), lista: $('#missoes-lista'), atirar: $('#bt-veic-atirar'), arsenal: $('#bt-arsenal'), ferida: $('#guerra-ferida'), arma: $('#veic-arma') };
    if (!this.el.estrelas) return;
    this.el.estrelas.innerHTML = Array.from({ length: MAX_ESTRELAS }, () => `<span class="est">${icone('estrela')}</span>`).join('');
    this.el.btMissoes.addEventListener('click', () => this.abrirMissoes());
    this.el.missoes.querySelector('[data-fechar]').addEventListener('click', () => this.fecharMissoes());
    const on = (e) => { e.preventDefault(); e.stopPropagation(); this.gatilhoV = this.tiroPedido = true; this.el.atirar.classList.add('ativo'); };
    const off = (e) => { e.preventDefault(); this.gatilhoV = false; this.el.atirar.classList.remove('ativo'); };
    this.el.atirar.addEventListener('touchstart', on, { passive: false }); this.el.atirar.addEventListener('mousedown', on);
    for (const ev of ['touchend', 'touchcancel', 'mouseup', 'mouseleave']) this.el.atirar.addEventListener(ev, off);
    this.el.arsenal.addEventListener('click', (e) => { e.stopPropagation(); this.pegarArsenal(); });
  }

  mostrarHud(sim) {
    if (!this.el.estrelas) return;
    this.el.estrelas.hidden = !sim; this.el.btMissoes.hidden = !sim;
    if (!sim) { this.el.pena.hidden = true; this.el.atirar.hidden = true; this.el.arsenal.hidden = true; this.el.arma.hidden = true; }
    document.body.classList.toggle('guerra', sim);
  }

  desenharEstrelas() {
    const el = this.el.estrelas;
    if (!el) return;
    [...el.children].forEach((s, i) => s.classList.toggle('cheia', i < this.procurado));
    el.classList.toggle('vista', this.procurado > 0 && this.vistoAgora);
    el.setAttribute('aria-label', `Procurado: ${this.procurado} de ${MAX_ESTRELAS} estrelas`);
  }

  // ---------- começo / fim ----------
  comecar() {
    this.parar();
    const mundo = this.J.mundo();
    if (opcoesMundo.tipo !== 'guerra' || !mundo || !mundo.aventura || !mundo.aventura.lugar) { this.mostrarHud(false); return; }
    this.ilha = mundo.aventura;
    this.pessoas = new Pessoas(this.J.cena, mundo);
    this.procurado = 0; this.semVer = 0; this.maxProcurado = 0; this.vistoAgora = false; this.cdCrime = 0;
    this.preso = null; this.serrando = new Map(); this.portasAbertas = new Map();
    this.ativos = new Map(); // lugar -> { vagas, postos: [{ papel, x, z, npc, volta }] }
    this.extras = []; // policiais que vieram atrás de você
    this.tReforco = 0; this.tLugares = 0; this.tVagas = 0; this.tPrisao = 0; this.cdSoco = 0; this.cdArsenal = 0; this.cdTiroV = 0;
    this.alavancaAntes = null;
    const F = this.ilha.lugar('forte');
    this.alvos = F ? {
      canhao: { L: F, ...F.canhao, vida: VIDA_CANHAO, max: VIDA_CANHAO, cd: 3, nome: 'canhão' },
      radar: { L: F, ...F.radar, vida: VIDA_RADAR, max: VIDA_RADAR, nome: 'radar' },
    } : {};
    this.tDestruido = 0;
    this.montarCanhao();
    // veículos de guerra só nas vagas (a garagem não oferece)
    const g = this.J.garagem;
    if (!this._permitidoOriginal) this._permitidoOriginal = g.permitido;
    const orig = this._permitidoOriginal;
    g.permitido = (t) => !MILITARES.has(t) && orig(t);
    this.carregarMissoes();
    this.mostrarHud(true);
    this.desenharEstrelas();
    setTimeout(() => { if (this.ativo) this.J.aviso('Mundo de Guerra! Vá até a Base Aliada (N: missões)', 4500, 'escudo'); }, 1800);
  }

  parar() {
    if (this.pessoas) this.pessoas.limpar();
    for (const e of this.efeitos) this.J.cena.remove(e.m);
    for (const p of this.projeteis) this.J.cena.remove(p.m);
    if (this.canhaoMalha) { this.J.cena.remove(this.canhaoMalha); this.canhaoMalha = null; }
    for (const s of this.estrelasDe.values()) s.parent && s.parent.remove(s);
    this.estrelasDe.clear();
    this.efeitos = []; this.projeteis = []; this.pessoas = null; this.ilha = null; this.preso = null;
    if (this._permitidoOriginal) this.J.garagem.permitido = this._permitidoOriginal;
    this.gatilhoV = false;
    const a = this.J.armas && this.J.armas();
    if (a && a.alvosExtras === this.meusAlvos) a.alvosExtras = [];
    this.meusAlvos = null;
    this.mostrarHud(false);
  }

  // ---------- missões ----------
  chaveMissoes() { return 'pradaria.guerra.' + (this.J.codigo() || 'local'); }
  carregarMissoes() {
    this.missoes = {};
    try { this.missoes = JSON.parse(localStorage.getItem(this.chaveMissoes()) || '{}') || {}; } catch {}
  }
  salvarMissoes() { try { localStorage.setItem(this.chaveMissoes(), JSON.stringify(this.missoes)); } catch {} }
  progresso(id, n = 1) {
    const M = MISSOES.find((m) => m.id === id);
    if (!M || this.missoes[id] === true) return;
    if (M.alvo) {
      this.missoes[id] = (this.missoes[id] | 0) + n;
      if (this.missoes[id] < M.alvo) { this.salvarMissoes(); this.J.aviso(`${M.nome}: ${this.missoes[id]} de ${M.alvo}`, 1500, M.ic); return; }
    }
    this.missoes[id] = true;
    this.salvarMissoes();
    this.J.som.tom(660, 0.12, { tipo: 'triangle', vol: 0.25 }); setTimeout(() => this.J.som.tom(990, 0.2, { tipo: 'triangle', vol: 0.25 }), 130);
    const armas = this.J.armas();
    let premio = '';
    if (M.premio && armas && armas.receber) { armas.receber({ tipo: 'arma', a: M.premio }); premio = ' Prêmio: uma arma nova!'; }
    this.J.aviso(`Missão cumprida: ${M.nome}!${premio}`, 3200, 'medalha');
    if (this.el.missoes && !this.el.missoes.hidden) this.desenharMissoes();
  }
  abrirMissoes() {
    if (!this.ativo) return;
    if (document.pointerLockElement) document.exitPointerLock();
    this.desenharMissoes();
    this.el.missoes.hidden = false;
    this.J.pausar(true);
  }
  fecharMissoes() { this.el.missoes.hidden = true; this.J.pausar(false); }
  desenharMissoes() {
    const l = this.el.lista;
    l.innerHTML = '';
    let feitas = 0;
    for (const M of MISSOES) {
      const v = this.missoes[M.id], ok = v === true;
      if (ok) feitas++;
      const d = document.createElement('div');
      d.className = 'missao' + (ok ? ' feita' : '');
      d.innerHTML = `<span class="ic">${icone(M.ic)}</span><span class="txt"><b></b><small></small></span><span class="estado">${ok ? icone('medalha') : M.alvo ? `${v | 0}/${M.alvo}` : ''}</span>`;
      d.querySelector('b').textContent = M.nome;
      d.querySelector('small').textContent = M.desc + (M.premio ? ' · prêmio: arma nova' : '');
      l.appendChild(d);
    }
    this.el.missoes.querySelector('#missoes-total').textContent = `${feitas} de ${MISSOES.length} cumpridas`;
  }

  // ---------- procurado ----------
  // soma estrelas (n) e garante um mínimo; mostra o aviso e conta para os outros jogadores
  crime(n, minimo = 0, motivo = '') {
    if (this.preso) return;
    const antes = this.procurado;
    this.procurado = Math.min(MAX_ESTRELAS, Math.max(this.procurado + n, minimo));
    this.semVer = 0;
    if (this.procurado > this.maxProcurado) this.maxProcurado = this.procurado;
    if (this.procurado !== antes) {
      this.J.aviso(`${motivo ? motivo + '! ' : ''}Procurado: ${this.procurado} ${this.procurado === 1 ? 'estrela' : 'estrelas'}`, 2000, 'sirene');
      this.J.som.tom(880, 0.12, { tipo: 'square', vol: 0.12, ate: 660 }); setTimeout(() => this.J.som.tom(660, 0.12, { tipo: 'square', vol: 0.12, ate: 880 }), 140);
      this.enviarEstrelas();
    }
    this.desenharEstrelas();
  }
  zerarProcurado() {
    this.procurado = 0; this.semVer = 0; this.maxProcurado = 0;
    this.enviarEstrelas(); this.desenharEstrelas();
  }
  enviarEstrelas() { const s = this.J.sala(); if (s) s.enviar({ t: 'gx', k: 'estrelas', n: this.procurado }); }

  // tem alguém da polícia (ou guarda) perto o bastante para ouvir um tiro?
  policiaPerto(p, r = 35) {
    if (!this.pessoas) return false;
    for (const n of this.pessoas.lista) if ((n.papel === 'policial' || n.papel === 'guarda') && n.estado !== 'zonzo' && Math.hypot(n.x - p.x, n.z - p.z) < r) return true;
    // nas cidades sempre tem alguém para chamar a polícia
    for (const L of this.ilha.lugares) if ((L.tipo === 'cidade' || L.tipo === 'delegacia') && dentroRet(p.x, p.z, L, 4)) return true;
    return false;
  }

  // o jogador atirou (arma de mão ou de veículo)
  atirou(p) {
    if (!this.ativo || this.preso) return;
    if (this.cdCrime > 0) return;
    // tiro dentro do Forte Vermelho é guerra, não crime
    const F = this.ilha.lugar('forte');
    if (F && dentroRet(p.x, p.z, F, 30)) return;
    if (this.policiaPerto(p)) { this.cdCrime = this.procurado ? 10 : 2; this.crime(this.procurado ? 1 : 1, 1, 'Tiros perto da polícia'); }
  }

  // ---------- lugares: quem aparece em cada um ----------
  ativarLugares(jp) {
    for (const L of this.ilha.lugares) {
      if (!['prisao', 'forte', 'delegacia', 'cidade', 'base'].includes(L.tipo)) continue;
      const d = Math.hypot(jp.x - L.x, jp.z - L.z);
      const at = this.ativos.get(L);
      if (!at && d < ATIVAR) this.ativos.set(L, this.povoar(L));
      else if (at && d > DESATIVAR) { for (const s of at.postos) if (s.npc && !s.npc.removido) this.pessoas.remover(s.npc); this.ativos.delete(L); }
    }
  }

  povoar(L) {
    const postos = [];
    const add = (papel, x, z, extra = {}) => postos.push({ papel, x, z, extra, npc: null, volta: 0 });
    if (L.tipo === 'prisao') {
      for (const g of L.guardas) add('guarda', g.x, g.z, { casa: { x: g.x, z: g.z, r: 6 }, lugar: L });
      for (const p of L.presos) add('preso', p.x, p.z, { casa: { x: L.x + 0.5, z: L.z + 5, r: 11 }, lugar: L });
      L.celas.forEach((c, i) => { if (i > 0) add('preso', c.x, c.z, { casa: { x: c.x, z: c.z, r: 0.8 }, cela: i, lugar: L }); });
    } else if (L.tipo === 'forte') {
      for (const p of L.postos) add('soldado', p.x, p.z, { casa: { x: p.x, z: p.z, r: 7 }, lugar: L });
    } else if (L.tipo === 'delegacia') {
      add('policial', L.saida.x, L.saida.z, { casa: { x: L.saida.x, z: L.saida.z, r: 9 }, lugar: L });
      add('policial', L.saida.x + 3, L.saida.z, { casa: { x: L.saida.x, z: L.saida.z, r: 9 }, lugar: L });
    } else if (L.tipo === 'cidade') {
      // ruas da cidade (as mesmas de montar_cidade): o policial anda de esquina em esquina
      const esquinas = [];
      for (const a of [-33, -11, 11, 33]) for (const b of [-11, 11]) esquinas.push({ x: L.x + a + 0.5, z: L.z + b + 0.5 }, { x: L.x + b + 0.5, z: L.z + a + 0.5 });
      add('policial', esquinas[0].x, esquinas[0].z, { casa: { x: L.x, z: L.z, r: 30 }, esquinas, lugar: L });
      add('policial', esquinas[5].x, esquinas[5].z, { casa: { x: L.x, z: L.z, r: 30 }, esquinas, lugar: L });
    }
    const at = { postos };
    for (const s of postos) this.nascer(s);
    return at;
  }

  nascer(s) {
    s.npc = this.pessoas.criar(s.papel, s.x, s.z, { ...s.extra, casa: { ...(s.extra.casa || { x: s.x, z: s.z, r: 6 }) }, posto: s });
    return s.npc;
  }

  // ---------- laço ----------
  quadro(dt, pausado) {
    if (!this.ativo) return;
    const jog = this.J.jog(), mundo = this.J.mundo();
    if (!jog || !mundo) return;
    this.atualizarEfeitos(dt);
    if (pausado) return;
    const jp = jog.pos;
    this.cdCrime = Math.max(0, this.cdCrime - dt);
    this.cdSoco = Math.max(0, this.cdSoco - dt);
    this.cdArsenal = Math.max(0, this.cdArsenal - dt);
    this.tLugares -= dt;
    if (this.tLugares <= 0) { this.tLugares = 0.5; this.ativarLugares(jp); this.vigiarLugares(jp); }
    this.tVagas -= dt;
    if (this.tVagas <= 0) { this.tVagas = 2; this.cuidarVagas(jp); }
    this.vistoAgora = false;
    this.atualizarPessoas(dt, jog);
    this.atualizarCanhao(dt, jog);
    this.atualizarProjeteis(dt);
    this.armaDosVeiculos(dt);
    this.atualizarPrisao(dt, jog);
    this.atualizarProcurado(dt, jog);
    this.alvosParaArmas();
    // quem entrou depois também vê as estrelas
    this.tEstrelas = (this.tEstrelas || 0) - dt;
    if (this.tEstrelas <= 0) { this.tEstrelas = 8; if (this.procurado > 0) this.enviarEstrelas(); }
  }

  // o que o jogador está fazendo em cada lugar (chegar na base, invadir o presídio, roubar viatura...)
  vigiarLugares(jp) {
    const g = this.J.garagem;
    const base = this.ilha.lugar('base');
    if (base && dentroRet(jp.x, jp.z, base)) this.progresso('base');
    // arsenal: botão aparece quando está na frente
    const perto = base && !g.dentro && Math.hypot(jp.x - base.arsenal.x, jp.z - base.arsenal.z) < 3.2 && Math.abs(jp.y - base.arsenal.y) < 3;
    this.el.arsenal.hidden = !perto;
    if (perto && !this.dicaArsenal) { this.dicaArsenal = true; this.J.aviso('Arsenal: toque em Pegar armas (tecla K)', 2500, 'mochila'); }
    // dentro de um veículo: tanque (missão) e viatura (roubar é crime)
    if (g.dentro) {
      const t = g.dentro.v.tipo;
      if (t === 'tanque') this.progresso('tanque');
      if (t === 'viatura' && g.dentro.v !== this.viaturaAvisada) { this.viaturaAvisada = g.dentro.v; this.crime(1, 1, 'Viatura roubada'); }
    }
    // invadir o pátio do presídio (sem estar preso): os guardas ficam bravos
    const P = this.ilha.lugar('prisao');
    if (P && !this.preso && dentroRet(jp.x, jp.z, P, -1)) { if (!this.invasor) { this.invasor = true; this.crime(0, 1, 'Invasão do presídio'); } }
    else this.invasor = false;
  }

  // ---------- pessoas ----------
  atualizarPessoas(dt, jog) {
    const jp = jog.pos, g = this.J.garagem;
    const dentro = g.dentro;
    const alvo = dentro ? { x: dentro.v.x, y: dentro.v.y + 0.8, z: dentro.v.z } : { x: jp.x, y: jp.y + 1.1, z: jp.z };
    for (const n of [...this.pessoas.lista]) {
      const dp = Math.hypot(n.x - jp.x, n.z - jp.z);
      if (n.estado === 'zonzo') {
        n.zonzo += dt;
        this.pessoas.desenhar(n, dt);
        if (n.zonzo > 5) { this.nuvem(n.x, n.y + 0.4, n.z); this.pessoas.remover(n); if (n.posto) n.posto.volta = VOLTA_PESSOA; if (n.extra) this.extras = this.extras.filter((e) => e !== n); }
        continue;
      }
      const visivel = dp < 100;
      n.b.grupo.visible = visivel;
      if (!visivel) continue;
      n.cd -= dt; n.losT = (n.losT || 0) - dt; n.alerta = Math.max(0, (n.alerta || 0) - dt);
      if (n.losT <= 0) { n.losT = 0.25 + Math.random() * 0.1; n.ve = dp < n.P.visao + (n.alerta ? 20 : 0) && this.ver(n, alvo); }
      const hostil = this.hostil(n, dp);
      let vel = 0, tx = n.x, tz = n.z;
      n.mirando = false;
      if (hostil && n.ve) {
        if (n.papel === 'policial' || n.papel === 'guarda') this.vistoAgora = true;
        n.ultimo = { x: alvo.x, z: alvo.z };
        const atira = n.P.arma !== 'soco' && (n.papel !== 'policial' || this.procurado >= 3);
        if (atira) {
          n.yaw = Math.atan2(alvo.x - n.x, alvo.z - n.z);
          if (dp > n.P.alcance * 0.65) { vel = n.P.vel; tx = alvo.x; tz = alvo.z; }
          if (dp < n.P.alcance) { n.mirando = true; if (n.cd <= 0) { n.cd = n.P.intervalo * (0.8 + Math.random() * 0.5); this.npcAtira(n, alvo, dp); } }
        } else {
          vel = n.P.vel; tx = alvo.x; tz = alvo.z;
          if (n.papel === 'preso' && dp < n.P.alcance && Math.abs(n.y - jp.y) < 2 && n.cd <= 0 && !dentro) { n.cd = n.P.intervalo; this.npcSoca(n); }
          // polícia com 1 ou 2 estrelas prende quem ela alcança (de veículo não dá)
          if (n.papel === 'policial' && dp < 1.7 && Math.abs(n.y - jp.y) < 2 && !dentro) { n.prendendo = (n.prendendo || 0) + dt; if (n.prendendo > 1.1) { this.prender(); return; } }
          else n.prendendo = 0;
          if (dp < 1.1) vel = 0;
        }
      } else if (hostil && n.ultimo) {
        // perdeu de vista: vai até onde viu por último
        vel = n.P.vel * 0.8; tx = n.ultimo.x; tz = n.ultimo.z;
        if (Math.hypot(tx - n.x, tz - n.z) < 1.2) n.ultimo = null;
      } else {
        // calmo: passeia em volta do posto (preso solto corre para fora do presídio)
        if (n.solto && n.lugar) { vel = n.P.vel; tx = n.lugar.portao.x; tz = n.lugar.portao.z; if (Math.hypot(tx - n.x, tz - n.z) < 2.5) { this.nuvem(n.x, n.y + 1, n.z); this.pessoas.remover(n); continue; } }
        else if (n.extra) { vel = n.P.vel * 0.6; tx = n.x + (n.x - jp.x); tz = n.z + (n.z - jp.z); if (dp > 60 && !this.procurado) { this.pessoas.remover(n); this.extras = this.extras.filter((e) => e !== n); continue; } }
        else {
          if (!n.passeio || Math.hypot(n.passeio.x - n.x, n.passeio.z - n.z) < 0.8 || (n.tPasseio -= dt) <= 0) {
            n.tPasseio = 4 + Math.random() * 6;
            if (n.esquinas) n.passeio = n.esquinas[Math.floor(Math.random() * n.esquinas.length)];
            else { const a = Math.random() * 6.28, r = Math.random() * n.casa.r; n.passeio = { x: n.casa.x + Math.cos(a) * r, z: n.casa.z + Math.sin(a) * r }; }
            n.parado = Math.random() < 0.4 ? 1 + Math.random() * 2 : 0;
          }
          if (n.parado > 0) n.parado -= dt;
          else { vel = n.esquinas ? 2.2 : 1.4; tx = n.passeio.x; tz = n.passeio.z; }
        }
      }
      // preso na cela: só sai quando o portão abre
      if (n.cela != null) {
        if (this.portaAberta(n.lugar.celas[n.cela])) { n.cela = null; n.solto = true; n.alerta = 6; n.casa = { x: n.lugar.x + 0.5, z: n.lugar.z + 5, r: 11 }; }
        else { vel = Math.min(vel, 1); tx = n.casa.x + (tx - n.x > 0 ? 0.6 : -0.6); tz = n.casa.z; }
      }
      if (vel > 0) this.pessoas.mover(n, dt, tx, tz, vel); else n.anda = 0;
      this.pessoas.fisica(n, dt);
      this.pessoas.desenhar(n, dt);
    }
    // quem foi derrubado volta depois de um tempo (se ninguém estiver olhando de perto)
    for (const at of this.ativos.values()) for (const s of at.postos) {
      if (s.npc && !s.npc.removido) continue;
      if (s.volta > 0) { s.volta -= dt; continue; }
      if (Math.hypot(s.x - jp.x, s.z - jp.z) > 25 && !(s.extra.cela != null && this.preso)) this.nascer(s);
    }
  }

  hostil(n, dp) {
    if (n.papel === 'soldado') return true;
    if (n.papel === 'preso') return n.cela == null && (dp < n.P.visao || n.alerta > 0);
    if (n.papel === 'guarda') return this.procurado > 0 || this.invasor || n.alerta > 0;
    return this.procurado > 0 || n.alerta > 0; // policial
  }

  // linha de visão (sem bloco no meio) dos olhos da pessoa até o alvo
  ver(n, alvo) {
    v1.set(n.x, n.y + 1.6, n.z);
    v2.set(alvo.x - v1.x, alvo.y - v1.y, alvo.z - v1.z);
    const d = v2.length();
    if (d < 0.5) return true;
    v2.divideScalar(d);
    return !this.J.mundo().raycast(v1, v2, d - 0.6);
  }

  npcAtira(n, alvo, dp) {
    const P = n.P, jog = this.J.jog();
    const correndo = Math.hypot(jog.vel.x, jog.vel.z) > 5 ? 0.75 : 1;
    const acertou = Math.random() < P.mira * (1 - 0.5 * dp / P.alcance) * correndo;
    n.golpe = 0.5;
    const ox = n.x + Math.sin(n.yaw) * 0.5, oz = n.z + Math.cos(n.yaw) * 0.5;
    const fim = acertou ? { x: alvo.x, y: alvo.y, z: alvo.z } : { x: alvo.x + (Math.random() - 0.5) * 3, y: alvo.y + (Math.random() - 0.3) * 2, z: alvo.z + (Math.random() - 0.5) * 3 };
    this.risco(v1.set(ox, n.y + 1.25, oz), v2.set(fim.x, fim.y, fim.z), P.arma === 'taser' ? 0x7fd8ff : 0xfff1a8);
    this.J.som.tom(P.arma === 'taser' ? 1400 : 520, 0.06, { tipo: 'square', vol: Math.max(0.03, 0.14 - dp / 400), ate: 300 });
    if (acertou) this.ferir(P.dano, n);
  }

  npcSoca(n) {
    n.golpe = 0;
    this.J.som.tom(180, 0.08, { tipo: 'sine', vol: 0.25, ate: 90 });
    if (Math.random() < n.P.mira) this.ferir(n.P.dano, n);
  }

  // dano no jogador (ou no veículo dele: veículo blindado segura parte dos tiros)
  ferir(dano, de) {
    const g = this.J.garagem;
    if (g.dentro) {
      const v = g.dentro.v, bl = BLINDAGEM[v.tipo] ?? 0.2;
      if (g.veic && g.veic.bater) g.veic.bater(v, 0.015 * dano * (1 - bl * 0.8));
      if (Math.random() < bl) return;
    }
    if (!vida.dano(dano)) return;
    const el = this.el.ferida;
    if (el) { el.classList.remove('vai'); void el.offsetWidth; el.classList.add('vai'); }
    this.J.som.tom(240, 0.12, { tipo: 'sine', vol: 0.3, ate: 140 });
    if (de && de.P && vida.atual > 0 && (!this.ultimoAvisoDano || performance.now() - this.ultimoAvisoDano > 2500)) {
      this.ultimoAvisoDano = performance.now();
      this.J.aviso(de.papel === 'preso' ? 'Um preso te atacou!' : `${de.P.nome} te acertou!`, 1100, 'coracao');
    }
  }

  // dano numa pessoa (tiro, soco, explosão); como = 'soco' | 'tiro' | 'explosao'
  danoPessoa(n, dano, como = 'tiro') {
    if (!n || n.removido || n.estado === 'zonzo') return;
    n.vida -= dano;
    n.alerta = 10;
    n.ultimo = { x: this.J.jog().pos.x, z: this.J.jog().pos.z };
    const policia = n.papel === 'policial' || n.papel === 'guarda';
    if (n.vida <= 0) {
      n.estado = 'zonzo'; n.zonzo = 0; n.anda = 0;
      const b = this.J.bichos();
      if (b && b.icone) b.icone('estrela', n.x, n.y + 1.2, n.z, 1.1, 0.4);
      this.J.som.tom(500, 0.25, { tipo: 'triangle', vol: 0.18, ate: 200 });
      if (policia) this.crime(1, 3, `${n.P.nome} derrubado`);
      if (n.papel === 'soldado') this.progresso('soldados');
      return;
    }
    if (policia) { if (this.cdCrime <= 0 || this.procurado < 2) { this.cdCrime = 3; this.crime(this.procurado >= 2 ? 1 : 0, 2, `Você atacou um ${n.P.nome.toLowerCase()}`); } }
    if (como === 'soco') n.golpe = 0.3;
  }

  // ---------- jogador batendo (sem arma) ----------
  atingir(o, dir, max) {
    if (!this.ativo || !this.pessoas) return null;
    return this.pessoas.atingir(o, dir, Math.min(max, 3.2));
  }
  socar(n) {
    if (this.cdSoco > 0) return;
    this.cdSoco = 0.35;
    this.J.som.tom(160, 0.07, { tipo: 'sine', vol: 0.3, ate: 80 });
    this.danoPessoa(n, 1, 'soco');
  }

  // armas de mão (armas.js) também acertam pessoas, o canhão e o radar
  // armas de mão (armas.js) também acertam as pessoas, o canhão e o radar (a lista é montada uma vez por mundo)
  alvosParaArmas() {
    const armas = this.J.armas();
    if (!armas || !('alvosExtras' in armas) || armas.alvosExtras === this.meusAlvos) return;
    this.meusAlvos = [
      // pessoas: o raio testa corpo e cabeça (o dano da cabeça já vem multiplicado pelas armas)
      { testar: (o, d, max) => {
        const h = this.pessoas && this.pessoas.atingir(o, d, max);
        return h && { t: h.t, cabeca: h.cabeca, aoAcertar: (dano) => this.danoPessoa(h.npc, dano, 'tiro') };
      } },
      { testar: (o, d, max) => {
        let r = null;
        for (const a of Object.values(this.alvos)) {
          if (this.destruido(a)) continue;
          const t = raioCaixa(o, d, v1.set(a.x - 1.6, a.y - 0.5, a.z - 1.6), v2.set(a.x + 1.6, a.y + (a === this.alvos.radar ? 11 : 1.6), a.z + 1.6), r ? r.t : max);
          if (t >= 0) r = { t, aoAcertar: (dano) => this.danoAlvo(a, dano) };
        }
        return r;
      } },
    ];
    armas.alvosExtras = this.meusAlvos;
  }

  // ---------- canhão e radar do forte ----------
  destruido(a) {
    const m = this.J.mundo();
    if (!m || !a.marca) return true;
    const [x, y, z] = a.marca;
    return m.bloco(x, y, z) !== (a === this.alvos.radar ? B.PEDRA : B.TIJOLO);
  }

  montarCanhao() {
    const a = this.alvos.canhao;
    if (!a) return;
    const g = new THREE.Group();
    const base = new THREE.Mesh(juntar([caixa(1.4, 0.5, 1.4, 0x5d4636, 0, 0.25, 0), caixa(1.0, 0.7, 1.0, 0x6b7a3a, 0, 0.75, 0)]), matModelo);
    const cano = new THREE.Group();
    cano.add(new THREE.Mesh(juntar([caixa(0.3, 0.3, 2.0, 0x3a3f48, 0, 0, 0.9), caixa(0.4, 0.4, 0.3, 0x222222, 0, 0, 1.9)]), matModelo));
    cano.position.y = 1.0;
    g.add(base, cano);
    g.position.set(a.x, a.y, a.z);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    this.J.cena.add(g);
    this.canhaoMalha = g; this.canhaoCano = cano;
  }

  danoAlvo(a, dano) {
    if (this.destruido(a)) return;
    a.vida -= dano;
    if (!a.avisou || performance.now() - a.avisou > 1500) { a.avisou = performance.now(); this.J.aviso(`${a.nome === 'radar' ? 'Radar' : 'Canhão'}: ${Math.max(0, Math.ceil(a.vida / a.max * 100))}%`, 900, a.nome === 'radar' ? 'radar' : 'explosao'); }
    if (a.vida > 0) return;
    // destruído: some do mundo para todos (as edições de bloco vão pela sala)
    const m = this.J.mundo();
    this.explodir(new THREE.Vector3(a.x, a.y + (a === this.alvos.radar ? 6 : 1), a.z), 4, 0, { visual: true });
    if (a === this.alvos.radar) { for (const [x, y, z, b] of a.blocos) if (b !== B.PEDRISCO || y > a.y + 1) m.definir(x, y, z, AR); this.progresso('radar'); }
    else { m.definir(a.marca[0], a.marca[1], a.marca[2], AR); this.progresso('canhao'); }
    this.J.aviso(a === this.alvos.radar ? 'Radar destruído!' : 'Canhão derrubado!', 2500, 'explosao');
  }

  atualizarCanhao(dt, jog) {
    const a = this.alvos.canhao;
    if (!a || !this.canhaoMalha) return;
    const morto = this.destruido(a);
    this.canhaoMalha.visible = !morto && Math.hypot(a.x - jog.pos.x, a.z - jog.pos.z) < 160;
    // forte destruído: depois de um tempo, longe de todo mundo, é reconstruído
    const F = a.L;
    if (morto || this.destruido(this.alvos.radar)) {
      this.tDestruido += dt;
      if (this.tDestruido > REFAZ_FORTE && Math.hypot(F.x - jog.pos.x, F.z - jog.pos.z) > 130) this.reconstruirForte();
    } else this.tDestruido = 0;
    if (morto || this.preso) return;
    const g = this.J.garagem;
    const alvo = g.dentro ? { x: g.dentro.v.x, y: g.dentro.v.y + 1, z: g.dentro.v.z } : { x: jog.pos.x, y: jog.pos.y + 1, z: jog.pos.z };
    const d = Math.hypot(alvo.x - a.x, alvo.z - a.z);
    if (d > 60) return;
    const yaw = Math.atan2(alvo.x - a.x, alvo.z - a.z);
    this.canhaoCano.rotation.y += (((yaw - this.canhaoCano.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 3);
    a.cd -= dt;
    if (a.cd > 0) return;
    v1.set(a.x, a.y + 1, a.z);
    if (!this.ver({ x: a.x, y: a.y - 0.6, z: a.z }, alvo)) { a.cd = 0.5; return; }
    a.cd = 4.2;
    // mira com a queda da bomba (gravidade baixinha) e um pouco de erro
    const vel = 38, g0 = 6, t = d / vel;
    v2.set(alvo.x - a.x + (Math.random() - 0.5) * 2.5, alvo.y - (a.y + 1) + 0.5 * g0 * t * t, alvo.z - a.z + (Math.random() - 0.5) * 2.5).normalize().multiplyScalar(vel);
    this.lancarBomba(v1.clone().addScaledVector(v2.clone().normalize(), 2), v2.clone(), { g: g0, raio: 3.6, dano: 4, inimigo: true });
    this.J.som.tom(120, 0.3, { tipo: 'sawtooth', vol: 0.25, ate: 50 });
  }

  reconstruirForte() {
    this.tDestruido = 0;
    const m = this.J.mundo(), r = this.alvos.radar, c = this.alvos.canhao;
    for (const [x, y, z, b] of r.blocos) if (m.bloco(x, y, z) !== b) m.definir(x, y, z, b);
    if (m.bloco(...c.marca) !== B.TIJOLO) m.definir(c.marca[0], c.marca[1], c.marca[2], B.TIJOLO);
    r.vida = r.max; c.vida = c.max;
  }

  // ---------- veículos ----------
  armaVeiculo() {
    const g = this.J.garagem;
    if (!this.ativo || !g.dentro) return null;
    const A = ARMADOS[g.dentro.v.tipo];
    return A && g.dentro.a === A.assento ? A : null;
  }

  armaDosVeiculos(dt) {
    const A = this.armaVeiculo();
    this.el.atirar.hidden = !A; this.el.arma.hidden = !A;
    document.body.classList.toggle('veic-armado', !!A);
    if (A && this.el.arma.dataset.a !== A.nome) { this.el.arma.dataset.a = A.nome; this.el.arma.innerHTML = icone('mira') + `<span>${A.nome}</span>`; }
    this.cdTiroV = Math.max(0, this.cdTiroV - dt);
    // um toque rápido enquanto o canhão recarrega fica guardado e sai assim que der
    if (!A) { this.tiroPedido = false; return; }
    if (this.cdTiroV > 0 || !(this.gatilhoV || this.tiroPedido)) return;
    this.tiroPedido = false;
    this.cdTiroV = A.intervalo;
    const v = this.J.garagem.dentro.v, cam = this.J.camera;
    v.grupo.updateMatrixWorld(true);
    const o = v.corpo.localToWorld(new THREE.Vector3(...A.ponta));
    const dir = cam.getWorldDirection(new THREE.Vector3());
    // mira: o ponto que a câmera olha (até 80 blocos) e o tiro sai da ponta da arma até lá
    const mundo = this.J.mundo();
    // (o raio começa na altura do veículo: a câmera de trás pode estar encostada num morro ou numa parede)
    const pula = Math.max(0, Math.hypot(v.x - cam.position.x, v.z - cam.position.z) - 1);
    const ini = cam.position.clone().addScaledVector(dir, pula);
    const longe = ini.clone().addScaledVector(dir, this.miraAte(ini, dir, 90, v));
    // alvo atrás da ponta do cano (morro colado na câmera): atira reto para onde a câmera olha
    const d = longe.clone().sub(o);
    if (d.dot(dir) < 3) d.copy(dir);
    d.normalize();
    this.atirou(o);
    if (A.arma === 'canhao') {
      this.lancarBomba(o.clone(), d.multiplyScalar(A.vel), { g: 9, raio: A.raio, dano: A.dano, meu: true });
      this.J.som.tom(90, 0.4, { tipo: 'sawtooth', vol: 0.3, ate: 40 }); this.J.som.ruido && this.J.som.ruido(0.3, { vol: 0.35, freq: 500 });
      const s = this.J.sala(); if (s) s.enviar({ t: 'gx', k: 'tiro', o: [o.x, o.y, o.z].map((x) => +x.toFixed(2)), d: [d.x, d.y, d.z].map((x) => +x.toFixed(2)) });
    } else {
      d.x += (Math.random() - 0.5) * 0.03; d.y += (Math.random() - 0.5) * 0.03; d.z += (Math.random() - 0.5) * 0.03; d.normalize();
      const fim = this.rajada(o, d, A.alcance, A.dano, v);
      this.risco(o, fim, 0xfff1a8);
      this.J.som.tom(620, 0.05, { tipo: 'square', vol: 0.12, ate: 280 });
      this.nRajada = (this.nRajada || 0) + 1;
      const s = this.J.sala(); if (s && this.nRajada % 3 === 0) s.enviar({ t: 'gx', k: 'rajada', o: [o.x, o.y, o.z].map((x) => +x.toFixed(2)), f: [fim.x, fim.y, fim.z].map((x) => +x.toFixed(2)) });
    }
  }

  // até onde o raio da mira vai: primeiro bloco, pessoa, jogador, veículo (menos o seu) ou alvo do forte
  miraAte(o, d, max, meuVeic) {
    let t = max;
    const hb = this.J.mundo().raycast(o, d, max); if (hb) t = hb.t;
    const hp = this.pessoas.atingir(o, d, t); if (hp) t = hp.t;
    const hj = this.atingirJogador(o, d, t); if (hj) t = hj.t;
    const hv = this.atingirVeiculo(o, d, t, meuVeic); if (hv) t = hv.t;
    for (const a of Object.values(this.alvos)) {
      if (this.destruido(a)) continue;
      const ta = raioCaixa(o, d, v1.set(a.x - 1.6, a.y - 0.5, a.z - 1.6), v2.set(a.x + 1.6, a.y + (a === this.alvos.radar ? 11 : 1.6), a.z + 1.6), t);
      if (ta >= 0) t = ta;
    }
    return t;
  }

  // tiro reto (metralhadora): acerta a primeira coisa no caminho; devolve onde parou
  rajada(o, d, alcance, dano, meuVeic) {
    const mundo = this.J.mundo();
    const hb = mundo.raycast(o, d, alcance);
    let t = hb ? hb.t : alcance, alvo = null;
    const hp = this.pessoas.atingir(o, d, t);
    if (hp) { t = hp.t; alvo = () => this.danoPessoa(hp.npc, hp.cabeca ? dano * 1.5 : dano, 'tiro'); }
    for (const a of Object.values(this.alvos)) {
      if (this.destruido(a)) continue;
      const hgt = a === this.alvos.radar ? 11 : 1.6;
      const ta = raioCaixa(o, d, v1.set(a.x - 1.6, a.y - 0.5, a.z - 1.6), v2.set(a.x + 1.6, a.y + hgt, a.z + 1.6), t);
      if (ta >= 0 && ta < t) { t = ta; alvo = () => this.danoAlvo(a, dano); }
    }
    const veic = this.J.garagem.veic;
    if (veic) {
      const hv = this.atingirVeiculo(o, d, t, meuVeic);
      if (hv) { t = hv.t; alvo = () => this.danoVeiculo(hv.v, 0.01 * dano); }
    }
    const hj = this.atingirJogador(o, d, t);
    if (hj) { t = hj.t; alvo = () => this.acertarJogador(hj.id); }
    if (alvo) alvo();
    return o.clone().addScaledVector(d, t);
  }

  atingirVeiculo(o, d, max, exceto) {
    const veic = this.J.garagem.veic;
    if (!veic) return null;
    let melhor = null;
    for (const v of veic.mapa.values()) {
      if (v === exceto) continue;
      const r = Math.max(v.d.L, v.d.W) / 2;
      const t = raioCaixa(o, d, v1.set(v.x - r * 0.8, v.y, v.z - r * 0.8), v2.set(v.x + r * 0.8, v.y + v.d.H, v.z + r * 0.8), melhor ? melhor.t : max);
      if (t >= 0) melhor = { t, v };
    }
    return melhor;
  }
  danoVeiculo(v, q) { const veic = this.J.garagem.veic; if (veic && veic.bater) veic.bater(v, q * (1 - (BLINDAGEM[v.tipo] ?? 0) * 0.7)); }

  atingirJogador(o, d, max) {
    let melhor = null;
    for (const [id, ou] of this.J.outros) {
      if (ou.sentado) continue;
      const p = ou.grupo.position;
      const t = raioCaixa(o, d, v1.set(p.x - 0.4, p.y, p.z - 0.4), v2.set(p.x + 0.4, p.y + 1.95, p.z + 0.4), melhor ? melhor.t : max);
      if (t >= 0) melhor = { t, id };
    }
    return melhor;
  }
  // metralhadora acertou outro jogador: a sala confere (você está no lugar do atirador, ele está no alcance) e manda o dano
  acertarJogador(id) {
    const s = this.J.sala();
    if (s) s.enviar({ t: 'gdano', alvo: id });
  }

  // bomba (canhão do tanque ou do forte): cai em arco e explode no que encostar
  lancarBomba(o, vel, op) {
    const m = new THREE.Mesh(this.geoBomba || (this.geoBomba = new THREE.SphereGeometry(0.22, 8, 6)), this.matBomba || (this.matBomba = new THREE.MeshBasicMaterial({ color: 0x2a2a2a })));
    m.position.copy(o);
    this.J.cena.add(m);
    this.projeteis.push({ m, p: o.clone(), v: vel.clone(), vida: 3.5, fumaca: 0, ...op });
  }

  atualizarProjeteis(dt) {
    const mundo = this.J.mundo();
    for (let i = this.projeteis.length - 1; i >= 0; i--) {
      const b = this.projeteis[i];
      b.vida -= dt;
      b.v.y -= b.g * dt;
      const passo = b.v.length() * dt;
      const d = v3.copy(b.v).normalize();
      let t = passo, bateu = false;
      const hb = mundo.raycast(b.p, d, passo);
      if (hb) { t = hb.t; bateu = true; }
      if (!b.visual) {
        const hp = this.pessoas.atingir(b.p, d, t); if (hp) { t = hp.t; bateu = true; }
        const hv = this.atingirVeiculo(b.p, d, t, b.meu ? this.J.garagem.dentro && this.J.garagem.dentro.v : null); if (hv) { t = hv.t; bateu = true; }
        if (b.meu) { const hj = this.atingirJogador(b.p, d, t); if (hj) { t = hj.t; bateu = true; } }
        if (b.inimigo) {
          const jp = this.J.jog().pos, g = this.J.garagem;
          const c = g.dentro ? { x: g.dentro.v.x, y: g.dentro.v.y + 0.8, z: g.dentro.v.z } : { x: jp.x, y: jp.y + 0.9, z: jp.z };
          const tj = raioCaixa(b.p, d, v1.set(c.x - 0.8, c.y - 0.9, c.z - 0.8), v2.set(c.x + 0.8, c.y + 1, c.z + 0.8), t);
          if (tj >= 0) { t = tj; bateu = true; }
        }
        for (const a of Object.values(this.alvos)) {
          if (!b.meu || this.destruido(a)) continue;
          const hgt = a === this.alvos.radar ? 11 : 1.6;
          const ta = raioCaixa(b.p, d, v1.set(a.x - 1.6, a.y - 0.5, a.z - 1.6), v2.set(a.x + 1.6, a.y + hgt, a.z + 1.6), t);
          if (ta >= 0) { t = ta; bateu = true; }
        }
      }
      b.p.addScaledVector(d, t);
      b.m.position.copy(b.p);
      b.fumaca -= dt;
      if (b.fumaca <= 0) { b.fumaca = 0.05; this.fumaca(b.p, 0.25, 0.5); }
      if (bateu || b.vida <= 0 || b.p.y < 1) {
        this.J.cena.remove(b.m);
        this.projeteis.splice(i, 1);
        this.explodir(b.p, b.raio, b.dano, b);
      }
    }
  }

  // explosão: efeito, som e dano em volta (pessoas, veículos, canhão/radar e o próprio jogador)
  explodir(p, raio, dano, op = {}) {
    const jp = this.J.jog().pos;
    const dj = Math.hypot(p.x - jp.x, p.y - (jp.y + 0.9), p.z - jp.z);
    // efeito
    const bola = new THREE.Mesh(this.geoExp || (this.geoExp = new THREE.SphereGeometry(1, 12, 8)), new THREE.MeshBasicMaterial({ color: 0xffa63d, transparent: true, opacity: 0.9, depthWrite: false }));
    bola.position.copy(p); bola.scale.setScalar(0.3);
    this.J.cena.add(bola);
    this.efeitos.push({ m: bola, t: 0, dur: 0.45, tipo: 'bola', raio });
    for (let k = 0; k < 6; k++) this.fumaca(p, 0.6 + Math.random() * 0.5, 1.4 + Math.random(), true);
    const vol = Math.max(0.05, 0.5 - dj / 160);
    this.J.som.tom(70, 0.5, { tipo: 'sawtooth', vol, ate: 30 });
    if (this.J.som.ruido) this.J.som.ruido(0.45, { vol: vol * 1.2, freq: 380 });
    if (dj < raio * 4) this.tremer = Math.max(this.tremer || 0, 0.35 * (1 - dj / (raio * 4)));
    if (op.visual) return;
    // pessoas
    for (const n of [...this.pessoas.lista]) {
      const d = Math.hypot(n.x - p.x, n.y + 0.9 - p.y, n.z - p.z);
      if (d < raio) this.danoPessoa(n, Math.max(1, Math.round(dano * (1 - d / raio))), 'explosao');
    }
    // veículos
    const veic = this.J.garagem.veic;
    if (veic) for (const v of veic.mapa.values()) {
      const d = Math.hypot(v.x - p.x, v.y + 1 - p.y, v.z - p.z);
      if (d < raio + 1.5) this.danoVeiculo(v, 0.45 * (1 - d / (raio + 1.5)));
    }
    // canhão e radar
    if (op.meu) for (const a of Object.values(this.alvos)) {
      const d = Math.hypot(a.x - p.x, a.z - p.z) - 1.2, dy = p.y - a.y;
      if (d < raio && dy > -1.5 && dy < (a === this.alvos.radar ? 12 : 3)) this.danoAlvo(a, Math.max(2, Math.round(dano * (1 - Math.max(0, d) / raio))));
    }
    // o próprio jogador (as bombas do forte, ou a sua própria bomba de perto)
    if (dj < raio) this.ferir(Math.max(1, Math.round((op.inimigo ? 5 : 3) * (1 - dj / raio))), null);
    // online: a sala confere e machuca quem estiver perto (só bomba de tanque)
    if (op.meu) { const s = this.J.sala(); if (s) s.enviar({ t: 'gexp', p: [p.x, p.y, p.z].map((x) => +x.toFixed(2)) }); }
  }

  // ---------- efeitos ----------
  risco(a, b, cor) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: cor, transparent: true, opacity: 0.9 }));
    this.J.cena.add(l);
    this.efeitos.push({ m: l, t: 0, dur: 0.09, tipo: 'risco' });
  }
  fumaca(p, tam, dur, explosao = false) {
    const m = new THREE.Mesh(this.geoFum || (this.geoFum = new THREE.BoxGeometry(1, 1, 1)), new THREE.MeshBasicMaterial({ color: explosao ? 0x6a6a6a : 0x9a9a9a, transparent: true, opacity: 0.7, depthWrite: false }));
    m.position.copy(p); m.scale.setScalar(tam);
    if (explosao) m.position.add(v1.set((Math.random() - 0.5) * 1.5, Math.random() * 0.8, (Math.random() - 0.5) * 1.5));
    m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    this.J.cena.add(m);
    this.efeitos.push({ m, t: 0, dur, tipo: 'fumaca', sobe: explosao ? 1.6 : 0.4, tam });
  }
  nuvem(x, y, z) { for (let k = 0; k < 5; k++) this.fumaca(new THREE.Vector3(x, y, z), 0.5, 0.9, true); }
  atualizarEfeitos(dt) {
    for (let i = this.efeitos.length - 1; i >= 0; i--) {
      const e = this.efeitos[i];
      e.t += dt;
      const k = e.t / e.dur;
      if (e.tipo === 'bola') { e.m.scale.setScalar(0.3 + k * e.raio); e.m.material.opacity = 0.9 * (1 - k); }
      else if (e.tipo === 'fumaca') { e.m.position.y += e.sobe * dt; e.m.scale.setScalar(e.tam * (1 + k)); e.m.material.opacity = 0.7 * (1 - k); }
      else e.m.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { this.J.cena.remove(e.m); if (e.tipo !== 'fumaca' && e.tipo !== 'bola') e.m.geometry.dispose(); e.m.material.dispose(); this.efeitos.splice(i, 1); }
    }
    if (this.tremer > 0) {
      this.tremer = Math.max(0, this.tremer - dt);
      const c = this.J.camera, f = this.tremer * 0.5;
      c.position.x += (Math.random() - 0.5) * f; c.position.y += (Math.random() - 0.5) * f;
    }
  }

  // ---------- vagas de veículos (base, forte, delegacia) ----------
  cuidarVagas(jp) {
    const g = this.J.garagem, veic = g.veic;
    if (!veic || opcoesMundo.veiculos === false) return;
    const sala = this.J.sala();
    for (const L of this.ativos.keys()) {
      if (!L.vagas) continue;
      for (const vg of L.vagas) {
        if (Math.hypot(vg.x - jp.x, vg.z - jp.z) > 70) continue;
        const id = 'g' + vg.k, v = veic.mapa.get(id);
        const longe = v && !v.ocup.some(Boolean) && Math.hypot(v.x - vg.x, v.z - vg.z) > 30 && Math.hypot(v.x - jp.x, v.z - jp.z) > 50;
        if (v && !longe) continue;
        const y = L.y + 1.05;
        if (sala) {
          vg.pedido = vg.pedido || 0;
          if (performance.now() - vg.pedido < 8000) continue;
          vg.pedido = performance.now();
          sala.enviar({ t: 'gveic', k: vg.k, tipo: vg.tipo, p: [vg.x, y, vg.z], r: vg.r });
        } else {
          // mora na vaga (k): não vai para a garagem de ninguém; volta abastecido e consertado
          if (v) veic.remover(id);
          veic.criar({ id, tipo: vg.tipo, cor: 0, p: [vg.x, y, vg.z], r: vg.r, k: id, c: 1, d: 0 });
        }
      }
    }
  }

  // ---------- arsenal da base ----------
  pegarArsenal() {
    if (!this.ativo || this.el.arsenal.hidden) return;
    if (this.cdArsenal > 0) { this.J.aviso(`O arsenal está sendo reabastecido: ${Math.ceil(this.cdArsenal)} s`, 1500, 'ampulheta'); return; }
    this.cdArsenal = 45;
    const armas = this.J.armas();
    if (armas && armas.receber) {
      armas.receber({ tipo: 'arma', a: 'fuzil' });
      for (const m of ['media', 'media', 'leve', 'cartucho']) armas.receber({ tipo: 'municao', m });
    }
    vida.curar(10);
    this.J.som.tom(520, 0.1, { tipo: 'triangle', vol: 0.2 }); setTimeout(() => this.J.som.tom(780, 0.14, { tipo: 'triangle', vol: 0.2 }), 110);
    this.J.aviso(armas && armas.receber ? 'Fuzil, munição e vida cheia!' : 'Vida cheia!', 2000, 'mochila');
    this.progresso('arsenal');
  }

  // ---------- presídio ----------
  portaAberta(cela) {
    const m = this.J.mundo();
    const [x, y, z] = cela.porta;
    const b = m.bloco(x, y, z);
    return b !== E.PORTAO; // aberto pela energia (Portão aberto) ou serrado (ar)
  }

  // bater num bloco do presídio: o portão da cela vai sendo serrado; o resto é reforçado
  // devolve true quando o guerra.js cuidou do toque (o jogo não quebra o bloco)
  quebrarBloco(h) {
    if (!this.ativo || !h) return false;
    const F = this.ilha.lugar('forte');
    if (F && dentroRet(h.x, h.z, F)) {
      const ehAlvo = Object.values(this.alvos).some((a) => (a.blocos || []).some(([x, y, z]) => x === h.x && y === h.y && z === h.z) || (a.marca && a.marca[0] === h.x && a.marca[1] === h.y && a.marca[2] === h.z));
      if (ehAlvo) { this.J.aviso('Isso é blindado! Use o tanque ou as armas', 1600, 'tanque'); return true; }
      return false;
    }
    const P = this.ilha.lugar('prisao');
    if (!P || !dentroRet(h.x, h.z, P, 0.5) || h.y < P.y) return false;
    const cela = P.celas.find((c) => c.porta[0] === h.x && c.porta[2] === h.z && (h.y === c.porta[1] || h.y === c.porta[1] + 1));
    if (cela && h.b === E.PORTAO) {
      const k = cela.porta.join(',');
      const n = (this.serrando.get(k) || 0) + 1;
      this.serrando.set(k, n);
      this.J.som.tom(1200 + Math.random() * 300, 0.06, { tipo: 'sawtooth', vol: 0.12 });
      if (n < 12) { this.J.aviso(`Serrando a grade... ${n} de 12`, 700, 'algema'); return true; }
      this.serrando.delete(k);
      const m = this.J.mundo(), [x, y, z] = cela.porta;
      m.definir(x, y, z, AR); m.definir(x, y + 1, z, AR);
      this.portasAbertas.set(k, performance.now());
      this.J.aviso('A grade cedeu! Corra!', 1800, 'algema');
      return true;
    }
    if (h.b === E.ALAVANCA || h.b === E.ALAVANCA_LIGADA) return true;
    this.J.aviso('Parede reforçada do presídio', 1200, 'algema');
    return true;
  }

  prender() {
    const P = this.ilha.lugar('prisao');
    const g = this.J.garagem;
    if (!P || this.preso) return;
    if (g.dentro) g.sair();
    const estrelas = Math.max(1, this.procurado);
    const cela = P.celas[0];
    const m = this.J.mundo();
    // tranca: alavanca desligada e grade inteira
    const [ax, ay, az] = P.alavanca;
    if (m.bloco(ax, ay, az) === E.ALAVANCA_LIGADA) m.definir(ax, ay, az, E.ALAVANCA);
    const [x, y, z] = cela.porta;
    if (m.bloco(x, y, z) !== E.PORTAO) { m.definir(x, y, z, E.PORTAO); m.definir(x, y + 1, z, E.PORTAO); }
    this.confiscar();
    for (const n of this.extras) if (!n.removido) this.pessoas.remover(n);
    this.extras = [];
    for (const n of this.pessoas.lista) { n.ultimo = null; n.alerta = 0; }
    this.zerarProcurado();
    this.preso = { pena: 20 + 10 * estrelas, L: P, cela };
    this.J.cmd.teleportar(cela.x, P.y + 1.05, cela.z, Math.PI, 'Você foi preso!');
    vida.reiniciar();
    this.J.aviso('Preso! Espere a pena, serre a grade (bata no portão) ou peça a um amigo para puxar a alavanca', 6000, 'algema');
  }

  // preso perde as armas e a munição (quando sai, ganha a pistola de novo)
  confiscar() {
    const a = this.J.armas();
    if (!a || !a.slots) return;
    a.gatilho(false); a.mirar(false);
    a.slots = [null, null]; a.sel = -1;
    for (const k of Object.keys(a.reserva)) a.reserva[k] = 0;
    a.trocouArma(false);
  }

  atualizarPrisao(dt, jog) {
    const P = this.ilha.lugar('prisao');
    if (!P) return;
    const m = this.J.mundo(), jp = jog.pos;
    // alavanca: quem puxou estando perto abriu as celas
    const [ax, ay, az] = P.alavanca;
    const lav = this.ativos.has(P) ? m.bloco(ax, ay, az) : null;
    if (lav != null) {
      if (this.alavancaAntes === E.ALAVANCA && lav === E.ALAVANCA_LIGADA) {
        this.tAlavanca = 0;
        if (Math.hypot(jp.x - ax, jp.z - az) < 5) { this.progresso('liberta'); this.crime(0, 3, 'Celas abertas'); this.J.aviso('As celas abriram! Os presos estão fugindo', 2500, 'raio'); }
      }
      this.alavancaAntes = lav;
      // os guardas trancam de novo depois de um tempo (se ninguém estiver na sala de controle)
      if (lav === E.ALAVANCA_LIGADA) { this.tAlavanca = (this.tAlavanca || 0) + dt; if (this.tAlavanca > 90 && Math.hypot(jp.x - ax, jp.z - az) > 10) m.definir(ax, ay, az, E.ALAVANCA); }
      // grades serradas voltam a ser consertadas
      this.tPrisao -= dt;
      if (this.tPrisao <= 0) {
        this.tPrisao = 5;
        for (const c of P.celas) {
          const [x, y, z] = c.porta;
          if (m.bloco(x, y, z) !== AR || m.bloco(x, y + 1, z) !== AR) continue;
          const k = c.porta.join(','), quando = this.portasAbertas.get(k) || 0;
          if (performance.now() - quando < 60000 || Math.hypot(jp.x - x, jp.z - z) < 4) continue;
          if (this.preso && c === this.preso.cela) continue;
          m.definir(x, y, z, E.PORTAO); m.definir(x, y + 1, z, E.PORTAO);
          this.portasAbertas.delete(k);
        }
      }
    }
    if (!this.preso) { this.el.pena.hidden = true; return; }
    this.preso.pena -= dt;
    const fora = !dentroRet(jp.x, jp.z, P, 1.5);
    if (fora) {
      this.preso = null; this.el.pena.hidden = true;
      this.crime(0, 2, 'Fuga do presídio');
      this.progresso('fuga');
      return;
    }
    if (this.preso.pena <= 0) {
      this.preso = null; this.el.pena.hidden = true;
      this.J.cmd.teleportar(P.portao.x, P.y + 1.1, P.portao.z + 2, 0, 'Pena cumprida. Você está livre!');
      const a = this.J.armas(); if (a && a.renasceu) a.renasceu();
      return;
    }
    const s = Math.ceil(this.preso.pena);
    this.el.pena.hidden = false;
    this.el.pena.innerHTML = `${icone('algema')}<span>Preso: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</span><small>Serre a grade (bata no portão) ou espere</small>`;
  }

  // ---------- procurado: quem te vê, estrelas caindo e reforços ----------
  atualizarProcurado(dt, jog) {
    if (this.preso) return;
    if (this.procurado > 0) {
      if (this.vistoAgora) this.semVer = 0;
      else this.semVer += dt;
      if (this.semVer > 9 + 3 * this.procurado) {
        this.semVer = 0;
        this.procurado--;
        this.enviarEstrelas();
        if (this.procurado === 0) {
          this.J.aviso('Você despistou a polícia!', 2200, 'sirene');
          if (this.maxProcurado >= 3) this.progresso('despiste');
          this.maxProcurado = 0;
        } else this.J.aviso(`Despistando... ${this.procurado} ${this.procurado === 1 ? 'estrela' : 'estrelas'}`, 1500, 'sirene');
      }
      // reforços: policiais chegam de longe, a pé
      this.tReforco -= dt;
      if (this.tReforco <= 0) {
        this.tReforco = 3;
        this.extras = this.extras.filter((n) => !n.removido);
        if (this.extras.length < POLICIA_POR_ESTRELA[this.procurado]) this.reforco(jog.pos);
      }
    }
    this.desenharEstrelas();
  }

  reforco(jp) {
    const m = this.J.mundo();
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 12;
      const x = Math.floor(jp.x + Math.cos(a) * d) + 0.5, z = Math.floor(jp.z + Math.sin(a) * d) + 0.5;
      if (m.limite && (Math.abs(x) > m.limite - 2 || Math.abs(z) > m.limite - 2)) continue;
      const y = this.pessoas.chao(x, z, 62);
      if (y <= (m.nivelAgua || 20) + 0.5 || Math.abs(y - jp.y) > 14) continue;
      const n = this.pessoas.criar('policial', x, z, { y, casa: { x, z, r: 4 }, extra: true, alerta: 12, ultimo: { x: jp.x, z: jp.z } });
      this.extras.push(n);
      return n;
    }
    return null;
  }

  // ---------- caiu sem corações ----------
  // procurado com polícia perto: vai preso; senão volta para a Base Aliada. Devolve true (o main não faz mais nada).
  desmaiou() {
    if (!this.ativo) return false;
    const jog = this.J.jog();
    const a = this.J.armas();
    if (a && a.caiu) a.caiu();
    const el = $('#desmaio');
    if (el) { el.hidden = false; el.classList.remove('vai'); void el.offsetWidth; el.classList.add('vai'); setTimeout(() => { el.hidden = true; }, 2200); }
    setTimeout(() => {
      if (!this.ativo) return;
      if (this.procurado > 0 && this.policiaPerto(jog.pos, 45)) { this.prender(); return; }
      const base = this.ilha.lugar('base');
      if (this.preso) { const c = this.preso.cela; this.J.cmd.teleportar(c.x, this.preso.L.y + 1.05, c.z, Math.PI, 'Você acordou na cela'); }
      else if (base) this.J.cmd.teleportar(base.renascer.x, base.renascer.y, base.renascer.z, 0, 'Você foi resgatado e levado para a Base Aliada');
      this.zerarProcurado();
      vida.reiniciar(); vida.protegido = 4;
      if (a && a.renasceu && !this.preso) a.renasceu();
    }, 900);
    return true;
  }

  // ---------- rede ----------
  get rede() {
    return {
      gx: (m) => this.mensagem(m),
    };
  }

  mensagem(m) {
    if (!this.ativo) return;
    if (m.k === 'estrelas') this.estrelasDeOutro(m.id, m.n | 0);
    else if (m.k === 'tiro' && Array.isArray(m.o) && Array.isArray(m.d)) {
      const o = new THREE.Vector3(...m.o), d = new THREE.Vector3(...m.d).normalize();
      this.lancarBomba(o, d.multiplyScalar(70), { g: 9, raio: 4.2, dano: 0, visual: true });
      const jp = this.J.jog().pos;
      this.J.som.tom(90, 0.4, { tipo: 'sawtooth', vol: Math.max(0.03, 0.3 - o.distanceTo(v1.set(jp.x, jp.y, jp.z)) / 300), ate: 40 });
    } else if (m.k === 'rajada' && Array.isArray(m.o) && Array.isArray(m.f)) {
      this.risco(v1.set(...m.o), v2.set(...m.f), 0xfff1a8);
    } else if (m.k === 'dano' && !this.preso) {
      // outro jogador te acertou com a metralhadora ou a bomba de um veículo (a sala conferiu)
      this.ferir(Math.max(1, Math.min(5, m.n | 0)), { P: { nome: String(m.de || 'Alguém').slice(0, 16) } });
    }
  }

  // estrelas em cima da cabeça dos outros jogadores procurados
  estrelasDeOutro(id, n) {
    const o = this.J.outros.get(id);
    const antigo = this.estrelasDe.get(id);
    if (antigo) { antigo.parent && antigo.parent.remove(antigo); antigo.material.map.dispose(); antigo.material.dispose(); this.estrelasDe.delete(id); }
    if (!o || n <= 0) return;
    const cv = document.createElement('canvas');
    cv.width = 40 * n + 8; cv.height = 44;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(0, 0, cv.width, 44, 12); ctx.fill();
    for (let i = 0; i < n; i++) {
      const cx = 24 + i * 40, cy = 22;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 7 : 16; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      ctx.closePath(); ctx.fillStyle = '#ffd54a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#3b2f22'; ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    s.scale.set(cv.width / 80, 0.55, 1);
    s.position.y = 2.75;
    o.grupo.add(s);
    this.estrelasDe.set(id, s);
  }
}

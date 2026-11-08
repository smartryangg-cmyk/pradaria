// Garagem e direção: escolher um veículo, entrar, dirigir com o joystick, buzinar, levar amigos e guardar.
// Fica fora do main.js; o main só chama os ganchos (comecar, tocar, quadro, camera, rede...).
import * as THREE from '../vendor/three.module.min.js';
import { Veiculos, TIPOS, ORDEM, CORES_VEICULO } from './veiculos.js';
import { SOLIDO, AGUA } from './blocos.js';
import { montarBoneco } from './modelos.js';
import { opcoesMundo } from './opcoes-mundo.js';
import { icone } from './icones.js';

const $ = (s) => document.querySelector(s);
const MAX_LOCAL = 30;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

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
    this.montarTela();
    addEventListener('keydown', (e) => {
      if (!this.veic || e.target.tagName === 'INPUT' || e.repeat) return;
      if (e.code === 'KeyV') { if (this.dentro) this.sair(); else { const v = this.pertoDeMim(); if (v) this.pedirEntrar(v); } }
      else if (e.code === 'KeyH') this.buzinar();
      else if (e.code === 'KeyG') this.abrir();
    });
  }

  get eu() { return this.J.sala() ? this.J.euId() : 'eu'; }

  // ---------- tela ----------
  montarTela() {
    const topo = $('#topo');
    const bt = document.createElement('button');
    bt.id = 'bt-garagem'; bt.className = 'redondo'; bt.setAttribute('aria-label', 'Veículos'); bt.innerHTML = icone('carro');
    bt.addEventListener('click', () => this.abrir());
    topo.insertBefore(bt, $('#status-linha') || $('#status'));

    const hud = $('#hud');
    const caixa = document.createElement('div');
    caixa.id = 'veic-botoes';
    caixa.innerHTML = `
      <div id="velo" hidden><b>0</b><small>km/h</small></div>
      <button id="bt-veic-entrar" class="pilula" hidden></button>
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
    $('#bt-buzina').addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.buzinar(); }, { passive: false });
    $('#bt-buzina').addEventListener('mousedown', (e) => { e.stopPropagation(); this.buzinar(); });

    const jan = document.createElement('div');
    jan.id = 'garagem'; jan.className = 'janela'; jan.hidden = true;
    jan.innerHTML = `<div class="caixa">
      <h2>Garagem</h2>
      <p class="sub">Escolha a cor e o veículo. Ele aparece na sua frente!</p>
      <div id="garagem-cores"></div>
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
      b.innerHTML = `<span class="ic"></span><span class="nm"></span><small></small>`;
      b.querySelector('.ic').innerHTML = icone(t);
      b.querySelector('.nm').textContent = d.nome;
      b.querySelector('small').textContent = d.assentos.length === 1 ? '1 lugar' : d.assentos.length + ' lugares';
      b.addEventListener('click', () => { this.J.som.clique(); this.fechar(); this.novo(t, this.corSel); });
      grade.appendChild(b);
    }
    $('#garagem-fechar').addEventListener('click', () => this.fechar());
  }

  abrir() {
    if (!this.veic || !this.ligados()) return;
    if (document.pointerLockElement) document.exitPointerLock();
    let algum = false;
    for (const b of document.querySelectorAll('#garagem-grade .veiculo')) { b.hidden = !this.permitido(b.dataset.tipo); algum = algum || !b.hidden; }
    if (!algum) { this.J.aviso('Ainda não existem veículos nesta época', 2200, 'ampulheta'); return; }
    $('#garagem').hidden = false;
    this.J.pausar(true);
  }
  fechar() { $('#garagem').hidden = true; this.J.pausar(false); }

  ligados() { return opcoesMundo.veiculos !== false; }

  // ---------- ciclo do mundo ----------
  comecar(mundo, salvos = []) {
    this.parar();
    this.veic = new Veiculos(this.J.cena, mundo, this.J.som);
    for (const s of salvos || []) this.veic.criar(s);
    for (const v of this.veic.mapa.values()) { const n = parseInt(String(v.id).slice(1), 10); if (n >= this.veic.seq) this.veic.seq = n + 1; }
    $('#bt-garagem').hidden = !this.ligados();
    this.atualizarHud();
  }

  parar() {
    if (this.dentro) this.sairLocal(true);
    if (this.veic) { for (const o of this.J.outros.values()) o.sentado = false; this.veic.limpar(); }
    this.veic = null;
    this.J.som.motor(null);
    $('#bt-veic-entrar').hidden = true;
    $('#garagem').hidden = true;
  }

  lista() { return this.veic ? this.veic.lista() : []; }

  // ---------- ações ----------
  novo(tipo, cor) {
    if (!TIPOS[tipo] || !this.permitido(tipo)) return;
    const jog = this.J.jog(), d = TIPOS[tipo];
    if (this.dentro) this.sair();
    const fx = -Math.sin(jog.yaw), fz = -Math.cos(jog.yaw);
    const yaw = Math.round(jog.yaw / (Math.PI / 2)) * (Math.PI / 2);
    const lugar = this.acharLugar(d, jog.pos, fx, fz, yaw);
    if (!lugar) { this.J.aviso(d.meio === 'agua' ? 'O barco precisa de água bem pertinho' : 'Não cabe aqui. Tente num lugar mais aberto', 2600, d.meio === 'agua' ? 'gota' : tipo); return; }
    if (this.J.sala()) {
      this.pedido = Math.floor(Math.random() * 1e9);
      this.J.sala().enviar({ t: 'vnovo', tipo, cor, p: lugar, r: yaw, n: this.pedido });
    } else {
      // limite de veículos no mundo: o mais antigo vazio vai embora
      if (this.veic.mapa.size >= MAX_LOCAL) for (const v of this.veic.mapa.values()) if (!v.ocup.some(Boolean)) { this.veic.remover(v.id); break; }
      const v = this.veic.criar({ id: 'L' + this.veic.seq++, tipo, cor, p: lugar, r: yaw });
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
    for (let dist = d.L / 2 + 1.2; dist < (d.meio === 'agua' ? 24 : d.L / 2 + 6); dist += 1) {
      const x = pos.x + fx * dist, z = pos.z + fz * dist;
      const bx = Math.floor(x), bz = Math.floor(z);
      let topo = null, agua = false;
      for (let by = Math.floor(pos.y) + 4; by > pos.y - 12 && by > 0; by--) {
        const b = m.bloco(bx, by, bz);
        if (SOLIDO[b] || AGUA[b]) { topo = by + 1; agua = !!AGUA[b]; break; }
      }
      if (topo === null) continue;
      if (d.meio === 'agua' && !agua) continue;
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
    jog.voando = false; jog.vel.x = jog.vel.y = jog.vel.z = 0;
    jog.yaw = 0; jog.pitch = -0.22;
    this.ultYaw = 0; this.ultPitch = jog.pitch;
    document.body.classList.add('dirigindo');
    $('#bt-voar').classList.remove('ligado');
    J.som.porta();
    const d = v.d;
    if (a === 0) J.aviso(d.meio === 'ar' ? 'Acelere para decolar e use as setas para subir e descer' : d.meio === 'helice' ? 'Use as setas para subir e descer' : 'Use o joystick para dirigir', 3000, v.tipo);
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
    if (v.ocup.some((q, i) => q && q !== this.eu && i !== this.dentro.a)) { this.J.aviso('Espere todo mundo descer', 1800, 'amigos'); return; }
    if (this.J.sala()) { this.J.sala().enviar({ t: 'vguardar', id: v.id }); this.sair(); return; }
    this.sairLocal();
    this.veic.remover(v.id);
    this.J.aviso('Veículo guardado', 1400, 'estacionar');
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
    $('#bt-veic-guardar').hidden = !motorista;
    $('#velo').hidden = !motorista;
    if (dentro) {
      const voa = motorista && (this.dentro.v.d.meio === 'ar' || this.dentro.v.d.meio === 'helice');
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
    const meu = this.dentro && this.dentro.a === 0 ? this.dentro.v : null;
    if (meu && !pausado) {
      const obst = [];
      for (const b of J.bichos().lista) obst.push(b);
      const al = J.aldeoes();
      if (al) for (const a of al.lista) obst.push(a);
      for (const o of J.outros.values()) if (!o.sentado) obst.push(o.grupo.position);
      this.veic.dirigir(meu, dt, { frente: ent.frente, lado: ent.lado, subir: ent.pular, descer: ent.descer }, obst);
      const d = meu.d;
      J.som.motor(Math.min(1, Math.abs(meu.vel) / d.vmax), d.grave || 1, d.som);
      $('#velo b').textContent = Math.round(Math.abs(meu.vel) * 3.6);
      // rede: posição do veículo ~10x por segundo
      const sala = J.sala();
      if (sala) {
        this.acumRede += dt;
        if (this.acumRede > 0.1) {
          this.acumRede = 0;
          sala.enviar({ t: 'vmov', id: meu.id, p: [+meu.x.toFixed(2), +meu.y.toFixed(2), +meu.z.toFixed(2)], r: [+meu.yaw.toFixed(3), +meu.pitch.toFixed(2), +meu.roll.toFixed(2)], s: +meu.vel.toFixed(1) });
        }
      }
    } else if (this.dentro) {
      const v = this.dentro.v;
      J.som.motor(v.ocup[0] ? Math.min(1, Math.abs(v.vel) / v.d.vmax) : null, v.d.grave || 1, v.d.som);
    }
    this.veic.atualizar(dt, meu, jog.pos);

    if (this.dentro) {
      // o jogador "fica" no assento (para carregar o mundo e os bichos em volta)
      const p = this.veic.posAssento(this.dentro.v, this.dentro.a);
      jog.pos.x = p.x; jog.pos.y = p.y - 0.75; jog.pos.z = p.z;
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
      return true;
    }
    this.veic.empurrar(jog.pos);
    const perto = this.pertoDeMim();
    $('#bt-veic-entrar').hidden = !perto;
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

  // ---------- rede ----------
  // depois do "ola": coloca os veículos e quem está sentado neles
  ola(msg) {
    if (!this.veic) return;
    if (this.dentro) this.sairLocal(true);
    for (const id of [...this.veic.mapa.keys()]) this.veic.remover(id);
    for (const o of this.J.outros.values()) o.sentado = false;
    for (const d of msg.veiculos || []) {
      const v = this.veic.criar(d);
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
        V.aplicarPose(msg.id, msg.p, msg.r, msg.s);
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

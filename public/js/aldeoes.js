// Aldeões: moradores das vilas. Passeiam pelas ruas e pela praça, cuidam das plantações,
// acenam para quem chega e conversam com um toque. À noite voltam para casa e dormem.
import * as THREE from '../vendor/three.module.min.js';
import { caixa, juntar, matModelo } from './modelos.js';
import { SOLIDO, AGUA, M } from './blocos.js';
import { ANEL } from './vilas.js';

const NOMES = ['Dona Cida', 'Seu Zé', 'Tia Lu', 'Juca', 'Nina', 'Vô Bento', 'Vó Lurdes', 'Tonico', 'Marieta', 'Dona Flor',
  'Seu Lima', 'Bia', 'Chico', 'Rosinha', 'Tião', 'Dona Neném', 'Pedrinho', 'Lia', 'Seu Bené', 'Iaiá', 'Dito', 'Zefa', 'Quinzinho', 'Cecília'];
const PELES = [0xf5d5b8, 0xf1c8a0, 0xd9a273, 0xb87a4f, 0x8a5534, 0x6b3f25];
const CABELOS = [0x2b1d14, 0x5a3a22, 0x8a5a2b, 0xd9b061, 0xb0472b, 0xdedad2, 0x161616];
const ROUPAS = [0xe06b5a, 0x5aa0e0, 0x6cc04a, 0xf2c72e, 0xb07ad9, 0xf29ac2, 0x4fb3a8, 0xe8913c];
const CALCAS = [0x3a4a6a, 0x5a3d22, 0x4a4a4a, 0x2f5d8a, 0x6b5a3a];

const FALAS = {
  geral: ['Bom dia!', 'Que dia lindo!', 'Já fez carinho numa capivara hoje?', 'Bem-vindo à {vila}!', 'Adoro morar aqui na {vila}.',
    'Cuidado com as flores!', 'Você constrói muito bem!', 'O Caramelo passou por aqui agora há pouco', 'Olha que nuvem bonita!',
    'Vamos ser amigos?', 'Já bebeu água do poço da praça?', 'Aqui a noite é clarinha, não precisa ter medo',
    'Que tal construir uma casa aqui do lado?', 'Oi, oi!'],
  fazendeiro: ['O trigo está crescendo bonito!', 'Hoje vou colher trigo para fazer pão', 'As galinhas botaram muitos ovos!', 'Plantar é muito legal! Quer tentar?'],
  padeiro: ['Acabei de fazer pão quentinho!', 'Bolo de fubá saindo do forno!', 'Quer um pãozinho de queijo?'],
  pescador: ['O mar está calminho hoje', 'Vi um peixinho colorido!', 'Adoro o barulho das ondas'],
  artesao: ['Estou fazendo uma cadeira nova', 'Tábua por tábua se faz uma casa!', 'Gostou do telhado da minha casa?'],
  florista: ['Essas flores são para você!', 'Flor azul é a minha preferida', 'Plantei flores na praça'],
  lojista: ['A loja está aberta!', 'Hoje chegou mercadoria nova', 'Quer vender alguma coisa? É só pedir!', 'Se precisar de ajuda, me contrata!'],
  noite: ['Boa noite! Hora de dormir', 'Zzz...', 'Amanhã a gente brinca mais!'],
};
const PRESENTES = ['maca', 'milho', 'cenoura', 'pao', 'flor', 'morango', 'ovo', 'bolo']; // nomes de ícones (icones.js)

function malha(geo) { const m = new THREE.Mesh(geo, matModelo); m.castShadow = true; return m; }
function membro(geos, x, y, z) { const m = malha(juntar(geos)); m.position.set(x, y, z); return m; }

// bonequinho de aldeão (frente = +z, pés em y=0)
export function montarAldeao(r, oficio) {
  const pick = (l) => l[Math.floor(r() * l.length)];
  const pele = pick(PELES), cab = pick(CABELOS), roupa = pick(ROUPAS), calca = pick(CALCAS);
  const g = new THREE.Group();
  const corpo = [caixa(0.52, 0.62, 0.3, roupa, 0, 0.93, 0)];
  if (oficio === 'fazendeiro') corpo.push(caixa(0.46, 0.5, 0.04, 0x3f6fa0, 0, 0.88, 0.15), caixa(0.08, 0.14, 0.04, 0x3f6fa0, -0.15, 1.18, 0.15), caixa(0.08, 0.14, 0.04, 0x3f6fa0, 0.15, 1.18, 0.15));
  if (oficio === 'padeiro') corpo.push(caixa(0.44, 0.52, 0.04, 0xfafafa, 0, 0.86, 0.15));
  if (oficio === 'lojista') corpo.push(caixa(0.44, 0.52, 0.04, 0x3f8f5a, 0, 0.86, 0.15), caixa(0.12, 0.08, 0.02, 0xf2c72e, 0.12, 1.08, 0.18));
  if (oficio === 'artesao') corpo.push(caixa(0.16, 0.6, 0.32, 0x7a5634, -0.19, 0.94, 0), caixa(0.16, 0.6, 0.32, 0x7a5634, 0.19, 0.94, 0));
  if (oficio === 'florista') corpo.push(caixa(0.54, 0.22, 0.32, roupa, 0, 0.66, 0)); // saia rodada
  g.add(malha(juntar(corpo)));

  const cabeca = [caixa(0.46, 0.46, 0.44, pele, 0, 0.23, 0),
    caixa(0.07, 0.09, 0.02, 0x222222, -0.1, 0.26, 0.225), caixa(0.07, 0.09, 0.02, 0x222222, 0.1, 0.26, 0.225),
    caixa(0.06, 0.07, 0.05, pele, 0, 0.18, 0.24), caixa(0.14, 0.035, 0.02, 0x8a3a30, 0, 0.1, 0.225),
    caixa(0.07, 0.04, 0.02, 0xf08a8a, -0.16, 0.15, 0.223), caixa(0.07, 0.04, 0.02, 0xf08a8a, 0.16, 0.15, 0.223)];
  const estilo = r();
  if (cab === 0xdedad2 && estilo < 0.5) cabeca.push(caixa(0.06, 0.18, 0.4, cab, -0.24, 0.3, -0.02), caixa(0.06, 0.18, 0.4, cab, 0.24, 0.3, -0.02), caixa(0.5, 0.18, 0.06, cab, 0, 0.3, -0.22));
  else {
    cabeca.push(caixa(0.5, 0.12, 0.48, cab, 0, 0.49, 0), caixa(0.5, 0.3, 0.1, cab, 0, 0.32, -0.2));
    if (estilo < 0.35) cabeca.push(caixa(0.5, 0.42, 0.1, cab, 0, 0.12, -0.22), caixa(0.06, 0.32, 0.3, cab, -0.25, 0.25, -0.06), caixa(0.06, 0.32, 0.3, cab, 0.25, 0.25, -0.06)); // cabelo comprido
    else if (estilo < 0.55) cabeca.push(caixa(0.2, 0.2, 0.2, cab, 0, 0.6, -0.14)); // coque
  }
  if (oficio === 'fazendeiro') cabeca.push(caixa(0.82, 0.05, 0.82, 0xe8c46a, 0, 0.5, 0), caixa(0.48, 0.2, 0.46, 0xe8c46a, 0, 0.61, 0), caixa(0.49, 0.05, 0.47, 0xb0472b, 0, 0.55, 0));
  if (oficio === 'padeiro') cabeca.push(caixa(0.5, 0.28, 0.48, 0xfafafa, 0, 0.62, 0));
  if (oficio === 'pescador') cabeca.push(caixa(0.5, 0.12, 0.48, 0x3f6fd9, 0, 0.53, 0), caixa(0.4, 0.04, 0.22, 0x3f6fd9, 0, 0.48, 0.32));
  if (oficio === 'florista') cabeca.push(caixa(0.13, 0.13, 0.06, 0xe8433f, 0.2, 0.47, 0.14), caixa(0.05, 0.05, 0.02, 0xffe066, 0.2, 0.47, 0.175));
  const cab3 = malha(juntar(cabeca));
  cab3.position.y = 1.24;
  g.add(cab3);

  const bd = membro([caixa(0.18, 0.4, 0.2, roupa, 0, -0.2, 0), caixa(0.16, 0.18, 0.18, pele, 0, -0.49, 0)], -0.35, 1.2, 0);
  const be = membro([caixa(0.18, 0.4, 0.2, roupa, 0, -0.2, 0), caixa(0.16, 0.18, 0.18, pele, 0, -0.49, 0)], 0.35, 1.2, 0);
  const pd = membro([caixa(0.22, 0.52, 0.24, calca, 0, -0.26, 0), caixa(0.23, 0.1, 0.27, 0x3b2a1e, 0, -0.57, 0.01)], -0.13, 0.62, 0);
  const pe = membro([caixa(0.22, 0.52, 0.24, calca, 0, -0.26, 0), caixa(0.23, 0.1, 0.27, 0x3b2a1e, 0, -0.57, 0.01)], 0.13, 0.62, 0);
  g.add(bd, be, pd, pe);
  return { grupo: g, cabeca: cab3, bracos: [bd, be], pernas: [pd, pe] };
}

// balãozinho de fala
export function balao(texto) {
  const linhas = [];
  for (const palavra of texto.split(' ')) {
    const ult = linhas[linhas.length - 1];
    if (ult && (ult + ' ' + palavra).length <= 22) linhas[linhas.length - 1] = ult + ' ' + palavra;
    else linhas.push(palavra);
  }
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d');
  const fonte = 'bold 30px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.font = fonte;
  const w = Math.ceil(Math.max(...linhas.map((l) => ctx.measureText(l).width))) + 36;
  const lh = 38, h = linhas.length * lh + 24;
  cv.width = w; cv.height = h + 16;
  ctx.font = fonte;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.roundRect(2, 2, w - 4, h - 4, 18); ctx.fill();
  ctx.beginPath(); ctx.moveTo(w / 2 - 12, h - 3); ctx.lineTo(w / 2, h + 14); ctx.lineTo(w / 2 + 12, h - 3); ctx.fill();
  ctx.fillStyle = '#3a2a1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  linhas.forEach((l, i) => ctx.fillText(l, w / 2, 14 + lh * (i + 0.5)));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(cv.width / 130, cv.height / 130, 1);
  s.center.set(0.5, 0);
  s.renderOrder = 11;
  return s;
}

export class Aldeoes {
  constructor(cena, mundo, som, emoji) {
    this.cena = cena; this.mundo = mundo; this.som = som; this.emoji = emoji;
    this.lista = [];
    this.povoadas = new Set();
    this.checar = 0;
    this.vilaAtual = null;
    this.aoEntrarVila = null;
  }

  // chão perto de yRef (ou de cima para baixo, se yRef for null)
  solo(x, z, yRef) {
    const m = this.mundo, bx = Math.floor(x), bz = Math.floor(z);
    let y = yRef == null ? 62 : Math.floor(yRef) + 2;
    const fim = yRef == null ? 1 : yRef - 6;
    for (; y > fim && y > 0; y--) {
      const b = m.bloco(bx, y - 1, bz);
      if (SOLIDO[b] || AGUA[b]) return y;
    }
    return null;
  }

  // ---------- caminhos pela vila ----------
  pontoRua(v, ri, t) { const r = v.ruas[ri]; return [v.x + r.dx * t + 0.5, v.z + r.dz * t + 0.5]; }

  rota(a, v, de, para) {
    const pts = [];
    if (de.est) { if (de.dentro) pts.push([de.est.frente[0] + 0.5, de.est.frente[1] + 0.5]); pts.push(this.pontoRua(v, de.est.rua, de.est.t)); }
    const ruaDe = de.est ? de.est.rua : de.rua, ruaPara = para.est ? para.est.rua : para.rua;
    const tPara = para.est ? para.est.t : para.t;
    if (ruaDe !== ruaPara) {
      // contorna o poço pelo anel da praça
      let i = v.ruas[ruaDe].anel; const j = v.ruas[ruaPara].anel;
      const passo = ((j - i + 8) % 8) <= 4 ? 1 : -1;
      pts.push([v.x + ANEL[i][0] + 0.5, v.z + ANEL[i][1] + 0.5]);
      while (i !== j) { i = (i + passo + 8) % 8; pts.push([v.x + ANEL[i][0] + 0.5, v.z + ANEL[i][1] + 0.5]); }
    }
    pts.push(this.pontoRua(v, ruaPara, tPara));
    if (para.est) { pts.push([para.est.frente[0] + 0.5, para.est.frente[1] + 0.5]); if (para.dentro) pts.push([para.est.dentro[0] + 0.5, para.est.dentro[1] + 0.5]); }
    a.caminho = pts;
    a.no = para;
  }

  escolherDestino(a, noite) {
    const v = a.vila;
    if (noite && a.casa) { if (!(a.no.est === a.casa && a.no.dentro)) this.rota(a, v, a.no, { est: a.casa, dentro: true }); return; }
    const r = Math.random();
    const ests = v.estruturas.filter((e) => e.frente);
    // de dia, o padeiro trabalha na padaria e o lojista na loja da vila
    const trabalho = a.oficio === 'padeiro' ? v.padaria : a.oficio === 'lojista' ? v.loja : null;
    if (trabalho && r < 0.65) { if (!(a.no.est === trabalho && a.no.dentro)) this.rota(a, v, a.no, { est: trabalho, dentro: true }); else a.espera = 6 + Math.random() * 8; return; }
    if (r < 0.3 && ests.length) {
      const e = a.oficio === 'fazendeiro' && v.fazendas.length && Math.random() < 0.6 ? v.fazendas[Math.floor(Math.random() * v.fazendas.length)] : ests[Math.floor(Math.random() * ests.length)];
      this.rota(a, v, a.no, { est: e, dentro: e === a.casa && Math.random() < 0.5 });
    } else if (r < 0.5) {
      this.rota(a, v, a.no, { rua: Math.floor(Math.random() * v.ruas.length), t: 3 });
    } else {
      const ri = Math.floor(Math.random() * v.ruas.length);
      this.rota(a, v, a.no, { rua: ri, t: 5 + Math.floor(Math.random() * v.ruas[ri].L) });
    }
  }

  // ---------- nascer / sumir ----------
  povoar(v) {
    this.povoadas.add(v);
    const semCasa = v.casas.filter((c) => c.tipo === 'casa');
    const lugares = [];
    for (const c of semCasa.slice(0, 4)) lugares.push({ casa: c, est: c });
    for (const f of v.fazendas.slice(0, 1)) lugares.push({ casa: null, est: f, oficio: 'fazendeiro' });
    while (lugares.length < 2) lugares.push({ casa: null, est: null });
    lugares.forEach((l, i) => {
      const r = Math.random;
      let oficio = l.oficio;
      if (!oficio) {
        const op = v.estilo === 'praia' ? ['pescador', 'pescador', 'padeiro', 'florista', 'artesao'] : ['fazendeiro', 'padeiro', 'artesao', 'florista'];
        oficio = op[Math.floor(r() * op.length)];
        // a padaria e a loja da vila sempre têm quem trabalhe nelas
        if (i === 0 && v.padaria) oficio = 'padeiro';
        if (i === 1 && v.loja) oficio = 'lojista';
      }
      const mod = montarAldeao(r, oficio);
      const no = l.est ? { est: l.est, dentro: false } : { rua: i % v.ruas.length, t: 3 };
      const [x, z] = l.est ? [l.est.frente[0] + 0.5, l.est.frente[1] + 0.5] : this.pontoRua(v, no.rua, 3);
      const y = this.solo(x, z, null) ?? v.y + 1;
      const a = {
        ...mod, vila: v, casa: l.casa, oficio, nome: NOMES[Math.floor(r() * NOMES.length)],
        x, y, z, vy: 0, dir: Math.random() * 6.28, no, caminho: [], espera: 1 + Math.random() * 4,
        fase: Math.random() * 10, aceno: 0, falando: 0, balao: null, preso: 0, cumprimentou: 0, zzz: 2 + Math.random() * 3,
        tom: 0.85 + Math.random() * 0.5, raio: 0.35, alt: 1.85,
      };
      a.grupo.position.set(x, y, z);
      this.cena.add(a.grupo);
      this.lista.push(a);
    });
  }

  remover(i) {
    const a = this.lista[i];
    if (a.balao) this.tirarBalao(a);
    this.cena.remove(a.grupo);
    a.grupo.traverse((o) => o.geometry && o.geometry.dispose());
    this.lista.splice(i, 1);
  }

  limpar() { for (let i = this.lista.length - 1; i >= 0; i--) this.remover(i); this.povoadas.clear(); }

  tirarBalao(a) { a.grupo.remove(a.balao); a.balao.material.map.dispose(); a.balao.material.dispose(); a.balao = null; }

  // ---------- conversa ----------
  conversar(a, jog, noite) {
    const v = a.vila;
    let lista = noite && a.no.dentro ? FALAS.noite : Math.random() < 0.45 ? FALAS[a.oficio] : FALAS.geral;
    const fala = lista[Math.floor(Math.random() * lista.length)].replace('{vila}', v.nome);
    if (a.balao) this.tirarBalao(a);
    a.balao = balao(`${a.nome}: ${fala}`);
    a.balao.position.y = 2.15;
    a.grupo.add(a.balao);
    a.falando = 4.5; a.aceno = 1.4; a.espera = Math.max(a.espera, 5);
    a.dir = Math.atan2(jog.pos.x - a.x, jog.pos.z - a.z);
    // voz: "blá-blá" curtinho
    for (let k = 0; k < 3; k++) this.som.tom((300 + Math.random() * 180) * a.tom, 0.07, { tipo: 'triangle', vol: 0.22, atraso: k * 0.11, ate: (360 + Math.random() * 160) * a.tom });
    if (!noite && Math.random() < 0.35) {
      const p = PRESENTES[Math.floor(Math.random() * PRESENTES.length)];
      this.emoji(p, a.x + Math.sin(a.dir) * 0.6, a.y + 1.1, a.z + Math.cos(a.dir) * 0.6, 2, 0.55);
    }
  }

  atingir(o, dir, max) {
    let melhor = null, tm = max;
    const O = [o.x, o.y, o.z], D = [dir.x, dir.y, dir.z];
    for (const a of this.lista) {
      if (!a.grupo.visible) continue;
      const r = a.raio;
      const min = [a.x - r, a.y, a.z - r], mx = [a.x + r, a.y + a.alt, a.z + r];
      let t0 = 0, t1 = tm, ok = true;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(D[k]) < 1e-8) { if (O[k] < min[k] || O[k] > mx[k]) { ok = false; break; } continue; }
        let ta = (min[k] - O[k]) / D[k], tb = (mx[k] - O[k]) / D[k];
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        if (t0 > t1) { ok = false; break; }
      }
      if (ok && t0 < tm) { tm = t0; melhor = a; }
    }
    return melhor ? { aldeao: melhor, t: tm } : null;
  }

  // ---------- a cada quadro ----------
  atualizar(dt, jog, altSol) {
    const p = jog.pos;
    const noite = altSol < -0.15;
    this.checar -= dt;
    if (this.checar <= 0) {
      this.checar = 1;
      const perto = this.mundo.vilas.perto(p.x, p.z, 90);
      for (const v of perto) if (!this.povoadas.has(v) && Math.hypot(v.x - p.x, v.z - p.z) < 65) this.povoar(v);
      for (const v of [...this.povoadas]) {
        if (Math.hypot(v.x - p.x, v.z - p.z) > 120) {
          for (let i = this.lista.length - 1; i >= 0; i--) if (this.lista[i].vila === v) this.remover(i);
          this.povoadas.delete(v);
        }
      }
      const aqui = perto.find((v) => Math.hypot(v.x + 0.5 - p.x, v.z + 0.5 - p.z) < v.raio + 2) || null;
      if (aqui && aqui !== this.vilaAtual && this.aoEntrarVila) this.aoEntrarVila(aqui);
      if (aqui || perto.every((v) => Math.hypot(v.x - p.x, v.z - p.z) > v.raio + 12)) this.vilaAtual = aqui;
    }

    for (const a of this.lista) {
      const dx = p.x - a.x, dz = p.z - a.z, dist = Math.hypot(dx, dz);
      a.grupo.visible = dist < 50;
      if (!a.grupo.visible) continue;

      // balão
      if (a.falando > 0) { a.falando -= dt; if (a.falando <= 0 && a.balao) this.tirarBalao(a); }
      // cumprimenta quem chega perto
      a.cumprimentou -= dt;
      if (dist < 3.5 && a.cumprimentou <= 0 && !(noite && a.no.dentro)) { a.cumprimentou = 25; a.aceno = 1.2; a.espera = Math.max(a.espera, 1.5); a.caminho.length && (a.pausa = 1.5); }

      let andando = false;
      if (a.falando > 0 || a.pausa > 0) {
        a.pausa = Math.max(0, (a.pausa || 0) - dt);
        a.dir = Math.atan2(dx, dz);
      } else if (a.caminho.length) {
        const [tx, tz] = a.caminho[0];
        const ex = tx - a.x, ez = tz - a.z, d = Math.hypot(ex, ez);
        if (d < 0.25) { a.caminho.shift(); a.preso = 0; if (!a.caminho.length) a.espera = noite ? 8 : 2 + Math.random() * 6; }
        else {
          andando = true;
          a.dir = Math.atan2(ex, ez);
          const vel = 1.35 * dt;
          const nx = a.x + (ex / d) * Math.min(vel, d), nz = a.z + (ez / d) * Math.min(vel, d);
          // porta fechada no caminho: o morador abre (e ela fecha sozinha depois)
          if (this.aoPorta) {
            const qx = Math.floor(nx + (ex / d) * 0.4), qz = Math.floor(nz + (ez / d) * 0.4);
            for (let k = 0; k <= 1; k++) if (this.mundo.bloco(qx, Math.floor(a.y) + k, qz) === M.PORTA) this.aoPorta(qx, Math.floor(a.y) + k, qz);
          }
          const s = this.solo(nx, nz, a.y);
          const subir = s == null ? -99 : s - a.y;
          const m = this.mundo;
          const livre = s != null && subir <= 1.05 && subir > -4 && !SOLIDO[m.bloco(Math.floor(nx), Math.floor(s), Math.floor(nz))] && !SOLIDO[m.bloco(Math.floor(nx), Math.floor(s) + 1, Math.floor(nz))];
          if (livre) { a.x = nx; a.z = nz; if (subir > 0.05 && a.vy === 0) a.vy = 6; }
          else {
            a.preso += dt;
            if (a.preso > 1.5) { // algo no caminho (talvez um bloco que alguém colocou): pula para o ponto
              a.x = tx; a.z = tz; a.y = this.solo(tx, tz, null) ?? a.y; a.vy = 0; a.preso = 0; a.caminho.shift();
            }
          }
        }
      } else {
        a.espera -= dt;
        if (a.espera <= 0) { this.escolherDestino(a, noite); a.espera = 3; }
        if (noite && a.no.dentro && dist < 22) { a.zzz -= dt; if (a.zzz <= 0) { a.zzz = 3; this.emoji('sono', a.x, a.y + 2, a.z, 1.6, 0.45); } }
      }
      // gravidade
      const s = this.solo(a.x, a.z, a.y);
      const piso = s == null ? a.y : s;
      a.vy -= 20 * dt; a.y += a.vy * dt;
      if (a.y <= piso) { a.y = piso; a.vy = 0; }

      // animação
      a.fase += dt * (andando ? 8 : 0);
      const bal = andando ? Math.sin(a.fase) * 0.6 : 0;
      a.pernas[0].rotation.x = bal; a.pernas[1].rotation.x = -bal;
      a.bracos[0].rotation.x = -bal * 0.8; a.bracos[1].rotation.x = bal * 0.8; a.bracos[1].rotation.z = 0;
      if (a.aceno > 0) {
        a.aceno -= dt;
        a.bracos[1].rotation.x = Math.PI; a.bracos[1].rotation.z = Math.sin(a.aceno * 14) * 0.35;
      }
      a.cabeca.rotation.x = !andando && dist < 6 ? -0.15 : 0;
      const atual = a.grupo.rotation.y;
      const delta = ((a.dir - atual + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      a.grupo.rotation.y = atual + delta * Math.min(1, dt * 7);
      a.grupo.position.set(a.x, a.y, a.z);
    }
  }
}

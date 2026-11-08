// Comandos visuais: teleportar (casa, começo, lugares salvos, amigos), mudar a hora e voltar.
// Tudo com botões grandes, sem precisar digitar nada.
import { NIVEL_AGUA } from './mundo.js';
import { icone, NOMES_ICONES, nomeLugar } from './icones.js';

const $ = (s) => document.querySelector(s);
const ICONES = ['estrela', 'arvore', 'castelo', 'onda', 'montanha', 'flor', 'ovelha', 'maca', 'diamante', 'casa'];
const MAX_LUGARES = 8;
const CHAVE_LOCAL = 'pradaria.lugares.local';
const CHAVE_RECUSAR = 'pradaria.tp.recusar';
const HORAS = [
  { v: 0.2, ic: 'manha', nome: 'Manhã' },
  { v: 0.27, ic: 'sol', nome: 'Meio-dia' },
  { v: 0.47, ic: 'porsol', nome: 'Pôr do sol' },
  { v: 0.72, ic: 'lua', nome: 'Noite' },
];

// j: { aviso, som, jog(), mundo(), sala(), modo(), mundoAtual(), outros, acharInicio(), definirDia(v), pausar(sim) }
export function criarComandos(j) {
  let lugares = { casa: null, lista: [] };
  let dono = false;
  let voltar = null; // onde estava antes do último teleporte
  let escolhendoIcone = false;
  let pedidoAtual = null; // pedido de teleporte que chegou e espera resposta
  let esperando = null; // {nome, timer}: meu pedido esperando o amigo
  let recusar = false;
  try { recusar = localStorage.getItem(CHAVE_RECUSAR) === '1'; } catch {}

  const online = () => j.modo() === 'online' && !!j.sala();

  // ---------- teleporte ----------
  function teleportar(x, y, z, yaw, txt) {
    const jog = j.jog(), mundo = j.mundo();
    if (!jog || !mundo) return;
    voltar = [jog.pos.x, jog.pos.y, jog.pos.z, jog.yaw];
    // não deixa ninguém nascer dentro de um bloco: sobe até achar espaço livre
    let yy = Math.max(1, y);
    for (let i = 0; i < 80 && jog.colide(x, yy, z); i++) yy += 1;
    Object.assign(jog.pos, { x, y: yy, z });
    jog.vel.x = jog.vel.y = jog.vel.z = 0;
    if (Number.isFinite(yaw)) jog.yaw = yaw;
    mundo.atualizar(x, z, 250); // já monta o chão em volta
    const sala = j.sala();
    if (sala) sala.enviar({ t: 'pos', p: [+x.toFixed(2), +yy.toFixed(2), +z.toFixed(2)], r: [+jog.yaw.toFixed(2), +jog.pitch.toFixed(2)] });
    brilho();
    j.som.oi();
    if (txt) j.aviso(txt, 2000, 'brilho');
    fechar();
  }

  function brilho() {
    const el = $('#flash-tp');
    el.classList.remove('vai'); void el.offsetWidth; el.classList.add('vai');
  }

  function irPara(p, txt) { teleportar(p[0], p[1], p[2], p[3], txt); }

  function irComeco() {
    const p = j.acharInicio();
    teleportar(p.x, p.y, p.z, 0, 'Você voltou para o começo do mundo');
  }

  // um lugar bem longe, em terra firme, para explorar
  function irLonge() {
    const jog = j.jog(), mundo = j.mundo();
    if (!jog || !mundo) return;
    for (let t = 0; t < 16; t++) {
      const a = Math.random() * Math.PI * 2, d = 250 + Math.random() * 650;
      const x = Math.floor(jog.pos.x + Math.cos(a) * d), z = Math.floor(jog.pos.z + Math.sin(a) * d);
      if (Math.abs(x) > 90000 || Math.abs(z) > 90000) continue;
      const h = mundo.chao(x, z);
      if (h > mundo.nivelAgua + 1 && h < mundo.nivelAgua + 30) { teleportar(x + 0.5, h + 1.2, z + 0.5, a, 'Uau, um lugar novo para explorar!', 'mapa'); return; }
    }
    j.aviso('Não achei terra firme agora, tente de novo', 1800, 'onda');
  }

  // ---------- casa e lugares salvos ----------
  function posAtual() {
    const p = j.jog().pos;
    return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +j.jog().yaw.toFixed(2)];
  }
  function guardarLugares() {
    if (online()) j.sala().enviar({ t: 'lugares', casa: lugares.casa, lista: lugares.lista });
    else try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(lugares)); } catch {}
  }
  function marcarCasa() {
    lugares.casa = posAtual();
    guardarLugares();
    j.som.colocar();
    j.aviso('Aqui agora é a sua casa', 1800, 'casa');
    desenhar();
  }
  function salvarLugar(ic) {
    if (lugares.lista.length >= MAX_LUGARES) lugares.lista.shift();
    lugares.lista.push({ ic, p: posAtual() });
    guardarLugares();
    j.som.colocar();
    j.aviso('Lugar guardado!', 1500, ic);
    escolhendoIcone = false;
    desenhar();
  }
  function apagarLugar(i) {
    lugares.lista.splice(i, 1);
    guardarLugares();
    j.som.clique();
    desenhar();
  }

  // ---------- amigos ----------
  function pedirAmigo(id, tipo) {
    const o = j.outros.get(id);
    if (!o || !online()) return;
    j.sala().enviar({ t: 'tp-pedir', para: id, tipo });
    clearTimeout(esperando && esperando.timer);
    esperando = { nome: o.nome, timer: setTimeout(() => { esperando = null; j.aviso(`${o.nome} não respondeu agora`, 2200); }, 31000) };
    j.som.clique();
    j.aviso(tipo === 'ir' ? `Perguntei para ${o.nome} se você pode ir até lá…` : `Chamei ${o.nome} para vir até você…`, 2600, 'ampulheta');
    fechar();
  }

  function mostrarPedido(m) {
    if (recusar) { j.sala().enviar({ t: 'tp-resp', pid: m.pid, ok: false }); return; }
    if (pedidoAtual) j.sala().enviar({ t: 'tp-resp', pid: pedidoAtual.pid, ok: false });
    pedidoAtual = m;
    $('#pedido-txt').textContent = m.tipo === 'ir' ? `${m.nome} quer vir até você` : `${m.nome} está chamando você para ir até lá`;
    $('#pedido-ic').innerHTML = icone(m.tipo === 'ir' ? 'acenar' : 'brilho');
    $('#pedido-tp').hidden = false;
    j.som.oi();
    clearTimeout(mostrarPedido.t);
    mostrarPedido.t = setTimeout(() => responder(false, true), 28000);
  }
  function responder(ok, silencioso) {
    if (!pedidoAtual) return;
    if (j.sala()) j.sala().enviar({ t: 'tp-resp', pid: pedidoAtual.pid, ok });
    if (!silencioso) j.som.clique();
    pedidoAtual = null;
    $('#pedido-tp').hidden = true;
  }
  $('#pedido-sim').addEventListener('click', () => responder(true));
  $('#pedido-nao').addEventListener('click', () => responder(false));

  // ---------- hora do dia ----------
  function mudarHora(h) {
    if (online()) {
      if (!dono) { j.aviso('Só o dono do mundo muda a hora', 1800, 'cadeado'); return; }
      j.sala().enviar({ t: 'dia', v: h.v });
    } else j.definirDia(h.v);
    j.som.clique();
    j.aviso(`${h.nome}!`, 1400, h.ic);
    fechar();
  }

  // ---------- desenho da janela ----------
  function botao(ic, txt, fn, cls = '') {
    const b = document.createElement('button');
    b.className = 'cmd ' + cls;
    b.innerHTML = '<span class="ic"></span><span class="tx"></span>';
    // ícone do jogo (SVG) quando existe; senão, o desenho em emoji
    if (NOMES_ICONES.includes(ic)) b.querySelector('.ic').innerHTML = icone(ic);
    else b.querySelector('.ic').textContent = ic;
    b.querySelector('.tx').textContent = txt;
    b.addEventListener('click', fn);
    return b;
  }
  function passos(p) {
    const q = j.jog().pos;
    const d = Math.round(Math.hypot(p[0] - q.x, p[2] - q.z));
    return d < 3 ? 'aqui pertinho' : `${d} passos`;
  }

  function desenhar() {
    if (!j.jog()) return;
    // lugares
    const g = $('#cmd-lugares');
    g.innerHTML = '';
    if (lugares.casa) g.appendChild(botao('casa', 'Ir para casa', () => irPara(lugares.casa, 'Chegou em casa!'), 'verde'));
    g.appendChild(botao('pino', lugares.casa ? 'Mudar casa para cá' : 'Marcar casa aqui', marcarCasa));
    g.appendChild(botao('broto', 'Começo do mundo', irComeco));
    g.appendChild(botao('mapa', 'Lugar novo bem longe', irLonge));
    if (voltar) g.appendChild(botao('voltar', 'Voltar para onde eu estava', () => irPara(voltar, 'Voltou!')));

    const s = $('#cmd-salvos');
    s.innerHTML = '';
    lugares.lista.forEach((l, i) => {
      const b = botao(nomeLugar(l.ic), passos(l.p), () => irPara(l.p, 'Chegou no lugar!'), 'salvo');
      const x = document.createElement('span');
      x.className = 'apagar'; x.innerHTML = icone('fechar'); x.setAttribute('role', 'button'); x.setAttribute('aria-label', 'Apagar lugar');
      x.addEventListener('click', (e) => { e.stopPropagation(); apagarLugar(i); });
      b.appendChild(x);
      s.appendChild(b);
    });
    if (escolhendoIcone) {
      const esc = document.createElement('div');
      esc.className = 'icones';
      const t = document.createElement('p'); t.className = 'sub'; t.textContent = 'Escolha um desenho para este lugar:';
      esc.appendChild(t);
      for (const ic of ICONES) {
        const b = document.createElement('button'); b.innerHTML = icone(ic); b.setAttribute('aria-label', 'Desenho ' + ic);
        b.addEventListener('click', () => salvarLugar(ic));
        esc.appendChild(b);
      }
      s.appendChild(esc);
    } else {
      s.appendChild(botao('mais', lugares.lista.length >= MAX_LUGARES ? 'Guardar (troca o mais velho)' : 'Guardar este lugar', () => { escolhendoIcone = true; j.som.clique(); desenhar(); }));
    }

    // amigos
    const a = $('#cmd-amigos');
    a.innerHTML = '';
    if (!online()) {
      a.innerHTML = '<p class="vazio">Jogando sem internet. Entre num mundo com código para jogar com amigos!</p>';
    } else if (!j.outros.size) {
      a.innerHTML = '<p class="vazio">Nenhum amigo neste mundo agora. Passe o código do mundo para eles!</p>';
    } else {
      for (const [id, o] of j.outros) {
        const l = document.createElement('div');
        l.className = 'amigo';
        const n = document.createElement('b'); n.textContent = o.nome;
        const d = document.createElement('small'); d.textContent = passos([o.grupo.position.x, 0, o.grupo.position.z]);
        const nome = document.createElement('span'); nome.append(n, d);
        l.append(nome, botao('entrar', 'Ir até', () => pedirAmigo(id, 'ir'), 'mini verde'), botao('acenar', 'Chamar', () => pedirAmigo(id, 'chamar'), 'mini'));
        a.appendChild(l);
      }
    }
    $('#cmd-recusar').checked = recusar;
    $('#cmd-recusar-linha').hidden = !online();

    // hora
    const h = $('#cmd-horas');
    h.innerHTML = '';
    const pode = !online() || dono;
    for (const x of HORAS) h.appendChild(botao(x.ic, x.nome, () => mudarHora(x), pode ? '' : 'trancado'));
    const dn = j.mundoAtual() && j.mundoAtual().nome_dono;
    $('#cmd-hora-aviso').textContent = pode ? (online() ? 'Muda a hora para todo mundo neste mundo.' : '') : `Só ${dn || 'o dono do mundo'} pode mudar a hora aqui.`;

    const p = j.jog().pos;
    $('#cmd-onde').textContent = `Você está em ${Math.floor(p.x)}, ${Math.floor(p.y)}, ${Math.floor(p.z)}`;
  }

  $('#cmd-recusar').addEventListener('change', (e) => {
    recusar = e.target.checked;
    try { localStorage.setItem(CHAVE_RECUSAR, recusar ? '1' : '0'); } catch {}
  });

  function abrir() {
    if (!j.jog()) return;
    if (document.pointerLockElement) document.exitPointerLock();
    escolhendoIcone = false;
    desenhar();
    $('#comandos').hidden = false;
    j.pausar(true);
  }
  function fechar() {
    if ($('#comandos').hidden) return;
    $('#comandos').hidden = true;
    j.pausar(false);
  }
  $('#comandos [data-fechar-cmd]').addEventListener('click', () => { j.som.clique(); fechar(); });

  return {
    abrir, fechar, teleportar,
    casa: () => lugares.casa, // [x, y, z, yaw] ou null
    // ao entrar num mundo
    entrouLocal() {
      dono = true; voltar = null; pedidoAtual = null; $('#pedido-tp').hidden = true;
      try { lugares = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || 'null') || { casa: null, lista: [] }; } catch { lugares = { casa: null, lista: [] }; }
    },
    entrouOnline(msg) {
      dono = !!msg.dono; voltar = null; pedidoAtual = null; $('#pedido-tp').hidden = true;
      lugares = msg.lugares && typeof msg.lugares === 'object' ? { casa: msg.lugares.casa || null, lista: msg.lugares.lista || [] } : { casa: null, lista: [] };
    },
    saiu() {
      clearTimeout(esperando && esperando.timer); esperando = null;
      pedidoAtual = null; $('#pedido-tp').hidden = true; fechar();
    },
    // mensagens da sala
    rede: {
      'tp-pedido': mostrarPedido,
      'tp-resp': (m) => {
        clearTimeout(esperando && esperando.timer); esperando = null;
        if (!m.ok) j.aviso(`${m.nome} disse "agora não"`, 2200, 'sorriso');
        else if (m.tipo === 'chamar') j.aviso(`${m.nome} está vindo!`, 2000, 'brilho');
      },
      'tp-ir': (m) => {
        if (!Array.isArray(m.p)) return;
        teleportar(m.p[0], m.p[1], m.p[2], undefined, `Você está com ${m.nome}!`);
      },
      'tp-erro': (m) => { clearTimeout(esperando && esperando.timer); esperando = null; j.aviso(m.msg || 'Não deu certo', 2200); },
      dia: (m) => {
        j.definirDia(m.v);
        if (m.nome && j.mundoAtual() && m.nome !== j.nomeEu()) j.aviso(`${m.nome} mudou a hora`, 1600, 'relogio');
      },
    },
  };
}

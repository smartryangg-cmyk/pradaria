// Mundo "Linha do Tempo" no jogo: experiência do mundo, missões, barra da era, painel da linha do tempo,
// blocos liberados por era e a viagem no tempo. As regras (quanto vale cada coisa) estão em eras-regras.js,
// que também roda na sala do servidor: online quem decide é a sala; sem internet, este arquivo mesmo.
import { ERAS, ULTIMA, estadoNovo, normalizar, aplicarEvento, avancar, podeAvancar, progresso, missao } from './eras-regras.js';
import { BE } from './blocos-eras.js';
import { B, E, BLOCOS, INVENTARIO, INVENTARIO_MAQUINAS } from './blocos.js';
import { icone } from './icones.js';
import { ESPECIES } from './modelos.js';
import { lugaresPerto } from './gerador-eras.js';

// ---------- blocos que cada era libera (vale também tudo das eras anteriores) ----------
const NATUREZA = [B.GRAMA, B.TERRA, B.PEDRA, B.AREIA, B.AGUA, B.TRONCO, B.FOLHAS, B.FLOR_VERMELHA, B.FLOR_AMARELA, B.FLOR_AZUL, B.CAPIM];
export const BLOCOS_DA_ERA = [
  [...NATUREZA, BE.MUSGO, BE.SAMAMBAIA, BE.CAVALINHA, BE.TRONCO_PALMEIRA, BE.FOLHA_PALMEIRA, BE.BASALTO, BE.PEDRA_LAVA, BE.OVO_DINO],
  [BE.NEVE, BE.BLOCO_NEVE, BE.GELO, BE.FOLHAS_NEVE, BE.PELE, BE.FOSSIL],
  [BE.FOGUEIRA, BE.PALHA, BE.BARRO, BE.PINTURA_RUPESTRE, B.TABUAS, B.PEDRISCO, B.FENO, B.TERRA_ARADA, B.TRIGO],
  [BE.ARENITO, BE.ARENITO_ENTALHADO, BE.MARMORE, BE.COLUNA, BE.TERRACOTA, BE.MOSAICO, BE.OURO, B.TIJOLO, B.LA_BRANCA, B.LA_VERMELHA, B.LA_AZUL, B.LA_AMARELA, B.LA_VERDE, B.LA_ROSA],
  [BE.PEDRA_CASTELO, BE.ENXAIMEL, BE.ESTANDARTE, BE.VITRAL, B.VIDRO, B.LAMPIAO],
  [BE.TIJOLO_FABRICA, BE.FERRO, BE.ENGRENAGEM, BE.CARVAO],
  [BE.CONCRETO, BE.ASFALTO, BE.ASFALTO_FAIXA, BE.VIDRO_AZUL, BE.AZULEJO, BE.LUZ_LED],
  [BE.PAINEL_SOLAR, BE.METAL_BRANCO, BE.NEON, BE.CRISTAL],
];
const ERA_DO_BLOCO = new Int8Array(256).fill(-1);
BLOCOS_DA_ERA.forEach((l, i) => { for (const b of l) if (ERA_DO_BLOCO[b] < 0) ERA_DO_BLOCO[b] = i; });
// máquinas (engenharia) chegam na Era Industrial; os estados "ligado" seguem a peça
for (const id of Object.values(E)) if (ERA_DO_BLOCO[id] < 0) ERA_DO_BLOCO[id] = 5;
// todos os blocos do modo história, na ordem do inventário
export const INVENTARIO_HISTORIA = [...new Set([...BLOCOS_DA_ERA.flat(), ...INVENTARIO])];
// ferramentas e itens (ids de 1000 para cima) não são blocos de era: valem desde o começo
export const eraDoBloco = (b) => (b >= 0 && b < 256 && ERA_DO_BLOCO[b] > 0 ? ERA_DO_BLOCO[b] : 0);
export const blocoLiberado = (b, era) => eraDoBloco(b) <= era;
export const MAQUINAS_ERA = 5;
export { INVENTARIO_MAQUINAS };

// veículos (garagem.js) liberados por era
const VEICULO_ERA = { bicicleta: 5, skate: 5, barco: 5, trator: 5, carro: 6, jipe: 6, esportivo: 6, quadriciclo: 6, moto: 6, caminhao: 6, onibus: 6, aviao: 6, helicoptero: 6 };
export const veiculoLiberado = (tipo, era) => era >= (VEICULO_ERA[tipo] ?? 6);

// barra inicial de cada era (quando o mundo chega nela)
export const BARRA_DA_ERA = [
  [BE.MUSGO, B.TERRA, B.PEDRA, BE.BASALTO, BE.TRONCO_PALMEIRA, BE.FOLHA_PALMEIRA, BE.SAMAMBAIA, BE.OVO_DINO, B.AREIA],
  [BE.BLOCO_NEVE, BE.GELO, B.PEDRA, BE.PELE, B.TRONCO, BE.FOLHAS_NEVE, BE.NEVE, B.TERRA, BE.FOSSIL],
  [BE.FOGUEIRA, BE.PALHA, BE.BARRO, B.TRONCO, B.TABUAS, B.PEDRA, BE.PINTURA_RUPESTRE, B.FENO, B.TRIGO],
  [BE.ARENITO, BE.MARMORE, BE.COLUNA, BE.TERRACOTA, BE.MOSAICO, BE.ARENITO_ENTALHADO, BE.OURO, B.TIJOLO, B.LA_AZUL],
  [BE.PEDRA_CASTELO, BE.ENXAIMEL, B.TABUAS, BE.VITRAL, BE.ESTANDARTE, B.VIDRO, B.LAMPIAO, B.TRONCO, B.LA_VERMELHA],
  [BE.TIJOLO_FABRICA, BE.FERRO, BE.ENGRENAGEM, B.TIJOLO, B.VIDRO, B.LAMPIAO, BE.CARVAO, B.PEDRISCO, B.TABUAS],
  [BE.CONCRETO, BE.ASFALTO, BE.ASFALTO_FAIXA, BE.VIDRO_AZUL, BE.AZULEJO, BE.LUZ_LED, B.TIJOLO, B.GRAMA, B.FLOR_AMARELA],
  [BE.METAL_BRANCO, BE.CRISTAL, BE.NEON, BE.PAINEL_SOLAR, BE.VIDRO_AZUL, BE.CONCRETO, BE.LUZ_LED, B.GRAMA, B.FLOR_AZUL],
];

const NOME_LUGAR = {
  vulcao: 'o vulcão', ninho: 'um ninho de dinossauro', geleira: 'a geleira gigante', caverna: 'a caverna com pinturas', circulo: 'o círculo de pedras',
  piramide: 'a pirâmide', templo: 'o templo', castelo: 'o castelo', moinho: 'o moinho', fabrica: 'a fábrica', estacao: 'a estação de trem',
  predio: 'o arranha-céu', estadio: 'o estádio', foguete: 'o foguete', cupula: 'a cúpula de cristal',
};
const nomeBicho = (k) => (ESPECIES[k] && ESPECIES[k].nome) || k;
const icEra = (n) => ERAS[n].ic;

// ---------- estilo (fica aqui para não mexer no estilo.css de todo mundo) ----------
const CSS = `
#era-topo { position: absolute; top: calc(max(10px, env(safe-area-inset-top)) + 58px); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; pointer-events: none; max-width: calc(100vw - 24px); }
#era-hud { display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 8px; border-radius: 999px; background: var(--hud-fundo, rgba(30,30,40,.55)); color: #fff; font: inherit; font-weight: 800; font-size: 14px; border: 0; cursor: pointer; pointer-events: auto; min-width: 0; }
#era-hud[hidden] { display: none; }
#era-hud .ic-svg { width: 26px; height: 26px; flex: none; }
#era-hud .nome { white-space: nowrap; }
#era-hud .barra-xp { width: 110px; height: 10px; border-radius: 6px; background: rgba(255,255,255,.25); overflow: hidden; flex: none; }
#era-hud .barra-xp i { display: block; height: 100%; width: 0; background: var(--cor-era, #ffd54a); border-radius: 6px; transition: width .4s; }

#bt-viajar { display: none; flex: none; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 999px; border: 0; background: linear-gradient(#ffd54a, #ffb300); color: #3b2f22; font: inherit; font-weight: 900; font-size: 17px; box-shadow: 0 4px 0 #b77d00, 0 0 24px rgba(255,213,74,.8); cursor: pointer; pointer-events: auto; animation: era-pulsa 1.2s ease-in-out infinite; }
#bt-viajar .ic-svg { width: 26px; height: 26px; }
#bt-viajar.mostra { display: flex; }
@keyframes era-pulsa { 50% { transform: scale(1.07); } }
@media (max-width: 560px) { #era-hud .barra-xp { width: 60px; } #era-hud .nome { display: none; } }
#era-painel .caixa { max-width: 560px; }
#era-painel .linha-eras { display: flex; gap: 4px; overflow-x: auto; padding: 6px 2px 10px; }
#era-painel .era-p { flex: 1 0 58px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 2px; border-radius: 12px; background: #fff; border: 3px solid #e2d6bf; font-size: 11px; text-align: center; line-height: 1.1; }
#era-painel .era-p .ic-svg { width: 30px; height: 30px; }
#era-painel .era-p.passou { opacity: .65; }
#era-painel .era-p.agora { border-color: var(--cor-era, #5cbf4a); background: #f1fbe9; font-weight: 800; }
#era-painel .era-p.futura .ic-svg { filter: grayscale(1) brightness(.4); opacity: .5; }
#era-painel h3 { margin: 10px 0 4px; font-size: 16px; display: flex; align-items: center; gap: 6px; }
#era-painel h3 .ic-svg { width: 22px; height: 22px; }
#era-painel .missao { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 12px; background: #fff; margin: 4px 0; font-size: 14px; }
#era-painel .missao .ic-svg { width: 22px; height: 22px; flex: none; }
#era-painel .missao.feita { background: #e6f7dc; text-decoration: line-through; opacity: .8; }
#era-painel .missao .n { margin-left: auto; font-weight: 800; white-space: nowrap; }
#era-painel .album { display: flex; flex-wrap: wrap; gap: 6px; }
#era-painel .album span { padding: 5px 10px; border-radius: 999px; background: #fff; font-size: 13px; font-weight: 700; }
#era-painel .album span.nao { background: #eee; color: #999; }
#era-painel .xp-grande { height: 16px; border-radius: 9px; background: #e8e0cf; overflow: hidden; margin: 4px 0 2px; }
#era-painel .xp-grande i { display: block; height: 100%; background: var(--cor-era, #5cbf4a); }
#era-titulo { position: fixed; inset: 0; display: grid; place-items: center; pointer-events: none; z-index: 40; opacity: 0; transition: opacity .8s; background: radial-gradient(circle, rgba(255,255,255,.85), rgba(255,240,200,.6) 60%, rgba(255,230,160,0)); }
#era-titulo.mostra { opacity: 1; }
#era-titulo .dentro { text-align: center; color: #3b2f22; text-shadow: 0 2px 0 #fff; }
#era-titulo .quando { font-size: clamp(16px, 3vw, 26px); font-weight: 700; letter-spacing: .5px; }
#era-titulo .nome { font-size: clamp(30px, 7vw, 64px); font-weight: 900; line-height: 1.05; margin: 6px 0; }
#era-titulo .ic-svg { width: clamp(64px, 12vw, 120px); height: clamp(64px, 12vw, 120px); margin: 0 auto; }
#grade button.trancado { position: relative; opacity: .45; filter: grayscale(.8); }
#grade button.trancado .cad { position: absolute; right: 2px; bottom: 2px; width: 22px; height: 22px; }
#grade .sep-era { grid-column: 1 / -1; font-size: 13px; font-weight: 800; color: #6b5a44; display: flex; align-items: center; gap: 6px; margin-top: 6px; }
#grade .sep-era .ic-svg { width: 20px; height: 20px; }
`;

function criarDom() {
  if (document.getElementById('era-hud')) return;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const hud = document.getElementById('hud');
  hud.insertAdjacentHTML('beforeend', `
    <div id="era-topo"><button id="era-hud" hidden aria-label="Linha do Tempo"><span class="ic"></span><span class="nome"></span><span class="barra-xp"><i></i></span></button>
    <button id="bt-viajar"><span class="ic"></span><span>Viajar no tempo</span></button></div>`);
  document.body.insertAdjacentHTML('beforeend', `
    <div id="era-painel" class="janela" hidden><div class="caixa">
      <h2 id="ep-titulo"></h2><p class="sub" id="ep-quando"></p>
      <div class="xp-grande"><i id="ep-xp"></i></div><p class="sub" id="ep-xp-txt"></p>
      <div class="linha-eras" id="ep-eras"></div>
      <h3><span data-ic="alvo"></span>Missões da era</h3><div id="ep-missoes"></div>
      <h3><span data-ic="pata"></span>Bichos descobertos</h3><div class="album" id="ep-album"></div>
      <p class="sub" id="ep-dica"></p>
      <button class="bt verde" id="ep-viajar" hidden></button>
      <button class="bt" id="ep-fechar">Voltar a jogar</button>
    </div></div>
    <div id="era-titulo"><div class="dentro"><div class="ic"></div><div class="quando"></div><div class="nome"></div></div></div>`);
  for (const s of document.querySelectorAll('#era-painel [data-ic]')) s.outerHTML = icone(s.dataset.ic);
}

export class LinhaDoTempo {
  // ctx: { online, enviar(msg), aviso(txt, ms, ic), som, aoMudarEra(era, nome), pausar(sim) }
  constructor(ctx, estado) {
    this.ctx = ctx;
    this.e = normalizar(estado || estadoNovo());
    this.mem = {}; // esperas deste jogador (modo sem internet)
    this.visitados = new Set();
    this.tempoLugar = 0;
    this.lugaresAchadosAgora = new Set();
    criarDom();
    this.hud = document.getElementById('era-hud');
    this.btViajar = document.getElementById('bt-viajar');
    this.painel = document.getElementById('era-painel');
    this.titulo = document.getElementById('era-titulo');
    this.hud.hidden = false;
    this.hud.onclick = () => this.abrirPainel();
    this.btViajar.onclick = () => this.viajar();
    document.getElementById('ep-viajar').onclick = () => { this.fecharPainel(); this.viajar(); };
    document.getElementById('ep-fechar').onclick = () => this.fecharPainel();
    this.desenharHud();
  }

  get era() { return this.e.era; }

  destruir() {
    this.hud.hidden = true; this.btViajar.classList.remove('mostra'); this.painel.hidden = true;
    clearTimeout(this.timerTitulo); this.titulo.classList.remove('mostra');
  }

  // ---------- ações do jogador ----------
  evento(m, r) {
    if (this.ctx.online) {
      // online: colocar/quebrar a sala já conta sozinha pelo bloco que chega
      if (m !== 'colocar' && m !== 'quebrar') this.ctx.enviar({ t: 'xp', m, r });
      return;
    }
    const res = aplicarEvento(this.e, this.mem, { m, r });
    if (res) this.mudou(res.novidades, null);
  }

  // chamado a cada quadro com a posição do jogador: pedaços novos e lugares especiais
  atualizar(dt, mundo, pos) {
    const k = Math.floor(pos.x / 16) + ',' + Math.floor(pos.z / 16);
    if (!this.visitados.has(k)) { this.visitados.add(k); if (this.visitados.size > 1) this.evento('explorar'); }
    this.tempoLugar -= dt;
    if (this.tempoLugar > 0) return;
    this.tempoLugar = 1;
    for (const l of lugaresPerto(mundo, this.e.era, pos.x, pos.z)) {
      if (this.e.achados.includes(l.id) || this.lugaresAchadosAgora.has(l.id)) continue;
      if (Math.hypot(l.x - pos.x, l.z - pos.z) <= (l.raio || 12) + 4) { this.lugaresAchadosAgora.add(l.id); this.evento('achar', l.id); }
    }
  }

  // ---------- mensagens da sala (online) ----------
  receber(msg) {
    const antes = this.e.era;
    this.e = normalizar(msg.e);
    if (this.e.era !== antes) this.lugaresAchadosAgora.clear();
    this.mudou(msg.nov || [], msg.nome, antes);
  }

  mudou(novidades, nome, eraAntes = null) {
    for (const n of novidades) {
      if (n.t === 'descoberta') this.ctx.aviso(`Descoberta! ${nomeBicho(n.r)} (+${n.xp})`, 2600, 'pata');
      else if (n.t === 'achado') this.ctx.aviso(`Você achou ${NOME_LUGAR[n.r] || n.r}! (+${n.xp})`, 2800, 'mapa');
      else if (n.t === 'missao') { const m = missao(this.e.era, n.id); if (m) this.ctx.aviso(`Missão cumprida: ${m.txt} (+${n.xp})`, 3200, 'estrela'); this.ctx.som && this.ctx.som.oi && this.ctx.som.oi(); }
      else if (n.t === 'pronto') this.ctx.aviso('O mundo está pronto para viajar no tempo!', 3500, 'ampulheta');
    }
    if (eraAntes !== null && this.e.era !== eraAntes) this.chegouNaEra(nome);
    this.desenharHud();
    if (!this.painel.hidden) this.desenharPainel();
  }

  // ---------- viagem no tempo ----------
  viajar() {
    if (!podeAvancar(this.e)) { this.abrirPainel(); return; }
    if (this.ctx.online) { this.ctx.enviar({ t: 'era-avancar', de: this.e.era }); return; }
    const antes = this.e.era;
    avancar(this.e);
    this.lugaresAchadosAgora.clear();
    this.mudou([], null, antes);
  }

  chegouNaEra(nome) {
    const era = ERAS[this.e.era];
    this.mostrarTitulo(nome ? `${nome} viajou no tempo!` : 'Viagem no tempo...');
    this.ctx.aoMudarEra(this.e.era, nome);
    void era;
  }

  mostrarTitulo(antes) {
    const era = ERAS[this.e.era];
    const t = this.titulo;
    t.style.setProperty('--cor-era', era.cor);
    t.querySelector('.ic').innerHTML = icone(era.ic);
    t.querySelector('.quando').textContent = antes || era.quando;
    t.querySelector('.nome').textContent = era.nome;
    t.classList.add('mostra');
    clearTimeout(this.timerTitulo);
    this.timerTitulo = setTimeout(() => {
      t.querySelector('.quando').textContent = era.quando;
      this.timerTitulo = setTimeout(() => t.classList.remove('mostra'), 2600);
    }, 1800);
  }

  // ---------- tela ----------
  desenharHud() {
    const era = ERAS[this.e.era];
    this.hud.style.setProperty('--cor-era', era.cor);
    this.hud.querySelector('.ic').innerHTML = icone(era.ic);
    this.hud.querySelector('.nome').textContent = era.curto;
    this.hud.querySelector('.barra-xp i').style.width = Math.round(progresso(this.e) * 100) + '%';
    const pronto = podeAvancar(this.e);
    this.hud.classList.toggle('pronto', pronto);
    this.btViajar.querySelector('.ic').innerHTML = icone('viagem') || icone('ampulheta');
    this.btViajar.classList.toggle('mostra', pronto);
  }

  abrirPainel() {
    if (document.pointerLockElement) document.exitPointerLock();
    this.desenharPainel();
    this.painel.hidden = false;
    this.ctx.pausar(true);
  }
  fecharPainel() { this.painel.hidden = true; this.ctx.pausar(false); }

  desenharPainel() {
    const e = this.e, era = ERAS[e.era];
    const $ = (id) => document.getElementById(id);
    this.painel.style.setProperty('--cor-era', era.cor);
    $('ep-titulo').innerHTML = icone(era.ic) + ' ' + era.nome;
    $('ep-quando').textContent = era.quando;
    $('ep-xp').style.width = Math.round(progresso(e) * 100) + '%';
    $('ep-xp-txt').textContent = era.xp ? `Experiência do mundo: ${Math.floor(e.xp)} de ${era.xp}` : `Você chegou ao fim da linha do tempo! Experiência total: ${Math.floor(e.total)}`;
    const le = $('ep-eras'); le.innerHTML = '';
    ERAS.forEach((x, i) => {
      const d = document.createElement('div');
      d.className = 'era-p ' + (i < e.era ? 'passou' : i === e.era ? 'agora' : 'futura');
      d.innerHTML = (i > e.era ? icone('cadeado') : icone(x.ic)) + `<span>${i > e.era + 1 ? '???' : x.curto}</span>`;
      le.appendChild(d);
    });
    const lm = $('ep-missoes'); lm.innerHTML = '';
    for (const m of era.missoes) {
      const feita = e.feitas.includes(m.id);
      const d = document.createElement('div');
      d.className = 'missao' + (feita ? ' feita' : '');
      d.innerHTML = icone(feita ? 'estrela' : 'alvo') + '<span></span><span class="n"></span>';
      d.children[1].textContent = m.txt;
      d.children[2].textContent = feita ? `+${m.xp}` : `${e.miss[m.id] || 0}/${m.n}`;
      lm.appendChild(d);
    }
    const al = $('ep-album'); al.innerHTML = '';
    for (const k of era.fauna) {
      const s = document.createElement('span');
      const sim = e.desc.includes(k);
      s.className = sim ? '' : 'nao';
      s.textContent = sim ? nomeBicho(k) : '?';
      al.appendChild(s);
    }
    const pronto = podeAvancar(e);
    $('ep-viajar').hidden = !pronto;
    $('ep-viajar').innerHTML = pronto ? icone('viagem') + 'Viajar para: ' + ERAS[e.era + 1].nome : '';
    $('ep-dica').textContent = e.era === ULTIMA ? 'Continue construindo o futuro!'
      : pronto ? '' : (matchMedia('(pointer: coarse)').matches ? '' : 'Tecla L abre este painel. ') + 'Construa, faça carinho nos bichos, converse, explore e cumpra missões para o mundo evoluir.';
  }
}

export { ERAS, icEra };

// Som de verdade, jogando pela interface: mede o áudio que sai (analisador ligado na saída) no PC, tablet e celular.
// Passos por chão, quebrar/colocar por material, bichos com som 3D, motor que muda com a velocidade, vento/água,
// música opcional, volumes separados (Efeitos em 0 = silêncio) e sons do xadrez.
// Precisa de `npm run dev:sala` e `npm run dev` (portas 8790 e 8788). Grava uma amostra em $SAIDA/amostra-pc.webm.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import { writeFileSync } from 'fs';
const BASE = process.env.BASE || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) process.exitCode = 1; };

// liga um analisador (e um gravador) em tudo que chega na saída de som
function instrumentar() {
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (d, ...r) {
    const res = orig.call(this, d, ...r);
    if (typeof AudioDestinationNode !== 'undefined' && d instanceof AudioDestinationNode) {
      const c = this.context;
      if (!c.__an) { c.__an = c.createAnalyser(); c.__an.fftSize = 2048; c.__rec = c.createMediaStreamDestination(); window.__ctx = c; }
      orig.call(this, c.__an); orig.call(this, c.__rec);
    }
    return res;
  };
  // volume (RMS) máximo e médio durante ms
  window.__medir = (ms) => new Promise((ok) => {
    const an = window.__ctx && window.__ctx.__an;
    if (!an) return ok({ max: 0, media: 0 });
    const buf = new Float32Array(an.fftSize); let max = 0, soma = 0, n = 0;
    const iv = setInterval(() => {
      an.getFloatTimeDomainData(buf); let s = 0;
      for (const v of buf) s += v * v;
      const rms = Math.sqrt(s / buf.length); max = Math.max(max, rms); soma += rms; n++;
    }, 20);
    setTimeout(() => { clearInterval(iv); ok({ max: +max.toFixed(4), media: +(soma / Math.max(1, n)).toFixed(4) }); }, ms);
  });
  window.__gravar = () => {
    const rec = new MediaRecorder(window.__ctx.__rec.stream, { mimeType: 'audio/webm;codecs=opus' });
    const partes = []; rec.ondataavailable = (e) => partes.push(e.data); rec.start(500);
    window.__pararGravacao = () => new Promise((ok) => { rec.onstop = async () => { const bl = new Blob(partes, { type: 'audio/webm' }); const ab = await bl.arrayBuffer(); let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); ok(btoa(s)); }; rec.stop(); });
  };
}
// registra o que o som tocou (nome, material, lado 3D)
function registrar() {
  const s = window.__jogo.som; window.__log = [];
  for (const k of ['passo', 'quebrar', 'bater', 'colocar', 'abrir', 'fechar', 'clique', 'criar', 'notaMusica', 'convite']) {
    const f = s[k].bind(s);
    s[k] = (...a) => { window.__log.push({ k, m: typeof a[0] === 'string' || typeof a[0] === 'number' ? s.mat(a[0]) : null, pan: s._dest ? +(s._dest.__pan ?? 0).toFixed(2) : null, vol: s._dest ? +s._dest._vol.toFixed(2) : null }); return f(...a); };
  }
  const bicho = s.bicho.bind(s);
  s.bicho = (t, bravo, pos) => { if (pos) { const r = s.espacial(pos.x, pos.y, pos.z); window.__log.push({ k: 'bicho', t, pan: r ? +r.pan.toFixed(2) : null, vol: r ? +r.vol.toFixed(2) : null }); } return bicho(t, bravo, pos); };
  const no3D = s.no3D.bind(s);
  s.no3D = (r, d) => { const g = no3D(r, d); g.__pan = r.pan; return g; };
}
// leva o jogador para um chão firme e plano (sem água), para andar e mexer em blocos sem depender do lugar onde nasceu
const irParaChaoFirme = (p) => p.evaluate(() => {
  const J = window.__jogo, m = J.mundo, j = J.jog;
  const firme = (x, z) => { const y = m.chao(x, z); const b = m.bloco(x, y, z); return b && b !== 5 && !(b >= 23 && b <= 30) && !m.bloco(x, y + 1, z) && !m.bloco(x, y + 2, z) ? y : 0; };
  let melhor = null;
  for (let r = 0; r < 60 && !melhor; r += 2) for (let dx = -r; dx <= r && !melhor; dx += 2) for (let dz = -r; dz <= r && !melhor; dz += 2) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = Math.floor(j.pos.x) + dx, z = Math.floor(j.pos.z) + dz, y = firme(x, z);
    if (!y) continue;
    let plano = true;
    for (let k = -10; k <= 8 && plano; k++) if (firme(x + k, z) !== y) plano = false;
    if (plano) melhor = { x: x + 0.5, y: y + 1, z: z + 0.5 };
  }
  if (melhor) { j.pos.x = melhor.x; j.pos.y = melhor.y; j.pos.z = melhor.z; j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = Math.PI / 2; j.pitch = 0; }
  return !!melhor;
});
const conta = (p, k) => p.evaluate((k) => window.__log.filter((x) => x.k === k), k);

const DISP = [
  { nome: 'pc', vp: { width: 1280, height: 720 }, toque: false },
  { nome: 'tablet', vp: { width: 1024, height: 700 }, toque: true },
  { nome: 'celular', vp: { width: 390, height: 780 }, toque: true },
];
for (const d of DISP) {
  console.log('\n== ' + d.nome);
  const ctx = await b.newContext({ viewport: d.vp, hasTouch: d.toque, isMobile: d.toque, deviceScaleFactor: 1 });
  await ctx.addInitScript(instrumentar);
  const p = await ctx.newPage();
  const erros = [];
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  await p.goto(BASE + '/#teste');
  await p.waitForTimeout(600);
  await p.click('#bt-sozinho');
  // mundo criativo (blocos na mão) e sem mercado (garagem livre)
  // semente fixa: com o mundo sorteado, às vezes não tinha bicho perto ou o buraco cavado não deixava colocar o bloco
  if (await p.isVisible('#m-novo')) { await p.click('#m-novo summary'); await p.fill('#n-semente', 'som1'); await p.click('[data-modo=criativo]'); await p.click('#m-novo [data-opcao=veiculos]'); await p.click('#m-novo [data-opcao=esculpir]'); await p.click('#m-novo button[type=submit]'); }
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.som.ctx, null, { timeout: 20000 });
  await p.waitForTimeout(4000);
  await p.evaluate(registrar);
  if (d.nome === 'pc') await p.evaluate(() => window.__gravar());
  const estado = await p.evaluate(() => ({ st: window.__jogo.som.ctx.state, leve: window.__jogo.som.leve, max: window.__jogo.som.maxVozes }));
  ok(estado.st === 'running', `áudio ligado (${estado.st}), modo leve=${estado.leve}, limite de sons=${estado.max}`);
  // ambiente: vento/passarinhos
  await p.evaluate(() => { window.__jogo.dia = 0.3; });
  const amb = await p.evaluate(() => window.__medir(2500));
  // no aparelho lento o vento sobe devagar (o volume vai subindo quadro a quadro): espera um pouco por ele
  for (let k = 0; k < 10 && (await p.evaluate(() => window.__jogo.som.amb.ventoG.gain.value)) === 0; k++) await p.waitForTimeout(500);
  const vento = await p.evaluate(() => +window.__jogo.som.amb.ventoG.gain.value.toFixed(3));
  // o vento do jogo tem calmaria de ~35 s a cada 4 min (os cataventos param junto): aí o vento some de propósito
  const calmaria = await p.evaluate(async () => (await import('/js/energia.js')).vento() === 0);
  ok(amb.max > 0.001 && (vento > 0 || calmaria), `ambiente toca (vento ${vento}${calmaria ? ', calmaria agora' : ''}, RMS máx ${amb.max})`);
  console.log('     chão firme:', await irParaChaoFirme(p)); await p.waitForTimeout(1200);

  // vira para o lado mais aberto (sem parede nem morro na frente)
  const virarParaOAberto = () => p.evaluate(() => {
    const J = window.__jogo, m = J.mundo, j = J.jog;
    let melhor = 0, livre = -1;
    for (let k = 0; k < 8; k++) {
      const yaw = k * Math.PI / 4; let n = 0;
      for (let d = 2; d < 16; d++) {
        const x = Math.floor(j.pos.x - Math.sin(yaw) * d), z = Math.floor(j.pos.z - Math.cos(yaw) * d);
        if (Math.abs(m.alturaEm(x, z) - m.chao(x, z)) > 0 || m.chao(x, z) > j.pos.y + 1) break;
        n++;
      }
      if (n > livre) { livre = n; melhor = yaw; }
    }
    j.yaw = melhor; j.pitch = 0;
  });
  await virarParaOAberto();
  // passos: anda para frente segurando W (as setas/teclado valem também no tablet com teclado)
  await p.keyboard.down('KeyW');
  const andando = p.evaluate(() => window.__medir(2200));
  await p.waitForTimeout(2200);
  await p.keyboard.up('KeyW');
  const rp = await andando;
  const passos = await conta(p, 'passo');
  ok(passos.length >= 2, `passos ao andar: ${passos.length} (${[...new Set(passos.map((x) => x.m))].join(', ')}), RMS máx ${rp.max}`);

  // veículo: motor sobe o tom com a velocidade
  if (d.nome !== 'celular') {
    await p.evaluate(() => { const J = window.__jogo; if (J.mercado.veiculo) J.mercado.veiculo({ t: 'chave', tipo: 'carro' }); });
    await p.waitForTimeout(500);
    await virarParaOAberto();
    await p.evaluate(() => window.__jogo.garagem.novo('carro', 2));
    await p.waitForTimeout(300);
    console.log('     aviso:', await p.textContent('#aviso').catch(() => ''));
    await p.waitForFunction(() => window.__jogo.garagem.dentro, null, { timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(800);
    const parado = await p.evaluate(() => { const m = window.__jogo.som.motores.get('eu'); return m ? +m.o1.frequency.value.toFixed(1) : null; });
    await p.keyboard.down('KeyW'); await p.waitForTimeout(2500);
    const andandoF = await p.evaluate(() => { const m = window.__jogo.som.motores.get('eu'); return m ? +m.o1.frequency.value.toFixed(1) : null; });
    const vel = await p.evaluate(() => window.__jogo.garagem.dentro && +Math.abs(window.__jogo.garagem.dentro.v.vel).toFixed(1));
    await p.keyboard.up('KeyW');
    ok(parado && andandoF && andandoF > parado, `motor do carro: ${parado} Hz parado -> ${andandoF} Hz andando (vel ${vel})`);
    await p.screenshot({ path: `${SAIDA}/som-${d.nome}-carro.png` });
    await p.keyboard.press('KeyF').catch(() => {});
    await p.evaluate(() => { const g = window.__jogo.garagem; if (g.dentro && g.sair) g.sair(); });
    await p.waitForTimeout(600);
  }

  await p.evaluate(() => { window.__jogo.jog.yaw += Math.PI; }); // de costas para o carro que ficou estacionado
  // quebrar e colocar (olhando para o chão): som do material, vindo do bloco
  await p.evaluate(() => { const j = window.__jogo.jog; j.pitch = -1.3; });
  await p.waitForTimeout(300);
  const antes = await p.evaluate(() => window.__medir(250));
  const med = p.evaluate(() => window.__medir(1600));
  for (let i = 0; i < 8; i++) { await p.evaluate(() => window.__jogo.quebrar(null)); await p.waitForTimeout(180); }
  const rq = await med;
  const qb = [...await conta(p, 'bater'), ...await conta(p, 'quebrar')];
  ok(qb.length >= 2 && rq.max > antes.media * 1.5, `bater/quebrar: ${qb.length} sons (${[...new Set(qb.map((x) => x.m))].join(', ')}), RMS ${antes.media} -> máx ${rq.max}`);
  // coloca olhando um pouco mais para frente (o buraco que cavou pode estar fundo demais para alcançar)
  for (const pt of [-1.3, -0.9, -0.6, -0.4]) { await p.evaluate((pt) => { window.__jogo.jog.pitch = pt; window.__jogo.usar(null); }, pt); await p.waitForTimeout(250); if ((await conta(p, 'colocar')).length) break; }
  const col = await conta(p, 'colocar');
  ok(col.length >= 1, `colocar bloco: ${col.map((x) => x.m).join(', ')}`);

  // mochila abre/fecha com "fwip"
  await p.keyboard.press('KeyE'); await p.waitForTimeout(400);
  const invAberto = await p.isVisible('#inventario');
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  console.log('     mochila abriu:', invAberto, 'fechou:', !(await p.isVisible('#inventario')));
  ok((await conta(p, 'abrir')).length >= 1 && (await conta(p, 'fechar')).length >= 1, 'mochila: som de abrir e fechar');

  // bichos: esperam um pouco e "falam" de onde estão (som 3D)
  // uns bichos mansos por perto (em mundo sorteado, às vezes não tinha nenhum ao alcance do ouvido)
  await p.evaluate(() => { const { jog, bichos, mundo } = window.__jogo; jog.pitch = 0;
    ['ovelha', 'galinha', 'vaca', 'porquinho'].forEach((e, i) => { const x = Math.floor(jog.pos.x) + (i % 2 ? 4 : -4), z = Math.floor(jog.pos.z) + (i < 2 ? 4 : -4); bichos.criar(e, x + 0.5, mundo.chao(x, z) + 1, z + 0.5); }); });
  await p.waitForFunction(() => window.__log.some((x) => x.k === 'bicho'), null, { timeout: 30000 }).catch(() => {});
  const bi = await conta(p, 'bicho');
  ok(bi.length >= 1, `bichos falando: ${bi.map((x) => `${x.t} (lado ${x.pan}, vol ${x.vol})`).slice(0, 4).join('; ')}`);

  // opções: sliders de Música, Efeitos e Voz na pausa
  await p.click('#bt-menu'); await p.waitForTimeout(500);
  ok(await p.isVisible('#aj-vol-musica') && await p.isVisible('#aj-vol-efeitos') && await p.isVisible('#aj-vol-voz'), 'pausa mostra Música, Efeitos e Voz dos amigos');
  await p.evaluate(() => document.querySelector('#aj-vol-musica').scrollIntoView({ block: 'center' }));
  await p.screenshot({ path: `${SAIDA}/som-${d.nome}-opcoes.png` });
  // música no máximo: frase começa logo
  await p.evaluate(() => { const e = document.querySelector('#aj-vol-musica'); e.value = 1; e.dispatchEvent(new Event('input', { bubbles: true })); });
  const salvo = await p.evaluate(() => JSON.parse(localStorage.getItem('pradaria.ajustes')).volMusica);
  ok(salvo === 1, 'volume da música salvo nas opções');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.evaluate(() => { const s = window.__jogo.som; if (s.mus) s.mus.prox = s.ctx.currentTime; });
  await p.waitForTimeout(2500);
  ok((await conta(p, 'notaMusica')).length >= 1, `música ambiente: ${(await conta(p, 'notaMusica')).length} notas`);

  if (d.nome === 'pc') {
    const b64 = await p.evaluate(() => window.__pararGravacao());
    writeFileSync(`${SAIDA}/amostra-pc.webm`, Buffer.from(b64, 'base64'));
    console.log('amostra gravada:', Math.round(b64.length * 0.75 / 1024), 'KB');
  }
  // Efeitos em 0: quebrar não faz som nenhum
  await p.evaluate(() => { window.__jogo.ajustes.volEfeitos = 0; window.__jogo.ajustes.volMusica = 0; window.__jogo.som.configurar({ efeitos: 0, musica: 0 }); window.__jogo.jog.pitch = -1.3; });
  await p.waitForTimeout(1200);
  const mudo = p.evaluate(() => window.__medir(900));
  for (let i = 0; i < 4; i++) { await p.evaluate(() => window.__jogo.quebrar(null)); await p.waitForTimeout(180); }
  const rm = await mudo;
  ok(rm.max < 0.002, `Efeitos em 0: silêncio (RMS máx ${rm.max})`);
  const pico = await p.evaluate(() => window.__jogo.som.vozes);
  ok(pico <= 22, `limite de sons ao mesmo tempo respeitado (${pico} tocando agora)`);
  ok(!erros.length, 'console sem erros' + (erros.length ? ': ' + erros.slice(0, 4).join(' | ') : ''));
  await ctx.close();
}

// xadrez: peça na casa faz "toc"
{
  console.log('\n== xadrez (celular)');
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(instrumentar);
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await p.goto(BASE + '/xadrez.html');
  await p.tap('#bt-computador');
  await p.waitForTimeout(500);
  const lance = await p.evaluate(() => { const X = window.__xadrez.X; return X.lances(window.__xadrez.e).find((m) => m.de === 52 && m.para === 36) || X.lances(window.__xadrez.e)[0]; });
  await p.tap(`.casa[data-i="${lance.de}"]`);
  const med = p.evaluate(() => window.__medir(700));
  await p.tap(`.casa[data-i="${lance.para}"]`);
  const r = await med;
  ok(r.max > 0.005, `peça de xadrez faz som (RMS máx ${r.max})`);
  ok(!erros.length, 'xadrez sem erros' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await ctx.close();
}
await b.close();

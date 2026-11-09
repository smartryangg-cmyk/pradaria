// Física dos veículos jogando de verdade: monta uma pista no céu (mundo.definir) e testa
// aceleração/frenagem (nariz), curva rápida (derrapagem), degrau de 1 bloco (sem teletransporte), rampa (salto e pouso
// com a suspensão), batida na parede (para, quica, não atravessa), carro e barco na água (empuxo), avião que só
// decola com velocidade, helicóptero que paira, avião/helicóptero/carro que caem na água e boiam; e no tablet (toque).
// Uso: URL=http://localhost:8773 SAIDA=/tmp/claude-0/fisica/veiculos node testes/teste-fisica-veiculos.mjs
import { createRequire } from 'module'; const req = createRequire(import.meta.url); const { chromium, devices } = req('playwright');
import { mkdirSync, writeFileSync } from 'fs';
const URL = process.env.URL || 'http://localhost:8788';
const SAIDA = process.env.SAIDA || '/tmp/claude-0/fisica/veiculos';
mkdirSync(SAIDA, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const erros = [];
const res = [];
const checar = (nome, ok, info) => { res.push({ nome, ok }); console.log((ok ? 'OK    ' : 'FALHA ') + nome + (info ? '  | ' + info : '')); };
const f2 = (x) => (+x).toFixed(2);

async function abrir(ctx, toque) {
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  p.on('pageerror', (e) => erros.push('PAGEERROR ' + e.message));
  await p.goto(URL + '/#teste');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(500);
  if (toque) await p.tap('#bt-sozinho'); else await p.click('#bt-sozinho');
  await p.waitForSelector('#m-novo:not([hidden])');
  if (toque) await p.tap('#m-novo button[type=submit]'); else await p.click('#m-novo button[type=submit]');
  await p.waitForFunction(() => window.__jogo && window.__jogo.jog && window.__jogo.garagem.veic, null, { timeout: 30000 });
  await p.waitForTimeout(3000);
  return p;
}

// pista no céu, acima do terreno: A = { X0, Z0, FY } (chão de pedra na camada FY, em cima = FY + 1)
async function montarPista(p) {
  return p.evaluate(() => {
    const m = window.__jogo.mundo, j = window.__jogo.jog;
    const X0 = Math.floor(j.pos.x) + 8, Z0 = Math.floor(j.pos.z) - 50;
    let alto = 0;
    for (let x = X0; x < X0 + 104; x += 4) for (let z = Z0; z < Z0 + 100; z += 4) alto = Math.max(alto, m.chao(x, z));
    const FY = Math.min(84, Math.max(60, alto + 6));
    const PEDRA = 3, AGUA = 5, TIJOLO = 10;
    const enche = (x0, x1, y0, y1, z0, z1, bl) => { for (let x = x0; x < x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z < z1; z++) m.definir(x, y, z, bl); };
    // pista 1: pátio 60x70 (arrancada, curva, frenagem, parede no fim, avião, helicóptero)
    enche(X0, X0 + 60, FY, FY, Z0, Z0 + 70, PEDRA);
    enche(X0, X0 + 60, FY + 1, FY + 3, Z0, Z0 + 2, TIJOLO); // parede no fim
    // pista 2: degrau de 1 bloco, rampa de 4 e pouso
    const X2 = X0 + 64;
    enche(X2, X2 + 12, FY, FY, Z0 - 30, Z0 + 100, PEDRA);
    enche(X2, X2 + 12, FY + 1, FY + 1, Z0 + 60, Z0 + 80, PEDRA); // plataforma de 1 bloco (sobe em z=Z0+80, desce em Z0+60)
    for (let i = 0; i < 4; i++) enche(X2, X2 + 12, FY + 1, FY + 1 + i, Z0 + 48 - 2 * i, Z0 + 50 - 2 * i, PEDRA); // rampa 1,2,3,4
    // pista 3: piscina funda (4 blocos de água) depois de um trecho seco
    const X3 = X0 + 80;
    enche(X3, X3 + 18, FY, FY, Z0 + 40, Z0 + 70, PEDRA);
    enche(X3, X3 + 18, FY - 4, FY - 4, Z0 + 2, Z0 + 41, PEDRA); // fundo
    enche(X3, X3 + 1, FY - 3, FY + 1, Z0 + 2, Z0 + 41, PEDRA); enche(X3 + 17, X3 + 18, FY - 3, FY + 1, Z0 + 2, Z0 + 41, PEDRA);
    enche(X3, X3 + 18, FY - 3, FY + 1, Z0 + 2, Z0 + 3, PEDRA); enche(X3, X3 + 18, FY - 3, FY - 1, Z0 + 40, Z0 + 41, PEDRA);
    enche(X3 + 1, X3 + 17, FY - 3, FY, Z0 + 3, Z0 + 40, AGUA);
    // gravador quadro a quadro do veículo em que estou
    window.__reg = [];
    const g = window.__jogo.garagem;
    if (!window.__gravando) {
      window.__gravando = true; window.__tj = 0;
      let ult = performance.now();
      const f = () => {
        const agora = performance.now();
        window.__tj += Math.min(0.1, (agora - ult) / 1000); ult = agora; // tempo do jogo (o jogo limita o passo a 0,1 s)
        const d = g.dentro;
        if (d) { const v = d.v; window.__reg.push({ t: performance.now(), x: v.x, y: v.y, z: v.z, vel: v.vel, lat: v.lat || 0, vy: v.vy, pitch: v.pitch, roll: v.roll, pg: v.pg || 0, tj: window.__tj, vira: v.viraRoda, h: v.su ? v.su.h : 0, apoio: !!v.apoio, sub: v.sub || 0, yaw: v.yaw, bateu: v.bateu || 0, col: g.veic.colideCorpo(v, v.x, v.y, v.z, v.yaw) }); v.bateu = 0; }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }
    return { X0, Z0, FY, X2, X3 };
  });
}

const irPara = (p, x, y, z, yaw = 0) => p.evaluate(([x, y, z, yaw]) => { const g = window.__jogo.garagem; if (g.dentro) g.guardar(); const j = window.__jogo.jog; Object.assign(j.pos, { x, y, z }); j.vel.x = j.vel.y = j.vel.z = 0; j.yaw = yaw; j.pitch = -0.2; j.voando = false; }, [x, y, z, yaw]);
const novo = (p, t, cor = 0) => p.evaluate(([t, cor]) => { window.__jogo.garagem.novo(t, cor); return window.__jogo.garagem.dentro ? window.__jogo.garagem.dentro.v.tipo : null; }, [t, cor]);
const limparReg = (p) => p.evaluate(() => { window.__reg = []; });
let nReg = 0;
const reg = async (p) => { const r = await p.evaluate(() => window.__reg); if (process.env.DEPURAR) writeFileSync(`${SAIDA}/reg-${++nReg}.json`, JSON.stringify(r)); return r; };
const foto = (p, nome) => p.screenshot({ path: `${SAIDA}/${nome}.png` });
// espera em tempo do jogo (no navegador sem placa de vídeo o jogo roda a poucos quadros e o tempo anda mais devagar)
const jogo = async (p, ms) => { const alvo = await p.evaluate((s) => window.__tj + s, ms / 1000); await p.waitForFunction((a) => window.__tj >= a, alvo, { timeout: ms * 25 + 10000, polling: 50 }); };
const segura = async (p, teclas, ms) => { for (const k of teclas) await p.keyboard.down(k); await jogo(p, ms); for (const k of teclas) await p.keyboard.up(k); };
// espera até alguma condição [campo, '<' | '>', valor] valer no último quadro gravado, com limite em tempo do jogo
const ate = async (p, conds, ms) => {
  const alvo = await p.evaluate((s) => window.__tj + s, ms / 1000);
  await p.waitForFunction(([cs, a]) => {
    const r = window.__reg, q = r[r.length - 1];
    return window.__tj >= a || (!!q && cs.some(([c, op, v]) => (op === '<' ? q[c] < v : q[c] > v)));
  }, [conds, alvo], { timeout: ms * 25 + 10000, polling: 50 });
};

// ================== computador (teclado) ==================
{
  const ctx = await b.newContext({ viewport: { width: 1024, height: 640 } });
  const p = await abrir(ctx, false);
  const A = await montarPista(p);
  const { X0, Z0, FY, X2, X3 } = A;
  console.log('pista', JSON.stringify(A));
  await p.waitForTimeout(1500);

  // ---- 1. garagem pelo teclado (G) e botão; arrancada, curva rápida, frenagem ----
  await irPara(p, X0 + 20.5, FY + 1.01, Z0 + 66.5, 0);
  await p.waitForTimeout(600);
  await p.keyboard.press('KeyG');
  await p.waitForSelector('#garagem:not([hidden])');
  await p.click('#garagem-grade .veiculo[data-tipo=carro]');
  await p.waitForTimeout(400);
  const dentro = await p.evaluate(() => window.__jogo.garagem.dentro && window.__jogo.garagem.dentro.v.tipo);
  checar('garagem (G + botão) cria o carro e entra', dentro === 'carro', dentro);
  await limparReg(p);
  await p.keyboard.down('KeyW');
  await ate(p, [['vel', '>', 14]], 5000);
  await p.keyboard.up('KeyW');
  let r = await reg(p);
  const vel1 = r[r.length - 1].vel;
  const pitchAcel = Math.max(...r.map((q) => q.pitch));
  checar('acelera (W)', vel1 > 13, 'vel ' + f2(vel1) + ' m/s em ' + f2(r[r.length - 1].tj - r[0].tj) + ' s');
  checar('nariz levanta ao acelerar', pitchAcel > 0.015, 'pitch máx ' + f2(pitchAcel));
  await limparReg(p);
  await p.keyboard.down('KeyW'); await p.keyboard.down('KeyD');
  await jogo(p, 900);
  await foto(p, '01-curva-derrapando');
  await jogo(p, 700);
  await p.keyboard.up('KeyD'); await p.keyboard.up('KeyW');
  r = await reg(p);
  const latMax = Math.max(...r.map((q) => Math.abs(q.lat)));
  const rollMax = Math.max(...r.map((q) => q.roll));
  const giro = Math.abs(r[r.length - 1].yaw - r[0].yaw);
  checar('curva rápida derrapa um pouco (lateral)', latMax > 0.5 && latMax < 8, 'lateral máx ' + f2(latMax) + ' m/s, giro ' + f2(giro) + ' rad');
  checar('corpo inclina para fora na curva', rollMax > 0.01, 'roll máx ' + f2(rollMax));
  await limparReg(p);
  await p.keyboard.down('KeyS');
  await ate(p, [['vel', '<', 0.3]], 4000);
  await p.keyboard.up('KeyS');
  r = await reg(p);
  const pitchFreio = Math.min(...r.map((q) => q.pitch - q.pg));
  checar('nariz abaixa ao frear', pitchFreio < -0.02 && pitchFreio > -0.2, 'pitch mín ' + f2(pitchFreio) + ' (fora a ladeira)');
  await jogo(p, 1500);
  // parado não gira no lugar
  await limparReg(p);
  await segura(p, ['KeyD'], 800);
  r = await reg(p);
  const giroParado = Math.abs(r[r.length - 1].yaw - r[0].yaw);
  checar('carro parado não gira no lugar', giroParado < 0.05, 'giro ' + f2(giroParado));

  // ---- 2. parede: bate, para, quica, não atravessa e não fica preso ----
  await irPara(p, X0 + 40.5, FY + 1.01, Z0 + 66.5, 0);
  await p.waitForTimeout(300);
  await novo(p, 'esportivo', 1);
  await limparReg(p);
  await p.keyboard.down('KeyW');
  await ate(p, [['bateu', '>', 0]], 9000);
  await jogo(p, 600);
  await p.keyboard.up('KeyW');
  r = await reg(p);
  const iBate = r.findIndex((q) => q.bateu > 0);
  const antes = iBate > 0 ? r[iBate - 1] : null, depois = iBate >= 0 ? r[Math.min(r.length - 1, iBate + 1)] : null;
  const zMin = Math.min(...r.map((q) => q.z));
  const presoAlgum = r.slice(iBate >= 0 ? iBate : 0).some((q) => q.col);
  checar('bate na parede e quica (perde a velocidade)', iBate >= 0 && antes.vel > 8 && depois.vel < antes.vel * 0.4, iBate >= 0 ? `antes ${f2(antes.vel)} m/s, depois ${f2(depois.vel)} m/s, batida ${f2(r[iBate].bateu)}` : 'não bateu');
  checar('não atravessa a parede', zMin > Z0 + 2 + 1.5, 'z mín ' + f2(zMin) + ' (parede até ' + (Z0 + 2) + ')');
  checar('não fica preso dentro do bloco', !presoAlgum);
  await segura(p, ['KeyS'], 1500);
  r = await reg(p);
  checar('dá ré e sai da parede', r[r.length - 1].z > zMin + 1, 'z ' + f2(r[r.length - 1].z));
  await foto(p, '02-parede');

  // ---- 3. degrau de 1 bloco (sobe aos poucos) e rampa (salta e pousa com a suspensão) ----
  await irPara(p, X2 + 6.5, FY + 1.01, Z0 + 97.5, 0);
  await p.waitForTimeout(400);
  await novo(p, 'carro', 3);
  await limparReg(p);
  await p.keyboard.down('KeyW');
  let fotoVoo = false;
  for (let i = 0; i < 400; i++) {
    await p.waitForTimeout(100);
    const q = await p.evaluate(() => { const r = window.__reg; return r[r.length - 1]; });
    if (!fotoVoo && q && q.z < Z0 + 42 && !q.apoio) { fotoVoo = true; await foto(p, '03-salto-rampa'); }
    if (fotoVoo || (q && q.z < Z0 + 36)) break;
  }
  await ate(p, [['z', '<', Z0 + 26]], 8000);
  await p.keyboard.up('KeyW');
  await p.keyboard.down('KeyS');
  await ate(p, [['vel', '<', 0.3]], 4000);
  await p.keyboard.up('KeyS');
  await jogo(p, 500);
  r = await reg(p);
  // degrau: entre z = Z0+82 e Z0+76 o y vai de FY+1 a FY+2
  const noDegrau = r.filter((q) => q.z < Z0 + 84 && q.z > Z0 + 72);
  // o que se vê: chassi + mola (y + h); por segundo de jogo, para não depender de quantos quadros o navegador faz
  let saltoMax = 0, taxa = 0;
  for (let i = 1; i < noDegrau.length; i++) {
    const dy = noDegrau[i].y + noDegrau[i].h - noDegrau[i - 1].y - noDegrau[i - 1].h;
    saltoMax = Math.max(saltoMax, dy);
    taxa = Math.max(taxa, dy / Math.max(0.016, noDegrau[i].tj - noDegrau[i - 1].tj));
  }
  const subiu = noDegrau.length ? noDegrau[noDegrau.length - 1].y - noDegrau[0].y : 0;
  checar('sobe degrau de 1 bloco', subiu > 0.8, 'subiu ' + f2(subiu));
  const iniD = noDegrau.find((q) => q.y + q.h > FY + 1.05), fimD = noDegrau.find((q) => q.y + q.h > FY + 1.95);
  const tDegrau = iniD && fimD ? fimD.tj - iniD.tj : 0;
  checar('degrau sem teletransporte (sobe aos poucos: frente, depois traseira)', saltoMax < 0.75 && tDegrau > 0.1,
    'subida leva ' + f2(tDegrau) + ' s de jogo; maior subida visível num quadro ' + f2(saltoMax) + ' m a ~10 quadros/s (antes: 1 bloco de uma vez)');
  const naPlat = r.filter((q) => q.z < Z0 + 74 && q.z > Z0 + 62);
  checar('fica em cima da plataforma', naPlat.length > 0 && naPlat.every((q) => q.y > FY + 1.6), naPlat.length ? 'y ' + f2(Math.min(...naPlat.map((q) => q.y))) : 'sem amostras');
  // descendo da plataforma: não flutua (desce em menos de 0,35 s)
  const iDesce = r.findIndex((q) => q.z < Z0 + 60 - 1.5);
  const tDesce = iDesce >= 0 ? (r.slice(iDesce).find((q) => q.y < FY + 1.1)?.t ?? Infinity) - r[iDesce].t : Infinity;
  checar('desce da plataforma sem flutuar', tDesce < 400, f2(tDesce) + ' ms para chegar no chão');
  // rampa: voa depois do topo (z < Z0+42) e pousa
  const voo = r.filter((q) => q.z < Z0 + 43 && q.z > Z0 + 12 && !q.apoio);
  const altVoo = voo.length ? Math.max(...voo.map((q) => q.y)) - (FY + 1) : 0;
  const tVoo = voo.length ? voo[voo.length - 1].t - voo[0].t : 0;
  const tVooJogo = voo.length ? voo[voo.length - 1].tj - voo[0].tj : 0;
  const zPouso = voo.length ? voo[voo.length - 1].z : Z0 + 42;
  checar('salta da rampa (gravidade) e voa por cima do vão', altVoo > 3 && tVooJogo > 0.3 && Z0 + 42 - zPouso > 4,
    'altura ' + f2(altVoo) + ' m acima do chão, ' + f2(tVooJogo) + ' s no ar (tempo do jogo), pousou ' + f2(Z0 + 42 - zPouso) + ' m depois da rampa');
  const iPouso = voo.length ? r.indexOf(voo[voo.length - 1]) + 1 : -1;
  const pouso = iPouso > 0 ? r.slice(iPouso, iPouso + 40) : [];
  const hMin = pouso.length ? Math.min(...pouso.map((q) => q.h)) : 0;
  checar('pousa e a suspensão absorve (comprime)', pouso.length > 0 && hMin < -0.05 && pouso[pouso.length - 1].y < FY + 1.2, 'mola comprimiu ' + f2(-hMin) + ' m');
  checar('termina no chão, solto', !r[r.length - 1].col && r[r.length - 1].apoio, 'y ' + f2(r[r.length - 1].y));
  await foto(p, '04-pouso');

  // ---- 4. carro entra na água: boia devagar e o motor perde força ----
  await irPara(p, X3 + 9.5, FY + 1.01, Z0 + 68.5, 0);
  await p.waitForTimeout(400);
  await novo(p, 'carro', 5);
  await limparReg(p);
  await p.keyboard.down('KeyW');
  await ate(p, [['z', '<', Z0 + 22]], 9000);
  await foto(p, '05-carro-na-agua');
  await p.keyboard.up('KeyW');
  r = await reg(p);
  const naAgua = r.filter((q) => q.sub > 0.3);
  const velAgua = naAgua.length ? Math.max(...naAgua.slice(Math.floor(naAgua.length / 2)).map((q) => q.vel)) : 0;
  const yAgua = naAgua.length ? naAgua[naAgua.length - 1].y : 0;
  checar('carro na água boia (não vai ao fundo)', naAgua.length > 10 && yAgua > FY - 1.5, 'y ' + f2(yAgua) + ', fundo em ' + (FY - 3) + ', superfície ' + f2(FY + 0.88) + ', submerso ' + f2(naAgua.length ? naAgua[naAgua.length - 1].sub : 0));
  checar('carro na água: motor perde força', velAgua > 0.5 && velAgua < 16 * 0.45, 'vel na água ' + f2(velAgua) + ' m/s (máx na terra 16)');

  // ---- 5. barco: empuxo, empina ao acelerar, inclina na curva, balança com as ondas ----
  await irPara(p, X3 + 9.5, FY + 1.01, Z0 + 43.5, 0);
  await p.waitForTimeout(400);
  const barco = await novo(p, 'barco', 1);
  checar('barco aparece na água', barco === 'barco', String(barco));
  if (barco) {
    await jogo(p, 1500);
    await limparReg(p);
    await jogo(p, 3000);
    r = await reg(p);
    const ys = r.map((q) => q.y), ps = r.map((q) => q.pitch);
    const bob = Math.max(...ys) - Math.min(...ys), bobP = Math.max(...ps) - Math.min(...ps);
    const subB = r[r.length - 1].sub;
    checar('barco boia (empuxo) e balança com as ondas', subB > 0.15 && subB < 0.8 && bob > 0.02 && bobP > 0.01, `submerso ${f2(subB)}, sobe-desce ${f2(bob)} m, pitch ${f2(bobP)}`);
    await limparReg(p);
    await segura(p, ['KeyW'], 1500);
    r = await reg(p);
    const empina = Math.max(...r.map((q) => q.pitch));
    checar('barco empina ao acelerar', empina > 0.05, 'pitch máx ' + f2(empina));
    await limparReg(p);
    await p.keyboard.down('KeyW'); await p.keyboard.down('KeyA');
    await jogo(p, 1200);
    await foto(p, '06-barco-curva');
    await p.keyboard.up('KeyA'); await p.keyboard.up('KeyW');
    r = await reg(p);
    const banca = Math.max(...r.map((q) => q.roll));
    const latB = Math.max(...r.map((q) => Math.abs(q.lat)));
    checar('barco inclina para dentro na curva e escorrega', banca > 0.04 && latB > 0.3, 'roll máx ' + f2(banca) + ' (curva à esquerda), lateral ' + f2(latB) + ' m/s');
  }

  // ---- 6. avião, helicóptero e carro (sem ninguém) caem na água e boiam ----
  await irPara(p, X3 + 9.5, FY + 1.01, Z0 + 48.5, 0);
  await p.evaluate(([x, y, z]) => {
    const V = window.__jogo.garagem.veic;
    V.criar({ id: 'T1', tipo: 'aviao', cor: 2, p: [x, y, z - 22], r: 0 });
    V.criar({ id: 'T2', tipo: 'helicoptero', cor: 3, p: [x - 4, y, z - 12], r: 0 });
    V.criar({ id: 'T3', tipo: 'jipe', cor: 4, p: [x + 4, y, z - 14], r: 0 });
  }, [X3 + 9, FY + 5, Z0 + 40]);
  await jogo(p, 9000);
  const flut = await p.evaluate(() => ['T1', 'T2', 'T3'].map((id) => { const v = window.__jogo.garagem.veic.mapa.get(id); return { id, tipo: v.tipo, y: v.y, sub: v.sub || 0 }; }));
  for (const q of flut) checar(`${q.tipo} cai na água e boia`, q.sub > 0.1 && q.sub < 0.99 && q.y > FY - 1.5, `y ${f2(q.y)}, submerso ${f2(q.sub)}`);
  await foto(p, '07-boiando');
  await p.evaluate(() => { for (const id of ['T1', 'T2', 'T3']) window.__jogo.garagem.veic.remover(id); });

  // ---- 7. avião: só decola com velocidade ----
  await irPara(p, X0 + 2.5, FY + 1.01, Z0 + 30.5, -Math.PI / 2);
  await p.waitForTimeout(400);
  await novo(p, 'aviao', 0);
  await limparReg(p);
  await p.keyboard.down('KeyW'); await p.keyboard.down('Space');
  await jogo(p, 6000);
  await foto(p, '08-aviao-decolou');
  await p.keyboard.up('Space'); await p.keyboard.up('KeyW');
  r = await reg(p);
  const y0 = r[0].y;
  const devagar = r.filter((q) => q.vel < 9.5);
  const subiuDevagar = devagar.length ? Math.max(...devagar.map((q) => q.y)) - y0 : 0;
  const subiuFinal = r[r.length - 1].y - y0;
  const vDecola = r.find((q) => q.y - y0 > 0.5)?.vel;
  checar('avião não sobe devagar (com o botão de subir apertado)', devagar.length > 5 && subiuDevagar < 0.2, 'subiu ' + f2(subiuDevagar) + ' m abaixo de 9,5 m/s');
  checar('avião decola com velocidade', subiuFinal > 4, 'subiu ' + f2(subiuFinal) + ' m; saiu do chão a ' + f2(vDecola ?? 0) + ' m/s');
  const bancaAviao = await (async () => { await limparReg(p); await p.keyboard.down('KeyW'); await segura(p, ['KeyA'], 700); await p.keyboard.up('KeyW'); return Math.max(...(await reg(p)).map((q) => q.roll)); })();
  checar('avião inclina na curva', bancaAviao > 0.2, 'roll ' + f2(bancaAviao));

  // ---- 8. helicóptero paira ----
  await irPara(p, X0 + 30.5, FY + 1.01, Z0 + 40.5, 0);
  await p.waitForTimeout(400);
  await novo(p, 'helicoptero', 2);
  await limparReg(p);
  await segura(p, ['Space'], 1300);
  await jogo(p, 1000);
  const hAlto = await p.evaluate(() => window.__reg[window.__reg.length - 1].y);
  await jogo(p, 1500);
  r = await reg(p);
  const hDepois = r[r.length - 1].y;
  checar('helicóptero sobe e paira', hAlto - r[0].y > 2 && Math.abs(hDepois - hAlto) < 0.4, `subiu ${f2(hAlto - r[0].y)} m, depois variou ${f2(hDepois - hAlto)} m`);
  await foto(p, '09-helicoptero');
  await p.evaluate(() => window.__jogo.garagem.guardar());

  // ---- desempenho da física ----
  const ms = await p.evaluate(() => {
    const V = window.__jogo.garagem.veic;
    const v = V.criar({ id: 'P1', tipo: 'onibus', cor: 0, p: [window.__jogo.jog.pos.x + 6, window.__jogo.jog.pos.y + 1, window.__jogo.jog.pos.z], r: 0 });
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) V.dirigir(v, 1 / 30, { frente: 1, lado: i % 200 < 100 ? 1 : -1 }, []);
    const t = (performance.now() - t0) / 2000;
    V.remover('P1');
    return t;
  });
  checar('física leve (ônibus, um passo de 1/30 s)', ms < 0.2, f2(ms * 1000) + ' µs');
  await ctx.close();
}

// ================== tablet (toque, joystick da tela) ==================
{
  const ctx = await b.newContext({ ...devices['Galaxy Tab S4 landscape'] });
  const p = await abrir(ctx, true);
  const A = await montarPista(p);
  const { X0, Z0, FY } = A;
  await p.waitForTimeout(1200);
  await irPara(p, X0 + 20.5, FY + 1.01, Z0 + 66.5, 0);
  await p.waitForTimeout(500);
  await p.tap('#bt-garagem');
  await p.waitForSelector('#garagem:not([hidden])');
  await p.tap('#garagem-grade .veiculo[data-tipo=quadriciclo]');
  await p.waitForTimeout(500);
  const dentro = await p.evaluate(() => window.__jogo.garagem.dentro && window.__jogo.garagem.dentro.v.tipo);
  checar('tablet: garagem pelo botão (toque)', dentro === 'quadriciclo', dentro);
  const vp = p.viewportSize();
  const cdp = await ctx.newCDPSession(p);
  const x0 = vp.width * 0.18, y0 = vp.height * 0.65;
  await limparReg(p);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0, y: y0 - 70, id: 1 }] });
  await jogo(p, 2200);
  const velo = await p.textContent('#velo b');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + 60, y: y0 - 50, id: 1 }] });
  await jogo(p, 1300);
  await foto(p, '10-tablet-curva');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await jogo(p, 2500);
  const r = await reg(p);
  const anda = Math.hypot(r[r.length - 1].x - r[0].x, r[r.length - 1].z - r[0].z);
  const giro = Math.abs(r[r.length - 1].yaw - r[0].yaw);
  checar('tablet: joystick acelera, mostra km/h e vira', anda > 8 && giro > 0.3 && +velo > 10, `andou ${f2(anda)} m, girou ${f2(giro)} rad, velocímetro ${velo} km/h`);
  checar('tablet: solta o joystick e vai parando', Math.abs(r[r.length - 1].vel) < 4, 'vel ' + f2(r[r.length - 1].vel));
  await ctx.close();
}

console.log('erros no console:', erros.length ? '\n' + erros.slice(0, 10).join('\n') : 'nenhum');
const falhas = res.filter((x) => !x.ok).length;
console.log(`${res.length - falhas}/${res.length} ok; prints em ${SAIDA}`);
await b.close();
process.exit(falhas || erros.length ? 1 : 0);

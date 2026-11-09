// Ataques de um cliente modificado dentro do mundo (precisa de: npm run dev:sala e npm run dev, porta 8788):
// 1) mundo sem Construção: colocar/quebrar sem "j", pedreiro; abrir porta continua valendo
// 2) mundo com Construção: apagar a construção de outro e colocar blocos sem "j"
// 3) Armas: acerto sem arma na mão, acertos mais rápidos que a arma, "derrubada" inventada
// 4) quem não tem 16 anos sai na hora quando o dono liga Armas
// 5) veículo da vila pedido longe e sem parar
const BASE = process.env.BASE || 'http://localhost:8788';
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) falhas++; };
const ipx = () => '10.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250) + '.' + Math.floor(Math.random() * 250);
async function api(caminho, corpo, token) {
  const r = await fetch(BASE + '/api/' + caminho, {
    method: corpo ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(BASE.includes('localhost') ? { 'cf-connecting-ip': ipx() } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, ...(d && typeof d === 'object' && !Array.isArray(d) ? d : {}) };
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
function conectar(codigo, token) {
  return new Promise((res) => {
    const w = new WebSocket(`${BASE.replace('http', 'ws')}/api/sala/${codigo}?t=${encodeURIComponent(token)}`);
    w.msgs = []; w.fechou = false;
    w.onmessage = (e) => { try { w.msgs.push(JSON.parse(e.data)); } catch {} };
    w.onclose = () => { w.fechou = true; };
    w.onopen = () => setTimeout(() => res(w), 700); w.onerror = () => res(w);
  });
}
const mandar = (w, m) => w.send(JSON.stringify(m));
const sfx = Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join('');
const conta = async (n) => api('cadastrar', { nome: n + sfx, senha: 'senha123' });
const dono = await conta('Dono'), chato = await conta('Chato'), crianca = await conta('Kid');
ok(dono.token && chato.token && crianca.token, 'contas criadas');
const blocos = async (codigo) => ((await api('mundos/exportar', { codigo }, dono.token)).edicoes || []);
const tem = (eds, x, y, z) => { const e = eds.find((q) => q[0] === x && q[1] === y && q[2] === z); return e ? e[3] : null; };

// ---------- 1) mundo sem Construção ----------
{
  const { mundo } = await api('mundos', { nome: 'Sem Obra', opcoes: { construcao: false, mercado: true, sobrevivencia: false } }, dono.token);
  await api('mundos/entrar', { codigo: mundo.codigo }, chato.token);
  const w = await conectar(mundo.codigo, chato.token);
  mandar(w, { t: 'pos', p: [10, 40, 10], r: [0, 0] });
  mandar(w, { t: 'bloco', x: 10, y: 40, z: 10, b: 3, j: 1 });
  mandar(w, { t: 'bloco', x: 11, y: 40, z: 10, b: 3 });
  mandar(w, { t: 'bloco', x: 12, y: 40, z: 10, b: 0, de: 4 });
  mandar(w, { t: 'bloco', x: 13, y: 40, z: 10, b: 48, de: 47 }); // abrir a porta de uma casa da vila
  mandar(w, { t: 'obra', estilo: 'casa', x: 10, z: 10 });
  await espera(800);
  const e = await blocos(mundo.codigo);
  ok(tem(e, 10, 40, 10) === null && tem(e, 11, 40, 10) === null && tem(e, 12, 40, 10) === null, 'sem Construção: colocar e quebrar (com ou sem "j") não vale: ' + JSON.stringify(e));
  ok(tem(e, 13, 40, 10) === 48, 'sem Construção: abrir uma porta continua valendo');
  ok(w.msgs.some((m) => m.t === 'econ-erro' && /construir/.test(m.msg)), 'sem Construção: o pedreiro não faz obra');
  w.close();
  await api('mundos/apagar', { codigo: mundo.codigo }, dono.token);
}

// ---------- 2) mundo com Construção: apagar a construção do outro sem "j" ----------
{
  const { mundo } = await api('mundos', { nome: 'Com Obra', opcoes: { sobrevivencia: false, mercado: false } }, dono.token);
  await api('mundos/entrar', { codigo: mundo.codigo }, chato.token);
  const wd = await conectar(mundo.codigo, dono.token);
  mandar(wd, { t: 'pos', p: [20, 41, 20], r: [0, 0] });
  mandar(wd, { t: 'bloco', x: 20, y: 40, z: 20, b: 8, de: 0, j: 1 }); // tábuas do dono
  mandar(wd, { t: 'bloco', x: 21, y: 40, z: 20, b: 4, de: 0, j: 1 }); // areia do dono
  await espera(500);
  const w = await conectar(mundo.codigo, chato.token);
  mandar(w, { t: 'bloco', x: 20, y: 40, z: 20, b: 0, de: 4 }); // "a areia caiu" (mentira: é tábua)
  mandar(w, { t: 'bloco', x: 22, y: 40, z: 20, b: 3, de: 0 }); // pedra sem a mão
  mandar(w, { t: 'bloco', x: 21, y: 40, z: 20, b: 0 }); // areia caindo de verdade: vale
  await espera(800);
  const e = await blocos(mundo.codigo);
  ok(tem(e, 20, 40, 20) === 8, 'tábuas do dono continuam (apagar sem "j" fingindo física não vale)');
  ok(tem(e, 22, 40, 20) === null, 'colocar pedra sem "j" não vale');
  ok(tem(e, 21, 40, 20) === 0, 'areia que cai continua sincronizando');
  w.close(); wd.close();
  await api('mundos/apagar', { codigo: mundo.codigo }, dono.token);
}

// ---------- 3) Armas e 4) idade ----------
{
  await api('eu/idade', { mais16: true }, dono.token);
  await api('eu/idade', { mais16: true }, chato.token);
  const { mundo } = await api('mundos', { nome: 'Paintball', opcoes: { armas: false } }, dono.token);
  await api('mundos/entrar', { codigo: mundo.codigo }, chato.token);
  await api('mundos/entrar', { codigo: mundo.codigo }, crianca.token); // entra antes de ligarem Armas
  const wk = await conectar(mundo.codigo, crianca.token);
  ok(!wk.fechou && wk.msgs.some((m) => m.t === 'ola'), 'criança está no mundo sem Armas');
  const ed = await api('mundos/editar', { codigo: mundo.codigo, opcoes: { armas: true } }, dono.token);
  ok(ed.mundo && ed.mundo.opcoes.armas === true, 'dono (16+) liga Armas');
  for (let i = 0; i < 30 && !wk.msgs.some((m) => m.t === 'erro'); i++) await espera(100);
  // a sala manda sair (o jogo volta ao menu com o aviso) e para de ouvir essa conexão
  ok(wk.msgs.some((m) => m.t === 'erro' && m.fim && /16 anos/.test(m.msg)), 'quem não respondeu "16 ou mais" sai na hora');
  const wk2 = await conectar(mundo.codigo, crianca.token);
  ok(!wk2.msgs.some((m) => m.t === 'ola'), 'e não volta a entrar');
  const wd = await conectar(mundo.codigo, dono.token);
  const w = await conectar(mundo.codigo, chato.token);
  const alvo = wd.msgs.find((m) => m.t === 'ola').eu;
  mandar(wd, { t: 'pos', p: [0, 40, 0], r: [0, 0] }); mandar(w, { t: 'pos', p: [3, 40, 0], r: [0, 0] });
  await espera(300);
  const feridas = () => wd.msgs.filter((m) => m.t === 'ferido').length;
  mandar(w, { t: 'arma', a: null });
  await espera(200);
  mandar(w, { t: 'acerto', alvo, a: 'precisao', dano: 99 });
  await espera(400);
  ok(feridas() === 0, 'acerto sem a arma na mão não vale');
  mandar(w, { t: 'arma', a: 'precisao' });
  await espera(200);
  for (let i = 0; i < 6; i++) mandar(w, { t: 'acerto', alvo, a: 'precisao', dano: 99 });
  await espera(500);
  ok(feridas() === 1, `rifle de precisão: 6 acertos de uma vez viram 1 (${feridas()})`);
  ok(wd.msgs.filter((m) => m.t === 'ferido').every((m) => m.dano <= 11), 'dano limitado ao máximo da arma');
  // "derrubada" inventada: o chato diz que caiu por causa do dono (que nunca acertou ele)
  mandar(w, { t: 'caiu', por: alvo });
  await espera(400);
  const caiu = wd.msgs.find((m) => m.t === 'caiu');
  ok(caiu && caiu.por === null, 'cair "por" alguém que não acertou não conta derrubada');
  for (let i = 0; i < 30; i++) mandar(w, { t: 'arma', a: i % 2 ? 'pistola' : 'sub' });
  await espera(500);
  const trocas = wd.msgs.filter((m) => m.t === 'arma').length;
  ok(trocas <= 6, `trocar de arma sem parar: os outros recebem no máximo 5 por segundo (${trocas})`);
  w.close(); wd.close(); wk2.close();
  await api('mundos/apagar', { codigo: mundo.codigo }, dono.token);
}

// ---------- 5) veículos da vila pedidos longe e sem parar ----------
{
  const { mundo } = await api('mundos', { nome: 'Garagem', opcoes: { veiculos: true } }, dono.token);
  const w = await conectar(mundo.codigo, dono.token);
  mandar(w, { t: 'pos', p: [0, 40, 0], r: [0, 0] });
  await espera(200);
  mandar(w, { t: 'vparado', tipo: 'helicoptero', k: 'v-longe', p: [900, 40, 900], r: 0 });
  for (let i = 0; i < 10; i++) mandar(w, { t: 'vparado', tipo: 'helicoptero', k: 'v-' + i, p: [5, 40, i], r: 0 });
  await espera(800);
  const novos = w.msgs.filter((m) => m.t === 'vnovo');
  ok(novos.length === 1, `veículo da vila: longe não vale e no máximo 1 a cada segundo e meio (${novos.length})`);
  w.close();
  await api('mundos/apagar', { codigo: mundo.codigo }, dono.token);
}

for (const c of [dono, chato, crianca]) await fetch(BASE + '/api/eu', { method: 'DELETE', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + c.token }, body: JSON.stringify({ senha: 'senha123' }) });
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);

// Ataques contra editar/apagar/exportar/importar mundo (precisa de: npm run dev:sala e npm run dev, porta 8788).
// 1) cabeçalhos falsos na conexão da sala (x-admin, x-usuario, x-mundo) vindos de um membro que não é dono;
// 2) arquivos de importação maliciosos; 3) pedidos de edição estranhos.
import http from 'http';
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
// pedido "de WebSocket" à rota da sala com cabeçalhos escolhidos pelo atacante (o navegador não deixa, mas um script deixa)
function salaCru(codigo, token, extra, corpo) {
  return new Promise((res) => {
    const u = new URL(`${BASE}/api/sala/${codigo}?t=${encodeURIComponent(token)}`);
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method: corpo ? 'POST' : 'GET',
      headers: { upgrade: 'websocket', connection: 'Upgrade', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ==', 'sec-websocket-version': '13', 'content-type': 'application/json', ...extra } });
    let texto = '';
    // virou WebSocket: junta o que a sala mandar por um instante (a mensagem 'ola')
    req.on('upgrade', (r, sock, head) => { let t = head ? head.toString('latin1') : ''; sock.on('data', (d) => { t += d.toString('latin1'); }); setTimeout(() => { sock.destroy(); res({ status: r.statusCode, texto: t }); }, 1200); });
    req.on('response', (r) => { r.on('data', (d) => { texto += d; }); r.on('end', () => res({ status: r.statusCode, texto })); });
    req.on('error', (e) => res({ status: 0, texto: String(e) }));
    req.setTimeout(8000, () => { req.destroy(); res({ status: 0, texto: 'tempo' }); });
    req.end(corpo ? JSON.stringify(corpo) : undefined);
  });
}
// letras sorteadas (nome sem 5 números seguidos e sem repetir entre testes rodados em seguida)
const sfx = Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]).join('');
const dono = await api('cadastrar', { nome: 'Dono' + sfx, senha: 'senha123' });
const chato = await api('cadastrar', { nome: 'Chato' + sfx, senha: 'senha123' });
ok(dono.token && chato.token, 'contas criadas');
const TORRE = [[3, 58, 4, 3], [3, 59, 4, 3], [3, 60, 4, 2]];
const arq = { formato: 'pradaria-mundo', versao: 1, nome: 'Alvo', semente: 1234, opcoes: {}, edicoes: TORRE };
const { mundo } = await api('mundos/importar', { arquivo: arq, nome: 'Mundo Alvo' }, dono.token);
ok(mundo && mundo.codigo, 'dono tem um mundo com blocos');
ok((await api('mundos/entrar', { codigo: mundo.codigo }, chato.token)).mundo, 'chato entra como membro');
const blocosDoDono = async () => { const r = await api('mundos/exportar', { codigo: mundo.codigo }, dono.token); return r.edicoes || []; };
ok((await blocosDoDono()).length === 3, 'mundo começa com 3 blocos');

// ---------- 1) cabeçalhos falsos na sala ----------
const ex = await salaCru(mundo.codigo, chato.token, { 'x-admin': 'exportar' });
// um membro já recebe os blocos ao entrar ('ola'); o furo era a resposta de administrador (JSON puro, sem virar WebSocket)
ok(ex.status === 101 && !/^\{"edicoes"/.test(ex.texto), `x-admin: exportar é ignorado, vira conexão normal (${ex.status} ${ex.texto.slice(0, 40)})`);
await salaCru(mundo.codigo, chato.token, { 'x-admin': 'importar' }, { edicoes: [[0, 30, 0, 9], [1, 30, 0, 9]] });
await salaCru(mundo.codigo, chato.token, { 'x-admin': 'apagar' });
await salaCru(mundo.codigo, chato.token, { 'x-admin': 'editar' }, { nome: 'Hackeado', opcoes: { selvagens: false }, recarregar: true });
await salaCru(mundo.codigo, chato.token, { 'x-admin': 'esquecer' }, { uid: dono.usuario.id });
await espera(500);
const depois = await blocosDoDono();
ok(depois.length === 3 && !depois.some((e) => e[3] === 9), `x-admin: apagar/importar de um membro não mexem nos blocos (${depois.length})`);
// x-usuario falso: tentar ser dono (mudar a hora só o dono pode) e x-mundo falso (outra semente)
const ws = await new Promise((res) => {
  const w = new WebSocket(`${BASE.replace('http', 'ws')}/api/sala/${mundo.codigo}?t=${encodeURIComponent(chato.token)}`);
  w.msgs = []; w.onmessage = (e) => w.msgs.push(JSON.parse(e.data)); w.onopen = () => setTimeout(() => res(w), 600); w.onerror = () => res(w);
});
const ola = ws.msgs.find((m) => m.t === 'ola');
ok(ola && ola.dono === false && ola.semente === 1234, 'conexão normal do chato: não é dono, semente certa');
ws.close();
const falso = await salaCru(mundo.codigo, chato.token, { 'x-usuario': JSON.stringify({ id: dono.usuario.id, nome: 'Dono' + sfx, cor: 0, dono: true }), 'x-mundo': JSON.stringify({ codigo: mundo.codigo, semente: 1, opcoes: {} }) });
ok(falso.status === 101 && /"semente":1234/.test(falso.texto) && /"dono":false/.test(falso.texto), `x-usuario/x-mundo falsos são substituídos pela rota (${falso.status}, ${falso.texto.slice(0, 80)})`);
const lista = await api('mundos', null, dono.token);
ok(lista.mundos && lista.mundos.some((m) => m.codigo === mundo.codigo && m.nome === 'Mundo Alvo'), 'mundo do dono continua com o mesmo nome no banco');

// ---------- 2) arquivos de importação maliciosos ----------
const imp = (arquivo, nome = 'Teste Ruim') => api('mundos/importar', { arquivo, nome }, chato.token);
ok((await imp(null)).status === 400, 'arquivo vazio: 400');
ok((await imp('texto qualquer')).status === 400, 'arquivo que não é JSON: 400');
ok((await imp({ ...arq, formato: 'outro' })).status === 400, 'formato errado: 400');
ok((await imp({ ...arq, semente: -5 })).status === 400 && (await imp({ ...arq, semente: 1.5 })).status === 400 && (await imp({ ...arq, semente: '12' })).status === 400, 'semente negativa, quebrada ou texto: 400');
ok((await imp({ ...arq, edicoes: 'x' })).status === 400, 'edicoes que não é lista: 400');
ok((await imp({ ...arq, edicoes: new Array(200001).fill([0, 30, 0, 1]) })).status === 400, 'mais de 200 mil blocos: 400');
ok((await imp(arq, 'zap 11987654321')).status === 400, 'nome proibido no pedido: 400');
ok((await imp(arq, { toString: 1 })).status === 400, 'nome que não é texto: 400 sem erro interno');
ok((await imp(arq)).status === 429, 'importar sem parar: limite por hora (429)');
const sujo = {
  ...arq, nome: '<img src=x onerror=alert(1)>',
  opcoes: { tamanho: 'enorme', tipo: '__proto__', gerador: 'constructor', selvagens: 'sim', animais: false, __proto__: { veiculos: false }, extra: 1 },
  edicoes: [[1, 30, 1, 3], [200000, 30, 0, 3], [0, 0, 0, 3], [0, 64, 0, 3], [0, 30, 0, 256], [0, 30, 0, -1], ['1', 30, 0, 3], [1.5, 30, 0, 3], [0, 30], null, { x: 1 }, [0, 30, 0, 3, 9]],
};
// (conta nova: cada um só importa 10 por hora, e os pedidos ruins acima também contam)
const limpo = await api('cadastrar', { nome: 'Limpo' + sfx, senha: 'senha123' });
const r = await api('mundos/importar', { arquivo: sujo, nome: 'Arquivo Sujo' }, limpo.token);
ok(r.mundo, 'arquivo cheio de lixo ainda importa só o que presta');
if (r.mundo) {
  ok(r.mundo.opcoes.tamanho === 'grande' && r.mundo.opcoes.tipo === 'normal' && r.mundo.opcoes.gerador === 'atual', 'opções inválidas viram as de padrão');
  ok(r.mundo.opcoes.animais === false && typeof r.mundo.opcoes.selvagens === 'boolean' && !('extra' in r.mundo.opcoes), 'só opções conhecidas e true/false');
  const e = (await api('mundos/exportar', { codigo: r.mundo.codigo }, limpo.token)).edicoes || [];
  ok(e.length === 1 && e[0].join() === '1,30,1,3', 'só o bloco válido entrou: ' + JSON.stringify(e));
  ok(r.mundo.nome === 'Arquivo Sujo', 'nome do arquivo com HTML não é usado (vale o nome validado)');
  await api('mundos/apagar', { codigo: r.mundo.codigo }, limpo.token);
}

// ---------- 3) pedidos de edição estranhos ----------
ok((await api('mundos/editar', { codigo: mundo.codigo, nome: 'Roubado' }, chato.token)).status === 403, 'membro não edita');
ok((await api('mundos/apagar', { codigo: mundo.codigo }, chato.token)).status === 403, 'membro não apaga');
ok((await api('mundos/exportar', { codigo: mundo.codigo }, chato.token)).status === 403, 'membro não exporta');
ok((await api('mundos/editar', { codigo: mundo.codigo, nome: 'Fazenda 12345' }, dono.token)).status === 400, 'dono: nome com 5 números barrado');
ok((await api('mundos/editar', { codigo: mundo.codigo, nome: ['Mundo'] }, dono.token)).status === 400, 'dono: nome que não é texto barrado');
const est = await api('mundos/editar', { codigo: mundo.codigo, opcoes: '{"selvagens":false,"tamanho":"pequeno"}' }, dono.token);
ok(est.mundo && est.mundo.opcoes.tamanho === 'grande', 'opções como texto: tamanho continua travado');
const arr = await api('mundos/editar', { codigo: mundo.codigo, opcoes: [true, false] }, dono.token);
ok(arr.mundo && arr.mundo.nome === 'Mundo Alvo', 'opções como lista: nada quebra');

await api('mundos/apagar', { codigo: mundo.codigo }, dono.token);
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);

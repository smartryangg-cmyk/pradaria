// API de contas e mundos.  /api/cadastrar  /api/entrar  /api/eu  /api/mundos  /api/mundos/entrar
// Dono do mundo: /api/mundos/membros  /api/mundos/expulsar  /api/mundos/codigo-novo  /api/mundos/editar
// /api/mundos/apagar  /api/mundos/exportar.  Importar (vira um mundo novo de quem importa): /api/mundos/importar.  Apagar conta: DELETE /api/eu
import { json, erro, banco, criarToken, usuarioDa, hashSenha, iguais, limitar, codigoNovo, textoProibido } from '../../lib/base.js';
import { normalizarOpcoes, sementeDeTexto, editarOpcoes, opcoesMudadas } from '../../public/js/opcoes-mundo.js';
import { lerArquivo, montarArquivo } from '../../public/js/arquivo-mundo.js';

const NOME_OK = /^[A-Za-zÀ-ÿ0-9_]{3,16}$/;
const NOME_MUNDO_OK = /^[A-Za-zÀ-ÿ0-9 ]{2,24}$/;
const ipDe = (request) => request.headers.get('cf-connecting-ip') || 'local';
const texto = (v) => (typeof v === 'string' ? v : '');

async function corpo(request) { try { return await request.json(); } catch { return {}; } }
const publico = (u) => ({ id: u.id, nome: u.nome, cor: u.cor });

async function cadastrar(request, env) {
  const c0 = await corpo(request);
  const nome = texto(c0.nome), senha = texto(c0.senha), cor = c0.cor;
  if (!NOME_OK.test(nome)) return erro('O nome precisa ter de 3 a 16 letras ou números (sem espaço).');
  if (textoProibido(nome)) return erro('Escolha outro nome: sem números de telefone, redes sociais ou palavras feias.');
  if (senha.length < 4 || senha.length > 100) return erro('A senha precisa ter pelo menos 4 caracteres.');
  const ip = ipDe(request);
  if (!(await limitar(env, 'cad:' + ip, 10, 3600e3))) return erro('Muitas contas criadas agora. Tente mais tarde.', 429);
  const db = await banco(env);
  const existe = await db.prepare('SELECT id FROM usuarios WHERE nome = ?').bind(nome).first();
  if (existe) return erro('Esse nome já existe. Escolha outro!', 409);
  const { hash, sal } = await hashSenha(senha);
  const c = Math.max(0, Math.min(7, cor | 0));
  let r;
  try {
    r = await db.prepare('INSERT INTO usuarios (nome, hash, sal, cor, criado_em) VALUES (?, ?, ?, ?, ?) RETURNING id, nome, cor')
      .bind(nome, hash, sal, c, Date.now()).first();
  } catch (e) { if (/UNIQUE/i.test(String(e))) return erro('Esse nome já existe. Escolha outro!', 409); throw e; }
  return json({ token: await criarToken(env, r), usuario: publico(r) });
}

async function entrar(request, env) {
  const c0 = await corpo(request);
  const nome = texto(c0.nome), senha = texto(c0.senha);
  if (!NOME_OK.test(nome) || senha.length > 100) return erro('Nome ou senha errados.', 401);
  const ip = ipDe(request);
  // por IP, por nome+IP (quem erra a senha só tranca a si mesmo) e um teto maior por nome (contra muitos IPs)
  const n = nome.toLowerCase();
  if (!(await limitar(env, 'ent:' + ip, 30, 15 * 60e3)) || !(await limitar(env, 'enti:' + n + ':' + ip, 10, 15 * 60e3))
    || !(await limitar(env, 'entn:' + n, 60, 15 * 60e3)))
    return erro('Muitas tentativas. Espere uns minutos e tente de novo.', 429);
  const db = await banco(env);
  const u = await db.prepare('SELECT id, nome, cor, hash, sal FROM usuarios WHERE nome = ?').bind(nome).first();
  if (!u) return erro('Nome ou senha errados.', 401);
  const { hash } = await hashSenha(senha, u.sal);
  if (!iguais(hash, u.hash)) return erro('Nome ou senha errados.', 401);
  return json({ token: await criarToken(env, u), usuario: publico(u) });
}

async function listarMundos(env, u) {
  const db = await banco(env);
  const { results } = await db.prepare(`SELECT m.codigo, m.nome, m.opcoes, (m.dono_id = ?1) AS dono, d.nome AS nome_dono
    FROM membros mb JOIN mundos m ON m.id = mb.mundo_id JOIN usuarios d ON d.id = m.dono_id
    WHERE mb.usuario_id = ?1 ORDER BY mb.entrou_em DESC LIMIT 50`).bind(u.id).all();
  return results.map((m) => ({ ...m, dono: !!m.dono, opcoes: normalizarOpcoes(m.opcoes) }));
}

const limparNomeMundo = (nome) => texto(nome).trim().replace(/\s+/g, ' ');
// o nome do mundo aparece para os amigos: mesmas regras ao criar e ao editar
function nomeMundoRuim(n) {
  if (n.length < 2) return 'Dê um nome para o mundo.';
  if (!NOME_MUNDO_OK.test(n)) return 'O nome do mundo pode ter só letras, números e espaços (até 24).';
  if (textoProibido(n)) return 'Escolha outro nome: sem números de telefone, redes sociais ou palavras feias.';
  return null;
}

async function criarMundo(request, env, u) {
  const { nome = '', opcoes = null, semente: sementeTxt = '' } = await corpo(request);
  const n = limparNomeMundo(nome);
  const op = normalizarOpcoes(opcoes);
  const escolhida = sementeDeTexto(String(sementeTxt).slice(0, 40));
  const ruim = nomeMundoRuim(n);
  if (ruim) return erro(ruim);
  return inserirMundo(env, u, n, op, escolhida);
}

// guarda um mundo novo do usuário (criar e importar); depois(m) roda antes de responder (ex.: colocar os blocos importados)
async function inserirMundo(env, u, n, op, escolhida, depois) {
  const db = await banco(env);
  const qtd = await db.prepare('SELECT COUNT(*) AS n FROM mundos WHERE dono_id = ?').bind(u.id).first();
  if (qtd.n >= 10) return erro('Você já tem 10 mundos. Esse é o máximo por enquanto. Apague um para abrir espaço.');
  for (let tent = 0; tent < 5; tent++) {
    const codigo = codigoNovo();
    const semente = escolhida ?? crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000;
    try {
      const m = await db.prepare('INSERT INTO mundos (codigo, nome, dono_id, semente, criado_em, opcoes) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, codigo, nome')
        .bind(codigo, n, u.id, semente, Date.now(), JSON.stringify(op)).first();
      try {
        await db.prepare('INSERT INTO membros (mundo_id, usuario_id, entrou_em) VALUES (?, ?, ?)').bind(m.id, u.id, Date.now()).run();
        if (depois) await depois(m);
      } catch (e) {
        await db.batch([db.prepare('DELETE FROM membros WHERE mundo_id = ?').bind(m.id), db.prepare('DELETE FROM mundos WHERE id = ?').bind(m.id)]);
        throw e;
      }
      return json({ mundo: { codigo: m.codigo, nome: m.nome, dono: true, nome_dono: u.nome, opcoes: op } });
    } catch (e) { if (!/UNIQUE/i.test(String(e))) throw e; }
  }
  return erro('Não consegui criar agora, tente de novo.', 500);
}

async function entrarMundo(request, env, u) {
  const { codigo = '' } = await corpo(request);
  // códigos são sorteados (32^8), mas sem limite dava para tentar até cair no mundo de alguém
  if (!(await limitar(env, 'mun:' + u.id, 15, 3600e3)) || !(await limitar(env, 'munip:' + ipDe(request), 40, 3600e3)))
    return erro('Muitas tentativas de código. Espere um pouco e peça o código de novo ao seu amigo.', 429);
  const db = await banco(env);
  const m = await db.prepare('SELECT m.id, m.codigo, m.nome, m.dono_id, m.opcoes, d.nome AS nome_dono FROM mundos m JOIN usuarios d ON d.id = m.dono_id WHERE m.codigo = ?')
    .bind(texto(codigo).toUpperCase().trim().slice(0, 12)).first();
  if (!m) return erro('Não achei nenhum mundo com esse código.', 404);
  await db.prepare('INSERT INTO membros (mundo_id, usuario_id, entrou_em) VALUES (?, ?, ?) ON CONFLICT (mundo_id, usuario_id) DO UPDATE SET entrou_em = excluded.entrou_em')
    .bind(m.id, u.id, Date.now()).run();
  return json({ mundo: { codigo: m.codigo, nome: m.nome, dono: m.dono_id === u.id, nome_dono: m.nome_dono, opcoes: normalizarOpcoes(m.opcoes) } });
}

// ---------- ferramentas do dono do mundo ----------
async function mundoDoDono(request, env, u) {
  const c = await corpo(request);
  const db = await banco(env);
  const m = await db.prepare('SELECT id, codigo, nome, opcoes, dono_id, sala FROM mundos WHERE codigo = ?').bind(texto(c.codigo).toUpperCase().trim().slice(0, 12)).first();
  if (!m) return { resp: erro('Mundo não encontrado.', 404) };
  if (m.dono_id !== u.id) return { resp: erro('Só o dono do mundo pode fazer isso.', 403) };
  return { db, m, c };
}
// avisa a sala (Durable Object) do mundo; se a sala não estiver configurada (teste local sem worker), segue sem ela
async function avisarSala(env, m, acao, dados) {
  if (!env.SALA) return;
  const nome = m.sala || m.codigo;
  try {
    await env.SALA.get(env.SALA.idFromName(nome)).fetch('https://sala/admin', {
      method: 'POST', headers: { 'x-admin': acao, 'content-type': 'application/json' }, body: JSON.stringify(dados || {}),
    });
  } catch (e) { console.error('sala', acao, e); }
}

// pede algo à sala e devolve a resposta (JSON); diferente de avisarSala, aqui a falha vira erro
async function pedirSala(env, salaNome, acao, dados) {
  if (!env.SALA) throw new Error('sala não configurada');
  const r = await env.SALA.get(env.SALA.idFromName(salaNome)).fetch('https://sala/admin', {
    method: 'POST', headers: { 'x-admin': acao, 'content-type': 'application/json' }, body: JSON.stringify(dados || {}),
  });
  if (!r.ok) throw new Error('sala ' + acao + ' ' + r.status);
  return r.json();
}

async function membros(request, env, u) {
  const { resp, db, m } = await mundoDoDono(request, env, u);
  if (resp) return resp;
  const { results } = await db.prepare(`SELECT us.id, us.nome FROM membros mb JOIN usuarios us ON us.id = mb.usuario_id
    WHERE mb.mundo_id = ? AND mb.usuario_id != ? ORDER BY mb.entrou_em DESC LIMIT 100`).bind(m.id, u.id).all();
  return json({ membros: results });
}

async function expulsar(request, env, u) {
  const { resp, db, m, c } = await mundoDoDono(request, env, u);
  if (resp) return resp;
  const uid = Number(c.uid);
  if (!Number.isInteger(uid) || uid === u.id) return erro('Jogador inválido.');
  await db.prepare('DELETE FROM membros WHERE mundo_id = ? AND usuario_id = ?').bind(m.id, uid).run();
  await avisarSala(env, m, 'expulsar', { uids: [uid] });
  return json({ ok: true });
}

// editar um mundo já criado (só o dono): nome e opções. Tipo, tamanho e gerador não mudam (fazem o terreno).
// Quem estiver jogando recebe a mudança na hora (a sala avisa e o jogo recarrega o mundo com as opções novas).
async function editarMundo(request, env, u) {
  const { resp, db, m, c } = await mundoDoDono(request, env, u);
  if (resp) return resp;
  if (!(await limitar(env, 'edm:' + u.id, 30, 3600e3))) return erro('Muitas mudanças seguidas. Espere um pouco.', 429);
  const nome = c.nome == null ? m.nome : limparNomeMundo(c.nome);
  const ruim = nomeMundoRuim(nome);
  if (ruim) return erro(ruim);
  const antes = normalizarOpcoes(m.opcoes);
  const opcoes = c.opcoes == null ? antes : editarOpcoes(antes, c.opcoes);
  const mudou = opcoesMudadas(antes, opcoes);
  if (nome !== m.nome || mudou.length) {
    await db.prepare('UPDATE mundos SET nome = ?, opcoes = ? WHERE id = ?').bind(nome, JSON.stringify(opcoes), m.id).run();
    await avisarSala(env, m, 'editar', { nome, opcoes, recarregar: mudou.length > 0 });
  }
  return json({ mundo: { codigo: m.codigo, nome, dono: true, nome_dono: u.nome, opcoes }, mudou });
}

// apagar um mundo (só o dono): some do banco e a sala apaga os blocos e tira quem estiver lá
async function apagarMundo(request, env, u) {
  const { resp, db, m } = await mundoDoDono(request, env, u);
  if (resp) return resp;
  await db.batch([
    db.prepare('DELETE FROM membros WHERE mundo_id = ?').bind(m.id),
    db.prepare('DELETE FROM mundos WHERE id = ?').bind(m.id),
  ]);
  await avisarSala(env, m, 'apagar');
  return json({ ok: true });
}

// exportar (só o dono): um arquivo com nome, semente, opções e todos os blocos mudados
async function exportarMundo(request, env, u) {
  const { resp, db, m } = await mundoDoDono(request, env, u);
  if (resp) return resp;
  if (!(await limitar(env, 'exp:' + u.id, 30, 3600e3))) return erro('Muitas exportações seguidas. Espere um pouco.', 429);
  const r = await db.prepare('SELECT semente FROM mundos WHERE id = ?').bind(m.id).first();
  const { edicoes } = env.SALA ? await pedirSala(env, m.sala || m.codigo, 'exportar') : { edicoes: [] };
  return json(montarArquivo({ nome: m.nome, semente: r.semente, opcoes: m.opcoes, edicoes }));
}

// importar: o arquivo vira um mundo NOVO de quem importou (código novo; ninguém mais entra sem ele)
async function importarMundo(request, env, u) {
  if (!(await limitar(env, 'imp:' + u.id, 10, 3600e3))) return erro('Muitas importações seguidas. Espere um pouco.', 429);
  const c = await corpo(request);
  const a = lerArquivo(c.arquivo);
  if (a.erro) return erro(a.erro);
  const n = limparNomeMundo(c.nome == null ? a.nome : c.nome);
  const ruim = nomeMundoRuim(n);
  if (ruim) return erro(ruim);
  return inserirMundo(env, u, n, a.opcoes, a.semente, async (m) => {
    if (a.edicoes.length) await pedirSala(env, m.codigo, 'importar', { semente: a.semente, edicoes: a.edicoes });
  });
}

// código novo: o antigo para de funcionar e todo mundo (menos o dono) precisa do código novo para voltar
async function trocarCodigo(request, env, u) {
  const { resp, db, m } = await mundoDoDono(request, env, u);
  if (resp) return resp;
  const sala = m.sala || m.codigo; // a sala (blocos construídos) continua a mesma
  for (let tent = 0; tent < 5; tent++) {
    const codigo = codigoNovo();
    try {
      await db.batch([
        db.prepare('UPDATE mundos SET codigo = ?, sala = ? WHERE id = ?').bind(codigo, sala, m.id),
        db.prepare('DELETE FROM membros WHERE mundo_id = ? AND usuario_id != ?').bind(m.id, u.id),
      ]);
      await avisarSala(env, m, 'expulsar', { todosMenos: u.id });
      return json({ codigo });
    } catch (e) { if (!/UNIQUE/i.test(String(e))) throw e; }
  }
  return erro('Não consegui trocar agora, tente de novo.', 500);
}

// apagar a conta: some o usuário, os mundos dele e as participações (pede a senha de novo)
async function apagarConta(request, env, u) {
  const { senha = '' } = await corpo(request);
  if (!(await limitar(env, 'apg:' + u.id, 10, 15 * 60e3))) return erro('Muitas tentativas. Espere uns minutos.', 429);
  const db = await banco(env);
  const r = await db.prepare('SELECT hash, sal FROM usuarios WHERE id = ?').bind(u.id).first();
  if (!r) return json({ ok: true });
  const { hash } = await hashSenha(texto(senha).slice(0, 100), r.sal);
  if (!iguais(hash, r.hash)) return erro('Senha errada.', 401);
  const { results: meus } = await db.prepare('SELECT id, codigo, sala FROM mundos WHERE dono_id = ?').bind(u.id).all();
  const { results: outros } = await db.prepare(`SELECT m.id, m.codigo, m.sala FROM membros mb JOIN mundos m ON m.id = mb.mundo_id
    WHERE mb.usuario_id = ? AND m.dono_id != ?`).bind(u.id, u.id).all();
  await db.batch([
    db.prepare('DELETE FROM membros WHERE usuario_id = ? OR mundo_id IN (SELECT id FROM mundos WHERE dono_id = ?)').bind(u.id, u.id),
    db.prepare('DELETE FROM mundos WHERE dono_id = ?').bind(u.id),
    db.prepare('DELETE FROM usuarios WHERE id = ?').bind(u.id),
  ]);
  for (const m of meus) await avisarSala(env, m, 'apagar');
  for (const m of outros) await avisarSala(env, m, 'esquecer', { uid: u.id });
  return json({ ok: true });
}

export async function onRequest({ request, env, params }) {
  const rota = (params.rota || []).join('/');
  const metodo = request.method;
  try {
    if (rota === 'cadastrar' && metodo === 'POST') return await cadastrar(request, env);
    if (rota === 'entrar' && metodo === 'POST') return await entrar(request, env);
    if (rota === 'saude') return json({ ok: true, banco: !!env.DB, sala: !!env.SALA });
    const u = await usuarioDa(request, env);
    if (!u) return erro('Sessão expirada, entre de novo.', 401);
    // a conta pode ter sido apagada: o token assinado continua válido, então confere no banco
    if (!(await (await banco(env)).prepare('SELECT 1 AS ok FROM usuarios WHERE id = ?').bind(u.id).first())) return erro('Sessão expirada, entre de novo.', 401);
    if (rota === 'eu' && metodo === 'DELETE') return await apagarConta(request, env, u);
    if (rota === 'eu') return json({ usuario: u });
    if (rota === 'mundos' && metodo === 'GET') return json({ mundos: await listarMundos(env, u) });
    if (rota === 'mundos' && metodo === 'POST') return await criarMundo(request, env, u);
    if (rota === 'mundos/entrar' && metodo === 'POST') return await entrarMundo(request, env, u);
    if (rota === 'mundos/membros' && metodo === 'POST') return await membros(request, env, u);
    if (rota === 'mundos/expulsar' && metodo === 'POST') return await expulsar(request, env, u);
    if (rota === 'mundos/codigo-novo' && metodo === 'POST') return await trocarCodigo(request, env, u);
    if (rota === 'mundos/editar' && metodo === 'POST') return await editarMundo(request, env, u);
    if (rota === 'mundos/apagar' && metodo === 'POST') return await apagarMundo(request, env, u);
    if (rota === 'mundos/exportar' && metodo === 'POST') return await exportarMundo(request, env, u);
    if (rota === 'mundos/importar' && metodo === 'POST') return await importarMundo(request, env, u);
    return erro('Rota não encontrada', 404);
  } catch (e) {
    console.error(e);
    return erro('Algo deu errado no servidor. Tente de novo daqui a pouco.', 500);
  }
}

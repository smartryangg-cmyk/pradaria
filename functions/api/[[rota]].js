// API de contas e mundos.  /api/cadastrar  /api/entrar  /api/eu  /api/mundos  /api/mundos/entrar
import { json, erro, banco, criarToken, usuarioDa, hashSenha, iguais, limitar, codigoNovo } from '../../lib/base.js';
import { normalizarOpcoes, sementeDeTexto } from '../../public/js/opcoes-mundo.js';

const NOME_OK = /^[A-Za-zÀ-ÿ0-9_]{3,16}$/;

async function corpo(request) { try { return await request.json(); } catch { return {}; } }
const publico = (u) => ({ id: u.id, nome: u.nome, cor: u.cor });

async function cadastrar(request, env) {
  const { nome = '', senha = '', cor = 0 } = await corpo(request);
  if (!NOME_OK.test(nome)) return erro('O nome precisa ter de 3 a 16 letras ou números (sem espaço).');
  if (senha.length < 4 || senha.length > 100) return erro('A senha precisa ter pelo menos 4 caracteres.');
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (!(await limitar(env, 'cad:' + ip, 10, 3600e3))) return erro('Muitas contas criadas agora. Tente mais tarde.', 429);
  const db = await banco(env);
  const existe = await db.prepare('SELECT id FROM usuarios WHERE nome = ?').bind(nome).first();
  if (existe) return erro('Esse nome já existe. Escolha outro!', 409);
  const { hash, sal } = await hashSenha(senha);
  const c = Math.max(0, Math.min(7, cor | 0));
  const r = await db.prepare('INSERT INTO usuarios (nome, hash, sal, cor, criado_em) VALUES (?, ?, ?, ?, ?) RETURNING id, nome, cor')
    .bind(nome, hash, sal, c, Date.now()).first();
  return json({ token: await criarToken(env, r), usuario: publico(r) });
}

async function entrar(request, env) {
  const { nome = '', senha = '' } = await corpo(request);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (!(await limitar(env, 'ent:' + ip, 30, 15 * 60e3)) || !(await limitar(env, 'entn:' + nome.toLowerCase(), 10, 15 * 60e3)))
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

async function criarMundo(request, env, u) {
  const { nome = '', opcoes = null, semente: sementeTxt = '' } = await corpo(request);
  const n = String(nome).trim().slice(0, 24);
  const op = normalizarOpcoes(opcoes);
  const escolhida = sementeDeTexto(String(sementeTxt).slice(0, 40));
  if (n.length < 2) return erro('Dê um nome para o mundo.');
  const db = await banco(env);
  const qtd = await db.prepare('SELECT COUNT(*) AS n FROM mundos WHERE dono_id = ?').bind(u.id).first();
  if (qtd.n >= 10) return erro('Você já tem 10 mundos. Esse é o máximo por enquanto.');
  for (let tent = 0; tent < 5; tent++) {
    const codigo = codigoNovo();
    const semente = escolhida ?? crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000;
    try {
      const m = await db.prepare('INSERT INTO mundos (codigo, nome, dono_id, semente, criado_em, opcoes) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, codigo, nome')
        .bind(codigo, n, u.id, semente, Date.now(), JSON.stringify(op)).first();
      await db.prepare('INSERT INTO membros (mundo_id, usuario_id, entrou_em) VALUES (?, ?, ?)').bind(m.id, u.id, Date.now()).run();
      return json({ mundo: { codigo: m.codigo, nome: m.nome, dono: true, nome_dono: u.nome, opcoes: op } });
    } catch (e) { if (!/UNIQUE/i.test(String(e))) throw e; }
  }
  return erro('Não consegui criar agora, tente de novo.', 500);
}

async function entrarMundo(request, env, u) {
  const { codigo = '' } = await corpo(request);
  const db = await banco(env);
  const m = await db.prepare('SELECT m.id, m.codigo, m.nome, m.dono_id, m.opcoes, d.nome AS nome_dono FROM mundos m JOIN usuarios d ON d.id = m.dono_id WHERE m.codigo = ?')
    .bind(String(codigo).toUpperCase().trim()).first();
  if (!m) return erro('Não achei nenhum mundo com esse código.', 404);
  await db.prepare('INSERT INTO membros (mundo_id, usuario_id, entrou_em) VALUES (?, ?, ?) ON CONFLICT (mundo_id, usuario_id) DO UPDATE SET entrou_em = excluded.entrou_em')
    .bind(m.id, u.id, Date.now()).run();
  return json({ mundo: { codigo: m.codigo, nome: m.nome, dono: m.dono_id === u.id, nome_dono: m.nome_dono, opcoes: normalizarOpcoes(m.opcoes) } });
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
    if (rota === 'eu') return json({ usuario: u });
    if (rota === 'mundos' && metodo === 'GET') return json({ mundos: await listarMundos(env, u) });
    if (rota === 'mundos' && metodo === 'POST') return await criarMundo(request, env, u);
    if (rota === 'mundos/entrar' && metodo === 'POST') return await entrarMundo(request, env, u);
    return erro('Rota não encontrada', 404);
  } catch (e) {
    console.error(e);
    return erro('Erro no servidor: ' + (e.message || e), 500);
  }
}

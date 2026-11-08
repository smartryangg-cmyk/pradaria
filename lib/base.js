// Utilidades do servidor (Pages Functions): banco, senhas e sessões assinadas.
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export const json = (dados, status = 200) => new Response(JSON.stringify(dados), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
export const erro = (msg, status = 400) => json({ erro: msg }, status);

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL UNIQUE COLLATE NOCASE, hash TEXT NOT NULL, sal TEXT NOT NULL, cor INTEGER NOT NULL DEFAULT 0, criado_em INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS mundos (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, dono_id INTEGER NOT NULL, semente INTEGER NOT NULL, criado_em INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS membros (mundo_id INTEGER NOT NULL, usuario_id INTEGER NOT NULL, entrou_em INTEGER NOT NULL, PRIMARY KEY (mundo_id, usuario_id))`,
  `CREATE INDEX IF NOT EXISTS membros_usuario ON membros (usuario_id)`,
  `CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tentativas (chave TEXT PRIMARY KEY, n INTEGER NOT NULL, ate INTEGER NOT NULL)`,
];
let pronto = null;
export function banco(env) {
  if (!env.DB) throw new Error('Banco D1 (DB) não configurado');
  if (!pronto) pronto = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s)))
    // mundos antigos: coluna das opções de criação (falha "duplicate column" quando já existe)
    .then(() => env.DB.prepare(`ALTER TABLE mundos ADD COLUMN opcoes TEXT NOT NULL DEFAULT '{}'`).run().catch((e) => { if (!/duplicate column/i.test(String(e && (e.cause?.message || e.message) || e))) throw e; }))
    .catch((e) => { pronto = null; throw e; });
  return pronto.then(() => env.DB);
}

// segredo das sessões: variável SEGREDO ou um aleatório guardado no próprio banco
let segredoCache = null;
async function segredo(env) {
  if (env.SEGREDO) return env.SEGREDO;
  if (segredoCache) return segredoCache;
  const db = await banco(env);
  let r = await db.prepare(`SELECT valor FROM config WHERE chave = 'segredo'`).first();
  if (!r) {
    const novo = b64u(crypto.getRandomValues(new Uint8Array(32)));
    await db.prepare(`INSERT OR IGNORE INTO config (chave, valor) VALUES ('segredo', ?)`).bind(novo).run();
    r = await db.prepare(`SELECT valor FROM config WHERE chave = 'segredo'`).first();
  }
  segredoCache = r.valor;
  return segredoCache;
}
async function chaveHmac(env) {
  return crypto.subtle.importKey('raw', enc.encode(await segredo(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function criarToken(env, u) {
  const carga = b64u(enc.encode(JSON.stringify({ u: u.id, n: u.nome, c: u.cor, exp: Date.now() + 1000 * 60 * 60 * 24 * 180 })));
  const sig = await crypto.subtle.sign('HMAC', await chaveHmac(env), enc.encode(carga));
  return carga + '.' + b64u(sig);
}

export async function lerToken(env, token) {
  if (!token || !token.includes('.')) return null;
  const [carga, sig] = token.split('.');
  try {
    const ok = await crypto.subtle.verify('HMAC', await chaveHmac(env), deB64u(sig), enc.encode(carga));
    if (!ok) return null;
    const d = JSON.parse(new TextDecoder().decode(deB64u(carga)));
    if (d.exp < Date.now()) return null;
    return { id: d.u, nome: d.n, cor: d.c };
  } catch { return null; }
}

export async function usuarioDa(request, env) {
  const h = request.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : new URL(request.url).searchParams.get('t');
  return lerToken(env, t);
}

export async function hashSenha(senha, salB64) {
  const sal = salB64 ? deB64u(salB64) : crypto.getRandomValues(new Uint8Array(16));
  const base = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sal, iterations: 100000, hash: 'SHA-256' }, base, 256);
  return { hash: b64u(bits), sal: b64u(sal) };
}

export function iguais(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// limite simples de tentativas (por nome e por IP)
export async function limitar(env, chave, max, janelaMs) {
  const db = await banco(env);
  const agora = Date.now();
  const r = await db.prepare(`SELECT n, ate FROM tentativas WHERE chave = ?`).bind(chave).first();
  if (r && r.ate > agora && r.n >= max) return false;
  if (!r || r.ate <= agora) await db.prepare(`INSERT OR REPLACE INTO tentativas (chave, n, ate) VALUES (?, 1, ?)`).bind(chave, agora + janelaMs).run();
  else await db.prepare(`UPDATE tentativas SET n = n + 1 WHERE chave = ?`).bind(chave).run();
  return true;
}

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codigoNovo(n = 6) {
  const r = crypto.getRandomValues(new Uint8Array(n));
  return [...r].map((x) => LETRAS[x % LETRAS.length]).join('');
}

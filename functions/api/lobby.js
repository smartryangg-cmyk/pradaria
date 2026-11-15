// Liga a aba do jogador (WebSocket) ao saguão da plataforma: amigos online e convites (sala-worker/src/lobby.js).
import { erro, banco, usuarioDa } from '../../lib/base.js';
import { idsDosAmigos } from '../../lib/amigos.js';

export async function onRequest({ request, env }) {
  if (request.headers.get('upgrade') !== 'websocket') return erro('Use WebSocket', 426);
  if (!env.LOBBY) return erro('Saguão não configurado (LOBBY)', 503);
  const u = await usuarioDa(request, env);
  if (!u) return erro('Sessão expirada', 401);
  const db = await banco(env);
  const atual = await db.prepare('SELECT id, nome FROM usuarios WHERE id = ?').bind(u.id).first();
  if (!atual) return erro('Sessão expirada', 401);
  const amigos = await idsDosAmigos(db, u.id);
  const url = new URL(request.url);
  url.searchParams.delete('t');
  // só os cabeçalhos do WebSocket passam (nada de x-admin vindo do jogador)
  const cab = new Headers();
  for (const k of ['upgrade', 'connection', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol', 'sec-websocket-extensions'])
    if (request.headers.has(k)) cab.set(k, request.headers.get(k));
  cab.set('x-usuario', JSON.stringify({ id: atual.id, nome: atual.nome }));
  cab.set('x-amigos', JSON.stringify(amigos));
  return env.LOBBY.get(env.LOBBY.idFromName('geral')).fetch(new Request(url.toString(), { method: 'GET', headers: cab }));
}

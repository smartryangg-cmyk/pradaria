// Liga o jogador (WebSocket) a uma partida de tabuleiro entre amigos (sala-worker/src/partida.js).
// O código é sorteado por quem cria a partida e chega ao amigo pelo convite.
import { erro, banco, usuarioDa } from '../../../lib/base.js';

export async function onRequest({ request, env, params }) {
  if (request.headers.get('upgrade') !== 'websocket') return erro('Use WebSocket', 426);
  if (!env.PARTIDA) return erro('Partidas não configuradas (PARTIDA)', 503);
  const u = await usuarioDa(request, env);
  if (!u) return erro('Sessão expirada', 401);
  const codigo = String(params.codigo || '');
  if (!/^[A-Za-z0-9]{10,24}$/.test(codigo)) return erro('Código inválido', 400);
  const atual = await (await banco(env)).prepare('SELECT id, nome FROM usuarios WHERE id = ?').bind(u.id).first();
  if (!atual) return erro('Sessão expirada', 401);
  const url = new URL(request.url);
  url.searchParams.delete('t');
  const cab = new Headers();
  for (const k of ['upgrade', 'connection', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol', 'sec-websocket-extensions'])
    if (request.headers.has(k)) cab.set(k, request.headers.get(k));
  cab.set('x-usuario', JSON.stringify({ id: atual.id, nome: atual.nome }));
  return env.PARTIDA.get(env.PARTIDA.idFromName(codigo)).fetch(new Request(url.toString(), { method: 'GET', headers: cab }));
}

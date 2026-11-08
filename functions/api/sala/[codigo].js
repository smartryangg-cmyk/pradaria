// Liga o jogador (WebSocket) à sala do mundo, que roda num Durable Object.
import { erro, banco, usuarioDa } from '../../../lib/base.js';
import { normalizarOpcoes } from '../../../public/js/opcoes-mundo.js';
import { normalizarSkin } from '../../../public/js/skin.js';

export async function onRequest({ request, env, params }) {
  if (request.headers.get('upgrade') !== 'websocket') return erro('Use WebSocket', 426);
  if (!env.SALA) return erro('Multijogador não configurado (SALA)', 503);
  const u = await usuarioDa(request, env);
  if (!u) return erro('Sessão expirada', 401);
  const codigo = String(params.codigo || '').toUpperCase();
  const db = await banco(env);
  const m = await db.prepare('SELECT m.id, m.semente, m.dono_id, m.opcoes, m.sala, us.skin FROM mundos m JOIN membros mb ON mb.mundo_id = m.id AND mb.usuario_id = ? JOIN usuarios us ON us.id = mb.usuario_id WHERE m.codigo = ?')
    .bind(u.id, codigo).first();
  if (!m) return erro('Você não está nesse mundo', 403);
  const url = new URL(request.url);
  url.searchParams.delete('t');
  const req = new Request(url.toString(), request);
  req.headers.set('x-usuario', JSON.stringify({ id: u.id, nome: u.nome, cor: u.cor, dono: m.dono_id === u.id, skin: normalizarSkin(m.skin, u.cor) }));
  req.headers.set('x-mundo', JSON.stringify({ codigo, semente: m.semente, opcoes: normalizarOpcoes(m.opcoes) }));
  // a sala tem nome fixo: quando o dono troca o código, os blocos construídos continuam lá
  const sala = env.SALA.get(env.SALA.idFromName(m.sala || codigo));
  return sala.fetch(req);
}

// Amigos da plataforma: pedir pelo nome, aceitar/recusar, desfazer. Tabela amizades (de pediu para "para").
// estado 0 = pedido esperando resposta, 1 = amigos. Quem está online e os convites ficam no saguão (sala-worker/src/lobby.js).
import { json, erro, banco, limitar } from './base.js';

export const MAX_AMIGOS = 100;
const corpo = async (r) => { try { const t = await r.text(); return t.length > 2000 ? {} : JSON.parse(t || '{}') || {}; } catch { return {}; } };

// avisa o saguão (se existir) para atualizar os dois na hora
async function avisar(env, a, b, amigos, pedido = false) {
  if (!env.LOBBY) return;
  try {
    const st = env.LOBBY.get(env.LOBBY.idFromName('geral'));
    await st.fetch('https://lobby/admin', { method: 'POST', headers: { 'x-admin': 'amizade' }, body: JSON.stringify({ a, b, amigos, pedido }) });
  } catch (e) { console.error('lobby', e); }
}

export async function idsDosAmigos(db, uid) {
  const { results } = await db.prepare('SELECT CASE WHEN de = ?1 THEN para ELSE de END AS id FROM amizades WHERE (de = ?1 OR para = ?1) AND estado = 1').bind(uid).all();
  return results.map((r) => r.id);
}

export async function listarAmigos(env, u) {
  const db = await banco(env);
  const { results } = await db.prepare(`SELECT us.id, us.nome, us.cor, a.estado, a.de FROM amizades a
    JOIN usuarios us ON us.id = CASE WHEN a.de = ?1 THEN a.para ELSE a.de END
    WHERE a.de = ?1 OR a.para = ?1 ORDER BY us.nome`).bind(u.id).all();
  const p = (r) => ({ id: r.id, nome: r.nome, cor: r.cor });
  return json({
    amigos: results.filter((r) => r.estado === 1).map(p),
    recebidos: results.filter((r) => r.estado === 0 && r.de !== u.id).map(p),
    enviados: results.filter((r) => r.estado === 0 && r.de === u.id).map(p),
  });
}

async function contar(db, uid) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM amizades WHERE (de = ?1 OR para = ?1) AND estado = 1').bind(uid).first();
  return r.n;
}

export async function pedirAmizade(request, env, u) {
  const { nome = '' } = await corpo(request);
  const alvo = String(nome).trim().slice(0, 20);
  if (!alvo) return erro('Escreva o nome do seu amigo.');
  if (!(await limitar(env, 'ami:' + u.id, 30, 3600e3))) return erro('Muitos pedidos agora. Espere um pouco.', 429);
  const db = await banco(env);
  const o = await db.prepare('SELECT id, nome, cor FROM usuarios WHERE nome = ?').bind(alvo).first();
  if (!o) return erro('Não achei ninguém com esse nome. Confira as letras.', 404);
  if (o.id === u.id) return erro('Esse é você!');
  const ja = await db.prepare('SELECT de, estado FROM amizades WHERE (de = ?1 AND para = ?2) OR (de = ?2 AND para = ?1)').bind(u.id, o.id).first();
  if (ja && ja.estado === 1) return erro(`Você e ${o.nome} já são amigos.`);
  if (ja && ja.de === u.id) return erro(`Você já chamou ${o.nome}. Falta aceitar.`);
  if (await contar(db, u.id) >= MAX_AMIGOS) return erro(`Você chegou a ${MAX_AMIGOS} amigos.`);
  if (ja) {
    // o outro já tinha pedido: vira amizade direto
    if (await contar(db, o.id) >= MAX_AMIGOS) return erro(`${o.nome} já tem amigos demais.`);
    await db.prepare('UPDATE amizades SET estado = 1 WHERE de = ? AND para = ?').bind(o.id, u.id).run();
    await avisar(env, u.id, o.id, true);
    return json({ ok: true, amigos: true, nome: o.nome });
  }
  // no máximo 50 pedidos esperando resposta
  const pend = await db.prepare('SELECT COUNT(*) AS n FROM amizades WHERE de = ? AND estado = 0').bind(u.id).first();
  if (pend.n >= 50) return erro('Você tem pedidos demais esperando resposta.');
  await db.prepare('INSERT INTO amizades (de, para, estado, criado_em) VALUES (?, ?, 0, ?)').bind(u.id, o.id, Date.now()).run();
  await avisar(env, u.id, o.id, false, true);
  return json({ ok: true, amigos: false, nome: o.nome });
}

export async function responderAmizade(request, env, u) {
  const { id, aceitar } = await corpo(request);
  const db = await banco(env);
  const r = await db.prepare('SELECT de FROM amizades WHERE de = ? AND para = ? AND estado = 0').bind(+id || 0, u.id).first();
  if (!r) return erro('Esse pedido não existe mais.', 404);
  if (aceitar) {
    if (await contar(db, u.id) >= MAX_AMIGOS) return erro(`Você chegou a ${MAX_AMIGOS} amigos.`);
    if (await contar(db, r.de) >= MAX_AMIGOS) return erro('Esse jogador já tem amigos demais.');
    await db.prepare('UPDATE amizades SET estado = 1 WHERE de = ? AND para = ?').bind(r.de, u.id).run();
  } else await db.prepare('DELETE FROM amizades WHERE de = ? AND para = ?').bind(r.de, u.id).run();
  await avisar(env, u.id, r.de, !!aceitar);
  return json({ ok: true });
}

// desfaz a amizade ou cancela um pedido que eu fiz
export async function removerAmizade(request, env, u) {
  const { id } = await corpo(request);
  const db = await banco(env);
  await db.prepare('DELETE FROM amizades WHERE (de = ?1 AND para = ?2) OR (de = ?2 AND para = ?1)').bind(u.id, +id || 0).run();
  await avisar(env, u.id, +id || 0, false);
  return json({ ok: true });
}

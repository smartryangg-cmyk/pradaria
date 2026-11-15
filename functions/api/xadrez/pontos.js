// Os pontos do xadrez da conta (bullet, blitz, rápida): nota, se ainda é provisória, partidas, vitórias, derrotas e empates.
import { json, erro, usuarioDa } from '../../../lib/base.js';
import * as P from '../../../public/js/pontos-regras.js';

export async function onRequestGet({ request, env }) {
  const u = await usuarioDa(request, env);
  if (!u) return erro('Sessão expirada', 401);
  if (!env.PONTOS) return erro('Pontos não configurados (PONTOS)', 503);
  const r = await env.PONTOS.get(env.PONTOS.idFromName('geral')).fetch('https://pontos/interno?uids=' + u.id, { headers: { 'x-interno': 'ver' } });
  const n = ((await r.json()) || {})[u.id] || {};
  const out = {};
  for (const cat of Object.keys(P.NOME_CATEGORIA)) {
    const x = P.envelhecer({ ...P.INICIAL, ...(n[cat] || {}) }, Date.now());
    out[cat] = { r: Math.round(x.r), mostrar: P.mostrar(x), provisorio: P.provisorio(x), jogos: x.jogos, v: x.v, d: x.d, e: x.e };
  }
  return json({ pontos: out });
}

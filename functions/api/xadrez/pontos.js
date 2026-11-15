// Os pontos do xadrez (ou da dama, com ?jogo=dama) da conta (bullet, blitz, rápida): nota, se ainda é provisória, partidas, vitórias, derrotas e empates.
import { json, erro, usuarioDa } from '../../../lib/base.js';
import * as P from '../../../public/js/pontos-regras.js';

export async function onRequestGet({ request, env }) {
  const u = await usuarioDa(request, env);
  if (!u) return erro('Sessão expirada', 401);
  if (!env.PONTOS) return erro('Pontos não configurados (PONTOS)', 503);
  // ?partidas=1: também as últimas partidas (perfil)
  const comPartidas = new URL(request.url).searchParams.get('partidas') === '1';
  // ?jogo=dama: as notas da dama (dama-bullet, dama-blitz, dama-rapida); ?jogo=truco: a do truco
  const jogo = ['dama', 'truco'].includes(new URL(request.url).searchParams.get('jogo')) ? new URL(request.url).searchParams.get('jogo') : 'xadrez';
  const r = await env.PONTOS.get(env.PONTOS.idFromName('geral')).fetch('https://pontos/interno?uids=' + u.id + (comPartidas ? '&partidas=1' : ''), { headers: { 'x-interno': 'ver' } });
  const d = (await r.json()) || {};
  const n = (comPartidas ? d.notas : d)[u.id] || {};
  const out = {};
  for (const cat of Object.keys(P.categoriasDo(jogo))) {
    const x = P.envelhecer({ ...P.INICIAL, ...(n[cat] || {}) }, Date.now());
    out[cat] = { r: Math.round(x.r), mostrar: P.mostrar(x), provisorio: P.provisorio(x), jogos: x.jogos, v: x.v, d: x.d, e: x.e };
  }
  return json(comPartidas ? { pontos: out, partidas: d.partidas || [] } : { pontos: out });
}

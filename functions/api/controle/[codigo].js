// Celular como controle da TV: liga a TV (?papel=tv) e o celular (?papel=cel) na mesma sala de controle.
// Não precisa de conta: o código é aleatório, curto e só aparece na tela da TV.
import { erro, limitar } from '../../../lib/base.js';

const CODIGO_OK = /^[A-HJ-NP-Z2-9]{6}$/; // sem I, O, 0 e 1 (fáceis de confundir)

export async function onRequest({ request, env, params }) {
  if (request.headers.get('upgrade') !== 'websocket') return erro('Use WebSocket', 426);
  if (!env.CONTROLE) return erro('Controle pelo celular não configurado', 503);
  const codigo = String(params.codigo || '').toUpperCase();
  if (!CODIGO_OK.test(codigo)) return erro('Código inválido', 400);
  const papel = new URL(request.url).searchParams.get('papel') === 'tv' ? 'tv' : 'cel';
  // celular: no máximo 30 tentativas de código a cada 10 min por IP. Sem isso dava para chutar códigos
  // até cair na TV de alguém e controlar o jogo (andar, escrever no chat, mexer nos menus).
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (papel === 'cel' && ip !== 'local' && env.DB && !(await limitar(env, 'ctl:' + ip, 30, 10 * 60e3)))
    return erro('Muitas tentativas de código. Espere uns minutos.', 429);
  const cab = new Headers();
  for (const k of ['upgrade', 'connection', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol', 'sec-websocket-extensions'])
    if (request.headers.has(k)) cab.set(k, request.headers.get(k));
  cab.set('x-controle', papel);
  const req = new Request('https://controle/' + codigo, { method: 'GET', headers: cab });
  return env.CONTROLE.get(env.CONTROLE.idFromName(codigo)).fetch(req);
}

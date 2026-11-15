// Celular como controle da TV: liga a TV (?papel=tv) e o celular (?papel=cel) na mesma sala de controle.
// Não precisa de conta: o código é aleatório, curto e só aparece na tela da TV.
import { erro } from '../../../lib/base.js';

const CODIGO_OK = /^[A-HJ-NP-Z2-9]{6}$/; // sem I, O, 0 e 1 (fáceis de confundir)

export async function onRequest({ request, env, params }) {
  if (request.headers.get('upgrade') !== 'websocket') return erro('Use WebSocket', 426);
  if (!env.CONTROLE) return erro('Controle pelo celular não configurado', 503);
  const codigo = String(params.codigo || '').toUpperCase();
  if (!CODIGO_OK.test(codigo)) return erro('Código inválido', 400);
  const papel = new URL(request.url).searchParams.get('papel') === 'tv' ? 'tv' : 'cel';
  const cab = new Headers();
  for (const k of ['upgrade', 'connection', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol', 'sec-websocket-extensions'])
    if (request.headers.has(k)) cab.set(k, request.headers.get(k));
  cab.set('x-controle', papel);
  const req = new Request('https://controle/' + codigo, { method: 'GET', headers: cab });
  return env.CONTROLE.get(env.CONTROLE.idFromName(codigo)).fetch(req);
}

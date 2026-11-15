// Chat de voz sem mostrar o endereço de internet de casa (IP público) para os outros jogadores.
// A sala passa só os caminhos seguros: endereço da rede de casa (192.168..., 10..., .local) e servidor de retransmissão (relay).
// Resultado: a voz funciona entre aparelhos da mesma casa/rede; entre casas diferentes precisa de um servidor TURN.
// Não importa nada: a sala (sala-worker) usa este arquivo direto.

const privadoV4 = (ip) => {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  // rede de casa, link local, loopback, CGNAT da operadora (100.64/10) e faixas de teste/documentação (não vão para a internet)
  return p[0] === 10 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254) || p[0] === 127 ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || (p[0] === 192 && p[1] === 0 && p[2] === 2) || (p[0] === 198 && p[1] === 51 && p[2] === 100) || (p[0] === 203 && p[1] === 0 && p[2] === 113);
};
const privadoV6 = (ip) => /^(fe8|fe9|fea|feb|fc|fd)/i.test(ip) || ip === '::1';
export const enderecoSeguro = (ip) => {
  ip = String(ip || '').trim();
  if (!ip || ip === '0.0.0.0' || ip === '::') return true;
  if (/\.local$/i.test(ip)) return true; // nome escondido que o navegador inventa
  if (ip.includes(':')) return privadoV6(ip);
  return privadoV4(ip);
};

// "candidate:1 1 udp 2122260223 192.168.0.5 54321 typ host ..." -> true se não mostra o IP de casa
export function candidatoSeguro(c) {
  const p = String(c).replace(/^a=/, '').trim().split(/\s+/);
  const i = p.indexOf('typ');
  if (i < 0 || p.length < 8) return false;
  const tipo = p[i + 1];
  if (tipo === 'relay') return true; // passa por um servidor; o outro só vê o servidor
  if (tipo !== 'host') return false; // srflx/prflx = o IP público de casa
  return enderecoSeguro(p[4]);
}

// tira do SDP as linhas de candidato que mostrariam o IP de casa e esconde o endereço das linhas c= e a=rtcp
export function sdpSemIp(sdp) {
  return String(sdp).split(/\r?\n/).filter((l) => !l.startsWith('a=candidate:') || candidatoSeguro(l))
    .map((l) => {
      let m = l.match(/^c=IN (IP4|IP6) (\S+)/);
      if (m && !enderecoSeguro(m[2])) return 'c=IN ' + m[1] + ' ' + (m[1] === 'IP4' ? '0.0.0.0' : '::');
      m = l.match(/^(a=rtcp:\d+ IN (IP4|IP6) )(\S+)/);
      if (m && !enderecoSeguro(m[3])) return m[1] + (m[2] === 'IP4' ? '0.0.0.0' : '::');
      return l;
    }).join('\r\n');
}

// Voz sem mostrar o IP de casa: a sala só deixa passar endereço da rede de casa (.local, 192.168...) e relay.
// Uso: node testes/teste-voz-filtro.mjs
import { candidatoSeguro, sdpSemIp } from '../public/js/voz-filtro.js';
let falhas = 0;
const conferir = (ok, msg) => { console.log((ok ? 'ok   ' : 'FALHA') + ' ' + msg); if (!ok) falhas++; };
const c = (ip, typ) => `candidate:1 1 udp 2122260223 ${ip} 54321 typ ${typ} generation 0`;
conferir(candidatoSeguro(c('9a1b2c3d-1111-2222-3333-444455556666.local', 'host')), 'host .local passa');
conferir(candidatoSeguro(c('192.168.0.12', 'host')) && candidatoSeguro(c('10.0.0.5', 'host')) && candidatoSeguro(c('172.20.1.2', 'host')), 'host da rede de casa passa');
conferir(!candidatoSeguro(c('189.45.67.89', 'srflx') + ' raddr 0.0.0.0 rport 0'), 'srflx (IP público) é barrado');
conferir(!candidatoSeguro(c('189.45.67.89', 'host')), 'host com IP público é barrado');
conferir(!candidatoSeguro(c('2804:14c:1234::1', 'host')), 'host com IPv6 público é barrado');
conferir(!candidatoSeguro(c('189.45.67.89', 'prflx')), 'prflx é barrado');
conferir(candidatoSeguro(c('104.30.1.1', 'relay')), 'relay (servidor) passa');
conferir(!candidatoSeguro('lixo'), 'texto estranho é barrado');
const sdp = ['v=0', 'o=- 1 2 IN IP4 127.0.0.1', 'm=audio 9 UDP/TLS/RTP/SAVPF 111', 'c=IN IP4 189.45.67.89', 'a=rtcp:9 IN IP4 189.45.67.89',
  'a=' + c('abc.local', 'host'), 'a=' + c('189.45.67.89', 'srflx') + ' raddr 0.0.0.0 rport 0', 'a=mid:0'].join('\r\n');
const limpo = sdpSemIp(sdp);
conferir(!limpo.includes('189.45.67.89'), 'SDP sem o IP público');
conferir(limpo.includes('abc.local') && limpo.includes('a=mid:0') && limpo.includes('c=IN IP4 0.0.0.0'), 'SDP continua com o resto');
if (falhas) { console.log(falhas + ' falha(s)'); process.exit(1); }
console.log('tudo certo');

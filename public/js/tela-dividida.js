// Tela dividida na TV (/tv-dupla): cada metade da TV é um jogo inteiro dentro de uma moldura
// (/tv?p=1 e /tv?p=2), cada um com o próprio celular como controle.
// O Jogador 2 guarda tudo separado do Jogador 1 (conta, ajustes, mochila, código do celular),
// para cada um entrar na sua conta. Roda antes do jogo (script comum, não módulo).
(function () {
  var p = new URLSearchParams(location.search).get('p');
  if (window.top === window || (p !== '1' && p !== '2')) return;
  window.jogadorTV = +p;
  document.documentElement.classList.add('tela-dividida', 'jogador-' + p);
  if (p !== '2') return;
  var S = Storage.prototype, ler = S.getItem, gravar = S.setItem, tirar = S.removeItem, pre = 'p2:';
  S.getItem = function (k) { return ler.call(this, pre + k); };
  S.setItem = function (k, v) { return gravar.call(this, pre + k, v); };
  S.removeItem = function (k) { return tirar.call(this, pre + k); };
})();

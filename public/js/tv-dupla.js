// Tela dividida na TV: duas metades (Jogador 1 e Jogador 2), cada uma com o seu celular.
// Esta página só junta as duas: conta para uma metade em que mundo online a outra está
// (para o outro jogador entrar com um OK) e volta para um jogador quando alguém pede.
const metade = { 1: document.getElementById('j1'), 2: document.getElementById('j2') };
const mundos = { 1: null, 2: null };
for (const p of [1, 2]) metade[p].src = `/tv?p=${p}${location.hash}`;
const contar = (para) => {
  const de = para === 1 ? 2 : 1;
  try { metade[para].contentWindow.postMessage({ t: 'mundo-par', de, mundo: mundos[de] }, location.origin); } catch {}
};
addEventListener('message', (ev) => {
  if (ev.origin !== location.origin) return;
  const p = ev.source === metade[1].contentWindow ? 1 : ev.source === metade[2].contentWindow ? 2 : 0;
  const m = ev.data;
  if (!p || !m || typeof m.t !== 'string') return;
  if (m.t === 'mundo') {
    const c = m.mundo && typeof m.mundo.codigo === 'string' ? { codigo: m.mundo.codigo.slice(0, 40), nome: String(m.mundo.nome || '').slice(0, 60) } : null;
    mundos[p] = c;
    contar(p === 1 ? 2 : 1);
  } else if (m.t === 'pronto') contar(p); // a metade (re)carregou: conta o mundo da outra
  else if (m.t === 'um') location.href = '/tv' + location.hash;
});
// o controle remoto da TV fala com a metade do Jogador 1
metade[1].addEventListener('load', () => metade[1].focus());
window.__dupla = { mundos };

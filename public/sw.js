// Deixa o jogo instalável e abrindo sem internet.
// Rede primeiro (para sempre pegar a versão nova); se não tiver internet, usa a cópia guardada.
const CACHE = 'pradaria-v35';
const BASICO = [
  '/', '/index.html', '/estilo.css', '/manifest.webmanifest', '/icone.svg', '/icone-192.png', '/icone-512.png',
  '/vendor/three.module.min.js',
  '/js/main.js', '/js/graficos.js', '/js/mundo.js', '/js/blocos.js', '/js/jogador.js', '/js/controles.js',
  '/js/animais.js', '/js/modelos.js', '/js/som.js', '/js/rede.js', '/js/ruido.js', '/js/vilas.js', '/js/aldeoes.js', '/js/escavar.js', '/js/fisica.js', '/js/icones.js', '/js/comandos.js',
  '/js/opcoes-mundo.js', '/js/instintos.js', '/js/vida.js', '/js/energia.js', '/js/mapa.js', '/js/economia.js', '/js/mercado.js', '/js/receitas.js', '/js/ilha-aventura.js', '/js/mapa-ilha.js', '/js/gerador.js', '/js/gerador-worker.js', '/js/veiculos.js', '/js/garagem.js', '/js/lugares-veiculos.js', '/js/posefeitos.js', '/js/dono.js', '/js/armas.js', '/js/armas-dados.js', '/js/versao.js', '/js/visao.js', '/js/skin.js', '/js/personagem.js', '/js/editar-mundo.js', '/js/suave.js', '/js/arquivo-mundo.js', '/js/mecanismos.js', '/js/blocos-mecanismos.js', '/js/blocos-eras.js', '/js/chat.js', '/js/chat-filtro.js', '/js/voz.js', '/js/idade.js',
  '/js/casas.js', '/js/trabalho.js', '/js/negocios.js', '/js/moveis.js',
  '/js/formas.js', '/js/formas-defs.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return r;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || (req.mode === 'navigate' ? caches.match('/') : Response.error()))),
  );
});

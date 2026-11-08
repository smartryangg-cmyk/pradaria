// Deixa o jogo instalável e abrindo sem internet.
// Rede primeiro (para sempre pegar a versão nova); se não tiver internet, usa a cópia guardada.
const CACHE = 'pradaria-v17';
const BASICO = [
  '/', '/index.html', '/estilo.css', '/manifest.webmanifest', '/icone.svg', '/icone-192.png', '/icone-512.png',
  '/vendor/three.module.min.js',
  '/js/main.js', '/js/graficos.js', '/js/mundo.js', '/js/blocos.js', '/js/jogador.js', '/js/controles.js',
  '/js/animais.js', '/js/modelos.js', '/js/som.js', '/js/rede.js', '/js/ruido.js', '/js/vilas.js', '/js/aldeoes.js', '/js/escavar.js', '/js/fisica.js', '/js/icones.js', '/js/comandos.js',
  '/js/opcoes-mundo.js', '/js/monstros.js', '/js/vida.js', '/js/energia.js', '/js/mapa.js', '/js/economia.js', '/js/mercado.js', '/js/ilha-aventura.js', '/js/mapa-ilha.js',
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

// Service worker do Painel Semanal da Equipe.
// Estratégia: cache-first para os arquivos do app (funciona offline),
// com atualização em segundo plano quando houver rede.
// IMPORTANTE: ao publicar uma nova versão dos arquivos, mude o CACHE_NAME
// abaixo (ex.: v2, v3...) para que os navegadores baixem a versão nova.

const CACHE_NAME = 'painel-equipe-v3';

const ARQUIVOS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // addAll falha inteiro se um item falhar; guardamos um a um para
      // que uma falha de CDN não impeça a instalação do service worker
      Promise.all(ARQUIVOS.map(url =>
        cache.add(url).catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(
        nomes.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cacheado => {
      const rede = fetch(req).then(resp => {
        // guarda no cache apenas respostas válidas
        if (resp && (resp.status === 200 || resp.type === 'opaque')) {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copia)).catch(() => {});
        }
        return resp;
      }).catch(() => cacheado);

      return cacheado || rede;
    })
  );
});

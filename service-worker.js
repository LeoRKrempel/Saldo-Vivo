// Saldo Vivo — Service Worker
// Estratégia: cache-first com fallback para rede.
// Quando uma nova versão é detectada (CACHE_VERSION muda), o cache antigo é apagado.

const CACHE_VERSION = 'saldo-vivo-v2';
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

// Recursos externos que o app usa (fontes, ícones, Chart.js)
// — vão para o cache na primeira vez que são solicitados
const EXTERNAL_CACHE = 'saldo-vivo-external-v1';

// === INSTALL: cacheia os arquivos principais ===
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(CORE_FILES);
    }).then(() => self.skipWaiting())
  );
});

// === ACTIVATE: limpa caches antigos ===
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== EXTERNAL_CACHE)
          .map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// === FETCH: cache-first ===
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Só intercepta GET
  if (event.request.method !== 'GET') return;

  // Para a navegação principal (index.html) — vai para o cache, com fallback offline
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Para tudo o resto: cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      // Não está no cache — busca na rede e armazena
      return fetch(event.request).then((response) => {
        // Só cacheia respostas válidas
        if (!response || response.status !== 200) return response;

        // Recursos externos vão para um cache separado
        const isExternal = url.origin !== location.origin;
        const cacheName = isExternal ? EXTERNAL_CACHE : CACHE_VERSION;

        // Clone porque a response é stream e só pode ser usada uma vez
        const responseClone = response.clone();
        caches.open(cacheName).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return response;
      }).catch(() => {
        // Sem rede e sem cache — devolve resposta vazia para não quebrar
        return new Response('', { status: 503, statusText: 'Offline' });
      });
    })
  );
});

// Service Worker для PWA
const VERSION = 'v1.0.0'; 
const CACHE_NAME = 'avtoradio-pwa-' + VERSION;
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/hls.js',
  '/manifest.json',
  '/favicon.ico',
  '/assets/fonts/all.min.css',
  '/assets/fonts/fa-solid-900.woff2',
  '/assets/icon-72x72.png',
  '/assets/icon-96x96.png',
  '/assets/icon-128x128.png',
  '/assets/icon-144x144.png',
  '/assets/icon-152x152.png',
  '/assets/icon-192x192.png',
  '/assets/icon-384x384.png',
  '/assets/icon-512x512.png',
  '/assets/logo.png',
];

// Установка Service Worker и кэширование ресурсов
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const cachePromises = urlsToCache.map(async (urlToCache) => {
        try {
          return await cache.add(new Request(urlToCache, { cache: 'reload' }));
        } catch (err) {
          console.warn(`Не удалось закэшировать: ${urlToCache}`, err);
        }
      });
      return Promise.all(cachePromises);
    }).then(() => {
      // После успешного кэширования активируем новый SW сразу
      return self.skipWaiting();
    })
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Игнорируем запросы с недопустимыми схемами (например, chrome-extension://)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Игнорируем HLS-потоки, всегда запрашиваем их из сети
  if (url.pathname.endsWith('.m3u8') || url.pathname.endsWith('.ts') || url.pathname.endsWith('.aac')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(null, {
          status: 500,
          statusText: 'Нет соединения с потоком'
        });
      })
    );
    return;
  }

  // Для всего остального используем стратегию "сначала кэш, потом сеть"
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        // Обновляем кэш в фоне для статических ресурсов
        if (!url.pathname.endsWith('.m3u8') && !url.pathname.endsWith('.ts') && !url.pathname.endsWith('.aac')) {
          event.waitUntil(
            fetch(event.request).then((networkResponse) => {
              if (networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseClone);
                });
              }
            }).catch(error => {
              console.warn('Не удалось обновить кэш для', event.request.url, error);
            })
          );
        }
        return response;
      }
      return fetch(event.request).then((networkResponse) => {
        // Кэшируем ответ для будущих запросов (только для статических ресурсов)
        if (networkResponse.status === 200 &&
            !url.pathname.endsWith('.m3u8') &&
            !url.pathname.endsWith('.ts') &&
            !url.pathname.endsWith('.aac')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Если нет сетевого ответа, проверяем, может быть это критичный ресурс
        if (urlsToCache.includes(url.pathname)) {
          return caches.match('/');
        }
        return new Response('Вы оффлайн и запрошенный ресурс не найден в кэше.', {
          status: 404,
          statusText: 'Offline',
        });
      });
    })
  );
});

// Обработка сообщений от клиента
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Активация Service Worker и удаление старых кэшей
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        }),
      ).then(() => {
        console.log('Старые кэши удалены, активируем новый Service Worker');
        return clients.claim(); // Берем контроль над всеми клиентами
      });
    }),
  );
});

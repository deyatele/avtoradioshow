// Service Worker для PWA
const CACHE_NAME = 'avtoradio-pwa-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/hls.js',
  '/manifest.json',
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
          return await cache.add(urlToCache);
        } catch (err) {
          console.warn(`Не удалось закэшировать: ${urlToCache}`, err);
        }
      });
      return Promise.all(cachePromises);
    }),
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Игнорируем HLS-потоки, всегда запрашиваем их из сети
  if (url.pathname.endsWith('.m3u8') || url.pathname.endsWith('.ts') || url.pathname.endsWith('.aac')) {
    // Просто возвращаем оригинальный запрос без дополнительного fetch
    return;
  }

  // Для hls.js и шрифтов используем стратегию "сначала кэш, потом сеть"
  if (url.pathname.endsWith('hls.js') || url.pathname.includes('fonts/')) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Можно вернуть кастомную оффлайн-страницу, если нужно
          return new Response('Вы оффлайн и запрошенный ресурс не найден в кэше.', {
            status: 404,
            statusText: 'Offline',
          });
        });
      }),
    );
    return;
  }

  // Для всего остального используем стратегию "сначала кэш, потом сеть"
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).catch(() => {
        // Можно вернуть кастомную оффлайн-страницу, если нужно
        return new Response('Вы оффлайн и запрошенный ресурс не найден в кэше.', {
          status: 404,
          statusText: 'Offline',
        });
      });
    }),
  );
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
      );
    }),
  );
});

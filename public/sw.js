// Service Worker dla aplikacji psychologa
const STATIC_CACHE = 'static-v2';
const DYNAMIC_CACHE = 'dynamic-v2';

// Sprawdź czy jesteśmy w trybie deweloperskim
const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

// Zasoby do cache'owania
const STATIC_ASSETS = [
  '/',
  '/src/style.css',
  '/src/main.js',
  '/src/app.js',
  '/src/firebase-config.js',
  '/partials/_header.html',
  '/partials/_footer.html',
  '/src/photos/reflection.jpg',
  '/src/photos/praktyki.jpg',
  '/src/photos/rok1.jpg',
  '/src/photos/rok2.jpg',
  '/src/photos/rok3.jpg',
  '/src/photos/warsztaty.jpg'
];

// Zasoby Firebase do cache'owania
const FIREBASE_ASSETS = [
  'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js'
];

// Instalacja Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  // W trybie deweloperskim, nie cache'uj zasobów
  if (isDev) {
    console.log('Service Worker: Development mode - skipping cache');
    return self.skipWaiting();
  }
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Aktywacja Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
  );
});

// Interceptowanie żądań sieciowych
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Development: do nothing (pozwól na HMR)
  if (isDev) return;

  // Obsługujemy tylko GET (unikamy błędu POST -> cache.put & wielokrotnego respondWith)
  if (request.method !== 'GET') return;

  // STATYCZNE: cache-first
  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAsset(request));
    return; // ważne: nie wpada do kolejnych bloków
  }

  // API / Firebase: network-first
  if (isApiRequest(url) || isFirebaseRequest(url.href)) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  // Reszta: nie przechwytujemy
});

async function handleStaticAsset(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, clone).catch(()=>{});
      });
    }
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline - Spróbuj ponownie później', { status: 503 });
  }
}

async function handleApiRequest(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(DYNAMIC_CACHE).then(cache => {
        cache.put(request, clone).catch(()=>{});
      });
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Brak połączenia z internetem', { status: 503 });
  }
}

// Funkcje pomocnicze
function isStaticAsset(url) {
  const pathname = url.pathname;
  return STATIC_ASSETS.includes(pathname) ||
         pathname.startsWith('/src/') ||
         pathname.startsWith('/partials/') ||
         pathname.startsWith('/main/') ||
         /.(html|css|js|jpg|png|ico|svg)$/.test(pathname);
}

function isApiRequest(url) {
  const pathname = url.pathname;
  return pathname.startsWith('/api/') || pathname.startsWith('/functions/');
}

function isFirebaseRequest(url) {
  return FIREBASE_ASSETS.some(asset => url.includes(asset)) ||
         url.includes('firebase.googleapis.com') ||
         url.includes('firestore.googleapis.com');
}

// Obsługa wiadomości
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Synchronizacja w tle (dla przyszłych funkcji)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Tutaj można dodać logikę synchronizacji danych
  console.log('Service Worker: Background sync triggered');
}

const CACHE_NAME = 'kapulits-assets-v20260726-offline-pwa';

// App shell: sin esto la PWA no abre offline.
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './logo.svg'
];

// CDNs criticos (React/Babel/Tailwind/XLSX/jsPDF/supabase-js). Se precachean
// en install y se sirven cache-first con revalidacion en segundo plano
// (stale-while-revalidate) para que la app funcione sin red.
const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone@7.28.5/babel.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Respuestas opacas (no-cors) llegan con status 0 pero son validas para <script>.
function isCacheable(res) {
  return res && (res.ok || res.type === 'opaque');
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(APP_SHELL);
      // CDNs: no-cors para no fallar por CORS; si alguno falla (sin red en el
      // primer install) no bloquea la instalacion — se cachea al primer uso.
      await Promise.all(CDN_ASSETS.map(async url => {
        try {
          const res = await fetch(new Request(url, { mode: 'no-cors' }));
          if (isCacheable(res)) await cache.put(url, res);
        } catch (e) { /* se cachea en runtime */ }
      }));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase (datos vivos): NUNCA cachear. Va directo a red.
  if (url.hostname.endsWith('.supabase.co')) return;

  const sameOrigin = url.origin === self.location.origin;

  // 1) Navegacion / index.html: red-primero con fallback a cache.
  //    Asi siempre se sirve la version mas nueva con red, y offline abre igual.
  const isNavigation = req.mode === 'navigate' ||
    (sameOrigin && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/')));
  if (isNavigation) {
    event.respondWith(
      fetch(req).then(res => {
        if (isCacheable(res)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put('./index.html', clone));
        }
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 2) CDNs / recursos cross-origin: stale-while-revalidate.
  //    Sirve cache al instante (offline OK) y actualiza en segundo plano.
  if (!sameOrigin) {
    event.respondWith(
      caches.match(req.url).then(cached => {
        const update = fetch(new Request(req.url, { mode: req.mode === 'cors' ? 'cors' : 'no-cors' }))
          .then(res => {
            if (isCacheable(res)) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(req.url, clone));
            }
            return res;
          })
          .catch(() => null);
        return cached || update.then(res => res || Response.error());
      })
    );
    return;
  }

  // 3) Estaticos locales (iconos, manifest, logo): cache-first.
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (isCacheable(res)) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

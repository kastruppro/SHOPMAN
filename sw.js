// SHOPMAN Service Worker - Offline First PWA
const CACHE_VERSION = 'v0.4.2';
const STATIC_CACHE = `shopman-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `shopman-dynamic-${CACHE_VERSION}`;

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/api.js',
  '/js/config.js',
  '/js/router.js',
  '/js/store.js',
  '/js/i18n.js',
  '/js/db.js',
  '/js/sync.js',
  '/js/components/homepage.js',
  '/js/components/listpage.js',
  '/js/components/passwordmodal.js',
  '/js/pwa-install.js',
  '/locales/da.json',
  '/locales/en.json',
  '/icons/icon-72.png',
  '/icons/icon-120.png',
  '/icons/icon-152.png',
  '/icons/icon-167.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json'
];

// API URL pattern
const API_URL = 'https://wekhpejczeqdjxididog.supabase.co';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache static assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('shopman-') && name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle API requests differently
  if (url.origin === API_URL || request.url.includes('/functions/v1/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static assets - cache first
  event.respondWith(cacheFirstStrategy(request));
});

// Cache-first strategy for static assets
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Return cached version and update cache in background
    updateCache(request);
    return cachedResponse;
  }

  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, return offline page if it's a navigation request
    if (request.mode === 'navigate') {
      return caches.match('/index.html');
    }
    throw error;
  }
}

// Network-first strategy for API requests
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful GET responses
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      console.log('[SW] Serving API from cache:', request.url);
      return cachedResponse;
    }

    // Return error response
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Du er offline. Ændringer gemmes lokalt.' }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Update cache in background
async function updateCache(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Silently fail - we already served from cache
  }
}

// Background sync for offline changes
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'shopman-sync') {
    event.waitUntil(syncPendingChanges());
  }
});

// Sync pending changes to server
async function syncPendingChanges() {
  // This will be called when the app comes back online
  // The actual sync logic is in the main app (sync.js)
  // Here we just notify all clients to sync
  const clients = await self.clients.matchAll();

  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_REQUIRED',
      timestamp: Date.now()
    });
  });
}

// Listen for messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

// Push notification support
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
    return;
  }

  // Handle nested data structure from our API
  const notificationData = data.data || data;
  const url = notificationData.url || (notificationData.listName ? `/#list/${encodeURIComponent(notificationData.listName)}` : '/');

  const options = {
    body: data.body || 'Ny opdatering til din indkøbsliste',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    tag: notificationData.listId || 'shopman-notification',
    renotify: true,
    data: {
      url: url,
      listId: notificationData.listId,
      listName: notificationData.listName
    },
    actions: [
      { action: 'open', title: 'Åbn' },
      { action: 'close', title: 'Luk' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SHOPMAN', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to find an existing window with the app open
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        // If we find the app, navigate to the specific list
        if (clientUrl.origin === self.location.origin) {
          // Navigate to the list URL
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // No existing window, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

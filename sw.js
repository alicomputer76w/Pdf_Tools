/**
 * Service Worker for PDF Tools Suite
 * Provides offline functionality and caching
 */

const CACHE_NAME = 'pdf-tools-suite-v1.2.0';
const STATIC_CACHE = 'pdf-tools-static-v1.2.0';

// Files to cache for offline functionality
const STATIC_FILES = [
    './',
    './index.html',
    './about.html',
    './policy.html',
    './css/styles.css',
    './css/components.css',
    './js/app.js?v=3',
    './js/utils.js?v=4',
    './js/components.js?v=3',
    './js/tools.js?v=14',
    './js/pdf-to-word.js?v=1',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Caching static files...');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Static files cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Failed to cache static files:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve cached files when offline
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension requests
    if (event.request.url.startsWith('chrome-extension://')) {
        return;
    }

    const request = event.request;
    const isHTML = request.destination === 'document' || (request.headers.get('accept') || '').includes('text/html');

    event.respondWith((async () => {
        if (isHTML) {
            // Network-first for HTML to ensure updates are visible
            try {
                const networkResponse = await fetch(request);
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, networkResponse.clone());
                return networkResponse;
            } catch (err) {
                const cached = await caches.match('./index.html');
                return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
            }
        } else {
            // Cache-first for static assets
            const cached = await caches.match(request);
            if (cached) return cached;
            try {
                const networkResponse = await fetch(request);
                // Only cache successful same-origin responses
                if (networkResponse && networkResponse.status === 200) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(request, networkResponse.clone());
                }
                return networkResponse;
            } catch (err) {
                return new Response('Resource unavailable', { status: 503 });
            }
        }
    })());
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Background sync for analytics (if supported)
self.addEventListener('sync', (event) => {
    if (event.tag === 'analytics-sync') {
        event.waitUntil(syncAnalytics());
    }
});

async function syncAnalytics() {
    try {
        // Get stored analytics events
        const cache = await caches.open(CACHE_NAME);
        const analyticsData = await cache.match('/analytics-data');
        
        if (analyticsData) {
            const events = await analyticsData.json();
            
            // In a real application, you would send these to your analytics service
            console.log('Syncing analytics data:', events);
            
            // Clear the stored data after successful sync
            await cache.delete('/analytics-data');
        }
    } catch (error) {
        console.error('Failed to sync analytics:', error);
    }
}

// Push notification handling (for future use)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/badge-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: data.primaryKey
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Open App',
                    icon: '/icon-192x192.png'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: '/icon-192x192.png'
                }
            ]
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Error handling
self.addEventListener('error', (event) => {
    console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Service Worker unhandled rejection:', event.reason);
});

console.log('Service Worker loaded successfully');
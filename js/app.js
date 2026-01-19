// Main application entry point
import i18n from './i18n.js';
import router from './router.js';
import store from './store.js';
import sync from './sync.js';
import { renderHomepage } from './components/homepage.js';
import { renderListPage } from './components/listpage.js';

// Register service worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });
            console.log('[App] Service worker registered:', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                console.log('[App] New service worker installing...');

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available
                        console.log('[App] New version available');
                        // Could show update notification here
                    }
                });
            });
        } catch (error) {
            console.error('[App] Service worker registration failed:', error);
        }
    }
}

async function initApp() {
    // Initialize i18n
    await i18n.init();

    // Initialize sync module (handles offline/online detection)
    await sync.init();

    // Subscribe to sync state changes
    sync.subscribe((syncState) => {
        store.setSyncState(syncState);
    });

    // Register routes
    router.register('/', () => {
        store.reset();
        renderHomepage();
    });

    router.register('/list', (listName) => {
        renderListPage(listName);
    });

    // Initialize router (handles current route)
    router.init();

    // Register service worker
    registerServiceWorker();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

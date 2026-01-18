// Main application entry point
import i18n from './i18n.js';
import router from './router.js';
import store from './store.js';
import { renderHomepage } from './components/homepage.js';
import { renderListPage } from './components/listpage.js';

async function initApp() {
    // Initialize i18n
    await i18n.init();

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
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

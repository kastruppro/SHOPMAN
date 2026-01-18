// Hash-based router for GitHub Pages compatibility
const router = {
    routes: {},
    currentRoute: null,

    init() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());
        // Handle initial route
        this.handleRoute();
    },

    register(path, handler) {
        this.routes[path] = handler;
    },

    handleRoute() {
        const hash = window.location.hash.slice(1) || '/'; // Remove # prefix

        // Check for exact match first
        if (this.routes[hash]) {
            this.currentRoute = hash;
            this.routes[hash]();
            return;
        }

        // Check for list route (/#/[name])
        if (hash.startsWith('/') && hash.length > 1) {
            const listName = hash.slice(1); // Remove leading /
            if (this.routes['/list']) {
                this.currentRoute = '/list';
                this.routes['/list'](listName);
                return;
            }
        }

        // Default to home
        if (this.routes['/']) {
            this.currentRoute = '/';
            this.routes['/']();
        }
    },

    navigate(path) {
        window.location.hash = path;
    },

    navigateToList(listName) {
        // URL encode the list name for safety
        const encoded = encodeURIComponent(listName.toLowerCase().trim());
        this.navigate(`/${encoded}`);
    },

    getListNameFromHash() {
        const hash = window.location.hash.slice(1);
        if (hash.startsWith('/') && hash.length > 1) {
            return decodeURIComponent(hash.slice(1));
        }
        return null;
    },

    goHome() {
        this.navigate('/');
    }
};

export default router;

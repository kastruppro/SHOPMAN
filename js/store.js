// Simple state management with offline support
const store = {
    state: {
        currentList: null,
        items: [],
        isLoading: false,
        error: null,
        accessToken: null, // Session token for password-protected lists
        // Offline/sync state
        isOnline: navigator.onLine,
        isSyncing: false,
        pendingCount: 0,
    },

    listeners: new Set(),

    getState() {
        return this.state;
    },

    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.notify();
    },

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    },

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    },

    // List-specific state management
    setCurrentList(list) {
        this.setState({ currentList: list, error: null });
    },

    setItems(items) {
        this.setState({ items: items || [] });
    },

    addItem(item) {
        this.setState({ items: [...this.state.items, item] });
    },

    updateItem(itemId, updates) {
        const items = this.state.items.map(item =>
            item.id === itemId ? { ...item, ...updates } : item
        );
        this.setState({ items });
    },

    removeItem(itemId) {
        const items = this.state.items.filter(item => item.id !== itemId);
        this.setState({ items });
    },

    setLoading(isLoading) {
        this.setState({ isLoading });
    },

    setError(error) {
        this.setState({ error, isLoading: false });
    },

    clearError() {
        this.setState({ error: null });
    },

    // Session token management
    setAccessToken(listName, token) {
        this.state.accessToken = token;
        sessionStorage.setItem(`shopman-token-${listName}`, token);
    },

    getAccessToken(listName) {
        if (this.state.accessToken) return this.state.accessToken;
        return sessionStorage.getItem(`shopman-token-${listName}`);
    },

    clearAccessToken(listName) {
        this.state.accessToken = null;
        sessionStorage.removeItem(`shopman-token-${listName}`);
    },

    reset() {
        this.setState({
            currentList: null,
            items: [],
            isLoading: false,
            error: null,
            accessToken: null,
        });
    },

    // Sync state management
    setSyncState({ isOnline, isSyncing, pendingCount }) {
        this.setState({
            isOnline: isOnline !== undefined ? isOnline : this.state.isOnline,
            isSyncing: isSyncing !== undefined ? isSyncing : this.state.isSyncing,
            pendingCount: pendingCount !== undefined ? pendingCount : this.state.pendingCount,
        });
    },

    setOnline(isOnline) {
        this.setState({ isOnline });
    },

    setSyncing(isSyncing) {
        this.setState({ isSyncing });
    },

    setPendingCount(count) {
        this.setState({ pendingCount: count });
    }
};

export default store;

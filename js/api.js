// Supabase API module
const SUPABASE_URL = 'https://wekhpejczeqdjxididog.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indla2hwZWpjemVxZGp4aWRpZG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NzI1MjEsImV4cCI6MjA4NDM0ODUyMX0.eafOdpk0xa223Nca7SLmK8EZQGoEHVxpCq6gZjxWIaY';

const api = {
    baseUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,

    // Helper for making requests
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            'apikey': this.anonKey,
            'Authorization': `Bearer ${this.anonKey}`,
            ...options.headers,
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || error.error || `HTTP ${response.status}`);
            }

            return response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Edge Function calls
    async callFunction(functionName, body) {
        return this.request(`/functions/v1/${functionName}`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    // List operations
    async createList({ name, password, viewRequiresPassword, editRequiresPassword }) {
        return this.callFunction('create-list', {
            name,
            password: password || null,
            view_requires_password: viewRequiresPassword,
            edit_requires_password: editRequiresPassword,
        });
    },

    async getList(name) {
        // Direct database query for list metadata (no password hash returned)
        const nameLower = name.toLowerCase();
        return this.request(
            `/rest/v1/lists?name_lowercase=eq.${encodeURIComponent(nameLower)}&select=id,name,view_requires_password,edit_requires_password,created_at`
        );
    },

    async verifyPassword(listId, password, action = 'view') {
        return this.callFunction('verify-password', {
            list_id: listId,
            password,
            action, // 'view' or 'edit'
        });
    },

    // Item operations (through edge function for password verification)
    async getItems(listId, token = null) {
        const headers = {};
        if (token) {
            headers['X-Access-Token'] = token;
        }

        return this.request(
            `/rest/v1/items?list_id=eq.${listId}&order=created_at.asc&select=*`,
            { headers }
        );
    },

    async addItem(listId, item, token = null) {
        return this.callFunction('manage-items', {
            action: 'add',
            list_id: listId,
            item,
            token,
        });
    },

    async updateItem(itemId, updates, token = null) {
        return this.callFunction('manage-items', {
            action: 'update',
            item_id: itemId,
            updates,
            token,
        });
    },

    async toggleItemBought(itemId, isBought, token = null) {
        return this.callFunction('manage-items', {
            action: 'update',
            item_id: itemId,
            updates: { is_bought: isBought },
            token,
        });
    },

    async deleteItem(itemId, token = null) {
        return this.callFunction('manage-items', {
            action: 'delete',
            item_id: itemId,
            token,
        });
    },

    // Check if list name exists
    async listExists(name) {
        const lists = await this.getList(name);
        return lists && lists.length > 0;
    }
};

export default api;

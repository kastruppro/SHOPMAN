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
        // Direct database query for list metadata
        const nameLower = name.toLowerCase();
        const lists = await this.request(
            `/rest/v1/lists?name_lowercase=eq.${encodeURIComponent(nameLower)}&select=id,name,password_hash,view_requires_password,edit_requires_password,created_at`
        );
        // Add has_password flag (password_hash is not null)
        return lists.map(list => ({
            ...list,
            has_password: list.password_hash !== null,
            password_hash: undefined // Don't expose the actual hash
        }));
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
    },

    // List management
    async updatePassword(listId, currentPassword, newPassword, viewRequiresPassword, editRequiresPassword) {
        return this.callFunction('manage-list', {
            action: 'update_password',
            list_id: listId,
            current_password: currentPassword || null,
            new_password: newPassword,
            view_requires_password: viewRequiresPassword,
            edit_requires_password: editRequiresPassword,
        });
    },

    async deleteList(listId, password) {
        return this.callFunction('manage-list', {
            action: 'delete',
            list_id: listId,
            password: password || null,
        });
    },

    // Check if list has a password
    async listHasPassword(listId) {
        // We check by looking at the password requirements
        // If either view or edit requires password, then list has password
        const lists = await this.request(
            `/rest/v1/lists?id=eq.${listId}&select=view_requires_password,edit_requires_password`
        );
        if (lists && lists.length > 0) {
            return lists[0].view_requires_password || lists[0].edit_requires_password;
        }
        return false;
    },

    // Push notification subscriptions
    async savePushSubscription(listId, subscription) {
        return this.callFunction('push-subscriptions', {
            action: 'subscribe',
            list_id: listId,
            subscription
        });
    },

    async deletePushSubscription(listId) {
        return this.callFunction('push-subscriptions', {
            action: 'unsubscribe',
            list_id: listId
        });
    }
};

export default api;

// Sync module - handles offline/online synchronization
import db from './db.js';
import api from './api.js';
import store from './store.js';

// Sync status
const syncState = {
  isOnline: navigator.onLine,
  isSyncing: false,
  lastSyncTime: null,
  pendingCount: 0,
  listeners: new Set()
};

// Notify listeners of sync state changes
function notifySyncListeners() {
  syncState.listeners.forEach(listener => listener({ ...syncState }));
}

// Sync module
const sync = {
  // Subscribe to sync state changes
  subscribe(listener) {
    syncState.listeners.add(listener);
    // Immediately call with current state
    listener({ ...syncState });
    return () => syncState.listeners.delete(listener);
  },

  // Get current sync state
  getState() {
    return { ...syncState };
  },

  // Initialize sync module
  async init() {
    await db.init();

    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // Listen for service worker sync messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_REQUIRED') {
          this.syncAll();
        }
      });
    }

    // Update pending count
    await this.updatePendingCount();

    // If online, sync immediately
    if (navigator.onLine) {
      this.syncAll();
    }

    console.log('[Sync] Initialized, online:', navigator.onLine);
  },

  // Handle coming online
  async handleOnline() {
    console.log('[Sync] Back online');
    syncState.isOnline = true;
    notifySyncListeners();

    // Sync pending changes
    await this.syncAll();
  },

  // Handle going offline
  handleOffline() {
    console.log('[Sync] Gone offline');
    syncState.isOnline = false;
    notifySyncListeners();
  },

  // Update pending count
  async updatePendingCount() {
    const queue = await db.getSyncQueue();
    syncState.pendingCount = queue.length;
    notifySyncListeners();
  },

  // Check if online
  isOnline() {
    return syncState.isOnline && navigator.onLine;
  },

  // Queue an operation for sync
  async queueOperation(type, data) {
    const operation = {
      type,
      data,
      timestamp: Date.now()
    };

    await db.addToSyncQueue(operation);
    await this.updatePendingCount();

    // Try to sync immediately if online
    if (this.isOnline() && !syncState.isSyncing) {
      this.syncAll();
    }

    // Request background sync if available
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const registration = await navigator.serviceWorker.ready;
      try {
        await registration.sync.register('shopman-sync');
      } catch (error) {
        console.log('[Sync] Background sync not available:', error);
      }
    }

    return operation;
  },

  // Sync all pending operations
  async syncAll() {
    if (syncState.isSyncing || !this.isOnline()) {
      return;
    }

    syncState.isSyncing = true;
    notifySyncListeners();

    console.log('[Sync] Starting sync...');

    try {
      const queue = await db.getSyncQueue();
      console.log('[Sync] Processing', queue.length, 'pending operations');

      for (const operation of queue) {
        try {
          await this.processOperation(operation);
          await db.removeSyncQueueItem(operation.id);
        } catch (error) {
          console.error('[Sync] Failed to process operation:', operation, error);

          // Update retry count
          const retries = (operation.retries || 0) + 1;
          if (retries >= 3) {
            // Max retries reached, mark as failed
            console.error('[Sync] Max retries reached, removing operation:', operation);
            await db.removeSyncQueueItem(operation.id);

            // Mark item as error if it exists
            if (operation.data?.itemId || operation.data?.id) {
              const itemId = operation.data.itemId || operation.data.id;
              const item = await db.getItem(itemId);
              if (item) {
                item.syncStatus = 'error';
                await db.saveItem(item);
              }
            }
          } else {
            // Update retry count
            await db.updateSyncQueueItem(operation.id, { retries });
          }
        }
      }

      syncState.lastSyncTime = Date.now();
      await this.updatePendingCount();
      console.log('[Sync] Sync complete');
    } catch (error) {
      console.error('[Sync] Sync failed:', error);
    } finally {
      syncState.isSyncing = false;
      notifySyncListeners();
    }
  },

  // Process a single sync operation
  async processOperation(operation) {
    const { type, data } = operation;
    const listName = store.getState().currentList?.name;
    const token = listName ? store.getAccessToken(listName) : null;

    switch (type) {
      case 'ADD_ITEM': {
        const result = await api.addItem(data.listId, data.item, token);

        // Update local item with server ID
        if (db.isTempId(data.item.id)) {
          await db.deleteItem(data.item.id);
        }
        await db.saveItem({ ...result, syncStatus: 'synced' });

        // Update store if this is the current list
        if (store.getState().currentList?.id === data.listId) {
          store.updateItem(data.item.id, { ...result, syncStatus: 'synced' });
        }
        break;
      }

      case 'UPDATE_ITEM': {
        await api.updateItem(data.itemId, data.updates, token);
        await db.markItemSynced(data.itemId);

        // Update store
        const item = await db.getItem(data.itemId);
        if (item) {
          store.updateItem(data.itemId, { ...item, syncStatus: 'synced' });
        }
        break;
      }

      case 'TOGGLE_ITEM': {
        await api.toggleItemBought(data.itemId, data.isBought, token);
        await db.markItemSynced(data.itemId);

        // Update store
        store.updateItem(data.itemId, { is_bought: data.isBought, syncStatus: 'synced' });
        break;
      }

      case 'DELETE_ITEM': {
        await api.deleteItem(data.itemId, token);
        // Item already deleted locally
        break;
      }

      default:
        console.warn('[Sync] Unknown operation type:', type);
    }
  },

  // Sync items for a specific list
  async syncListItems(listId, token = null) {
    if (!this.isOnline()) {
      // Return cached items
      return db.getItemsByList(listId);
    }

    try {
      // Fetch from server
      const serverItems = await api.getItems(listId, token);

      // Get local items
      const localItems = await db.getItemsByList(listId);
      const localPending = localItems.filter(item => item.syncStatus === 'pending');

      // Save server items to local DB
      for (const item of serverItems) {
        // Don't overwrite pending local changes
        const pendingItem = localPending.find(p => p.id === item.id);
        if (!pendingItem) {
          await db.saveItem({ ...item, syncStatus: 'synced' });
        }
      }

      // Return merged items (server + pending local)
      const mergedItems = [...serverItems];

      // Add pending items that don't exist on server
      for (const pending of localPending) {
        if (db.isTempId(pending.id)) {
          mergedItems.push(pending);
        }
      }

      return mergedItems;
    } catch (error) {
      console.error('[Sync] Failed to sync list items:', error);
      // Return cached items on error
      return db.getItemsByList(listId);
    }
  },

  // Save list to local DB
  async saveList(list) {
    await db.saveList(list);
  },

  // Get list from local DB
  async getLocalList(name) {
    return db.getListByName(name);
  }
};

export default sync;

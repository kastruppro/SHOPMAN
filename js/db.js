// IndexedDB module for offline data storage
const DB_NAME = 'shopman-db';
const DB_VERSION = 1;

// Store names
const STORES = {
  LISTS: 'lists',
  ITEMS: 'items',
  SYNC_QUEUE: 'syncQueue'
};

let dbInstance = null;

// Initialize the database
async function initDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[DB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[DB] Database opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('[DB] Upgrading database...');

      // Lists store
      if (!db.objectStoreNames.contains(STORES.LISTS)) {
        const listsStore = db.createObjectStore(STORES.LISTS, { keyPath: 'id' });
        listsStore.createIndex('name', 'name_lowercase', { unique: true });
        listsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Items store
      if (!db.objectStoreNames.contains(STORES.ITEMS)) {
        const itemsStore = db.createObjectStore(STORES.ITEMS, { keyPath: 'id' });
        itemsStore.createIndex('listId', 'list_id', { unique: false });
        itemsStore.createIndex('syncStatus', 'syncStatus', { unique: false });
      }

      // Sync queue store for pending operations
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        syncStore.createIndex('type', 'type', { unique: false });
      }

      console.log('[DB] Database upgrade complete');
    };
  });
}

// Generic database operations
async function getStore(storeName, mode = 'readonly') {
  const db = await initDB();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

async function dbGet(storeName, key) {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetAll(storeName) {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbGetByIndex(storeName, indexName, value) {
  const store = await getStore(storeName);
  const index = store.index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(storeName, data) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbDelete(storeName, key) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function dbClear(storeName) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// List operations
const db = {
  async init() {
    await initDB();
  },

  // Lists
  async getList(listId) {
    return dbGet(STORES.LISTS, listId);
  },

  async getListByName(name) {
    const lists = await dbGetByIndex(STORES.LISTS, 'name', name.toLowerCase());
    return lists[0] || null;
  },

  async saveList(list) {
    const data = {
      ...list,
      name_lowercase: list.name.toLowerCase(),
      syncStatus: list.syncStatus || 'synced',
      lastModified: Date.now()
    };
    await dbPut(STORES.LISTS, data);
    return data;
  },

  async deleteList(listId) {
    // Delete all items for this list first
    const items = await this.getItemsByList(listId);
    for (const item of items) {
      await dbDelete(STORES.ITEMS, item.id);
    }
    await dbDelete(STORES.LISTS, listId);
  },

  async getAllLists() {
    return dbGetAll(STORES.LISTS);
  },

  // Items
  async getItem(itemId) {
    return dbGet(STORES.ITEMS, itemId);
  },

  async getItemsByList(listId) {
    return dbGetByIndex(STORES.ITEMS, 'listId', listId);
  },

  async saveItem(item) {
    const data = {
      ...item,
      syncStatus: item.syncStatus || 'synced',
      lastModified: Date.now()
    };
    await dbPut(STORES.ITEMS, data);
    return data;
  },

  async saveItems(items) {
    for (const item of items) {
      await this.saveItem(item);
    }
  },

  async deleteItem(itemId) {
    await dbDelete(STORES.ITEMS, itemId);
  },

  async deleteItemsByList(listId) {
    const items = await this.getItemsByList(listId);
    for (const item of items) {
      await dbDelete(STORES.ITEMS, item.id);
    }
  },

  // Sync Queue operations
  async addToSyncQueue(operation) {
    const data = {
      ...operation,
      timestamp: Date.now(),
      retries: 0
    };
    await dbPut(STORES.SYNC_QUEUE, data);
    return data;
  },

  async getSyncQueue() {
    const items = await dbGetAll(STORES.SYNC_QUEUE);
    // Sort by timestamp
    return items.sort((a, b) => a.timestamp - b.timestamp);
  },

  async removeSyncQueueItem(id) {
    await dbDelete(STORES.SYNC_QUEUE, id);
  },

  async clearSyncQueue() {
    await dbClear(STORES.SYNC_QUEUE);
  },

  async updateSyncQueueItem(id, updates) {
    const item = await dbGet(STORES.SYNC_QUEUE, id);
    if (item) {
      await dbPut(STORES.SYNC_QUEUE, { ...item, ...updates });
    }
  },

  // Get pending items (not yet synced)
  async getPendingItems() {
    return dbGetByIndex(STORES.ITEMS, 'syncStatus', 'pending');
  },

  // Get all items with sync errors
  async getFailedItems() {
    return dbGetByIndex(STORES.ITEMS, 'syncStatus', 'error');
  },

  // Mark item as synced
  async markItemSynced(itemId, serverId = null) {
    const item = await this.getItem(itemId);
    if (item) {
      item.syncStatus = 'synced';
      if (serverId && item.id !== serverId) {
        // Update local ID to match server ID
        await dbDelete(STORES.ITEMS, item.id);
        item.id = serverId;
      }
      await dbPut(STORES.ITEMS, item);
    }
  },

  // Generate temporary offline ID
  generateTempId() {
    return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Check if ID is temporary
  isTempId(id) {
    return id && id.toString().startsWith('temp_');
  },

  // ===== Following lists =====

  // Follow a list (enables offline access)
  async followList(listId, options = {}) {
    const list = await this.getList(listId);
    if (list) {
      list.isFollowed = true;
      list.notificationsEnabled = options.notifications || false;
      list.followedAt = Date.now();
      await dbPut(STORES.LISTS, list);
      return list;
    }
    return null;
  },

  // Unfollow a list
  async unfollowList(listId) {
    const list = await this.getList(listId);
    if (list) {
      list.isFollowed = false;
      list.notificationsEnabled = false;
      list.savedPassword = null; // Clear saved password
      await dbPut(STORES.LISTS, list);

      // Optionally delete cached items
      await this.deleteItemsByList(listId);
    }
  },

  // Get all followed lists
  async getFollowedLists() {
    const allLists = await this.getAllLists();
    return allLists.filter(list => list.isFollowed === true);
  },

  // Check if a list is followed
  async isListFollowed(listId) {
    const list = await this.getList(listId);
    return list?.isFollowed === true;
  },

  // Toggle notifications for a list
  async setListNotifications(listId, enabled) {
    const list = await this.getList(listId);
    if (list) {
      list.notificationsEnabled = enabled;
      await dbPut(STORES.LISTS, list);
      return list;
    }
    return null;
  },

  // ===== Password management =====

  // Save password for a list (encrypted in real app, here just base64 for demo)
  async savePassword(listId, password) {
    const list = await this.getList(listId);
    if (list) {
      // Note: In production, use proper encryption
      list.savedPassword = btoa(password);
      await dbPut(STORES.LISTS, list);
    }
  },

  // Get saved password for a list
  async getSavedPassword(listId) {
    const list = await this.getList(listId);
    if (list?.savedPassword) {
      try {
        return atob(list.savedPassword);
      } catch {
        return null;
      }
    }
    return null;
  },

  // Clear saved password for a list
  async clearSavedPassword(listId) {
    const list = await this.getList(listId);
    if (list) {
      list.savedPassword = null;
      await dbPut(STORES.LISTS, list);
    }
  },

  // ===== Push subscription =====

  // Save push subscription for a list
  async savePushSubscription(listId, subscription) {
    const list = await this.getList(listId);
    if (list) {
      list.pushSubscription = subscription;
      await dbPut(STORES.LISTS, list);
    }
  },

  // Get push subscription for a list
  async getPushSubscription(listId) {
    const list = await this.getList(listId);
    return list?.pushSubscription || null;
  }
};

export default db;

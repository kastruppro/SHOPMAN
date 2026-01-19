import i18n from '../i18n.js';
import router from '../router.js';
import api from '../api.js';
import store from '../store.js';
import sync from '../sync.js';
import db from '../db.js';
import { showPasswordModal } from './passwordmodal.js';

let currentListName = null;
let currentUndoData = null;
let undoTimeout = null;

export async function renderListPage(listName) {
    currentListName = listName;
    const app = document.getElementById('app');

    // Show loading state
    app.innerHTML = `
        <div class="flex items-center justify-center py-12">
            <div class="text-center">
                <svg class="w-8 h-8 text-green-500 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-gray-600" data-i18n="loadingList">Loading list...</p>
            </div>
        </div>
    `;
    i18n.updateDOM();

    try {
        let list = null;
        let items = [];

        // Try to fetch from server, fallback to local cache
        if (sync.isOnline()) {
            try {
                const lists = await api.getList(listName);

                if (!lists || lists.length === 0) {
                    // Check local cache
                    list = await sync.getLocalList(listName);
                    if (!list) {
                        showError(i18n.t('listNotFound'));
                        return;
                    }
                } else {
                    list = lists[0];
                    // Save to local cache
                    await sync.saveList(list);
                }
            } catch (error) {
                console.error('Error fetching list from server:', error);
                // Try local cache
                list = await sync.getLocalList(listName);
                if (!list) {
                    showError(i18n.t('connectionError'));
                    return;
                }
            }
        } else {
            // Offline - use local cache
            list = await sync.getLocalList(listName);
            if (!list) {
                showError(i18n.t('listNotFoundOffline'));
                return;
            }
        }

        store.setCurrentList(list);

        // Check if password is required for viewing
        if (list.view_requires_password) {
            const token = store.getAccessToken(listName);
            if (!token) {
                // Show password modal
                const verified = await showPasswordModal(list.id, 'view');
                if (!verified) {
                    router.goHome();
                    return;
                }
            }
        }

        // Load items (uses sync module which handles offline/online)
        const token = store.getAccessToken(listName);
        items = await sync.syncListItems(list.id, token);
        store.setItems(items);

        // Render the list UI
        renderListUI(list);

        // Subscribe to sync state changes to update UI
        sync.subscribe((syncState) => {
            updateSyncStatusUI(syncState);
        });
    } catch (error) {
        console.error('Error loading list:', error);
        showError(error.message || i18n.t('connectionError'));
    }
}

function showError(message) {
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="text-center py-12">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
            </div>
            <p class="text-gray-800 font-medium mb-2" data-i18n="error">Error</p>
            <p class="text-gray-600 mb-4">${message}</p>
            <button
                onclick="window.location.hash = '/'"
                class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                data-i18n="back"
            >Back</button>
        </div>
    `;
    i18n.updateDOM();
}

// Update sync status UI
function updateSyncStatusUI(syncState) {
    const statusBar = document.getElementById('sync-status');
    if (!statusBar) return;

    if (!syncState.isOnline) {
        statusBar.innerHTML = `
            <div class="flex items-center gap-2 text-orange-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-7.072 7.072a4 4 0 010-5.656m-3.536 3.536a9 9 0 010-12.728"></path>
                </svg>
                <span data-i18n="offline">${i18n.t('offline')}</span>
            </div>
        `;
        statusBar.className = 'px-3 py-2 bg-orange-50 border-b border-orange-200 text-sm';
    } else if (syncState.isSyncing) {
        statusBar.innerHTML = `
            <div class="flex items-center gap-2 text-blue-600">
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span data-i18n="syncing">${i18n.t('syncing')}</span>
            </div>
        `;
        statusBar.className = 'px-3 py-2 bg-blue-50 border-b border-blue-200 text-sm';
    } else if (syncState.pendingCount > 0) {
        statusBar.innerHTML = `
            <div class="flex items-center gap-2 text-yellow-600">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>${syncState.pendingCount} ${i18n.t('pendingChanges')}</span>
            </div>
        `;
        statusBar.className = 'px-3 py-2 bg-yellow-50 border-b border-yellow-200 text-sm';
    } else {
        statusBar.innerHTML = '';
        statusBar.className = 'hidden';
    }
}

function renderListUI(list) {
    const app = document.getElementById('app');
    const state = store.getState();
    const items = state.items || [];
    const syncState = sync.getState();

    const unboughtItems = items.filter(item => !item.is_bought);
    const boughtItems = items.filter(item => item.is_bought);

    app.innerHTML = `
        <!-- Sync Status Bar -->
        <div id="sync-status" class="${!syncState.isOnline ? 'px-3 py-2 bg-orange-50 border-b border-orange-200 text-sm' : 'hidden'}">
            ${!syncState.isOnline ? `
                <div class="flex items-center gap-2 text-orange-600">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656m-7.072 7.072a4 4 0 010-5.656m-3.536 3.536a9 9 0 010-12.728"></path>
                    </svg>
                    <span data-i18n="offline">${i18n.t('offline')}</span>
                </div>
            ` : ''}
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
            <button
                id="back-btn"
                class="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
                </svg>
                <span data-i18n="back">Back</span>
            </button>

            <div class="relative">
                <button id="lang-dropdown-btn" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition">
                    <span class="text-base">${i18n.currentLang === 'da' ? '🇩🇰' : '🇬🇧'}</span>
                    <span>${i18n.currentLang === 'da' ? 'Dansk' : 'English'}</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
                <div id="lang-dropdown" class="hidden absolute right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-10">
                    <button class="lang-option w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${i18n.currentLang === 'da' ? 'bg-green-50 text-green-700' : ''}" data-lang="da">
                        <span class="text-base">🇩🇰</span> Dansk
                    </button>
                    <button class="lang-option w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${i18n.currentLang === 'en' ? 'bg-green-50 text-green-700' : ''}" data-lang="en">
                        <span class="text-base">🇬🇧</span> English
                    </button>
                </div>
            </div>
        </div>

        <!-- List Title -->
        <div class="text-center mb-6">
            <h1 class="text-2xl font-bold text-gray-800">${escapeHtml(list.name)}</h1>
        </div>

        <!-- Add Item Form -->
        <div class="bg-white rounded-xl shadow-lg p-4 mb-6">
            <form id="add-item-form" class="space-y-3">
                <div class="flex gap-2">
                    <input
                        type="text"
                        id="item-name"
                        class="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        data-i18n-placeholder="itemName"
                        placeholder="Item name (required)"
                        required
                    >
                    <button
                        type="submit"
                        class="px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium text-xl"
                    >+</button>
                </div>

                <!-- Expandable Options -->
                <button type="button" id="toggle-options" class="text-sm text-green-600 hover:text-green-700 flex items-center gap-1">
                    <span data-i18n="lessOptions">Less options</span>
                    <svg class="w-4 h-4 transition-transform rotate-180" id="options-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>

                <div id="extra-options" class="space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <input
                            type="text"
                            id="item-amount"
                            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
                            data-i18n-placeholder="amount"
                            placeholder="Amount (e.g., 2 kg)"
                        >
                        <select
                            id="item-type"
                            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
                        >
                            <option value="">-- ${i18n.t('type')} --</option>
                            ${getTypeOptions()}
                        </select>
                    </div>
                    <textarea
                        id="item-note"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
                        rows="2"
                        data-i18n-placeholder="note"
                        placeholder="Note"
                    ></textarea>
                </div>
            </form>
        </div>

        <!-- Shopping List -->
        <div class="mb-6">
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    <span data-i18n="shoppingList">Shopping List</span>
                    <span class="text-sm font-normal text-gray-500">(${unboughtItems.length})</span>
                </h2>
                <!-- List Actions Dropdown -->
                <div class="relative">
                    <button id="list-actions-btn" class="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                        </svg>
                    </button>
                    <div id="list-actions-dropdown" class="hidden absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-20">
                        <button id="archive-bought-btn" class="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-3 ${boughtItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${boughtItems.length === 0 ? 'disabled' : ''}>
                            <span class="text-lg">📦</span>
                            <span data-i18n="archiveBought">Arkiver købte varer</span>
                        </button>
                        <button id="delete-bought-btn" class="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-3 ${boughtItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${boughtItems.length === 0 ? 'disabled' : ''}>
                            <span class="text-lg">🗑️</span>
                            <span data-i18n="deleteBought">Slet købte varer</span>
                        </button>
                        <div class="border-t border-gray-100"></div>
                        <button id="delete-all-btn" class="w-full px-4 py-3 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-3 ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${items.length === 0 ? 'disabled' : ''}>
                            <span class="text-lg">⚠️</span>
                            <span data-i18n="deleteAll">Slet alle varer</span>
                        </button>
                    </div>
                </div>
            </div>

            <div id="items-list" class="space-y-4">
                ${unboughtItems.length === 0
                    ? `<p class="text-gray-500 text-center py-4 bg-white rounded-lg" data-i18n="noItems">No items yet. Add your first item above!</p>`
                    : renderItemsByCategory(unboughtItems, false)
                }
            </div>
        </div>

        <!-- Bought Items -->
        <div class="mb-6">
            <h2 class="text-lg font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span data-i18n="boughtItems">Bought Items</span>
                <span class="text-sm font-normal">(${boughtItems.length})</span>
            </h2>

            <div id="bought-list" class="space-y-4">
                ${boughtItems.length === 0
                    ? `<p class="text-gray-400 text-center py-4 bg-gray-50 rounded-lg" data-i18n="noBoughtItems">No bought items</p>`
                    : renderItemsByCategory(boughtItems, true)
                }
            </div>
        </div>

        <!-- Archives Section -->
        <div id="archives-section" class="mb-6">
            <button type="button" id="toggle-archives" class="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition mb-3">
                <span class="text-lg">📦</span>
                <span data-i18n="archives">Arkiv</span>
                <span id="archives-count" class="text-sm font-normal">(0)</span>
                <svg class="w-4 h-4 transition-transform" id="archives-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>
            <div id="archives-list" class="hidden space-y-3">
                <!-- Archives will be loaded here -->
                <p class="text-gray-400 text-center py-4 text-sm" data-i18n="loadingArchives">Indlæser arkiv...</p>
            </div>
        </div>

        <!-- Follow & Notifications (always visible) -->
        <div class="bg-white rounded-xl shadow-lg p-4 mb-6">
            <div class="flex items-center gap-4">
                <label class="flex-1 flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">⭐</span>
                        <span class="font-medium text-gray-700 text-sm" data-i18n="followListLabel">Følg</span>
                    </div>
                    <div class="relative">
                        <input type="checkbox" id="follow-toggle" class="sr-only peer" data-list-id="${list.id}">
                        <div class="w-11 h-6 bg-gray-300 peer-checked:bg-green-500 rounded-full transition"></div>
                        <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition"></div>
                    </div>
                </label>
                <label class="flex-1 flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition" id="notifications-label">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">🔔</span>
                        <span class="font-medium text-gray-700 text-sm" data-i18n="enableNotifications">Notifikationer</span>
                    </div>
                    <div class="relative">
                        <input type="checkbox" id="notifications-toggle" class="sr-only peer" data-list-id="${list.id}">
                        <div class="w-11 h-6 bg-gray-300 peer-checked:bg-green-500 rounded-full transition"></div>
                        <div class="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition"></div>
                    </div>
                </label>
            </div>
        </div>

        <!-- Settings Section -->
        <div class="border-t pt-6">
            <button type="button" id="toggle-settings" class="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span data-i18n="settings">Settings</span>
                <svg class="w-4 h-4 transition-transform" id="settings-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </button>

            <div id="settings-panel" class="hidden mt-4 space-y-4">
                <!-- Password Settings -->
                <div class="bg-white rounded-xl shadow-lg p-4">
                    <h3 class="font-medium text-gray-800 mb-3" data-i18n="${list.has_password ? 'changePassword' : 'addPassword'}">${list.has_password ? 'Change Password' : 'Add Password'}</h3>

                    <form id="password-form" class="space-y-3">
                        ${list.has_password ? `
                            <div>
                                <input
                                    type="password"
                                    id="current-password"
                                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
                                    data-i18n-placeholder="currentPassword"
                                    placeholder="Current password"
                                    required
                                >
                            </div>
                        ` : ''}
                        <div>
                            <input
                                type="password"
                                id="new-password"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
                                data-i18n-placeholder="newPassword"
                                placeholder="New password"
                            >
                        </div>
                        <div class="space-y-2">
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="settings-require-view" class="w-4 h-4 text-green-500 rounded focus:ring-green-500" ${list.view_requires_password ? 'checked' : ''}>
                                <span class="text-sm text-gray-600" data-i18n="requirePasswordToView">Require password to view</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="settings-require-edit" class="w-4 h-4 text-green-500 rounded focus:ring-green-500" ${list.edit_requires_password ? 'checked' : ''} checked>
                                <span class="text-sm text-gray-600" data-i18n="requirePasswordToEdit">Require password to edit</span>
                            </label>
                        </div>
                        <div class="flex gap-2">
                            <button
                                type="submit"
                                class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm"
                                data-i18n="save"
                            >Save</button>
                            ${list.has_password ? `
                                <button
                                    type="button"
                                    id="remove-password-btn"
                                    class="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition text-sm"
                                    data-i18n="removePassword"
                                >Remove Password</button>
                            ` : ''}
                        </div>
                        <p id="password-message" class="text-sm hidden"></p>
                    </form>
                </div>

                <!-- Delete List -->
                <div class="bg-white rounded-xl shadow-lg p-4 border border-red-200">
                    <h3 class="font-medium text-red-600 mb-2" data-i18n="deleteList">Delete List</h3>
                    <p class="text-sm text-gray-500 mb-3" data-i18n="deleteWarning">Are you sure? This will permanently delete the list and all items.</p>

                    <form id="delete-form" class="space-y-3">
                        ${list.has_password ? `
                            <input
                                type="password"
                                id="delete-password"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition text-sm"
                                data-i18n-placeholder="password"
                                placeholder="Password"
                                required
                            >
                        ` : ''}
                        <button
                            type="submit"
                            class="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
                            data-i18n="deleteList"
                        >Delete List</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Undo Toast -->
        <div id="undo-toast" class="fixed bottom-4 left-4 right-4 max-w-lg mx-auto bg-gray-800 text-white rounded-lg shadow-lg p-4 flex items-center justify-between transform translate-y-full opacity-0 transition-all duration-300 z-50">
            <span id="undo-message" class="text-sm"></span>
            <button id="undo-btn" class="ml-4 px-4 py-1.5 bg-white text-gray-800 rounded font-medium text-sm hover:bg-gray-100 transition">
                <span data-i18n="undo">Fortryd</span>
            </button>
        </div>
    `;

    i18n.updateDOM();
    setupListPageEvents(list);
    loadArchives(list);
}

// Category order for sorting
const CATEGORY_ORDER = ['produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'snacks', 'household', 'personal', 'other', null];

// Category emoji mapping
const CATEGORY_EMOJI = {
    produce: '🥬',
    dairy: '🧀',
    meat: '🥩',
    bakery: '🥖',
    frozen: '🧊',
    pantry: '🥫',
    beverages: '🥤',
    snacks: '🍿',
    household: '🧹',
    personal: '🧴',
    other: '📦',
    null: '📝'
};

function getCategoryEmoji(category) {
    return CATEGORY_EMOJI[category] || CATEGORY_EMOJI[null];
}

function groupItemsByCategory(items) {
    const groups = {};

    items.forEach(item => {
        const category = item.type || null;
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(item);
    });

    // Sort categories by predefined order, with uncategorized (null) last
    const sortedCategories = Object.keys(groups).sort((a, b) => {
        const aIndex = CATEGORY_ORDER.indexOf(a === 'null' ? null : a);
        const bIndex = CATEGORY_ORDER.indexOf(b === 'null' ? null : b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    return sortedCategories.map(cat => ({
        category: cat === 'null' ? null : cat,
        items: groups[cat]
    }));
}

function renderItemsByCategory(items, isBought) {
    const grouped = groupItemsByCategory(items);

    return grouped.map(group => {
        const categoryLabel = group.category
            ? i18n.t(`types.${group.category}`)
            : i18n.t('uncategorized');
        const categoryEmoji = getCategoryEmoji(group.category);

        return `
            <div class="category-group">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-sm">${categoryEmoji}</span>
                    <span class="text-xs font-medium text-gray-400 uppercase tracking-wide">${categoryLabel}</span>
                    <div class="flex-1 h-px bg-gray-200"></div>
                </div>
                <div class="space-y-2">
                    ${group.items.map(item => renderItem(item, isBought)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderItem(item, isBought) {
    const isPending = item.syncStatus === 'pending';
    const isError = item.syncStatus === 'error';

    return `
        <div class="bg-white rounded-lg shadow-sm p-3 flex items-start gap-3 ${isBought ? 'opacity-60' : ''} ${isPending ? 'border-l-4 border-yellow-400' : ''} ${isError ? 'border-l-4 border-red-400' : ''}" data-item-id="${item.id}">
            <button
                class="toggle-btn flex-shrink-0 mt-1 w-6 h-6 rounded-full border-2 ${isBought ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-500'} transition flex items-center justify-center"
                data-item-id="${item.id}"
                data-bought="${isBought}"
            >
                ${isBought ? '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
            </button>

            <div class="flex-1 min-w-0 cursor-pointer edit-item-btn" data-item-id="${item.id}">
                <div class="flex items-center gap-2">
                    <p class="text-gray-800 font-medium ${isBought ? 'line-through' : ''}">${escapeHtml(item.name)}</p>
                    ${isPending ? '<span class="text-xs text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded">Pending</span>' : ''}
                    ${isError ? '<span class="text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded">Error</span>' : ''}
                </div>
                ${item.amount ? `<p class="text-sm text-gray-500">${escapeHtml(item.amount)}</p>` : ''}
                ${item.note ? `<p class="text-sm text-gray-400 mt-1">${escapeHtml(item.note)}</p>` : ''}
            </div>

            <button
                class="delete-btn flex-shrink-0 p-2 text-gray-400 hover:text-red-500 transition"
                data-item-id="${item.id}"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            </button>
        </div>
    `;
}

function renderEditForm(item) {
    return `
        <div class="bg-white rounded-lg shadow-lg p-4 border-2 border-green-500" data-item-id="${item.id}" data-editing="true">
            <form class="edit-item-form space-y-3" data-item-id="${item.id}">
                <input
                    type="text"
                    name="name"
                    value="${escapeHtml(item.name)}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
                    data-i18n-placeholder="itemName"
                    required
                >
                <div class="grid grid-cols-2 gap-2">
                    <input
                        type="text"
                        name="amount"
                        value="${item.amount ? escapeHtml(item.amount) : ''}"
                        class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
                        data-i18n-placeholder="amount"
                    >
                    <select
                        name="type"
                        class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
                    >
                        <option value="">-- ${i18n.t('type')} --</option>
                        ${getTypeOptions(item.type)}
                    </select>
                </div>
                <textarea
                    name="note"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition text-sm"
                    rows="2"
                    data-i18n-placeholder="note"
                >${item.note ? escapeHtml(item.note) : ''}</textarea>
                <div class="flex gap-2">
                    <button
                        type="submit"
                        class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm"
                        data-i18n="saveChanges"
                    >${i18n.t('saveChanges')}</button>
                    <button
                        type="button"
                        class="cancel-edit-btn px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
                        data-item-id="${item.id}"
                        data-i18n="cancel"
                    >${i18n.t('cancel')}</button>
                </div>
            </form>
        </div>
    `;
}

function getTypeOptions(selectedType = null) {
    const types = ['produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'snacks', 'household', 'personal', 'other'];
    return types.map(type => `<option value="${type}" ${type === selectedType ? 'selected' : ''}>${i18n.t(`types.${type}`)}</option>`).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupListPageEvents(list) {
    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
        router.goHome();
    });

    // Language dropdown
    const dropdownBtn = document.getElementById('lang-dropdown-btn');
    const dropdown = document.getElementById('lang-dropdown');

    dropdownBtn.addEventListener('click', () => {
        dropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#lang-dropdown-btn') && !e.target.closest('#lang-dropdown')) {
            dropdown.classList.add('hidden');
        }
    });

    document.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const lang = btn.dataset.lang;
            if (lang !== i18n.currentLang) {
                await i18n.setLanguage(lang);
                renderListUI(list);
            }
            dropdown.classList.add('hidden');
        });
    });

    // Toggle extra options
    document.getElementById('toggle-options').addEventListener('click', () => {
        const options = document.getElementById('extra-options');
        const arrow = document.getElementById('options-arrow');
        const toggleBtn = document.getElementById('toggle-options');

        options.classList.toggle('hidden');
        arrow.classList.toggle('rotate-180');

        const span = toggleBtn.querySelector('span');
        span.setAttribute('data-i18n', options.classList.contains('hidden') ? 'moreOptions' : 'lessOptions');
        span.textContent = i18n.t(options.classList.contains('hidden') ? 'moreOptions' : 'lessOptions');
    });

    // Add item form
    document.getElementById('add-item-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleAddItem(list);
    });

    // Toggle and delete buttons (event delegation)
    document.getElementById('items-list').addEventListener('click', handleItemAction);
    document.getElementById('bought-list').addEventListener('click', handleItemAction);

    // List actions dropdown
    const listActionsBtn = document.getElementById('list-actions-btn');
    const listActionsDropdown = document.getElementById('list-actions-dropdown');

    listActionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        listActionsDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#list-actions-btn') && !e.target.closest('#list-actions-dropdown')) {
            listActionsDropdown.classList.add('hidden');
        }
    });

    // Archive bought items
    document.getElementById('archive-bought-btn').addEventListener('click', async () => {
        listActionsDropdown.classList.add('hidden');
        await handleArchiveBought(list);
    });

    // Delete bought items
    document.getElementById('delete-bought-btn').addEventListener('click', async () => {
        listActionsDropdown.classList.add('hidden');
        await handleDeleteBought(list);
    });

    // Delete all items
    document.getElementById('delete-all-btn').addEventListener('click', async () => {
        listActionsDropdown.classList.add('hidden');
        if (confirm(i18n.t('confirmDeleteAll') || 'Er du sikker på at du vil slette alle varer?')) {
            await handleDeleteAll(list);
        }
    });

    // Toggle archives section
    document.getElementById('toggle-archives').addEventListener('click', () => {
        const archivesList = document.getElementById('archives-list');
        const arrow = document.getElementById('archives-arrow');
        archivesList.classList.toggle('hidden');
        arrow.classList.toggle('rotate-180');
    });

    // Undo button
    document.getElementById('undo-btn').addEventListener('click', async () => {
        await handleUndo(list);
    });

    // Initialize follow/notification toggles immediately
    initializeFollowToggles(list);

    // Toggle settings
    document.getElementById('toggle-settings').addEventListener('click', () => {
        const panel = document.getElementById('settings-panel');
        const arrow = document.getElementById('settings-arrow');
        panel.classList.toggle('hidden');
        arrow.classList.toggle('rotate-180');
    });

    // Follow toggle
    document.getElementById('follow-toggle').addEventListener('change', async (e) => {
        const isFollowed = e.target.checked;
        const notificationsToggle = document.getElementById('notifications-toggle');
        const notificationsLabel = document.getElementById('notifications-label');

        if (isFollowed) {
            await db.followList(list.id);
            notificationsLabel.style.opacity = '1';
            notificationsLabel.style.pointerEvents = 'auto';
        } else {
            await db.unfollowList(list.id);
            notificationsToggle.checked = false;
            notificationsLabel.style.opacity = '0.5';
            notificationsLabel.style.pointerEvents = 'none';
        }
    });

    // Notifications toggle
    document.getElementById('notifications-toggle').addEventListener('change', async (e) => {
        const enabled = e.target.checked;

        if (enabled) {
            // Request notification permission and subscribe to push
            const subscribed = await subscribeToNotifications(list);
            if (!subscribed) {
                e.target.checked = false;
                return;
            }
        } else {
            // Unsubscribe from push notifications
            await unsubscribeFromNotifications(list.id);
        }

        await db.setListNotifications(list.id, enabled);
    });

    // Password form
    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handlePasswordUpdate(list);
    });

    // Remove password button
    const removeBtn = document.getElementById('remove-password-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', async () => {
            await handleRemovePassword(list);
        });
    }

    // Delete form
    document.getElementById('delete-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleDeleteList(list);
    });
}

async function initializeFollowToggles(list) {
    const followToggle = document.getElementById('follow-toggle');
    const notificationsToggle = document.getElementById('notifications-toggle');
    const notificationsLabel = document.getElementById('notifications-label');

    // Get current follow status from IndexedDB
    const localList = await db.getList(list.id);
    const isFollowed = localList?.isFollowed === true;
    const notificationsEnabled = localList?.notificationsEnabled === true;

    // Set checkbox states
    followToggle.checked = isFollowed;
    notificationsToggle.checked = notificationsEnabled;

    // Disable notifications if not followed
    if (!isFollowed) {
        notificationsLabel.style.opacity = '0.5';
        notificationsLabel.style.pointerEvents = 'none';
    } else {
        notificationsLabel.style.opacity = '1';
        notificationsLabel.style.pointerEvents = 'auto';
    }
}

async function handleAddItem(list) {
    const nameInput = document.getElementById('item-name');
    const amountInput = document.getElementById('item-amount');
    const typeSelect = document.getElementById('item-type');
    const noteInput = document.getElementById('item-note');

    const name = nameInput.value.trim();
    if (!name) return;

    // Check if edit password is required (only when online)
    if (list.edit_requires_password && sync.isOnline()) {
        const token = store.getAccessToken(currentListName);
        if (!token) {
            const verified = await showPasswordModal(list.id, 'edit');
            if (!verified) return;
        }
    }

    const item = {
        name,
        amount: amountInput?.value.trim() || null,
        type: typeSelect?.value || null,
        note: noteInput?.value.trim() || null,
    };

    // Clear form immediately for better UX
    nameInput.value = '';
    if (amountInput) amountInput.value = '';
    if (typeSelect) typeSelect.value = '';
    if (noteInput) noteInput.value = '';

    if (sync.isOnline()) {
        // Online - add directly to server
        try {
            const token = store.getAccessToken(currentListName);
            const newItem = await api.addItem(list.id, item, token);

            // Save to local DB
            await db.saveItem({ ...newItem, syncStatus: 'synced' });

            store.addItem(newItem);
            renderListUI(list);
        } catch (error) {
            console.error('Error adding item:', error);
            // Fallback to offline mode
            await addItemOffline(list, item);
        }
    } else {
        // Offline - add locally and queue for sync
        await addItemOffline(list, item);
    }
}

async function addItemOffline(list, item) {
    // Create temporary item with temp ID
    const tempItem = {
        id: db.generateTempId(),
        list_id: list.id,
        name: item.name,
        amount: item.amount,
        type: item.type,
        note: item.note,
        is_bought: false,
        created_at: new Date().toISOString(),
        syncStatus: 'pending'
    };

    // Save to local DB
    await db.saveItem(tempItem);

    // Queue for sync
    await sync.queueOperation('ADD_ITEM', {
        listId: list.id,
        item: { ...tempItem, id: tempItem.id }
    });

    // Update store and UI
    store.addItem(tempItem);
    renderListUI(list);
}

async function handleItemAction(e) {
    const toggleBtn = e.target.closest('.toggle-btn');
    const deleteBtn = e.target.closest('.delete-btn');
    const editBtn = e.target.closest('.edit-item-btn');
    const cancelEditBtn = e.target.closest('.cancel-edit-btn');
    const editForm = e.target.closest('.edit-item-form');

    const list = store.getState().currentList;

    // Handle cancel edit
    if (cancelEditBtn) {
        renderListUI(list);
        return;
    }

    // Handle edit form submit
    if (editForm && e.type === 'submit') {
        e.preventDefault();
        await handleEditSubmit(editForm, list);
        return;
    }

    // Check edit permission for other actions (only when online)
    if ((toggleBtn || deleteBtn || editBtn) && list.edit_requires_password && sync.isOnline()) {
        const token = store.getAccessToken(currentListName);
        if (!token) {
            const verified = await showPasswordModal(list.id, 'edit');
            if (!verified) return;
        }
    }

    if (toggleBtn) {
        const itemId = toggleBtn.dataset.itemId;
        const isBought = toggleBtn.dataset.bought === 'true';
        const newBoughtState = !isBought;

        // Optimistic UI update
        store.updateItem(itemId, { is_bought: newBoughtState, syncStatus: 'pending' });
        renderListUI(list);

        if (sync.isOnline()) {
            try {
                const token = store.getAccessToken(currentListName);
                await api.toggleItemBought(itemId, newBoughtState, token);

                // Update local DB
                const item = await db.getItem(itemId);
                if (item) {
                    await db.saveItem({ ...item, is_bought: newBoughtState, syncStatus: 'synced' });
                }
                store.updateItem(itemId, { syncStatus: 'synced' });
            } catch (error) {
                console.error('Error toggling item:', error);
                // Queue for later sync
                await toggleItemOffline(itemId, newBoughtState);
            }
        } else {
            // Offline - queue for sync
            await toggleItemOffline(itemId, newBoughtState);
        }
    }

    if (deleteBtn) {
        const itemId = deleteBtn.dataset.itemId;

        // Optimistic UI update
        store.removeItem(itemId);
        renderListUI(list);

        if (sync.isOnline()) {
            try {
                const token = store.getAccessToken(currentListName);
                await api.deleteItem(itemId, token);

                // Remove from local DB
                await db.deleteItem(itemId);
            } catch (error) {
                console.error('Error deleting item:', error);
                // Queue for later sync
                await deleteItemOffline(itemId);
            }
        } else {
            // Offline - queue for sync
            await deleteItemOffline(itemId);
        }
    }

    if (editBtn && !e.target.closest('[data-editing="true"]')) {
        const itemId = editBtn.dataset.itemId;
        const items = store.getState().items;
        const item = items.find(i => i.id === itemId);

        if (item) {
            // Replace item card with edit form
            const itemCard = document.querySelector(`[data-item-id="${itemId}"]:not([data-editing="true"])`);
            if (itemCard) {
                itemCard.outerHTML = renderEditForm(item);
                i18n.updateDOM();

                // Add submit listener to the new form
                const form = document.querySelector(`.edit-item-form[data-item-id="${itemId}"]`);
                if (form) {
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        await handleEditSubmit(form, list);
                    });
                }
            }
        }
    }
}

async function toggleItemOffline(itemId, isBought) {
    // Update local DB
    const item = await db.getItem(itemId);
    if (item) {
        await db.saveItem({ ...item, is_bought: isBought, syncStatus: 'pending' });
    }

    // Queue for sync
    await sync.queueOperation('TOGGLE_ITEM', {
        itemId,
        isBought
    });
}

async function deleteItemOffline(itemId) {
    // Remove from local DB
    await db.deleteItem(itemId);

    // Queue for sync (only if not a temp item)
    if (!db.isTempId(itemId)) {
        await sync.queueOperation('DELETE_ITEM', {
            itemId
        });
    }
}

async function handleEditSubmit(form, list) {
    const itemId = form.dataset.itemId;
    const formData = new FormData(form);

    const updates = {
        name: formData.get('name').trim(),
        amount: formData.get('amount')?.trim() || null,
        type: formData.get('type') || null,
        note: formData.get('note')?.trim() || null,
    };

    if (!updates.name) return;

    try {
        const token = store.getAccessToken(currentListName);
        await api.updateItem(itemId, updates, token);
        store.updateItem(itemId, updates);
        renderListUI(list);
    } catch (error) {
        console.error('Error updating item:', error);
        alert(error.message || i18n.t('error'));
    }
}

async function handlePasswordUpdate(list) {
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const viewCheckbox = document.getElementById('settings-require-view');
    const editCheckbox = document.getElementById('settings-require-edit');
    const messageEl = document.getElementById('password-message');

    const currentPassword = currentPasswordInput?.value || null;
    const newPassword = newPasswordInput.value;

    if (!newPassword) {
        messageEl.textContent = i18n.t('newPassword') + ' required';
        messageEl.className = 'text-sm text-red-500';
        messageEl.classList.remove('hidden');
        return;
    }

    try {
        await api.updatePassword(
            list.id,
            currentPassword,
            newPassword,
            viewCheckbox.checked,
            editCheckbox.checked
        );

        messageEl.textContent = i18n.t('passwordUpdated');
        messageEl.className = 'text-sm text-green-500';
        messageEl.classList.remove('hidden');

        // Clear token and reload list
        store.clearAccessToken(currentListName);

        // Reload page after short delay
        setTimeout(() => {
            renderListPage(currentListName);
        }, 1000);
    } catch (error) {
        messageEl.textContent = error.message || i18n.t('error');
        messageEl.className = 'text-sm text-red-500';
        messageEl.classList.remove('hidden');
    }
}

async function handleRemovePassword(list) {
    const currentPasswordInput = document.getElementById('current-password');
    const messageEl = document.getElementById('password-message');

    const currentPassword = currentPasswordInput?.value || null;

    if (list.has_password && !currentPassword) {
        messageEl.textContent = i18n.t('currentPassword') + ' required';
        messageEl.className = 'text-sm text-red-500';
        messageEl.classList.remove('hidden');
        return;
    }

    try {
        await api.updatePassword(list.id, currentPassword, null, false, false);

        messageEl.textContent = i18n.t('passwordRemoved');
        messageEl.className = 'text-sm text-green-500';
        messageEl.classList.remove('hidden');

        // Clear token and reload
        store.clearAccessToken(currentListName);

        setTimeout(() => {
            renderListPage(currentListName);
        }, 1000);
    } catch (error) {
        messageEl.textContent = error.message || i18n.t('error');
        messageEl.className = 'text-sm text-red-500';
        messageEl.classList.remove('hidden');
    }
}

async function handleDeleteList(list) {
    const passwordInput = document.getElementById('delete-password');
    const password = passwordInput?.value || null;

    if (!confirm(i18n.t('deleteWarning'))) {
        return;
    }

    try {
        await api.deleteList(list.id, password);

        alert(i18n.t('listDeleted'));
        router.goHome();
    } catch (error) {
        alert(error.message || i18n.t('error'));
    }
}

// ===== Push Notification Functions =====

// VAPID public key for push notifications
const VAPID_PUBLIC_KEY = 'BFpPUI-xx-aBDBj6OynTvPPOnSu9iaJqKXe5TePnxUW9Hphr7ztPVakRSIcMJjJtkWrMwrPnTrjIAfyLPDYclh8';

// Convert VAPID key to Uint8Array for subscription
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Subscribe to push notifications for a list
async function subscribeToNotifications(list) {
    try {
        // Check if push is supported
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push notifications not supported');
            alert(i18n.t('pushNotSupported') || 'Push notifications are not supported in this browser');
            return false;
        }

        // Check if VAPID key is configured
        if (VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
            console.error('VAPID public key not configured');
            alert('Push notifications are not configured yet');
            return false;
        }

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('Notification permission denied');
            return false;
        }

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();

        // If no subscription, create one
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        // Send subscription to server
        const subscriptionJSON = subscription.toJSON();
        await api.savePushSubscription(list.id, {
            endpoint: subscriptionJSON.endpoint,
            keys: {
                p256dh: subscriptionJSON.keys.p256dh,
                auth: subscriptionJSON.keys.auth
            }
        });

        // Save subscription locally
        await db.savePushSubscription(list.id, subscriptionJSON);

        console.log('Successfully subscribed to push notifications for list:', list.name);
        return true;
    } catch (error) {
        console.error('Failed to subscribe to push notifications:', error);
        alert(i18n.t('pushSubscriptionFailed') || 'Failed to enable notifications');
        return false;
    }
}

// Unsubscribe from push notifications for a list
async function unsubscribeFromNotifications(listId) {
    try {
        // Remove subscription from server
        await api.deletePushSubscription(listId);

        // Clear local subscription
        await db.savePushSubscription(listId, null);

        console.log('Unsubscribed from push notifications for list:', listId);
        return true;
    } catch (error) {
        console.error('Failed to unsubscribe from push notifications:', error);
        return false;
    }
}

// ===== Archive Functions =====

async function loadArchives(list) {
    try {
        const token = store.getAccessToken(currentListName);
        const response = await api.getArchives(list.id, token);
        const archives = response.archives || [];

        // Update count
        const countEl = document.getElementById('archives-count');
        if (countEl) {
            countEl.textContent = `(${archives.length})`;
        }

        // Render archives
        renderArchives(archives, list);
    } catch (error) {
        console.error('Error loading archives:', error);
        const archivesList = document.getElementById('archives-list');
        if (archivesList) {
            archivesList.innerHTML = `<p class="text-red-400 text-center py-4 text-sm">${i18n.t('archiveLoadError') || 'Kunne ikke indlæse arkiv'}</p>`;
        }
    }
}

function renderArchives(archives, list) {
    const archivesList = document.getElementById('archives-list');
    if (!archivesList) return;

    if (archives.length === 0) {
        archivesList.innerHTML = `<p class="text-gray-400 text-center py-4 text-sm" data-i18n="noArchives">${i18n.t('noArchives') || 'Ingen arkiverede indkøb'}</p>`;
        return;
    }

    archivesList.innerHTML = archives.map(archive => {
        const date = new Date(archive.archived_at);
        const formattedDate = date.toLocaleDateString(i18n.currentLang === 'da' ? 'da-DK' : 'en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        const items = archive.items || [];

        return `
            <div class="bg-white rounded-lg shadow-sm p-3" data-archive-id="${archive.id}">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700">${formattedDate}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500">${items.length} ${i18n.t('items') || 'varer'}</span>
                        <button class="delete-archive-btn p-1 text-gray-400 hover:text-red-500 transition" data-archive-id="${archive.id}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="text-xs text-gray-500 space-y-0.5">
                    ${items.slice(0, 5).map(item => `<div class="truncate">• ${escapeHtml(item.name)}${item.amount ? ` (${escapeHtml(item.amount)})` : ''}</div>`).join('')}
                    ${items.length > 5 ? `<div class="text-gray-400">+${items.length - 5} ${i18n.t('more') || 'mere'}...</div>` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Add delete archive event listeners
    archivesList.querySelectorAll('.delete-archive-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const archiveId = btn.dataset.archiveId;
            await handleDeleteArchive(archiveId, list);
        });
    });
}

async function handleArchiveBought(list) {
    // Check edit permission
    if (list.edit_requires_password && sync.isOnline()) {
        const token = store.getAccessToken(currentListName);
        if (!token) {
            const verified = await showPasswordModal(list.id, 'edit');
            if (!verified) return;
        }
    }

    try {
        const token = store.getAccessToken(currentListName);
        const response = await api.archiveBoughtItems(list.id, token);

        if (response.success) {
            // Store undo data
            currentUndoData = response.undo_data;

            // Remove bought items from store
            const state = store.getState();
            const boughtItems = state.items.filter(item => item.is_bought);
            boughtItems.forEach(item => store.removeItem(item.id));

            // Re-render UI
            renderListUI(list);

            // Show undo toast
            showUndoToast(i18n.t('archivedBought') || 'Købte varer arkiveret', list);
        }
    } catch (error) {
        console.error('Error archiving bought items:', error);
        alert(error.message || i18n.t('error'));
    }
}

async function handleDeleteBought(list) {
    // Check edit permission
    if (list.edit_requires_password && sync.isOnline()) {
        const token = store.getAccessToken(currentListName);
        if (!token) {
            const verified = await showPasswordModal(list.id, 'edit');
            if (!verified) return;
        }
    }

    try {
        const token = store.getAccessToken(currentListName);
        const response = await api.deleteBoughtItems(list.id, token);

        if (response.success) {
            // Store undo data
            currentUndoData = response.undo_data;

            // Remove bought items from store
            const state = store.getState();
            const boughtItems = state.items.filter(item => item.is_bought);
            boughtItems.forEach(item => store.removeItem(item.id));

            // Re-render UI
            renderListUI(list);

            // Show undo toast
            showUndoToast(i18n.t('deletedBought') || 'Købte varer slettet', list);
        }
    } catch (error) {
        console.error('Error deleting bought items:', error);
        alert(error.message || i18n.t('error'));
    }
}

async function handleDeleteAll(list) {
    // Check edit permission
    if (list.edit_requires_password && sync.isOnline()) {
        const token = store.getAccessToken(currentListName);
        if (!token) {
            const verified = await showPasswordModal(list.id, 'edit');
            if (!verified) return;
        }
    }

    try {
        const token = store.getAccessToken(currentListName);
        const response = await api.deleteAllItems(list.id, token);

        if (response.success) {
            // Store undo data
            currentUndoData = response.undo_data;

            // Clear all items from store
            store.setItems([]);

            // Re-render UI
            renderListUI(list);

            // Show undo toast
            showUndoToast(i18n.t('deletedAll') || 'Alle varer slettet', list);
        }
    } catch (error) {
        console.error('Error deleting all items:', error);
        alert(error.message || i18n.t('error'));
    }
}

async function handleDeleteArchive(archiveId, list) {
    // Check edit permission
    if (list.edit_requires_password && sync.isOnline()) {
        const token = store.getAccessToken(currentListName);
        if (!token) {
            const verified = await showPasswordModal(list.id, 'edit');
            if (!verified) return;
        }
    }

    try {
        const token = store.getAccessToken(currentListName);
        const response = await api.deleteArchive(archiveId, list.id, token);

        if (response.success) {
            // Store undo data
            currentUndoData = response.undo_data;

            // Reload archives
            await loadArchives(list);

            // Show undo toast
            showUndoToast(i18n.t('archiveDeleted') || 'Arkiv slettet', list);
        }
    } catch (error) {
        console.error('Error deleting archive:', error);
        alert(error.message || i18n.t('error'));
    }
}

async function handleUndo(list) {
    if (!currentUndoData) return;

    // Hide toast immediately
    hideUndoToast();

    try {
        const token = store.getAccessToken(currentListName);
        const response = await api.undoArchiveAction(list.id, currentUndoData, token);

        if (response.success) {
            // Reload items from server
            const items = await sync.syncListItems(list.id, token);
            store.setItems(items);

            // Re-render UI
            renderListUI(list);
        }

        currentUndoData = null;
    } catch (error) {
        console.error('Error undoing action:', error);
        alert(error.message || i18n.t('error'));
    }
}

function showUndoToast(message, list) {
    const toast = document.getElementById('undo-toast');
    const messageEl = document.getElementById('undo-message');

    if (!toast || !messageEl) return;

    // Clear any existing timeout
    if (undoTimeout) {
        clearTimeout(undoTimeout);
    }

    // Set message and show toast
    messageEl.textContent = message;
    toast.classList.remove('translate-y-full', 'opacity-0');

    // Auto-hide after 5 seconds
    undoTimeout = setTimeout(() => {
        hideUndoToast();
        currentUndoData = null;
    }, 5000);
}

function hideUndoToast() {
    const toast = document.getElementById('undo-toast');
    if (!toast) return;

    toast.classList.add('translate-y-full', 'opacity-0');

    if (undoTimeout) {
        clearTimeout(undoTimeout);
        undoTimeout = null;
    }
}

export default { renderListPage };

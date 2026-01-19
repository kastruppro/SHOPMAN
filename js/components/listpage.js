import i18n from '../i18n.js';
import router from '../router.js';
import api from '../api.js';
import store from '../store.js';
import { showPasswordModal } from './passwordmodal.js';

let currentListName = null;

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
        // Fetch list metadata
        const lists = await api.getList(listName);

        if (!lists || lists.length === 0) {
            showError(i18n.t('listNotFound'));
            return;
        }

        const list = lists[0];
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

        // Load items
        const token = store.getAccessToken(listName);
        const items = await api.getItems(list.id, token);
        store.setItems(items);

        // Render the list UI
        renderListUI(list);
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

function renderListUI(list) {
    const app = document.getElementById('app');
    const state = store.getState();
    const items = state.items || [];

    const unboughtItems = items.filter(item => !item.is_bought);
    const boughtItems = items.filter(item => item.is_bought);

    app.innerHTML = `
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

            <button id="lang-toggle" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                </svg>
                <span id="lang-label">${i18n.currentLang === 'en' ? 'DA' : 'EN'}</span>
            </button>
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
            <h2 class="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                </svg>
                <span data-i18n="shoppingList">Shopping List</span>
                <span class="text-sm font-normal text-gray-500">(${unboughtItems.length})</span>
            </h2>

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
    `;

    i18n.updateDOM();
    setupListPageEvents(list);
}

// Category order for sorting
const CATEGORY_ORDER = ['produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'beverages', 'snacks', 'household', 'personal', 'other', null];

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

        return `
            <div class="category-group">
                <div class="flex items-center gap-2 mb-2">
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
    return `
        <div class="bg-white rounded-lg shadow-sm p-3 flex items-start gap-3 ${isBought ? 'opacity-60' : ''}" data-item-id="${item.id}">
            <button
                class="toggle-btn flex-shrink-0 mt-1 w-6 h-6 rounded-full border-2 ${isBought ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-500'} transition flex items-center justify-center"
                data-item-id="${item.id}"
                data-bought="${isBought}"
            >
                ${isBought ? '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : ''}
            </button>

            <div class="flex-1 min-w-0 cursor-pointer edit-item-btn" data-item-id="${item.id}">
                <p class="text-gray-800 font-medium ${isBought ? 'line-through' : ''}">${escapeHtml(item.name)}</p>
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

    // Language toggle
    document.getElementById('lang-toggle').addEventListener('click', async () => {
        await i18n.toggleLanguage();
        renderListUI(list);
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

    // Toggle settings
    document.getElementById('toggle-settings').addEventListener('click', () => {
        const panel = document.getElementById('settings-panel');
        const arrow = document.getElementById('settings-arrow');
        panel.classList.toggle('hidden');
        arrow.classList.toggle('rotate-180');
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

async function handleAddItem(list) {
    const nameInput = document.getElementById('item-name');
    const amountInput = document.getElementById('item-amount');
    const typeSelect = document.getElementById('item-type');
    const noteInput = document.getElementById('item-note');

    const name = nameInput.value.trim();
    if (!name) return;

    // Check if edit password is required
    if (list.edit_requires_password) {
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

    try {
        const token = store.getAccessToken(currentListName);
        const newItem = await api.addItem(list.id, item, token);

        store.addItem(newItem);

        // Clear form
        nameInput.value = '';
        if (amountInput) amountInput.value = '';
        if (typeSelect) typeSelect.value = '';
        if (noteInput) noteInput.value = '';

        // Re-render
        renderListUI(list);
    } catch (error) {
        console.error('Error adding item:', error);
        alert(error.message || i18n.t('error'));
    }
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

    // Check edit permission for other actions
    if ((toggleBtn || deleteBtn || editBtn) && list.edit_requires_password) {
        const token = store.getAccessToken(currentListName);
        if (!token) {
            const verified = await showPasswordModal(list.id, 'edit');
            if (!verified) return;
        }
    }

    if (toggleBtn) {
        const itemId = toggleBtn.dataset.itemId;
        const isBought = toggleBtn.dataset.bought === 'true';
        const token = store.getAccessToken(currentListName);

        try {
            await api.toggleItemBought(itemId, !isBought, token);
            store.updateItem(itemId, { is_bought: !isBought });
            renderListUI(list);
        } catch (error) {
            console.error('Error toggling item:', error);
        }
    }

    if (deleteBtn) {
        const itemId = deleteBtn.dataset.itemId;
        const token = store.getAccessToken(currentListName);

        try {
            await api.deleteItem(itemId, token);
            store.removeItem(itemId);
            renderListUI(list);
        } catch (error) {
            console.error('Error deleting item:', error);
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

export default { renderListPage };

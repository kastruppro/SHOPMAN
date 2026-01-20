import i18n from '../i18n.js';
import router from '../router.js';
import api from '../api.js';
import store from '../store.js';
import db from '../db.js';

export async function renderHomepage() {
    // Get followed lists from IndexedDB
    const followedLists = await db.getFollowedLists();
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="text-center mb-8">
            <img src="/icons/icon-120.png" alt="SHOPMAN" class="w-16 h-16 mx-auto mb-4 rounded-2xl shadow-lg">
            <h1 class="text-3xl font-bold text-gray-800" data-i18n="appTitle">Shopping List</h1>
        </div>

        <!-- Language Dropdown -->
        <div class="flex justify-end mb-6">
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

        ${followedLists.length > 0 ? `
        <!-- My Lists Section -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path>
                </svg>
                <span data-i18n="myLists">Mine lister</span>
            </h2>
            <div class="space-y-2">
                ${followedLists.map(list => `
                    <button
                        class="followed-list-btn w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-green-50 rounded-lg transition group"
                        data-list-name="${escapeHtml(list.name)}"
                    >
                        <div class="flex items-center gap-3">
                            <span class="text-xl">🛒</span>
                            <div class="text-left">
                                <p class="font-medium text-gray-800 group-hover:text-green-700">${escapeHtml(list.name)}</p>
                                <p class="text-xs text-gray-400">${list.notificationsEnabled ? '🔔' : '🔕'} ${list.has_password ? '🔒' : ''}</p>
                            </div>
                        </div>
                        <svg class="w-5 h-5 text-gray-400 group-hover:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                `).join('')}
            </div>
        </div>
        ` : ''}

        <!-- Create New List Card -->
        <div class="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 class="text-lg font-semibold text-gray-800 mb-4" data-i18n="createNewList">Create New List</h2>

            <form id="create-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1" data-i18n="listName">List name</label>
                    <input
                        type="text"
                        id="create-name"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        data-i18n-placeholder="enterListName"
                        placeholder="Enter list name"
                        required
                    >
                    <p id="create-error" class="text-red-500 text-sm mt-1 hidden"></p>
                </div>

                <!-- Password Section -->
                <div class="border-t pt-4">
                    <div class="flex items-center gap-2 mb-3">
                        <input type="checkbox" id="enable-password" class="w-4 h-4 text-green-500 rounded focus:ring-green-500">
                        <label for="enable-password" class="text-sm font-medium text-gray-700" data-i18n="setPassword">Set a password</label>
                    </div>

                    <div id="password-options" class="hidden space-y-3 pl-6">
                        <div>
                            <input
                                type="password"
                                id="create-password"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                                data-i18n-placeholder="password"
                                placeholder="Password"
                            >
                        </div>
                        <div class="space-y-2">
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="require-view" class="w-4 h-4 text-green-500 rounded focus:ring-green-500">
                                <span class="text-sm text-gray-600" data-i18n="requirePasswordToView">Require password to view</span>
                            </label>
                            <label class="flex items-center gap-2">
                                <input type="checkbox" id="require-edit" class="w-4 h-4 text-green-500 rounded focus:ring-green-500" checked>
                                <span class="text-sm text-gray-600" data-i18n="requirePasswordToEdit">Require password to edit</span>
                            </label>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    id="create-btn"
                    class="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium flex items-center justify-center gap-2"
                >
                    <span data-i18n="create">Create</span>
                    <svg class="w-4 h-4 hidden animate-spin" id="create-spinner" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </button>
            </form>
        </div>

        <!-- Go to Existing List Card -->
        <div class="bg-white rounded-xl shadow-lg p-6">
            <h2 class="text-lg font-semibold text-gray-800 mb-4" data-i18n="goToExistingList">Go to Existing List</h2>

            <form id="goto-form" class="space-y-4">
                <div>
                    <input
                        type="text"
                        id="goto-name"
                        class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        data-i18n-placeholder="enterListName"
                        placeholder="Enter list name"
                        required
                    >
                </div>

                <button
                    type="submit"
                    class="w-full px-4 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition font-medium"
                    data-i18n="go"
                >Go</button>
            </form>
        </div>
    `;

    // Update i18n after rendering
    i18n.updateDOM();

    // Event listeners
    setupHomepageEvents();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function setupHomepageEvents() {
    // Followed lists click handlers
    document.querySelectorAll('.followed-list-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const listName = btn.dataset.listName;
            if (listName) {
                router.navigateToList(listName);
            }
        });
    });

    // Language dropdown
    const dropdownBtn = document.getElementById('lang-dropdown-btn');
    const dropdown = document.getElementById('lang-dropdown');

    dropdownBtn.addEventListener('click', () => {
        dropdown.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#lang-dropdown-btn') && !e.target.closest('#lang-dropdown')) {
            dropdown.classList.add('hidden');
        }
    });

    // Language options
    document.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', async () => {
            const lang = btn.dataset.lang;
            if (lang !== i18n.currentLang) {
                await i18n.setLanguage(lang);
                renderHomepage();
            }
            dropdown.classList.add('hidden');
        });
    });

    // Password checkbox toggle
    document.getElementById('enable-password').addEventListener('change', (e) => {
        const options = document.getElementById('password-options');
        options.classList.toggle('hidden', !e.target.checked);
    });

    // Create form
    document.getElementById('create-form').addEventListener('submit', handleCreate);

    // Go to form
    document.getElementById('goto-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('goto-name').value.trim();
        if (name) {
            router.navigateToList(name);
        }
    });
}

async function handleCreate(e) {
    e.preventDefault();

    const nameInput = document.getElementById('create-name');
    const errorEl = document.getElementById('create-error');
    const spinner = document.getElementById('create-spinner');
    const btn = document.getElementById('create-btn');

    const name = nameInput.value.trim();
    if (!name) return;

    // Clear previous error
    errorEl.classList.add('hidden');

    // Check for password options
    const enablePassword = document.getElementById('enable-password').checked;
    const password = enablePassword ? document.getElementById('create-password').value : null;
    const viewRequiresPassword = enablePassword && document.getElementById('require-view').checked;
    const editRequiresPassword = enablePassword && document.getElementById('require-edit').checked;

    // Show loading
    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
        // Check if list already exists
        const exists = await api.listExists(name);
        if (exists) {
            errorEl.textContent = i18n.t('listAlreadyExists');
            errorEl.classList.remove('hidden');
            return;
        }

        // Create the list
        await api.createList({
            name,
            password,
            viewRequiresPassword,
            editRequiresPassword,
        });

        // Navigate to the new list
        router.navigateToList(name);
    } catch (error) {
        errorEl.textContent = error.message || i18n.t('error');
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        spinner.classList.add('hidden');
    }
}

export default { renderHomepage };

import i18n from '../i18n.js';
import router from '../router.js';
import api from '../api.js';
import store from '../store.js';

export function renderHomepage() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
            </div>
            <h1 class="text-3xl font-bold text-gray-800" data-i18n="appTitle">Shopping List</h1>
        </div>

        <!-- Language Toggle -->
        <div class="flex justify-end mb-6">
            <button id="lang-toggle" class="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 bg-white rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
                </svg>
                <span id="lang-label">${i18n.currentLang === 'en' ? 'DA' : 'EN'}</span>
            </button>
        </div>

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

function setupHomepageEvents() {
    // Language toggle
    document.getElementById('lang-toggle').addEventListener('click', async () => {
        await i18n.toggleLanguage();
        document.getElementById('lang-label').textContent = i18n.currentLang === 'en' ? 'DA' : 'EN';
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

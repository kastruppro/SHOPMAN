import i18n from '../i18n.js';
import api from '../api.js';
import store from '../store.js';
import router from '../router.js';
import db from '../db.js';

let resolvePromise = null;
let currentListId = null;
let currentAction = 'view';

export async function showPasswordModal(listId, action = 'view') {
    currentListId = listId;
    currentAction = action;

    const modal = document.getElementById('password-modal');
    const input = document.getElementById('password-input');
    const errorEl = document.getElementById('password-error');
    const messageEl = document.getElementById('modal-message');
    const saveCheckbox = document.getElementById('save-password-checkbox');

    // Update message based on action
    messageEl.setAttribute('data-i18n', action === 'view' ? 'enterPasswordToAccess' : 'enterPasswordToEdit');
    messageEl.textContent = i18n.t(action === 'view' ? 'enterPasswordToAccess' : 'enterPasswordToEdit');

    // Reset state
    input.value = '';
    errorEl.classList.add('hidden');
    if (saveCheckbox) saveCheckbox.checked = false;

    // Check for saved password and try to use it automatically
    const savedPassword = await db.getSavedPassword(listId);
    if (savedPassword) {
        // Try to verify with saved password automatically
        try {
            const result = await api.verifyPassword(listId, savedPassword, action);
            if (result.success && result.token) {
                const listName = router.getListNameFromHash();
                store.setAccessToken(listName, result.token);
                return true; // Auto-verified with saved password
            }
        } catch (error) {
            // Saved password didn't work, clear it
            console.log('[PasswordModal] Saved password invalid, clearing...');
            await db.clearSavedPassword(listId);
        }
    }

    // Show modal
    modal.classList.remove('hidden');
    input.focus();

    // Update i18n
    i18n.updateDOM();

    // Setup event listeners
    setupModalEvents();

    // Return a promise that resolves when modal is closed
    return new Promise(resolve => {
        resolvePromise = resolve;
    });
}

function hideModal(success = false) {
    const modal = document.getElementById('password-modal');
    modal.classList.add('hidden');

    // Clean up event listeners
    cleanupModalEvents();

    if (resolvePromise) {
        resolvePromise(success);
        resolvePromise = null;
    }
}

function setupModalEvents() {
    const unlockBtn = document.getElementById('modal-unlock');
    const cancelBtn = document.getElementById('modal-cancel');
    const input = document.getElementById('password-input');

    unlockBtn.addEventListener('click', handleUnlock);
    cancelBtn.addEventListener('click', handleCancel);
    input.addEventListener('keydown', handleKeydown);
}

function cleanupModalEvents() {
    const unlockBtn = document.getElementById('modal-unlock');
    const cancelBtn = document.getElementById('modal-cancel');
    const input = document.getElementById('password-input');

    unlockBtn.removeEventListener('click', handleUnlock);
    cancelBtn.removeEventListener('click', handleCancel);
    input.removeEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleUnlock();
    } else if (e.key === 'Escape') {
        handleCancel();
    }
}

async function handleUnlock() {
    const input = document.getElementById('password-input');
    const errorEl = document.getElementById('password-error');
    const unlockBtn = document.getElementById('modal-unlock');
    const saveCheckbox = document.getElementById('save-password-checkbox');

    const password = input.value;
    if (!password) {
        input.focus();
        return;
    }

    // Disable button while verifying
    unlockBtn.disabled = true;
    unlockBtn.textContent = '...';

    try {
        const result = await api.verifyPassword(currentListId, password, currentAction);

        if (result.success && result.token) {
            // Store the token
            const listName = router.getListNameFromHash();
            store.setAccessToken(listName, result.token);

            // Save password if checkbox is checked
            if (saveCheckbox && saveCheckbox.checked) {
                await db.savePassword(currentListId, password);
            }

            hideModal(true);
        } else {
            // Show error
            errorEl.classList.remove('hidden');
            input.value = '';
            input.focus();
        }
    } catch (error) {
        console.error('Password verification error:', error);
        errorEl.classList.remove('hidden');
        input.value = '';
        input.focus();
    } finally {
        unlockBtn.disabled = false;
        unlockBtn.textContent = i18n.t('unlock');
    }
}

function handleCancel() {
    hideModal(false);
}

export default { showPasswordModal };

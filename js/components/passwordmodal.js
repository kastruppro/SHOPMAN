import i18n from '../i18n.js';
import api from '../api.js';
import store from '../store.js';
import router from '../router.js';

let resolvePromise = null;
let currentListId = null;
let currentAction = 'view';

export function showPasswordModal(listId, action = 'view') {
    currentListId = listId;
    currentAction = action;

    const modal = document.getElementById('password-modal');
    const input = document.getElementById('password-input');
    const errorEl = document.getElementById('password-error');
    const messageEl = document.getElementById('modal-message');

    // Update message based on action
    messageEl.setAttribute('data-i18n', action === 'view' ? 'enterPasswordToAccess' : 'enterPasswordToEdit');
    messageEl.textContent = i18n.t(action === 'view' ? 'enterPasswordToAccess' : 'enterPasswordToEdit');

    // Reset state
    input.value = '';
    errorEl.classList.add('hidden');

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

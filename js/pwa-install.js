// PWA Install Banner Module
import i18n from './i18n.js';

let deferredPrompt = null;
let bannerElement = null;

// Check if app is already installed
function isAppInstalled() {
    // Check if running in standalone mode (installed PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }
    // iOS Safari standalone check
    if (window.navigator.standalone === true) {
        return true;
    }
    return false;
}

// Check if user has dismissed the banner recently (within 7 days)
function hasUserDismissedRecently() {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (!dismissed) return false;

    const dismissedTime = parseInt(dismissed, 10);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedTime < sevenDays;
}

// Create and show the install banner
function showInstallBanner() {
    if (bannerElement || isAppInstalled() || hasUserDismissedRecently()) {
        return;
    }

    bannerElement = document.createElement('div');
    bannerElement.id = 'pwa-install-banner';
    bannerElement.className = 'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-50 transform translate-y-full transition-transform duration-300';
    bannerElement.innerHTML = `
        <div class="max-w-lg mx-auto">
            <div class="flex items-start gap-3">
                <img src="/icons/icon-72.png" alt="SHOPMAN" class="w-12 h-12 rounded-xl shadow">
                <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-gray-800" data-i18n="installAppTitle">Installer SHOPMAN</h3>
                    <p class="text-sm text-gray-600 mt-0.5" data-i18n="installAppDesc">Få hurtigere adgang, offline support og push notifikationer</p>
                </div>
                <button id="pwa-install-close" class="text-gray-400 hover:text-gray-600 p-1">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="flex gap-2 mt-3">
                <button id="pwa-install-btn" class="flex-1 px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium text-sm">
                    <span data-i18n="installApp">Installer app</span>
                </button>
                <button id="pwa-install-later" class="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm">
                    <span data-i18n="later">Senere</span>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(bannerElement);
    i18n.updateDOM();

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            bannerElement.classList.remove('translate-y-full');
        });
    });

    // Install button click
    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user's response
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] Install prompt outcome:', outcome);

        // Clear the deferred prompt
        deferredPrompt = null;
        hideBanner();
    });

    // Close button click
    document.getElementById('pwa-install-close').addEventListener('click', () => {
        dismissBanner();
    });

    // Later button click
    document.getElementById('pwa-install-later').addEventListener('click', () => {
        dismissBanner();
    });
}

// Hide the banner (without remembering)
function hideBanner() {
    if (!bannerElement) return;

    bannerElement.classList.add('translate-y-full');
    setTimeout(() => {
        bannerElement?.remove();
        bannerElement = null;
    }, 300);
}

// Dismiss the banner (remember for 7 days)
function dismissBanner() {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    hideBanner();
}

// Initialize PWA install handling
function init() {
    // Don't show if already installed
    if (isAppInstalled()) {
        console.log('[PWA] App is already installed');
        return;
    }

    // Capture the install prompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('[PWA] beforeinstallprompt fired');

        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();

        // Save the event for later
        deferredPrompt = e;

        // Show our custom banner after a short delay
        setTimeout(() => {
            showInstallBanner();
        }, 2000);
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App was installed');
        hideBanner();
        deferredPrompt = null;
    });
}

export default { init };

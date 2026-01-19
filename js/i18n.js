import config from './config.js';

// Internationalization module
const i18n = {
    currentLang: config.defaultLanguage,
    translations: {},

    async init() {
        // Load saved language preference or use default from config
        const saved = localStorage.getItem('shopman-lang');
        if (saved && config.supportedLanguages.includes(saved)) {
            this.currentLang = saved;
        } else {
            this.currentLang = config.defaultLanguage;
        }

        await this.loadTranslations(this.currentLang);
    },

    async loadTranslations(lang) {
        try {
            const response = await fetch(`locales/${lang}.json`);
            this.translations = await response.json();
        } catch (error) {
            console.error('Failed to load translations:', error);
            // Fallback to English
            if (lang !== 'en') {
                await this.loadTranslations('en');
            }
        }
    },

    async setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('shopman-lang', lang);
        await this.loadTranslations(lang);
        this.updateDOM();
    },

    t(key) {
        // Support nested keys like "types.produce"
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                return key; // Return key if translation not found
            }
        }

        return value || key;
    },

    updateDOM() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });

        // Update all elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Update html lang attribute
        document.documentElement.lang = this.currentLang;
    },

    toggleLanguage() {
        const newLang = this.currentLang === 'en' ? 'da' : 'en';
        return this.setLanguage(newLang);
    }
};

export default i18n;

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SHOPMAN is a Progressive Web App (PWA) for shopping list management with offline support, password protection, bilingual support (Danish/English), and push notifications. Built with vanilla JavaScript (ES6 modules) and Tailwind CSS, deployed on GitHub Pages with Supabase backend.

## Common Commands

```bash
# Build CSS (required after Tailwind class changes)
npm run build:css

# Watch CSS during development
npm run dev

# Deploy Supabase edge functions
supabase functions deploy <function-name> --no-verify-jwt

# Push database migrations
supabase db push

# Set Supabase secrets
supabase secrets set KEY=value
```

## Architecture

### Frontend (Static, No Build for JS)
- **Entry:** `index.html` → `js/app.js`
- **Routing:** Hash-based (`/#/listName`) via `js/router.js`
- **State:** Observer pattern in `js/store.js`
- **i18n:** JSON files in `locales/`, DOM updates via `data-i18n` attributes
- **Offline:** IndexedDB (`js/db.js`) + sync queue (`js/sync.js`)
- **PWA:** Service worker (`sw.js`) with cache-first for static, network-first for API

### Backend (Supabase)
- **Database:** PostgreSQL with RLS policies (`supabase/schema.sql`)
- **Edge Functions:** Deno/TypeScript in `supabase/functions/`
  - `create-list` - List creation with password hashing
  - `verify-password` - Token generation (24h expiry)
  - `manage-items` - CRUD operations with token verification
  - `manage-list` - Password management, list deletion
  - `push-subscriptions` - Push notification subscriptions
  - `send-push-notification` - Server-side notification dispatch

### Key Patterns
- **Offline-first:** Operations queue locally, sync when online
- **Temporary IDs:** Items created offline use `temp_[timestamp]_[random]` format
- **Password tokens:** Base64-encoded JSON with list_id, action, expiration
- **Sync status:** Items track `synced`, `pending`, or `error` state

## File Organization

```
js/
├── app.js              # Entry point, initializes modules
├── api.js              # Supabase API client (contains project URL/keys)
├── db.js               # IndexedDB wrapper for offline storage
├── sync.js             # Online/offline sync engine
├── store.js            # State management
├── router.js           # Hash-based routing
├── i18n.js             # Internationalization
├── pwa-install.js      # Install banner logic
└── components/
    ├── homepage.js     # Home page UI
    ├── listpage.js     # Shopping list UI (largest file)
    └── passwordmodal.js

supabase/
├── schema.sql          # Database schema + RLS policies
├── push_notifications.sql
├── migrations/
└── functions/          # Edge functions (TypeScript)
```

## Service Worker Cache

Version format: `v0.x.x` in `sw.js` CACHE_VERSION. Update when static assets change.

Static cache includes: HTML, CSS, JS modules, locales, icons, manifest.

## Translations

Add new strings to both `locales/da.json` and `locales/en.json`. Use nested keys for categories (e.g., `types.produce`). Apply via `data-i18n` attribute or `i18n.t('key')`.

## Database Webhooks

Push notifications use Supabase Database Webhooks (configured in dashboard) to trigger `send-push-notification` edge function on `items` table changes.

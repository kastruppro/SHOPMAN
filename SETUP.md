# Shopping List App Setup Guide

## 1. Supabase Setup

### Create Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon key** from Settings > API

### Database Setup
1. Go to SQL Editor in Supabase dashboard
2. Run the contents of `supabase/schema.sql`

### Deploy Edge Functions
```bash
# Install Supabase CLI (macOS)
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy functions
supabase functions deploy create-list
supabase functions deploy verify-password
supabase functions deploy manage-items
```

## 2. Configure Frontend

Edit `js/api.js` and update:
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

## 3. Build CSS

```bash
npm install
npm run build:css
```

## 4. GitHub Pages Setup

1. Push to GitHub
2. Go to repository Settings > Pages
3. Set Source to "Deploy from a branch"
4. Select main branch and / (root) folder
5. (Optional) Add a CNAME file for custom domain

## Development

Watch CSS changes:
```bash
npm run watch:css
```

Serve locally (use any static server):
```bash
npx serve .
```

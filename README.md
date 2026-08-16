# Personal Finance Tracker — synced version

This version syncs your data across every device via a free Supabase backend:
sign in with the same email on your laptop and your phone, and you'll see the
same balances, transactions, and budgets on both — updates on one show up on
the other the next time that device loads or saves.

## 1. Create a free Supabase project

1. Go to https://supabase.com → sign up → "New project" (free tier is enough).
2. Once it's created, open **SQL Editor** in the sidebar, paste in the contents
   of `supabase-schema.sql` (included in this folder), and run it. This creates
   the table that stores your data and locks it so only you can read/write it.
3. Go to **Project Settings → API**. Copy the **Project URL** and the
   **anon public** key.

## 2. Connect the app to it

1. Copy `.env.example` to `.env`.
2. Paste in your Project URL and anon key:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
   (`.env` is gitignored, so these won't get committed if you push to GitHub.)

## 3. Run it locally to test

```bash
npm install
npm run dev
```

Open the app, sign up with an email + password (Supabase will send a
confirmation email — confirm it, then sign in). Add a transaction. That's your
data now living in Supabase, not just your browser.

## 4. Deploy it

### Vercel (recommended)
1. Push this folder to a GitHub repo.
2. Import it at https://vercel.com/new.
3. In the project's **Environment Variables** settings, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as your `.env`).
4. Deploy. You'll get a live URL.

### Netlify
1. `npm run build` locally to produce `dist/`.
2. Before that build, make sure your `.env` is filled in (Vite bakes env vars
   in at build time) — or set the same two variables under Netlify's
   **Site settings → Environment variables** and trigger a build from a
   connected GitHub repo instead of a manual drag-and-drop, since drag-and-drop
   skips the env-var step.

## 5. Install it on both devices

Once it's live at a URL:

**Laptop (Chrome/Edge):** open the URL → click the install icon in the address
bar → it opens in its own window like a native app.

**Android (Chrome):** open the URL → menu (⋮) → "Install app".

**iPhone (Safari):** open the URL → Share → "Add to Home Screen".

Sign in with the **same email and password** on both. From then on, both
devices read and write the same Supabase row — that's what makes them synced.

## How the sync actually works

- Every time the app loads, it fetches your data from Supabase.
- Every time you add/edit/delete something, it saves the whole updated state
  back to Supabase.
- There's no live push between devices — if you add a transaction on your
  phone, your laptop will see it the next time it loads the app (not
  instantly while both are open). For a finance tracker you check a few times
  a day, that's normally plenty. If you want instant live sync later, Supabase
  supports realtime subscriptions and I can wire that in too.

## Project structure

```
src/App.jsx            the whole app (all tabs, logic, styling) — unchanged
src/AuthGate.jsx        sign in / sign up screen, wraps App
src/supabaseClient.js   Supabase connection, reads .env
src/storage.js          same get/set API as before, now backed by Supabase
supabase-schema.sql     run once in Supabase's SQL editor
.env.example            copy to .env and fill in your project's credentials
```

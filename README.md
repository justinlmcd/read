# READ.

A book log. Title, author, a rating out of ten, whether you are reading it, finished it or want to, and the three things worth keeping from it: notes, takeaways or quotes. One page, your library in your own Supabase database.

## What's on the page

- **Reading now**: each book you're reading, with pages read out of its total (like **123 / 347 pages**), a completion bar, and how many pages you logged today. Press **Log pages +** to add today's reading.
- **Finished this year**, books you are reading now, finished all time, your average rating, and the want-to-read list.
- **Your coach**: press the button and Claude reads your titles, ratings and takeaways and tells you how your reading is going and what to pick up next. Nothing is sent until you press it. Needs `ANTHROPIC_API_KEY` in Vercel (and `ANTHROPIC_WORKSPACE_ID` if your key is organization-level).
- **Books finished per month** for the last year, and a spread of your ratings.
- **Library**: every book with its three takeaways, filterable by status and searchable across titles, authors and notes.

## Set up (about 10 minutes)

1. **Supabase.** Create a project at supabase.com (or reuse one you already have). In **SQL Editor**, paste the contents of [setup.sql](setup.sql) and click **Run**. Do this once.
2. **A login.** In **Authentication → Users**, click **Add user**, enter your email and a password, and tick **Auto confirm**. Skip if you already have a user on this project.
3. **Vercel.** Import this repository at vercel.com → Add New → Project. Framework preset **Other**, no build command, root directory blank.
4. **Environment variables** on that Vercel screen:
   - `SUPABASE_URL` → your project URL (Supabase → Connect dialog)
   - `SUPABASE_PUBLISHABLE_KEY` → the key starting `sb_publishable_`
   - `ANTHROPIC_API_KEY` → for the coach (optional; everything else works without it)
   - `ANTHROPIC_WORKSPACE_ID` → only if your Anthropic key is not scoped to a workspace
5. **Deploy.** Open the URL Vercel gives you, click **Sign in**, and add the last book you finished.

Vercel redeploys on every push to `main`.

## Pages and progress

Give a book its **Total pages** when you add or edit it, then press **Log pages +** each day and enter how many pages you read. The book's bar fills as you go, the log form previews where today's pages take you, and you can delete a wrong entry from the same form. When you reach the last page, the card offers **Mark finished ✓**.

If you set READ up before pages existed, run [pages.sql](pages.sql) once in the Supabase SQL editor. It adds the page count to your books and a `reading_log` table; your existing books stay as they are. Until then the page tells you to run it and everything else keeps working.

## Run locally

```
SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... node dev.js
```

Then open http://localhost:8802. The coach only runs on Vercel.

## What's in it

- `index.html` — the page and its styles
- `read.js` — sign-in, loading, the add/edit form, charts, and the library
- `coach.js` and `api/coach.mjs` — the coach card and the Vercel function behind it
- `quote-of-day.js` — a quote that changes at local midnight
- `api/config.js` — hands the two public Supabase settings to the page
- `setup.sql` — the `books` and `reading_log` tables, locked to each user by row-level security
- `pages.sql` — adds page tracking to a READ set up before it existed

## Add to your iPhone home screen

Open the site in Safari, tap Share, then **Add to Home Screen**.

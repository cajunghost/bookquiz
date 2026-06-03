# BookQuiz

Reading-comprehension quizzes for **any book**, tuned to a **K–12 grade level**, with a
selectable number of questions (**5, 10, 25, or 50**). Type a title or ISBN, pick a
grade and length, and get a multiple-choice quiz with an answer key, explanations, and
a comprehension-skill tag on every question.

It runs **entirely in your browser** and is hosted on **GitHub Pages** — there is no
backend. You bring a **free Google AI Studio (Gemini) key** (one-minute setup, no
billing); it's stored only on your device. As you type, an autocomplete dropdown searches
open book databases (**Open Library**, **Google Books**, **Project Gutenberg**); pick a
result or paste an ISBN, choose a grade and length, and get a quiz. Public-domain
(Project Gutenberg) books are grounded in the book's **actual text** for maximum accuracy.

### Step 1 — Add your free Google AI Studio (Gemini) key (required)

Quizzes are generated with your own **free** Google AI Studio key. It's stored **only in
your browser** and sent directly to Google — never to any server. Open **“Your Google AI
Studio key”** at the top of the app to add it.

**Get a free key (~1 minute):**

1. Go to <https://aistudio.google.com/apikey> and sign in with a Google account.
2. Click **Create API key** (accept the terms if prompted).
3. Choose or create a project if asked, then **Create**.
4. Copy the key (starts with `AIza…`), paste it into the app, and **Save key**.

The free tier requires no billing. (Using your own key avoids the rate-limit and "busy"
errors that a shared service runs into.)

### Step 2 — Create a quiz

1. **Search for a book** — type a title or author in the search box and pick from the
   dropdown (Open Library / Google Books / Project Gutenberg), or paste an ISBN.
2. **Choose a grade level** (K–12) and **how many questions** (5/10/25/50).
3. Tap **Generate quiz**, answer the questions, and **Submit** to see your score,
   explanations, and points.
4. Use the **⚑ Report** button under any question to flag inaccuracies — future quizzes
   for that book will avoid them.

Books with a **“Free text”** badge use the book’s actual public-domain text, so their
quizzes are the most accurate.

### Book sources (free & open)

The autocomplete searches several open catalogs in parallel and merges the results
(editions of the same title collapse together):

- **Open Library** (openlibrary.org) — the full ~20M-record catalog.
- **Google Books** — broad coverage of recent and popular titles.
- **Project Gutenberg** via the **Gutendex** API — free public-domain books; these are
  flagged **"Free text"** and are the most reliable for quiz generation.

All book searches are free and need no key. If one source is rate-limited or down, the
others still return results.

### Quiz generation

Quizzes are written by **Google Gemini** (`gemini-2.5-flash`) using your own free key,
called directly from the browser with JSON-schema structured output. For public-domain
books, the prompt is grounded in a real excerpt of the book's text.

## Live site

**https://cajunghost.github.io/bookquiz/**

> **The site only loads if this repository is Public.** GitHub Pages on the free plan
> will not serve a private repo. If the URL 404s, see **Make it live** below.

## Make it live (one-time, owner only)

GitHub Pages publishing depends on repo settings that can only be changed by the repo
owner in the GitHub UI:

1. **Make the repo Public** — repo **Settings → General → Danger Zone → Change repository
   visibility → Public**. (Required for free-tier Pages.)
2. **Set the Pages source to GitHub Actions** — repo **Settings → Pages → Build and
   deployment → Source: GitHub Actions**. This is the critical one (see Troubleshooting).
3. **Let the deploy run** — the workflow (`.github/workflows/deploy.yml`) builds and
   publishes on every push to `main` and turns Pages on automatically
   (`configure-pages` with `enablement: true`). If no green run appears, open the
   **Actions** tab → **Deploy to GitHub Pages** → **Run workflow**.

Then the site is live at `https://cajunghost.github.io/bookquiz/` (first publish ~1–2 min).

## Troubleshooting

**The Actions run is green but the site is a white/blank page.**
This means GitHub Pages is serving the repository's *source* `index.html` (which loads
`/src/main.jsx`, a dev-only file that doesn't exist in production) instead of the *built*
site from the Actions artifact. Fix it in **Settings → Pages → Build and deployment** by
setting **Source: GitHub Actions** (not "Deploy from a branch"). Re-run the workflow if
needed. When Pages serves the built artifact, `index.html` loads `/bookquiz/assets/*.js`
and the app renders.

**404 at the domain.** The repo is still Private, or no successful deploy has run yet.
See "Make it live" above.

## Develop locally

```bash
npm install
npm run dev      # http://localhost:5173
```

No `.env` or backend needed. Add your free Gemini key in the app's key panel to generate.

```bash
npm run build    # outputs static site to dist/
npm run preview  # serve the built site locally
```

## How questions are grounded

For **public-domain** books (Project Gutenberg), the prompt is grounded in an excerpt of
the book's **actual full text**. For other books, the AI works from metadata
(descriptions, subjects, opening lines) plus its knowledge of the work; full copyrighted
text is not retrieved. A "source note" on each quiz states what it was based on, and the
**⚑ Report** button feeds inaccurate questions back into future prompts. **Review
questions for accuracy before classroom use.**

## Project layout

```
index.html               Vite entry
vite.config.js           base path = /bookquiz/ for Pages
public/
  manifest.webmanifest   PWA manifest
  sw.js                  Offline app-shell service worker
  icon.svg, icon-*.png   App icons (maskable)
  .nojekyll
src/
  main.jsx               React entry (+ error boundary, #root guard, SW register)
  App.jsx                account bar + key gate + search → generate → quiz flow
  gradeLevels.js         K-12 levels + per-band comprehension guidance
  bookSearch.js          Autocomplete: Open Library + Google Books + Gutenberg
  bookLookup.js          Resolve a typed title/ISBN
  quizCore.js            Shared prompt (+ feedback injection), JSON parse, normalize
  gemini.js              Google Gemini call (user's key)
  aiProvider.js          Key-gated generation + Gutenberg text grounding
  gutenberg.js           Fetch public-domain text excerpt for grounding
  gamification.js        Points tiers, levels, badge catalog
  store.js               Local-first accounts, points, history, feedback, API key
  components/            KeySettings, HowToUse, BookSearch, BookCard, Quiz, ScoreResult, AccountBar, ProfilePanel
  styles.css
.github/workflows/
  deploy.yml             build + publish to GitHub Pages on push to main
```

## Accounts, points & badges

- **Profiles** are created with just a name and saved **on the device** (localStorage) —
  no password or email. Switch between profiles from the account menu.
- **Points** are awarded per quiz by score tier: **70% → +25, 80% → +40, 90% → +60,
  100% → +100** (base, at 10 questions), scaled up to ~2× for a 50-question quiz; below
  70% earns a small consolation.
- **Levels** (Page Turner → Literary Legend) advance as points accumulate, with a
  progress bar to the next level.
- **Badges** unlock for milestones (first pass, perfect score, 5/10 passed, 3-in-a-row
  streak, 50-question pass, reaching Level 5, …).
- **History** of every attempt (book, score, grade, points) is shown in the profile sheet.

> Cross-device note: because storage is local, points/history live per browser/device.
> The data model is backend-ready, so a future sync service could share them across
> devices without changing the UI.

## Improving accuracy (feedback)

After submitting, each question has a **⚑ Report this question** control. Flagging a
question (e.g. "Not in the book") stores that feedback per book and **feeds it back into
the generation prompt** next time — the model is explicitly told which questions were
inaccurate and to ground harder. This is in-context learning per book (it does not
retrain model weights); collected feedback is structured so it could later seed a
fine-tuning/evaluation set.

## Install as an app (PWA)

The site is a installable **Progressive Web App** — it ships a web manifest, icons, and
an offline app-shell service worker. On Android/desktop Chrome use **Install app**; on
iOS Safari use **Share → Add to Home Screen**. It then launches full-screen like a native
app.

### Packaging for the App Store / Play Store

Because it's a standards-based PWA, it can be wrapped for the native stores with
[Capacitor](https://capacitorjs.com/) without rewriting the UI:

```bash
npm i -D @capacitor/cli @capacitor/core
npx cap init BookQuiz com.example.bookquiz --web-dir=dist
npm i @capacitor/ios @capacitor/android
npm run build && npx cap add ios && npx cap add android && npx cap sync
npx cap open ios   # or android — build/submit from Xcode / Android Studio
```

(Native packaging is a local/Xcode/Android-Studio step and is intentionally not part of
the GitHub Pages deploy.)

## Tech

React + Vite, deployed as a static site to GitHub Pages. **AI:** Google Gemini
(`gemini-2.5-flash`) via the user's own free key, with Project Gutenberg full-text
grounding. Book data: Open Library, Google Books, and Project Gutenberg (Gutendex) —
all called directly from the browser.

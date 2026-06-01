# BookQuiz

Reading-comprehension quizzes for **any book**, tuned to a **K–12 grade level**, with a
selectable number of questions (**5, 10, 25, or 50**). Type a title or ISBN, pick a
grade and length, and get a multiple-choice quiz with an answer key, explanations, and
a comprehension-skill tag on every question.

It runs **entirely in your browser** and is hosted on **GitHub Pages** — there is no
backend and **no API key or sign-up of any kind**. As you type, an autocomplete dropdown
searches open book databases (**Open Library** + **Project Gutenberg**); pick a result or
paste an ISBN, choose a grade and length, and get a quiz.

### How quizzes are generated (keyless)

No key is required. The app generates a quiz in this order:

1. **Free AI endpoint** — questions are written by a free, no-key LLM service
   (**Pollinations**), called directly from the browser. Works for any book.
2. **Public-domain grounding** — when the book is on **Project Gutenberg**, its real
   full text is fetched and an excerpt is fed to the model so questions are grounded in
   the actual words of the book.
3. **Algorithmic fallback (no AI)** — if the free AI service is unavailable and the book
   is public-domain, the app builds vocabulary-in-context questions deterministically
   from the real text. This path can't rate-limit or go down.

> Because the free AI endpoint is a shared community service, generation can occasionally
> be slow or busy — just retry. Public-domain (Project Gutenberg) titles are the most
> reliable since they have the no-AI fallback.

### Book sources (free & open)

The autocomplete searches several open catalogs in parallel and merges the results
(editions of the same title collapse together):

- **Open Library** (openlibrary.org) — the full ~20M-record catalog.
- **Google Books** — broad coverage of recent and popular titles.
- **Project Gutenberg** via the **Gutendex** API — free public-domain books; these are
  flagged **"Free text"** and are the most reliable for quiz generation.

All are queried directly from the browser with no API key. If one source is rate-limited
or down, the others still return results.

### Quiz models (free & keyless)

Generation tries several free, no-key models in turn (via Pollinations) across two
transports, so a single busy model doesn't fail the request — then falls back to the
deterministic public-domain text path described above.

## Live site

**https://cajunghost.github.io/bookquiz/**

> **The site only loads if this repository is Public.** GitHub Pages on the free plan
> will not serve a private repo. If the URL 404s, see **Make it live** below.

## Use it

1. Open the site.
2. Type a book title or author — pick from the autocomplete dropdown (or paste an ISBN).
3. Choose a grade level and question count.
4. **Generate**, answer the questions, and review your score with per-question explanations.


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

No `.env`, key, or backend needed.

```bash
npm run build    # outputs static site to dist/
npm run preview  # serve the built site locally
```

## How questions are grounded

For **public-domain** books (Project Gutenberg), questions draw on the book's **actual
full text** — either fed to the AI as an excerpt, or used to build questions
algorithmically with no AI at all. For other books, the AI works from metadata
(descriptions, subjects, opening lines) plus its knowledge of the work; full copyrighted
text is not retrieved. A "source note" on each quiz states what it was based on. **Review
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
  App.jsx                account bar + search → generate → quiz flow (no key)
  gradeLevels.js         K-12 levels + per-band comprehension guidance
  bookSearch.js          Autocomplete: Open Library + Google Books + Gutenberg
  bookLookup.js          Resolve a typed title/ISBN
  quizCore.js            Shared prompt (+ feedback injection), JSON parse, normalize
  aiProvider.js          Keyless generation: parallel model race + Gutenberg fallback
  gutenberg.js           Fetch public-domain text; algorithmic (no-AI) quiz
  gamification.js        Points tiers, levels, badge catalog
  store.js               Local-first accounts, points, history, feedback
  components/            BookSearch, BookCard, Quiz, ScoreResult, AccountBar, ProfilePanel
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

React + Vite, deployed as a static site to GitHub Pages. **Keyless AI:** Pollinations
(free, no-key LLM) with a deterministic Project Gutenberg full-text fallback. Book data:
Open Library, Project Gutenberg (Gutendex), and Google Books — all called directly from
the browser with no key.

# BookQuiz

Reading-comprehension quizzes for **any book**, tuned to a **K–12 grade level**, with a
selectable number of questions (**5, 10, 25, or 50**). Type a title or ISBN, pick a
grade and length, and get a multiple-choice quiz with an answer key, explanations, and
a comprehension-skill tag on every question.

It runs **entirely in your browser** and is hosted on **GitHub Pages** — there is no
backend. Book metadata comes from Google Books + Open Library; questions are generated
by **Google Gemini** using a **free** API key you paste in (stored only in your browser,
sent directly to Google).

## Live site

**https://cajunghost.github.io/bookquiz/**

> **The site only loads if this repository is Public.** GitHub Pages on the free plan
> will not serve a private repo. If the URL 404s, see **Make it live** below.

## Use it

1. Get a free Gemini key at **https://aistudio.google.com/apikey** (Google account, no billing).
2. Open the site, paste the `AIza…` key into the key box.
3. Enter a book title or ISBN, choose a grade level and question count, **Find book**, then **Generate**.
4. Answer the questions, submit, and review your score with per-question explanations.

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

Paste your free Gemini key in the UI. No `.env` or backend needed.

```bash
npm run build    # outputs static site to dist/
npm run preview  # serve the built site locally
```

## How questions are grounded

Quizzes are generated from book **metadata** (publisher descriptions, subjects, opening
lines) plus the model's knowledge of the work — full copyrighted text is not retrieved.
The prompt instructs the model to keep every question grounded in the book and to note in
a "source note" when it is working mainly from a summary. **Review questions for accuracy
before classroom use.**

## Project layout

```
index.html               Vite entry
vite.config.js           base path = /bookquiz/ for Pages
src/
  main.jsx               React entry
  App.jsx                key → search → resolve → generate → quiz flow
  gradeLevels.js         K-12 levels + per-band comprehension guidance
  bookLookup.js          Google Books + Open Library lookup and merge
  gemini.js              Gemini call: prompt, JSON schema, normalize
  components/            BookCard, Quiz
  styles.css
.github/workflows/
  deploy.yml             build + publish to GitHub Pages on push to main
```

## Tech

React + Vite, deployed as a static site to GitHub Pages. AI: Google Gemini
(`gemini-2.5-flash`, free tier) with JSON-schema structured output. Book data: Google
Books + Open Library, called directly from the browser.

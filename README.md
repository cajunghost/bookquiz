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

- **Open Library** (openlibrary.org) — the full ~20M-record catalog, used for the
  autocomplete search and metadata (covers, subjects, first lines, ISBNs).
- **Project Gutenberg** via the **Gutendex** API — free public-domain books; matching
  titles are flagged **"Free text"** in the dropdown.
- **Google Books** — additional metadata when resolving a typed title/ISBN.

All are queried directly from the browser with no API key.

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
src/
  main.jsx               React entry (+ error boundary, #root guard)
  App.jsx                search → resolve → generate → quiz flow (no key)
  gradeLevels.js         K-12 levels + per-band comprehension guidance
  bookSearch.js          Autocomplete search: Open Library + Project Gutenberg
  bookLookup.js          Resolve a typed title/ISBN: Google Books + Open Library
  quizCore.js            Shared prompt, JSON extraction, normalizer
  aiProvider.js          Keyless generation: Pollinations + Gutenberg fallback
  gutenberg.js           Fetch public-domain text; algorithmic (no-AI) quiz
  components/            BookSearch (autocomplete), BookCard, Quiz
  styles.css
.github/workflows/
  deploy.yml             build + publish to GitHub Pages on push to main
```

## Tech

React + Vite, deployed as a static site to GitHub Pages. **Keyless AI:** Pollinations
(free, no-key LLM) with a deterministic Project Gutenberg full-text fallback. Book data:
Open Library, Project Gutenberg (Gutendex), and Google Books — all called directly from
the browser with no key.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A static, no-build set of HTML quiz pages for studying the Ukrainian PDR (traffic rules) theory exam, authored as skalse-way. `index.html` (repo root) is a topic picker linking to 41 `src/tests/quiz_NN_<slug>.html` files (39 official PDR test topics; topics 08 and 16 are each split into `_1`/`_2` variants, hence 41 files). All page content and copy is in Ukrainian.

There is no package.json, build step, linter, or test suite — these are plain HTML files with `<script src>` references to plain `.js` files, no bundler.

**Local file:// opens are unreliable — prefer the deployed GitHub Pages URL.** Firefox treats `file://` pages as an opaque origin, where `localStorage` throws on every read/write, so progress/best-score/status silently never persist there (every localStorage call is wrapped in a silent `try/catch`). Chrome happens to special-case `file://` and works locally, but the reliable way to use this site is the deployed GitHub Pages URL (`https://brizzinck.github.io/skalse-way/`), which is a real `https://` origin and works in every browser.

## Directory layout

- `index.html` — topic picker, stays at repo root
- `mistakes.html` — cross-topic "робота над помилками" blitz page, stays at repo root next to `index.html` (see below)
- `exam.html` — stratified-sampling exam simulator, stays at repo root (see below)
- `src/tests/quiz_NN_<slug>.html` — the 41 quiz pages (moved out of root for readability; only `index.html`/`mistakes.html`/`exam.html` live at top level)
- `src/data/<topicId>.json` — the question bank, one file per topic id (e.g. `src/data/08_1.json`), fetched at runtime (see below)
- `src/scripts/` — shared JS, plain `<script src="...">` includes, no bundler:
  - `theme-init.js` — applies the saved theme before first paint (in `<head>`, to avoid a flash of the wrong theme)
  - `theme-toggle.js` — wires the light/dark toggle button, used by every page
  - `topic-loader.js` — the single place that knows how to fetch a topic's question bank (see below); loaded by every quiz page, `mistakes.html`, and `exam.html`
  - `quiz-engine.js` — the actual quiz engine, shared by all 41 quiz pages (see below)
  - `index-status.js` — computes each topic card's status pill + the overall progress bar on `index.html`, plus the "Робота над помилками" card's live count and the "Екзаменаційний тест" card's last-result pill
  - `mistakes-store.js` — shared cross-topic mistakes store (see below), loaded by every quiz page, by `index.html`, by `mistakes.html`, and by `exam.html`
  - `mistakes-blitz.js` — the blitz engine for `mistakes.html` (see below)
  - `topics-data.js` — the single source of truth for all 41 topic ids → Ukrainian titles; loaded by `mistakes-blitz.js` (for the topic-selection checkboxes) — `exam.html` doesn't need it, since its category titles already live in `exam-categories.js`
  - `exam-categories.js` — the stratified-sampling exam config (see below): category → topic-id list → weight, plus `TOTAL`/`MAX_WRONG_TO_PASS`/`TIME_LIMIT_SEC`/`RECENT_EXAMS_TO_AVOID`
  - `exam-engine.js` — the exam engine for `exam.html` (see below)
- `src/styles/quiz.css` — shared stylesheet for all 41 quiz pages, linked via `<link rel="stylesheet" href="../styles/quiz.css">`. `index.html` keeps its own separate inline `<style>` block (not shared with the quiz pages).
- `photos/` — source images, not a runtime asset (see below)

### Question bank: one JSON file per topic, fetched on demand (`src/data/`, `src/scripts/topic-loader.js`)
The question bank used to be inlined as a `<script type="application/json" id="quiz-data">` blob directly inside each `src/tests/quiz_*.html` file (up to ~2.9MB per file, since each question's image is a base64 data URI). It now lives in one standalone `src/data/<topicId>.json` file per topic — a plain JSON array, same shape as before, nothing else in the file — and every quiz page fetches its own file at runtime instead of embedding it. This shrank each quiz page from up to ~2.9MB down to ~5KB of markup, and let `mistakes.html`/`exam.html` fetch a topic's questions directly as JSON instead of the old workaround of fetching a full quiz page's HTML and picking the data blob out of it with `DOMParser`.

`topic-loader.js` is the shared fetch+cache for this: `window.PDRTopicLoader.loadTopic(topicId)` returns a (cached-after-first-call) `Promise` of that topic's question array, fetching `(window.PDR_DATA_BASE || 'src/data/') + topicId + '.json'`. Each page sets `PDR_DATA_BASE` to whatever relative path reaches `src/data/` from where it lives — quiz pages (under `src/tests/`) set it to `'../data/'`, `mistakes.html`/`exam.html` (at repo root) set it to `'src/data/'` — right next to their own `PDR_TOPIC_ID`/script includes:
```html
<script>window.PDR_TOPIC_ID = '01'; window.PDR_DATA_BASE = '../data/';</script>
<script src="../scripts/topic-loader.js"></script>
<script src="../scripts/quiz-engine.js"></script>
```
Because loading is now async, `quiz-engine.js` fires the fetch immediately on load and keeps a `dataReady` promise; anything that touches `QUESTIONS`/`TOTAL`/`QMAP` (starting/resuming/retrying a quiz, list mode, validating saved progress) is chained off `dataReady` rather than assumed to be ready synchronously. This only works over `http(s)://`, not `file://` (see the `file://` caveat above) — same constraint the exam/blitz fetches already had.

`quiz.css` deliberately uses a large type/spacing scale (question text, options, images, buttons all sized up) so the quiz is fully readable on both desktop and phone without pinch-zooming; when adjusting it, check both a ~1440px desktop width and a ~390px phone width for horizontal overflow or clipped content before treating a change as done.

### Question data shape
Each entry in a `src/data/<topicId>.json` array looks like:
```json
{"id":1,"text":"...","hasImage":true,"options":[{"letter":"а","text":"...","correct":false}, ...],"explanation":"...","image":"data:image/webp;base64,..."}
```
`letter` (`а`/`б`/`в`/`г`...) is only an internal identifier now, used to match a selected option back to the correct one — every page displays a 1-based position number instead (`options.forEach(function(opt, idx){...(idx+1)...})`), not the letter, since some official explanations already refer to options by number ("у пунктах 1 та 2") rather than by letter. Images are embedded directly as base64 data URIs inside the JSON — there is no runtime reference to the `photos/` folder from the HTML or JSON.

### `photos/` is source material, not a runtime asset
`photos/<topic_slug>/<question_id>.webp` holds the original per-question images (e.g. `photos/33_all_road_signs/05.webp`), keyed by question id/number and named to match the corresponding topic's slug. These are the pre-embedding source files used to produce the `image` base64 data URIs baked into each topic's `src/data/<topicId>.json` — nothing loads from `photos/` directly at runtime. When adding or updating a question's image, update both the file in `photos/` and the corresponding base64 `image` value in that topic's data file.

### Quiz engine (`src/scripts/quiz-engine.js`)
Fetches its topic's question bank via `PDRTopicLoader.loadTopic`, then drives three views (`view-start`, `view-quiz`, `view-summary`) plus a `view-list` (full topic review with collapsible explanations). Key functions: `startQuiz`/`renderQuestion`/`selectOption`/`finishQuiz` for the quiz flow, `resumeQuiz` to continue a saved in-progress attempt, `renderList` for the browsable list view.

### localStorage keys
For a given page's `PDR_TOPIC_ID` (e.g. `01`, `08_1`, `16_2`):
- `pdr_t<ID>_best_v1` — best score `{score, total, date}`
- `pdr_t<ID>_progress_v1` — in-progress attempt `{orderIds, answers, qi, date}`, written on every answer/next/back, cleared on finish; lets a quiz resume after closing the tab (subject to the `file://`/Firefox caveat above)

### Cross-topic mistakes store (`src/scripts/mistakes-store.js`) + blitz page (`mistakes.html`)
Every wrong answer, on any of the 41 quiz pages, is recorded into one shared localStorage key `pdr_mistakes_v1` — a JSON array of lean entries `{topicId, qid, correctStreak}`, nothing else. In particular there's no embedded question snapshot: whatever needs to actually render a mistake's text/options/explanation (currently just `mistakes.html`) fetches it from `src/data/<topicId>.json` via `PDRTopicLoader.loadTopic` and looks the question up by id — the store itself stays a tiny, disposable index, not a second copy of the question bank. `quiz-engine.js`'s `selectOption` calls `PDRMistakes.recordWrong(topicId, qid)` on every wrong answer (never on a normal quiz's correct answer).

`mistakes.html` (root-level, own JS at `src/scripts/mistakes-blitz.js`, reuses `quiz.css`) is the "робота над помилками" blitz: pick "all" or specific topics via checkboxes (counts come straight from `PDRMistakes.byTopic()`), then on "Почати бліц" it loads (with a small "Завантаження питань…" state) every topic id referenced by the selected mistakes via the shared loader, maps each `{topicId, qid}` entry to its actual question, and runs a quiz over that in-memory list — dropping (and pruning from the store via `removeEntry`) any entry whose question no longer exists in the bank. Answering a pooled question correctly calls `PDRMistakes.recordCorrect(topicId, qid)`, which increments that entry's `correctStreak`; reaching `MASTERY_STREAK` (4, i.e. more than 3 correct in a row) deletes the entry from the pool entirely. A wrong answer anywhere (including inside the blitz itself) calls `recordWrong` again, which resets `correctStreak` back to 0 — so mastery requires 4 *consecutive* correct answers, and one slip-up starts that streak over. Only the blitz page ever calls `recordCorrect`; normal topic quizzes only ever add to the pool, never remove from it.

`index.html` links to `mistakes.html` via a `#mistakes-card` banner above the topic grid; `index-status.js` fills in its live count from `PDRMistakes.count()`.

### Exam simulator (`exam.html` + `src/scripts/exam-engine.js` + `exam-categories.js`)
Models the real category-B theory exam: a fixed **20-question, 20-minute, stratified** draw (`PDR_EXAM_CONFIG` in `exam-categories.js` — 11 hand-picked categories, each a Ukrainian title + a list of topic ids + an integer weight; the weights sum to `TOTAL` and every one of the 41 topic ids appears in exactly one category, which a `console.warn` in that file's own IIFE would catch if a future edit broke either invariant). On "Почати іспит" it loads whatever topic ids it needs through the same shared `PDRTopicLoader.loadTopic` as everything else, in parallel, with a live "Завантаження банку питань… X/Y" counter.

To keep that fetch count bounded (a category like `docsAndSpecial` lists 9 topic ids for a weight of just 1), a category doesn't pool every one of its topics — it randomly picks `min(weight, topics.length)` distinct topics each time an exam is built, spreads the weight as evenly as possible across just those, and draws that many *distinct* questions from each (shuffle + slice, so no repeats within one exam). This also means which specific topic represents a multi-topic category varies exam to exam. The 20 picks across all categories are then shuffled once more so the exam doesn't run in category blocks.

The exam itself is deliberately blind, unlike every other quiz on the site: selecting an option just highlights it (`.opt.selected`, no correct/wrong reveal, no explanation), answers stay changeable, and a question-number grid (`#qgrid`) lets you jump anywhere — all matching real exam UX. Nothing is scored until you finish (early via "Завершити достроково", automatically when the 20-minute countdown hits 0, or after question 20), at which point `MAX_WRONG_TO_PASS` (2) decides pass/fail, an unanswered question counts as wrong, every wrong question is fed into the same `PDRMistakes.recordWrong` store the rest of the site uses, and a full per-question review (reusing the `.litem` list-mode styles from `quiz.css`) is rendered. The last result persists to `pdr_exam_last_v1` (read by `index.html`'s `#exam-last-pill`), and the just-used question keys are appended to a capped rolling history at `pdr_exam_recent_v1` (`RECENT_EXAMS_TO_AVOID` entries) that later exam builds try to exclude first, falling back to the full pool if excluding would leave too few questions — a lightweight stand-in for the fuller spaced-repetition weighting described as optional/future work.

### `index.html`
Static list of topic cards (`data-topic="<ID>"`, matching each quiz page's `PDR_TOPIC_ID`) with Ukrainian title, question count, and a status pill. It is hand-maintained, not generated — question counts must be updated manually here when topics change. The status pill and overall progress bar are computed at runtime by `src/scripts/index-status.js`, reading the same `pdr_t<ID>_best_v1`/`_progress_v1` keys as the quiz engine.

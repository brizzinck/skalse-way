# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A static, no-build set of HTML quiz pages for studying the Ukrainian PDR (traffic rules) theory exam. `index.html` (repo root) is a topic picker linking to 41 `src/tests/quiz_NN_<slug>.html` files (39 official PDR test topics; topics 08 and 16 are each split into `_1`/`_2` variants, hence 41 files). All page content and copy is in Ukrainian; question/answer/explanation text is sourced from pdr-online.com.ua.

There is no package.json, build step, linter, or test suite — these are plain HTML files with `<script src>` references to plain `.js` files, no bundler.

**Local file:// opens are unreliable — prefer the deployed GitHub Pages URL.** Firefox treats `file://` pages as an opaque origin, where `localStorage` throws on every read/write, so progress/best-score/status silently never persist there (every localStorage call is wrapped in a silent `try/catch`). Chrome happens to special-case `file://` and works locally, but the reliable way to use this site is the deployed GitHub Pages URL (`https://brizzinck.github.io/skalse-way/`), which is a real `https://` origin and works in every browser.

## Directory layout

- `index.html` — topic picker, stays at repo root
- `src/tests/quiz_NN_<slug>.html` — the 41 quiz pages (moved out of root for readability; only `index.html` lives at top level)
- `src/scripts/` — shared JS, plain `<script src="...">` includes, no bundler:
  - `theme-init.js` — applies the saved theme before first paint (in `<head>`, to avoid a flash of the wrong theme)
  - `theme-toggle.js` — wires the light/dark toggle button, used by every page
  - `quiz-engine.js` — the actual quiz engine, shared by all 41 quiz pages (see below)
  - `index-status.js` — computes each topic card's status pill + the overall progress bar on `index.html`
- `photos/` — source images, not a runtime asset (see below)

### Quiz pages: shared engine, per-page data
Each `src/tests/quiz_*.html` inlines only what's genuinely per-page: CSS in a `<style>` block and the question bank as a JSON blob in `<script type="application/json" id="quiz-data">`. The quiz engine logic itself is **not** duplicated — every quiz page loads the same `../scripts/quiz-engine.js`. A page identifies itself to the shared engine with a one-line inline script right before that include:
```html
<script>window.PDR_TOPIC_ID = '01';</script>
<script src="../scripts/quiz-engine.js"></script>
```
`PDR_TOPIC_ID` must match the file's own topic id (e.g. `08_1` for `quiz_08_1_traffic_light_signals.html`) — the engine builds its localStorage keys from it (`pdr_t<PDR_TOPIC_ID>_best_v1`, `pdr_t<PDR_TOPIC_ID>_progress_v1`). Because the engine is shared, a bug fix or restyle to the quiz flow only needs to happen once in `quiz-engine.js`, not across 41 files — this replaced an earlier fully-duplicated-per-file setup where a hardcoded `LS_KEY` had caused all topics to clobber the same best-score entry.

### Question data shape
Each entry in the `quiz-data` JSON array looks like:
```json
{"id":1,"text":"...","hasImage":true,"options":[{"letter":"а","text":"...","correct":false}, ...],"explanation":"...","image":"data:image/webp;base64,..."}
```
Images are embedded directly as base64 data URIs inside the JSON — there is no runtime reference to the `photos/` folder from the HTML.

### `photos/` is source material, not a runtime asset
`photos/<topic_slug>/<question_id>.webp` holds the original per-question images (e.g. `photos/33_all_road_signs/05.webp`), keyed by question id/number and named to match the corresponding quiz page's topic slug. These are the pre-embedding source files used to produce the `image` base64 data URIs baked into each quiz file's JSON — the HTML pages never load from `photos/` directly. When adding or updating a question's image, update both the file in `photos/` and the corresponding base64 `image` value in that quiz file's JSON blob.

### Quiz engine (`src/scripts/quiz-engine.js`)
Reads `#quiz-data`, then drives three views (`view-start`, `view-quiz`, `view-summary`) plus a `view-list` (full topic review with collapsible explanations). Key functions: `startQuiz`/`renderQuestion`/`selectOption`/`finishQuiz` for the quiz flow, `resumeQuiz` to continue a saved in-progress attempt, `renderList` for the browsable list view.

### localStorage keys
For a given page's `PDR_TOPIC_ID` (e.g. `01`, `08_1`, `16_2`):
- `pdr_t<ID>_best_v1` — best score `{score, total, date}`
- `pdr_t<ID>_progress_v1` — in-progress attempt `{orderIds, answers, qi, date}`, written on every answer/next/back, cleared on finish; lets a quiz resume after closing the tab (subject to the `file://`/Firefox caveat above)

### `index.html`
Static list of topic cards (`data-topic="<ID>"`, matching each quiz page's `PDR_TOPIC_ID`) with Ukrainian title, question count, and a status pill. It is hand-maintained, not generated — question counts must be updated manually here when topics change. The status pill and overall progress bar are computed at runtime by `src/scripts/index-status.js`, reading the same `pdr_t<ID>_best_v1`/`_progress_v1` keys as the quiz engine.

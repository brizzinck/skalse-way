# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A static, no-build set of self-contained HTML quiz pages for studying the Ukrainian PDR (traffic rules) theory exam. `index.html` is a topic picker linking to 41 `quiz_NN_<slug>.html` files (39 official PDR test topics; topics 08 and 16 are each split into `_1`/`_2` variants, hence 41 files). All page content and copy is in Ukrainian; question/answer/explanation text is sourced from pdr-online.com.ua.

There is no package.json, build step, linter, or test suite — these are plain HTML files opened directly in a browser (`file://` works fine, no server needed).

## Architecture

### Each quiz file is fully self-contained
Every `quiz_*.html` inlines everything it needs: CSS in a `<style>` block, the question bank as a JSON blob in `<script type="application/json" id="quiz-data">`, and the quiz engine in a single IIFE `<script>` at the bottom of the file. There are no shared `.css`/`.js` files — CSS and engine code are duplicated verbatim across all 41 files. When fixing a bug in the quiz engine or restyling, the change must be repeated in every `quiz_*.html` (or scripted across all of them) rather than edited once.

### Question data shape
Each entry in the `quiz-data` JSON array looks like:
```json
{"id":1,"text":"...","hasImage":true,"options":[{"letter":"а","text":"...","correct":false}, ...],"explanation":"...","image":"data:image/webp;base64,..."}
```
Images are embedded directly as base64 data URIs inside the JSON — there is no runtime reference to the `photos/` folder from the HTML.

### `photos/` is source material, not a runtime asset
`photos/<topic_slug>/<question_id>.webp` holds the original per-question images (e.g. `photos/33_all_road_signs/05.webp`), keyed by question id/number and named to match the corresponding `quiz_*.html`'s topic slug. These are the pre-embedding source files used to produce the `image` base64 data URIs baked into each quiz file's JSON — the HTML pages never load from `photos/` directly. When adding or updating a question's image, update both the file in `photos/` and the corresponding base64 `image` value in that quiz file's JSON blob.

### Quiz engine (per file, in the trailing `<script>`)
Reads `#quiz-data`, then drives three views (`view-start`, `view-quiz`, `view-summary`) plus a `view-list` (full topic review with collapsible explanations). Key functions: `startQuiz`/`renderQuestion`/`selectOption`/`finishQuiz` for the quiz flow, `renderList` for the browsable list view.

### Per-topic localStorage key
Each quiz file's engine stores/reads its "best score" (`localStorage.setItem/getItem`) under `LS_KEY = 'pdr_t<NN[_M]>_best_v1'`, where `<NN[_M]>` matches the file's own topic id (e.g. `pdr_t08_1_best_v1` in `quiz_08_1_traffic_light_signals.html`). Previously every file hardcoded `pdr_t1_best_v1`, so all topics clobbered the same best-score entry — when adding a new quiz file, make sure `LS_KEY` uses that file's own topic id, not a copy-pasted value from another file.

### `index.html`
Static list of topic cards (number, Ukrainian title, question count, "Готово"/pending status pill) linking to each `quiz_*.html`. It is hand-maintained, not generated — question counts and status must be updated manually here when topics change.

# Browser Bug Watch

Purpose: find browser-visible bugs in the study tool with receipts, then fix the straightforward ones without turning the pass into broad feature work.

## When To Use

- Before or after UI/session-flow changes that can interact with quiz, flash, cram, graph, terms, sync, history, or settings behavior.
- When a bug feels like reload, memory growth, layout overlap, broken formatting, stale state, or a feature-combination regression.
- Before calling a phone/iPad/Vercel study site usable.
- Run against the existing `http://localhost:3000` Vite server. If it is not listening, ask before starting a replacement server.

## Tooling Choice

- Use Codex `test-in-browser` plus Browser automation for one-off exploratory passes.
- Use Playwright tests for durable repeated checks once a path has failed once or matters to core studying.
- Use `browser-use` only when the Browser plugin cannot reach a needed surface or a headed isolated session is useful.

## Watch Pass

1. Check repo and server state:
   - `git status --short --branch --untracked-files=all`
   - `Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue`
   - `npm test`
   - `npm run build`
2. Open the app in a fresh browser tab at desktop width.
3. Attach watchers:
   - Console errors and warnings.
   - Uncaught page errors.
   - Failed requests and HTTP responses with status `>= 400`.
   - Dialogs, crashes, and unexpected navigation.
   - Heap sample before and after the route/action pass when CDP access is available.
4. Exercise the core feature matrix:
   - Dashboard load and project selection empty state.
   - MCQ answer, reveal, rate, undo, skip, flag wrong, and history forward/back.
   - Flash flip, rate, history review, and return to active card.
   - Cram/easy mode combinations.
   - Graph hidden/visible, sync hidden/visible, terms hidden/visible.
   - Timer pause/resume and zen/header states.
5. Repeat the study-critical checks at both required mobile sizes:
   - Phone: 390x844 or equivalent narrow viewport.
   - iPad/tablet: 820x1180 or equivalent coarse-pointer viewport.
   - Confirm options wrap without truncation, answer feedback does not cover unrelated controls, rating buttons are touchable, images fit without hiding the question, and dashboard/create menus close on mouse leave/outside tap.
6. For a single-deck Vercel build, add deploy checks:
   - `npm run prepare:vercel-deck -- <deck.json>` reports no missing public assets.
   - Built JS contains the target deck marker and lacks known unrelated deck markers.
   - Production URL opens directly into the target deck, not the launcher.
   - `curl -sI <url>` shows COOP/COEP headers for SQLite worker support.
   - At least one referenced image URL returns `200`.
7. Save receipts:
   - Screenshot for each page or failed state.
   - Console/network/page-error summary.
   - Memory sample summary when available.
   - Bug report only if there is at least one finding.
8. Fix loop:
   - Fix only bugs with a clear root cause.
   - Add or update Vitest/Playwright coverage for the failed path.
   - Rerun `npm test`, `npm run build`, and the smallest browser repro.
   - Leave unrelated worktree changes alone.

## Report Shape

```md
# Browser Bug Watch - YYYY-MM-DD

Target: http://localhost:3000
Server owner: <pid or none>
Desktop viewport: <size>
Mobile viewport: <size>
iPad viewport: <size>

## Critical
- <bug, receipt, fixed/not fixed>

## Functional
- <bug, receipt, fixed/not fixed>

## Formatting
- <bug, receipt, fixed/not fixed>

## Memory
- <baseline heap, post-pass heap, notable growth>

## Clean
- <paths checked with no issue>

## Verification
- npm test: <result>
- npm run build: <result>
- browser repro: <result>
- Vercel single-deck checks: <result or n/a>
```

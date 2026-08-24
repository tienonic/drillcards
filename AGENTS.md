# Study Tool Local Rules

## Product Direction

- This app exists to be a minimalistic, task-specific study tool: capture the exact information needed for a concrete exam, assignment, or task, then drill it into memory with strong retrieval practice and spaced repetition.
- Codex, Hermes, and any delegated editor should preserve fast focused studying over decorative UI, broad knowledge capture, or feature creep.
- Changes must keep due/review counts, merge behavior, card generation, and FSRS-style review mechanics aligned with the real deck state.
- Generated questions should test the target knowledge without answer-length tells, obvious option imbalance, or extra detail that gives away the correct answer.
- Visible study copy must be retrieval-first. Do not put source/deck preambles in card text, including labels like `Connect eBook Ch4:`, `MGT Ch6 slide visual drill:`, `Source:`, `Final guide:`, source IDs, page IDs, coverage labels, `source point 1`, or `Which [course] final concept fits this clue:`. Keep anchors in source ledgers or internal notes, not in `q`, answers, explanations, or flashcard front/back copy.
- Real user/course project decks and generated course assets are local-only. Never force-add or push `projects/*.json`, course-specific public asset folders, exports, databases, or generated exam materials. Use tiny sanitized examples under `src/projects/` for GitHub-visible sample data.

## Dev Server

- The normal live server for this project is `http://localhost:3000`.
- Do not start another Vite/npm dev server if a `study-tool` Vite process is already listening.
- Before browser verification, inspect listeners and process command lines, then reuse the existing server.
- If `localhost:3000` is not healthy, ask before starting a replacement server.

## Agent Routing And Receipts

- Use Codex for repo-scale code edits, tests, commits, and structured implementation.
- Use Hermes/Citrus for Telegram-driven status, local file orchestration, scheduled reminders, or cross-session operating workflows around this project.
- Completion reports must name the command actually run, the artifact or URL inspected, and whether real course/private decks stayed local-only.
- Do not publish, push, or expose generated course assets; if a deployment/export is requested, first create a sanitized build/export plan and wait for explicit approval.

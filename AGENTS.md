# Study Tool Local Rules

## Product Direction

- This app exists to be a minimalistic, task-specific study tool: capture the exact information needed for a concrete exam, assignment, or task, then drill it into memory with strong retrieval practice and spaced repetition.
- Codex, Hermes, and any delegated editor should preserve fast focused studying over decorative UI, broad knowledge capture, or feature creep.
- Changes must keep due/review counts, merge behavior, card generation, and FSRS-style review mechanics aligned with the real deck state.
- Generated questions should test the target knowledge without answer-length tells, obvious option imbalance, or extra detail that gives away the correct answer.

## Dev Server

- The normal live server for this project is `http://localhost:3000`.
- Do not start another Vite/npm dev server if a `study-tool` Vite process is already listening.
- Before browser verification, inspect listeners and process command lines, then reuse the existing server.
- If `localhost:3000` is not healthy, ask before starting a replacement server.

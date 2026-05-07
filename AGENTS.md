# Study Tool Local Rules

## Dev Server

- The normal live server for this project is `http://localhost:3000`.
- Do not start another Vite/npm dev server if a `study-tool` Vite process is already listening.
- Before browser verification, inspect listeners and process command lines, then reuse the existing server.
- If `localhost:3000` is not healthy, ask before starting a replacement server.

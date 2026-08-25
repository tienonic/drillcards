# Drill

Drill is a local-first study application for spaced-repetition review, multiple-choice quizzes, flashcards, and generated math exercises. It uses `ts-fsrs` for scheduling and stores card state in an IndexedDB-backed SQLite database.

The application runs in the browser and does not require an account or application server.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Pick a built-in project from the Review tab or drop a JSON file onto the dashboard.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (port 3000, HMR) |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Serve the production build locally |

## Features

### Dashboard

The landing screen with four tabs:

- **Review**: select a project to study, view recent projects, see deck stats (new / learning / due)
- **Stats**: cross-project review history, retention charts, streak tracking
- **Create**: build new study projects from source material (supports Gemini API for AI-assisted question generation)
- **Parameters**: tune FSRS settings (desired retention, new cards per day, leech threshold, max interval)

### Study modes

- **MCQ quizzes**: multiple choice with instant feedback, explanations, and image lookup
- **Passage-based quizzes**: reading comprehension with shared context passages
- **Flashcards**: 3D flip cards with Again/Hard/Good/Easy rating (FSRS scheduling)
- **Math drills**: randomly generated problems with step-by-step solutions (conversion, average, percent, decimal)

### Spaced repetition

Cards are scheduled using the [FSRS algorithm](https://github.com/open-spaced-repetition/ts-fsrs) (Free Spaced Repetition Scheduler). Key concepts:

- **New cards** are introduced up to a persisted local-day limit (default: 20 per day)
- **Learning/Review cards** appear when due based on FSRS scheduling
- **Finite study windows** can redistribute unseen-card exposure toward weekends while keeping exposure, recognition, retrievability, and durable retention separate
- **Leech detection** flags cards that repeatedly fail (configurable threshold)
- **Cram mode** reviews all cards in a section by weakest stability, ignoring due dates
- **Easy mode** auto-rates cards as Good for faster review sessions

### Sidebar tools

- **Activity chart**: per-section or combined review history with cumulative score graph
- **Glossary**: context-aware term panel with relevance scoring and search filtering
- **AI assistant**: insights, targeted review suggestions, and question generation (requires local Claude CLI)
- **Notes**: quick timestamped notes per project (press `/`)

### Other features

- **Offline-first**: SQLite database runs in a Web Worker (wa-sqlite with IndexedDB backing). No server required
- **Customizable keybinds**: rebind any keyboard shortcut from the Keys panel
- **Zen mode**: hides score bar and progress indicators for distraction-free study
- **Backup/restore**: export and import project data as JSON
- **PWA support**: installable as a standalone app with offline caching

## Keyboard shortcuts

All shortcuts can be rebound via the **Keys** button in the header.

### MCQ / Quiz

| Default Key | Action |
|-------------|--------|
| `1`-`4` | Select answer / Rate card |
| `D` | Skip (double-tap) / Next |
| `Z` | Undo last action |
| `S` | Suspend card |
| `B` | Bury card (skip until tomorrow) |
| `R` | View image |
| `A` | Go back to previous question |

### Flashcards

| Default Key | Action |
|-------------|--------|
| `Space` / `F` | Flip card |
| `1`-`4` | Rate (Again / Hard / Good / Easy) |
| `D` | Flip or rate Good |

### Math

| Default Key | Action |
|-------------|--------|
| `Enter` | Submit answer |
| `D` | Skip / Next problem |

### Global

| Default Key | Action |
|-------------|--------|
| `/` | Open quick note |

## Create projects

Create a `.json` file following the format in [`projects/README.md`](projects/README.md), then either:
- Drop it onto the dashboard
- Use "Open Project File" in the Review tab

See [`projects/README.md`](projects/README.md) for the required JSON shape. Custom projects are stored in localStorage. For guidance on generating projects with LLMs, see [`GENERATING_PROJECTS.md`](GENERATING_PROJECTS.md).

## Architecture

```
src/
├── App.tsx                          # Root: dashboard or study phase
├── main.tsx                         # Entry point
├── index.css                        # @import per-feature CSS + theme tokens + responsive rules
├── core/                            # Shared infrastructure
│   ├── store/app.ts                 # Phase, active project/tab, toggles
│   ├── store/sections.ts            # sectionHandlers Map + keyboard routing
│   ├── hooks/                       # useWorker, useKeyboard, useTimer, useLatex
│   └── workers/                     # db.worker.ts (SQLite+FSRS), protocol.ts
├── features/                        # Self-contained feature folders
│   ├── dashboard/                   # Landing screen: review, stats, create, parameters
│   ├── launcher/                    # Project loading logic, recent projects, file drop
│   ├── quiz/                        # MCQ + flashcard (shared session/score/cram)
│   ├── math/                        # Math mode with categories + KaTeX
│   ├── activity/                    # Sidebar chart + stats widget
│   ├── glossary/                    # Terms dropdown with relevance scoring
│   ├── ai/                          # AI assistant panel (Claude CLI bridge)
│   ├── notes/                       # Note input (/ key)
│   ├── settings/                    # FSRS settings, keybinds, tips
│   ├── backup/                      # Backup/restore, autosave
│   └── export/                      # Project data export
├── components/                      # Shared display components
│   ├── LatexText.tsx                # LaTeX math rendering via KaTeX
│   └── layout/                      # StudyApp shell, Header, TopToggles, SectionsContainer
├── projects/                        # Data types, loader, registry, built-in projects
├── data/                            # Math problem generators
└── utils/                           # shuffle, formatting helpers
```

### Design decisions

- **Two-phase UI**: `appPhase` signal switches between `'launcher'` (dashboard) and `'study'`: no router needed
- **Worker-based persistence**: All database operations run in a Web Worker via wa-sqlite. Messages are serialized through a promise chain to prevent race conditions
- **Session factories**: `createQuizSession()` and `createMathSession()` produce independent signal bundles per section, stored in a `sectionHandlers` Map for keyboard routing
- **Module-level state**: Stores export signals directly rather than using context providers: simpler for a single-page app with no nested routing
- **Feature folders**: Each feature is self-contained with its own component(s), store, and CSS. Adding or modifying a feature means touching only its folder

## Technology

| Library | Purpose |
|---------|---------|
| [SolidJS](https://www.solidjs.com/) | Reactive UI framework |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) | FSRS spaced repetition algorithm |
| [wa-sqlite](https://rhashimoto.github.io/wa-sqlite/) | SQLite compiled to WASM (IndexedDB VFS) |
| [KaTeX](https://katex.org/) | LaTeX math rendering |
| [Vite](https://vite.dev/) | Build tool + dev server |

## Browser requirements

Requires a modern browser with Web Worker, SharedArrayBuffer, and IndexedDB support. The dev server sets the required COOP/COEP headers automatically via `vite.config.ts`.

For production hosting, you need to set these headers on your server:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

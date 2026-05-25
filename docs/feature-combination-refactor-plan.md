# Feature Combination Refactor Plan

Date: 2026-05-25

## Problem

The app works, but feature interactions are now the risky surface. The current quiz path combines MCQ, flashcards, cram mode, merged decks, history navigation, keyboard shortcuts, timers, activity graph controls, generated card quality, image-heavy decks, local file startup, and "done but still has cards" recovery. Bugs are likely when two or three of those options are enabled together.

The fix is not a larger manual checklist. The fix is to make feature combinations explicit, move session behavior toward a typed state model, and run a small but systematic set of transition and UI tests whenever features change.

## Technique

Use a "feature combination contract" for the study session. It has four pieces:

1. A feature-axis model that lists the modes and options that can combine.
2. Constraints that mark impossible or unsupported combinations.
3. Generated or table-driven scenarios that cover every important pair of options, with a few stronger 3-way cases for high-risk areas.
4. Invariant tests that assert what must always remain true regardless of the combination.

This fits the research:

- NIST's combinatorial testing work and ACTS tool focus on t-way combinations with constraints and mixed strength, which is exactly the issue here: most bugs come from option interactions, not one option alone.
- Vitest supports table-driven tests with `test.each` and `test.for`, so the existing test runner can cover a scenario matrix without adding a heavy new stack.
- TypeScript discriminated unions and exhaustive `never` checks are a good fit for replacing loose string state plus many related signals.
- fast-check can later add property/model-based tests for pure schedulers and action sequences, but it should not be the first dependency unless the axis matrix starts catching too little.
- Playwright can later run a small number of parameterized UI tests against the real app. It should cover high-risk browser behavior, not duplicate every unit test.

## Feature Axes

Start with these axes in a small source file such as `src/features/quiz/featureMatrix.ts`:

| Axis | Values | Notes |
|---|---|---|
| studyMode | `mcq`, `flash` | Main rendering and rating path. |
| scheduleMode | `normal`, `cram` | Cram has different card-pick and rating semantics. |
| deckScope | `single`, `merged` | Merged decks affect lookup, override pick, due counts, and reset. |
| contentShape | `text`, `image`, `passage`, `artId` | Passage is MCQ-only. Image/art ID affects flash title and layout. |
| progressState | `answering`, `revealed`, `rated`, `history`, `done` | Should become a discriminated union, not loosely shared strings. |
| inputPath | `mouse`, `keyboard` | Keyboard is where history/rating collisions happen. |
| activityPanel | `graphOn`, `graphOff`, `optionsOpen` | Needed for the requested graph/options control move. |
| sessionSupply | `dueOnly`, `newOnly`, `mixed`, `empty`, `buried` | Guards "done" recovery and Add all behavior. |

Initial constraints:

- `passage` only pairs with `mcq`.
- `flashDefFirst` only exists under `flash`.
- `revealed` only exists after a flash flip or easy-mode MCQ reveal.
- `rated` only exists after an MCQ answer/rating path, not flash history review.
- `history` must never call review/rate side effects.
- `graphOff` must not mutate score, due count, timer, history, or scheduling state.

## Invariants

These should be enforced with fast Vitest tests before new UI work:

- A session in `answering`, `revealed`, `rated`, or `history` has an active card id that resolves to a card in the current deck scope.
- A session in `done` has no active answerable card unless an override pick succeeds immediately after adding/studying more.
- Going back in history only restores prior UI state. It does not review, rate, increment cram misses, or add activity.
- Going forward from the last history entry is a no-op for arrow/D keys; Space may intentionally move to the next card in MCQ history only.
- `Again` is the only cram rating that increments misses. `Hard` keeps the card in circulation without treating it as forgotten.
- Activity graph visibility and options-menu state are layout-only. They cannot change review data.
- Art-history image ID generation must include style/movement/culture in generated facts or feedback when the source contains it.
- Local startup must prefer a valid recent/local project and fall back without throwing if that project is unavailable.

## Refactor Sequence

### Phase 0: Ship Current Stabilization

- Keep the existing history, flashcard title, Add all recovery, startup project, and art-history prompt changes.
- Security gate: scan diffs, protected files, `.gitignore`, and dependency changes.
- Verification gate: `npm test`, `npm run build`, and browser smoke only when the existing `localhost:3000` server is healthy or the user approves starting it.

### Phase 1: Add The Matrix Harness

- Add `src/features/quiz/featureMatrix.ts` with the axes, constraints, and a compact list of generated scenarios. Initial version added on 2026-05-25.
- Add `src/features/quiz/featureMatrix.test.ts` using Vitest matrix checks. Initial version added on 2026-05-25.
- Add matrix-backed behavior tests so high-risk scenario rows exercise actual session code. Initial `historyIsReadOnly` and `cramHardRemembered` checks added on 2026-05-25.
- Start with 12-20 scenarios, not every possible cartesian product. The first matrix has 19 scenarios.
- Include scenario names that read like bug reports: `flash + cram + history + keyboard`, `mcq + merged + done + addAll`, `graphOff + optionsOpen + activeTimer`.

### Phase 2: Isolate Session State

- Introduce a `QuizSessionState` discriminated union and `QuizSessionEvent` union.
- Move pure transitions into `src/features/quiz/sessionMachine.ts`.
- Keep Solid signals as the view adapter, but stop letting many independent signals define the source of truth.
- Effects such as `api.reviewCard`, `api.pickNext`, `timer.start`, `autoSave`, and `pushChartEntry` should be called by orchestration code after the pure transition says they are needed.

### Phase 3: Move Graph And Option Controls

- Create a minimal `ActivityOptionsMenu` near the current activity graph controls. Initial widget-owned options menu added on 2026-05-25.
- Put graph visibility and related checkboxes in that menu. Initial `Graph`, `Sync`, and `Terms` controls moved out of Settings on 2026-05-25.
- When the graph is hidden, show a small top-level graph toggle chip near the existing mode controls, similar in weight to the current Zed-style control. Initial hidden-graph top toggle added on 2026-05-25.
- Persist this as layout state only. It must not touch quiz/session state.
- Add matrix cases for `graphOn`, `graphOff`, and `optionsOpen`.

### Phase 4: Add Browser Smoke Coverage

- Add Playwright only after the unit matrix is stable and after dependency/security review.
- Cover a small number of real workflows:
  - open recent/local project
  - MCQ answer, history back/forward, next card
  - flash flip, rate, history back/forward
  - cram weak-first loop
  - graph hidden/options open while studying
- Run against the existing `http://localhost:3000` server. Do not start duplicate Vite servers.

## Definition Of Done

For each feature change touching quiz/session behavior:

- Update or add a matrix row when a new axis value or combination exists.
- Add an invariant if the bug class could repeat.
- Run `npm test`.
- Run `npm run build`.
- Run browser smoke only against the existing healthy `localhost:3000` server, or after explicit approval to start it.
- Before commit/push, run the security check and verify `git diff --name-only origin/main..HEAD`.

## Sources

- NIST ACTS: https://www.nist.gov/publications/acts-combinatorial-test-generation-tool
- NIST combinatorial testing overview PDF: https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=903128
- Vitest `test.each` and `test.for`: https://vitest.dev/api/test
- TypeScript discriminated unions and exhaustive checking: https://www.typescriptlang.org/docs/handbook/2/narrowing.html
- Solid stores for structured state: https://docs.solidjs.com/concepts/stores
- fast-check property-based testing: https://fast-check.dev/docs/introduction/what-is-property-based-testing/
- fast-check model-based testing: https://fast-check.dev/docs/advanced/model-based-testing/
- Playwright parameterized tests: https://playwright.dev/docs/test-parameterize

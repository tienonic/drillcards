# Project File Format

Create a `.json` file, load it via "Open Project File" or drag & drop. See `example-chemistry.json` for a working reference.

## Structure

```json
{
  "name": "Project Name",
  "version": 1,
  "config": {
    "desired_retention": 0.9,
    "new_per_session": 20,
    "leech_threshold": 8,
    "max_interval": 365,
    "imageSearchSuffix": ""
  },
  "sections": [],
  "glossary": []
}
```

- **config** is optional (defaults shown above). `desired_retention` is 0–1, higher = more reviews. `max_interval` caps the longest review gap in days (default: 365). `imageSearchSuffix` is appended to Google Images queries.
- **sections** — array of section objects (at least one required)
- **glossary** — optional array of `{ "term": "...", "def": "..." }` objects shown in the sidebar. Add `"hasImage": true` to include a Google Images link.

## Section Types

Every section needs `id` (unique lowercase string), `name`, and `type`.

### mc-quiz

```json
{
  "id": "elements",
  "name": "Elements",
  "type": "mc-quiz",
  "questions": [
    {
      "q": "What is the symbol for Gold?",
      "correct": "Au",
      "wrong": ["Go", "Gd", "Ag"],
      "explanation": "From Latin 'aurum'.",
      "imageName": "gold element"
    }
  ],
  "hasFlashcards": true,
  "flashcards": [
    {
      "front": "Gold (Au)",
      "back": "<strong>Atomic #:</strong> 79<br><strong>Group:</strong> Transition metal"
    }
  ]
}
```

**Question fields:** `q`, `correct`, `wrong` (exactly 3) are required. `explanation` and `imageName` are optional.

**Flashcards:** Set `hasFlashcards: true` and add a `flashcards` array with `front`/`back` pairs. `back` supports HTML (`<strong>`, `<br>`, `<em>`).

**Images:** Set `hasImages: true` to show "View Image" links using each question's `imageName`.

### passage-quiz

```json
{
  "id": "reactions",
  "name": "Reactions",
  "type": "passage-quiz",
  "instruction": "Read the passage, then answer.",
  "scenarios": [
    {
      "passage": "In an exothermic reaction, energy is released...",
      "source": "Chemistry Ch. 5",
      "questions": [
        {
          "q": "What is ΔH for exothermic?",
          "correct": "Negative",
          "wrong": ["Positive", "Zero", "Undefined"],
          "explanation": "Energy leaves → ΔH < 0."
        }
      ]
    }
  ],
  "tips": ["Check atom counts on both sides"]
}
```

Shows a passage then asks questions about it. `instruction`, `source`, and `tips` are optional. Questions use the same format as mc-quiz.

### math-gen

```json
{
  "id": "math",
  "name": "Math",
  "type": "math-gen",
  "generators": ["conversion", "average", "percent", "decimal"]
}
```

Generates random problems with step-by-step solutions. Available generators: `conversion` (unit conversions), `average`, `percent`, `decimal` (arithmetic).

## Rules

- Always exactly 3 wrong answers per question
- Section IDs: lowercase, no spaces (e.g. `"elements"`, `"ch5-reactions"`)
- Keep explanations to 1–2 sentences
- Use `imageName` for visual subjects — creates a Google Images link
- Passage-quiz is best for content that shares context (readings, case studies, legal text)

For detailed guidance on generating projects with LLMs, see [`GENERATING_PROJECTS.md`](../GENERATING_PROJECTS.md).

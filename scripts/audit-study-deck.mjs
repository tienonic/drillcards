import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_CATEGORIES = [
  'greetings',
  'clarification',
  'directions',
  'time-breaks',
  'safety-ppe',
  'sanitation',
  'line-coordination',
  'produce-quality',
  'quantities',
  'problem-reporting',
];

function usage() {
  console.error('Usage: node scripts/audit-study-deck.mjs <deck.json> [--expected-name <name>] [--expected-slug <slug>]');
}

function fail(errors) {
  console.error(`STRICT DECK AUDIT FAILED (${errors.length} error${errors.length === 1 ? '' : 's'})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

function parseArgs(argv) {
  const values = { deckPath: '', expectedName: '', expectedSlug: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--expected-name') values.expectedName = argv[++index] ?? '';
    else if (arg === '--expected-slug') values.expectedSlug = argv[++index] ?? '';
    else if (!arg.startsWith('-') && !values.deckPath) values.deckPath = arg;
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  return values;
}

function normalize(value) {
  return typeof value === 'string'
    ? value.normalize('NFC').trim().replace(/\s+/gu, ' ')
    : '';
}

function normalizedPlainText(value) {
  return normalize(value.replace(/<[^>]*>/gu, ' '));
}

function slugify(value) {
  return normalize(value).toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function increment(counts, category, kind, label, errors) {
  if (!REQUIRED_CATEGORIES.includes(category)) {
    errors.push(`${label} has invalid category "${category}"`);
    return;
  }
  counts[category][kind] += 1;
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  usage();
  fail([error.message]);
}

if (!args.deckPath) {
  usage();
  process.exit(1);
}

const deckPath = path.resolve(process.cwd(), args.deckPath);
let data;
try {
  data = JSON.parse(fs.readFileSync(deckPath, 'utf8'));
} catch (error) {
  fail([`Could not read valid JSON from ${deckPath}: ${error.message}`]);
}

const errors = [];
const name = normalize(data?.name);
const slug = slugify(name);
const fileSlug = path.basename(deckPath, path.extname(deckPath));
if (!name) errors.push('Project name is empty');
if (args.expectedName && name !== normalize(args.expectedName)) {
  errors.push(`Expected project name "${normalize(args.expectedName)}", found "${name}"`);
}
if (args.expectedSlug && slug !== normalize(args.expectedSlug)) {
  errors.push(`Expected slug "${normalize(args.expectedSlug)}", found "${slug}"`);
}
if (slug !== fileSlug) errors.push(`Computed slug "${slug}" does not match filename slug "${fileSlug}"`);

if (!Array.isArray(data?.sections) || data.sections.length !== 1) {
  errors.push(`Expected exactly one section, found ${Array.isArray(data?.sections) ? data.sections.length : 'non-array'}`);
}

const section = Array.isArray(data?.sections) ? data.sections[0] : null;
if (section?.type !== 'mc-quiz') errors.push(`Expected section type "mc-quiz", found "${section?.type}"`);
if (section?.hasFlashcards !== true) errors.push('Section hasFlashcards must be true');
if (Object.hasOwn(section ?? {}, 'cardIds') || Object.hasOwn(section ?? {}, 'flashCardIds')) {
  errors.push('Source deck must not contain generated cardIds or flashCardIds');
}

const questions = Array.isArray(section?.questions) ? section.questions : [];
const flashcards = Array.isArray(section?.flashcards) ? section.flashcards : [];
if (questions.length !== 40) errors.push(`Expected exactly 40 MCQs, found ${questions.length}`);
if (flashcards.length !== 50) errors.push(`Expected exactly 50 flashcards, found ${flashcards.length}`);

const counts = Object.fromEntries(REQUIRED_CATEGORIES.map(category => [category, { mcq: 0, flashcard: 0 }]));
const seenQuestions = new Map();
const seenFronts = new Map();

questions.forEach((question, index) => {
  const label = `MCQ ${index + 1}`;
  const prompt = normalize(question?.q);
  const correct = normalize(question?.correct);
  const explanation = normalize(question?.explanation);
  const wrong = Array.isArray(question?.wrong) ? question.wrong.map(normalize) : [];
  const category = normalize(question?.category);

  if (!prompt) errors.push(`${label} has an empty question`);
  if (!correct) errors.push(`${label} has an empty correct answer`);
  if (!explanation) errors.push(`${label} has an empty explanation`);
  if (wrong.length !== 3) errors.push(`${label} must have exactly three wrong answers, found ${wrong.length}`);
  wrong.forEach((answer, wrongIndex) => {
    if (!answer) errors.push(`${label} wrong answer ${wrongIndex + 1} is empty`);
  });

  const normalizedOptions = [correct, ...wrong];
  if (new Set(normalizedOptions).size !== normalizedOptions.length) errors.push(`${label} options are not pairwise unique`);
  if (wrong.includes(correct)) errors.push(`${label} repeats the correct answer among wrong answers`);

  if (prompt) {
    if (seenQuestions.has(prompt)) errors.push(`${label} duplicates ${seenQuestions.get(prompt)}`);
    else seenQuestions.set(prompt, label);
  }

  if (normalizedOptions.length === 4 && normalizedOptions.every(Boolean)) {
    const lengths = normalizedOptions.map(option => Array.from(normalizedPlainText(option)).length);
    const max = Math.max(...lengths);
    const min = Math.min(...lengths);
    if (max - min > 12) errors.push(`${label} option length spread is ${max - min} (${lengths.join('/')})`);
    if (lengths[0] === max && lengths.filter(length => length === max).length === 1) {
      errors.push(`${label} correct answer is the unique longest option (${lengths.join('/')})`);
    }
  }

  for (const forbidden of ['answerPosition', 'correctIndex', 'correctAnswerIndex']) {
    if (Object.hasOwn(question ?? {}, forbidden)) errors.push(`${label} contains forbidden source answer-position field "${forbidden}"`);
  }
  increment(counts, category, 'mcq', label, errors);
});

flashcards.forEach((flashcard, index) => {
  const label = `Flashcard ${index + 1}`;
  const front = normalize(flashcard?.front);
  const back = normalize(flashcard?.back);
  const category = normalize(flashcard?.category);
  if (!front) errors.push(`${label} has an empty front`);
  if (!back) errors.push(`${label} has an empty back`);
  if (/[\r\n]|<\/?(?:ul|ol|li)\b|(?:^|\s)[•]/iu.test(String(flashcard?.front ?? ''))
      || /[\r\n]|<\/?(?:ul|ol|li)\b|(?:^|\s)[•]/iu.test(String(flashcard?.back ?? ''))) {
    errors.push(`${label} must be one atomic cue/response, not a list`);
  }
  if (front) {
    if (seenFronts.has(front)) errors.push(`${label} duplicates ${seenFronts.get(front)}`);
    else seenFronts.set(front, label);
  }
  increment(counts, category, 'flashcard', label, errors);
});

for (const category of REQUIRED_CATEGORIES) {
  const count = counts[category];
  if (count.mcq !== 4 || count.flashcard !== 5) {
    errors.push(`Category "${category}" must contain 4 MCQs and 5 flashcards, found ${count.mcq}/${count.flashcard}`);
  }
}

if (!Array.isArray(data?.glossary) || data.glossary.length === 0) errors.push('Glossary must be nonempty');
else data.glossary.forEach((entry, index) => {
  if (!normalize(entry?.term) || !normalize(entry?.def)) errors.push(`Glossary entry ${index + 1} has an empty term or definition`);
});
if (!Array.isArray(section?.tips) || section.tips.length === 0 || section.tips.some(tip => !normalize(tip))) {
  errors.push('Section must include nonempty practical tips');
}

if (errors.length) fail(errors);

console.log(JSON.stringify({
  result: 'PASS',
  audit: 'strict-study-deck-v1',
  file: path.relative(process.cwd(), deckPath),
  name,
  slug,
  sections: 1,
  mcqs: questions.length,
  flashcards: flashcards.length,
  categoryCounts: counts,
  optionLengthRule: 'spread<=12; correct-not-unique-longest',
  answerPositionAudit: 'inapplicable; source has no answer-position field and runtime shuffles options',
}, null, 2));

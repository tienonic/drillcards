import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

function usage() {
  console.error('Usage: node scripts/verify-project-loader.mjs <deck.json> [--expected-slug <slug>] [--sections <count>] [--mcqs <count>] [--flashcards <count>]');
}

function fail(errors) {
  console.error(`PRODUCTION LOADER VERIFICATION FAILED (${errors.length} error${errors.length === 1 ? '' : 's'})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const values = { deckPath: '', expectedSlug: '', sections: 1, mcqs: 40, flashcards: 50 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--expected-slug') values.expectedSlug = argv[++index] ?? '';
    else if (arg === '--sections') values.sections = Number(argv[++index]);
    else if (arg === '--mcqs') values.mcqs = Number(argv[++index]);
    else if (arg === '--flashcards') values.flashcards = Number(argv[++index]);
    else if (!arg.startsWith('-') && !values.deckPath) values.deckPath = arg;
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  if (!Number.isInteger(values.sections) || values.sections < 1) throw new Error('--sections must be a positive integer');
  if (!Number.isInteger(values.mcqs) || values.mcqs < 0) throw new Error('--mcqs must be a nonnegative integer');
  if (!Number.isInteger(values.flashcards) || values.flashcards < 0) throw new Error('--flashcards must be a nonnegative integer');
  return values;
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  usage();
  console.error(error.message);
  process.exit(1);
}
if (!args.deckPath) {
  usage();
  process.exit(1);
}

const root = process.cwd();
const deckPath = path.resolve(root, args.deckPath);
let raw;
try {
  raw = fs.readFileSync(deckPath, 'utf8');
  JSON.parse(raw);
} catch (error) {
  console.error(`Could not read valid JSON from ${deckPath}: ${error.message}`);
  process.exit(1);
}

const vite = await createServer({
  root,
  configFile: false,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

try {
  const { validateProject, loadProject } = await vite.ssrLoadModule('/src/projects/loader.ts');
  const firstData = JSON.parse(raw);
  const secondData = JSON.parse(raw);
  const validationErrors = validateProject(firstData);
  const first = loadProject(firstData);
  const second = loadProject(secondData);
  const errors = [];

  if (validationErrors.length !== 0) errors.push(`Production validateProject returned: ${validationErrors.join('; ')}`);
  if (args.expectedSlug && first.slug !== args.expectedSlug) errors.push(`Expected slug "${args.expectedSlug}", found "${first.slug}"`);
  if (first.slug !== second.slug) errors.push('Independent loads returned different slugs');
  if (first.sections.length !== args.sections || second.sections.length !== args.sections) errors.push(`Independent loads did not return exactly ${args.sections} section(s)`);

  const firstCardIds = first.sections.flatMap(section => section.cardIds);
  const secondCardIds = second.sections.flatMap(section => section.cardIds);
  const firstFlashIds = first.sections.flatMap(section => section.flashCardIds);
  const secondFlashIds = second.sections.flatMap(section => section.flashCardIds);

  if (firstCardIds.length !== args.mcqs) errors.push(`Expected ${args.mcqs} MCQ IDs, found ${firstCardIds.length}`);
  if (firstFlashIds.length !== args.flashcards) errors.push(`Expected ${args.flashcards} flash IDs, found ${firstFlashIds.length}`);
  if (new Set(firstCardIds).size !== firstCardIds.length) errors.push('Production load generated duplicate MCQ IDs');
  if (new Set(firstFlashIds).size !== firstFlashIds.length) errors.push('Production load generated duplicate flash IDs');
  if (JSON.stringify(firstCardIds) !== JSON.stringify(secondCardIds)) errors.push('Independent loads returned different ordered MCQ IDs');
  if (JSON.stringify(firstFlashIds) !== JSON.stringify(secondFlashIds)) errors.push('Independent loads returned different ordered flash IDs');

  if (errors.length) {
    fail(errors);
  } else {
    console.log(JSON.stringify({
      result: 'PASS',
      verifier: 'production-loader-v1',
      productionModule: 'src/projects/loader.ts',
      file: path.relative(root, deckPath),
      validationErrors,
      slug: first.slug,
      independentLoads: 2,
      sections: first.sections.length,
      mcqIds: firstCardIds.length,
      flashIds: firstFlashIds.length,
      orderedIdsIdentical: true,
      firstMcqId: firstCardIds[0] ?? null,
      lastMcqId: firstCardIds.at(-1) ?? null,
      firstFlashId: firstFlashIds[0] ?? null,
      lastFlashId: firstFlashIds.at(-1) ?? null,
    }, null, 2));
  }
} finally {
  await vite.close();
}

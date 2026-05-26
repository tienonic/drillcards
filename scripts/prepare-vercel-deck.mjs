import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const generatedDir = path.join(root, 'src', 'projects', 'generated');
const outputJson = path.join(generatedDir, 'active-project.json');
const outputSource = path.join(generatedDir, 'active-project.source.txt');

function usage() {
  console.error('Usage: node scripts/prepare-vercel-deck.mjs <projects/deck.json>');
  console.error('       node scripts/prepare-vercel-deck.mjs --clean');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function removeGeneratedDeck() {
  fs.mkdirSync(generatedDir, { recursive: true });
  for (const file of fs.readdirSync(generatedDir)) {
    if (file.endsWith('.json') || file.endsWith('.source.txt')) {
      fs.rmSync(path.join(generatedDir, file), { force: true });
    }
  }
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function validateProject(data) {
  const errors = [];
  if (!data || typeof data !== 'object') return ['Invalid project data'];
  if (typeof data.name !== 'string' || !slugify(data.name)) errors.push('Missing or invalid project name');
  if (!Array.isArray(data.sections) || data.sections.length === 0) errors.push('No sections defined');
  return errors;
}

function collectImagePaths(value, paths = new Set()) {
  if (!value || typeof value !== 'object') return paths;
  if (Array.isArray(value)) {
    for (const item of value) collectImagePaths(item, paths);
    return paths;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (
      typeof nested === 'string' &&
      ['image', 'imageName', 'cropName', 'frontImage', 'backImage'].includes(key) &&
      nested.trim()
    ) {
      paths.add(nested.trim());
      continue;
    }
    collectImagePaths(nested, paths);
  }
  return paths;
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}

if (args.includes('--clean')) {
  removeGeneratedDeck();
  console.log(`Removed generated deck files from ${path.relative(root, generatedDir)}`);
  process.exit(0);
}

const deckArg = args.find(arg => !arg.startsWith('-'));
if (!deckArg) {
  usage();
  process.exit(1);
}

const deckPath = path.resolve(root, deckArg);
if (!deckPath.toLowerCase().endsWith('.json')) fail('Deck path must point to a .json file.');
if (!fs.existsSync(deckPath)) fail(`Deck not found: ${deckPath}`);

let data;
try {
  data = JSON.parse(fs.readFileSync(deckPath, 'utf8'));
} catch (error) {
  fail(`Could not parse deck JSON: ${error.message}`);
}

const validationErrors = validateProject(data);
if (validationErrors.length) fail(`Deck is not deployable:\n- ${validationErrors.join('\n- ')}`);

removeGeneratedDeck();
fs.writeFileSync(outputJson, `${JSON.stringify(data, null, 2)}\n`);
fs.writeFileSync(outputSource, `${deckPath}\n`);

const missingPublicAssets = [];
for (const imagePath of collectImagePaths(data)) {
  if (!imagePath.startsWith('/') || imagePath.startsWith('//')) continue;
  const publicPath = path.join(root, 'public', imagePath.replace(/^\/+/, ''));
  if (!fs.existsSync(publicPath)) missingPublicAssets.push(imagePath);
}

const summary = {
  deck: data.name,
  slug: slugify(data.name),
  source: path.relative(root, deckPath),
  generated: path.relative(root, outputJson),
  missingPublicAssets,
};

console.log(JSON.stringify(summary, null, 2));

if (missingPublicAssets.length) {
  console.error('Some referenced /public assets were not found. Add them before deploying.');
  process.exit(2);
}

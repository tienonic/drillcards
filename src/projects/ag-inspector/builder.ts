import { crops, extraCropQuestions } from './crops-raw.ts';
import { conservationSpecies } from './conservation-raw.ts';
import { mapScenarios } from './maps-raw.ts';
import { readPassages } from './reading-raw.ts';
import { curatedTerms } from './terms-raw.ts';
import { shuffle } from '../../utils/shuffle.ts';
import type { ProjectData } from '../types.ts';

function buildCropQuestions() {
  const cropQuestions = [];
  for (const c of crops) {
    cropQuestions.push({
      q: `What category does ${c.name} belong to?`,
      correct: c.category,
      wrong: shuffle(crops.filter(x => x.category !== c.category).map(x => x.category).filter((v, i, a) => a.indexOf(v) === i)).slice(0, 3),
      imageName: c.name, explanation: `${c.name} is a ${c.category.toLowerCase()}.`,
    });
    cropQuestions.push({
      q: `Which best describes the leaves of ${c.name}?`,
      correct: c.leaf,
      wrong: shuffle(crops.filter(x => x.name !== c.name).map(x => x.leaf)).slice(0, 3),
      imageName: c.name, explanation: `Key: ${c.leaf.split(',')[0]}.`,
    });
    cropQuestions.push({
      q: `How do you distinguish ${c.name} from similar crops?`,
      correct: c.distinguish,
      wrong: shuffle(crops.filter(x => x.name !== c.name).map(x => x.distinguish)).slice(0, 3),
      imageName: c.name, explanation: `${c.distinguish.split(';')[0]}.`,
    });
  }
  for (const eq of extraCropQuestions) cropQuestions.push(eq);
  return cropQuestions;
}

function buildConservationQuestions() {
  const consQuestions = [];
  for (const sp of conservationSpecies) {
    consQuestions.push({ q: `Conservation status of ${sp.name}?`, correct: sp.status,
      wrong: shuffle(conservationSpecies.filter(x => x.name !== sp.name).map(x => x.status)).slice(0, 3),
      imageName: sp.name, explanation: sp.status.split('.')[0] + '.' });
    consQuestions.push({ q: `How to identify ${sp.name} in the field?`, correct: sp.id_features,
      wrong: shuffle(conservationSpecies.filter(x => x.name !== sp.name).map(x => x.id_features)).slice(0, 3),
      imageName: sp.name, explanation: sp.id_features.split('.')[0] + '.' });
    consQuestions.push({ q: `Inspector action for ${sp.name}?`, correct: sp.inspector_action,
      wrong: shuffle(conservationSpecies.filter(x => x.name !== sp.name).map(x => x.inspector_action)).slice(0, 3),
      imageName: sp.name, explanation: sp.inspector_action.split('.')[0] + '.' });
    consQuestions.push({ q: `Habitat of ${sp.name}?`, correct: sp.habitat,
      wrong: shuffle(conservationSpecies.filter(x => x.name !== sp.name).map(x => x.habitat)).slice(0, 3),
      imageName: sp.name, explanation: `Found in ${sp.habitat.split('\u2014')[0].toLowerCase().trim()}.` });
  }
  return consQuestions;
}

function buildGlossary() {
  const glossary: { term: string; def: string; hasImage?: boolean }[] = [];
  const catDefs: Record<string, string> = {
    'Tree nut': 'Nut growing on a tree in a hard shell (almond, walnut, pistachio).',
    'Stone fruit': 'Drupe with fleshy fruit and a hard pit/stone (peach, plum, cherry).',
    'Pome fruit': 'Fruit with fleshy outer part and seeded core (apple, pear).',
    'Citrus': 'Evergreen tree producing acidic juicy fruit with leathery rind.',
    'Vine crop': 'Crop growing on woody/herbaceous vines, often trellised (grape).',
    'Vegetable (fruit crop)': 'Botanically fruit, culinarily vegetable. Herbaceous annual (tomato).',
    'Small fruit': 'Low-growing fruit crop, often herbaceous (strawberry).',
  };
  const seenCats: Record<string, boolean> = {};
  for (const c of crops) {
    glossary.push({ term: c.name, def: c.category + '. ' + c.distinguish, hasImage: true });
    if (!seenCats[c.category] && catDefs[c.category]) { glossary.push({ term: c.category, def: catDefs[c.category] }); seenCats[c.category] = true; }
  }
  for (const sp of conservationSpecies) glossary.push({ term: sp.name, def: sp.status + '. ' + sp.id_features, hasImage: true });
  for (const t of curatedTerms) glossary.push({ term: t.term, def: t.def });
  return glossary;
}

const MAP_TIPS = [
  'Always orient your map with North at the top; draw a North arrow',
  'Use bird\u2019s-eye (plan) view \u2014 look straight down, not at an angle',
  'Establish a consistent scale and note it (e.g., 1 inch = 50 feet)',
  'Label every feature: buildings, roads, fences, water sources, traps',
  'Include a legend for any symbols you use',
  'Draw property boundaries first, then add interior features',
  'Mark compass directions for relative positions (NE corner, south fence line)',
  'Use simple, consistent shapes: squares for buildings, circles for trees',
  'Note distances between key features when specified',
  'Read the entire description before drawing anything',
];

export function buildDefaultProject(): ProjectData {
  const cropQuestions = buildCropQuestions();
  const consQuestions = buildConservationQuestions();
  const glossary = buildGlossary();
  const cropFlashcards = crops.map(c => ({
    front: c.name,
    back: `<strong>${c.category}</strong><br><br><strong>Leaf:</strong> ${c.leaf}<br><br><strong>Bark:</strong> ${c.bark}<br><br><strong>Key ID:</strong> ${c.distinguish}`,
  }));
  const mapScenariosFormatted = mapScenarios.map(s => ({ passage: s.passage, questions: s.questions.map(q => ({ q: q.q, correct: q.correct, wrong: q.wrong, explanation: q.explanation })) }));
  const readScenariosFormatted = readPassages.map(p => ({ passage: p.text, source: p.source, questions: p.questions.map(q => ({ q: q.q, correct: q.correct, wrong: q.wrong, explanation: q.explanation })) }));

  return {
    name: 'Example Botany Project', version: 1,
    config: { desired_retention: 0.9, new_per_session: 20, leech_threshold: 8, imageSearchSuffix: 'plant identification', timerConfigs: { math: { warnAt: 60, failAt: 180 } } },
    sections: [
      { id: 'crop', name: 'Crop & Tree ID', type: 'mc-quiz', hasFlashcards: true, hasImages: true, questions: cropQuestions, flashcards: cropFlashcards },
      { id: 'map', name: 'Map Drawing', type: 'passage-quiz', instruction: 'Map Drawing Quiz', hasFlashcards: false, hasImages: false, scenarios: mapScenariosFormatted, tips: MAP_TIPS },
      { id: 'math', name: 'Math Practice', type: 'math-gen', hasFlashcards: false, hasImages: false, generators: ['conversion', 'average', 'percent', 'decimal'] },
      { id: 'reading', name: 'Reading Comp', type: 'passage-quiz', hasFlashcards: false, hasImages: false, scenarios: readScenariosFormatted },
      { id: 'conservation', name: 'Conservation', type: 'mc-quiz', hasFlashcards: false, hasImages: true, questions: consQuestions },
    ],
    glossary,
  };
}

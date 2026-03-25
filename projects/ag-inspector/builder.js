/**
 * Builds the default Ag Inspector project from raw data files.
 */

import { crops, extraCropQuestions } from './crops-raw.js';
import { conservationSpecies } from './conservation-raw.js';
import { mapScenarios } from './maps-raw.js';
import { readPassages } from './reading-raw.js';
import { curatedTerms } from './terms-raw.js';
import { shuffle } from '../../js/classes/Utils.js';

export function buildDefaultProject() {
  // Build crop questions
  const cropQuestions = [];
  for (const c of crops) {
    cropQuestions.push({
      q: `What category does ${c.name} belong to?`,
      correct: c.category,
      wrong: shuffle(crops.filter(x => x.category !== c.category).map(x => x.category).filter((v, i, a) => a.indexOf(v) === i)).slice(0, 3),
      imageName: c.name,
      explanation: `${c.name} is a ${c.category.toLowerCase()}.`,
    });
    cropQuestions.push({
      q: `Which best describes the leaves of ${c.name}?`,
      correct: c.leaf,
      wrong: shuffle(crops.filter(x => x.name !== c.name).map(x => x.leaf)).slice(0, 3),
      imageName: c.name,
      explanation: `Key: ${c.leaf.split(',')[0]}.`,
    });
    cropQuestions.push({
      q: `How do you distinguish ${c.name} from similar crops?`,
      correct: c.distinguish,
      wrong: shuffle(crops.filter(x => x.name !== c.name).map(x => x.distinguish)).slice(0, 3),
      imageName: c.name,
      explanation: `${c.distinguish.split(';')[0]}.`,
    });
  }
  for (const eq of extraCropQuestions) cropQuestions.push(eq);

  // Build conservation questions
  const consQuestions = [];
  for (const sp of conservationSpecies) {
    consQuestions.push({
      q: `Conservation status of ${sp.name}?`,
      correct: sp.status,
      wrong: shuffle(conservationSpecies.filter(x => x.name !== sp.name).map(x => x.status)).slice(0, 3),
      imageName: sp.name,
      explanation: sp.status.split('.')[0] + '.',
    });
    consQuestions.push({
      q: `How to identify ${sp.name} in the field?`,
      correct: sp.id_features,
      wrong: shuffle(conservationSpecies.filter(x => x.name !== sp.name).map(x => x.id_features)).slice(0, 3),
      imageName: sp.name,
      explanation: sp.id_features.split('.')[0] + '.',
    });
    consQuestions.push({
      q: `Inspector action for ${sp.name}?`,
      correct: sp.inspector_action,
      wrong: shuffle(conservationSpecies.filter(x => x.name !== sp.name).map(x => x.inspector_action)).slice(0, 3),
      imageName: sp.name,
      explanation: sp.inspector_action.split('.')[0] + '.',
    });
    consQuestions.push({
      q: `Habitat of ${sp.name}?`,
      correct: sp.habitat,
      wrong: shuffle(conservationSpecies.filter(x => x.name !== sp.name).map(x => x.habitat)).slice(0, 3),
      imageName: sp.name,
      explanation: `Found in ${sp.habitat.split('\u2014')[0].toLowerCase().trim()}.`,
    });
  }

  // Build glossary
  const glossary = [];
  const catDefs = {
    'Tree nut': 'Nut growing on a tree in a hard shell (almond, walnut, pistachio).',
    'Stone fruit': 'Drupe with fleshy fruit and a hard pit/stone (peach, plum, cherry).',
    'Pome fruit': 'Fruit with fleshy outer part and seeded core (apple, pear).',
    'Citrus': 'Evergreen tree producing acidic juicy fruit with leathery rind.',
    'Vine crop': 'Crop growing on woody/herbaceous vines, often trellised (grape).',
    'Vegetable (fruit crop)': 'Botanically fruit, culinarily vegetable. Herbaceous annual (tomato).',
    'Small fruit': 'Low-growing fruit crop, often herbaceous (strawberry).',
  };
  const seenCats = {};
  for (const c of crops) {
    glossary.push({ term: c.name, def: c.category + '. ' + c.distinguish, hasImage: true });
    if (!seenCats[c.category] && catDefs[c.category]) {
      glossary.push({ term: c.category, def: catDefs[c.category] });
      seenCats[c.category] = true;
    }
  }
  for (const sp of conservationSpecies) {
    glossary.push({ term: sp.name, def: sp.status + '. ' + sp.id_features, hasImage: true });
  }
  for (const t of curatedTerms) {
    glossary.push({ term: t.term, def: t.def });
  }

  // Build map scenarios for the project format
  const mapScenariosFormatted = mapScenarios.map(s => ({
    passage: s.passage,
    questions: s.questions.map(q => ({
      q: q.q,
      correct: q.correct,
      wrong: q.wrong,
      explanation: q.explanation,
    })),
  }));

  // Build reading passages for the project format
  const readScenariosFormatted = readPassages.map(p => ({
    passage: p.text,
    source: p.source,
    questions: p.questions.map(q => ({
      q: q.q,
      correct: q.correct,
      wrong: q.wrong,
      explanation: q.explanation,
    })),
  }));

  // Build flashcards from crops
  const cropFlashcards = crops.map(c => ({
    front: c.name,
    back: `<strong>${c.category}</strong><br><br><strong>Leaf:</strong> ${c.leaf}<br><br><strong>Bark:</strong> ${c.bark}<br><br><strong>Key ID:</strong> ${c.distinguish}`,
  }));

  return {
    name: 'Sac County Ag Inspector',
    version: 1,
    config: {
      desired_retention: 0.9,
      new_per_session: 20,
      leech_threshold: 8,
      imageSearchSuffix: 'plant identification',
    },
    sections: [
      {
        id: 'crop',
        name: 'Crop & Tree ID',
        type: 'mc-quiz',
        hasFlashcards: true,
        hasImages: true,
        questions: cropQuestions,
        flashcards: cropFlashcards,
      },
      {
        id: 'map',
        name: 'Map Drawing',
        type: 'passage-quiz',
        instruction: 'Map Drawing Quiz',
        hasFlashcards: false,
        hasImages: false,
        scenarios: mapScenariosFormatted,
        tips: [
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
        ],
      },
      {
        id: 'math',
        name: 'Math Practice',
        type: 'math-gen',
        hasFlashcards: false,
        hasImages: false,
        generators: ['conversion', 'average', 'percent', 'decimal'],
      },
      {
        id: 'reading',
        name: 'Reading Comp',
        type: 'passage-quiz',
        hasFlashcards: false,
        hasImages: false,
        scenarios: readScenariosFormatted,
      },
      {
        id: 'conservation',
        name: 'Conservation',
        type: 'mc-quiz',
        hasFlashcards: false,
        hasImages: true,
        questions: consQuestions,
      },
    ],
    glossary,
  };
}

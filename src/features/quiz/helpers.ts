import type { Section, Question, Flashcard } from '../../projects/types.ts';

export function timeToRating(seconds: number): number {
  if (seconds >= 59) return 1; // Again
  if (seconds >= 40) return 2; // Hard
  if (seconds >= 8) return 3;  // Good
  return 4; // Easy
}

export function lookupQuestion(
  section: Section,
  cardId: string,
): { question: Question; scenarioIdx?: number; questionIdx?: number; passage?: string } | null {
  if (section.type === 'mc-quiz' && section.questions) {
    const idx = parseInt(cardId.slice(section.id.length + 1), 10);
    if (isNaN(idx)) return null;
    const q = section.questions[idx];
    return q ? { question: q } : null;
  }
  if (section.type === 'passage-quiz' && section.scenarios) {
    const suffix = cardId.slice(section.id.length + 1);
    const parts = suffix.split('-');
    if (parts.length < 2) return null;
    const si = parseInt(parts[0], 10);
    const qi = parseInt(parts[1], 10);
    if (isNaN(si) || isNaN(qi)) return null;
    const scenario = section.scenarios[si];
    if (!scenario) return null;
    const q = scenario.questions[qi];
    if (!q) return null;
    return {
      question: q,
      scenarioIdx: si,
      questionIdx: qi,
      passage: scenario.passage + (scenario.source
        ? `<span class="source">${scenario.source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`
        : ''),
    };
  }
  return null;
}

export function getCardType(
  sectionType: 'mc-quiz' | 'passage-quiz' | 'math-gen',
  flashMode: boolean,
): 'mcq' | 'passage' | 'flashcard' {
  if (flashMode) return 'flashcard';
  return sectionType === 'passage-quiz' ? 'passage' : 'mcq';
}

export function resolveFlashCard(
  section: Section,
  cardId: string,
): { idx: number; card: Flashcard } | null {
  const prefix = section.id + '-flash-';
  if (!cardId.startsWith(prefix)) return null;
  const idx = parseInt(cardId.slice(prefix.length), 10);
  if (isNaN(idx)) return null;
  const card = section.flashcards?.[idx];
  return card ? { idx, card } : null;
}

import type { Section, Question, Flashcard } from '../../projects/types.ts';
import { getCardTypeEntry } from '../../projects/cardTypeRegistry.ts';

/** Compile-time exhaustiveness check — use in default/else branches on discriminated unions */
export function assertNever(value: never, msg = 'Unhandled type'): never {
  throw new Error(`${msg}: ${value}`);
}

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
  const entry = getCardTypeEntry(section.type);
  return entry.lookupQuestion ? entry.lookupQuestion(section, cardId) : null;
}

export function getCardType(
  sectionType: Section['type'],
  flashMode: boolean,
): 'mcq' | 'passage' | 'flashcard' {
  if (flashMode) return 'flashcard';
  switch (sectionType) {
    case 'mc-quiz': return 'mcq';
    case 'passage-quiz': return 'passage';
    case 'math-gen': return 'mcq';
    default: assertNever(sectionType, 'Unknown section type');
  }
}

/** Map section type to worker card type for registration (no flash mode consideration) */
export function sectionToCardType(sectionType: Section['type']): 'mcq' | 'passage' {
  switch (sectionType) {
    case 'mc-quiz': return 'mcq';
    case 'passage-quiz': return 'passage';
    case 'math-gen': return 'mcq';
    default: assertNever(sectionType, 'Unknown section type');
  }
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

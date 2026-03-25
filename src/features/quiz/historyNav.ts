import { createSignal } from 'solid-js';
import type { Section } from '../../projects/types.ts';

export interface HistoryEntry {
  idx: number;
  scenarioIdx?: number;
  questionIdx?: number;
  cardId: string;
  selected: string | null;
  correct: string;
  optionOrder: string[];
  isCorrect: boolean;
  skipped: boolean;
  explanation: string;
  passage: string;
}

export function createHistoryNav(_section: Section) {
  let history: HistoryEntry[] = [];
  let histPos = -1;
  const [historyReview, setHistoryReview] = createSignal<HistoryEntry | null>(null);

  function canGoBack(): boolean {
    return history.length > 0 && histPos > 0;
  }

  function push(entry: HistoryEntry) {
    history = history.slice(0, histPos + 1);
    history.push(entry);
    histPos = history.length - 1;
  }

  function goBack(onRestore: (entry: HistoryEntry) => void) {
    if (!canGoBack()) return;
    histPos--;
    const entry = history[histPos];
    if (!entry) return;
    setHistoryReview(entry);
    onRestore(entry);
  }

  function advance(
    onRestore: (entry: HistoryEntry) => void,
    pickNext: () => void,
  ) {
    if (histPos >= history.length - 1) {
      setHistoryReview(null);
      pickNext();
      return;
    }
    histPos++;
    const entry = history[histPos];
    if (!entry) {
      setHistoryReview(null);
      pickNext();
      return;
    }
    setHistoryReview(entry);
    onRestore(entry);
  }

  function reset() {
    history = [];
    histPos = -1;
    setHistoryReview(null);
  }

  function getEntry(pos: number): HistoryEntry | undefined {
    return history[pos];
  }

  function getPos(): number {
    return histPos;
  }

  function clearReview() {
    setHistoryReview(null);
  }

  return {
    historyReview,
    canGoBack,
    push,
    goBack,
    advance,
    reset,
    clearReview,
    getEntry,
    getPos,
  };
}

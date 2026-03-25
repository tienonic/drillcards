import { createSignal } from 'solid-js';

export interface SectionHandler {
  state: () => string;
  timer: { pause: () => void; resume: () => void; paused: () => boolean; seconds: () => number; start: () => void; stop: () => number; reset: () => void };
  paused: () => boolean;
  togglePause: () => void;
  resetSection: () => void | Promise<void>;
  // Quiz-only (optional)
  flashMode?: () => boolean;
  score?: () => { correct: number; attempted: number };
  dueCount?: () => { due: number; newCount: number; total: number };
  pickNextCard?: () => Promise<void>;
  flashFlipped?: () => boolean;
  flipFlash?: () => void;
  rateFlash?: (r: number) => Promise<void>;
  options?: () => string[];
  answer?: (opt: string) => Promise<void>;
  rate?: (r: number) => Promise<void>;
  isCorrect?: () => boolean;
  skip?: () => Promise<void>;
  undo?: () => Promise<void>;
  suspend?: () => Promise<void>;
  bury?: () => Promise<void>;
  currentImageLink?: () => string;
  advanceFromHistory?: () => void;
  goBackHistory?: () => void;
  flashDefFirst?: () => boolean;
  setFlashDefFirst?: (v: boolean) => void;
  toggleFlashMode?: () => void;
  // Math-only (optional)
  nextProblem?: () => void;
  armSkip?: () => void;
}

export const sectionHandlers = new Map<string, SectionHandler>();
// Version signal to make sectionHandlers reads reactive in SolidJS
const [handlerVersion, setHandlerVersion] = createSignal(0);
export { handlerVersion };
export function bumpHandlerVersion() { setHandlerVersion(v => v + 1); }

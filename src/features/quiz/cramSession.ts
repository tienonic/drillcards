import { createSignal, batch } from 'solid-js';
import { workerApi } from '../../core/hooks/useWorker.ts';
import { getCardType } from './helpers.ts';

export interface CramDeps {
  projectSlug: () => string | undefined;
  sectionId: string;
  flashMode: () => boolean;
  sectionType: 'mc-quiz' | 'passage-quiz' | 'math-gen';
  onPickMcq: (cardId: string) => void;
  onPickFlash: (cardId: string) => void;
  onDone: () => void;
}

export function createCramSession(deps: CramDeps) {
  const [cramMode, setCramMode] = createSignal(false);
  const [cramCount, setCramCount] = createSignal(0);
  const cramSeen = new Set<string>();

  async function pickNextCram() {
    const slug = deps.projectSlug();
    if (!slug) { deps.onDone(); return; }

    const cardType = getCardType(deps.sectionType, deps.flashMode());
    const result = await workerApi.pickNextOverride(slug, [deps.sectionId], cardType, [...cramSeen]);

    if (!result.cardId) {
      deps.onDone();
      return;
    }

    if (deps.flashMode()) {
      deps.onPickFlash(result.cardId);
    } else {
      deps.onPickMcq(result.cardId);
    }
  }

  async function startCram() {
    cramSeen.clear();
    batch(() => { setCramCount(0); setCramMode(true); });
    await pickNextCram();
  }

  function endCram() {
    cramSeen.clear();
    batch(() => { setCramMode(false); setCramCount(0); });
  }

  function markSeen(cardId: string) {
    cramSeen.add(cardId);
    setCramCount(cramSeen.size);
  }

  return {
    cramMode,
    cramCount,
    startCram,
    endCram,
    pickNextCram,
    markSeen,
  };
}

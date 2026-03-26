import { createSignal, batch } from 'solid-js';
import { getCardType } from './helpers.ts';
import { pushChartEntry } from '../activity/store.ts';
import type { ProjectApi } from '../../core/hooks/useWorker.ts';

export interface CramDeps {
  projectSlug: () => string | undefined;
  sectionId: string;
  flashMode: () => boolean;
  sectionType: 'mc-quiz' | 'passage-quiz' | 'math-gen';
  onPickMcq: (cardId: string) => void;
  onPickFlash: (cardId: string) => void;
  onDone: () => void;
  api: ProjectApi;
}

export function createCramSession(deps: CramDeps) {
  const [cramMode, setCramMode] = createSignal(false);
  const [cramCount, setCramCount] = createSignal(0);
  const cramSeen = new Set<string>();

  async function pickNextCram() {
    const slug = deps.projectSlug();
    if (!slug) { deps.onDone(); return; }

    const cardType = getCardType(deps.sectionType, deps.flashMode());
    const result = await deps.api.pickNextOverride([deps.sectionId], cardType, [...cramSeen]);

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

  function rateCram(cardId: string, rating: number) {
    deps.api.addActivity(deps.sectionId, rating, rating !== 1).catch(() => {});
    pushChartEntry(rating, rating !== 1);
    markSeen(cardId);
  }

  return {
    cramMode,
    cramCount,
    startCram,
    endCram,
    pickNextCram,
    markSeen,
    rateCram,
  };
}

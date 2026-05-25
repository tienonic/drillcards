import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSignal, createRoot } from 'solid-js';
import { createFakeProjectApi } from './testUtils.ts';

// Mock side effects
vi.mock('../glossary/store.ts', () => ({
  setQuestionContext: vi.fn(),
}));

vi.mock('../activity/store.ts', () => ({
  pushChartEntry: vi.fn(),
}));

vi.mock('../backup/backup.ts', () => ({
  autoSave: vi.fn(),
}));

import { createFlashFlow } from './flashFlow.ts';
import type { FlashSignals } from './flashFlow.ts';
import type { Section } from '../../projects/types.ts';

function mockSection(): Section {
  return {
    id: 'sec1',
    name: 'Section 1',
    type: 'mc-quiz',
    questions: [{ q: 'Q?', correct: 'A', wrong: ['B'] }],
    cardIds: ['sec1-0'],
    flashCardIds: ['sec1-flash-0', 'sec1-flash-1'],
    flashcards: [
      { front: 'Term', back: 'Definition' },
      { front: 'Second Term', back: 'Second Definition' },
    ],
  };
}

function createSignals(): FlashSignals {
  const [state, setState] = createSignal('idle' as string);
  const [flashCardId, setFlashCardId] = createSignal<string | null>(null);
  const [flashFlipped, setFlashFlipped] = createSignal(false);
  const [flashFront, setFlashFront] = createSignal('');
  const [flashBack, setFlashBack] = createSignal('');
  const [flashTitle, setFlashTitle] = createSignal('');
  const [flashFrontImage, setFlashFrontImage] = createSignal('');
  const [flashBackImage, setFlashBackImage] = createSignal('');
  const [flashDefFirst] = createSignal(false);
  const [ratingLabels, setRatingLabels] = createSignal<Record<number, string>>({});
  return {
    state, setState, flashCardId, setFlashCardId,
    flashFlipped, setFlashFlipped, flashFront, setFlashFront,
    flashBack, setFlashBack, flashTitle, setFlashTitle, flashFrontImage, setFlashFrontImage,
    flashBackImage, setFlashBackImage, flashDefFirst,
    ratingLabels, setRatingLabels,
  };
}

function makeDeps(api: ReturnType<typeof createFakeProjectApi>) {
  const timer = { start: vi.fn(), stop: vi.fn().mockReturnValue(4), reset: vi.fn() };
  return {
    section: mockSection(),
    project: () => ({ slug: 'test-proj', config: { new_per_session: 10 } }),
    guard: { isActing: () => false, withActing: async (fn: () => Promise<void>) => fn() },
    timer,
    cramMode: () => false,
    cramMarkSeen: vi.fn(),
    cramPickNext: vi.fn().mockResolvedValue(undefined),
    cramRate: vi.fn(),
    refreshDue: vi.fn().mockResolvedValue(undefined),
    api,
  };
}

describe('createFlashFlow with injected API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pickNextFlash calls api.pickNext with flashcard type', async () => {
    await createRoot(async dispose => {
      const api = createFakeProjectApi({
        pickNext: vi.fn().mockResolvedValue({ cardId: 'sec1-flash-0' }),
      });
      const s = createSignals();
      const deps = makeDeps(api);
      const flow = createFlashFlow(s, deps);

      await flow.pickNextFlash();

      expect(api.pickNext).toHaveBeenCalledWith(['sec1'], 10, 'flashcard');
      expect(s.state()).toBe('answering');
      expect(s.flashFront()).toBe('Term');
      expect(s.flashBack()).toBe('Definition');
      expect(s.flashTitle()).toBe('');
      expect(flow.historyPosition()).toMatchObject({ current: 1, total: 1 });
      dispose();
    });
  });

  it('rateFlash calls api.reviewCard and api.addActivity in normal mode', async () => {
    await createRoot(async dispose => {
      const api = createFakeProjectApi({
        pickNext: vi.fn()
          .mockResolvedValueOnce({ cardId: 'sec1-flash-0' })
          .mockResolvedValueOnce({ cardId: null }),
        reviewCard: vi.fn().mockResolvedValue({ card: {}, isLeech: false, lapses: 0 }),
        addActivity: vi.fn().mockResolvedValue(undefined),
      });
      const s = createSignals();
      const deps = makeDeps(api);
      const flow = createFlashFlow(s, deps);

      await flow.pickNextFlash();
      await flow.rateFlash(3);

      expect(api.reviewCard).toHaveBeenCalledWith('sec1-flash-0', 'sec1', 3);
      expect(api.addActivity).toHaveBeenCalledWith('sec1', 3, true);
      dispose();
    });
  });

  it('rateFlash in cram mode skips reviewCard', async () => {
    await createRoot(async dispose => {
      const api = createFakeProjectApi({
        pickNext: vi.fn().mockResolvedValue({ cardId: 'sec1-flash-0' }),
        addActivity: vi.fn().mockResolvedValue(undefined),
      });
      const s = createSignals();
      const deps = { ...makeDeps(api), cramMode: () => true };
      const flow = createFlashFlow(s, deps);

      await flow.pickNextFlash();
      s.setState('answering');
      s.setFlashCardId('sec1-flash-0');

      await flow.rateFlash(3);

      expect(api.reviewCard).not.toHaveBeenCalled();
      expect(deps.cramRate).toHaveBeenCalledWith('sec1-flash-0', 3);
      dispose();
    });
  });

  it('flipFlash calls api.previewRatings when flipping to back', async () => {
    await createRoot(async dispose => {
      const api = createFakeProjectApi({
        pickNext: vi.fn().mockResolvedValue({ cardId: 'sec1-flash-0' }),
        previewRatings: vi.fn().mockResolvedValue({ labels: { 1: 'Again', 3: 'Good' } }),
      });
      const s = createSignals();
      const deps = makeDeps(api);
      const flow = createFlashFlow(s, deps);

      await flow.pickNextFlash();
      flow.flipFlash();

      expect(s.flashFlipped()).toBe(true);
      expect(s.state()).toBe('revealed');
      expect(api.previewRatings).toHaveBeenCalledWith('sec1-flash-0');
      dispose();
    });
  });

  it('starts the flashcard timer on a new front and stops it on reveal', async () => {
    await createRoot(async dispose => {
      const api = createFakeProjectApi({
        pickNext: vi.fn().mockResolvedValue({ cardId: 'sec1-flash-0' }),
        previewRatings: vi.fn().mockResolvedValue({ labels: {} }),
      });
      const deps = makeDeps(api);
      const s = createSignals();
      const flow = createFlashFlow(s, deps);

      await flow.pickNextFlash();
      expect(deps.timer.start).toHaveBeenCalledTimes(1);

      flow.flipFlash();
      expect(deps.timer.stop).toHaveBeenCalledTimes(1);
      expect(deps.timer.start).toHaveBeenCalledTimes(1);

      dispose();
    });
  });

  it('reviews flashcard history with A/D semantics without re-rating past cards', async () => {
    await createRoot(async dispose => {
      const api = createFakeProjectApi({
        pickNext: vi.fn()
          .mockResolvedValueOnce({ cardId: 'sec1-flash-0' })
          .mockResolvedValueOnce({ cardId: 'sec1-flash-1' }),
        reviewCard: vi.fn().mockResolvedValue({ card: {}, isLeech: false, lapses: 0 }),
        addActivity: vi.fn().mockResolvedValue(undefined),
      });
      const s = createSignals();
      const deps = makeDeps(api);
      const flow = createFlashFlow(s, deps);

      await flow.pickNextFlash();
      flow.flipFlash();
      await flow.rateFlash(3);

      expect(s.flashCardId()).toBe('sec1-flash-1');
      expect(s.flashFront()).toBe('Second Term');
      expect(flow.historyPosition()).toMatchObject({ current: 2, total: 2, canGoBack: true, canGoForward: false });

      flow.goBackHistory();

      expect(s.flashCardId()).toBe('sec1-flash-0');
      expect(s.flashFlipped()).toBe(true);
      expect(s.state()).toBe('reviewing-history');
      expect(deps.timer.reset).toHaveBeenCalled();
      expect(flow.historyPosition()).toMatchObject({ current: 1, total: 2, reviewing: true, canGoForward: true });

      await flow.rateFlash(1);
      expect(api.reviewCard).toHaveBeenCalledTimes(1);

      flow.advanceHistory();

      expect(s.flashCardId()).toBe('sec1-flash-1');
      expect(s.state()).toBe('answering');
      expect(flow.historyPosition()).toMatchObject({ current: 2, total: 2, reviewing: false, canGoForward: false });
      dispose();
    });
  });
});

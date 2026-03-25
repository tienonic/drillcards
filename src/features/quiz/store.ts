import { createSignal, createEffect, batch } from 'solid-js';
import { workerApi } from '../../core/hooks/useWorker.ts';
import { useTimer } from '../../core/hooks/useTimer.ts';
import { shuffle } from '../../utils/shuffle.ts';
import { activeProject, setActiveProject, easyMode, setActiveTab } from '../../core/store/app.ts';
import { autoSave } from '../backup/backup.ts';
import { pushChartEntry } from '../activity/store.ts';
import { getCardType, sectionToCardType, lookupQuestion, resolveFlashCard } from './helpers.ts';
import { createGuard } from './guard.ts';
import { createCramSession } from './cramSession.ts';
import { createMcqFlow } from './mcqFlow.ts';
import { createFlashFlow } from './flashFlow.ts';
import { bumpHandlerVersion, sectionHandlers } from '../../core/store/sections.ts';
import type { Section } from '../../projects/types.ts';
import type { QuizState, QuizSession } from './types.ts';
export type { QuizSession } from './types.ts';

export function createQuizSession(section: Section): QuizSession {
  const project = () => activeProject();

  // --- Shared signals ---
  const [state, setState] = createSignal<QuizState>('idle');
  const [cardId, setCardId] = createSignal<string | null>(null);
  const [question, setQuestion] = createSignal<import('../../projects/types.ts').Question | null>(null);
  const [options, setOptions] = createSignal<string[]>([]);
  const [selected, setSelected] = createSignal<string | null>(null);
  const [isCorrect, setIsCorrect] = createSignal(false);
  const [ratingLabels, setRatingLabels] = createSignal<Record<number, string>>({});
  const [score, setScore] = createSignal({ correct: 0, attempted: 0 });
  const [dueCount, setDueCount] = createSignal({ due: 0, newCount: 0, total: 0 });
  const [flashMode, setFlashMode] = createSignal(false);
  const [flashCardId, setFlashCardId] = createSignal<string | null>(null);
  const [flashFlipped, setFlashFlipped] = createSignal(false);
  const [flashFront, setFlashFront] = createSignal('');
  const [flashBack, setFlashBack] = createSignal('');
  const [flashDefFirst, setFlashDefFirst] = createSignal(false);
  const [passage, setPassage] = createSignal('');
  const [leechWarning, setLeechWarning] = createSignal(false);
  const [skipped, setSkipped] = createSignal(false);
  const timer = useTimer();
  const guard = createGuard();

  // --- Shared helpers ---
  function sectionCardType(): 'mcq' | 'passage' | 'flashcard' {
    return getCardType(section.type, flashMode());
  }

  async function refreshDue() {
    const p = project();
    if (!p) return;
    const slug = p.slug;
    const cardType = sectionCardType();
    const ids = cardType === 'flashcard' ? section.flashCardIds : section.cardIds;
    if (ids.length === 0) return;
    const result = await workerApi.countDue(slug, [section.id], cardType);
    if (project()?.slug !== slug) return;
    if (sectionCardType() !== cardType) return;
    setDueCount(result);
  }

  async function doRate(cId: string, rating: number) {
    const p = project();
    if (!p) return;

    if (cram.cramMode()) {
      workerApi.addActivity(p.slug, section.id, rating, rating !== 1).catch(() => {});
      pushChartEntry(rating, rating !== 1);
      cram.markSeen(cId);
      setState('rated');
      return;
    }

    const result = await workerApi.reviewCard(cId, p.slug, section.id, rating);
    workerApi.addActivity(p.slug, section.id, rating, rating !== 1).catch(() => {});
    pushChartEntry(rating, rating !== 1);
    autoSave(p.slug);

    batch(() => { if (result.isLeech) setLeechWarning(true); setState('rated'); });
    await refreshDue();
  }

  // --- Cram session ---
  const cram = createCramSession({
    projectSlug: () => project()?.slug,
    sectionId: section.id,
    flashMode,
    sectionType: section.type,
    onPickMcq: (id) => {
      const lookup = lookupQuestion(section, id);
      if (!lookup) { cram.endCram(); setState('done'); return; }
      const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
      mcq.applyMcqCard(id, lookup, shuffled, lookup.passage ?? '');
    },
    onPickFlash: (id) => {
      const resolved = resolveFlashCard(section, id);
      if (!resolved) { cram.endCram(); setState('done'); return; }
      flash.applyFlashCard(id, resolved);
    },
    onDone: () => {
      cram.endCram();
      setState('done');
    },
  });

  // --- MCQ flow ---
  const mcq = createMcqFlow(
    { state, setState, cardId, setCardId, question, setQuestion, options, setOptions,
      selected, setSelected, isCorrect, setIsCorrect, passage, setPassage,
      ratingLabels, setRatingLabels, score, setScore, leechWarning, setLeechWarning,
      skipped, setSkipped, flashMode },
    { section, project, guard, timer, doRate, refreshDue,
      cramMode: cram.cramMode, pickNextCram: cram.pickNextCram },
  );

  // --- Flash flow ---
  const flash = createFlashFlow(
    { state, setState, flashCardId, setFlashCardId, flashFlipped, setFlashFlipped,
      flashFront, setFlashFront, flashBack, setFlashBack, flashDefFirst,
      ratingLabels, setRatingLabels },
    { section, project, guard, refreshDue,
      cramMode: cram.cramMode, cramMarkSeen: cram.markSeen, cramPickNext: cram.pickNextCram },
  );

  // --- Effects ---
  createEffect(() => {
    const easy = easyMode();
    const st = state();
    const cId = cardId();
    if (!easy && st === 'revealed' && cId) {
      const captured = cId;
      workerApi.previewRatings(cId).then(preview => {
        if (cardId() === captured) setRatingLabels(preview.labels);
      }).catch(() => {});
    }
  });

  // --- Orchestration (bridges both flows) ---
  let modeSwitch = false;

  async function pickNextCard() {
    await guard.withActing(async () => {
      try {
        await mcq.pickNextCardImpl();
      } catch (err) {
        console.error(`[quiz:${section.id}] pickNextCard error:`, err);
        if (state() === 'idle') setState('done');
      }
    });
  }

  function toggleFlashMode() {
    if (guard.isActing() || modeSwitch) return;
    modeSwitch = true;
    const next = !flashMode();
    batch(() => { setFlashMode(next); bumpHandlerVersion(); });
    (next ? flash.pickNextFlash() : pickNextCard()).catch(() => {}).finally(() => { modeSwitch = false; });
  }

  async function studyMore() {
    const p = project();
    if (!p) return;
    await guard.withActing(async () => {
      await mcq.pickNextCardImpl();
      if (state() !== 'done') return;

      const cardType = sectionCardType();
      const result = await workerApi.pickNextOverride(p.slug, [section.id], cardType);
      if (result.cardId) {
        if (flashMode()) {
          const resolved = resolveFlashCard(section, result.cardId);
          if (!resolved) return;
          flash.applyFlashCard(result.cardId, resolved);
        } else {
          const lookup = lookupQuestion(section, result.cardId);
          if (!lookup) return;
          const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
          const passageText = lookup.passage ?? '';
          mcq.applyMcqCard(result.cardId, lookup, shuffled, passageText);
          mcq.pushHistoryEntry(result.cardId, lookup, shuffled, passageText);
        }
        await refreshDue();
        return;
      }

      for (const sec of p.sections) {
        if (sec.id === section.id) continue;
        const due = await workerApi.countDue(p.slug, [sec.id]);
        if (due.due > 0 || due.newCount > 0) {
          setActiveTab(sec.id);
          const handler = sectionHandlers.get(sec.id);
          if (handler?.pickNextCard) await handler.pickNextCard();
          return;
        }
      }
    });
  }

  async function startCramAction() {
    await guard.withActing(async () => {
      await cram.startCram();
    });
  }

  async function increaseNewCards(count?: number) {
    const p = project();
    if (p && count != null) {
      setActiveProject({ ...p, config: { ...p.config, new_per_session: count } });
    }
    await guard.withActing(async () => {
      await workerApi.resetNewCount();
      if (flashMode()) {
        await flash.pickNextFlash();
      } else {
        await mcq.pickNextCardImpl();
      }
    });
  }

  async function unburyAllAction() {
    const p = project();
    if (!p) return;
    await guard.withActing(async () => {
      await workerApi.unburyAll(p.slug);
      if (flashMode()) {
        await flash.pickNextFlash();
      } else {
        await mcq.pickNextCardImpl();
      }
    });
  }

  async function resetSectionAction() {
    const p = project();
    if (!p) return;
    await guard.withActing(async () => {
      await workerApi.resetSection(p.slug, section.id);
      const mcqType = sectionToCardType(section.type);
      const cardRegs = [
        ...section.cardIds.map(id => ({ sectionId: section.id, cardId: id, cardType: mcqType })),
        ...section.flashCardIds.map(id => ({ sectionId: section.id, cardId: id, cardType: 'flashcard' as const })),
      ];
      await workerApi.loadProject(p.slug, [section.id], cardRegs);
      mcq.histNav.reset();
      cram.endCram();
      setScore({ correct: 0, attempted: 0 });
      if (flashMode()) {
        await flash.pickNextFlash();
      } else {
        await mcq.pickNextCardImpl();
      }
    });
  }

  // --- Public interface ---
  return {
    state, cardId, question, options, selected, isCorrect, ratingLabels,
    score, dueCount, flashMode, flashCardId, flashFlipped, flashFront, flashBack,
    flashDefFirst, passage, historyReview: mcq.histNav.historyReview,
    leechWarning, skipped, currentImageLink: mcq.currentImageLink,
    cramMode: cram.cramMode, cramCount: cram.cramCount,

    pickNextCard,
    answer: mcq.answer,
    skip: mcq.skip,
    rate: mcq.rate,
    undo: mcq.undo,
    suspend: mcq.suspend,
    bury: mcq.bury,
    flipFlash: flash.flipFlash,
    rateFlash: flash.rateFlash,
    toggleFlashMode,
    setFlashDefFirst: (v: boolean) => {
      setFlashDefFirst(v);
      const fId = flashCardId();
      if (!fId) return;
      const resolved = resolveFlashCard(section, fId);
      if (!resolved) return;
      batch(() => {
        setFlashFront(v ? resolved.card.back : resolved.card.front);
        setFlashBack(v ? resolved.card.front : resolved.card.back);
        setFlashFlipped(false);
      });
    },
    advanceFromHistory: () => mcq.advanceFromHistory(pickNextCard),
    goBackHistory: mcq.goBackHistory,
    shuffleFlash: flash.shuffleFlash,
    shuffleMcq: mcq.shuffleMcq,
    resetSection: resetSectionAction,
    refreshDue,
    studyMore,
    flagWrong: mcq.flagWrong,
    startCram: startCramAction,
    endCram: () => { cram.endCram(); setState('done'); },
    increaseNewCards,
    unburyAll: unburyAllAction,

    timer,
    paused: timer.paused,
    togglePause: () => { timer.paused() ? timer.resume() : timer.pause(); },
  };
}

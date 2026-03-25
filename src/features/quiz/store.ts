import { createSignal, createEffect, batch } from 'solid-js';
import { workerApi } from '../../core/hooks/useWorker.ts';
import { useTimer } from '../../core/hooks/useTimer.ts';
import { shuffle } from '../../utils/shuffle.ts';
import { activeProject, setActiveProject, easyMode, sessionSummary, setSessionSummary, setActiveTab } from '../../core/store/app.ts';
import { autoSave } from '../backup/backup.ts';
import { setQuestionContext } from '../glossary/store.ts';
import { pushChartEntry } from '../activity/store.ts';
import { timeToRating, lookupQuestion, getCardType, resolveFlashCard } from './helpers.ts';
import { createHistoryNav, type HistoryEntry } from './historyNav.ts';
import { createGuard } from './guard.ts';
import { createCramSession } from './cramSession.ts';
import type { Section, Question } from '../../projects/types.ts';
import type { QuizState, QuizSession } from './types.ts';
export type { QuizSession } from './types.ts';

import { bumpHandlerVersion, sectionHandlers } from '../../core/store/sections.ts';

export function createQuizSession(section: Section): QuizSession {
  const project = () => activeProject();

  const [state, setState] = createSignal<QuizState>('idle');
  const [cardId, setCardId] = createSignal<string | null>(null);
  const [question, setQuestion] = createSignal<Question | null>(null);
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

  // When easyMode is toggled off while a question is revealed, load rating previews
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

  const histNav = createHistoryNav();
  const guard = createGuard();
  let modeSwitch = false;

  function setFlashError(msg = 'Card data mismatch') {
    batch(() => { setFlashCardId(null); setFlashFront(msg); setFlashBack(''); setFlashFlipped(false); });
  }

  function getCardIds(): string[] {
    return flashMode() ? section.flashCardIds : section.cardIds;
  }

  function sectionCardType(): 'mcq' | 'passage' | 'flashcard' {
    return getCardType(section.type, flashMode());
  }

  function pushHistoryEntry(cId: string, lookup: { question: Question; scenarioIdx?: number; questionIdx?: number; passage?: string }, optionOrder: string[], passage: string) {
    histNav.push({
      idx: section.type === 'mc-quiz' ? (parseInt(cId.slice(section.id.length + 1), 10) || 0) : 0,
      scenarioIdx: lookup.scenarioIdx, questionIdx: lookup.questionIdx,
      cardId: cId, selected: null, correct: lookup.question.correct,
      optionOrder, isCorrect: false, skipped: false,
      explanation: lookup.question.explanation ?? '', passage,
    });
  }

  function buildQuestionContext(q: Question): string {
    return [q.q, q.correct, q.imageName || q.cropName || '', q.explanation || ''].join(' ');
  }

  function applyMcqCard(cId: string, lookup: { question: Question; passage?: string }, shuffledOptions: string[], passageText: string) {
    batch(() => {
      setCardId(cId);
      setQuestion(lookup.question);
      setOptions(shuffledOptions);
      setSelected(null);
      setIsCorrect(false);
      setPassage(passageText);
      setRatingLabels({});
      setLeechWarning(false);
      setSkipped(false);
      setState('answering');
    });
    timer.start();
    setQuestionContext(buildQuestionContext(lookup.question));
  }

  function applyFlashCard(cardId: string, resolved: { card: { front: string; back: string } }) {
    const defFirst = flashDefFirst();
    batch(() => {
      setFlashCardId(cardId);
      setFlashFront(defFirst ? resolved.card.back : resolved.card.front);
      setFlashBack(defFirst ? resolved.card.front : resolved.card.back);
      setFlashFlipped(false);
      setRatingLabels({});
      setState('answering');
    });
    setQuestionContext([resolved.card.front, resolved.card.back].join(' '));
  }

  const cram = createCramSession({
    projectSlug: () => project()?.slug,
    sectionId: section.id,
    flashMode,
    sectionType: section.type,
    onPickMcq: (cardId) => {
      const lookup = lookupQuestion(section, cardId);
      if (!lookup) { cram.endCram(); setState('done'); return; }
      const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
      applyMcqCard(cardId, lookup, shuffled, lookup.passage ?? '');
    },
    onPickFlash: (cardId) => {
      const resolved = resolveFlashCard(section, cardId);
      if (!resolved) { cram.endCram(); setState('done'); return; }
      applyFlashCard(cardId, resolved);
    },
    onDone: () => {
      cram.endCram();
      setState('done');
    },
  });

  async function refreshDue() {
    const p = project();
    if (!p) return;
    const slug = p.slug;
    const cardType = sectionCardType();
    const ids = cardType === 'flashcard' ? section.flashCardIds : section.cardIds;
    if (ids.length === 0) return;
    const result = await workerApi.countDue(slug, [section.id], cardType);
    if (project()?.slug !== slug) return; // Stale: project changed while fetching
    if (sectionCardType() !== cardType) return; // Stale: mode changed while fetching
    setDueCount(result);
  }

  async function pickNextCard() {
    await guard.withActing(async () => {
      try {
        await pickNextCardImpl();
      } catch (err) {
        console.error(`[quiz:${section.id}] pickNextCard error:`, err);
        if (state() === 'idle') setState('done');
      }
    });
  }

  async function pickNextCardImpl() {
    if (cram.cramMode()) { await cram.pickNextCram(); return; }
    let p = project();
    if (!p) {
      for (let i = 0; i < 3 && !p; i++) {
        await new Promise(r => setTimeout(r, 150));
        p = project();
      }
    }
    if (!p) { setState('done'); return; }

    if (sessionSummary()) setSessionSummary(null);

    batch(() => { setLeechWarning(false); setSkipped(false); });
    histNav.clearReview();

    const ids = getCardIds();
    if (ids.length === 0) { setState('done'); return; }

    const cardType = sectionCardType();
    const result = await workerApi.pickNext(p.slug, [section.id], p.config.new_per_session, cardType);
    if (flashMode()) return; // Stale: flash mode toggled during pick — flash path handles it
    if (!result.cardId) { setState('done'); return; }

    const lookup = lookupQuestion(section, result.cardId);
    if (!lookup) { setState('done'); return; }

    const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
    const passageText = lookup.passage ?? '';

    applyMcqCard(result.cardId, lookup, shuffled, passageText);
    pushHistoryEntry(result.cardId, lookup, shuffled, passageText);

    await refreshDue();
  }

  async function answer(option: string) {
    if (state() !== 'answering') return;
    const elapsed = timer.stop();
    const q = question();
    const cId = cardId();
    const p = project();
    if (!q || !cId || !p) return;
    await guard.withActing(async () => {
      const correct = option === q.correct;

      batch(() => {
        setSelected(option);
        setIsCorrect(correct);
        setState('revealed');
        setSkipped(false);
      });

      const s = await workerApi.updateScore(p.slug, section.id, correct);
      setScore({ correct: s.correct, attempted: s.attempted });

      const entry = histNav.getEntry(histNav.getPos());
      if (entry && entry.cardId === cId) {
        entry.selected = option;
        entry.correct = q.correct;
        entry.optionOrder = options();
        entry.isCorrect = correct;
        entry.explanation = q.explanation ?? '';
      }

      if (easyMode()) {
        const autoRating = correct ? timeToRating(elapsed) : 1;
        await doRate(cId, autoRating);
      }
    });
  }

  async function doSkip() {
    if (state() !== 'answering') return;
    timer.stop();
    const q = question();
    const cId = cardId();
    const p = project();
    if (!q || !cId || !p) return;
    await guard.withActing(async () => {
      batch(() => {
        setSelected(null);
        setIsCorrect(false);
        setState('revealed');
        setSkipped(true);
      });

      const s = await workerApi.updateScore(p.slug, section.id, false);
      setScore({ correct: s.correct, attempted: s.attempted });

      const entry = histNav.getEntry(histNav.getPos());
      if (entry && entry.cardId === cId) {
        entry.selected = null;
        entry.correct = q.correct;
        entry.optionOrder = options();
        entry.isCorrect = false;
        entry.skipped = true;
        entry.explanation = q.explanation ?? '';
      }

      await doRate(cId, 1);
    });
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

  async function rate(rating: number) {
    if (state() !== 'revealed') return;
    const cId = cardId();
    if (!cId) return;
    await guard.withActing(async () => doRate(cId, rating));
  }

  async function flagWrong() {
    const cId = cardId();
    const p = project();
    if (!cId || !p) return;
    await guard.withActing(async () => {
      const st = state();
      if (st === 'revealed') {
        await doRate(cId, 1);
      } else if (st === 'rated') {
        const result = await workerApi.undoReview();
        if (result.undone) await doRate(cId, 1);
      }
    });
  }

  async function undoAction() {
    const st = state();
    if (st !== 'revealed' && st !== 'rated') return;
    const cId = cardId();
    if (!cId) return;
    await guard.withActing(async () => {
      const result = await workerApi.undoReview();
      if (result.undone && result.cardId) {
        const restoredId = result.cardId;
        const lookup = lookupQuestion(section, restoredId);
        if (lookup) {
          const newOptions = shuffle([lookup.question.correct, ...lookup.question.wrong]);
          const entry = histNav.getEntry(histNav.getPos());
          if (entry && entry.cardId === restoredId) {
            entry.selected = null;
            entry.isCorrect = false;
            entry.skipped = false;
            entry.optionOrder = newOptions;
          }
          applyMcqCard(restoredId, lookup, newOptions, lookup.passage ?? '');
          await refreshDue();
        }
      }
    });
  }

  async function suspendAction() {
    const cId = cardId();
    if (!cId) return;
    await guard.withActing(async () => {
      await workerApi.suspendCard(cId);
      await refreshDue();
      await pickNextCardImpl();
    });
  }

  async function buryAction() {
    const cId = cardId();
    if (!cId) return;
    await guard.withActing(async () => {
      await workerApi.buryCard(cId);
      await refreshDue();
      await pickNextCardImpl();
    });
  }

  async function pickNextFlash() {
    if (cram.cramMode()) { await cram.pickNextCram(); return; }
    const p = project();
    if (!p || !section.flashcards || section.flashCardIds.length === 0) return;

    const result = await workerApi.pickNext(p.slug, [section.id], p.config.new_per_session, 'flashcard');
    if (!flashMode()) return; // Stale: flash mode toggled off while fetching

    if (!result.cardId) {
      batch(() => {
        setFlashCardId(null);
        setFlashFront('');
        setFlashBack('');
        setFlashFlipped(false);
        setState('done');
      });
      await refreshDue();
      return;
    }

    const resolved = resolveFlashCard(section, result.cardId);
    if (!resolved) {
      setFlashError();
      return;
    }

    applyFlashCard(result.cardId, resolved);
    await refreshDue();
  }

  function flipFlash() {
    if (guard.isActing()) return;
    const flipped = !flashFlipped();
    setFlashFlipped(flipped);
    const cId = flashCardId();
    if (flipped && cId) {
      const captured = cId;
      workerApi.previewRatings(cId).then(preview => {
        if (flashCardId() === captured) setRatingLabels(preview.labels);
      }).catch(() => {});
    }
  }

  async function rateFlashAction(rating: number) {
    const fId = flashCardId();
    const p = project();
    if (!fId || !p) return;
    await guard.withActing(async () => {
      if (cram.cramMode()) {
        workerApi.addActivity(p.slug, section.id, rating, rating !== 1).catch(() => {});
        pushChartEntry(rating, rating !== 1);
        cram.markSeen(fId);
        await cram.pickNextCram();
        return;
      }

      await workerApi.reviewCard(fId, p.slug, section.id, rating);
      workerApi.addActivity(p.slug, section.id, rating, rating !== 1).catch(() => {});
      pushChartEntry(rating, rating !== 1);
      autoSave(p.slug);
      await pickNextFlash();
    });
  }

  function toggleFlashMode() {
    if (guard.isActing() || modeSwitch) return;
    modeSwitch = true;
    const next = !flashMode();
    batch(() => { setFlashMode(next); bumpHandlerVersion(); });
    (next ? pickNextFlash() : pickNextCard()).catch(() => {}).finally(() => { modeSwitch = false; });
  }

  function restoreHistoryEntry(entry: HistoryEntry) {
    const lookup = lookupQuestion(section, entry.cardId);
    if (!lookup) return;

    // Unanswered entry: go straight to answering
    if (entry.selected === null && !entry.skipped) {
      batch(() => {
        setLeechWarning(false);
        setCardId(entry.cardId);
        setQuestion(lookup.question);
        setOptions(entry.optionOrder);
        setSelected(null);
        setIsCorrect(false);
        setSkipped(false);
        setPassage(entry.passage);
        setState('answering');
      });
      timer.start();
      return;
    }

    // Answered entry: show in review mode
    batch(() => {
      setLeechWarning(false);
      setCardId(entry.cardId);
      setQuestion(lookup.question);
      if (entry.optionOrder.length > 0) {
        setOptions(entry.optionOrder);
      }
      setSelected(entry.selected);
      setIsCorrect(entry.isCorrect);
      setSkipped(entry.skipped);
      setPassage(entry.passage);
      setRatingLabels({});
      setState('reviewing-history');
    });
  }

  function goBackHistory() {
    if (guard.isActing()) return;
    histNav.goBack(restoreHistoryEntry);
  }

  function advanceFromHistory() {
    if (guard.isActing()) return;
    if (state() !== 'reviewing-history') return;
    histNav.advance(restoreHistoryEntry, () => pickNextCard().catch(() => {}));
  }

  async function shuffleFlashAction() {
    if (!section.flashcards || section.flashCardIds.length === 0) return;
    const idx = Math.floor(Math.random() * section.flashcards.length);
    const card = section.flashcards[idx];
    const fId = section.flashCardIds[idx];
    if (!card || !fId) return;
    await guard.withActing(async () => {
      applyFlashCard(fId, { card });
      await refreshDue();
    });
  }

  async function shuffleMcq() {
    const p = project();
    if (!p) return;
    const ids = section.cardIds;
    if (ids.length === 0) return;
    await guard.withActing(async () => {
      const randomId = ids[Math.floor(Math.random() * ids.length)];
      const lookup = lookupQuestion(section, randomId);
      if (!lookup) return;
      const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
      const passageText = lookup.passage ?? '';
      applyMcqCard(randomId, lookup, shuffled, passageText);
      pushHistoryEntry(randomId, lookup, shuffled, passageText);
      await refreshDue();
    });
  }

  async function studyMore() {
    const p = project();
    if (!p) return;
    await guard.withActing(async () => {
      await pickNextCardImpl();
      if (state() !== 'done') return;

      // Fall back to weakest card by stability in this section
      const cardType = sectionCardType();
      const result = await workerApi.pickNextOverride(p.slug, [section.id], cardType);
      if (result.cardId) {
        if (flashMode()) {
          const resolved = resolveFlashCard(section, result.cardId);
          if (!resolved) return;
          applyFlashCard(result.cardId, resolved);
        } else {
          const lookup = lookupQuestion(section, result.cardId);
          if (!lookup) return;
          const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
          const passageText = lookup.passage ?? '';
          applyMcqCard(result.cardId, lookup, shuffled, passageText);
          pushHistoryEntry(result.cardId, lookup, shuffled, passageText);
        }
        await refreshDue();
        return;
      }

      // Nothing in this section — find another section with due cards
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
        await pickNextFlash();
      } else {
        await pickNextCardImpl();
      }
    });
  }

  async function unburyAllAction() {
    const p = project();
    if (!p) return;
    await guard.withActing(async () => {
      await workerApi.unburyAll(p.slug);
      if (flashMode()) {
        await pickNextFlash();
      } else {
        await pickNextCardImpl();
      }
    });
  }

  async function resetSectionAction() {
    const p = project();
    if (!p) return;
    await guard.withActing(async () => {
      await workerApi.resetSection(p.slug, section.id);
      const mcqType: 'mcq' | 'passage' = section.type === 'passage-quiz' ? 'passage' : 'mcq';
      const cardRegs = [
        ...section.cardIds.map(id => ({
          sectionId: section.id,
          cardId: id,
          cardType: mcqType,
        })),
        ...section.flashCardIds.map(id => ({
          sectionId: section.id,
          cardId: id,
          cardType: 'flashcard' as const,
        })),
      ];
      await workerApi.loadProject(p.slug, [section.id], cardRegs);
      histNav.reset();
      cram.endCram();
      setScore({ correct: 0, attempted: 0 });
      if (flashMode()) {
        await pickNextFlash();
      } else {
        await pickNextCardImpl();
      }
    });
  }

  function currentImageLink(): string {
    const q = question();
    if (!q) return '';
    const imgName = q.imageName || q.cropName;
    if (!imgName) return '';
    const suffix = project()?.config.imageSearchSuffix ?? '';
    const query = suffix ? `${imgName} ${suffix}` : imgName;
    return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query);
  }

  return {
    state,
    cardId,
    question,
    options,
    selected,
    isCorrect,
    ratingLabels,
    score,
    dueCount,
    flashMode,
    flashCardId,
    flashFlipped,
    flashFront,
    flashBack,
    flashDefFirst,
    passage,
    historyReview: histNav.historyReview,
    leechWarning,
    skipped,
    currentImageLink,
    cramMode: cram.cramMode,
    cramCount: cram.cramCount,

    pickNextCard,
    answer,
    skip: doSkip,
    rate,
    undo: undoAction,
    suspend: suspendAction,
    bury: buryAction,
    flipFlash,
    rateFlash: rateFlashAction,
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
    advanceFromHistory,
    goBackHistory,
    shuffleFlash: shuffleFlashAction,
    shuffleMcq,
    resetSection: resetSectionAction,
    refreshDue,
    studyMore,
    flagWrong,
    startCram: startCramAction,
    endCram: () => { cram.endCram(); setState('done'); },
    increaseNewCards,
    unburyAll: unburyAllAction,

    timer,
    paused: timer.paused,
    togglePause: () => { timer.paused() ? timer.resume() : timer.pause(); },
  };
}

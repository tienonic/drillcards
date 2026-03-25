import { createSignal, createEffect, batch } from 'solid-js';
import { workerApi } from '../../core/hooks/useWorker.ts';
import { useTimer } from '../../core/hooks/useTimer.ts';
import { shuffle } from '../../utils/shuffle.ts';
import { activeProject, easyMode, sessionSummary, setSessionSummary, setActiveTab } from '../../core/store/app.ts';
import { autoSave } from '../backup/backup.ts';
import { setQuestionContext } from '../glossary/store.ts';
import { pushChartEntry } from '../activity/store.ts';
import type { Section, Question } from '../../projects/types.ts';

type QuizState = 'idle' | 'answering' | 'revealed' | 'rated' | 'reviewing-history' | 'done';

interface HistoryEntry {
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

export interface QuizSession {
  state: () => QuizState;
  cardId: () => string | null;
  question: () => Question | null;
  options: () => string[];
  selected: () => string | null;
  isCorrect: () => boolean;
  ratingLabels: () => Record<number, string>;
  score: () => { correct: number; attempted: number };
  dueCount: () => { due: number; newCount: number; total: number };
  flashMode: () => boolean;
  flashCardId: () => string | null;
  flashFlipped: () => boolean;
  flashFront: () => string;
  flashBack: () => string;
  flashDefFirst: () => boolean;
  passage: () => string;
  historyReview: () => HistoryEntry | null;
  leechWarning: () => boolean;
  skipped: () => boolean;
  currentImageLink: () => string;
  cramMode: () => boolean;
  cramCount: () => number;
  pickNextCard: () => Promise<void>;
  answer: (option: string) => Promise<void>;
  skip: () => Promise<void>;
  rate: (rating: number) => Promise<void>;
  undo: () => Promise<void>;
  suspend: () => Promise<void>;
  bury: () => Promise<void>;
  flipFlash: () => void;
  rateFlash: (rating: number) => Promise<void>;
  toggleFlashMode: () => void;
  setFlashDefFirst: (v: boolean) => void;
  advanceFromHistory: () => void;
  goBackHistory: () => void;
  shuffleFlash: () => Promise<void>;
  shuffleMcq: () => Promise<void>;
  resetSection: () => Promise<void>;
  refreshDue: () => Promise<void>;
  studyMore: () => Promise<void>;
  flagWrong: () => Promise<void>;
  startCram: () => Promise<void>;
  endCram: () => void;
  increaseNewCards: (count?: number) => Promise<void>;
  unburyAll: () => Promise<void>;
  timer:{ seconds: () => number; start: () => void; stop: () => number; reset: () => void; pause: () => void; resume: () => void; paused: () => boolean };
  paused: () => boolean;
  togglePause: () => void;
}

import { bumpHandlerVersion, sectionHandlers } from '../../core/store/sections.ts';

function timeToRating(seconds: number): number {
  if (seconds >= 59) return 1; // Again
  if (seconds >= 40) return 2; // Hard
  if (seconds >= 8) return 3;  // Good
  return 4; // Easy
}

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
  const [historyReview, setHistoryReview] = createSignal<HistoryEntry | null>(null);
  const [leechWarning, setLeechWarning] = createSignal(false);
  const [skipped, setSkipped] = createSignal(false);
  const [cramMode, setCramMode] = createSignal(false);
  const [cramCount, setCramCount] = createSignal(0);
  const cramSeen = new Set<string>();

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

  let history: HistoryEntry[] = [];
  let histPos = -1;
  let picking = false;
  let acting = false;
  let modeSwitch = false;

  function setFlashError(msg = 'Card data mismatch') {
    batch(() => { setFlashCardId(null); setFlashFront(msg); setFlashBack(''); setFlashFlipped(false); });
  }

  function getCardIds(): string[] {
    return flashMode() ? section.flashCardIds : section.cardIds;
  }

  function getCardType(): 'mcq' | 'passage' | 'flashcard' {
    if (flashMode()) return 'flashcard';
    return section.type === 'passage-quiz' ? 'passage' : 'mcq';
  }

  function lookupQuestion(cId: string): { question: Question; scenarioIdx?: number; questionIdx?: number; passage?: string } | null {
    if (section.type === 'mc-quiz' && section.questions) {
      const idx = parseInt(cId.slice(section.id.length + 1), 10);
      if (isNaN(idx)) return null;
      const q = section.questions[idx];
      return q ? { question: q } : null;
    }
    if (section.type === 'passage-quiz' && section.scenarios) {
      // Card ID format: sectionId-scenarioIdx-questionIdx
      const suffix = cId.slice(section.id.length + 1); // remove "sectionId-"
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
        passage: scenario.passage + (scenario.source ? `<span class="source">${scenario.source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>` : ''),
      };
    }
    return null;
  }

  function pushHistoryEntry(cardId: string, lookup: { question: Question; scenarioIdx?: number; questionIdx?: number; passage?: string }, optionOrder: string[], passage: string) {
    history = history.slice(0, ++histPos);
    history.push({
      idx: section.type === 'mc-quiz' ? (parseInt(cardId.slice(section.id.length + 1), 10) || 0) : 0,
      scenarioIdx: lookup.scenarioIdx, questionIdx: lookup.questionIdx,
      cardId, selected: null, correct: lookup.question.correct,
      optionOrder, isCorrect: false, skipped: false,
      explanation: lookup.question.explanation ?? '', passage,
    });
  }

  async function refreshDue() {
    const p = project();
    if (!p) return;
    const slug = p.slug;
    const cardType = getCardType();
    const ids = cardType === 'flashcard' ? section.flashCardIds : section.cardIds;
    if (ids.length === 0) return;
    const result = await workerApi.countDue(slug, [section.id], cardType);
    if (project()?.slug !== slug) return; // Stale: project changed while fetching
    if (getCardType() !== cardType) return; // Stale: mode changed while fetching
    setDueCount(result);
  }

  async function pickNextCard() {
    if (picking) return;
    picking = true;
    try {
      await pickNextCardImpl();
    } catch (err) {
      console.error(`[quiz:${section.id}] pickNextCard error:`, err);
      if (state() === 'idle') setState('done');
    } finally {
      picking = false;
    }
  }

  async function pickNextCardImpl() {
    if (cramMode()) { await pickNextCram(); return; }
    let p = project();
    if (!p) {
      for (let i = 0; i < 3 && !p; i++) {
        await new Promise(r => setTimeout(r, 150));
        p = project();
      }
    }
    if (!p) { setState('done'); return; }

    if (sessionSummary()) setSessionSummary(null);

    batch(() => { setLeechWarning(false); setHistoryReview(null); setSkipped(false); });

    const ids = getCardIds();
    if (ids.length === 0) { setState('done'); return; }

    const cardType = getCardType();
    const result = await workerApi.pickNext(p.slug, [section.id], p.config.new_per_session, cardType);
    if (flashMode()) { setState('done'); return; }
    if (!result.cardId) { setState('done'); return; }

    const lookup = lookupQuestion(result.cardId);
    if (!lookup) { setState('done'); return; }

    const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
    const passageText = lookup.passage ?? '';

    batch(() => {
      setCardId(result.cardId);
      setQuestion(lookup.question);
      setOptions(shuffled);
      setSelected(null);
      setIsCorrect(false);
      setPassage(passageText);
      setRatingLabels({});
      setState('answering');
    });

    pushHistoryEntry(result.cardId, lookup, shuffled, passageText);

    timer.start();
    const q = lookup.question;
    setQuestionContext([q.q, q.correct, q.imageName || q.cropName || '', q.explanation || ''].join(' '));

    await refreshDue();
  }

  async function answer(option: string) {
    if (acting || state() !== 'answering') return;
    const elapsed = timer.stop();
    const q = question();
    const cId = cardId();
    const p = project();
    if (!q || !cId || !p) return;
    acting = true;
    try {
      const correct = option === q.correct;

      batch(() => {
        setSelected(option);
        setIsCorrect(correct);
        setState('revealed');
        setSkipped(false);
      });

      const s = await workerApi.updateScore(p.slug, section.id, correct);
      setScore({ correct: s.correct, attempted: s.attempted });

      const entry = history[histPos];
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
    } finally { acting = false; }
  }

  async function doSkip() {
    if (acting || state() !== 'answering') return;
    timer.stop();
    const q = question();
    const cId = cardId();
    const p = project();
    if (!q || !cId || !p) return;
    acting = true;
    try {
      batch(() => {
        setSelected(null);
        setIsCorrect(false);
        setState('revealed');
        setSkipped(true);
      });

      const s = await workerApi.updateScore(p.slug, section.id, false);
      setScore({ correct: s.correct, attempted: s.attempted });

      const entry = history[histPos];
      if (entry && entry.cardId === cId) {
        entry.selected = null;
        entry.correct = q.correct;
        entry.optionOrder = options();
        entry.isCorrect = false;
        entry.skipped = true;
        entry.explanation = q.explanation ?? '';
      }

      await doRate(cId, 1);
    } finally { acting = false; }
  }

  async function doRate(cId: string, rating: number) {
    const p = project();
    if (!p) return;

    if (cramMode()) {
      workerApi.addActivity(p.slug, section.id, rating, rating !== 1).catch(() => {});
      pushChartEntry(rating, rating !== 1);
      cramSeen.add(cId);
      batch(() => { setCramCount(cramSeen.size); setState('rated'); });
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
    if (acting || state() !== 'revealed') return;
    const cId = cardId();
    if (!cId) return;
    acting = true;
    try { await doRate(cId, rating); } finally { acting = false; }
  }

  async function flagWrong() {
    if (acting) return;
    const cId = cardId();
    const p = project();
    if (!cId || !p) return;
    acting = true;
    try {
      const st = state();
      if (st === 'revealed') {
        await doRate(cId, 1);
      } else if (st === 'rated') {
        const result = await workerApi.undoReview();
        if (result.undone) await doRate(cId, 1);
      }
    } finally { acting = false; }
  }

  async function undoAction() {
    if (acting) return;
    const st = state();
    if (st !== 'revealed' && st !== 'rated') return;
    const cId = cardId();
    if (!cId) return;
    acting = true;
    try {
      const result = await workerApi.undoReview();
      if (result.undone && result.cardId) {
        const restoredId = result.cardId;
        const lookup = lookupQuestion(restoredId);
        if (lookup) {
          const newOptions = shuffle([lookup.question.correct, ...lookup.question.wrong]);
          const entry = history[histPos];
          if (entry && entry.cardId === restoredId) {
            entry.selected = null;
            entry.isCorrect = false;
            entry.skipped = false;
            entry.optionOrder = newOptions;
          }
          batch(() => {
            setCardId(restoredId);
            setQuestion(lookup.question);
            setOptions(newOptions);
            setSelected(null);
            setIsCorrect(false);
            setPassage(lookup.passage ?? '');
            setRatingLabels({});
            setState('answering');
            setLeechWarning(false);
            setSkipped(false);
          });
          timer.start();
          await refreshDue();
        }
      }
    } finally { acting = false; }
  }

  async function suspendAction() {
    if (acting) return;
    const cId = cardId();
    if (!cId) return;
    acting = true;
    try {
      await workerApi.suspendCard(cId);
      await refreshDue();
      await pickNextCard();
    } finally { acting = false; }
  }

  async function buryAction() {
    if (acting) return;
    const cId = cardId();
    if (!cId) return;
    acting = true;
    try {
      await workerApi.buryCard(cId);
      await refreshDue();
      await pickNextCard();
    } finally { acting = false; }
  }

  async function pickNextFlash() {
    flashRated = false;
    if (cramMode()) { await pickNextCram(); return; }
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

    const flashPrefix = section.id + '-flash-';
    if (!result.cardId.startsWith(flashPrefix)) {
      setFlashError();
      return;
    }
    const idx = parseInt(result.cardId.slice(flashPrefix.length), 10);
    if (isNaN(idx)) {
      setFlashError();
      return;
    }
    const card = section.flashcards[idx];
    if (!card) {
      setFlashError();
      return;
    }

    const defFirst = flashDefFirst();
    batch(() => {
      setFlashCardId(result.cardId);
      setFlashFront(defFirst ? card.back : card.front);
      setFlashBack(defFirst ? card.front : card.back);
      setFlashFlipped(false);
      setRatingLabels({});
      setState('answering');
    });

    setQuestionContext([card.front, card.back].join(' '));

    await refreshDue();
  }

  let flashRated = false;

  function flipFlash() {
    if (acting) return;
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
    if (acting || flashRated) return;
    const fId = flashCardId();
    const p = project();
    if (!fId || !p) return;
    flashRated = true;
    acting = true;
    try {
      if (cramMode()) {
        workerApi.addActivity(p.slug, section.id, rating, rating !== 1).catch(() => {});
        pushChartEntry(rating, rating !== 1);
        cramSeen.add(fId);
        await pickNextCram();
        return;
      }

      await workerApi.reviewCard(fId, p.slug, section.id, rating);
      workerApi.addActivity(p.slug, section.id, rating, rating !== 1).catch(() => {});
      pushChartEntry(rating, rating !== 1);
      autoSave(p.slug);
      await pickNextFlash();
    } finally { acting = false; }
  }

  function toggleFlashMode() {
    if (acting || modeSwitch) return;
    modeSwitch = true;
    const next = !flashMode();
    batch(() => { setFlashMode(next); bumpHandlerVersion(); });
    (next ? pickNextFlash() : pickNextCard()).catch(() => {}).finally(() => { modeSwitch = false; });
  }

  function goBackHistory() {
    if (acting || picking) return;
    if (history.length === 0 || histPos <= 0) return;
    histPos--;
    const entry = history[histPos];
    if (!entry) return;

    const lookup = lookupQuestion(entry.cardId);
    if (!lookup) return;

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
      setHistoryReview(entry);
      setState('reviewing-history');
    });
  }

  function advanceFromHistory() {
    if (acting || picking) return;
    if (state() !== 'reviewing-history') return;
    if (histPos < history.length - 1) {
      histPos++;
      const entry = history[histPos];
      // Restore unanswered card directly (don't re-pick from scheduler)
      if (entry && entry.selected === null && !entry.skipped) {
        const lookup = lookupQuestion(entry.cardId);
        if (lookup) {
          batch(() => {
            setHistoryReview(null);
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
      }
      if (entry && (section.type === 'mc-quiz' || section.type === 'passage-quiz')) {
        const lookup = lookupQuestion(entry.cardId);
        if (lookup) {
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
            setHistoryReview(entry);
            setState('reviewing-history');
          });
          return;
        }
      }
    }
    setHistoryReview(null);
    pickNextCard().catch(() => {});
  }

  async function shuffleFlashAction() {
    if (acting) return;
    flashRated = false;
    if (!section.flashcards || section.flashCardIds.length === 0) return;
    const idx = Math.floor(Math.random() * section.flashcards.length);
    const card = section.flashcards[idx];
    const fId = section.flashCardIds[idx];
    if (!card || !fId) return;
    acting = true;
    try {
      const defFirst = flashDefFirst();
      batch(() => {
        setFlashCardId(fId);
        setFlashFront(defFirst ? card.back : card.front);
        setFlashBack(defFirst ? card.front : card.back);
        setFlashFlipped(false);
        setRatingLabels({});
        if (state() === 'done') setState('answering');
      });

      setQuestionContext([card.front, card.back].join(' '));
      await refreshDue();
    } finally { acting = false; }
  }

  async function shuffleMcq() {
    if (acting) return;
    const p = project();
    if (!p) return;
    const ids = section.cardIds;
    if (ids.length === 0) return;
    acting = true;
    try {
      const randomId = ids[Math.floor(Math.random() * ids.length)];
      const lookup = lookupQuestion(randomId);
      if (!lookup) return;
      const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
      const passageText = lookup.passage ?? '';
      batch(() => {
        setCardId(randomId);
        setQuestion(lookup.question);
        setOptions(shuffled);
        setSelected(null);
        setIsCorrect(false);
        setPassage(passageText);
        setRatingLabels({});
        setLeechWarning(false);
        setSkipped(false);
        setState('answering');
      });
      pushHistoryEntry(randomId, lookup, shuffled, passageText);
      timer.start();
      setQuestionContext([lookup.question.q, lookup.question.correct, lookup.question.imageName || lookup.question.cropName || '', lookup.question.explanation || ''].join(' '));
      await refreshDue();
    } finally { acting = false; }
  }

  async function studyMore() {
    if (acting) return;
    const p = project();
    if (!p) return;
    acting = true;
    try {
      await pickNextCard();
      if (state() !== 'done') return;

      // Fall back to weakest card by stability in this section
      const cardType = getCardType();
      const result = await workerApi.pickNextOverride(p.slug, [section.id], cardType);
      if (result.cardId) {
        if (flashMode()) {
          const flashPrefix = section.id + '-flash-';
          if (!result.cardId.startsWith(flashPrefix)) return;
          const idx = parseInt(result.cardId.slice(flashPrefix.length), 10);
          if (isNaN(idx)) return;
          const card = section.flashcards?.[idx];
          if (!card) return;
          const defFirst = flashDefFirst();
          batch(() => {
            setFlashCardId(result.cardId);
            setFlashFront(defFirst ? card.back : card.front);
            setFlashBack(defFirst ? card.front : card.back);
            setFlashFlipped(false);
            setRatingLabels({});
            setState('answering');
          });
          setQuestionContext([card.front, card.back].join(' '));
        } else {
          const lookup = lookupQuestion(result.cardId);
          if (!lookup) return;
          const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
          batch(() => {
            setCardId(result.cardId);
            setQuestion(lookup.question);
            setOptions(shuffled);
            setSelected(null);
            setIsCorrect(false);
            setPassage(lookup.passage ?? '');
            setRatingLabels({});
            setState('answering');
          });
          pushHistoryEntry(result.cardId, lookup, shuffled, lookup.passage ?? '');
          timer.start();
          const q = lookup.question;
          const ctx = [q.q, q.correct, q.imageName || q.cropName || '', q.explanation || ''].join(' ');
          setQuestionContext(ctx);
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
          if (handler) await handler.pickNextCard();
          return;
        }
      }
    } finally { acting = false; }
  }

  async function pickNextCram() {
    const p = project();
    if (!p) return;
    const wasFlash = flashMode();
    const cardType = getCardType();
    const result = await workerApi.pickNextOverride(p.slug, [section.id], cardType, [...cramSeen]);
    if (flashMode() !== wasFlash) return; // Mode toggled during fetch — other path is handling it
    if (!result.cardId) {
      endCram();
      return;
    }

    if (flashMode()) {
      const flashPrefix = section.id + '-flash-';
      if (!result.cardId.startsWith(flashPrefix)) { endCram(); return; }
      const idx = parseInt(result.cardId.slice(flashPrefix.length), 10);
      if (isNaN(idx)) { endCram(); return; }
      const card = section.flashcards?.[idx];
      if (!card) { endCram(); return; }
      const defFirst = flashDefFirst();
      batch(() => {
        setFlashCardId(result.cardId);
        setFlashFront(defFirst ? card.back : card.front);
        setFlashBack(defFirst ? card.front : card.back);
        setFlashFlipped(false);
        setRatingLabels({});
        setCramCount(cramSeen.size);
        setState('answering');
      });
      setQuestionContext([card.front, card.back].join(' '));
    } else {
      const lookup = lookupQuestion(result.cardId);
      if (!lookup) { endCram(); return; }
      const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
      batch(() => {
        setCardId(result.cardId);
        setQuestion(lookup.question);
        setOptions(shuffled);
        setSelected(null);
        setIsCorrect(false);
        setPassage(lookup.passage ?? '');
        setRatingLabels({});
        setCramCount(cramSeen.size);
        setState('answering');
      });
      timer.start();
      const q = lookup.question;
      const ctx = [q.q, q.correct, q.imageName || q.cropName || '', q.explanation || ''].join(' ');
      setQuestionContext(ctx);
    }
  }

  async function startCram() {
    if (acting) return;
    cramSeen.clear();
    acting = true;
    try {
      batch(() => { setCramCount(0); setCramMode(true); });
      await pickNextCram();
    } finally { acting = false; }
  }

  function endCram() {
    cramSeen.clear();
    batch(() => { setCramMode(false); setCramCount(0); setState('done'); });
  }

  async function increaseNewCards(count?: number) {
    if (acting) return;
    const p = project();
    if (p && count != null) p.config.new_per_session = count;
    acting = true;
    try {
      await workerApi.resetNewCount();
      if (flashMode()) {
        await pickNextFlash();
      } else {
        await pickNextCard();
      }
    } finally { acting = false; }
  }

  async function unburyAllAction() {
    if (acting) return;
    const p = project();
    if (!p) return;
    acting = true;
    try {
      await workerApi.unburyAll(p.slug);
      if (flashMode()) {
        await pickNextFlash();
      } else {
        await pickNextCard();
      }
    } finally { acting = false; }
  }

  async function resetSectionAction() {
    if (acting) return;
    const p = project();
    if (!p) return;
    acting = true;
    try {
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
      history = [];
      histPos = -1;
      cramSeen.clear();
      batch(() => { setScore({ correct: 0, attempted: 0 }); setCramMode(false); setCramCount(0); });
      if (flashMode()) {
        await pickNextFlash();
      } else {
        await pickNextCard();
      }
    } finally { acting = false; }
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
    historyReview,
    leechWarning,
    skipped,
    currentImageLink,
    cramMode,
    cramCount,

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
      if (!fId || !section.flashcards) return;
      const flashPrefix = section.id + '-flash-';
      if (!fId.startsWith(flashPrefix)) return;
      const idx = parseInt(fId.slice(flashPrefix.length), 10);
      if (isNaN(idx)) return;
      const card = section.flashcards[idx];
      if (!card) return;
      batch(() => {
        setFlashFront(v ? card.back : card.front);
        setFlashBack(v ? card.front : card.back);
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
    startCram,
    endCram,
    increaseNewCards,
    unburyAll: unburyAllAction,

    timer,
    paused: timer.paused,
    togglePause: () => { timer.paused() ? timer.resume() : timer.pause(); },
  };
}

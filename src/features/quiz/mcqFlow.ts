import { batch } from 'solid-js';
import { shuffle } from '../../utils/shuffle.ts';
import { easyMode, sessionSummary, setSessionSummary } from '../../core/store/app.ts';
import { setQuestionContext } from '../glossary/store.ts';
import { timeToRating, lookupQuestion, getCardType } from './helpers.ts';
import { createHistoryNav, type HistoryEntry } from './historyNav.ts';
import type { ProjectApi } from '../../core/hooks/useWorker.ts';
import type { Guard } from './guard.ts';
import type { Section, Question } from '../../projects/types.ts';
import type { QuizState } from './types.ts';

export interface McqSignals {
  state: () => QuizState;
  setState: (v: QuizState) => void;
  cardId: () => string | null;
  setCardId: (v: string | null) => void;
  question: () => Question | null;
  setQuestion: (v: Question | null) => void;
  options: () => string[];
  setOptions: (v: string[]) => void;
  selected: () => string | null;
  setSelected: (v: string | null) => void;
  isCorrect: () => boolean;
  setIsCorrect: (v: boolean) => void;
  passage: () => string;
  setPassage: (v: string) => void;
  ratingLabels: () => Record<number, string>;
  setRatingLabels: (v: Record<number, string>) => void;
  score: () => { correct: number; attempted: number };
  setScore: (v: { correct: number; attempted: number }) => void;
  leechWarning: () => boolean;
  setLeechWarning: (v: boolean) => void;
  skipped: () => boolean;
  setSkipped: (v: boolean) => void;
  flashMode: () => boolean;
}

export interface McqDeps {
  section: Section;
  project: () => { slug: string; config: { new_per_session: number; imageSearchSuffix: string } } | null;
  guard: Guard;
  timer: { start: () => void; stop: () => number };
  doRate: (cId: string, rating: number) => Promise<void>;
  refreshDue: () => Promise<void>;
  cramMode: () => boolean;
  pickNextCram: () => Promise<void>;
  api: ProjectApi;
}

export function createMcqFlow(s: McqSignals, d: McqDeps) {
  const histNav = createHistoryNav();

  function buildQuestionContext(q: Question): string {
    return [q.q, q.correct, q.imageName || q.cropName || '', q.explanation || ''].join(' ');
  }

  function applyMcqCard(cId: string, lookup: { question: Question; passage?: string }, shuffledOptions: string[], passageText: string) {
    batch(() => {
      s.setCardId(cId);
      s.setQuestion(lookup.question);
      s.setOptions(shuffledOptions);
      s.setSelected(null);
      s.setIsCorrect(false);
      s.setPassage(passageText);
      s.setRatingLabels({});
      s.setLeechWarning(false);
      s.setSkipped(false);
      s.setState('answering');
    });
    d.timer.start();
    setQuestionContext(buildQuestionContext(lookup.question));
  }

  function pushHistoryEntry(cId: string, lookup: { question: Question; scenarioIdx?: number; questionIdx?: number; passage?: string }, optionOrder: string[], passage: string) {
    histNav.push({
      idx: d.section.type === 'mc-quiz' ? (parseInt(cId.slice(d.section.id.length + 1), 10) || 0) : 0,
      scenarioIdx: lookup.scenarioIdx, questionIdx: lookup.questionIdx,
      cardId: cId, selected: null, correct: lookup.question.correct,
      optionOrder, isCorrect: false, skipped: false,
      explanation: lookup.question.explanation ?? '', passage,
    });
  }

  async function pickNextCardImpl() {
    if (d.cramMode()) { await d.pickNextCram(); return; }
    const p = d.project();
    if (!p) { s.setState('done'); return; }

    if (sessionSummary()) setSessionSummary(null);

    batch(() => { s.setLeechWarning(false); s.setSkipped(false); });
    histNav.clearReview();

    const ids = d.section.cardIds;
    if (ids.length === 0) { s.setState('done'); return; }

    const cardType = getCardType(d.section.type, false);
    const result = await d.api.pickNext([d.section.id], p.config.new_per_session, cardType);
    if (s.flashMode()) return; // Stale: flash mode toggled during pick — flash path handles it
    if (!result.cardId) { s.setState('done'); return; }

    const lookup = lookupQuestion(d.section, result.cardId);
    if (!lookup) { s.setState('done'); return; }

    const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
    const passageText = lookup.passage ?? '';

    applyMcqCard(result.cardId, lookup, shuffled, passageText);
    pushHistoryEntry(result.cardId, lookup, shuffled, passageText);

    await d.refreshDue();
  }

  async function answer(option: string) {
    if (s.state() !== 'answering') return;
    const elapsed = d.timer.stop();
    const q = s.question();
    const cId = s.cardId();
    const p = d.project();
    if (!q || !cId || !p) return;
    await d.guard.withActing(async () => {
      const correct = option === q.correct;

      batch(() => {
        s.setSelected(option);
        s.setIsCorrect(correct);
        s.setState('revealed');
        s.setSkipped(false);
      });

      const sc = await d.api.updateScore(d.section.id, correct);
      s.setScore({ correct: sc.correct, attempted: sc.attempted });

      const entry = histNav.getEntry(histNav.getPos());
      if (entry && entry.cardId === cId) {
        entry.selected = option;
        entry.correct = q.correct;
        entry.optionOrder = s.options();
        entry.isCorrect = correct;
        entry.explanation = q.explanation ?? '';
      }

      if (easyMode()) {
        const autoRating = correct ? timeToRating(elapsed) : 1;
        await d.doRate(cId, autoRating);
      }
    });
  }

  async function doSkip() {
    if (s.state() !== 'answering') return;
    d.timer.stop();
    const q = s.question();
    const cId = s.cardId();
    const p = d.project();
    if (!q || !cId || !p) return;
    await d.guard.withActing(async () => {
      batch(() => {
        s.setSelected(null);
        s.setIsCorrect(false);
        s.setState('revealed');
        s.setSkipped(true);
      });

      const sc = await d.api.updateScore(d.section.id, false);
      s.setScore({ correct: sc.correct, attempted: sc.attempted });

      const entry = histNav.getEntry(histNav.getPos());
      if (entry && entry.cardId === cId) {
        entry.selected = null;
        entry.correct = q.correct;
        entry.optionOrder = s.options();
        entry.isCorrect = false;
        entry.skipped = true;
        entry.explanation = q.explanation ?? '';
      }

      await d.doRate(cId, 1);
    });
  }

  async function rate(rating: number) {
    if (s.state() !== 'revealed') return;
    const cId = s.cardId();
    if (!cId) return;
    await d.guard.withActing(async () => d.doRate(cId, rating));
  }

  async function flagWrong() {
    const cId = s.cardId();
    const p = d.project();
    if (!cId || !p) return;
    await d.guard.withActing(async () => {
      const st = s.state();
      if (st === 'revealed') {
        await d.doRate(cId, 1);
      } else if (st === 'rated') {
        const result = await d.api.undoReview();
        if (result.undone) await d.doRate(cId, 1);
      }
    });
  }

  async function undoAction() {
    const st = s.state();
    if (st !== 'revealed' && st !== 'rated') return;
    const cId = s.cardId();
    if (!cId) return;
    await d.guard.withActing(async () => {
      const result = await d.api.undoReview();
      if (result.undone && result.cardId) {
        const restoredId = result.cardId;
        const lookup = lookupQuestion(d.section, restoredId);
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
          await d.refreshDue();
        }
      }
    });
  }

  async function suspendAction() {
    const cId = s.cardId();
    if (!cId) return;
    await d.guard.withActing(async () => {
      await d.api.suspendCard(cId);
      await d.refreshDue();
      await pickNextCardImpl();
    });
  }

  async function buryAction() {
    const cId = s.cardId();
    if (!cId) return;
    await d.guard.withActing(async () => {
      await d.api.buryCard(cId);
      await d.refreshDue();
      await pickNextCardImpl();
    });
  }

  function restoreHistoryEntry(entry: HistoryEntry) {
    const lookup = lookupQuestion(d.section, entry.cardId);
    if (!lookup) return;

    if (entry.selected === null && !entry.skipped) {
      batch(() => {
        s.setLeechWarning(false);
        s.setCardId(entry.cardId);
        s.setQuestion(lookup.question);
        s.setOptions(entry.optionOrder);
        s.setSelected(null);
        s.setIsCorrect(false);
        s.setSkipped(false);
        s.setPassage(entry.passage);
        s.setState('answering');
      });
      d.timer.start();
      return;
    }

    batch(() => {
      s.setLeechWarning(false);
      s.setCardId(entry.cardId);
      s.setQuestion(lookup.question);
      if (entry.optionOrder.length > 0) {
        s.setOptions(entry.optionOrder);
      }
      s.setSelected(entry.selected);
      s.setIsCorrect(entry.isCorrect);
      s.setSkipped(entry.skipped);
      s.setPassage(entry.passage);
      s.setRatingLabels({});
      s.setState('reviewing-history');
    });
  }

  function goBackHistory() {
    if (d.guard.isActing()) return;
    histNav.goBack(restoreHistoryEntry);
  }

  function advanceFromHistory(pickNextCard: () => Promise<void>) {
    if (d.guard.isActing()) return;
    if (s.state() !== 'reviewing-history') return;
    histNav.advance(restoreHistoryEntry, () => pickNextCard().catch(() => {}));
  }

  async function shuffleMcq() {
    const p = d.project();
    if (!p) return;
    const ids = d.section.cardIds;
    if (ids.length === 0) return;
    await d.guard.withActing(async () => {
      const randomId = ids[Math.floor(Math.random() * ids.length)];
      const lookup = lookupQuestion(d.section, randomId);
      if (!lookup) return;
      const shuffled = shuffle([lookup.question.correct, ...lookup.question.wrong]);
      const passageText = lookup.passage ?? '';
      applyMcqCard(randomId, lookup, shuffled, passageText);
      pushHistoryEntry(randomId, lookup, shuffled, passageText);
      await d.refreshDue();
    });
  }

  function currentImageLink(): string {
    const q = s.question();
    if (!q) return '';
    const imgName = q.imageName || q.cropName;
    if (!imgName) return '';
    const suffix = d.project()?.config.imageSearchSuffix ?? '';
    const query = suffix ? `${imgName} ${suffix}` : imgName;
    return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query);
  }

  return {
    histNav,
    applyMcqCard,
    pushHistoryEntry,
    pickNextCardImpl,
    answer,
    skip: doSkip,
    rate,
    flagWrong,
    undo: undoAction,
    suspend: suspendAction,
    bury: buryAction,
    goBackHistory,
    advanceFromHistory,
    shuffleMcq,
    currentImageLink,
  };
}

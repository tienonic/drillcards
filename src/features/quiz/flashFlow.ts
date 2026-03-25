import { batch } from 'solid-js';
import { workerApi } from '../../core/hooks/useWorker.ts';
import { setQuestionContext } from '../glossary/store.ts';
import { pushChartEntry } from '../activity/store.ts';
import { autoSave } from '../backup/backup.ts';
import { resolveFlashCard } from './helpers.ts';
import type { Guard } from './guard.ts';
import type { Section } from '../../projects/types.ts';
import type { QuizState } from './types.ts';

export interface FlashSignals {
  state: () => QuizState;
  setState: (v: QuizState) => void;
  flashCardId: () => string | null;
  setFlashCardId: (v: string | null) => void;
  flashFlipped: () => boolean;
  setFlashFlipped: (v: boolean) => void;
  flashFront: () => string;
  setFlashFront: (v: string) => void;
  flashBack: () => string;
  setFlashBack: (v: string) => void;
  flashDefFirst: () => boolean;
  ratingLabels: () => Record<number, string>;
  setRatingLabels: (v: Record<number, string>) => void;
}

export interface FlashDeps {
  section: Section;
  project: () => { slug: string; config: { new_per_session: number } } | null;
  guard: Guard;
  cramMode: () => boolean;
  cramMarkSeen: (id: string) => void;
  cramPickNext: () => Promise<void>;
  refreshDue: () => Promise<void>;
}

export function createFlashFlow(s: FlashSignals, d: FlashDeps) {
  function setFlashError(msg = 'Card data mismatch') {
    batch(() => { s.setFlashCardId(null); s.setFlashFront(msg); s.setFlashBack(''); s.setFlashFlipped(false); });
  }

  function applyFlashCard(cardId: string, resolved: { card: { front: string; back: string } }) {
    const defFirst = s.flashDefFirst();
    batch(() => {
      s.setFlashCardId(cardId);
      s.setFlashFront(defFirst ? resolved.card.back : resolved.card.front);
      s.setFlashBack(defFirst ? resolved.card.front : resolved.card.back);
      s.setFlashFlipped(false);
      s.setRatingLabels({});
      s.setState('answering');
    });
    setQuestionContext([resolved.card.front, resolved.card.back].join(' '));
  }

  async function pickNextFlash() {
    if (d.cramMode()) { await d.cramPickNext(); return; }
    const p = d.project();
    if (!p || !d.section.flashcards || d.section.flashCardIds.length === 0) return;

    const result = await workerApi.pickNext(p.slug, [d.section.id], p.config.new_per_session, 'flashcard');
    if (!s.state()) return; // component unmounted

    if (!result.cardId) {
      batch(() => {
        s.setFlashCardId(null);
        s.setFlashFront('');
        s.setFlashBack('');
        s.setFlashFlipped(false);
        s.setState('done');
      });
      await d.refreshDue();
      return;
    }

    const resolved = resolveFlashCard(d.section, result.cardId);
    if (!resolved) {
      setFlashError();
      return;
    }

    applyFlashCard(result.cardId, resolved);
    await d.refreshDue();
  }

  function flipFlash() {
    if (d.guard.isActing()) return;
    const flipped = !s.flashFlipped();
    s.setFlashFlipped(flipped);
    const cId = s.flashCardId();
    if (flipped && cId) {
      const captured = cId;
      workerApi.previewRatings(cId).then(preview => {
        if (s.flashCardId() === captured) s.setRatingLabels(preview.labels);
      }).catch(() => {});
    }
  }

  async function rateFlashAction(rating: number) {
    const fId = s.flashCardId();
    const p = d.project();
    if (!fId || !p) return;
    await d.guard.withActing(async () => {
      if (d.cramMode()) {
        workerApi.addActivity(p.slug, d.section.id, rating, rating !== 1).catch(() => {});
        pushChartEntry(rating, rating !== 1);
        d.cramMarkSeen(fId);
        await d.cramPickNext();
        return;
      }

      await workerApi.reviewCard(fId, p.slug, d.section.id, rating);
      workerApi.addActivity(p.slug, d.section.id, rating, rating !== 1).catch(() => {});
      pushChartEntry(rating, rating !== 1);
      autoSave(p.slug);
      await pickNextFlash();
    });
  }

  async function shuffleFlashAction() {
    if (!d.section.flashcards || d.section.flashCardIds.length === 0) return;
    const idx = Math.floor(Math.random() * d.section.flashcards.length);
    const card = d.section.flashcards[idx];
    const fId = d.section.flashCardIds[idx];
    if (!card || !fId) return;
    await d.guard.withActing(async () => {
      applyFlashCard(fId, { card });
      await d.refreshDue();
    });
  }

  return {
    applyFlashCard,
    pickNextFlash,
    flipFlash,
    rateFlash: rateFlashAction,
    shuffleFlash: shuffleFlashAction,
  };
}

import { batch } from 'solid-js';
import { setQuestionContext } from '../glossary/store.ts';
import { pushChartEntry } from '../activity/store.ts';
import { autoSave } from '../backup/backup.ts';
import { resolveFlashCard, resolveFlashCardAcross, findOwnerSection } from './helpers.ts';
import type { ProjectApi } from '../../core/hooks/useWorker.ts';
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
  flashFrontImage: () => string;
  setFlashFrontImage: (v: string) => void;
  flashBackImage: () => string;
  setFlashBackImage: (v: string) => void;
  flashDefFirst: () => boolean;
  ratingLabels: () => Record<number, string>;
  setRatingLabels: (v: Record<number, string>) => void;
}

export interface FlashDeps {
  section: Section;
  sourceSections?: Section[];
  project: () => { slug: string; config: { new_per_session: number } } | null;
  guard: Guard;
  cramMode: () => boolean;
  cramMarkSeen: (id: string) => void;
  cramPickNext: () => Promise<void>;
  cramRate: (cardId: string, rating: number) => void;
  refreshDue: () => Promise<void>;
  api: ProjectApi;
}

export function createFlashFlow(s: FlashSignals, d: FlashDeps) {
  const merged = !!d.sourceSections;
  const allSections = d.sourceSections ?? [d.section];
  const allSectionIds = allSections.map(sec => sec.id);
  const allFlashCardIds = allSections.flatMap(sec => sec.flashCardIds);
  const allFlashcards = allSections.flatMap(sec => sec.flashcards ?? []);

  function resolve(cardId: string) {
    return merged ? resolveFlashCardAcross(allSections, cardId) : resolveFlashCard(d.section, cardId);
  }
  function ownerSectionId(cardId: string): string {
    if (!merged) return d.section.id;
    return (findOwnerSection(allSections, cardId) ?? d.section).id;
  }

  function setFlashError(msg = 'Card data mismatch') {
    batch(() => { s.setFlashCardId(null); s.setFlashFront(msg); s.setFlashBack(''); s.setFlashFrontImage(''); s.setFlashBackImage(''); s.setFlashFlipped(false); });
  }

  function applyFlashCard(cardId: string, resolved: { card: { front: string; back: string; frontImage?: string; backImage?: string } }) {
    const defFirst = s.flashDefFirst();
    batch(() => {
      s.setFlashCardId(cardId);
      s.setFlashFront(defFirst ? resolved.card.back : resolved.card.front);
      s.setFlashBack(defFirst ? resolved.card.front : resolved.card.back);
      s.setFlashFrontImage(defFirst ? resolved.card.backImage ?? '' : resolved.card.frontImage ?? '');
      s.setFlashBackImage(defFirst ? resolved.card.frontImage ?? '' : resolved.card.backImage ?? '');
      s.setFlashFlipped(false);
      s.setRatingLabels({});
      s.setState('answering');
    });
    setQuestionContext([resolved.card.front, resolved.card.back].join(' '));
  }

  async function pickNextFlash() {
    if (d.cramMode()) { await d.cramPickNext(); return; }
    const p = d.project();
    if (!p || allFlashcards.length === 0 || allFlashCardIds.length === 0) return;

    const result = await d.api.pickNext(allSectionIds, p.config.new_per_session, 'flashcard');
    if (!s.state()) return; // component unmounted

    if (!result.cardId) {
      batch(() => {
        s.setFlashCardId(null);
        s.setFlashFront('');
        s.setFlashBack('');
        s.setFlashFrontImage('');
        s.setFlashBackImage('');
        s.setFlashFlipped(false);
        s.setState('done');
      });
      await d.refreshDue();
      return;
    }

    const resolved = resolve(result.cardId);
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
      d.api.previewRatings(cId).then(preview => {
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
        d.cramRate(fId, rating);
        await d.cramPickNext();
        return;
      }

      await d.api.reviewCard(fId, ownerSectionId(fId), rating);
      d.api.addActivity(ownerSectionId(fId), rating, rating !== 1).catch(() => {});
      pushChartEntry(rating, rating !== 1);
      autoSave(p.slug);
      await pickNextFlash();
    });
  }

  async function shuffleFlashAction() {
    if (allFlashcards.length === 0 || allFlashCardIds.length === 0) return;
    const idx = Math.floor(Math.random() * allFlashcards.length);
    const card = allFlashcards[idx];
    const fId = allFlashCardIds[idx];
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

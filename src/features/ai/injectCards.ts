import { batch } from 'solid-js';
import { workerApi } from '../../core/hooks/useWorker.ts';
import { activeProject, setActiveProject, setActiveTab, setAppPhase } from '../../core/store/app.ts';
import { bumpHandlerVersion } from '../../core/store/sections.ts';
import type { Section, Question } from '../../projects/types.ts';

export interface GeneratedCard {
  q: string;
  correct: string;
  wrong: string[];
  explanation?: string;
}

export async function injectGeneratedCards(
  cards: GeneratedCard[],
  sectionName: string,
  enterStudy = true,
): Promise<void> {
  const project = activeProject();
  if (!project || cards.length === 0) return;

  const sectionId = 'gen-' + Date.now();

  const mcqQuestions: Question[] = cards.map(q => ({
    q: q.q,
    correct: q.correct,
    wrong: q.wrong,
    explanation: q.explanation,
  }));

  const cardIds = mcqQuestions.map((_, i) => `${sectionId}-${i}`);

  const newSection: Section = {
    id: sectionId,
    name: sectionName,
    type: 'mc-quiz',
    questions: mcqQuestions,
    cardIds,
    flashCardIds: [],
  };

  const cardRegs = cardIds.map(cardId => ({
    sectionId,
    cardId,
    cardType: 'mcq' as const,
  }));

  await workerApi.loadProject(project.slug, [sectionId], cardRegs);

  const currentProject = activeProject();
  if (!currentProject || currentProject.slug !== project.slug) return;

  const updatedSections = [...currentProject.sections, newSection];
  batch(() => {
    setActiveProject({ ...currentProject, sections: updatedSections });
    setActiveTab(sectionId);
    bumpHandlerVersion();
    if (enterStudy) setAppPhase('study');
  });
}

export async function injectFlashcards(
  cards: { front: string; back: string }[],
  sectionName: string,
  enterStudy = true,
): Promise<void> {
  const project = activeProject();
  if (!project || cards.length === 0) return;

  const sectionId = 'diy-' + Date.now();

  const flashcards = cards.map(c => ({ front: c.front, back: c.back }));
  const flashCardIds = flashcards.map((_, i) => `${sectionId}-flash-${i}`);

  const newSection: Section = {
    id: sectionId,
    name: sectionName,
    type: 'mc-quiz' as const,
    questions: [],
    hasFlashcards: true,
    flashcards,
    cardIds: [],
    flashCardIds,
  };

  const cardRegs = flashCardIds.map(cardId => ({
    sectionId,
    cardId,
    cardType: 'flashcard' as const,
  }));

  await workerApi.loadProject(project.slug, [sectionId], cardRegs);

  const currentProject = activeProject();
  if (!currentProject || currentProject.slug !== project.slug) return;

  const updatedSections = [...currentProject.sections, newSection];
  batch(() => {
    setActiveProject({ ...currentProject, sections: updatedSections });
    setActiveTab(sectionId);
    bumpHandlerVersion();
    if (enterStudy) setAppPhase('study');
  });
}

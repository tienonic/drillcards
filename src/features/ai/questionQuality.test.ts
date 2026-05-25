import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { hasBalancedAnswerOptions, parseGeneratedMcqCards } from './questionQuality.ts';

describe('generated MCQ quality checks', () => {
  it('keeps generated questions with matched answer options', () => {
    const raw = JSON.stringify([
      {
        q: 'Which term describes a painting rejected by the official Salon?',
        correct: 'Salon des Refuses',
        wrong: ['Royal Academy show', 'Bauhaus workshop', 'Academe Julian'],
        explanation: 'The Salon des Refuses showed works rejected from the official Salon.',
      },
    ]);

    expect(parseGeneratedMcqCards(raw)).toHaveLength(1);
  });

  it('rejects questions where the correct answer is clearly the long giveaway', () => {
    const question = {
      q: 'Which term fits this context?',
      correct: 'A layered landscape format using atmospheric perspective to express spiritual distance through mountains and water',
      wrong: ['Rococo', 'Realism', 'Dada'],
      explanation: 'The correct term needs to be tested without telegraphing itself.',
    };

    expect(hasBalancedAnswerOptions(question)).toBe(false);
    expect(parseGeneratedMcqCards(JSON.stringify([question]))).toHaveLength(0);
  });

  it('rejects questions with one option at a much higher detail level', () => {
    const question = {
      q: 'Which answer best describes the work?',
      correct: 'A public exhibition',
      wrong: [
        'A private sketchbook entry',
        'A state-sponsored academic display with juried selection and official prestige',
        'A studio inventory note',
      ],
      explanation: 'Any standout option creates a guessing shortcut.',
    };

    expect(hasBalancedAnswerOptions(question)).toBe(false);
  });

  it('rejects visible character-count spreads over twelve characters', () => {
    const question = {
      q: 'Which label belongs here?',
      correct: 'Compact correct label',
      wrong: [
        'Compact wrong label',
        'A distractor label with too many visible characters',
        'Another compact label',
      ],
    };

    expect(hasBalancedAnswerOptions(question)).toBe(false);
  });

  it('keeps the current AHI Exam 2 deck within the character-count guardrail', () => {
    const project = JSON.parse(fs.readFileSync('projects/ahi001c-exam-2.json', 'utf8'));
    const failures: string[] = [];

    function visibleLength(text: string): number {
      return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length;
    }

    for (const section of project.sections ?? []) {
      const visit = (question: { q: string; correct: string; wrong: string[] }, id: string) => {
        const lengths = [question.correct, ...question.wrong].map(visibleLength);
        const spread = Math.max(...lengths) - Math.min(...lengths);
        const correctOver = lengths[0] - Math.max(...lengths.slice(1));
        if (spread > 12 || correctOver >= 5) {
          failures.push(`${section.id}:${id}:${lengths.join('/')}`);
        }
      };
      (section.questions ?? []).forEach((question: { q: string; correct: string; wrong: string[] }, index: number) => visit(question, String(index)));
      (section.scenarios ?? []).forEach((scenario: { questions: { q: string; correct: string; wrong: string[] }[] }, scenarioIndex: number) => {
        (scenario.questions ?? []).forEach((question, questionIndex: number) => visit(question, `${scenarioIndex}.${questionIndex}`));
      });
    }

    expect(failures).toEqual([]);
  });
});

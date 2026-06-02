import { describe, expect, it } from 'vitest';
import {
  cleanAnswerLabel,
  cleanExplanation,
  cleanFlashBack,
  cleanFlashFront,
  cleanQuestionPrompt,
} from './studyCopy.ts';

describe('study copy cleanup', () => {
  it('removes final-deck question preambles without changing the clue', () => {
    expect(cleanQuestionPrompt(
      'Which ABT 150 final concept fits this clue: One standard-size drink raises BAC by a predictable amount.',
    )).toBe('One standard-size drink raises BAC by a predictable amount.');
  });

  it('removes generated answer prefixes and IDs', () => {
    expect(cleanAnswerLabel('Final guide: basic accounting equation')).toBe('basic accounting equation');
    expect(cleanAnswerLabel('AHI_FINAL_PRI_001: Kota Reliquary Figure')).toBe('Kota Reliquary Figure');
  });

  it('keeps AHI object prompts while dropping unit and coverage metadata', () => {
    expect(cleanQuestionPrompt(
      'AHI final-priority source item: Kota Reliquary Figure. Unit: Africa. Coverage: priority. Notes: Test mbulu ngulu reliquary context.',
    )).toBe('Kota Reliquary Figure. Test mbulu ngulu reliquary context.');
  });

  it('hides source-only explanations and trims source tails', () => {
    expect(cleanExplanation('Source-backed clue from ABT_FINAL_004.')).toBeUndefined();
    expect(cleanExplanation('A retrieval cue worth keeping. Source: ABT_FINAL_004')).toBe('A retrieval cue worth keeping.');
  });

  it('cleans flashcards into term and definition copy', () => {
    expect(cleanFlashFront('AHI_FINAL_PRI_001: Kota Reliquary Figure')).toBe('Kota Reliquary Figure');
    expect(cleanFlashBack(
      '<strong>Kota Reliquary Figure</strong><br>Wood and metal reliquary figure. <strong>Source:</strong> AHI_FINAL_PRI_001',
    )).toBe('<strong>Kota Reliquary Figure</strong><br>Wood and metal reliquary figure.');
    expect(cleanFlashBack(
      'Kota Reliquary Figure. Unit: Africa. Coverage: priority. Notes: Connect the figure to ancestor reliquary practice. <strong>Terms:</strong> mbulu ngulu',
    )).toBe('Kota Reliquary Figure. Connect the figure to ancestor reliquary practice.');
  });
});

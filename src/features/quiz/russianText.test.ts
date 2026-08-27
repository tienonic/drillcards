import { describe, expect, it } from 'vitest';
import { formatRussianStudyHtml, splitRussianSyllables } from './russianText.ts';

describe('Russian study text formatting', () => {
  it('uses the pronunciation guide to align Russian and Latin syllables', () => {
    expect(splitRussianSyllables('образ', ['OB', 'raz'])).toEqual(['об', 'раз']);
    expect(splitRussianSyllables('внимательно', ['vni', 'MA', "tel'", 'no']))
      .toEqual(['вни', 'ма', 'тель', 'но']);
  });

  it('falls back to readable vowel-centered syllables without a guide', () => {
    expect(splitRussianSyllables('молоко')).toEqual(['мо', 'ло', 'ко']);
    expect(splitRussianSyllables('знать')).toEqual(['знать']);
  });

  it('colors corresponding form and pronunciation segments with the same tones', () => {
    const pronunciation = 'приве́т — pree-VYET';
    const formatted = formatRussianStudyHtml(pronunciation, pronunciation);
    expect(formatted).toContain('syllable-tone-0">при</span>');
    expect(formatted).toContain('syllable-tone-1">ве́т</span>');
    expect(formatted).toContain('syllable-tone-0">pree</span>');
    expect(formatted).toContain('syllable-tone-1">VYET</span>');
    expect(formatted).not.toContain(' — ');
  });

  it('makes every highlighted back-side Russian word an audio target without tooltips', () => {
    const html = '<strong>thank you</strong><br>Use спасибо за + accusative.';
    const formatted = formatRussianStudyHtml(html, 'спаси́бо — spah-SEE-bah', true);
    expect(formatted).toContain('data-russian-audio="спасибо" role="button" tabindex="0"');
    expect(formatted).toContain('data-russian-audio="за" role="button" tabindex="0"');
    expect(formatted).not.toContain('is-syllable-colored');
    expect(formatted).not.toContain('title=');
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const quizCss = readFileSync(resolve(process.cwd(), 'src/features/quiz/quiz.css'), 'utf8');
const settingsCss = readFileSync(resolve(process.cwd(), 'src/features/settings/settings.css'), 'utf8');
const anchoredDialog = readFileSync(resolve(process.cwd(), 'src/components/overlays/AnchoredDialog.tsx'), 'utf8');

function firstRuleBody(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Missing CSS selector: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  if (open < 0 || close < 0) throw new Error(`Malformed CSS rule: ${selector}`);
  return css.slice(open + 1, close);
}

describe('study UI layout contracts', () => {
  it('keeps variable-length MCQ feedback in normal flow', () => {
    const body = firstRuleBody(quizCss, '.option-feedback {');
    expect(body).toMatch(/position:\s*static\s*;/);
    expect(body).not.toMatch(/position:\s*absolute\s*;/);
    expect(body).not.toMatch(/min-height:\s*100%\s*;/);
  });

  it('clamps portalled study panels inside a phone viewport', () => {
    const panel = firstRuleBody(settingsCss, '.anchored-dialog-panel {');
    expect(panel).toMatch(/position:\s*fixed\s*;/);
    expect(settingsCss).toMatch(/@media\s*\(max-width:\s*600px\)/);
    expect(settingsCss).toMatch(/\.settings-dropdown,\s*\.keybinds-modal\s*\{[^}]*width:\s*calc\(100vw\s*-\s*16px\)\s*;/s);
    expect(settingsCss).toMatch(/\.settings-dropdown\s*\{[^}]*overflow-y:\s*auto\s*;/s);
    expect(anchoredDialog).toMatch(/window\.visualViewport/);
    expect(anchoredDialog).toMatch(/viewport\.width\s*-\s*16/);
    expect(anchoredDialog).toMatch(/viewport\.height\s*-\s*16/);
  });
});

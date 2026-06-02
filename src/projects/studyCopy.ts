function trimTrailingBreaks(value: string): string {
  return value.replace(/(?:\s*<br\s*\/?>\s*)+$/gi, '').trim();
}

function tidy(value: string): string {
  return trimTrailingBreaks(value)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:?])/g, '$1')
    .trim();
}

function stripHtmlSourceBlocks(value: string): string {
  return value
    .replace(/(?:\s*<br\s*\/?>\s*){0,3}<strong>\s*(?:Sources?|References?)\s*:\s*<\/strong>\s*[\s\S]*$/gi, '')
    .replace(/\s*(?:Sources?|References?)\s*:\s*[\s\S]*$/gi, '');
}

function stripAnchorMetadata(value: string): string {
  return value
    .replace(/\s*;\s*(?:primary anchors?|supporting anchors?|confidence)\s*:\s*[\s\S]*$/gi, '')
    .replace(/\s+(?:primary anchors?|supporting anchors?|confidence)\s*:\s*[\s\S]*$/gi, '');
}

function stripTrailingTerms(value: string): string {
  return value
    .replace(/(?:\s*<br\s*\/?>\s*){0,2}<strong>\s*Terms\s*:\s*<\/strong>\s*[\s\S]*$/gi, '')
    .replace(/\s+Terms\s*:\s*[\s\S]*$/g, '');
}

function stripStudyMetadata(value: string): string {
  return tidy(stripAnchorMetadata(stripHtmlSourceBlocks(value)));
}

function stripGeneratedIdPrefix(value: string): string {
  return value.replace(/^[A-Z]{2,}\d*(?:_[A-Z0-9]+)+_\d+\s*:\s*/i, '');
}

function stripCuePrefix(value: string): string {
  return value
    .replace(/^Final guide\s*:\s*/i, '')
    .replace(/^ID this\s*:\s*/i, '')
    .replace(/^Remember\s*:\s*/i, '')
    .replace(/^Q\d+\s*:\s*/i, '')
    .replace(/^ABT\s+final\s+project\s*:\s*/i, '');
}

function stripQuestionPreamble(value: string): string {
  return value
    .replace(/^Which\s+[^:]{0,160}\s+final concept fits this clue\s*:\s*/i, '')
    .replace(/^AHI\s+final-priority\s+source item\s*:\s*/i, '')
    .replace(/^Identify this\s+AHI\s+final(?:-scope)?\s+image(?:\/object anchor from the local slide corpus)?\./i, 'Identify this image.')
    .replace(/^Identify this\s+AHI\s+final\s+image\/object anchor from the local slide corpus\./i, 'Identify this image/object.')
    .replace(/\.\s*Unit\s*:\s*[^.]*\.\s*Coverage\s*:\s*[^.]*\.\s*Notes\s*:\s*/i, '. ')
    .replace(/\.\s*Unit\s*:\s*[^.]*\.\s*Coverage\s*:\s*[^.]*\.?/i, '.')
    .replace(/\.\s*Unit\s*:\s*[\s\S]*$/i, '.');
}

export function cleanQuestionPrompt(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return tidy(stripQuestionPreamble(stripGeneratedIdPrefix(stripStudyMetadata(value))));
}

export function cleanAnswerLabel(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return tidy(stripCuePrefix(stripGeneratedIdPrefix(stripStudyMetadata(value))));
}

export function cleanExplanation(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const withoutSourceLead = value.replace(/^Source-backed clue from\s+[^.;]+[.;]?\s*/i, '');
  const cleaned = tidy(stripTrailingTerms(stripStudyMetadata(withoutSourceLead)));
  if (/^(?:primary anchors?|supporting anchors?|confidence)\s*:/i.test(cleaned)) return undefined;
  return cleaned || undefined;
}

export function cleanFlashFront(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return tidy(stripCuePrefix(stripGeneratedIdPrefix(stripStudyMetadata(value))));
}

export function cleanFlashBack(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const withoutSource = stripStudyMetadata(value);
  const withoutDeckMetadata = withoutSource
    .replace(/\.\s*Unit\s*:\s*[^.]*\.\s*Coverage\s*:\s*[^.]*\.\s*Notes\s*:\s*/i, '. ')
    .replace(/\.\s*Unit\s*:\s*[^.]*\.\s*Coverage\s*:\s*[^.]*\.?/i, '.')
    .replace(/\.\s*Unit\s*:\s*[\s\S]*$/i, '.');
  return tidy(stripTrailingTerms(withoutDeckMetadata));
}

export function cleanPassageHtml(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return stripStudyMetadata(value);
}

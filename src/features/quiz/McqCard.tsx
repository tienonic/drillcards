import { Show, For, createSignal } from 'solid-js';
import type { McqView } from './types.ts';
import { easyMode } from '../../core/store/app.ts';
import { getLabel } from '../settings/keybinds.ts';
import { LatexText } from '../../components/LatexText.tsx';

const RATING_CSS: Record<number, string> = { 1: 'rating-again', 2: 'rating-hard', 3: 'rating-good', 4: 'rating-easy' };
const RATING_NAMES: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

export function AddNewCards(props: { session: Pick<McqView, 'increaseNewCards'> }) {
  const [count, setCount] = createSignal(5);
  return (
    <div class="done-add-new">
      <input type="number" value={count()} min="1" class="new-cards-input"
        onInput={(e) => setCount(Math.max(1, parseInt(e.currentTarget.value, 10) || 1))} />
      <button type="button" class="action-sm"
        onClick={() => props.session.increaseNewCards(count()).catch(() => {})}>Add New</button>
    </div>
  );
}

export function McqCard(props: { session: McqView; isPassage?: boolean }) {
  const s = props.session;

  function optionClass(opt: string): string {
    const st = s.state(); const q = s.question();
    if (st === 'answering' || st === 'idle' || !q) return 'option-btn';
    return `option-btn answered${opt === q.correct ? ' correct' : ''}${opt === s.selected() && !s.isCorrect() ? ' wrong' : ''}`;
  }

  function feedbackFor(opt: string) {
    const st = s.state(); const q = s.question();
    if (st === 'answering' || st === 'idle' || !q) return null;
    if (s.skipped() && opt === q.correct) return { text: q.correct, cls: 'option-feedback skip-fb', explanation: q.explanation };
    if (opt === s.selected()) return s.isCorrect() ? { text: '', cls: 'option-feedback correct-fb', explanation: q.explanation } : { text: q.correct, cls: 'option-feedback wrong-fb', explanation: q.explanation };
    return null;
  }

  return (
    <div class="card">
      <Show when={s.state() === 'idle'}>
        <div class="card-loading">Loading...</div>
      </Show>
      <Show when={s.isCorrect() && (s.state() === 'revealed' || (s.state() === 'rated' && !s.cramMode()))}>
        <button type="button" class="card-flag-btn" title="Mark as wrong for extra practice" onClick={() => s.flagWrong().catch(() => {})}>&times;</button>
      </Show>
      <Show when={props.isPassage && s.passage()}><div class="passage" innerHTML={s.passage()} /></Show>
      <Show when={s.question()}>{(q) => <div class="question-header"><LatexText text={q().q} class="question-text" /></div>}</Show>

      <div class="options">
        <For each={s.options()}>
          {(opt) => {
            const fb = () => feedbackFor(opt);
            return (
              <div class="option-wrapper">
                <button type="button" class={optionClass(opt)} onClick={() => { const st = s.state(); if (st === 'answering') { s.answer(opt).catch(() => {}); return; } if (st === 'rated') s.pickNextCard().catch(() => {}); else if (st === 'revealed' && easyMode()) s.rate(s.isCorrect() ? 3 : 1).catch(() => {}); else if (st === 'reviewing-history') s.advanceFromHistory(); }}><LatexText text={opt} /></button>
                <Show when={fb()}>
                  {(fbd) => <div class={fbd().cls}><Show when={fbd().text}><LatexText text={fbd().text} /></Show><Show when={fbd().explanation}><LatexText text={fbd().explanation} class="explanation" /></Show></div>}
                </Show>
              </div>
            );
          }}
        </For>
      </div>

      <Show when={s.state() === 'revealed' && !easyMode()}>
        <div class="rating-area">
          <For each={[1, 2, 3, 4]}>
            {(rating) => <button type="button" class={`rating-btn ${RATING_CSS[rating]}`} onClick={() => s.rate(rating).catch(() => {})}><span class="rating-label">{RATING_NAMES[rating]}</span><span class="rating-interval">{s.ratingLabels()[rating] ?? ''}</span></button>}
          </For>
        </div>
        <div class="card-actions"><button type="button" class="action-sm" onClick={() => s.undo().catch(() => {})}>Undo</button><button type="button" class="action-sm" onClick={() => s.suspend().catch(() => {})}>Suspend</button><button type="button" class="action-sm" onClick={() => s.bury().catch(() => {})}>Bury</button></div>
      </Show>

      <Show when={s.leechWarning()}>
        <span class="explanation leech-warning">This card is a leech (frequently forgotten). Consider reviewing the material.</span>
      </Show>

      <Show when={s.state() === 'reviewing-history'}>
        <div class="key-hints">Reviewing previous — press <kbd>{getLabel('skip')}</kbd> or <kbd>{getLabel('forward')}</kbd> for next</div>
      </Show>

      <Show when={s.state() === 'done'}>
        <div class="done-screen">
          <h3 class="done-title">Session Complete</h3>
          <Show when={s.score().attempted > 0}>
            <div class="done-stats"><span class="done-stat">{s.score().correct} / {s.score().attempted} correct</span><span class="done-stat">{Math.round((s.score().correct / s.score().attempted) * 100)}% accuracy</span></div>
          </Show>
          <div class="done-due"><span>{s.dueCount().newCount} new remaining</span><span>{s.dueCount().total} total cards</span></div>
          <div class="done-actions">
            <button type="button" class="action-sm" onClick={() => s.studyMore().catch(() => {})}>Study More</button>
            <button type="button" class="action-sm cram-btn" onClick={() => s.startCram().catch(() => {})}>Cram</button>
            <AddNewCards session={s} />
            <button type="button" class="action-sm" onClick={() => s.unburyAll().catch(() => {})}>Unbury Cards</button>
          </div>
        </div>
      </Show>
    </div>
  );
}

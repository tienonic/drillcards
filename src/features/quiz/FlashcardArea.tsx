import { Show, For } from 'solid-js';
import type { QuizSession } from './store.ts';
import { easyMode } from '../../core/store/app.ts';
import { LatexHtml } from '../../components/LatexText.tsx';
import { AddNewCards } from './McqCard.tsx';

const RATING_CSS: Record<number, string> = { 1: 'rating-again', 2: 'rating-hard', 3: 'rating-good', 4: 'rating-easy' };
const RATING_NAMES: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

export function FlashcardArea(props: { session: QuizSession }) {
  const s = props.session;

  return (
    <div>
      <Show when={s.state() !== 'done'}>
        <div class="flashcard-container" onClick={() => s.flipFlash()}>
          <div class={`flashcard ${s.flashFlipped() ? 'flipped' : ''}`}>
            <div class="flashcard-face flashcard-front"><LatexHtml html={s.flashFront()} /></div>
            <div class="flashcard-face flashcard-back"><LatexHtml html={s.flashBack()} /></div>
          </div>
        </div>


        <Show when={s.flashFlipped() && s.flashCardId()}>
          <Show when={easyMode()}>
            <div class="flash-rating-area">
              <button type="button" class="flash-rating-btn rating-again" onClick={(e) => { e.stopPropagation(); s.rateFlash(1).catch(() => {}); }}>Again</button>
              <button type="button" class="flash-rating-btn rating-good" onClick={(e) => { e.stopPropagation(); s.rateFlash(3).catch(() => {}); }}>Good</button>
            </div>
          </Show>
          <Show when={!easyMode()}>
            <div class="flash-rating-area"><For each={[1, 2, 3, 4]}>{(rating) => <button type="button" class={`flash-rating-btn ${RATING_CSS[rating]}`} onClick={(e) => { e.stopPropagation(); s.rateFlash(rating).catch(() => {}); }}><span class="rating-label">{RATING_NAMES[rating]}</span><span class="rating-interval">{s.ratingLabels()[rating] ?? ''}</span></button>}</For></div>
          </Show>
        </Show>
      </Show>

      <Show when={s.state() === 'done'}>
        <div class="done-screen">
          <h3 class="done-title">Session Complete</h3>
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

import { Show, For } from 'solid-js';
import type { FlashView } from './types.ts';
import { easyMode } from '../../core/store/app.ts';
import { LatexHtml } from '../../components/LatexText.tsx';
import { AddNewCards } from './McqCard.tsx';
import { imgSrc } from '../../utils/imgSrc.ts';
import { stripDuplicateFlashTitle } from './flashIdentity.ts';
import { getLabel } from '../settings/keybinds.ts';

const RATING_CSS: Record<number, string> = { 1: 'rating-again', 2: 'rating-hard', 3: 'rating-good', 4: 'rating-easy' };
const RATING_NAMES: Record<number, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

export function FlashcardArea(props: { session: FlashView }) {
  const s = props.session;
  const answerImage = () => s.flashBackImage() || s.flashFrontImage();
  const expandedBack = () => s.flashFlipped() && !!answerImage();
  const backBody = () => stripDuplicateFlashTitle(s.flashBack(), s.flashTitle());
  const reviewingHistory = () => s.state() === 'reviewing-history';

  return (
    <div>
      <Show when={s.state() !== 'done'}>
        <div class="flashcard-container" onClick={() => s.flipFlash()}>
          <div class={`flashcard ${s.flashFlipped() ? 'flipped' : ''}${expandedBack() ? ' has-image' : ''}`}>
            <Show when={!s.flashFlipped()} fallback={
              <div class="flashcard-face flashcard-back">
                <Show when={s.flashTitle()}><div class="flashcard-title"><LatexHtml html={s.flashTitle()} /></div></Show>
                <Show when={answerImage()}>{(image) => <img src={imgSrc(image())} alt="" class="flashcard-image" loading="lazy" crossorigin="anonymous" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />}</Show>
                <Show when={backBody()}><div class="flashcard-copy"><LatexHtml html={backBody()} /></div></Show>
              </div>
            }>
              <div class="flashcard-face flashcard-front">
                <Show when={s.flashFrontImage()}><img src={imgSrc(s.flashFrontImage())} alt="" class="flashcard-image" loading="lazy" crossorigin="anonymous" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /></Show>
                <Show when={s.flashFront()}><div class="flashcard-copy"><LatexHtml html={s.flashFront()} /></div></Show>
              </div>
            </Show>
          </div>
        </div>


        <Show when={reviewingHistory()}>
          <div class="key-hints">History {s.historyPosition().current}/{s.historyPosition().total} — <kbd>{getLabel('goBack')}</kbd>/<kbd>&larr;</kbd> back, <kbd>{getLabel('forward')}</kbd>/<kbd>&rarr;</kbd> forward</div>
        </Show>

        <Show when={s.flashFlipped() && s.flashCardId() && !reviewingHistory()}>
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
          <div class="done-due"><span>{s.dueCount().due} due now</span><span>{s.dueCount().newCount} new remaining</span><span>{s.dueCount().total} total cards</span></div>
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

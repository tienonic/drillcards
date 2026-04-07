import { createSignal, For, Show, onMount, onCleanup, batch } from 'solid-js';
import { Portal } from 'solid-js/web';
import {
  type KeyAction, type KeyContext,
  keybinds, CONTEXT_LABELS,
} from './keybinds.ts';
import { activePanel, setActivePanel, setHeaderLocked } from '../../core/store/app.ts';

const CONTEXT_ORDER: KeyContext[] = ['mcq', 'flashcard', 'math', 'global'];

const TIPS: Record<KeyContext, { action: string; keys: (map: Record<KeyAction, { label: string }>) => string }[]> = {
  mcq: [
    { action: 'Answer / Rate', keys: (m) => `${m.answer1.label}-${m.answer4.label}` },
    { action: 'Skip / Next', keys: (m) => m.skip.label },
    { action: 'Undo', keys: (m) => m.undo.label },
    { action: 'Suspend', keys: (m) => m.suspend.label },
    { action: 'Bury', keys: (m) => m.bury.label },
    { action: 'Go Back', keys: (m) => m.goBack.label },
    { action: 'View Image', keys: (m) => m.viewImage.label },
    { action: 'Forward', keys: (m) => m.forward.label },
  ],
  flashcard: [
    { action: 'Flip Card', keys: (m) => `${m.flipCard.label} / ${m.flipAlt.label}` },
    { action: 'Rate', keys: (m) => `${m.answer1.label}-${m.answer4.label}` },
    { action: 'Flip / Rate Good', keys: (m) => m.skip.label },
  ],
  math: [
    { action: 'Submit', keys: () => 'Enter' },
    { action: 'Skip / Next', keys: (m) => m.mathSubmit.label },
  ],
  global: [
    { action: 'Open Note', keys: (m) => m.note.label },
    { action: 'Copy Card', keys: (m) => m.copyCard.label },
  ],
};

export function TipsPanel() {
  const [panelTop, setPanelTop] = createSignal(0);
  let btnRef!: HTMLButtonElement;

  function close() { batch(() => { setActivePanel(null); setHeaderLocked(false); }); }
  const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && activePanel() === 'tips') close(); };
  onMount(() => document.addEventListener('keydown', handleEscape));
  onCleanup(() => document.removeEventListener('keydown', handleEscape));

  return (
    <>
      <button type="button" ref={btnRef} class="tips-btn" title="Show keyboard tips" onClick={() => batch(() => { setPanelTop(btnRef.getBoundingClientRect().top); setActivePanel('tips'); setHeaderLocked(true); })}>Tips</button>
      <Show when={activePanel() === 'tips'}>
        <Portal>
          <div class="settings-backdrop" onClick={(e) => { if (e.target instanceof Element && e.target.classList.contains('settings-backdrop')) close(); }}>
            <div class="keybinds-modal panel-fixed" style={{ top: `${panelTop()}px` }}>
              <div class="keybinds-header"><span>Tips</span><button type="button" class="keybinds-close" onClick={close}>&times;</button></div>
              <div class="keybinds-body">
                <For each={CONTEXT_ORDER}>{(ctx) => <div class="keybinds-group"><div class="keybinds-group-label">{CONTEXT_LABELS[ctx]}</div><For each={TIPS[ctx]}>{(tip) => <div class="keybinds-row"><span class="keybinds-action">{tip.action}</span><kbd>{tip.keys(keybinds())}</kbd></div>}</For></div>}</For>
              </div>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}

import './glossary.css';
import { Show, For, onMount, onCleanup, batch } from 'solid-js';
import {
  getRelevantTerms,
  filteredEntries,
  searchQuery,
  setSearchQuery,
} from './store.ts';
import { termsOpen, setTermsOpen } from '../../core/store/app.ts';

function googleUrl(term: string): string {
  return 'https://www.google.com/search?q=' + encodeURIComponent(term + ' definition');
}

function googleImgUrl(term: string): string {
  return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(term);
}

export function TermsDropdown() {
  let dropdownRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => { if (dropdownRef && e.target instanceof Node && !dropdownRef.contains(e.target)) { batch(() => { setTermsOpen(false); setSearchQuery(''); }); } };

  const handleKey = (e: KeyboardEvent) => {
    if (!termsOpen()) return;
    const tag = e.target instanceof Element ? e.target.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Backspace') { setSearchQuery(searchQuery().slice(0, -1)); return; }
    if (e.key === 'Escape') { batch(() => { setSearchQuery(''); setTermsOpen(false); }); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) setSearchQuery(searchQuery() + e.key);
  };

  onMount(() => { document.addEventListener('click', handleClickOutside, true); document.addEventListener('keydown', handleKey); });
  onCleanup(() => { document.removeEventListener('click', handleClickOutside, true); document.removeEventListener('keydown', handleKey); });

  return (
    <div class="terms-dropdown" ref={dropdownRef}>
      <button type="button" class="terms-toggle-btn" onClick={() => batch(() => { setTermsOpen(!termsOpen()); setSearchQuery(''); })}>{termsOpen() ? '\u25B2' : '\u25BC'}</button>
      <Show when={termsOpen()}>
        <div class="terms-list">
          <Show when={searchQuery()}>
            <div class="term-filter">{searchQuery()}</div>
            <div class="term-list">
              <For each={filteredEntries()}>{t => <div class="term-item"><strong>{t.term}</strong><Show when={t.hasImage}><a class="term-img-link" href={googleImgUrl(t.term)} target="_blank" rel="noopener noreferrer">img</a></Show><div class="term-def">{t.def}</div></div>}</For>
            </div>
          </Show>
          <Show when={!searchQuery()}>
            <div class="activity-terms">
              <For each={getRelevantTerms()}>{t => <a class="term-tag" href={googleUrl(t.term)} target="_blank" rel="noopener noreferrer">{t.term}</a>}</For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
}

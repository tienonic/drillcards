import { For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { activeProject, activeTab, setActiveTab, easyMode, toggleEasyMode, mergedMode, toggleMergedMode, headerVisible, setHeaderVisible, headerLocked } from '../../core/store/app.ts';
import { goToLauncher } from '../../features/launcher/store.ts';
import { sectionHandlers, handlerVersion } from '../../core/store/sections.ts';
import { MERGED_TAB_ID } from '../../features/quiz/MergedQuizView.tsx';
import { SettingsPanel } from '../../features/settings/SettingsPanel.tsx';
import { KeybindsPanel } from '../../features/settings/KeybindsPanel.tsx';
import { TipsPanel } from '../../features/settings/TipsPanel.tsx';
// AI panel removed — generation features moved to dashboard Create tab

export function Header() {
  const project = activeProject;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function open() {
    clearClose();
    setHeaderVisible(true);
  }

  function clearClose() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = undefined; }
  }

  function scheduleClose() {
    if (headerLocked()) return;
    clearClose();
    closeTimer = setTimeout(() => {
      if (headerLocked()) return;
      setHeaderVisible(false);
      closeTimer = undefined;
    }, 800);
  }

  const hasMultipleQuizSections = () => {
    const p = project();
    if (!p) return false;
    return p.sections.filter(s => s.type === 'mc-quiz' || s.type === 'passage-quiz').length > 1;
  };

  function handleMergeToggle() {
    toggleMergedMode();
    const p = project();
    if (!p) return;
    if (mergedMode()) {
      setActiveTab(MERGED_TAB_ID);
    } else {
      setActiveTab(p.sections[0]?.id ?? null);
    }
  }

  const currentEntry = () => { handlerVersion(); const tab = activeTab(); return tab ? sectionHandlers.get(tab) : undefined; };
  const canFlash = () => currentEntry()?.kind === 'quiz';
  const quizSession = () => { const e = currentEntry(); return e?.kind === 'quiz' ? e.session : undefined; };

  const clickOutsideHandler = (e: MouseEvent) => {
    if (!headerVisible()) return;
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('.header-menu') || e.target.closest('.header-pull') || e.target.closest('.settings-backdrop')) return;
    setHeaderVisible(false);
  };
  onMount(() => document.addEventListener('mousedown', clickOutsideHandler));
  onCleanup(() => { document.removeEventListener('mousedown', clickOutsideHandler); if (closeTimer) clearTimeout(closeTimer); });

  return (
    <div class="header-wrap">
      <div
        class={`header-pull ${headerVisible() ? 'header-pull-open' : ''}`}
        onMouseEnter={open}
        onMouseLeave={scheduleClose}
        onClick={() => setHeaderVisible(!headerVisible())}
      >
        {headerVisible() ? '\u25B2' : '\u25BC'}
      </div>
      <Show when={headerVisible()}>
        <div class="header-menu" onMouseEnter={clearClose} onMouseLeave={scheduleClose}>
          <div class="header-menu-label">{project()?.name}</div>
          <button type="button" class="header-menu-item" onClick={() => goToLauncher()}>&larr; Home</button>
          <label class="header-menu-item header-menu-check"><input type="checkbox" checked={easyMode()} onChange={toggleEasyMode} />Simple</label>
          <Show when={hasMultipleQuizSections()}>
            <label class="header-menu-item header-menu-check"><input type="checkbox" checked={mergedMode()} onChange={handleMergeToggle} />Merge</label>
          </Show>
          <SettingsPanel />
          <KeybindsPanel />
          <TipsPanel />
          <div class="header-menu-divider" />
          <Show when={!mergedMode()}>
            <For each={project()?.sections ?? []}>
              {(section) => <button type="button" class={`header-menu-item header-menu-tab ${activeTab() === section.id ? 'active' : ''}`} onClick={() => setActiveTab(section.id)}>{section.name}</button>}
            </For>
          </Show>
          <Show when={mergedMode()}>
            <button type="button" class="header-menu-item header-menu-tab active">All Sections</button>
          </Show>
          <Show when={canFlash()}>
            <div class="header-menu-divider" />
            <button type="button" class={`header-menu-item header-menu-tab ${!quizSession()!.flashMode() ? 'active' : ''}`} onClick={() => { if (quizSession()!.flashMode()) quizSession()!.toggleFlashMode(); }}>Quiz</button>
            <button type="button" class={`header-menu-item header-menu-tab ${quizSession()!.flashMode() ? 'active' : ''}`} onClick={() => { if (!quizSession()!.flashMode()) quizSession()!.toggleFlashMode(); }}>Flashcards</button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

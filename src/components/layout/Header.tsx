import { For, Show, createSignal, onMount, onCleanup } from 'solid-js';
import { activeProject, activeTab, setActiveTab, easyMode, toggleEasyMode, headerVisible, setHeaderVisible, headerLocked } from '../../core/store/app.ts';
import { goToLauncher } from '../../features/launcher/store.ts';
import { sectionHandlers, handlerVersion } from '../../core/store/sections.ts';

import type { FlashModeView } from '../../features/quiz/types.ts';
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

  const currentHandler = () => { handlerVersion(); const tab = activeTab(); return tab ? sectionHandlers.get(tab) : undefined; };
  const canFlash = () => {
    const h = currentHandler();
    return h && typeof h.flashMode === 'function' && typeof h.toggleFlashMode === 'function';
  };
  const flashHandler = () => currentHandler() as FlashModeView;

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
          <SettingsPanel />
          <KeybindsPanel />
          <TipsPanel />
          <div class="header-menu-divider" />
          <For each={project()?.sections ?? []}>
            {(section) => <button type="button" class={`header-menu-item header-menu-tab ${activeTab() === section.id ? 'active' : ''}`} onClick={() => setActiveTab(section.id)}>{section.name}</button>}
          </For>
          <Show when={canFlash()}>
            <div class="header-menu-divider" />
            <button type="button" class={`header-menu-item header-menu-tab ${!flashHandler().flashMode() ? 'active' : ''}`} onClick={() => { if (flashHandler().flashMode()) flashHandler().toggleFlashMode(); }}>Quiz</button>
            <button type="button" class={`header-menu-item header-menu-tab ${flashHandler().flashMode() ? 'active' : ''}`} onClick={() => { if (!flashHandler().flashMode()) flashHandler().toggleFlashMode(); }}>Flashcards</button>
          </Show>
        </div>
      </Show>
    </div>
  );
}

import { createSignal, onCleanup, onMount } from 'solid-js';
import { createHoverMenu } from './createHoverMenu.ts';
import { ProjectBrowserModal } from './ProjectBrowserModal.tsx';
import { ProjectFilePickerModal } from './ProjectFilePickerModal.tsx';
import { CreateFlowModal } from './CreateFlowModal.tsx';
import { SourceMaterialModal } from './SourceMaterialModal.tsx';
import { DiyEditorModal } from './DiyEditorModal.tsx';
import { flowConfigs, type FlowConfig } from './flowConfigs.ts';
import { getGeminiKey, setGeminiKey } from './gemini.ts';

export function CreateTab() {
  const menu = createHoverMenu();
  const [browserOpen, setBrowserOpen] = createSignal(false);
  const [filePickerOpen, setFilePickerOpen] = createSignal(false);
  const [sourceOpen, setSourceOpen] = createSignal(false);
  const [activeFlow, setActiveFlow] = createSignal<FlowConfig | null>(null);
  const [diyOpen, setDiyOpen] = createSignal(false);
  const [apiKey, setApiKey] = createSignal(getGeminiKey() ?? '');

  function openFlow(id: string) {
    closeMenus();
    setActiveFlow(flowConfigs[id] ?? null);
  }

  function closeMenus() {
    menu.closeAll();
  }

  function openTopMenu(key: string, e: MouseEvent) {
    e.stopPropagation();
    menu.closeAll();
    menu.enter(key);
  }

  function openSubMenu(key: string, e: MouseEvent | PointerEvent) {
    if ((e.target as Element).closest('.db-submenu-l2')) return;
    menu.enter(key);
  }

  function handleKeyChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    setApiKey(val);
    setGeminiKey(val);
  }

  onMount(() => {
    const closeOnOutsidePointer = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest('.db-create')) return;
      closeMenus();
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    onCleanup(() => document.removeEventListener('pointerdown', closeOnOutsidePointer));
  });

  return (
    <div class="db-create" onMouseLeave={() => menu.closeAll()}>
      <div class="db-create-menu">
        {/* Import */}
        <div
          class="db-create-item"
          onMouseEnter={() => menu.enter('import')}
          onMouseLeave={() => menu.leave('import')}
        >
          <button type="button" class="db-create-item-trigger" onClick={(e) => openTopMenu('import', e)}>
            <span class="db-create-item-label">Import</span>
            <span class="db-create-item-sub">Decks & files</span>
          </button>
          <div class={`db-submenu ${menu.isOpen('import') ? 'db-submenu--open' : ''}`}>
            <button type="button" class="db-submenu-action" onClick={() => { setBrowserOpen(true); closeMenus(); }}>
              <span>Browse Decks</span>
              <span class="db-submenu-action-sub">Select from your deck library</span>
            </button>
            <button type="button" class="db-submenu-action" onClick={() => { closeMenus(); setFilePickerOpen(true); }}>
              <span>Open File (.json)</span>
              <span class="db-submenu-action-sub">Import a project file</span>
            </button>
            <button type="button" class="db-submenu-action" onClick={() => { setSourceOpen(true); closeMenus(); }}>
              <span>Source Material</span>
              <span class="db-submenu-action-sub">Paste text to generate cards</span>
            </button>
          </div>
        </div>

        {/* Manual */}
        <div
          class="db-create-item"
          onMouseEnter={() => menu.enter('manual')}
          onMouseLeave={() => menu.leave('manual')}
        >
          <button type="button" class="db-create-item-trigger" onClick={(e) => openTopMenu('manual', e)}>
            <span class="db-create-item-label">Manual</span>
            <span class="db-create-item-sub">Your own cards</span>
          </button>
          <div class={`db-submenu ${menu.isOpen('manual') ? 'db-submenu--open' : ''}`}>
            <button type="button" class="db-submenu-action" onClick={() => { setDiyOpen(true); closeMenus(); }}>
              <span>DIY Flashcards</span>
              <span class="db-submenu-action-sub">Create front/back card pairs</span>
            </button>
            <button type="button" class="db-submenu-action" onClick={() => { fetch('/__open-folder?path=GENERATING_PROJECTS.md').catch(() => {}); closeMenus(); }}>
              <span>LLM Prompt Guide</span>
              <span class="db-submenu-action-sub">Open GENERATING_PROJECTS.md</span>
            </button>
          </div>
        </div>

        {/* AI-Powered */}
        <div
          class="db-create-item"
          onMouseEnter={() => menu.enter('ai')}
          onMouseLeave={() => menu.leave('ai')}
        >
          <button type="button" class="db-create-item-trigger" onClick={(e) => openTopMenu('ai', e)}>
            <span class="db-create-item-label">AI-Powered</span>
            <span class="db-create-item-sub">Gemini-generated</span>
          </button>
          <div class={`db-submenu ${menu.isOpen('ai') ? 'db-submenu--open' : ''}`}>
            <div
              class="db-submenu-group"
              onMouseEnter={() => menu.enter('ai-lang')}
              onMouseLeave={() => menu.leave('ai-lang')}
              onPointerDown={(e) => openSubMenu('ai-lang', e)}
              onClick={(e) => openSubMenu('ai-lang', e)}
            >
              <span class="db-submenu-item-label">Language</span>
              <span class="db-submenu-item-sub">E.g., Spanish</span>
              <div class={`db-submenu db-submenu-l2 ${menu.isOpen('ai-lang') ? 'db-submenu--open' : ''}`}>
                <button type="button" class="db-submenu-action" onClick={() => openFlow('translation')}>
                  <span>Translation</span>
                  <span class="db-submenu-action-sub">Generate bilingual flashcards</span>
                </button>
                <button type="button" class="db-submenu-action" onClick={() => openFlow('conversation')}>
                  <span>Conversation</span>
                  <span class="db-submenu-action-sub">Target language Q&A</span>
                </button>
                <button type="button" class="db-submenu-action" onClick={() => openFlow('language_checkit')}>
                  <span>CheckIt</span>
                  <span class="db-submenu-action-sub">Spot intentional errors</span>
                </button>
              </div>
            </div>
            <div
              class="db-submenu-group"
              onMouseEnter={() => menu.enter('ai-acad')}
              onMouseLeave={() => menu.leave('ai-acad')}
              onPointerDown={(e) => openSubMenu('ai-acad', e)}
              onClick={(e) => openSubMenu('ai-acad', e)}
            >
              <span class="db-submenu-item-label">Academic</span>
              <span class="db-submenu-item-sub">E.g., Physics</span>
              <div class={`db-submenu db-submenu-l2 ${menu.isOpen('ai-acad') ? 'db-submenu--open' : ''}`}>
                <button type="button" class="db-submenu-action" onClick={() => openFlow('academic_qa')}>
                  <span>Q&A</span>
                  <span class="db-submenu-action-sub">Traditional flashcards</span>
                </button>
                <button type="button" class="db-submenu-action" onClick={() => openFlow('academic_checkit')}>
                  <span>CheckIt</span>
                  <span class="db-submenu-action-sub">Spot intentional errors</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ProjectBrowserModal open={browserOpen()} onClose={() => setBrowserOpen(false)} />
      <ProjectFilePickerModal open={filePickerOpen()} onClose={() => setFilePickerOpen(false)} />
      <CreateFlowModal config={activeFlow()} onClose={() => setActiveFlow(null)} />
      <SourceMaterialModal open={sourceOpen()} onClose={() => setSourceOpen(false)} />
      <DiyEditorModal open={diyOpen()} onClose={() => setDiyOpen(false)} />
    </div>
  );
}

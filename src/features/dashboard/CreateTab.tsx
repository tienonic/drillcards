import { createSignal } from 'solid-js';
import { createHoverMenu } from './createHoverMenu.ts';
import { ProjectBrowserModal } from './ProjectBrowserModal.tsx';
import { CreateFlowModal } from './CreateFlowModal.tsx';
import { SourceMaterialModal } from './SourceMaterialModal.tsx';
import { DiyEditorModal } from './DiyEditorModal.tsx';
import { validateAndOpenFile } from '../launcher/store.ts';
import { flowConfigs, type FlowConfig } from './flowConfigs.ts';
import { getGeminiKey, setGeminiKey } from './gemini.ts';

export function CreateTab() {
  const menu = createHoverMenu();
  const [browserOpen, setBrowserOpen] = createSignal(false);
  const [sourceOpen, setSourceOpen] = createSignal(false);
  const [activeFlow, setActiveFlow] = createSignal<FlowConfig | null>(null);
  const [diyOpen, setDiyOpen] = createSignal(false);
  const [apiKey, setApiKey] = createSignal(getGeminiKey() ?? '');
  let fileInputRef: HTMLInputElement | undefined;

  function openFlow(id: string) {
    menu.closeAll();
    setActiveFlow(flowConfigs[id] ?? null);
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        validateAndOpenFile(reader.result);
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  function handleKeyChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    setApiKey(val);
    setGeminiKey(val);
  }

  return (
    <div class="db-create" onMouseLeave={() => menu.closeAll()}>
      <div class="db-create-menu">
        {/* Import */}
        <div
          class="db-create-item"
          onMouseEnter={() => menu.enter('import')}
          onMouseLeave={() => menu.leave('import')}
        >
          <span class="db-create-item-label">Import</span>
          <span class="db-create-item-sub">Decks & files</span>
          <div class={`db-submenu ${menu.isOpen('import') ? 'db-submenu--open' : ''}`}>
            <button type="button" class="db-submenu-action" onClick={() => { setBrowserOpen(true); menu.closeAll(); }}>
              <span>Browse Decks</span>
              <span class="db-submenu-action-sub">Select from your deck library</span>
            </button>
            <button type="button" class="db-submenu-action" onClick={() => { fetch('/__open-folder?path=projects').catch(() => {}); fileInputRef?.click(); menu.closeAll(); }}>
              <span>Open File (.json)</span>
              <span class="db-submenu-action-sub">Import a project file</span>
            </button>
            <button type="button" class="db-submenu-action" onClick={() => { setSourceOpen(true); menu.closeAll(); }}>
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
          <span class="db-create-item-label">Manual</span>
          <span class="db-create-item-sub">Your own cards</span>
          <div class={`db-submenu ${menu.isOpen('manual') ? 'db-submenu--open' : ''}`}>
            <button type="button" class="db-submenu-action" onClick={() => { setDiyOpen(true); menu.closeAll(); }}>
              <span>DIY Flashcards</span>
              <span class="db-submenu-action-sub">Create front/back card pairs</span>
            </button>
            <button type="button" class="db-submenu-action" onClick={() => { fetch('/__open-folder?path=GENERATING_PROJECTS.md').catch(() => {}); menu.closeAll(); }}>
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
          <span class="db-create-item-label">AI-Powered</span>
          <span class="db-create-item-sub">Gemini-generated</span>
          <div class={`db-submenu ${menu.isOpen('ai') ? 'db-submenu--open' : ''}`}>
            <div
              class="db-submenu-group"
              onMouseEnter={() => menu.enter('ai-lang')}
              onMouseLeave={() => menu.leave('ai-lang')}
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

      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />
      <ProjectBrowserModal open={browserOpen()} onClose={() => setBrowserOpen(false)} />
      <CreateFlowModal config={activeFlow()} onClose={() => setActiveFlow(null)} />
      <SourceMaterialModal open={sourceOpen()} onClose={() => setSourceOpen(false)} />
      <DiyEditorModal open={diyOpen()} onClose={() => setDiyOpen(false)} />
    </div>
  );
}

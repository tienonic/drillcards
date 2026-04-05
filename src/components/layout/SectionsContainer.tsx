import { For, Show, lazy } from 'solid-js';
import { activeProject, activeTab, mergedMode } from '../../core/store/app.ts';
import { cardTypeRegistry } from '../../projects/cardTypeRegistry.ts';
import { MergedQuizView, MERGED_TAB_ID } from '../../features/quiz/MergedQuizView.tsx';

// Lazy-load components from registry
const componentCache = new Map<string, ReturnType<typeof lazy>>();
function getComponent(type: string) {
  if (!componentCache.has(type)) {
    const entry = cardTypeRegistry[type as keyof typeof cardTypeRegistry];
    if (entry) componentCache.set(type, lazy(entry.component));
  }
  return componentCache.get(type);
}

export function SectionsContainer() {
  return (
    <div>
      {/* Individual section views — hidden when merged mode is active */}
      <For each={activeProject()?.sections ?? []}>
        {(section) => {
          const Comp = getComponent(section.type);
          return (
            <div class={activeTab() === section.id && !mergedMode() ? 'block' : 'hidden'}>
              {Comp ? <Comp section={section} /> : null}
            </div>
          );
        }}
      </For>

      {/* Merged view — shown when merged mode is active */}
      <Show when={mergedMode()}>
        <div class={activeTab() === MERGED_TAB_ID ? 'block' : 'hidden'}>
          <MergedQuizView />
        </div>
      </Show>
    </div>
  );
}

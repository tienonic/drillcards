import { For, lazy } from 'solid-js';
import { activeProject, activeTab } from '../../core/store/app.ts';
import { cardTypeRegistry } from '../../projects/cardTypeRegistry.ts';

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
      <For each={activeProject()?.sections ?? []}>
        {(section) => {
          const Comp = getComponent(section.type);
          return (
            <div class={activeTab() === section.id ? 'block' : 'hidden'}>
              {Comp ? <Comp section={section} /> : null}
            </div>
          );
        }}
      </For>
    </div>
  );
}

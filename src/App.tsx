import { Show, onMount, onCleanup } from 'solid-js';
import { appPhase } from './core/store/app.ts';
import { initWorker, terminateWorker } from './core/hooks/useWorker.ts';
import { Dashboard } from './features/dashboard/Dashboard.tsx';
import { StudyApp } from './components/layout/StudyApp.tsx';

export function App() {
  onMount(async () => {
    try {
      await initWorker();
    } catch {
      // Worker init failed — dashboard will show with empty state
    }
  });
  onCleanup(() => terminateWorker());

  return (
    <>
      <Show when={appPhase() === 'launcher'}>
        <Dashboard />
      </Show>
      <Show when={appPhase() === 'study'}>
        <StudyApp />
      </Show>
    </>
  );
}

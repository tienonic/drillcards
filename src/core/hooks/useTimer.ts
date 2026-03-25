import { createSignal, batch, onCleanup } from 'solid-js';

export function useTimer() {
  const [seconds, setSeconds] = createSignal(0);
  const [paused, setPaused] = createSignal(false);
  let interval: ReturnType<typeof setInterval> | null = null;

  function start() {
    stop();
    batch(() => { setSeconds(0); setPaused(false); });
    interval = setInterval(() => setSeconds(s => s + 1), 1000);
  }

  function stop(): number {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
    return seconds();
  }

  function pause() {
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
    setPaused(true);
  }

  function resume() {
    if (!paused()) return;
    setPaused(false);
    interval = setInterval(() => setSeconds(s => s + 1), 1000);
  }

  function reset() {
    stop();
    batch(() => { setSeconds(0); setPaused(false); });
  }

  onCleanup(() => { if (interval !== null) clearInterval(interval); });

  return { seconds, start, stop, reset, pause, resume, paused };
}

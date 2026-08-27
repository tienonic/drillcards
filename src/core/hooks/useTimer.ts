import { createSignal, batch, onCleanup } from 'solid-js';

export function useTimer() {
  const [seconds, setSeconds] = createSignal(0);
  const [paused, setPaused] = createSignal(false);
  let interval: ReturnType<typeof setInterval> | null = null;
  let startedAt: number | null = null;
  let elapsedMs = 0;

  function updateElapsed() {
    const runningMs = startedAt === null ? 0 : Math.max(0, Date.now() - startedAt);
    setSeconds(Math.floor((elapsedMs + runningMs) / 1000));
  }

  function clearTicking(captureElapsed: boolean) {
    if (startedAt !== null) {
      if (captureElapsed) elapsedMs += Math.max(0, Date.now() - startedAt);
      startedAt = null;
    }
    if (interval !== null) {
      clearInterval(interval);
      interval = null;
    }
  }

  function beginTicking() {
    startedAt = Date.now();
    interval = setInterval(updateElapsed, 1000);
  }

  function start() {
    clearTicking(false);
    elapsedMs = 0;
    batch(() => { setSeconds(0); setPaused(false); });
    beginTicking();
  }

  function stop(): number {
    updateElapsed();
    clearTicking(true);
    setPaused(false);
    return seconds();
  }

  function pause() {
    if (startedAt === null) return;
    updateElapsed();
    clearTicking(true);
    setPaused(true);
  }

  function resume() {
    if (!paused()) return;
    setPaused(false);
    beginTicking();
  }

  function reset() {
    clearTicking(false);
    elapsedMs = 0;
    batch(() => { setSeconds(0); setPaused(false); });
  }

  function togglePause() { paused() ? resume() : pause(); }

  onCleanup(() => clearTicking(false));

  return { seconds, start, stop, reset, pause, resume, paused, togglePause };
}

import { createRoot } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimer } from './useTimer.ts';

describe('useTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T20:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks elapsed wall-clock time when browser timer callbacks are delayed', () => {
    let timer!: ReturnType<typeof useTimer>;
    const dispose = createRoot((cleanup) => {
      timer = useTimer();
      return cleanup;
    });

    timer.start();
    vi.setSystemTime(new Date('2026-08-27T20:00:05Z'));
    vi.advanceTimersToNextTimer();

    expect(timer.seconds()).toBe(6);
    dispose();
  });

  it('does not create a paused timer when nothing is running', () => {
    let timer!: ReturnType<typeof useTimer>;
    const dispose = createRoot((cleanup) => {
      timer = useTimer();
      return cleanup;
    });

    timer.pause();

    expect(timer.paused()).toBe(false);
    dispose();
  });
});

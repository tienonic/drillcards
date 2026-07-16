import { describe, expect, it, vi } from 'vitest';
import type { Card } from 'ts-fsrs';
import type { WorkerContext } from '../workerContext.ts';
import { buryCard, previewRatings, resetNewCount, reviewCard, suspendCard, undoReview } from './card.ts';
import { resetSection } from './score.ts';

function context(overrides: Partial<WorkerContext> = {}): WorkerContext {
  return {
    run: vi.fn().mockResolvedValue(undefined),
    queryAll: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    fsrsEngine: vi.fn() as unknown as WorkerContext['fsrsEngine'],
    leechThreshold: () => 8,
    initFSRS: vi.fn(),
    uuidv7: () => 'operation-1',
    cardToFSRS: vi.fn() as unknown as WorkerContext['cardToFSRS'],
    saveCardFromFSRS: vi.fn().mockResolvedValue(undefined),
    checkNewDay: vi.fn().mockResolvedValue(undefined),
    getNewTodayCount: vi.fn().mockResolvedValue(0),
    incrementNewToday: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('project-scoped card actions', () => {
  it('scopes preview, suspend, and bury SQL by project and card identity', async () => {
    const ctx = context();
    await previewRatings(ctx, 'project-a', 'same-card');
    await suspendCard(ctx, 'project-a', 'same-card');
    await buryCard(ctx, 'project-a', 'same-card');

    expect(ctx.queryOne).toHaveBeenCalledWith(expect.stringContaining('project_id = ? AND card_id = ? AND in_deck = 1'), ['project-a', 'same-card']);
    for (const call of vi.mocked(ctx.run).mock.calls) {
      expect(call[0]).toContain('project_id = ? AND card_id = ?');
      expect(call[1]?.slice(-2)).toEqual(['project-a', 'same-card']);
    }
  });

  it('resets only the exact active project/day/section/type quota scope', async () => {
    const ctx = context();
    await resetNewCount(ctx, 'project-a', ['sec1', 'sec2'], 'quiz');

    expect(ctx.run).toHaveBeenCalledWith(
      expect.stringContaining('project_id = ? AND date = ? AND key = ?'),
      ['project-a', expect.any(String), 'project-a|sec1,sec2|quiz'],
    );
  });

  it('section reset removes exact merged quota keys containing the section and leaves others alone', async () => {
    const ctx = context({
      queryAll: vi.fn().mockResolvedValue([
        { date: '2026-07-16', key: 'project-a|sec1,sec2|quiz' },
        { date: '2026-07-16', key: 'project-a|sec3|quiz' },
      ]),
    });
    await resetSection(ctx, 'project-a', 'sec1');

    expect(ctx.run).toHaveBeenCalledWith(
      expect.stringContaining('project_id = ? AND date = ? AND key = ?'),
      ['project-a', '2026-07-16', 'project-a|sec1,sec2|quiz'],
    );
    expect(ctx.run).not.toHaveBeenCalledWith(
      expect.stringContaining('project_id = ? AND date = ? AND key = ?'),
      ['project-a', '2026-07-16', 'project-a|sec3|quiz'],
    );
  });

  it('writes review log and activity under one operation id and keeps undo metadata', async () => {
    const before = {
      card_id: 'same-card', project_id: 'project-a', section_id: 'sec1', fsrs_state: 0,
      due: '2026-07-16T17:00:00.000Z', stability: 0, difficulty: 0,
      elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, last_review: null,
      suspended: 0, buried: 0, leech: 0,
    };
    const next = { ...before, state: 2, due: new Date('2026-07-17T17:00:00.000Z') } as unknown as Card;
    const ctx = context({
      queryOne: vi.fn().mockResolvedValue(before),
      cardToFSRS: vi.fn().mockReturnValue({ ...next, state: 0 }),
      fsrsEngine: (() => ({ repeat: () => ({ 3: { card: next } }) })) as WorkerContext['fsrsEngine'],
    });

    await reviewCard(ctx, 'same-card', 'project-a', 'sec1', 3);

    expect(ctx.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO activity'),
      ['operation-1', 'project-a', 'sec1', 3, 1, expect.any(String)],
    );
    const undoInsert = vi.mocked(ctx.run).mock.calls.find(([sql]) => String(sql).includes('INSERT INTO undo_stack'));
    expect(undoInsert).toBeTruthy();
    expect(undoInsert![1]).toEqual(['project-a', 'same-card', 'operation-1', 'operation-1', JSON.stringify(before)]);
  });

  it('undo restores only the requested project and deletes the exact paired log/activity', async () => {
    const snapshot = JSON.stringify({
      project_id: 'project-a', card_id: 'same-card', fsrs_state: 0, due: '2026-07-16T17:00:00.000Z',
      stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0,
      last_review: null, suspended: 0, buried: 0, leech: 0,
    });
    const ctx = context({ queryOne: vi.fn().mockResolvedValue({ id: 7, project_id: 'project-a', card_id: 'same-card', review_log_id: 'operation-1', activity_id: 'operation-1', prev_state: snapshot }) });

    await expect(undoReview(ctx, 'project-a')).resolves.toEqual({ undone: true, cardId: 'same-card' });
    expect(ctx.run).toHaveBeenCalledWith(expect.stringContaining('WHERE project_id = ? AND card_id = ?'), expect.arrayContaining(['project-a', 'same-card']));
    expect(ctx.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM review_log WHERE id = ? AND project_id = ?'), ['operation-1', 'project-a']);
    expect(ctx.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM activity WHERE id = ? AND project_id = ?'), ['operation-1', 'project-a']);
  });
});

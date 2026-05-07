import type { WorkerContext } from '../workerContext.ts';
import { Rating, State, type Card, type Grade, type IPreview, type RecordLogItem } from 'ts-fsrs';
import { formatInterval, isLeech, newTodayKey } from '../helpers.ts';
import type { PickCardType } from '../protocol.ts';

function cardTypeFilter(cardType?: PickCardType): { sql: string; params: string[] } {
  if (!cardType) return { sql: '', params: [] };
  if (cardType === 'quiz') return { sql: ' AND card_type != ?', params: ['flashcard'] };
  return { sql: ' AND card_type = ?', params: [cardType] };
}

export async function pickNext(
  ctx: WorkerContext,
  projectId: string,
  sectionIds: string[],
  newPerSession: number,
  cardType?: PickCardType,
): Promise<{ cardId: string | null }> {
  await ctx.checkNewDay();
  const placeholders = sectionIds.map(() => '?').join(',');
  const now = new Date().toISOString();
  const typeFilter = cardTypeFilter(cardType);

  // 1. Learning/Relearning due (oldest)
  let row = await ctx.queryOne(
    `SELECT card_id FROM cards
     WHERE project_id = ? AND section_id IN (${placeholders})
     AND suspended = 0 AND buried = 0
     AND fsrs_state IN (1, 3) AND due <= ?${typeFilter.sql}
     ORDER BY due ASC LIMIT 1`,
    [projectId, ...sectionIds, now, ...typeFilter.params],
  );
  if (row) return { cardId: row.card_id as string };

  // 2. Review due (oldest)
  row = await ctx.queryOne(
    `SELECT card_id FROM cards
     WHERE project_id = ? AND section_id IN (${placeholders})
     AND suspended = 0 AND buried = 0
     AND fsrs_state = 2 AND due <= ?${typeFilter.sql}
     ORDER BY due ASC LIMIT 1`,
    [projectId, ...sectionIds, now, ...typeFilter.params],
  );
  if (row) return { cardId: row.card_id as string };

  // 3. New cards (capped per section+cardType, persisted in daily_new)
  const key = newTodayKey(projectId, sectionIds, cardType);
  const used = await ctx.getNewTodayCount(projectId, key);
  if (used < newPerSession) {
    row = await ctx.queryOne(
      `SELECT card_id FROM cards
       WHERE project_id = ? AND section_id IN (${placeholders})
       AND suspended = 0 AND buried = 0
       AND fsrs_state = 0${typeFilter.sql}
       ORDER BY RANDOM() LIMIT 1`,
      [projectId, ...sectionIds, ...typeFilter.params],
    );
    if (row) {
      await ctx.incrementNewToday(projectId, key);
      return { cardId: row.card_id as string };
    }
  }

  // No more cards due
  return { cardId: null };
}

export async function pickNextOverride(
  ctx: WorkerContext,
  projectId: string,
  sectionIds: string[],
  cardType?: PickCardType,
  excludeIds?: string[],
): Promise<{ cardId: string | null }> {
  await ctx.checkNewDay();
  const placeholders = sectionIds.map(() => '?').join(',');
  const typeFilter = cardTypeFilter(cardType);
  const excludeFilter =
    excludeIds && excludeIds.length > 0
      ? ` AND card_id NOT IN (${excludeIds.map(() => '?').join(',')})`
      : '';
  const excludeParam = excludeIds && excludeIds.length > 0 ? excludeIds : [];

  // Pick weakest card (lowest stability) regardless of due date
  const row = await ctx.queryOne(
    `SELECT card_id FROM cards
     WHERE project_id = ? AND section_id IN (${placeholders})
     AND suspended = 0 AND buried = 0${typeFilter.sql}${excludeFilter}
     ORDER BY stability ASC, RANDOM() LIMIT 1`,
    [projectId, ...sectionIds, ...typeFilter.params, ...excludeParam],
  );
  return row ? { cardId: row.card_id as string } : { cardId: null };
}

export async function resetNewCount(ctx: WorkerContext): Promise<{ ok: boolean }> {
  const today = new Date().toISOString().slice(0, 10);
  await ctx.run(`DELETE FROM daily_new WHERE date = ?`, [today]);
  return { ok: true };
}

export async function previewRatings(
  ctx: WorkerContext,
  cardId: string,
): Promise<{ labels: Record<number, string> }> {
  const row = await ctx.queryOne(`SELECT * FROM cards WHERE card_id = ?`, [cardId]);
  if (!row) return { labels: {} };

  const card = ctx.cardToFSRS(row);
  const result: IPreview = ctx.fsrsEngine().repeat(card, new Date());
  const labels: Record<number, string> = {};
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
    const nextCard = result[r as Grade].card;
    const days = Math.max(0, (nextCard.due.getTime() - Date.now()) / 86400000);
    labels[r] = formatInterval(days);
  }
  return { labels };
}

export async function reviewCard(
  ctx: WorkerContext,
  cardId: string,
  projectId: string,
  sectionId: string,
  rating: number,
): Promise<{
  card: { state: number; due: string; stability: number; difficulty: number };
  isLeech: boolean;
  lapses: number;
}> {
  const row = await ctx.queryOne(`SELECT * FROM cards WHERE card_id = ?`, [cardId]);
  if (!row) throw new Error(`Card not found: ${cardId}`);

  const card = ctx.cardToFSRS(row);

  // Apply FSRS (pure computation, before transaction)
  const result: IPreview = ctx.fsrsEngine().repeat(card, new Date());
  const reviewed = result[rating as Grade];
  const newCard = reviewed.card;

  let newLapses = row.lapses as number;
  if (rating === Rating.Again && (card.state === State.Review || card.state === State.Relearning)) {
    newLapses++;
  }

  let isLeechNow = false;
  if (isLeech(newLapses, ctx.leechThreshold())) {
    isLeechNow = true;
  }

  const logId = ctx.uuidv7();
  const reviewTime = new Date().toISOString();

  await ctx.run('BEGIN');
  try {
    await ctx.run(`DELETE FROM undo_stack`);
    await ctx.run(`INSERT INTO undo_stack (card_id, prev_state) VALUES (?, ?)`, [
      cardId,
      JSON.stringify(row),
    ]);

    if (isLeechNow) {
      await ctx.run(`UPDATE cards SET leech = 1 WHERE card_id = ?`, [cardId]);
    }

    await ctx.saveCardFromFSRS(cardId, newCard, newLapses);

    await ctx.run(
      `INSERT INTO review_log (id, card_id, project_id, rating, review_time, section_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, cardId, projectId, rating, reviewTime, sectionId],
    );

    await ctx.run('COMMIT');
  } catch (e) {
    await ctx.run('ROLLBACK');
    throw e;
  }

  return {
    card: {
      state: newCard.state,
      due: newCard.due.toISOString(),
      stability: newCard.stability,
      difficulty: newCard.difficulty,
    },
    isLeech: isLeechNow,
    lapses: newLapses,
  };
}

export async function undoReview(
  ctx: WorkerContext,
): Promise<{ undone: false } | { undone: true; cardId: string }> {
  const undoRow = await ctx.queryOne(`SELECT * FROM undo_stack ORDER BY id DESC LIMIT 1`);
  if (!undoRow) return { undone: false };

  const prevState = JSON.parse(undoRow.prev_state as string);

  await ctx.run('BEGIN');
  try {
    await ctx.run(
      `UPDATE cards SET fsrs_state = ?, due = ?, stability = ?, difficulty = ?,
       elapsed_days = ?, scheduled_days = ?, reps = ?, lapses = ?,
       last_review = ?, suspended = ?, buried = ?, leech = ?, updated_at = datetime('now')
       WHERE card_id = ?`,
      [
        prevState.fsrs_state,
        prevState.due,
        prevState.stability,
        prevState.difficulty,
        prevState.elapsed_days,
        prevState.scheduled_days,
        prevState.reps,
        prevState.lapses,
        prevState.last_review,
        prevState.suspended,
        prevState.buried,
        prevState.leech,
        undoRow.card_id,
      ],
    );
    await ctx.run(`DELETE FROM undo_stack WHERE id = ?`, [undoRow.id]);

    await ctx.run(
      `DELETE FROM review_log WHERE id = (
        SELECT id FROM review_log WHERE card_id = ? ORDER BY review_time DESC LIMIT 1
      )`,
      [undoRow.card_id],
    );

    await ctx.run('COMMIT');
  } catch (e) {
    await ctx.run('ROLLBACK');
    throw e;
  }

  return { undone: true, cardId: undoRow.card_id as string };
}

export async function suspendCard(ctx: WorkerContext, cardId: string): Promise<{ ok: boolean }> {
  await ctx.run(
    `UPDATE cards SET suspended = 1, updated_at = datetime('now') WHERE card_id = ?`,
    [cardId],
  );
  return { ok: true };
}

export async function buryCard(ctx: WorkerContext, cardId: string): Promise<{ ok: boolean }> {
  await ctx.run(`UPDATE cards SET buried = 1, updated_at = datetime('now') WHERE card_id = ?`, [
    cardId,
  ]);
  return { ok: true };
}

export async function unburyAll(ctx: WorkerContext, projectId: string): Promise<{ ok: boolean }> {
  await ctx.run(
    `UPDATE cards SET buried = 0, updated_at = datetime('now') WHERE project_id = ?`,
    [projectId],
  );
  return { ok: true };
}

export async function countDue(
  ctx: WorkerContext,
  projectId: string,
  sectionIds: string[],
  cardType?: PickCardType,
): Promise<{ due: number; newCount: number; total: number }> {
  const placeholders = sectionIds.map(() => '?').join(',');
  const now = new Date().toISOString();
  const typeFilter = cardTypeFilter(cardType);

  const dueRow = await ctx.queryOne(
    `SELECT COUNT(*) as cnt FROM cards
     WHERE project_id = ? AND section_id IN (${placeholders})
     AND suspended = 0 AND buried = 0
     AND fsrs_state IN (1,2,3) AND due <= ?${typeFilter.sql}`,
    [projectId, ...sectionIds, now, ...typeFilter.params],
  );
  const newRow = await ctx.queryOne(
    `SELECT COUNT(*) as cnt FROM cards
     WHERE project_id = ? AND section_id IN (${placeholders})
     AND suspended = 0 AND buried = 0 AND fsrs_state = 0${typeFilter.sql}`,
    [projectId, ...sectionIds, ...typeFilter.params],
  );
  const totalRow = await ctx.queryOne(
    `SELECT COUNT(*) as cnt FROM cards
     WHERE project_id = ? AND section_id IN (${placeholders})
     AND suspended = 0 AND buried = 0${typeFilter.sql}`,
    [projectId, ...sectionIds, ...typeFilter.params],
  );

  return {
    due: (dueRow?.cnt as number) ?? 0,
    newCount: (newRow?.cnt as number) ?? 0,
    total: (totalRow?.cnt as number) ?? 0,
  };
}

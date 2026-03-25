import type { WorkerContext } from '../workerContext.ts';

export async function updateScore(
  ctx: WorkerContext,
  projectId: string,
  sectionId: string,
  correct: boolean,
): Promise<Record<string, unknown> | null> {
  if (correct) {
    await ctx.run(
      `UPDATE scores SET correct = correct + 1, attempted = attempted + 1, updated_at = datetime('now')
       WHERE project_id = ? AND section_id = ?`,
      [projectId, sectionId],
    );
  } else {
    await ctx.run(
      `UPDATE scores SET attempted = attempted + 1, updated_at = datetime('now')
       WHERE project_id = ? AND section_id = ?`,
      [projectId, sectionId],
    );
  }
  const row = await ctx.queryOne(
    `SELECT * FROM scores WHERE project_id = ? AND section_id = ?`,
    [projectId, sectionId],
  );
  return row;
}

export async function getScores(
  ctx: WorkerContext,
  projectId: string,
): Promise<Record<string, unknown>[]> {
  return ctx.queryAll(`SELECT * FROM scores WHERE project_id = ?`, [projectId]);
}

export async function resetSection(
  ctx: WorkerContext,
  projectId: string,
  sectionId: string,
): Promise<{ ok: boolean }> {
  await ctx.run('BEGIN');
  try {
    await ctx.run(`DELETE FROM cards WHERE project_id = ? AND section_id = ?`, [
      projectId,
      sectionId,
    ]);
    await ctx.run(
      `UPDATE scores SET correct = 0, attempted = 0, updated_at = datetime('now')
       WHERE project_id = ? AND section_id = ?`,
      [projectId, sectionId],
    );
    await ctx.run(`DELETE FROM undo_stack`);
    await ctx.run('COMMIT');
  } catch (e) {
    await ctx.run('ROLLBACK');
    throw e;
  }
  await ctx.run(`DELETE FROM daily_new WHERE project_id = ?`, [projectId]);
  return { ok: true };
}

import type { WorkerContext } from '../workerContext.ts';

export async function addNote(
  ctx: WorkerContext,
  projectId: string,
  text: string,
): Promise<{ ok: boolean }> {
  await ctx.run(`INSERT INTO notes (id, project_id, text) VALUES (?, ?, ?)`, [
    ctx.uuidv7(),
    projectId,
    text,
  ]);
  return { ok: true };
}

export async function getHotkeys(ctx: WorkerContext): Promise<Record<string, unknown>[]> {
  return ctx.queryAll(`SELECT * FROM hotkeys`);
}

export async function setHotkey(
  ctx: WorkerContext,
  action: string,
  binding: string,
  context: string,
): Promise<{ ok: boolean }> {
  await ctx.run(
    `INSERT OR REPLACE INTO hotkeys (action, binding, context, updated_at) VALUES (?, ?, ?, datetime('now'))`,
    [action, binding, context],
  );
  return { ok: true };
}

export async function setFsrsParams(
  ctx: WorkerContext,
  retention?: number,
  leechThreshold?: number,
  maxInterval?: number,
): Promise<{ ok: boolean }> {
  ctx.initFSRS(retention, leechThreshold, maxInterval);
  return { ok: true };
}

export async function getRetentionMisc(
  ctx: WorkerContext,
  projectId: string,
): Promise<{ retention: number | null }> {
  ctx.initFSRS();
  const rows = await ctx.queryAll(
    `SELECT * FROM cards WHERE project_id = ? AND fsrs_state = 2 AND suspended = 0`,
    [projectId],
  );
  if (rows.length === 0) return { retention: null };
  const now = new Date();
  let sum = 0;
  for (const row of rows) {
    sum += ctx.fsrsEngine().get_retrievability(ctx.cardToFSRS(row), now, false);
  }
  return { retention: sum / rows.length };
}

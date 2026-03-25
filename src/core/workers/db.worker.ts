import type { WorkerMessage, WorkerRequest, WorkerResponse } from './protocol.ts';
import {
  fsrs,
  Rating,
  State,
  generatorParameters,
  type FSRS,
  type Card,
  type RecordLogItem,
} from 'ts-fsrs';

// wa-sqlite state — typed loosely because wa-sqlite has no matching TypeScript overloads
let db: number = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlite3: any = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cards (
  card_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  card_type TEXT NOT NULL CHECK(card_type IN ('mcq','passage','flashcard')),
  fsrs_state INTEGER DEFAULT 0,
  due TEXT DEFAULT (datetime('now')),
  stability REAL DEFAULT 0,
  difficulty REAL DEFAULT 0,
  elapsed_days INTEGER DEFAULT 0,
  scheduled_days INTEGER DEFAULT 0,
  reps INTEGER DEFAULT 0,
  lapses INTEGER DEFAULT 0,
  last_review TEXT,
  suspended INTEGER DEFAULT 0,
  buried INTEGER DEFAULT 0,
  leech INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due);
CREATE INDEX IF NOT EXISTS idx_cards_section ON cards(section_id);
CREATE INDEX IF NOT EXISTS idx_cards_project ON cards(project_id);

CREATE TABLE IF NOT EXISTS review_log (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  rating INTEGER NOT NULL,
  review_time TEXT NOT NULL,
  section_id TEXT
);

CREATE TABLE IF NOT EXISTS scores (
  project_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  correct INTEGER DEFAULT 0,
  attempted INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, section_id)
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  section_id TEXT,
  rating INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hotkeys (
  action TEXT PRIMARY KEY,
  binding TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT 'global',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS undo_stack (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  prev_state TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_new (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, key)
);
`;

const SCHEMA_VERSION = 2;

const migrations: Record<number, () => Promise<void>> = {
  2: async () => {
    await sqlite3.exec(db, `
      CREATE TABLE IF NOT EXISTS daily_new (
        project_id TEXT NOT NULL,
        date TEXT NOT NULL,
        key TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (project_id, date, key)
      );
    `);
  },
};

async function applyMigrations() {
  const rows: unknown[][] = [];
  await sqlite3.exec(db, 'PRAGMA user_version', (row: unknown[]) => rows.push(row));
  const currentVersion = rows.length > 0 ? (rows[0][0] as number) : 0;

  if (currentVersion === SCHEMA_VERSION) return;

  if (currentVersion === 0) {
    const statements = SCHEMA.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await sqlite3.exec(db, stmt + ';');
    }
    await sqlite3.exec(db, `PRAGMA user_version = ${SCHEMA_VERSION}`);
    return;
  }

  for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
    const migrate = migrations[v];
    if (!migrate) throw new Error(`Missing migration for version ${v}`);
    await sqlite3.exec(db, 'BEGIN');
    try {
      await migrate();
      await sqlite3.exec(db, `PRAGMA user_version = ${v}`);
      await sqlite3.exec(db, 'COMMIT');
    } catch (err) {
      await sqlite3.exec(db, 'ROLLBACK');
      throw err;
    }
  }
}

let fsrsEngine: FSRS | null = null;
let leechThreshold = 8;

function initFSRS(retention = 0.9, threshold = 8, maxInterval = 36500) {
  const params = generatorParameters({
    request_retention: retention,
    enable_short_term: true,
    maximum_interval: maxInterval,
  });
  fsrsEngine = fsrs(params);
  leechThreshold = threshold;
}

function uuidv7(): string {
  const now = Date.now();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function run(sql: string, params?: unknown[]) {
  await sqlite3.run(db, sql, params ?? null);
}

async function queryAll(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  const result = await sqlite3.execWithParams(db, sql, params ?? null);
  if (!result.rows || result.rows.length === 0) return [];
  const { columns, rows } = result;
  return rows.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = row[i];
    }
    return obj;
  });
}

async function queryOne(sql: string, params?: unknown[]): Promise<Record<string, unknown> | null> {
  const rows = await queryAll(sql, params);
  return rows[0] ?? null;
}

function cardToFSRS(row: Record<string, unknown>): Card {
  return {
    due: new Date(row.due as string),
    stability: row.stability as number,
    difficulty: row.difficulty as number,
    elapsed_days: row.elapsed_days as number,
    scheduled_days: row.scheduled_days as number,
    reps: row.reps as number,
    lapses: row.lapses as number,
    state: row.fsrs_state as number,
    last_review: row.last_review ? new Date(row.last_review as string) : undefined,
  } as Card;
}

async function saveCardFromFSRS(cardId: string, card: Card, lapses?: number) {
  await run(
    `UPDATE cards SET fsrs_state = ?, due = ?, stability = ?, difficulty = ?,
     elapsed_days = ?, scheduled_days = ?, reps = ?, lapses = COALESCE(?, lapses),
     last_review = ?, updated_at = datetime('now')
     WHERE card_id = ?`,
    [
      card.state, card.due.toISOString(), card.stability, card.difficulty,
      card.elapsed_days, card.scheduled_days, card.reps,
      lapses ?? null,
      card.last_review ? card.last_review.toISOString() : null,
      cardId,
    ]
  );
}

function formatInterval(days: number): string {
  if (days < 1 / 24) return Math.max(1, Math.round(days * 24 * 60)) + 'm';
  if (days < 1) return Math.round(days * 24) + 'h';
  if (days < 30) return Math.round(days) + 'd';
  if (days < 365) return Math.round(days / 30) + 'mo';
  return (days / 365).toFixed(1).replace(/\.0$/, '') + 'y';
}

function isLeech(lapses: number): boolean {
  if (lapses < leechThreshold) return false;
  return (lapses - leechThreshold) % Math.ceil(leechThreshold / 2) === 0;
}

let lastDate = new Date().toISOString().slice(0, 10);

function newTodayKey(projectId: string, sectionIds: string[], cardType?: string): string {
  return projectId + '|' + sectionIds.join(',') + '|' + (cardType ?? '');
}

async function checkNewDay() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastDate !== today) {
    lastDate = today;
    await run(`UPDATE cards SET buried = 0 WHERE buried = 1`);
  }
}

async function getNewTodayCount(projectId: string, key: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await queryOne(
    `SELECT count FROM daily_new WHERE project_id = ? AND date = ? AND key = ?`,
    [projectId, today, key]
  );
  return row ? (row.count as number) : 0;
}

async function incrementNewToday(projectId: string, key: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await run(
    `INSERT INTO daily_new (project_id, date, key, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(project_id, date, key) DO UPDATE SET count = count + 1`,
    [projectId, today, key]
  );
}

async function handleMessage(request: WorkerRequest): Promise<unknown> {
  switch (request.type) {
    case 'INIT': {
      const SQLiteESMFactory = (await import('wa-sqlite/dist/wa-sqlite-async.mjs')).default;
      const { IDBBatchAtomicVFS } = await import('wa-sqlite/src/examples/IDBBatchAtomicVFS.js');
      const { Factory } = await import('wa-sqlite');

      const module = await SQLiteESMFactory({
        locateFile: (file: string) => '/' + file,
      });
      sqlite3 = Factory(module);

      const vfs = new IDBBatchAtomicVFS('study-tool-db');
      sqlite3.vfs_register(vfs, true);
      db = await sqlite3.open_v2('study-tool.db');

      await applyMigrations();

      if (navigator.storage?.persist) {
        navigator.storage.persist().catch(() => {});
      }

      initFSRS();
      return { ok: true };
    }

    case 'LOAD_PROJECT': {
      const { projectId, sectionIds, cardIds } = request;
      await run('BEGIN');
      try {
        for (const sid of sectionIds) {
          await run(
            `INSERT OR IGNORE INTO scores (project_id, section_id, correct, attempted) VALUES (?, ?, 0, 0)`,
            [projectId, sid]
          );
        }
        for (const c of cardIds) {
          await run(
            `INSERT OR IGNORE INTO cards (card_id, project_id, section_id, card_type) VALUES (?, ?, ?, ?)`,
            [c.cardId, projectId, c.sectionId, c.cardType]
          );
        }
        await run('COMMIT');
      } catch (e) {
        await run('ROLLBACK');
        throw e;
      }
      return { ok: true };
    }

    case 'PICK_NEXT': {
      await checkNewDay();
      const { projectId, sectionIds, newPerSession, cardType } = request;
      const placeholders = sectionIds.map(() => '?').join(',');
      const now = new Date().toISOString();
      const typeFilter = cardType ? ' AND card_type = ?' : '';
      const typeParam = cardType ? [cardType] : [];

      // 1. Learning/Relearning due (oldest)
      let row = await queryOne(
        `SELECT card_id FROM cards
         WHERE project_id = ? AND section_id IN (${placeholders})
         AND suspended = 0 AND buried = 0
         AND fsrs_state IN (1, 3) AND due <= ?${typeFilter}
         ORDER BY due ASC LIMIT 1`,
        [projectId, ...sectionIds, now, ...typeParam]
      );
      if (row) return { cardId: row.card_id };

      // 2. Review due (oldest)
      row = await queryOne(
        `SELECT card_id FROM cards
         WHERE project_id = ? AND section_id IN (${placeholders})
         AND suspended = 0 AND buried = 0
         AND fsrs_state = 2 AND due <= ?${typeFilter}
         ORDER BY due ASC LIMIT 1`,
        [projectId, ...sectionIds, now, ...typeParam]
      );
      if (row) return { cardId: row.card_id };

      // 3. New cards (capped per section+cardType, persisted in daily_new)
      const key = newTodayKey(projectId, sectionIds, cardType);
      const used = await getNewTodayCount(projectId, key);
      if (used < newPerSession) {
        row = await queryOne(
          `SELECT card_id FROM cards
           WHERE project_id = ? AND section_id IN (${placeholders})
           AND suspended = 0 AND buried = 0
           AND fsrs_state = 0${typeFilter}
           ORDER BY RANDOM() LIMIT 1`,
          [projectId, ...sectionIds, ...typeParam]
        );
        if (row) {
          await incrementNewToday(projectId, key);
          return { cardId: row.card_id };
        }
      }

      // No more cards due
      return { cardId: null };
    }

    case 'PICK_NEXT_OVERRIDE': {
      await checkNewDay();
      const { projectId, sectionIds, cardType, excludeIds } = request;
      const placeholders = sectionIds.map(() => '?').join(',');
      const typeFilter = cardType ? ' AND card_type = ?' : '';
      const typeParam = cardType ? [cardType] : [];
      const excludeFilter = excludeIds && excludeIds.length > 0
        ? ` AND card_id NOT IN (${excludeIds.map(() => '?').join(',')})`
        : '';
      const excludeParam = excludeIds && excludeIds.length > 0 ? excludeIds : [];

      // Pick weakest card (lowest stability) regardless of due date
      const row = await queryOne(
        `SELECT card_id FROM cards
         WHERE project_id = ? AND section_id IN (${placeholders})
         AND suspended = 0 AND buried = 0${typeFilter}${excludeFilter}
         ORDER BY stability ASC, RANDOM() LIMIT 1`,
        [projectId, ...sectionIds, ...typeParam, ...excludeParam]
      );
      return row ? { cardId: row.card_id } : { cardId: null };
    }

    case 'RESET_NEW_COUNT': {
      const today = new Date().toISOString().slice(0, 10);
      await run(`DELETE FROM daily_new WHERE date = ?`, [today]);
      return { ok: true };
    }

    case 'PREVIEW_RATINGS': {
      if (!fsrsEngine) initFSRS();
      const row = await queryOne(`SELECT * FROM cards WHERE card_id = ?`, [request.cardId]);
      if (!row) return { labels: {} };

      const card = cardToFSRS(row);
      const result = fsrsEngine!.repeat(card, new Date()) as unknown as Record<number, { card: Card }>;
      const labels: Record<number, string> = {};
      for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
        const nextCard = result[r].card;
        const days = Math.max(0, (nextCard.due.getTime() - Date.now()) / 86400000);
        labels[r] = formatInterval(days);
      }
      return { labels };
    }

    case 'REVIEW_CARD': {
      if (!fsrsEngine) initFSRS();
      const { cardId, projectId, sectionId, rating } = request;

      const row = await queryOne(`SELECT * FROM cards WHERE card_id = ?`, [cardId]);
      if (!row) throw new Error(`Card not found: ${cardId}`);

      const card = cardToFSRS(row);

      // Apply FSRS (pure computation, before transaction)
      const result = fsrsEngine!.repeat(card, new Date()) as unknown as Record<number, RecordLogItem>;
      const reviewed = result[rating];
      const newCard = reviewed.card;

      let newLapses = row.lapses as number;
      if (rating === Rating.Again && (card.state === State.Review || card.state === State.Relearning)) {
        newLapses++;
      }

      let isLeechNow = false;
      if (isLeech(newLapses)) {
        isLeechNow = true;
      }

      const logId = uuidv7();
      const reviewTime = new Date().toISOString();

      await run('BEGIN');
      try {
        await run(`DELETE FROM undo_stack`);
        await run(
          `INSERT INTO undo_stack (card_id, prev_state) VALUES (?, ?)`,
          [cardId, JSON.stringify(row)]
        );

        if (isLeechNow) {
          await run(`UPDATE cards SET leech = 1 WHERE card_id = ?`, [cardId]);
        }

        await saveCardFromFSRS(cardId, newCard, newLapses);

        await run(
          `INSERT INTO review_log (id, card_id, project_id, rating, review_time, section_id) VALUES (?, ?, ?, ?, ?, ?)`,
          [logId, cardId, projectId, rating, reviewTime, sectionId]
        );

        await run('COMMIT');
      } catch (e) {
        await run('ROLLBACK');
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

    case 'UNDO_REVIEW': {
      const undoRow = await queryOne(`SELECT * FROM undo_stack ORDER BY id DESC LIMIT 1`);
      if (!undoRow) return { undone: false };

      const prevState = JSON.parse(undoRow.prev_state as string);

      await run('BEGIN');
      try {
        await run(
          `UPDATE cards SET fsrs_state = ?, due = ?, stability = ?, difficulty = ?,
           elapsed_days = ?, scheduled_days = ?, reps = ?, lapses = ?,
           last_review = ?, suspended = ?, buried = ?, leech = ?, updated_at = datetime('now')
           WHERE card_id = ?`,
          [
            prevState.fsrs_state, prevState.due, prevState.stability, prevState.difficulty,
            prevState.elapsed_days, prevState.scheduled_days, prevState.reps, prevState.lapses,
            prevState.last_review, prevState.suspended, prevState.buried, prevState.leech,
            undoRow.card_id,
          ]
        );
        await run(`DELETE FROM undo_stack WHERE id = ?`, [undoRow.id]);

        await run(
          `DELETE FROM review_log WHERE id = (
            SELECT id FROM review_log WHERE card_id = ? ORDER BY review_time DESC LIMIT 1
          )`,
          [undoRow.card_id]
        );

        await run('COMMIT');
      } catch (e) {
        await run('ROLLBACK');
        throw e;
      }

      return { undone: true, cardId: undoRow.card_id };
    }

    case 'SUSPEND_CARD': {
      await run(`UPDATE cards SET suspended = 1, updated_at = datetime('now') WHERE card_id = ?`, [request.cardId]);
      return { ok: true };
    }

    case 'BURY_CARD': {
      await run(`UPDATE cards SET buried = 1, updated_at = datetime('now') WHERE card_id = ?`, [request.cardId]);
      return { ok: true };
    }

    case 'UNBURY_ALL': {
      await run(`UPDATE cards SET buried = 0, updated_at = datetime('now') WHERE project_id = ?`, [request.projectId]);
      return { ok: true };
    }

    case 'COUNT_DUE': {
      const { projectId, sectionIds, cardType } = request;
      const placeholders = sectionIds.map(() => '?').join(',');
      const now = new Date().toISOString();
      const typeFilter = cardType ? ' AND card_type = ?' : '';
      const typeParam = cardType ? [cardType] : [];

      const dueRow = await queryOne(
        `SELECT COUNT(*) as cnt FROM cards
         WHERE project_id = ? AND section_id IN (${placeholders})
         AND suspended = 0 AND buried = 0
         AND fsrs_state IN (1,2,3) AND due <= ?${typeFilter}`,
        [projectId, ...sectionIds, now, ...typeParam]
      );
      const newRow = await queryOne(
        `SELECT COUNT(*) as cnt FROM cards
         WHERE project_id = ? AND section_id IN (${placeholders})
         AND suspended = 0 AND buried = 0 AND fsrs_state = 0${typeFilter}`,
        [projectId, ...sectionIds, ...typeParam]
      );
      const totalRow = await queryOne(
        `SELECT COUNT(*) as cnt FROM cards
         WHERE project_id = ? AND section_id IN (${placeholders})
         AND suspended = 0 AND buried = 0${typeFilter}`,
        [projectId, ...sectionIds, ...typeParam]
      );

      return {
        due: (dueRow?.cnt as number) ?? 0,
        newCount: (newRow?.cnt as number) ?? 0,
        total: (totalRow?.cnt as number) ?? 0,
      };
    }

    case 'UPDATE_SCORE': {
      const { projectId, sectionId, correct } = request;
      if (correct) {
        await run(
          `UPDATE scores SET correct = correct + 1, attempted = attempted + 1, updated_at = datetime('now')
           WHERE project_id = ? AND section_id = ?`,
          [projectId, sectionId]
        );
      } else {
        await run(
          `UPDATE scores SET attempted = attempted + 1, updated_at = datetime('now')
           WHERE project_id = ? AND section_id = ?`,
          [projectId, sectionId]
        );
      }
      const row = await queryOne(`SELECT * FROM scores WHERE project_id = ? AND section_id = ?`, [projectId, sectionId]);
      return row;
    }

    case 'GET_SCORES': {
      return await queryAll(`SELECT * FROM scores WHERE project_id = ?`, [request.projectId]);
    }

    case 'RESET_SECTION': {
      const { projectId, sectionId } = request;
      await run('BEGIN');
      try {
        await run(`DELETE FROM cards WHERE project_id = ? AND section_id = ?`, [projectId, sectionId]);
        await run(
          `UPDATE scores SET correct = 0, attempted = 0, updated_at = datetime('now')
           WHERE project_id = ? AND section_id = ?`,
          [projectId, sectionId]
        );
        await run(`DELETE FROM undo_stack`);
        await run('COMMIT');
      } catch (e) {
        await run('ROLLBACK');
        throw e;
      }
      await run(`DELETE FROM daily_new WHERE project_id = ?`, [projectId]);
      return { ok: true };
    }

    case 'ADD_ACTIVITY': {
      const { projectId, sectionId, rating, correct } = request;
      await run(
        `INSERT INTO activity (id, project_id, section_id, rating, correct, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv7(), projectId, sectionId, rating, correct ? 1 : 0, new Date().toISOString()]
      );
      const countRow = await queryOne(`SELECT COUNT(*) as cnt FROM activity WHERE project_id = ?`, [projectId]);
      const cnt = (countRow?.cnt as number) ?? 0;
      if (cnt > 200) {
        await run(
          `DELETE FROM activity WHERE id IN (
            SELECT id FROM activity WHERE project_id = ? ORDER BY timestamp ASC LIMIT ?
          )`,
          [projectId, cnt - 200]
        );
      }
      return { ok: true };
    }

    case 'GET_ACTIVITY': {
      const limit = request.limit ?? 200;
      return await queryAll(
        `SELECT * FROM activity WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?`,
        [request.projectId, limit]
      );
    }

    case 'CLEAR_ACTIVITY': {
      await run(`DELETE FROM activity WHERE project_id = ?`, [request.projectId]);
      return { ok: true };
    }

    case 'ADD_NOTE': {
      await run(
        `INSERT INTO notes (id, project_id, text) VALUES (?, ?, ?)`,
        [uuidv7(), request.projectId, request.text]
      );
      return { ok: true };
    }

    case 'GET_HOTKEYS': {
      return await queryAll(`SELECT * FROM hotkeys`);
    }

    case 'SET_HOTKEY': {
      await run(
        `INSERT OR REPLACE INTO hotkeys (action, binding, context, updated_at) VALUES (?, ?, ?, datetime('now'))`,
        [request.action, request.binding, request.context]
      );
      return { ok: true };
    }

    case 'SET_FSRS_PARAMS': {
      initFSRS(request.retention, request.leechThreshold, request.maxInterval);
      return { ok: true };
    }

    case 'GET_REVIEW_LOG': {
      const limit = request.limit ?? 1000;
      return await queryAll(
        `SELECT * FROM review_log WHERE project_id = ? ORDER BY review_time DESC LIMIT ?`,
        [request.projectId, limit]
      );
    }

    case 'GET_PERFORMANCE_CARDS': {
      return await queryAll(
        `SELECT card_id, section_id, card_type, fsrs_state, stability, difficulty, reps, lapses
         FROM cards WHERE project_id = ? AND suspended = 0
         ORDER BY lapses DESC, stability ASC`,
        [request.projectId]
      );
    }

    case 'GET_SESSION_SUMMARY': {
      const { projectId } = request;
      const lastRow = await queryOne(
        `SELECT review_time FROM review_log WHERE project_id = ? ORDER BY review_time DESC LIMIT 1`,
        [projectId]
      );
      const now = new Date().toISOString();
      const dueRow = await queryOne(
        `SELECT COUNT(*) as cnt FROM cards
         WHERE project_id = ? AND suspended = 0 AND buried = 0
         AND fsrs_state IN (1,2,3) AND due <= ?`,
        [projectId, now]
      );
      return {
        lastReviewAt: lastRow ? (lastRow.review_time as string) : null,
        dueNow: (dueRow?.cnt as number) ?? 0,
      };
    }

    case 'EXPORT_PROJECT_DATA': {
      const { projectId } = request;
      const cards = await queryAll(`SELECT * FROM cards WHERE project_id = ?`, [projectId]);
      const review_log = await queryAll(`SELECT * FROM review_log WHERE project_id = ?`, [projectId]);
      const scores = await queryAll(`SELECT * FROM scores WHERE project_id = ?`, [projectId]);
      const activity = await queryAll(`SELECT * FROM activity WHERE project_id = ?`, [projectId]);
      const notes = await queryAll(`SELECT * FROM notes WHERE project_id = ?`, [projectId]);
      return { cards, review_log, scores, activity, notes };
    }

    case 'EXPORT_GLOBAL_DATA': {
      const hotkeys = await queryAll(`SELECT * FROM hotkeys`);
      return { hotkeys };
    }

    case 'IMPORT_PROJECT_DATA': {
      const { projectId, cards, review_log, scores, activity, notes } = request;
      await run('BEGIN');
      try {
        await run(`DELETE FROM cards WHERE project_id = ?`, [projectId]);
        await run(`DELETE FROM review_log WHERE project_id = ?`, [projectId]);
        await run(`DELETE FROM scores WHERE project_id = ?`, [projectId]);
        await run(`DELETE FROM activity WHERE project_id = ?`, [projectId]);
        await run(`DELETE FROM notes WHERE project_id = ?`, [projectId]);
        await run(`DELETE FROM daily_new WHERE project_id = ?`, [projectId]);
        await run(`DELETE FROM undo_stack`);

        for (const c of cards) {
          await run(
            `INSERT INTO cards (card_id, project_id, section_id, card_type, fsrs_state, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, last_review, suspended, buried, leech, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.card_id, c.project_id, c.section_id, c.card_type, c.fsrs_state, c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days, c.reps, c.lapses, c.last_review, c.suspended, c.buried, c.leech, c.updated_at]
          );
        }
        for (const r of review_log) {
          await run(
            `INSERT INTO review_log (id, card_id, project_id, rating, review_time, section_id) VALUES (?, ?, ?, ?, ?, ?)`,
            [r.id, r.card_id, r.project_id, r.rating, r.review_time, r.section_id]
          );
        }
        for (const s of scores) {
          await run(
            `INSERT INTO scores (project_id, section_id, correct, attempted, updated_at) VALUES (?, ?, ?, ?, ?)`,
            [s.project_id, s.section_id, s.correct, s.attempted, s.updated_at]
          );
        }
        for (const a of activity) {
          await run(
            `INSERT INTO activity (id, project_id, section_id, rating, correct, timestamp) VALUES (?, ?, ?, ?, ?, ?)`,
            [a.id, a.project_id, a.section_id, a.rating, a.correct, a.timestamp]
          );
        }
        for (const n of notes) {
          await run(
            `INSERT INTO notes (id, project_id, text, created_at) VALUES (?, ?, ?, ?)`,
            [n.id, n.project_id, n.text, n.created_at]
          );
        }

        await run('COMMIT');
      } catch (e) {
        await run('ROLLBACK');
        throw e;
      }
      return { ok: true };
    }

    case 'IMPORT_GLOBAL_DATA': {
      const { hotkeys } = request;
      await run('BEGIN');
      try {
        for (const h of hotkeys) {
          await run(
            `INSERT OR REPLACE INTO hotkeys (action, binding, context, updated_at) VALUES (?, ?, ?, ?)`,
            [h.action, h.binding, h.context, h.updated_at]
          );
        }
        await run('COMMIT');
      } catch (e) {
        await run('ROLLBACK');
        throw e;
      }
      return { ok: true };
    }

    case 'GET_DECK_STATS': {
      const { projectId } = request;
      const now = new Date().toISOString();
      const newRow = await queryOne(
        `SELECT COUNT(*) as cnt FROM cards WHERE project_id = ? AND fsrs_state = 0 AND suspended = 0 AND buried = 0`,
        [projectId]
      );
      const learningRow = await queryOne(
        `SELECT COUNT(*) as cnt FROM cards WHERE project_id = ? AND fsrs_state IN (1, 3) AND suspended = 0 AND buried = 0 AND due <= ?`,
        [projectId, now]
      );
      const dueRow = await queryOne(
        `SELECT COUNT(*) as cnt FROM cards WHERE project_id = ? AND fsrs_state = 2 AND suspended = 0 AND buried = 0 AND due <= ?`,
        [projectId, now]
      );
      return {
        new: (newRow?.cnt as number) ?? 0,
        learning: (learningRow?.cnt as number) ?? 0,
        due: (dueRow?.cnt as number) ?? 0,
      };
    }

    case 'GET_SECTION_STATS': {
      const { projectId } = request;
      const now = new Date().toISOString();
      const rows = await queryAll(
        `SELECT section_id,
          SUM(CASE WHEN fsrs_state = 0 THEN 1 ELSE 0 END) as new_count,
          SUM(CASE WHEN fsrs_state IN (1,3) AND due <= ? THEN 1 ELSE 0 END) as learning_count,
          SUM(CASE WHEN fsrs_state = 2 AND due <= ? THEN 1 ELSE 0 END) as due_count,
          COUNT(*) as total
        FROM cards
        WHERE project_id = ? AND suspended = 0 AND buried = 0
        GROUP BY section_id`,
        [now, now, projectId]
      );
      return rows.map((r: Record<string, unknown>) => ({
        section_id: r.section_id as string,
        new: (r.new_count as number) ?? 0,
        learning: (r.learning_count as number) ?? 0,
        due: (r.due_count as number) ?? 0,
        total: (r.total as number) ?? 0,
      }));
    }

    case 'GET_RETENTION': {
      if (!fsrsEngine) initFSRS();
      const rows = await queryAll(
        `SELECT * FROM cards WHERE project_id = ? AND fsrs_state = 2 AND suspended = 0`,
        [request.projectId]
      );
      if (rows.length === 0) return { retention: null };
      const now = new Date();
      let sum = 0;
      for (const row of rows) {
        sum += fsrsEngine!.get_retrievability(cardToFSRS(row), now, false);
      }
      return { retention: sum / rows.length };
    }

    case 'GET_ALL_PROJECT_IDS': {
      const rows = await queryAll(`SELECT DISTINCT project_id FROM cards`);
      return (rows as { project_id: string }[]).map(r => r.project_id);
    }

    case 'DELETE_PROJECT': {
      const { projectId } = request;
      await run(`DELETE FROM cards WHERE project_id = ?`, [projectId]);
      await run(`DELETE FROM review_log WHERE project_id = ?`, [projectId]);
      await run(`DELETE FROM scores WHERE project_id = ?`, [projectId]);
      await run(`DELETE FROM activity WHERE project_id = ?`, [projectId]);
      await run(`DELETE FROM notes WHERE project_id = ?`, [projectId]);
      await run(`DELETE FROM daily_new WHERE project_id = ?`, [projectId]);
      return { ok: true };
    }

    default:
      return { error: `Unknown request type` };
  }
}

let messageQueue: Promise<void> = Promise.resolve();

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { id, request } = e.data;
  messageQueue = messageQueue.then(async () => {
    try {
      const data = await handleMessage(request);
      const response: WorkerResponse = { id, type: 'RESULT', data };
      self.postMessage(response);
    } catch (err) {
      const response: WorkerResponse = {
        id,
        type: 'ERROR',
        error: err instanceof Error ? err.message : String(err),
      };
      self.postMessage(response);
    }
  });
};

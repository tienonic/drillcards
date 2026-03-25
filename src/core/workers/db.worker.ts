import type { WorkerMessage, WorkerRequest, WorkerResponse } from './protocol.ts';
import {
  fsrs,
  generatorParameters,
  type FSRS,
  type Card,
} from 'ts-fsrs';
import { cardToFSRS, uuidv7 } from './helpers.ts';
import type { WorkerContext } from './workerContext.ts';

// Handler imports
import * as cardH from './handlers/card.ts';
import * as scoreH from './handlers/score.ts';
import * as activityH from './handlers/activity.ts';
import * as statsH from './handlers/stats.ts';
import * as importExportH from './handlers/importExport.ts';
import * as miscH from './handlers/misc.ts';

import type { SQLiteAPI } from 'wa-sqlite';

// wa-sqlite state
let db: number = 0;
let sqlite3: SQLiteAPI | null = null;

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
    await sqlite3!.exec(db, `
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
  await sqlite3!.exec(db, 'PRAGMA user_version', (row: unknown[]) => rows.push(row));
  const currentVersion = rows.length > 0 ? (rows[0][0] as number) : 0;

  if (currentVersion === SCHEMA_VERSION) return;

  if (currentVersion === 0) {
    const statements = SCHEMA.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await sqlite3!.exec(db, stmt + ';');
    }
    await sqlite3!.exec(db, `PRAGMA user_version = ${SCHEMA_VERSION}`);
    return;
  }

  for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
    const migrate = migrations[v];
    if (!migrate) throw new Error(`Missing migration for version ${v}`);
    await sqlite3!.exec(db, 'BEGIN');
    try {
      await migrate();
      await sqlite3!.exec(db, `PRAGMA user_version = ${v}`);
      await sqlite3!.exec(db, 'COMMIT');
    } catch (err) {
      await sqlite3!.exec(db, 'ROLLBACK');
      throw err;
    }
  }
}

// FSRS state
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

// DB helpers
async function run(sql: string, params?: unknown[]) {
  await sqlite3!.run(db, sql, params ?? null);
}

async function queryAll(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  const result = await sqlite3!.execWithParams(db, sql, params ?? null);
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

let lastDate = new Date().toISOString().slice(0, 10);

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

// Build context for handler modules
function getContext(): WorkerContext {
  return {
    run,
    queryAll,
    queryOne,
    fsrsEngine: () => { if (!fsrsEngine) initFSRS(); return fsrsEngine!; },
    leechThreshold: () => leechThreshold,
    initFSRS,
    uuidv7,
    cardToFSRS,
    saveCardFromFSRS,
    checkNewDay,
    getNewTodayCount,
    incrementNewToday,
  };
}

async function handleMessage(request: WorkerRequest): Promise<unknown> {
  const ctx = getContext();

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
      sqlite3!.vfs_register(vfs, true);
      db = await sqlite3!.open_v2('study-tool.db');

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

    // Card scheduling / FSRS
    case 'PICK_NEXT': return cardH.pickNext(ctx, request.projectId, request.sectionIds, request.newPerSession, request.cardType);
    case 'PICK_NEXT_OVERRIDE': return cardH.pickNextOverride(ctx, request.projectId, request.sectionIds, request.cardType, request.excludeIds);
    case 'RESET_NEW_COUNT': return cardH.resetNewCount(ctx);
    case 'PREVIEW_RATINGS': return cardH.previewRatings(ctx, request.cardId);
    case 'REVIEW_CARD': return cardH.reviewCard(ctx, request.cardId, request.projectId, request.sectionId, request.rating);
    case 'UNDO_REVIEW': return cardH.undoReview(ctx);
    case 'SUSPEND_CARD': return cardH.suspendCard(ctx, request.cardId);
    case 'BURY_CARD': return cardH.buryCard(ctx, request.cardId);
    case 'UNBURY_ALL': return cardH.unburyAll(ctx, request.projectId);
    case 'COUNT_DUE': return cardH.countDue(ctx, request.projectId, request.sectionIds, request.cardType);

    // Scores
    case 'UPDATE_SCORE': return scoreH.updateScore(ctx, request.projectId, request.sectionId, request.correct);
    case 'GET_SCORES': return scoreH.getScores(ctx, request.projectId);
    case 'RESET_SECTION': return scoreH.resetSection(ctx, request.projectId, request.sectionId);

    // Activity
    case 'ADD_ACTIVITY': return activityH.addActivity(ctx, request.projectId, request.sectionId, request.rating, request.correct);
    case 'GET_ACTIVITY': return activityH.getActivity(ctx, request.projectId, request.limit);
    case 'CLEAR_ACTIVITY': return activityH.clearActivity(ctx, request.projectId);

    // Stats
    case 'GET_DECK_STATS': return statsH.getDeckStats(ctx, request.projectId);
    case 'GET_SECTION_STATS': return statsH.getSectionStats(ctx, request.projectId);
    case 'GET_SESSION_SUMMARY': return statsH.getSessionSummary(ctx, request.projectId);
    case 'GET_REVIEW_LOG': return statsH.getReviewLog(ctx, request.projectId, request.limit);
    case 'GET_PERFORMANCE_CARDS': return statsH.getPerformanceCards(ctx, request.projectId);
    case 'GET_ALL_PROJECT_IDS': return statsH.getAllProjectIds(ctx);
    case 'GET_RETENTION': return statsH.getRetention(ctx, request.projectId);

    // Import/Export
    case 'EXPORT_PROJECT_DATA': return importExportH.exportProjectData(ctx, request.projectId);
    case 'EXPORT_GLOBAL_DATA': return importExportH.exportGlobalData(ctx);
    case 'IMPORT_PROJECT_DATA': return importExportH.importProjectData(ctx, request.projectId, request.cards, request.review_log, request.scores, request.activity, request.notes);
    case 'IMPORT_GLOBAL_DATA': return importExportH.importGlobalData(ctx, request.hotkeys);
    case 'DELETE_PROJECT': return importExportH.deleteProject(ctx, request.projectId);

    // Misc
    case 'ADD_NOTE': return miscH.addNote(ctx, request.projectId, request.text);
    case 'GET_HOTKEYS': return miscH.getHotkeys(ctx);
    case 'SET_HOTKEY': return miscH.setHotkey(ctx, request.action, request.binding, request.context);
    case 'SET_FSRS_PARAMS': return miscH.setFsrsParams(ctx, request.retention, request.leechThreshold, request.maxInterval);

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

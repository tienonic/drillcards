import { initWorker, workerApi } from '../../core/hooks/useWorker.ts';
import type { CardRow, ReviewLogRow, ScoreRow, ActivityRow, NoteRow, HotkeyRow } from '../../core/workers/protocol.ts';
import type { ProjectData, ProjectConfig } from '../../projects/types.ts';

export interface BackupFile {
  version: 1;
  backupType: 'full';
  exportedAt: string;
  slug: string;
  projectData: ProjectData | null;
  projectConfig: Partial<ProjectConfig> | null;
  cards: CardRow[];
  review_log: ReviewLogRow[];
  scores: ScoreRow[];
  activity: ActivityRow[];
  notes: NoteRow[];
  hotkeys: HotkeyRow[];
}

export function validateBackupFile(data: unknown): data is BackupFile {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.version === 1
    && typeof d.backupType === 'string'
    && typeof d.slug === 'string'
    && Array.isArray(d.cards)
    && Array.isArray(d.review_log)
    && Array.isArray(d.scores)
    && Array.isArray(d.activity)
    && Array.isArray(d.notes)
    && Array.isArray(d.hotkeys);
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let autoSavePending = false;

export function autoSave(slug: string): void {
  if (location.hostname !== 'localhost') return;
  autoSavePending = true;
  if (autoSaveTimer) return; // already debouncing
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    if (!autoSavePending) return;
    autoSavePending = false;
    doAutoSave(slug).catch(() => {});
  }, 30_000);
}

async function doAutoSave(slug: string): Promise<void> {
  const [projectExport, globalExport] = await Promise.all([
    workerApi.exportProjectData(slug),
    workerApi.exportGlobalData(),
  ]);

  let projectData: ProjectData | null = null;
  let projectConfig: Partial<ProjectConfig> | null = null;
  try { const raw = localStorage.getItem(`proj-data-${slug}`); if (raw) projectData = JSON.parse(raw); } catch { /* */ }
  try { const raw = localStorage.getItem(`proj-config-${slug}`); if (raw) projectConfig = JSON.parse(raw); } catch { /* */ }

  const backup: BackupFile = {
    version: 1,
    backupType: 'full',
    exportedAt: new Date().toISOString(),
    slug,
    projectData,
    projectConfig,
    cards: projectExport.cards,
    review_log: projectExport.review_log,
    scores: projectExport.scores,
    activity: projectExport.activity,
    notes: projectExport.notes,
    hotkeys: globalExport.hotkeys,
  };

  await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, fileName: 'autosave.json', data: backup }),
  });
}

export async function fetchAutosave(slug: string): Promise<BackupFile | null> {
  if (location.hostname !== 'localhost') return null;
  try {
    const res = await fetch(`/api/autosave/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return validateBackupFile(data) ? data : null;
  } catch { return null; }
}

export async function downloadBackup(slug: string): Promise<void> {
  await initWorker();

  const [projectExport, globalExport] = await Promise.all([
    workerApi.exportProjectData(slug),
    workerApi.exportGlobalData(),
  ]);

  let projectData: ProjectData | null = null;
  let projectConfig: Partial<ProjectConfig> | null = null;
  try {
    const raw = localStorage.getItem(`proj-data-${slug}`);
    if (raw) projectData = JSON.parse(raw);
  } catch { /* */ }
  try {
    const raw = localStorage.getItem(`proj-config-${slug}`);
    if (raw) projectConfig = JSON.parse(raw);
  } catch { /* */ }

  const backup: BackupFile = {
    version: 1,
    backupType: 'full',
    exportedAt: new Date().toISOString(),
    slug,
    projectData,
    projectConfig,
    cards: projectExport.cards,
    review_log: projectExport.review_log,
    scores: projectExport.scores,
    activity: projectExport.activity,
    notes: projectExport.notes,
    hotkeys: globalExport.hotkeys,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function restoreBackup(data: BackupFile): Promise<string> {
  await initWorker();

  if (data.projectData) {
    try { localStorage.setItem(`proj-data-${data.slug}`, JSON.stringify(data.projectData)); } catch { /* */ }
  }
  if (data.projectConfig) {
    try { localStorage.setItem(`proj-config-${data.slug}`, JSON.stringify(data.projectConfig)); } catch { /* */ }
  }

  await workerApi.importProjectData(
    data.slug,
    data.cards,
    data.review_log,
    data.scores,
    data.activity,
    data.notes,
  );
  await workerApi.importGlobalData(data.hotkeys);

  return data.slug;
}

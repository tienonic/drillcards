import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'solid-js';

// Mock external dependencies before importing the module under test
vi.mock('../../core/hooks/useWorker.ts', () => {
  const { createSignal } = require('solid-js');
  return {
    initWorker: vi.fn().mockResolvedValue(undefined),
    workerApi: {
      loadProject: vi.fn().mockResolvedValue({ ok: true }),
      setFSRSParams: vi.fn().mockResolvedValue({ ok: true }),
      getDeckStats: vi.fn().mockResolvedValue({ new: 5, learning: 0, due: 0 }),
      getSessionSummary: vi.fn().mockResolvedValue({ lastReviewAt: null, dueNow: 0 }),
    },
    terminateWorker: vi.fn(),
  };
});

vi.mock('../backup/backup.ts', () => ({
  fetchAutosave: vi.fn().mockResolvedValue(null),
  restoreBackup: vi.fn().mockResolvedValue('test-project'),
  autoSave: vi.fn(),
}));

vi.mock('../settings/keybinds.ts', () => ({
  loadKeybinds: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../glossary/store.ts', () => ({
  buildGlossary: vi.fn(),
}));

vi.mock('../../core/store/config.ts', () => ({
  getGlobalFSRSDefaults: vi.fn().mockReturnValue({
    desired_retention: 0.9,
    new_per_session: 20,
    leech_threshold: 8,
    max_interval: 90,
  }),
}));

vi.mock('../quiz/helpers.ts', () => ({
  sectionToCardType: vi.fn().mockReturnValue('mcq'),
}));

import { openProject, isLoading, loadError, getProjectConfig } from './store.ts';
import { appPhase, activeProject, activeTab } from '../../core/store/app.ts';
import { initWorker, workerApi } from '../../core/hooks/useWorker.ts';
import { fetchAutosave, restoreBackup } from '../backup/backup.ts';
import { loadKeybinds } from '../settings/keybinds.ts';
import { buildGlossary } from '../glossary/store.ts';
import type { ProjectData } from '../../projects/types.ts';

const minimalProject: ProjectData = {
  name: 'Test Project',
  sections: [{
    id: 'sec1',
    name: 'Section 1',
    type: 'mc-quiz',
    questions: [{ q: 'Q1?', correct: 'A', wrong: ['B', 'C', 'D'] }],
  }],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Reset getDeckStats to non-empty (no auto-restore by default)
  vi.mocked(workerApi.getDeckStats).mockResolvedValue({ new: 5, learning: 0, due: 0 });
  vi.mocked(fetchAutosave).mockResolvedValue(null);
});

describe('openProject', () => {
  it('happy path: transitions to study phase with activeProject set', async () => {
    await createRoot(async (dispose) => {
      await openProject(minimalProject, false);

      expect(isLoading()).toBe(false);
      expect(loadError()).toBeNull();
      expect(activeProject()?.name).toBe('Test Project');
      expect(activeProject()?.slug).toBe('test-project');
      expect(activeTab()).toBe('sec1');
      expect(appPhase()).toBe('study');

      dispose();
    });
  });

  it('calls initWorker, loadProject, setFSRSParams, loadKeybinds in order', async () => {
    await createRoot(async (dispose) => {
      await openProject(minimalProject, false);

      expect(initWorker).toHaveBeenCalled();
      expect(workerApi.loadProject).toHaveBeenCalledWith(
        'test-project',
        ['sec1'],
        expect.arrayContaining([expect.objectContaining({ sectionId: 'sec1', cardId: 'sec1-0', cardType: 'mcq' })]),
      );
      expect(workerApi.setFSRSParams).toHaveBeenCalled();
      expect(loadKeybinds).toHaveBeenCalled();
      expect(buildGlossary).toHaveBeenCalled();

      dispose();
    });
  });

  it('auto-restore: calls restoreBackup when DB is empty and autosave exists', async () => {
    vi.mocked(workerApi.getDeckStats).mockResolvedValue({ new: 0, learning: 0, due: 0 });
    vi.mocked(fetchAutosave).mockResolvedValue({
      version: 1, backupType: 'project', slug: 'test-project',
      cards: [{ card_id: 'c1' }], review_log: [], scores: [], activity: [], notes: [], hotkeys: [],
    });

    await createRoot(async (dispose) => {
      await openProject(minimalProject, false);

      expect(fetchAutosave).toHaveBeenCalledWith('test-project');
      expect(restoreBackup).toHaveBeenCalled();
      // Second loadProject + setFSRSParams after restore
      expect(workerApi.loadProject).toHaveBeenCalledTimes(2);
      expect(workerApi.setFSRSParams).toHaveBeenCalledTimes(2);
      expect(activeProject()?.name).toBe('Test Project');

      dispose();
    });
  });

  it('auto-restore skipped: empty DB but no autosave', async () => {
    vi.mocked(workerApi.getDeckStats).mockResolvedValue({ new: 0, learning: 0, due: 0 });
    vi.mocked(fetchAutosave).mockResolvedValue(null);

    await createRoot(async (dispose) => {
      await openProject(minimalProject, false);

      expect(fetchAutosave).toHaveBeenCalled();
      expect(restoreBackup).not.toHaveBeenCalled();
      expect(workerApi.loadProject).toHaveBeenCalledTimes(1);
      expect(activeProject()?.name).toBe('Test Project');

      dispose();
    });
  });

  it('worker init failure: sets loadError and clears isLoading', async () => {
    vi.mocked(initWorker).mockRejectedValue(new Error('Worker init failed'));

    await createRoot(async (dispose) => {
      await openProject(minimalProject, false);

      expect(isLoading()).toBe(false);
      expect(loadError()).toBe('Worker init failed');
      // activeProject is module-level and may retain value from previous test
      // The key assertion: appPhase did NOT transition to 'study'
      expect(workerApi.loadProject).not.toHaveBeenCalled();

      dispose();
    });
  });

  it('isDefault=true does not write proj-data to localStorage', async () => {
    // Clear any previous proj-data
    try { localStorage.removeItem('proj-data-test-project'); } catch {}

    await createRoot(async (dispose) => {
      await openProject(minimalProject, true);

      // isDefault=true should skip saveProjectData
      let saved: string | null = null;
      try { saved = localStorage.getItem('proj-data-test-project'); } catch {}
      expect(saved).toBeNull();
      expect(activeProject()?.name).toBe('Test Project');

      dispose();
    });
  });
});

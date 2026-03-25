import { createSignal, batch } from 'solid-js';
import { projectRegistry } from '../../projects/registry.ts';
import { loadProject, validateProject } from '../../projects/loader.ts';
import { initWorker, workerApi } from '../../core/hooks/useWorker.ts';
import { setAppPhase, setActiveProject, setActiveTab, setHeaderVisible, setActivePanel, setHeaderLocked, setSessionSummary, formatGap } from '../../core/store/app.ts';
import { buildGlossary } from '../glossary/store.ts';
import { loadKeybinds } from '../settings/keybinds.ts';
import { fetchAutosave, restoreBackup } from '../backup/backup.ts';
import { getGlobalFSRSDefaults } from '../../core/store/config.ts';
import { sectionToCardType } from '../quiz/helpers.ts';
import type { Project, ProjectData } from '../../projects/types.ts';

interface RecentProject {
  name: string;
  slug: string;
  timestamp: number;
}

const [isLoading, setIsLoading] = createSignal(false);
const [loadError, setLoadError] = createSignal<string | null>(null);
const [failedSlug, setFailedSlug] = createSignal<string | null>(null);

export { isLoading, loadError, setLoadError, failedSlug, setFailedSlug };

export function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem('recent-projects');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function addRecentProject(name: string, slug: string) {
  try {
    let list: RecentProject[] = getRecentProjects();
    list = list.filter(p => p.slug !== slug);
    list.unshift({ name, slug, timestamp: Date.now() });
    if (list.length > 10) list = list.slice(0, 10);
    localStorage.setItem('recent-projects', JSON.stringify(list));
  } catch { /* */ }
}

function setLastProject(slug: string) {
  try { localStorage.setItem('last-project', slug); } catch { /* */ }
}

export function getLastProject(): string | null {
  try { return localStorage.getItem('last-project'); } catch { return null; }
}

function saveProjectData(slug: string, data: ProjectData) {
  try { localStorage.setItem(`proj-data-${slug}`, JSON.stringify(data)); } catch { /* */ }
}

export function getProjectData(slug: string): ProjectData | null {
  try {
    const raw = localStorage.getItem(`proj-data-${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveProjectConfig(slug: string, config: Partial<Project['config']>) {
  try { localStorage.setItem(`proj-config-${slug}`, JSON.stringify(config)); } catch {}
}

export function getProjectConfig(slug: string): Partial<Project['config']> | null {
  try {
    const raw = localStorage.getItem(`proj-config-${slug}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function openProject(data: ProjectData, isDefault: boolean, registryFolder?: string) {
  if (isLoading()) return;
  batch(() => { setIsLoading(true); setLoadError(null); });

  try {
    const project = loadProject(data);
    const savedConfig = getProjectConfig(project.slug);
    if (savedConfig) {
      Object.assign(project.config, savedConfig);
    } else {
      const globalDefaults = getGlobalFSRSDefaults();
      project.config.desired_retention = globalDefaults.desired_retention;
      project.config.new_per_session = globalDefaults.new_per_session;
      project.config.leech_threshold = globalDefaults.leech_threshold;
      project.config.max_interval = globalDefaults.max_interval;
    }
    if (registryFolder) {
      project.sourceFolder = `src/projects/${registryFolder}`;
    }

    // Ensure worker is initialized before registering cards
    await initWorker();

    // Register cards with SQLite worker
    const cardRegs: { sectionId: string; cardId: string; cardType: 'mcq' | 'passage' | 'flashcard' }[] = [];
    const sectionIds: string[] = [];
    for (const s of project.sections) {
      sectionIds.push(s.id);
      const mcqType = sectionToCardType(s.type);
      for (const id of s.cardIds) {
        cardRegs.push({ sectionId: s.id, cardId: id, cardType: mcqType });
      }
      for (const id of s.flashCardIds) {
        cardRegs.push({ sectionId: s.id, cardId: id, cardType: 'flashcard' });
      }
    }
    await workerApi.loadProject(project.slug, sectionIds, cardRegs);
    await workerApi.setFSRSParams(project.config.desired_retention, project.config.leech_threshold, project.config.max_interval);
    await loadKeybinds();

    // Auto-restore: if DB appears empty but an autosave exists on disk, restore it
    const stats = await workerApi.getDeckStats(project.slug);
    if (stats.new + stats.learning + stats.due === 0 && cardRegs.length > 0) {
      const autosave = await fetchAutosave(project.slug);
      if (autosave && autosave.cards.length > 0) {
        await restoreBackup(autosave);
        await workerApi.loadProject(project.slug, sectionIds, cardRegs);
        await workerApi.setFSRSParams(project.config.desired_retention, project.config.leech_threshold, project.config.max_interval);
      }
    }

    // Persist project data only after async loading succeeds — prevents failed projects
    // from appearing in recent list or being auto-loaded on next startup
    if (!isDefault) saveProjectData(project.slug, data);
    setLastProject(project.slug);
    addRecentProject(project.name, project.slug);

    batch(() => {
      setHeaderVisible(false);
      setActivePanel(null);
      setHeaderLocked(false);
      setActiveProject(project);
      buildGlossary(project);
      setActiveTab(project.sections[0]?.id ?? null);
      setAppPhase('study');
      setIsLoading(false);
    });

    // Fetch session summary (non-blocking)
    workerApi.getSessionSummary(project.slug).then(summary => {
      if (!summary.lastReviewAt) return;
      const ms = Date.now() - new Date(summary.lastReviewAt).getTime();
      const hours = ms / 3600000;
      if (hours >= 2) {
        setSessionSummary({
          lastReviewAt: summary.lastReviewAt,
          dueNow: summary.dueNow,
          gap: formatGap(summary.lastReviewAt),
        });
      }
    }).catch(() => {});
  } catch (err) {
    batch(() => {
      setLoadError(err instanceof Error ? err.message : 'Failed to load project');
      setIsLoading(false);
    });
  }
}

export async function openRegistryProject(slug: string) {
  const entry = projectRegistry.find(p => p.slug === slug);
  if (!entry) {
    setLoadError('Project not found in registry');
    return;
  }
  try {
    const data = await entry.loader();
    await openProject(data, true, entry.folder);
  } catch (err) {
    setLoadError('Failed to load project: ' + (err instanceof Error ? err.message : String(err)));
  }
}

export function openRecentProject(slug: string) {
  batch(() => { setLoadError(null); setFailedSlug(null); });
  const entry = projectRegistry.find(p => p.slug === slug);
  if (entry) {
    entry.loader()
      .then(data => openProject(data, true, entry.folder))
      .catch(err => batch(() => { setLoadError('Failed to load'); setFailedSlug(slug); }));
  } else {
    const saved = getProjectData(slug);
    if (saved) openProject(saved, false);
    else batch(() => { setLoadError('Data not found — re-import file'); setFailedSlug(slug); });
  }
}

export function clearRecentProjects() {
  try { localStorage.removeItem('recent-projects'); } catch { /* */ }
}

export function removeRecentProject(slug: string) {
  try {
    const list = getRecentProjects().filter(p => p.slug !== slug);
    localStorage.setItem('recent-projects', JSON.stringify(list));
  } catch { /* */ }
}

export function goToLauncher() {
  batch(() => { setAppPhase('launcher'); setActiveProject(null); setActiveTab(null); });
}

export async function validateAndOpenFile(jsonStr: string) {
  try {
    const data = JSON.parse(jsonStr);

    // Detect backup files
    if (data.version === 1 && data.backupType && typeof data.slug === 'string' && Array.isArray(data.cards)) {
      batch(() => { setIsLoading(true); setLoadError(null); });
      try {
        const { validateBackupFile, restoreBackup } = await import('../backup/backup.ts');
        if (!validateBackupFile(data)) {
          batch(() => { setLoadError('Invalid backup file'); setIsLoading(false); });
          return;
        }
        const slug = await restoreBackup(data);
        setIsLoading(false);
        openRecentProject(slug);
      } catch (err) {
        batch(() => {
          setLoadError('Failed to restore backup: ' + (err instanceof Error ? err.message : String(err)));
          setIsLoading(false);
        });
      }
      return;
    }

    const errors = validateProject(data);
    if (errors.length > 0) {
      setLoadError('Invalid project: ' + errors.join(', '));
      return;
    }
    openProject(data, false);
  } catch (err) {
    setLoadError('Failed to parse JSON: ' + (err instanceof Error ? err.message : String(err)));
  }
}

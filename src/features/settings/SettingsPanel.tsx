import './settings.css';
import { Show, onMount, onCleanup, createSignal, batch } from 'solid-js';
import { Portal } from 'solid-js/web';
import { activeProject, activePanel, setActivePanel, setHeaderLocked, graphVisible, toggleGraphVisible, syncActivity, toggleSyncActivity, termsVisible, toggleTermsVisible } from '../../core/store/app.ts';
import { exportProjectData } from '../export/export.ts';
import { workerApi } from '../../core/hooks/useWorker.ts';
import { saveProjectConfig, openRecentProject } from '../launcher/store.ts';

const PRESETS = [
  { label: 'Relaxed', retention: 0.80, maxInterval: 180 },
  { label: 'Balanced', retention: 0.90, maxInterval: 60 },
  { label: 'Tight', retention: 0.95, maxInterval: 30 },
] as const;

export function SettingsPanel() {
  const [retention, setRetention] = createSignal(0.9);
  const [newPerSession, setNewPerSession] = createSignal(20);
  const [leechThreshold, setLeechThreshold] = createSignal(8);
  const [maxInterval, setMaxInterval] = createSignal(90);
  const [saved, setSaved] = createSignal(false);
  const [panelTop, setPanelTop] = createSignal(0);
  let btnRef!: HTMLButtonElement;
  const [exportLabel, setExportLabel] = createSignal('Export');
  const [backupStatus, setBackupStatus] = createSignal<string | null>(null);
  let backupTimer: ReturnType<typeof setTimeout> | undefined;
  let backupInput!: HTMLInputElement;

  function activePreset(): string | null {
    const ret = retention();
    const mi = maxInterval();
    for (const p of PRESETS) {
      if (p.retention === ret && p.maxInterval === mi) return p.label;
    }
    return null;
  }

  function load() {
    const project = activeProject();
    if (!project) return;
    batch(() => {
      setRetention(project.config.desired_retention);
      setNewPerSession(project.config.new_per_session);
      setLeechThreshold(project.config.leech_threshold);
      setMaxInterval(project.config.max_interval);
    });
  }

  function handleOpen() {
    if (activePanel() === 'settings') {
      batch(() => { setActivePanel(null); setHeaderLocked(false); });
    } else {
      load();
      batch(() => { setPanelTop(btnRef.getBoundingClientRect().top); setActivePanel('settings'); setHeaderLocked(true); setSaved(false); });
    }
  }

  function close() { batch(() => { setActivePanel(null); setHeaderLocked(false); }); }

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  function delayedClose() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(close, 5000);
  }

  const escHandler = (e: KeyboardEvent) => { if (e.key === 'Escape' && activePanel() === 'settings') { if (closeTimer) clearTimeout(closeTimer); close(); } };
  onMount(() => document.addEventListener('keydown', escHandler));
  onCleanup(() => { document.removeEventListener('keydown', escHandler); if (saveTimer) clearTimeout(saveTimer); if (closeTimer) clearTimeout(closeTimer); if (backupTimer) clearTimeout(backupTimer); });

  async function handleSave() {
    const project = activeProject();
    if (!project) return;

    const ret = Math.max(0.7, Math.min(0.99, retention()));
    const nps = Math.max(1, Math.min(100, Math.round(newPerSession())));
    const lt = Math.max(2, Math.min(30, Math.round(leechThreshold())));
    const mi = Math.max(7, Math.min(365, Math.round(maxInterval())));

    project.config.desired_retention = ret;
    project.config.new_per_session = nps;
    project.config.leech_threshold = lt;
    project.config.max_interval = mi;

    try {
      await workerApi.setFSRSParams(ret, lt, mi);
      saveProjectConfig(project.slug, { desired_retention: ret, new_per_session: nps, leech_threshold: lt, max_interval: mi });
      batch(() => { setRetention(ret); setNewPerSession(nps); setLeechThreshold(lt); setMaxInterval(mi); setSaved(true); });
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { setSaved(false); saveTimer = undefined; }, 1500);
    } catch {
      // Keep local state changes; DB persistence failure is non-critical
    }
  }

  function applyPreset(preset: typeof PRESETS[number]) {
    batch(() => {
      setRetention(preset.retention);
      setMaxInterval(preset.maxInterval);
    });
  }

  async function handleExport() {
    const project = activeProject();
    if (!project) return;
    try {
      const { downloadBackup } = await import('../backup/backup.ts');
      await downloadBackup(project.slug);
      setBackupStatus('Exported!');
      if (backupTimer) clearTimeout(backupTimer);
      backupTimer = setTimeout(() => setBackupStatus(null), 1500);
    } catch {
      setBackupStatus('Export failed');
      if (backupTimer) clearTimeout(backupTimer);
      backupTimer = setTimeout(() => setBackupStatus(null), 2000);
    }
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const { validateBackupFile, restoreBackup } = await import('../backup/backup.ts');
      if (!validateBackupFile(data)) {
        setBackupStatus('Invalid backup file');
        if (backupTimer) clearTimeout(backupTimer);
        backupTimer = setTimeout(() => setBackupStatus(null), 2000);
        return;
      }
      const slug = await restoreBackup(data);
      close();
      openRecentProject(slug);
    } catch {
      setBackupStatus('Import failed');
      if (backupTimer) clearTimeout(backupTimer);
      backupTimer = setTimeout(() => setBackupStatus(null), 2000);
    }
  }

  return (
    <>
      <button type="button" ref={btnRef} class="tips-btn" title="FSRS settings" onClick={handleOpen}>Settings</button>
      <Show when={activePanel() === 'settings'}>
        <Portal>
          <div class="settings-backdrop" onClick={(e) => { if (e.target instanceof Element && e.target.classList.contains('settings-backdrop')) close(); }}>
            <div class="settings-dropdown" style={{ top: `${panelTop()}px` }} onMouseEnter={() => { if (closeTimer) clearTimeout(closeTimer); }} onMouseLeave={() => { if (activePanel() === 'settings') delayedClose(); }}>
              <label class="settings-toggle"><input type="checkbox" checked={graphVisible()} onChange={toggleGraphVisible} />Show Graph</label>
              <label class="settings-toggle"><input type="checkbox" checked={syncActivity()} onChange={toggleSyncActivity} />Sync Graph</label>
              <label class="settings-toggle"><input type="checkbox" checked={termsVisible()} onChange={toggleTermsVisible} />Key Terms</label>
              <button type="button" class="settings-export-btn" disabled={exportLabel() !== 'Export'} onClick={async () => {
                const p = activeProject();
                if (!p) return;
                setExportLabel('Exporting…');
                try {
                  const ok = await exportProjectData(p);
                  setExportLabel(ok ? 'Exported!' : 'Failed');
                } catch { setExportLabel('Failed'); }
                setTimeout(() => setExportLabel('Export'), 1500);
              }}>{exportLabel()}</button>
              <div class="settings-backup-divider" />
              <div class="preset-row">
                {PRESETS.map(p => (
                  <button type="button" class={`preset-btn${activePreset() === p.label ? ' active' : ''}`} onMouseEnter={() => applyPreset(p)} onClick={() => applyPreset(p)}>{p.label}</button>
                ))}
              </div>
              <div class="settings-hint">Higher retention = more frequent reviews. Max interval caps how far ahead cards are scheduled.</div>
              <label class="settings-field"><span>Retention</span><input type="number" min="0.7" max="0.99" step="0.01" value={retention()} onInput={e => { const v = parseFloat(e.currentTarget.value); setRetention(isNaN(v) ? 0.9 : v); }} /></label>
              <label class="settings-field"><span>Max interval (days)</span><input type="number" min="7" max="365" step="1" value={maxInterval()} onInput={e => { const v = parseInt(e.currentTarget.value, 10); setMaxInterval(isNaN(v) ? 90 : v); }} /></label>
              <label class="settings-field"><span>New cards / session</span><input type="number" min="1" max="100" step="1" value={newPerSession()} onInput={e => { const v = parseInt(e.currentTarget.value, 10); setNewPerSession(isNaN(v) ? 20 : v); }} /></label>
              <label class="settings-field"><span>Leech threshold</span><input type="number" min="2" max="30" step="1" value={leechThreshold()} onInput={e => { const v = parseInt(e.currentTarget.value, 10); setLeechThreshold(isNaN(v) ? 8 : v); }} /></label>
              <button type="button" class="settings-save-btn" onClick={handleSave}>{saved() ? 'Saved' : 'Save'}</button>
              <div class="settings-backup-divider" />
              <button type="button" class="settings-backup-btn" onClick={handleExport}>Export Backup</button>
              <button type="button" class="settings-backup-btn" onClick={() => backupInput.click()}>Import Backup</button>
              <input ref={backupInput} type="file" accept=".json" class="hidden" onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) { handleImportFile(f); e.currentTarget.value = ''; } }} />
              <Show when={backupStatus()}><div class="settings-backup-status">{backupStatus()}</div></Show>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}

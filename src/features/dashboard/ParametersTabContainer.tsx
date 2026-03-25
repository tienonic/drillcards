import { createSignal } from 'solid-js';
import { ParametersTab } from './ParametersTab.tsx';

const LS_KEY = 'fsrs-global-defaults';

const DEFAULTS = {
  desired_retention: 0.9,
  new_per_session: 20,
  leech_threshold: 8,
  max_interval: 90,
};

function loadDefaults() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* */ }
  return { ...DEFAULTS };
}

function saveDefaults(d: typeof DEFAULTS) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch { /* */ }
}

export function getGlobalFSRSDefaults() {
  return loadDefaults();
}

export function ParametersTabContainer() {
  const [defaults, setDefaults] = createSignal(loadDefaults());

  function handleSave(d: typeof DEFAULTS) {
    saveDefaults(d);
    setDefaults(d);
  }

  return <ParametersTab defaults={defaults()} onSaveDefaults={handleSave} />;
}

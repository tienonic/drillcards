import { createSignal, For, Show } from 'solid-js';
import { createHoverMenu } from './createHoverMenu.ts';

interface FSRSDefaults {
  desired_retention: number;
  new_per_session: number;
  leech_threshold: number;
  max_interval: number;
}

interface ParametersTabProps {
  defaults: FSRSDefaults;
  onSaveDefaults: (d: FSRSDefaults) => void;
}

export function ParametersTab(props: ParametersTabProps) {
  const menu = createHoverMenu();
  const [retention, setRetention] = createSignal(props.defaults.desired_retention);
  const [newPerSession, setNewPerSession] = createSignal(props.defaults.new_per_session);
  const [leechThreshold, setLeechThreshold] = createSignal(props.defaults.leech_threshold);
  const [maxInterval, setMaxInterval] = createSignal(props.defaults.max_interval);
  const [saved, setSaved] = createSignal(false);

  function handleSave() {
    props.onSaveDefaults({
      desired_retention: retention(),
      new_per_session: newPerSession(),
      leech_threshold: leechThreshold(),
      max_interval: maxInterval(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div class="db-create" onMouseLeave={() => menu.closeAll()}>
      <div class="db-create-menu">

        {/* FSRS Defaults */}
        <div
          class="db-create-item"
          onMouseEnter={() => menu.enter('fsrs')}
          onMouseLeave={() => menu.leave('fsrs')}
        >
          <span class="db-create-item-label">FSRS Defaults</span>
          <span class="db-create-item-sub">Retention & limits</span>
          <div class={`db-submenu db-submenu-wide ${menu.isOpen('fsrs') ? 'db-submenu--open' : ''}`}>
            <div class="db-params-form">
              <label class="db-params-field">
                <span class="db-params-label">Desired Retention</span>
                <div class="db-params-row">
                  <input
                    type="range" min="0.80" max="0.97" step="0.01"
                    value={retention()}
                    onInput={(e) => setRetention(parseFloat(e.currentTarget.value))}
                    class="db-params-slider"
                  />
                  <span class="db-params-value">{Math.round(retention() * 100)}%</span>
                </div>
              </label>
              <label class="db-params-field">
                <span class="db-params-label">New Cards per Session</span>
                <input type="number" min="1" max="100" value={newPerSession()}
                  onInput={(e) => setNewPerSession(Math.max(1, parseInt(e.currentTarget.value, 10) || 1))}
                  class="db-params-input" />
              </label>
              <label class="db-params-field">
                <span class="db-params-label">Leech Threshold</span>
                <input type="number" min="2" max="30" value={leechThreshold()}
                  onInput={(e) => setLeechThreshold(Math.max(2, parseInt(e.currentTarget.value, 10) || 8))}
                  class="db-params-input" />
              </label>
              <label class="db-params-field">
                <span class="db-params-label">Max Interval (days)</span>
                <input type="number" min="7" max="365" value={maxInterval()}
                  onInput={(e) => setMaxInterval(Math.max(7, parseInt(e.currentTarget.value, 10) || 90))}
                  class="db-params-input" />
              </label>
              <button type="button" class="db-params-save" onClick={handleSave}>
                {saved() ? 'Saved' : 'Save Defaults'}
              </button>
            </div>
          </div>
        </div>

        {/* Tips — Deck Generation */}
        <div
          class="db-create-item"
          onMouseEnter={() => menu.enter('tips')}
          onMouseLeave={() => menu.leave('tips')}
        >
          <span class="db-create-item-label">Tips</span>
          <span class="db-create-item-sub">Deck generation</span>
          <div class={`db-submenu db-submenu-wide ${menu.isOpen('tips') ? 'db-submenu--open' : ''}`}>
            <div class="db-params-dropdown-body db-params-tips">
              <p>Paste <button type="button" class="db-tips-open-btn" title="Open in explorer" onClick={() => fetch('/__open-folder?path=GENERATING_PROJECTS.md').catch(() => {})}>GENERATING_PROJECTS.md</button> into any LLM with your source material. It will generate a JSON you can import directly.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

import './activity.css';
import { Show, createSignal, onMount, onCleanup, batch } from 'solid-js';
import {
  activityScore, reviewStats, sidebarScore,
  setCanvasRef, loadActivity, clearActivity,
} from './store.ts';
import {
  copiedFlash, activeProject, activeTab,
  graphVisible, toggleGraphVisible,
  syncActivity, toggleSyncActivity,
  termsVisible, toggleTermsVisible,
} from '../../core/store/app.ts';
import { getTimerConfig } from '../../core/timerConfig.ts';
import { isAnsweringState } from '../quiz/sessionState.ts';

import type { SessionEntry } from '../../core/store/sections.ts';

export function ActivityWidget(props: { isFlashMode: () => boolean; activeEntry: () => SessionEntry | undefined }) {
  const session = () => props.activeEntry()?.session;
  const quizSession = () => { const e = props.activeEntry(); return e?.kind === 'quiz' ? e.session : undefined; };
  const historyPosition = () => quizSession()?.historyPosition();
  const visibleHistoryPosition = () => {
    const pos = historyPosition();
    return pos?.reviewing && pos.total > 0 ? pos : undefined;
  };
  const seconds = () => session()?.timer.seconds() ?? 0;
  const isAnswering = () => {
    const state = session()?.state();
    return state ? isAnsweringState(state) : false;
  };
  const paused = () => session()?.paused() ?? false;
  const togglePause = () => session()?.togglePause();

  const tc = () => {
    const project = activeProject();
    const tab = activeTab();
    if (!project || !tab) return { warnAt: 15, failAt: 60 };
    const sec = project.sections.find(s => s.id === tab);
    return getTimerConfig(project.config, tab, sec?.type ?? 'mc-quiz');
  };
  const timerCls = () => { const s = seconds(); const t = tc(); return `sidebar-timer${paused() ? ' paused' : ''}${s >= t.failAt ? ' skull' : s >= t.warnAt ? ' red' : ''}`; };
  const timerContent = () => { const s = seconds(); return paused() ? '\u23F8' : s >= tc().failAt ? '\u{1F480}' : s + 's'; };

  const [resetMenuOpen, setResetMenuOpen] = createSignal(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = createSignal(false);
  const [confirmAction, setConfirmAction] = createSignal<(() => void) | null>(null);

  let resetWrapRef: HTMLDivElement | undefined;
  let optionsWrapRef: HTMLDivElement | undefined;
  const clickOutsideHandler = (e: MouseEvent) => {
    if (!(e.target instanceof Node)) return;
    if (resetMenuOpen() && resetWrapRef && !resetWrapRef.contains(e.target)) {
      batch(() => { setResetMenuOpen(false); setConfirmAction(null); });
    }
    if (optionsMenuOpen() && optionsWrapRef && !optionsWrapRef.contains(e.target)) {
      setOptionsMenuOpen(false);
    }
  };
  onMount(() => document.addEventListener('mousedown', clickOutsideHandler));
  onCleanup(() => document.removeEventListener('mousedown', clickOutsideHandler));

  return (
    <>
      <div class="activity-widget">
        <div class="activity-options-wrap" ref={optionsWrapRef} onMouseDown={(e) => e.stopPropagation()}>
          <button type="button" class="activity-options-btn" title="Graph options" onClick={() => batch(() => { setOptionsMenuOpen(v => !v); setResetMenuOpen(false); setConfirmAction(null); })}>opt</button>
          <Show when={optionsMenuOpen()}>
            <div class="activity-options-menu">
              <label class="activity-option-check"><input type="checkbox" checked={graphVisible()} onChange={toggleGraphVisible} />Graph</label>
              <label class="activity-option-check"><input type="checkbox" checked={syncActivity()} onChange={toggleSyncActivity} />Sync</label>
              <label class="activity-option-check"><input type="checkbox" checked={termsVisible()} onChange={toggleTermsVisible} />Terms</label>
            </div>
          </Show>
        </div>
        <div class="activity-score-row"><Show when={isAnswering()}><span class={timerCls()} onClick={() => togglePause()} title={paused() ? 'Resume timer' : 'Pause timer'}>{timerContent()}</span></Show><div class="activity-score-label">{activityScore()}</div></div>
        <Show when={visibleHistoryPosition()}>
          {(pos) => <div class="history-position-badge">card {pos().current}/{pos().total}</div>}
        </Show>
        <div class="activity-chart-wrap">
          <canvas ref={el => setCanvasRef(el)} width="210" height="120" />
          <Show when={copiedFlash()}><span class="copied-flash">Copied</span></Show>
        </div>
        <div class="activity-widget-stats">
          <div class="activity-stats"><span class="stat-item">review: <strong>{reviewStats().reviews}</strong></span><span class="stat-item">retention: <strong>{reviewStats().retention}</strong></span></div>
          <div class="activity-stats"><span class="stat-item">score: <strong>{sidebarScore().correct} / {sidebarScore().attempted}</strong></span><span class="stat-item">due: <strong>{sidebarScore().due} / {sidebarScore().total}</strong></span></div>
          <div class="activity-reset-wrap" ref={resetWrapRef}>
            <button type="button" class="activity-reset-btn" onClick={() => {
              batch(() => { setResetMenuOpen(false); setConfirmAction(null); });
              if (props.isFlashMode()) quizSession()?.shuffleFlash?.()?.catch(() => {});
              else quizSession()?.shuffleMcq?.()?.catch(() => {});
            }}>shuffle</button>
            <button type="button" class="activity-reset-btn" onClick={() => setResetMenuOpen(v => !v)}>reset</button>
            <Show when={resetMenuOpen()}>
              <div class="reset-menu">
                <Show when={!confirmAction()} fallback={<div class="reset-confirm"><span class="reset-confirm-label">Are you sure?</span><div class="reset-confirm-btns"><button type="button" class="reset-confirm-yes" onClick={() => { confirmAction()?.(); batch(() => { setConfirmAction(null); setResetMenuOpen(false); }); }}>Yes</button><button type="button" class="reset-confirm-no" onClick={() => setConfirmAction(null)}>No</button></div></div>}>
                  <button type="button" class="reset-menu-item" onClick={() => { setConfirmAction(() => async () => { try { await clearActivity(); loadActivity(); } catch { /* UI action — failure keeps stale graph, no state to roll back */ } }); }}>Reset Graph</button>
                  <button type="button" class="reset-menu-item" onClick={() => { setConfirmAction(() => () => { const s = session(); if (s) { const r = s.resetSection(); if (r instanceof Promise) r.catch(() => {}); } }); }}>Reset Section</button>
                </Show>
              </div>
            </Show>
          </div>
        </div>
        <Show when={quizSession()?.cramMode()}>
          <div class="cram-bar">Cram mode — {quizSession()?.cramCount()} reviewed <button type="button" class="cram-end" onClick={() => quizSession()?.endCram()}>End</button></div>
        </Show>
      </div>
    </>
  );
}

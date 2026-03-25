import './activity.css';
import { Show, createSignal, onMount, onCleanup, batch } from 'solid-js';
import { activeProject } from '../../core/store/app.ts';
import { workerApi } from '../../core/hooks/useWorker.ts';
import {
  activityScore, reviewStats, sidebarScore,
  setCanvasRef, loadActivity, initActivityEffects,
} from './store.ts';

interface ActiveSession {
  timer?: { seconds: () => number };
  state?: () => string;
  paused?: () => boolean;
  togglePause?: () => void;
  cramMode?: () => boolean;
  cramCount?: () => number;
  endCram?: () => void;
  dueCount?: () => { newCount: number; due: number; total: number };
  shuffleFlash?: () => Promise<void>;
  shuffleMcq?: () => Promise<void>;
  resetSection?: () => void | Promise<void>;
}

export function ActivityWidget(props: { isFlashMode: () => boolean; activeSession: () => ActiveSession | undefined }) {
  initActivityEffects();

  const timer = () => props.activeSession()?.timer;
  const seconds = () => timer()?.seconds() ?? 0;
  const isAnswering = () => props.activeSession()?.state?.() === 'answering';
  const paused = () => props.activeSession()?.paused?.() ?? false;
  const togglePause = () => props.activeSession()?.togglePause?.();
  const timerCls = () => { const s = seconds(); return `sidebar-timer${paused() ? ' paused' : ''}${s >= 59 ? ' skull' : s >= 15 ? ' red' : ''}`; };
  const timerContent = () => { const s = seconds(); return paused() ? '\u23F8' : s >= 59 ? '\u{1F480}' : s + 's'; };

  const [resetMenuOpen, setResetMenuOpen] = createSignal(false);
  const [confirmAction, setConfirmAction] = createSignal<(() => void) | null>(null);

  let resetWrapRef: HTMLDivElement | undefined;
  const clickOutsideHandler = (e: MouseEvent) => { if (resetMenuOpen() && resetWrapRef && e.target instanceof Node && !resetWrapRef.contains(e.target)) { batch(() => { setResetMenuOpen(false); setConfirmAction(null); }); } };
  onMount(() => document.addEventListener('mousedown', clickOutsideHandler));
  onCleanup(() => document.removeEventListener('mousedown', clickOutsideHandler));

  return (
    <>
      <div class="activity-widget">
        <div class="activity-score-row"><Show when={isAnswering()}><span class={timerCls()} onClick={() => togglePause()} title={paused() ? 'Resume timer' : 'Pause timer'}>{timerContent()}</span></Show><div class="activity-score-label">{activityScore()}</div></div>
        <div class="activity-chart-wrap"><canvas ref={el => setCanvasRef(el)} width="210" height="120" /></div>
        <div class="activity-widget-stats">
          <div class="activity-stats"><span class="stat-item">review: <strong>{reviewStats().reviews}</strong></span><span class="stat-item">retention: <strong>{reviewStats().retention}</strong></span></div>
          <div class="activity-stats"><span class="stat-item">score: <strong>{sidebarScore().correct} / {sidebarScore().attempted}</strong></span><span class="stat-item">due: <strong>{sidebarScore().due} / {sidebarScore().total}</strong></span></div>
          <div class="activity-reset-wrap" ref={resetWrapRef}>
            <button type="button" class="activity-reset-btn" onClick={() => {
              batch(() => { setResetMenuOpen(false); setConfirmAction(null); });
              if (props.isFlashMode()) props.activeSession()?.shuffleFlash?.()?.catch(() => {});
              else props.activeSession()?.shuffleMcq?.()?.catch(() => {});
            }}>shuffle</button>
            <button type="button" class="activity-reset-btn" onClick={() => setResetMenuOpen(v => !v)}>reset</button>
            <Show when={resetMenuOpen()}>
              <div class="reset-menu">
                <Show when={!confirmAction()} fallback={<div class="reset-confirm"><span class="reset-confirm-label">Are you sure?</span><div class="reset-confirm-btns"><button type="button" class="reset-confirm-yes" onClick={() => { confirmAction()?.(); batch(() => { setConfirmAction(null); setResetMenuOpen(false); }); }}>Yes</button><button type="button" class="reset-confirm-no" onClick={() => setConfirmAction(null)}>No</button></div></div>}>
                  <button type="button" class="reset-menu-item" onClick={() => { setConfirmAction(() => async () => { try { const p = activeProject(); if (p) { await workerApi.clearActivity(p.slug); loadActivity(); } } catch { /* UI action — failure keeps stale graph, no state to roll back */ } }); }}>Reset Graph</button>
                  <button type="button" class="reset-menu-item" onClick={() => { setConfirmAction(() => () => { props.activeSession()?.resetSection?.()?.catch(() => {}); }); }}>Reset Section</button>
                </Show>
              </div>
            </Show>
          </div>
        </div>
        <Show when={props.activeSession()?.cramMode?.()}>
          <div class="cram-bar">Cram mode — {props.activeSession()?.cramCount?.()} reviewed <button type="button" class="cram-end" onClick={() => props.activeSession()?.endCram?.()}>End</button></div>
        </Show>
      </div>
    </>
  );
}
